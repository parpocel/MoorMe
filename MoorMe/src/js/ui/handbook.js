// Podręczniki („Nauka”): światła i znaki dzienne statków, sygnały dźwiękowe, oznakowanie nawigacyjne IALA.
// Ilustracje są generowane z tych samych danych, z których korzysta symulacja – podręcznik zawsze zgadza się z treningiem.
import { h } from './dom.js';
import { VESSELS, DAY_VESSELS, visibleLights } from '../data/shipLights.js';
import { SIGNALS, CONTEXTS, notation, schedule } from '../data/soundSignals.js';
import { lateralColors, IALA } from '../data/passage.js';
import { lightSequence, lightAt, LIGHT_COLORS } from '../data/lightChar.js';
import { getLang, t } from '../i18n.js';

const L = (pl, en) => (getLang() === 'en' ? en : pl);
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (w, hgt, inner, cls = '') => { const d = document.createElement('div'); d.className = 'hb-svg ' + cls; d.innerHTML = `<svg xmlns="${NS}" viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}">${inner}</svg>`; return d; };
const LCOL = { white: '#f7f9ff', red: '#ff3b2f', green: '#29e05a', yellow: '#ffd166', blue: '#3a8bff', deck: '#ffd9a0' };

// ---------- światła statków ----------
// widok: rel – kąt obserwatora od dziobu; mapowanie (x, z) statku na oś ekranu
const VIEWS = [
  { rel: 0, name: 'Od dziobu', ax: (l) => -l.z, kind: 'end' },
  { rel: 90, name: 'Z prawej burty', ax: (l) => l.x, kind: 'side' },
  { rel: 180, name: 'Od rufy', ax: (l) => l.z, kind: 'end' },
  { rel: -90, name: 'Z lewej burty', ax: (l) => -l.x, kind: 'side' }
];
function vesselLights(v) {
  const Lm = (v.L[0] + v.L[1]) / 2;
  return { Lm, lights: v.lights(Lm, () => 0.5, { gearSide: 'starboard' }) };
}
// zasięg kadru w danym widoku: kadłub i wszystkie światła (także niewidoczne)
function viewSpan(view, Lm, lights) {
  const beam = Math.min(14, Math.max(5, Lm * 0.16));
  const xs = lights.map(view.ax).concat(view.kind === 'side' ? [-Lm / 2, Lm / 2] : [-beam / 2, beam / 2]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), beam };
}
// skala pionowa wspólna dla wszystkich czterech widoków statku (światła na tej samej wysokości w każdym obrazku);
// w poziomie długi kadłub widziany z burty jest w razie potrzeby skrócony, żeby zmieścił się w kadrze
function vesselScale(v, W = 200, H = 120) {
  const { lights } = vesselLights(v);
  return (H - 30) / Math.max(...lights.map((l) => l.y), 6);
}
function lightView(v, view, W = 200, H = 120, sc = vesselScale(v, W, H)) {
  const { Lm, lights } = vesselLights(v);
  const vis = visibleLights(lights, view.rel);
  const { x0, x1, beam } = viewSpan(view, Lm, lights);
  const sx = Math.min(sc, (W - 30) / Math.max(1, x1 - x0));
  const X = (x) => W / 2 + (x - (x0 + x1) / 2) * sx, Y = (y) => H - 14 - y * sc;
  let g = `<rect width="${W}" height="${H}" fill="#0b1220"/><rect y="${H - 14}" width="${W}" height="14" fill="#0f1c2e"/>`;
  // zarys kadłuba (bardzo ciemny – nocą widać tylko światła)
  const hullCol = '#1d2635', edge = ''; // kadłub jak cień – nocą widać głównie światła
  if (view.kind === 'side') {
    const s = view.rel > 0 ? 1 : -1, a = X(-s * Lm / 2), b = X(s * Lm / 2), hh = Math.max(1.2, Lm * 0.05) * sc;
    g += `<polygon points="${a},${Y(0)} ${b - s * 6},${Y(0)} ${b},${Y(0) - hh} ${a},${Y(0) - hh}" fill="${hullCol}" ${edge}/>`;
    if (Lm > 20) g += `<rect x="${Math.min(a, a + s * Lm * 0.15 * sx)}" y="${Y(0) - hh * 1.8}" width="${Lm * 0.15 * sx}" height="${hh * 0.8}" fill="${hullCol}" ${edge}/>`;
    else g += `<rect x="${X(0) - 1}" y="${Y(14)}" width="2" height="${Y(0) - Y(14) - hh}" fill="${hullCol}" ${edge}/>`;
  } else {
    const hb = (beam / 2) * sx;
    const hh = Math.max(1.2, Lm * 0.05) * sc;
    g += `<polygon points="${X(0) - hb},${Y(0) - hh} ${X(0) + hb},${Y(0) - hh} ${X(0) + hb * 0.8},${Y(0)} ${X(0) - hb * 0.8},${Y(0)}" fill="${hullCol}" ${edge}/>`;
    if (Lm > 20) g += `<rect x="${X(0) - hb * 0.6}" y="${Y(0) - hh * 1.8}" width="${hb * 1.2}" height="${hh * 0.8}" fill="${hullCol}" ${edge}/>`;
    else g += `<rect x="${X(0) - 1}" y="${Y(14)}" width="2" height="${Y(0) - Y(14) - hh}" fill="${hullCol}" ${edge}/>`;
  }
  // jednostka holowana (barka) i lina holownicza – sylwetka między jej światłami burtowymi (dziób) a rufowym
  const towed = lights.filter((l) => l.x < -Lm / 2 - 20);
  if (towed.length) {
    const bx0 = Math.min(...towed.map((l) => l.x)), bx1 = Math.max(...towed.map((l) => l.x)) + 3, bh = Math.max(1.2, Lm * 0.04) * sc;
    if (view.kind === 'side') {
      const a1 = X(view.ax({ x: bx0, z: 0 })), b1 = X(view.ax({ x: bx1, z: 0 })), t0 = X(view.ax({ x: -Lm / 2, z: 0 }));
      g += `<line x1="${t0}" y1="${Y(0) - bh * 0.9}" x2="${b1}" y2="${Y(0) - bh * 0.6}" stroke="#3a4558" stroke-width="1"/>`;
      g += `<rect x="${Math.min(a1, b1)}" y="${Y(0) - bh}" width="${Math.abs(b1 - a1)}" height="${bh}" fill="#1a2231" ${edge}/>`;
    } else {
      const bb = Math.max(...towed.map((l) => Math.abs(l.z))) * sx;
      g = g.replace(/(<polygon)/, `<rect x="${X(0) - bb}" y="${Y(0) - bh}" width="${bb * 2}" height="${bh}" fill="#1a2231" ${edge}/>$1`);
    }
  }
  // maszty / nadbudówki: pionowe linie od pokładu do najwyższego światła w danym miejscu – światła siedzą na sylwetce
  {
    const deckY = Y(0) - Math.max(1.2, Lm * 0.05) * sc, cols = new Map();
    for (const l of lights) {
      const cx = X(view.ax(l)), cy = Y(l.y);
      if (cy > deckY - 3) continue; // światła burtowe i pokładowe są na kadłubie
      const k = Math.round(cx / 3);
      cols.set(k, Math.min(cols.get(k) ?? Infinity, cy));
    }
    for (const [k, top] of cols) g += `<line x1="${k * 3}" y1="${deckY}" x2="${k * 3}" y2="${top}" stroke="#273246" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  for (const l of vis) {
    const cx = X(view.ax(l)), cy = Y(l.y), c = LCOL[l.c];
    const rr = l.c === 'deck' ? 2.2 : 4; // samo światło, bez poświaty – w kolumnie świateł poświaty zlewały się ze sobą
    g += `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${c}"/>`;
  }
  return g;
}
function lightsEntry(v) {
  const sc = vesselScale(v);
  const views = h('div.hb-views', {}, ...VIEWS.map((vw) => h('figure', {}, svgEl(200, 120, lightView(v, vw, 200, 120, sc)), h('figcaption', {}, vw.name))));
  return h('div.hb-entry', {}, h('h3', {}, v.name), views, h('p', {}, v.explain));
}

// ---------- znaki dzienne ----------
function shape(k, cx, cy, s) {
  const b = '#16181c';
  if (k === 'ball') return `<circle cx="${cx}" cy="${cy}" r="${s * 0.5}" fill="${b}"/>`;
  if (k === 'coneUp') return `<polygon points="${cx},${cy - s * 0.5} ${cx + s * 0.5},${cy + s * 0.5} ${cx - s * 0.5},${cy + s * 0.5}" fill="${b}"/>`;
  if (k === 'coneDown') return `<polygon points="${cx},${cy + s * 0.5} ${cx + s * 0.5},${cy - s * 0.5} ${cx - s * 0.5},${cy - s * 0.5}" fill="${b}"/>`;
  if (k === 'diamond') return `<polygon points="${cx},${cy - s * 0.7} ${cx + s * 0.45},${cy} ${cx},${cy + s * 0.7} ${cx - s * 0.45},${cy}" fill="${b}"/>`;
  if (k === 'cylinder') return `<rect x="${cx - s * 0.35}" y="${cy - s * 0.7}" width="${s * 0.7}" height="${s * 1.4}" fill="${b}"/>`;
  if (k === 'coneDownB') return `<polygon points="${cx},${cy + s * 0.5} ${cx + s * 0.5},${cy - s * 0.5} ${cx - s * 0.5},${cy - s * 0.5}" fill="#1f5fd1"/>`;
  if (k === 'ballR') return `<circle cx="${cx}" cy="${cy}" r="${s * 0.5}" fill="#d62a1e" stroke="#16181c" stroke-width="0.8"/>`;
  if (k === 'diamondG') return `<polygon points="${cx},${cy - s * 0.7} ${cx + s * 0.45},${cy} ${cx},${cy + s * 0.7} ${cx - s * 0.45},${cy}" fill="#1fa64a" stroke="#16181c" stroke-width="0.8"/>`;
  if (k === 'flagR') return `<rect x="${cx - s * 0.6}" y="${cy - s * 0.4}" width="${s * 1.2}" height="${s * 0.8}" fill="#d62a1e" stroke="#16181c" stroke-width="0.6"/>`;
  if (k === 'flagRW') return `<rect x="${cx - s * 0.6}" y="${cy - s * 0.4}" width="${s * 1.2}" height="${s * 0.4}" fill="#d62a1e"/><rect x="${cx - s * 0.6}" y="${cy}" width="${s * 1.2}" height="${s * 0.4}" fill="#f4f4f0"/><rect x="${cx - s * 0.6}" y="${cy - s * 0.4}" width="${s * 1.2}" height="${s * 0.8}" fill="none" stroke="#16181c" stroke-width="0.6"/>`;
  if (k === 'ballG') return `<circle cx="${cx}" cy="${cy}" r="${s * 0.5}" fill="#1fa64a" stroke="#16181c" stroke-width="0.8"/>`;
  if (k === 'cylW') return `<rect x="${cx - s * 0.35}" y="${cy - s * 0.6}" width="${s * 0.7}" height="${s * 1.2}" fill="#f4f4f0" stroke="#16181c" stroke-width="0.8"/>`;
  if (k === 'pennantR') return `<polygon points="${cx},${cy - s * 0.5} ${cx},${cy + s * 0.2} ${cx - s * 1.4},${cy - s * 0.15}" fill="#d62a1e"/>`;
  if (k === 'ballY') return `<circle cx="${cx}" cy="${cy}" r="${s * 0.5}" fill="#f2c230" stroke="#16181c" stroke-width="0.8"/>`;
  if (k === 'cylYB') {
    // żółty walec: od góry biały, czarny, żółty, czarny, biały pas
    const w = s * 0.7, x = cx - w / 2, H = s * 1.5, y0 = cy - H / 2, parts = [['#f4f4f0', 0.1], ['#16181c', 0.13], ['#f2c230', 0.54], ['#16181c', 0.13], ['#f4f4f0', 0.1]];
    let y = y0, out = '';
    for (const [c, f] of parts) { out += `<rect x="${x}" y="${y}" width="${w}" height="${H * f}" fill="${c}"/>`; y += H * f; }
    return out + `<rect x="${x}" y="${y0}" width="${w}" height="${H}" fill="none" stroke="#16181c" stroke-width="0.8"/>`;
  }
  if (k === 'hourglass') return `<polygon points="${cx - s * 0.5},${cy - s * 0.75} ${cx + s * 0.5},${cy - s * 0.75} ${cx},${cy}" fill="${b}"/><polygon points="${cx - s * 0.5},${cy + s * 0.75} ${cx + s * 0.5},${cy + s * 0.75} ${cx},${cy}" fill="${b}"/>`;
  return '';
}
// znaki na rei: ile znaków jest nad reją (na maszcie) – od tego zależy wysokość rysunku
const yardTop = (v) => { const sh = v.shapes((v.L[0] + v.L[1]) / 2, () => 0.5, { gearSide: 'starboard' }), y = sh.find((q) => q.k === 'yard'); return y ? sh.filter((q) => q.k !== 'yard' && Math.abs(q.z) < 1 && q.y > y.y).length : -1; };
const dayH = (v) => Math.max(150, 16 + Math.max(0, yardTop(v)) * 24 + 102);
function dayView(v, W = 300, H = dayH(v)) {
  const Lm = (v.L[0] + v.L[1]) / 2;
  const shapes = v.shapes(Lm, () => 0.5, { gearSide: 'starboard' }).filter((s) => s.x > -Lm); // holowana jednostka – osobno w opisie
  const towedS = v.shapes(Lm, () => 0.5, { gearSide: 'starboard' }).filter((s) => s.x <= -Lm);
  let g = `<rect width="${W}" height="${H}" fill="#cfe6f4"/><rect y="${H - 22}" width="${W}" height="22" fill="#7fb4cf"/>`;
  const base = H - 22, hullW = towedS.length ? 130 : 220, x0 = towedS.length ? W - hullW - 12 : (W - hullW) / 2;
  // zestaw holowany (śródlądowy): barki z lewej, każda ze swoim znakiem na krótkim maszcie, połączone holem
  const barges = [...new Set(towedS.map((s) => s.x))].sort((a, b) => a - b);
  barges.forEach((x, i) => {
    const bx = 8 + i * 72, bw = 60, ks = towedS.filter((s) => s.x === x).sort((a, b) => a.y - b.y), top = base - 46 - (ks.length - 1) * 18;
    g += `<polygon points="${bx},${base - 12} ${bx + bw},${base - 12} ${bx + bw - 6},${base} ${bx + 4},${base}" fill="#8b929b"/>`;
    g += `<rect x="${bx + bw / 2 - 1}" y="${top}" width="2" height="${base - 12 - top}" fill="#6f767f"/>` + ks.map((s, j) => shape(s.k, bx + bw / 2, base - 52 - j * 18, 14)).join('');
    g += `<line x1="${bx + bw}" y1="${base - 8}" x2="${i === barges.length - 1 ? x0 + 4 : bx + 72}" y2="${base - 8}" stroke="#6f767f" stroke-width="1.2"/>`;
  });
  const grey = '#8b929b', dark = '#6f767f';
  if (v.hull === 'yacht') {
    g += `<polygon points="${x0 + 50},${base - 14} ${x0 + 175},${base - 14} ${x0 + 160},${base} ${x0 + 62},${base}" fill="${grey}"/><rect x="${x0 + 110}" y="${base - 112}" width="3" height="98" fill="${dark}"/><polygon points="${x0 + 113},${base - 108} ${x0 + 170},${base - 18} ${x0 + 113},${base - 18}" fill="#eef2f5"/>`;
  } else {
    const hh = v.hull === 'ship' ? 22 : 18;
    g += `<polygon points="${x0},${base - hh} ${x0 + hullW},${base - hh} ${x0 + hullW - 18},${base} ${x0 + 8},${base}" fill="${grey}"/>`;
    g += `<rect x="${x0 + 18}" y="${base - hh - 26}" width="46" height="26" fill="${dark}"/>`;
    g += `<rect x="${x0 + hullW * 0.5}" y="${base - hh - 90}" width="4" height="90" fill="${dark}"/>`;
    if (v.hull === 'trawler') g += `<path d="M${x0 + hullW * 0.5 + 2} ${base - hh - 80} L${x0 + hullW - 10} ${base - hh}" stroke="${dark}" stroke-width="2"/>`;
  }
  // kształty na maszcie: pionowa kolumna nad pokładem; przesunięte na burtę – obok
  const mx = v.hull === 'yacht' ? x0 + 111 : x0 + hullW * 0.5 + 2;
  const nTop = yardTop(v);
  if (nTop < 0 && v.clear) {
    // znaki przy burtach na drzewcach (bez rei) – rysunek jak od rufy; na maszcie kolumna znaków
    const ys = shapes.filter((q) => Math.abs(q.z) < 1).sort((a, b) => b.y - a.y), deck = base - 18;
    g += `<rect x="${mx - 1}" y="8" width="3" height="${base - 28}" fill="${dark}"/>`;
    ys.forEach((q, i) => { g += shape(q.k, mx + 1, 18 + i * 24, 14); });
    for (const sg of [-1, 1]) {
      const col2 = shapes.filter((q) => Math.sign(q.z) === sg && Math.abs(q.z) >= 1).sort((a, b) => b.y - a.y), cx = mx + 1 + sg * 48;
      g += `<rect x="${cx - 1}" y="${deck - 62}" width="2" height="62" fill="${dark}"/>`;
      col2.forEach((q, i) => { g += shape(q.k, cx, deck - 50 + i * 26, 16); });
    }
    return g;
  }
  if (nTop >= 0) {
    // znaki na końcach rei (np. strona przeszkody i wolnego przejścia) – rysunek jak od rufy (prawa burta statku po prawej);
    // znaki na maszcie nad reją – w pionie nad nią
    const ty = 16 + nTop * 24, yd = shapes.find((q) => q.k === 'yard'), ys = shapes.filter((q) => q.k !== 'yard');
    g += `<rect x="${mx - 1}" y="${nTop ? 8 : ty}" width="3" height="${base - (nTop ? 8 : ty) - 20}" fill="${dark}"/><rect x="${mx - 46}" y="${ty + 4}" width="94" height="3" fill="${dark}"/>`;
    ys.filter((q) => Math.abs(q.z) < 1 && q.y > yd.y).sort((a, b) => b.y - a.y).forEach((q, i) => { g += shape(q.k, mx + 1, 18 + i * 24, 14); });
    for (const sg of [-1, 1]) {
      const col2 = ys.filter((q) => Math.sign(q.z) === sg && Math.abs(q.z) >= 1).sort((a, b) => b.y - a.y), cx = mx + 1 + sg * 42;
      g += `<line x1="${cx}" y1="${ty + 7}" x2="${cx}" y2="${ty + 14}" stroke="${dark}" stroke-width="1"/>`;
      col2.forEach((q, i) => { g += shape(q.k, cx, ty + 24 + i * 26, 16); });
    }
    return g;
  }
  const sorted = [...shapes].sort((a, b) => b.y - a.y);
  let y = base - (v.hull === 'yacht' ? 92 : 104);
  for (const s of sorted) {
    if (s.k === 'pennantR' || (shapes.length > 1 && s.x > Lm * 0.3)) { const px = x0 + hullW - 26; g += `<rect x="${px - 1}" y="${base - 62}" width="2" height="${40}" fill="${dark}"/>` + shape(s.k, px, base - 54, 16); continue; } // proporzec na dziobie
    if (Math.abs(s.z) > 1) { g += shape(s.k, mx + 40, base - 52, 16); g += `<path d="M${mx} ${base - 70} L${mx + 40} ${base - 60}" stroke="${dark}" stroke-width="1.5"/>`; continue; }
    g += shape(s.k, mx, y, 16); y += s.k === 'hourglass' ? 30 : s.k === 'diamond' ? 26 : 22;
  }
  if (!shapes.length) g += `<text x="${W / 2}" y="22" text-anchor="middle" font-size="13" font-family="sans-serif" fill="#2f4468">${t('brak znaków')}</text>`;
  return g;
}
const dayEntry = (v) => h('div.hb-entry', {}, h('h3', {}, v.name), svgEl(300, dayH(v), dayView(v)), h('p', {}, v.explain));

export function lightsBook() {
  return [
    { id: 'intro', name: L('Zasady', 'Basics'), entries: [h('div.hb-entry', {},
      h('h3', {}, L('Sektory świateł', 'Light sectors')),
      svgEl(320, 220, sectorDiagram()),
      h('p', {}, L('Masztowe (białe) świeci 225° do przodu, burtowe po 112,5°: zielone na prawej, czerwone na lewej burcie. Rufowe (białe) – 135° do tyłu. Światła dookólne widać z każdej strony. Kolory widziane z boku i z dziobu mówią, w którą stronę płynie statek.', 'The masthead light (white) shows over 225° ahead, the sidelights over 112.5° each: green to starboard, red to port. The sternlight (white) shows over 135° astern. All-round lights are seen from every direction. The colours you see tell you which way a vessel is heading.')),
      h('p', {}, L('Pamiętaj: patrząc na statek od dziobu widzisz jego zieloną burtę po swojej lewej, a czerwoną po prawej.', 'Remember: looking at a vessel head-on, its green side is on your left and its red side on your right.')))] },
    { id: 'night', name: L('Światła nocne', 'Night lights'), entries: VESSELS.filter((v) => !v.inland).flatMap((v) => (v.id !== 'sailing' ? [lightsEntry(v)] : [lightsEntry(v),
      // wariant jachtu: dodatkowe czerwone nad zielonym na topie masztu
      lightsEntry({ ...v, name: L('Jednostka żaglowa w drodze – czerwone nad zielonym', 'Sailing vessel underway – red over green'), lights: (Lm, r, o) => v.lights(Lm, () => 0.9, o),
        explain: L('Oprócz świateł burtowych i rufowego jednostka żaglowa może nieść na topie masztu dwa światła dookólne w pionie: czerwone nad zielonym („czerwone nad zielonym – żeglarz”). Nie wolno ich łączyć z latarnią trójsektorową. Nie myl ich z czerwonym nad białym (rybak) ani zielonym nad białym (trawler).', 'In addition to the sidelights and sternlight a sailing vessel may show at the masthead two all-round lights in a vertical line: red over green (“red over green, sailing machine”). They must not be combined with a tricolour lantern. Do not confuse them with red over white (fishing) or green over white (trawling).') })])) },
    { id: 'day', name: L('Znaki dzienne', 'Day shapes'), entries: DAY_VESSELS.filter((v) => !v.inland).map(dayEntry) },
    { id: 'inland', name: L('Drogi śródlądowe (CEVNI)', 'Inland waterways (CEVNI)'), entries: [
      h('div.hb-entry', {}, h('h3', {}, L('Inne przepisy niż na morzu', 'Different rules from the sea')),
        h('p', {}, L('Na rzekach, kanałach i jeziorach obowiązują przepisy żeglugowe na śródlądowych drogach wodnych (oparte na europejskim kodeksie CEVNI), a nie MPZZM. Część świateł i znaków wygląda tam inaczej – np. holownik nosi żółte światło rufowe zamiast białego, a w dzień żółty walec w pasy; statki zestawu holowanego – białe światło dookólne i żółtą kulę.', 'On rivers, canals and lakes the inland navigation rules (based on the European CEVNI code) apply instead of COLREG. Some lights and shapes look different there – e.g. a tug shows a yellow sternlight instead of a white one and by day a banded yellow cylinder; vessels of the towed convoy show a white all-round light and a yellow ball.')),
        h('p.small.muted', {}, L('W treningu przepisy śródlądowe włączysz wyborem „Morze i drogi śródlądowe”.', 'In training, include the inland rules by choosing “Sea and inland waterways”.'))),
      ...VESSELS.filter((v) => v.inland).map(lightsEntry),
      ...DAY_VESSELS.filter((v) => v.inland).map(dayEntry)
    ] }
  ];
}
function sectorDiagram() {
  const cx = 160, cy = 120, R = 92;
  const arc = (a0, a1, col) => { const p = (a) => [cx + Math.sin((a * Math.PI) / 180) * R, cy - Math.cos((a * Math.PI) / 180) * R]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `<path d="M${cx} ${cy} L${x0} ${y0} A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1} Z" fill="${col}" opacity="0.35"/>`; };
  let g = `<rect width="320" height="220" fill="#f6f1e1"/>`;
  g += arc(0, 112.5, '#1f9d55') + arc(-112.5, 0, '#d62828') + arc(112.5, 247.5, '#c9c2ae');
  g += `<path d="M${cx} ${cy - 28} L${cx + 10} ${cy - 6} L${cx + 9} ${cy + 26} L${cx - 9} ${cy + 26} L${cx - 10} ${cy - 6} Z" fill="#2f4468"/>`;
  const lab = (x, y, s) => `<text x="${x}" y="${y}" font-size="12" font-family="sans-serif" font-weight="700" fill="#1b1f24" text-anchor="middle">${s}</text>`;
  g += lab(cx + 62, cy - 40, '112,5°') + lab(cx - 62, cy - 40, '112,5°') + lab(cx, cy + 80, t('rufowe 135°')) + lab(cx, 16, t('masztowe 225°'));
  g += lab(cx + 78, cy + 10, t('zielone')) + lab(cx - 78, cy + 10, t('czerwone'));
  return g;
}

// ---------- sygnały dźwiękowe ----------
function timeline(p) {
  const { parts, total } = schedule(p);
  const W = 420, sc = (W - 20) / Math.max(total, 8);
  let g = `<rect width="${W}" height="40" rx="6" fill="#f1ece0"/>`;
  for (const q of parts) {
    const x = 10 + q.t0 * sc, w = Math.max(4, q.dur * sc);
    const col = q.kind === 'horn' ? '#2f4468' : q.kind === 'gong' ? '#b07a2a' : '#d2695f';
    g += `<rect x="${x}" y="${q.kind === 'stroke' ? 14 : 10}" width="${w}" height="${q.kind === 'stroke' ? 12 : 20}" rx="3" fill="${col}"/>`;
  }
  for (let s = 0; s <= total; s += 2) g += `<text x="${10 + s * sc}" y="38" font-size="8" fill="#7a8290" font-family="sans-serif">${s}s</text>`;
  return svgEl(W, 40, g, 'hb-tl');
}
export function soundsBook(play) {
  const entry = (s) => h('div.hb-entry.hb-sound', {},
    h('div.hb-sound-h', {}, h('button.btn.sm.primary', { onclick: () => play(s.p) }, '▶'), h('h3', {}, s.name)),
    h('div.hb-notation', {}, notation(s.p)), timeline(s.p), h('p', {}, s.desc));
  const ctxSec = (id, name) => ({ id, name, entries: [h('p.hb-ctx', {}, CONTEXTS[id]), ...SIGNALS.filter((s) => s.ctx === id).map(entry)] });
  return [
    { id: 'intro', name: L('Zasady', 'Basics'), entries: [h('div.hb-entry', {},
      h('h3', {}, L('Krótki i długi dźwięk', 'Short and prolonged blasts')),
      h('p', {}, L('• krótki dźwięk – ok. 1 s, — długi dźwięk – 4–6 s, · bardzo krótki – ok. ¼ s. Sygnały manewrowe daje się tylko wtedy, gdy statki się widzą. W ograniczonej widoczności statki w drodze dają sygnał co najwyżej co 2 minuty, statki na kotwicy dzwonią co minutę.', '• short blast – about 1 s, — prolonged blast – 4–6 s, · very short – about ¼ s. Manoeuvring signals are given only when vessels are in sight of one another. In restricted visibility vessels under way sound at intervals of not more than 2 minutes, vessels at anchor ring the bell every minute.')),
      h('p', {}, L('Wyposażenie (morze): jednostka < 12 m – dowolne skuteczne urządzenie dźwiękowe; ≥ 12 m – gwizd (buczek); ≥ 20 m – gwizd i dzwon; ≥ 100 m – także gong.', 'Equipment (sea): a vessel < 12 m – any efficient sound signal; ≥ 12 m – a whistle; ≥ 20 m – a whistle and a bell; ≥ 100 m – also a gong.')),
      h('p', {}, L('Morze i drogi śródlądowe mają częściowo różne sygnały. Na morzu (MPZZM/COLREG) cztery krótkie dźwięki we mgle to sygnał rozpoznawczy statku pilotowego, a jeden długi – zbliżanie się do zakrętu albo, we mgle, statek o napędzie mechanicznym w ruchu. Na drogach śródlądowych (CEVNI) jeden długi znaczy „uwaga”, cztery krótkie – „nie mogę manewrować”, a seria bardzo krótkich – „niebezpieczeństwo zderzenia”.', 'The sea and inland waterways partly use different signals. At sea (COLREG) four short blasts in fog are a pilot vessel’s identity signal, and one prolonged blast means approaching a bend or, in fog, a power-driven vessel making way. On inland waterways (CEVNI) one long blast means “attention”, four short – “I am unable to manoeuvre”, and a series of very short blasts – “danger of collision”.')),
      h('p.small.muted', {}, L('Na osi czasu: granatowy – buczek, czerwony – dzwon, brązowy – gong.', 'On the timeline: navy – whistle, red – bell, brown – gong.')))] },
    ctxSec('sight', L('Morze – statki się widzą', 'Sea – in sight')),
    ctxSec('fog', L('Morze – ograniczona widoczność', 'Sea – restricted visibility')),
    ctxSec('inland', L('Drogi śródlądowe (CEVNI)', 'Inland waterways (CEVNI)'))
  ];
}

// ---------- oznakowanie IALA ----------
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
// pława filarowa: bands – kolory pasów od góry; topmark – SVG nad pławą
// odcinki światła na przedziale [0, span): sąsiednie fazy tego samego koloru i jasności scalone (bez szwów na wykresie)
function litRuns(seq, span) {
  const out = [];
  for (let t = 0, i = 0; t < span - 1e-9; i++) {
    const sg = seq.segs[i % seq.segs.length], last = out[out.length - 1];
    if (sg.on) {
      if (last && Math.abs(last.t + last.d - t) < 1e-9 && last.c === sg.c && (last.b ?? 1) === (sg.b ?? 1)) last.d += sg.d;
      else out.push({ t, d: sg.d, c: sg.c, b: sg.b ?? 1 });
    }
    t += sg.d;
  }
  return out;
}
// ---------- charakterystyki świateł: lampa animowana z prawdziwym taktowaniem i wykres czasowy ----------
const LAMP_OFF = '#3a3f47';
// lampa (SVG): data-lc – zapis charakterystyki; animuje ją wspólna pętla animLamps
const lampSvg = (code, cx, cy, r = 6) => `<g data-lc="${code}"><circle class="lh" cx="${cx}" cy="${cy}" r="${r * 2.8}" fill="#fff" opacity="0"/><circle class="lc" cx="${cx}" cy="${cy}" r="${r}" fill="${LAMP_OFF}" stroke="#1b1f24" stroke-width="0.8"/></g>`;
// wykres czasowy: kilka okresów (co najmniej ~6 s), podziałka co 1 s, przesuwający się znacznik czasu
function timelineSvg(code, W = 300) {
  const seq = lightSequence(code), span = Math.max(seq.period, Math.ceil(6 / seq.period) * seq.period), H = 50, x0 = 12, w = W - 28, k = w / span;
  let g = `<rect width="${W}" height="${H}" rx="6" fill="#0b1220"/><line x1="${x0}" y1="18" x2="${x0 + w}" y2="18" stroke="#2b3547" stroke-width="2"/>`;
  for (const r of litRuns(seq, span)) { const hh = r.b < 1 ? 7 : 18; g += `<rect x="${(x0 + r.t * k).toFixed(2)}" y="${27 - hh}" width="${Math.max(1.2, r.d * k).toFixed(2)}" height="${hh}" rx="1.5" fill="${LIGHT_COLORS[r.c] || LIGHT_COLORS.W}"/>`; }
  const step = span > 16 ? 2 : 1;
  for (let t = 0; t <= span + 1e-9; t += step) g += `<line x1="${x0 + t * k}" y1="29" x2="${x0 + t * k}" y2="${t % (step * 2) === 0 ? 33 : 31}" stroke="#7a8290"/>` + (t % (step * 2) === 0 ? `<text x="${x0 + t * k}" y="${H - 3}" font-size="12" fill="#b4bccb" text-anchor="middle" font-family="sans-serif">${t} s</text>` : '');
  for (let t = seq.period; t < span - 1e-9; t += seq.period) g += `<line x1="${x0 + t * k}" y1="5" x2="${x0 + t * k}" y2="29" stroke="#ffffff" stroke-opacity="0.25" stroke-dasharray="2 2"/>`;
  g += `<line data-lt="${code}" data-span="${span}" data-x0="${x0}" data-w="${w}" x1="${x0}" y1="5" x2="${x0}" y2="29" stroke="#ff5a5a" stroke-width="1.5"/>`;
  return g;
}
const LAMPS = new Set();
let lampRaf = 0;
function lampTick(now) {
  let live = 0;
  for (const el of LAMPS) {
    if (!el.isConnected) continue; // np. inna zakładka podręcznika – wraca po przełączeniu
    live++;
    const paused = el.__on === false, t = el.__t0 !== undefined ? (now - el.__t0) / 1000 : now / 1000;
    if (paused) {
      if (el.__lamp) { el.__core.setAttribute('fill', LAMP_OFF); el.__core.setAttribute('fill-opacity', '1'); el.__halo.setAttribute('opacity', '0'); }
      else { el.setAttribute('x1', el.__x0); el.setAttribute('x2', el.__x0); }
      continue;
    }
    if (el.__lamp) {
      const s = lightAt(el.__seq, t), col = s.on ? (LIGHT_COLORS[s.c] || LIGHT_COLORS.W) : null;
      const br = s.on ? (s.b ?? 1) : 0;
      el.__core.setAttribute('fill', col || LAMP_OFF);
      el.__core.setAttribute('fill-opacity', col ? String(0.5 + 0.5 * br) : '1');
      el.__halo.setAttribute('fill', col || '#fff');
      el.__halo.setAttribute('opacity', col ? String(0.55 * br) : '0');
    } else {
      const x = el.__x0 + (((t % el.__span) + el.__span) % el.__span) / el.__span * el.__w;
      el.setAttribute('x1', x); el.setAttribute('x2', x);
    }
  }
  // nic nie jest na ekranie (zamknięty podręcznik) – pętla staje; wznawia ją kolejne wyświetlenie
  lampRaf = live ? requestAnimationFrame(lampTick) : 0;
}
function kickLamps() { if (!lampRaf && LAMPS.size && typeof requestAnimationFrame !== 'undefined') lampRaf = requestAnimationFrame(lampTick); }
// rejestruje lampy i znaczniki czasu w elemencie (po wstawieniu SVG)
function animLamps(root) {
  for (const el of root.querySelectorAll('[data-lc]')) {
    el.__lamp = true; el.__seq = lightSequence(el.dataset.lc);
    el.__core = el.querySelector('.lc'); el.__halo = el.querySelector('.lh');
    LAMPS.add(el);
  }
  for (const el of root.querySelectorAll('[data-lt]')) {
    el.__span = Number(el.dataset.span); el.__x0 = Number(el.dataset.x0); el.__w = Number(el.dataset.w);
    LAMPS.add(el);
  }
  kickLamps();
  return root;
}
// lampa na nocnym tle (rozdział o charakterystykach)
const nightLamp = (code, sz = 64) => svgEl(sz, sz, `<rect width="${sz}" height="${sz}" rx="10" fill="#0b1220"/>${lampSvg(code, sz / 2, sz / 2, sz / 8)}`);

// pasek „obrazu graficznego” do tabeli: kilka okresów, światło jasne na ciemnym tle, klamra „okres” pod pierwszym
function stripSvg(code, W = 210, H = 40) {
  const seq = lightSequence(code), span = Math.max(2 * seq.period, Math.ceil(9 / seq.period) * seq.period), x0 = 4, w = W - 8, k = w / span;
  let g = `<rect x="${x0}" y="2" width="${w}" height="16" fill="#0b1220"/>`;
  for (const r of litRuns(seq, span)) { const hh = r.b < 1 ? 4 : 10; g += `<rect x="${(x0 + r.t * k).toFixed(2)}" y="${15 - hh}" width="${Math.max(1, r.d * k).toFixed(2)}" height="${hh}" fill="${LIGHT_COLORS[r.c] || LIGHT_COLORS.W}"/>`; }
  const pw = seq.period * k;
  g += `<path d="M${x0} 21 V25 H${x0 + pw} V21" fill="none" stroke="#2f4468" stroke-width="1"/>${pw < 90 ? `<text x="${x0 + pw + 5}" y="30" font-size="12" fill="#2f4468" font-family="sans-serif">` : `<text x="${x0 + pw / 2}" y="${H - 1}" font-size="12" fill="#2f4468" text-anchor="middle" font-family="sans-serif">`}${L('okres', 'period')} ${String(seq.period).replace('.', ',')} s</text>`;
  return g;
}
// zestawienie charakterystyk (nazwa, skrót, definicja, obraz graficzny, lampa na żywo)
const CHAR_TABLE = [
  [L('Fixed and fixed-and-flashing (stałe i rozbłyskowe)', 'Fixed and fixed-and-flashing'), [
    ['F', 'F', L('Fixed (stałe)', 'Fixed'), L('Świeci bez przerwy, zawsze z tą samą jasnością i w tym samym kolorze.', 'Shows continuously with unchanging brightness and colour.')],
    ['FFl', 'FFl 5s', L('Fixed and flashing (rozbłyskowe)', 'Fixed and flashing'), L('Światło stałe, które co pewien czas na chwilę mocno się rozjaśnia (rozbłysk).', 'A steady light that brightens strongly for a moment at regular intervals.')],
    ['FFl(2)', 'FFl(2) 8s', L('Fixed and group flashing (rozbłyskowe grupowe)', 'Fixed and group flashing'), L('Światło stałe, które w każdym okresie rozjaśnia się grupą kilku rozbłysków.', 'A steady light that brightens with a group of flashes in every period.')]
  ]],
  [L('Occulting (przerywane)', 'Occulting'), [
    ['Oc', 'Oc 4s', L('Occulting (przerywane)', 'Occulting'), L('Przeważa światło: krótkie, jednakowe zaciemnienia przerywają dłuższe świecenie. Okres co najmniej 1,5 s.', 'Light predominates: short, equal eclipses interrupt longer periods of light. Period at least 1.5 s.')],
    ['Oc(2)', 'Oc(2) 8s', L('Group occulting (przerywane grupowe)', 'Group occulting'), L('W każdym okresie grupa kilku zaciemnień, a między grupami dłuższe świecenie.', 'A group of eclipses in every period, with a longer spell of light between the groups.')],
    ['Oc(2+1)', 'Oc(2+1) 12s', L('Composite group occulting (przerywane złożone)', 'Composite group occulting'), L('Dwie grupy zaciemnień o różnej liczbie (np. dwa i jedno) w jednym okresie.', 'Two groups with a different number of eclipses (e.g. two and one) in one period.')]
  ]],
  [L('Isophase (izofazowe)', 'Isophase'), [
    ['Iso', 'Iso 4s', L('Isophase (izofazowe)', 'Isophase'), L('Świecenie i ciemność trwają dokładnie tyle samo. Okres co najmniej 2 s.', 'Light and darkness last exactly the same time. Period at least 2 s.')]
  ]],
  [L('Long flashing (blaskowe)', 'Long flashing'), [
    ['LFl', 'LFl 10s', L('Long flashing (blaskowe)', 'Long flashing'), L('Pojedyncze blaski – długie błyski trwające co najmniej 2 s – wyraźnie krótsze od przerw.', 'Single long flashes of at least 2 s, clearly shorter than the darkness between them.')],
    ['LFl(2)', 'LFl(2) 12s', L('Group long flashing (blaskowe grupowe)', 'Group long flashing'), L('Grupa kilku blasków, po niej dłuższa przerwa.', 'A group of long flashes followed by a longer eclipse.')],
    ['LFl(2+1)', 'LFl(2+1) 18s', L('Composite group long flashing (blaskowe złożone)', 'Composite group long flashing'), L('Dwie grupy blasków o różnej liczbie w jednym okresie.', 'Two groups with a different number of long flashes in one period.')]
  ]],
  [L('Flashing (błyskowe)', 'Flashing'), [
    ['Fl', 'Fl 4s', L('Flashing (błyskowe)', 'Flashing'), L('Krótkie, jednakowe błyski wyraźnie krótsze od przerw, rzadziej niż 50 razy na minutę.', 'Short, equal flashes clearly shorter than the darkness, fewer than 50 per minute.')],
    ['Fl(3)', 'Fl(3) 10s', L('Group flashing (błyskowe grupowe)', 'Group flashing'), L('Grupa kilku błysków (tu trzech), po niej dłuższa przerwa.', 'A group of flashes (here three) followed by a longer eclipse.')],
    ['Fl(2+1)', 'Fl(2+1) 10s', L('Composite group flashing (błyskowe złożone)', 'Composite group flashing'), L('Dwie grupy błysków o różnej liczbie – np. dwa błyski, przerwa i jeden błysk.', 'Two groups with a different number of flashes – e.g. two flashes, an eclipse and one flash.')]
  ]],
  [L('Quick – Q (migające)', 'Quick (Q)'), [
    ['Q', 'Q', L('Quick (migające)', 'Quick'), L('Jednakowe błyski bez przerw, od 50 do 79 na minutę (zwykle 60).', 'Equal flashes without a break, 50 to 79 per minute (usually 60).')],
    ['Q(3)', 'Q(3) 10s', L('Group quick (migające grupowe)', 'Group quick'), L('Grupa błysków migających, po niej dłuższa przerwa.', 'A group of quick flashes followed by a longer eclipse.')],
    ['Q(6)+LFl', 'Q(6)+LFl 15s', L('Group quick with long flash (migające złożone)', 'Group quick with long flash'), L('Grupa błysków migających zakończona jednym blaskiem.', 'A group of quick flashes ending with one long flash.')]
  ]],
  [L('Very quick – VQ (szybko migające)', 'Very quick (VQ)'), [
    ['VQ', 'VQ', L('Very quick (szybko migające)', 'Very quick'), L('Jednakowe błyski bez przerw, od 80 do 159 na minutę (zwykle 120).', 'Equal flashes without a break, 80 to 159 per minute (usually 120).')],
    ['VQ(3)', 'VQ(3) 5s', L('Group very quick (szybko migające grupowe)', 'Group very quick'), L('Grupa szybkich błysków, po niej dłuższa przerwa.', 'A group of very quick flashes followed by a longer eclipse.')],
    ['VQ(6)+LFl', 'VQ(6)+LFl 10s', L('Group very quick with long flash (szybko migające złożone)', 'Group very quick with long flash'), L('Grupa szybkich błysków zakończona jednym blaskiem.', 'A group of very quick flashes ending with one long flash.')],
    ['IVQ', 'IVQ 10s', L('Interrupted very quick (szybko migające przerywane)', 'Interrupted very quick'), L('Miga jak VQ, ale po serii co najmniej ośmiu błysków następuje przerwa co najmniej 3 s.', 'Flashes like VQ, but after a run of at least eight flashes there is an eclipse of at least 3 s.')],
    ['UQ', 'UQ', L('Ultra quick (bardzo szybko migające)', 'Ultra quick'), L('Jednakowe błyski bez przerw, 160 i więcej na minutę (zwykle 240–300).', 'Equal flashes without a break, 160 or more per minute (usually 240–300).')]
  ]],
  [L('Morse and alternating (kodowe i zmiennobarwne)', 'Morse and alternating'), [
    ['Mo(A)', 'Mo(A) 6s', L('Morse code (kodowe Morse’a)', 'Morse code'), L('Krótkie i długie świecenia układają się w literę alfabetu Morse’a – tu A (· –).', 'Short and long flashes form a Morse letter – here A (· –).')],
    ['Al.Bu.Y', 'Al.Bu.Y 3s', L('Alternating (zmiennobarwne)', 'Alternating'), L('W tym samym kierunku światło regularnie zmienia kolor – tu niebieskie i żółte na zmianę.', 'Seen from the same direction the light regularly changes colour – here blue and yellow in turn.')]
  ]]
];
// opisy „na żywo” (lampa + wykres) dla charakterystyk z zestawienia: [kod przykładu, tytuł, opis]
const CHAR_LIVE = {
  F: ['F R', L('F – fixed (stałe)', 'F – fixed'), L('Świeci cały czas, bez przerw i bez zmian. Np. światła na główkach portu.', 'Shows continuously and steadily, with no change. E.g. harbour pier-head lights.')],
  Fl: ['Fl G 4s', L('Fl – flashing (błyskowe)', 'Fl – flashing'), L('Pojedyncze krótkie błyski (zwykle ok. 0,5 s), wyraźnie krótsze od przerw, rzadziej niż 50 razy na minutę (w praktyce najczęściej nie częściej niż 30). Typowe dla znaków bocznych.', 'Single short flashes (usually about 0.5 s), clearly shorter than the eclipses, fewer than 50 per minute (in practice usually no more than 30). Typical of lateral marks.')],
  'Fl(3)': [null, L('Fl(n) – group flashing (grupowe błyskowe)', 'Fl(n) – group flashing'), L('Grupa kilku błysków, potem dłuższa przerwa. Liczba w nawiasie to liczba błysków w grupie. Fl(2) – znak odosobnionego niebezpieczeństwa.', 'A group of flashes followed by a longer eclipse. The number in brackets is the number of flashes in the group. Fl(2) – isolated danger mark.')],
  'Fl(2+1)': ['Fl(2+1) R 10s', L('Fl(2+1) – composite group flashing (złożone grupowe)', 'Fl(2+1) – composite group flashing'), L('Dwie grupy o różnej liczbie błysków: 2 błyski, przerwa, 1 błysk, długa przerwa. Znaki rozwidlenia toru.', 'Two groups with a different number of flashes: 2 flashes, an eclipse, 1 flash, a long eclipse. Preferred-channel marks.')],
  LFl: ['LFl 10s', L('LFl – long flashing (blaskowe)', 'LFl – long flashing'), L('Jeden blask, czyli długi błysk trwający co najmniej 2 s. Np. znak wody bezpiecznej LFl 10s.', 'One long flash of at least 2 s. E.g. a safe-water mark LFl 10s.')],
  Q: ['Q', L('Q – quick (migające)', 'Q – quick'), L('Błyski szybko jeden po drugim: 50–79 na minutę (zwykle 60, czyli co sekundę), bez przerw między seriami. Znak kardynalny północny.', 'Flashes in quick succession: 50–79 per minute (usually 60, i.e. one per second), continuously. North cardinal mark.')],
  'Q(3)': ['Q(3) 10s', L('Q(n) – group quick (migające grupowe)', 'Q(n) – group quick'), L('Grupa szybkich błysków, potem przerwa. Na znakach kardynalnych liczba błysków odpowiada godzinie na tarczy zegara: E – 3, S – 6, W – 9.', 'A group of quick flashes, then an eclipse. On cardinal marks the number of flashes matches the clock face: E – 3, S – 6, W – 9.')],
  VQ: ['VQ', L('VQ – very quick (szybko migające)', 'VQ – very quick'), L('80–159 błysków na minutę (zwykle 120 – dwa na sekundę). Zamiennie z Q na znakach kardynalnych, często tam, gdzie znaki stoją blisko siebie.', '80–159 flashes per minute (usually 120 – two per second). Used instead of Q on cardinal marks, often where marks stand close together.')],
  'VQ(6)+LFl': ['VQ(6)+LFl 10s', L('VQ(6)+LFl – znak kardynalny południowy', 'VQ(6)+LFl – south cardinal mark'), L('Sześć szybkich błysków i zaraz po nich blask (długi błysk) – blask pozwala odróżnić 6 od 9 błysków.', 'Six very quick flashes immediately followed by a long flash – the long flash lets you tell 6 from 9 flashes.')],
  UQ: ['UQ', L('UQ – ultra quick (bardzo szybko migające)', 'UQ – ultra quick'), L('160 i więcej błysków na minutę (zwykle 240–300). Rzadkie – np. na konstrukcjach morskich.', '160 or more flashes per minute (usually 240–300). Rare – e.g. on offshore structures.')],
  Iso: ['Iso 4s', L('Iso – isophase (izofazowe)', 'Iso – isophase'), L('Światło i ciemność trwają tyle samo. Iso 4s – 2 s światła, 2 s przerwy. Znak wody bezpiecznej.', 'Light and darkness of equal length. Iso 4s – 2 s of light, 2 s of darkness. Safe-water mark.')],
  Oc: ['Oc 4s', L('Oc – occulting (przerywane)', 'Oc – occulting'), L('Odwrotność błyskowego: świeci dłużej, niż trwają krótkie zaciemnienia. Oc 4s – 3 s światła, 1 s ciemności.', 'The opposite of flashing: the light is on longer than the short eclipses. Oc 4s – 3 s of light, 1 s of darkness.')],
  'Oc(2)': ['Oc(2) 8s', L('Oc(n) – group occulting (grupowe przerywane)', 'Oc(n) – group occulting'), L('Grupa kilku krótkich zaciemnień w okresie. Oc(2) 8s – dwa zaciemnienia po 1 s.', 'A group of short eclipses in each period. Oc(2) 8s – two 1-s eclipses.')],
  'Mo(A)': ['Mo(A) 6s', L('Mo – Morse code (kodem Morse’a)', 'Mo – Morse code'), L('Błyski krótkie i długie układają się w literę alfabetu Morse’a. Mo(A) (· –) – znak wody bezpiecznej, często na pławach podejściowych.', 'Short and long flashes form a Morse letter. Mo(A) (· –) – a safe-water mark, often on landfall buoys.')],
  'Al.Bu.Y': [null, L('Al – alternating (zmiennobarwne)', 'Al – alternating'), L('Światło zmienia kolor w kolejnych fazach, np. Al.WR – białe i czerwone. Al.Bu.Y – niebieskie i żółte na znaku nowego niebezpieczeństwa (wraku).', 'The light changes colour in successive phases, e.g. Al.WR – white and red. Al.Bu.Y – blue and yellow on a new-danger (wreck) mark.')]
};

// przykład stosowania każdej charakterystyki
const CHAR_USE = {
  F: L('Światła główek portowych i nabrzeży, światła nabieżników, oświetlenie przeszkód (np. czerwone F R na kominach i masztach).', 'Pier-head and quay lights, leading lights, obstruction lights (e.g. F R on chimneys and masts).'),
  FFl: L('Latarnie morskie i światła wejściowe, które mają być widoczne stale, a jednocześnie łatwe do rozpoznania.', 'Lighthouses and entrance lights that must show continuously yet be easy to identify.'),
  'FFl(2)': L('Latarnie morskie – grupa rozbłysków odróżnia je od sąsiednich świateł na tym samym wybrzeżu.', 'Lighthouses – the group of flashes distinguishes them from neighbouring lights on the same coast.'),
  Oc: L('Światła nabieżników i sektorowe światła wejściowe do portów; także znak wody bezpiecznej (Oc W).', 'Leading lights and sectored harbour-entrance lights; also safe-water marks (Oc W).'),
  'Oc(2)': L('Latarnie i światła sektorowe, np. Oc(2) WRG 6s na wejściu do portu.', 'Lighthouses and sector lights, e.g. Oc(2) WRG 6s at a harbour entrance.'),
  'Oc(2+1)': L('Rzadziej spotykane latarnie, którym trzeba nadać rytm odróżniający je od sąsiednich.', 'Less common lighthouses that need a rhythm distinct from their neighbours.'),
  Iso: L('Znak wody bezpiecznej (Iso W), światła nabieżników i sektorowe światła kierunkowe.', 'Safe-water marks (Iso W), leading lights and directional sector lights.'),
  LFl: L('Znak wody bezpiecznej LFl 10s (pława podejściowa, środek toru).', 'Safe-water mark LFl 10s (landfall buoy, mid-channel).'),
  'LFl(2)': L('Latarnie morskie, np. LFl(2) W 15s.', 'Lighthouses, e.g. LFl(2) W 15s.'),
  'LFl(2+1)': L('Latarnie morskie o złożonym rytmie, łatwym do odróżnienia z daleka.', 'Lighthouses with a composite rhythm that is easy to tell apart from afar.'),
  Fl: L('Znaki boczne (Fl R / Fl G), znaki specjalne (Fl Y), latarnie i główki portowe.', 'Lateral marks (Fl R / Fl G), special marks (Fl Y), lighthouses and pier heads.'),
  'Fl(3)': L('Znaki boczne z rytmem grupowym, np. Fl(3) G 10s; Fl(2) – znak odosobnionego niebezpieczeństwa.', 'Lateral marks with a group rhythm, e.g. Fl(3) G 10s; Fl(2) – isolated danger mark.'),
  'Fl(2+1)': L('Znaki rozwidlenia toru (zmodyfikowane znaki boczne), np. Fl(2+1) R 10s.', 'Preferred-channel marks (modified lateral marks), e.g. Fl(2+1) R 10s.'),
  Q: L('Znak kardynalny północny (Q); także znaki boczne przy ostrych zakrętach toru.', 'North cardinal mark (Q); also lateral marks at sharp bends of a channel.'),
  'Q(3)': L('Znak kardynalny wschodni Q(3) 10s; Q(9) 15s – zachodni.', 'East cardinal mark Q(3) 10s; Q(9) 15s – west.'),
  'Q(6)+LFl': L('Znak kardynalny południowy Q(6)+LFl 15s.', 'South cardinal mark Q(6)+LFl 15s.'),
  VQ: L('Znak kardynalny północny (VQ), zwykle tam, gdzie znaki stoją blisko siebie.', 'North cardinal mark (VQ), usually where marks stand close together.'),
  'VQ(3)': L('Znak kardynalny wschodni VQ(3) 5s; VQ(9) 10s – zachodni.', 'East cardinal mark VQ(3) 5s; VQ(9) 10s – west.'),
  'VQ(6)+LFl': L('Znak kardynalny południowy VQ(6)+LFl 10s.', 'South cardinal mark VQ(6)+LFl 10s.'),
  IVQ: L('Rzadkie – światła na konstrukcjach i przeszkodach, które muszą się wyróżniać spośród innych świateł migających.', 'Rare – lights on structures and obstructions that must stand out from other quick lights.'),
  UQ: L('Platformy i konstrukcje morskie, oznakowanie wraków i przeszkód w strefach intensywnego ruchu.', 'Offshore platforms and structures, marking of wrecks and obstructions in busy waters.'),
  'Mo(A)': L('Znak wody bezpiecznej (pława podejściowa); Mo(U) – platformy wiertnicze.', 'Safe-water mark (landfall buoy); Mo(U) – offshore oil and gas platforms.'),
  'Al.Bu.Y': L('Pława nowego wraku (znak nowego niebezpieczeństwa) – Al.Bu.Y, niebieskie i żółte światło na zmianę, aż wrak trafi na mapy. Inne światła zmiennobarwne, np. Al.WR, spotkasz na latarniach i światłach sektorowych.', 'Emergency wreck marking buoy (new danger mark) – Al.Bu.Y, blue and yellow alternately, until the wreck is charted. Other alternating lights, e.g. Al.WR, are found on lighthouses and sector lights.')
};

// jedna charakterystyka: u góry nazwa, skrót, definicja i obraz graficzny; pod spodem lampa na żywo, wykres czasowy i opis
function charCard(abbr, code, name, def) {
  const live = CHAR_LIVE[abbr];
  const lc = (live && live[0]) || code;
  // animacja startuje dopiero po ▶ (od początku okresu); ponowne kliknięcie zatrzymuje
  const btn = h('button.btn.sm.hb-play', { onclick: () => {
    const on = !card.__playing; card.__playing = on;
    const now = performance.now();
    for (const el of card.querySelectorAll('[data-lc], [data-lt]')) { el.__on = on; el.__t0 = now; }
    btn.textContent = on ? L('⏸ Pauza', '⏸ Pause') : L('▶ Odtwórz', '▶ Play');
    kickLamps();
  } }, L('▶ Odtwórz', '▶ Play'));
  const card = animLamps(h('div.hb-charx', {},
    h('div.hb-charx-head', {}, h('h3', {}, name), h('span.hb-ct-abbr', {}, abbr), btn),
    h('p', {}, def),
    CHAR_USE[abbr] ? h('div.hb-charx-usewrap', {},
      abbr === 'Al.Bu.Y' ? svgEl(120, 170, buoy(['#1f5fd1', '#f2c230', '#1f5fd1', '#f2c230'], tm.cross, { char: code, vertical: true }), 'hb-charx-pic') : null,
      h('p.hb-charx-use', {}, h('b', {}, L('Przykład stosowania: ', 'Example of use: ')), CHAR_USE[abbr])) : null,
    h('div.hb-charx-strip', {}, svgEl(320, 40, stripSvg(code, 320))),
    h('div.hb-char.hb-charx-live', {},
      nightLamp(lc),
      h('div.hb-char-body', {}, live ? h('h4', {}, live[1]) : null, h('div.hb-char-code', {}, lc), svgEl(320, 50, timelineSvg(lc, 320)), live ? h('p', {}, live[2]) : null))));
  for (const el of card.querySelectorAll('[data-lc], [data-lt]')) el.__on = false;
  return card;
}

function charsSection() {
  const out = [
    h('div.hb-entry', {}, h('h3', {}, L('Jak czytać opis światła na mapie', 'How to read a light description on the chart')),
      h('p', {}, h('b', {}, 'Fl(3) G 10s 12m 5M'), ' – ', L('charakterystyka Fl(3) (trzy błyski w grupie), kolor zielony (G), okres 10 s (po tylu sekundach cały rytm się powtarza), wysokość światła 12 m nad poziomem wody, zasięg nominalny 5 Mm. Brak litery koloru oznacza światło białe.', 'character Fl(3) (a group of three flashes), green (G), period 10 s (the whole rhythm repeats every 10 s), light 12 m above sea level, nominal range 5 NM. No colour letter means a white light.')),
      h('p', {}, L('Przy każdej charakterystyce najpierw jest jej definicja i obraz graficzny: jasne pola to czas świecenia, ciemne – zaciemnienia; cienka linia oznacza słabsze światło stałe, na którym pojawiają się rozbłyski, a klamra pokazuje jeden okres. Pod spodem ta sama charakterystyka na żywo – przyciskiem ▶ uruchamiasz animowaną lampę i wykres czasowy – przerywane pionowe linie oddzielają kolejne okresy, a czerwona kreska przesuwa się w takt lampy.', 'Each light character starts with its definition and pattern: the bright parts show the light and the dark parts the eclipses; a thin line is the weaker steady light on which the flashes appear, and the bracket shows one period. Below it the same character live – press ▶ to run the animated lamp and the timeline – the dashed vertical lines separate the periods and the red marker moves in step with the lamp.')),
      h('p', {}, L('Zasada ogólna: światło błyskowe świeci krócej, niż trwają przerwy; przerywane – dłużej niż przerwy; izofazowe – tyle samo.', 'General rule: a flashing light is on for less time than it is off; an occulting light is on for longer than it is off; an isophase light is on and off for equal times.')))
  ];
  // każda grupa jako siatka kart
  for (const [grp, list] of CHAR_TABLE) {
    out.push(h('div.hb-charx-grp', {}, grp));
    out.push(h('div.hb-charx-grid', {}, ...list.map(([abbr, code, name, def]) => charCard(abbr, code, name, def))));
  }
  return out;
}

function buoy(bands, topmark, opts = {}) {
  const W = 120, H = 170, cx = 60, top = 62, bot = 140;
  let g = `<rect width="${W}" height="${H}" fill="#e3f0f7"/><rect y="${bot + 6}" width="${W}" height="${H - bot - 6}" fill="#8fc3dc"/>`;
  g += `<polygon points="${cx - 30},${bot} ${cx + 30},${bot} ${cx + 22},${bot + 14} ${cx - 22},${bot + 14}" fill="${bands[bands.length - 1]}" stroke="#1b1f24" stroke-width="1"/>`;
  const vert = opts.vertical;
  if (vert) {
    const n = bands.length, w = 30 / n;
    bands.forEach((c, i) => { g += `<polygon points="${cx - 15 + i * w},${top} ${cx - 15 + (i + 1) * w},${top} ${cx - 18 + (i + 1) * w * 1.2},${bot} ${cx - 18 + i * w * 1.2},${bot}" fill="${c}"/>`; });
  } else {
    const n = bands.length, hgt = (bot - top) / n;
    bands.forEach((c, i) => { const y0 = top + i * hgt, y1 = y0 + hgt, k0 = 15 + (i / n) * 3, k1 = 15 + ((i + 1) / n) * 3; g += `<polygon points="${cx - k0},${y0} ${cx + k0},${y0} ${cx + k1},${y1} ${cx - k1},${y1}" fill="${c}"/>`; });
  }
  g += `<polygon points="${cx - 15},${top} ${cx + 15},${top} ${cx + 18},${bot} ${cx - 18},${bot}" fill="none" stroke="#1b1f24" stroke-width="1"/>`;
  g += `<rect x="${cx - 1.5}" y="${top - 18}" width="3" height="18" fill="#1b1f24"/>`;
  if (opts.char) g += lampSvg(opts.char, cx, top - 5, 6);
  g += topmark(cx, top - 28);
  return g;
}
const tm = {
  can: (c) => (x, y) => `<rect x="${x - 9}" y="${y - 9}" width="18" height="18" fill="${c}" stroke="#1b1f24"/>`,
  cone: (c) => (x, y) => `<polygon points="${x},${y - 11} ${x + 10},${y + 8} ${x - 10},${y + 8}" fill="${c}" stroke="#1b1f24"/>`,
  cones: (kind) => (x, y) => {
    const up = (yy) => `<polygon points="${x},${yy - 9} ${x + 9},${yy + 6} ${x - 9},${yy + 6}" fill="#16181c"/>`;
    const dn = (yy) => `<polygon points="${x},${yy + 9} ${x + 9},${yy - 6} ${x - 9},${yy - 6}" fill="#16181c"/>`;
    return { N: up(y - 10) + up(y + 8), S: dn(y - 10) + dn(y + 8), E: up(y - 12) + dn(y + 10), W: dn(y - 12) + up(y + 10) }[kind];
  },
  balls: (n, c) => (x, y) => Array.from({ length: n }, (_, i) => `<circle cx="${x}" cy="${y + 8 - i * 17}" r="7.5" fill="${c}"/>`).join(''),
  x: (x, y) => `<path d="M${x - 9} ${y - 9} L${x + 9} ${y + 9} M${x + 9} ${y - 9} L${x - 9} ${y + 9}" stroke="#f2c230" stroke-width="5"/>`,
  cross: (x, y) => `<path d="M${x} ${y - 11} L${x} ${y + 11} M${x - 10} ${y} L${x + 10} ${y}" stroke="#f2c230" stroke-width="5"/>`,
  rgBall: (x, y) => `<path d="M${x - 9} ${y} A9 9 0 0 1 ${x + 9} ${y} Z" fill="#d62828"/><path d="M${x - 9} ${y} A9 9 0 0 0 ${x + 9} ${y} Z" fill="#2a9d4a"/><circle cx="${x}" cy="${y}" r="9" fill="none" stroke="#1b1f24"/>`
};
// tablice brzegowe dróg śródlądowych (CEVNI) na słupku
function board(inner) {
  const W = 120, H = 170;
  return `<rect width="${W}" height="${H}" fill="#e3f0f7"/><rect y="150" width="${W}" height="20" fill="#8fc3dc"/><rect x="57" y="96" width="6" height="56" fill="#6b7280"/><g transform="translate(24 28)">${inner}</g>`;
}
const sg = {
  noPass: `<rect width="72" height="72" fill="#fff" stroke="#1b1f24"/><rect width="72" height="24" fill="#d62828"/><rect y="48" width="72" height="24" fill="#d62828"/>`,
  P: `<text x="36" y="51" font-size="40" font-weight="800" text-anchor="middle" font-family="sans-serif" fill="#16181c">P</text>`,
  waves: `<path d="M12 30 q6 -7 12 0 t12 0 t12 0 t12 0 M12 44 q6 -7 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#16181c" stroke-width="4"/>`,
  prohib: (inner) => `<rect width="72" height="72" fill="#fff" stroke="#1b1f24"/>${inner}<rect x="3" y="3" width="66" height="66" fill="none" stroke="#d62828" stroke-width="6"/><path d="M6 6 L66 66" stroke="#d62828" stroke-width="6"/>`,
  blueP: `<rect width="72" height="72" fill="#1f5fd1" stroke="#1b1f24"/><text x="36" y="51" font-size="40" font-weight="800" text-anchor="middle" font-family="sans-serif" fill="#fff">P</text>`,
  mand: (inner) => `<rect width="72" height="72" fill="#fff" stroke="#1b1f24"/>${inner}<rect x="3" y="3" width="66" height="66" fill="none" stroke="#d62828" stroke-width="6"/>`,
  blue: (inner) => `<rect width="72" height="72" fill="#1f5fd1" stroke="#1b1f24"/>${inner}`,
  num: (t) => `<text x="36" y="48" font-size="28" font-weight="800" text-anchor="middle" font-family="sans-serif" fill="#16181c">${t}</text>`,
  limit: (t, d) => {
    const txt = `<text x="${d === 'v' ? 44 : 36}" y="${d === 'h' ? 34 : d === 'd' ? 30 : 42}" font-size="${d === 'h' ? 20 : 17}" font-weight="800" text-anchor="middle" font-family="sans-serif" fill="#16181c">${t}</text>`;
    const ar = d === 'v' ? `<path d="M20 14 V58 M14 22 L20 14 L26 22 M14 50 L20 58 L26 50" stroke="#16181c" stroke-width="3" fill="none"/>`
      : d === 'h' ? `<path d="M12 48 H60 M20 42 L12 48 L20 54 M52 42 L60 48 L52 54" stroke="#16181c" stroke-width="3" fill="none"/>`
      : `<path d="M36 38 V60 M29 52 L36 60 L43 52" stroke="#16181c" stroke-width="3" fill="none"/>`;
    return sg.mand(txt + ar);
  },
  arrow: `<path d="M36 58 V20 M24 32 L36 18 L48 32" stroke="#16181c" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  horn: `<path d="M18 30 H28 L46 18 V54 L28 42 H18 Z" fill="#16181c"/><path d="M52 26 q6 10 0 20" stroke="#16181c" stroke-width="3" fill="none"/>`,
  vhf: `<text x="36" y="34" font-size="17" font-weight="800" text-anchor="middle" font-family="sans-serif" fill="#16181c">VHF</text><text x="36" y="56" font-size="17" font-weight="800" text-anchor="middle" font-family="sans-serif" fill="#16181c">16</text>`,
  entryOk: `<rect width="72" height="72" fill="#fff" stroke="#1b1f24"/><rect width="72" height="24" fill="#2a9d4a"/><rect y="48" width="72" height="24" fill="#2a9d4a"/>`,
  bankR: `<rect x="10" y="10" width="52" height="52" fill="#d62828" stroke="#1b1f24"/>`,
  bankL: `<polygon points="36,8 66,62 6,62" fill="#2a9d4a" stroke="#1b1f24"/>`,
  crossX: `<path d="M12 12 L60 60 M60 12 L12 60" stroke="#f2c230" stroke-width="11" stroke-linecap="square"/><path d="M12 12 L60 60 M60 12 L12 60" stroke="#1b1f24" stroke-width="1" fill="none" opacity="0.4"/>`,
  leading: `<rect x="6" y="40" width="22" height="30" fill="#fff" stroke="#1b1f24"/><rect x="14" y="40" width="6" height="30" fill="#d62828"/><rect x="44" y="0" width="22" height="30" fill="#fff" stroke="#1b1f24"/><rect x="52" y="0" width="6" height="30" fill="#d62828"/><rect x="54" y="30" width="2" height="42" fill="#6b7280"/>`,
  twoBoats: `<path d="M12 30 H34 L30 37 H16 Z M38 46 H60 L56 53 H42 Z" fill="#16181c"/>`,
  anchor: `<path d="M36 16 V56 M26 24 H46 M18 44 q18 22 36 0" stroke="#16181c" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="36" cy="14" r="4" fill="none" stroke="#16181c" stroke-width="3"/>`,
  anchorW: `<path d="M36 16 V56 M26 24 H46 M18 44 q18 22 36 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="36" cy="14" r="4" fill="none" stroke="#fff" stroke-width="3"/>`,
  bollard: `<rect x="28" y="30" width="16" height="26" fill="#16181c"/><rect x="22" y="24" width="28" height="8" rx="3" fill="#16181c"/>`,
  bollardW: `<rect x="28" y="30" width="16" height="26" fill="#fff"/><rect x="22" y="24" width="28" height="8" rx="3" fill="#fff"/>`,
  motorboat: `<path d="M10 44 H62 L54 54 H16 Z M24 44 V36 H44 L50 44" fill="#16181c"/>`,
  skier: `<circle cx="44" cy="18" r="5" fill="#16181c"/><path d="M44 24 L38 40 L46 50 M40 30 L28 34 M30 54 H58" stroke="#16181c" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M28 34 L10 28" stroke="#16181c" stroke-width="1.5"/>`,
  sailboat: `<path d="M36 12 V48 L58 48 Z" fill="#16181c"/><path d="M33 18 L16 48 H33 Z" fill="#16181c"/><path d="M12 52 H60 L54 60 H18 Z" fill="#16181c"/>`,
  sailW: `<path d="M36 12 V48 L58 48 Z" fill="#fff"/><path d="M33 18 L16 48 H33 Z" fill="#fff"/><path d="M12 52 H60 L54 60 H18 Z" fill="#fff"/>`,
  windsurf: `<path d="M38 10 L56 46 H36 Z" fill="#16181c"/><path d="M14 54 H60 L56 58 H18 Z" fill="#16181c"/><path d="M36 46 L34 54" stroke="#16181c" stroke-width="3"/>`,
  jetski: `<path d="M10 50 H62 L56 58 H18 Z M26 50 L32 40 H44 L48 50" fill="#16181c"/><circle cx="40" cy="30" r="5" fill="#16181c"/>`,
  cable: `<path d="M6 22 q30 22 60 0" stroke="#fff" stroke-width="3" fill="none"/><path d="M36 30 L28 46 H40 L32 62" stroke="#fff" stroke-width="4" fill="none" stroke-linejoin="round"/>`
};
// most z przęsłami: n = 1 – jeden żółty romb, 2 – dwa romby, 0 – tablice biało-czerwone na zamkniętych przęsłach
function bridgePic(n) {
  const W = 120, H = 170, dia = (cx, cy) => `<polygon points="${cx},${cy - 7} ${cx + 7},${cy} ${cx},${cy + 7} ${cx - 7},${cy}" fill="#f2c230" stroke="#1b1f24"/>`;
  const rw = (x) => `<rect x="${x - 4}" y="68" width="8" height="26" fill="#fff" stroke="#1b1f24"/><rect x="${x - 4}" y="68" width="8" height="8" fill="#d62828"/><rect x="${x - 4}" y="86" width="8" height="8" fill="#d62828"/>`;
  let g = `<rect width="${W}" height="${H}" fill="#e3f0f7"/><rect y="120" width="${W}" height="50" fill="#8fc3dc"/><rect x="0" y="40" width="${W}" height="14" fill="#9aa1a7" stroke="#5b6168"/>`;
  for (const x of [8, 40, 80, 112]) g += `<rect x="${x - 5}" y="54" width="10" height="70" fill="#b8bcc0" stroke="#5b6168"/>`;
  if (n === 1) g += dia(60, 66);
  if (n === 2) g += dia(60, 64) + dia(60, 80);
  if (n === 0) g += dia(60, 66) + rw(24) + rw(96);
  return g;
}
export function marksBook() {
  const lc = lateralColors(), P = hex(lc.port), S = hex(lc.stbd), B = '#16181c', Y = '#f2c230', R = '#d62828', W = '#ffffff', IG = '#2a9d4a';
  const reg = IALA.region;
  const e = (title, pic, rows, char) => animLamps(h('div.hb-entry.hb-mark', {}, svgEl(120, 170, pic), h('div', {}, h('h3', {}, title), ...rows.map(([a, b]) => h('p', {}, h('b', {}, a + ': '), b)),
    char ? h('div.hb-rhythm', {}, h('span.muted', {}, `${L('Światło nocą', 'Light at night')} – ${char}:`), h('div.hb-rhythm-row', {}, nightLamp(char, 46), svgEl(300, 46, timelineSvg(char)))) : null)));
  const pName = lc.port === 0xd62828 ? L('czerwony', 'red') : L('zielony', 'green'), sName = lc.stbd === 0xd62828 ? L('czerwony', 'red') : L('zielony', 'green');
  const lightP = lc.port === 0xd62828 ? 'R' : 'G', lightS = lc.stbd === 0xd62828 ? 'R' : 'G';
  // znaki boczne dla regionu IALA A lub B (w B kolory odwrócone, kształty te same)
  const lateral = (rg) => {
    const red = '#d62828', green = hex(lc.port === 0xd62828 ? lc.stbd : lc.port);
    const P = rg === 'A' ? red : green, S = rg === 'A' ? green : red;
    const pName = rg === 'A' ? L('czerwony', 'red') : L('zielony', 'green'), sName = rg === 'A' ? L('zielony', 'green') : L('czerwony', 'red');
    const lightP = rg === 'A' ? 'R' : 'G', lightS = rg === 'A' ? 'G' : 'R';
    return [
      e(L('Znak boczny lewy', 'Port-hand mark'), buoy([P, P], tm.can(P), { char: `Fl ${lightP} 4s`}), [[L('Wygląd', 'Look'), L(`${pName}, kształt beczki (lub pława filarowa/tyczkowa), znak szczytowy – ${pName} walec`, `${pName}, can shape (or pillar/spar), topmark – a ${pName} can`)], [L('Światło', 'Light'), L(`${lightP}, dowolny rytm oprócz Fl(2+1), np. Fl ${lightP} 4s`, `${lightP}, any rhythm except Fl(2+1), e.g. Fl ${lightP} 4s`)], [L('Jak mijać', 'How to pass'), L('W kierunku oznakowania – zostaw po lewej burcie.', 'In the direction of buoyage – leave it to port.')]], `Fl ${lightP} 4s`),
      e(L('Znak boczny prawy', 'Starboard-hand mark'), buoy([S, S], tm.cone(S), { char: `Fl ${lightS} 4s`}), [[L('Wygląd', 'Look'), L(`${sName}, stożek (lub pława filarowa/tyczkowa), znak szczytowy – ${sName} stożek wierzchołkiem do góry`, `${sName}, conical (or pillar/spar), topmark – a ${sName} cone point up`)], [L('Światło', 'Light'), L(`${lightS}, np. Fl ${lightS} 4s`, `${lightS}, e.g. Fl ${lightS} 4s`)], [L('Jak mijać', 'How to pass'), L('W kierunku oznakowania – zostaw po prawej burcie.', 'In the direction of buoyage – leave it to starboard.')]], `Fl ${lightS} 4s`),
      e(L('Rozwidlenie – główny tor w prawo', 'Preferred channel to starboard'), buoy([P, S, P], tm.can(P), { char: `Fl(2+1) ${lightP} 10s`}), [[L('Wygląd', 'Look'), L('Kolor znaku lewego z jednym szerokim pasem koloru prawego, beczka.', 'Port-hand colour with one broad band of the starboard colour, can shape.')], [L('Światło', 'Light'), `Fl(2+1) ${lightP}`], [L('Znaczenie', 'Meaning'), L('Tor główny prowadzi w prawo – znak traktujesz jak lewy.', 'The main channel is to starboard – treat it as a port-hand mark.')]], `Fl(2+1) ${lightP} 10s`),
      e(L('Rozwidlenie – główny tor w lewo', 'Preferred channel to port'), buoy([S, P, S], tm.cone(S), { char: `Fl(2+1) ${lightS} 10s`}), [[L('Wygląd', 'Look'), L('Kolor znaku prawego z jednym szerokim pasem koloru lewego, stożek.', 'Starboard-hand colour with one broad band of the port colour, conical.')], [L('Światło', 'Light'), `Fl(2+1) ${lightS}`], [L('Znaczenie', 'Meaning'), L('Tor główny prowadzi w lewo – znak traktujesz jak prawy.', 'The main channel is to port – treat it as a starboard-hand mark.')]], `Fl(2+1) ${lightS} 10s`)
    ];
  };
  return [
    { id: 'intro', name: L('Zasady', 'Basics'), entries: [h('div.hb-entry', {},
      h('h3', {}, L('Czym jest locja', 'What pilotage is')),
      h('p', {}, L('Locja to wiedza o akwenie potrzebna do bezpiecznego prowadzenia jachtu: o torach wodnych i ich oznakowaniu, niebezpieczeństwach nawigacyjnych, portach i przepisach obowiązujących na danych wodach. Tak nazywa się też publikacja – „locja” (ang. pilot, sailing directions) – opisujące konkretny akwen.', 'Pilotage is the knowledge of a sea area needed to navigate a yacht safely: its fairways and their marking, navigational hazards, harbours and the local rules. The word also names the publication – a pilot or sailing directions – describing a particular area.')),
      h('p', {}, h('b', {}, L('Dlaczego się ją stosuje: ', 'Why it is used: ')), L('mapa pokazuje głębokości i znaki, ale nie mówi wszystkiego. Locja wyjaśnia, jak podejść do portu, gdzie są płycizny, prądy i przeszkody, jak oznakowany jest tor, gdzie wolno się zatrzymać i jakie obowiązują lokalne zasady. Dzięki temu wiesz, czego się spodziewać, zanim tam dopłyniesz – zwłaszcza nocą i w złej widoczności.', 'the chart shows depths and marks but not everything. A pilot explains how to approach a harbour, where the shoals, currents and obstructions are, how the channel is marked, where you may stop and which local rules apply – so you know what to expect before you get there, especially at night and in poor visibility.')),
      h('p', {}, h('b', {}, L('Gdzie szukać lokalnych locji: ', 'Where to find local pilots: ')), L('publikacje urzędów hydrograficznych (w Polsce Biuro Hydrograficzne Marynarki Wojennej, w Wielkiej Brytanii UKHO – Admiralty Sailing Directions), spisy świateł i znaków nawigacyjnych, Wiadomości Żeglarskie (Notices to Mariners) z bieżącymi zmianami, przewodniki żeglarskie po danym akwenie, strony kapitanatów portów i urzędów morskich, a na wodach śródlądowych – komunikaty i mapy zarządców dróg wodnych (w Polsce Wody Polskie i urzędy żeglugi śródlądowej). Przed rejsem zawsze sprawdź, czy masz aktualne wydanie.', 'publications of hydrographic offices (e.g. UKHO – Admiralty Sailing Directions), lists of lights and buoys, Notices to Mariners with current changes, yachting pilots for the area, websites of harbour masters and maritime offices, and on inland waters the notices and charts of the waterway authorities. Before a passage always check you have the current edition.')),
      h('p', {}, h('b', {}, L('Locja morska obejmuje: ', 'Sea pilotage covers: ')), L('system oznakowania IALA (znaki boczne, kardynalne, specjalne itd.), latarnie i światła z ich charakterystykami, podejścia i wejścia do portów, tory wodne i systemy rozgraniczenia ruchu, głębokości, pływy i prądy, niebezpieczeństwa (mielizny, wraki, skały), strefy zamknięte i poligony, kotwicowiska, łączność z kapitanatem i przepisy portowe.', 'the IALA buoyage system (lateral, cardinal, special marks and so on), lighthouses and lights with their characters, harbour approaches and entrances, fairways and traffic separation schemes, depths, tides and currents, dangers (shoals, wrecks, rocks), restricted and firing areas, anchorages, communication with the harbour master and port regulations.')),
      h('p', {}, h('b', {}, L('Locja śródlądowa obejmuje: ', 'Inland pilotage covers: ')), L('oznakowanie szlaku żeglownego według CEVNI i przepisów krajowych (pławy i tyczki stron szlaku, rozwidlenia), znaki brzegowe – zakazu, nakazu, ograniczenia, zalecenia i informacyjne, śluzy, mosty i ich prześwity, jazy i stopnie wodne, stany wód i głębokości tranzytowe, prądy rzeczne, miejsca postoju i przystanie oraz lokalne ograniczenia prędkości i zakazy.', 'fairway marking under CEVNI and national rules (buoys and spars marking the sides of the fairway, bifurcations), bank signs – prohibitory, mandatory, restrictive, recommendatory and informative, locks, bridges and their clearances, weirs and barrages, water levels and transit depths, river currents, berthing places and landing stages, and local speed limits and prohibitions.'))),
    h('div.hb-entry', {},
      h('h3', {}, L('Regiony IALA A i B', 'IALA regions A and B')),
      h('p', {}, h('b', {}, 'IALA A: '), L('Europa, Afryka, Australia i większość Azji. Płynąc w kierunku oznakowania (od morza do portu) czerwone znaki zostawiasz po lewej, zielone po prawej burcie.', 'Europe, Africa, Australia and most of Asia. Going in the direction of buoyage (from seaward into harbour) leave red marks to port and green marks to starboard.')),
      h('p', {}, h('b', {}, 'IALA B: '), L('obie Ameryki, Japonia, Korea, Filipiny. Kolory znaków bocznych są odwrócone – „red right returning”: wracając z morza czerwone zostawiasz po prawej. Kształty się nie zmieniają.', 'the Americas, Japan, Korea, the Philippines. Lateral colours are reversed – “red right returning”: coming in from sea leave red marks to starboard. The shapes stay the same.')),
      h('p', {}, L('Znaki kardynalne, odosobnionego niebezpieczeństwa, wody bezpiecznej, specjalne i wraków są w obu regionach takie same.', 'Cardinal, isolated danger, safe water, special and wreck marks are the same in both regions.')),
      h('p', {}, L('Znak kardynalny pokazuje, po której stronie jest bezpieczna woda: mijasz go od strony, którą nazywa (północny – od północy). Stożki na szczycie wskazują, gdzie na pławie jest czarny kolor.', 'A cardinal mark shows on which side the safe water lies: pass on the side it is named after (north mark – to the north of it). The cones of the topmark point to where the black is on the buoy.')),
      h('p.small.muted', {}, L(`W symulacji obowiązuje region ${reg} – zmienisz go w Ustawieniach.`, `The simulation uses region ${reg} – change it in Settings.`)))] },
    { id: 'chars', name: L('Charakterystyki świateł', 'Light characters'), entries: charsSection() },
    { id: 'marks', name: L('Pławy i znaki', 'Buoys and marks'), entries: [
      h('div.hb-charx-grp', {}, L('Znaki boczne – IALA A (Europa, Afryka, Australia, większość Azji)', 'Lateral marks – IALA A (Europe, Africa, Australia, most of Asia)')),
      ...lateral('A'),
      h('div.hb-charx-grp', {}, L('Znaki boczne – IALA B (obie Ameryki, Japonia, Korea, Filipiny)', 'Lateral marks – IALA B (the Americas, Japan, Korea, the Philippines)')),
      h('p.small.muted', {}, L('W regionie B kształty znaków są takie same jak w A, odwrócone są tylko kolory i światła: znak lewy jest zielony, prawy czerwony („red right returning”).', 'In region B the shapes are the same as in A; only the colours and lights are reversed: the port-hand mark is green and the starboard-hand mark red (“red right returning”).')),
      ...lateral('B'),
      h('div.hb-charx-grp', {}, L('Znaki kardynalne', 'Cardinal marks')),
      e(L('Północny (N)', 'North (N)'), buoy([B, Y], tm.cones('N'), { char: 'VQ'}), [[L('Wygląd', 'Look'), L('Czarny nad żółtym, dwa stożki wierzchołkami do góry.', 'Black above yellow, two cones pointing up.')], [L('Światło', 'Light'), L('Białe VQ albo Q – błyski ciągłe.', 'White VQ or Q – continuous flashes.')], [L('Jak mijać', 'How to pass'), L('Mijaj od północy.', 'Pass to the north of it.')]], 'VQ'),
      e(L('Wschodni (E)', 'East (E)'), buoy([B, Y, B], tm.cones('E'), { char: 'VQ(3) 5s'}), [[L('Wygląd', 'Look'), L('Czarny z szerokim żółtym pasem, stożki podstawami do siebie.', 'Black with a broad yellow band, cones base to base.')], [L('Światło', 'Light'), L('Białe VQ(3) 5s albo Q(3) 10s – 3 błyski (jak godzina 3 na tarczy).', 'White VQ(3) 5s or Q(3) 10s – 3 flashes (like 3 o’clock).')], [L('Jak mijać', 'How to pass'), L('Mijaj od wschodu.', 'Pass to the east of it.')]], 'VQ(3) 5s'),
      e(L('Południowy (S)', 'South (S)'), buoy([Y, B], tm.cones('S'), { char: 'VQ(6)+LFl 10s'}), [[L('Wygląd', 'Look'), L('Żółty nad czarnym, dwa stożki wierzchołkami w dół.', 'Yellow above black, two cones pointing down.')], [L('Światło', 'Light'), L('Białe VQ(6)+LFl 10s albo Q(6)+LFl 15s – 6 błysków i blask (długi błysk).', 'White VQ(6)+LFl 10s or Q(6)+LFl 15s – 6 flashes and a long flash.')], [L('Jak mijać', 'How to pass'), L('Mijaj od południa.', 'Pass to the south of it.')]], 'VQ(6)+LFl 10s'),
      e(L('Zachodni (W)', 'West (W)'), buoy([Y, B, Y], tm.cones('W'), { char: 'VQ(9) 10s'}), [[L('Wygląd', 'Look'), L('Żółty z szerokim czarnym pasem, stożki wierzchołkami do siebie.', 'Yellow with a broad black band, cones point to point.')], [L('Światło', 'Light'), L('Białe VQ(9) 10s albo Q(9) 15s – 9 błysków.', 'White VQ(9) 10s or Q(9) 15s – 9 flashes.')], [L('Jak mijać', 'How to pass'), L('Mijaj od zachodu.', 'Pass to the west of it.')]], 'VQ(9) 10s'),
      h('div.hb-charx-grp', {}, L('Pozostałe znaki', 'Other marks')),
      e(L('Odosobnione niebezpieczeństwo', 'Isolated danger'), buoy([B, R, B], tm.balls(2, B), { char: 'Fl(2) 5s'}), [[L('Wygląd', 'Look'), L('Czarny z szerokim czerwonym pasem, dwie czarne kule.', 'Black with a broad red band, two black balls.')], [L('Światło', 'Light'), L('Białe Fl(2) – dwa błyski.', 'White Fl(2) – two flashes.')], [L('Znaczenie', 'Meaning'), L('Stoi na małym niebezpieczeństwie otoczonym żeglowną wodą – omijaj szerokim łukiem.', 'Stands on a small danger with navigable water all round – give it a wide berth.')]], 'Fl(2) 5s'),
      e(L('Woda bezpieczna', 'Safe water'), buoy([R, W, R, W], tm.balls(1, R), { char: 'LFl 10s', vertical: true }), [[L('Wygląd', 'Look'), L('Czerwono-białe pionowe pasy, czerwona kula.', 'Red and white vertical stripes, a red ball.')], [L('Światło', 'Light'), L('Białe Iso, Oc, LFl 10s albo Mo(A).', 'White Iso, Oc, LFl 10s or Mo(A).')], [L('Znaczenie', 'Meaning'), L('Wokół żeglowna woda – podejście do toru, środek toru. Można mijać z każdej strony.', 'Navigable water all round – landfall, mid-channel. Pass on either side.')]], 'LFl 10s'),
      e(L('Znak specjalny', 'Special mark'), buoy([Y, Y], tm.x, { char: 'Fl Y 5s'}), [[L('Wygląd', 'Look'), L('Żółty, znak szczytowy – żółty krzyż ukośny (X).', 'Yellow, topmark – a yellow X.')], [L('Światło', 'Light'), L('Żółte, np. Fl Y 5s.', 'Yellow, e.g. Fl Y 5s.')], [L('Znaczenie', 'Meaning'), L('Strefa specjalna: kąpielisko, poligon, kabel, rurociąg, farma wiatrowa – sprawdź na mapie.', 'Special area: bathing zone, exercise area, cable, pipeline, wind farm – check the chart.')]], 'Fl Y 5s'),
      e(L('Nowe niebezpieczeństwo (wrak)', 'New danger (wreck)'), buoy(['#1f5fd1', Y, '#1f5fd1', Y], tm.cross, { char: 'Al.Bu.Y 3s', vertical: true }), [[L('Wygląd', 'Look'), L('Niebiesko-żółte pionowe pasy, żółty krzyż prosty.', 'Blue and yellow vertical stripes, a yellow upright cross.')], [L('Światło', 'Light'), L('Naprzemiennie niebieskie i żółte (Bu/Y), po 1 s.', 'Alternating blue and yellow (Bu/Y), 1 s each.')], [L('Znaczenie', 'Meaning'), L('Świeży wrak lub przeszkoda jeszcze nie na mapach – omijaj szeroko.', 'A new wreck or obstruction not yet charted – keep well clear.')]], 'Al.Bu.Y 3s'),
      h('div.hb-charx-grp', {}, L('Znaki śródlądowe (CEVNI)', 'Inland waterway marks (CEVNI)')),
      h('p.small.muted', {}, L('Na drogach śródlądowych strony szlaku określa się, patrząc w dół rzeki (z prądem) – niezależnie od regionu IALA prawa strona jest czerwona, lewa zielona. Na jeziorach i kanałach bez prądu – zgodnie z kierunkiem ustalonym przez administrację drogi wodnej.', 'On inland waterways the sides of the fairway are named looking downstream – regardless of the IALA region the right side is red and the left side green. On lakes and canals without current the direction is set by the waterway authority.')),
      e(L('Prawa strona szlaku', 'Right-hand side of the fairway'), buoy([R, R], tm.can(R), { char: 'Fl R 4s' }), [[L('Wygląd', 'Look'), L('Czerwona pława walcowa (lub tyczka), znak szczytowy – czerwony walec.', 'A red can buoy (or spar), topmark – a red cylinder.')], [L('Światło', 'Light'), L('Czerwone, rytmiczne, np. Fl R 4s.', 'Red, rhythmic, e.g. Fl R 4s.')], [L('Jak mijać', 'How to pass'), L('Płynąc w dół rzeki – zostaw po prawej burcie (pod prąd – po lewej).', 'Going downstream – leave it to starboard (upstream – to port).')]], 'Fl R 4s'),
      e(L('Lewa strona szlaku', 'Left-hand side of the fairway'), buoy([IG, IG], tm.cone(IG), { char: 'Fl G 4s' }), [[L('Wygląd', 'Look'), L('Zielona pława stożkowa (lub tyczka), znak szczytowy – zielony stożek wierzchołkiem do góry.', 'A green conical buoy (or spar), topmark – a green cone point up.')], [L('Światło', 'Light'), L('Zielone, rytmiczne, np. Fl G 4s.', 'Green, rhythmic, e.g. Fl G 4s.')], [L('Jak mijać', 'How to pass'), L('Płynąc w dół rzeki – zostaw po lewej burcie (pod prąd – po prawej).', 'Going downstream – leave it to port (upstream – to starboard).')]], 'Fl G 4s'),
      e(L('Rozwidlenie szlaku', 'Fairway bifurcation'), buoy([R, IG, R, IG], tm.rgBall), [[L('Wygląd', 'Look'), L('Poziome pasy czerwone i zielone, znak szczytowy – kula czerwono-zielona.', 'Red and green horizontal bands, topmark – a red-and-green sphere.')], [L('Światło', 'Light'), L('Białe.', 'White.')], [L('Znaczenie', 'Meaning'), L('Szlak się rozdziela – można go minąć z obu stron; przeważający kolor wskazuje szlak główny.', 'The fairway divides – it may be passed on either side; the predominant colour shows the main channel.')]]),
      h('div.hb-charx-grp', {}, L('Śródlądowe – znaki brzegowe położenia szlaku', 'Inland – bank marks for the fairway position')),
      e(L('Szlak przy prawym brzegu', 'Fairway near the right bank'), board(sg.bankR), [[L('Wygląd', 'Look'), L('Czerwona tablica kwadratowa (nocą światło czerwone).', 'A red square board (red light at night).')], [L('Znaczenie', 'Meaning'), L('Szlak żeglowny biegnie przy prawym brzegu (patrząc w dół rzeki).', 'The fairway runs close to the right bank (looking downstream).')]]),
      e(L('Szlak przy lewym brzegu', 'Fairway near the left bank'), board(sg.bankL), [[L('Wygląd', 'Look'), L('Zielona tablica trójkątna wierzchołkiem do góry (nocą światło zielone).', 'A green triangular board point up (green light at night).')], [L('Znaczenie', 'Meaning'), L('Szlak żeglowny biegnie przy lewym brzegu (patrząc w dół rzeki).', 'The fairway runs close to the left bank (looking downstream).')]]),
      e(L('Przejście szlaku na drugi brzeg', 'Fairway crossing to the other bank'), board(sg.crossX), [[L('Wygląd', 'Look'), L('Żółty krzyż ukośny (X) na brzegu (nocą światło żółte).', 'A yellow St Andrew’s cross (X) on the bank (yellow light at night).')], [L('Znaczenie', 'Meaning'), L('Tu szlak przechodzi od jednego brzegu do drugiego – kieruj się na taki sam znak na przeciwnym brzegu.', 'Here the fairway crosses from one bank to the other – steer for the same mark on the opposite bank.')]]),
      e(L('Nabieżnik', 'Leading marks'), board(sg.leading), [[L('Wygląd', 'Look'), L('Dwa znaki jeden za drugim: przedni niżej, tylny wyżej (tablice z pionowym pasem, nocą dwa światła).', 'Two marks one behind the other: the front one lower, the rear one higher (boards with a vertical stripe, two lights at night).')], [L('Znaczenie', 'Meaning'), L('Płyń tak, aby oba znaki były w jednej linii (tylny dokładnie nad przednim) – jesteś wtedy na osi szlaku.', 'Keep the two marks in line (the rear exactly above the front) – you are then on the axis of the fairway.')]]),
      h('div.hb-charx-grp', {}, L('Śródlądowe – przejścia pod mostami', 'Inland – passages under bridges')),
      e(L('D.1a – zalecane przejście (ruch w obu kierunkach)', 'D.1a – recommended passage (two-way traffic)'), bridgePic(1), [[L('Wygląd', 'Look'), L('Jeden żółty romb nad przęsłem (nocą żółte światło stałe).', 'One yellow diamond above the span (fixed yellow light at night).')], [L('Znaczenie', 'Meaning'), L('Zalecane przejście pod mostem – ruch w obu kierunkach.', 'Recommended passage under the bridge – traffic in both directions.')]]),
      e(L('D.1b – zalecane przejście (ruch w jednym kierunku)', 'D.1b – recommended passage (one-way traffic)'), bridgePic(2), [[L('Wygląd', 'Look'), L('Dwa żółte romby jeden nad drugim (nocą dwa żółte światła).', 'Two yellow diamonds one above the other (two yellow lights at night).')], [L('Znaczenie', 'Meaning'), L('Przejście zalecane tylko w tym kierunku – z przeciwnej strony przęsło jest zamknięte.', 'Passage recommended in this direction only – the span is closed for traffic from the other side.')]]),
      e(L('A.10 – zakaz żeglugi poza wskazanym przejściem', 'A.10 – no passage outside the indicated area'), bridgePic(0), [[L('Wygląd', 'Look'), L('Biało-czerwone tablice na filarach mostu.', 'Red-and-white boards on the bridge piers.')], [L('Znaczenie', 'Meaning'), L('Przęsła oznaczone tymi tablicami są zamknięte – przepływaj tylko wskazanym przejściem.', 'The spans marked with these boards are closed – pass only through the indicated passage.')]]),
      e(L('C.2 – ograniczona wysokość', 'C.2 – limited headroom'), board(sg.limit("4,5", "v")), [[L('Wygląd', 'Look'), L('Biała tablica z czerwonym obramowaniem i liczbą metrów między strzałkami pionowymi.', 'A white board with a red border and the number of metres between vertical arrows.')], [L('Znaczenie', 'Meaning'), L('Prześwit pod mostem lub linią – tu 4,5 m nad aktualnym stanem wody. Sprawdź wysokość masztu!', 'Headroom under a bridge or cable – here 4.5 m above the current water level. Check your mast height!')]]),
      e(L('C.3 – ograniczona szerokość', 'C.3 – limited width'), board(sg.limit("12", "h")), [[L('Wygląd', 'Look'), L('Biała tablica z czerwonym obramowaniem i liczbą metrów między strzałkami poziomymi.', 'A white board with a red border and the number of metres between horizontal arrows.')], [L('Znaczenie', 'Meaning'), L('Szerokość przejścia lub szlaku ograniczona – tu do 12 m.', 'The width of the passage or fairway is limited – here to 12 m.')]]),
      e(L('C.1 – ograniczona głębokość', 'C.1 – limited depth'), board(sg.limit("2,2", "d")), [[L('Wygląd', 'Look'), L('Biała tablica z czerwonym obramowaniem, liczba metrów nad strzałką w dół.', 'A white board with a red border, the number of metres above a downward arrow.')], [L('Znaczenie', 'Meaning'), L('Głębokość wody ograniczona – tu 2,2 m. Porównaj z zanurzeniem jachtu.', 'The depth of water is limited – here 2.2 m. Compare it with your draught.')]]),
      h('div.hb-charx-grp', {}, L('Śródlądowe – znaki zakazu (A)', 'Inland – prohibitory signs (A)')),
      e(L('A.1 – zakaz przejścia', 'A.1 – no passage'), board(sg.noPass), [[L('Wygląd', 'Look'), L('Tablica czerwona – biała – czerwona (poziomo) albo dwa czerwone światła.', 'A red – white – red board (horizontal) or two red lights.')], [L('Znaczenie', 'Meaning'), L('Zakaz przejścia – np. zamknięta śluza lub odcinek drogi wodnej.', 'No passage – e.g. a closed lock or section of the waterway.')]]),
      e(L('A.2 – zakaz wyprzedzania', 'A.2 – no overtaking'), board(sg.prohib(sg.twoBoats)), [[L('Wygląd', 'Look'), L('Biała tablica z czerwonym obramowaniem i ukośną kreską, dwie jednostki.', 'A white board with a red border and diagonal bar, two vessels.')], [L('Znaczenie', 'Meaning'), L('Zakaz wyprzedzania na tym odcinku.', 'No overtaking on this stretch.')]]),
      e(L('A.5 – zakaz postoju', 'A.5 – no berthing'), board(sg.prohib(sg.P)), [[L('Wygląd', 'Look'), L('Biała tablica z czerwonym obramowaniem i ukośną kreską, czarna litera P.', 'A white board with a red border and diagonal bar, a black letter P.')], [L('Znaczenie', 'Meaning'), L('Zakaz postoju (cumowania) po tej stronie drogi wodnej.', 'No berthing (mooring) on this side of the waterway.')]]),
      e(L('A.6 – zakaz kotwiczenia', 'A.6 – no anchoring'), board(sg.prohib(sg.anchor)), [[L('Wygląd', 'Look'), L('Przekreślona kotwica na białej tablicy z czerwonym obramowaniem.', 'A crossed-out anchor on a white board with a red border.')], [L('Znaczenie', 'Meaning'), L('Zakaz kotwiczenia (i wleczenia kotwicy, łańcucha) po tej stronie drogi wodnej.', 'No anchoring (or trailing anchors and chains) on this side of the waterway.')]]),
      e(L('A.7 – zakaz cumowania do brzegu', 'A.7 – no making fast to the bank'), board(sg.prohib(sg.bollard)), [[L('Wygląd', 'Look'), L('Przekreślony poler na białej tablicy z czerwonym obramowaniem.', 'A crossed-out bollard on a white board with a red border.')], [L('Znaczenie', 'Meaning'), L('Nie wolno cumować do brzegu.', 'Making fast to the bank is prohibited.')]]),
      e(L('A.9 – zakaz wytwarzania fali', 'A.9 – do not create wash'), board(sg.prohib(sg.waves)), [[L('Wygląd', 'Look'), L('Biała tablica z czerwonym obramowaniem i ukośną kreską, czarne fale.', 'A white board with a red border and diagonal bar, black waves.')], [L('Znaczenie', 'Meaning'), L('Zwolnij – nie wytwarzaj fali (przystanie, mosty, prace na wodzie).', 'Slow down – do not make waves (landing stages, bridges, works on the water).')]]),
      e(L('A.13 – zakaz dla jednostek sportowych i rekreacyjnych', 'A.13 – no sport or pleasure craft'), board(sg.prohib(sg.motorboat)), [[L('Wygląd', 'Look'), L('Przekreślona motorówka na białej tablicy z czerwonym obramowaniem.', 'A crossed-out motorboat on a white board with a red border.')], [L('Znaczenie', 'Meaning'), L('Zakaz żeglugi małych jednostek sportowych i rekreacyjnych.', 'No navigation by small sport and pleasure craft.')]]),
      e(L('A.14 – zakaz uprawiania narciarstwa wodnego', 'A.14 – no water skiing'), board(sg.prohib(sg.skier)), [[L('Wygląd', 'Look'), L('Przekreślony narciarz wodny.', 'A crossed-out water skier.')], [L('Znaczenie', 'Meaning'), L('Zakaz narciarstwa wodnego i holowania osób.', 'No water skiing or towing of people.')]]),
      e(L('A.15 – zakaz żeglugi jachtów żaglowych', 'A.15 – no sailing vessels'), board(sg.prohib(sg.sailboat)), [[L('Wygląd', 'Look'), L('Przekreślony jacht żaglowy.', 'A crossed-out sailing boat.')], [L('Znaczenie', 'Meaning'), L('Zakaz żeglugi pod żaglami.', 'No sailing vessels.')]]),
      e(L('A.17 – zakaz windsurfingu', 'A.17 – no sailboards'), board(sg.prohib(sg.windsurf)), [[L('Wygląd', 'Look'), L('Przekreślona deska z żaglem.', 'A crossed-out sailboard.')], [L('Znaczenie', 'Meaning'), L('Zakaz pływania na deskach z żaglem.', 'No sailboarding.')]]),
      e(L('A.20 – zakaz skuterów wodnych', 'A.20 – no water bikes'), board(sg.prohib(sg.jetski)), [[L('Wygląd', 'Look'), L('Przekreślony skuter wodny.', 'A crossed-out water bike.')], [L('Znaczenie', 'Meaning'), L('Zakaz pływania skuterami wodnymi.', 'No water bikes (jet skis).')]]),
      h('div.hb-charx-grp', {}, L('Śródlądowe – znaki nakazu (B)', 'Inland – mandatory signs (B)')),
      e(L('B.1 – nakaz płynięcia w kierunku strzałki', 'B.1 – proceed in the direction of the arrow'), board(sg.mand(sg.arrow)), [[L('Wygląd', 'Look'), L('Biała tablica z czerwonym obramowaniem i czarną strzałką.', 'A white board with a red border and a black arrow.')], [L('Znaczenie', 'Meaning'), L('Płyń w kierunku wskazanym strzałką.', 'Proceed in the direction shown by the arrow.')]]),
      e(L('B.6 – ograniczenie prędkości', 'B.6 – speed limit'), board(sg.mand(sg.num("12"))), [[L('Wygląd', 'Look'), L('Biała tablica z czerwonym obramowaniem i liczbą (km/h).', 'A white board with a red border and a number (km/h).')], [L('Znaczenie', 'Meaning'), L('Nie przekraczaj podanej prędkości – tu 12 km/h względem brzegu.', 'Do not exceed the speed shown – here 12 km/h relative to the bank.')]]),
      e(L('B.7 – nakaz podania sygnału dźwiękowego', 'B.7 – sound your horn'), board(sg.mand(sg.horn)), [[L('Wygląd', 'Look'), L('Biała tablica z czerwonym obramowaniem i symbolem sygnału.', 'A white board with a red border and a horn symbol.')], [L('Znaczenie', 'Meaning'), L('Podaj długi sygnał dźwiękowy (np. przed zakrętem lub mostem).', 'Give a long blast (e.g. before a bend or bridge).')]]),
      e(L('B.11 – nakaz łączności radiowej', 'B.11 – radio communication required'), board(sg.mand(sg.vhf)), [[L('Wygląd', 'Look'), L('Biała tablica z czerwonym obramowaniem i napisem VHF z numerem kanału.', 'A white board with a red border, VHF and a channel number.')], [L('Znaczenie', 'Meaning'), L('Nawiąż łączność na podanym kanale VHF (śluzy, mosty zwodzone, porty).', 'Make contact on the VHF channel shown (locks, lifting bridges, ports).')]]),
      h('div.hb-charx-grp', {}, L('Śródlądowe – znaki informacyjne (E)', 'Inland – informative signs (E)')),
      e(L('E.1 – wejście dozwolone', 'E.1 – entry permitted'), board(sg.entryOk), [[L('Wygląd', 'Look'), L('Tablica zielona – biała – zielona albo dwa zielone światła.', 'A green – white – green board or two green lights.')], [L('Znaczenie', 'Meaning'), L('Wolno wpłynąć (np. do śluzy) lub przepłynąć.', 'Entry (e.g. into a lock) or passage is permitted.')]]),
      e(L('E.5 – postój dozwolony', 'E.5 – berthing permitted'), board(sg.blueP), [[L('Wygląd', 'Look'), L('Niebieska kwadratowa tablica z białą literą P.', 'A blue square board with a white letter P.')], [L('Znaczenie', 'Meaning'), L('Miejsce, w którym wolno stać i cumować po tej stronie drogi wodnej.', 'A place where berthing and mooring are permitted on this side of the waterway.')]]),
      e(L('E.6 – kotwiczenie dozwolone', 'E.6 – anchoring permitted'), board(sg.blue(sg.anchorW)), [[L('Wygląd', 'Look'), L('Niebieska tablica z białą kotwicą.', 'A blue board with a white anchor.')], [L('Znaczenie', 'Meaning'), L('Miejsce, w którym wolno kotwiczyć.', 'A place where anchoring is permitted.')]]),
      e(L('E.7 – cumowanie do brzegu dozwolone', 'E.7 – making fast to the bank permitted'), board(sg.blue(sg.bollardW)), [[L('Wygląd', 'Look'), L('Niebieska tablica z białym polerem.', 'A blue board with a white bollard.')], [L('Znaczenie', 'Meaning'), L('Wolno cumować do brzegu.', 'Making fast to the bank is permitted.')]]),
      e(L('E.2 – linia napowietrzna', 'E.2 – overhead cable'), board(sg.blue(sg.cable)), [[L('Wygląd', 'Look'), L('Niebieska tablica z symbolem linii.', 'A blue board with a cable symbol.')], [L('Znaczenie', 'Meaning'), L('Nad drogą wodną przebiega linia napowietrzna – uważaj na maszt!', 'An overhead cable crosses the waterway – mind your mast!')]]),
      e(L('E.17 / E.18 – narciarstwo wodne / żegluga dozwolone', 'E.17 / E.18 – water skiing / sailing permitted'), board(sg.blue(sg.sailW)), [[L('Wygląd', 'Look'), L('Niebieska tablica z białym symbolem (narciarz, jacht żaglowy, deska…).', 'A blue board with a white symbol (skier, sailing boat, sailboard…).')], [L('Znaczenie', 'Meaning'), L('Strefa, w której dana aktywność jest dozwolona.', 'An area where that activity is permitted.')]]),
    ] }
  ];
}

// ---------- ekran podręcznika ----------
export function showHandbook(app, { title, sections, onExit, onTrain, sceneryEl, tools = null }) {
  app.innerHTML = '';
  // animowane lampy tylko z bieżącego podręcznika
  LAMPS.clear();
  for (const s of sections) for (const e of s.entries) if (e && e.querySelectorAll) animLamps(e);
  let cur = sections[0].id;
  const nav = h('div.hb-nav');
  const main = h('div.hb-main');
  const root = h('div.screen.handbook', {}, sceneryEl ? sceneryEl() : null,
    h('div.screen-header', {}, h('div.logo', {}, 'Moor', h('span', {}, 'Me')), h('div.sub', {}, title)),
    h('div.hb-body', {}, nav, main),
    h('div.screen-footer', {}, h('button.btn', { onclick: () => onExit() }, '← Wstecz'), tools ? tools() : null, onTrain ? h('button.btn.primary', { onclick: () => onTrain() }, '🎯 Przejdź do treningu') : h('span')));
  app.appendChild(root);
  const render = () => {
    nav.innerHTML = '';
    for (const s of sections) nav.appendChild(h('button.hb-tab', { class: s.id === cur ? 'on' : '', onclick: () => { cur = s.id; render(); main.scrollTop = 0; } }, s.name));
    main.innerHTML = '';
    const s = sections.find((q) => q.id === cur);
    main.append(h('h2', {}, s.name), ...s.entries);
    kickLamps();
  };
  render();
}

// ekran wyboru: trening w symulacji albo nauka z podręcznika
export function showTrainOrLearn(app, { title, desc, onTrain, onLearn, onExit, sceneryEl, icons = {} }) {
  app.innerHTML = '';
  const card = (cls, ic, name, text, fn) => h('button.mode-card' + cls, { onclick: fn }, h('div.mc-ic', {}, ic), h('h3', {}, name), h('p', {}, text));
  app.appendChild(h('div.screen.title-screen', {}, sceneryEl ? sceneryEl() : null,
    h('div.title-card', { style: { width: 'min(820px, 94vw)' } },
      h('div.big-logo', {}, 'Moor', h('span', {}, 'Me')),
      h('p.desc', {}, title),
      h('div.mode-cards.two', {},
        card('.train', icons.train || '🎯', 'Trening w symulacji', desc.train, onTrain),
        card('.learn', icons.learn || '📖', 'Nauka – podręcznik', desc.learn, onLearn)),
      h('div.tbtn-row', {}, h('button.btn', { onclick: () => onExit() }, '← Tryby')))));
}
