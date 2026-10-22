// Światła statków wg MPZZM/COLREG (część C): katalog jednostek, sektory świateł i ich widoczność z danego kierunku.
// Układ statku: x – do przodu od śródokręcia (m), y – wysokość nad wodą (m), z – w prawo (na prawą burtę, m).

// Sektory (kąt względny obserwatora od dziobu, + = prawa burta, stopnie)
export const SECTORS = {
  mast: (a) => Math.abs(a) <= 112.5, // światło masztowe: 225° do przodu
  stbd: (a) => a >= -3 && a <= 112.5, // burtowe zielone (lekko zachodzi za dziób, jak w praktyce)
  port: (a) => a <= 3 && a >= -112.5, // burtowe czerwone
  stern: (a) => Math.abs(a) >= 112.5, // rufowe: 135° do tyłu
  tow: (a) => Math.abs(a) >= 112.5, // holownicze (żółte) nad rufowym
  all: () => true // dookólne
};

export const COLORS = { white: 0xfff1dc, red: 0xff1008, green: 0x00e81c, yellow: 0xffc400 };

// pomocnicze zestawy świateł
const sides = (L, y) => [
  { x: L * 0.1, y, z: -3, c: 'red', s: 'port' },
  { x: L * 0.1, y, z: 3, c: 'green', s: 'stbd' }
];
const stern = (L, y) => [{ x: -L * 0.48, y, z: 0, c: 'white', s: 'stern' }];
const mast1 = (L, y) => [{ x: L * 0.25, y, z: 0, c: 'white', s: 'mast' }];
const mast2 = (L, y) => [{ x: L * 0.3, y, z: 0, c: 'white', s: 'mast' }, { x: -L * 0.15, y: y + 6, z: 0, c: 'white', s: 'mast' }];
const column = (x, y0, cols) => cols.map((c, i) => ({ x, y: y0 + (cols.length - 1 - i) * 2.2, z: 0, c, s: 'all' })); // światła w pionie, od góry
const underway = (L, my) => [...mast1(L, my), ...sides(L, 5), ...stern(L, 4)];
const underwayLarge = (L) => [...mast2(L, 13), ...sides(L, 8), ...stern(L, 6)];

// Typy jednostek: name – odpowiedź, lights(L) – zestaw świateł, speed – kn, L – długość (m), moving – czy w drodze
export const VESSELS = [
  {
    id: 'power', name: 'Statek o napędzie mechanicznym w drodze (< 50 m)', L: [20, 45], speed: [8, 14], moving: true,
    explain: 'Jedno białe światło masztowe, światła burtowe (czerwone z lewej, zielone z prawej) i białe rufowe.',
    lights: (L) => underway(L, 9)
  },
  {
    id: 'powerLarge', name: 'Statek o napędzie mechanicznym w drodze (≥ 50 m)', L: [90, 220], speed: [10, 16], moving: true,
    explain: 'Dwa białe światła masztowe – tylne wyżej od przedniego, światła burtowe i rufowe. Po rozstawie masztowych widać kurs dużego statku.',
    lights: (L) => underwayLarge(L)
  },
  {
    id: 'sailing', name: 'Jednostka żaglowa w drodze', L: [9, 16], speed: [4, 7], moving: true,
    explain: 'Tylko światła burtowe i rufowe – bez światła masztowego. Mały jacht może zamiast nich nieść jedną latarnię trójsektorową na topie masztu.',
    lights: (L, r) => (r() < 0.4
      ? [{ x: 0, y: 15, z: -0.1, c: 'red', s: 'port' }, { x: 0, y: 15, z: 0.1, c: 'green', s: 'stbd' }, { x: -0.1, y: 15, z: 0, c: 'white', s: 'stern' }]
      : [...sides(L, 1.6), ...stern(L, 1.4)])
  },
  {
    id: 'anchor', name: 'Statek na kotwicy (< 50 m)', L: [20, 45], speed: [0, 0], moving: false,
    explain: 'Jedno białe światło widoczne dookoła widnokręgu, w przedniej części statku. Brak świateł burtowych.',
    lights: (L) => [{ x: L * 0.35, y: 7, z: 0, c: 'white', s: 'all' }]
  },
  {
    id: 'anchorLarge', name: 'Statek na kotwicy (≥ 50 m)', L: [90, 200], speed: [0, 0], moving: false,
    explain: 'Dwa białe światła dookólne: przednie wyżej, rufowe niżej. Duże statki dodatkowo oświetlają pokład.',
    lights: (L) => [{ x: L * 0.45, y: 14, z: 0, c: 'white', s: 'all' }, { x: -L * 0.45, y: 8, z: 0, c: 'white', s: 'all' }]
  },
  {
    id: 'trawling', name: 'Statek trałujący (łowiący włokiem)', L: [20, 40], speed: [3, 5], moving: true,
    explain: 'Zielone nad białym (dookólne, w pionie) – „zielone nad białym – trałuje”. W drodze także światła burtowe i rufowe.',
    lights: (L) => [...column(L * 0.2, 9, ['green', 'white']), ...sides(L, 4), ...stern(L, 3.5)]
  },
  {
    id: 'fishing', name: 'Statek rybacki (łowi, ale nie trałuje)', L: [15, 35], speed: [1, 3], moving: true,
    explain: 'Czerwone nad białym (dookólne, w pionie) – „czerwone nad białym – rybak wieczorem”. W drodze także światła burtowe i rufowe.',
    lights: (L) => [...column(L * 0.2, 8, ['red', 'white']), ...sides(L, 4), ...stern(L, 3.5)]
  },
  {
    id: 'nuc', name: 'Statek niezdolny do manewrowania', L: [40, 150], speed: [1, 3], moving: true,
    explain: 'Dwa czerwone światła dookólne w pionie – „czerwone nad czerwonym – kapitan nie żyje”. Gdy ma szybkość, także burtowe i rufowe, ale bez masztowych.',
    lights: (L) => [...column(L * 0.2, 9, ['red', 'red']), ...sides(L, 5), ...stern(L, 4)]
  },
  {
    id: 'ram', name: 'Statek o ograniczonej zdolności manewrowania', L: [40, 120], speed: [2, 6], moving: true,
    explain: 'Czerwone–białe–czerwone dookólne w pionie (np. kładzenie kabla, pogłębianie). W drodze także światła masztowe, burtowe i rufowe.',
    lights: (L) => [...column(L * 0.15, 9, ['red', 'white', 'red']), ...underway(L, 15)]
  },
  {
    id: 'cbd', name: 'Statek ograniczony zanurzeniem', L: [150, 300], speed: [10, 14], moving: true,
    explain: 'Trzy czerwone światła dookólne w pionie oraz światła statku o napędzie mechanicznym (dwa masztowe, burtowe, rufowe).',
    lights: (L) => [...column(-L * 0.1, 12, ['red', 'red', 'red']), ...underwayLarge(L)]
  },
  {
    id: 'towing', name: 'Statek holujący (hol < 200 m)', L: [25, 40], speed: [5, 8], moving: true,
    explain: 'Dwa białe światła masztowe w pionie, burtowe, rufowe i żółte światło holownicze nad rufowym. Za nim holowana jednostka z burtowymi i rufowym.',
    lights: (L) => [
      { x: L * 0.25, y: 9, z: 0, c: 'white', s: 'mast' }, { x: L * 0.25, y: 11.2, z: 0, c: 'white', s: 'mast' },
      ...sides(L, 5), ...stern(L, 4), { x: -L * 0.48, y: 5.6, z: 0, c: 'yellow', s: 'tow' },
      // jednostka holowana 150 m za rufą
      { x: -L / 2 - 150, y: 3, z: -5, c: 'red', s: 'port' }, { x: -L / 2 - 150, y: 3, z: 5, c: 'green', s: 'stbd' },
      { x: -L / 2 - 190, y: 3, z: 0, c: 'white', s: 'stern' }
    ]
  },
  {
    id: 'pilot', name: 'Statek pilotowy na służbie', L: [15, 25], speed: [6, 12], moving: true,
    explain: 'Białe nad czerwonym dookólne w pionie – „biała czapka, czerwony nos – pilot”. W drodze także burtowe i rufowe.',
    lights: (L) => [...column(L * 0.1, 8, ['white', 'red']), ...sides(L, 4), ...stern(L, 3.5)]
  },
  {
    id: 'fishingGear', name: 'Statek rybacki z narzędziami połowowymi wystającymi > 150 m', L: [15, 35], speed: [1, 3], moving: true, gear: true,
    explain: 'Czerwone nad białym jak statek rybacki, a do tego niżej białe światło dookólne przesunięte w stronę wystawionych sieci (2–6 m od głównych świateł). Nie przecinaj tej strony!',
    lights: (L, r, o) => [...column(L * 0.2, 8, ['red', 'white']), { x: L * 0.2, y: 4.5, z: (o.gearSide === 'port' ? -1 : 1) * 5, c: 'white', s: 'all' }, ...sides(L, 4), ...stern(L, 3.5)]
  },
  {
    id: 'aground', name: 'Statek na mieliźnie', L: [40, 120], speed: [0, 0], moving: false,
    explain: 'Światła kotwiczne (białe dookólne) oraz dwa czerwone dookólne w pionie. Trzymaj się z daleka – tam jest płytko!',
    lights: (L) => [...column(0, 9, ['red', 'red']), { x: L * 0.4, y: 7, z: 0, c: 'white', s: 'all' }]
  }
];

export const VESSEL_BY_ID = Object.fromEntries(VESSELS.map((v) => [v.id, v]));

// Znaki dzienne (czarne kształty na maszcie). shapes: [{ x, y, z, k }], k: ball | coneUp | coneDown | diamond | cylinder | hourglass
const col = (x, y0, ks) => ks.map((k, i) => ({ x, y: y0 + (ks.length - 1 - i) * 1.6, z: 0, k }));
export const DAY_VESSELS = [
  { id: 'dPower', name: 'Statek o napędzie mechanicznym w drodze (bez znaków)', L: [25, 120], speed: [8, 14], moving: true, hull: 'ship',
    explain: 'Statek o napędzie mechanicznym w drodze nie nosi w dzień żadnych znaków.', shapes: () => [] },
  { id: 'dAnchor', name: 'Statek na kotwicy', L: [25, 150], speed: [0, 0], moving: false, hull: 'ship',
    explain: 'Jedna czarna kula w przedniej części statku.', shapes: (L) => [{ x: L * 0.4, y: 9, z: 0, k: 'ball' }] },
  { id: 'dAground', name: 'Statek na mieliźnie', L: [40, 120], speed: [0, 0], moving: false, hull: 'ship',
    explain: 'Trzy czarne kule w pionie.', shapes: () => col(0, 9, ['ball', 'ball', 'ball']) },
  { id: 'dNuc', name: 'Statek niezdolny do manewrowania', L: [40, 150], speed: [1, 3], moving: true, hull: 'ship',
    explain: 'Dwie czarne kule w pionie.', shapes: () => col(0, 10, ['ball', 'ball']) },
  { id: 'dRam', name: 'Statek o ograniczonej zdolności manewrowania', L: [40, 120], speed: [2, 5], moving: true, hull: 'ship',
    explain: 'Kula – romb – kula w pionie (np. kładzenie kabla, pogłębianie).', shapes: () => col(0, 10, ['ball', 'diamond', 'ball']) },
  { id: 'dCbd', name: 'Statek ograniczony zanurzeniem', L: [150, 300], speed: [8, 12], moving: true, hull: 'ship',
    explain: 'Czarny walec (cylinder) w miejscu dobrze widocznym.', shapes: () => [{ x: 0, y: 14, z: 0, k: 'cylinder' }] },
  { id: 'dFishing', name: 'Statek zajęty połowem', L: [15, 40], speed: [1, 4], moving: true, hull: 'trawler',
    explain: 'Dwa stożki połączone wierzchołkami (klepsydra) – tak samo przy trałowaniu i innych połowach.', shapes: (L) => [{ x: L * 0.15, y: 9, z: 0, k: 'hourglass' }] },
  { id: 'dFishingGear', name: 'Statek zajęty połowem z narzędziami wystającymi > 150 m', L: [15, 35], speed: [1, 3], moving: true, hull: 'trawler', gear: true,
    explain: 'Klepsydra oraz stożek wierzchołkiem do góry po tej stronie, w którą wystawione są sieci.',
    shapes: (L, r, o) => [{ x: L * 0.15, y: 9, z: 0, k: 'hourglass' }, { x: L * 0.15, y: 5.5, z: (o.gearSide === 'port' ? -1 : 1) * 3.5, k: 'coneUp' }] },
  { id: 'dTowing', name: 'Statek holujący (hol > 200 m)', L: [25, 40], speed: [4, 7], moving: true, hull: 'tug',
    explain: 'Romb na holowniku i romb na holowanej jednostce, gdy długość holu przekracza 200 m.',
    shapes: (L) => [{ x: L * 0.2, y: 9, z: 0, k: 'diamond' }, { x: -L / 2 - 230, y: 5, z: 0, k: 'diamond' }] },
  { id: 'dMotorSail', name: 'Jacht żaglowy idący na silniku', L: [9, 16], speed: [5, 7], moving: true, hull: 'yacht',
    explain: 'Stożek wierzchołkiem w dół na przedniej części – jacht pod żaglami, ale z pracującym silnikiem jest statkiem o napędzie mechanicznym.',
    shapes: () => [{ x: 1.5, y: 6, z: 0, k: 'coneDown' }] }
];
export const DAY_BY_ID = Object.fromEntries(DAY_VESSELS.map((v) => [v.id, v]));
export const anyVessel = (id) => VESSEL_BY_ID[id] || DAY_BY_ID[id];

export const ASPECTS = {
  bow: 'Dziób – płynie na nas',
  starboard: 'Prawa burta (zielone)',
  port: 'Lewa burta (czerwone)',
  stern: 'Rufa – oddala się',
  none: 'Stoi – kierunek nieistotny'
};
export const GEAR_SIDES = { port: 'Z lewej burty statku', starboard: 'Z prawej burty statku' };

// Kąt względny obserwatora (od dziobu statku, + w prawo) z pozycji statku i kursu
export function relBearing(vx, vz, hdgDeg, ox, oz) {
  const h = (hdgDeg * Math.PI) / 180;
  const fx = Math.sin(h), fz = -Math.cos(h), sx = Math.cos(h), sz = Math.sin(h);
  const dx = ox - vx, dz = oz - vz;
  return (Math.atan2(dx * sx + dz * sz, dx * fx + dz * fz) * 180) / Math.PI;
}

export function aspectOf(rel, moving) {
  if (!moving) return 'none';
  if (Math.abs(rel) <= 3) return 'bow';
  if (Math.abs(rel) >= 112.5) return 'stern';
  return rel > 0 ? 'starboard' : 'port';
}

// Które światła widać z kąta rel
export function visibleLights(lights, rel) {
  return lights.filter((l) => SECTORS[l.s](rel));
}

// Czy statek przejdzie przed naszym dziobem, czy za rufą: ruch względny – gdzie przetnie naszą linię kursu (w naszym układzie)
export function passSide(v, own) {
  const vh = (v.hdg * Math.PI) / 180, oh = (own.hdg * Math.PI) / 180;
  const fx = Math.sin(oh), fz = -Math.cos(oh), sx = Math.cos(oh), sz = Math.sin(oh);
  const rvx = Math.sin(vh) * v.speed * 0.514444 - fx * own.speed, rvz = -Math.cos(vh) * v.speed * 0.514444 - fz * own.speed;
  const px = v.x - own.x, pz = v.z - own.z;
  const lat = px * sx + pz * sz, latV = rvx * sx + rvz * sz; // odległość boczna od naszej linii kursu i jej zmiana
  if (Math.abs(latV) < 1e-6 || -lat / latV < 0) return { side: 'none', along: 0, t: Infinity };
  const t = -lat / latV;
  const along = (px + rvx * t) * fx + (pz + rvz * t) * fz; // > 0: przed dziobem
  return { side: along > 0 ? 'ahead' : 'astern', along, t };
}
export const PASS_SIDES = { ahead: 'Przejdzie przed naszym dziobem', astern: 'Przejdzie za naszą rufą' };

// „Talia” typów: każdy typ pojawia się raz w losowej kolejności, potem talia jest tasowana od nowa
export function makeDeck(r, day = false) {
  let deck = [], last = null;
  return () => {
    if (!deck.length) {
      deck = (day ? DAY_VESSELS : VESSELS).map((v) => [r(), v.id]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      if (deck[0] === last && deck.length > 1) deck.push(deck.shift());
    }
    last = deck.shift();
    return last;
  };
}

// Losuje jednostkę: typ, długość, kurs tak, by obserwator widział zadany aspekt; pozycja względem obserwatora
export function spawnVessel(r, observer, opts = {}) {
  const list = opts.day ? DAY_VESSELS : VESSELS;
  const v = opts.type ? anyVessel(opts.type) : list[Math.floor(r() * list.length)];
  const L = Math.round(v.L[0] + r() * (v.L[1] - v.L[0]));
  const side = opts.side || (r() < 0.5 ? 'port' : 'starboard');
  // namiar z łodzi: 25–150° na wybraną burtę
  const relFromYacht = (25 + r() * 125) * (side === 'port' ? -1 : 1);
  const dist = (opts.day ? 350 : 500) + r() * (opts.day ? 450 : 700);
  const brg = observer.hdg + relFromYacht;
  const br = (brg * Math.PI) / 180;
  const x = observer.x + Math.sin(br) * dist, z = observer.z - Math.cos(br) * dist;
  // aspekt widziany z łodzi; przy sieciach – burta statku z sieciami ma być widoczna lub oczywista z pozycji świateł
  const pick = r();
  const aspect = opts.aspect && v.moving ? opts.aspect : !v.moving ? 'none' : v.gear ? (pick < 0.5 ? 'starboard' : 'port') : pick < 0.2 ? 'bow' : pick < 0.45 ? 'starboard' : pick < 0.7 ? 'port' : 'stern';
  const rel = aspect === 'bow' ? (r() - 0.5) * 4 : aspect === 'starboard' ? 20 + r() * 80 : aspect === 'port' ? -(20 + r() * 80) : aspect === 'stern' ? 130 + r() * 100 : r() * 360;
  // kurs statku: namiar od statku do łodzi minus kąt względny
  const back = (Math.atan2(observer.x - x, -(observer.z - z)) * 180) / Math.PI;
  const hdg = (((back - rel) % 360) + 360) % 360;
  let speed = (v.speed[0] + r() * (v.speed[1] - v.speed[0])) * 0.6; // wolniej niż w realu – więcej czasu na obserwację
  const o = { gearSide: r() < 0.5 ? 'port' : 'starboard' };
  let pos = { x, z, hdg }, pass = null;
  if (aspect === 'bow' && observer.speed !== undefined) {
    // statek idący „prosto na nas” (widać oba burtowe): podchodzi z kierunku bliskiego dziobowi i celuje w punkt naszej
    // linii kursu nieco przed albo za nami – po chwili namiar zacznie się przesuwać i będzie wiadomo, gdzie przejdzie
    speed = Math.max(speed, 6);
    const want = r() < 0.5 ? 'ahead' : 'astern', sgn = side === 'port' ? -1 : 1;
    const oh = (observer.hdg * Math.PI) / 180, fx = Math.sin(oh), fz = -Math.cos(oh);
    for (let k = 0; k < 400; k++) {
      const a = ((observer.hdg + sgn * (6 + r() * 14)) * Math.PI) / 180, dd = 650 + r() * 500;
      const px = observer.x + Math.sin(a) * dd, pz = observer.z - Math.cos(a) * dd;
      const s = -250 + r() * 600, tx = observer.x + fx * s, tz = observer.z + fz * s;
      const h2 = (((Math.atan2(tx - px, -(tz - pz)) * 180) / Math.PI) + 360) % 360;
      if (Math.abs(relBearing(px, pz, h2, observer.x, observer.z)) > 2.8) continue;
      const p = passSide({ x: px, z: pz, hdg: h2, speed }, observer);
      if (p.side === 'none' || Math.abs(p.along) < 45 || (p.side !== want && k < 300)) continue;
      pos = { x: px, z: pz, hdg: h2 }; pass = p.side;
      break;
    }
  }
  const base = { type: v.id, name: v.name, L, x: pos.x, z: pos.z, hdg: pos.hdg, pass, speed: v.moving ? speed : 0, side, moving: v.moving, gear: !!v.gear, gearSide: v.gear ? o.gearSide : null, day: !!opts.day };
  if (opts.day) return { ...base, hull: v.hull, shapes: v.shapes(L, r, o), lights: [] };
  return { ...base, lights: v.lights(L, r, o) };
}

// Opcje odpowiedzi: poprawna + n-1 losowych innych z tego samego katalogu
export function answerOptions(r, correctId, n = 6) {
  const list = DAY_BY_ID[correctId] ? DAY_VESSELS : VESSELS;
  const others = list.filter((v) => v.id !== correctId).map((v) => [r(), v.id]).sort((a, b) => a[0] - b[0]).slice(0, n - 1).map((x) => x[1]);
  return [...others, correctId].map((id) => [r(), id]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}
