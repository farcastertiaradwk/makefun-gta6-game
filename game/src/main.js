// SOLMAR HEAT — the game object: one world, a fixed-step loop, the screens,
// and the wiring between systems. The world advances in fixed 1/60 s steps
// in a set order, so a replay with the same seed plays out the same way.
// Screens: title, play, pause, mission complete, mission failed, wasted,
// busted, victory. ?shot=cover|street|heli|bank stages a screenshot scene
// instead of running the loop, paints it twice and sets window.__shotReady.
//
// The story: Danny Reyes, a wheelman out of work, does jobs for Mara Voss
// and the Harbour Crew to take Solmar back from Kane and the Vipers.
import { TICK, MAP, ONFOOT, PRICES, SITES } from './config.js';
import { makeWorld, restartWorld, stepWorld } from './world.js';
import { makeInput, KEY_CONFIRM, KEY_PAUSE, KEY_MUTE, KEY_INTERACT, KEY_RELOAD } from './input.js';
import { makeWalker, getInCar, getOutOfCar, closestStealable } from './player.js';
import { beginJob, STORY } from './missions.js';
import { makeRenderer } from './render.js';
import { makeHud, updateHud } from './hud.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 20;

export function buildGame({ canvas, hud, input, seed }) {
  const renderer = makeRenderer(canvas);
  const world = makeWorld(seed);
  const audio = world.audio;
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

  function sendPlayerHome() {
    world.player = makeWalker(SITES.safehouse.x, SITES.safehouse.y);
  }

  function startFresh() {
    clearSave();
    input.actions = 0;
    restartWorld(world, seed);
    setScreen('play');
    world.showMessage(STORY[0].briefing);
    audio.unlock();
  }

  function resumeSaved() {
    const loaded = loadGame();
    if (!loaded) {
      startFresh();
      return;
    }
    input.actions = 0;
    // Swap the snapshot into the live world, keeping this session's audio.
    // The snapshot's verbs close over the rebuilt world, not this one, so
    // only data fields cross over — the live world's own verbs stay.
    for (const key of Object.keys(loaded)) {
      if (typeof loaded[key] !== 'function') world[key] = loaded[key];
    }
    world.audio = audio;
    setScreen('play');
    world.showMessage(`Welcome back. ${STORY[world.missionIndex].briefing}`);
    audio.unlock();
  }

  function respawn(fine) {
    world.cash = Math.max(0, world.cash - fine);
    sendPlayerHome();
    world.cops = [];
    world.wanted = 0;
    world.heat = 0;
    world.heli = null;
    for (const c of world.cars) {
      if (c.kind === 'police') c.wrecked = true;
    }
    beginJob(world, world.missionIndex);
    setScreen('play');
  }

  // --- shops, prompts -------------------------------------------------------
  function shopNearby() {
    const p = world.player;
    for (const key of ['gunshop', 'garage', 'safehouse']) {
      const s = SITES[key];
      if (Math.hypot(s.x - p.x, s.y - p.y) < 80) return key;
    }
    return null;
  }

  function buyAmmo() {
    const p = world.player;
    if (world.cash < PRICES.ammoPrice) {
      world.showMessage('Not enough cash for ammo.');
      return;
    }
    if (p.reserve >= 240) {
      world.showMessage('Ammo full.');
      return;
    }
    world.cash -= PRICES.ammoPrice;
    p.reserve += PRICES.ammoAmount;
    world.showMessage(`Bought ${PRICES.ammoAmount} rounds.`);
    audio.pickup();
  }

  function useGarage() {
    const p = world.player;
    if (p.inCar && p.inCar.health < 100 && world.cash >= PRICES.repairPrice) {
      world.cash -= PRICES.repairPrice;
      p.inCar.health = 100;
      p.inCar.wrecked = false;
      world.showMessage('Car repaired.');
      audio.pickup();
    } else if (world.wanted > 0 && world.cash >= PRICES.layLowPerStar * world.wanted) {
      world.cash -= PRICES.layLowPerStar * world.wanted;
      world.wanted = 0;
      world.heat = 0;
      world.showMessage('Lay low. The heat is off — for now.');
      audio.pickup();
    } else if (world.wanted > 0) {
      world.showMessage(`Lay low costs $${PRICES.layLowPerStar * world.wanted}.`);
    } else if (p.inCar) {
      world.showMessage('Car is already in good shape.');
    } else {
      world.showMessage('Bring a car here to repair it.');
    }
  }

  function useSafehouse() {
    world.player.health = ONFOOT.health;
    saveGame(world);
    world.showMessage('Healed up. Progress saved.');
    audio.pickup();
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
    else if (!player.inCar && closestStealable(world, 60)) world.prompt = 'E — Steal car';
    else world.prompt = '';
  }

  function resolveMission() {
    if (world.screen !== 'play') return;
    const m = world.mission;
    if (!m) return;
    if (m.status === 'complete') {
      world.cash += STORY[m.index].reward;
      world.stats.missionsDone += 1;
      saveGame(world);
      audio.missionComplete();
      document.getElementById('mission-title').textContent = `MISSION COMPLETE — ${STORY[m.index].name}`;
      document.getElementById('mission-text').textContent = `${m.reason} Reward: $${STORY[m.index].reward}.`;
      setScreen('mission');
    } else if (m.status === 'failed') {
      audio.missionFailed();
      document.getElementById('failed-text').textContent = `${STORY[m.index].name}: ${m.reason}`;
      setScreen('failed');
    }
  }

  function viewFor(player) {
    return {
      x: Math.max(0, Math.min(MAP.w - canvas.clientWidth, player.x - canvas.clientWidth / 2)),
      y: Math.max(0, Math.min(MAP.h - canvas.clientHeight, player.y - canvas.clientHeight / 2)),
    };
  }

  // --- one fixed step of the game -------------------------------------------
  function stepGame(dt, stepInput) {
    const player = world.player;
    const actions = stepInput.takeActions();
    world.interactHeld = stepInput.held('e');
    // Aim: mouse position in screen space, converted to world space.
    const cam = viewFor(player);
    const aimWorld = { x: cam.x + stepInput.mouseX, y: cam.y + stepInput.mouseY };

    if (actions & KEY_INTERACT) {
      if (player.inCar) {
        getOutOfCar(world);
      } else {
        const shop = shopNearby();
        if (shop) shopAction(shop);
        else {
          const car = closestStealable(world, 60);
          if (car) getInCar(world, car);
        }
      }
    }
    if (actions & KEY_RELOAD && player.reloading <= 0 && player.reserve > 0) {
      player.reloading = ONFOOT.reloadTime;
    }

    stepWorld(world, dt, stepInput, aimWorld);
    refreshPrompt();
    resolveMission();
    if (world.screen === 'wasted') setScreen('wasted');
    else if (world.screen === 'busted') setScreen('busted');

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
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    axis: () => ({ x: 0, y: 0 }),
    held: () => false,
    shift: () => false,
    takeActions: () => 0,
  };

  // --- the frame update -----------------------------------------------------
  function update(dt, frameInput) {
    const actions = frameInput.takeActions();
    if (actions & KEY_PAUSE) {
      if (world.screen === 'play') setScreen('pause');
      else if (world.screen === 'pause') setScreen('play');
    }
    if (actions & KEY_MUTE) audio.setMuted(!audio.muted);
    if (actions & KEY_CONFIRM) {
      if (world.screen === 'title') {
        if (hasSave()) resumeSaved();
        else startFresh();
      }
    }
    // Hand the rest back: the world step is the only consumer of interact/reload.
    frameInput.actions |= (actions & ~(KEY_PAUSE | KEY_MUTE | KEY_CONFIRM));
    if (world.screen === 'play' || world.screen === 'title') {
      accumulator += Math.min(dt, MAX_FRAME);
      while (accumulator >= TICK) {
        if (world.screen !== 'play' && world.screen !== 'title') break;
        stepGame(TICK, world.screen === 'title' ? titleInput : frameInput);
        accumulator -= TICK;
      }
    } else {
      accumulator = 0;
    }
  }

  function render() {
    renderer.draw(world);
    if (world.screen === 'play') updateHud(hud, world);
  }

  // --- buttons --------------------------------------------------------------
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-new', startFresh);
  on('btn-continue', resumeSaved);
  on('btn-resume', () => setScreen('play'));
  on('btn-restart', () => startFresh());
  on('btn-quit', () => { saveGame(world); setScreen('title'); });
  on('btn-next-mission', () => {
    world.missionIndex += 1;
    if (world.missionIndex >= STORY.length) {
      document.getElementById('victory-stats').textContent =
        `Missions ${world.stats.missionsDone}/6 · Cars stolen ${world.stats.carsStolen} · Cops down ${world.stats.copsDown} · Cash $${world.cash}`;
      setScreen('victory');
    } else {
      beginJob(world, world.missionIndex);
      setScreen('play');
      world.showMessage(STORY[world.missionIndex].briefing);
    }
  });
  on('btn-retry', () => {
    beginJob(world, world.missionIndex);
    setScreen('play');
  });
  on('btn-respawn', () => respawn(PRICES.wastedFine));
  on('btn-respawn-busted', () => respawn(PRICES.bustFine));
  on('btn-freeroam', () => {
    world.mission = null;
    world.wanted = 0;
    world.heat = 0;
    setScreen('play');
    world.showMessage('Free roam. Solmar is yours — the story is done, the city is not.');
  });
  on('btn-victory-restart', () => startFresh());

  // --- the game object ------------------------------------------------------
  const game = {
    world,
    seed,
    fakeInput: null,
    startMission: (i) => {
      world.missionIndex = i;
      beginJob(world, i);
    },
    setWanted: (n) => world.setWanted(n),
    newGame: startFresh,
    continueGame: resumeSaved,
    step: (dt, inputOverride) => stepGame(dt, inputOverride || input),
    update,
    render,
  };

  setScreen('title');
  return game;
}

// --- boot -------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const hud = makeHud();
const input = makeInput(canvas);
const game = buildGame({ canvas, hud, input, seed });

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
  game.world.audio.unlock();
  requestAnimationFrame(frame);
}
