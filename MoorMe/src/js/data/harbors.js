// Porty: stałe mapy (ląd, falochrony, keje, pomosty) + strefy stanowisk wzdłuż krawędzi.
// Strefa ma własny układ lokalny: u – wzdłuż krawędzi, v – w głąb wody (v < 0 to keja/pomost).
// Wewnątrz strefy generowane są polery, muringi, Y-bomy, dalby i sąsiednie jachty, a potem
// przekształcane do świata (x – wschód, z – południe, północ = -z).
import { rectPoly, rng } from '../math.js';
import { BOATS, hullOutline, halfBeamAt } from './boats.js';

// Typy nabrzeża w strefie (wysokość, rodzaj polerów)
export const QUAYS = {
  stone: { id: 'stone', name: 'Kamienne nabrzeże (riva)', height: 1.0, bollard: 'bollard', setback: 0.6, rings: true },
  concrete: { id: 'concrete', name: 'Nabrzeże betonowe', height: 1.3, bollard: 'bollard', setback: 0.55, rings: false },
  pontoon: { id: 'pontoon', name: 'Pomost pływający', height: 0.6, bollard: 'cleat', setback: 0.3, rings: true },
  wood: { id: 'wood', name: 'Drewniana keja / pomost', height: 0.9, bollard: 'cleat', setback: 0.35, rings: false }
};

export const METHODS = {
  longside: { id: 'longside', name: 'Burtą (longside)', desc: 'Równolegle do kei, między innymi jachtami. Cumy dziobowa, rufowa, szpringi i bresty.' },
  mooringStern: { id: 'mooringStern', name: 'Rufą z muringiem', desc: 'Cofanie do kei, cumy rufowe na keję, dziób trzymany muringiem z dna.' },
  mooringBow: { id: 'mooringBow', name: 'Dziobem z muringiem', desc: 'Dziobem do kei, rufa trzymana muringiem (przydatne przy wietrze od rufy).' },
  yboomBow: { id: 'yboomBow', name: 'Y-bomy – dziobem', desc: 'Wejście dziobem między wysięgniki, cumy dziobowe na pomost, boczne na końce bomów.' },
  yboomStern: { id: 'yboomStern', name: 'Y-bomy – rufą', desc: 'Cofanie między wysięgniki, cumy rufowe na pomost, boczne na bomy.' },
  pilesBow: { id: 'pilesBow', name: 'Dziobem do pomostu, rufa na dalbach', desc: 'Przy przejściu między dalbami zakładasz cumy rufowe na pale, dziób do pomostu.' },
  pilesStern: { id: 'pilesStern', name: 'Rufą do pomostu, dziób na dalbach', desc: 'Cofanie między dalbami, cumy dziobowe na pale, rufowe na pomost.' }
};

// ---------- Mapy portów ----------
const R4 = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

export const PORTS = {
  med: {
    id: 'med',
    name: 'Adriatyk – marina i riva (Dalmacja)',
    desc: 'Zatoka w dalmatyńskim miasteczku: kamienna riva z cumowaniem rufą na muringach, betonowe pomosty mariny, falochron z keją do cumowania burtą. Wejście od południa między czerwonym a zielonym światłem.',
    style: 'med',
    bounds: { minX: -175, maxX: 200, minZ: -45, maxZ: 255 },
    structures: [
      { kind: 'quay', style: 'stone', poly: R4(-150, -60, 185, 0), h: 1.0, walk: true, edges: [[-150, 0, 48.5, 0], [51.5, 0, 118.5, 0], [121.5, 0, 185, 0]] },
      { kind: 'land', style: 'rock', poly: R4(-280, -60, -150, 260), h: 3.5 },
      { kind: 'land', style: 'rock', poly: R4(185, -60, 300, 260), h: 3.5 },
      { kind: 'breakwater', style: 'concrete', poly: R4(20, 150, 185, 168), h: 1.4, walk: true, edges: [[20, 150, 185, 150]] },
      { kind: 'breakwater', style: 'rock', poly: R4(-150, 178, -85, 192), h: 2.0 },
      { kind: 'pontoon', poly: R4(48.5, 0, 51.5, 98), h: 0.6, walk: true, edges: [[48.5, 0, 48.5, 98], [51.5, 0, 51.5, 98]] },
      { kind: 'pontoon', poly: R4(118.5, 0, 121.5, 98), h: 0.6, walk: true, edges: [[118.5, 0, 118.5, 98], [121.5, 0, 121.5, 98]] }
    ],
    deco: [
      { type: 'lighthouse', x: -88, z: 185, color: 0xd62828 },
      { type: 'lighthouse', x: 24, z: 159, color: 0x2a9d4a }
    ],
    zones: [
      { id: 'riva', name: 'Riva – kamienne nabrzeże miejskie', a: [-140, 0], b: [26, 0], quay: 'stone', methods: ['mooringStern', 'mooringBow'], ownU: 20 },
      { id: 'pierA', name: 'Pomost A (strona wschodnia)', a: [51.5, 94], b: [51.5, 4], quay: 'pontoon', methods: ['mooringStern', 'mooringBow'], ownU: 0 },
      { id: 'pierAw', a: [48.5, 4], b: [48.5, 94], quay: 'pontoon', decor: 'mooringStern' },
      { id: 'pierBw', a: [118.5, 4], b: [118.5, 94], quay: 'pontoon', decor: 'mooringBow' },
      { id: 'pierBe', a: [121.5, 94], b: [121.5, 4], quay: 'pontoon', decor: 'mooringStern' },
      { id: 'breakwater', name: 'Falochron – keja wewnętrzna', a: [178, 150], b: [28, 150], quay: 'concrete', methods: ['longside'], ownU: -10 }
    ],
    starts: [
      { id: 'entrance', name: 'Wejście do portu (między główkami)', x: -32, z: 172, compass: 347 },
      { id: 'basin', name: 'Środek zatoki', x: -30, z: 95, compass: 80 },
      { id: 'marina', name: 'Przed mariną', x: 85, z: 125, compass: 340 }
    ],
    exit: { x: -35, z: 215 },
    walkways: [{ a: [-140, -5.5], b: [175, -5.5], y: 1.0 }, { a: [-140, -13.5], b: [40, -13.5], y: 1.0 }, { a: [28, 158], b: [180, 158], y: 1.4 }],
    motor: { cx: -85, cz: 112, rx: 42, rz: 22 }
  },
  ystad: {
    id: 'ystad',
    name: 'Ystad – Småbåtshamn (Bałtyk)',
    desc: 'Szwedzka marina na wzór Ystad: drewniane pomosty z dalbami i Y-bomami, długi pomost wzdłuż zachodniego falochronu do cumowania burtą, muringi przy kei północnej. Obok mola promowego; podejście od południa kursem ~19°.',
    style: 'baltic',
    bounds: { minX: -175, maxX: 160, minZ: -45, maxZ: 260 },
    structures: [
      { kind: 'quay', style: 'wood', poly: R4(-150, -60, 60, 0), h: 1.0, walk: true, edges: [[-135, 0, -95, 0], [-92.5, 0, -40, 0], [-37.5, 0, 15, 0], [17.5, 0, 60, 0]] },
      { kind: 'land', style: 'sand', poly: R4(-300, -60, -150, 260), h: 1.2 },
      { kind: 'breakwater', style: 'rock', poly: R4(-150, 0, -138, 200), h: 2.0 },
      { kind: 'pier', style: 'wood', poly: R4(-138, 4, -135, 186), h: 1.0, walk: true, edges: [[-135, 4, -135, 186]] },
      { kind: 'breakwater', style: 'rock', poly: R4(-150, 190, -42, 204), h: 2.0 },
      { kind: 'breakwater', style: 'concrete', poly: R4(60, -60, 76, 232), h: 2.6 },
      { kind: 'land', style: 'port', poly: R4(76, -60, 260, 0), h: 2.0 },
      { kind: 'land', style: 'port', poly: R4(150, 0, 260, 260), h: 2.0 },
      { kind: 'pier', style: 'wood', poly: R4(-95, 0, -92.5, 96), h: 0.9, walk: true, edges: [[-95, 0, -95, 96], [-92.5, 0, -92.5, 96]] },
      { kind: 'pier', style: 'wood', poly: R4(-40, 0, -37.5, 96), h: 0.8, walk: true, edges: [[-40, 0, -40, 96], [-37.5, 0, -37.5, 96]] },
      { kind: 'pier', style: 'wood', poly: R4(15, 0, 17.5, 84), h: 0.8, walk: true, edges: [[15, 0, 15, 84], [17.5, 0, 17.5, 84]] }
    ],
    deco: [
      { type: 'lighthouse', x: -46, z: 197, color: 0xd62828 },
      { type: 'lighthouse', x: 68, z: 226, color: 0x2a9d4a },
      { type: 'ferry', x: 108, z: 100, th: -Math.PI / 2 }
    ],
    zones: [
      { id: 'north', name: 'Keja północna – muringi', a: [26, 0], b: [58, 0], quay: 'wood', methods: ['mooringStern', 'mooringBow'], ownU: 0 },
      { id: 'pierAe', name: 'Pomost A – dalby (strona wschodnia)', a: [-92.5, 92], b: [-92.5, 4], quay: 'wood', methods: ['pilesBow', 'pilesStern'], ownU: 4 },
      { id: 'pierAw', a: [-95, 4], b: [-95, 92], quay: 'wood', decor: 'pilesBow' },
      { id: 'pierBe', name: 'Pomost B – Y-bomy (strona wschodnia)', a: [-37.5, 92], b: [-37.5, 4], quay: 'wood', methods: ['yboomBow', 'yboomStern'], ownU: 4 },
      { id: 'pierBw', a: [-40, 4], b: [-40, 92], quay: 'wood', decor: 'yboomBow' },
      { id: 'pierCw', a: [15, 4], b: [15, 80], quay: 'wood', decor: 'yboomBow' },
      { id: 'pierCe', a: [17.5, 80], b: [17.5, 4], quay: 'wood', decor: 'longside' },
      { id: 'west', name: 'Pomost wzdłuż falochronu – burtą', a: [-135, 180], b: [-135, 10], quay: 'wood', methods: ['longside'], ownU: -20 }
    ],
    starts: [
      { id: 'entrance', name: 'Wejście do portu (między główkami)', x: 11, z: 211, compass: 14 },
      { id: 'basin', name: 'Środek basenu', x: -60, z: 140, compass: 60 },
      { id: 'east', name: 'Wschodnia część basenu', x: 40, z: 120, compass: 300 }
    ],
    exit: { x: -15, z: 225 },
    walkways: [{ a: [-140, -5], b: [55, -5], y: 1.0 }, { a: [-140, -12], b: [55, -12], y: 1.0 }, { a: [-136.5, 12], b: [-136.5, 182], y: 1.0 }],
    motor: { cx: 112, cz: 212, rx: 26, rz: 10 }
  }
};

// Opcje stanowisk w porcie: [{ id, zone, method, name }]
export function berthOptions(portId) {
  const P = PORTS[portId];
  const out = [];
  for (const z of P.zones) {
    if (!z.methods) continue;
    for (const m of z.methods) out.push({ id: `${z.id}:${m}`, zone: z.id, method: m, name: `${z.name}: ${METHODS[m].name.toLowerCase()}`, zoneName: z.name, quay: z.quay });
  }
  return out;
}

// Prześwit stanowiska ponad szerokość jachtu (Y-bomy / dalby), w metrach – ustawiany w kreatorze
export const SLOT_CLEAR_DEFAULT = { yboom: 0.5, piles: 0.65 };
export function slotKind(method) {
  return method.startsWith('yboom') ? 'yboom' : method.startsWith('piles') ? 'piles' : null;
}
export function slotClearFor(cfg) {
  const k = slotKind(cfg.method);
  if (!k) return null;
  const v = cfg.slotClear && cfg.slotClear[k];
  return typeof v === 'number' ? v : SLOT_CLEAR_DEFAULT[k];
}
// Opcje generatora portu z konfiguracji kreatora
export function harborOpts(cfg, spec) {
  const clear = slotClearFor(cfg);
  return { port: cfg.port, zone: cfg.zone, method: cfg.method, side: cfg.side, boatSpec: spec, scenario: cfg.scenario, seed: cfg.seed || 7, slotWidth: clear != null ? spec.beam + clear : undefined };
}
// Poprawienie starych/niepełnych konfiguracji (wybór portu i strefy dla metody)
export function normalizeBerth(cfg) {
  if (!PORTS[cfg.port]) cfg.port = ['yboomBow', 'yboomStern', 'pilesBow', 'pilesStern'].includes(cfg.method) ? 'ystad' : 'med';
  const opts = berthOptions(cfg.port);
  let o = opts.find((x) => x.zone === cfg.zone && x.method === cfg.method) || opts.find((x) => x.method === cfg.method) || opts[0];
  cfg.zone = o.zone;
  cfg.method = o.method;
  return cfg;
}

// ---------- Układ lokalny strefy ----------
export function makeFrame(a, b, water = 1) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const ax = dx / len, az = dz / len;
  const nx = -az * water, nz = ax * water;
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  return {
    mx, mz, ax, az, nx, nz, len,
    toWorld: (u, v) => ({ x: mx + ax * u + nx * v, z: mz + az * u + nz * v }),
    toLocal: (x, z) => ({ u: (x - mx) * ax + (z - mz) * az, v: (x - mx) * nx + (z - mz) * nz }),
    // kąt kursu: lokalny kierunek (cos t, sin t) w (u, v) -> kąt w świecie
    angle: (t) => Math.atan2(az * Math.cos(t) + nz * Math.sin(t), ax * Math.cos(t) + nx * Math.sin(t))
  };
}

function struct(kind, poly, h, walk = false, extra = {}) {
  return { kind, poly, h, walk, ...extra };
}

function boatPolyWorld(spec, x, z, th, pad = 0) {
  const out = hullOutline(spec, 8);
  const c = Math.cos(th), s = Math.sin(th);
  return out.map(([lx, ly]) => {
    const k = 1 + pad / spec.beam;
    return [x + lx * c - ly * k * s, z + lx * s + ly * k * c];
  });
}

const NEIGHBOR_COLORS = [0xffffff, 0xf3f0e6, 0x1d3557, 0xffffff, 0xe9edf0, 0x8a1c1c, 0xffffff, 0x274c3a, 0xf7f7f7, 0x2f3e57];
const NEIGHBOR_TYPES = ['C34', 'C46', 'C50', 'C34', 'C46'];

function kindLabel(k) {
  return { bollard: 'Poler', cleat: 'Knaga', ring: 'Pierścień', pile: 'Dalba' }[k] || 'Poler';
}

/**
 * Generuje zawartość jednej strefy (polery, muringi, bomy, dalby, sąsiedzi) i dopisuje ją do H.
 * own: { method, spec, side, slotWidth } dla strefy z naszym stanowiskiem, albo null (strefa dekoracyjna).
 */
function genZone(H, Z, own, R, ctx) {
  const F = makeFrame(Z.a, Z.b, 1);
  const q = QUAYS[Z.quay];
  const qh = Z.h || q.height;
  const method = own ? own.method : Z.decor;
  const half = F.len / 2;
  const pickSpec = () => BOATS[NEIGHBOR_TYPES[Math.floor(R() * NEIGHBOR_TYPES.length)]];
  const addBollard = (u, v, kind, h, label, extra = {}) => {
    const w = F.toWorld(u, v);
    const ap = extra.onBoom ? w : F.toWorld(u, v - 0.6);
    const b = { id: 'b' + ctx.bid++, x: w.x, z: w.z, kind, h, label: label || kindLabel(kind), zone: Z.id, onQuay: !extra.onBoom && kind !== 'pile', approach: { x: ap.x, z: ap.z }, ...extra };
    H.bollards.push(b);
    return b;
  };
  const qTo = (u, v, y) => { const w = F.toWorld(u, v); return { x: w.x, y, z: w.z }; };
  // sąsiad z liną: liny w układzie jachtu -> punkty docelowe w świecie
  const addNeighbor = (spec, u, v, tLocal, extra = {}) => {
    const w = F.toWorld(u, v);
    const n = { spec, x: w.x, z: w.z, th: F.angle(tLocal), color: NEIGHBOR_COLORS[Math.floor(R() * NEIGHBOR_COLORS.length)], ropes: [], zone: Z.id, ...extra };
    H.neighbors.push(n);
    return n;
  };
  // punkt na jachcie (lx wzdłuż, ly w poprzek) -> lokalne (u, v) strefy
  const boatLocal = (n, lx, ly) => {
    const c = Math.cos(n.th), s = Math.sin(n.th);
    const wx = n.x + lx * c - ly * s, wz = n.z + lx * s + ly * c;
    return F.toLocal(wx, wz);
  };
  let berth = null;

  if (method === 'longside') {
    // lewa burta do kei => dziób w kierunku +u
    const sideQ = own && own.side === 'starboard' ? 1 : -1;
    const step = q.bollard === 'bollard' ? 7 : 4.5;
    for (let u = -half + 2; u <= half - 2; u += step) addBollard(u, -q.setback, q.bollard, qh);
    if (q.rings) for (let u = -half + 4; u <= half - 4; u += 9) addBollard(u, -0.18, 'ring', qh);
    const place = (spec, uc, pad = 0.33) => {
      const th = R() < 0.5 ? 0 : Math.PI;
      const n = addNeighbor(spec, uc, spec.beam / 2 + pad, th, { alongside: true });
      const qs = th === 0 ? -1 : 1; // burta od kei
      const { xs, xb } = { xs: -0.48 * spec.loa, xb: 0.52 * spec.loa };
      for (const [lx, du] of [[xb - 1, 2.5], [xs + 0.5, -2.5]]) {
        const p = boatLocal(n, lx, qs * halfBeamAt(spec, lx));
        const dir = Math.sign(boatLocal(n, 1, 0).u - boatLocal(n, 0, 0).u) || 1;
        n.ropes.push({ lx, ly: qs * halfBeamAt(spec, lx), to: qTo(p.u + du * dir, -0.5, qh + 0.3), sag: 0.3 });
      }
    };
    if (own) {
      const spec = own.spec, L = spec.loa, B = spec.beam;
      const u0 = Z.ownU || 0;
      const tl = sideQ === -1 ? 0 : Math.PI;
      const w = F.toWorld(u0, B / 2 + 0.33);
      berth = { x: w.x, z: w.z, th: F.angle(tl), tolAlong: 2.5, tolAcross: 0.7, tolTh: 9, u: u0 };
      const free = 1.7 * L;
      let ur = u0 + free / 2, ul = u0 - free / 2;
      for (let i = 0; i < 8; i++) {
        const sR = pickSpec(), sL = pickSpec();
        if (ur + sR.loa < half - 1) place(sR, ur + sR.loa / 2);
        if (ul - sL.loa > -half + 1) place(sL, ul - sL.loa / 2);
        ur += sR.loa + 1.2 + R() * 1.5;
        ul -= sL.loa + 1.2 + R() * 1.5;
      }
    } else {
      let u = -half + 2;
      while (true) {
        const s = pickSpec();
        if (u + s.loa > half - 1) break;
        if (R() > 0.15) place(s, u + s.loa / 2);
        u += s.loa + 1.5 + R() * 3;
      }
    }
  } else {
    // stanowiska prostopadłe (rufą / dziobem)
    const bowIn = ['mooringBow', 'yboomBow', 'pilesBow'].includes(method);
    const pad = method.startsWith('yboom') ? 0.86 : method.startsWith('piles') ? 1.05 : 0.9;
    const divider = method.startsWith('yboom') ? 0.36 : method.startsWith('piles') ? 0.4 : 0;
    const slots = [];
    let refL = 14.7; // długość do rozstawu dalb / bomów w strefie
    // przy dalbach sąsiedzi nie mogą być dłuźsi niż rozstaw dalb od pomostu
    const pickFor = () => { let sp = pickSpec(); if (method.startsWith('piles') && sp.loa > refL + 0.3) sp = own ? own.spec : BOATS.C34; return sp; };
    if (own) {
      const spec = own.spec, L = spec.loa, B = spec.beam;
      refL = L;
      const slotW = own.slotWidth && divider ? own.slotWidth + divider : B + pad;
      const u0 = Z.ownU || 0;
      slots.push({ u: u0, w: slotW, own: true });
      let ur = u0 + slotW / 2, ul = u0 - slotW / 2;
      for (let i = 0; i < 30; i++) {
        const sR = pickFor(), sL = pickFor();
        const wR = sR.beam + pad, wL = sL.beam + pad;
        if (ur + wR < half - 0.5) { slots.push({ u: ur + wR / 2, w: wR, spec: sR }); ur += wR; }
        if (ul - wL > -half + 0.5) { slots.push({ u: ul - wL / 2, w: wL, spec: sL }); ul -= wL; }
      }
      const gapQ = bowIn ? 1.0 : 0.75;
      const vc = (bowIn ? 0.52 * L : 0.48 * L) + gapQ;
      const w = F.toWorld(u0, vc);
      berth = { x: w.x, z: w.z, th: F.angle(bowIn ? -Math.PI / 2 : Math.PI / 2), tolAlong: 0.9, tolAcross: 0.55, tolTh: 7, slotW, bowIn, u: u0 };
      if (method.startsWith('piles')) berth.pileV = gapQ + L + 1.2;
      if (method.startsWith('yboom')) berth.boomV = 0.72 * L;
    } else {
      let u = -half + 1;
      while (true) {
        const s = pickFor();
        const w = s.beam + pad;
        if (u + w > half - 0.5) break;
        slots.push({ u: u + w / 2, w, spec: s });
        u += w;
      }
    }
    slots.sort((a, b) => a.u - b.u);
    const isMooring = method.startsWith('mooring');
    for (const s of slots) {
      addBollard(s.u - s.w / 2 + 0.25, -q.setback, q.bollard, qh);
      if (s.own) addBollard(s.u + s.w / 2 - 0.25, -q.setback, q.bollard, qh);
      if (isMooring && q.rings) addBollard(s.u, -0.2, 'ring', qh);
      if (s.own) continue;
      const dist = Math.abs(s.u - (Z.ownU || 0));
      if ((!own || dist > (own ? 8 : 0)) && R() < 0.14) { s.empty = true; continue; }
      const nSpec = s.spec;
      const nBowIn = R() < 0.2 ? !bowIn : bowIn;
      const nv = (nBowIn ? 0.52 * nSpec.loa : 0.48 * nSpec.loa) + (nBowIn ? 1.0 : 0.75);
      const n = addNeighbor(nSpec, s.u, nv, nBowIn ? -Math.PI / 2 : Math.PI / 2);
      s.nBowIn = nBowIn;
      const xs = -0.48 * nSpec.loa, xb = 0.52 * nSpec.loa;
      const quayEndX = nBowIn ? xb - 0.6 : xs + 0.4;
      const farX = nBowIn ? xs + 0.4 : xb - 0.4;
      for (const sd of [-1, 1]) {
        const ly = sd * halfBeamAt(nSpec, quayEndX) * 0.85;
        const p = boatLocal(n, quayEndX, ly);
        n.ropes.push({ lx: quayEndX, ly, to: qTo(p.u + Math.sign(p.u - s.u) * 0.8, -0.45, qh + 0.3), sag: 0.25 });
      }
      if (isMooring) {
        const p = boatLocal(n, farX, 0);
        n.ropes.push({ lx: farX, ly: 0, to: qTo(p.u, p.v + 7, -1.5), sag: 0.6, grey: true });
      }
      s.neighbor = n;
    }
    const last = slots[slots.length - 1];
    if (last) addBollard(last.u + last.w / 2 - 0.25, -q.setback, q.bollard, qh);

    if (isMooring) {
      for (const s of slots) {
        const vA = (own ? refL : 13) * 1.9 + 1;
        const an = F.toWorld(s.u + (R() - 0.5) * 0.6, vA);
        const pk = F.toWorld(s.u + s.w * 0.22, -0.25);
        H.murings.push({ id: 'm' + H.murings.length, own: !!s.own, anchor: { x: an.x, z: an.z, depth: 5.5 }, pickup: { x: pk.x, z: pk.z } });
      }
    }
    // krawędzie slotów – tam stoją bomy / dalby
    const edges = new Set();
    for (const s of slots) { edges.add(+(s.u - s.w / 2).toFixed(3)); edges.add(+(s.u + s.w / 2).toFixed(3)); }
    if (method.startsWith('yboom')) {
      const bl = 0.72 * refL;
      if (own) H.boomLen = bl;
      const th = Math.atan2(F.nz, F.nx);
      for (const ue of edges) {
        const c = F.toWorld(ue, bl / 2);
        H.structures.push(struct('boom', rectPoly(c.x, c.z, bl, 0.36, th), qh * 0.8, true, { zone: Z.id }));
        addBollard(ue, bl - 0.35, 'ring', qh * 0.8, 'Pierścień na końcu Y-bomu', { onBoom: true });
        addBollard(ue, bl * 0.5, 'ring', qh * 0.8, 'Pierścień na Y-bomie', { onBoom: true });
      }
      for (const s of slots) {
        if (!s.neighbor) continue;
        const n = s.neighbor;
        for (const sd of [-1, 1]) {
          const ly = sd * halfBeamAt(n.spec, 0);
          const p = boatLocal(n, 0, ly);
          const ue = p.u > s.u ? s.u + s.w / 2 : s.u - s.w / 2;
          n.ropes.push({ lx: 0, ly, to: qTo(ue, bl - 0.35, qh * 0.8 + 0.1), sag: 0.2 });
        }
      }
    }
    if (method.startsWith('piles')) {
      const pv = (bowIn ? 1.0 : 0.75) + refL + 1.2;
      for (const ue of edges) {
        const c = F.toWorld(ue, pv);
        const rr = 0.2;
        const oct = [];
        for (let k = 0; k < 8; k++) oct.push([c.x + rr * Math.cos((k * Math.PI) / 4), c.z + rr * Math.sin((k * Math.PI) / 4)]);
        H.structures.push(struct('pile', oct, 3.0, false, { cx: c.x, cz: c.z, r: rr, zone: Z.id }));
        addBollard(ue, pv, 'pile', 2.2, 'Dalba');
      }
      for (const s of slots) {
        if (!s.neighbor) continue;
        const n = s.neighbor;
        const farX = s.nBowIn ? -0.48 * n.spec.loa + 0.4 : 0.52 * n.spec.loa - 0.4;
        for (const sd of [-1, 1]) {
          const ly = sd * halfBeamAt(n.spec, farX) * 0.8;
          const p = boatLocal(n, farX, ly);
          const ue = p.u > s.u ? s.u + s.w / 2 : s.u - s.w / 2;
          n.ropes.push({ lx: farX, ly, to: qTo(ue, pv, 2.4), sag: 0.35 });
        }
      }
    }
  }
  if (berth) {
    berth.frame = F;
    berth.zone = Z.id;
    berth.quayNormal = { x: -F.nx, z: -F.nz }; // od wody w stronę kei
    H.quay = { ...q, height: qh };
  }
  return berth;
}

/**
 * @param {object} opt { port, zone, method, side, boatSpec, scenario, seed, slotWidth }
 */
export function generateHarbor(opt) {
  const cfg = normalizeBerth({ port: opt.port, zone: opt.zone, method: opt.method });
  const P = PORTS[cfg.port];
  const spec = opt.boatSpec;
  const R = rng(opt.seed || 7);
  const H = {
    port: P, portId: P.id, style: P.style, method: cfg.method, zoneId: cfg.zone,
    structures: [], bollards: [], murings: [], neighbors: [], deco: [...P.deco],
    berth: null, starts: [], bounds: P.bounds
  };
  for (const s of P.structures) H.structures.push(struct(s.kind, s.poly, s.h, !!s.walk, { style: s.style, edges: s.edges }));
  const ctx = { bid: 0 };
  for (const Z of P.zones) {
    const own = Z.id === cfg.zone ? { method: cfg.method, spec, side: opt.side, slotWidth: opt.slotWidth } : null;
    if (!own && !Z.decor && Z.methods) {
      // strefa z możliwymi stanowiskami, ale nie naszym – wypełniona jachtami w pierwszym stylu
      genZone(H, { ...Z, decor: Z.methods[0] }, null, R, ctx);
      continue;
    }
    if (!own && !Z.decor) continue;
    const b = genZone(H, Z, own, R, ctx);
    if (b) H.berth = b;
  }
  // numeracja polerów (osobno w każdej strefie)
  const cnt = {};
  [...H.bollards].sort((a, b) => a.zone.localeCompare(b.zone) || a.x - b.x || a.z - b.z).forEach((b) => {
    const key = b.zone + b.label;
    cnt[key] = (cnt[key] || 0) + 1;
    b.label = `${b.label} ${cnt[key]}`;
  });
  // pozycje startowe: stałe + „blisko stanowiska”
  const F = H.berth.frame, L = spec.loa;
  const near = F.toWorld(H.berth.u - 14, (H.method === 'longside' ? 0 : L) + L * 1.6 + 8);
  const cmp = ((Math.atan2(F.ax, -F.az) * 180) / Math.PI + 360) % 360;
  H.starts = [...P.starts, { id: 'near', name: 'Blisko stanowiska', x: near.x, z: near.z, compass: Math.round(cmp) }];
  H.exitZone = { x: P.exit.x, z: P.exit.z, r: 25 };
  return H;
}

// Obszary kolizyjne sąsiednich jachtów
export function neighborPolys(H) {
  return H.neighbors.map((n) => boatPolyWorld(n.spec, n.x, n.z, n.th, 0.05));
}

export const ROLE_NAMES = {
  bow: 'Cuma dziobowa',
  stern: 'Cuma rufowa',
  springFwd: 'Szpring dziobowy',
  springAft: 'Szpring rufowy',
  breastFwd: 'Brest dziobowy',
  breastAft: 'Brest rufowy',
  side: 'Cuma boczna',
  mooring: 'Muring'
};
