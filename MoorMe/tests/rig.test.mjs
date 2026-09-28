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
const bollardNear = (lx, shift) => {
  const p = localToWorld(b.x, b.z, b.th, lx, 0);
  const F = b.frame, loc = F.toLocal(p.x, p.z);
  const dir = Math.sign(Math.cos(b.th) * F.ax + Math.sin(b.th) * F.az) || 1; // dziób w stronę +u?
  const q = F.toWorld(loc.u + shift * dir, -0.5);
  return w.nearestBollard(q.x, q.z, (bb) => bb.onQuay && bb.zone === b.zone);
};

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
const tgt = w.nearestBollard(hp.x, hp.z, (q) => q.onQuay && q.zone === b.zone); // poler najbliżej półkluzy (w zasięgu rzutu)
const line = w.rigLine(sternC.id, half.id, tgt, 'fixed');
check(line.fairleadId === half.id, 'lina prowadzona przez wskazaną półkluzę');
check(line.state === 'pending', `zakładanie rozpoczęte (stan: ${line.state})`);
run(w, 4);
check(line.state === 'attached' && line.target === tgt, 'lina założona na wskazany poler');

// poza zasięgiem – lina czeka, a załoga zakłada ją sama, gdy jacht podejdzie do kei
w.boat.reset(b.x - b.quayNormal.x * 8, b.z - b.quayNormal.z * 8, b.th); // 8 m od kei, na wodzie
const farTgt = bollardNear(w.boat.xb, 4);
const far = w.rigLine(bowC.id, null, farTgt, 'slip');
check(far.state === 'queued' && far.fairleadId === null, `poza zasięgiem: lina czeka (stan: ${far.state}), bez kluzy`);
run(w, 3);
check(far.state === 'queued', 'nadal czeka, gdy jacht daleko');
w.boat.reset(b.x, b.z, b.th); // jacht dosunięty do kei
run(w, 25);
check(far.state === 'attached' && far.target === farTgt, `po podejściu do kei załoga sama założyła linę (stan: ${far.state}, załoga na lądzie: ${w.crew.ashore})`);

// lina nie przenika przez kadłub: z prawej knagi dziobowej na poler po lewej stronie (keja) opasuje dziób
{
  const w2 = new World({ spec, equip, harbor: H, weather: { windKn: 0, windFrom: 0, gust: 0 }, scenario: 'moor', start: { x: 30, z: 40, compass: 270 }, random: rng(5) });
  w2.boat.reset(b.x, b.z, b.th);
  const stbdBow = w2.findCleat('bow', 1);
  const fwd = localToWorld(b.x, b.z, b.th, w2.boat.xb - 2.5, 0); // poler na trawersie dziobu, po stronie kei
  const fl = b.frame.toLocal(fwd.x, fwd.z), fq = b.frame.toWorld(fl.u, -0.5);
  const tgt2 = w2.nearestBollard(fq.x, fq.z, (q) => q.onQuay && q.zone === b.zone);
  const l2 = w2.rigLine(stbdBow.id, undefined, tgt2, 'fixed');
  const r = w2.ropeRoute(l2, w2.targetPoint(l2, tgt2));
  const { pointInConvex } = await import('../src/js/math.js');
  const hull = w2.boatPolyWorld();
  let crosses = false;
  // wolny odcinek od zejścia z burty do polera nie może wchodzić w kadłub
  const tp = w2.targetPoint(l2, tgt2);
  for (let i = 1; i < 40; i++) {
    const s = i / 40;
    if (pointInConvex(hull, r.exit.x + (tp.x - r.exit.x) * s, r.exit.z + (tp.z - r.exit.z) * s)) crosses = true;
  }
  // odcinki na jachcie biegną po krawędzi, nie przez środek pokładu
  for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1], c = r.pts[i];
    for (let k = 1; k < 10; k++) {
      const m = { x: a.x + (c.x - a.x) * k / 10, z: a.z + (c.z - a.z) * k / 10 };
      const inner = hull.map(([x, z]) => [b.x + (x - b.x) * 0.85, b.z + (z - b.z) * 0.85]);
      if (i > 1 && pointInConvex(inner, m.x, m.z)) crosses = true;
    }
  }
  check(r.pts.length > 2 && !crosses, `lina z prawej burty na keję po lewej opasuje dziób (punktów na burcie: ${r.pts.length - 1}, długość na jachcie ${r.onBoard.toFixed(1)} m)`);
}

console.log(fails ? `${fails} błędów` : 'Wszystko OK');
process.exit(fails ? 1 : 0);
