// SOLMAR HEAT — entrypoint. Copies game/ and screenshots/ into the
// output directory and writes dossier.json with the kit's buildDossier.
// Runs on Node 22+ with the standard library only; no install step.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function copyTree(src, dst) {
  if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
}

function checkShots(shotsDir) {
  if (!existsSync(shotsDir)) throw new Error('main.ts: screenshots/ is missing (need 3-4 images)');
  const shots = readdirSync(shotsDir).filter((f) => !f.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`main.ts: screenshots/ holds ${shots.length} images, need 3-4`);
  }
  for (const f of shots) {
    const size = statSync(join(shotsDir, f)).size;
    if (size > CAPS.screenshots.max_bytes) {
      throw new Error(`main.ts: screenshots/${f} is ${size} bytes, over the 256 KiB cap`);
    }
  }
  return shots;
}

function main() {
  const gameDir = join(ROOT, 'game');
  const shotsDir = join(ROOT, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('main.ts: game/index.html is missing');
  }
  const shots = checkShots(shotsDir);
  mkdirSync(OUT, { recursive: true });
  copyTree(gameDir, join(OUT, 'game'));
  if (existsSync(shotsDir)) copyTree(shotsDir, join(OUT, 'screenshots'));
  const dossier = buildDossier(OUT, CAPS);
  writeFileSync(join(OUT, 'dossier.json'), dossier);
  let shotBytes = 0;
  for (const f of shots) shotBytes += statSync(join(shotsDir, f)).size;
  console.log(`SOLMAR HEAT: dossier ${dossier.length} bytes, ${shots.length} screenshots (${shotBytes} bytes) -> ${OUT}`);
}

main();
