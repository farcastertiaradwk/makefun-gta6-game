// Particles, explosions, smoke and floating text for SOLMAR HEAT.
// Everything here is cosmetic: it never changes the rules, only shows
// them — muzzle flashes, tyre smoke, explosions, cash popups.

export function makeEffects() {
  return { sparks: [], smoke: [], blasts: [], floats: [] };
}

export function burst(fx, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    fx.sparks.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0.35 + Math.random() * 0.25,
      age: 0,
      color,
      size: 2 + Math.random() * 2,
    });
  }
}

export function puff(fx, x, y, dark) {
  fx.smoke.push({
    x, y,
    vx: (Math.random() - 0.5) * 24,
    vy: (Math.random() - 0.5) * 24 - 12,
    life: 0.9 + Math.random() * 0.5,
    age: 0,
    size: 6 + Math.random() * 6,
    dark: !!dark,
  });
}

export function explode(fx, x, y, big) {
  fx.blasts.push({ x, y, age: 0, life: big ? 0.7 : 0.45, max: big ? 90 : 55 });
  burst(fx, x, y, '#ffcf3d', big ? 26 : 14, big ? 320 : 220);
  burst(fx, x, y, '#ff5a2a', big ? 18 : 10, big ? 220 : 150);
  for (let i = 0; i < (big ? 5 : 3); i++) {
    puff(fx, x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30, true);
  }
}

export function floatText(fx, x, y, text, color) {
  fx.floats.push({ x, y, text, color: color || '#ffffff', age: 0, life: 1.4 });
}

export function stepEffects(fx, dt) {
  for (const s of fx.sparks) {
    s.age += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= 0.92;
    s.vy *= 0.92;
  }
  fx.sparks = fx.sparks.filter((s) => s.age < s.life);
  for (const s of fx.smoke) {
    s.age += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.size += 14 * dt;
  }
  fx.smoke = fx.smoke.filter((s) => s.age < s.life);
  for (const b of fx.blasts) b.age += dt;
  fx.blasts = fx.blasts.filter((b) => b.age < b.life);
  for (const f of fx.floats) {
    f.age += dt;
    f.y -= 34 * dt;
  }
  fx.floats = fx.floats.filter((f) => f.age < f.life);
}

export function drawEffects(ctx, fx, cam) {
  for (const s of fx.smoke) {
    const a = 0.28 * (1 - s.age / s.life);
    ctx.fillStyle = s.dark ? `rgba(40,40,40,${a})` : `rgba(220,220,220,${a})`;
    ctx.beginPath();
    ctx.arc(s.x - cam.x, s.y - cam.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of fx.blasts) {
    const t = b.age / b.life;
    const r = b.max * (0.3 + 0.7 * t);
    ctx.fillStyle = `rgba(255,${Math.floor(180 - 120 * t)},40,${0.85 * (1 - t)})`;
    ctx.beginPath();
    ctx.arc(b.x - cam.x, b.y - cam.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,240,180,${0.9 * (1 - t)})`;
    ctx.beginPath();
    ctx.arc(b.x - cam.x, b.y - cam.y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of fx.sparks) {
    ctx.globalAlpha = 1 - s.age / s.life;
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x - cam.x - s.size / 2, s.y - cam.y - s.size / 2, s.size, s.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  for (const f of fx.floats) {
    ctx.globalAlpha = 1 - f.age / f.life;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x - cam.x, f.y - cam.y);
  }
  ctx.globalAlpha = 1;
}
