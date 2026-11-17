// The law: a wanted level from 0 to 5 stars, foot cops who chase and
// arrest, police cars that ram, and a helicopter from 4 stars up. Heat
// rises with crime and cools when the player stays clean and unseen.
import { POLICE, WANTED, WORLD } from './config.js';
import { createCar } from './vehicles.js';
import { moveCircle } from './city.js';
import { hurtPlayer } from './player.js';

export function createCop(x, y) {
  return {
    x,
    y,
    angle: 0,
    radius: 13,
    health: 50,
    shootCooldown: 0,
    bustTimer: 0,
  };
}

function spawnOffscreen(world) {
  // Spawn just outside the camera's view, on a road near the player.
  const p = world.player;
  const angle = world.random.range(0, Math.PI * 2);
  const x = Math.max(40, Math.min(WORLD.w - 40, p.x + Math.cos(angle) * 700));
  const y = Math.max(40, Math.min(WORLD.h - 40, p.y + Math.sin(angle) * 700));
  return { x, y };
}

function nearestLaw(world) {
  let best = Infinity;
  for (const cop of world.cops) {
    best = Math.min(best, Math.hypot(cop.x - world.player.x, cop.y - world.player.y));
  }
  for (const car of world.cars) {
    if (car.kind !== 'police') continue;
    best = Math.min(best, Math.hypot(car.x - world.player.x, car.y - world.player.y));
  }
  return best;
}

function coolHeat(world) {
  // Staying clean and out of sight cools the heat, one star at a time.
  const now = world.time;
  if (world.wanted > 0
    && now - world.lastCrimeAt > WANTED.decaySeconds
    && nearestLaw(world) > WANTED.decayRange) {
    world.heat = Math.max(0, world.heat - 1);
    world.wanted = Math.floor(world.heat);
    world.lastCrimeAt = now;
    world.floatText(world.player.x, world.player.y - 34, 'HEAT COOLING…', '#9fd8ff');
  }
}

function watchHeli(world, dt) {
  // A helicopter at 4 stars keeps the heat on: it never cools while it watches.
  if (world.wanted >= 4 && !world.heli) {
    world.heli = { angle: 0, radius: 150 };
  } else if (world.wanted < 4) {
    world.heli = null;
  }
  if (world.heli) {
    world.heli.angle += dt * 0.5;
    world.lastCrimeAt = world.time; // watched: no cooling
  }
}

function sendBackup(world, dt) {
  // Keep the right number of cops on the street for the current heat.
  const wantCops = world.wanted >= 1 ? Math.min(2 + world.wanted, 7) : 0;
  const wantCars = world.wanted >= 2 ? Math.min(world.wanted - 1, 4) : 0;
  world.spawnTimer -= dt;
  if (world.spawnTimer > 0) return;
  world.spawnTimer = POLICE.spawnInterval;
  if (world.cops.length < wantCops) {
    const at = spawnOffscreen(world);
    world.cops.push(createCop(at.x, at.y));
  }
  const policeCars = world.cars.filter((c) => c.kind === 'police' && !c.wrecked).length;
  if (policeCars < wantCars) {
    const at = spawnOffscreen(world);
    const car = createCar(at.x, at.y, world.random.range(0, Math.PI * 2), '#2e5fa3', 'police');
    car.speed = 200;
    world.cars.push(car);
  }
}

export function updateWanted(world, dt) {
  coolHeat(world);
  watchHeli(world, dt);
  sendBackup(world, dt);
  // Sirens while any police is close.
  const sirenOn = world.wanted > 0 && nearestLaw(world) < 900;
  world.audio.setSiren(sirenOn);
}

function copFires(world, cop, dist, dt) {
  // Shoot from 2 stars up, badly on purpose.
  if (world.wanted < 2 || dist >= POLICE.footShootRange || world.player.inCar) return;
  cop.shootCooldown -= dt;
  if (cop.shootCooldown > 0) return;
  cop.shootCooldown = POLICE.footShootInterval * (0.8 + world.random.next() * 0.5);
  const spread = (world.random.next() - 0.5) * 0.35;
  const a = cop.angle + spread;
  world.bullets.push({
    x: cop.x + Math.cos(a) * 20,
    y: cop.y + Math.sin(a) * 20,
    vx: Math.cos(a) * 520,
    vy: Math.sin(a) * 520,
    damage: 7,
    from: 'cop',
    life: 0.8,
  });
  world.audio.gunshot();
}

export function updateCops(world, dt) {
  const player = world.player;
  for (const cop of world.cops) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    // Chase on foot, sliding around buildings.
    if (dist > 26) {
      moveCircle(world.city, cop, (dx / dist) * POLICE.footSpeed * dt, (dy / dist) * POLICE.footSpeed * dt, false);
    }
    // Arrest: a cop standing on the player while wanted ends the run.
    if (dist < POLICE.bustRange && !player.inCar && world.wanted >= 1) {
      cop.bustTimer += dt;
      if (cop.bustTimer >= POLICE.bustSeconds) {
        world.busted();
        return;
      }
    } else {
      cop.bustTimer = 0;
    }
    copFires(world, cop, dist, dt);
  }
  // A cop the player shoots goes down and the heat jumps.
  for (const cop of world.cops) {
    if (cop.health <= 0 && !cop.dead) {
      cop.dead = true;
      world.addHeat(2);
      world.stats.copsDown += 1;
      world.floatText(cop.x, cop.y - 20, 'OFFICER DOWN', '#ff5a5a');
    }
  }
  world.cops = world.cops.filter((c) => !c.dead);
}

export function updateHeli(world, dt) {
  if (!world.heli) return;
  const p = world.player;
  const hx = p.x + Math.cos(world.heli.angle) * world.heli.radius;
  const hy = p.y + Math.sin(world.heli.angle) * world.heli.radius;
  world.heli.x = hx;
  world.heli.y = hy;
}
