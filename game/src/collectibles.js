// Hidden packages for SOLMAR HEAT: eight stashes tucked away from the
// mission trail, each worth $75. No map marker gives them away — a faint
// golden sparkle shows only when Danny is close. The count survives in
// the save, so a careful player keeps their progress.

import { REWARDS } from './config.js';
import { floatText, burst } from './effects.js';

// Fixed hiding spots, spread across the city away from mission markers.
export const PACKAGE_HIDING_SPOTS = [
  { x: 450, y: 450 },
  { x: 1500, y: 450 },
  { x: 450, y: 1050 },
  { x: 2050, y: 1050 },
  { x: 450, y: 2050 },
  { x: 1250, y: 2050 },
  { x: 2050, y: 2050 },
  { x: 2350, y: 2050 },
];

export function spawnHiddenPackages(game) {
  game.hiddenPackages = PACKAGE_HIDING_SPOTS.map((s) => ({ ...s, got: false }));
  // A loaded save keeps the packages already found.
  const kept = game.loadedPackages || 0;
  for (let i = 0; i < kept && i < game.hiddenPackages.length; i++) {
    game.hiddenPackages[i].got = true;
  }
  game.packagesGot = kept;
}

export function stepCollectibles(game, dt) {
  const at = game.player.inCar || game.player;
  for (const pack of game.hiddenPackages) {
    if (pack.got) continue;
    const d = Math.hypot(at.x - pack.x, at.y - pack.y);
    if (d < 42) {
      pack.got = true;
      game.packagesGot += 1;
      game.cash += REWARDS.package;
      floatText(game.fx, pack.x, pack.y - 20, `HIDDEN PACKAGE  +$${REWARDS.package}`, '#ffd94d');
      burst(game.fx, pack.x, pack.y, '#ffd94d', 10, 140);
      game.audio.cash();
    }
  }
}

// The nearest unfound package, for the sparkle and the HUD counter only.
export function nearestHiddenPackage(game) {
  const at = game.player.inCar || game.player;
  let best = null;
  let bestD = 1e9;
  for (const pack of game.hiddenPackages) {
    if (pack.got) continue;
    const d = Math.hypot(at.x - pack.x, at.y - pack.y);
    if (d < bestD) {
      best = pack;
      bestD = d;
    }
  }
  return best ? { ...best, dist: bestD } : null;
}
