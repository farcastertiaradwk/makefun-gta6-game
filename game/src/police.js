// The law in Solmar: the wanted system and the police who answer it.
// Wanted runs 0 to 5 stars. Crimes add heat; the police respond in kind —
// foot cops chase and (from 2 stars) shoot, police cars join at 2 stars and
// ram at 3, roadblocks go up at 3, and the helicopter with its spotlight
// circles from 4. Wanted fades when the cops lose sight of Danny, and the
// Safehouse (or a lay-low payment at the garage) clears it outright.
// Get caught on foot and it is Busted; run out of health and it is Wasted.

import { POLICE, WORLD, PLACES } from './config.js';
import { clamp, dist, wrapAngle, angleDelta } from './random.js';
import { makeCar } from './vehicles.js';
import { burst, damagePlayer } from './effects.js';

/** Add heat, capped at five stars. */
export function addWanted(world, n) {
  world.wanted = clamp(world.wanted + n, 0, POLICE.maxWanted);
  world.lastCrimeAt = world.time;
}

/** Set the wanted level outright (missions use this for scripted heat). */
export function setWanted(world, n) {
  world.wanted = clamp(n, 0, POLICE.maxWanted);
  world.lastCrimeAt = world.time;
}

/** A foot cop, spawned at the edge of view and sent after the player. */
export function spawnCop(world) {
  const p = world.player;
  const a = world.rng.range(0, Math.PI * 2);
  const r = world.rng.range(520, 700);
  const cop = {
    x: clamp(p.x + Math.cos(a) * r, 30, WORLD.size - 30),
    y: clamp(p.y + Math.sin(a) * r, 30, WORLD.size - 30),
    angle: 0,
    speed: POLICE.copSpeed,
    health: POLICE.copHealth,
    shootTimer: world.rng.range(0.5, 1.5),
    arrestTimer: 0,
    walkPhase: world.rng.range(0, Math.PI * 2),
  };
  world.cops.push(cop);
  return cop;
}

/** A police car, spawned on a road behind the player. */
export function spawnPoliceCar(world) {
  const p = world.player;
  const a = world.rng.range(0, Math.PI * 2);
  const r = world.rng.range(480, 640);
  const x = clamp(p.x + Math.cos(a) * r, 40, WORLD.size - 40);
  const y = clamp(p.y + Math.sin(a) * r, 40, WORLD.size - 40);
  const car = makeCar('police', x, y, Math.atan2(p.y - y, p.x - x), POLICE_COLOR);
  car.speed = POLICE.carSpeed * 0.8;
  world.cars.push(car);
  return car;
}

const POLICE_COLOR = '#20242e';

/** Two police cars parked across the road ahead of the player. */
export function spawnRoadblock(world) {
  const p = world.player;
  const ahead = p.inCar ? p.inCar.angle : p.angle;
  const bx = p.x + Math.cos(ahead) * 420;
  const by = p.y + Math.sin(ahead) * 420;
  const perp = ahead + Math.PI / 2;
  for (const side of [-1, 1]) {
    const car = makeCar('police', bx + Math.cos(perp) * side * 42, by + Math.sin(perp) * side * 42, perp, POLICE_COLOR);
    car.speed = 0;
    car.roadblock = true;
    world.cars.push(car);
  }
  world.roadblockAt = world.time;
}

/** The helicopter: spawns above the player and circles, spotlight down. */
export function spawnHeli(world) {
  world.heli = {
    x: world.player.x,
    y: world.player.y - 160,
    angle: -2.0,
    height: 1,
    rotor: 0,
  };
}

/** One foot cop's behaviour: chase, shoot, or arrest. */
function updateCop(world, cop, dt) {
  const p = world.player;
  const d = dist(cop.x, cop.y, p.x, p.y);
  cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
  cop.walkPhase += dt * 8;
  if (p.inCar) {
    // Cops cannot catch a car on foot: run to where it was, then hold.
    if (d > 60) {
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    }
    cop.arrestTimer = 0;
    return;
  }
  if (d > 30) {
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
  }
  // Arrest: a cop standing on Danny for long enough ends the run.
  if (d < POLICE.arrestRadius) {
    cop.arrestTimer += dt;
    if (cop.arrestTimer > POLICE.arrestTime) {
      world.screen = 'busted';
      world.audio.fail();
    }
  } else {
    cop.arrestTimer = 0;
  }
  // Shooting, from two stars up, on a steady interval.
  if (world.wanted >= POLICE.copShootStars && d < 560 && d > 60) {
    cop.shootTimer -= dt;
    if (cop.shootTimer <= 0) {
      cop.shootTimer = POLICE.copShootInterval;
      const a = Math.atan2(p.y - cop.y, p.x - cop.x) + world.rng.range(-0.12, 0.12);
      world.bullets.push({
        x: cop.x + Math.cos(a) * 18,
        y: cop.y + Math.sin(a) * 18,
        vx: Math.cos(a) * POLICE.copBulletSpeed,
        vy: Math.sin(a) * POLICE.copBulletSpeed,
        travelled: 0,
        range: 600,
        damage: POLICE.copBulletDamage,
        fromPlayer: false,
      });
      world.audio.shot();
    }
  }
}

/** One police car's behaviour: chase and ram the player's car. */
function updatePoliceCar(world, car, dt) {
  const p = world.player;
  if (car.roadblock || car.wrecked) return;
  const targetX = p.x;
  const targetY = p.y;
  const d = dist(car.x, car.y, targetX, targetY);
  const wantAngle = Math.atan2(targetY - car.y, targetX - car.x);
  const diff = angleDelta(car.angle, wantAngle);
  car.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
  const cruise = d > 260 ? POLICE.carSpeed : POLICE.carSpeed * 0.75;
  car.speed += (cruise - car.speed) * dt * 0.8;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Ram: a solid hit on the player's car.
  if (p.inCar && d < 40) {
    car.ramTimer -= dt;
    if (car.ramTimer <= 0) {
      car.ramTimer = 0.8;
      p.inCar.health -= 8;
      car.health -= 3;
      burst(world, car.x, car.y, 6, '#ffb347', 170, 0.3);
      world.audio.tone(110, 0.12, 'square', 0.12, 55);
      if (p.inCar.health <= 0) {
        p.inCar.wrecked = true;
        p.inCar.speed = 0;
        p.inCar = null;
      }
    }
  }
}

/** Move the helicopter: circle the player, spotlight on them. */
function updateHeli(world, dt) {
  const heli = world.heli;
  if (!heli) return;
  heli.rotor += dt * 22;
  const p = world.player;
  const want = Math.atan2(p.y - heli.y, p.x - heli.x);
  heli.angle = wrapAngle(heli.angle + angleDelta(heli.angle, want) * dt * 0.5);
  heli.x += Math.cos(heli.angle) * 130 * dt;
  heli.y += Math.sin(heli.angle) * 130 * dt;
  // Keep it roughly above the player rather than flying away.
  const d = dist(heli.x, heli.y, p.x, p.y);
  if (d > 260) {
    heli.x += ((p.x - heli.x) / d) * 120 * dt;
    heli.y += ((p.y - heli.y) / d) * 120 * dt;
  }
}

/** Step bullets: move, expire, and resolve hits. */
export function updateBullets(world, dt) {
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += Math.hypot(b.vx, b.vy) * dt;
    let dead = b.travelled > b.range || b.x < 0 || b.y < 0 || b.x > WORLD.size || b.y > WORLD.size;
    if (!dead && b.fromPlayer) {
      // Hit a cop, an enemy, or a car.
      for (const cop of world.cops) {
        if (dist(b.x, b.y, cop.x, cop.y) < 16) {
          cop.health -= b.damage;
          dead = true;
          burst(world, b.x, b.y, 5, '#ff5a4d', 150, 0.3);
          break;
        }
      }
      if (!dead) {
        for (const e of world.enemies) {
          if (e.health > 0 && dist(b.x, b.y, e.x, e.y) < 18) {
            e.health -= b.damage;
            dead = true;
            burst(world, b.x, b.y, 5, '#ff5a4d', 150, 0.3);
            if (e.health <= 0) {
              world.cash += e.boss ? 500 : 50;
              burst(world, e.x, e.y, 12, '#ffd94d', 260, 0.5);
            }
            break;
          }
        }
      }
      if (!dead) {
        for (const car of world.cars) {
          if (car === world.player.inCar) continue;
          if (Math.abs(b.x - car.x) < 20 && Math.abs(b.y - car.y) < 14) {
            car.health -= b.damage;
            dead = true;
            burst(world, b.x, b.y, 4, '#ffb347', 140, 0.25);
            break;
          }
        }
      }
    } else if (!dead && !b.fromPlayer) {
      if (dist(b.x, b.y, world.player.x, world.player.y) < 15) {
        damagePlayer(world, b.damage);
        dead = true;
        burst(world, b.x, b.y, 4, '#ff5a4d', 140, 0.25);
      }
    }
    if (dead) world.bullets.splice(i, 1);
  }
  // The dead leave the field.
  for (let i = world.cops.length - 1; i >= 0; i -= 1) {
    if (world.cops[i].health <= 0) {
      const cop = world.cops[i];
      burst(world, cop.x, cop.y, 10, '#ff5a4d', 220, 0.5);
      world.cops.splice(i, 1);
      addWanted(world, 1);
    }
  }
}

/** Wanted decay: quiet for a while and the heat cools off, one star at a time. */
function decayWanted(world, dt) {
  if (world.wanted <= 0) return;
  const near = world.cops.some((c) => dist(c.x, c.y, world.player.x, world.player.y) < 520)
    || world.cars.some((c) => c.kind === 'police' && dist(c.x, c.y, world.player.x, world.player.y) < 520);
  if (near) {
    world.quietTime = 0;
    return;
  }
  world.quietTime += dt;
  if (world.quietTime > POLICE.decayQuiet) {
    world.quietTime = 0;
    world.wanted -= 1;
  }
  // The safehouse clears heat outright.
  const sh = PLACES.safehouse;
  if (dist(world.player.x, world.player.y, sh.x + 60, sh.y + 45) < POLICE.safehouseRadius) {
    world.wanted = 0;
  }
}

/** Keep the responding force at the level the wanted stars call for. */
function maintainForce(world, dt) {
  const w = world.wanted;
  if (w <= 0) {
    // No heat: the force stands down over a few seconds.
    if (world.cops.length > 0 && world.time - (world.lastCrimeAt || 0) > 8) {
      world.cops.splice(0, 1);
    }
    if (world.heli) world.heli = null;
    return;
  }
  const wantCops = Math.min(POLICE.copBase + w, POLICE.copCap);
  const wantCars = Math.min(Math.max(0, w - 1), POLICE.carCap);
  world.spawnTimer = (world.spawnTimer || 0) - dt;
  if (world.spawnTimer <= 0) {
    world.spawnTimer = 0.45;
    if (world.cops.length < wantCops) spawnCop(world);
    const carsNow = world.cars.filter((c) => c.kind === 'police' && !c.roadblock).length;
    if (carsNow < wantCars) spawnPoliceCar(world);
    if (w >= POLICE.roadblockStars && !world.roadblockAt) spawnRoadblock(world);
    if (w < POLICE.roadblockStars) world.roadblockAt = null;
    if (w >= POLICE.heliStars && !world.heli) spawnHeli(world);
    if (w < POLICE.heliStars) world.heli = null;
  }
  world.audio.siren(w >= 2);
}

/** Step the whole police system: force levels, cops, cars, heli, bullets, decay. */
export function updatePolice(world, dt) {
  maintainForce(world, dt);
  for (const cop of world.cops) updateCop(world, cop, dt);
  for (const car of world.cars) {
    if (car.kind === 'police') updatePoliceCar(world, car, dt);
  }
  updateHeli(world, dt);
  updateBullets(world, dt);
  decayWanted(world, dt);
  if (world.player.health <= 0 && world.screen === 'play') {
    world.screen = 'wasted';
    world.audio.fail();
  }
}
