// ================================================================
//  lib/commands/downloader.js  —  SwiftBot (dodge-dmn)
//  All downloaders powered by Gifted API (api.gifted.co.ke)
//  Drop-in replacement: same export shape, same command names.
// ================================================================

import axios from 'axios';

const PREFIX       = process.env.PREFIX        || '.';
const GIFTED_KEY   = process.env.GIFTED_API_KEY || 'gifted';
const BASE         = 'https://api.gifted.co.ke';
const TIMEOUT      = 40_000;

// ── low-level GET helper ─────────────────────────────────────────
async function gget(endpoint, params = {}) {
  const { data } = await axios.get(`${BASE}${endpoint}`, {
    params: { apikey: GIFTED_KEY, ...params },
    timeout: TIMEOUT,
  });
  return data;
}

// ── extract a usable URL from any Gifted result shape ────────────
function pickUrl(result) {
  if (!result) return null;
  if (typeof result === 'string' && result.startsWith('http')) return result;
  // common key names Gifted uses across endpoints
  for (const key of ['url', 'download', 'link', 'audio', 'video', 'mp3', 'mp4', 'hd', 'sd', 'media']) {
    if (result[key] && typeof result[key] === 'string' && result[key].startsWith('http')) {
      return result[key];
    }
  }
  // array of items — grab first
  if (Array.isArray(result) && result.length) return pickUrl(result[0]);
  return null;
}

// ── YouTube audio: try 4 Gifted endpoints in order ───────────────
async function ytAudio(url) {
  const endpoints = [
    ['/api/download/ytmp3',   { url }],
    ['/api/download/ytaudio', { url }],
    ['/api/download/dlmp3v2', { url, quality: '128' }],
    ['/api/download/yta',     { url }],
  ];
  for (const [ep, params] of endpoints) {
    try {
      const res = await gget(ep, params);
      const link = pickUrl(res.result);
      if (link) return link;
    } catch { /* try next */ }
  }
  return null;
}

// ── YouTube video: try 4 Gifted endpoints in order ───────────────
async function ytVideo(url) {
  const endpoints = [
    ['/api/download/ytmp4',   { url }],
    ['/api/download/ytvideo', { url }],
    ['/api/download/dlmp4v2', { url, quality: '720' }],
    ['/api/download/ytv',     { url }],
  ];
  for (const [ep, params] of endpoints) {
    try {
      const res = await gget(ep, params);
      const link = pickUrl(res.result);
      if (link) return link;
    } catch { /* try next */ }
  }
  return null;
}

// ── YouTube search (for .song <name>) ────────────────────────────
async function ytSearch(query) {
  try {
    const res = await gget('/api/search/ytsearch', { q: query });
    const r = res.result;
    if (Array.isArray(r) && r[0]?.url) return r[0].url;
    if (r?.url) return r.url;
    // fallback: scrape YouTube directly (no key needed)
    const html = await axios.get(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' audio')}`,
      { timeout: 15_000 }
    ).then(r => r.data);
    const match = html.match(/"videoId":"([^"]+)"/);
    return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
  } catch {
    return null;
  }
}

// ── TikTok: try 3 endpoints ──────────────────────────────────────
async function tiktokVideo(url) {
  const endpoints = [
    ['/api/download/tiktok',   { url }],
    ['/api/download/tiktokv2', { url }],
    ['/api/download/ttdl',     { url }],
  ];
  for (const [ep, params] of endpoints) {
    try {
      const res = await gget(ep, params);
      const r = res.result;
      // Gifted TikTok may return { video, audio, nowatermark }
      const link = r?.nowatermark || r?.video || pickUrl(r);
      if (link) return link;
    } catch { /* try next */ }
  }
  return null;
}

// ── Instagram: try 2 endpoints ───────────────────────────────────
async function igMedia(url) {
  const endpoints = [
    ['/api/download/instagram',   { url }],
    ['/api/download/instagramv2', { url }],
  ];
  for (const [ep, params] of endpoints) {
    try {
      const res = await gget(ep, params);
      const r = res.result;
      const link = r?.video || r?.image || r?.url || pickUrl(r);
      if (link) return { url: link, isVideo: !!(r?.video || (typeof link === 'string' && link.includes('.mp4'))) };
    } catch { /* try next */ }
  }
  return null;
}

// ── Facebook: try 2 endpoints ────────────────────────────────────
async function fbVideo(url) {
  const endpoints = [
    ['/api/download/facebook',   { url }],
    ['/api/download/facebookv2', { url }],
  ];
  for (const [ep, params] of endpoints) {
    try {
      const res = await gget(ep, params);
      const r = res.result;
      const link = r?.hd || r?.sd || r?.url || pickUrl(r);
      if (link) return link;
    } catch { /* try next */ }
  }
  return null;
}

// ── Twitter/X: try 2 endpoints ───────────────────────────────────
async function twitterVideo(url) {
  const endpoints = [
    ['/api/download/twitter',   { url }],
    ['/api/download/twitterv2', { url }],
  ];
  for (const [ep, params] of endpoints) {
    try {
      const res = await gget(ep, params);
      const r = res.result;
      const link = r?.hd || r?.url || pickUrl(r);
      if (link) return link;
    } catch { /* try next */ }
  }
  return null;
}

// ── SoundCloud: try 2 endpoints ──────────────────────────────────
async function scAudio(url) {
  const endpoints = [
    ['/api/download/soundcloud',   { url }],
    ['/api/download/soundcloudv2', { url }],
  ];
  for (const [ep, params] of endpoints) {
    try {
      const res = await gget(ep, params);
      const link = pickUrl(res.result);
      if (link) return link;
    } catch { /* try next */ }
  }
  return null;
}

// ── send helpers ─────────────────────────────────────────────────
async function sendAudio(sock, jid, url, msg) {
  try {
    await sock.sendMessage(jid, {
      audio: { url },
      mimetype: 'audio/mpeg',
      ptt: false,
    }, { quoted: msg });
  } catch (err) {
    await sock.sendMessage(jid, {
      text: `❌ File too large for WhatsApp.\n\n🔗 Direct link:\n${url}`,
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
  } catch (err) {
    await sock.sendMessage(jid, {
      text: `❌ File too large for WhatsApp.\n\n🔗 Direct link:\n${url}`,
    }, { quoted: msg });
  }
}

async function sendImage(sock, jid, url, caption, msg) {
  await sock.sendMessage(jid, {
    image: { url },
    caption: caption || '📥 Downloaded by SwiftBot',
  }, { quoted: msg });
}

// ================================================================
//  COMMANDS  (exact same export shape as original)
// ================================================================

export const downloaderCommands = {

  // ── YouTube Video ──────────────────────────────────────────────
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
        const link = await ytVideo(url);
        if (!link) return sock.sendMessage(jid, { text: '❌ Could not download. Make sure the video is public.' });
        await sendVideo(sock, jid, link, '🎬 Downloaded by SwiftBot', msg);
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

  // ── Music / Song (audio) ───────────────────────────────────────
  song: {
    names: ['song', 'play', 'music'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const query = args.join(' ');
      if (!query) {
        return sock.sendMessage(jid, {
          text: `Usage: ${PREFIX}song <song name or youtube url>\nExample: ${PREFIX}song shape of you ed sheeran`,
        });
      }
      await sock.sendMessage(jid, { text: `🎵 Searching for *${query}*...` });
      try {
        let ytUrl = query;
        if (!query.startsWith('http')) {
          ytUrl = await ytSearch(query);
          if (!ytUrl) return sock.sendMessage(jid, { text: '❌ Could not find that song on YouTube.' });
        }
        const link = await ytAudio(ytUrl);
        if (!link) return sock.sendMessage(jid, { text: '❌ Download failed. Try a direct YouTube URL.' });
        await sendAudio(sock, jid, link, msg);
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

  // ── TikTok ─────────────────────────────────────────────────────
  tiktok: {
    names: ['tiktok', 'tt'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || !url.includes('tiktok')) {
        return sock.sendMessage(jid, { text: `Usage: ${PREFIX}tiktok <tiktok url>` });
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading TikTok video...' });
      try {
        const link = await tiktokVideo(url);
        if (!link) return sock.sendMessage(jid, { text: '❌ Could not download. Make sure the video is public.' });
        await sendVideo(sock, jid, link, '🎵 TikTok | SwiftBot', msg);
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

  // ── Instagram ──────────────────────────────────────────────────
  ig: {
    names: ['ig', 'instagram', 'igdl'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || !url.includes('instagram')) {
        return sock.sendMessage(jid, { text: `Usage: ${PREFIX}ig <instagram post/reel url>` });
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading Instagram media...' });
      try {
        const result = await igMedia(url);
        if (!result) return sock.sendMessage(jid, { text: '❌ Could not download. Make sure the post is public.' });
        if (result.isVideo) {
          await sendVideo(sock, jid, result.url, '📸 Instagram | SwiftBot', msg);
        } else {
          await sendImage(sock, jid, result.url, '📸 Instagram | SwiftBot', msg);
        }
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

  // ── Facebook ───────────────────────────────────────────────────
  fb: {
    names: ['fb', 'facebook'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || (!url.includes('facebook') && !url.includes('fb.watch'))) {
        return sock.sendMessage(jid, { text: `Usage: ${PREFIX}fb <facebook video url>` });
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading Facebook video...' });
      try {
        const link = await fbVideo(url);
        if (!link) return sock.sendMessage(jid, { text: '❌ Could not download. Make sure the video is public.' });
        await sendVideo(sock, jid, link, '📘 Facebook | SwiftBot', msg);
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

  // ── Twitter / X ────────────────────────────────────────────────
  twitter: {
    names: ['twitter', 'tw', 'x'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || (!url.includes('twitter') && !url.includes('x.com'))) {
        return sock.sendMessage(jid, { text: `Usage: ${PREFIX}twitter <tweet url>` });
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading Twitter/X video...' });
      try {
        const link = await twitterVideo(url);
        if (!link) return sock.sendMessage(jid, { text: '❌ Could not download this tweet.' });
        await sendVideo(sock, jid, link, '🐦 Twitter/X | SwiftBot', msg);
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

  // ── SoundCloud ─────────────────────────────────────────────────
  sc: {
    names: ['sc', 'soundcloud'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || !url.includes('soundcloud')) {
        return sock.sendMessage(jid, { text: `Usage: ${PREFIX}sc <soundcloud url>` });
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading SoundCloud track...' });
      try {
        const link = await scAudio(url);
        if (!link) return sock.sendMessage(jid, { text: '❌ Could not download this track.' });
        await sendAudio(sock, jid, link, msg);
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

};
