// Ilustracje SVG działu „Meteorologia”: mapa synoptyczna, barograf, schematy zjawisk, symbole wiatru i stanu morza.
import { MAP, LAND, isobars, windAt, toXY, dir8, dir16, beaufort } from '../data/meteo.js';
import { getLang } from '../i18n.js';

const L = (pl, en) => (getLang() === 'en' ? en : pl);
const f1 = (v) => Math.round(v * 10) / 10;

// gładka linia przez punkty (Catmull-Rom → krzywe Béziera)
function smoothPath(pts, closed = false) {
  if (pts.length < 3) return 'M' + pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join('L');
  const P = closed ? [pts[pts.length - 2], ...pts, pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M${f1(P[1][0])},${f1(P[1][1])}`;
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
// rzadsze punkty (łamane z marching squares są gęste)
function thin(pts, step) {
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc >= step || i === pts.length - 1) { out.push(pts[i]); acc = 0; } }
  return out;
}
const arrowHead = (x, y, ang, s, col) => { const a1 = ang + 2.6, a2 = ang - 2.6; return `<path d="M${f1(x)},${f1(y)}L${f1(x + Math.cos(a1) * s)},${f1(y + Math.sin(a1) * s)}L${f1(x + Math.cos(a2) * s)},${f1(y + Math.sin(a2) * s)}Z" fill="${col}"/>`; };

// symbol wiatru (trzonek od stacji w stronę, SKĄD wieje; długa kreska 10 kn, krótka 5 kn, chorągiewka 50 kn – po stronie niższego ciśnienia)
export function barbSVG(x, y, from, kn, s = 1, col = '#1b2a3a') {
  if (kn < 3) return `<circle cx="${x}" cy="${y}" r="${7 * s}" fill="none" stroke="${col}" stroke-width="${1.6 * s}"/><circle cx="${x}" cy="${y}" r="${3 * s}" fill="none" stroke="${col}" stroke-width="${1.2 * s}"/>`;
  const a = (from * Math.PI) / 180, ux = Math.sin(a), uy = -Math.cos(a); // w układzie SVG (y w dół): od stacji ku „skąd”
  const len = 34 * s, ex = x + ux * len, ey = y + uy * len;
  const px = Math.cos(a), py = Math.sin(a); // prostopadle – po prawej stronie trzonka patrząc od stacji = obrót zgodnie z ruchem wskazówek zegara
  let out = `<circle cx="${x}" cy="${y}" r="${4.5 * s}" fill="#fff" stroke="${col}" stroke-width="${1.6 * s}"/><line x1="${f1(x + ux * 4.5 * s)}" y1="${f1(y + uy * 4.5 * s)}" x2="${f1(ex)}" y2="${f1(ey)}" stroke="${col}" stroke-width="${1.8 * s}" stroke-linecap="round"/>`;
  let rest = Math.round(kn / 5) * 5, d = 0;
  const bl = 13 * s, gap = 5.5 * s;
  const at = (k) => [ex - ux * k, ey - uy * k];
  while (rest >= 50) { const [bx, by] = at(d), [cx2, cy2] = at(d + gap * 1.6); out += `<path d="M${f1(bx)},${f1(by)}L${f1(bx + px * bl + ux * 3 * s)},${f1(by + py * bl + uy * 3 * s)}L${f1(cx2)},${f1(cy2)}Z" fill="${col}"/>`; d += gap * 2; rest -= 50; }
  while (rest >= 10) { const [bx, by] = at(d); out += `<line x1="${f1(bx)}" y1="${f1(by)}" x2="${f1(bx + px * bl + ux * 4 * s)}" y2="${f1(by + py * bl + uy * 4 * s)}" stroke="${col}" stroke-width="${1.8 * s}" stroke-linecap="round"/>`; d += gap; rest -= 10; }
  if (rest >= 5) { if (d === 0) d = gap; const [bx, by] = at(d); out += `<line x1="${f1(bx)}" y1="${f1(by)}" x2="${f1(bx + px * bl * 0.55 + ux * 2 * s)}" y2="${f1(by + py * bl * 0.55 + uy * 2 * s)}" stroke="${col}" stroke-width="${1.8 * s}" stroke-linecap="round"/>`; }
  return out;
}

// symbole frontu wzdłuż łamanej (w układzie SVG); side = +1 – po lewej stronie kierunku łamanej
function frontSymbols(pts, kind, scale) {
  const col = { warm: '#d6342b', cold: '#2b5fd6', occluded: '#8a3fc0' }[kind];
  let out = `<path d="${smoothPath(pts)}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  const step = 40 * scale, r = 9.5 * scale;
  let acc = step * 0.6, n = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], seg = Math.hypot(bx - ax, by - ay);
    const tx = (bx - ax) / seg, ty = (by - ay) / seg, lx = ty, ly = -tx; // lewa strona w SVG (y w dół)
    while (acc < seg) {
      const x = ax + tx * acc, y = ay + ty * acc;
      const k = kind === 'occluded' ? (n % 2 ? 'warm' : 'cold') : kind;
      if (k === 'warm') out += `<path d="M${f1(x - tx * r)},${f1(y - ty * r)}A${f1(r)},${f1(r)} 0 0 1 ${f1(x + tx * r)},${f1(y + ty * r)}Z" fill="${col}"/>`; // półkole po lewej stronie (sweep 1 w układzie SVG)
      else out += `<path d="M${f1(x - tx * r)},${f1(y - ty * r)}L${f1(x + lx * r * 1.25)},${f1(y + ly * r * 1.25)}L${f1(x + tx * r)},${f1(y + ty * r)}Z" fill="${col}"/>`;
      acc += step; n++;
    }
    acc -= seg;
  }
  return out;
}

// Mapa synoptyczna dla pytania (q) – reveal: po odpowiedzi strzałki wiatru i ukryte elementy
export function synopticSVG(q, reveal = false) {
  const S = q.S, W = MAP.w, H = MAP.h, sc = W / 900;
  const X = (x) => x, Y = (y) => H - y;
  const P = (pts) => pts.map(([x, y]) => [X(x), Y(y)]);
  let s = `<svg viewBox="0 0 ${f1(W)} ${f1(H)}" class="mt-map" xmlns="http://www.w3.org/2000/svg">`;
  s += `<rect x="0" y="0" width="${f1(W)}" height="${f1(H)}" fill="#d7e9f4"/>`;
  for (const poly of LAND) s += `<path d="M${poly.map(([x, y]) => `${f1(X(x))},${f1(Y(y))}`).join('L')}Z" fill="#efe6d2" stroke="#b5a585" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
  // siatka geograficzna
  for (let lon = -10; lon <= 30; lon += 5) { const [x] = toXY(lon, 50); s += `<line x1="${f1(x)}" y1="0" x2="${f1(x)}" y2="${f1(H)}" stroke="#8aa3b8" stroke-width="0.6" stroke-dasharray="4 5" vector-effect="non-scaling-stroke"/><text x="${f1(x + 6 * sc)}" y="${f1(H - 8 * sc)}" font-size="${f1(11 * sc)}" fill="#5f7890">${Math.abs(lon)}°${lon < 0 ? 'W' : 'E'}</text>`; }
  for (let lat = 50; lat <= 65; lat += 5) { const [, y] = toXY(0, lat); s += `<line x1="0" y1="${f1(Y(y))}" x2="${f1(W)}" y2="${f1(Y(y))}" stroke="#8aa3b8" stroke-width="0.6" stroke-dasharray="4 5" vector-effect="non-scaling-stroke"/><text x="${f1(6 * sc)}" y="${f1(Y(y) - 5 * sc)}" font-size="${f1(11 * sc)}" fill="#5f7890">${lat}°N</text>`; }
  // izobary z opisami
  if (!q.hideIsobars || reveal) {
    for (const l of isobars(S)) {
      const pts = P(thin(l.pts, 28));
      if (pts.length < 3) continue;
      const major = l.p % 8 === 0;
      s += `<path d="${smoothPath(pts, l.closed)}" fill="none" stroke="#3f4a56" stroke-width="${major ? 1.6 : 1.1}" vector-effect="non-scaling-stroke" opacity="${q.hideIsobars ? 0.5 : 0.9}"/>`;
      const m = pts[Math.floor(pts.length * (l.closed ? 0.25 : 0.5))];
      if (m && m[0] > 40 * sc && m[0] < W - 40 * sc && m[1] > 30 * sc && m[1] < H - 30 * sc)
        s += `<text x="${f1(m[0])}" y="${f1(m[1] + 4 * sc)}" font-size="${f1(12 * sc)}" text-anchor="middle" fill="#2c3540" font-weight="700" stroke="#d7e9f4" stroke-width="${f1(4 * sc)}" paint-order="stroke">${l.p}</text>`;
    }
  }
  // fronty
  for (const f of S.fronts) s += frontSymbols(P(f.pts), f.kind, sc);
  // ośrodki niżów i wyżów (N/W po polsku, L/H po angielsku)
  if (!q.hideCenters || reveal) {
    for (const c of S.centers) {
      const low = c.kind === 'L', col = low ? '#c62828' : '#1f5fbf';
      s += `<text x="${f1(X(c.x))}" y="${f1(Y(c.y) + 13 * sc)}" font-size="${f1(40 * sc)}" font-weight="800" text-anchor="middle" fill="${col}" stroke="#fff" stroke-width="${f1(3 * sc)}" paint-order="stroke">${low ? L('N', 'L') : L('W', 'H')}</text>`;
      s += `<text x="${f1(X(c.x))}" y="${f1(Y(c.y) + 34 * sc)}" font-size="${f1(13 * sc)}" font-weight="700" text-anchor="middle" fill="${col}" stroke="#fff" stroke-width="${f1(3 * sc)}" paint-order="stroke">${c.p}</text>`;
    }
  }
  // kierunek przemieszczania się niżu
  if (S.fronts.length && (q.kind === 'front' || reveal)) {
    const c = S.centers[0], a = (S.move.dir * Math.PI) / 180, l0 = 60 * sc, l1 = 170 * sc;
    const x0 = X(c.x) + Math.sin(a) * l0, y0 = Y(c.y) - Math.cos(a) * l0, x1 = X(c.x) + Math.sin(a) * l1, y1 = Y(c.y) - Math.cos(a) * l1;
    s += `<line x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}" stroke="#1b2a3a" stroke-width="3" vector-effect="non-scaling-stroke" stroke-dasharray="7 4"/>${arrowHead(x1, y1, Math.atan2(y1 - y0, x1 - x0), 16 * sc, '#1b2a3a')}`;
    s += `<text x="${f1(x1 + 8 * sc)}" y="${f1(y1 - 6 * sc)}" font-size="${f1(12 * sc)}" font-weight="700" fill="#1b2a3a" stroke="#fff" stroke-width="${f1(3 * sc)}" paint-order="stroke">${S.move.kn} kn</text>`;
  }
  // stacje z symbolami wiatru
  for (const st of q.stations || []) s += barbSVG(X(st.x), Y(st.y), st.from, st.kn, 1.25 * sc);
  // punkty A i B; po odpowiedzi strzałki wiatru (w stronę, DOKĄD wieje)
  const mark = (p, name) => {
    let o = `<circle cx="${f1(X(p.x))}" cy="${f1(Y(p.y))}" r="${f1(9 * sc)}" fill="#ffd166" stroke="#1b2a3a" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
    o += `<text x="${f1(X(p.x) + 12 * sc)}" y="${f1(Y(p.y) - 10 * sc)}" font-size="${f1(19 * sc)}" font-weight="800" fill="#1b2a3a" stroke="#fff" stroke-width="${f1(4 * sc)}" paint-order="stroke">${name}</text>`;
    if (reveal) {
      const w = windAt(S, p.x, p.y), a = (w.to * Math.PI) / 180, l = (40 + Math.min(60, w.kn * 2.2)) * sc;
      const x0 = X(p.x) - Math.sin(a) * l * 0.5, y0 = Y(p.y) + Math.cos(a) * l * 0.5, x1 = X(p.x) + Math.sin(a) * l * 0.5, y1 = Y(p.y) - Math.cos(a) * l * 0.5;
      o += `<line x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}" stroke="#0e7c3a" stroke-width="4" vector-effect="non-scaling-stroke"/>${arrowHead(x1, y1, Math.atan2(y1 - y0, x1 - x0), 16 * sc, '#0e7c3a')}`;
      o += `<text x="${f1(X(p.x) + 12 * sc)}" y="${f1(Y(p.y) + 26 * sc)}" font-size="${f1(13 * sc)}" font-weight="800" fill="#0e7c3a" stroke="#fff" stroke-width="${f1(4 * sc)}" paint-order="stroke">${dir16(w.from)} ${Math.round(w.kn)} kn</text>`;
    }
    return o;
  };
  s += mark(q.A, 'A');
  if (q.B) s += mark(q.B, 'B');
  return s + '</svg>';
}

// legenda mapy
export function mapLegendSVG() {
  const fr = (kind, x) => frontSymbols([[x, 22], [x + 70, 22]], kind, 0.9);
  return `<svg viewBox="0 0 640 34" class="mt-legend" xmlns="http://www.w3.org/2000/svg">
    ${fr('warm', 6)}<text x="84" y="21" font-size="12" fill="#1b2a3a">${L('front ciepły', 'warm front')}</text>
    ${fr('cold', 176)}<text x="254" y="21" font-size="12" fill="#1b2a3a">${L('front chłodny', 'cold front')}</text>
    ${fr('occluded', 352)}<text x="430" y="21" font-size="12" fill="#1b2a3a">${L('okluzja', 'occlusion')}</text>
    <text x="504" y="22" font-size="16" font-weight="800" fill="#c62828">${L('N', 'L')}</text><text x="522" y="21" font-size="12" fill="#1b2a3a">${L('niż', 'low')}</text>
    <text x="560" y="22" font-size="16" font-weight="800" fill="#1f5fbf">${L('W', 'H')}</text><text x="582" y="21" font-size="12" fill="#1b2a3a">${L('wyż', 'high')}</text>
  </svg>`.replace(/\n\s*/g, '');
}

// Barograf: zapis 24 h na papierze milimetrowym
export function barographSVG(pts, reveal = false, d3 = 0) {
  const W = 640, H = 270, x0 = 52, x1 = W - 14, y0 = 16, y1 = H - 34;
  const lo = Math.floor(Math.min(...pts) - 2), hi = Math.ceil(Math.max(...pts) + 2);
  const X = (i) => x0 + (i / (pts.length - 1)) * (x1 - x0), Y = (p) => y1 - ((p - lo) / (hi - lo)) * (y1 - y0);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="mt-baro" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="#fbf6e9"/>`;
  for (let hh = 0; hh <= 24; hh++) { const x = x0 + (hh / 24) * (x1 - x0); s += `<line x1="${f1(x)}" y1="${y0}" x2="${f1(x)}" y2="${y1}" stroke="#eab48a" stroke-width="${hh % 3 ? 0.5 : 1}"/>`; if (hh % 3 === 0) s += `<text x="${f1(x)}" y="${y1 + 16}" font-size="11" text-anchor="middle" fill="#7a5a40">${hh === 24 ? L('teraz', 'now') : `−${24 - hh} h`}</text>`; }
  for (let p = lo; p <= hi; p++) { const y = Y(p); s += `<line x1="${x0}" y1="${f1(y)}" x2="${x1}" y2="${f1(y)}" stroke="#eab48a" stroke-width="${p % 2 ? 0.4 : 0.9}"/>`; if (p % 2 === 0) s += `<text x="${x0 - 6}" y="${f1(y + 4)}" font-size="11" text-anchor="end" fill="#7a5a40">${p}</text>`; }
  s += `<text x="8" y="${y1 + 16}" font-size="11" fill="#7a5a40">hPa</text>`;
  // ostatnie 3 godziny
  const xa = X(pts.length - 13);
  s += `<rect x="${f1(xa)}" y="${y0}" width="${f1(x1 - xa)}" height="${y1 - y0}" fill="#2f6fb0" opacity="0.08"/><text x="${f1((xa + x1) / 2)}" y="${y0 + 12}" font-size="10" text-anchor="middle" fill="#2f4468">${L('ostatnie 3 h', 'last 3 h')}</text>`;
  s += `<path d="${smoothPath(pts.map((p, i) => [X(i), Y(p)]))}" fill="none" stroke="#5a2ca0" stroke-width="2.2" stroke-linejoin="round"/>`;
  s += `<circle cx="${f1(X(pts.length - 1))}" cy="${f1(Y(pts[pts.length - 1]))}" r="4" fill="#5a2ca0"/>`;
  if (reveal) {
    const ya = Y(pts[pts.length - 13]), yb = Y(pts[pts.length - 1]);
    s += `<line x1="${f1(xa)}" y1="${f1(ya)}" x2="${f1(x1)}" y2="${f1(ya)}" stroke="#2f4468" stroke-dasharray="4 3"/><line x1="${f1(x1 - 4)}" y1="${f1(ya)}" x2="${f1(x1 - 4)}" y2="${f1(yb)}" stroke="#d0453b" stroke-width="2"/>`;
    s += `<text x="${f1(x1 - 10)}" y="${f1((ya + yb) / 2 + 4)}" font-size="13" font-weight="800" text-anchor="end" fill="#d0453b" stroke="#fbf6e9" stroke-width="4" paint-order="stroke">${d3 > 0 ? '+' : ''}${d3.toFixed(1).replace('.', L(',', '.'))} hPa / 3 h</text>`;
  }
  return s + '</svg>';
}

// ---------- schematy zjawisk ----------
const SEA = '#3d86b8', LAND_C = '#d9c79a', SKY_D = '#cfe6f5', SKY_N = '#1d2b45';
function arrow(x0, y0, x1, y1, col = '#1b2a3a', w = 4) { return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>${arrowHead(x1, y1, Math.atan2(y1 - y0, x1 - x0), 14, col)}`; }
function cloudShape(x, y, s, col = '#fff') { return `<g fill="${col}"><circle cx="${x}" cy="${y}" r="${18 * s}"/><circle cx="${x + 20 * s}" cy="${y - 10 * s}" r="${22 * s}"/><circle cx="${x + 44 * s}" cy="${y}" r="${17 * s}"/><rect x="${x - 4 * s}" y="${y}" width="${52 * s}" height="${16 * s}" rx="${8 * s}"/></g>`; }
function boatIcon(x, y, s = 1) { return `<g transform="translate(${x},${y}) scale(${s})"><path d="M-22,0 L22,0 L16,9 L-17,9 Z" fill="#fff" stroke="#2f4468" stroke-width="1.5"/><line x1="0" y1="0" x2="0" y2="-46" stroke="#2f4468" stroke-width="2"/><path d="M2,-44 L2,-4 L20,-4 Z" fill="#f4f1ea" stroke="#2f4468" stroke-width="1"/></g>`; }
export function phenSVG(fig, reveal = false) {
  const W = 520, H = 280;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="mt-fig" xmlns="http://www.w3.org/2000/svg">`;
  if (fig.type === 'breeze') {
    const day = fig.day;
    s += `<rect width="${W}" height="${H}" fill="${day ? SKY_D : SKY_N}"/>`;
    if (day) s += `<circle cx="70" cy="60" r="26" fill="#ffd166"/>`; else { s += `<circle cx="450" cy="55" r="20" fill="#f3f0d8"/><circle cx="460" cy="48" r="18" fill="${SKY_N}"/>`; for (let i = 0; i < 18; i++) s += `<circle cx="${(i * 97) % 500 + 10}" cy="${(i * 53) % 90 + 10}" r="1.4" fill="#fff"/>`; }
    s += `<rect x="0" y="200" width="270" height="80" fill="${SEA}"/><path d="M270,200 L520,190 L520,280 L270,280 Z" fill="${LAND_C}"/>`;
    s += `<rect x="350" y="165" width="26" height="26" fill="#f2efe8"/><path d="M346,167 L363,152 L380,167Z" fill="#c9553e"/><rect x="400" y="160" width="22" height="30" fill="#f2efe8"/><path d="M396,162 L411,148 L426,162Z" fill="#c9553e"/>`;
    s += boatIcon(130, 196, 0.9);
    s += `<text x="120" y="250" font-size="15" font-weight="700" fill="#fff">${L('morze', 'sea')}</text><text x="410" y="245" font-size="15" font-weight="700" fill="#5a4a2a">${L('ląd', 'land')}</text>`;
    s += `<text x="150" y="128" font-size="13" fill="${day ? '#2f4468' : '#dfe8f5'}">${day ? L('ląd cieplejszy od wody', 'land warmer than water') : L('ląd chłodniejszy od wody', 'land cooler than water')}</text>`;
    if (reveal) {
      const dir = day ? 1 : -1, c = '#d0453b';
      s += day ? arrow(60, 182, 300, 182, c) + arrow(400, 150, 400, 70, c) + arrow(330, 60, 120, 60, c) + arrow(110, 80, 110, 160, c)
        : arrow(470, 182, 200, 182, c) + arrow(120, 150, 120, 80, c) + arrow(180, 60, 400, 60, c) + arrow(430, 80, 430, 160, c);
      s += `<text x="${day ? 120 : 230}" y="176" font-size="14" font-weight="800" fill="${c}">${day ? L('bryza morska', 'sea breeze') : L('bryza lądowa', 'land breeze')}</text>`;
      void dir;
    }
  } else if (fig.type === 'thunder') {
    s += `<rect width="${W}" height="${H}" fill="#9aa7b4"/>` + cloudShape(60, 70, 2.6, '#5e6670') + `<path d="M150,120 L128,170 L148,170 L126,224" fill="none" stroke="#fff6a8" stroke-width="5" stroke-linejoin="round"/>`;
    s += `<rect x="0" y="220" width="${W}" height="60" fill="${SEA}"/>` + boatIcon(420, 220, 1);
    for (let i = 1; i <= 3; i++) s += `<path d="M${200 + i * 42},150 a60,60 0 0,1 0,70" fill="none" stroke="#fff" stroke-width="2" opacity="${1 - i * 0.22}"/>`;
    s += `<circle cx="440" cy="80" r="40" fill="#fff" stroke="#2f4468" stroke-width="3"/><line x1="440" y1="80" x2="${440 + Math.sin(fig.s / 60 * 2 * Math.PI) * 30}" y2="${80 - Math.cos(fig.s / 60 * 2 * Math.PI) * 30}" stroke="#d0453b" stroke-width="3"/><text x="440" y="140" font-size="15" font-weight="800" text-anchor="middle" fill="#1b2a3a">${fig.s} s</text>`;
  } else if (fig.type === 'shift' || fig.type === 'buys') {
    const cx = 260, cy = 140, R = 105;
    s += `<rect width="${W}" height="${H}" fill="#f4f8fb"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff" stroke="#9fb4c6" stroke-width="2"/>`;
    ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].forEach((d, i) => { const a = (i * 45 * Math.PI) / 180; s += `<text x="${f1(cx + Math.sin(a) * (R + 16))}" y="${f1(cy - Math.cos(a) * (R + 16) + 5)}" font-size="13" font-weight="800" text-anchor="middle" fill="#2f4468">${d}</text>`; });
    if (fig.type === 'shift') {
      fig.seq.forEach((d, i) => { const a = (d * Math.PI) / 180, r0 = R - 6, r1 = 22; const col = ['#9fb4c6', '#5f86b0', '#1f4f8a'][i];
        s += arrow(f1(cx + Math.sin(a) * r0), f1(cy - Math.cos(a) * r0), f1(cx + Math.sin(a) * r1), f1(cy - Math.cos(a) * r1), col, 5) + `<text x="${f1(cx + Math.sin(a) * (r0 - 18) + 10)}" y="${f1(cy - Math.cos(a) * (r0 - 18))}" font-size="14" font-weight="800" fill="${col}">${i + 1}</text>`; });
      if (reveal) { const a0 = fig.seq[0], a2 = fig.seq[2], cw = ((a2 - a0 + 360) % 360) < 180; s += `<path d="M${f1(cx + Math.sin(a0 * Math.PI / 180) * 70)},${f1(cy - Math.cos(a0 * Math.PI / 180) * 70)} A70,70 0 0,${cw ? 1 : 0} ${f1(cx + Math.sin(a2 * Math.PI / 180) * 70)},${f1(cy - Math.cos(a2 * Math.PI / 180) * 70)}" fill="none" stroke="#d0453b" stroke-width="3" stroke-dasharray="6 4"/>`; }
    } else {
      const a = (fig.from * Math.PI) / 180;
      s += arrow(f1(cx + Math.sin(a) * (R - 4)), f1(cy - Math.cos(a) * (R - 4)), f1(cx + Math.sin(a) * 26), f1(cy - Math.cos(a) * 26), '#2f6fb0', 6);
      s += `<circle cx="${cx}" cy="${cy}" r="11" fill="#ffd166" stroke="#1b2a3a" stroke-width="2"/>`;
      if (reveal) { const b = ((fig.from + 90) * Math.PI) / 180; s += `<text x="${f1(cx + Math.sin(b) * 62)}" y="${f1(cy - Math.cos(b) * 62 + 12)}" font-size="34" font-weight="800" text-anchor="middle" fill="#c62828">${L('N', 'L')}</text>`; }
    }
  } else if (fig.type === 'fog') {
    if (fig.adv) {
      s += `<rect width="${W}" height="${H}" fill="${SKY_D}"/><rect x="0" y="190" width="${W}" height="90" fill="#4a7fa3"/><path d="M380,190 L520,180 L520,280 L380,280Z" fill="${LAND_C}"/>`;
      s += arrow(500, 120, 330, 140, '#d0453b', 5) + `<text x="380" y="105" font-size="13" font-weight="700" fill="#d0453b">${L('ciepłe, wilgotne powietrze', 'warm, moist air')}</text>`;
      s += `<text x="40" y="250" font-size="13" font-weight="700" fill="#e6f2fb">${L('zimna woda (wiosna)', 'cold water (spring)')}</text>`;
      if (reveal) s += `<rect x="0" y="140" width="380" height="60" fill="#fff" opacity="0.8"/><text x="120" y="176" font-size="15" font-weight="800" fill="#5a6672">${L('mgła adwekcyjna', 'advection fog')}</text>`;
    } else {
      s += `<rect width="${W}" height="${H}" fill="${SKY_N}"/>`; for (let i = 0; i < 26; i++) s += `<circle cx="${(i * 89) % 510 + 5}" cy="${(i * 37) % 110 + 8}" r="1.3" fill="#fff"/>`;
      s += `<path d="M0,170 Q120,120 230,190 L330,200 Q420,130 520,150 L520,280 L0,280Z" fill="#3b4a35"/><rect x="230" y="200" width="100" height="80" fill="#2d4a66"/>`;
      s += `<text x="20" y="150" font-size="13" fill="#dfe8f5">${L('bezchmurna noc, cisza – ląd szybko stygnie', 'clear calm night – the land cools quickly')}</text>`;
      if (reveal) s += `<ellipse cx="280" cy="205" rx="150" ry="26" fill="#fff" opacity="0.75"/><text x="200" y="210" font-size="14" font-weight="800" fill="#5a6672">${L('mgła radiacyjna', 'radiation fog')}</text>`;
    }
  } else if (fig.type === 'apparent') {
    const cx = 200, cy = 170, k = 9;
    s += `<rect width="${W}" height="${H}" fill="#f4f8fb"/><g transform="translate(${cx},${cy})"><path d="M0,-38 C14,-20 14,20 10,34 L-10,34 C-14,20 -14,-20 0,-38Z" fill="#fff" stroke="#2f4468" stroke-width="2"/></g>`;
    const ta = fig.down ? Math.PI : (135 * Math.PI) / 180; // kierunek wiatru rzeczywistego (dokąd wieje) względem dziobu (w górę)
    const tx = Math.sin(ta) * fig.tw * k, ty = -Math.cos(ta) * fig.tw * k;
    s += arrow(cx - tx, cy - 60 - ty, cx, cy - 60, '#2f6fb0', 4) + `<text x="${cx - tx - 10}" y="${cy - 66 - ty}" font-size="13" font-weight="700" fill="#2f6fb0">${L('wiatr rzeczywisty', 'true wind')} ${fig.tw} kn</text>`;
    s += arrow(cx, cy + 50, cx, cy - 2 - 0, '#1b2a3a', 3) + `<text x="${cx + 14}" y="${cy + 46}" font-size="12" fill="#1b2a3a">${L('jacht', 'yacht')} ${fig.bs} kn</text>`;
    if (reveal) {
      const ax = tx, ay = ty + fig.bs * k; // wiatr pozorny = rzeczywisty − ruch jachtu (wektory „dokąd”)
      s += arrow(cx + 150 - ax, cy - 30 - ay, cx + 150, cy - 30, '#d0453b', 4) + `<text x="${cx + 160}" y="${cy - 36}" font-size="13" font-weight="800" fill="#d0453b">${L('pozorny', 'apparent')} ≈ ${Math.round(Math.hypot(ax, ay) / k)} kn</text>`;
    }
  } else if (fig.type === 'circ') {
    const cx = 260, cy = 140;
    s += `<rect width="${W}" height="${H}" fill="#eef5fb"/>`;
    for (const r of [40, 75, 110]) s += `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.5}" ry="${r}" fill="none" stroke="#3f4a56" stroke-width="1.5"/>`;
    s += `<text x="${cx}" y="${cy + 14}" font-size="38" font-weight="800" text-anchor="middle" fill="${fig.low ? '#c62828' : '#1f5fbf'}">${fig.low ? L('N', 'L') : L('W', 'H')}</text>`;
    if (reveal) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = 92, x = cx + Math.cos(a) * r * 1.5, y = cy + Math.sin(a) * r;
      const ccw = fig.low ? -1 : 1, inward = fig.low ? -0.35 : 0.35; // kierunek obiegu w SVG (y w dół)
      const tx = -Math.sin(a) * ccw * 1.5 + Math.cos(a) * inward * 1.5, ty = Math.cos(a) * ccw + Math.sin(a) * inward;
      const n = Math.hypot(tx, ty); s += arrow(f1(x - tx / n * 16), f1(y - ty / n * 16), f1(x + tx / n * 16), f1(y + ty / n * 16), '#d0453b', 3);
    }
  } else if (fig.type === 'squall') {
    s += `<rect width="${W}" height="${H}" fill="#aab6c2"/><path d="M0,40 Q140,10 300,30 Q420,40 520,20 L520,120 Q420,130 330,118 Q240,140 160,124 Q80,130 0,118Z" fill="#46505b"/>`;
    s += `<path d="M120,118 Q200,150 300,124 Q260,160 160,150 Q110,146 120,118Z" fill="#363e47"/>`;
    for (let i = 0; i < 26; i++) s += `<line x1="${180 + i * 12}" y1="130" x2="${170 + i * 12}" y2="220" stroke="#5d6a78" stroke-width="2" opacity="0.6"/>`;
    s += `<rect x="0" y="220" width="${W}" height="60" fill="#4b6f8a"/>` + boatIcon(110, 222, 1);
    s += arrow(470, 200, 360, 200, '#fff', 4) + `<text x="370" y="190" font-size="13" font-weight="800" fill="#fff">${L('szkwał', 'squall')}</text>`;
  }
  return s + '</svg>';
}

// piktogram stanu morza (do tabeli skali Beauforta)
export function seaStatePict(f) {
  const b = beaufort(f), W = 120, H = 44;
  const amp = Math.min(13, 1 + b.h * 1.6), lam = 14 + b.T * 4;
  let d = `M0,${H / 2}`;
  for (let x = 0; x <= W; x += 2) d += `L${x},${f1(H / 2 - amp * Math.sin((x / lam) * Math.PI * 2) * (0.8 + 0.2 * Math.sin(x * 0.07)))}`;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="mt-pict" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" rx="6" fill="#dbeaf3"/><path d="${d}L${W},${H}L0,${H}Z" fill="${f >= 8 ? '#47657c' : '#3d86b8'}"/>`;
  const caps = Math.round(b.foam * 22);
  for (let i = 0; i < caps; i++) { const x = ((i * 37) % W) + 3, y = H / 2 - amp * Math.sin((x / lam) * Math.PI * 2) - 1; s += `<ellipse cx="${x}" cy="${f1(y)}" rx="${3 + b.foam * 6}" ry="1.6" fill="#fff"/>`; }
  for (let i = 0; i < Math.round(b.streak * 5); i++) s += `<line x1="${8 + i * 22}" y1="${H - 8 - (i % 2) * 6}" x2="${26 + i * 22}" y2="${H - 8 - (i % 2) * 6}" stroke="#fff" stroke-width="1.5" opacity="0.85"/>`;
  if (b.spray > 0.3) for (let i = 0; i < Math.round(b.spray * 10); i++) s += `<circle cx="${(i * 29) % W}" cy="${4 + (i * 7) % 12}" r="1.3" fill="#fff" opacity="0.8"/>`;
  return s + '</svg>';
}
export { dir8 };
