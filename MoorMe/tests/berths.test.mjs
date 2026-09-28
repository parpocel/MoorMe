// Każda kombinacja keja/sposób cumowania: jacht zacumowany pozostaje stabilny
import { BOATS, defaultEquipment } from '../src/js/data/boats.js';
import { generateHarbor, QUAYS } from '../src/js/data/harbors.js';
import { World } from '../src/js/physics/world.js';
import { rng } from '../src/js/math.js';
let fails = 0;
for (const id of Object.keys(BOATS)) for (const [quay, q] of Object.entries(QUAYS)) for (const method of q.methods) for (const side of method === 'longside' ? ['port', 'starboard'] : ['port']) {
  const spec = BOATS[id];
  const H = generateHarbor({ quay, method, side, boatSpec: spec, seed: 3 });
  const w = new World({ spec, equip: defaultEquipment(spec), harbor: H, weather: { windKn: 14, windFrom: 200, gust: 0.3 }, scenario: 'unmoor', random: rng(1) });
  const x0 = w.boat.x, z0 = w.boat.z;
  for (let i = 0; i < 240 * 30; i++) w.step(1 / 240);
  const drift = Math.hypot(w.boat.x - x0, w.boat.z - z0);
  const ok = drift < 1.2 && w.stats.hullHits === 0 && w.lines.every((l) => l.state === 'attached');
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${quay}/${method}/${side}: dryf ${drift.toFixed(2)} m, uderzenia ${w.stats.hullHits}`);
}
console.log(fails ? `${fails} błędów` : 'Wszystko OK');
process.exit(fails ? 1 : 0);
