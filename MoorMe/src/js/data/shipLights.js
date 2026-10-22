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
    id: 'aground', name: 'Statek na mieliźnie', L: [40, 120], speed: [0, 0], moving: false,
    explain: 'Światła kotwiczne (białe dookólne) oraz dwa czerwone dookólne w pionie. Trzymaj się z daleka – tam jest płytko!',
    lights: (L) => [...column(0, 9, ['red', 'red']), { x: L * 0.4, y: 7, z: 0, c: 'white', s: 'all' }]
  }
];

export const VESSEL_BY_ID = Object.fromEntries(VESSELS.map((v) => [v.id, v]));

export const ASPECTS = {
  bow: 'Dziób – płynie na nas',
  starboard: 'Prawa burta (zielone)',
  port: 'Lewa burta (czerwone)',
  stern: 'Rufa – oddala się',
  none: 'Stoi – kierunek nieistotny'
};

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

// Losuje jednostkę: typ, długość, kurs tak, by obserwator widział zadany aspekt; pozycja względem obserwatora
export function spawnVessel(r, observer, opts = {}) {
  const v = opts.type ? VESSEL_BY_ID[opts.type] : VESSELS[Math.floor(r() * VESSELS.length)];
  const L = Math.round(v.L[0] + r() * (v.L[1] - v.L[0]));
  const side = opts.side || (r() < 0.5 ? 'port' : 'starboard');
  // namiar z jachtu: 25–150° na wybraną burtę
  const relFromYacht = (25 + r() * 125) * (side === 'port' ? -1 : 1);
  const dist = 500 + r() * 700;
  const brg = observer.hdg + relFromYacht;
  const br = (brg * Math.PI) / 180;
  const x = observer.x + Math.sin(br) * dist, z = observer.z - Math.cos(br) * dist;
  // aspekt widziany z jachtu
  const pick = r();
  const aspect = !v.moving ? 'none' : pick < 0.2 ? 'bow' : pick < 0.45 ? 'starboard' : pick < 0.7 ? 'port' : 'stern';
  const rel = aspect === 'bow' ? (r() - 0.5) * 4 : aspect === 'starboard' ? 20 + r() * 80 : aspect === 'port' ? -(20 + r() * 80) : aspect === 'stern' ? 130 + r() * 100 : r() * 360;
  // kurs statku: namiar od statku do jachtu minus kąt względny
  const back = (Math.atan2(observer.x - x, -(observer.z - z)) * 180) / Math.PI;
  const hdg = (((back - rel) % 360) + 360) % 360;
  const speed = v.speed[0] + r() * (v.speed[1] - v.speed[0]);
  return { type: v.id, name: v.name, L, x, z, hdg, speed: v.moving ? speed : 0, side, lights: v.lights(L, r), moving: v.moving };
}

// Opcje odpowiedzi: poprawna + n-1 losowych innych
export function answerOptions(r, correctId, n = 6) {
  const others = VESSELS.filter((v) => v.id !== correctId).map((v) => [r(), v.id]).sort((a, b) => a[0] - b[0]).slice(0, n - 1).map((x) => x[1]);
  return [...others, correctId].map((id) => [r(), id]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}
