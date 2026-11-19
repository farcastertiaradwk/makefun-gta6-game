// Pedestrians for SOLMAR HEAT: ordinary Solmar folk who stroll the
// sidewalks, wait at corners, and run when gunfire or an explosion goes
// off near them. A pedestrian run over by a car is a crime — one star.

import { PEDS } from './config.js';
import { onRoad, nearestRoadCoord, collideBuildings, clampWorld } from './city.js';
import { burst } from './effects.js';

const FIRST_NAMES = [
  'Ana', 'Ben', 'Cleo', 'Dario', 'Elif', 'Finn', 'Greta', 'Hugo', 'Ivy',
  'Jonas', 'Kira', 'Leo', 'Mina', 'Noor', 'Omar', 'Petra', 'Quinn', 'Rosa',
  'Sam', 'Tara', 'Umar', 'Vera', 'Wes', 'Yara', 'Zeke', 'Lena',
];
const SHIRTS = ['#d94f3d', '#3d7bd9', '#e8b73a', '#7ac74f', '#b04fd9', '#e8e8e8', '#f28c4a', '#4ac7b8'];

export function spawnPeds(game, n) {
  const rng = game.rng.fork('peds');
  for (let i = 0; i < n; i++) {
    const vertical = rng.maybe(0.5);
    const road = rng.choose(game.worldRoads);
    const along = rng.range(150, 2450);
    const side = rng.choose([-1, 1]);
    const x = vertical ? road + side * 46 : along;
    const y = vertical ? along : road + side * 46;
    game.peds.push({
      name: rng.choose(FIRST_NAMES),
      x, y,
      angle: rng.range(0, Math.PI * 2),
      speed: 0,
      state: 'walk',
      shirt: rng.choose(SHIRTS),
      waitLeft: rng.range(0, 4),
      fleeAngle: 0,
      down: false,
      downAt: -99,
    });
  }
}

export function stepPeds(game, dt) {
  const p = game.player;
  const car = p.inCar;
  for (const ped of game.peds) {
    if (ped.down) {
      if (game.time - ped.downAt > 6) {
        ped.down = false;
        ped.state = 'walk';
        ped.x += 30;
      }
      continue;
    }
    // Danger: gunfire nearby, an explosion, or a car bearing down.
    const danger = dangerNear(game, ped);
    if (danger) {
      ped.state = 'flee';
      ped.fleeAngle = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    } else if (ped.state === 'flee' && !dangerNear(game, ped)) {
      ped.state = 'walk';
    }
    if (ped.state === 'flee') {
      ped.x += Math.cos(ped.fleeAngle) * PEDS.fleeSpeed * dt;
      ped.y += Math.sin(ped.fleeAngle) * PEDS.fleeSpeed * dt;
    } else if (ped.state === 'walk') {
      if (ped.waitLeft > 0) {
        ped.waitLeft -= dt;
      } else {
        ped.x += Math.cos(ped.angle) * PEDS.walkSpeed * dt;
        ped.y += Math.sin(ped.angle) * PEDS.walkSpeed * dt;
        // Stay on the sidewalk: drift back toward the nearest road edge.
        if (!onRoad(ped.x, ped.y)) {
          const tx = nearestRoadCoord(ped.x);
          const ty = nearestRoadCoord(ped.y);
          const dx = Math.abs(tx - ped.x) < Math.abs(ty - ped.y) ? tx - ped.x : 0;
          const dy = dx === 0 ? ty - ped.y : 0;
          ped.angle = Math.atan2(dy, dx);
        }
        if (Math.random() < 0.002) ped.waitLeft = 2 + Math.random() * 4;
        if (Math.random() < 0.001) ped.angle += (Math.random() - 0.5) * 2;
      }
    }
    collideBuildings(game.city, ped, PEDS.radius);
    clampWorld(ped, 20);

    // Run over: the player's car ploughs through a pedestrian.
    if (car && !car.wrecked && Math.abs(car.speed) > 60) {
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < car.radius + PEDS.radius) {
        ped.down = true;
        ped.downAt = game.time;
        burst(game.fx, ped.x, ped.y, '#ff3d3d', 8, 160);
        game.addWanted('runover');
        game.audio.crash();
      }
    }
  }
}

function dangerNear(game, ped) {
  // A live bullet within 160 px, a fresh blast within 260 px, or a
  // speeding car within 90 px all count as danger worth fleeing.
  for (const b of game.bullets) {
    if (Math.hypot(ped.x - b.x, ped.y - b.y) < 160) return b;
  }
  for (const b of game.fx.blasts) {
    if (b.age < 0.3 && Math.hypot(ped.x - b.x, ped.y - b.y) < 260) return b;
  }
  const car = game.player.inCar;
  if (car && !car.wrecked && Math.abs(car.speed) > 150) {
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 90) return car;
  }
  return null;
}

export function pedCount(game) {
  return game.peds.filter((ped) => !ped.down).length;
}
