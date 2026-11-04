// Podręcznik świateł: obracany model statku nocą – ciemna sylwetka kadłuba z obrysem, świecą tylko te światła,
// które są widoczne z miejsca obserwatora (sektory jak w treningu); na linii wody opisy: dziób, rufa, lewa i prawa burta.
// Jeden wspólny renderer WebGL rysuje kolejno wszystkie podglądy do ich własnych płócien 2D (bez limitu kontekstów).
import * as THREE from 'three';
import { COLORS, visibleLights } from '../data/shipLights.js';
import { t } from '../i18n.js';

let R = null;
function renderer() {
  if (R === false) return null;
  if (R) return R;
  try {
    R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    R.setClearColor(0x0b1220, 1);
  } catch (e) { R = false; return null; }
  return R;
}

let DOT = null;
function dotTexture() {
  if (DOT) return DOT;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,0.95)'); g.addColorStop(0.45, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  DOT = new THREE.CanvasTexture(c);
  return DOT;
}
function labelSprite(text) {
  // subtelny napis bez tła; dolna krawędź liter leży na linii wody
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = '700 40px Nunito, sans-serif';
  const w = Math.ceil(x.measureText(text).width) + 12;
  c.width = w; c.height = 52;
  x.font = '700 40px Nunito, sans-serif';
  x.fillStyle = 'rgba(176, 192, 220, 0.62)'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillText(text, w / 2, 44);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, depthWrite: false, transparent: true }));
  sp.center.set(0.5, 8 / 52); // punkt zaczepienia: linia bazowa tekstu
  sp.userData.aspect = w / 52; sp.renderOrder = 40;
  return sp;
}
const hullType = (v) => (/sail/i.test(v.id) ? 'yacht' : /trawl|fish/i.test(v.id) ? 'trawler' : /tow|pilot/i.test(v.id) || /^power$/.test(v.id) ? 'tug' : 'ship');
const SIDE_NAME = (rel) => { const a = Math.abs(rel); return a <= 22.5 ? t('od dziobu') : a >= 157.5 ? t('od rufy') : rel > 0 ? t('z prawej burty') : t('z lewej burty'); };

// kadłub w rzucie z góry (dziób w +x), wyciągnięty w górę na wysokość wolnej burty
function hullBody(L, B, H, bowK = 0.22, x0 = 0) {
  const sh = new THREE.Shape(), hl = L / 2, hb = B / 2, xb = hl - L * bowK;
  sh.moveTo(-hl, -hb * 0.9); sh.lineTo(xb, -hb); sh.quadraticCurveTo(hl - L * bowK * 0.3, -hb * 0.7, hl, 0); sh.quadraticCurveTo(hl - L * bowK * 0.3, hb * 0.7, xb, hb); sh.lineTo(-hl, hb * 0.9); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: false, curveSegments: 8 });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo); m.position.x = x0; return m;
}
const box = (x0, x1, y0, y1, w) => { const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), y1 - y0, w)); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); return m; };
const pole = (x, y0, y1, z = 0, r = 0.16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, Math.max(0.2, y1 - y0), 8)); m.position.set(x, (y0 + y1) / 2, z); return m; };
function simpleModel(v, lights, Lm) {
  const yacht = /sail/i.test(v.id), meshes = [], lines = [];
  const B = yacht ? 3.4 : Math.min(26, Math.max(5, Lm * 0.14)), hf = yacht ? 0.9 : Math.min(6, Math.max(1.6, Lm * 0.035));
  const own = lights.filter((l) => l.x >= -Lm / 2 - 20), towed = lights.filter((l) => l.x < -Lm / 2 - 20);
  meshes.push(hullBody(Lm, B, hf, yacht ? 0.32 : 0.2));
  const out = lights.map((l) => ({ ...l }));
  const mine = out.filter((l) => l.x >= -Lm / 2 - 20);
  // „wysokość konstrukcji” wzdłuż statku: pokład, a pod światłami burtowymi – nadbudówka (burtowe świecą z jej ścian)
  const tops = []; // [x0, x1, y]
  for (const l of mine) if (l.s === 'port' || l.s === 'stbd') {
    l.z = Math.sign(l.z || 1) * (B / 2 + 0.05);
    if (yacht) { l.y = hf + 0.2; continue; }
    if (l.y > hf + 0.4 && !tops.some((q) => Math.abs((q[0] + q[1]) / 2 - l.x) < 2)) {
      const len = Math.min(Lm * 0.28, 32), x1 = Math.min(Lm / 2 - Lm * 0.2, l.x + 1.2), x0 = x1 - len;
      meshes.push(box(x0, x1, hf, l.y + 0.6, B * 0.98)); tops.push([x0, x1, l.y + 0.6]);
    }
  }
  if (yacht) { for (const l of mine) if (l.s === 'stern') { l.y = hf + 0.25; l.x = -Lm / 2 + 0.1; } meshes.push(box(-Lm * 0.2, Lm * 0.12, hf, hf + 0.6, B * 0.55)); }
  const topAt = (x) => tops.reduce((y, q) => (x >= q[0] - 0.2 && x <= q[1] + 0.2 ? Math.max(y, q[2]) : y), hf);
  // światło rufowe na pawęży
  for (const l of mine) if (l.s === 'stern' || l.s === 'tow') l.x = -Lm / 2 + 0.3;
  // maszty: kolumny świateł w osi statku (i rejki do świateł odsuniętych na bok)
  const cols = new Map();
  for (const l of mine) {
    if (l.s === 'port' || l.s === 'stbd' || l.c === 'deck') continue;
    const k = Math.round(l.x);
    const c = cols.get(k) || { x: l.x, top: 0 }; c.top = Math.max(c.top, l.y); cols.set(k, c);
    if (Math.abs(l.z) >= 0.6) lines.push([[l.x, l.y, 0], [l.x, l.y, l.z]]); // rejka / wysięgnik do światła z boku
  }
  if (yacht) { const mx = Lm * 0.08, top = Math.max(Lm * 1.1, ...[...cols.values()].map((c) => c.top)); cols.set('mast', { x: mx, top }); lines.push([[mx, top - 0.4, 0], [Lm / 2 - 0.3, hf, 0]], [[mx, top - 0.4, 0], [-Lm / 2 + 0.2, hf + 0.4, 0]], [[mx, hf + 1.4, 0], [-Lm * 0.38, hf + 1.2, 0]]); }
  for (const c of cols.values()) { const base = topAt(c.x); if (c.top > base + 0.25) meshes.push(pole(c.x, base, c.top + 0.35, 0, yacht ? 0.08 : Math.min(0.35, 0.12 + Lm * 0.002))); }
  // jednostki holowane: barki od pierwszego do ostatniego światła holowanego, dzielone na odcinki ok. 70 m
  if (towed.length) {
    const tl = out.filter((l) => l.x < -Lm / 2 - 20), xF = Math.max(...tl.map((l) => l.x)) + 4, xA = Math.min(...tl.map((l) => l.x)) - 2;
    const bw = Math.max(8, 2 * Math.max(...tl.filter((l) => l.s === 'port' || l.s === 'stbd').map((l) => Math.abs(l.z)), 4)), bh = 1.5;
    const n = Math.max(1, Math.round((xF - xA) / 75)), seg = (xF - xA) / n;
    for (let i = 0; i < n; i++) { const a = xF - i * seg, b = a - seg + 3; meshes.push(box(b, a, 0, bh, bw)); }
    for (const l of tl) { if (l.s === 'port' || l.s === 'stbd') l.z = Math.sign(l.z) * (bw / 2 + 0.05); if (l.s === 'stern') l.x = xA + 0.2; if (l.y > bh + 0.3 && Math.abs(l.z) < 0.6) meshes.push(pole(l.x, bh, l.y + 0.3, 0, 0.12)); }
    lines.push([[-Lm / 2, hf * 0.8, 0], [xF, bh * 0.8, 0]]); // hol
  }
  return { meshes, lines, lights: out, B };
}

// zwraca element z podglądem albo null (brak WebGL)
export function lightsViewer(v, lights0, Lm) {
  let lights = lights0;
  if (!renderer()) return null;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1220);
  scene.add(new THREE.HemisphereLight(0x5a6c90, 0x05080f, 0.55));
  const moon = new THREE.DirectionalLight(0x9fb4dd, 0.6); moon.position.set(-40, 60, 30); scene.add(moon);
  // woda
  const water = new THREE.Mesh(new THREE.CircleGeometry(2000, 48), new THREE.MeshBasicMaterial({ color: 0x0f1c2e }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.05; scene.add(water);
  // uproszczony model zbudowany ze świateł: kadłub, nadbudówka pod światłami burtowymi, maszty pod kolumnami świateł
  const ship = new THREE.Group(); scene.add(ship);
  const shade = new THREE.MeshStandardMaterial({ color: 0x1f2838, roughness: 1, metalness: 0 });
  const edge = new THREE.LineBasicMaterial({ color: 0x4d5f80, transparent: true, opacity: 0.6 });
  const model = simpleModel(v, lights, Lm);
  lights = model.lights;
  for (const m of model.meshes) {
    m.traverse((o) => { if (o.isMesh) { o.material = shade; const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), edge); o.add(e); } });
    ship.add(m);
  }
  for (const ln of model.lines) ship.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ln.map(([x, y, z]) => new THREE.Vector3(x, y, z))), edge));
  // światła
  const sprites = lights.map((l) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: COLORS[l.c], transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    sp.position.set(l.x, l.y, l.z); sp.renderOrder = 30; ship.add(sp);
    return { l, sp };
  });
  // kadr: kadłub i wszystkie światła
  const xs = lights.map((l) => l.x).concat([-Lm / 2, Lm / 2]), ys = lights.map((l) => l.y).concat([0, 4]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = Math.max(...ys) * 0.42;
  const rad = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) * 1.3, 18) / 2;
  const B = model.B;
  // opisy na linii wody
  const labels = [[t('DZIÓB'), Lm / 2 + rad * 0.07, 0], [t('RUFA'), -Lm / 2 - rad * 0.07, 0], [t('LEWA BURTA'), 0, -(B / 2 + rad * 0.16)], [t('PRAWA BURTA'), 0, B / 2 + rad * 0.16]];
  const labelSps = [];
  for (const [txt, x, z] of labels) { const sp = labelSprite(txt), s = rad * 0.06; sp.scale.set(s * sp.userData.aspect, s, 1); sp.position.set(x, 0, z); sp.userData.n = [Math.sign(x), Math.sign(z)]; ship.add(sp); labelSps.push(sp); }
  for (const it of sprites) it.sp.scale.setScalar(rad * (it.l.c === 'deck' ? 0.035 : 0.07));

  const cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.5, 5000);
  const st = { az: 40 * Math.PI / 180, el: 12 * Math.PI / 180 }; // azymut od dziobu (w stronę prawej burty), wysokość oka
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const cap = document.createElement('div'); cap.className = 'lv-cap';
  const wrap = document.createElement('div'); wrap.className = 'lv-wrap';
  const hint = document.createElement('div'); hint.className = 'lv-hint'; hint.textContent = t('⟲ przeciągnij, aby obrócić');
  wrap.append(canvas, cap, hint);

  let raf = 0;
  const draw = () => {
    raf = 0;
    const w = Math.max(200, wrap.clientWidth || 520), hh = Math.round(w * 0.56), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); canvas.style.height = `${hh}px`; }
    const r = renderer(); if (!r) return;
    r.setPixelRatio(dpr); r.setSize(w, hh, false);
    cam.aspect = w / hh; cam.updateProjectionMatrix();
    // odległość tak, by statek z opisami wypełnił kadr w poziomie (i zmieścił się w pionie)
    const vt = Math.tan((cam.fov * Math.PI) / 360), ht = vt * cam.aspect;
    const topY = Math.max(...ys), half = Math.max(topY - cy, cy) * 1.25 + 1;
    const dist = Math.max((rad * 1.32) / ht, half / vt);
    cam.position.set(cx + Math.cos(st.az) * Math.cos(st.el) * dist, cy + Math.sin(st.el) * dist, Math.sin(st.az) * Math.cos(st.el) * dist);
    cam.lookAt(cx, cy, 0);
    // kąt obserwatora od dziobu (+ w prawo) – decyduje, które światła widać
    const rel = (Math.atan2(cam.position.z, cam.position.x - cx) * 180) / Math.PI;
    const vis = new Set(visibleLights(lights, rel));
    for (const { l, sp } of sprites) sp.visible = vis.has(l);
    // opisy tylko stron zwróconych do patrzącego (napis z dalszej burty nie prześwituje przez kadłub)
    const ra = (rel * Math.PI) / 180;
    for (const sp of labelSps) sp.visible = Math.cos(ra) * sp.userData.n[0] + Math.sin(ra) * sp.userData.n[1] > -0.2;
    r.render(scene, cam);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(r.domElement, 0, 0, canvas.width, canvas.height);
    cap.textContent = `${t('Widzisz statek')} ${SIDE_NAME(rel)}`;
  };
  const req = () => { if (!raf) raf = requestAnimationFrame(draw); };
  // obracanie: przeciąganie myszą/palcem; kółko nie zmienia widoku (przewija stronę)
  let drag = null;
  wrap.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; wrap.setPointerCapture(e.pointerId); wrap.classList.add('drag'); hint.style.opacity = '0'; });
  wrap.addEventListener('pointermove', (e) => {
    if (!drag) return;
    st.az += (e.clientX - drag.x) * 0.012; st.el = Math.max(0.03, Math.min(1.1, st.el + (e.clientY - drag.y) * 0.006));
    drag = { x: e.clientX, y: e.clientY }; req();
  });
  const up = () => { drag = null; wrap.classList.remove('drag'); };
  wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
  // pierwszy rysunek, gdy podgląd pojawi się na ekranie (i przy zmianie szerokości)
  const io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) req(); });
  io.observe(wrap);
  new ResizeObserver(() => req()).observe(wrap);
  return wrap;
}
