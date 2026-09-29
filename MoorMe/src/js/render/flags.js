// Bandery państw europejskich z dostępem do morza (uproszczone) + porty macierzyste dla nazw na pawęży
import * as THREE from 'three';

// h = poziome pasy, v = pionowe pasy; w = proporcje pasów; nordic = krzyż skandynawski
export const FLAGS = {
  DE: { h: ['#000000', '#dd0000', '#ffce00'], ports: ['Bregge', 'Kiel', 'Hamburg', 'Rostock'] },
  PL: { h: ['#ffffff', '#dc143c'], ports: ['Gdynia', 'Gdańsk', 'Szczecin'] },
  NL: { h: ['#ae1c28', '#ffffff', '#21468b'], ports: ['Enkhuizen', 'Lelystad', 'Den Helder'] },
  FR: { v: ['#002395', '#ffffff', '#ed2939'], ports: ['La Rochelle', 'Brest', 'Marseille'] },
  IT: { v: ['#009246', '#ffffff', '#ce2b37'], ports: ['Genova', 'Napoli', 'Trieste'] },
  BE: { v: ['#000000', '#fae042', '#ed2939'], ports: ['Ostend', 'Nieuwpoort'] },
  IE: { v: ['#169b62', '#ffffff', '#ff883e'], ports: ['Cork', 'Howth', 'Dun Laoghaire'] },
  ES: { h: ['#aa151b', '#f1bf00', '#f1bf00', '#aa151b'], w: [1, 1, 1, 1], ports: ['Palma', 'Barcelona', 'Vigo'] },
  PT: { v: ['#046a38', '#046a38', '#da291c'], w: [2, 1, 3], ports: ['Lisboa', 'Cascais', 'Faro'] },
  HR: { h: ['#ff0000', '#ffffff', '#171796'], ports: ['Split', 'Zadar', 'Pula'] },
  SI: { h: ['#ffffff', '#0000ff', '#ff0000'], ports: ['Portoroz', 'Piran'] },
  LT: { h: ['#fdb913', '#006a44', '#c1272d'], ports: ['Klaipeda'] },
  LV: { h: ['#9e3039', '#ffffff', '#9e3039'], w: [2, 1, 2], ports: ['Riga', 'Liepaja'] },
  EE: { h: ['#0072ce', '#000000', '#ffffff'], ports: ['Tallinn', 'Parnu'] },
  BG: { h: ['#ffffff', '#00966e', '#d62612'], ports: ['Varna', 'Burgas'] },
  RO: { v: ['#002b7f', '#fcd116', '#ce1126'], ports: ['Constanta'] },
  UA: { h: ['#0057b7', '#ffd700'], ports: ['Odesa'] },
  MT: { v: ['#ffffff', '#cf142b'], ports: ['Valletta'] },
  SE: { nordic: ['#006aa7', '#fecc00'], ports: ['Ystad', 'Malmo', 'Gothenburg'] },
  DK: { nordic: ['#c8102e', '#ffffff'], ports: ['Copenhagen', 'Aarhus', 'Skagen'] },
  NO: { nordic: ['#ba0c2f', '#ffffff', '#00205b'], ports: ['Oslo', 'Bergen', 'Stavanger'] },
  FI: { nordic: ['#ffffff', '#003580'], ports: ['Helsinki', 'Turku', 'Hanko'] },
  IS: { nordic: ['#02529c', '#ffffff', '#dc1e35'], ports: ['Reykjavik'] },
  GR: { greek: true, ports: ['Athens', 'Corfu', 'Rhodes'] },
  GB: { jack: true, ports: ['Southampton', 'Plymouth', 'Cowes'] }
};
export const FLAG_CODES = Object.keys(FLAGS);

const cache = new Map();
function drawFlag(g, W, H, f) {
  const stripes = (cols, w, vertical) => {
    const wt = w || cols.map(() => 1);
    const sum = wt.reduce((a, b) => a + b, 0);
    let p = 0;
    cols.forEach((c, i) => {
      const len = ((vertical ? W : H) * wt[i]) / sum;
      g.fillStyle = c;
      if (vertical) g.fillRect(p, 0, len + 1, H); else g.fillRect(0, p, W, len + 1);
      p += len;
    });
  };
  if (f.h) stripes(f.h, f.w, false);
  else if (f.v) stripes(f.v, f.w, true);
  else if (f.nordic) {
    g.fillStyle = f.nordic[0]; g.fillRect(0, 0, W, H);
    const cx = W * 0.36, t = H * (f.nordic[2] ? 0.34 : 0.2);
    g.fillStyle = f.nordic[1];
    g.fillRect(0, H / 2 - t / 2, W, t); g.fillRect(cx - t / 2, 0, t, H);
    if (f.nordic[2]) {
      const t2 = t * 0.5;
      g.fillStyle = f.nordic[2];
      g.fillRect(0, H / 2 - t2 / 2, W, t2); g.fillRect(cx - t2 / 2, 0, t2, H);
    }
  } else if (f.greek) {
    for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#0d5eaf'; g.fillRect(0, (H * i) / 9, W, H / 9 + 1); }
    g.fillStyle = '#0d5eaf'; g.fillRect(0, 0, (H * 5) / 9, (H * 5) / 9);
    g.fillStyle = '#ffffff';
    g.fillRect((H * 5) / 18 - H * 0.055, 0, H * 0.11, (H * 5) / 9);
    g.fillRect(0, (H * 5) / 18 - H * 0.055, (H * 5) / 9, H * 0.11);
  } else if (f.jack) {
    g.fillStyle = '#012169'; g.fillRect(0, 0, W, H);
    g.lineCap = 'butt';
    const diag = (col, wd) => { g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, H); g.moveTo(W, 0); g.lineTo(0, H); g.stroke(); };
    diag('#ffffff', H * 0.2); diag('#c8102e', H * 0.07);
    g.fillStyle = '#ffffff'; g.fillRect(0, H * 0.5 - H * 0.17, W, H * 0.34); g.fillRect(W * 0.5 - H * 0.17, 0, H * 0.34, H);
    g.fillStyle = '#c8102e'; g.fillRect(0, H * 0.5 - H * 0.1, W, H * 0.2); g.fillRect(W * 0.5 - H * 0.1, 0, H * 0.2, H);
  }
}

// Materiał flagi (współdzielony – dzięki temu scalanie geometrii sąsiadów go nie duplikuje)
export function flagMaterial(code) {
  if (cache.has(code)) return cache.get(code);
  const f = FLAGS[code] || FLAGS.DE;
  const c = document.createElement('canvas');
  c.width = 96; c.height = 64;
  drawFlag(c.getContext('2d'), 96, 64, f);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const m = new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide });
  cache.set(code, m);
  return m;
}
