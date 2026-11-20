// ================================================================
//  lib/commands/downloader.js — SwiftBot (dodge-dmn) FIXED
//  Powered by gifted-dls (NPM Package)
// ================================================================

import gifted from 'gifted-dls';

const PREFIX = process.env.PREFIX || '.';

// ── send helpers ─────────────────────────────────────────────────
async function sendAudio(sock, jid, url, msg) {
  try {
    await sock.sendMessage(jid, {
      audio: { url },
      mimetype: 'audio/mpeg',
      ptt: false,
    }, { quoted: msg });
  } catch {
    await sock.sendMessage(jid, {
      text: `❌ File too large. Direct link:\n${url}`,
    }, { quoted: msg });
  }
}

async function sendVideo(sock, jid, url, caption, msg) {
  try {
    await sock.sendMessage(jid, {
      video: { url },
      mimetype: 'video/mp4',
      caption: caption || '📥 Downloaded by SwiftBot',
    }, { quoted: msg });
  } catch {
    await sock.sendMessage(jid, {
      text: `❌ File too large. Direct link:\n${url}`,
    }, { quoted: msg });
  }
}

// ================================================================
//  COMMANDS
// ================================================================

export const downloaderCommands = {

  yt: {
    names: ['yt', 'youtube', 'video'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || !url.includes('youtu')) {
        return sock.sendMessage(jid, { text: `Usage: ${PREFIX}yt <youtube url>` });
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading YouTube video...' });
      try {
        const data = await gifted.giftedytmp4(url);
        if (!data || !data.dlUrl) throw new Error('No video URL found.');
        await sendVideo(sock, jid, data.dlUrl, '🎬 Downloaded by SwiftBot', msg);
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

  song: {
    names: ['song', 'play', 'music'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const query = args.join(' ');
      if (!query) {
        return sock.sendMessage(jid, { text: `Usage: ${PREFIX}song <song name>` });
      }
      await sock.sendMessage(jid, { text: `🎵 Searching for *${query}*...` });
      try {
        const data = await gifted.giftedytmp3(query);
        if (!data || !data.dlUrl) throw new Error('No audio URL found.');
        await sendAudio(sock, jid, data.dlUrl, msg);
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

  tiktok: {
    names: ['tiktok', 'tt'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || !url.includes('tiktok')) {
        return sock.sendMessage(jid, { text: `Usage: ${PREFIX}tiktok <url>` });
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading TikTok...' });
      try {
        const data = await gifted.giftedtiktok(url);
        if (!data || !data.video) throw new Error('No video URL found.');
        await sendVideo(sock, jid, data.video, '🎵 TikTok | SwiftBot', msg);
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

  ig: {
    names: ['ig', 'instagram', 'igdl'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || !url.includes('instagram')) {
        return sock.sendMessage(jid, { text: `Usage: ${PREFIX}ig <url>` });
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading Instagram...' });
      try {
        const data = await gifted.giftedig(url);
        const link = data?.video || data?.image;
        if (!link) throw new Error('No media URL found.');
        if (data.video) {
          await sendVideo(sock, jid, link, '📸 Instagram | SwiftBot', msg);
        } else {
          await sock.sendMessage(jid, { image: { url: link }, caption: '📸 Instagram | SwiftBot' }, { quoted: msg });
        }
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

  fb: {
    names: ['fb', 'facebook'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || !url.includes('facebook')) {
        return sock.sendMessage(jid, { text: `Usage: ${PREFIX}fb <url>` });
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading Facebook...' });
      try {
        const data = await gifted.giftedfb(url);
        if (!data || !data.url) throw new Error('No video URL found.');
        await sendVideo(sock, jid, data.url, '📘 Facebook | SwiftBot', msg);
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

  twitter: {
    names: ['twitter', 'tw', 'x'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || (!url.includes('twitter') && !url.includes('x.com'))) {
        return sock.sendMessage(jid, { text: `Usage: ${PREFIX}twitter <url>` });
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading Twitter...' });
      try {
        const data = await gifted.giftedtwitter(url);
        if (!data || !data.url) throw new Error('No video URL found.');
        await sendVideo(sock, jid, data.url, '🐦 Twitter/X | SwiftBot', msg);
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

};