import express from 'express';
import qrcode from 'qrcode';
import path from 'path';

import {
  startSession,
  getSession,
  restoreAllSessions,
  generateSessionId,
  canCreateSession,
  activeCount,
  listActiveSessions
} from './lib/sessionManager.js';

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static('public'));
app.use(express.json());

// ---------- Routes ----------

app.get('/', (req, res) => {
  res.sendFile(path.resolve('public', 'pair.html'));
});

// Initialize (or resume) a session. If sessionId provided and exists, resume it.
// Otherwise generate a new sessionId and start a fresh session.
app.post('/api/session/init', async (req, res) => {
  let sessionId = req.query.sessionId || req.body?.sessionId;

  try {
    if (sessionId) {
      let entry = getSession(sessionId);
      if (!entry) {
        if (!canCreateSession()) {
          return res.json({ error: 'Server is at capacity. Please try again later.' });
        }
        // Try to resume from storage (in case it exists in Supabase)
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

app.get('/api/qr', async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) return res.json({ error: 'Missing sessionId' });

  const entry = getSession(sessionId);
  if (!entry) return res.json({ error: 'Session not found' });

  if (entry.connected) {
    return res.json({ connected: true });
  }

  if (entry.qr) {
    try {
      const qrImage = await qrcode.toDataURL(entry.qr);
      return res.json({ qr: qrImage });
    } catch (err) {
      return res.json({ error: 'Failed to generate QR image' });
    }
  }

  return res.json({ qr: null });
});

app.get('/api/pair', async (req, res) => {
  const number = (req.query.number || '').replace(/[^0-9]/g, '');

  if (!number) return res.json({ error: 'Invalid number' });

  if (!canCreateSession()) {
    return res.json({ error: 'Server is at capacity. Please try again later.' });
  }

  try {
    // Always start a brand new clean session for pair code
    const sessionId = generateSessionId();
    const entry = await startSession(sessionId, { restore: false, pairingNumber: number });

    // Wait up to 15 seconds for the pairing code to be generated
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

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: activeCount(),
    sessions: listActiveSessions()
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Self-ping to help keep the service awake (in addition to UptimeRobot)
const SELF_URL = process.env.SELF_URL;
if (SELF_URL) {
  setInterval(() => {
    fetch(SELF_URL).catch(() => {});
  }, 5 * 60 * 1000);
}

// ---------- Restore previously connected sessions on boot ----------

restoreAllSessions().catch((err) => {
  console.error('Failed to restore sessions:', err.message);
});
