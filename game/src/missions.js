// The story: six missions for Mara Voss and the Harbour Crew, from stealing
// a first car to taking the city from Kane. Each mission sets its own
// objective, marker and timer; the main loop reads missionStatus and ends
// the mission.
import { SITES, PRICES } from './config.js';
import { slideCircle } from './city.js';

function defineJob(name, briefing, rewardIndex) {
  return { name, briefing, reward: PRICES.missionReward[rewardIndex] };
}

export const STORY = [
  defineJob('Wheels', 'Mara: every crew needs wheels. Steal a car — any car — and bring it to The Docks.', 0),
  defineJob('The Package', 'Three packages stashed around Solmar. Grab them all and bring them to the Fix-It Garage. Fast.', 1),
  defineJob('Getaway Driver', 'Mara needs a ride to the Safehouse and the law is already on her. Drive her there. Keep the car alive.', 2),
  defineJob('Payback', 'The Vipers jumped one of ours in the Plaza. Four of them. Make it even.', 3),
  defineJob('The Score', 'Harbor Bank. Crack the safe, take the money, and get to the Garage before the whole city shows up.', 4),
  defineJob('King of Solmar', 'Kane runs this city. End him in the Plaza, then get to Lighthouse Point while every cop in Solmar hunts you.', 5),
];

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function makeFoe(world, x, y, boss) {
  const enemy = {
    x,
    y,
    angle: 0,
    radius: 14,
    health: boss ? 320 : 55,
    boss: !!boss,
    shootCooldown: world.random.between(0.5, 1.5),
    name: boss ? 'KANE' : 'VIPER',
  };
  world.enemies.push(enemy);
  return enemy;
}

const VIPER_POSTS = [[800, 750], [900, 800], [820, 830], [880, 720]];

function spawnCrew(world) {
  for (const [x, y] of VIPER_POSTS) makeFoe(world, x, y, false);
}

function setObjective(world, text, marker) {
  world.mission.objective = text;
  if (marker) world.mission.marker = marker;
}

export function beginJob(world, index) {
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
    spawnCrew(world);
    setObjective(world, 'Take out the Vipers: 0/4', { x: SITES.plaza.x, y: SITES.plaza.y, label: 'PLAZA' });
  } else if (index === 4) {
    setObjective(world, 'Get to Harbor Bank', { x: SITES.bank.x, y: SITES.bank.y, label: 'BANK' });
  } else if (index === 5) {
    makeFoe(world, 850, 775, true);
    spawnCrew(world);
    setObjective(world, 'Take down KANE', { x: SITES.plaza.x, y: SITES.plaza.y, label: 'KANE' });
  } else {
    setObjective(world, 'Steal a car and drive to The Docks', { x: SITES.docks.x, y: SITES.docks.y, label: 'DOCKS' });
  }
  return m;
}

function finishJob(world, text) {
  world.mission.status = 'complete';
  world.mission.reason = text;
}

function failJob(world, text) {
  world.mission.status = 'failed';
  world.mission.reason = text;
}

function jobWheels(world) {
  const m = world.mission;
  const player = world.player;
  if (player.inCar && distance(player.x, player.y, SITES.docks.x, SITES.docks.y) < 80) {
    finishJob(world, 'Wheels delivered.');
  } else if (!player.inCar) {
    m.objective = 'Steal a car and drive to The Docks';
  } else {
    m.objective = 'Drive to The Docks';
  }
}

function jobPackages(world) {
  const m = world.mission;
  const player = world.player;
  const got = world.pickups.filter((p) => p.kind === 'package' && p.taken).length;
  m.objective = `Collect the packages: ${got}/3`;
  const remaining = world.pickups.find((p) => p.kind === 'package' && !p.taken);
  m.marker = remaining
    ? { x: remaining.x, y: remaining.y, label: 'PACKAGE' }
    : { x: SITES.garage.x, y: SITES.garage.y, label: 'GARAGE' };
  if (got === 3) {
    if (distance(player.x, player.y, SITES.garage.x, SITES.garage.y) < 80) {
      finishJob(world, 'Packages delivered.');
    } else {
      m.objective = 'All packages collected — deliver to the Garage';
    }
  }
}

function jobGetaway(world) {
  const m = world.mission;
  const player = world.player;
  if (m.stage === 0) {
    if (player.inCar) {
      m.stage = 1;
      world.setWanted(2);
      world.showMessage('Mara is in. The cops are on you — drive!');
      setObjective(world, 'Drive Mara to the Safehouse', { x: SITES.safehouse.x, y: SITES.safehouse.y, label: 'SAFEHOUSE' });
    }
  } else if (player.inCar) {
    if (player.inCar.health < 25) {
      failJob(world, 'The car fell apart.');
      return;
    }
    if (distance(player.x, player.y, SITES.safehouse.x, SITES.safehouse.y) < 80) {
      finishJob(world, 'Mara is safe.');
    }
  } else {
    failJob(world, 'You left the car — Mara walked away.');
  }
}

function jobShootout(world) {
  const m = world.mission;
  const player = world.player;
  const alive = world.enemies.filter((e) => e.health > 0);
  const total = m.index === 3 ? 4 : 5;
  const down = total - alive.length;
  if (m.index === 3) {
    m.objective = `Take out the Vipers: ${down}/4`;
    if (alive.length === 0) finishJob(world, 'Payback delivered.');
    return;
  }
  if (m.stage === 0) {
    const boss = world.enemies.find((e) => e.boss);
    m.objective = boss && boss.health > 0 ? 'Take down KANE' : 'Kane is down — get to Lighthouse Point';
    if (boss && boss.health <= 0) {
      m.stage = 1;
      world.setWanted(4);
      world.showMessage('Kane is down! Every cop in Solmar is coming — run!');
      m.marker = { x: SITES.lighthouse.x, y: SITES.lighthouse.y, label: 'LIGHTHOUSE' };
    }
  } else if (distance(player.x, player.y, SITES.lighthouse.x, SITES.lighthouse.y) < 90) {
    finishJob(world, 'You own Solmar now.');
  }
}

function jobHeist(world, dt) {
  const m = world.mission;
  const player = world.player;
  if (m.stage === 0) {
    if (distance(player.x, player.y, SITES.bank.x, SITES.bank.y) < 70) {
      m.stage = 1;
      m.progress = 0;
      m.objective = 'Hold E — crack the safe';
    }
  } else if (m.stage === 1) {
    if (distance(player.x, player.y, SITES.bank.x, SITES.bank.y) > 110) {
      m.stage = 0;
      m.progress = 0;
      m.objective = 'Get to Harbor Bank';
      m.marker = { x: SITES.bank.x, y: SITES.bank.y, label: 'BANK' };
    } else if (world.interactHeld) {
      m.progress += dt / 5;
      m.objective = `Cracking the safe… ${Math.floor(m.progress * 100)}%`;
      if (m.progress >= 1) {
        m.stage = 2;
        world.setWanted(3);
        world.cash += 800;
        world.showMessage('Safe cracked! $800 — now lose the cops and get to the Garage!');
        setObjective(world, 'Escape to the Fix-It Garage', { x: SITES.garage.x, y: SITES.garage.y, label: 'GARAGE' });
      }
    } else {
      m.objective = 'Hold E — crack the safe';
    }
  } else if (distance(player.x, player.y, SITES.garage.x, SITES.garage.y) < 80) {
    finishJob(world, 'Clean getaway.');
  }
}

// One handler per mission, looked up by index instead of chained ifs.
const JOB_HANDLERS = [jobWheels, jobPackages, jobGetaway, jobShootout, jobHeist, jobShootout];

export function stepJob(world, dt) {
  const m = world.mission;
  if (!m || m.status !== 'active') return;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failJob(world, 'Out of time.');
      return;
    }
  }
  JOB_HANDLERS[m.index](world, dt);
}

// Rivals shoot at the player when close, and strafe to keep their distance.
export function stepFoes(world, dt) {
  const player = world.player;
  for (const enemy of world.enemies) {
    if (enemy.health <= 0) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distTo = Math.hypot(dx, dy);
    enemy.angle = Math.atan2(dy, dx);
    if (distTo > 260) {
      slideCircle(world.city, enemy, (dx / distTo) * 110 * dt, (dy / distTo) * 110 * dt, false);
    } else if (distTo < 140) {
      slideCircle(world.city, enemy, -(dx / distTo) * 60 * dt, -(dy / distTo) * 60 * dt, false);
    }
    enemy.shootCooldown -= dt;
    if (distTo < 420 && enemy.shootCooldown <= 0) {
      enemy.shootCooldown = enemy.boss ? 0.55 : 1.1;
      const spread = (world.random.draw() - 0.5) * 0.22;
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
  // The dead stay in the list (lying down) until the mission ends: the
  // mission counts the living, and the boss check needs the body to find.
}
