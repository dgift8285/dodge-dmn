import { getState, setState } from '../state.js';
import { isSessionOwner } from '../commandHelpers.js';

const PREFIX = process.env.PREFIX || '.';

// Generic toggle command factory
function toggleCommand(names, stateKey, label, requireOwner = true) {
  return {
    names,
    execute: async (sock, msg, args, commandName, sessionId) => {
      const jid = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;
      const state = getState(sessionId);

      if (requireOwner && !isSessionOwner(sock, sender, msg, state)) {
        await sock.sendMessage(jid, { text: 'Only the bot owner can use this command.' });
        return;
      }

      const value = args[0]?.toLowerCase();
      if (value === 'on' || value === 'off') {
        await setState(sessionId, stateKey, value === 'on');
        await sock.sendMessage(jid, { text: `✅ ${label} turned ${value}.` });
      } else {
        const current = state[stateKey] ? 'on' : 'off';
        await sock.sendMessage(jid, {
          text: `${label} is currently *${current}*.\nUse ${PREFIX}${names[0]} on/off to change.`
        });
      }
    }
  };
}

export const settingsCommands = {
  togglestatus: toggleCommand(['togglestatus'], 'status', 'Bot status'),
  autorecording: toggleCommand(['autorecording'], 'autoRecording', 'Auto-recording presence'),
  autotyping: toggleCommand(['autotyping'], 'autoTyping', 'Auto-typing presence'),
  anticall: toggleCommand(['anticall', 'antiCall'], 'antiCall', 'Anti-call (reject calls automatically)'),
  welcome: toggleCommand(['welcome'], 'welcomeMessage', 'Welcome messages for new group members'),
  goodbye: toggleCommand(['goodbye'], 'goodbyeMessage', 'Goodbye messages for leaving members'),
  autoread: toggleCommand(['autoread'], 'autoRead', 'Auto-read incoming messages'),
  autoviewstatus: toggleCommand(['autoviewstatus'], 'autoViewStatus', 'Auto-view contact statuses'),
  autolikestatus: toggleCommand(['autolikestatus'], 'autoLikeStatus', 'Auto-like contact statuses'),
  antidelete: toggleCommand(['antidelete'], 'antiDelete', 'Anti-delete (resend deleted messages)'),
  autobio: toggleCommand(['autobio'], 'autoBio', 'Auto-updating bio'),

  mode: {
    names: ['mode'],
    execute: async (sock, msg, args, commandName, sessionId) => {
      const jid = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;
      const state = getState(sessionId);

      if (!isSessionOwner(sock, sender, msg, state)) {
        await sock.sendMessage(jid, { text: 'Only the bot owner can use this command.' });
        return;
      }

      const value = args[0]?.toLowerCase();
      if (value === 'public' || value === 'private') {
        await setState(sessionId, 'mode', value);
        await sock.sendMessage(jid, { text: `✅ Bot mode set to *${value}*.` });
      } else {
        const current = state.mode || 'public';
        await sock.sendMessage(jid, {
          text: `Current mode: *${current}*\nUse ${PREFIX}mode public/private to change.\n\nPublic: anyone can use commands.\nPrivate: only the owner can use commands.`
        });
      }
    }
  },

  setprefix: {
    names: ['setprefix'],
    execute: async (sock, msg, args, commandName, sessionId) => {
      const jid = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;
      const state = getState(sessionId);

      if (!isSessionOwner(sock, sender, msg, state)) {
        await sock.sendMessage(jid, { text: 'Only the bot owner can use this command.' });
        return;
      }

      const newPrefix = args[0];
      if (!newPrefix) {
        const current = state.prefix || PREFIX;
        await sock.sendMessage(jid, {
          text: `Current prefix: *${current}*\nUse ${PREFIX}setprefix <prefix> to change.\n\nExample: ${PREFIX}setprefix !\nExample: ${PREFIX}setprefix ##`
        });
        return;
      }

      await setState(sessionId, 'prefix', newPrefix);
      await sock.sendMessage(jid, { text: `✅ Prefix changed to: *${newPrefix}*` });
    }
  },

  setowner: {
    names: ['setowner'],
    execute: async (sock, msg, args, commandName, sessionId) => {
      const jid = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;
      const state = getState(sessionId);

      // Only the linked account (fromMe) or existing owner can set a new owner
      if (!isSessionOwner(sock, sender, msg, state)) {
        await sock.sendMessage(jid, { text: 'Only the current bot owner can set a new owner.' });
        return;
      }

      const number = args[0]?.replace(/[^0-9]/g, '');
      if (!number) {
        const current = state.ownerNumber || extractNumber(sock.user?.id);
        await sock.sendMessage(jid, {
          text: `Current owner number: *${current}*\nUse ${PREFIX}setowner <number> to change.\n\nExample: ${PREFIX}setowner 254712345678`
        });
        return;
      }

      await setState(sessionId, 'ownerNumber', number);
      await sock.sendMessage(jid, {
        text: `✅ Owner set to: *${number}*\n\nThis number can now control all bot settings from any device.`
      });
    }
  }
};

function extractNumber(jid) {
  if (!jid) return null;
  return jid.split('@')[0].split(':')[0];
}
