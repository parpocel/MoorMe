import { beaufort, knToBft, BFT_MAX, clouds, cloud, CLOUD_IDS, meanings, windAt, pressureAt, isobars, makeSynoptic, makeMapQuestion, seaSpots, isLand, toXY, MAP,
  makeBaroQuestion, tendencyText, makePhenQuestion, PHEN_COUNT, makeBftQuestion, makeCloudQuestion, DIR8, dir8, frontZone } from '../src/js/data/meteo.js';
import { setLang } from '../src/js/i18n.js';

let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// 1) skala Beauforta: ciągłe zakresy i przeliczenie węzłów
let cont = true;
for (let f = 1; f <= BFT_MAX; f++) if (beaufort(f).kn[0] !== beaufort(f - 1).kn[1] + (f <= 1 ? 0 : 1)) cont = false;
check(cont, 'zakresy prędkości w skali Beauforta są ciągłe (0–1, 1–3, 4–6, …)');
const pairs = [[0.4, 0], [2, 1], [5, 2], [10, 3], [11, 4], [16, 4], [17, 5], [27, 6], [28, 7], [34, 8], [47, 9], [55, 10], [63, 11], [70, 12]];
check(pairs.every(([kn, f]) => knToBft(kn) === f), `węzły → °B: ${pairs.map(([kn]) => `${kn}→${knToBft(kn)}`).join(' ')}`);
check(beaufort(6).h === 3 && beaufort(8).h === 5.5 && beaufort(4).h === 1, 'prawdopodobne wysokości fal wg WMO (4°B – 1 m, 6°B – 3 m, 8°B – 5,5 m)');
check([...Array(13).keys()].every((f) => f === 0 || beaufort(f).foam >= beaufort(f - 1).foam), 'udział piany rośnie z siłą wiatru');

// 2) chmury: 10 rodzajów, każdy ma znaczenie z listy
check(CLOUD_IDS.length === 10 && clouds().every((c) => c.name && c.look && c.weather), '10 rodzajów chmur z opisem i prognozą');
const M = new Set(meanings().map((m) => m.id));
check(clouds().every((c) => M.has(c.mean)), 'każdy rodzaj chmur ma znaczenie z listy odpowiedzi');
check(cloud('Cb').mean === 'storm' && cloud('Cs').mean === 'front' && cloud('Ns').mean === 'rain', 'Cb – burza, Cs – front ciepły, Ns – ciągłe opady');

// 3) wiatr wokół niżu (półkula północna): przeciwnie do ruchu wskazówek zegara, z odchyleniem do środka
const [cx, cy] = toXY(15, 58);
const S = { base: 1013, gx: 0, gy: 0, centers: [{ kind: 'L', x: cx, y: cy, d: -30, r: 600 }], fronts: [] };
const south = windAt(S, cx, cy - 400), east = windAt(S, cx + 400, cy), north = windAt(S, cx, cy + 400), west = windAt(S, cx - 400, cy);
check(south.from > 200 && south.from < 270, `na południe od niżu wiatr z W–SW (${south.from.toFixed(0)}°)`);
check(east.from > 110 && east.from < 180, `na wschód od niżu wiatr z S–SE (${east.from.toFixed(0)}°)`);
check(north.from > 20 && north.from < 90, `na północ od niżu wiatr z E–NE (${north.from.toFixed(0)}°)`);
check(west.from > 290 || west.from < 0, `na zachód od niżu wiatr z N–NW (${west.from.toFixed(0)}°)`);
// prawo Buys-Ballota: niż po lewej, nieco z przodu, patrząc z wiatrem
for (const [nm, w, bx, by] of [['S', south, 0, -400], ['E', east, 400, 0]]) {
  const brgLow = (Math.atan2(-bx, -by) * 180 / Math.PI + 360) % 360;
  check(angDiff(brgLow, w.from + 90) < 30, `Buys-Ballot (${nm}): niż na ${brgLow.toFixed(0)}°, wiatr z ${w.from.toFixed(0)}° (+90° = ${((w.from + 90) % 360).toFixed(0)}°)`);
}
// gradient 4 hPa na 200 km ≈ 5°B przy powierzchni morza
const G = { base: 1013, gx: 0, gy: 20, centers: [], fronts: [] };
const wg = windAt(G, MAP.w / 2, toXY(15, 55)[1]);
check(knToBft(wg.kn) === 5, `izobary co 4 hPa odległe o 200 km → ok. ${wg.kn.toFixed(0)} kn (${knToBft(wg.kn)}°B), wiatr z ${wg.from.toFixed(0)}°`);

// 4) izobary leżą na swoich poziomach
const S2 = makeSynoptic(42);
const iso = isobars(S2);
let maxErr = 0; for (const l of iso) for (const [x, y] of l.pts.filter((_, i) => i % 7 === 0)) maxErr = Math.max(maxErr, Math.abs(pressureAt(S2, x, y) - l.p));
check(iso.length > 5 && maxErr < 0.6, `${iso.length} izobar, maks. odchyłka ${maxErr.toFixed(2)} hPa`);
check(iso.every((l) => l.p % 4 === 0), 'izobary co 4 hPa');

// 5) ląd i morze
check(seaSpots().every((s) => !isLand(s.x, s.y)), `wszystkie ${seaSpots().length} akweny leżą na morzu`);
check(isLand(...toXY(21, 52.2)) && isLand(...toXY(15, 61)) && isLand(...toXY(-1.5, 52.5)) && !isLand(...toXY(3, 56)) && !isLand(...toXY(18, 56)), 'Warszawa, Szwecja, Anglia – ląd; Morze Północne i Bałtyk – morze');

// 6) pytania z mapy: poprawna odpowiedź jest wśród opcji, kierunek wyraźnie w sektorze
const kinds = {};
let bad = [];
for (let s = 1; s <= 240; s++) {
  const q = makeMapQuestion(s);
  kinds[q.kind] = (kinds[q.kind] || 0) + 1;
  if (q.options) { if (!q.options.some((o) => o.id === q.answer)) bad.push(`${s}:${q.kind}`); }
  else if (!DIR8.includes(q.answer)) bad.push(`${s}:${q.kind}`);
  if (q.kind === 'dir') { const w = windAt(q.S, q.A.x, q.A.y); if (dir8(w.from) !== q.answer) bad.push(`${s}:dir`); }
  if (q.kind === 'front' && !frontZone(q.S, q.A.x, q.A.y)) bad.push(`${s}:front`);
  if (isLand(q.A.x, q.A.y)) bad.push(`${s}:land`);
}
check(bad.length === 0, `240 pytań z mapy poprawnych (${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')})${bad.length ? ': ' + bad.slice(0, 6).join(' ') : ''}`);
check(Object.keys(kinds).length >= 6, 'wszystkie rodzaje pytań z mapy występują');
const zones = {}; for (let s = 1; s <= 200; s++) { const q = makeMapQuestion(s, 'front'); zones[q.zone] = (zones[q.zone] || 0) + 1; }
check(['ahead', 'warm', 'behind'].every((z) => zones[z] > 5), `pytania o fronty w różnych strefach: ${JSON.stringify(zones)}`);

// 7) barograf: tendencja zgodna z rodzajem zapisu
const tb = {};
let baroOk = true;
for (let s = 1; s <= 200; s++) {
  const q = makeBaroQuestion(s); tb[q.kind] = (tb[q.kind] || 0) + 1;
  if (!q.options.some((o) => o.id === q.answer)) baroOk = false;
  if (q.kind === 'fastFall' && q.d3 > -3.5) baroOk = false;
  if (q.kind === 'fastRise' && q.d3 < 3.5) baroOk = false;
  if (q.kind === 'slowFall' && (q.d3 > -0.1 || q.d3 < -3.5)) baroOk = false;
  if (q.kind === 'steadyHigh' && Math.abs(q.d3) > 1.5) baroOk = false;
  if (q.kind === 'frontPass' && q.d3 < 1) baroOk = false;
}
check(baroOk && Object.keys(tb).length === 6, `barograf: tendencje zgodne z opisem (${JSON.stringify(tb)})`);
check(tendencyText(-7) === 'bardzo szybko spada' && tendencyText(2) === 'rośnie' && tendencyText(0.05) === 'bez zmian', 'nazwy tendencji ciśnienia');

// 8) zjawiska: każde pytanie ma poprawną odpowiedź wśród opcji
let phenOk = true;
for (let i = 0; i < PHEN_COUNT; i++) for (let s = 1; s <= 40; s++) { const q = makePhenQuestion(s, i); if (!q.options.some((o) => o.id === q.answer) || new Set(q.options.map((o) => o.id)).size !== q.options.length) { phenOk = false; console.log('  zjawisko', i, s, q.answer, q.options.map((o) => o.id)); } }
check(phenOk, `${PHEN_COUNT} rodzajów pytań o zjawiska – poprawna odpowiedź zawsze wśród opcji, bez powtórek`);
const bq = makeBftQuestion(5), cq = makeCloudQuestion(5);
check(bq.f >= 1 && bq.f <= 10 && cq.options.some((o) => o.id === cq.id) && cq.options.length === 6, 'pytania o skalę Beauforta i chmury');

// 9) teksty po angielsku bez polskich znaków
setLang('en');
const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const en = [];
for (let f = 0; f <= 12; f++) { const b = beaufort(f); en.push(b.name, b.seaText, b.yacht); }
for (const c of clouds()) en.push(c.name, c.look, c.weather, c.levelText, c.meanText);
for (let s = 1; s <= 60; s++) { const q = makeMapQuestion(s); en.push(q.prompt, q.explain, ...(q.options || []).map((o) => o.label)); }
for (let i = 0; i < PHEN_COUNT; i++) { const q = makePhenQuestion(3, i); en.push(q.prompt, q.explain, ...q.options.map((o) => o.label)); }
for (let s = 1; s <= 12; s++) { const q = makeBaroQuestion(s); en.push(q.prompt, q.explain, ...q.options.map((o) => o.label)); }
const plLeft = en.filter((s) => PL.test(s));
check(plLeft.length === 0, `teksty EN bez polskich znaków (${en.length})${plLeft.length ? ': ' + plLeft.slice(0, 3).join(' | ') : ''}`);
setLang('pl');

if (fails) process.exit(1);
console.log('Wszystko OK');
