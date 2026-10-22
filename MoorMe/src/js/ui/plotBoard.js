// Mapka do kreślenia w zadaniach nawigacyjnych: linie namiarowe, kurs i droga, punkty, przecięcia.
// Na brzegach podziałka szerokości (lewa/prawa) i długości (góra/dół) w stopniach i minutach.
// Mapa „płaska”: 1' szerokości = 1 Mm, 1' długości = cos φ Mm (jak w obliczeniach zadań).
import { h } from './dom.js';
import { t as tr } from '../i18n.js';

const D2R = Math.PI / 180;
const W = 680, H = 470, M = 54; // rozmiar płótna i szerokość marginesu ze skalą
const pad2 = (n) => String(n).padStart(2, '0');
const norm = (a) => ((a % 360) + 360) % 360;
const fmtMin = (m) => (Math.abs(m - Math.round(m)) < 1e-6 ? `${pad2(Math.round(m))}'` : `${m.toFixed(1).replace('.', ',')}'`);
const dmParts = (v) => { const a = Math.abs(v) + 1e-9, d = Math.floor(a); return [d, (a - d) * 60]; };
const fmtLat = (lat) => { const [d, m] = dmParts(lat); return `${d}°${m.toFixed(1).replace('.', ',')}'${lat >= 0 ? 'N' : 'S'}`; };
const fmtLon = (lon) => { const [d, m] = dmParts(lon); return `${String(d).padStart(3, '0')}°${m.toFixed(1).replace('.', ',')}'${lon >= 0 ? 'E' : 'W'}`; };
const deg3 = (a) => `${String(Math.round(norm(a)) % 360).padStart(3, '0')}°`;

// przecięcie dwóch prostych (punkt + kierunek) w układzie mil morskich
function lineX(a, b) {
  const det = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(det) < 1e-9) return null;
  const s = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / det, q = ((b.x - a.x) * a.dy - (b.y - a.y) * a.dx) / det;
  if ((a.seg && (s < -1e-6 || s > a.len + 1e-6)) || (b.seg && (q < -1e-6 || q > b.len + 1e-6))) return null;
  return { x: a.x + a.dx * s, y: a.y + a.dy * s };
}

export class PlotBoard {
  /** plot: { pts: [{ label, lat, lon }], sol: { lines: [{ p, brg }], segs: [{ p, brg, dist }], point } } */
  constructor(plot) {
    this.plot = plot;
    this.items = []; // { kind: 'line'|'seg'|'pt', x, y, dx, dy, len }
    this.tool = plot.sol.segs ? 'course' : 'bearing';
    this.showSol = false;
    this.hover = null; this.drag = null;
    // zasięg mapy: obiekty + rozwiązanie z zapasem, proporcje płótna
    const all = [...plot.pts, plot.sol.point];
    const lat0 = all.reduce((s, p) => s + p.lat, 0) / all.length;
    this.cl = Math.cos(lat0 * D2R);
    const xs = all.map((p) => p.lon * 60 * this.cl), ys = all.map((p) => p.lat * 60);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const iw = W - 2 * M, ih = H - 2 * M;
    const span = Math.max((Math.max(...xs) - Math.min(...xs)) / iw, (Math.max(...ys) - Math.min(...ys)) / ih) * 1.45;
    this.k = 1 / Math.max(span, 5 / ih); // px na milę (co najmniej ok. 5 Mm na wysokość)
    this.cx = cx; this.cy = cy;
    this.build();
  }

  // lat/lon <-> mile (x na wschód, y na północ) <-> piksele
  toNm(p) { return { x: p.lon * 60 * this.cl, y: p.lat * 60 }; }
  toLL(n) { return { lat: n.y / 60, lon: n.x / 60 / this.cl }; }
  px(n) { return { x: W / 2 + (n.x - this.cx) * this.k, y: H / 2 - (n.y - this.cy) * this.k }; }
  nm(px, py) { return { x: this.cx + (px - W / 2) / this.k, y: this.cy - (py - H / 2) / this.k }; }

  build() {
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    this.cv = h('canvas', { width: W * dpr, height: H * dpr, style: { width: '100%', maxWidth: `${W}px`, aspectRatio: `${W} / ${H}`, cursor: 'crosshair', touchAction: 'none' } });
    this.dpr = dpr;
    this.angIn = h('input', { type: 'text', inputmode: 'decimal', placeholder: '000', style: { width: '64px' } });
    this.distIn = h('input', { type: 'text', inputmode: 'decimal', placeholder: '0,0', style: { width: '64px' } });
    this.readout = h('div.pb-readout', {}, '');
    this.toolBtns = h('div.seg.pb-tools');
    const tools = [['drag', '✎ Linia (przeciągnij)'], ['bearing', '∠ Namiar przez punkt'], ['course', '→ Kurs i droga z punktu'], ['point', '• Punkt']];
    const renderTools = () => {
      this.toolBtns.innerHTML = '';
      for (const [k, n] of tools) this.toolBtns.appendChild(h('button', { class: this.tool === k ? 'on' : '', onclick: () => { this.tool = k; renderTools(); this.updateHint(); } }, n));
    };
    renderTools();
    this.hint = h('div.small.muted.pb-hint');
    this.el = h('div.pb', {},
      h('div.pb-bar', {}, this.toolBtns,
        h('label.pb-in', {}, h('span', {}, 'Kąt'), this.angIn, '°'),
        h('label.pb-in', {}, h('span', {}, 'Droga'), this.distIn, 'Mm'),
        h('button.btn.xs', { onclick: () => { this.items.pop(); this.draw(); } }, '↶ Cofnij'),
        h('button.btn.xs', { onclick: () => { this.items = []; this.draw(); } }, 'Wyczyść')),
      this.hint, this.cv, this.readout);
    this.updateHint();
    const pos = (e) => { const r = this.cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
    this.cv.addEventListener('pointerdown', (e) => { this.cv.setPointerCapture?.(e.pointerId); this.down(pos(e)); });
    this.cv.addEventListener('pointermove', (e) => this.move(pos(e)));
    this.cv.addEventListener('pointerup', (e) => this.up(pos(e)));
    this.cv.addEventListener('pointerleave', () => { if (!this.drag) { this.hover = null; this.draw(); } });
    this.draw();
  }

  updateHint() {
    this.hint.textContent = tr({
      drag: 'Przeciągnij od punktu, aby narysować linię – widać jej kierunek i długość. Linie przyciągają się do obiektów i przecięć.',
      bearing: 'Wpisz kąt (np. namiar rzeczywisty) i kliknij obiekt – przez punkt zostanie wykreślona linia pozycyjna.',
      course: 'Wpisz kurs i drogę, potem kliknij punkt startu – odłożony zostanie odcinek z punktem końcowym.',
      point: 'Kliknij, aby postawić punkt i odczytać jego współrzędne.'
    }[this.tool]);
  }

  // przyciąganie do obiektów, końców odcinków, punktów i przecięć (w pikselach)
  snapTargets() {
    const out = this.plot.pts.map((p) => this.toNm(p));
    for (const it of this.items) {
      if (it.kind === 'pt') out.push({ x: it.x, y: it.y });
      if (it.kind === 'seg') { out.push({ x: it.x, y: it.y }); out.push({ x: it.x + it.dx * it.len, y: it.y + it.dy * it.len }); }
    }
    return out.concat(this.crossings());
  }
  snap(p, r = 11) {
    let best = null, bd = r;
    for (const n of this.snapTargets()) { const q = this.px(n), d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = n; } }
    return best ? { ...best, snapped: true } : this.nm(p.x, p.y);
  }
  crossings() {
    const L = this.items.filter((i) => i.kind === 'line' || i.kind === 'seg'), out = [];
    for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) { const x = lineX(L[a], L[b]); if (x) out.push(x); }
    return out;
  }
  num(inp) { const v = parseFloat(String(inp.value).replace(',', '.')); return Number.isFinite(v) ? v : null; }

  down(p) {
    const n = this.snap(p);
    if (this.tool === 'drag') { this.drag = { a: n, b: n }; return; }
    if (this.tool === 'point') { this.items.push({ kind: 'pt', x: n.x, y: n.y }); this.draw(); return; }
    const ang = this.num(this.angIn);
    if (ang === null) { this.flash(this.angIn); return; }
    const dx = Math.sin(ang * D2R), dy = Math.cos(ang * D2R);
    if (this.tool === 'bearing') this.items.push({ kind: 'line', x: n.x, y: n.y, dx, dy, ang: norm(ang) });
    else {
      const d = this.num(this.distIn);
      if (d === null || d <= 0) { this.flash(this.distIn); return; }
      this.items.push({ kind: 'seg', x: n.x, y: n.y, dx, dy, len: d, ang: norm(ang) });
    }
    this.draw();
  }
  move(p) {
    if (this.drag) this.drag.b = this.snap(p);
    this.hover = this.snap(p, 9);
    this.draw();
  }
  up() {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const len = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);
    if (len * this.k < 6) return this.draw();
    this.items.push({ kind: 'seg', x: d.a.x, y: d.a.y, dx: (d.b.x - d.a.x) / len, dy: (d.b.y - d.a.y) / len, len, ang: norm(Math.atan2(d.b.x - d.a.x, d.b.y - d.a.y) / D2R) });
    this.draw();
  }
  flash(inp) { inp.style.outline = '2px solid #d0453b'; inp.focus(); setTimeout(() => { inp.style.outline = ''; }, 700); }

  setSolution(on) { this.showSol = on; this.draw(); }

  // ---------- rysowanie ----------
  draw() {
    const ctx = this.cv.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fbf7ec'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#eef6fb'; ctx.fillRect(M, M, W - 2 * M, H - 2 * M);
    this.drawScales(ctx);
    ctx.save();
    ctx.beginPath(); ctx.rect(M, M, W - 2 * M, H - 2 * M); ctx.clip();
    // obiekty (latarnie / pozycja wyjściowa)
    for (const p of this.plot.pts) {
      const q = this.px(this.toNm(p));
      ctx.fillStyle = '#d62828'; ctx.strokeStyle = '#7a1010'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(q.x, q.y - 9); ctx.lineTo(q.x + 6, q.y + 5); ctx.lineTo(q.x - 6, q.y + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1b1f24'; ctx.font = 'bold 13px Segoe UI, sans-serif'; ctx.fillText(p.label, q.x + 9, q.y - 6);
    }
    // rozwiązanie
    if (this.showSol) {
      const s = this.plot.sol;
      ctx.setLineDash([7, 5]); ctx.strokeStyle = 'rgba(46,157,98,0.9)'; ctx.lineWidth = 2;
      for (const l of s.lines || []) this.strokeLine(ctx, { ...this.toNm(l.p), dx: Math.sin(l.brg * D2R), dy: Math.cos(l.brg * D2R) });
      for (const g of s.segs || []) { const a = this.px(this.toNm(g.p)), b = this.px(this.toNm(s.point)); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      ctx.setLineDash([]);
      const q = this.px(this.toNm(s.point));
      ctx.strokeStyle = '#2e9d62'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(q.x, q.y, 8, 0, Math.PI * 2); ctx.stroke();
    }
    // linie gracza
    ctx.strokeStyle = '#2f4468'; ctx.lineWidth = 1.8;
    for (const it of this.items) {
      if (it.kind === 'line') this.strokeLine(ctx, it);
      else if (it.kind === 'seg') {
        const a = this.px(it), b = this.px({ x: it.x + it.dx * it.len, y: it.y + it.dy * it.len });
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        this.arrowHead(ctx, a, b);
        this.label(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, `${deg3(it.ang)} · ${it.len.toFixed(2).replace('.', ',')} Mm`);
      } else { const q = this.px(it); ctx.fillStyle = '#2f4468'; ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // przecięcia
    for (const x of this.crossings()) { const q = this.px(x); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2); ctx.stroke(); }
    // linia w trakcie przeciągania
    if (this.drag) {
      const a = this.px(this.drag.a), b = this.px(this.drag.b), d = this.drag;
      ctx.strokeStyle = '#1f93c9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const len = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);
      if (len > 0.01) this.label(ctx, b.x + 12, b.y - 10, `${deg3(Math.atan2(d.b.x - d.a.x, d.b.y - d.a.y) / D2R)} · ${len.toFixed(2).replace('.', ',')} Mm`);
    }
    if (this.hover && this.hover.snapped) { const q = this.px(this.hover); ctx.strokeStyle = '#1f93c9'; ctx.lineWidth = 1.5; ctx.strokeRect(q.x - 6, q.y - 6, 12, 12); }
    ctx.restore();
    // róża kierunków (północ)
    ctx.fillStyle = '#c0392b'; ctx.font = 'bold 12px Segoe UI, sans-serif'; ctx.fillText('N ↑', W - M - 30, M + 16);
    // odczyt współrzędnych kursora / punktu
    const pt = this.drag ? this.drag.b : this.hover;
    if (pt) { const ll = this.toLL(pt); this.readout.textContent = `${pt.snapped ? '◆ ' : ''}${fmtLat(ll.lat)}   ${fmtLon(ll.lon)}`; }
    else this.readout.textContent = tr('Najedź na mapę, aby odczytać pozycję');
  }

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
    ctx.fillStyle = '#2f4468'; ctx.fillText(s, x, y);
  }

  // podziałka minut na brzegach (naprzemienne pola co krok, etykiety w stopniach i minutach)
  drawScales(ctx) {
    const iw = W - 2 * M, ih = H - 2 * M;
    const latMin = this.nm(0, H - M).y, latMax = this.nm(0, M).y; // w minutach szerokości
    const lonMin = this.nm(M, 0).x / this.cl, lonMax = this.nm(W - M, 0).x / this.cl; // w minutach długości
    const pick = (pxPerMin) => [0.5, 1, 2, 5, 10, 15, 30].find((s) => s * pxPerMin >= 46) || 30;
    const latStep = pick(this.k), lonStep = pick(this.k * this.cl);
    const sub = (s) => (s <= 1 ? 0.1 : s <= 2 ? 0.5 : 1);
    ctx.save();
    ctx.strokeStyle = '#1b1f24'; ctx.lineWidth = 1; ctx.strokeRect(M - 10.5, M - 10.5, iw + 21, ih + 21); ctx.strokeRect(M + 0.5, M + 0.5, iw - 1, ih - 1);
    ctx.font = '11px Segoe UI, sans-serif'; ctx.fillStyle = '#1b1f24';
    const latLabel = (m) => { const d = Math.floor(m / 60 + 1e-9), mm = m - d * 60; return [`${d}°`, fmtMin(mm)]; };
    const lonLabel = (m) => { const d = Math.floor(m / 60 + 1e-9), mm = m - d * 60; return [`${String(d).padStart(3, '0')}°`, fmtMin(mm)]; };
    // szerokość – lewa i prawa krawędź
    const yOf = (m) => this.px({ x: 0, y: m }).y;
    const s1 = sub(latStep);
    for (let m = Math.ceil(latMin / s1) * s1; m <= latMax; m += s1) {
      const y = yOf(m), major = Math.abs(m / latStep - Math.round(m / latStep)) < 1e-6, mid = Math.abs(m - Math.round(m)) < 1e-6;
      const len = major ? 10 : mid ? 7 : 4;
      ctx.beginPath(); ctx.moveTo(M - len, y); ctx.lineTo(M, y); ctx.moveTo(W - M, y); ctx.lineTo(W - M + len, y); ctx.stroke();
      if (major) {
        ctx.strokeStyle = 'rgba(47,68,104,0.13)'; ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); ctx.strokeStyle = '#1b1f24';
        const [d, mm] = latLabel(m);
        ctx.textAlign = 'right'; ctx.fillText(d, M - 13, y - 1); ctx.fillText(mm, M - 13, y + 11);
        ctx.textAlign = 'left'; ctx.fillText(d, W - M + 13, y - 1); ctx.fillText(mm, W - M + 13, y + 11);
      }
    }
    // długość – górna i dolna krawędź
    const xOf = (m) => this.px({ x: m * this.cl, y: 0 }).x;
    const s2 = sub(lonStep);
    ctx.textAlign = 'center';
    for (let m = Math.ceil(lonMin / s2) * s2; m <= lonMax; m += s2) {
      const x = xOf(m), major = Math.abs(m / lonStep - Math.round(m / lonStep)) < 1e-6, mid = Math.abs(m - Math.round(m)) < 1e-6;
      const len = major ? 10 : mid ? 7 : 4;
      ctx.beginPath(); ctx.moveTo(x, M - len); ctx.lineTo(x, M); ctx.moveTo(x, H - M); ctx.lineTo(x, H - M + len); ctx.stroke();
      if (major) {
        ctx.strokeStyle = 'rgba(47,68,104,0.13)'; ctx.beginPath(); ctx.moveTo(x, M); ctx.lineTo(x, H - M); ctx.stroke(); ctx.strokeStyle = '#1b1f24';
        const [d, mm] = lonLabel(m);
        ctx.fillText(`${d}${mm}`, x, M - 15); ctx.fillText(`${d}${mm}`, x, H - M + 24);
      }
    }
    ctx.textAlign = 'left';
    ctx.font = 'bold 10px Segoe UI, sans-serif'; ctx.fillStyle = '#5a6b80';
    ctx.fillText(tr('szer. N'), 4, M - 16); ctx.fillText(tr('dł. E'), W - M + 12, H - M + 40 > H ? H - 4 : H - 6);
    ctx.restore();
  }
}
