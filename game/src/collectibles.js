// Eight hidden packages stashed off the mission trail. A package glints
// gold once the player is close (220 px); walk over it (34 px) to pocket
// $75. The HUD counts them and the save file remembers which are gone.
import { CFG } from './config.js';

const HIDING_SPOTS = [
  { x: 450, y: 450 }, { x: 2350, y: 300 }, { x: 200, y: 2300 },
  { x: 1300, y: 2350 }, { x: 2250, y: 1900 }, { x: 900, y: 300 },
  { x: 1700, y: 1300 }, { x: 350, y: 900 },
];

export function placePackages() {
  return HIDING_SPOTS.map((s, i) => ({ id: i, x: s.x, y: s.y, taken: false }));
}

export function stepPackages(world, dt) {
  const p = world.player;
  if (!p || world.screen !== 'play') return;
  for (const pack of world.packages) {
    if (pack.taken) continue;
    const d = Math.hypot(p.x - pack.x, p.y - pack.y);
    pack.glint = d < 220;
    if (d < CFG.player.pickupRadius) {
      pack.taken = true;
      world.cash += CFG.prices.packageReward;
      world.collected = (world.collected || 0) + 1;
      world.floats.push({ x: pack.x, y: pack.y - 20, text: `+$${CFG.prices.packageReward}`, life: 1.4, color: '#ffd94d' });
      world.audio.pickup();
    }
  }
  void dt;
}

export function packagesLeft(world) {
  return world.packages.filter((p) => !p.taken).length;
}
