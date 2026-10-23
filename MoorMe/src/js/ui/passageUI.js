// Ekran rejsu: widok 3D + chartploter + panel nawigacyjny (kurs, XTE, odległość do waypointu, znaki, głębokość) + autopilot
import { h } from './dom.js';
import { SimScreen } from './simUI.js';
import { PassageWorld } from '../physics/passage.js';
import { PASSAGES, RULE_TEXT } from '../data/passage.js';
import { View3D } from '../render/view3d.js';
import { drawChart, drawMarkSymbol } from './chart.js';
import { buildPassageHelpContent } from './help.js';
import { t } from '../i18n.js';
import { DEG, KN, clamp, thetaToCompass, wrapPi } from '../math.js';

const NM = 1852;
const fmtDist = (m) => (m >= 0.1 * NM ? `${(m / NM).toFixed(2)} nm` : `${Math.round(m)} m`);
const fmtTime = (sec) => {
  if (!isFinite(sec) || sec > 99 * 3600) return '--:--';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};
const pad3 = (d) => String(Math.round(((d % 360) + 360) % 360) % 360).padStart(3, '0');


export class PassageScreen extends SimScreen {
  initWorld(config) {
    this.harbor = null;
    this.world = new PassageWorld({
      spec: this.spec,
      equip: JSON.parse(JSON.stringify(config.equip)),
      passageId: config.passageId,
      seed: config.seed,
      weather: config.weather,
      blind: config.assist !== 'full'
    });
    this.chart = { range: 1800, headUp: false, labels: true };
  }

  renderLines() { /* w rejsie nie ma panelu lin */ }

  introLog(config) {
    const P = this.world.H;
    this.pushLog({ msg: `Rejs: ${P.name}`, type: 'info' });
    this.pushLog({ msg: this.world.blind ? 'Płyń na port według BRG. Rozpoznawaj znaki po światłach i mijaj je z właściwej strony' : 'Płyń po waypointach (magenta), mijaj znaki z właściwej strony i omijaj mielizny', type: 'info' });
  }

  build() {
    const r = this.root;
    r.innerHTML = '';
    const sim = h('div', { id: 'sim', class: 'passage' });
    const view = h('div', { id: 'view' });
    sim.appendChild(view);
    r.appendChild(sim);
    try {
      this.view = new View3D(view, this.world);
    } catch (err) {
      console.error(err);
      sim.appendChild(h('div.modal-back', {}, h('div.modal.glass', {},
        h('h2', {}, 'Brak obsługi grafiki 3D'),
        h('p', {}, 'Nie udało się uruchomić WebGL. Zaktualizuj sterowniki karty graficznej i spróbuj ponownie.'),
        h('p.small.muted', {}, String(err && err.message)),
        h('button.btn.primary', { onclick: () => this.cb.exit(this.config) }, 'Wróć'))));
      throw err;
    }
    this.view.cam.dist = 120;

    this.info = h('div.hud.glass', { id: 'hud-info' });
    sim.appendChild(this.info);
    this.goal = h('div.hud.glass', { id: 'hud-goal', class: 'nav' });
    sim.appendChild(this.goal);

    // pasek górny
    const top = h('div.hud.glass', { id: 'hud-top' });
    this.pauseBtn = h('button.btn.sm', { onclick: () => this.togglePause(), title: 'Pauza (P)' }, '⏸ Pauza');
    top.appendChild(this.pauseBtn);
    this.speedBtns = [1, 2, 4, 8].map((s) => h('button.btn.sm', { class: s === 1 ? 'on' : '', onclick: () => this.setSpeed(s) }, `${s}×`));
    top.append(...this.speedBtns);
    top.appendChild(h('span', { style: { width: '8px' } }));
    this.followBtn = h('button.btn.sm.on', { onclick: () => { this.view.cam.follow = !this.view.cam.follow; }, title: 'Kamera śledzi jacht (F)' }, '🎯 Śledź');
    top.appendChild(this.followBtn);
    for (const [k, n] of [['iso', 'Izo'], ['close', 'Blisko'], ['top', 'Z góry'], ['helm', 'Za rufą'], ['fpv', '👁 Kapitan']]) top.appendChild(h('button.btn.sm', { onclick: () => this.view.setView(k) }, n));
    this.soundBtn = h('button.btn.sm', { onclick: () => { this.sound.enabled = !this.sound.enabled; this.soundBtn.textContent = this.sound.enabled ? '🔊' : '🔇'; } }, '🔊');
    top.appendChild(this.soundBtn);
    top.appendChild(h('button.btn.sm', { onclick: () => this.toggleWeather(), title: 'Pogoda i pora dnia (O)' }, '🌦 Pogoda'));
    top.appendChild(h('button.btn.sm', { onclick: () => this.showHelp() }, '❔ Pomoc'));
    top.appendChild(h('button.btn.sm', { onclick: () => this.restart() }, '↺ Od nowa'));
    top.appendChild(h('button.btn.sm.danger', { onclick: () => this.exit() }, '✕ Menu'));
    sim.appendChild(top);

    // kompas
    const comp = h('div.hud.glass', { id: 'hud-compass' });
    this.compass = h('canvas', { width: 170, height: 170, style: { width: '170px', height: '170px', display: 'block' } });
    comp.appendChild(this.compass);
    sim.appendChild(comp);
    this.logEl = h('div.hud', { id: 'hud-log' });
    sim.appendChild(this.logEl);

    // sterowanie + autopilot
    const ctl = h('div.hud', { id: 'hud-controls' });
    ctl.appendChild(this.buildEngine());
    ctl.appendChild(this.buildHelm());
    ctl.appendChild(this.buildAutopilot());
    sim.appendChild(ctl);

    // chartploter
    const chart = h('div.hud.glass', { id: 'hud-chart' });
    this.chartCv = h('canvas', { width: 420, height: 300 });
    this.chartCv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomChart(e.deltaY > 0 ? 1.25 : 0.8); }, { passive: false });
    this.chartBtnOrient = h('button.btn.xs', { onclick: () => { this.chart.headUp = !this.chart.headUp; this.updateChartButtons(); }, title: 'Mapa: północ u góry / kurs u góry' }, '');
    this.chartBtnLabels = this.world.blind ? null : h('button.btn.xs', { onclick: () => { this.chart.labels = !this.chart.labels; this.updateChartButtons(); } }, '');
    chart.append(this.chartCv, h('div.chart-bar', {},
      h('button.btn.xs', { onclick: () => this.zoomChart(0.7), title: 'Przybliż' }, '＋'),
      h('button.btn.xs', { onclick: () => this.zoomChart(1.4), title: 'Oddal' }, '－'),
      this.chartBtnOrient, this.chartBtnLabels,
      this.world.blind ? null : h('button.btn.xs', { onclick: () => { this.chart.range = Math.max(900, this.world.H.routeLength * 1.15); this.chart.full = true; } }, 'Cała trasa')));
    sim.appendChild(chart);
    this.updateChartButtons();

    this.pausedEl = h('div.paused-banner', { style: { display: 'none' } }, 'PAUZA');
    sim.appendChild(this.pausedEl);
    this.markTags = h('div.crew-tags');
    sim.appendChild(this.markTags);
    this.markTagEls = new Map();
    this.sim = sim;

    this.onKeyDown = (e) => this.keyDown(e);
    this.onKeyUp = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this._blur = () => this.keys.clear());
  }

  buildAutopilot() {
    const panel = h('div.glass.ctl');
    panel.appendChild(h('h4', {}, 'Autopilot'));
    this.apBtn = h('button.btn.sm', { style: { width: '100%' }, onclick: () => this.toggleAutopilot(), title: 'Włącz / wyłącz utrzymanie kursu (J)' }, 'AP wył.');
    this.apHdg = h('div.big-num', { style: { textAlign: 'center', margin: '8px 0 4px' } }, '---°');
    const row = h('div', { style: { display: 'flex', gap: '4px', justifyContent: 'center' } },
      ...[[-10, '−10'], [-1, '−1'], [1, '+1'], [10, '+10']].map(([d, l]) => h('button.btn.xs', { onclick: () => { this.world.adjustAutopilot(d); }, title: 'Zmiana zadanego kursu' }, l)));
    panel.append(this.apBtn, this.apHdg, row, h('button.btn.xs', { style: { width: '100%', marginTop: '6px' }, onclick: () => { this.world.setAutopilot(this.world.autopilot.on, this.world.nav.brg); }, title: this.world.blind ? 'Ustaw zadany kurs na kurs do portu' : 'Ustaw zadany kurs na kurs do waypointu' }, this.world.blind ? '→ kurs na port' : '→ kurs na WP'),
      h('div.small.muted', { style: { marginTop: '6px', maxWidth: '170px' } }, 'Autopilot tylko trzyma kurs – o trasie decydujesz Ty.'));
    return panel;
  }

  toggleAutopilot() {
    const w = this.world;
    w.setAutopilot(!w.autopilot.on);
    if (w.autopilot.on) this.pushLog({ msg: `Autopilot włączony: kurs ${pad3(w.autopilot.hdg)}°`, type: 'info' });
  }

  zoomChart(k) {
    this.chart.full = false;
    this.chart.range = clamp(this.chart.range * k, 300, 14000);
  }

  updateChartButtons() {
    this.chartBtnOrient.textContent = this.chart.headUp ? '⬆ kurs' : '⬆ N';
    if (this.chartBtnLabels) this.chartBtnLabels.textContent = this.chart.labels ? 'Nazwy ✓' : 'Nazwy ✗';
  }

  // ---------- Klawiatura ----------
  keyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    this.sound.init();
    const w = this.world, b = w.boat;
    this.keys.add(e.code);
    switch (e.code) {
      case 'KeyP': case 'Space': this.togglePause(); e.preventDefault(); break;
      case 'KeyX': b.throttle = 0; break;
      case 'KeyR': b.rudderCmd = 0; w.autopilot.on = false; break;
      case 'KeyF': this.view.cam.follow = !this.view.cam.follow; break;
      case 'KeyV': { const v = ['iso', 'close', 'top', 'helm', 'fpv']; this._vi = ((this._vi || 0) + 1) % v.length; this.view.setView(v[this._vi]); break; }
      case 'KeyM': this.sound.enabled = !this.sound.enabled; break;
      case 'KeyO': this.toggleWeather(); break;
      case 'KeyJ': this.toggleAutopilot(); break;
      case 'Comma': w.adjustAutopilot(e.shiftKey ? -10 : -1); break;
      case 'Period': w.adjustAutopilot(e.shiftKey ? 10 : 1); break;
      case 'KeyN': this.chart.headUp = !this.chart.headUp; this.updateChartButtons(); break;
      case 'Equal': case 'NumpadAdd': this.zoomChart(0.8); break;
      case 'Minus': case 'NumpadSubtract': this.zoomChart(1.25); break;
      case 'F1': case 'KeyH': this.showHelp(); e.preventDefault(); break;
      default: break;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }

  handleHeldKeys(dt) {
    const k = this.keys;
    if (this.world.autopilot.on && (k.has('KeyA') || k.has('KeyD') || k.has('ArrowLeft') || k.has('ArrowRight'))) this.world.autopilot.on = false;
    super.handleHeldKeys(dt);
  }

  frame(now) {
    if (!this.running || !this.frameGate(now)) return;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    if (!this.paused) {
      this.handleHeldKeys(dt);
      this.world.update(dt * this.timeScale);
    }
    this.view.render(this.paused ? 0 : dt * this.timeScale, dt);
    this.updateHUD();
    this.sound.update(this.world.boat, this.world.env.windSpeed / KN);
    requestAnimationFrame(this.frame);
  }

  // ---------- HUD ----------
  updateHUD() {
    const w = this.world, b = w.boat, env = w.env, n = w.nav;
    const sog = b.speed / KN;
    const hdg = thetaToCompass(b.th);
    const u = b.u / KN;
    const min = Math.floor(w.time / 60), sec = Math.floor(w.time % 60);
    const hr = this.view.atmo.hour;
    this._hudAcc = (this._hudAcc || 0) + 1;
    this.info.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline"><div><div class="small muted">Prędkość (SOG)</div><div class="big-num">${sog.toFixed(1)} <span class="small">kn</span></div></div>
      <div style="text-align:right"><div class="small muted">Kurs</div><div class="big-num">${pad3(hdg)}°</div></div></div>
      <div class="kv" style="margin-top:6px">
        <span class="muted" title="Kurs nad dnem">COG</span><b>${pad3(n.cog)}°</b>
        <span class="muted">Obrót</span><b>${(b.r / DEG).toFixed(1)} °/s</b>
        <span class="muted">Wiatr rzecz.</span><b>${(env.windSpeed / KN).toFixed(0)} kn z ${pad3(env.windFromDeg)}°</b>
        <span class="muted">Czas</span><b>${min}:${String(sec).padStart(2, '0')}</b>
        <span class="muted">Godzina</span><b>${String(Math.floor(hr)).padStart(2, '0')}:${String(Math.floor((hr % 1) * 60)).padStart(2, '0')}</b>
      </div>`;
    // wskazania przy ruchu wzdłużnym pomijamy – w rejsie ważniejsza jest nawigacja
    void u;

    // panel nawigacyjny
    const wp = w.route[n.next];
    const err = wrapPi((n.brg - hdg) * DEG) / DEG; // + = trzeba skręcić w prawo
    const xteSide = n.xte > 0 ? 'w prawo od toru' : 'w lewo od toru';
    const xteBar = clamp(50 + (n.xte / 200) * 50, 2, 98);
    const depth = w.depthAt(b.x, b.z);
    const shallow = depth < w.spec.draft + 1.0;
    const nextMarks = w.marks
      .filter((m) => m.state === 'pending' && Math.hypot(m.x - b.x, m.z - b.z) < 700 && (m.required || m.rule === 'avoid'))
      .sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z)).slice(0, 3);
    const blind = w.blind;
    let gh = `<div style="font-weight:700;margin-bottom:2px">${blind ? 'Do portu' : `Do ${wp.name || 'WP' + n.next} <span class="muted">(${n.next}/${w.route.length - 1})</span>`}</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline"><div><div class="small muted">${blind ? 'Kurs na port (BRG)' : 'Kurs na waypoint (BRG)'}</div><div class="big-num" style="color:#ff7ae0">${pad3(n.brg)}°</div></div>
      <div style="text-align:right"><div class="small muted">Odległość</div><div class="big-num">${fmtDist(n.dtw)}</div></div></div>
      <div class="small" style="margin:4px 0 0;color:${Math.abs(err) < 5 ? '#7ff0b5' : '#ffd166'}">${Math.abs(err) < 3 ? 'Kurs zgodny z BRG' : `Skręć ${err > 0 ? 'w prawo' : 'w lewo'} o ${Math.abs(err).toFixed(0)}°`}</div>
      ${blind ? '' : `<div class="xte"><i style="left:${xteBar}%"></i></div>`}
      <div class="kv">
        ${blind ? '' : `<span class="muted">XTE (odchylenie od toru)</span><b style="color:${Math.abs(n.xte) > 100 ? '#ff7a7a' : 'inherit'}">${Math.abs(n.xte).toFixed(0)} m ${xteSide}</b>
        <span class="muted">Do mety</span><b>${fmtDist(n.remaining)}</b>`}
        <span class="muted">ETA</span><b>${fmtTime(n.eta)}</b>
        <span class="muted">Głębokość</span><b style="color:${shallow ? '#ff5a5a' : 'inherit'}">${depth.toFixed(1)} m${shallow ? ' ⚠' : ''}</b>
      </div>`;
    if (!blind && nextMarks.length) {
      gh += '<div style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.12);padding-top:5px">';
      for (const m of nextMarks) {
        gh += `<div class="small" style="margin:3px 0"><b>${m.label}</b> <span class="muted">${fmtDist(Math.hypot(m.x - b.x, m.z - b.z))}</span><br><span class="muted">${RULE_TEXT[m.rule]}</span></div>`;
      }
      gh += '</div>';
    }
    const ps = w.pstats;
    if (ps.wrongSide || ps.avoid || ps.groundings || ps.markHits) {
      const errs = [];
      if (ps.wrongSide) errs.push(`znaki ${ps.wrongSide}`);
      if (ps.avoid) errs.push(`strefy ${ps.avoid}`);
      if (ps.groundings) errs.push(`mielizna ${ps.groundings}`);
      if (ps.markHits) errs.push(`zderzenia ${ps.markHits}`);
      gh += `<div class="small" style="margin-top:6px;color:#ff9a9a"><span>Błędy:</span> <span>${errs.join(' · ')}</span></div>`;
    }
    this.goal.innerHTML = gh;

    // autopilot
    const ap = w.autopilot;
    this.apBtn.textContent = ap.on ? 'AP wł.' : 'AP wył.';
    this.apBtn.classList.toggle('on', ap.on);
    this.apHdg.textContent = `${pad3(ap.hdg)}°`;
    this.apHdg.style.opacity = ap.on ? 1 : 0.45;

    this.updateControls();
    this.drawPlotter();
    this.updateMarkTags();
    if (!w.blind) this.view.sea.setNext(n.next);
  }

  drawPlotter() {
    const cv = this.chartCv, ctx = cv.getContext('2d');
    const w = this.world, b = w.boat;
    let cx = b.x, cz = b.z, range = this.chart.range;
    if (this.chart.full) {
      const R = w.route;
      const xs = R.map((p) => p.x), zs = R.map((p) => p.z);
      cx = (Math.min(...xs) + Math.max(...xs)) / 2; cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      range = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...zs) - Math.min(...zs)) * (cv.width / cv.height)) * 1.12;
    }
    drawChart(ctx, cv.width, cv.height, { cx, cz, scale: cv.width / range, headUp: this.chart.headUp && !this.chart.full, world: w, labels: this.chart.labels && !w.blind, night: (this.view.atmo.lightsOn || 0) > 0.5 });
  }

  // Etykiety znaków w widoku 3D (bliskie i z oczekującą oceną)
  updateMarkTags() {
    const w = this.world, b = w.boat, v = this.view;
    const fpv = v.cam.mode === 'fpv';
    if (w.blind) return; // znaki rozpoznaje się po światłach – bez nazw
    for (const m of w.marks) {
      const d = Math.hypot(m.x - b.x, m.z - b.z);
      let el = this.markTagEls.get(m.id);
      const show = d < 420 && !fpv;
      if (!show) { if (el) el.style.display = 'none'; continue; }
      const s = v.project(m.x, 8, m.z);
      if (!s.visible) { if (el) el.style.display = 'none'; continue; }
      if (!el) {
        el = document.createElement('div');
        el.textContent = t(m.label);
        this.markTags.appendChild(el);
        this.markTagEls.set(m.id, el);
      }
      el.style.display = 'block';
      el.style.color = m.state === 'wrong' || m.state === 'violated' ? '#ff8a8a' : m.state === 'ok' ? '#9af0bd' : '#fff';
      el.style.transform = `translate(${s.x.toFixed(0)}px, ${s.y.toFixed(0)}px) translate(-50%, -100%)`;
    }
  }

  drawCompass() {
    super.drawCompass();
    // znacznik kursu na waypoint na tarczy kompasu
    const c = this.compass, ctx = c.getContext('2d');
    const W = c.width, R = W / 2 - 16, cx = W / 2, cy = W / 2;
    const az = this.view.cam.az;
    const brg = this.world.nav.brg;
    const vx = Math.sin(brg * DEG), vz = -Math.cos(brg * DEG);
    const sx = vx * Math.cos(az) - vz * Math.sin(az), sy = vx * Math.sin(az) + vz * Math.cos(az);
    ctx.fillStyle = '#ff4fd8';
    ctx.beginPath(); ctx.arc(cx + sx * R, cy + sy * R, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx + sx * R * 0.55, cy + sy * R * 0.55); ctx.lineTo(cx + sx * R, cy + sy * R); ctx.stroke();
    // zadany kurs autopilota
    const ap = this.world.autopilot;
    if (ap.on) {
      const ax = Math.sin(ap.hdg * DEG), az2 = -Math.cos(ap.hdg * DEG);
      const px = ax * Math.cos(az) - az2 * Math.sin(az), py = ax * Math.sin(az) + az2 * Math.cos(az);
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx + px * R, cy + py * R, 4, 0, Math.PI * 2); ctx.stroke();
    }
  }

  showHelp() {
    const back = h('div.modal-back', { onclick: (e) => { if (e.target === back) back.remove(); } });
    const m = h('div.modal.glass', { style: { width: '780px', maxHeight: '86vh', overflow: 'auto' } },
      h('h2', {}, 'Pomoc – rejs'),
      ...buildPassageHelpContent(),
      h('div', { style: { textAlign: 'right', marginTop: '10px' } }, h('button.btn.primary', { onclick: () => back.remove() }, 'OK')));
    back.appendChild(m);
    this.sim.appendChild(back);
  }

  showResult(r) {
    const back = h('div.modal-back');
    const s = r.stats;
    const col = r.score >= 85 ? '#3ddc84' : r.score >= 60 ? '#ffd166' : '#ff5a5a';
    const fmtT = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    const marksOk = this.world.marks.filter((m) => m.required);
    const okN = marksOk.filter((m) => m.state === 'ok').length;
    const tr = (k, v) => h('tr', {}, h('td', {}, k), h('td', {}, v));
    const m = h('div.modal.glass', {},
      h('h2', {}, '⚓ Rejs ukończony!'),
      h('div.score', { style: { color: col } }, `${r.score}`),
      h('div', { style: { textAlign: 'center' }, class: 'muted' }, 'punktów na 100'),
      h('table.spec-table', { style: { marginTop: '14px' } },
        tr('Czas rejsu', fmtT(r.time)),
        tr('Przebyta droga', `${(s.dist / NM).toFixed(2)} nm (trasa: ${(s.length / NM).toFixed(2)} nm)`),
        tr('Średnie odchylenie od toru', `${s.avgXte.toFixed(0)} m`),
        tr('Znaki minięte poprawnie', `${okN} / ${marksOk.length}`),
        tr('Znaki z niewłaściwej strony', `${s.wrongSide}`),
        tr('Wejścia w strefy zagrożeń', `${s.avoid}`),
        tr('Mielizna / brzeg', `${s.groundings}`),
        tr('Zderzenia ze znakami', `${s.markHits}`)),
      r.items.length ? h('div', { style: { marginTop: '10px' } }, h('h4', { style: { margin: '0 0 4px' } }, 'Punkty karne'),
        h('table.spec-table', {}, ...r.items.map((i) => tr(i.label, `−${i.pts}`)))) : h('div.hint', {}, 'Bez punktów karnych – żegluga wzorowa!'),
      h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' } },
        h('button.btn', { onclick: () => back.remove() }, 'Zostań na morzu'),
        h('button.btn', { onclick: () => this.restart() }, '↺ Jeszcze raz'),
        h('button.btn.primary', { onclick: () => this.exit() }, 'Menu')));
    back.appendChild(m);
    this.sim.appendChild(back);
  }
}

export { PASSAGES, drawMarkSymbol };
