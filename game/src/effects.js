// Particles, floating text and explosions — the juice. Particles are plain
// data; the renderer draws them. An explosion also shakes the camera and
// makes a noise the whole street hears.

import { PARTICLE } from './config.js';

// How each kind of particle ages: smoke rises and spreads, fire shrinks.
const AGING = {
  smoke(p, dt) {
    p.vy -= 12 * dt;
    p.size += 14 * dt;
  },
  fire(p, dt) {
    p.size -= 6 * dt;
  },
  spark() {},
  muzzle() {},
};

function ageParticle(p, dt) {
  p.life -= dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const age = AGING[p.kind];
  if (age) age(p, dt);
}

export function stepParticles(world, dt) {
  for (const p of world.particles) ageParticle(p, dt);
  world.particles = world.particles.filter((p) => p.life > 0 && p.size > 0);
  for (const f of world.floaters) {
    f.life -= dt;
    f.y -= 26 * dt;
  }
  world.floaters = world.floaters.filter((f) => f.life > 0);
}

export function detonate(world, x, y, big) {
  const count = big ? PARTICLE.burstBig : PARTICLE.burstSmall;
  for (let i = 0; i < count; i += 1) {
    const a = world.random.draw() * Math.PI * 2;
    const speed = world.random.between(40, big ? 260 : 160);
    world.particles.push({
      kind: i % 3 === 0 ? 'smoke' : 'fire',
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: world.random.between(0.4, 1.0),
      max: 1.0,
      size: world.random.between(6, 14),
    });
  }
  world.camera.shake = big ? PARTICLE.shakeBig : PARTICLE.shakeSmall;
  world.lastExplosionAt = world.time;
  world.lastExplosionX = x;
  world.lastExplosionY = y;
  world.audio.explosion();
}
