// Scena rejsu: wybrzeże i wyspy (low-poly), znaki nawigacyjne IALA, wrak, latarnie, trasa i waypointy.
import * as THREE from 'three';
import { coastZ } from '../data/passage.js';
import { rng, clamp } from '../math.js';

// ---------- Szum wartościowy (deterministyczny) ----------
const hash = (x, z) => {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
const fbm = (x, z) => 0.55 * vnoise(x, z) + 0.3 * vnoise(x * 2.1 + 7, z * 2.1 + 3) + 0.15 * vnoise(x * 4.3 + 1, z * 4.3 + 9);
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

const PAL = {
  baltic: { sand: 0xe3d6a6, grass: 0x6f9d50, forest: 0x41703f, high: 0x5f8248, rock: 0x8f8c82, roof: [0xa6432d, 0x9c3b28, 0x3d3d44], wall: [0xf3efe6, 0xe3c16f, 0xb85a3c, 0xd8d0c0] },
  med: { sand: 0xdcd3ba, grass: 0xa2a96c, forest: 0x62804a, high: 0xb7af98, rock: 0xa8a18d, roof: [0xb5563a, 0xa84a30, 0xc2663f], wall: [0xe6d7b8, 0xefe3c8, 0xf5f1e8, 0xe3be7c] }
};

function landColor(pal, h, d, relief, n) {
  const c = new THREE.Color();
  if (d < 20) return c.setHex(pal.sand).offsetHSL(0, 0, (n - 0.5) * 0.05);
  const r = clamp(h / Math.max(relief, 20), 0, 1);
  const base = r < 0.22 ? pal.grass : r < 0.55 ? pal.forest : r < 0.8 ? pal.high : pal.rock;
  c.setHex(base);
  c.offsetHSL((n - 0.5) * 0.04, 0, (n - 0.5) * 0.12);
  return c;
}

// Trójkąt z gwarantowaną orientacją „do góry”
function pushTri(pos, col, a, b, c, ca, cb, cc) {
  const e1x = b[0] - a[0], e1z = b[2] - a[2], e2x = c[0] - a[0], e2z = c[2] - a[2];
  const ny = e1z * e2x - e1x * e2z;
  if (ny < 0) { [b, c] = [c, b]; [cb, cc] = [cc, cb]; }
  pos.push(...a, ...b, ...c);
  col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
}

function landMesh(pos, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.frustumCulled = false;
  return m;
}

// ---------- Wysokość terenu wzdłuż brzegu (d – odległość w głąb lądu) ----------
function coastHeight(H, x, d) {
  const relief = H.relief * (0.55 + 0.45 * Math.sin(x / 1700 + 1.3));
  const edge = d < 18 ? 0.3 + d * 0.04 : 1.0 + Math.min(1.5, (d - 18) * 0.01);
  const rise = relief * smooth(d / 900);
  const rough = (fbm(x * 0.004, d * 0.004) - 0.5) * relief * 0.55 * smooth(d / 160);
  return Math.max(0.3, edge + rise + rough);
}

function buildCoast(H, coast, pal) {
  const pts = coast.pts;
  const xs = new Set(pts.map((p) => p[0]));
  for (let x = Math.ceil(pts[0][0] / 90) * 90; x < pts[pts.length - 1][0]; x += 90) xs.add(x);
  const X = [...xs].sort((a, b) => a - b);
  const rows = [0, 6, 20, 48, 95, 170, 270, 410, 600, 850, coast.D];
  const V = (x, d) => {
    const h = coastHeight(H, x, d);
    const n = fbm(x * 0.02, d * 0.02);
    return { p: [x, h, coastZ(pts, x) - d], c: landColor(pal, h, d, H.relief, n) };
  };
  const pos = [], col = [];
  let prev = X.map((x) => V(x, rows[0]));
  for (let j = 1; j < rows.length; j++) {
    const cur = X.map((x) => V(x, rows[j]));
    for (let i = 0; i < X.length - 1; i++) {
      const a = prev[i], b = prev[i + 1], c = cur[i], d = cur[i + 1];
      pushTri(pos, col, a.p, b.p, c.p, a.c, b.c, c.c);
      pushTri(pos, col, b.p, d.p, c.p, b.c, d.c, c.c);
    }
    prev = cur;
  }
  return landMesh(pos, col);
}

function buildIsland(H, isl, pal) {
  const poly = isl.poly, n = poly.length;
  const cx = poly.reduce((a, p) => a + p[0], 0) / n, cz = poly.reduce((a, p) => a + p[1], 0) / n;
  const scales = [1, 0.93, 0.78, 0.6, 0.42, 0.24, 0.0];
  const hOf = (k, i) => {
    const s = scales[k];
    if (k === 0) return 0.3;
    if (k === 1) return 1.0;
    const x = cx + (poly[i][0] - cx) * s, z = cz + (poly[i][1] - cz) * s;
    const t = Math.pow(1 - s, 1.25);
    return 1.2 + isl.h * t * (0.75 + 0.5 * fbm(x * 0.012, z * 0.012));
  };
  const rings = scales.map((s, k) => poly.map((p, i) => {
    const x = cx + (p[0] - cx) * s, z = cz + (p[1] - cz) * s;
    const h = k === scales.length - 1 ? 1.2 + isl.h * (0.95 + 0.15 * fbm(cx * 0.01, cz * 0.01)) : hOf(k, i);
    const d = (1 - s) * Math.min(Math.hypot(poly[0][0] - cx, poly[0][1] - cz), 200);
    return { p: [x, h, z], c: landColor(pal, h, k === 0 ? 0 : k === 1 ? 10 : 30 + d, isl.h, fbm(x * 0.03, z * 0.03)) };
  }));
  const pos = [], col = [];
  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = rings[k][i], b = rings[k][j], c = rings[k + 1][i], d = rings[k + 1][j];
      pushTri(pos, col, a.p, b.p, c.p, a.c, b.c, c.c);
      if (k < rings.length - 2) pushTri(pos, col, b.p, d.p, c.p, b.c, d.c, c.c);
    }
  }
  const m = landMesh(pos, col);
  m.userData.island = { cx, cz };
  return m;
}

// Wysokość terenu w punkcie (do stawiania domów i drzew)
function groundAt(H, x, z) {
  for (const c of H.coasts) {
    const zc = coastZ(c.pts, x), d = zc - z;
    if (d >= 0 && d <= c.D && x >= c.pts[0][0] && x <= c.pts[c.pts.length - 1][0]) return { h: coastHeight(H, x, d), d };
  }
  return null;
}

// ---------- Światła znaków ----------
const LIGHT_RANGE = 926; // 0,5 Nm – dalej światła nie są widoczne
// punkcik o stałej wielkości kątowej, gasnący pod koniec zasięgu
function dotLight(sp, d, on, lightsOn) {
  // natężenie maleje z odległością: z bliska pełne, na granicy zasięgu ledwo widoczne
  const k = clamp(1 - d / LIGHT_RANGE, 0, 1);
  const fade = k * k * 0.75 + k * 0.25;
  sp.visible = on > 0 && fade > 0.01;
  if (!sp.visible) return;
  sp.material.opacity = on * lightsOn * fade;
  sp.scale.setScalar(clamp(d * 0.007, 0.7, 6) * (0.55 + 0.45 * k));
}
let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

// Wzory świateł: zwracają natężenie 0..1 oraz kolor (dla naprzemiennych)
const flashes = (t, list, period) => { const x = t % period; return list.some(([a, b]) => x >= a && x < b) ? 1 : 0; };
const PATTERNS = {
  R: (t) => flashes(t, [[0, 0.6]], 4),
  G: (t) => flashes(t, [[0, 0.6]], 4),
  VQ: (t) => flashes(t, [[0, 0.25]], 0.5),
  VQ3: (t) => flashes(t, [[0, 0.25], [0.5, 0.75], [1, 1.25]], 5),
  VQ6: (t) => flashes(t, [[0, 0.25], [0.5, 0.75], [1, 1.25], [1.5, 1.75], [2, 2.25], [2.5, 2.75], [4, 6.5]], 10), // VQ(6)+LFl 10 s
  VQ9: (t) => flashes(t, [[0, 0.25], [0.5, 0.75], [1, 1.25], [1.5, 1.75], [2, 2.25], [2.5, 2.75], [3, 3.25], [3.5, 3.75], [4, 4.25]], 10),
  ISO: (t) => flashes(t, [[0, 2]], 4),
  FL2: (t) => flashes(t, [[0, 0.4], [1.2, 1.6]], 5),
  FLY: (t) => flashes(t, [[0, 0.5]], 5),
  WRECK: (t) => flashes(t, [[0, 1], [1.5, 2.5]], 3)
};

// ---------- Znaki nawigacyjne ----------
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, flatShading: true, ...o });
function cyl(rt, rb, h, color, seg = 10, y = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(color));
  m.position.y = y + h / 2;
  m.castShadow = true;
  return m;
}
function cone(r, h, color, y, flip = false) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), M(color));
  m.position.y = y + h / 2;
  if (flip) m.rotation.z = Math.PI;
  m.castShadow = true;
  return m;
}
function sphere(r, color, y) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), M(color));
  m.position.y = y;
  m.castShadow = true;
  return m;
}
const BLACK = 0x15181c, YELLOW = 0xf2c230, RED = 0xd62828, GREEN = 0x1f9d55, WHITE = 0xf2f2f0;

export function buildMarkMesh(type) {
  const g = new THREE.Group();
  let lightY = 4.2, lightColor = 0xffffff;
  const floatBase = (color, r = 0.8) => g.add(cyl(r, r * 1.05, 0.7, color, 12, -0.25));
  switch (type) {
    case 'lateralPort': // czerwona beczka
      floatBase(RED, 0.9);
      g.add(cyl(0.7, 0.7, 1.6, RED, 12, 0.45));
      g.add(cyl(0.06, 0.06, 1.3, BLACK, 5, 2.0));
      g.add(cyl(0.28, 0.28, 0.55, RED, 10, 3.2));
      lightY = 4.0; lightColor = 0xff1008;
      break;
    case 'lateralStbd': // zielony stożek
      floatBase(GREEN, 0.9);
      g.add(cone(0.95, 2.2, GREEN, 0.45));
      g.add(cyl(0.06, 0.06, 1.0, BLACK, 5, 2.6));
      g.add(cone(0.3, 0.6, GREEN, 3.4));
      lightY = 4.3; lightColor = 0x00e81c;
      break;
    case 'cardN': case 'cardS': case 'cardE': case 'cardW': {
      floatBase(YELLOW, 0.85);
      const bands = { cardN: [BLACK, YELLOW], cardS: [YELLOW, BLACK], cardE: [BLACK, YELLOW, BLACK], cardW: [YELLOW, BLACK, YELLOW] }[type];
      // pas dolny na pierwszym miejscu; N: czarny u góry, S: czarny u dołu
      const order = type === 'cardN' ? [YELLOW, BLACK] : type === 'cardS' ? [BLACK, YELLOW] : bands;
      const bh = 2.4 / order.length;
      order.forEach((c, i) => g.add(cyl(0.38, 0.38, bh, c, 10, 0.45 + i * bh)));
      const ty = 3.1;
      if (type === 'cardN') { g.add(cone(0.4, 0.6, BLACK, ty)); g.add(cone(0.4, 0.6, BLACK, ty + 0.65)); }
      else if (type === 'cardS') { g.add(cone(0.4, 0.6, BLACK, ty, true)); g.add(cone(0.4, 0.6, BLACK, ty + 0.65, true)); }
      else if (type === 'cardE') { g.add(cone(0.4, 0.6, BLACK, ty, true)); g.add(cone(0.4, 0.6, BLACK, ty + 0.65)); }
      else { g.add(cone(0.4, 0.6, BLACK, ty)); g.add(cone(0.4, 0.6, BLACK, ty + 0.65, true)); }
      lightY = 4.6;
      break;
    }
    case 'safe': { // czerwono-biała kula z czerwoną kulką
      floatBase(WHITE, 0.7);
      const geo = new THREE.SphereGeometry(1.1, 16, 10);
      const colors = [];
      const p = geo.attributes.position;
      const cA = new THREE.Color(RED), cB = new THREE.Color(WHITE);
      for (let i = 0; i < p.count; i++) {
        const a = Math.atan2(p.getZ(i), p.getX(i));
        const c = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 2 ? cA : cB;
        colors.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const s = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, flatShading: true }));
      s.position.y = 1.0; s.castShadow = true;
      g.add(s);
      g.add(cyl(0.06, 0.06, 0.9, BLACK, 5, 2.0));
      g.add(sphere(0.3, RED, 3.15));
      lightY = 3.8;
      break;
    }
    case 'isolated': // czarny z czerwonym pasem i dwiema kulami
      floatBase(BLACK, 0.85);
      g.add(cyl(0.4, 0.4, 0.8, BLACK, 10, 0.45));
      g.add(cyl(0.42, 0.42, 0.7, RED, 10, 1.25));
      g.add(cyl(0.4, 0.4, 0.8, BLACK, 10, 1.95));
      g.add(sphere(0.32, BLACK, 3.1));
      g.add(sphere(0.32, BLACK, 3.8));
      lightY = 4.6;
      break;
    case 'wreck': { // pionowe niebiesko-żółte pasy z żółtym krzyżem
      floatBase(0x1d4e9a, 0.85);
      for (let k = 0; k < 8; k++) {
        const wedge = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.4, 4, 1, false, (k * Math.PI) / 4, Math.PI / 4), M(k % 2 ? YELLOW : 0x1d4e9a));
        wedge.position.y = 1.65;
        wedge.castShadow = true;
        g.add(wedge);
      }
      const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.12), M(YELLOW)); h1.position.y = 3.4;
      const v1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), M(YELLOW)); v1.position.y = 3.4;
      g.add(h1, v1);
      lightY = 4.2; lightColor = 0x1f6bff;
      break;
    }
    case 'special': // żółta beczka z krzyżem X
      floatBase(YELLOW, 0.9);
      g.add(cyl(0.75, 0.75, 1.5, YELLOW, 12, 0.45));
      for (const r of [Math.PI / 4, -Math.PI / 4]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.12), M(YELLOW));
        bar.rotation.z = r; bar.position.y = 2.9;
        g.add(bar);
      }
      lightY = 3.8; lightColor = 0xffb800;
      break;
    default:
      floatBase(WHITE, 0.8);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: lightColor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, depthTest: false, opacity: 0 }));
  sp.position.y = lightY;
  sp.visible = false;
  g.add(sp);
  g.userData.light = sp;
  g.userData.lightColor = lightColor;
  g.scale.setScalar(1.7);
  return g;
}

function house(r, x, y, z, pal) {
  const g = new THREE.Group();
  const w = 6 + r() * 5, d = 5 + r() * 3, h = 3.2 + r() * 2.6;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(pal.wall[Math.floor(r() * pal.wall.length)], { roughness: 0.9 }));
  wall.position.y = h / 2;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.4, 4), M(pal.roof[Math.floor(r() * pal.roof.length)], { roughness: 0.9 }));
  roof.position.y = h + 1.1; roof.rotation.y = Math.PI / 4; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
  g.add(wall, roof);
  g.position.set(x, y, z);
  g.rotation.y = (r() - 0.5) * 0.4;
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

function lighthouse(color) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.0, 2, 10), M(0x9a9a94));
  base.position.y = 1;
  g.add(base);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(2.4 - i * 0.18, 2.6 - i * 0.18, 3.4, 10), M(i % 2 ? 0xffffff : color));
    s.position.y = 3.7 + i * 3.4;
    g.add(s);
  }
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2, 10), new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0x665522 }));
  lamp.position.y = 21.4;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.8, 10), M(0x333333));
  cap.position.y = 23.3;
  g.add(lamp, cap);
  return g;
}

function wreckMesh(w) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(22, 4.5, 6.5), M(0x5a3f30, { roughness: 1 }));
  hull.position.set(0, -0.9, 0); hull.rotation.z = 0.22;
  const bow = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 5.4), M(0x4b362a, { roughness: 1 }));
  bow.position.set(12, -1.4, 0); bow.rotation.z = -0.1;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 11, 6), M(0x2d2a28));
  mast.position.set(-2, 4, 0); mast.rotation.z = 0.35;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4.5), M(0x6a5a50, { roughness: 1 }));
  cabin.position.set(-5, 1.4, 0); cabin.rotation.z = 0.2;
  g.add(hull, bow, mast, cabin);
  g.position.set(w.x, 0, w.z);
  g.rotation.y = w.rot || 0;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/**
 * @returns {{ group, dyn, bollardMeshes, lamps, lighthouses, marks, update(t, view), setNext(i) }}
 */
export function buildSea(H, scene) {
  const group = new THREE.Group();
  const dyn = new THREE.Group();
  const pal = PAL[H.style] || PAL.baltic;
  const r = rng(77);

  // ląd
  for (const c of H.coasts) group.add(buildCoast(H, c, pal));
  for (const isl of H.islands) group.add(buildIsland(H, isl, pal));
  // główki portu
  for (const poly of H.moles) {
    const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...zs) - Math.min(...zs);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.6, d), M(0xb8b4a8, { roughness: 0.95 }));
    m.position.set(Math.min(...xs) + w / 2, 0.8, Math.min(...zs) + d / 2);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  // mielizny: jaśniejsza plama tuż nad lustrem wody (nocą przygaszona)
  const shoalMats = [];
  for (const s of (H.blind ? [] : H.shoals)) {
    const shape = new THREE.Shape();
    s.poly.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xcfe9d2, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    shoalMats.push(m.material);
    m.position.y = 0.45;
    m.renderOrder = 3;
    group.add(m);
  }
  // wraki
  for (const w of H.wrecks) group.add(wreckMesh(w));
  // domy w wsiach
  for (const v of H.villages) {
    for (let k = 0; k < v.n; k++) {
      const x = v.x + (k % 6) * 17 + (r() - 0.5) * 8;
      const dRow = 34 + Math.floor(k / 6) * 24 + r() * 8;
      const gz = groundAt(H, x, coastZ(H.coasts[0].pts, x) - dRow);
      if (!gz) continue;
      group.add(house(r, x, gz.h - 0.2, coastZ(H.coasts[0].pts, x) - dRow, pal));
    }
  }
  // drzewa (instancje)
  {
    const N = 1500;
    const geo = new THREE.ConeGeometry(2.2, 7.5, 6);
    geo.translate(0, 3.7, 0);
    const trees = new THREE.InstancedMesh(geo, M(0xffffff, { roughness: 1 }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
    const c = new THREE.Color();
    let n = 0;
    const tint = H.style === 'med' ? [0x4a7040, 0x6b8a4f, 0x7f8f5a] : [0x2f5f35, 0x3d7340, 0x4a8044];
    const coast = H.coasts[0];
    const x0 = coast.pts[0][0] + 400, x1 = coast.pts[coast.pts.length - 1][0] - 400;
    for (let tries = 0; tries < 6000 && n < N * 0.8; tries++) {
      const x = x0 + r() * (x1 - x0), d = 45 + Math.pow(r(), 1.7) * 900;
      if (fbm(x * 0.006, d * 0.006) < 0.42) continue;
      const g = groundAt(H, x, coastZ(coast.pts, x) - d);
      if (!g) continue;
      const s = 0.7 + r() * 0.9;
      pv.set(x, g.h - 0.3, coastZ(coast.pts, x) - d); sc.set(s, s * (0.9 + r() * 0.5), s);
      m4.compose(pv, q, sc); trees.setMatrixAt(n, m4);
      trees.setColorAt(n, c.setHex(tint[Math.floor(r() * tint.length)]));
      n++;
    }
    for (const isl of H.islands) {
      const poly = isl.poly, cnt = Math.min(70, Math.floor(poly.length * isl.h * 0.12));
      const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cz = poly.reduce((a, p) => a + p[1], 0) / poly.length;
      for (let k = 0; k < cnt && n < N; k++) {
        const ang = r() * Math.PI * 2, rr = Math.sqrt(r());
        const rx = Math.hypot(poly[0][0] - cx, poly[0][1] - cz);
        const ex = cx + Math.cos(ang) * rr * rx * 0.72, ez = cz + Math.sin(ang) * rr * rx * 0.55;
        // wysokość wyspy w tym punkcie – w przybliżeniu jak w siatce pierścieni
        const t = Math.pow(1 - clamp(rr / 0.95, 0, 1), 1.25);
        const y = 1.2 + isl.h * t * 0.9;
        if (y < 3) continue;
        const s = 0.6 + r() * 0.7;
        pv.set(ex, y - 0.3, ez); sc.set(s, s, s);
        m4.compose(pv, q, sc); trees.setMatrixAt(n, m4);
        trees.setColorAt(n, c.setHex(tint[Math.floor(r() * tint.length)]));
        n++;
      }
    }
    trees.count = n;
    trees.instanceMatrix.needsUpdate = true;
    if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
    trees.frustumCulled = false;
    group.add(trees);
  }
  // latarnie
  const lighthouses = [];
  for (const l of H.lighthouses) {
    const lh = lighthouse(l.color);
    const g = groundAt(H, l.x, l.z);
    const y = g ? g.h : 2;
    lh.position.set(l.x, y - 0.3, l.z);
    group.add(lh);
    lighthouses.push({ x: l.x, y: y + 21.4, z: l.z, color: l.color });
  }

  // znaki
  const marks = [];
  for (const m of H.marks) {
    const mesh = buildMarkMesh(m.type);
    mesh.position.set(m.x, 0, m.z);
    mesh.userData.mark = m;
    mesh.userData.phase = r() * 6;
    dyn.add(mesh);
    marks.push({ def: m, mesh, pattern: PATTERNS[m.type.startsWith('lateralPort') ? 'R' : m.type.startsWith('lateralStbd') ? 'G' : m.flash] || PATTERNS.VQ });
  }
  // światła główek portu (lewa czerwona, prawa zielona przy wejściu od południa)
  const heads = [];
  H.moles.forEach((poly, i) => {
    const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
    const hx = (Math.min(...xs) + Math.max(...xs)) / 2, hz = Math.max(...zs);
    const col = i === 0 ? 0xff1008 : 0x00e81c;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 6, 8), M(i === 0 ? RED : GREEN));
    post.position.set(hx, 5.5, hz - 3);
    group.add(post);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, depthTest: false, opacity: 0 }));
    sp.position.set(hx, 8.8, hz - 3);
    sp.visible = false;
    dyn.add(sp);
    heads.push({ sprite: sp, pattern: PATTERNS.R });
  });

  // trasa i waypointy
  const routeGroup = new THREE.Group();
  const R = H.route;
  const lp = [];
  for (let i = 0; i < R.length - 1; i++) lp.push(R[i].x, 0.7, R[i].z, R[i + 1].x, 0.7, R[i + 1].z);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  const routeLine = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.55 }));
  routeLine.frustumCulled = false;
  routeGroup.add(routeLine);
  const wpRings = R.map((p, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(i === R.length - 1 ? 40 : 22, 0.8, 6, 36), new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.8 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(p.x, 0.8, p.z);
    ring.visible = i > 0;
    routeGroup.add(ring);
    return ring;
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 140, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  beam.position.y = 70;
  routeGroup.add(beam);
  dyn.add(routeGroup);

  const tmp = new THREE.Vector3();
  const api = {
    group, dyn, bollardMeshes: [], lamps: [], lighthouses, marks, routeGroup,
    setNext(i) {
      const p = R[Math.min(i, R.length - 1)];
      beam.position.set(p.x, 70, p.z);
      wpRings.forEach((ring, k) => { ring.visible = k >= i; ring.material.opacity = k === i ? 1 : 0.45; });
    },
    // kołysanie znaków na fali i migotanie świateł (lightsOn: 0..1 – noc)
    update(t, view, windKn, windDir, lightsOn) {
      const cam = view.camera.position;
      for (const m of marks) {
        const { mesh, def } = m;
        const h = view.water.heightAt(def.x, def.z, windKn, windDir);
        mesh.position.y = h * 0.5;
        mesh.rotation.x = Math.sin(t * 0.9 + mesh.userData.phase) * 0.06 * (1 + windKn / 12);
        mesh.rotation.z = Math.cos(t * 0.7 + mesh.userData.phase) * 0.06 * (1 + windKn / 12);
        const sp = mesh.userData.light;
        // nocą bryła znaku stopniowo się zarysowuje: niewidoczna od ~260 m, pełny kształt dopiero z bliska (~80 m)
        const dn = cam.distanceTo(mesh.position);
        const vis = lightsOn > 0.3 ? clamp((260 - dn) / 180, 0, 1) : 1;
        if (mesh.userData.vis !== vis) {
          mesh.userData.vis = vis;
          const glowK = lightsOn * 0.28 * (0.4 + 0.6 * vis);
          mesh.traverse((o) => {
            if (!o.isMesh || !o.material) return;
            o.visible = vis > 0.02;
            o.material.transparent = vis < 1;
            o.material.opacity = vis;
            o.material.depthWrite = vis > 0.6;
            if (o.material.emissive) {
              if (!o.userData.base) o.userData.base = o.material.color.clone();
              o.material.emissive.copy(o.userData.base).lerp(new THREE.Color(0x6a7a90), 0.25);
              o.material.emissiveIntensity = lightsOn > 0.3 ? glowK : 0;
            }
          });
        }
        let on = lightsOn > 0.05 ? m.pattern(t + mesh.userData.phase) : 0;
        let col = mesh.userData.lightColor;
        if (def.type === 'wreck') col = Math.floor((t + mesh.userData.phase) % 3) === 0 ? 0x1f6bff : 0xffb800;
        sp.material.color.setHex(col);
        sp.getWorldPosition(tmp);
        dotLight(sp, cam.distanceTo(tmp), on, lightsOn);
      }
      for (const hd of heads) {
        const on = lightsOn > 0.05 ? hd.pattern(t) : 0;
        dotLight(hd.sprite, cam.distanceTo(hd.sprite.position), on, lightsOn);
      }
      beam.material.opacity = 0.16 + 0.08 * Math.sin(t * 2);
      routeGroup.visible = !H.blind && lightsOn < 0.35; // nocą trasa widoczna tylko na kartplotterze
      for (const sm of shoalMats) sm.color.setHex(0xcfe9d2).multiplyScalar(1 - 0.88 * lightsOn);
    }
  };
  scene.add(group);
  scene.add(dyn);
  api.setNext(1);
  return api;
}
