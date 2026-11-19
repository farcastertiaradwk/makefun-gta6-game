// Tuning for SOLMAR HEAT: every speed, price, timer and threshold in one
// place, grouped by system. The world is 2600x2600; roads run on a 6x6
// grid, 400 px apart, offset 200 px from the edges.

export const WORLD = {
  size: 2600,
  seed: 'solmar-7',
  roads: [200, 600, 1000, 1400, 1800, 2200],
  roadWidth: 64,
  // Named districts, for the minimap and the mission text.
  districts: {
    docks: { x: 2050, y: 1150, w: 550, h: 500, name: 'The Docks' },
    harbour: { x: 2380, y: 0, w: 220, h: 2600, name: 'Harbour' },
    beach: { x: 0, y: 2380, w: 2600, h: 220, name: 'Beach' },
    park: { x: 380, y: 380, w: 440, h: 440, name: 'Marlowe Park' },
    plaza: { x: 820, y: 820, w: 360, h: 360, name: 'Voss Plaza' },
  },
  // Fixed named places. The story never moves them.
  places: {
    safehouse: { x: 300, y: 1600, r: 70, name: 'Safehouse' },
    bank: { x: 2200, y: 700, r: 60, name: 'Harbor Bank' },
    bankSafe: { x: 2220, y: 700, r: 46, name: 'Bank vault' },
    gunshop: { x: 600, y: 1400, r: 60, name: 'Iron & Lead' },
    garage: { x: 1800, y: 1800, r: 70, name: 'Fix-It Garage' },
    docks: { x: 2350, y: 1350, r: 80, name: 'The Docks' },
    plaza: { x: 1000, y: 1000, r: 90, name: 'Voss Plaza' },
    beachDrop: { x: 1300, y: 2450, r: 80, name: 'Beach drop' },
    maraSpot: { x: 1000, y: 1400, r: 60, name: 'Mara' },
  },
};

export const PALETTE = {
  grass: '#69a84f',
  grassDark: '#5d9844',
  road: '#3b3b40',
  roadEdge: '#2e2e33',
  dash: '#e8c33a',
  sidewalk: '#b9b3a4',
  beach: '#e6d49a',
  water: '#3d7bc4',
  waterDeep: '#2f66a8',
  plaza: '#c9b18a',
  park: '#5da244',
  pond: '#4d8fc9',
  building: ['#c96f4a', '#d9a441', '#7a9cc4', '#b06a8a', '#8a7fc4', '#6fae7e'],
  roof: '#8a4a34',
  tree: '#2f7a33',
  treeLight: '#4a9a44',
  car: ['#d94f3d', '#3d7bd9', '#e8b73a', '#7ac74f', '#b04fd9', '#e8e8e8', '#3a3a3a'],
  taxi: '#f2c230',
  copCar: '#2f5fd9',
  bike: '#c23a6e',
};

export const PLAYER = {
  walkSpeed: 210,
  sprintSpeed: 330,
  radius: 13,
  hp: 100,
  armorMax: 100,
  pistolDamage: 34,
  pistolRange: 520,
  magSize: 12,
  reserveMax: 240,
  reloadTime: 1.1,
  shootInterval: 0.22,
  pickupRadius: 34,
};

export const CARS = {
  car: { accel: 300, brake: 520, handbrake: 900, top: 430, reverse: 140, steer: 2.6, hp: 100, radius: 17 },
  taxi: { accel: 300, brake: 520, handbrake: 900, top: 430, reverse: 140, steer: 2.6, hp: 100, radius: 17 },
  truck: { accel: 210, brake: 420, handbrake: 700, top: 340, reverse: 110, steer: 2.0, hp: 160, radius: 20 },
  cop: { accel: 340, brake: 560, handbrake: 900, top: 460, reverse: 150, steer: 2.9, hp: 120, radius: 17 },
  bike: { accel: 420, brake: 600, handbrake: 1100, top: 520, reverse: 120, steer: 3.4, hp: 45, radius: 12 },
};

export const PEDS = {
  walkSpeed: 55,
  fleeSpeed: 150,
  radius: 11,
  count: 26,
};

export const TRAFFIC = {
  count: 16,
  speed: 150,
  radius: 16,
};

export const POLICE = {
  // Wanted gained by each crime.
  steal: 1,
  shoot: 1,
  runover: 1,
  killCop: 1,
  maxStars: 5,
  // Foot cops: how many patrol at each wanted level, and how far they spawn.
  footCops: [0, 2, 3, 4, 5, 6],
  copCars: [0, 0, 1, 2, 3, 4],
  // A cop car appears from level 2, roadblocks from 3, the helicopter from 4.
  copCarFrom: 2,
  roadblockFrom: 3,
  heliFrom: 4,
  copShootFrom: 2,
  copShootInterval: 1.2,
  copBulletDamage: 7,
  copBulletSpeed: 620,
  decayDelay: 9,
  decayStep: 4,
  spawnDistance: 620,
};

export const PRICES = {
  ammo: 60,
  ammoPack: 48,
  armor: 120,
  repair: 80,
  laylow: 100, // per star
  heal: 0,
};

export const REWARDS = {
  mission: [100, 200, 250, 200, 800, 0, 500, 0],
  fare: 120,
  fareTip: 30,
  enemyKill: 50,
  kaneKill: 500,
  package: 75,
  packagesTotal: 8,
};

export const MISSION_TUNING = {
  packageTime: 180,
  fareTime: 90,
  smugglerTime: 120,
  safeCrackTime: 5,
  safeCrackReward: 800,
  kaneHp: 150,
  viperHp: 60,
  enemyCount: 5,
};

export const KEYS = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  interact: 'KeyE',
  reload: 'KeyR',
  sprint: 'ShiftLeft',
  sprintRight: 'ShiftRight',
  handbrake: 'Space',
  pause: 'Escape',
  mute: 'KeyM',
  confirm: 'Enter',
};
