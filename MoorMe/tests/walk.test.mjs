import { BOATS, defaultEquipment } from '../src/js/data/boats.js';
import { generateHarbor } from '../src/js/data/harbors.js';
import { World } from '../src/js/physics/world.js';
import { rng } from '../src/js/math.js';
let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };

const spec = BOATS.C34, equip = defaultEquipment(spec);
const H = generateHarbor({ port: 'med', zone: 'pierA', method: 'mooringStern', side: 'port', boatSpec: spec, seed: 3 });
const w = new World({ spec, equip, harbor: H, weather: { windKn: 0, windFrom: 0, gust: 0 }, scenario: 'unmoor', random: rng(1) });
const onA = H.bollards.filter((b) => b.zone === 'pierA').sort((p, q) => p.z - q.z)[2];
const onB = H.bollards.find((b) => b.zone === 'pierBw');
check(onA && onB, 'bollardy na pomostach A i B istnieją');
const ca = w.walkComp(onA.x, onA.z), cb = w.walkComp(onB.x, onB.z);
check(ca >= 0 && ca === cb, `pomosty A i B są połączone przez keję (komponent ${ca}/${cb})`);
w.crew.x = onA.x; w.crew.z = onA.z;
const route = w.walkRoute([{ x: onB.x, z: onB.z }]);
let wet = 0, len = 0, px = onA.x, pz = onA.z;
for (const p of route) {
  const n = Math.ceil(Math.hypot(p.x - px, p.z - pz) / 0.3);
  for (let i = 1; i <= n; i++) if (!w.walkable(px + (p.x - px) * i / n, pz + (p.z - pz) * i / n, 0.35)) wet++;
  len += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z;
}
const straight = Math.hypot(onA.x - onB.x, onA.z - onB.z);
check(wet === 0, `trasa z pomostu na pomost biegnie tylko po lądzie (punktów nad wodą: ${wet})`);
check(len > straight * 1.2 || w.clearWalk(onA, onB), `trasa nadkłada drogi przez keję (${len.toFixed(0)} m vs prosto ${straight.toFixed(0)} m)`);
if (fails) process.exit(1);
console.log('Wszystko OK');
