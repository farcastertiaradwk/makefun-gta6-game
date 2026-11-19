// SOLMAR HEAT — the game loop, the screens, and the test hooks.
// One game object holds the whole world; every system steps it in turn:
// player, vehicles, pedestrians, police, missions, collectibles, effects.
// The loop draws through render.js and listens for menu buttons and keys.

import { WORLD, PLAYER } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { makeInput } from './input.js';
import { makePlayer, stepPlayer, hurtPlayer } from './player.js';
import { spawnParked, spawnTraffic, stepVehicles, stealCar } from './vehicles.js';
import { spawnPeds, stepPeds } from './pedestrians.js';
import { addWanted, setWanted, stepPolice, damageEnemy } from './police.js';
import { startMission, stepMissions, advanceAfterComplete, MISSION_LIST } from './missions.js';
import { spawnHiddenPackages, stepCollectibles } from './collectibles.js';
import { makeEffects, stepEffects } from './effects.js';
import { drawFrame } from './render.js';
import { makeAudio } from './audio.js';
import { saveProgress, loadProgress, hasSave } from './save.js';
import { stageShot } from './shots.js';

const PICKUP_SPOTS = [
  { x: 420, y: 1700, kind: 'health' },
  { x: 900, y: 500, kind: 'health' },
  { x: 1600, y: 1200, kind: 'ammo' },
  { x: 2100, y: 1600, kind: 'health' },
  { x: 1200, y: 2100, kind: 'ammo' },
  { x: 700, y: 2200, kind: 'health' },
];

export function createGame(input, audio) {
  const rng = makeRng(WORLD.seed);
  const city = buildCity(rng);
  const game = {
    time: 0,
    screen: 'title',
    rng,
    city,
    cityPlaces: WORLD.places,
    worldRoads: WORLD.roads,
    player: makePlayer(WORLD.places.safehouse.x, WORLD.places.safehouse.y),
    cars: [],
    peds: [],
    cops: [],
    roadblocks: [],
    bullets: [],
    enemies: [],
    fx: makeEffects(),
    audio,
    input,
    camera: { x: 0, y: 0 },
    cash: 150,
    wanted: 0,
    bestWanted: 0,
    lastSeenAt: -99,
    decayAt: 0,
    missionIndex: 0,
    missionStage: 0,
    missionTimer: 0,
    missionData: null,
    missionFailed: null,
    crack: 0,
    crackBand: 0,
    fare: null,
    fareIndex: 0,
    crate: false,
    mara: null,
    cab: null,
    packagesGot: 0,
    loadedPackages: 0,
    hiddenPackages: [],
    pickups: PICKUP_SPOTS.map((s) => ({ ...s, taken: false })),
    shopPrompt: null,
    interactPrompt: null,
    objectiveText: '',
    marker: null,
    briefTitle: '',
    briefText: '',
    completeTitle: '',
    completeText: '',
    buttons: [],
    hasSave: hasSave(),
    shotMode: null,
    settleSteps: 0,
    freezeAfterSettle: false,
    freezeSpeed: 0,
    shotReady: false,
    autosaveAt: 0,
  };
  // Cross-module calls, wired here so no two modules import each other.
  game.addWanted = (kind) => addWanted(game, kind);
  game.setWanted = (stars) => setWanted(game, stars);
  game.hurtPlayer = (dmg) => hurtPlayer(game, dmg);
  game.wasted = () => {
    game.screen = 'wasted';
    game.audio.fail();
    game.audio.siren(false);
  };
  game.busted = () => {
    game.cash = Math.max(0, game.cash - 100);
    game.screen = 'busted';
    game.audio.fail();
    game.audio.siren(false);
  };
  spawnParked(game);
  spawnTraffic(game, 16);
  spawnPeds(game, 26);
  spawnHiddenPackages(game);
  return game;
}

// A fresh start: a new world, mission one, brief on screen.
export function startNewGame(input, audio) {
  const game = createGame(input, audio);
  startMission(game, 0);
  return game;
}

// Continue from a save: cash, mission and packages restored.
export function continueSaved(input, audio) {
  const saved = loadProgress();
  const game = createGame(input, audio);
  if (saved) {
    game.cash = saved.cash;
    game.loadedPackages = saved.packagesGot;
    game.packagesGot = saved.packagesGot;
    spawnHiddenPackages(game);
    startMission(game, saved.missionIndex);
  } else {
    startMission(game, 0);
  }
  return game;
}

// Restart the current mission after a waste, a bust or a failed job.
export function resetForMission(game, index) {
  const p = game.player;
  p.x = WORLD.places.safehouse.x;
  p.y = WORLD.places.safehouse.y;
  p.hp = PLAYER.hp;
  p.armor = 0;
  p.inCar = null;
  p.mag = 12;
  p.reserve = 48;
  p.reloading = 0;
  p.angle = -Math.PI / 2;
  game.wanted = 0;
  game.cops = [];
  game.roadblocks = [];
  game.bullets = [];
  game.enemies = [];
  game.heli = null;
  game.cars = game.cars.filter((c) => !c.isCop);
  startMission(game, index);
}

export function stepGame(game, dt) {
  game.time += dt;
  if (game.screen === 'title') {
    // The city lives behind the title: traffic rolls, peds stroll.
    stepVehicles(game, dt);
    stepPeds(game, dt);
    stepEffects(game.fx, dt);
    return;
  }
  if (game.screen !== 'play') return;
  // A quiet autosave every 20 seconds of play.
  if (game.time - game.autosaveAt > 20) {
    game.autosaveAt = game.time;
    saveProgress(game);
  }
  stepPlayer(game, dt);
  // E near a parked car or a bike steals it (shops already had their turn).
  // Not at the bank vault mid-crack: there, E belongs to the safe.
  const atVault =
    game.missionIndex === 4 &&
    game.missionStage === 1 &&
    !game.player.inCar &&
    Math.hypot(game.player.x - WORLD.places.bankSafe.x, game.player.y - WORLD.places.bankSafe.y) < 70;
  if (!atVault && !game.player.inCar && game.input.take('interact')) {
    if (stealCar(game)) {
      game.input.clearActions();
    }
  }
  stepVehicles(game, dt);
  stepPeds(game, dt);
  stepPolice(game, dt);
  stepMissions(game, dt);
  stepCollectibles(game, dt);
  stepEffects(game.fx, dt);
  // Busted: a foot cop lays hands on Danny while the heat is on.
  const p = game.player;
  if (!p.inCar && game.wanted > 0) {
    for (const cop of game.cops) {
      if (!cop.dead && Math.hypot(cop.x - p.x, cop.y - p.y) < 26) {
        game.busted();
        break;
      }
    }
  }
  // The engine hum follows the player's speed.
  const speed01 = p.inCar ? Math.abs(p.inCar.speed) / 520 : p.speed / 330;
  game.audio.engine(speed01);
}

// ------------------------------------------------------------- menu input

function clickButton(game) {
  const m = game.input.mouse;
  for (const b of game.buttons) {
    if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) {
      return b.id;
    }
  }
  return null;
}

function handleMenu(game) {
  const input = game.input;
  if (input.take('mute')) game.audio.toggleMute();
  if (game.screen === 'play') {
    if (input.take('pause')) {
      game.screen = 'pause';
      game.audio.engine(0);
    }
    return;
  }
  if (game.screen === 'pause') {
    if (input.take('pause')) game.screen = 'play';
  }
  const clicked = input.mouse.clicked ? clickButton(game) : null;
  const confirmed = input.take('confirm');
  const go = (id) => clicked === id || confirmed;
  if (game.screen === 'title') {
    if (go('start') || go('start2')) {
      return { action: 'new' };
    }
    if (go('continue')) {
      return { action: 'continue' };
    }
  } else if (game.screen === 'brief') {
    if (go('go')) game.screen = 'play';
  } else if (game.screen === 'complete') {
    if (go('next')) advanceAfterComplete(game);
  } else if (game.screen === 'failed') {
    if (go('retry')) resetForMission(game, game.missionIndex);
  } else if (game.screen === 'wasted' || game.screen === 'busted') {
    if (go('retry')) resetForMission(game, game.missionIndex);
  } else if (game.screen === 'victory') {
    if (go('again')) return { action: 'new' };
  } else if (game.screen === 'pause') {
    if (clicked === 'resume' || confirmed) game.screen = 'play';
    if (clicked === 'restart') resetForMission(game, game.missionIndex);
  }
  return null;
}

// ------------------------------------------------------------------- boot

export function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const input = makeInput(canvas);
  input.attach();
  const audio = makeAudio();
  let game = createGame(input, audio);
  game.audio.ensure();

  // A staged screenshot: ?shot=cover|street|heli|bank
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  let shotFrames = 0;
  if (shot) {
    // The page hint is chrome, not game: hide it so the frame is clean.
    const hint = document.getElementById('hint');
    if (hint) hint.style.display = 'none';
    stageShot(game, shot);
  }

  function exposeHooks() {
    window.__game = {
      game,
      start() {
        game = startNewGame(input, audio);
        exposeHooks();
        return state();
      },
      mission(i) {
        resetForMission(game, i);
        game.screen = 'play';
        return state();
      },
      teleport(x, y) {
        const at = game.player.inCar || game.player;
        at.x = x;
        at.y = y;
        if (game.player.inCar) {
          game.player.x = x;
          game.player.y = y;
        }
        return state();
      },
      setCash(n) {
        game.cash = n;
        return state();
      },
      hurtBoss(dmg) {
        const kane = game.enemies.find((e) => e.boss && !e.dead);
        if (kane) damageEnemy(game, kane, dmg);
        return state();
      },
      hurtEnemy(dmg) {
        const e = game.enemies.find((v) => !v.dead);
        if (e) damageEnemy(game, e, dmg);
        return state();
      },
      step(n) {
        for (let i = 0; i < n; i++) stepGame(game, 1 / 60);
        drawFrame(ctx, game, canvas.width, canvas.height);
        return state();
      },
      state,
    };
  }

  function state() {
    const p = game.player;
    const kane = game.enemies.find((e) => e.boss);
    return {
      screen: game.screen,
      x: Math.round(p.x),
      y: Math.round(p.y),
      inCar: !!p.inCar,
      carKind: p.inCar ? p.inCar.kind : null,
      carHp: p.inCar ? Math.round(p.inCar.hp) : null,
      speed: p.inCar ? Math.round(Math.abs(p.inCar.speed)) : Math.round(p.speed),
      wanted: game.wanted,
      cash: game.cash,
      hp: Math.round(p.hp),
      armor: Math.round(p.armor),
      mag: p.mag,
      reserve: p.reserve,
      mission: game.missionIndex,
      stage: game.missionStage,
      objective: game.objectiveText,
      timer: Math.round(game.missionTimer),
      crack: Math.round(game.crack * 100),
      cops: game.cops.filter((c) => !c.dead).length,
      copCars: game.cars.filter((c) => c.isCop && !c.wrecked).length,
      bullets: game.bullets.length,
      enemies: game.enemies.filter((e) => !e.dead).length,
      kaneHp: kane ? Math.round(kane.hp) : null,
      packagesGot: game.packagesGot,
      fare: !!game.fare,
      crate: game.crate,
      maraAboard: game.mara ? game.mara.aboard : null,
    };
  }

  exposeHooks();

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (game.shotMode) {
      // Staged shots render frozen: no stepping, no drift.
      drawFrame(ctx, game, canvas.width, canvas.height);
      shotFrames += 1;
      if (shotFrames === 3 && !game.shotReady) {
        game.shotReady = true;
        window.__shotReady = true;
      }
      return;
    }
    const action = handleMenu(game);
    if (action && action.action === 'new') {
      game = startNewGame(input, audio);
      exposeHooks();
    } else if (action && action.action === 'continue') {
      game = continueSaved(input, audio);
      exposeHooks();
    }
    stepGame(game, dt);
    drawFrame(ctx, game, canvas.width, canvas.height);
    game.input.mouse.clicked = false;
    if (game.screen === 'play') {
      game.audio.resume();
    }
  }
  requestAnimationFrame(frame);
  return game;
}

boot();
