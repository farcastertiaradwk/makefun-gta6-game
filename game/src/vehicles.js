// Cars for SOLMAR HEAT: the player's ride, city traffic and police cars.
// One physics model drives them all — acceleration, steering that bites
// harder the slower you go, a handbrake that loosens the rear — with traffic
// cars following the road grid and turning at intersections. Stealing is an
// E press next to a parked car; it is a crime (+1 wanted) and, on mission 1,
// the moment the job truly starts. Collisions push cars apart and chip
// paint, but the damage is rate-limited per car: one long scrape is one
// crash, not sixty frames of it.

import { CARS, WORLD, PALETTE, POLICE } from './config.js';
import { clamp, dist, wrapAngle, angleDelta } from './random.js';
import { explode, burst, smoke } from './effects.js';

let uidCounter = 1;

/** A fresh car of any kind. */
export function makeCar(kind, x, y, angle, color) {
  const car = {
    id: uidCounter,
    kind,
    x,
    y,
    angle,
    speed: 0,
    health: kind === 'police' ? POLICE.carHealth : CARS.maxHealth,
    color: color || '#c23b2e',
    name: kind === 'police' ? 'Interceptor' : 'Sedan',
    wrecked: false,
    /** Seconds until this car can take collision damage again. */
    hitCooldown: 0,
    /** Traffic-only: which way it is heading along the grid. */
    dir: angle,
    /** Traffic-only: seconds until it may turn at an intersection. */
    turnTimer: 0,
    /** Police-only: seconds until the next ram check. */
    ramTimer: 0,
    smoked: false,
  };
  uidCounter += 1;
  return car;
}

/** Spawn the roaming traffic, in RNG stream order. */
export function spawnTraffic(world, count) {
  for (let i = 0; i < count; i += 1) {
    const road = world.rng.choose(world.city.roads);
    const vertical = world.rng.maybe(0.5);
    const along = world.rng.range(120, WORLD.size - 120);
    const angle = world.rng.choose([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const x = vertical ? road : along;
    const y = vertical ? along : road;
    const car = makeCar('traffic', x, y, angle, world.rng.choose(PALETTE.carColors));
    car.speed = world.rng.range(CARS.trafficMin, CARS.trafficMax);
    car.dir = angle;
    world.cars.push(car);
  }
}

/** Park cars in the city's pre-generated slots, in slot order. */
export function spawnParked(world, count) {
  const spots = world.city.parkedSpots;
  for (let i = 0; i < Math.min(count, spots.length); i += 1) {
    const s = spots[i];
    const car = makeCar('parked', s.x, s.y, s.angle, world.rng.choose(PALETTE.carColors));
    world.cars.push(car);
  }
}

/** The player's car physics: W/S accelerate and brake, A/D steer, Space handbrakes. */
function drivePlayerCar(world, dt) {
  const car = world.player.inCar;
  if (!car || car.wrecked) return;
  const input = world.input;
  const fwd = input.isDown(['KeyW', 'ArrowUp']) ? 1 : 0;
  const back = input.isDown(['KeyS', 'ArrowDown']) ? 1 : 0;
  const handbrake = input.isDown(['Space']);
  if (fwd) car.speed += CARS.accel * dt;
  else if (back) {
    if (car.speed > 5) car.speed -= CARS.brake * dt;
    else car.speed -= CARS.accel * 0.45 * dt;
  } else {
    // Rolling resistance + engine braking.
    car.speed -= car.speed * 0.55 * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CARS.reverseSpeed, CARS.topSpeed);
  const steer = (input.isDown(['KeyA', 'ArrowLeft']) ? -1 : 0) + (input.isDown(['KeyD', 'ArrowRight']) ? 1 : 0);
  const grip = handbrake ? CARS.handbrakeGrip : 1;
  const turnAuthority = clamp(Math.abs(car.speed) / 120, 0, 1);
  car.angle += steer * CARS.steerRate * turnAuthority * grip * dt * (car.speed >= 0 ? 1 : -1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const blocked = collideCarWorld(world, car, nx, ny);
  car.x = blocked.x;
  car.y = blocked.y;
  if (blocked.hit) {
    car.speed *= 0.45;
    car.health -= 4;
    burst(world, car.x, car.y, 5, '#ffb347', 160, 0.3);
  }
  // Off-road driving is slower and rougher.
  if (!onRoadAt(world, car.x, car.y) && Math.abs(car.speed) > 200) {
    car.speed -= 60 * dt;
  }
  if (car.health <= 0 && !car.wrecked) wreckCar(world, car);
  if (car.health < 35 && !car.smoked) {
    car.smoked = true;
    smoke(world, car.x, car.y, false);
  }
  world.player.x = car.x;
  world.player.y = car.y;
}

/** Is a point on asphalt? */
function onRoadAt(world, x, y) {
  const half = WORLD.roadWidth / 2;
  for (const r of world.city.roads) {
    if (Math.abs(x - r) <= half || Math.abs(y - r) <= half) return true;
  }
  return false;
}

/** Keep a car out of buildings, water and the world edge. */
function collideCarWorld(world, car, x, y) {
  const r = 16;
  let nx = clamp(x, r + 8, WORLD.size - r - 8);
  let ny = clamp(y, r + 8, WORLD.size - r - 8);
  let hit = false;
  if (nx >= 2440 - r) {
    let onPier = false;
    for (const pier of world.city.piers) {
      if (ny >= pier.y && ny <= pier.y + pier.h) onPier = true;
    }
    if (!onPier) {
      nx = 2440 - r;
      hit = true;
    }
  }
  for (const block of world.city.blocks) {
    for (const b of block.buildings) {
      if (nx + r > b.x && nx - r < b.x + b.w && ny + r > b.y && ny - r < b.y + b.h) {
        const pl = nx + r - b.x;
        const pr = b.x + b.w - (nx - r);
        const pu = ny + r - b.y;
        const pd = b.y + b.h - (ny - r);
        const min = Math.min(pl, pr, pu, pd);
        if (min === pl) nx = b.x - r;
        else if (min === pr) nx = b.x + b.w + r;
        else if (min === pu) ny = b.y - r;
        else ny = b.y + b.h + r;
        hit = true;
      }
    }
  }
  return { x: nx, y: ny, hit };
}

/** Traffic AI: cruise along the road, turn at intersections sometimes. */
function driveTrafficCar(world, car, dt) {
  if (car.wrecked) return;
  car.turnTimer -= dt;
  const nearX = nearestRoad(world, car.x);
  const nearY = nearestRoad(world, car.y);
  const atCrossing = Math.abs(car.x - nearX) < 26 && Math.abs(car.y - nearY) < 26;
  if (atCrossing && car.turnTimer <= 0) {
    car.turnTimer = world.rng.range(2, 5);
    if (world.rng.maybe(0.45)) {
      // Turn left or right at the crossing.
      const turn = world.rng.maybe(0.5) ? Math.PI / 2 : -Math.PI / 2;
      car.dir = wrapAngle(car.dir + turn);
    }
  }
  // Steer gently back onto the road centre line.
  const target = car.dir;
  const d = angleDelta(car.angle, target);
  car.angle += clamp(d, -1.4 * dt, 1.4 * dt);
  const speed = clamp(car.speed, CARS.trafficMin, CARS.trafficMax);
  car.speed = speed;
  const nx = car.x + Math.cos(car.angle) * speed * dt;
  const ny = car.y + Math.sin(car.angle) * speed * dt;
  const blocked = collideCarWorld(world, car, nx, ny);
  car.x = blocked.x;
  car.y = blocked.y;
  if (blocked.hit) {
    // Bounced off a building: turn around and carry on.
    car.dir = wrapAngle(car.dir + Math.PI);
    car.angle = car.dir;
  }
  if (car.health <= 0 && !car.wrecked) wreckCar(world, car);
}

function nearestRoad(world, v) {
  let best = world.city.roads[0];
  let bestD = Infinity;
  for (const r of world.city.roads) {
    const d = Math.abs(v - r);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

/** A wrecked car: smoke, a small explosion, and it never drives again. */
export function wreckCar(world, car) {
  car.wrecked = true;
  car.speed = 0;
  explode(world, car.x, car.y, false);
  if (world.player.inCar === car) {
    world.player.inCar = null;
  }
}

/** Push overlapping cars apart; a hard hit chips paint off both, once per cooldown. */
export function collideCars(world) {
  const cars = world.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = 34;
      if (d >= minD || d === 0) continue;
      const push = (minD - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      a.x -= ux * push;
      a.y -= uy * push;
      b.x += ux * push;
      b.y += uy * push;
      const impact = Math.abs(a.speed - b.speed) + 40;
      // Damage is rate-limited per car so one long scrape is one crash, not sixty.
      if (impact > CARS.scrapeSpeed && world.time - (a.lastHitAt || -10) > CARS.hitCooldown && world.time - (b.lastHitAt || -10) > CARS.hitCooldown) {
        a.lastHitAt = world.time;
        b.lastHitAt = world.time;
        a.health -= CARS.hitDamage;
        b.health -= CARS.hitDamage;
        burst(world, (a.x + b.x) / 2, (a.y + b.y) / 2, 6, '#ffb347', 180, 0.3);
        world.audio.tone(120, 0.1, 'square', 0.1, 60);
        if (a.health <= 0 && !a.wrecked) wreckCar(world, a);
        if (b.health <= 0 && !b.wrecked) wreckCar(world, b);
      }
      // A hard shunt slows both cars down.
      a.speed *= 0.92;
      b.speed *= 0.92;
    }
  }
}

/** Run over pedestrians with the player's car. */
export function runOverPeds(world) {
  const car = world.player.inCar;
  if (!car) return;
  for (const ped of world.peds) {
    if (ped.down) continue;
    if (Math.abs(car.speed) < 60) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 26) {
      ped.down = true;
      ped.downTime = 4;
      burst(world, ped.x, ped.y, 8, '#ff5a4d', 200, 0.5);
      if (world.time - (world.lastRunoverHeatAt || -99) > 3) {
        world.lastRunoverHeatAt = world.time;
        if (world.wanted < 5) world.wanted += 1;
      }
    }
  }
}

/** Steal the nearest parked car (E on foot). Returns the car or null. */
export function stealCar(world) {
  const p = world.player;
  if (p.inCar) return null;
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
  if (!best) return null;
  best.kind = 'player';
  p.inCar = best;
  p.x = best.x;
  p.y = best.y;
  world.audio.tone(300, 0.08, 'square', 0.1, 520);
  if (world.wanted < 5) world.wanted += 1;
  return best;
}

/** Get out of the car (E while driving). */
export function exitCar(world) {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  p.inCar = null;
  car.speed = 0;
  // Step out to the side of the car.
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  const spot = collideWorldSpot(world, p.x, p.y);
  p.x = spot.x;
  p.y = spot.y;
}

/** Nudge a point out of a building (used when stepping out of a car). */
function collideWorldSpot(world, x, y) {
  const r = 13;
  let nx = clamp(x, r + 8, WORLD.size - r - 8);
  let ny = clamp(y, r + 8, WORLD.size - r - 8);
  for (const block of world.city.blocks) {
    for (const b of block.buildings) {
      if (nx + r > b.x && nx - r < b.x + b.w && ny + r > b.y && ny - r < b.y + b.h) {
        ny = b.y + b.h + r + 2;
      }
    }
  }
  return { x: nx, y: ny };
}

/** Step every car: the player's, traffic, police (police AI lives in police.js). */
export function updateCars(world, dt) {
  for (const car of world.cars) {
    if (car.hitCooldown > 0) car.hitCooldown -= dt;
    if (car === world.player.inCar) {
      drivePlayerCar(world, dt);
    } else if (car.kind === 'traffic') {
      driveTrafficCar(world, car, dt);
    }
    // Parked, player-owned (when on foot) and police cars sit still unless
    // their own module moves them.
  }
  collideCars(world);
  runOverPeds(world);
}

/** How many cars of a kind are on the road. */
export function countCars(world, kind) {
  let n = 0;
  for (const car of world.cars) if (car.kind === kind) n += 1;
  return n;
}
