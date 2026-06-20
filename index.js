import express from 'express';
import qrcode from 'qrcode';
import path from 'path';
import axios from 'axios';
import {
  startSession,
  getSession,
  restoreAllSessions,
  generateSessionId,
  canCreateSession,
  activeCount,
  listActiveSessions
} from './lib/sessionManager.js';

const PORT        = process.env.PORT            || 3000;
const GIFTED_KEY  = process.env.GIFTED_API_KEY  || 'gifted';
const GIFTED_BASE = 'https://api.gifted.co.ke';

const app = express();
app.use(express.static('public'));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(path.resolve('public', 'pair.html'));
});

// Initialize (or resume) a session
app.post('/api/session/init', async (req, res) => {
  let sessionId = req.query.sessionId || req.body?.sessionId;
  try {
    if (sessionId) {
      let entry = getSession(sessionId);
      if (!entry) {
        if (!canCreateSession()) {
          return res.json({ error: 'Server is at capacity. Please try again later.' });
        }
        entry = await startSession(sessionId, { restore: true });
      }
      return res.json({ sessionId });
    }

    if (!canCreateSession()) {
      return res.json({ error: 'Server is at capacity. Please try again later.' });
    }

    sessionId = generateSessionId();
    await startSession(sessionId, { restore: false });
    return res.json({ sessionId });
  } catch (err) {
    console.error('Session init error:', err.message);
    return res.json({ error: err.message });
  }
});

// QR code endpoint
app.get('/api/qr', async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) return res.json({ error: 'Missing sessionId' });

  const entry = getSession(sessionId);
  if (!entry) return res.json({ error: 'Session not found' });

  if (entry.connected) return res.json({ connected: true });

  if (entry.qr) {
    try {
      const qrImage = await qrcode.toDataURL(entry.qr);
      return res.json({ qr: qrImage });
    } catch {
      return res.json({ error: 'Failed to generate QR image' });
    }
  }

  return res.json({ qr: null });
});

// Pairing code endpoint
app.get('/api/pair', async (req, res) => {
  const number = (req.query.number || '').replace(/[^0-9]/g, '');
  if (!number) return res.json({ error: 'Invalid number' });

  if (!canCreateSession()) {
    return res.json({ error: 'Server is at capacity. Please try again later.' });
  }

  try {
    const sessionId = generateSessionId();
    const entry = await startSession(sessionId, { restore: false, pairingNumber: number });

    let waited = 0;
    while (!entry.pairingCode && waited < 15000) {
      await new Promise(r => setTimeout(r, 500));
      waited += 500;
    }

    if (!entry.pairingCode) {
      return res.json({ error: 'Timed out waiting for pair code. Try again.' });
    }

    return res.json({ code: entry.pairingCode, sessionId });
  } catch (err) {
    console.error('Pair code error:', err.message);
    return res.json({ error: 'Failed to get pairing code: ' + err.message });
  }
});

// Health check — now includes Gifted API status
app.get('/health', async (req, res) => {
  let giftedStatus = 'unknown';
  try {
    const { data } = await axios.get(`${GIFTED_BASE}/api/ai/ai`, {
      params: { apikey: GIFTED_KEY, q: 'ping' },
      timeout: 8000,
    });
    giftedStatus = data?.result ? 'ok' : 'degraded';
  } catch {
    giftedStatus = 'unreachable';
  }

  res.json({
    status: 'ok',
    activeSessions: activeCount(),
    sessions: listActiveSessions(),
    gifted: {
      status: giftedStatus,
      key: GIFTED_KEY === 'gifted' ? 'test key (gifted)' : 'custom key',
      base: GIFTED_BASE,
    },
  });
});

// Gifted API test endpoint — test any downloader from browser
// Usage: /api/gifted/test?endpoint=/api/download/ytmp3&url=https://youtube.com/...
app.get('/api/gifted/test', async (req, res) => {
  const { endpoint, ...params } = req.query;
  if (!endpoint) {
    return res.json({ error: 'Missing ?endpoint= param. Example: /api/gifted/test?endpoint=/api/download/ytmp3&url=YOUTUBE_URL' });
  }
  try {
    const { data } = await axios.get(`${GIFTED_BASE}${endpoint}`, {
      params: { apikey: GIFTED_KEY, ...params },
      timeout: 30000,
    });
    return res.json({ ok: true, result: data });
  } catch (err) {
    return res.json({ ok: false, error: err.message, response: err.response?.data });
  }
});

// ── Start server ──────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ SwiftBot server listening on port ${PORT}`);
  console.log(`🔑 Gifted API key: ${GIFTED_KEY}`);
});

// Self-ping to keep Render service awake (alongside UptimeRobot)
const SELF_URL = process.env.SELF_URL;
if (SELF_URL) {
  setInterval(() => {
    fetch(SELF_URL).catch(() => {});
  }, 5 * 60 * 1000);
}

// Restore previously connected sessions on boot
restoreAllSessions().catch((err) => {
  console.error('Failed to restore sessions:', err.message);
});
