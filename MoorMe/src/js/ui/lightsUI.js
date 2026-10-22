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
      sp.scale.setScalar(clamp(d * 0.005, 0.25, 30));
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
    this.world.boat.throttle = 0.45;
    this.world.boat.vx = 2.4;
    this.world.setAutopilot(true, 90);
    this.chart = { range: 1800, headUp: false, labels: false };
    this.rand = rng(config.seed || 1 + Math.floor(Math.random() * 1e9));
    this.q = { phase: 'wait', timer: 4, vessel: null, pick: null, aspectPick: null, stats: { n: 0, ok: 0, an: 0, aok: 0, streak: 0, best: 0 } };
  }

  introLog() {
    this.pushLog({ msg: 'Rozpoznawanie świateł: jacht płynie stałym kursem 090°. Rozglądaj się (przeciągnij myszą) i rozpoznaj statki po światłach.', type: 'info' });
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
