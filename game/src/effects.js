// Particles, floating text and explosions — the juice. Particles are plain
// data; the renderer draws them. An explosion also shakes the camera and
// makes a noise.
function driftParticle(p, dt) {
  p.life -= dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.kind === 'smoke') {
    p.vy -= 12 * dt;
    p.size += 14 * dt;
  } else if (p.kind === 'fire') {
    p.size -= 6 * dt;
  }
}

export function updateParticles(world, dt) {
  for (const p of world.particles) driftParticle(p, dt);
  world.particles = world.particles.filter((p) => p.life > 0 && p.size > 0);
  for (const f of world.floaters) {
    f.life -= dt;
    f.y -= 26 * dt;
  }
  world.floaters = world.floaters.filter((f) => f.life > 0);
}

export function spawnExplosion(world, x, y, big) {
  const count = big ? 26 : 14;
  for (let i = 0; i < count; i += 1) {
    const a = world.random.next() * Math.PI * 2;
    const speed = world.random.range(40, big ? 260 : 160);
    world.particles.push({
      kind: i % 3 === 0 ? 'smoke' : 'fire',
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: world.random.range(0.4, 1.0),
      max: 1.0,
      size: world.random.range(6, 14),
    });
  }
  world.camera.shake = big ? 14 : 8;
  world.lastExplosionAt = world.time;
  world.lastExplosionX = x;
  world.lastExplosionY = y;
  world.audio.explosion();
}
