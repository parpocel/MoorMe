// Moduł „Bezpieczeństwo”: mesa jachtu w 3D z wyposażeniem ratunkowym, kartami procedur i radiem VHF DSC (z testem).
import { h } from './dom.js';
import { SaloonView } from '../render/saloon.js';
import { deviceInfo, channels, procedureCard, makeRadioTask, checkRadio, VALID_CHANNELS } from '../data/safety.js';
import { getSettings, boatIdentity } from '../settings.js';
import { rng } from '../math.js';
import { t } from '../i18n.js';

const CARD_KIND = { cardMayday: 'mayday', cardPan: 'pan', cardSecurite: 'securite' };

export function showSafety(app, { onExit }) {
  app.innerHTML = '';
  const viewEl = h('div.sf-view');
  const tip = h('div.sf-tip', { style: { display: 'none' } });
  const root = h('div.screen.safety', {}, viewEl, tip);
  app.appendChild(root);
  const view = new SaloonView(viewEl, { mode: 'safety' });
  window.__saloon = view;
  let modal = null;
  const close = () => { if (modal) { modal.remove(); modal = null; } };

  // pasek górny: widoki i powrót
  const views = [['table', 'Stół'], ['nav', 'Stacja nawigacyjna'], ['saloon', 'Mesa'], ['raft', 'Tratwa']];
  root.appendChild(h('div.sf-bar', {},
    h('div.logo', {}, 'Moor', h('span', {}, 'Me')), h('div.sf-sub', {}, 'bezpieczeństwo'),
    h('div.sf-views', {}, ...views.map(([k, n]) => h('button.btn.sm', { onclick: () => view.flyTo(SaloonView.VIEWS[k]) }, n))),
    h('button.btn.sm', { onclick: () => openRadio() }, '📻 Radio VHF'),
    h('button.btn.sm', { onclick: () => { close(); view.destroy(); onExit(); } }, '← Tryby')));
  root.appendChild(h('div.sf-hint', {}, 'Najedź na urządzenie, aby zobaczyć informacje; kliknij, aby otworzyć szczegóły. Przeciągnij – obrót, kółko / szczypanie – przybliżenie.'));

  // okienko po najechaniu
  view.onHover = (id, p) => {
    if (!id || modal) { tip.style.display = 'none'; viewEl.style.cursor = ''; return; }
    viewEl.style.cursor = 'pointer';
    const d = deviceInfo(id);
    if (tip.dataset.id !== id) {
      tip.dataset.id = id;
      tip.innerHTML = '';
      tip.append(h('div.sf-tip-h', {}, d.name), h('div.sf-tip-s', {}, d.short),
        ...d.sections.slice(0, 2).map(([a, b]) => h('div.sf-tip-sec', {}, h('b', {}, a + ': '), b)),
        h('div.sf-tip-more', {}, id === 'vhf' ? 'Kliknij – kanały i test korespondencji' : CARD_KIND[id] ? 'Kliknij – przeczytaj kartę' : 'Kliknij – więcej informacji'));
    }
    tip.style.display = 'block';
    const W = window.innerWidth, H = window.innerHeight, tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = `${Math.min(W - tw - 12, p.x + 18)}px`;
    tip.style.top = `${Math.min(H - th - 12, Math.max(60, p.y + 14))}px`;
  };
  view.onClick = (id) => {
    if (!id) return;
    tip.style.display = 'none';
    if (id === 'vhf') openRadio();
    else if (CARD_KIND[id]) openCard(CARD_KIND[id]);
    else openDevice(id);
  };

  function openModal(...content) {
    close();
    modal = h('div.sf-back', { onclick: (e) => { if (e.target === modal) close(); } }, h('div.sf-modal', {}, h('button.sf-x', { onclick: close }, '✕'), ...content));
    root.appendChild(modal);
    return modal;
  }
  function openDevice(id) {
    const d = deviceInfo(id);
    openModal(h('h2', {}, d.name), h('p.sf-lead', {}, d.short), ...d.sections.map(([a, b]) => h('div.sf-sec', {}, h('h3', {}, a), h('p', {}, b))));
  }
  function openCard(kind) {
    const p = procedureCard(kind);
    openModal(h('div.sf-card', { class: kind },
      h('div.sf-card-h', {}, p.title), h('p', {}, p.when),
      h('ol', {}, ...p.steps.map((s) => h('li', {}, s))),
      h('div.sf-lines', {}, ...p.lines.map((l) => h('div', {}, l))),
      h('p.small', {}, p.after)));
  }

  // ---------- radio VHF DSC ----------
  function openRadio() {
    const st = getSettings(), id = boatIdentity();
    const ship = { name: id.name, call: (st.callsign || 'SPS2024').toUpperCase(), mmsi: st.mmsi || '261012345' };
    const r = rng(1 + Math.floor(Math.random() * 1e9));
    const S = { ch: 16, cover: false, dsc: false, task: null, lines: [], result: null, stats: { n: 0, ok: 0 } };
    const body = h('div.sf-radio');
    openModal(h('h2', {}, 'Radiotelefon VHF DSC'), body);
    const setCh = (c) => { c = Math.round(Number(c)); if (!VALID_CHANNELS.includes(c)) return; S.ch = c; render(); };
    function render() {
      body.innerHTML = '';
      const list = channels();
      const idx = VALID_CHANNELS.indexOf(S.ch);
      const face = h('div.vhf-face', {},
        h('div.vhf-lcd', {}, h('div.vhf-ch', {}, String(S.ch).padStart(2, '0')), h('div.vhf-info', {}, h('div', {}, 'DSC  25W'), h('div', {}, S.dsc ? 'DISTRESS SENT' : 'CH70 WATCH'))),
        h('div.vhf-btns', {},
          h('button.btn.sm', { onclick: () => setCh(VALID_CHANNELS[(idx - 1 + VALID_CHANNELS.length) % VALID_CHANNELS.length]) }, 'CH ▼'),
          h('button.btn.sm', { onclick: () => setCh(VALID_CHANNELS[(idx + 1) % VALID_CHANNELS.length]) }, 'CH ▲'),
          h('button.btn.sm', { onclick: () => setCh(16) }, '16'),
          h('input.vhf-in', { type: 'text', inputmode: 'numeric', placeholder: 'kanał', onkeydown: (e) => { if (e.key === 'Enter') setCh(e.target.value); } })),
        h('div.vhf-dist', {},
          h('button.vhf-cover', { class: S.cover ? 'open' : '', onclick: () => { S.cover = !S.cover; render(); } }, S.cover ? 'Osłona podniesiona' : 'Podnieś osłonę'),
          h('button.vhf-distress', { disabled: S.cover ? null : true, onclick: () => { S.dsc = true; render(); } }, 'DISTRESS')),
        h('div.small.muted', {}, 'Alarm DSC: podnieś osłonę i naciśnij DISTRESS (w prawdziwym radiu przytrzymaj 5 s). Ćwiczenie – nic nie jest wysyłane.'));
      const table = h('table.spec-table.vhf-table', {}, h('tr', {}, h('th', {}, 'Kanał'), h('th', {}, 'MHz'), h('th', {}, 'Przeznaczenie')),
        ...list.map((c) => h('tr', { class: c.ch === S.ch ? 'on' : '', onclick: () => setCh(c.ch) }, h('td', {}, h('b', {}, String(c.ch).padStart(2, '0'))), h('td', {}, c.f), h('td', {}, c.use))));
      const test = h('div.vhf-test');
      if (!S.task) {
        test.append(h('p', {}, 'Test: dostajesz sytuację na morzu – ustaw właściwy kanał (dla MAYDAY także wyślij alarm DSC) i ułóż korespondencję z gotowych zdań.'),
          h('div.vhf-row', {}, h('button.btn.primary', { onclick: () => newTask() }, '▶ Rozpocznij test'), h('span.muted', {}, `${t('Poprawne:')} ${S.stats.ok}/${S.stats.n}`)));
      } else {
        const T = S.task;
        test.append(h('div.vhf-task', {}, h('div.vhf-task-h', {}, 'Zadanie'), h('p', {}, T.text),
          h('div.small.muted', {}, `${t('Twój jacht')}: ${ship.name}, ${t('znak wywoławczy')} ${ship.call}, MMSI ${ship.mmsi}`)));
        if (T.lines) {
          const used = new Set(S.lines);
          test.append(h('div.vhf-sub', {}, 'Ułóż korespondencję (klikaj zdania w kolejności):'),
            h('div.vhf-msg', {}, S.lines.length ? S.lines.map((l, i) => h('button.vhf-line.on', { disabled: S.result ? true : null, onclick: () => { S.lines.splice(i, 1); render(); } }, `${i + 1}. ${l}`)) : h('div.muted.small', {}, '— pusto —')),
            h('div.vhf-pool', {}, ...T.pool.filter((l) => !used.has(l)).map((l) => h('button.vhf-line', { disabled: S.result ? true : null, onclick: () => { S.lines.push(l); render(); } }, l))));
        }
        if (!S.result) {
          test.append(h('div.vhf-row', {}, h('button.btn.primary', { onclick: () => check() }, T.lines ? '🎙 Nadaj (PTT)' : 'Sprawdź kanał'), h('span.muted', {}, `${t('Ustawiony kanał')}: ${String(S.ch).padStart(2, '0')}`)));
        } else {
          const R = S.result;
          test.append(h('div.quiz-verdict', { class: R.ok ? 'ok' : 'bad' }, R.ok ? '✓ Dobrze!' : '✗ Źle'));
          if (!R.ok) {
            const fb = h('div.vhf-fb');
            if (!R.chOk) fb.append(h('div', {}, h('span.muted', {}, 'Poprawny kanał:'), ' ', h('b', {}, T.channels.map((c) => String(c).padStart(2, '0')).join(' / '))));
            if (!R.dscOk) fb.append(h('div', {}, h('b', {}, 'Najpierw alarm DSC (DISTRESS), potem MAYDAY głosem.')));
            if (!R.msgOk) fb.append(h('div', {}, h('span.muted', {}, 'Poprawna korespondencja:')), h('div.sf-lines', {}, ...T.lines.map((l) => h('div', {}, l))));
            fb.append(h('div.small', {}, T.explain));
            test.append(fb);
          }
          test.append(h('div.vhf-row', {}, h('button.btn.primary', { onclick: () => newTask() }, 'Następne zadanie →'), h('span.muted', {}, `${t('Poprawne:')} ${S.stats.ok}/${S.stats.n}`)));
        }
      }
      body.append(h('div.vhf-left', {}, face, test), h('div.vhf-right', {}, table));
    }
    function newTask() { S.task = makeRadioTask(r, ship); S.lines = []; S.result = null; S.dsc = false; S.cover = false; render(); }
    function check() { S.result = checkRadio(S.task, { channel: S.ch, dscSent: S.dsc, lines: S.lines }); S.stats.n++; if (S.result.ok) S.stats.ok++; render(); }
    render();
    return { S, render, newTask, check, setCh };
  }
  const api = { view, openRadio, openCard, openDevice, close };
  window.__safety = api;
  return api;
}
