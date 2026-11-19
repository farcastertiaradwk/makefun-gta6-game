// Danny Reyes on foot: walking, sprinting, aiming, shooting, picking up
// health and ammo, and talking to shops. When he is in a car this module
// idles — vehicles.js owns driving.

import { PLAYER, KEYS, PRICES } from './config.js';
import { heldMove } from './input.js';
import { collideBuildings, clampWorld, inWater } from './city.js';
import { burst, floatText } from './effects.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    hp: PLAYER.hp,
    armor: 0,
    speed: 0,
    inCar: null,
    mag: PLAYER.magSize,
    reserve: 48,
    reloading: 0,
    shootCooldown: 0,
    lastHurtAt: -99,
    moving: false,
  };
}

export function stepPlayer(game, dt) {
  const p = game.player;
  const input = game.input;
  if (p.inCar || game.screen !== 'play') return;
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      const need = PLAYER.magSize - p.mag;
      const take = Math.min(need, p.reserve);
      p.mag += take;
      p.reserve -= take;
      p.reloading = 0;
    }
  }

  // Movement: WASD or arrows, Shift to sprint.
  let dx = 0;
  let dy = 0;
  if (heldMove(input, KEYS.right)) dx += 1;
  if (heldMove(input, KEYS.left)) dx -= 1;
  if (heldMove(input, KEYS.down)) dy += 1;
  if (heldMove(input, KEYS.up)) dy -= 1;
  const sprinting = input.is(KEYS.sprint) || input.is(KEYS.sprintRight);
  const speed = sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  p.moving = dx !== 0 || dy !== 0;
  if (p.moving) {
    const len = Math.hypot(dx, dy);
    p.x += (dx / len) * speed * dt;
    p.y += (dy / len) * speed * dt;
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  collideBuildings(game.city, p, PLAYER.radius);
  clampWorld(p, 20);
  if (inWater(p.x, p.y)) {
    // The Harbour is not swimmable: push Danny back onto the docks.
    p.x = Math.min(p.x, 2390);
  }

  // Aim at the mouse; click to shoot.
  const cam = game.camera;
  const wx = input.mouse.x + cam.x;
  const wy = input.mouse.y + cam.y;
  p.angle = Math.atan2(wy - p.y, wx - p.x);
  if (input.take('reload')) {
    if (p.mag < PLAYER.magSize && p.reserve > 0 && p.reloading <= 0) {
      p.reloading = PLAYER.reloadTime;
    }
  }
  if (input.mouse.down && p.shootCooldown <= 0 && p.reloading <= 0) {
    shootPistol(game);
  }

  // Health and ammo pickups scattered around the city.
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    if (d < PLAYER.pickupRadius) {
      pk.taken = true;
      if (pk.kind === 'health') {
        p.hp = Math.min(PLAYER.hp, p.hp + 30);
        floatText(game.fx, p.x, p.y - 20, '+30 HP', '#7ac74f');
      } else {
        p.reserve = Math.min(PLAYER.reserveMax, p.reserve + 24);
        floatText(game.fx, p.x, p.y - 20, '+24 AMMO', '#e8b73a');
      }
      game.audio.pickup();
    }
  }

  // Shop prompts: standing at a shop and pressing E buys. The garage also
  // serves a car driven up to its door.
  game.shopPrompt = shopNear(game);
  if (game.shopPrompt && input.take('interact')) {
    buyAtShop(game, game.shopPrompt);
  }
}

export function shootPistol(game) {
  const p = game.player;
  if (p.mag <= 0) {
    if (p.reserve > 0) p.reloading = PLAYER.reloadTime;
    return;
  }
  p.mag -= 1;
  p.shootCooldown = PLAYER.shootInterval;
  const gx = p.x + Math.cos(p.angle) * 20;
  const gy = p.y + Math.sin(p.angle) * 20;
  game.bullets.push({
    x: gx, y: gy,
    vx: Math.cos(p.angle) * 900,
    vy: Math.sin(p.angle) * 900,
    from: 'player',
    damage: PLAYER.pistolDamage,
    life: PLAYER.pistolRange / 900,
  });
  burst(game.fx, gx, gy, '#ffd94d', 4, 120);
  game.audio.shot();
  game.addWanted('shoot');
}

function shopNear(game) {
  const p = game.player;
  const at = p.inCar ? p.inCar : p;
  const places = game.cityPlaces;
  for (const key of ['gunshop', 'garage', 'safehouse']) {
    const place = places[key];
    if (Math.hypot(at.x - place.x, at.y - place.y) < place.r + 40) return key;
  }
  return null;
}

function buyAtShop(game, shop) {
  const p = game.player;
  if (shop === 'gunshop') {
    if (p.inCar) return;
    if (game.cash >= PRICES.ammo && p.reserve < PLAYER.reserveMax) {
      game.cash -= PRICES.ammo;
      p.reserve = Math.min(PLAYER.reserveMax, p.reserve + PRICES.ammoPack);
      floatText(game.fx, p.x, p.y - 24, `AMMO +${PRICES.ammoPack}  -$${PRICES.ammo}`, '#e8b73a');
      game.audio.cash();
    } else if (game.cash >= PRICES.armor && p.armor < 100) {
      game.cash -= PRICES.armor;
      p.armor = 100;
      floatText(game.fx, p.x, p.y - 24, `ARMOR  -$${PRICES.armor}`, '#7ac74f');
      game.audio.cash();
    }
  } else if (shop === 'garage') {
    // In a car: repair it. On foot: pay to lay low, one star at a time.
    if (p.inCar) {
      const car = p.inCar;
      if (game.cash >= PRICES.repair && car.hp < car.maxHp) {
        game.cash -= PRICES.repair;
        car.hp = car.maxHp;
        floatText(game.fx, car.x, car.y - 24, `REPAIRED  -$${PRICES.repair}`, '#7ac74f');
        game.audio.cash();
      }
      return;
    }
    if (game.cash >= PRICES.laylow && game.wanted > 0) {
      const cost = PRICES.laylow * game.wanted;
      if (game.cash >= cost) {
        game.cash -= cost;
        game.wanted = 0;
        floatText(game.fx, p.x, p.y - 24, `LAY LOW  -$${cost}`, '#7ac74f');
        game.audio.cash();
      }
    }
  } else if (shop === 'safehouse') {
    if (p.inCar) return;
    p.hp = PLAYER.hp;
    game.wanted = 0;
    floatText(game.fx, p.x, p.y - 24, 'RESTED — HEAT GONE', '#7ac74f');
    game.audio.pickup();
  }
}

// Damage the player, through armor first. Returns true if he is wasted.
export function hurtPlayer(game, dmg) {
  const p = game.player;
  if (game.time - p.lastHurtAt < 0.15) return false;
  p.lastHurtAt = game.time;
  let rest = dmg;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.hp -= rest;
  burst(game.fx, p.x, p.y, '#ff3d3d', 5, 140);
  if (p.hp <= 0) {
    p.hp = 0;
    return true;
  }
  return false;
}
