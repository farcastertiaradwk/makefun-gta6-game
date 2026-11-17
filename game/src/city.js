// Solmar itself: roads, blocks, buildings, the park, the beach and the
// harbour, generated once from a seed. Collision and road queries live here
// too, so movement, traffic and the minimap all agree about the map. The
// draws from the seeded stream happen in a fixed order — park trees, then
// buildings, then parked-car slots — and that order is what makes seed 7
// rebuild the same city every time.

import {
  SHORE_Y,
  HARBOR,
  COLORS,
  SITES,
  LANES_X,
  LANES_Y,
  LANE_W,
  WATER_Y,
  MAP,
} from './config.js';

// Call fn once per cell between neighbouring roads (5 columns x 4 rows).
function forEachBlock(fn) {
  for (let i = 0; i < LANES_X.length - 1; i += 1) {
    for (let j = 0; j < LANES_Y.length - 1; j += 1) {
      fn({
        x0: LANES_X[i] + LANE_W / 2 + 14,
        y0: LANES_Y[j] + LANE_W / 2 + 14,
        x1: LANES_X[i + 1] - LANE_W / 2 - 14,
        y1: LANES_Y[j + 1] - LANE_W / 2 - 14,
      });
    }
  }
}

function blockIsPark(b) {
  return b.x0 > 1050 && b.x0 < 1450 && b.y0 > 950 && b.y0 < 1300;
}

function blockIsPlaza(b) {
  return b.x0 > 650 && b.x0 < 1050 && b.y0 > 600 && b.y0 < 950;
}

export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parkedSpots = [];

  forEachBlock((b) => {
    if (blockIsPark(b)) {
      // Palm Park: fourteen trees scattered across the block.
      for (let i = 0; i < 14; i += 1) {
        trees.push({
          x: rng.between(b.x0 + 20, b.x1 - 20),
          y: rng.between(b.y0 + 20, b.y1 - 20),
          r: rng.between(9, 14),
        });
      }
      return;
    }
    if (blockIsPlaza(b)) return; // Solmar Plaza stays open.
    // One or two buildings per block, kept inside it with a margin.
    const count = rng.maybe(0.45) ? 2 : 1;
    for (let k = 0; k < count; k += 1) {
      const w = rng.between(90, 170);
      const h = rng.between(70, 130);
      const x = rng.between(b.x0 + 10, b.x1 - w - 10);
      const y = rng.between(b.y0 + 10, b.y1 - h - 10);
      buildings.push({
        x,
        y,
        w,
        h,
        height: rng.between(10, 26),
        roof: rng.choose(COLORS.buildingRoof),
        id: buildings.length,
      });
    }
  });

  // A lamp on two opposite corners of every intersection.
  for (const x of LANES_X) {
    for (const y of LANES_Y) {
      lamps.push({ x: x - LANE_W / 2 - 8, y: y - LANE_W / 2 - 8 });
      lamps.push({ x: x + LANE_W / 2 + 8, y: y + LANE_W / 2 + 8 });
    }
  }

  // Parked cars along road edges, clear of intersections and the gun shop.
  for (let i = 0; i < 16; i += 1) {
    const vertical = rng.maybe(0.5);
    const road = rng.choose(vertical ? LANES_X : LANES_Y);
    const along = rng.between(320, 2280);
    const side = rng.maybe(0.5) ? -1 : 1;
    const offset = side * (LANE_W / 2 + 18);
    const spot = {
      x: vertical ? road + offset : along,
      y: vertical ? along : road + offset,
      angle: vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? 0 : Math.PI,
    };
    if (spot.x < 60 || spot.x > MAP.w - 60 || spot.y < 60 || spot.y > SHORE_Y - 40) continue;
    if (Math.abs(spot.x - SITES.gunshop.x) < 90 && Math.abs(spot.y - SITES.gunshop.y) < 90) continue;
    parkedSpots.push(spot);
  }

  return { buildings, trees, lamps, parkedSpots };
}

export function isOnStreet(x, y) {
  for (const rx of LANES_X) if (Math.abs(x - rx) <= LANE_W / 2) return true;
  for (const ry of LANES_Y) if (Math.abs(y - ry) <= LANE_W / 2) return true;
  return false;
}

export function isWater(x, y) {
  if (y >= WATER_Y) return true;
  if (x >= HARBOR.x && y >= HARBOR.y0 && y <= HARBOR.y1) return true;
  return false;
}

export function isSand(x, y) {
  return y >= SHORE_Y && y < WATER_Y;
}

function circleHitsBox(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// True when a circle at (x, y) with radius r cannot be there. Cars stop at
// sand too.
export function blocked(city, x, y, r, isCar) {
  if (x < r + 4 || y < r + 4 || x > MAP.w - r - 4 || y > MAP.h - r - 4) return true;
  if (isWater(x, y)) return true;
  if (isCar && isSand(x, y)) return true;
  for (const b of city.buildings) {
    if (circleHitsBox(x, y, r, b)) return true;
  }
  return false;
}

// Slide a circle along walls: try the x step, then the y step.
export function slideCircle(city, entity, dx, dy, isCar) {
  const r = entity.radius;
  if (!blocked(city, entity.x + dx, entity.y, r, isCar)) entity.x += dx;
  if (!blocked(city, entity.x, entity.y + dy, r, isCar)) entity.y += dy;
}

// The road crossing nearest to a point, for traffic routing.
export function closestCrossing(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of LANES_X) {
    for (const ry of LANES_Y) {
      const d = (x - rx) * (x - rx) + (y - ry) * (y - ry);
      if (d < bestD) {
        bestD = d;
        best = { x: rx, y: ry };
      }
    }
  }
  return best;
}

// The road line nearest to a point: { axis: 'x'|'y', at: number, d: number }.
export function closestRoad(x, y) {
  let best = { axis: 'x', at: LANES_X[0], d: Infinity };
  for (const rx of LANES_X) {
    const d = Math.abs(x - rx);
    if (d < best.d) best = { axis: 'x', at: rx, d };
  }
  for (const ry of LANES_Y) {
    const d = Math.abs(y - ry);
    if (d < best.d) best = { axis: 'y', at: ry, d };
  }
  return best;
}
