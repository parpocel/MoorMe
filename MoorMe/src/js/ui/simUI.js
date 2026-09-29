// Ekran symulacji: widok 3D + panele sterowania silnikiem, sterami strumieniowymi i linami
import { h } from './dom.js';
import { World } from '../physics/world.js';
import { LINE_STATE_LABEL, TENDING_LABEL } from '../physics/lines.js';
import { View3D } from '../render/view3d.js';
import { Sound } from '../audio.js';
import { BOATS } from '../data/boats.js';
import { generateHarbor, harborOpts, ROLE_NAMES, METHODS } from '../data/harbors.js';
import { buildHelpContent } from './help.js';
import { DEG, KN, clamp, thetaToCompass, wrapPi, localToWorld, tensionColor } from '../math.js';

export class SimScreen {
  constructor(root, config, callbacks) {
    this.root = root;
    this.config = config;
    this.cb = callbacks;
    this.spec = BOATS[config.boatId];
    this.harbor = generateHarbor(harborOpts(config, this.spec));
    this.world = new World({
      spec: this.spec,
      equip: JSON.parse(JSON.stringify(config.equip)),
      harbor: this.harbor,
      weather: config.weather,
      scenario: config.scenario,
      start: config.start
    });
    this.paused = false;
    this.timeScale = 1;
    this.keys = new Set();
    this.selectedLine = null;
    this.pickLine = null;
    this.logItems = [];
    this.sound = new Sound();
    this.build();
    this.world.onEvent = (e) => this.pushLog(e);
    this.world.onImpact = (s, kind) => this.sound.bump(s, kind);
    this.world.onFinish = (r) => setTimeout(() => this.showResult(r), 600);
    this.view.life.onCry = (pos) => {
      // głośność zależna od odległości od kamery
      const c = this.view.cam;
      const d = Math.hypot(pos.x - c.tx, pos.z - c.tz);
      if (d < 90) this.sound.gull(clamp(1 - d / 90, 0.1, 1));
    };
    this.view.onClick = (p) => this.onViewClick(p);
    this.view.onHover = (p) => this.onViewHover(p);
    this.last = performance.now();
    this.running = true;
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
    this.pushLog({ msg: config.scenario === 'moor' ? `Cel: zacumuj – ${METHODS[config.method].name.toLowerCase()}` : 'Cel: odcumuj i wyjdź ze stanowiska', type: 'info' });
    if (config.scenario === 'unmoor') this.pushLog({ msg: 'Liny założone na biegowo, jedna osoba załogi na kei.', type: 'info' });
  }

  build() {
    const r = this.root;
    r.innerHTML = '';
    const sim = h('div', { id: 'sim' });
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

    // --- Info ---
    this.info = h('div.hud.glass', { id: 'hud-info' });
    sim.appendChild(this.info);
    // --- Cel ---
    this.goal = h('div.hud.glass', { id: 'hud-goal' });
    sim.appendChild(this.goal);
    // --- Pasek górny ---
    const top = h('div.hud.glass', { id: 'hud-top' });
    this.pauseBtn = h('button.btn.sm', { onclick: () => this.togglePause(), title: 'Pauza (P)' }, '⏸ Pauza');
    top.appendChild(this.pauseBtn);
    this.speedBtns = [0.5, 1, 2, 4].map((s) => h('button.btn.sm', { class: s === 1 ? 'on' : '', onclick: () => this.setSpeed(s) }, `${s}×`));
    top.append(...this.speedBtns);
    top.appendChild(h('span', { style: { width: '8px' } }));
    this.followBtn = h('button.btn.sm.on', { onclick: () => { this.view.cam.follow = !this.view.cam.follow; } , title: 'Kamera śledzi jacht (F)' }, '🎯 Śledź');
    top.appendChild(this.followBtn);
    for (const [k, n] of [['iso', 'Izo'], ['close', 'Blisko'], ['top', 'Z góry'], ['helm', 'Za rufą'], ['fpv', '👁 Kapitan']]) top.appendChild(h('button.btn.sm', { onclick: () => this.view.setView(k) }, n));
    this.soundBtn = h('button.btn.sm', { onclick: () => { this.sound.enabled = !this.sound.enabled; this.soundBtn.textContent = this.sound.enabled ? '🔊' : '🔇'; } }, '🔊');
    top.appendChild(this.soundBtn);
    top.appendChild(h('button.btn.sm', { onclick: () => this.toggleWeather(), title: 'Pogoda i pora dnia (O)' }, '🌦 Pogoda'));
    top.appendChild(h('button.btn.sm', { onclick: () => this.showHelp() }, '❔ Pomoc'));
    top.appendChild(h('button.btn.sm', { onclick: () => this.restart() }, '↺ Od nowa'));
    top.appendChild(h('button.btn.sm.danger', { onclick: () => this.exit() }, '✕ Menu'));
    sim.appendChild(top);
    // --- Kompas ---
    const comp = h('div.hud.glass', { id: 'hud-compass' });
    this.compass = h('canvas', { width: 170, height: 170, style: { width: '170px', height: '170px', display: 'block' } });
    comp.appendChild(this.compass);
    sim.appendChild(comp);
    // --- Log ---
    this.logEl = h('div.hud', { id: 'hud-log' });
    sim.appendChild(this.logEl);

    // --- Sterowanie ---
    const ctl = h('div.hud', { id: 'hud-controls' });
    ctl.appendChild(this.buildEngine());
    ctl.appendChild(this.buildHelm());
    sim.appendChild(ctl);

    // --- Liny ---
    const lines = h('div.hud.glass', { id: 'hud-lines' });
    lines.appendChild(h('div.head', {}, h('h3', { style: { fontSize: '15px' } }, 'Cumy i liny'),
      h('div', { style: { display: 'flex', gap: '6px' } },
        h('button.btn.sm.on', { onclick: () => this.startRig(), title: 'Kliknij knagę, (kluzę/półkluzę) i poler w widoku 3D (K)' }, '🖱 Knaga → poler'),
        h('button.btn.sm', { onclick: () => this.showPrepareLine() }, '+ Z listy'))));
    this.linesList = h('div', { id: 'lines-list' });
    lines.appendChild(this.linesList);
    sim.appendChild(lines);

    this.pickBanner = h('div.hud.glass', { id: 'pick-banner', style: { display: 'none' } });
    sim.appendChild(this.pickBanner);
    this.tooltip = h('div.tooltip', { style: { display: 'none' } });
    sim.appendChild(this.tooltip);
    this.pausedEl = h('div.paused-banner', { style: { display: 'none' } }, 'PAUZA');
    sim.appendChild(this.pausedEl);
    this.sim = sim;

    this.onKeyDown = (e) => this.keyDown(e);
    this.onKeyUp = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this._blur = () => this.keys.clear());
    this.renderLines(true);
  }

  // ---------- Panel silnika ----------
  buildEngine() {
    const b = this.world.boat;
    const panel = h('div.glass.ctl');
    panel.appendChild(h('h4', {}, 'Silnik'));
    const row = h('div', { style: { display: 'flex', gap: '12px' } });
    const thr = h('div.throttle', { title: 'Manetka: przeciągnij (W/S, X = luz)' });
    thr.appendChild(h('div.neutral'));
    thr.appendChild(h('div.lbl', { style: { top: '3px' } }, 'NAPRZÓD'));
    thr.appendChild(h('div.lbl', { style: { top: '47%' } }, 'LUZ'));
    thr.appendChild(h('div.lbl', { style: { bottom: '3px' } }, 'WSTECZ'));
    const knob = h('div.knob');
    thr.appendChild(knob);
    this.thrKnob = knob;
    const setFromY = (e) => {
      const r = thr.getBoundingClientRect();
      let v = 1 - 2 * clamp((e.clientY - r.top) / r.height, 0, 1);
      if (Math.abs(v) < 0.06) v = 0;
      b.throttle = v;
    };
    thr.addEventListener('pointerdown', (e) => { this.sound.init(); thr.setPointerCapture(e.pointerId); setFromY(e); thr._drag = true; });
    thr.addEventListener('pointermove', (e) => { if (thr._drag) setFromY(e); });
    thr.addEventListener('pointerup', () => { thr._drag = false; });
    thr.addEventListener('dblclick', () => { b.throttle = 0; });
    row.appendChild(thr);
    const g = h('div.gauge');
    this.rpmVal = h('div.val', {}, '0');
    this.gearEl = h('span.gear', {}, 'N');
    this.thrustVal = h('div.small.muted', {}, '');
    this.walkEl = h('div.small', {}, '');
    g.append(h('div.small.muted', {}, 'Obroty'), this.rpmVal, h('div', { style: { margin: '6px 0' } }, this.gearEl), this.thrustVal, this.walkEl);
    g.appendChild(h('div.small.muted', { style: { marginTop: '6px' } }, `Śruba ${this.world.equip.propHand === 'right' ? 'prawoskrętna' : 'lewoskrętna'}`));
    g.appendChild(h('div.small.muted', {}, this.world.equip.drive === 'shaft' ? 'Wał napędowy' : 'Saildrive'));
    row.appendChild(g);
    panel.appendChild(row);
    return panel;
  }

  buildHelm() {
    const b = this.world.boat, w = this.world, eq = w.equip;
    const panel = h('div.glass.ctl.rudder-wrap');
    panel.appendChild(h('h4', {}, 'Ster'));
    const rud = h('div.rudder', { title: 'Płetwa sterowa: przeciągnij (A/D, R = zero)' });
    rud.appendChild(h('div.mid'));
    const act = h('div.act');
    rud.appendChild(act);
    const knob = h('div.knob');
    rud.appendChild(knob);
    this.rudKnob = knob; this.rudAct = act;
    const setFromX = (e) => {
      const r = rud.getBoundingClientRect();
      let v = (2 * clamp((e.clientX - r.left) / r.width, 0, 1) - 1) * 35;
      if (Math.abs(v) < 2) v = 0;
      b.rudderCmd = v * DEG;
    };
    rud.addEventListener('pointerdown', (e) => { this.sound.init(); rud.setPointerCapture(e.pointerId); setFromX(e); rud._drag = true; });
    rud.addEventListener('pointermove', (e) => { if (rud._drag) setFromX(e); });
    rud.addEventListener('pointerup', () => { rud._drag = false; });
    rud.addEventListener('dblclick', () => { b.rudderCmd = 0; });
    panel.appendChild(rud);
    this.rudVal = h('div.small', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '3px' } });
    panel.appendChild(this.rudVal);

    // stery strumieniowe
    panel.appendChild(h('h4', { style: { marginTop: '10px' } }, 'Stery strumieniowe'));
    const mkThr = (kind, label, keyL, keyR, enabled) => {
      const row = h('div.thr-row');
      row.appendChild(h('span.name', {}, label));
      if (!enabled) { row.appendChild(h('span.small.muted', {}, 'brak')); return row; }
      const bl = h('button.thr-btn', { title: `W lewo (${keyL})` }, '◀');
      const br = h('button.thr-btn', { title: `W prawo (${keyR})` }, '▶');
      const heat = h('div.heat', {}, h('div.bar', {}, h('div')));
      const hold = (btn, v) => {
        btn.addEventListener('pointerdown', (e) => { this.sound.init(); btn.setPointerCapture(e.pointerId); this.thrHold[kind] = v; });
        btn.addEventListener('pointerup', () => { this.thrHold[kind] = 0; });
        btn.addEventListener('pointercancel', () => { this.thrHold[kind] = 0; });
      };
      hold(bl, -1); hold(br, 1);
      row.append(bl, br, heat);
      this[kind + 'Btns'] = { bl, br, heat: heat.querySelector('.bar > div') };
      if (kind === 'bow' && eq.bowThruster === 'proportional') {
        const pr = h('input', { type: 'range', min: 0.2, max: 1, step: 0.05, value: 1, title: 'Moc (proporcjonalny)', style: { width: '60px' } });
        pr.addEventListener('input', () => { this.thrPower = parseFloat(pr.value); });
        row.appendChild(pr);
      }
      return row;
    };
    this.thrHold = { bow: 0, stern: 0 };
    this.thrPower = 1;
    panel.appendChild(mkThr('bow', 'Dziobowy', 'Q', 'E', eq.bowThruster !== 'none'));
    panel.appendChild(mkThr('stern', 'Rufowy', 'Z', 'C', !!eq.sternThruster));

    // odbijacze i załoga
    panel.appendChild(h('h4', { style: { marginTop: '10px' } }, 'Odbijacze'));
    const fr = h('div.seg');
    this.fenderBtns = {};
    for (const [k, n] of [['port', 'Lewa'], ['starboard', 'Prawa'], ['stern', 'Rufa']]) {
      const btn = h('button', { class: w.fenderOut[k] ? 'on' : '', onclick: () => { w.fenderOut[k] = !w.fenderOut[k]; btn.classList.toggle('on', w.fenderOut[k]); } }, n);
      fr.appendChild(btn);
    }
    panel.appendChild(fr);
    const names = this.view.crewNames;
    panel.appendChild(h('h4', { style: { marginTop: '10px' } }, `${names[0]} (kapitan) · ${names.slice(1).join(' · ')}`));
    this.crewBtn = h('button.btn.sm', { style: { width: '100%' }, onclick: () => (w.crew.ashore ? w.crewAboard() : w.crewAshore()) }, 'Zejdź na ląd');
    panel.appendChild(this.crewBtn);
    return panel;
  }

  // ---------- Liny ----------
  lineSignature() {
    return this.world.lines.map((l) => `${l.id}:${l.state}:${l.mode}:${l.winch}:${l.tending}:${l.length}:${l === this.selectedLine}:${l.jumped}:${l.plannedTarget ? l.plannedTarget.id : ''}:${l.mooringQueued}:${l.releaseQueued}`).join('|') + `|${this.world.crew.ashore}`;
  }

  renderLines(force) {
    if (this.selectedLine && !this.world.lines.includes(this.selectedLine)) this.selectedLine = null;
    if (this.pickLine && !this.world.lines.includes(this.pickLine)) this.cancelPick();
    const sig = this.lineSignature();
    if (!force && sig === this._lineSig) { this.updateLineBars(); return; }
    this._lineSig = sig;
    const w = this.world;
    this.linesList.innerHTML = '';
    this.lineBars = new Map();
    w.lines.forEach((line, idx) => {
      line.selected = line === this.selectedLine;
      const cleat = w.deckItem(line.cleatId);
      const fl = line.fairleadId ? w.deckItem(line.fairleadId) : null;
      const card = h('div.line-card', { class: line.selected ? 'selected' : '', onclick: (e) => { if (e.target.tagName !== 'BUTTON') this.selectLine(line); } });
      const stCls = line.state === 'attached' ? 'attached' : line.state === 'broken' ? 'broken' : '';
      const modeTxt = line.isMooring ? 'muring' : line.mode === 'slip' ? 'na biegowo' : 'na stałe';
      card.appendChild(h('div.top', {},
        h('div', {}, h('span.nm', {}, `${idx + 1}. ${line.name}`), h('div.st', { class: stCls }, `${LINE_STATE_LABEL[line.state] || line.state}${line.state === 'attached' ? ' · ' + TENDING_LABEL[line.tending] : ''}${line.target && line.state === 'attached' && !line.isMooring ? ' · ' + line.target.label : ''}`)),
        h('div.small.muted', { style: { textAlign: 'right' } }, `${modeTxt} · ${line.length} m${line.winch ? ' · kabestan' : ''}`, line.jumped ? h('div', { style: { color: '#ffb347' } }, 'wyskoczyła z półkluzy!') : null)
      ));
      if (!line.isMooring) {
        const tgt = line.state === 'attached' || line.state === 'waitingCrew' ? line.target : line.state === 'queued' ? line.queuedTarget : line.state === 'pending' ? line.pendingTarget : line.plannedTarget;
        card.appendChild(h('div.route', {}, h('span.chip', {}, cleat ? cleat.label : '?'), fl ? ['→', h('span.chip.fl', {}, fl.label)] : null, '→', h('span.chip', { class: tgt ? 'tg' : 'none' }, tgt ? tgt.label : 'poler nie wskazany')));
      }
      const tval = h('div.small', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '3px' } });
      const tbar = h('div.tbar', {}, h('div'));
      if (line.state === 'attached') card.append(tval, tbar);
      this.lineBars.set(line.id, { tval, tbar: tbar.firstChild });
      const acts = h('div.acts');
      const btn = (label, fn, cls = '', title = '') => h('button.btn.xs', { class: cls, onclick: (e) => { e.stopPropagation(); fn(); this.renderLines(true); }, title }, label);
      const holdBtn = (label, mode, title) => {
        const b = h('button.btn.xs', { class: line.tending === mode ? 'on' : '', title }, label);
        b.addEventListener('pointerdown', (e) => { e.stopPropagation(); b.setPointerCapture(e.pointerId); w.setTending(line, mode); b.classList.add('on'); });
        const up = () => { if (line.tending === mode) w.setTending(line, 'hold'); b.classList.remove('on'); };
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        return b;
      };
      switch (line.state) {
        case 'ready':
          if (line.plannedTarget) acts.append(btn(`⚓ Załóż na ${line.plannedTarget.label}`, () => this.attachOrPick(line), 'on', 'Załóż na wskazany poler (B)'));
          acts.append(
            btn(line.plannedTarget ? 'Inny poler…' : '⚓ Załóż…', () => this.startPick(line), line.plannedTarget ? '' : 'on', 'Wybierz poler / knagę / dalbę'),
            btn(line.mode === 'slip' ? '⇄ na stałe' : '⇄ na biegowo', () => w.toggleMode(line), '', 'Zmień sposób mocowania'),
            btn(line.winch ? 'Kabestan: tak' : 'Kabestan: nie', () => { line.winch = !line.winch; }, '', 'Obsługa na kabestanie'),
            btn('−2 m', () => { line.length = Math.max(4, line.length - 2); line.rest = line.length; }),
            btn('+2 m', () => { line.length = Math.min(40, line.length + 2); line.rest = line.length; }),
            btn('🗑', () => { w.removeLine(line); if (this.selectedLine === line) this.selectedLine = null; }, 'danger', 'Usuń linę')
          );
          break;
        case 'onQuay':
          if (line.mooringQueued) acts.append(h('span.small', { style: { color: '#ffd166' } }, 'Załoga podejmie muring przy kei'), btn('Anuluj', () => w.release(line)));
          else acts.append(btn('⚓ Podejmij muring', () => w.pickupMooring(line), 'on', 'Załoga podejmuje linkę pilotową z kei (B)'));
          acts.append(btn(line.winch ? 'Kabestan: tak' : 'Kabestan: nie', () => { line.winch = !line.winch; }));
          break;
        case 'queued':
          acts.append(btn('Anuluj', () => w.release(line)), btn('Inny poler…', () => { w.release(line); this.startPick(line); }));
          if (!line.isMooring) acts.append(btn(line.mode === 'slip' ? '⇄ na stałe' : '⇄ na biegowo', () => w.toggleMode(line), '', 'Zmień sposób mocowania (załoga założy linę tak, jak ustawisz)'));
          acts.append(btn(line.winch ? 'Kabestan: tak' : 'Kabestan: nie', () => { line.winch = !line.winch; }));
          break;
        case 'pending':
          acts.append(btn('Przerwij', () => w.release(line)));
          break;
        case 'waitingCrew':
          acts.append(btn('Anuluj', () => w.cancelRelease(line), '', 'Załoga wraca – lina zostaje założona'));
          break;
        case 'attached':
          acts.append(
            holdBtn('⬆ Wybieraj', 'haul', 'Przytrzymaj (T)'),
            holdBtn('⬇ Luzuj', 'ease', 'Przytrzymaj (G)'),
            btn('Obłóż', () => w.setTending(line, 'hold'), line.tending === 'hold' ? 'on' : '', 'Zablokuj długość (Y)'),
            btn('Luzem', () => w.setTending(line, line.tending === 'free' ? 'hold' : 'free'), line.tending === 'free' ? 'on' : '', 'Puść linę luzem'),
            btn('✋ Oddaj', () => w.release(line), 'danger', 'Oddaj / zdejmij linę (N)')
          );
          if (!line.isMooring && w.crew.ashore) acts.append(btn('⇄ tryb', () => w.toggleMode(line), '', 'Załoga na kei przekłada linę'));
          acts.append(btn(line.winch ? 'Kabestan ✓' : 'Kabestan ✗', () => { line.winch = !line.winch; }));
          if (line.releaseQueued) acts.append(btn('Anuluj oddanie', () => w.cancelRelease(line), '', 'Załoga jeszcze nie zeszła – zostaw linę założoną'));
          break;
        case 'broken':
          acts.append(btn('🗑 Usuń', () => { line.state = 'ready'; w.removeLine(line); }, 'danger'));
          break;
        default:
          break;
      }
      card.appendChild(acts);
      this.linesList.appendChild(card);
    });
    if (!w.lines.length) this.linesList.appendChild(h('div.small.muted', { style: { padding: '10px' } }, 'Brak aktywnych lin. Kliknij knagę na jachcie, a potem poler (albo „🖱 Knaga → poler”).'));
    this.updateLineBars();
  }

  updateLineBars() {
    const bl = this.world.lineParams.breakLoad;
    for (const line of this.world.lines) {
      const e = this.lineBars && this.lineBars.get(line.id);
      if (!e || line.state !== 'attached') continue;
      const q = line.tension / bl;
      e.tval.innerHTML = `<span>Naciąg: <b>${(line.tension / 1000).toFixed(2)} kN</b></span><span class="muted">${line.slack > 0.05 ? 'luz ' + line.slack.toFixed(1) + ' m' : 'napięta'} · ${line.dist ? line.dist.toFixed(1) : '-'} m</span>`;
      e.tbar.style.width = `${clamp(q * 100 * 2, 0, 100)}%`;
      e.tbar.style.background = '#' + tensionColor(q).toString(16).padStart(6, '0');
    }
  }

  selectLine(line) {
    this.selectedLine = this.selectedLine === line ? null : line;
    this.renderLines(true);
  }

  attachOrPick(line) {
    const w = this.world;
    if (line.plannedTarget) {
      w.attach(line, line.plannedTarget); // w zasięgu – od razu, inaczej załoga czeka i założy sama
      this.renderLines(true);
      return;
    }
    this.startPick(line);
  }

  startPick(line) {
    const w = this.world;
    if (line.isMooring) { w.pickupMooring(line); return; }
    if (this.rig) this.cancelRig();
    this.pickLine = line;
    this.selectedLine = line;
    const opts = w.attachOptions(line);
    this.pickOpts = opts;
    this.view.highlightBollards(opts.slice(0, 40));
    this.pickBanner.style.display = 'block';
    this.pickBanner.innerHTML = '';
    this.pickBanner.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, h('b', {}, `Załóż: ${line.name}`), h('button.btn.xs', { onclick: () => this.cancelPick() }, 'Anuluj (Esc)')));
    this.pickBanner.appendChild(h('div.small.muted', { style: { margin: '4px 0 6px' } }, 'Kliknij podświetlony poler w widoku 3D lub wybierz z listy. Zielone – w zasięgu.'));
    const list = h('div.pick-list');
    for (const o of opts.slice(0, 7)) {
      list.appendChild(h('div', { class: o.ok ? '' : 'bad', onclick: () => { if (o.ok) { w.attach(line, o.bollard); this.cancelPick(); } } },
        h('span', {}, `${o.bollard.label}${line.suggestedTarget === o.bollard ? ' ★' : ''}`),
        h('span', {}, `${o.dist.toFixed(1)} m ${o.ok ? (o.via === 'crew' ? '· przez załogę' : '· z pokładu') : '· ' + o.why}`)));
    }
    this.pickBanner.appendChild(list);
  }

  cancelPick() {
    this.pickLine = null;
    this.view.highlightBollards(null);
    this.pickBanner.style.display = 'none';
    this.renderLines(true);
  }

  // ---------- Wskazywanie liny myszą: knaga -> (kluza/półkluza) -> poler ----------
  startRig() {
    if (this.pickLine) this.cancelPick();
    this.rig = { stage: 'cleat', mode: this.rigMode || 'fixed' };
    this.updateRig();
  }

  rigTempLine() {
    const r = this.rig;
    return { cleatId: r.cleat.id, fairleadId: r.fairlead === undefined ? (this.world.autoFairlead(r.cleat)?.id ?? null) : r.fairlead ? r.fairlead.id : null, mode: r.mode, length: 40, jumped: false, isMooring: false };
  }

  updateRig() {
    const r = this.rig, w = this.world;
    if (!r) return;
    this.pickBanner.style.display = 'block';
    this.pickBanner.innerHTML = '';
    const head = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('b', {}, r.stage === 'cleat' ? 'Nowa lina: wskaż knagę na jachcie' : `Nowa lina z: ${r.cleat.label}`),
      h('button.btn.xs', { onclick: () => this.cancelRig() }, 'Anuluj (Esc)'));
    this.pickBanner.appendChild(head);
    if (r.stage === 'cleat') {
      this.pickBanner.appendChild(h('div.small.muted', { style: { marginTop: '4px' } }, 'Kliknij podświetloną knagę (żółte pierścienie na pokładzie).'));
      this.view.highlightDeck((it) => (it.kind === 'cleat' ? 0xffd166 : null));
      this.view.highlightBollards(null);
      return;
    }
    const fl = r.fairlead === undefined ? w.autoFairlead(r.cleat) : r.fairlead;
    this.pickBanner.appendChild(h('div.small', { style: { margin: '4px 0' } },
      'Prowadzenie: ', h('b', {}, fl ? fl.label : 'prosto z knagi'), r.fairlead === undefined && fl ? h('span.muted', {}, ' (auto)') : null));
    this.pickBanner.appendChild(h('div.small.muted', { style: { marginBottom: '6px' } }, 'Opcjonalnie kliknij kluzę / półkluzę (niebieskie), potem poler na kei (zielony = w zasięgu).'));
    const modeSeg = h('div.seg', { style: { marginBottom: '4px' } });
    for (const [v, l] of [['fixed', 'Na stałe (oko)'], ['slip', 'Na biegowo']]) modeSeg.appendChild(h('button', { class: r.mode === v ? 'on' : '', onclick: () => { r.mode = v; this.rigMode = v; this.updateRig(); } }, l));
    modeSeg.appendChild(h('button', { class: r.fairlead === null ? 'on' : '', onclick: () => { r.fairlead = r.fairlead === null ? undefined : null; this.updateRig(); } }, 'Bez kluzy'));
    this.pickBanner.appendChild(modeSeg);
    this.view.highlightDeck((it) => (it === r.cleat ? 0xffd166 : it.kind !== 'cleat' ? (it === fl ? 0x5ec8ff : 0x2a6f97) : null));
    const opts = w.attachOptions(this.rigTempLine());
    this.view.highlightBollards(opts.slice(0, 40));
  }

  cancelRig() {
    this.rig = null;
    this.view.highlightDeck(null);
    this.view.highlightBollards(null);
    this.pickBanner.style.display = 'none';
  }

  // ---------- Pogoda i pora dnia w trakcie symulacji ----------
  toggleWeather() {
    if (this.weatherPanel) { this.weatherPanel.remove(); this.weatherPanel = null; return; }
    const atmo = this.view.atmo, env = this.world.env;
    const fmtH = (hh) => `${String(Math.floor(hh)).padStart(2, '0')}:${String(Math.floor((hh % 1) * 60)).padStart(2, '0')}`;
    const row = (label, inp, out) => h('div.field', {}, h('label', {}, label), h('div.row', {}, inp, out));
    const range = (min, max, step, val, on) => { const i = h('input', { type: 'range', min, max, step, value: val }); i.addEventListener('input', () => on(+i.value)); return i; };
    const hourOut = h('b', {}, fmtH(atmo.hour));
    const hourInp = range(0, 23.75, 0.25, atmo.hour, (v) => { atmo.setHour(v); hourOut.textContent = fmtH(v); });
    const flow = h('input', { type: 'checkbox' });
    flow.checked = atmo.timeFlows;
    flow.addEventListener('change', () => { atmo.timeFlows = flow.checked; });
    const skySeg = h('div.seg');
    const drawSky = () => {
      skySeg.innerHTML = '';
      for (const [k, name] of [['clear', '☀ Słonecznie'], ['cloudy', '☁ Pochmurno'], ['rain', '🌧 Deszcz'], ['fog', '🌫 Mgła']]) {
        skySeg.appendChild(h('button', { class: atmo.sky === k ? 'on' : '', onclick: () => { atmo.setSky(k); drawSky(); } }, name));
      }
    };
    drawSky();
    const presets = h('div.seg', {}, [['Świt', 5.5], ['Dzień', 13], ['Zachód', 19.2], ['Noc', 23]].map(([n, v]) => h('button', { onclick: () => { atmo.setHour(v); hourInp.value = v; hourOut.textContent = fmtH(v); } }, n)));
    const windOut = h('b', {}, `${env.w.windKn} kn`);
    const windInp = range(0, 35, 1, env.w.windKn, (v) => { env.w.windKn = v; windOut.textContent = `${v} kn`; });
    const dirOut = h('b', {}, `${env.w.windFrom}°`);
    const dirInp = range(0, 355, 5, env.w.windFrom, (v) => { env.w.windFrom = v; dirOut.textContent = `${v}°`; });
    const gustOut = h('b', {}, `${Math.round(env.w.gust * 100)}%`);
    const gustInp = range(0, 1, 0.05, env.w.gust, (v) => { env.w.gust = v; gustOut.textContent = `${Math.round(v * 100)}%`; });
    const panel = h('div.hud.glass', { id: 'hud-weather' },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, h('b', {}, 'Pogoda i pora dnia'), h('button.btn.xs', { onclick: () => this.toggleWeather() }, '✕')),
      row('Godzina', hourInp, hourOut),
      presets,
      h('label.small', { style: { display: 'block', margin: '6px 0' } }, flow, ' Czas płynie (1 s = 1 min)'),
      h('div.field', {}, h('label', {}, 'Niebo'), skySeg),
      row('Wiatr', windInp, windOut),
      row('Kierunek wiatru (skąd)', dirInp, dirOut),
      row('Porywistość', gustInp, gustOut),
      h('div.small.muted', {}, 'Nocą świecą światła nawigacyjne jachtów, światła kotwiczne sąsiadów, latarnie i latarnie morskie.'));
    this.sim.appendChild(panel);
    this.weatherPanel = panel;
    this._hourOut = hourOut; this._hourInp = hourInp; this._fmtH = fmtH;
  }

  // ---------- Okrągłe menu liny (klik na linę w 3D) ----------
  openRadial(line, px, py) {
    this.closeRadial();
    this.tooltip.style.display = 'none';
    const w = this.world;
    const opts = [];
    const act = (label, icon, fn, cls = '') => opts.push({ label, icon, fn, cls });
    const tend = (mode) => (hold) => { w.setTending(line, mode); this._radialHold = hold ? { line, mode } : null; };
    if (line.state === 'attached') {
      act('Wybieraj', '⬆', tend('haul'), line.tending === 'haul' ? 'on' : '');
      act('Obłóż', '■', () => w.setTending(line, 'hold'), line.tending === 'hold' ? 'on' : '');
      act('Luzuj', '⬇', tend('ease'), line.tending === 'ease' ? 'on' : '');
      act('Luz', '〰', () => w.setTending(line, line.tending === 'free' ? 'hold' : 'free'), line.tending === 'free' ? 'on' : '');
      act('Oddaj', '✋', () => w.release(line), 'danger');
    } else if (line.state === 'onQuay') {
      act('Podejmij', '⚓', () => w.pickupMooring(line));
    } else if (line.state === 'queued' || line.state === 'pending') {
      act('Anuluj', '✕', () => w.release(line), 'danger');
    } else if (line.state === 'waitingCrew') {
      act('Anuluj', '✕', () => w.cancelRelease(line), 'danger');
    } else if (line.state === 'ready') {
      act('Załóż', '⚓', () => this.attachOrPick(line));
      act('Usuń', '🗑', () => w.removeLine(line), 'danger');
    }
    act('Wybierz', '☰', () => { this.selectedLine = line; });
    const menu = h('div.radial', { style: { left: `${px}px`, top: `${py}px` } });
    const R = 78;
    opts.forEach((o, i) => {
      const a = -Math.PI / 2 + (i / opts.length) * Math.PI * 2;
      const b = h('button.rb', { class: o.cls, style: { left: `${Math.cos(a) * R}px`, top: `${Math.sin(a) * R}px` } }, h('span.ic', {}, o.icon), h('span', {}, o.label));
      // krótkie kliknięcie – tryb ciągły; przytrzymanie wybierania/luzowania – działa tylko podczas trzymania
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); b._t = performance.now(); o.fn(true); });
      b.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        const held = performance.now() - (b._t || 0) > 350;
        if (this._radialHold) {
          if (held) { this.world.setTending(this._radialHold.line, 'hold'); }
          this._radialHold = null;
        }
        this.closeRadial();
        this.renderLines(true);
      });
      menu.appendChild(b);
    });
    menu.appendChild(h('div.rc', {}, h('b', {}, line.name), h('span', {}, line.state === 'attached' ? `${(line.tension / 1000).toFixed(1)} kN` : (LINE_STATE_LABEL[line.state] || ''))));
    this.sim.appendChild(menu);
    this.radial = menu;
    this._radialOutside = (e) => { if (!menu.contains(e.target)) this.closeRadial(); };
    setTimeout(() => window.addEventListener('pointerdown', this._radialOutside, true), 0);
  }

  closeRadial() {
    if (this.radial) { this.radial.remove(); this.radial = null; }
    if (this._radialOutside) { window.removeEventListener('pointerdown', this._radialOutside, true); this._radialOutside = null; }
  }

  onViewClick(p) {
    const w = this.world;
    if (!p) return;
    if (p.line && !this.pickLine && !(this.rig && this.rig.cleat)) {
      const m = this.view.mousePx;
      if (m) this.openRadial(p.line, m.x, m.y);
      return;
    }
    if (this.pickLine) {
      if (!p.bollard) return;
      const o = w.attachOptions(this.pickLine).find((x) => x.bollard === p.bollard);
      if (o && o.ok) { w.attach(this.pickLine, p.bollard); this.cancelPick(); }
      else if (o) this.pushLog({ msg: `Nie można: ${o.why}`, type: 'warn' });
      return;
    }
    if (p.deckItem) {
      const it = p.deckItem;
      if (it.kind === 'cleat') {
        if (!this.rig) this.rig = { mode: this.rigMode || 'fixed' };
        this.rig.stage = 'route';
        this.rig.cleat = it;
        this.rig.fairlead = undefined;
      } else if (this.rig && this.rig.cleat) {
        this.rig.fairlead = it;
      } else {
        this.pushLog({ msg: 'Najpierw wskaż knagę, potem kluzę/półkluzę i poler', type: 'warn' });
        return;
      }
      this.updateRig();
      return;
    }
    if (p.bollard && this.rig && this.rig.cleat) {
      const r = this.rig;
      const line = w.rigLine(r.cleat.id, r.fairlead === undefined ? undefined : r.fairlead ? r.fairlead.id : null, p.bollard, r.mode);
      this.selectedLine = line;
      this.cancelRig();
      this.renderLines(true);
    }
  }

  onViewHover(p) {
    if (!p || this.radial) { this.tooltip.style.display = 'none'; return; }
    if (p.line) {
      const m = this.view.mousePx;
      const l = p.line;
      this.tooltip.textContent = `${l.name} · ${l.state === 'attached' ? (l.tension / 1000).toFixed(1) + ' kN · ' : ''}kliknij – menu`;
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = `${m.x + 14}px`;
      this.tooltip.style.top = `${m.y - 12}px`;
      return;
    }
    if (p.deckItem) {
      const it = p.deckItem, b = this.world.boat;
      const wp = localToWorld(b.x, b.z, b.th, it.x, it.y);
      const s = this.view.project(wp.x, this.world.deckHeight(it.x) + 0.5, wp.z);
      this.tooltip.textContent = `${it.label}${it.kind === 'cleat' ? (this.rig && this.rig.cleat ? '' : ' · kliknij, by poprowadzić linę') : this.rig && this.rig.cleat ? ' · kliknij, by prowadzić przez' : ''}`;
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = `${s.x + 12}px`;
      this.tooltip.style.top = `${s.y - 10}px`;
      return;
    }
    const b = p.bollard;
    if (!b) { this.tooltip.style.display = 'none'; return; }
    const pp = this.view.project(b.x, b.h + 0.8, b.z);
    let txt = b.label;
    const probe = this.pickLine || (this.rig && this.rig.cleat ? this.rigTempLine() : null);
    if (probe) {
      const o = this.world.attachOptions(probe).find((x) => x.bollard === b);
      if (o) txt += ` · ${o.dist.toFixed(1)} m · ${o.ok ? 'OK' : o.why}`;
    }
    this.tooltip.textContent = txt;
    this.tooltip.style.display = 'block';
    this.tooltip.style.left = `${pp.x + 12}px`;
    this.tooltip.style.top = `${pp.y - 10}px`;
  }

  showPrepareLine() {
    const w = this.world;
    const cleats = w.cleats();
    const fls = w.fairleads();
    const st = { role: 'bow', cleatId: cleats[0]?.id, fairleadId: 'auto', length: 12, mode: 'fixed', winch: false };
    const back = h('div.modal-back');
    const m = h('div.modal.glass');
    const sel = (opts, val, on) => {
      const s = h('select', { style: { width: '100%' } });
      for (const [v, l] of opts) s.appendChild(h('option', { value: v, selected: v === val }, l));
      s.addEventListener('change', () => on(s.value));
      return s;
    };
    const roles = Object.entries(ROLE_NAMES).filter(([k]) => k !== 'mooring');
    const lenOut = h('b', {}, `${st.length} m`);
    const lenInp = h('input', { type: 'range', min: 4, max: 36, step: 1, value: st.length });
    lenInp.addEventListener('input', () => { st.length = +lenInp.value; lenOut.textContent = `${st.length} m`; });
    m.append(
      h('h2', {}, 'Przygotuj linę do podejścia'),
      h('div.field', {}, h('label', {}, 'Rola liny'), sel(roles, st.role, (v) => (st.role = v))),
      h('div.field', {}, h('label', {}, 'Knaga na jachcie'), sel(cleats.map((c) => [c.id, c.label]), st.cleatId, (v) => (st.cleatId = v))),
      h('div.field', {}, h('label', {}, 'Prowadzenie przez'), sel([['auto', 'Automatycznie (najbliższa kluza/półkluza)'], ['none', 'Bez kluzy – prosto z knagi'], ...fls.map((f) => [f.id, f.label])], 'auto', (v) => (st.fairleadId = v))),
      h('div.field', {}, h('label', {}, 'Długość'), h('div.row', {}, lenInp, lenOut)),
      h('div.field', {}, h('label', {}, 'Sposób założenia'), (() => { const s = h('div.seg'); const r = () => { s.innerHTML = ''; for (const [v, l] of [['fixed', 'Na stałe (oko na poler)'], ['slip', 'Na biegowo (wraca na jacht)']]) s.appendChild(h('button', { class: st.mode === v ? 'on' : '', onclick: () => { st.mode = v; r(); } }, l)); }; r(); return s; })()),
      h('div.field', {}, h('label', {}, h('input', { type: 'checkbox', onchange: (e) => (st.winch = e.target.checked) }), ' Obsługa na kabestanie (większa siła, wolniej)')),
      h('div.hint', {}, 'Na stałe: oko rzucasz na poler z pokładu (do ~3.4 m) – zdjąć je może tylko załoga na lądzie. Na biegowo: lina okłada poler i wraca na jacht – potrzebny bliższy dostęp (~1.5 m), ale oddasz ją z pokładu.'),
      h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' } },
        h('button.btn', { onclick: () => back.remove() }, 'Anuluj'),
        h('button.btn.primary', {
          onclick: () => {
            const opts = { role: st.role, name: `${ROLE_NAMES[st.role]} (${w.deckItem(st.cleatId).label.split(' ').pop()})`, cleatId: st.cleatId, length: st.length, mode: st.mode, winch: st.winch };
            if (st.fairleadId === 'none') opts.fairleadId = null;
            else if (st.fairleadId !== 'auto') opts.fairleadId = st.fairleadId;
            const line = w.addLine(opts);
            this.selectedLine = line;
            back.remove();
            this.renderLines(true);
          }
        }, 'Przygotuj'))
    );
    back.appendChild(m);
    this.sim.appendChild(back);
  }

  // ---------- Log ----------
  pushLog(e) {
    const el = h('div', { class: e.type || 'info' }, e.msg);
    this.logEl.appendChild(el);
    this.logItems.push({ el, t: performance.now() });
    while (this.logItems.length > 5) this.logItems.shift().el.remove();
    if (e.type === 'good' || e.type === 'bad' || e.type === 'warn') this.renderLines(true);
  }

  // ---------- Klawiatura ----------
  keyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    this.sound.init();
    const w = this.world, b = w.boat;
    this.keys.add(e.code);
    const line = this.selectedLine;
    switch (e.code) {
      case 'KeyP': case 'Space': this.togglePause(); e.preventDefault(); break;
      case 'KeyX': b.throttle = 0; break;
      case 'KeyR': b.rudderCmd = 0; break;
      case 'KeyF': this.view.cam.follow = !this.view.cam.follow; break;
      case 'KeyV': { const v = ['iso', 'close', 'top', 'helm', 'fpv']; this._vi = ((this._vi || 0) + 1) % v.length; this.view.setView(v[this._vi]); break; }
      case 'KeyM': this.sound.enabled = !this.sound.enabled; break;
      case 'KeyL': w.crew.ashore ? w.crewAboard() : w.crewAshore(); break;
      case 'Escape': if (this.pickLine) this.cancelPick(); if (this.rig) this.cancelRig(); this.closeRadial(); break;
      case 'KeyO': this.toggleWeather(); break;
      case 'KeyK': this.startRig(); break;
      case 'F1': case 'KeyH': this.showHelp(); e.preventDefault(); break;
      case 'KeyB': if (line) { if (line.state === 'ready') this.attachOrPick(line); else if (line.state === 'onQuay') w.pickupMooring(line); } break;
      case 'KeyN': if (line) w.release(line); break;
      case 'KeyY': if (line) w.setTending(line, 'hold'); break;
      case 'KeyT': if (line && line.state === 'attached') w.setTending(line, 'haul'); break;
      case 'KeyG': if (line && line.state === 'attached') w.setTending(line, 'ease'); break;
      default:
        if (/^Digit[1-9]$/.test(e.code)) {
          const i = +e.code.slice(5) - 1;
          if (w.lines[i]) this.selectLine(w.lines[i]);
        }
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    this.renderLines();
  }

  handleHeldKeys(dt) {
    const b = this.world.boat, k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) { b.throttle = clamp(b.throttle + dt * 0.6, -1, 1); if (Math.abs(b.throttle) < 0.02) b.throttle = 0.02; }
    if (k.has('KeyS') || k.has('ArrowDown')) { b.throttle = clamp(b.throttle - dt * 0.6, -1, 1); if (Math.abs(b.throttle) < 0.02) b.throttle = -0.02; }
    if (k.has('KeyA') || k.has('ArrowLeft')) b.rudderCmd = clamp(b.rudderCmd - dt * 45 * DEG, -35 * DEG, 35 * DEG);
    if (k.has('KeyD') || k.has('ArrowRight')) b.rudderCmd = clamp(b.rudderCmd + dt * 45 * DEG, -35 * DEG, 35 * DEG);
    const pw = this.thrPower;
    b.bowCmd = (k.has('KeyQ') ? -1 : 0) + (k.has('KeyE') ? 1 : 0) || this.thrHold.bow;
    b.bowCmd *= pw;
    b.sternCmd = (k.has('KeyZ') ? -1 : 0) + (k.has('KeyC') ? 1 : 0) || this.thrHold.stern;
    const line = this.selectedLine;
    if (line && line.state === 'attached') {
      if (!k.has('KeyT') && line.tending === 'haul' && this._keyHaul) { this.world.setTending(line, 'hold'); }
      if (!k.has('KeyG') && line.tending === 'ease' && this._keyEase) { this.world.setTending(line, 'hold'); }
      this._keyHaul = k.has('KeyT');
      this._keyEase = k.has('KeyG');
    }
  }

  togglePause() {
    this.paused = !this.paused;
    this.pauseBtn.textContent = this.paused ? '▶ Wznów' : '⏸ Pauza';
    this.pausedEl.style.display = this.paused ? 'block' : 'none';
    if (this.paused) this.sound.suspend(); else this.sound.resume();
  }
  setSpeed(s) {
    this.timeScale = s;
    this.speedBtns.forEach((b) => b.classList.toggle('on', b.textContent === `${s}×`));
  }

  // ---------- Pętla ----------
  frame(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    if (!this.paused) {
      this.handleHeldKeys(dt);
      this.world.update(dt * this.timeScale);
    }
    this.view.render(this.paused ? 0 : dt * this.timeScale, dt);
    this.updateHUD();
    this.renderLines();
    this.sound.update(this.world.boat, this.world.env.windSpeed / KN);
    requestAnimationFrame(this.frame);
  }

  updateHUD() {
    const w = this.world, b = w.boat, env = w.env;
    const sog = b.speed / KN;
    const u = b.u / KN;
    const hdg = thetaToCompass(b.th);
    const rpmDisp = b.gear === 0 && b.rpm < 0.32 ? 800 : Math.round(800 + clamp((b.rpm - 0.3) / 0.7, 0, 1) * 2400);
    const appKn = (b.dbg.appWind || 0) / KN;
    const appDeg = ((b.dbg.appAngle || 0) / DEG);
    const e = w.berthError();
    const distB = Math.hypot(b.x - w.H.berth.x, b.z - w.H.berth.z);
    const min = Math.floor(w.time / 60), sec = Math.floor(w.time % 60);
    this.info.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline"><div><div class="small muted">Prędkość (SOG)</div><div class="big-num">${sog.toFixed(1)} <span class="small">kn</span></div></div>
      <div style="text-align:right"><div class="small muted">Kurs</div><div class="big-num">${hdg.toFixed(0).padStart(3, '0')}°</div></div></div>
      <div class="kv" style="margin-top:6px">
        <span class="muted">Ruch wzdłużny</span><b>${u >= 0 ? '▲' : '▼'} ${Math.abs(u).toFixed(2)} kn</b>
        <span class="muted">Obrót</span><b>${(b.r / DEG).toFixed(1)} °/s</b>
        <span class="muted">Wiatr rzecz.</span><b>${(env.windSpeed / KN).toFixed(0)} kn z ${env.windFromDeg.toFixed(0).padStart(3, '0')}°</b>
        <span class="muted">Wiatr pozorny</span><b>${appKn.toFixed(0)} kn ${appDeg >= 0 ? 'P' : 'L'} ${Math.abs(appDeg).toFixed(0)}°</b>
        ${w.env.w.currentKn ? `<span class="muted">Prąd</span><b>${w.env.w.currentKn.toFixed(1)} kn → ${w.env.w.currentTo}°</b>` : ''}
        <span class="muted">Czas</span><b>${min}:${String(sec).padStart(2, '0')}</b>
        <span class="muted">Godzina</span><b>${String(Math.floor(this.view.atmo.hour)).padStart(2, '0')}:${String(Math.floor((this.view.atmo.hour % 1) * 60)).padStart(2, '0')}</b>
      </div>`;
    // cel
    const sc = w.cfg.scenario;
    const ck = (ok, txt) => `<div class="ck ${ok ? 'ok' : ''}"><i>${ok ? '✓' : ''}</i>${txt}</div>`;
    const t = w.H.berth;
    let gh = `<div style="font-weight:600;margin-bottom:4px">${sc === 'moor' ? 'Cumowanie' : 'Odcumowanie'} · ${METHODS[w.H.method].name}</div>`;
    if (sc === 'moor') {
      gh += `<div class="small muted">Do stanowiska: ${distB.toFixed(1)} m</div>`;
      gh += ck(Math.abs(e.along) < t.tolAlong && Math.abs(e.across) < t.tolAcross, `Pozycja (${e.along.toFixed(1)} / ${e.across.toFixed(1)} m)`);
      gh += ck(Math.abs(e.dth) < t.tolTh, `Ustawienie (${e.dth.toFixed(0)}°)`);
      gh += ck(w.linesOk, `Liny założone i napięte (${w.lines.filter((l) => l.state === 'attached').length})`);
      gh += ck(b.speed < 0.15, 'Jacht zatrzymany');
    } else {
      gh += ck(w.lines.every((l) => !['attached', 'pending', 'waitingCrew', 'retrieving'].includes(l.state)), 'Wszystkie liny oddane');
      gh += ck(!w.crew.ashore, 'Załoga na pokładzie');
      gh += ck(w.poseOk, `Odejście od stanowiska (${distB.toFixed(0)} / ${(w.spec.loa * 2.2).toFixed(0)} m)`);
    }
    const s = w.stats;
    gh += `<div class="small muted" style="margin-top:6px">Uderzenia kadłubem: <b style="color:${s.hullHits ? '#ff5a5a' : 'inherit'}">${s.hullHits}</b> · mocne w odbijacz: ${s.hardFender}${s.breaks ? ' · zerwane liny: ' + s.breaks : ''}</div>`;
    if (w.engineDead) gh += `<div style="color:#ff5a5a;font-weight:700;margin-top:4px">Silnik: lina w śrubie!</div>`;
    this.goal.innerHTML = gh;

    // silnik
    this.thrKnob.style.top = `${(1 - (b.throttle + 1) / 2) * 100}%`;
    this.rpmVal.textContent = w.engineDead ? 'STOP' : `${rpmDisp}`;
    this.gearEl.textContent = b.gear > 0 ? 'NAPRZÓD' : b.gear < 0 ? 'WSTECZ' : 'LUZ';
    this.gearEl.className = 'gear ' + (b.gear > 0 ? 'F' : b.gear < 0 ? 'R' : '');
    this.thrustVal.textContent = `Ciąg: ${(b.thrust / 1000).toFixed(2)} kN`;
    const wf = b.walkForce;
    this.walkEl.innerHTML = Math.abs(wf) > 15 ? `<span class="${wf < 0 ? 'chip port' : 'chip stbd'}">Rufa → ${wf < 0 ? 'lewo' : 'prawo'} (${Math.abs(wf).toFixed(0)} N)</span>` : '';
    // ster
    const rc = b.rudderCmd / DEG, ra = b.rudder / DEG;
    this.rudKnob.style.left = `${((rc / 35 + 1) / 2) * 100}%`;
    const a0 = 50, a1 = ((ra / 35 + 1) / 2) * 100;
    this.rudAct.style.left = `${Math.min(a0, a1)}%`;
    this.rudAct.style.width = `${Math.abs(a1 - a0)}%`;
    this.rudVal.innerHTML = `<span class="muted">L</span><b>${ra >= 0 ? 'P' : 'L'} ${Math.abs(ra).toFixed(0)}°</b><span class="muted">P</span>`;
    for (const kind of ['bow', 'stern']) {
      const bt = this[kind + 'Btns'];
      if (!bt) continue;
      const out = b[kind + 'Out'];
      bt.bl.classList.toggle('active', out < -0.1);
      bt.br.classList.toggle('active', out > 0.1);
      bt.heat.style.width = `${b[kind + 'Heat'] * 100}%`;
      bt.heat.style.background = b[kind + 'Trip'] ? '#ff5a5a' : b[kind + 'Heat'] > 0.7 ? '#ffb347' : '#2fb3e8';
    }
    this.crewBtn.textContent = w.crew.ashore ? '⤴ Załoga na pokład (L)' : '⤵ Zejdź na ląd (L)';
    this.followBtn.classList.toggle('on', this.view.cam.follow);
    // log – wygaszanie
    const now = performance.now();
    for (const it of this.logItems) it.el.style.opacity = now - it.t > 7000 ? 0 : 1;
    this.drawCompass();
    if (this.weatherPanel && this.view.atmo.timeFlows) {
      this._hourOut.textContent = this._fmtH(this.view.atmo.hour);
      this._hourInp.value = this.view.atmo.hour;
    }
  }

  drawCompass() {
    const c = this.compass, ctx = c.getContext('2d');
    const W = c.width, R = W / 2 - 16, cx = W / 2, cy = W / 2;
    const az = this.view.cam.az;
    const toScr = (x, z) => [x * Math.cos(az) - z * Math.sin(az), x * Math.sin(az) + z * Math.cos(az)];
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = 'rgba(10,30,50,0.7)';
    ctx.beginPath(); ctx.arc(cx, cy, R + 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.font = 'bold 12px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [lbl, deg] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
      const [sx, sy] = toScr(Math.sin(deg * DEG), -Math.cos(deg * DEG));
      ctx.fillStyle = lbl === 'N' ? '#ff6b6b' : '#cfe6f5';
      ctx.fillText(lbl, cx + sx * (R + 6), cy + sy * (R + 6));
    }
    const arrow = (x, z, len, col, wdt, from) => {
      const [sx, sy] = toScr(x, z);
      const a = Math.atan2(sy, sx);
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(a);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wdt;
      const s0 = from ? -len : -len * 0.2;
      ctx.beginPath(); ctx.moveTo(s0, 0); ctx.lineTo(len - 8, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len - 11, -6); ctx.lineTo(len - 11, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    const w = this.world, b = w.boat;
    // jacht
    arrow(Math.cos(b.th), Math.sin(b.th), R * 0.75, '#ffffff', 4);
    // wiatr (dokąd wieje)
    const wv = w.env.windVec();
    const wn = Math.hypot(wv.x, wv.z) || 1;
    arrow(wv.x / wn, wv.z / wn, R * 0.9, '#5ec8ff', 3, true);
    // prąd
    const cv = w.env.currentVec();
    const cn = Math.hypot(cv.x, cv.z);
    if (cn > 0.01) arrow(cv.x / cn, cv.z / cn, R * 0.55, '#ffd166', 2, true);
    // kierunek do stanowiska
    if (w.cfg.scenario === 'moor') {
      const dx = w.H.berth.x - b.x, dz = w.H.berth.z - b.z, dn = Math.hypot(dx, dz) || 1;
      const [sx, sy] = toScr(dx / dn, dz / dn);
      ctx.fillStyle = '#3ddc84';
      ctx.beginPath(); ctx.arc(cx + sx * R, cy + sy * R, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#cfe6f5'; ctx.font = '10px Segoe UI';
    ctx.fillText(`wiatr ${(w.env.windSpeed / KN).toFixed(0)} kn`, cx, cy + R * 0.45);
  }

  showHelp() {
    const back = h('div.modal-back', { onclick: (e) => { if (e.target === back) back.remove(); } });
    const m = h('div.modal.glass', { style: { width: '760px', maxHeight: '86vh', overflow: 'auto' } },
      h('h2', {}, 'Pomoc'),
      ...buildHelpContent(),
      h('div', { style: { textAlign: 'right', marginTop: '10px' } }, h('button.btn.primary', { onclick: () => back.remove() }, 'OK')));
    back.appendChild(m);
    this.sim.appendChild(back);
  }

  showResult(r) {
    const back = h('div.modal-back');
    const s = r.stats;
    const col = r.score >= 85 ? '#3ddc84' : r.score >= 60 ? '#ffd166' : '#ff5a5a';
    const m = h('div.modal.glass', {},
      h('h2', {}, this.world.cfg.scenario === 'moor' ? '⚓ Zacumowano!' : '⛵ Odcumowano!'),
      h('div.score', { style: { color: col } }, `${r.score}`),
      h('div', { style: { textAlign: 'center' }, class: 'muted' }, 'punktów na 100'),
      h('table.spec-table', { style: { marginTop: '14px' } },
        h('tr', {}, h('td', {}, 'Czas manewru'), h('td', {}, `${Math.floor(r.time / 60)}:${String(Math.floor(r.time % 60)).padStart(2, '0')}`)),
        h('tr', {}, h('td', {}, 'Uderzenia kadłubem'), h('td', {}, `${s.hullHits}${s.maxHit ? ` (max ${(s.maxHit / KN).toFixed(1)} kn)` : ''}`)),
        h('tr', {}, h('td', {}, 'Mocne uderzenia w odbijacze'), h('td', {}, `${s.hardFender}`)),
        h('tr', {}, h('td', {}, 'Zerwane liny'), h('td', {}, `${s.breaks}`)),
        h('tr', {}, h('td', {}, 'Przegrzanie steru strumieniowego'), h('td', {}, `${s.overheat}`)),
        h('tr', {}, h('td', {}, 'Chybione rzuty'), h('td', {}, `${s.lassoMiss}`)),
        h('tr', {}, h('td', {}, 'Muring w śrubie'), h('td', {}, s.fouled ? 'TAK' : 'nie'))),
      h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' } },
        h('button.btn', { onclick: () => back.remove() }, 'Zostań w symulacji'),
        h('button.btn', { onclick: () => this.restart() }, '↺ Jeszcze raz'),
        h('button.btn.primary', { onclick: () => this.exit() }, 'Menu'))
    );
    back.appendChild(m);
    this.sim.appendChild(back);
  }

  restart() {
    this.destroy();
    this.cb.restart(this.config);
  }
  exit() {
    this.destroy();
    this.cb.exit(this.config);
  }
  destroy() {
    this.running = false;
    this.closeRadial();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this._blur);
    this.sound.close();
    this.view.dispose();
    this.root.innerHTML = '';
  }
}
