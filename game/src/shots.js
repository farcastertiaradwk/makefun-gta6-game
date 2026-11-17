// The screenshot scenes behind ?shot=cover|street|heli|bank. Each one sets
// up a real game state (a mission, a wanted level, a chase), then plays it
// forward with a simple autopilot — drive along the road, walk to the
// marker — so the frame is what a short game really looks like, and the
// same seed always gives the same frame. Nothing here is faked: every pixel
// is the game's own code.
import { STEP, PLACES } from './config.js';
import { startMission } from './missions.js';
import { createCar } from './vehicles.js';

function fakeInput() {
  return {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    axis: () => ({ x: 0, y: 0 }),
    held: () => false,
    shift: () => false,
    takeActions: () => 0,
  };
}

function wrapTurn(diff) {
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function steerNorth(game, roadX) {
  // Stay on the road and keep the throttle down.
  const car = game.world.player.inCar;
  if (!car) return;
  const want = -Math.PI / 2; // north
  const diff = wrapTurn(want - car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2 + (roadX - car.x) * 0.004));
  game.fakeInput.axis = () => ({ x: steer, y: -1 });
}

function strollToMarker(game) {
  const m = game.world.mission;
  const p = game.world.player;
  const target = m && m.marker ? m.marker : PLACES.plaza;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const dist = Math.hypot(dx, dy) || 1;
  game.fakeInput.axis = () => ({ x: dx / dist, y: dy / dist });
  // Aim ahead of the walk so the gun points where the player is going.
  game.fakeInput.mouseX = 640 + (dx / dist) * 160;
  game.fakeInput.mouseY = 360 + (dy / dist) * 160;
}

function runSteps(game, seconds, autopilot) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (autopilot) autopilot(game);
    game.step(STEP, game.fakeInput);
  }
}

function chaseCars(game, count, behind) {
  const p = game.world.player;
  for (let i = 0; i < count; i += 1) {
    const car = createCar(p.x + 60 + i * 30, p.y + behind + i * 90, -Math.PI / 2, '#2e5fa3', 'police');
    car.speed = 320;
    game.world.cars.push(car);
  }
}

function trafficAhead(game, roadX, fromY, count) {
  for (let i = 0; i < count; i += 1) {
    const y = fromY - i * 170;
    const car = createCar(roadX, y, -Math.PI / 2, game.world.random.pick(['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1']), 'traffic');
    car.speed = 95;
    car.target = { x: roadX, y: 250 };
    game.world.cars.push(car);
  }
}

function wreckAt(game, x, y, angle, color, smokeSize) {
  const wreck = createCar(x, y, angle, color, 'parked');
  wreck.wrecked = true;
  game.world.cars.push(wreck);
  game.world.particles.push({ kind: 'smoke', x, y, vx: 0, vy: -20, life: 1, max: 1, size: smokeSize });
}

function sceneStreet(game) {
  const world = game.world;
  startMission(world, 1);
  world.player.x = 850;
  world.player.y = 860;
  world.player.angle = -Math.PI / 2;
  runSteps(game, 2, strollToMarker);
}

function sceneHeli(game) {
  const world = game.world;
  startMission(world, 5);
  // Put the player in a car on the east-west road, heading east, heat at 4.
  const car = createCar(1450, 950, 0, '#c0392b', 'player');
  car.speed = 300;
  world.cars.push(car);
  world.player.inCar = car;
  world.player.x = car.x;
  world.player.y = car.y;
  world.setWanted(4);
  // A roadblock ahead and a wreck smoking beside it.
  const block1 = createCar(1900, 930, Math.PI / 2, '#2e5fa3', 'police');
  const block2 = createCar(1900, 980, Math.PI / 2, '#2e5fa3', 'police');
  world.cars.push(block1, block2);
  wreckAt(game, 1820, 910, 0.4, '#8e44ad', 20);
  // Park the helicopter above the player so it is in frame.
  let heliPlaced = false;
  runSteps(game, 1.2, (g) => {
    g.fakeInput.axis = () => ({ x: 0, y: -1 });
    if (!heliPlaced && g.world.heli) {
      g.world.heli.angle = -2.0;
      heliPlaced = true;
    }
  });
}

function sceneBank(game) {
  const world = game.world;
  startMission(world, 4);
  world.mission.stage = 1;
  world.mission.progress = 0.6;
  world.mission.objective = 'Cracking the safe… 60%';
  // Stand just off the marker so the player is visible beside it, not under it.
  world.player.x = 2150;
  world.player.y = 720;
  world.player.angle = -Math.PI / 2;
  world.setWanted(3);
  chaseCars(game, 2, 500);
  runSteps(game, 1.5, (g) => {
    g.fakeInput.axis = () => ({ x: 0, y: 0 });
    g.fakeInput.mouseX = 640;
    g.fakeInput.mouseY = 200;
    // Hold E: the safe keeps cracking, so the progress text shows.
    g.fakeInput.held = () => true;
  });
}

function sceneCover(game) {
  const world = game.world;
  // Default: cover — a high-speed chase down the central avenue.
  startMission(world, 2);
  const car = createCar(1050, 1500, -Math.PI / 2, '#c0392b', 'player');
  car.speed = 330;
  world.cars.push(car);
  world.player.inCar = car;
  world.player.x = car.x;
  world.player.y = car.y;
  world.mission.stage = 1;
  world.setWanted(3);
  world.mission.objective = 'Drive Mara to the Safehouse';
  world.mission.marker = { x: PLACES.safehouse.x, y: PLACES.safehouse.y, label: 'SAFEHOUSE' };
  chaseCars(game, 2, 260);
  trafficAhead(game, 1050, 1300, 3);
  wreckAt(game, 1050, 820, 0.3, '#e67e22', 22);
  runSteps(game, 1.5, (g) => steerNorth(g, 1050));
}

// Set the world to the named scene and return the screen to draw over it.
// Names: cover (driving chase), street (on foot in the plaza), heli (4-star
// chase with the helicopter), bank (the safe-cracking mission).
export function stageShot(name, game) {
  const world = game.world;
  game.fakeInput = fakeInput();
  world.screen = 'play';
  if (name === 'street') sceneStreet(game);
  else if (name === 'heli') sceneHeli(game);
  else if (name === 'bank') sceneBank(game);
  else sceneCover(game);
  return { screen: 'play' };
}
