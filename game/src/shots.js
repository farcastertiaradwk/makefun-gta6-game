// The screenshot scenes behind ?shot=cover|street|heli|bank. Each one sets
// up a real game state (a mission, a wanted level, a chase), then plays it
// forward with a simple autopilot — drive along the road, walk to the
// marker — so the frame is what a short game really looks like, and the
// same seed always gives the same frame. Nothing here is faked: every pixel
// is the game's own code.
import { TICK, SITES } from './config.js';
import { beginJob } from './missions.js';
import { makeCar } from './vehicles.js';

function stubInput() {
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

function wrapAngle(diff) {
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function driveNorth(game, roadX) {
  // Stay on the road and keep the throttle down.
  const car = game.world.player.inCar;
  if (!car) return;
  const want = -Math.PI / 2; // north
  const diff = wrapAngle(want - car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2 + (roadX - car.x) * 0.004));
  game.fakeInput.axis = () => ({ x: steer, y: -1 });
}

function walkToMarker(game) {
  const m = game.world.mission;
  const p = game.world.player;
  const target = m && m.marker ? m.marker : SITES.plaza;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const dist = Math.hypot(dx, dy) || 1;
  game.fakeInput.axis = () => ({ x: dx / dist, y: dy / dist });
  // Aim ahead of the walk so the gun points where the player is going.
  game.fakeInput.mouseX = 640 + (dx / dist) * 160;
  game.fakeInput.mouseY = 360 + (dy / dist) * 160;
}

function stepFor(game, seconds, autopilot) {
  const steps = Math.floor(seconds / TICK);
  for (let i = 0; i < steps; i += 1) {
    if (autopilot) autopilot(game);
    game.step(TICK, game.fakeInput);
  }
}

function addPursuit(game, count, behind) {
  const p = game.world.player;
  for (let i = 0; i < count; i += 1) {
    const car = makeCar(p.x + 60 + i * 30, p.y + behind + i * 90, -Math.PI / 2, '#2e5fa3', 'police');
    car.speed = 320;
    game.world.cars.push(car);
  }
}

function addTrafficAhead(game, roadX, fromY, count) {
  for (let i = 0; i < count; i += 1) {
    const y = fromY - i * 170;
    const car = makeCar(roadX, y, -Math.PI / 2, game.world.random.choose(['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1']), 'traffic');
    car.speed = 95;
    car.target = { x: roadX, y: 250 };
    game.world.cars.push(car);
  }
}

function addWreck(game, x, y, angle, color, smokeSize) {
  const wreck = makeCar(x, y, angle, color, 'parked');
  wreck.wrecked = true;
  game.world.cars.push(wreck);
  game.world.particles.push({ kind: 'smoke', x, y, vx: 0, vy: -20, life: 1, max: 1, size: smokeSize });
}

function streetScene(game) {
  const world = game.world;
  beginJob(world, 1);
  world.player.x = 850;
  world.player.y = 860;
  world.player.angle = -Math.PI / 2;
  stepFor(game, 2, walkToMarker);
}

function heliScene(game) {
  const world = game.world;
  beginJob(world, 5);
  // Put the player in a car on the east-west road, heading east, heat at 4.
  const car = makeCar(1450, 950, 0, '#c0392b', 'player');
  car.speed = 300;
  world.cars.push(car);
  world.player.inCar = car;
  world.player.x = car.x;
  world.player.y = car.y;
  world.setWanted(4);
  // A roadblock ahead and a wreck smoking beside it.
  const block1 = makeCar(1900, 930, Math.PI / 2, '#2e5fa3', 'police');
  const block2 = makeCar(1900, 980, Math.PI / 2, '#2e5fa3', 'police');
  world.cars.push(block1, block2);
  addWreck(game, 1820, 910, 0.4, '#8e44ad', 20);
  // Park the helicopter above the player so it is in frame.
  let heliPlaced = false;
  stepFor(game, 1.2, (g) => {
    g.fakeInput.axis = () => ({ x: 0, y: -1 });
    if (!heliPlaced && g.world.heli) {
      g.world.heli.angle = -2.0;
      heliPlaced = true;
    }
  });
}

function bankScene(game) {
  const world = game.world;
  beginJob(world, 4);
  world.mission.stage = 1;
  world.mission.progress = 0.6;
  world.mission.objective = 'Cracking the safe… 60%';
  // Stand just off the marker so the player is visible beside it, not under it.
  world.player.x = 2150;
  world.player.y = 720;
  world.player.angle = -Math.PI / 2;
  world.setWanted(3);
  addPursuit(game, 2, 500);
  stepFor(game, 1.5, (g) => {
    g.fakeInput.axis = () => ({ x: 0, y: 0 });
    g.fakeInput.mouseX = 640;
    g.fakeInput.mouseY = 200;
    // Hold E: the safe keeps cracking, so the progress text shows.
    g.fakeInput.held = () => true;
  });
}

function coverScene(game) {
  const world = game.world;
  // Default: cover — a high-speed chase down the central avenue.
  beginJob(world, 2);
  const car = makeCar(1050, 1500, -Math.PI / 2, '#c0392b', 'player');
  car.speed = 330;
  world.cars.push(car);
  world.player.inCar = car;
  world.player.x = car.x;
  world.player.y = car.y;
  world.mission.stage = 1;
  world.setWanted(3);
  world.mission.objective = 'Drive Mara to the Safehouse';
  world.mission.marker = { x: SITES.safehouse.x, y: SITES.safehouse.y, label: 'SAFEHOUSE' };
  addPursuit(game, 2, 260);
  addTrafficAhead(game, 1050, 1300, 3);
  addWreck(game, 1050, 820, 0.3, '#e67e22', 22);
  stepFor(game, 1.5, (g) => driveNorth(g, 1050));
}

// Set the world to the named scene and return the screen to draw over it.
// Names: cover (driving chase), street (on foot in the plaza), heli (4-star
// chase with the helicopter), bank (the safe-cracking mission).
export function stageShot(name, game) {
  const world = game.world;
  game.fakeInput = stubInput();
  world.screen = 'play';
  if (name === 'street') streetScene(game);
  else if (name === 'heli') heliScene(game);
  else if (name === 'bank') bankScene(game);
  else coverScene(game);
  return { screen: 'play' };
}
