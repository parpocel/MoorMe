// Pomocnicze funkcje matematyczne (płaszczyzna x–z świata, y = wysokość)
// Konwencja: kurs θ – dziób wskazuje (cos θ, sin θ) w płaszczyźnie (x, z).
// Północ = -z, wschód = +x. Dodatnie r = obrót w prawo (na sterburtę).

export const DEG = Math.PI / 180;
export const KN = 0.514444; // 1 węzeł w m/s

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

export function wrapPi(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Kurs kompasowy (0 = N, 90 = E) -> kąt θ w konwencji symulacji
export const compassToTheta = (deg) => (deg - 90) * DEG;
export const thetaToCompass = (th) => {
  let d = th / DEG + 90;
  d = ((d % 360) + 360) % 360;
  return d;
};
// Wektor kierunku dla namiaru kompasowego
export const compassVec = (deg) => ({ x: Math.sin(deg * DEG), z: -Math.cos(deg * DEG) });

// Przekształcenie punktu lokalnego łodzi (x – do dziobu, y – na sterburtę) do świata
export function localToWorld(px, pz, th, lx, ly) {
  const c = Math.cos(th), s = Math.sin(th);
  return { x: px + lx * c - ly * s, z: pz + lx * s + ly * c };
}
export function worldToLocal(px, pz, th, wx, wz) {
  const c = Math.cos(th), s = Math.sin(th);
  const dx = wx - px, dz = wz - pz;
  return { x: dx * c + dz * s, y: -dx * s + dz * c };
}
// Wektor świata -> ciało
export function vecToBody(th, vx, vz) {
  const c = Math.cos(th), s = Math.sin(th);
  return { u: vx * c + vz * s, v: -vx * s + vz * c };
}
export function vecToWorld(th, u, v) {
  const c = Math.cos(th), s = Math.sin(th);
  return { x: u * c - v * s, z: u * s + v * c };
}

// Punkt wewnątrz wielokąta wypukłego (dowolna orientacja) – zwraca najmniejszą penetrację
export function pointInConvex(poly, px, pz) {
  const n = poly.length;
  let orient = 0;
  // ustal orientację
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    orient += (b[0] - a[0]) * (b[1] + a[1]);
  }
  const ccwSign = orient > 0 ? 1 : -1;
  let minD = Infinity, nx = 0, nz = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const ex = b[0] - a[0], ez = b[1] - a[1];
    const len = Math.hypot(ex, ez) || 1;
    // normalna zewnętrzna
    let ox = ez / len, oz = -ex / len;
    ox *= -ccwSign; oz *= -ccwSign;
    const d = -((px - a[0]) * ox + (pz - a[1]) * oz); // >0 = wewnątrz względem tej krawędzi
    if (d < 0) return null;
    if (d < minD) { minD = d; nx = ox; nz = oz; }
  }
  return { depth: minD, nx, nz };
}

// Najbliższy punkt na odcinku
export function closestOnSegment(ax, az, bx, bz, px, pz) {
  const ex = bx - ax, ez = bz - az;
  const l2 = ex * ex + ez * ez || 1e-9;
  let t = ((px - ax) * ex + (pz - az) * ez) / l2;
  t = clamp(t, 0, 1);
  return { x: ax + ex * t, z: az + ez * t, t };
}

// Odległość punktu od wielokąta (0 gdy w środku) i normalna od wielokąta do punktu
export function distToPoly(poly, px, pz) {
  const inside = pointInConvex(poly, px, pz);
  if (inside) return { dist: -inside.depth, nx: inside.nx, nz: inside.nz };
  let best = Infinity, bx = 0, bz = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = closestOnSegment(a[0], a[1], b[0], b[1], px, pz);
    const d = Math.hypot(px - c.x, pz - c.z);
    if (d < best) { best = d; bx = c.x; bz = c.z; }
  }
  const l = best || 1e-9;
  return { dist: best, nx: (px - bx) / l, nz: (pz - bz) / l };
}

// Prostokąt obrócony -> wielokąt
export function rectPoly(cx, cz, len, wid, th = 0) {
  const c = Math.cos(th), s = Math.sin(th);
  const hl = len / 2, hw = wid / 2;
  return [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([x, y]) => [cx + x * c - y * s, cz + x * s + y * c]);
}

// Deterministyczny generator pseudolosowy
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gładki szum 1D (suma sinusów o niewspółmiernych częstotliwościach)
export function smoothNoise(seed) {
  const r = rng(seed);
  const comps = [];
  for (let i = 0; i < 5; i++) comps.push({ f: 0.02 + r() * 0.25 * (i + 1) / 3, p: r() * Math.PI * 2, a: 1 / (i + 1) });
  const norm = comps.reduce((s, c) => s + c.a, 0);
  return (t) => comps.reduce((s, c) => s + c.a * Math.sin(t * c.f * 2 * Math.PI + c.p), 0) / norm;
}
