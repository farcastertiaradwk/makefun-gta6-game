// The heads-up display, drawn on the canvas after the world: wanted
// stars, health and armor bars, cash, the mission line, the timer, the
// ammo and speed readouts, the package count, and a live minimap.
import { CFG } from './config.js';
import { carSpeedKmh } from './vehicles.js';

function drawStars(ctx, n, x, y) {
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < n ? '#ffd94d' : 'rgba(0,0,0,0.45)';
    ctx.fillText('★', x + i * 30, y);
  }
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

export function drawHud(ctx, world) {
  const W = CFG.view.w;
  const H = CFG.view.h;
  const p = world.player;
  ctx.save();
  // top-left: stars + vitals
  drawStars(ctx, world.wanted, 16, 12);
  bar(ctx, 16, 46, 210, 14, p.hp / CFG.player.hp, '#e74c3c', 'rgba(0,0,0,0.5)');
  bar(ctx, 16, 64, 210, 8, p.armor / CFG.player.armorMax, '#5dade2', 'rgba(0,0,0,0.5)');
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 232, 46);
  // top-right: cash + packages
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7dff8a';
  ctx.fillText(`$${world.cash}`, W - 16, 14);
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(`◆ ${world.collected || 0}/8 packages`, W - 16, 42);
  // top-center: mission line
  const m = world.mission;
  if (m) {
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const label = `MISSION ${m.index + 1}/8 — ${m.name}`;
    const tw = ctx.measureText(label).width;
    ctx.fillRect(W / 2 - tw / 2 - 12, 10, tw + 24, 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, W / 2, 15);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(m.objective || '', W / 2, 38);
    if (m.timer > 0) {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = m.timer < 20 ? '#ff6b6b' : '#fff';
      ctx.fillText(`${Math.ceil(m.timer)} s`, W / 2, 58);
    }
  }
  // bottom-right: speed + ammo
  if (p.inCar) {
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${carSpeedKmh(p.inCar)}`, W - 16, H - 56);
    ctx.font = '13px sans-serif';
    ctx.fillText('km/h', W - 16, H - 26);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(p.inCar.kind === 'bike' ? 'MOTORBIKE' : 'CAR', W - 16, H - 84);
  } else {
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(`◉ ${p.mag} / ${p.reserve}`, W - 16, H - 30);
    if (p.reloading > 0) {
      ctx.fillStyle = '#ffd94d';
      ctx.fillText('RELOADING…', W - 16, H - 54);
    }
  }
  // bottom-left: minimap
  const ms = 140;
  const mx = 16;
  const my = H - ms - 16;
  const sc = ms / CFG.world.w;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mx - 4, my - 4, ms + 8, ms + 8);
  ctx.fillStyle = CFG.palette.grass;
  ctx.fillRect(mx, my, ms, ms);
  ctx.fillStyle = CFG.palette.water;
  ctx.fillRect(mx + 2420 * sc, my, (2600 - 2420) * sc, ms);
  ctx.fillStyle = CFG.palette.sand;
  ctx.fillRect(mx, my + 2420 * sc, ms, (2600 - 2420) * sc);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  for (const r of world.city.roads) {
    ctx.beginPath();
    ctx.moveTo(mx + r * sc, my);
    ctx.lineTo(mx + r * sc, my + ms);
    ctx.moveTo(mx, my + r * sc);
    ctx.lineTo(mx + ms, my + r * sc);
    ctx.stroke();
  }
  for (const mk of world.markers || []) {
    if (mk.done) continue;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(mx + mk.x * sc, my + mk.y * sc, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of world.cops) {
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(mx + cop.x * sc - 2, my + cop.y * sc - 2, 4, 4);
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + p.x * sc, my + p.y * sc, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(mx - 4.5, my - 4.5, ms + 9, ms + 9);
  ctx.restore();
}
