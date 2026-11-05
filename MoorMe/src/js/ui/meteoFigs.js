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
// wspólny styl: gradientowe niebo, morze z falami, cieniowane chmury, jacht, opisy w „pigułkach”
let GID = 0;
const SEA = '#3d86b8', LAND_C = '#d9c79a', SKY_D = '#cfe6f5', SKY_N = '#1d2b45';
function arrow(x0, y0, x1, y1, col = '#1b2a3a', w = 4) { return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>${arrowHead(x1, y1, Math.atan2(y1 - y0, x1 - x0), 10 + w * 1.6, col)}`; }
// strzałka po łuku (przepływ powietrza w komórce cyrkulacji)
function curveArrow(d, end, ang, col = '#d0453b', w = 4) { return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>${arrowHead(end[0], end[1], ang, 10 + w * 1.6, col)}`; }
function pill(x, y, txt, col = '#1b2a3a', fs = 13, bg = '#ffffff') { const w = txt.length * fs * 0.56 + 16; return `<g><rect x="${f1(x - w / 2)}" y="${f1(y - fs * 0.9)}" width="${f1(w)}" height="${f1(fs * 1.6)}" rx="${f1(fs * 0.8)}" fill="${bg}" fill-opacity="0.9" stroke="${col}" stroke-opacity="0.55"/><text x="${f1(x)}" y="${f1(y + fs * 0.34)}" font-size="${fs}" font-weight="800" fill="${col}" text-anchor="middle" font-family="Nunito, sans-serif">${txt}</text></g>`; }
function sky(W, H, top, bot) { const id = `mfS${++GID}`; return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#${id})"/>`; }
function sea(y, W, H, top = '#4f97c4', bot = '#2a628c', waves = '#ffffff') {
  const id = `mfW${++GID}`;
  let w = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient></defs><rect x="0" y="${y}" width="${W}" height="${H - y}" fill="url(#${id})"/>`;
  for (let r = 0; r < 3; r++) { let d = ''; const yy = y + 10 + r * 16; for (let x = (r * 23) % 60; x < W; x += 60) d += `M${x},${yy} q8,-4 16,0 `; w += `<path d="${d}" fill="none" stroke="${waves}" stroke-width="1.4" opacity="${0.5 - r * 0.12}"/>`; }
  return w;
}
function cloud(x, y, s, col = '#ffffff', shade = '#d9e2ea') {
  return `<g><ellipse cx="${x + 26 * s}" cy="${y + 14 * s}" rx="${40 * s}" ry="${10 * s}" fill="${shade}" opacity="0.8"/><g fill="${col}"><circle cx="${x}" cy="${y}" r="${16 * s}"/><circle cx="${x + 18 * s}" cy="${y - 12 * s}" r="${21 * s}"/><circle cx="${x + 40 * s}" cy="${y - 4 * s}" r="${18 * s}"/><circle cx="${x + 56 * s}" cy="${y + 4 * s}" r="${12 * s}"/><rect x="${x - 6 * s}" y="${y}" width="${66 * s}" height="${14 * s}" rx="${7 * s}"/></g></g>`;
}
function boatIcon(x, y, s = 1) { return `<g transform="translate(${x},${y}) scale(${s})"><path d="M-24,0 L24,0 L17,10 L-18,10 Z" fill="#fff" stroke="#2f4468" stroke-width="1.6"/><line x1="0" y1="0" x2="0" y2="-50" stroke="#2f4468" stroke-width="2"/><path d="M2,-48 L2,-4 L22,-4 Z" fill="#f7f4ec" stroke="#2f4468" stroke-width="1"/><path d="M-2,-42 L-2,-4 L-16,-4 Z" fill="#eef1f5" stroke="#2f4468" stroke-width="1"/></g>`; }
function house(x, y, s = 1) { return `<g transform="translate(${x},${y}) scale(${s})"><rect x="-12" y="-22" width="24" height="22" fill="#f2efe8" stroke="#9a8a6a"/><path d="M-15,-20 L0,-34 L15,-20Z" fill="#c9553e"/><rect x="-4" y="-12" width="8" height="12" fill="#7a5a40"/></g>`; }
function tree(x, y, s = 1) { return `<g transform="translate(${x},${y}) scale(${s})"><rect x="-1.5" y="-10" width="3" height="10" fill="#6b4a2f"/><path d="M0,-34 L10,-14 L-10,-14Z M0,-26 L12,-6 L-12,-6Z" fill="#4f7d45"/></g>`; }
function thermo(x, y, warm) { const c = warm ? '#d0453b' : '#2f6fb0'; return `<g transform="translate(${x},${y})"><rect x="-4" y="-26" width="8" height="30" rx="4" fill="#fff" stroke="#5a6672"/><rect x="-2" y="${warm ? -22 : -6}" width="4" height="${warm ? 24 : 8}" fill="${c}"/><circle cx="0" cy="6" r="6" fill="${c}" stroke="#5a6672"/></g>`; }

export function phenSVG(fig, reveal = false) {
  const W = 520, H = 280;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="mt-fig" xmlns="http://www.w3.org/2000/svg" font-family="Nunito, sans-serif">`;
  if (fig.type === 'breeze') {
    const day = fig.day;
    s += day ? sky(W, H, '#8fc7ec', '#e6f3fb') : sky(W, H, '#0f1b33', '#2b3d5f');
    if (day) s += `<circle cx="70" cy="58" r="34" fill="#ffd166" opacity="0.35"/><circle cx="70" cy="58" r="24" fill="#ffd166"/>`;
    else { s += `<circle cx="452" cy="52" r="20" fill="#f3f0d8"/><circle cx="462" cy="45" r="18" fill="#16233f"/>`; for (let i = 0; i < 22; i++) s += `<circle cx="${(i * 97) % 500 + 10}" cy="${(i * 53) % 100 + 10}" r="${i % 3 ? 1.1 : 1.7}" fill="#fff" opacity="0.85"/>`; }
    s += sea(200, 290, H, day ? '#4f97c4' : '#2a5478', day ? '#2a628c' : '#173550');
    s += `<path d="M262,200 Q280,196 300,190 L520,178 L520,280 L262,280 Z" fill="${day ? '#cdb986' : '#6f6448'}"/><path d="M262,200 Q280,196 300,190 L520,178" fill="none" stroke="${day ? '#a8945f' : '#55492f'}" stroke-width="2"/>`;
    s += house(360, 186, 1) + house(410, 183, 1.1) + tree(460, 181, 1.1) + tree(330, 190, 0.9);
    s += boatIcon(140, 198, 0.95);
    s += pill(110, 250, L('morze', 'sea'), '#1b3f5f') + pill(420, 248, L('ląd', 'land'), '#5a4a2a');
    s += thermo(230, 150, !day) + thermo(470, 140, day);
    s += pill(260, 106, day ? L('w dzień ląd nagrzewa się szybciej', 'by day the land warms faster') : L('nocą ląd stygnie szybciej', 'at night the land cools faster'), day ? '#2f4468' : '#dfe8f5', 13, day ? '#ffffff' : '#1d2b45');
    if (reveal) {
      const c = '#d0453b';
      if (day) {
        s += arrow(70, 182, 300, 182, c, 5) + curveArrow('M330,176 Q420,170 420,90', [420, 84], -Math.PI / 2, c, 4) + arrow(400, 66, 140, 66, c, 3) + curveArrow('M110,76 Q86,120 96,168', [97, 172], Math.PI / 2 - 0.1, c, 3);
        s += pill(180, 168, L('bryza morska', 'sea breeze'), c, 14);
      } else {
        s += arrow(470, 186, 200, 186, c, 4) + curveArrow('M170,180 Q110,170 116,96', [116, 90], -Math.PI / 2, c, 3) + arrow(150, 70, 410, 70, c, 3) + curveArrow('M440,80 Q460,130 450,170', [449, 174], Math.PI / 2 + 0.1, c, 3);
        s += pill(300, 168, L('bryza lądowa', 'land breeze'), c, 14);
      }
    }
  } else if (fig.type === 'thunder') {
    s += sky(W, H, '#5d6874', '#a7b2bd') + cloud(40, 70, 2.8, '#4c5560', '#3c434c') + cloud(150, 52, 1.6, '#5e6773', '#48505a');
    s += `<path d="M150,122 L128,170 L150,170 L124,226" fill="none" stroke="#fff6a8" stroke-width="5" stroke-linejoin="round"/><path d="M150,122 L128,170 L150,170 L124,226" fill="none" stroke="#fffbd9" stroke-width="2" stroke-linejoin="round"/>`;
    s += sea(222, W, H, '#56778f', '#34526a') + boatIcon(420, 222, 1);
    for (let i = 1; i <= 3; i++) s += `<path d="M${210 + i * 40},150 a60,60 0 0,1 0,70" fill="none" stroke="#fff" stroke-width="2.5" opacity="${1 - i * 0.22}"/>`;
    const a = (fig.s / 60) * 2 * Math.PI;
    s += `<g transform="translate(440,82)"><circle r="40" fill="#fff" stroke="#2f4468" stroke-width="3"/>${Array.from({ length: 12 }, (_, k) => { const b = (k / 12) * 2 * Math.PI; return `<line x1="${f1(Math.sin(b) * 33)}" y1="${f1(-Math.cos(b) * 33)}" x2="${f1(Math.sin(b) * 37)}" y2="${f1(-Math.cos(b) * 37)}" stroke="#2f4468" stroke-width="2"/>`; }).join('')}<path d="M0,0 L0,-34 A34,34 0 ${a > Math.PI ? 1 : 0},1 ${f1(Math.sin(a) * 34)},${f1(-Math.cos(a) * 34)} Z" fill="#d0453b" opacity="0.25"/><line x1="0" y1="0" x2="${f1(Math.sin(a) * 30)}" y2="${f1(-Math.cos(a) * 30)}" stroke="#d0453b" stroke-width="3" stroke-linecap="round"/><circle r="3" fill="#2f4468"/></g>`;
    s += pill(440, 146, `${fig.s} s`, '#1b2a3a', 15);
  } else if (fig.type === 'shift' || fig.type === 'buys') {
    const cx = 260, cy = 140, R = 105;
    s += sky(W, H, '#f4f8fb', '#e4eef6');
    s += `<circle cx="${cx}" cy="${cy}" r="${R + 6}" fill="#fff" stroke="#c6d6e4" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#9fb4c6" stroke-width="1.5"/>`;
    for (let k = 0; k < 72; k++) { const b = (k * 5 * Math.PI) / 180, l = k % 9 === 0 ? 10 : 5; s += `<line x1="${f1(cx + Math.sin(b) * R)}" y1="${f1(cy - Math.cos(b) * R)}" x2="${f1(cx + Math.sin(b) * (R - l))}" y2="${f1(cy - Math.cos(b) * (R - l))}" stroke="#9fb4c6" stroke-width="1"/>`; }
    ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].forEach((d, i) => { const b = (i * 45 * Math.PI) / 180; s += `<text x="${f1(cx + Math.sin(b) * (R + 20))}" y="${f1(cy - Math.cos(b) * (R + 20) + 5)}" font-size="13" font-weight="800" text-anchor="middle" fill="${i === 0 ? '#c62828' : '#2f4468'}">${d}</text>`; });
    if (fig.type === 'shift') {
      fig.seq.forEach((d, i) => { const b = (d * Math.PI) / 180, r0 = R - 10, r1 = 24, col = ['#9fb4c6', '#5f86b0', '#1f4f8a'][i];
        s += arrow(f1(cx + Math.sin(b) * r0), f1(cy - Math.cos(b) * r0), f1(cx + Math.sin(b) * r1), f1(cy - Math.cos(b) * r1), col, 5) + pill(f1(cx + Math.sin(b) * (r0 + 4) + 0), f1(cy - Math.cos(b) * (r0 + 4)), String(i + 1), col, 12); });
      s += `<circle cx="${cx}" cy="${cy}" r="8" fill="#2f4468"/>`;
      if (reveal) { const a0 = fig.seq[0], a2 = fig.seq[2], cw = ((a2 - a0 + 360) % 360) < 180; s += `<path d="M${f1(cx + Math.sin(a0 * Math.PI / 180) * 70)},${f1(cy - Math.cos(a0 * Math.PI / 180) * 70)} A70,70 0 0,${cw ? 1 : 0} ${f1(cx + Math.sin(a2 * Math.PI / 180) * 70)},${f1(cy - Math.cos(a2 * Math.PI / 180) * 70)}" fill="none" stroke="#d0453b" stroke-width="3" stroke-dasharray="6 4"/>` + pill(cx + 150, 40, cw ? L('skręca w prawo', 'veering') : L('cofa się', 'backing'), '#d0453b', 13); }
    } else {
      const a = (fig.from * Math.PI) / 180;
      s += arrow(f1(cx + Math.sin(a) * (R - 6)), f1(cy - Math.cos(a) * (R - 6)), f1(cx + Math.sin(a) * 26), f1(cy - Math.cos(a) * 26), '#2f6fb0', 6);
      s += `<g transform="translate(${cx},${cy}) rotate(${fig.from + 180})"><circle r="12" fill="#ffd166" stroke="#1b2a3a" stroke-width="2"/><path d="M-6,-3 L0,-11 L6,-3" fill="none" stroke="#1b2a3a" stroke-width="2"/></g>`;
      s += pill(cx, H - 16, L('stoisz plecami do wiatru', 'back to the wind'), '#2f4468', 12);
      if (reveal) { const b = ((fig.from + 180 - 110) * Math.PI) / 180; s += `<text x="${f1(cx + Math.sin(b) * 64)}" y="${f1(cy - Math.cos(b) * 64 + 12)}" font-size="34" font-weight="800" text-anchor="middle" fill="#c62828" stroke="#fff" stroke-width="4" paint-order="stroke">${L('N', 'L')}</text>`; }
    }
  } else if (fig.type === 'fog') {
    if (fig.adv) {
      s += sky(W, H, '#bcd9ee', '#eaf3f9') + sea(190, W, H, '#3f7699', '#24506e');
      s += `<path d="M380,190 Q400,186 420,182 L520,176 L520,280 L380,280Z" fill="${LAND_C}"/>` + house(450, 178, 1) + tree(490, 176, 1);
      s += cloud(420, 80, 0.8, '#ffffff', '#e1e8ee');
      s += arrow(500, 128, 320, 146, '#d0453b', 5) + pill(400, 110, L('ciepłe, wilgotne powietrze', 'warm, moist air'), '#d0453b', 12);
      s += pill(110, 250, L('zimna woda (wiosna, początek lata)', 'cold water (spring, early summer)'), '#1b3f5f', 12);
      s += thermo(40, 160, false) + boatIcon(250, 190, 0.8);
      if (reveal) { const id = `mfF${++GID}`; s += `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.4" stop-color="#fff" stop-opacity="0.85"/><stop offset="1" stop-color="#fff" stop-opacity="0.9"/></linearGradient></defs><rect x="0" y="130" width="390" height="70" fill="url(#${id})"/>` + pill(170, 168, L('mgła adwekcyjna', 'advection fog'), '#5a6672', 14); }
    } else {
      s += sky(W, H, '#0f1b33', '#33466a'); for (let i = 0; i < 26; i++) s += `<circle cx="${(i * 89) % 510 + 5}" cy="${(i * 37) % 110 + 8}" r="${i % 4 ? 1.1 : 1.7}" fill="#fff" opacity="0.9"/>`;
      s += `<circle cx="70" cy="44" r="16" fill="#f3f0d8"/>`;
      s += `<path d="M0,168 Q120,118 230,190 L330,200 Q420,128 520,148 L520,280 L0,280Z" fill="#33432f"/>` + `<rect x="230" y="196" width="100" height="84" fill="#203a55"/>`;
      s += tree(80, 150, 1.1) + tree(110, 140, 1) + tree(450, 140, 1.1) + house(400, 150, 0.9);
      s += pill(260, 108, L('bezchmurna, bezwietrzna noc – ląd szybko stygnie', 'clear, calm night – the land cools quickly'), '#dfe8f5', 12, '#1d2b45');
      if (reveal) s += `<ellipse cx="280" cy="200" rx="170" ry="30" fill="#fff" opacity="0.72"/><ellipse cx="160" cy="176" rx="80" ry="14" fill="#fff" opacity="0.5"/>` + pill(280, 204, L('mgła radiacyjna', 'radiation fog'), '#5a6672', 14);
    }
  } else if (fig.type === 'apparent') {
    const cx = 200, cy = 170, k = 9;
    s += sky(W, H, '#f4f8fb', '#e4eef6');
    s += `<g transform="translate(${cx},${cy})"><path d="M0,-40 C15,-20 15,20 11,36 L-11,36 C-15,20 -15,-20 0,-40Z" fill="#fff" stroke="#2f4468" stroke-width="2"/><line x1="0" y1="-14" x2="0" y2="26" stroke="#2f4468" stroke-width="1.5"/></g>`;
    const ta = fig.down ? Math.PI : (135 * Math.PI) / 180;
    const tx = Math.sin(ta) * fig.tw * k, ty = -Math.cos(ta) * fig.tw * k;
    s += arrow(cx - tx, cy - 60 - ty, cx, cy - 60, '#2f6fb0', 4) + pill(cx - tx + 10, cy - 78 - ty, `${L('wiatr rzeczywisty', 'true wind')} ${fig.tw} kn`, '#2f6fb0', 12);
    s += arrow(cx, cy + 52, cx, cy - 2, '#1b2a3a', 3) + pill(cx + 56, cy + 56, `${L('ruch jachtu', 'boat speed')} ${fig.bs} kn`, '#1b2a3a', 12);
    if (reveal) {
      const ax = tx, ay = ty + fig.bs * k;
      s += arrow(cx + 150 - ax, cy - 30 - ay, cx + 150, cy - 30, '#d0453b', 4) + pill(cx + 170, cy - 8, `${L('wiatr pozorny', 'apparent wind')} ≈ ${Math.round(Math.hypot(ax, ay) / k)} kn`, '#d0453b', 12);
    }
  } else if (fig.type === 'circ') {
    const cx = 260, cy = 140, low = fig.low;
    const id = `mfC${++GID}`;
    s += `<defs><radialGradient id="${id}" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stop-color="${low ? '#f4c9c5' : '#c9dbf4'}"/><stop offset="1" stop-color="#f4f8fb"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#${id})"/>`;
    for (const r of [40, 75, 110]) s += `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.5}" ry="${r}" fill="none" stroke="#3f4a56" stroke-width="1.5"/>`;
    [[40, low ? 1000 : 1028], [75, low ? 1004 : 1024], [110, low ? 1008 : 1020]].forEach(([r, p]) => { s += `<text x="${cx + r * 1.5}" y="${cy + 4}" font-size="11" font-weight="700" fill="#3f4a56" text-anchor="middle" stroke="#f4f8fb" stroke-width="4" paint-order="stroke">${p}</text>`; });
    s += `<text x="${cx}" y="${cy + 14}" font-size="40" font-weight="800" text-anchor="middle" fill="${low ? '#c62828' : '#1f5fbf'}">${low ? L('N', 'L') : L('W', 'H')}</text>`;
    s += pill(cx, H - 14, low ? L('niż: powietrze zbiega się i unosi', 'low: air converges and rises') : L('wyż: powietrze osiada i rozbiega się', 'high: air sinks and diverges'), low ? '#c62828' : '#1f5fbf', 12);
    if (reveal) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = 92, x = cx + Math.cos(a) * r * 1.5, y = cy + Math.sin(a) * r;
      const ccw = low ? -1 : 1, inward = low ? -0.35 : 0.35;
      const tx = -Math.sin(a) * ccw * 1.5 + Math.cos(a) * inward * 1.5, ty = Math.cos(a) * ccw + Math.sin(a) * inward;
      const n = Math.hypot(tx, ty); s += arrow(f1(x - tx / n * 16), f1(y - ty / n * 16), f1(x + tx / n * 16), f1(y + ty / n * 16), '#d0453b', 3);
    }
  } else if (fig.type === 'squall') {
    s += sky(W, H, '#69737e', '#b8c3cd');
    s += `<path d="M0,40 Q140,10 300,30 Q420,40 520,20 L520,124 Q420,132 330,120 Q240,142 160,126 Q80,132 0,120Z" fill="#46505b"/>`;
    s += `<path d="M90,120 Q200,160 320,126 Q290,168 170,160 Q100,154 90,120Z" fill="#363e47"/><path d="M110,130 Q200,156 300,132" fill="none" stroke="#2b3138" stroke-width="2"/>`;
    for (let i = 0; i < 30; i++) s += `<line x1="${200 + i * 10}" y1="132" x2="${188 + i * 10}" y2="222" stroke="#5d6a78" stroke-width="2" opacity="0.55"/>`;
    s += sea(222, W, H, '#5b7d96', '#35546c', '#e8f0f6');
    for (let i = 0; i < 8; i++) s += `<path d="M${250 + i * 30},${232 + (i % 2) * 8} q6,-5 12,0" fill="none" stroke="#fff" stroke-width="2"/>`;
    s += boatIcon(110, 222, 1);
    s += arrow(470, 196, 340, 196, '#fff', 5) + pill(405, 176, L('szkwał – nagły poryw', 'squall – sudden gust'), '#ffffff', 12, '#46505b');
    s += pill(200, 84, L('wał szkwałowy', 'roll cloud'), '#ffffff', 12, '#46505b');
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
