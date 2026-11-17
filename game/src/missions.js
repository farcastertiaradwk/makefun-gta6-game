// The story of SOLMAR HEAT: six jobs for Danny Reyes, wheelman out of work,
// taking orders from Mara Voss and the Harbour Crew until he stands at the
// top of Solmar. Each mission is a small state machine — stages with an
// objective line, a map marker, and a condition that moves it on. The
// driver (and the staged screenshots) can jump to any mission with
// startMission; in normal play they chain through the mission-complete
// screen. Rewards are paid on completion, except the bank job, where the
// safe itself pays out.

import { MISSIONS, PLACES, WORLD } from './config.js';
import { dist } from './random.js';
import { floatText } from './effects.js';
import { setWanted } from './police.js';

/** The six jobs: name, brief for the title card, and reward. */
export const MISSION_LIST = [
  { name: 'Wheels', brief: 'Mara needs a wheelman. Steal a car and bring it to The Docks.', reward: 200 },
  { name: 'The Package', brief: 'Three packages are stashed around Solmar. Collect them all — 180 seconds.', reward: 250 },
  { name: 'Getaway Driver', brief: 'Drive Mara to the Safehouse. The whole city is watching: three stars.', reward: 300 },
  { name: 'The Fix', brief: 'Shake the tail, then get the car to the Fix-It Garage.', reward: 200 },
  { name: 'Bank Score', brief: 'Crack the Harbor Bank safe. Hold E on the vault — then run.', reward: 0 },
  { name: 'King of Solmar', brief: 'Kane and his Vipers hold the plaza. End it.', reward: 500 },
];

/** Package stashes for mission 2: fixed spots around the city. */
const PACKAGE_SPOTS = [
  { x: 1000, y: 600 },
  { x: 1800, y: 1400 },
  { x: 600, y: 1800 },
];

/** Health and ammo pickups placed around the city at the start. */
const SUPPLY_SPOTS = [
  { x: 600, y: 1000, kind: 'health' },
  { x: 1400, y: 600, kind: 'ammo' },
  { x: 1800, y: 1800, kind: 'health' },
  { x: 1000, y: 1400, kind: 'ammo' },
  { x: 2200, y: 1000, kind: 'health' },
  { x: 600, y: 2200, kind: 'ammo' },
];

/** Put the fixed supply pickups on the map. */
export function placeSupplies(world) {
  for (const s of SUPPLY_SPOTS) {
    world.pickups.push({ x: s.x, y: s.y, kind: s.kind });
  }
}

/** Begin mission i (0-based). Resets the mission state and stages its scene. */
export function startMission(world, i) {
  const def = MISSION_LIST[i];
  if (!def) return;
  world.mission = {
    index: i,
    stage: 0,
    status: 'active',
    objective: '',
    timer: 0,
    data: { collected: 0, crack: 0 },
  };
  const m = world.mission;
  // Test hooks and chaining revive the player so a mission always starts alive.
  world.player.health = Math.max(world.player.health, 100);
  world.screen = 'play';
  if (i === 0) {
    m.objective = 'Steal a car';
    world.marker = null;
  } else if (i === 1) {
    m.timer = MISSIONS.packageTime;
    m.objective = 'Collect the packages: 0/3';
    for (const s of PACKAGE_SPOTS) {
      world.pickups.push({ x: s.x, y: s.y, kind: 'package' });
    }
    world.marker = { x: PACKAGE_SPOTS[0].x, y: PACKAGE_SPOTS[0].y };
  } else if (i === 2) {
    setWanted(world, 3);
    m.objective = 'Drive Mara to the Safehouse';
    world.marker = { x: PLACES.safehouse.x + 60, y: PLACES.safehouse.y + 45 };
    world.maraRiding = true;
  } else if (i === 3) {
    m.objective = 'Lose the cops';
    world.marker = null;
  } else if (i === 4) {
    m.objective = 'Reach the Harbor Bank';
    world.marker = { x: world.city.bankSafe.x, y: world.city.bankSafe.y };
  } else if (i === 5) {
    m.objective = 'Take down KANE';
    const plaza = PLACES.plaza;
    world.enemies.push({
      x: plaza.x, y: plaza.y, health: MISSIONS.kaneHealth, boss: true, name: 'KANE',
      speed: 120, shootTimer: 1, angle: 0,
    });
    for (let k = 0; k < MISSIONS.viperCount; k += 1) {
      const a = (k / MISSIONS.viperCount) * Math.PI * 2;
      world.enemies.push({
        x: plaza.x + Math.cos(a) * 120,
        y: plaza.y + Math.sin(a) * 120,
        health: MISSIONS.enemyHealth, boss: false, name: 'Viper',
        speed: 135, shootTimer: 1 + k * 0.3, angle: 0,
      });
    }
    world.marker = { x: plaza.x, y: plaza.y };
  }
  world.audio.sting();
}

/** The mission is done: pay out, count it, and show the complete screen. */
export function completeMission(world) {
  const m = world.mission;
  if (!m || m.status !== 'active') return;
  m.status = 'done';
  const def = MISSION_LIST[m.index];
  world.cash += def.reward;
  world.missionsDone = (world.missionsDone || 0) + 1;
  world.marker = null;
  world.maraRiding = false;
  if (def.reward > 0) floatText(world, world.player.x, world.player.y - 24, `+$${def.reward}`, '#7be382');
  world.audio.coin();
  if (m.index === 5) {
    world.screen = 'victory';
    world.audio.sting();
  } else {
    world.screen = 'missionComplete';
  }
}

/** The mission failed (timer ran out): offer a retry. */
export function failMission(world, reason) {
  const m = world.mission;
  if (!m || m.status !== 'active') return;
  m.status = 'failed';
  m.failReason = reason || 'The job fell apart.';
  world.marker = null;
  world.maraRiding = false;
  world.screen = 'missionFailed';
  world.audio.fail();
}

/** Move to the next mission after the complete screen. */
export function nextMission(world) {
  const next = (world.mission ? world.mission.index : 0) + 1;
  if (next >= MISSION_LIST.length) {
    world.screen = 'victory';
    return;
  }
  startMission(world, next);
}

/** Retry the failed mission from its start. */
export function retryMission(world) {
  const i = world.mission ? world.mission.index : 0;
  startMission(world, i);
}

/** Per-mission stage logic, run once per frame while a mission is active. */
export function updateMission(world, dt) {
  const m = world.mission;
  if (!m || m.status !== 'active') return;
  const p = world.player;
  if (m.index === 0) {
    if (m.stage === 0 && p.inCar) {
      m.stage = 1;
      m.objective = 'Drive to The Docks';
      world.marker = { x: PLACES.docks.x, y: PLACES.docks.y };
    } else if (m.stage === 1 && dist(p.x, p.y, PLACES.docks.x, PLACES.docks.y) < 130) {
      completeMission(world);
    }
  } else if (m.index === 1) {
    m.timer -= dt;
    if (m.data.collected >= MISSIONS.packageCount) {
      completeMission(world);
      return;
    }
    if (m.timer <= 0) {
      failMission(world, 'Time ran out — the packages moved on.');
      return;
    }
    // Point the marker at the nearest uncollected package.
    let best = null;
    let bestD = Infinity;
    for (const pk of world.pickups) {
      if (pk.kind !== 'package') continue;
      const d = dist(p.x, p.y, pk.x, pk.y);
      if (d < bestD) {
        bestD = d;
        best = pk;
      }
    }
    world.marker = best ? { x: best.x, y: best.y } : null;
  } else if (m.index === 2) {
    const sh = PLACES.safehouse;
    if (p.inCar && dist(p.x, p.y, sh.x + 60, sh.y + 45) < 120) {
      completeMission(world);
    }
  } else if (m.index === 3) {
    if (m.stage === 0 && world.wanted === 0) {
      m.stage = 1;
      m.objective = 'Reach the Fix-It Garage';
      world.marker = { x: PLACES.garage.x + 70, y: PLACES.garage.y + 50 };
    } else if (m.stage === 1) {
      const g = PLACES.garage;
      if (dist(p.x, p.y, g.x + 70, g.y + 50) < 120) {
        completeMission(world);
      }
    }
  } else if (m.index === 4) {
    const safe = world.city.bankSafe;
    if (m.stage === 0) {
      if (dist(p.x, p.y, safe.x, safe.y) < 130) {
        m.stage = 1;
        m.objective = 'Crack the safe — hold E';
        world.marker = { x: safe.x, y: safe.y };
      }
    } else if (m.stage === 1) {
      const holding = world.input.isDown(['KeyE']) && dist(p.x, p.y, safe.x, safe.y) < 100 && !p.inCar;
      if (holding) {
        const before = Math.floor(m.data.crack / 20);
        m.data.crack += (dt / MISSIONS.safeCrackSeconds) * 100;
        if (Math.floor(m.data.crack / 20) > before) world.audio.tone(880, 0.05, 'square', 0.05);
        if (m.data.crack >= 100) {
          m.data.crack = 100;
          world.cash += MISSIONS.safePayout;
          floatText(world, safe.x, safe.y - 30, `+$${MISSIONS.safePayout}`, '#7be382');
          setWanted(world, 3);
          m.stage = 2;
          m.objective = 'Escape to the Fix-It Garage';
          world.marker = { x: PLACES.garage.x + 70, y: PLACES.garage.y + 50 };
          world.audio.coin();
        }
      }
    } else if (m.stage === 2) {
      const g = PLACES.garage;
      if (dist(p.x, p.y, g.x + 70, g.y + 50) < 120) {
        completeMission(world);
      }
    }
  } else if (m.index === 5) {
    const alive = world.enemies.filter((e) => e.health > 0).length;
    if (alive === 0) {
      completeMission(world);
      return;
    }
    // Enemies hunt the player: walk closer and shoot.
    for (const e of world.enemies) {
      if (e.health <= 0) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > 130) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 520) {
        e.shootTimer = e.boss ? 1.5 : 1.9;
        const a = Math.atan2(p.y - e.y, p.x - e.x) + world.rng.range(-0.1, 0.1);
        world.bullets.push({
          x: e.x + Math.cos(a) * 18,
          y: e.y + Math.sin(a) * 18,
          vx: Math.cos(a) * 480,
          vy: Math.sin(a) * 480,
          travelled: 0,
          range: 560,
          damage: e.boss ? 12 : 8,
          fromPlayer: false,
        });
        world.audio.shot();
      }
    }
  }
}

/** The short objective line the HUD prints under the mission name. */
export function missionTitle(world) {
  const m = world.mission;
  if (!m) return '';
  const def = MISSION_LIST[m.index];
  return `${m.index + 1}/6 ${def.name}`;
}
