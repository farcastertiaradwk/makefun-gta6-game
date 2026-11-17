// SOLMAR HEAT — main loop, screens and the test hooks.
// This module owns the world object and the frame: read the input, step the
// systems in a fixed order (player, cars, peds, police, missions, effects),
// move the camera, draw the world, the HUD and the screens. The update
// order never changes, so the game behaves the same way every run.
// window.__game exposes the world and startMission for the headless
// playtest driver; ?shot=<name> stages a screenshot scene instead of
// playing, and ?seed=<n> picks the city seed (7 by default).

import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { makePlayer, updatePlayer, interactLabel, useShop, reloadWeapon } from './player.js';
import { spawnTraffic, spawnParked, updateCars, stealCar, exitCar } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { updatePolice } from './police.js';
import { startMission, updateMission, nextMission, retryMission, placeSupplies } from './missions.js';
import { updateEffects } from './effects.js';
import { drawHud } from './hud.js';
import { drawFrame, drawScreens, updateCamera } from './render.js';
import { saveGame, loadSave, hasSave } from './save.js';
import { runShot } from './shots.js';
import { KEYS, SCREENS, CARS, PLAYER } from './config.js';

/** A fresh id counter for entities. Quirk from the design: this counter is
 *  declared here and never incremented — entities take ids from their own
 *  module counters instead, so nextId stays at its starting value. */
let nextId = 1;

/** Rebuild the world in place (same object, fresh contents). */
function resetWorld(world, seed) {
  world.seed = seed;
  world.rng = makeRng(seed);
  world.city = buildCity(world.rng);
  world.time = 0;
  world.cash = PLAYER.startCash;
  world.wanted = 0;
  world.screen = SCREENS.title;
  world.mission = null;
  world.marker = null;
  world.missionsDone = 0;
  world.maraRiding = false;
  world.heli = null;
  world.roadblockAt = null;
  world.quietTime = 0;
  world.spawnTimer = 0;
  world.lastCrimeAt = 0;
  world.lastShootHeatAt = -99;
  world.lastRunoverHeatAt = -99;
  world.lastPedTopUp = 0;
  world.autosaveAt = 0;
  world.prompt = null;
  world.uiButtons = [];
  world.camera = { x: 0, y: 0 };
  world.player = makePlayer();
  world.cars = [];
  world.peds = [];
  world.cops = [];
  world.enemies = [];
  world.bullets = [];
  world.particles = [];
  world.pickups = [];
  world.texts = [];
  // RNG consumption order, fixed for a given seed: city, traffic, parked
  // cars, pedestrians, then the supply pickups (which use no RNG).
  spawnTraffic(world, CARS.trafficCount);
  spawnParked(world, CARS.parkedCount);
  spawnPeds(world, 24);
  placeSupplies(world);
}

/** Start a new game from the beginning: fresh world, mission 1, playing. */
function newGame(game) {
  const world = game.world;
  resetWorld(world, world.seed);
  startMission(world, 0);
  world.screen = SCREENS.play;
  world.audio.ensure();
}

/** Continue from the saved game, or start fresh when there is no save. */
function continueGame(game) {
  const data = loadSave();
  if (!data) {
    newGame(game);
    return;
  }
  const world = game.world;
  resetWorld(world, world.seed);
  world.cash = data.cash;
  world.missionsDone = data.missionsDone || 0;
  world.player.x = data.player.x;
  world.player.y = data.player.y;
  world.player.health = data.player.health;
  world.player.armor = data.player.armor;
  world.player.weapon.mag = data.player.mag;
  world.player.weapon.reserve = data.player.reserve;
  startMission(world, data.missionIndex || 0);
  world.screen = SCREENS.play;
}

/** The E key: exit the car, crack the safe, use a shop, or steal a car.
 *  The bank safe is checked before stealing so a held E near the vault
 *  cracks it instead of yanking the player into a parked car. */
function handleInteract(game) {
  const world = game.world;
  const p = world.player;
  if (p.inCar) {
    exitCar(world);
    return;
  }
  if (world.mission && world.mission.index === 4 && world.mission.stage === 1) {
    const s = world.city.bankSafe;
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < 100) return; // holding E cracks the safe; the mission owns it
  }
  if (useShop(world)) return;
  const car = stealCar(world);
  if (car && world.mission && world.mission.index === 0 && world.mission.stage === 0) {
    world.mission.stage = 1;
    world.mission.objective = 'Drive to The Docks';
    world.marker = { x: 2350, y: 1350 };
  }
}

/** Keys and clicks that work on every screen. */
function handleScreenKeys(game) {
  const world = game.world;
  const input = world.input;
  if (input.wasPressed(KEYS.mute)) {
    world.audio.setMuted(!world.audio.isMuted());
    input.consume(KEYS.mute);
  }
  if (world.screen === SCREENS.title) {
    if (input.wasPressed(KEYS.start)) {
      input.consume(KEYS.start);
      newGame(game);
    }
  } else if (world.screen === SCREENS.play) {
    if (input.wasPressed(KEYS.pause)) {
      input.consume(KEYS.pause);
      world.screen = SCREENS.pause;
      world.audio.engine(0);
      world.audio.siren(false);
    }
    if (input.wasPressed(KEYS.interact)) {
      input.consume(KEYS.interact);
      handleInteract(game);
    }
    if (input.wasPressed(KEYS.reload)) {
      input.consume(KEYS.reload);
      reloadWeapon(world);
    }
  } else if (world.screen === SCREENS.pause) {
    if (input.wasPressed(KEYS.pause) || input.wasPressed(KEYS.start)) {
      input.consume(KEYS.pause);
      input.consume(KEYS.start);
      world.screen = SCREENS.play;
    }
  } else if (world.screen === SCREENS.missionDone) {
    if (input.wasPressed(KEYS.start)) {
      input.consume(KEYS.start);
      nextMission(world);
    }
  } else if (world.screen === SCREENS.missionFailed) {
    if (input.wasPressed(KEYS.start)) {
      input.consume(KEYS.start);
      retryMission(world);
    }
  } else if (world.screen === SCREENS.wasted || world.screen === SCREENS.busted) {
    if (input.wasPressed(KEYS.start) || input.wasPressed(KEYS.reload)) {
      input.consume(KEYS.start);
      input.consume(KEYS.reload);
      newGame(game);
    }
  } else if (world.screen === SCREENS.victory) {
    if (input.wasPressed(KEYS.start)) {
      input.consume(KEYS.start);
      newGame(game);
    }
  }
  // Clickable screen buttons.
  if (input.mouse.clicked && world.screen !== SCREENS.play) {
    const mx = input.mouse.clickX;
    const my = input.mouse.clickY;
    for (const b of world.uiButtons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        world.audio.click();
        if (b.id === 'start' || b.id === 'restart') newGame(game);
        else if (b.id === 'continue') continueGame(game);
        else if (b.id === 'resume') world.screen = SCREENS.play;
        else if (b.id === 'quit') {
          resetWorld(world, world.seed);
          world.screen = SCREENS.title;
        } else if (b.id === 'next') nextMission(world);
        else if (b.id === 'retry') retryMission(world);
        break;
      }
    }
  }
}

/** One frame of simulation, in the fixed update order. */
function stepGame(game, dt) {
  const world = game.world;
  handleScreenKeys(game);
  if (world.screen === SCREENS.play) {
    world.time += dt;
    updatePlayer(world, dt);
    updateCars(world, dt);
    updatePeds(world, dt);
    updatePolice(world, dt);
    updateMission(world, dt);
    updateEffects(world, dt);
    updateCamera(world);
    world.prompt = interactLabel(world);
    // Engine hum follows the car; quiet on foot.
    const car = world.player.inCar;
    world.audio.engine(car ? Math.abs(car.speed) / CARS.topSpeed : 0);
    // Quiet autosave while playing, every 20 seconds.
    if (world.time - world.autosaveAt > 20) {
      world.autosaveAt = world.time;
      saveGame(world);
    }
  } else if (world.screen === SCREENS.title) {
    // The city lives behind the title: traffic and peds keep moving.
    world.time += dt;
    updateCars(world, dt);
    updatePeds(world, dt);
    updateEffects(world, dt);
    updateCamera(world);
  }
  // Other screens freeze the world; the render below still runs.
}

/** Draw one frame. */
function renderGame(game) {
  const world = game.world;
  const ctx = game.ctx;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawFrame(ctx, world);
  if (world.screen === SCREENS.play || world.screen === SCREENS.pause) {
    drawHud(ctx, world);
  }
  drawScreens(ctx, world);
}

/** Build the game object and boot it. Returns the game (also window.__game). */
export function createGame(seed) {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const input = makeInput(canvas);
  const audio = makeAudio();
  input.attach();
  const world = {
    seed,
    input,
    audio,
    hasSave: hasSave(),
  };
  resetWorld(world, seed);
  world.screen = SCREENS.title;
  const game = {
    world,
    input,
    audio,
    canvas,
    ctx,
    shotMode: false,
    step: (dt) => stepGame(game, dt),
    newGame: () => newGame(game),
    startMission: (i) => startMission(world, i),
    continueGame: () => continueGame(game),
  };
  // Audio needs a gesture first; unlock on the first key or click.
  const unlock = () => audio.ensure();
  window.addEventListener('keydown', unlock, { once: true });
  canvas.addEventListener('mousedown', unlock, { once: true });
  return game;
}

/** Boot from the page: read the URL, build the game, run the loop. */
function boot() {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get('seed') || '7';
  const shot = params.get('shot');
  const game = createGame(seed);
  window.__game = game;
  if (shot) {
    // Screenshot mode: stage the scene, freeze it, flag readiness.
    game.newGame();
    runShot(game, shot);
    game.shotMode = true;
    renderGame(game);
    window.__shotReady = true;
  }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!game.shotMode) {
      stepGame(game, dt);
      renderGame(game);
    }
    game.input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
