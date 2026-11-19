// Cars and motorbikes: arcade physics, traffic that minds the roads,
// stealing, wrecks, and the 0.5 s per-car hit cooldown that keeps one
// long scrape from being sixty crashes.
import { CFG } from './config.js';
import { nearestRoad } from './city.js';

let uidCounter = 1;

export function makeVehicle(kind, x, y, angle, color) {
  const spec = kind === 'bike' ? CFG.bike : CFG.car;
  return {
    id: uidCounter++, kind, x, y, angle, speed: 0,
    hp: spec.hp, maxHp: spec.hp, color,
    driver: null, lastHitAt: -10, wrecked: false, honkAt: 0,
  };
}

export function spawnTraffic(world) {
  const out = [];
  const rng = world.rng;
  const colors = ['#c0392b', '#2980b9', '#f39c12', '#7f8c8d', '#16a085', '#8e44ad', '#d35400'];
  for (let i = 0; i < CFG.traffic.count; i++) {
    const horiz = rng.chance(0.5);
    const road = rng.pick(world.city.roads);
    const along = rng.range(150, CFG.world.w - 150);
    const car = makeVehicle('car', horiz ? along : road, horiz ? road : along, horiz ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2), rng.pick(colors));
    car.driver = 'traffic';
    car.cruise = rng.range(CFG.traffic.speedMin, CFG.traffic.speedMax);
    car.horiz = horiz;
    out.push(car);
  }
  return out;
}

export function spawnParked(world) {
  const out = [];
  for (const s of world.city.parked) {
    const v = makeVehicle(s.kind, s.x, s.y, s.angle, s.color);
    v.driver = 'parked';
    out.push(v);
  }
  for (const s of world.city.bikes) {
    const v = makeVehicle('bike', s.x, s.y, s.angle, s.color);
    v.driver = 'parked';
    out.push(v);
  }
  return out;
}

function drivePlayer(world, car, dt) {
  const k = world.keys;
  const spec = car.kind === 'bike' ? CFG.bike : CFG.car;
  const fwd = k.has(CFG.keys.up) ? 1 : 0;
  const back = k.has(CFG.keys.down) ? 1 : 0;
  if (fwd) car.speed += spec.accel * dt;
  if (back) car.speed -= (car.speed > 0 ? spec.accel * 0.8 : CFG.car.reverseAccel) * dt;
  if (!fwd && !back) car.speed *= Math.pow(0.4, dt);
  if (k.has(CFG.keys.brake)) {
    car.speed *= Math.pow(0.12, dt);
  }
  const max = spec.maxSpeed;
  car.speed = Math.max(-CFG.car.maxReverse, Math.min(max, car.speed));
  const steer = (k.has(CFG.keys.left) ? -1 : 0) + (k.has(CFG.keys.right) ? 1 : 0);
  const grip = k.has(CFG.keys.brake) ? CFG.car.handbrakeGrip : spec.grip;
  car.angle += steer * spec.turn * (car.speed / max) * dt * (car.speed < 0 ? -1 : 1) * (1 + (1 - grip) * 0.6);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

function driveTraffic(world, car, dt) {
  // keep to its road; at an intersection sometimes turn; slow for the car ahead
  const road = nearestRoad(world.city, car.horiz ? car.y : car.x);
  if (car.horiz) car.y += (road - car.y) * Math.min(1, dt * 3);
  else car.x += (road - car.x) * Math.min(1, dt * 3);
  let ahead = null;
  let aheadD = 1e9;
  for (const o of world.cars) {
    if (o === car || o.driver === 'parked') continue;
    const dx = o.x - car.x;
    const dy = o.y - car.y;
    const along = car.horiz ? dx * Math.cos(car.angle) + dy * Math.sin(car.angle) : dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along > 0 && along < aheadD && side < 30) { ahead = o; aheadD = along; }
  }
  const want = ahead && aheadD < CFG.traffic.spawnGap ? Math.min(car.cruise, ahead.speed) : car.cruise;
  car.speed += (want - car.speed) * Math.min(1, dt * 1.5);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // wrap around the map edges instead of vanishing
  if (car.x < -60) car.x = CFG.world.w + 50;
  if (car.x > CFG.world.w + 60) car.x = -50;
  if (car.y < -60) car.y = CFG.world.h + 50;
  if (car.y > CFG.world.h + 60) car.y = -50;
}

export function stepVehicles(world, dt) {
  for (const car of world.cars) {
    if (car.wrecked) continue;
    if (car.driver === 'player') drivePlayer(world, car, dt);
    else if (car.driver === 'traffic') driveTraffic(world, car, dt);
    else if (car.driver === 'cop') driveCopCar(world, car, dt);
    car.x = Math.max(30, Math.min(CFG.world.w - 30, car.x));
    car.y = Math.max(30, Math.min(CFG.world.h - 30, car.y));
    // buildings stop cars: shove out along the shallowest side
    for (const b of world.city.buildings) {
      if (car.x > b.x - 14 && car.x < b.x + b.w + 14 && car.y > b.y - 14 && car.y < b.y + b.h + 14) {
        const dxl = car.x - (b.x - 14);
        const dxr = b.x + b.w + 14 - car.x;
        const dyt = car.y - (b.y - 14);
        const dyb = b.y + b.h + 14 - car.y;
        const m = Math.min(dxl, dxr, dyt, dyb);
        if (m === dxl) car.x = b.x - 14;
        else if (m === dxr) car.x = b.x + b.w + 14;
        else if (m === dyt) car.y = b.y - 14;
        else car.y = b.y + b.h + 14;
        car.speed *= 0.4;
      }
    }
  }
  collideCars(world);
}

function driveCopCar(world, car, dt) {
  const p = world.player;
  const want = Math.atan2(p.y - car.y, p.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const dist = Math.hypot(p.x - car.x, p.y - car.y);
  const target = dist > 90 ? CFG.police.carSpeed : CFG.police.carSpeed * 0.4;
  car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

export function collideCars(world) {
  const list = world.cars.filter((c) => !c.wrecked);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 44;
      if (d >= min || d === 0) continue;
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      // one scrape = one crash: damage is rate-limited per car
      const impact = Math.abs(a.speed - b.speed);
      if (impact > 120 && world.time - a.lastHitAt > 0.5 && world.time - b.lastHitAt > 0.5) {
        a.lastHitAt = world.time;
        b.lastHitAt = world.time;
        a.hp -= 6;
        b.hp -= 6;
        world.effects.sparks((a.x + b.x) / 2, (a.y + b.y) / 2);
        if (a.hp <= 0) wreckCar(world, a);
        if (b.hp <= 0) wreckCar(world, b);
      } else {
        // gentle speed exchange so cars do not glue together
        const avg = (a.speed + b.speed) / 2;
        a.speed = avg * 0.92;
        b.speed = avg * 0.92;
      }
    }
  }
}

export function wreckCar(world, car) {
  car.wrecked = true;
  car.speed = 0;
  world.effects.explosion(car.x, car.y, 0.7);
  if (car.driver === 'player') {
    world.player.inCar = null;
    world.player.x = car.x + 30;
    world.player.y = car.y + 30;
  }
  car.driver = 'wreck';
}

export function nearestStealable(world) {
  const p = world.player;
  let best = null;
  let bestD = 1e9;
  for (const car of world.cars) {
    if (car.wrecked || car.driver === 'player' || car.driver === 'cop') continue;
    const spec = car.kind === 'bike' ? CFG.bike : CFG.car;
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    if (d < spec.stealRadius + 14 && d < bestD) { best = car; bestD = d; }
  }
  return best;
}

export function stealVehicle(world) {
  const p = world.player;
  if (p.inCar) return false;
  const car = nearestStealable(world);
  if (!car) return false;
  car.driver = 'player';
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  world.police.addWanted(world, 1);
  world.audio.engineStart();
  return true;
}

export function exitVehicle(world) {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = car.wrecked ? 'wreck' : 'parked';
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
}

export function carSpeedKmh(car) {
  return Math.round(Math.abs(car.speed) * CFG.car.kmh);
}
