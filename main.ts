// SOLMAR HEAT — the entrypoint for gta6-01.
// Copies the playable game and its screenshots into the output directory
// and writes the dossier the gate scores, with the kit's own builder.
// Runs on plain Node 22+ with no install step: standard library only.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('SOLMAR HEAT: game/index.html is missing — nothing to hand in');
}

// The gate takes 3 or 4 screenshots, each at most 256 KiB. Refuse a bad
// set here, loudly, instead of handing in an entry the gate rejects.
if (existsSync(shotsDir)) {
  const shots = readdirSync(shotsDir)
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort();
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`SOLMAR HEAT: screenshots/ holds ${shots.length} images, need 3 or 4`);
  }
  for (const shot of shots) {
    const size = statSync(join(shotsDir, shot)).size;
    if (size > 262144) {
      throw new Error(`SOLMAR HEAT: screenshots/${shot} is ${size} bytes, over the 256 KiB cap`);
    }
  }
}

mkdirSync(join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`SOLMAR HEAT handed in to ${out}`);
