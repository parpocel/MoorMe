// Akweny do rejsu wzdłuż wybrzeża: lądy, wyspy, mielizny, znaki nawigacyjne IALA (region A) i trasa z waypointami.
// Układ świata jak w porcie: x – wschód, z – południe (północ = -z), jednostki w metrach.
import { compassVec } from '../math.js';

// Rodzaje znaków. rule: 'port' – znak ma zostać po lewej burcie, 'starboard' – po prawej,
// 'N'|'E'|'S'|'W' – znak kardynalny: mijamy go od tej strony, 'near' – znak wody bezpiecznej (trzymaj się go blisko),
// 'avoid' – niebezpieczeństwo: nie wpływaj w strefę o promieniu radius.
export const MARK_TYPES = {
  lateralPort: { id: 'lateralPort', name: 'Znak boczny lewy (czerwony)', rule: 'port', gate: 260, color: 0xd62828, flash: 'R' },
  lateralStbd: { id: 'lateralStbd', name: 'Znak boczny prawy (zielony)', rule: 'starboard', gate: 260, color: 0x1f9d55, flash: 'G' },
  cardN: { id: 'cardN', name: 'Znak kardynalny północny', rule: 'N', gate: 300, flash: 'VQ' },
  cardE: { id: 'cardE', name: 'Znak kardynalny wschodni', rule: 'E', gate: 300, flash: 'VQ3' },
  cardS: { id: 'cardS', name: 'Znak kardynalny południowy', rule: 'S', gate: 300, flash: 'VQ6' },
  cardW: { id: 'cardW', name: 'Znak kardynalny zachodni', rule: 'W', gate: 300, flash: 'VQ9' },
  safe: { id: 'safe', name: 'Znak wody bezpiecznej', rule: 'near', gate: 160, flash: 'ISO' },
  isolated: { id: 'isolated', name: 'Znak odosobnionego niebezpieczeństwa', rule: 'avoid', radius: 75, gate: 220, flash: 'FL2' },
  wreck: { id: 'wreck', name: 'Znak nowego niebezpieczeństwa (wrak)', rule: 'avoid', radius: 120, gate: 260, flash: 'WRECK' },
  special: { id: 'special', name: 'Znak szczególny (żółty)', rule: 'avoid', radius: 55, gate: 160, flash: 'FLY' }
};

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
    desc: 'Płaski, piaszczysty brzeg z lasem i wsiami. Na trasie mielizna oznaczona kardynałami, wrak, skała oznaczona znakiem odosobnionego niebezpieczeństwa i strefa regat. Płyniesz z zachodu na wschód do portu za główkami.',
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
    shoals: [
      { name: 'Ławica Rybacka', poly: [[2250, -300], [2600, -340], [2950, -280], [2900, -150], [2550, -110], [2200, -170]], depth: 1.0 },
      { name: 'Mielizna Zachodnia', poly: ell(900, -60, 95, 70, 0.1, 12), depth: 1.2 },
      { name: 'Skała Rybacka', poly: ell(4300, -40, 26, 22, 0, 10), depth: 0.6 }
    ],
    wrecks: [{ name: 'Wrak „Maria”', x: 3800, z: -150, rot: 0.6 }],
    lighthouses: [{ x: 5200, z: -200, color: 0xd62828, name: 'Latarnia Przylądek' }],
    villages: [{ x: 1300, z: -330, n: 8 }, { x: 3600, z: -380, n: 6 }, { x: 5900, z: -300, n: 10 }, { x: 6760, z: -400, n: 12 }],
    start: { x: -1200, z: 30, compass: 90 },
    route: [
      { x: -1200, z: 30, name: 'Start' }, { x: -600, z: 30, name: 'WP1 – wejście w tor' }, { x: 700, z: 100, name: 'WP2' },
      { x: 1900, z: 150, name: 'WP3 – przed mielizną' }, { x: 2600, z: 120, name: 'WP4 – za mielizną' }, { x: 3700, z: 90, name: 'WP5 – trawers wraku' },
      { x: 4600, z: 130, name: 'WP6' }, { x: 5500, z: 200, name: 'WP7 – za przylądkiem' }, { x: 6460, z: 60, name: 'WP8 – przed główkami' },
      { x: 6460, z: -190, name: 'Meta – port' }
    ],
    marks: [
      { type: 'safe', x: -1000, z: -10, name: 'Pława startowa' },
      { type: 'lateralPort', x: -600, z: -50 }, { type: 'lateralStbd', x: -600, z: 130 },
      { type: 'lateralPort', x: 100, z: -15 }, { type: 'lateralStbd', x: 120, z: 160 },
      { type: 'cardS', x: 900, z: 40, name: 'Mielizna Zachodnia – S' },
      { type: 'cardW', x: 2120, z: -235, name: 'Ławica – W', gate: 200 }, { type: 'cardS', x: 2575, z: -70, name: 'Ławica – S' }, { type: 'cardE', x: 3040, z: -215, name: 'Ławica – E', gate: 200 },
      { type: 'wreck', x: 3800, z: -215, name: 'Wrak „Maria”' },
      { type: 'isolated', x: 4300, z: -40, name: 'Skała Rybacka' },
      { type: 'special', x: 5000, z: 55, name: 'Strefa regat' },
      { type: 'lateralPort', x: 5880, z: 40 }, { type: 'lateralStbd', x: 5940, z: 215 },
      { type: 'lateralPort', x: 6390, z: -60 }, { type: 'lateralStbd', x: 6530, z: -60 }
    ]
  },
  adriatic: {
    id: 'adriatic',
    name: 'Adriatyk – kanały między wyspami',
    desc: 'Skalisty brzeg i wyspy z sosnami i kamiennymi domami. Wąski kanał z kilkoma znakami bocznymi, skała oznaczona znakiem odosobnionego niebezpieczeństwa, kardynał przy wyspie, wrak i płycizna. Trasa prowadzi z zachodu na wschód do portu w głębi zatoki.',
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
    islands: [
      { name: 'Otok Prvi', poly: ell(900, -250, 260, 190, 0.3), h: 46 },
      { name: 'Otok Drugi', poly: ell(2300, 300, 380, 260, -0.2), h: 78 },
      { name: 'Otok Trzeci', poly: ell(3600, 20, 130, 90, 0.5), h: 26 },
      { name: 'Otok Czwarty', poly: ell(4900, 320, 320, 230, 0.1), h: 62 },
      { name: 'Hrid Mały', poly: ell(1600, -40, 55, 40, 0, 10), h: 9 }
    ],
    shoals: [
      { name: 'Hrid', poly: ell(3000, -120, 30, 26, 0, 10), depth: 0.5 },
      { name: 'Plićak', poly: ell(5600, -200, 140, 70, 0.1, 12), depth: 1.3 }
    ],
    wrecks: [{ name: 'Wrak „Galeb”', x: 4350, z: 100, rot: -0.4 }],
    lighthouses: [{ x: 3560, z: -20, color: 0xd62828, name: 'Latarnia Trzeci' }],
    villages: [{ x: 6760, z: -480, n: 12 }, { x: 2300, z: 40, n: 5 }, { x: 4900, z: 110, n: 6 }],
    start: { x: -1200, z: -20, compass: 90 },
    route: [
      { x: -1200, z: -20, name: 'Start' }, { x: -300, z: 20, name: 'WP1 – wejście w tor' }, { x: 800, z: 200, name: 'WP2 – za Otokiem Pierwszym' },
      { x: 1800, z: 80, name: 'WP3 – kanał' }, { x: 2800, z: -230, name: 'WP4 – północ Otoka Drugiego' }, { x: 3900, z: -260, name: 'WP5 – nad Otokiem Trzecim' },
      { x: 5000, z: -60, name: 'WP6 – południe Plićaka' }, { x: 5900, z: 0, name: 'WP7' }, { x: 6460, z: -20, name: 'WP8 – przed główkami' },
      { x: 6460, z: -340, name: 'Meta – port' }
    ],
    marks: [
      { type: 'safe', x: -1000, z: -50, name: 'Pława startowa' },
      { type: 'lateralPort', x: -300, z: -60 }, { type: 'lateralStbd', x: -300, z: 100 },
      { type: 'lateralPort', x: 1290, z: 60 }, { type: 'lateralStbd', x: 1310, z: 220 },
      { type: 'lateralPort', x: 1950, z: -40 }, { type: 'lateralStbd', x: 2020, z: 190 },
      { type: 'isolated', x: 3000, z: -120, name: 'Hrid' },
      { type: 'cardN', x: 3600, z: -120, name: 'Otok Trzeci – N' },
      { type: 'wreck', x: 4350, z: 40, name: 'Wrak „Galeb”' },
      { type: 'special', x: 5300, z: -230, name: 'Kabel podwodny' },
      { type: 'cardS', x: 5600, z: -105, name: 'Plićak – S' },
      { type: 'lateralPort', x: 6390, z: -150 }, { type: 'lateralStbd', x: 6530, z: -150 }
    ]
  }
};

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

export function routeLength(route) {
  let L = 0;
  for (let i = 1; i < route.length; i++) L += Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z);
  return L;
}

// Buduje „port” w rozumieniu świata: struktury kolizyjne, znaki, trasa. Zwraca obiekt zgodny z interfejsem World/View3D.
export function buildPassage(id) {
  const d = DEFS[id] || DEFS.baltic;
  const structures = [];
  const polyBox = (poly) => poly;
  for (const c of d.coasts) for (const p of coastPolys(c.pts, c.D)) structures.push({ kind: 'land', style: 'coast', poly: p, h: 3, walk: false });
  for (const m of d.moles) structures.push({ kind: 'breakwater', style: 'concrete', poly: polyBox(m), h: 2.6, walk: false });
  for (const isl of d.islands) structures.push({ kind: 'land', style: 'island', poly: isl.poly, h: isl.h, walk: false, name: isl.name });
  for (const s of d.shoals) structures.push({ kind: 'shoal', style: 'shoal', poly: s.poly, h: 0, walk: false, depth: s.depth, name: s.name });
  const marks = d.marks.map((m, i) => {
    const T = MARK_TYPES[m.type];
    return { id: 'm' + i, ...m, rule: T.rule, radius: T.radius || 0, gate: m.gate ?? T.gate, label: m.name || T.name, typeName: T.name };
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
