# SwiftBot (dodge-dmn) — Multi-Session

A multi-tenant WhatsApp bot. Multiple people can each pair their own WhatsApp account on the same deployment — each gets an isolated session, auto-generated session ID, and independent bot.

## How it works

- Visiting `/` starts a new session and generates a random session ID, stored in the visitor's browser (`localStorage`).
- Each session runs its own Baileys socket, with its own QR/pair code, auth state, and Supabase-persisted session data.
- Returning visitors (same browser) resume their existing session automatically.
- Bot owner detection is automatic — whoever's WhatsApp account is linked to a session is that session's owner (for owner-only commands like `.togglestatus`).

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_KEY` | Your Supabase service role or anon key | Yes |
| `PREFIX` | Command prefix (default: `.`) | No |
| `MAX_SESSIONS` | Max concurrent active sessions (default: `5`) | No |
| `SELF_URL` | Full URL of the deployed app, for self-pinging | No |
| `PORT` | Port (Render sets automatically) | No |

## Supabase Setup

```sql
create table bot_sessions (
  id text primary key,
  data text,
  updated_at timestamptz
);
```

Each row stores one user's zipped Baileys auth folder, keyed by their auto-generated session ID.

## Deploy on Render

1. Push this repo to GitHub.
2. Create a new Web Service, connect the repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables above.
6. Visit `https://<your-app>.onrender.com/` — each visitor gets their own pairing flow.

## Resource notes

Each active WhatsApp session consumes meaningful memory (roughly 100-200MB). `MAX_SESSIONS=5` is a safe default for Render's free tier; raise it only on a paid plan with more RAM.

## Commands

| Command | Description |
|---|---|
| `.ping` | Check bot latency |
| `.alive` | Check bot + session status |
| `.menu` | Show command menu |
| `.togglestatus on/off` | Toggle bot status (session owner only) |

## Logout / Reset

If a user logs the device out from their phone (WhatsApp > Linked Devices > remove), the server detects this, clears that session's stored data from Supabase, and removes it from memory. The user can start a fresh pairing by clearing their browser's localStorage or visiting in a new browser/incognito window.
