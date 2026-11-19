// Save / continue for SOLMAR HEAT, via localStorage.
// Only progress is saved — cash, the next mission, collected packages and
// the best wanted level survived — never the live world. A save is a plain
// JSON object under one key, so a corrupt entry is simply ignored.

const SAVE_KEY = 'solmar-heat-save-v3';

export function saveProgress(game) {
  try {
    const data = {
      cash: game.cash,
      missionIndex: game.missionIndex,
      packagesGot: game.packagesGot,
      bestWanted: game.bestWanted,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return {
      cash: Math.max(0, Math.floor(data.cash)),
      missionIndex: Math.min(7, Math.max(0, Math.floor(data.missionIndex))),
      packagesGot: Math.min(8, Math.max(0, Math.floor(data.packagesGot || 0))),
      bestWanted: Math.min(5, Math.max(0, Math.floor(data.bestWanted || 0))),
    };
  } catch (err) {
    return null;
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // Storage unavailable: nothing to clear.
  }
}

export function hasSave() {
  return loadProgress() !== null;
}
