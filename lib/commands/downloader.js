const PREFIX = process.env.PREFIX || '.';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const COBALT_API = 'https://api.cobalt.tools';

// ─── COBALT (primary) ────────────────────────────────────────────
async function cobaltDownload(url, isAudio = false) {
  try {
    const res = await fetch(`${COBALT_API}/`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        downloadMode: isAudio ? 'audio' : 'auto',
        audioFormat: isAudio ? 'mp3' : 'best',
        videoQuality: '720'
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    console.log('Cobalt response:', JSON.stringify(data));

    if (data.status === 'stream' || data.status === 'redirect' || data.status === 'tunnel') {
      return { url: data.url, filename: data.filename || 'media' };
    }
    if (data.status === 'picker' && data.picker?.length > 0) {
      return { url: data.picker[0].url, filename: 'media' };
    }
    return null;
  } catch (err) {
    console.error('Cobalt error:', err.message);
    return null;
  }
}

// ─── RAPIDAPI (fallback) ─────────────────────────────────────────
async function rapidDownload(url) {
  if (!RAPIDAPI_KEY) return null;
  try {
    const res = await fetch(
      'https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'social-download-all-in-one.p.rapidapi.com'
        },
        body: JSON.stringify({ url })
      }
    );
    if (!res.ok) {
      console.error('RapidAPI error status:', res.status);
      return null;
    }
    const data = await res.json();
    console.log('RapidAPI response:', JSON.stringify(data).slice(0, 300));

    // Find best quality video or audio link
    const medias = data.medias || [];
    const video = medias.find(m => m.type === 'video' && m.quality === 'hd')
      || medias.find(m => m.type === 'video')
      || medias.find(m => m.type === 'audio')
      || medias[0];

    return video ? { url: video.url, filename: 'media' } : null;
  } catch {
    return null;
  }
}

// ─── YOUTUBE SEARCH (for .song command) ──────────────────────────
async function searchYouTube(query) {
  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' audio')}`,
    );
    const html = await res.text();
    const match = html.match(/"videoId":"([^"]+)"/);
    return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
  } catch {
    return null;
  }
}

// ─── SEND HELPER ─────────────────────────────────────────────────
async function tryDownloadAndSend(sock, jid, url, isAudio, mediaType, msg) {
  // Try cobalt first
  let result = await cobaltDownload(url, isAudio);

  // Fallback to RapidAPI
  if (!result) {
    result = await rapidDownload(url);
  }

  if (!result) {
    await sock.sendMessage(jid, {
      text: '❌ Could not download this media. The link may be private, expired, or unsupported.'
    });
    return;
  }

  try {
    if (isAudio) {
      await sock.sendMessage(jid, {
        audio: { url: result.url },
        mimetype: 'audio/mpeg',
        ptt: false
      }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, {
        video: { url: result.url },
        mimetype: 'video/mp4',
        caption: '📥 Downloaded by SwiftBot'
      }, { quoted: msg });
    }
  } catch (err) {
    // File might be too large (WhatsApp 64MB limit)
    if (err.message?.includes('413') || err.message?.includes('size')) {
      await sock.sendMessage(jid, {
        text: `❌ File is too large to send on WhatsApp (max 64MB).\n\nDirect link:\n${result.url}`
      });
    } else {
      await sock.sendMessage(jid, {
        text: `❌ Failed to send media.\n\nDirect link:\n${result.url}`
      });
    }
  }
}

// ─── COMMANDS ─────────────────────────────────────────────────────
export const downloaderCommands = {

  yt: {
    names: ['yt', 'youtube', 'video'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || !url.includes('youtu')) {
        await sock.sendMessage(jid, { text: `Usage: ${PREFIX}yt <youtube url>` });
        return;
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading YouTube video...' });
      await tryDownloadAndSend(sock, jid, url, false, 'video', msg);
    }
  },

  song: {
    names: ['song', 'play', 'music'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const query = args.join(' ');
      if (!query) {
        await sock.sendMessage(jid, { text: `Usage: ${PREFIX}song <song name>\nExample: ${PREFIX}song shape of you ed sheeran` });
        return;
      }

      await sock.sendMessage(jid, { text: `🎵 Searching for *${query}*...` });

      let url = query;
      // If not a direct URL, search YouTube
      if (!query.startsWith('http')) {
        url = await searchYouTube(query);
        if (!url) {
          await sock.sendMessage(jid, { text: '❌ Could not find that song on YouTube.' });
          return;
        }
      }

      await tryDownloadAndSend(sock, jid, url, true, 'audio', msg);
    }
  },

  tiktok: {
    names: ['tiktok', 'tt'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || !url.includes('tiktok')) {
        await sock.sendMessage(jid, { text: `Usage: ${PREFIX}tiktok <tiktok url>` });
        return;
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading TikTok video...' });
      await tryDownloadAndSend(sock, jid, url, false, 'video', msg);
    }
  },

  ig: {
    names: ['ig', 'instagram', 'igdl'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || !url.includes('instagram')) {
        await sock.sendMessage(jid, { text: `Usage: ${PREFIX}ig <instagram url>` });
        return;
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading Instagram media...' });
      await tryDownloadAndSend(sock, jid, url, false, 'video', msg);
    }
  },

  fb: {
    names: ['fb', 'facebook'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || (!url.includes('facebook') && !url.includes('fb.watch'))) {
        await sock.sendMessage(jid, { text: `Usage: ${PREFIX}fb <facebook video url>` });
        return;
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading Facebook video...' });
      await tryDownloadAndSend(sock, jid, url, false, 'video', msg);
    }
  },

  twitter: {
    names: ['twitter', 'tw', 'x'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || (!url.includes('twitter') && !url.includes('x.com'))) {
        await sock.sendMessage(jid, { text: `Usage: ${PREFIX}twitter <tweet url>` });
        return;
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading Twitter/X video...' });
      await tryDownloadAndSend(sock, jid, url, false, 'video', msg);
    }
  },

  sc: {
    names: ['sc', 'soundcloud'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      const url = args[0];
      if (!url || !url.includes('soundcloud')) {
        await sock.sendMessage(jid, { text: `Usage: ${PREFIX}sc <soundcloud url>` });
        return;
      }
      await sock.sendMessage(jid, { text: '⏳ Downloading SoundCloud track...' });
      await tryDownloadAndSend(sock, jid, url, true, 'audio', msg);
    }
  }
};
