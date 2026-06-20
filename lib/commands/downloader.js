// ================================================================
//  lib/commands/downloader.js  —  SwiftBot (dodge-dmn)
//  Powered by Gifted API (api.gifted.co.ke)
//  Endpoint names verified from official docs — June 2026
// ================================================================

import axios from 'axios';

const PREFIX     = process.env.PREFIX         || '.';
const GIFTED_KEY = process.env.GIFTED_API_KEY || 'gifted';
const BASE       = 'https://api.gifted.co.ke';
const TIMEOUT    = 40_000;

// ── GET helper ───────────────────────────────────────────────────
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
  for (const key of ['url', 'download', 'link', 'audio', 'video', 'mp3', 'mp4', 'hd', 'sd', 'media', 'dlUrl', 'downloadUrl']) {
    if (result[key] && typeof result[key] === 'string' && result[key].startsWith('http')) {
      return result[key];
    }
  }
  if (Array.isArray(result) && result.length) return pickUrl(result[0]);
  return null;
}

// ── try a list of endpoints, return first working URL ────────────
async function tryEndpoints(endpoints) {
  for (const [ep, params] of endpoints) {
    try {
      console.log(`[Gifted] Trying ${ep}...`);
      const res = await gget(ep, params);
      const link = pickUrl(res?.result ?? res);
      if (link) {
        console.log(`[Gifted] Success: ${ep}`);
        return link;
      }
    } catch (err) {
      console.log(`[Gifted] Failed ${ep}: ${err.message}`);
    }
  }
  return null;
}

// ── YouTube Audio (7 endpoints in order of speed) ────────────────
async function ytAudio(url) {
  return tryEndpoints([
    ['/api/download/ytmp3',    { url, quality: '128' }],
    ['/api/download/ytmp3v2',  { url, quality: '128' }],
    ['/api/download/savetube', { url }],          // SaveTube MP3
    ['/api/download/ytaudio',  { url }],          // y2mate.nu
    ['/api/download/dlmp3',    { url }],           // auto server
    ['/api/download/yta',      { url }],
    ['/api/download/ytav2',    { url }],           // flvto
    ['/api/download/savemp3',  { url }],
    ['/api/download/ytdl',     { url }],
    ['/api/download/ytdown',   { url }],
  ]);
}

// ── YouTube Video (7 endpoints in order) ─────────────────────────
async function ytVideo(url) {
  return tryEndpoints([
    ['/api/download/ytmp4',    { url, quality: '720' }],
    ['/api/download/ytmp4v2',  { url, quality: '720' }],
    ['/api/download/savetubemp4', { url, quality: '720' }],
    ['/api/download/ytvideo',  { url }],          // y2mate.nu
    ['/api/download/dlmp4',    { url }],           // auto server
    ['/api/download/ytv',      { url }],
    ['/api/download/ytvv2',    { url }],           // flvto
    ['/api/download/savemp4',  { url }],
    ['/api/download/ytdl',     { url }],
    ['/api/download/ytdown',   { url }],
  ]);
}

// ── YouTube Search ───────────────────────────────────────────────
async function ytSearch(query) {
  try {
    const res = await gget('/api/search/ytsearch', { q: query });
    const r = res?.result;
    if (Array.isArray(r) && r[0]?.url) return r[0].url;
    if (r?.url) return r.url;
  } catch {}
  // fallback: scrape YouTube
  try {
    const { data: html } = await axios.get(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' audio')}`,
      { timeout: 15_000 }
    );
    const match = html.match(/"videoId":"([^"]+)"/);
    return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
  } catch {
    return null;
  }
}

// ── TikTok (5 endpoints) ─────────────────────────────────────────
async function tiktokVideo(url) {
  // TikTok endpoints return different shapes — handle each
  const endpoints = [
    '/api/download/tiktok',
    '/api/download/tiktokdlv2',
    '/api/download/tiktokdlv3',
    '/api/download/tiktokdlv4',
    '/api/download/tiktokdlv5',
    '/api/download/aiodl',
  ];
  for (const ep of endpoints) {
    try {
      console.log(`[Gifted] Trying ${ep}...`);
      const res = await gget(ep, { url });
      const r = res?.result ?? res;
      // TikTok usually returns nowatermark / video field
      const link = r?.nowatermark || r?.video || r?.play || r?.hdplay || pickUrl(r);
      if (link && typeof link === 'string' && link.startsWith('http')) {
        console.log(`[Gifted] TikTok success: ${ep}`);
        return link;
      }
    } catch (err) {
      console.log(`[Gifted] Failed ${ep}: ${err.message}`);
    }
  }
  return null;
}

// ── Instagram (2 endpoints) ──────────────────────────────────────
async function igMedia(url) {
  const endpoints = ['/api/download/instadl', '/api/download/instadlv2'];
  for (const ep of endpoints) {
    try {
      console.log(`[Gifted] Trying ${ep}...`);
      const res = await gget(ep, { url });
      const r = res?.result ?? res;
      const link = r?.video || r?.image || r?.url || pickUrl(r);
      if (link && typeof link === 'string' && link.startsWith('http')) {
        const isVideo = link.includes('.mp4') || !!r?.video;
        return { url: link, isVideo };
      }
    } catch (err) {
      console.log(`[Gifted] Failed ${ep}: ${err.message}`);
    }
  }
  return null;
}

// ── Facebook (3 endpoints) ───────────────────────────────────────
async function fbVideo(url) {
  return tryEndpoints([
    ['/api/download/facebook',   { url }],
    ['/api/download/facebookv2', { url }],
    ['/api/download/facebookv3', { url }],
    ['/api/download/aiodl',      { url }],
  ]);
}

// ── Twitter/X (2 endpoints + aiodl) ─────────────────────────────
async function twitterVideo(url) {
  return tryEndpoints([
    ['/api/download/twitterdl',   { url }],
    ['/api/download/twitterdlv2', { url }],
    ['/api/download/aiodl',       { url }],
  ]);
}

// ── SoundCloud ───────────────────────────────────────────────────
async function scAudio(url) {
  return tryEndpoints([
    ['/api/download/soundclouddl', { url }],
  ]);
}

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
      text: `❌ File too large for WhatsApp (max 64MB).\n\n🔗 Direct link:\n${url}`,
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
      text: `❌ File too large for WhatsApp (max 64MB).\n\n🔗 Direct link:\n${url}`,
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
//  COMMANDS  — same export shape as original downloader.js
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
        if (!link) return sock.sendMessage(jid, { text: '❌ Could not download. Make sure the video is public and not age-restricted.' });
        await sendVideo(sock, jid, link, '🎬 Downloaded by SwiftBot', msg);
      } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
      }
    },
  },

  // ── Song / Music (audio) ───────────────────────────────────────
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
