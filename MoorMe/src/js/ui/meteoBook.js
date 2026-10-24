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
const entry = (title, ...kids) => h('div.hb-entry', {}, title ? h('h3', {}, title) : null, ...kids);
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
function frontCrossSVG(kind) {
  const W = 620, H = 230;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="#e9f3fa"/><rect y="200" width="${W}" height="30" fill="#4a86b0"/>`;
  const cl = (x, y, w, hh, col = '#fff', o = 1) => `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${hh}" fill="${col}" opacity="${o}"/>`;
  if (kind === 'warm') {
    s += `<path d="M150,200 L${W},40 L${W},200Z" fill="#cfe0ee"/><path d="M150,200 L${W},40" stroke="#d6342b" stroke-width="4"/>`;
    s += `<text x="30" y="80" font-size="14" font-weight="800" fill="#c2410c">${L('ciepłe powietrze', 'warm air')}</text><text x="470" y="185" font-size="14" font-weight="800" fill="#2f5f9a">${L('chłodne powietrze', 'cold air')}</text>`;
    s += cl(200, 150, 70, 26, '#7d8792') + cl(300, 118, 80, 18, '#a9b2bc') + cl(420, 84, 90, 10, '#dfe5ea') + cl(540, 50, 70, 5, '#f4f7fa');
    s += `<text x="170" y="155" font-size="13" font-weight="800" fill="#fff">Ns</text><text x="290" y="122" font-size="13" font-weight="800" fill="#2f4468">As</text><text x="412" y="88" font-size="13" font-weight="800" fill="#2f4468">Cs</text><text x="535" y="40" font-size="13" font-weight="800" fill="#2f4468">Ci</text>`;
    for (let i = 0; i < 16; i++) s += `<line x1="${140 + i * 9}" y1="172" x2="${134 + i * 9}" y2="198" stroke="#5d7fa0" stroke-width="1.6"/>`;
    s += `<text x="160" y="222" font-size="12" fill="#fff">${L('długotrwały deszcz – pas ok. 300 km', 'prolonged rain – a belt of about 300 km')}</text>`;
  } else {
    s += `<path d="M0,200 L0,60 Q120,70 330,200Z" fill="#cfe0ee"/><path d="M0,60 Q120,70 330,200" fill="none" stroke="#2b5fd6" stroke-width="4"/>`;
    s += `<text x="30" y="185" font-size="14" font-weight="800" fill="#2f5f9a">${L('chłodne powietrze', 'cold air')}</text><text x="440" y="120" font-size="14" font-weight="800" fill="#c2410c">${L('ciepłe powietrze', 'warm air')}</text>`;
    s += `<path d="M300,190 Q290,120 330,70 Q340,30 380,26 L470,22 Q420,40 410,70 Q430,130 410,190Z" fill="#7d8792"/><text x="345" y="120" font-size="15" font-weight="800" fill="#fff">Cb</text>`;
    for (let i = 0; i < 12; i++) s += `<line x1="${306 + i * 9}" y1="190" x2="${300 + i * 9}" y2="200" stroke="#3f5f80" stroke-width="2"/>`;
    s += cl(120, 120, 34, 16, '#fff') + cl(200, 132, 28, 13, '#fff') + `<text x="108" y="124" font-size="12" font-weight="800" fill="#2f4468">Cu</text>`;
    s += `<text x="250" y="222" font-size="12" fill="#fff">${L('szkwał i ulewa – wąski pas', 'squall and downpour – a narrow belt')}</text>`;
  }
  s += `<line x1="${kind === 'warm' ? 60 : 420}" y1="22" x2="${kind === 'warm' ? 130 : 520}" y2="22" stroke="#1b2a3a" stroke-width="3"/><path d="M${kind === 'warm' ? 130 : 520},22 l-10,-6 l0,12z" fill="#1b2a3a"/><text x="${kind === 'warm' ? 60 : 420}" y="16" font-size="11" fill="#1b2a3a">${L('ruch frontu', 'front moving')}</text>`;
  return s + '</svg>';
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

  return [
    { id: 'basics', name: L('Ciśnienie i wiatr', 'Pressure and wind'), entries: [
      entry(L('Ciśnienie atmosferyczne', 'Atmospheric pressure'),
        P(L('Ciśnienie mierzy się w hektopaskalach (hPa). Średnie ciśnienie na poziomie morza to 1013,25 hPa. Obszary niższego ciśnienia to niże (na mapach N, po angielsku L), wyższego – wyże (W, H). Linie łączące punkty o jednakowym ciśnieniu to izobary – na mapach zwykle co 4 hPa (niektóre służby rysują je co 5 hPa).', 'Pressure is measured in hectopascals (hPa). The mean sea-level pressure is 1013.25 hPa. Areas of lower pressure are lows (L), of higher pressure – highs (H). Lines joining points of equal pressure are isobars – usually drawn every 4 hPa (some services use 5 hPa).')),
        P(L('Powietrze płynie od wysokiego do niskiego ciśnienia, ale obrót Ziemi (siła Coriolisa) odchyla je – na półkuli północnej w prawo. Dlatego wiatr wieje niemal wzdłuż izobar, a nad morzem odchyla się tylko o ok. 15–20° w stronę niskiego ciśnienia (nad lądem, przez tarcie, o 30–40°).', 'Air flows from high to low pressure, but the Earth’s rotation (the Coriolis force) deflects it – to the right in the northern hemisphere. So the wind blows almost along the isobars; over the sea it turns only about 15–20° towards low pressure (over land, because of friction, 30–40°).'))),
      entry(L('Kierunek i prędkość wiatru', 'Wind direction and speed'),
        P(L('Kierunek wiatru podaje się zawsze jako ten, Z KTÓREGO wieje: wiatr południowo-zachodni (SW) wieje z południowego zachodu na północny wschód. Prędkość – w węzłach (kn), m/s albo w skali Beauforta (°B); 1 m/s ≈ 2 kn.', 'Wind direction is always the direction it blows FROM: a south-westerly (SW) blows from the south-west towards the north-east. Speed is given in knots (kn), m/s or on the Beaufort scale; 1 m/s ≈ 2 kn.')),
        P(L('Wiatr nie wieje równo: porywy bywają o 30–50% silniejsze od średniej, pod chmurami Cb nawet dwukrotnie. Ożaglowanie dobiera się do porywów.', 'The wind is not steady: gusts are often 30–50% stronger than the mean, under Cb even double. Choose sail area for the gusts.')),
        P(L('Zmiana kierunku zgodnie z ruchem wskazówek zegara (S → SW → W) to skręcanie wiatru w prawo, przeciwnie (W → SW → S) – cofanie się wiatru.', 'A clockwise change (S → SW → W) is veering, anticlockwise (W → SW → S) is backing.')),
        svgBox(phenSVG({ type: 'shift', seq: [180, 225, 270] }, true))),
      entry(L('Prawo Buys-Ballota i cyrkulacja w niżu i wyżu', 'Buys-Ballot’s law and circulation in lows and highs'),
        P(L('Stań plecami do wiatru – na półkuli północnej niż jest po lewej stronie, nieco z przodu, a wyż po prawej. Wokół niżu wiatr krąży przeciwnie do ruchu wskazówek zegara i zbiega się do środka (powietrze się unosi – chmury, opady), wokół wyżu zgodnie z ruchem wskazówek zegara i rozbiega się (powietrze osiada – zwykle ładna pogoda).', 'Stand with your back to the wind – in the northern hemisphere the low is on your left, slightly ahead, and the high on your right. Around a low the wind circles anticlockwise and converges (rising air – cloud and rain), around a high clockwise and diverges (sinking air – usually fair weather).')),
        h('div.mb-row', {}, svgBox(phenSVG({ type: 'buys', from: 225 }, true)), svgBox(phenSVG({ type: 'circ', low: true }, true)), svgBox(phenSVG({ type: 'circ', low: false }, true)))),
      entry(L('Wiatr rzeczywisty i pozorny', 'True and apparent wind'),
        P(L('Na płynącym jachcie czujemy wiatr pozorny – sumę wiatru rzeczywistego i „wiatru” wywołanego ruchem jachtu. Na kursie ostrym wiatr pozorny jest silniejszy od rzeczywistego i wieje bardziej z przodu; z wiatrem (fordewind) jest słabszy. Uwaga: po zwrocie z kursu pełnego na ostry wiatr nagle „przybiera”.', 'On a moving yacht we feel the apparent wind – the sum of the true wind and the “wind” created by the yacht’s motion. Close-hauled the apparent wind is stronger than the true wind and comes from further ahead; downwind it is weaker. Beware: when turning from a run to a beat the wind suddenly “increases”.')),
        svgBox(phenSVG({ type: 'apparent', tw: 15, bs: 6, down: false }, true)))
    ] },
    { id: 'beaufort', name: L('Skala Beauforta', 'Beaufort scale'), entries: [
      entry(null, P(L('Skala Beauforta opisuje siłę wiatru po wyglądzie morza. Wysokości fal to wartości prawdopodobne na otwartym morzu; na Bałtyku fale są krótsze i bardziej strome niż na oceanie, a przy wietrze przeciwnym do prądu – jeszcze bardziej. Obrazki w lewej kolumnie są renderowane na żywo przez symulator.', 'The Beaufort scale describes wind force by the state of the sea. Wave heights are probable values in the open sea; on the Baltic the waves are shorter and steeper than on the ocean, and steeper still when the wind is against the current. The pictures in the left column are rendered live by the simulator.'))),
      table([L('Widok', 'View'), L('Siła', 'Force'), L('Wiatr', 'Wind'), 'm/s', L('Fala', 'Wave'), L('Wygląd morza', 'Sea state'), L('Na jachcie', 'On a yacht')], bftRows)
    ] },
    { id: 'clouds', name: L('Chmury', 'Clouds'), entries: [
      entry(null, P(L('Chmury dzieli się na 10 rodzajów w trzech piętrach (wysokości dla naszych szerokości): wysokie (5–13 km) – Ci, Cc, Cs; średnie (2–7 km) – Ac, As; niskie (do 2 km) – Sc, St, Ns; oraz chmury o budowie pionowej – Cu i Cb, których podstawa jest nisko, a wierzchołki sięgają wysoko. Najważniejsza dla żeglarza jest zmiana zachmurzenia w czasie: gęstniejące chmury wysokie, potem coraz niższe, to zwiastun frontu ciepłego; rosnące wieże Cu – możliwej burzy.', 'Clouds are divided into 10 types on three levels (heights for our latitudes): high (5–13 km) – Ci, Cc, Cs; middle (2–7 km) – Ac, As; low (below 2 km) – Sc, St, Ns; and clouds of vertical development – Cu and Cb, with low bases and high tops. What matters most to a sailor is how the sky changes: high clouds thickening and lowering herald a warm front; growing Cu towers – a possible thunderstorm.'))),
      ...cloudEntries
    ] },
    { id: 'systems', name: L('Niże, wyże i fronty', 'Lows, highs and fronts'), entries: [
      entry(L('Niż z frontami', 'A frontal low'),
        P(L('Niże nad Bałtykiem przychodzą najczęściej z zachodu lub południowego zachodu i przemieszczają się na wschód z prędkością 15–30 kn. Typowy niż ma front ciepły (przed nim – szeroki pas chmur warstwowych i ciągłych opadów), za nim wycinek ciepły (wilgotno, St, mżawka) i front chłodny (wąski pas Cb ze szkwałami). Front chłodny porusza się szybciej, dogania ciepły i tworzy okluzję.', 'Lows over the Baltic usually come from the west or south-west and move east at 15–30 kn. A typical low has a warm front (ahead of it – a broad belt of layered cloud and continuous rain), then the warm sector (humid, St, drizzle) and the cold front (a narrow belt of Cb with squalls). The cold front moves faster, catches up the warm one and forms an occlusion.')),
        exFig),
      entry(L('Front ciepły', 'Warm front'), svgBox(frontCrossSVG('warm')),
        table([L('', ''), L('Przed frontem', 'Ahead'), L('Podczas przejścia', 'Passage'), L('Za frontem', 'Behind')], [
          [L('Ciśnienie', 'Pressure'), L('stopniowo spada', 'falls steadily'), L('przestaje spadać', 'stops falling'), L('stałe lub powoli spada', 'steady or slowly falling')],
          [L('Wiatr', 'Wind'), L('wzmaga się, cofa się (np. na S)', 'increases, backs (e.g. to S)'), L('skręca w prawo', 'veers'), L('stały, np. SW', 'steady, e.g. SW')],
          [L('Chmury', 'Clouds'), 'Ci → Cs → As → Ns', 'Ns', L('St, Sc', 'St, Sc')],
          [L('Opady', 'Precipitation'), L('ciągłe, coraz silniejsze', 'continuous, increasing'), L('słabną', 'easing'), L('mżawka lub brak', 'drizzle or none')],
          [L('Widzialność', 'Visibility'), L('pogarsza się', 'deteriorates'), L('słaba', 'poor'), L('słaba, możliwa mgła', 'poor, fog possible')],
          [L('Temperatura', 'Temperature'), L('stała', 'steady'), L('rośnie', 'rises'), L('wyższa', 'higher')]])),
      entry(L('Front chłodny', 'Cold front'), svgBox(frontCrossSVG('cold')),
        table([L('', ''), L('Przed frontem', 'Ahead'), L('Podczas przejścia', 'Passage'), L('Za frontem', 'Behind')], [
          [L('Ciśnienie', 'Pressure'), L('spada', 'falls'), L('nagły wzrost', 'sudden rise'), L('szybko rośnie', 'rises quickly')],
          [L('Wiatr', 'Wind'), L('SW, wzmaga się', 'SW, increasing'), L('szkwał, gwałtownie skręca w prawo', 'squall, veers sharply'), L('W–NW, porywisty', 'W–NW, gusty')],
          [L('Chmury', 'Clouds'), L('Ac, As, nadciągający Cb', 'Ac, As, approaching Cb'), 'Cb', L('Cu, przelotne opady', 'Cu, showers')],
          [L('Opady', 'Precipitation'), L('czasem deszcz', 'some rain'), L('ulewa, grad, burza', 'downpour, hail, thunder'), L('przelotne', 'showers')],
          [L('Widzialność', 'Visibility'), L('umiarkowana', 'moderate'), L('w ulewie słaba', 'poor in the downpour'), L('bardzo dobra', 'very good')],
          [L('Temperatura', 'Temperature'), L('wysoka', 'high'), L('spada', 'falls'), L('niższa', 'lower')]])),
      entry(L('Wyż', 'High'), P(L('W wyżu powietrze osiada: zwykle jest słaby wiatr i ładna pogoda, latem z bryzą przy brzegu, jesienią i zimą często z mgłami i niskimi chmurami St. Wiatr bywa silny tylko na skraju wyżu, gdzie izobary zagęszczają się przy sąsiednim niżu.', 'In a high the air sinks: usually light winds and fair weather, in summer with sea breezes, in autumn and winter often with fog and low St. Strong winds occur only on the edge of a high, where the isobars crowd against a neighbouring low.')))
    ] },
    { id: 'chart', name: L('Mapa synoptyczna', 'Synoptic chart'), entries: [
      entry(L('Jak czytać mapę', 'How to read the chart'),
        P(L('Na mapie przyziemnej są izobary (co 4 hPa), ośrodki niżów (N) i wyżów (W) z ciśnieniem w środku, fronty oraz – na mapach z obserwacjami – symbole wiatru na stacjach. Kierunek wiatru wyznacza się z izobar: wiatr wieje wzdłuż nich tak, by niż był po lewej (patrząc z wiatrem), odchylony o ok. 15–20° do środka niżu. Siłę wiatru ocenia się z odstępu izobar – im gęściej, tym silniej.', 'A surface chart shows isobars (every 4 hPa), the centres of lows (L) and highs (H) with their pressure, fronts and – on plotted charts – wind symbols at stations. Wind direction follows the isobars with low pressure on the left (looking downwind), turned about 15–20° in towards the low. Wind strength comes from the isobar spacing – the closer, the stronger.')),
        svgBox(mapLegendSVG(), 'mb-fig mb-legend')),
      entry(L('Odstęp izobar a siła wiatru (ok. 55°N, nad morzem)', 'Isobar spacing and wind strength (about 55°N, over the sea)'),
        P(L('Przybliżone wartości dla izobar prostych co 4 hPa (wiatr przy powierzchni morza ≈ 70% wiatru geostroficznego). Wokół niżu wiatr jest nieco słabszy, wokół wyżu nieco silniejszy niż wynika z tabeli.', 'Approximate values for straight isobars every 4 hPa (surface wind over the sea ≈ 70% of the geostrophic wind). Around a low the wind is somewhat weaker, around a high somewhat stronger than the table suggests.')),
        table([L('Odstęp izobar', 'Isobar spacing'), L('Wiatr', 'Wind'), L('Siła', 'Force')], spacing)),
      entry(L('Symbole wiatru', 'Wind symbols'),
        P(L('Trzonek wskazuje, SKĄD wieje wiatr. Długa kreska oznacza 10 kn, krótka 5 kn, chorągiewka (trójkąt) 50 kn; kreski rysuje się na półkuli północnej po stronie niższego ciśnienia. Kółko bez trzonka – cisza.', 'The shaft points to where the wind comes FROM. A long barb means 10 kn, a short one 5 kn, a pennant (triangle) 50 kn; in the northern hemisphere the barbs are drawn on the low-pressure side. A circle without a shaft – calm.')),
        svgBox(barbFig))
    ] },
    { id: 'baro', name: L('Barometr', 'Barometer'), entries: [
      entry(L('Tendencja ciśnienia', 'Pressure tendency'),
        P(L('Ważniejsza od samej wartości ciśnienia jest jego zmiana. Odczyt barometru wpisuj do dziennika jachtowego co 3–4 godziny. W prognozach morskich tendencję w ciągu 3 godzin nazywa się tak:', 'More important than the reading itself is its change. Log the barometer every 3–4 hours. Marine forecasts describe the 3-hour tendency like this:')),
        table([L('Zmiana w 3 h', 'Change in 3 h'), L('Nazwa', 'Term')], [['< 0,1 hPa', L('bez zmian', 'steady')], ['0,1–1,5 hPa', L('powoli rośnie / spada', 'rising / falling slowly')], ['1,6–3,5 hPa', L('rośnie / spada', 'rising / falling')], ['3,6–6,0 hPa', L('szybko rośnie / spada', 'rising / falling quickly')], ['> 6,0 hPa', L('bardzo szybko rośnie / spada', 'rising / falling very rapidly')]]),
        P(L('Reguły praktyczne: spadek o 1 hPa na godzinę i więcej zapowiada silny wiatr, spadek o 6–10 hPa w 3 godziny – sztorm. Szybki wzrost po niżu oznacza silny, porywisty wiatr za frontem chłodnym. „Długo zapowiadana – długo trwa, krótko zapowiadana – szybko mija.”', 'Rules of thumb: a fall of 1 hPa per hour or more means strong wind, a fall of 6–10 hPa in 3 hours – a gale. A quick rise after a low means strong gusty winds behind a cold front. “Long foretold, long last; short notice, soon past.”'))),
      entry(L('Przykładowe zapisy barografu', 'Example barograph traces'),
        h('div.mb-row', {}, ...baroEx.map((q) => h('div', {}, svgBox(barographSVG(q.pts, true, q.d3)), h('p.small', {}, q.options.find((o) => o.id === q.kind).label)))))
    ] },
    { id: 'phen', name: L('Mgły, bryza, burze', 'Fog, breezes, storms'), entries: [
      entry(L('Bryza morska i lądowa', 'Sea and land breeze'),
        P(L('W słoneczny dzień przy słabym wietrze ogólnym ląd nagrzewa się szybciej niż woda i od morza zaczyna wiać bryza morska (od ok. 10–11, najsilniejsza po południu, 10–15 kn, sięga kilkanaście km od brzegu). Nocą jest odwrotnie – słabsza bryza lądowa wieje od lądu nad morze.', 'On a sunny day with a weak general wind the land heats faster than the water and a sea breeze sets in from the sea (from about 10–11 am, strongest in the afternoon, 10–15 kn, reaching a dozen or so km offshore). At night it reverses – a weaker land breeze blows from the land out to sea.')),
        h('div.mb-row', {}, svgBox(phenSVG({ type: 'breeze', day: true }, true)), svgBox(phenSVG({ type: 'breeze', day: false }, true)))),
      entry(L('Mgły', 'Fog'),
        P(L('Mgła adwekcyjna (morska) powstaje, gdy ciepłe, wilgotne powietrze napływa nad zimną wodę – na Bałtyku najczęściej wiosną i na początku lata. Może utrzymywać się wiele godzin, także przy wietrze 3–5°B. Mgła radiacyjna tworzy się nocą nad lądem przy bezchmurnym niebie i ciszy, spływa do portów i ujść rzek, zwykle znika przed południem. We mgle: sygnały dźwiękowe, radar/AIS, zmniejszona prędkość, światła nawigacyjne, kamizelki.', 'Advection (sea) fog forms when warm, moist air flows over cold water – on the Baltic mostly in spring and early summer. It may last for hours, even with Bft 3–5 winds. Radiation fog forms over land on clear calm nights, drifts into harbours and river mouths and usually clears by noon. In fog: sound signals, radar/AIS, reduced speed, navigation lights, lifejackets.')),
        h('div.mb-row', {}, svgBox(phenSVG({ type: 'fog', adv: true }, true)), svgBox(phenSVG({ type: 'fog', adv: false }, true)))),
      entry(L('Burze i szkwały', 'Thunderstorms and squalls'),
        P(L('Burze rozwijają się z chmur Cb – latem po południu nad lądem i w strefie frontu chłodnego. Przed chmurą często widać wał chmur (szkwałowy) – pod nim gwałtowny wzrost wiatru (porywy nawet 2× silniejsze), nagła zmiana kierunku, potem ulewa i grad. Odległość burzy: liczba sekund od błysku do grzmotu podzielona przez 3 daje kilometry.', 'Thunderstorms grow from Cb – in summer afternoons over land and along cold fronts. Ahead of the cloud there is often a roll (squall) cloud – beneath it a violent increase in wind (gusts up to 2× stronger), a sudden shift, then a downpour and hail. Distance: the seconds between flash and thunder divided by 3 give kilometres.')),
        P(L('Gdy nadchodzi Cb: zrefuj lub zrzuć żagle zawczasu, zamknij luki, załoga w kamizelkach i szelkach, oddal się od brzegu zawietrznego, unikaj dotykania want i masztu podczas wyładowań.', 'When a Cb approaches: reef or drop sail early, close the hatches, crew in lifejackets and harnesses, keep clear of a lee shore, avoid touching shrouds and mast during lightning.')),
        h('div.mb-row', {}, svgBox(phenSVG({ type: 'squall' }, true)), svgBox(phenSVG({ type: 'thunder', s: 9 }, true)))),
      entry(L('Wiatr przy brzegu', 'Wind near the coast'),
        P(L('Przy wysokim brzegu wiatr wiejący wzdłuż niego przyspiesza, a przy przylądkach zagęszcza się i skręca. Na zawietrznej wysokiego lądu wiatr jest słabszy, ale porywisty i zmienny – z nagłymi szkwałami spadającymi ze zboczy. Wiatr przeciwny do prądu (np. w cieśninach) tworzy krótką, stromą falę.', 'Along a high coast the wind blowing parallel to it accelerates, and around headlands it squeezes and bends. In the lee of high land the wind is lighter but gusty and shifting – with sudden squalls falling from the slopes. Wind against current (e.g. in straits) raises a short, steep sea.')))
    ] },
    { id: 'forecast', name: L('Prognozy', 'Forecasts'), entries: [
      entry(L('Skąd brać prognozy', 'Where to get forecasts'),
        P(L('Prognozy i ostrzeżenia dla żeglugi nadają stacje brzegowe przez radio UKF (kanał roboczy ogłaszany na kanale 16), system NAVTEX oraz służby meteorologiczne w internecie (dla polskiego wybrzeża – IMGW-PIB). Dodatkowo warto przeglądać modele numeryczne (np. ECMWF, ICON, GFS) – pamiętając, że pokazują średni wiatr, a nie porywy.', 'Forecasts and warnings for shipping are broadcast by coast stations on VHF (working channel announced on channel 16), by NAVTEX and published online by met services. Numerical models (e.g. ECMWF, ICON, GFS) are useful too – remembering that they show the mean wind, not the gusts.')),
        P(L('Prognozę sprawdzaj przed wyjściem i regularnie w trakcie rejsu, porównuj ją z tym, co widzisz (chmury, barometr, morze). Planuj z zapasem: na wiatr o 1–2°B silniejszy od prognozowanego.', 'Check the forecast before leaving and regularly during the passage, and compare it with what you see (clouds, barometer, sea). Plan with a margin: for wind 1–2 Bft stronger than forecast.'))),
      entry(L('Słownik prognozy morskiej', 'Marine forecast glossary'),
        table([L('Termin', 'Term'), L('Znaczenie', 'Meaning')], [
          [L('wiatr skręcający', 'veering'), L('zmienia kierunek zgodnie z ruchem wskazówek zegara', 'changes direction clockwise')],
          [L('wiatr cofający się', 'backing'), L('zmienia kierunek przeciwnie do ruchu wskazówek zegara', 'changes direction anticlockwise')],
          [L('porywy', 'gusts'), L('chwilowa prędkość wiatru wyraźnie większa od średniej', 'brief wind speed well above the mean')],
          [L('sztorm', 'gale'), L('wiatr 8°B (34–40 kn) lub porywy powyżej 43 kn – ostrzeżenie sztormowe', 'Bft 8 (34–40 kn) or gusts above 43 kn – gale warning')],
          [L('widzialność dobra', 'good visibility'), L('powyżej 5 Mm', 'more than 5 NM')],
          [L('widzialność umiarkowana', 'moderate visibility'), '2–5 Mm'],
          [L('widzialność słaba', 'poor visibility'), L('od 1000 m do 2 Mm', '1000 m to 2 NM')],
          [L('mgła', 'fog'), L('widzialność poniżej 1000 m', 'visibility less than 1000 m')],
          [L('stan morza', 'sea state'), L('wysokość fal (np. 2–3 m) – na Bałtyku fala jest krótka i stroma', 'wave height (e.g. 2–3 m) – on the Baltic the sea is short and steep')]])),
      entry(L('Oznaki zmiany pogody', 'Signs of a change'),
        P(L('Pogorszenie: Ci nasuwające się od zachodu i gęstniejące w Cs (halo), potem As; spadek ciśnienia; wiatr cofający się i wzmagający; dobra słyszalność i „przejrzystość” powietrza przed frontem; rosnące rano wieże Ac castellanus lub Cu.', 'Deterioration: Ci spreading from the west and thickening into Cs (halo), then As; falling pressure; a backing, freshening wind; sounds carrying far and unusually clear air ahead of a front; turreted Ac castellanus or growing Cu in the morning.')),
        P(L('Poprawa: rosnące ciśnienie, wiatr skręcający na NW i słabnący, chmury Cu rozpadające się wieczorem, rosa i mgła rano (wyż).', 'Improvement: rising pressure, wind veering to NW and easing, Cu dissolving in the evening, dew and morning fog (high).')))
    ] }
  ];
}
