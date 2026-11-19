// Seeded random numbers for SOLMAR HEAT.
// The city, traffic, pedestrians and explosions all draw from one seeded
// stream, so seed 7 always builds the same Solmar. Nothing here touches
// Math.random: a fresh page with the same seed is the same city.

export function hashSeed(text) {
  // xmur3-style string hash: folds the text into four 32-bit lanes.
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  let h3 = 0x9e3779b9 ^ 0;
  let h4 = 0x85ebca6b ^ 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
    h3 = Math.imul(h3 ^ c, 2246822519);
    h4 = Math.imul(h4 ^ c, 3266489917);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export function makeRng(seedText) {
  // mulberry32 over the first hash lane; the other lanes seed sub-streams.
  const lanes = hashSeed(seedText);
  let a = lanes[0];
  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    // Float in [lo, hi).
    range(lo, hi) {
      return lo + (hi - lo) * next();
    },
    // Integer in [lo, hi] inclusive.
    whole(lo, hi) {
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    // One element of a non-empty array.
    choose(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // True with probability p.
    maybe(p) {
      return next() < p;
    },
    // Fresh sub-stream so one system never starves another.
    fork(tag) {
      return makeRng(seedText + ':' + tag);
    },
  };
}
