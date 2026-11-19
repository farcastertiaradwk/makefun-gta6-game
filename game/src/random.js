// Seeded randomness for Solmar: one deterministic stream per world.
// A tiny string hash feeds a mulberry32 generator; every consumer draws
// from the same stream in a fixed order, so seed 7 always builds the
// same city, the same traffic and the same staged scenes.
export function hashSeed(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let s = (typeof seed === 'number' ? seed : hashSeed(String(seed))) >>> 0;
  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    // integer in [lo, hi)
    int(lo, hi) {
      return lo + Math.floor(next() * (hi - lo));
    },
    // float in [lo, hi)
    range(lo, hi) {
      return lo + next() * (hi - lo);
    },
    // true with probability p
    chance(p) {
      return next() < p;
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // Fisher-Yates on a copy
    shuffled(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
}
