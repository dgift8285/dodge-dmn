import {
  isGroup,
  getGroupMetadata,
  isSenderAdmin,
  isBotAdmin,
  getTargetJids,
  getSender
} from '../commandHelpers.js';

const PREFIX = process.env.PREFIX || '.';

// Shared admin-check wrapper for group management commands
function requireGroupAdmin(handler, requireBotAdmin = true) {
  return async (sock, msg, args, commandName, sessionId) => {
    const jid = msg.key.remoteJid;

    if (!isGroup(jid)) {
      await sock.sendMessage(jid, { text: 'This command only works in groups.' });
      return;
    }

    const metadata = await getGroupMetadata(sock, jid);
    if (!metadata) {
      await sock.sendMessage(jid, { text: 'Failed to fetch group info.' });
      return;
    }

    const sender = getSender(msg);

    if (!isSenderAdmin(metadata, sender)) {
      await sock.sendMessage(jid, { text: 'Only group admins can use this command.' });
      return;
    }

    if (requireBotAdmin && !isBotAdmin(metadata, sock.user.id)) {
      await sock.sendMessage(jid, { text: 'I need to be an admin to do that.' });
      return;
    }

    await handler(sock, msg, args, commandName, sessionId, metadata, jid, sender);
  };
}

export const groupCommands = {
  requestlist: {
    names: ['requestlist'],
    execute: requireGroupAdmin(async (sock, msg, args, commandName, sessionId, metadata, jid) => {
      try {
        const requests = await sock.groupRequestParticipantsList(jid);
        if (!requests || requests.length === 0) {
          await sock.sendMessage(jid, { text: 'No pending join requests.' });
          return;
        }
        const list = requests.map((r, i) => `${i + 1}. wa.me/${r.jid.split('@')[0]}`).join('\n');
        await sock.sendMessage(jid, { text: `📋 *Pending Join Requests* (${requests.length})\n\n${list}` });
      } catch (err) {
        await sock.sendMessage(jid, { text: 'Failed to fetch join requests. (Group may not have approval mode enabled.)' });
      }
    })
  },

  acceptall: {
    names: ['acceptall'],
    execute: requireGroupAdmin(async (sock, msg, args, commandName, sessionId, metadata, jid) => {
      try {
        const requests = await sock.groupRequestParticipantsList(jid);
        if (!requests || requests.length === 0) {
          await sock.sendMessage(jid, { text: 'No pending join requests.' });
          return;
        }
        const jids = requests.map((r) => r.jid);
        await sock.groupRequestParticipantsUpdate(jid, jids, 'approve');
        await sock.sendMessage(jid, { text: `✅ Approved ${jids.length} join request(s).` });
      } catch (err) {
        await sock.sendMessage(jid, { text: 'Failed to accept join requests.' });
      }
    })
  },

  rejectall: {
    names: ['rejectall'],
    execute: requireGroupAdmin(async (sock, msg, args, commandName, sessionId, metadata, jid) => {
      try {
        const requests = await sock.groupRequestParticipantsList(jid);
        if (!requests || requests.length === 0) {
          await sock.sendMessage(jid, { text: 'No pending join requests.' });
          return;
        }
        const jids = requests.map((r) => r.jid);
        await sock.groupRequestParticipantsUpdate(jid, jids, 'reject');
        await sock.sendMessage(jid, { text: `❌ Rejected ${jids.length} join request(s).` });
      } catch (err) {
        await sock.sendMessage(jid, { text: 'Failed to reject join requests.' });
      }
    })
  },

  removeadmins: {
    names: ['removeadmins'],
    execute: requireGroupAdmin(async (sock, msg, args, commandName, sessionId, metadata, jid, sender) => {
      const targets = getTargetJids(msg);
      if (targets.length === 0) {
        await sock.sendMessage(jid, { text: 'Mention or reply to the user(s) to demote.' });
        return;
      }
      try {
        await sock.groupParticipantsUpdate(jid, targets, 'demote');
        await sock.sendMessage(jid, { text: `✅ Removed admin from ${targets.length} member(s).` });
      } catch (err) {
        await sock.sendMessage(jid, { text: 'Failed to demote member(s).' });
      }
    })
  },

  promote: {
    names: ['promote'],
    execute: requireGroupAdmin(async (sock, msg, args, commandName, sessionId, metadata, jid) => {
      const targets = getTargetJids(msg);
      if (targets.length === 0) {
        await sock.sendMessage(jid, { text: 'Mention or reply to the user(s) to promote.' });
        return;
      }
      try {
        await sock.groupParticipantsUpdate(jid, targets, 'promote');
        await sock.sendMessage(jid, { text: `✅ Promoted ${targets.length} member(s) to admin.` });
      } catch (err) {
        await sock.sendMessage(jid, { text: 'Failed to promote member(s).' });
      }
    })
  },

  demote: {
    names: ['demote'],
    execute: requireGroupAdmin(async (sock, msg, args, commandName, sessionId, metadata, jid) => {
      const targets = getTargetJids(msg);
      if (targets.length === 0) {
        await sock.sendMessage(jid, { text: 'Mention or reply to the user(s) to demote.' });
        return;
      }
      try {
        await sock.groupParticipantsUpdate(jid, targets, 'demote');
        await sock.sendMessage(jid, { text: `✅ Demoted ${targets.length} member(s).` });
      } catch (err) {
        await sock.sendMessage(jid, { text: 'Failed to demote member(s).' });
      }
    })
  },

  botadmin: {
    names: ['botadmin'],
    execute: async (sock, msg) => {
      const jid = msg.key.remoteJid;

      if (!isGroup(jid)) {
        await sock.sendMessage(jid, { text: 'This command only works in groups.' });
        return;
      }

      const metadata = await getGroupMetadata(sock, jid);
      const botIsAdmin = isBotAdmin(metadata, sock.user.id);

      await sock.sendMessage(jid, {
        text: botIsAdmin
          ? '✅ I am an admin in this group.'
          : '❌ I am not an admin in this group. Make me admin to use management commands.'
      });
    }
  },

  add: {
    names: ['add'],
    execute: requireGroupAdmin(async (sock, msg, args, commandName, sessionId, metadata, jid) => {
      const number = args[0]?.replace(/[^0-9]/g, '');
      if (!number) {
        await sock.sendMessage(jid, { text: `Provide a number to add. Example: ${PREFIX}add 254712345678` });
        return;
      }
      const targetJid = `${number}@s.whatsapp.net`;
      try {
        await sock.groupParticipantsUpdate(jid, [targetJid], 'add');
        await sock.sendMessage(jid, { text: `✅ Added wa.me/${number} to the group.` });
      } catch (err) {
        await sock.sendMessage(jid, { text: 'Failed to add member. They may have privacy settings preventing this, try sending an invite link instead.' });
      }
    })
  },

  addmember: {
    names: ['addmember'],
    execute: requireGroupAdmin(async (sock, msg, args, commandName, sessionId, metadata, jid) => {
      if (args.length === 0) {
        await sock.sendMessage(jid, { text: `Provide one or more numbers separated by spaces. Example: ${PREFIX}addmember 254712345678 254798765432` });
        return;
      }
      let added = 0;
      let failed = 0;
      for (const raw of args) {
        const number = raw.replace(/[^0-9]/g, '');
        if (!number) continue;
        const targetJid = `${number}@s.whatsapp.net`;
        try {
          await sock.groupParticipantsUpdate(jid, [targetJid], 'add');
          added++;
        } catch {
          failed++;
        }
      }
      await sock.sendMessage(jid, { text: `✅ Added: ${added}\n❌ Failed: ${failed}` });
    })
  },

  tagall: {
    names: ['tagall'],
    execute: requireGroupAdmin(async (sock, msg, args, commandName, sessionId, metadata, jid) => {
      const customMessage = args.join(' ');
      const mentions = metadata.participants.map((p) => p.id);
      const text =
        (customMessage ? `${customMessage}\n\n` : '') +
        mentions.map((m) => `@${m.split('@')[0]}`).join(' ');

      await sock.sendMessage(jid, { text, mentions });
    }, false)
  },

  hidetag: {
    names: ['hidetag'],
    execute: requireGroupAdmin(async (sock, msg, args, commandName, sessionId, metadata, jid) => {
      const customMessage = args.join(' ') || '\u200B';
      const mentions = metadata.participants.map((p) => p.id);

      await sock.sendMessage(jid, { text: customMessage, mentions });
    }, false)
  },

  admincheck: {
    names: ['admincheck'],
    execute: async (sock, msg) => {
      const jid = msg.key.remoteJid;

      if (!isGroup(jid)) {
        await sock.sendMessage(jid, { text: 'This command only works in groups.' });
        return;
      }

      const metadata = await getGroupMetadata(sock, jid);
      const admins = metadata.participants.filter((p) => p.admin === 'admin' || p.admin === 'superadmin');

      if (admins.length === 0) {
        await sock.sendMessage(jid, { text: 'No admins found.' });
        return;
      }

      const list = admins.map((a, i) => `${i + 1}. @${a.id.split('@')[0]}`).join('\n');
      await sock.sendMessage(jid, {
        text: `👑 *Group Admins* (${admins.length})\n\n${list}`,
        mentions: admins.map((a) => a.id)
      });
    }
  },

  groupstatus: {
    names: ['groupstatus'],
    execute: async (sock, msg) => {
      const jid = msg.key.remoteJid;

      if (!isGroup(jid)) {
        await sock.sendMessage(jid, { text: 'This command only works in groups.' });
        return;
      }

      const metadata = await getGroupMetadata(sock, jid);
      const admins = metadata.participants.filter((p) => p.admin === 'admin' || p.admin === 'superadmin').length;
      const total = metadata.participants.length;
      const botIsAdmin = isBotAdmin(metadata, sock.user.id);

      const text = `
📊 *Group Status*

Name: ${metadata.subject}
Members: ${total}
Admins: ${admins}
Bot is admin: ${botIsAdmin ? 'Yes ✅' : 'No ❌'}
Group locked (announce-only): ${metadata.announce ? 'Yes 🔒' : 'No 🔓'}
      `.trim();

      await sock.sendMessage(jid, { text });
    }
  }
};
