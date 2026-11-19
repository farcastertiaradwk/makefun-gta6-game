// The renderer: a camera that follows the player, the whole city drawn
// top-down (grass, water, beach, park, plaza, roads, buildings, trees,
// lamps, traffic, people, police, helicopter), then the HUD, then the
// menu screens. Everything is canvas-drawn — no DOM screens — so the
// HUD can never go missing in shot mode.
import { CFG } from './config.js';
import { drawHud } from './hud.js';
import { carSpeedKmh } from './vehicles.js';

export function makeCamera() {
  return { x: 0, y: 0 };
}

export function updateCamera(world) {
  const cam = world.camera;
  const p = world.player;
  const tx = p.x - CFG.view.w / 2;
  const ty = p.y - CFG.view.h / 2;
  cam.x = Math.max(0, Math.min(CFG.world.w - CFG.view.w, tx));
  cam.y = Math.max(0, Math.min(CFG.world.h - CFG.view.h, ty));
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = car.kind === 'bike' ? 30 : 46;
  const wid = car.kind === 'bike' ? 12 : 22;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  ctx.fillStyle = car.color;
  if (car.kind === 'bike') {
    ctx.beginPath();
    ctx.ellipse(0, 0, len / 2, wid / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-8, 0, 4, 0, Math.PI * 2);
    ctx.arc(10, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(2, -wid / 2 + 3, 12, wid - 6);
    ctx.fillStyle = '#222';
    ctx.fillRect(-len / 2 + 4, -wid / 2 - 2, 8, 4);
    ctx.fillRect(-len / 2 + 4, wid / 2 - 2, 8, 4);
    ctx.fillRect(len / 2 - 10, -wid / 2 - 2, 8, 4);
    ctx.fillRect(len / 2 - 10, wid / 2 - 2, 8, 4);
    if (car.driver === 'cop') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-4, -wid / 2 + 2, 8, 4);
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car.isTaxi) {
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
  }
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(40,40,40,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 0, len / 2, wid / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPersonShape(ctx, x, y, angle, tone, shirt, ring) {
  ctx.save();
  ctx.translate(x, y);
  if (ring) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.arc(4, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawWorld(ctx, world) {
  const cam = world.camera;
  const pal = CFG.palette;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  // ground
  ctx.fillStyle = pal.grass;
  ctx.fillRect(0, 0, CFG.world.w, CFG.world.h);
  // beach (south) and harbour water (east)
  ctx.fillStyle = pal.sand;
  ctx.fillRect(0, 2420, CFG.world.w, 180);
  ctx.fillStyle = pal.water;
  ctx.fillRect(2420, 0, 180, CFG.world.h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 5; i++) ctx.fillRect(2430 + i * 26, 300 + i * 420, 90, 4);
  // park + pond, plaza + fountain
  ctx.fillStyle = pal.park;
  ctx.beginPath();
  ctx.arc(CFG.places.park.x, CFG.places.park.y, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.water;
  ctx.beginPath();
  ctx.ellipse(CFG.places.park.x, CFG.places.park.y, 46, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.plaza;
  ctx.beginPath();
  ctx.arc(CFG.places.plaza.x, CFG.places.plaza.y, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.water;
  ctx.beginPath();
  ctx.arc(CFG.places.plaza.x, CFG.places.plaza.y, 22, 0, Math.PI * 2);
  ctx.fill();
  // roads
  ctx.fillStyle = pal.road;
  for (const r of world.city.roads) {
    ctx.fillRect(r - 28, 0, 56, CFG.world.h);
    ctx.fillRect(0, r - 28, CFG.world.w, 56);
  }
  ctx.fillStyle = pal.roadLine;
  for (const r of world.city.roads) {
    for (let d = 40; d < CFG.world.w; d += 90) {
      ctx.fillRect(d, r - 2, 34, 4);
      ctx.fillRect(r - 2, d, 4, 34);
    }
  }
  // crosswalks
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const c of world.city.crossings) {
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(c.x + i * 12 - 4, c.y - 34, 8, 14);
      ctx.fillRect(c.x + i * 12 - 4, c.y + 20, 8, 14);
    }
  }
  // blocks + buildings
  for (const b of world.city.blocks) {
    ctx.fillStyle = pal.block;
    ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  }
  const roofTones = ['#b98a5e', '#a87f52', '#c9a06a', '#96714a'];
  for (const b of world.city.buildings) {
    ctx.fillStyle = roofTones[b.tone % roofTones.length];
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 8);
  }
  // trees + lamps
  for (const t of world.city.trees) {
    ctx.fillStyle = pal.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const l of world.city.lamps) {
    ctx.fillStyle = '#444';
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    ctx.fillStyle = pal.lamp;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // place labels (above the roofs so they never cover the player)
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(world.city.places)) {
    const pl = world.city.places[key];
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const tw = ctx.measureText(pl.label).width;
    ctx.fillRect(pl.x - tw / 2 - 6, pl.y - 44, tw + 12, 18);
    ctx.fillStyle = '#fff';
    ctx.fillText(pl.label, pl.x, pl.y - 31);
  }
  // hidden packages: gold sparkle when close
  for (const pack of world.packages) {
    if (pack.taken) continue;
    ctx.fillStyle = '#ffd94d';
    ctx.save();
    ctx.translate(pack.x, pack.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
    if (pack.glint) {
      ctx.strokeStyle = 'rgba(255,217,77,0.9)';
      ctx.lineWidth = 2;
      const r = 14 + Math.sin(world.time * 6) * 4;
      ctx.beginPath();
      ctx.arc(pack.x, pack.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // mission markers: pulsing diamonds
  for (const mk of world.markers || []) {
    if (mk.done) continue;
    const pulse = 1 + Math.sin(world.time * 5) * 0.15;
    ctx.save();
    ctx.translate(mk.x, mk.y - 26);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(-9 * pulse, -9 * pulse, 18 * pulse, 18 * pulse);
    ctx.restore();
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(mk.label || '', mk.x, mk.y - 40);
  }
  // pickups
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    ctx.fillStyle = pk.kind === 'health' ? '#e74c3c' : '#f39c12';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(pk.kind === 'health' ? '+' : 'A', pk.x, pk.y + 4);
  }
  // pedestrians
  for (const ped of world.peds) {
    if (ped.down) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(1.2);
      drawPersonShape(ctx, 0, 0, 0, ped.tone, ped.shirt, false);
      ctx.restore();
    } else {
      drawPersonShape(ctx, ped.x, ped.y, ped.angle, ped.tone, ped.shirt, false);
    }
  }
  // cars + bikes, sorted by y so nearer ones draw over farther ones
  const rides = world.cars.slice().sort((a, b) => a.y - b.y);
  for (const car of rides) {
    if (car.driver === 'cop' || car.isTaxi) {
      // police light bar blink
      if (car.driver === 'cop' && Math.floor(world.time * 4) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,0,0,0.25)';
        ctx.beginPath();
        ctx.arc(car.x, car.y, 60, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawCarShape(ctx, car);
    if (car.wrecked) {
      ctx.fillStyle = 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      ctx.arc(car.x, car.y - 10, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // cops on foot
  for (const cop of world.cops) {
    drawPersonShape(ctx, cop.x, cop.y, Math.atan2(world.player.y - cop.y, world.player.x - cop.x), '#e8b88a', '#2c3e50', false);
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('PD', cop.x, cop.y - 14);
  }
  // enemies (KANE's crew)
  for (const e of world.enemies) {
    if (e.hp <= 0) continue;
    drawPersonShape(ctx, e.x, e.y, e.angle, '#e8b88a', e.boss ? '#8e0000' : '#5b2c6f', false);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(e.name, e.x, e.y - 18);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 18, e.y - 14, 36, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(e.x - 18, e.y - 14, 36 * Math.max(0, e.hp / (e.boss ? CFG.enemy.kaneHp : CFG.enemy.hp)), 4);
  }
  // helicopter + spotlight
  if (world.heli) {
    const h = world.heli;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(h.x + 24, h.y + 30, 30, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,220,0.16)';
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(world.player.x - 70, world.player.y - 70);
    ctx.lineTo(world.player.x + 70, world.player.y + 70);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);
    ctx.fillStyle = '#3a3f47';
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(8, 0, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-38, 0);
    ctx.lineTo(38, 0);
    ctx.stroke();
    ctx.restore();
  }
  // bullets
  ctx.fillStyle = '#ffe9a8';
  for (const b of world.bullets) {
    ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  }
  // particles + explosions
  for (const pt of world.effects.parts) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const boom of world.effects.booms) {
    const f = 1 - boom.life / boom.max;
    ctx.fillStyle = `rgba(255,${Math.floor(160 - f * 100)},40,${0.7 * (1 - f)})`;
    ctx.beginPath();
    ctx.arc(boom.x, boom.y, (30 + f * 70) * boom.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  // floating text
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const fl of world.floats) {
    ctx.globalAlpha = Math.max(0, fl.life / 1.4);
    ctx.fillStyle = fl.color || '#fff';
    ctx.fillText(fl.text, fl.x, fl.y);
  }
  ctx.globalAlpha = 1;
  // the player, ringed white so it never hides in the grass
  const p = world.player;
  if (!p.inCar) {
    drawPersonShape(ctx, p.x, p.y, p.angle, '#e8b88a', '#2980b9', true);
  }
  // safe-crack progress ring
  const m = world.mission;
  if (m && m.index === 4 && m.stage === 1) {
    const frac = Math.min(1, (m.data.crack || 0) / CFG.missions[4].crackSecs);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 34, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 34, 18, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  drawHud(ctx, world);
}

function panel(ctx, title, lines, foot) {
  const W = CFG.view.w;
  const H = CFG.view.h;
  ctx.fillStyle = 'rgba(5,8,16,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, H / 2 - 90);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, H / 2 - 40 + i * 26));
  if (foot) {
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(foot, W / 2, H / 2 + 30 + lines.length * 26);
  }
}

export function drawScreens(ctx, world) {
  const s = world.screen;
  if (s === 'play') return;
  if (s === 'title') {
    panel(ctx, 'SOLMAR HEAT', [
      'Danny Reyes, wheelman out of work, runs jobs for Mara Voss',
      'and the Harbour Crew across the city of Solmar.',
      '',
      'WASD move / drive · mouse aim, click shoot · E steal / interact',
      'R reload · Shift sprint · Space handbrake · Esc pause · M mute',
      '',
      'Steal cars, lose the cops, crack Harbor Bank, end KANE.',
    ], world.hasSave ? 'ENTER — continue your save · C — new game' : 'Press ENTER to start');
    return;
  }
  if (s === 'pause') {
    panel(ctx, 'PAUSED', ['Take a breath. Solmar waits.'], 'Esc — resume · S — save & quit to title');
    return;
  }
  if (s === 'wasted') {
    panel(ctx, 'WASTED', ['Danny went down in the streets of Solmar.'], 'ENTER — retry the mission');
    return;
  }
  if (s === 'busted') {
    panel(ctx, 'BUSTED', ['The Solmar PD caught up with Danny.'], 'ENTER — retry the mission');
    return;
  }
  if (s === 'brief') {
    const m = world.mission;
    panel(ctx, `MISSION ${m.index + 1} — ${m.name}`, [m.objective || '', '', `Reward: $${CFG.missions[m.index].reward || 'fares'}`], 'ENTER — go');
    return;
  }
  if (s === 'complete') {
    const m = world.mission;
    panel(ctx, 'JOB DONE', [`${m.name} complete.`, `+$${world.lastReward || 0} in the pocket.`, ''], 'ENTER — next job');
    return;
  }
  if (s === 'victory') {
    panel(ctx, 'KING OF SOLMAR', [
      'KANE is down. The Vipers are done. Solmar is yours, Danny.',
      '',
      `Cash: $${world.cash} · Packages: ${world.collected || 0}/8`,
    ], 'ENTER — free roam');
    return;
  }
}
