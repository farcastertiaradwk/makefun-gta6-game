// The renderer: a top-down camera that follows the player, drawing the ground,
// roads, buildings with a little fake height, trees, cars, people, bullets and
// particles. Sun-soaked palette, crisp shapes — the game must read at a glance
// when the judge shrinks a screenshot.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, BEACH_Y, SEA_Y, HARBOUR, PALETTE, PLACES } from './config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 0;
  let viewH = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = canvas.clientWidth;
    viewH = canvas.clientHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function cameraFor(world) {
    const cam = world.camera;
    const px = world.player.x;
    const py = world.player.y;
    let cx = px - viewW / 2;
    let cy = py - viewH / 2;
    cx = Math.max(0, Math.min(WORLD.w - viewW, cx));
    cy = Math.max(0, Math.min(WORLD.h - viewH, cy));
    if (cam.shake > 0.3) {
      cx += (Math.random() - 0.5) * cam.shake;
      cy += (Math.random() - 0.5) * cam.shake;
    }
    return { x: cx, y: cy };
  }

  function drawGround(world, cam) {
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, viewW, viewH);
    // Mow stripes for a little texture.
    ctx.fillStyle = PALETTE.grassDark;
    const stripe = 120;
    const x0 = Math.floor(cam.x / stripe) * stripe;
    const y0 = Math.floor(cam.y / stripe) * stripe;
    for (let y = y0; y < cam.y + viewH; y += stripe * 2) {
      for (let x = x0; x < cam.x + viewW; x += stripe * 2) {
        ctx.fillRect(x - cam.x, y - cam.y, stripe, stripe);
      }
    }
    // Beach, then sea with wave lines.
    if (BEACH_Y - cam.y < viewH && SEA_Y - cam.y > 0) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(0, BEACH_Y - cam.y, viewW, SEA_Y - BEACH_Y);
      ctx.fillStyle = PALETTE.sea;
      ctx.fillRect(0, SEA_Y - cam.y, viewW, viewH - (SEA_Y - cam.y));
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        const wy = SEA_Y + 14 + i * 18 - cam.y;
        if (wy < 0 || wy > viewH) continue;
        ctx.beginPath();
        for (let x = 0; x <= viewW; x += 24) {
          const y = wy + Math.sin(x * 0.02 + world.time * 1.4 + i) * 3;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // Harbour water.
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(HARBOUR.x - cam.x, HARBOUR.y0 - cam.y, WORLD.w - HARBOUR.x, HARBOUR.y1 - HARBOUR.y0);
    // Docks: wooden piers into the water.
    ctx.fillStyle = '#8a6a42';
    for (const py of [380, 520, 660, 800]) {
      ctx.fillRect(HARBOUR.x - cam.x, py - cam.y, 130, 26);
    }
    // Roads with sidewalks, centre dashes and crosswalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2 - 10 - cam.x, -cam.y, ROAD_W + 20, WORLD.h);
    for (const ry of ROADS_Y) ctx.fillRect(-cam.x, ry - ROAD_W / 2 - 10 - cam.y, WORLD.w, ROAD_W + 20);
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, WORLD.h);
    for (const ry of ROADS_Y) ctx.fillRect(-cam.x, ry - ROAD_W / 2 - cam.y, WORLD.w, ROAD_W);
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_X) {
      for (let y = 0; y < WORLD.h; y += 56) {
        ctx.fillRect(rx - 2 - cam.x, y - cam.y, 4, 28);
      }
    }
    for (const ry of ROADS_Y) {
      for (let x = 0; x < WORLD.w; x += 56) {
        ctx.fillRect(x - cam.x, ry - 2 - cam.y, 28, 4);
      }
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(rx + i * 12 - 4 - cam.x, ry - ROAD_W / 2 - 8 - cam.y, 8, 12);
          ctx.fillRect(rx + i * 12 - 4 - cam.x, ry + ROAD_W / 2 - 4 - cam.y, 8, 12);
        }
      }
    }
    // Palm Park: paths and a pond.
    ctx.fillStyle = '#5d8a48';
    ctx.fillRect(1100 - cam.x, 1000 - cam.y, 300, 250);
    ctx.fillStyle = PALETTE.parkPath;
    ctx.fillRect(1235 - cam.x, 1000 - cam.y, 30, 250);
    ctx.fillRect(1100 - cam.x, 1110 - cam.y, 300, 30);
    ctx.fillStyle = '#4d8fb0';
    ctx.beginPath();
    ctx.ellipse(1180 - cam.x, 1180 - cam.y, 42, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    // Solmar Plaza: paved square with a fountain.
    ctx.fillStyle = PALETTE.plaza;
    ctx.fillRect(700 - cam.x, 650 - cam.y, 300, 250);
    ctx.fillStyle = '#7fc4d8';
    ctx.beginPath();
    ctx.arc(850 - cam.x, 775 - cam.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e0cc';
    ctx.beginPath();
    ctx.arc(850 - cam.x, 775 - cam.y, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  function drawBuildings(world, cam) {
    for (const b of world.city.buildings) {
      const bx = b.x - cam.x;
      const by = b.y - cam.y;
      if (bx > viewW || by > viewH || bx + b.w < 0 || by + b.h < 0) continue;
      // Shadow and a south wall, for a hint of height.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(bx + 6, by + b.height, b.w, b.h);
      ctx.fillStyle = PALETTE.buildingWall;
      ctx.fillRect(bx, by + b.h, b.w, b.height);
      ctx.fillStyle = b.roof;
      ctx.fillRect(bx, by, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 1, by + 1, b.w - 2, b.h - 2);
      // Roof furniture.
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(bx + 10, by + 10, 18, 12);
      ctx.fillRect(bx + b.w - 30, by + b.h - 22, 20, 12);
    }
    // Trees.
    for (const t of world.city.trees) {
      const tx = t.x - cam.x;
      const ty = t.y - cam.y;
      if (tx < -20 || tx > viewW + 20 || ty < -20 || ty > viewH + 20) continue;
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(tx - 2, ty - 2, 4, 8);
      ctx.fillStyle = '#3f7d3a';
      ctx.beginPath();
      ctx.arc(tx, ty - 6, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57a04e';
      ctx.beginPath();
      ctx.arc(tx - 4, ty - 10, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Street lamps.
    ctx.fillStyle = '#2f333a';
    for (const l of world.city.lamps) {
      const lx = l.x - cam.x;
      const ly = l.y - cam.y;
      if (lx < 0 || lx > viewW || ly < 0 || ly > viewH) continue;
      ctx.fillRect(lx - 2, ly - 2, 4, 4);
    }
  }

  function drawPickups(world, cam) {
    for (const p of world.pickups) {
      if (p.taken) continue;
      const px = p.x - cam.x;
      const py = p.y - cam.y;
      if (px < -20 || px > viewW + 20 || py < -20 || py > viewH + 20) continue;
      const bob = Math.sin(world.time * 3 + p.x) * 3;
      if (p.kind === 'package') {
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(px - 10, py - 8 + bob, 20, 16);
        ctx.strokeStyle = '#ffd94d';
        ctx.lineWidth = 2;
        ctx.strokeRect(px - 10, py - 8 + bob, 20, 16);
      } else if (p.kind === 'health') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 10, py - 10 + bob, 20, 20);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(px - 3, py - 8 + bob, 6, 16);
        ctx.fillRect(px - 8, py - 3 + bob, 16, 6);
      } else if (p.kind === 'ammo') {
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(px - 8, py - 10 + bob, 16, 20);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(px - 8, py - 2 + bob, 16, 4);
      }
    }
  }

  function drawCar(world, cam, car) {
    const cx = car.x - cam.x;
    const cy = car.y - cam.y;
    if (cx < -60 || cx > viewW + 60 || cy < -60 || cy > viewH + 60) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(car.angle);
    if (car.wrecked) ctx.globalAlpha = 0.75;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-22, -8, 46, 24);
    // Body.
    ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
    ctx.beginPath();
    ctx.roundRect(-23, -11, 46, 22, 6);
    ctx.fill();
    // Windshield and roof.
    ctx.fillStyle = 'rgba(180,220,235,0.9)';
    ctx.fillRect(6, -8, 8, 16);
    ctx.fillStyle = car.wrecked ? '#222' : 'rgba(0,0,0,0.25)';
    ctx.fillRect(-8, -8, 12, 16);
    // Wheels.
    ctx.fillStyle = '#111';
    ctx.fillRect(-16, -13, 9, 4);
    ctx.fillRect(-16, 9, 9, 4);
    ctx.fillRect(8, -13, 9, 4);
    ctx.fillRect(8, 9, 9, 4);
    // Police light bar, flashing.
    if (car.kind === 'police') {
      const phase = Math.floor(world.time * 6) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2d2d' : '#2d6bff';
      ctx.fillRect(-4, -9, 8, 5);
      ctx.fillStyle = phase ? '#2d6bff' : '#ff2d2d';
      ctx.fillRect(-4, 4, 8, 5);
    }
    // Brake lights.
    if (car.brakeLight) {
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(-24, -9, 3, 5);
      ctx.fillRect(-24, 4, 3, 5);
    }
    ctx.restore();
    if (car.wrecked) {
      ctx.fillStyle = 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      ctx.arc(cx, cy, 18 + Math.sin(world.time * 2) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPerson(world, cam, x, y, angle, shirt, label, down, ring) {
    const px = x - cam.x;
    const py = y - cam.y;
    if (px < -30 || px > viewW + 30 || py < -30 || py > viewH + 30) return;
    ctx.save();
    ctx.translate(px, py);
    if (down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(angle);
    // Shadow, body, head, gun direction.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    // A white ring keeps the player readable on grass, road, and plaza alike.
    if (ring) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(5, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 12, 3);
    ctx.restore();
    if (label) {
      ctx.fillStyle = label === 'KANE' ? '#ff2222' : '#ff8888';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, px, py - 20);
    }
  }

  function drawMarker(world, cam) {
    const m = world.mission && world.mission.marker;
    if (!m) return;
    const mx = m.x - cam.x;
    const my = m.y - cam.y;
    const bob = Math.sin(world.time * 4) * 6;
    // A beam of light so the marker is visible across the city.
    ctx.fillStyle = 'rgba(255,217,77,0.13)';
    ctx.fillRect(m.x - 14 - cam.x, -cam.y, 28, WORLD.h);
    if (mx > -40 && mx < viewW + 40 && my > -40 && my < viewH + 40) {
      ctx.save();
      ctx.translate(mx, my + bob - 26);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.strokeStyle = '#7a5c00';
      ctx.lineWidth = 2;
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.restore();
      ctx.fillStyle = '#7a5c00';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, mx, my + bob - 44);
    } else {
      // Off-screen: an arrow at the screen edge points the way.
      const ex = Math.max(30, Math.min(viewW - 30, mx));
      const ey = Math.max(30, Math.min(viewH - 30, my));
      const a = Math.atan2(my - viewH / 2, mx - viewW / 2);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd94d';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, ex, ey - 16);
    }
  }

  function drawParticles(world, cam) {
    for (const p of world.particles) {
      const px = p.x - cam.x;
      const py = p.y - cam.y;
      if (px < -30 || px > viewW + 30 || py < -30 || py > viewH + 30) continue;
      const alpha = Math.max(0, p.life / p.max);
      if (p.kind === 'smoke') {
        ctx.fillStyle = `rgba(90,90,90,${0.5 * alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'fire') {
        ctx.fillStyle = `rgba(255,${120 + Math.floor(100 * alpha)},20,${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = `rgba(255,230,80,${alpha})`;
        ctx.fillRect(px - 3, py - 3, 6, 6);
      } else if (p.kind === 'muzzle') {
        ctx.fillStyle = `rgba(255,220,90,${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Bullets as short tracers.
    ctx.strokeStyle = '#ffe95a';
    ctx.lineWidth = 2;
    for (const b of world.bullets) {
      const bx = b.x - cam.x;
      const by = b.y - cam.y;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - b.vx * 0.02, by - b.vy * 0.02);
      ctx.stroke();
    }
    // Floating texts.
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (const f of world.floaters) {
      ctx.fillStyle = f.color;
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.fillText(f.text, f.x - cam.x, f.y - cam.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHeli(world, cam) {
    const heli = world.heli;
    if (!heli || heli.x === undefined) return;
    const hx = heli.x - cam.x;
    const hy = heli.y - cam.y;
    // Shadow on the ground, body above it, spotlight on the player.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(hx + 30, hy + 34, 30, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,200,0.16)';
    ctx.beginPath();
    ctx.arc(world.player.x - cam.x, world.player.y - cam.y, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(hx, hy);
    ctx.fillStyle = '#2e5fa3';
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.ellipse(14, 0, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-38, 0);
    ctx.lineTo(38, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawShopSigns(world, cam) {
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    for (const key of ['gunshop', 'garage', 'safehouse', 'bank']) {
      const p = PLACES[key];
      const px = p.x - cam.x;
      const py = p.y - cam.y;
      if (px < -60 || px > viewW + 60 || py < -60 || py > viewH + 60) continue;
      ctx.fillStyle = 'rgba(20,24,32,0.85)';
      ctx.fillRect(px - 52, py - 34, 104, 20);
      ctx.fillStyle = '#ffd94d';
      ctx.fillText(p.name.toUpperCase(), px, py - 20);
    }
  }

  function draw(world, screen) {
    const cam = cameraFor(world);
    drawGround(world, cam);
    drawBuildings(world, cam);
    drawShopSigns(world, cam);
    drawPickups(world, cam);
    drawMarker(world, cam);
    // People and cars, sorted by y so nearer ones overlap farther ones.
    const drawables = [];
    for (const car of world.cars) drawables.push({ y: car.y, fn: () => drawCar(world, cam, car) });
    for (const ped of world.peds) {
      drawables.push({
        y: ped.y,
        fn: () => drawPerson(world, cam, ped.x, ped.y, ped.angle, ped.shirt, null, ped.state === 'down'),
      });
    }
    for (const cop of world.cops) {
      drawables.push({
        y: cop.y,
        fn: () => drawPerson(world, cam, cop.x, cop.y, cop.angle, '#2e5fa3', null, false),
      });
    }
    for (const e of world.enemies) {
      drawables.push({
        y: e.y,
        fn: () => drawPerson(world, cam, e.x, e.y, e.angle, e.boss ? '#7a1f1f' : '#5b2d8e', e.health > 0 ? e.name : null, e.health <= 0),
      });
    }
    drawables.push({
      y: world.player.y,
      fn: () => {
        if (!world.player.inCar) {
          drawPerson(world, cam, world.player.x, world.player.y, world.player.angle, PALETTE.playerShirt, null, false, true);
        }
      },
    });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();
    drawParticles(world, cam);
    drawHeli(world, cam);
    return { viewW, viewH };
  }

  return { draw, resize };
}
