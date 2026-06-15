import { generalCommands } from './commands/general.js';
import { settingsCommands } from './commands/settings.js';
import { adminCommands } from './commands/admin.js';
import { groupCommands } from './commands/group.js';

const PREFIX = process.env.PREFIX || '.';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb86btmI1rci3S1NUA0G';

// Merge all categories into one lookup map
export const commands = {
  ...generalCommands,
  ...settingsCommands,
  ...adminCommands,
  ...groupCommands,

  menu: {
    names: ['menu', 'help'],
    execute: async (sock, msg) => {
      const jid = msg.key.remoteJid;
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      const totalCommands = Object.keys(commands).length;

      const menuText = `
╭━━━《 *SWIFTBOT* 》━━━┈⊷
┃ ✦╭─────────────┈⊷
┃ ✦│▸ Total Commands : *${totalCommands}*
┃ ✦│▸ Time           : ${timeStr}
┃ ✦│▸ Date           : ${dateStr}
┃ ✦│▸ Platform       : Render
┃ ✦╰─────────────┈⊷
╰━━━━━━━━━━━━┈⊷

🧚‍♀️ *GENERAL*
💫 ping
💫 alive / online
💫 uptime
💫 owner

🧚‍♀️ *SETTINGS* (owner only)
💫 togglestatus on/off
💫 mode public/private
💫 setprefix <char>
💫 autorecording on/off
💫 autotyping on/off
💫 anticall on/off
💫 welcome on/off
💫 goodbye on/off
💫 autoread on/off
💫 autoviewstatus on/off
💫 autolikestatus on/off
💫 antidelete on/off
💫 autobio on/off

🧚‍♀️ *GROUP*
💫 requestlist
💫 acceptall
💫 rejectall
💫 promote
💫 demote
💫 removeadmins
💫 botadmin
💫 add <number>
💫 addmember <numbers...>
💫 tagall
💫 hidetag
💫 admincheck
💫 groupstatus

🧚‍♀️ *ADMIN*
💫 kick
💫 kickall confirm
💫 end

🧚‍♀️ *SYSTEM*
💫 menu / help

📢 *Channel*: ${CHANNEL_LINK}
      `.trim();

      await sock.sendMessage(jid, { text: menuText });
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
