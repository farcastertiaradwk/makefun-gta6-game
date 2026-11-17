// SOLMAR HEAT — one place for every number the game runs on. The map
// dimensions, the road grid, how fast Danny runs and drives, how heat
// builds and cools, what things cost, the palette, and where the named
// places sit. Nothing else in the code hard-codes a tunable value: change
// a number here and the whole game rebalances around it.

export const TICK = 1 / 60;

// The viewport the camera frames: the driver runs at 1280x720, and the
// camera clamps the view to the map around the player.
export const VIEW = { w: 1280, h: 720 };

// Sound: one master level, and the radio's four stations (the synth loop
// cycles their chords; the names are what the HUD would show).
export const AUDIO = { masterVolume: 0.5, engineVolume: 0.06, sirenVolume: 0.035 };
export const STATIONS = ['SOLMAR FM', 'VICE 98', 'PALM 101', 'HARBOUR WAVE'];

// The island is 2,600 wide and 1,900 tall. The sea is the southern wall;
// harbour water hugs the eastern edge.
export const MAP = { w: 2600, h: 1900 };
export const LANES_X = [250, 650, 1050, 1450, 1850, 2250];
export const LANES_Y = [250, 600, 950, 1300, 1650];
export const LANE_W = 90;
export const SHORE_Y = 1750;
export const WATER_Y = 1840;
export const HARBOR = { x: 2420, y0: 300, y1: 950 };

// Danny on foot: his walk and sprint, his health, and the pistol he carries.
export const ONFOOT = {
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

// Behind the wheel: arcade handling, top speed 430.
export const VEHICLE = {
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

export const CRUISE = 95;
export const STROLL = 38;
export const PANIC = 78;

// Heat: how fast it grows per crime, and how it cools off.
export const HEAT = {
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

// The force: foot speed, shooting range and rhythm, pursuit speed, how
// long a bust takes, how close a cop must stand, spawn pacing.
export const FORCE = {
  footSpeed: 185,
  footShootRange: 260,
  footShootInterval: 1.2,
  carSpeed: 470,
  bustSeconds: 1.6,
  bustRange: 24,
  spawnInterval: 2.2,
};

// Particles: how big a blast is, and how hard it shakes the camera.
export const PARTICLE = {
  burstBig: 26,
  burstSmall: 14,
  shakeBig: 14,
  shakeSmall: 8,
};

// Cash: what Danny starts with, what each job pays, what the shops charge.
export const PRICES = {
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

// Sun-soaked Solmar: grass, sand, sea, asphalt, roofs, cars, the player.
export const COLORS = {
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
  buildingRoof: [
    '#c96f4a',
    '#d9a05b',
    '#7fa8a0',
    '#b06a8a',
    '#8a7fb8',
    '#e0c078',
    '#5b8a6a',
    '#c25b5b',
  ],
  buildingWall: '#8a7a66',
  carColors: [
    '#c0392b',
    '#2980b9',
    '#f1c40f',
    '#ecf0f1',
    '#2c3e50',
    '#e67e22',
    '#8e44ad',
    '#16a085',
    '#d35400',
  ],
  policeCar: '#2e5fa3',
  policeLight: ['#ff2d2d', '#2d6bff'],
  playerShirt: '#e74c3c',
  marker: '#ffd94d',
  markerEnemy: '#ff4d4d',
};

// Where everything happens: the safehouse, the shops, the bank, the docks,
// the plaza, the lighthouse, the park.
export const SITES = {
  safehouse: { x: 300, y: 1600, name: 'Sunset Safehouse' },
  gunshop: { x: 700, y: 300, name: 'Iron & Lead' },
  garage: { x: 1500, y: 300, name: 'Fix-It Garage' },
  bank: { x: 2200, y: 650, name: 'Harbor Bank' },
  docks: { x: 2450, y: 600, name: 'The Docks' },
  plaza: { x: 850, y: 775, name: 'Solmar Plaza' },
  lighthouse: { x: 250, y: 1800, name: 'Lighthouse Point' },
  park: { x: 1250, y: 1125, name: 'Palm Park' },
};
