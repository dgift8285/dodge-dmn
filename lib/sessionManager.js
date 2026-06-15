import baileys from '@whiskeysockets/baileys';
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

import pino from 'pino';
import fs from 'fs';
import path from 'path';

import { downloadSession, uploadSession, getSessionDir, deleteStoredSession } from './session.js';
import { loadState } from './state.js';
import { findCommand } from './commands.js';

const PREFIX = process.env.PREFIX || '.';
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS || '5', 10);

// In-memory registry of active sessions
// sessionId -> { sock, qr, connected, lastActivity }
export const sessions = new Map();

export function getSession(sessionId) {
  return sessions.get(sessionId);
}

export function listActiveSessions() {
  return Array.from(sessions.keys());
}

export function activeCount() {
  return sessions.size;
}

export function canCreateSession() {
  return sessions.size < MAX_SESSIONS;
}

export async function startSession(sessionId, { restore = false } = {}) {
  if (sessions.has(sessionId)) {
    return sessions.get(sessionId);
  }

  if (!canCreateSession()) {
    throw new Error('Maximum number of active sessions reached. Try again later.');
  }

  const entry = {
    sock: null,
    qr: null,
    connected: false,
    lastActivity: Date.now()
  };
  sessions.set(sessionId, entry);

  loadState(sessionId);

  if (restore) {
    await downloadSession(sessionId);
  }

  const dir = getSessionDir(sessionId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['SwiftBot', 'Chrome', '1.0.0']
  });

  entry.sock = sock;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      entry.qr = qr;
    }

    if (connection === 'open') {
      entry.connected = true;
      entry.qr = null;
      console.log(`[${sessionId}] Connected to WhatsApp!`);
      await uploadSession(sessionId);

      // Set bot profile picture (only if not already set for this session)
      try {
        const logoPath = path.resolve('public/botlogo.jpg');
        if (fs.existsSync(logoPath) && !entry.profilePicSet) {
          const imageBuffer = fs.readFileSync(logoPath);
          await sock.updateProfilePicture(sock.user.id, imageBuffer);
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

      if (loggedOut) {
        // Clean up everything for this session
        sessions.delete(sessionId);
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
        await deleteStoredSession(sessionId);
      } else {
        // Try to reconnect this session
        sessions.delete(sessionId);
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

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg.message) return;

    entry.lastActivity = Date.now();

    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      '';

    if (!body.startsWith(PREFIX)) return;

    const args = body.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const command = findCommand(commandName);
    if (!command) return;

    try {
      await command.execute(sock, msg, args, commandName, sessionId);
    } catch (err) {
      console.error(`[${sessionId}] Error executing command "${commandName}":`, err);
      try {
        await sock.sendMessage(msg.key.remoteJid, { text: 'An error occurred while running that command.' });
      } catch {}
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
