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
const LCOL = { white: '#fff6e0', red: '#ff3b2f', green: '#29e05a', yellow: '#ffd166', deck: '#ffd9a0' };

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
  return { Lm, lights: v.lights(Lm, () => 0.9, { gearSide: 'starboard' }) };
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
  const hullCol = '#1d2635';
  if (view.kind === 'side') {
    const s = view.rel > 0 ? 1 : -1, a = X(-s * Lm / 2), b = X(s * Lm / 2), hh = Math.max(1.2, Lm * 0.05) * sc;
    g += `<polygon points="${a},${Y(0)} ${b - s * 6},${Y(0)} ${b},${Y(0) - hh} ${a},${Y(0) - hh}" fill="${hullCol}"/>`;
    if (Lm > 20) g += `<rect x="${Math.min(a, a + s * Lm * 0.15 * sx)}" y="${Y(0) - hh * 1.8}" width="${Lm * 0.15 * sx}" height="${hh * 0.8}" fill="${hullCol}"/>`;
    else g += `<rect x="${X(0) - 1}" y="${Y(14)}" width="2" height="${Y(0) - Y(14) - hh}" fill="${hullCol}"/>`;
  } else {
    const hb = (beam / 2) * sx;
    const hh = Math.max(1.2, Lm * 0.05) * sc;
    g += `<polygon points="${X(0) - hb},${Y(0) - hh} ${X(0) + hb},${Y(0) - hh} ${X(0) + hb * 0.8},${Y(0)} ${X(0) - hb * 0.8},${Y(0)}" fill="${hullCol}"/>`;
    if (Lm > 20) g += `<rect x="${X(0) - hb * 0.6}" y="${Y(0) - hh * 1.8}" width="${hb * 1.2}" height="${hh * 0.8}" fill="${hullCol}"/>`;
    else g += `<rect x="${X(0) - 1}" y="${Y(14)}" width="2" height="${Y(0) - Y(14) - hh}" fill="${hullCol}"/>`;
  }
  for (const l of vis) {
    const cx = X(view.ax(l)), cy = Y(l.y), c = LCOL[l.c];
    const rr = l.c === 'deck' ? 2.2 : 3.6;
    g += `<circle cx="${cx}" cy="${cy}" r="${rr * 2.5}" fill="${c}" opacity="0.18"/><circle cx="${cx}" cy="${cy}" r="${rr}" fill="${c}"/>`;
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
  if (k === 'hourglass') return `<polygon points="${cx - s * 0.5},${cy - s * 0.75} ${cx + s * 0.5},${cy - s * 0.75} ${cx},${cy}" fill="${b}"/><polygon points="${cx - s * 0.5},${cy + s * 0.75} ${cx + s * 0.5},${cy + s * 0.75} ${cx},${cy}" fill="${b}"/>`;
  return '';
}
function dayView(v, W = 300, H = 150) {
  const Lm = (v.L[0] + v.L[1]) / 2;
  const shapes = v.shapes(Lm, () => 0.5, { gearSide: 'starboard' }).filter((s) => s.x > -Lm); // holowana jednostka – osobno w opisie
  let g = `<rect width="${W}" height="${H}" fill="#cfe6f4"/><rect y="${H - 22}" width="${W}" height="22" fill="#7fb4cf"/>`;
  const base = H - 22, hullW = 220, x0 = (W - hullW) / 2;
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
  const sorted = [...shapes].sort((a, b) => b.y - a.y);
  let y = base - (v.hull === 'yacht' ? 92 : 104);
  for (const s of sorted) {
    if (Math.abs(s.z) > 1) { g += shape(s.k, mx + 40, base - 52, 16); g += `<path d="M${mx} ${base - 70} L${mx + 40} ${base - 60}" stroke="${dark}" stroke-width="1.5"/>`; continue; }
    g += shape(s.k, mx, y, 16); y += s.k === 'hourglass' ? 30 : s.k === 'diamond' ? 26 : 22;
  }
  if (!shapes.length) g += `<text x="${W / 2}" y="22" text-anchor="middle" font-size="13" font-family="sans-serif" fill="#2f4468">${t('brak znaków')}</text>`;
  return g;
}
const dayEntry = (v) => h('div.hb-entry', {}, h('h3', {}, v.name), svgEl(300, 150, dayView(v)), h('p', {}, v.explain));

export function lightsBook() {
  return [
    { id: 'intro', name: L('Zasady', 'Basics'), entries: [h('div.hb-entry', {},
      h('h3', {}, L('Sektory świateł', 'Light sectors')),
      svgEl(320, 220, sectorDiagram()),
      h('p', {}, L('Masztowe (białe) świeci 225° do przodu, burtowe po 112,5°: zielone na prawej, czerwone na lewej burcie. Rufowe (białe) – 135° do tyłu. Światła dookólne widać z każdej strony. Kolory widziane z boku i z dziobu mówią, w którą stronę płynie statek.', 'The masthead light (white) shows over 225° ahead, the sidelights over 112.5° each: green to starboard, red to port. The sternlight (white) shows over 135° astern. All-round lights are seen from every direction. The colours you see tell you which way a vessel is heading.')),
      h('p', {}, L('Pamiętaj: patrząc na statek od dziobu widzisz jego zieloną burtę po swojej lewej, a czerwoną po prawej.', 'Remember: looking at a vessel head-on, its green side is on your left and its red side on your right.')))] },
    { id: 'night', name: L('Światła nocne', 'Night lights'), entries: VESSELS.map(lightsEntry) },
    { id: 'day', name: L('Znaki dzienne', 'Day shapes'), entries: DAY_VESSELS.map(dayEntry) }
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
// ---------- charakterystyki świateł: lampa animowana z prawdziwym taktowaniem i wykres czasowy ----------
const LAMP_OFF = '#3a3f47';
// lampa (SVG): data-lc – zapis charakterystyki; animuje ją wspólna pętla animLamps
const lampSvg = (code, cx, cy, r = 6) => `<g data-lc="${code}"><circle class="lh" cx="${cx}" cy="${cy}" r="${r * 2.8}" fill="#fff" opacity="0"/><circle class="lc" cx="${cx}" cy="${cy}" r="${r}" fill="${LAMP_OFF}" stroke="#1b1f24" stroke-width="0.8"/></g>`;
// wykres czasowy: kilka okresów (co najmniej ~6 s), podziałka co 1 s, przesuwający się znacznik czasu
function timelineSvg(code, W = 300) {
  const seq = lightSequence(code), span = Math.max(seq.period, Math.ceil(6 / seq.period) * seq.period), H = 46, x0 = 10, w = W - 20, k = w / span;
  let g = `<rect width="${W}" height="${H}" rx="6" fill="#0b1220"/><line x1="${x0}" y1="18" x2="${x0 + w}" y2="18" stroke="#2b3547" stroke-width="2"/>`;
  for (let t = 0, i = 0; t < span - 1e-9; i++) {
    const sg = seq.segs[i % seq.segs.length];
    if (sg.on) g += `<rect x="${(x0 + t * k).toFixed(2)}" y="9" width="${Math.max(1.2, sg.d * k).toFixed(2)}" height="18" rx="1.5" fill="${LIGHT_COLORS[sg.c] || LIGHT_COLORS.W}"/>`;
    t += sg.d;
  }
  const step = span > 16 ? 2 : 1;
  for (let t = 0; t <= span + 1e-9; t += step) g += `<line x1="${x0 + t * k}" y1="29" x2="${x0 + t * k}" y2="${t % (step * 2) === 0 ? 33 : 31}" stroke="#7a8290"/>` + (t % (step * 2) === 0 ? `<text x="${x0 + t * k}" y="${H - 3}" font-size="9" fill="#9aa3b2" text-anchor="middle" font-family="sans-serif">${t} s</text>` : '');
  for (let t = seq.period; t < span - 1e-9; t += seq.period) g += `<line x1="${x0 + t * k}" y1="5" x2="${x0 + t * k}" y2="29" stroke="#ffffff" stroke-opacity="0.25" stroke-dasharray="2 2"/>`;
  g += `<line data-lt="${code}" data-span="${span}" data-x0="${x0}" data-w="${w}" x1="${x0}" y1="5" x2="${x0}" y2="29" stroke="#ff5a5a" stroke-width="1.5"/>`;
  return g;
}
const LAMPS = new Set();
let lampRaf = 0;
function lampTick(now) {
  const t = now / 1000;
  let live = 0;
  for (const el of LAMPS) {
    if (!el.isConnected) continue; // np. inna zakładka podręcznika – wraca po przełączeniu
    live++;
    if (el.__lamp) {
      const s = lightAt(el.__seq, t), col = s.on ? (LIGHT_COLORS[s.c] || LIGHT_COLORS.W) : null;
      el.__core.setAttribute('fill', col || LAMP_OFF);
      el.__halo.setAttribute('fill', col || '#fff');
      el.__halo.setAttribute('opacity', col ? '0.55' : '0');
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

function charsSection() {
  const ex = (code, title, desc, extra = null) => animLamps(h('div.hb-entry.hb-char', {},
    nightLamp(code),
    h('div.hb-char-body', {}, h('h3', {}, title), h('div.hb-char-code', {}, code), svgEl(320, 46, timelineSvg(code, 320)), h('p', {}, desc), extra)));
  return [
    h('div.hb-entry', {}, h('h3', {}, L('Jak czytać opis światła na mapie', 'How to read a light description on the chart')),
      h('p', {}, h('b', {}, 'Fl(3) G 10s 12m 5M'), ' – ', L('charakterystyka Fl(3) (trzy błyski w grupie), kolor zielony (G), okres 10 s (po tylu sekundach cały rytm się powtarza), wysokość światła 12 m nad poziomem wody, zasięg nominalny 5 Mm. Brak litery koloru oznacza światło białe.', 'character Fl(3) (a group of three flashes), green (G), period 10 s (the whole rhythm repeats every 10 s), light 12 m above sea level, nominal range 5 NM. No colour letter means a white light.')),
      h('p', {}, L('Na wykresach poniżej kolorowe paski to czas świecenia, ciemne – przerwy; przerywane pionowe linie oddzielają kolejne okresy, a czerwona kreska przesuwa się w takt animowanej lampy.', 'In the diagrams below the coloured bars show when the light is on and the dark parts the eclipses; the dashed vertical lines separate the periods and the red marker moves in step with the animated lamp.')),
      h('p', {}, L('Zasada ogólna: światło błyskowe świeci krócej, niż trwają przerwy; przerywane – dłużej niż przerwy; izofazowe – tyle samo.', 'General rule: a flashing light is on for less time than it is off; an occulting light is on for longer than it is off; an isophase light is on and off for equal times.'))),
    ex('F R', L('F – stałe (fixed)', 'F – fixed'), L('Świeci cały czas, bez przerw i bez zmian. Np. światła na główkach portu.', 'Shows continuously and steadily, with no change. E.g. harbour pier-head lights.')),
    ex('Fl G 4s', L('Fl – błyskowe (flashing)', 'Fl – flashing'), L('Pojedyncze krótkie błyski (zwykle ok. 0,5 s) z dłuższymi przerwami, nie więcej niż 30 błysków na minutę. Typowe dla znaków bocznych.', 'Single short flashes (usually about 0.5 s) with longer eclipses, at most 30 flashes per minute. Typical of lateral marks.')),
    ex('Fl(2) 5s', L('Fl(2) – grupowe błyskowe (group flashing)', 'Fl(2) – group flashing'), L('Grupa kilku błysków, potem dłuższa przerwa. Liczba w nawiasie to liczba błysków w grupie. Fl(2) – znak odosobnionego niebezpieczeństwa.', 'A group of flashes followed by a longer eclipse. The number in brackets is the number of flashes in the group. Fl(2) – isolated danger mark.')),
    ex('Fl(2+1) R 10s', L('Fl(2+1) – złożone grupowe (composite group flashing)', 'Fl(2+1) – composite group flashing'), L('Dwie grupy o różnej liczbie błysków: 2 błyski, przerwa, 1 błysk, długa przerwa. Znaki rozwidlenia toru.', 'Two groups with a different number of flashes: 2 flashes, an eclipse, 1 flash, a long eclipse. Preferred-channel marks.')),
    ex('LFl 10s', L('LFl – długobłyskowe (long flashing)', 'LFl – long flashing'), L('Jeden długi błysk trwający co najmniej 2 s. Np. znak wody bezpiecznej LFl 10s.', 'One long flash of at least 2 s. E.g. a safe-water mark LFl 10s.')),
    ex('Q', L('Q – szybkobłyskowe (quick)', 'Q – quick'), L('Błyski szybko jeden po drugim: 50–79 na minutę (zwykle 60, czyli co sekundę), bez przerw – świeci tak ciągle. Znak kardynalny północny.', 'Flashes in quick succession: 50–79 per minute (usually 60, i.e. one per second), continuously. North cardinal mark.')),
    ex('Q(3) 10s', L('Q(n) – grupowe szybkobłyskowe', 'Q(n) – group quick'), L('Grupa szybkich błysków, potem przerwa. Na znakach kardynalnych liczba błysków odpowiada godzinie na tarczy zegara: E – 3, S – 6, W – 9.', 'A group of quick flashes, then an eclipse. On cardinal marks the number of flashes matches the clock face: E – 3, S – 6, W – 9.')),
    ex('VQ', L('VQ – bardzo szybkobłyskowe (very quick)', 'VQ – very quick'), L('80–159 błysków na minutę (zwykle 120 – dwa na sekundę). Zamiennie z Q na znakach kardynalnych, często tam, gdzie znaki stoją blisko siebie.', '80–159 flashes per minute (usually 120 – two per second). Used instead of Q on cardinal marks, often where marks stand close together.')),
    ex('VQ(6)+LFl 10s', L('VQ(6)+LFl – znak kardynalny południowy', 'VQ(6)+LFl – south cardinal mark'), L('Sześć bardzo szybkich błysków i zaraz po nich długi błysk – ten długi błysk pozwala odróżnić 6 od 9 błysków.', 'Six very quick flashes immediately followed by a long flash – the long flash lets you tell 6 from 9 flashes.')),
    ex('UQ', L('UQ – ultraszybkobłyskowe (ultra quick)', 'UQ – ultra quick'), L('160 i więcej błysków na minutę (zwykle 240–300). Rzadkie – np. na konstrukcjach morskich.', '160 or more flashes per minute (usually 240–300). Rare – e.g. on offshore structures.')),
    ex('Iso 4s', L('Iso – izofazowe (isophase)', 'Iso – isophase'), L('Światło i ciemność trwają tyle samo. Iso 4s – 2 s światła, 2 s przerwy. Znak wody bezpiecznej.', 'Light and darkness of equal length. Iso 4s – 2 s of light, 2 s of darkness. Safe-water mark.')),
    ex('Oc 4s', L('Oc – przerywane (occulting)', 'Oc – occulting'), L('Odwrotność błyskowego: świeci dłużej, niż trwają krótkie zaciemnienia. Oc 4s – 3 s światła, 1 s ciemności.', 'The opposite of flashing: the light is on longer than the short eclipses. Oc 4s – 3 s of light, 1 s of darkness.')),
    ex('Oc(2) 8s', L('Oc(n) – grupowe przerywane', 'Oc(n) – group occulting'), L('Grupa kilku krótkich zaciemnień w okresie. Oc(2) 8s – dwa zaciemnienia po 1 s.', 'A group of short eclipses in each period. Oc(2) 8s – two 1-s eclipses.')),
    ex('Mo(A) 6s', L('Mo – kodem Morse’a', 'Mo – Morse code'), L('Błyski krótkie i długie układają się w literę alfabetu Morse’a. Mo(A) (· –) – znak wody bezpiecznej, często na pławach podejściowych.', 'Short and long flashes form a Morse letter. Mo(A) (· –) – a safe-water mark, often on landfall buoys.')),
    ex('Al.Bu.Y 3s', L('Al – zmiennobarwne (alternating)', 'Al – alternating'), L('Światło zmienia kolor w kolejnych fazach, np. Al.WR – białe i czerwone. Al.Bu.Y – niebieskie i żółte na znaku nowego niebezpieczeństwa (wraku).', 'The light changes colour in successive phases, e.g. Al.WR – white and red. Al.Bu.Y – blue and yellow on a new-danger (wreck) mark.'))
  ];
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
  cross: (x, y) => `<path d="M${x} ${y - 11} L${x} ${y + 11} M${x - 10} ${y} L${x + 10} ${y}" stroke="#f2c230" stroke-width="5"/>`
};
export function marksBook() {
  const lc = lateralColors(), P = hex(lc.port), S = hex(lc.stbd), B = '#16181c', Y = '#f2c230', R = '#d62828', W = '#ffffff';
  const reg = IALA.region;
  const e = (title, pic, rows, char) => animLamps(h('div.hb-entry.hb-mark', {}, svgEl(120, 170, pic), h('div', {}, h('h3', {}, title), ...rows.map(([a, b]) => h('p', {}, h('b', {}, a + ': '), b)),
    char ? h('div.hb-rhythm', {}, h('span.muted', {}, `${L('Światło nocą', 'Light at night')} – ${char}:`), h('div.hb-rhythm-row', {}, nightLamp(char, 46), svgEl(300, 46, timelineSvg(char)))) : null)));
  const pName = lc.port === 0xd62828 ? L('czerwony', 'red') : L('zielony', 'green'), sName = lc.stbd === 0xd62828 ? L('czerwony', 'red') : L('zielony', 'green');
  const lightP = lc.port === 0xd62828 ? 'R' : 'G', lightS = lc.stbd === 0xd62828 ? 'R' : 'G';
  return [
    { id: 'intro', name: L('Zasady', 'Basics'), entries: [h('div.hb-entry', {},
      h('h3', {}, `IALA ${reg}`),
      h('p', {}, reg === 'A'
        ? L('Region A: Europa, Afryka, Australia i większość Azji. Płynąc w kierunku oznakowania (od morza do portu) czerwone znaki zostawiasz po lewej, zielone po prawej burcie.', 'Region A: Europe, Africa, Australia and most of Asia. Going in the direction of buoyage (from seaward into harbour) leave red marks to port and green marks to starboard.')
        : L('Region B: obie Ameryki, Japonia, Korea, Filipiny. Kolory znaków bocznych są odwrócone – „red right returning”: wracając z morza czerwone zostawiasz po prawej. Kształty się nie zmieniają.', 'Region B: the Americas, Japan, Korea, the Philippines. Lateral colours are reversed – “red right returning”: coming in from sea leave red marks to starboard. The shapes stay the same.')),
      h('p', {}, L('Znak kardynalny pokazuje, po której stronie jest bezpieczna woda: mijasz go od strony, którą nazywa (północny – od północy). Stożki na szczycie wskazują, gdzie na pławie jest czarny kolor.', 'A cardinal mark shows on which side the safe water lies: pass on the side it is named after (north mark – to the north of it). The cones of the topmark point to where the black is on the buoy.')),
      h('p.small.muted', {}, L('Region zmienisz w Ustawieniach.', 'Change the region in Settings.')))] },
    { id: 'chars', name: L('Charakterystyki świateł', 'Light characters'), entries: charsSection() },
    { id: 'lateral', name: L('Znaki boczne', 'Lateral marks'), entries: [
      e(L('Znak boczny lewy', 'Port-hand mark'), buoy([P, P], tm.can(P), { char: `Fl ${lightP} 4s`}), [[L('Wygląd', 'Look'), L(`${pName}, kształt beczki (lub pława filarowa/tyczkowa), znak szczytowy – ${pName} walec`, `${pName}, can shape (or pillar/spar), topmark – a ${pName} can`)], [L('Światło', 'Light'), L(`${lightP}, dowolny rytm oprócz Fl(2+1), np. Fl ${lightP} 4s`, `${lightP}, any rhythm except Fl(2+1), e.g. Fl ${lightP} 4s`)], [L('Jak mijać', 'How to pass'), L('W kierunku oznakowania – zostaw po lewej burcie.', 'In the direction of buoyage – leave it to port.')]], `Fl ${lightP} 4s`),
      e(L('Znak boczny prawy', 'Starboard-hand mark'), buoy([S, S], tm.cone(S), { char: `Fl ${lightS} 4s`}), [[L('Wygląd', 'Look'), L(`${sName}, stożek (lub pława filarowa/tyczkowa), znak szczytowy – ${sName} stożek wierzchołkiem do góry`, `${sName}, conical (or pillar/spar), topmark – a ${sName} cone point up`)], [L('Światło', 'Light'), L(`${lightS}, np. Fl ${lightS} 4s`, `${lightS}, e.g. Fl ${lightS} 4s`)], [L('Jak mijać', 'How to pass'), L('W kierunku oznakowania – zostaw po prawej burcie.', 'In the direction of buoyage – leave it to starboard.')]], `Fl ${lightS} 4s`),
      e(L('Rozwidlenie – główny tor w prawo', 'Preferred channel to starboard'), buoy([P, S, P], tm.can(P), { char: `Fl(2+1) ${lightP} 10s`}), [[L('Wygląd', 'Look'), L('Kolor znaku lewego z jednym szerokim pasem koloru prawego, beczka.', 'Port-hand colour with one broad band of the starboard colour, can shape.')], [L('Światło', 'Light'), `Fl(2+1) ${lightP}`], [L('Znaczenie', 'Meaning'), L('Tor główny prowadzi w prawo – znak traktujesz jak lewy.', 'The main channel is to starboard – treat it as a port-hand mark.')]], `Fl(2+1) ${lightP} 10s`),
      e(L('Rozwidlenie – główny tor w lewo', 'Preferred channel to port'), buoy([S, P, S], tm.cone(S), { char: `Fl(2+1) ${lightS} 10s`}), [[L('Wygląd', 'Look'), L('Kolor znaku prawego z jednym szerokim pasem koloru lewego, stożek.', 'Starboard-hand colour with one broad band of the port colour, conical.')], [L('Światło', 'Light'), `Fl(2+1) ${lightS}`], [L('Znaczenie', 'Meaning'), L('Tor główny prowadzi w lewo – znak traktujesz jak prawy.', 'The main channel is to port – treat it as a starboard-hand mark.')]], `Fl(2+1) ${lightS} 10s`)
    ] },
    { id: 'cardinal', name: L('Znaki kardynalne', 'Cardinal marks'), entries: [
      e(L('Północny (N)', 'North (N)'), buoy([B, Y], tm.cones('N'), { char: 'VQ'}), [[L('Wygląd', 'Look'), L('Czarny nad żółtym, dwa stożki wierzchołkami do góry.', 'Black above yellow, two cones pointing up.')], [L('Światło', 'Light'), L('Białe VQ albo Q – błyski ciągłe.', 'White VQ or Q – continuous flashes.')], [L('Jak mijać', 'How to pass'), L('Mijaj od północy.', 'Pass to the north of it.')]], 'VQ'),
      e(L('Wschodni (E)', 'East (E)'), buoy([B, Y, B], tm.cones('E'), { char: 'VQ(3) 5s'}), [[L('Wygląd', 'Look'), L('Czarny z szerokim żółtym pasem, stożki podstawami do siebie.', 'Black with a broad yellow band, cones base to base.')], [L('Światło', 'Light'), L('Białe VQ(3) 5s albo Q(3) 10s – 3 błyski (jak godzina 3 na tarczy).', 'White VQ(3) 5s or Q(3) 10s – 3 flashes (like 3 o’clock).')], [L('Jak mijać', 'How to pass'), L('Mijaj od wschodu.', 'Pass to the east of it.')]], 'VQ(3) 5s'),
      e(L('Południowy (S)', 'South (S)'), buoy([Y, B], tm.cones('S'), { char: 'VQ(6)+LFl 10s'}), [[L('Wygląd', 'Look'), L('Żółty nad czarnym, dwa stożki wierzchołkami w dół.', 'Yellow above black, two cones pointing down.')], [L('Światło', 'Light'), L('Białe VQ(6)+LFl 10s albo Q(6)+LFl 15s – 6 błysków i długi.', 'White VQ(6)+LFl 10s or Q(6)+LFl 15s – 6 flashes and a long one.')], [L('Jak mijać', 'How to pass'), L('Mijaj od południa.', 'Pass to the south of it.')]], 'VQ(6)+LFl 10s'),
      e(L('Zachodni (W)', 'West (W)'), buoy([Y, B, Y], tm.cones('W'), { char: 'VQ(9) 10s'}), [[L('Wygląd', 'Look'), L('Żółty z szerokim czarnym pasem, stożki wierzchołkami do siebie.', 'Yellow with a broad black band, cones point to point.')], [L('Światło', 'Light'), L('Białe VQ(9) 10s albo Q(9) 15s – 9 błysków.', 'White VQ(9) 10s or Q(9) 15s – 9 flashes.')], [L('Jak mijać', 'How to pass'), L('Mijaj od zachodu.', 'Pass to the west of it.')]], 'VQ(9) 10s')
    ] },
    { id: 'other', name: L('Pozostałe znaki', 'Other marks'), entries: [
      e(L('Odosobnione niebezpieczeństwo', 'Isolated danger'), buoy([B, R, B], tm.balls(2, B), { char: 'Fl(2) 5s'}), [[L('Wygląd', 'Look'), L('Czarny z szerokim czerwonym pasem, dwie czarne kule.', 'Black with a broad red band, two black balls.')], [L('Światło', 'Light'), L('Białe Fl(2) – dwa błyski.', 'White Fl(2) – two flashes.')], [L('Znaczenie', 'Meaning'), L('Stoi na małym niebezpieczeństwie otoczonym żeglowną wodą – omijaj szerokim łukiem.', 'Stands on a small danger with navigable water all round – give it a wide berth.')]], 'Fl(2) 5s'),
      e(L('Woda bezpieczna', 'Safe water'), buoy([R, W, R, W], tm.balls(1, R), { char: 'LFl 10s', vertical: true }), [[L('Wygląd', 'Look'), L('Czerwono-białe pionowe pasy, czerwona kula.', 'Red and white vertical stripes, a red ball.')], [L('Światło', 'Light'), L('Białe Iso, Oc, LFl 10s albo Mo(A).', 'White Iso, Oc, LFl 10s or Mo(A).')], [L('Znaczenie', 'Meaning'), L('Wokół żeglowna woda – podejście do toru, środek toru. Można mijać z każdej strony.', 'Navigable water all round – landfall, mid-channel. Pass on either side.')]], 'LFl 10s'),
      e(L('Znak specjalny', 'Special mark'), buoy([Y, Y], tm.x, { char: 'Fl Y 5s'}), [[L('Wygląd', 'Look'), L('Żółty, znak szczytowy – żółty krzyż ukośny (X).', 'Yellow, topmark – a yellow X.')], [L('Światło', 'Light'), L('Żółte, np. Fl Y 5s.', 'Yellow, e.g. Fl Y 5s.')], [L('Znaczenie', 'Meaning'), L('Strefa specjalna: kąpielisko, poligon, kabel, rurociąg, farma wiatrowa – sprawdź na mapie.', 'Special area: bathing zone, exercise area, cable, pipeline, wind farm – check the chart.')]], 'Fl Y 5s'),
      e(L('Nowe niebezpieczeństwo (wrak)', 'New danger (wreck)'), buoy(['#1f5fd1', Y, '#1f5fd1', Y], tm.cross, { char: 'Al.Bu.Y 3s', vertical: true }), [[L('Wygląd', 'Look'), L('Niebiesko-żółte pionowe pasy, żółty krzyż prosty.', 'Blue and yellow vertical stripes, a yellow upright cross.')], [L('Światło', 'Light'), L('Naprzemiennie niebieskie i żółte (Bu/Y), po 1 s.', 'Alternating blue and yellow (Bu/Y), 1 s each.')], [L('Znaczenie', 'Meaning'), L('Świeży wrak lub przeszkoda jeszcze nie na mapach – omijaj szeroko.', 'A new wreck or obstruction not yet charted – keep well clear.')]], 'Al.Bu.Y 3s')
    ] }
  ];
}

// ---------- ekran podręcznika ----------
export function showHandbook(app, { title, sections, onExit, onTrain, sceneryEl }) {
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
    h('div.screen-footer', {}, h('button.btn', { onclick: () => onExit() }, '← Wstecz'), onTrain ? h('button.btn.primary', { onclick: () => onTrain() }, '🎯 Przejdź do treningu') : h('span')));
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
