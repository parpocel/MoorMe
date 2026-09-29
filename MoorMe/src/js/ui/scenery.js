// Ilustracja portu w stylu „low-poly pastel” – tło menu (SVG generowane proceduralnie)
import { rng } from '../math.js';

const W = 2000, H = 1250;
const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const toHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function ramp(stops, y) {
  if (y <= stops[0][0]) return hex(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (y <= stops[i][0]) { const t = (y - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]); return mix(hex(stops[i - 1][1]), hex(stops[i][1]), t); }
  }
  return hex(stops[stops.length - 1][1]);
}
const SKY = [[0, 0xb4bae2], [260, 0xc9c4e6], [430, 0xe6d6e4], [560, 0xf6dcd0], [670, 0xfbe0c4]];
const SEA = [[660, 0xaed7cb], [840, 0xa9d6cd], [1000, 0x93c7c6], [1250, 0x7fb4bf]];

// trójkątne fasety z jitterowanej siatki
function facets(x0, y0, x1, y1, step, colorAt, amp, r) {
  const cols = Math.ceil((x1 - x0) / step) + 1, rows = Math.ceil((y1 - y0) / step) + 1;
  const pts = [];
  for (let j = 0; j <= rows; j++) {
    pts.push([]);
    for (let i = 0; i <= cols; i++) {
      const edge = i === 0 || j === 0 || i === cols || j === rows;
      pts[j].push([x0 + i * step + (edge ? 0 : (r() - 0.5) * step * 0.7), y0 + j * step + (edge ? 0 : (r() - 0.5) * step * 0.7)]);
    }
  }
  let out = '';
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i], d = pts[j + 1][i + 1];
    for (const t of r() < 0.5 ? [[a, b, c], [b, d, c]] : [[a, b, d], [a, d, c]]) {
      const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      const col = colorAt(cy).map((v) => v + (r() - 0.5) * amp);
      out += `<polygon points="${t.map((p) => p[0].toFixed(0) + ',' + p[1].toFixed(0)).join(' ')}" fill="${toHex(col)}" stroke="${toHex(col)}" stroke-width="0.8"/>`;
    }
  }
  return out;
}

const poly = (pts, fill, extra = '') => `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${fill}" ${extra}/>`;
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;

function cloud(cx, cy, w, h = w * 0.3) {
  const top = [[cx - w / 2, cy], [cx - w * 0.36, cy - h * 0.55], [cx - w * 0.12, cy - h], [cx + w * 0.14, cy - h * 0.8], [cx + w * 0.36, cy - h * 0.5], [cx + w / 2, cy]];
  return poly(top, '#fdf6f4', 'opacity="0.96"') + poly([[cx - w / 2, cy], [cx + w / 2, cy], [cx + w * 0.34, cy + h * 0.16], [cx - w * 0.3, cy + h * 0.16]], '#e9deea', 'opacity="0.95"') +
    poly([[cx - w * 0.12, cy - h], [cx + w * 0.14, cy - h * 0.8], [cx + w * 0.02, cy - h * 0.35]], '#ffffff', 'opacity="0.9"');
}

function house(x, w, h, col, roof, base, opts = {}) {
  const top = base - h;
  let s = rect(x, top, w, h, col);
  // dach: schodkowy szczyt lub dwuspadowy
  if (opts.gable === 'step') {
    s += poly([[x, top], [x + w * 0.15, top - 16], [x + w * 0.3, top - 16], [x + w * 0.3, top - 34], [x + w * 0.5, top - 50], [x + w * 0.7, top - 34], [x + w * 0.7, top - 16], [x + w * 0.85, top - 16], [x + w, top]], col);
  } else {
    s += poly([[x - 4, top], [x + w / 2, top - w * 0.42], [x + w + 4, top]], roof);
    s += poly([[x + w / 2, top - w * 0.42], [x + w + 4, top], [x + w / 2, top]], 'rgba(0,0,0,0.08)');
  }
  s += poly([[x + w * 0.62, top], [x + w, top], [x + w, base], [x + w * 0.62, base]], 'rgba(60,40,80,0.10)'); // cień boczny
  const cols = Math.max(2, Math.floor(w / 26)), rows = Math.max(2, Math.floor((h - 34) / 34));
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) s += rect(x + 10 + i * ((w - 20) / cols) + 2, top + 14 + j * 34, 12, 16, '#838aa9');
  s += poly([[x + w / 2 - 9, base], [x + w / 2 - 9, base - 24], [x + w / 2, base - 33], [x + w / 2 + 9, base - 24], [x + w / 2 + 9, base]], '#7d719c');
  return s;
}

function smallBoat(x, y, w, stripe) {
  return poly([[x - w / 2, y - 16], [x + w / 2, y - 16], [x + w / 2 - 12, y], [x - w / 2 + 10, y]], '#f7f4f2') + rect(x - w / 2, y - 16, w, 4, stripe || '#9fb4dd') +
    rect(x - 3, y - 70, 3, 54, '#c9cfe0') + poly([[x + 2, y - 68], [x + w * 0.32, y - 18], [x + 2, y - 18]], 'rgba(255,255,255,0.85)');
}

export function sceneryHTML() {
  const r = rng(11);
  let s = `<svg class="scenery" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">`;
  s += `<g>${facets(0, 0, W, 680, 110, (y) => ramp(SKY, y), 5, r)}</g>`;
  // słońce
  const sx = 1610, sy = 565;
  s += `<circle cx="${sx}" cy="${sy}" r="250" fill="#fff1cf" opacity="0.28"/>` + poly(Array.from({ length: 9 }, (_, i) => [sx + Math.cos((i / 9) * 6.283 + 0.3) * 135, sy + Math.sin((i / 9) * 6.283 + 0.3) * 135].map((v) => Math.round(v))), '#ffecc0', 'opacity="0.85"') + poly(Array.from({ length: 7 }, (_, i) => [sx + Math.cos((i / 7) * 6.283) * 80, sy + Math.sin((i / 7) * 6.283) * 80].map((v) => Math.round(v))), '#fff5d8', 'opacity="0.9"');
  // chmury
  s += `<g class="sc-cloud c1">${cloud(510, 150, 300)}</g><g class="sc-cloud c2">${cloud(1040, 285, 200)}</g><g class="sc-cloud c3">${cloud(1300, 150, 190)}</g><g class="sc-cloud c4">${cloud(1810, 140, 300)}</g>`;
  // ptaki
  s += `<g class="sc-birds" fill="none" stroke="#7b83a8" stroke-width="3" stroke-linecap="round">` + [[910, 178], [840, 243], [1490, 233], [1430, 275], [1750, 345]].map(([x, y]) => `<path d="M${x - 22} ${y + 6} Q${x - 11} ${y - 8} ${x} ${y + 2} Q${x + 11} ${y - 8} ${x + 22} ${y + 6}"/>`).join('') + `</g>`;
  // wzgórza w oddali i statek
  s += poly([[0, 668], [40, 622], [70, 640], [95, 600], [125, 668]], '#a6b3d0') + poly([[1600, 668], [1690, 652], [1760, 654], [1770, 668]], '#c8c3d8') + rect(1660, 640, 44, 14, '#dcd6e6') + poly([[1946, 668], [1958, 632], [1970, 668]], '#f5f0f0');
  // morze
  s += `<g>${facets(0, 664, W, H, 105, (y) => ramp(SEA, y), 5, r)}</g>`;
  // molo z latarnią
  s += poly([[1520, 800], [W, 782], [W, 836], [1520, 840]], '#b9aec9') + poly([[1520, 826], [W, 812], [W, 836], [1520, 840]], '#a89cba');
  const lx = 1845;
  s += poly([[lx - 34, 790], [lx + 34, 790], [lx + 26, 520], [lx - 26, 520]], '#f3f1f0');
  for (let k = 0; k < 3; k++) { const y0 = 700 - k * 100, y1 = y0 - 46; s += poly([[lx - 28 + (790 - y0) * 0.0, y0], [lx + 28, y0], [lx + 27, y1], [lx - 27, y1]], '#e08f85'); }
  s += poly([[lx + 4, 790], [lx + 34, 790], [lx + 26, 520], [lx + 4, 520]], 'rgba(90,60,90,0.13)');
  s += rect(lx - 42, 505, 84, 16, '#e7dedd') + rect(lx - 30, 468, 60, 38, '#fbf7f2') + rect(lx - 12, 476, 24, 30, '#ffe7b5') + poly([[lx - 38, 468], [lx, 428], [lx + 38, 468]], '#e58f84') + rect(lx - 2, 410, 4, 20, '#d8807a');
  // miasto
  const base = 822;
  s += poly([[950, 690], [962, 660], [974, 690]], '#9dcdb5') + poly([[960, 690], [950, 690], [952, 522], [962, 500]], '#9dcdb5') + poly([[962, 500], [972, 522], [974, 690], [962, 690]], '#86bba3');
  s += rect(944, 690, 34, 130, '#e5c9a7');
  s += rect(1052, 560, 80, 140, '#d69f90') + poly([[1052, 560], [1064, 500], [1076, 560]], '#c17f75') + poly([[1108, 560], [1120, 500], [1132, 560]], '#c17f75') + poly([[1064, 560], [1092, 520], [1120, 560]], '#bb776f') + rect(1080, 580, 10, 46, '#9a5a5a') + rect(1104, 580, 10, 46, '#9a5a5a');
  const houses = [[834, 78, 168, 0xf2b7a7, '#dd9080', { gable: 'step' }], [912, 72, 196, 0xf7dc94, '#dfae62', { gable: 'step' }], [984, 78, 148, 0xa9d7c4, '#7cb39c'], [1062, 72, 188, 0xb7c3ee, '#8898c9', { gable: 'step' }], [1134, 82, 168, 0xf5b8cf, '#dc8fae'], [1216, 84, 148, 0xf1e8d1, '#d9b98a', { gable: 'step' }], [1300, 84, 130, 0xeabc90, '#cf8f68']];
  for (const [x, w, h, c, roof, o] of houses) s += house(x, w, h, toHex(hex(c)), roof, base, o || {});
  // dom z żurawiem
  s += rect(1384, 590, 64, 232, '#8b6b66') + poly([[1372, 592], [1416, 540], [1460, 592]], '#5d6b93') + rect(1452, 600, 70, 8, '#8b6b66') + rect(1516, 600, 4, 90, '#6a5350') +
    rect(1458, 640, 48, 182, '#c1837c') + poly([[1450, 640], [1482, 606], [1514, 640]], '#a56b66');
  for (let j = 0; j < 4; j++) s += rect(1394, 620 + j * 48, 12, 22, '#5d6b93') + rect(1424, 620 + j * 48, 12, 22, '#5d6b93');
  // nabrzeże miasta
  s += rect(780, 820, 740, 22, '#b7adc0') + rect(780, 836, 740, 8, '#a297b4');
  // małe łódki przy nabrzeżu i odbicia
  s += smallBoat(900, 850, 100) + smallBoat(1350, 852, 92, '#e8837a');
  for (const [x, w, c] of [[834, 78, '#f2b7a7'], [912, 72, '#f7dc94'], [984, 78, '#a9d7c4'], [1062, 72, '#b7c3ee'], [1134, 82, '#f5b8cf'], [1216, 84, '#f1e8d1'], [1300, 84, '#eabc90'], [1384, 64, '#8b6b66']]) s += poly([[x, 850], [x + w, 850], [x + w - 8, 900 + (x % 30)], [x + 8, 900 + (x % 30)]], c, 'opacity="0.2"');
  // refleksy słońca na wodzie
  s += `<g class="sc-glint" fill="none" stroke="#fff3d2" stroke-width="7" stroke-linecap="round" opacity="0.8"><path d="M1560 692H1690"/><path d="M1590 716H1670"/><path d="M1575 872H1660"/><path d="M1600 896H1650"/></g>`;
  // boje
  s += poly([[822, 942], [836, 896], [850, 942]], '#e2726a') + rect(822, 926, 28, 6, '#fff') + poly([[1820, 990], [1834, 950], [1848, 990]], '#80b89a') + rect(1820, 976, 28, 6, '#fff');
  // JACHT
  s += `<g class="sc-boat">`;
  // sztag i wanty
  s += `<path d="M1291 322 L1715 988" stroke="#e9dcc6" stroke-width="9"/><path d="M1291 322 L1715 988" stroke="#8fa5d0" stroke-width="3" transform="translate(6 0)"/>`;
  s += `<g stroke="#a9afc6" stroke-width="2" fill="none"><path d="M1290 340 L935 992"/><path d="M1290 340 L985 992"/><path d="M1290 340 L1440 985"/><path d="M1268 458 H1318"/><path d="M1262 582 H1326"/></g>`;
  s += rect(1286, 308, 9, 690, '#c9d0e3');
  // grot zwinięty na bomie i genua
  s += poly([[1040, 905], [1290, 862], [1290, 878], [1040, 924]], '#9db1dd') + poly([[1290, 858], [1290, 866], [1040, 906], [1040, 898]], '#7f95c6');
  // kadłub
  s += poly([[925, 1006], [1715, 988], [1690, 1040], [1560, 1072], [1160, 1080], [960, 1062]], '#f7f4f3');
  s += poly([[925, 1006], [1715, 988], [1712, 1000], [925, 1018]], '#dfe3f0');
  s += poly([[928, 1020], [1712, 1002], [1708, 1010], [930, 1029]], '#8fa5d0');
  s += poly([[945, 1062], [1160, 1080], [1560, 1072], [1690, 1040], [1682, 1054], [1550, 1084], [1160, 1092], [960, 1074]], '#66739a');
  s += poly([[1300, 1080], [1560, 1072], [1690, 1040], [1600, 1030]], 'rgba(120,120,160,0.18)');
  // kabina, okna
  s += poly([[1090, 1000], [1440, 990], [1420, 968], [1130, 972]], '#e8e8f2') + poly([[1130, 972], [1420, 968], [1400, 962], [1150, 966]], '#d0d6e8') + rect(1110, 976, 120, 14, '#c1d3f0') + poly([[1090, 1000], [1100, 990], [1110, 990], [1110, 1000]], '#ffffff');
  s += rect(1205, 1012, 52, 5, '#7c85a6') + rect(1305, 1010, 60, 5, '#7c85a6') + rect(1405, 1008, 50, 5, '#7c85a6');
  // kokpit, koło, reling
  s += `<circle cx="1006" cy="982" r="21" fill="none" stroke="#5a6b96" stroke-width="4"/><path d="M985 982H1027M1006 961V1003" stroke="#5a6b96" stroke-width="3"/>`;
  s += `<path d="M930 996 L1710 978" stroke="#b7bed3" stroke-width="2.5" fill="none"/><path d="M932 984 L1700 968" stroke="#c9cede" stroke-width="2" fill="none" stroke-dasharray="3 22"/>`;
  // odbijacze
  for (const x of [1100, 1385, 1590]) s += `<ellipse cx="${x}" cy="1034" rx="9" ry="20" fill="#93aadf"/>`;
  // bandera DE
  s += `<path d="M918 985 L910 948" stroke="#a5896c" stroke-width="3"/>` + poly([[912, 946], [942, 950], [942, 958], [912, 954]], '#2b2b2b') + poly([[912, 954], [942, 958], [942, 966], [912, 962]], '#d1443d') + poly([[912, 962], [942, 966], [942, 974], [912, 970]], '#f4c94a');
  // cumy
  s += `<g fill="none" stroke="#efe3c8" stroke-width="5" stroke-linecap="round"><path d="M955 1002 Q985 1112 1058 1108"/><path d="M1335 990 Q1230 1088 1090 1108"/><path d="M1700 1000 Q1690 1090 1640 1108"/></g>`;
  // mewa na dziobie
  s += poly([[1636, 1056], [1660, 1046], [1680, 1052], [1670, 1064], [1644, 1066]], '#f9f9f7') + poly([[1676, 1050], [1690, 1054], [1678, 1058]], '#f0b53b');
  s += `</g>`;
  // pomost z deskami
  s += rect(0, 1122, W, 128, '#dbba9b') + rect(0, 1116, W, 12, '#c69f80');
  for (let x = 30; x < W; x += 64) s += rect(x, 1128, 3, 122, '#c9a785', 'opacity="0.7"');
  s += poly([[0, 1128], [W, 1128], [W, 1140], [0, 1140]], 'rgba(0,0,0,0.05)');
  // knagi, pale, latarnia, koło ratunkowe, skrzynia, zwój liny
  s += `<g><polygon points="1038,1116 1078,1116 1070,1084 1046,1084" fill="#6f7c9e"/><rect x="1032" y="1078" width="52" height="10" rx="4" fill="#5a6688"/></g>`;
  s += `<g><polygon points="1616,1116 1656,1116 1648,1084 1624,1084" fill="#6f7c9e"/><rect x="1610" y="1078" width="52" height="10" rx="4" fill="#5a6688"/></g>`;
  s += rect(418, 1078, 24, 58, '#c29d7d') + poly([[418, 1078], [442, 1078], [430, 1068]], '#d4b092') + rect(1944, 1068, 24, 62, '#c29d7d') + poly([[1944, 1068], [1968, 1068], [1956, 1058]], '#d4b092');
  s += rect(856, 962, 8, 180, '#6b7898') + rect(846, 950, 28, 26, '#f4efe0') + poly([[842, 950], [860, 934], [878, 950]], '#6b7898') + `<circle cx="860" cy="962" r="30" fill="#fff4c9" opacity="0.4"/>`;
  s += `<circle cx="1862" cy="1092" r="33" fill="#ffffff"/><circle cx="1862" cy="1092" r="33" fill="none" stroke="#e96f65" stroke-width="12" stroke-dasharray="26 26"/><circle cx="1862" cy="1092" r="14" fill="#dbba9b"/>` + rect(1858, 1046, 8, 100, '#c29d7d');
  s += poly([[608, 1178], [688, 1170], [704, 1192], [704, 1224], [624, 1232], [608, 1210]], '#c9a688') + poly([[688, 1170], [704, 1162], [704, 1192]], '#b8977a') + `<path d="M608 1200 L704 1190 M650 1176 V1230" stroke="#b28e72" stroke-width="3"/>`;
  s += `<ellipse cx="1250" cy="1190" rx="52" ry="22" fill="#cfae90"/><ellipse cx="1250" cy="1187" rx="44" ry="17" fill="none" stroke="#f3ead6" stroke-width="6"/><ellipse cx="1250" cy="1187" rx="28" ry="10" fill="none" stroke="#f3ead6" stroke-width="6"/><path d="M1290 1186 Q1350 1170 1404 1180" stroke="#f3ead6" stroke-width="5" fill="none"/>`;
  s += `</svg>`;
  return s;
}

// małe flagi sygnałowe do nagłówka karty
export function signalFlagsHTML() {
  const f = (inner) => `<svg viewBox="0 0 40 40" width="40" height="40">${inner}</svg>`;
  const a = '#e2726a', b = '#f2c95b', c = '#5677b6', d = '#f7f3f0';
  return [
    f(`<rect width="40" height="40" fill="${c}"/><path d="M0 0L40 40M40 0L0 40" stroke="${d}" stroke-width="8"/>`),
    f(`<rect width="40" height="40" fill="${a}"/><polygon points="0,0 40,0 0,40" fill="${b}"/>`),
    f(`<rect width="40" height="40" fill="${b}"/><polygon points="40,0 40,40 0,40" fill="${a}"/>`),
    f(`<rect width="40" height="40" fill="${b}"/><rect x="0" y="0" width="20" height="20" fill="${a}"/><rect x="20" y="20" width="20" height="20" fill="${a}"/>`),
    f(`<rect width="40" height="40" fill="${c}"/><path d="M0 0L40 40M40 0L0 40" stroke="${d}" stroke-width="8"/><rect x="16" y="0" width="8" height="40" fill="${d}"/>`),
    f(`<rect width="40" height="20" fill="${c}"/><rect y="20" width="40" height="20" fill="${a}"/>`)
  ].join('');
}
