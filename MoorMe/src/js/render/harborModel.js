// Scenografia portu: keje, pomosty, polery, dalby, Y-bomy, falochron, zabudowa, zieleń, sąsiednie jachty
import * as THREE from 'three';
import { mat, buildBoat, createFlag, createNamePlate } from './boatModel.js';
import { FLAGS, FLAG_CODES } from './flags.js';
import { mergeByMaterial } from './merge.js';
import { rng } from '../math.js';
import { hullExtents, halfBeamAt } from '../data/boats.js';

function extrudePoly(poly, top, bottom, material) {
  const shape = new THREE.Shape();
  // wielokąt w (x,z) -> kształt w (x,-z), po obrocie wraca do z
  poly.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bottom, 0);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function box(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function plankTexture(base = '#9c7650') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 16; i++) {
    const y = i * 16;
    g.fillStyle = `rgba(0,0,0,${0.12 + (i % 3) * 0.05})`;
    g.fillRect(0, y, 256, 2);
    g.fillStyle = `rgba(255,255,255,${0.04 + (i % 2) * 0.03})`;
    g.fillRect(0, y + 3, 256, 5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function concreteTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#a9a8a2';
  g.fillRect(0, 0, 256, 256);
  const r = rng(5);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},0.05)`;
    g.fillRect(r() * 256, r() * 256, 2 + r() * 3, 2 + r() * 3);
  }
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function setUVWorld(geo, scale = 0.25) {
  // UV z pozycji (widok z góry)
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) * scale;
    uv[i * 2 + 1] = pos.getZ(i) * scale + pos.getY(i) * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

const BOLLARD_MAT = new THREE.MeshStandardMaterial({ color: 0x2d2f33, metalness: 0.45, roughness: 0.5 });
const CLEAT_MAT = new THREE.MeshStandardMaterial({ color: 0xc3c9d0, metalness: 0.85, roughness: 0.32 });
const BOLT_MAT = new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.9, roughness: 0.4 });
export function buildBollard(kind) {
  const g = new THREE.Group();
  if (kind === 'bollard') {
    // żeliwny poler: profil toczony (lathe) – stopa, szyjka i wywinięta głowica
    const prof = [[0, 0], [0.24, 0], [0.24, 0.04], [0.19, 0.07], [0.16, 0.14], [0.155, 0.32], [0.18, 0.38], [0.26, 0.42], [0.27, 0.46], [0.24, 0.5], [0, 0.51]].map(([r, yy]) => new THREE.Vector2(r, yy));
    const b = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), BOLLARD_MAT);
    g.add(b);
  } else if (kind === 'cleat') {
    // aluminiowa knaga pomostowa (odlew): owalna podstawa ze śrubami, dwie nóżki i róg z zaokrąglonymi końcami
    const m = CLEAT_MAT;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.025, 20), m); base.scale.set(2.1, 1, 0.75); base.position.y = 0.012; g.add(base);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.046, 0.15, 12), m); leg.scale.z = 0.8; leg.position.set(sx * 0.08, 0.095, 0); g.add(leg);
      for (const sz of [-1, 1]) { const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 8), BOLT_MAT); bolt.position.set(sx * 0.17, 0.028, sz * 0.035); g.add(bolt); }
    }
    const horn = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.34, 6, 12), m);
    horn.rotation.z = Math.PI / 2; horn.scale.set(0.85, 1, 1); horn.position.y = 0.18; g.add(horn);
    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 8), m); hump.scale.set(2.2, 0.8, 0.9); hump.position.y = 0.185; g.add(hump);
  } else if (kind === 'ring') {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 5, 10), mat(0xbfc5cc, { metal: 0.8, rough: 0.3 }));
    t.rotation.x = Math.PI / 2;
    t.position.y = 0.03;
    g.add(t);
  } else if (kind === 'pile') {
    // na dalbie – obejma cumownicza
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 4, 10), mat(0x7a7a7a, { metal: 0.6 }));
    t.rotation.x = Math.PI / 2;
    g.add(t);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(1.3);
  return g;
}

function tree(r, x, z, y) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.6, 5), mat(0x6b4a2f));
  trunk.position.y = 0.8;
  g.add(trunk);
  const kind = r();
  if (kind < 0.45) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.4 + r(), 4 + r() * 2, 6), mat(0x2f6b3a));
    c.position.y = 3.6;
    g.add(c);
  } else if (kind < 0.8) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + r() * 0.8, 0), mat(r() < 0.5 ? 0x4a8a3f : 0x5c9a45));
    c.position.y = 2.9;
    g.add(c);
  } else {
    // palma / pinia
    const trunk2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 4, 5), mat(0x7a5a3a));
    trunk2.position.y = 2;
    g.add(trunk2);
    const c = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8, 0), mat(0x3f7a3a));
    c.scale.y = 0.45;
    c.position.y = 4.2;
    g.add(c);
  }
  g.position.set(x, y, z);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// Tekstury tynku i dachówki (szarości mnożone przez kolor materiału)
function makeTex(draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
let plasterTex = null, tileTex = null;
const texMats = new Map();
function wallMat(color) {
  if (!plasterTex) plasterTex = makeTex((g, S) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, S, S);
    const r = rng(8);
    for (let i = 0; i < 1400; i++) { const v = 200 + Math.floor(r() * 55); g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(r() * S, r() * S, 2 + r() * 4, 2 + r() * 4); }
    g.fillStyle = 'rgba(120,110,100,0.10)'; g.fillRect(0, S * 0.9, S, S * 0.1); // zacieki u dołu
  });
  const key = 'w' + color;
  if (!texMats.has(key)) texMats.set(key, new THREE.MeshStandardMaterial({ color, map: plasterTex, flatShading: true, roughness: 0.95 }));
  return texMats.get(key);
}
function roofMat(color) {
  if (!tileTex) tileTex = makeTex((g, S) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, S, S);
    const rows = 10, cols = 8;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const ox = (y % 2) * (S / cols / 2);
      const v = 170 + ((x * 7 + y * 13) % 5) * 14;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath();
      g.ellipse(((x * S) / cols + ox) % S + S / cols / 2, (y * S) / rows + S / rows * 0.55, S / cols / 2 - 1, S / rows / 2, 0, 0, Math.PI);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, (y * S) / rows, S, 2);
    }
  });
  const key = 'r' + color;
  if (!texMats.has(key)) texMats.set(key, new THREE.MeshStandardMaterial({ color, map: tileTex, flatShading: true, roughness: 0.9 }));
  return texMats.get(key);
}

const PALETTES = {
  med: { walls: [0xe6d7b8, 0xefe3c8, 0xf5f1e8, 0xe3be7c, 0xe8c9b3, 0xd9c7a3, 0xf2ead9], roofs: [0xb5563a, 0xa84a30, 0xc2663f], shutters: [0x3b6b4a, 0x2e6b4f, 0x2a5a8a, 0x4a7a8c], floors: 3 },
  baltic: { walls: [0xa6432d, 0xe3c16f, 0xf3efe6, 0xb85a3c, 0xf0e2b8, 0xd8d0c0, 0x9c3f2b], roofs: [0x3d3d44, 0x9c3b28, 0x4a4a52, 0x7a2f22], shutters: [0xf3efe6, 0x2e4a3a], floors: 2, timber: true },
  default: { walls: [0xf1e3c6, 0xe8d2b0, 0xf4efe6, 0xd9a47f, 0xc9d6df, 0xe7c4a3, 0xffffff], roofs: [0xa8452e, 0x8c3b2a, 0x5b5b66], shutters: [0x2e6b4f, 0x2a5a8a], floors: 3 }
};

function house(r, x, z, y, rotY, pal = PALETTES.default) {
  const g = new THREE.Group();
  const w = 6 + r() * 6, d = 5 + r() * 4;
  const floors = 1 + Math.floor(r() * pal.floors);
  const fh = 2.9, h = 0.5 + floors * fh;
  const wallColors = pal.walls;
  const roofColors = pal.roofs;
  const shutterColors = pal.shutters;
  const wc = wallColors[Math.floor(r() * wallColors.length)];
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat(wc));
  walls.position.y = h / 2;
  g.add(walls);
  // cokół i gzyms
  g.add(box(w + 0.08, 0.5, d + 0.08, 0x8d8a82, 0, 0.25, 0));
  g.add(box(w + 0.3, 0.18, d + 0.3, 0xefe9dd, 0, h - 0.05, 0));
  for (let f = 1; f < floors; f++) g.add(box(w + 0.06, 0.1, d + 0.06, 0xe9e2d4, 0, 0.5 + f * fh, 0));
  // dach: dwuspadowy z dachówką, czterospadowy albo (na południu) płaski z tarasem
  const rk = r(), roofKind = pal === PALETTES.med && rk < 0.25 ? 'flat' : rk < 0.5 ? 'hip' : 'gable';
  let roofH = 1.6 + r() * 1.2;
  const rcol = roofColors[Math.floor(r() * roofColors.length)];
  if (roofKind === 'flat') {
    roofH = 0;
    g.add(box(w + 0.1, 0.5, 0.15, 0xefe9dd, 0, h + 0.25, d / 2)); g.add(box(w + 0.1, 0.5, 0.15, 0xefe9dd, 0, h + 0.25, -d / 2));
    g.add(box(0.15, 0.5, d, 0xefe9dd, w / 2, h + 0.25, 0)); g.add(box(0.15, 0.5, d, 0xefe9dd, -w / 2, h + 0.25, 0));
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.0, 8), mat(0xd9d9d6)); tank.rotation.z = Math.PI / 2; tank.position.set(w * 0.25, h + 0.75, -d * 0.2); g.add(tank);
    g.add(box(1.6, 1.9, 1.6, wc, -w * 0.28, h + 0.95, -d * 0.15)); // wyjście na taras
    if (r() < 0.6) { const pr = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.6, 6), mat(0xf5f1e8)); pr.position.set(w * 0.1, h + 2.3, d * 0.15); g.add(pr); g.add(box(0.06, 2.0, 0.06, 0x8a8a8a, w * 0.1, h + 1.0, d * 0.15)); }
  } else if (roofKind === 'hip') {
    const cg = new THREE.ConeGeometry(1, roofH, 4, 1); cg.rotateY(Math.PI / 4); cg.scale((w + 0.5) / 1.414, 1, (d + 0.7) / 1.414);
    const roof = new THREE.Mesh(cg, roofMat(rcol)); roof.position.y = h + roofH / 2 + 0.02; roof.castShadow = true; g.add(roof);
  } else {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2 - 0.35, 0); shape.lineTo(d / 2 + 0.35, 0); shape.lineTo(0, roofH); shape.lineTo(-d / 2 - 0.35, 0);
    const rg = new THREE.ExtrudeGeometry(shape, { depth: w + 0.5, bevelEnabled: false });
    rg.translate(0, 0, -(w + 0.5) / 2);
    rg.rotateY(Math.PI / 2);
    const roof = new THREE.Mesh(rg, roofMat(rcol));
    roof.position.y = h + 0.02;
    roof.castShadow = true;
    g.add(roof);
    // lukarna (okienko w dachu) od frontu
    if (r() < 0.4 && w > 7) {
      const dx = (r() - 0.5) * w * 0.4;
      g.add(box(1.3, 1.0, 1.2, wc, dx, h + roofH * 0.35, d * 0.22));
      g.add(box(0.7, 0.6, 0.06, 0x243447, dx, h + roofH * 0.35, d * 0.22 + 0.62, { rough: 0.15, metal: 0.4 }));
      const dr = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.6, 4), roofMat(rcol)); dr.rotation.y = Math.PI / 4; dr.scale.set(0.75, 1, 0.9); dr.position.set(dx, h + roofH * 0.35 + 0.78, d * 0.22); g.add(dr);
    }
  }
  if (roofKind !== 'flat') {
    // komin
    const chx = (r() - 0.5) * w * 0.6;
    g.add(box(0.6, 1.4, 0.6, 0x9a6b55, chx, h + roofH * 0.6, -d * 0.12));
    g.add(box(0.75, 0.12, 0.75, 0x6f6f6f, chx, h + roofH * 0.6 + 0.72, -d * 0.12));
  }
  // antena albo talerz satelitarny
  const ant = r();
  if (ant < 0.3) {
    const ax = (r() - 0.5) * w * 0.4, ay = h + (roofKind === 'flat' ? 0.5 : roofH * 0.85);
    g.add(box(0.05, 1.4, 0.05, 0x55595e, ax, ay + 0.7, 0));
    for (let k = 0; k < 3; k++) g.add(box(0.7 - k * 0.15, 0.03, 0.03, 0x55595e, ax, ay + 0.9 + k * 0.22, 0));
  } else if (ant < 0.5) {
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 4, 0, Math.PI * 2, 0, Math.PI / 3), mat(0xe8e8e8));
    dish.rotation.x = -1.1; dish.position.set(w / 2 - 0.6, h - 0.6, d / 2 + 0.25); g.add(dish);
  }
  // rynny i rury spustowe w narożnikach frontu
  for (const sx of [-1, 1]) g.add(box(0.1, h, 0.1, 0x6b6e72, sx * (w / 2 - 0.08), h / 2, d / 2 + 0.08));
  // klimatyzator na ścianie bocznej (częściej na południu)
  if (r() < (pal === PALETTES.med ? 0.5 : 0.15)) g.add(box(0.15, 0.5, 0.8, 0xe8e8e4, w / 2 + 0.1, 0.5 + fh * Math.min(floors - 1, 1) + 1.4, 0));
  // okna z ramami, parapetami i okiennicami (front i tył)
  const shutters = r() < 0.55, sc = shutterColors[Math.floor(r() * shutterColors.length)];
  const nWin = Math.max(2, Math.floor(w / 2.1));
  const shop = r() < 0.4;
  for (const s of [1, -1]) {
    for (let f = 0; f < floors; f++) {
      for (let k = 0; k < nWin; k++) {
        const wx = -w / 2 + (w / nWin) * (k + 0.5);
        const wy = 0.5 + f * fh + 1.35;
        const zf = s * (d / 2 + 0.02);
        const isDoor = s === 1 && f === 0 && k === Math.floor(nWin / 2);
        if (isDoor) {
          g.add(box(1.1, 2.2, 0.1, 0x5a3b26, wx, 0.5 + 1.1, zf));
          g.add(box(1.4, 0.12, 0.12, 0xefe9dd, wx, 0.5 + 2.3, zf + s * 0.02));
          g.add(box(1.6, 0.2, 0.6, 0x9a978f, wx, 0.1, zf + s * 0.3));
          if (r() < 0.6) for (const sd of [-1, 1]) {
            const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 7), mat(0xb5603a)); pot.position.set(wx + sd * 1.05, 0.2, zf + 0.3); g.add(pot);
            const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat(0x4f7a3a)); pl.position.set(wx + sd * 1.05, 0.62, zf + 0.3); g.add(pl);
          }
          continue;
        }
        const big = shop && s === 1 && f === 0;
        const ww = big ? w / nWin - 0.5 : 0.9, wh = big ? 1.9 : 1.2;
        g.add(box(ww + 0.16, wh + 0.16, 0.06, 0xf4f1ea, wx, big ? 0.5 + 1.25 : wy, zf));
        g.add(box(ww, wh, 0.08, 0x243447, wx, big ? 0.5 + 1.25 : wy, zf + s * 0.01, { rough: 0.15, metal: 0.4 }));
        if (!big) {
          g.add(box(ww + 0.3, 0.07, 0.22, 0xe6e0d2, wx, wy - wh / 2 - 0.06, zf + s * 0.08));
          if (shutters) for (const sd of [-1, 1]) g.add(box(0.45, wh, 0.05, sc, wx + sd * (ww / 2 + 0.26), wy, zf + s * 0.03));
          if (s === 1 && f > 0 && r() < 0.3) { // skrzynka z kwiatami
            g.add(box(ww + 0.1, 0.18, 0.22, 0x7a4a2a, wx, wy - wh / 2 - 0.15, zf + 0.14));
            for (let q = 0; q < 3; q++) { const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat([0xd8434e, 0xe96aa0, 0xf2c14e][(q + k) % 3])); fl.position.set(wx - ww / 3 + q * (ww / 3), wy - wh / 2 - 0.02, zf + 0.16); g.add(fl); }
          }
        }
      }
      // balkon na piętrze
      if (f > 0 && s === 1 && r() < 0.35) {
        const bw = Math.min(w * 0.5, 3.5);
        g.add(box(bw, 0.12, 0.9, 0xd8d3c8, 0, 0.5 + f * fh + 0.2, d / 2 + 0.45));
        g.add(box(bw, 0.05, 0.05, 0x2d3436, 0, 0.5 + f * fh + 1.2, d / 2 + 0.88));
        for (let p = 0; p <= 6; p++) g.add(box(0.03, 1.0, 0.03, 0x2d3436, -bw / 2 + (bw / 6) * p, 0.5 + f * fh + 0.7, d / 2 + 0.88));
      }
    }
    // okna w szczytach
    const gw = box(0.06, Math.min(0.8, roofH * 0.4), 0.7, 0x243447, s * (w / 2 + 0.28), h + roofH * 0.3, 0, { rough: 0.15, metal: 0.4 });
    g.add(gw);
  }
  // szachulec (korsvirke) – ciemne belki na jasnych ścianach
  if (pal.timber && wc === 0xf3efe6) {
    for (const sd of [1, -1]) {
      for (let k = 0; k <= Math.floor(w / 1.6); k++) g.add(box(0.12, h - 0.5, 0.05, 0x3b2a20, -w / 2 + k * 1.6, 0.5 + (h - 0.5) / 2, sd * (d / 2 + 0.035)));
      for (let f = 0; f <= floors; f++) g.add(box(w, 0.12, 0.05, 0x3b2a20, 0, 0.5 + f * fh - (f === floors ? 0.08 : 0), sd * (d / 2 + 0.035)));
    }
  }
  // markiza i szyld sklepu / kawiarni
  if (shop) {
    const acol = [0xc0392b, 0x2a6f97, 0x2e8b57, 0xe0a030][Math.floor(r() * 4)];
    const aw = box(w * 0.85, 0.1, 1.6, acol, 0, 3.05, d / 2 + 0.8);
    aw.rotation.x = 0.22;
    g.add(aw);
    g.add(box(w * 0.85, 0.3, 0.05, acol, 0, 2.75, d / 2 + 1.58));
    g.add(box(Math.min(3, w * 0.5), 0.5, 0.08, 0x1d2a38, 0, 3.55, d / 2 + 0.05));
    // stoliki
    for (let t = 0; t < 2; t++) {
      const tx = -w / 4 + t * (w / 2);
      g.add(box(0.7, 0.05, 0.7, 0xf4f1ea, tx, 0.78, d / 2 + 2.4));
      g.add(box(0.08, 0.75, 0.08, 0x2d3436, tx, 0.38, d / 2 + 2.4));
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return g;
}

function lighthouse(color) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.2, 8), mat(0x9a9a94));
  base.position.y = 0.6;
  g.add(base);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.95 - i * 0.07, 1.02 - i * 0.07, 1.6, 8), mat(i % 2 ? 0xffffff : color));
    s.position.y = 2 + i * 1.6;
    g.add(s);
  }
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 8), mat(0xfff2b0, { emissive: 0x665522 }));
  lamp.position.y = 8.6;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.8, 8), mat(0x333333));
  cap.position.y = 9.4;
  g.add(lamp, cap);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// gładko cieniowane materiały dla drobnej architektury nabrzeża (bez kanciastych faset)
const SMATS = new Map();
function smat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!SMATS.has(k)) SMATS.set(k, new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.55, metalness: o.metal ?? 0, emissive: o.emissive ?? 0x000000 }));
  return SMATS.get(k);
}
function rbox(w, h, d, r, color, o) { // prostopadłościan z zaokrąglonymi pionowymi krawędziami
  const sh = new THREE.Shape(), x = w / 2 - r, z = d / 2 - r;
  sh.moveTo(-x, -d / 2); sh.lineTo(x, -d / 2); sh.quadraticCurveTo(w / 2, -d / 2, w / 2, -z); sh.lineTo(w / 2, z); sh.quadraticCurveTo(w / 2, d / 2, x, d / 2);
  sh.lineTo(-x, d / 2); sh.quadraticCurveTo(-w / 2, d / 2, -w / 2, z); sh.lineTo(-w / 2, -z); sh.quadraticCurveTo(-w / 2, -d / 2, -x, -d / 2);
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: Math.min(0.03, h * 0.1), bevelSize: Math.min(0.02, r * 0.5), bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0, 0);
  const m = new THREE.Mesh(g, smat(color, o)); m.castShadow = true; return m;
}

function lamp(x, z, y) {
  // latarnia: stopa, smukły słup, ramię i klosz z zadaszeniem
  const g = new THREE.Group();
  const dark = smat(0x2d3436, { metal: 0.6, rough: 0.4 });
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.25, 20), dark); foot.position.y = 0.12;
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 3.9, 16), dark); p.position.y = 2.1;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 16), dark); ring.rotation.x = Math.PI / 2; ring.position.y = 3.3;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.32, 20), smat(0xfff5d6, { emissive: 0x332a10, rough: 0.2 })); glass.position.y = 4.15;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 20), dark); roof.position.y = 4.39;
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), dark); fin.position.y = 4.49;
  g.add(foot, p, ring, glass, roof, fin);
  g.position.set(x, y, z);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Tablica z napisem na dwóch słupkach
function signBoard(text, x, z, y) {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1d4e89'; ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 500, 84);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 44px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.6, 0.06), [mat(0x1d4e89), mat(0x1d4e89), mat(0x1d4e89), mat(0x1d4e89), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), mat(0x1d4e89)]);
  board.position.y = 2.1;
  board.userData.keep = true; // wiele materiałów – bez scalania
  g.add(board);
  for (const s of [-1, 1]) g.add(box(0.08, 2.4, 0.08, 0x3a3f44, s * 1.4, 1.2, 0));
  g.position.set(x, y, z);
  return g;
}

function bench(x, z, y) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) g.add(box(1.8, 0.05, 0.12, 0x9b6b3f, 0, 0.45, -0.16 + k * 0.16));
  for (let k = 0; k < 2; k++) g.add(box(1.8, 0.1, 0.05, 0x9b6b3f, 0, 0.62 + k * 0.16, -0.26));
  for (const s of [-1, 1]) {
    g.add(box(0.06, 0.45, 0.45, 0x2d3436, s * 0.8, 0.22, 0));
    g.add(box(0.06, 0.4, 0.06, 0x2d3436, s * 0.8, 0.7, -0.26));
  }
  g.position.set(x, y, z);
  return g;
}

function planter(r, x, z, y) {
  const g = new THREE.Group();
  g.add(box(1.2, 0.55, 1.2, 0xb7b2a8, 0, 0.27, 0));
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), mat(0x4f8a3c));
  bush.position.y = 0.9;
  bush.scale.y = 0.8;
  g.add(bush);
  const flowers = [0xe63946, 0xf4a261, 0xffffff, 0xc77dff, 0xffd166];
  for (let k = 0; k < 7; k++) {
    const a = r() * Math.PI * 2, rr = 0.35 + r() * 0.2;
    g.add(box(0.1, 0.1, 0.1, flowers[Math.floor(r() * flowers.length)], Math.cos(a) * rr, 0.95 + r() * 0.3, Math.sin(a) * rr));
  }
  g.position.set(x, y, z);
  return g;
}

function lifebuoy(x, z, y) {
  // koło ratunkowe na stojaku: okrągły słupek, uchwyt, koło z białymi pasami i linką
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.4, 16), smat(0xc0392b, { rough: 0.45 })); post.position.y = 0.7; g.add(post);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 14, 36), smat(0xf26b21, { rough: 0.6 }));
  ring.position.set(0, 1.05, 0.11); g.add(ring);
  for (let k = 0; k < 4; k++) {
    const seg = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.072, 14, 8, 0.32), smat(0xffffff, { rough: 0.6 }));
    seg.rotation.z = (k * Math.PI) / 2 + Math.PI / 4 - 0.16; seg.position.set(0, 1.05, 0.11); g.add(seg);
  }
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8), smat(0x9aa3ab, { metal: 0.8, rough: 0.3 })); hook.rotation.x = Math.PI / 2; hook.position.set(0, 1.33, 0.06); g.add(hook);
  g.position.set(x, y, z);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function pedestal(x, z, y) {
  // słupek serwisowy (prąd i woda): zaokrąglony korpus, granatowa czapka z oświetleniem, gniazda i kran
  const g = new THREE.Group();
  const body = rbox(0.3, 0.92, 0.3, 0.025, 0xf2f2f2, { rough: 0.4 }); g.add(body); // kwadratowy korpus z lekko złamanymi krawędziami
  const cap = rbox(0.36, 0.1, 0.36, 0.025, 0x1d4e89, { rough: 0.35 }); cap.position.y = 0.95; g.add(cap);
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.28), smat(0xfff5d6, { emissive: 0x3a3218, rough: 0.2 })); lens.position.y = 0.935; g.add(lens);
  for (const sx of [-0.07, 0.07]) {
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 16), smat(0x2f6fb5, { rough: 0.4 })); sock.rotation.x = Math.PI / 2; sock.position.set(sx, 0.62, 0.16); g.add(sock);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), smat(0x3ddc84, { emissive: 0x1a6b3a })); led.position.set(0, 0.78, 0.155); g.add(led);
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.09, 10), smat(0xb9bfc6, { metal: 0.8, rough: 0.3 })); tap.rotation.x = Math.PI / 2; tap.position.set(0, 0.45, 0.18); g.add(tap);
  g.position.set(x, y, z);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Detale kei i promenady: kamienna krawędź, odbojnice, drabinki, słupki serwisowe, koła ratunkowe, ławki, donice
// ---------- Elementy ustawiane wzdłuż krawędzi kei / pomostów ----------
// Krawędź: [ax, az, bx, bz]; strona wody – na zewnątrz wielokąta struktury
function edgeFrame(s, e) {
  const [ax, az, bx, bz] = e;
  const len = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / len, uz = (bz - az) / len;
  let nx = -uz, nz = ux;
  const cx = s.poly.reduce((a, p) => a + p[0], 0) / s.poly.length, cz = s.poly.reduce((a, p) => a + p[1], 0) / s.poly.length;
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
  return { ax, az, len, ux, uz, nx, nz, rotY: -Math.atan2(uz, ux), at: (t, off) => ({ x: ax + ux * t + nx * off, z: az + uz * t + nz * off }) };
}
function place(obj, p, y, rotY = 0) { obj.position.set(p.x, y, p.z); obj.rotation.y = rotY; return obj; }

function addEdgeDetails(group, s, r, lamps) {
  const style = s.style || s.kind;
  const top = s.h;
  for (const e of s.edges || []) {
    const E = edgeFrame(s, e);
    const mid = E.at(E.len / 2, 0);
    if (style === 'stone' || style === 'concrete') {
      const stone = style === 'stone';
      // gzyms krawędzi lekko wysunięty nad wodę, na betonie żółty pas ostrzegawczy
      group.add(place(box(E.len, 0.14, 0.75, stone ? 0xd9ceb8 : 0xc9c5bb, 0, 0, 0), E.at(E.len / 2, -0.3), top - 0.03, E.rotY)); // gzyms prawie równo z kejką – liny na nim leżą
      if (!stone) group.add(place(box(E.len, 0.012, 0.12, 0xe8c547, 0, 0, 0), E.at(E.len / 2, -0.12), top + 0.045, E.rotY));
      // spoiny ściany (poziome co ok. 0,5 m, w kamieniu przesunięte spoiny pionowe)
      for (let y = top - 0.5; y > -0.2; y -= stone ? 0.45 : 0.9) group.add(place(box(E.len, 0.025, 0.03, stone ? 0x8c8270 : 0x8f8b82, 0, 0, 0), E.at(E.len / 2, 0.06), y, E.rotY));
      if (stone) {
        let row = 0;
        for (let y = top - 0.5; y > -0.2; y -= 0.45, row++) for (let t = (row % 2) * 0.6 + 0.3; t < E.len; t += 1.2) group.add(place(box(0.025, 0.42, 0.03, 0x8c8270, 0, 0, 0), E.at(t, 0.06), y - 0.22, E.rotY));
      }
      // pas glonów i wilgoci przy linii wody
      group.add(place(box(E.len, 0.45, 0.04, 0x33463a, 0, 0, 0), E.at(E.len / 2, 0.055), 0.05, E.rotY));
      // odbojnice (pionowe gumy) i pozioma belka odbojowa
      for (let t = 2; t < E.len; t += stone ? 6 : 4) group.add(place(box(0.28, top + 0.7, 0.2, 0x1b1b1b, 0, 0, 0), E.at(t, 0.1), (top - 0.7) / 2, E.rotY));
      group.add(place(box(E.len, 0.18, 0.16, 0x23262a, 0, 0, 0), E.at(E.len / 2, 0.14), top - 0.35, E.rotY));
      // odpływy w ścianie
      for (let t = 7; t < E.len - 2; t += 15) group.add(place(box(0.22, 0.16, 0.05, 0x1a1c1e, 0, 0, 0), E.at(t, 0.07), top - 0.75, E.rotY));
      // drabinki wyjściowe
      for (let t = 12; t < E.len - 4; t += 26) {
        for (const sd of [-1, 1]) group.add(place(box(0.05, top + 1.3, 0.05, 0xe8c547, 0, 0, 0), E.at(t + sd * 0.25, 0.14), (top - 1.3) / 2, E.rotY));
        for (let y = -1.1; y < top; y += 0.3) group.add(place(box(0.5, 0.04, 0.04, 0xe8c547, 0, 0, 0), E.at(t, 0.14), y, E.rotY));
      }
    } else if (style === 'wood' || s.kind === 'pier') {
      // drewniane pale pod pomostem (z kapslami), podłużnice, zastrzały i belka krawędziowa
      for (let t = 1; t < E.len; t += 3) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, top + 3.2, 8), mat(0x5a4632));
        group.add(place(p, E.at(t, 0.05), (top - 3.2) / 2 + 0.05));
        group.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 8), mat(0x3e4247)), E.at(t, 0.05), top + 0.06));
        if (t + 3 < E.len) {
          const br = box(Math.hypot(3, 0.9), 0.07, 0.07, 0x4c3a28, 0, 0, 0);
          br.rotation.z = Math.atan2(0.9, 3) * (Math.floor(t / 3) % 2 ? 1 : -1);
          group.add(place(br, E.at(t + 1.5, 0.12), top - 0.85, E.rotY));
        }
      }
      group.add(place(box(E.len, 0.18, 0.12, 0x4c3a28, 0, 0, 0), E.at(E.len / 2, 0.12), top - 0.42, E.rotY)); // podłużnica
      group.add(place(box(E.len, 0.22, 0.16, 0x6e5238, 0, 0, 0), E.at(E.len / 2, 0.05), top - 0.08, E.rotY));
    } else if (s.kind === 'pontoon') {
      // gumowy profil krawędzi, ciemne pływaki pod spodem i łączenia modułów
      group.add(place(box(E.len, 0.2, 0.12, 0x3a3f45, 0, 0, 0), E.at(E.len / 2, 0.05), top - 0.07, E.rotY));
      group.add(place(box(E.len, 0.3, 0.1, 0x2b2f33, 0, 0, 0), E.at(E.len / 2, 0.02), top - 0.4, E.rotY));
      for (let t = 2.4; t < E.len - 0.5; t += 2.4) group.add(place(box(0.03, 0.01, 1.2, 0x8f8c86, 0, 0, 0), E.at(t, -0.6), top + 0.005, E.rotY));
    }
    if (!s.walk) continue;
    // słupki serwisowe i koła ratunkowe
    for (let t = 6; t < E.len - 2; t += 12) group.add(place(pedestal(0, 0, 0), E.at(t, -1.0), top, E.rotY));
    for (let t = 18; t < E.len - 2; t += 36) group.add(place(lifebuoy(0, 0, 0), E.at(t, -1.4), top, E.rotY + Math.PI));
    // kosze na śmieci i zwijacze węży (rzadko)
    for (let t = 27; t < E.len - 3; t += 40) {
      const bin = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.75, 10), mat(0x2f5d3a));
      body.position.y = 0.375; bin.add(body);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 10), mat(0x1e3d26)); lid.position.y = 0.77; bin.add(lid);
      group.add(place(bin, E.at(t, -1.6), top, E.rotY));
    }
    for (let t = 14; t < E.len - 3; t += 44) {
      const reel = new THREE.Group();
      reel.add(box(0.06, 0.6, 0.06, 0x9aa3ab, 0, 0.3, 0));
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12), mat(0x3a7d44)); drum.rotation.x = Math.PI / 2; drum.position.y = 0.45; reel.add(drum);
      group.add(place(reel, E.at(t, -1.2), top, E.rotY));
    }
    // latarnie na pomostach
    if (s.kind === 'pontoon' || s.kind === 'pier') {
      for (let t = 10; t < E.len; t += 24) {
        const p = E.at(t, -0.9);
        group.add(lamp(p.x, p.z, top));
        lamps.push({ x: p.x, y: top + 4.1, z: p.z });
      }
    }
    void mid;
  }
}

// ---------- Drobne elementy portu (low-poly) ----------
function car(r, x, z, y, rotY = 0) {
  const g = new THREE.Group();
  const col = [0xc0392b, 0x2e6fa7, 0xf2f2f2, 0x2d3436, 0x95a5a6, 0xe0a030, 0x3c8d5a][Math.floor(r() * 7)];
  g.add(box(4.0, 0.7, 1.75, col, 0, 0.55, 0));
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 2.2, 4, 1), mat(col)); cab.rotation.set(0, Math.PI / 4, 0); cab.scale.set(1.2, 0.55, 0.8); cab.position.set(-0.2, 1.15, 0); g.add(cab);
  g.add(box(2.0, 0.45, 1.6, 0x1d2a38, -0.2, 1.15, 0, { rough: 0.2, metal: 0.4 }));
  for (const [wx, wz] of [[1.3, 0.85], [-1.3, 0.85], [1.3, -0.85], [-1.3, -0.85]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 8), mat(0x1b1b1b)); wh.rotation.x = Math.PI / 2; wh.position.set(wx, 0.33, wz); g.add(wh); }
  g.position.set(x, y, z); g.rotation.y = rotY;
  return g;
}
function flagpole(x, z, y, color) {
  const g = new THREE.Group();
  g.add(box(0.08, 7, 0.08, 0xe8e8e8, 0, 3.5, 0));
  const fl = box(1.4, 0.9, 0.03, color, 0.72, 6.4, 0); g.add(fl);
  g.position.set(x, y, z);
  return g;
}
function bush(r, x, z, y, color = 0x4f7a3a) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + r() * 0.4, 0), mat(k === 2 && color === 0xc2457a ? 0x4f7a3a : color)); b.position.set((r() - 0.5) * 1.1, 0.45 + r() * 0.3, (r() - 0.5) * 0.6); g.add(b); }
  g.position.set(x, y, z);
  return g;
}
function kiosk(x, z, y, color = 0x2a6f97) {
  const g = new THREE.Group();
  g.add(box(2.6, 2.3, 2.0, 0xf5f1e8, 0, 1.15, 0));
  g.add(box(2.2, 0.9, 0.05, 0x1d2a38, 0, 1.5, 1.01, { rough: 0.2, metal: 0.4 }));
  const aw = box(3.0, 0.08, 0.9, color, 0, 2.45, 1.2); aw.rotation.x = 0.3; g.add(aw);
  g.add(box(2.9, 0.25, 2.3, color, 0, 2.45, 0));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 6), mat(0xe8c98f)); cone.rotation.x = Math.PI; cone.position.set(0, 3.2, 0); g.add(cone);
  const sc = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), mat(0xf3b6c8)); sc.position.set(0, 3.65, 0); g.add(sc);
  g.position.set(x, y, z);
  return g;
}
function bike(x, z, y, rotY, color) {
  const g = new THREE.Group();
  for (const sx of [-0.55, 0.55]) { const w2 = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 4, 10), mat(0x222222)); w2.position.set(sx, 0.35, 0); g.add(w2); }
  g.add(box(1.0, 0.05, 0.05, color, 0, 0.55, 0)); g.add(box(0.05, 0.4, 0.05, color, -0.15, 0.55, 0)); g.add(box(0.25, 0.05, 0.12, 0x222222, -0.15, 0.78, 0)); g.add(box(0.05, 0.06, 0.45, 0x222222, 0.45, 0.85, 0));
  g.position.set(x, y, z); g.rotation.y = rotY;
  return g;
}
function crates(r, x, z, y) {
  const g = new THREE.Group();
  for (let k = 0; k < 6; k++) g.add(box(0.8, 0.4, 0.55, [0x2e6fa7, 0xd35400, 0x27ae60][k % 3], (k % 3) * 0.85, 0.2 + Math.floor(k / 3) * 0.42, (r() - 0.5) * 0.1));
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat(k % 2 ? 0xe67e22 : 0xf2f2f2)); b.position.set(3.1 + (k % 2) * 0.55, 0.28 + Math.floor(k / 2) * 0.5, 0); g.add(b); }
  g.position.set(x, y, z);
  return g;
}
function kayakRack(x, z, y) {
  const g = new THREE.Group();
  for (const sx of [-1.4, 1.4]) { g.add(box(0.08, 1.6, 0.08, 0x8a6a48, sx, 0.8, -0.3)); g.add(box(0.08, 1.6, 0.08, 0x8a6a48, sx, 0.8, 0.3)); }
  for (let k = 0; k < 3; k++) {
    const kk = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 3.2, 2, 6), mat([0xe74c3c, 0xf1c40f, 0x27ae60][k])); kk.rotation.z = Math.PI / 2; kk.scale.set(1, 1, 0.55); kk.position.set(0, 0.45 + k * 0.45, 0); g.add(kk);
    g.add(box(3.0, 0.05, 0.75, 0x8a6a48, 0, 0.2 + k * 0.45, 0));
  }
  g.position.set(x, y, z);
  return g;
}

// ---------- Elementy scenografii ----------
function cypress(x, z, y, h = 9) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.9, h, 6), mat(0x2c4a2e));
  c.position.y = h / 2 + 0.5;
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1, 5), mat(0x5a4632));
  t.position.y = 0.5;
  g.add(c, t);
  g.position.set(x, y, z);
  return g;
}
function olive(r, x, z, y) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 1.8, 5), mat(0x6b5a45));
  t.position.y = 0.9;
  g.add(t);
  for (let k = 0; k < 3; k++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + r() * 0.5, 0), mat(0x7f8f5a));
    c.position.set((r() - 0.5) * 1.4, 2.3 + r() * 0.6, (r() - 0.5) * 1.4);
    g.add(c);
  }
  g.position.set(x, y, z);
  return g;
}
function pine(r, x, z, y) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 5, 5), mat(0x6b4a2f));
  t.position.y = 2.5;
  t.rotation.z = (r() - 0.5) * 0.3;
  const c = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4, 0), mat(0x355e3b));
  c.scale.y = 0.45;
  c.position.y = 5.2;
  g.add(t, c);
  g.position.set(x, y, z);
  return g;
}
function palm(r, x, z, y) {
  const g = new THREE.Group();
  const h = 5.5 + r() * 2.5, lean = (r() - 0.5) * 0.9, dir = r() * Math.PI * 2;
  const bark = mat(0x8a7456, { rough: 1 }), ring = mat(0x6f5c43, { rough: 1 });
  // wygięty pień z pierścieni (lekki łuk)
  const segs = 7;
  let px = 0, pz = 0;
  const top = new THREE.Vector3();
  for (let k = 0; k < segs; k++) {
    const t0 = k / segs, t1 = (k + 1) / segs;
    const off0 = lean * t0 * t0 * h * 0.35, off1 = lean * t1 * t1 * h * 0.35;
    const a0 = new THREE.Vector3(Math.cos(dir) * off0, t0 * h, Math.sin(dir) * off0), a1 = new THREE.Vector3(Math.cos(dir) * off1, t1 * h, Math.sin(dir) * off1);
    const len = a0.distanceTo(a1), rad = 0.26 - 0.1 * t1;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad + 0.04, len * 1.02, 7), k % 2 ? bark : ring);
    seg.position.copy(a0).add(a1).multiplyScalar(0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a1.clone().sub(a0).normalize());
    g.add(seg);
    top.copy(a1);
    px = a1.x; pz = a1.z;
  }
  void px; void pz;
  // liście: łukowato opadające, z listkami po bokach
  const leafMat = mat(0x4f8f3c, { rough: 0.9 }), leafDark = mat(0x3c7330, { rough: 0.9 });
  const nLeaves = 9;
  for (let k = 0; k < nLeaves; k++) {
    const frond = new THREE.Group();
    const L = 2.6 + r() * 0.8, parts = 5;
    for (let s = 0; s < parts; s++) {
      const t = s / parts, droop = -0.15 - t * 0.55;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(L / parts, 0.04, 0.06), leafDark);
      const cx = Math.cos(droop * 0.5) * (t + 0.5 / parts) * L, cy = Math.sin(-0.2 - t * t * 0.9) * L * 0.5 * t;
      rib.position.set(cx, cy, 0);
      rib.rotation.z = droop;
      frond.add(rib);
      const w = (0.55 - t * 0.35);
      for (const side of [-1, 1]) {
        const pin = new THREE.Mesh(new THREE.BoxGeometry(L / parts * 0.9, 0.02, w), leafMat);
        pin.position.set(cx, cy - 0.04, side * w * 0.45);
        pin.rotation.set(side * 0.5, 0, droop);
        frond.add(pin);
      }
    }
    frond.position.copy(top);
    frond.rotation.y = (k / nLeaves) * Math.PI * 2 + r() * 0.3;
    frond.rotation.z = 0.25 + r() * 0.35;
    g.add(frond);
  }
  for (let k = 0; k < 3; k++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), mat(0x6b4f2a));
    nut.position.set(top.x + Math.cos(k * 2.1) * 0.22, top.y - 0.25, top.z + Math.sin(k * 2.1) * 0.22);
    g.add(nut);
  }
  g.position.set(x, y, z);
  return g;
}
function parasol(x, z, y, color = 0xf5f1e8) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.6, 8), mat(color));
  top.position.y = 2.4;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5), mat(0x444444));
  pole.position.y = 1.2;
  g.add(top, pole);
  g.add(box(0.8, 0.05, 0.8, 0x7a5a3a, 0, 0.75, 0));
  for (const [dx, dz] of [[-0.8, 0], [0.8, 0], [0, 0.8]]) g.add(box(0.4, 0.45, 0.4, 0x3a3a3a, dx, 0.22, dz));
  g.position.set(x, y, z);
  return g;
}
function bellTower(x, z, y) {
  const g = new THREE.Group();
  const h = 20;
  g.add(box(4, h, 4, 0xd9c9a8, 0, h / 2, 0));
  for (const s of [-1, 1]) for (const [ox, oz] of [[s * 2.02, 0], [0, s * 2.02]]) g.add(box(ox ? 0.05 : 1.2, 2.2, oz ? 0.05 : 1.2, 0x2c2c2c, ox, h - 3, oz));
  g.add(box(4.4, 0.4, 4.4, 0xcdbd9a, 0, h + 0.2, 0));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.1, 4, 4), mat(0xa84a30));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h + 2.4;
  g.add(roof);
  // kościół
  g.add(box(10, 8, 16, 0xe2d3b5, 0, 4, 11));
  const rf = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 6.2, 3.2, 4, 1), mat(0xa84a30));
  rf.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  rf.scale.set(1, 2.3, 1);
  rf.position.set(0, 9.4, 11);
  g.add(rf);
  g.position.set(x, y, z);
  return g;
}
function churchSpire(x, z, y) {
  const g = new THREE.Group();
  g.add(box(22, 12, 11, 0xa6432d, 0, 6, 12));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 7.8, 22.5, 4, 1), mat(0x3d3d44));
  roof.rotation.set(0, Math.PI / 4, Math.PI / 2);
  roof.scale.set(1, 1, 0.7);
  roof.position.set(0, 14, 12);
  g.add(roof);
  g.add(box(6, 26, 6, 0x9c3f2b, 0, 13, 0));
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3.2, 16, 8), mat(0x6fa58e));
  spire.position.y = 34;
  g.add(spire);
  g.add(box(0.2, 2, 0.2, 0xd4af37, 0, 43, 0));
  g.position.set(x, y, z);
  return g;
}
function ferryNameTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.font = 'bold 44px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('YSTAD  LINE', 256, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Prom (low-poly): wyprofilowany kadłub z pochylonym dziobem i wznosem pokładu, schodkowa nadbudówka
// z zaokrąglonym przodem i pasami okien, pochylony komin, mostek ze skrzydłami, szalupy na żurawikach.
function ferryHullBand(L, B, H, y0, y1, color, deck = false) {
  // s: 0 = rufa, 1 = dziób; na dole dziób cofnięty (pochylona dziobnica), u góry wznos pokładu
  const N = 40;
  // rzut z góry: równoległy śródokręć, potem ostrołukowy dziób zbiegający się w ostrą dziobnicę
  const f = (s) => (s < 0.6 ? 1 : Math.max(0, 1 - Math.pow((s - 0.6) / 0.4, 1.9)));
  const sheer = (s) => H + 2.2 * Math.pow(Math.max(0, (s - 0.6) / 0.4), 2);
  const pt = (s, yy, side) => {
    const top = sheer(s), k = Math.min(1, Math.max(0, yy === 'top' ? 1 : yy / top));
    const y = yy === 'top' ? top : yy;
    const xb = -L / 2 + 1.5 + s * (L - 10), xt = -L / 2 + s * L; // rufa lekko podcięta, dziób pochylony
    const x = xb + (xt - xb) * k;
    const hw = (B / 2) * (0.9 + 0.1 * k) * f(s);
    return new THREE.Vector3(x, y, side * hw);
  };
  const pos = [];
  const tri = (a, b, c, hint) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.dot(hint) < 0) [b, c] = [c, b];
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const lv = (s) => (y1 === 'top' ? 'top' : Math.min(y1, sheer(s)));
  for (let i = 0; i < N; i++) {
    const s0 = i / N, s1 = (i + 1) / N;
    for (const side of [-1, 1]) {
      const h = new THREE.Vector3(0, 0, side);
      const a = pt(s0, y0, side), b = pt(s1, y0, side), c = pt(s1, lv(s1), side), e = pt(s0, lv(s0), side);
      tri(a, b, c, h); tri(a, c, e, h);
    }
    if (deck) {
      const up = new THREE.Vector3(0, 1, 0);
      const a = pt(s0, 'top', -1), b = pt(s1, 'top', -1), c = pt(s1, 'top', 1), e = pt(s0, 'top', 1);
      tri(a, b, c, up); tri(a, c, e, up);
    }
  }
  // pawęż
  const back = new THREE.Vector3(-1, 0, 0);
  const a = pt(0, y0, -1), b = pt(0, y0, 1), c = pt(0, lv(0), 1), e = pt(0, lv(0), -1);
  tri(a, b, c, back); tri(a, c, e, back);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat(color));
  m.castShadow = true; m.receiveShadow = true;
  return { mesh: m, halfAt: (x, y) => { const s = Math.min(1, Math.max(0, (x + L / 2) / L)); return (B / 2) * f(s); }, sheer };
}

// płyta nadbudówki: prostokąt z eliptycznie zaokrąglonym przodem (i lekko przyciętą rufą), wyciągnięty w górę
function ferrySlab(len, w, h, r, color, x, y, opts) {
  const sh = new THREE.Shape();
  const x0 = -len / 2, x1 = len / 2 - r, hw = w / 2;
  sh.moveTo(x0, -hw + 0.6);
  sh.lineTo(x0 + 0.6, -hw);
  sh.lineTo(x1, -hw);
  for (let k = 1; k <= 8; k++) { const a = -Math.PI / 2 + (k / 8) * Math.PI; sh.lineTo(x1 + Math.cos(a) * r, Math.sin(a) * hw); }
  sh.lineTo(x0 + 0.6, hw);
  sh.lineTo(x0, hw - 0.6);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(color, opts));
  m.position.set(x, y, 0);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function ferry(d) {
  const g = new THREE.Group();
  const L = 150, B = 26, H = 10;
  const white = 0xf4f4f2, navy = 0x1d4e89, red = 0x7a1f1f, dark = 0x252b31;
  const glass = 0x243447, gl = { rough: 0.2, metal: 0.4 }; // te same szyby co w domach – nocą się świecą
  // kadłub w pasach: antifouling, granatowy pas, biała burta z pokładem
  const hull = ferryHullBand(L, B, H, -0.5, 1.4, red);
  g.add(hull.mesh);
  g.add(ferryHullBand(L, B, H, 1.4, 2.6, navy).mesh);
  g.add(ferryHullBand(L, B, H, 2.6, 'top', white, true).mesh);
  const half = hull.halfAt;
  const sideZ = (y) => (B / 2) * (0.9 + 0.1 * Math.min(1, y / H)); // burty lekko rozchylone ku górze
  // pokład samochodowy: otwory wentylacyjne i rząd iluminatorów (w części o stałej szerokości)
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) g.add(box(5.2, 1.6, 0.2, dark, -60 + k * 9.5, 5.4, s * (sideZ(5.4) + 0.02)));
    for (let k = 0; k < 26; k++) g.add(box(0.9, 0.9, 0.16, glass, -60 + k * 3.6, 8.3, s * (sideZ(8.3) + 0.03), gl));
    // kotwica w kluzie przy dziobie
    const ax = L / 2 - 12;
    g.add(box(1.8, 1.4, 0.5, dark, ax, 8.2, s * (half(ax) * 0.97)));
  }
  // rufowa furta samochodowa i zarys wizjera dziobowego
  g.add(box(0.25, 6.2, 12, dark, -L / 2 + 1.5 * (1 - 6.4 / H) - 0.1, 6.4, 0));
  g.add(box(0.3, 0.3, 13, 0xc9ccd0, -L / 2 + 0.1, 9.7, 0));
  // nadbudówka: cztery schodkowe pokłady z zaokrąglonymi przodami i pasami okien
  const decks = [
    // [długość, szerokość, wysokość, promień przodu, środek x, poziom y]
    [112, B - 1.0, 4.4, 13, -6, H],
    [98, B - 2.4, 4.0, 12, -10, H + 4.4],
    [64, B - 8, 3.6, 9, -22, H + 8.4]
  ];
  for (const [len, w, h, r, x, y] of decks) {
    g.add(ferrySlab(len, w, h, r, white, x, y));
    g.add(ferrySlab(len + 0.3, w + 0.3, 1.5, r + 0.15, glass, x, y + h * 0.42, gl)); // pas okien
    g.add(ferrySlab(len + 1.6, w + 1.6, 0.35, r + 0.8, 0xe6e8ea, x, y + h, {})); // okap / pokład spacerowy
  }
  // granatowy pas wzdłuż górnego pokładu
  g.add(ferrySlab(98.4, B - 2.0, 0.5, 12.2, navy, -10, H + 4.4 + 3.3));
  // mostek ze skrzydłami i pochyłymi oknami
  const by = H + 8.4;
  g.add(ferrySlab(12, B * 0.82, 3.8, 3.5, white, 20, by));
  g.add(ferrySlab(12.3, B * 0.82 + 0.3, 1.4, 3.65, glass, 20, by + 1.9, gl));
  g.add(box(4.5, 3.0, B + 2.6, white, 22.5, by + 2.1, 0));
  for (const s of [-1, 1]) g.add(box(4.6, 1.2, 0.2, glass, 22.5, by + 2.6, s * (B / 2 + 1.32), gl));
  g.add(box(4.7, 0.3, B + 2.8, 0xe6e8ea, 22.5, by + 3.75, 0));
  g.add(ferrySlab(12.8, B * 0.82 + 0.8, 0.3, 3.9, 0xe6e8ea, 20, by + 3.8, {}));
  // maszt nad mostkiem z radarami i światłami
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 9, 6), mat(0xdedede));
  mast.position.set(20, by + 8.5, 0); g.add(mast);
  g.add(box(1.0, 0.25, 7, 0xdedede, 20, by + 9.4, 0));
  g.add(box(5.0, 0.3, 0.8, 0x333333, 20, by + 11.4, 0)); // antena radaru
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 5), mat(0xffffff));
  dome.position.set(20, by + 13.3, 0); g.add(dome);
  for (const s of [-1, 1]) g.add(box(0.3, 0.3, 0.3, s < 0 ? 0xd62828 : 0x2a9d4a, 22.5, by + 3.9, s * (B / 2 + 1.1)));
  // komin pochylony ku rufie: biały z granatowym pasem i czarną koroną
  const fx = -38, fy = H + 12;
  const stack = (y0, y1, wz, color) => {
    const sh = new THREE.Shape(), k = 0.32;
    const back = (y) => -5 - y * k + y * 0.11, front = (y) => 5 - y * k - y * 0.08; // zwęża się ku górze
    sh.moveTo(back(y0), y0); sh.lineTo(front(y0), y0); sh.lineTo(front(y1), y1); sh.lineTo(back(y1), y1); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: wz, bevelEnabled: false });
    geo.translate(0, 0, -wz / 2);
    const m = new THREE.Mesh(geo, mat(color)); m.position.set(fx, fy, 0); m.castShadow = true;
    return m;
  };
  g.add(stack(0, 10.5, 6.6, white));
  g.add(stack(6.0, 8.6, 6.75, navy));
  g.add(stack(10.5, 11.3, 6.9, 0x222222));
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 6), mat(0x333333)); r.position.set(fx - 3.6, fy + 11.8, s * 1.4); g.add(r); }
  // szalupy zamknięte (pomarańczowe) na żurawikach przy burtach pokładu łodziowego
  const boatGeo = new THREE.CapsuleGeometry(1.25, 5.2, 3, 8);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const x = -48 + k * 9.5, z = s * (B / 2 - 2.6), y = H + 8.4 + 1.6;
    const lb = new THREE.Mesh(boatGeo, mat(0xff6a13)); lb.rotation.z = Math.PI / 2; lb.scale.set(1, 1, 1.05); lb.position.set(x, y, z); lb.castShadow = true; g.add(lb);
    g.add(box(7.2, 0.5, 2.7, 0xf2f2f2, x, y - 0.9, z)); // biały kadłub szalupy
    for (const dx of [-3, 3]) g.add(box(0.3, 3.4, 0.3, 0xb9bec4, x + dx, y + 0.3, z - s * 1.2)); // żurawiki
  }
  // tratwy ratunkowe w pojemnikach na skraju pokładu
  const raft = new THREE.CylinderGeometry(0.55, 0.55, 1.5, 8);
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) { const r = new THREE.Mesh(raft, mat(0xf2f2f2)); r.rotation.x = Math.PI / 2; r.position.set(2 + k * 2, H + 8.4 + 0.7, s * (B / 2 - 2.0)); g.add(r); }
  // relingi na pokładach
  for (const [len, w, x, y] of [[96, B - 1.8, -10, H + 8.4 + 1.05], [62, B - 7.4, -22, H + 12 + 1.05]]) {
    for (const s of [-1, 1]) g.add(box(len, 0.12, 0.12, 0xdddddd, x, y, s * w / 2));
  }
  // dziób: kabestany i wznos pokładu dziobowego z falochronem
  const sh = hull.sheer(0.93);
  g.add(box(2.4, 1.0, 2.4, 0x9aa1a7, L / 2 - 14, sh - 0.5, -3)); g.add(box(2.4, 1.0, 2.4, 0x9aa1a7, L / 2 - 14, sh - 0.5, 3));
  g.add(box(1.0, 1.6, B * 0.55, white, L / 2 - 20, H + 1.4, 0)); // falochron na dziobie
  // flaga na rufie
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 5), mat(0xdedede));
  pole.position.set(-L / 2 + 3, H + 2.5, 0); g.add(pole);
  g.add(box(0.05, 1.6, 2.6, 0x006aa7, -L / 2 + 3, H + 4.2, 1.3));
  g.add(box(0.06, 0.32, 2.6, 0xfecc00, -L / 2 + 3, H + 4.2, 1.3));
  g.add(box(0.06, 1.6, 0.32, 0xfecc00, -L / 2 + 3, H + 4.2, 0.95));
  // napis na burtach
  const nameMat = new THREE.MeshBasicMaterial({ map: ferryNameTexture(), transparent: true, depthWrite: false });
  for (const s of [-1, 1]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(24, 3), nameMat);
    pl.position.set(6, 6.0, s * (sideZ(6) + 0.25));
    if (s < 0) pl.rotation.y = Math.PI;
    pl.userData.keep = true;
    g.add(pl);
  }
  g.position.set(d.x, 0, d.z);
  g.rotation.y = -d.th;
  return g;
}
function windTurbine(x, z) {
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 70, 8), mat(0xf2f4f5));
  tower.position.y = 35;
  g.add(tower);
  for (let k = 0; k < 3; k++) {
    const bl = box(1.2, 32, 0.4, 0xf2f4f5, 0, 16, 0);
    const pv = new THREE.Group();
    pv.add(bl);
    pv.rotation.z = (k * 2 * Math.PI) / 3 + 0.3;
    pv.position.set(0, 70, 2);
    g.add(pv);
  }
  g.position.set(x, 0, z);
  return g;
}
function beachHut(x, z, y, color) {
  const g = new THREE.Group();
  g.add(box(2.4, 2.4, 2.2, color, 0, 1.2, 0));
  const rf = box(2.8, 0.2, 2.6, 0xf5f5f5, 0, 2.6, 0);
  g.add(rf);
  g.add(box(0.9, 1.7, 0.05, 0xffffff, 0, 0.9, 1.12));
  g.position.set(x, y, z);
  return g;
}

const ropeMats = new Map();
function ropeMat(color) {
  if (!ropeMats.has(color)) ropeMats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  return ropeMats.get(color);
}

// Proste liny sąsiadów (statyczne, z ugięciem)
function sagLine(a, b, sag, color = 0xf0ede4) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * sag, a.z + (b.z - a.z) * t));
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.03, 8, false);
  const m = new THREE.Mesh(geo, ropeMat(color));
  m.userData.keep = true; // bez scalania – zachowuje gładkie normalne
  return m;
}

const NAME_ADJ = ['Blue', 'Silver', 'Happy', 'Salty', 'Northern', 'Lucky', 'Wild', 'Golden', 'Swift', 'Quiet', 'Brave', 'Bright', 'Lazy', 'Proud', 'Morning', 'Evening', 'Red', 'White', 'Fair', 'Merry'];
const NAME_NOUN = ['Breeze', 'Horizon', 'Dancer', 'Dog', 'Star', 'Lady', 'Spirit', 'Song', 'Hawk', 'Wake', 'Pearl', 'Wanderer', 'Moon', 'Rider', 'Gull', 'Wave', 'Dolphin', 'Anchor', 'Compass', 'Voyager', 'Tern', 'Harbour', 'Tide', 'Sail', 'Sparrow'];
const NEIGHBOR_CANVAS = [0x24374f, 0x1f5f8b, 0x2d6a4f, 0x7a1f1f, 0x3d3d3d, 0x1f4e79];

// ---------- Scenografia: Adriatyk ----------
function sceneryMed(group, r, lamps) {
  const pal = PALETTES.med;
  // promenada na rivie: palmy, parasole kawiarni, ławki, latarnie
  for (let x = -140; x < 180; x += 13) {
    group.add(palm(r, x + 3, -7.5, 1.0));
    group.add(lamp(x + 9, -3.2, 1.0));
    lamps.push({ x: x + 9, y: 5.1, z: -3.2 });
  }
  for (let x = -130; x < 30; x += 26) {
    for (let k = 0; k < 3; k++) group.add(parasol(x + k * 3.4, -11.5, 1.0, k % 2 ? 0xf5f1e8 : 0xe9dcc3));
  }
  for (let x = -120; x < 170; x += 29) group.add(bench(x, -9.5, 1.0));
  // miasteczko na tarasach wzgórza
  for (let row = 0; row < 5; row++) {
    const y = 1.6 + row * 3.4; // pierwszy taras wyżej niż nabrzeże (1,0 m) – bez współpłaszczyznowych powierzchni (migotania)
    const z0 = -16 - row * 11;
    // mur oporowy tarasu
    group.add(box(330, y + 3, 11, 0xcbbd9e, 15, (y - 3) / 2, z0 - 5.5));
    for (let x = -148 + (row % 2) * 7; x < 180; x += 13 + r() * 6) {
      if (row >= 3 && Math.abs(x + 55) < 14) continue; // miejsce na kościół
      if (r() < 0.12) { group.add(cypress(x, z0 - 4, y, 8 + r() * 4)); continue; }
      group.add(house(r, x, z0 - 4 - r() * 2, y, 0, pal));
    }
  }
  group.add(bellTower(-55, -66, 1.6 + 4 * 3.4));
  // żywopłoty i kwitnące krzewy na tyłach promenady, kiosk z lodami, rowery, parking i maszty z flagami przy marinie
  for (let x = -140; x < 75; x += 6) group.add(bush(r, x + r() * 2, -13.6, 1.0, r() < 0.3 ? 0xc2457a : 0x4f7a3a));
  group.add(kiosk(42, -11.2, 1.0, 0xc0392b));
  for (let k = 0; k < 4; k++) group.add(bike(52 + k * 0.8, -11.5, 1.0, Math.PI / 2, [0x2e6fa7, 0xc0392b, 0x2d3436, 0x27ae60][k]));
  for (let k = 0; k < 9; k++) group.add(car(r, 102 + k * 3.1, -14.2, 1.0, Math.PI / 2));
  [0x1d4e89, 0xe8e8e8, 0xc0392b].forEach((c, k) => group.add(flagpole(91.5 + k * 2, -5.2, 1.0, c)));
  for (let x = -140; x < 170; x += 9 + r() * 8) group.add(r() < 0.5 ? cypress(x, -69 - r() * 2, 1.6 + 4 * 3.4, 6 + r() * 3) : olive(r, x, -69 - r() * 2, 1.6 + 4 * 3.4));
  // budynek mariny z tablicą
  group.add(box(14, 4, 8, 0xf5f5f0, 88, 3, -12));
  group.add(box(15, 0.4, 9, 0xd0d0d0, 88, 5.2, -12));
  group.add(signBoard('MARINA', 88, -7.2, 1.0));
  // skaliste brzegi: kamienie, sosny, oliwki, cyprysy
  for (let z = -40; z < 250; z += 7) {
    for (const [x0, dir] of [[-150, -1], [185, 1]]) {
      const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 + r(), 0), mat(0xa9a293));
      rk.position.set(x0 + dir * r() * 2, 0.4 + r(), z + r() * 4);
      rk.rotation.set(r() * 3, r() * 3, r() * 3);
      group.add(rk);
      const tx = x0 + dir * (6 + r() * 60);
      const k = r();
      group.add(k < 0.45 ? pine(r, tx, z, 3.5) : k < 0.75 ? olive(r, tx, z, 3.5) : cypress(tx, z, 3.5, 7 + r() * 4));
    }
  }
  // falochron: kamienie od strony morza
  for (let x = 20; x < 185; x += 2.4) {
    const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3 + r() * 0.8, 0), mat(0x9d998f));
    rk.position.set(x, 0.3 + r() * 0.6, 169 + r() * 1.5);
    rk.rotation.set(r() * 3, r() * 3, r() * 3);
    group.add(rk);
  }
  for (let x = 30; x < 185; x += 24) { group.add(lamp(x, 164, 1.4)); lamps.push({ x, y: 5.5, z: 164 }); }
  // góry krasowe w tle
  for (let i = 0; i < 16; i++) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(55 + r() * 45, 60 + r() * 60, 6), mat(i % 3 ? 0x8a9178 : 0x9a9a8a));
    h.position.set(-330 + i * 45 + r() * 20, 0, -150 - r() * 90);
    group.add(h);
  }
}

// ---------- Scenografia: Ystad (Bałtyk) ----------
function sceneryBaltic(group, r, lamps) {
  const pal = PALETTES.baltic;
  // drewniana promenada: ławki, latarnie, restauracja z tarasem
  for (let x = -140; x < 58; x += 12) { group.add(lamp(x + 4, -3.5, 1.0)); lamps.push({ x: x + 4, y: 5.1, z: -3.5 }); }
  for (let x = -130; x < 50; x += 22) group.add(bench(x, -6.5, 1.0));
  group.add(box(24, 5, 10, 0x8f8f86, -5, 3.5, -16));
  const rr = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 7.5, 3, 4, 1), mat(0x3d3d44));
  rr.rotation.set(0, Math.PI / 4, Math.PI / 2); rr.scale.set(1, 17, 1); rr.position.set(-5, 7.2, -16);
  group.add(box(24.5, 0.3, 10.5, 0x3d3d44, -5, 6.1, -16));
  group.add(signBoard('RESTAURANG · HAMNEN', -5, -10.5, 1.0));
  for (let k = 0; k < 5; k++) group.add(parasol(-15 + k * 5, -9.5, 1.0, k % 2 ? 0xffffff : 0x1d4e89));
  // trawnik i miasto: cegła, szachulec, ciemne dachy
  group.add(box(210, 0.1, 14, 0x6f9a4c, -45, 1.05, -30));
  for (let row = 0; row < 3; row++) {
    for (let x = -145 + row * 5; x < 58; x += 13 + r() * 5) group.add(house(r, x, -44 - row * 13, 1.0, 0, pal));
  }
  for (let x = -145; x < 58; x += 11) group.add(tree(r, x + r() * 4, -24 - r() * 6, 1.0));
  group.add(churchSpire(-55, -95, 1.0));
  // żywopłot przed trawnikiem, parking, skrzynki rybackie i boje, stojak z kajakami, rowery
  for (let x = -145; x < 58; x += 5) group.add(bush(r, x + r() * 2, -22.6, 1.0));
  for (let k = 0; k < 8; k++) group.add(car(r, 16 + k * 3.1, -14.5, 1.0, Math.PI / 2));
  group.add(crates(r, -40, -9, 1.0));
  group.add(kayakRack(-75, -9.5, 1.0));
  for (let k = 0; k < 5; k++) group.add(bike(-95 + k * 0.8, -8.8, 1.0, Math.PI / 2, [0x2e6fa7, 0xc0392b, 0x2d3436, 0x27ae60, 0xf2f2f2][k]));
  [0x006aa7, 0xfecc00, 0xc8102e].forEach((c, k) => group.add(flagpole(-20 + k * 2, -8.5, 1.0, c)));
  // plaża na zachód od falochronu: wydmy, domki plażowe
  for (let z = -30; z < 250; z += 9) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(4 + r() * 3, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8fa45f));
    d.scale.y = 0.35;
    d.position.set(-190 - r() * 40, 1.2, z);
    group.add(d);
  }
  const hutColors = [0xe63946, 0x457b9d, 0xf4a261, 0x2a9d8f, 0xffffff, 0xe9c46a];
  for (let k = 0; k < 10; k++) group.add(beachHut(-170, 80 + k * 5, 1.2, hutColors[k % hutColors.length]));
  // port promowy: terminal, kontenery
  group.add(box(40, 9, 18, 0xdadde0, 120, 6.5, -20));
  group.add(signBoard('FÄRJETERMINAL', 120, -10.5, 2.0));
  const cont = [0xb03a2e, 0x2e6fa7, 0xe0a030, 0x3c8d5a];
  for (let k = 0; k < 24; k++) group.add(box(12, 2.6, 2.5, cont[k % 4], 170 + (k % 6) * 13, 3.3 + Math.floor(k / 12) * 2.6, 40 + (Math.floor(k / 6) % 2) * 3));
  // falochrony: kamienie od strony morza
  for (let z = 0; z < 200; z += 2.4) {
    const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 + r() * 0.7, 0), mat(0x8a8780));
    rk.position.set(-151.5 - r() * 1.5, 0.3 + r() * 0.5, z);
    rk.rotation.set(r() * 3, r() * 3, r() * 3);
    group.add(rk);
  }
  for (let x = -150; x < -42; x += 2.4) {
    const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 + r() * 0.7, 0), mat(0x8a8780));
    rk.position.set(x, 0.3 + r() * 0.5, 205.5 + r() * 1.5);
    rk.rotation.set(r() * 3, r() * 3, r() * 3);
    group.add(rk);
  }
  // wiatraki na horyzoncie
  for (let k = 0; k < 6; k++) group.add(windTurbine(-420 + k * 140, -420 - (k % 2) * 60));
}

export function buildHarbor(H, scene) {
  const group = new THREE.Group();
  const dyn = new THREE.Group();
  const r = rng(99);
  const concreteMat = new THREE.MeshStandardMaterial({ map: concreteTexture(), flatShading: true, roughness: 0.9 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: concreteTexture(), color: 0xf0e6d0, flatShading: true, roughness: 0.95 });
  const woodMat = new THREE.MeshStandardMaterial({ map: plankTexture(), flatShading: true, roughness: 0.85 });
  const pontMat = new THREE.MeshStandardMaterial({ map: concreteTexture(), color: 0xe4e2dc, flatShading: true, roughness: 0.9 });
  const lamps = [];
  const booms = [];
  const surf = (s) => {
    const st = s.style || s.kind;
    if (st === 'wood' || s.kind === 'pier') return woodMat;
    if (st === 'stone') return stoneMat;
    if (s.kind === 'pontoon') return pontMat;
    if (st === 'rock') return mat(0xa9a293);
    if (st === 'sand') return mat(0xd9c99a, { rough: 1 });
    if (st === 'port') return mat(0x9a9a94);
    if (s.kind === 'land') return mat(0x6f9a4c, { rough: 1 });
    return concreteMat;
  };

  for (const s of H.structures) {
    if (s.kind === 'boom') {
      // Y-bom: osobna grupa z punktem obrotu w mocowaniu przy kei – końcówka unosi się na fali
      const bm = mat(0xb9c0c8, { metal: 0.5, rough: 0.4 });
      const f = s.fork;
      const fv = 3.2; // od tego miejsca bom rozwidla się w „Y” ku pomostowi
      const root = new THREE.Group(); root.position.set(f.bx, 0, f.bz); root.rotation.y = -Math.atan2(f.nz, f.nx);
      const tilt = new THREE.Group(); tilt.position.y = s.h; root.add(tilt);
      // lokalnie: x wzdłuż bomu (od kei), z w poprzek; y względem pokładu bomu
      const sgn = Math.sign(f.nx * f.tz - f.nz * f.tx) || 1; // orientacja osi poprzecznej
      const L2 = (a2, b2) => [a2, sgn * b2];
      tilt.add(extrudePoly([L2(fv, -0.18), L2(f.len, -0.18), L2(f.len, 0.18), L2(fv, 0.18)], 0, -0.25, bm));
      for (const sd of [-1, 1]) {
        const a0 = L2(fv, 0), a1 = L2(0.15, sd * 0.6);
        const dx = a1[0] - a0[0], dz = a1[1] - a0[1], len = Math.hypot(dx, dz);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(len + 0.1, 0.25, 0.3), bm);
        arm.position.set((a0[0] + a1[0]) / 2, -0.125, (a0[1] + a1[1]) / 2);
        arm.rotation.y = -Math.atan2(dz, dx);
        arm.castShadow = true;
        tilt.add(arm);
      }
      for (let t2 = fv + 1.2; t2 < f.len; t2 += 3) tilt.add(box(0.9, 0.45, 0.5, 0x1d2126, t2, 0.02 - s.h, 0)); // czarne pływaki (polietylen)
      dyn.add(root);
      booms.push({ root, tilt, f, len: f.len, h: s.h });
      continue;
    }
    if (s.kind === 'pile') {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r * 1.1, s.h + 3, 7), mat(0x6b5236));
      p.position.set(s.cx, (s.h - 3) / 2, s.cz);
      p.castShadow = true;
      group.add(p);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(s.r * 1.05, s.r * 1.05, 0.25, 7), mat(0xe9e9e9));
      top.position.set(s.cx, s.h - 0.1, s.cz);
      group.add(top);
      continue;
    }
    const bottom = s.kind === 'pontoon' ? -0.5 : s.kind === 'pier' ? s.h - 0.35 : -4;
    const m = extrudePoly(s.poly, s.h, bottom, surf(s));
    if (m.material.map) setUVWorld(m.geometry, (s.style === 'wood' || s.kind === 'pier') ? 0.35 : 0.12);
    group.add(m);
    if (s.kind === 'pontoon') group.add(extrudePoly(s.poly, -0.1, -0.6, mat(0x44484d)));
    addEdgeDetails(group, s, r, lamps);
  }

  // polery
  const bollardMeshes = [];
  for (const b of H.bollards) {
    const m = buildBollard(b.kind);
    m.position.set(b.x, b.h, b.z);
    if (b.onBoom && booms.length) {
      // przypięty do najbliższego Y-bomu (porusza się razem z nim)
      let best = null, bd = 1e9;
      for (const bo of booms) { const d = Math.hypot(b.x - (bo.f.bx + bo.f.nx * bo.len * 0.6), b.z - (bo.f.bz + bo.f.nz * bo.len * 0.6)); if (d < bd) { bd = d; best = bo; } }
      if (best) { best.root.updateMatrixWorld(true); best.tilt.updateMatrixWorld(true); const lp = best.tilt.worldToLocal(new THREE.Vector3(b.x, b.h, b.z)); m.position.copy(lp); best.tilt.add(m); b._boomMesh = m; }
    }
    // knaga ustawiona wzdłuż krawędzi pomostu (prostopadle do kierunku na wodę)
    if (b.kind === 'cleat' && b.approach) m.rotation.y = -Math.atan2(b.approach.z - b.z, b.approach.x - b.x) + Math.PI / 2;
    m.userData.bollard = b;
    if (!b._boomMesh) group.add(m);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(b.x, b.h + 0.3, b.z);
    hit.userData.bollard = b;
    dyn.add(hit);
    bollardMeshes.push(hit);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 4, 16), new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.9 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(b.x, b.h + 0.08, b.z);
    ring.visible = false;
    dyn.add(ring);
    b._ring = ring;
  }

  // muringi: bloczki na dnie
  for (const m of H.murings) group.add(box(1.2, 0.8, 1.2, 0x6d6d6d, m.anchor.x, -m.anchor.depth + 0.3, m.anchor.z));

  // dekoracje stałe
  for (const d of H.deco) {
    if (d.type === 'lighthouse') {
      const l = lighthouse(d.color);
      l.position.set(d.x, 2.2, d.z);
      group.add(l);
    } else if (d.type === 'ferry') group.add(ferry(d));
  }
  if (H.style === 'med') sceneryMed(group, r, lamps);
  else sceneryBaltic(group, r, lamps);

  // sąsiednie jachty i ich cumy (kadłub wspólny dla typu i koloru; nazwa, port i bandera – osobno dla każdego, bez powtórzeń nazw)
  const boatCache = new Map();
  const rn = rng((H.seed || 7) * 31 + 5);
  const names = [];
  for (const a of NAME_ADJ) for (const n of NAME_NOUN) if (a !== n) names.push(`${a} ${n}`);
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rn() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  const neighborFlags = [];
  H.neighbors.forEach((n, i) => {
    const key = n.spec.id + '_' + n.color;
    let proto = boatCache.get(key);
    if (!proto) {
      const built = buildBoat(n.spec, { color: n.color, stripe: n.color === 0xffffff ? 0x2b3a4a : 0xffffff, canvas: NEIGHBOR_CANVAS[i % NEIGHBOR_CANVAS.length], noPlate: true, noFlag: true });
      proto = mergeByMaterial(built);
      proto.userData.perches = built.userData.perches;
      boatCache.set(key, proto);
    }
    const b = proto.clone();
    const code = FLAG_CODES[Math.floor(rn() * FLAG_CODES.length)];
    const ports = FLAGS[code].ports;
    b.add(createNamePlate(n.spec, names[i % names.length], ports[Math.floor(rn() * ports.length)], false));
    const flag = createFlag(n.spec, code);
    b.add(flag);
    n._flag = flag;
    n._flagPhase = rn() * 6;
    b.position.set(n.x, 0, n.z);
    b.rotation.y = -n.th;
    b.userData.bobPhase = r() * 6;
    b.userData.neighbor = n;
    dyn.add(b);
    n._mesh = b;
    const c = Math.cos(n.th), s = Math.sin(n.th);
    for (const rp of n.ropes || []) {
      const a = new THREE.Vector3(n.x + rp.lx * c - rp.ly * s, n.spec.freeboard + 0.15, n.z + rp.lx * s + rp.ly * c);
      group.add(sagLine(a, rp.to, rp.sag, rp.grey ? 0x9aa19f : 0xf0ede4));
    }
  });

  // dno
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200, 1, 1), mat(0x6f6a52, { rough: 1 }));
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = -6;
  group.add(bed);

  const merged = mergeByMaterial(group);
  scene.add(merged);
  scene.add(dyn);
  const lighthouses = H.deco.filter((d) => d.type === 'lighthouse').map((d) => ({ x: d.x, y: 2.2 + 8.6, z: d.z, color: d.color }));
  return { group: merged, dyn, bollardMeshes, lamps, lighthouses, booms };
}

// Stonowana tekstura wody: plamy głębi + delikatne jaśniejsze zmarszczki (kafelkowalna)
function waterTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#3b90ac';
  g.fillRect(0, 0, S, S);
  const r = rng(21);
  // rysowanie z zawinięciem krawędzi (kafelkowanie bez szwów)
  const wrap = (fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
  for (let i = 0; i < 18; i++) {
    const x = r() * S, y = r() * S, rad = 80 + r() * 120, dark = r() < 0.5;
    wrap(() => {
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, dark ? 'rgba(30,85,110,0.10)' : 'rgba(110,175,195,0.08)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    });
  }
  g.lineCap = 'round';
  for (let i = 0; i < 110; i++) {
    const x = r() * S, y = r() * S, len = 14 + r() * 30, a = (r() - 0.5) * 0.4;
    const light = r() < 0.8;
    wrap(() => {
      g.strokeStyle = light ? `rgba(200,232,240,${0.06 + r() * 0.07})` : `rgba(25,70,90,${0.05 + r() * 0.05})`;
      g.lineWidth = 1 + r() * 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + len / 2, y + Math.sin(a) * len * 0.4 - 3, x + len, y + Math.sin(a) * len);
      g.stroke();
    });
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Półprzezroczysta warstwa drobnych zmarszczek (przesuwana osobno – daje efekt przeplatających się fal)
function rippleTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const r = rng(5);
  const wrap = (fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
  g.lineCap = 'round';
  for (let i = 0; i < 160; i++) {
    const x = r() * S, y = r() * S, len = 8 + r() * 22, light = r() < 0.7;
    wrap(() => {
      g.strokeStyle = light ? `rgba(225,245,250,${0.10 + r() * 0.14})` : `rgba(15,55,75,${0.08 + r() * 0.1})`;
      g.lineWidth = 0.8 + r() * 1.4;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + len / 2, y - 2.5 - r() * 2, x + len, y);
      g.stroke();
    });
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Woda – animowana siatka z sumą kilku fal (gładkie normalne, delikatny połysk)
const WAVES = [
  // (siatka ma ~3,2 m oczka – fale krótsze niż ~9 m dawałyby aliasing, więc drobne zmarszczki zostają w teksturze)
  { d: 0, k: 0.42, w: 1.3, a: 1.0 },
  { d: 0.5, k: 0.55, w: 1.5, a: 0.5 },
  { d: -0.7, k: 0.3, w: 1.05, a: 0.6 },
  { d: 1.4, k: 0.22, w: 0.85, a: 0.6 },
  { d: -0.25, k: 0.62, w: 1.6, a: 0.3 },
  { d: 0.9, k: 0.7, w: 1.75, a: 0.14 } // krótsza fala (dopasowana do oczka siatki)
];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export class Water {
  // follow: siatka wody podąża za jachtem (rejs po otwartym akwenie), przesuwana co oczko siatki; tekstury zakotwiczone w świecie
  constructor(scene, opts = {}) {
    this.follow = !!opts.follow;
    const size = 520, seg = Math.round((this.follow ? 117 : 161) * (opts.detail || 1)); // oczko ok. 3,2 m // na otwartym morzu większe trójkąty (styl low-poly)
    this.waveGain = this.follow ? 1.8 : 1.9;
    this.size = size; this.seg = seg;
    this.ox = 0; this.oz = 0;
    this.drift = { x: 0, y: 0 };
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    if (!this.follow) geo.translate(0, 0, 100);
    this.geo = geo;
    this.base = geo.attributes.position.array.slice();
    // stonowana tekstura zmarszczek + łagodny połysk (Phong z ciemnym odblaskiem)
    this.tex = waterTexture();
    this.tex.repeat.set(size / 22, size / 22);
    // styl low-poly: płaskie cieniowanie trójkątów, bez tekstur – fasety fal widać dzięki oświetleniu
    const matW = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true, specular: 0x415566, shininess: 95, transparent: true, opacity: 0.97, vertexColors: true });
    // odbicie nieba (Fresnel): przy płaskim kącie patrzenia woda przejmuje barwę horyzontu
    this.skyU = { value: new THREE.Color(0x9fd0e6) };
    const fadeEdge = this.follow;
    const patch = (fade) => (sh) => {
      sh.uniforms.uSky = this.skyU;
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', 'varying vec2 vLocal;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vLocal = position.xz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'uniform vec3 uSky;\nvarying vec2 vLocal;\nvoid main() {')
        .replace('#include <dithering_fragment>', `
          // Fresnel: z góry woda ciemna (mało odbija), przy płaskim kącie coraz bardziej odbija niebo
          float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 5.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uSky, clamp(0.03 + fr * 0.75, 0.0, 0.55));
          ${fade ? 'gl_FragColor.a *= 1.0 - smoothstep(150.0, 252.0, max(abs(vLocal.x), abs(vLocal.y)));' : ''}
          #include <dithering_fragment>`);
    };
    matW.onBeforeCompile = patch(fadeEdge);
    this.patchWater = patch;
    this.sceneRef = scene;
    // kolor wierzchołków: ciemniejsza głęboka woda, jaśniejsza przy brzegu (uzupełniane w setHarbor)
    const vc = new Float32Array(geo.attributes.position.count * 3).fill(1);
    if (this.follow) for (let i = 0; i < vc.length; i += 3) { vc[i] = 0.035; vc[i + 1] = 0.14; vc[i + 2] = 0.30; }
    geo.setAttribute('color', new THREE.BufferAttribute(vc, 3));
    if (this.follow) this.baseCol = vc.slice();
    this.mesh = new THREE.Mesh(geo, matW);
    scene.add(this.mesh);
    // cienie odbiera osobna, płaska płaszczyzna – cienie nie „falują” razem z siatką fal
    const sg = new THREE.PlaneGeometry(size, size);
    sg.rotateX(-Math.PI / 2);
    if (!this.follow) sg.translate(0, 0, 100);
    this.shadowPlane = new THREE.Mesh(sg, new THREE.ShadowMaterial({ opacity: 0.34, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.shadowPlane.receiveShadow = true;
    this.shadowPlane.renderOrder = 2;
    scene.add(this.shadowPlane);
    // dwie dodatkowe warstwy zmarszczek płynące w różnych kierunkach i skalach na tej samej siatce
    this.ripples = [0, 1].map((k) => {
      const tex = rippleTexture();
      tex.repeat.set(size / (k ? 9 : 14), size / (k ? 9 : 14));
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      m.renderOrder = 1;
      m.visible = false; // bez drobnych zmarszczek – gładkie fasety low-poly
      scene.add(m);
      return { tex, mat: m.material, k, mesh: m, period: k ? 9 : 14, drift: { x: 0, y: 0 } };
    });
    // otwarte morze poza portem
    // daleko: ta sama tekstura co przy jachcie, więc granica siatki fal jest niewidoczna (mipmapy dają średni kolor wody)
    let farMat;
    if (this.follow) {
      this.farTex = this.tex.clone();
      this.farTex.needsUpdate = true;
      this.farTex.repeat.set(24000 / 22, 24000 / 22);
      this.farTex.anisotropy = 16;
      farMat = new THREE.MeshPhongMaterial({ color: 0x0d2f52, flatShading: true, specular: 0x415566, shininess: 95 });
      farMat.onBeforeCompile = this.patchWater(false);
    } else farMat = new THREE.MeshLambertMaterial({ color: 0x2a7b98 });
    const far = new THREE.Mesh(new THREE.PlaneGeometry(this.follow ? 24000 : 3000, this.follow ? 24000 : 3000), farMat);
    far.rotation.x = -Math.PI / 2;
    far.position.y = -0.7; // poniżej dołków fal (inaczej prześwituje przez wodę)
    scene.add(far);
    this.far = far;
    this.t = 0;
  }
  // Barwa zależna od odległości od brzegu (płycizna jaśniejsza i bardziej zielona, głębia ciemniejsza)
  setHarbor(H) {
    const polys = H.structures.filter((s) => s.kind !== 'boom' && s.kind !== 'pile' && s.poly).map((s) => {
      const xs = s.poly.map((p) => p[0]), zs = s.poly.map((p) => p[1]);
      return { poly: s.poly, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
    });
    const dSeg = (px, pz, ax, az, bx, bz) => {
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const k = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
      return Math.hypot(px - (ax + dx * k), pz - (az + dz * k));
    };
    const col = this.geo.attributes.color;
    const deep = new THREE.Color(0x1a4566), shallow = new THREE.Color(0x4a8790), mid = new THREE.Color(0x285f80); // naturalniejsza, ciemniejsza woda portowa
    const c = new THREE.Color();
    for (let i = 0; i < col.count; i++) {
      const x = this.base[i * 3], z = this.base[i * 3 + 2];
      let d = 60;
      for (const q of polys) {
        if (x < q.minX - 60 || x > q.maxX + 60 || z < q.minZ - 60 || z > q.maxZ + 60) continue;
        for (let k = 0; k < q.poly.length; k++) {
          const a = q.poly[k], b = q.poly[(k + 1) % q.poly.length];
          d = Math.min(d, dSeg(x, z, a[0], a[1], b[0], b[1]));
        }
      }
      const t = Math.min(1, d / 45);
      c.copy(shallow).lerp(mid, Math.min(1, d / 6)).lerp(deep, Math.max(0, (t - 0.15) / 0.85) * 0.9);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    this.baseCol = col.array.slice();
  }
  // wysokość i nachylenie sumy fal w punkcie
  wave(x, z, t, a, windDir, out) {
    let h = 0, gx = 0, gz = 0;
    for (const W of WAVES) {
      const dir = windDir + W.d;
      const kx = Math.sin(dir) * W.k, kz = -Math.cos(dir) * W.k;
      const ph = x * kx + z * kz - t * W.w;
      const amp = a * W.a;
      h += amp * Math.sin(ph);
      const c = amp * Math.cos(ph);
      gx += c * kx; gz += c * kz;
    }
    if (out) { out.gx = gx; out.gz = gz; }
    return h;
  }
  update(dt, windKn, windDir, cx = 0, cz = 0) {
    this.t += dt;
    const fc = this.sceneRef.fog && this.sceneRef.fog.color;
    if (fc) this.skyU.value.copy(fc).lerp(this._seaBlue || (this._seaBlue = new THREE.Color(0x2a5a86)), 0.45); // odbicie nieba przyciemnione ku błękitowi – woda nie jest blada
    if (this.follow) {
      // siatka przesuwa się skokami co oczko, więc wierzchołki zawsze leżą na tej samej kratce świata
      const cell = this.size / this.seg;
      this.ox = Math.round(cx / cell) * cell;
      this.oz = Math.round(cz / cell) * cell;
      this.mesh.position.set(this.ox, 0, this.oz);
      this.shadowPlane.position.x = this.ox; this.shadowPlane.position.z = this.oz;
      this.far.position.x = this.ox; this.far.position.z = this.oz;
      for (const rp of this.ripples) rp.mesh.position.set(this.ox, 0, this.oz);
    }
    // tekstura dryfuje powoli z wiatrem (+ zakotwiczenie w świecie, gdy siatka podąża za jachtem)
    const drift = (0.004 + Math.min(windKn, 35) * 0.0006) * dt;
    this.drift.x += Math.sin(windDir) * drift;
    this.drift.y += Math.cos(windDir) * drift;
    this.tex.offset.x = this.drift.x + (this.follow ? this.ox / 22 : 0);
    this.tex.offset.y = this.drift.y - (this.follow ? this.oz / 22 : 0);
    if (this.farTex) { this.farTex.offset.x = this.drift.x + this.ox / 22; this.farTex.offset.y = this.drift.y - this.oz / 22; }
    // warstwy zmarszczek: różne kierunki, prędkości i pulsowanie krycia
    const wsp = 0.02 + Math.min(windKn, 35) * 0.0012;
    this.ripples.forEach((rp, i) => {
      const dir = windDir + (i ? 1.1 : -0.7);
      rp.drift.x += Math.sin(dir) * wsp * (i ? 1.4 : 0.8) * dt;
      rp.drift.y += Math.cos(dir) * wsp * (i ? 1.4 : 0.8) * dt;
      rp.tex.offset.x = rp.drift.x + (this.follow ? this.ox / rp.period : 0);
      rp.tex.offset.y = rp.drift.y - (this.follow ? this.oz / rp.period : 0);
      rp.mat.opacity = 0.15 + 0.08 * Math.sin(this.t * (0.5 + i * 0.37) + i * 2);
    });
    const p = this.geo.attributes.position.array;
    const a = (0.04 + Math.min(windKn, 35) * 0.0045) * this.waveGain; // wyższe fale – wyraźniejsza bryła wody
    this.shadowPlane.position.y = a * 1.4; // na wysokości typowych grzbietów fal
    const g = {};
    const cl = this.baseCol ? this.geo.attributes.color.array : null;
    for (let i = 0; i < p.length; i += 3) {
      p[i + 1] = this.wave(this.base[i] + this.ox, this.base[i + 2] + this.oz, this.t, a, windDir, g);
      if (cl) { const k = 1 + clamp(p[i + 1] / (a * 2.2), -1, 1) * 0.16; cl[i] = this.baseCol[i] * k; cl[i + 1] = this.baseCol[i + 1] * k; cl[i + 2] = this.baseCol[i + 2] * k; }
    }
    this.geo.attributes.position.needsUpdate = true;
    if (cl) this.geo.attributes.color.needsUpdate = true;
  }
  // wysokość narysowanej powierzchni (do unoszących się obiektów)
  surfaceY(x, z, windKn, windDir) {
    return this.wave(x, z, this.t, (0.04 + Math.min(windKn, 35) * 0.0045) * this.waveGain, windDir);
  }
  heightAt(x, z, windKn, windDir) {
    const a = 0.03 + Math.min(windKn, 35) * 0.0032;
    return this.wave(x, z, this.t, a, windDir) * (this.follow ? 2.1 : 2.2); // kołysanie jachtu nieco silniejsze niż rysowana fala
  }
}
