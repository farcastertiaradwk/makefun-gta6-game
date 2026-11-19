// The Solmar PD: a wanted level from 0 to 5 stars. Foot cops chase and,
// at two stars and up, shoot; police cars join at two stars and ram at
// three; roadblocks appear at three; the helicopter with its spotlight
// circles at four and five. Out of sight, the heat slowly cools — and
// the Safehouse wipes it clean.
import { CFG } from './config.js';
import { makeVehicle, wreckCar } from './vehicles.js';
import { hurtPlayer } from './player.js';

export function addWanted(world, n) {
  world.wanted = Math.max(0, Math.min(5, world.wanted + n));
  world.heatTimer = 0;
}

export function setWanted(world, n) {
  world.wanted = Math.max(0, Math.min(5, n));
  world.heatTimer = 0;
}

function spawnCop(world) {
  const p = world.player;
  const a = world.rng.range(0, Math.PI * 2);
  const d = world.rng.range(420, 560);
  const x = Math.max(40, Math.min(CFG.world.w - 40, p.x + Math.cos(a) * d));
  const y = Math.max(40, Math.min(CFG.world.h - 40, p.y + Math.sin(a) * d));
  world.cops.push({ x, y, hp: CFG.police.copHp, shootAt: world.time + world.rng.range(0, 1), speed: CFG.police.copSpeed });
}

function spawnCopCar(world) {
  const p = world.player;
  const a = world.rng.range(0, Math.PI * 2);
  const d = world.rng.range(500, 650);
  const car = makeVehicle('car', Math.max(60, Math.min(CFG.world.w - 60, p.x + Math.cos(a) * d)), Math.max(60, Math.min(CFG.world.h - 60, p.y + Math.sin(a) * d)), a, '#2c3e50');
  car.driver = 'cop';
  car.speed = 300;
  world.cars.push(car);
  world.copCars.push(car);
}

export function stepPolice(world, dt) {
  const p = world.player;
  const w = world.wanted;
  // spawn pressure follows the wanted level
  const wantCops = w === 0 ? 0 : Math.min(CFG.police.maxCops, 1 + w);
  while (world.cops.length < wantCops) spawnCop(world);
  const wantCars = w < 2 ? 0 : Math.min(CFG.police.maxCars, w - 1);
  while (world.copCars.length < wantCars) spawnCopCar(world);
  // prune the force when the heat drops
  while (world.cops.length > wantCops) world.cops.pop();
  while (world.copCars.length > wantCars) {
    const car = world.copCars.pop();
    car.driver = 'parked';
  }
  // roadblocks at 3+ stars: two cars across the road ahead of the player
  if (w >= 3 && world.roadblocks.length === 0 && p.inCar) {
    const a = p.inCar.angle;
    const bx = p.x + Math.cos(a) * 520;
    const by = p.y + Math.sin(a) * 520;
    const px = Math.cos(a + Math.PI / 2);
    const py = Math.sin(a + Math.PI / 2);
    for (const s of [-46, 46]) {
      const car = makeVehicle('car', bx + px * s, by + py * s, a + Math.PI / 2, '#2c3e50');
      car.driver = 'parked';
      world.cars.push(car);
      world.roadblocks.push(car);
    }
  }
  if (w < 3 && world.roadblocks.length) {
    for (const car of world.roadblocks) car.driver = 'parked';
    world.roadblocks = [];
  }
  // helicopter at 4-5 stars
  if (w >= 4 && !world.heli) world.heli = { x: p.x, y: p.y - 260, angle: 0 };
  if (w < 4) world.heli = null;
  if (world.heli) {
    const h = world.heli;
    h.angle += dt * 0.5;
    h.x += (p.x - h.x) * Math.min(1, dt * 0.8);
    h.y += (p.y - 240 - h.y) * Math.min(1, dt * 0.8);
  }
  // foot cops: chase, and shoot at 2+ stars inside range
  for (const cop of world.cops) {
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    const a = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.x += Math.cos(a) * cop.speed * dt;
    cop.y += Math.sin(a) * cop.speed * dt;
    if (w >= 2 && d < CFG.police.shootRange && world.time >= cop.shootAt) {
      cop.shootAt = world.time + CFG.police.shootEvery;
      const spread = (world.rng.next() - 0.5) * 0.3;
      const aa = a + spread;
      world.bullets.push({
        x: cop.x + Math.cos(aa) * 20, y: cop.y + Math.sin(aa) * 20,
        vx: Math.cos(aa) * 780, vy: Math.sin(aa) * 780,
        life: 0.9, from: 'cop', damage: CFG.police.bulletDamage,
      });
      world.audio.enemyShot();
    }
    // busted: a cop reaches the player on foot
    if (!p.inCar && d < 26) world.toScreen('busted');
  }
  // heat decay: unseen for a while, one star cools off
  let seen = false;
  for (const cop of world.cops) {
    if (Math.hypot(p.x - cop.x, p.y - cop.y) < CFG.police.decayRange) { seen = true; break; }
  }
  if (!seen) {
    for (const car of world.copCars) {
      if (Math.hypot(p.x - car.x, p.y - car.y) < CFG.police.decayRange) { seen = true; break; }
    }
  }
  if (!seen && w > 0) {
    world.heatTimer += dt;
    if (world.heatTimer > CFG.police.decaySecs) {
      world.heatTimer = 0;
      addWanted(world, -1);
    }
  } else {
    world.heatTimer = 0;
  }
  // safehouse clears the heat
  const sh = CFG.places.safehouse;
  if (Math.hypot(p.x - sh.x, p.y - sh.y) < 110 && w > 0) setWanted(world, 0);
}

// Cop bullets and player bullets resolve here; enemies are handled by
// missions.js, which owns their health.
export function stepBullets(world, dt) {
  const p = world.player;
  for (const b of world.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.from === 'cop') {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < (p.inCar ? 30 : 16)) {
        b.life = 0;
        if (p.inCar) {
          p.inCar.hp -= b.damage;
          if (p.inCar.hp <= 0) wreckCar(world, p.inCar);
        } else {
          hurtPlayer(world, b.damage);
        }
      }
    } else if (b.from === 'player') {
      for (const cop of world.cops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 18) {
          b.life = 0;
          cop.hp -= b.damage;
          if (cop.hp <= 0) {
            world.cops.splice(world.cops.indexOf(cop), 1);
            addWanted(world, 1);
            world.floats.push({ x: cop.x, y: cop.y - 20, text: 'COP DOWN', life: 1.2, color: '#ff6b6b' });
          }
          break;
        }
      }
      if (b.life > 0) {
        for (const car of world.cars) {
          if (car.driver === 'player' || car.wrecked) continue;
          if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
            b.life = 0;
            car.hp -= b.damage;
            break;
          }
        }
      }
      if (b.life > 0) {
        for (const e of world.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) < 20) {
            b.life = 0;
            e.hp -= b.damage;
            world.effects.hit(e.x, e.y);
            break;
          }
        }
      }
    } else if (b.from === 'enemy') {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < (p.inCar ? 30 : 16)) {
        b.life = 0;
        if (p.inCar) {
          p.inCar.hp -= b.damage;
          if (p.inCar.hp <= 0) wreckCar(world, p.inCar);
        } else {
          hurtPlayer(world, b.damage);
        }
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0 && b.x > -50 && b.x < CFG.world.w + 50 && b.y > -50 && b.y < CFG.world.h + 50);
}
