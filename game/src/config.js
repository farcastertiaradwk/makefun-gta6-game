// Tuning for SOLMAR HEAT: every number the game balances on lives here, in
// one place, grouped by system. Change a value here and the whole game
// follows; no other module hard-codes a balance number.

export const WORLD = {
  /** City is a square, this many pixels on a side. */
  size: 2600,
  /** Roads run at these x (and y) coordinates: a 6x6 grid. */
  roads: [200, 600, 1000, 1400, 1800, 2200],
  /** Road surface width in pixels. */
  roadWidth: 64,
  /** Sidewalk strip alongside each road. */
  sidewalk: 14,
};

/** Palette: a sun-soaked coastal city — warm grass, tan plaza, blue harbour. */
export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#74a24e',
  block: '#8fb36a',
  road: '#3c3f45',
  roadEdge: '#2e3136',
  roadLine: '#e8d44d',
  sidewalk: '#b9b3a4',
  sand: '#e3cd8f',
  water: '#3f8fd2',
  waterDeep: '#2f6fb0',
  buildingRoof: ['#b0563a', '#7d8aa0', '#a08a5a', '#5a7d8a', '#96604a'],
  buildingWall: '#cfc4ae',
  tree: '#3f7a34',
  treeLight: '#57a047',
  lamp: '#f4e3a1',
  plaza: '#d8c49a',
  fountain: '#6fb7e8',
  carColors: ['#c23b2e', '#2e6fc2', '#e8b73a', '#3a9e5f', '#e8e8e8', '#7a4a9e', '#222222', '#c2703a'],
  policeColor: '#20242e',
  heliColor: '#1c2733',
};

/** On-foot player tuning. */
export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  sprintSpeed: 265,
  maxHealth: 100,
  maxArmor: 100,
  /** Pistol: magazine size and spare ammo the player starts with. */
  magSize: 12,
  startReserve: 48,
  maxReserve: 240,
  /** Seconds between pistol shots. */
  fireInterval: 0.18,
  bulletSpeed: 720,
  bulletDamage: 25,
  bulletRange: 620,
  /** Health restored by a health pickup, ammo by an ammo pickup. */
  pickupHealth: 30,
  pickupAmmo: 24,
  pickupRadius: 34,
  /** Cash the player starts with. */
  startCash: 150,
};

/** Car physics and traffic tuning. */
export const CARS = {
  /** Player car: acceleration, top speed, reverse, steering. */
  accel: 340,
  brake: 620,
  topSpeed: 430,
  reverseSpeed: 150,
  steerRate: 2.6,
  handbrakeGrip: 0.35,
  maxHealth: 100,
  /** Traffic cruise speed range. */
  trafficMin: 120,
  trafficMax: 185,
  /** How many traffic cars roam the city. */
  trafficCount: 14,
  /** Parked cars waiting to be stolen. */
  parkedCount: 10,
  /** Collision damage per hard hit (rate-limited per car, see vehicles.js). */
  hitDamage: 6,
  hitCooldown: 0.5,
  /** A scrape slower than this speed does no damage. */
  scrapeSpeed: 120,
};

/** Pedestrian tuning. */
export const PEDS = {
  count: 24,
  walkMin: 45,
  walkMax: 85,
  fleeSpeed: 190,
  /** Gunfire or a blast inside this radius sends peds running. */
  scareRadius: 170,
};

/** Wanted level and police tuning. */
export const POLICE = {
  maxWanted: 5,
  /** Heat added by each kind of crime. */
  stealHeat: 1,
  shootHeat: 1,
  runoverHeat: 1,
  killCopHeat: 1,
  /** Shooting adds heat at most once per this many seconds. */
  shootHeatCooldown: 2,
  /** Foot cops: desired count is wanted + this, capped. */
  copBase: 2,
  copCap: 7,
  copSpeed: 152,
  copHealth: 50,
  /** Foot cops shoot at wanted >= this. */
  copShootStars: 2,
  copShootInterval: 1.2,
  copBulletDamage: 7,
  copBulletSpeed: 520,
  /** Police cars appear at wanted >= this; count is wanted - 1. */
  carStars: 2,
  carCap: 4,
  carSpeed: 400,
  carHealth: 90,
  /** Roadblocks appear at wanted >= this. */
  roadblockStars: 3,
  /** The helicopter appears at wanted >= this. */
  heliStars: 4,
  /** Seconds out of sight before wanted starts to fall, then per star. */
  decayQuiet: 6,
  decayStep: 6,
  /** Standing near the safehouse clears wanted. */
  safehouseRadius: 130,
  /** A cop this close to an on-foot player starts an arrest. */
  arrestRadius: 26,
  arrestTime: 1.2,
};

/** Prices at the shops. */
export const PRICES = {
  ammo: 60,
  ammoPack: 48,
  armor: 120,
  repair: 80,
  layLowPerStar: 100,
};

/** Mission tuning: rewards and the package timer. */
export const MISSIONS = {
  packageTime: 180,
  packageCount: 3,
  safeCrackSeconds: 5,
  rewards: [200, 250, 300, 200, 0, 500],
  /** Cash the bank safe itself pays out (mission 5). */
  safePayout: 800,
  /** Kills pay this much; Kane pays the bounty below. */
  killPay: 50,
  kaneBounty: 500,
  enemyHealth: 100,
  kaneHealth: 300,
  viperCount: 4,
};

/** Named places. Fixed coordinates so missions, shots and the playtest can
 *  rely on them; the city generator builds the blocks around them. */
export const PLACES = {
  safehouse: { x: 260, y: 1500, w: 120, h: 90, name: 'Safehouse' },
  bank: { x: 2140, y: 640, w: 160, h: 120, name: 'Harbor Bank' },
  gunshop: { x: 1340, y: 940, w: 120, h: 90, name: 'Iron & Lead' },
  garage: { x: 940, y: 1740, w: 140, h: 100, name: 'Fix-It Garage' },
  docks: { x: 2350, y: 1350, name: 'The Docks' },
  plaza: { x: 1000, y: 1000, r: 170, name: 'Solmar Plaza' },
  park: { x: 400, y: 400, w: 420, h: 420, pond: { x: 610, y: 610, r: 72 }, name: 'Palm Park' },
  /** Beach strip along the south edge; harbour water along the east edge. */
  beachY: 2440,
  harbourX: 2440,
};

/** Keyboard bindings. */
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  handbrake: ['Space'],
  interact: ['KeyE'],
  reload: ['KeyR'],
  pause: ['Escape'],
  mute: ['KeyM'],
  start: ['Enter'],
};

/** Screen ids the game moves between. */
export const SCREENS = {
  title: 'title',
  play: 'play',
  pause: 'pause',
  missionDone: 'missionComplete',
  missionFailed: 'missionFailed',
  wasted: 'wasted',
  busted: 'busted',
  victory: 'victory',
};
