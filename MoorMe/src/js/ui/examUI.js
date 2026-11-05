// Moduł „Test”: 75 pytań jednokrotnego wyboru (60 min), próg zaliczenia 65 poprawnych, potem zadanie nawigacyjne (30 min).
import { h } from './dom.js';
import { t } from '../i18n.js';
import { rng } from '../math.js';
import { EXAM, NAV_EXAM_CATS, makeExam, topicName } from '../data/exam.js';
import { notationNode } from '../data/soundSignals.js';
import { examMarks, examVesselView } from './handbook.js';
import { ShipAudio } from './soundsUI.js';
import { showNavTasks } from './navTasksUI.js';

const HIST_KEY = 'moorme.examHist';
function loadHist() { try { return JSON.parse(localStorage.getItem(HIST_KEY) || 'null') || { n: 0, ids: {} }; } catch (e) { return { n: 0, ids: {} }; } }
function saveHist(hs) { try { localStorage.setItem(HIST_KEY, JSON.stringify(hs)); } catch (e) { /* bez zapisu */ } }
// odpowiedź tekstowa albo obrazek („@svg:…” – rysunek, „@img:…” – plik)
function optNode(o) {
  if (o.startsWith('@svg:')) { const d = h('span.ex-optpic'); d.innerHTML = o.slice(5); return d; }
  if (o.startsWith('@img:')) return h('span.ex-optpic', {}, h('img', { src: o.slice(5), alt: '', decoding: 'async' }));
  return h('span', {}, o);
}
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function showExam(app, { scope, onExit, sceneryEl }) {
  // pytania dawno niewidziane mają pierwszeństwo – historia zapisywana lokalnie
  const hist = loadHist();
  const qs = makeExam(rng(1 + Math.floor(Math.random() * 1e9)), scope, examMarks(), hist.ids);
  hist.n++;
  for (const q of qs) hist.ids[q.id] = hist.n;
  saveHist(hist);

  const answers = new Array(qs.length).fill(null);
  let idx = 0, done = false, result = null;
  const deadline = Date.now() + EXAM.testMin * 60000;
  const audio = new ShipAudio();
  const scopeName = scope === 'inland' ? 'śródlądzie' : 'morze';

  const body = h('div.cq-body.ex-body');
  const clock = h('div.ex-clock');
  const footL = h('div.ex-foot');
  const root = h('div.screen.handbook.chartquiz.exam', {}, sceneryEl ? sceneryEl() : null,
    h('div.screen-header', {}, h('div.logo', {}, 'Moor', h('span', {}, 'Me')), h('div.sub', {}, `test – ${scopeName}`), clock),
    h('div.cq-wrap', {}, body),
    footL);
  app.innerHTML = '';
  app.appendChild(root);

  const close = () => { clearInterval(timer); document.removeEventListener('keydown', onKey); audio.close(); };
  const quit = () => { close(); onExit(); };
  const timer = setInterval(() => {
    if (!root.isConnected) { close(); return; }
    if (done) return;
    const left = deadline - Date.now();
    clock.textContent = `⏱ ${mmss(left)}`;
    clock.classList.toggle('low', left < 5 * 60000);
    if (left <= 0) finish(true);
  }, 500);
  clock.textContent = `⏱ ${mmss(deadline - Date.now())}`;

  const onKey = (e) => {
    if (!root.isConnected) { close(); return; }
    if (done || e.target instanceof HTMLInputElement) return;
    if (['1', '2', '3'].includes(e.key)) { answers[idx] = Number(e.key) - 1; render(); }
    else if (e.key === 'ArrowRight') go(idx + 1);
    else if (e.key === 'ArrowLeft') go(idx - 1);
  };
  document.addEventListener('keydown', onKey);
  const go = (i) => { idx = Math.max(0, Math.min(qs.length - 1, i)); audio.stop(); render(); };

  function media(m) {
    if (!m) return null;
    if (m.kind === 'lights' || m.kind === 'day') return h('div.ex-media.ex-3d', {}, examVesselView(m.id));
    if (m.kind === 'sound') return h('div.ex-media.ex-sound', {}, h('div.ex-notation', {}, notationNode(m.p)),
      h('button.btn', { onclick: () => audio.play(m.p) }, '▶ Odtwórz sygnał'),
      h('p.small.muted', {}, '• krótki dźwięk, — długi dźwięk'));
    if (m.kind === 'svg') { const d = h('div.ex-media.ex-svg'); d.innerHTML = m.svg; return d; }
    if (m.kind === 'img') return h('div.ex-media.ex-img', {}, h('img', { src: m.src, alt: '', decoding: 'async' }));
    return null;
  }

  function render() {
    body.innerHTML = '';
    footL.innerHTML = '';
    if (done) { renderResult(); return; }
    const q = qs[idx];
    const n = answers.filter((a) => a !== null).length;
    const pics = q.options.some((o) => o.startsWith('@'));
    const opts = q.options.map((o, i) => h('button.btn.cq-opt.ex-opt', { class: (answers[idx] === i ? 'sel' : '') + (pics ? ' pic' : ''), onclick: () => { answers[idx] = i; render(); } },
      h('span.ex-letter', {}, 'ABC'[i]), optNode(o)));
    const md = media(q.media);
    body.appendChild(h('div.cq-card.ex-card', {},
      h('div.ex-top', {}, h('div.cq-count', {}, `${t('Pytanie')} ${idx + 1} / ${qs.length}`), h('div.ex-topic', {}, topicName(q.topic))),
      h('h2.ex-q', {}, q.q),
      h('div', { class: md ? 'ex-main has-media' : 'ex-main' }, md, h('div.cq-opts', { class: pics ? 'ex-picopts' : '' }, ...opts)),
      h('div.ex-nav', {},
        h('button.btn', { disabled: idx === 0, onclick: () => go(idx - 1) }, '← Poprzednie'),
        h('span.ex-done', {}, `${t('Odpowiedzi')}: ${n} / ${qs.length}`),
        idx < qs.length - 1 ? h('button.btn.primary', { onclick: () => go(idx + 1) }, 'Następne →') : h('button.btn.primary', { onclick: () => finish(false) }, 'Zakończ test')),
      h('div.ex-grid', {}, ...qs.map((_, i) => h('button.ex-dot', { class: (answers[i] !== null ? 'ans' : '') + (i === idx ? ' cur' : ''), title: `${i + 1}`, onclick: () => go(i) }, String(i + 1))))));
    footL.append(
      h('button.btn', { onclick: () => { if (window.confirm(t('Przerwać test? Wynik nie zostanie zapisany.'))) quit(); } }, '✕ Przerwij test'),
      h('button.btn.primary', { onclick: () => finish(false) }, 'Zakończ test'));
  }

  function finish(timeout) {
    if (done) return;
    const empty = answers.filter((a) => a === null).length;
    if (!timeout && empty && !window.confirm(t(`Bez odpowiedzi: ${empty}. Zakończyć test?`))) return;
    done = true;
    audio.stop();
    const good = qs.filter((q, i) => answers[i] === q.answer).length;
    result = { good, pass: good >= EXAM.pass, timeout, nav: null };
    clock.textContent = '';
    render();
  }

  function renderResult() {
    const { good, pass, timeout } = result;
    const byTopic = {};
    qs.forEach((q, i) => { const k = q.topic, b = (byTopic[k] = byTopic[k] || [0, 0]); b[1]++; if (answers[i] === q.answer) b[0]++; });
    const wrong = qs.map((q, i) => [q, i]).filter(([q, i]) => answers[i] !== q.answer);
    const navLine = result.nav === null ? null : h('div.ex-verdict', { class: result.nav ? 'ok' : 'bad' }, result.nav ? '✓ Zadanie nawigacyjne rozwiązane poprawnie' : '✗ Zadanie nawigacyjne rozwiązane błędnie');
    const all = pass && result.nav === true; // egzamin zdany tylko przy min. 65 poprawnych i poprawnym zadaniu nawigacyjnym
    body.appendChild(h('div.cq-card.ex-card.cq-end', {},
      h('h2', {}, result.nav === null && pass ? 'Wynik testu' : 'Wynik egzaminu'),
      timeout ? h('p.muted', {}, 'Czas na test minął.') : null,
      h('div.cq-big', {}, `${good} / ${qs.length}`),
      h('div.ex-verdict', { class: pass ? 'ok' : 'bad' }, pass ? `✓ Test zdany (wymagane min. ${EXAM.pass} poprawnych odpowiedzi)` : `✗ Test niezdany – wymagane min. ${EXAM.pass} poprawnych odpowiedzi`),
      navLine,
      result.nav !== null || !pass ? h('div.ex-final', { class: all ? 'ok' : 'bad' }, all ? '🏅 Egzamin zdany!' : 'Egzamin niezdany') : null,
      h('div.ex-topics', {}, ...Object.entries(byTopic).map(([k, [g, n]]) => h('div.ex-tp', {}, h('span', {}, topicName(k)), h('b', {}, `${g}/${n}`)))),
      pass && result.nav === null ? h('div.ex-next', {},
        h('p', {}, t(`Teraz zadanie nawigacyjne o średnim poziomie trudności – masz na nie ${EXAM.navMin} minut.`)),
        h('button.btn.primary.ex-go', { onclick: () => startNav() }, 'Przejdź do zadania nawigacyjnego →')) : null,
      wrong.length ? h('details.ex-review', {}, h('summary', {}, `${t('Błędne odpowiedzi')} (${wrong.length})`),
        ...wrong.map(([q, i]) => h('div.ex-rv', {},
          h('div.ex-rq', {}, `${i + 1}. ${q.q}`),
          answers[i] !== null ? h('div.ex-ry', {}, '✗ ', optNode(q.options[answers[i]])) : h('div.ex-ry', {}, t('✗ brak odpowiedzi')),
          h('div.ex-rc', {}, '✓ ', optNode(q.options[q.answer])),
          ))) : null));
    footL.append(
      h('button.btn', { onclick: () => quit() }, '← Wróć do wyboru testu'),
      h('button.btn.primary', { onclick: () => { close(); showExam(app, { scope, onExit, sceneryEl }); } }, '↻ Nowy test'));
  }

  function startNav() {
    close();
    showNavTasks(app, {
      onExit, exam: { cats: NAV_EXAM_CATS, minutes: EXAM.navMin, onFinish: (ok) => {
        result.nav = ok;
        if (sceneryEl && root.firstChild && !root.firstChild.classList.contains('screen-header')) root.replaceChild(sceneryEl(), root.firstChild); // tło na nowo
        app.innerHTML = '';
        app.appendChild(root);
        document.addEventListener('keydown', onKey);
        render();
      } }
    });
  }

  if (typeof window !== 'undefined') window.__exam = { qs, answers, finish, go, startNav };
  render();
}
