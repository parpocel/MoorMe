// Moduł „Rozpoznawanie świateł”: nocą na otwartym morzu jacht płynie stałym kursem, a co jakiś czas na lewej
// albo prawej burcie pojawia się statek widoczny tylko po światłach. Trzeba rozpoznać, co to za jednostka i co robi.
import * as THREE from 'three';
import { h } from './dom.js';
import { SimScreen } from './simUI.js';
import { PassageScreen } from './passageUI.js';
import { PassageWorld } from '../physics/passage.js';
import { VESSELS, VESSEL_BY_ID, ASPECTS, COLORS, relBearing, aspectOf, visibleLights, spawnVessel, answerOptions } from '../data/shipLights.js';
import { DEG, KN, clamp, rng, thetaToCompass } from '../math.js';

const NM = 1852;
const pad3 = (d) => String(Math.round(((d % 360) + 360) % 360) % 360).padStart(3, '0');

// Otwarte morze bez lądu – świat zgodny z interfejsem PassageWorld / widoku rejsu
export function buildOpenSea() {
  const start = { x: 0, z: 0, compass: 90 };
  const route = [{ x: 0, z: 0, name: 'Start', i: 0 }, { x: 200000, z: 0, name: 'Meta – port', i: 1 }];
  return {
    passage: true, passageId: 'open', name: 'Otwarte morze', style: 'baltic', depthMax: 40, relief: 20,
    bounds: { minX: -100000, maxX: 300000, minZ: -100000, maxZ: 100000 },
    structures: [], coasts: [], moles: [], islands: [], shoals: [], wrecks: [], lighthouses: [], villages: [],
    marks: [], route, routeLength: 200000, start,
    neighbors: [], bollards: [], murings: [], deco: [], starts: [],
    berth: { x: 0, z: 0, th: 0, tolAlong: 1, tolAcross: 1, tolTh: 1, frame: null },
    quay: { height: 1 }, port: { walkways: [], motor: null }, method: 'passage', exitZone: null
  };
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

// Zwykła łódź wiosłowa (bez masztu i olinowania – nic nie zasłania widoku); poziom wody y = 0, dziób w stronę +x
export function buildRowboat() {
  const g = new THREE.Group();
  const N = 14, half = 1.9;
  const hb = (x) => 0.72 * Math.pow(Math.max(0, 1 - Math.pow((x + 0.15) / (half + 0.1), 2)), 0.55); // połowa szerokości
  const sheer = (x) => 0.34 + 0.12 * Math.pow(Math.abs(x) / half, 2); // linia burty wznosi się ku końcom
  const pos = [], idx = [];
  // przekroje: [burta L, dno L, dno P, burta P]
  for (let i = 0; i <= N; i++) {
    const x = -half + (2 * half * i) / N, b = Math.max(hb(x), 0.02);
    pos.push(x, sheer(x), -b, x, -0.14, -b * 0.55, x, -0.14, b * 0.55, x, sheer(x), b);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 4, c = (i + 1) * 4;
    for (let k = 0; k < 3; k++) idx.push(a + k, c + k, c + k + 1, a + k, c + k + 1, a + k + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const hull = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x7a4b2a, roughness: 0.8, flatShading: true, side: THREE.DoubleSide }));
  g.add(hull);
  const wood = new THREE.MeshStandardMaterial({ color: 0xb08050, roughness: 0.85, flatShading: true });
  // pawęż, ławki i burtnice
  const transom = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, hb(-half + 0.1) * 2 + 0.1), wood);
  transom.position.set(-half + 0.03, 0.14, 0);
  g.add(transom);
  for (const x of [-1.05, 0.05, 0.95]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, hb(x) * 2 - 0.06), wood);
    seat.position.set(x, 0.18, 0);
    g.add(seat);
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < N; i++) {
      const x0 = -half + (2 * half * i) / N, x1 = x0 + (2 * half) / N, xm = (x0 + x1) / 2;
      const rail = new THREE.Mesh(new THREE.BoxGeometry((2 * half) / N + 0.02, 0.05, 0.06), wood);
      rail.position.set(xm, sheer(xm) + 0.02, s * Math.max(hb(xm), 0.02));
      rail.rotation.y = -s * Math.atan2(hb(x1) - hb(x0), x1 - x0);
      g.add(rail);
    }
    // wiosło oparte o dulkę, pióro nad wodą
    const oar = new THREE.Group();
    const loom = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 6), wood);
    loom.rotation.z = Math.PI / 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.14), wood);
    blade.position.x = 1.45;
    oar.add(loom, blade);
    oar.position.set(-0.2, sheer(-0.2) + 0.08, s * (hb(-0.2) + 0.55));
    oar.rotation.y = s * 1.35;
    oar.rotation.z = -0.12;
    g.add(oar);
  }
  return g;
}

// Światła jednego statku w scenie 3D (punkty o stałej wielkości kątowej, widoczne tylko w swoich sektorach)
class ShipLightsLayer {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
    this.vessel = null;
  }
  set(vessel) {
    this.clear();
    this.vessel = vessel;
    for (const l of vessel.lights) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: COLORS[l.c], transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.renderOrder = 30;
      this.group.add(sp);
      this.items.push({ l, sp });
    }
  }
  clear() {
    for (const it of this.items) { this.group.remove(it.sp); it.sp.material.dispose(); }
    this.items = [];
    this.vessel = null;
  }
  update(dt, cam, t) {
    const v = this.vessel;
    if (!v) return;
    const hr = v.hdg * DEG;
    const fx = Math.sin(hr), fz = -Math.cos(hr), sx = Math.cos(hr), sz = Math.sin(hr);
    v.x += fx * v.speed * KN * dt;
    v.z += fz * v.speed * KN * dt;
    const rel = relBearing(v.x, v.z, v.hdg, cam.x, cam.z);
    const bob = Math.sin(t * 0.8 + v.L) * 0.4;
    // z daleka odstępy między światłami są mniejsze niż piksel – powiększamy je z odległością (jak przez lornetkę)
    const dc = Math.hypot(cam.x - v.x, cam.z - v.z), g = clamp(dc / 280, 1, 3.5);
    for (const { l, sp } of this.items) {
      const lx = Math.abs(l.x) < 60 ? l.x * g : l.x, lz = l.z * g;
      const wx = v.x + fx * lx + sx * lz, wz = v.z + fz * lx + sz * lz;
      sp.position.set(wx, l.y * g + bob, wz);
      const d = Math.hypot(cam.x - wx, cam.z - wz);
      sp.visible = visibleLights([l], rel).length > 0;
      // jasność maleje z odległością, wielkość punktu stała kątowo
      sp.material.opacity = clamp(1.2 - d / 4500, 0.5, 1);
      sp.scale.setScalar(clamp(d * 0.0075, 0.3, 40));
    }
  }
}

export class LightsScreen extends PassageScreen {
  initWorld(config) {
    this.harbor = null;
    this.world = new PassageWorld({
      spec: this.spec,
      equip: JSON.parse(JSON.stringify(config.equip)),
      harbor: buildOpenSea(),
      weather: config.weather,
      blind: true
    });
    this.world.boat.throttle = 0.22; // spokojne tempo łodzi
    this.world.boat.vx = 1.4;
    this.world.setAutopilot(true, 90);
    this.chart = { range: 1800, headUp: false, labels: false };
    this.rand = rng(config.seed || 1 + Math.floor(Math.random() * 1e9));
    this.q = { phase: 'wait', timer: 4, vessel: null, pick: null, aspectPick: null, stats: { n: 0, ok: 0, an: 0, aok: 0, streak: 0, best: 0 } };
  }

  introLog() {
    this.pushLog({ msg: 'Rozpoznawanie świateł: łódź wiosłowa płynie stałym kursem 090°. Rozglądaj się (przeciągnij myszą) i rozpoznaj statki po światłach.', type: 'info' });
  }

  build() {
    super.build();
    // w tym module nie ma nawigacji: chowamy panel celu i kartplotter
    this.goal.style.display = 'none';
    const chart = this.sim.querySelector('#hud-chart');
    if (chart) chart.style.display = 'none';
    // „kurs na port” nie ma tu sensu – jest tylko stały kurs
    for (const b of this.sim.querySelectorAll('#hud-controls .btn.xs')) if (/kurs na/.test(b.textContent)) b.style.display = 'none';
    this.quizEl = h('div.hud.glass', { id: 'hud-quiz' });
    this.sim.appendChild(this.quizEl);
    this.layer = new ShipLightsLayer(this.view.scene);
    // zamiast jachtu – łódź wiosłowa: chowamy kadłub, olinowanie, załogę i światła jachtu
    const heel = this.view.boat.userData.heel;
    for (const c of [...this.view.boat.children, ...heel.children]) if (c !== heel) c.visible = false;
    for (const gl of this.view.atmo.glows || []) gl.userData.dim = 1e-6; // (0 oznaczałoby „domyślnie”)
    if (this.view.atmo.deckLight) this.view.atmo.deckLight.visible = false;
    this.rowboat = buildRowboat();
    heel.add(this.rowboat);
    // w łodzi jest tylko wioślarz (sternik); resztę załogi jachtu usuwamy ze sceny razem z etykietami
    for (const p of [this.view.mate1, this.view.mate2, this.view.deckhand, this.view.shoreCrew]) if (p && p.parent) p.parent.remove(p);
    if (this.view.tags) this.view.tags.style.display = 'none';
    this.view.helmsman.position.set(-1.0, -0.42, 0); // oczy siedzącego wioślarza ok. 1,2 m nad wodą
    this.view.helmsman.rotation.y = -Math.PI / 2;
    // tylko autopilot – silnik i ster są tu zbędne
    const ctl = this.sim.querySelector('#hud-controls');
    if (ctl) [...ctl.children].slice(0, 2).forEach((c) => { c.style.display = 'none'; });
    this.view.setView('fpv');
    this._qLast = performance.now();
    this.renderQuiz();
  }

  // ---------- Quiz ----------
  observer() {
    const b = this.world.boat;
    return { x: b.x, z: b.z, hdg: thetaToCompass(b.th) };
  }

  spawn() {
    const q = this.q;
    q.vessel = spawnVessel(this.rand, this.observer(), { type: this._forceType || null }); // _forceType – podgląd konkretnego typu (testy)
    q.options = answerOptions(this.rand, q.vessel.type, 6);
    q.pick = null; q.aspectPick = null; q.result = null;
    q.phase = 'active';
    this.layer.set(q.vessel);
    this.pushLog({ msg: q.vessel.side === 'port' ? 'Światła na lewej burcie!' : 'Światła na prawej burcie!', type: 'info' });
    this.renderQuiz();
  }

  check() {
    const q = this.q, v = q.vessel, b = this.world.boat;
    const okType = q.pick === v.type;
    const realAspect = aspectOf(relBearing(v.x, v.z, v.hdg, b.x, b.z), v.moving);
    const okAspect = !v.moving || q.aspectPick === realAspect;
    const s = q.stats;
    s.n++; if (okType) s.ok++;
    if (v.moving) { s.an++; if (okAspect) s.aok++; }
    s.streak = okType && okAspect ? s.streak + 1 : 0;
    s.best = Math.max(s.best, s.streak);
    q.result = { okType, okAspect, realAspect };
    q.phase = 'feedback';
    this.pushLog({ msg: okType && okAspect ? 'Dobrze!' : `Błąd – to: ${v.name}`, type: okType && okAspect ? 'good' : 'bad' });
    this.renderQuiz();
  }

  next() {
    this.layer.clear();
    this.q.vessel = null;
    this.q.phase = 'wait';
    this.q.timer = 3 + this.rand() * 5;
    this.renderQuiz();
  }

  renderQuiz() {
    const q = this.q, el = this.quizEl;
    if (!el) return;
    el.innerHTML = '';
    const s = q.stats;
    el.appendChild(h('div.quiz-score', {}, h('span.muted', {}, 'Poprawne:'), ' ', h('b', {}, `${s.ok}/${s.n}`), '  ', h('span.muted', {}, 'Seria:'), ' ', h('b', {}, `${s.streak}`), '  ', h('span.muted', {}, 'Najlepsza:'), ' ', h('b', {}, `${s.best}`)));
    if (q.phase === 'wait') {
      el.appendChild(h('div.quiz-title', {}, 'Obserwuj horyzont…'));
      el.appendChild(h('div.small.muted', {}, 'Za chwilę na lewej albo prawej burcie pojawią się światła statku.'));
      return;
    }
    const v = q.vessel;
    el.appendChild(h('div.quiz-title', {}, v.side === 'port' ? 'Światła na lewej burcie' : 'Światła na prawej burcie'));
    if (q.phase === 'active') {
      el.appendChild(h('div.small.muted', {}, 'Co to za statek i co robi?'));
      const list = h('div.quiz-opts');
      for (const id of q.options) {
        list.appendChild(h('button.btn.sm', { class: q.pick === id ? 'on' : '', onclick: () => { q.pick = id; this.renderQuiz(); } }, VESSEL_BY_ID[id].name));
      }
      el.appendChild(list);
      if (v.moving) {
        el.appendChild(h('div.small.muted', { style: { marginTop: '8px' } }, 'Którą stronę statku widzisz?'));
        const asp = h('div.quiz-opts.two');
        for (const a of ['bow', 'starboard', 'port', 'stern']) asp.appendChild(h('button.btn.sm', { class: q.aspectPick === a ? 'on' : '', onclick: () => { q.aspectPick = a; this.renderQuiz(); } }, ASPECTS[a]));
        el.appendChild(asp);
      }
      const ready = q.pick && (!v.moving || q.aspectPick);
      el.appendChild(h('div', { style: { display: 'flex', gap: '6px', marginTop: '10px' } },
        h('button.btn.primary', { disabled: ready ? null : true, onclick: () => this.check() }, 'Sprawdź'),
        h('button.btn', { onclick: () => { q.stats.n++; q.stats.streak = 0; q.result = { okType: false, okAspect: false, skipped: true, realAspect: aspectOf(relBearing(v.x, v.z, v.hdg, this.world.boat.x, this.world.boat.z), v.moving) }; q.phase = 'feedback'; this.renderQuiz(); } }, 'Nie wiem')));
      return;
    }
    // informacja zwrotna
    const r = q.result, V = VESSEL_BY_ID[v.type];
    el.appendChild(h('div.quiz-verdict', { class: r.okType && r.okAspect ? 'ok' : 'bad' }, r.skipped ? 'Odpowiedź:' : r.okType && r.okAspect ? '✓ Dobrze!' : r.okType ? '✓ Typ dobrze, ✗ strona statku źle' : '✗ Źle'));
    el.appendChild(h('div', { style: { fontWeight: 700, margin: '4px 0' } }, V.name));
    el.appendChild(h('div.small', {}, V.explain));
    if (v.moving) el.appendChild(h('div.small', { style: { marginTop: '6px' } }, h('span.muted', {}, 'Widzisz:'), ' ', h('b', {}, ASPECTS[r.realAspect])));
    el.appendChild(h('div.small.muted', { style: { marginTop: '4px' } }, h('span', {}, 'Odległość:'), ' ', h('b', {}, `${(Math.hypot(v.x - this.world.boat.x, v.z - this.world.boat.z) / NM).toFixed(2)} nm`)));
    el.appendChild(h('button.btn.primary', { style: { marginTop: '10px' }, onclick: () => this.next() }, 'Następny statek →'));
  }

  // ---------- HUD ----------
  updateHUD() {
    const w = this.world, b = w.boat, env = w.env;
    const now = performance.now(), dt = Math.min((now - this._qLast) / 1000, 0.1) * (this.paused ? 0 : this.timeScale);
    this._qLast = now;
    const hdg = thetaToCompass(b.th);
    this.info.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline"><div><div class="small muted">Prędkość (SOG)</div><div class="big-num">${(b.speed / KN).toFixed(1)} <span class="small">kn</span></div></div>
      <div style="text-align:right"><div class="small muted">Kurs</div><div class="big-num">${pad3(hdg)}°</div></div></div>
      <div class="kv" style="margin-top:6px">
        <span class="muted">Wiatr rzecz.</span><b>${(env.windSpeed / KN).toFixed(0)} kn z ${pad3(env.windFromDeg)}°</b>
        <span class="muted">Czas</span><b>${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, '0')}</b>
      </div>`;
    const ap = w.autopilot;
    this.apBtn.textContent = ap.on ? 'AP wł.' : 'AP wył.';
    this.apBtn.classList.toggle('on', ap.on);
    this.apHdg.textContent = `${pad3(ap.hdg)}°`;
    this.apHdg.style.opacity = ap.on ? 1 : 0.45;
    this.updateControls();
    // quiz i światła statku
    const q = this.q;
    if (q.phase === 'wait') { q.timer -= dt; if (q.timer <= 0) this.spawn(); }
    this.layer.update(dt, this.view.camera.position, now / 1000);
    if (q.vessel && q.phase !== 'wait') {
      const d = Math.hypot(q.vessel.x - b.x, q.vessel.z - b.z);
      if (d > 4500) this.next(); // statek odpłynął
    }
  }

  drawCompass() {
    SimScreen.prototype.drawCompass.call(this);
    // kierunek do świateł na tarczy kompasu (pomaga znaleźć statek)
    const v = this.q && this.q.vessel;
    if (!v) return;
    const c = this.compass, ctx = c.getContext('2d');
    const W = c.width, R = W / 2 - 16, cx = W / 2, cy = W / 2, az = this.view.cam.az;
    const b = this.world.boat, dx = v.x - b.x, dz = v.z - b.z, L = Math.hypot(dx, dz) || 1;
    const vx = dx / L, vz = dz / L;
    const sx = vx * Math.cos(az) - vz * Math.sin(az), sy = vx * Math.sin(az) + vz * Math.cos(az);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(cx + sx * R, cy + sy * R, 5, 0, Math.PI * 2); ctx.fill();
  }

  showHelp() {
    const back = h('div.modal-back', { onclick: (e) => { if (e.target === back) back.remove(); } });
    const m = h('div.modal.glass', { style: { width: '820px', maxHeight: '86vh', overflow: 'auto' } },
      h('h2', {}, 'Ściąga – światła statków'),
      h('p.small', {}, 'Światło masztowe (białe) świeci do przodu w sektorze 225°, burtowe – czerwone z lewej i zielone z prawej po 112,5°, rufowe (białe) do tyłu w sektorze 135°. Światła dookólne widać ze wszystkich stron. Rozglądaj się, przeciągając myszą; kółkiem przybliżasz widok.'),
      h('table.spec-table', {}, ...VESSELS.map((v) => h('tr', {}, h('td', { style: { fontWeight: 700, width: '38%' } }, v.name), h('td', {}, v.explain)))),
      h('div', { style: { textAlign: 'right', marginTop: '10px' } }, h('button.btn.primary', { onclick: () => back.remove() }, 'OK')));
    back.appendChild(m);
    this.sim.appendChild(back);
  }

  destroy() {
    if (this.layer) this.layer.clear();
    super.destroy();
  }
}
