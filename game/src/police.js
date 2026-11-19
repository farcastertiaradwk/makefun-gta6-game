// The Solmar police: a wanted level from 0 to 5 stars, foot cops who
// chase and shoot, police cars that ram, roadblocks, and a helicopter
// with a spotlight at four stars and up. Heat decays when nobody can
// see Danny; the Safehouse clears it outright.

import { POLICE, WORLD } from './config.js';
import { roadPoint, nearestRoadCoord } from './city.js';
import { makeVehicle } from './vehicles.js';
import { burst, floatText } from './effects.js';

const WANTED_FOR = {
  steal: POLICE.steal,
  shoot: POLICE.shoot,
  runover: POLICE.runover,
  killCop: POLICE.killCop,
};

export function addWanted(game, kind) {
  const gain = WANTED_FOR[kind] || 1;
  if (game.wanted >= POLICE.maxStars) return;
  game.wanted = Math.min(POLICE.maxStars, game.wanted + gain);
  game.bestWanted = Math.max(game.bestWanted, game.wanted);
  game.lastSeenAt = game.time;
  game.audio.siren(game.wanted > 0);
}

export function setWanted(game, stars) {
  game.wanted = Math.max(0, Math.min(POLICE.maxStars, stars));
  game.bestWanted = Math.max(game.bestWanted, game.wanted);
  game.lastSeenAt = game.time;
  game.audio.siren(game.wanted > 0);
}

export function stepPolice(game, dt) {
  const wanted = game.wanted;
  // Decay: out of sight for a while, the heat cools one star at a time.
  const seen = policeCanSee(game);
  if (seen) game.lastSeenAt = game.time;
  if (wanted > 0 && game.time - game.lastSeenAt > POLICE.decayDelay) {
    game.decayAt = (game.decayAt || 0) + dt;
    if (game.decayAt > POLICE.decayStep) {
      game.decayAt = 0;
      game.wanted = wanted - 1;
      game.audio.siren(game.wanted > 0);
    }
  } else {
    game.decayAt = 0;
  }
  if (wanted > 0) {
    maintainFootCops(game, dt);
    maintainCopCars(game, dt);
    maintainRoadblocks(game);
    maintainHeli(game, dt);
  } else {
    game.heli = null;
  }
  // Bullets always fly — even at zero stars, so the boss fight works.
  stepCopBullets(game, dt);
}

function policeCanSee(game) {
  const p = game.player;
  const at = p.inCar || p;
  for (const cop of game.cops) {
    if (Math.hypot(cop.x - at.x, cop.y - at.y) < 420) return true;
  }
  for (const car of game.cars) {
    if (car.isCop && !car.wrecked && Math.hypot(car.x - at.x, car.y - at.y) < 520) return true;
  }
  if (game.heli) return true;
  return false;
}

function maintainFootCops(game, dt) {
  const want = POLICE.footCops[game.wanted] || 0;
  const rng = game.rng;
  while (game.cops.length < want) {
    const p = roadPoint(rng);
    const at = game.player.inCar || game.player;
    const a = Math.atan2(p.y - at.y, p.x - at.x);
    const x = at.x + Math.cos(a) * POLICE.spawnDistance;
    const y = at.y + Math.sin(a) * POLICE.spawnDistance;
    game.cops.push({
      x: Math.max(40, Math.min(2560, x)),
      y: Math.max(40, Math.min(2560, y)),
      hp: 40,
      angle: 0,
      shootAt: 0,
      speed: 190,
      dead: false,
    });
  }
  const target = game.player.inCar || game.player;
  for (const cop of game.cops) {
    if (cop.dead) continue;
    const d = Math.hypot(target.x - cop.x, target.y - cop.y);
    const a = Math.atan2(target.y - cop.y, target.x - cop.x);
    cop.angle = a;
    if (d > 130) {
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
    } else if (d < 70) {
      cop.x -= Math.cos(a) * cop.speed * 0.5 * dt;
      cop.y -= Math.sin(a) * cop.speed * 0.5 * dt;
    }
    // Foot cops open fire from two stars up.
    if (game.wanted >= POLICE.copShootFrom && d < 460 && game.time > cop.shootAt) {
      cop.shootAt = game.time + POLICE.copShootInterval;
      game.bullets.push({
        x: cop.x + Math.cos(a) * 18,
        y: cop.y + Math.sin(a) * 18,
        vx: Math.cos(a) * POLICE.copBulletSpeed,
        vy: Math.sin(a) * POLICE.copBulletSpeed,
        from: 'cop',
        damage: POLICE.copBulletDamage,
        life: 0.9,
      });
      burst(game.fx, cop.x + Math.cos(a) * 18, cop.y + Math.sin(a) * 18, '#ffd94d', 3, 90);
    }
  }
  game.cops = game.cops.filter((c) => !c.dead);
}

function maintainCopCars(game, dt) {
  const want = game.wanted >= POLICE.copCarFrom ? POLICE.copCars[game.wanted] || 0 : 0;
  const live = game.cars.filter((c) => c.isCop && !c.wrecked).length;
  if (live < want) {
    const at = game.player.inCar || game.player;
    const p = roadPoint(game.rng);
    const a = Math.atan2(p.y - at.y, p.x - at.x);
    const x = Math.max(60, Math.min(2540, at.x + Math.cos(a) * POLICE.spawnDistance));
    const y = Math.max(60, Math.min(2540, at.y + Math.sin(a) * POLICE.spawnDistance));
    const car = makeVehicle('cop', x, y, Math.atan2(at.y - y, at.x - x), '#2f5fd9');
    game.cars.push(car);
  }
}

function maintainRoadblocks(game) {
  const want = game.wanted >= POLICE.roadblockFrom ? 1 : 0;
  if (want === 0) {
    game.roadblocks = [];
    return;
  }
  if (game.roadblocks.length === 0) {
    // A roadblock ahead of Danny on his current road.
    const at = game.player.inCar || game.player;
    const rx = nearestRoadCoord(at.x);
    const ry = nearestRoadCoord(at.y);
    const aheadX = Math.abs(at.x - rx) < Math.abs(at.y - ry);
    const bx = aheadX ? rx : at.x + 320;
    const by = aheadX ? at.y + 320 : ry;
    for (const off of [-70, 0, 70]) {
      game.roadblocks.push({
        x: aheadX ? bx + off : bx,
        y: aheadX ? by : by + off,
        angle: aheadX ? 0 : Math.PI / 2,
      });
    }
  }
}

function maintainHeli(game, dt) {
  if (game.wanted < POLICE.heliFrom) {
    game.heli = null;
    return;
  }
  const at = game.player.inCar || game.player;
  if (!game.heli) {
    game.heli = { x: at.x, y: at.y - 260, angle: 0, rotor: 0, searchAt: 0 };
  }
  const h = game.heli;
  h.rotor += dt * 22;
  // The helicopter hangs above Danny and slowly circles him.
  const wantA = Math.atan2(at.y - h.y, at.x - h.x);
  h.angle += Math.max(-1.2 * dt, Math.min(1.2 * dt, wantA - h.angle));
  const d = Math.hypot(at.x - h.x, at.y - h.y);
  const speed = d > 130 ? 260 : 120;
  h.x += Math.cos(wantA) * speed * dt;
  h.y += Math.sin(wantA) * speed * dt;
}

function stepCopBullets(game, dt) {
  // Bullets fly, hit buildings, cars, cops, enemies and Danny.
  for (const b of game.bullets) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0) continue;
    if (b.from === 'player') {
      // Enemies first: Kane and the Vipers take pistol fire.
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < 18) {
          b.life = 0;
          damageEnemy(game, e, b.damage);
          break;
        }
      }
      if (b.life <= 0) continue;
      // Then police cars and foot cops.
      for (const car of game.cars) {
        if (car.wrecked || car === game.player.inCar) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < car.radius + 4) {
          b.life = 0;
          car.hp -= b.damage;
          burst(game.fx, b.x, b.y, '#ffd94d', 4, 100);
          if (car.isCop && car.hp <= 0) game.addWanted('killCop');
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const cop of game.cops) {
        if (cop.dead) continue;
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
          b.life = 0;
          cop.hp -= b.damage;
          if (cop.hp <= 0) {
            cop.dead = true;
            burst(game.fx, cop.x, cop.y, '#ff3d3d', 8, 150);
            game.addWanted('killCop');
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const ped of game.peds) {
        if (ped.down) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
          b.life = 0;
          ped.down = true;
          ped.downAt = game.time;
          game.addWanted('shoot');
          break;
        }
      }
    } else {
      // Cop bullets: they only threaten Danny, on foot or in his car.
      const p = game.player;
      const at = p.inCar || p;
      if (Math.hypot(at.x - b.x, at.y - b.y) < (p.inCar ? p.inCar.radius + 4 : 14)) {
        b.life = 0;
        if (p.inCar) {
          p.inCar.hp -= b.damage;
        } else if (game.hurtPlayer(b.damage)) {
          game.wasted();
        }
      }
    }
  }
  game.bullets = game.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD.size && b.y > 0 && b.y < WORLD.size);
}

export function damageEnemy(game, e, dmg) {
  if (e.dead) return;
  e.hp -= dmg;
  burst(game.fx, e.x, e.y, '#ff3d3d', 5, 120);
  if (e.hp <= 0) {
    e.dead = true;
    e.hp = 0;
    burst(game.fx, e.x, e.y, '#ff5a2a', 12, 200);
    const reward = e.boss ? 500 : 50;
    game.cash += reward;
    floatText(game.fx, e.x, e.y - 22, e.boss ? `KANE DOWN  +$${reward}` : `+$${reward}`, '#ffd94d');
    game.audio.boom();
  }
}
