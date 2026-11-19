// The story of SOLMAR HEAT: eight jobs for Danny Reyes, from a first
// stolen car to the top of Solmar. Each mission is a small state machine:
// stages with an objective, a map marker, sometimes a timer. Failing a
// timed job sends Danny back to its start; finishing the last one wins.

import { WORLD, REWARDS, MISSION_TUNING } from './config.js';
import { setWanted } from './police.js';
import { makeVehicle } from './vehicles.js';
import { floatText, burst } from './effects.js';

export const MISSION_LIST = [
  { name: 'Wheels', brief: 'Mara needs a wheelman. Steal a car, then bring it to The Docks.', reward: REWARDS.mission[0] },
  { name: 'The Package', brief: 'Three packages are waiting around Solmar. Collect them all before the clock dies.', reward: REWARDS.mission[1] },
  { name: 'Getaway Driver', brief: 'Pick Mara up at Voss Plaza, then drive her home with three stars on your tail.', reward: REWARDS.mission[2] },
  { name: 'The Fix', brief: 'The heat is on. Lose the cops, then get the car to the Fix-It Garage.', reward: REWARDS.mission[3] },
  { name: 'Bank Score', brief: 'Crack the Harbor Bank safe. Hold E at the vault, grab the cash, and run.', reward: REWARDS.mission[4] },
  { name: 'Cab Fare', brief: 'Drive the cab. Three fares, each on the clock — fast drops earn a tip.', reward: REWARDS.mission[5] },
  { name: 'Smuggler Run', brief: 'Grab the crate at the Docks and run it to the beach drop in two minutes. The law will notice.', reward: REWARDS.mission[6] },
  { name: 'King of Solmar', brief: 'KANE runs this city from Voss Plaza. Take him and his Vipers down.', reward: REWARDS.mission[7] },
];

const PACKAGE_SPOTS = [
  { x: 650, y: 650, label: 'Marlowe Park' },
  { x: 1050, y: 950, label: 'Voss Plaza' },
  { x: 2250, y: 600, label: 'Harbour' },
];

const FARES = [
  { pickup: { x: 1000, y: 1000, label: 'Voss Plaza' }, drop: { x: 1300, y: 2450, label: 'Beach' } },
  { pickup: { x: 2350, y: 1350, label: 'The Docks' }, drop: { x: 600, y: 1400, label: 'Iron & Lead' } },
  { pickup: { x: 600, y: 600, label: 'Marlowe Park' }, drop: { x: 2200, y: 700, label: 'Harbor Bank' } },
];

const PLAZA = WORLD.places.plaza;

export function startMission(game, index) {
  game.missionIndex = index;
  game.missionStage = 0;
  game.missionTimer = 0;
  game.missionFailed = null;
  game.missionData = null;
  game.crack = 0;
  game.crackBand = 0;
  game.fare = null;
  game.fareIndex = 0;
  game.crate = false;
  game.mara = null;
  game.cab = null;
  game.enemies = [];
  game.marker = null;
  game.objectiveText = '';
  const def = MISSION_LIST[index];
  game.briefTitle = `MISSION ${index + 1}/8 — ${def.name}`;
  game.briefText = def.brief;
  // Per-mission setup.
  if (index === 2) {
    game.mara = { x: WORLD.places.maraSpot.x, y: WORLD.places.maraSpot.y, aboard: false };
  }
  if (index === 3) {
    // The Fix opens hot: three stars the moment the job starts.
    setWanted(game, 3);
  }
  if (index === 5) {
    const cab = makeVehicle('taxi', 380, 1520, 0, '#f2c230');
    game.cars.push(cab);
    game.cab = cab;
  }
  if (index === 7) {
    spawnBossFight(game);
  }
  game.screen = 'brief';
}

function spawnBossFight(game) {
  const spots = [
    { x: PLAZA.x, y: PLAZA.y, boss: true },
    { x: PLAZA.x - 90, y: PLAZA.y - 70, boss: false },
    { x: PLAZA.x + 90, y: PLAZA.y - 70, boss: false },
    { x: PLAZA.x - 90, y: PLAZA.y + 70, boss: false },
    { x: PLAZA.x + 90, y: PLAZA.y + 70, boss: false },
  ];
  for (const s of spots) {
    game.enemies.push({
      x: s.x, y: s.y,
      hp: s.boss ? MISSION_TUNING.kaneHp : MISSION_TUNING.viperHp,
      maxHp: s.boss ? MISSION_TUNING.kaneHp : MISSION_TUNING.viperHp,
      boss: s.boss,
      name: s.boss ? 'KANE' : 'Viper',
      angle: 0,
      shootAt: 0,
      dead: false,
      speed: 150,
    });
  }
}

export function stepMissions(game, dt) {
  if (game.screen !== 'play') return;
  const i = game.missionIndex;
  if (i === 0) runWheels(game, dt);
  else if (i === 1) runPackages(game, dt);
  else if (i === 2) runGetaway(game, dt);
  else if (i === 3) runFix(game, dt);
  else if (i === 4) runBank(game, dt);
  else if (i === 5) runCab(game, dt);
  else if (i === 6) runSmuggler(game, dt);
  else if (i === 7) runBoss(game, dt);
  if (game.missionTimer > 0) {
    game.missionTimer -= dt;
    if (game.missionTimer <= 0) {
      game.missionTimer = 0;
      failMission(game, 'OUT OF TIME');
    }
  }
}

function near(game, x, y, r) {
  const at = game.player.inCar || game.player;
  return Math.hypot(at.x - x, at.y - y) < r;
}

function nearOnFoot(game, x, y, r) {
  const p = game.player;
  return !p.inCar && Math.hypot(p.x - x, p.y - y) < r;
}

function setObjective(game, text, x, y) {
  game.objectiveText = text;
  game.marker = x === undefined ? null : { x, y };
}

function completeMission(game) {
  const def = MISSION_LIST[game.missionIndex];
  if (def.reward > 0) {
    game.cash += def.reward;
    floatText(game.fx, game.player.x, game.player.y - 30, `+$${def.reward}`, '#ffd94d');
  }
  game.audio.sting();
  game.missionStage = 0;
  game.missionTimer = 0;
  game.marker = null;
  if (game.missionIndex >= MISSION_LIST.length - 1) {
    game.screen = 'victory';
    game.audio.sting();
    return;
  }
  game.completeTitle = `${def.name} — DONE`;
  game.completeText = def.reward > 0 ? `Mara wires you $${def.reward}.` : 'Clean work. Mara has another job.';
  game.screen = 'complete';
}

export function advanceAfterComplete(game) {
  startMission(game, game.missionIndex + 1);
}

export function failMission(game, reason) {
  game.missionFailed = reason;
  game.audio.fail();
  game.screen = 'failed';
}

function runWheels(game, dt) {
  if (game.missionStage === 0) {
    setObjective(game, 'Steal a car', 350, 1500);
    if (game.player.inCar) {
      game.missionStage = 1;
    }
  } else {
    setObjective(game, 'Drive to The Docks', WORLD.places.docks.x, WORLD.places.docks.y);
    if (near(game, WORLD.places.docks.x, WORLD.places.docks.y, 95)) {
      completeMission(game);
    }
  }
}

function runPackages(game, dt) {
  if (!game.missionData) game.missionData = { spots: PACKAGE_SPOTS.map((s) => ({ ...s, got: false })), got: 0 };
  const data = game.missionData;
  if (game.missionStage === 0) {
    game.missionTimer = MISSION_TUNING.packageTime;
    game.missionStage = 1;
  }
  const at = game.player.inCar || game.player;
  let next = null;
  for (const s of data.spots) {
    if (s.got) continue;
    if (!next) next = s;
    if (Math.hypot(at.x - s.x, at.y - s.y) < 46) {
      s.got = true;
      data.got += 1;
      game.cash += 25;
      floatText(game.fx, s.x, s.y - 20, 'PACKAGE  +$25', '#e8b73a');
      game.audio.pickup();
      if (data.got >= 3) {
        game.missionData = null;
        completeMission(game);
        return;
      }
    }
  }
  setObjective(game, `Collect the packages: ${data.got}/3`, next ? next.x : 0, next ? next.y : 0);
}

function runGetaway(game, dt) {
  if (game.missionStage === 0) {
    setObjective(game, 'Pick up Mara at Voss Plaza', game.mara.x, game.mara.y);
    if (game.player.inCar && near(game, game.mara.x, game.mara.y, 75)) {
      game.mara.aboard = true;
      game.missionStage = 1;
      setWanted(game, 3);
      floatText(game.fx, game.player.x, game.player.y - 30, "MARA'S IN — GO!", '#7ac74f');
    }
  } else {
    setObjective(game, 'Drive Mara to the Safehouse', WORLD.places.safehouse.x, WORLD.places.safehouse.y);
    if (!game.player.inCar) {
      // The car died with Mara in it: she waits where Danny steps out.
      game.mara.aboard = false;
      game.mara.x = game.player.x;
      game.mara.y = game.player.y + 40;
      game.missionStage = 0;
      return;
    }
    if (near(game, WORLD.places.safehouse.x, WORLD.places.safehouse.y, 95)) {
      game.mara = null;
      completeMission(game);
    }
  }
}

function runFix(game, dt) {
  if (game.missionStage === 0) {
    setObjective(game, 'Lose the cops', undefined, undefined);
    if (game.wanted === 0) game.missionStage = 1;
  } else {
    setObjective(game, 'Reach the Fix-It Garage', WORLD.places.garage.x, WORLD.places.garage.y);
    if (near(game, WORLD.places.garage.x, WORLD.places.garage.y, 95)) {
      completeMission(game);
    }
  }
}

function runBank(game, dt) {
  if (game.missionStage === 0) {
    setObjective(game, 'Reach the Harbor Bank', WORLD.places.bank.x, WORLD.places.bank.y);
    if (nearOnFoot(game, WORLD.places.bankSafe.x, WORLD.places.bankSafe.y, 70)) {
      game.missionStage = 1;
    }
  } else if (game.missionStage === 1) {
    setObjective(game, 'Hold E — cracking the safe…', WORLD.places.bankSafe.x, WORLD.places.bankSafe.y);
    const holding = game.input.is('KeyE') && nearOnFoot(game, WORLD.places.bankSafe.x, WORLD.places.bankSafe.y, 70);
    if (holding) {
      game.crack += dt / MISSION_TUNING.safeCrackTime;
      const band = Math.floor(game.crack * 5);
      if (band > game.crackBand) {
        game.crackBand = band;
        game.audio.blip(1200, 1200, 0.06, 'square', 0.12);
      }
      if (game.crack >= 1) {
        game.cash += MISSION_TUNING.safeCrackReward;
        setWanted(game, 3);
        game.missionStage = 2;
        floatText(game.fx, game.player.x, game.player.y - 30, `+$${MISSION_TUNING.safeCrackReward}`, '#ffd94d');
        game.audio.cash();
      }
    } else if (game.crack > 0) {
      game.crack = Math.max(0, game.crack - dt * 0.2);
    }
  } else {
    setObjective(game, 'Escape to the Fix-It Garage', WORLD.places.garage.x, WORLD.places.garage.y);
    if (near(game, WORLD.places.garage.x, WORLD.places.garage.y, 95)) {
      completeMission(game);
    }
  }
}

function runCab(game, dt) {
  // The cab must survive: a wrecked cab is replaced at the nearest road.
  if (!game.cab || game.cab.wrecked) {
    const at = game.player.inCar || game.player;
    const cab = makeVehicle('taxi', at.x + 120, at.y, 0, '#f2c230');
    game.cars.push(cab);
    game.cab = cab;
  }
  const fare = FARES[game.fareIndex];
  if (!fare) {
    completeMission(game);
    return;
  }
  if (!game.fare) {
    if (game.player.inCar !== game.cab) {
      setObjective(game, 'Get in the cab', game.cab.x, game.cab.y);
      return;
    }
    setObjective(game, `Pick up the fare — ${fare.pickup.label}`, fare.pickup.x, fare.pickup.y);
    if (near(game, fare.pickup.x, fare.pickup.y, 65)) {
      game.fare = { ...fare, timer: MISSION_TUNING.fareTime, boarded: true };
      game.missionTimer = MISSION_TUNING.fareTime;
      floatText(game.fx, game.player.x, game.player.y - 30, 'FARE ABOARD', '#7ac74f');
      game.audio.pickup();
    }
    return;
  }
  setObjective(game, `Drop the fare — ${fare.drop.label}`, fare.drop.x, fare.drop.y);
  if (near(game, fare.drop.x, fare.drop.y, 70)) {
    const left = game.missionTimer;
    let pay = REWARDS.fare;
    if (left > 20) pay += REWARDS.fareTip;
    game.cash += pay;
    floatText(game.fx, game.player.x, game.player.y - 30, `FARE +$${pay}`, '#ffd94d');
    game.audio.cash();
    game.fare = null;
    game.missionTimer = 0;
    game.fareIndex += 1;
  }
}

function runSmuggler(game, dt) {
  if (game.missionStage === 0) {
    setObjective(game, 'Pick up the crate at The Docks', WORLD.places.docks.x, WORLD.places.docks.y);
    if (near(game, WORLD.places.docks.x, WORLD.places.docks.y, 70)) {
      game.crate = true;
      game.missionStage = 1;
      game.missionTimer = MISSION_TUNING.smugglerTime;
      setWanted(game, Math.max(game.wanted, 2));
      floatText(game.fx, game.player.x, game.player.y - 30, 'CRATE ABOARD — RUN!', '#ff9d3d');
    }
  } else {
    setObjective(game, 'Deliver to the beach drop', WORLD.places.beachDrop.x, WORLD.places.beachDrop.y);
    if (near(game, WORLD.places.beachDrop.x, WORLD.places.beachDrop.y, 85)) {
      completeMission(game);
    }
  }
}

function runBoss(game, dt) {
  const alive = game.enemies.filter((e) => !e.dead);
  const kane = game.enemies.find((e) => e.boss);
  if (alive.length === 0) {
    completeMission(game);
    return;
  }
  const kaneText = kane && !kane.dead ? 'Take down KANE' : 'Finish the Vipers';
  setObjective(game, `${kaneText} — ${MISSION_TUNING.enemyCount - alive.length}/${MISSION_TUNING.enemyCount}`, PLAZA.x, PLAZA.y);
  const p = game.player;
  const at = p.inCar || p;
  for (const e of game.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(at.x - e.x, at.y - e.y);
    e.angle = Math.atan2(at.y - e.y, at.x - e.x);
    if (d > 320) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else if (d < 200) {
      e.x -= Math.cos(e.angle) * e.speed * 0.4 * dt;
      e.y -= Math.sin(e.angle) * e.speed * 0.4 * dt;
    }
    if (d < 420 && game.time > e.shootAt) {
      e.shootAt = game.time + 2.4;
      const aimErr = (Math.random() - 0.5) * 0.3;
      game.bullets.push({
        x: e.x + Math.cos(e.angle) * 18,
        y: e.y + Math.sin(e.angle) * 18,
        vx: Math.cos(e.angle + aimErr) * 500,
        vy: Math.sin(e.angle + aimErr) * 500,
        from: 'enemy',
        damage: 5,
        life: 1.0,
      });
      burst(game.fx, e.x + Math.cos(e.angle) * 18, e.y + Math.sin(e.angle) * 18, '#ffd94d', 3, 90);
    }
  }
}

export function missionProgress(game) {
  return `${game.missionIndex + 1}/8`;
}
