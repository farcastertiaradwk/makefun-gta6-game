// Rendering for SOLMAR HEAT: the camera, the city, and every screen.
// The world is drawn top-down on one canvas. The camera follows Danny (or
// his car) and clamps to the city edge. Screens — title, pause, mission
// cards, wasted, busted, victory — are drawn on the same canvas, with
// clickable buttons whose rectangles the renderer records on world.uiButtons
// so the main loop can answer clicks.

import { WORLD, PALETTE, PLACES, SCREENS } from './config.js';
import { MISSION_LIST } from './missions.js';
import { clamp } from './random.js';

const VIEW_W = 1280;
const VIEW_H = 720;

/** Keep the camera centred on the player, inside the city. */
export function updateCamera(world) {
  const focus = world.player.inCar || world.player;
  const tx = clamp(focus.x - VIEW_W / 2, 0, WORLD.size - VIEW_W);
  const ty = clamp(focus.y - VIEW_H / 2, 0, WORLD.size - VIEW_H);
  world.camera.x += (tx - world.camera.x) * 0.12;
  world.camera.y += (ty - world.camera.y) * 0.12;
}

/** Draw a rounded rectangle path. */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The ground: grass base, beach sand south, harbour water east. */
function drawGround(ctx, world) {
  const cam = world.camera;
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Subtle mowing stripes across the grass, cheap and cheerful.
  ctx.fillStyle = PALETTE.grassDark;
  const stripe = 130;
  const startY = Math.floor(cam.y / stripe) * stripe;
  for (let y = startY; y < cam.y + VIEW_H; y += stripe * 2) {
    ctx.fillRect(0, y - cam.y, VIEW_W, stripe);
  }
  // Beach along the south edge.
  if (cam.y + VIEW_H > PLACES.beachY) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, PLACES.beachY - cam.y, VIEW_W, VIEW_H);
  }
  // Harbour water along the east edge.
  if (cam.x + VIEW_W > PLACES.harbourX) {
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(PLACES.harbourX - cam.x, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let i = 0; i < 5; i += 1) {
      const wy = ((i * 397 + world.time * 12) % 2600);
      ctx.fillRect(PLACES.harbourX - cam.x + 30 + i * 22, wy - cam.y, 60, 3);
    }
  }
}

/** Roads, lane markings, crosswalks and the plaza + park ground. */
function drawRoads(ctx, world) {
  const cam = world.camera;
  const half = WORLD.roadWidth / 2;
  // Plaza ground.
  const plaza = PLACES.plaza;
  ctx.fillStyle = PALETTE.plaza;
  ctx.beginPath();
  ctx.arc(plaza.x - cam.x, plaza.y - cam.y, plaza.r, 0, Math.PI * 2);
  ctx.fill();
  // Park ground + pond.
  const park = PLACES.park;
  ctx.fillStyle = '#6da34f';
  ctx.fillRect(park.x - cam.x, park.y - cam.y, park.w, park.h);
  ctx.fillStyle = PALETTE.fountain;
  ctx.beginPath();
  ctx.arc(park.pond.x - cam.x, park.pond.y - cam.y, park.pond.r, 0, Math.PI * 2);
  ctx.fill();
  // Plaza fountain.
  ctx.fillStyle = PALETTE.fountain;
  ctx.beginPath();
  ctx.arc(plaza.x - cam.x, plaza.y - cam.y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8f4ff';
  ctx.beginPath();
  ctx.arc(plaza.x - cam.x, plaza.y - cam.y, 14, 0, Math.PI * 2);
  ctx.fill();
  // Asphalt.
  ctx.fillStyle = PALETTE.road;
  for (const r of world.city.roads) {
    ctx.fillRect(0, r - half - cam.y, VIEW_W, WORLD.roadWidth);
    ctx.fillRect(r - half - cam.x, 0, WORLD.roadWidth, VIEW_H);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const r of world.city.roads) {
    for (let d = 0; d < WORLD.size; d += 90) {
      if (d % 400 < 70) continue; // keep the crossings clear
      ctx.fillRect(d - cam.x, r - 2 - cam.y, 44, 4);
      ctx.fillRect(r - 2 - cam.x, d - cam.y, 4, 44);
    }
  }
  // Crosswalk stripes at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const r of world.city.roads) {
    for (const c of world.city.roads) {
      for (let k = -2; k <= 2; k += 1) {
        ctx.fillRect(r + k * 13 - 4 - cam.x, c - half - 2 - cam.y, 8, 12);
        ctx.fillRect(r + k * 13 - 4 - cam.x, c + half - 10 - cam.y, 8, 12);
        ctx.fillRect(r - half - 2 - cam.x, c + k * 13 - 4 - cam.y, 12, 8);
        ctx.fillRect(r + half - 10 - cam.x, c + k * 13 - 4 - cam.y, 12, 8);
      }
    }
  }
}

/** Buildings, trees, lamps, piers and the named places. */
function drawCityProps(ctx, world) {
  const cam = world.camera;
  // Buildings with a roof and a shaded wall edge.
  for (const block of world.city.blocks) {
    for (const b of block.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 4 - cam.x, b.y + 5 - cam.y, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5 - cam.x, b.y + 5 - cam.y, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 5 - cam.x, b.y + 5 - cam.y, b.w - 10, 5);
    }
    for (const t of block.trees) drawTree(ctx, t.x - cam.x, t.y - cam.y, t.r);
  }
  for (const t of world.city.parkTrees) drawTree(ctx, t.x - cam.x, t.y - cam.y, t.r);
  // The named places: a labelled slab each.
  drawPlace(ctx, world, PLACES.bank, '#d8b25a', 'HARBOR BANK');
  drawPlace(ctx, world, PLACES.gunshop, '#8a9aa8', 'IRON & LEAD');
  drawPlace(ctx, world, PLACES.garage, '#7a8a7a', 'FIX-IT GARAGE');
  drawPlace(ctx, world, PLACES.safehouse, '#b08a5a', 'SAFEHOUSE');
  // Piers into the harbour.
  ctx.fillStyle = '#9a7b4f';
  for (const pier of world.city.piers) {
    ctx.fillRect(pier.x - cam.x, pier.y - cam.y, pier.w, pier.h);
    ctx.fillStyle = '#8a6b42';
    ctx.fillRect(pier.x - cam.x, pier.y - cam.y, pier.w, 6);
    ctx.fillStyle = '#9a7b4f';
  }
  // Lamps: a post and a warm glow at night-ish dusk.
  ctx.fillStyle = '#3a3a3a';
  for (const lamp of world.city.lamps) {
    ctx.fillRect(lamp.x - cam.x - 1, lamp.y - cam.y - 1, 3, 3);
  }
}

function drawTree(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.arc(x + 3, y + 4, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.tree;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.treeLight;
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlace(ctx, world, place, color, label) {
  const cam = world.camera;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(place.x + 4 - cam.x, place.y + 5 - cam.y, place.w, place.h);
  ctx.fillStyle = '#cfc4ae';
  ctx.fillRect(place.x - cam.x, place.y - cam.y, place.w, place.h);
  ctx.fillStyle = color;
  ctx.fillRect(place.x + 6 - cam.x, place.y + 6 - cam.y, place.w - 12, place.h - 12);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, place.x + place.w / 2 - cam.x, place.y + place.h / 2 + 4 - cam.y);
}

/** A car, drawn top-down: body, windshield, roof, headlights. */
function drawCar(ctx, world, car) {
  const cam = world.camera;
  const x = car.x - cam.x;
  const y = car.y - cam.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -19, -9, 40, 22, 6);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -21, -11, 42, 22, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  roundRect(ctx, -4, -9, 12, 18, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(17, -9, 2, 5);
  ctx.fillRect(17, 4, 2, 5);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(19, -8, 2, 4);
  ctx.fillRect(19, 4, 2, 4);
  if (car.kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-2, -11, 8, 22);
    ctx.fillStyle = '#c23b2e';
    ctx.fillRect(-2, -11, 4, 5);
    ctx.fillStyle = '#2e6fc2';
    ctx.fillRect(-2, 6, 4, 5);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', -8, 3);
  }
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, -21, -11, 42, 22, 7);
    ctx.fill();
  }
  ctx.restore();
  if (car.health < 35 && !car.wrecked) {
    ctx.fillStyle = 'rgba(120,120,120,0.6)';
    ctx.beginPath();
    ctx.arc(x + 6, y - 6, 6 + Math.sin(world.time * 9) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A person on foot: shadow, body, head, and a walk bob. */
function drawPerson(ctx, world, x, y, color, angle, bob, ring) {
  const cam = world.camera;
  const px = x - cam.x;
  const py = y - cam.y + Math.sin(bob) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(px, py + 8, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px, py, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Facing tick: a short line showing which way they look.
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(angle) * 11, py + Math.sin(angle) * 11);
  ctx.stroke();
  if (ring) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 13, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** The helicopter: shadow, spotlight cone, body, rotor. */
function drawHeli(ctx, world) {
  const heli = world.heli;
  if (!heli) return;
  const cam = world.camera;
  const x = heli.x - cam.x;
  const y = heli.y - cam.y;
  // Shadow on the ground, offset from the body.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x + 18, y + 24, 30, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // Spotlight cone onto the player.
  const p = world.player;
  const px = p.x - cam.x;
  const py = p.y - cam.y;
  const grad = ctx.createRadialGradient(px, py, 4, px, py, 130);
  grad.addColorStop(0, 'rgba(255,244,180,0.16)');
  grad.addColorStop(1, 'rgba(255,244,180,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heli.angle);
  ctx.fillStyle = PALETTE.heliColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, 28, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9fd8ef';
  ctx.beginPath();
  ctx.ellipse(16, 0, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  const r = heli.rotor % (Math.PI * 2);
  ctx.beginPath();
  ctx.moveTo(Math.cos(r) * -38, Math.sin(r) * -38);
  ctx.lineTo(Math.cos(r) * 38, Math.sin(r) * 38);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(Math.cos(r + Math.PI / 2) * -30, Math.sin(r + Math.PI / 2) * -30);
  ctx.lineTo(Math.cos(r + Math.PI / 2) * 30, Math.sin(r + Math.PI / 2) * 30);
  ctx.stroke();
  ctx.restore();
}

/** Pickups, the mission marker, bullets, particles and floating texts. */
function drawItems(ctx, world) {
  const cam = world.camera;
  for (const pk of world.pickups) {
    const x = pk.x - cam.x;
    const y = pk.y - cam.y;
    const bob = Math.sin(world.time * 4 + pk.x) * 2;
    if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 9, y - 9 + bob, 18, 18);
      ctx.fillStyle = '#e23b2e';
      ctx.fillRect(x - 2, y - 7 + bob, 4, 14);
      ctx.fillRect(x - 7, y - 2 + bob, 14, 4);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(x - 9, y - 6 + bob, 18, 12);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', x, y + 3 + bob);
    } else if (pk.kind === 'package') {
      ctx.fillStyle = '#c98a2e';
      ctx.fillRect(x - 10, y - 8 + bob, 20, 16);
      ctx.strokeStyle = '#7a5212';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 10, y - 8 + bob, 20, 16);
      ctx.beginPath();
      ctx.moveTo(x, y - 8 + bob);
      ctx.lineTo(x, y + 8 + bob);
      ctx.stroke();
    }
  }
  if (world.marker) {
    const x = world.marker.x - cam.x;
    const y = world.marker.y - cam.y;
    const s = 12 + Math.sin(world.time * 5) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ff5a4d';
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }
  for (const b of world.bullets) {
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(b.x - cam.x, b.y - cam.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pt of world.particles) {
    const alpha = Math.max(0, pt.life / pt.maxLife);
    if (pt.ring) {
      ctx.strokeStyle = `rgba(255,200,90,${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.size, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px sans-serif';
  for (const t of world.texts) {
    ctx.fillStyle = t.color;
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.fillText(t.text, t.x - cam.x, t.y - cam.y);
    ctx.globalAlpha = 1;
  }
}

/** A button on a screen; records its rect for click handling. */
function drawButton(ctx, world, id, label, cx, cy, w, h) {
  ctx.fillStyle = 'rgba(255,217,77,0.95)';
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 8);
  ctx.fill();
  ctx.fillStyle = '#1c1c1c';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + 1);
  world.uiButtons.push({ id, x: cx - w / 2, y: cy - h / 2, w, h });
  ctx.textBaseline = 'alphabetic';
}

/** A dark veil + centred panel for the menu screens. */
function panel(ctx, title, titleColor) {
  ctx.fillStyle = 'rgba(8,12,8,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, 170);
}

/** The screens, drawn over the world. */
export function drawScreens(ctx, world) {
  world.uiButtons = [];
  const screen = world.screen;
  if (screen === SCREENS.play) return;
  ctx.save();
  if (screen === SCREENS.title) {
    panel(ctx, 'SOLMAR HEAT', '#ffd94d');
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Danny Reyes needs work. Mara Voss has jobs. Solmar has everything else.', VIEW_W / 2, 230);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '16px sans-serif';
    ctx.fillText('WASD move / drive  ·  Mouse aim, click shoot  ·  E steal & interact  ·  R reload', VIEW_W / 2, 270);
    ctx.fillText('Shift sprint  ·  Space handbrake  ·  Esc pause  ·  M mute', VIEW_W / 2, 296);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Six missions. One city. No mercy from the Solmar PD.', VIEW_W / 2, 340);
    drawButton(ctx, world, 'start', 'START A NEW GAME', VIEW_W / 2, 420, 280, 52);
    if (world.hasSave) {
      drawButton(ctx, world, 'continue', 'CONTINUE', VIEW_W / 2, 488, 280, 52);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px sans-serif';
    ctx.fillText('Press ENTER to start', VIEW_W / 2, 570);
  } else if (screen === SCREENS.pause) {
    panel(ctx, 'PAUSED', '#fff');
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('The city waits. The cops do not.', VIEW_W / 2, 230);
    drawButton(ctx, world, 'resume', 'RESUME', VIEW_W / 2, 330, 240, 50);
    drawButton(ctx, world, 'restart', 'RESTART THE STORY', VIEW_W / 2, 400, 240, 50);
    drawButton(ctx, world, 'quit', 'QUIT TO TITLE', VIEW_W / 2, 470, 240, 50);
  } else if (screen === SCREENS.missionDone) {
    panel(ctx, 'MISSION COMPLETE', '#7be382');
    const m = world.mission;
    const def = m ? MISSION_LIST[m.index] : null;
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    if (def) ctx.fillText(`${def.name} — done. ${def.reward > 0 ? `+$${def.reward}` : 'The safe paid out.'}`, VIEW_W / 2, 240);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '16px sans-serif';
    ctx.fillText('Mara is pleased. The next job is already waiting.', VIEW_W / 2, 280);
    drawButton(ctx, world, 'next', 'NEXT MISSION', VIEW_W / 2, 400, 260, 52);
  } else if (screen === SCREENS.missionFailed) {
    panel(ctx, 'MISSION FAILED', '#ff7a6e');
    const m = world.mission;
    ctx.fillStyle = '#fff';
    ctx.font = '19px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m && m.failReason ? m.failReason : 'The job fell apart.', VIEW_W / 2, 240);
    drawButton(ctx, world, 'retry', 'TRY AGAIN', VIEW_W / 2, 380, 240, 52);
    drawButton(ctx, world, 'quit', 'QUIT TO TITLE', VIEW_W / 2, 452, 240, 52);
  } else if (screen === SCREENS.wasted) {
    panel(ctx, 'WASTED', '#ff5a4d');
    ctx.fillStyle = '#fff';
    ctx.font = '19px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Danny went down in the streets of Solmar.', VIEW_W / 2, 240);
    drawButton(ctx, world, 'restart', 'START OVER', VIEW_W / 2, 380, 240, 52);
  } else if (screen === SCREENS.busted) {
    panel(ctx, 'BUSTED', '#5a8de8');
    ctx.fillStyle = '#fff';
    ctx.font = '19px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('The Solmar PD finally got their cuffs on Danny.', VIEW_W / 2, 240);
    drawButton(ctx, world, 'restart', 'START OVER', VIEW_W / 2, 380, 240, 52);
  } else if (screen === SCREENS.victory) {
    panel(ctx, 'KING OF SOLMAR', '#ffd94d');
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Kane is finished. The plaza is yours. Solmar has a new king.', VIEW_W / 2, 240);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Final take: $${world.cash}. The Harbour Crew salutes you.`, VIEW_W / 2, 280);
    drawButton(ctx, world, 'restart', 'PLAY AGAIN', VIEW_W / 2, 400, 240, 52);
  }
  ctx.restore();
}

/** Draw one frame: world, then HUD (when playing), then any screen. */
export function drawFrame(ctx, world) {
  drawGround(ctx, world);
  drawRoads(ctx, world);
  drawCityProps(ctx, world);
  drawItems(ctx, world);
  // People, then cars (cars sit above peds).
  for (const ped of world.peds) {
    if (ped.down) {
      const cam = world.camera;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(ped.x - cam.x, ped.y - cam.y, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    drawPerson(ctx, world, ped.x, ped.y, ped.color, ped.angle, ped.walkPhase, false);
  }
  for (const cop of world.cops) {
    drawPerson(ctx, world, cop.x, cop.y, '#20242e', cop.angle, cop.walkPhase, false);
  }
  for (const e of world.enemies) {
    if (e.health <= 0) continue;
    drawPerson(ctx, world, e.x, e.y, e.boss ? '#8a1f1f' : '#5a1f8a', e.angle, world.time * 6, false);
    // Health bar over the boss.
    if (e.boss) {
      const cam = world.camera;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - 30 - cam.x, e.y - 30 - cam.y, 60, 7);
      ctx.fillStyle = '#ff5a4d';
      ctx.fillRect(e.x - 30 - cam.x, e.y - 30 - cam.y, 60 * (e.health / 300), 7);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KANE', e.x - cam.x, e.y - 36 - cam.y);
    }
  }
  for (const car of world.cars) drawCar(ctx, world, car);
  drawHeli(ctx, world);
  // The player, with a white ring so they never camouflage into the grass.
  const p = world.player;
  drawPerson(ctx, world, p.x, p.y, '#2e6fc2', p.angle, p.moving ? world.time * 10 : 0, true);
  if (p.inCar) {
    // A small driver dot so the player can see themselves inside the car.
    const cam = world.camera;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
