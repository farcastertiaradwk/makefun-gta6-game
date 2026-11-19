// Pedestrians of Solmar: they stroll the sidewalks, wait at corners,
// and run from gunfire and explosions. A fleeing ped remembers the
// direction it ran in (fleeAngle) instead of re-reading the danger
// every frame, so a vanished danger never crashes the update.
import { CFG } from './config.js';

export function spawnPeds(world) {
  const rng = world.rng;
  const out = [];
  const tones = ['#e8b88a', '#c98d5f', '#8a5a3b', '#f0c8a0'];
  const shirts = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#ecf0f1'];
  for (let i = 0; i < CFG.ped.count; i++) {
    const x = rng.range(120, CFG.world.w - 120);
    const y = rng.range(120, CFG.world.h - 120);
    out.push({
      x, y, angle: rng.range(0, Math.PI * 2), speed: 0,
      state: 'walk', waitAt: rng.range(2, 9), fleeAngle: 0,
      tone: rng.pick(tones), shirt: rng.pick(shirts),
    });
  }
  return out;
}

function dangerNear(world, ped) {
  // gunfire: a fresh player shot nearby
  if (world.lastShotAt !== undefined && world.time - world.lastShotAt < 0.6) {
    const p = world.player;
    if (Math.hypot(p.x - ped.x, p.y - ped.y) < 320) return { x: p.x, y: p.y };
  }
  for (const b of world.bullets) {
    if (Math.hypot(b.x - ped.x, b.y - ped.y) < 120) return { x: b.x, y: b.y };
  }
  for (const e of world.booms) {
    if (Math.hypot(e.x - ped.x, e.y - ped.y) < 260) return { x: e.x, y: e.y };
  }
  return null;
}

export function stepPeds(world, dt) {
  for (const ped of world.peds) {
    const danger = dangerNear(world, ped);
    if (danger) {
      ped.state = 'flee';
      ped.fleeAngle = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    }
    if (ped.state === 'flee') {
      ped.speed = CFG.ped.flee;
      ped.angle = ped.fleeAngle;
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (!danger && world.rng.chance(dt * 0.25)) ped.state = 'walk';
    } else if (ped.state === 'walk') {
      ped.waitAt -= dt;
      if (ped.waitAt <= 0) {
        ped.state = 'wait';
        ped.waitAt = world.rng.range(1, 4);
      } else {
        ped.speed = CFG.ped.walk;
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (world.rng.chance(dt * 0.2)) ped.angle = world.rng.range(0, Math.PI * 2);
      }
    } else {
      ped.waitAt -= dt;
      if (ped.waitAt <= 0) {
        ped.state = 'walk';
        ped.waitAt = world.rng.range(3, 10);
        ped.angle = world.rng.range(0, Math.PI * 2);
      }
    }
    ped.x = Math.max(16, Math.min(CFG.world.w - 16, ped.x));
    ped.y = Math.max(16, Math.min(CFG.world.h - 16, ped.y));
  }
}

// A vehicle running a ped over: the ped is knocked down and the driver
// earns a star. Returns true when a hit happened this frame.
export function checkRunOvers(world) {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  for (const ped of world.peds) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 120) {
      ped.down = true;
      ped.downAt = world.time;
      world.police.addWanted(world, 1);
      world.effects.blood(ped.x, ped.y);
    }
  }
  for (const ped of world.peds) {
    if (ped.down && world.time - ped.downAt > 6) {
      ped.down = false;
      ped.x = world.rng.range(120, CFG.world.w - 120);
      ped.y = world.rng.range(120, CFG.world.h - 120);
      ped.state = 'walk';
    }
  }
}
