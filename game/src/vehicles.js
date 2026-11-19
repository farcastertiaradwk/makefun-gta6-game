// Cars, motorbikes and traffic for SOLMAR HEAT.
// A car is a body with a heading, a speed and a kind; the player's car
// answers the keyboard, traffic follows the road grid, police cars chase.
// Stealing any car raises the heat by one star.

import { CARS, TRAFFIC, PALETTE, KEYS, POLICE } from './config.js';
import { heldMove } from './input.js';
import { collideBuildings, clampWorld, onRoad, roadPoint, nearestRoadCoord, inWater } from './city.js';
import { burst, puff, explode, floatText } from './effects.js';

let nextCarId = 1;

export function makeVehicle(kind, x, y, angle, color) {
  const spec = CARS[kind] || CARS.car;
  return {
    id: nextCarId++,
    kind,
    x, y,
    angle,
    speed: 0,
    hp: spec.hp,
    maxHp: spec.hp,
    radius: spec.radius,
    color: color || PALETTE.car[0],
    wrecked: false,
    isCop: kind === 'cop',
    isTaxi: kind === 'taxi',
    isBike: kind === 'bike',
    traffic: false,
    lastHitAt: -10,
    lastSmokeAt: 0,
    // Traffic AI state: which road the car follows and where it turns.
    roadAxis: 'x',
    roadLine: y,
    turnAt: 0,
  };
}

export function spawnParked(game) {
  const rng = game.rng.fork('parked');
  const spots = game.city.parkedSpots;
  const kinds = ['car', 'car', 'car', 'taxi', 'car', 'truck', 'car', 'car'];
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const kind = kinds[i % kinds.length];
    const car = makeVehicle(kind, s.x, s.y, s.angle, kind === 'taxi' ? PALETTE.taxi : rng.choose(PALETTE.car));
    game.cars.push(car);
  }
  // Two motorbikes, parked where Danny can find them fast.
  for (const [bx, by, ba] of [[700, 1800, 0], [1700, 600, Math.PI / 2]]) {
    const bike = makeVehicle('bike', bx, by, ba, PALETTE.bike);
    game.cars.push(bike);
  }
}

export function spawnTraffic(game, n) {
  const rng = game.rng.fork('traffic');
  for (let i = 0; i < n; i++) {
    const p = roadPoint(rng);
    const vertical = rng.maybe(0.5);
    const angle = vertical ? (rng.maybe(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.maybe(0.5) ? 0 : Math.PI);
    const kind = rng.maybe(0.15) ? 'truck' : rng.maybe(0.2) ? 'taxi' : 'car';
    const car = makeVehicle(kind, p.x, p.y, angle, kind === 'taxi' ? PALETTE.taxi : rng.choose(PALETTE.car));
    car.traffic = true;
    car.speed = TRAFFIC.speed * rng.range(0.8, 1.1);
    car.roadAxis = vertical ? 'y' : 'x';
    car.roadLine = vertical ? p.x : p.y;
    game.cars.push(car);
  }
}

export function stepVehicles(game, dt) {
  const input = game.input;
  const player = game.player;
  for (const car of game.cars) {
    if (car.wrecked) continue;
    if (player.inCar === car) {
      drivePlayerCar(game, car, dt, input);
    } else if (car.isCop) {
      driveCopCar(game, car, dt);
    } else if (car.traffic) {
      driveTraffic(game, car, dt);
    }
    // Wrecks: a car at 0 hp blows up once, then sits smoking.
    if (car.hp <= 0 && !car.wrecked) {
      car.wrecked = true;
      car.speed = 0;
      explode(game.fx, car.x, car.y, car.kind === 'truck');
      game.audio.boom();
      if (player.inCar === car) {
        player.inCar = null;
        player.x = car.x + 40;
        player.y = car.y;
      }
    }
    if (car.wrecked && game.time - car.lastSmokeAt > 0.4) {
      car.lastSmokeAt = game.time;
      puff(game.fx, car.x, car.y - 6, true);
    }
  }
  collideCars(game, dt);
}

function drivePlayerCar(game, car, dt, input) {
  const spec = CARS[car.kind];
  const forward = heldMove(input, KEYS.up) ? 1 : 0;
  const reverse = heldMove(input, KEYS.down) ? 1 : 0;
  const handbrake = input.is(KEYS.handbrake);
  if (forward) car.speed += spec.accel * dt;
  if (reverse) car.speed -= spec.brake * dt * 0.6;
  if (!forward && !reverse) {
    car.speed -= Math.sign(car.speed) * 140 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * spec.handbrake * dt;
    if (Math.abs(car.speed) < 10) car.speed = 0;
  }
  car.speed = Math.max(-spec.reverse, Math.min(spec.top, car.speed));
  // Steering bites harder the faster the car goes; the handbrake sharpens it.
  const steerInput = (heldMove(input, KEYS.left) ? -1 : 0) + (heldMove(input, KEYS.right) ? 1 : 0);
  const grip = Math.min(1, Math.abs(car.speed) / 140);
  const steerRate = spec.steer * grip * (handbrake ? 1.7 : 1);
  car.angle += steerInput * steerRate * dt * Math.sign(car.speed || 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const hitWall = collideBuildings(game.city, car, car.radius);
  if (hitWall && Math.abs(car.speed) > 180) {
    damageCar(game, car, 8);
    car.speed *= 0.4;
    game.audio.crash();
  } else if (hitWall) {
    car.speed *= 0.7;
  }
  clampWorld(car, 24);
  if (inWater(car.x, car.y)) {
    car.x = Math.min(car.x, 2390);
    car.speed *= 0.5;
  }
  if (Math.abs(car.speed) > 60 && game.time - (car.lastSmokeAt || 0) > 0.9) {
    car.lastSmokeAt = game.time;
  }
  // E steps out of the car.
  if (input.take('interact')) {
    exitCar(game, car);
  }
}

function driveCopCar(game, car, dt) {
  const p = game.player;
  const spec = CARS.cop;
  const target = p.inCar || p;
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const dist = Math.hypot(target.x - car.x, target.y - car.y);
  if (dist > 70) {
    car.speed = Math.min(spec.top, car.speed + spec.accel * dt);
  } else {
    // Ramming speed: ease off only at the last moment.
    car.speed = Math.max(120, car.speed - spec.brake * dt);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (collideBuildings(game.city, car, car.radius)) car.speed *= 0.5;
  clampWorld(car, 24);
}

function driveTraffic(game, car, dt) {
  // Traffic holds its lane and speed. At an intersection it sometimes
  // turns onto the crossing road; otherwise it keeps straight.
  const speed = TRAFFIC.speed;
  car.speed = speed;
  const cx = car.x;
  const cy = car.y;
  const nearCross = Math.abs(cx - nearestRoadCoord(cx)) < 26 && Math.abs(cy - nearestRoadCoord(cy)) < 26;
  if (nearCross && game.time > car.turnAt) {
    car.turnAt = game.time + 1.5;
    if (Math.random() < 0.3) {
      // Turn: pick the perpendicular axis, either direction.
      if (car.roadAxis === 'x') {
        car.roadAxis = 'y';
        car.roadLine = nearestRoadCoord(cx);
        car.angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.roadAxis = 'x';
        car.roadLine = nearestRoadCoord(cy);
        car.angle = Math.random() < 0.5 ? 0 : Math.PI;
      }
    }
  }
  // Ease back onto the lane centre so traffic never drifts off-road.
  if (car.roadAxis === 'x') {
    car.y += (car.roadLine - car.y) * Math.min(1, 2.5 * dt);
  } else {
    car.x += (car.roadLine - car.x) * Math.min(1, 2.5 * dt);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Wrap around the map edges so traffic never runs out.
  if (car.x < 60) car.x = 2540;
  if (car.x > 2540) car.x = 60;
  if (car.y < 60) car.y = 2540;
  if (car.y > 2540) car.y = 60;
  if (!onRoad(car.x, car.y)) {
    // Drifted off the grid (a push from a crash): steer back to the road.
    car.angle = Math.atan2(nearestRoadCoord(car.y) - car.y, nearestRoadCoord(car.x) - car.x);
  }
}

export function collideCars(game, dt) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.wrecked) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const impact = Math.abs(a.speed - b.speed);
      // One hard scrape is one crash, not sixty: the speed exchange and
      // the damage share a 0.5 s per-car cooldown. Between fresh hits the
      // cars only separate positionally, so a rear-end does not glue the
      // faster car to the slower one's speed.
      if (game.time - a.lastHitAt > 0.5 && game.time - b.lastHitAt > 0.5) {
        a.lastHitAt = game.time;
        b.lastHitAt = game.time;
        const fast = a.speed >= b.speed ? a : b;
        const slow = fast === a ? b : a;
        slow.speed = Math.max(slow.speed, fast.speed * 0.55);
        fast.speed *= 0.75;
        if (impact > 120) {
          damageCar(game, a, 6);
          damageCar(game, b, 6);
          burst(game.fx, (a.x + b.x) / 2, (a.y + b.y) / 2, '#ffd94d', 5, 120);
          game.audio.crash();
        }
      }
    }
  }
}

export function damageCar(game, car, dmg) {
  if (car.wrecked) return;
  car.hp -= dmg;
  if (car.hp < 0) car.hp = 0;
}

export function stealCar(game) {
  const p = game.player;
  if (p.inCar) return false;
  let best = null;
  let bestD = 60;
  for (const car of game.cars) {
    if (car.wrecked || car.traffic) continue;
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  if (!best) return false;
  p.inCar = best;
  p.x = best.x;
  p.y = best.y;
  game.addWanted('steal');
  floatText(game.fx, best.x, best.y - 26, best.isBike ? 'BIKE JACKED!' : 'CAR JACKED!', '#ff9d3d');
  game.audio.blip(300, 520, 0.15, 'square', 0.15);
  return true;
}

export function exitCar(game, car) {
  const p = game.player;
  p.inCar = null;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  clampWorld(p, 20);
  car.speed *= 0.3;
}

export function nearestCarTo(game, x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of game.cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(x - car.x, y - car.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}
