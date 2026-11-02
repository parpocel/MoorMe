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
  special: { id: 'special', name: 'Znak szczególny (żółty)', rule: 'avoid', radius: 55, gate: 160, flash: 'FLY' },
  // znaki rozgałęzienia toru (zmodyfikowane boczne): rule – gdy płyniemy torem głównym; przy torze bocznym znak mija się odwrotnie
  prefStbd: { id: 'prefStbd', name: 'Znak rozgałęzienia – tor główny w prawo (czerwony z zielonym pasem)', rule: 'port', gate: 90, flash: 'FL21R' },
  prefPort: { id: 'prefPort', name: 'Znak rozgałęzienia – tor główny w lewo (zielony z czerwonym pasem)', rule: 'starboard', gate: 90, flash: 'FL21G' }
};

// System oznakowania IALA: region A (Europa, Afryka, Australia, większość Azji) – lewe czerwone, prawe zielone;
// region B (obie Ameryki, Japonia, Korea, Filipiny) – kolory i światła odwrócone, kształty bez zmian (lewe – beczki, prawe – stożki).
export const IALA = { region: 'A' };
export function setIalaRegion(r) {
  IALA.region = r === 'B' ? 'B' : 'A';
  const b = IALA.region === 'B';
  Object.assign(MARK_TYPES.lateralPort, { color: b ? 0x1f9d55 : 0xd62828, flash: b ? 'G' : 'R', name: b ? 'Znak boczny lewy (zielony)' : 'Znak boczny lewy (czerwony)' });
  Object.assign(MARK_TYPES.lateralStbd, { color: b ? 0xd62828 : 0x1f9d55, flash: b ? 'R' : 'G', name: b ? 'Znak boczny prawy (czerwony)' : 'Znak boczny prawy (zielony)' });
  Object.assign(MARK_TYPES.prefStbd, { flash: b ? 'FL21G' : 'FL21R', name: b ? 'Znak rozgałęzienia – tor główny w prawo (zielony z czerwonym pasem)' : 'Znak rozgałęzienia – tor główny w prawo (czerwony z zielonym pasem)' });
  Object.assign(MARK_TYPES.prefPort, { flash: b ? 'FL21R' : 'FL21G', name: b ? 'Znak rozgałęzienia – tor główny w lewo (czerwony z zielonym pasem)' : 'Znak rozgałęzienia – tor główny w lewo (zielony z czerwonym pasem)' });
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
  offshore: {
    id: 'offshore',
    offshore: true,
    name: 'Otwarte morze – pławy, tory i rozwidlenie',
    desc: 'Żadnego lądu na horyzoncie – płyniesz od waypointu do waypointu do boi docelowej, a dokądkolwiek skierujesz dziób, przed jachtem wyłaniają się nowe znaki: mielizny ze znakami kardynalnymi, odosobnione niebezpieczeństwa, wraki, znaki specjalne, tory wodne między płyciznami (czasem pod prąd kierunku oznakowania) i rozwidlenia torów – po znaku rozgałęzienia rozpoznajesz tor główny i boczny.',
    style: 'baltic',
    difficulty: 2,
    depthMax: 28,
    relief: 20,
    weather: { windKn: 4, windFrom: 230, gust: 0.25, currentKn: 0, hour: 12, sky: 'clear' },
    bounds: { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 },
    coasts: [], moles: [], islands: [], shoals: [], wrecks: [], lighthouses: [], villages: [],
    start: { x: 0, z: 0 },
    route: [], tail: [], marks: []
  },
  baltic: {
    id: 'baltic',
    name: 'Bałtyk – piaszczyste wybrzeże z mielizną',
    desc: 'Płaski, piaszczysty brzeg z lasem i wsiami. Piaszczyste mielizny tworzą długie bariery z przejściami na przemian od północy i południa – trasa meandruje jak rzeka, a znaki kardynalne wskazują, z której strony je minąć. Tor ze znakami bocznymi zaczyna się dopiero przy wejściu do portu. Układ zmienia się przy każdym rejsie.',
    style: 'baltic',
    difficulty: 1,
    depthMax: 20,
    relief: 38,
    weather: { windKn: 5, windFrom: 250, gust: 0.25, currentKn: 0, hour: 11, sky: 'clear' },
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
    weather: { windKn: 5, windFrom: 300, gust: 0.35, currentKn: 0, hour: 14, sky: 'clear' },
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

// ---------- Otwarte morze ----------
// Bez lądu i bez z góry ustalonej trasy: znana jest tylko boja docelowa, a kolejne „sytuacje” nawigacyjne (mielizna ze znakiem
// kardynalnym, odosobnione niebezpieczeństwo, wrak, znak specjalny, tor wodny między płyciznami – z kierunkiem albo pod prąd
// kierunku oznakowania – i rozwidlenie toru ze znakiem rozgałęzienia) pojawiają się przed dziobem, dokądkolwiek płynie jacht.
const CARD = [['cardN', 0], ['cardE', 90], ['cardS', 180], ['cardW', 270]];
const bearingOf = (x, z) => ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360;
const brgOf = (x, z) => ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360;
const HAZ = {
  isolated: { names: ['Skała'] },
  wreck: { names: ['Wrak'] },
  special: { names: ['Kabel podwodny', 'Strefa zakazana', 'Rurociąg'] }
};
// rodzaje sytuacji i ich częstość (na otwartym morzu losowane w locie przed dziobem)
export const SITUATION_KINDS = [['cardinal', 3], ['isolated', 1.2], ['wreck', 1], ['special', 1], ['channel', 1.6], ['fork', 1.3]];
export function pickSituationKind(r) {
  const tot = SITUATION_KINDS.reduce((s, k) => s + k[1], 0);
  let x = r() * tot;
  for (const [k, w] of SITUATION_KINDS) { if ((x -= w) < 0) return k; }
  return 'cardinal';
}

// Jedna sytuacja nawigacyjna na otwartym morzu: E – punkt wejścia (od strony jachtu), hdg – kierunek (kompas), id – numer.
// Zwraca znaki, mielizny, wraki, polecenia i okrąg, w którym się mieści (cx, cz, rad).
export function makeSituation(kind, E, hdg, r, id = 0) {
  const shoals = [], marks = [], wrecks = [], notes = [], forks = [];
  const fr = (h) => { const u = compassVec(h); return { u, v: { x: -u.z, z: u.x } }; }; // v – na prawo od kierunku
  const at = (O, F, a, l) => ({ x: O.x + F.u.x * a + F.v.x * l, z: O.z + F.u.z * a + F.v.z * l });
  const R = (p) => ({ x: Math.round(p.x), z: Math.round(p.z) });
  const rect = (O, F, a0, a1, l0, l1) => [at(O, F, a0, l0), at(O, F, a1, l0), at(O, F, a1, l1), at(O, F, a0, l1)].map((p) => [p.x, p.z]);
  // płycizny po bokach toru: odcinki po 160 m z lekko nierówną krawędzią
  const banks = (O, F, a0, a1, sides) => {
    for (let a = a0; a < a1 - 1; a += 160) {
      const b = Math.min(a1, a + 160);
      for (const s of sides) shoals.push({ name: 'Płycizna przy torze', poly: rect(O, F, a, b, s * (68 + r() * 12), s * 380), depth: 1.1 + r() * 0.5 });
    }
  };
  // pary znaków bocznych co 100 m; withB – płyniemy z kierunkiem oznakowania. sides: -1 – lewa strona toru, 1 – prawa
  const gates = (O, F, a0, a1, withB, extra = {}, sides = [-1, 1]) => {
    for (let a = a0; a <= a1; a += 100) {
      for (const s of sides) {
        const left = s < 0;
        marks.push({ type: left === withB ? 'lateralPort' : 'lateralStbd', ...R(at(O, F, a, s * 52)), rule: left ? 'port' : 'starboard', legDir: { x: F.u.x, z: F.u.z }, ...extra });
      }
    }
  };
  const F = fr(hdg);
  if (kind === 'channel') {
    const withB = r() < 0.7, Lc = 400 + r() * 120, a0 = 110, a1 = a0 + Lc;
    marks.push({ type: 'safe', ...R(at(E, F, 0, -24)), name: 'Wejście na tor' });
    banks(E, F, a0, a1, [-1, 1]);
    gates(E, F, a0 + 30, a1 - 20, withB);
    notes.push({ ...R(E), r: 480, end: R(at(E, F, a1 + 160, 0)), text: withB ? 'Tor wodny przed dziobem – płyniesz z kierunkiem oznakowania (od morza)' : 'Tor wodny przed dziobem – płyniesz pod prąd kierunku oznakowania (w stronę morza)' });
  } else if (kind === 'fork') {
    const T = 260 + r() * 80, a0 = 110, aS = a0 + T, S = at(E, F, aS, 0), fid = 'f' + id;
    marks.push({ type: 'safe', ...R(at(E, F, 0, -24)), name: 'Wejście na tor' });
    banks(E, F, a0, aS, [-1, 1]);
    gates(E, F, a0 + 30, aS - 50, true, { fork: fid });
    // tor boczny odchodzi o 40° w prawo (sb = 1) albo w lewo (-1); tor główny może lekko skręcać w drugą stronę
    const sb = r() < 0.5 ? 1 : -1, m1 = r() * 12, hm = hdg - sb * m1, hb = hm + sb * 40;
    const Fm = fr(hm), Fb = fr(hb), ub = compassVec(hm + sb * 20), Lc = 430 + r() * 80;
    const take = r() < 0.5 ? 'main' : 'branch';
    banks(S, Fm, 10, Lc, [-sb]);
    banks(S, Fb, 10, Lc, [sb]);
    // język płycizny między torami: od przecięcia wewnętrznych krawędzi (70 m od osi) do końca torów
    const tip = { x: S.x + ub.x * 212, z: S.z + ub.z * 212 };
    shoals.push({ name: 'Płycizna między torami', poly: [[tip.x, tip.z], ...[at(S, Fm, Lc, sb * 70), at(S, Fb, Lc, -sb * 70)].map((p) => [p.x, p.z])], depth: 1.3 });
    // znak rozgałęzienia na przecięciu linii znaków wewnętrznych (52 m od osi); mija się go według wybranego toru
    const prefType = sb < 0 ? 'prefStbd' : 'prefPort';
    const prefRule = (prefType === 'prefStbd') === (take === 'main') ? 'port' : 'starboard';
    const Ft = take === 'main' ? Fm : Fb;
    marks.push({ type: prefType, x: Math.round(S.x + ub.x * 152), z: Math.round(S.z + ub.z * 152), rule: prefRule, fork: fid, gate: 100, legDir: { x: Ft.u.x, z: Ft.u.z } });
    const ends = {};
    for (const [Fc, which] of [[Fm, 'main'], [Fb, 'branch']]) {
      const inner = which === 'main' ? sb : -sb, ex = { fork: fid, channel: which, ...(which !== take ? { off: true } : {}) };
      gates(S, Fc, 60, 60, true, ex, [-inner]);
      gates(S, Fc, 200, Lc - 20, true, ex);
      ends[which] = R(at(S, Fc, Lc + 150, 0));
    }
    notes.push({ ...R(E), r: 480, end: ends[take], text: `Tor wodny z rozwidleniem przed dziobem – za rozwidleniem płyń torem ${take === 'main' ? 'GŁÓWNYM' : 'BOCZNYM'}` });
    forks.push({ id: fid, take, prefType, x: Math.round(S.x), z: Math.round(S.z) });
  } else {
    const C = at(E, F, 150, 0);
    if (kind === 'cardinal') {
      // mielizna; znak kardynalny po stronie bezpiecznej wody (kierunek świata najbliższy jednej z burt)
      const rx = 45 + r() * 30, rz = 35 + r() * 20, Rm = Math.max(rx, rz), s = r() < 0.5 ? 1 : -1;
      shoals.push({ name: 'Mielizna', poly: ell(C.x, C.z, rx, rz, r() * Math.PI, 12), depth: 0.8 + r() * 0.6 });
      const [type, deg] = CARD[Math.round(brgOf(F.v.x * s, F.v.z * s) / 90) % 4], cd = compassVec(deg);
      marks.push({ type, x: Math.round(C.x + cd.x * (Rm + 30)), z: Math.round(C.z + cd.z * (Rm + 30)), gate: 150 });
    } else {
      const name = HAZ[kind].names[Math.floor(r() * HAZ[kind].names.length)];
      if (kind === 'isolated') shoals.push({ name, poly: ell(C.x, C.z, 14, 11, r() * 3, 10), depth: 0.5 });
      if (kind === 'wreck') wrecks.push({ name, ...R(at(C, F, 25 * (r() - 0.5), 25 * (r() - 0.5))), rot: r() * 3 });
      marks.push({ type: kind, ...R(C), name });
    }
  }
  // okrąg obejmujący sytuację (do rozmieszczania kolejnych bez nakładania)
  const pts = [...marks, ...shoals.flatMap((q) => q.poly.map(([x, z]) => ({ x, z }))), ...wrecks];
  const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const rad = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.z - cz))) + (kind === 'wreck' ? 120 : kind === 'special' ? 55 : kind === 'isolated' ? 75 : 20);
  return { id, kind, shoals, marks, wrecks, notes, forks, cx, cz, rad };
}

// Otwarte morze: trasa z kilku waypointów (ok. 3 nm) do boi docelowej; sytuacje pojawiają się w locie przed dziobem (PassageWorld)
function applyOffshore(d, r) {
  const h0 = Math.round(r() * 360);
  let p = { x: 0, z: 0 }, hdg = h0;
  d.route = [{ x: 0, z: 0, name: 'Start' }];
  const n = 4;
  for (let i = 1; i <= n; i++) {
    hdg = h0 + Math.max(-40, Math.min(40, hdg - h0 + (r() - 0.5) * 70));
    const u = compassVec(hdg), L = 1250 + r() * 400;
    p = { x: Math.round(p.x + u.x * L), z: Math.round(p.z + u.z * L) };
    d.route.push({ ...p, name: i === n ? 'Meta – boja' : `WP${i}` });
  }
  const goal = d.route[n], pr = d.route[n - 1], gl = Math.hypot(goal.x - pr.x, goal.z - pr.z);
  d.dynamic = true;
  d.start = { x: 0, z: 0, compass: Math.round(bearingOf(d.route[1].x, d.route[1].z)) };
  d.marks = [{ type: 'safe', x: goal.x - Math.round(((goal.z - pr.z) / gl) * 22), z: goal.z + Math.round(((goal.x - pr.x) / gl) * 22), name: 'Meta' }];
  const xs = d.route.map((q) => q.x), zs = d.route.map((q) => q.z);
  d.keyRoute = null;
  d.spawnSeed = Math.floor(r() * 1e9);
  d.bounds = { minX: Math.min(...xs) - 2500, maxX: Math.max(...xs) + 2500, minZ: Math.min(...zs) - 2500, maxZ: Math.max(...zs) + 2500 };
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

// Pełny opis znaku (typ, zasada mijania, światło, strefa, nazwa)
export function markRecord(m, id) {
  const T = MARK_TYPES[m.type];
  return { id, ...m, rule: m.rule || T.rule, flash: T.flash, radius: T.radius || 0, gate: m.gate ?? T.gate, label: m.name || T.name, typeName: T.name };
}

// Buduje „port” w rozumieniu świata: struktury kolizyjne, znaki, trasa. Zwraca obiekt zgodny z interfejsem World/View3D.
export function buildPassage(id, seed = 1) {
  const d = structuredClone(DEFS[id] || DEFS.baltic);
  if (d.offshore) applyOffshore(d, rng(seed));
  else {
    compact(d);
    applyMeander(d, rng(seed));
  }
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
  const marks = [...handMarks, ...gen].map((m, i) => markRecord(m, 'm' + i));
  const route = d.route.map((p, i) => ({ ...p, i }));
  const keyRoute = d.keyRoute ? d.keyRoute.map((p, i) => ({ ...p, i })) : null;
  const first = route[0], second = route[1];
  const brg = ((Math.atan2(second.x - first.x, -(second.z - first.z)) * 180) / Math.PI + 360) % 360;
  return {
    passage: true, passageId: d.id, name: d.name, style: d.style, depthMax: d.depthMax, relief: d.relief,
    bounds: d.bounds,
    structures, coasts: d.coasts, moles: d.moles, islands: d.islands, shoals: d.shoals, wrecks: d.wrecks, lighthouses: d.lighthouses, villages: d.villages,
    marks, route, routeLength: routeLength(route), start: { ...d.start, compass: d.start.compass ?? brg },
    offshore: !!d.offshore, dynamic: !!d.dynamic, spawnSeed: d.spawnSeed, keyRoute, notes: d.notes || [], forks: d.forks || [],
    // pola wymagane przez World / widok portu (puste w rejsie)
    neighbors: [], bollards: [], murings: [], deco: [], starts: [],
    berth: { x: first.x, z: first.z, th: 0, tolAlong: 1, tolAcross: 1, tolTh: 1, frame: null },
    quay: { height: 1 }, port: { walkways: [], motor: null }, method: 'passage', exitZone: null
  };
}

export { sideOffset };
