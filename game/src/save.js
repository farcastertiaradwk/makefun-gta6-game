// Save / continue through localStorage. One slot, one version key:
// cash, mission, hidden packages taken, health and armor.
const KEY = 'solmar-heat-save-v1';

export function writeSave(world) {
  try {
    const data = {
      cash: world.cash,
      mission: world.mission ? world.mission.index : 0,
      packages: world.packages.filter((p) => p.taken).map((p) => p.id),
      hp: world.player.hp,
      armor: world.player.armor,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) { /* ignore */ }
}
