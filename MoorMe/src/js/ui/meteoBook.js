// Podręcznik działu „Meteorologia”: ciśnienie i wiatr, skala Beauforta (z widokami morza 3D), atlas chmur, niże, wyże i fronty,
// mapa synoptyczna, barometr, zjawiska lokalne i prognozy dla żeglarzy.
import { h } from './dom.js';
import { MeteoScene } from '../render/meteoScene.js';
import { synopticSVG, mapLegendSVG, barographSVG, phenSVG, seaStatePict, barbSVG } from './meteoFigs.js';
import { beaufort, clouds, windAt, knToBft, toXY, MAP, makeSynoptic, frontZone, seaSpots, makeBaroQuestion } from '../data/meteo.js';
import { getLang } from '../i18n.js';

const L = (pl, en) => (getLang() === 'en' ? en : pl);
const svgBox = (html, cls = 'mb-fig') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };
const P = (...t) => h('p', {}, ...t);
const isFig = (k) => k && k.classList && (k.classList.contains('mb-fig') || k.classList.contains('mb-row'));
// lekcja: tytuł, rysunki po prawej (szerokie – nad tekstem), tekst i tabele po lewej
const entry = (title, ...kids) => {
  kids = kids.filter(Boolean);
  const wide = kids.filter((k) => isFig(k) && (k.classList.contains('wide') || k.classList.contains('mb-row') || k.classList.contains('mb-map'))), figs = kids.filter((k) => isFig(k) && !wide.includes(k)), text = kids.filter((k) => !isFig(k));
  if (!title && !figs.length && !wide.length) return h('section.nb-lesson.mb-lead', {}, ...text);
  return h('section.nb-lesson', {}, title ? h('h3', {}, title) : null, ...wide,
    h('div.nb-cols', { class: figs.length ? 'has-fig' : '' }, h('div.nb-text', {}, ...text), figs.length ? h('div.nb-figcol', {}, ...figs) : null));
};
const tip = (...t) => h('div.nb-example', {}, h('div.nb-tag', {}, L('W praktyce', 'In practice')), h('p', {}, ...t));
const warn = (...t) => h('div.nb-note', {}, h('div.nb-tag', {}, L('Uwaga', 'Caution')), h('p', {}, ...t));
const table = (head, rows) => h('div.hb-ct-wrap', {}, h('table.hb-ctable', {}, h('tr', {}, ...head.map((x) => h('th', {}, x))), ...rows.map((r) => h('tr', {}, ...r.map((c) => h('td', {}, c))))));

// ---------- miniatury 3D (renderowane raz, w tle, kolejno w kolejnych klatkach) ----------
const THUMBS = new Map();
const queue = [];
let thumbScene = null, thumbHost = null, busy = false;
function thumb(key, weather, view) {
  const img = h('img.mb-thumb', { alt: '' });
  if (THUMBS.has(key)) { img.src = THUMBS.get(key); return img; }
  queue.push({ key, weather, view, img });
  if (!busy) { busy = true; requestAnimationFrame(pump); }
  return img;
}
function pump() {
  const job = queue.shift();
  if (!job) { if (thumbScene) { thumbScene.destroy(); thumbHost.remove(); thumbScene = null; } busy = false; return; }
  try {
    if (!thumbScene) {
      thumbHost = h('div', { style: { position: 'fixed', left: '-10000px', top: '0', width: '480px', height: '270px' } });
      document.body.appendChild(thumbHost);
      thumbScene = new MeteoScene(thumbHost, { manual: true, capture: true });
      thumbScene.resize();
    }
    if (!THUMBS.has(job.key)) {
      thumbScene.setWeather(job.weather); thumbScene.setView(job.view);
      if (job.view === 'orbit') Object.assign(thumbScene.cam, { az: 2.3, el: 0.13, dist: 25 });
      for (let i = 0; i < 6; i++) thumbScene.update(0.2);
      THUMBS.set(job.key, thumbScene.snapshot(480, 270));
    }
    job.img.src = THUMBS.get(job.key);
    for (const j of queue.filter((q) => q.key === job.key)) j.img.src = THUMBS.get(job.key);
  } catch (e) { /* bez WebGL – zostają piktogramy */ queue.length = 0; }
  requestAnimationFrame(pump);
}

// ---------- podgląd 3D na żywo ----------
function open3D(weather, view, caption) {
  let scene = null;
  const host = h('div.mb-3d-view');
  const close = () => { document.removeEventListener('keydown', onKey); if (scene) scene.destroy(); back.remove(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const back = h('div.mb-3d', { onclick: (e) => { if (e.target === back) close(); } },
    h('div.mb-3d-box', {}, host,
      h('div.mb-3d-cap', {}, h('b', {}, caption), h('span.muted', {}, L('  ·  przeciągnij – rozglądanie się, kółko – przybliżenie', '  ·  drag to look around, wheel to zoom'))),
      h('div.mb-3d-btns', {},
        h('button.btn.sm', { onclick: () => scene && scene.setView('orbit') }, L('⛵ Jacht', '⛵ Yacht')),
        h('button.btn.sm', { onclick: () => scene && scene.setView('sky') }, L('☁ Niebo', '☁ Sky')),
        h('button.btn.sm', { onclick: close }, '✕'))));
  document.body.appendChild(back);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => { try { scene = new MeteoScene(host, { weather }); scene.setView(view); } catch (e) { host.textContent = L('Podgląd 3D wymaga WebGL.', '3D preview needs WebGL.'); } });
}
const see3D = (weather, view, caption) => h('button.btn.sm.mb-3dbtn', { onclick: () => open3D(weather, view, caption) }, L('▶ Zobacz w 3D', '▶ View in 3D'));

// ---------- przekroje frontów ----------
let FX = 0;
function frontCrossSVG(kind) {
  const W = 680, H = 280, id = `fx${++FX}`;
  const cl = (x, y, rx, ry, col, o = 1) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${col}" opacity="${o}"/>`;
  const lab = (x, y, t, col = '#1b2a3a', fs = 13) => { const w = t.length * fs * 0.56 + 14; return `<g><rect x="${x - w / 2}" y="${y - fs * 0.9}" width="${w}" height="${fs * 1.6}" rx="${fs * 0.8}" fill="#fff" fill-opacity="0.88"/><text x="${x}" y="${y + fs * 0.34}" font-size="${fs}" font-weight="800" fill="${col}" text-anchor="middle">${t}</text></g>`; };
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Nunito, sans-serif"><defs>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bcd9ee"/><stop offset="1" stop-color="#eef6fb"/></linearGradient>
    <linearGradient id="${id}w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f6c7b8" stop-opacity="0.75"/><stop offset="1" stop-color="#fbe3d9" stop-opacity="0.45"/></linearGradient>
    <linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9cff0" stop-opacity="0.8"/><stop offset="1" stop-color="#dce8f8" stop-opacity="0.4"/></linearGradient>
    <linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f97c4"/><stop offset="1" stop-color="#2a628c"/></linearGradient>
  </defs><rect width="${W}" height="${H}" fill="url(#${id}s)"/>`;
  const seaY = 236;
  if (kind === 'warm') {
    // klin chłodnego powietrza po prawej, ciepłe wślizguje się po nim w górę
    s += `<path d="M0,${seaY} L0,0 L${W},0 L${W},40 L160,${seaY}Z" fill="url(#${id}w)"/><path d="M160,${seaY} L${W},40 L${W},${seaY}Z" fill="url(#${id}c)"/>`;
    s += `<path d="M160,${seaY} L${W},40" stroke="#d6342b" stroke-width="4"/>`;
    for (let k = 0; k < 7; k++) { const x = 190 + k * 66, y = seaY - (x - 160) * (196 / 520); s += `<path d="M${x - 9},${y + 3} A9,9 0 0 1 ${x + 9},${y - 3}Z" fill="#d6342b"/>`; }
    s += cl(210, 168, 90, 32, '#6f7984') + cl(260, 150, 70, 24, '#7d8792') + cl(330, 124, 96, 18, '#a9b2bc') + cl(450, 92, 104, 11, '#dfe5ea', 0.95) + cl(580, 58, 84, 6, '#ffffff', 0.9);
    s += lab(220, 166, 'Ns', '#1b2a3a') + lab(332, 124, 'As') + lab(452, 92, 'Cs') + lab(586, 58, 'Ci');
    for (let k = 0; k < 22; k++) s += `<line x1="${136 + k * 8}" y1="${190}" x2="${130 + k * 8}" y2="${seaY - 2}" stroke="#5d7fa0" stroke-width="1.6" opacity="0.8"/>`;
    s += lab(90, 70, L('ciepłe powietrze', 'warm air'), '#c2410c', 14) + lab(560, 200, L('chłodne powietrze', 'cold air'), '#2f5f9a', 14);
    s += `<rect y="${seaY}" width="${W}" height="${H - seaY}" fill="url(#${id}m)"/>`;
    s += lab(240, 262, L('pas ciągłych opadów – ok. 300 km', 'belt of continuous rain – about 300 km'), '#1b3f5f', 12) + lab(560, 262, L('Ci widać 800–1000 km przed frontem', 'Ci seen 800–1000 km ahead'), '#1b3f5f', 12);
  } else {
    // klin chłodnego powietrza po lewej wciska się pod ciepłe i wypycha je gwałtownie w górę
    s += `<path d="M0,${seaY} L0,60 Q110,64 310,${seaY}Z" fill="url(#${id}c)"/><path d="M0,60 Q110,64 310,${seaY} L${W},${seaY} L${W},0 L0,0Z" fill="url(#${id}w)"/>`;
    s += `<path d="M0,60 Q110,64 310,${seaY}" fill="none" stroke="#2b5fd6" stroke-width="4"/>`;
    for (const t of [0.35, 0.55, 0.75, 0.92]) { const x = t * 310, y = 60 + (seaY - 60) * t * t; s += `<path d="M${x - 8},${y - 6} L${x - 14},${y + 8} L${x + 6},${y + 4}Z" fill="#2b5fd6"/>`; }
    s += `<path d="M280,${seaY - 4} Q262,150 300,96 Q312,52 352,40 L470,30 Q520,34 540,44 Q470,48 430,66 Q420,120 440,${seaY - 4}Z" fill="#636d78"/><path d="M300,96 Q312,52 352,40 L470,30 Q520,34 540,44 Q470,48 430,66" fill="none" stroke="#4a535d" stroke-width="2"/>`;
    s += lab(360, 120, 'Cb', '#1b2a3a', 15) + lab(480, 40, L('kowadło', 'anvil'), '#1b2a3a', 11);
    for (let k = 0; k < 16; k++) s += `<line x1="${292 + k * 9}" y1="${seaY - 46}" x2="${284 + k * 9}" y2="${seaY - 2}" stroke="#3f5f80" stroke-width="2.2"/>`;
    s += `<path d="M300,150 L286,178 L300,178 L284,208" fill="none" stroke="#fff6a8" stroke-width="3.5" stroke-linejoin="round"/>`;
    s += cl(110, 132, 34, 15, '#fff') + cl(180, 150, 28, 12, '#fff') + lab(110, 132, 'Cu', '#2f4468', 12);
    s += lab(70, 200, L('chłodne powietrze', 'cold air'), '#2f5f9a', 14) + lab(560, 130, L('ciepłe powietrze', 'warm air'), '#c2410c', 14);
    s += `<rect y="${seaY}" width="${W}" height="${H - seaY}" fill="url(#${id}m)"/>`;
    s += lab(360, 262, L('szkwał, ulewa, grad – wąski pas 30–50 km', 'squall, downpour, hail – a narrow belt of 30–50 km'), '#1b3f5f', 12);
  }
  const ax0 = kind === 'warm' ? 40 : 520;
  s += `<line x1="${ax0}" y1="22" x2="${ax0 + 90}" y2="22" stroke="#1b2a3a" stroke-width="3"/><path d="M${ax0 + 90},22 l-11,-6 l0,12z" fill="#1b2a3a"/><text x="${ax0}" y="14" font-size="11" font-weight="700" fill="#1b2a3a">${L('ruch frontu', 'front moving')}</text>`;
  return s.replace(/\n\s*/g, '') + '</svg>';
}

export function meteoBook() {
  // przykładowa mapa: niż z frontami, jacht w wycinku ciepłym
  let ex = null;
  for (let sd = 3; sd < 200 && !ex; sd++) {
    const S = makeSynoptic(sd);
    if (S.T !== 'north' && S.T !== 'scand') continue;
    const A = seaSpots().find((p) => frontZone(S, p.x, p.y) === 'warm');
    if (A) ex = { S, A, stations: [], kind: 'front' };
  }
  const exFig = ex ? svgBox(synopticSVG(ex, true) + mapLegendSVG(), 'mb-fig mb-map') : null;

  const bftRows = Array.from({ length: 13 }, (_, f) => {
    const b = beaufort(f);
    const pic = h('div.mb-bftpic', {}, f <= 10 ? thumb(`bft${f}`, { bft: f, windFrom: 250, hour: 12.5, clouds: f >= 8 ? 'Ns' : f >= 6 ? 'Sc' : f >= 3 ? 'Cu' : 'Ci', seed: 7 }, 'orbit') : svgBox(seaStatePict(f), 'mb-pict'));
    return [pic, h('div', {}, h('b', {}, `${f}°B`), h('br'), h('span', {}, b.name)), `${b.knText} kn`, `${b.msText} m/s`, b.h ? `${String(b.h).replace('.', L(',', '.'))} m` : '—', h('div', {}, b.seaText, f >= 1 && f <= 10 ? h('div', { style: { marginTop: '4px' } }, see3D({ bft: f, windFrom: 250, hour: 12.5, clouds: f >= 8 ? 'Ns' : f >= 6 ? 'Sc' : 'Cu', seed: 7 }, 'orbit', `${f}°B – ${b.name}`)) : null), b.yacht];
  });

  const cloudEntries = clouds().map((c) => entry(`${c.name} – ${c.latin} (${c.id})`,
    h('div.mb-cloud', {}, h('div.mb-cloudpic', {}, thumb(`cl${c.id}`, { bft: c.id === 'Cb' ? 4 : c.id === 'Ns' ? 5 : 2, windFrom: 240, hour: 12, clouds: c.id, seed: 11 }, 'sky')),
      h('div', {}, h('p', {}, h('b', {}, L('Piętro: ', 'Level: ')), c.levelText), h('p', {}, h('b', {}, L('Wygląd: ', 'Appearance: ')), c.look), h('p', {}, h('b', {}, L('Pogoda: ', 'Weather: ')), c.weather),
        see3D({ bft: c.id === 'Cb' ? 4 : 2, windFrom: 240, hour: 12, clouds: c.id, seed: 11 }, 'sky', `${c.name} (${c.id})`)))));

  const spacing = [100, 150, 200, 300, 400, 600].map((km) => {
    const S = { base: 1013, gx: 0, gy: (4 / km) * 1000, centers: [], fronts: [] };
    const w = windAt(S, MAP.w / 2, toXY(15, 55)[1]);
    return [`${km} km`, `≈ ${Math.round(w.kn / 5) * 5} kn`, `${knToBft(w.kn)}°B`];
  });
  const barbs = [[5, '5 kn'], [10, '10 kn'], [15, '15 kn'], [25, '25 kn'], [50, '50 kn'], [65, '65 kn']];
  const barbFig = `<svg viewBox="0 0 620 110" xmlns="http://www.w3.org/2000/svg"><rect width="620" height="110" rx="8" fill="#f4f8fb"/>${barbs.map(([kn, t], i) => barbSVG(50 + i * 100, 70, 270, kn, 1.15) + `<text x="${32 + i * 100}" y="100" font-size="13" font-weight="700" fill="#1b2a3a">${t}</text>`).join('')}<text x="12" y="20" font-size="12" fill="#5f7890">${L('wiatr z zachodu (W) – trzonek wskazuje, skąd wieje', 'wind from the west (W) – the shaft points where it comes from')}</text></svg>`;
  const baroEx = [7, 11, 3].map((sd) => { for (let k = sd; k < sd + 200; k++) { const q = makeBaroQuestion(k); if (q.kind === ['slowFall', 'fastFall', 'frontPass'][[7, 11, 3].indexOf(sd)]) return q; } return makeBaroQuestion(sd); });

  const fig = (html, cls) => svgBox(html, cls ? `mb-fig ${cls}` : 'mb-fig');
  return [
    { id: 'basics', name: L('Ciśnienie i wiatr', 'Pressure and wind'), entries: [
      entry(null,
        P(L('Pogoda na morzu to przede wszystkim wiatr – jego siła, kierunek i porywy decydują o tym, jak płyniesz, ile żagla stawiasz i czy w ogóle wychodzisz z portu. Wiatr bierze się z różnic ciśnienia, dlatego ten rozdział zaczyna się od barometru i mapy izobar.', 'At sea, weather means first of all wind – its strength, direction and gusts decide how you sail, how much canvas you carry and whether you leave harbour at all. Wind comes from differences in pressure, so this chapter starts with the barometer and the isobar chart.'))),
      entry(L('Ciśnienie atmosferyczne', 'Atmospheric pressure'),
        P(L('Ciśnienie mierzy się w hektopaskalach (hPa). Średnio na poziomie morza wynosi 1013 hPa; nad Bałtykiem zwykle mieści się w przedziale 980–1040 hPa. Obszar niższego ciśnienia to niż (na polskich mapach N, na angielskich L), wyższego – wyż (W, H).', 'Pressure is measured in hectopascals (hPa). The mean sea-level value is 1013 hPa; over the Baltic it usually stays between 980 and 1040 hPa. An area of lower pressure is a low (L), of higher pressure a high (H).')),
        P(L('Izobary to linie łączące miejsca o jednakowym ciśnieniu – na mapach zwykle co 4 hPa. Im gęściej leżą, tym silniej wieje.', 'Isobars join places of equal pressure – usually drawn every 4 hPa. The closer together they lie, the stronger the wind.')),
        fig(phenSVG({ type: 'circ', low: true }, true))),
      entry(L('Kierunek i siła wiatru', 'Wind direction and strength'),
        P(L('Kierunek wiatru zawsze podaje się jako ten, ', 'Wind direction is always given as the direction it blows '), h('b', {}, L('z którego wieje', 'from')), L(': wiatr SW wieje z południowego zachodu na północny wschód. Siłę podaje się w węzłach (kn), m/s albo w stopniach Beauforta (°B); 1 m/s ≈ 2 kn.', ': a SW wind blows from the south-west towards the north-east. Strength is given in knots (kn), m/s or Beaufort force (Bft); 1 m/s ≈ 2 kn.')),
        P(L('Zmiana kierunku zgodnie z ruchem wskazówek zegara (np. S → SW → W) to ', 'A change clockwise (e.g. S → SW → W) is '), h('b', {}, L('skręcanie wiatru w prawo', 'veering')), L(', przeciwnie (W → SW → S) – ', ', anticlockwise (W → SW → S) – '), h('b', {}, L('cofanie się', 'backing')), '.'),
        tip(L('Wiatr nie wieje równo: porywy bywają o 30–50% silniejsze od średniej, a pod chmurą Cb nawet dwa razy. Powierzchnię żagli dobieraj do porywów, nie do średniego wiatru.', 'The wind is never steady: gusts are often 30–50% stronger than the mean, and under a Cb cloud up to twice as strong. Choose your sail area for the gusts, not for the mean wind.')),
        fig(phenSVG({ type: 'shift', seq: [180, 225, 270] }, true))),
      entry(L('Prawo Buys-Ballota', 'Buys-Ballot’s law'),
        P(L('Stań plecami do wiatru – na półkuli północnej niż jest po twojej lewej stronie, nieco z przodu, a wyż po prawej. Ta prosta reguła pozwala bez mapy ocenić, gdzie jest ośrodek niżu i jak będzie się zmieniać pogoda.', 'Stand with your back to the wind – in the northern hemisphere the low is on your left, slightly ahead, and the high on your right. This simple rule tells you without a chart where the centre of the low is and how the weather is likely to change.')),
        P(L('Wokół niżu wiatr krąży przeciwnie do ruchu wskazówek zegara i zbiega się do środka; powietrze się unosi, tworzą się chmury i opady. Wokół wyżu krąży zgodnie z ruchem wskazówek zegara i rozbiega się; powietrze osiada, a pogoda jest zwykle ładna.', 'Around a low the wind circulates anticlockwise and converges towards the centre; the air rises, forming cloud and rain. Around a high it circulates clockwise and spreads outwards; the air sinks and the weather is usually fair.')),
        h('div.mb-row', {}, fig(phenSVG({ type: 'buys', from: 225 }, true)), fig(phenSVG({ type: 'circ', low: false }, true)))),
      entry(L('Wiatr rzeczywisty i pozorny', 'True and apparent wind'),
        P(L('Na płynącym jachcie czujesz wiatr pozorny – sumę wiatru rzeczywistego i „wiatru biegu” wywołanego ruchem jachtu. To na niego ustawiasz żagle i to on pokazuje wiatrowskaz.', 'On a moving yacht you feel the apparent wind – the sum of the true wind and the “headwind” created by the yacht’s own motion. It is what you trim the sails to and what the masthead indicator shows.')),
        P(L('Na kursie ostrym wiatr pozorny jest silniejszy od rzeczywistego i wieje bardziej z przodu, z wiatrem (fordewind) – słabszy.', 'Close-hauled the apparent wind is stronger than the true wind and comes from further ahead; running downwind it is weaker.')),
        warn(L('Po zwrocie z kursu z wiatrem na kurs ostry wiatr nagle „przybiera” o kilka węzłów. Refuj, zanim skręcisz pod wiatr.', 'When you turn from a run onto a beat the wind suddenly “picks up” by several knots. Reef before you turn upwind.')),
        fig(phenSVG({ type: 'apparent', tw: 15, bs: 6, down: false }, true)))
    ] },
    { id: 'beaufort', name: L('Skala Beauforta', 'Beaufort scale'), entries: [
      entry(null, P(L('Skala Beauforta opisuje siłę wiatru po wyglądzie morza – przydaje się, gdy nie masz wiatromierza albo chcesz sprawdzić, czy prognoza się sprawdza. Wysokości fal to wartości typowe dla otwartego morza. Na Bałtyku fala jest krótsza i bardziej stroma niż na oceanie, a przy wietrze przeciwnym do prądu – jeszcze bardziej. Obrazki w pierwszej kolumnie są renderowane w 3D; przyciskiem „Zobacz w 3D” obejrzysz morze z bliska.', 'The Beaufort scale describes wind strength by the look of the sea – useful when you have no anemometer or want to check whether the forecast is right. Wave heights are typical open-sea values. On the Baltic the waves are shorter and steeper than on the ocean, and steeper still with wind against current. The pictures in the first column are rendered in 3D; the “View in 3D” button lets you look at the sea up close.'))),
      table([L('Widok', 'View'), L('Siła', 'Force'), L('Wiatr', 'Wind'), 'm/s', L('Fala', 'Wave'), L('Wygląd morza', 'Sea state'), L('Na jachcie', 'On a yacht')], bftRows)
    ] },
    { id: 'clouds', name: L('Chmury', 'Clouds'), entries: [
      entry(null, P(L('Chmury dzieli się na 10 rodzajów w trzech piętrach (wysokości dla naszych szerokości): wysokie (5–13 km) – Ci, Cc, Cs; średnie (2–7 km) – Ac, As; niskie (do 2 km) – Sc, St, Ns. Osobno są chmury o budowie pionowej – Cu i Cb – z podstawą nisko i wierzchołkiem sięgającym wysoko.', 'Clouds are divided into 10 types on three levels (heights for our latitudes): high (5–13 km) – Ci, Cc, Cs; middle (2–7 km) – Ac, As; low (below 2 km) – Sc, St, Ns. Separately there are clouds of vertical development – Cu and Cb – with a low base and a tall top.')),
        tip(L('Najwięcej mówi zmiana nieba w czasie: wysokie chmury, które gęstnieją i obniżają się, zapowiadają front ciepły; szybko rosnące wieże Cu – możliwą burzę.', 'What tells you most is how the sky changes over time: high cloud thickening and lowering heralds a warm front; Cu towers growing fast – a possible thunderstorm.'))),
      ...cloudEntries
    ] },
    { id: 'systems', name: L('Niże, wyże i fronty', 'Lows, highs and fronts'), entries: [
      entry(L('Niż z frontami', 'A frontal low'),
        P(L('Niże nad Bałtyk przychodzą najczęściej z zachodu lub południowego zachodu i przesuwają się na wschód z prędkością 15–30 kn. Typowy niż ma trzy strefy:', 'Lows reach the Baltic mostly from the west or south-west and move east at 15–30 kn. A typical low has three zones:')),
        h('ul', {},
          h('li', {}, h('b', {}, L('front ciepły', 'warm front')), L(' – przed nim szeroki pas chmur warstwowych i ciągłych opadów;', ' – ahead of it a broad belt of layered cloud and continuous rain;')),
          h('li', {}, h('b', {}, L('wycinek ciepły', 'warm sector')), L(' – wilgotno, niskie chmury St, mżawka, słaba widzialność;', ' – humid air, low St cloud, drizzle, poor visibility;')),
          h('li', {}, h('b', {}, L('front chłodny', 'cold front')), L(' – wąski pas chmur Cb ze szkwałami i ulewą, za nim przejaśnienia i porywisty wiatr.', ' – a narrow belt of Cb with squalls and downpours, followed by clearing skies and gusty wind.'))),
        P(L('Front chłodny porusza się szybciej, dogania ciepły i tworzy okluzję.', 'The cold front moves faster, catches up with the warm front and forms an occlusion.')),
        exFig),
      entry(L('Front ciepły', 'Warm front'), fig(frontCrossSVG('warm'), 'wide'),
        P(L('Ciepłe powietrze łagodnie wślizguje się na klin chłodnego. Pierwsze zwiastuny – pierzaste Ci – widać nawet dzień wcześniej, potem niebo zasnuwa się coraz niższymi chmurami, aż zaczyna padać.', 'Warm air glides gently up over a wedge of cold air. The first heralds – feathery Ci – can appear a day ahead; then the sky fills with ever lower cloud until the rain begins.')),
        table([L('', ''), L('Przed frontem', 'Ahead'), L('Podczas przejścia', 'At passage'), L('Za frontem', 'Behind')], [
          [L('Ciśnienie', 'Pressure'), L('stopniowo spada', 'falls steadily'), L('przestaje spadać', 'stops falling'), L('stałe lub powoli spada', 'steady or falling slowly')],
          [L('Wiatr', 'Wind'), L('wzmaga się i cofa się (np. na S)', 'freshens and backs (e.g. to S)'), L('skręca w prawo', 'veers'), L('stały, np. SW', 'steady, e.g. SW')],
          [L('Chmury', 'Clouds'), 'Ci → Cs → As → Ns', 'Ns', 'St, Sc'],
          [L('Opady', 'Precipitation'), L('ciągłe, coraz silniejsze', 'continuous, increasing'), L('słabną', 'easing'), L('mżawka albo brak', 'drizzle or none')],
          [L('Widzialność', 'Visibility'), L('pogarsza się', 'deteriorating'), L('słaba', 'poor'), L('słaba, możliwa mgła', 'poor, fog possible')],
          [L('Temperatura', 'Temperature'), L('bez zmian', 'steady'), L('rośnie', 'rising'), L('wyższa', 'higher')]])),
      entry(L('Front chłodny', 'Cold front'), fig(frontCrossSVG('cold'), 'wide'),
        P(L('Chłodne powietrze wciska się klinem pod ciepłe i gwałtownie wypycha je w górę. Pogoda zmienia się szybko: nadciąga wał chmur, przychodzi szkwał i ulewa, a po kilkudziesięciu minutach niebo się przejaśnia.', 'Cold air pushes under the warm air like a wedge and forces it up violently. The weather changes fast: a bank of cloud arrives, then a squall and a downpour, and within tens of minutes the sky clears.')),
        table([L('', ''), L('Przed frontem', 'Ahead'), L('Podczas przejścia', 'At passage'), L('Za frontem', 'Behind')], [
          [L('Ciśnienie', 'Pressure'), L('spada', 'falling'), L('nagle rośnie', 'sudden rise'), L('szybko rośnie', 'rising quickly')],
          [L('Wiatr', 'Wind'), L('SW, wzmaga się', 'SW, freshening'), L('szkwał, gwałtownie skręca w prawo', 'squall, veers sharply'), L('W–NW, porywisty', 'W–NW, gusty')],
          [L('Chmury', 'Clouds'), L('Ac, As, nadciągający Cb', 'Ac, As, approaching Cb'), 'Cb', L('Cu, przelotne opady', 'Cu, showers')],
          [L('Opady', 'Precipitation'), L('czasem deszcz', 'some rain'), L('ulewa, grad, burza', 'downpour, hail, thunder'), L('przelotne', 'showers')],
          [L('Widzialność', 'Visibility'), L('umiarkowana', 'moderate'), L('w ulewie słaba', 'poor in the downpour'), L('bardzo dobra', 'very good')],
          [L('Temperatura', 'Temperature'), L('wysoka', 'high'), L('spada', 'falling'), L('niższa', 'lower')]]),
        warn(L('Szkwał na froncie chłodnym przychodzi nagle i jest najgroźniejszy dla jachtu. Gdy zobaczysz nadciągający, ciemny wał chmur – zrefuj od razu, nie czekaj na pierwszy poryw.', 'The squall at a cold front arrives suddenly and is the most dangerous moment for a yacht. When you see a dark bank of cloud approaching – reef at once, do not wait for the first gust.'))),
      entry(L('Wyż', 'High'),
        P(L('W wyżu powietrze osiada, więc zwykle wieje słabo i jest pogodnie. Latem przy brzegu rozwija się bryza, jesienią i zimą wyż często przynosi mgły i niskie chmury St.', 'In a high the air sinks, so winds are usually light and skies clear. In summer sea breezes develop along the coast; in autumn and winter a high often brings fog and low St cloud.')),
        P(L('Silny wiatr w wyżu zdarza się tylko na jego skraju, tam gdzie izobary zagęszczają się przy sąsiednim niżu.', 'Strong wind in a high occurs only on its edge, where the isobars crowd against a neighbouring low.')),
        fig(phenSVG({ type: 'circ', low: false }, true)))
    ] },
    { id: 'chart', name: L('Mapa synoptyczna', 'Synoptic chart'), entries: [
      entry(L('Jak czytać mapę', 'How to read the chart'),
        P(L('Mapa przyziemna pokazuje izobary (co 4 hPa), ośrodki niżów (N) i wyżów (W) z ciśnieniem w środku, fronty oraz – na mapach z obserwacjami – symbole wiatru na stacjach.', 'A surface chart shows the isobars (every 4 hPa), the centres of lows (L) and highs (H) with their central pressure, the fronts and – on plotted charts – wind symbols at the stations.')),
        h('ol.nb-steps', {},
          h('li', {}, L('Kierunek wiatru: wiatr wieje wzdłuż izobar tak, by niż był po lewej (patrząc z wiatrem), skręcony o ok. 15–20° do środka niżu.', 'Wind direction: the wind blows along the isobars with the low on the left (looking downwind), turned about 15–20° in towards the low.')),
          h('li', {}, L('Siła wiatru: z odstępu izobar – im gęściej, tym silniej (tabela niżej).', 'Wind strength: from the isobar spacing – the closer, the stronger (table below).')),
          h('li', {}, L('Zmiana pogody: z ruchu frontów i ośrodków – strzałka przy niżu pokazuje, dokąd i jak szybko się przesuwa.', 'Change of weather: from the movement of fronts and centres – the arrow at a low shows where and how fast it is moving.'))),
        fig(mapLegendSVG(), 'mb-legend wide')),
      entry(L('Odstęp izobar a siła wiatru (ok. 55°N, nad morzem)', 'Isobar spacing and wind strength (about 55°N, over the sea)'),
        P(L('Przybliżone wartości dla prostych izobar co 4 hPa (wiatr przy powierzchni morza ≈ 70% wiatru geostroficznego). Wokół niżu wiatr jest nieco słabszy, a wokół wyżu nieco silniejszy, niż wynika z tabeli.', 'Approximate values for straight isobars every 4 hPa (wind at the sea surface ≈ 70% of the geostrophic wind). Around a low the wind is somewhat weaker, and around a high somewhat stronger, than the table suggests.')),
        table([L('Odstęp izobar', 'Isobar spacing'), L('Wiatr', 'Wind'), L('Siła', 'Force')], spacing)),
      entry(L('Symbole wiatru', 'Wind symbols'),
        P(L('Trzonek wskazuje, skąd wieje wiatr. Długa kreska to 10 kn, krótka 5 kn, a chorągiewka (trójkąt) 50 kn. Na półkuli północnej kreski rysuje się po stronie niższego ciśnienia. Kółko bez trzonka oznacza ciszę.', 'The shaft points to where the wind comes from. A long barb is 10 kn, a short one 5 kn and a pennant (triangle) 50 kn. In the northern hemisphere the barbs are drawn on the low-pressure side. A circle without a shaft means calm.')),
        fig(barbFig, 'wide'))
    ] },
    { id: 'baro', name: L('Barometr', 'Barometer'), entries: [
      entry(L('Tendencja ciśnienia', 'Pressure tendency'),
        P(L('Ważniejsza od samej wartości ciśnienia jest jego zmiana. Odczyt barometru wpisuj do dziennika jachtowego co 3–4 godziny. Prognozy morskie opisują tendencję z ostatnich 3 godzin tak:', 'What matters more than the reading itself is how it changes. Log the barometer every 3–4 hours. Marine forecasts describe the tendency over the last 3 hours like this:')),
        table([L('Zmiana w 3 h', 'Change in 3 h'), L('Określenie', 'Term')], [['< 0,1 hPa', L('bez zmian', 'steady')], ['0,1–1,5 hPa', L('powoli rośnie / spada', 'rising / falling slowly')], ['1,6–3,5 hPa', L('rośnie / spada', 'rising / falling')], ['3,6–6,0 hPa', L('szybko rośnie / spada', 'rising / falling quickly')], ['> 6,0 hPa', L('bardzo szybko rośnie / spada', 'rising / falling very rapidly')]]),
        tip(L('Spadek o 1 hPa na godzinę i więcej zapowiada silny wiatr, a o 6–10 hPa w 3 godziny – sztorm. Szybki wzrost po przejściu niżu oznacza silny, porywisty wiatr za frontem chłodnym. Stare przysłowie mówi: „długo zapowiadana – długo trwa, krótko zapowiadana – szybko mija”.', 'A fall of 1 hPa per hour or more means strong wind ahead; 6–10 hPa in 3 hours – a gale. A quick rise after a low has passed means strong, gusty wind behind the cold front. As the old saying goes: “long foretold, long last; short notice, soon past”.'))),
      entry(L('Przykładowe zapisy barografu', 'Example barograph traces'),
        h('div.mb-row', {}, ...baroEx.map((q) => h('div', {}, svgBox(barographSVG(q.pts, true, q.d3)), h('p.small', {}, q.options.find((o) => o.id === q.kind).label)))))
    ] },
    { id: 'phen', name: L('Mgły, bryza, burze', 'Fog, breezes, storms'), entries: [
      entry(L('Bryza morska i lądowa', 'Sea and land breezes'),
        P(L('W słoneczny dzień przy słabym wietrze ogólnym ląd nagrzewa się szybciej niż woda. Ciepłe powietrze nad lądem unosi się, a na jego miejsce od morza napływa chłodniejsze – to bryza morska. Zaczyna się ok. 10–11, najsilniejsza jest po południu (10–15 kn) i sięga kilkanaście kilometrów od brzegu.', 'On a sunny day with a weak general wind the land heats up faster than the water. Warm air over the land rises and cooler air flows in from the sea to replace it – the sea breeze. It sets in around 10–11 am, is strongest in the afternoon (10–15 kn) and reaches a dozen or so kilometres offshore.')),
        P(L('Nocą jest odwrotnie: ląd stygnie szybciej i od lądu nad morze wieje słabsza bryza lądowa.', 'At night it reverses: the land cools faster and a weaker land breeze blows from the land out to sea.')),
        h('div.mb-row', {}, fig(phenSVG({ type: 'breeze', day: true }, true)), fig(phenSVG({ type: 'breeze', day: false }, true)))),
      entry(L('Mgły', 'Fog'),
        P(h('b', {}, L('Mgła adwekcyjna (morska)', 'Advection (sea) fog')), L(' powstaje, gdy ciepłe, wilgotne powietrze napływa nad zimną wodę – na Bałtyku najczęściej wiosną i na początku lata. Potrafi utrzymywać się wiele godzin, także przy wietrze 3–5°B.', ' forms when warm, moist air flows over cold water – on the Baltic mostly in spring and early summer. It can persist for many hours, even with a Force 3–5 wind.')),
        P(h('b', {}, L('Mgła radiacyjna', 'Radiation fog')), L(' tworzy się nad lądem w pogodne, bezwietrzne noce, spływa do portów i ujść rzek i zwykle znika przed południem.', ' forms over land on clear, calm nights, drifts into harbours and river mouths and usually clears before noon.')),
        warn(L('We mgle: zmniejsz prędkość, nadawaj sygnały mgłowe, włącz światła nawigacyjne, korzystaj z radaru i AIS, wystaw obserwatora, a załoga niech założy kamizelki.', 'In fog: slow down, sound fog signals, switch on the navigation lights, use radar and AIS, post a lookout, and have the crew put on lifejackets.')),
        h('div.mb-row', {}, fig(phenSVG({ type: 'fog', adv: true }, true)), fig(phenSVG({ type: 'fog', adv: false }, true)))),
      entry(L('Burze i szkwały', 'Thunderstorms and squalls'),
        P(L('Burze rozwijają się z chmur Cb – latem po południu nad lądem oraz w strefie frontu chłodnego. Przed chmurą często widać ciemny wał szkwałowy; pod nim wiatr gwałtownie się wzmaga (porywy nawet dwukrotnie silniejsze), nagle zmienia kierunek, a potem przychodzi ulewa i grad.', 'Thunderstorms grow from Cb clouds – on summer afternoons over land and along cold fronts. Ahead of the cloud there is often a dark roll (squall) cloud; beneath it the wind rises violently (gusts up to twice as strong), shifts suddenly, and then comes a downpour and hail.')),
        P(L('Odległość burzy: liczba sekund od błysku do grzmotu podzielona przez 3 daje kilometry.', 'Distance to a storm: the number of seconds between flash and thunder divided by 3 gives kilometres.')),
        tip(L('Gdy zbliża się Cb: zrefuj albo zrzuć żagle zawczasu, zamknij luki, załoga w kamizelkach i szelkach, odejdź od brzegu zawietrznego i podczas wyładowań nie dotykaj want ani masztu.', 'When a Cb approaches: reef or drop sail early, close the hatches, crew in lifejackets and harnesses, keep clear of a lee shore, and do not touch the shrouds or mast during lightning.')),
        h('div.mb-row', {}, fig(phenSVG({ type: 'squall' }, true)), fig(phenSVG({ type: 'thunder', s: 9 }, true)))),
      entry(L('Wiatr przy brzegu', 'Wind near the coast'),
        P(L('Wzdłuż wysokiego brzegu wiatr przyspiesza, a przy przylądkach zagęszcza się i skręca. Na zawietrznej wysokiego lądu jest słabszy, ale porywisty i zmienny – ze zboczy potrafią nagle spadać szkwały. Wiatr przeciwny do prądu (np. w cieśninach i ujściach rzek) tworzy krótką, stromą falę.', 'Along a high coast the wind accelerates, and around headlands it squeezes together and bends. In the lee of high land it is lighter but gusty and shifting – squalls can suddenly drop down the slopes. Wind against current (e.g. in straits and river mouths) raises a short, steep sea.')))
    ] },
    { id: 'forecast', name: L('Prognozy', 'Forecasts'), entries: [
      entry(L('Skąd brać prognozy', 'Where to get forecasts'),
        P(L('Prognozy i ostrzeżenia dla żeglugi nadają stacje brzegowe przez radio UKF (kanał roboczy jest zapowiadany na kanale 16) i system NAVTEX; publikują je też służby meteorologiczne w internecie (dla polskiego wybrzeża – IMGW-PIB). Pomocne są modele numeryczne (np. ECMWF, ICON, GFS) – pamiętaj, że pokazują wiatr średni, a nie porywy.', 'Forecasts and warnings for shipping are broadcast by coast stations on VHF (the working channel is announced on channel 16) and by NAVTEX, and published online by the met services. Numerical models (e.g. ECMWF, ICON, GFS) help too – remember that they show the mean wind, not the gusts.')),
        tip(L('Sprawdzaj prognozę przed wyjściem i regularnie w trakcie rejsu, porównując ją z tym, co widzisz: chmurami, barometrem i morzem. Planuj z zapasem – na wiatr o 1–2°B silniejszy od prognozowanego.', 'Check the forecast before you sail and regularly on passage, comparing it with what you see: the clouds, the barometer and the sea. Plan with a margin – for a wind 1–2 Beaufort forces stronger than forecast.'))),
      entry(L('Słownik prognozy morskiej', 'Marine forecast glossary'),
        table([L('Termin', 'Term'), L('Znaczenie', 'Meaning')], [
          [L('wiatr skręcający', 'veering'), L('zmienia kierunek zgodnie z ruchem wskazówek zegara', 'changing direction clockwise')],
          [L('wiatr cofający się', 'backing'), L('zmienia kierunek przeciwnie do ruchu wskazówek zegara', 'changing direction anticlockwise')],
          [L('porywy', 'gusts'), L('chwilowy wiatr wyraźnie silniejszy od średniego', 'brief wind clearly stronger than the mean')],
          [L('sztorm', 'gale'), L('wiatr 8°B (34–40 kn) lub porywy powyżej 43 kn – ostrzeżenie sztormowe', 'Force 8 (34–40 kn) or gusts above 43 kn – gale warning')],
          [L('widzialność dobra', 'good visibility'), L('powyżej 5 Mm', 'more than 5 NM')],
          [L('widzialność umiarkowana', 'moderate visibility'), L('2–5 Mm', '2–5 NM')],
          [L('widzialność słaba', 'poor visibility'), L('od 1000 m do 2 Mm', '1000 m to 2 NM')],
          [L('mgła', 'fog'), L('widzialność poniżej 1000 m', 'visibility less than 1000 m')],
          [L('stan morza', 'sea state'), L('wysokość fal (np. 2–3 m); na Bałtyku fala jest krótka i stroma', 'wave height (e.g. 2–3 m); on the Baltic the sea is short and steep')]])),
      entry(L('Oznaki zmiany pogody', 'Signs of a change in the weather'),
        h('div.mb-two', {},
          h('div.nb-note', {}, h('div.nb-tag', {}, L('Pogorszenie', 'Getting worse')), h('ul', {},
            h('li', {}, L('Ci nasuwające się od zachodu i gęstniejące w Cs (halo wokół słońca), potem As', 'Ci spreading from the west and thickening into Cs (a halo round the sun), then As')),
            h('li', {}, L('spadające ciśnienie', 'falling pressure')),
            h('li', {}, L('wiatr cofający się i wzmagający', 'wind backing and freshening')),
            h('li', {}, L('niezwykle przejrzyste powietrze i dobra słyszalność przed frontem', 'unusually clear air and sounds carrying far ahead of a front')),
            h('li', {}, L('rano rosnące wieże Ac castellanus lub Cu', 'turreted Ac castellanus or growing Cu in the morning')))),
          h('div.nb-example', {}, h('div.nb-tag', {}, L('Poprawa', 'Improving')), h('ul', {},
            h('li', {}, L('rosnące ciśnienie', 'rising pressure')),
            h('li', {}, L('wiatr skręcający na NW i słabnący', 'wind veering to NW and easing')),
            h('li', {}, L('Cu rozpadające się wieczorem', 'Cu dissolving in the evening')),
            h('li', {}, L('rosa i poranna mgła (wyż)', 'dew and morning mist (a high)')))))
      )
    ] }
  ];
}
