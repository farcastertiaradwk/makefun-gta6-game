// Saving to localStorage: the mission reached, cash, armour, ammo and lifetime
// stats. The Safehouse and every completed mission write it; Continue reads it.
const SAVE_KEY = 'solmar-heat-save-v1';

export function saveGame(world) {
  try {
    const data = {
      missionIndex: world.missionIndex,
      cash: world.cash,
      armor: world.player.armor,
      reserve: world.player.reserve,
      stats: world.stats,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage off: nothing to clear.
  }
}
