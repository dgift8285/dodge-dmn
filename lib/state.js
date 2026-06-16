import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const TABLE = 'bot_states';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: { transport: ws }
  });
}

const DEFAULT_STATE = {
  status: true,
  mode: 'public',
  prefix: null,
  autoRecording: false,
  autoTyping: false,
  antiCall: false,
  welcomeMessage: false,
  goodbyeMessage: false,
  autoRead: false,
  autoViewStatus: false,
  autoLikeStatus: false,
  antiDelete: false,
  autoBio: false
};

// In-memory cache so we don't hit Supabase on every message
const stateCache = new Map();

export async function loadState(sessionId) {
  // Start with defaults
  let state = { ...DEFAULT_STATE };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('state')
        .eq('id', sessionId)
        .single();

      if (!error && data?.state) {
        state = { ...DEFAULT_STATE, ...data.state };
      }
    } catch (err) {
      console.error(`[${sessionId}] Failed to load state from Supabase:`, err.message);
    }
  }

  stateCache.set(sessionId, state);
  return state;
}

async function saveState(sessionId) {
  const state = stateCache.get(sessionId);
  if (!state) return;

  if (supabase) {
    try {
      await supabase
        .from(TABLE)
        .upsert({ id: sessionId, state, updated_at: new Date().toISOString() });
    } catch (err) {
      console.error(`[${sessionId}] Failed to save state to Supabase:`, err.message);
    }
  }
}

export function getState(sessionId) {
  // Return cached state (loadState must be called first on session start)
  return stateCache.get(sessionId) || { ...DEFAULT_STATE };
}

export async function setState(sessionId, key, value) {
  const state = getState(sessionId);
  state[key] = value;
  stateCache.set(sessionId, state);
  await saveState(sessionId);
}
