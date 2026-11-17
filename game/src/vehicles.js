// Cars: arcade driving for the player, grid-following traffic, and police
// pursuit cars. A car is two circles (nose and tail) against buildings,
// and one circle against other cars.
import { CAR, TRAFFIC_SPEED, WORLD, ROADS_X, ROADS_Y } from './config.js';
import { isBlocked, nearestIntersection } from './city.js';

let nextId = 1;

export function createCar(x, y, angle, color, kind) {
  return {
    id: nextId,
    x,
    y,
    angle,
    speed: 0,
    color,
    kind, // 'player' | 'traffic' | 'police' | 'parked'
    wasTraffic: kind === 'traffic',
    driver: kind === 'traffic' ? 'traffic' : null,
    parked: kind === 'parked',
    health: CAR.health,
    wrecked: false,
    smoke: 0,
    target: null, // traffic: next intersection
    brakeLight: false,
  };
}

// Spawn `count` fresh traffic cars on the roads, for a new game or a restart.
export function spawnTrafficCars(world, count) {
  for (let i = 0; i < count; i += 1) {
    const rx = world.random.pick(ROADS_X);
    const ry = world.random.pick(ROADS_Y);
    const vertical = world.random.chance(0.5);
    const car = createCar(
      vertical ? rx : world.random.range(300, 2300),
      vertical ? world.random.range(300, 1600) : ry,
      vertical ? (world.random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (world.random.chance(0.5) ? 0 : Math.PI),
      world.random.pick(['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2c3e50', '#e67e22', '#8e44ad', '#16a085', '#d35400']),
      'traffic',
    );
    car.speed = 60;
    world.cars.push(car);
  }
}

function endCircles(car) {
  const fx = Math.cos(car.angle) * 14;
  const fy = Math.sin(car.angle) * 14;
  return [
    { x: car.x + fx, y: car.y + fy, r: 13 },
    { x: car.x - fx, y: car.y - fy, r: 13 },
  ];
}

function blockedAt(city, car, nx, ny) {
  for (const c of endCircles({ x: nx, y: ny, angle: car.angle })) {
    if (isBlocked(city, c.x, c.y, c.r, true)) return true;
  }
  return false;
}

function advanceCar(city, car, dt) {
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Axis-separated, so the car slides along a wall instead of sticking to it.
  if (!blockedAt(city, car, nx, car.y)) car.x = nx;
  else car.speed *= 0.4;
  if (!blockedAt(city, car, car.x, ny)) car.y = ny;
  else car.speed *= 0.4;
  car.x = Math.max(24, Math.min(WORLD.w - 24, car.x));
  car.y = Math.max(24, Math.min(WORLD.h - 24, car.y));
}

function normAngle(diff) {
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

// Player driving: W/S throttle, A/D steering, Space handbrake.
export function updatePlayerCar(world, dt, input) {
  const car = world.player.inCar;
  if (!car || car.wrecked) return;
  const axis = input.axis();
  const forward = axis.y < 0 ? 1 : axis.y > 0 ? -0.55 : 0;
  const handbrake = input.held(' ') || input.held('Spacebar');
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) car.speed -= CAR.brake * dt * 0.8;
  else {
    const drag = 160 * dt;
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), drag);
  }
  if (handbrake) car.speed *= Math.max(0, 1 - 4 * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  // Steering bites harder the faster the car goes, then fades at top speed.
  const steerInput = axis.x;
  const speedFactor = Math.min(1, Math.abs(car.speed) / 180);
  car.angle += steerInput * CAR.turnRate * speedFactor * Math.sign(car.speed) * dt;
  car.brakeLight = forward < 0 || handbrake;
  advanceCar(world.city, car, dt);
  world.player.x = car.x;
  world.player.y = car.y;
  world.audio.setEngine(Math.min(1, Math.abs(car.speed) / CAR.maxSpeed));
  if (car.health <= 40) {
    car.smoke += dt;
    if (car.smoke > 0.12) {
      car.smoke = 0;
      world.particles.push({
        kind: 'smoke',
        x: car.x - Math.cos(car.angle) * 16,
        y: car.y - Math.sin(car.angle) * 16,
        vx: (world.random.next() - 0.5) * 20,
        vy: -30,
        life: 0.8,
        max: 0.8,
        size: 9,
      });
    }
  }
}

function chooseJunction(car, random) {
  // From the current target, choose an adjacent intersection (never straight back).
  const cur = car.target || nearestIntersection(car.x, car.y);
  const options = [];
  for (const rx of ROADS_X) {
    if (rx === cur.x) continue;
    options.push({ x: rx, y: cur.y });
  }
  for (const ry of ROADS_Y) {
    if (ry === cur.y) continue;
    options.push({ x: cur.x, y: ry });
  }
  // Prefer the two nearest options so traffic stays local and believable.
  options.sort((a, b) => {
    const da = Math.abs(a.x - cur.x) + Math.abs(a.y - cur.y);
    const db = Math.abs(b.x - cur.x) + Math.abs(b.y - cur.y);
    return da - db;
  });
  const near = options.slice(0, 4);
  return random.pick(near);
}

function blockedAhead(world, car) {
  // Stop for the car ahead, so traffic queues instead of piling up.
  for (const other of world.cars) {
    if (other === car || other.wrecked) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 64 && side < 20) return true;
  }
  return false;
}

export function updateTraffic(world, dt) {
  for (const car of world.cars) {
    if (car.kind !== 'traffic' || car.wrecked) continue;
    if (!car.target) car.target = chooseJunction(car, world.random);
    const dx = car.target.x - car.x;
    const dy = car.target.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      car.target = chooseJunction(car, world.random);
      continue;
    }
    const want = Math.atan2(dy, dx);
    const diff = normAngle(want - car.angle);
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const targetSpeed = blockedAhead(world, car) ? 0 : TRAFFIC_SPEED;
    car.speed += (targetSpeed - car.speed) * Math.min(1, 2.5 * dt);
    advanceCar(world.city, car, dt);
  }
}

export function updatePoliceCars(world, dt) {
  const player = world.player;
  for (const car of world.cars) {
    if (car.kind !== 'police' || car.wrecked) continue;
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    const diff = normAngle(want - car.angle);
    const targetSpeed = dist > 60 ? 470 : 200;
    car.speed += (targetSpeed - car.speed) * Math.min(1, 2 * dt);
    car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    advanceCar(world.city, car, dt);
    // Ramming the player's car damages it.
    const pc = player.inCar;
    if (pc && !pc.wrecked) {
      const d = Math.hypot(pc.x - car.x, pc.y - car.y);
      if (d < 44) {
        pc.health -= 18 * dt;
        car.speed *= 0.96;
        if (pc.health <= 0) wreckCar(world, pc);
      }
    }
  }
}

// Push overlapping cars apart and chip paint off both on a hard hit. Damage is
// rate-limited per car so one long scrape is one crash, not sixty.
export function collideCars(world) {
  const cars = world.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.wrecked || b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 40 && d > 0.01) {
        const push = (40 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 120 && world.time - (a.lastHitAt || -10) > 0.5 && world.time - (b.lastHitAt || -10) > 0.5) {
          a.lastHitAt = world.time;
          b.lastHitAt = world.time;
          a.health -= 6;
          b.health -= 6;
          world.particles.push({
            kind: 'spark',
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            vx: 0,
            vy: 0,
            life: 0.2,
            max: 0.2,
            size: 8,
          });
          if (a.health <= 0) wreckCar(world, a);
          if (b.health <= 0) wreckCar(world, b);
        }
      }
    }
  }
}

export function wreckCar(world, car) {
  if (car.wrecked) return;
  car.wrecked = true;
  car.speed = 0;
  world.explode(car.x, car.y);
  if (world.player.inCar === car) {
    world.player.inCar = null;
    world.player.x = car.x + 40;
    world.player.y = car.y;
    // Ejected from a wreck: the player takes a hit but keeps playing.
    world.player.health = Math.max(1, world.player.health - 15);
  }
  if (car.kind === 'player') car.kind = 'parked';
}
