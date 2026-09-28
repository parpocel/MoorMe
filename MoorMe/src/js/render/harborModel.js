// Scenografia portu: keje, pomosty, polery, dalby, Y-bomy, falochron, zabudowa, zieleń, sąsiednie jachty
import * as THREE from 'three';
import { mat, buildBoat } from './boatModel.js';
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

function house(r, x, z, y, rotY) {
  const g = new THREE.Group();
  const w = 6 + r() * 6, d = 5 + r() * 4;
  const floors = 1 + Math.floor(r() * 3);
  const fh = 2.9, h = 0.5 + floors * fh;
  const wallColors = [0xf1e3c6, 0xe8d2b0, 0xf4efe6, 0xd9a47f, 0xc9d6df, 0xe7c4a3, 0xffffff, 0xe4b9a0, 0xb8d3c9, 0xf0d6a8];
  const roofColors = [0xa8452e, 0x8c3b2a, 0x5b5b66, 0xb5563a, 0x6b3a2e];
  const shutterColors = [0x2e6b4f, 0x2a5a8a, 0x6b4a2f, 0x8a8f96];
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
function addQuayDetails(group, H, r, landY, baseZ) {
  const q = H.quay;
  const hard = q.id === 'concrete' || q.id === 'piles';
  const top = q.height;
  const x0 = -148, x1 = 148;
  if (hard) {
    // kamienna krawędź (granit) i żółta linia bezpieczeństwa
    group.add(box(x1 - x0, 0.1, 0.6, 0xc9c5bb, 0, top + 0.05, -0.3));
    group.add(box(x1 - x0, 0.012, 0.1, 0xe8c547, 0, top + 0.012, -0.85));
    if (q.id === 'concrete') {
      // pionowe odbojnice gumowe na ścianie nabrzeża
      for (let x = x0 + 2; x < x1; x += 4) group.add(box(0.28, top + 0.7, 0.22, 0x1b1b1b, x, (top - 0.7) / 2, 0.11));
    }
    // drabinki wyjściowe z wody
    for (let x = x0 + 12; x < x1; x += 24) {
      for (const s of [-1, 1]) {
        group.add(box(0.05, top + 1.3, 0.05, 0xe8c547, x + s * 0.25, (top - 1.3) / 2, 0.14));
        group.add(box(0.05, 0.9, 0.05, 0xe8c547, x + s * 0.25, top + 0.45, -0.15));
      }
      for (let y = -1.1; y < top; y += 0.3) group.add(box(0.5, 0.04, 0.04, 0xe8c547, x, y, 0.14));
    }
  }
  // słupki serwisowe (prąd/woda) i koła ratunkowe przy krawędzi
  const edgeY = q.id === 'pontoon' || q.id === 'yboom' ? q.height : top;
  for (let x = x0 + 6.5; x < x1; x += 9) {
    if (q.id === 'pontoon' || q.id === 'yboom') { if (Math.abs(x) > 92) continue; }
    group.add(pedestal(x, -1.05, edgeY));
  }
  for (let x = x0 + 20; x < x1; x += 36) {
    if ((q.id === 'pontoon' || q.id === 'yboom') && Math.abs(x) > 92) continue;
    group.add(lifebuoy(x, -1.5, edgeY));
  }
  // promenada: ławki z oparciem, kosze, donice z kwiatami
  for (let x = -120; x < 120; x += 23) {
    group.add(bench(x, baseZ - 7.2, landY));
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.8, 8), mat(0x2e5e3a));
    bin.position.set(x + 1.5, landY + 0.4, baseZ - 7.3);
    group.add(bin);
    group.add(planter(r, x + 11.5, baseZ - 7.2, landY));
  }
  // budka z lodami
  const kiosk = new THREE.Group();
  kiosk.add(box(2.4, 2.2, 1.8, 0xf4efe6, 0, 1.1, 0));
  kiosk.add(box(1.8, 0.8, 0.06, 0x243447, 0, 1.4, 0.92, { rough: 0.2, metal: 0.3 }));
  for (let k = 0; k < 6; k++) {
    const a = box(0.42, 0.08, 1.0, k % 2 ? 0xffffff : 0xe63946, -1.05 + k * 0.42, 2.35, 1.2);
    a.rotation.x = 0.35;
    kiosk.add(a);
  }
  kiosk.position.set(-35, landY, baseZ - 9.5);
  group.add(kiosk);
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

const NEIGHBOR_NAMES = ['AURORA', 'MEWA', 'BRYZA', 'LUNA', 'SIROCCO', 'WIATR', 'ZEFIR', 'NEPTUN', 'ALBATROS', 'MISTRAL', 'POLARIS', 'ORKA'];
const NEIGHBOR_CANVAS =[0x24374f, 0x1f5f8b, 0x2d6a4f, 0x7a1f1f, 0x3d3d3d, 0x1f4e79];

export function buildHarbor(H, scene) {
  const group = new THREE.Group();
  const dyn = new THREE.Group();
  const r = rng(99);
  const concreteMat = new THREE.MeshStandardMaterial({ map: concreteTexture(), flatShading: true, roughness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ map: plankTexture(), flatShading: true, roughness: 0.85 });
  const grassMat = mat(0x6f9a4c, { rough: 1 });
  const rockMat = mat(0x8a8780);

  for (const s of H.structures) {
    if (s.kind === 'quay') {
      const isWood = s.wood;
      const m = extrudePoly(s.poly, s.h, -3, isWood ? woodMat : concreteMat);
      setUVWorld(m.geometry, isWood ? 0.35 : 0.12);
      group.add(m);
      if (s.walk && !s.shore) {
        // odbojnica gumowa wzdłuż krawędzi (dla nabrzeża betonowego)
        const xs = s.poly.map((p) => p[0]);
        const zmax = Math.max(...s.poly.map((p) => p[1]));
        const x0 = Math.min(...xs), x1 = Math.max(...xs);
        if (isWood) {
          // pale pod keją drewnianą
          for (let x = x0 + 2; x < x1; x += 4) {
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4, 6), mat(0x5a4632));
            p.position.set(x, s.h - 2, zmax - 0.1);
            group.add(p);
          }
        } else {
          const rub = box(x1 - x0, 0.35, 0.18, 0x1c1c1c, (x0 + x1) / 2, s.h - 0.35, zmax + 0.06);
          group.add(rub);
        }
      }
    } else if (s.kind === 'pontoon') {
      const m = extrudePoly(s.poly, s.h, -0.4, woodMat);
      setUVWorld(m.geometry, 0.35);
      group.add(m);
      // pływaki i krawężnik
      const xs = s.poly.map((p) => p[0]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      group.add(box(x1 - x0, 0.25, 0.14, 0xe9ecef, (x0 + x1) / 2, s.h - 0.05, 0.05));
      group.add(box(x1 - x0, 0.5, 2.3, 0x44484d, (x0 + x1) / 2, -0.35, -1.3));
    } else if (s.kind === 'shallow') {
      const m = extrudePoly(s.poly, -0.35, -1.5, mat(0xc2b280));
      group.add(m);
    } else if (s.kind === 'land') {
      group.add(extrudePoly(s.poly, s.h, -3, grassMat));
    } else if (s.kind === 'breakwater') {
      group.add(extrudePoly(s.poly, s.h, -4, concreteMat));
      // kamienie
      const xs = s.poly.map((p) => p[0]), zs = s.poly.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      for (let x = x0; x < x1; x += 2.2) {
        for (const zz of [z0 - 0.6, z1 + 0.6]) {
          const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 + r() * 0.8, 0), rockMat);
          rk.position.set(x + r(), 0.2 + r() * 0.6, zz + (r() - 0.5));
          rk.rotation.set(r() * 3, r() * 3, r() * 3);
          rk.castShadow = true;
          group.add(rk);
        }
      }
    } else if (s.kind === 'boom') {
      const m = extrudePoly(s.poly, s.h, s.h - 0.25, mat(0xb9c0c8, { metal: 0.5, rough: 0.4 }));
      group.add(m);
      // pływaki
      const cx = s.poly.reduce((a, p) => a + p[0], 0) / 4;
      const zs = s.poly.map((p) => p[1]);
      const z0 = Math.min(...zs), z1 = Math.max(...zs);
      for (let z = z0 + 1.5; z < z1; z += 3) group.add(box(0.5, 0.45, 0.9, 0xf4f4f4, cx, 0.02, z));
    } else if (s.kind === 'pile') {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r * 1.1, s.h + 3, 7), mat(0x6b5236));
      p.position.set(s.cx, (s.h - 3) / 2, s.cz);
      p.castShadow = true;
      group.add(p);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(s.r * 1.05, s.r * 1.05, 0.25, 7), mat(0xe9e9e9));
      top.position.set(s.cx, s.h - 0.1, s.cz);
      group.add(top);
    }
  }

  // polery
  const bollardMeshes = [];
  for (const b of H.bollards) {
    const m = buildBollard(b.kind);
    m.position.set(b.x, b.kind === 'pile' ? b.h : b.h, b.z);
    m.userData.bollard = b;
    group.add(m);
    // niewidzialna strefa do klikania
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(b.x, b.h + 0.3, b.z);
    hit.userData.bollard = b;
    dyn.add(hit);
    bollardMeshes.push(hit);
    // znacznik podświetlenia
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 4, 16), new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.9 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(b.x, b.h + 0.08, b.z);
    ring.visible = false;
    dyn.add(ring);
    b._ring = ring;
  }

  // muringi: bloczki na dnie + linki pilotowe
  for (const m of H.murings) {
    const blk = box(1.2, 0.8, 1.2, 0x6d6d6d, m.anchor.x, -m.anchor.depth + 0.3, m.anchor.z);
    group.add(blk);
  }

  // dekoracje
  for (const d of H.deco) {
    if (d.type === 'lighthouse') {
      const l = lighthouse(d.color);
      l.position.set(d.x, 2.2, d.z);
      group.add(l);
    } else if (d.type === 'gangway') {
      const g = box(1.2, 0.1, d.len, 0x8a8f96, d.x, 0.8, d.z, { metal: 0.5 });
      g.rotation.x = -0.1;
      group.add(g);
    }
  }

  // zabudowa na lądzie (północ)
  const landY = (H.quay.id === 'pontoon' || H.quay.id === 'yboom') ? 1.2 : H.quay.height;
  const baseZ = (H.quay.id === 'pontoon' || H.quay.id === 'yboom') ? -9 : 0;
  for (let x = -140; x < 140; x += 14 + r() * 6) {
    group.add(house(r, x, baseZ - 22 - r() * 4, landY, 0));
    if (r() < 0.6) group.add(tree(r, x + 7, baseZ - 13 - r() * 2, landY));
  }
  for (let x = -135; x < 135; x += 9) group.add(lamp(x, baseZ - 5, landY));
  addQuayDetails(group, H, r, landY, baseZ);
  // bosmanat z szyldem i masztem flagowym
  const bos = house(rng(3), 55, baseZ - 13, landY, 0);
  bos.scale.set(0.9, 0.9, 0.9);
  group.add(bos);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 10, 6), mat(0xffffff));
  mast.position.set(64, landY + 5, baseZ - 8);
  group.add(mast);
  group.add(box(1.6, 0.05, 0.05, 0xffffff, 64, landY + 8.6, baseZ - 8));
  const pennants = [0xffffff, 0xdc143c, 0x1d4e89, 0xf2c14e, 0x2a9d8f];
  pennants.forEach((c, i) => {
    const f = box(0.02, 0.28, 0.42, c, 64 + (i - 2) * 0.33, landY + 8.3 - Math.abs(i - 2) * 0.12, baseZ - 8.2);
    group.add(f);
  });
  group.add(signBoard('MARINA · BOSMANAT', 55, baseZ - 6.5, landY));
  // boczne brzegi – drzewa i skały
  for (let z = -30; z < 200; z += 9) {
    group.add(tree(r, -160 - r() * 20, z, 1.5));
    group.add(tree(r, 160 + r() * 20, z, 1.5));
  }
  // wzgórza w tle
  for (let i = 0; i < 14; i++) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(40 + r() * 40, 25 + r() * 35, 7), mat(i % 2 ? 0x5f7f4a : 0x6b8a52));
    h.position.set(-260 + i * 40 + r() * 20, 0, -120 - r() * 60);
    h.receiveShadow = true;
    group.add(h);
  }

  // sąsiednie jachty
  const boatCache = new Map();
  H.neighbors.forEach((n, i) => {
    const key = n.spec.id + '_' + n.color;
    let proto = boatCache.get(key);
    if (!proto) {
      const built = buildBoat(n.spec, { color: n.color, stripe: n.color === 0xffffff ? 0x2b3a4a : 0xffffff, canvas: NEIGHBOR_CANVAS[i % NEIGHBOR_CANVAS.length], name: NEIGHBOR_NAMES[boatCache.size % NEIGHBOR_NAMES.length] });
      proto = mergeByMaterial(built);
      proto.userData.perches = built.userData.perches;
      boatCache.set(key, proto);
    }
    const b = proto.clone();
    b.position.set(n.x, 0, n.z);
    b.rotation.y = -n.th;
    b.userData.bobPhase = r() * 6;
    b.userData.neighbor = n;
    dyn.add(b);
    n._mesh = b;
    // cumy sąsiadów
    const { xs, xb } = hullExtents(n.spec);
    const c = Math.cos(n.th), s = Math.sin(n.th);
    const w = (lx, ly, y) => new THREE.Vector3(n.x + lx * c - ly * s, y, n.z + lx * s + ly * c);
    if (n.scenery) return;
    const qh = H.quay.height + 0.3;
    if (n.alongside) {
      const side = n.th === 0 ? -1 : 1;
      group.add(sagLine(w(xb - 1, side * halfBeamAt(n.spec, xb - 1), n.spec.freeboard + 0.2), new THREE.Vector3(n.x + Math.cos(n.th) * (xb + 2), qh, -0.5), 0.3));
      group.add(sagLine(w(xs + 0.5, side * halfBeamAt(n.spec, xs + 0.5), n.spec.freeboard), new THREE.Vector3(n.x + Math.cos(n.th) * (xs - 2), qh, -0.5), 0.3));
    } else {
      const quayEndX = n.th < 0 ? xb - 0.6 : xs + 0.4;
      const farX = n.th < 0 ? xs + 0.4 : xb - 0.4;
      for (const sd of [-1, 1]) {
        const a = w(quayEndX, sd * halfBeamAt(n.spec, quayEndX) * 0.85, n.spec.freeboard + 0.1);
        group.add(sagLine(a, new THREE.Vector3(a.x + sd * 0.8, qh, -0.45), 0.25));
      }
      if (n.mooring) {
        const a = w(farX, 0, n.spec.freeboard + 0.2);
        const dirz = n.th < 0 ? 1 : 1;
        group.add(sagLine(a, new THREE.Vector3(a.x, -1.5, a.z + dirz * 7), 0.6, 0x9aa19f));
      } else if (H.method.startsWith('piles')) {
        for (const sd of [-1, 1]) {
          const a = w(farX, sd * halfBeamAt(n.spec, farX) * 0.8, n.spec.freeboard + 0.1);
          const pz = H.berth.pileZ;
          const slotHalf = (n.spec.beam + 1.05) / 2;
          group.add(sagLine(a, new THREE.Vector3(n.x + sd * slotHalf, 2.4, pz), 0.35));
        }
      } else if (H.method.startsWith('yboom')) {
        for (const sd of [-1, 1]) {
          const a = w(0, sd * halfBeamAt(n.spec, 0), n.spec.freeboard + 0.1);
          const slotHalf = (n.spec.beam + 0.86) / 2;
          group.add(sagLine(a, new THREE.Vector3(n.x + sd * slotHalf, 0.4, H.boomLen - 0.35), 0.2));
        }
      }
    }
  });

  // dno
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1), mat(0x6f6a52, { rough: 1 }));
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = -6;
  group.add(bed);

  const merged = mergeByMaterial(group);
  scene.add(merged);
  scene.add(dyn);
  return { group: merged, dyn, bollardMeshes };
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

// Woda – animowana siatka low-poly
export class Water {
  constructor(scene) {
    const size = 520, seg = 90;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, 100);
    this.geo = geo;
    this.base = geo.attributes.position.array.slice();
    // matowa woda ze stonowaną teksturą zmarszczek (bez odblasków)
    this.tex = waterTexture();
    this.tex.repeat.set(size / 22, size / 22);
    const matW = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.tex, flatShading: true, transparent: true, opacity: 0.92 });
    this.mesh = new THREE.Mesh(geo, matW);
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    // otwarte morze poza portem
    const far = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: 0x2a7b98 }));
    far.rotation.x = -Math.PI / 2;
    far.position.y = -0.08;
    scene.add(far);
    this.t = 0;
  }
  update(dt, windKn, windDir) {
    this.t += dt;
    // tekstura dryfuje powoli z wiatrem
    const drift = (0.004 + Math.min(windKn, 35) * 0.0006) * dt;
    this.tex.offset.x += Math.sin(windDir) * drift;
    this.tex.offset.y += Math.cos(windDir) * drift;
    const p = this.geo.attributes.position.array;
    const a = 0.015 + Math.min(windKn, 35) * 0.0022;
    const kx = Math.sin(windDir), kz = -Math.cos(windDir);
    const t = this.t;
    for (let i = 0; i < p.length; i += 3) {
      const x = this.base[i], z = this.base[i + 2];
      const ph = (x * kx + z * kz) * 0.35 - t * 1.3;
      p[i + 1] = a * Math.sin(ph) + a * 0.5 * Math.sin(x * 0.21 + z * 0.17 + t * 0.9);
    }
    this.geo.attributes.position.needsUpdate = true;
  }
  heightAt(x, z, windKn, windDir) {
    const a = 0.03 + Math.min(windKn, 35) * 0.0045; // kołysanie jachtu nieco silniejsze niż rysowana fala
    const kx = Math.sin(windDir), kz = -Math.cos(windDir);
    const ph = (x * kx + z * kz) * 0.35 - this.t * 1.3;
    return a * Math.sin(ph) + a * 0.5 * Math.sin(x * 0.21 + z * 0.17 + this.t * 0.9);
  }
}
