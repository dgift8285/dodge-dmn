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

// Extract the numeric core of a JID, ignoring device suffix and domain (@s.whatsapp.net / @lid / @g.us)
function extractNumber(jid) {
  if (!jid) return null;
  return jid.split('@')[0].split(':')[0];
}

export function isSenderAdmin(metadata, senderJid) {
  if (!metadata) return false;
  const senderNumber = extractNumber(senderJid);
  const participant = metadata.participants.find((p) => extractNumber(p.id) === senderNumber);
  return participant?.admin === 'admin' || participant?.admin === 'superadmin';
}

export function isBotAdmin(metadata, botJid) {
  if (!metadata) return false;
  const botNumber = extractNumber(botJid);
  const participant = metadata.participants.find((p) => extractNumber(p.id) === botNumber);
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
