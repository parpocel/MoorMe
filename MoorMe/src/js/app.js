// MoorMe – główny moduł aplikacji: kreator konfiguracji i uruchamianie symulacji
import { h, seg } from './ui/dom.js';
import { BOATS, defaultEquipment } from './data/boats.js';
import { QUAYS, METHODS, generateHarbor } from './data/harbors.js';
import { createDeckEditor, relabel } from './ui/deckEditor.js';
import { drawBoatTop, drawHarborMap, mapTransform, drawArrow } from './ui/draw2d.js';
import { SimScreen } from './ui/simUI.js';
import { DEG, compassVec } from './math.js';

const app = document.getElementById('app');
const STORE_KEY = 'moorme.config.v1';

const STEPS = ['Jacht', 'Wyposażenie', 'Keja i cumowanie', 'Pogoda i start'];

function loadConfig() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && BOATS[s.boatId]) return s;
  } catch (e) { /* brak zapisu */ }
  return null;
}
function saveConfig(c) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(c)); } catch (e) { /* ignoruj */ }
}

let config = loadConfig() || {
  boatId: 'C34',
  equip: defaultEquipment(BOATS.C34),
  quay: 'pontoon',
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
  const s = h('div.screen', {}, header(step), h('div.screen-body', {}, body), footer(step, onNext, nextLabel));
  app.appendChild(s);
}

// ---------- Ekran tytułowy ----------
function showTitle() {
  app.innerHTML = '';
  const cv = h('canvas');
  const s = h('div.screen.title-screen', {}, cv,
    h('div.inner', {},
      h('div.big-logo', {}, 'Moor', h('span', {}, 'Me')),
      h('p', {}, 'Symulator cumowania i odcumowywania jachtów żaglowych. Wiatr, dryf, zarzucanie rufy przez śrubę, stery strumieniowe, cumy, szpringi i muringi – przećwicz manewry portowe zanim zrobisz je naprawdę.'),
      h('div', { style: { display: 'flex', gap: '12px', justifyContent: 'center' } },
        h('button.btn.primary.big', { onclick: () => showStep(0) }, 'Nowa symulacja'),
        loadConfig() ? h('button.btn.big', { onclick: () => startSim() }, 'Szybki start (ostatnie ustawienia)') : null),
      h('p.small', { style: { marginTop: '40px' } }, 'Modele oparte na jachtach Bavaria C34, C46 i C50 · dane orientacyjne')));
  app.appendChild(s);
  // animowane tło – fale
  const ctx = cv.getContext('2d');
  let t = 0;
  const loop = () => {
    if (!cv.isConnected) return;
    cv.width = cv.clientWidth; cv.height = cv.clientHeight;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let k = 0; k < 7; k++) {
      ctx.strokeStyle = `rgba(47,179,232,${0.07 + k * 0.02})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= cv.width; x += 12) {
        const y = cv.height * (0.55 + k * 0.06) + Math.sin(x * 0.01 + t * (0.6 + k * 0.1) + k) * (10 + k * 3);
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    t += 0.02;
    requestAnimationFrame(loop);
  };
  loop();
}

// ---------- Krok 1: jacht ----------
function stepBoat() {
  const cards = h('div.cards');
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
  const body = h('div', {}, h('h2', { style: { marginBottom: '6px' } }, 'Wybierz jacht'), h('p.muted', { style: { marginTop: 0 } }, 'Większy jacht = większa bezwładność i nawiew, ale mocniejszy silnik i ster strumieniowy.'), cards);
  screen(0, body, () => showStep(1));
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
    h('h3', {}, 'Winche i odbijacze'),
    opt('Winche', seg([{ value: false, label: 'Ręczne' }, { value: true, label: 'Elektryczne' }], eq.electricWinch, (v) => { eq.electricWinch = v; })),
    opt('Rozmiar odbijaczy', seg([{ value: 0.09, label: 'Małe' }, { value: 0.11, label: 'Średnie' }, { value: 0.13, label: 'Duże' }, { value: 0.16, label: 'XL' }], eq.fenderRadius, (v) => { eq.fenderRadius = v; editor.render(); })),
    h('h3', {}, 'Elementy pokładu'),
    editor.list);
  const body = h('div.two-col', {}, left, right);
  screen(1, body, () => showStep(2));
}

// ---------- Krok 3: keja ----------
function stepHarbor() {
  const spec = BOATS[config.boatId];
  if (!QUAYS[config.quay].methods.includes(config.method)) config.method = QUAYS[config.quay].methods[0];
  const cards = h('div.cards', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' } });
  for (const q of Object.values(QUAYS)) {
    cards.appendChild(h('div.card', { class: config.quay === q.id ? 'selected' : '', onclick: () => { config.quay = q.id; if (!q.methods.includes(config.method)) config.method = q.methods[0]; showStep(2); } },
      h('h3', {}, q.name), h('div.small.muted', {}, q.desc)));
  }
  const q = QUAYS[config.quay];
  const mapCv = h('canvas', { width: 900, height: 560, style: { width: '100%', borderRadius: '12px' } });
  const drawMap = () => {
    const H = generateHarbor({ quay: config.quay, method: config.method, side: config.side, boatSpec: spec, seed: config.seed });
    const b = H.berth;
    const T = mapTransform(mapCv, { minX: b.x - 45, maxX: b.x + 45, minZ: -14, maxZ: 44 });
    drawHarborMap(mapCv.getContext('2d'), H, T, { spec });
    const ctx = mapCv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Segoe UI';
    ctx.fillText('Twoje stanowisko (zielone)', 14, mapCv.height - 14);
  };
  const methodInfo = h('div.hint', {}, METHODS[config.method].desc);
  const sideField = h('div.field', { style: { display: config.method === 'longside' ? 'block' : 'none' } }, h('label', {}, 'Burta do kei'),
    seg([{ value: 'port', label: 'Lewa burta' }, { value: 'starboard', label: 'Prawa burta' }], config.side, (v) => { config.side = v; drawMap(); }));
  const right = h('div.panel', {},
    h('h2', {}, 'Sposób cumowania'),
    seg(q.methods.map((m) => ({ value: m, label: METHODS[m].name })), config.method, (v) => { config.method = v; methodInfo.textContent = METHODS[v].desc; sideField.style.display = v === 'longside' ? 'block' : 'none'; drawMap(); }),
    methodInfo,
    sideField,
    h('h3', {}, 'Zadanie'),
    seg([{ value: 'moor', label: 'Cumowanie (podejście do kei)' }, { value: 'unmoor', label: 'Odcumowanie (wyjście)' }], config.scenario, (v) => { config.scenario = v; }),
    h('div.small.muted', { style: { marginTop: '6px' } }, 'Przy odcumowaniu startujesz zacumowany – liny założone na biegowo, jedna osoba na kei.'),
    h('h3', {}, 'Sąsiedzi'),
    h('div.row', {}, h('button.btn.sm', { onclick: () => { config.seed = Math.floor(Math.random() * 1000); drawMap(); } }, '🎲 Losuj rozmieszczenie jachtów')));
  const body = h('div', {}, h('h2', { style: { marginBottom: '10px' } }, 'Wybierz keję'), cards,
    h('div.two-col', { style: { marginTop: '18px' } }, h('div.panel', {}, mapCv), right));
  screen(2, body, () => showStep(3));
  drawMap();
}

// ---------- Krok 4: pogoda i start ----------
function stepWeather() {
  const spec = BOATS[config.boatId];
  const w = config.weather;
  const H = generateHarbor({ quay: config.quay, method: config.method, side: config.side, boatSpec: spec, seed: config.seed });
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

  // mapa startu
  const mapCv = h('canvas', { width: 1000, height: 820, style: { width: '100%', borderRadius: '12px', cursor: 'crosshair' } });
  const T = mapTransform(mapCv, { minX: -150, maxX: 150, minZ: -30, maxZ: 225 });
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
    if (x < -145 || x > 145 || z < 5 || z > 225) return;
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
    exit: () => showStep(3)
  });
}

window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
});

showTitle();
