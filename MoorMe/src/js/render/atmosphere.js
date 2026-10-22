// Pora dnia i pogoda: słońce/księżyc, kolory nieba, gwiazdy, chmury, deszcz, mgła,
// światła nawigacyjne jachtów, latarnie uliczne, latarnie morskie, oświetlone okna.
import * as THREE from 'three';
import { cachedMaterials, sheerHeight } from './boatModel.js';
import { hullExtents, halfBeamAt } from '../data/boats.js';
import { LINE_MATS } from './boatModel.js';
import { clamp, DEG, rng } from '../math.js';
import { SECTORS } from '../data/shipLights.js';

export const SKIES = {
  clear: { name: 'Słonecznie', sun: 1, hemi: 1, grey: 0, fog: [220, 620], rain: 0 },
  cloudy: { name: 'Pochmurno', sun: 0.35, hemi: 1.05, grey: 0.55, fog: [170, 520], rain: 0 },
  rain: { name: 'Deszcz', sun: 0.15, hemi: 0.85, grey: 0.75, fog: [80, 330], rain: 1 },
  fog: { name: 'Mgła', sun: 0.25, hemi: 1.0, grey: 0.6, fog: [6, 115], rain: 0 }
};

const C = (h) => new THREE.Color(h);
const lerpC = (a, b, t) => a.clone().lerp(b, clamp(t, 0, 1));

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

let dotTex = null;
function dotTexture() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

function glow(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(size);
  s.userData.size = size;
  return s;
}

export class Atmosphere {
  constructor(view, weather) {
    this.view = view;
    this.world = view.world;
    this.scene = view.scene;
    this.hour = typeof weather.hour === 'number' ? weather.hour : 14;
    this.blackSky = !!weather.blackSky; // tryb świateł: czarne niebo bez gwiazd, przygaszony księżyc
    this.sky = SKIES[weather.sky] ? weather.sky : 'clear';
    this.timeFlows = false;
    this.timeRate = 60; // 1 s rzeczywista = 1 min w symulacji
    this.night = 0;
    this.glows = [];
    this.buildStars();
    this.buildRain();
    this.buildBoatLights();
    this.buildHarbourLights();
    this.windowMats = cachedMaterials().filter((m) => [0x243447, 0x2c3e50].includes(m.color.getHex()));
    this.boatWindowMats = cachedMaterials().filter((m) => [0x16202b, 0x1b2632].includes(m.color.getHex()));
    this.lampMats = cachedMaterials().filter((m) => [0xfff5d6, 0xfff2b0].includes(m.color.getHex()));
    this.free = 1;
    this.mv = 0; // wygładzony stan „jacht w ruchu” (0–1)
  }

  setHour(h) { this.hour = ((h % 24) + 24) % 24; }
  setSky(k) { if (SKIES[k]) this.sky = k; }

  buildStars() {
    const r = rng(77);
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, e = Math.asin(0.08 + r() * 0.92);
      pos[i * 3] = Math.cos(a) * Math.cos(e) * 1100;
      pos[i * 3 + 1] = Math.sin(e) * 1100;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 1100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 10), new THREE.MeshBasicMaterial({ color: 0xf2f0e6, fog: false, transparent: true, opacity: 0 }));
    this.moon = moon;
    this.scene.add(moon);
    // tarcza słońca z poświatą (widoczna nisko nad horyzontem – zachody i wschody)
    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const sg = sc.getContext('2d'), gr = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.14, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.7)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    sg.fillStyle = gr; sg.fillRect(0, 0, 128, 128);
    const stex = new THREE.CanvasTexture(sc);
    this.sunDisk = new THREE.Sprite(new THREE.SpriteMaterial({ map: stex, color: 0xffe2b0, fog: false, transparent: true, depthWrite: false, opacity: 0 }));
    this.sunDisk.scale.set(260, 260, 1);
    this.scene.add(this.sunDisk);
    this.buildClouds();
  }

  buildRain() {
    const n = 1800;
    this.rainN = n;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaebfcc, transparent: true, opacity: 0.45 }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    const r = rng(9);
    this.drops = Array.from({ length: n }, () => ({ x: (r() - 0.5) * 90, y: r() * 30, z: (r() - 0.5) * 90 }));
    this.scene.add(this.rain);
  }

  // Światła nawigacyjne naszego jachtu i światła kotwiczne sąsiadów
  buildBoatLights() {
    const v = this.view, spec = this.world.spec;
    const heel = v.boat.userData.heel;
    const { xs, xb } = hullExtents(spec);
    const L = spec.loa;
    const pbx = xb - 0.05 * L, py = sheerHeight(spec, pbx) + 0.66;
    const add = (parent, color, size, x, y, z) => { const s = glow(color, size); s.material.map = dotTexture(); s.material.depthTest = false; s.userData.dot = true; s.position.set(x, y, z); parent.add(s); this.glows.push(s); return s; };
    // światła nawigacyjne (burtowe i rufowe) palą się tylko w ruchu – zacumowany jacht ma je wyłączone
    const sec = (s, k) => { s.userData.sector = k; return s; }; // sektory jak w MPZZM: burtowe 112,5°, rufowe 135°, masztowe 225°
    sec(add(heel, 0xff2a2a, 1.4, pbx, py, -halfBeamAt(spec, pbx) + 0.08), 'port').userData.mode = 'moving'; // lewa – czerwone
    sec(add(heel, 0x22ff66, 1.4, pbx, py, halfBeamAt(spec, pbx) - 0.08), 'stbd').userData.mode = 'moving'; // prawa – zielone
    sec(add(heel, 0xffffff, 1.3, xs + 0.1, sheerHeight(spec, xs) + 0.9, 0), 'stern').userData.mode = 'moving'; // rufowe
    // światło kotwiczne (topowe, dookólne) – gdy jacht stoi; światło silnikowe (białe, w połowie masztu) – w ruchu
    add(heel, 0xffffff, 1.6, 0.1 * L, v.boat.userData.mastTop + 0.2, 0).userData.mode = 'anchor';
    const sp = v.boat.userData.steamPos;
    sec(add(heel, 0xfff6e0, 1.5, sp[0], sp[1], sp[2]), 'mast').userData.mode = 'moving';
    // światło salingowe oświetlające pokład (prawdziwe źródło światła)
    this.deckLight = new THREE.PointLight(0xfff1d6, 0, 14, 1.6);
    const perch = v.boat.userData.perches && v.boat.userData.perches[0];
    this.deckLight.position.set(0.1 * L, perch ? perch[1] - 0.3 : 6, 0);
    heel.add(this.deckLight);
    // zacumowani sąsiedzi nie mają świateł nawigacyjnych ani kotwicznych
  }

  buildHarbourLights() {
    const hb = this.view.harbor;
    this.lamps = hb.lamps || [];
    for (const l of this.lamps) {
      const s = glow(0xffd28a, 1.2); // mała, delikatna kula wokół lampy
      s.position.set(l.x, l.y, l.z);
      s.userData.far = true; // powiększany z odległością, żeby dalekie latarnie też były widoczne
      s.userData.dim = 0.55;
      this.scene.add(s);
      this.glows.push(s);
    }
    // plamy światła na ziemi pod KAŻDĄ latarnią (tanie – jedna instancjonowana siatka), niezależnie od odległości od kamery
    if (this.lamps.length) {
      const pg = new THREE.PlaneGeometry(1, 1);
      pg.rotateX(-Math.PI / 2);
      this.poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffc98a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      this.pools = new THREE.InstancedMesh(pg, this.poolMat, this.lamps.length);
      const m4 = new THREE.Matrix4();
      this.lamps.forEach((l, i) => { m4.makeScale(11, 1, 11).setPosition(l.x, l.y - 4.1 + 0.07, l.z); this.pools.setMatrixAt(i, m4); });
      this.pools.frustumCulled = false;
      this.pools.renderOrder = 2;
      this.scene.add(this.pools);
    }
    // pula kilku prawdziwych świateł przypisywanych do najbliższych latarni
    this.lampLights = [0, 1, 2].map(() => {
      const p = new THREE.PointLight(0xffc98a, 0, 22, 1.8);
      this.scene.add(p);
      return p;
    });
    // latarnie morskie: światło + obracający się snop
    // światła główek portu: stałe, dookólne (bez obracającego się snopa)
    this.beacons = (hb.lighthouses || []).map((lh) => {
      const s = glow(lh.color, 6);
      s.position.set(lh.x, lh.y, lh.z);
      s.userData.far = true;
      this.scene.add(s);
      this.glows.push(s);
      return { glow: s };
    });
  }

  // Wysokość słońca [rad] i kierunek (kompas) w zależności od godziny
  sunAngles(h) {
    const el = 58 * Math.sin((Math.PI * (h - 6)) / 12) * DEG;
    const az = (90 + ((h - 6) / 12) * 180) * DEG;
    return { el, az };
  }

  update(dt, camDt = dt) {
    if (this.timeFlows) this.setHour(this.hour + (dt * this.timeRate) / 3600);
    const v = this.view, sky = SKIES[this.sky];
    const { el, az } = this.sunAngles(this.hour);
    const elDeg = el / DEG;
    // 0 = dzień, 1 = noc (zmierzch płynnie między +4° a -8°)
    const night = clamp((4 - elDeg) / 12, 0, 1);
    const dusk = clamp(1 - Math.abs(elDeg - 1) / 9, 0, 1) * (1 - sky.grey * 0.7); // zachód/wschód
    this.night = night;

    // kolory nieba
    const dayTop = C(0x5aa6dd), dayBot = C(0xd6ecf7);
    const duskTop = C(0x4a5f9a), duskBot = C(0xf2a066);
    const nightTop = C(0x040916), nightBot = C(0x14203a);
    let top = lerpC(dayTop, duskTop, dusk), bot = lerpC(dayBot, duskBot, dusk);
    top = lerpC(top, nightTop, night); bot = lerpC(bot, nightBot, night);
    const grey = lerpC(C(0x9aa4ad), C(0x1c232b), night);
    top = lerpC(top, grey, sky.grey); bot = lerpC(bot, grey.clone().offsetHSL(0, 0, 0.06), sky.grey);
    if (this.blackSky) { top = lerpC(top, C(0x000000), night); bot = lerpC(bot, C(0x010203), night); }
    if (this.sky === 'fog') { bot = lerpC(bot, lerpC(C(0xc9ced2), C(0x2a3038), night), 0.85); top = lerpC(top, bot, 0.6); }
    this.paintSky(top, bot, az, dusk);
    this.scene.background = bot;
    this.updateClouds(camDt, this.view.camera.position, night, dusk, sky);
    this.scene.fog.color.copy(bot);
    const fogK = night > 0.5 && this.sky === 'clear' ? 0.8 : 1;
    // w rejsie nocą widoczność spada do kilkuset metrów – z daleka widać tylko światła pław (sprite'y bez mgły)
    const fs = 1 + ((this.view.fogScale || 1) - 1) * (1 - 0.86 * night);
    this.scene.fog.near = sky.fog[0] * fogK * fs;
    this.scene.fog.far = sky.fog[1] * fogK * fs;

    // słońce albo księżyc (to samo światło kierunkowe – cienie także nocą)
    const cam = v.cam;
    let dir;
    const sun = v.sun;
    if (night < 0.98) {
      dir = new THREE.Vector3(Math.sin(az) * Math.cos(Math.max(el, 0.05)), Math.sin(Math.max(el, 0.05)), -Math.cos(az) * Math.cos(Math.max(el, 0.05)));
      sun.color.copy(lerpC(C(0xfff0d8), C(0xffa060), clamp(1 - elDeg / 14, 0, 1)));
      sun.intensity = 2.7 * sky.sun * clamp(elDeg / 12, 0, 1) * (1 - night);
    }
    if (night > 0.5) {
      dir = new THREE.Vector3(-0.45, 0.75, 0.5).normalize();
      sun.color.set(0x9fb4e0);
      sun.intensity = 0.35 * sky.sun * night + 0.05;
    }
    sun.position.set(cam.tx + dir.x * 130, dir.y * 130, cam.tz + dir.z * 130);
    sun.target.position.set(cam.tx, 0, cam.tz);
    {
      const sd = this.sunDisk, e = Math.max(el, -0.04);
      sd.position.set(cam.tx + Math.sin(az) * Math.cos(e) * 1000, Math.sin(e) * 1000, cam.tz - Math.cos(az) * Math.cos(e) * 1000);
      sd.material.color.copy(lerpC(C(0xfff4dc), C(0xffa055), clamp(1 - elDeg / 12, 0, 1)));
      sd.material.opacity = clamp((elDeg + 1.5) / 3, 0, 1) * (1 - sky.grey) * (this.blackSky ? 0 : 1);
      sd.visible = sd.material.opacity > 0.01;
    }
    this.moon.position.set(cam.tx - 0.45 * 900, 0.75 * 900, cam.tz + 0.5 * 900);
    this.moon.material.opacity = night * (1 - sky.grey) * (this.blackSky ? 0.45 : 1); // w trybie świateł księżyc przygaszony
    this.moon.visible = night > 0.05;

    v.hemi.color.copy(lerpC(C(0xdff2ff), C(0x2c3a5c), night));
    v.hemi.groundColor.copy(lerpC(C(0x4a5a44), C(0x0c1016), night));
    v.hemi.intensity = (0.8 * (1 - night) + 0.32 * night) * sky.hemi;
    v.renderer.toneMappingExposure = 1.05 + night * 0.35;

    // woda przygaszona przy szarym niebie
    const wm = v.water.mesh.material;
    wm.color.copy(lerpC(C(0xffffff), C(0x9fa9b0), sky.grey * (this.sky === 'fog' ? 0.9 : 0.6)));

    // relingi i wanty: stalowe, nocą prawie czarne (bez świecenia)
    for (const l of Object.values(LINE_MATS)) l.mat.color.setHex(l.base).multiplyScalar(1 - 0.9 * night);

    this.stars.material.opacity = this.blackSky ? 0 : night * (1 - sky.grey) * 0.9;
    this.stars.position.set(cam.tx, 0, cam.tz);

    // światła: nawigacyjne, latarnie, okna – włączają się o zmierzchu (i w mgle/deszczu trochę wcześniej)
    const lightsOn = clamp(night * 1.3 + (sky.grey > 0.5 ? 0.25 : 0) - 0.05, 0, 1);
    this.lightsOn = lightsOn;
    const bt = this.world.boat;
    // histereza + w rejsie jacht zawsze jest w drodze – bez migotania świateł masztowych
    const spd = Math.hypot(bt.vx || 0, bt.vz || 0);
    this._mvState = this.world.isPassage || spd > (this._mvState ? 0.12 : 0.3) || Math.abs(bt.throttle || 0) > (this._mvState ? 0.02 : 0.05);
    const movingNow = this._mvState;
    this.mv += ((movingNow ? 1 : 0) - this.mv) * clamp(camDt * 3, 0, 1);
    const moored = this.world.lines.some((l) => l.state === 'attached' && !l.isMooring);
    this.free += ((moored ? 0 : 1) - this.free) * clamp(camDt * 3, 0, 1);
    const wp = new THREE.Vector3();
    // kąt, pod jakim kamera widzi jacht (od dziobu, + na prawą burtę) – światła świecą tylko w swoich sektorach
    const cp = this.view.camera.position, th = bt.th || 0;
    const ddx = cp.x - bt.x, ddz = cp.z - bt.z;
    const relCam = Math.atan2(ddx * -Math.sin(th) + ddz * Math.cos(th), ddx * Math.cos(th) + ddz * Math.sin(th)) / DEG;
    for (const g of this.glows) {
      let k = lightsOn;
      if (g.userData.sector && !SECTORS[g.userData.sector](relCam)) k = 0;
      if (g.userData.mode === 'moving') k *= this.mv;
      else if (g.userData.mode === 'anchor') k *= (1 - this.mv) * this.free; // kotwiczne: tylko gdy jacht nie stoi przy kei
      g.visible = k > 0.02;
      g.material.opacity = k * (g.userData.dim || 1);
      let sc = g.userData.size * (0.6 + 0.4 * lightsOn);
      if (g.userData.far) { g.getWorldPosition(wp); sc *= clamp(this.view.camera.position.distanceTo(wp) / 80, 1, 3); }
      if (g.userData.dot) { g.getWorldPosition(wp); sc = clamp(this.view.camera.position.distanceTo(wp) * 0.008, 0.14, 3); }
      g.scale.setScalar(sc);
    }
    for (const m of this.boatWindowMats) {
      m.emissive.setHex(0xffc27a);
      m.emissiveIntensity = lightsOn * 0.28; // okna jachtów – przyciemnione
    }
    if (this.poolMat) this.poolMat.opacity = lightsOn * 0.42;
    for (const m of this.lampMats) {
      m.emissive.setHex(0xffd890);
      m.emissiveIntensity = lightsOn * 2.2;
    }
    for (const m of this.windowMats) {
      m.emissive.setHex(0xffc27a);
      m.emissiveIntensity = lightsOn * 0.75;
    }
    this.deckLight.intensity = lightsOn * 6;
    // najbliższe kamerze latarnie dostają prawdziwe światło
    if (this.lamps.length) {
      const near = [...this.lamps].sort((a, b) => Math.hypot(a.x - cam.tx, a.z - cam.tz) - Math.hypot(b.x - cam.tx, b.z - cam.tz));
      this.lampLights.forEach((p, i) => {
        const l = near[i];
        p.position.set(l.x, l.y - 0.3, l.z);
        p.intensity = lightsOn * 30;
      });
    }
    // deszcz
    this.rain.visible = sky.rain > 0;
    if (this.rain.visible) this.updateRain(dt, cam);
  }

  // miękka „kłębiasta” tekstura chmury: dużo rozmytych plam, jaśniejsza u góry, brzegi wtapiają się w niebo
  cloudTexture(seed) {
    let a = seed >>> 0; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
    const S = 256, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    for (let i = 0; i < 70; i++) {
      const ang = r() * Math.PI * 2, rr = Math.pow(r(), 0.7) * 0.32;
      const x = S / 2 + Math.cos(ang) * rr * S * 1.15, y = S / 2 + Math.sin(ang) * rr * S * 0.55 - S * 0.03;
      const rad = S * (0.07 + r() * 0.13) * (1 - rr);
      const shade = 225 + Math.round(30 * (1 - (y / S)));
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${shade},${shade},${Math.min(255, shade + 6)},0.32)`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
    // lekko ciemniejszy spód
    g.globalCompositeOperation = 'source-atop';
    const v = g.createLinearGradient(0, S * 0.3, 0, S * 0.8);
    v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(120,135,160,0.35)');
    g.fillStyle = v; g.fillRect(0, 0, S, S);
    const tex = new THREE.CanvasTexture(cv);
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // chmury: każda z kilku przenikających się miękkich, półprzezroczystych kłębów (sprite’y), wokół kamery, dryfują z wiatrem
  buildClouds() {
    const r = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
    this.cloudMats = [11, 222, 3333].map((sd) => new THREE.SpriteMaterial({ map: this.cloudTexture(sd), transparent: true, opacity: 0.8, fog: false, depthWrite: false }));
    this.clouds = [];
    const g = new THREE.Group();
    for (let i = 0; i < 40; i++) {
      const c = new THREE.Group(), size = 45 + r() * 95, n = 4 + Math.floor(r() * 5);
      for (let k = 0; k < n; k++) {
        const sp = new THREE.Sprite(this.cloudMats[Math.floor(r() * this.cloudMats.length)]);
        const sc = size * (0.9 + r() * 0.9);
        sp.scale.set(sc * 2, sc * (0.85 + r() * 0.35), 1);
        sp.position.set((r() - 0.5) * size * 2, (r() - 0.3) * size * 0.3, (r() - 0.5) * size * 0.8);
        c.add(sp);
      }
      const far = this.view.passage ? 2200 : 950; // w porcie kopuła nieba ma promień 1200 m
      const a = r() * Math.PI * 2, d = 300 + r() * (far - 300);
      c.userData = { ox: Math.cos(a) * d, oz: Math.sin(a) * d, y: 170 + r() * 170, k: r(), size };
      c.renderOrder = -5;
      g.add(c);
      this.clouds.push(c);
    }
    this.cloudGroup = g;
    this.scene.add(g);
    this.cloudDrift = { x: 0, z: 0 };
  }

  updateClouds(dt, cam, night, dusk, sky) {
    const n = { clear: 20, cloudy: 34, rain: 40, fog: 0 }[this.sky] ?? 14;
    const show = !this.blackSky && n > 0;
    this.cloudGroup.visible = show;
    if (!show) return;
    const wv = this.world && this.world.env ? this.world.env.windVec() : { x: 2, z: 0 };
    this.cloudDrift.x += wv.x * dt * 0.6; this.cloudDrift.z += wv.z * dt * 0.6;
    const span = this.view.passage ? 4400 : 1900;
    // kolor: biel w dzień, brzoskwinia o zachodzie, szarość przy złej pogodzie, granat nocą (sprite’y nie są oświetlane – kolor liczymy sami)
    const base = lerpC(lerpC(C(0xffffff), C(0xffc2a0), dusk), C(0x9aa2ab), sky.grey);
    const col = lerpC(base, C(0x2a3346), night);
    const op = (this.sky === 'clear' ? 0.72 : 0.85) * (1 - night * 0.55);
    for (const m of this.cloudMats) { m.color.copy(col); m.opacity = op; }
    const big = this.sky === 'clear' ? 0.8 : 1.25;
    this.clouds.forEach((c, i) => {
      const u = c.userData;
      c.visible = i < n;
      if (!c.visible) return;
      let x = u.ox + this.cloudDrift.x, z = u.oz + this.cloudDrift.z;
      x = ((x % span) + span * 1.5) % span - span / 2; z = ((z % span) + span * 1.5) % span - span / 2;
      const dd = Math.hypot(x, z), lim = span / 2 - 50; if (dd > lim) { x *= lim / dd; z *= lim / dd; }
      c.position.set(cam.x + x, u.y * (this.sky === 'clear' ? 1 : 0.85), cam.z + z);
      c.scale.setScalar(big);
    });
  }

  paintSky(top, bot, az = 0, dusk = 0) {
    const key = top.getHex() * 7 + bot.getHex() + Math.round(az * 20) * 13 + Math.round(dusk * 20);
    if (key === this._skyKey) return;
    this._skyKey = key;
    const geo = this.view.sky.geometry;
    const pos = geo.attributes.position, col = geo.attributes.color;
    const glow = C(0xffb27a), sx = Math.sin(az), sz = -Math.cos(az);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), L = Math.hypot(x, y, z) || 1;
      const t = clamp(y / 1200, 0, 1);
      const c = bot.clone().lerp(top, Math.pow(t, 0.6));
      // ciepła poświata przy horyzoncie od strony słońca (zachód / wschód)
      const toward = Math.max(0, (x * sx + z * sz) / L);
      const k = dusk * Math.pow(toward, 3) * (1 - t) * 0.75;
      if (k > 0.001) c.lerp(glow, k);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  updateRain(dt, cam) {
    const wv = this.world.env.windVec();
    const p = this.rain.geometry.attributes.position.array;
    const fall = 11;
    for (let i = 0; i < this.rainN; i++) {
      const d = this.drops[i];
      d.y -= fall * dt;
      d.x += wv.x * dt * 0.5;
      d.z += wv.z * dt * 0.5;
      if (d.y < 0 || Math.abs(d.x - cam.tx) > 45 || Math.abs(d.z - cam.tz) > 45) {
        d.y = 20 + Math.random() * 12;
        d.x = cam.tx + (Math.random() - 0.5) * 90;
        d.z = cam.tz + (Math.random() - 0.5) * 90;
      }
      const k = 0.06;
      p[i * 6] = d.x; p[i * 6 + 1] = d.y; p[i * 6 + 2] = d.z;
      p[i * 6 + 3] = d.x - wv.x * k; p[i * 6 + 4] = d.y + fall * k * 0.9; p[i * 6 + 5] = d.z - wv.z * k;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }
}
