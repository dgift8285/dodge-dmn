// Shared helpers for group and admin commands

export function isGroup(jid) {
  return jid.endsWith('@g.us');
}

export async function getGroupMetadata(sock, jid) {
  try {
    return await sock.groupMetadata(jid);
  } catch (err) {
    return null;
  }
}

export function isSenderAdmin(metadata, senderJid) {
  if (!metadata) return false;
  const participant = metadata.participants.find((p) => p.id === senderJid);
  return participant?.admin === 'admin' || participant?.admin === 'superadmin';
}

export function isBotAdmin(metadata, botJid) {
  if (!metadata) return false;
  // botJid may include device suffix; match by number portion
  const botNumber = botJid.split(':')[0];
  const participant = metadata.participants.find((p) => p.id.split(':')[0] === botNumber || p.id === botJid);
  return participant?.admin === 'admin' || participant?.admin === 'superadmin';
}

export function isSessionOwner(sock, senderJid) {
  const ownerJid = sock.user?.id?.split(':')[0];
  return senderJid.includes(ownerJid);
}

// Extract target JIDs from a message: mentioned users or a quoted message's author
export function getTargetJids(msg) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
  const targets = new Set(mentioned);
  if (quotedParticipant) targets.add(quotedParticipant);
  return Array.from(targets);
}

export function getSender(msg) {
  return msg.key.participant || msg.key.remoteJid;
}
