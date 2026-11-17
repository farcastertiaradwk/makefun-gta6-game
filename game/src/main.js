// SOLMAR HEAT — the game object: one world, a fixed-step loop, the screens,
// and the wiring between systems. The world advances in fixed 1/60 s steps
// in a set order, so a replay with the same seed plays out the same way.
// Screens: title, play, pause, mission complete, mission failed, wasted,
// busted, victory. ?shot=cover|street|heli|bank stages a screenshot scene
// instead of running the loop, paints it twice and sets window.__shotReady.
//
// The story: Danny Reyes, a wheelman out of work, does jobs for Mara Voss
// and the Harbour Crew to take Solmar back from Kane and the Vipers.
import { STEP, WORLD, PLAYER, ECONOMY, PALETTE, PLACES, WANTED } from './config.js';
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
const AUTOSAVE_SECONDS = 20;

// A bare world: data only. The verbs are attached by createGame, and the
// stock (cars, walkers, pickups) by stockWorld.
function blankWorld(seedValue) {
  const random = createRandom(seedValue);
  const city = createCity(random);
  return {
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
    audio: null,
    screen: 'title',
    saveTimer: 0,
  };
}

function fillWorld(world) {
  // Traffic first, then the parked cars at the kerb, then the walkers.
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

export function createGame({ canvas, hud, audio, input, seed }) {
  const renderer = createRenderer(canvas);
  const world = blankWorld(seed);
  world.audio = audio;
  fillWorld(world);
  let accumulator = 0;

  // --- screens (DOM overlays) --------------------------------------------
  const SCREEN_IDS = {
    title: 'screen-title',
    pause: 'screen-pause',
    mission: 'screen-mission',
    failed: 'screen-failed',
    wasted: 'screen-wasted',
    busted: 'screen-busted',
    victory: 'screen-victory',
  };

  function setScreen(name) {
    world.screen = name;
    for (const id of Object.values(SCREEN_IDS)) {
      document.getElementById(id).classList.add('hidden');
    }
    if (SCREEN_IDS[name]) document.getElementById(SCREEN_IDS[name]).classList.remove('hidden');
    document.body.classList.toggle('playing', name === 'play');
    document.getElementById('hud').classList.toggle('hidden', name !== 'play' && name !== 'pause');
    if (name === 'title') {
      document.getElementById('btn-continue').classList.toggle('hidden', !hasSave());
    }
  }

  // --- the verbs the modules call back into --------------------------------
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
  world.busted = () => {
    world.audio.fail();
    setScreen('busted');
  };
  world.wasted = () => {
    world.audio.fail();
    setScreen('wasted');
  };

  function sendPlayerHome() {
    world.player = createPlayer(PLACES.safehouse.x, PLACES.safehouse.y);
  }

  function startFresh() {
    clearSave();
    input.actions = 0;
    world.cash = ECONOMY.startCash;
    world.missionIndex = 0;
    world.stats = { carsStolen: 0, pedsHit: 0, copsDown: 0, missionsDone: 0 };
    sendPlayerHome();
    // Clear police and wrecks, keep the parked cars, bring the traffic back.
    world.cars = world.cars.filter((c) => c.kind === 'parked');
    spawnTrafficCars(world, 14);
    world.cops = [];
    world.enemies = [];
    world.bullets = [];
    world.setWanted(0);
    startMission(world, 0);
    setScreen('play');
    world.showMessage(MISSIONS[0].briefing, 6);
    world.audio.ensure();
  }

  function resumeSaved() {
    const save = loadGame();
    if (!save) {
      startFresh();
      return;
    }
    input.actions = 0;
    world.cash = save.cash;
    world.missionIndex = Math.min(save.missionIndex, MISSIONS.length - 1);
    world.stats = save.stats || world.stats;
    sendPlayerHome();
    world.player.armor = save.armor || 0;
    world.player.reserve = save.reserve || 48;
    world.setWanted(0);
    startMission(world, world.missionIndex);
    setScreen('play');
    world.showMessage(`Welcome back. ${MISSIONS[world.missionIndex].briefing}`, 6);
    world.audio.ensure();
  }

  function respawn(fine) {
    world.cash = Math.max(0, world.cash - fine);
    sendPlayerHome();
    world.cops = [];
    world.setWanted(0);
    world.heli = null;
    for (const c of world.cars) {
      if (c.kind === 'police') c.wrecked = true;
    }
    startMission(world, world.missionIndex);
    setScreen('play');
  }

  // --- shops, prompts, pickups ---------------------------------------------
  function shopNearby() {
    const p = world.player;
    for (const key of ['gunshop', 'garage', 'safehouse']) {
      const s = PLACES[key];
      if (Math.hypot(s.x - p.x, s.y - p.y) < 80) return key;
    }
    return null;
  }

  function buyAmmo() {
    const p = world.player;
    if (world.cash < ECONOMY.ammoPrice) {
      world.showMessage('Not enough cash for ammo.', 2);
      return;
    }
    if (p.reserve >= 240) {
      world.showMessage('Ammo full.', 2);
      return;
    }
    world.cash -= ECONOMY.ammoPrice;
    p.reserve += ECONOMY.ammoAmount;
    world.showMessage(`Bought ${ECONOMY.ammoAmount} rounds.`, 2);
    world.audio.pickup();
  }

  function useGarage() {
    const p = world.player;
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
  }

  function useSafehouse() {
    world.player.health = PLAYER.health;
    saveGame(world);
    world.showMessage('Healed up. Progress saved.', 3);
    world.audio.pickup();
  }

  function shopAction(key) {
    if (key === 'gunshop') buyAmmo();
    else if (key === 'garage') useGarage();
    else if (key === 'safehouse') useSafehouse();
  }

  function refreshPrompt() {
    const player = world.player;
    const shop = shopNearby();
    if (shop === 'gunshop') world.prompt = 'E — Buy ammo $60';
    else if (shop === 'garage') world.prompt = player.inCar ? 'E — Repair $80 / Lay low' : 'E — Lay low (clear wanted)';
    else if (shop === 'safehouse') world.prompt = 'E — Heal & save';
    else if (!player.inCar && nearestStealableCar(world, 60)) world.prompt = 'E — Steal car';
    else world.prompt = '';
  }

  function takePickup(pk) {
    const p = world.player;
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

  function updatePickups() {
    const p = world.player;
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < 32) takePickup(pk);
    }
  }

  // --- bullets ---------------------------------------------------------------
  function foeDown(e) {
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

  function bulletVsWorld(b) {
    // A player bullet: pedestrians, then cops, then rivals, then cars.
    if (checkBulletHitPed(world, b)) return true;
    for (const cop of world.cops) {
      if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) {
        cop.health -= b.damage;
        world.audio.hit();
        return true;
      }
    }
    for (const e of world.enemies) {
      if (e.health > 0 && Math.hypot(e.x - b.x, e.y - b.y) < 16) {
        e.health -= b.damage;
        world.audio.hit();
        if (e.health <= 0) foeDown(e);
        return true;
      }
    }
    for (const car of world.cars) {
      if (car.wrecked) continue;
      if (Math.hypot(car.x - b.x, car.y - b.y) < 24) {
        car.health -= b.damage;
        if (car.health <= 0) wreckCar(world, car);
        return true;
      }
    }
    return false;
  }

  function bulletVsPlayer(b) {
    const p = world.player;
    if (p.inCar) {
      const car = p.inCar;
      if (Math.hypot(car.x - b.x, car.y - b.y) < 24) {
        car.health -= b.damage;
        if (car.health <= 0) wreckCar(world, car);
        return true;
      }
      return false;
    }
    if (Math.hypot(p.x - b.x, p.y - b.y) < 14) {
      hurtPlayer(p, b.damage);
      world.audio.hit();
      if (p.health <= 0) world.wasted();
      return true;
    }
    return false;
  }

  function updateBullets(dt) {
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
        if (bulletVsWorld(b)) b.life = 0;
      } else if (bulletVsPlayer(b)) {
        b.life = 0;
      }
    }
    world.bullets = world.bullets.filter((b) => b.life > 0);
  }

  function resolveMission() {
    const m = world.mission;
    if (!m) return;
    if (m.status === 'complete') {
      world.cash += MISSIONS[m.index].reward;
      world.stats.missionsDone += 1;
      saveGame(world);
      world.audio.mission();
      document.getElementById('mission-title').textContent = `MISSION COMPLETE — ${MISSIONS[m.index].name}`;
      document.getElementById('mission-text').textContent = `${m.reason} Reward: $${MISSIONS[m.index].reward}.`;
      setScreen('mission');
    } else if (m.status === 'failed') {
      world.audio.fail();
      document.getElementById('failed-text').textContent = `${MISSIONS[m.index].name}: ${m.reason}`;
      setScreen('failed');
    }
  }

  function viewFor(player) {
    return {
      x: Math.max(0, Math.min(WORLD.w - canvas.clientWidth, player.x - canvas.clientWidth / 2)),
      y: Math.max(0, Math.min(WORLD.h - canvas.clientHeight, player.y - canvas.clientHeight / 2)),
    };
  }

  // --- one fixed step of the world --------------------------------------------
  function stepWorld(dt, stepInput) {
    world.time += dt;
    const player = world.player;
    const actions = stepInput.takeActions();
    world.interactHeld = stepInput.held('e');
    // Aim: mouse position in screen space, converted to world space.
    const cam = viewFor(player);
    const aimWorld = { x: cam.x + stepInput.mouseX, y: cam.y + stepInput.mouseY };

    if (actions & ACTION_INTERACT) {
      if (player.inCar) {
        exitCar(world);
      } else {
        const shop = shopNearby();
        if (shop) shopAction(shop);
        else {
          const car = nearestStealableCar(world, 60);
          if (car) enterCar(world, car);
        }
      }
    }
    if (actions & ACTION_RELOAD && player.reloading <= 0 && player.reserve > 0) {
      player.reloading = PLAYER.reloadTime;
    }

    if (player.inCar) updatePlayerCar(world, dt, stepInput);
    else updatePlayerOnFoot(world, dt, stepInput, aimWorld);

    updateTraffic(world, dt);
    updatePoliceCars(world, dt);
    collideCars(world);
    updatePeds(world, dt);
    checkRunOver(world);
    updateCops(world, dt);
    updateHeli(world, dt);
    updateWanted(world, dt);
    updateEnemies(world, dt);
    updateBullets(dt);
    updatePickups();
    updateParticles(world, dt);
    updateMission(world, dt);

    refreshPrompt();
    if (world.camera.shake > 0) world.camera.shake = Math.max(0, world.camera.shake - dt * 30);
    if (player.health <= 0 && world.screen === 'play') world.wasted();

    resolveMission();

    // A quiet autosave while playing, so quitting to the title never loses
    // more than a few seconds of progress.
    if (world.screen === 'play') {
      world.saveTimer += dt;
      if (world.saveTimer > AUTOSAVE_SECONDS) {
        world.saveTimer = 0;
        saveGame(world);
      }
    }
  }

  // On the title screen the city lives on its own: no player input.
  const titleInput = {
    axis: () => ({ x: 0, y: 0 }),
    held: () => false,
    shift: () => false,
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
    takeActions: () => 0,
  };

  // --- the frame update ---------------------------------------------------------
  function update(dt, frameInput) {
    const actions = frameInput.takeActions();
    if (actions & ACTION_PAUSE) {
      if (world.screen === 'play') setScreen('pause');
      else if (world.screen === 'pause') setScreen('play');
    }
    if (actions & ACTION_MUTE) world.audio.toggleMute();
    if (actions & ACTION_CONFIRM) {
      if (world.screen === 'title') {
        if (hasSave()) resumeSaved();
        else startFresh();
      }
    }
    // Hand the rest back: the world step is the only consumer of interact/reload.
    frameInput.actions |= (actions & ~(ACTION_PAUSE | ACTION_MUTE | ACTION_CONFIRM));
    if (world.screen === 'play' || world.screen === 'title') {
      accumulator += Math.min(dt, MAX_FRAME);
      while (accumulator >= STEP) {
        if (world.screen !== 'play' && world.screen !== 'title') break;
        stepWorld(STEP, world.screen === 'title' ? titleInput : frameInput);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
  }

  function render() {
    renderer.draw(world, world.screen);
    if (world.screen === 'play') updateHud(hud, world);
  }

  // --- buttons ------------------------------------------------------------------
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => { audio.ensure(); fn(); });
  };
  on('btn-new', startFresh);
  on('btn-continue', resumeSaved);
  on('btn-resume', () => setScreen('play'));
  on('btn-restart', () => startFresh());
  on('btn-quit', () => { saveGame(world); setScreen('title'); });
  on('btn-next-mission', () => {
    world.missionIndex += 1;
    if (world.missionIndex >= MISSIONS.length) {
      document.getElementById('victory-stats').textContent =
        `Missions ${world.stats.missionsDone}/6 · Cars stolen ${world.stats.carsStolen} · Cops down ${world.stats.copsDown} · Cash $${world.cash}`;
      setScreen('victory');
    } else {
      startMission(world, world.missionIndex);
      setScreen('play');
      world.showMessage(MISSIONS[world.missionIndex].briefing, 6);
    }
  });
  on('btn-retry', () => {
    startMission(world, world.missionIndex);
    setScreen('play');
  });
  on('btn-respawn', () => respawn(ECONOMY.wastedFine));
  on('btn-respawn-busted', () => respawn(ECONOMY.bustFine));
  on('btn-freeroam', () => {
    world.mission = null;
    world.setWanted(0);
    setScreen('play');
    world.showMessage('Free roam. Solmar is yours — the story is done, the city is not.', 5);
  });
  on('btn-victory-restart', () => startFresh());

  // --- the game object ------------------------------------------------------------
  const game = {
    world,
    seed,
    fakeInput: null,
    startMission: (i) => startMission(world, i),
    setWanted: (n) => world.setWanted(n),
    newGame: startFresh,
    continueGame: resumeSaved,
    step: (dt, inputOverride) => stepWorld(dt, inputOverride || input),
    update,
    render,
  };

  setScreen('title');
  return game;
}

// --- boot -------------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);
const game = createGame({ canvas, hud, audio, input, seed });

// Test hooks: the playtest driver reads state and drives the game.
window.__game = game;

if (shot) {
  // Screenshot mode: stage the scene, paint it twice, signal readiness.
  game.world.screen = 'play';
  document.body.classList.add('playing');
  document.getElementById('screen-title').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  stageShot(shot, game);
  let painted = 0;
  const paint = () => {
    game.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = (now - last) / 1000;
    last = now;
    game.update(dt, input);
    game.render();
  };
  game.world.audio.ensure();
  requestAnimationFrame(frame);
}
