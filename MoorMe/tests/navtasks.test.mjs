import { GENERATORS, CATEGORIES, makeTask, checkAnswer, fmtAnswer, intersect, norm, angDiff } from '../src/js/data/navTasks.js';
import { setLang, t } from '../src/js/i18n.js';
import { rng } from '../src/js/math.js';

let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const D2R = Math.PI / 180;
const r = rng(17);

// 1) każdy typ zadania generuje sensowne liczby
for (const c of Object.keys(GENERATORS)) {
  let ok = true;
  for (let i = 0; i < 50; i++) {
    const tk = GENERATORS[c](r);
    if (!tk.text || !tk.answers.length || !tk.steps.length || tk.answers.some((a) => !Number.isFinite(a.value))) ok = false;
    for (const a of tk.answers) if (!checkAnswer(a, String(a.value)) || !checkAnswer(a, fmtAnswer(a).replace(/[^\d,.\-]/g, ''))) ok = false;
  }
  check(ok && CATEGORIES[c], `${c}: 50 zadań z poprawnymi, sprawdzalnymi odpowiedziami`);
}
// 2) sprawdzanie kątów z zawinięciem 360°
check(checkAnswer({ kind: 'deg', value: 359.6, tol: 1 }, '000') && !checkAnswer({ kind: 'deg', value: 10, tol: 1 }, '12') && checkAnswer({ kind: 'kn', value: 5.62, tol: 0.15 }, '5,6'), 'tolerancja i zawinięcie kątów');
// 3) kurs z poprawką na prąd: wypadkowy kierunek ruchu = zadany KDd
{
  let worst = 0;
  for (let i = 0; i < 200; i++) {
    const tk = GENERATORS.steer(r), dg = tk.diagram;
    const target = Number(tk.text.match(/(\d{3})°/)[1]);
    worst = Math.max(worst, Math.abs(angDiff(dg.KDd, target)));
  }
  check(worst < 0.6, `kurs z poprawką na prąd prowadzi po linii do celu (max odchyłka ${worst.toFixed(2)}°)`);
}
// 4) pozycja z namiarów: przecięcie linii odtwarza punkt
{
  const P = { lat: 54.4, lon: 18.6 }, cl = Math.cos(P.lat * D2R);
  const obj = (b, d) => ({ lat: P.lat + (Math.cos(b * D2R) * d) / 60, lon: P.lon + (Math.sin(b * D2R) * d) / 60 / cl });
  const A = obj(30, 4), B = obj(140, 3);
  const X = intersect(A, 30, B, 140);
  check(Math.abs(X.lat - P.lat) * 60 < 0.05 && Math.abs(X.lon - P.lon) * 60 * cl < 0.05, `przecięcie namiarów 030° i 140° trafia w pozycję (${((X.lat - P.lat) * 60).toFixed(3)}', ${((X.lon - P.lon) * 60).toFixed(3)}')`);
}
// 5) tabela dewiacji: KK + δ(KK) + d ≈ KR
{
  let worst = 0;
  for (let i = 0; i < 100; i++) {
    const tk = GENERATORS.table(r);
    const KM = tk.answers[0].value, KK = tk.answers[1].value;
    const rows = tk.table.rows.map(([k, v]) => [parseInt(k, 10), (v.endsWith('W') ? -1 : 1) * parseFloat(v)]);
    const at = (kk) => { const a = norm(kk), j = Math.floor(a / 45), f = (a - j * 45) / 45; return rows[j][1] + (rows[(j + 1) % 8][1] - rows[j][1]) * f; };
    worst = Math.max(worst, Math.abs(angDiff(KK + at(KK), KM)));
  }
  check(worst < 1, `iteracja tabeli dewiacji: KK + δ(KK) = KM (max ${worst.toFixed(2)}°)`);
}
// 5b) dane do mapki: obiekty i rozwiązanie leżą na wykreślanych liniach / końcu odcinka
{
  const r = rng(91);
  let worst = 0;
  for (let i = 0; i < 50; i++) {
    const f = GENERATORS.fix(r), P = f.plot.sol.point;
    for (const l of f.plot.sol.lines) {
      const cl = Math.cos(P.lat * Math.PI / 180), dx = (l.p.lon - P.lon) * 60 * cl, dy = (l.p.lat - P.lat) * 60;
      worst = Math.max(worst, Math.abs(angDiff(Math.atan2(dx, dy) * 180 / Math.PI, l.brg)));
    }
    const d = GENERATORS.dr(r);
    if (!d.plot || d.plot.pts.length !== 1 || d.plot.sol.segs.length !== 1) worst = 99;
  }
  check(worst < 0.5, `mapka: pozycja z rozwiązania leży na liniach namiarów (max ${worst.toFixed(3)}°)`);
}
// 6) wersja angielska treści
setLang('en');
const tk = makeTask(rng(3), 'current');
check(/^The yacht steers/.test(tk.text) && Object.values(CATEGORIES).every((c) => t(c) !== c), 'zadania i kategorie po angielsku');
setLang('pl');
if (fails) process.exit(1);
console.log('Wszystko OK');
