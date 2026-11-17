// Pedestrians for SOLMAR HEAT: the people of Solmar.
// They stroll the sidewalks, pause at corners to look around, and run when
// something scary happens nearby — a gunshot, an explosion, or a car
// bearing down on them. A ped who is run over stays down for a few seconds
// and then gets up and walks away (the city keeps living), and new peds
// wander in to keep the streets full.

import { PEDS, WORLD } from './config.js';
import { clamp, dist } from './random.js';

const SHIRT_COLORS = ['#e86a5a', '#5a8de8', '#e8c85a', '#7ac05a', '#c05ab8', '#e8e8e8', '#5ac0c0', '#e89a4a'];

/** Fresh ped standing on a sidewalk near a road. */
export function makePed(world, x, y) {
  return {
    x,
    y,
    angle: world.rng.range(0, Math.PI * 2),
    speed: world.rng.range(PEDS.walkMin, PEDS.walkMax),
    state: 'walk',
    /** Seconds left in the current wait or flee. */
    stateTime: world.rng.range(1, 4),
    /** Direction to run in while fleeing; stored on the ped so the flee
     *  branch never reads a danger that has already gone. */
    fleeAngle: 0,
    fleeTime: 0,
    down: false,
    downTime: 0,
    color: world.rng.choose(SHIRT_COLORS),
    walkPhase: world.rng.range(0, Math.PI * 2),
  };
}

/** Fill the sidewalks with walkers, in RNG stream order. */
export function spawnPeds(world, count) {
  for (let i = 0; i < count; i += 1) {
    const road = world.rng.choose(world.city.roads);
    const vertical = world.rng.maybe(0.5);
    const along = world.rng.range(100, WORLD.size - 100);
    const side = world.rng.maybe(0.5) ? 1 : -1;
    const off = WORLD.roadWidth / 2 + 12;
    const x = vertical ? road + side * off : along;
    const y = vertical ? along : road + side * off;
    world.peds.push(makePed(world, x, y));
  }
}

/** The nearest thing that should scare this ped, or null. */
function dangerNear(world, ped) {
  // A live bullet whistling past.
  for (const b of world.bullets) {
    if (dist(ped.x, ped.y, b.x, b.y) < PEDS.scareRadius) return { x: b.x, y: b.y };
  }
  // A fresh explosion (the ring particle marks the blast).
  for (const pt of world.particles) {
    if (pt.ring && pt.life > 0.3 && dist(ped.x, ped.y, pt.x, pt.y) < PEDS.scareRadius + 60) {
      return { x: pt.x, y: pt.y };
    }
  }
  // The player's car, coming in fast.
  const car = world.player.inCar;
  if (car && Math.abs(car.speed) > 200 && dist(ped.x, ped.y, car.x, car.y) < 110) {
    return { x: car.x, y: car.y };
  }
  return null;
}

/** Step one ped. */
function updatePed(world, ped, dt) {
  if (ped.down) {
    ped.downTime -= dt;
    if (ped.downTime <= 0) {
      ped.down = false;
      ped.state = 'walk';
      ped.stateTime = 2;
    }
    return;
  }
  const danger = dangerNear(world, ped);
  if (danger) {
    ped.state = 'flee';
    ped.fleeAngle = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    ped.fleeTime = 2.2;
  }
  if (ped.state === 'flee') {
    ped.fleeTime -= dt;
    const away = ped.fleeAngle;
    ped.x += Math.cos(away) * PEDS.fleeSpeed * dt;
    ped.y += Math.sin(away) * PEDS.fleeSpeed * dt;
    ped.angle = away;
    ped.walkPhase += dt * 11;
    if (ped.fleeTime <= 0) {
      ped.state = 'walk';
      ped.stateTime = world.rng.range(1, 3);
    }
  } else if (ped.state === 'wait') {
    ped.stateTime -= dt;
    if (ped.stateTime <= 0) {
      ped.state = 'walk';
      ped.stateTime = world.rng.range(2, 6);
      ped.angle = world.rng.range(0, Math.PI * 2);
    }
  } else {
    // Stroll: mostly straight, sometimes pausing at a corner.
    ped.stateTime -= dt;
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    ped.walkPhase += dt * 6;
    if (ped.stateTime <= 0) {
      if (world.rng.maybe(0.3)) {
        ped.state = 'wait';
        ped.stateTime = world.rng.range(1, 3);
      } else {
        ped.stateTime = world.rng.range(2, 6);
        ped.angle += world.rng.range(-1.2, 1.2);
      }
    }
    // Drift back toward the nearest sidewalk when wandering off.
    if (!nearSidewalk(world, ped.x, ped.y)) {
      const rx = nearestRoadCoord(world, ped.x);
      const ry = nearestRoadCoord(world, ped.y);
      const dx = Math.abs(ped.x - rx) < Math.abs(ped.y - ry) ? rx - ped.x : 0;
      const dy = dx === 0 ? ry - ped.y : 0;
      const len = Math.hypot(dx, dy) || 1;
      ped.angle = Math.atan2(dy / len, dx / len);
    }
  }
  ped.x = clamp(ped.x, 20, WORLD.size - 20);
  ped.y = clamp(ped.y, 20, WORLD.size - 20);
}

function nearSidewalk(world, x, y) {
  const half = WORLD.roadWidth / 2 + 22;
  for (const r of world.city.roads) {
    if (Math.abs(x - r) <= half || Math.abs(y - r) <= half) return true;
  }
  return false;
}

function nearestRoadCoord(world, v) {
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

/** Step every ped, and top the streets back up when some have left. */
export function updatePeds(world, dt) {
  for (const ped of world.peds) updatePed(world, ped, dt);
  if (world.peds.length < PEDS.count && world.time - (world.lastPedTopUp || 0) > 5) {
    world.lastPedTopUp = world.time;
    spawnPeds(world, 2);
  }
}
