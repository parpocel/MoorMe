// Zadania nawigacyjne: przeliczanie kursów i namiarów (dewiacja δ, deklinacja d, dryf β, prąd), pozycja z namiarów, zliczenie.
import { getLang } from '../i18n.js';

// Konwencja znaków: poprawki na E (wschód) i dryf w prawo – dodatnie; na W i w lewo – ujemne.
// KK – kurs kompasowy, KM – magnetyczny, KR – rzeczywisty, KDw – kurs drogi nad wodą, KDd – kurs drogi nad dnem.

export const CATEGORIES = {
  compass: 'Kursy: dewiacja i deklinacja',
  table: 'Tabela dewiacji',
  leeway: 'Dryf',
  current: 'Prąd',
  steer: 'Kurs z poprawką na prąd',
  bearing: 'Namiary',
  fix: 'Pozycja z dwóch namiarów',
  dr: 'Zliczenie drogi'
};

const D2R = Math.PI / 180;
const L = (pl, en) => (getLang() === 'en' ? en : pl); // treści zadań są generowane, więc tłumaczymy je od razu
export const norm = (a) => ((a % 360) + 360) % 360;
export const angDiff = (a, b) => ((a - b + 540) % 360) - 180;
const ri = (r, a, b) => Math.round(a + r() * (b - a));
const rf = (r, a, b, k = 1) => Math.round((a + r() * (b - a)) * k) / k;
export const deg3 = (a) => `${String(Math.round(norm(a)) % 360).padStart(3, '0')}°`;
export const signed = (a, dec = 0) => {
  const v = Math.abs(a).toFixed(dec).replace('.', ',');
  return a === 0 ? '0°' : `${v}°${a > 0 ? 'E' : 'W'}`;
};
const signedLR = (a) => (a === 0 ? '0°' : `${a > 0 ? '+' : '−'}${Math.abs(a)}° (${a > 0 ? L('w prawo', 'to starboard') : L('w lewo', 'to port')})`);
const plus = (a, dec = 0) => `${a >= 0 ? '+' : '−'}${Math.abs(a).toFixed(dec).replace('.', ',')}°`;
const num = (x, dec = 1) => x.toFixed(dec).replace('.', ',');
const dm = (deg) => { const d = Math.floor(Math.abs(deg) + 1e-9), m = (Math.abs(deg) - d) * 60; return [d, m]; };
export const fmtLat = (lat) => { const [d, m] = dm(lat); return `${d}°${num(m)}'${lat >= 0 ? 'N' : 'S'}`; };
export const fmtLon = (lon) => { const [d, m] = dm(lon); return `${String(d).padStart(3, '0')}°${num(m)}'${lon >= 0 ? 'E' : 'W'}`; };
const latMin = (lat) => dm(lat)[1], lonMin = (lon) => dm(lon)[1];

// Deklinacja z mapy: wartość z roku bazowego i roczna zmiana
function declination(r, year) {
  const base = rf(r, -6, 7, 2), y0 = ri(r, 2012, 2022), ch = rf(r, -0.2, 0.2, 20);
  const d = Math.round((base + (year - y0) * ch) * 2) / 2;
  const fmtDM = (v) => { const a = Math.abs(v), dd = Math.floor(a + 1e-9), mm = Math.round((a - dd) * 60); return `${dd}°${String(mm).padStart(2, '0')}'${v >= 0 ? 'E' : 'W'}`; };
  return { d, text: `${fmtDM(base)} (${y0}), ${L('zmiana roczna', 'annual change')} ${fmtDM(ch)}`, steps: `d = ${num(base, 1)}° + (${year} − ${y0}) · ${num(ch, 2)}° = ${num(base + (year - y0) * ch, 2)}° ≈ ${signed(d, 1)}` };
}

// Tabela dewiacji (δ w funkcji KK), co 45°
function devTable(r) {
  const A = rf(r, -1, 1), B = rf(r, 2, 5), C = rf(r, -3, 3), ph = r() * 360;
  const rows = [];
  for (let k = 0; k < 360; k += 45) rows.push([k, Math.round(A + B * Math.sin((k + ph) * D2R) + C * Math.cos(2 * k * D2R))]);
  const at = (kk) => {
    const a = norm(kk), i = Math.floor(a / 45), t = (a - i * 45) / 45;
    return rows[i][1] + (rows[(i + 1) % 8][1] - rows[i][1]) * t;
  };
  return { rows, at };
}

// wektory: kurs (°) i prędkość → składowe (N, E)
const vec = (c, v) => [Math.cos(c * D2R) * v, Math.sin(c * D2R) * v];
const course = ([n, e]) => norm(Math.atan2(e, n) / D2R);

const YEAR = 2026;
const BASE = { lat: 54 + 25 / 60, lon: 18 + 35 / 60 };

const ans = (key, label, value, kind, tol) => ({ key, label, value, kind, tol });

export const GENERATORS = {
  compass(r) {
    const KK = ri(r, 0, 359), dev = ri(r, -6, 6), dec = declination(r, YEAR);
    const KM = norm(KK + dev), KR = norm(KM + dec.d);
    return {
      cat: 'compass',
      text: L(`Jacht płynie kursem kompasowym KK = ${deg3(KK)}. Dewiacja dla tego kursu wynosi δ = ${signed(dev)}. Deklinacja z mapy: ${dec.text}. Oblicz kurs magnetyczny i rzeczywisty w roku ${YEAR}.`, `The yacht is steering a compass course KK = ${deg3(KK)}. Deviation on this heading is δ = ${signed(dev)}. Variation from the chart: ${dec.text}. Find the magnetic and true course in ${YEAR}.`),
      answers: [ans('KM', 'KM', KM, 'deg', 1), ans('KR', 'KR', KR, 'deg', 1)],
      steps: [`KM = KK + δ = ${deg3(KK)} ${plus(dev)} = ${deg3(KM)}`, dec.steps, `KR = KM + d = ${deg3(KM)} ${plus(dec.d, 1)} = ${deg3(KR)}`, L(`(poprawka całkowita p = δ + d = ${plus(dev + dec.d, 1)})`, `(total correction p = δ + d = ${plus(dev + dec.d, 1)})`)]
    };
  },
  table(r) {
    const tab = devTable(r), dec = declination(r, YEAR), KR = ri(r, 0, 359);
    const KM = norm(KR - dec.d);
    let KK = norm(KM - tab.at(KM));
    KK = norm(KM - tab.at(KK));
    const dev = Math.round(tab.at(KK) * 10) / 10;
    return {
      cat: 'table',
      text: L(`Trzeba płynąć kursem rzeczywistym KR = ${deg3(KR)}. Deklinacja: ${dec.text}. Dewiację odczytaj z tabeli (interpoluj liniowo). Jaki kurs kompasowy podać sternikowi?`, `You need to steer a true course KR = ${deg3(KR)}. Variation: ${dec.text}. Read the deviation from the table (interpolate linearly). What compass course do you give the helmsman?`),
      table: { head: ['KK', 'δ'], rows: tab.rows.map(([k, v]) => [deg3(k), signed(v)]) },
      answers: [ans('KM', 'KM', KM, 'deg', 1), ans('KK', 'KK', KK, 'deg', 1)],
      steps: [dec.steps, `KM = KR − d = ${deg3(KR)} − (${plus(dec.d, 1)}) = ${deg3(KM)}`, L(`δ zależy od KK, więc liczymy kolejnymi przybliżeniami: δ(KM) ≈ ${plus(tab.at(KM), 1)} → KK ≈ ${deg3(KM - tab.at(KM))}`, `δ depends on KK, so iterate: δ(KM) ≈ ${plus(tab.at(KM), 1)} → KK ≈ ${deg3(KM - tab.at(KM))}`), `δ(KK) ≈ ${plus(dev, 1)} → KK = KM − δ = ${deg3(KK)}`]
    };
  },
  leeway(r) {
    const KK = ri(r, 0, 359), dev = ri(r, -5, 5), d = rf(r, -6, 6, 2), p = dev + d, KR = norm(KK + p);
    const side = r() < 0.5 ? 1 : -1, windFrom = norm(KR + side * -ri(r, 50, 130)), beta = ri(r, 3, 12) * side;
    const KDw = norm(KR + beta);
    return {
      cat: 'leeway',
      text: L(`KK = ${deg3(KK)}, δ = ${signed(dev)}, d = ${signed(d, 1)}. Wiatr wieje z kierunku ${deg3(windFrom)} i znosi jacht o ${Math.abs(beta)}°. Oblicz kurs rzeczywisty i kurs drogi nad wodą (KDw).`, `KK = ${deg3(KK)}, δ = ${signed(dev)}, d = ${signed(d, 1)}. The wind blows from ${deg3(windFrom)} and causes ${Math.abs(beta)}° of leeway. Find the true course and the course through the water (KDw).`),
      answers: [ans('KR', 'KR', KR, 'deg', 1), ans('KDw', 'KDw', KDw, 'deg', 1)],
      steps: [`KR = KK + δ + d = ${deg3(KK)} ${plus(dev)} ${plus(d, 1)} = ${deg3(KR)}`, L(`Wiatr wieje z ${side > 0 ? 'lewej' : 'prawej'} burty, więc znosi jacht w ${side > 0 ? 'prawo' : 'lewo'}: β = ${signedLR(beta)}`, `The wind is on the ${side > 0 ? 'port' : 'starboard'} side, so leeway is to ${side > 0 ? 'starboard' : 'port'}: β = ${signedLR(beta)}`), `KDw = KR + β = ${deg3(KR)} ${plus(beta)} = ${deg3(KDw)}`]
    };
  },
  current(r) {
    const KR = ri(r, 0, 359), V = rf(r, 4, 7, 2), set = ri(r, 0, 359), c = rf(r, 0.6, 2.4, 10), beta = r() < 0.5 ? 0 : ri(r, -6, 6);
    const KDw = norm(KR + beta), w = vec(KDw, V), cv = vec(set, c), g = [w[0] + cv[0], w[1] + cv[1]];
    const KDd = course(g), SOG = Math.hypot(g[0], g[1]);
    return {
      cat: 'current',
      text: L(`Jacht płynie KR = ${deg3(KR)} z prędkością po wodzie ${num(V)} kn${beta ? `, dryf β = ${signedLR(beta)}` : ''}. Prąd o kierunku ${deg3(set)} (dokąd płynie) i prędkości ${num(c)} kn. Oblicz kurs drogi nad dnem (KDd) i prędkość nad dnem (SOG).`, `The yacht steers KR = ${deg3(KR)} at ${num(V)} kn through the water${beta ? `, leeway β = ${signedLR(beta)}` : ''}. The current sets ${deg3(set)} (towards) at ${num(c)} kn. Find the course over ground (KDd) and speed over ground (SOG).`),
      answers: [ans('KDd', 'KDd', KDd, 'deg', 1.5), ans('SOG', 'SOG', SOG, 'kn', 0.15)],
      steps: [beta ? `KDw = KR + β = ${deg3(KDw)}` : L(`Bez dryfu: KDw = KR = ${deg3(KDw)}`, `No leeway: KDw = KR = ${deg3(KDw)}`),
        L(`Wektor po wodzie: N ${num(w[0], 2)}, E ${num(w[1], 2)} kn; prąd: N ${num(cv[0], 2)}, E ${num(cv[1], 2)} kn`, `Water vector: N ${num(w[0], 2)}, E ${num(w[1], 2)} kn; current: N ${num(cv[0], 2)}, E ${num(cv[1], 2)} kn`),
        L(`Suma: N ${num(g[0], 2)}, E ${num(g[1], 2)} → KDd = ${deg3(KDd)}, SOG = ${num(SOG, 2)} kn`, `Sum: N ${num(g[0], 2)}, E ${num(g[1], 2)} → KDd = ${deg3(KDd)}, SOG = ${num(SOG, 2)} kn`)],
      diagram: { kind: 'current', KDw, V, set, c, KDd, SOG }
    };
  },
  steer(r) {
    const KDd = ri(r, 0, 359), V = rf(r, 4.5, 7, 2), set = ri(r, 0, 359), c = rf(r, 0.6, 2, 10), dev = ri(r, -4, 4), d = rf(r, -5, 5, 2);
    const alpha = Math.asin(Math.max(-0.95, Math.min(0.95, (c * Math.sin((set - KDd) * D2R)) / V))) / D2R;
    const KDw = norm(KDd - alpha), w = vec(KDw, V), cv = vec(set, c), SOG = Math.hypot(w[0] + cv[0], w[1] + cv[1]);
    const KR = KDw, KK = norm(KR - dev - d);
    return {
      cat: 'steer',
      text: L(`Cel leży w kierunku ${deg3(KDd)} (KDd). Prędkość po wodzie ${num(V)} kn, prąd ${deg3(set)} / ${num(c)} kn, bez dryfu. δ = ${signed(dev)}, d = ${signed(d, 1)}. Jaki kurs rzeczywisty i kompasowy trzymać, żeby iść po linii do celu? Jaka będzie SOG?`, `The destination bears ${deg3(KDd)} (KDd). Speed through the water ${num(V)} kn, current ${deg3(set)} / ${num(c)} kn, no leeway. δ = ${signed(dev)}, d = ${signed(d, 1)}. Which true and compass course must you steer to stay on the track? What will the SOG be?`),
      answers: [ans('KR', 'KR', KR, 'deg', 1.5), ans('KK', 'KK', KK, 'deg', 1.5), ans('SOG', 'SOG', SOG, 'kn', 0.15)],
      steps: [L(`Kąt poprawki na prąd: sin α = c · sin(kierunek prądu − KDd) / V = ${num(c)} · sin(${Math.round(angDiff(set, KDd))}°) / ${num(V)} → α = ${num(alpha, 1)}°`, `Current correction angle: sin α = c · sin(set − KDd) / V = ${num(c)} · sin(${Math.round(angDiff(set, KDd))}°) / ${num(V)} → α = ${num(alpha, 1)}°`),
        `KR = KDd − α = ${deg3(KDd)} − (${num(alpha, 1)}°) = ${deg3(KR)}`, `KK = KR − δ − d = ${deg3(KR)} − (${plus(dev)}) − (${plus(d, 1)}) = ${deg3(KK)}`, L(`SOG = |wektor po wodzie + prąd| = ${num(SOG, 2)} kn`, `SOG = |water vector + current| = ${num(SOG, 2)} kn`)],
      diagram: { kind: 'current', KDw, V, set, c, KDd: course([w[0] + cv[0], w[1] + cv[1]]), SOG }
    };
  },
  bearing(r) {
    const KK = ri(r, 0, 359), dev = ri(r, -5, 5), d = rf(r, -6, 6, 2), NK = ri(r, 0, 359);
    const NR = norm(NK + dev + d), back = norm(NR + 180), rel = norm(NR - norm(KK + dev + d));
    return {
      cat: 'bearing',
      text: L(`Na kursie KK = ${deg3(KK)} (δ = ${signed(dev)}, d = ${signed(d, 1)}) zmierzono namiar kompasowy latarni NK = ${deg3(NK)}. Oblicz namiar rzeczywisty, namiar zwrotny (z latarni na jacht) i kąt kursowy latarni.`, `On compass course KK = ${deg3(KK)} (δ = ${signed(dev)}, d = ${signed(d, 1)}) a lighthouse bears NK = ${deg3(NK)} by compass. Find the true bearing, the reciprocal bearing (from the lighthouse to the yacht) and the relative bearing of the lighthouse.`),
      answers: [ans('NR', 'NR', NR, 'deg', 1), ans('NZ', L('Namiar zwrotny', 'Reciprocal'), back, 'deg', 1), ans('KKu', L('Kąt kursowy', 'Relative bearing'), rel, 'deg', 1)],
      steps: [L(`Dewiacja dotyczy kursu jachtu, więc p = δ + d = ${plus(dev + d, 1)} obowiązuje dla wszystkich namiarów kompasowych na tym kursie`, `Deviation depends on the yacht's heading, so p = δ + d = ${plus(dev + d, 1)} applies to all compass bearings taken on this heading`),
        `NR = NK + p = ${deg3(NK)} ${plus(dev + d, 1)} = ${deg3(NR)}`, L(`Namiar zwrotny = NR ± 180° = ${deg3(back)}`, `Reciprocal = NR ± 180° = ${deg3(back)}`), L(`KR = KK + p = ${deg3(KK + dev + d)}; kąt kursowy = NR − KR = ${deg3(rel)}`, `KR = KK + p = ${deg3(KK + dev + d)}; relative bearing = NR − KR = ${deg3(rel)}`)]
    };
  },
  fix(r) {
    // prawdziwa pozycja i dwa obiekty w odległości 2–6 Mm
    const P = { lat: BASE.lat + rf(r, -0.1, 0.1, 600), lon: BASE.lon + rf(r, -0.15, 0.15, 600) };
    const b1 = ri(r, 0, 359), b2 = norm(b1 + (r() < 0.5 ? 1 : -1) * ri(r, 50, 130));
    const cl = Math.cos(P.lat * D2R);
    const obj = (brg, dist) => ({ lat: P.lat + (Math.cos(brg * D2R) * dist) / 60, lon: P.lon + (Math.sin(brg * D2R) * dist) / 60 / cl });
    const A = obj(b1, rf(r, 2, 6, 10)), B = obj(b2, rf(r, 2, 6, 10));
    const dev = ri(r, -4, 4), d = rf(r, -5, 5, 2), p = dev + d;
    const NK1 = norm(Math.round(b1 - p)), NK2 = norm(Math.round(b2 - p));
    const NR1 = norm(NK1 + p), NR2 = norm(NK2 + p);
    // rozwiązanie z zaokrąglonych namiarów (tak jak zrobi to nawigator)
    const sol = intersect(A, NR1, B, NR2);
    return {
      cat: 'fix',
      text: L(`Zmierzono namiary kompasowe: latarnia A (${fmtLat(A.lat)}, ${fmtLon(A.lon)}) NK = ${deg3(NK1)}, latarnia B (${fmtLat(B.lat)}, ${fmtLon(B.lon)}) NK = ${deg3(NK2)}. Poprawka: δ = ${signed(dev)}, d = ${signed(d, 1)}. Wyznacz pozycję jachtu (podaj minuty szerokości i długości).`, `Compass bearings taken: lighthouse A (${fmtLat(A.lat)}, ${fmtLon(A.lon)}) NK = ${deg3(NK1)}, lighthouse B (${fmtLat(B.lat)}, ${fmtLon(B.lon)}) NK = ${deg3(NK2)}. Corrections: δ = ${signed(dev)}, d = ${signed(d, 1)}. Fix the yacht's position (give the minutes of latitude and longitude).`),
      answers: [ans('latm', `${L('Szerokość', 'Latitude')} ${Math.floor(sol.lat)}°`, latMin(sol.lat), 'min', 0.25), ans('lonm', `${L('Długość', 'Longitude')} ${String(Math.floor(sol.lon)).padStart(3, '0')}°`, lonMin(sol.lon), 'min', 0.35)],
      steps: [`NR_A = ${deg3(NK1)} ${plus(p, 1)} = ${deg3(NR1)}, NR_B = ${deg3(NK2)} ${plus(p, 1)} = ${deg3(NR2)}`,
        L(`Linie pozycyjne kreślimy z latarni w kierunkach zwrotnych: ${deg3(NR1 + 180)} od A i ${deg3(NR2 + 180)} od B`, `Plot the position lines from the lighthouses along the reciprocals: ${deg3(NR1 + 180)} from A and ${deg3(NR2 + 180)} from B`),
        L(`Przecięcie linii: ${fmtLat(sol.lat)}, ${fmtLon(sol.lon)}`, `Intersection: ${fmtLat(sol.lat)}, ${fmtLon(sol.lon)}`)],
      diagram: { kind: 'fix', A, B, NR1, NR2, P: sol },
      plot: { pts: [{ label: 'A', ...A }, { label: 'B', ...B }], sol: { lines: [{ p: A, brg: NR1 }, { p: B, brg: NR2 }], point: sol } }
    };
  },
  dr(r) {
    const P = { lat: BASE.lat + rf(r, -0.08, 0.05, 600), lon: BASE.lon + rf(r, -0.15, 0.05, 600) };
    const KDd = ri(r, 0, 359), SOG = rf(r, 3.5, 7, 2), mins = ri(r, 4, 16) * 5;
    const dist = (SOG * mins) / 60, cl = Math.cos(P.lat * D2R);
    const E = { lat: P.lat + (Math.cos(KDd * D2R) * dist) / 60, lon: P.lon + (Math.sin(KDd * D2R) * dist) / 60 / cl };
    const hh = Math.floor(mins / 60), mm = mins % 60;
    return {
      cat: 'dr',
      text: L(`O 10:00 jacht był na pozycji ${fmtLat(P.lat)}, ${fmtLon(P.lon)}. Płynie KDd = ${deg3(KDd)} z SOG ${num(SOG)} kn. Oblicz przebytą drogę i pozycję zliczoną na ${String(10 + hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}.`, `At 10:00 the yacht was at ${fmtLat(P.lat)}, ${fmtLon(P.lon)}. She makes good KDd = ${deg3(KDd)} at SOG ${num(SOG)} kn. Find the distance run and the dead-reckoning position at ${String(10 + hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}.`),
      answers: [ans('dist', L('Droga', 'Distance'), dist, 'nm', 0.06), ans('latm', `${L('Szerokość', 'Latitude')} ${Math.floor(E.lat)}°`, latMin(E.lat), 'min', 0.2), ans('lonm', `${L('Długość', 'Longitude')} ${String(Math.floor(E.lon)).padStart(3, '0')}°`, lonMin(E.lon), 'min', 0.3)],
      steps: [L(`Droga = SOG · t = ${num(SOG)} kn · ${num(mins / 60, 3)} h = ${num(dist, 2)} Mm`, `Distance = SOG · t = ${num(SOG)} kn · ${num(mins / 60, 3)} h = ${num(dist, 2)} NM`),
        L(`Δφ = d · cos KDd = ${num(dist * Math.cos(KDd * D2R), 2)}' ; odejście = d · sin KDd = ${num(dist * Math.sin(KDd * D2R), 2)} Mm`, `Δφ = d · cos KDd = ${num(dist * Math.cos(KDd * D2R), 2)}' ; departure = d · sin KDd = ${num(dist * Math.sin(KDd * D2R), 2)} NM`),
        L(`Δλ = odejście / cos φ = ${num((dist * Math.sin(KDd * D2R)) / cl, 2)}'`, `Δλ = departure / cos φ = ${num((dist * Math.sin(KDd * D2R)) / cl, 2)}'`), L(`Pozycja zliczona: ${fmtLat(E.lat)}, ${fmtLon(E.lon)}`, `DR position: ${fmtLat(E.lat)}, ${fmtLon(E.lon)}`)],
      plot: { pts: [{ label: '10:00', ...P }], sol: { segs: [{ p: P, brg: KDd, dist }], point: E } }
    };
  }
};

// Przecięcie dwóch linii namiarów (płaska aproksymacja w milach morskich)
export function intersect(A, NR1, B, NR2) {
  const cl = Math.cos(((A.lat + B.lat) / 2) * D2R);
  const toXY = (p) => [(p.lon - A.lon) * 60 * cl, (p.lat - A.lat) * 60];
  const [bx, by] = toXY(B);
  // pozycja P = A − s·u1 = B − t·u2, u – wektor namiaru (z jachtu na obiekt)
  const u1 = [Math.sin(NR1 * D2R), Math.cos(NR1 * D2R)], u2 = [Math.sin(NR2 * D2R), Math.cos(NR2 * D2R)];
  // −s·u1 + t·u2 = B − A
  const det = -u1[0] * u2[1] + u2[0] * u1[1];
  const s = (bx * u2[1] - u2[0] * by) / det;
  const x = -s * u1[0], y = -s * u1[1];
  return { lat: A.lat + y / 60, lon: A.lon + x / 60 / cl };
}

export function makeTask(r, cat) {
  const cats = Object.keys(GENERATORS);
  const c = cat && GENERATORS[cat] ? cat : cats[Math.floor(r() * cats.length)];
  return GENERATORS[c](r);
}

// Sprawdzenie odpowiedzi (kąty z zawinięciem 360°)
export function checkAnswer(a, input) {
  const v = parseFloat(String(input).replace(',', '.').replace('°', ''));
  if (!Number.isFinite(v)) return false;
  return a.kind === 'deg' ? Math.abs(angDiff(v, a.value)) <= a.tol + 1e-9 : Math.abs(v - a.value) <= a.tol + 1e-9;
}
export function fmtAnswer(a) {
  return a.kind === 'deg' ? deg3(a.value) : a.kind === 'kn' ? `${num(a.value, 1)} kn` : a.kind === 'nm' ? `${num(a.value, 2)} Mm` : `${num(a.value, 1)}'`;
}
