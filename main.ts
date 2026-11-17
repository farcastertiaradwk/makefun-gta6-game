// SOLMAR HEAT — entrypoint for the make.fun gta6-01 bounty.
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from the
// kit's vendor/makefun-game.ts. Runs on plain Node 22, standard library
// only, no network, no build step. Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTree(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  if (!existsSync(from)) throw new Error(`main.ts: missing ${name}/ in ${repoRoot}`);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');

// The gate needs 3 or 4 screenshots; fail loudly instead of handing in a
// short set that can only be rejected.
const shots = readdirSync(join(outDir, 'screenshots')).filter((f) => !f.startsWith('.'));
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`main.ts: expected 3-4 screenshots, found ${shots.length}`);
}
for (const shot of shots) {
  if (statSync(join(outDir, 'screenshots', shot)).size > 262144) {
    throw new Error(`main.ts: screenshot ${shot} is over the 256 KiB cap`);
  }
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
