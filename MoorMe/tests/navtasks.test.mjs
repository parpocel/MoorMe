import { GENERATORS, VARIANTS, CATEGORIES, makeTask, makeTaskDeck, checkAnswer, fmtAnswer, intersect, norm, angDiff } from '../src/js/data/navTasks.js';
import { setLang, t } from '../src/js/i18n.js';
import { rng } from '../src/js/math.js';

let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const D2R = Math.PI / 180;
const r = rng(17);

// 1) każdy typ zadania generuje sensowne liczby
for (const c of Object.keys(GENERATORS)) for (let v = 0; v < VARIANTS[c]; v++) {
  let ok = true;
  for (let i = 0; i < 50; i++) {
    const tk = GENERATORS[c](r, v);
    if (!tk.text || !tk.answers.length || !tk.steps.length || tk.answers.some((a) => !Number.isFinite(a.value))) ok = false;
    for (const a of tk.answers) if ((a.kind !== 'hm' && !checkAnswer(a, String(a.value))) || !checkAnswer(a, fmtAnswer(a).replace(/[^\d,.\-]/g, ''))) ok = false;
  }
  check(ok && CATEGORIES[c], `${c}/${v}: 50 zadań z poprawnymi, sprawdzalnymi odpowiedziami`);
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
// 5c) trójkąt prędkości: wektor wypadkowy z mapki = KDd i SOG z obliczeń
{
  const r = rng(17);
  let worst = 0;
  const vecOf = (v) => { const cl = Math.cos(v.from.lat * Math.PI / 180), dx = (v.to.lon - v.from.lon) * 60 * cl, dy = (v.to.lat - v.from.lat) * 60; return { ang: Math.atan2(dx, dy) * 180 / Math.PI, len: Math.hypot(dx, dy) }; };
  for (let i = 0; i < 50; i++) {
    for (const cat of ['current', 'steer']) {
      const tk = GENERATORS[cat](r), vs = tk.plot && tk.plot.sol.vectors, g = vs && vecOf(vs.find((v) => v.main));
      if (!g || tk.plot.mode !== 'vector') { worst = 99; continue; }
      const SOG = tk.answers.find((a) => a.key === 'SOG').value;
      worst = Math.max(worst, Math.abs(angDiff(g.ang, tk.diagram.KDd)), Math.abs(g.len - SOG) * 10);
      if (cat === 'steer') { const w = vecOf(vs[1]); worst = Math.max(worst, Math.abs(angDiff(w.ang, tk.answers[0].value)), Math.abs(w.len - tk.diagram.V) * 10); }
    }
  }
  check(worst < 0.2, `mapka wektorowa (prąd): wypadkowa = KDd i SOG, wektor po wodzie = KR i V (max ${worst.toFixed(3)})`);
}
// 5d) różnorodność: talia daje każdy rodzaj zadania raz na cykl; nowe typy odpowiedzi
{
  const deck = makeTaskDeck(rng(5)), N = deck.count(), seen = new Set();
  for (let i = 0; i < N; i++) { const tk = deck.next(); seen.add(`${tk.cat}:${tk.variant}`); }
  check(N >= 24 && seen.size === N, `talia zadań: ${N} różnych rodzajów zadań, każdy raz na cykl`);
  check(checkAnswer({ kind: 'hm', value: 14 * 60 + 35, tol: 2 }, '14:36') && checkAnswer({ kind: 'hm', value: 1439, tol: 3 }, '00:01') && checkAnswer({ kind: 'hm', value: 605, tol: 1 }, '1005') && !checkAnswer({ kind: 'hm', value: 600, tol: 2 }, '10:30'), 'godzina gg:mm (także przez północ i bez dwukropka)');
  check(checkAnswer({ kind: 'sdeg', value: -2.5, tol: 0.5 }, '2,5W') && checkAnswer({ kind: 'sdeg', value: -2.5, tol: 0.5 }, '−2,5') && checkAnswer({ kind: 'sdeg', value: 3, tol: 0.5 }, '+3') && !checkAnswer({ kind: 'sdeg', value: -3, tol: 0.5 }, '3E'), 'poprawka ze znakiem (+/−, E/W)');
  // namiar podwójny: odległość na trawersie zgodna z geometrią
  let worst = 0;
  for (let i = 0; i < 50; i++) {
    const tk = GENERATORS.abeam(r, 1), a = Number(tk.text.match(/(\d+)°/)[1]), run = tk.answers[0].value, ab = tk.answers[1].value;
    // trójkąt: kąty a, 180 − 2a, a → odległość przy 2. namiarze = run; trawers = run · sin 2a
    worst = Math.max(worst, Math.abs(ab - run * Math.sin(2 * a * D2R)));
  }
  check(worst < 1e-9, 'podwojenie kąta kursowego: trawers = d · sin 2α');
}
// 5e) pozycja z dwóch namiarów niejednoczesnych: z pozycji PO latarnia jest na NR₂, a z pozycji cofniętej o drogę d – na NR₁
{
  const r = rng(23);
  let worst = 0;
  const brg = (p, q) => { const cl = Math.cos(((p.lat + q.lat) / 2) * D2R); return norm(Math.atan2((q.lon - p.lon) * 60 * cl, (q.lat - p.lat) * 60) / D2R); };
  for (let i = 0; i < 60; i++) {
    const tk = GENERATORS.fix(r, 2), P = tk.plot.sol.point, A = tk.plot.pts[0], [l1, , l2] = tk.plot.sol.lines, v = tk.plot.sol.vectors[0];
    const back = { lat: P.lat - (v.to.lat - v.from.lat), lon: P.lon - (v.to.lon - v.from.lon) };
    worst = Math.max(worst, Math.abs(angDiff(brg(P, A), l2.brg)), Math.abs(angDiff(brg(back, A), l1.brg)), Math.abs(angDiff(l1.brg, l2.brg)) < 20 ? 99 : 0);
  }
  check(worst < 0.3, `namiary niejednoczesne: PO na NR₂, pozycja sprzed drogi d na NR₁, kąt między namiarami ≥ 20° (max ${worst.toFixed(3)}°)`);
}
// 6) wersja angielska treści
setLang('en');
const tk = GENERATORS.current(rng(3));
check(/^The yacht steers/.test(tk.text) && Object.values(CATEGORIES).every((c) => t(c) !== c), 'zadania i kategorie po angielsku');
setLang('pl');
if (fails) process.exit(1);
console.log('Wszystko OK');
