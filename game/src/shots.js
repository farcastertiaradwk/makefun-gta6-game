// Staged screenshots for SOLMAR HEAT.
// The game is opened with ?shot=<name> and this module arranges a living
// diorama for each of the four shots, then the main loop freezes the scene
// and flags window.__shotReady. Every scene is built from the real game
// systems (real missions, real police, real traffic) so the screenshots show
// the game itself, not a mock-up. Seed 7 keeps the city identical between
// takes.

import { PLACES } from './config.js';
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';
import { spawnCop, spawnPoliceCar, spawnHeli } from './police.js';

/** Put the player in a fresh car at a spot, driving at a speed. */
function putPlayerInCar(game, x, y, angle, speed, color) {
  const world = game.world;
  const car = makeCar('player', x, y, angle, color || '#c23b2e');
  car.speed = speed;
  world.cars.push(car);
  world.player.inCar = car;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
  return car;
}

/** A wrecked car, parked as scenery (for the heli shot's roadblock scene). */
function putWreck(game, x, y, angle) {
  const world = game.world;
  const car = makeCar('traffic', x, y, angle, '#3a9e5f');
  car.health = 0;
  car.wrecked = true;
  world.cars.push(car);
  return car;
}

/** Traffic cars ahead of the player, in a loose convoy. */
function addTrafficAhead(game, x, y, count) {
  const world = game.world;
  for (let i = 0; i < count; i += 1) {
    const car = makeCar('traffic', x + world.rng.range(-30, 30), y - i * 90, -Math.PI / 2, '#e8b73a');
    car.speed = 150;
    world.cars.push(car);
  }
}

/** Two police cars parked across the road: a roadblock. */
function addRoadblockAt(game, x, y) {
  const world = game.world;
  for (const side of [-1, 1]) {
    const car = makeCar('police', x, y + side * 42, Math.PI / 2, '#20242e');
    car.roadblock = true;
    world.cars.push(car);
  }
}

/** Step the world forward with the W key held (the car drives itself). */
function driveForward(game, seconds) {
  game.input.fakeHold('KeyW');
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) game.step(1 / 60);
  game.input.fakeRelease('KeyW');
}

/** Step the world forward with no input (the scene settles). */
function settle(game, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) game.step(1 / 60);
}

/**
 * Stage one named scene. The game must already be a fresh new game; this
 * function mutates it into the shot and leaves it frozen for capture.
 */
export function runShot(game, name) {
  const world = game.world;
  if (name === 'cover') {
    // A high-speed chase: Mara in the passenger seat, three stars, two
    // interceptors closing in, traffic ahead, plaza and park in frame.
    startMission(world, 2);
    const car = putPlayerInCar(game, 1050, 1500, -Math.PI / 2, 430, '#c23b2e');
    addTrafficAhead(game, 1050, 950, 3);
    spawnPoliceCar(world);
    spawnPoliceCar(world);
    driveForward(game, 1.5);
    // Freeze the moment at full speed: the chase is captured mid-flight.
    car.speed = 400;
  } else if (name === 'street') {
    // On foot in the plaza, mid-package-run: one of three collected, the
    // timer at 178 seconds, peds and traffic living around the player.
    startMission(world, 1);
    world.mission.data.collected = 1;
    world.mission.objective = 'Collect the packages: 1/3';
    world.mission.timer = 178;
    world.player.x = 1000;
    world.player.y = 1150;
    world.player.inCar = null;
    addTrafficAhead(game, 1000, 800, 2);
    settle(game, 0.4);
  } else if (name === 'heli') {
    // Five stars at the plaza: the helicopter overhead with its spotlight,
    // three interceptors, a roadblock and a wreck ahead, Kane's job live.
    startMission(world, 5);
    world.wanted = 5;
    putPlayerInCar(game, 1450, 950, 0, 60, '#2e6fc2');
    spawnHeli(world);
    if (world.heli) world.heli.angle = -2.0;
    addRoadblockAt(game, 1900, 950);
    putWreck(game, 1820, 910, 0.4);
    spawnPoliceCar(world);
    spawnPoliceCar(world);
    spawnPoliceCar(world);
    settle(game, 1.2);
  } else if (name === 'bank') {
    // The bank job at its tensest: the safe is 89% cracked, the crew is in
    // the vault, and the police are converging on Harbor Bank.
    startMission(world, 4);
    world.mission.stage = 1;
    world.mission.objective = 'Crack the safe — hold E';
    world.mission.data.crack = 89;
    world.player.x = 2150;
    world.player.y = 720;
    world.player.inCar = null;
    world.wanted = 3;
    spawnCop(world);
    spawnCop(world);
    spawnPoliceCar(world);
    settle(game, 0.3);
  }
  world.screen = 'play';
}
