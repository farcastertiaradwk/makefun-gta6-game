// The world: everything the game simulates, owned by one object. A fresh
// world is a fresh story — same seed, same city, same first car. The frame
// loop calls stepWorld with a clamped dt and the game phase is decided here:
// title, playing, paused, wasted, busted, mission briefings and victory.
import { MAP, PRICES, VIEW } from './config.js';
import { makeRng } from './random.js';
import { buildCity, blocked } from './city.js';
import { makeAudio } from './audio.js';
import { makeWalker, stepOnFoot, injure } from './player.js';
import { makeCar, spawnTraffic, drivePlayerCar, stepTraffic, stepPursuit, resolveCollisions, wreck } from './vehicles.js';
import { spawnWalkers, stepPeds, checkRunOvers, bulletHitsPed } from './pedestrians.js';
import { stepHeat, stepOfficers, stepHelicopter } from './police.js';
import { beginJob, stepJob, stepFoes } from './missions.js';
import { stepParticles, detonate } from './effects.js';

// Where things start in the first world: the safehouse, where Danny wakes.
const START_POS = { x: 300, y: 1600 };

export function makeWorld(seed) {
  const random = makeRng(seed);
  const city = buildCity(random);
  const world = {
    seed,
    random,
    city,
    time: 0,
    screen: 'title',
    prompt: '',
    player: makeWalker(START_POS.x, START_POS.y),
    cars: [],
    peds: [],
    cops: [],
    enemies: [],
    bullets: [],
    particles: [],
    floaters: [],
    pickups: [],
    wanted: 0,
    heat: 0,
    lastCrimeAt: -100,
    lastShotAt: null,
    lastShotX: 0,
    lastShotY: 0,
    lastExplosionAt: null,
    lastExplosionX: 0,
    lastExplosionY: 0,
    heli: null,
    spawnTimer: 0,
    camera: { x: START_POS.x, y: START_POS.y, shake: 0 },
    cash: PRICES.startCash,
    missionIndex: 0,
    mission: null,
    missionsDone: 0,
    stats: { carsStolen: 0, pedsHit: 0, copsDown: 0, missionsCompleted: 0 },
    message: '',
    messageTimer: 0,
    interactHeld: false,
    audio: makeAudio(),
  };

  for (const spot of city.parkedSpots) {
    const color = random.choose(['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2c3e50', '#e67e22', '#8e44ad', '#16a085']);
    world.cars.push(makeCar(spot.x, spot.y, spot.angle, color, 'parked'));
  }
  spawnTraffic(world, 18);
  spawnWalkers(world, 22);

  // Money, health and ammo lying around the map.
  world.pickups.push(
    { x: 1250, y: 1120, kind: 'cash', amount: 50, taken: false },
    { x: 850, y: 1200, kind: 'health', amount: 30, taken: false },
    { x: 1650, y: 750, kind: 'ammo', amount: 24, taken: false },
    { x: 2350, y: 1300, kind: 'cash', amount: 75, taken: false },
    { x: 650, y: 1450, kind: 'health', amount: 25, taken: false },
    { x: 2050, y: 350, kind: 'cash', amount: 40, taken: false },
    { x: 1500, y: 500, kind: 'ammo', amount: 24, taken: false },
    { x: 1050, y: 1500, kind: 'cash', amount: 60, taken: false },
  );

  world.setWanted = (level) => {
    if (level > world.wanted) {
      world.wanted = level;
      world.heat = level;
      world.lastCrimeAt = world.time;
    }
  };

  // Heat is additive and caps at five stars.
  world.addHeat = (amount) => {
    world.heat = Math.min(5, world.heat + amount);
    world.wanted = Math.floor(world.heat);
    world.lastCrimeAt = world.time;
  };

  world.showMessage = (text) => {
    world.message = text;
    world.messageTimer = 3.5;
  };

  world.floatText = (x, y, text, color) => {
    world.floaters.push({ x, y, text, color: color || '#ffffff', life: 1.4 });
  };

  world.explode = (x, y) => {
    detonate(world, x, y, true);
    world.addHeat(1);
    for (const ped of world.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - x, ped.y - y) < 90) {
        ped.state = 'down';
        ped.downTimer = 6;
      }
    }
    for (const car of world.cars) {
      if (car.wrecked) continue;
      if (Math.hypot(car.x - x, car.y - y) < 90 && Math.hypot(car.x - x, car.y - y) > 10) {
        car.health -= 60;
        if (car.health <= 0) wreck(world, car);
      }
    }
    if (Math.hypot(world.player.x - x, world.player.y - y) < 110) {
      injure(world.player, 35);
    }
  };

  world.wasted = () => {
    world.screen = 'wasted';
    world.audio.missionFailed();
  };

  world.busted = () => {
    world.screen = 'busted';
    world.audio.missionFailed();
  };

  return world;
}

export function restartWorld(world, seed) {
  const audio = world.audio; // one audio context for the session, not one per life
  const fresh = makeWorld(seed);
  // Copy every DATA field of a fresh world over this one, keeping the same
  // object — the frame loop and the save file both hold this reference.
  // The world's verbs (addHeat, setWanted, showMessage, ...) close over the
  // world they were built with, so they are NOT copied: the live world's
  // own verbs already close over this object, and a fresh world's would
  // mutate the discarded fresh object instead.
  for (const key of Object.keys(fresh)) {
    if (typeof fresh[key] !== 'function') world[key] = fresh[key];
  }
  world.audio = audio;
  world.screen = 'play';
  beginJob(world, 0);
}

// A save is a plain object; loading it rebuilds the same seed, then swaps
// the volatile fields (health, cash, wanted, mission) for the saved ones.
export function serializeWorld(world) {
  return {
    version: 1,
    seed: world.seed,
    player: {
      x: world.player.x,
      y: world.player.y,
      health: world.player.health,
      armor: world.player.armor,
      magazine: world.player.magazine,
      reserve: world.player.reserve,
    },
    cash: world.cash,
    missionIndex: world.missionIndex,
    missionsDone: world.missionsDone,
    wanted: world.wanted,
    heat: world.heat,
    stats: world.stats,
  };
}

export function deserializeWorld(save) {
  if (!save || save.version !== 1) return null;
  const world = makeWorld(save.seed);
  world.player.x = save.player.x;
  world.player.y = save.player.y;
  world.player.health = save.player.health;
  world.player.armor = save.player.armor;
  world.player.magazine = save.player.magazine;
  world.player.reserve = save.player.reserve;
  world.cash = save.cash;
  world.missionIndex = save.missionIndex;
  world.missionsDone = save.missionsDone;
  world.wanted = save.wanted;
  world.heat = save.heat;
  world.stats = save.stats;
  world.screen = 'play';
  beginJob(world, save.missionIndex);
  return world;
}

function stepBullets(world, dt) {
  for (const bullet of world.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }
  world.bullets = world.bullets.filter((b) => {
    if (b.life <= 0) return false;
    if (b.x < 0 || b.x > MAP.w || b.y < 0 || b.y > MAP.h) return false;
    if (bulletHitsPed(world, b)) return false;
    if (blocked(world.city, b.x, b.y, 2, false)) {
      world.particles.push({ kind: 'spark', x: b.x, y: b.y, vx: 0, vy: 0, life: 0.15, max: 0.15, size: 6 });
      return false;
    }
    for (const car of world.cars) {
      if (car.wrecked) continue;
      if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
        if (b.from === 'player') car.health -= b.damage;
        if (car.health <= 0) wreck(world, car);
        return false;
      }
    }
    for (const cop of world.cops) {
      if (Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
        if (b.from === 'player') cop.health -= b.damage;
        return false;
      }
    }
    for (const enemy of world.enemies) {
      if (enemy.health <= 0) continue;
      if (Math.hypot(enemy.x - b.x, enemy.y - b.y) < 16) {
        if (b.from === 'player') {
          enemy.health -= b.damage;
          if (enemy.health <= 0) {
            // A rival down pays: $50 for a Viper, $500 for Kane himself.
            const bounty = enemy.boss ? 500 : 50;
            world.cash += bounty;
            world.floatText(enemy.x, enemy.y - 24, enemy.boss ? `KANE DOWN +$${bounty}` : `+$${bounty}`, '#ffd94d');
            detonate(world, enemy.x, enemy.y, false);
            world.audio.pickup();
          }
        }
        return false;
      }
    }
    if (b.from !== 'player' && Math.hypot(world.player.x - b.x, world.player.y - b.y) < 14) {
      injure(world.player, b.damage);
      if (world.player.health <= 0) world.wasted();
      return false;
    }
    return true;
  });
}

function grabPickups(world) {
  const player = world.player;
  for (const pickup of world.pickups) {
    if (pickup.taken) continue;
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) > 28) continue;
    pickup.taken = true;
    if (pickup.kind === 'cash') {
      world.cash += pickup.amount;
      world.floatText(pickup.x, pickup.y - 20, `+$${pickup.amount}`, '#2ecc71');
      world.audio.cash();
    } else if (pickup.kind === 'health') {
      player.health = Math.min(100, player.health + pickup.amount);
      world.floatText(pickup.x, pickup.y - 20, `+${pickup.amount} HP`, '#2ecc71');
      world.audio.pickup();
    } else if (pickup.kind === 'ammo') {
      player.reserve += pickup.amount;
      world.floatText(pickup.x, pickup.y - 20, `+${pickup.amount} AMMO`, '#f1c40f');
      world.audio.pickup();
    } else if (pickup.kind === 'package') {
      world.floatText(pickup.x, pickup.y - 20, 'PACKAGE SECURED', '#2ecc71');
      world.audio.pickup();
    }
  }
}

// E (steal / exit / shop) and the mission-complete / mission-failed screens
// live in main.js, not here: the world only simulates, the frame loop
// decides what a key press means and which screen is showing.

// Camera: follow the player, clamped to the map, with a shake that decays.
function trackCamera(world, dt) {
  const camera = world.camera;
  const p = world.player;
  const tx = Math.max(0, Math.min(MAP.w - VIEW.w, p.x - VIEW.w / 2));
  const ty = Math.max(0, Math.min(MAP.h - VIEW.h, p.y - VIEW.h / 2));
  camera.x += (tx - camera.x) * Math.min(1, 6 * dt);
  camera.y += (ty - camera.y) * Math.min(1, 6 * dt);
  if (camera.shake > 0) camera.shake = Math.max(0, camera.shake - 40 * dt);
}

export function stepWorld(world, dt, input, aimWorld) {
  world.time += dt;
  if (world.messageTimer > 0) world.messageTimer -= dt;

  // World-step order (fixed): player first, then traffic, police, peds, foes.
  if (world.player.inCar) {
    drivePlayerCar(world, dt, input);
  } else {
    stepOnFoot(world, dt, input, aimWorld);
  }
  stepTraffic(world, dt);
  stepPursuit(world, dt);
  resolveCollisions(world);
  stepHeat(world, dt);
  stepOfficers(world, dt);
  stepHelicopter(world, dt);
  stepPeds(world, dt);
  checkRunOvers(world);
  stepFoes(world, dt);
  stepJob(world, dt);
  stepBullets(world, dt);
  grabPickups(world);
  stepParticles(world, dt);
  trackCamera(world, dt);

  if (world.player.health <= 0 && world.screen === 'play') world.wasted();
}
