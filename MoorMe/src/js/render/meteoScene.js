// Scena meteorologiczna: otwarte morze wokół jachtu – stan morza zgodny ze skalą Beauforta (fale Gerstnera liczone na GPU,
// białe grzywy, pasma piany, bryzgi, zamglenie) i niebo z rodzajami chmur (warstwy proceduralne + kłębiaste chmury low-poly,
// Cb z kowadłem, ulewą i wyładowaniami). Osie: x – wschód, y – w górę, z – południe (północ = −z), metry.
import * as THREE from 'three';
import { getSettings, boatIdentity } from '../settings.js';
import { wheelClassifier } from './wheel.js';
import { buildBoat } from './boatModel.js';
import { BOATS } from '../data/boats.js';
import { beaufort, bftKn } from '../data/meteo.js';
import { rng } from '../math.js';

const G = 9.81, NW = 12;
// kwantyl rozkładu normalnego: z, dla którego P(X > z) = p (przybliżenie Abramowitza–Stegun 26.2.23)
function zTail(p) {
  p = Math.min(0.5, Math.max(1e-4, p));
  const t = Math.sqrt(-2 * Math.log(p));
  return t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
}
const C = (hex) => new THREE.Color(hex);

// ---------- GLSL: szum ----------
const NOISE = `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
float fbm3(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ s += a * vnoise(p); p = p * 2.07 + vec2(5.1, 1.3); a *= 0.5; } return s / 0.875; }
// komórki (Worley): odległość do najbliższego losowego punktu
float worley(vec2 p){ vec2 i = floor(p), f = fract(p); float d = 1.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec2 g = vec2(float(x), float(y)); vec2 o = vec2(hash(i + g), hash(i + g + 17.3)); d = min(d, length(g + o - f)); }
  return d; }
`;

// ---------- niebo: kopuła z gradientem, tarczą Słońca i poświatą ----------
function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uZen: { value: C(0x3f7fc8) }, uHor: { value: C(0xbcd6ea) }, uSea: { value: C(0x2c4a5c) }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunVis: { value: 1 }, uSunCol: { value: C(0xfff3d6) }, uFlash: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uZen, uHor, uSea, uSun, uSunCol; uniform float uSunVis, uFlash; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 c = mix(uHor, uZen, pow(clamp(y, 0.0, 1.0), 0.55));
        float s = max(dot(d, normalize(uSun)), 0.0);
        c += uSunCol * (pow(s, 8.0) * 0.18 + pow(s, 90.0) * 0.35) * uSunVis;
        c += uSunCol * smoothstep(0.99975, 0.99985, s) * 6.0 * uSunVis;
        if (y < 0.0) c = mix(uHor, uSea, clamp(-y * 6.0, 0.0, 1.0));
        c += vec3(0.75, 0.8, 1.0) * uFlash;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(300000, 48, 24), mat);
  m.renderOrder = -10; m.frustumCulled = false;
  return m;
}

// ---------- warstwy chmur (proceduralne) ----------
// g – rodzaj, h – wysokość podstawy [m]
const LAYER = {
  Ci: { scale: 1100, stretch: [0.25, 1.0], cover: 0.45, alpha: 0.95, col: 0xffffff, shade: 0xdde6f0, mode: 1 },
  Cc: { scale: 170, stretch: [0.8, 1.0], cover: 0.5, alpha: 0.9, col: 0xffffff, shade: 0xe4ebf3, mode: 2, puff: 0.3 },
  Cs: { scale: 6000, stretch: [0.4, 1.0], cover: 1.0, alpha: 0.56, col: 0xf6f8fb, shade: 0xe3e9f0, mode: 3, halo: 1 },
  Ac: { scale: 800, stretch: [0.7, 1.0], cover: 0.62, alpha: 0.95, col: 0xfbfcfe, shade: 0x9aa5b4, mode: 2, puff: 0.42 },
  As: { scale: 14000, stretch: [0.6, 1.0], cover: 1.0, alpha: 0.9, col: 0xb7c0cc, shade: 0x8d97a5, mode: 4, glow: 1 },
  Ns: { scale: 7000, stretch: [0.6, 1.0], cover: 1.0, alpha: 1.0, col: 0x6f7780, shade: 0x454c55, mode: 4 },
  Fr: { scale: 700, stretch: [0.4, 1.0], cover: 0.42, alpha: 0.9, col: 0x5b636c, shade: 0x40464e, mode: 5 },
  Sc: { scale: 820, stretch: [0.55, 1.0], cover: 0.8, alpha: 0.97, col: 0xd9dee5, shade: 0x7b8592, mode: 2, puff: 0.62 },
  St: { scale: 9000, stretch: [0.6, 1.0], cover: 1.0, alpha: 1.0, col: 0xa3abb4, shade: 0x8b939c, mode: 4 }
};
function cloudLayer(g, h, windTo) {
  const P = LAYER[g];
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: {
      uScale: { value: P.scale }, uStretch: { value: new THREE.Vector2(...P.stretch) }, uCover: { value: P.cover }, uAlpha: { value: P.alpha },
      uCol: { value: C(P.col) }, uShade: { value: C(P.shade) }, uMode: { value: P.mode }, uHalo: { value: P.halo || 0 }, uGlow: { value: P.glow || 0 }, uPuff: { value: P.puff || 0.4 },
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uHor: { value: C(0xbcd6ea) }, uDrift: { value: new THREE.Vector2() }, uRot: { value: new THREE.Vector2(Math.cos(windTo), Math.sin(windTo)) },
      uLight: { value: 1 }, uFlash: { value: 0 }
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uScale, uCover, uAlpha, uMode, uHalo, uGlow, uLight, uFlash, uPuff; uniform vec2 uStretch, uDrift, uRot; uniform vec3 uCol, uShade, uSun, uHor; varying vec3 vW;
      ${NOISE}
      void main(){
        vec3 dir = normalize(vW - cameraPosition);
        if (dir.y < 0.003) discard;
        // współrzędne obrócone wzdłuż wiatru (pasma i wałki układają się wzdłuż/poprzek wiatru)
        vec2 q = (vW.xz + uDrift) / uScale;
        q = vec2(q.x * uRot.x + q.y * uRot.y, -q.x * uRot.y + q.y * uRot.x) * uStretch;
        float d = 0.0, thick = 0.0;
        if (uMode < 1.5) { // Ci – włókna z haczykami
          vec2 w = q + vec2(fbm3(q * 0.7) * 1.6, 0.0);
          w.y += 0.35 * sin(w.x * 1.7 + fbm3(q * 0.4) * 4.0); // zakrzywione włókna i „haczyki”
          float band = smoothstep(0.4, 0.7, fbm(vec2(w.x * 0.6, w.y * 0.5)));
          float fib = pow(fbm(vec2(w.x * 1.5, w.y * 18.0)), 1.4) * 2.5;
          d = clamp(band * fib, 0.0, 1.0); thick = d * 0.2;
        } else if (uMode < 2.5) { // Cc / Ac / Sc – kłębki w rzędach
          float m = smoothstep(1.0 - uCover - 0.15, 1.05 - uCover * 0.5, fbm(q * 0.23 + 3.1));
          vec2 cq = q * vec2(1.0, 1.35) + vec2(fbm3(q * 0.5) * 1.4, fbm3(q * 0.5 + 5.0) * 1.0);
          float wv = worley(cq) * 0.68 + worley(cq * 2.1 + 3.0) * 0.32;
          float cell = 1.0 - smoothstep(uPuff * 0.4, uPuff + 0.3, wv);
          float puff = cell * (0.55 + 0.6 * fbm(q * 3.0));
          d = clamp(puff * m * 1.4, 0.0, 1.0); thick = clamp(cell * cell * m, 0.0, 1.0);
        } else if (uMode < 3.5) { // Cs – mleczna zasłona
          d = 0.6 + 0.4 * fbm(q * 0.7 + vec2(fbm3(q * 2.5) * 0.4)) * (0.8 + 0.2 * fbm(vec2(q.x * 2.0, q.y * 14.0))); thick = 0.1;
        } else if (uMode < 4.5) { // As / Ns / St – jednolita warstwa z łagodnymi plamami
          d = 0.82 + 0.18 * fbm(q * 0.9); thick = 0.45 + 0.55 * fbm(q * 0.45 + 7.0);
        } else { // Fr – postrzępione strzępy pod Ns
          d = smoothstep(1.0 - uCover, 1.0 - uCover + 0.25, fbm(q * 0.8 + vec2(fbm3(q * 2.0))));
          thick = d;
        }
        vec3 col = mix(uCol, uShade, clamp(thick, 0.0, 1.0)) * uLight;
        float sd = max(dot(dir, normalize(uSun)), 0.0);
        // prześwit słońca przez cienkie brzegi
        col += vec3(1.0, 0.93, 0.8) * pow(sd, 12.0) * (1.0 - thick) * 0.45 * uLight;
        // halo 22° (Cs) i słońce jak przez matowe szkło (As)
        float ang = degrees(acos(clamp(sd, -1.0, 1.0)));
        float halo = exp(-pow((ang - 22.0) / 1.1, 2.0)) * uHalo;
        col += vec3(1.0, 0.9, 0.78) * halo * 0.55 + vec3(0.6, 0.62, 0.7) * exp(-pow((ang - 21.0) / 0.6, 2.0)) * uHalo * 0.12;
        float glow = exp(-ang * ang / 18.0) * uGlow;
        col = mix(col, vec3(1.0, 0.97, 0.9) * 1.25, clamp(glow, 0.0, 1.0));
        col += vec3(0.7, 0.75, 0.9) * uFlash;
        float a = clamp(d, 0.0, 1.0) * uAlpha;
        a = max(a, halo * 0.35 * uAlpha);
        // zanik i zamglenie przy horyzoncie
        float hz = smoothstep(0.004, 0.16, dir.y);
        col = mix(uHor, col, 0.25 + 0.75 * hz);
        a *= smoothstep(0.003, 0.05, dir.y);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(700000, 700000), mat);
  m.rotation.x = Math.PI / 2; m.position.y = h; m.renderOrder = -5 + 1 / (1 + h);
  m.frustumCulled = false;
  return m;
}

// ---------- chmury kłębiaste low-poly ----------
function puffGeo(R, r, base) {
  const g = new THREE.IcosahedronGeometry(r, 1).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (R() - 0.5) * 0.16;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  // wierzchołki tej samej pozycji muszą się przesunąć tak samo (bez dziur) – wyrównujemy po kluczu
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${Math.round(p.getX(i) * 10)},${Math.round(p.getY(i) * 10)},${Math.round(p.getZ(i) * 10)}`;
    if (!map.has(key)) map.set(key, [p.getX(i), p.getY(i), p.getZ(i)]); else { const v = map.get(key); p.setXYZ(i, v[0], v[1], v[2]); }
  }
  return g;
}
// pojedyncza chmura Cu: kopuła z kłębów, płaska podstawa na wysokości 0
function cumulusGeo(R, w, hgt, flatK = 1) {
  const geos = [];
  const n = 6 + Math.floor(R() * 7);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * w * 0.55;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr * 0.8;
    const top = (1 - rr / (w * 0.7)) * hgt;
    const r = w * (0.22 + R() * 0.2) * (0.6 + 0.6 * (1 - rr / w));
    const g = puffGeo(R, r, 0);
    g.translate(x, Math.max(r * 0.35, top * (0.45 + R() * 0.45)), z);
    geos.push(g);
  }
  const g = mergeGeos(geos);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, 0); // płaska podstawa
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * flatK);
  g.computeVertexNormals();
  return shadeByHeight(g, hgt * 0.5, 0.6, 1.0);
}
function mergeGeos(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return out;
}
// kolory wierzchołków: biel u góry, szarość przy płaskiej podstawie (hb – wysokość przejścia)
function shadeByHeight(g, hb, base = 0.62, top = 1.0) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, p.getY(i) / hb)); const v = base + (top - base) * Math.pow(t, 0.6); col[i * 3] = v; col[i * 3 + 1] = v * 1.01; col[i * 3 + 2] = v * 1.04; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// Cb: wieża + kowadło rozciągnięte z wiatrem, ciemna podstawa
function cumulonimbusGeo(R, windTo) {
  const geos = [];
  const towerR = 5000, top = 10800;
  // zwarta kolumna z wybrzuszeniami, rozszerzająca się ku kowadłu
  for (let i = 0; i < 40; i++) {
    const t = i / 39, y = 900 + t * (top - 1500);
    const r = towerR * (0.6 + 0.18 * R()) * (1 - t * 0.12 + Math.max(0, t - 0.8) * 1.2);
    const g = puffGeo(R, r, 0);
    const a = R() * Math.PI * 2, off = towerR * 0.28 * Math.sqrt(R());
    g.translate(Math.cos(a) * off, y, Math.sin(a) * off);
    geos.push(g);
  }
  // kalafiorowate kłęby na zewnątrz kolumny
  for (let i = 0; i < 40; i++) {
    const t = R(), y = 1200 + t * (top - 3000), a = R() * Math.PI * 2;
    const g = puffGeo(R, towerR * (0.28 + R() * 0.16), 0);
    g.translate(Math.cos(a) * towerR * 0.72, y, Math.sin(a) * towerR * 0.72);
    geos.push(g);
  }
  // kowadło: szeroki, płaski „talerz” rozciągnięty z wiatrem + wierzchołek przebijający kowadło
  const wx = Math.sin(windTo), wz = -Math.cos(windTo);
  const anv = new THREE.IcosahedronGeometry(1, 2).toNonIndexed();
  anv.scale(14000, 650, 9500);
  anv.rotateY(-windTo);
  anv.translate(wx * 5500, top - 200, wz * 5500);
  geos.push(anv);
  for (let i = 0; i < 46; i++) {
    const a = R() * Math.PI * 2, rr = Math.sqrt(R()), along = R();
    const g = puffGeo(R, 2300 + R() * 1700, 0); g.scale(1, 0.3, 1);
    g.translate(wx * 11000 * along + Math.cos(a) * 6500 * rr, top + R() * 500, wz * 11000 * along + Math.sin(a) * 6500 * rr);
    geos.push(g);
  }
  const ot = puffGeo(R, 2600, 0); ot.scale(1, 0.6, 1); ot.translate(0, top + 900, 0); geos.push(ot);
  const g = mergeGeos(geos);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 700) p.setY(i, 700);
  g.computeVertexNormals();
  return shadeByHeight(g, 6000, 0.4, 1.0);
}

// ---------- morze ----------
function seaGeometry() {
  // siatka biegunowa wokół jachtu: gęsta przy łodzi, coraz rzadsza ku horyzontowi
  const rings = 165, segs = 300, q = 1.042, r0 = 0.6; // promień ok. 12 km
  const pos = [], idx = [];
  pos.push(0, 0, 0);
  for (let i = 0; i < rings; i++) {
    const r = r0 * (Math.pow(q, i + 1) - 1) / (q - 1);
    for (let j = 0; j < segs; j++) { const a = (j / segs) * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < segs; j++) {
    const a = 1 + i * segs + j, b = 1 + i * segs + ((j + 1) % segs), c = a + segs, d = b + segs;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}
function seaMaterial(lq = false) {
  const waves = Array.from({ length: NW }, () => new THREE.Vector4());
  const wext = Array.from({ length: NW }, () => new THREE.Vector2());
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uW: { value: waves }, uWX: { value: wext },
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: C(0xfff3d6) }, uSunI: { value: 1 },
      uZen: { value: C(0x3f7fc8) }, uHor: { value: C(0xbcd6ea) }, uDeep: { value: C(0x0b2c40) }, uScat: { value: C(0x1f7f8a) },
      uFoam: { value: 0 }, uStreak: { value: 0 }, uRipple: { value: 0.2 }, uRough: { value: 0.1 }, uWind: { value: new THREE.Vector2(1, 0) },
      uFogCol: { value: C(0xbcd6ea) }, uFogD: { value: 0.0002 }, uCrestTh: { value: 0.8 }, uFlash: { value: 0 }, uSpd: { value: 5 }, uChop: { value: 0.5 }, uSig: { value: 0.1 }, uSlope: { value: 0.1 }, uPatchTh: { value: 9 }
    },
    vertexShader: `uniform float uTime; uniform vec4 uW[${NW}]; uniform vec2 uWX[${NW}];
      varying vec3 vW; varying vec3 vN; varying float vCrest; varying float vH;
      void main(){
        vec3 p = position;
        float r = length(p.xz);
        float sp = max(0.05, r * 0.042); // odstęp oczek siatki
        vec3 d = vec3(p.x, 0.0, p.z);
        vec3 n = vec3(0.0, 1.0, 0.0);
        float crest = 0.0, hsum = 0.0;
        float far = 1.0 - smoothstep(2500.0, 7000.0, r);
        for (int i = 0; i < ${NW}; i++){
          vec4 w = uW[i]; // dir.x, dir.z, k, A
          float lam = 6.2831853 / w.z;
          float fade = smoothstep(3.0 * sp, 7.0 * sp, lam) * far;
          float A = w.w * fade, Q = uWX[i].y;
          float th = w.z * (w.x * p.x + w.y * p.z) - uWX[i].x * uTime + float(i) * 1.7;
          float c = cos(th), s = sin(th);
          d.x += Q * A * w.x * c; d.z += Q * A * w.y * c; d.y += A * s;
          n.x -= w.x * w.z * A * c; n.z -= w.y * w.z * A * c; n.y -= Q * w.z * A * s;
          crest += Q * w.z * A * s;
          hsum += A;
        }
        vW = (modelMatrix * vec4(d, 1.0)).xyz;
        vN = normalize(n);
        vCrest = crest;
        vH = d.y / max(hsum, 0.001);
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
      }`,
    fragmentShader: `${lq ? '#define LQ\n' : ''}uniform float uTime, uSunI, uFoam, uStreak, uRipple, uRough, uFogD, uCrestTh, uFlash, uSpd, uChop, uSig, uSlope, uPatchTh; uniform vec3 uSun, uSunCol, uZen, uHor, uDeep, uScat, uFogCol; uniform vec2 uWind;
      varying vec3 vW; varying vec3 vN; varying float vCrest; varying float vH;
      ${NOISE}
      vec3 skyCol(vec3 r){ float y = clamp(r.y, 0.0, 1.0); return mix(uHor, uZen, pow(y, 0.55)); }
      void main(){
        vec3 V = cameraPosition - vW; float dist = length(V); V /= dist;
        // drobne zmarszczki: suma krótkich fal o kierunkach wokół wiatru (zanikają z odległością)
        vec3 n = vN;
        vec2 wd = uWind, wp = vec2(-wd.y, wd.x);
        vec2 P = vW.xz;
        float fw = length(fwidth(P)); // rozmiar piksela na powierzchni wody – drobniejsze zmarszczki wygaszamy (bez prążków)
        // zmarszczki i drobna fala z szumu (bez regularnych wzorów): gradient wysokości liczony różnicowo
        float paw = 0.3 + 1.1 * smoothstep(0.25, 0.75, vnoise(P * 0.018 - wd * uTime * 0.02 + 4.0)); // „kocie łapy”
        float e = max(0.04, fw * 0.6);
        vec2 a1 = P * 0.85 - wd * uTime * 0.55, a2 = P * 2.4 + wp * uTime * 0.25 - wd * uTime * 1.05, a3 = P * 0.21 - wd * uTime * 0.22;
        float k1 = (1.0 - smoothstep(0.25, 0.9, fw)), k2 = (1.0 - smoothstep(0.08, 0.32, fw)), k3 = (1.0 - smoothstep(1.2, 4.0, fw));
        vec2 gr = vec2(0.0);
        gr += (vec2(fbm3(a1 + vec2(e * 0.85, 0.0)), fbm3(a1 + vec2(0.0, e * 0.85))) - fbm3(a1)) / e * 0.55 * k1;
        #ifndef LQ
        gr += (vec2(fbm3(a2 + vec2(e * 2.4, 0.0)), fbm3(a2 + vec2(0.0, e * 2.4))) - fbm3(a2)) / e * 0.18 * k2;
        gr += (vec2(fbm3(a3 + vec2(e * 0.21, 0.0)), fbm3(a3 + vec2(0.0, e * 0.21))) - fbm3(a3)) / e * 2.2 * k3 * uChop;
        #endif
        n.xz -= gr * uRipple * paw;
        n = normalize(n);
        float NdV = max(dot(n, V), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
        vec3 R = reflect(-V, n);
        R.y = abs(R.y);
        vec3 refl = skyCol(R);
        // słońce: odblask (szerszy przy wzburzonym morzu)
        vec3 Hh = normalize(normalize(uSun) + V);
        float sh = mix(900.0, 90.0, uRough);
        float spec = pow(max(dot(n, Hh), 0.0), sh) * (sh + 8.0) / 25.0;
        // toń: rozproszenie światła w grzbietach fal
        float diff = max(dot(n, normalize(uSun)), 0.0) * 0.6 + 0.4;
        vec3 body = uDeep * (0.35 + 0.65 * diff) * (0.55 + 0.45 * uSunI);
        float sss = clamp(vH, 0.0, 1.0) * pow(max(dot(-V, normalize(uSun)) * 0.5 + 0.5, 0.0), 2.0);
        body += uScat * sss * (0.35 + uSunI * 0.4);
        vec3 col = mix(body, refl, fres);
        col += uSunCol * spec * uSunI * 1.3;
        // piana: białe grzywy na grzbietach, płaty pozostałej piany, pasma wzdłuż wiatru
        vec2 adv = P - wd * uTime * uSpd * 0.6;
        float fn = fbm(adv * 0.21);
        vec2 an = vec2(dot(adv, wd) * 0.45, dot(adv, wp)); // płaty wydłużone z wiatrem
        // „potencjał piany”: grzbiet (znormalizowany), zawietrzne zbocze i szum – próg dobrany do udziału białych grzyw w skali Beauforta
        float slope = clamp(dot(vN.xz, wd) / max(uSlope, 0.001), -1.5, 1.5);
        float F = vCrest / max(uSig, 0.001) + 0.7 * slope + (fbm(an * 0.14 + 3.0) - 0.5) * 5.0 + (fbm(an * 0.45 + 9.0) - 0.5) * 3.0 + (fbm(adv * 1.1 + 7.0) - 0.5) * 1.6 + (fbm(adv * 2.6 + 1.0) - 0.5) * 1.4;
        float th = uCrestTh * mix(1.0, 0.62, smoothstep(40.0, 450.0, dist));
        #ifdef LQ
        float lace = 0.6 + 0.4 * smoothstep(0.3, 0.7, fbm(adv * 3.5));
        #else
        float lace = smoothstep(0.08, 0.32, worley(adv * 1.4 + vec2(fbm3(adv * 0.7) * 1.5))) * 0.55 + 0.45 * smoothstep(0.3, 0.7, fbm(adv * 3.5));
        #endif
        float cap = smoothstep(th, th + 0.18, F) * mix(1.0, lace, 0.6);
        float patchF = smoothstep(uPatchTh, uPatchTh + 0.12, fbm(an * 0.05 + 11.0) + (fbm(adv * 0.6) - 0.5) * 0.3) * smoothstep(0.42, 0.72, fbm(adv * 1.6)) * lace * 0.55;
        vec2 sq = vec2(dot(adv, wd) * 0.025, dot(adv, wp) * 0.55);
        float streak = smoothstep(0.6, 0.85, fbm(sq) + fbm(sq * 3.1 + 5.0) * 0.22) * smoothstep(0.35, 0.65, fbm(adv * 0.035 + 2.0)) * uStreak;
        float foam = clamp(cap + patchF + streak * 0.85, 0.0, 1.0);
        foam *= 1.0 - smoothstep(600.0, 3500.0, dist) * 0.55;
        vec3 foamCol = mix(uHor, vec3(1.0), 0.65) * (0.62 + 0.38 * uSunI + 0.2 * diff);
        float tex = 0.5 + 0.5 * smoothstep(0.3, 0.7, fbm(an * 1.6 + adv * 0.5 + 21.0)); // smugi i prześwity w pianie
        col = mix(col, foamCol, foam * tex);
        col += vec3(0.6, 0.65, 0.8) * uFlash * 0.4;
        // zamglenie ku horyzontowi (bryzgi przy sztormie)
        float fog = 1.0 - exp(-dist * uFogD);
        col = mix(col, uFogCol, clamp(fog, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}

// widmo fal dla danej siły wiatru (12 składowych, kierunki wokół wiatru)
const LRAT = [1.0, 0.82, 1.22, 0.67, 0.55, 0.46, 0.38, 0.31, 0.25, 0.2, 0.16, 0.12];
const DOFF = [0, 0.32, -0.28, -0.55, 0.5, 0.85, -0.9, 0.18, -0.42, 1.15, -1.25, 0.7];
export function waveSpectrum(f, windTo, seed = 1) {
  const b = beaufort(f), R = rng(seed);
  const Tp = b.T, lp = (G * Tp * Tp) / (2 * Math.PI);
  const hs = f === 0 ? 0.05 : b.h;
  const w = LRAT.map((l) => Math.pow(l, 1.5));
  const sumW = Math.sqrt(w.reduce((s, v) => s + v * v, 0) / 2);
  const c = hs / (4 * sumW);
  const steep = Math.min(0.92, 0.35 + f * 0.055);
  return LRAT.map((l, i) => {
    const lam = lp * l, k = (2 * Math.PI) / lam, A = c * w[i];
    const dir = windTo + DOFF[i] + (R() - 0.5) * 0.12;
    return { dx: Math.sin(dir), dz: -Math.cos(dir), k, A, om: Math.sqrt(G * k), Q: Math.min(1, steep / (k * A * NW + 1e-6)), ph: i * 1.7, steep };
  });
}
// wysokość powierzchni w punkcie (x, z) – te same wzory co w shaderze (z odwróceniem przesunięcia poziomego)
export function seaHeight(W, x, z, t) {
  let px = x, pz = z;
  for (let it = 0; it < 3; it++) {
    let dx = 0, dz = 0;
    for (const w of W) { const th = w.k * (w.dx * px + w.dz * pz) - w.om * t + w.ph; const c = Math.cos(th); dx += w.Q * w.A * w.dx * c; dz += w.Q * w.A * w.dz * c; }
    px = x - dx; pz = z - dz;
  }
  let y = 0;
  for (const w of W) y += w.A * Math.sin(w.k * (w.dx * px + w.dz * pz) - w.om * t + w.ph);
  return y;
}

// ---------- bryzgi i deszcz ----------
function sprayPoints(n) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(n), 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uCol: { value: C(0xffffff) }, uPx: { value: 400 } },
    vertexShader: 'attribute float aA; attribute float aS; uniform float uPx; varying float vA; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aS * uPx / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uCol, a);\n#include <colorspace_fragment>\n}'
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  pts.userData.p = Array.from({ length: n }, () => ({ x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s: 1 }));
  return pts;
}
function rainLines(n) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc8d2dc, transparent: true, opacity: 0.35, depthWrite: false }));
  m.frustumCulled = false;
  m.userData.d = Array.from({ length: n }, () => ({ x: (Math.random() - 0.5) * 120, y: Math.random() * 40, z: (Math.random() - 0.5) * 120 }));
  return m;
}

// ---------- scena ----------
export class MeteoScene {
  constructor(container, opts = {}) {
    this.container = container;
    const gfx = getSettings().gfx || {};
    const r = new THREE.WebGLRenderer({ antialias: gfx.antialias !== false, preserveDrawingBuffer: !!opts.capture });
    r.setPixelRatio(Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2) * (gfx.scale || 1)));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.autoClear = false;
    r.domElement.style.width = '100%'; r.domElement.style.height = '100%'; r.domElement.style.display = 'block';
    container.appendChild(r.domElement);
    this.renderer = r;
    // dwie sceny: niebo (daleko, osobna kamera) i morze z jachtem
    this.skyScene = new THREE.Scene();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.2, 14000);
    this.skyCam = new THREE.PerspectiveCamera(55, 1, 20, 900000);
    this.dome = skyDome(); this.skyScene.add(this.dome);
    this.skySun = new THREE.DirectionalLight(0xffffff, 2); this.skyHemi = new THREE.HemisphereLight(0xdfe9f5, 0x55606a, 1.2);
    this.skyScene.add(this.skySun, this.skyHemi);
    this.skyScene.fog = new THREE.Fog(0xbcd6ea, 9000, 90000);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2); this.hemi = new THREE.HemisphereLight(0xcfe2f3, 0x2a3d4a, 1.1);
    this.scene.add(this.sun, this.hemi);
    this.sea = new THREE.Mesh(seaGeometry(), seaMaterial(gfx.water === 'low')); this.sea.frustumCulled = false;
    this.scene.add(this.sea);
    // jacht w dryfie (bez żagli) – punkt odniesienia do oceny wysokości fal
    const spec = BOATS.C34;
    this.boat = buildBoat(spec, { color: 0xffffff, stripe: 0x2f4468, ...boatIdentity(), noPlate: false });
    this.boatLen = spec.loa; this.boatBeam = spec.beam;
    this.scene.add(this.boat);
    this.spray = sprayPoints(900); this.scene.add(this.spray);
    this.rain = rainLines(1400); this.rain.visible = false; this.scene.add(this.rain);
    this.layers = []; this.cu = []; this.cbExtra = [];
    this.t = 0; this.motion = { pitch: 0, roll: 0, heave: 0, vp: 0, vr: 0 };
    this.view = 'orbit';
    this.cam = { az: 2.2, el: 0.16, dist: 26, yaw: 0, pitch: 0.12 };
    this.flash = 0; this.nextFlash = 5;
    this.initControls();
    this.setWeather(opts.weather || { bft: 4, windFrom: 250, hour: 12, clouds: 'Cu' });
    this.resize(); this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(container);
    this.running = !opts.manual; this.last = performance.now();
    const loop = (now) => { if (!this.running) return; this.update(Math.min(0.05, (now - this.last) / 1000)); this.last = now; requestAnimationFrame(loop); };
    if (this.running) requestAnimationFrame(loop);
  }

  // Pogoda: bft – siła wiatru, windFrom – skąd wieje [°], hour – godzina, clouds – rodzaj chmur (Ci…Cb) lub null, seed
  setWeather(w) {
    this.w = { bft: 4, windFrom: 250, hour: 12, clouds: null, seed: 1, ...w };
    const W = this.w, b = beaufort(W.bft);
    const windTo = ((W.windFrom + 180) % 360) * Math.PI / 180;
    this.windTo = windTo; this.windKn = bftKn(W.bft);
    this.waves = waveSpectrum(W.bft, windTo, W.seed);
    const u = this.sea.material.uniforms;
    this.waves.forEach((q, i) => { u.uW.value[i].set(q.dx, q.dz, q.k, q.A); u.uWX.value[i].set(q.om, q.Q); });
    u.uWind.value.set(Math.sin(windTo), -Math.cos(windTo));
    u.uFoam.value = b.foam; u.uStreak.value = b.streak;
    u.uRipple.value = W.bft === 0 ? 0.02 : [0, 0.22, 0.32, 0.4, 0.46, 0.5][W.bft] ?? 0.52;
    u.uChop.value = Math.min(1, 0.15 + W.bft * 0.1);
    u.uRough.value = Math.min(1, W.bft / 8);
    u.uSpd.value = this.windKn * 0.514 * 0.15;
    // grzbiet fali: suma Q·k·A·sin ≤ stromość; białe grzywy tam, gdzie fale się „spiętrzają” – im silniejszy wiatr, tym niższy próg
    const sig = Math.sqrt(this.waves.reduce((a, q) => a + (q.Q * q.k * q.A) ** 2, 0) / 2);
    u.uSig.value = sig; u.uSlope.value = Math.sqrt(this.waves.reduce((a, q) => a + (q.k * q.A) ** 2, 0) / 2);
    // odchylenie standardowe potencjału piany ≈ 1,35 → próg dla zadanego udziału białych grzyw
    u.uCrestTh.value = W.bft <= 2 ? 99 : 1.35 * zTail(Math.min(0.9, b.foam));
    u.uPatchTh.value = W.bft <= 4 ? 9 : 0.5 + 0.12 * zTail(Math.min(0.5, b.foam * 0.6));
    // niebo i chmury
    const R = rng(W.seed * 13 + 5);
    const sky = { Ci: [0, 1], Cc: [0.05, 0.95], Cs: [0.25, 0.7], Ac: [0.3, 0.75], As: [0.75, 0.2], Ns: [1, 0], Sc: [0.65, 0.35], St: [0.85, 0.05], Cu: [0.05, 1], Cb: [0.35, 0.75] }[W.clouds] || [0, 1];
    let over = sky[0], sunVis = sky[1];
    if (W.bft >= 8) { over = Math.max(over, 0.8); sunVis = Math.min(sunVis, 0.25); }
    this.over = over; this.sunVis = sunVis;
    const dark = W.clouds === 'Ns' ? 0.45 : W.clouds === 'Cb' ? 0.3 : W.bft >= 9 ? 0.35 : 0;
    const zen = C(0x2f6fbf).lerp(C(0x8a939e), over).lerp(C(0x4b525b), dark);
    const hor = C(0xc3d9ea).lerp(C(0xb6bdc5), over).lerp(C(0x737b84), dark);
    const haze = b.haze + (W.clouds === 'St' ? 0.25 : 0) + (W.clouds === 'Ns' ? 0.18 : 0);
    // słońce wg godziny (lato, ok. 55°N)
    const H = (W.hour - 13) * 15 * Math.PI / 180, lat = 55 * Math.PI / 180, dec = 20 * Math.PI / 180;
    const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
    const az = Math.PI + Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat));
    const sd = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    this.sunDir = sd;
    const du = this.dome.material.uniforms;
    du.uZen.value.copy(zen); du.uHor.value.copy(hor); du.uSun.value.copy(sd); du.uSunVis.value = sunVis;
    du.uSea.value.copy(C(0x1d3a4c).lerp(C(0x3a464e), over).lerp(hor, Math.min(0.8, haze * 1.4)));
    u.uSun.value.copy(sd); u.uSunI.value = 0.15 + 0.85 * sunVis;
    u.uZen.value.copy(zen); u.uHor.value.copy(hor);
    u.uDeep.value.copy(C(0x0a2a3d).lerp(C(0x1c2a31), over).lerp(C(0x121a20), dark));
    u.uScat.value.copy(C(0x1d8a93).lerp(C(0x3d6a6c), over));
    u.uFogCol.value.copy(hor); u.uFogD.value = 0.00012 + haze * 0.0011;
    this.skyScene.fog.color.copy(hor); this.skyScene.fog.far = 90000 * (1 - Math.min(0.85, haze * 1.5)); this.skyScene.fog.near = 6000 * (1 - Math.min(0.9, haze * 2));
    this.sun.intensity = 0.4 + 2.2 * sunVis; this.sun.position.copy(sd).multiplyScalar(100);
    this.hemi.color.copy(zen).lerp(C(0xffffff), 0.5); this.hemi.groundColor.copy(C(0x1d3a4c)); this.hemi.intensity = 0.9 + over * 0.6;
    this.skySun.intensity = 0.6 + 2.0 * sunVis; this.skySun.position.copy(sd).multiplyScalar(1000);
    this.skyHemi.color.copy(C(0xf2f6fb).lerp(zen, 0.25)); this.skyHemi.groundColor.copy(C(0x9aa6b2).lerp(C(0x3c444c), dark)); this.skyHemi.intensity = 1.5 - dark * 0.6;
    this.spray.material.uniforms.uCol.value.copy(C(0xffffff).lerp(hor, 0.35));
    this.sprayRate = b.spray;
    this.buildClouds(W.clouds, R, windTo, hor, dark);
    this.rain.visible = W.clouds === 'Ns';
    this.cbOn = W.clouds === 'Cb';
    // jacht ustawiony ok. 50° do wiatru
    this.boat.rotation.y = -(((W.windFrom + 50) % 360) - 90) * Math.PI / 180;
  }

  buildClouds(g, R, windTo, hor, dark) {
    for (const m of [...this.layers, ...this.cu, ...this.cbExtra]) { this.skyScene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.layers = []; this.cu = []; this.cbExtra = [];
    const layers = { Ci: [['Ci', 8800]], Cc: [['Cc', 7600]], Cs: [['Cs', 8300]], Ac: [['Ac', 3900]], As: [['As', 4300]], Ns: [['Ns', 1100], ['Fr', 480]], Sc: [['Sc', 1150]], St: [['St', 320]] }[g] || [];
    for (const [k, h] of layers) {
      const m = cloudLayer(k, h, windTo);
      m.material.uniforms.uSun.value.copy(this.sunDir); m.material.uniforms.uHor.value.copy(hor);
      m.material.uniforms.uDrift.value.set(R() * 1e5, R() * 1e5);
      if (k === 'Ns' || k === 'Fr' || k === 'St') m.material.uniforms.uLight.value = 1 - dark * 0.3;
      this.skyScene.add(m); this.layers.push(m);
    }
    // kłębiaste: Cu (ładna pogoda) i towarzyszące Cb
    const nCu = g === 'Cu' ? 34 : g === 'Cb' ? 10 : 0;
    const cuMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: true, emissive: 0x5d6673, emissiveIntensity: 0.3 });
    for (let i = 0; i < nCu; i++) {
      const w = 600 + R() * 1300;
      const geo = cumulusGeo(R, w, w * (0.55 + R() * 0.5));
      const m = new THREE.Mesh(geo, i ? cuMat : cuMat);
      const a = R() * Math.PI * 2, d = i < 4 ? 2200 + R() * 2500 : 3500 + Math.pow(R(), 0.7) * 26000;
      m.position.set(Math.cos(a) * d, 1000 + R() * 350, Math.sin(a) * d);
      m.rotation.y = R() * 6.28;
      this.skyScene.add(m); this.cu.push(m);
    }
    if (g === 'Cb') {
      const geo = cumulonimbusGeo(R, windTo);
      const mat = new THREE.MeshLambertMaterial({ color: 0xf2f4f7, vertexColors: true, flatShading: true, emissive: 0x3a414b, emissiveIntensity: 0.3 });
      const m = new THREE.Mesh(geo, mat);
      // Cb po stronie nawietrznej, w kadrze domyślnej kamery
      const a = Math.atan2(this.sunDir.x, -this.sunDir.z) + Math.PI + (R() - 0.5) * 0.7, d = 24000 + R() * 5000; // naprzeciw Słońca – oświetlona
      this.cbAz = a;
      m.position.set(Math.sin(a) * d, 0, -Math.cos(a) * d);
      this.skyScene.add(m); this.cu.push(m);
      this.cbPos = m.position.clone();
      // smugi ulewy pod podstawą
      const shaftMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        uniforms: { uHor: { value: hor.clone() }, uT: { value: 0 } },
        vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `uniform vec3 uHor; uniform float uT; varying vec2 vUv; varying vec3 vW; ${NOISE}
          void main(){ float s = fbm(vec2(vUv.x * 40.0 + vUv.y * 3.0, vUv.y * 2.0 - uT * 0.3));
            float a = (0.35 + 0.4 * s) * smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y)) * (0.6 + 0.4 * sin(vUv.x * 6.2831 * 3.0 + s * 4.0));
            gl_FragColor = vec4(mix(vec3(0.33, 0.36, 0.41), uHor, 0.25), clamp(a, 0.0, 0.85));
            #include <colorspace_fragment>
          }`
      });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(5200, 6400, 720, 32, 1, true), shaftMat);
      shaft.position.set(m.position.x, 330, m.position.z);
      this.skyScene.add(shaft); this.cbExtra.push(shaft);
      // błyskawica
      const bolt = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xf2f4ff, transparent: true, opacity: 0, fog: false }));
      this.skyScene.add(bolt); this.cbExtra.push(bolt); this.bolt = bolt;
    } else { this.bolt = null; }
  }

  setView(v) {
    this.view = v;
    this.boat.visible = v !== 'sky';
    if (v === 'sky') {
      const g = this.w.clouds, sunAz = Math.atan2(this.sunDir.x, -this.sunDir.z), sunEl = Math.asin(this.sunDir.y);
      // Cs i As: patrzymy w stronę Słońca (halo, słońce jak przez matowe szkło); Cu i Cb: nisko, nad horyzontem; warstwy: wyżej
      if (g === 'Cs' || g === 'As') Object.assign(this.cam, { yaw: sunAz + 0.35, pitch: Math.min(1.2, sunEl * 0.85) });
      else if (g === 'Cb') Object.assign(this.cam, { yaw: this.cbAz ?? this.windTo + Math.PI, pitch: 0.16 });
      else if (g === 'Cu') Object.assign(this.cam, { yaw: sunAz + Math.PI * 0.8, pitch: 0.2 });
      else Object.assign(this.cam, { yaw: this.windTo + Math.PI + 0.4, pitch: g === 'St' || g === 'Ns' ? 0.3 : 0.5 });
      this.camera.fov = 62; this.camera.updateProjectionMatrix();
    } else { this.camera.fov = 55; this.camera.updateProjectionMatrix(); }
  }

  initControls() {
    const el = this.renderer.domElement;
    let drag = null;
    const wheelKind = wheelClassifier();
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; this.orbit(dx, dy); });
    el.addEventListener('pointerup', () => { drag = null; });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (wheelKind(e) === 'pad') this.orbit(-e.deltaX * 0.9, -e.deltaY * 0.9);
      else this.zoom(e.deltaY * (e.ctrlKey ? 0.012 : 0.0012));
    }, { passive: false });
  }
  orbit(dx, dy) {
    if (this.view === 'sky') { this.cam.yaw -= dx * 0.004; this.cam.pitch = Math.max(-0.35, Math.min(1.45, this.cam.pitch + dy * 0.004)); }
    else { this.cam.az += dx * 0.005; this.cam.el = Math.max(0.03, Math.min(1.2, this.cam.el + dy * 0.004)); }
  }
  zoom(k) {
    k = Math.max(-0.5, Math.min(0.5, k));
    if (this.view === 'sky') { this.camera.fov = Math.max(25, Math.min(80, this.camera.fov * Math.exp(k))); this.camera.updateProjectionMatrix(); }
    else this.cam.dist = Math.max(9, Math.min(120, this.cam.dist * Math.exp(k)));
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    for (const c of [this.camera, this.skyCam]) { c.aspect = w / h; c.updateProjectionMatrix(); }
    this.spray.material.uniforms.uPx.value = h * this.renderer.getPixelRatio() * 0.6;
  }

  update(dt) {
    this.t += dt;
    const t = this.t, W = this.waves;
    this.sea.material.uniforms.uTime.value = t;
    // kołysanie jachtu: wysokość fali na dziobie, rufie i burtach (z bezwładnością)
    const th = this.boat.rotation.y, cx = Math.cos(-th), sz = Math.sin(-th);
    const L2 = this.boatLen * 0.42, B2 = this.boatBeam * 0.45;
    const hb = seaHeight(W, cx * L2, sz * L2, t), hs = seaHeight(W, -cx * L2, -sz * L2, t);
    const hp = seaHeight(W, sz * B2, -cx * B2, t), hst = seaHeight(W, -sz * B2, cx * B2, t);
    const m = this.motion, k = Math.min(1, dt * 3.2);
    const wantP = Math.atan2(hb - hs, 2 * L2) * 0.85, wantR = Math.atan2(hp - hst, 2 * B2) * 0.55 + Math.sin(t * 0.7) * 0.01 * this.w.bft;
    m.pitch += (wantP - m.pitch) * k; m.roll += (wantR - m.roll) * k * 0.8;
    m.heave += ((hb + hs + hp + hst) / 4 - m.heave) * Math.min(1, dt * 4);
    const heel = this.boat.userData.heel;
    this.boat.position.y = m.heave - 0.05;
    heel.rotation.set(m.roll, 0, m.pitch);
    // kamera
    const tgt = new THREE.Vector3(0, m.heave + 2.2, 0);
    if (this.view === 'sky') {
      const p = new THREE.Vector3(0, m.heave + 3, 0);
      this.camera.position.copy(p);
      const c = this.cam;
      this.camera.lookAt(p.x + Math.sin(c.yaw) * Math.cos(c.pitch), p.y + Math.sin(c.pitch), p.z - Math.cos(c.yaw) * Math.cos(c.pitch));
    } else {
      const c = this.cam;
      const p = new THREE.Vector3(Math.cos(c.el) * Math.cos(c.az) * c.dist, Math.sin(c.el) * c.dist + 2, Math.cos(c.el) * Math.sin(c.az) * c.dist);
      p.y = Math.max(p.y, seaHeight(W, p.x, p.z, t) + 1.2);
      this.camera.position.copy(p); this.camera.lookAt(tgt);
    }
    this.skyCam.position.copy(this.camera.position); this.skyCam.quaternion.copy(this.camera.quaternion);
    this.skyCam.fov = this.camera.fov; this.skyCam.updateProjectionMatrix();
    // chmury dryfują z wiatrem
    const drift = this.windKn * 0.514 * 1.6 * dt;
    for (const l of this.layers) { const d = l.material.uniforms.uDrift.value; d.x -= Math.sin(this.windTo) * drift; d.y += Math.cos(this.windTo) * drift; l.position.x = this.camera.position.x; l.position.z = this.camera.position.z; }
    this.updateSpray(dt);
    if (this.rain.visible) this.updateRain(dt);
    if (this.cbOn) this.updateLightning(dt);
    const r = this.renderer;
    r.clear();
    r.render(this.skyScene, this.skyCam);
    r.clearDepth();
    r.render(this.scene, this.camera);
  }

  updateSpray(dt) {
    const P = this.spray.userData.p, pos = this.spray.geometry.attributes.position, aA = this.spray.geometry.attributes.aA, aS = this.spray.geometry.attributes.aS;
    const wx = Math.sin(this.windTo), wz = -Math.cos(this.windTo), ws = this.windKn * 0.514;
    let spawn = this.sprayRate * 260 * dt;
    const hMax = Math.max(0.2, beaufort(this.w.bft).h * 0.5);
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p.life <= 0) {
        if (spawn <= 0) { aA.array[i] = 0; continue; }
        // losowy punkt w promieniu ok. 140 m; bryzgi rodzą się tylko na grzbietach
        const a = Math.random() * Math.PI * 2, d = 6 + Math.sqrt(Math.random()) * 140;
        const x = this.camera.position.x * 0.3 + Math.cos(a) * d, z = this.camera.position.z * 0.3 + Math.sin(a) * d;
        const y = seaHeight(this.waves, x, z, this.t);
        if (y < hMax * 0.55) { spawn -= 0.25; aA.array[i] = 0; continue; }
        spawn -= 1;
        Object.assign(p, { x, y, z, vx: wx * ws * (0.4 + Math.random() * 0.4), vy: 1 + Math.random() * 2.5, vz: wz * ws * (0.4 + Math.random() * 0.4), life: 0.9 + Math.random() * 1.6, s: 0.5 + Math.random() * 1.2 });
        p.max = p.life;
      }
      p.life -= dt; p.vy -= 3.2 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = p.life / p.max;
      pos.setXYZ(i, p.x, p.y, p.z);
      aA.array[i] = Math.max(0, Math.sin(k * Math.PI)) * 0.55;
      aS.array[i] = p.s * (1.6 - k) * (1 + this.w.bft * 0.12);
    }
    pos.needsUpdate = true; aA.needsUpdate = true; aS.needsUpdate = true;
  }

  updateRain(dt) {
    const D = this.rain.userData.d, pos = this.rain.geometry.attributes.position;
    const c = this.camera.position, wx = Math.sin(this.windTo) * 3, wz = -Math.cos(this.windTo) * 3;
    for (let i = 0; i < D.length; i++) {
      const d = D[i];
      d.y -= 11 * dt; d.x += wx * dt; d.z += wz * dt;
      if (d.y < -2 || Math.abs(d.x) > 60 || Math.abs(d.z) > 60 || Math.hypot(d.x, d.z) < 12) { const a = Math.random() * 6.283, rr = 12 + Math.random() * 48; d.x = Math.cos(a) * rr; d.z = Math.sin(a) * rr; d.y = 10 + Math.random() * 30; }
      pos.setXYZ(i * 2, c.x + d.x, d.y, c.z + d.z);
      pos.setXYZ(i * 2 + 1, c.x + d.x - wx * 0.06, d.y + 0.7, c.z + d.z - wz * 0.06);
    }
    pos.needsUpdate = true;
  }

  updateLightning(dt) {
    this.nextFlash -= dt;
    if (this.nextFlash <= 0 && this.cbPos) {
      this.nextFlash = 4 + Math.random() * 9; this.flash = 0.35;
      const pts = [], b = this.cbPos;
      let x = b.x + (Math.random() - 0.5) * 3000, z = b.z + (Math.random() - 0.5) * 3000, y = 650;
      pts.push(new THREE.Vector3(x, y, z));
      while (y > 0) { y -= 60 + Math.random() * 90; x += (Math.random() - 0.5) * 160; z += (Math.random() - 0.5) * 160; pts.push(new THREE.Vector3(x, Math.max(0, y), z)); }
      this.bolt.geometry.dispose(); this.bolt.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    }
    if (this.flash > 0) this.flash -= dt;
    const f = Math.max(0, this.flash) / 0.35, fl = f * f * (0.6 + 0.4 * Math.sin(this.t * 90));
    if (this.bolt) this.bolt.material.opacity = f > 0.2 ? 1 : 0;
    this.dome.material.uniforms.uFlash.value = fl * 0.18;
    this.sea.material.uniforms.uFlash.value = fl * 0.12;
    for (const c of this.cu) if (c.material.emissive) c.material.emissiveIntensity = 0.25 + fl * 1.2;
  }

  // klatka do miniaturki (np. w podręczniku)
  snapshot(w = 480, h = 270) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    this.update(0.016);
    cv.getContext('2d').drawImage(this.renderer.domElement, 0, 0, w, h);
    return cv.toDataURL('image/jpeg', 0.85);
  }

  destroy() {
    this.running = false;
    this._ro && this._ro.disconnect();
    this.skyScene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
