// Widok 3D symulacji (kamera w rzucie izometrycznym jak w grach RTS)
import * as THREE from 'three';
import { Seasick } from './seasick.js';
import { buildBoat, buildDeckGear, buildFender, buildBallFender, waveFlag, animatePerson, setTransomPlatform, buildPerson, sheerHeight, mat } from './boatModel.js';
import { buildHarbor, Water } from './harborModel.js';
import { HarbourLife } from './life.js';
import { buildSea } from './seaModel.js';
import { Atmosphere } from './atmosphere.js';
import { wheelClassifier } from './wheel.js';
import { hullExtents, hullOutline, halfBeamAt, hullNormalAt, fenderGeom, fenderRadiusOf, sternFenderY } from '../data/boats.js';
import { localToWorld, DEG, clamp, tensionColor, pointInConvex } from '../math.js';
import { TARGET_DY } from '../physics/world.js';
import { getSettings, boatIdentity, crewNames } from '../settings.js';

export class View3D {
  constructor(container, world) {
    this.container = container;
    this.world = world;
    this.passage = !!world.isPassage;
    this.fogScale = this.passage ? 4.5 : 1;
    const gfx = getSettings().gfx;
    this.gfx = gfx;
    const renderer = new THREE.WebGLRenderer({ antialias: !!gfx.antialias, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.max(0.4, Math.min(window.devicePixelRatio || 1, 2) * (gfx.scale || 1)));
    renderer.shadowMap.enabled = gfx.shadows !== 'off';
    renderer.shadowMap.type = gfx.shadows === 'basic' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; // przy rozdzielczości < 100% bufor jest mniejszy niż okno
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fd3f0);
    scene.fog = new THREE.Fog(0xb7dcef, 220, 620);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, this.passage ? 9000 : 2000);
    this.camera = camera;
    // mniej światła rozproszonego = wyraźniejsze cienie
    const hemi = new THREE.HemisphereLight(0xdff2ff, 0x4a5a44, 0.8);
    scene.add(hemi);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
    sun.castShadow = true;
    const maxTex = renderer.capabilities.maxTextureSize || 4096;
    const shSize = Math.min(gfx.shadows === 'basic' ? 2048 : 4096, maxTex);
    sun.shadow.mapSize.set(shSize, shSize);
    const sc = sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 300;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 2.5;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    // niebo – kopuła gradientowa
    const skyGeo = new THREE.SphereGeometry(1200, 16, 10);
    const skyCol = [];
    const pos = skyGeo.attributes.position;
    const top = new THREE.Color(0x5aa6dd), bot = new THREE.Color(0xd6ecf7);
    for (let i = 0; i < pos.count; i++) {
      const t = clamp(pos.getY(i) / 1200, 0, 1);
      const c = bot.clone().lerp(top, Math.pow(t, 0.6));
      skyCol.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyCol, 3));
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
    if (this.passage) sky.scale.setScalar(4);
    scene.add(sky);
    this.sky = sky;

    this.water = new Water(scene, { follow: this.passage, detail: { high: 1, medium: 0.7, low: 0.45 }[gfx.water] || 1 });
    if (!this.passage) this.water.setHarbor(world.H);
    const hb = this.passage ? buildSea(world.H, scene) : buildHarbor(world.H, scene);
    this.harbor = hb;
    this.sea = this.passage ? hb : null;

    // nasz jacht
    const spec = world.spec;
    this.boat = buildBoat(spec, { bowThruster: world.equip.bowThruster, drive: world.equip.drive, rudders: world.equip.rudders, color: 0xffffff, stripe: 0xffffff, ...boatIdentity(), split: true });
    this.boat.userData.heel.add(buildDeckGear(spec, world.equip.deck));
    scene.add(this.boat);

    // klikalne knagi / kluzy / półkluzy na pokładzie
    this.deckHits = [];
    for (const it of world.equip.deck) {
      const y = sheerHeight(spec, it.x) + 0.1;
      const hit = new THREE.Mesh(new THREE.SphereGeometry(it.kind === 'cleat' ? 0.6 : 0.45, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(it.x, y, it.y);
      hit.userData.deckItem = it;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(it.kind === 'cleat' ? 0.34 : 0.26, 0.045, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.95, depthTest: false }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(it.x, y + 0.02, it.y);
      ring.renderOrder = 10;
      ring.visible = false;
      it._ring = ring;
      this.boat.userData.heel.add(hit, ring);
      this.deckHits.push(hit);
    }

    // pierścień zaznaczenia własnego jachtu (jak w grach RTS)
    {
      const out = hullOutline(spec, 16);
      const shape = new THREE.Shape();
      const sc = (x, y, k) => [x * (1 + 0.1 * k) + (x > 0 ? 0.6 : -0.6) * k, y * (1 + 0.35 * k)];
      out.forEach(([x, y], i) => { const [a, b] = sc(x, -y, 0.42); i ? shape.lineTo(a, b) : shape.moveTo(a, b); });
      const hole = new THREE.Path();
      [...out].reverse().forEach(([x, y], i) => { const [a, b] = sc(x, -y, 0.3); i ? hole.lineTo(a, b) : hole.moveTo(a, b); });
      shape.holes.push(hole);
      const rg = new THREE.ShapeGeometry(shape);
      rg.rotateX(-Math.PI / 2);
      this.selRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.25, depthWrite: false, depthTest: false }));
      this.selRing.renderOrder = 8; // zawsze widoczny – fale go nie zasłaniają
      this.selRing.position.y = 0.07;
      this.boat.add(this.selRing);
    }

    // odbijacze
    this.rebuildFenders();

    // załoga: sternik + osoba na dziobie + osoba na lądzie
    this.helmsman = buildPerson(0xe63946);
    this.deckhand = buildPerson(0xf4a261);
    this.boat.userData.heel.add(this.helmsman, this.deckhand);
    const { xs, xb } = hullExtents(spec);
    this.helmsman.position.set(xs + 0.05 * spec.loa, sheerHeight(spec, xs) - 0.15, spec.beam * 0.27);
    this.helmsman.rotation.y = Math.PI / 2; // twarzą do dziobu (przód postaci = lokalne +z)
    this.deckhandTarget = new THREE.Vector3(xb - 0.12 * spec.loa, sheerHeight(spec, xb - 0.12 * spec.loa), 0);
    this.deckhand.position.copy(this.deckhandTarget);
    this.deckhand.rotation.y = Math.PI / 2;
    this.shoreCrew = buildPerson(0xf4a261);
    this.shoreCrew.visible = false;
    scene.add(this.shoreCrew);
    // kapitan Kuba + trzech losowych członków załogi (dwóch stoi/siedzi na pokładzie, jeden to „deckhand”, który schodzi na ląd)
    this.crewNames = crewNames(); // z ustawień (puste pola – losowo)
    const L = spec.loa;
    this.mate1 = buildPerson(0x457b9d);
    this.mate2 = buildPerson(0x2a9d8f);
    this.mate1.position.set(xs + 0.13 * L, sheerHeight(spec, xs) + 0.05, -spec.beam * 0.2); // ławka w kokpicie
    this.mate1.rotation.y = Math.PI / 2 - 0.5;
    this.mate2.position.set(0.16 * L, sheerHeight(spec, 0.16 * L) - 0.05, halfBeamAt(spec, 0.16 * L) * 0.8); // burta przy nadbudówce
    this.mate2.rotation.y = 0.3;
    this.boat.userData.heel.add(this.mate1, this.mate2);
    if (world.isPassage) {
      // w rejsie cała załoga siedzi w kokpicie
      const sy = sheerHeight(spec, xs) + 0.05;
      this.deckhandTarget.set(xs + 0.12 * L, sy, spec.beam * 0.2);
      this.deckhand.position.copy(this.deckhandTarget);
      this.deckhand.rotation.y = Math.PI / 2 + 0.5;
      this.mate2.position.set(xs + 0.2 * L, sy, -spec.beam * 0.22);
      this.mate2.rotation.y = Math.PI / 2 - 0.3;
    }
    // małe etykiety z imionami nad głowami
    this.tags = document.createElement('div');
    this.tags.className = 'crew-tags';
    container.appendChild(this.tags);
    this.tagEls = [];
    const tagged = [[this.helmsman, this.crewNames[0]], [this.deckhand, this.crewNames[1]], [this.mate1, this.crewNames[2]], [this.mate2, this.crewNames[3]], [this.shoreCrew, this.crewNames[1]]];
    for (const [p, n] of tagged) {
      const el = document.createElement('div');
      el.textContent = n;
      this.tags.appendChild(el);
      this.tagEls.push({ p, el });
    }

    // znacznik muringu do podjęcia (najbliższy wolny) – pulsujący pierścień przy lince pilotowej
    this.murMarker = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 28), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
    this.murMarker.rotation.x = -Math.PI / 2; this.murMarker.renderOrder = 12; this.murMarker.visible = false;
    scene.add(this.murMarker);
    // znacznik stanowiska
    this.berthMarker = this.makeBerthMarker();
    scene.add(this.berthMarker);

    // liny
    this.ropeMeshes = new Map();
    this.coilMeshes = new Map();

    // piana / bąble
    this.wake = this.makeWake();
    scene.add(this.wake.mesh);
    this.wash = this.makePropWash();
    scene.add(this.wash.mesh);
    this.particles = this.makeParticles();
    scene.add(this.particles.points);
    // smugi wiatru
    this.windStreaks = this.makeWindStreaks();
    scene.add(this.windStreaks);

    this.seasick = new Seasick(this);
    // życie w porcie: mewy, spacerowicze, motorówka
    // ptaki, ludzie i zwierzęta w porcie – do wyłączenia w ustawieniach grafiki (słabsze komputery)
    this.life = this.passage || getSettings().gfx.life === false ? { update() {}, onCry: null } : new HarbourLife(this);
    // pora dnia i pogoda
    this.atmo = new Atmosphere(this, world.cfg.weather || {});

    // wskaźnik kursu (strzałka na wodzie)
    this.raycaster = new THREE.Raycaster();
    if (typeof window !== "undefined") window.__view3d = this; // do testów w przeglądarce
    this.mouse = new THREE.Vector2();

    // kamera
    this.cam = { tx: world.boat.x, tz: world.boat.z, dist: 55 + spec.loa * 1.5, az: -35 * DEG, el: 52 * DEG, follow: true };
    this.initControls();
    this.resize();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
  }

  makeBerthMarker() {
    // stanowisko jako prostokąt: przy cumowaniu burtą można stanąć w dowolną stronę (lewą lub prawą burtą do kei)
    const w = this.world, b = w.H.berth, spec = w.spec;
    const { xs, xb } = hullExtents(spec);
    const longside = w.H.method === 'longside';
    const len = spec.loa + (longside ? 2.2 : 2 * b.tolAlong), wid = b.slotW ? b.slotW : longside ? spec.beam + 0.66 : spec.beam + 2 * b.tolAcross; // przy kei: wewnętrzna krawędź na nabrzeżu
    const cx = (xs + xb) / 2, hx = len / 2, hz = wid / 2;
    const corners = [[cx - hx, -hz], [cx + hx, -hz], [cx + hx, hz], [cx - hx, hz]];
    const grp = new THREE.Group();
    const pts = corners.concat([corners[0]]).map(([x, z]) => new THREE.Vector3(x, 0.05, z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.8, depthTest: false }));
    line.renderOrder = 8; grp.add(line);
    // narożniki pogrubione (jak oznaczenie miejsca postojowego)
    const ck = Math.min(1.2, hz * 0.6);
    for (const [x, z] of corners) {
      const sx = x > cx ? -1 : 1, sz = z > 0 ? -1 : 1;
      const c = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x + sx * ck * 1.6, 0.06, z), new THREE.Vector3(x, 0.06, z), new THREE.Vector3(x, 0.06, z + sz * ck)]), line.material);
      c.renderOrder = 8; grp.add(c);
    }
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(len, wid), new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.12, depthWrite: false, depthTest: false }));
    fill.renderOrder = 7; fill.rotation.x = -Math.PI / 2; fill.position.set(cx, 0.04, 0); grp.add(fill);
    // przy stanowiskach dziobem/rufą do pomostu kierunek jest ustalony – strzałka dziobu
    if (!longside) {
      const arr = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 3), new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.6 }));
      arr.rotation.z = -Math.PI / 2; arr.position.set(xb + 1.2, 0.1, 0); grp.add(arr);
    }
    grp.position.set(b.x, 0.12, b.z);
    grp.rotation.y = -b.th;
    grp.userData.line = line;
    grp.userData.fill = fill;
    grp.visible = w.cfg.scenario === 'moor';
    // wskazówka drogi: dyskretna, płaska strzałka na wodzie przy jachcie, w stronę punktu podejścia albo stanowiska
    const sh = new THREE.Shape();
    sh.moveTo(1.6, 0); sh.lineTo(-0.9, 1.1); sh.lineTo(-0.35, 0); sh.lineTo(-0.9, -1.1); sh.closePath();
    const ag = new THREE.ShapeGeometry(sh); ag.rotateX(-Math.PI / 2);
    this.routeArrow = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.35, depthWrite: false, depthTest: false }));
    this.routeArrow.renderOrder = 9; this.routeArrow.visible = false;
    this.scene.add(this.routeArrow);
    return grp;
  }

  // kierunek do celu: najpierw punkt podejścia (od strony wody), potem samo stanowisko; blisko stanowiska strzałka znika
  updateRoute(t = 0) {
    const w = this.world, b = w.H.berth, F = b.frame, boat = w.boat, L = w.spec.loa;
    const dB = Math.hypot(boat.x - b.x, boat.z - b.z);
    const show = w.cfg.scenario === 'moor' && !w.result && !w.poseOk && F && dB > 1.4 * L;
    this.routeArrow.visible = !!show;
    if (!show) return;
    const me = F.toLocal(boat.x, boat.z), bl = F.toLocal(b.x, b.z);
    const s = Math.sign(me.u - bl.u) || 1;
    const A = w.H.method === 'longside' ? F.toWorld(bl.u + s * 1.5 * L, bl.v + 0.9 * L) : F.toWorld(bl.u, bl.v + 1.5 * L);
    const dA = Math.hypot(boat.x - A.x, boat.z - A.z);
    const T = dA > 0.8 * L && dA < dB ? A : b;
    const a = Math.atan2(T.z - boat.z, T.x - boat.x), r = 0.95 * L;
    this.routeArrow.position.set(boat.x + Math.cos(a) * r, 0.25, boat.z + Math.sin(a) * r);
    this.routeArrow.rotation.y = -a;
    this.routeArrow.scale.setScalar(Math.max(1, L / 11));
  }

  // kilwater: pas piany za rufą – rozszerza się w „V”, jasne brzegi fal, wirująca woda w środku, zanika z czasem
  makeWake() {
    const N = 90, geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3 * 3), uv = new Float32Array(N * 3 * 2), al = new Float32Array(N * 3);
    const idx = [];
    for (let i = 0; i < N - 1; i++) for (let k = 0; k < 2; k++) { const a = i * 3 + k, b2 = a + 1, c = a + 3, d = a + 4; idx.push(a, c, b2, b2, c, d); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('alpha', new THREE.BufferAttribute(al, 1));
    geo.setIndex(idx);
    const mat2 = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16,
      uniforms: { uT: { value: 0 }, uDark: { value: 0 } },
      vertexShader: `attribute float alpha; varying float vA; varying vec2 vUv; void main(){ vA = alpha; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying float vA; varying vec2 vUv; uniform float uT; uniform float uDark;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          float u = abs(vUv.x);
          float edge = smoothstep(0.76, 0.92, u) * (1.0 - smoothstep(0.95, 1.0, u)); // wąskie, jasne brzegi fali
          float core = (1.0 - smoothstep(0.0, 0.4, u)) * 0.5;                          // wirująca woda w środku
          float nz = n(vec2(vUv.x * 9.0, vUv.y * 5.0 - uT * 0.3)) * 0.55 + n(vec2(vUv.x * 23.0, vUv.y * 12.0 + uT * 0.5)) * 0.45;
          float speck = smoothstep(0.62, 0.8, n(vec2(vUv.x * 40.0, vUv.y * 22.0)));    // drobne płaty piany
          float a = vA * (edge * (0.45 + 0.7 * nz) + core * smoothstep(0.45, 0.85, nz) + 0.25 * speck * (1.0 - u));
          gl_FragColor = vec4(vec3(0.92, 0.96, 1.0) * (1.0 - 0.75 * uDark), a * 0.7);
        }`
    });
    const mesh = new THREE.Mesh(geo, mat2);
    mesh.frustumCulled = false; mesh.renderOrder = 3;
    return { mesh, geo, mat: mat2, hist: [], N };
  }

  // strumień zaśrubowy: kotłująca się, spieniona woda wybijająca spod rufy (naprzód – do tyłu, wstecz – do przodu wzdłuż kadłuba)
  makePropWash() {
    const R = 14, C = 7, geo = new THREE.BufferGeometry();
    const pos = new Float32Array(R * C * 3), uv = new Float32Array(R * C * 2), idx = [];
    for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) { const a = i * C + j, b2 = a + 1, c = a + C, d = c + 1; idx.push(a, c, b2, b2, c, d); }
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { uv[(i * C + j) * 2] = j / (C - 1) * 2 - 1; uv[(i * C + j) * 2 + 1] = i / (R - 1); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat2 = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16,
      uniforms: { uT: { value: 0 }, uA: { value: 0 }, uDark: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uT; uniform float uA; uniform float uDark;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          float v = vUv.y, u = vUv.x;
          float body = (1.0 - smoothstep(0.55, 1.0, abs(u))) * smoothstep(0.0, 0.12, v) * (1.0 - smoothstep(0.55, 1.0, v));
          // wiry: szum przesuwany wzdłuż strumienia i skręcany (obrót śruby)
          vec2 q = vec2(u * 3.0 + sin(v * 5.0 - uT * 0.9) * 0.4, v * 6.0 - uT * 1.4);
          float boil = n(q) * 0.6 + n(q * 2.3 + 7.0) * 0.4;
          float foam = smoothstep(0.42, 0.8, boil);
          float a = uA * body * (0.35 + 0.75 * foam);
          gl_FragColor = vec4(mix(vec3(0.55, 0.78, 0.8), vec3(0.95, 0.98, 1.0), foam) * (1.0 - 0.75 * uDark), a * 0.45);
        }`
    });
    const mesh = new THREE.Mesh(geo, mat2);
    mesh.frustumCulled = false; mesh.renderOrder = 4;
    return { mesh, geo, mat: mat2, R, C, a: 0 };
  }

  updatePropWash(dt, t, windKn, windDir) {
    const W = this.wash, b = this.world.boat, spec = this.world.spec;
    if (!W) return;
    const thrust = this.world.engineDead ? 0 : b.gear * Math.max(0, b.rpm);
    W.a += (Math.min(1, Math.abs(thrust) * 1.1) - W.a) * Math.min(1, dt * 2.5); // delikatny efekt
    W.mesh.visible = W.a > 0.02;
    if (!W.mesh.visible) return;
    const dir = thrust >= 0 ? -1 : 1; // kierunek strumienia w układzie jachtu (oś x)
    const { xs } = hullExtents(spec);
    const x0 = thrust >= 0 ? Math.min(b.xProp, xs + 0.6) : b.xProp; // naprzód: wybija spod rufy
    const len = (1.6 + 4 * Math.abs(thrust)) * (thrust >= 0 ? 1 : 0.7);
    const pa = W.geo.attributes.position.array;
    // naprzód: płetwa sterowa odchyla strumień zgodnie z wychyleniem (ster na prawo – woda na prawą burtę);
    // przy dwóch płetwach poza osią śruby odchylenie słabsze; na wstecznym ster strumienia nie kieruje
    const defl = thrust >= 0 ? b.rudder * (this.world.equip.rudders === 'single' ? 1.0 : 0.75) : 0;
    let cx = x0, cy = 0;
    const ds = len / (W.R - 1);
    for (let i = 0; i < W.R; i++) {
      const v = i / (W.R - 1);
      if (i > 0) {
        const a = defl * Math.min(1, v / 0.22); // strumień skręca tuż za płetwą
        cx += dir * Math.cos(a) * ds; cy += Math.sin(a) * ds;
      }
      const a = defl * Math.min(1, v / 0.22), nx = Math.sin(a), ny = Math.cos(a); // poprzecznie do strumienia
      // na wstecznym strumień rozdziela się po obu stronach kadłuba
      const width = 0.25 + v * (thrust >= 0 ? 1.3 : 0.9) + (thrust < 0 ? spec.beam * 0.45 * Math.min(1, v * 2) : 0);
      for (let j = 0; j < W.C; j++) {
        const u = j / (W.C - 1) * 2 - 1;
        const lx = cx + nx * u * width, ly = cy + ny * u * width;
        const p = localToWorld(b.x, b.z, b.th, lx, ly);
        const o = (i * W.C + j) * 3;
        pa[o] = p.x; pa[o + 2] = p.z; pa[o + 1] = this.water.surfaceY(p.x, p.z, windKn, windDir) + 0.13;
      }
    }
    W.geo.attributes.position.needsUpdate = true;
    W.ph = (W.ph || 0) + dt * (0.5 + 0.5 * Math.abs(thrust)); // płynna faza (bez skoków przy zmianie obrotów)
    W.mat.uniforms.uT.value = W.ph;
    W.mat.uniforms.uA.value = W.a;
    W.mat.uniforms.uDark.value = this.atmo && this.atmo.night ? this.atmo.night : 0;
  }

  updateWake(dt, t, windKn, windDir) {
    const W = this.wake, b = this.world.boat, spec = this.world.spec;
    if (!W) return;
    const L = spec.loa, { xs } = hullExtents(spec);
    const st = localToWorld(b.x, b.z, b.th, xs + 0.2, 0);
    const last = W.hist[W.hist.length - 1], n0 = W.hist.length;
    const fwd = b.u === undefined ? b.speed : Math.max(0, b.u);
    if (!last || Math.hypot(st.x - last.x, st.z - last.z) > 0.35) W.hist.push({ x: st.x, z: st.z, th: b.th, t, spd: Math.min(1, fwd / (spec.maxSpeedKn * 0.5144 * 0.6)), d: last ? last.d + Math.hypot(st.x - last.x, st.z - last.z) : 0 });
    else if (b.speed < 0.12 && n0 === 1) { last.x = st.x; last.z = st.z; last.th = b.th; } // jacht stoi – pojedynczy punkt przy rufie
    while (W.hist.length > W.N || (W.hist.length && t - W.hist[0].t > 14)) W.hist.shift();
    const pa = W.geo.attributes.position.array, ua = W.geo.attributes.uv.array, aa = W.geo.attributes.alpha.array;
    const H = W.hist, n = H.length;
    for (let i = 0; i < W.N; i++) {
      const hp = H[n - 1 - i]; // od rufy wstecz
      for (let k = 0; k < 3; k++) {
        const o = (i * 3 + k);
        if (!hp) { aa[o] = 0; pa[o * 3 + 1] = -50; continue; }
        const age = t - hp.t;
        const half = spec.beam * 0.24 + age * (0.12 + 0.26 * hp.spd); // rozszerzanie się śladu (kąt ok. 20°)
        const nx = -Math.sin(hp.th), nz = Math.cos(hp.th); // poprzecznie do kursu w chwili przejścia
        const side = k - 1;
        const x = hp.x + nx * half * side, z = hp.z + nz * half * side;
        pa[o * 3] = x; pa[o * 3 + 2] = z;
        pa[o * 3 + 1] = this.water.surfaceY(x, z, windKn, windDir) + 0.11;
        ua[o * 2] = side; ua[o * 2 + 1] = hp.d / Math.max(2, L * 0.4);
        // środek (spieniona woda zaraz za rufą) gaśnie szybko, brzegi fali (ramiona „V”) trzymają się dłużej
        aa[o] = hp.spd * Math.max(0, 1 - age / (side === 0 ? 2.5 + 2 * hp.spd : 5 + 9 * hp.spd)) * Math.min(1, i / 3);
      }
    }
    W.geo.attributes.position.needsUpdate = true; W.geo.attributes.uv.needsUpdate = true; W.geo.attributes.alpha.needsUpdate = true;
    W.mat.uniforms.uT.value = t;
    W.mat.uniforms.uDark.value = this.atmo && this.atmo.night ? this.atmo.night : 0;
  }

  makeParticles() {
    const N = 600;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const alpha = new Float32Array(N);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { size: { value: 900 } },
      vertexShader: `attribute float alpha; varying float vA; uniform float size;
        void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (0.22 + 0.5*(1.0-alpha)) / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if(d>0.5) discard; gl_FragColor = vec4(1.0,1.0,1.0, vA * (1.0 - d*2.0) * 0.85); }`
    });
    const points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    const data = [];
    for (let i = 0; i < N; i++) data.push({ life: 0, max: 1, x: 0, y: -10, z: 0, vx: 0, vz: 0 });
    return { points, data, geo, next: 0 };
  }

  spawn(x, z, vx, vz, life = 1.5) {
    const P = this.particles;
    const p = P.data[P.next];
    P.next = (P.next + 1) % P.data.length;
    p.x = x + (Math.random() - 0.5) * 0.3; p.z = z + (Math.random() - 0.5) * 0.3; p.y = 0.08;
    p.vx = vx + (Math.random() - 0.5) * 0.5; p.vz = vz + (Math.random() - 0.5) * 0.5;
    p.life = life; p.max = life;
  }

  makeWindStreaks() {
    // chorągiewki wiatru jak na mapach synoptycznych: drzewce + pierzaste kreski (5/10 kn) i trójkąty (50 kn)
    // w porcie: siatka na całą mapę (osie wzdłuż i w poprzek wiatru); na otwartym morzu: wokół kamery
    const B = !this.passage && this.world.H && this.world.H.bounds;
    const GS = B ? 14 : 11;
    const n = B ? Math.ceil(Math.hypot(B.maxX - B.minX, B.maxZ - B.minZ) / GS) + 3 : 12;
    const N = n * n, SEG = 9;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * SEG * 6), 3));
    const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    m.frustumCulled = false;
    m.userData = { B, GS, n, N, phase: 0 };
    m.visible = getSettings().windFlags === true; // chorągiewki wiatru domyślnie wyłączone
    return m;
  }

  initControls() {
    const el = this.renderer.domElement;
    let drag = null;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    let fdrag = null; // przeciąganie odbijacza bezpośrednio na jachcie
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && e.isPrimary === false) return; // drugi palec – gest (niżej)
      if (e.button === 0 && !e.shiftKey && !e.altKey) {
        this.updateMouse(e);
        const fh = this.pickFender();
        if (fh) { fdrag = fh; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; return; }
      }
      drag = { x: e.clientX, y: e.clientY, button: e.button, moved: false };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      this.updateMouse(e);
      if (fdrag) { this.dragFender(fdrag); return; }
      if (!drag) { el.style.cursor = this.pickFender() ? 'grab' : ''; if (this.onHover) this.onHover(this.pick()); return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      drag.x = e.clientX; drag.y = e.clientY;
      if (this.cam.mode === 'fpv') {
        // widok kapitana: przeciąganie obraca głowę
        if (drag.moved) this.orbitBy(dx, dy);
      } else if (drag.button === 2 || (drag.button === 0 && (e.shiftKey || e.altKey))) {
        this.orbitBy(dx, dy);
      } else if (drag.button === 0 || drag.button === 1) {
        // przesuwanie widoku
        const s = this.cam.dist * 0.0016;
        const c = Math.cos(this.cam.az), sn = Math.sin(this.cam.az);
        this.cam.tx -= (dx * c + dy * sn * 1.0) * s;
        this.cam.tz -= (-dx * sn + dy * c) * s;
        if (drag.moved) this.cam.follow = false;
      }
    });
    el.addEventListener('pointerup', (e) => {
      if (fdrag) { fdrag = null; el.style.cursor = 'grab'; return; }
      if (drag && !drag.moved && drag.button === 0 && this.onClick) {
        this.updateMouse(e);
        this.onClick(this.pick());
      }
      drag = null;
    });
    // kółko myszy = zoom; touchpad: przesunięcie dwoma palcami = obrót kamery, „szczypanie” (ctrl+wheel) = zoom
    const wheelKind = wheelClassifier();
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const px = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const dx = e.deltaX * px, dy = e.deltaY * px, kind = wheelKind(e);
      // ruch z touchpada (małe, ułamkowe kroki albo składowa pozioma) obraca kamerę; kółko i szczypanie – zoom
      if (kind === 'pad') { this.orbitBy(-dx * 0.9, -dy * 0.9); return; }
      this.zoomBy(dy * (kind === 'pinch' ? 0.012 : 0.0012));
    }, { passive: false });
    // ekran dotykowy: dwa palce – szczypanie = zoom, przesuw = obrót
    const touches = new Map();
    let pinchD = 0, pinchC = null;
    el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size === 2) { drag = null; const [a, b] = [...touches.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); pinchC = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; } } });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size !== 2) return;
      drag = null;
      const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y), c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinchD > 0) this.zoomBy(-Math.log(d / pinchD));
      if (pinchC) this.orbitBy(c.x - pinchC.x, c.y - pinchC.y);
      pinchD = d; pinchC = c;
    });
    const endTouch = (e) => { touches.delete(e.pointerId); if (touches.size < 2) { pinchD = 0; pinchC = null; } };
    el.addEventListener('pointerup', endTouch);
    el.addEventListener('pointercancel', endTouch);
  }

  // obrót kamery o (dx, dy) pikseli – w widoku kapitana rozglądanie się
  orbitBy(dx, dy) {
    if (this.cam.mode === 'fpv') {
      this.cam.fpvYaw -= dx * 0.004;
      this.cam.fpvPitch = clamp(this.cam.fpvPitch - dy * 0.003, -1.1, 0.9);
      return;
    }
    this.cam.mode = 'free';
    this.cam.az -= dx * 0.006;
    this.cam.el = clamp(this.cam.el + dy * 0.004, 12 * DEG, 88 * DEG);
  }
  // zoom: k > 0 oddala (logarytmicznie)
  zoomBy(k) {
    k = clamp(k, -0.5, 0.5);
    if (this.cam.mode === 'fpv') { this.cam.fov = clamp((this.cam.fov || 62) * Math.exp(k * 0.85), 25, 85); return; }
    this.cam.dist = clamp(this.cam.dist * Math.exp(k), 12, 320);
  }

  updateMouse(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.mousePx = { x: e.clientX - r.left, y: e.clientY - r.top, cx: e.clientX, cy: e.clientY };
  }

  // Lina najbliżej kursora (odległość na ekranie od łamanej liny), maks. 14 px
  pickRope() {
    if (!this.mousePx || !this.ropePts) return null;
    const m = this.mousePx;
    let best = null, bd = 14;
    const v = new THREE.Vector3();
    const r = this.renderer.domElement;
    for (const [id, pts] of this.ropePts) {
      let prev = null;
      for (const p of pts) {
        v.copy(p).project(this.camera);
        if (v.z > 1) { prev = null; continue; }
        const q = { x: (v.x * 0.5 + 0.5) * r.clientWidth, y: (-v.y * 0.5 + 0.5) * r.clientHeight };
        if (prev) {
          const ex = q.x - prev.x, ey = q.y - prev.y, l2 = ex * ex + ey * ey || 1;
          const t = clamp(((m.x - prev.x) * ex + (m.y - prev.y) * ey) / l2, 0, 1);
          const d = Math.hypot(m.x - (prev.x + ex * t), m.y - (prev.y + ey * t));
          if (d < bd) { bd = d; best = id; }
        }
        prev = q;
      }
    }
    if (best == null) return null;
    const line = this.world.lines.find((l) => l.id === best);
    return line ? { line, d: bd } : null;
  }

  // siatki odbijaczy i ich linek – od nowa (także gdy w trakcie manewru dowieszono lub zdjęto kulę)
  rebuildFenders() {
    const world = this.world, heel = this.boat.userData.heel;
    if (this.fenders) for (const { mesh } of this.fenders.values()) heel.remove(mesh);
    if (this.fenderRopes) { heel.remove(this.fenderRopes); this.fenderRopes.geometry.dispose(); }
    this.fenders = new Map();
    for (const f of world.equip.fenders) {
      const m = f.ball ? buildBallFender(fenderRadiusOf(f, world.equip.fenderRadius)) : buildFender(world.equip.fenderRadius);
      heel.add(m);
      this.fenders.set(f.id, { mesh: m, f });
    }
    // linki odbijaczy: od ucha odbijacza do krawędzi pokładu (aktualizowane co klatkę – odbijacze się kołyszą)
    const n = world.equip.fenders.length;
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(Math.max(1, n) * 6), 3));
    this.fenderRopes = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x1d3557 }));
    this.fenderRopes.frustumCulled = false;
    heel.add(this.fenderRopes);
  }

  // odbijacz pod kursorem (tylko wywieszony) – { f, mesh, y } z wysokością punktu chwytu w świecie
  pickFender() {
    if (!this.fenders || !this.fenders.size) return null;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const vis = [...this.fenders.values()].filter((o) => o.mesh.visible);
    if (!vis.length) return null;
    const hits = this.raycaster.intersectObjects(vis.map((o) => o.mesh), true);
    if (!hits.length) return null;
    let o = hits[0].object;
    const rec = vis.find((v) => { let q = o; while (q) { if (q === v.mesh) return true; q = q.parent; } return false; });
    return rec ? { f: rec.f, y: hits[0].point.y } : null;
  }
  // przesuwanie odbijacza: punkt na poziomej płaszczyźnie na wysokości chwytu → pozycja wzdłuż burty (albo na pawęży)
  dragFender(fd) {
    const w = this.world, spec = w.spec, eq = w.equip, { xs, xb } = hullExtents(spec);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -fd.y), hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, hit)) return;
    const loc = this.boat.userData.heel.worldToLocal(hit.clone());
    const f = fd.f;
    f.side = loc.z < 0 ? -1 : 1;
    if (loc.x < xs + 0.3) { f.stern = true; f.x = xs; f.y = +sternFenderY(spec, { ...f, y: loc.z }, fenderRadiusOf(f, eq.fenderRadius)).toFixed(2); }
    else { delete f.stern; delete f.y; f.x = +Math.max(xs + 0.3, Math.min(xb - 0.12, loc.x)).toFixed(2); }
  }

  pickBollard() {
    const p = this.pick();
    return p && p.bollard ? p.bollard : null;
  }

  // Zwraca { deckItem }, { line } albo { bollard } pod kursorem (pokład ma pierwszeństwo).
  // Poler trafiony bezpośrednio wygrywa z liną leżącą obok (np. muringiem na kei), a podczas prowadzenia
  // nowej liny lub podawania liny na poler (preferBollard) liny w ogóle nie zasłaniają polerów.
  pick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const d = this.raycaster.intersectObjects(this.deckHits, false);
    if (d.length) return { deckItem: d[0].object.userData.deckItem };
    const hits = this.raycaster.intersectObjects(this.harbor.bollardMeshes, false);
    const bol = hits.length ? { bollard: hits[0].object.userData.bollard } : null;
    if (bol && this.preferBollard && this.preferBollard()) return bol;
    const rope = this.pickRope();
    if (rope && (!bol || rope.d < 6)) return { line: rope.line };
    return bol;
  }

  // Podświetlenie elementów pokładu: filter(item) -> kolor (hex) albo null
  highlightDeck(filter) {
    for (const it of this.world.equip.deck) {
      const c = filter ? filter(it) : null;
      it._ring.visible = c != null;
      if (c != null) it._ring.material.color.setHex(c);
    }
  }

  setView(kind) {
    const L = this.world.spec.loa;
    this.cam.mode = kind;
    if (kind === 'top') { this.cam.el = 86 * DEG; this.cam.dist = 60 + L * 2; }
    else if (kind === 'iso') { this.cam.el = 52 * DEG; this.cam.dist = 55 + L * 1.5; }
    else if (kind === 'helm') { this.cam.el = 24 * DEG; this.cam.dist = 22 + L; this.cam.az = 1.5 * Math.PI - this.world.boat.th; }
    else if (kind === 'close') { this.cam.el = 40 * DEG; this.cam.dist = 26 + L; }
    else if (kind === 'fpv') { this.cam.fpvYaw = 0; this.cam.fpvPitch = -0.12; this.cam.fov = this.cam.fov || 62; }
    this.cam.follow = true;
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  updateDeckCrew(dt, t) {
    const w = this.world, spec = w.spec;
    if (!this._crewHome) {
      this._crewHome = new Map([[this.deckhand, this.deckhandTarget.clone()], [this.mate1, this.mate1.position.clone()], [this.mate2, this.mate2.position.clone()]]);
      this._crewRot = new Map([[this.deckhand, this.deckhand.rotation.y], [this.mate1, this.mate1.rotation.y], [this.mate2, this.mate2.rotation.y]]);
    }
    // zadania: najpierw liny zakładane z pokładu, potem obsługiwane (wybieraj / luzuj / wybierz), na końcu wybrana
    const jobs = [], seen = new Set();
    const push = (l) => { if (l && !seen.has(l.cleatId)) { seen.add(l.cleatId); jobs.push(l); } };
    for (const l of w.lines) if (l.state === 'pending' && l.pendingVia === 'deck') push(l);
    for (const l of w.lines) if (l.state === 'attached' && ['haul', 'ease', 'take'].includes(l.tending)) push(l);
    for (const l of w.lines) if (l.selected) push(l);
    const sickP = this.seasick && this.seasick.cur ? this.seasick.cur.c.p : null;
    const workers = [w.crew.ashore ? null : this.deckhand, this.mate2, this.mate1].filter((q) => q && q !== sickP);
    // przydział: każdemu najbliższe wolne zadanie
    const free = new Set(jobs), assign = new Map();
    for (const p of workers) {
      let best = null, bd = Infinity;
      for (const l of free) { const c = w.deckItem(l.cleatId); if (!c) continue; const d = Math.hypot(c.x - p.position.x, c.y - p.position.z); if (d < bd) { bd = d; best = l; } }
      if (best) { free.delete(best); assign.set(p, best); }
    }
    const tmp = this._tmpV || (this._tmpV = new THREE.Vector3());
    const sick = this.seasick && this.seasick.cur ? this.seasick.cur.c.p : null; // ten ktoś jest akurat przy relingu
    for (const p of [this.deckhand, this.mate1, this.mate2]) {
      if (p === sick) continue;
      const job = assign.get(p);
      let tgt, face;
      if (job) {
        const cl = w.deckItem(job.cleatId);
        tgt = tmp.set(cl.x - Math.sign(cl.x || 1) * 0.45, sheerHeight(spec, cl.x) + 0.02, cl.y * 0.62);
        face = -Math.atan2(cl.y - tgt.z, cl.x - tgt.x) + Math.PI / 2; // twarzą do knagi
      } else { tgt = tmp.copy(this._crewHome.get(p)); face = this._crewRot.get(p); }
      // przejście bocznym pokładem: przy dłuższej drodze wzdłuż jachtu idzie przy burcie, nie po dachu nadbudówki
      const pos = p.position, dx = tgt.x - pos.x;
      const side = Math.sign(tgt.z || pos.z || 1);
      const wayZ = Math.abs(dx) > 0.8 ? side * Math.max(0.3, halfBeamAt(spec, pos.x) - 0.38) : tgt.z;
      const sp = 1.8 * dt; // ok. 1,8 m/s – sprawny marsz po pokładzie
      const mx = clamp(dx, -sp, sp), mz = clamp(wayZ - pos.z, -sp, sp);
      pos.x += mx; pos.z += mz;
      const moving = Math.abs(mx) + Math.abs(mz) > 0.002;
      const baseY = Math.abs(dx) < 0.05 && Math.abs(tgt.z - pos.z) < 0.05 ? tgt.y : sheerHeight(spec, pos.x) + 0.02;
      pos.y += (baseY + (moving ? Math.abs(Math.sin(t * 5.2)) * 0.025 : 0) - pos.y) * clamp(dt * 8, 0, 1);
      const want = moving ? -Math.atan2(mz, mx) + Math.PI / 2 : face;
      let dr = want - p.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      p.rotation.y += dr * clamp(dt * 6, 0, 1);
      // przy wybieraniu / luzowaniu – lekkie pochylenie i praca rąk przy linie; w drodze – chód
      const working = !moving && !!job && (job.state === 'pending' || (job.state === 'attached' && job.tending !== 'hold'));
      p.rotation.x = working ? 0.1 : 0;
      animatePerson(p, t + (p === this.mate1 ? 0.7 : p === this.mate2 ? 1.9 : 0), moving, working);
    }
  }

  updatePlannedTargets(t) {
    const w = this.world, want = new Set();
    for (const l of w.lines) {
      const b = l.state === 'queued' ? l.queuedTarget : l.state === 'pending' ? l.pendingTarget : l.state === 'ready' ? l.plannedTarget : null;
      if (b && b.x !== undefined) want.add(b);
    }
    this._planned = this._planned || new Map();
    for (const b of want) {
      if (this._planned.has(b)) continue;
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.5, depthWrite: false }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 2.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = 1.35;
      g.add(ring, beam);
      g.position.set(b.x, b.h || 0, b.z);
      this.scene.add(g);
      this._planned.set(b, { g, ring, beam });
    }
    for (const [b, e] of this._planned) {
      if (!want.has(b)) { this.scene.remove(e.g); e.ring.geometry.dispose(); e.beam.geometry.dispose(); this._planned.delete(b); continue; }
      const k = 0.5 + 0.5 * Math.sin(t * 3);
      e.ring.material.opacity = 0.3 + 0.35 * k;
      e.ring.scale.setScalar(0.92 + 0.12 * k);
      e.beam.material.opacity = 0.06 + 0.08 * k;
      e.g.visible = !(b._ring && b._ring.visible); // podczas wybierania polera działa zwykłe podświetlenie
    }
  }

  highlightBollards(options) {
    for (const b of this.world.H.bollards) b._ring.visible = false;
    if (!options) return;
    for (const o of options) {
      o.bollard._ring.visible = true;
      o.bollard._ring.material = o.ok ? RING_OK : RING_BAD;
    }
  }

  // ---------- Liny ----------
  ropeColor(line) {
    const bl = this.world.lineParams.breakLoad;
    const q = line.tension / bl;
    if (line.state === 'broken') return 0xff2d2d;
    return tensionColor(q);
  }

  // Wysokość nabrzeża / pomostu / bomu pod punktem (0 = woda) – liny nie mogą się w nie zapadać
  groundY(x, z) {
    if (!this._ground) {
      this._ground = this.world.H.structures.filter((s) => s.poly && s.kind !== 'pile').map((s) => {
        const xs = s.poly.map((p) => p[0]), zs = s.poly.map((p) => p[1]);
        return { poly: s.poly, h: s.h, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
      });
    }
    let y = 0;
    for (const g of this._ground) {
      if (x < g.minX || x > g.maxX || z < g.minZ || z > g.maxZ || g.h <= y) continue;
      if (pointInConvex(g.poly, x, z)) y = g.h;
    }
    return y;
  }

  updateRopes() {
    const w = this.world;
    const alive = new Set();
    for (const line of w.lines) {
      let a = null, b = null, sag = 0, underwater = false;
      const lead = w.leadWorld(line);
      if (line.state === 'attached' || line.state === 'waitingCrew') {
        a = lead; b = w.targetPoint(line);
        const slack = line.slack || 0;
        const d = line.dist || 1;
        sag = slack > 0.01 ? Math.min(4, Math.sqrt((3 * d * slack) / 8)) : 0.02;
        underwater = line.isMooring;
      } else if (line.state === 'pending') {
        const t = w.targetPoint(line, line.pendingTarget);
        if (line.pendingVia === 'crew') { a = lead; b = { x: w.crew.x, y: w.H.quay.height + 1, z: w.crew.z }; sag = 0.8; }
        else if (line.pendingVia === 'deck') {
          // animacja rzutu
          const tt = clamp(1 - line.timer / 2.2, 0, 1);
          a = lead; b = { x: lead.x + (t.x - lead.x) * tt, y: lead.y + (t.y - lead.y) * tt + Math.sin(tt * Math.PI) * 1.2, z: lead.z + (t.z - lead.z) * tt };
          sag = 0.3;
        } else if (line.pendingVia === 'mooring') {
          const m = line.muring;
          a = lead; b = { x: m.pickup.x, y: w.H.quay.height, z: m.pickup.z }; sag = 1.2;
        }
      } else if (line.state === 'onQuay' && line.muring) {
        const m = line.muring;
        a = { x: m.pickup.x, y: w.H.quay.height + 0.05, z: m.pickup.z };
        b = { x: m.anchor.x, y: -m.anchor.depth + 0.6, z: m.anchor.z };
        sag = 0.5; underwater = true;
      } else if (line.state === 'sinking' && line.muring) {
        const m = line.muring;
        const f = line.timer / 14;
        a = { x: m.pickup.x, y: w.H.quay.height, z: m.pickup.z };
        b = { x: m.anchor.x, y: -m.anchor.depth + 0.6, z: m.anchor.z };
        sag = 0.3 - f * 0.5; underwater = true;
      } else if (line.state === 'retrieving' && line.retrieveFrom) {
        const t = w.targetPoint(line, line.retrieveFrom);
        a = lead; b = { x: (lead.x + t.x) / 2, y: 0.05, z: (lead.z + t.z) / 2 };
        sag = 0.2;
      }
      if (!a || !b) continue;
      alive.add(line.id);
      const pts = [];
      if (a === lead) {
        // część liny na jachcie: knaga -> kluza -> wzdłuż burty (opasanie), potem wolny odcinek do celu
        const cl = w.deckItem(line.cleatId);
        const route = w.ropeRoute(line, b);
        // punkty na pokładzie leżą w układzie jachtu (kołysze się razem z modelem), reszta liny – w świecie
        const hv = this.boat.userData.heel;
        hv.updateMatrixWorld(true);
        const onDeck = (p) => (p.lx === undefined ? new THREE.Vector3(p.x, p.y, p.z) : hv.localToWorld(new THREE.Vector3(p.lx, p.y, p.ly)));
        if (cl && (cl.x !== lead.lx || cl.y !== lead.ly)) pts.push(hv.localToWorld(new THREE.Vector3(cl.x, w.deckHeight(cl.x) + 0.12, cl.y)));
        for (const p of route.pts) pts.push(onDeck(p));
        const ex = onDeck(route.exit);
        a = { x: ex.x, y: ex.y, z: ex.z };
      } else pts.push(new THREE.Vector3(a.x, a.y, a.z));
      // koniec liny na polerze: oczko okręcone wokół szyjki (poler, dalba), przy knadze – krótka pętla, przy pierścieniu – wpięcie
      const tg = line.target;
      const fx = !underwater && !line.isMooring && (line.state === 'attached' || line.state === 'waitingCrew') && tg && tg.kind ? { kind: tg.kind, r: { bollard: 0.19, pile: 0.29, cleat: 0.15, ring: 0 }[tg.kind] ?? 0.19 } : null;
      // przebieg przy polerze: nitki dochodzą stycznie do boków szyjki i opasują ją od tyłu (bez sztucznego pierścienia)
      const ux0 = b.x - a.x, uz0 = b.z - a.z, ul = Math.hypot(ux0, uz0) || 1, ux = ux0 / ul, uz = uz0 / ul;
      const nx = -uz, nz = ux, OFF = 0.065, rr = fx ? fx.r : 0;
      const slip = !!fx && line.mode === 'slip';
      const eyeLen = fx && !slip && rr ? Math.min(0.45, ul * 0.3) : 0; // oko na stałe: splot ok. 0,4 m przed polerem
      const e = eyeLen ? { x: b.x - ux * (rr + eyeLen), y: b.y, z: b.z - uz * (rr + eyeLen) } : slip && rr ? { x: b.x, y: b.y, z: b.z } : b;
      const N = 40; // gęsto – luźna lina układa się na pomoście bez „wgryzania” między punktami
      const strandA = [], strandB = [];
      const smooth = (x0, x1, x) => { const q = Math.min(1, Math.max(0, (x - x0) / (x1 - x0))); return q * q * (3 - 2 * q); };
      for (let i = 1; i <= N; i++) {
        const t = i / N;
        // zwis rośnie od burty – lina nie zapada się w kadłub tuż przy punkcie zejścia
        const x = a.x + (e.x - a.x) * t, z = a.z + (e.z - a.z) * t;
        let y = a.y + (e.y - a.y) * t - Math.sin(Math.PI * t) * sag * Math.min(1, t * 4);
        // nad kei lina leży na powierzchni, nad wodą luźna lina tonie (zwis poniżej lustra wody)
        // najwyższy punkt pod liną (z marginesem – także tuż przy krawędzi kei / pomostu)
        let gy = 0;
        if (!underwater) for (const [ox, oz] of [[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]]) gy = Math.max(gy, this.groundY(x + ox, z + oz));
        if (gy > 0) y = Math.max(y, gy + 0.09); // leży na powierzchni (promień liny ok. 4 cm + detale krawędzi)
        if (slip && rr) {
          // dwie nitki: przy burcie razem, przy polerze rozchodzą się na szerokość szyjki
          const o = 0.048 + Math.max(0, rr - 0.048) * t; // długie, wąskie „V”; nitki zawsze rozdzielone (odstęp ≥ grubość liny)
          strandA.push(new THREE.Vector3(x + nx * o, y, z + nz * o));
          strandB.push(new THREE.Vector3(x - nx * o, y, z - nz * o));
        } else pts.push(new THREE.Vector3(x, y, z));
      }
      // łuk wokół tylnej strony szyjki: od boku +n przez stronę odległą od jachtu do boku −n
      const wrap = (y0, from, to, M) => {
        const out = [];
        const a0 = Math.atan2(nz, nx), back = Math.atan2(uz, ux);
        let d0 = back - a0; d0 = Math.atan2(Math.sin(d0), Math.cos(d0)); // ok. ±90°
        for (let k = from; k <= to; k++) { const ph = a0 + (k / M) * 2 * d0; out.push(new THREE.Vector3(b.x + Math.cos(ph) * rr, y0, b.z + Math.sin(ph) * rr)); }
        return out;
      };
      if (slip && rr) {
        pts.push(...strandA);
        pts.push(...wrap(b.y + 0.01, 1, 9, 10));
        pts.push(...strandB.reverse());
      } else if (eyeLen) {
        // oko (kropla): od splotu do jednego boku szyjki, wokół tyłu, z powrotem do splotu
        const S = pts[pts.length - 1];
        const side = (sg) => new THREE.Vector3(b.x + nx * rr * sg - ux * rr * 0.15, b.y + 0.005, b.z + nz * rr * sg - uz * rr * 0.15);
        const mid = (sg) => new THREE.Vector3((S.x + b.x) / 2 + nx * rr * 0.75 * sg, (S.y + b.y) / 2, (S.z + b.z) / 2 + nz * rr * 0.75 * sg);
        pts.push(mid(1), side(1), ...wrap(b.y + 0.01, 1, 9, 10), side(-1), mid(-1), S.clone().add(new THREE.Vector3(ux * 0.02, 0, uz * 0.02)));
      }
      if (!this.ropePts) this.ropePts = new Map();
      this.ropePts.set(line.id, pts);
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const geo = new THREE.TubeGeometry(curve, Math.min(360, pts.length * 3), line.isMooring ? 0.035 : 0.04, 8, false);
      let mesh = this.ropeMeshes.get(line.id);
      if (!mesh) {
        mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, flatShading: false }));
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.ropeMeshes.set(line.id, mesh);
      } else {
        mesh.geometry.dispose();
        mesh.geometry = geo;
      }
      mesh.material.color.setHex(line.isMooring && line.state !== 'attached' ? 0x9aa19f : this.ropeColor(line));
      // cienka linia wzdłuż liny – zawsze co najmniej 1 piksel, więc lina (i obie nitki na biegowo) jest widoczna przy każdej rozdzielczości
      {
        const lp = curve.getPoints(Math.min(360, pts.length * 3));
        if (!mesh.userData.thin) { mesh.userData.thin = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff })); this.scene.add(mesh.userData.thin); }
        const th = mesh.userData.thin; th.geometry.dispose(); th.geometry = new THREE.BufferGeometry().setFromPoints(lp);
        th.material.color.copy(mesh.material.color); th.visible = mesh.visible;
      }
      if (line.selected) mesh.material.emissive.setHex(0x224466); else mesh.material.emissive.setHex(0x000000);
    }
    for (const [id, mesh] of this.ropeMeshes) {
      if (!alive.has(id)) { this.scene.remove(mesh); mesh.geometry.dispose(); if (mesh.userData.thin) { this.scene.remove(mesh.userData.thin); mesh.userData.thin.geometry.dispose(); } this.ropeMeshes.delete(id); this.ropePts.delete(id); }
    }
    // zwoje przygotowanych lin na pokładzie
    const coilAlive = new Set();
    for (const line of w.lines) {
      if (line.state !== 'ready' && line.state !== 'queued') continue;
      coilAlive.add(line.id);
      let c = this.coilMeshes.get(line.id);
      if (!c) {
        c = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 4, 10), mat(0xf0ede4));
        c.rotation.x = Math.PI / 2;
        this.boat.userData.heel.add(c);
        this.coilMeshes.set(line.id, c);
      }
      const l = w.leadLocal(line);
      const cl = w.deckItem(line.cleatId);
      c.position.set(cl.x - Math.sign(cl.x || 1) * 0.3, sheerHeight(w.spec, cl.x) + 0.06, cl.y * 0.8);
      c.material = line.selected ? mat(0x7fd1ff) : mat(0xf0ede4);
    }
    for (const [id, c] of this.coilMeshes) {
      if (!coilAlive.has(id)) { this.boat.userData.heel.remove(c); this.coilMeshes.delete(id); }
    }
  }

  // ---------- Klatka ----------
  render(dt, camDt = dt) {
    const w = this.world, b = w.boat, spec = w.spec;
    const windKn = w.env.windSpeed / 0.5144;
    const windDir = (w.env.windFromDeg + 180) * DEG;
    this.water.update(dt, windKn, windDir, b.x, b.z);
    // Y-bomy kołyszą się na fali – obrót wokół mocowania przy kei
    if (this.harbor && this.harbor.booms) for (const bo of this.harbor.booms) {
      const tx = bo.f.bx + bo.f.nx * bo.len, tz = bo.f.bz + bo.f.nz * bo.len;
      const hgt = this.water.heightAt(tx, tz, windKn, windDir) * 0.5;
      bo.tilt.rotation.z = clamp(hgt / bo.len, -0.025, 0.025);
    }

    // jacht
    // kołysanie z fizyki (to samo, które zmienia naciąg cum)
    const sea = w.sea || { heave: this.water.heightAt(b.x, b.z, windKn, windDir) * 0.6, roll: 0, pitch: 0 };
    this.boat.position.set(b.x, sea.heave, b.z);
    this.boat.rotation.y = -b.th;
    const heel = this.boat.userData.heel;
    const t = performance.now() / 1000;
    heel.rotation.x = b.heelAngle() + sea.roll;
    heel.rotation.z = sea.pitch;
    this.selRing.material.opacity = 0.16 + 0.07 * Math.sin(t * 2.5); // delikatny obrys
    // obrys dna kadłuba tylko w pobliżu keji (do 0,2 nm = 370 m)
    const bq = this.world.H.berth;
    this.selRing.visible = !this.world.isPassage && (!bq || Math.hypot(b.x - bq.x, b.z - bq.z) < 370);
    // koła sterowe
    for (const wh of this.boat.userData.wheels) wh.rotation.x = b.rudder * 4;
    // śruba
    const prop = this.boat.userData.propeller;
    if (prop) prop.rotation.x += b.gear * b.rpm * dt * 40;
    // windex – wskazuje kierunek wiatru pozornego
    if (this.boat.userData.windex && b.dbg.appAngle !== undefined) this.boat.userData.windex.rotation.y = -b.dbg.appAngle + Math.PI;
    if (this.boat.userData.flag && b.dbg.appAngle !== undefined) {
      (this.boat.userData.flag.userData.swivel || this.boat.userData.flag).rotation.y = -b.dbg.appAngle + Math.PI / 2 + Math.sin(t * 2.2) * 0.06;
      waveFlag(this.boat.userData.flag, t, Math.hypot(w.env.windVec().x, w.env.windVec().z) / 0.5144);
    }

    // poler / knaga, na które zaplanowano założenie cumy – delikatnie pulsuje, żeby było wiadomo, gdzie podpłynąć
    if (!w.isPassage) this.updatePlannedTargets(t);

    // platforma rufowa: płynne opuszczanie / podnoszenie (ok. 4 s)
    {
      const pf = this.boat.userData.platform;
      if (pf) {
        const want = this.platformOpen ? 1 : 0, cur = pf.userData.open || 0;
        if (Math.abs(want - cur) > 1e-3) {
          this._pfLin = clamp((this._pfLin ?? cur) + Math.sign(want - cur) * dt / 4, 0, 1);
          const e = this._pfLin, k = e * e * (3 - 2 * e);
          setTransomPlatform(pf, k);
          if (Math.abs(this._pfLin - want) < 1e-3) setTransomPlatform(pf, want);
        }
      }
    }

    // odbijacze
    const rf = w.equip.fenderRadius;
    let ropeIdx = -1;
    const { xs: xsF, xb: xbF } = hullExtents(spec);
    for (const { mesh, f } of this.fenders.values()) {
      ropeIdx++;
      const out = f.stern ? w.fenderOut.stern : f.side < 0 ? w.fenderOut.port : w.fenderOut.starboard;
      if (!out) {
        // schowany: leży na pokładzie (bez linki)
        mesh.visible = false;
        if (this.fenderRopes) this.fenderRopes.geometry.attributes.position.array.fill(0, ropeIdx * 6, ropeIdx * 6 + 6);
        continue;
      }
      mesh.visible = true;
      // ściśnięcie: odbijacz mieści się między burtą a przeszkodą (najwyżej do 40% grubości)
      const comp = clamp(w.fenderState[f.id] || 0, 0, 1.2);
      const g = fenderGeom(spec, f, rf);
      const k = Math.max(0.4, 1 - comp * 0.5);
      const hy = f.ball ? Math.max(g.r + 0.05, 0.45 + spec.freeboard * 0.1) : f.stern ? 0.55 : 0.5 + spec.freeboard * 0.15;
      // kołysanie na lince jak wahadło (zawieszenie u góry); dociśnięty do kei – nieruchomy
      if (mesh.userData.ph === undefined) { let hh = 0; for (const ch of String(f.id)) hh = (hh * 31 + ch.charCodeAt(0)) % 997; mesh.userData.ph = hh / 997 * 6.28; }
      const gapF = w.fenderGap ? (w.fenderGap[f.id] ?? 9) : 9;
      const free = clamp(1 - comp * 4, 0, 1) * clamp((gapF - 0.03) / 0.35, 0, 1), ph = mesh.userData.ph; // przy kei kołysanie wygasa
      const swA = free * (0.07 + Math.min(0.06, (w.env.windVec ? Math.hypot(w.env.windVec().x, w.env.windVec().z) : 4) * 0.006)) * Math.sin(t * 1.5 + ph) + free * 0.025 * Math.sin(t * 2.7 + ph * 1.7);
      const swB = free * 0.03 * Math.sin(t * 1.15 + ph * 0.6) + 0.02 * free; // lekko od burty
      const hh2 = f.ball ? g.r + 0.25 : rf * 2.2; // odległość od środka do punktu zawieszenia
      const ry = f.stern ? 0 : -Math.atan2(g.n.y, g.n.x);
      const tx = f.stern ? 0 : -g.n.y, tz = f.stern ? 1 : g.n.x; // styczna do burty w układzie jachtu
      const nxw = f.stern ? -1 : g.n.x, nzw = f.stern ? 0 : g.n.y;
      mesh.position.set(g.x - g.n.x * g.r * (1 - k) - tx * hh2 * Math.sin(swA) + nxw * hh2 * Math.sin(swB), hy, g.y - g.n.y * g.r * (1 - k) - tz * hh2 * Math.sin(swA) + nzw * hh2 * Math.sin(swB));
      mesh.rotation.order = 'YXZ';
      mesh.rotation.set(swA, ry, swB);
      // linka: od ucha odbijacza do relingu/listwy przy krawędzi pokładu nad nim
      if (this.fenderRopes) {
        mesh.updateMatrix();
        const top = new THREE.Vector3(0, mesh.userData.top || rf * 2.6, 0).applyMatrix4(mesh.matrix);
        const ax = f.stern ? xsF + 0.08 : clamp(g.x, xsF + 0.2, xbF - 0.2);
        const az = f.stern ? g.y : Math.sign(f.side) * halfBeamAt(spec, ax) * 0.96;
        const arr = this.fenderRopes.geometry.attributes.position.array, o2 = ropeIdx * 6;
        arr[o2] = top.x; arr[o2 + 1] = top.y; arr[o2 + 2] = top.z;
        arr[o2 + 3] = ax; arr[o2 + 4] = sheerHeight(spec, ax) + 0.04; arr[o2 + 5] = az;
      }
      mesh.scale.set(k, 1, 1); // ściśnięcie wzdłuż normalnej (lokalna oś x po obrocie)
    }

    if (this.fenderRopes) this.fenderRopes.geometry.attributes.position.needsUpdate = true;

    // załoga: każda lina w pracy (zakładanie z pokładu, wybieranie, luzowanie) dostaje własnego członka załogi
    this.deckhand.visible = !(w.crew.ashore) && this.cam.mode !== 'fpv';
    if (!w.isPassage) this.updateDeckCrew(dt, t);
    else this.deckhand.position.lerp(this.deckhandTarget, clamp(dt * 1.5, 0, 1));
    this.shoreCrew.visible = w.crew.ashore;
    if (w.crew.ashore) {
      const gy = this.groundHeightAt(w.crew.x, w.crew.z);
      this.shoreCrew.position.set(w.crew.x, gy + (w.crew.walking ? Math.abs(Math.sin(t * 5.2)) * 0.03 : 0), w.crew.z);
      animatePerson(this.shoreCrew, t, !!w.crew.walking, !w.crew.walking && w.lines.some((l) => l.state === 'pending' && l.pendingVia === 'crew'));
      if (w.crew.heading !== undefined) this.shoreCrew.rotation.y = -w.crew.heading + Math.PI / 2;
    }

    this.updateRopes();
    this.boat.updateMatrixWorld(true);
    this.updateCrewTags();
    this.seasick.update(dt);
    // bandery sąsiadów łopoczą zgodnie z wiatrem
    {
      const wv = w.env.windVec(), wsp = Math.hypot(wv.x, wv.z);
      for (const n of w.H.neighbors) {
        if (!n._flag) continue;
        const c = Math.cos(n.th), s = Math.sin(n.th);
        const mx = wv.x * c + wv.z * s, mz = -wv.x * s + wv.z * c;
        (n._flag.userData.swivel || n._flag).rotation.y = Math.atan2(-mx, -mz) + Math.sin(t * 2 + n._flagPhase) * Math.min(0.12, 0.03 + wsp * 0.006);
        waveFlag(n._flag, t, wsp / 0.5144, n._flagPhase);
      }
    }
    this.life.update(dt);
    // załoga ukryta w ustawieniach grafiki (praca na linach działa dalej, tylko bez postaci)
    if (getSettings().gfx.crew === false) {
      for (const p of [this.helmsman, this.deckhand, this.mate1, this.mate2, this.shoreCrew]) if (p) p.visible = false;
      if (this.tags) this.tags.style.display = 'none';
    } else if (this.tags && this.tags.style.display === 'none') this.tags.style.display = '';

    // znacznik stanowiska
    {
      const ml = w.lines.find((l) => l.isMooring && l.state === 'onQuay');
      this.murMarker.visible = !!ml;
      if (ml) {
        if ((this._murT = (this._murT || 0) - dt) <= 0) { this._murT = 0.4; w.chooseMooring(ml); }
        const p = ml.muring.pickup;
        this.murMarker.position.set(p.x, w.H.quay.height + 0.08, p.z);
        this.murMarker.scale.setScalar(1 + 0.18 * Math.sin(t * 4));
      }
    }
    if (this.routeArrow) { this.updateRoute(); this.routeArrow.material.opacity = 0.22 + 0.12 * Math.sin(t * 2.2); }
    if (this.berthMarker.visible) {
      const ok = w.poseOk;
      const col = ok ? (w.linesOk ? 0x3ddc84 : 0xffd166) : 0x7fd1ff;
      this.berthMarker.userData.line.material.color.setHex(col);
      this.berthMarker.userData.fill.material.color.setHex(col);
      this.berthMarker.userData.fill.material.opacity = 0.06 + 0.03 * Math.sin(t * 3);
    }

    // cząsteczki: strumień zaśrubowy, stery strumieniowe
    const c = Math.cos(b.th), s = Math.sin(b.th);
    if (b.gear !== 0 && b.rpm > 0.25 && Math.random() < b.rpm * 1.4) {
      const pp = localToWorld(b.x, b.z, b.th, b.xProp - 0.4, 0);
      const dir = -b.gear;
      const sp = 1.5 + b.rpm * 3;
      if (Math.random() < 0.2) this.spawn(pp.x, pp.z, c * dir * sp + b.vx, s * dir * sp + b.vz, 0.8 + b.rpm * 0.6);
    }
    for (const [kind, x] of [['bow', b.xBow], ['stern', b.xStern]]) {
      const out = b[kind + 'Out'];
      if (Math.abs(out) > 0.2) {
        const side = -Math.sign(out);
        const hb = halfBeamAt(spec, x);
        const p = localToWorld(b.x, b.z, b.th, x, side * hb);
        const nx = -s * side, nz = c * side;
        for (let k = 0; k < 2; k++) this.spawn(p.x, p.z, nx * 3 + b.vx, nz * 3 + b.vz, 1.0);
      }
    }
    this.updateWake(dt, t, w.env.windSpeed / 0.5144, (w.env.windFromDeg + 180) * DEG);
    this.updatePropWash(dt, t, w.env.windSpeed / 0.5144, (w.env.windFromDeg + 180) * DEG);
    // fala dziobowa (delikatna)
    const spd = b.speed;
    if (spd > 0.8 && Math.random() < spd * 0.2) {
      const bw = localToWorld(b.x, b.z, b.th, b.xb - 0.3, (Math.random() - 0.5) * 0.6);
      this.spawn(bw.x, bw.z, b.vx * 0.3 + (Math.random() - 0.5), b.vz * 0.3 + (Math.random() - 0.5), 1.8);
    }
    const P = this.particles, pa = P.geo.attributes.position.array, al = P.geo.attributes.alpha.array;
    for (let i = 0; i < P.data.length; i++) {
      const p = P.data[i];
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt; p.z += p.vz * dt;
        p.vx *= 1 - dt * 1.2; p.vz *= 1 - dt * 1.2;
      }
      pa[i * 3] = p.x; pa[i * 3 + 1] = p.life > 0 ? 0.1 : -50; pa[i * 3 + 2] = p.z;
      al[i] = Math.max(0, p.life / p.max);
    }
    P.geo.attributes.position.needsUpdate = true;
    P.geo.attributes.alpha.needsUpdate = true;

    // chorągiewki wiatru: siatka wzdłuż i w poprzek wiatru, płasko na wodzie; przesuwają się z wiatrem bazowym (bez porywów)
    const ws = this.windStreaks;
    if (ws.visible) {
      const wp = ws.geometry.attributes.position.array, U = ws.userData;
      const baseKn = Math.min(w.env.w.windKn || 0, w.env.w.maxKn ?? Infinity);
      const bth = (w.env.w.windFrom + 180) * DEG; // kierunek „do” wiatru bazowego
      const ax = Math.sin(bth), az = -Math.cos(bth); // z wiatrem
      const ux = -ax, uz = -az; // ku nawietrznej
      const px = -uz, pz = ux; // kreski na jedną stronę drzewca
      const SEG = 9, SH = 2.3, BL = 0.7, BS = 0.3, GS = U.GS, n = U.n;
      U.phase = (U.phase + dt * baseKn * 0.5144 * 0.3) % GS; // tempo proporcjonalne do wiatru
      let r5 = Math.round(baseKn / 5);
      const pen = Math.floor(r5 / 10); r5 -= pen * 10;
      const full = Math.min(4, Math.floor(r5 / 2)), half5 = r5 % 2;
      // obszar: cała mapa portu albo kwadrat wokół kamery
      const B = U.B || { minX: this.cam.tx - 60, maxX: this.cam.tx + 60, minZ: this.cam.tz - 60, maxZ: this.cam.tz + 60 };
      const mx = (B.minX + B.maxX) / 2, mz = (B.minZ + B.maxZ) / 2;
      // współrzędne węzłów w osiach wiatru zakotwiczone w świecie (linie się nie przesuwają przy ruchu kamery)
      const a0 = Math.floor((mx * ax + mz * az) / GS) - Math.floor(n / 2), p0 = Math.floor((mx * px + mz * pz) / GS) - Math.floor(n / 2);
      // nad falą z zapasem rosnącym z wysokością fali (siatka wody między wierzchołkami bywa wyżej niż wynika ze wzoru)
      const lift = 0.12 + (0.04 + Math.min(windKn, 35) * 0.0045) * (this.water.waveGain || 1.9) * 0.9;
      const sy = (x, z) => this.water.surfaceY(x, z, windKn, windDir) + lift;
      for (let i = 0; i < n * n; i++) {
        const ia = a0 + (i % n), ip = p0 + Math.floor(i / n);
        const sa = ia * GS + U.phase, sp = ip * GS + (ia & 1) * GS * 0.5; // co drugi rząd przesunięty – mniej „kratki”
        const cx = ax * sa + px * sp, cz = az * sa + pz * sp;
        let o = i * SEG * 6, k = 0;
        if (cx < B.minX || cx > B.maxX || cz < B.minZ || cz > B.maxZ) { wp.fill(-60, o, o + SEG * 6); continue; } // poza mapą – schowane pod dnem
        const hx = cx - ux * SH / 2, hz = cz - uz * SH / 2;
        const tx = hx + ux * SH, tz = hz + uz * SH;
        const yh = sy(hx, hz), yt = sy(tx, tz);
        const seg = (x1, z1, x2, z2, y1 = yt, y2 = yt) => { if (k >= SEG) return; wp[o++] = x1; wp[o++] = y1; wp[o++] = z1; wp[o++] = x2; wp[o++] = y2; wp[o++] = z2; k++; };
        seg(hx, hz, tx, tz, yh, yt);
        let d = 0;
        // kreska wyrasta z drzewca d metrów od nawietrznego końca i odchyla się ku wiatrowi (jak na mapach)
        const tip = (s0, l) => { const bx = tx - ux * s0, bz = tz - uz * s0; return [bx, bz, bx + (px + ux * 0.45) * l, bz + (pz + uz * 0.45) * l]; };
        for (let j = 0; j < pen; j++) {
          const [bx, bz, ex, ez] = tip(d, BL);
          seg(bx, bz, ex, ez);
          seg(ex, ez, bx - ux * BS * 1.3, bz - uz * BS * 1.3);
          d += BS * 1.6;
        }
        for (let j = 0; j < full; j++) { const [bx, bz, ex, ez] = tip(d, BL); seg(bx, bz, ex, ez); d += BS; }
        if (half5) { if (!pen && !full) d += BS; const [bx, bz, ex, ez] = tip(d, BL * 0.55); seg(bx, bz, ex, ez); }
        while (k < SEG) { wp[o++] = hx; wp[o++] = yh; wp[o++] = hz; wp[o++] = hx; wp[o++] = yh; wp[o++] = hz; k++; }
      }
      ws.geometry.attributes.position.needsUpdate = true;
      // po zmroku chorągiewki gasną – na ciemnej wodzie wyglądałyby jak jasne kreski
      const dark = this.atmo ? this.atmo.night || 0 : 0;
      ws.material.opacity = clamp(baseKn / 30, 0.04, 0.3) * (1 - 0.85 * dark);
      ws.material.color.setRGB(0.78, 0.88, 0.94).multiplyScalar(1 - 0.55 * dark);
    }

    // kamera
    const cam = this.cam;
    if (cam.mode === 'helm' && cam.follow) {
      const want = 1.5 * Math.PI - b.th;
      let d = want - cam.az;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      cam.az += d * clamp(camDt * 1.5, 0, 1);
    }
    if (cam.follow) {
      cam.tx += (b.x - cam.tx) * clamp(camDt * 3, 0, 1);
      cam.tz += (b.z - cam.tz) * clamp(camDt * 3, 0, 1);
    }
    const fpv = cam.mode === 'fpv';
    // w widoku kapitana załoga na pokładzie zasłaniałaby widok – chowamy ją (załoga na lądzie zostaje widoczna)
    this.helmsman.visible = !fpv;
    this.mate1.visible = this.mate2.visible = !fpv;
    if (fpv) this.deckhand.visible = false;
    else if (!this.world.isPassage) this.deckhand.visible = !this.world.crew.ashore;
    else this.deckhand.visible = true;
    if (fpv) {
      // oczy kapitana przy kole sterowym; kamera kołysze się razem z jachtem
      const heel = this.boat.userData.heel;
      this.boat.updateMatrixWorld(true);
      const hp = this.helmsman.position;
      const eye = heel.localToWorld(new THREE.Vector3(hp.x - 0.15, hp.y + 1.62, hp.z));
      const cy = Math.cos(cam.fpvPitch);
      const look = heel.localToWorld(new THREE.Vector3(hp.x - 0.15 + Math.cos(cam.fpvYaw) * cy * 10, hp.y + 1.62 + Math.sin(cam.fpvPitch) * 10, hp.z - Math.sin(cam.fpvYaw) * cy * 10));
      this.camera.position.copy(eye);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(look);
      if (this.camera.fov !== cam.fov || this.camera.near !== 0.08) { this.camera.fov = cam.fov; this.camera.near = 0.08; this.camera.updateProjectionMatrix(); }
    } else {
      // płaszczyzna bliskiego cięcia odsunięta od obiektywu: maszty i olinowanie, które znajdą się tuż przed kamerą, nie zasłaniają widoku
      const near = Math.round(clamp(cam.dist * 0.3, 0.5, 7) * 10) / 10;
      if (this.camera.fov !== 32 || this.camera.near !== near) { this.camera.fov = 32; this.camera.near = near; this.camera.updateProjectionMatrix(); }
      const cx = cam.tx + Math.cos(cam.el) * Math.sin(cam.az) * cam.dist;
      const cz = cam.tz + Math.cos(cam.el) * Math.cos(cam.az) * cam.dist;
      const cy = Math.sin(cam.el) * cam.dist + (cam.ty || 0);
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(cam.tx, cam.ty || 0, cam.tz);
    }
    // pora dnia, pogoda, światła (słońce/księżyc podąża za kamerą – cienie)
    this.sky.position.set(cam.tx, 0, cam.tz);
    this.atmo.update(dt, camDt);
    if (this.sea) this.sea.update(t, this, windKn, windDir, this.atmo.lightsOn || 0);
    const sh = fpv ? 45 : clamp(cam.dist * 0.7, 30, 120);
    const sc = this.sun.shadow.camera;
    if (Math.abs(sc.right - sh) > 5) { sc.left = -sh; sc.right = sh; sc.top = sh; sc.bottom = -sh; sc.updateProjectionMatrix(); }

    // kołysanie sąsiadów
    for (const n of w.H.neighbors) {
      if (n._mesh) {
        n._mesh.position.y = Math.sin(t * 1.1 + n._mesh.userData.bobPhase) * 0.03;
        n._mesh.rotation.x = Math.sin(t * 0.8 + n._mesh.userData.bobPhase) * 0.01;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  groundHeightAt(x, z) {
    for (const o of this.world.obstacles) {
      if (!o.walk && o.kind !== 'boom') continue;
      if (x >= o.box.minX && x <= o.box.maxX && z >= o.box.minZ && z <= o.box.maxZ) return o.h;
    }
    return this.world.H.quay.height;
  }

  updateCrewTags() {
    const v = new THREE.Vector3();
    const fpv = this.cam.mode === 'fpv';
    for (const { p, el } of this.tagEls) {
      if (fpv || !p.visible) { el.style.display = 'none'; continue; }
      p.getWorldPosition(v);
      const s = this.project(v.x, v.y + 1.95, v.z);
      const dist = this.camera.position.distanceTo(v);
      if (!s.visible || dist > 70) { el.style.display = 'none'; continue; }
      el.style.display = 'block';
      el.style.transform = `translate(${s.x.toFixed(0)}px, ${s.y.toFixed(0)}px) translate(-50%, -100%)`;
    }
  }

  // Projekcja punktu świata na ekran (dla etykiet)
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const r = this.renderer.domElement;
    return { x: (v.x * 0.5 + 0.5) * r.clientWidth, y: (-v.y * 0.5 + 0.5) * r.clientHeight, visible: v.z < 1 };
  }

  dispose() {
    this._ro.disconnect();
    if (this.tags) this.tags.remove();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

const RING_OK = new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.9 });
const RING_BAD = new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.6 });
