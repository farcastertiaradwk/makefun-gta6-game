// The HUD: DOM readouts (stars, health, cash, objective, prompts) and a live
// minimap canvas. The minimap is a tiny top-down map of Solmar with the
// player, police, mission marker and shops on it.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, BEACH_Y, SEA_Y, HARBOUR, PLACES } from './config.js';

export function createHud() {
  const get = (id) => document.getElementById(id);
  return {
    stars: get('hud-stars'),
    healthFill: get('hud-health-fill'),
    armorFill: get('hud-armor-fill'),
    cash: get('hud-cash'),
    objective: get('hud-objective'),
    timer: get('hud-timer'),
    ammo: get('hud-ammo'),
    speed: get('hud-speed'),
    message: get('hud-message'),
    prompt: get('hud-prompt'),
    missionTag: get('hud-mission'),
    minimap: get('minimap'),
  };
}

function starRow(wanted) {
  let out = '';
  for (let i = 0; i < 5; i += 1) out += i < wanted ? '★' : '☆';
  return out;
}

function showMission(hud, m) {
  hud.missionTag.textContent = `MISSION ${m.index + 1}/6 — ${m.name || ''}`;
  hud.objective.textContent = m.objective || '';
  hud.timer.textContent = m.timer > 0 ? `⏱ ${Math.ceil(m.timer)}s` : '';
}

function showFreeRoam(hud) {
  hud.missionTag.textContent = 'FREE ROAM — SOLMAR';
  hud.objective.textContent = 'Press E near a car to steal it. Find Mara at the Safehouse to start the story.';
  hud.timer.textContent = '';
}

export function updateHud(hud, world) {
  const player = world.player;
  hud.stars.textContent = starRow(world.wanted);
  hud.stars.style.color = world.wanted > 0 ? '#ffd94d' : '#5a6b7a';
  hud.healthFill.style.width = `${Math.max(0, player.health)}%`;
  hud.armorFill.style.width = `${Math.max(0, player.armor)}%`;
  hud.cash.textContent = `$${world.cash}`;
  if (world.mission) showMission(hud, world.mission);
  else showFreeRoam(hud);
  if (player.inCar) {
    hud.ammo.textContent = '';
    hud.speed.textContent = `${Math.round(Math.abs(player.inCar.speed) * 0.24)} km/h`;
  } else {
    hud.ammo.textContent = `🔫 ${player.magazine} / ${player.reserve}${player.reloading > 0 ? ' …reloading' : ''}`;
    hud.speed.textContent = '';
  }
  if (world.message && world.time < world.message.until) {
    hud.message.textContent = world.message.text;
    hud.message.style.opacity = '1';
  } else {
    hud.message.style.opacity = '0';
  }
  hud.prompt.textContent = world.prompt || '';
  drawMinimap(hud.minimap, world);
}

function drawMinimapBase(ctx, w, h, sx, sy) {
  ctx.fillStyle = '#6f9c4e';
  ctx.fillRect(0, 0, w, h);
  // Beach and sea.
  ctx.fillStyle = '#e8cf9a';
  ctx.fillRect(0, BEACH_Y * sy, w, (WORLD.h - BEACH_Y) * sy);
  ctx.fillStyle = '#2e7f9e';
  ctx.fillRect(0, SEA_Y * sy, w, (WORLD.h - SEA_Y) * sy);
  ctx.fillRect(HARBOUR.x * sx, HARBOUR.y0 * sy, (WORLD.w - HARBOUR.x) * sx, (HARBOUR.y1 - HARBOUR.y0) * sy);
  // Roads.
  ctx.fillStyle = '#3c3f46';
  for (const rx of ROADS_X) ctx.fillRect((rx - ROAD_W / 2) * sx, 0, ROAD_W * sx, h);
  for (const ry of ROADS_Y) ctx.fillRect(0, (ry - ROAD_W / 2) * sy, w, ROAD_W * sy);
  // Buildings as small blocks.
  ctx.fillStyle = '#8a7a66';
  return { ctx, w, h, sx, sy };
}

export function drawMinimap(canvas, world) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const sx = w / WORLD.w;
  const sy = h / WORLD.h;
  drawMinimapBase(ctx, w, h, sx, sy);
  // Shops.
  ctx.fillStyle = '#e8d44d';
  for (const key of ['gunshop', 'garage', 'safehouse', 'bank']) {
    const p = PLACES[key];
    ctx.fillRect(p.x * sx - 2, p.y * sy - 2, 4, 4);
  }
  // Mission marker.
  if (world.mission && world.mission.marker) {
    const mk = world.mission.marker;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(mk.x * sx, mk.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#2d6bff';
  for (const cop of world.cops) ctx.fillRect(cop.x * sx - 2, cop.y * sy - 2, 4, 4);
  for (const car of world.cars) {
    if (car.kind === 'police' && !car.wrecked) ctx.fillRect(car.x * sx - 2, car.y * sy - 2, 4, 4);
  }
  // The player, on top, as a white dot.
  const p = world.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(p.x * sx, p.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}
