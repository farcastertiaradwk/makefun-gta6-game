// The player on foot: Danny Reyes, wheelman out of work.
// Movement (WASD, Shift to sprint), aiming with the mouse, the pistol
// (12-round magazine, R reloads), picking things up by walking over them,
// and the E key: steal a car, get out of one, crack the safe, use a shop.
// When Danny is in a car the car module owns movement; this module owns
// everything on foot, plus the shooting that works in both states.

import { PLAYER, KEYS, CARS, PRICES, PLACES } from './config.js';
import { clamp, dist, wrapAngle } from './random.js';
import { moveVector } from './input.js';
import { muzzle, floatText, damagePlayer } from './effects.js';

/** Fresh player, standing by the Safehouse. */
export function makePlayer() {
  return {
    x: 300,
    y: 1600,
    angle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    armor: 0,
    radius: PLAYER.radius,
    /** The car Danny is driving, or null when on foot. */
    inCar: null,
    weapon: { mag: PLAYER.magSize, reserve: PLAYER.startReserve, magSize: PLAYER.magSize },
    /** Seconds until the next shot is allowed. */
    fireCooldown: 0,
    /** Seconds since the last shot (for the fire animation). */
    sinceShot: 99,
    hurtFlash: 0,
    sprinting: false,
    moving: false,
    /** Quirk preserved from the design: this field exists but is never set;
     *  peds flee from gunfire through the direct bullet check instead. */
    lastShotAt: null,
  };
}

/** Aim the player at the mouse (screen space -> world space via camera). */
export function aimAtMouse(world) {
  const p = world.player;
  const cam = world.camera;
  const wx = world.input.mouse.x + cam.x;
  const wy = world.input.mouse.y + cam.y;
  p.angle = Math.atan2(wy - p.y, wx - p.x);
}

/** Fire one pistol round from the player (on foot or leaning out of a car). */
export function shootPistol(world) {
  const p = world.player;
  if (p.fireCooldown > 0) return false;
  if (p.weapon.mag <= 0) {
    world.audio.tone(140, 0.06, 'square', 0.06);
    p.fireCooldown = 0.25;
    return false;
  }
  p.weapon.mag -= 1;
  p.fireCooldown = PLAYER.fireInterval;
  p.sinceShot = 0;
  const sx = p.x + Math.cos(p.angle) * 20;
  const sy = p.y + Math.sin(p.angle) * 20;
  world.bullets.push({
    x: sx,
    y: sy,
    vx: Math.cos(p.angle) * PLAYER.bulletSpeed,
    vy: Math.sin(p.angle) * PLAYER.bulletSpeed,
    travelled: 0,
    range: PLAYER.bulletRange,
    damage: PLAYER.bulletDamage,
    fromPlayer: true,
  });
  muzzle(world, sx, sy, p.angle);
  world.audio.shot();
  // Shooting is a crime, but the heat is throttled: at most once per
  // shootHeatCooldown seconds, so a long firefight does not jump straight
  // to five stars on the first magazine.
  const now = world.time;
  if (now - (world.lastShootHeatAt || -99) > 2) {
    world.lastShootHeatAt = now;
    if (world.wanted < 5) world.wanted += 1;
  }
  return true;
}

/** Reload the pistol from the reserve. */
export function reloadWeapon(world) {
  const w = world.player.weapon;
  if (w.mag >= w.magSize || w.reserve <= 0) return;
  const need = w.magSize - w.mag;
  const take = Math.min(need, w.reserve);
  w.mag += take;
  w.reserve -= take;
  world.audio.tone(440, 0.07, 'square', 0.08);
}

/** Walk the player; called only while on foot. */
function walkPlayer(world, dt) {
  const p = world.player;
  const input = world.input;
  const mv = moveVector(input);
  p.sprinting = input.isDown(KEYS.sprint) && (mv.x !== 0 || mv.y !== 0);
  const speed = p.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  p.moving = mv.x !== 0 || mv.y !== 0;
  const nx = p.x + mv.x * speed * dt;
  const ny = p.y + mv.y * speed * dt;
  const hit = collideWorld(world, nx, ny, p.radius);
  p.x = hit.x;
  p.y = hit.y;
  aimAtMouse(world);
}

/** Keep a circle out of buildings, water and the world edge. */
export function collideWorld(world, x, y, radius) {
  let nx = clamp(x, radius + 8, 2600 - radius - 8);
  let ny = clamp(y, radius + 8, 2600 - radius - 8);
  // Harbour water blocks movement (except on the piers).
  if (nx >= PLACES.harbourX - radius) {
    let onPier = false;
    for (const pier of world.city.piers) {
      if (ny >= pier.y && ny <= pier.y + pier.h && nx >= pier.x - 10) onPier = true;
    }
    if (!onPier) nx = PLACES.harbourX - radius;
  }
  // Buildings are solid.
  for (const block of world.city.blocks) {
    for (const b of block.buildings) {
      if (nx + radius > b.x && nx - radius < b.x + b.w && ny + radius > b.y && ny - radius < b.y + b.h) {
        const pushLeft = nx + radius - b.x;
        const pushRight = b.x + b.w - (nx - radius);
        const pushUp = ny + radius - b.y;
        const pushDown = b.y + b.h - (ny - radius);
        const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (min === pushLeft) nx = b.x - radius;
        else if (min === pushRight) nx = b.x + b.w + radius;
        else if (min === pushUp) ny = b.y - radius;
        else ny = b.y + b.h + radius;
      }
    }
  }
  return { x: nx, y: ny };
}

/** Pickups Danny walks over: health, ammo, mission packages. */
function collectPickups(world) {
  const p = world.player;
  for (let i = world.pickups.length - 1; i >= 0; i -= 1) {
    const pk = world.pickups[i];
    if (dist(p.x, p.y, pk.x, pk.y) > PLAYER.pickupRadius) continue;
    if (pk.kind === 'health') {
      if (p.health >= PLAYER.maxHealth) continue;
      p.health = Math.min(PLAYER.maxHealth, p.health + PLAYER.pickupHealth);
      floatText(world, pk.x, pk.y - 10, `+${PLAYER.pickupHealth} HP`, '#7be382');
      world.audio.pickup();
      world.pickups.splice(i, 1);
    } else if (pk.kind === 'ammo') {
      if (p.weapon.reserve >= PLAYER.maxReserve) continue;
      p.weapon.reserve = Math.min(PLAYER.maxReserve, p.weapon.reserve + PLAYER.pickupAmmo);
      floatText(world, pk.x, pk.y - 10, `+${PLAYER.pickupAmmo} AMMO`, '#ffd94d');
      world.audio.pickup();
      world.pickups.splice(i, 1);
    } else if (pk.kind === 'package') {
      world.pickups.splice(i, 1);
      world.audio.coin();
      if (world.mission && world.mission.index === 1) {
        world.mission.data.collected += 1;
        const n = world.mission.data.collected;
        world.mission.objective = `Collect the packages: ${n}/3`;
        floatText(world, pk.x, pk.y - 10, `Package ${n}/3`, '#ffd94d');
      }
    }
  }
}

/**
 * The E key, context-sensitive:
 *  - near the bank safe during mission 5: crack (handled by missions, this
 *    only reports that E is held);
 *  - near a shop: buy;
 *  - near a car while on foot: steal it;
 *  - while driving: get out.
 * Returns a short label for the prompt line, or null.
 */
export function interactLabel(world) {
  const p = world.player;
  if (p.inCar) return 'E — Get out';
  if (world.mission && world.mission.index === 4 && world.mission.stage === 1) {
    const s = world.city.bankSafe;
    if (dist(p.x, p.y, s.x, s.y) < 100) return 'Hold E — Crack the safe';
  }
  const shop = nearestShop(world);
  if (shop) return `E — ${shop.action}`;
  const car = nearestStealable(world);
  if (car) return 'E — Steal car';
  return null;
}

function nearestShop(world) {
  const p = world.player;
  const shops = [
    { key: 'gunshop', x: PLACES.gunshop.x + 60, y: PLACES.gunshop.y + 45, action: 'Buy ammo $60 / armor $120', kind: 'gun' },
    { key: 'garage', x: PLACES.garage.x + 70, y: PLACES.garage.y + 50, action: 'Repair $80 / Lay low $100 per star', kind: 'garage' },
    { key: 'safehouse', x: PLACES.safehouse.x + 60, y: PLACES.safehouse.y + 45, action: 'Rest — heal & clear wanted', kind: 'safe' },
  ];
  for (const s of shops) {
    if (dist(p.x, p.y, s.x, s.y) < 95) return s;
  }
  return null;
}

export function nearestStealable(world) {
  const p = world.player;
  let best = null;
  let bestD = 60;
  for (const car of world.cars) {
    if (car.kind !== 'parked' || car.wrecked) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Buy at a shop. Called once per E press near a shop. */
export function useShop(world) {
  const p = world.player;
  const shop = nearestShop(world);
  if (!shop) return false;
  if (shop.kind === 'gun') {
    if (world.cash < PRICES.ammo) {
      floatText(world, p.x, p.y - 20, 'Not enough cash', '#ff7a6e');
      return true;
    }
    world.cash -= PRICES.ammo;
    p.weapon.reserve = Math.min(PLAYER.maxReserve, p.weapon.reserve + PRICES.ammoPack);
    if (world.cash >= PRICES.armor && p.armor < PLAYER.maxArmor) {
      world.cash -= PRICES.armor;
      p.armor = PLAYER.maxArmor;
      floatText(world, p.x, p.y - 20, 'Ammo + armor', '#ffd94d');
    } else {
      floatText(world, p.x, p.y - 20, 'Ammo restocked', '#ffd94d');
    }
    world.audio.coin();
    return true;
  }
  if (shop.kind === 'garage') {
    if (world.cash >= PRICES.repair && p.inCar && p.inCar.health < CARS.maxHealth) {
      world.cash -= PRICES.repair;
      p.inCar.health = CARS.maxHealth;
      floatText(world, p.x, p.y - 20, 'Car repaired', '#7be382');
      world.audio.coin();
      return true;
    }
    if (world.wanted > 0 && world.cash >= PRICES.layLowPerStar * world.wanted) {
      world.cash -= PRICES.layLowPerStar * world.wanted;
      world.wanted = 0;
      floatText(world, p.x, p.y - 20, 'Heat cleared', '#7be382');
      world.audio.coin();
      return true;
    }
    floatText(world, p.x, p.y - 20, 'Nothing to fix', '#ff7a6e');
    return true;
  }
  if (shop.kind === 'safe') {
    p.health = PLAYER.maxHealth;
    world.wanted = 0;
    floatText(world, p.x, p.y - 20, 'Rested — wanted cleared', '#7be382');
    world.audio.pickup();
    return true;
  }
  return false;
}

/** Per-frame player update (on foot). Driving is the car module's job. */
export function updatePlayer(world, dt) {
  const p = world.player;
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  p.sinceShot += dt;
  if (p.inCar) {
    // Danny rides with the car; aim follows the mouse for drive-by shots.
    p.x = p.inCar.x;
    p.y = p.inCar.y;
    p.angle = p.inCar.angle;
    aimAtMouse(world);
    if (world.input.mouse.down) shootPistol(world);
    return;
  }
  walkPlayer(world, dt);
  if (world.input.mouse.down) shootPistol(world);
  collectPickups(world);
  if (p.health <= 0) {
    world.screen = 'wasted';
    world.audio.fail();
  }
}

/** Heal the player to full (safehouse rest, mission start safety net). */
export function healFull(world) {
  world.player.health = PLAYER.maxHealth;
}

export { damagePlayer };
