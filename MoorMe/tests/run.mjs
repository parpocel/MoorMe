import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
let failed = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith('.test.mjs'))) {
  console.log(`\n=== ${f} ===`);
  try { execFileSync(process.execPath, [join(dir, f)], { stdio: 'inherit' }); } catch { failed++; }
}
if (failed) { console.error(`\n${failed} plik(ów) testów nie przeszło`); process.exit(1); }
console.log('\nWszystkie testy przeszły');
