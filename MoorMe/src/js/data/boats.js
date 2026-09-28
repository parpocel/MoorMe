// Modele łodzi – dane orientacyjne oparte na jachtach Bavaria C34, C46, C50.
// Układ lokalny: x – wzdłuż łodzi (+ do dziobu) od środka ciężkości, y – w poprzek (+ sterburta).

export const BOATS = {
  C34: {
    id: 'C34',
    name: 'Bavaria C34',
    loa: 10.84,
    lwl: 9.9,
    beam: 3.6,
    draft: 1.95,
    displacement: 6300, // kg (z załogą i zapasami)
    engineHp: 30,
    maxSpeedKn: 7.0,
    freeboard: 1.25,
    mastHeight: 16.0,
    keelArea: 1.9,
    rudderArea: 0.8, // dwie płetwy łącznie
    canoeDraft: 0.55,
    windageSide: 21,
    windageFront: 8.5,
    bowThrusterN: 540, // ~55 kgf
    sternThrusterN: 450,
    propDiameter: 0.38,
    cabins: 3,
    winchPull: 2200,
    color: 0xf4f6f8,
    stripe: 0x2b3a4a,
    wheels: 2
  },
  C46: {
    id: 'C46',
    name: 'Bavaria C46',
    loa: 14.64,
    lwl: 13.5,
    beam: 4.5,
    draft: 2.3,
    displacement: 12800,
    engineHp: 57,
    maxSpeedKn: 8.2,
    freeboard: 1.5,
    mastHeight: 21.0,
    keelArea: 2.8,
    rudderArea: 1.25,
    canoeDraft: 0.7,
    windageSide: 34,
    windageFront: 12.5,
    bowThrusterN: 930, // ~95 kgf
    sternThrusterN: 740,
    propDiameter: 0.48,
    cabins: 4,
    winchPull: 3200,
    color: 0xf2f3f5,
    stripe: 0x3c4b5a,
    wheels: 2
  },
  C50: {
    id: 'C50',
    name: 'Bavaria C50',
    loa: 15.55,
    lwl: 14.3,
    beam: 4.85,
    draft: 2.35,
    displacement: 15600,
    engineHp: 80,
    maxSpeedKn: 8.6,
    freeboard: 1.6,
    mastHeight: 23.0,
    keelArea: 3.2,
    rudderArea: 1.45,
    canoeDraft: 0.75,
    windageSide: 40,
    windageFront: 14,
    bowThrusterN: 1230, // ~125 kgf
    sternThrusterN: 930,
    propDiameter: 0.53,
    cabins: 5,
    winchPull: 4200,
    color: 0xf0f2f4,
    stripe: 0x1f3550,
    wheels: 2
  }
};

// Położenie dziobu i rufy względem środka ciężkości
export function hullExtents(spec) {
  return { xs: -0.48 * spec.loa, xb: 0.52 * spec.loa };
}

// Półszerokość kadłuba (na linii pokładu) w funkcji x lokalnego.
// Nowoczesny kształt serii C: szeroka rufa, pełny dziób (prawie pionowa stewa).
export function halfBeamAt(spec, x) {
  const { xs, xb } = hullExtents(spec);
  const t = (x - xs) / (xb - xs); // 0 rufa, 1 dziób
  if (t < 0 || t > 1) return 0;
  let f;
  if (t < 0.5) f = 0.86 + 0.14 * Math.sin((t / 0.5) * Math.PI / 2);
  else {
    const q = (t - 0.5) / 0.5;
    f = Math.pow(Math.cos(q * Math.PI / 2), 0.62);
  }
  return (spec.beam / 2) * Math.max(f, 0);
}

// Obrys kadłuba (wypukły wielokąt) – lista punktów [x, y] w układzie lokalnym, zgodnie ze wskazówkami zegara
export function hullOutline(spec, n = 14) {
  const { xs, xb } = hullExtents(spec);
  const pts = [];
  // burta prawa od rufy do dziobu
  for (let i = 0; i <= n; i++) {
    const x = xs + (xb - xs) * (i / n);
    pts.push([x, halfBeamAt(spec, i === 0 ? xs + 0.001 : x)]);
  }
  pts[pts.length - 1] = [xb, 0];
  // burta lewa od dziobu do rufy
  for (let i = n - 1; i >= 0; i--) {
    const x = xs + (xb - xs) * (i / n);
    pts.push([x, -halfBeamAt(spec, i === 0 ? xs + 0.001 : x)]);
  }
  return pts;
}

// Normalna zewnętrzna burty w punkcie x po danej stronie (side: +1 sterburta, -1 bakburta)
export function hullNormalAt(spec, x, side) {
  const dx = 0.05;
  const y1 = halfBeamAt(spec, x - dx), y2 = halfBeamAt(spec, x + dx);
  const slope = (y2 - y1) / (2 * dx);
  const l = Math.hypot(1, slope);
  return { x: -slope / l, y: side / l };
}

// Domyślne rozmieszczenie wyposażenia pokładowego (proporcje długości)
export function defaultDeckLayout(spec) {
  const { xs, xb } = hullExtents(spec);
  const L = spec.loa;
  const edge = (x, side, inset) => [x, side * Math.max(0.15, halfBeamAt(spec, x) - inset)];
  const items = [];
  let id = 0;
  const add = (kind, x, side, inset, label) => {
    const [px, py] = edge(x, side, inset);
    items.push({ id: `${kind}${id++}`, kind, x: +px.toFixed(2), y: +py.toFixed(2), label });
  };
  const sides = [[-1, 'L'], [1, 'P']];
  for (const [s, n] of sides) {
    add('cleat', xb - 0.07 * L, s, 0.28, `Knaga dziobowa ${n}`);
    add('fairlead', xb - 0.035 * L, s, 0.05, `Kluza dziobowa ${n}`);
    add('cleat', 0.02 * L, s, 0.22, `Knaga śródokręcie ${n}`);
    if (spec.loa > 12) add('halfFairlead', 0.02 * L, s, 0.03, `Półkluza śródokręcie ${n}`);
    add('cleat', xs + 0.05 * L, s, 0.3, `Knaga rufowa ${n}`);
    add('halfFairlead', xs + 0.025 * L, s, 0.04, `Półkluza rufowa ${n}`);
  }
  return items;
}

export function defaultFenders(spec) {
  const L = spec.loa;
  const res = [];
  const n = spec.loa > 12 ? 4 : 3;
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const x = -0.4 * L + (0.62 * L) * (i / (n - 1));
      res.push({ id: `f${side}_${i}`, x: +x.toFixed(2), side });
    }
  }
  // odbijacze rufowe (do cumowania rufą)
  res.push({ id: 'fs_L', x: -0.48 * L, side: -1, stern: true });
  res.push({ id: 'fs_P', x: -0.48 * L, side: 1, stern: true });
  return res;
}

export function defaultEquipment(spec) {
  return {
    boatId: spec.id,
    deck: defaultDeckLayout(spec),
    fenders: defaultFenders(spec),
    fenderRadius: spec.loa > 12 ? 0.13 : 0.11,
    bowThruster: spec.loa > 12 ? 'onoff' : 'none', // none | onoff | proportional
    sternThruster: false,
    propHand: 'right', // right = prawoskrętna, left = lewoskrętna
    drive: spec.id === 'C34' ? 'saildrive' : spec.id === 'C46' ? 'saildrive' : 'shaft',
    electricWinch: spec.loa > 12
  };
}

export const ITEM_KIND_LABEL = {
  cleat: 'Knaga',
  fairlead: 'Kluza',
  halfFairlead: 'Półkluza'
};
