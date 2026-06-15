import { getState } from './state.js';

const PREFIX = process.env.PREFIX || '.';
const BOT_START_TIME = Date.now();

function formatUptime(ms) {
  let seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

export const generalCommands = {
  ping: {
    names: ['ping'],
    execute: async (sock, msg) => {
      const start = Date.now();
      const jid = msg.key.remoteJid;
      const sent = await sock.sendMessage(jid, { text: 'Pinging...' });
      const latency = Date.now() - start;
      await sock.sendMessage(jid, { text: `🏓 Pong! ${latency}ms` }, { quoted: sent });
    }
  },

  alive: {
    names: ['alive', 'online'],
    execute: async (sock, msg, args, commandName, sessionId) => {
      const jid = msg.key.remoteJid;
      const uptime = formatUptime(Date.now() - BOT_START_TIME);
      await sock.sendMessage(jid, {
        text: `*SwiftBot is alive!* ✅\n\nUptime: ${uptime}\nSession: ${sessionId}\nPrefix: ${PREFIX}\nType ${PREFIX}menu for commands.`
      });
    }
  },

  uptime: {
    names: ['uptime'],
    execute: async (sock, msg) => {
      const jid = msg.key.remoteJid;
      const uptime = formatUptime(Date.now() - BOT_START_TIME);
      await sock.sendMessage(jid, { text: `⏱️ Uptime: ${uptime}` });
    }
  },

  owner: {
    names: ['owner'],
    execute: async (sock, msg) => {
      const jid = msg.key.remoteJid;
      const ownerNumber = sock.user?.id?.split(':')[0]?.split('@')[0] || 'Unknown';
      await sock.sendMessage(jid, {
        text: `👤 *Bot Owner*\n\nNumber: wa.me/${ownerNumber}\n\nThis is the WhatsApp account this bot session is linked to.`
      });
    }
  }
};
