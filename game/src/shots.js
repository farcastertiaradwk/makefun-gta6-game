// Staged screenshot scenes: each one sets the world up so a single
// frame shows several systems at once — a chase, a package run, the
// helicopter, the bank job. The driver opens ?shot=<name>, the game
// settles for a third of a second, freezes, and reports shotReady.
import { CFG } from './config.js';
import { makeVehicle } from './vehicles.js';
import { startMission } from './missions.js';
import { setWanted } from './police.js';

function copCarAt(world, x, y, angle) {
  const car = makeVehicle('car', x, y, angle, '#2c3e50');
  car.driver = 'cop';
  car.speed = 700;
  world.cars.push(car);
  world.copCars.push(car);
  return car;
}

function footCopAt(world, x, y) {
  world.cops.push({ x, y, hp: CFG.police.copHp, shootAt: world.time + 2, speed: CFG.police.copSpeed });
}

export const SHOT_NAMES = ['cover', 'street', 'heli', 'bank'];

export function stageShot(world, name) {
  const p = world.player;
  world.shotHoldUp = false;
  if (name === 'cover') {
    startMission(world, 2);
    world.mission.stage = 1;
    world.mission.objective = 'Drive Mara to the Safehouse';
    world.markers = [{ ...CFG.places.safehouse, kind: 'dropoff', label: 'SAFEHOUSE' }];
    const car = makeVehicle('car', 1000, 1500, -Math.PI / 2, '#c0392b');
    car.driver = 'player';
    car.speed = 1111;
    world.cars.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    setWanted(world, 3);
    copCarAt(world, 1000, 1720, -Math.PI / 2);
    copCarAt(world, 1070, 1790, -Math.PI / 2);
    const bike = makeVehicle('bike', 1150, 1330, 0.4, '#e74c3c');
    bike.driver = 'parked';
    world.cars.push(bike);
    world.shotHoldUp = true;
  } else if (name === 'street') {
    startMission(world, 1);
    world.mission.timer = 178;
    world.markers[0].done = true;
    world.collected = 1;
    p.x = 1000;
    p.y = 1060;
    p.angle = -Math.PI / 2;
    setWanted(world, 0);
  } else if (name === 'heli') {
    startMission(world, 7);
    p.x = 1000;
    p.y = 1150;
    p.angle = -Math.PI / 2;
    setWanted(world, 5);
    world.heli = { x: 1000, y: 900, angle: -2.0 };
    copCarAt(world, 880, 860, 0);
    copCarAt(world, 1180, 860, Math.PI);
    copCarAt(world, 1000, 780, Math.PI / 2);
    const rb1 = makeVehicle('car', 1240, 1000, Math.PI / 2, '#2c3e50');
    rb1.driver = 'parked';
    const rb2 = makeVehicle('car', 1240, 1090, Math.PI / 2, '#2c3e50');
    rb2.driver = 'parked';
    world.cars.push(rb1, rb2);
    world.roadblocks = [rb1, rb2];
  } else if (name === 'bank') {
    startMission(world, 4);
    world.mission.stage = 1;
    world.mission.data.crack = CFG.missions[4].crackSecs * 0.89;
    world.mission.objective = 'Cracking the safe… 89%';
    p.x = 2150;
    p.y = 720;
    p.angle = 0;
    setWanted(world, 3);
    footCopAt(world, 2080, 620);
    footCopAt(world, 2280, 820);
    footCopAt(world, 2200, 560);
    copCarAt(world, 2050, 900, -Math.PI / 2);
    world.fakeInput = { held: () => true };
  }
  world.screen = 'play';
}
