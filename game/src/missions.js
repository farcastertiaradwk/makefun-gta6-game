// The story: eight jobs for Mara Voss and the Harbour Crew, from a first
// stolen car to the top of Solmar. Each mission is a small state machine
// (stages, objectives, timers, rewards); the world carries the current
// one in world.mission and the HUD reads its objective line.
import { CFG } from './config.js';
import { makeVehicle } from './vehicles.js';
import { setWanted, addWanted } from './police.js';

const PACKAGE_SPOTS = [
  { x: 480, y: 2050 }, { x: 2120, y: 380 }, { x: 1450, y: 1560 },
];

const FARE_STOPS = [
  { x: 1000, y: 1000, label: 'Solmar Plaza' }, { x: 610, y: 610, label: 'Green Park' },
  { x: 1300, y: 2450, label: 'South Beach' }, { x: 2450, y: 500, label: 'The Harbour' },
  { x: 600, y: 1400, label: 'Iron & Lead' }, { x: 1800, y: 1800, label: 'Fix-It Garage' },
  { x: 2350, y: 1350, label: 'The Docks' }, { x: 2220, y: 700, label: 'Harbor Bank' },
];

export function startMission(world, i) {
  const def = CFG.missions[i];
  world.mission = { index: i, name: def.name, stage: 0, timer: def.timer || 0, objective: '', data: {} };
  world.enemies = [];
  world.markers = [];
  if (i === 1) {
    world.markers = PACKAGE_SPOTS.map((s, k) => ({ ...s, kind: 'package', id: k, done: false }));
    world.mission.objective = 'Collect the packages: 0/3';
  } else if (i === 2) {
    world.markers = [{ ...CFG.places.docks, kind: 'mara', label: 'MARA' }];
    world.mission.objective = 'Pick up Mara at The Docks';
  } else if (i === 4) {
    world.markers = [{ ...CFG.places.bank, kind: 'bank', label: 'Harbor Bank' }];
    world.mission.objective = 'Reach Harbor Bank';
  } else if (i === 5) {
    const taxi = makeVehicle('car', 1000, 940, 0, '#f1c40f');
    taxi.driver = 'parked';
    taxi.isTaxi = true;
    world.cars.push(taxi);
    world.markers = [{ x: taxi.x, y: taxi.y, kind: 'taxi', label: 'TAXI' }];
    world.mission.objective = 'Take the taxi at Solmar Plaza';
  } else if (i === 6) {
    world.markers = [{ ...CFG.places.docks, kind: 'crate', label: 'CRATE' }];
    world.mission.objective = 'Grab the crate at The Docks';
  } else if (i === 7) {
    const plaza = CFG.places.plaza;
    world.enemies = [
      { x: plaza.x, y: plaza.y - 60, hp: CFG.enemy.kaneHp, name: 'KANE', boss: true, shootAt: world.time + 1, angle: 0 },
      { x: plaza.x - 90, y: plaza.y + 40, hp: CFG.enemy.hp, name: 'VIPER', shootAt: world.time + 1.5, angle: 0 },
      { x: plaza.x + 90, y: plaza.y + 40, hp: CFG.enemy.hp, name: 'VIPER', shootAt: world.time + 2, angle: 0 },
      { x: plaza.x - 40, y: plaza.y + 110, hp: CFG.enemy.hp, name: 'VIPER', shootAt: world.time + 1.2, angle: 0 },
      { x: plaza.x + 40, y: plaza.y + 110, hp: CFG.enemy.hp, name: 'VIPER', shootAt: world.time + 1.8, angle: 0 },
    ];
    world.markers = [{ ...plaza, kind: 'boss', label: 'KANE' }];
    world.mission.objective = 'Take down KANE — 0/5';
  } else {
    world.mission.objective = i === 0 ? 'Steal a car' : i === 3 ? 'Lose the cops' : '';
  }
}

function near(world, x, y, r) {
  return Math.hypot(world.player.x - x, world.player.y - y) < r;
}

function nextFare(world) {
  const m = world.mission;
  const rng = world.rng;
  const from = rng.pick(FARE_STOPS);
  let to = rng.pick(FARE_STOPS);
  while (to === from) to = rng.pick(FARE_STOPS);
  m.data.fare = { from, to, phase: 'pickup', timer: 45, t0: world.time };
  m.objective = `Fare ${m.data.fareNo}/3: pick up at ${from.label}`;
  world.markers = [{ ...from, kind: 'fare', label: 'PICKUP' }];
}

export function updateMissions(world, dt) {
  const m = world.mission;
  if (!m || world.screen !== 'play') return;
  const p = world.player;
  switch (m.index) {
    case 0: {
      if (m.stage === 0) {
        if (p.inCar) { m.stage = 1; m.objective = 'Drive to The Docks'; }
      } else if (near(world, CFG.places.docks.x, CFG.places.docks.y, 130)) {
        completeMission(world);
      }
      break;
    }
    case 1: {
      m.timer -= dt;
      let got = 0;
      for (const mk of world.markers) {
        if (!mk.done && near(world, mk.x, mk.y, 46)) {
          mk.done = true;
          world.floats.push({ x: mk.x, y: mk.y - 20, text: 'PACKAGE', life: 1.2, color: '#7dff8a' });
          world.audio.pickup();
        }
        if (mk.done) got++;
      }
      m.objective = `Collect the packages: ${got}/3`;
      if (got >= 3) completeMission(world);
      else if (m.timer <= 0) {
        m.timer = CFG.missions[1].timer;
        for (const mk of world.markers) mk.done = false;
        world.floats.push({ x: p.x, y: p.y - 30, text: 'Too slow — try again', life: 1.6, color: '#ff6b6b' });
      }
      break;
    }
    case 2: {
      if (m.stage === 0) {
        if (p.inCar && near(world, CFG.places.docks.x, CFG.places.docks.y, 90)) {
          m.stage = 1;
          setWanted(world, 3);
          m.objective = 'Drive Mara to the Safehouse';
          world.markers = [{ ...CFG.places.safehouse, kind: 'dropoff', label: 'SAFEHOUSE' }];
        }
      } else if (near(world, CFG.places.safehouse.x, CFG.places.safehouse.y, 130)) {
        completeMission(world);
      }
      break;
    }
    case 3: {
      if (m.stage === 0) {
        m.objective = 'Lose the cops';
        if (world.wanted === 0) {
          m.stage = 1;
          m.objective = 'Reach the Fix-It Garage';
          world.markers = [{ ...CFG.places.garage, kind: 'garage', label: 'Fix-It Garage' }];
        }
      } else if (near(world, CFG.places.garage.x, CFG.places.garage.y, 120)) {
        completeMission(world);
      }
      break;
    }
    case 4: {
      if (m.stage === 0) {
        if (near(world, CFG.places.bank.x, CFG.places.bank.y, 130)) {
          m.stage = 1;
          m.data.crack = 0;
          m.objective = 'Crack the safe — hold E';
        }
      } else if (m.stage === 1) {
        const holding = world.keys.has(CFG.keys.interact) || (world.fakeInput && world.fakeInput.held && world.fakeInput.held());
        const close = near(world, CFG.places.bank.x, CFG.places.bank.y, 100);
        if (holding && close && !p.inCar) {
          m.data.crack += dt;
          if (m.data.crack >= CFG.missions[4].crackSecs) {
            m.stage = 2;
            world.cash += CFG.prices.bankTake;
            setWanted(world, 3);
            m.objective = 'Escape to the Fix-It Garage';
            world.markers = [{ ...CFG.places.garage, kind: 'garage', label: 'Fix-It Garage' }];
            world.floats.push({ x: p.x, y: p.y - 30, text: `+$${CFG.prices.bankTake}`, life: 1.6, color: '#ffd94d' });
            world.audio.sting();
          }
        } else {
          m.data.crack = Math.max(0, m.data.crack - dt * 2);
        }
        if (m.stage === 1) {
          m.objective = `Cracking the safe… ${Math.min(99, Math.floor((m.data.crack / CFG.missions[4].crackSecs) * 100))}%`;
        }
      } else if (near(world, CFG.places.garage.x, CFG.places.garage.y, 120)) {
        completeMission(world);
      }
      break;
    }
    case 5: {
      if (m.stage === 0) {
        if (p.inCar && p.inCar.isTaxi) {
          m.stage = 1;
          m.data.fareNo = 1;
          nextFare(world);
        }
      } else {
        const f = m.data.fare;
        f.timer -= dt;
        if (f.phase === 'pickup' && near(world, f.from.x, f.from.y, 60)) {
          f.phase = 'drop';
          m.objective = `Fare ${m.data.fareNo}/3: drop at ${f.to.label}`;
          world.markers = [{ ...f.to, kind: 'fare', label: 'DROPOFF' }];
        } else if (f.phase === 'drop' && near(world, f.to.x, f.to.y, 60)) {
          const fast = world.time - f.t0 < 25;
          const pay = CFG.prices.farePay + (fast ? CFG.prices.fareTip : 0);
          world.cash += pay;
          world.floats.push({ x: p.x, y: p.y - 30, text: `+$${pay}${fast ? ' (tip!)' : ''}`, life: 1.5, color: '#ffd94d' });
          world.audio.pickup();
          m.data.fareNo++;
          if (m.data.fareNo > CFG.missions[5].fares) completeMission(world);
          else nextFare(world);
        } else if (f.timer <= 0) {
          f.timer = 45;
          f.t0 = world.time;
          world.floats.push({ x: p.x, y: p.y - 30, text: 'Fare expired — new fare', life: 1.4, color: '#ff6b6b' });
          nextFare(world);
        }
      }
      break;
    }
    case 6: {
      if (m.stage === 0) {
        if (near(world, CFG.places.docks.x, CFG.places.docks.y, 60)) {
          m.stage = 1;
          m.timer = CFG.missions[6].timer;
          addWanted(world, 2);
          m.objective = 'Deliver to South Beach — 120 s';
          world.markers = [{ ...CFG.places.beach, kind: 'drop', label: 'BEACH DROP' }];
        }
      } else {
        m.timer -= dt;
        m.objective = `Deliver to South Beach — ${Math.max(0, Math.ceil(m.timer))} s`;
        if (near(world, CFG.places.beach.x, CFG.places.beach.y, 110)) completeMission(world);
        else if (m.timer <= 0) {
          startMission(world, 6);
          world.floats.push({ x: p.x, y: p.y - 30, text: 'Too slow — crate lost', life: 1.6, color: '#ff6b6b' });
        }
      }
      break;
    }
    case 7: {
      // KANE's crew: slow advance, aimed fire every 2.4 s with spread
      let down = 0;
      for (const e of world.enemies) {
        if (e.hp <= 0) { down++; continue; }
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d > 210) {
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          e.x += Math.cos(a) * 90 * dt;
          e.y += Math.sin(a) * 90 * dt;
        }
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
        if (d < CFG.enemy.range && world.time >= e.shootAt) {
          e.shootAt = world.time + CFG.enemy.shootEvery;
          const aa = e.angle + (world.rng.next() - 0.5) * 2 * CFG.enemy.spread;
          world.bullets.push({
            x: e.x + Math.cos(aa) * 20, y: e.y + Math.sin(aa) * 20,
            vx: Math.cos(aa) * 760, vy: Math.sin(aa) * 760,
            life: 1.1, from: 'enemy', damage: CFG.enemy.damage,
          });
          world.audio.enemyShot();
        }
      }
      m.objective = `Take down KANE — ${down}/5`;
      if (down >= 5) {
        world.cash += CFG.missions[7].reward;
        world.toScreen('victory');
      }
      break;
    }
    default:
      break;
  }
}

export function completeMission(world) {
  const m = world.mission;
  const reward = CFG.missions[m.index].reward;
  world.cash += reward;
  world.lastReward = reward;
  world.audio.sting();
  if (m.index >= CFG.missions.length - 1) {
    world.toScreen('victory');
    return;
  }
  world.pendingMission = m.index + 1;
  world.toScreen('complete');
}
