// Życie w porcie: mewy (latają, siadają na salingach i polerach), spacerowicze, motorówka w oddali
import * as THREE from 'three';
import { mat, buildPerson } from './boatModel.js';
import { rng, clamp } from '../math.js';

const V = () => new THREE.Vector3();

function buildGull() {
  const g = new THREE.Group();
  const white = mat(0xf7f7f5), grey = mat(0xb8bfc6), dark = mat(0x2a2d31), yellow = mat(0xf2b632);
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), white);
  body.scale.set(0.8, 0.75, 1.9);
  g.add(body);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), white);
  head.position.set(0, 0.09, 0.3);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), yellow);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.07, 0.43);
  g.add(beak);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.16), grey);
  tail.position.set(0, 0.02, -0.34);
  g.add(tail);
  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.09, 0.06, 0.02);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.2), grey);
    inner.position.x = s * 0.17;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.14), grey);
    tip.position.x = s * 0.47;
    const black = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.12), dark);
    black.position.x = s * 0.62;
    pivot.add(inner, tip, black);
    g.add(pivot);
    wings.push({ pivot, s });
  }
  // nogi (widoczne na siedząco)
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.03), yellow);
  legs.position.set(0, -0.14, 0.02);
  g.add(legs);
  g.userData = { wings, legs };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(1.35);
  return g;
}

function buildMotorboat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.7, 2.0), mat(0xf2f2f2));
  hull.position.y = 0.3;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.4, 4), mat(0xf2f2f2));
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.x = Math.PI / 4;
  bow.scale.set(1, 1, 0.5);
  bow.position.set(3.3, 0.35, 0);
  g.add(bow);
  const tube = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.18, 2.1), mat(0x2b3a4a));
  tube.position.y = 0.55;
  g.add(tube);
  const console_ = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat(0xdcdcdc));
  console_.position.set(0.2, 1.0, 0);
  g.add(console_);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.8), mat(0x223344, { rough: 0.2, metal: 0.4 }));
  screen.position.set(0.62, 1.5, 0);
  screen.rotation.z = 0.4;
  g.add(screen);
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), mat(0x222222));
  engine.position.set(-2.8, 0.7, 0);
  g.add(engine);
  const driver = buildPerson(0x2a9d8f);
  driver.position.set(-0.5, 0.65, 0);
  driver.rotation.y = -Math.PI / 2;
  g.add(driver);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class HarbourLife {
  constructor(view) {
    this.view = view;
    this.world = view.world;
    this.scene = view.scene;
    this.r = rng(1234);
    this.t = 0;
    this.onCry = null;
    this.buildGulls();
    this.buildPeople();
    this.buildMotorboat();
  }

  // ---------- Mewy ----------
  perchList() {
    const list = [];
    const up = 0.24; // tułów mewy nad drzewcem / polerem
    const own = this.view.boat.userData;
    for (const p of own.perches || []) list.push({ weight: 3, own: true, get: (v) => own.heel.localToWorld(v.set(p[0], p[1] + up, p[2])) });
    for (const n of this.world.H.neighbors) {
      const m = n._mesh;
      if (!m || !m.userData.perches) continue;
      for (const p of m.userData.perches) list.push({ weight: 0.35, get: (v) => m.localToWorld(v.set(p[0], p[1] + up, p[2])) });
    }
    for (const b of this.world.H.bollards) {
      if (b.kind === 'pile') list.push({ weight: 1, get: (v) => v.set(b.x, b.h + 0.95, b.z) });
      else if (b.kind === 'bollard' && this.r() < 0.3) list.push({ weight: 0.3, get: (v) => v.set(b.x, b.h + 0.95, b.z) });
    }
    return list;
  }

  buildGulls() {
    this.perches = this.perchList();
    this.gulls = [];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const mesh = buildGull();
      this.scene.add(mesh);
      const g = {
        mesh,
        state: 'fly',
        pos: new THREE.Vector3((this.r() - 0.5) * 80, 12 + this.r() * 12, 20 + this.r() * 80),
        vel: new THREE.Vector3(6, 0, 0),
        center: new THREE.Vector3((this.r() - 0.5) * 60, 0, 30 + this.r() * 60),
        radius: 14 + this.r() * 22,
        alt: 10 + this.r() * 14,
        ang: this.r() * Math.PI * 2,
        dir: this.r() < 0.5 ? 1 : -1,
        timer: 6 + this.r() * 25,
        flap: this.r() * 10,
        perch: null,
        tmp: V()
      };
      this.gulls.push(g);
    }
    // jedna mewa od razu siedzi na salingu naszego jachtu – żeby było ją widać
    const first = this.gulls[0];
    const own = this.perches.find((p) => p.own);
    if (own) { first.state = 'perch'; first.perch = own; first.timer = 20; own.get(first.pos); }
  }

  pickPerch() {
    const free = this.perches.filter((p) => !this.gulls.some((g) => g.perch === p));
    const total = free.reduce((s, p) => s + p.weight, 0);
    let x = this.r() * total;
    for (const p of free) { x -= p.weight; if (x <= 0) return p; }
    return free[0] || null;
  }

  updateGull(g, dt) {
    const boatFast = this.world.boat.speed > 1.3;
    g.flap += dt;
    const w = g.mesh.userData.wings;
    if (g.state !== 'perch') for (const { pivot } of w) { pivot.rotation.y = 0; pivot.scale.x = 1; }
    const target = g.tmp;
    if (g.state === 'fly') {
      // krążenie (ze zmiennym środkiem, który dryfuje z wiatrem)
      g.ang += g.dir * dt * (6.5 / g.radius);
      const wv = this.world.env.windVec();
      g.center.x += wv.x * dt * 0.05; g.center.z += wv.z * dt * 0.05;
      if (Math.abs(g.center.x) > 110 || g.center.z < 5 || g.center.z > 190) g.center.set((this.r() - 0.5) * 60, 0, 30 + this.r() * 60);
      target.set(g.center.x + Math.cos(g.ang) * g.radius, g.alt + Math.sin(g.flap * 0.3) * 2, g.center.z + Math.sin(g.ang) * g.radius);
      this.steer(g, target, 7, dt, 1.6);
      g.timer -= dt;
      if (g.timer <= 0) {
        g.timer = 10 + this.r() * 25;
        if (this.r() < 0.6) {
          const p = this.pickPerch();
          if (p && !(p.own && boatFast)) { g.perch = p; g.state = 'approach'; }
        }
      }
      const glide = Math.sin(g.flap * 0.7) > 0.3;
      for (const { pivot, s } of w) pivot.rotation.z = glide ? s * 0.08 : s * Math.sin(g.flap * 11) * 0.7;
    } else if (g.state === 'approach') {
      g.perch.get(target);
      const d = target.distanceTo(g.pos);
      const spd = d > 10 ? 7 : Math.max(1.2, d * 0.7);
      if (d < 0.25) { g.state = 'perch'; g.timer = 8 + this.r() * 22; g.vel.set(0, 0, 0); }
      else {
        const above = target.clone();
        if (d > 3) above.y += Math.min(4, d * 0.3);
        this.steer(g, above, spd, dt, d < 3 ? 6 : 2.5);
      }
      for (const { pivot, s } of w) pivot.rotation.z = s * Math.sin(g.flap * (d < 4 ? 16 : 10)) * (d < 4 ? 0.9 : 0.6);
      if (g.perch.own && boatFast) { g.state = 'takeoff'; g.timer = 1.5; }
    } else if (g.state === 'perch') {
      g.perch.get(g.pos);
      g.mesh.position.copy(g.pos);
      // składa skrzydła, rozgląda się
      // skrzydła złożone wzdłuż tułowia
      for (const { pivot, s } of w) { pivot.rotation.set(0, s * 1.45, s * 0.12); pivot.scale.x = 0.62; }
      g.mesh.rotation.x = 0;
      g.mesh.rotation.y += Math.sin(g.flap * 0.8) * dt * 0.6;
      g.timer -= dt;
      if (this.r() < dt * 0.05 && this.onCry) this.onCry(g.pos);
      const spooked = g.perch.own && (boatFast || Math.abs(this.world.boat.bowOut) > 0.5);
      if (g.timer <= 0 || spooked) {
        g.state = 'takeoff';
        g.timer = 1.8;
        g.vel.set((this.r() - 0.5) * 3, 3, (this.r() - 0.5) * 3);
        if (spooked && this.onCry) this.onCry(g.pos);
      }
      g.mesh.userData.legs.visible = true;
      return;
    } else if (g.state === 'takeoff') {
      g.vel.y += dt * 3;
      g.pos.addScaledVector(g.vel, dt);
      g.timer -= dt;
      for (const { pivot, s } of w) pivot.rotation.z = s * Math.sin(g.flap * 16) * 0.95;
      if (g.timer <= 0) {
        g.state = 'fly';
        g.perch = null;
        g.center.set(g.pos.x + (this.r() - 0.5) * 30, 0, g.pos.z + (this.r() - 0.5) * 30);
        g.ang = Math.atan2(g.pos.z - g.center.z, g.pos.x - g.center.x);
      }
    }
    g.mesh.userData.legs.visible = false;
    g.mesh.position.copy(g.pos);
    if (g.vel.lengthSq() > 0.01) {
      const look = g.pos.clone().add(g.vel);
      g.mesh.lookAt(look);
    }
  }

  steer(g, target, speed, dt, agility) {
    const desired = target.clone().sub(g.pos);
    const d = desired.length();
    if (d > 1e-3) desired.multiplyScalar(Math.min(speed, d / Math.max(dt, 1e-3)) / d);
    g.vel.lerp(desired, clamp(dt * agility, 0, 1));
    g.pos.addScaledVector(g.vel, dt);
  }

  // ---------- Spacerowicze ----------
  buildPeople() {
    const H = this.world.H;
    const floating = H.quay.id === 'pontoon' || H.quay.id === 'yboom';
    this.landY = floating ? 1.2 : H.quay.height;
    // pas spacerowy między krawędzią kei a latarniami (bez kolizji z ławkami i budynkami)
    this.promenade = floating ? [-10.3, -12.8] : [-1.8, -4.2];
    const jackets = [0xe63946, 0x457b9d, 0xf4a261, 0x2a9d8f, 0x6d597a, 0xffffff, 0x264653, 0xe9c46a, 0x8ecae6];
    this.people = [];
    for (let i = 0; i < 16; i++) {
      const mesh = buildPerson(jackets[i % jackets.length]);
      const s = 0.92 + this.r() * 0.16;
      mesh.scale.setScalar(s);
      this.scene.add(mesh);
      const z = this.promenade[0] + (this.promenade[1] - this.promenade[0]) * this.r();
      const p = { mesh, x: (this.r() - 0.5) * 220, z, tx: 0, speed: 1.0 + this.r() * 0.5, wait: this.r() * 4, phase: this.r() * 6 };
      p.tx = p.x;
      this.people.push(p);
    }
  }

  updatePeople(dt) {
    for (const p of this.people) {
      if (p.wait > 0) {
        p.wait -= dt;
        p.mesh.position.set(p.x, this.landY, p.z);
        continue;
      }
      const dx = p.tx - p.x;
      if (Math.abs(dx) < 0.2) {
        p.tx = clamp(p.x + (this.r() - 0.5) * 80, -125, 125);
        p.wait = this.r() < 0.4 ? 2 + this.r() * 8 : 0;
        continue;
      }
      const s = Math.sign(dx) * Math.min(Math.abs(dx), p.speed * dt);
      p.x += s;
      p.phase += dt * p.speed * 5;
      p.mesh.position.set(p.x, this.landY + Math.abs(Math.sin(p.phase)) * 0.04, p.z);
      p.mesh.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  // ---------- Motorówka w oddali ----------
  buildMotorboat() {
    this.moto = buildMotorboat();
    this.scene.add(this.moto);
    this.motoAng = 0;
  }

  updateMotorboat(dt) {
    const cx = -80, cz = 170, rx = 42, rz = 16;
    this.motoAng += dt * (4.5 / ((rx + rz) / 2));
    const a = this.motoAng;
    const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz;
    const dx = -Math.sin(a) * rx, dz = Math.cos(a) * rz;
    this.moto.position.set(x, 0.05 + Math.sin(this.t * 3) * 0.04, z);
    this.moto.rotation.y = -Math.atan2(dz, dx);
    this.moto.rotation.z = 0.05;
    // kilwater
    if (this.r() < 0.9) {
      const n = Math.hypot(dx, dz) || 1;
      this.view.spawn(x - (dx / n) * 3, z - (dz / n) * 3, -(dx / n) * 1.5 + (this.r() - 0.5), -(dz / n) * 1.5 + (this.r() - 0.5), 2.2);
    }
  }

  update(dt) {
    if (dt <= 0) return;
    this.t += dt;
    for (const g of this.gulls) this.updateGull(g, dt);
    this.updatePeople(dt);
    this.updateMotorboat(dt);
    // okazjonalny krzyk mewy w locie
    if (this.onCry && this.r() < dt * 0.06) this.onCry(this.gulls[Math.floor(this.r() * this.gulls.length)].pos);
  }
}
