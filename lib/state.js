import fs from 'fs';
import { getSessionDir } from './session.js';

const stateCache = new Map();

function stateFile(sessionId) {
  return `${getSessionDir(sessionId)}/state.json`;
}

export function loadState(sessionId) {
  let state = { status: true, react: false };
  try {
    const file = stateFile(sessionId);
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      state = { ...state, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error(`[${sessionId}] Failed to load state:`, err.message);
  }
  stateCache.set(sessionId, state);
  return state;
}

export function saveState(sessionId) {
  try {
    const state = stateCache.get(sessionId) || {};
    fs.writeFileSync(stateFile(sessionId), JSON.stringify(state, null, 2));
  } catch (err) {
    console.error(`[${sessionId}] Failed to save state:`, err.message);
  }
}

export function getState(sessionId) {
  if (!stateCache.has(sessionId)) {
    return loadState(sessionId);
  }
  return stateCache.get(sessionId);
}

export function setState(sessionId, key, value) {
  const state = getState(sessionId);
  state[key] = value;
  stateCache.set(sessionId, state);
  saveState(sessionId);
}
