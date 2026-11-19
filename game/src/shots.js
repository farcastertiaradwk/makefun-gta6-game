// Staged screenshot scenes for SOLMAR HEAT.
// Each shot builds a real game, stages a dense moment with the game's own
// systems — chase, wanted stars, minimap, mission objective, police —
// settles it for a second, then freezes it for the camera. No shot is a
// mockup: every pixel is the game running.

import { WORLD } from './config.js';
import { makeVehicle } from './vehicles.js';

export const SHOT_NAMES = ['cover', 'street', 'heli', 'bank'];

export function stageShot(game, name) {
  game.shotMode = name;
  game.screen = 'play';
  if (name === 'cover') stageCover(game);
  else if (name === 'street') stageStreet(game);
  else if (name === 'heli') stageHeli(game);
  else if (name === 'bank') stageBank(game);
  // The settle pass lets police and traffic find their marks; the freeze
  // after it keeps the capture frame exactly as staged.
  game.settleSteps = 60;
  game.freezeAfterSettle = true;
}

// The cover: a full-speed getaway up the plaza road — three stars, two
// police cars on Danny's tail, traffic ahead, Mara in the passenger seat.
function stageCover(game) {
  const car = makeVehicle('car', 1050, 1500, -Math.PI / 2, '#d94f3d');
  car.speed = 400;
  game.cars.push(car);
  game.player.inCar = car;
  game.player.x = car.x;
  game.player.y = car.y;
  game.missionIndex = 2;
  game.missionStage = 1;
  game.mara = { x: 1050, y: 1500, aboard: true };
  game.objectiveText = 'Drive Mara to the Safehouse';
  game.marker = { x: WORLD.places.safehouse.x, y: WORLD.places.safehouse.y };
  game.wanted = 3;
  game.bestWanted = 3;
  game.lastSeenAt = game.time;
  game.freezeSpeed = 400;
  // Two police cars in pursuit, close behind.
  for (const [cx, cy] of [[1050, 1680], [1140, 1740]]) {
    const cop = makeVehicle('cop', cx, cy, -Math.PI / 2, '#2f5fd9');
    cop.speed = 380;
    game.cars.push(cop);
  }
  // Traffic ahead to dodge.
  addTrafficAhead(game, 1050, 1300, 3);
  // A motorbike parked at the roadside, for the new-vehicle tease.
  const bike = makeVehicle('bike', 1130, 1420, -Math.PI / 2, '#c23a6e');
  game.cars.push(bike);
  game.cash = 420;
}

// The street: Danny on foot in Voss Plaza, mid-package-run, with the park
// pond, pedestrians, traffic and a parked bike in frame.
function stageStreet(game) {
  game.player.x = 1000;
  game.player.y = 1150;
  game.player.angle = -Math.PI / 2;
  game.missionIndex = 1;
  game.missionStage = 1;
  game.missionTimer = 178;
  game.missionData = {
    spots: [
      { x: 650, y: 650, label: 'Marlowe Park', got: true },
      { x: 1050, y: 950, label: 'Voss Plaza', got: false },
      { x: 2250, y: 600, label: 'Harbour', got: false },
    ],
    got: 1,
  };
  game.objectiveText = 'Collect the packages: 1/3';
  game.marker = { x: 1050, y: 950 };
  game.wanted = 0;
  game.cash = 175;
  const bike = makeVehicle('bike', 1060, 1210, Math.PI / 2, '#c23a6e');
  game.cars.push(bike);
  addTrafficAhead(game, 1000, 900, 2);
  game.player.mag = 12;
  game.player.reserve = 48;
}

// The heli shot: five stars over the plaza, the helicopter and its
// spotlight above Danny, a roadblock, police cars, and KANE's crew.
function stageHeli(game) {
  game.player.x = 1000;
  game.player.y = 1150;
  game.player.angle = -Math.PI / 2;
  game.missionIndex = 7;
  game.missionStage = 0;
  game.objectiveText = 'Take down KANE — 0/5';
  game.marker = { x: 1000, y: 1000 };
  game.wanted = 5;
  game.bestWanted = 5;
  game.lastSeenAt = game.time;
  game.cash = 950;
  game.heli = { x: 1000, y: 950, angle: -2.0, rotor: 1.2, searchAt: 0 };
  // Kane and his Vipers, staged around the fountain.
  const spots = [
    { x: 1000, y: 1000, boss: true },
    { x: 910, y: 930, boss: false },
    { x: 1090, y: 930, boss: false },
    { x: 910, y: 1070, boss: false },
    { x: 1090, y: 1070, boss: false },
  ];
  for (const s of spots) {
    game.enemies.push({
      x: s.x, y: s.y,
      hp: s.boss ? 150 : 60, maxHp: s.boss ? 150 : 60,
      boss: s.boss, name: s.boss ? 'KANE' : 'Viper',
      angle: Math.PI / 2, shootAt: 9999, dead: false, speed: 150,
    });
  }
  // Three police cars closing in, plus a roadblock on the plaza road.
  for (const [cx, cy, ca] of [[820, 1000, 0], [1180, 1000, Math.PI], [1000, 820, Math.PI / 2]]) {
    const cop = makeVehicle('cop', cx, cy, ca, '#2f5fd9');
    cop.speed = 200;
    game.cars.push(cop);
  }
  for (const off of [-70, 0, 70]) {
    game.roadblocks.push({ x: 1300 + off, y: 1000, angle: 0 });
  }
  // Foot cops on the plaza edge.
  for (const [cx, cy] of [[900, 1200], [1100, 1200], [1000, 1300]]) {
    game.cops.push({ x: cx, y: cy, hp: 40, angle: -Math.PI / 2, shootAt: 9999, speed: 190, dead: false });
  }
  game.player.mag = 12;
  game.player.reserve = 48;
}

// The bank shot: Danny at the vault, the safe 89% cracked, three stars,
// police converging, the Harbour behind him.
function stageBank(game) {
  game.player.x = 2150;
  game.player.y = 720;
  game.player.angle = 0;
  game.missionIndex = 4;
  game.missionStage = 1;
  game.crack = 0.89;
  game.crackBand = 4;
  game.objectiveText = 'Hold E — cracking the safe…';
  game.marker = { x: WORLD.places.bankSafe.x, y: WORLD.places.bankSafe.y };
  game.wanted = 3;
  game.bestWanted = 3;
  game.lastSeenAt = game.time;
  game.cash = 150;
  // Police converging on the bank from the west road.
  for (const [cx, cy] of [[1950, 700], [2000, 760], [1900, 640]]) {
    game.cops.push({ x: cx, y: cy, hp: 40, angle: 0, shootAt: 9999, speed: 190, dead: false });
  }
  for (const [cx, cy] of [[1850, 700, 0], [1900, 780, 0]]) {
    const cop = makeVehicle('cop', cx, cy, 0, '#2f5fd9');
    cop.speed = 150;
    game.cars.push(cop);
  }
  game.player.mag = 12;
  game.player.reserve = 48;
}

function addTrafficAhead(game, x, y, n) {
  const rng = game.rng.fork('shot-traffic');
  for (let i = 0; i < n; i++) {
    const ty = y - i * 130;
    const car = makeVehicle('car', x + (i % 2 === 0 ? 0 : 46), ty, -Math.PI / 2, rng.choose(['#3d7bd9', '#e8b73a', '#7ac74f']));
    car.traffic = true;
    car.speed = 150;
    car.roadAxis = 'y';
    car.roadLine = x;
    game.cars.push(car);
  }
}
