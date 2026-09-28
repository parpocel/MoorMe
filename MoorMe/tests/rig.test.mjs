// Linie wskazywane myszą: knaga -> (kluza/półkluza) -> poler, rozpoznawanie roli liny
import { BOATS, defaultEquipment } from '../src/js/data/boats.js';
import { generateHarbor } from '../src/js/data/harbors.js';
import { World } from '../src/js/physics/world.js';
import { rng, localToWorld } from '../src/js/math.js';
let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (w, s) => { for (let i = 0; i < s * 240; i++) w.step(1 / 240); };

const spec = BOATS.C34, equip = defaultEquipment(spec);
const H = generateHarbor({ quay: 'concrete', method: 'longside', side: 'port', boatSpec: spec, seed: 3 });
const w = new World({ spec, equip, harbor: H, weather: { windKn: 0, windFrom: 0, gust: 0 }, scenario: 'moor', start: { x: 30, z: 40, compass: 270 }, random: rng(5) });
w.lines = [];
const b = H.berth;
w.boat.reset(b.x, b.z, b.th);
const cleat = (where) => w.findCleat(where, -1);
// najbliższy poler do punktu lokalnego jachtu przesuniętego wzdłuż kei
const bollardNear = (lx, shift) => { const p = localToWorld(b.x, b.z, b.th, lx, 0); return w.nearestBollard(p.x + shift, -0.5, (q) => q.z < 0.1); };

const bowC = cleat('bow'), sternC = cleat('stern'), midC = cleat('mid');
// punkt na kei względem knagi: dx wzdłuż jachtu, 3 m w bok od burty (lewa burta do kei)
const at = (c, dx) => localToWorld(b.x, b.z, b.th, c.x + dx, c.y - 3);
check(w.inferRole(bowC, at(bowC, 4)) === 'bow', 'knaga dziobowa → poler przed dziobem = cuma dziobowa');
check(w.inferRole(bowC, at(bowC, -8)) === 'springFwd', 'knaga dziobowa → poler za rufą = szpring dziobowy');
check(w.inferRole(bowC, at(bowC, 0)) === 'breastFwd', 'knaga dziobowa → poler na trawersie = brest dziobowy');
check(w.inferRole(sternC, at(sternC, -4)) === 'stern', 'knaga rufowa → poler za rufą = cuma rufowa');
check(w.inferRole(sternC, at(sternC, 8)) === 'springAft', 'knaga rufowa → poler przed dziobem = szpring rufowy');
check(w.inferRole(midC, at(midC, -6)) === 'springFwd', 'knaga śródokręcie → poler z tyłu = szpring dziobowy');
check(w.inferRole(midC, at(midC, 0.5)) === 'side', 'knaga śródokręcie → poler na trawersie = brest/boczna');

// półkluza wskazana ręcznie – lina prowadzona przez nią i założona (w zasięgu)
const half = w.fairleads().find((f) => f.kind === 'halfFairlead' && f.y < 0 && f.x < 0);
const hp = localToWorld(b.x, b.z, b.th, half.x, half.y);
const tgt = w.nearestBollard(hp.x, hp.z, (q) => q.z < 0.1); // poler najbliżej półkluzy (w zasięgu rzutu)
const line = w.rigLine(sternC.id, half.id, tgt, 'fixed');
check(line.fairleadId === half.id, 'lina prowadzona przez wskazaną półkluzę');
check(line.state === 'pending', `zakładanie rozpoczęte (stan: ${line.state})`);
run(w, 4);
check(line.state === 'attached' && line.target === tgt, 'lina założona na wskazany poler');

// poza zasięgiem – lina czeka, a załoga zakłada ją sama, gdy jacht podejdzie do kei
w.boat.reset(b.x, b.z + 8, b.th);
const farTgt = bollardNear(w.boat.xb, 4);
const far = w.rigLine(bowC.id, null, farTgt, 'slip');
check(far.state === 'queued' && far.fairleadId === null, `poza zasięgiem: lina czeka (stan: ${far.state}), bez kluzy`);
run(w, 3);
check(far.state === 'queued', 'nadal czeka, gdy jacht daleko');
w.boat.reset(b.x, b.z, b.th); // jacht dosunięty do kei
run(w, 25);
check(far.state === 'attached' && far.target === farTgt, `po podejściu do kei załoga sama założyła linę (stan: ${far.state}, załoga na lądzie: ${w.crew.ashore})`);

console.log(fails ? `${fails} błędów` : 'Wszystko OK');
process.exit(fails ? 1 : 0);
