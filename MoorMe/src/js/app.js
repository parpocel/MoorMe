// MoorMe – główny moduł aplikacji: kreator konfiguracji i uruchamianie symulacji
import { h, seg } from './ui/dom.js';
import { BOATS, defaultEquipment } from './data/boats.js';
import { QUAYS, METHODS, PORTS, generateHarbor, harborOpts, slotKind, slotClearFor, berthOptions, normalizeBerth } from './data/harbors.js';
import { createDeckEditor, relabel } from './ui/deckEditor.js';
import { drawBoatTop, drawHarborMap, mapTransform, drawArrow } from './ui/draw2d.js';
import { SimScreen } from './ui/simUI.js';
import { DEG, compassVec, pointInConvex } from './math.js';
import { sceneryHTML, signalFlagsHTML } from './ui/scenery.js';
import { buildHelpContent } from './ui/help.js';
import { Preview3D } from './render/preview.js';

// tło menu: ilustracja portu (SVG) jako pierwsze dziecko ekranu
function sceneryEl() {
  const d = document.createElement('div');
  d.innerHTML = sceneryHTML();
  return d.firstChild;
}
const icon = {
  play: '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M8 5l12 7-12 7z" fill="#fff7f1"/></svg>',
  chev: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="#fff7f1" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dice: '<svg width="26" height="26" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="#d2695f" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.6" fill="#d2695f"/><circle cx="15.5" cy="15.5" r="1.6" fill="#d2695f"/><circle cx="15.5" cy="8.5" r="1.6" fill="#d2695f"/><circle cx="8.5" cy="15.5" r="1.6" fill="#d2695f"/></svg>',
  fast: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 5l8 7-8 7zM12 5l8 7-8 7z" fill="#3f8a72"/></svg>',
  help: '<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#2f4468" stroke-width="2"/><path d="M9.5 9.5a2.6 2.6 0 015 .8c0 1.8-2.5 2-2.5 3.7M12 17v.5" fill="none" stroke="#2f4468" stroke-width="2" stroke-linecap="round"/></svg>',
  down: '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 4v14M6 12l6 6 6-6" fill="none" stroke="#4a5a7d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const raw = (html) => { const d = document.createElement('span'); d.style.display = 'contents'; d.innerHTML = html; return d; };

const app = document.getElementById('app');
const STORE_KEY = 'moorme.config.v1';

const STEPS = ['Jacht', 'Wyposażenie', 'Keja i cumowanie', 'Pogoda i start'];

function loadConfig() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && BOATS[s.boatId]) return normalizeBerth(s);
  } catch (e) { /* brak zapisu */ }
  return null;
}
function saveConfig(c) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(c)); } catch (e) { /* ignoruj */ }
}

let config = loadConfig() || {
  boatId: 'C34',
  equip: defaultEquipment(BOATS.C34),
  port: 'med',
  zone: 'riva',
  method: 'mooringStern',
  side: 'port',
  scenario: 'moor',
  weather: { windKn: 10, windFrom: 250, gust: 0.3, currentKn: 0, currentTo: 90 },
  start: { preset: 'near', x: 32, z: 40, compass: 270, speedKn: 0 },
  seed: 7
};

function beaufort(kn) {
  const t = [1, 3, 6, 10, 16, 21, 27, 33, 40, 47, 55, 63];
  const i = t.findIndex((v) => kn <= v);
  return i < 0 ? 12 : i;
}

function header(step) {
  return h('div.screen-header', {},
    h('div.logo', {}, 'Moor', h('span', {}, 'Me')),
    h('div.muted', {}, 'symulator cumowania jachtów'),
    h('div.steps', {}, STEPS.map((s, i) => h('div.step', { class: i === step ? 'active' : i < step ? 'done' : '' }, `${i + 1}. ${s}`))));
}

function footer(step, onNext, nextLabel = 'Dalej →') {
  return h('div.screen-footer', {},
    h('button.btn', { onclick: () => (step === 0 ? showTitle() : showStep(step - 1)) }, '← Wstecz'),
    h('button.btn.primary.big', { onclick: onNext }, nextLabel));
}

function screen(step, body, onNext, nextLabel) {
  app.innerHTML = '';
  const s = h('div.screen', {}, sceneryEl(), header(step), h('div.screen-body', {}, body), footer(step, onNext, nextLabel));
  app.appendChild(s);
}

// ---------- Ekran tytułowy ----------
function showTitle() {
  app.innerHTML = '';
  const saved = !!loadConfig();
  const btn = (cls, iconHtml, label, sub, onclick, extra = {}) => h('button.tbtn' + cls, { onclick, ...extra },
    h('span.ic', {}, raw(iconHtml)), sub ? h('span', {}, label, h('small', {}, sub)) : h('span', {}, label));
  const main = btn('.main', icon.play, 'Nowa symulacja', null, () => { config.random = false; showStep(0); });
  main.appendChild(h('span.chev', {}, raw(icon.chev)));
  const s = h('div.screen.title-screen', {}, sceneryEl(),
    h('div.title-card', {},
      h('div.title-flags', {}, h('div.fl', {}, raw(signalFlagsHTML())), h('div.tag', {}, 'PORT BAŁTYK')),
      h('div.title-sub', {}, 'SYMULATOR MANEWRÓW PORTOWYCH'),
      h('div.big-logo', {}, 'Moor', h('span', {}, 'Me')),
      h('p.desc', {}, 'Symulator cumowania i odcumowywania jachtów żaglowych. Wiatr, dryf, zarzucanie rufy przez śrubę, stery strumieniowe, cumy, szpringi i muringi – przećwicz manewry portowe z załogą jachtu Anneliese zanim zrobisz je naprawdę.'),
      main,
      h('div.tbtn-row', {},
        btn('.sec.rnd', icon.dice, 'Random', null, () => showRandom(), { title: 'Losowe zadanie w losowych warunkach' }),
        btn('.sec.fast', icon.fast, 'Szybki start', 'ostatnie ustawienia', () => startSim(), saved ? {} : { disabled: true, title: 'Najpierw ustaw i uruchom symulację' })),
      btn('.help', icon.help, 'Pomoc – sterowanie i praca na cumach', null, () => showHelp()),
      h('div.title-note', {}, raw(icon.down), h('span', {}, 'Modele oparte na jachtach Bavaria C34, C46 i C50 · dane orientacyjne'))));
  app.appendChild(s);
}

// ---------- Pomoc ----------
function showHelp() {
  app.innerHTML = '';
  app.appendChild(h('div.screen', {}, sceneryEl(),
    h('div.screen-header', {}, h('div.logo', {}, 'Moor', h('span', {}, 'Me')), h('div.muted', {}, 'pomoc')),
    h('div.screen-body', {}, h('div.help-card', {}, h('h2', { style: { marginBottom: '4px' } }, 'Jak sterować i cumować'), ...buildHelpContent())),
    h('div.screen-footer', {}, h('button.btn', { onclick: () => showTitle() }, '← Menu'), h('span'))));
}

// ---------- Krok 1: jacht ----------
function stepBoat() {
  const cards = h('div.cards', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' } });
  for (const b of Object.values(BOATS)) {
    const cv = h('canvas', { width: 520, height: 170 });
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0e2a42'; ctx.fillRect(0, 0, 520, 170);
    const scale = 480 / 16;
    drawBoatTop(ctx, b, 260, 85, scale, 0, {});
    ctx.fillStyle = '#9fb8cc'; ctx.font = '12px Segoe UI';
    ctx.fillText(`${b.loa.toFixed(2)} m`, 12, 160);
    const card = h('div.card', { class: config.boatId === b.id ? 'selected' : '', onclick: () => {
      if (config.boatId !== b.id) { config.boatId = b.id; config.equip = defaultEquipment(b); }
      showStep(0);
    } },
    h('h3', {}, b.name), cv,
    h('table.spec-table', {},
      [['Długość całkowita', `${b.loa.toFixed(2)} m`], ['Szerokość', `${b.beam.toFixed(2)} m`], ['Zanurzenie', `${b.draft.toFixed(2)} m`], ['Wyporność', `${(b.displacement / 1000).toFixed(1)} t`], ['Silnik', `${b.engineHp} KM`], ['Prędkość maks. na silniku', `~${b.maxSpeedKn} kn`], ['Pow. nawiewu (bok)', `${b.windageSide} m²`], ['Ster strumieniowy (opcja)', `${Math.round(b.bowThrusterN / 9.81)} kgf`], ['Płetwy sterowe', 'podwójne']].map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v)))));
    cards.appendChild(card);
  }
  const pv = h('div.preview3d', { style: { height: '420px' } });
  const pvTitle = h('h2', { style: { margin: '0 0 8px' } }, BOATS[config.boatId].name);
  const body = h('div', {}, h('h2', { style: { marginBottom: '6px' } }, 'Wybierz jacht'), h('p.muted', { style: { marginTop: 0 } }, 'Większy jacht = większa bezwładność i nawiew, ale mocniejszy silnik i ster strumieniowy.'),
    h('div.pv-split', {}, cards, h('div.panel', { style: { position: 'sticky', top: '0' } }, pvTitle, pv, h('div.small.muted', { style: { marginTop: '8px' } }, 'Przeciągnij myszą, żeby obrócić model; kółko – przybliżenie. Najedź na kartę, żeby zobaczyć inny jacht.'))));
  screen(0, body, () => showStep(1));
  const prev = new Preview3D(pv, '');
  prev.setBoat(BOATS[config.boatId]);
  for (const c of cards.children) {
    const id = Object.keys(BOATS)[[...cards.children].indexOf(c)];
    c.addEventListener('mouseenter', () => { prev.setBoat(BOATS[id]); pvTitle.textContent = BOATS[id].name; });
    c.addEventListener('mouseleave', () => { prev.setBoat(BOATS[config.boatId]); pvTitle.textContent = BOATS[config.boatId].name; });
  }
}

// ---------- Krok 2: wyposażenie ----------
function stepEquipment() {
  const spec = BOATS[config.boatId];
  const eq = config.equip;
  let editor;
  const rebuild = () => showStep(1);
  editor = createDeckEditor(spec, eq, (what) => {
    if (what === 'reset') {
      const d = defaultEquipment(spec);
      eq.deck = d.deck; eq.fenders = d.fenders;
      rebuild();
    }
  });
  relabel(spec, eq.deck);
  editor.render();
  const left = h('div.panel', {},
    h('h2', {}, `Pokład – ${spec.name}`),
    h('div.small.muted', { style: { marginBottom: '8px' } }, 'Rozmieść knagi, kluzy (zamknięte), półkluzy (otwarte) oraz odbijacze. Przeciągaj elementy trybem „Wybierz”.'),
    editor.toolbar,
    h('div.editor-wrap', {}, editor.canvas),
    h('div.hint', {}, 'Lina prowadzona jest z knagi przez najbliższą kluzę/półkluzę na tej samej burcie. Z półkluzy lina może wyskoczyć, gdy ciągnie pod dużym kątem do burty. Szpringi najlepiej prowadzić z knag śródokręcia.'));
  const opt = (label, content, hint) => h('div.field', {}, h('label', {}, label), content, hint ? h('div.small.muted', { style: { marginTop: '4px' } }, hint) : null);
  const right = h('div.panel', {},
    h('h2', {}, 'Napęd i wyposażenie'),
    h('h3', {}, 'Śruba napędowa'),
    opt('Kierunek obrotu', seg([{ value: 'right', label: 'Prawoskrętna' }, { value: 'left', label: 'Lewoskrętna' }], eq.propHand, (v) => { eq.propHand = v; }), 'Prawoskrętna na biegu wstecz zarzuca rufę w LEWO (na bakburtę), lewoskrętna – w prawo. Na biegu naprzód efekt jest słabszy i odwrotny.'),
    opt('Typ napędu', seg([{ value: 'saildrive', label: 'Saildrive' }, { value: 'shaft', label: 'Wał' }], eq.drive, (v) => { eq.drive = v; }), 'Wał daje silniejsze zarzucanie rufy i lepszy strumień na płetwy sterowe.'),
    h('h3', {}, 'Stery strumieniowe'),
    opt(`Dziobowy (${Math.round(spec.bowThrusterN / 9.81)} kgf)`, seg([{ value: 'none', label: 'Brak' }, { value: 'onoff', label: 'Włącz/wyłącz' }, { value: 'proportional', label: 'Proporcjonalny' }], eq.bowThruster, (v) => { eq.bowThruster = v; editor.render(); })),
    opt(`Rufowy (${Math.round(spec.sternThrusterN / 9.81)} kgf)`, seg([{ value: false, label: 'Brak' }, { value: true, label: 'Zamontowany' }], eq.sternThruster, (v) => { eq.sternThruster = v; editor.render(); }), 'Stery strumieniowe tracą skuteczność powyżej ~2 kn i przegrzewają się przy długiej pracy.'),
    h('h3', {}, 'Kabestany i odbijacze'),
    opt('Kabestany', seg([{ value: false, label: 'Ręczne' }, { value: true, label: 'Elektryczne' }], eq.electricWinch, (v) => { eq.electricWinch = v; })),
    opt('Rozmiar odbijaczy', seg([{ value: 0.09, label: 'Małe' }, { value: 0.11, label: 'Średnie' }, { value: 0.13, label: 'Duże' }, { value: 0.16, label: 'XL' }], eq.fenderRadius, (v) => { eq.fenderRadius = v; editor.render(); })),
    h('h3', {}, 'Elementy pokładu'),
    editor.list);
  const body = h('div.two-col', {}, left, right);
  screen(1, body, () => showStep(2));
}

const slotClear = (method) => slotClearFor({ ...config, method });

// ---------- Krok 3: port i stanowisko ----------
function stepHarbor() {
  const spec = BOATS[config.boatId];
  normalizeBerth(config);
  const cards = h('div.cards', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' } });
  for (const P of Object.values(PORTS)) {
    cards.appendChild(h('div.card', { class: config.port === P.id ? 'selected' : '', onclick: () => { if (config.port !== P.id) { config.port = P.id; config.zone = null; normalizeBerth(config); } showStep(2); } },
      h('h3', {}, P.name), h('div.small.muted', {}, P.desc)));
  }
  const mapCv = h('canvas', { width: 900, height: 620, style: { width: '100%', height: 'min(300px, 34vh)', borderRadius: '12px', background: '#0e2a42', display: 'block' } });
  let zoom = 'berth';
  const drawMap = () => {
    // rozdzielczość płótna dopasowana do rozmiaru na ekranie (mapa nie rozciąga się po maksymalizacji okna)
    if (mapCv.clientWidth) { mapCv.width = mapCv.clientWidth; mapCv.height = mapCv.clientHeight; }
    const H = generateHarbor(harborOpts(config, spec));
    const b = H.berth;
    const T = zoom === 'port' ? mapTransform(mapCv, H.bounds) : mapTransform(mapCv, { minX: b.x - 50, maxX: b.x + 50, minZ: b.z - 35, maxZ: b.z + 35 });
    updateWidth();
    drawHarborMap(mapCv.getContext('2d'), H, T, { spec, bollards: zoom !== 'port' });
    const ctx = mapCv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Segoe UI';
    ctx.fillText('Twoje stanowisko: „TU” (zielone)', 14, mapCv.height - 14);
    schedulePreview(H);
  };
  // podgląd 3D portu (przebudowa z opóźnieniem, żeby suwak szerokości nie mielił sceny)
  const pv = h('div.preview3d', { style: { height: '300px', marginBottom: '12px' } });
  let prev = null, pvKey = '', pvTimer = null;
  const schedulePreview = (H) => {
    const key = [config.port, config.zone, config.method, config.side, config.seed, JSON.stringify(config.slotClear || {})].join('|');
    if (!prev || key === pvKey) return;
    clearTimeout(pvTimer);
    pvTimer = setTimeout(() => { if (!pv.isConnected || !prev) return; pvKey = key; prev.setHarbor(H, spec); }, 250);
  };
  const opts = berthOptions(config.port);
  const cur = () => opts.find((o) => o.zone === config.zone && o.method === config.method);
  const methodInfo = h('div.hint', {}, METHODS[config.method].desc);
  const sideField = h('div.field', { style: { display: config.method === 'longside' ? 'block' : 'none' } }, h('label', {}, 'Burta do kei'),
    seg([{ value: 'port', label: 'Lewa burta' }, { value: 'starboard', label: 'Prawa burta' }], config.side, (v) => { config.side = v; drawMap(); }));
  // lista stanowisk w porcie
  const list = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } });
  const drawList = () => {
    list.innerHTML = '';
    let lastZone = null;
    for (const o of opts) {
      if (o.zone !== lastZone) { list.appendChild(h('div.small.muted', { style: { marginTop: lastZone ? '6px' : 0 } }, o.zoneName)); lastZone = o.zone; }
      list.appendChild(h('button.btn.sm', { class: cur() === o ? 'on' : '', style: { textAlign: 'left' }, onclick: () => {
        config.zone = o.zone; config.method = o.method;
        methodInfo.textContent = METHODS[o.method].desc;
        sideField.style.display = o.method === 'longside' ? 'block' : 'none';
        drawList(); drawMap();
      } }, METHODS[o.method].name));
    }
  };
  drawList();
  // szerokość stanowiska między Y-bomami / dalbami
  const widthOut = h('b');
  const widthInfo = h('div.small.muted', { style: { marginTop: '4px' } });
  const widthInp = h('input', { type: 'range', min: 0.1, max: 2.5, step: 0.05 });
  const widthLabel = h('label');
  const widthField = h('div.field', {}, widthLabel, h('div.row', {}, widthInp, widthOut), widthInfo);
  function updateWidth() {
    const k = slotKind(config.method);
    widthField.style.display = k ? 'block' : 'none';
    if (!k) return;
    const c = slotClear(config.method);
    widthInp.value = c;
    widthLabel.textContent = k === 'yboom' ? 'Szerokość między Y-bomami (prześwit)' : 'Szerokość między dalbami (prześwit)';
    widthOut.textContent = `${(spec.beam + c).toFixed(2)} m`;
    const perSide = c / 2;
    widthInfo.textContent = `Jacht ${spec.beam.toFixed(2)} m + ${c.toFixed(2)} m luzu (${(perSide * 100).toFixed(0)} cm na burtę${perSide < 0.25 ? ' – odbijacze będą mocno pracować' : perSide > 0.8 ? ' – dużo miejsca, łatwiej' : ''}).`;
  }
  widthInp.addEventListener('input', () => {
    config.slotClear = { ...(config.slotClear || {}), [slotKind(config.method)]: +widthInp.value };
    drawMap();
  });
  const zoomSeg = seg([{ value: 'berth', label: 'Stanowisko' }, { value: 'port', label: 'Cały port' }], zoom, (v) => { zoom = v; drawMap(); });
  const right = h('div.panel', {},
    h('h2', {}, 'Stanowisko w porcie'),
    list,
    methodInfo,
    sideField,
    widthField,
    h('h3', {}, 'Zadanie'),
    seg([{ value: 'moor', label: 'Cumowanie (podejście do kei)' }, { value: 'unmoor', label: 'Odcumowanie (wyjście)' }], config.scenario, (v) => { config.scenario = v; }),
    h('div.small.muted', { style: { marginTop: '6px' } }, 'Przy odcumowaniu startujesz zacumowany – liny założone na biegowo, jedna osoba na kei.'),
    h('h3', {}, 'Sąsiedzi'),
    h('div.row', {}, h('button.btn.sm', { onclick: () => { config.seed = Math.floor(Math.random() * 1000); drawMap(); } }, '🎲 Losuj rozmieszczenie jachtów')));
  const body = h('div', {}, h('h2', { style: { marginBottom: '10px' } }, 'Wybierz port'), cards,
    h('div.two-col', { style: { marginTop: '18px' } }, h('div.panel', {}, pv, h('div', { style: { marginBottom: '8px' } }, zoomSeg), mapCv), right));
  screen(2, body, () => showStep(3));
  prev = new Preview3D(pv, 'podgląd 3D – przeciągnij, żeby obrócić');
  drawMap();
}

// ---------- Krok 4: pogoda i start ----------
function stepWeather() {
  const spec = BOATS[config.boatId];
  const w = config.weather;
  const H = generateHarbor(harborOpts(config, spec));
  const st = config.start;
  if (!st.preset) st.preset = 'near';
  const pre = H.starts.find((s) => s.id === st.preset);
  if (pre) Object.assign(st, { x: pre.x, z: pre.z, compass: pre.compass });

  // tarcza kierunku wiatru
  const dial = h('canvas', { width: 220, height: 220, style: { width: '220px', height: '220px', cursor: 'pointer' } });
  const drawDial = () => {
    const ctx = dial.getContext('2d'), c = 110, R = 90;
    ctx.clearRect(0, 0, 220, 220);
    ctx.fillStyle = '#0e2a42'; ctx.beginPath(); ctx.arc(c, c, R + 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#cfe6f5'; ctx.font = 'bold 13px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].forEach((l, i) => { const a = i * 45 * DEG; ctx.fillText(l, c + Math.sin(a) * (R + 4) * 0.82, c - Math.cos(a) * (R + 4) * 0.82); });
    const a = w.windFrom * DEG;
    // strzałka: wieje Z kierunku -> do środka
    drawArrow(ctx, c + Math.sin(a) * R * 0.45, c - Math.cos(a) * R * 0.45, a + Math.PI / 2, R * 0.9, '#5ec8ff', 4);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Segoe UI';
    ctx.fillText(`${Math.round(w.windFrom)}°`, c, c + R + 8);
  };
  const setDial = (e) => {
    const r = dial.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    let d = Math.atan2(x, -y) / DEG;
    d = (Math.round(d / 5) * 5 + 360) % 360;
    w.windFrom = d;
    drawDial(); drawMap();
  };
  dial.addEventListener('pointerdown', (e) => { dial.setPointerCapture(e.pointerId); setDial(e); dial._d = true; });
  dial.addEventListener('pointermove', (e) => dial._d && setDial(e));
  dial.addEventListener('pointerup', () => (dial._d = false));

  const windOut = h('b');
  const updWindOut = () => (windOut.textContent = `${w.windKn} kn (${beaufort(w.windKn)}°B)`);
  updWindOut();
  const windInp = h('input', { type: 'range', min: 0, max: 35, step: 1, value: w.windKn });
  windInp.addEventListener('input', () => { w.windKn = +windInp.value; updWindOut(); });
  const gustOut = h('b', {}, `${Math.round(w.gust * 100)}%`);
  const gustInp = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: w.gust });
  gustInp.addEventListener('input', () => { w.gust = +gustInp.value; gustOut.textContent = `${Math.round(w.gust * 100)}%`; });
  const curOut = h('b', {}, `${w.currentKn.toFixed(1)} kn`);
  const curInp = h('input', { type: 'range', min: 0, max: 2, step: 0.1, value: w.currentKn });
  curInp.addEventListener('input', () => { w.currentKn = +curInp.value; curOut.textContent = `${w.currentKn.toFixed(1)} kn`; drawMap(); });
  const curDir = h('input', { type: 'range', min: 0, max: 355, step: 5, value: w.currentTo });
  const curDirOut = h('b', {}, `${w.currentTo}°`);
  curDir.addEventListener('input', () => { w.currentTo = +curDir.value; curDirOut.textContent = `${w.currentTo}°`; drawMap(); });

  // pora dnia (godzina) – zmienna też w trakcie symulacji
  if (typeof w.hour !== 'number') w.hour = 14;
  const fmtH = (hh) => `${String(Math.floor(hh)).padStart(2, '0')}:${String(Math.round((hh % 1) * 60)).padStart(2, '0')}${hh < 5 || hh > 21 ? ' (noc)' : hh < 7.5 ? ' (świt)' : hh > 18.5 ? ' (zmierzch)' : ''}`;
  const hourOut = h('b', {}, fmtH(w.hour));
  const hourInp = h('input', { type: 'range', min: 0, max: 23.75, step: 0.25, value: w.hour });
  hourInp.addEventListener('input', () => { w.hour = +hourInp.value; hourOut.textContent = fmtH(w.hour); });

  // mapa startu
  const mapCv = h('canvas', { width: 1000, height: 820, style: { width: '100%', borderRadius: '12px', cursor: 'crosshair' } });
  const T = mapTransform(mapCv, H.bounds);
  const drawMap = () => {
    const ctx = mapCv.getContext('2d');
    drawHarborMap(ctx, H, T, { spec, bollards: false });
    // wiatr
    const wd = compassVec(w.windFrom + 180);
    for (let i = 0; i < 5; i++) drawArrow(ctx, 90 + i * 200, 60, Math.atan2(wd.z, wd.x), 60, 'rgba(94,200,255,0.8)', 3);
    if (w.currentKn > 0) { const cd = compassVec(w.currentTo); drawArrow(ctx, 110, mapCv.height - 50, Math.atan2(cd.z, cd.x), 50, 'rgba(255,209,102,0.9)', 3); }
    if (config.scenario === 'moor') {
      const [px, pz] = T.toPx(st.x, st.z);
      drawBoatTop(ctx, spec, px, pz, T.s * 1.4, (st.compass - 90) * DEG, { simple: true, hull: '#ffd166', stroke: '#fff' });
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Segoe UI';
      ctx.fillText('START', px + 14, pz - 12);
    }
    ctx.fillStyle = '#fff'; ctx.font = '13px Segoe UI';
    ctx.fillText(config.scenario === 'moor' ? 'Kliknij, aby ustawić start. Przeciągnij, aby ustawić kurs.' : 'Odcumowanie – start ze stanowiska (zielone).', 14, mapCv.height - 14);
  };
  let dragStart = null;
  mapCv.addEventListener('pointerdown', (e) => {
    if (config.scenario !== 'moor') return;
    const r = mapCv.getBoundingClientRect();
    const [x, z] = T.toWorld((e.clientX - r.left) * (mapCv.width / r.width), (e.clientY - r.top) * (mapCv.height / r.height));
    const bb = H.bounds;
    if (x < bb.minX + 5 || x > bb.maxX - 5 || z < bb.minZ + 5 || z > bb.maxZ - 5) return;
    if (H.structures.some((st) => pointInConvex(st.poly, x, z))) return; // nie na lądzie / kei
    st.x = x; st.z = z; st.preset = 'custom';
    dragStart = { x, z };
    mapCv.setPointerCapture(e.pointerId);
    drawMap(); presetSeg.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
  });
  mapCv.addEventListener('pointermove', (e) => {
    if (!dragStart) return;
    const r = mapCv.getBoundingClientRect();
    const [x, z] = T.toWorld((e.clientX - r.left) * (mapCv.width / r.width), (e.clientY - r.top) * (mapCv.height / r.height));
    if (Math.hypot(x - dragStart.x, z - dragStart.z) > 2) {
      st.compass = (Math.atan2(x - dragStart.x, -(z - dragStart.z)) / DEG + 360) % 360;
      drawMap();
    }
  });
  mapCv.addEventListener('pointerup', () => (dragStart = null));
  const presetSeg = seg(H.starts.map((s) => ({ value: s.id, label: s.name })), st.preset, (v) => { const p = H.starts.find((s) => s.id === v); Object.assign(st, { preset: v, x: p.x, z: p.z, compass: p.compass }); drawMap(); });
  const spdOut = h('b', {}, `${st.speedKn || 0} kn`);
  const spdInp = h('input', { type: 'range', min: 0, max: 4, step: 0.5, value: st.speedKn || 0 });
  spdInp.addEventListener('input', () => { st.speedKn = +spdInp.value; spdOut.textContent = `${st.speedKn} kn`; });

  const right = h('div.panel', {},
    h('h2', {}, 'Pogoda'),
    h('div.field', {}, h('label', {}, 'Kierunek wiatru (skąd wieje) – kliknij tarczę'), h('div', { style: { display: 'flex', justifyContent: 'center' } }, dial)),
    h('div.field', {}, h('label', {}, 'Siła wiatru'), h('div.row', {}, windInp, windOut)),
    h('div.field', {}, h('label', {}, 'Porywistość i skręty'), h('div.row', {}, gustInp, gustOut)),
    h('div.field', {}, h('label', {}, 'Prąd (np. wypływ rzeki)'), h('div.row', {}, curInp, curOut)),
    h('div.field', {}, h('label', {}, 'Kierunek prądu (dokąd płynie)'), h('div.row', {}, curDir, curDirOut)),
    h('div.field', {}, h('label', {}, 'Pora dnia'), h('div.row', {}, hourInp, hourOut)),
    h('div.field', {}, h('label', {}, 'Niebo'), seg([{ value: 'clear', label: '☀ Słonecznie' }, { value: 'cloudy', label: '☁ Pochmurno' }, { value: 'rain', label: '🌧 Deszcz' }, { value: 'fog', label: '🌫 Mgła' }], w.sky || 'clear', (v) => { w.sky = v; })),
    config.scenario === 'moor' ? h('div', {},
      h('h3', {}, 'Miejsce startu'),
      presetSeg,
      h('div.field', {}, h('label', {}, 'Prędkość początkowa'), h('div.row', {}, spdInp, spdOut))) : null,
    h('div.hint', {}, 'Wiatr z boku zdmuchuje dziób (środek naporu leży przed kilem). Przy silnym wietrze podchodź nawietrzną stroną i trzymaj prędkość – płetwy sterowe działają tylko z opływem.'));
  const body = h('div.two-col', {}, h('div.panel', {}, mapCv), right);
  screen(3, body, () => startSim(), '⚓ Rozpocznij symulację');
  drawDial();
  drawMap();
}

function showStep(i) {
  saveConfig(config);
  [stepBoat, stepEquipment, stepHarbor, stepWeather][i]();
}

function startSim() {
  saveConfig(config);
  app.innerHTML = '';
  const root = h('div', { style: { position: 'absolute', inset: 0 } });
  app.appendChild(root);
  window.__sim = new SimScreen(root, JSON.parse(JSON.stringify(config)), {
    restart: () => startSim(),
    exit: () => (config.random ? showTitle() : showStep(3))
  });
}

// ---------- Tryb Random: losowe zadanie w losowych warunkach ----------
function pickW(items) {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let x = Math.random() * total;
  for (const [v, w] of items) { x -= w; if (x <= 0) return v; }
  return items[0][0];
}
const rnd = (a, b) => a + Math.random() * (b - a);

export function randomConfig() {
  const boatId = pickW([['C34', 4], ['C46', 3], ['C50', 3]]);
  const spec = BOATS[boatId];
  const equip = defaultEquipment(spec);
  equip.propHand = Math.random() < 0.75 ? 'right' : 'left';
  equip.bowThruster = pickW([['none', spec.loa < 12 ? 5 : 2], ['onoff', 4], ['proportional', 2]]);
  equip.sternThruster = spec.loa > 12 && Math.random() < 0.2;
  equip.drive = spec.id === 'C50' ? 'shaft' : Math.random() < 0.8 ? 'saildrive' : 'shaft';
  const port = pickW([['med', 1], ['ystad', 1]]);
  const bo = berthOptions(port);
  const pickB = bo[Math.floor(Math.random() * bo.length)];
  const zone = pickB.zone, method = pickB.method;
  const windKn = Math.round(pickW([[rnd(0, 6), 25], [rnd(6, 12), 35], [rnd(12, 18), 25], [rnd(18, 25), 15]]));
  const hour = +pickW([[rnd(8, 18), 70], [rnd(5, 7.5), 7], [rnd(18.5, 21), 8], [rnd(21.5, 27) % 24, 15]]).toFixed(2);
  const sky = pickW([['clear', 45], ['cloudy', 30], ['rain', 15], ['fog', windKn < 10 ? 10 : 0]]);
  const cfg = {
    boatId, equip, port, zone, method,
    side: Math.random() < 0.5 ? 'port' : 'starboard',
    scenario: Math.random() < 0.6 ? 'moor' : 'unmoor',
    weather: {
      windKn, windFrom: Math.round(Math.random() * 72) * 5, gust: +rnd(0.1, windKn > 12 ? 0.6 : 0.4).toFixed(2),
      currentKn: Math.random() < 0.2 ? +rnd(0.2, 1).toFixed(1) : 0, currentTo: Math.round(Math.random() * 72) * 5,
      hour, sky
    },
    seed: Math.floor(Math.random() * 1000),
    slotClear: { yboom: +rnd(0.25, 1.0).toFixed(2), piles: +rnd(0.4, 1.1).toFixed(2) },
    random: true
  };
  const H = generateHarbor(harborOpts(cfg, spec));
  const st = H.starts[Math.floor(Math.random() * H.starts.length)];
  cfg.start = { preset: st.id, x: st.x, z: st.z, compass: st.compass, speedKn: Math.random() < 0.3 ? 1.5 : 0 };
  return cfg;
}

// Opis wiatru względem stanowiska (keja jest na północy)
function windRelative(cfg) {
  // kierunek (kompas) od wody w stronę kei przy naszym stanowisku
  const H = generateHarbor(harborOpts(cfg, BOATS[cfg.boatId]));
  const qn = H.berth.quayNormal;
  const toQuay = ((Math.atan2(qn.x, -qn.z) * 180) / Math.PI + 360) % 360;
  const a = Math.abs(((cfg.weather.windFrom - toQuay + 540) % 360) - 180); // 0 = wieje od kei
  if (cfg.weather.windKn < 4) return 'prawie bezwietrznie';
  if (a < 35) return 'wieje od kei – odpycha jacht od nabrzeża';
  if (a > 145) return 'wieje na keję – dociska jacht do nabrzeża';
  return a < 90 ? 'boczny, lekko od kei' : 'boczny, lekko na keję';
}

function difficulty(cfg) {
  const spec = BOATS[cfg.boatId], w = cfg.weather;
  let d = w.windKn / 4 + w.gust * 3 + spec.loa / 5 + (cfg.equip.bowThruster === 'none' ? 2 : 0) + (w.currentKn || 0) * 2;
  if (w.hour < 5.5 || w.hour > 20.5) d += 1.5;
  if (w.sky === 'fog') d += 1.5; else if (w.sky === 'rain') d += 0.8;
  if (cfg.method.startsWith('yboom') || cfg.method.startsWith('piles')) d += 1;
  if (cfg.slotClear && slotKind(cfg.method) && cfg.slotClear[slotKind(cfg.method)] < 0.4) d += 1;
  return d < 6 ? ['Łatwe', '#3ddc84'] : d < 9 ? ['Średnie', '#ffd166'] : d < 12 ? ['Trudne', '#ffb347'] : ['Ekspert', '#ff5a5a'];
}

function showRandom(cfg = randomConfig()) {
  const spec = BOATS[cfg.boatId], w = cfg.weather, eq = cfg.equip;
  const [diff, dcol] = difficulty(cfg);
  const skyName = { clear: '☀ słonecznie', cloudy: '☁ pochmurno', rain: '🌧 deszcz', fog: '🌫 mgła' }[w.sky];
  const hh = `${String(Math.floor(w.hour)).padStart(2, '0')}:${String(Math.round((w.hour % 1) * 60) % 60).padStart(2, '0')}`;
  const night = w.hour < 5.5 || w.hour > 20.5;
  const task = cfg.scenario === 'moor' ? `Zacumuj: ${METHODS[cfg.method].name.toLowerCase()}` : `Odcumuj i wyjdź ze stanowiska (${METHODS[cfg.method].name.toLowerCase()})`;
  const clear = slotKind(cfg.method) ? slotClearFor(cfg) : null;
  const mapCv = h('canvas', { width: 700, height: 460, style: { width: '100%', borderRadius: '12px' } });
  app.innerHTML = '';
  const row = (k, v) => h('tr', {}, h('td', {}, k), h('td', {}, v));
  const s = h('div.screen', {}, sceneryEl(), h('div.screen-header', {}, h('div.logo', {}, 'Moor', h('span', {}, 'Me')), h('div.muted', {}, 'tryb Random – losowe zadanie')),
    h('div.screen-body', {}, h('div.two-col', {},
      h('div.panel', {}, mapCv),
      h('div.panel', {},
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, h('h2', {}, '🎲 ' + task), h('span.chip', { style: { background: dcol, color: '#03121e', fontWeight: 800, fontSize: '13px' } }, diff)),
        h('table.spec-table', { style: { marginTop: '10px' } },
          row('Jacht', `${spec.name} (${spec.loa.toFixed(1)} m)`),
          row('Śruba / napęd', `${eq.propHand === 'right' ? 'prawoskrętna' : 'lewoskrętna'}, ${eq.drive === 'shaft' ? 'wał' : 'saildrive'}`),
          row('Ster strumieniowy', `${{ none: 'brak', onoff: 'dziobowy', proportional: 'dziobowy proporcjonalny' }[eq.bowThruster]}${eq.sternThruster ? ' + rufowy' : ''}`),
          row('Port', PORTS[cfg.port].name),
          row('Stanowisko', berthOptions(cfg.port).find((o) => o.zone === cfg.zone && o.method === cfg.method).zoneName),
          cfg.method === 'longside' ? row('Burta do kei', cfg.side === 'port' ? 'lewa' : 'prawa') : null,
          clear != null ? row('Szerokość stanowiska', `${(spec.beam + clear).toFixed(2)} m (luz ${clear.toFixed(2)} m)`) : null,
          row('Wiatr', `${w.windKn} kn z ${w.windFrom}°, porywy ${Math.round(w.gust * 100)}%`),
          row('Względem kei', windRelative(cfg)),
          w.currentKn ? row('Prąd', `${w.currentKn} kn na ${w.currentTo}°`) : null,
          row('Pora / niebo', `${hh}${night ? ' (noc)' : ''} · ${skyName}`),
          cfg.scenario === 'moor' ? row('Start', `${cfg.start.preset === 'custom' ? 'własny' : ({ entrance: 'wejście do portu', basin: 'środek basenu', near: 'blisko stanowiska', east: 'wschodnia część basenu' }[cfg.start.preset] || cfg.start.preset)}${cfg.start.speedKn ? `, w ruchu ${cfg.start.speedKn} kn` : ''}`) : null),
        h('div.hint', {}, cfg.scenario === 'moor' ? 'Stanowisko jest zaznaczone na zielono. Cumy przygotujesz w trakcie – kliknij knagę, a potem poler.' : 'Liny są założone na biegowo, jedna osoba jest na kei. Oddaj liny, zabierz załogę i wyjdź ze stanowiska.')))),
    h('div.screen-footer', {},
      h('button.btn', { onclick: () => showTitle() }, '← Menu'),
      h('div', { style: { display: 'flex', gap: '10px' } },
        h('button.btn.big', { onclick: () => showRandom() }, '🎲 Losuj ponownie'),
        h('button.btn.primary.big', { onclick: () => { config = cfg; startSim(); } }, '⚓ Start'))));
  app.appendChild(s);
  // mapa: stanowisko, start, wiatr
  const H = generateHarbor(harborOpts(cfg, spec));
  const T = mapTransform(mapCv, H.bounds);
  const ctx = mapCv.getContext('2d');
  drawHarborMap(ctx, H, T, { spec, bollards: false });
  const wd = compassVec(w.windFrom + 180);
  for (let i = 0; i < 4; i++) drawArrow(ctx, 80 + i * 180, 50, Math.atan2(wd.z, wd.x), 50, 'rgba(94,200,255,0.85)', 3);
  if (cfg.scenario === 'moor') {
    const [px, pz] = T.toPx(cfg.start.x, cfg.start.z);
    drawBoatTop(ctx, spec, px, pz, T.s * 1.4, (cfg.start.compass - 90) * DEG, { simple: true, hull: '#ffd166', stroke: '#fff' });
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Segoe UI'; ctx.fillText('START', px + 12, pz - 10);
  }
}

window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
});

showTitle();
