// Vérifie le budget PERF-1 : JS chargé au démarrage ≤ 180 kB gzip.
// Les chunks importés dynamiquement (jsPDF, etc.) ne comptent pas.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 180;
const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const initial = [
  ...html.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+\.js)"/g),
].map((match) => match[1]);

if (initial.length === 0) {
  console.error('Aucun script initial trouvé dans dist/index.html — lancer `npm run build` d’abord.');
  process.exit(1);
}

let totalKb = 0;
for (const file of new Set(initial)) {
  const kb = gzipSync(readFileSync(join(dist, file))).length / 1024;
  totalKb += kb;
  console.log(`${file.padEnd(40)} ${kb.toFixed(1).padStart(7)} kB gzip`);
}
console.log(`${'Total JS initial'.padEnd(40)} ${totalKb.toFixed(1).padStart(7)} kB gzip (budget ${BUDGET_KB} kB)`);

if (totalKb > BUDGET_KB) {
  console.error(`Budget dépassé de ${(totalKb - BUDGET_KB).toFixed(1)} kB.`);
  process.exit(1);
}
