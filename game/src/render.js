// Rendering for SOLMAR HEAT: a top-down camera over Solmar, then the HUD,
// then the menu screens. The camera follows Danny (or his car) and the
// world is drawn in layers: ground, water and beach, roads, buildings and
// trees, vehicles and people, effects, then the HUD.

import { WORLD, PALETTE } from './config.js';
import { inWater, inBeach, inPond, inPlaza, inPark } from './city.js';
import { drawHud } from './hud.js';
import { drawEffects } from './effects.js';
import { nearestHiddenPackage } from './collectibles.js';

export function drawFrame(ctx, game, w, h) {
  const cam = game.camera;
  const at = game.player.inCar || game.player;
  if (game.screen === 'title') {
    // A slow drift over the city behind the title.
    cam.x = 600 + Math.sin(game.time * 0.05) * 500;
    cam.y = 600 + Math.cos(game.time * 0.04) * 400;
  } else {
    cam.x = at.x - w / 2;
    cam.y = at.y - h / 2;
  }
  cam.x = Math.max(0, Math.min(WORLD.size - w, cam.x));
  cam.y = Math.max(0, Math.min(WORLD.size - h, cam.y));
  drawGround(ctx, game, cam, w, h);
  drawPlaces(ctx, game, cam);
  drawBuildings(ctx, game, cam);
  drawTrees(ctx, game, cam);
  drawPackages(ctx, game, cam);
  drawRoadblocks(ctx, game, cam);
  drawCars(ctx, game, cam);
  drawPeds(ctx, game, cam);
  drawEnemies(ctx, game, cam);
  drawPlayer(ctx, game, cam);
  drawHeli(ctx, game, cam);
  drawBullets(ctx, game, cam);
  drawMarker(ctx, game, cam);
  drawEffects(ctx, game.fx, cam);
  if (game.screen === 'play' || game.screen === 'pause') {
    drawHud(ctx, game, w, h);
  }
  if (game.screen !== 'play') {
    drawScreen(ctx, game, w, h);
  }
}

function drawGround(ctx, game, cam, w, h) {
  const x0 = cam.x;
  const y0 = cam.y;
  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, w, h);
  // Mow stripes for a little texture.
  ctx.fillStyle = PALETTE.grassDark;
  const stripe = 200;
  const startX = Math.floor(x0 / stripe) * stripe;
  for (let x = startX; x < x0 + w; x += stripe * 2) {
    ctx.fillRect(x - x0, 0, stripe, h);
  }
  // Beach, south edge.
  ctx.fillStyle = PALETTE.beach;
  ctx.fillRect(0, 2380 - y0, w, h);
  // Harbour water, east edge, with piers.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(2400 - x0, 0, w, h);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let x = 2440; x < 2600; x += 80) {
    ctx.fillRect(x - x0, 0, 30, h);
  }
  for (const pier of game.city.piers) {
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(pier.x - x0, pier.y - y0, pier.w, pier.h);
  }
  // Marlowe Park: green with a pond.
  const park = WORLD.districts.park;
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(park.x - x0, park.y - y0, park.w, park.h);
  ctx.fillStyle = PALETTE.pond;
  ctx.beginPath();
  ctx.arc(610 - x0, 610 - y0, 90, 0, Math.PI * 2);
  ctx.fill();
  // Voss Plaza: tan stone with a fountain.
  const plaza = WORLD.districts.plaza;
  ctx.fillStyle = PALETTE.plaza;
  ctx.fillRect(plaza.x - x0, plaza.y - y0, plaza.w, plaza.h);
  ctx.fillStyle = '#4d8fc9';
  ctx.beginPath();
  ctx.arc(1000 - x0, 1000 - y0, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9b18a';
  ctx.beginPath();
  ctx.arc(1000 - x0, 1000 - y0, 22, 0, Math.PI * 2);
  ctx.fill();
  // Roads: asphalt, edge lines, centre dashes, crosswalks.
  for (const r of WORLD.roads) {
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(r - 32 - x0, 0, 64, h);
    ctx.fillRect(0, r - 32 - y0, w, 64);
  }
  ctx.fillStyle = PALETTE.dash;
  for (const r of WORLD.roads) {
    for (let d = 40; d < WORLD.size; d += 120) {
      if (Math.abs(d - r) < 60) continue;
      ctx.fillRect(r - 2 - x0, d - y0, 4, 34);
      ctx.fillRect(d - x0, r - 2 - y0, 34, 4);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of WORLD.roads) {
    for (const ry of WORLD.roads) {
      for (let k = -3; k <= 3; k++) {
        ctx.fillRect(rx - 32 + k * 9 - x0, ry - 44 - y0, 5, 12);
        ctx.fillRect(rx - 32 + k * 9 - x0, ry + 32 - y0, 5, 12);
      }
    }
  }
  // Benches.
  ctx.fillStyle = '#7a5a34';
  for (const b of game.city.benches) {
    ctx.save();
    ctx.translate(b.x - x0, b.y - y0);
    ctx.rotate(b.angle);
    ctx.fillRect(-14, -4, 28, 8);
    ctx.restore();
  }
  // Lamps.
  for (const lamp of game.city.lamps) {
    ctx.fillStyle = '#2e2e33';
    ctx.fillRect(lamp.x - x0 - 2, lamp.y - y0 - 2, 4, 4);
    ctx.fillStyle = 'rgba(255,240,170,0.5)';
    ctx.beginPath();
    ctx.arc(lamp.x - x0, lamp.y - y0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlaces(ctx, game, cam) {
  const x0 = cam.x;
  const y0 = cam.y;
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px system-ui, sans-serif';
  for (const [key, place] of Object.entries(game.cityPlaces)) {
    if (key === 'bankSafe' || key === 'maraSpot' || key === 'plaza' || key === 'docks' || key === 'beachDrop') continue;
    // A labelled building face for each shop; the name sits above the
    // roof so it never covers a player standing at the door.
    ctx.fillStyle = key === 'bank' ? '#3d5a80' : key === 'gunshop' ? '#6a4a2a' : key === 'garage' ? '#4a4a4a' : '#7a5a8a';
    ctx.fillRect(place.x - 46 - x0, place.y - 34 - y0, 92, 52);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(place.name.toUpperCase(), place.x - x0, place.y - 44 - y0);
  }
  // The Docks sign and the beach drop flag.
  ctx.fillStyle = '#ffffff';
  ctx.fillText('THE DOCKS', WORLD.places.docks.x - x0, WORLD.places.docks.y - 60 - y0);
  ctx.fillStyle = '#ff9d3d';
  ctx.fillRect(WORLD.places.beachDrop.x - 2 - x0, WORLD.places.beachDrop.y - 46 - y0, 4, 46);
  ctx.beginPath();
  ctx.moveTo(WORLD.places.beachDrop.x - x0, WORLD.places.beachDrop.y - 46 - y0);
  ctx.lineTo(WORLD.places.beachDrop.x + 26 - x0, WORLD.places.beachDrop.y - 38 - y0);
  ctx.lineTo(WORLD.places.beachDrop.x - x0, WORLD.places.beachDrop.y - 30 - y0);
  ctx.closePath();
  ctx.fill();
}

function drawBuildings(ctx, game, cam) {
  const x0 = cam.x;
  const y0 = cam.y;
  for (const b of game.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5 - x0, b.y + 6 - y0, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - x0, b.y - y0, b.w, b.h);
    if (b.roof) {
      ctx.fillStyle = PALETTE.roof;
      ctx.fillRect(b.x + 8 - x0, b.y + 8 - y0, b.w - 16, b.h - 16);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let wx = b.x + 14; wx < b.x + b.w - 14; wx += 26) {
        for (let wy = b.y + 12; wy < b.y + b.h - 12; wy += 24) {
          ctx.fillRect(wx - x0, wy - y0, 10, 8);
        }
      }
    }
  }
}

function drawTrees(ctx, game, cam) {
  const x0 = cam.x;
  const y0 = cam.y;
  for (const t of game.city.trees) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(t.x + 3 - x0, t.y + 4 - y0, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.shade;
    ctx.beginPath();
    ctx.arc(t.x - x0, t.y - y0, t.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPackages(ctx, game, cam) {
  const x0 = cam.x;
  const y0 = cam.y;
  const at = game.player.inCar || game.player;
  for (const pack of game.hiddenPackages) {
    if (pack.got) continue;
    const d = Math.hypot(at.x - pack.x, at.y - pack.y);
    if (d > 220) continue;
    // A faint golden sparkle: the only hint a stash is near.
    const tw = 0.5 + 0.5 * Math.sin(game.time * 6 + pack.x);
    ctx.fillStyle = `rgba(255,217,77,${0.35 + 0.5 * tw})`;
    ctx.save();
    ctx.translate(pack.x - x0, pack.y - y0);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
  }
  // Mission packages: gold crates with a beacon.
  if (game.missionData) {
    for (const s of game.missionData.spots) {
      if (s.got) continue;
      ctx.fillStyle = '#c98f1b';
      ctx.fillRect(s.x - 10 - x0, s.y - 10 - y0, 20, 20);
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(s.x - 10 - x0, s.y - 3 - y0, 20, 6);
    }
  }
  // The smuggler crate at the Docks.
  if (game.missionIndex === 6 && game.missionStage === 0) {
    const d = WORLD.places.docks;
    ctx.fillStyle = '#8a5a1b';
    ctx.fillRect(d.x - 12 - x0, d.y - 12 - y0, 24, 24);
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(d.x - 12 - x0, d.y - 4 - y0, 24, 8);
  }
}

function drawRoadblocks(ctx, game, cam) {
  const x0 = cam.x;
  const y0 = cam.y;
  for (const rb of game.roadblocks) {
    ctx.save();
    ctx.translate(rb.x - x0, rb.y - y0);
    ctx.rotate(rb.angle);
    ctx.fillStyle = '#ff5a2a';
    ctx.fillRect(-22, -8, 44, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-22, -8, 44, 5);
    ctx.restore();
  }
}

function drawCars(ctx, game, cam) {
  const x0 = cam.x;
  const y0 = cam.y;
  for (const car of game.cars) {
    if (car.wrecked) {
      // A wreck: charred shell, still smoking.
      ctx.fillStyle = '#1e1e1e';
      ctx.save();
      ctx.translate(car.x - x0, car.y - y0);
      ctx.rotate(car.angle);
      ctx.fillRect(-20, -10, 40, 20);
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.translate(car.x - x0, car.y - y0);
    ctx.rotate(car.angle);
    if (car.isBike) {
      ctx.fillStyle = car.color;
      ctx.fillRect(-14, -4, 28, 8);
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(-10, 0, 5, 0, Math.PI * 2);
      ctx.arc(10, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-2, -3, 6, 6);
    } else {
      // Shadow, body, cabin, windshield, lights.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-19, -9, 40, 20);
      ctx.fillStyle = car.color;
      ctx.fillRect(-20, -11, 40, 22);
      ctx.fillStyle = car.isCop ? '#ffffff' : 'rgba(20,20,30,0.85)';
      ctx.fillRect(-6, -9, 14, 18);
      ctx.fillStyle = car.isCop ? '#2f5fd9' : 'rgba(180,220,255,0.7)';
      ctx.fillRect(8, -8, 5, 16);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(18, -9, 2, 4);
      ctx.fillRect(18, 5, 2, 4);
      ctx.fillStyle = '#ff3d3d';
      ctx.fillRect(-20, -9, 2, 4);
      ctx.fillRect(-20, 5, 2, 4);
      if (car.isCop) {
        ctx.fillStyle = '#ff3d3d';
        ctx.fillRect(-2, -13, 5, 3);
        ctx.fillStyle = '#3d7bd9';
        ctx.fillRect(-2, 10, 5, 3);
      }
      if (car.isTaxi) {
        ctx.fillStyle = '#222';
        ctx.font = 'bold 8px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAXI', 0, 3);
      }
    }
    ctx.restore();
    // Damage smoke.
    if (car.hp < car.maxHp * 0.4) {
      ctx.fillStyle = 'rgba(40,40,40,0.4)';
      ctx.beginPath();
      ctx.arc(car.x - x0, car.y - y0 - 8, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPerson(ctx, x, y, angle, shirt, pants, ring) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (ring) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = pants || '#2e3a4a';
  ctx.fillRect(-5, -4, 10, 8);
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(5, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPeds(ctx, game, cam) {
  const x0 = cam.x;
  const y0 = cam.y;
  for (const ped of game.peds) {
    if (ped.down) {
      ctx.fillStyle = '#8a8a8a';
      ctx.beginPath();
      ctx.ellipse(ped.x - x0, ped.y - y0, 12, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    drawPerson(ctx, ped.x - x0, ped.y - y0, ped.angle, ped.shirt, '#2e3a4a', false);
  }
  // Mara waits at her spot until Danny picks her up.
  if (game.mara && !game.mara.aboard) {
    drawPerson(ctx, game.mara.x - x0, game.mara.y - y0, -Math.PI / 2, '#d94f8a', '#2e3a4a', true);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MARA', game.mara.x - x0, game.mara.y - 20 - y0);
  }
}

function drawEnemies(ctx, game, cam) {
  const x0 = cam.x;
  const y0 = cam.y;
  for (const e of game.enemies) {
    if (e.dead) continue;
    drawPerson(ctx, e.x - x0, e.y - y0, e.angle, e.boss ? '#1e1e1e' : '#5a2a6a', '#222', e.boss);
    // Health bar above each enemy; Kane's is longer and red.
    const bw = e.boss ? 46 : 30;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(e.x - bw / 2 - x0, e.y - 24 - y0, bw, 6);
    ctx.fillStyle = e.boss ? '#ff3d3d' : '#ff9d3d';
    ctx.fillRect(e.x - bw / 2 - x0, e.y - 24 - y0, bw * (e.hp / e.maxHp), 6);
    if (e.boss) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KANE', e.x - x0, e.y - 30 - y0);
    }
  }
}

function drawPlayer(ctx, game, cam) {
  const x0 = cam.x;
  const y0 = cam.y;
  const p = game.player;
  if (p.inCar) return;
  drawPerson(ctx, p.x - x0, p.y - y0, p.angle, '#3d7bd9', '#2e3a4a', true);
  // The pistol, when armed.
  ctx.save();
  ctx.translate(p.x - x0, p.y - y0);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#222';
  ctx.fillRect(8, -2, 12, 4);
  ctx.restore();
  if (p.reloading > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RELOADING', p.x - x0, p.y - 22 - y0);
  }
}

function drawHeli(ctx, game, cam) {
  const x0 = cam.x;
  const y0 = cam.y;
  const h = game.heli;
  if (!h) return;
  // Shadow on the ground, then the spotlight cone, then the body.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(h.x - x0 + 14, h.y - y0 + 18, 30, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,200,0.16)';
  ctx.beginPath();
  ctx.moveTo(h.x - x0, h.y - y0);
  ctx.lineTo(h.x - x0 - 60, h.y - y0 + 190);
  ctx.lineTo(h.x - x0 + 60, h.y - y0 + 190);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.translate(h.x - x0, h.y - y0);
  ctx.rotate(h.angle);
  ctx.fillStyle = '#2e4a6a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 28, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9fc4e8';
  ctx.beginPath();
  ctx.ellipse(10, 0, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-38 * Math.cos(h.rotor), -38 * Math.sin(h.rotor));
  ctx.lineTo(38 * Math.cos(h.rotor), 38 * Math.sin(h.rotor));
  ctx.stroke();
  ctx.restore();
}

function drawBullets(ctx, game, cam) {
  const x0 = cam.x;
  const y0 = cam.y;
  ctx.fillStyle = '#ffe9a8';
  for (const b of game.bullets) {
    ctx.fillRect(b.x - 2 - x0, b.y - 2 - y0, 4, 4);
  }
}

function drawMarker(ctx, game, cam) {
  if (!game.marker || game.screen !== 'play') return;
  const x0 = cam.x;
  const y0 = cam.y;
  const bob = Math.sin(game.time * 4) * 5;
  const mx = game.marker.x - x0;
  const my = game.marker.y - y0 + bob;
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(mx, my - 26);
  ctx.lineTo(mx + 10, my - 8);
  ctx.lineTo(mx - 10, my - 8);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,217,77,0.2)';
  ctx.beginPath();
  ctx.ellipse(mx, my + 6, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------- screens

function panel(ctx, w, h) {
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, w, h);
  const pw = 640;
  const ph = 430;
  const px = (w - pw) / 2;
  const py = (h - ph) / 2;
  ctx.fillStyle = 'rgba(16,20,30,0.94)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);
  return { px, py, pw, ph };
}

function title(ctx, text, x, y, size, color) {
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color || '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function body(ctx, text, x, y, size, color) {
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.fillStyle = color || 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function button(ctx, game, id, label, x, y, w, h) {
  const hover = game.input.mouse.x >= x && game.input.mouse.x <= x + w && game.input.mouse.y >= y && game.input.mouse.y <= y + h;
  ctx.fillStyle = hover ? '#ffd94d' : '#2e6a4a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = hover ? '#1e1e1e' : '#ffffff';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 6);
  game.buttons.push({ id, x, y, w, h });
}

function drawScreen(ctx, game, w, h) {
  game.buttons = [];
  const cx = w / 2;
  if (game.screen === 'title') {
    const p = panel(ctx, w, h);
    title(ctx, 'SOLMAR HEAT', cx, p.py + 70, 44, '#ffd94d');
    body(ctx, 'An open-world crime story in the city of Solmar', cx, p.py + 104, 16);
    body(ctx, 'Danny Reyes, wheelman out of work, does jobs for Mara Voss', cx, p.py + 132, 15);
    body(ctx, 'and the Harbour Crew — eight missions from a stolen car', cx, p.py + 154, 15);
    body(ctx, 'to the top of the city. Steal cars. Lose the cops. Get paid.', cx, p.py + 176, 15);
    body(ctx, 'WASD drive / walk · Mouse aim · Click shoot · E interact · R reload', cx, p.py + 216, 14, 'rgba(255,255,255,0.7)');
    body(ctx, 'Shift sprint · Space handbrake · Esc pause · M mute', cx, p.py + 238, 14, 'rgba(255,255,255,0.7)');
    button(ctx, game, 'start', 'START A NEW STORY', cx - 220, p.py + 280, 200, 48);
    if (game.hasSave) {
      button(ctx, game, 'continue', 'CONTINUE', cx + 20, p.py + 280, 200, 48);
    } else {
      button(ctx, game, 'start2', 'START A NEW STORY', cx + 20, p.py + 280, 200, 48);
    }
    body(ctx, '8 missions · hidden packages · bikes · taxis · the Harbour', cx, p.py + 356, 13, 'rgba(255,255,255,0.55)');
    body(ctx, 'An original game. Nothing from any commercial series.', cx, p.py + 378, 13, 'rgba(255,255,255,0.55)');
  } else if (game.screen === 'brief') {
    const p = panel(ctx, w, h);
    title(ctx, game.briefTitle || 'MISSION', cx, p.py + 80, 30, '#ffd94d');
    body(ctx, game.briefText || '', cx, p.py + 130, 16);
    body(ctx, `Cash $${game.cash} · ${game.packagesGot}/8 packages found`, cx, p.py + 180, 14, 'rgba(255,255,255,0.7)');
    button(ctx, game, 'go', "LET'S GO", cx - 110, p.py + 250, 220, 52);
    body(ctx, 'Press Enter or click to start the job', cx, p.py + 340, 13, 'rgba(255,255,255,0.55)');
  } else if (game.screen === 'complete') {
    const p = panel(ctx, w, h);
    title(ctx, game.completeTitle || 'JOB DONE', cx, p.py + 80, 32, '#7ac74f');
    body(ctx, game.completeText || '', cx, p.py + 130, 16);
    body(ctx, `Cash $${game.cash}`, cx, p.py + 170, 15, '#ffd94d');
    button(ctx, game, 'next', 'NEXT JOB', cx - 110, p.py + 240, 220, 52);
  } else if (game.screen === 'failed') {
    const p = panel(ctx, w, h);
    title(ctx, 'JOB FAILED', cx, p.py + 80, 32, '#ff6a5a');
    body(ctx, game.missionFailed || 'The job went sideways.', cx, p.py + 130, 16);
    body(ctx, 'Mara gives you one more shot at it.', cx, p.py + 162, 14, 'rgba(255,255,255,0.7)');
    button(ctx, game, 'retry', 'RETRY THE JOB', cx - 110, p.py + 240, 220, 52);
  } else if (game.screen === 'pause') {
    const p = panel(ctx, w, h);
    title(ctx, 'PAUSED', cx, p.py + 80, 32);
    body(ctx, `Mission ${game.missionIndex + 1}/8 — ${game.objectiveText || ''}`, cx, p.py + 130, 15);
    body(ctx, `Cash $${game.cash} · Packages ${game.packagesGot}/8 · Best heat ${game.bestWanted}★`, cx, p.py + 160, 14, 'rgba(255,255,255,0.7)');
    button(ctx, game, 'resume', 'RESUME', cx - 230, p.py + 240, 200, 48);
    button(ctx, game, 'restart', 'RESTART MISSION', cx + 30, p.py + 240, 200, 48);
    body(ctx, 'Esc resumes · M mutes the sound', cx, p.py + 330, 13, 'rgba(255,255,255,0.55)');
  } else if (game.screen === 'wasted') {
    const p = panel(ctx, w, h);
    title(ctx, 'WASTED', cx, p.py + 90, 40, '#ff3d3d');
    body(ctx, 'Danny went down. The crew pulls him out and patches him up.', cx, p.py + 140, 15);
    body(ctx, `Cash $${game.cash} · the job restarts where it began.`, cx, p.py + 170, 14, 'rgba(255,255,255,0.7)');
    button(ctx, game, 'retry', 'BACK ON YOUR FEET', cx - 120, p.py + 240, 240, 52);
  } else if (game.screen === 'busted') {
    const p = panel(ctx, w, h);
    title(ctx, 'BUSTED', cx, p.py + 90, 40, '#3d7bd9');
    body(ctx, 'The Solmar PD hauled Danny in. Mara bails him out — for a fee.', cx, p.py + 140, 15);
    body(ctx, `Cash $${game.cash} · the job restarts where it began.`, cx, p.py + 170, 14, 'rgba(255,255,255,0.7)');
    button(ctx, game, 'retry', 'WALK OUT', cx - 120, p.py + 240, 240, 52);
  } else if (game.screen === 'victory') {
    const p = panel(ctx, w, h);
    title(ctx, 'KING OF SOLMAR', cx, p.py + 70, 38, '#ffd94d');
    body(ctx, 'KANE is down. The Vipers are gone. The city is yours, Danny.', cx, p.py + 116, 16);
    body(ctx, `Final cash $${game.cash} · Packages ${game.packagesGot}/8 · Best heat ${game.bestWanted}★`, cx, p.py + 156, 15, '#ffd94d');
    body(ctx, 'Eight jobs, one crown. Thanks for playing SOLMAR HEAT.', cx, p.py + 190, 14, 'rgba(255,255,255,0.7)');
    button(ctx, game, 'again', 'PLAY AGAIN', cx - 110, p.py + 250, 220, 52);
  }
}
