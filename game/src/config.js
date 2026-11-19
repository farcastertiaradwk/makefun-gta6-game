// Every tuning number for SOLMAR HEAT lives here, grouped by system.
// The story: Danny Reyes, wheelman out of work, runs jobs for Mara Voss
// and the Harbour Crew across eight missions in the city of Solmar.
export const CFG = {
  world: { w: 2600, h: 2600, seed: 7 },
  view: { w: 1280, h: 720 },
  roads: { spacing: 400, first: 200, width: 56 },
  player: {
    walk: 175, sprint: 295, radius: 13,
    hp: 100, armorMax: 100,
    magSize: 12, reserveStart: 48, reserveCap: 240,
    reloadSecs: 1.2, bulletSpeed: 950, bulletRange: 620, bulletDamage: 26,
    pickupRadius: 34,
  },
  car: {
    accel: 520, reverseAccel: 300, maxSpeed: 1195, maxReverse: 320,
    turn: 2.6, grip: 0.94, handbrakeGrip: 0.72,
    hp: 100, stealRadius: 46, kmh: 0.36,
  },
  bike: {
    accel: 660, maxSpeed: 1445, turn: 3.4, grip: 0.9,
    hp: 45, stealRadius: 42,
  },
  traffic: { count: 14, speedMin: 460, speedMax: 720, spawnGap: 90 },
  ped: { count: 26, walk: 62, flee: 210, radius: 11, hp: 50 },
  police: {
    maxCops: 5, copSpeed: 205, copHp: 60,
    shootRange: 430, shootEvery: 1.2, bulletDamage: 7,
    carHp: 100, carSpeed: 1250, maxCars: 4,
    decaySecs: 8, decayRange: 520,
  },
  enemy: { hp: 100, kaneHp: 220, shootEvery: 2.4, damage: 5, spread: 0.16, range: 520 },
  prices: {
    ammo: 60, armor: 120, repair: 80, layLowPerStar: 100,
    packageReward: 75, farePay: 120, fareTip: 30,
    startCash: 150, bankTake: 800,
  },
  places: {
    safehouse: { x: 300, y: 1600, label: 'Safehouse' },
    docks: { x: 2350, y: 1350, label: 'The Docks' },
    bank: { x: 2220, y: 700, label: 'Harbor Bank' },
    gunshop: { x: 600, y: 1400, label: 'Iron & Lead' },
    garage: { x: 1800, y: 1800, label: 'Fix-It Garage' },
    plaza: { x: 1000, y: 1000, label: 'Solmar Plaza' },
    park: { x: 610, y: 610, label: 'Green Park' },
    beach: { x: 1300, y: 2450, label: 'South Beach' },
    harbour: { x: 2450, y: 500, label: 'The Harbour' },
  },
  missions: [
    { name: 'Wheels', reward: 100 },
    { name: 'The Package', reward: 200, timer: 180 },
    { name: 'Getaway Driver', reward: 250 },
    { name: 'The Fix', reward: 200 },
    { name: 'Bank Score', reward: 300, crackSecs: 5 },
    { name: 'Cab Fare', reward: 0, fares: 3 },
    { name: 'Smuggler Run', reward: 400, timer: 120 },
    { name: 'King of Solmar', reward: 500 },
  ],
  palette: {
    grass: '#7fae5a', grassDark: '#74a24f', road: '#3a3f47', roadLine: '#e8d44d',
    sidewalk: '#b9b3a4', block: '#8fae6d', building: '#c9a06a', roof: '#a87f52',
    water: '#2f7fb8', sand: '#e3cf9e', park: '#5d9b4a', plaza: '#cbb98a',
    wall: '#5b5348', tree: '#2f7a33', lamp: '#f5d76e',
  },
  keys: {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
    sprint: 'ShiftLeft', brake: 'Space', interact: 'KeyE', reload: 'KeyR',
    pause: 'Escape', mute: 'KeyM', start: 'Enter',
  },
};
