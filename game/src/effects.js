// Particles, muzzle flashes, explosions, smoke and floating text —
// the juice that makes a chase feel like a chase. All of it is drawn
// by render.js from the arrays this module owns.
export function makeEffects() {
  const fx = {
    parts: [],
    booms: [],
    muzzle(p, x, y, angle) {
      for (let i = 0; i < 5; i++) {
        fx.parts.push({
          x, y,
          vx: Math.cos(angle + (Math.random() - 0.5) * 0.5) * (220 + Math.random() * 160),
          vy: Math.sin(angle + (Math.random() - 0.5) * 0.5) * (220 + Math.random() * 160),
          life: 0.14, max: 0.14, size: 3 + Math.random() * 2, color: '#ffd94d',
        });
      }
    },
    hit(x, y) {
      for (let i = 0; i < 6; i++) {
        fx.parts.push({
          x, y,
          vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260,
          life: 0.3, max: 0.3, size: 2 + Math.random() * 2, color: '#ff6b6b',
        });
      }
    },
    sparks(x, y) {
      for (let i = 0; i < 8; i++) {
        fx.parts.push({
          x, y,
          vx: (Math.random() - 0.5) * 320, vy: (Math.random() - 0.5) * 320,
          life: 0.25, max: 0.25, size: 2, color: '#ffe9a8',
        });
      }
    },
    blood(x, y) {
      for (let i = 0; i < 10; i++) {
        fx.parts.push({
          x, y,
          vx: (Math.random() - 0.5) * 180, vy: (Math.random() - 0.5) * 180,
          life: 0.5, max: 0.5, size: 3, color: '#c0392b',
        });
      }
    },
    explosion(x, y, scale = 1) {
      fx.booms.push({ x, y, life: 0.6, max: 0.6, scale });
      for (let i = 0; i < 22; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (120 + Math.random() * 320) * scale;
        fx.parts.push({
          x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.5 + Math.random() * 0.4, max: 0.9,
          size: 3 + Math.random() * 4, color: ['#ff9f43', '#ff6b6b', '#feca57'][i % 3],
        });
      }
      for (let i = 0; i < 8; i++) {
        fx.parts.push({
          x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30,
          vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 40,
          life: 1.4, max: 1.4, size: 8 + Math.random() * 8, color: 'rgba(90,90,90,0.5)',
        });
      }
    },
    smoke(x, y) {
      fx.parts.push({
        x, y,
        vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 30,
        life: 1.1, max: 1.1, size: 7 + Math.random() * 6, color: 'rgba(80,80,80,0.45)',
      });
    },
    step(dt) {
      for (const p of fx.parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.2, dt);
        p.vy *= Math.pow(0.2, dt);
        p.life -= dt;
      }
      // filter in place: world.booms / world.parts hold this same array
      for (let i = fx.parts.length - 1; i >= 0; i--) {
        if (fx.parts[i].life <= 0) fx.parts.splice(i, 1);
      }
      for (const b of fx.booms) b.life -= dt;
      for (let i = fx.booms.length - 1; i >= 0; i--) {
        if (fx.booms[i].life <= 0) fx.booms.splice(i, 1);
      }
    },
  };
  return fx;
}
