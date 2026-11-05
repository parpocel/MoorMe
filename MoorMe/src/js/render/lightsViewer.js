// Podręcznik świateł: obracany model statku nocą – ciemna sylwetka kadłuba z obrysem, świecą tylko te światła,
// które są widoczne z miejsca obserwatora (sektory jak w treningu). Wersja dzienna: jasne tło i czarne znaki dzienne.
// Jeden wspólny renderer WebGL rysuje kolejno wszystkie podglądy do ich własnych płócien 2D (bez limitu kontekstów).
import * as THREE from 'three';
import { COLORS, visibleLights } from '../data/shipLights.js';
import { t } from '../i18n.js';
import { shapeMesh } from '../ui/lightsUI.js';

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
const pole = (x, y0, y1, z = 0, r = 0.16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, Math.max(0.2, y1 - y0), 8)); m.position.set(x, (y0 + y1) / 2, z); m.userData.noEdge = true; return m; }; // maszt bez obrysu (obrys walca wyglądał jak dwa maszty)
function simpleModel(v, lights, Lm) {
  const yacht = /sail/i.test(v.id), meshes = [], lines = [];
  const small = Lm < 9, B = yacht ? 3.4 : small ? Lm * 0.36 : Math.min(26, Math.max(5, Lm * 0.14)), hf = yacht ? 0.9 : small ? 0.5 : Math.min(6, Math.max(1.6, Lm * 0.035));
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
  if (yacht) {
    for (const l of mine) if (l.s === 'stern') { l.y = hf + 0.25; l.x = -Lm / 2 + 0.1; }
    // jeden maszt: światła na topie (np. czerwone nad zielonym) siedzą na nim
    for (const l of mine) if (l.s !== 'port' && l.s !== 'stbd' && l.s !== 'stern' && Math.abs(l.z) < 0.6) l.x = Lm * 0.08;
    meshes.push(box(-Lm * 0.2, Lm * 0.12, hf, hf + 0.6, B * 0.55));
  }
  // każdy statek ma choć małą nadbudówkę (sterówkę), także gdy światła burtowe są na kadłubie
  if (!yacht && !tops.length) {
    const hh = small ? 0.7 : Math.max(2, Math.min(7, Lm * 0.05)), x1 = small ? -Lm * 0.05 : -Lm * 0.12, x0 = small ? -Lm * 0.3 : -Lm * 0.36;
    meshes.push(box(x0, x1, hf, hf + hh, B * (small ? 0.55 : 0.8))); tops.push([x0, x1, hf + hh]);
  }
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
  if (yacht) { const mx = Lm * 0.08, top = Math.max(Lm * 1.1, ...[...cols.values()].map((c) => c.top)); cols.clear(); cols.set('mast', { x: mx, top }); lines.push([[mx, top - 0.4, 0], [Lm / 2 - 0.3, hf, 0]], [[mx, top - 0.4, 0], [-Lm / 2 + 0.2, hf + 0.4, 0]], [[mx, hf + 1.4, 0], [-Lm * 0.38, hf + 1.2, 0]]); }
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
  // sieci: włok za rufą trawlera; u rybaka – sieci z boku, po stronie wskazanej światłem narzędzi połowowych
  const nets = [], floats = [];
  if (/trawl/i.test(v.id) && !/mine/i.test(v.id)) {
    const x0 = -Lm / 2, xe = x0 - 2.4 * Lm, spread = Math.max(8, Lm * 0.45);
    for (const sg of [-1, 1]) nets.push([[x0, hf * 0.7, sg * B * 0.3], [xe, 0.05, sg * spread]]);
    nets.push([[xe, 0.05, -spread], [xe - Lm * 0.5, 0.05, -spread * 0.35], [xe - Lm * 0.9, 0.05, 0], [xe - Lm * 0.5, 0.05, spread * 0.35], [xe, 0.05, spread]]);
    nets.push([[xe, 0.05, -spread], [xe, 0.05, spread]]);
  } else if (/fishing/i.test(v.id)) {
    const gearL = mine.find((l) => l.s === 'all' && Math.abs(l.z) >= 0.6);
    const sg = gearL ? Math.sign(gearL.z) : 1, len = (gearL ? 3.2 : 1.6) * Lm;
    const pts = Array.from({ length: 13 }, (_, i) => { const k = i / 12; return [-k * Lm * 0.5, 0.05, sg * (B / 2 + 0.5 + k * len)]; });
    nets.push(pts);
    for (let i = 1; i < pts.length; i++) floats.push(pts[i]);
  }
  // najwyższy punkt konstrukcji (np. top masztu jachtu) – do kadrowania
  const topY = Math.max(hf, ...tops.map((q) => q[2]), ...[...cols.values()].map((c) => c.top + 0.35));
  return { meshes, lines, lights: out, B, nets, floats, topY };
}

// zwraca element z podglądem albo null (brak WebGL)
export function lightsViewer(v, lights0, Lm, opts = {}) {
  const day = !!opts.day;
  // znaki dzienne: przeskalowane (jak przez lornetkę), żeby były czytelne przy długim kadłubie; maszty budowane pod nimi
  const kS = day ? Math.max(1.6, Math.min(5, Lm / 11)) : 1;
  let shapes = [];
  if (day) {
    const sh = opts.shapes || [], own = sh.filter((q) => q.x > -Lm / 2 - 20), base = own.length ? Math.min(...own.map((q) => q.y)) : 0;
    shapes = sh.map((q) => ({ ...q, y: q.x > -Lm / 2 - 20 ? base + (q.y - base) * kS : q.y, z: q.z * kS }));
    lights0 = shapes.map((q) => ({ x: q.x, y: q.y + 0.4 * kS, z: q.z, s: 'all', c: 'shape', shape: q }));
  }
  let lights = lights0;
  if (!renderer()) return null;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(day ? 0xcfe6f4 : 0x0b1220);
  scene.add(day ? new THREE.HemisphereLight(0xffffff, 0x8aa0b0, 1.1) : new THREE.HemisphereLight(0x5a6c90, 0x05080f, 0.55));
  const moon = new THREE.DirectionalLight(day ? 0xffffff : 0x9fb4dd, day ? 1.2 : 0.6); moon.position.set(-40, 60, 30); scene.add(moon);
  // woda
  const water = new THREE.Mesh(new THREE.CircleGeometry(2000, 48), new THREE.MeshBasicMaterial({ color: day ? 0x6fa8c8 : 0x0f1c2e }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.05; scene.add(water);
  // uproszczony model zbudowany ze świateł: kadłub, nadbudówka pod światłami burtowymi, maszty pod kolumnami świateł;
  // v.pair – dwa trawlery trałujące w parze (wspólny włok, reflektory skierowane do przodu i na siebie)
  const ship = new THREE.Group(); scene.add(ship);
  const shade = new THREE.MeshStandardMaterial({ color: day ? 0x9aa3ad : 0x1f2838, roughness: 1, metalness: 0, flatShading: true });
  const edge = new THREE.LineBasicMaterial({ color: day ? 0x4a525c : 0x4d5f80, transparent: true, opacity: 0.6 });
  const netMat = new THREE.LineBasicMaterial({ color: day ? 0x3c4a5c : 0x7f93b8, transparent: true, opacity: 0.55 });
  const PL = (pts, m, z0 = 0) => ship.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z + z0))), m));
  const D = Math.max(60, Lm * 2.6), offs = v.pair ? [-D / 2, D / 2] : [0];
  let model = null;
  const all = [], extra = [];
  for (const z0 of offs) {
    model = simpleModel(v.pair ? { ...v, id: 'pairUnit' } : v, lights0, Lm);
    for (const m of model.meshes) {
      m.traverse((o) => { if (o.isMesh && !o.userData.done) { o.material = shade; o.userData.done = true; if (!o.userData.noEdge) o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), edge)); } });
      m.position.z += z0; ship.add(m);
    }
    for (const ln of model.lines) PL(ln, edge, z0);
    for (const ln of model.nets) { PL(ln, netMat, z0); for (const p of ln) extra.push([p[0], p[2] + z0]); }
    for (const f of model.floats) { const b = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.35, Lm * 0.012), 8, 6), new THREE.MeshBasicMaterial({ color: 0x9fb0cf })); b.position.set(f[0], f[1], f[2] + z0); ship.add(b); }
    for (const l of model.lights) all.push({ ...l, z: l.z + z0 });
  }
  lights = all;
  if (v.pair) {
    // wspólny włok za obiema rufami
    const x0 = -Lm / 2, xe = x0 - 2.2 * Lm;
    for (const z0 of offs) PL([[x0, 1, z0], [xe, 0.05, z0 * 0.25]], netMat);
    PL([[xe, 0.05, offs[0] * 0.25], [xe - Lm * 0.6, 0.05, 0], [xe, 0.05, offs[1] * 0.25]], netMat);
    extra.push([xe - Lm * 0.6, 0]);
    // reflektory: snop do przodu i w stronę drugiego statku
    for (const z0 of offs) {
      const src = new THREE.Vector3(Lm * 0.15, Math.min(...lights0.filter((l) => l.s === 'port').map((l) => l.y)) + 1.5, z0);
      const dir = new THREE.Vector3(0.75, -0.06, -Math.sign(z0) * 0.66).normalize(), len = D * 0.95;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(len * 0.16, len, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cone.geometry.translate(0, -len / 2, 0); // wierzchołek w reflektorze
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      cone.position.copy(src); ship.add(cone);
      lights.push({ x: src.x, y: src.y, z: src.z, c: 'white', s: 'all', beam: true });
    }
  }
  // światła (nocą) albo znaki dzienne (w dzień); oświetlenie pokładu – ciepła poświata na pokładzie i drobne punkty
  const sprites = [];
  if (day) {
    // pozycje z modelu (np. na jachcie znak przeniesiony na jedyny maszt)
    for (const l of lights) if (l.shape) { const q = l.shape, m = shapeMesh(q.k); m.scale.setScalar(kS); m.position.set(l.x, l.y - 0.4 * kS, l.z); if (q.k === 'pennantR' || m.userData.face) m.rotation.y = Math.PI / 2; ship.add(m); }
  } else {
    for (const l of lights) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: COLORS[l.c], transparent: true, depthWrite: false, depthTest: l.c === 'deck', blending: THREE.AdditiveBlending, toneMapped: false, opacity: l.c === 'deck' ? 0.8 : 1 }));
      sp.position.set(l.x, l.y, l.z); sp.renderOrder = 30; ship.add(sp);
      sprites.push({ l, sp });
    }
    const deck = lights.filter((l) => l.c === 'deck');
    if (deck.length) {
      const B0 = model.B, hfD = Math.min(...deck.map((l) => l.y)) - 0.4;
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(Lm * 0.9, B0 * 0.85), new THREE.MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.rotation.x = -Math.PI / 2; glow.position.set(0, Math.max(0.3, hfD), 0); ship.add(glow);
    }
  }
  // kadr: kadłub(y), światła i sieci
  const xs = lights.map((l) => l.x).concat([-Lm / 2, Lm / 2], extra.map((p) => p[0])), ys = lights.map((l) => l.y).concat([0, 4, model.topY]);
  const zs = lights.map((l) => l.z).concat(extra.map((p) => p[1]), [0]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = Math.max(...ys) * 0.42, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const rad = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), Math.max(...ys) * 1.3, 18) / 2;
    const cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.5, 5000);
  const st = { az: 40 * Math.PI / 180, el: (v.pair ? 22 : 12) * Math.PI / 180, zoom: 1, tx: 0, ty: 0, tz: 0 }; // azymut od dziobu (w stronę prawej burty), wysokość oka, przybliżenie, przesunięcie
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const cap = document.createElement('div'); cap.className = 'lv-cap';
  const wrap = document.createElement('div'); wrap.className = day ? 'lv-wrap day' : 'lv-wrap';
  const hint = document.createElement('div'); hint.className = 'lv-hint'; hint.textContent = t('⟲ obrót · ✋ przesuwanie · ＋/－ przybliżenie');
  const zb = document.createElement('div'); zb.className = 'lv-zoom';
  const zbtn = (txt, f) => { const b = document.createElement('button'); b.textContent = txt; b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', (e) => { e.stopPropagation(); f(); req(); }); zb.appendChild(b); };
  let hand = false;
  const modeBtn = document.createElement('button'); modeBtn.title = t('Obracanie / przesuwanie'); modeBtn.textContent = '⟲';
  modeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  modeBtn.addEventListener('click', (e) => { e.stopPropagation(); hand = !hand; modeBtn.textContent = hand ? '✋' : '⟲'; modeBtn.classList.toggle('on', hand); wrap.classList.toggle('hand', hand); });
  zb.appendChild(modeBtn);
  zbtn('＋', () => { st.zoom = Math.max(0.06, st.zoom / 1.4); }); zbtn('－', () => { st.zoom = Math.min(2.5, st.zoom * 1.4); }); zbtn('⌂', () => { st.zoom = 1; st.tx = st.ty = st.tz = 0; });
  wrap.append(canvas, cap, hint, zb);

  let raf = 0;
  const lastTgt = new THREE.Vector3();
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
    const dist = Math.max((rad * 1.32) / ht, half / vt) * st.zoom;
    const X = cx + st.tx, Y = Math.max(0.5, cy * Math.min(1, 0.4 + st.zoom) + st.ty), Z = cz + st.tz;
    cam.position.set(X + Math.cos(st.az) * Math.cos(st.el) * dist, Y + Math.sin(st.el) * dist, Z + Math.sin(st.az) * Math.cos(st.el) * dist);
    cam.lookAt(X, Y, Z); lastTgt.set(X, Y, Z);
    // światła o stałej wielkości na ekranie – po przybliżeniu bliskie światła (np. holownika) się rozdzielają
    for (const it of sprites) it.sp.scale.setScalar(it.sp.position.distanceTo(cam.position) * (it.l.c === 'deck' ? 0.006 : 0.022));
    // kąt obserwatora od dziobu (+ w prawo) – decyduje, które światła widać
    // kierunek obserwatora względem samego statku (jego środka), nie środka kadru
    const rel = (Math.atan2(cam.position.z, cam.position.x) * 180) / Math.PI;
    // widoczność liczona z miejsca każdego światła (przy długim zestawie środek kadru leży daleko od holownika)
    for (const { l, sp } of sprites) {
      if (l.beam) { sp.visible = true; continue; }
      const a = (Math.atan2(cam.position.z - l.z, cam.position.x - l.x) * 180) / Math.PI;
      sp.visible = visibleLights([l], a).length > 0;
    }
    r.render(scene, cam);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(r.domElement, 0, 0, canvas.width, canvas.height);
    cap.textContent = `${t('Widzisz statek')} ${SIDE_NAME(rel)}`;
  };
  const req = () => { if (!raf) raf = requestAnimationFrame(draw); };
  // obracanie: przeciąganie myszą/palcem; kółko nie zmienia widoku (przewija stronę)
  let drag = null;
  wrap.addEventListener('contextmenu', (e) => e.preventDefault());
  wrap.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, pan: hand || e.button === 2 || e.shiftKey }; wrap.setPointerCapture(e.pointerId); wrap.classList.add('drag'); hint.style.opacity = '0'; });
  wrap.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.pan) {
      // przesuwanie celu kamery w płaszczyźnie ekranu
      const k = rad * st.zoom * 0.004, rx = Math.sin(st.az), rz = -Math.cos(st.az);
      st.tx -= dx * k * rx; st.tz -= dx * k * rz; st.ty += dy * k;
    } else { st.az += dx * 0.012; st.el = Math.max(0.03, Math.min(1.3, st.el + dy * 0.006)); }
    drag = { ...drag, x: e.clientX, y: e.clientY }; req();
  });
  // kółko myszy nie przybliża – przewija stronę; przybliżanie przyciskami ＋/－
  const up = () => { drag = null; wrap.classList.remove('drag'); };
  wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
  // pierwszy rysunek, gdy podgląd pojawi się na ekranie (i przy zmianie szerokości)
  const io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) req(); });
  io.observe(wrap);
  new ResizeObserver(() => req()).observe(wrap);
  return wrap;
}
