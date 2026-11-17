// The city of Solmar: roads, blocks, buildings, parks, beach and harbour, all
// generated once from a seed. Also the collision and road queries every other
// system uses, so movement, traffic and the minimap agree about the map.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, BEACH_Y, SEA_Y, HARBOUR, PALETTE, PLACES } from './config.js';

function blockRects() {
  // Blocks are the cells between neighbouring roads.
  const rects = [];
  for (let i = 0; i < ROADS_X.length - 1; i += 1) {
    for (let j = 0; j < ROADS_Y.length - 1; j += 1) {
      rects.push({
        x0: ROADS_X[i] + ROAD_W / 2 + 14,
        y0: ROADS_Y[j] + ROAD_W / 2 + 14,
        x1: ROADS_X[i + 1] - ROAD_W / 2 - 14,
        y1: ROADS_Y[j + 1] - ROAD_W / 2 - 14,
      });
    }
  }
  return rects;
}

function isParkBlock(b) {
  return b.x0 > 1050 && b.x0 < 1450 && b.y0 > 950 && b.y0 < 1300;
}
function isPlazaBlock(b) {
  return b.x0 > 650 && b.x0 < 1050 && b.y0 > 600 && b.y0 < 950;
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parkedSpots = [];
  for (const b of blockRects()) {
    if (isParkBlock(b)) {
      // Palm Park: trees in rows, a pond in the middle, paths crossing it.
      for (let i = 0; i < 14; i += 1) {
        trees.push({
          x: random.range(b.x0 + 20, b.x1 - 20),
          y: random.range(b.y0 + 20, b.y1 - 20),
          r: random.range(9, 14),
        });
      }
      continue;
    }
    if (isPlazaBlock(b)) continue; // Solmar Plaza stays open.
    // One or two buildings per block, kept inside the block with a margin.
    const count = random.chance(0.45) ? 2 : 1;
    for (let k = 0; k < count; k += 1) {
      const w = random.range(90, 170);
      const h = random.range(70, 130);
      const x = random.range(b.x0 + 10, b.x1 - w - 10);
      const y = random.range(b.y0 + 10, b.y1 - h - 10);
      buildings.push({
        x, y, w, h,
        height: random.range(10, 26),
        roof: random.pick(PALETTE.buildingRoof),
        id: buildings.length,
      });
    }
  }
  // Street lamps at every intersection corner.
  for (const x of ROADS_X) {
    for (const y of ROADS_Y) {
      lamps.push({ x: x - ROAD_W / 2 - 8, y: y - ROAD_W / 2 - 8 });
      lamps.push({ x: x + ROAD_W / 2 + 8, y: y + ROAD_W / 2 + 8 });
    }
  }
  // Parked cars along road edges, clear of intersections and shops.
  for (let i = 0; i < 16; i += 1) {
    const vertical = random.chance(0.5);
    const road = random.pick(vertical ? ROADS_X : ROADS_Y);
    const along = random.range(320, 2280);
    const side = random.chance(0.5) ? -1 : 1;
    const spot = vertical
      ? { x: road + side * (ROAD_W / 2 + 18), y: along, angle: side > 0 ? Math.PI / 2 : -Math.PI / 2 }
      : { x: along, y: road + side * (ROAD_W / 2 + 18), angle: side > 0 ? 0 : Math.PI };
    if (spot.x < 60 || spot.x > WORLD.w - 60 || spot.y < 60 || spot.y > BEACH_Y - 40) continue;
    if (Math.abs(spot.x - PLACES.gunshop.x) < 90 && Math.abs(spot.y - PLACES.gunshop.y) < 90) continue;
    parkedSpots.push(spot);
  }
  return { buildings, trees, lamps, parkedSpots };
}

export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

export function inWater(x, y) {
  if (y >= SEA_Y) return true;
  if (x >= HARBOUR.x && y >= HARBOUR.y0 && y <= HARBOUR.y1) return true;
  return false;
}

export function inSand(x, y) {
  return y >= BEACH_Y && y < SEA_Y;
}

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

/** True when a circle at (x, y) with radius r is blocked. Cars also stop at sand. */
export function isBlocked(city, x, y, r, isCar) {
  if (x < r + 4 || y < r + 4 || x > WORLD.w - r - 4 || y > WORLD.h - r - 4) return true;
  if (inWater(x, y)) return true;
  if (isCar && inSand(x, y)) return true;
  for (const b of city.buildings) {
    if (circleHitsRect(x, y, r, b)) return true;
  }
  return false;
}

/** Move a circle with axis-separated sliding: try x, then y, so it slides along walls. */
export function moveCircle(city, entity, dx, dy, isCar) {
  const r = entity.radius;
  if (!isBlocked(city, entity.x + dx, entity.y, r, isCar)) entity.x += dx;
  if (!isBlocked(city, entity.x, entity.y + dy, r, isCar)) entity.y += dy;
}

/** The nearest intersection (road crossing) to a point, for traffic routing. */
export function nearestIntersection(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      const d = (x - rx) * (x - rx) + (y - ry) * (y - ry);
      if (d < bestD) { bestD = d; best = { x: rx, y: ry }; }
    }
  }
  return best;
}

/** The road line nearest to a point: { axis: 'x'|'y', at: number }. */
export function nearestRoad(x, y) {
  let best = { axis: 'x', at: ROADS_X[0], d: Infinity };
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < best.d) best = { axis: 'x', at: rx, d };
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < best.d) best = { axis: 'y', at: ry, d };
  }
  return best;
}
