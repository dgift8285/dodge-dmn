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
} else {
  console.warn('⚠️  SUPABASE_URL or SUPABASE_KEY not set — state will not persist across restarts.');
}

const DEFAULT_STATE = {
  status: true,
  mode: 'public',
  prefix: null,
  ownerNumber: null,
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

// In-memory cache
const stateCache = new Map();

export async function loadState(sessionId) {
  let state = { ...DEFAULT_STATE };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('state')
        .eq('id', sessionId)
        .maybeSingle(); // use maybeSingle so no error if row doesn't exist yet

      if (error) {
        console.error(`[${sessionId}] Supabase loadState error:`, error.message, error.details);
      } else if (data?.state) {
        state = { ...DEFAULT_STATE, ...data.state };
        console.log(`[${sessionId}] State loaded from Supabase:`, JSON.stringify(state));
      } else {
        console.log(`[${sessionId}] No saved state found, using defaults.`);
      }
    } catch (err) {
      console.error(`[${sessionId}] loadState exception:`, err.message);
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
      const { error } = await supabase
        .from(TABLE)
        .upsert(
          { id: sessionId, state: JSON.parse(JSON.stringify(state)), updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );

      if (error) {
        console.error(`[${sessionId}] Supabase saveState error:`, error.message, error.details);
      } else {
        console.log(`[${sessionId}] State saved to Supabase.`);
      }
    } catch (err) {
      console.error(`[${sessionId}] saveState exception:`, err.message);
    }
  }
}

export function getState(sessionId) {
  return stateCache.get(sessionId) || { ...DEFAULT_STATE };
}

export async function setState(sessionId, key, value) {
  const state = getState(sessionId);
  state[key] = value;
  stateCache.set(sessionId, state);
  await saveState(sessionId);
}
