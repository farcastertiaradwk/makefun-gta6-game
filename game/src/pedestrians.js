// Pedestrians: they stroll the sidewalks, cross at intersections, and run from
// gunfire, explosions and speeding cars. A pedestrian hit by a car is a crime;
// one shot is a bigger one. They are what makes the city feel alive.
import { PED_SPEED, PED_FLEE_SPEED, WORLD, BEACH_Y } from './config.js';
import { moveCircle, nearestRoad, onRoad } from './city.js';

const SHIRTS = ['#e67e22', '#3498db', '#9b59b6', '#1abc9c', '#f1c40f', '#e84393', '#95a5a6', '#d35400'];

export function createPed(random, city) {
  // Spawn on a sidewalk: just off a road line, inside the world.
  const road = nearestRoad(random.range(120, WORLD.w - 120), random.range(120, BEACH_Y - 60));
  let x;
  let y;
  if (road.axis === 'x') {
    x = road.at + (random.chance(0.5) ? -58 : 58);
    y = random.range(120, BEACH_Y - 60);
  } else {
    x = random.range(120, WORLD.w - 120);
    y = road.at + (random.chance(0.5) ? -58 : 58);
  }
  return {
    x, y,
    angle: random.range(0, Math.PI * 2),
    radius: 11,
    speed: PED_SPEED * random.range(0.8, 1.2),
    shirt: random.pick(SHIRTS),
    state: 'walk', // 'walk' | 'flee' | 'down'
    stateTime: 0,
    target: null,
    downTimer: 0,
  };
}

export function spawnPeds(world, count) {
  for (let i = 0; i < count; i += 1) {
    world.peds.push(createPed(world.random, world.city));
  }
}

function pickSidewalkTarget(ped, random) {
  // Walk to a random nearby point on a sidewalk, then re-pick there.
  const road = nearestRoad(ped.x, ped.y);
  if (road.axis === 'x') {
    return {
      x: road.at + (ped.x < road.at ? -58 : 58),
      y: Math.max(100, Math.min(BEACH_Y - 40, ped.y + random.range(-320, 320))),
    };
  }
  return {
    x: Math.max(100, Math.min(WORLD.w - 100, ped.x + random.range(-320, 320))),
    y: road.at + (ped.y < road.at ? -58 : 58),
  };
}

export function updatePeds(world, dt) {
  for (const ped of world.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      continue;
    }
    // Danger nearby: gunfire, an explosion, or a fast car heading at them.
    let danger = null;
    if (world.lastShotAt && world.time - world.lastShotAt < 0.8) {
      const d = Math.hypot(ped.x - world.lastShotX, ped.y - world.lastShotY);
      if (d < 260) danger = { x: world.lastShotX, y: world.lastShotY };
    }
    if (world.lastExplosionAt && world.time - world.lastExplosionAt < 1.2) {
      const d = Math.hypot(ped.x - world.lastExplosionX, ped.y - world.lastExplosionY);
      if (d < 320) danger = { x: world.lastExplosionX, y: world.lastExplosionY };
    }
    if (danger) {
      ped.state = 'flee';
      ped.fleeAngle = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    }
    if (ped.state === 'flee') {
      ped.stateTime += dt;
      const away = ped.fleeAngle ?? 0;
      ped.angle = away;
      moveCircle(world.city, ped, Math.cos(away) * PED_FLEE_SPEED * dt, Math.sin(away) * PED_FLEE_SPEED * dt, false);
      if (ped.stateTime > 3) { ped.state = 'walk'; ped.stateTime = 0; ped.target = null; }
      continue;
    }
    // Stroll: pick a sidewalk point, walk to it, pick another.
    if (!ped.target) ped.target = pickSidewalkTarget(ped, world.random);
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) { ped.target = null; continue; }
    ped.angle = Math.atan2(dy, dx);
    moveCircle(world.city, ped, (dx / dist) * ped.speed * dt, (dy / dist) * ped.speed * dt, false);
  }
  // The dead and the fled fade out; fresh walkers keep the streets full.
  world.peds = world.peds.filter((p) => p.state !== 'down' || p.downTimer > 0);
  while (world.peds.length < 22) world.peds.push(createPed(world.random, world.city));
}

/** A car running a pedestrian over: the pedestrian goes down, the law notices. */
export function checkRunOver(world) {
  for (const car of world.cars) {
    if (car.wrecked || Math.abs(car.speed) < 120) continue;
    for (const ped of world.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 26) {
        ped.state = 'down';
        ped.downTimer = 6;
        world.floatText(ped.x, ped.y - 20, 'PEDESTRIAN DOWN', '#ff5a5a');
        if (car.kind === 'player') {
          world.addHeat(1);
          world.stats.pedsHit += 1;
        }
      }
    }
  }
}

/** Bullets hit pedestrians: they go down and it counts as a crime. */
export function checkBulletHitPed(world, bullet) {
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - bullet.x, ped.y - bullet.y);
    if (d < 14) {
      ped.state = 'down';
      ped.downTimer = 6;
      if (bullet.from === 'player') {
        world.addHeat(2);
        world.stats.pedsHit += 1;
      }
      return true;
    }
  }
  return false;
}
