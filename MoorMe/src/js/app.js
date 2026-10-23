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
import { t, getLang, setLang, hasSavedLang, installDomTranslator, LANGS } from './i18n.js';
import { PassageScreen } from './ui/passageUI.js';
import { LightsScreen } from './ui/lightsUI.js';
import { SoundsScreen, ShipAudio } from './ui/soundsUI.js';
import { showHandbook, showTrainOrLearn, lightsBook, soundsBook, marksBook } from './ui/handbook.js';
import { showNavTasks } from './ui/navTasksUI.js';
import { showSafety } from './ui/safetyUI.js';
import { PASSAGES, buildPassage, routeLength } from './data/passage.js';
import { drawChart } from './ui/chart.js';
import { getSettings, saveSettings, setGfxPreset, toggleFullscreen, isFullscreen, refreshFullscreen, applyUiScale, GFX_PRESETS } from './settings.js';
import { FLAGS, FLAG_CODES, flagCanvas } from './render/flags.js';
import { setIalaRegion } from './data/passage.js';
import { menuMusic } from './menuMusic.js';
import { MenuScene } from './render/menuScene.js';

setIalaRegion(getSettings().iala);
refreshFullscreen();
applyUiScale();

// tło menu: ilustracja portu (SVG) jako pierwsze dziecko ekranu
window.__sceneryEl = () => sceneryEl();
function sceneryEl() {
  const d = document.createElement('div');
  d.innerHTML = sceneryHTML();
  return d.firstChild;
}
const icon = {
  book: '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 5c3-1.5 5.5-1.5 8 0v14c-2.5-1.5-5-1.5-8 0z" fill="#2f4468"/><path d="M20 5c-3-1.5-5.5-1.5-8 0v14c2.5-1.5 5-1.5 8 0z" fill="#d2695f"/></svg>',
  buoy: '<svg width="30" height="30" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="#e6dccf" stroke-width="5"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="#d2695f" stroke-width="5" stroke-dasharray="6.7 6.7"/></svg>',
  play: '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M8 5l12 7-12 7z" fill="#fff7f1"/></svg>',
  chev: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="#fff7f1" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  horn: '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 10h3l6-4v12l-6-4H4z" fill="#2f4468"/><path d="M16 8.5c1.6 1.6 1.6 5.4 0 7M18.5 6c3 3 3 9 0 12" fill="none" stroke="#d2695f" stroke-width="1.8" stroke-linecap="round"/></svg>',
  chartic: '<svg width="30" height="30" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="#2f4468" stroke-width="1.8"/><path d="M12 4.5l2.2 7.5L12 19.5 9.8 12z" fill="#d2695f"/><circle cx="12" cy="12" r="1.4" fill="#2f4468"/></svg>',
  bulb: '<svg width="30" height="30" viewBox="0 0 24 24"><circle cx="6" cy="14" r="2.6" fill="#d62828"/><circle cx="12" cy="7" r="2.6" fill="#f2c230"/><circle cx="18" cy="14" r="2.6" fill="#1f9d55"/><circle cx="12" cy="18.5" r="2.2" fill="#8aa0c0"/></svg>',
  dice: '<svg width="26" height="26" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="#d2695f" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.6" fill="#d2695f"/><circle cx="15.5" cy="15.5" r="1.6" fill="#d2695f"/><circle cx="15.5" cy="8.5" r="1.6" fill="#d2695f"/><circle cx="8.5" cy="15.5" r="1.6" fill="#d2695f"/></svg>',
  fast: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 5l8 7-8 7zM12 5l8 7-8 7z" fill="#3f8a72"/></svg>',
  help: '<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#2f4468" stroke-width="2"/><path d="M9.5 9.5a2.6 2.6 0 015 .8c0 1.8-2.5 2-2.5 3.7M12 17v.5" fill="none" stroke="#2f4468" stroke-width="2" stroke-linecap="round"/></svg>',
  power: '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 3v8" stroke="#b8453b" stroke-width="2.2" stroke-linecap="round"/><path d="M7.2 6.3a7.5 7.5 0 1 0 9.6 0" fill="none" stroke="#b8453b" stroke-width="2.2" stroke-linecap="round"/></svg>',
  gear: '<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="none" stroke="#2f4468" stroke-width="2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="#2f4468" stroke-width="2" stroke-linecap="round"/></svg>',
  anchor: '<svg width="34" height="34" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.2" fill="none" stroke="#d2695f" stroke-width="2"/><path d="M12 7.5V20M7.5 11h9M4.5 14.5c.6 3.2 3.7 5.5 7.5 5.5s6.9-2.3 7.5-5.5" fill="none" stroke="#d2695f" stroke-width="2" stroke-linecap="round"/></svg>',
  sail: '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M12 3v14M12 4c4 2.5 6 6 6.5 11H12zM11 6C8 8.5 6.5 11.5 6 15h5z" fill="#3f8a72" stroke="#3f8a72" stroke-width="1.2" stroke-linejoin="round"/><path d="M4 18.5h16l-2.2 3H6.2z" fill="#2f4468"/></svg>',
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

// ---------- Menu główne: scena 3D low-poly + kafle ----------
// monochromatyczne ikony kafli (białe, na fasetowanym „klejnocie”)
const GLYPH = {
  anchor: '<circle cx="12" cy="5" r="2.2"/><path d="M12 7.5V20M7.5 11h9M4.5 14.5c.6 3.2 3.7 5.5 7.5 5.5s6.9-2.3 7.5-5.5"/>',
  sail: '<path d="M12 3v14M12 4c4 2.5 6 6 6.5 11H12zM11 6C8 8.5 6.5 11.5 6 15h5z"/><path d="M4 18.5h16l-2.2 3H6.2z"/>',
  lights: '<path d="M9 21h6M10 18h4M8.5 9.5a3.5 3.5 0 017 0c0 2-1.5 3-1.5 5.5h-4C10 12.5 8.5 11.5 8.5 9.5z"/><path d="M3 9.5h2M19 9.5h2M5.5 3.5l1.4 1.4M18.5 3.5l-1.4 1.4"/>',
  horn: '<path d="M4 10h3l6-4v12l-6-4H4z"/><path d="M16 8.5c1.6 1.6 1.6 5.4 0 7M18.5 6c3 3 3 9 0 12"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="M12 5l2.2 7L12 19l-2.2-7z"/>',
  buoy: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.6"/><path d="M6 6l3.4 3.4M18 6l-3.4 3.4M6 18l3.4-3.4M18 18l-3.4-3.4"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.6" cy="8.6" r="1.1"/><circle cx="15.4" cy="15.4" r="1.1"/><circle cx="15.4" cy="8.6" r="1.1"/><circle cx="8.6" cy="15.4" r="1.1"/><circle cx="12" cy="12" r="1.1"/>',
  fast: '<path d="M4 6l7 6-7 6zM12 6l7 6-7 6z"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 014.8.8c0 1.8-2.4 2-2.4 3.6M12 16.8v.4"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  power: '<path d="M12 3v8"/><path d="M7.2 6.3a7.5 7.5 0 1 0 9.6 0"/>',
  back: '<path d="M15 5l-7 7 7 7"/>'
};
const glyph = (k, size = 24) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPH[k]}</svg>`;
// sześciokątny klejnot low-poly: 6 faset oświetlonych z lewej-góry
function gemHTML(k) {
  const pts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i - Math.PI / 2; return [32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30]; });
  const shade = [0.34, 0.08, -0.22, -0.3, -0.05, 0.22]; // jasność faset (+ biel, − czerń)
  const tris = pts.map((p, i) => { const q = pts[(i + 1) % 6], s = shade[i];
    return `<polygon points="32,32 ${p[0].toFixed(1)},${p[1].toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}" fill="${s > 0 ? '#fff' : '#000'}" fill-opacity="${Math.abs(s)}"/>`; }).join('');
  return `<svg class="gem" viewBox="0 0 64 64"><polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="var(--c)"/>${tris}` +
    `<polygon points="32,12 46,22 32,26 18,22" fill="#fff" fill-opacity="0.18"/></svg><span class="glyph">${glyph(k, 26)}</span>`;
}

let menuGL = null; // jedna scena 3D współdzielona przez kolejne ekrany menu
function menuBackdrop() {
  const host = h('div.m3-bg');
  try {
    if (!menuGL || menuGL._disposed) {
      const holder = h('div.m3-gl');
      menuGL = new MenuScene(holder);
    }
    host.appendChild(menuGL.el);
    requestAnimationFrame(() => menuGL && menuGL.resize());
  } catch (e) {
    menuGL = null;
    host.appendChild(sceneryEl()); // bez WebGL – ilustracja SVG
  }
  return host;
}

// items: { id, glyph, color, title, tag, desc, go, disabled }
function menuScreen({ kicker, items, sel = 0, back }) {
  app.innerHTML = '';
  let cur = Math.min(sel, items.length - 1);
  const heroTitle = h('h2.m3-title'), heroDesc = h('p.m3-desc'), heroGlyph = h('div.m3-hglyph');
  const goBtn = h('button.m3-go', { onclick: () => activate(cur) }, h('span', {}, 'Start'), raw(glyph('play', 18)));
  const tiles = items.map((it, i) => h('button.m3-tile', {
    class: it.disabled ? 'dis' : '', style: { animationDelay: `${0.05 * i + 0.1}s` },
    onmouseenter: () => select(i), onfocus: () => select(i), onclick: () => activate(i)
  },
  h('span.m3-num', {}, String(i + 1).padStart(2, '0')),
  h('div.m3-gem', {}, raw(gemHTML(it.glyph))),
  h('div.m3-tt', {}, it.title),
  h('div.m3-tg', {}, it.tag)));
  tiles.forEach((tl, i) => tl.style.setProperty('--c', items[i].color));
  function select(i) {
    cur = i;
    const it = items[i];
    tiles.forEach((tl, k) => tl.classList.toggle('on', k === i));
    heroTitle.textContent = it.title;
    heroDesc.textContent = it.disabled && it.disabledDesc ? it.disabledDesc : it.desc;
    heroGlyph.innerHTML = glyph(it.glyph, 22);
    heroGlyph.style.setProperty('--c', it.color);
    goBtn.disabled = !!it.disabled;
    goBtn.style.setProperty('--c', it.color);
    hero.classList.remove('swap'); void hero.offsetWidth; hero.classList.add('swap');
  }
  function activate(i) { const it = items[i]; if (it && !it.disabled) { document.removeEventListener('keydown', onKey); it.go(); } }
  const onKey = (e) => {
    if (!s.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select((cur + 1) % items.length); tiles[cur].focus({ preventScroll: true }); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select((cur + items.length - 1) % items.length); tiles[cur].focus({ preventScroll: true }); }
    else if (e.key === 'Enter' && !(document.activeElement instanceof HTMLButtonElement)) activate(cur);
    else if (e.key === 'Escape' && back) { document.removeEventListener('keydown', onKey); back.go(); }
  };
  document.addEventListener('keydown', onKey);
  const quit = window.moorme && window.moorme.quit;
  const hero = h('div.m3-hero', {},
    h('div.m3-logo', {}, 'Moor', h('span', {}, 'Me')),
    h('div.m3-kicker', {}, kicker),
    h('div.m3-card', {}, h('div.m3-head', {}, heroGlyph, heroTitle), heroDesc, goBtn));
  const s = h('div.screen.menu3d', {}, menuBackdrop(), h('div.m3-shade'),
    h('div.m3-top', {},
      back ? h('button.m3-chip', { onclick: () => { document.removeEventListener('keydown', onKey); back.go(); } }, raw(glyph('back', 18)), h('span', {}, back.label)) : h('div.m3-flags', {}, raw(signalFlagsHTML())),
      h('div.m3-sp'),
      h('button.m3-chip', { onclick: () => { document.removeEventListener('keydown', onKey); showSettings(() => (back ? showTitle() : showModeSelect())); } }, raw(glyph('gear', 18)), h('span', {}, 'Ustawienia')),
      quit ? h('button.m3-chip.quit', { onclick: () => window.moorme.quit(), title: 'Wyjdź z gry' }, raw(glyph('power', 18))) : null),
    hero,
    h('div.m3-tiles', {}, tiles),
    h('div.m3-hint', {}, h('kbd', {}, '←'), h('kbd', {}, '→'), h('span', {}, 'wybór'), h('kbd', {}, 'Enter'), h('span', {}, 'start')));
  app.appendChild(s);
  select(cur);
  return s;
}

// ---------- Ekran tytułowy (cumowanie) ----------
let titleSel = 0;
function showTitle() {
  menuMusic.start();
  const saved = !!loadConfig();
  const keep = (i, fn) => () => { titleSel = i; fn(); };
  menuScreen({
    kicker: 'Manewry portowe · cumowanie i odcumowanie', sel: titleSel,
    back: { label: 'Tryby', go: () => showModeSelect() },
    items: [
      { glyph: 'play', color: '#e0705f', title: 'Nowa symulacja', tag: 'jacht, keja i pogoda', desc: 'Symulator cumowania i odcumowywania jachtów żaglowych. Wiatr, dryf, zarzucanie rufy przez śrubę, stery strumieniowe, cumy, szpringi i muringi – przećwicz manewry portowe z załogą jachtu Anneliese zanim zrobisz je naprawdę.', go: keep(0, () => { config.random = false; showStep(0); }) },
      { glyph: 'dice', color: '#a76bd6', title: 'Random', tag: 'losowe zadanie', desc: 'Losowe zadanie w losowych warunkach', go: keep(1, () => showRandom()) },
      { glyph: 'fast', color: '#2aa39a', title: 'Szybki start', tag: 'ostatnie ustawienia', desc: 'Uruchom symulację z ostatnimi ustawieniami.', disabledDesc: 'Najpierw ustaw i uruchom symulację', disabled: !saved, go: keep(2, () => startSim()) },
      { glyph: 'help', color: '#5b78d6', title: 'Pomoc', tag: 'sterowanie i cumy', desc: 'Pomoc – sterowanie i praca na cumach', go: keep(3, () => showHelp()) }
    ]
  });
}

// ---------- Wybór trybu (okno startowe) ----------
let modeSel = 0;
function showModeSelect() {
  menuMusic.start();
  const keep = (i, fn) => () => { modeSel = i; fn(); };
  menuScreen({
    kicker: 'Symulator żeglarski', sel: modeSel,
    items: [
      { glyph: 'anchor', color: '#e0705f', title: 'Manewry portowe', tag: 'keja, cumy, muringi', desc: 'Cumowanie i odcumowywanie łodzi.', go: keep(0, () => showTitle()) },
      { glyph: 'sail', color: '#2aa39a', title: 'Locja', tag: 'waypointy i znaki IALA', desc: 'Pławy, stawy oraz światła elementów nawigacyjnych.', go: keep(1, () => showSailIntro()) },
      { glyph: 'lights', color: '#6a6fd6', title: 'Rozpoznawanie statków', tag: 'światła i znaki dzienne', desc: 'Rozpoznaj statek po jego światłach lub znakach dziennych.', go: keep(2, () => showLightsIntro()) },
      { glyph: 'horn', color: '#e0a33a', title: 'Sygnały dźwiękowe', tag: 'buczki, dzwony, mgła', desc: 'Rozpoznaj zamiary statku po dźwiękach, jakie wydaje.', go: keep(3, () => showSoundsIntro()) },
      { glyph: 'compass', color: '#4f9d5c', title: 'Zadania nawigacyjne', tag: 'kursy, namiary, prąd', desc: 'Trenuj obliczanie i przeliczanie kursów, obliczanie pozycji z namiarów itp.', go: keep(4, () => { menuMusic.stop(); showNavTasks(app, { onExit: () => showModeSelect() }); }) },
      { glyph: 'buoy', color: '#d8484a', title: 'Bezpieczeństwo', tag: 'EPIRB, VHF, MAYDAY', desc: 'Elementy mające na celu zapewnienie bezpieczeństwa żeglugi.', go: keep(5, () => { menuMusic.stop(); showSafety(app, { onExit: () => showModeSelect() }); }) }
    ]
  });
}

// ---------- Trening albo nauka (podręczniki) ----------
function showLightsIntro() {
  menuMusic.start();
  showTrainOrLearn(app, { title: 'Rozpoznawanie świateł i znaków dziennych', sceneryEl, icons: { train: raw(icon.bulb), learn: raw(icon.book) },
    desc: { train: 'Noc albo dzień na morzu: rozpoznawaj jednostki po światłach i znakach dziennych, określ, którą stronę widzisz i jak przejdą.', learn: 'Podręcznik: sektory świateł, światła nocne wszystkich jednostek z czterech stron i znaki dzienne.' },
    onTrain: () => showLightsSetup(), onLearn: () => showLightsBook(), onExit: () => showModeSelect() });
}
function showLightsBook() {
  menuMusic.start();
  showHandbook(app, { title: 'podręcznik – światła i znaki dzienne', sections: lightsBook(), sceneryEl, onExit: () => showLightsIntro(), onTrain: () => showLightsSetup() });
}
function showSoundsIntro() {
  menuMusic.start();
  showTrainOrLearn(app, { title: 'Sygnały dźwiękowe', sceneryEl, icons: { train: raw(icon.horn), learn: raw(icon.book) },
    desc: { train: 'Z łodzi na morzu słuchasz buczków, dzwonów i gongów statków – w dobrej widoczności i we mgle – i rozpoznajesz ich znaczenie.', learn: 'Podręcznik: wszystkie sygnały manewrowe, ostrzegawcze i mgłowe z zapisem, osią czasu i odsłuchem.' },
    onTrain: () => showSoundsSetup(), onLearn: () => showSoundsBook(), onExit: () => showModeSelect() });
}
function showSoundsBook() {
  menuMusic.stop(0.6);
  const audio = new ShipAudio();
  const close = () => { audio.stop(); if (audio.ctx) audio.ctx.close(); };
  showHandbook(app, { title: 'podręcznik – sygnały dźwiękowe', sections: soundsBook((p) => audio.play(p)), sceneryEl, onExit: () => { close(); showSoundsIntro(); }, onTrain: () => { close(); showSoundsSetup(); } });
}
function showSailIntro() {
  menuMusic.start();
  showTrainOrLearn(app, { title: 'Rejs wzdłuż wybrzeża', sceneryEl, icons: { train: raw(icon.sail), learn: raw(icon.book) },
    desc: { train: 'Płyń wzdłuż wybrzeża do portu: rozpoznawaj znaki nawigacyjne i mijaj je z właściwej strony, w dzień i w nocy.', learn: 'Podręcznik oznakowania IALA: znaki boczne, kardynalne, odosobnionego niebezpieczeństwa, wody bezpiecznej, specjalne i wraki – kształty, znaki szczytowe i światła.' },
    onTrain: () => showPassageSetup(), onLearn: () => showMarksBook(), onExit: () => showModeSelect() });
}
function showMarksBook() {
  menuMusic.start();
  showHandbook(app, { title: 'podręcznik – oznakowanie nawigacyjne IALA', sections: marksBook(), sceneryEl, onExit: () => showSailIntro(), onTrain: () => showPassageSetup() });
}

// ---------- Rejs: ustawienia ----------
const PASSAGE_KEY = 'moorme.passage.v1';
function loadPassageCfg() {
  try {
    const s = JSON.parse(localStorage.getItem(PASSAGE_KEY));
    if (s && PASSAGES[s.passageId] && BOATS[s.boatId]) return s;
  } catch (e) { /* brak zapisu */ }
  return null;
}
let passageCfg = loadPassageCfg() || { passageId: 'baltic', boatId: 'C34', weather: { ...PASSAGES.baltic.weather } };

function showPassageSetup() {
  menuMusic.start();
  if (!passageCfg.seed) passageCfg.seed = 1 + Math.floor(Math.random() * 1e9); // układ znaków i trasy jest losowany przy każdym rejsie
  const cfg = passageCfg;
  const w = cfg.weather;
  app.innerHTML = '';
  const cards = h('div.passage-cards');
  const drawCards = () => {
    cards.innerHTML = '';
    for (const P of Object.values(PASSAGES)) {
      const H = buildPassage(P.id, cfg.seed);
      const cv = h('canvas', { width: 640, height: 190, style: { width: '100%', borderRadius: '10px', display: 'block' } });
      const R = H.route, xs = R.map((p) => p.x), zs = R.map((p) => p.z);
      const fake = { H, route: R, marks: H.marks.map((m) => ({ ...m, state: 'pending' })), boat: { x: R[0].x, z: R[0].z, th: 0, speed: 0, vx: 0, vz: 0 }, next: 1, blind: (cfg.assist || 'bearing') === 'bearing' };
      const cxm = (Math.min(...xs) + Math.max(...xs)) / 2, czm = (Math.min(...zs) + Math.max(...zs)) / 2;
      const range = Math.max((Math.max(...xs) - Math.min(...xs)) * 1.12, (Math.max(...zs) - Math.min(...zs)) * 1.12 * (640 / 190));
      drawChart(cv.getContext('2d'), 640, 190, { cx: cxm, cz: czm, scale: 640 / range, headUp: false, world: fake, labels: false });
      cards.appendChild(h('div.card', { class: cfg.passageId === P.id ? 'selected' : '', onclick: () => { if (cfg.passageId !== P.id) { cfg.passageId = P.id; Object.assign(w, PASSAGES[P.id].weather); } showPassageSetup(); } },
        h('h3', {}, P.name), cv,
        h('div.small.muted', { style: { margin: '8px 0 6px' } }, P.desc),
        h('div', {}, h('span.chip', {}, `${(routeLength(R) / 1852).toFixed(1)} nm`), ...((cfg.assist || 'bearing') === 'bearing' ? [] : [h('span.chip', {}, `${R.length - 1} waypointów`), h('span.chip', {}, `${H.marks.length} znaków`)]), h('span.chip.lvl', {}, P.difficulty > 1 ? 'trudniejszy' : 'łatwiejszy'))));
    }
  };
  drawCards();

  const slider = (min, max, step, val, fmt, on) => {
    const out = h('b', {}, fmt(val));
    const inp = h('input', { type: 'range', min, max, step, value: val });
    inp.addEventListener('input', () => { on(+inp.value); out.textContent = fmt(+inp.value); });
    return h('div.row', {}, inp, out);
  };
  const fmtH = (hh) => `${String(Math.floor(hh)).padStart(2, '0')}:${String(Math.round((hh % 1) * 60)).padStart(2, '0')}${hh < 5 || hh > 21 ? ' (noc)' : hh < 7.5 ? ' (świt)' : hh > 18.5 ? ' (zmierzch)' : ''}`;
  const assistSeg = seg([{ value: 'bearing', label: '🧭 Tylko BRG na port' }, { value: 'full', label: '🗺 Trasa i waypointy' }], cfg.assist || 'bearing', (v) => { cfg.assist = v; showPassageSetup(); });
  const boatSeg = seg(Object.values(BOATS).map((b) => ({ value: b.id, label: `${b.name} (${b.loa.toFixed(1)} m)` })), cfg.boatId, (v) => { cfg.boatId = v; });
  const body = h('div', {},
    h('h2', { style: { marginBottom: '10px' } }, 'Wybierz akwen i trasę'),
    cards,
    h('div.two-col', { style: { marginTop: '18px' } },
      h('div.panel', {}, h('h2', {}, 'Jacht'), boatSeg,
        h('h2', { style: { marginTop: '14px' } }, 'Nawigacja'), assistSeg,
        h('div.hint', {}, (cfg.assist || 'bearing') === 'bearing' ? 'Znasz tylko kurs (BRG) i odległość do portu. Trasy, waypointów ani nazw znaków nie widać – boje rozpoznajesz po kształcie i charakterze światła i sam decydujesz, z której strony je minąć.' : 'Na kartplotterze i w widoku 3D widać trasę z waypointami oraz nazwy znaków.'),
        h('div.hint', {}, 'W rejsie jacht płynie na silniku. Kurs trzymasz sterem, a prędkość regulujesz manetką; możesz użyć autopilota do utrzymania kursu. Dla ułatwienia przyspieszaj czas (2×–8×) na długich odcinkach.')),
      h('div.panel', {}, h('h2', {}, 'Pogoda'),
        h('div.field', {}, h('label', {}, 'Siła wiatru'), slider(0, 30, 1, w.windKn, (v) => `${v} kn`, (v) => { w.windKn = v; })),
        h('div.field', {}, h('label', {}, 'Kierunek wiatru (skąd wieje)'), slider(0, 355, 5, w.windFrom, (v) => `${v}°`, (v) => { w.windFrom = v; })),
        h('div.field', {}, h('label', {}, 'Porywistość'), slider(0, 1, 0.05, w.gust, (v) => `${Math.round(v * 100)}%`, (v) => { w.gust = v; })),
        h('div.field', {}, h('label', {}, 'Prąd'), slider(0, 2, 0.1, w.currentKn || 0, (v) => `${v.toFixed(1)} kn`, (v) => { w.currentKn = v; w.currentTo = 90; })),
        h('div.field', {}, h('label', {}, 'Pora dnia'), seg([{ value: 11, label: '☀ Dzień' }, { value: 19.3, label: '🌇 Zmierzch' }, { value: 23.5, label: '🌙 Noc – widać tylko światła' }], [11, 19.3, 23.5].includes(w.hour) ? w.hour : null, (v) => { w.hour = v; showPassageSetup(); }), slider(0, 23.75, 0.25, w.hour, fmtH, (v) => { w.hour = v; })),
        h('div.field', {}, h('label', {}, 'Niebo'), seg([{ value: 'clear', label: '☀ Słonecznie' }, { value: 'cloudy', label: '☁ Pochmurno' }, { value: 'rain', label: '🌧 Deszcz' }, { value: 'fog', label: '🌫 Mgła' }], w.sky || 'clear', (v) => { w.sky = v; })))));
  app.appendChild(h('div.screen', {}, sceneryEl(),
    h('div.screen-header', {}, h('div.logo', {}, 'Moor', h('span', {}, 'Me')), h('div.muted', {}, 'rejs wzdłuż wybrzeża')),
    h('div.screen-body', {}, body),
    h('div.screen-footer', {}, h('button.btn', { onclick: () => { savePassageCfg(); showModeSelect(); } }, '← Tryby'), h('button.btn.primary.big', { onclick: () => startPassage() }, '⛵ Wypłyń'))));
}

function savePassageCfg() {
  try { localStorage.setItem(PASSAGE_KEY, JSON.stringify({ ...passageCfg, seed: null })); } catch (e) { /* ignoruj */ }
}

function showLightsSetup() {
  menuMusic.start();
  app.innerHTML = '';
  const card = (cls, title, text, onclick) => h('button.mode-card' + cls, { onclick }, h('h3', {}, title), h('p', {}, text));
  app.appendChild(h('div.screen.title-screen', {}, sceneryEl(),
    h('div.title-card', { style: { width: 'min(820px, 94vw)' } },
      h('div.title-flags', {}, h('div.fl', {}, raw(signalFlagsHTML())), h('div.tag', {}, 'ROZPOZNAWANIE ŚWIATEŁ')),
      h('p.desc', {}, 'Wybierz porę: nocą statki rozpoznajesz po światłach, w dzień – po czarnych znakach dziennych.'),
      h('div.field', { style: { margin: '0 0 12px' } }, h('label', {}, 'Przepisy'), seg([{ value: 'sea', label: '🌊 Morze (MPZZM / COLREG)' }, { value: 'all', label: '🌊 + 🏞 Morze i drogi śródlądowe (CEVNI)' }], getSettings().lightsScope || 'all', (v) => saveSettings({ lightsScope: v }))),
      h('div.mode-cards', { style: { gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))' } },
        card('.lights', '🌙 Noc – światła', 'Światła masztowe, burtowe, rufowe i dookólne: rozpoznaj typ statku, co robi, którą stronę widzisz i z której strony ma sieci.', () => startLights(false)),
        card('.sail', '☀ Dzień – znaki dzienne', 'Czarne kule, stożki, romby i walec na masztach statków widocznych jako ciemne sylwetki.', () => startLights(true))),
      h('div.tbtn-row', {}, h('button.btn', { onclick: () => showModeSelect() }, '← Tryby')))));
}

function showSoundsSetup() {
  menuMusic.start();
  app.innerHTML = '';
  const card = (cls, ic, title, text, ctxs) => h('button.mode-card' + cls, { onclick: () => startSounds(ctxs) }, h('div.mc-ic', {}, raw(ic)), h('h3', {}, title), h('p', {}, text));
  app.appendChild(h('div.screen.title-screen', {}, sceneryEl(),
    h('div.title-card', { style: { width: 'min(1060px, 96vw)' } },
      h('div.big-logo', {}, 'Moor', h('span', {}, 'Me')),
      h('p.desc', {}, 'Które sygnały ćwiczysz?'),
      h('div.mode-cards', {},
        card('.sail', icon.horn, 'Morze (MPZZM / COLREG)', 'Sygnały manewrowe i ostrzegawcze, sygnały we mgle i wzywanie pomocy na morzu.', ['sight', 'fog']),
        card('.nav', icon.horn, 'Drogi śródlądowe (CEVNI)', 'Sygnały na rzekach, kanałach i jeziorach – m.in. „uwaga”, „nie mogę manewrować”, zawracanie.', ['inland']),
        card('.lights', icon.horn, 'Wszystkie', 'Morze i drogi śródlądowe razem – przy każdym sygnale widać, którego zestawu dotyczy.', ['sight', 'fog', 'inland'])),
      h('div.tbtn-row', {}, h('button.btn', { onclick: () => showSoundsIntro() }, '← Wstecz')))));
}

function startSounds(ctxs = ['sight', 'fog', 'inland']) {
  menuMusic.stop();
  app.innerHTML = '';
  const root = h('div', { style: { position: 'absolute', inset: 0 } });
  app.appendChild(root);
  const equip = defaultEquipment(BOATS.C34);
  equip.bowThruster = 'none'; equip.sternThruster = false;
  const config = { mode: 'sounds', boatId: 'C34', equip, day: true, ctxs, weather: { windKn: 5, windFrom: 250, gust: 0.1, currentKn: 0, currentTo: 90, hour: 12, sky: 'clear' } };
  window.__sim = new SoundsScreen(root, config, { restart: () => startSounds(ctxs), exit: () => showSoundsIntro() });
}

function startLights(day = false) {
  menuMusic.stop();
  app.innerHTML = '';
  const root = h('div', { style: { position: 'absolute', inset: 0 } });
  app.appendChild(root);
  const equip = defaultEquipment(BOATS.C34);
  equip.bowThruster = 'none'; equip.sternThruster = false;
  const config = { mode: 'lights', boatId: 'C34', equip, day, scope: getSettings().lightsScope || 'all', weather: day ? { windKn: 7, windFrom: 250, gust: 0.15, currentKn: 0, currentTo: 90, hour: 13, sky: 'clear' } : { windKn: 7, windFrom: 250, gust: 0.15, currentKn: 0, currentTo: 90, hour: 23.5, sky: 'clear', blackSky: true } };
  window.__sim = new LightsScreen(root, config, { restart: () => startLights(day), exit: () => showLightsSetup() });
}

function startPassage(seed) {
  menuMusic.stop();
  const sd = seed || passageCfg.seed || 1 + Math.floor(Math.random() * 1e9);
  passageCfg.seed = null;
  savePassageCfg();
  app.innerHTML = '';
  const root = h('div', { style: { position: 'absolute', inset: 0 } });
  app.appendChild(root);
  const spec = BOATS[passageCfg.boatId];
  const equip = defaultEquipment(spec);
  equip.bowThruster = 'none'; equip.sternThruster = false;
  const config = { mode: 'passage', seed: sd, assist: passageCfg.assist || 'bearing', passageId: passageCfg.passageId, boatId: passageCfg.boatId, equip, weather: { currentTo: 90, currentKn: 0, ...passageCfg.weather } };
  window.__sim = new PassageScreen(root, config, { restart: () => startPassage(sd), exit: () => showPassageSetup() });
}

// ---------- Język i ustawienia ----------
function chooseLang(id) {
  setLang(id);
  location.reload();
}

function langButtons() {
  const cur = hasSavedLang() ? getLang() : null;
  return h('div.tbtn-row', {}, LANGS.map((l) => h('button.tbtn.sec' + (cur === l.id ? '.rnd' : ''), { onclick: () => chooseLang(l.id) }, h('span', {}, l.name, cur === l.id ? h('small', {}, '✓') : null))));
}

// pierwsze uruchomienie: wybór języka i systemu oznakowania IALA (napisy dwujęzyczne, więc bez tłumaczenia DOM)
function showLangPicker() {
  menuMusic.start();
  const sel = { lang: getLang(), iala: getSettings().iala || 'A' };
  const can = (c) => `<svg width="34" height="44" viewBox="0 0 34 44"><rect x="7" y="6" width="20" height="26" rx="2" fill="${c}"/><rect x="4" y="30" width="26" height="8" rx="2" fill="${c}"/><rect x="15" y="0" width="4" height="7" fill="#333"/></svg>`;
  const cone = (c) => `<svg width="34" height="44" viewBox="0 0 34 44"><polygon points="17,4 30,32 4,32" fill="${c}"/><rect x="4" y="30" width="26" height="8" rx="2" fill="${c}"/></svg>`;
  const render = () => {
    app.innerHTML = '';
    const langRow = h('div.tbtn-row', {}, LANGS.map((l) => h('button.tbtn.sec' + (sel.lang === l.id ? '.rnd' : ''), { onclick: () => { sel.lang = l.id; render(); } }, h('span', {}, l.name, sel.lang === l.id ? h('small', {}, '✓') : null))));
    const ialaBtn = (id, red, green, region) => h('button.tbtn.sec.iala-btn' + (sel.iala === id ? '.rnd' : ''), { onclick: () => { sel.iala = id; render(); } },
      h('span.iala-ic', {}, raw((id === 'A' ? can('#d62828') + cone('#1f9d55') : can('#1f9d55') + cone('#d62828')))),
      h('span', {}, `IALA ${id}`, h('small', {}, region)), sel.iala === id ? h('small.iala-ok', {}, '✓') : null);
    app.appendChild(h('div.screen.title-screen', {}, sceneryEl(),
      h('div.title-card.first-run', {},
        h('div.big-logo', {}, 'Moor', h('span', {}, 'Me')),
        h('p.desc', {}, 'Wybierz język / Choose your language'),
        langRow,
        h('p.desc', { style: { marginTop: '18px' } }, 'System oznakowania / Buoyage system'),
        h('div.tbtn-row', {},
          ialaBtn('A', 'red', 'green', 'Europa, Afryka, Azja, Australia / Europe, Africa, Asia, Australia'),
          ialaBtn('B', 'green', 'red', 'Ameryki, Japonia, Korea, Filipiny / Americas, Japan, Korea, Philippines')),
        h('div.tbtn-row', { style: { marginTop: '18px' } }, h('button.tbtn.main', { onclick: () => { saveSettings({ iala: sel.iala }); setLang(sel.lang); location.reload(); } }, h('span', {}, 'Dalej / Continue'), h('span.ic', {}, raw(icon.chev)))),
        h('div.title-note', {}, h('span', {}, 'Oba ustawienia zmienisz później w Ustawieniach. / You can change both later in Settings.')))));
  };
  render();
}

const COUNTRY = { DE: 'Niemcy', PL: 'Polska', NL: 'Holandia', FR: 'Francja', IT: 'Włochy', BE: 'Belgia', IE: 'Irlandia', ES: 'Hiszpania', PT: 'Portugalia', HR: 'Chorwacja', LT: 'Litwa', LV: 'Łotwa', EE: 'Estonia', BG: 'Bułgaria', RO: 'Rumunia', UA: 'Ukraina', MT: 'Malta', SE: 'Szwecja', DK: 'Dania', NO: 'Norwegia', FI: 'Finlandia', IS: 'Islandia', GR: 'Grecja', GB: 'Wielka Brytania' };

function showSettings(back = () => showModeSelect()) {
  menuMusic.start();
  const st = getSettings();
  app.innerHTML = '';
  const row = (label, ...ctl) => h('div.set-row', {}, h('label', {}, label), h('div.set-ctl', {}, ...ctl));
  const text = (val, on, opts = {}) => h('input.set-in', { type: 'text', value: val || '', maxlength: opts.max || 18, placeholder: opts.ph || '', oninput: (e) => on(e.target.value) });
  const segRow = (opts, val, on) => seg(opts.map(([value, label]) => ({ value, label })), val, on);
  const rerender = () => showSettings(back);

  // jacht i załoga
  const flagPrev = h('span.set-flag', {}, flagCanvas(st.flag, 42, 28));
  const flagSel = h('select.set-in', { onchange: (e) => { const code = e.target.value; const ports = FLAGS[code].ports; const keepPort = Object.values(FLAGS).every((f) => !f.ports.includes(getSettings().homePort)); saveSettings({ flag: code, homePort: keepPort ? getSettings().homePort : ports[0] }); rerender(); } },
    ...FLAG_CODES.map((c) => h('option', { value: c, selected: c === st.flag ? true : null }, `${t(COUNTRY[c] || c)} (${c})`)));
  const boat = h('div.help-card.set-card', {},
    h('h2', {}, 'Jacht i załoga'),
    row('Nazwa jachtu', text(st.boatName, (v) => saveSettings({ boatName: v.toUpperCase() }), { max: 18 })),
    row('Port macierzysty', text(st.homePort, (v) => saveSettings({ homePort: v }), { max: 18 })),
    row('Bandera', flagPrev, flagSel),
    row('Znak wywoławczy', text(st.callsign, (v) => saveSettings({ callsign: v.toUpperCase() }), { max: 8 })),
    row('MMSI', text(st.mmsi, (v) => saveSettings({ mmsi: v.replace(/\D/g, '').slice(0, 9) }), { max: 9 })),
    row('Kapitan', text(st.captain, (v) => saveSettings({ captain: v }), { max: 14 })),
    ...[0, 1, 2].map((k) => row(`Załoga ${k + 1}`, text(st.crew[k], (v) => { const c = [...getSettings().crew]; c[k] = v; saveSettings({ crew: c }); }, { max: 14, ph: t('losowo') }))),
    h('p.small.muted', {}, 'Puste pole – imię zostanie wylosowane. Zmiany obowiązują od następnej symulacji.'));

  // oznakowanie
  const iala = h('div.help-card.set-card', {},
    h('h2', {}, 'Oznakowanie nawigacyjne'),
    row('System IALA', segRow([['A', 'IALA A'], ['B', 'IALA B']], st.iala || 'A', (v) => { saveSettings({ iala: v }); setIalaRegion(v); rerender(); })),
    h('p.small.muted', {}, (st.iala || 'A') === 'B'
      ? 'Region B (obie Ameryki, Japonia, Korea, Filipiny): znak lewy – zielona beczka, znak prawy – czerwony stożek.'
      : 'Region A (Europa, Afryka, Australia, większość Azji): znak lewy – czerwona beczka, znak prawy – zielony stożek.'));

  // grafika
  const g = st.gfx;
  const setG = (patch) => { saveSettings({ gfx: { ...patch, preset: 'custom' } }); rerender(); };
  const scaleOut = h('b', {}, `${Math.round((g.scale || 1) * 100)}%`);
  const scaleIn = h('input', { type: 'range', min: 0.5, max: 1, step: 0.05, value: g.scale || 1, oninput: (e) => { scaleOut.textContent = `${Math.round(e.target.value * 100)}%`; }, onchange: (e) => setG({ scale: +e.target.value }) });
  const gfx = h('div.help-card.set-card', {},
    h('h2', {}, 'Grafika'),
    row('Jakość', segRow([['high', 'Wysoka'], ['medium', 'Średnia'], ['low', 'Niska (starsze komputery)'], ['custom', 'Własna']], g.preset, (v) => { if (GFX_PRESETS[v]) setGfxPreset(v); else saveSettings({ gfx: { preset: 'custom' } }); rerender(); })),
    row('Rozdzielczość renderowania', h('div.set-range', {}, scaleIn, scaleOut)),
    row('Cienie', segRow([['soft', 'Miękkie'], ['basic', 'Proste'], ['off', 'Wyłączone']], g.shadows, (v) => setG({ shadows: v }))),
    row('Wygładzanie krawędzi', segRow([['on', 'Wł.'], ['off', 'Wył.']], g.antialias ? 'on' : 'off', (v) => setG({ antialias: v === 'on' }))),
    row('Szczegóły wody', segRow([['high', 'Wysokie'], ['medium', 'Średnie'], ['low', 'Niskie']], g.water, (v) => setG({ water: v }))),
    row('Limit klatek', segRow([[60, '60 kl./s'], [30, '30 kl./s']], g.fps, (v) => setG({ fps: v }))),
    row('Licznik FPS', segRow([['on', 'Pokaż'], ['off', 'Ukryj']], g.showFps ? 'on' : 'off', (v) => { saveSettings({ gfx: { showFps: v === 'on' } }); rerender(); })),
    h('p.small.muted', {}, 'Na starszym komputerze wybierz „Niska”: mniejsza rozdzielczość, bez cieni i wygładzania, prostsza woda i 30 klatek na sekundę. Zmiany działają od następnej symulacji.'));

  // dźwięk
  const musOut = h('b', {}, `${Math.round((st.musicVol ?? 0.5) * 100)}%`);
  const sound = h('div.help-card.set-card', {},
    h('h2', {}, 'Dźwięk'),
    row('Muzyka w menu', segRow([['on', 'Wł.'], ['off', 'Wył.']], st.music === false ? 'off' : 'on', (v) => { saveSettings({ music: v === 'on' }); menuMusic.refresh(); rerender(); })),
    row('Głośność muzyki', h('div.set-range', {}, h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st.musicVol ?? 0.5, oninput: (e) => { musOut.textContent = `${Math.round(e.target.value * 100)}%`; saveSettings({ musicVol: +e.target.value }); menuMusic.refresh(); } }), musOut)));

  // ekran (stan pełnego ekranu odczytany z okna – mógł się zmienić klawiszem F11)
  const fsLabel = (on) => t(on ? '⛶ Wyłącz pełny ekran' : '⛶ Włącz pełny ekran');
  const fsBtn = h('button.btn', { onclick: async () => { await toggleFullscreen(); setTimeout(async () => { fsBtn.textContent = fsLabel(await refreshFullscreen()); }, 400); } }, fsLabel(isFullscreen()));
  refreshFullscreen().then((on) => { fsBtn.textContent = fsLabel(on); });
  const screen = h('div.help-card.set-card', {},
    h('h2', {}, 'Ekran'),
    row('Pełny ekran', fsBtn, h('span.small.muted', { style: { marginLeft: '10px' } }, 'albo klawisz F11')),
    window.moorme ? row('Skala interfejsu', segRow([['auto', 'Automatyczna'], ['1', '100%'], ['1.25', '125%'], ['1.5', '150%'], ['1.75', '175%']], String(st.uiScale || 'auto'), (v) => { saveSettings({ uiScale: v }); applyUiScale(); rerender(); })) : null,
    window.moorme ? h('p.small.muted', {}, 'Automatyczna skala powiększa interfejs na dużych ekranach i w trybie pełnoekranowym.') : null);

  app.appendChild(h('div.screen.settings', {}, sceneryEl(),
    h('div.screen-header', {}, h('div.logo', {}, 'Moor', h('span', {}, 'Me')), h('div.muted', {}, 'Ustawienia')),
    h('div.screen-body', {}, h('div.set-wrap', {},
      h('div.help-card.set-card', {}, h('h2', { style: { marginBottom: '8px' } }, 'Język / Language'), langButtons()),
      boat, iala, gfx, sound, screen)),
    h('div.screen-footer', {}, h('button.btn', { onclick: () => back() }, '← Menu'), h('span'))));
}

// ---------- Pomoc ----------
function showHelp() {
  menuMusic.start();
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
    ctx.fillText(t('Twoje stanowisko: „TU” (zielone)'), 14, mapCv.height - 14);
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
      ctx.fillText(t('START'), px + 14, pz - 12);
    }
    ctx.fillStyle = '#fff'; ctx.font = '13px Segoe UI';
    ctx.fillText(t(config.scenario === 'moor' ? 'Kliknij, aby ustawić start. Przeciągnij, aby ustawić kurs.' : 'Odcumowanie – start ze stanowiska (zielone).'), 14, mapCv.height - 14);
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
  menuMusic.start();
  saveConfig(config);
  [stepBoat, stepEquipment, stepHarbor, stepWeather][i]();
}

function startSim() {
  menuMusic.stop();
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
  menuMusic.start();
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
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Segoe UI'; ctx.fillText(t('START'), px + 12, pz - 10);
  }
}

window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
});

installDomTranslator(document.body);
document.documentElement.lang = getLang();
document.title = t('MoorMe – symulator cumowania');
// test dymny (CI) pomija wybór języka
if (!hasSavedLang() && !location.search.includes('smoke')) showLangPicker(); else if (location.search.includes('smoke')) showTitle(); else showModeSelect();
