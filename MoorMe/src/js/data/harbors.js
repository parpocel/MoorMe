// Generator portu: keje, polery, muringi, y-bomy, dalby, sąsiednie jachty, stanowisko docelowe.
// Świat: krawędź kei wzdłuż z = 0, woda dla z > 0, ląd dla z < 0. Północ = -z.
import { rectPoly, rng } from '../math.js';
import { BOATS, hullOutline } from './boats.js';

export const QUAYS = {
  concrete: {
    id: 'concrete',
    name: 'Nabrzeże betonowe',
    desc: 'Wysoka keja portu miejskiego z polerami i gumowymi odbojnicami. Twarda – odbijacze konieczne.',
    height: 1.1,
    methods: ['longside', 'mooringStern', 'mooringBow']
  },
  pontoon: {
    id: 'pontoon',
    name: 'Pomost pływający (marina)',
    desc: 'Niski pomost pływający z knagami i pierścieniami. Muringi przy każdym stanowisku.',
    height: 0.45,
    methods: ['mooringStern', 'mooringBow', 'longside']
  },
  yboom: {
    id: 'yboom',
    name: 'Pomost z Y-bomami',
    desc: 'Stanowiska rozdzielone pływającymi wysięgnikami (Y-bomy / fingery). Wąsko – precyzja!',
    height: 0.45,
    methods: ['yboomBow', 'yboomStern']
  },
  piles: {
    id: 'piles',
    name: 'Keja z dalbami (Bałtyk)',
    desc: 'Drewniana keja i pary dalb (pali) wbitych w dno – typowe dla portów bałtyckich.',
    height: 0.8,
    methods: ['pilesBow', 'pilesStern']
  }
};

export const METHODS = {
  longside: { id: 'longside', name: 'Burtą (longside)', desc: 'Równolegle do kei, między innymi jachtami. Cumy dziobowa, rufowa, szpringi i bresty.' },
  mooringStern: { id: 'mooringStern', name: 'Rufą z muringiem', desc: 'Cofanie do kei, cumy rufowe na keję, dziób trzymany muringiem z dna.' },
  mooringBow: { id: 'mooringBow', name: 'Dziobem z muringiem', desc: 'Dziobem do kei, rufa trzymana muringiem (przydatne przy wietrze od rufy).' },
  yboomBow: { id: 'yboomBow', name: 'Y-bomy – dziobem', desc: 'Wejście dziobem między wysięgniki, cumy dziobowe na pomost, boczne na końce bomów.' },
  yboomStern: { id: 'yboomStern', name: 'Y-bomy – rufą', desc: 'Cofanie między wysięgniki, cumy rufowe na pomost, boczne na bomy.' },
  pilesBow: { id: 'pilesBow', name: 'Dziobem do kei, rufa na dalbach', desc: 'Przy przejściu między dalbami zakładasz cumy rufowe na pale, dziób do kei.' },
  pilesStern: { id: 'pilesStern', name: 'Rufą do kei, dziób na dalbach', desc: 'Cofanie między dalbami, cumy dziobowe na pale, rufowe na keję.' }
};

export const HARBOR_BOUNDS = { minX: -150, maxX: 150, minZ: -45, maxZ: 260 };

// Struktura: { kind, poly, h, walk, color }
function struct(kind, poly, h, walk = false, extra = {}) {
  return { kind, poly, h, walk, ...extra };
}

function boatPolyWorld(spec, x, z, th, pad = 0) {
  const out = hullOutline(spec, 8);
  const c = Math.cos(th), s = Math.sin(th);
  return out.map(([lx, ly]) => {
    const k = 1 + pad / spec.beam;
    return [x + lx * c - ly * k * s, z + lx * s + ly * k * c];
  });
}

const NEIGHBOR_COLORS = [0xffffff, 0xf3f0e6, 0x1d3557, 0xffffff, 0xe9edf0, 0x8a1c1c, 0xffffff, 0x274c3a, 0xf7f7f7, 0x2f3e57];
const NEIGHBOR_TYPES = ['C34', 'C46', 'C50', 'C34', 'C46'];

/**
 * @param {object} opt { quay, method, side ('port'|'starboard'), boatSpec, scenario ('moor'|'unmoor'), seed }
 */
export function generateHarbor(opt) {
  const spec = opt.boatSpec;
  const L = spec.loa, B = spec.beam;
  const q = QUAYS[opt.quay];
  const method = opt.method;
  const R = rng(opt.seed || 7);
  const H = {
    quay: q, method, structures: [], bollards: [], murings: [], neighbors: [], deco: [],
    berth: null, starts: [], bounds: HARBOR_BOUNDS, walkEdgeZ: 0
  };
  let bid = 0;
  const addBollard = (x, z, kind, h, label) => {
    const b = { id: 'b' + bid++, x, z, kind, h, label: label || kindLabel(kind) };
    H.bollards.push(b);
    return b;
  };
  const edgeKind = q.id === 'concrete' ? 'bollard' : q.id === 'piles' ? 'bollard' : 'cleat';
  const edgeSetback = q.id === 'concrete' ? 0.55 : q.id === 'piles' ? 0.45 : 0.3;

  // --- Ląd i basen ---
  const minX = HARBOR_BOUNDS.minX, maxX = HARBOR_BOUNDS.maxX;
  if (q.id === 'concrete' || q.id === 'piles') {
    H.structures.push(struct('quay', [[minX, -45], [maxX, -45], [maxX, 0], [minX, 0]], q.height, true, { wood: q.id === 'piles' }));
  } else {
    // pomost pływający przed brzegiem
    H.structures.push(struct('pontoon', [[-95, -2.6], [95, -2.6], [95, 0], [-95, 0]], q.height, true));
    H.structures.push(struct('shallow', [[-95, -9], [95, -9], [95, -2.6], [-95, -2.6]], -0.3, false));
    H.structures.push(struct('quay', [[minX, -45], [maxX, -45], [maxX, -9], [minX, -9]], 1.2, false, { shore: true }));
    H.structures.push(struct('quay', [[minX, -9], [-95, -9], [-95, 6], [minX, 6]], 1.2, false, { shore: true }));
    H.structures.push(struct('quay', [[95, -9], [maxX, -9], [maxX, 6], [95, 6]], 1.2, false, { shore: true }));
    // kładki na ląd
    H.deco.push({ type: 'gangway', x: -40, z: -5.8, len: 6.4 });
    H.deco.push({ type: 'gangway', x: 40, z: -5.8, len: 6.4 });
  }
  // brzegi boczne
  H.structures.push(struct('land', [[minX - 60, -45], [minX, -45], [minX, 260], [minX - 60, 260]], 1.5));
  H.structures.push(struct('land', [[maxX, -45], [maxX + 60, -45], [maxX + 60, 260], [maxX, 260]], 1.5));
  // falochron z wejściem
  const bwZ = 205;
  H.structures.push(struct('breakwater', [[minX, bwZ], [25, bwZ], [25, bwZ + 14], [minX, bwZ + 14]], 2.2));
  H.structures.push(struct('breakwater', [[80, bwZ], [maxX, bwZ], [maxX, bwZ + 14], [80, bwZ + 14]], 2.2));
  H.deco.push({ type: 'lighthouse', x: 20, z: bwZ + 7, color: 0xd62828 });
  H.deco.push({ type: 'lighthouse', x: 85, z: bwZ + 7, color: 0x2a9d4a });

  // --- Stanowisko ---
  const sideQ = opt.side === 'starboard' ? 1 : -1; // która burta do kei (longside)
  let berth;
  const rows = []; // rzędy sąsiadów prostopadłych
  const neighborsSpecs = () => BOATS[NEIGHBOR_TYPES[Math.floor(R() * NEIGHBOR_TYPES.length)]];

  if (method === 'longside') {
    // Burta do kei. Lewa burta do kei => dziób na wschód (θ = 0)
    const th = sideQ === -1 ? 0 : Math.PI;
    const zc = B / 2 + 0.33;
    berth = { x: 0, z: zc, th, tolAlong: 2.5, tolAcross: 0.7, tolTh: 9, lenFree: 1.7 * L };
    // polery wzdłuż kei
    const step = q.id === 'concrete' ? 7 : 4.5;
    for (let x = -84; x <= 84; x += step) addBollard(x + (q.id === 'concrete' ? 3.5 : 0), -edgeSetback, edgeKind, q.height);
    if (q.id === 'pontoon') for (let x = -82; x <= 82; x += 9) addBollard(x, -0.18, 'ring', q.height);
    // sąsiedzi wzdłuż kei (przed i za)
    const free = 1.7 * L;
    let xr = free / 2, xl = -free / 2;
    for (let i = 0; i < 4; i++) {
      const sR = neighborsSpecs(), sL = neighborsSpecs();
      const gap = 1.2 + R() * 1.5;
      const cR = xr + sR.loa / 2, cL = xl - sL.loa / 2;
      H.neighbors.push({ spec: sR, x: cR, z: sR.beam / 2 + 0.33, th: R() < 0.5 ? 0 : Math.PI, color: NEIGHBOR_COLORS[i * 2 % NEIGHBOR_COLORS.length], alongside: true });
      H.neighbors.push({ spec: sL, x: cL, z: sL.beam / 2 + 0.33, th: R() < 0.5 ? 0 : Math.PI, color: NEIGHBOR_COLORS[(i * 2 + 1) % NEIGHBOR_COLORS.length], alongside: true });
      xr += sR.loa + gap; xl -= sL.loa + gap;
    }
  } else {
    // Stanowiska prostopadłe
    const bowIn = ['mooringBow', 'yboomBow', 'pilesBow'].includes(method);
    const th = bowIn ? -Math.PI / 2 : Math.PI / 2;
    const gapQ = bowIn ? 1.0 : 0.75;
    const zc = (bowIn ? 0.52 * L : 0.48 * L) + gapQ;
    const pad = method.startsWith('yboom') ? 0.6 : method.startsWith('piles') ? 1.05 : 0.9;
    const slotW = B + pad;
    berth = { x: 0, z: zc, th, tolAlong: 0.9, tolAcross: 0.55, tolTh: 7, slotW, bowIn };

    // sloty po obu stronach
    const slots = [{ x: 0, w: slotW, own: true }];
    let xr = slotW / 2, xl = -slotW / 2;
    for (let i = 0; i < 7; i++) {
      const sR = neighborsSpecs(), sL = neighborsSpecs();
      const wR = sR.beam + pad, wL = sL.beam + pad;
      slots.push({ x: xr + wR / 2, w: wR, spec: sR });
      slots.push({ x: xl - wL / 2, w: wL, spec: sL });
      xr += wR; xl -= wL;
    }
    slots.sort((a, b) => a.x - b.x);
    const freeRng = rng((opt.seed || 7) + 5);
    for (const s of slots) {
      // polery na granicach slotów
      addBollard(s.x - s.w / 2 + 0.25, -edgeSetback, edgeKind, q.height);
      if (s.own) addBollard(s.x + s.w / 2 - 0.25, -edgeSetback, edgeKind, q.height);
      if (!s.own) {
        // niektóre miejsca puste dla urozmaicenia (ale nie bezpośrednio przy naszym)
        const dist = Math.abs(s.x);
        if (dist > slotW * 2.5 && freeRng() < 0.18) continue;
        const nSpec = s.spec;
        const nBowIn = freeRng() < 0.2 ? !bowIn : bowIn;
        const nth = nBowIn ? -Math.PI / 2 : Math.PI / 2;
        const nz = (nBowIn ? 0.52 * nSpec.loa : 0.48 * nSpec.loa) + (nBowIn ? 1.0 : 0.75);
        H.neighbors.push({ spec: nSpec, x: s.x, z: nz, th: nth, color: NEIGHBOR_COLORS[Math.floor(freeRng() * NEIGHBOR_COLORS.length)], mooring: method.startsWith('mooring') });
      }
    }
    // ostatni poler
    const last = slots[slots.length - 1];
    addBollard(last.x + last.w / 2 - 0.25, -edgeSetback, edgeKind, q.height);

    if (method === 'mooringStern' || method === 'mooringBow') {
      // muring: blok na dnie ~2.5 L od kei, linka pilotowa przy kei
      for (const s of slots) {
        const m = {
          id: 'm' + H.murings.length,
          own: !!s.own,
          anchor: { x: s.x + (R() - 0.5) * 0.6, z: zc + L * 1.9, depth: 5.5 },
          pickup: { x: s.x + s.w * 0.22, z: -0.25 }
        };
        H.murings.push(m);
      }
      if (q.id === 'concrete') {
        // dodatkowe pierścienie przy kei
        for (const s of slots) addBollard(s.x, -0.2, 'ring', q.height);
      }
    }
    if (method.startsWith('yboom')) {
      const bl = 0.72 * L;
      H.boomLen = bl;
      const edges = new Set();
      for (const s of slots) { edges.add(+(s.x - s.w / 2).toFixed(3)); edges.add(+(s.x + s.w / 2).toFixed(3)); }
      for (const ex of edges) {
        H.structures.push(struct('boom', rectPoly(ex, bl / 2, bl, 0.36, Math.PI / 2), q.height * 0.8, false));
        addBollard(ex, bl - 0.35, 'ring', q.height * 0.8, 'Pierścień na końcu Y-bomu');
        addBollard(ex, bl * 0.5, 'ring', q.height * 0.8, 'Pierścień na Y-bomie');
      }
    }
    if (method.startsWith('piles')) {
      const pz = gapQ + L + 1.2;
      const edges = new Set();
      for (const s of slots) { edges.add(+(s.x - s.w / 2).toFixed(3)); edges.add(+(s.x + s.w / 2).toFixed(3)); }
      for (const ex of edges) {
        const oct = [];
        const rr = 0.2;
        for (let k = 0; k < 8; k++) oct.push([ex + rr * Math.cos(k * Math.PI / 4), pz + rr * Math.sin(k * Math.PI / 4)]);
        H.structures.push(struct('pile', oct, 3.0, false, { cx: ex, cz: pz, r: rr }));
        addBollard(ex, pz, 'pile', 2.2, 'Dalba');
      }
      berth.pileZ = pz;
    }
  }
  H.berth = berth;
  // numeracja polerów wzdłuż kei (od zachodu)
  const cnt = {};
  [...H.bollards].sort((a, b) => a.x - b.x || a.z - b.z).forEach((b) => {
    cnt[b.label] = (cnt[b.label] || 0) + 1;
    b.label = `${b.label} ${cnt[b.label]}`;
  });

  // --- Scenografia: łodzie w dalszej części portu (wzdłuż kei zachodniej/wschodniej) ---
  for (let i = 0; i < 6; i++) {
    const s = neighborsSpecs();
    H.neighbors.push({ spec: s, x: -131 + 0.52 * s.loa + 1.0, z: 20 + i * 7.5, th: Math.PI, color: NEIGHBOR_COLORS[i % NEIGHBOR_COLORS.length], scenery: true });
  }
  H.structures.push(struct('quay', [[-150, 15], [-131, 15], [-131, 70], [-150, 70]], 1.1, true));

  // --- Pozycje startowe ---
  const bz = berth.z;
  H.starts = [
    { id: 'entrance', name: 'Wejście do portu', x: 52, z: bwZ - 12, compass: 0 },
    { id: 'basin', name: 'Środek basenu', x: -45, z: 105, compass: 60 },
    { id: 'near', name: 'Blisko stanowiska', x: 32, z: Math.max(bz + L * 1.6, 30), compass: 270 },
    { id: 'east', name: 'Wschodnia część basenu', x: 95, z: 80, compass: 300 }
  ];
  H.exitZone = { x: 52, z: 150, r: 25 };
  return H;
}

function kindLabel(k) {
  return { bollard: 'Poler', cleat: 'Knaga kei', ring: 'Pierścień', pile: 'Dalba' }[k] || 'Poler';
}

// Obszary kolizyjne sąsiednich jachtów
export function neighborPolys(H) {
  return H.neighbors.map((n) => boatPolyWorld(n.spec, n.x, n.z, n.th, 0.05));
}

// Domyślne liny dla sposobu cumowania: [{role, name, cleatPick, target (fn)}]
export const ROLE_NAMES = {
  bow: 'Cuma dziobowa',
  stern: 'Cuma rufowa',
  springFwd: 'Szpring dziobowy',
  springAft: 'Szpring rufowy',
  breastFwd: 'Brest dziobowy',
  breastAft: 'Brest rufowy',
  side: 'Cuma boczna',
  mooring: 'Muring'
};
