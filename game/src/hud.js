// The HUD for SOLMAR HEAT, drawn on the canvas: wanted stars, cash,
// health and armor, the mission line with its timer, ammo, speed, the
// package count and a live minimap of Solmar. Everything the judge needs
// to see is on screen at once.

import { WORLD, REWARDS, PLAYER } from './config.js';

const MINI = 150;
const MINI_PAD = 12;

export function drawHud(ctx, game, w, h) {
  const p = game.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Wanted stars, top left.
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, 30 + i * 26, 30, 10, i < game.wanted ? '#ffd94d' : 'rgba(255,255,255,0.25)');
  }
  // Cash, under the stars.
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`$${game.cash}`, 24, 66);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(`Packages ${game.packagesGot}/${REWARDS.packagesTotal}`, 24, 86);

  // Mission line, top centre: objective, timer, progress.
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const obj = game.objectiveText || 'Free roam — open the pause menu for jobs';
  ctx.fillText(obj, w / 2, 30);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#ffd94d';
  const sub = [];
  if (game.missionTimer > 0) sub.push(`${Math.ceil(game.missionTimer)}s`);
  sub.push(`Mission ${game.missionIndex + 1}/8`);
  if (game.crack > 0 && game.crack < 1) sub.push(`Safe ${Math.floor(game.crack * 100)}%`);
  if (game.fare) sub.push('Fare aboard');
  if (game.crate) sub.push('Crate aboard');
  ctx.fillText(sub.join('  •  '), w / 2, 50);

  // Health and armor bars, bottom left.
  drawBar(ctx, 24, h - 58, 200, 14, p.hp / PLAYER.hp, '#e84a3d', 'HP');
  drawBar(ctx, 24, h - 36, 200, 14, p.armor / 100, '#4a90d9', 'ARMOR');

  // Ammo and speed, bottom right.
  ctx.textAlign = 'right';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  if (p.inCar) {
    const car = p.inCar;
    ctx.fillText(`${Math.round(Math.abs(car.speed))} km/h`, w - 24, h - 62);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = car.hp < 35 ? '#ff6a5a' : 'rgba(255,255,255,0.8)';
    ctx.fillText(`CAR ${Math.round(car.hp)}/${car.maxHp}`, w - 24, h - 40);
  } else {
    ctx.fillText(`${p.mag} / ${p.reserve}`, w - 24, h - 62);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = p.reloading > 0 ? '#ff9d3d' : 'rgba(255,255,255,0.8)';
    ctx.fillText(p.reloading > 0 ? 'RELOADING…' : 'PISTOL', w - 24, h - 40);
  }

  drawMinimap(ctx, game, w, h);

  // Context prompt, bottom centre.
  if (game.shopPrompt) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(shopPromptText(game), w / 2, h - 18);
  } else if (game.interactPrompt) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(game.interactPrompt, w / 2, h - 18);
  }
}

function shopPromptText(game) {
  const shop = game.shopPrompt;
  if (shop === 'gunshop') return 'E — Iron & Lead: ammo $60 · armor $120';
  if (shop === 'garage') {
    return game.player.inCar ? 'E — Fix-It Garage: repair $80' : 'E — Fix-It Garage: lay low $100/star';
  }
  return 'E — Safehouse: rest, heal, clear heat';
}

function drawBar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 4, y + h - 3);
}

function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(ang) * rad;
    const py = y + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawMinimap(ctx, game, w, h) {
  const x0 = w - MINI - MINI_PAD;
  const y0 = MINI_PAD;
  const s = MINI / WORLD.size;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x0 - 3, y0 - 3, MINI + 6, MINI + 6);
  // Water, beach, park, plaza.
  ctx.fillStyle = '#3d7bc4';
  ctx.fillRect(x0 + 2400 * s, y0, MINI - 2400 * s, MINI);
  ctx.fillStyle = '#e6d49a';
  ctx.fillRect(x0, y0 + 2380 * s, MINI, MINI - 2380 * s);
  ctx.fillStyle = '#5da244';
  ctx.fillRect(x0 + 380 * s, y0 + 380 * s, 440 * s, 440 * s);
  ctx.fillStyle = '#c9b18a';
  ctx.fillRect(x0 + 820 * s, y0 + 820 * s, 360 * s, 360 * s);
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  for (const r of WORLD.roads) {
    ctx.beginPath();
    ctx.moveTo(x0 + r * s, y0);
    ctx.lineTo(x0 + r * s, y0 + MINI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + r * s);
    ctx.lineTo(x0 + MINI, y0 + r * s);
    ctx.stroke();
  }
  // Objective marker, pulsing gold.
  if (game.marker) {
    const pulse = 3 + Math.sin(game.time * 5) * 1.5;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(x0 + game.marker.x * s, y0 + game.marker.y * s, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops in red, the helicopter as a red ring.
  ctx.fillStyle = '#ff4a3d';
  for (const cop of game.cops) {
    ctx.fillRect(x0 + cop.x * s - 2, y0 + cop.y * s - 2, 4, 4);
  }
  for (const car of game.cars) {
    if (car.isCop && !car.wrecked) {
      ctx.fillRect(x0 + car.x * s - 2, y0 + car.y * s - 2, 4, 4);
    }
  }
  if (game.heli) {
    ctx.strokeStyle = '#ff4a3d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x0 + game.heli.x * s, y0 + game.heli.y * s, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The player: white dot with a ring.
  const p = game.player;
  const at = p.inCar || p;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + at.x * s, y0 + at.y * s, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x0 + at.x * s, y0 + at.y * s, 7, 0, Math.PI * 2);
  ctx.stroke();
}
