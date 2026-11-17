// Progress in localStorage: the whole snapshot serializeWorld produces —
// seed, position, health, cash, mission, wanted, lifetime stats. Continue
// rebuilds the same seed and swaps the snapshot back in. A save that fails
// to parse, or that is not our version, is no save at all.
import { serializeWorld, deserializeWorld } from './world.js';

const STORAGE_KEY = 'solmar-heat-save-v1';

function parseSave() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1 || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(world) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeWorld(world)));
    return true;
  } catch {
    return false;
  }
}

// Returns a rebuilt world, or null when there is nothing to continue.
export function loadGame() {
  const data = parseSave();
  if (!data) return null;
  return deserializeWorld(data);
}

export function hasSave() {
  return parseSave() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage off: nothing to clear.
  }
}
