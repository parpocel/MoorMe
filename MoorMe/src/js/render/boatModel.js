// Proceduralny model jachtu w stylu low-poly (Bavaria serii C)
// Układ modelu: +x do dziobu, +y do góry, +z na sterburtę. Środek = środek ciężkości na linii wodnej.
import * as THREE from 'three';
import { hullExtents, halfBeamAt } from '../data/boats.js';

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
function buildHull(spec, hullColor, stripeColor) {
  const { xs, xb } = hullExtents(spec);
  const N = 18;
  const bands = [
    // [wysokość względna do wolnej burty lub bezwzględna, szerokość względna, kolor]
    { h: (fb) => fb, w: 1.0 },
    { h: (fb) => fb * 0.83, w: 1.0 },
    { h: (fb) => fb * 0.66, w: 0.995 },
    { h: (fb) => fb * 0.34, w: 0.97 },
    { h: () => 0.02, w: 0.9 },
    { h: () => -0.1, w: 0.86 },
    { h: (fb, d) => -d * 0.72, w: 0.55 },
    { h: (fb, d) => -d, w: 0.0 }
  ];
  const bandColors = [hullColor, stripeColor, hullColor, hullColor, COL.boot, COL.antifoul, COL.antifoul];
  const stations = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = xs + (xb - xs) * Math.pow(t, 0.92);
    const hb = i === N ? 0 : halfBeamAt(spec, i === 0 ? xs + 0.001 : x);
    const fb = sheerHeight(spec, x);
    let d = spec.canoeDraft * (t > 0.82 ? Math.max(0.05, (1 - t) / 0.18) : t < 0.06 ? 0.45 + t * 9 : 1);
    if (i === 0) d = 0.12; // pawęż nad wodą
    const pts = bands.map((bd) => {
      let y = bd.h(fb, d);
      let w = bd.w;
      if (i === 0 && y < 0.12) y = Math.max(y, 0.12 - (1 - w) * 0.2);
      // stewa dziobowa – prawie pionowa
      const bowPull = t > 0.9 ? (t - 0.9) / 0.1 : 0;
      const xx = x - bowPull * (fb - y) * 0.06;
      return { x: xx, y, w: hb * w };
    });
    stations.push(pts);
  }
  const pos = [], col = [];
  const c = new THREE.Color();
  const pushTri = (a, b, cc, color) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], cc[0], cc[1], cc[2]);
    c.set(color);
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < N; i++) {
    const A = stations[i], Bs = stations[i + 1];
    for (let j = 0; j < bands.length - 1; j++) {
      const color = bandColors[j];
      for (const side of [1, -1]) {
        const p1 = [A[j].x, A[j].y, side * A[j].w];
        const p2 = [Bs[j].x, Bs[j].y, side * Bs[j].w];
        const p3 = [Bs[j + 1].x, Bs[j + 1].y, side * Bs[j + 1].w];
        const p4 = [A[j + 1].x, A[j + 1].y, side * A[j + 1].w];
        if (side === -1) { pushTri(p1, p2, p3, color); pushTri(p1, p3, p4, color); }
        else { pushTri(p1, p3, p2, color); pushTri(p1, p4, p3, color); }
      }
    }
  }
  // pawęż (rufa) – ściana zamykająca
  const T = stations[0];
  for (let j = 0; j < bands.length - 1; j++) {
    const color = j === 1 ? stripeColor : j >= 4 ? COL.antifoul : hullColor;
    const a = [T[j].x, T[j].y, T[j].w], b = [T[j].x, T[j].y, -T[j].w];
    const cc = [T[j + 1].x, T[j + 1].y, -T[j + 1].w], d = [T[j + 1].x, T[j + 1].y, T[j + 1].w];
    pushTri(a, b, cc, color); pushTri(a, cc, d, color);
  }
  // pokład
  for (let i = 0; i < N; i++) {
    const a = stations[i][0], b = stations[i + 1][0];
    const p1 = [a.x, a.y, a.w], p2 = [b.x, b.y, b.w], p3 = [b.x, b.y, -b.w], p4 = [a.x, a.y, -a.w];
    pushTri(p1, p3, p2, COL.deck); pushTri(p1, p4, p3, COL.deck);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Prostopadłościan ułatwiający (x wzdłuż, y góra, z w poprzek)
function box(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function cyl(r1, r2, h, color, seg = 6, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat(color, opts));
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
  const h = 0.5 + L * 0.012;
  const shape = new THREE.Shape();
  shape.moveTo(x0, -wA);
  shape.lineTo(x1 - 0.4, -wF);
  shape.lineTo(x1, -wF * 0.6);
  shape.lineTo(x1, wF * 0.6);
  shape.lineTo(x1 - 0.4, wF);
  shape.lineTo(x0, wA);
  shape.lineTo(x0, -wA);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(0xe8e6e1));
  m.position.y = Math.min(fbA, fbF) - 0.05;
  m.castShadow = true;
  g.add(m);
  const topY = m.position.y + h + 0.08;
  // okna boczne
  const wl = (x1 - x0) * 0.62;
  for (const s of [-1, 1]) {
    const win = box(wl, 0.16, 0.04, COL.window, (x0 + x1) / 2 - 0.1, topY - 0.22, s * ((wA + wF) / 2 + 0.07), { rough: 0.2, metal: 0.4 });
    win.rotation.y = s * Math.atan2(wA - wF, x1 - x0) * -1;
    g.add(win);
  }
  // okna dachowe (luki)
  g.add(box(0.55, 0.05, 0.55, COL.window, x1 - 0.7, topY + 0.01, 0, { rough: 0.2, metal: 0.4 }));
  g.add(box(0.45, 0.05, 0.45, COL.window, (x0 + x1) / 2, topY + 0.01, 0, { rough: 0.2, metal: 0.4 }));
  // relingi dachowe (poręcze)
  for (const s of [-1, 1]) g.add(box((x1 - x0) * 0.6, 0.05, 0.05, COL.teak, (x0 + x1) / 2, topY + 0.05, s * wF * 0.9));
  g.userData.topY = topY;
  g.userData.x0 = x0; g.userData.x1 = x1;
  return g;
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
  // podwójne płetwy sterowe
  for (const s of [-1, 1]) {
    const r = box(0.45, spec.draft * 0.65, 0.07, COL.keel, xs + 0.07 * L, -spec.draft * 0.33, s * spec.beam * 0.28);
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
  heel.add(box(0.9, 0.06, 0.55, COL.teak, ck1 - (ck1 - ck0) * 0.45, fbC + 0.75, 0));
  heel.add(box(0.12, 0.7, 0.12, COL.metal, ck1 - (ck1 - ck0) * 0.45, fbC + 0.4, 0));
  // podwójne koła sterowe
  const wheelR = 0.45 + L * 0.02;
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
    root.userData.wheels.push(wg);
  }
  // sprayhood
  const shg = new THREE.CylinderGeometry(0.85, 0.85, halfBeamAt(spec, cabin.userData.x0) * 1.15, 8, 1, true, 0, Math.PI);
  shg.rotateX(Math.PI / 2);
  shg.rotateZ(Math.PI / 2);
  const sh = new THREE.Mesh(shg, mat(COL.canvas, { side: THREE.DoubleSide }));
  sh.scale.set(1.0, 0.75, 1);
  sh.position.set(cabin.userData.x0 + 0.15, cabin.userData.topY - 0.08, 0);
  sh.castShadow = true;
  heel.add(sh);

  // maszt, bom, olinowanie
  const mastX = 0.1 * L;
  const mastH = spec.mastHeight - spec.freeboard;
  const topY = cabin.userData.topY;
  const mast = cyl(0.09, 0.07, mastH, COL.mast, 6, { metal: 0.5, rough: 0.4 });
  mast.position.set(mastX, topY + mastH / 2, 0);
  heel.add(mast);
  const boomL = mastX - (xs + 0.12 * L);
  const boomY = topY + 1.9;
  const boom = cyl(0.07, 0.07, boomL, COL.mast, 5);
  boom.rotation.z = Math.PI / 2;
  boom.position.set(mastX - boomL / 2, boomY, 0);
  heel.add(boom);
  // pokrowiec grota (lazy bag)
  const bag = box(boomL * 0.92, 0.45, 0.32, opts.canvas ?? COL.canvas, mastX - boomL / 2 + 0.1, boomY + 0.22, 0);
  heel.add(bag);
  // salingi
  const rig = [];
  const mtop = topY + mastH;
  const spY1 = topY + mastH * 0.36, spY2 = topY + mastH * 0.68;
  for (const s of [-1, 1]) {
    heel.add(strut([mastX, spY1, 0], [mastX - 0.3, spY1, s * spec.beam * 0.3], 0.025, COL.mast));
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
  heel.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x3a3f44 })));
  // zrolowany genua na sztagu
  const gen = strut(stemTop, [mastX, mtop - 0.9, 0], 0.13, opts.canvas ?? COL.canvas, 6);
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
  heel.add(new THREE.LineSegments(rlg, new THREE.LineBasicMaterial({ color: 0xb8bec5 })));

  // kotwica na rolce
  heel.add(box(0.5, 0.12, 0.2, COL.metal, xb + 0.1, sheerHeight(spec, xb) + 0.05, 0, { metal: 0.8, rough: 0.3 }));
  // bandera na rufie
  const flagStaff = strut([xs + 0.1, fbC + 0.2, spec.beam * 0.3], [xs - 0.2, fbC + 1.3, spec.beam * 0.3], 0.015, COL.teak);
  heel.add(flagStaff);
  const flag = new THREE.Group();
  flag.add(box(0.02, 0.18, 0.5, 0xffffff, 0, 0.09, -0.25));
  flag.add(box(0.02, 0.18, 0.5, 0xdc143c, 0, -0.09, -0.25));
  flag.position.set(xs - 0.2, fbC + 1.2, spec.beam * 0.3);
  flag.rotation.y = Math.PI / 2;
  heel.add(flag);
  root.userData.flag = flag;
  // platforma kąpielowa (opuszczana pawęż)
  heel.add(box(0.5, 0.08, spec.beam * 0.7, COL.teak, xs - 0.2, 0.35, 0));

  addBoatDetails(heel, root, spec, { cabin, fbC, ck0, ck1, ckw, mastX, topY, mtop, name: opts.name });

  root.userData.heel = heel;
  root.userData.spec = spec;
  root.userData.deckY = deckY;
  root.userData.mastTop = mtop;
  // miejsca, na których siadają mewy: końce dolnych salingów i top masztu (układ grupy przechyłu)
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
function nameTexture(name) {
  if (nameTexCache.has(name)) return nameTexCache.get(name);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 96);
  g.fillStyle = '#1b2a3a';
  g.font = 'bold 64px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, 256, 44);
  g.font = '22px Georgia, serif';
  g.fillText('GDYNIA', 256, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  nameTexCache.set(name, t);
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
  // okna w burtach (charakterystyczne dla serii C): długie okno salonu + mniejsze kabinowe
  for (const side of [-1, 1]) {
    for (const [x0, x1, hRel] of [[-0.02 * L, 0.2 * L, 0.72], [0.24 * L, 0.3 * L, 0.74], [-0.32 * L, -0.24 * L, 0.73]]) {
      const xm = (x0 + x1) / 2, len = x1 - x0;
      const slope = (halfBeamAt(spec, x1) - halfBeamAt(spec, x0)) / len;
      const w = box(len, 0.13 + L * 0.004, 0.02, 0x16202b, xm, sheerHeight(spec, xm) * hRel, side * (halfBeamAt(spec, xm) * 0.995 + 0.012), glass);
      w.rotation.y = -side * Math.atan(slope);
      heel.add(w);
    }
    // teakowa listwa na krawędzi pokładu i ciemna odbojnica pod nią
    sheerStrip(heel, spec, side, 0.04, 0.03, 0.03, COL.teak);
    sheerStrip(heel, spec, side, -0.06, -0.02, 0.028, 0x2a3036);
    // prowadnice szotów foka na pokładzie bocznym
    const gx = d.mastX - 0.6;
    heel.add(box(1.4, 0.03, 0.05, COL.dark, gx - 0.9, sheerHeight(spec, gx) + 0.02, side * (halfBeamAt(spec, gx) - 0.35), { metal: 0.6 }));
    // kabestany (winche): przy kokpicie i na dachu nadbudówki
    for (const [wx, wy, wz] of [[d.ck0 + 0.9, d.fbC + 0.45, side * (d.ckw / 2 - 0.12)], [d.cabin.userData.x0 + 0.25, d.topY + 0.02, side * 0.55]]) {
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
  // tratwa ratunkowa na koszu rufowym
  heel.add(box(0.55, 0.3, 0.4, 0xf2f2f2, xs + 0.35, d.fbC + 0.75, -spec.beam * 0.3));
  // drabinka kąpielowa
  for (let k = 0; k < 4; k++) heel.add(box(0.05, 0.03, 0.4, COL.metal, xs - 0.47, 0.3 - k * 0.22, spec.beam * 0.1, { metal: 0.8 }));
  // nazwa na pawęży
  const nm = d.name || BOAT_NAMES[0];
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(spec.beam * 0.55, spec.beam * 0.1), new THREE.MeshBasicMaterial({ map: nameTexture(nm), transparent: true, depthWrite: false }));
  plate.position.set(xs - 0.012, sheerHeight(spec, xs) * 0.62, 0);
  plate.rotation.y = -Math.PI / 2;
  plate.userData.keep = true;
  heel.add(plate);
  // fały wzdłuż masztu
  const hp = [];
  for (const dz of [-0.06, 0.06]) hp.push(d.mastX + 0.1, d.topY + 1.2, dz, d.mastX + 0.1, d.mtop - 0.3, dz);
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
  heel.add(new THREE.LineSegments(hg, new THREE.LineBasicMaterial({ color: 0xd8d2c0 })));
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
