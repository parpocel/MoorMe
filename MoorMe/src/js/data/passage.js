// Akweny do rejsu wzdłuż wybrzeża: lądy, wyspy, mielizny, znaki nawigacyjne IALA (region A) i trasa z waypointami.
// Układ świata jak w porcie: x – wschód, z – południe (północ = -z), jednostki w metrach.
import { compassVec, distToPoly, rng } from '../math.js';

// Rodzaje znaków. rule: 'port' – znak ma zostać po lewej burcie, 'starboard' – po prawej,
// 'N'|'E'|'S'|'W' – znak kardynalny: mijamy go od tej strony, 'near' – znak wody bezpiecznej (trzymaj się go blisko),
// 'avoid' – niebezpieczeństwo: nie wpływaj w strefę o promieniu radius.
export const MARK_TYPES = {
  lateralPort: { id: 'lateralPort', name: 'Znak boczny lewy (czerwony)', rule: 'port', gate: 85, color: 0xd62828, flash: 'R' },
  lateralStbd: { id: 'lateralStbd', name: 'Znak boczny prawy (zielony)', rule: 'starboard', gate: 85, color: 0x1f9d55, flash: 'G' },
  cardN: { id: 'cardN', name: 'Znak kardynalny północny', rule: 'N', gate: 300, flash: 'VQ' },
  cardE: { id: 'cardE', name: 'Znak kardynalny wschodni', rule: 'E', gate: 300, flash: 'VQ3' },
  cardS: { id: 'cardS', name: 'Znak kardynalny południowy', rule: 'S', gate: 300, flash: 'VQ6' },
  cardW: { id: 'cardW', name: 'Znak kardynalny zachodni', rule: 'W', gate: 300, flash: 'VQ9' },
  safe: { id: 'safe', name: 'Znak wody bezpiecznej', rule: 'near', gate: 160, flash: 'ISO' },
  isolated: { id: 'isolated', name: 'Znak odosobnionego niebezpieczeństwa', rule: 'avoid', radius: 75, gate: 220, flash: 'FL2' },
  wreck: { id: 'wreck', name: 'Znak nowego niebezpieczeństwa (wrak)', rule: 'avoid', radius: 120, gate: 260, flash: 'WRECK' },
  special: { id: 'special', name: 'Znak szczególny (żółty)', rule: 'avoid', radius: 55, gate: 160, flash: 'FLY' }
};

// System oznakowania IALA: region A (Europa, Afryka, Australia, większość Azji) – lewe czerwone, prawe zielone;
// region B (obie Ameryki, Japonia, Korea, Filipiny) – kolory i światła odwrócone, kształty bez zmian (lewe – beczki, prawe – stożki).
export const IALA = { region: 'A' };
export function setIalaRegion(r) {
  IALA.region = r === 'B' ? 'B' : 'A';
  const b = IALA.region === 'B';
  Object.assign(MARK_TYPES.lateralPort, { color: b ? 0x1f9d55 : 0xd62828, flash: b ? 'G' : 'R', name: b ? 'Znak boczny lewy (zielony)' : 'Znak boczny lewy (czerwony)' });
  Object.assign(MARK_TYPES.lateralStbd, { color: b ? 0xd62828 : 0x1f9d55, flash: b ? 'R' : 'G', name: b ? 'Znak boczny prawy (czerwony)' : 'Znak boczny prawy (zielony)' });
}
// kolory znaków bocznych w aktualnym regionie: { port, stbd } (0xRRGGBB)
export const lateralColors = () => (IALA.region === 'B' ? { port: 0x1f9d55, stbd: 0xd62828 } : { port: 0xd62828, stbd: 0x1f9d55 });

export const RULE_TEXT = {
  port: 'zostaw po lewej burcie (znak po bakburcie)',
  starboard: 'zostaw po prawej burcie (znak po sterburcie)',
  N: 'miń od północy', E: 'miń od wschodu', S: 'miń od południa', W: 'miń od zachodu',
  near: 'trzymaj się blisko (woda bezpieczna)',
  avoid: 'nie wpływaj w strefę zagrożenia'
};

// Elipsa (wypukły wielokąt) – wyspy i mielizny
function ell(cx, cz, rx, rz, rot = 0, n = 14) {
  const out = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx, z = Math.sin(a) * rz;
    out.push([cx + x * c - z * s, cz + x * s + z * c]);
  }
  return out;
}
const R4 = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

// Lewa i prawa strona toru o kierunku (dx, dz): punkt po lewej burcie to (dz, -dx)
function sideOffset(x, z, bearingDeg, off) {
  const d = compassVec(bearingDeg);
  return { x: x + d.z * off, z: z - d.x * off };
}

const DEFS = {
  baltic: {
    id: 'baltic',
    name: 'Bałtyk – piaszczyste wybrzeże z mielizną',
    desc: 'Płaski, piaszczysty brzeg z lasem i wsiami. Piaszczyste mielizny tworzą długie bariery z przejściami na przemian od północy i południa – trasa meandruje jak rzeka, a znaki kardynalne wskazują, z której strony je minąć. Tor ze znakami bocznymi zaczyna się dopiero przy wejściu do portu. Układ zmienia się przy każdym rejsie.',
    style: 'baltic',
    difficulty: 1,
    depthMax: 20,
    relief: 38,
    weather: { windKn: 12, windFrom: 250, gust: 0.25, currentKn: 0, hour: 11, sky: 'clear' },
    bounds: { minX: -2600, maxX: 7600, minZ: -1200, maxZ: 900 },
    coasts: [{
      pts: [[-3000, -520], [-2000, -500], [-1000, -450], [0, -420], [1000, -380], [2000, -350], [3000, -400], [4000, -340], [4800, -280], [5200, -170], [5500, -250], [6000, -330], [6360, -330], [6560, -330], [7000, -420], [8000, -500], [9000, -520]],
      D: 900
    }],
    moles: [R4(6300, -330, 6360, -90), R4(6560, -330, 6620, -90)],
    islands: [],
    shoals: [],
    wrecks: [],
    lighthouses: [{ x: 5200, z: -200, color: 0xd62828, name: 'Latarnia Przylądek' }],
    villages: [{ x: 1300, z: -330, n: 8 }, { x: 3600, z: -380, n: 6 }, { x: 5900, z: -300, n: 10 }, { x: 6760, z: -400, n: 12 }],
    start: { x: -1200, z: 30, compass: 90 },
    route: [{ x: -1200, z: 30, name: 'Start' }],
    tail: [{ x: 6460, z: 520, label: 'podejście' }, { x: 6460, z: 300, label: 'tor wejściowy' }, { x: 6460, z: 100, label: 'przed główkami' }, { x: 6460, z: -190, name: 'Meta – port' }],
    marks: [],
    meander: { kind: 'shoal' }
  },
  adriatic: {
    id: 'adriatic',
    name: 'Adriatyk – kanały między wyspami',
    desc: 'Skalisty brzeg i podwodne skaliste grzbiety, niewidoczne z pokładu, tworzące długie bariery z przejściami na przemian od północy i południa – trasa meandruje, a tylko znaki kardynalne wskazują, z której strony je minąć. Tor ze znakami bocznymi zaczyna się dopiero przy wejściu do portu. Układ zmienia się przy każdym rejsie.',
    style: 'med',
    difficulty: 2,
    depthMax: 70,
    relief: 140,
    weather: { windKn: 14, windFrom: 300, gust: 0.35, currentKn: 0, hour: 14, sky: 'clear' },
    bounds: { minX: -2600, maxX: 7600, minZ: -1400, maxZ: 1000 },
    coasts: [{
      pts: [[-3000, -700], [-1500, -650], [0, -600], [1500, -520], [2500, -450], [3500, -480], [4500, -420], [5500, -380], [6000, -420], [6360, -420], [6560, -420], [7000, -520], [8000, -600], [9000, -640]],
      D: 1200
    }],
    moles: [R4(6300, -420, 6360, -190), R4(6560, -420, 6620, -190)],
    islands: [],
    shoals: [],
    wrecks: [],
    lighthouses: [],
    villages: [{ x: 6760, z: -480, n: 12 }],
    start: { x: -1200, z: -20, compass: 90 },
    route: [{ x: -1200, z: -20, name: 'Start' }],
    tail: [{ x: 6460, z: 420, label: 'podejście' }, { x: 6460, z: 240, label: 'tor wejściowy' }, { x: 6460, z: 20, label: 'przed główkami' }, { x: 6460, z: -340, name: 'Meta – port' }],
    marks: [],
    meander: { kind: 'shoal', wall: 'rocky' }
  }
};


// Meander: długie, lekko wygięte i nierówne bariery (mielizny lub skaliste grzbiety) połączone naprzemiennie z północnym
// i południowym brzegiem. Przejścia są na przemian na północy i na południu, a kanały między barierami biegną skosem,
// więc kurs zmienia się o ponad 90° – trasa jest wygładzona splajnem, żeby zakręty były płynne.
function smoothPath(pts, step) {
  const out = [pts[0]];
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    const n = Math.max(1, Math.round(Math.hypot(p2.x - p1.x, p2.z - p1.z) / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: Math.round(f(p0.x, p1.x, p2.x, p3.x)), z: Math.round(f(p0.z, p1.z, p2.z, p3.z)) });
    }
  }
  return out;
}

// Upraszcza łamaną: zostają start, meta, punkty z listy keep i te, w których kurs zmienia się o więcej niż tolDeg
export function simplifyRoute(pts, tolDeg = 12, keep = []) {
  const out = [pts[0]];
  const ang = (a, b) => Math.atan2(b.x - a.x, -(b.z - a.z));
  for (let i = 1; i < pts.length - 1; i++) {
    const last = out[out.length - 1], p = pts[i], nx = pts[i + 1];
    let d = Math.abs(ang(last, p) - ang(p, nx)) * 180 / Math.PI;
    if (d > 180) d = 360 - d;
    if (keep.includes(p) || d > tolDeg) out.push(p);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function applyMeander(d, r) {
  const m = d.meander;
  // parametry losowane przy każdym rejsie
  // szeroki akwen: przejścia ok. 300 m, kanały między barierami 300–360 m – drogę wyznaczają tylko znaki
  const n = 3, dx = 300 + r() * 60, H = 720 + r() * 100, par = r() < 0.5 ? 0 : 1;
  const slope0 = 0.55 + r() * 0.35;
  m.x0 = Math.round(-20 + r() * 40);
  let zN = -1e9;
  for (let x = m.x0 - 250; x <= m.x0 + n * dx + 250; x += 25) zN = Math.max(zN, coastZ(d.coasts[0].pts, x));
  const zS = zN + H, zref = zN + H / 2;
  const gN = zN + 160, gS = zS - 160;
  const zg = (k) => ((k + par) % 2 === 0 ? gN : gS);
  // każda bariera ma własny odstęp, pochylenie, wygięcie i długość przejścia
  const bars = [];
  for (let k = 0; k < n; k++) {
    const north = (k + par) % 2 === 0;
    const top = (north ? zN + 320 + r() * 40 : zN - 200), bot = (north ? zS + 160 : zS - 320 - r() * 40);
    const slope = slope0 + (r() - 0.5) * 0.25, bow = (r() - 0.5) * 0.22, x0k = m.x0 + k * dx + (r() - 0.5) * 50;
    const X = (z) => {
      const t = Math.max(0, Math.min(1, (z - top) / (bot - top)));
      return x0k - slope * (z - zref) + bow * (bot - top) * Math.sin(Math.PI * t);
    };
    bars.push({ k, north, top, bot, X, slope });
  }
  const cx = (c, z) => {
    const west = c < 0 ? bars[0].X(z) - dx : bars[c].X(z), east = c + 1 >= n ? bars[n - 1].X(z) + dx : bars[c + 1].X(z);
    return (west + east) / 2;
  };
  let maxX = -1e9;
  const sh = d.shoals, isl = d.islands;
  for (const b of bars) {
    // bariera jako łańcuch wypukłych, zachodzących na siebie owali o zmiennej szerokości
    const segs = 7;
    for (let i = 0; i < segs; i++) {
      const z0 = b.top + ((b.bot - b.top) * i) / segs, z1 = b.top + ((b.bot - b.top) * (i + 1)) / segs;
      const ax = b.X(z0), bx = b.X(z1), cxm = (ax + bx) / 2, czm = (z0 + z1) / 2, len = Math.hypot(bx - ax, z1 - z0);
      const ux = (bx - ax) / len, uz = (z1 - z0) / len, vx = -uz, vz = ux, hw = 11 + r() * 9;
      const poly = [];
      for (let q = 0; q < 12; q++) {
        const t = (q / 12) * Math.PI * 2;
        poly.push([cxm + ux * Math.cos(t) * (len / 2 + 6) + vx * Math.sin(t) * hw, czm + uz * Math.cos(t) * (len / 2 + 6) + vz * Math.sin(t) * hw]);
      }
      maxX = Math.max(maxX, ...poly.map((p) => p[0]));
      if (m.kind === 'island') isl.push({ name: `Grzbiet ${b.k + 1}`, poly, h: 18 + r() * 14 });
      else sh.push({ name: `Mielizna ${b.k + 1}`, poly, depth: 0.6 + r() * 0.3 });
    }
    // znaki: kardynał przy końcu bariery (od strony przejścia) i kardynały wschodni/zachodni na burtach
    if (b.north) d.marks.push({ type: 'cardN', x: Math.round(b.X(b.top)), z: Math.round(b.top - 55), name: 'Koniec bariery – N', gate: 100 });
    else d.marks.push({ type: 'cardS', x: Math.round(b.X(b.bot)), z: Math.round(b.bot + 55), name: 'Koniec bariery – S', gate: 100 });
    const mz = b.north ? (b.top + zS) / 2 : (zN + b.bot) / 2, mx = b.X(mz), hyp = Math.hypot(b.slope, 1), ex = 1 / hyp, ez = b.slope / hyp;
    if (b.k < n - 1) d.marks.push({ type: 'cardE', x: Math.round(mx + ex * 35), z: Math.round(mz + ez * 35), name: 'Bariera – E', gate: 70 });
    if (b.k > 0) d.marks.push({ type: 'cardW', x: Math.round(mx - ex * 35), z: Math.round(mz - ez * 35), name: 'Bariera – W', gate: 70 });
  }
  // brzeg południowy zamykający basen
  const xW = maxX + 80;
  // południowa granica akwenu – podwodna (niewidoczna z pokładu), żeby kształt lądu nie zdradzał trasy
  const wall = R4(m.x0 - 1400, zS, xW, zS + 260);
  sh.push({ name: m.wall === 'rocky' ? 'Podwodne skały' : 'Mielizna południowa', poly: wall, depth: m.wall === 'rocky' ? 0.8 : 0.6 });
  // trasa: punkty kontrolne w osiach kanałów i przejściach, wygładzone splajnem
  d.start.z = d.route[0].z = Math.round(zg(0)); // start na poziomie pierwszego przejścia
  const ctrl = [d.route[0], { x: Math.round(cx(-1, zg(0))), z: Math.round(zg(0)) }];
  for (let k = 0; k < n; k++) {
    ctrl.push({ x: Math.round(cx(k, zg(k))), z: Math.round(zg(k)) });
    if (k < n - 1) {
      const z1 = zg(k), z2 = zg(k + 1);
      for (const f of [0.33, 0.66]) { const z = z1 + (z2 - z1) * f; ctrl.push({ x: Math.round(cx(k, z)), z: Math.round(z) }); }
      ctrl.push({ x: Math.round(cx(k, z2)), z: Math.round(z2) });
    }
  }
  ctrl.push({ x: Math.round(xW + 140), z: Math.round(zg(n - 1)) });
  ctrl.push({ x: Math.max(xW + 140, d.tail[0].x - 260), z: d.tail[0].z + 60 });
  const route = [...smoothPath(ctrl, 70), ...d.tail];
  // samotne przeszkody „raz po raz” wzdłuż trasy: skały, wraki i znaki szczególne obok toru, z oznakowaniem
  const solid = [...d.shoals, ...d.islands].map((q) => q.poly).concat(coastPolys(d.coasts[0].pts, d.coasts[0].D));
  const placed = [];
  const free = (x, z, rad) => solid.every((poly) => distToPoly(poly, x, z).dist > rad) && placed.every((q) => Math.hypot(q.x - x, q.z - z) > 170);
  const kinds = [
    { type: 'isolated', off: 125, rad: 90, name: 'Skała', shoal: true },
    { type: 'wreck', off: 165, rad: 140, name: 'Wrak', wreck: true },
    { type: 'special', off: 105, rad: 80, name: 'Kabel podwodny' },
    { type: 'isolated', off: 125, rad: 90, name: 'Skała', shoal: true }
  ];
  const lim = route.length - 4;
  let extras = 0;
  for (let i = 6; i < lim && extras < 7; i += 3 + Math.floor(r() * 3)) {
    const a0 = route[i - 1], b0 = route[i + 1], dxr = b0.x - a0.x, dzr = b0.z - a0.z, L = Math.hypot(dxr, dzr) || 1;
    const nx = dzr / L, nz = -dxr / L, kind = kinds[Math.floor(r() * kinds.length)], side = r() < 0.5 ? 1 : -1;
    const x = Math.round(route[i].x + nx * kind.off * side), z = Math.round(route[i].z + nz * kind.off * side);
    if (!free(x, z, kind.rad) || route.some((q) => Math.hypot(q.x - x, q.z - z) < kind.rad + 20) || Math.hypot(x - d.tail[0].x, z - d.tail[0].z) < 250) continue;
    placed.push({ x, z });
    extras++;
    if (kind.shoal) sh.push({ name: kind.name, poly: ell(x, z, 15, 12, r() * 3, 10), depth: 0.5 });
    if (kind.wreck) d.wrecks.push({ name: kind.name, x, z, rot: r() * 3 });
    d.marks.push({ type: kind.type, x, z, name: kind.name });
  }
  // waypointy tylko na zakrętach: punkt pomijamy, gdy odcinek od ostatniego zachowanego biegnie dalej prosto
  const simple = simplifyRoute(route, 12, [d.tail[0]]);
  simple.forEach((p, i) => { p.name = p.name && !/^WP\d/.test(p.name) ? p.name : `WP${i}${p.label ? ' – ' + p.label : ''}`; });
  d.route = simple;
  d.gates = { from: simple.indexOf(d.tail[0]), to: simple.length - 1, step: 180, half: 80 };
  d.meander = { ...m, n, dx, H, par };
}

// Skraca akwen wzdłuż osi x (trasa ok. 15 min żeglugi) – zachowuje kształt w osi z
const XK = 0.23;
function compact(d) {
  const X = (x) => Math.round(x * XK);
  const P = (poly) => poly.map(([x, z]) => [x * XK, z]);
  d.bounds = { ...d.bounds, minX: X(d.bounds.minX), maxX: X(d.bounds.maxX) };
  d.coasts.forEach((c) => { c.pts = c.pts.map(([x, z]) => [X(x), z]); });
  // główki portu zachowują szerokość wejścia (±100 m od osi toru)
  const xe = X(d.tail[d.tail.length - 1].x);
  d.moles = d.moles.map((m, i) => { const z0 = m[0][1], z1 = m[2][1]; return i === 0 ? R4(xe - 160, z0, xe - 100, z1) : R4(xe + 100, z0, xe + 160, z1); });
  d.islands.forEach((i) => { i.poly = P(i.poly); });
  d.shoals.forEach((i) => { i.poly = P(i.poly); });
  [...d.wrecks, ...d.lighthouses, ...d.villages, d.start, ...d.route, ...d.tail, ...d.marks].forEach((o) => { o.x = X(o.x); });
  d.marks.forEach((m) => { if (m.type === 'lateralPort') m.x = xe - 60; if (m.type === 'lateralStbd') m.x = xe + 60; });
}

export const PASSAGES = Object.fromEntries(Object.entries(DEFS).map(([k, d]) => [k, { id: d.id, name: d.name, desc: d.desc, difficulty: d.difficulty, style: d.style, weather: d.weather }]));

// Wielokąt lądu: pas wzdłuż wybrzeża (boki pionowe – wypukły trapez)
function coastPolys(pts, D) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    out.push([[x0, z0], [x1, z1], [x1, Math.min(z0, z1) - D], [x0, Math.min(z0, z1) - D]]);
  }
  return out;
}

// Z (x) linii brzegowej (interpolacja po łamanej) – brzeg leży po północnej stronie toru
export function coastZ(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    if (x <= pts[i + 1][0]) {
      const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
      return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
    }
  }
  return pts[pts.length - 1][1];
}

function routeDist(R, x, z) {
  let best = Infinity;
  for (let i = 0; i < R.length - 1; i++) {
    const a = R[i], b = R[i + 1], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}

export function routeLength(route) {
  let L = 0;
  for (let i = 1; i < route.length; i++) L += Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z);
  return L;
}

// Buduje „port” w rozumieniu świata: struktury kolizyjne, znaki, trasa. Zwraca obiekt zgodny z interfejsem World/View3D.
export function buildPassage(id, seed = 1) {
  const d = structuredClone(DEFS[id] || DEFS.baltic);
  compact(d);
  applyMeander(d, rng(seed));
  const structures = [];
  const polyBox = (poly) => poly;
  for (const c of d.coasts) for (const p of coastPolys(c.pts, c.D)) structures.push({ kind: 'land', style: 'coast', poly: p, h: 3, walk: false });
  for (const m of d.moles) structures.push({ kind: 'breakwater', style: 'concrete', poly: polyBox(m), h: 2.6, walk: false });
  for (const isl of d.islands) structures.push({ kind: 'land', style: 'island', poly: isl.poly, h: isl.h, walk: false, name: isl.name });
  for (const s of d.shoals) structures.push({ kind: 'shoal', style: 'shoal', poly: s.poly, h: 0, walk: false, depth: s.depth, name: s.name });
  // gęste oznakowanie toru: znaki boczne co ok. step/2, na przemian z lewej (czerwony) i prawej (zielony) strony toru
  const handMarks = [...d.marks];
  const gen = [];
  if (d.gates) {
    const { from, to, step, half } = d.gates;
    const R0 = d.route;
    const nearStruct = (x, z) => structures.some((st) => (st.kind === 'shoal' || st.kind === 'land' || st.kind === 'breakwater') && distToPoly(st.poly, x, z).dist < 25);
    const tooClose = (x, z) => handMarks.concat(gen).some((q) => {
      const T = MARK_TYPES[q.type];
      return Math.hypot(q.x - x, q.z - z) < (T.radius ? T.radius + 70 : 90);
    });
    for (let i = from; i <= to && i < R0.length - 1; i++) {
      const A = R0[i], B = R0[i + 1], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz);
      const ux = dx / L, uz = dz / L, nx = uz, nz = -ux; // lewa burta toru
      let k = 0;
      for (let sdist = i === from ? 110 : 40; sdist < L - 30; sdist += step / 2, k++) {
        const side = k % 2 === 0 ? 1 : -1; // 1: po lewej (czerwony), -1: po prawej (zielony)
        const x = A.x + ux * sdist + nx * half * side, z = A.z + uz * sdist + nz * half * side;
        if (nearStruct(x, z) || tooClose(x, z) || routeDist(R0, x, z) < half - 15) continue;
        gen.push({ type: side > 0 ? 'lateralPort' : 'lateralStbd', x: Math.round(x), z: Math.round(z) });
      }
    }
  }
  const marks = [...handMarks, ...gen].map((m, i) => {
    const T = MARK_TYPES[m.type];
    return { id: 'm' + i, ...m, rule: T.rule, flash: T.flash, radius: T.radius || 0, gate: m.gate ?? T.gate, label: m.name || T.name, typeName: T.name };
  });
  const route = d.route.map((p, i) => ({ ...p, i }));
  const first = route[0], second = route[1];
  const brg = ((Math.atan2(second.x - first.x, -(second.z - first.z)) * 180) / Math.PI + 360) % 360;
  return {
    passage: true, passageId: d.id, name: d.name, style: d.style, depthMax: d.depthMax, relief: d.relief,
    bounds: d.bounds,
    structures, coasts: d.coasts, moles: d.moles, islands: d.islands, shoals: d.shoals, wrecks: d.wrecks, lighthouses: d.lighthouses, villages: d.villages,
    marks, route, routeLength: routeLength(route), start: { ...d.start, compass: d.start.compass ?? brg },
    // pola wymagane przez World / widok portu (puste w rejsie)
    neighbors: [], bollards: [], murings: [], deco: [], starts: [],
    berth: { x: first.x, z: first.z, th: 0, tolAlong: 1, tolAcross: 1, tolTh: 1, frame: null },
    quay: { height: 1 }, port: { walkways: [], motor: null }, method: 'passage', exitZone: null
  };
}

export { sideOffset };
