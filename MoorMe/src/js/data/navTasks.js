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
  fix: 'Pozycja z namiarów',
  dr: 'Zliczenie drogi',
  tsd: 'Czas, prędkość, droga',
  abeam: 'Namiar podwójny i odległość mijania',
  range: 'Zasięg widoczności świateł'
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

const sn = (x, dec) => num(x, dec).replace('-', '−');
// Deklinacja z mapy: wartość z roku bazowego i roczna zmiana
function declination(r, year) {
  const base = rf(r, -6, 7, 2), y0 = ri(r, 2012, 2022), ch = rf(r, -0.2, 0.2, 20);
  const d = Math.round((base + (year - y0) * ch) * 2) / 2;
  const fmtDM = (v) => { const a = Math.abs(v), dd = Math.floor(a + 1e-9), mm = Math.round((a - dd) * 60); return `${dd}°${String(mm).padStart(2, '0')}'${v >= 0 ? 'E' : 'W'}`; };
  return { d, text: `${fmtDM(base)} ${L('w roku', 'in')} ${y0}, ${L('zmiana roczna', 'annual change')} ${fmtDM(ch)}`, steps: `d = ${sn(base, 1)}° + (${year} − ${y0}) · (${sn(ch, 2)}°) = ${sn(base + (year - y0) * ch, 2)}° ≈ ${signed(d, 1)} ${L('(zaokrąglamy do 0,5°)', '(rounded to 0.5°)')}` };
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

// trójkąt prędkości na mapce: wektory odkładane dla 1 godziny (1 kn = 1 Mm); legs – kolejne wektory [N, E] od punktu O
function vectorPlot(r, legs, labels, total) {
  const O = { lat: BASE.lat + rf(r, -0.08, 0.06, 600), lon: BASE.lon + rf(r, -0.12, 0.08, 600) }, cl = Math.cos(O.lat * D2R);
  const at = (p, [n, e]) => ({ lat: p.lat + n / 60, lon: p.lon + e / 60 / cl });
  const pts = [O];
  for (const l of legs) pts.push(at(pts[pts.length - 1], l));
  const end = pts[pts.length - 1];
  const vectors = legs.map((l, i) => ({ from: pts[i], to: pts[i + 1], label: labels[i] }));
  vectors.push({ from: O, to: end, label: total, main: true });
  return { mode: 'vector', pts: [{ label: 'O', ...O }], sol: { vectors, point: end }, variation: rf(r, -6, 6, 2), seed: Math.floor(r() * 1e9) };
}

const BASE_GEN = {
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
      text: L(`Jest rok ${YEAR}. Trzeba płynąć kursem rzeczywistym KR = ${deg3(KR)}. Deklinacja z mapy: ${dec.text} – przelicz ją na rok ${YEAR}. Dewiację odczytaj z tabeli (interpoluj liniowo). Jaki kurs magnetyczny i kompasowy podać sternikowi?`, `The year is ${YEAR}. You need to steer a true course KR = ${deg3(KR)}. Variation from the chart: ${dec.text} – update it to ${YEAR}. Read the deviation from the table (interpolate linearly). Which magnetic and compass course do you give the helmsman?`),
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
      diagram: { kind: 'current', KDw, V, set, c, KDd, SOG },
      plot: vectorPlot(r, [w, cv], [L('po wodzie', 'through water'), L('prąd', 'current')], L('nad dnem', 'over ground'))
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
      diagram: { kind: 'current', KDw, V, set, c, KDd: course([w[0] + cv[0], w[1] + cv[1]]), SOG },
      plot: vectorPlot(r, [cv, w], [L('prąd', 'current'), L('po wodzie (KR)', 'through water (KR)')], L('nad dnem (KDd)', 'over ground (KDd)'))
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
      plot: { pts: [{ label: 'A', light: true, ...A }, { label: 'B', light: true, ...B }], sol: { lines: [{ p: A, brg: NR1 }, { p: B, brg: NR2 }], point: sol }, variation: d, seed: Math.floor(r() * 1e9) }
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
      plot: { pts: [{ label: '10:00', ...P }], sol: { segs: [{ p: P, brg: KDd, dist }], point: E }, variation: rf(r, -6, 6, 2), seed: Math.floor(r() * 1e9) }
    };
  }
};

// ---------- warianty zadań (wariant 0 to zadanie bazowe powyżej) ----------
const move = (p, brg, dist) => { const cl = Math.cos(p.lat * D2R); return { lat: p.lat + (Math.cos(brg * D2R) * dist) / 60, lon: p.lon + (Math.sin(brg * D2R) * dist) / 60 / cl }; };
const rhumb = (a, b) => { const cl = Math.cos(((a.lat + b.lat) / 2) * D2R), dx = (b.lon - a.lon) * 60 * cl, dy = (b.lat - a.lat) * 60; return { brg: course([dy, dx]), dist: Math.hypot(dx, dy) }; };
const startPos = (r) => ({ lat: BASE.lat + rf(r, -0.08, 0.06, 600), lon: BASE.lon + rf(r, -0.12, 0.08, 600) });
export const fmtTime = (m) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const sgn1 = (a) => `${a >= 0 ? '+' : '−'}${num(Math.abs(a), 1)}°`;
const side = (s) => (s > 0 ? L('prawej burty', 'starboard') : L('lewej burty', 'port'));

const VAR_GEN = {
  compass: [
    // odwrotnie: z KR do KK
    (r) => {
      const KR = ri(r, 0, 359), dev = ri(r, -6, 6), dec = declination(r, YEAR), KM = norm(KR - dec.d), KK = norm(KM - dev);
      return {
        cat: 'compass',
        text: L(`Z mapy wykreślono kurs rzeczywisty KR = ${deg3(KR)}. Deklinacja: ${dec.text}. Dewiacja na tym kursie δ = ${signed(dev)}. Jaki kurs magnetyczny i kompasowy podasz sternikowi w roku ${YEAR}?`, `The true course laid off on the chart is KR = ${deg3(KR)}. Variation: ${dec.text}. Deviation on this heading δ = ${signed(dev)}. Which magnetic and compass course do you give the helmsman in ${YEAR}?`),
        answers: [ans('KM', 'KM', KM, 'deg', 1), ans('KK', 'KK', KK, 'deg', 1)],
        steps: [dec.steps, `KM = KR − d = ${deg3(KR)} − (${plus(dec.d, 1)}) = ${deg3(KM)}`, `KK = KM − δ = ${deg3(KM)} − (${plus(dev)}) = ${deg3(KK)}`, L('Od kursu rzeczywistego do kompasowego poprawki odejmujemy (ze znakiem).', 'Going from true to compass, subtract the corrections (with their signs).')]
      };
    },
    // dewiacja z nabieżnika
    (r) => {
      const NRn = ri(r, 0, 359), d = rf(r, -6, 6, 2), dev = ri(r, -7, 7), KK = norm(NRn + ri(r, -40, 40)), NK = norm(Math.round(NRn - d - dev)), p = norm(NRn - NK + 180) - 180, devC = Math.round((p - d) * 10) / 10;
      return {
        cat: 'compass',
        text: L(`Płynąc kursem KK = ${deg3(KK)}, przeciąłeś linię nabieżnika o kierunku z mapy ${deg3(NRn)}. W chwili, gdy znaki nabieżnika były w linii, namiar kompasowy wynosił NK = ${deg3(NK)}. Deklinacja d = ${signed(d, 1)}. Oblicz poprawkę całkowitą i dewiację na tym kursie (E dodatnio, W ujemnie).`, `Steering KK = ${deg3(KK)} you crossed a transit whose charted direction is ${deg3(NRn)}. When the marks were in line the compass bearing was NK = ${deg3(NK)}. Variation d = ${signed(d, 1)}. Find the total correction and the deviation on this heading (E positive, W negative).`),
        answers: [ans('p', L('Poprawka p', 'Correction p'), p, 'sdeg', 0.6), ans('dev', 'δ', devC, 'sdeg', 0.6)],
        steps: [`p = NR − NK = ${deg3(NRn)} − ${deg3(NK)} = ${sgn1(p)}`, `δ = p − d = ${sgn1(p)} − (${plus(d, 1)}) = ${sgn1(devC)} (${signed(devC, 1)})`, L('Nabieżnik daje namiar rzeczywisty bez pomiaru pozycji – najprostszy sposób sprawdzenia dewiacji.', 'A transit gives a true bearing without needing a position – the simplest way to check deviation.')]
      };
    }
  ],
  leeway: [
    (r) => {
      const KDw = ri(r, 0, 359), dev = ri(r, -5, 5), d = rf(r, -6, 6, 2), s1 = r() < 0.5 ? 1 : -1, beta = ri(r, 3, 12) * s1, windFrom = norm(KDw - beta + s1 * -ri(r, 50, 130));
      const KR = norm(KDw - beta), KK = norm(KR - dev - d);
      return {
        cat: 'leeway',
        text: L(`Chcesz przejść po wodzie linią KDw = ${deg3(KDw)}. Wiatr wieje z kierunku ${deg3(windFrom)} i znosi jacht o ${Math.abs(beta)}°. δ = ${signed(dev)}, d = ${signed(d, 1)}. Jaki kurs rzeczywisty i kompasowy trzymać?`, `You want to make good KDw = ${deg3(KDw)} through the water. The wind blows from ${deg3(windFrom)} with ${Math.abs(beta)}° of leeway. δ = ${signed(dev)}, d = ${signed(d, 1)}. Which true and compass course do you steer?`),
        answers: [ans('KR', 'KR', KR, 'deg', 1), ans('KK', 'KK', KK, 'deg', 1)],
        steps: [L(`Wiatr z ${s1 > 0 ? 'lewej' : 'prawej'} burty znosi w ${s1 > 0 ? 'prawo' : 'lewo'}: β = ${signedLR(beta)}, więc trzeba trzymać ${s1 > 0 ? 'lewiej' : 'prawiej'} (pod wiatr)`, `Wind on the ${s1 > 0 ? 'port' : 'starboard'} side gives leeway to ${s1 > 0 ? 'starboard' : 'port'}: β = ${signedLR(beta)}, so steer ${s1 > 0 ? 'to port' : 'to starboard'} of the track (into the wind)`),
          `KR = KDw − β = ${deg3(KDw)} − (${plus(beta)}) = ${deg3(KR)}`, `KK = KR − δ − d = ${deg3(KR)} − (${plus(dev)}) − (${plus(d, 1)}) = ${deg3(KK)}`]
      };
    }
  ],
  current: [
    // prąd z pozycji zliczonej i obserwowanej
    (r) => {
      const O = startPos(r), KR = ri(r, 0, 359), V = rf(r, 4, 7, 2), hrs = [1.5, 2, 2.5, 3][ri(r, 0, 3)], set = ri(r, 0, 359), c = rf(r, 0.5, 2, 10);
      const DR = move(O, KR, V * hrs), F = move(DR, set, c * hrs), t0 = ri(r, 8, 12) * 60, cr = rhumb(DR, F);
      return {
        cat: 'current',
        text: L(`O ${fmtTime(t0)} jacht był na pozycji ${fmtLat(O.lat)}, ${fmtLon(O.lon)}. Płynął KR = ${deg3(KR)} z prędkością po wodzie ${num(V)} kn, bez dryfu. O ${fmtTime(t0 + hrs * 60)} pozycja obserwowana: ${fmtLat(F.lat)}, ${fmtLon(F.lon)}. Wyznacz kierunek i prędkość prądu.`, `At ${fmtTime(t0)} the yacht was at ${fmtLat(O.lat)}, ${fmtLon(O.lon)}. She steered KR = ${deg3(KR)} at ${num(V)} kn through the water, no leeway. At ${fmtTime(t0 + hrs * 60)} the observed position was ${fmtLat(F.lat)}, ${fmtLon(F.lon)}. Find the set and rate of the current.`),
        answers: [ans('set', L('Kierunek prądu', 'Set'), cr.brg, 'deg', 3), ans('c', L('Prędkość prądu', 'Rate'), cr.dist / hrs, 'kn', 0.15)],
        steps: [L(`Pozycja zliczona: z punktu startu odłóż KR ${deg3(KR)} i drogę ${num(V)} · ${num(hrs, 1)} h = ${num(V * hrs, 2)} Mm → ${fmtLat(DR.lat)}, ${fmtLon(DR.lon)}`, `DR position: from the start lay off KR ${deg3(KR)} and ${num(V)} · ${num(hrs, 1)} h = ${num(V * hrs, 2)} NM → ${fmtLat(DR.lat)}, ${fmtLon(DR.lon)}`),
          L(`Prąd to wektor od pozycji zliczonej do obserwowanej: ${deg3(cr.brg)}, ${num(cr.dist, 2)} Mm w ${num(hrs, 1)} h`, `The current is the vector from the DR to the observed position: ${deg3(cr.brg)}, ${num(cr.dist, 2)} NM in ${num(hrs, 1)} h`),
          L(`Prędkość prądu = ${num(cr.dist, 2)} / ${num(hrs, 1)} = ${num(cr.dist / hrs, 2)} kn`, `Rate = ${num(cr.dist, 2)} / ${num(hrs, 1)} = ${num(cr.dist / hrs, 2)} kn`)],
        plot: { pts: [{ label: fmtTime(t0), ...O }, { label: `${L('obs.', 'obs.')} ${fmtTime(t0 + hrs * 60)}`, ...F }], sol: { vectors: [{ from: O, to: DR, label: L('po wodzie', 'through water'), unit: 'Mm' }, { from: DR, to: F, label: L('prąd', 'current'), unit: 'Mm', main: true }], point: F }, variation: rf(r, -6, 6, 2), seed: Math.floor(r() * 1e9) }
      };
    }
  ],
  steer: [
    // kurs na prąd i czas dojścia
    (r) => {
      const O = startPos(r), KDd = ri(r, 0, 359), V = rf(r, 4.5, 7, 2), set = ri(r, 0, 359), c = rf(r, 0.6, 2, 10), D = rf(r, 6, 18, 2), t0 = ri(r, 7 * 12, 13 * 12) * 5;
      const alpha = Math.asin(Math.max(-0.95, Math.min(0.95, (c * Math.sin((set - KDd) * D2R)) / V))) / D2R;
      const KR = norm(KDd - alpha), w = vec(KR, V), cv = vec(set, c), SOG = Math.hypot(w[0] + cv[0], w[1] + cv[1]), ETA = t0 + (D / SOG) * 60;
      return {
        cat: 'steer',
        text: L(`Jest ${fmtTime(t0)}. Główki portu leżą ${num(D)} Mm od jachtu w kierunku ${deg3(KDd)}. Prędkość po wodzie ${num(V)} kn, prąd ${deg3(set)} / ${num(c)} kn, bez dryfu. Jaki KR trzymać, jaka będzie SOG i o której wejdziesz do portu?`, `It is ${fmtTime(t0)}. The harbour entrance lies ${num(D)} NM away, bearing ${deg3(KDd)}. Speed through the water ${num(V)} kn, current ${deg3(set)} / ${num(c)} kn, no leeway. Which KR do you steer, what will the SOG be and when do you reach the entrance?`),
        answers: [ans('KR', 'KR', KR, 'deg', 1.5), ans('SOG', 'SOG', SOG, 'kn', 0.15), ans('ETA', L('Godzina', 'Time'), ETA, 'hm', 4)],
        steps: [L(`sin α = c · sin(kierunek prądu − KDd) / V → α = ${num(alpha, 1)}°, KR = KDd − α = ${deg3(KR)}`, `sin α = c · sin(set − KDd) / V → α = ${num(alpha, 1)}°, KR = KDd − α = ${deg3(KR)}`),
          L(`SOG = ${num(SOG, 2)} kn (trójkąt prędkości)`, `SOG = ${num(SOG, 2)} kn (velocity triangle)`), L(`Czas = ${num(D)} / ${num(SOG, 2)} = ${num(D / SOG, 2)} h = ${Math.round((D / SOG) * 60)} min → ${fmtTime(ETA)}`, `Time = ${num(D)} / ${num(SOG, 2)} = ${num(D / SOG, 2)} h = ${Math.round((D / SOG) * 60)} min → ${fmtTime(ETA)}`)],
        diagram: { kind: 'current', KDw: KR, V, set, c, KDd: course([w[0] + cv[0], w[1] + cv[1]]), SOG },
        plot: vectorPlot(r, [cv, w], [L('prąd', 'current'), L('po wodzie (KR)', 'through water (KR)')], L('nad dnem (KDd)', 'over ground (KDd)'))
      };
    }
  ],
  bearing: [
    // kąt kursowy → namiar rzeczywisty
    (r) => {
      const KR = ri(r, 0, 359), q = ri(r, 10, 170), s1 = r() < 0.5 ? 1 : -1, NR = norm(KR + s1 * q), NZ = norm(NR + 180);
      return {
        cat: 'bearing',
        text: L(`Płyniesz KR = ${deg3(KR)}. Latarnię widać w kącie kursowym ${q}° ${side(s1)}. Oblicz namiar rzeczywisty latarni i namiar zwrotny (z latarni na jacht).`, `You are steering KR = ${deg3(KR)}. A lighthouse is seen ${q}° on the ${side(s1)} bow. Find its true bearing and the reciprocal (from the lighthouse to the yacht).`),
        answers: [ans('NR', 'NR', NR, 'deg', 1), ans('NZ', L('Namiar zwrotny', 'Reciprocal'), NZ, 'deg', 1)],
        steps: [L(`Kąt kursowy prawej burty dodajemy do kursu, lewej – odejmujemy: NR = ${deg3(KR)} ${s1 > 0 ? '+' : '−'} ${q}° = ${deg3(NR)}`, `Add a starboard relative bearing to the course, subtract a port one: NR = ${deg3(KR)} ${s1 > 0 ? '+' : '−'} ${q}° = ${deg3(NR)}`), L(`Namiar zwrotny = NR ± 180° = ${deg3(NZ)}`, `Reciprocal = NR ± 180° = ${deg3(NZ)}`)]
      };
    },
    // namiar rzeczywisty z mapy → namiar kompasowy do obserwacji (np. namiar bezpieczeństwa)
    (r) => {
      const NR = ri(r, 0, 359), KK = ri(r, 0, 359), dev = ri(r, -6, 6), d = rf(r, -6, 6, 2), NK = norm(NR - dev - d);
      return {
        cat: 'bearing',
        text: L(`Na mapie wykreśliłeś namiar bezpieczeństwa: dopóki latarnia jest na namiarze rzeczywistym mniejszym niż ${deg3(NR)}, omijasz mieliznę. Płyniesz KK = ${deg3(KK)}, δ = ${signed(dev)}, d = ${signed(d, 1)}. Jaki namiar kompasowy odpowiada tej granicy?`, `You have drawn a clearing bearing: while the lighthouse bears less than ${deg3(NR)} true you are clear of the shoal. You are steering KK = ${deg3(KK)}, δ = ${signed(dev)}, d = ${signed(d, 1)}. Which compass bearing corresponds to this limit?`),
        answers: [ans('NK', 'NK', NK, 'deg', 1)],
        steps: [L(`Poprawka dla kursu jachtu p = δ + d = ${plus(dev + d, 1)}`, `Correction for the yacht's heading p = δ + d = ${plus(dev + d, 1)}`), `NK = NR − p = ${deg3(NR)} − (${plus(dev + d, 1)}) = ${deg3(NK)}`]
      };
    }
  ],
  fix: [
    // namiar i odległość z radaru od jednego obiektu
    (r) => {
      const P = { lat: BASE.lat + rf(r, -0.1, 0.1, 600), lon: BASE.lon + rf(r, -0.15, 0.15, 600) }, b = ri(r, 0, 359), dist = rf(r, 1.5, 5, 10);
      const A = move(P, b, dist), dev = ri(r, -4, 4), d = rf(r, -5, 5, 2), p = dev + d, NK = norm(Math.round(b - p)), NR = norm(NK + p), sol = move(A, NR + 180, dist);
      return {
        cat: 'fix',
        text: L(`Latarnia A (${fmtLat(A.lat)}, ${fmtLon(A.lon)}): namiar kompasowy NK = ${deg3(NK)}, odległość z radaru ${num(dist)} Mm. Poprawka: δ = ${signed(dev)}, d = ${signed(d, 1)}. Wyznacz pozycję jachtu.`, `Lighthouse A (${fmtLat(A.lat)}, ${fmtLon(A.lon)}): compass bearing NK = ${deg3(NK)}, radar range ${num(dist)} NM. Corrections: δ = ${signed(dev)}, d = ${signed(d, 1)}. Fix the yacht's position.`),
        answers: [ans('latm', `${L('Szerokość', 'Latitude')} ${Math.floor(sol.lat)}°`, latMin(sol.lat), 'min', 0.25), ans('lonm', `${L('Długość', 'Longitude')} ${String(Math.floor(sol.lon)).padStart(3, '0')}°`, lonMin(sol.lon), 'min', 0.35)],
        steps: [`NR = ${deg3(NK)} ${plus(p, 1)} = ${deg3(NR)}`, L(`Z latarni wykreśl linię w kierunku zwrotnym ${deg3(NR + 180)} i okrąg o promieniu ${num(dist)} Mm (narzędzie „Okrąg”)`, `From the lighthouse draw the reciprocal ${deg3(NR + 180)} and a circle of radius ${num(dist)} NM (the “Circle” tool)`), L(`Pozycja: ${fmtLat(sol.lat)}, ${fmtLon(sol.lon)}`, `Position: ${fmtLat(sol.lat)}, ${fmtLon(sol.lon)}`)],
        plot: { pts: [{ label: 'A', light: true, ...A }], sol: { lines: [{ p: A, brg: NR }], circles: [{ p: A, r: dist }], point: sol }, variation: d, seed: Math.floor(r() * 1e9) }
      };
    },
    // dwa namiary niejednoczesne jednego obiektu i przebyta droga (przeniesiona linia pozycyjna)
    (r) => {
      let P2, A, KDd, SOG, mins, P1, b1, b2;
      for (let k = 0; k < 50; k++) {
        P2 = { lat: BASE.lat + rf(r, -0.08, 0.08, 600), lon: BASE.lon + rf(r, -0.12, 0.12, 600) };
        b2 = ri(r, 0, 359); A = move(P2, b2, rf(r, 2, 5, 10));
        KDd = norm(b2 + (r() < 0.5 ? 1 : -1) * ri(r, 55, 125)); SOG = rf(r, 4, 7, 2); mins = ri(r, 4, 12) * 5;
        P1 = move(P2, KDd + 180, (SOG * mins) / 60); b1 = rhumb(P1, A).brg;
        if (Math.abs(angDiff(b1, b2)) >= 30) break;
      }
      const dist = (SOG * mins) / 60, dev = ri(r, -4, 4), d = rf(r, -5, 5, 2), p = dev + d;
      const NK1 = norm(Math.round(b1 - p)), NK2 = norm(Math.round(b2 - p)), NR1 = norm(NK1 + p), NR2 = norm(NK2 + p);
      // przeniesiona linia NR1: przesunięta o drogę d w kierunku KDd; jej przecięcie z NR2 to pozycja o drugim namiarze
      const A1 = move(A, KDd, dist), sol = intersect(A1, NR1, A, NR2);
      const t0 = ri(r, 9 * 12, 15 * 12) * 5;
      return {
        cat: 'fix',
        text: L(`O ${fmtTime(t0)} latarnię A (${fmtLat(A.lat)}, ${fmtLon(A.lon)}) namierzono: NK = ${deg3(NK1)}. Jacht płynie KDd = ${deg3(KDd)} z SOG ${num(SOG)} kn (bez prądu i dryfu). O ${fmtTime(t0 + mins)} tę samą latarnię namierzono ponownie: NK = ${deg3(NK2)}. Poprawka: δ = ${signed(dev)}, d = ${signed(d, 1)}. Wyznacz pozycję obserwowaną o ${fmtTime(t0 + mins)}.`, `At ${fmtTime(t0)} lighthouse A (${fmtLat(A.lat)}, ${fmtLon(A.lon)}) bore NK = ${deg3(NK1)} by compass. The yacht makes good KDd = ${deg3(KDd)} at ${num(SOG)} kn (no current or leeway). At ${fmtTime(t0 + mins)} the same lighthouse bore NK = ${deg3(NK2)}. Corrections: δ = ${signed(dev)}, d = ${signed(d, 1)}. Find the observed position at ${fmtTime(t0 + mins)}.`),
        answers: [ans('latm', `${L('Szerokość', 'Latitude')} ${Math.floor(sol.lat)}°`, latMin(sol.lat), 'min', 0.3), ans('lonm', `${L('Długość', 'Longitude')} ${String(Math.floor(sol.lon)).padStart(3, '0')}°`, lonMin(sol.lon), 'min', 0.4)],
        steps: [`NR₁ = ${deg3(NK1)} ${plus(p, 1)} = ${deg3(NR1)}, NR₂ = ${deg3(NK2)} ${plus(p, 1)} = ${deg3(NR2)}`,
          L(`Droga przebyta między namiarami: d = ${num(SOG)} kn · ${mins} min = ${num(dist, 2)} Mm`, `Distance run between the bearings: d = ${num(SOG)} kn · ${mins} min = ${num(dist, 2)} NM`),
          L(`Wykreśl z latarni linię pierwszego namiaru (kierunek zwrotny ${deg3(NR1 + 180)}). Z dowolnego jej punktu odłóż drogę ${num(dist, 2)} Mm w kierunku KDd ${deg3(KDd)} i przez koniec odcinka poprowadź równoległą do NR₁ – to przeniesiona linia pozycyjna (narzędzia „Kurs i droga” i „Linijka równoległa”).`, `From the lighthouse draw the first position line (reciprocal ${deg3(NR1 + 180)}). From any point on it lay off ${num(dist, 2)} NM along KDd ${deg3(KDd)} and draw a parallel to NR₁ through the end – the transferred position line (the “Course and distance” and “Parallel ruler” tools).`),
          L(`Wykreśl linię drugiego namiaru (kierunek zwrotny ${deg3(NR2 + 180)}). Przecięcie z przeniesioną linią to pozycja obserwowana: ${fmtLat(sol.lat)}, ${fmtLon(sol.lon)}`, `Draw the second position line (reciprocal ${deg3(NR2 + 180)}). Its intersection with the transferred line is the observed position: ${fmtLat(sol.lat)}, ${fmtLon(sol.lon)}`)],
        plot: { pts: [{ label: 'A', light: true, ...A }], sol: { lines: [{ p: A, brg: NR1 }, { p: A1, brg: NR1 }, { p: A, brg: NR2 }], vectors: [{ from: A, to: A1, label: 'd', unit: 'Mm' }], point: sol }, variation: d, seed: Math.floor(r() * 1e9) }
      };
    }
  ],
  dr: [
    // kurs i odległość między dwoma punktami
    (r) => {
      const A = startPos(r), B = move(A, ri(r, 0, 359), rf(r, 3, 9, 10)), rb = rhumb(A, B), SOG = rf(r, 4, 7, 2), t0 = ri(r, 8 * 12, 14 * 12) * 5, ETA = t0 + (rb.dist / SOG) * 60;
      return {
        cat: 'dr',
        text: L(`Jacht jest w punkcie A (${fmtLat(A.lat)}, ${fmtLon(A.lon)}), cel B: ${fmtLat(B.lat)}, ${fmtLon(B.lon)}. Wyznacz kurs drogi nad dnem i odległość do celu. Jest ${fmtTime(t0)}, SOG ${num(SOG)} kn – o której dopłyniesz?`, `The yacht is at A (${fmtLat(A.lat)}, ${fmtLon(A.lon)}), the destination B is ${fmtLat(B.lat)}, ${fmtLon(B.lon)}. Find the course over ground and the distance. It is ${fmtTime(t0)} and SOG is ${num(SOG)} kn – when will you arrive?`),
        answers: [ans('KDd', 'KDd', rb.brg, 'deg', 1.5), ans('dist', L('Odległość', 'Distance'), rb.dist, 'nm', 0.1), ans('ETA', L('Godzina', 'Time'), ETA, 'hm', 3)],
        steps: [L(`Δφ = ${num((B.lat - A.lat) * 60, 2)}', odejście = Δλ · cos φ = ${num(Math.sin(rb.brg * D2R) * rb.dist, 2)} Mm`, `Δφ = ${num((B.lat - A.lat) * 60, 2)}', departure = Δλ · cos φ = ${num(Math.sin(rb.brg * D2R) * rb.dist, 2)} NM`),
          L(`KDd = ${deg3(rb.brg)}, odległość = ${num(rb.dist, 2)} Mm (na mapie: linia od A do B i cyrkiel na skali szerokości)`, `KDd = ${deg3(rb.brg)}, distance = ${num(rb.dist, 2)} NM (on the chart: a line from A to B and dividers on the latitude scale)`),
          L(`Czas = ${num(rb.dist, 2)} / ${num(SOG)} = ${Math.round((rb.dist / SOG) * 60)} min → ${fmtTime(ETA)}`, `Time = ${num(rb.dist, 2)} / ${num(SOG)} = ${Math.round((rb.dist / SOG) * 60)} min → ${fmtTime(ETA)}`)],
        plot: { pts: [{ label: 'A', ...A }, { label: 'B', ...B }], sol: { segs: [{ p: A, brg: rb.brg, dist: rb.dist }], point: B }, variation: rf(r, -6, 6, 2), seed: Math.floor(r() * 1e9) }
      };
    }
  ]
};

// nowe kategorie: wszystkie warianty tutaj
const NEW_GEN = {
  tsd: [
    (r) => {
      const D = rf(r, 8, 40, 2), SOG = rf(r, 3.5, 7.5, 2), t0 = ri(r, 6 * 12, 15 * 12) * 5, T = t0 + (D / SOG) * 60;
      return { cat: 'tsd', text: L(`Do portu zostało ${num(D)} Mm. Jest ${fmtTime(t0)}, jacht płynie z SOG ${num(SOG)} kn. O której wejdziesz do portu?`, `${num(D)} NM to go to the harbour. It is ${fmtTime(t0)} and the yacht makes ${num(SOG)} kn over the ground. When will you arrive?`),
        answers: [ans('ETA', L('Godzina', 'Time'), T, 'hm', 2)],
        steps: [L(`Czas = droga / prędkość = ${num(D)} / ${num(SOG)} = ${num(D / SOG, 2)} h = ${Math.floor(D / SOG)} h ${Math.round(((D / SOG) % 1) * 60)} min`, `Time = distance / speed = ${num(D)} / ${num(SOG)} = ${num(D / SOG, 2)} h = ${Math.floor(D / SOG)} h ${Math.round(((D / SOG) % 1) * 60)} min`), `${fmtTime(t0)} + ${Math.round((D / SOG) * 60)} min = ${fmtTime(T)}`] };
    },
    (r) => {
      const D = rf(r, 6, 30, 2), t0 = ri(r, 7 * 12, 14 * 12) * 5, mins = ri(r, 18, 60) * 5, V = D / (mins / 60);
      return { cat: 'tsd', text: L(`Most zwodzony otwiera się o ${fmtTime(t0 + mins)}, a do niego jest ${num(D)} Mm. Jest ${fmtTime(t0)}. Z jaką średnią prędkością nad dnem musisz płynąć, żeby zdążyć dokładnie na otwarcie?`, `The bascule bridge opens at ${fmtTime(t0 + mins)} and it is ${num(D)} NM away. It is ${fmtTime(t0)}. Which average speed over the ground do you need to arrive exactly at the opening?`),
        answers: [ans('V', 'SOG', V, 'kn', 0.1)],
        steps: [L(`Czas = ${fmtTime(t0 + mins)} − ${fmtTime(t0)} = ${mins} min = ${num(mins / 60, 2)} h`, `Time = ${fmtTime(t0 + mins)} − ${fmtTime(t0)} = ${mins} min = ${num(mins / 60, 2)} h`), L(`Prędkość = droga / czas = ${num(D)} / ${num(mins / 60, 2)} = ${num(V, 2)} kn`, `Speed = distance / time = ${num(D)} / ${num(mins / 60, 2)} = ${num(V, 2)} kn`)] };
    },
    (r) => {
      const SOG = rf(r, 3, 8, 2), mins = ri(r, 4, 30) * 5, t0 = ri(r, 7 * 12, 15 * 12) * 5, D = (SOG * mins) / 60;
      return { cat: 'tsd', text: L(`Log był zepsuty. O ${fmtTime(t0)} jacht minął pławę, o ${fmtTime(t0 + mins)} następną; GPS pokazywał cały czas SOG ${num(SOG)} kn. Jaka jest odległość między pławami?`, `The log was broken. At ${fmtTime(t0)} the yacht passed a buoy, at ${fmtTime(t0 + mins)} the next one; the GPS showed SOG ${num(SOG)} kn all the time. What is the distance between the buoys?`),
        answers: [ans('D', L('Droga', 'Distance'), D, 'nm', 0.06)],
        steps: [L(`Czas = ${mins} min = ${num(mins / 60, 3)} h`, `Time = ${mins} min = ${num(mins / 60, 3)} h`), L(`Droga = ${num(SOG)} · ${num(mins / 60, 3)} = ${num(D, 2)} Mm (reguła: w 6 min jacht przepływa 1/10 swojej prędkości)`, `Distance = ${num(SOG)} · ${num(mins / 60, 3)} = ${num(D, 2)} NM (rule: in 6 min a yacht covers 1/10 of its speed)`)] };
    }
  ],
  abeam: [
    // namiar czteropunktowy: 45° → 90°
    (r) => {
      const KR = ri(r, 0, 359), SOG = rf(r, 4, 7, 2), mins = ri(r, 4, 14) * 5, t0 = ri(r, 8 * 12, 15 * 12) * 5, s1 = r() < 0.5 ? 1 : -1, d = (SOG * mins) / 60, NR = norm(KR + s1 * 90);
      return { cat: 'abeam', text: L(`Płyniesz KR = ${deg3(KR)}, SOG ${num(SOG)} kn (bez prądu i dryfu). O ${fmtTime(t0)} latarnia jest w kącie kursowym 45° ${side(s1)}, o ${fmtTime(t0 + mins)} dokładnie z boku jachtu (w kącie kursowym 90°). W jakiej odległości od latarni jesteś w tej chwili i jaki jest wtedy jej namiar rzeczywisty?`, `You are steering KR = ${deg3(KR)} at ${num(SOG)} kn (no current or leeway). At ${fmtTime(t0)} a lighthouse is 45° on the ${side(s1)} bow, at ${fmtTime(t0 + mins)} it is abeam. How far off are you when abeam and what is its true bearing then?`),
        answers: [ans('d', L('Odległość', 'Distance'), d, 'nm', 0.08), ans('NR', 'NR', NR, 'deg', 1)],
        steps: [L('Trójkąt 45°–90°–45° jest równoramienny: odległość, gdy latarnia jest dokładnie z boku (90°) = droga przebyta między namiarami.', 'The 45°–90°–45° triangle is isosceles: the distance abeam equals the distance run between the bearings.'), L(`Droga = ${num(SOG)} · ${mins}/60 = ${num(d, 2)} Mm`, `Run = ${num(SOG)} · ${mins}/60 = ${num(d, 2)} NM`), L(`Latarnia w kącie kursowym 90°: NR = KR ${s1 > 0 ? '+' : '−'} 90° = ${deg3(NR)}`, `Abeam NR = KR ${s1 > 0 ? '+' : '−'} 90° = ${deg3(NR)}`)] };
    },
    // podwojenie kąta kursowego: 30° → 60°
    (r) => {
      const SOG = rf(r, 4, 7, 2), mins = ri(r, 4, 14) * 5, s1 = r() < 0.5 ? 1 : -1, a = [20, 25, 30, 35][ri(r, 0, 3)], run = (SOG * mins) / 60, abeam = run * Math.sin(2 * a * D2R), t0 = ri(r, 8 * 12, 15 * 12) * 5;
      return { cat: 'abeam', text: L(`SOG ${num(SOG)} kn, kurs stały, bez prądu. O ${fmtTime(t0)} latarnia jest w kącie kursowym ${a}° ${side(s1)}, o ${fmtTime(t0 + mins)} w kącie ${2 * a}°. Jaka jest odległość od latarni w chwili drugiego namiaru i w jakiej odległości miniesz ją, gdy będzie dokładnie z boku jachtu (w kącie kursowym 90°)?`, `SOG ${num(SOG)} kn, steady course, no current. At ${fmtTime(t0)} a lighthouse is ${a}° on the ${side(s1)} bow, at ${fmtTime(t0 + mins)} it is ${2 * a}°. How far is the lighthouse at the second bearing and how far off will you pass it abeam?`),
        answers: [ans('d2', L('Odległość przy 2. namiarze', 'Distance at 2nd bearing'), run, 'nm', 0.08), ans('dab', L('Odległość mijania (latarnia w kącie 90°)', 'Distance abeam'), abeam, 'nm', 0.1)],
        steps: [L(`Podwojenie kąta kursowego (${a}° → ${2 * a}°): trójkąt jest równoramienny, więc odległość przy drugim namiarze = droga przebyta = ${num(SOG)} · ${mins}/60 = ${num(run, 2)} Mm`, `Doubling the angle on the bow (${a}° → ${2 * a}°): the triangle is isosceles, so the distance at the second bearing = run = ${num(SOG)} · ${mins}/60 = ${num(run, 2)} NM`), L(`Odległość mijania (latarnia w kącie 90°): d · sin ${2 * a}° = ${num(run, 2)} · ${num(Math.sin(2 * a * D2R), 3)} = ${num(abeam, 2)} Mm`, `Abeam: d · sin ${2 * a}° = ${num(run, 2)} · ${num(Math.sin(2 * a * D2R), 3)} = ${num(abeam, 2)} NM`)] };
    }
  ],
  range: [
    // zasięg geograficzny i widoczność światła
    (r) => {
      const h = ri(r, 12, 75), H = rf(r, 1.5, 4, 2), Rn = ri(r, 8, 22), Dg = 2.08 * (Math.sqrt(h) + Math.sqrt(H)), vis = Math.min(Dg, Rn);
      return { cat: 'range', text: L(`Latarnia: wysokość światła ${h} m n.p.m., zasięg nominalny ${Rn} Mm. Oko obserwatora ${num(H)} m nad wodą, dobra widoczność. Oblicz zasięg geograficzny światła i odległość, z której je zobaczysz.`, `Lighthouse: light ${h} m above sea level, nominal range ${Rn} NM. Height of eye ${num(H)} m, good visibility. Find the geographic range of the light and the distance at which you will see it.`),
        answers: [ans('Dg', L('Zasięg geograficzny', 'Geographic range'), Dg, 'nm', 0.3), ans('vis', L('Widać z', 'Seen from'), vis, 'nm', 0.3)],
        steps: [`Dg = 2,08 · (√h + √H) = 2,08 · (√${h} + √${num(H)}) = 2,08 · (${num(Math.sqrt(h), 2)} + ${num(Math.sqrt(H), 2)}) = ${num(Dg, 1)} Mm`, L(`Światło widać z mniejszej z odległości: zasięg geograficzny ${num(Dg, 1)} Mm i nominalny ${Rn} Mm → ${num(vis, 1)} Mm${Dg < Rn ? ' (ogranicza horyzont – najpierw zobaczysz łunę)' : ' (ogranicza siła światła)'}`, `The light is seen from the smaller of the geographic range ${num(Dg, 1)} NM and the nominal range ${Rn} NM → ${num(vis, 1)} NM${Dg < Rn ? ' (limited by the horizon – you may see the loom first)' : ' (limited by the intensity of the light)'}`)] };
    },
    // kiedy światło wyłoni się zza horyzontu
    (r) => {
      const h = ri(r, 20, 70), H = rf(r, 1.5, 3.5, 2), Dg = 2.08 * (Math.sqrt(h) + Math.sqrt(H)), D0 = Math.round((Dg + rf(r, 3, 12, 2)) * 10) / 10, SOG = rf(r, 4, 7, 2), t0 = ri(r, 19 * 12, 22 * 12) * 5, T = t0 + ((D0 - Dg) / SOG) * 60;
      return { cat: 'range', text: L(`Nocą płyniesz prosto na latarnię (wysokość światła ${h} m, zasięg nominalny 25 Mm). Oko ${num(H)} m nad wodą. O ${fmtTime(t0)} odległość z pozycji GPS wynosi ${num(D0)} Mm, SOG ${num(SOG)} kn. O której światło pojawi się nad horyzontem?`, `At night you are heading straight for a lighthouse (light ${h} m high, nominal range 25 NM). Height of eye ${num(H)} m. At ${fmtTime(t0)} the GPS distance is ${num(D0)} NM, SOG ${num(SOG)} kn. When will the light rise above the horizon?`),
        answers: [ans('Dg', L('Zasięg geograficzny', 'Geographic range'), Dg, 'nm', 0.3), ans('T', L('Godzina', 'Time'), T, 'hm', 5)],
        steps: [`Dg = 2,08 · (√${h} + √${num(H)}) = ${num(Dg, 1)} Mm`, L(`Do przepłynięcia: ${num(D0)} − ${num(Dg, 1)} = ${num(D0 - Dg, 1)} Mm, czas = ${num(D0 - Dg, 1)} / ${num(SOG)} = ${Math.round(((D0 - Dg) / SOG) * 60)} min → ${fmtTime(T)}`, `Distance to go: ${num(D0)} − ${num(Dg, 1)} = ${num(D0 - Dg, 1)} NM, time = ${num(D0 - Dg, 1)} / ${num(SOG)} = ${Math.round(((D0 - Dg) / SOG) * 60)} min → ${fmtTime(T)}`)] };
    }
  ]
};

// GENERATORS[kategoria](r, wariant) – wariant 0 to zadanie bazowe; bez wariantu: 0
export const GENERATORS = {};
export const VARIANTS = {};
for (const c of Object.keys(CATEGORIES)) {
  const list = NEW_GEN[c] || [BASE_GEN[c], ...(VAR_GEN[c] || [])];
  VARIANTS[c] = list.length;
  GENERATORS[c] = (r, v = 0) => { const tk = list[Math.max(0, Math.min(list.length - 1, v))](r); tk.variant = v; return tk; };
}

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

export function makeTask(r, cat, variant) {
  const cats = Object.keys(GENERATORS);
  const c = cat && GENERATORS[cat] ? cat : cats[Math.floor(r() * cats.length)];
  return GENERATORS[c](r, variant ?? Math.floor(r() * VARIANTS[c]));
}

// Talia zadań: każdy rodzaj zadania (kategoria + wariant) raz na cykl, w losowej kolejności, bez powtórki pod rząd
export function makeTaskDeck(r) {
  const decks = {};
  let last = null;
  const keys = (cat) => (cat ? [cat] : Object.keys(CATEGORIES)).flatMap((c) => Array.from({ length: VARIANTS[c] }, (_, v) => `${c}:${v}`));
  return {
    next(cat) {
      const id = cat || '*';
      let d = decks[id];
      if (!d || !d.length) {
        d = decks[id] = keys(cat).map((k) => [r(), k]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
        if (d.length > 1 && d[d.length - 1] === last) d.unshift(d.pop());
      }
      last = d.pop();
      const [c, v] = last.split(':');
      return GENERATORS[c](r, Number(v));
    },
    count: (cat) => keys(cat).length
  };
}

// czas „gg:mm” (także „ggmm” albo „gg.mm”) → minuty od północy
const parseHM = (s) => {
  const t = String(s).trim().replace(/[^\d:.,]/g, '');
  const m = t.match(/^(\d{1,2})[:.,](\d{2})$/) || t.match(/^(\d{1,2})(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
// poprawka ze znakiem: „+3”, „-2,5”, „2W”, „3,5°E”
const parseSigned = (s) => {
  const t = String(s).trim().toUpperCase().replace('−', '-');
  const v = parseFloat(t.replace(',', '.').replace(/[^\d.\-+]/g, ''));
  if (!Number.isFinite(v)) return NaN;
  return /W/.test(t) && v > 0 ? -v : v;
};

// Sprawdzenie odpowiedzi (kąty z zawinięciem 360°)
export function checkAnswer(a, input) {
  if (a.kind === 'hm') { const m = parseHM(input); return Number.isFinite(m) && Math.abs(((m - a.value + 720 + 1440 * 2) % 1440) - 720) <= a.tol + 1e-9; }
  const v = a.kind === 'sdeg' ? parseSigned(input) : parseFloat(String(input).replace(',', '.').replace('°', ''));
  if (!Number.isFinite(v)) return false;
  return a.kind === 'deg' ? Math.abs(angDiff(v, a.value)) <= a.tol + 1e-9 : Math.abs(v - a.value) <= a.tol + 1e-9;
}
export function fmtAnswer(a) {
  if (a.kind === 'hm') return fmtTime(a.value);
  if (a.kind === 'sdeg') return `${a.value < 0 ? '-' : '+'}${num(Math.abs(a.value), 1)}°${a.value < 0 ? 'W' : 'E'}`;
  return a.kind === 'deg' ? deg3(a.value) : a.kind === 'kn' ? `${num(a.value, 1)} kn` : a.kind === 'nm' ? `${num(a.value, 2)} Mm` : `${num(a.value, 1)}'`;
}
export const answerUnit = (a) => ({ deg: '°', sdeg: '°', kn: 'kn', nm: 'Mm', hm: '', min: "'" }[a.kind] ?? '');
export const answerPlaceholder = (a) => ({ deg: '000', sdeg: '+0,0', hm: L('gg:mm', 'hh:mm') }[a.kind] || '0,0');
