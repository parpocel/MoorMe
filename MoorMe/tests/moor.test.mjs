// Test scenariusza cumowania rufą z muringiem: ustawienie na stanowisku, założenie lin, wybranie muringu
import { BOATS, defaultEquipment } from '../src/js/data/boats.js';
import { generateHarbor } from '../src/js/data/harbors.js';
import { World } from '../src/js/physics/world.js';
import { rng } from '../src/js/math.js';
const spec = BOATS.C34, equip = defaultEquipment(spec);
const H = generateHarbor({ quay: 'pontoon', method: 'mooringStern', side: 'port', boatSpec: spec, seed: 7 });
const w = new World({ spec, equip, harbor: H, weather: { windKn: 8, windFrom: 90, gust: 0 }, scenario: 'moor', start: { x: 30, z: 40, compass: 270 }, random: rng(42) });
w.onEvent = (e) => console.log(`[${e.t.toFixed(1)}] ${e.msg}`);
w.boat.reset(H.berth.x, H.berth.z + 0.4, H.berth.th);
const run = (s) => { for (let i = 0; i < s * 240; i++) w.step(1 / 240); };
run(1);
for (const l of w.lines.filter((l) => l.role === 'stern')) {
  const opts = w.attachOptions(l).filter((o) => o.ok);
  console.log(l.name, 'options', opts.slice(0, 3).map((o) => `${o.bollard.label} ${o.dist.toFixed(1)}`).join('; '));
  w.attach(l, (l.suggestedTarget && opts.find(o=>o.bollard===l.suggestedTarget)) ? l.suggestedTarget : opts[0].bollard);
}
const mur = w.lines.find((l) => l.isMooring);
w.pickupMooring(mur);
run(4);
// chybione rzuty – ponawiaj
for (let k = 0; k < 5; k++) for (const l of w.lines.filter((l) => l.role === 'stern' && l.state === 'ready')) { w.attach(l, w.attachOptions(l).find((o) => o.ok).bollard); run(4); }
run(16);
console.log('states', w.lines.map((l) => l.state + ':' + (l.tension|0)).join(', '));
mur.tending = 'haul';
run(25);
mur.tending = 'hold';
for (const l of w.lines.filter((l) => l.role === 'stern')) l.tending = 'haul';
run(6);
for (const l of w.lines) l.tending = 'hold';
run(12);
const e = w.berthError();
console.log('err', e, 'speed', w.boat.speed.toFixed(3), 'poseOk', w.poseOk, 'linesOk', w.linesOk);
console.log('states', w.lines.map((l) => l.state + ':' + (l.tension|0) + 'N rest ' + l.rest.toFixed(1)).join(', '));
console.log('RESULT', w.result);
if (!w.result || !w.result.ok) process.exit(1);
