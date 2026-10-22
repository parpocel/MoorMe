// Moduł „Bezpieczeństwo”: mesa jachtu w 3D z wyposażeniem ratunkowym, kartami procedur i radiem VHF DSC (z testem).
import { h } from './dom.js';
import { SaloonView } from '../render/saloon.js';
import { deviceInfo, channels, procedureCard, makeRadioDeck, checkRadio, VALID_CHANNELS } from '../data/safety.js';
import { getSettings, saveSettings, boatIdentity } from '../settings.js';
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
    const S = { ch: 16, power: 25, cover: false, dsc: false, task: null, si: 0, lines: [], result: null, stats: { n: 0, ok: 0 }, hideList: !!st.radioHideList };
    const deck = makeRadioDeck(r);
    const body = h('div.sf-radio');
    let drag = null; // przeciągane zdanie: { src: 'pool' | 'msg', l, i }
    openModal(h('h2', {}, 'Radiotelefon VHF DSC'), body);
    const setCh = (c) => { c = Math.round(Number(c)); if (!VALID_CHANNELS.includes(c)) return; S.ch = c; render(); };
    const ch2 = (c) => String(c).padStart(2, '0');
    const listBtn = () => h('button.btn.sm.vhf-listbtn', { onclick: () => { S.hideList = !S.hideList; saveSettings({ radioHideList: S.hideList }); render(); } },
      S.hideList ? 'Pokaż spis kanałów' : 'Ukryj spis kanałów');
    // korespondencja: klik dopisuje / usuwa, przeciąganie wsuwa zdanie w wybrane miejsce lub zmienia kolejność
    function msgBox(ST) {
      const live = !S.result;
      const items = S.lines.map((l, i) => h('button.vhf-line.on', {
        disabled: live ? null : true, draggable: live ? 'true' : null,
        ondragstart: (e) => { drag = { src: 'msg', l, i }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', l); },
        ondragend: () => { drag = null; marker.remove(); },
        onclick: () => { S.lines.splice(i, 1); render(); } }, `${i + 1}. ${l}`));
      const msg = h('div.vhf-msg', {}, ...(items.length ? items : [h('div.muted.small.vhf-empty', {}, '— pusto —')]));
      const marker = h('div.vhf-drop');
      const at = (e) => items.filter((el) => e.clientY > el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2).length;
      msg.addEventListener('dragover', (e) => {
        if (!drag || !live) return;
        e.preventDefault();
        const i = at(e);
        if (items[i]) msg.insertBefore(marker, items[i]); else msg.appendChild(marker);
      });
      msg.addEventListener('dragleave', (e) => { if (!msg.contains(e.relatedTarget)) marker.remove(); });
      msg.addEventListener('drop', (e) => {
        if (!drag || !live) return;
        e.preventDefault();
        let i = at(e);
        if (drag.src === 'msg') { S.lines.splice(drag.i, 1); if (drag.i < i) i--; }
        S.lines.splice(i, 0, drag.l);
        drag = null; render();
      });
      const used = new Set(S.lines);
      const pool = h('div.vhf-pool', {}, ...ST.pool.filter((l) => !used.has(l)).map((l) => h('button.vhf-line', {
        disabled: live ? null : true, draggable: live ? 'true' : null,
        ondragstart: (e) => { drag = { src: 'pool', l }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', l); },
        ondragend: () => { drag = null; marker.remove(); },
        onclick: () => { S.lines.push(l); render(); } }, l)));
      // zdanie przeciągnięte z korespondencji z powrotem do puli – usunięte
      pool.addEventListener('dragover', (e) => { if (drag && drag.src === 'msg' && live) e.preventDefault(); });
      pool.addEventListener('drop', (e) => { if (!drag || drag.src !== 'msg') return; e.preventDefault(); S.lines.splice(drag.i, 1); drag = null; render(); });
      return [h('div.vhf-sub', {}, 'Ułóż korespondencję – klikaj zdania po kolei albo przeciągaj je, także pomiędzy już wybrane:'), msg, pool];
    }
    function render() {
      body.innerHTML = '';
      body.classList.toggle('nolist', S.hideList);
      const list = channels();
      const idx = VALID_CHANNELS.indexOf(S.ch);
      const face = h('div.vhf-face', {},
        h('div.vhf-lcd', {}, h('div.vhf-ch', {}, ch2(S.ch)), h('div.vhf-info', {}, h('div', {}, `DSC  ${S.power === 1 ? '1W  LO' : '25W HI'}`), h('div', {}, S.dsc ? 'DISTRESS SENT' : 'CH70 WATCH'))),
        h('div.vhf-btns', {},
          h('button.btn.sm', { onclick: () => setCh(VALID_CHANNELS[(idx - 1 + VALID_CHANNELS.length) % VALID_CHANNELS.length]) }, 'CH ▼'),
          h('button.btn.sm', { onclick: () => setCh(VALID_CHANNELS[(idx + 1) % VALID_CHANNELS.length]) }, 'CH ▲'),
          h('button.btn.sm', { onclick: () => setCh(16) }, '16'),
          h('button.btn.sm.vhf-pw', { class: S.power === 1 ? 'lo' : '', onclick: () => { S.power = S.power === 1 ? 25 : 1; render(); } }, S.power === 1 ? '1W / 25W ▸ 1W' : '1W / 25W ▸ 25W'),
          h('input.vhf-in', { type: 'text', inputmode: 'numeric', placeholder: 'kanał', onkeydown: (e) => { if (e.key === 'Enter') setCh(e.target.value); } })),
        h('div.vhf-dist', {},
          h('button.vhf-cover', { class: S.cover ? 'open' : '', onclick: () => { S.cover = !S.cover; render(); } }, S.cover ? 'Osłona podniesiona' : 'Podnieś osłonę'),
          h('button.vhf-distress', { disabled: S.cover ? null : true, onclick: () => { S.dsc = true; render(); } }, 'DISTRESS')),
        h('div.small.muted', {}, 'Przycisk 1W/25W przełącza moc nadajnika. Alarm DSC: podnieś osłonę i naciśnij DISTRESS (w prawdziwym radiu przytrzymaj 5 s). Ćwiczenie – nic nie jest wysyłane.'));
      const table = h('table.spec-table.vhf-table', {}, h('tr', {}, h('th', {}, 'Kanał'), h('th', {}, 'MHz'), h('th', {}, 'Przeznaczenie')),
        ...list.map((c) => h('tr', { class: (c.ch === S.ch ? 'on ' : '') + (c.guard ? 'guard' : ''), onclick: () => setCh(c.ch) }, h('td', {}, h('b', {}, ch2(c.ch))), h('td', {}, c.f), h('td', {}, c.use))));
      const test = h('div.vhf-test');
      if (!S.task) {
        test.append(h('p', {}, 'Test: dostajesz sytuację na morzu – ustaw kanał i moc (dla MAYDAY także wyślij alarm DSC) i ułóż korespondencję z gotowych zdań. Niektóre zadania mają kilka kroków.'),
          h('div.vhf-row', {}, h('button.btn.primary', { onclick: () => newTask() }, '▶ Rozpocznij test'), h('span.muted', {}, `${t('Poprawne:')} ${S.stats.ok}/${S.stats.n}`), listBtn()));
      } else {
        const T = S.task, ST = T.steps[S.si];
        test.append(h('div.vhf-task', {}, h('div.vhf-task-h', {}, 'Zadanie'), h('p', {}, T.text),
          h('div.small.muted', {}, `${t('Twój jacht')}: ${ship.name}, ${t('znak wywoławczy')} ${ship.call}, MMSI ${ship.mmsi}`)));
        if (ST.label) test.append(h('div.vhf-step', {}, ST.label));
        if (ST.lines) test.append(...msgBox(ST));
        if (!S.result) {
          test.append(h('div.vhf-row', {}, h('button.btn.primary', { onclick: () => check() }, ST.lines ? '🎙 Nadaj (PTT)' : 'Sprawdź ustawienie'), h('span.muted', {}, `${t('Ustawiony kanał')}: ${ch2(S.ch)}, ${S.power} W`), listBtn()));
        } else {
          const R = S.result, more = R.ok && S.si < T.steps.length - 1;
          test.append(h('div.quiz-verdict', { class: R.ok ? 'ok' : 'bad' }, R.ok ? '✓ Dobrze!' : '✗ Źle'));
          if (!R.ok) {
            const fb = h('div.vhf-fb');
            if (!R.chOk) fb.append(h('div', {}, h('span.muted', {}, 'Poprawny kanał:'), ' ', h('b', {}, ST.channels.map(ch2).join(' / '))));
            if (!R.powerOk) fb.append(h('div', {}, h('span.muted', {}, 'Poprawna moc:'), ' ', h('b', {}, `${ST.power} W`)));
            if (!R.dscOk) fb.append(h('div', {}, h('b', {}, 'Najpierw alarm DSC (DISTRESS), potem MAYDAY głosem.')));
            if (!R.msgOk) fb.append(h('div', {}, h('span.muted', {}, 'Poprawna korespondencja:')), h('div.sf-lines', {}, ...ST.lines.map((l) => h('div', {}, l))));
            fb.append(h('div.small', {}, T.explain));
            test.append(fb);
          }
          test.append(h('div.vhf-row', {}, more
            ? h('button.btn.primary', { onclick: () => { S.si++; S.lines = []; S.result = null; render(); } }, 'Dalej – następny krok →')
            : h('button.btn.primary', { onclick: () => newTask() }, 'Następne zadanie →'), h('span.muted', {}, `${t('Poprawne:')} ${S.stats.ok}/${S.stats.n}`), listBtn()));
        }
      }
      body.append(h('div.vhf-left', {}, face, test));
      if (!S.hideList) body.append(h('div.vhf-right', {}, table));
    }
    function newTask() { S.task = deck.next(ship); S.si = 0; S.lines = []; S.result = null; S.dsc = false; S.cover = false; render(); }
    function check() {
      const T = S.task;
      S.result = checkRadio(T.steps[S.si], { channel: S.ch, power: S.power, dscSent: S.dsc, lines: S.lines });
      // wynik liczony za całe zadanie: błąd w dowolnym kroku albo dobrze w ostatnim
      if (!S.result.ok || S.si === T.steps.length - 1) { S.stats.n++; if (S.result.ok) S.stats.ok++; }
      render();
    }
    render();
    return { S, render, newTask, check, setCh };
  }
  const api = { view, openRadio, openCard, openDevice, close };
  window.__safety = api;
  return api;
}
