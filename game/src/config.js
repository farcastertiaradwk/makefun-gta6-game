// SOLMAR HEAT — every number the game shares, in one place.
// The map, the movement, the heat, the money and the look. A balance pass
// touches this file and nothing else.

// The world advances in fixed steps of one sixtieth of a second.
export const STEP = 1 / 60;

// ---------------------------------------------------------------------------
// Solmar itself: a rectangle of streets with a beach and a harbour.
// ---------------------------------------------------------------------------

export const WORLD = { w: 2600, h: 1900 };

// Six avenues north-south, five streets east-west.
export const ROADS_X = [250, 650, 1050, 1450, 1850, 2250];
export const ROADS_Y = [250, 600, 950, 1300, 1650];
export const ROAD_W = 90;

// The beach runs along the south edge; the sea is the world's south wall.
export const BEACH_Y = 1750;
export const SEA_Y = 1840;

// The harbour is the east edge between these y values.
export const HARBOUR = { x: 2420, y0: 300, y1: 950 };

// ---------------------------------------------------------------------------
// Moving: on foot and behind the wheel.
// ---------------------------------------------------------------------------

export const PLAYER = {
  radius: 14,
  walkSpeed: 170,
  runSpeed: 265,
  health: 100,
  pistolDamage: 34,
  fireInterval: 0.24,
  magazine: 12,
  reloadTime: 1.1,
  bulletSpeed: 720,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 420,
  brake: 620,
  maxSpeed: 430,
  maxReverse: 160,
  grip: 3.2,
  turnRate: 2.6,
  health: 100,
};

export const TRAFFIC_SPEED = 95;
export const PED_SPEED = 38;
export const PED_FLEE_SPEED = 78;

// ---------------------------------------------------------------------------
// The law: heat, decay and what raises it.
// ---------------------------------------------------------------------------

export const WANTED = {
  decaySeconds: 15,
  decayRange: 380,
  maxStars: 5,
  steal: 1,
  shoot: 1,
  killPed: 2,
  killCop: 2,
  runOverPed: 1,
  hitCopCar: 1,
};

export const POLICE = {
  footSpeed: 185,
  footShootRange: 260,
  footShootInterval: 1.2,
  carSpeed: 470,
  bustSeconds: 1.6,
  bustRange: 24,
  spawnInterval: 2.2,
};

// ---------------------------------------------------------------------------
// Money: what missions pay and what the shops charge.
// ---------------------------------------------------------------------------

export const ECONOMY = {
  startCash: 150,
  missionReward: [400, 600, 800, 900, 1500, 2500],
  ammoPrice: 60,
  ammoAmount: 24,
  armorPrice: 120,
  repairPrice: 80,
  layLowPerStar: 100,
  bustFine: 150,
  wastedFine: 100,
};

// ---------------------------------------------------------------------------
// The look of the city.
// ---------------------------------------------------------------------------

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6f9c4e',
  sand: '#e8cf9a',
  sea: '#2e7f9e',
  seaDeep: '#256b87',
  road: '#3c3f46',
  roadLine: '#e8d44d',
  sidewalk: '#b9b3a4',
  plaza: '#cbb98f',
  parkPath: '#d8c49a',
  buildingRoof: ['#c96f4a', '#d9a05b', '#7fa8a0', '#b06a8a', '#8a7fb8', '#e0c078', '#5b8a6a', '#c25b5b'],
  buildingWall: '#8a7a66',
  carColors: ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2c3e50', '#e67e22', '#8e44ad', '#16a085', '#d35400'],
  policeCar: '#2e5fa3',
  policeLight: ['#ff2d2d', '#2d6bff'],
  playerShirt: '#e74c3c',
  marker: '#ffd94d',
  markerEnemy: '#ff4d4d',
};

// ---------------------------------------------------------------------------
// Fixed places: every mission and shop points at one of these.
// ---------------------------------------------------------------------------

export const PLACES = {
  safehouse: { x: 300, y: 1600, name: 'Sunset Safehouse' },
  gunshop: { x: 700, y: 300, name: 'Iron & Lead' },
  garage: { x: 1500, y: 300, name: 'Fix-It Garage' },
  bank: { x: 2200, y: 650, name: 'Harbor Bank' },
  docks: { x: 2450, y: 600, name: 'The Docks' },
  plaza: { x: 850, y: 775, name: 'Solmar Plaza' },
  lighthouse: { x: 250, y: 1800, name: 'Lighthouse Point' },
  park: { x: 1250, y: 1125, name: 'Palm Park' },
};
