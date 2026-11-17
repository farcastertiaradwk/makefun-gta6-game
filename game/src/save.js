// Save / continue for SOLMAR HEAT.
// Progress is stored in localStorage as one small JSON object: cash, the
// mission reached, health, armor, ammo and where the player stood. Loading
// never trusts the stored shape — a bad or partial save is ignored and the
// game starts fresh. All storage access is guarded: in a restricted context
// (private mode, file://) the game simply plays without saving.

const SAVE_KEY = 'solmar-heat-save-v1';

/** Snapshot the parts of the world worth keeping between sessions. */
export function saveGame(world) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      cash: world.cash,
      missionIndex: world.mission ? world.mission.index : 0,
      missionsDone: world.missionsDone || 0,
      player: {
        x: world.player.x,
        y: world.player.y,
        health: Math.round(world.player.health),
        armor: Math.round(world.player.armor),
        mag: world.player.weapon.mag,
        reserve: world.player.weapon.reserve,
      },
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

/** Read the save back, or null when there is none / it is unusable. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    if (typeof data.cash !== 'number' || !data.player) return null;
    if (typeof data.player.x !== 'number' || typeof data.player.y !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

/** Forget the save (used after the story is finished, or on request). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    /* ignore */
  }
}

/** Does a usable save exist? The title screen uses this for Continue. */
export function hasSave() {
  return loadSave() !== null;
}
