import { getState, setState } from './state.js';

const PREFIX = process.env.PREFIX || '.';

export const commands = {
  ping: {
    names: ['ping'],
    execute: async (sock, msg, args, commandName, sessionId) => {
      const start = Date.now();
      const jid = msg.key.remoteJid;
      const sent = await sock.sendMessage(jid, { text: 'Pinging...' });
      const latency = Date.now() - start;
      await sock.sendMessage(jid, { text: `Pong! ${latency}ms` }, { quoted: sent });
    }
  },

  alive: {
    names: ['alive', 'status'],
    execute: async (sock, msg, args, commandName, sessionId) => {
      const jid = msg.key.remoteJid;
      await sock.sendMessage(jid, {
        text: `*SwiftBot is alive!*\n\nSession: ${sessionId}\nPrefix: ${PREFIX}\nType ${PREFIX}menu for commands.`
      });
    }
  },

  menu: {
    names: ['menu', 'help'],
    execute: async (sock, msg) => {
      const jid = msg.key.remoteJid;
      const menuText = `
*SWIFTBOT MENU*

*General*
${PREFIX}ping - Check bot latency
${PREFIX}alive - Check bot status
${PREFIX}menu - Show this menu

*Settings* (owner only)
${PREFIX}togglestatus on/off - Toggle bot online status
      `.trim();
      await sock.sendMessage(jid, { text: menuText });
    }
  },

  togglestatus: {
    names: ['togglestatus'],
    execute: async (sock, msg, args, commandName, sessionId) => {
      const jid = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;
      const ownerJid = sock.user?.id?.split(':')[0];

      if (!sender.includes(ownerJid)) {
        await sock.sendMessage(jid, { text: 'Only the bot owner can use this command.' });
        return;
      }

      const value = args[0]?.toLowerCase();
      if (value === 'on' || value === 'off') {
        setState(sessionId, 'status', value === 'on');
        await sock.sendMessage(jid, { text: `Status set to: ${value}` });
      } else {
        const current = getState(sessionId).status ? 'on' : 'off';
        await sock.sendMessage(jid, { text: `Current status: ${current}\nUse ${PREFIX}togglestatus on/off to change.` });
      }
    }
  }
};

export function findCommand(commandName) {
  for (const key of Object.keys(commands)) {
    if (commands[key].names.includes(commandName)) {
      return commands[key];
    }
  }
  return null;
}
