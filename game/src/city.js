// The city of Solmar: a 2600x2600 grid of roads, blocks and districts.
// Generation is deterministic and consumes the seeded RNG in a fixed order:
// blocks row by row (i over x, j over y), then trees, then lamps, then the
// parked-car slots. The named places from config sit at fixed coordinates so
// missions and staged screenshots can rely on them; the generator builds the
// ordinary blocks around them and never puts a building on a place.

import { WORLD, PLACES, PALETTE } from './config.js';

/** Is a point inside a rectangle (with a margin)? */
function insideRect(x, y, r, margin) {
  return x > r.x - margin && x < r.x + r.w + margin && y > r.y - margin && y < r.y + r.h + margin;
}

/** Does a rectangle overlap any named place or the plaza/park? */
function overlapsPlace(x, y, w, h) {
  const margin = 30;
  const spots = [
    PLACES.safehouse,
    PLACES.bank,
    PLACES.gunshop,
    PLACES.garage,
  ];
  for (const s of spots) {
    if (x < s.x + s.w + margin && x + w > s.x - margin && y < s.y + s.h + margin && y + h > s.y - margin) {
      return true;
    }
  }
  // Plaza circle.
  const pcx = PLACES.plaza.x;
  const pcy = PLACES.plaza.y;
  const pr = PLACES.plaza.r + margin;
  const cx = Math.max(x, Math.min(pcx, x + w));
  const cy = Math.max(y, Math.min(pcy, y + h));
  const dx = pcx - cx;
  const dy = pcy - cy;
  if (dx * dx + dy * dy < pr * pr) return true;
  // Park rectangle.
  const park = PLACES.park;
  if (x < park.x + park.w + margin && x + w > park.x - margin && y < park.y + park.h + margin && y + h > park.y - margin) {
    return true;
  }
  return false;
}

/**
 * Build the city. Returns the static map: roads, blocks with buildings and
 * trees, lamps, crosswalks, parked-car slots and the named places.
 */
export function buildCity(rng) {
  const roads = WORLD.roads;
  const half = WORLD.roadWidth / 2;
  const blocks = [];

  // Blocks are the squares between roads. Walk row by row (j over y, i over
  // x) so the RNG stream order is stable for a given seed.
  for (let j = 0; j < roads.length - 1; j += 1) {
    for (let i = 0; i < roads.length - 1; i += 1) {
      const bx = roads[i] + half + WORLD.sidewalk;
      const by = roads[j] + half + WORLD.sidewalk;
      const bw = roads[i + 1] - roads[i] - WORLD.roadWidth - WORLD.sidewalk * 2;
      const bh = roads[j + 1] - roads[j] - WORLD.roadWidth - WORLD.sidewalk * 2;
      // Skip blocks that fall in the beach (south) or harbour (east).
      if (by + bh > PLACES.beachY || bx + bw > PLACES.harbourX) continue;
      const block = { x: bx, y: by, w: bw, h: bh, buildings: [], trees: [], kind: 'block' };
      // The plaza and park blocks stay open ground.
      if (overlapsPlace(bx, by, bw, bh)) {
        block.kind = 'open';
        blocks.push(block);
        continue;
      }
      // One or two buildings per block, placed with a 14px margin from the
      // block edge (the margin the playtest era used for its layout).
      const count = rng.maybe(0.55) ? 2 : 1;
      for (let k = 0; k < count; k += 1) {
        const w = rng.range(90, 150);
        const h = rng.range(70, 120);
        const px = bx + 14 + rng.range(0, Math.max(1, bw - w - 28));
        const py = by + 14 + rng.range(0, Math.max(1, bh - h - 28));
        block.buildings.push({
          x: px,
          y: py,
          w,
          h,
          roof: rng.choose(PALETTE.buildingRoof),
          wall: PALETTE.buildingWall,
        });
      }
      // A few trees scattered on the block.
      const treeCount = rng.whole(1, 4);
      for (let t = 0; t < treeCount; t += 1) {
        block.trees.push({
          x: bx + rng.range(20, bw - 20),
          y: by + rng.range(20, bh - 20),
          r: rng.range(9, 15),
        });
      }
      blocks.push(block);
    }
  }

  // Park trees: a denser ring around the pond.
  const parkTrees = [];
  for (let t = 0; t < 26; t += 1) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(PLACES.park.pond.r + 26, 190);
    parkTrees.push({
      x: PLACES.park.pond.x + Math.cos(a) * r,
      y: PLACES.park.pond.y + Math.sin(a) * r,
      r: rng.range(9, 16),
    });
  }

  // Two lamps at every road intersection.
  const lamps = [];
  for (const rx of roads) {
    for (const ry of roads) {
      lamps.push({ x: rx - half - 8, y: ry - half - 8 });
      lamps.push({ x: rx + half + 8, y: ry + half + 8 });
    }
  }

  // Crosswalks: stripes across each road at every intersection.
  const crosswalks = [];
  for (const rx of roads) {
    for (const ry of roads) {
      crosswalks.push({ x: rx, y: ry });
    }
  }

  // Parked-car slots: 16 global slots along random roads, picked in stream
  // order. The spawn code takes them in order, so seed 7 always parks the
  // same cars in the same places.
  const parkedSpots = [];
  for (let s = 0; s < 16; s += 1) {
    const vertical = rng.maybe(0.5);
    const road = rng.choose(roads);
    const along = rng.range(120, WORLD.size - 160);
    const side = rng.maybe(0.5) ? -1 : 1;
    if (vertical) {
      parkedSpots.push({
        x: road + side * (half + 16),
        y: along,
        angle: side > 0 ? Math.PI / 2 : -Math.PI / 2,
      });
    } else {
      parkedSpots.push({
        x: along,
        y: road + side * (half + 16),
        angle: side > 0 ? 0 : Math.PI,
      });
    }
  }

  // The docks: piers jutting into the harbour water on the east edge.
  const piers = [];
  for (let p = 0; p < 3; p += 1) {
    piers.push({ x: PLACES.harbourX, y: 500 + p * 600, w: 130, h: 46 });
  }

  return {
    roads,
    blocks,
    parkTrees,
    lamps,
    crosswalks,
    parkedSpots,
    piers,
    places: PLACES,
    /** The safe point of the bank vault, used by the crack interaction. */
    bankSafe: { x: PLACES.bank.x + PLACES.bank.w / 2, y: PLACES.bank.y + PLACES.bank.h / 2 },
  };
}

/** Is a point on a road (within the asphalt)? */
export function onRoad(city, x, y) {
  const half = WORLD.roadWidth / 2;
  for (const r of city.roads) {
    if (Math.abs(x - r) <= half || Math.abs(y - r) <= half) return true;
  }
  return false;
}

/** Is a point in the harbour water or on the beach? */
export function terrainAt(city, x, y) {
  if (x >= PLACES.harbourX) return 'water';
  if (y >= PLACES.beachY) return 'sand';
  if (onRoad(city, x, y)) return 'road';
  const park = PLACES.park;
  if (x >= park.x && x <= park.x + park.w && y >= park.y && y <= park.y + park.h) return 'park';
  const dx = x - PLACES.plaza.x;
  const dy = y - PLACES.plaza.y;
  if (dx * dx + dy * dy <= PLACES.plaza.r * PLACES.plaza.r) return 'plaza';
  return 'grass';
}

/** Find the nearest named place of a given key, or null. */
export function placeByName(city, key) {
  return city.places[key] || null;
}
