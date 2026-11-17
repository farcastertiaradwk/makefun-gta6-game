// A small deterministic PRNG (mulberry32) so the city, the parked cars,
// the traffic and the pedestrians are the same every run for a given seed.
// One stream per world, consumed in a fixed order by the city builder and
// the spawners — that order is part of the game's identity, so don't shuffle
// the calls around.

export function makeRng(seed) {
  let state = seed >>> 0;

  // The raw draw: a float in [0, 1). Everything else is built on it.
  function draw() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    draw,
    between(min, max) {
      return min + draw() * (max - min);
    },
    whole(min, max) {
      return Math.floor(min + draw() * (max - min + 1));
    },
    choose(list) {
      return list[Math.floor(draw() * list.length)];
    },
    maybe(p) {
      return draw() < p;
    },
  };
}
