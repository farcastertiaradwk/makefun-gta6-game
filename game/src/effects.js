// Particles, explosions and floating text for SOLMAR HEAT.
// Everything visual-but-temporary lives here: muzzle flashes, crash smoke,
// big explosions (with a shockwave ring), sparks, and the little cash and
// damage numbers that float up over the action. Effects never change game
// state except through the one deliberate channel: an explosion scares
// nearby pedestrians and can hurt the player, which updateEffects applies.

import { clamp } from './random.js';

/** Add one particle to the world. */
export function addParticle(world, x, y, opts) {
  const o = opts || {};
  world.particles.push({
    x,
    y,
    vx: o.vx || 0,
    vy: o.vy || 0,
    life: o.life || 0.5,
    maxLife: o.life || 0.5,
    size: o.size || 3,
    color: o.color || '#ffcf5a',
    grav: o.grav || 0,
    drag: o.drag === undefined ? 0.92 : o.drag,
  });
}

/** A short spray of sparks (muzzle flash, impacts, pickups). */
export function burst(world, x, y, count, color, speed, life) {
  for (let i = 0; i < count; i += 1) {
    const a = world.rng.range(0, Math.PI * 2);
    const s = world.rng.range(speed * 0.3, speed);
    addParticle(world, x, y, {
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: world.rng.range(life * 0.5, life),
      size: world.rng.range(2, 4.5),
      color,
      drag: 0.9,
    });
  }
}

/** Muzzle flash at the end of a gun barrel. */
export function muzzle(world, x, y, angle) {
  const mx = x + Math.cos(angle) * 20;
  const my = y + Math.sin(angle) * 20;
  burst(world, mx, my, 6, '#ffd94d', 260, 0.16);
  addParticle(world, mx, my, { vx: 0, vy: 0, life: 0.07, size: 9, color: '#fff3b0' });
}

/** Grey smoke puff, used by wrecks and explosions. */
export function smoke(world, x, y, big) {
  const n = big ? 10 : 4;
  for (let i = 0; i < n; i += 1) {
    addParticle(world, x + world.rng.range(-14, 14), y + world.rng.range(-14, 14), {
      vx: world.rng.range(-16, 16),
      vy: world.rng.range(-34, -8),
      life: world.rng.range(0.8, 1.6),
      size: world.rng.range(7, big ? 16 : 11),
      color: '#8a8a8a',
      drag: 0.97,
    });
  }
}

/**
 * A big explosion: flash, fire, smoke, a shockwave ring, a loud sound, and
 * real consequences — nearby peds flee, the player takes damage if caught
 * close, and nearby cars lose health. The ring is a particle with a
 * growing size so the renderer can draw it as an expanding circle.
 */
export function explode(world, x, y, big) {
  const radius = big ? 150 : 90;
  burst(world, x, y, big ? 26 : 14, '#ff7a2e', big ? 420 : 300, 0.55);
  burst(world, x, y, 10, '#ffe08a', 200, 0.4);
  smoke(world, x, y, big);
  world.particles.push({
    x, y, vx: 0, vy: 0,
    life: 0.45, maxLife: 0.45, size: 12, color: '#ffffff',
    grav: 0, drag: 1, ring: true, ringMax: radius,
  });
  world.audio.boom();
  // Consequences, applied once at detonation time.
  const pd = Math.hypot(world.player.x - x, world.player.y - y);
  if (pd < radius) {
    damagePlayer(world, big ? 34 : 18);
  }
  for (const car of world.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < radius + 20) car.health -= big ? 45 : 25;
  }
  for (const ped of world.peds) {
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius + 90) {
      ped.state = 'flee';
      ped.fleeAngle = Math.atan2(ped.y - y, ped.x - x);
      ped.fleeTime = 2.5;
    }
  }
}

/** Floating text that rises and fades (cash earned, damage, mission notes). */
export function floatText(world, x, y, text, color) {
  world.texts.push({ x, y, text, color: color || '#ffffff', life: 1.4, maxLife: 1.4 });
}

/** Damage the player, armor soaking first. Wasted is decided in main.js. */
export function damagePlayer(world, amount) {
  const p = world.player;
  if (p.armor > 0) {
    const soaked = Math.min(p.armor, amount * 0.6);
    p.armor -= soaked;
    p.health -= amount - soaked;
  } else {
    p.health -= amount;
  }
  p.health = Math.max(0, p.health);
  p.hurtFlash = 0.35;
}

/** Step all particles and floating texts. Call once per frame. */
export function updateEffects(world, dt) {
  const parts = world.particles;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const pt = parts[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      parts.splice(i, 1);
      continue;
    }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += (pt.grav || 0) * dt;
    pt.vx *= pt.drag;
    pt.vy *= pt.drag;
    if (pt.ring) pt.size = 12 + (1 - pt.life / pt.maxLife) * pt.ringMax;
  }
  const texts = world.texts;
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    const t = texts[i];
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) texts.splice(i, 1);
  }
  if (world.player.hurtFlash > 0) world.player.hurtFlash = Math.max(0, world.player.hurtFlash - dt);
  // Keep the arrays bounded even in a long chaotic session.
  if (parts.length > 600) parts.splice(0, parts.length - 600);
  if (texts.length > 40) texts.splice(0, texts.length - 40);
}

/** Clamp helper re-export for modules that only import effects. */
export { clamp };
