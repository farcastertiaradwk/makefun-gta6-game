// SOLMAR HEAT — a complete open-world crime game for gta6-01, written for
// Node 22 with the standard library only. The game itself is this
// directory's game/ folder: plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library, no network
// request). This program copies game/ and screenshots/ from beside this
// file into the output directory and writes dossier.json there — the
// summary the judge reads — using the vendored make.fun library.
//
// Serve it locally with `node serve.ts` (in the workdir, not part of the
// entry), then open http://localhost:8080. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy the playable game and the screenshots into the output directory.
function stageOutput(destDir) {
  mkdirSync(destDir, { recursive: true });
  cpSync(join(here, 'game'), join(destDir, 'game'), { recursive: true });
  mkdirSync(join(destDir, 'screenshots'), { recursive: true });
  if (existsSync(join(here, 'screenshots'))) {
    cpSync(join(here, 'screenshots'), join(destDir, 'screenshots'), { recursive: true });
  }
}

stageOutput(outDir);

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
