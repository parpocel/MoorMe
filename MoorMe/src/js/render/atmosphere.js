// Pora dnia i pogoda: słońce/księżyc, kolory nieba, gwiazdy, chmury, deszcz, mgła,
// światła nawigacyjne jachtów, latarnie uliczne, latarnie morskie, oświetlone okna.
import * as THREE from 'three';
import { cachedMaterials, sheerHeight } from './boatModel.js';
import { hullExtents, halfBeamAt } from '../data/boats.js';
import { LINE_MATS } from './boatModel.js';
import { clamp, DEG, rng } from '../math.js';

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
    const add = (parent, color, size, x, y, z) => { const s = glow(color, size); s.position.set(x, y, z); parent.add(s); this.glows.push(s); return s; };
    // światła nawigacyjne (burtowe i rufowe) palą się tylko w ruchu – zacumowany jacht ma je wyłączone
    add(heel, 0xff2a2a, 1.4, pbx, py, -halfBeamAt(spec, pbx) + 0.08).userData.mode = 'moving'; // lewa – czerwone
    add(heel, 0x22ff66, 1.4, pbx, py, halfBeamAt(spec, pbx) - 0.08).userData.mode = 'moving'; // prawa – zielone
    add(heel, 0xffffff, 1.3, xs + 0.1, sheerHeight(spec, xs) + 0.9, 0).userData.mode = 'moving'; // rufowe
    // światło kotwiczne (topowe, dookólne) – gdy jacht stoi; światło silnikowe (białe, w połowie masztu) – w ruchu
    add(heel, 0xffffff, 1.6, 0.1 * L, v.boat.userData.mastTop + 0.2, 0).userData.mode = 'anchor';
    const sp = v.boat.userData.steamPos;
    add(heel, 0xfff6e0, 1.5, sp[0], sp[1], sp[2]).userData.mode = 'moving';
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
      const s = glow(0xffd28a, 2.6);
      s.position.set(l.x, l.y, l.z);
      s.userData.far = true; // powiększany z odległością, żeby dalekie latarnie też były widoczne
      this.scene.add(s);
      this.glows.push(s);
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
    if (this.sky === 'fog') { bot = lerpC(bot, lerpC(C(0xc9ced2), C(0x2a3038), night), 0.85); top = lerpC(top, bot, 0.6); }
    this.paintSky(top, bot);
    this.scene.background = bot;
    this.scene.fog.color.copy(bot);
    const fogK = night > 0.5 && this.sky === 'clear' ? 0.8 : 1;
    this.scene.fog.near = sky.fog[0] * fogK;
    this.scene.fog.far = sky.fog[1] * fogK;

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
    this.moon.position.set(cam.tx - 0.45 * 900, 0.75 * 900, cam.tz + 0.5 * 900);
    this.moon.material.opacity = night * (1 - sky.grey);
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

    this.stars.material.opacity = night * (1 - sky.grey) * 0.9;
    this.stars.position.set(cam.tx, 0, cam.tz);

    // światła: nawigacyjne, latarnie, okna – włączają się o zmierzchu (i w mgle/deszczu trochę wcześniej)
    const lightsOn = clamp(night * 1.3 + (sky.grey > 0.5 ? 0.25 : 0) - 0.05, 0, 1);
    const bt = this.world.boat;
    const movingNow = Math.hypot(bt.vx || 0, bt.vz || 0) > 0.25 || Math.abs(bt.throttle || 0) > 0.05;
    this.mv += ((movingNow ? 1 : 0) - this.mv) * clamp(camDt * 3, 0, 1);
    const moored = this.world.lines.some((l) => l.state === 'attached' && !l.isMooring);
    this.free += ((moored ? 0 : 1) - this.free) * clamp(camDt * 3, 0, 1);
    const wp = new THREE.Vector3();
    for (const g of this.glows) {
      let k = lightsOn;
      if (g.userData.mode === 'moving') k *= this.mv;
      else if (g.userData.mode === 'anchor') k *= (1 - this.mv) * this.free; // kotwiczne: tylko gdy jacht nie stoi przy kei
      g.visible = k > 0.02;
      g.material.opacity = k;
      let sc = g.userData.size * (0.6 + 0.4 * lightsOn);
      if (g.userData.far) { g.getWorldPosition(wp); sc *= clamp(this.view.camera.position.distanceTo(wp) / 45, 1, 5); }
      g.scale.setScalar(sc);
    }
    for (const m of this.boatWindowMats) {
      m.emissive.setHex(0xffc27a);
      m.emissiveIntensity = lightsOn * 0.28; // okna jachtów – przyciemnione
    }
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

  paintSky(top, bot) {
    const key = top.getHex() * 7 + bot.getHex();
    if (key === this._skyKey) return;
    this._skyKey = key;
    const geo = this.view.sky.geometry;
    const pos = geo.attributes.position, col = geo.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      const t = clamp(pos.getY(i) / 1200, 0, 1);
      const c = bot.clone().lerp(top, Math.pow(t, 0.6));
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
