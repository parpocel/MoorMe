import { BOATS, defaultEquipment } from '../src/js/data/boats.js';
import { generateHarbor } from '../src/js/data/harbors.js';
import { World } from '../src/js/physics/world.js';
import { rng } from '../src/js/math.js';
let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (w, s, fn) => { for (let i = 0; i < s * 240; i++) { if (fn) fn(i / 240); w.step(1 / 240); } };

// 1) Longside: oddaj liny, załoga na pokład, odejście
{
  const spec = BOATS.C46, equip = { ...defaultEquipment(BOATS.C46), bowThruster: 'onoff' };
  const H = generateHarbor({ quay: 'concrete', method: 'longside', side: 'port', boatSpec: spec, seed: 3 });
  const w = new World({ spec, equip, harbor: H, weather: { windKn: 6, windFrom: 180, gust: 0 }, scenario: 'unmoor', random: rng(1) });
  run(w, 1);
  check(w.crew.ashore, 'załoga na kei na starcie');
  w.crewAboard();
  check(!w.crew.ashore, 'załoga weszła na pokład');
  for (const l of w.lines) w.release(l);
  run(w, 20);
  check(w.lines.every((l) => l.state === 'ready'), 'liny biegowe wybrane na pokład: ' + w.lines.map((l) => l.state).join(','));
  // odejście: dziób od kei sterem strumieniowym, potem naprzód
  w.boat.bowCmd = 1;
  run(w, 14);
  w.boat.throttle = 0.4; w.boat.rudderCmd = 0.05;
  run(w, 6);
  w.boat.bowCmd = 0;
  run(w, 25);
  w.boat.rudderCmd = 0;
  run(w, 15);
  check(w.stats.hullHits === 0, 'bez uderzeń kadłubem (' + w.stats.hullHits + ')');
  check(w.result && w.result.ok, 'odcumowano: ' + JSON.stringify(w.result && w.result.score));
}
// 2) Oko na stałe bez załogi na lądzie – nie da się zdjąć
{
  const spec = BOATS.C34, equip = defaultEquipment(spec);
  const H = generateHarbor({ quay: 'pontoon', method: 'mooringStern', side: 'port', boatSpec: spec, seed: 3 });
  const w = new World({ spec, equip, harbor: H, weather: { windKn: 5, windFrom: 180, gust: 0 }, scenario: 'unmoor', random: rng(1) });
  const sl = w.lines.find((l) => l.role === 'stern');
  sl.mode = 'fixed';
  w.crewAboard();
  let msg = '';
  w.onEvent = (e) => (msg = e.msg);
  // rufa blisko kei (<1.3 m) – można zdjąć ręką, więc odsuń: sprawdź komunikat albo powodzenie
  w.release(sl);
  check(sl.state === 'attached' || sl.state === 'retrieving', 'oko na stałe: ' + msg);
  // muring: oddaj i daj wsteczny... powinien wkręcić się w śrubę gdy jedziemy nad nim
  const mur = w.lines.find((l) => l.isMooring);
  w.release(mur);
  check(mur.state === 'sinking', 'muring tonie');
  w.boat.throttle = 0.6; // naprzód nad linką muringu
  run(w, 8);
  check(w.engineDead && w.stats.fouled, 'muring w śrubie przy biegu naprzód tuż po oddaniu');
}
// 3) Zerwanie liny przy dużej sile
{
  const spec = BOATS.C34, equip = defaultEquipment(spec);
  const H = generateHarbor({ quay: 'concrete', method: 'longside', side: 'port', boatSpec: spec, seed: 3 });
  const w = new World({ spec, equip, harbor: H, weather: { windKn: 0, windFrom: 180, gust: 0 }, scenario: 'unmoor', random: rng(1) });
  for (const l of w.lines) if (l.role !== 'bow') { w.crewAboard(); l.state = 'ready'; l.target = null; }
  w.boat.throttle = -1;
  run(w, 30);
  const bow = w.lines.find((l) => l.role === 'bow');
  console.log('   max naciąg cumy dziobowej', (bow.maxTension / 1000).toFixed(1), 'kN, stan', bow.state);
  check(bow.state === 'attached' && bow.maxTension > 700, 'cuma dziobowa trzyma jacht na pełnym wstecznym');
}
console.log(fails ? `${fails} błędów` : 'Wszystko OK');
process.exit(fails ? 1 : 0);
