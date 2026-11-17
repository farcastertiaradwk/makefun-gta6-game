// Danny on foot: WASD with sprint, mouse aim, a pistol with a magazine
// and a reload, and getting in and out of cars. Driving lives in
// vehicles.js; this file only walks, shoots and steals.
import { PLAYER } from './config.js';
import { isBlocked, moveCircle } from './city.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: 0,
    radius: PLAYER.radius,
    health: PLAYER.health,
    armor: 0,
    magazine: PLAYER.magazine,
    reserve: 48,
    reloading: 0,
    fireCooldown: 0,
    inCar: null,
    speed: 0,
    moving: false,
  };
}

// Armour takes three fifths of a hit before health takes the rest.
export function hurtPlayer(player, damage) {
  let left = damage;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, left * 0.6);
    player.armor -= absorbed;
    left -= absorbed;
  }
  player.health -= left;
  if (player.health < 0) player.health = 0;
}

function topUpMagazine(player) {
  const need = PLAYER.magazine - player.magazine;
  const take = Math.min(need, player.reserve);
  player.magazine += take;
  player.reserve -= take;
}

function firePistol(world, player) {
  player.magazine -= 1;
  player.fireCooldown = PLAYER.fireInterval;
  const spread = (world.random.next() - 0.5) * 0.08;
  const a = player.angle + spread;
  world.bullets.push({
    x: player.x + Math.cos(a) * 20,
    y: player.y + Math.sin(a) * 20,
    vx: Math.cos(a) * PLAYER.bulletSpeed,
    vy: Math.sin(a) * PLAYER.bulletSpeed,
    damage: PLAYER.pistolDamage,
    from: 'player',
    life: 0.9,
  });
  world.particles.push({
    kind: 'muzzle',
    x: player.x + Math.cos(a) * 22,
    y: player.y + Math.sin(a) * 22,
    vx: 0,
    vy: 0,
    life: 0.08,
    max: 0.08,
    size: 10,
  });
  world.audio.gunshot();
  world.addHeat(0.12);
}

export function updatePlayerOnFoot(world, dt, input, aimWorld) {
  const player = world.player;
  const axis = input.axis();
  const speed = input.shift() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let dx = 0;
  let dy = 0;
  if (axis.x !== 0 || axis.y !== 0) {
    const len = Math.hypot(axis.x, axis.y);
    dx = (axis.x / len) * speed * dt;
    dy = (axis.y / len) * speed * dt;
  }
  player.moving = dx !== 0 || dy !== 0;
  player.speed = player.moving ? speed : 0;
  moveCircle(world.city, player, dx, dy, false);
  player.angle = Math.atan2(aimWorld.y - player.y, aimWorld.x - player.x);

  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) topUpMagazine(player);
  }
  if (player.fireCooldown > 0) player.fireCooldown -= dt;

  // Hold the mouse to fire while the magazine has anything in it.
  if (input.mouseDown && player.fireCooldown <= 0 && player.reloading <= 0) {
    if (player.magazine > 0) {
      firePistol(world, player);
    } else if (player.reserve > 0) {
      player.reloading = PLAYER.reloadTime;
    }
  }
}

// The closest car the player could steal: in reach and not a wreck.
export function nearestStealableCar(world, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of world.cars) {
    if (car.wrecked) continue;
    const d = (car.x - world.player.x) ** 2 + (car.y - world.player.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(world, car) {
  world.player.inCar = car;
  car.kind = 'player';
  car.driver = 'player';
  if (car.parked) {
    car.parked = false;
    world.addHeat(1);
    world.floatText(car.x, car.y - 30, 'CAR STOLEN', '#ff5a5a');
    world.stats.carsStolen += 1;
  }
  world.audio.pickup();
}

export function exitCar(world) {
  const car = world.player.inCar;
  if (!car) return;
  // Step out on whichever side is not inside a building.
  let px = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  let py = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  if (isBlocked(world.city, px, py, 14, false)) {
    px = car.x + Math.cos(car.angle - Math.PI / 2) * 34;
    py = car.y + Math.sin(car.angle - Math.PI / 2) * 34;
  }
  world.player.x = px;
  world.player.y = py;
  world.player.inCar = null;
  car.kind = car.wasTraffic ? 'traffic' : 'parked';
  car.driver = car.wasTraffic ? 'traffic' : null;
}
