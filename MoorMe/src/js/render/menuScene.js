// Tło menu: żywa scena 3D low-poly – zatoka o zachodzie słońca, falujące morze, kołyszący się jacht,
// wyspy, latarnia i boje. Płaskie cieniowanie, miękkie cienie i mgła dają efekt „renderu”.
import * as THREE from 'three';
import { BOATS } from '../data/boats.js';
import { buildBoat } from './boatModel.js';
import { boatIdentity } from '../settings.js';
import { rng } from '../math.js';

const SKY_TOP = new THREE.Color(0x2b3a78), SKY_MID = new THREE.Color(0xc0577a), SKY_HOR = new THREE.Color(0xff9a52);
const FOG = 0xe88a6a;
const SUN_AZ = -1.9; // kierunek zachodzącego słońca (za jachtem, w kadrze)

const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.82, metalness: 0, ...extra });

// bryła z poszarpanymi wierzchołkami (skały, wyspy, chmury)
function jagged(geo, amp, r, keepBase = true) {
  geo = geo.toNonIndexed();
  const p = geo.attributes.position, key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  const off = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = key(x, y, z);
    if (!off.has(k)) off.set(k, [(r() - 0.5) * amp, keepBase && y <= 0.001 ? 0 : (r() - 0.5) * amp, (r() - 0.5) * amp]);
    const o = off.get(k);
    p.setXYZ(i, x + o[0], y + o[1], z + o[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

function island(r, w, h, seed) {
  const R = rng(seed), g = new THREE.Group();
  const base = new THREE.Mesh(jagged(new THREE.CylinderGeometry(w * 0.82, w, h * 0.16, 9, 1), w * 0.12, R), flat(0xe6cf9d));
  base.position.y = h * 0.04;
  const hill = new THREE.Mesh(jagged(new THREE.ConeGeometry(w * 0.8, h, 8, 2), w * 0.22, R), flat(0x6f9a58));
  hill.position.y = h * 0.5 + h * 0.08;
  const rock = new THREE.Mesh(jagged(new THREE.DodecahedronGeometry(w * 0.32, 0), w * 0.1, R, false), flat(0x9a948a));
  rock.position.set(w * 0.55, h * 0.1, w * 0.25);
  g.add(base, hill, rock);
  // drzewa
  for (let i = 0; i < 4 + (seed % 3); i++) {
    const a = R() * Math.PI * 2, d = w * (0.25 + R() * 0.35);
    const tree = new THREE.Mesh(new THREE.ConeGeometry(w * 0.09, w * 0.32, 5), flat(0x3f6e3c));
    tree.position.set(Math.cos(a) * d, h * 0.2 + (1 - d / w) * h * 0.55 + w * 0.16, Math.sin(a) * d);
    g.add(tree);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function lighthouse() {
  const g = new THREE.Group();
  const rockBase = new THREE.Mesh(jagged(new THREE.CylinderGeometry(9, 12, 4, 8), 2, rng(5)), flat(0x8f8a84));
  rockBase.position.y = 1;
  g.add(rockBase);
  const segs = 5, H = 26;
  for (let i = 0; i < segs; i++) {
    const r0 = 3.4 - (i / segs) * 1.3, r1 = 3.4 - ((i + 1) / segs) * 1.3;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, H / segs, 10), flat(i % 2 ? 0xf4efe8 : 0xd5524a));
    s.position.y = 3 + (i + 0.5) * (H / segs);
    g.add(s);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.6, 10), flat(0x2f3a4f));
  gallery.position.y = 3 + H + 0.3;
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.6, 8), flat(0xfff1b8, { emissive: 0xffd36b, emissiveIntensity: 1.6 }));
  lamp.position.y = 3 + H + 1.9;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2.4, 8), flat(0xc4443d));
  roof.position.y = 3 + H + 4.4;
  g.add(gallery, lamp, roof);
  const glow = new THREE.PointLight(0xffc56b, 60, 60, 2);
  glow.position.y = 3 + H + 1.9;
  g.add(glow);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buoy(color, top) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 1.8, 7), flat(color));
  body.position.y = 0.6;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 5), flat(0x3a3f4a));
  pole.position.y = 2.2;
  const mark = new THREE.Mesh(top === 'cone' ? new THREE.ConeGeometry(0.45, 0.8, 6) : new THREE.CylinderGeometry(0.4, 0.4, 0.8, 6), flat(color));
  mark.position.y = 3.2;
  g.add(body, pole, mark);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function cloud(seed, s) {
  const R = rng(seed), g = new THREE.Group(), m = flat(0xffc2a8, { roughness: 1, emissive: 0xff7a5a, emissiveIntensity: 0.35 });
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(jagged(new THREE.IcosahedronGeometry(s * (0.5 + R() * 0.4), 0), s * 0.2, R, false), m);
    b.position.set((i - 2) * s * 0.55 + (R() - 0.5) * s * 0.3, (R() - 0.3) * s * 0.3, (R() - 0.5) * s * 0.4);
    b.scale.y = 0.62;
    g.add(b);
  }
  return g;
}

function skyDome() {
  const geo = new THREE.SphereGeometry(1400, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: SKY_TOP }, mid: { value: SKY_MID }, hor: { value: SKY_HOR }, sunDir: { value: new THREE.Vector3() } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vp;
      void main(){
        float y = max(vp.y, 0.0);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.16, y));
        c = mix(c, top, smoothstep(0.12, 0.65, y));
        float s = max(dot(normalize(vp), normalize(sunDir)), 0.0);
        c += vec3(1.0, 0.62, 0.3) * (pow(s, 6.0) * 0.55 + pow(s, 40.0) * 0.5) + vec3(1.0, 0.9, 0.7) * pow(s, 900.0) * 2.0;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`
  });
  return new THREE.Mesh(geo, mat);
}

export class MenuScene {
  constructor(el) {
    this.el = el;
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    r.domElement.className = 'menu3d-canvas';
    el.appendChild(r.domElement);

    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.Fog(FOG, 160, 1000);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 3000);

    // światło: ciepłe, niskie słońce + niebo/odbicie od morza
    const sunDir = new THREE.Vector3(Math.cos(SUN_AZ), 0.028, Math.sin(SUN_AZ)).normalize();
    scene.add(new THREE.HemisphereLight(0xffb08f, 0x3a5f8f, 1.5));
    const sun = new THREE.DirectionalLight(0xff8a45, 3.6);
    sun.position.copy(sunDir).multiplyScalar(160);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 420 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    const rim = new THREE.DirectionalLight(0xb48cff, 0.9);
    rim.position.set(60, 40, 80);
    scene.add(rim);

    const sky = skyDome();
    sky.material.uniforms.sunDir.value.copy(sunDir);
    scene.add(sky);

    // słońce nad horyzontem
    const disc = new THREE.Mesh(new THREE.CircleGeometry(46, 32), new THREE.MeshBasicMaterial({ color: 0xffe3a6, fog: false, toneMapped: false }));
    disc.position.copy(sunDir).multiplyScalar(1300);
    disc.lookAt(0, 0, 0);
    scene.add(disc);

    // morze: płaskie fasety z falą
    const seaGeo = new THREE.PlaneGeometry(1600, 1600, 110, 110).toNonIndexed();
    seaGeo.rotateX(-Math.PI / 2);
    this.seaBase = Float32Array.from(seaGeo.attributes.position.array);
    const sea = this.sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0x3d86ad, flatShading: true, roughness: 0.3, metalness: 0.1 }));
    sea.receiveShadow = true;
    scene.add(sea);

    // jacht
    const spec = BOATS.C46;
    const boat = this.boat = buildBoat(spec, { color: 0xffffff, stripe: 0x2f4468, ...boatIdentity(), split: true });
    boat.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    boat.rotation.y = -0.35;
    scene.add(boat);

    // otoczenie
    const add = (o, x, z, ry = 0) => { o.position.set(x, 0, z); o.rotation.y = ry; scene.add(o); return o; };
    add(island(0, 40, 26, 3), -260, -330, 0.3);
    add(island(0, 64, 40, 8), -40, -520, 1.2);
    add(island(0, 26, 16, 13), 150, -175, 2.1);
    add(island(0, 90, 60, 21), -560, -640, 0.7);
    add(lighthouse(), -10, -230, 0);
    this.buoys = [add(buoy(0xd6403a, 'can'), -40, -40), add(buoy(0x2f9a63, 'cone'), -70, -95), add(buoy(0xe7b93a, 'cone'), 30, -70)];
    // pasmo gór na horyzoncie
    const R = rng(31);
    for (let i = 0; i < 16; i++) {
      const a = -2.6 + i * 0.16, d = 820 + R() * 120;
      if (Math.abs(a - SUN_AZ) < 0.32) continue; // otwarty horyzont pod słońcem
      const m = new THREE.Mesh(jagged(new THREE.ConeGeometry(70 + R() * 90, 60 + R() * 110, 6, 1), 30, R), flat(0x6a4f86));
      m.position.set(Math.cos(a) * d, -4, Math.sin(a) * d);
      scene.add(m);
    }
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const c = cloud(40 + i, 18 + R() * 16);
      c.position.set(-500 + i * 170 + R() * 60, 90 + R() * 70, -520 - R() * 200);
      scene.add(c);
      this.clouds.push(c);
    }

    this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    this._onMove = (e) => { this.mouse.tx = e.clientX / window.innerWidth - 0.5; this.mouse.ty = e.clientY / window.innerHeight - 0.5; };
    window.addEventListener('pointermove', this._onMove);
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(el);
    this.resize();

    this.alive = true;
    const t0 = performance.now();
    const loop = (now) => {
      if (!this.alive || !this.el.isConnected) { this.dispose(); return; }
      this.frame((now - t0) / 1000);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  wave(x, z, t) {
    return Math.sin(x * 0.045 + t * 0.9) * 0.55 + Math.sin(z * 0.06 - t * 1.1) * 0.45 + Math.sin((x + z) * 0.11 + t * 1.7) * 0.18;
  }

  frame(t) {
    const p = this.sea.geometry.attributes.position, b = this.seaBase;
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3], z = b[i * 3 + 2];
      p.array[i * 3 + 1] = this.wave(x, z, t);
    }
    p.needsUpdate = true;
    this.sea.geometry.computeVertexNormals();

    const bt = this.boat;
    bt.position.y = this.wave(0, 0, t) * 0.7 - 0.2;
    bt.rotation.z = Math.sin(t * 0.8) * 0.035;
    bt.rotation.x = Math.sin(t * 0.6 + 1) * 0.02;
    this.buoys.forEach((o, i) => { o.position.y = this.wave(o.position.x, o.position.z, t) - 0.3; o.rotation.z = Math.sin(t * 1.3 + i) * 0.12; });
    this.clouds.forEach((c, i) => { c.position.x += 0.02 + i * 0.004; if (c.position.x > 700) c.position.x = -700; });

    const m = this.mouse;
    m.x += (m.tx - m.x) * 0.04; m.y += (m.ty - m.y) * 0.04;
    // kamera krąży powoli wokół jachtu; punkt patrzenia przesunięty w lewo, żeby jacht stał po prawej stronie kadru
    const az = 1.05 + Math.sin(t * 0.04) * 0.1 + m.x * 0.08, d = 60, el = 0.13 + m.y * 0.03;
    const cam = this.camera.position.set(Math.cos(az) * Math.cos(el) * d, 5 + Math.sin(el) * d, Math.sin(az) * Math.cos(el) * d);
    const dx = -cam.x, dz = -cam.z, n = Math.hypot(dx, dz);
    const shift = this.camera.aspect > 1.2 ? 11 : 0;
    this.camera.lookAt(-(-dz / n) * shift, 5.5, -(dx / n) * shift);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    if (this._disposed) return;
    this.alive = false; this._disposed = true;
    window.removeEventListener('pointermove', this._onMove);
    this._ro.disconnect();
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
