// Wnętrze jachtu (mesa w stylu ok. 37-stopowego jachtu turystycznego): stół ze składanymi skrzydłami,
// kanapy, kambuz, stacja nawigacyjna z radiem VHF DSC, zejściówka. Na stole wyposażenie ratunkowe
// (EPIRB, SART, karty procedur), obok tratwa, kamizelki, gaśnica, pirotechnika, apteczka.
// Osie: x – do dziobu, y – w górę, z – na prawą burtę. Jednostki: metry.
import * as THREE from 'three';
import { getSettings } from '../settings.js';
import { procedureCard } from '../data/safety.js';

const WOOD = 0xa8693f, WOOD_D = 0x7d4a2a, CUSH = 0x2f4468, HEAD = 0xf1ede4, LINING = 0xe6dfd2, ALU = 0xc9ced6;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0, flatShading: !!o.flat, transparent: !!o.transparent, opacity: o.opacity ?? 1, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, side: o.side ?? THREE.FrontSide, map: o.map || null });
function box(w, h, d, m, x, y, z, parent) { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); g.position.set(x, y, z); g.castShadow = g.receiveShadow = true; if (parent) parent.add(g); return g; }
function cyl(rt, rb, h, m, x, y, z, parent, seg = 16) { const g = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); g.position.set(x, y, z); g.castShadow = g.receiveShadow = true; if (parent) parent.add(g); return g; }

// tekstura z napisami (canvas)
function textTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function woodTex() {
  return textTex(512, 512, (g, w, h) => {
    g.fillStyle = '#a8693f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${60 + Math.random() * 40},${30 + Math.random() * 20},10,${0.08 + Math.random() * 0.12})`; g.lineWidth = 1 + Math.random() * 3; const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 8 - Math.random() * 16, w * 0.7, y + 8 - Math.random() * 16, w, y); g.stroke(); }
  });
}
function soleTex() {
  // teak z jasnymi listwami (holly)
  return textTex(512, 512, (g, w, h) => {
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#8a5a32' : '#94633a'; g.fillRect(0, k * 64, w, 60); g.fillStyle = '#e8dcc0'; g.fillRect(0, k * 64 + 60, w, 4); }
    for (let i = 0; i < 160; i++) { g.strokeStyle = 'rgba(40,20,5,0.12)'; g.lineWidth = 1; const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 4 - Math.random() * 8); g.stroke(); }
  });
}

// ---------- kadłub od środka: profile poprzeczne „loftowane” wzdłuż jachtu ----------
function hullShell(parent) {
  const xs = [-2.3, -1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.7, 2.1];
  const B = (x) => 1.74 - 0.18 * Math.max(0, x / 2.1) ** 2 - 0.05 * Math.max(0, -x / 2.3);
  // profil połówkowy (z, y): od krawędzi podłogi przez burtę do nadbudówki i dachu
  const prof = (b) => [[0.46, 0], [b * 0.72, 0.1], [b * 0.93, 0.35], [b, 0.75], [b - 0.03, 1.22], [b - 0.38, 1.3], [b - 0.55, 1.88], [b - 0.75, 1.98], [0, 2.02]];
  const lining = std(LINING, { side: THREE.DoubleSide, rough: 0.9 }), head = std(HEAD, { side: THREE.DoubleSide, rough: 0.95 });
  for (const side of [-1, 1]) {
    for (let seg = 0; seg < prof(1).length - 1; seg++) {
      const pos = [];
      for (let i = 0; i < xs.length - 1; i++) {
        const a = prof(B(xs[i])), b = prof(B(xs[i + 1]));
        const p = (pr, k, x) => [x, pr[k][1], side * pr[k][0]];
        const q = [p(a, seg, xs[i]), p(b, seg, xs[i + 1]), p(b, seg + 1, xs[i + 1]), p(a, seg + 1, xs[i])];
        pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, seg >= 5 ? head : lining); m.receiveShadow = true; parent.add(m);
    }
  }
  // okna w burtach nadbudówki i świetlik w dachu (jasne, „dzień za szybą”)
  const glass = std(0xcfe8f7, { emissive: 0xbfe2f7, ei: 0.9, rough: 0.2 });
  for (const side of [-1, 1]) {
    for (const [x0, x1] of [[-1.5, -0.3], [0.1, 1.2]]) {
      const b = B((x0 + x1) / 2), z0 = side * (b - 0.4), z1 = side * (b - 0.52);
      const w = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 0.34), glass);
      w.position.set((x0 + x1) / 2, 1.58, (z0 + z1) / 2 - side * 0.01);
      w.rotation.y = side > 0 ? Math.PI : 0;
      w.rotation.x = 0; w.rotateX(side * -0.2);
      parent.add(w);
    }
  }
  const hatch = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), glass); hatch.rotation.x = Math.PI / 2; hatch.position.set(0.45, 2.0, 0); parent.add(hatch);
  box(0.62, 0.04, 0.62, std(0xdedad2), 0.45, 1.995, 0, parent).material.side = THREE.DoubleSide;
  // podłoga
  const sole = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.0), std(0xffffff, { map: soleTex(), rough: 0.55 }));
  sole.rotation.x = -Math.PI / 2; sole.position.set(-0.1, 0.0, 0); sole.receiveShadow = true; sole.userData.noFade = true; parent.add(sole);
  return B;
}

function cushion(w, h, d, x, y, z, parent, col = CUSH) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 2, 1, 2), std(col, { rough: 0.95 }));
  g.position.set(x, y, z); g.castShadow = g.receiveShadow = true; parent.add(g);
  // przeszycia
  const seam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.004, 0.008, d + 0.004), std(0x24344f, { rough: 1 })); seam.position.copy(g.position); seam.position.y += h / 2 - 0.01; parent.add(seam);
  return g;
}

function furniture(parent, B) {
  const wood = std(0xffffff, { map: woodTex(), rough: 0.5 }), woodD = std(WOOD_D, { rough: 0.5 });
  // kanapy: lewa burta (w kształcie litery L) i prawa
  box(2.3, 0.4, 0.9, wood, 0.15, 0.2, -1.0, parent);
  cushion(2.25, 0.12, 0.82, 0.15, 0.46, -1.02, parent);
  const back = cushion(2.25, 0.42, 0.12, 0.15, 0.78, -1.42, parent); back.rotation.x = 0.18;
  box(1.9, 0.4, 0.82, wood, 0.35, 0.2, 1.0, parent);
  cushion(1.85, 0.12, 0.76, 0.35, 0.46, 1.0, parent);
  const back2 = cushion(1.85, 0.42, 0.12, 0.35, 0.78, 1.4, parent); back2.rotation.x = -0.18;
  // szafki nad kanapami (z drzwiczkami) i listwy
  for (const s of [-1, 1]) {
    box(2.2, 0.32, 0.3, wood, 0.2, 1.42, s * (B(0.2) - 0.42), parent);
    for (let k = 0; k < 4; k++) box(0.46, 0.24, 0.01, woodD, -0.62 + k * 0.55, 1.42, s * (B(0.2) - 0.57), parent);
  }
  // stół: płaski blat (skrzydła rozłożone) na dwóch nogach
  const T = { x0: -0.35, x1: 0.95, y: 0.74 };
  box(T.x1 - T.x0, 0.035, 1.02, wood, (T.x0 + T.x1) / 2, T.y - 0.018, 0, parent).userData.noFade = true;
  // płaski blat na całej powierzchni, tylko niska listwa na krawędzi
  for (const z of [-0.5, 0.5]) box(T.x1 - T.x0, 0.012, 0.02, wood, (T.x0 + T.x1) / 2, T.y + 0.006, z, parent);
  for (const x of [T.x0 + 0.01, T.x1 - 0.01]) box(0.02, 0.012, 1.02, wood, x, T.y + 0.006, 0, parent);
  box(0.14, T.y - 0.04, 0.3, woodD, T.x0 + 0.2, (T.y - 0.04) / 2, 0, parent);
  box(0.14, T.y - 0.04, 0.3, woodD, T.x1 - 0.2, (T.y - 0.04) / 2, 0, parent);
  // słup masztu (kompresyjny) przy przedniej krawędzi stołu
  cyl(0.055, 0.055, 2.0, std(ALU, { metal: 0.8, rough: 0.25 }), 1.18, 1.0, 0, parent, 20);
  // grodź dziobowa z drzwiami do kabiny
  const bh = new THREE.Shape(); const bw = 1.55;
  bh.moveTo(-bw, 0); bh.lineTo(bw, 0); bh.lineTo(bw, 2.0); bh.lineTo(-bw, 2.0); bh.lineTo(-bw, 0);
  const door = new THREE.Path(); door.moveTo(-0.3, 0.05); door.lineTo(0.3, 0.05); door.lineTo(0.3, 1.82); door.lineTo(-0.3, 1.82); door.lineTo(-0.3, 0.05); bh.holes.push(door);
  const bhm = new THREE.Mesh(new THREE.ShapeGeometry(bh), std(0xffffff, { map: woodTex(), rough: 0.5, side: THREE.DoubleSide }));
  bhm.rotation.y = -Math.PI / 2; bhm.position.set(1.62, 0, 0); parent.add(bhm);
  box(0.02, 1.78, 0.6, std(0x3a2a20), 1.75, 0.93, 0, parent); // ciemne wnętrze kabiny dziobowej
  const dr = box(0.03, 1.74, 0.58, woodD, 1.62, 0.93, 0.0, parent); dr.position.set(1.4, 0.93, 0.52); dr.rotation.y = -1.25;
  // grodź rufowa, drzwi do kabin rufowych
  const ab = box(0.03, 2.0, 3.1, std(0xffffff, { map: woodTex(), rough: 0.5 }), -2.2, 1.0, 0, parent);
  ab.receiveShadow = true;
  for (const s of [-1, 1]) box(0.02, 1.7, 0.55, woodD, -2.18, 0.9, s * 0.85, parent);
  // zejściówka: schodki
  // zejściówka: drabinka wznosi się ku rufie do otwartego luku w dachu; stopnie między dwiema policzkami
  const st0 = { x: -1.58, y: 0 }, st1 = { x: -2.12, y: 1.62 }, nSt = 5;
  const sdx = st1.x - st0.x, sdy = st1.y - st0.y, slen = Math.hypot(sdx, sdy), sang = Math.atan2(-sdx, sdy);
  for (const z of [-0.29, 0.29]) { const sg = box(0.045, slen, 0.05, woodD, (st0.x + st1.x) / 2, (st0.y + st1.y) / 2, z, parent); sg.rotation.z = sang; }
  for (let k = 1; k <= nSt; k++) { const f = k / (nSt + 1); box(0.2, 0.035, 0.54, wood, st0.x + sdx * f - 0.03, st0.y + sdy * f, 0, parent); }
  for (const z of [-0.34, 0.34]) { const hr = cyl(0.014, 0.014, slen * 0.9, std(0xc9ced6, { metal: 0.8, rough: 0.3 }), (st0.x + st1.x) / 2, (st0.y + st1.y) / 2 + 0.35, z, parent, 8); hr.rotation.z = sang; }
  box(0.45, 0.55, 0.62, wood, -1.98, 0.28, 0, parent); // obudowa silnika pod drabinką
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.62), std(0xd8eefa, { emissive: 0xcfeafa, ei: 1.0 }));
  sky.rotation.x = Math.PI / 2; sky.position.set(-1.95, 1.985, 0); parent.add(sky); // otwarty luk zejściówki
  box(0.6, 0.05, 0.04, woodD, -1.95, 1.97, -0.33, parent); box(0.6, 0.05, 0.04, woodD, -1.95, 1.97, 0.33, parent);
  // kambuz (lewa burta, rufa): blat, zlew, kuchenka na kardanie
  box(0.95, 0.88, 0.75, wood, -1.55, 0.44, -1.08, parent);
  box(0.97, 0.04, 0.78, std(0xe9e4da, { rough: 0.4 }), -1.55, 0.9, -1.08, parent);
  cyl(0.15, 0.13, 0.02, std(0xbfc6cf, { metal: 0.9, rough: 0.2 }), -1.75, 0.915, -0.95, parent, 24);
  box(0.5, 0.18, 0.42, std(0x2a2d33, { metal: 0.5, rough: 0.4 }), -1.3, 1.0, -1.2, parent);
  for (const dx of [-0.11, 0.11]) cyl(0.06, 0.06, 0.012, std(0x111111), -1.3 + dx, 1.096, -1.2, parent, 16);
  // stacja nawigacyjna (prawa burta, rufa): pulpit z listwą, siedzisko, panel
  box(0.85, 0.06, 0.66, wood, -1.5, 0.78, 1.1, parent);
  box(0.85, 0.74, 0.04, woodD, -1.5, 0.39, 0.78, parent);
  box(0.85, 0.03, 0.02, wood, -1.5, 0.82, 0.78, parent);
  box(0.4, 0.42, 0.4, wood, -0.95, 0.21, 1.05, parent);
  cushion(0.4, 0.08, 0.4, -0.95, 0.46, 1.05, parent);
  const panel = box(0.9, 0.62, 0.04, std(0xffffff, { map: woodTex(), rough: 0.5 }), -1.5, 1.18, 1.43, parent);
  panel.rotation.x = 0.06;
  // tablica elektryczna (przełączniki) i barometr
  const ep = box(0.3, 0.2, 0.012, std(0x1d2128, { rough: 0.5 }), -1.78, 1.32, 1.405, parent);
  ep.rotation.x = 0.06;
  for (let k = 0; k < 8; k++) box(0.016, 0.03, 0.02, std(k % 3 ? 0xd7d7d7 : 0xd84a3a), -1.9 + k * 0.034, 1.33, 1.395, parent);
  const baro = cyl(0.07, 0.07, 0.03, std(0xc8a24a, { metal: 0.8, rough: 0.3 }), -1.2, 1.36, 1.405, parent, 24); baro.rotation.x = Math.PI / 2;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.058, 24), std(0xf7f3e8)); face.position.set(-1.2, 1.36, 1.388); face.rotation.y = Math.PI; parent.add(face);
  // listwy LED pod szafkami i lampka nad stołem nawigacyjnym
  for (const sd of [-1, 1]) box(2.1, 0.012, 0.02, std(0xffe2b0, { emissive: 0xffc98a, ei: 1.6 }), 0.2, 1.255, sd * (B(0.2) - 0.56), parent);
  const shade = cyl(0.03, 0.06, 0.07, std(0x2a2d33, { metal: 0.6, rough: 0.4 }), -1.35, 1.62, 1.05, parent, 16);
  cyl(0.004, 0.004, 0.3, std(0x2a2d33), -1.3, 1.78, 1.12, parent, 6).rotation.x = 0.4;
  cyl(0.025, 0.025, 0.005, std(0xfff2d6, { emissive: 0xffd9a0, ei: 2 }), -1.35, 1.584, 1.05, parent, 16);
  void shade;
  // lampki sufitowe
  for (const [x, z] of [[-0.9, -0.5], [-0.9, 0.5], [0.5, -0.55], [0.5, 0.55], [-1.5, 1.0]]) cyl(0.04, 0.04, 0.015, std(0xfff6dc, { emissive: 0xfff0c8, ei: 1.4 }), x, 1.985, z, parent, 16);
  return T;
}

// ---------- urządzenia ----------
function label(w, h, txt, bg, fg, sub) {
  return std(0xffffff, { map: textTex(256, Math.round((256 * h) / w), (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg; g.textAlign = 'center'; g.font = `bold ${Math.round(H * 0.42)}px Arial`; g.fillText(txt, W / 2, H * (sub ? 0.5 : 0.62)); if (sub) { g.font = `${Math.round(H * 0.24)}px Arial`; g.fillText(sub, W / 2, H * 0.86); } }) });
}

// radiopława EPIRB (kategoria II, ręczna): zaokrąglony żółty korpus, czarna nasadka z antenką i lampą błyskową, panel z przyciskiem, linka
function roundedRect(w, d, r) {
  const sh = new THREE.Shape(), x = -w / 2, y = -d / 2;
  sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + d - r); sh.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  sh.lineTo(x + r, y + d); sh.quadraticCurveTo(x, y + d, x, y + d - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
  return sh;
}
function epirb() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(0.085, 0.062, 0.022), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 8 }), std(0xffcf14, { rough: 0.45 }));
  body.rotation.x = -Math.PI / 2; body.position.y = 0.006; body.castShadow = true; g.add(body);
  // spód i nasadka z gumy
  const cap = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(0.08, 0.058, 0.02), { depth: 0.035, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }), std(0x1c1d20, { rough: 0.7 }));
  cap.rotation.x = -Math.PI / 2; cap.position.y = 0.205; g.add(cap);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xffffff, { transparent: true, opacity: 0.55, rough: 0.1, emissive: 0xffffff, ei: 0.15 }));
  dome.position.set(0.012, 0.245, 0.006); g.add(dome);
  cyl(0.004, 0.006, 0.2, std(0x111111), -0.022, 0.345, -0.008, g, 8); // antenka
  cyl(0.009, 0.009, 0.012, std(0x111111), -0.022, 0.248, -0.008, g, 10);
  // panel czołowy z napisem i przyciskiem ON pod przesuwną osłoną
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.12), std(0xffffff, { map: textTex(140, 240, (c, W, H) => {
    c.fillStyle = '#1c1d20'; c.fillRect(0, 0, W, H); c.textAlign = 'center';
    c.fillStyle = '#ffcf14'; c.font = 'bold 30px Arial'; c.fillText('EPIRB', W / 2, 44);
    c.fillStyle = '#ffffff'; c.font = 'bold 17px Arial'; c.fillText('406 MHz', W / 2, 72); c.font = '13px Arial'; c.fillText('GPS · 121.5 MHz', W / 2, 92);
    c.fillStyle = '#d8352a'; c.fillRect(20, 112, W - 40, 34); c.fillStyle = '#fff'; c.font = 'bold 14px Arial'; c.fillText('ON', W / 2, 135);
    c.fillStyle = '#ffffff'; c.font = '11px Arial'; c.fillText('1. ANTENNA UP', W / 2, 172); c.fillText('2. SLIDE & PRESS ON', W / 2, 190); c.fillText('TEST ▼', W / 2, 222);
  }) }));
  panel.position.set(0, 0.1, 0.0375); g.add(panel);
  box(0.026, 0.01, 0.008, std(0x2a2a2a), 0, 0.03, 0.038, g); // TEST
  // linka (lanyard) zwinięta obok
  const pts = []; for (let k = 0; k <= 60; k++) { const t = k / 60, a = t * Math.PI * 5; pts.push(new THREE.Vector3(0.07 + Math.cos(a) * 0.03, 0.004 + t * 0.004, 0.02 + Math.sin(a) * 0.022)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.0025, 5), std(0xffffff)));
  return g;
}

function sart() {
  const g = new THREE.Group();
  const body = cyl(0.038, 0.04, 0.26, std(0xff8a1a, { rough: 0.45 }), 0, 0.13, 0, g, 24);
  body.castShadow = true;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0405, 0.0405, 0.06, 24, 1, true), label(0.25, 0.06, 'AIS-SART', '#ff8a1a', '#111', 'SURVIVOR LOCATOR'));
  band.position.y = 0.15; g.add(band);
  cyl(0.03, 0.038, 0.04, std(0x1e1e1e), 0, 0.28, 0, g, 20);
  cyl(0.012, 0.012, 0.03, std(0xffffff, { transparent: true, opacity: 0.7 }), 0, 0.315, 0, g, 12);
  box(0.016, 0.03, 0.006, std(0xd8352a), 0, 0.2, 0.039, g);
  // maszt teleskopowy leżący obok + linka
  const pole = new THREE.Group();
  for (let k = 0; k < 4; k++) cyl(0.012 - k * 0.002, 0.012 - k * 0.002, 0.16, std(ALU, { metal: 0.9, rough: 0.25 }), 0, k * 0.15, 0, pole, 10);
  pole.rotation.z = Math.PI / 2; pole.rotation.y = 0.4; pole.position.set(0.12, 0.012, 0.05); g.add(pole);
  const lan = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.02, 0.04), new THREE.Vector3(0.06, 0.004, 0.1), new THREE.Vector3(0.14, 0.004, 0.08), new THREE.Vector3(0.18, 0.006, 0.12)]), 24, 0.003, 6), std(0xf2f2f2));
  g.add(lan);
  return g;
}

// radio VHF DSC wbudowane w panel (z mikrofonem na uchwycie i spiralnym kablem)
function vhfRadio() {
  const g = new THREE.Group();
  box(0.24, 0.1, 0.04, std(0x16181c, { rough: 0.5 }), 0, 0, 0, g);
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.045), std(0xffffff, { map: textTex(256, 115, (c, W, H) => { c.fillStyle = '#9fb48a'; c.fillRect(0, 0, W, H); c.fillStyle = '#1f2a18'; c.font = 'bold 74px Arial'; c.fillText('16', 14, 86); c.font = 'bold 22px Arial'; c.fillText('DSC', 150, 34); c.fillText('25W', 150, 64); c.fillText('USA INT', 150, 94); }), emissive: 0x3a4a2a, ei: 0.5 }));
  lcd.position.set(-0.03, 0.01, 0.0205); g.add(lcd);
  for (let k = 0; k < 2; k++) { const kn = cyl(0.012, 0.012, 0.015, std(0x2b2e33), 0.07 + k * 0.035, 0.015, 0.025, g, 16); kn.rotation.x = Math.PI / 2; }
  for (let k = 0; k < 4; k++) box(0.018, 0.01, 0.01, std(0x3a3d43), -0.075 + k * 0.03, -0.03, 0.022, g);
  // przycisk DISTRESS pod czerwoną osłoną
  box(0.03, 0.022, 0.01, std(0xe02d24, { emissive: 0x400000 }), 0.085, -0.03, 0.024, g);
  const cover = box(0.034, 0.026, 0.006, std(0xff3b30, { transparent: true, opacity: 0.6 }), 0.085, -0.03, 0.032, g); cover.rotation.x = -0.2;
  // mikrofon na uchwycie obok
  const mic = new THREE.Group();
  box(0.05, 0.085, 0.03, std(0x1b1d21, { rough: 0.6 }), 0, 0, 0, mic);
  box(0.02, 0.03, 0.01, std(0x2f3237), -0.027, 0.01, 0, mic);
  mic.position.set(0.17, -0.005, 0.02); g.add(mic);
  const coil = [];
  for (let t = 0; t <= 1; t += 0.02) coil.push(new THREE.Vector3(0.17 + Math.cos(t * 60) * 0.008, -0.05 - t * 0.12, 0.02 + Math.sin(t * 60) * 0.008 + t * 0.03));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 200, 0.0025, 5), std(0x111111)));
  return g;
}

function liferaft() {
  const g = new THREE.Group();
  const bag = box(0.62, 0.26, 0.38, std(0xf07c1e, { rough: 0.85 }), 0, 0.13, 0, g);
  bag.geometry = new THREE.BoxGeometry(0.62, 0.26, 0.38, 3, 2, 2);
  for (const x of [-0.18, 0.18]) box(0.04, 0.265, 0.385, std(0x22252b, { rough: 0.9 }), x, 0.13, 0, g);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.12), label(0.26, 0.12, 'LIFERAFT', '#ffffff', '#c8201b', 'ISO 9650 · 6 PERS.'));
  lab.position.set(0, 0.14, 0.191); g.add(lab);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 6, 16, Math.PI), std(0x22252b)); handle.position.set(0, 0.26, 0); g.add(handle);
  // fanga (czerwona linka) wychodząca z torby
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.31, 0.1, 0.1), new THREE.Vector3(0.38, 0.03, 0.14), new THREE.Vector3(0.45, 0.005, 0.05), new THREE.Vector3(0.5, 0.005, -0.08)]), 30, 0.006, 6), std(0xd02020)));
  return g;
}

// kamizelka pneumatyczna złożona „na płasko”: kołnierz w kształcie litery U z prostymi panelami, pas biodrowy z klamrą,
// pas krokowy, linka z uchwytem do ręcznego napełniania, taśmy odblaskowe
function lifejacket(col = 0xd8352a) {
  const g = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(-0.17, -0.4); sh.lineTo(-0.17, 0); sh.absarc(0, 0, 0.17, Math.PI, 0, true); sh.lineTo(0.17, -0.4); sh.quadraticCurveTo(0.17, -0.44, 0.13, -0.44); sh.lineTo(0.08, -0.44); sh.quadraticCurveTo(0.055, -0.44, 0.055, -0.4);
  sh.lineTo(0.055, 0); sh.absarc(0, 0, 0.055, 0, Math.PI, false); sh.lineTo(-0.055, -0.4); sh.quadraticCurveTo(-0.055, -0.44, -0.08, -0.44); sh.lineTo(-0.13, -0.44); sh.quadraticCurveTo(-0.17, -0.44, -0.17, -0.4);
  const yoke = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 18 }), std(col, { rough: 0.85 }));
  yoke.castShadow = true; g.add(yoke);
  for (const x of [-0.112, 0.112]) { box(0.035, 0.12, 0.004, std(0xd9d9d9, { emissive: 0x777777, ei: 0.35, rough: 0.3 }), x, -0.18, 0.045, g); } // odblaski
  box(0.48, 0.04, 0.008, std(0x1b1d22, { rough: 0.9 }), 0, -0.47, 0.02, g); // pas biodrowy
  box(0.05, 0.035, 0.016, std(0x202226, { rough: 0.5 }), 0, -0.47, 0.03, g); // klamra
  const crotch = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.007, 4, 18, Math.PI), std(0x1b1d22)); crotch.position.set(0, -0.49, 0.02); crotch.rotation.z = Math.PI; g.add(crotch);
  const dring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 14), std(ALU, { metal: 0.9, rough: 0.2 })); dring.position.set(0.0, -0.43, 0.04); g.add(dring);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.15, -0.38, 0.04), new THREE.Vector3(0.17, -0.45, 0.04), new THREE.Vector3(0.16, -0.5, 0.03)]), 12, 0.003, 5), std(0x1b1d22)));
  const tog = cyl(0.008, 0.008, 0.03, std(0x2e9d62), 0.16, -0.515, 0.03, g, 8); tog.rotation.z = 0.2; // uchwyt do ręcznego napełnienia
  return g;
}

function extinguisher() {
  const g = new THREE.Group();
  cyl(0.06, 0.06, 0.34, std(0xd42a20, { rough: 0.35, metal: 0.2 }), 0, 0.17, 0, g, 20);
  cyl(0.06, 0.03, 0.05, std(0xd42a20, { rough: 0.35 }), 0, 0.365, 0, g, 20);
  box(0.1, 0.03, 0.03, std(0x202020), 0.02, 0.4, 0, g);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.03, 0.39, 0.02), new THREE.Vector3(0.09, 0.3, 0.05), new THREE.Vector3(0.07, 0.15, 0.06)]), 16, 0.008, 6), std(0x111111));
  g.add(hose);
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0605, 0.0605, 0.12, 20, 1, true, -0.6, 1.2), label(0.13, 0.12, 'ABC', '#f4f1e8', '#c8201b', '2 kg'));
  lab.position.y = 0.17; g.add(lab);
  return g;
}

function flares() {
  const g = new THREE.Group();
  box(0.32, 0.16, 0.2, std(0xf6a21a, { rough: 0.6 }), 0, 0.08, 0, g);
  box(0.33, 0.02, 0.21, std(0xe08a10), 0, 0.16, 0, g);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.08), label(0.2, 0.08, 'FLARES', '#ffffff', '#c8201b', 'SOLAS')); lab.position.set(0, 0.08, 0.101); g.add(lab);
  for (let k = 0; k < 3; k++) { const f = cyl(0.018, 0.018, 0.24, std(k ? 0xd8352a : 0xf07c1e), -0.06 + k * 0.05, 0.185, 0.0, g, 10); f.rotation.z = Math.PI / 2; f.position.y = 0.19 + k * 0.001; }
  return g;
}

function firstAid() {
  const g = new THREE.Group();
  box(0.3, 0.22, 0.1, std(0x2e9d62, { rough: 0.6 }), 0, 0, 0, g);
  box(0.12, 0.035, 0.005, std(0xffffff), 0, 0, -0.052, g);
  box(0.035, 0.12, 0.005, std(0xffffff), 0, 0, -0.052, g);
  return g;
}

// karta procedury: zalaminowana A5 z treścią (czytelną po przybliżeniu)
function procCard(kind) {
  const p = procedureCard(kind), col = { mayday: '#d0312d', pan: '#ef8a17', securite: '#e8c21a' }[kind];
  const tex = textTex(600, 850, (g, W, H) => {
    g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, W, H);
    g.fillStyle = col; g.fillRect(0, 0, W, 120);
    g.fillStyle = kind === 'securite' ? '#1b1f24' : '#ffffff'; g.font = 'bold 76px Arial'; g.textAlign = 'center'; g.fillText(p.title, W / 2, 90);
    g.textAlign = 'left'; g.fillStyle = '#1b1f24';
    const wrap = (txt, y, size, bold, x = 30, maxW = W - 60) => {
      g.font = `${bold ? 'bold ' : ''}${size}px Arial`;
      let line = '';
      for (const w of txt.split(' ')) { const t2 = line ? line + ' ' + w : w; if (g.measureText(t2).width > maxW) { g.fillText(line, x, y); y += size * 1.25; line = w; } else line = t2; }
      if (line) { g.fillText(line, x, y); y += size * 1.25; }
      return y;
    };
    let y = wrap(p.when, 160, 22, false);
    y += 8;
    for (const s of p.steps) y = wrap(s, y, 21, true) + 4;
    g.fillStyle = '#f3efe3'; g.fillRect(20, y - 6, W - 40, p.lines.length * 34 + 20);
    g.fillStyle = '#1b1f24';
    for (const l of p.lines) { y = wrap(l, y + 22, 22, true, 34, W - 80) - 6; }
    y += 22;
    wrap(p.after, y, 18, false);
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.002, 0.21), [std(0xf6f6f6), std(0xf6f6f6), std(0xffffff, { map: tex, rough: 0.3 }), std(0xf6f6f6), std(0xf6f6f6), std(0xf6f6f6)]);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ---------- widok mesy ----------
export class SaloonView {
  constructor(container, { mode = 'safety' } = {}) {
    this.container = container; this.mode = mode;
    const gfx = getSettings().gfx;
    const r = new THREE.WebGLRenderer({ antialias: !!gfx.antialias });
    r.setPixelRatio(Math.max(0.4, Math.min(window.devicePixelRatio || 1, 2) * (gfx.scale || 1)));
    r.shadowMap.enabled = gfx.shadows !== 'off';
    r.shadowMap.type = gfx.shadows === 'basic' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.domElement.style.width = '100%'; r.domElement.style.height = '100%'; r.domElement.style.display = 'block';
    container.appendChild(r.domElement);
    this.renderer = r;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2b2620); this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.02, 30);
    // światło: przytłumione rozproszone, ciepłe lampki, listwy LED pod szafkami i lampka nad stołem nawigacyjnym; dzienne słabo przez luki
    scene.add(new THREE.HemisphereLight(0xffe2c0, 0x3a2a1e, 0.5));
    const sun = new THREE.DirectionalLight(0xdfeeff, 0.55); sun.position.set(1.2, 4, 0.6); sun.target.position.set(0.3, 0.7, 0); sun.castShadow = true;
    sun.shadow.mapSize.set(gfx.shadows === 'basic' ? 1024 : 2048, gfx.shadows === 'basic' ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 8 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    for (const [x, y, z, i, d] of [[0.3, 1.85, 0, 1.6, 2.6], [-0.9, 1.9, -0.45, 0.9, 2.4], [-0.9, 1.9, 0.45, 0.9, 2.4], [1.1, 1.85, 0, 0.7, 2.2], [-1.55, 1.85, -1.0, 0.8, 1.8]]) {
      const p = new THREE.PointLight(0xffb870, i, d, 1.8); p.position.set(x, y, z); scene.add(p);
    }
    for (const sd of [-1, 1]) { const strip = new THREE.PointLight(0xffc98a, 0.5, 1.6, 1.5); strip.position.set(0.2, 1.22, sd * 1.15); scene.add(strip); }
    const reading = new THREE.SpotLight(0xffc27a, 2.2, 2.2, 0.6, 0.6, 1.5); reading.position.set(-1.35, 1.6, 1.05); reading.target.position.set(-1.5, 0.78, 1.1); scene.add(reading, reading.target);
    const B = hullShell(scene);
    this.table = furniture(scene, B);
    this.pickables = [];
    const T = this.table, add = (obj, id, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.pick = id; if (Array.isArray(o.material)) o.material = o.material.map((mm) => mm.clone()); else o.material = o.material.clone(); } }); obj.userData.pick = id; scene.add(obj); this.pickables.push(obj); return obj; };
    this.groups = {};
    // stacja nawigacyjna – radio wbudowane w panel
    this.groups.vhf = add(vhfRadio(), 'vhf', -1.5, 1.08, 1.395, Math.PI);
    this.groups.vhf.rotation.x = -0.06;
    if (mode === 'safety') {
      this.groups.epirb = add(epirb(), 'epirb', -0.12, T.y, -0.33, -0.9);
      this.groups.sart = add(sart(), 'sart', 0.68, T.y, 0.3, -0.3);
      this.groups.cardMayday = add(procCard('mayday'), 'cardMayday', 0.2, T.y + 0.002, -0.31, -Math.PI / 2 + 0.06);
      this.groups.cardPan = add(procCard('pan'), 'cardPan', 0.55, T.y + 0.002, -0.33, -Math.PI / 2 - 0.08);
      this.groups.cardSecurite = add(procCard('securite'), 'cardSecurite', 0.1, T.y + 0.002, 0.31, -Math.PI / 2 + 0.1);
      this.groups.raft = add(liferaft(), 'raft', -1.25, 0, 0.05, 0.15);
      this.groups.jacket = add(lifejacket(0xd8352a), 'jacket', 0.35, 0.535, -1.0, 0.3);
      this.groups.jacket.rotation.x = -Math.PI / 2;
      const j2 = lifejacket(0xe7c21c); j2.position.set(-1.62, 1.55, 0.52); j2.rotation.y = -Math.PI / 2; j2.rotation.x = -0.04;
      j2.traverse((o) => { if (o.isMesh) { o.userData.pick = 'jacket'; o.material = o.material.clone(); o.castShadow = true; } }); j2.userData.pick = 'jacket'; scene.add(j2); this.pickables.push(j2);
      cyl(0.006, 0.006, 0.05, std(0xb9bec6, { metal: 0.9, rough: 0.2 }), -1.63, 1.62, 0.52, scene, 8).rotation.z = Math.PI / 2; // haczyk
      this.groups.extinguisher = add(extinguisher(), 'extinguisher', -1.62, 0.0, -0.5);
      this.groups.flares = add(flares(), 'flares', 0.95, 0.52, 1.0, -0.3);
      this.groups.firstaid = add(firstAid(), 'firstaid', 1.555, 1.2, 0.95, Math.PI / 2);
    }
    if (mode === 'nav') {
      // przybory nawigacyjne na stole: kubek, ołówek, cyrkiel, linijka równoległa
      const mug = new THREE.Group();
      cyl(0.045, 0.04, 0.1, std(0x2f4468, { rough: 0.4 }), 0, 0.05, 0, mug, 20);
      cyl(0.04, 0.04, 0.004, std(0x3b2414), 0, 0.095, 0, mug, 20);
      const hd = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 14), std(0x2f4468)); hd.position.set(0.05, 0.05, 0); mug.add(hd);
      mug.position.set(0.82, T.y, -0.38); scene.add(mug);
      const pencil = cyl(0.004, 0.004, 0.17, std(0xf2c230), 0, 0, 0, null, 6); pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.5; pencil.position.set(-0.22, T.y + 0.005, 0.4); scene.add(pencil);
      const div = new THREE.Group();
      for (const s2 of [-1, 1]) { const leg = cyl(0.003, 0.0015, 0.16, std(ALU, { metal: 0.9, rough: 0.2 }), 0, 0, 0, div, 6); leg.rotation.z = Math.PI / 2 + s2 * 0.25; leg.position.set(0.075, 0.004, s2 * 0.02); }
      div.position.set(0.7, T.y + 0.002, 0.38); div.rotation.y = -0.7; scene.add(div);
      const rule = box(0.38, 0.006, 0.06, std(0xdfe8ee, { transparent: true, opacity: 0.75, rough: 0.2 }), -0.15, T.y + 0.003, -0.42, scene); rule.rotation.y = 0.08;
    }
    // elementy, które mogą zasłaniać widok – własne kopie materiałów, by dało się je przyciemniać pojedynczo
    const pickSet = new Set(); for (const g of this.pickables) g.traverse((o) => pickSet.add(o));
    this.occluders = [];
    scene.traverse((o) => { if (o.isMesh && !pickSet.has(o) && !o.userData.noFade) { o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); o.userData.fade = 1; this.occluders.push(o); } });
    // widok kamery: orbitowanie wokół celu w granicach mesy
    this.cam = { tx: 0.3, ty: 0.78, tz: 0, az: Math.PI * 0.86, el: 0.62, dist: 1.6 };
    if (mode === 'nav') Object.assign(this.cam, { tx: 0.3, ty: 0.74, tz: 0, az: Math.PI / 2, el: 1.38, dist: 1.14 });
    this.want = null;
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2(); this.hoverId = null;
    this.initControls();
    this.resize(); this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(container);
    this.running = true; this.last = performance.now();
    const loop = (now) => { if (!this.running) return; this.update((now - this.last) / 1000); this.last = now; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  // płynny przelot kamery do ustawienia
  flyTo(v) { this.want = { ...this.cam, ...v }; }
  static VIEWS = {
    table: { tx: 0.3, ty: 0.78, tz: 0, az: Math.PI * 0.86, el: 0.62, dist: 1.6 },
    nav: { tx: -1.5, ty: 1.02, tz: 1.25, az: -Math.PI * 0.62, el: 0.28, dist: 1.1 },
    saloon: { tx: 0.1, ty: 0.9, tz: 0, az: Math.PI * 0.98, el: 0.32, dist: 1.85 },
    raft: { tx: -1.25, ty: 0.25, tz: 0.05, az: 0.25, el: 0.55, dist: 1.4 }
  };

  initControls() {
    const el = this.renderer.domElement;
    let drag = null, padUntil = 0;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => {
      this.setMouse(e);
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.moved) this.orbit(dx, dy);
    });
    el.addEventListener('pointerup', (e) => { if (drag && !drag.moved && this.onClick) { this.setMouse(e); this.onClick(this.pick()); } drag = null; });
    el.addEventListener('pointerleave', () => { this.mouseIn = false; });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const now = performance.now(), dx = e.deltaX, dy = e.deltaY;
      if (!e.ctrlKey && e.deltaMode === 0 && (dx !== 0 || Math.abs(dy) < 40 || !Number.isInteger(dy))) padUntil = now + 250;
      if (!e.ctrlKey && now < padUntil) this.orbit(-dx * 0.9, -dy * 0.9);
      else this.zoom(dy * (e.ctrlKey ? 0.012 : 0.0012));
    }, { passive: false });
  }
  orbit(dx, dy) { this.want = null; this.cam.az += dx * 0.005; this.cam.el = Math.max(0.05, Math.min(1.45, this.cam.el + dy * 0.004)); }
  zoom(k) { this.want = null; this.cam.dist = Math.max(0.35, Math.min(2.6, this.cam.dist * Math.exp(Math.max(-0.5, Math.min(0.5, k))))); }
  setMouse(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.mousePx = { x: e.clientX, y: e.clientY }; this.mouseIn = true;
  }
  pick() {
    this.ray.setFromCamera(this.mouse, this.camera);
    const hit = this.ray.intersectObjects(this.pickables, true)[0];
    return hit ? hit.object.userData.pick : null;
  }
  highlight(id) {
    if (id === this.hoverId) return;
    for (const g of this.pickables) {
      const on = g.userData.pick === id;
      g.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) { if (!m.userData.e0) m.userData.e0 = { c: m.emissive.getHex(), i: m.emissiveIntensity }; m.emissive.setHex(on ? 0x5a4a20 : m.userData.e0.c); m.emissiveIntensity = on ? 0.6 : m.userData.e0.i; } });
    }
    this.hoverId = id;
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  update(dt) {
    const c = this.cam;
    if (this.want) {
      const k = Math.min(1, dt * 3);
      let da = this.want.az - c.az; da = Math.atan2(Math.sin(da), Math.cos(da));
      c.az += da * k;
      for (const key of ['tx', 'ty', 'tz', 'el', 'dist']) c[key] += (this.want[key] - c[key]) * k;
    }
    let d = c.dist;
    const pos = () => new THREE.Vector3(c.tx + Math.cos(c.el) * Math.cos(c.az) * d, c.ty + Math.sin(c.el) * d, c.tz + Math.cos(c.el) * Math.sin(c.az) * d);
    // kamera nie wychodzi poza mesę (skracamy odległość)
    let p = pos();
    for (let i = 0; i < 20 && (p.x < -2.1 || p.x > 1.55 || p.y > 1.9 || p.y < 0.1 || Math.abs(p.z) > 1.3); i++) { d *= 0.9; p = pos(); }
    this.camera.position.copy(p);
    this.camera.lookAt(c.tx, c.ty, c.tz);
    this.fadeOccluders(p, new THREE.Vector3(c.tx, c.ty, c.tz), dt);
    if (this.mode === 'nav') { const key = `${c.az.toFixed(4)},${c.el.toFixed(4)},${c.dist.toFixed(4)},${this.renderer.domElement.width}`; if (key === this._lastKey && !this.want) return; this._lastKey = key; }
    if (this.mouseIn && this.onHover) { const id = this.pick(); this.highlight(id); this.onHover(id, this.mousePx); }
    else if (!this.mouseIn && this.hoverId) { this.highlight(null); this.onHover && this.onHover(null); }
    this.renderer.render(this.scene, this.camera);
  }

  // nic nie zasłania widoku: to, co leży między kamerą a celem (i jego okolicą), staje się prawie przezroczyste
  fadeOccluders(cam, target, dt) {
    const hit = new Set(), ray = this._fadeRay || (this._fadeRay = new THREE.Raycaster());
    const right = new THREE.Vector3().subVectors(target, cam).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const pts = [[0, 0], [0.22, 0], [-0.22, 0], [0, 0.15], [0, -0.12]].map(([a, b]) => target.clone().addScaledVector(right, a).add(new THREE.Vector3(0, b, 0)));
    for (const t of pts) {
      const d = t.clone().sub(cam), len = d.length();
      ray.set(cam, d.normalize()); ray.far = Math.max(0, len - 0.06);
      for (const x of ray.intersectObjects(this.occluders, false)) hit.add(x.object);
    }
    const k = Math.min(1, (dt || 0.016) * 8);
    for (const o of this.occluders) {
      const want = hit.has(o) ? 0.12 : 1;
      if (Math.abs(o.userData.fade - want) < 0.005 && want === 1 && o.userData.fade === 1) continue;
      o.userData.fade += (want - o.userData.fade) * k;
      if (Math.abs(o.userData.fade - 1) < 0.01 && want === 1) o.userData.fade = 1;
      for (const m of [].concat(o.material)) { m.transparent = o.userData.fade < 1; m.opacity = o.userData.fade; m.depthWrite = o.userData.fade > 0.6; }
    }
  }

  // pozycja ekranowa punktu sceny (np. do ułożenia kart HTML nad stołem)
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera), r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  destroy() {
    this.running = false;
    this._ro && this._ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
