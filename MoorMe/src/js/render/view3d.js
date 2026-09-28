// Widok 3D symulacji (kamera w rzucie izometrycznym jak w grach RTS)
import * as THREE from 'three';
import { buildBoat, buildDeckGear, buildFender, buildPerson, sheerHeight, mat } from './boatModel.js';
import { buildHarbor, Water } from './harborModel.js';
import { HarbourLife } from './life.js';
import { Atmosphere } from './atmosphere.js';
import { hullExtents, hullOutline, halfBeamAt, hullNormalAt } from '../data/boats.js';
import { localToWorld, DEG, clamp } from '../math.js';

export class View3D {
  constructor(container, world) {
    this.container = container;
    this.world = world;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fd3f0);
    scene.fog = new THREE.Fog(0xb7dcef, 220, 620);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 2000);
    this.camera = camera;
    // mniej światła rozproszonego = wyraźniejsze cienie
    const hemi = new THREE.HemisphereLight(0xdff2ff, 0x4a5a44, 0.8);
    scene.add(hemi);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
    sun.castShadow = true;
    const maxTex = renderer.capabilities.maxTextureSize || 4096;
    sun.shadow.mapSize.set(Math.min(4096, maxTex), Math.min(4096, maxTex));
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
    scene.add(sky);
    this.sky = sky;

    this.water = new Water(scene);
    const hb = buildHarbor(world.H, scene);
    this.harbor = hb;

    // nasz jacht
    const spec = world.spec;
    this.boat = buildBoat(spec, { bowThruster: world.equip.bowThruster, drive: world.equip.drive });
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
      out.forEach(([x, y], i) => { const [a, b] = sc(x, -y, 1); i ? shape.lineTo(a, b) : shape.moveTo(a, b); });
      const hole = new THREE.Path();
      [...out].reverse().forEach(([x, y], i) => { const [a, b] = sc(x, -y, 0.7); i ? hole.lineTo(a, b) : hole.moveTo(a, b); });
      shape.holes.push(hole);
      const rg = new THREE.ShapeGeometry(shape);
      rg.rotateX(-Math.PI / 2);
      this.selRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x5ee0ff, transparent: true, opacity: 0.8, depthWrite: false }));
      this.selRing.position.y = 0.07;
      this.boat.add(this.selRing);
    }

    // odbijacze
    this.fenders = new Map();
    for (const f of world.equip.fenders) {
      const m = buildFender(world.equip.fenderRadius);
      this.boat.userData.heel.add(m);
      this.fenders.set(f.id, { mesh: m, f });
    }

    // załoga: sternik + osoba na dziobie + osoba na lądzie
    this.helmsman = buildPerson(0xe63946);
    this.deckhand = buildPerson(0xf4a261);
    this.boat.userData.heel.add(this.helmsman, this.deckhand);
    const { xs, xb } = hullExtents(spec);
    this.helmsman.position.set(xs + 0.05 * spec.loa, sheerHeight(spec, xs) - 0.15, spec.beam * 0.27);
    this.helmsman.rotation.y = -Math.PI / 2;
    this.deckhandTarget = new THREE.Vector3(xb - 0.12 * spec.loa, sheerHeight(spec, xb - 0.12 * spec.loa), 0);
    this.deckhand.position.copy(this.deckhandTarget);
    this.shoreCrew = buildPerson(0xf4a261);
    this.shoreCrew.visible = false;
    scene.add(this.shoreCrew);

    // znacznik stanowiska
    this.berthMarker = this.makeBerthMarker();
    scene.add(this.berthMarker);

    // liny
    this.ropeMeshes = new Map();
    this.coilMeshes = new Map();

    // piana / bąble
    this.particles = this.makeParticles();
    scene.add(this.particles.points);
    // smugi wiatru
    this.windStreaks = this.makeWindStreaks();
    scene.add(this.windStreaks);

    // życie w porcie: mewy, spacerowicze, motorówka
    this.life = new HarbourLife(this);
    // pora dnia i pogoda
    this.atmo = new Atmosphere(this, world.cfg.weather || {});

    // wskaźnik kursu (strzałka na wodzie)
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // kamera
    this.cam = { tx: world.boat.x, tz: world.boat.z, dist: 55 + spec.loa * 1.5, az: -35 * DEG, el: 52 * DEG, follow: true };
    this.initControls();
    this.resize();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
  }

  makeBerthMarker() {
    const w = this.world, b = w.H.berth, spec = w.spec;
    const out = hullOutline(spec, 12);
    const pts = out.map(([x, y]) => new THREE.Vector3(x, 0.05, y));
    pts.push(pts[0].clone());
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.9 }));
    const grp = new THREE.Group();
    grp.add(line);
    const shape = new THREE.Shape();
    out.forEach(([x, y], i) => (i ? shape.lineTo(x, -y) : shape.moveTo(x, -y)));
    const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.16, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.04;
    grp.add(fill);
    // strzałka dziobu
    const arr = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 3), new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.6 }));
    arr.rotation.z = -Math.PI / 2;
    arr.position.set(hullExtents(spec).xb + 1.2, 0.1, 0);
    grp.add(arr);
    grp.position.set(b.x, 0.12, b.z);
    grp.rotation.y = -b.th;
    grp.userData.line = line;
    grp.userData.fill = fill;
    grp.visible = w.cfg.scenario === 'moor';
    return grp;
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
    const N = 80;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    m.frustumCulled = false;
    m.userData.items = Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 120, z: (Math.random() - 0.5) * 120, y: 1 + Math.random() * 6, life: Math.random() * 4 }));
    return m;
  }

  initControls() {
    const el = this.renderer.domElement;
    let drag = null;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, button: e.button, moved: false };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      this.updateMouse(e);
      if (!drag) { if (this.onHover) this.onHover(this.pick()); return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.button === 2 || (drag.button === 0 && e.shiftKey)) {
        this.cam.mode = 'free';
        this.cam.az -= dx * 0.006;
        this.cam.el = clamp(this.cam.el + dy * 0.004, 12 * DEG, 88 * DEG);
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
      if (drag && !drag.moved && drag.button === 0 && this.onClick) {
        this.updateMouse(e);
        this.onClick(this.pick());
      }
      drag = null;
    });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cam.dist = clamp(this.cam.dist * Math.exp(e.deltaY * 0.0012), 12, 320);
    }, { passive: false });
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
    return line ? { line } : null;
  }

  pickBollard() {
    const p = this.pick();
    return p && p.bollard ? p.bollard : null;
  }

  // Zwraca { deckItem } albo { bollard } pod kursorem (pokład ma pierwszeństwo)
  pick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const d = this.raycaster.intersectObjects(this.deckHits, false);
    if (d.length) return { deckItem: d[0].object.userData.deckItem };
    const rope = this.pickRope();
    if (rope) return rope;
    const hits = this.raycaster.intersectObjects(this.harbor.bollardMeshes, false);
    return hits.length ? { bollard: hits[0].object.userData.bollard } : null;
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
    this.cam.follow = true;
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
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
    if (q < 0.03) return 0xfff0c2;
    if (q < 0.15) return 0xffe28a;
    if (q < 0.35) return 0xffb347;
    if (q < 0.6) return 0xff7043;
    return 0xff2020;
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
        sag = slack > 0.01 ? Math.sqrt((3 * d * slack) / 8) : 0.02;
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
        if (cl && (cl.x !== lead.lx || cl.y !== lead.ly)) {
          const cw = localToWorld(w.boat.x, w.boat.z, w.boat.th, cl.x, cl.y);
          pts.push(new THREE.Vector3(cw.x, w.deckHeight(cl.x) + 0.12, cw.z));
        }
        for (const p of route.pts) pts.push(new THREE.Vector3(p.x, p.y, p.z));
        a = route.exit;
      } else pts.push(new THREE.Vector3(a.x, a.y, a.z));
      const N = 18;
      for (let i = 1; i <= N; i++) {
        const t = i / N;
        // zwis rośnie od burty – lina nie zapada się w kadłub tuż przy punkcie zejścia
        let y = a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * sag * Math.min(1, t * 4);
        if (!underwater) y = Math.max(y, 0.02);
        pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, y, a.z + (b.z - a.z) * t));
      }
      if (!this.ropePts) this.ropePts = new Map();
      this.ropePts.set(line.id, pts);
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const geo = new THREE.TubeGeometry(curve, pts.length * 2, line.isMooring ? 0.05 : 0.06, 12, false);
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
      if (line.selected) mesh.material.emissive.setHex(0x224466); else mesh.material.emissive.setHex(0x000000);
    }
    for (const [id, mesh] of this.ropeMeshes) {
      if (!alive.has(id)) { this.scene.remove(mesh); mesh.geometry.dispose(); this.ropeMeshes.delete(id); this.ropePts.delete(id); }
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
    this.water.update(dt, windKn, windDir);

    // jacht
    const bob = this.water.heightAt(b.x, b.z, windKn, windDir) * 0.6;
    this.boat.position.set(b.x, bob, b.z);
    this.boat.rotation.y = -b.th;
    const heel = this.boat.userData.heel;
    const t = performance.now() / 1000;
    heel.rotation.x = b.heelAngle() + Math.sin(t * 1.3) * 0.006 * (1 + windKn / 10);
    heel.rotation.z = Math.sin(t * 0.9 + 1) * 0.004 * (1 + windKn / 10);
    this.selRing.material.opacity = 0.45 + 0.35 * Math.sin(t * 2.5);
    // koła sterowe
    for (const wh of this.boat.userData.wheels) wh.rotation.x = b.rudder * 4;
    // śruba
    const prop = this.boat.userData.propeller;
    if (prop) prop.rotation.x += b.gear * b.rpm * dt * 40;
    // windex – wskazuje kierunek wiatru pozornego
    if (this.boat.userData.windex && b.dbg.appAngle !== undefined) this.boat.userData.windex.rotation.y = -b.dbg.appAngle + Math.PI;
    if (this.boat.userData.flag && b.dbg.appAngle !== undefined) this.boat.userData.flag.rotation.y = -b.dbg.appAngle + Math.PI / 2 + Math.sin(t * 6) * 0.15;

    // odbijacze
    const rf = w.equip.fenderRadius;
    for (const { mesh, f } of this.fenders.values()) {
      const out = f.stern ? w.fenderOut.stern : f.side < 0 ? w.fenderOut.port : w.fenderOut.starboard;
      if (!out) {
        // schowany: leży na pokładzie
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const comp = w.fenderState[f.id] || 0;
      if (f.stern) {
        mesh.position.set(b.xs - rf * 0.9, 0.55, f.side * spec.beam * 0.28);
        mesh.rotation.set(0, 0, 0);
        mesh.scale.set(1 - comp * 0.5, 1, 1);
      } else {
        const hb = halfBeamAt(spec, f.x);
        const n = hullNormalAt(spec, f.x, f.side);
        mesh.position.set(f.x + n.x * rf * (1 - comp * 0.5), 0.5 + spec.freeboard * 0.15, f.side * hb + n.y * rf * (1 - comp * 0.5));
        mesh.rotation.set(0, 0, 0);
        mesh.scale.set(1, 1, 1 - comp * 0.55);
      }
    }

    // załoga
    const busyLine = w.lines.find((l) => l.selected) || w.lines.find((l) => l.state === 'pending' && l.pendingVia === 'deck');
    if (busyLine) {
      const cl = w.deckItem(busyLine.cleatId);
      if (cl) this.deckhandTarget.set(cl.x - Math.sign(cl.x) * 0.5, sheerHeight(spec, cl.x) + 0.02, cl.y * 0.55);
    }
    this.deckhand.visible = !(w.crew.ashore);
    this.deckhand.position.lerp(this.deckhandTarget, clamp(dt * 1.5, 0, 1));
    this.shoreCrew.visible = w.crew.ashore;
    if (w.crew.ashore) {
      const gy = this.groundHeightAt(w.crew.x, w.crew.z);
      this.shoreCrew.position.set(w.crew.x, gy + (w.crew.walking ? Math.abs(Math.sin(t * 8)) * 0.05 : 0), w.crew.z);
      if (w.crew.heading !== undefined) this.shoreCrew.rotation.y = -w.crew.heading + Math.PI / 2;
    }

    this.updateRopes();
    this.boat.updateMatrixWorld(true);
    this.life.update(dt);

    // znacznik stanowiska
    if (this.berthMarker.visible) {
      const ok = w.poseOk;
      const col = ok ? (w.linesOk ? 0x3ddc84 : 0xffd166) : 0x7fd1ff;
      this.berthMarker.userData.line.material.color.setHex(col);
      this.berthMarker.userData.fill.material.color.setHex(col);
      this.berthMarker.userData.fill.material.opacity = 0.12 + 0.06 * Math.sin(t * 3);
    }

    // cząsteczki: strumień zaśrubowy, stery strumieniowe
    const c = Math.cos(b.th), s = Math.sin(b.th);
    if (b.gear !== 0 && b.rpm > 0.25 && Math.random() < b.rpm * 1.4) {
      const pp = localToWorld(b.x, b.z, b.th, b.xProp - 0.4, 0);
      const dir = -b.gear;
      const sp = 1.5 + b.rpm * 3;
      for (let k = 0; k < 2; k++) this.spawn(pp.x, pp.z, c * dir * sp + b.vx, s * dir * sp + b.vz, 1.2 + b.rpm);
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
    // fala dziobowa
    const spd = b.speed;
    if (spd > 0.6 && Math.random() < spd * 0.4) {
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

    // smugi wiatru
    const wv = w.env.windVec();
    const ws = this.windStreaks, wp = ws.geometry.attributes.position.array;
    ws.userData.items.forEach((it, i) => {
      it.life -= dt;
      it.x += wv.x * dt; it.z += wv.z * dt;
      if (it.life <= 0 || Math.abs(it.x - this.cam.tx) > 70 || Math.abs(it.z - this.cam.tz) > 70) {
        it.x = this.cam.tx + (Math.random() - 0.5) * 120; it.z = this.cam.tz + (Math.random() - 0.5) * 120;
        it.life = 2 + Math.random() * 3; it.y = 1 + Math.random() * 8;
      }
      const len = 0.12 * w.env.windSpeed;
      const n = Math.hypot(wv.x, wv.z) || 1;
      wp[i * 6] = it.x; wp[i * 6 + 1] = it.y; wp[i * 6 + 2] = it.z;
      wp[i * 6 + 3] = it.x - (wv.x / n) * len; wp[i * 6 + 4] = it.y; wp[i * 6 + 5] = it.z - (wv.z / n) * len;
    });
    ws.geometry.attributes.position.needsUpdate = true;
    ws.material.opacity = clamp(windKn / 25, 0.05, 0.5);

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
    const cx = cam.tx + Math.cos(cam.el) * Math.sin(cam.az) * cam.dist;
    const cz = cam.tz + Math.cos(cam.el) * Math.cos(cam.az) * cam.dist;
    const cy = Math.sin(cam.el) * cam.dist + (cam.ty || 0);
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(cam.tx, cam.ty || 0, cam.tz);
    // pora dnia, pogoda, światła (słońce/księżyc podąża za kamerą – cienie)
    this.atmo.update(dt, camDt);
    const sh = clamp(cam.dist * 0.7, 30, 120);
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

  // Projekcja punktu świata na ekran (dla etykiet)
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const r = this.renderer.domElement;
    return { x: (v.x * 0.5 + 0.5) * r.clientWidth, y: (-v.y * 0.5 + 0.5) * r.clientHeight, visible: v.z < 1 };
  }

  dispose() {
    this._ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

const RING_OK = new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.9 });
const RING_BAD = new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.6 });
