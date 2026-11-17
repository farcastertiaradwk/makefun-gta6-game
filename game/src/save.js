// Progress in localStorage: the mission reached, cash, armour, ammo and
// lifetime stats. The Safehouse and every finished mission write it;
// Continue reads it back.
const STORAGE_KEY = 'solmar-heat-save-v1';

function parseSave() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(world) {
  try {
    const data = {
      missionIndex: world.missionIndex,
      cash: world.cash,
      armor: world.player.armor,
      reserve: world.player.reserve,
      stats: world.stats,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  return parseSave();
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
