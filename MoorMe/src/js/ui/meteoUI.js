// Dział „Meteorologia” – trening: skala Beauforta i rodzaje chmur w scenie 3D, mapa synoptyczna, barograf, zjawiska pogodowe.
import { h } from './dom.js';
import { MeteoScene } from '../render/meteoScene.js';
import { synopticSVG, mapLegendSVG, barographSVG, phenSVG } from './meteoFigs.js';
import { beaufort, cloud, CLOUD_IDS, makeBftQuestion, makeCloudQuestion, makeMapQuestion, makeBaroQuestion, makePhenQuestion, PHEN_COUNT, makeDeck, DIR8 } from '../data/meteo.js';
import { rng } from '../math.js';
import { getLang } from '../i18n.js';

const L = (pl, en) => (getLang() === 'en' ? en : pl);
const raw = (html) => { const d = document.createElement('div'); d.className = 'mt-figbox'; d.innerHTML = html; return d; };

export const METEO_KINDS = ['bft', 'cloud', 'map', 'baro', 'phen', 'mix'];
export function meteoKindName(k) {
  return { bft: L('Skala Beauforta', 'Beaufort scale'), cloud: L('Rodzaje chmur', 'Cloud types'), map: L('Mapa synoptyczna', 'Synoptic chart'), baro: L('Barometr', 'Barometer'), phen: L('Zjawiska i praktyka', 'Phenomena and practice'), mix: L('Test mieszany', 'Mixed test') }[k];
}

export function showMeteoTraining(app, { kind = 'mix', onExit, sceneryEl }) {
  app.innerHTML = '';
  const R = rng(1 + Math.floor(Math.random() * 1e9)), seed = () => Math.floor(R() * 1e9);
  const bftDeck = makeDeck(R, 11), cloudDeck = makeDeck(R, CLOUD_IDS.length), phenDeck = makeDeck(R, PHEN_COUNT);
  const stats = { n: 0, ok: 0, streak: 0, best: 0 };
  let q = null, phase = 'active', picks = {}, scene = null, view = 'orbit';

  const viewEl = h('div.mt-view');
  const bgEl = sceneryEl ? sceneryEl() : h('div.mt-bg'); // tło ekranów 2D (scena z menu)
  const quiz = h('div.mt-quiz');
  const score = h('div.mt-score');
  const viewBtns = h('div.mt-views');
  const exit = () => { document.removeEventListener('keydown', onKey); if (scene) scene.destroy(); onExit(); };
  const bar = h('div.mt-bar', {},
    h('div.logo', {}, 'Moor', h('span', {}, 'Me')), h('div.mt-sub', {}, `${L('meteorologia', 'meteorology')} · ${meteoKindName(kind).toLowerCase()}`),
    viewBtns, h('div.mt-sp'), score,
    h('button.btn.sm', { onclick: exit }, L('← Wstecz', '← Back')));
  const hint = h('div.mt-hint', {}, L('Przeciągnij – rozglądanie się, kółko / szczypanie – przybliżenie', 'Drag to look around, wheel / pinch to zoom'));
  const root = h('div.screen.meteo', {}, bgEl, viewEl, bar, quiz, hint);
  app.appendChild(root);

  function ensureScene() {
    if (!scene) { scene = new MeteoScene(viewEl, { weather: { bft: 3, clouds: 'Cu' } }); window.__meteo = scene; }
    return scene;
  }
  function setMode3d(on) {
    root.classList.toggle('is3d', on);
    viewEl.style.display = on ? '' : 'none';
    bgEl.style.display = on ? 'none' : '';
    hint.style.display = on ? '' : 'none';
    if (scene) { if (on && !scene.running) { scene.running = true; scene.last = performance.now(); const loop = (now) => { if (!scene || !scene.running) return; scene.update(Math.min(0.05, (now - scene.last) / 1000)); scene.last = now; requestAnimationFrame(loop); }; requestAnimationFrame(loop); } else if (!on) scene.running = false; }
  }
  function drawViews() {
    viewBtns.innerHTML = '';
    if (!q || !q.three) return;
    for (const [v, n] of [['orbit', L('⛵ Jacht', '⛵ Yacht')], ['sky', L('☁ Niebo', '☁ Sky')]]) viewBtns.appendChild(h('button.btn.sm', { class: view === v ? 'on' : '', onclick: () => { view = v; scene.setView(v); drawViews(); } }, n));
  }

  // ---------- pytania ----------
  function makeQuestion(k) {
    if (k === 'mix') k = ['bft', 'cloud', 'map', 'map', 'baro', 'phen', 'phen'][Math.floor(R() * 7)];
    if (k === 'bft') {
      const f = bftDeck();
      const b = makeBftQuestion(seed(), [f, f]);
      return { type: 'bft', three: true, view: 'orbit', weather: { bft: f, windFrom: b.windFrom, hour: b.hour, clouds: b.sky, seed: b.seed },
        title: L('Skala Beauforta', 'Beaufort scale'), prompt: L('Oceń siłę wiatru po wyglądzie morza.', 'Estimate the wind force from the state of the sea.'),
        groups: [{ id: 'f', ui: 'scale', answer: f }], explain: b.explain, extra: beaufort(f).yacht };
    }
    if (k === 'cloud') {
      const id = CLOUD_IDS[cloudDeck()];
      const c = makeCloudQuestion(seed(), id);
      const bft = { Cb: 4, Ns: 5, St: 2, Sc: 4 }[id] ?? 2 + Math.floor(R() * 2);
      return { type: 'cloud', three: true, view: 'sky', weather: { bft, windFrom: c.windFrom, hour: c.hour, clouds: id, seed: c.seed },
        title: L('Rodzaje chmur', 'Cloud types'), prompt: L('Jakie to chmury i co zapowiadają?', 'What clouds are these and what do they foretell?'),
        groups: [{ id: 'g', label: L('Rodzaj chmur', 'Cloud type'), options: c.options, answer: id }, { id: 'm', label: L('Co zapowiadają?', 'What do they foretell?'), options: c.meanOptions, answer: c.mean }],
        explain: c.explain };
    }
    if (k === 'map') {
      const m = makeMapQuestion(seed());
      return { type: 'map', three: false, title: L('Mapa synoptyczna', 'Synoptic chart'), prompt: m.prompt,
        fig: (rev) => synopticSVG(m, rev) + mapLegendSVG(),
        groups: [{ id: 'a', ui: m.ui || 'buttons', options: m.options, answer: m.answer }], explain: m.explain };
    }
    if (k === 'baro') {
      const b = makeBaroQuestion(seed());
      return { type: 'baro', three: false, title: L('Barometr', 'Barometer'), prompt: b.prompt, fig: (rev) => barographSVG(b.pts, rev, b.d3),
        groups: [{ id: 'a', options: b.options, answer: b.answer }], explain: b.explain };
    }
    const p = makePhenQuestion(seed(), phenDeck());
    return { type: 'phen', three: false, title: L('Zjawiska i praktyka', 'Phenomena and practice'), prompt: p.prompt, fig: p.fig ? (rev) => phenSVG(p.fig, rev) : null,
      groups: [{ id: 'a', options: p.options, answer: p.answer }], explain: p.explain };
  }

  function next() {
    q = makeQuestion(kind); phase = 'active'; picks = {};
    setMode3d(q.three);
    if (q.three) {
      const s = ensureScene();
      s.setWeather(q.weather);
      view = q.view; s.setView(view);
      if (q.type === 'bft') Object.assign(s.cam, { az: 1.6 + R() * 2.5, el: 0.12, dist: 26 });
    }
    drawViews(); render();
  }

  function check(giveUp = false) {
    if (phase !== 'active') return;
    const ok = !giveUp && q.groups.every((g) => String(picks[g.id]) === String(g.answer));
    stats.n++; if (ok) { stats.ok++; stats.streak++; stats.best = Math.max(stats.best, stats.streak); } else stats.streak = 0;
    q.result = { ok, giveUp }; phase = 'feedback';
    render();
  }

  // ---------- panel ----------
  function optionButtons(g) {
    const done = phase !== 'active';
    const cls = (id) => {
      const c = [];
      if (String(picks[g.id]) === String(id)) c.push('on');
      if (done && String(id) === String(g.answer)) c.push('good');
      else if (done && String(picks[g.id]) === String(id)) c.push('bad');
      return c.join(' ');
    };
    const pickIt = (id) => { if (phase === 'active') { picks[g.id] = id; render(); } };
    if (g.ui === 'scale') {
      return h('div.mt-scale', {}, ...Array.from({ length: 13 }, (_, f) => h('button.btn', { class: cls(f), onclick: () => pickIt(f), title: beaufort(f).name }, h('b', {}, String(f)), h('span', {}, beaufort(f).knText + ' kn'))));
    }
    if (g.ui === 'compass') {
      const order = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE'];
      return h('div.mt-compass', {}, ...order.map((d) => (d ? h('button.btn', { class: cls(d), onclick: () => pickIt(d) }, d) : h('div.mt-cc', {}, '✛'))));
    }
    return h('div.mt-opts', {}, ...g.options.map((o) => h('button.btn', { class: cls(o.id), onclick: () => pickIt(o.id) }, o.label)));
  }

  function render() {
    score.innerHTML = '';
    score.append(h('span', {}, `${L('Poprawne', 'Correct')}: `), h('b', {}, `${stats.ok}/${stats.n}`), h('span', {}, `  ${L('Seria', 'Streak')}: `), h('b', {}, String(stats.streak)), h('span', {}, `  ${L('Najlepsza', 'Best')}: `), h('b', {}, String(stats.best)));
    quiz.innerHTML = '';
    quiz.className = 'mt-quiz ' + (q.three ? 'side' : 'center');
    const body = h('div.mt-qbody');
    body.append(h('div.mt-kicker', {}, q.title), h('div.mt-prompt', {}, q.prompt));
    for (const g of q.groups) { if (g.label) body.append(h('div.mt-glabel', {}, g.label)); body.append(optionButtons(g)); }
    if (phase === 'active') {
      const ready = q.groups.every((g) => picks[g.id] !== undefined);
      body.append(h('div.mt-btns', {}, h('button.btn.primary', { disabled: ready ? null : true, onclick: () => check() }, L('Sprawdź', 'Check')), h('button.btn', { onclick: () => check(true) }, L('Nie wiem', 'I don’t know'))));
    } else {
      const r = q.result;
      let verdict = r.ok ? L('✓ Dobrze!', '✓ Correct!') : L('✗ Źle', '✗ Wrong');
      if (!r.ok && q.type === 'bft' && Math.abs(picks.f - q.groups[0].answer) === 1) verdict = L('≈ Blisko – o 1°B obok', '≈ Close – off by one');
      body.append(h('div.mt-verdict', { class: r.ok ? 'ok' : 'bad' }, verdict));
      if (!r.ok) for (const g of q.groups) {
        const correct = g.ui === 'scale' ? `${g.answer}°B – ${beaufort(g.answer).name}` : g.options ? (g.options.find((o) => String(o.id) === String(g.answer)) || {}).label : g.answer;
        body.append(h('div.mt-correct', {}, h('span.muted', {}, (g.label || L('Poprawna odpowiedź', 'Correct answer')) + ': '), h('b', {}, correct)));
      }
      body.append(h('div.mt-explain', {}, q.explain));
      if (q.extra) body.append(h('div.mt-explain.small', {}, h('b', {}, L('Na jachcie: ', 'On a yacht: ')), q.extra));
      body.append(h('div.mt-btns', {}, h('button.btn.primary', { onclick: () => next() }, L('Następne pytanie →', 'Next question →'))));
    }
    if (q.fig) { const fig = raw(q.fig(phase !== 'active')); quiz.append(fig); }
    quiz.append(body);
  }

  const onKey = (e) => {
    if (!root.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'Escape') exit();
    else if (e.key === 'Enter') { if (phase === 'active') { if (q.groups.every((g) => picks[g.id] !== undefined)) check(); } else next(); }
  };
  document.addEventListener('keydown', onKey);
  next();
}
export { DIR8, cloud };
