import baileys from '@whiskeysockets/baileys';
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

import pino from 'pino';
import fs from 'fs';
import path from 'path';

import { downloadSession, uploadSession, getSessionDir, deleteStoredSession } from './session.js';
import { loadState, getState } from './state.js';
import { findCommand } from './commands.js';

const PREFIX = process.env.PREFIX || '.';
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS || '5', 10);

// In-memory registry of active sessions
export const sessions = new Map();

export function getSession(sessionId) { return sessions.get(sessionId); }
export function listActiveSessions() { return Array.from(sessions.keys()); }
export function activeCount() { return sessions.size; }
export function canCreateSession() { return sessions.size < MAX_SESSIONS; }

// Helper to read current state for a session
function s(sessionId, key) {
  return getState(sessionId)[key];
}

export async function startSession(sessionId, { restore = false } = {}) {
  if (sessions.has(sessionId)) return sessions.get(sessionId);

  if (!canCreateSession()) {
    throw new Error('Maximum number of active sessions reached. Try again later.');
  }

  const entry = { sock: null, qr: null, connected: false, lastActivity: Date.now(), profilePicSet: false };
  sessions.set(sessionId, entry);

  await loadState(sessionId);

  if (restore) await downloadSession(sessionId);

  const dir = getSessionDir(sessionId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['SwiftBot', 'Chrome', '1.0.0'],
    getMessage: async () => ({ conversation: '' })
  });

  entry.sock = sock;

  // ─── CONNECTION ───────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) entry.qr = qr;

    if (connection === 'open') {
      entry.connected = true;
      entry.qr = null;
      console.log(`[${sessionId}] Connected to WhatsApp!`);
      await uploadSession(sessionId);

      // Set profile picture
      try {
        const logoPath = path.resolve('public/assets/botlogo.jpg');
        if (fs.existsSync(logoPath) && !entry.profilePicSet) {
          await sock.updateProfilePicture(sock.user.id, fs.readFileSync(logoPath));
          entry.profilePicSet = true;
          console.log(`[${sessionId}] Profile picture updated.`);
        }
      } catch (err) {
        console.error(`[${sessionId}] Failed to set profile picture:`, err.message);
      }
    }

    if (connection === 'close') {
      entry.connected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log(`[${sessionId}] Connection closed. Logged out: ${loggedOut}`);

      sessions.delete(sessionId);

      if (loggedOut) {
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        await deleteStoredSession(sessionId);
      } else {
        setTimeout(() => {
          startSession(sessionId, { restore: false }).catch((err) =>
            console.error(`[${sessionId}] Reconnect failed:`, err.message)
          );
        }, 5000);
      }
    }
  });

  sock.ev.on('creds.update', async () => {
    await saveCreds();
    await uploadSession(sessionId);
  });

  // ─── INCOMING CALLS — anticall ────────────────────────────────
  sock.ev.on('call', async (calls) => {
    if (!s(sessionId, 'antiCall')) return;
    for (const call of calls) {
      if (call.status === 'offer') {
        try {
          await sock.rejectCall(call.id, call.from);
          console.log(`[${sessionId}] Rejected call from ${call.from}`);
        } catch (err) {
          console.error(`[${sessionId}] Failed to reject call:`, err.message);
        }
      }
    }
  });

  // ─── STATUS UPDATES — autoviewstatus / autolikestatus ─────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      // Status updates
      if (msg.key.remoteJid === 'status@broadcast') {
        if (s(sessionId, 'autoViewStatus')) {
          try {
            await sock.readMessages([msg.key]);
          } catch {}
        }
        if (s(sessionId, 'autoLikeStatus')) {
          try {
            await sock.sendMessage('status@broadcast', {
              react: { text: '❤️', key: msg.key }
            });
          } catch {}
        }
        continue; // don't process status updates as commands
      }

      if (type !== 'notify') continue;
      if (!msg.message) continue;

      entry.lastActivity = Date.now();

      // ─── AUTOREAD ────────────────────────────────────────────
      if (s(sessionId, 'autoRead')) {
        try {
          await sock.readMessages([msg.key]);
        } catch {}
      }

      // ─── AUTOTYPING / AUTORECORDING presence ─────────────────
      if (s(sessionId, 'autoTyping') || s(sessionId, 'autoRecording')) {
        try {
          const presence = s(sessionId, 'autoRecording') ? 'recording' : 'composing';
          await sock.sendPresenceUpdate(presence, msg.key.remoteJid);
          setTimeout(() => {
            sock.sendPresenceUpdate('paused', msg.key.remoteJid).catch(() => {});
          }, 3000);
        } catch {}
      }

      // ─── ANTIDELETE — store recent messages ──────────────────
      if (msg.message && !msg.key.fromMe) {
        if (!entry.recentMessages) entry.recentMessages = new Map();
        entry.recentMessages.set(msg.key.id, msg);
        // Keep only last 100 messages to avoid memory bloat
        if (entry.recentMessages.size > 100) {
          const firstKey = entry.recentMessages.keys().next().value;
          entry.recentMessages.delete(firstKey);
        }
      }

      // ─── COMMAND ROUTER ──────────────────────────────────────
      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        '';

      const sessionPrefix = s(sessionId, 'prefix') || PREFIX;
      if (!body.startsWith(sessionPrefix)) continue;

      const args = body.slice(sessionPrefix.length).trim().split(/\s+/);
      const commandName = args.shift().toLowerCase();
      const command = findCommand(commandName);
      if (!command) continue;

      try {
        await command.execute(sock, msg, args, commandName, sessionId);
      } catch (err) {
        console.error(`[${sessionId}] Error in command "${commandName}":`, err);
        try {
          await sock.sendMessage(msg.key.remoteJid, { text: 'An error occurred while running that command.' });
        } catch {}
      }
    }
  });

  // ─── ANTIDELETE — detect and resend deleted messages ──────────
  sock.ev.on('messages.update', async (updates) => {
    if (!s(sessionId, 'antiDelete')) return;
    for (const update of updates) {
      if (update.update?.messageStubType === 1) { // REVOKE
        const stored = entry.recentMessages?.get(update.key.id);
        if (!stored) continue;
        const jid = update.key.remoteJid;
        const sender = update.key.participant || update.key.remoteJid;
        const senderNum = sender.split('@')[0];

        try {
          const body =
            stored.message?.conversation ||
            stored.message?.extendedTextMessage?.text || '';

          if (body) {
            await sock.sendMessage(jid, {
              text: `🗑️ *Anti-Delete*\nFrom: @${senderNum}\n\n${body}`,
              mentions: [sender]
            });
          }
        } catch (err) {
          console.error(`[${sessionId}] Anti-delete failed:`, err.message);
        }
      }
    }
  });

  // ─── WELCOME / GOODBYE messages ───────────────────────────────
  sock.ev.on('group-participants.update', async (update) => {
    const { id: jid, participants, action } = update;

    if (action === 'add' && s(sessionId, 'welcomeMessage')) {
      for (const participant of participants) {
        try {
          const metadata = await sock.groupMetadata(jid);
          const num = participant.split('@')[0];
          await sock.sendMessage(jid, {
            text: `👋 Welcome @${num} to *${metadata.subject}*!\nWe're glad to have you here. 🎉`,
            mentions: [participant]
          });
        } catch (err) {
          console.error(`[${sessionId}] Welcome message failed:`, err.message);
        }
      }
    }

    if (action === 'remove' && s(sessionId, 'goodbyeMessage')) {
      for (const participant of participants) {
        try {
          const metadata = await sock.groupMetadata(jid);
          const num = participant.split('@')[0];
          await sock.sendMessage(jid, {
            text: `👋 Goodbye @${num}, hope to see you again in *${metadata.subject}*!`,
            mentions: [participant]
          });
        } catch (err) {
          console.error(`[${sessionId}] Goodbye message failed:`, err.message);
        }
      }
    }
  });

  return entry;
}

export async function restoreAllSessions() {
  const { listStoredSessions } = await import('./session.js');
  const ids = await listStoredSessions();

  for (const id of ids) {
    if (!canCreateSession()) {
      console.log(`Max sessions (${MAX_SESSIONS}) reached, not restoring ${id}`);
      continue;
    }
    try {
      await startSession(id, { restore: true });
      console.log(`Restored session: ${id}`);
    } catch (err) {
      console.error(`Failed to restore session ${id}:`, err.message);
    }
  }
}

export function generateSessionId() {
  return Math.random().toString(36).substring(2, 8) + Date.now().toString(36).slice(-4);
}
