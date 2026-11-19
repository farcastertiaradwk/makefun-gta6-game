// Danny Reyes on foot: WASD to walk, Shift to sprint, mouse to aim,
// click to fire the pistol, R to reload, E to steal or interact.
// Health and armor pickups sit at six fixed spots around Solmar.
import { CFG } from './config.js';

const PICKUP_SPOTS = [
  { x: 420, y: 1180, kind: 'health' }, { x: 1620, y: 420, kind: 'ammo' },
  { x: 2180, y: 1620, kind: 'health' }, { x: 820, y: 2100, kind: 'ammo' },
  { x: 1980, y: 980, kind: 'health' }, { x: 1180, y: 1980, kind: 'ammo' },
];

export function newPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, hp: CFG.player.hp, armor: 0,
    mag: CFG.player.magSize, reserve: CFG.player.reserveStart,
    reloading: 0, inCar: null, moving: false, sprinting: false,
  };
}

export function makePickups() {
  return PICKUP_SPOTS.map((s) => ({ ...s, taken: false }));
}

// Push a circle out of every building rect it overlaps.
export function pushOutOfBuildings(world, obj, r) {
  for (const b of world.city.buildings) {
    const cx = Math.max(b.x, Math.min(obj.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(obj.y, b.y + b.h));
    const dx = obj.x - cx;
    const dy = obj.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      obj.x = cx + (dx / d) * r;
      obj.y = cy + (dy / d) * r;
    }
  }
}

export function stepOnFoot(world, dt) {
  const p = world.player;
  const k = world.keys;
  let mx = (k.has(CFG.keys.right) ? 1 : 0) - (k.has(CFG.keys.left) ? 1 : 0);
  let my = (k.has(CFG.keys.down) ? 1 : 0) - (k.has(CFG.keys.up) ? 1 : 0);
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  p.sprinting = k.has(CFG.keys.sprint) && len > 0;
  if (len > 0) {
    mx /= len;
    my /= len;
    const speed = p.sprinting ? CFG.player.sprint : CFG.player.walk;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.angle = Math.atan2(my, mx);
  }
  p.x = Math.max(20, Math.min(CFG.world.w - 20, p.x));
  p.y = Math.max(20, Math.min(CFG.world.h - 20, p.y));
  pushOutOfBuildings(world, p, CFG.player.radius);
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      const need = CFG.player.magSize - p.mag;
      const take = Math.min(need, p.reserve);
      p.mag += take;
      p.reserve -= take;
    }
  }
  // pickups
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(p.x - pk.x, p.y - pk.y) < CFG.player.pickupRadius) {
      pk.taken = true;
      if (pk.kind === 'health') p.hp = Math.min(CFG.player.hp, p.hp + 30);
      else p.reserve = Math.min(CFG.player.reserveCap, p.reserve + 24);
      world.floats.push({ x: pk.x, y: pk.y - 18, text: pk.kind === 'health' ? '+30 HP' : '+24 AMMO', life: 1.4, color: '#7dff8a' });
      world.audio.pickup();
    }
  }
}

export function firePistol(world) {
  const p = world.player;
  if (p.reloading > 0 || p.mag <= 0) return;
  p.mag -= 1;
  // drive-by: the shot leaves the car the player is driving
  const ox = p.inCar ? p.inCar.x : p.x;
  const oy = p.inCar ? p.inCar.y : p.y;
  const a = p.angle;
  world.bullets.push({
    x: ox + Math.cos(a) * 20, y: oy + Math.sin(a) * 20,
    vx: Math.cos(a) * CFG.player.bulletSpeed, vy: Math.sin(a) * CFG.player.bulletSpeed,
    life: CFG.player.bulletRange / CFG.player.bulletSpeed, from: 'player', damage: CFG.player.bulletDamage,
  });
  world.effects.muzzle(ox + Math.cos(a) * 22, oy + Math.sin(a) * 22, a);
  world.audio.shot();
  world.lastShotAt = world.time;
  if (world.time - (world.lastHeatAt || -99) > 5) {
    world.lastHeatAt = world.time;
    world.police.addWanted(world, 1);
  }
}

export function reloadWeapon(world) {
  const p = world.player;
  if (p.inCar || p.reloading > 0 || p.mag >= CFG.player.magSize || p.reserve <= 0) return;
  p.reloading = CFG.player.reloadSecs;
  world.audio.reload();
}

export function hurtPlayer(world, dmg) {
  const p = world.player;
  if (p.armor > 0) {
    const soaked = Math.min(p.armor, dmg);
    p.armor -= soaked;
    dmg -= soaked;
  }
  p.hp -= dmg;
  if (p.hp <= 0) {
    p.hp = 0;
    world.toScreen('wasted');
  }
}
