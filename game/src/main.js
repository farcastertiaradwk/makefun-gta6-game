// SOLMAR HEAT — boot, the one loop, screens and the wiring between systems.
// The world advances in fixed 1/60 s steps; the renderer paints what is there.
// Screens: title, play, paused, mission complete, mission failed, wasted,
// busted, victory. ?shot=cover|street|heli|bank stages a screenshot scene
// instead of running the loop, paints it twice and sets window.__shotReady.
//
// The story: Danny Reyes, a wheelman out of work, does jobs for Mara Voss and
// the Harbour Crew to take Solmar back from Kane and the Vipers.
import { STEP, WORLD, ROADS_X, ROADS_Y, PLAYER, ECONOMY, PALETTE, PLACES, WANTED } from './config.js';
import { createRandom } from './random.js';
import { createCity, isBlocked } from './city.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, ACTION_INTERACT, ACTION_RELOAD } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayerOnFoot, hurtPlayer, nearestStealableCar, enterCar, exitCar } from './player.js';
import { createCar, updatePlayerCar, updateTraffic, updatePoliceCars, collideCars, wreckCar, spawnTrafficCars } from './vehicles.js';
import { spawnPeds, updatePeds, checkRunOver, checkBulletHitPed } from './pedestrians.js';
import { updateWanted, updateCops, updateHeli } from './police.js';
import { MISSIONS, startMission, updateMission, updateEnemies } from './missions.js';
import { updateParticles, spawnExplosion } from './effects.js';
import { createHud, updateHud } from './hud.js';
import { createRenderer } from './render.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const minimapCanvas = document.getElementById('minimap');

function createWorld(seedValue) {
  const random = createRandom(seedValue);
  const city = createCity(random);
  const world = {
    random,
    city,
    time: 0,
    player: createPlayer(PLACES.safehouse.x, PLACES.safehouse.y),
    cars: [],
    peds: [],
    cops: [],
    enemies: [],
    bullets: [],
    particles: [],
    floaters: [],
    pickups: [],
    heat: 0,
    wanted: 0,
    lastCrimeAt: -1000,
    spawnTimer: 0,
    cash: ECONOMY.startCash,
    missionIndex: 0,
    mission: null,
    stats: { carsStolen: 0, pedsHit: 0, copsDown: 0, missionsDone: 0 },
    camera: { x: 0, y: 0, shake: 0 },
    message: null,
    prompt: '',
    interactHeld: false,
    heli: null,
    lastShotAt: -1000,
    lastShotX: 0,
    lastShotY: 0,
    lastExplosionAt: -1000,
    lastExplosionX: 0,
    lastExplosionY: 0,
    audio: createAudio(),
    screen: 'title',
  };
  // Wanted heat: a float behind the integer star count.
  world.addHeat = (n) => {
    world.heat = Math.min(WANTED.maxStars, world.heat + n);
    world.wanted = Math.floor(world.heat);
    world.lastCrimeAt = world.time;
  };
  world.setWanted = (n) => {
    world.heat = n;
    world.wanted = n;
    world.lastCrimeAt = world.time;
  };
  world.showMessage = (text, seconds) => {
    world.message = { text, until: world.time + (seconds || 4) };
  };
  world.floatText = (x, y, text, color) => {
    world.floaters.push({ x, y, text, color: color || '#ffffff', life: 1.4, max: 1.4 });
  };
  world.explode = (x, y) => spawnExplosion(world, x, y, true);
  return world;
}

function populateWorld(world) {
  // Traffic cars on the roads, parked cars at the kerb.
  spawnTrafficCars(world, 14);
  for (const spot of world.city.parkedSpots) {
    world.cars.push(createCar(spot.x, spot.y, spot.angle, world.random.pick(PALETTE.carColors), 'parked'));
  }
  spawnPeds(world, 22);
  // Health and ammo scattered where a player on foot will find them.
  world.pickups.push(
    { x: 700, y: 700, kind: 'health', taken: false },
    { x: 1500, y: 1000, kind: 'health', taken: false },
    { x: 1900, y: 1400, kind: 'health', taken: false },
    { x: 650, y: 1050, kind: 'ammo', taken: false },
    { x: 1850, y: 550, kind: 'ammo', taken: false },
    { x: 1050, y: 1450, kind: 'ammo', taken: false },
  );
}

const world = createWorld(seed);
populateWorld(world);
const renderer = createRenderer(canvas);
const hud = createHud();
const input = createInput(canvas);

// ---- screens (DOM overlays) ----
const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  mission: document.getElementById('screen-mission'),
  failed: document.getElementById('screen-failed'),
  wasted: document.getElementById('screen-wasted'),
  busted: document.getElementById('screen-busted'),
  victory: document.getElementById('screen-victory'),
};
const missionTitle = document.getElementById('mission-title');
const missionText = document.getElementById('mission-text');
const failedText = document.getElementById('failed-text');
const victoryStats = document.getElementById('victory-stats');
const continueBtn = document.getElementById('btn-continue');

function showScreen(name) {
  for (const key of Object.keys(screens)) {
    if (screens[key]) screens[key].classList.toggle('hidden', key !== name);
  }
  document.body.classList.toggle('playing', name === null);
  world.screen = name === null ? 'play' : name;
}

function newGame() {
  clearSave();
  input.actions = 0;
  world.cash = ECONOMY.startCash;
  world.missionIndex = 0;
  world.stats = { carsStolen: 0, pedsHit: 0, copsDown: 0, missionsDone: 0 };
  world.player = createPlayer(PLACES.safehouse.x, PLACES.safehouse.y);
  // Clear police and wrecks, keep the parked cars, bring the traffic back.
  world.cars = world.cars.filter((c) => c.kind === 'parked');
  spawnTrafficCars(world, 14);
  world.cops = [];
  world.enemies = [];
  world.bullets = [];
  world.setWanted(0);
  startMission(world, 0);
  showScreen(null);
  world.showMessage(MISSIONS[0].briefing, 6);
  world.audio.ensure();
}

function continueGame() {
  const save = loadGame();
  if (!save) { newGame(); return; }
  input.actions = 0;
  world.cash = save.cash;
  world.missionIndex = Math.min(save.missionIndex, MISSIONS.length - 1);
  world.stats = save.stats || world.stats;
  world.player = createPlayer(PLACES.safehouse.x, PLACES.safehouse.y);
  world.player.armor = save.armor || 0;
  world.player.reserve = save.reserve || 48;
  world.setWanted(0);
  startMission(world, world.missionIndex);
  showScreen(null);
  world.showMessage(`Welcome back. ${MISSIONS[world.missionIndex].briefing}`, 6);
  world.audio.ensure();
}

function respawn(fine) {
  world.cash = Math.max(0, world.cash - fine);
  world.player = createPlayer(PLACES.safehouse.x, PLACES.safehouse.y);
  world.cops = [];
  world.setWanted(0);
  world.heli = null;
  const cars = world.cars.filter((c) => c.kind === 'police');
  for (const c of cars) c.wrecked = true;
  startMission(world, world.missionIndex);
  showScreen(null);
}

world.busted = () => {
  world.audio.fail();
  showScreen('busted');
};
world.wasted = () => {
  world.audio.fail();
  showScreen('wasted');
};

document.getElementById('btn-new').addEventListener('click', newGame);
if (continueBtn) continueBtn.addEventListener('click', continueGame);
if (!hasSave() && continueBtn) continueBtn.classList.add('hidden');
document.getElementById('btn-resume').addEventListener('click', () => showScreen(null));
document.getElementById('btn-restart').addEventListener('click', () => { newGame(); });
document.getElementById('btn-quit').addEventListener('click', () => { saveGame(world); showScreen('title'); });
document.getElementById('btn-next-mission').addEventListener('click', () => {
  world.missionIndex += 1;
  if (world.missionIndex >= MISSIONS.length) {
    victoryStats.textContent = `Missions ${world.stats.missionsDone}/6 · Cars stolen ${world.stats.carsStolen} · Cops down ${world.stats.copsDown} · Cash $${world.cash}`;
    showScreen('victory');
  } else {
    startMission(world, world.missionIndex);
    showScreen(null);
    world.showMessage(MISSIONS[world.missionIndex].briefing, 6);
  }
});
document.getElementById('btn-retry').addEventListener('click', () => {
  startMission(world, world.missionIndex);
  showScreen(null);
});
document.getElementById('btn-respawn').addEventListener('click', () => respawn(ECONOMY.wastedFine));
document.getElementById('btn-respawn-busted').addEventListener('click', () => respawn(ECONOMY.bustFine));
document.getElementById('btn-freeroam').addEventListener('click', () => {
  world.mission = null;
  world.setWanted(0);
  showScreen(null);
  world.showMessage('Free roam. Solmar is yours — the story is done, the city is not.', 5);
});
document.getElementById('btn-victory-restart').addEventListener('click', () => newGame());

// ---- bullets, pickups, shops ----
function enemyDown(e) {
  spawnExplosion(world, e.x, e.y, false);
  if (e.boss) {
    world.cash += 500;
    world.floatText(e.x, e.y - 24, 'KANE DOWN +$500', '#ffd94d');
  } else {
    world.cash += 50;
    world.floatText(e.x, e.y - 24, '+$50', '#ffd94d');
  }
  world.audio.pickup();
}

function updateBullets(world, dt) {
  for (const b of world.bullets) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0) continue;
    if (isBlocked(world.city, b.x, b.y, 2, false)) {
      world.particles.push({ kind: 'spark', x: b.x, y: b.y, vx: 0, vy: 0, life: 0.15, max: 0.15, size: 6 });
      b.life = 0;
      continue;
    }
    if (b.from === 'player') {
      if (checkBulletHitPed(world, b)) { b.life = 0; continue; }
      let hit = false;
      for (const cop of world.cops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) {
          cop.health -= b.damage;
          world.audio.hit();
          hit = true;
          break;
        }
      }
      if (hit) { b.life = 0; continue; }
      for (const e of world.enemies) {
        if (e.health > 0 && Math.hypot(e.x - b.x, e.y - b.y) < 16) {
          e.health -= b.damage;
          world.audio.hit();
          if (e.health <= 0) enemyDown(e);
          hit = true;
          break;
        }
      }
      if (hit) { b.life = 0; continue; }
      for (const car of world.cars) {
        if (car.wrecked) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 24) {
          car.health -= b.damage;
          if (car.health <= 0) wreckCar(world, car);
          hit = true;
          break;
        }
      }
      if (hit) b.life = 0;
    } else {
      const p = world.player;
      if (p.inCar) {
        const car = p.inCar;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 24) {
          car.health -= b.damage;
          if (car.health <= 0) wreckCar(world, car);
          b.life = 0;
        }
      } else if (Math.hypot(p.x - b.x, p.y - b.y) < 14) {
        hurtPlayer(p, b.damage);
        world.audio.hit();
        b.life = 0;
        if (p.health <= 0) world.wasted();
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);
}

function updatePickups(world) {
  const p = world.player;
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 32) {
      pk.taken = true;
      if (pk.kind === 'health') {
        p.health = Math.min(PLAYER.health, p.health + 30);
        world.floatText(pk.x, pk.y - 20, '+30 HEALTH', '#7dff8a');
      } else if (pk.kind === 'ammo') {
        p.reserve += 24;
        world.floatText(pk.x, pk.y - 20, '+24 AMMO', '#ffd94d');
      } else if (pk.kind === 'package') {
        world.floatText(pk.x, pk.y - 20, 'PACKAGE SECURED', '#ffd94d');
      }
      world.audio.pickup();
    }
  }
}

function nearestShop(world) {
  const p = world.player;
  for (const key of ['gunshop', 'garage', 'safehouse']) {
    const s = PLACES[key];
    if (Math.hypot(s.x - p.x, s.y - p.y) < 80) return key;
  }
  return null;
}

function shopAction(world, key) {
  const p = world.player;
  if (key === 'gunshop') {
    if (world.cash < ECONOMY.ammoPrice) { world.showMessage('Not enough cash for ammo.', 2); return; }
    if (p.reserve >= 240) { world.showMessage('Ammo full.', 2); return; }
    world.cash -= ECONOMY.ammoPrice;
    p.reserve += ECONOMY.ammoAmount;
    world.showMessage(`Bought ${ECONOMY.ammoAmount} rounds.`, 2);
    world.audio.pickup();
  } else if (key === 'garage') {
    if (p.inCar && p.inCar.health < 100 && world.cash >= ECONOMY.repairPrice) {
      world.cash -= ECONOMY.repairPrice;
      p.inCar.health = 100;
      p.inCar.wrecked = false;
      world.showMessage('Car repaired.', 2);
      world.audio.pickup();
    } else if (world.wanted > 0 && world.cash >= ECONOMY.layLowPerStar * world.wanted) {
      world.cash -= ECONOMY.layLowPerStar * world.wanted;
      world.setWanted(0);
      world.showMessage('Lay low. The heat is off — for now.', 3);
      world.audio.pickup();
    } else if (world.wanted > 0) {
      world.showMessage(`Lay low costs $${ECONOMY.layLowPerStar * world.wanted}.`, 2);
    } else if (p.inCar) {
      world.showMessage('Car is already in good shape.', 2);
    } else {
      world.showMessage('Bring a car here to repair it.', 2);
    }
  } else if (key === 'safehouse') {
    p.health = PLAYER.health;
    saveGame(world);
    world.showMessage('Healed up. Progress saved.', 3);
    world.audio.pickup();
  }
}

// ---- one fixed step of the world ----
function stepWorld(dt, input) {
  world.time += dt;
  const player = world.player;
  const actions = input.takeActions();
  world.interactHeld = input.held('e');
  // Aim: mouse position in screen space, converted to world space.
  const camX = Math.max(0, Math.min(WORLD.w - canvas.clientWidth, player.x - canvas.clientWidth / 2));
  const camY = Math.max(0, Math.min(WORLD.h - canvas.clientHeight, player.y - canvas.clientHeight / 2));
  const aimWorld = { x: camX + input.mouseX, y: camY + input.mouseY };

  if (actions & ACTION_INTERACT) {
    if (player.inCar) {
      exitCar(world);
    } else {
      const shop = nearestShop(world);
      if (shop) shopAction(world, shop);
      else {
        const car = nearestStealableCar(world, 60);
        if (car) enterCar(world, car);
      }
    }
  }
  if (actions & ACTION_RELOAD && player.reloading <= 0 && player.reserve > 0) {
    player.reloading = PLAYER.reloadTime;
  }

  if (player.inCar) updatePlayerCar(world, dt, input);
  else updatePlayerOnFoot(world, dt, input, aimWorld);

  updateTraffic(world, dt);
  updatePoliceCars(world, dt);
  collideCars(world);
  updatePeds(world, dt);
  checkRunOver(world);
  updateCops(world, dt);
  updateHeli(world, dt);
  updateWanted(world, dt);
  updateEnemies(world, dt);
  updateBullets(world, dt);
  updatePickups(world);
  updateParticles(world, dt);
  updateMission(world, dt);

  // Shop prompt.
  const shop = nearestShop(world);
  if (shop === 'gunshop') world.prompt = 'E — Buy ammo $60';
  else if (shop === 'garage') world.prompt = player.inCar ? 'E — Repair $80 / Lay low' : 'E — Lay low (clear wanted)';
  else if (shop === 'safehouse') world.prompt = 'E — Heal & save';
  else if (!player.inCar && nearestStealableCar(world, 60)) world.prompt = 'E — Steal car';
  else world.prompt = '';

  if (world.camera.shake > 0) world.camera.shake = Math.max(0, world.camera.shake - dt * 30);
  if (player.health <= 0 && world.screen === 'play') world.wasted();

  // Mission end.
  const m = world.mission;
  if (m && m.status === 'complete') {
    world.cash += MISSIONS[m.index].reward;
    world.stats.missionsDone += 1;
    saveGame(world);
    world.audio.mission();
    missionTitle.textContent = `MISSION COMPLETE — ${MISSIONS[m.index].name}`;
    missionText.textContent = `${m.reason} Reward: $${MISSIONS[m.index].reward}.`;
    showScreen('mission');
  } else if (m && m.status === 'failed') {
    world.audio.fail();
    failedText.textContent = `${MISSIONS[m.index].name}: ${m.reason}`;
    showScreen('failed');
  }
}

// ---- the loop ----
let accumulator = 0;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) {
    if (world.screen === 'play') showScreen('pause');
    else if (world.screen === 'pause') showScreen(null);
  }
  if (actions & ACTION_MUTE) world.audio.toggleMute();
  if (actions & ACTION_CONFIRM) {
    if (world.screen === 'title') {
      if (hasSave()) continueGame();
      else newGame();
    }
  }
  // Hand the rest back: the world step is the only consumer of interact/reload.
  input.actions |= (actions & ~(ACTION_PAUSE | ACTION_MUTE | ACTION_CONFIRM));
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (world.screen === 'play' || world.screen === 'title') {
    while (accumulator >= STEP && (world.screen === 'play' || world.screen === 'title')) {
      // On the title screen the city lives on its own: no player input.
      const stepInput = world.screen === 'title'
        ? { axis: () => ({ x: 0, y: 0 }), held: () => false, shift: () => false, mouseDown: false, mouseX: 0, mouseY: 0, takeActions: () => 0 }
        : input;
      stepWorld(STEP, stepInput);
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
  }
  renderer.draw(world, world.screen);
  if (world.screen === 'play') updateHud(hud, world);
}

// ---- screenshot mode ----
function runShot(name) {
  showScreen(null); // hide the title overlay: the shot is gameplay, HUD included
  const game = {
    world,
    fakeInput: null,
    step: (dt, inputOverride) => stepWorld(dt, inputOverride),
  };
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen);
    updateHud(hud, world);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  showScreen('title');
  world.audio.ensure();
  requestAnimationFrame(frame);
}

// Test hooks: the playtest driver reads state and drives the game.
window.__game = {
  world,
  seed,
  startMission: (i) => startMission(world, i),
  setWanted: (n) => world.setWanted(n),
  newGame,
  continueGame,
  step: (dt, inputOverride) => stepWorld(dt, inputOverride || input),
};

if (shot) runShot(shot);
else runGame();
