// Moduł „Sygnały dźwiękowe”: z łodzi wiosłowej słychać buczek, dzwon albo gong statku – trzeba rozpoznać znaczenie sygnału.
import { h } from './dom.js';
import { LightsScreen } from './lightsUI.js';
import { SIGNALS, SIGNAL_BY_ID, CONTEXTS, notation, schedule, signalOptions, makeSignalDeck } from '../data/soundSignals.js';
import { spawnVessel } from '../data/shipLights.js';

// Synteza dźwięków statkowych (Web Audio)
export class ShipAudio {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = AC ? new AC() : null;
    this.nodes = [];
  }
  stop() {
    for (const n of this.nodes) { try { n.stop(); } catch (e) { /* już zatrzymany */ } }
    this.nodes = [];
  }
  out(pan) {
    const c = this.ctx, g = c.createGain();
    g.gain.value = 0.5;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(c.destination); } else g.connect(c.destination);
    return g;
  }
  horn(t0, dur, dst) {
    const c = this.ctx, env = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.55, t0 + 0.08);
    env.gain.setValueAtTime(0.55, t0 + dur - 0.15);
    env.gain.linearRampToValueAtTime(0, t0 + dur);
    for (const [f, a] of [[146, 1], [219, 0.6], [292, 0.35]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = f; g.gain.value = a * 0.33;
      o.connect(g); g.connect(lp);
      o.start(t0); o.stop(t0 + dur + 0.05);
      this.nodes.push(o);
    }
    lp.connect(env); env.connect(dst);
  }
  strike(t0, dst, base = 1150, decay = 1.3, vol = 0.35) {
    const c = this.ctx;
    for (const [m, a] of [[1, 1], [2.0, 0.5], [2.76, 0.35], [5.4, 0.15]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = base * m;
      g.gain.setValueAtTime(vol * a, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      o.connect(g); g.connect(dst);
      o.start(t0); o.stop(t0 + decay + 0.05);
      this.nodes.push(o);
    }
  }
  play(pattern, pan = 0) {
    if (!this.ctx) return 0;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stop();
    const dst = this.out(pan), now = this.ctx.currentTime + 0.1;
    const { parts, total } = schedule(pattern);
    for (const p of parts) {
      const t0 = now + p.t0;
      if (p.kind === 'horn') this.horn(t0, p.dur, dst);
      else if (p.kind === 'stroke') this.strike(t0, dst, 1150, 1.6, 0.45);
      else if (p.kind === 'bell') for (let t = 0; t < p.dur; t += 0.16) this.strike(t0 + t, dst, 1150, 0.5, 0.25);
      else if (p.kind === 'gong') for (let t = 0; t < p.dur; t += 0.9) this.strike(t0 + t, dst, 140, 2.2, 0.5);
    }
    return total;
  }
}

export class SoundsScreen extends LightsScreen {
  initWorld(config) {
    super.initWorld({ ...config, day: true });
    this.ctxs = config.ctxs || ['sight', 'fog', 'inland'];
    this.signalDeck = makeSignalDeck(this.rand, this.ctxs);
    this.audio = new ShipAudio();
  }

  // pozycja i ruch statku zgodne z jego zamiarem (np. wyprzedzający – z tyłu, zmieniający kurs – przed nami i skręca)
  placeVessel(sig) {
    const o = this.observer(), sc = sig.scene, r = this.rand;
    const side = sc.side || (r() < 0.5 ? -1 : 1);
    const rel = side * (sc.brg[0] + r() * (sc.brg[1] - sc.brg[0])), dist = sc.dist[0] + r() * (sc.dist[1] - sc.dist[0]);
    const a = ((o.hdg + rel) * Math.PI) / 180;
    const x = o.x + Math.sin(a) * dist, z = o.z - Math.cos(a) * dist;
    const toUs = (((Math.atan2(o.x - x, -(o.z - z)) * 180) / Math.PI) + 360) % 360;
    let hdg;
    if (sc.hdg === 'same') hdg = o.hdg;
    else if (sc.hdg === 'toward') hdg = toUs + side * (sc.off || 0);
    else if (sc.hdg === 'cross') hdg = o.hdg + (rel > 0 ? -90 : 90) + (r() - 0.5) * 30;
    else if (sc.hdg === 'collision') {
      // stały namiar: składowa prędkości statku w poprzek linii namiaru znosi naszą
      const vs = sc.speed * 0.514444, ov = o.speed, los = Math.atan2(o.x - x, -(o.z - z)), oh = (o.hdg * Math.PI) / 180;
      const lat = ov * Math.sin(oh - los); // nasza prędkość w poprzek linii namiaru
      hdg = (los + Math.asin(Math.max(-1, Math.min(1, lat / vs)))) * 180 / Math.PI;
    } else hdg = r() * 360;
    const v = spawnVessel(r, o, { type: 'dPower', day: true });
    Object.assign(v, { x, z, hdg: ((hdg % 360) + 360) % 360, speed: sc.speed, side: rel < 0 ? 'port' : 'starboard', moving: sc.speed > 0.2 || !!sc.beh, beh: sc.beh ? { ...sc.beh, t: 0, turned: 0 } : null });
    v.shapes = [];
    return v;
  }

  // manewr statku po sygnale: zwrot albo praca wstecz
  updateVessel(dt) {
    const v = this.q.vessel;
    if (!v || !v.beh) return;
    const b = v.beh;
    b.t += dt;
    if (b.t < b.delay) return;
    if (b.turn) {
      const step = Math.sign(b.turn) * Math.min(Math.abs(b.turn) - Math.abs(b.turned), b.rate * dt);
      if (Math.abs(b.turned) < Math.abs(b.turn)) { v.hdg = (v.hdg + step + 360) % 360; b.turned += step; }
    }
    if (b.speedTo !== undefined) v.speed += Math.sign(b.speedTo - v.speed) * Math.min(Math.abs(b.speedTo - v.speed), b.accel * dt);
  }

  updateHUD() {
    const now = performance.now(), dt = Math.min((now - (this._vLast || now)) / 1000, 0.1) * (this.paused ? 0 : this.timeScale);
    this._vLast = now;
    this.updateVessel(dt);
    super.updateHUD();
  }

  introLog() {
    this.pushLog({ msg: 'Sygnały dźwiękowe: słuchaj sygnałów statków i rozpoznaj ich znaczenie. Przycisk „Odtwórz” powtarza sygnał.', type: 'info' });
  }

  spawn() {
    const q = this.q;
    const id = this._forceSignal || this.signalDeck();
    if (!id) { q.phase = 'done'; this.renderQuiz(); return; }
    const sig = SIGNAL_BY_ID[id];
    q.signal = sig;
    q.options = signalOptions(this.rand, sig.id, 5);
    q.pick = null; q.result = null; q.phase = 'active';
    // w dobrej widoczności widać statek, który daje sygnał; we mgle – tylko go słychać
    this.view.atmo.setSky(sig.ctx === 'fog' ? 'fog' : 'clear');
    const v = this.placeVessel(sig);
    q.vessel = v;
    if (sig.ctx !== 'fog') { this.layer.set(v); this.aimAt(); } else { this.layer.clear(); this._aim = null; } // we mgle kamera nie zdradza kierunku
    this.pushLog({ msg: v.side === 'port' ? 'Sygnał z lewej burty!' : 'Sygnał z prawej burty!', type: 'info' });
    this.playSignal();
    this.renderQuiz();
  }

  playSignal() {
    const q = this.q, v = q.vessel, b = this.world.boat;
    if (!q.signal || !v) return;
    // panorama stereo wg namiaru względem kierunku patrzenia
    const dir = this.view.camera.getWorldDirection(this.view.camera.position.clone());
    const look = Math.atan2(dir.x, -dir.z), brg = Math.atan2(v.x - b.x, -(v.z - b.z));
    this.audio.play(q.signal.p, Math.max(-0.9, Math.min(0.9, Math.sin(brg - look))));
  }

  check() {
    const q = this.q, ok = q.pick === q.signal.id;
    q.stats.n++; if (ok) { q.stats.ok++; this.signalDeck.correct(q.signal.id); }
    this.scoreStreak(ok);
    q.result = { ok };
    q.phase = 'feedback';
    this.pushLog({ msg: ok ? 'Dobrze!' : 'Źle', type: ok ? 'good' : 'bad' });
    this.renderQuiz();
  }

  next() {
    this.audio.stop();
    this.layer.clear();
    this.q.vessel = null; this.q.signal = null;
    this.q.phase = 'wait';
    this.q.timer = 1 + this.rand() * 1.5;
    this.renderQuiz();
  }

  renderQuiz() {
    const q = this.q, el = this.quizEl;
    if (!el) return;
    el.innerHTML = '';
    const s = q.stats;
    el.appendChild(h('div.quiz-score', {}, h('span.muted', {}, 'Poprawne:'), ' ', h('b', {}, `${s.ok}/${s.n}`), '  ', h('span.muted', {}, 'Seria:'), ' ', h('b', {}, `${s.streak}`), '  ', h('span.muted', {}, 'Najlepsza:'), ' ', h('b', {}, `${s.best}`)));
    el.appendChild(h('div.small', { style: { margin: '2px 0 4px' } }, h('span.muted', {}, 'Opanowane (3× dobrze):'), ' ', h('b', {}, `${this.signalDeck.learnedCount()}/${this.signalDeck.total()}`)));
    if (q.phase === 'done') {
      el.appendChild(h('div.quiz-verdict.ok', {}, '✓ Wszystkie sygnały opanowane!'));
      el.appendChild(h('button.btn.primary', { style: { marginTop: '10px' }, onclick: () => { this.signalDeck.reset(); this.next(); } }, 'Zacznij od nowa'));
      return;
    }
    if (q.phase === 'wait' || !q.signal) {
      el.appendChild(h('div.quiz-title', {}, 'Nasłuchuj…'));
      return;
    }
    el.appendChild(h('div.quiz-title', {}, CONTEXTS[q.signal.ctx]));
    el.appendChild(h('button.btn.sm', { style: { margin: '4px 0 6px' }, onclick: () => this.playSignal() }, '▶ Odtwórz ponownie'));
    if (q.phase === 'active') {
      el.appendChild(h('div.small.muted', {}, 'Co oznacza ten sygnał?'));
      const list = h('div.quiz-opts');
      for (const id of q.options) list.appendChild(h('button.btn.sm', { class: q.pick === id ? 'on' : '', onclick: () => { q.pick = id; this.renderQuiz(); } }, SIGNAL_BY_ID[id].name));
      el.appendChild(list);
      el.appendChild(h('div', { style: { display: 'flex', gap: '6px', marginTop: '10px' } },
        h('button.btn.primary', { disabled: q.pick ? null : true, onclick: () => this.check() }, 'Sprawdź'),
        h('button.btn', { onclick: () => { q.stats.n++; this.scoreStreak(false); q.result = { ok: false }; q.phase = 'feedback'; this.renderQuiz(); } }, 'Nie wiem')));
      return;
    }
    const r = q.result;
    el.appendChild(h('div.quiz-verdict', { class: r.ok ? 'ok' : 'bad' }, r.ok ? '✓ Dobrze!' : '✗ Źle'));
    if (!r.ok) el.appendChild(h('div.small', { style: { marginTop: '4px' } }, h('span.muted', {}, 'Poprawna odpowiedź:'), ' ', h('b', {}, q.signal.name)));
    el.appendChild(h('div.small', { style: { marginTop: '4px', fontSize: '15px', letterSpacing: '2px' } }, notation(q.signal.p)));
    el.appendChild(h('button.btn.primary', { style: { marginTop: '10px' }, onclick: () => this.next() }, 'Następny sygnał →'));
  }

  drawTape() {
    // namiar na statek pokazujemy tylko, gdy go widać
    const v = this.q.vessel;
    if (this.q.signal && this.q.signal.ctx === 'fog') this.q.vessel = null;
    super.drawTape();
    this.q.vessel = v;
  }

  showHelp() {
    const back = h('div.modal-back', { onclick: (e) => { if (e.target === back) back.remove(); } });
    const m = h('div.modal.glass', { style: { width: '820px', maxHeight: '86vh', overflow: 'auto' } },
      h('h2', {}, 'Ściąga – sygnały dźwiękowe'),
      h('p.small', {}, '• – krótki dźwięk (ok. 1 s), — – długi dźwięk (4–6 s), · – bardzo krótki (ok. ¼ s), ━ – ciągły, 🔔 – dzwon, ◎ – gong.'),
      ...['sight', 'fog', 'inland'].map((c) => h('div', {}, h('h3', {}, CONTEXTS[c]),
        h('table.spec-table', {}, ...SIGNALS.filter((s) => s.ctx === c).map((s) => h('tr', {}, h('td', { style: { width: '22%', letterSpacing: '2px', fontWeight: 700 } }, notation(s.p)), h('td', {}, s.name)))))),
      h('div', { style: { textAlign: 'right', marginTop: '10px' } }, h('button.btn.primary', { onclick: () => back.remove() }, 'OK')));
    back.appendChild(m);
    this.sim.appendChild(back);
  }

  destroy() {
    if (this.audio) { this.audio.stop(); if (this.audio.ctx) this.audio.ctx.close(); }
    super.destroy();
  }
}
