// The city of Solmar: a 2600x2600 grid town, built once from a seed.
// Roads run every 400 px; the blocks between them hold buildings, trees
// and lamps. The Harbour is water on the east edge, the beach is sand on
// the south edge, Marlowe Park holds a pond and Voss Plaza a fountain.
// Everything is deterministic: same seed, same city.

import { WORLD, PALETTE } from './config.js';

const ROAD_HALF = WORLD.roadWidth / 2;
const BLOCK_MARGIN = 14;

function bandEdges() {
  return [0, ...WORLD.roads, WORLD.size];
}

function overlapsParkOrPlaza(x, y, w, h) {
  const p = WORLD.districts.park;
  const z = WORLD.districts.plaza;
  const inRect = (r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y;
  return inRect(p) || inRect(z);
}

function nearPlace(x, y, pad) {
  for (const place of Object.values(WORLD.places)) {
    if (Math.abs(x - place.x) < pad && Math.abs(y - place.y) < pad) return true;
  }
  return false;
}

export function buildCity(rng) {
  const city = {
    buildings: [],
    trees: [],
    lamps: [],
    piers: [],
    parkedSpots: [],
    benches: [],
  };

  // Buildings: one or two per block, kept off roads, the park, the plaza
  // and the water. The east strip past the last road is the Harbour.
  const edges = bandEdges();
  for (let i = 0; i < edges.length - 1; i++) {
    for (let j = 0; j < edges.length - 1; j++) {
      const x0 = edges[i] + ROAD_HALF + BLOCK_MARGIN;
      const x1 = edges[i + 1] - ROAD_HALF - BLOCK_MARGIN;
      const y0 = edges[j] + ROAD_HALF + BLOCK_MARGIN;
      const y1 = edges[j + 1] - ROAD_HALF - BLOCK_MARGIN;
      if (x1 - x0 < 90 || y1 - y0 < 70) continue;
      if (x0 >= 2380) continue; // Harbour water: no buildings.
      if (y0 >= 2380) continue; // Beach: no buildings.
      if (overlapsParkOrPlaza(x0, y0, x1 - x0, y1 - y0)) continue;
      const count = rng.maybe(0.45) ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const w = rng.range(90, Math.min(180, x1 - x0));
        const h = rng.range(70, Math.min(150, y1 - y0));
        const bx = count === 1 ? x0 + (x1 - x0 - w) / 2 : x0 + k * ((x1 - x0 - w) / 1);
        const by = y0 + rng.range(0, Math.max(0, y1 - y0 - h));
        if (nearPlace(bx + w / 2, by + h / 2, 150)) continue;
        city.buildings.push({
          x: bx,
          y: by,
          w,
          h,
          color: rng.choose(PALETTE.building),
          roof: rng.maybe(0.5),
        });
      }
    }
  }

  // Trees: scattered on grass, never on a road, in the pond, or on a plaza.
  for (let n = 0; n < 110; n++) {
    const x = rng.range(40, 2360);
    const y = rng.range(40, 2360);
    if (onRoad(x, y)) continue;
    if (inPond(x, y) || inPlaza(x, y)) continue;
    if (hitsBuilding(city.buildings, x, y, 26)) continue;
    city.trees.push({ x, y, r: rng.range(9, 15), shade: rng.choose([PALETTE.tree, PALETTE.treeLight]) });
  }

  // Lamps: two per intersection, on opposite corners.
  for (const rx of WORLD.roads) {
    for (const ry of WORLD.roads) {
      city.lamps.push({ x: rx - ROAD_HALF - 10, y: ry - ROAD_HALF - 10 });
      city.lamps.push({ x: rx + ROAD_HALF + 10, y: ry + ROAD_HALF + 10 });
    }
  }

  // Piers jutting into the Harbour at the Docks.
  for (const py of [1050, 1350, 1650]) {
    city.piers.push({ x: 2380, y: py - 26, w: 150, h: 52 });
  }

  // Parked cars: sixteen slots tucked against road edges.
  for (let n = 0; n < 16; n++) {
    const vertical = rng.maybe(0.5);
    const road = rng.choose(WORLD.roads);
    const along = rng.range(280, 2320);
    const side = rng.choose([-1, 1]);
    city.parkedSpots.push({
      x: vertical ? road + side * (ROAD_HALF + 22) : along,
      y: vertical ? along : road + side * (ROAD_HALF + 22),
      angle: vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? 0 : Math.PI,
      taken: false,
    });
  }

  // Benches around the plaza fountain and the park pond.
  for (let n = 0; n < 8; n++) {
    const a = (n / 8) * Math.PI * 2;
    city.benches.push({ x: 1000 + Math.cos(a) * 120, y: 1000 + Math.sin(a) * 120, angle: a + Math.PI / 2 });
  }
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2;
    city.benches.push({ x: 610 + Math.cos(a) * 130, y: 610 + Math.sin(a) * 130, angle: a + Math.PI / 2 });
  }

  return city;
}

export function onRoad(x, y) {
  for (const r of WORLD.roads) {
    if (Math.abs(x - r) < ROAD_HALF) return true;
    if (Math.abs(y - r) < ROAD_HALF) return true;
  }
  return false;
}

export function inWater(x, y) {
  return x >= 2400;
}

export function inBeach(x, y) {
  return y >= 2380 && x < 2400;
}

export function inPond(x, y) {
  const dx = x - 610;
  const dy = y - 610;
  return dx * dx + dy * dy < 90 * 90;
}

export function inPlaza(x, y) {
  const z = WORLD.districts.plaza;
  return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
}

export function inPark(x, y) {
  const p = WORLD.districts.park;
  return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
}

function hitsBuilding(buildings, x, y, pad) {
  for (const b of buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
  }
  return false;
}

// Push a circle out of every building it overlaps. Returns true if it hit.
export function collideBuildings(city, body, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * radius;
      body.y = cy + (dy / d) * radius;
      hit = true;
    } else if (d2 <= 0.0001) {
      body.x += radius;
      hit = true;
    }
  }
  return hit;
}

export function clampWorld(body, margin) {
  body.x = Math.max(margin, Math.min(WORLD.size - margin, body.x));
  body.y = Math.max(margin, Math.min(WORLD.size - margin, body.y));
}

// A random point on a road, for traffic and police spawns.
export function roadPoint(rng) {
  const vertical = rng.maybe(0.5);
  const road = rng.choose(WORLD.roads);
  const along = rng.range(120, WORLD.size - 120);
  return vertical ? { x: road, y: along } : { x: along, y: road };
}

// The nearest road coordinate to a point, on one axis.
export function nearestRoadCoord(v) {
  let best = WORLD.roads[0];
  for (const r of WORLD.roads) {
    if (Math.abs(r - v) < Math.abs(best - v)) best = r;
  }
  return best;
}
