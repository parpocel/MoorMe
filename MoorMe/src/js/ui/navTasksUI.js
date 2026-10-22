// Moduł „Zadania nawigacyjne”: losowe zadania z przeliczania kursów i namiarów, prądu, pozycji z namiarów i zliczenia.
import { h } from './dom.js';
import { CATEGORIES, makeTask, checkAnswer, fmtAnswer, deg3 } from '../data/navTasks.js';
import { rng } from '../math.js';
import { t as tr } from '../i18n.js';
import { PlotBoard } from './plotBoard.js';
import { SaloonView } from '../render/saloon.js';

const D2R = Math.PI / 180;

function drawDiagram(cv, dg) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f4f8fb'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#c9d6e2'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const arrow = (x0, y0, x1, y1, col, label, off = -8) => {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 10 * Math.cos(a - 0.4), y1 - 10 * Math.sin(a - 0.4)); ctx.lineTo(x1 - 10 * Math.cos(a + 0.4), y1 - 10 * Math.sin(a + 0.4)); ctx.closePath(); ctx.fill();
    if (label) { ctx.font = 'bold 12px Segoe UI'; ctx.fillText(label, (x0 + x1) / 2 + 6, (y0 + y1) / 2 + off); }
  };
  ctx.fillStyle = '#c0392b'; ctx.font = 'bold 13px Segoe UI'; ctx.fillText('N', W - 18, 16);
  if (dg.kind === 'current') {
    const s = Math.min(W, H) * 0.42 / Math.max(dg.V, dg.SOG, 1), cx = W / 2, cy = H / 2;
    const P = (c, v, x = cx, y = cy) => [x + Math.sin(c * D2R) * v * s, y - Math.cos(c * D2R) * v * s];
    const [wx, wy] = P(dg.KDw, dg.V, cx - (Math.sin(dg.KDd * D2R) * dg.SOG * s) / 2, cy + (Math.cos(dg.KDd * D2R) * dg.SOG * s) / 2);
    const x0 = cx - (Math.sin(dg.KDd * D2R) * dg.SOG * s) / 2, y0 = cy + (Math.cos(dg.KDd * D2R) * dg.SOG * s) / 2;
    arrow(x0, y0, wx, wy, '#2f6fb0', `KDw ${deg3(dg.KDw)}`);
    const [gx, gy] = P(dg.set, dg.c, wx, wy);
    arrow(wx, wy, gx, gy, '#1f9d55', tr('prąd'), -14);
    arrow(x0, y0, gx, gy, '#c0392b', `KDd ${deg3(dg.KDd)}`, 18);
  } else if (dg.kind === 'fix') {
    const pts = [dg.A, dg.B, dg.P];
    const cl = Math.cos(dg.P.lat * D2R);
    const xs = pts.map((p) => p.lon * 60 * cl), ys = pts.map((p) => p.lat * 60);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const sc = Math.min((W - 60) / (maxX - minX || 1), (H - 60) / (maxY - minY || 1));
    const X = (p) => 30 + (p.lon * 60 * cl - minX) * sc, Y = (p) => H - 30 - (p.lat * 60 - minY) * sc;
    for (const [o, nr, n] of [[dg.A, dg.NR1, 'A'], [dg.B, dg.NR2, 'B']]) {
      const back = (nr + 180) * D2R, L = 400;
      ctx.strokeStyle = '#2f6fb0'; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(X(o), Y(o)); ctx.lineTo(X(o) + Math.sin(back) * L, Y(o) - Math.cos(back) * L); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#d62828'; ctx.beginPath(); ctx.arc(X(o), Y(o), 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1f24'; ctx.font = 'bold 13px Segoe UI'; ctx.fillText(n, X(o) + 8, Y(o) - 6);
    }
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(X(dg.P), Y(dg.P), 7, 0, Math.PI * 2); ctx.stroke();
  }
}

export function showNavTasks(app, { onExit }) {
  const r = rng(1 + Math.floor(Math.random() * 1e9));
  const state = { cat: null, task: null, checked: false, showSol: false, stats: { n: 0, ok: 0 } };
  app.innerHTML = '';
  // gracz siedzi przy stole w mesie: widok 3D z góry na stół, zadanie i mapka leżą na blacie
  const viewEl = h('div.nt-view');
  const ui = h('div.nt-ui');
  const root = h('div.screen.navtasks.desk', {}, viewEl, ui);
  app.appendChild(root);
  let view = null;
  try { view = new SaloonView(viewEl, { mode: 'nav' }); } catch (e) { view = null; } // bez WebGL – samo tło
  const exit = () => { if (view) view.destroy(); onExit(); };

  const newTask = () => { state.task = makeTask(r, state.cat); state.board = state.task.plot ? new PlotBoard(state.task.plot) : null; if (typeof window !== 'undefined') window.__board = state.board; state.checked = false; state.showSol = false; state.inputs = {}; render(); if (typeof window !== 'undefined') window.__navTask = state.task; };

  function render() {
    ui.innerHTML = '';
    const t = state.task;
    const cats = h('div.nt-cats', {},
      h('button.btn.sm', { class: state.cat === null ? 'on' : '', onclick: () => { state.cat = null; newTask(); } }, 'Wszystkie'),
      ...Object.entries(CATEGORIES).map(([k, n]) => h('button.btn.sm', { class: state.cat === k ? 'on' : '', onclick: () => { state.cat = k; newTask(); } }, n)));
    const fields = h('div.nt-fields');
    const res = {};
    for (const a of t.answers) {
      const inp = h('input', { type: 'text', inputmode: 'decimal', value: state.inputs[a.key] || '', placeholder: a.kind === 'deg' ? '000' : '0,0', oninput: (e) => { state.inputs[a.key] = e.target.value; } });
      if (state.checked) inp.disabled = true;
      const unit = a.kind === 'deg' ? '°' : a.kind === 'kn' ? 'kn' : a.kind === 'nm' ? 'Mm' : "'";
      const ok = state.checked && checkAnswer(a, state.inputs[a.key]);
      res[a.key] = ok;
      fields.appendChild(h('div.nt-field', { class: state.checked ? (ok ? 'ok' : 'bad') : '' },
        h('label', {}, a.label), inp, h('span.unit', {}, unit),
        state.checked ? h('span.nt-res', {}, ok ? '✓' : `✗ ${fmtAnswer(a)}`) : null));
    }
    const allOk = state.checked && t.answers.every((a) => res[a.key]);
    // karta z zadaniem (papier na stole)
    const card = h('div.nt-card.paper', {},
      h('div.nt-head', {}, h('span.chip', {}, CATEGORIES[t.cat]), h('span.nt-score', {}, h('span.muted', {}, 'Poprawne:'), ' ', h('b', {}, `${state.stats.ok}/${state.stats.n}`))),
      h('p.nt-text', {}, t.text),
      t.table ? h('table.spec-table.nt-table', {}, h('tr', {}, ...t.table.head.map((x) => h('th', {}, x))), ...t.table.rows.map((row) => h('tr', {}, ...row.map((x) => h('td', {}, x))))) : null,
      fields,
      state.checked ? h('div.quiz-verdict', { class: allOk ? 'ok' : 'bad', style: { margin: '6px 0' } }, allOk ? '✓ Dobrze!' : '✗ Źle') : null,
      h('div.nt-btns', {},
        state.checked ? null : h('button.btn.primary', { onclick: () => { state.checked = true; state.stats.n++; if (t.answers.every((a) => checkAnswer(a, state.inputs[a.key]))) state.stats.ok++; render(); } }, 'Sprawdź'),
        h('button.btn', { onclick: () => { state.showSol = !state.showSol; render(); } }, state.showSol ? 'Ukryj rozwiązanie' : 'Pokaż rozwiązanie'),
        h('button.btn.primary', { onclick: () => newTask() }, 'Następne zadanie →')),
      state.showSol ? h('div.nt-sol', {}, h('ol', {}, ...t.steps.map((s) => h('li', {}, s))), t.diagram && !state.board ? (() => { const cv = h('canvas', { width: 330, height: 260 }); drawDiagram(cv, t.diagram); return cv; })() : null) : null,
      h('p.small.muted.nt-conv', {}, 'Konwencja: poprawki na E i dryf w prawo są dodatnie (+), na W i w lewo – ujemne (−). KK – kurs kompasowy, KM – magnetyczny, KR – rzeczywisty, KDw – drogi nad wodą, KDd – drogi nad dnem, δ – dewiacja, d – deklinacja, β – dryf. Kąty wpisuj w stopniach (np. 047), ułamki z przecinkiem.'));
    // arkusz mapy do kreślenia obok karty
    const chart = state.board ? h('div.nt-plot.chart-sheet', {}, h('div.nt-sheet-h', {}, 'Mapka do kreślenia'), state.board.el) : null;
    if (state.board) state.board.setSolution(state.showSol);
    ui.append(
      h('div.nt-bar', {}, h('div.logo', {}, 'Moor', h('span', {}, 'Me')), h('div.sub', {}, 'zadania nawigacyjne'), cats, h('button.btn.sm.nt-exit', { onclick: exit }, '← Tryby')),
      h('div.nt-desk', { class: chart ? 'two' : '' }, card, chart));
  }
  newTask();
}
