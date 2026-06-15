import { createClient } from '@supabase/supabase-js';
import AdmZip from 'adm-zip';
import fs from 'fs';
import ws from 'ws';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const TABLE = 'bot_sessions';
const SESSIONS_ROOT = './sessions';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: { transport: ws }
  });
}

export function getSessionDir(sessionId) {
  return `${SESSIONS_ROOT}/${sessionId}`;
}

// List all known session IDs stored in Supabase (used on boot to restore active sessions)
export async function listStoredSessions() {
  if (!supabase) return [];
  const { data, error } = await supabase.from(TABLE).select('id');
  if (error || !data) return [];
  return data.map((row) => row.id);
}

export async function downloadSession(sessionId) {
  if (!supabase) return false;

  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    return false;
  }

  try {
    const buffer = Buffer.from(data.data, 'base64');
    const zip = new AdmZip(buffer);
    const dir = getSessionDir(sessionId);

    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });

    zip.extractAllTo(dir, true);
    console.log(`[${sessionId}] Session restored from Supabase.`);
    return true;
  } catch (err) {
    console.error(`[${sessionId}] Failed to restore session:`, err.message);
    return false;
  }
}

export async function uploadSession(sessionId) {
  if (!supabase) return;
  const dir = getSessionDir(sessionId);
  if (!fs.existsSync(dir)) return;

  try {
    const zip = new AdmZip();
    zip.addLocalFolder(dir);
    const buffer = zip.toBuffer();
    const base64 = buffer.toString('base64');

    const { error } = await supabase
      .from(TABLE)
      .upsert({ id: sessionId, data: base64, updated_at: new Date().toISOString() });

    if (error) {
      console.error(`[${sessionId}] Failed to upload session:`, error.message);
    }
  } catch (err) {
    console.error(`[${sessionId}] Error zipping/uploading session:`, err.message);
  }
}

export async function deleteStoredSession(sessionId) {
  if (!supabase) return;
  await supabase.from(TABLE).delete().eq('id', sessionId);
}
