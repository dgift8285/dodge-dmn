import {
  isGroup,
  getGroupMetadata,
  isSenderAdmin,
  isBotAdmin,
  getTargetJids,
  getSender
} from '../commandHelpers.js';

export const adminCommands = {
  kick: {
    names: ['kick'],
    execute: async (sock, msg) => {
      const jid = msg.key.remoteJid;

      if (!isGroup(jid)) {
        await sock.sendMessage(jid, { text: 'This command only works in groups.' });
        return;
      }

      const metadata = await getGroupMetadata(sock, jid);
      const sender = getSender(msg);

      if (!isSenderAdmin(metadata, sender)) {
        await sock.sendMessage(jid, { text: 'Only group admins can use this command.' });
        return;
      }

      if (!isBotAdmin(metadata, sock.user.id)) {
        await sock.sendMessage(jid, { text: 'I need to be an admin to remove members.' });
        return;
      }

      const targets = getTargetJids(msg);
      if (targets.length === 0) {
        await sock.sendMessage(jid, { text: 'Mention or reply to the user you want to kick.' });
        return;
      }

      try {
        await sock.groupParticipantsUpdate(jid, targets, 'remove');
        await sock.sendMessage(jid, { text: `✅ Removed ${targets.length} member(s).` });
      } catch (err) {
        await sock.sendMessage(jid, { text: 'Failed to remove member(s). Make sure I have admin permissions.' });
      }
    }
  },

  kickall: {
    names: ['kickall'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;

      if (!isGroup(jid)) {
        await sock.sendMessage(jid, { text: 'This command only works in groups.' });
        return;
      }

      const metadata = await getGroupMetadata(sock, jid);
      const sender = getSender(msg);

      if (!isSenderAdmin(metadata, sender)) {
        await sock.sendMessage(jid, { text: 'Only group admins can use this command.' });
        return;
      }

      if (!isBotAdmin(metadata, sock.user.id)) {
        await sock.sendMessage(jid, { text: 'I need to be an admin to remove members.' });
        return;
      }

      // Safety: requires explicit "confirm" argument to avoid accidental mass-removal
      if (args[0]?.toLowerCase() !== 'confirm') {
        await sock.sendMessage(jid, {
          text: '⚠️ This will remove *all non-admin members* from the group.\n\nThis cannot be undone.\nIf you are sure, type:\n.kickall confirm'
        });
        return;
      }

      const botNumber = sock.user.id.split(':')[0];
      const targets = metadata.participants
        .filter((p) => {
          const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
          const isBot = p.id.split(':')[0] === botNumber;
          return !isAdmin && !isBot;
        })
        .map((p) => p.id);

      if (targets.length === 0) {
        await sock.sendMessage(jid, { text: 'No non-admin members to remove.' });
        return;
      }

      let removed = 0;
      for (const target of targets) {
        try {
          await sock.groupParticipantsUpdate(jid, [target], 'remove');
          removed++;
        } catch {
          // continue with next
        }
      }

      await sock.sendMessage(jid, { text: `✅ Removed ${removed} of ${targets.length} member(s).` });
    }
  },

  end: {
    names: ['end'],
    execute: async (sock, msg) => {
      const jid = msg.key.remoteJid;

      if (!isGroup(jid)) {
        await sock.sendMessage(jid, { text: 'This command only works in groups.' });
        return;
      }

      const metadata = await getGroupMetadata(sock, jid);
      const sender = getSender(msg);

      if (!isSenderAdmin(metadata, sender)) {
        await sock.sendMessage(jid, { text: 'Only group admins can use this command.' });
        return;
      }

      if (!isBotAdmin(metadata, sock.user.id)) {
        await sock.sendMessage(jid, { text: 'I need to be an admin to close the group.' });
        return;
      }

      try {
        await sock.groupSettingUpdate(jid, 'announcement');
        await sock.sendMessage(jid, { text: '🔒 Group closed. Only admins can send messages now.' });
      } catch (err) {
        await sock.sendMessage(jid, { text: 'Failed to close the group.' });
      }
    }
  }
};
