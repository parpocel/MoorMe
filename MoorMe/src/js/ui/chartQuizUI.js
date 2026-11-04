// Test „Symbole map”: symbol z mapy morskiej (INT 1) i cztery odpowiedzi; po odpowiedzi – znaczenie symbolu.
// Przycisk „Legenda” pokazuje wszystkie symbole z opisami.
import { h } from './dom.js';
import { t } from '../i18n.js';
import { CHART_SYMBOLS, symbolSVG } from '../data/chartSymbols.js';

const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const raw = (html, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; return d; };

export function showChartQuiz(app, { onExit, sceneryEl }) {
  let order = shuffle(CHART_SYMBOLS), idx = 0, good = 0, answered = 0, done = false, legend = false;
  const body = h('div.cq-body');
  const score = h('div.cq-score');
  const legendBtn = h('button.btn', { onclick: () => { legend = !legend; render(); } }, '📖 Legenda');
  const root = h('div.screen.handbook.chartquiz', {}, sceneryEl ? sceneryEl() : null,
    h('div.screen-header', {}, h('div.logo', {}, 'Moor', h('span', {}, 'Me')), h('div.sub', {}, 'nawigacja – symbole map')),
    h('div.cq-wrap', {}, body),
    h('div.screen-footer', {}, h('button.btn', { onclick: () => onExit() }, '← Wstecz'), score, legendBtn));
  app.innerHTML = '';
  app.appendChild(root);

  // trzy błędne odpowiedzi: najpierw z tej samej grupy symboli (np. inne niebezpieczeństwa), potem dowolne
  const options = (s) => {
    const same = shuffle(CHART_SYMBOLS.filter((x) => x !== s && x.grp === s.grp));
    const other = shuffle(CHART_SYMBOLS.filter((x) => x !== s && x.grp !== s.grp));
    return shuffle([s, ...same.concat(other).slice(0, 3)]);
  };

  function render() {
    body.innerHTML = '';
    legendBtn.textContent = t(legend ? '🎯 Wróć do testu' : '📖 Legenda');
    score.textContent = `${t('Poprawne')}: ${good} / ${answered}`;
    if (legend) {
      body.appendChild(h('div.cq-card', {}, h('h2', {}, 'Legenda – symbole map (INT 1)'),
        h('p.muted', {}, 'Najczęstsze symbole z map morskich według międzynarodowego standardu IHO INT 1 – tego samego, którego używają mapy i almanachy żeglarskie.'),
        h('div.cq-legend', {}, ...CHART_SYMBOLS.map((s) => h('div.cq-leg', {}, raw(symbolSVG(s, 120, 82), 'cq-legsvg'), h('div', {}, h('b', {}, s.name()), h('p', {}, s.mean())))))));
      return;
    }
    if (done) {
      const pct = Math.round((good / Math.max(1, answered)) * 100);
      body.appendChild(h('div.cq-card.cq-end', {}, h('h2', {}, 'Koniec testu'),
        h('div.cq-big', {}, `${good} / ${answered}`), h('p', {}, `${t('Wynik')}: ${pct}%`),
        h('button.btn.primary', { onclick: () => { order = shuffle(CHART_SYMBOLS); idx = 0; good = 0; answered = 0; done = false; render(); } }, '↻ Jeszcze raz')));
      return;
    }
    const s = order[idx], opts = options(s);
    let picked = null;
    const info = h('div.cq-info');
    const next = h('button.btn.primary.cq-next', { disabled: true, onclick: () => { idx++; if (idx >= order.length) done = true; render(); } }, idx + 1 >= order.length ? 'Zakończ →' : 'Następny symbol →');
    const btns = opts.map((o) => {
      const b = h('button.btn.cq-opt', { onclick: () => {
        if (picked) return;
        picked = o; answered++;
        if (o === s) good++;
        btns.forEach((x, k) => { x.classList.toggle('good', opts[k] === s); x.classList.toggle('bad', opts[k] === o && o !== s); x.disabled = true; });
        info.innerHTML = '';
        info.appendChild(h('div', { class: o === s ? 'cq-ok' : 'cq-no' }, o === s ? '✓ Dobrze!' : `✗ ${t('To')}: ${s.name()}`));
        info.appendChild(h('p', {}, s.mean()));
        next.disabled = false;
        score.textContent = `${t('Poprawne')}: ${good} / ${answered}`;
        next.focus();
      } }, o.name());
      return b;
    });
    body.appendChild(h('div.cq-card', {},
      h('div.cq-count', {}, `${t('Symbol')} ${idx + 1} / ${order.length}`),
      h('h2', {}, 'Co oznacza ten symbol na mapie?'),
      h('div.cq-main', {}, raw(symbolSVG(s, 400, 275), 'cq-sym'), h('div.cq-opts', {}, ...btns)),
      info, h('div.cq-foot', {}, next)));
  }
  render();
}
