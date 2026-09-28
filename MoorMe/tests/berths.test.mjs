// Każda kombinacja keja/sposób cumowania: jacht zacumowany pozostaje stabilny
import { BOATS, defaultEquipment } from '../src/js/data/boats.js';
import { generateHarbor, PORTS, berthOptions } from '../src/js/data/harbors.js';
import { World } from '../src/js/physics/world.js';
import { rng } from '../src/js/math.js';
let fails = 0;
for (const id of Object.keys(BOATS)) for (const port of Object.keys(PORTS)) for (const o of berthOptions(port)) for (const side of o.method === 'longside' ? ['port', 'starboard'] : ['port']) {
  const method = o.method, quay = `${port}/${o.zone}`;
  const spec = BOATS[id];
  const H = generateHarbor({ port, zone: o.zone, method, side, boatSpec: spec, seed: 3 });
  const w = new World({ spec, equip: defaultEquipment(spec), harbor: H, weather: { windKn: 14, windFrom: 200, gust: 0.3 }, scenario: 'unmoor', random: rng(1) });
  const x0 = w.boat.x, z0 = w.boat.z;
  for (let i = 0; i < 240 * 30; i++) w.step(1 / 240);
  const drift = Math.hypot(w.boat.x - x0, w.boat.z - z0);
  const ok = drift < 1.2 && w.stats.hullHits === 0 && w.lines.every((l) => l.state === 'attached');
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${quay}/${method}/${side}: dryf ${drift.toFixed(2)} m, uderzenia ${w.stats.hullHits}`);
}
// Regulowana szerokość stanowiska między Y-bomami / dalbami
for (const method of ['yboomStern', 'pilesBow']) for (const clear of [0.2, 0.5, 1.5]) {
  const spec = BOATS.C46;
  const H = generateHarbor({ port: 'ystad', method, side: 'port', boatSpec: spec, seed: 3, slotWidth: spec.beam + clear });
  const divider = method.startsWith('yboom') ? 0.36 : 0.4;
  const widthOk = Math.abs(H.berth.slotW - (spec.beam + clear + divider)) < 1e-9;
  const w = new World({ spec, equip: defaultEquipment(spec), harbor: H, weather: { windKn: 14, windFrom: 200, gust: 0.3 }, scenario: 'unmoor', random: rng(1) });
  const x0 = w.boat.x, z0 = w.boat.z;
  for (let i = 0; i < 240 * 30; i++) w.step(1 / 240);
  const drift = Math.hypot(w.boat.x - x0, w.boat.z - z0);
  const ok = widthOk && drift < 1.2 && w.stats.hullHits === 0 && w.lines.every((l) => l.state === 'attached');
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} C46 ${method} prześwit +${clear} m (stanowisko ${H.berth.slotW.toFixed(2)} m): dryf ${drift.toFixed(2)} m, uderzenia ${w.stats.hullHits}`);
}
console.log(fails ? `${fails} błędów` : 'Wszystko OK');
process.exit(fails ? 1 : 0);
