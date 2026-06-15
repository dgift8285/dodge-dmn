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

      if (requireOwner && !isSessionOwner(sock, sender, msg)) {
        await sock.sendMessage(jid, { text: 'Only the bot owner can use this command.' });
        return;
      }

      const value = args[0]?.toLowerCase();
      if (value === 'on' || value === 'off') {
        setState(sessionId, stateKey, value === 'on');
        await sock.sendMessage(jid, { text: `✅ ${label} turned ${value}.` });
      } else {
        const current = getState(sessionId)[stateKey] ? 'on' : 'off';
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

      if (!isSessionOwner(sock, sender, msg)) {
        await sock.sendMessage(jid, { text: 'Only the bot owner can use this command.' });
        return;
      }

      const value = args[0]?.toLowerCase();
      if (value === 'public' || value === 'private') {
        setState(sessionId, 'mode', value);
        await sock.sendMessage(jid, { text: `✅ Bot mode set to *${value}*.` });
      } else {
        const current = getState(sessionId).mode || 'public';
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

      if (!isSessionOwner(sock, sender, msg)) {
        await sock.sendMessage(jid, { text: 'Only the bot owner can use this command.' });
        return;
      }

      const newPrefix = args[0];
      if (!newPrefix) {
        const current = getState(sessionId).prefix || PREFIX;
        await sock.sendMessage(jid, {
          text: `Current prefix: *${current}*\nUse ${PREFIX}setprefix <prefix> to change.\n\nExample: ${PREFIX}setprefix !\nExample: ${PREFIX}setprefix ##`
        });
        return;
      }

      setState(sessionId, 'prefix', newPrefix);
      await sock.sendMessage(jid, { text: `✅ Prefix changed to: *${newPrefix}*` });
    }
  }
};
