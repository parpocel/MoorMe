// Proceduralny model jachtu w stylu low-poly (nowoczesny jacht turystyczny)
// Układ modelu: +x do dziobu, +y do góry, +z na sterburtę. Środek = środek ciężkości na linii wodnej.
import * as THREE from 'three';
import { hullExtents, halfBeamAt } from '../data/boats.js';
import { flagMaterial } from './flags.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: opts.rough ?? 0.75, metalness: opts.metal ?? 0.0, transparent: !!opts.opacity, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide, emissive: opts.emissive ?? 0x000000 }));
  }
  return matCache.get(key);
}

// Wszystkie materiały z pamięci podręcznej (np. do podświetlenia okien nocą)
export function cachedMaterials() {
  return [...matCache.values()];
}

const COL = {
  deck: 0xd9d6cf,
  teak: 0xa87a4f,
  antifoul: 0x1b2330,
  boot: 0x1f2a38,
  metal: 0xc9ced4,
  dark: 0x23282e,
  window: 0x1b2632,
  mast: 0xd6d9dd,
  canvas: 0x24374f,
  genoa: 0xf2efe6,
  rope: 0xf0ede4,
  fender: 0xf5f5f5,
  keel: 0x2a2f36
};

function sheerHeight(spec, x) {
  const { xs, xb } = hullExtents(spec);
  const t = (x - xs) / (xb - xs);
  return spec.freeboard * (0.93 + 0.22 * t * t);
}

// Kadłub: stacje poprzeczne, pasy z kolorami (burta, pas okien, linia wodna, antyfouling)
// Stacje poprzeczne kadłuba: punkty pasów (x, y, w – półszerokość) – wspólne dla kadłuba i elementów leżących na burcie
const HULL_N = 48; // gęsta siatka kadłuba – obłe, gładko cieniowane burty
const HULL_BANDS = [
  // [wysokość względna do wolnej burty lub bezwzględna, szerokość względna]
  { h: (fb) => fb, w: 1.0 },
  { h: (fb) => fb * 0.83, w: 1.0 },
  { h: (fb) => fb * 0.66, w: 0.995 },
  { h: (fb) => fb * 0.34, w: 0.97 },
  { h: () => 0.02, w: 0.9 },
  { h: () => -0.1, w: 0.86 },
  { h: (fb, d) => -d * 0.4, w: 0.76 }, // zaokrąglenie obła
  { h: (fb, d) => -d * 0.72, w: 0.55 },
  { h: (fb, d) => -d * 0.9, w: 0.3 },
  { h: (fb, d) => -d, w: 0.0 }
];
function hullStations(spec) {
  const { xs, xb } = hullExtents(spec);
  const N = HULL_N, stations = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = xs + (xb - xs) * Math.pow(t, 0.92);
    const hb = i === N ? 0 : halfBeamAt(spec, i === 0 ? xs + 0.001 : x);
    const fb = sheerHeight(spec, x);
    let d = spec.canoeDraft * (t > 0.82 ? Math.max(0.05, (1 - t) / 0.18) : t < 0.06 ? 0.45 + t * 9 : 1);
    if (i === 0) d = 0.12; // pawęż nad wodą
    const pts = HULL_BANDS.map((bd) => {
      let y = bd.h(fb, d);
      const w = bd.w;
      if (i === 0 && y < 0.12) y = Math.max(y, 0.12 - (1 - w) * 0.2);
      // stewa dziobowa – prawie pionowa
      const bowPull = t > 0.9 ? (t - 0.9) / 0.1 : 0;
      const xx = x - bowPull * (fb - y) * 0.06;
      return { x: xx, y, w: hb * w };
    });
    stations.push(pts);
  }
  return stations;
}
// Półszerokość fasetowej powierzchni burty w punkcie (x, y) – dokładnie na trójkątach siatki kadłuba
function hullSurfaceW(stations, x, y, spec) {
  for (let i = 0; i < stations.length - 1; i++) {
    const A = stations[i], B = stations[i + 1];
    if (x < Math.min(A[0].x, A[A.length - 1].x) - 1e-6 || x > Math.max(B[0].x, B[B.length - 1].x) + 1e-6) continue;
    for (let j = 0; j < A.length - 1; j++) {
      const p1 = A[j], p2 = B[j], p3 = B[j + 1], p4 = A[j + 1];
      for (const [a, b, c] of [[p1, p2, p3], [p1, p3, p4]]) {
        const det = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
        if (Math.abs(det) < 1e-12) continue;
        const l1 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / det, l2 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / det, l3 = 1 - l1 - l2;
        if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return l1 * a.w + l2 * b.w + l3 * c.w;
      }
    }
  }
  return halfBeamAt(spec, x);
}

function buildHull(spec, hullColor, stripeColor) {
  const bands = HULL_BANDS;
  const N = HULL_N, J = bands.length;
  // kolory pasów: burta, pas okien, burta, burta, linia wodna, antyfouling…
  const bandColors = [hullColor, stripeColor, hullColor, hullColor, COL.boot, COL.antifoul, COL.antifoul, COL.antifoul, COL.antifoul];
  const stations = hullStations(spec);
  // gładkie normalne burty: z różnic sąsiednich punktów siatki (wzdłuż i w dół burty)
  const P = (i, j) => stations[Math.max(0, Math.min(N, i))][Math.max(0, Math.min(J - 1, j))];
  const nrm = [];
  for (let i = 0; i <= N; i++) {
    nrm.push([]);
    for (let j = 0; j < J; j++) {
      const a = P(i + 1, j), b = P(i - 1, j), c = P(i, j + 1), d = P(i, j - 1);
      const tx = [a.x - b.x, a.y - b.y, a.w - b.w], ty = [c.x - d.x, c.y - d.y, c.w - d.w];
      // dla prawej burty (z = +w): n = ty × tx
      let n = [ty[1] * tx[2] - ty[2] * tx[1], ty[2] * tx[0] - ty[0] * tx[2], ty[0] * tx[1] - ty[1] * tx[0]];
      if (n[2] < 0 && P(i, j).w > 0.05) n = n.map((v) => -v);
      const l = Math.hypot(...n) || 1;
      nrm[i].push(n.map((v) => v / l));
    }
  }
  const pos = [], col = [], nor = [];
  const c = new THREE.Color();
  const push = (v, n, color) => { pos.push(v[0], v[1], v[2]); nor.push(n[0], n[1], n[2]); c.set(color); col.push(c.r, c.g, c.b); };
  const face = (a, b, cc) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]]; const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; return n.map((x) => x / l); };
  const tri = (a, b, cc, color, na, nb, nc) => { if (!na) na = nb = nc = face(a, b, cc); push(a, na, color); push(b, nb, color); push(cc, nc, color); };
  for (let i = 0; i < N; i++) {
    const A = stations[i], Bs = stations[i + 1];
    for (let j = 0; j < J - 1; j++) {
      const color = bandColors[j];
      for (const side of [1, -1]) {
        const v = (pt) => [pt.x, pt.y, side * pt.w];
        const n = (ii, jj) => { const q = nrm[ii][jj]; return [q[0], q[1], side * q[2]]; };
        const p1 = v(A[j]), p2 = v(Bs[j]), p3 = v(Bs[j + 1]), p4 = v(A[j + 1]);
        const n1 = n(i, j), n2 = n(i + 1, j), n3 = n(i + 1, j + 1), n4 = n(i, j + 1);
        if (side === -1) { tri(p1, p2, p3, color, n1, n2, n3); tri(p1, p3, p4, color, n1, n3, n4); }
        else { tri(p1, p3, p2, color, n1, n3, n2); tri(p1, p4, p3, color, n1, n4, n3); }
      }
    }
  }
  // pawęż (rufa) – płaska ściana zamykająca
  const T = stations[0];
  for (let j = 0; j < J - 1; j++) {
    const color = j === 1 ? stripeColor : j >= 4 ? COL.antifoul : hullColor;
    const a = [T[j].x, T[j].y, T[j].w], b = [T[j].x, T[j].y, -T[j].w];
    const cc = [T[j + 1].x, T[j + 1].y, -T[j + 1].w], d = [T[j + 1].x, T[j + 1].y, T[j + 1].w];
    tri(a, b, cc, color); tri(a, cc, d, color);
  }
  // pokład
  for (let i = 0; i < N; i++) {
    const a = stations[i][0], b = stations[i + 1][0];
    const p1 = [a.x, a.y, a.w], p2 = [b.x, b.y, b.w], p3 = [b.x, b.y, -b.w], p4 = [a.x, a.y, -a.w];
    tri(p1, p3, p2, COL.deck); tri(p1, p4, p3, COL.deck);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Gładkie normalne z zachowaniem ostrych krawędzi (kąt > crease): uśrednia normalne ścian sąsiadujących wierzchołków
export function smoothNormals(geo, creaseDeg = 50) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position.array, n = p.length / 3;
  const fn = new Float32Array(p.length);
  for (let i = 0; i < n; i += 3) {
    const ax = p[i * 3], ay = p[i * 3 + 1], az = p[i * 3 + 2];
    const ux = p[i * 3 + 3] - ax, uy = p[i * 3 + 4] - ay, uz = p[i * 3 + 5] - az;
    const vx = p[i * 3 + 6] - ax, vy = p[i * 3 + 7] - ay, vz = p[i * 3 + 8] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (let k = 0; k < 3; k++) { fn[(i + k) * 3] = nx; fn[(i + k) * 3 + 1] = ny; fn[(i + k) * 3 + 2] = nz; }
  }
  const key = (i) => `${Math.round(p[i * 3] * 1e4)},${Math.round(p[i * 3 + 1] * 1e4)},${Math.round(p[i * 3 + 2] * 1e4)}`;
  const groups = new Map();
  for (let i = 0; i < n; i++) { const k = key(i); (groups.get(k) || groups.set(k, []).get(k)).push(i); }
  const cos = Math.cos(creaseDeg * Math.PI / 180), out = new Float32Array(p.length);
  for (const idx of groups.values()) for (const i of idx) {
    let sx = 0, sy = 0, sz = 0;
    for (const j of idx) { const d = fn[i * 3] * fn[j * 3] + fn[i * 3 + 1] * fn[j * 3 + 1] + fn[i * 3 + 2] * fn[j * 3 + 2]; if (d >= cos) { sx += fn[j * 3]; sy += fn[j * 3 + 1]; sz += fn[j * 3 + 2]; } }
    const l = Math.hypot(sx, sy, sz) || 1; out[i * 3] = sx / l; out[i * 3 + 1] = sy / l; out[i * 3 + 2] = sz / l;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return g;
}

// Prostopadłościan ułatwiający (x wzdłuż, y góra, z w poprzek)
function box(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function cyl(r1, r2, h, color, seg = 6, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, Math.ceil(seg * 1.25)), mat(color, opts));
  m.castShadow = true;
  return m;
}
// cylinder między dwoma punktami
function strut(a, b, r, color, seg = 5) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const m = cyl(r, r, len, color, seg);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}

// Nadbudówka (kabina) z oknami
function buildCabin(spec) {
  const { xs, xb } = hullExtents(spec);
  const L = spec.loa;
  const g = new THREE.Group();
  const x0 = xs + 0.3 * L, x1 = xb - 0.3 * L;
  const fbA = sheerHeight(spec, x0), fbF = sheerHeight(spec, x1);
  const wA = halfBeamAt(spec, x0) * 0.66, wF = halfBeamAt(spec, x1) * 0.5;
  // niska nadbudówka z zaokrąglonym przodem i obłymi krawędziami (jak w serii C)
  const h = 0.36 + L * 0.009, bev = 0.16, bevT = 0.12;
  const shape = new THREE.Shape();
  shape.moveTo(x0, -wA);
  shape.lineTo(x1 - 0.7, -wF);
  shape.quadraticCurveTo(x1, -wF * 0.92, x1, 0);
  shape.quadraticCurveTo(x1, wF * 0.92, x1 - 0.7, wF);
  shape.lineTo(x0, wA);
  shape.lineTo(x0, -wA);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, curveSegments: 16, bevelEnabled: true, bevelThickness: bevT, bevelSize: bev, bevelSegments: 6 });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(smoothNormals(geo, 55), new THREE.MeshStandardMaterial({ color: 0xe8e6e1, roughness: 0.6 })); // gładko cieniowana, obła
  m.position.y = Math.min(fbA, fbF) - 0.05;
  m.castShadow = true;
  g.add(m);
  const topY = m.position.y + h + bevT;
  // okna boczne
  // burta nadbudówki biegnie od (x0, wA) do (x1 - 0.4, wF); okno leży na niej równo (obrót zgodny ze zbieżnością, przesunięcie o fazkę 0.08)
  const sideLen = x1 - 0.7 - x0;
  const wl = sideLen * 0.6;
  const xc = x0 + sideLen * 0.5;
  const wc = (wA + wF) / 2 + bev + 0.012;
  for (const s of [-1, 1]) {
    const win = box(wl, 0.14, 0.03, COL.window, xc, topY - bevT - 0.13, s * wc, { rough: 0.2, metal: 0.4 });
    win.rotation.y = s * Math.atan2(wA - wF, sideLen);
    g.add(win);
  }
  // okna dachowe (luki) w aluminiowych ramach
  for (const [sz, hx] of [[0.55, x1 - 0.7], [0.45, (x0 + x1) / 2]]) {
    g.add(box(sz + 0.08, 0.04, sz + 0.08, 0xb9bfc6, hx, topY + 0.004, 0, { metal: 0.7, rough: 0.35 }));
    g.add(box(sz, 0.05, sz, COL.window, hx, topY + 0.01, 0, { rough: 0.2, metal: 0.4 }));
  }
  // relingi dachowe (poręcze)
  for (const s of [-1, 1]) g.add(box((x1 - x0) * 0.6, 0.05, 0.05, COL.teak, (x0 + x1) / 2, topY + 0.05, s * wF * 0.9));
  g.userData.topY = topY;
  g.userData.x0 = x0; g.userData.x1 = x1; g.userData.wA = wA; g.userData.wF = wF;
  return g;
}

// Linie (relingi, wanty) nie reagują na oświetlenie – Atmosphere przyciemnia je nocą, żeby nie świeciły
export const LINE_MATS = {
  // linie rysowane są zawsze 1-pikselowe; półprzezroczystość sprawia, że wanty, sztagi i relingi wyglądają cieniej
  rail: { mat: new THREE.LineBasicMaterial({ color: 0xb8bec5, transparent: true, opacity: 0.6 }), base: 0xb8bec5 },
  rig: { mat: new THREE.LineBasicMaterial({ color: 0x3a3f44, transparent: true, opacity: 0.5 }), base: 0x3a3f44 },
  halyard: { mat: new THREE.LineBasicMaterial({ color: 0xd8d2c0, transparent: true, opacity: 0.5 }), base: 0xd8d2c0 }
};

// Bandera na rufie (grupa: obrót wokół pionowego drzewca ustawia się według wiatru)
export function createFlag(spec, code) {
  const { xs } = hullExtents(spec);
  const flag = new THREE.Group();
  const fg = new THREE.PlaneGeometry(0.6, 0.4);
  fg.rotateY(Math.PI / 2);
  fg.translate(0, 0, -0.3);
  const fm = new THREE.Mesh(fg, flagMaterial(code));
  fm.userData.keep = true; // nie scalać – ma własny materiał z teksturą
  flag.add(fm);
  flag.position.set(xs - 0.2, sheerHeight(spec, xs + 0.03 * spec.loa) + 1.2, spec.beam * 0.3);
  flag.rotation.y = Math.PI / 2;
  return flag;
}

// Tabliczka z nazwą na pawęży
export function createNamePlate(spec, name, sub, split = false) {
  const { xs } = hullExtents(spec);
  const w = spec.beam * (split ? 0.6 : 0.55);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 96 / 512), new THREE.MeshBasicMaterial({ map: nameTexture(name, sub, split), transparent: true, depthWrite: false }));
  plate.position.set(xs - 0.012, sheerHeight(spec, xs) * 0.62, 0);
  plate.rotation.y = -Math.PI / 2;
  plate.userData.keep = true;
  return plate;
}

export function buildBoat(spec, opts = {}) {
  const hullColor = opts.color ?? spec.color;
  const stripe = opts.stripe ?? spec.stripe;
  const { xs, xb } = hullExtents(spec);
  const L = spec.loa;
  const root = new THREE.Group();
  const heel = new THREE.Group(); // do przechyłu
  root.add(heel);
  heel.add(buildHull(spec, hullColor, stripe));

  // kil + bulb
  const keelH = spec.draft - spec.canoeDraft;
  const keel = box(1.0 + L * 0.03, keelH, 0.14, COL.keel, 0.02 * L, -spec.canoeDraft - keelH / 2 + 0.05, 0);
  keel.rotation.z = -0.08;
  heel.add(keel);
  const bulb = cyl(0.18 + L * 0.006, 0.12, 1.4 + L * 0.03, COL.keel, 7);
  bulb.rotation.z = Math.PI / 2;
  bulb.position.set(0.0, -spec.draft + 0.12, 0);
  heel.add(bulb);
  // płetwy sterowe: podwójne (poza osią) albo pojedyncza w osi
  for (const s of opts.rudders === 'single' ? [0] : [-1, 1]) {
    const r = s ? box(0.45, spec.draft * 0.65, 0.07, COL.keel, xs + 0.07 * L, -spec.draft * 0.33, s * spec.beam * 0.28)
      : box(0.6, spec.draft * 0.78, 0.08, COL.keel, xs + 0.07 * L, -spec.draft * 0.39, 0);
    r.rotation.x = s * 0.1;
    r.name = 'rudder';
    heel.add(r);
  }
  // śruba (saildrive/wał)
  const prop = new THREE.Group();
  const shaftX = opts.drive === 'shaft' ? xs + 0.15 * L : xs + 0.2 * L;
  prop.add(box(0.35, 0.55, 0.08, COL.dark, shaftX + 0.1, -spec.canoeDraft - 0.2, 0));
  const blades = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const b = box(0.04, spec.propDiameter / 2, 0.1, 0xb08d57, 0, spec.propDiameter / 4, 0, { metal: 0.6, rough: 0.3 });
    const pv = new THREE.Group();
    pv.add(b);
    pv.rotation.x = (k * 2 * Math.PI) / 3;
    blades.add(pv);
  }
  blades.position.set(shaftX - 0.12, -spec.canoeDraft - 0.4, 0);
  prop.add(blades);
  heel.add(prop);
  root.userData.propeller = blades;
  // tunel steru strumieniowego
  if (opts.bowThruster && opts.bowThruster !== 'none') {
    for (const s of [-1, 1]) {
      const t = cyl(0.13, 0.13, 0.02, 0x111111, 10);
      t.rotation.x = Math.PI / 2;
      const bx = xb - 0.1 * L;
      t.position.set(bx, -0.2, s * (halfBeamAt(spec, bx) * 0.72 + 0.01));
      heel.add(t);
    }
  }

  // nadbudówka
  const cabin = buildCabin(spec);
  heel.add(cabin);
  const deckY = sheerHeight(spec, 0);

  // kokpit – teakowa podłoga, ławki, stolik
  const ck0 = xs + 0.03 * L, ck1 = cabin.userData.x0 - 0.05;
  const ckw = halfBeamAt(spec, (ck0 + ck1) / 2) * 1.35;
  const fbC = sheerHeight(spec, ck0);
  heel.add(box(ck1 - ck0, 0.05, ckw, COL.teak, (ck0 + ck1) / 2, fbC + 0.01, 0));
  for (const s of [-1, 1]) heel.add(box((ck1 - ck0) * 0.7, 0.35, 0.45, 0xe8e6e1, ck1 - (ck1 - ck0) * 0.38, fbC + 0.2, s * (ckw / 2 - 0.2)));
  // granatowe poduszki na ławkach kokpitu
  for (const s of [-1, 1]) heel.add(box((ck1 - ck0) * 0.66, 0.05, 0.4, 0x2d4a6b, ck1 - (ck1 - ck0) * 0.38, fbC + 0.4, s * (ckw / 2 - 0.2)));
  root.userData.seatSpot = [ck1 - (ck1 - ck0) * 0.38, fbC + 0.43, ckw / 2 - 0.2];
  heel.add(box(0.9, 0.06, 0.55, COL.teak, ck1 - (ck1 - ck0) * 0.45, fbC + 0.75, 0));
  heel.add(box(0.12, 0.7, 0.12, COL.metal, ck1 - (ck1 - ck0) * 0.45, fbC + 0.4, 0));
  // podwójne koła sterowe
  const wheelR = 0.3 + L * 0.008; // małe koło – nie zasłania widoku kapitana
  root.userData.wheels = [];
  for (const s of [-1, 1]) {
    const wg = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(wheelR, 0.03, 4, 14), mat(COL.metal, { metal: 0.7, rough: 0.3 }));
    wg.add(rim);
    for (let k = 0; k < 4; k++) {
      const sp = box(0.02, wheelR * 2, 0.02, COL.metal, 0, 0, 0);
      sp.rotation.z = (k * Math.PI) / 4;
      wg.add(sp);
    }
    wg.rotation.y = Math.PI / 2;
    wg.position.set(ck0 + 0.55, fbC + wheelR + 0.25, s * spec.beam * 0.27);
    heel.add(wg);
    heel.add(box(0.12, wheelR + 0.25, 0.12, 0xe8e6e1, ck0 + 0.55, fbC + (wheelR + 0.25) / 2, s * spec.beam * 0.27));
    const cmp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x1b2128, { rough: 0.2, metal: 0.4 }));
    cmp.position.set(ck0 + 0.55 - 0.12, fbC + wheelR + 0.25, s * spec.beam * 0.27);
    heel.add(cmp);
    root.userData.wheels.push(wg);
  }
  // maszt, bom, olinowanie
  const mastX = 0.1 * L;
  const mastH = spec.mastHeight - spec.freeboard;
  const topY = cabin.userData.topY;
  const mast = cyl(0.09, 0.07, mastH, COL.mast, 12, { metal: 0.5, rough: 0.4 });
  mast.position.set(mastX, topY + mastH / 2, 0);
  heel.add(mast);
  const boomL = mastX - (xs + 0.12 * L);
  const boomY = topY + 1.9;
  const boom = cyl(0.07, 0.07, boomL, COL.mast, 12);
  boom.rotation.z = Math.PI / 2;
  boom.position.set(mastX - boomL / 2, boomY, 0);
  heel.add(boom);
  // pokrowiec grota (lazy bag)
  const bag = cyl(0.19, 0.19, boomL * 0.92, opts.canvas ?? COL.canvas, 12);
  bag.rotation.z = Math.PI / 2;
  bag.scale.set(1.15, 1, 0.8); // lekko spłaszczony, jak zwinięty grot
  bag.position.set(mastX - boomL / 2 + 0.1, boomY + 0.2, 0);
  heel.add(bag);
  // salingi
  const rig = [];
  const mtop = topY + mastH;
  const spY1 = topY + mastH * 0.36, spY2 = topY + mastH * 0.68;
  for (const s of [-1, 1]) {
    heel.add(strut([mastX, spY1, 0], [mastX - 0.3, spY1, s * spec.beam * 0.3], 0.025, COL.mast, 8));
    heel.add(strut([mastX, spY2, 0], [mastX - 0.2, spY2, s * spec.beam * 0.2], 0.02, COL.mast));
    const chain = [mastX - 0.6, sheerHeight(spec, mastX), s * (halfBeamAt(spec, mastX) - 0.12)];
    rig.push([chain, [mastX - 0.3, spY1, s * spec.beam * 0.3]], [[mastX - 0.3, spY1, s * spec.beam * 0.3], [mastX - 0.2, spY2, s * spec.beam * 0.2]], [[mastX - 0.2, spY2, s * spec.beam * 0.2], [mastX, mtop - 0.3, 0]]);
    rig.push([[xs + 0.03, sheerHeight(spec, xs), s * halfBeamAt(spec, xs) * 0.8], [mastX, mtop, 0]]);
  }
  const stemTop = [xb - 0.1, sheerHeight(spec, xb) + 0.1, 0];
  rig.push([stemTop, [mastX, mtop - 0.2, 0]]);
  const rigPos = [];
  rig.forEach(([a, b]) => rigPos.push(...a, ...b));
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(rigPos, 3));
  heel.add(new THREE.LineSegments(rg, LINE_MATS.rig.mat));
  // zrolowany genua na sztagu
  const gen = strut(stemTop, [mastX, mtop - 0.9, 0], 0.06, opts.canvas ?? COL.canvas, 12);
  gen.scale.set(1, 0.9, 1);
  heel.add(gen);
  // windex i światło topowe
  const windex = new THREE.Group();
  windex.add(box(0.5, 0.02, 0.02, 0x111111, -0.1, 0, 0));
  windex.add(box(0.12, 0.12, 0.01, 0xff3b30, -0.35, 0.03, 0));
  windex.position.set(mastX, mtop + 0.15, 0);
  heel.add(windex);
  root.userData.windex = windex;

  // relingi: słupki + linki, kosze dziobowy i rufowy
  const railPos = [];
  const stN = Math.round(L / 1.7);
  for (const s of [-1, 1]) {
    let prev = null;
    for (let i = 0; i <= stN; i++) {
      const x = xs + 0.04 * L + (xb - xs - 0.12 * L) * (i / stN);
      const w = s * (halfBeamAt(spec, x) - 0.06);
      const y = sheerHeight(spec, x);
      heel.add(strut([x, y, w], [x, y + 0.62, w], 0.015, COL.metal, 4));
      const p = [x, y + 0.62, w], p2 = [x, y + 0.32, w];
      if (prev) railPos.push(...prev[0], ...p, ...prev[1], ...p2);
      prev = [p, p2];
    }
  }
  // kosz dziobowy
  const pb = xb - 0.05 * L;
  const pY = sheerHeight(spec, pb) + 0.65;
  railPos.push(pb, pY, -halfBeamAt(spec, pb) + 0.06, xb - 0.1, pY, 0, xb - 0.1, pY, 0, pb, pY, halfBeamAt(spec, pb) - 0.06);
  const rlg = new THREE.BufferGeometry();
  rlg.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
  heel.add(new THREE.LineSegments(rlg, LINE_MATS.rail.mat));

  // kotwica na rolce
  heel.add(box(0.5, 0.12, 0.2, COL.metal, xb + 0.1, sheerHeight(spec, xb) + 0.05, 0, { metal: 0.8, rough: 0.3 }));
  // bandera na rufie
  const flagStaff = strut([xs + 0.1, fbC + 0.2, spec.beam * 0.3], [xs - 0.2, fbC + 1.3, spec.beam * 0.3], 0.015, COL.teak);
  heel.add(flagStaff);
  const flag = createFlag(spec, opts.flag || 'DE');
  if (!opts.noFlag) heel.add(flag);
  root.userData.flag = flag;
  // platforma kąpielowa (opuszczana pawęż)
  heel.add(box(0.5, 0.08, spec.beam * 0.7, COL.teak, xs - 0.2, 0.35, 0));

  addBoatDetails(heel, root, spec, { cabin, fbC, ck0, ck1, ckw, mastX, topY, mtop, name: opts.name, sub: opts.sub, split: opts.split, noPlate: opts.noPlate, canvas: opts.canvas });

  root.userData.heel = heel;
  root.userData.spec = spec;
  root.userData.deckY = deckY;
  root.userData.mastTop = mtop;
  // miejsca, na których siadają mewy: końce dolnych salingów i top masztu (układ grupy przechyłu)
  root.userData.mastX = mastX;
  root.userData.steamPos = [mastX + 0.1, topY + mastH * 0.5, 0];
  heel.add(box(0.1, 0.1, 0.1, 0xf2f2f2, mastX + 0.1, topY + mastH * 0.5, 0, { emissive: 0x222222 }));
  root.userData.perches = [
    [mastX - 0.3, spY1 + 0.05, -spec.beam * 0.3],
    [mastX - 0.3, spY1 + 0.05, spec.beam * 0.3],
    [mastX - 0.2, spY2 + 0.05, spec.beam * 0.2],
    [mastX, mtop + 0.2, 0]
  ];
  return root;
}

// ---------- Szczegóły jachtu ----------
const BOAT_NAMES = ['MOORME', 'AURORA', 'MEWA', 'BRYZA', 'LUNA', 'SIROCCO', 'WIATR', 'ZEFIR', 'NEPTUN', 'ALBATROS', 'MISTRAL', 'POLARIS'];
const nameTexCache = new Map();
function nameTexture(name, sub, split) {
  const key = name + '|' + (sub || '') + '|' + !!split;
  if (nameTexCache.has(key)) return nameTexCache.get(key);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 96);
  g.fillStyle = '#1b2a3a';
  g.textBaseline = 'middle';
  if (split) {
    // nazwa po lewej (widok od rufy = lewa burta), port macierzysty mniejszą czcionką po prawej
    g.textAlign = 'left';
    let fs = 60;
    g.font = `bold ${fs}px Georgia, serif`;
    while (g.measureText(name).width > 330 && fs > 20) { fs -= 2; g.font = `bold ${fs}px Georgia, serif`; }
    g.fillText(name, 10, 48);
    g.textAlign = 'right';
    g.font = 'italic 30px Georgia, serif';
    g.fillText(sub, 502, 54);
  } else {
    g.textAlign = 'center';
    let fs = 60;
    g.font = `bold ${fs}px Georgia, serif`;
    while (g.measureText(name).width > 470 && fs > 20) { fs -= 2; g.font = `bold ${fs}px Georgia, serif`; }
    g.fillText(name, 256, 44);
    g.font = '22px Georgia, serif';
    g.fillText(sub || '', 256, 84);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  nameTexCache.set(key, t);
  return t;
}

let blobTex = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,20,30,0.55)');
  gr.addColorStop(0.6, 'rgba(0,20,30,0.25)');
  gr.addColorStop(1, 'rgba(0,20,30,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

// Seria odcinków cylindra wzdłuż linii pokładu (listwa, odbojnica)
function sheerStrip(heel, spec, side, dy, inset, r, color, n = 14) {
  const { xs, xb } = hullExtents(spec);
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const x = xs + 0.05 + (xb - xs - 0.25) * (i / n);
    const p = [x, sheerHeight(spec, x) + dy, side * Math.max(0.05, halfBeamAt(spec, x) - inset)];
    if (prev) heel.add(strut(prev, p, r, color, 5));
    prev = p;
  }
}

function addBoatDetails(heel, root, spec, d) {
  const { xs, xb } = hullExtents(spec);
  const L = spec.loa;
  const glass = { rough: 0.15, metal: 0.5 };
  // okna w burtach (charakterystyczne dla serii C): długie okno salonu + mniejsze kabinowe.
  // Każde okno to pas siatki leżący na fasetowej powierzchni burty (podąża za jej krzywizną i za linią pokładu), z zaokrąglonymi końcami.
  const stations = hullStations(spec);
  const winMat = mat(0x16202b, { ...glass, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    for (const [x0, x1, hRel] of [[-0.02 * L, 0.2 * L, 0.72], [0.24 * L, 0.3 * L, 0.74], [-0.32 * L, -0.24 * L, 0.73]]) {
      const H = 0.13 + L * 0.004, len = x1 - x0, n = Math.max(8, Math.round(len / 0.12)), er = Math.min(0.5, (H * 0.6) / len);
      const pos = [];
      const col = (k) => {
        const u = k / n, x = x0 + len * u, yc = sheerHeight(spec, x) * hRel;
        const e = Math.max(0, Math.abs(2 * u - 1) - (1 - 2 * er)) / (2 * er); // 0 w środku, 1 na końcu okna
        const hh = (H / 2) * Math.sqrt(Math.max(0, 1 - e * e));
        return [-1, 1].map((sg) => { const y = yc + sg * hh; return [x, y, side * (hullSurfaceW(stations, x, y, spec) + 0.006)]; });
      };
      let prev = col(0);
      for (let k = 1; k <= n; k++) {
        const cur = col(k), [b0, t0] = prev, [b1, t1] = cur;
        pos.push(...b0, ...b1, ...t1, ...b0, ...t1, ...t0);
        prev = cur;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      heel.add(new THREE.Mesh(g, winMat));
    }
    // teakowa listwa na krawędzi pokładu i ciemna odbojnica pod nią
    sheerStrip(heel, spec, side, 0.04, 0.03, 0.03, COL.teak);
    sheerStrip(heel, spec, side, -0.06, -0.02, 0.028, 0x2a3036);
    // prowadnice szotów foka na pokładzie bocznym
    const gx = d.mastX - 0.6;
    heel.add(box(1.4, 0.03, 0.05, COL.dark, gx - 0.9, sheerHeight(spec, gx) + 0.02, side * (halfBeamAt(spec, gx) - 0.35), { metal: 0.6 }));
    // kabestany (winche) na dachu nadbudówki
    for (const [wx, wy, wz] of [[d.cabin.userData.x0 + 0.25, d.topY + 0.02, side * 0.55]]) {
      const wch = cyl(0.09 + L * 0.002, 0.11 + L * 0.002, 0.16, 0x9aa3ab, 10, { metal: 0.8, rough: 0.3 });
      wch.position.set(wx, wy + 0.08, wz);
      heel.add(wch);
      const top = cyl(0.05, 0.05, 0.05, 0x3a3f44, 8);
      top.position.set(wx, wy + 0.18, wz);
      heel.add(top);
    }
  }
  // światła nawigacyjne na koszu dziobowym (lewa czerwona, prawa zielona)
  const pbx = xb - 0.05 * L, pby = sheerHeight(spec, pbx) + 0.66;
  heel.add(box(0.1, 0.08, 0.06, 0xff3030, pbx, pby, -halfBeamAt(spec, pbx) + 0.08, { emissive: 0x551010 }));
  heel.add(box(0.1, 0.08, 0.06, 0x20d060, pbx, pby, halfBeamAt(spec, pbx) - 0.08, { emissive: 0x0a4020 }));
  // winda kotwiczna
  heel.add(box(0.3, 0.14, 0.24, COL.dark, xb - 0.08 * L, sheerHeight(spec, xb - 0.08 * L) + 0.07, 0, { metal: 0.5 }));
  // koło ratunkowe i pława ratunkowa (danbuoy) na relingu rufowym (burta prawa)
  {
    const cx = xs + 0.3, cy = sheerHeight(spec, cx) + 0.5, cz = halfBeamAt(spec, cx) - 0.1;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 6, 14), mat(0xf26b21));
    ring.position.set(cx, cy, cz); ring.castShadow = true;
    heel.add(ring);
    const px = xs + 0.55, pz = halfBeamAt(spec, px) - 0.1, py = sheerHeight(spec, px) + 0.62;
    heel.add(strut([px, py, pz], [px, py + 1.3, pz], 0.014, 0x222222, 4));
    const fl = cyl(0.07, 0.07, 0.4, 0xf26b21, 8); fl.position.set(px, py + 0.55, pz); heel.add(fl);
    heel.add(box(0.02, 0.2, 0.26, 0xe63946, px, py + 1.2, pz));
  }
  // antena GPS na relingu rufowym
  heel.add(cyl(0.04, 0.05, 0.1, 0xf2f2f2, 8).translateX(xs + 0.3).translateY(sheerHeight(spec, xs + 0.3) + 0.67).translateZ(spec.beam * 0.16));
  // maszt: kołnierz u podstawy, kicker (vang) i trawelerz (bez liny talii grota)
  {
    const bY = d.topY + 1.9;
    const col = cyl(0.13, 0.16, 0.16, COL.mast, 10, { metal: 0.5, rough: 0.4 });
    col.position.set(d.mastX, d.topY + 0.08, 0);
    heel.add(col);
    heel.add(strut([d.mastX, d.topY + 0.3, 0], [d.mastX - 0.5, bY - 0.04, 0], 0.022, COL.metal, 5));
    const tx = d.ck1 - 0.35, ty = d.fbC + 0.09;
    heel.add(box(0.05, 0.04, d.ckw * 0.75, COL.metal, tx, ty, 0, { metal: 0.8, rough: 0.3 }));
    heel.add(box(0.12, 0.06, 0.1, COL.dark, tx, ty + 0.05, 0));
  }
  // dach nadbudówki: panel słoneczny, luk i grzybki wentylacyjne
  {
    const x0 = d.cabin.userData.x0, x1 = d.cabin.userData.x1;
    const mx = x0 + (x1 - x0) * 0.62;
    heel.add(box(0.75, 0.025, 0.55, 0x1b2a4a, mx, d.topY + 0.03, 0, { rough: 0.25, metal: 0.4 }));
    heel.add(box(0.5, 0.04, 0.5, 0xe8e6e1, x0 + (x1 - x0) * 0.25, d.topY + 0.03, 0));
    heel.add(box(0.42, 0.045, 0.42, 0x16202b, x0 + (x1 - x0) * 0.25, d.topY + 0.032, 0, glass));
  }
  for (const s of [-1, 1]) {
    const vx = xb - 0.2 * L;
    const vy = sheerHeight(spec, vx);
    const v1 = cyl(0.05, 0.05, 0.12, 0xc9ced4, 8, { metal: 0.6 }); v1.position.set(vx, vy + 0.06, s * halfBeamAt(spec, vx) * 0.5);
    const v2 = cyl(0.1, 0.06, 0.05, 0xc9ced4, 10, { metal: 0.6 }); v2.position.set(vx, vy + 0.14, s * halfBeamAt(spec, vx) * 0.5);
    heel.add(v1, v2);
  }
  // luk dziobowy i skrzynka łańcucha
  {
    const hx = xb - 0.27 * L, hy = sheerHeight(spec, hx);
    heel.add(box(0.6, 0.04, 0.6, 0xe8e6e1, hx, hy + 0.03, 0));
    heel.add(box(0.5, 0.045, 0.5, 0x16202b, hx, hy + 0.034, 0, glass));
  }
  // drabinka kąpielowa
  for (let k = 0; k < 4; k++) heel.add(box(0.05, 0.03, 0.4, COL.metal, xs - 0.47, 0.3 - k * 0.22, spec.beam * 0.1, { metal: 0.8 }));
  addDeckDetail(heel, spec, d);
  // nazwa na pawęży
  const nm = d.name || BOAT_NAMES[0];
  if (!d.noPlate) heel.add(createNamePlate(spec, nm, d.sub ?? 'Gdynia', d.split));
  // fały wzdłuż masztu
  const hp = [];
  for (const dz of [-0.06, 0.06]) hp.push(d.mastX + 0.1, d.topY + 1.2, dz, d.mastX + 0.1, d.mtop - 0.3, dz);
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
  heel.add(new THREE.LineSegments(hg, LINE_MATS.halyard.mat));
  // radar i światło salingowe na większych jachtach
  if (L > 12) {
    const rad = cyl(0.3, 0.3, 0.2, 0xf4f4f4, 12);
    rad.position.set(d.mastX + 0.35, d.topY + (d.mtop - d.topY) * 0.42, 0);
    heel.add(rad);
  }
  // antena VHF na topie
  heel.add(strut([d.mastX, d.mtop, 0], [d.mastX, d.mtop + 1.0, 0], 0.012, 0x222222, 4));
  // miękki cień pod kadłubem na wodzie
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.15, spec.beam * 1.5), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.set((xs + xb) / 2, 0.06, 0);
  blob.renderOrder = 1;
  blob.userData.keep = true;
  root.add(blob);
}

// Pas siatki leżący na pokładzie wzdłuż linii pokładu: z(x) – granice wewnętrzna i zewnętrzna (antypoślizg)
function deckPatch(spec, x0, x1, zIn, zOut, dy, color, n = 10) {
  const pos = [];
  const P = (x, z) => [x, sheerHeight(spec, x) + dy, z];
  for (let k = 0; k < n; k++) {
    const a = x0 + ((x1 - x0) * k) / n, b = x0 + ((x1 - x0) * (k + 1)) / n;
    const p1 = P(a, zIn(a)), p2 = P(b, zIn(b)), p3 = P(b, zOut(b)), p4 = P(a, zOut(a));
    pos.push(...p1, ...p3, ...p2, ...p1, ...p4, ...p3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(color, { rough: 0.95, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  return m;
}

// Szczegóły pokładu: antypoślizg, zejściówka, stopery i fały od masztu, kosz rufowy
function addDeckDetail(heel, spec, d) {
  const { xs, xb } = hullExtents(spec);
  const L = spec.loa, cab = d.cabin.userData;
  const x0 = cab.x0, x1 = cab.x1, topY = d.topY;
  const NS = 0xb7b2a6; // szarawy antypoślizg z gładkim obrzeżem
  const cabW = (x) => cab.wA + (cab.wF - cab.wA) * Math.max(0, Math.min(1, (x - x0) / (x1 - 0.7 - x0))) + 0.24;
  for (const s of [-1, 1]) {
    // pokład boczny wzdłuż nadbudówki
    heel.add(deckPatch(spec, x0 + 0.15, x1 - 0.3, (x) => s * cabW(x), (x) => s * (halfBeamAt(spec, x) - 0.2), 0.012, NS));
    // pokład boczny przy kokpicie
    heel.add(deckPatch(spec, d.ck0 + 0.35, x0 - 0.1, () => s * (d.ckw / 2 + 0.08), (x) => s * (halfBeamAt(spec, x) - 0.2), 0.012, NS, 4));
  }
  // pokład dziobowy (przed nadbudówką, za windą kotwiczną)
  heel.add(deckPatch(spec, x1 + 0.2, xb - 0.12 * L, (x) => -(halfBeamAt(spec, x) - 0.22), (x) => halfBeamAt(spec, x) - 0.22, 0.012, NS, 6));
  // dach nadbudówki
  heel.add(box(x1 - x0 - 1.2, 0.012, cab.wF * 1.5, NS, (x0 + x1) / 2 - 0.1, topY + 0.006, 0, { rough: 0.95 }));

  // zejściówka: przesuwana klapa w prowadnicach i deski zamykające wejście
  const cw = 0.62;
  heel.add(box(0.95, 0.07, cw + 0.12, 0xe8e6e1, x0 + 0.5, topY + 0.04, 0));
  for (const s of [-1, 1]) heel.add(box(1.2, 0.05, 0.05, 0x9aa3ab, x0 + 0.6, topY + 0.03, s * (cw / 2 + 0.09), { metal: 0.7, rough: 0.35 }));
  const dh = topY - d.fbC - 0.15;
  heel.add(box(0.03, dh, cw, 0x5a3b22, x0 - 0.04, d.fbC + 0.1 + dh / 2, 0, { rough: 0.6 }));
  for (let k = 1; k < 4; k++) heel.add(box(0.035, 0.012, cw, 0x3e2815, x0 - 0.045, d.fbC + 0.1 + (k * dh) / 4, 0));

  // stopery (zaciskacze) przed kabestanami na dachu i fały prowadzone od podstawy masztu
  const ropeCols = [0xf0ede4, 0xd8423a, 0x2f6fb5, 0xe8c547];
  for (const s of [-1, 1]) {
    const cx = x0 + 0.62;
    for (let k = 0; k < 4; k++) {
      const z = s * (0.36 + k * 0.075);
      heel.add(box(0.14, 0.06, 0.06, 0x1d2126, cx, topY + 0.04, z));
      heel.add(box(0.05, 0.02, 0.05, 0xd8423a, cx + 0.03, topY + 0.08, z));
      heel.add(strut([d.mastX - 0.12, topY + 0.03, s * (0.06 + k * 0.03)], [cx + 0.07, topY + 0.035, z], 0.008, ropeCols[k], 4));
      heel.add(strut([cx - 0.07, topY + 0.035, z], [x0 + 0.27, topY + 0.1, s * 0.55], 0.008, ropeCols[k], 4));
    }
    heel.add(box(0.1, 0.05, 0.16, 0x1d2126, d.mastX - 0.12, topY + 0.03, s * 0.1)); // bloczki (organizer) u stopy masztu
  }

  // kosz rufowy z rur po obu stronach rufy
  for (const s of [-1, 1]) {
    const xa = xs + 0.06, xc = xs + 0.04 * L + 0.02;
    const ya = sheerHeight(spec, xa), yc = sheerHeight(spec, xc);
    const za = s * (halfBeamAt(spec, xa) * 0.82), zc = s * (halfBeamAt(spec, xc) - 0.06);
    const top = [xa, ya + 0.66, za];
    heel.add(strut([xa, ya, za], top, 0.02, COL.metal, 6));
    heel.add(strut(top, [xc, yc + 0.66, zc], 0.02, COL.metal, 6));
    heel.add(strut(top, [xa, ya + 0.66, s * 0.35], 0.02, COL.metal, 6));
    heel.add(strut([xa + 0.25, ya + 0.02, za * 0.97], [xa + 0.1, ya + 0.66, za * 0.99], 0.016, COL.metal, 6));
  }

  // płytki want na pokładzie i wózki na prowadnicach foka
  for (const s of [-1, 1]) {
    const cx = d.mastX - 0.6, gx = cx - 0.9;
    heel.add(box(0.12, 0.05, 0.05, COL.metal, cx, sheerHeight(spec, cx) + 0.03, s * (halfBeamAt(spec, cx) - 0.12), { metal: 0.8, rough: 0.3 }));
    heel.add(box(0.12, 0.07, 0.07, 0x1d2126, gx + 0.2, sheerHeight(spec, gx) + 0.06, s * (halfBeamAt(spec, gx) - 0.35)));
  }
}

// Wyposażenie pokładowe wg konfiguracji: knagi, kluzy, półkluzy
export function buildDeckGear(spec, deck) {
  const g = new THREE.Group();
  for (const it of deck) {
    const y = sheerHeight(spec, it.x) + 0.03;
    if (it.kind === 'cleat') {
      const c = new THREE.Group();
      c.add(box(0.32, 0.05, 0.07, COL.metal, 0, 0.09, 0, { metal: 0.8, rough: 0.25 }));
      c.add(box(0.08, 0.08, 0.06, COL.metal, 0, 0.04, 0, { metal: 0.8, rough: 0.25 }));
      c.position.set(it.x, y, it.y);
      g.add(c);
    } else {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.03, 4, 8, it.kind === 'halfFairlead' ? Math.PI : Math.PI * 2), mat(COL.metal, { metal: 0.8, rough: 0.25 }));
      r.rotation.y = Math.PI / 2;
      if (it.kind === 'halfFairlead') r.rotation.z = 0;
      r.position.set(it.x, y + 0.04, it.y);
      g.add(r);
    }
  }
  return g;
}

// Odbijacz (cylinder)
export function buildFender(r) {
  const g = new THREE.Group();
  const body = cyl(r, r, r * 4.2, COL.fender, 8, { rough: 0.6 });
  body.castShadow = true;
  g.add(body);
  const cap1 = cyl(r * 0.6, r, r * 0.4, 0x1d3557, 8);
  cap1.position.y = r * 2.3;
  g.add(cap1);
  const cap2 = cyl(r, r * 0.6, r * 0.4, 0x1d3557, 8);
  cap2.position.y = -r * 2.3;
  g.add(cap2);
  return g;
}

// Kula odbijacza
export function buildBallFender(r) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(0xe2673e, { rough: 0.55 }));
  ball.castShadow = true;
  g.add(ball);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(r * 0.16, r * 0.05, 6, 12), mat(0x1d3557));
  eye.position.y = r * 1.02;
  g.add(eye);
  const rope = cyl(0.008, 0.008, 0.5, 0xeeeeee, 4);
  rope.position.y = r + 0.25;
  g.add(rope);
  return g;
}

// Postać członka załogi
export function buildPerson(jacket = 0xe63946) {
  const g = new THREE.Group();
  const legs = box(0.28, 0.8, 0.22, 0x2b2d42, 0, 0.4, 0);
  const body = box(0.4, 0.62, 0.28, jacket, 0, 1.12, 0);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0xf1c9a5));
  head.position.y = 1.58;
  const cap = box(0.24, 0.07, 0.24, 0x1d3557, 0, 1.7, 0);
  g.add(legs, body, head, cap);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.legs = legs;
  return g;
}

export { sheerHeight };
