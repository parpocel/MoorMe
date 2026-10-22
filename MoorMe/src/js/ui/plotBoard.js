// Mapka do kreślenia w zadaniach nawigacyjnych: ląd, izobaty, głębokości i róża kompasowa jak na mapie morskiej,
// a do tego narzędzia: linia, namiar przez punkt, kurs i droga, trójkąt nawigacyjny, linijka równoległa, cyrkiel, okrąg.
// Na brzegach podziałka szerokości (lewa/prawa) i długości (góra/dół) w stopniach i minutach.
// Mapa „płaska”: 1' szerokości = 1 Mm, 1' długości = cos φ Mm (jak w obliczeniach zadań).
import { h } from './dom.js';
import { t as tr } from '../i18n.js';
import { rng } from '../math.js';

const D2R = Math.PI / 180;
const W0 = 740, H0 = 520, M = 54; // domyślny rozmiar płótna i szerokość marginesu ze skalą
const pad2 = (n) => String(n).padStart(2, '0');
const norm = (a) => ((a % 360) + 360) % 360;
const fmtMin = (m) => (Math.abs(m - Math.round(m)) < 1e-6 ? `${pad2(Math.round(m))}'` : `${m.toFixed(1).replace('.', ',')}'`);
const dmParts = (v) => { const a = Math.abs(v) + 1e-9, d = Math.floor(a); return [d, (a - d) * 60]; };
const fmtLat = (lat) => { const [d, m] = dmParts(lat); return `${d}°${m.toFixed(1).replace('.', ',')}'${lat >= 0 ? 'N' : 'S'}`; };
const fmtLon = (lon) => { const [d, m] = dmParts(lon); return `${String(d).padStart(3, '0')}°${m.toFixed(1).replace('.', ',')}'${lon >= 0 ? 'E' : 'W'}`; };
const deg3 = (a) => `${String(Math.round(norm(a)) % 360).padStart(3, '0')}°`;
const nm2 = (v) => v.toFixed(2).replace('.', ',');

// przecięcie dwóch prostych / odcinków (punkt + kierunek jednostkowy) w układzie mil morskich
function lineX(a, b) {
  const det = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(det) < 1e-9) return [];
  const s = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / det, q = ((b.x - a.x) * a.dy - (b.y - a.y) * a.dx) / det;
  if ((a.kind === 'seg' && (s < -1e-6 || s > a.len + 1e-6)) || (b.kind === 'seg' && (q < -1e-6 || q > b.len + 1e-6))) return [];
  return [{ x: a.x + a.dx * s, y: a.y + a.dy * s }];
}
function lineCircle(l, c) {
  const fx = l.x - c.x, fy = l.y - c.y, b = fx * l.dx + fy * l.dy, cc = fx * fx + fy * fy - c.r * c.r, disc = b * b - cc;
  if (disc < 0) return [];
  const out = [];
  for (const t of [-b - Math.sqrt(disc), -b + Math.sqrt(disc)]) if (l.kind !== 'seg' || (t >= -1e-6 && t <= l.len + 1e-6)) out.push({ x: l.x + l.dx * t, y: l.y + l.dy * t });
  return out;
}
function circleCircle(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  if (d < 1e-9 || d > a.r + b.r || d < Math.abs(a.r - b.r)) return [];
  const l = (a.r * a.r - b.r * b.r + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, a.r * a.r - l * l)), mx = a.x + (dx * l) / d, my = a.y + (dy * l) / d;
  return [{ x: mx + (-dy * hh) / d, y: my + (dx * hh) / d }, { x: mx - (-dy * hh) / d, y: my - (dx * hh) / d }];
}
const inPoly = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
const segDist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)); return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t); };
const polyDist = (poly, p) => (inPoly(poly, p.x, p.y) ? 0 : Math.min(...poly.map((q, i) => segDist(p, q, poly[(i + 1) % poly.length]))));

export class PlotBoard {
  /** plot: { pts: [{ label, lat, lon, light? }], sol: { lines: [{ p, brg }], segs: [{ p, brg, dist }], point }, variation?, seed? } */
  /** opts.size – { w, h }: rozmiar płótna (np. mapa na cały ekran); domyślnie 740 × 520 */
  constructor(plot, opts = {}) {
    this.plot = plot;
    this.fill = !!opts.size;
    this.W = Math.round(opts.size ? Math.max(560, opts.size.w) : W0);
    this.H = Math.round(opts.size ? Math.max(380, opts.size.h) : H0);
    this.offY = opts.offset || 0; // ile pikseli wysokości okna zajmuje reszta interfejsu (przy zmianie rozmiaru okna mapa zachowuje proporcje)
    this.items = []; // { kind: 'line'|'seg'|'pt'|'circle'|'meas', ... }
    this.vec = plot.mode === 'vector'; // trójkąt prędkości: wektory w węzłach odkładane dla 1 h (1 kn = 1 Mm)
    this.unit = this.vec ? 'kn' : 'Mm';
    this.tool = plot.sol.segs || plot.sol.vectors ? 'course' : 'bearing';
    this.showSol = false;
    this.hover = null; this.drag = null; this.plotter = null; this.sel = null;
    // zasięg mapy: obiekty + rozwiązanie z zapasem, proporcje płótna
    const all = [...plot.pts, plot.sol.point, ...(plot.sol.vectors || []).flatMap((v) => [v.from, v.to])];
    const lat0 = all.reduce((s, p) => s + p.lat, 0) / all.length;
    this.cl = Math.cos(lat0 * D2R);
    const xs = all.map((p) => p.lon * 60 * this.cl), ys = all.map((p) => p.lat * 60);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const iw = this.W - 2 * M, ih = this.H - 2 * M;
    const span = Math.max((Math.max(...xs) - Math.min(...xs)) / iw, (Math.max(...ys) - Math.min(...ys)) / ih) * 1.5;
    this.k = 1 / Math.max(span, 5 / ih); // px na milę (co najmniej ok. 5 Mm na wysokość)
    this.cx = cx; this.cy = cy;
    this.k0 = this.k; this.cx0 = cx; this.cy0 = cy; this.zoom = 1; // widok wyjściowy – powiększenie nie mniejsze niż 1×
    this.genChart();
    this.build();
  }

  // lat/lon <-> mile (x na wschód, y na północ) <-> piksele
  toNm(p) { return { x: p.lon * 60 * this.cl, y: p.lat * 60 }; }
  toLL(n) { return { lat: n.y / 60, lon: n.x / 60 / this.cl }; }
  px(n) { return { x: this.W / 2 + (n.x - this.cx) * this.k, y: this.H / 2 - (n.y - this.cy) * this.k }; }
  // nowy element gracza w wybranym kolorze
  add(it) { it.color = this.color; this.items.push(it); }
  static COLORS = [['#2f4468', 'Granatowy'], ['#d0302a', 'Czerwony'], ['#1f7fd1', 'Niebieski'], ['#e07b16', 'Pomarańczowy'], ['#8e3fb5', 'Fioletowy'], ['#1b1f24', 'Czarny']];
  nm(px, py) { return { x: this.cx + (px - this.W / 2) / this.k, y: this.cy - (py - this.H / 2) / this.k }; }

  // powiększenie i przesuwanie mapy (w granicach arkusza wyjściowego)
  static ZMAX = 8;
  setZoom(z, at = { x: this.W / 2, y: this.H / 2 }) {
    z = Math.max(1, Math.min(PlotBoard.ZMAX, z));
    const a = this.nm(at.x, at.y);
    this.zoom = z; this.k = this.k0 * z;
    this.cx = a.x - (at.x - this.W / 2) / this.k; this.cy = a.y + (at.y - this.H / 2) / this.k;
    this.clampView(); this.updateZoomUI(); this.draw();
  }
  panBy(dx, dy) { this.cx -= dx / this.k; this.cy += dy / this.k; this.clampView(); this.draw(); }
  clampView() {
    const ex = (this.W / 2 - M) * (1 / this.k0 - 1 / this.k), ey = (this.H / 2 - M) * (1 / this.k0 - 1 / this.k);
    this.cx = Math.max(this.cx0 - ex, Math.min(this.cx0 + ex, this.cx));
    this.cy = Math.max(this.cy0 - ey, Math.min(this.cy0 + ey, this.cy));
  }
  updateZoomUI() { if (this.zoomLbl) this.zoomLbl.textContent = `${Math.round(this.zoom * 10) / 10}×`.replace('.', ','); }
  // duża mapa: arkusz na cały ekran, płótno w wyższej rozdzielczości (ostre linie)
  setBig(on) {
    this.big = on;
    this.el.classList.toggle('pb-big', on);
    this.bigBtn.textContent = tr(on ? '✕ Zamknij dużą mapę' : '⛶ Duża mapa');
    this.fitCanvas();
  }
  fitCanvas() {
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const w = this.big ? this.cv.getBoundingClientRect().width || this.W : this.W;
    this.res = Math.min(4, dpr * Math.max(1, w / this.W));
    this.cv.width = Math.round(this.W * this.res); this.cv.height = Math.round(this.H * this.res);
    this.draw();
  }

  // ---------- treść mapy: ląd z latarniami na cyplach, izobaty, głębokości, róża ----------
  genChart() {
    const r = rng(this.plot.seed || 7), P = this.toNm(this.plot.sol.point), objs = this.plot.pts.map((p) => this.toNm(p));
    const fix = !!this.plot.sol.lines;
    const track = fix ? objs.map((o) => [o, P]) : this.plot.sol.vectors ? this.plot.sol.vectors.map((v) => [this.toNm(v.from), this.toNm(v.to)]) : [[objs[0], P]];
    const lo = this.nm(M, this.H - M), hi = this.nm(this.W - M, M);
    const blob = (c, R) => {
      const ph = [r() * 6, r() * 6, r() * 6, r() * 6], a = [0.16 + r() * 0.1, 0.09 + r() * 0.07, 0.05, 0.03];
      return Array.from({ length: 56 }, (_, i) => { const t = (i / 56) * Math.PI * 2, rr = R * (1 + a[0] * Math.sin(2 * t + ph[0]) + a[1] * Math.sin(3 * t + ph[1]) + a[2] * Math.sin(5 * t + ph[2]) + a[3] * Math.sin(9 * t + ph[3])); return { x: c.x + Math.cos(t) * rr, y: c.y + Math.sin(t) * rr }; });
    };
    const lands = [];
    const clearOf = (poly, keepIn = null) => polyDist(poly, P) > 0.45 && (fix ? true : polyDist(poly, objs[0]) > 0.45) &&
      track.every(([a, b]) => { const q = poly.filter((v) => segDist(v, a, b) < 0.12); return keepIn ? q.length < 18 : q.length === 0; }) &&
      lands.every((l) => poly.every((v) => polyDist(l.poly, v) > 0.25));
    // latarnie stoją na lądzie, na cyplu zwróconym w stronę jachtu
    if (fix) for (const o of objs) {
      for (let k = 0; k < 40; k++) {
        const ux = o.x - P.x, uy = o.y - P.y, L = Math.hypot(ux, uy), rot = (r() - 0.5) * 0.9, dx = (ux / L) * Math.cos(rot) - (uy / L) * Math.sin(rot), dy = (ux / L) * Math.sin(rot) + (uy / L) * Math.cos(rot);
        const R = 0.55 + r() * 0.9, c = { x: o.x + dx * R * (0.62 + r() * 0.2), y: o.y + dy * R * (0.62 + r() * 0.2) };
        const poly = blob(c, R);
        if (inPoly(poly, o.x, o.y) && polyDist(poly, o) === 0 && clearOf(poly, o)) { lands.push({ poly, c, R }); break; }
      }
    }
    // kilka dodatkowych lądów / wysp z dala od toru
    for (let k = 0, n = 0; k < 60 && n < (fix ? 2 : 3); k++) {
      const R = 0.35 + r() * 1.1, c = { x: lo.x + r() * (hi.x - lo.x), y: lo.y + r() * (hi.y - lo.y) };
      const poly = blob(c, R);
      if (objs.some((o) => inPoly(poly, o.x, o.y)) || !clearOf(poly)) continue;
      lands.push({ poly, c, R }); n++;
    }
    // izobaty 5 i 10 m – obrys lądu powiększony od jego środka
    for (const l of lands) l.c5 = l.poly.map((v) => ({ x: l.c.x + (v.x - l.c.x) * (1 + 0.28 / l.R), y: l.c.y + (v.y - l.c.y) * (1 + 0.28 / l.R) }));
    for (const l of lands) l.c10 = l.poly.map((v) => ({ x: l.c.x + (v.x - l.c.x) * (1 + 0.7 / l.R), y: l.c.y + (v.y - l.c.y) * (1 + 0.7 / l.R) }));
    // głębokości na wodzie (płyciej przy lądzie)
    const sound = [], step = Math.max(0.35, 42 / this.k);
    const f1 = 0.4 + r() * 0.5, f2 = 0.3 + r() * 0.5, f3 = 0.8 + r() * 0.6, p1 = r() * 6, p2 = r() * 6, p3 = r() * 6;
    for (let y = lo.y + step * 0.6; y < hi.y; y += step) for (let x = lo.x + step * 0.5; x < hi.x; x += step) {
      const q = { x: x + (r() - 0.5) * step * 0.7, y: y + (r() - 0.5) * step * 0.7 };
      if (lands.some((l) => inPoly(l.poly, q.x, q.y)) || objs.concat([P]).some((o) => Math.hypot(o.x - q.x, o.y - q.y) < step * 0.6)) continue;
      const dl = lands.length ? Math.min(...lands.map((l) => polyDist(l.poly, q))) : 3;
      // dno: płycej przy lądzie, dalej łagodne garby i rynny (żeby na otwartym morzu nie było samych „48”)
      const deep = 34 + 12 * Math.sin(q.x * f1 + p1) * Math.cos(q.y * f2 + p2) + 7 * Math.sin((q.x + q.y) * f3 + p3);
      sound.push({ ...q, d: Math.max(1, Math.round(Math.min(deep + r() * 3, 2 + dl * 11 + r() * 4))) });
    }
    // róża kompasowa w najbardziej „pustym” rogu
    const cands = [[150, 150], [this.W - 150, 150], [150, this.H - 150], [this.W - 150, this.H - 150], [this.W / 2, this.H / 2 + 120], [this.W / 2, 140]].map(([x, y]) => ({ x, y }));
    const score = (c) => Math.min(...objs.concat([P]).map((o) => { const q = this.px(o); return Math.hypot(q.x - c.x, q.y - c.y); }), ...lands.map((l) => { const q = this.px(l.c); return Math.hypot(q.x - c.x, q.y - c.y) - l.R * this.k; }));
    this.rose = cands.sort((a, b) => score(b) - score(a))[0];
    this.lands = lands; this.sound = sound;
  }

  build() {
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    this.cv = h('canvas.pb-cv', { width: this.W * dpr, height: this.H * dpr, style: { aspectRatio: `${this.W} / ${this.H}`, cursor: 'crosshair', touchAction: 'none' } });
    this.res = dpr;
    this.angIn = h('input', { type: 'text', inputmode: 'decimal', placeholder: '000', style: { width: '64px' } });
    this.distIn = h('input', { type: 'text', inputmode: 'decimal', placeholder: '0,0', style: { width: '64px' } });
    this.readout = h('div.pb-readout', {}, '');
    this.toolBtns = h('div.seg.pb-tools');
    // kolor rysowanych linii (zielony zostaje dla rozwiązania)
    this.color = PlotBoard.COLORS[0][0];
    this.colorBtns = h('span.pb-colors', {});
    const renderColors = () => {
      this.colorBtns.innerHTML = '';
      for (const [c, n] of PlotBoard.COLORS) this.colorBtns.appendChild(h('button.pb-color', { class: this.color === c ? 'on' : '', title: tr(n), 'aria-label': tr(n), style: { background: c }, onclick: () => { this.color = c; renderColors(); } }));
    };
    renderColors();
    const tools = [['pan', '✋ Przesuń'], ['drag', '✎ Linia'], ['bearing', '∠ Namiar przez punkt'], ['course', '→ Kurs i droga'], ['plotter', '📐 Trójkąt nawigacyjny'], ['parallel', '⫽ Linijka równoległa'], ['dividers', '⟨⟩ Cyrkiel'], ['circle', '◯ Okrąg'], ['point', '• Punkt']];
    this.edgeBtn = h('button.btn.xs', { onclick: () => this.drawAlongPlotter() }, '📐 Kreśl wzdłuż krawędzi');
    const renderTools = () => {
      this.toolBtns.innerHTML = '';
      for (const [k, n] of tools) this.toolBtns.appendChild(h('button', { class: this.tool === k ? 'on' : '', onclick: () => { this.tool = k; this.sel = null; this.drag = null; renderTools(); this.updateHint(); this.draw(); } }, n));
      this.edgeBtn.style.display = this.tool === 'plotter' ? '' : 'none';
      this.cv.style.cursor = this.tool === 'pan' ? 'grab' : 'crosshair';
    };
    this.zoomLbl = h('span.pb-zoom', {}, '1×');
    this.bigBtn = h('button.btn.xs', { onclick: () => this.setBig(!this.big), style: this.fill ? { display: 'none' } : {} }, '⛶ Duża mapa');
    if (this.fill) Object.assign(this.cv.style, { maxWidth: 'none', width: `min(100%, calc((100vh - ${this.offY}px) * ${(this.W / this.H).toFixed(4)}))`, margin: '0 auto' });
    renderTools();
    this.hint = h('div.small.muted.pb-hint');
    this.el = h('div.pb', { class: this.fill ? 'pb-fill' : '' },
      h('div.pb-bar', {}, this.toolBtns, h('span.pb-in', {}, h('span', {}, 'Kolor'), this.colorBtns)),
      h('div.pb-bar', {},
        h('label.pb-in', {}, h('span', {}, 'Kąt'), this.angIn, '°'),
        h('label.pb-in', {}, h('span', {}, this.vec ? 'Długość' : 'Droga'), this.distIn, this.unit),
        this.edgeBtn,
        h('button.btn.xs', { onclick: () => { this.items.pop(); this.draw(); } }, '↶ Cofnij'),
        h('button.btn.xs', { onclick: () => { this.items = []; this.plotter = null; this.sel = null; this.draw(); } }, 'Wyczyść'),
        h('span.pb-zoombox', {},
          h('button.btn.xs', { title: tr('Pomniejsz'), onclick: () => this.setZoom(this.zoom / 1.5) }, '−'),
          this.zoomLbl,
          h('button.btn.xs', { title: tr('Powiększ'), onclick: () => this.setZoom(this.zoom * 1.5) }, '+'),
          h('button.btn.xs', { onclick: () => this.setZoom(1) }, '1:1'),
          this.bigBtn)),
      this.hint, this.cv, this.readout);
    this.updateHint();
    const pos = (e) => { const r = this.cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * this.W, y: ((e.clientY - r.top) / r.height) * this.H }; };
    // przesuwanie: narzędzie „Przesuń”, prawy lub środkowy przycisk myszy; dwa palce – szczypanie
    const touches = new Map();
    let pinch = null;
    this.cv.addEventListener('contextmenu', (e) => e.preventDefault());
    this.cv.addEventListener('pointerdown', (e) => {
      this.cv.setPointerCapture?.(e.pointerId);
      const p = pos(e);
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, p);
        if (touches.size === 2) {
          const [u, v] = [...touches.values()];
          pinch = { d: Math.hypot(u.x - v.x, u.y - v.y) || 1, z: this.zoom, m: { x: (u.x + v.x) / 2, y: (u.y + v.y) / 2 } };
          this.drag = null; this.pan = null; this.pdrag = null; return;
        }
      }
      if (this.tool === 'pan' || e.button === 1 || e.button === 2) { e.preventDefault(); this.pan = p; this.cv.style.cursor = 'grabbing'; return; }
      this.down(p);
    });
    this.cv.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (touches.has(e.pointerId)) touches.set(e.pointerId, p);
      if (pinch && touches.size === 2) {
        const [u, v] = [...touches.values()], m = { x: (u.x + v.x) / 2, y: (u.y + v.y) / 2 };
        this.panBy(m.x - pinch.m.x, m.y - pinch.m.y); pinch.m = m;
        this.setZoom(pinch.z * (Math.hypot(u.x - v.x, u.y - v.y) / pinch.d), m); return;
      }
      if (this.pan) { this.panBy(p.x - this.pan.x, p.y - this.pan.y); this.pan = p; return; }
      this.move(p);
    });
    const end = (e) => {
      touches.delete(e.pointerId);
      if (pinch) { if (touches.size < 2) pinch = null; return; }
      if (this.pan) { this.pan = null; this.cv.style.cursor = this.tool === 'pan' ? 'grab' : 'crosshair'; return; }
      this.up(pos(e));
    };
    this.cv.addEventListener('pointerup', end);
    this.cv.addEventListener('pointercancel', end);
    this.cv.addEventListener('pointerleave', () => { if (!this.drag) { this.hover = null; this.draw(); } });
    // kółko myszy / gest szczypania na touchpadzie – powiększenie wokół kursora; przy trójkącie kółko obraca trójkąt (Ctrl + kółko – powiększa)
    this.cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.tool === 'plotter' && this.plotter && !e.ctrlKey) { this.setPlotterAng(this.plotter.ang + (e.deltaY > 0 ? 1 : -1) * (e.shiftKey ? 10 : 1)); return; }
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      this.setZoom(this.zoom * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), pos(e));
    }, { passive: false });
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => { if (this.big && this.el.isConnected) this.fitCanvas(); });
      window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !this.el.isConnected) return;
        if (this.drag) { this.drag = null; this.draw(); } else if (this.big) this.setBig(false);
      });
    }
    this.draw();
  }

  updateHint() {
    if (this.vec && (this.tool === 'course' || this.tool === 'circle' || this.tool === 'drag')) {
      this.hint.textContent = tr({
        course: 'Trójkąt prędkości: wektory odkładaj dla 1 godziny (1 kn = 1 Mm). Wpisz kierunek i długość w węzłach, potem kliknij początek wektora – zwykle punkt O albo koniec poprzedniego wektora.',
        circle: 'Wpisz prędkość po wodzie w polu „Długość” i kliknij koniec wektora prądu – okrąg przetnie linię drogi nad dnem w miejscu, gdzie kończy się wektor po wodzie.',
        drag: 'Przeciągnij między dwoma punktami (np. od O do końca ostatniego wektora) – odczytasz kierunek i prędkość wypadkową. Linie przyciągają się do końców wektorów i przecięć.'
      }[this.tool]);
      return;
    }
    this.hint.textContent = tr({
      pan: 'Przeciągnij mapę, aby ją przesunąć. Kółko myszy lub szczypanie – powiększenie (także przyciski + i −); prawy przycisk myszy przesuwa mapę przy każdym narzędziu.',
      drag: 'Przeciągnij od punktu albo kliknij początek i koniec, aby narysować linię – widać jej kierunek i długość. Linie przyciągają się do obiektów i przecięć.',
      bearing: 'Wpisz kąt (np. namiar rzeczywisty) i kliknij obiekt – przez punkt zostanie wykreślona linia pozycyjna.',
      course: 'Wpisz kurs i drogę, potem kliknij punkt startu – odłożony zostanie odcinek z punktem końcowym.',
      plotter: 'Kliknij, aby położyć trójkąt; przeciągnij go, by przesunąć, a za uchwyt (kółko) – by obrócić (także kółko myszy, z Shift ±10°). Kąt krawędzi trafia do pola „Kąt”.',
      parallel: 'Kliknij istniejącą linię, a potem punkt – przez punkt zostanie wykreślona linia równoległa.',
      dividers: 'Przeciągnij cyrklem albo kliknij dwa punkty, aby zmierzyć odległość (trafia do pola „Droga”). Na skali szerokości przy lewym lub prawym brzegu 1\' = 1 Mm – cyrkiel przyciąga się tam do podziałki co 0,1\'.',
      circle: 'Wpisz odległość w polu „Droga” i kliknij środek – powstanie okrąg pozycyjny (np. odległość od latarni).',
      point: 'Kliknij, aby postawić punkt i odczytać jego współrzędne.'
    }[this.tool]);
  }

  // przyciąganie do obiektów, końców odcinków, punktów i przecięć (w pikselach)
  snapTargets() {
    const out = this.plot.pts.map((p) => this.toNm(p));
    for (const it of this.items) {
      if (it.kind === 'pt' || it.kind === 'circle') out.push({ x: it.x, y: it.y });
      if (it.kind === 'seg') { out.push({ x: it.x, y: it.y }); out.push({ x: it.x + it.dx * it.len, y: it.y + it.dy * it.len }); }
    }
    return out.concat(this.crossings());
  }
  snap(p, r = 11) {
    if (this.tool === 'dividers' && (p.x < M || p.x > this.W - M)) { const q = this.nm(p.x, p.y); return { x: q.x, y: Math.round(q.y * 10) / 10, snapped: true, scale: true }; }
    let best = null, bd = r;
    for (const n of this.snapTargets()) { const q = this.px(n), d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = n; } }
    return best ? { ...best, snapped: true } : this.nm(p.x, p.y);
  }
  crossings() {
    const L = this.items.filter((i) => i.kind === 'line' || i.kind === 'seg'), C = this.items.filter((i) => i.kind === 'circle'), out = [];
    for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) out.push(...lineX(L[a], L[b]));
    for (const l of L) for (const c of C) out.push(...lineCircle(l, c));
    for (let a = 0; a < C.length; a++) for (let b = a + 1; b < C.length; b++) out.push(...circleCircle(C[a], C[b]));
    return out;
  }
  num(inp) { const v = parseFloat(String(inp.value).replace(',', '.')); return Number.isFinite(v) ? v : null; }

  // trójkąt nawigacyjny: krawędź przez środek w kierunku ang (°), uchwyt obrotu na końcu krawędzi
  static PL = 120;
  plotterGeom() {
    const pl = this.plotter, c = this.px(pl), a = pl.ang * D2R, u = { x: Math.sin(a), y: -Math.cos(a) }, v = { x: Math.cos(a), y: Math.sin(a) };
    return { c, u, v, handle: { x: c.x + u.x * PlotBoard.PL, y: c.y + u.y * PlotBoard.PL } };
  }
  setPlotterAng(a) { this.plotter.ang = norm(Math.round(a * 2) / 2); this.angIn.value = String(this.plotter.ang).replace('.', ','); this.draw(); }
  drawAlongPlotter() {
    if (!this.plotter) return;
    const a = this.plotter.ang;
    this.add({ kind: 'line', x: this.plotter.x, y: this.plotter.y, dx: Math.sin(a * D2R), dy: Math.cos(a * D2R), ang: a });
    this.draw();
  }
  nearestLine(p) {
    let best = null, bd = 9;
    this.items.forEach((it, i) => {
      if (it.kind !== 'line' && it.kind !== 'seg') return;
      const a = this.px(it.kind === 'seg' ? it : { x: it.x - it.dx * 200, y: it.y - it.dy * 200 }), b = this.px(it.kind === 'seg' ? { x: it.x + it.dx * it.len, y: it.y + it.dy * it.len } : { x: it.x + it.dx * 200, y: it.y + it.dy * 200 });
      const d = segDist(p, a, b);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  down(p) {
    const n = this.snap(p);
    if (this.tool === 'drag' || this.tool === 'dividers') {
      // drugi klik w trybie „klik – klik”: koniec linii / drugie ramię cyrkla
      if (this.drag && this.drag.click) { this.drag.b = n.scale && this.drag.a.scale ? { ...n, x: this.drag.a.x } : n; this.drag.click = false; this.drag.second = true; return; }
      this.drag = { a: n, b: n }; return;
    }
    if (this.tool === 'point') { this.add({ kind: 'pt', x: n.x, y: n.y }); this.draw(); return; }
    if (this.tool === 'plotter') {
      if (this.plotter) {
        const g = this.plotterGeom(), lx = (p.x - g.c.x) * g.u.x + (p.y - g.c.y) * g.u.y, ly = (p.x - g.c.x) * g.v.x + (p.y - g.c.y) * g.v.y;
        if (Math.hypot(p.x - g.handle.x, p.y - g.handle.y) < 16) { this.pdrag = { mode: 'rot' }; return; }
        if (Math.abs(lx) < PlotBoard.PL && ly > -6 && ly < 78) { this.pdrag = { mode: 'move', ox: p.x - g.c.x, oy: p.y - g.c.y }; return; }
      }
      this.plotter = { x: n.x, y: n.y, ang: this.plotter ? this.plotter.ang : (this.num(this.angIn) ?? 0) };
      this.setPlotterAng(this.plotter.ang);
      return;
    }
    if (this.tool === 'parallel') {
      if (this.sel === null) { this.sel = this.nearestLine(p); this.draw(); return; }
      const ref = this.items[this.sel];
      this.add({ kind: 'line', x: n.x, y: n.y, dx: ref.dx, dy: ref.dy, ang: ref.ang });
      this.angIn.value = String(Math.round(ref.ang * 10) / 10).replace('.', ',');
      this.sel = null; this.draw(); return;
    }
    if (this.tool === 'circle') {
      const d = this.num(this.distIn);
      if (d === null || d <= 0) { this.flash(this.distIn); return; }
      this.add({ kind: 'circle', x: n.x, y: n.y, r: d }); this.draw(); return;
    }
    const ang = this.num(this.angIn);
    if (ang === null) { this.flash(this.angIn); return; }
    const dx = Math.sin(ang * D2R), dy = Math.cos(ang * D2R);
    if (this.tool === 'bearing') this.add({ kind: 'line', x: n.x, y: n.y, dx, dy, ang: norm(ang) });
    else {
      const d = this.num(this.distIn);
      if (d === null || d <= 0) { this.flash(this.distIn); return; }
      this.add({ kind: 'seg', x: n.x, y: n.y, dx, dy, len: d, ang: norm(ang) });
    }
    this.draw();
  }
  move(p) {
    if (this.pdrag && this.plotter) {
      if (this.pdrag.mode === 'rot') { const g = this.plotterGeom(); this.setPlotterAng(Math.atan2(p.x - g.c.x, -(p.y - g.c.y)) / D2R); return; }
      const q = this.nm(p.x - this.pdrag.ox, p.y - this.pdrag.oy), s = this.snap({ x: p.x - this.pdrag.ox, y: p.y - this.pdrag.oy });
      Object.assign(this.plotter, s.snapped ? { x: s.x, y: s.y } : q); this.draw(); return;
    }
    if (this.drag) {
      this.drag.b = this.snap(p);
      if (this.drag.a.scale && this.drag.b.scale) this.drag.b.x = this.drag.a.x; // na skali mierzymy tylko w pionie
    }
    this.hover = this.snap(p, 9);
    this.draw();
  }
  up() {
    this.pdrag = null;
    const d = this.drag;
    if (!d || d.click) return;
    const len = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);
    // krótkie kliknięcie bez przeciągania: pierwszy punkt ustawiony, drugi wskazuje się kolejnym kliknięciem
    if (len * this.k < 6) { if (d.second) this.drag = null; else d.click = true; return this.draw(); }
    this.drag = null;
    if (this.tool === 'dividers') {
      this.add({ kind: 'meas', a: { x: d.a.x, y: d.a.y }, b: { x: d.b.x, y: d.b.y }, len });
      this.distIn.value = nm2(len);
      return this.draw();
    }
    this.add({ kind: 'seg', x: d.a.x, y: d.a.y, dx: (d.b.x - d.a.x) / len, dy: (d.b.y - d.a.y) / len, len, ang: norm(Math.atan2(d.b.x - d.a.x, d.b.y - d.a.y) / D2R) });
    this.draw();
  }
  flash(inp) { inp.style.outline = '2px solid #d0453b'; inp.focus(); setTimeout(() => { inp.style.outline = ''; }, 700); }

  setSolution(on) { this.showSol = on; this.draw(); }

  // ---------- rysowanie ----------
  draw() {
    const ctx = this.cv.getContext('2d');
    ctx.setTransform(this.res, 0, 0, this.res, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.fillStyle = '#fbf7ec'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.fillStyle = '#f4f9fc'; ctx.fillRect(M, M, this.W - 2 * M, this.H - 2 * M);
    ctx.save();
    ctx.beginPath(); ctx.rect(M, M, this.W - 2 * M, this.H - 2 * M); ctx.clip();
    this.drawChart(ctx);
    ctx.restore();
    this.drawScales(ctx);
    ctx.save();
    ctx.beginPath(); ctx.rect(M, M, this.W - 2 * M, this.H - 2 * M); ctx.clip();
    // obiekty: latarnie (symbol mapowy z błyskiem) albo pozycja wyjściowa
    for (const p of this.plot.pts) {
      const q = this.px(this.toNm(p));
      if (p.light) {
        ctx.fillStyle = 'rgba(200,40,160,0.75)'; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.quadraticCurveTo(q.x + 22, q.y - 4, q.x + 18, q.y - 16); ctx.quadraticCurveTo(q.x + 8, q.y - 10, q.x, q.y); ctx.fill();
        ctx.fillStyle = '#1b1f24'; this.star(ctx, q.x, q.y, 6);
      } else { ctx.strokeStyle = '#1b1f24'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#1b1f24'; ctx.beginPath(); ctx.arc(q.x, q.y, 1.8, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#1b1f24'; ctx.font = 'bold 13px Segoe UI, sans-serif'; ctx.fillText(p.label, q.x + 9, q.y + 16);
    }
    // rozwiązanie
    if (this.showSol) {
      const s = this.plot.sol;
      ctx.setLineDash([7, 5]); ctx.strokeStyle = 'rgba(46,157,98,0.9)'; ctx.lineWidth = 2;
      for (const l of s.lines || []) this.strokeLine(ctx, { ...this.toNm(l.p), dx: Math.sin(l.brg * D2R), dy: Math.cos(l.brg * D2R) });
      for (const c of s.circles || []) { const q = this.px(this.toNm(c.p)); ctx.beginPath(); ctx.arc(q.x, q.y, c.r * this.k, 0, Math.PI * 2); ctx.stroke(); }
      for (const v of s.vectors || []) {
        const a = this.px(this.toNm(v.from)), b = this.px(this.toNm(v.to)), len = Math.hypot(b.x - a.x, b.y - a.y) / this.k;
        const n = this.toNm(v.to), m = this.toNm(v.from), ang = norm(Math.atan2(n.x - m.x, n.y - m.y) / D2R);
        ctx.strokeStyle = v.main ? 'rgba(46,157,98,1)' : 'rgba(46,157,98,0.8)'; ctx.lineWidth = v.main ? 2.6 : 2;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([]); this.arrowHead(ctx, a, b); ctx.setLineDash([7, 5]);
        this.label(ctx, (a.x + b.x) / 2 + 6, (a.y + b.y) / 2 - 4, `${tr(v.label)}: ${deg3(ang)} · ${nm2(len)} ${v.unit || 'kn'}`);
      }
      for (const g of s.segs || []) { const a = this.px(this.toNm(g.p)), b = this.px(this.toNm(s.point)); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      ctx.setLineDash([]);
      const q = this.px(this.toNm(s.point));
      ctx.strokeStyle = '#2e9d62'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(q.x, q.y, 8, 0, Math.PI * 2); ctx.stroke();
    }
    // elementy gracza
    this.items.forEach((it, i) => {
      const col = it.color || '#2f4468';
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = i === this.sel ? 3.2 : 1.8;
      if (i === this.sel) { ctx.shadowColor = 'rgba(255,170,40,0.95)'; ctx.shadowBlur = 8; }
      this.lc = col;
      if (it.kind === 'line') this.strokeLine(ctx, it);
      else if (it.kind === 'seg') {
        const a = this.px(it), b = this.px({ x: it.x + it.dx * it.len, y: it.y + it.dy * it.len });
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        this.arrowHead(ctx, a, b);
        this.label(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, `${deg3(it.ang)} · ${nm2(it.len)} ${this.unit}`);
      } else if (it.kind === 'circle') {
        const c = this.px(it);
        ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(c.x, c.y, it.r * this.k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        this.label(ctx, c.x + it.r * this.k * 0.71 + 4, c.y - it.r * this.k * 0.71, `${nm2(it.r)} ${this.unit}`);
      } else if (it.kind === 'meas') { /* cyrkiel rysowany niżej, bez przycięcia do ramki */ }
      else { const q = this.px(it); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2); ctx.fill(); const ll = this.toLL(it); this.label(ctx, q.x + 7, q.y - 6, `${fmtLat(ll.lat)} ${fmtLon(ll.lon)}`); }
      ctx.restore();
      this.lc = null;
    });
    // przecięcia
    for (const x of this.crossings()) { const q = this.px(x); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2); ctx.stroke(); }
    // w trakcie przeciągania: linia albo cyrkiel
    if (this.drag) {
      const a = this.px(this.drag.a), b = this.px(this.drag.b), d = this.drag, len = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);
      if (this.tool === 'dividers') { /* niżej */ } else {
        ctx.strokeStyle = '#1f93c9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (len > 0.01) this.label(ctx, b.x + 12, b.y - 10, `${deg3(Math.atan2(d.b.x - d.a.x, d.b.y - d.a.y) / D2R)} · ${nm2(len)} ${this.unit}`);
      }
    }
    if (this.plotter) this.drawPlotter(ctx);
    if (this.hover && this.hover.snapped && !this.hover.scale) { const q = this.px(this.hover); ctx.strokeStyle = '#1f93c9'; ctx.lineWidth = 1.5; ctx.strokeRect(q.x - 6, q.y - 6, 12, 12); }
    ctx.restore();
    // cyrkiel – także na skali szerokości przy brzegu mapy (1' szerokości = 1 Mm)
    this.items.forEach((it) => { if (it.kind === 'meas') { this.lc = it.color; this.drawDividers(ctx, this.px(it.a), this.px(it.b), it.len, 0.8); this.lc = null; } });
    if (this.drag && this.tool === 'dividers') {
      const d = this.drag, len = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y), a = this.px(d.a);
      if (d.click && len * this.k < 6) { ctx.fillStyle = '#1f93c9'; ctx.beginPath(); ctx.arc(a.x, a.y, 4, 0, Math.PI * 2); ctx.fill(); }
      else this.drawDividers(ctx, a, this.px(d.b), len, 1);
    }
    if (this.hover && this.hover.scale) { const q = this.px(this.hover); ctx.strokeStyle = '#1f93c9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x - 12, q.y); ctx.lineTo(q.x + 12, q.y); ctx.stroke(); }
    // odczyt współrzędnych kursora / punktu
    const pt = this.drag ? this.drag.b : this.hover;
    if (pt) { const ll = this.toLL(pt); this.readout.textContent = `${pt.snapped ? '◆ ' : ''}${fmtLat(ll.lat)}   ${fmtLon(ll.lon)}${this.plotter && this.tool === 'plotter' ? `   📐 ${deg3(this.plotter.ang)}` : ''}`; }
    else this.readout.textContent = tr('Najedź na mapę, aby odczytać pozycję');
  }

  drawChart(ctx) {
    const path = (poly) => { ctx.beginPath(); poly.forEach((v, i) => { const q = this.px(v); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.closePath(); };
    // płycizny (do izobaty 5 m) – błękit, dalej biel
    for (const l of this.lands) { path(l.c10); ctx.fillStyle = '#e3f0f8'; ctx.fill(); }
    for (const l of this.lands) { path(l.c5); ctx.fillStyle = '#cfe4f2'; ctx.fill(); }
    ctx.lineWidth = 0.9;
    for (const l of this.lands) {
      ctx.strokeStyle = 'rgba(60,110,160,0.55)'; ctx.setLineDash([2, 3]); path(l.c5); ctx.stroke();
      ctx.setLineDash([7, 3, 1.5, 3]); path(l.c10); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const l of this.lands) { path(l.poly); ctx.fillStyle = '#f2e2b0'; ctx.fill(); ctx.strokeStyle = '#5b4a2c'; ctx.lineWidth = 1.3; ctx.stroke(); }
    // głębokości
    ctx.fillStyle = 'rgba(40,60,90,0.8)'; ctx.font = 'italic 10px Segoe UI, sans-serif'; ctx.textAlign = 'center';
    for (const s of this.sound) { const q = this.px(s); if (Math.hypot(q.x - this.rose.x, q.y - this.rose.y) < 86) continue; ctx.fillText(String(s.d), q.x, q.y + 3); }
    ctx.textAlign = 'left';
    this.drawRose(ctx, this.rose.x, this.rose.y, 70);
  }

  // róża kompasowa: zewnętrzna – kierunki rzeczywiste, wewnętrzna – magnetyczne (obrócona o deklinację)
  drawRose(ctx, x, y, R) {
    const v = this.plot.variation || 0;
    const ring = (rr, rot, major) => {
      for (let a = 0; a < 360; a += 5) {
        const t = (a + rot) * D2R, l = a % 30 === 0 ? 9 : a % 10 === 0 ? 6 : 3;
        ctx.beginPath(); ctx.moveTo(x + Math.sin(t) * rr, y - Math.cos(t) * rr); ctx.lineTo(x + Math.sin(t) * (rr - l), y - Math.cos(t) * (rr - l)); ctx.stroke();
        if (major && a % 30 === 0) { ctx.save(); ctx.translate(x + Math.sin(t) * (rr - 17), y - Math.cos(t) * (rr - 17)); ctx.rotate(t); ctx.fillText(String(a).padStart(3, '0'), 0, 3); ctx.restore(); }
      }
    };
    ctx.save();
    ctx.strokeStyle = 'rgba(176,40,140,0.8)'; ctx.fillStyle = 'rgba(176,40,140,0.9)'; ctx.lineWidth = 0.9; ctx.font = '8px Segoe UI, sans-serif'; ctx.textAlign = 'center';
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
    ring(R, 0, true);
    ctx.beginPath(); ctx.arc(x, y, R * 0.56, 0, Math.PI * 2); ctx.stroke();
    ring(R * 0.56, v, false);
    // gwiazda północy i strzałka północy magnetycznej
    ctx.beginPath(); ctx.moveTo(x, y - R + 2); ctx.lineTo(x + 5, y - R + 14); ctx.lineTo(x - 5, y - R + 14); ctx.closePath(); ctx.fill();
    const tm = v * D2R; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(tm) * R * 0.5, y - Math.cos(tm) * R * 0.5); ctx.stroke();
    ctx.font = 'bold 8px Segoe UI, sans-serif';
    const vv = Math.abs(v), d = Math.floor(vv + 1e-9), m = Math.round((vv - d) * 60);
    ctx.fillText(`Var ${d}°${pad2(m)}'${v >= 0 ? 'E' : 'W'}`, x, y + 14);
    ctx.restore();
  }

  drawDividers(ctx, a, b, len, alpha) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, hgt = Math.min(70, L * 0.45);
    // przegub prostopadle do rozwarcia: przy poziomym pomiarze do góry, przy pionowym (np. na skali) – w stronę mapy
    let nx = -dy / L, ny = dx / L;
    if (Math.abs(dy) > Math.abs(dx) ? nx * (this.W / 2 - mx) < 0 : ny > 0) { nx = -nx; ny = -ny; }
    const hx = mx + nx * hgt, hy = my + ny * hgt;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#6b7380'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(hx, hy); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = '#3a3f47'; ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1f93c9'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    this.label(ctx, hx + 8, hy - 4, `${nm2(len)} ${this.unit}`);
  }

  drawPlotter(ctx) {
    const g = this.plotterGeom(), Lp = PlotBoard.PL, Wd = 78, { c, u, v } = g;
    const P = (a, b) => ({ x: c.x + u.x * a + v.x * b, y: c.y + u.y * a + v.y * b });
    ctx.save();
    // korpus (przezroczysty plastik) – krawędź robocza przechodzi przez środek
    const q = [P(-Lp, 0), P(Lp, 0), P(Lp, Wd), P(-Lp, Wd)];
    ctx.fillStyle = 'rgba(200,225,240,0.38)'; ctx.strokeStyle = 'rgba(40,80,120,0.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill(); ctx.stroke();
    // podziałka na krawędzi
    ctx.strokeStyle = 'rgba(30,50,80,0.8)'; ctx.lineWidth = 0.8;
    for (let s = -Lp; s <= Lp; s += 6) { const a = P(s, 0), b = P(s, s % 30 === 0 ? 8 : 4); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    // kątomierz: łuk ze stopniami ustawionymi względem północy mapy (jak obrotowa róża trójkąta)
    const R = 62;
    ctx.fillStyle = 'rgba(30,50,80,0.9)'; ctx.font = '8px Segoe UI, sans-serif'; ctx.textAlign = 'center';
    for (let a = 0; a < 360; a += 5) {
      const t = a * D2R, dir = { x: Math.sin(t), y: -Math.cos(t) };
      if (dir.x * v.x + dir.y * v.y < 0.02) continue; // tylko po stronie korpusu
      const l = a % 30 === 0 ? 9 : a % 10 === 0 ? 6 : 3;
      ctx.beginPath(); ctx.moveTo(c.x + dir.x * R, c.y + dir.y * R); ctx.lineTo(c.x + dir.x * (R - l), c.y + dir.y * (R - l)); ctx.stroke();
      if (a % 30 === 0) ctx.fillText(String(a).padStart(3, '0'), c.x + dir.x * (R - 16), c.y + dir.y * (R - 16) + 3);
    }
    // środek, uchwyt i odczyt
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(c.x - 6, c.y); ctx.lineTo(c.x + 6, c.y); ctx.moveTo(c.x, c.y - 6); ctx.lineTo(c.x, c.y + 6); ctx.stroke();
    ctx.fillStyle = 'rgba(31,147,201,0.85)'; ctx.beginPath(); ctx.arc(g.handle.x, g.handle.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Segoe UI'; ctx.fillText('⟳', g.handle.x, g.handle.y + 3);
    ctx.restore();
    const t = P(Lp * 0.45, Wd * 0.72);
    this.label(ctx, t.x - 16, t.y + 4, `${deg3(this.plotter.ang)} / ${deg3(this.plotter.ang + 180)}`);
  }

  star(ctx, x, y, r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.42 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

  strokeLine(ctx, l) {
    const a = this.px({ x: l.x - l.dx * 200, y: l.y - l.dy * 200 }), b = this.px({ x: l.x + l.dx * 200, y: l.y + l.dy * 200 });
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    if (l.ang !== undefined) { const q = this.px(l), r = 26; this.label(ctx, q.x - l.dx * r + 6, q.y + l.dy * r, deg3(l.ang)); }
  }
  arrowHead(ctx, a, b) {
    const t = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 9 * Math.cos(t - 0.4), b.y - 9 * Math.sin(t - 0.4)); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 9 * Math.cos(t + 0.4), b.y - 9 * Math.sin(t + 0.4)); ctx.stroke();
  }
  label(ctx, x, y, s) {
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    const w = ctx.measureText(s).width;
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x - 3, y - 11, w + 6, 15);
    ctx.shadowBlur = 0; ctx.fillStyle = this.lc || '#2f4468'; ctx.fillText(s, x, y);
  }

  // podziałka minut na brzegach (etykiety w stopniach i minutach) i siatka
  drawScales(ctx) {
    const iw = this.W - 2 * M, ih = this.H - 2 * M;
    const latMin = this.nm(0, this.H - M).y, latMax = this.nm(0, M).y; // w minutach szerokości
    const lonMin = this.nm(M, 0).x / this.cl, lonMax = this.nm(this.W - M, 0).x / this.cl; // w minutach długości
    const pick = (pxPerMin) => [0.5, 1, 2, 5, 10, 15, 30].find((s) => s * pxPerMin >= 46) || 30;
    const latStep = pick(this.k), lonStep = pick(this.k * this.cl);
    const sub = (s) => (s <= 1 ? 0.1 : s <= 2 ? 0.5 : 1);
    ctx.save();
    ctx.strokeStyle = '#1b1f24'; ctx.lineWidth = 1; ctx.strokeRect(M - 10.5, M - 10.5, iw + 21, ih + 21); ctx.strokeRect(M + 0.5, M + 0.5, iw - 1, ih - 1);
    ctx.font = '11px Segoe UI, sans-serif'; ctx.fillStyle = '#1b1f24';
    const latLabel = (m) => { const d = Math.floor(m / 60 + 1e-9), mm = m - d * 60; return [`${d}°`, fmtMin(mm)]; };
    const lonLabel = (m) => { const d = Math.floor(m / 60 + 1e-9), mm = m - d * 60; return [`${String(d).padStart(3, '0')}°`, fmtMin(mm)]; };
    const yOf = (m) => this.px({ x: 0, y: m }).y;
    const s1 = sub(latStep);
    // pas naprzemiennych pól co 1' (jak na brzegu mapy morskiej)
    for (let m = Math.floor(latMin); m <= latMax; m += 1) { const y0 = yOf(m), y1 = yOf(m + 1); if (Math.round(m) % 2 === 0) { ctx.fillStyle = '#1b1f24'; ctx.fillRect(M - 10, Math.max(M - 10, y1), 4, Math.min(this.H - M + 10, y0) - Math.max(M - 10, y1)); ctx.fillRect(this.W - M + 6, Math.max(M - 10, y1), 4, Math.min(this.H - M + 10, y0) - Math.max(M - 10, y1)); } }
    ctx.fillStyle = '#1b1f24';
    for (let i = Math.ceil(latMin / s1 - 1e-9); i * s1 <= latMax; i++) {
      const m = Math.round(i * s1 * 1000) / 1000, y = yOf(m), major = Math.abs(m / latStep - Math.round(m / latStep)) < 1e-6, mid = Math.abs(m - Math.round(m)) < 1e-6;
      const len = major ? 10 : mid ? 7 : 4;
      ctx.beginPath(); ctx.moveTo(M - len, y); ctx.lineTo(M, y); ctx.moveTo(this.W - M, y); ctx.lineTo(this.W - M + len, y); ctx.stroke();
      if (major) {
        ctx.strokeStyle = 'rgba(47,68,104,0.16)'; ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(this.W - M, y); ctx.stroke(); ctx.strokeStyle = '#1b1f24';
        const [d, mm] = latLabel(m);
        ctx.textAlign = 'right'; ctx.fillText(d, M - 13, y - 1); ctx.fillText(mm, M - 13, y + 11);
        ctx.textAlign = 'left'; ctx.fillText(d, this.W - M + 13, y - 1); ctx.fillText(mm, this.W - M + 13, y + 11);
      }
    }
    const xOf = (m) => this.px({ x: m * this.cl, y: 0 }).x;
    const s2 = sub(lonStep);
    for (let m = Math.floor(lonMin); m <= lonMax; m += 1) { const x0 = xOf(m), x1 = xOf(m + 1); if (Math.round(m) % 2 === 0) { ctx.fillRect(Math.max(M - 10, x0), M - 10, Math.min(this.W - M + 10, x1) - Math.max(M - 10, x0), 4); ctx.fillRect(Math.max(M - 10, x0), this.H - M + 6, Math.min(this.W - M + 10, x1) - Math.max(M - 10, x0), 4); } }
    ctx.textAlign = 'center';
    for (let i = Math.ceil(lonMin / s2 - 1e-9); i * s2 <= lonMax; i++) {
      const m = Math.round(i * s2 * 1000) / 1000, x = xOf(m), major = Math.abs(m / lonStep - Math.round(m / lonStep)) < 1e-6, mid = Math.abs(m - Math.round(m)) < 1e-6;
      const len = major ? 10 : mid ? 7 : 4;
      ctx.beginPath(); ctx.moveTo(x, M - len); ctx.lineTo(x, M); ctx.moveTo(x, this.H - M); ctx.lineTo(x, this.H - M + len); ctx.stroke();
      if (major) {
        ctx.strokeStyle = 'rgba(47,68,104,0.16)'; ctx.beginPath(); ctx.moveTo(x, M); ctx.lineTo(x, this.H - M); ctx.stroke(); ctx.strokeStyle = '#1b1f24';
        const [d, mm] = lonLabel(m);
        ctx.fillText(`${d}${mm}`, x, M - 15); ctx.fillText(`${d}${mm}`, x, this.H - M + 24);
      }
    }
    ctx.textAlign = 'left';
    ctx.font = 'bold 10px Segoe UI, sans-serif'; ctx.fillStyle = '#5a6b80';
    ctx.fillText(tr('szer. N'), 4, M - 16); ctx.fillText(tr('dł. E'), this.W - M + 12, this.H - 6);
    ctx.fillText(tr('Głębokości w metrach'), M, this.H - 6);
    ctx.restore();
  }
}
