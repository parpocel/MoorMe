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

export function buildBollard(kind) {
  const g = new THREE.Group();
  if (kind === 'bollard') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 8), mat(0x2d2f33, { rough: 0.5, metal: 0.4 }));
    b.position.y = 0.21;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.1, 8), mat(0x2d2f33, { rough: 0.5, metal: 0.4 }));
    cap.position.y = 0.45;
    g.add(b, cap);
  } else if (kind === 'cleat') {
    g.add(box(0.36, 0.06, 0.08, 0xbfc5cc, 0, 0.1, 0, { metal: 0.8, rough: 0.3 }));
    g.add(box(0.1, 0.1, 0.07, 0xbfc5cc, 0, 0.05, 0, { metal: 0.8, rough: 0.3 }));
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
  // dach dwuspadowy z dachówką
  const roofH = 1.6 + r() * 1.2;
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2 - 0.35, 0); shape.lineTo(d / 2 + 0.35, 0); shape.lineTo(0, roofH); shape.lineTo(-d / 2 - 0.35, 0);
  const rg = new THREE.ExtrudeGeometry(shape, { depth: w + 0.5, bevelEnabled: false });
  rg.translate(0, 0, -(w + 0.5) / 2);
  rg.rotateY(Math.PI / 2);
  const roof = new THREE.Mesh(rg, roofMat(roofColors[Math.floor(r() * roofColors.length)]));
  roof.position.y = h + 0.02;
  roof.castShadow = true;
  g.add(roof);
  // komin
  const chx = (r() - 0.5) * w * 0.6;
  g.add(box(0.6, 1.4, 0.6, 0x9a6b55, chx, h + roofH * 0.6, -d * 0.12));
  g.add(box(0.75, 0.12, 0.75, 0x6f6f6f, chx, h + roofH * 0.6 + 0.72, -d * 0.12));
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
          continue;
        }
        const big = shop && s === 1 && f === 0;
        const ww = big ? w / nWin - 0.5 : 0.9, wh = big ? 1.9 : 1.2;
        g.add(box(ww + 0.16, wh + 0.16, 0.06, 0xf4f1ea, wx, big ? 0.5 + 1.25 : wy, zf));
        g.add(box(ww, wh, 0.08, 0x243447, wx, big ? 0.5 + 1.25 : wy, zf + s * 0.01, { rough: 0.15, metal: 0.4 }));
        if (!big) {
          g.add(box(ww + 0.3, 0.07, 0.22, 0xe6e0d2, wx, wy - wh / 2 - 0.06, zf + s * 0.08));
          if (shutters) for (const sd of [-1, 1]) g.add(box(0.45, wh, 0.05, sc, wx + sd * (ww / 2 + 0.26), wy, zf + s * 0.03));
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

function lamp(x, z, y) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4, 5), mat(0x2d3436));
  p.position.y = 2;
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.35), mat(0xfff5d6, { emissive: 0x332a10 }));
  h.position.y = 4.1;
  g.add(p, h);
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
  const g = new THREE.Group();
  g.add(box(0.1, 1.4, 0.1, 0xc0392b, 0, 0.7, 0));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 16), mat(0xf26b21));
  ring.position.set(0, 1.05, 0.09);
  g.add(ring);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    const seg = box(0.13, 0.16, 0.16, 0xffffff, Math.cos(a) * 0.3, 1.05 + Math.sin(a) * 0.3, 0.09);
    seg.rotation.z = a;
    g.add(seg);
  }
  g.position.set(x, y, z);
  return g;
}

function pedestal(x, z, y) {
  const g = new THREE.Group();
  g.add(box(0.32, 0.95, 0.32, 0xf2f2f2, 0, 0.47, 0));
  g.add(box(0.36, 0.12, 0.36, 0x1d4e89, 0, 1.0, 0));
  g.add(box(0.1, 0.06, 0.02, 0x3ddc84, 0, 0.8, 0.17, { emissive: 0x1a6b3a }));
  g.add(box(0.2, 0.14, 0.02, 0x2d3436, 0, 0.55, 0.17));
  g.position.set(x, y, z);
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
      // kamienna/betonowa krawędź (gzyms) i odbojnice na ścianie
      group.add(place(box(E.len, 0.12, 0.7, style === 'stone' ? 0xd9ceb8 : 0xc9c5bb, 0, 0, 0), E.at(E.len / 2, -0.33), top + 0.05, E.rotY));
      for (let t = 2; t < E.len; t += style === 'stone' ? 6 : 4) group.add(place(box(0.28, top + 0.7, 0.2, 0x1b1b1b, 0, 0, 0), E.at(t, 0.1), (top - 0.7) / 2, E.rotY));
      // drabinki wyjściowe
      for (let t = 12; t < E.len - 4; t += 26) {
        for (const sd of [-1, 1]) group.add(place(box(0.05, top + 1.3, 0.05, 0xe8c547, 0, 0, 0), E.at(t + sd * 0.25, 0.14), (top - 1.3) / 2, E.rotY));
        for (let y = -1.1; y < top; y += 0.3) group.add(place(box(0.5, 0.04, 0.04, 0xe8c547, 0, 0, 0), E.at(t, 0.14), y, E.rotY));
      }
    } else if (style === 'wood' || s.kind === 'pier') {
      // drewniane pale pod pomostem i belka krawędziowa
      for (let t = 1; t < E.len; t += 3) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, top + 3.2, 6), mat(0x5a4632));
        group.add(place(p, E.at(t, 0.05), (top - 3.2) / 2 + 0.05));
      }
      group.add(place(box(E.len, 0.22, 0.16, 0x6e5238, 0, 0, 0), E.at(E.len / 2, 0.05), top - 0.08, E.rotY));
    } else if (s.kind === 'pontoon') {
      group.add(place(box(E.len, 0.22, 0.14, 0xe9ecef, 0, 0, 0), E.at(E.len / 2, 0.05), top - 0.06, E.rotY));
    }
    if (!s.walk) continue;
    // słupki serwisowe i koła ratunkowe
    for (let t = 6; t < E.len - 2; t += 12) group.add(place(pedestal(0, 0, 0), E.at(t, -1.0), top, E.rotY));
    for (let t = 18; t < E.len - 2; t += 36) group.add(place(lifebuoy(0, 0, 0), E.at(t, -1.4), top, E.rotY + Math.PI));
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
  const h = 5 + r() * 2;
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, h, 6), mat(0x8a7456));
  t.position.y = h / 2;
  g.add(t);
  for (let k = 0; k < 7; k++) {
    const leaf = box(2.6, 0.05, 0.45, 0x4e8a3a, 1.2, h, 0);
    const pv = new THREE.Group();
    pv.add(leaf);
    pv.position.y = 0;
    pv.rotation.y = (k / 7) * Math.PI * 2;
    pv.rotation.z = -0.35;
    const holder = new THREE.Group();
    holder.add(pv);
    holder.position.y = 0;
    g.add(holder);
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

function ferry(d) {
  const g = new THREE.Group();
  const L = 150, B = 26;
  const white = 0xf4f4f2, navy = 0x1d4e89, glass = 0x1c2a38;
  // kadłub: burta, pas wodnicy (antifouling), czerwona linia burtowa
  g.add(box(L, 9, B, white, 0, 4, 0));
  g.add(box(L * 0.99, 1.4, B + 0.15, 0x7a1f1f, 0, 0.9, 0));
  g.add(box(L * 0.98, 0.6, B + 0.12, navy, 0, 2.0, 0));
  // pokład samochodowy: ciemne otwory wzdłuż burt i rufowa rampa
  for (const s of [-1, 1]) {
    g.add(box(L * 0.8, 3.4, 0.2, 0x252b31, -4, 5.0, s * (B / 2 + 0.05)));
    for (let k = 0; k < 24; k++) g.add(box(1.0, 1.0, 0.15, glass, -L * 0.42 + k * 2.4 + 8, 8.3, s * (B / 2 + 0.08), { rough: 0.2, metal: 0.4 })); // iluminatory
  }
  g.add(box(0.6, 6, B * 0.8, 0x252b31, -L / 2 - 0.05, 5.2, 0));
  // pokłady pasażerskie z długimi rzędami okien
  g.add(box(L * 0.72, 6, B * 0.94, 0xf8f8f6, -8, 12.5, 0));
  g.add(box(L * 0.62, 5, B * 0.86, 0xf8f8f6, -12, 17.5, 0));
  for (const [y, len, w] of [[12.5, 0.7, B * 0.94], [16, 0.68, B * 0.94], [17.5, 0.6, B * 0.86], [19.6, 0.58, B * 0.86]]) {
    for (const s of [-1, 1]) g.add(box(L * len, 1.0, 0.15, glass, -8, y, s * (w / 2 + 0.05), { rough: 0.2, metal: 0.4 }));
  }
  // mostek z szerokim oknem i skrzydłami
  g.add(box(12, 5, B * 0.78, 0xf8f8f6, 24, 22, 0));
  g.add(box(0.2, 1.8, B * 0.78 - 0.4, glass, 30.1, 22.6, 0, { rough: 0.2, metal: 0.4 }));
  g.add(box(9, 0.6, B + 4, 0xf8f8f6, 24, 20.2, 0)); // skrzydła mostka
  // komin z pasem i logo
  g.add(box(9, 11, 6, white, -36, 25, 0));
  g.add(box(9.05, 2.6, 6.05, navy, -36, 28, 0));
  g.add(box(9.4, 0.6, 6.4, 0x222222, -36, 30.7, 0));
  // maszt z radarem i flagą
  g.add(box(0.4, 9, 0.4, 0xdddddd, 27, 29, 0));
  g.add(box(4.5, 0.3, 0.9, 0x333333, 27, 33.4, 0));
  // szalupy ratunkowe na pokładzie łodziowym (pomarańczowe)
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    g.add(box(8, 2.2, 2.6, 0xff6a13, -34 + k * 10, 16.6 + 3.4, s * (B * 0.43 + 1.4)));
    g.add(box(8.2, 0.4, 2.8, 0xf2f2f2, -34 + k * 10, 20.2, s * (B * 0.43 + 1.4)));
  }
  // pomost/reling wokół górnego pokładu
  for (const s of [-1, 1]) g.add(box(L * 0.7, 0.15, 0.15, 0xdddddd, -10, 21.2, s * B * 0.42));
  // napis na burtach
  const nameMat = new THREE.MeshBasicMaterial({ map: ferryNameTexture(), transparent: true, depthWrite: false });
  for (const s of [-1, 1]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(24, 3), nameMat);
    pl.position.set(20, 5.0, s * (B / 2 + 0.2));
    if (s < 0) pl.rotation.y = Math.PI;
    pl.userData.keep = true;
    g.add(pl);
  }
  // dziób: półwalec + zaostrzenie + dzwon kotwiczny
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(B / 2, B / 2, 9, 16, 1, false, 0, Math.PI), mat(white));
  bow.rotation.y = -Math.PI / 2;
  bow.position.set(L / 2, 4, 0);
  g.add(bow);
  const bowNavy = new THREE.Mesh(new THREE.CylinderGeometry(B / 2 + 0.1, B / 2 + 0.1, 1.4, 16, 1, false, 0, Math.PI), mat(0x7a1f1f));
  bowNavy.rotation.y = -Math.PI / 2;
  bowNavy.position.set(L / 2, 0.9, 0);
  g.add(bowNavy);
  g.add(box(6, 1.2, 6, 0x9aa1a7, L / 2 - 6, 9.6, 0)); // kabestan dziobowy
  // duże okna / kurtyna w salonie dziobowym
  g.add(box(0.2, 2.2, B * 0.7, glass, -8 + L * 0.36 + 0.1, 14.4, 0, { rough: 0.2, metal: 0.4 }));
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
    const y = 1.0 + row * 3.4;
    const z0 = -16 - row * 11;
    // mur oporowy tarasu
    group.add(box(330, y + 3, 11, 0xcbbd9e, 15, (y - 3) / 2, z0 - 5.5));
    for (let x = -148 + (row % 2) * 7; x < 180; x += 13 + r() * 6) {
      if (row >= 3 && Math.abs(x + 55) < 14) continue; // miejsce na kościół
      if (r() < 0.12) { group.add(cypress(x, z0 - 4, y, 8 + r() * 4)); continue; }
      group.add(house(r, x, z0 - 4 - r() * 2, y, 0, pal));
    }
  }
  group.add(bellTower(-55, -66, 1.0 + 4 * 3.4));
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
      const bm = mat(0xb9c0c8, { metal: 0.5, rough: 0.4 });
      const f = s.fork;
      const fv = 3.2; // od tego miejsca bom rozwidla się w „Y” ku pomostowi
      const P = (a, b2) => [f.bx + f.nx * a + f.tx * b2, f.bz + f.nz * a + f.tz * b2];
      group.add(extrudePoly([P(fv, -0.18), P(f.len, -0.18), P(f.len, 0.18), P(fv, 0.18)], s.h, s.h - 0.25, bm));
      // dwa ramiona rozwidlenia opierające się o pomost
      for (const sd of [-1, 1]) {
        const a0 = P(fv, 0), a1 = P(0.15, sd * 0.6);
        const dx = a1[0] - a0[0], dz = a1[1] - a0[1], len = Math.hypot(dx, dz);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(len + 0.1, 0.25, 0.3), bm);
        arm.position.set((a0[0] + a1[0]) / 2, s.h - 0.125, (a0[1] + a1[1]) / 2);
        arm.rotation.y = -Math.atan2(dz, dx);
        arm.castShadow = true;
        group.add(arm);
      }
      // pływaki wzdłuż pnia
      for (let t = fv + 1.2; t < f.len; t += 3) {
        const p = P(t, 0);
        const fl = box(0.9, 0.45, 0.5, 0xf4f4f4, p[0], 0.02, p[1]);
        fl.rotation.y = -Math.atan2(f.nz, f.nx);
        group.add(fl);
      }
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
    m.userData.bollard = b;
    group.add(m);
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
  return { group: merged, dyn, bollardMeshes, lamps, lighthouses };
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
  // (siatka ma ~3,5 m oczka – fale krótsze niż ~10 m dawałyby aliasing, więc drobne zmarszczki zostają w teksturze)
  { d: 0, k: 0.42, w: 1.3, a: 1.0 },
  { d: 0.5, k: 0.55, w: 1.5, a: 0.5 },
  { d: -0.7, k: 0.3, w: 1.05, a: 0.6 },
  { d: 1.4, k: 0.22, w: 0.85, a: 0.6 },
  { d: -0.25, k: 0.62, w: 1.6, a: 0.3 }
];
export class Water {
  constructor(scene) {
    const size = 520, seg = 150;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, 100);
    this.geo = geo;
    this.base = geo.attributes.position.array.slice();
    // stonowana tekstura zmarszczek + łagodny połysk (Phong z ciemnym odblaskiem)
    this.tex = waterTexture();
    this.tex.repeat.set(size / 22, size / 22);
    const matW = new THREE.MeshPhongMaterial({ color: 0xffffff, map: this.tex, specular: 0x16252d, shininess: 35, transparent: true, opacity: 0.93 });
    this.mesh = new THREE.Mesh(geo, matW);
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    // dwie dodatkowe warstwy zmarszczek płynące w różnych kierunkach i skalach na tej samej siatce
    this.ripples = [0, 1].map((k) => {
      const tex = rippleTexture();
      tex.repeat.set(size / (k ? 9 : 14), size / (k ? 9 : 14));
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      m.renderOrder = 1;
      scene.add(m);
      return { tex, mat: m.material, k };
    });
    // otwarte morze poza portem
    const far = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: 0x2a7b98 }));
    far.rotation.x = -Math.PI / 2;
    far.position.y = -0.7; // poniżej dołków fal (inaczej prześwituje przez wodę)
    scene.add(far);
    this.t = 0;
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
  update(dt, windKn, windDir) {
    this.t += dt;
    // tekstura dryfuje powoli z wiatrem
    const drift = (0.004 + Math.min(windKn, 35) * 0.0006) * dt;
    this.tex.offset.x += Math.sin(windDir) * drift;
    this.tex.offset.y += Math.cos(windDir) * drift;
    // warstwy zmarszczek: różne kierunki, prędkości i pulsowanie krycia
    const wsp = 0.02 + Math.min(windKn, 35) * 0.0012;
    this.ripples.forEach((rp, i) => {
      const dir = windDir + (i ? 1.1 : -0.7);
      rp.tex.offset.x += Math.sin(dir) * wsp * (i ? 1.4 : 0.8) * dt;
      rp.tex.offset.y += Math.cos(dir) * wsp * (i ? 1.4 : 0.8) * dt;
      rp.mat.opacity = 0.38 + 0.2 * Math.sin(this.t * (0.5 + i * 0.37) + i * 2);
    });
    const p = this.geo.attributes.position.array;
    const n = this.geo.attributes.normal.array;
    const a = 0.04 + Math.min(windKn, 35) * 0.0045;
    const g = {};
    for (let i = 0; i < p.length; i += 3) {
      p[i + 1] = this.wave(this.base[i], this.base[i + 2], this.t, a, windDir, g);
      // normalna z analitycznego gradientu
      const gx = g.gx * 3, gz = g.gz * 3; // nachylenie przerysowane, żeby fale były czytelne w oświetleniu
      const l = 1 / Math.hypot(gx, 1, gz);
      n[i] = -gx * l; n[i + 1] = l; n[i + 2] = -gz * l;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }
  // wysokość narysowanej powierzchni (do unoszących się obiektów)
  surfaceY(x, z, windKn, windDir) {
    return this.wave(x, z, this.t, 0.04 + Math.min(windKn, 35) * 0.0045, windDir);
  }
  heightAt(x, z, windKn, windDir) {
    const a = 0.03 + Math.min(windKn, 35) * 0.0032;
    return this.wave(x, z, this.t, a, windDir) * 1.5; // kołysanie jachtu nieco silniejsze niż rysowana fala
  }
}
