// The HUD for SOLMAR HEAT, drawn on the canvas: wanted stars, health and
// armor bars, cash, the current mission and its timer, ammo and speed, and
// a live minimap of Solmar in the corner. Everything the player needs to
// read the city at a glance lives here, and the staged screenshots lean on
// it — a chase shot shows stars, speed, the minimap and the objective all
// at once.

import { PLAYER, PLACES, WORLD } from './config.js';
import { missionTitle } from './missions.js';

/** Draw a five-pointed star. */
function star(ctx, x, y, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A labelled bar (health green, armor blue). */
function bar(ctx, x, y, w, h, frac, fill, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#333';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 5, y + h / 2 + 0.5);
}

/** The minimap: the whole city shrunk into the corner, with the player,
// cars, cops, the helicopter and the mission marker as moving dots. */
function drawMinimap(ctx, world, x, y, size) {
  const scale = size / WORLD.size;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,10,0.72)';
  ctx.fillRect(x - 4, y - 4, size + 8, size + 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 4, y - 4, size + 8, size + 8);
  // Water and sand edges.
  ctx.fillStyle = '#2f6fb0';
  ctx.fillRect(x + PLACES.harbourX * scale, y, size - PLACES.harbourX * scale, size);
  ctx.fillStyle = '#e3cd8f';
  ctx.fillRect(x, y + PLACES.beachY * scale, size, size - PLACES.beachY * scale);
  // Roads.
  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = Math.max(1, 64 * scale);
  for (const r of world.city.roads) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * scale);
    ctx.lineTo(x + size, y + r * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + r * scale, y);
    ctx.lineTo(x + r * scale, y + size);
    ctx.stroke();
  }
  // Places.
  ctx.fillStyle = '#ffd94d';
  for (const key of ['bank', 'gunshop', 'garage', 'safehouse']) {
    const s = PLACES[key];
    ctx.fillRect(x + s.x * scale - 2, y + s.y * scale - 2, 4, 4);
  }
  // Mission marker, pulsing.
  if (world.marker) {
    const pulse = 3 + Math.sin(world.time * 5) * 1.5;
    ctx.fillStyle = '#ff5a4d';
    ctx.beginPath();
    ctx.arc(x + world.marker.x * scale, y + world.marker.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cars, cops, heli.
  for (const car of world.cars) {
    ctx.fillStyle = car.kind === 'police' ? '#5a8de8' : '#e8e8e8';
    ctx.fillRect(x + car.x * scale - 1.5, y + car.y * scale - 1.5, 3, 3);
  }
  for (const cop of world.cops) {
    ctx.fillStyle = '#5a8de8';
    ctx.fillRect(x + cop.x * scale - 1.5, y + cop.y * scale - 1.5, 3, 3);
  }
  if (world.heli) {
    ctx.fillStyle = '#ff5a4d';
    ctx.beginPath();
    ctx.arc(x + world.heli.x * scale, y + world.heli.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player, white with a dark ring so it reads on any ground.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + world.player.x * scale, y + world.player.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** The full HUD. Call after the world is drawn, before the screens. */
export function drawHud(ctx, world) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const p = world.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Wanted stars, top right.
  for (let i = 0; i < 5; i += 1) {
    const sx = W - 34 - i * 30;
    star(ctx, sx, 34, 13, i < world.wanted ? '#ffd94d' : 'rgba(255,255,255,0.25)');
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Cash, top right under the stars.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`$${world.cash}`, W - 22, 72);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('SOLMAR HEAT', W - 22, 90);

  // Mission block, top left.
  if (world.mission) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(14, 14, 330, 56);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(missionTitle(world), 24, 36);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(world.mission.objective, 24, 56);
    if (world.mission.index === 1 && world.mission.timer > 0) {
      ctx.fillStyle = world.mission.timer < 30 ? '#ff7a6e' : '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${Math.ceil(world.mission.timer)}s`, 300, 36);
    }
    if (world.mission.index === 4 && world.mission.stage === 1) {
      const pct = Math.floor(world.mission.data.crack);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`Cracking the safe… ${pct}%`, 24, 56);
      ctx.fillStyle = '#333';
      ctx.fillRect(24, 62, 120, 6);
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(24, 62, 120 * (pct / 100), 6);
    }
  }

  // Health + armor, bottom left.
  bar(ctx, 18, H - 56, 210, 16, p.health / PLAYER.maxHealth, '#57c465', `HP ${Math.ceil(p.health)}`);
  bar(ctx, 18, H - 34, 210, 16, p.armor / PLAYER.maxArmor, '#5a8de8', `ARMOR ${Math.ceil(p.armor)}`);

  // Ammo and speed, bottom right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`${p.weapon.mag} / ${p.weapon.reserve}`, W - 22, H - 34);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('AMMO — R reload', W - 22, H - 16);
  if (p.inCar) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(p.inCar.speed))} km/h`, W - 22, H - 62);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = p.inCar.health < 35 ? '#ff7a6e' : 'rgba(255,255,255,0.75)';
    ctx.fillText(`CAR ${Math.ceil(p.inCar.health)}%`, W - 22, H - 84);
  }

  // Minimap, bottom right above the speed readout.
  drawMinimap(ctx, world, W - 208, H - 292, 186);

  // Interaction prompt, centre bottom.
  if (world.prompt) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    const tw = ctx.measureText(world.prompt).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W / 2 - tw / 2 - 14, H - 118, tw + 28, 30);
    ctx.fillStyle = '#fff';
    ctx.fillText(world.prompt, W / 2, H - 97);
  }

  // Hurt flash.
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,40,30,${p.hurtFlash * 0.45})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
