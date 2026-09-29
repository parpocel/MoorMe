// Podgląd 3D w kreatorze (jacht albo cały port) – lekki, osobny renderer z powolnym obrotem kamery
import * as THREE from 'three';
import { buildBoat } from './boatModel.js';
import { buildHarbor } from './harborModel.js';

export class Preview3D {
  constructor(el, caption = '') {
    this.el = el;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    this.renderer = r;
    el.appendChild(r.domElement);
    if (caption) { this.cap = document.createElement('div'); this.cap.className = 'cap'; this.cap.textContent = caption; el.appendChild(this.cap); }
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 3000);
    const hemi = new THREE.HemisphereLight(0xfff1e6, 0x6b8f96, 1.0);
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
    sun.position.set(-60, 90, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    this.sun = sun;
    this.scene.add(hemi, sun, sun.target);
    this.content = new THREE.Group();
    this.scene.add(this.content);
    this.target = new THREE.Vector3();
    this.dist = 30; this.el_ = 0.42; this.az = 2.4;
    this.auto = true; this.pauseUntil = 0;
    this.alive = true;
    this.bindDrag();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(el);
    this.resize();
    let last = performance.now();
    const loop = (t) => {
      if (!this.alive || !this.el.isConnected) { this.dispose(); return; }
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (this.auto && t > this.pauseUntil) this.az += dt * 0.25;
      this.updateCam();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  bindDrag() {
    const c = this.renderer.domElement;
    let drag = null;
    c.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); c.style.cursor = 'grabbing'; });
    c.addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.az -= (e.clientX - drag.x) * 0.008;
      this.el_ = Math.max(0.08, Math.min(1.3, this.el_ + (e.clientY - drag.y) * 0.006));
      drag = { x: e.clientX, y: e.clientY };
      this.pauseUntil = performance.now() + 3000;
    });
    const up = () => { drag = null; c.style.cursor = 'grab'; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.dist = Math.max(this.minDist || 8, Math.min(this.maxDist || 400, this.dist * Math.exp(e.deltaY * 0.001))); }, { passive: false });
  }

  updateCam() {
    const d = this.dist, e = this.el_;
    this.camera.position.set(this.target.x + Math.cos(this.az) * Math.cos(e) * d, this.target.y + Math.sin(e) * d, this.target.z + Math.sin(this.az) * Math.cos(e) * d);
    this.camera.lookAt(this.target);
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    this.scene.remove(this.content);
    this.content.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.content = new THREE.Group();
    this.scene.add(this.content);
  }

  water(size, y = 0) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(size, 48), new THREE.MeshLambertMaterial({ color: 0x8bc9c9 }));
    w.rotation.x = -Math.PI / 2;
    w.position.y = y;
    w.receiveShadow = true;
    return w;
  }

  setBoat(spec) {
    this.clear();
    const boat = buildBoat(spec, { color: 0xffffff, stripe: 0xffffff, name: 'ANNELIESE', sub: 'Bregge', split: true, flag: 'DE' });
    boat.userData.heel.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.content.add(this.water(spec.loa * 3), boat);
    this.target.set(0, spec.freeboard + 2.2, 0);
    this.dist = spec.loa * 1.5; this.minDist = spec.loa * 0.8; this.maxDist = spec.loa * 4;
    this.sun.shadow.camera.left = -spec.loa; this.sun.shadow.camera.right = spec.loa; this.sun.shadow.camera.top = spec.loa; this.sun.shadow.camera.bottom = -spec.loa;
    this.sun.shadow.camera.far = 300;
    this.sun.position.set(-spec.loa, spec.loa * 1.8, spec.loa * 0.8);
    this.sun.shadow.camera.updateProjectionMatrix();
    this.el_ = 0.28;
  }

  setHarbor(H, spec) {
    this.clear();
    const parent = new THREE.Scene(); // buildHarbor dodaje elementy do „sceny” – zbieramy je do grupy
    const res = buildHarbor(H, parent);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x8bc9c9, transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.05;
    this.content.add(water);
    while (parent.children.length) this.content.add(parent.children[0]);
    const boat = buildBoat(spec, { color: 0xffffff, stripe: 0xffffff, name: 'ANNELIESE', sub: 'Bregge', split: true, flag: 'DE' });
    boat.position.set(H.berth.x, 0, H.berth.z);
    boat.rotation.y = -H.berth.th;
    this.content.add(boat);
    const b = H.bounds;
    this.target.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    this.dist = span * 1.05; this.minDist = 40; this.maxDist = span * 2.2;
    this.el_ = 0.7;
    const sc = this.sun.shadow.camera;
    sc.left = -span * 0.6; sc.right = span * 0.6; sc.top = span * 0.6; sc.bottom = -span * 0.6; sc.far = 800;
    this.sun.position.set(this.target.x - span * 0.4, 260, this.target.z + span * 0.3);
    this.sun.target.position.copy(this.target);
    sc.updateProjectionMatrix();
    return res;
  }

  dispose() {
    if (!this.alive && this._disposed) return;
    this.alive = false; this._disposed = true;
    this._ro.disconnect();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
