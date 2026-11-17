// A seeded generator (mulberry32). Feed it one seed and the city, the
// traffic and the screenshot scenes come out the same every single time.
export function createRandom(seed) {
  let s = seed >>> 0;

  function next() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let h = Math.imul(s ^ (s >>> 15), 1 | s);
    h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  }

  function range(min, max) {
    return min + next() * (max - min);
  }

  function int(min, max) {
    return Math.floor(min + next() * (max + 1 - min));
  }

  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }

  function chance(p) {
    return next() < p;
  }

  return { next, range, int, pick, chance };
}
