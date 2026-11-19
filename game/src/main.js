// SOLMAR HEAT — entry point. Owns the world object, the game loop, the
// screen state machine (title / play / pause / brief / complete /
// wasted / busted / victory), shops, and the window.__game test hooks
// the driver uses to playtest. All drawing lives in render.js.
import { CFG } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { placePackages, stepPackages } from './collectibles.js';
import { newPlayer, makePickups, stepOnFoot, firePistol, reloadWeapon } from './player.js';
import { spawnTraffic, spawnParked, stepVehicles, stealVehicle, exitVehicle, makeVehicle, carSpeedKmh, nearestStealable } from './vehicles.js';
import { spawnPeds, stepPeds, checkRunOvers } from './pedestrians.js';
import { stepPolice, stepBullets, setWanted, addWanted } from './police.js';
import { startMission, updateMissions } from './missions.js';
import { makeEffects } from './effects.js';
import { makeAudio } from './audio.js';
import { writeSave, readSave, clearSave } from './save.js';
import { makeInput } from './input.js';
import { drawWorld, drawScreens, updateCamera, makeCamera } from './render.js';
import { stageShot, SHOT_NAMES } from './shots.js';

function buildWorld() {
  const rng = makeRng(CFG.world.seed);
  const city = buildCity(rng);
  const effects = makeEffects();
  const world = {
    time: 0, rng, city, effects,
    audio: makeAudio(),
    player: newPlayer(CFG.places.safehouse.x, CFG.places.safehouse.y),
    cars: [], cops: [], copCars: [], roadblocks: [], heli: null,
    peds: [], bullets: [], floats: [], enemies: [], markers: [],
    pickups: makePickups(),
    packages: placePackages(),
    collected: 0, cash: CFG.prices.startCash, wanted: 0, heatTimer: 0,
    screen: 'title', mission: null, pendingMission: null, lastReward: 0,
    camera: makeCamera(), keys: new Set(),
    mouse: { x: CFG.view.w / 2, y: CFG.view.h / 2, down: false },
    lastShotAt: -99, lastHeatAt: -99,
    hasSave: false, shotMode: null, shotReady: false, shotHoldUp: false,
    fakeInput: null, saveAt: 0, shop: null,
    police: { addWanted, setWanted },
  };
  world.booms = effects.booms;
  world.cars = [...spawnParked(world), ...spawnTraffic(world)];
  world.peds = spawnPeds(world);
  world.hasSave = !!readSave();
  world.toScreen = (s) => { world.screen = s; };
  return world;
}

// The input object outlives any one world: every rebuild re-links the
// live key set and mouse onto the fresh world, or held keys go dead.
function relink(game) {
  game.world.keys = game.input.keys;
  game.world.mouse = game.input.mouse;
}

function newGame(game, missionIndex) {
  game.world = buildWorld();
  relink(game);
  const w = game.world;
  startMission(w, missionIndex || 0);
  w.screen = 'brief';
}

function loadSave(game) {
  const s = readSave();
  if (!s) return false;
  game.world = buildWorld();
  relink(game);
  const w = game.world;
  w.cash = s.cash;
  w.player.hp = s.hp ?? CFG.player.hp;
  w.player.armor = s.armor ?? 0;
  for (const id of s.packages || []) {
    const pack = w.packages[id];
    if (pack) { pack.taken = true; w.collected++; }
  }
  startMission(w, s.mission || 0);
  w.screen = 'brief';
  return true;
}

function retryMission(game) {
  const idx = game.world.mission ? game.world.mission.index : 0;
  const cash = game.world.cash;
  const collected = game.world.collected;
  const taken = game.world.packages.filter((p) => p.taken).map((p) => p.id);
  game.world = buildWorld();
  relink(game);
  const w = game.world;
  w.cash = cash;
  w.collected = collected;
  for (const id of taken) { w.packages[id].taken = true; }
  startMission(w, idx);
  w.screen = 'play';
}

function openShop(world) {
  const p = world.player;
  const nearPlace = (pl, r) => Math.hypot(p.x - pl.x, p.y - pl.y) < r;
  if (!p.inCar && nearPlace(CFG.places.gunshop, 110)) { world.shop = { kind: 'gun', label: 'IRON & LEAD — GUN SHOP' }; return true; }
  if (p.inCar && nearPlace(CFG.places.garage, 130)) { world.shop = { kind: 'garage', label: 'FIX-IT GARAGE' }; return true; }
  if (!p.inCar && nearPlace(CFG.places.safehouse, 110)) {
    p.hp = CFG.player.hp;
    p.armor = Math.min(CFG.player.armorMax, p.armor + 50);
    setWanted(world, 0);
    writeSave(world);
    world.floats.push({ x: p.x, y: p.y - 30, text: 'Rested — saved', life: 1.6, color: '#7dff8a' });
    world.audio.pickup();
    return true;
  }
  return false;
}

function buyFromShop(world, n) {
  const shop = world.shop;
  if (!shop) return;
  const p = world.player;
  if (shop.kind === 'gun') {
    if (n === 1 && world.cash >= CFG.prices.ammo && p.reserve < CFG.player.reserveCap) {
      world.cash -= CFG.prices.ammo;
      p.reserve = Math.min(CFG.player.reserveCap, p.reserve + 48);
      world.audio.pickup();
    } else if (n === 2 && world.cash >= CFG.prices.armor && p.armor < CFG.player.armorMax) {
      world.cash -= CFG.prices.armor;
      p.armor = Math.min(CFG.player.armorMax, p.armor + 50);
      world.audio.pickup();
    }
  } else if (shop.kind === 'garage') {
    if (n === 1 && world.cash >= CFG.prices.repair && p.inCar && p.inCar.hp < p.inCar.maxHp) {
      world.cash -= CFG.prices.repair;
      p.inCar.hp = p.inCar.maxHp;
      world.audio.pickup();
    } else if (n === 2 && world.cash >= CFG.prices.layLowPerStar && world.wanted > 0) {
      world.cash -= CFG.prices.layLowPerStar;
      setWanted(world, world.wanted - 1);
      world.audio.pickup();
    }
  }
  world.shop = null;
}

function drawShop(ctx, world) {
  const shop = world.shop;
  if (!shop) return;
  const W = CFG.view.w;
  ctx.fillStyle = 'rgba(5,8,16,0.78)';
  ctx.fillRect(0, 0, W, CFG.view.h);
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(shop.label, W / 2, 250);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  const lines = shop.kind === 'gun'
    ? [`1 — Ammo +48  ($${CFG.prices.ammo})`, `2 — Armor +50  ($${CFG.prices.armor})`]
    : [`1 — Repair car  ($${CFG.prices.repair})`, `2 — Lay low, −1 star  ($${CFG.prices.layLowPerStar})`];
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 300 + i * 32));
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '15px sans-serif';
  ctx.fillText(`Cash: $${world.cash} · Esc to leave`, W / 2, 380);
}

function handleActions(game, actions) {
  const w = game.world;
  for (const a of actions) {
    if (a === CFG.keys.pause) {
      if (w.shop) { w.shop = null; continue; }
      if (w.screen === 'play') w.screen = 'pause';
      else if (w.screen === 'pause') w.screen = 'play';
      continue;
    }
    if (w.shop) {
      if (a === 'Digit1') buyFromShop(w, 1);
      else if (a === 'Digit2') buyFromShop(w, 2);
      continue;
    }
    if (a === CFG.keys.mute) {
      w.audio.setMuted(!w.audio.isMuted());
      continue;
    }
    if (a === CFG.keys.start) {
      if (w.screen === 'title') {
        if (w.hasSave && loadSave(game)) return;
        newGame(game, 0);
      } else if (w.screen === 'brief') {
        w.screen = 'play';
      } else if (w.screen === 'complete') {
        const next = w.pendingMission;
        game.world = buildWorld();
        relink(game);
        const nw = game.world;
        nw.cash = w.cash;
        nw.collected = w.collected;
        for (const pk of w.packages) if (pk.taken) nw.packages[pk.id].taken = true;
        startMission(nw, next);
        nw.screen = 'brief';
      } else if (w.screen === 'wasted' || w.screen === 'busted') {
        retryMission(game);
      } else if (w.screen === 'victory') {
        w.mission = null;
        w.screen = 'play';
      }
      continue;
    }
    if (a === 'KeyC' && w.screen === 'title') {
      clearSave(game);
      newGame(game, 0);
      continue;
    }
    if (a === 'KeyS' && w.screen === 'pause') {
      writeSave(w);
      game.world = buildWorld();
      relink(game);
      continue;
    }
    if (w.screen !== 'play') continue;
    if (a === CFG.keys.interact) {
      if (w.player.inCar) exitVehicle(w);
      else if (nearestStealable(w)) stealVehicle(w);
      else openShop(w);
    } else if (a === CFG.keys.reload) {
      reloadWeapon(w);
    } else if (a === 'MouseDown') {
      w.audio.unlock();
      firePistol(w);
    }
  }
}

function stepGame(game, dt) {
  const w = game.world;
  w.time += dt;
  if (w.screen === 'title') {
    // the city lives behind the title: traffic and peds keep moving
    stepVehicles(w, dt);
    stepPeds(w, dt);
    w.effects.step(dt);
    updateCamera(w);
    return;
  }
  if (w.screen !== 'play' || w.shop) return;
  const p = w.player;
  // aim follows the mouse on foot
  if (!p.inCar) {
    const wx = w.mouse.x + w.camera.x;
    const wy = w.mouse.y + w.camera.y;
    p.angle = Math.atan2(wy - p.y, wx - p.x);
  }
  if (p.inCar) stepVehicles(w, dt);
  else stepOnFoot(w, dt);
  stepPeds(w, dt);
  checkRunOvers(w);
  stepPolice(w, dt);
  stepBullets(w, dt);
  updateMissions(w, dt);
  stepPackages(w, dt);
  w.effects.step(dt);
  for (const fl of w.floats) fl.life -= dt;
  w.floats = w.floats.filter((f) => f.life > 0);
  // quiet autosave every 20 s of play
  w.saveAt += dt;
  if (w.saveAt > 20) {
    w.saveAt = 0;
    writeSave(w);
  }
  // engine + siren
  if (p.inCar) w.audio.engine(Math.abs(p.inCar.speed) / (p.inCar.kind === 'bike' ? CFG.bike.maxSpeed : CFG.car.maxSpeed));
  else w.audio.engine(0);
  w.audio.siren(w.wanted >= 2);
  updateCamera(w);
}

function render(game) {
  const { ctx } = game;
  const w = game.world;
  ctx.clearRect(0, 0, CFG.view.w, CFG.view.h);
  drawWorld(ctx, w);
  drawScreens(ctx, w);
  drawShop(ctx, w);
}

function snapshot(game) {
  const w = game.world;
  const p = w.player;
  return {
    screen: w.screen,
    mission: w.mission ? w.mission.index : null,
    missionName: w.mission ? w.mission.name : null,
    objective: w.mission ? w.mission.objective : null,
    stage: w.mission ? w.mission.stage : null,
    timer: w.mission ? Math.ceil(w.mission.timer || 0) : 0,
    wanted: w.wanted,
    cash: w.cash,
    hp: Math.ceil(p.hp),
    armor: Math.ceil(p.armor),
    mag: p.mag,
    reserve: p.reserve,
    inCar: !!p.inCar,
    carKind: p.inCar ? p.inCar.kind : null,
    speedKmh: p.inCar ? carSpeedKmh(p.inCar) : 0,
    x: Math.round(p.x),
    y: Math.round(p.y),
    cops: w.cops.length,
    copCars: w.copCars.length,
    enemiesAlive: w.enemies.filter((e) => e.hp > 0).length,
    packages: w.collected,
    bullets: w.bullets.length,
  };
}

function jumpTo(game, i) {
  const w = game.world;
  if (w.screen !== 'play') w.screen = 'play';
  w.shop = null;
  startMission(w, i);
  const p = w.player;
  if (i === 4) {
    if (p.inCar) exitVehicle(w);
    p.x = 2150;
    p.y = 720;
  } else if (i === 5) {
    if (p.inCar) exitVehicle(w);
    p.x = 1000;
    p.y = 970;
  } else if (i === 6) {
    if (p.inCar) exitVehicle(w);
    p.x = 2300;
    p.y = 1350;
  } else if (i === 7) {
    if (p.inCar) exitVehicle(w);
    p.x = 1000;
    p.y = 1150;
    p.mag = CFG.player.magSize;
    p.reserve = CFG.player.reserveStart;
  }
  updateCamera(w);
}

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const game = { canvas, ctx, world: buildWorld() };
  const input = makeInput(canvas);
  game.input = input;
  relink(game);
  input.attach();
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot && SHOT_NAMES.includes(shot)) {
    game.world.shotMode = shot;
    game.world.fakeInput = null;
    stageShot(game.world, shot);
    // settle ~20 frames so police, traffic and particles find their marks
    for (let f = 0; f < 20; f++) {
      if (game.world.shotHoldUp) game.world.keys.add(CFG.keys.up);
      stepGame(game, 1 / 60);
    }
    game.world.keys.delete(CFG.keys.up);
    game.world.shotReady = true;
  }
  let last = performance.now();
  let frozen = !!shot;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      if (!frozen) {
        const actions = input.takeActions();
        handleActions(game, actions);
        stepGame(game, dt);
      }
      render(game);
    } catch (err) {
      // one bad frame must never kill the loop: report it, keep playing
      console.error('frame error:', err && err.message);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__game = {
    get world() { return game.world; },
    get shotReady() { return game.world.shotReady; },
    snapshot: () => snapshot(game),
    start: () => { if (game.world.screen === 'title') newGame(game, 0); },
    jump: (i) => jumpTo(game, i),
    warp: (x, y) => {
      const p = game.world.player;
      p.x = x;
      p.y = y;
      if (p.inCar) { p.inCar.x = x; p.inCar.y = y; }
      updateCamera(game.world);
    },
    giveCar: (kind) => {
      const p = game.world.player;
      const car = makeVehicle(kind || 'car', p.x + 40, p.y, 0, '#c0392b');
      car.driver = 'player';
      game.world.cars.push(car);
      p.inCar = car;
      return true;
    },
    setWanted: (n) => setWanted(game.world, n),
    setCash: (n) => { game.world.cash = n; },
    key: (code, down) => {
      if (down) game.world.keys.add(code);
      else game.world.keys.delete(code);
    },
    aimAt: (x, y) => {
      const w = game.world;
      w.mouse.x = x - w.camera.x;
      w.mouse.y = y - w.camera.y;
      w.player.angle = Math.atan2(y - w.player.y, x - w.player.x);
    },
    click: () => { firePistol(game.world); },
    holdE: (on) => { game.world.fakeInput = on ? { held: () => true } : null; },
    enemies: () => game.world.enemies.map((e) => ({ x: Math.round(e.x), y: Math.round(e.y), hp: e.hp, name: e.name })),
  };
  return game;
}

const canvas = document.getElementById('game');
if (canvas) createGame(canvas);
