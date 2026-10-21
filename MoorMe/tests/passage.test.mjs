import { BOATS, defaultEquipment } from '../src/js/data/boats.js';
import { buildPassage, PASSAGES } from '../src/js/data/passage.js';
import { PassageWorld, inCardinalSector } from '../src/js/physics/passage.js';
import { distToPoly } from '../src/js/math.js';
import { rng } from '../src/js/math.js';
let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };

const convex = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], c = p[(i + 2) % p.length]; const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(cr) < 1e-9) continue; const sg = Math.sign(cr); if (s && sg !== s) return false; s = sg; } return true; };
const bearing = (dx, dz) => ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;

// 1) dane akwenów
for (const id of Object.keys(PASSAGES)) {
  const H = buildPassage(id);
  check(H.structures.every((s) => convex(s.poly)), `${id}: wszystkie wielokąty kolizyjne są wypukłe`);
  let minLand = Infinity, minShoal = Infinity;
  const R = H.route;
  for (let i = 0; i < R.length - 1; i++) {
    const a = R[i], b = R[i + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 10);
    for (let k = 0; k <= n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n;
      for (const s of H.structures) { const d = distToPoly(s.poly, x, z).dist; if (s.kind === 'shoal') minShoal = Math.min(minShoal, d); else minLand = Math.min(minLand, d); }
    }
  }
  check(minLand > 60 && minShoal > 60, `${id}: trasa omija ląd (${minLand.toFixed(0)} m) i mielizny (${minShoal.toFixed(0)} m) z zapasem`);
  let bad = 0;
  const w = new PassageWorld({ spec: BOATS.C34, equip: defaultEquipment(BOATS.C34), passageId: id, weather: { windKn: 0, windFrom: 0, gust: 0 }, random: rng(1) });
  for (const m of w.marks) {
    // najbliższy odcinek trasy
    let best = null;
    for (let i = 0; i < R.length - 1; i++) {
      const a = R[i], b = R[i + 1], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((m.x - a.x) * dx + (m.z - a.z) * dz) / (dx * dx + dz * dz)));
      const px = a.x + dx * t, pz = a.z + dz * t, d = Math.hypot(m.x - px, m.z - pz);
      if (!best || d < best.d) best = { d, px, pz, cross: dx * (m.z - pz) - dz * (m.x - px) };
    }
    if (m.rule === 'port' && !(best.cross < 0)) bad++;
    if (m.rule === 'starboard' && !(best.cross > 0)) bad++;
    if (m.required && ['N', 'E', 'S', 'W'].includes(m.rule) && !inCardinalSector(m.rule, bearing(best.px - m.x, best.pz - m.z))) bad++;
    if (m.rule === 'avoid' && best.d < m.radius + 25) bad++;
  }
  check(bad === 0, `${id}: trasa mija wszystkie znaki z właściwej strony i poza strefami zagrożeń`);
}

// 2) przejazd trasy z autopilotem prowadzonym po waypointach
function sail(id, weather, maxT = 3600) {
  const spec = BOATS.C34;
  const w = new PassageWorld({ spec, equip: defaultEquipment(spec), passageId: id, weather, random: rng(3) });
  const log = [];
  w.onEvent = (e) => log.push(e.msg);
  w.boat.throttle = 0.6;
  w.setAutopilot(true, w.H.start.compass);
  let t = 0, maxX = 0;
  while (!w.result && t < maxT) {
    if (Math.floor(t * 10) % 20 === 0) {
      // prosta nawigacja: kurs na waypoint z korektą na XTE
      const n = w.nav;
      const corr = Math.max(-30, Math.min(30, (n.xte / 8)));
      w.setAutopilot(true, n.brg - 0 * corr);
    }
    w.step(1 / 60);
    t += 1 / 60;
    maxX = Math.max(maxX, Math.abs(w.nav.xte));
  }
  return { w, t, log, maxX };
}
for (const id of Object.keys(PASSAGES)) {
  const { w, t, log, maxX } = sail(id, { windKn: 8, windFrom: 270, gust: 0.2, currentKn: 0 });
  check(!!w.result, `${id}: rejs ukończony w ${(t / 60).toFixed(0)} min symulacji (waypointów: ${w.pstats.wpReached})`);
  if (w.result) {
    check(w.pstats.groundings === 0 && w.pstats.markHits === 0, `${id}: bez mielizny i zderzeń ze znakami (${w.pstats.groundings}/${w.pstats.markHits})`);
    check(w.pstats.wrongSide === 0 && w.pstats.avoid === 0, `${id}: znaki mijane poprawnie, bez wejścia w strefy (${w.pstats.wrongSide}/${w.pstats.avoid})`);
    check(w.result.score >= 80, `${id}: wynik ${w.result.score} (średni XTE ${w.result.stats.avgXte.toFixed(0)} m, max ${maxX.toFixed(0)} m)`);
  }
}

// 3) błędy żeglarskie są wykrywane
{
  const spec = BOATS.C34;
  const mk = () => new PassageWorld({ spec, equip: defaultEquipment(spec), passageId: 'baltic', weather: { windKn: 0, windFrom: 0, gust: 0 }, random: rng(5) });
  // czerwony znak po złej stronie: płyniemy na wschód na północ od czerwonej (znak zostaje po prawej)
  let w = mk();
  const red = w.marks.find((m) => m.rule === 'port');
  w.boat.reset(red.x - 200, red.z - 25, 0);
  w.boat.vx = 2.8; w.boat.vz = 0; w.boat.throttle = 0.5;
  for (let i = 0; i < 60 * 150; i++) w.step(1 / 60);
  check(w.pstats.wrongSide >= 1, `czerwony znak minięty po złej stronie jest wykryty (${w.pstats.wrongSide})`);
  // strefa niebezpieczeństwa (wrak)
  w = mk();
  const wr = w.marks.find((m) => m.type === 'wreck');
  w.boat.reset(wr.x - 150, wr.z + 20, 0); w.boat.vx = 2.8; w.boat.throttle = 0.5;
  for (let i = 0; i < 60 * 100; i++) w.step(1 / 60);
  check(w.pstats.avoid >= 1, `wejście w strefę wraku jest wykryte (${w.pstats.avoid})`);
  // mielizna: głębokość i grounding
  w = mk();
  const bank = w.H.shoals[0];
  const cx = bank.poly.reduce((a, p) => a + p[0], 0) / bank.poly.length, cz = bank.poly.reduce((a, p) => a + p[1], 0) / bank.poly.length;
  check(w.depthAt(cx, cz) < spec.draft, `głębokość na mieliźnie (${w.depthAt(cx, cz).toFixed(1)} m) mniejsza niż zanurzenie`);
  check(w.depthAt(0, 150) > 8, `na torze jest głęboko (${w.depthAt(0, 150).toFixed(0)} m)`);
  w.boat.reset(cx - 400, cz, 0); w.boat.vx = 2.8; w.boat.throttle = 0.6;
  for (let i = 0; i < 60 * 200; i++) w.step(1 / 60);
  check(w.pstats.groundings >= 1, `wejście na mieliznę jest wykryte (${w.pstats.groundings})`);
  check(Number.isFinite(w.boat.x) && Math.hypot(w.boat.vx, w.boat.vz) < 20, 'symulacja po kontakcie z mielizną jest stabilna');
}
if (fails) process.exit(1);
console.log('Wszystko OK');
