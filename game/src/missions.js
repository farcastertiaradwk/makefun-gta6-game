// The story: six missions for Mara Voss and the Harbour Crew, from stealing
// a first car to taking the city from Kane. Each mission sets its own
// objective, marker and timer; the main loop reads missionStatus and ends
// the mission.
import { PLACES, ECONOMY, WORLD } from './config.js';
import { createCar } from './vehicles.js';
import { moveCircle } from './city.js';

function defineMission(name, briefing, rewardIndex) {
  return { name, briefing, reward: ECONOMY.missionReward[rewardIndex] };
}

export const MISSIONS = [
  defineMission('Wheels', 'Mara: every crew needs wheels. Steal a car — any car — and bring it to The Docks.', 0),
  defineMission('The Package', 'Three packages stashed around Solmar. Grab them all and bring them to the Fix-It Garage. Fast.', 1),
  defineMission('Getaway Driver', 'Mara needs a ride to the Safehouse and the law is already on her. Drive her there. Keep the car alive.', 2),
  defineMission('Payback', 'The Vipers jumped one of ours in the Plaza. Four of them. Make it even.', 3),
  defineMission('The Score', 'Harbor Bank. Crack the safe, take the money, and get to the Garage before the whole city shows up.', 4),
  defineMission('King of Solmar', 'Kane runs this city. End him in the Plaza, then get to Lighthouse Point while every cop in Solmar hunts you.', 5),
];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function spawnEnemy(world, x, y, boss) {
  const enemy = {
    x, y, angle: 0,
    radius: 14,
    health: boss ? 320 : 55,
    boss: !!boss,
    shootCooldown: world.random.range(0.5, 1.5),
    name: boss ? 'KANE' : 'VIPER',
  };
  world.enemies.push(enemy);
  return enemy;
}

const VIPER_SPOTS = [[800, 750], [900, 800], [820, 830], [880, 720]];

function spawnVipers(world) {
  for (const [x, y] of VIPER_SPOTS) spawnEnemy(world, x, y, false);
}

function setObjective(world, text, marker) {
  world.mission.objective = text;
  if (marker) world.mission.marker = marker;
}

export function startMission(world, index) {
  const m = {
    index,
    stage: 0,
    timer: 0,
    progress: 0,
    status: 'active',
    reason: '',
  };
  world.mission = m;
  world.enemies = [];
  if (index === 1) {
    // Three packages: plaza, park, harbour gate. Clear any left from a retry.
    world.pickups = world.pickups.filter((p) => p.kind !== 'package');
    world.pickups.push(
      { x: 850, y: 700, kind: 'package', taken: false },
      { x: 1250, y: 1050, kind: 'package', taken: false },
      { x: 2350, y: 500, kind: 'package', taken: false },
    );
    m.timer = 180;
    setObjective(world, 'Collect the packages: 0/3', { x: 850, y: 700, label: 'PACKAGE' });
  } else if (index === 2) {
    setObjective(world, 'Get in a car — Mara is waiting', { x: world.player.x, y: world.player.y, label: 'YOU' });
  } else if (index === 3) {
    spawnVipers(world);
    setObjective(world, 'Take out the Vipers: 0/4', { x: PLACES.plaza.x, y: PLACES.plaza.y, label: 'PLAZA' });
  } else if (index === 4) {
    setObjective(world, 'Get to Harbor Bank', { x: PLACES.bank.x, y: PLACES.bank.y, label: 'BANK' });
  } else if (index === 5) {
    spawnEnemy(world, 850, 775, true);
    spawnVipers(world);
    setObjective(world, 'Take down KANE', { x: PLACES.plaza.x, y: PLACES.plaza.y, label: 'KANE' });
  } else {
    setObjective(world, 'Steal a car and drive to The Docks', { x: PLACES.docks.x, y: PLACES.docks.y, label: 'DOCKS' });
  }
  return m;
}

function complete(world, text) {
  world.mission.status = 'complete';
  world.mission.reason = text;
}

function fail(world, text) {
  world.mission.status = 'failed';
  world.mission.reason = text;
}

function runWheels(world) {
  const m = world.mission;
  const player = world.player;
  if (player.inCar && dist(player.x, player.y, PLACES.docks.x, PLACES.docks.y) < 80) {
    complete(world, 'Wheels delivered.');
  } else if (!player.inCar) {
    m.objective = 'Steal a car and drive to The Docks';
  } else {
    m.objective = 'Drive to The Docks';
  }
}

function runPackages(world) {
  const m = world.mission;
  const player = world.player;
  const got = world.pickups.filter((p) => p.kind === 'package' && p.taken).length;
  m.objective = `Collect the packages: ${got}/3`;
  const remaining = world.pickups.find((p) => p.kind === 'package' && !p.taken);
  m.marker = remaining ? { x: remaining.x, y: remaining.y, label: 'PACKAGE' } : { x: PLACES.garage.x, y: PLACES.garage.y, label: 'GARAGE' };
  if (got === 3) {
    if (dist(player.x, player.y, PLACES.garage.x, PLACES.garage.y) < 80) complete(world, 'Packages delivered.');
    else m.objective = 'All packages collected — deliver to the Garage';
  }
}

function runGetaway(world) {
  const m = world.mission;
  const player = world.player;
  if (m.stage === 0) {
    if (player.inCar) {
      m.stage = 1;
      world.setWanted(2);
      world.showMessage('Mara is in. The cops are on you — drive!');
      setObjective(world, 'Drive Mara to the Safehouse', { x: PLACES.safehouse.x, y: PLACES.safehouse.y, label: 'SAFEHOUSE' });
    }
  } else if (player.inCar) {
    if (player.inCar.health < 25) { fail(world, 'The car fell apart.'); return; }
    if (dist(player.x, player.y, PLACES.safehouse.x, PLACES.safehouse.y) < 80) {
      complete(world, 'Mara is safe.');
    }
  } else {
    fail(world, 'You left the car — Mara walked away.');
  }
}

function runShootout(world) {
  const m = world.mission;
  const player = world.player;
  const alive = world.enemies.filter((e) => e.health > 0);
  const total = m.index === 3 ? 4 : 5;
  const down = total - alive.length;
  if (m.index === 3) {
    m.objective = `Take out the Vipers: ${down}/4`;
    if (alive.length === 0) complete(world, 'Payback delivered.');
    return;
  }
  if (m.stage === 0) {
    const boss = world.enemies.find((e) => e.boss);
    m.objective = boss && boss.health > 0 ? 'Take down KANE' : 'Kane is down — get to Lighthouse Point';
    if (boss && boss.health <= 0) {
      m.stage = 1;
      world.setWanted(4);
      world.showMessage('Kane is down! Every cop in Solmar is coming — run!');
      m.marker = { x: PLACES.lighthouse.x, y: PLACES.lighthouse.y, label: 'LIGHTHOUSE' };
    }
  } else if (dist(player.x, player.y, PLACES.lighthouse.x, PLACES.lighthouse.y) < 90) {
    complete(world, 'You own Solmar now.');
  }
}

function runHeist(world, dt) {
  const m = world.mission;
  const player = world.player;
  if (m.stage === 0) {
    if (dist(player.x, player.y, PLACES.bank.x, PLACES.bank.y) < 70) {
      m.stage = 1;
      m.progress = 0;
      m.objective = 'Hold E — crack the safe';
    }
  } else if (m.stage === 1) {
    if (dist(player.x, player.y, PLACES.bank.x, PLACES.bank.y) > 110) {
      m.stage = 0;
      m.progress = 0;
      m.objective = 'Get to Harbor Bank';
      m.marker = { x: PLACES.bank.x, y: PLACES.bank.y, label: 'BANK' };
    } else if (world.interactHeld) {
      m.progress += dt / 5;
      m.objective = `Cracking the safe… ${Math.floor(m.progress * 100)}%`;
      if (m.progress >= 1) {
        m.stage = 2;
        world.setWanted(3);
        world.cash += 800;
        world.showMessage('Safe cracked! $800 — now lose the cops and get to the Garage!');
        setObjective(world, 'Escape to the Fix-It Garage', { x: PLACES.garage.x, y: PLACES.garage.y, label: 'GARAGE' });
      }
    } else {
      m.objective = 'Hold E — crack the safe';
    }
  } else if (dist(player.x, player.y, PLACES.garage.x, PLACES.garage.y) < 80) {
    complete(world, 'Clean getaway.');
  }
}

export function updateMission(world, dt) {
  const m = world.mission;
  if (!m || m.status !== 'active') return;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) { fail(world, 'Out of time.'); return; }
  }
  if (m.index === 0) runWheels(world);
  else if (m.index === 1) runPackages(world);
  else if (m.index === 2) runGetaway(world);
  else if (m.index === 3 || m.index === 5) runShootout(world);
  else if (m.index === 4) runHeist(world, dt);
}

/** Rivals shoot at the player when close, and strafe to keep their distance. */
export function updateEnemies(world, dt) {
  const player = world.player;
  for (const enemy of world.enemies) {
    if (enemy.health <= 0) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    enemy.angle = Math.atan2(dy, dx);
    if (dist > 260) {
      moveCircle(world.city, enemy, (dx / dist) * 110 * dt, (dy / dist) * 110 * dt, false);
    } else if (dist < 140) {
      moveCircle(world.city, enemy, -(dx / dist) * 60 * dt, -(dy / dist) * 60 * dt, false);
    }
    enemy.shootCooldown -= dt;
    if (dist < 420 && enemy.shootCooldown <= 0) {
      enemy.shootCooldown = enemy.boss ? 0.55 : 1.1;
      const spread = (world.random.next() - 0.5) * 0.22;
      const a = enemy.angle + spread;
      world.bullets.push({
        x: enemy.x + Math.cos(a) * 20,
        y: enemy.y + Math.sin(a) * 20,
        vx: Math.cos(a) * 540,
        vy: Math.sin(a) * 540,
        damage: enemy.boss ? 14 : 9,
        from: 'enemy',
        life: 0.9,
      });
      world.audio.gunshot();
    }
  }
  // The dead stay in the list (lying down) until the mission ends: the mission
  // counts the living, and the boss check needs the body to find.
}
