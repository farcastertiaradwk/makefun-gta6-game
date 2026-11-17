// Seeded random numbers for SOLMAR HEAT.
// One small deterministic generator drives the whole city: the same seed
// always deals the same streets, buildings, traffic and pedestrians, so a
// screenshot staged from seed 7 looks the same every time it is taken.
// The generator below is a 32-bit hash-and-mix (xmur3 style seeding feeding
// a mulberry32 stream). It is written from scratch for this game.

/** Turn an arbitrary seed (number or string) into four 32-bit state words. */
function seedWords(seed) {
  let h = 1779033703 ^ String(seed).length;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const words = [];
  for (let k = 0; k < 4; k += 1) {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    words.push(h >>> 0);
  }
  return words;
}

/**
 * Make a seeded random source.
 * Every method consumes the stream in call order, so two runs that call the
 * same methods in the same order get the same numbers. Keep call order
 * stable and the city rebuilds identically.
 */
export function makeRng(seed) {
  const state = seedWords(seed);
  let a = state[0];
  let b = state[1];
  let c = state[2];
  let d = state[3];

  /** Next float in [0, 1). */
  function next() {
    // mulberry32 step over the four words, rotated so the stream mixes well.
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const out = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    // Stir the spare words so long streams do not fall into short cycles.
    b = (Math.imul(b, 1664525) + 1013904223 + (d & 0xffff)) >>> 0;
    c = (c ^ (c << 5) ^ (b >>> 3)) >>> 0;
    d = (d + 0x9e3779b9 + (c & 0xffff)) >>> 0;
    return out;
  }

  /** Float in [low, high). */
  function range(low, high) {
    return low + next() * (high - low);
  }

  /** Integer in [low, high] inclusive. */
  function whole(low, high) {
    return low + Math.floor(next() * (high - low + 1));
  }

  /** Pick one element of an array. */
  function choose(list) {
    return list[Math.floor(next() * list.length)];
  }

  /** True with probability p (0..1). */
  function maybe(p) {
    return next() < p;
  }

  /** Shuffle a copy of an array (Fisher-Yates, stream order preserved). */
  function shuffled(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  /** A fresh child stream derived from this one (for one-off bursts). */
  function fork(tag) {
    return makeRng(`${seed}:${tag}:${Math.floor(next() * 1e9)}`);
  }

  return { next, range, whole, choose, maybe, shuffled, fork };
}

/** Clamp a number into [low, high]. */
export function clamp(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

/** Shortest signed angle difference from a to b, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

/** Euclidean distance between two points. */
export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Linear interpolation. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
