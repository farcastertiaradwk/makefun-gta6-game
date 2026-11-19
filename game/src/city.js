// The city of Solmar, built once from the seeded stream. A 6x6 road grid
// (roads every 400 px) over a 2600x2600 map: the Harbour's water along the
// east edge, a beach along the south edge, a park with a pond up north,
// a plaza with a fountain near the middle, and named places the missions
// use. Everything is placed by the rng in a fixed order so the city is
// identical for every player on the same seed.
import { CFG } from './config.js';

export function buildCity(rng) {
  const { w, h } = CFG.world;
  const { spacing, first } = CFG.roads;
  const lines = [];
  for (let v = first; v < w; v += spacing) lines.push(v);

  const blocks = [];
  const buildings = [];
  const trees = [];
  const lamps = [];
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const x0 = lines[i] + 42;
      const y0 = lines[j] + 42;
      const x1 = lines[i + 1] - 42;
      const y1 = lines[j + 1] - 42;
      blocks.push({ x0, y0, x1, y1 });
      // 1-2 buildings per block, inset 14 px from the block edge
      const n = rng.int(1, 3);
      for (let b = 0; b < n; b++) {
        const bw = rng.range(70, 150);
        const bh = rng.range(60, 130);
        const bx = x0 + 14 + rng.range(0, Math.max(1, x1 - x0 - 28 - bw));
        const by = y0 + 14 + rng.range(0, Math.max(1, y1 - y0 - 28 - bh));
        buildings.push({ x: bx, y: by, w: bw, h: bh, tone: rng.int(0, 4) });
      }
      // trees scattered on the block corners
      const tn = rng.int(1, 4);
      for (let t = 0; t < tn; t++) {
        trees.push({ x: x0 + rng.range(10, x1 - x0 - 10), y: y0 + rng.range(10, y1 - y0 - 10), r: rng.range(9, 15) });
      }
    }
  }
  // two lamps per intersection
  for (const gx of lines) {
    for (const gy of lines) {
      lamps.push({ x: gx - 34, y: gy - 34 });
      lamps.push({ x: gx + 34, y: gy + 34 });
    }
  }
  // crosswalks: white stripes where roads meet
  const crossings = [];
  for (const gx of lines) {
    for (const gy of lines) crossings.push({ x: gx, y: gy });
  }
  // parked cars: 16 global slots along road edges; one is always by the
  // safehouse so the first mission's steal is a short walk north.
  const parked = [{ x: 300, y: 1480, angle: Math.PI / 2, color: '#c0392b', kind: 'car' }];
  const spotColors = ['#c0392b', '#2980b9', '#f39c12', '#7f8c8d', '#16a085', '#8e44ad'];
  for (let s = 0; s < 15; s++) {
    const road = rng.pick(lines);
    const along = rng.range(120, w - 120);
    const side = rng.pick([-1, 1]);
    const horiz = rng.chance(0.5);
    parked.push({
      x: horiz ? along : road + side * 40,
      y: horiz ? road + side * 40 : along,
      angle: horiz ? 0 : Math.PI / 2,
      color: rng.pick(spotColors),
      kind: 'car',
    });
  }
  // two parked motorbikes, one near the plaza and one by the beach road
  const bikes = [
    { x: 1080, y: 940, angle: 0.4, color: '#e74c3c', kind: 'bike' },
    { x: 1420, y: 2260, angle: -0.9, color: '#2ecc71', kind: 'bike' },
  ];
  return {
    w, h, roads: lines, blocks, buildings, trees, lamps, crossings,
    parked, bikes,
    water: { x0: 2420, y0: 0, x1: 2600, y1: 2600 },
    beach: { x0: 0, y0: 2420, x1: 2600, y1: 2600 },
    park: { x: 610, y: 610, r: 150 },
    plaza: { x: 1000, y: 1000, r: 130 },
    places: CFG.places,
  };
}

// True when a point is on a road (used by traffic and the minimap).
export function onRoad(city, x, y) {
  const half = CFG.roads.width / 2;
  for (const r of city.roads) {
    if (Math.abs(x - r) < half || Math.abs(y - r) < half) return true;
  }
  return false;
}

// Nearest road coordinate on one axis (traffic snaps to it).
export function nearestRoad(city, v) {
  let best = city.roads[0];
  for (const r of city.roads) if (Math.abs(r - v) < Math.abs(best - v)) best = r;
  return best;
}
