// A small deterministic PRNG (mulberry32) so the city, the parked cars,
// the traffic and the pedestrians are the same every run for a given seed.
// One stream per world, consumed in a fixed order by the city builder and
// the spawners — that order is part of the game's identity, so don't shuffle
// the calls around.

export function createRandom(seed) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min, max) {
    return min + next() * (max - min);
  }

  function int(min, max) {
    return Math.floor(range(min, max + 1));
  }

  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }

  function chance(p) {
    return next() < p;
  }

  return { next, range, int, pick, chance };
}
