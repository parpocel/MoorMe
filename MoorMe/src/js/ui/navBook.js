// Podręcznik działu „Zadania nawigacyjne”: oznaczenia kursów, przeliczanie KK ↔ KDd (dewiacja, deklinacja, dryf, prąd),
// namiary i ich nanoszenie, linie pozycyjne i pozycja z namiarów, zliczenie drogi, czas–prędkość–droga, zasięg świateł.
import { h } from './dom.js';
import { getLang } from '../i18n.js';
import { CHART_SYMBOLS, symbolSVG } from '../data/chartSymbols.js';

const L = (pl, en) => (getLang() === 'en' ? en : pl);
const svgBox = (w, hh, inner, wide = false) => { const d = document.createElement('div'); d.className = 'hb-svg nb-fig' + (wide ? ' nb-wide' : ''); d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hh}" width="${w}" height="${hh}" font-family="Nunito, sans-serif">${inner}</svg>`; return d; };
const P = (...t) => h('p', {}, ...t);
const B = (t) => h('b', {}, t);
// lekcja na pełną szerokość: tekst po lewej, rysunek po prawej (rysunek „szeroki” – nad tekstem)
const isFig = (k) => k && k.classList && k.classList.contains('nb-fig');
const entry = (title, ...kids) => {
  kids = kids.filter(Boolean);
  const wide = kids.filter((k) => isFig(k) && k.classList.contains('nb-wide')), figs = kids.filter((k) => isFig(k) && !wide.includes(k)), text = kids.filter((k) => !isFig(k));
  return h('section.nb-lesson', {}, title ? h('h3', {}, title) : null, ...wide,
    h('div.nb-cols', { class: figs.length ? 'has-fig' : '' }, h('div.nb-text', {}, ...text), figs.length ? h('div.nb-figcol', {}, ...figs) : null));
};
// ramka z przykładem i z uwagą
const ex = (...t) => h('div.nb-example', {}, h('div.nb-tag', {}, L('Przykład', 'Example')), h('p', {}, ...t));
const note = (...t) => h('div.nb-note', {}, h('div.nb-tag', {}, L('Uwaga', 'Note')), h('p', {}, ...t));
const steps = (...li) => h('ol.nb-steps', {}, ...li.map((x) => h('li', {}, ...(Array.isArray(x) ? x : [x]))));
const table = (head, rows) => h('div.hb-ct-wrap', {}, h('table.hb-ctable', {}, h('tr', {}, ...head.map((x) => h('th', {}, x))), ...rows.map((r) => h('tr', {}, ...r.map((c) => h('td', {}, c))))));
const formula = (...lines) => h('div.nb-formula', {}, ...lines.map((l) => h('div', {}, l)));

// łańcuch kursów KK → KM → KR → KDw → KDd
function chainSVG() {
  const items = [['KK', L('kompasowy', 'compass')], ['KM', L('magnetyczny', 'magnetic')], ['KR', L('rzeczywisty', 'true')], ['KDw', L('drogi nad wodą', 'over water')], ['KDd', L('drogi nad dnem', 'over ground')]];
  const corr = ['+ δ', '+ d', '+ β', L('+ prąd', '+ current')];
  const W = 740, x0 = 20, step = 150;
  let g = `<rect width="${W}" height="150" rx="12" fill="#f6f1e1"/>`;
  items.forEach(([k, n], i) => {
    const x = x0 + i * step;
    g += `<rect x="${x}" y="40" width="${i === 4 ? 100 : 90}" height="48" rx="10" fill="#2f4468"/><text x="${x + (i === 4 ? 50 : 45)}" y="70" fill="#fff" font-size="20" font-weight="800" text-anchor="middle">${k}</text>`;
    g += `<text x="${x + (i === 4 ? 50 : 45)}" y="106" fill="#2f4468" font-size="12" text-anchor="middle">${n}</text>`;
    if (i < 4) {
      g += `<path d="M${x + 94} 56 H${x + step - 6}" stroke="#c2410c" stroke-width="2.5" marker-end="url(#nbA)"/><text x="${x + 92 + (step - 96) / 2}" y="48" fill="#c2410c" font-size="14" font-weight="800" text-anchor="middle">${corr[i]}</text>`;
      g += `<path d="M${x + step - 6} 74 H${x + 94}" stroke="#4a7c59" stroke-width="2.5" marker-end="url(#nbB)"/><text x="${x + 92 + (step - 96) / 2}" y="90" fill="#4a7c59" font-size="13" font-weight="800" text-anchor="middle">${corr[i].replace('+', '−')}</text>`;
    }
  });
  g += `<text x="20" y="24" fill="#c2410c" font-size="13" font-weight="700">${L('w prawo: dodajemy poprawki', 'to the right: add the corrections')}</text><text x="20" y="136" fill="#4a7c59" font-size="13" font-weight="700">${L('w lewo: odejmujemy poprawki', 'to the left: subtract the corrections')}</text>`;
  return svgBox(W, 150, `<defs><marker id="nbA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#c2410c"/></marker><marker id="nbB" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#4a7c59"/></marker></defs>${g}`, true);
}

// kierunki północy: rzeczywista, magnetyczna, kompasowa i poprawki między nimi
function northsSVG() {
  // kursy od trzech północy: KK od Nk, KM od Nm, KR od Nr; dalej dryf β (KDw) i prąd (KDd)
  const W = 760, H = 360, cx = 150, cy = 330, R = 285;
  const pt = (deg, r) => [cx + Math.sin((deg * Math.PI) / 180) * r, cy - Math.cos((deg * Math.PI) / 180) * r];
  const f = (v) => v.toFixed(1);
  const NR = 0, NM = 10, NK = 20, HD = 40, KDW = 55, KDD = 70;
  const ray = (deg, col, lbl, o = {}) => { const [x, y] = pt(deg, o.r || R); return `<line x1="${cx}" y1="${cy}" x2="${f(x)}" y2="${f(y)}" stroke="${col}" stroke-width="${o.w || 2.5}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} stroke-linecap="round" marker-end="url(#nbA${o.m || 'k'})"/><text x="${f(x + (o.dx || 0))}" y="${f(y - 9)}" fill="${col}" font-size="15" font-weight="800" text-anchor="middle">${lbl}</text>`; };
  const arc = (a0, a1, r, col, lbl, dy = 0) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r), [lx, ly] = pt((a0 + a1) / 2, r + 13); return `<path d="M${f(x0)} ${f(y0)} A${r} ${r} 0 0 1 ${f(x1)} ${f(y1)}" fill="none" stroke="${col}" stroke-width="2.2"/><text x="${f(lx)}" y="${f(ly + 5 + dy)}" fill="${col}" font-size="13" font-weight="800" text-anchor="middle">${lbl}</text>`; };
  const mk = (id, c) => `<marker id="nbA${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${c}"/></marker>`;
  let g = `<defs>${mk('k', '#1b1f24')}${mk('b', '#2563eb')}${mk('o', '#c2410c')}${mk('n', '#2f4468')}${mk('g', '#0f8a5f')}${mk('p', '#9333ea')}<linearGradient id="nbSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef6fb"/><stop offset="1" stop-color="#d7eaf5"/></linearGradient></defs>`;
  g += `<rect width="${W}" height="${H}" rx="14" fill="url(#nbSea)"/>`;
  // północe
  g += ray(NR, '#1b1f24', 'Nr', { w: 2.2, dx: -8 }) + ray(NM, '#2563eb', 'Nm', { w: 2.2, m: 'b' }) + ray(NK, '#c2410c', 'Nk', { w: 2.2, m: 'o', dx: 6 });
  // oś jachtu (KK/KM/KR), droga po wodzie (KDw) i nad dnem (KDd)
  g += ray(HD, '#2f4468', L('dziób', 'bow'), { r: 250, w: 3, m: 'n' }) + ray(KDW, '#0f8a5f', 'KDw', { r: 255, dash: '9 5', m: 'g' }) + ray(KDD, '#9333ea', 'KDd', { r: 262, dash: '3 5', w: 3, m: 'p', dx: 22 });
  // jacht na osi
  { const [x, y] = pt(HD, 120); g += `<g transform="translate(${f(x)} ${f(y)}) rotate(${HD})"><path d="M0 -22 C8 -10 8 8 6 18 L-6 18 C-8 8 -8 -10 0 -22 Z" fill="#fff" stroke="#2f4468" stroke-width="2"/><line x1="0" y1="-8" x2="0" y2="10" stroke="#2f4468" stroke-width="1.5"/></g>`; }
  // łuki kursów i poprawek
  g += arc(NK, HD, 205, '#c2410c', 'KK') + arc(NM, HD, 170, '#2563eb', 'KM') + arc(NR, HD, 135, '#1b1f24', 'KR');
  g += arc(HD, KDW, 228, '#0f8a5f', 'β', -2) + arc(KDW, KDD, 236, '#9333ea', L('prąd', 'current'), -14);
  g += arc(NR, NM, 70, '#2563eb', 'd') + arc(NM, NK, 92, '#c2410c', 'δ');
  // legenda
  const leg = [['#c2410c', 'KK', L('kurs kompasowy – od Nk', 'compass course – from Nc')], ['#2563eb', 'KM', L('kurs magnetyczny – od Nm', 'magnetic course – from Nm')], ['#1b1f24', 'KR', L('kurs rzeczywisty – od Nr', 'true course – from Nt')],
    ['#0f8a5f', 'KDw', L('kurs drogi nad wodą (KR + β)', 'course through water (TC + β)')], ['#9333ea', 'KDd', L('kurs drogi nad dnem (z prądem)', 'course over ground (with current)')], ['#2563eb', 'd', L('deklinacja Nr→Nm', 'variation Nt→Nm')], ['#c2410c', 'δ', L('dewiacja Nm→Nk', 'deviation Nm→Nc')]];
  let y = 40;
  g += `<rect x="500" y="18" width="244" height="${leg.length * 30 + 14}" rx="10" fill="#ffffff" fill-opacity="0.82" stroke="#cfdbe6"/>`;
  for (const [c, k, txt] of leg) { g += `<text x="514" y="${y + 6}" fill="${c}" font-size="15" font-weight="800">${k}</text><text x="560" y="${y + 6}" fill="#2f4468" font-size="13">${txt}</text>`; y += 30; }
  return svgBox(W, H, g, true);
}


// wspólne elementy rysunków: morze, strzałka północy, etykieta w „pigułce”, groty strzałek
const SEA = (W, H) => `<defs><linearGradient id="nbSea2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef6fb"/><stop offset="1" stop-color="#d4e8f4"/></linearGradient><pattern id="nbGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0 H0 V40" fill="none" stroke="#b9d3e4" stroke-width="0.6"/></pattern></defs><rect width="${W}" height="${H}" rx="14" fill="url(#nbSea2)"/><rect width="${W}" height="${H}" rx="14" fill="url(#nbGrid)" opacity="0.6"/>`;
const NORTH = (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 -18 L7 6 L0 1 L-7 6 Z" fill="#2f4468"/><text x="0" y="22" font-size="12" font-weight="800" fill="#2f4468" text-anchor="middle">N</text></g>`;
const PILL = (x, y, txt, col, fs = 13) => { const w = txt.length * fs * 0.56 + 14; return `<g><rect x="${(x - w / 2).toFixed(1)}" y="${(y - fs * 0.85).toFixed(1)}" width="${w.toFixed(1)}" height="${(fs * 1.5).toFixed(1)}" rx="${(fs * 0.75).toFixed(1)}" fill="#fff" fill-opacity="0.92" stroke="${col}" stroke-width="1.2"/><text x="${x}" y="${(y + fs * 0.32).toFixed(1)}" font-size="${fs}" font-weight="800" fill="${col}" text-anchor="middle">${txt}</text></g>`; };
const HEADS = (cols) => `<defs>${cols.map((c) => `<marker id="nbH${c.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${c}"/></marker>`).join('')}</defs>`;
const VEC = (p, q, c, w = 3, dash = '') => `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ''} marker-end="url(#nbH${c.slice(1)})"/>`;
const LIGHTHOUSE = (x, y, lbl) => `<g transform="translate(${x} ${y})"><path d="M-5 0 L-3 -16 L3 -16 L5 0 Z" fill="#2f4468"/><rect x="-4" y="-20" width="8" height="4" fill="#d2695f"/><path d="M4 -18 L22 -24 L22 -12 Z" fill="#b0288c" opacity="0.55"/><circle cx="0" cy="0" r="2.5" fill="#1b1f24"/>${lbl ? `<text x="0" y="16" font-size="13" font-weight="800" fill="#2f4468" text-anchor="middle">${lbl}</text>` : ''}</g>`;
const YACHT = (x, y, rot, s = 1) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 -14 C6 -6 6 6 4 12 L-4 12 C-6 6 -6 -6 0 -14 Z" fill="#fff" stroke="#2f4468" stroke-width="1.8"/><line x1="0" y1="-4" x2="0" y2="7" stroke="#2f4468" stroke-width="1.3"/></g>`;
const LAND = (d) => `<path d="${d}" fill="#f2e2b0" stroke="#8a7346" stroke-width="1.6"/><path d="${d}" fill="none" stroke="#bcd8c0" stroke-width="7" opacity="0.35"/>`;

// namiary: NK od Nk, NM od Nm, NR od Nr – kierunek z jachtu na latarnię; kąt kursowy KĄT od dziobu
function bearingsSVG() {
  const W = 760, H = 340, cx = 170, cy = 300, R = 255;
  const pt = (deg, r) => [cx + Math.sin((deg * Math.PI) / 180) * r, cy - Math.cos((deg * Math.PI) / 180) * r];
  const f = (v) => v.toFixed(1);
  const NR = 0, NM = 10, NK = 20, HD = -25, OBJ = 58;
  const mk = (id, c) => `<marker id="nbB${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${c}"/></marker>`;
  const ray = (deg, col, lbl, o = {}) => { const [x, y] = pt(deg, o.r || R); return `<line x1="${cx}" y1="${cy}" x2="${f(x)}" y2="${f(y)}" stroke="${col}" stroke-width="${o.w || 2.2}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} stroke-linecap="round" ${o.m ? `marker-end="url(#nbB${o.m})"` : ''}/>${lbl ? `<text x="${f(x + (o.dx || 0))}" y="${f(y - 9)}" fill="${col}" font-size="15" font-weight="800" text-anchor="middle">${lbl}</text>` : ''}`; };
  const arc = (a0, a1, r, col, lbl) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r), [lx, ly] = pt((a0 + a1) / 2, r + 14); return `<path d="M${f(x0)} ${f(y0)} A${r} ${r} 0 0 1 ${f(x1)} ${f(y1)}" fill="none" stroke="${col}" stroke-width="2.2"/><text x="${f(lx)}" y="${f(ly + 5)}" fill="${col}" font-size="13" font-weight="800" text-anchor="middle">${lbl}</text>`; };
  let g = `<defs>${mk('k', '#1b1f24')}${mk('b', '#2563eb')}${mk('o', '#c2410c')}${mk('g', '#0f8a5f')}</defs>` + SEA(W, H);
  g += ray(NR, '#1b1f24', 'Nr', { m: 'k', dx: -8 }) + ray(NM, '#2563eb', 'Nm', { m: 'b' }) + ray(NK, '#c2410c', 'Nk', { m: 'o', dx: 6 });
  g += ray(HD, '#2f4468', L('dziób', 'bow'), { r: 150, dash: '7 5', w: 2 });
  // linia namiaru do latarni
  const [lx, ly] = pt(OBJ, R - 20);
  g += ray(OBJ, '#0f8a5f', '', { r: R - 34, w: 3, m: 'g' }) + LIGHTHOUSE(lx + 14, ly - 4, '') + PILL(lx + 22, ly + 22, L('latarnia', 'light'), '#2f4468', 12);
  g += arc(NK, OBJ, 200, '#c2410c', 'NK') + arc(NM, OBJ, 168, '#2563eb', 'NM') + arc(NR, OBJ, 136, '#1b1f24', 'NR');
  g += arc(HD, OBJ, 100, '#0f8a5f', L('KĄT', 'RB'));
  g += arc(NR, NM, 228, '#2563eb', 'd') + arc(NM, NK, 228, '#c2410c', 'δ');
  g += YACHT(cx, cy, HD, 1.15);
  const leg = [['#c2410c', 'NK', L('namiar kompasowy – od Nk', 'compass bearing – from Nc')], ['#2563eb', 'NM', L('namiar magnetyczny – od Nm', 'magnetic bearing – from Nm')], ['#1b1f24', 'NR', L('namiar rzeczywisty – od Nr', 'true bearing – from Nt')], ['#0f8a5f', L('KĄT', 'RB'), L('kąt kursowy – od dziobu', 'relative bearing – from the bow')], ['#2563eb', 'd', L('deklinacja Nr→Nm', 'variation Nt→Nm')], ['#c2410c', 'δ', L('dewiacja dla kursu jachtu', 'deviation for the heading')]];
  let y = 40;
  g += `<rect x="470" y="18" width="274" height="${leg.length * 30 + 14}" rx="10" fill="#ffffff" fill-opacity="0.85" stroke="#cfdbe6"/>`;
  for (const [c, k2, txt] of leg) { g += `<text x="484" y="${y + 6}" fill="${c}" font-size="15" font-weight="800">${k2}</text><text x="534" y="${y + 6}" fill="#2f4468" font-size="13">${txt}</text>`; y += 30; }
  return svgBox(W, H, g, true);
}

// trójkąt prędkości: KR/V po wodzie + prąd = KDd/SOG nad dnem
function currentSVG() {
  // trójkąt prędkości: KDw/V (po wodzie, 1 h) + prąd = KDd/SOG (nad dnem)
  const W = 520, H = 300, A = [70, 250], Bp = [300, 70], C = [410, 150];
  let g = SEA(W, H) + HEADS(['#2f4468', '#2563eb', '#9333ea']) + NORTH(W - 30, 40);
  g += `<path d="M${A[0]} ${A[1]} L${Bp[0]} ${Bp[1]} L${C[0]} ${C[1]} Z" fill="#9333ea" fill-opacity="0.06"/>`;
  g += VEC(A, Bp, '#2f4468', 3.5) + VEC(Bp, C, '#2563eb', 3.5, '8 5') + VEC(A, C, '#9333ea', 4);
  // kąt poprawki na prąd między KDw a KDd
  const ang = (p) => Math.atan2(p[1] - A[1], p[0] - A[0]), a1 = ang(Bp), a2 = ang(C), r = 70;
  g += `<path d="M${A[0] + Math.cos(a1) * r} ${A[1] + Math.sin(a1) * r} A${r} ${r} 0 0 1 ${A[0] + Math.cos(a2) * r} ${A[1] + Math.sin(a2) * r}" fill="none" stroke="#c2410c" stroke-width="2"/>`;
  g += PILL(A[0] + Math.cos((a1 + a2) / 2) * (r + 26), A[1] + Math.sin((a1 + a2) / 2) * (r + 26), L('poprawka', 'correction'), '#c2410c', 12);
  g += YACHT(A[0], A[1], 52, 1.1) + `<circle cx="${A[0]}" cy="${A[1]}" r="4" fill="#1b1f24"/>`;
  g += PILL((A[0] + Bp[0]) / 2 - 62, (A[1] + Bp[1]) / 2 - 6, L('KDw, V – po wodzie', 'CTW, STW – through water'), '#2f4468');
  g += PILL((Bp[0] + C[0]) / 2 + 66, (Bp[1] + C[1]) / 2 - 12, L('prąd: kierunek, prędkość', 'current: set, rate'), '#2563eb');
  g += PILL((A[0] + C[0]) / 2 + 40, (A[1] + C[1]) / 2 + 30, L('KDd, SOG – nad dnem', 'COG, SOG – over ground'), '#9333ea');
  g += `<text x="${A[0] - 4}" y="${A[1] + 30}" font-size="12" fill="#2f4468" text-anchor="middle">${L('pozycja wyjściowa', 'start')}</text>`;
  return svgBox(W, H, g);
}

// pozycja z dwóch namiarów
function fixSVG() {
  // pozycja z dwóch namiarów: linie pozycyjne z latarni A i cypla B przecinają się w pozycji obserwowanej
  const W = 520, H = 300, A = [110, 60], B = [430, 92], P = [262, 222];
  let g = SEA(W, H) + NORTH(W - 28, H - 40);
  g += LAND('M0 0 H190 Q170 40 128 52 Q96 60 84 40 Q70 22 40 34 Q18 44 0 40 Z') + LAND('M330 0 H520 V150 Q486 126 458 118 Q432 108 418 84 Q404 54 372 46 Q344 38 330 0 Z');
  const ext = (S, k) => [S[0] + (P[0] - S[0]) * k, S[1] + (P[1] - S[1]) * k];
  for (const S of [A, B]) { const e = ext(S, 1.32); g += `<line x1="${S[0]}" y1="${S[1]}" x2="${e[0].toFixed(1)}" y2="${e[1].toFixed(1)}" stroke="#2f4468" stroke-width="2.4" stroke-linecap="round"/>`; }
  // kąt przecięcia
  const an = (S) => Math.atan2(S[1] - P[1], S[0] - P[0]), a1 = an(A), a2 = an(B), r = 30;
  g += `<path d="M${P[0] + Math.cos(a1) * r} ${P[1] + Math.sin(a1) * r} A${r} ${r} 0 0 1 ${P[0] + Math.cos(a2) * r} ${P[1] + Math.sin(a2) * r}" fill="none" stroke="#0f8a5f" stroke-width="2"/>`;
  g += PILL(P[0] - 120, P[1] + 2, L('kąt przecięcia 30°–150°', 'angle of cut 30°–150°'), '#0f8a5f', 11);
  g += LIGHTHOUSE(A[0], A[1], L('latarnia A', 'light A')) + `<g transform="translate(${B[0]} ${B[1]})"><circle r="6" fill="none" stroke="#2f4468" stroke-width="2"/><circle r="1.8" fill="#2f4468"/><text x="0" y="20" font-size="13" font-weight="800" fill="#2f4468" text-anchor="middle">${L('cypel B', 'point B')}</text></g>`;
  g += PILL(150, 150, L('NR na A = 145°', 'TB of A = 145°'), '#2f4468', 12) + PILL(380, 172, L('NR na B = 222°', 'TB of B = 222°'), '#2f4468', 12);
  g += `<circle cx="${P[0]}" cy="${P[1]}" r="9" fill="none" stroke="#c2410c" stroke-width="2.5"/><circle cx="${P[0]}" cy="${P[1]}" r="2.4" fill="#c2410c"/>`;
  g += PILL(P[0] + 4, P[1] + 34, L('pozycja obserwowana 10:42', 'observed fix 10:42'), '#c2410c', 13);
  return svgBox(W, H, g);
}

// izobata jako linia pozycyjna: izobaty 5/10/20 m, linia namiaru, pozycja na przecięciu
function contourSVG() {
  const W = 520, H = 300;
  let g = SEA(W, H) + NORTH(W - 28, H - 40);
  g += LAND('M0 0 H520 V40 Q440 70 360 52 Q280 34 200 60 Q120 86 0 64 Z');
  g += `<path d="M0 96 Q120 118 200 92 Q280 66 360 84 Q440 102 520 74" fill="none" stroke="#5f8fb8" stroke-width="1.6" stroke-dasharray="2 4"/>`;
  g += `<path d="M0 150 Q130 172 210 146 Q290 120 370 140 Q450 160 520 130" fill="none" stroke="#2563eb" stroke-width="3"/>`;
  g += `<path d="M0 220 Q140 242 220 214 Q300 186 380 206 Q460 226 520 196" fill="none" stroke="#5f8fb8" stroke-width="1.6" stroke-dasharray="8 4 2 4"/>`;
  g += PILL(40, 88, '5 m', '#5f8fb8', 12) + PILL(60, 168, L('10 m – z echosondy', '10 m – echo sounder'), '#2563eb', 12) + PILL(40, 236, '20 m', '#5f8fb8', 12);
  const Lh = [430, 40], P = [300, 128];
  g += `<line x1="${Lh[0]}" y1="${Lh[1]}" x2="${P[0] - (Lh[0] - P[0]) * 0.9}" y2="${P[1] - (Lh[1] - P[1]) * 0.9}" stroke="#2f4468" stroke-width="2.4"/>`;
  g += LIGHTHOUSE(Lh[0], Lh[1] + 8, '') + PILL(392, 92, L('NR = 060°', 'TB = 060°'), '#2f4468', 12);
  g += `<circle cx="${P[0]}" cy="${P[1]}" r="9" fill="none" stroke="#c2410c" stroke-width="2.5"/><circle cx="${P[0]}" cy="${P[1]}" r="2.4" fill="#c2410c"/>` + PILL(P[0] - 40, P[1] + 40, L('pozycja', 'fix'), '#c2410c', 13);
  return svgBox(W, H, g);
}

// namiar podwójny: kąt kursowy 45° i 90° (namiar czteropunktowy)
function doubleSVG() {
  // namiar podwójny (czteropunktowy): kąt kursowy 45° w punkcie 1 i 90° w punkcie 2 – droga s = odległość od obiektu
  const W = 520, H = 300, y = 216, x1 = 140, x2 = 330, O = [330, 30];
  let g = SEA(W, H) + HEADS(['#2f4468', '#c2410c']) + NORTH(W - 28, 40);
  g += LAND('M250 0 H420 Q410 26 380 30 Q352 34 340 14 Q322 -2 290 12 Q266 20 250 0 Z');
  g += `<line x1="30" y1="${y}" x2="${W - 40}" y2="${y}" stroke="#2f4468" stroke-width="2.5" stroke-dasharray="10 6" marker-end="url(#nbH2f4468)"/>`;
  g += PILL(W - 70, y + 26, L('kurs', 'course'), '#2f4468', 12);
  g += `<line x1="${x1}" y1="${y}" x2="${O[0]}" y2="${O[1] + 14}" stroke="#c2410c" stroke-width="2.2"/><line x1="${x2}" y1="${y}" x2="${O[0]}" y2="${O[1] + 14}" stroke="#c2410c" stroke-width="2.2"/>`;
  // kąty kursowe
  const a45 = Math.atan2(O[1] + 14 - y, O[0] - x1);
  g += `<path d="M${x1 + 42} ${y} A42 42 0 0 0 ${x1 + Math.cos(a45) * 42} ${y + Math.sin(a45) * 42}" fill="none" stroke="#c2410c" stroke-width="2"/>` + PILL(x1 + 68, y - 22, '45°', '#c2410c', 12);
  g += `<path d="M${x2} ${y - 22} h22 v22" fill="none" stroke="#c2410c" stroke-width="2"/>` + PILL(x2 + 40, y - 34, '90°', '#c2410c', 12);
  // równe odcinki s
  g += `<line x1="${x1}" y1="${y + 18}" x2="${x2}" y2="${y + 18}" stroke="#2563eb" stroke-width="2"/><line x1="${x1}" y1="${y + 12}" x2="${x1}" y2="${y + 24}" stroke="#2563eb" stroke-width="2"/><line x1="${x2}" y1="${y + 12}" x2="${x2}" y2="${y + 24}" stroke="#2563eb" stroke-width="2"/>`;
  g += PILL((x1 + x2) / 2, y + 34, L('droga s', 'run s'), '#2563eb', 12) + PILL(x2 - 64, (y + O[1]) / 2 + 10, L('odległość = s', 'distance = s'), '#2563eb', 12);
  g += YACHT(x1, y, 90, 0.95) + YACHT(x2, y, 90, 0.95) + PILL(x1, y + 62, L('1: kąt 45°', '1: 45°'), '#2f4468', 11) + PILL(x2, y + 62, L('2: kąt 90° (trawers)', '2: 90° (abeam)'), '#2f4468', 11);
  g += LIGHTHOUSE(O[0], O[1] + 14, '');
  return svgBox(W, H, g);
}


// rozdział „Symbole map”: legenda symboli INT 1 pogrupowana tematycznie
const SYM_GROUPS = [['danger', 'Niebezpieczeństwa', 'Dangers'], ['depth', 'Głębokości i dno', 'Depths and seabed'], ['tide', 'Pływy i prądy', 'Tides and currents'],
  ['area', 'Obszary i granice', 'Areas and limits'], ['aid', 'Światła i pomoce nawigacyjne', 'Lights and aids'], ['buoy', 'Pławy i znaki', 'Buoys and beacons'],
  ['land', 'Ląd, porty i punkty orientacyjne', 'Land, harbours and landmarks'], ['note', 'Oznaczenia i skróty', 'Notes and abbreviations']];
function symbolsChapter() {
  const grps = SYM_GROUPS.filter(([g]) => CHART_SYMBOLS.some((s) => s.grp === g));
  const other = CHART_SYMBOLS.filter((s) => !SYM_GROUPS.some(([g]) => g === s.grp));
  const card = (s) => { const pic = document.createElement('div'); pic.className = 'sym-pic'; pic.innerHTML = symbolSVG(s, 120, 82); return h('div.sym-leg', {}, pic, h('div', {}, h('b', {}, s.name()), h('p', {}, s.mean()))); };
  return [
    entry(L('Symbole map morskich', 'Chart symbols'), P(L('Mapy morskie używają wspólnego zestawu symboli i skrótów opisanego w publikacji INT 1 (IHO). Poniżej najważniejsze z nich – rysunki są uproszczone, ale układ i kolory odpowiadają mapom: magenta to światła, granice obszarów i ostrzeżenia, błękit – płytka woda, beż – ląd, zieleń – obszary osychające.', 'Nautical charts use a common set of symbols and abbreviations described in INT 1 (IHO). The most important ones are shown below – the drawings are simplified, but layout and colours follow the charts: magenta for lights, area limits and cautions, blue for shallow water, buff for land, green for drying areas.'))),
    ...grps.map(([g, pl, en]) => h('section.nb-lesson', {}, h('h3', {}, L(pl, en)), h('div.sym-legend', {}, ...CHART_SYMBOLS.filter((s) => s.grp === g).map(card)))),
    other.length ? h('section.nb-lesson', {}, h('h3', {}, L('Inne', 'Other')), h('div.sym-legend', {}, ...other.map(card))) : null
  ].filter(Boolean);
}

export function navBook() {
  return [
    { id: 'intro', name: L('Wstęp', 'Introduction'), entries: [
      entry(L('Krótka historia nawigacji', 'A short history of navigation'),
        P(L('Pierwsi żeglarze pływali wzdłuż brzegów, od przylądka do przylądka, kierując się znanymi punktami na lądzie, głębokością sondowaną ołowianką, kolorem wody i lotem ptaków. Polinezyjczycy i Wikingowie przepływali otwarte morze, czytając gwiazdy, kierunek fal i wiatru.', 'The first seafarers sailed along the coast, from headland to headland, steering by known landmarks, depths sounded with a lead line, the colour of the water and the flight of birds. Polynesians and Vikings crossed open sea by reading the stars, the swell and the wind.')),
        P(L('Około XII wieku do Europy dotarł kompas magnetyczny, a w XIII–XV wieku pojawiły się mapy portolanowe z siatką kierunków. Szerokość geograficzną mierzono astrolabium, później oktantem i sekstantem (XVIII w.). Długość geograficzną dało się wyznaczać dokładnie dopiero po zbudowaniu chronometru morskiego przez Johna Harrisona (ok. 1760 r.).', 'The magnetic compass reached Europe around the 12th century, and portolan charts with a network of rhumb lines appeared in the 13th–15th centuries. Latitude was measured with an astrolabe, later with the octant and sextant (18th century). Longitude could be found accurately only after John Harrison built the marine chronometer (around 1760).')),
        P(L('XX wiek przyniósł radionawigację (radionamierniki, Decca, Loran), radar i echosondę, a od lat 90. – nawigację satelitarną GPS, dziś także Galileo, GLONASS i BeiDou, mapy elektroniczne i AIS.', 'The 20th century brought radio navigation (direction finders, Decca, Loran), radar and the echo sounder, and from the 1990s satellite navigation – GPS, today also Galileo, GLONASS and BeiDou – together with electronic charts and AIS.'))),
      entry(L('Rodzaje nawigacji', 'Types of navigation'),
        table([L('Rodzaj', 'Type'), L('Na czym polega', 'How it works'), L('Zalety', 'Advantages'), L('Wady', 'Disadvantages')], [
          [L('Terrestryczna (pilotowa)', 'Terrestrial (pilotage)'), L('pozycja z namiarów i odległości na znane obiekty: latarnie, znaki, punkty na brzegu; nabieżniki, izobaty', 'position from bearings and distances to known objects: lighthouses, marks, landmarks; transits, depth contours'), L('prosta, dokładna blisko brzegu, wymaga tylko kompasu namiarowego i mapy', 'simple, accurate near the coast, needs only a hand-bearing compass and a chart'), L('działa tylko w zasięgu widoczności lądu; mgła i noc ją ograniczają; łatwo pomylić obiekt', 'works only in sight of land; fog and darkness limit it; objects are easy to misidentify')],
          [L('Zliczeniowa (DR)', 'Dead reckoning (DR)'), L('pozycja wyliczona z kursu, prędkości i czasu od ostatniej pewnej pozycji, z poprawką na dryf i prąd', 'position worked out from course, speed and time since the last reliable fix, corrected for leeway and current'), L('zawsze dostępna, niezależna od zewnętrznych sygnałów; pozwala przewidzieć, gdzie będziesz', 'always available, independent of outside signals; lets you predict where you will be'), L('błędy narastają z czasem (niedokładny log, dryf, prąd) – trzeba ją co jakiś czas potwierdzać', 'errors grow with time (inaccurate log, leeway, current) – it has to be checked regularly')],
          [L('Astronomiczna', 'Celestial'), L('pozycja z wysokości Słońca, Księżyca, planet i gwiazd mierzonych sekstantem i dokładnego czasu', 'position from the altitudes of the Sun, Moon, planets and stars measured with a sextant, plus accurate time'), L('działa na całym oceanie, bez prądu i elektroniki', 'works anywhere on the ocean, without power or electronics'), L('wymaga wiedzy, tablic i widocznego nieba (horyzont i ciała niebieskie); dokładność ok. 1–2 Mm', 'needs skill, tables and a clear sky (horizon and bodies visible); accuracy about 1–2 NM')],
          [L('Radionawigacja i radar', 'Radio navigation and radar'), L('namiary radiowe, odległości i namiary z radaru, echosonda', 'radio bearings, radar ranges and bearings, echo sounder'), L('działa w nocy i we mgle; radar pokazuje też inne statki', 'works at night and in fog; radar also shows other vessels'), L('potrzebny prąd i sprzęt; radar wymaga wprawy w interpretacji obrazu', 'needs power and equipment; radar images take practice to interpret')],
          [L('Satelitarna (GNSS)', 'Satellite (GNSS)'), L('odbiornik GPS/Galileo liczy pozycję z sygnałów satelitów', 'a GPS/Galileo receiver computes position from satellite signals'), L('dokładna (kilka metrów), ciągła, na całym świecie; od razu podaje prędkość i kurs nad dnem', 'accurate (a few metres), continuous, worldwide; gives speed and course over the ground at once'), L('zależy od prądu i sygnału – awaria, zakłócenia (jamming) lub błąd mapy elektronicznej mogą zaskoczyć; uczy ślepego zaufania', 'depends on power and signal – a failure, jamming or a chart error can catch you out; encourages blind trust')]
        ]),
        note(L('Dobry nawigator nie polega na jednej metodzie: pozycję z GPS regularnie nanosi na mapę papierową, prowadzi zliczenie i sprawdza je namiarami. Dlatego na egzaminie liczy się kursy i pozycję „ręcznie”.', 'A good navigator never relies on one method: plots the GPS position on the paper chart at regular intervals, keeps a DR and checks it with bearings. That is why courses and positions are worked out by hand in the exam.'))),
      entry(L('Jednostki w nawigacji', 'Units used in navigation'),
        table([L('Wielkość', 'Quantity'), L('Jednostka', 'Unit'), L('Ile to jest', 'Value')], [
          [L('odległość', 'distance'), L('mila morska (Mm, NM)', 'nautical mile (NM)'), L('1852 m = 1′ (minuta) szerokości geograficznej', '1852 m = 1′ (minute) of latitude')],
          [L('krótka odległość', 'short distance'), L('kabel (kbl)', 'cable'), L('0,1 Mm ≈ 185 m', '0.1 NM ≈ 185 m')],
          [L('prędkość', 'speed'), L('węzeł (kn, w)', 'knot (kn)'), L('1 Mm/h ≈ 1,852 km/h ≈ 0,514 m/s', '1 NM/h ≈ 1.852 km/h ≈ 0.514 m/s')],
          [L('głębokość, wysokość', 'depth, height'), L('metr (m); na starszych mapach sążeń i stopa', 'metre (m); on older charts fathoms and feet'), L('1 sążeń = 6 stóp ≈ 1,83 m; 1 stopa ≈ 0,305 m', '1 fathom = 6 feet ≈ 1.83 m; 1 foot ≈ 0.305 m')],
          [L('kierunek', 'direction'), L('stopień (°), od 000° do 359°, liczony od północy w prawo', 'degree (°), 000° to 359°, measured clockwise from north'), L('kurs i namiar zapisuje się trzema cyframi, np. 045°', 'courses and bearings are written with three digits, e.g. 045°')],
          [L('pozycja', 'position'), L('szerokość (φ) i długość (λ) geograficzna w stopniach i minutach', 'latitude (φ) and longitude (λ) in degrees and minutes'), L('np. 54°31,2′N 018°33,6′E; 1° = 60′', 'e.g. 54°31.2′N 018°33.6′E; 1° = 60′')],
          [L('czas', 'time'), L('godziny i minuty (UTC lub czas strefowy)', 'hours and minutes (UTC or zone time)'), L('6 minut = 0,1 h – przy 6 kn to 0,6 Mm', '6 minutes = 0.1 h – at 6 kn that is 0.6 NM')]
        ]))
    ] },
    { id: 'courses', name: L('Przeliczanie kursów', 'Converting courses'), entries: [
      entry(L('Po co przeliczać kursy', 'Why courses are converted'),
        P(L('Kompas na jachcie nie wskazuje północy rzeczywistej: igłę odchyla pole magnetyczne Ziemi (deklinacja) i żelazo oraz elektryka na jachcie (dewiacja). Wiatr spycha jacht z kursu (dryf), a prąd niesie całą wodę razem z jachtem. Mapa jest wykreślona względem północy rzeczywistej, a nad dnem liczy się droga, którą jacht naprawdę przebywa – dlatego kurs odczytany z kompasu trzeba przeliczyć na kurs na mapie i odwrotnie.', 'The ship’s compass does not point to true north: the needle is deflected by the Earth’s magnetic field (variation) and by iron and electrics on board (deviation). The wind pushes the yacht off its heading (leeway) and the current carries the whole body of water with it. The chart is drawn relative to true north and what counts over the ground is the track the yacht really makes – so a compass course has to be converted into a chart course and back.'))),
      entry(L('Oznaczenia', 'Notation'),
        table([L('Skrót', 'Abbr.'), L('Nazwa', 'Name'), L('Co oznacza', 'Meaning')], [
          ['KK', L('kurs kompasowy', 'compass course'), L('kąt między północą kompasową a dziobem – to, co pokazuje kompas sterowy', 'angle from compass north to the bow – what the steering compass shows')],
          ['KM', L('kurs magnetyczny', 'magnetic course'), L('kąt między północą magnetyczną a dziobem', 'angle from magnetic north to the bow')],
          ['KR', L('kurs rzeczywisty', 'true course'), L('kąt między północą rzeczywistą a dziobem', 'angle from true north to the bow')],
          ['KDw', L('kurs drogi nad wodą', 'course through the water'), L('kierunek, w którym jacht naprawdę przesuwa się po wodzie (z dryfem)', 'direction the yacht actually moves through the water (with leeway)')],
          ['KDd', L('kurs drogi nad dnem', 'course over the ground'), L('kierunek ruchu nad dnem – z dryfem i prądem; to linia na mapie', 'direction of motion over the ground – with leeway and current; the line on the chart')],
          ['δ', L('dewiacja', 'deviation'), L('odchylenie kompasu od północy magnetycznej; zależy od kursu jachtu', 'compass error from magnetic north; depends on the heading')],
          ['d', L('deklinacja', 'variation'), L('kąt między północą magnetyczną a rzeczywistą; z mapy, zmienia się z rokiem i miejscem', 'angle between magnetic and true north; from the chart, changes with year and place')],
          ['p', L('poprawka całkowita', 'total correction'), 'p = δ + d'],
          ['β', L('dryf', 'leeway'), L('kąt, o który wiatr znosi jacht z kursu', 'angle the wind pushes the yacht off its heading')],
          ['NK, NM, NR', L('namiar kompasowy, magnetyczny, rzeczywisty', 'compass, magnetic, true bearing'), L('kierunek na obiekt mierzony od odpowiedniej północy', 'direction to an object measured from the matching north')]
        ]),
        P(B(L('Zasada znaków: ', 'Sign rule: ')), L('poprawki na wschód (E) i w prawo są dodatnie (+), na zachód (W) i w lewo są ujemne (−).', 'corrections to the east (E) and to the right are positive (+), to the west (W) and to the left negative (−).')),
        northsSVG()),
      entry(L('Od kompasu do mapy: KK → KDd', 'From the compass to the chart: CC → COG'),
        chainSVG(),
        formula('KM = KK + δ', 'KR = KM + d = KK + p', 'KDw = KR + β', L('KDd = KDw „+” prąd (dodawanie wektorów – trójkąt prędkości)', 'COG = CTW “+” current (vector addition – the velocity triangle)')),
        P(L('Idąc w prawo dodajemy poprawki z ich znakami. Wynik zawsze sprowadzamy do zakresu 000°–359° (np. 365° → 005°, −4° → 356°).', 'Going to the right, add the corrections with their signs. Always bring the result into 000°–359° (e.g. 365° → 005°, −4° → 356°).')),
        ex(L('KK = 090°, δ = +2°, d = 4°E (+4°), wiatr z lewej burty znosi o 5° w prawo (β = +5°) → KM = 092°, KR = 096°, KDw = 101°.', 'CC = 090°, δ = +2°, d = 4°E (+4°), wind from port pushes 5° to starboard (β = +5°) → MC = 092°, TC = 096°, CTW = 101°.'))),
      entry(L('Od mapy do kompasu: KDd → KK', 'From the chart to the compass: COG → CC'),
        P(L('Gdy chcesz popłynąć wyznaczoną na mapie linią, idziesz łańcuchem w lewo i ', 'To follow a track drawn on the chart, go along the chain to the left and '), B(L('odejmujesz', 'subtract')), L(' poprawki:', ' the corrections:')),
        formula(L('KDw – z trójkąta prądu (kurs z poprawką na prąd)', 'CTW – from the current triangle (course to steer)'), 'KR = KDw − β', 'KM = KR − d', 'KK = KM − δ'),
        ex(L('Na mapie KDw = 220°, wiatr z prawej burty znosi o 4° w lewo (β = −4°), d = 3°W (−3°), δ dla tego kursu = −1° → KR = 220° − (−4°) = 224°, KM = 224° − (−3°) = 227°, KK = 227° − (−1°) = 228°. Sterujesz 228° według kompasu.', 'On the chart CTW = 220°, wind from starboard pushes 4° to port (β = −4°), d = 3°W (−3°), δ for this heading = −1° → TC = 220° − (−4°) = 224°, MC = 224° − (−3°) = 227°, CC = 227° − (−1°) = 228°. You steer 228° by the compass.')),
        note(L('Dewiację odczytuje się z tabeli dla kursu, którym jacht płynie. Przy przeliczaniu od mapy znasz najpierw KM, więc wejdź do tabeli z kursem magnetycznym (jeśli tabela jest dla KK – sprawdź wynik jeszcze raz dla otrzymanego KK).', 'Deviation is read from the table for the heading the yacht is on. Working from the chart you know MC first, so enter the table with the magnetic course (if the table is for CC, check again with the CC you got).'))),
      entry(L('Deklinacja z mapy', 'Variation from the chart'),
        P(L('Na róży kompasowej mapy podana jest deklinacja z rokiem odniesienia i roczną zmianą, np. „3°40′E 2015 (8′E)”. Deklinację na bieżący rok liczysz tak:', 'The chart’s compass rose gives the variation with a reference year and an annual change, e.g. “3°40′E 2015 (8′E)”. For the current year:')),
        formula(L('d = d(rok mapy) + zmiana roczna × liczba lat', 'd = d(chart year) + annual change × years')),
        ex(L('Dla roku 2025: 3°40′E + 10 × 8′E = 3°40′ + 1°20′ = 5°00′E, czyli d = +5°. Zmiana roczna W jest ujemna – wtedy deklinacja maleje.', 'For 2025: 3°40′E + 10 × 8′E = 3°40′ + 1°20′ = 5°00′E, i.e. d = +5°. An annual change W is negative – the variation then decreases.'))),
      entry(L('Dewiacja i tabela dewiacji', 'Deviation and the deviation table'),
        P(L('Dewiacja zależy od kursu, bo żelazo na jachcie obraca się razem z nim względem pola Ziemi. Tabela dewiacji podaje δ co 15°–45° kursu; dla kursów pośrednich interpolujesz liniowo.', 'Deviation depends on the heading, because the iron on board turns with the yacht relative to the Earth’s field. The deviation table gives δ every 15°–45°; interpolate linearly in between.')),
        ex(L('δ(090°) = +2°, δ(135°) = −1°. Dla KK = 120° (2/3 drogi od 090° do 135°): δ = +2° + (−3°) · 2/3 = 0°.', 'δ(090°) = +2°, δ(135°) = −1°. For CC = 120° (2/3 of the way from 090° to 135°): δ = +2° + (−3°) · 2/3 = 0°.')),
        P(L('Dewiację na danym kursie sprawdzisz też na nabieżniku: KR nabieżnika z mapy, NK z kompasu → p = NR − NK, δ = p − d.', 'You can also check deviation on a transit: TB of the transit from the chart, CB from the compass → p = TB − CB, δ = p − d.'))),
      entry(L('Dryf', 'Leeway'),
        P(L('Wiatr spycha jacht na zawietrzną: kurs drogi nad wodą (kilwater) odchyla się od osi jachtu w stronę, w którą wieje wiatr.', 'The wind pushes the yacht to leeward: the course through the water (the wake) diverges from the yacht’s heading towards where the wind blows.')),
        table([L('Wiatr z', 'Wind from'), L('Jacht znoszony', 'Yacht pushed'), 'β'], [[L('lewej burty', 'port'), L('w prawo', 'to starboard'), '+'], [L('prawej burty', 'starboard'), L('w lewo', 'to port'), '−']]),
        P(L('Typowo 2°–10°; więcej przy ostrym kursie, silnym wietrze, małej prędkości i dużym przechyle. Na kursie z wiatrem β ≈ 0.', 'Typically 2°–10°; more when close-hauled, in strong wind, at low speed and heeled hard. Running before the wind β ≈ 0.')))
    ] },
    { id: 'current', name: L('Prąd', 'Current'), entries: [
      entry(L('Trójkąt prędkości', 'The velocity triangle'),
        currentSVG(),
        P(L('Prąd przesuwa całą wodę – a z nią jacht – w swoim kierunku. Kierunek prądu podaje się „dokąd płynie” (odwrotnie niż wiatr, który podaje się „skąd wieje”). Ruch nad dnem to suma wektorów: prędkości jachtu po wodzie (KDw, V) i prędkości prądu.', 'A current moves the whole body of water – and the yacht with it – in its direction. Its set is given as “where it flows to” (unlike the wind, given as “where it blows from”). Motion over the ground is the vector sum of the yacht’s velocity through the water (CTW, STW) and the current.'))),
      entry(L('Znam KR – jaki będzie KDd? (wykreślnie)', 'I know my heading – what is the COG? (by plotting)'),
        h('ol', {}, h('li', {}, L('Z pozycji wyjściowej wykreśl KDw i odłóż na nim drogę po wodzie w 1 h (V Mm).', 'From the start position draw the CTW and mark the distance through the water in 1 h (STW NM).')),
          h('li', {}, L('Z końca tego odcinka wykreśl wektor prądu w jego kierunku, długości równej prędkości prądu w 1 h.', 'From its end draw the current vector in its set, as long as the rate for 1 h.')),
          h('li', {}, L('Połącz pozycję wyjściową z końcem wektora prądu: to KDd, a jego długość to prędkość nad dnem (SOG).', 'Join the start to the end of the current vector: that is the COG, and its length the speed over ground (SOG).')))),
      entry(L('Chcę iść KDd – jaki kurs sterować? (kurs z poprawką na prąd)', 'I want to make a COG – what course to steer?'),
        h('ol', {}, h('li', {}, L('Wykreśl na mapie linię zamierzonej drogi nad dnem (KDd) od pozycji wyjściowej.', 'Draw the intended track (COG) from the start.')),
          h('li', {}, L('Z pozycji wyjściowej odłóż wektor prądu na 1 h.', 'From the start draw the current vector for 1 h.')),
          h('li', {}, L('Z końca wektora prądu cyrklem rozwartym na V (prędkość jachtu w 1 h) zatocz łuk do przecięcia z linią KDd.', 'From the end of the current vector swing an arc with the dividers set to STW (1 h) to meet the COG line.')),
          h('li', {}, L('Kierunek od końca prądu do punktu przecięcia to KDw – kurs do sterowania (potem odejmij β, d, δ). Odległość od startu do przecięcia to SOG.', 'The direction from the end of the current vector to that point is the CTW – the course to steer (then subtract β, d, δ). The distance from the start to the intersection is the SOG.'))),
        P(L('Prąd z przodu skraca drogę nad dnem, z tyłu – wydłuża; prąd z boku wymaga „podrywania” dziobu pod prąd.', 'A head current shortens the run over the ground, a following one lengthens it; a cross current makes you point the bow up into it.')))
    ] },
    { id: 'bearings', name: L('Namiary', 'Bearings'), entries: [
      entry(L('Namiar i jego przeliczanie', 'A bearing and its conversion'),
        bearingsSVG(),
        P(L('Namiar to kierunek z jachtu na obiekt (latarnię, cypel, wieżę), mierzony kompasem namiarowym albo przez kompas sterowy. Przeliczasz go tak samo jak kurs – ale ', 'A bearing is the direction from the yacht to an object (light, headland, tower), taken with a hand-bearing compass or over the steering compass. You convert it like a course – but '), B(L('dewiację bierzesz dla kursu jachtu', 'deviation is taken for the yacht’s heading')), L(', nie dla namiaru (bo to od kursu zależy, jak żelazo jachtu działa na kompas).', ', not for the bearing (the heading decides how the yacht’s iron acts on the compass).')),
        formula('NM = NK + δ(KK)', 'NR = NM + d = NK + p'),
        P(L('Kompas ręczny trzymany z dala od żelaza ma zwykle δ ≈ 0, wtedy NR = NK + d.', 'A hand-bearing compass held away from iron usually has δ ≈ 0, so TB = CB + d.')),
        P(B(L('Kąt kursowy ', 'Relative bearing ')), L('(namiar względny, KĄT) – kąt od dziobu do obiektu, w prawo 0°–360° albo „z prawej/lewej burty”. NR = KR + KĄT (z lewej burty odejmij).', '– the angle from the bow to the object, 0°–360° clockwise or “on the starboard/port side”. TB = TC + RB (subtract when on the port side).'))),
      entry(L('Nanoszenie namiaru na mapę', 'Plotting a bearing on the chart'),
        h('ol', {}, h('li', {}, L('Przelicz namiar na rzeczywisty (NR).', 'Convert the bearing to true (TB).')),
          h('li', {}, L('Przyłóż trójkąt nawigacyjny środkiem do obiektu na mapie, ustaw kąt NR względem południków (albo przenieś kierunek z róży linijką równoległą).', 'Put the plotter’s centre on the object, set TB relative to the meridians (or transfer it from the rose with a parallel ruler).')),
          h('li', {}, L('Narysuj linię przez obiekt w kierunku NR ± 180° – po stronie, z której patrzysz. Jacht leży gdzieś na tej linii: to ', 'Draw a line through the object in the direction TB ± 180° – on your side of it. The yacht is somewhere on that line: a '), B(L('linia pozycyjna', 'position line')), '.')),
        ex(L('Latarnia w namiarze NR = 045° → jacht jest na linii biegnącej od latarni w kierunku 225°.', 'A light bearing TB = 045° → the yacht lies on a line running from the light towards 225°.')))
    ] },
    { id: 'lop', name: L('Linie pozycyjne i pozycja', 'Position lines and fixes'), entries: [
      entry(L('Linie pozycyjne', 'Position lines'),
        P(L('Linia pozycyjna to zbiór punktów, na których może być jacht, wyznaczony jednym pomiarem:', 'A position line is the set of points where the yacht may be, given by one observation:')),
        h('ul', {}, h('li', {}, B(L('namiar', 'bearing')), L(' – prosta przez obiekt (NR ± 180°);', ' – a straight line through the object (TB ± 180°);')),
          h('li', {}, B(L('nabieżnik', 'transit')), L(' – dwa obiekty w jednej linii: najdokładniejsza linia pozycyjna, bez kompasu;', ' – two objects in line: the most accurate position line, no compass needed;')),
          h('li', {}, B(L('odległość', 'distance')), L(' – okrąg wokół obiektu (radar, kąt pionowy, zasięg światła);', ' – a circle round the object (radar, vertical angle, light range);')),
          h('li', {}, B(L('izobata', 'depth contour')), L(' – głębokość z echosondy porównana z mapą (pomocniczo).', ' – sounding compared with the chart (as a check).')))),
      entry(L('Pozycja z dwóch i trzech namiarów', 'A fix from two and three bearings'),
        fixSVG(),
        h('ol', {}, h('li', {}, L('Namierz dwa (lepiej trzy) obiekty rozpoznane na mapie, jak najszybciej jeden po drugim – najpierw te z boku, na końcu te przed dziobem lub za rufą (ich namiar zmienia się najwolniej).', 'Take bearings of two (better three) objects identified on the chart, as quickly as possible – first those abeam, last those ahead or astern (their bearings change slowest).')),
          h('li', {}, L('Przelicz na NR i wykreśl linie przez obiekty.', 'Convert to true and plot the lines through the objects.')),
          h('li', {}, L('Przecięcie to pozycja obserwowana – zaznacz kółkiem z godziną i logiem.', 'The intersection is the observed fix – mark it with a circle, the time and the log reading.'))),
        P(L('Linie powinny przecinać się pod kątem 30°–150°, najlepiej blisko 90°. Przy trzech namiarach zwykle powstaje mały ', 'The lines should cross at 30°–150°, ideally near 90°. With three bearings you usually get a small '), B(L('trójkąt błędów', 'cocked hat')), L(' – przyjmij pozycję w jego środku albo w rogu najbliższym niebezpieczeństwa. Duży trójkąt oznacza błąd: zły obiekt, zła dewiacja lub pomyłka w przeliczeniu.', ' – take the position at its centre or at the corner nearest danger. A large triangle means an error: wrong object, wrong deviation or a conversion slip.'))),
      entry(L('Namiar podwójny', 'Doubling the angle on the bow'),
        doubleSVG(),
        P(L('Jeden obiekt namierzony dwa razy przy stałym kursie. Gdy kąt kursowy się podwoi (np. 30° → 60°, 45° → 90°), odległość od obiektu w chwili drugiego namiaru równa się drodze przebytej między namiarami. Przy 45° i 90° (namiar czteropunktowy) to od razu odległość mijania obiektu na trawersie.', 'One object observed twice on a steady course. When the relative bearing doubles (e.g. 30° → 60°, 45° → 90°), the distance off at the second bearing equals the distance run between them. With 45° and 90° (the four-point bearing) it is directly the distance off when abeam.')),
        P(L('Między namiarami trzeba uwzględnić prąd – jeśli jest, użyj drogi nad dnem.', 'Allow for current between the bearings – if there is one, use the distance over the ground.'))),
      entry(L('Izobata jako linia pozycyjna', 'A depth contour as a position line'),
        contourSVG(),
        P(L('Izobata to linia na mapie łącząca miejsca o tej samej głębokości. Gdy echosonda pokazuje głębokość równą jednej z izobat (po odjęciu zanurzenia przetwornika i poprawce na pływ), jacht leży gdzieś na tej izobacie – to też linia pozycyjna.', 'A depth contour joins points of equal depth on the chart. When the echo sounder shows a depth equal to one of the contours (corrected for transducer depth and tide), the yacht lies somewhere on that contour – it is a position line too.')),
        P(L('Sama izobata rzadko wystarcza, ale razem z namiarem daje pozycję: punkt, w którym linia namiaru przecina izobatę. Najlepiej działa przy wyraźnym, stromym spadku dna; na płaskim dnie jest mało dokładna.', 'A contour alone is rarely enough, but together with a bearing it gives a fix: the point where the bearing line crosses the contour. It works best where the bottom slopes clearly; over a flat bottom it is not very accurate.')),
        ex(L('Echosonda: 10,4 m, przetwornik 0,4 m pod wodą, pływ ≈ 0 → głębokość z mapy 10,8 m ≈ izobata 10 m. Namiar latarni NR = 060° przecina izobatę 10 m w jednym punkcie – to pozycja.', 'Echo sounder: 10.4 m, transducer 0.4 m below the surface, tide ≈ 0 → charted depth 10.8 m ≈ the 10 m contour. The light’s bearing TB = 060° crosses the 10 m contour at one point – that is the fix.'))),
      entry(L('Namiar i odległość', 'Bearing and distance'),
        P(L('Gdy znasz odległość od obiektu (radar, zasięg światła na granicy widoczności), zatocz cyrklem okrąg o tym promieniu wokół obiektu; pozycja to przecięcie okręgu z linią namiaru.', 'When you know the distance (radar, a light just rising), swing a circle of that radius round the object; the fix is where it meets the bearing line.')))
    ] },
    { id: 'dr', name: L('Zliczenie i droga', 'Dead reckoning and distance'), entries: [
      entry(L('Czas, prędkość, droga', 'Time, speed, distance'),
        formula('s = v · t', 'v = s / t', 't = s / v'),
        P(L('s w milach morskich (Mm), v w węzłach (kn = Mm/h), t w godzinach. 1 Mm = 1852 m; 6 minut = 0,1 h – przy 6 kn w 6 minut przepłyniesz 0,6 Mm.', 's in nautical miles (NM), v in knots (kn = NM/h), t in hours. 1 NM = 1852 m; 6 minutes = 0.1 h – at 6 kn you make 0.6 NM in 6 minutes.'))),
      entry(L('Mierzenie odległości na mapie', 'Measuring distance on the chart'),
        P(L('1 minuta szerokości (1′) = 1 Mm. Odległość mierzysz cyrklem i przykładasz go do ', '1 minute of latitude (1′) = 1 NM. Measure with the dividers and lay them against the '), B(L('skali szerokości', 'latitude scale')), L(' na bocznych ramkach mapy – na wysokości mierzonego odcinka (na mapach Merkatora skala zmienia się z szerokością). Nigdy nie mierz odległości na skali długości u góry i u dołu mapy.', ' at the side of the chart – level with the leg you measure (on Mercator charts the scale changes with latitude). Never measure distance on the longitude scale at the top or bottom.'))),
      entry(L('Zliczenie drogi (DR)', 'Dead reckoning (DR)'),
        P(L('Od ostatniej pewnej pozycji odkładasz KDd i drogę nad dnem (s = SOG · t) – otrzymujesz pozycję zliczoną. Bez prądu i dryfu wystarczy KR i prędkość z logu. Pozycję zliczoną oznacza się półkolem z kreską i godziną; co pewien czas sprawdzaj ją pozycją obserwowaną.', 'From the last reliable position lay off the COG and the distance over the ground (s = SOG · t) – that is the DR position. With no current or leeway the true course and the log speed are enough. Mark DR with a half circle and the time; check it regularly with an observed fix.')))
    ] },
    { id: 'range', name: L('Zasięg widoczności', 'Range of visibility'), entries: [
      entry(L('Zasięg geograficzny i nominalny', 'Geographic and nominal range'),
        formula(L('Dg = 2,08 · (√h + √H)   [Mm, h i H w metrach]', 'Dg = 2.08 · (√h + √H)   [NM, h and H in metres]')),
        P(L('h – wysokość światła nad wodą (z mapy lub spisu świateł), H – wysokość oka obserwatora. Zasięg nominalny (siła światła) podaje mapa, np. „15M”. Światło zobaczysz z mniejszej z tych dwóch odległości.', 'h – height of the light above the water (from the chart or list of lights), H – height of the observer’s eye. The nominal range (the light’s power) is on the chart, e.g. “15M”. You will see the light at the smaller of the two distances.')),
        ex(L('h = 36 m, H = 2,25 m: Dg = 2,08 · (6 + 1,5) = 15,6 Mm; zasięg nominalny 18 Mm → światło pojawi się na horyzoncie w odległości ok. 15,6 Mm. To daje linię pozycyjną (okrąg) – razem z namiarem: pozycję.', 'h = 36 m, H = 2.25 m: Dg = 2.08 · (6 + 1.5) = 15.6 NM; nominal range 18 NM → the light rises over the horizon at about 15.6 NM. That gives a position circle – with its bearing, a fix.')))
    ] },
    { id: 'symbols', name: L('Symbole map', 'Chart symbols'), entries: symbolsChapter() }
  ];
}
