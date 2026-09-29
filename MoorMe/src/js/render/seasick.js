// Choroba morska: przy wietrze > 20 kn od czasu do czasu ktoś z załogi idzie do relingu i rzyga za burtę.
// Wymiociny spadają na wodę i odpływają zgodnie z kierunkiem fal.
import * as THREE from 'three';
import { halfBeamAt } from '../data/boats.js';
import { sheerHeight } from './boatModel.js';
import { rng } from '../math.js';

const KN = 0.5144;

export class Seasick {
  constructor(view) {
    this.view = view;
    this.r = rng(Math.floor(Math.random() * 1e6));
    this.crew = [
      { p: view.mate1, name: view.crewNames[2] },
      { p: view.mate2, name: view.crewNames[3] }
    ];
    for (const c of this.crew) { c.p.rotation.order = 'YXZ'; c.home = c.p.position.clone(); c.homeYaw = c.p.rotation.y; }
    this.timer = 15 + this.r() * 20;
    this.cur = null;
    const geo = new THREE.IcosahedronGeometry(0.06, 0);
    const mtl = new THREE.MeshLambertMaterial({ color: 0xc7c46a });
    this.parts = Array.from({ length: 40 }, () => {
      const m = new THREE.Mesh(geo, mtl);
      m.visible = false;
      view.scene.add(m);
      return { m, mode: 'off', v: new THREE.Vector3(), t: 0 };
    });
    this.emit = 0;
  }

  spawn(pos, out, kn) {
    const p = this.parts.find((q) => q.mode === 'off');
    if (!p) return;
    p.mode = 'air'; p.t = 0;
    p.m.visible = true; p.m.scale.setScalar(0.7 + this.r() * 0.9);
    p.m.position.copy(pos);
    p.v.copy(out).multiplyScalar(1.1 + this.r() * 0.9);
    p.v.y = 0.2 + this.r() * 0.6;
    p.v.x += (this.r() - 0.5) * 0.4; p.v.z += (this.r() - 0.5) * 0.4;
  }

  update(dt) {
    const v = this.view, w = v.world, spec = w.spec;
    const kn = w.env.windSpeed / KN;
    const windDir = (w.env.windFromDeg + 180) * (Math.PI / 180);
    // cząstki: lot -> unoszenie na wodzie -> zanik
    const drift = new THREE.Vector3(Math.sin(windDir), 0, -Math.cos(windDir)).multiplyScalar(0.3 + kn * 0.02);
    for (const p of this.parts) {
      if (p.mode === 'off') continue;
      p.t += dt;
      const pos = p.m.position;
      if (p.mode === 'air') {
        p.v.y -= 9.8 * dt;
        pos.addScaledVector(p.v, dt);
        const sy = v.water.surfaceY(pos.x, pos.z, kn, windDir);
        if (pos.y <= sy + 0.02) { p.mode = 'float'; p.t = 0; }
      } else {
        pos.addScaledVector(drift, dt);
        pos.y = v.water.surfaceY(pos.x, pos.z, kn, windDir) + 0.025;
        const left = 30 - p.t;
        p.m.scale.setScalar(Math.max(0.01, Math.min(1, left / 6)) * 1.2);
        if (left <= 0) { p.mode = 'off'; p.m.visible = false; }
      }
    }
    // scenariusz osoby
    if (!this.cur) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 25 + this.r() * 35;
        if (kn > 20 && !w.crew.ashore) {
          const c = this.crew[Math.floor(this.r() * this.crew.length)];
          const wv = w.env.windVec();
          const th = w.boat.th;
          const wz = -wv.x * Math.sin(th) + wv.z * Math.cos(th); // wiatr w stronę sterburty (>0) – zawietrzna = sterburta
          const side = wz >= 0 ? 1 : -1;
          const x = c.home.x;
          c.rail = new THREE.Vector3(x, sheerHeight(spec, x) - 0.05, side * (halfBeamAt(spec, x) - 0.3));
          c.side = side;
          this.cur = { c, t: 0 };
          w.log(`${c.name} nie czuje się najlepiej…`);
        }
      }
      return;
    }
    const { c } = this.cur;
    const T = this.cur.t += dt;
    const p = c.p;
    const WALK = 2.5, RETCH = 3.4, BACK = 2.5;
    const ease = (u) => u * u * (3 - 2 * u);
    if (T < WALK) {
      const u = ease(T / WALK);
      p.position.lerpVectors(c.home, c.rail, u);
      p.rotation.set(0, c.side > 0 ? 0 : Math.PI, 0);
    } else if (T < WALK + RETCH) {
      const u = (T - WALK) / RETCH;
      p.position.copy(c.rail);
      const lean = Math.min(1, u * 4) * 0.95 - Math.max(0, u - 0.85) * 5;
      p.rotation.set(Math.max(0, lean) + Math.sin(T * 14) * 0.05 * (u > 0.15 && u < 0.8 ? 1 : 0), c.side > 0 ? 0 : Math.PI, 0);
      if (u > 0.25 && u < 0.75) {
        this.emit += dt * 14;
        p.updateMatrixWorld(true);
        while (this.emit >= 1) {
          this.emit -= 1;
          const mouth = p.localToWorld(new THREE.Vector3(0, 1.3, 0.32));
          const out = new THREE.Vector3(0, 0, c.side).transformDirection(v.boat.userData.heel.matrixWorld);
          this.spawn(mouth, out, kn);
        }
      }
    } else if (T < WALK + RETCH + BACK) {
      const u = ease((T - WALK - RETCH) / BACK);
      p.position.lerpVectors(c.rail, c.home, u);
      p.rotation.set(0, (c.side > 0 ? 0 : Math.PI) + (c.homeYaw - (c.side > 0 ? 0 : Math.PI)) * u, 0);
    } else {
      p.position.copy(c.home);
      p.rotation.set(0, c.homeYaw, 0);
      this.cur = null;
    }
  }
}
