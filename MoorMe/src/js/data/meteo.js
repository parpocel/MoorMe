// Dział „Meteorologia”: skala Beauforta, rodzaje chmur, mapa synoptyczna (izobary, fronty, wiatr),
// barograf i zjawiska pogodowe ważne dla żeglarza. Czysta logika i dane – bez DOM i Three.js (testowane w Node).
import { getLang } from '../i18n.js';
import { rng, DEG } from '../math.js';

const L = (pl, en) => (getLang() === 'en' ? en : pl);
const tx = (a) => (Array.isArray(a) ? L(a[0], a[1]) : a);
const pick = (r, a) => a[Math.floor(r() * a.length)];
function shuffle(r, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// ---------------- skala Beauforta (WMO) ----------------
// kn – zakres prędkości w węzłach, ms – w m/s, h – prawdopodobna wysokość fali [m], hMax – maksymalna,
// T – okres fali dominującej na akwenie o ograniczonym rozbiegu (Bałtyk) [s] – używany w scenie 3D
// foam – udział białych grzyw, streak – pasma piany, spray – bryzgi, haze – zamglenie od bryzgów (0–1)
const BFT = [
  { kn: [0, 1], ms: [0, 0.2], h: 0, hMax: 0, T: 1.2, foam: 0, streak: 0, spray: 0, haze: 0,
    n: ['Cisza', 'Calm'], sea: ['Morze gładkie jak lustro.', 'Sea like a mirror.'],
    y: ['Żagle łopoczą – płynie się na silniku.', 'Sails flap – motor.'] },
  { kn: [1, 3], ms: [0.3, 1.5], h: 0.1, hMax: 0.1, T: 1.4, foam: 0, streak: 0, spray: 0, haze: 0,
    n: ['Powiew', 'Light air'], sea: ['Zmarszczki w kształcie łusek, bez grzebieni piany.', 'Ripples with the appearance of scales, but without foam crests.'],
    y: ['Jacht ledwo sterowny, łódki z lekkim ożaglowaniem płyną.', 'A yacht barely has steerage way.'] },
  { kn: [4, 6], ms: [1.6, 3.3], h: 0.2, hMax: 0.3, T: 2.0, foam: 0, streak: 0, spray: 0, haze: 0,
    n: ['Słaby wiatr', 'Light breeze'], sea: ['Małe fale, jeszcze krótkie, ale wyraźne; grzbiety mają szklisty wygląd i nie załamują się.', 'Small wavelets, still short but more pronounced; crests have a glassy appearance and do not break.'],
    y: ['Spokojna żegluga na pełnych żaglach.', 'Gentle sailing under full sail.'] },
  { kn: [7, 10], ms: [3.4, 5.4], h: 0.6, hMax: 1, T: 2.6, foam: 0.012, streak: 0, spray: 0, haze: 0,
    n: ['Łagodny wiatr', 'Gentle breeze'], sea: ['Bardzo małe fale; grzbiety zaczynają się załamywać, piana o szklistym wyglądzie, gdzieniegdzie białe grzywy („baranki”).', 'Large wavelets; crests begin to break; foam of glassy appearance; perhaps scattered white horses.'],
    y: ['Bardzo dobre warunki – jacht wyraźnie się przechyla.', 'Very good sailing – the yacht heels noticeably.'] },
  { kn: [11, 16], ms: [5.5, 7.9], h: 1, hMax: 1.5, T: 3.3, foam: 0.045, streak: 0, spray: 0, haze: 0,
    n: ['Umiarkowany wiatr', 'Moderate breeze'], sea: ['Małe fale, coraz dłuższe; dość liczne białe grzywy.', 'Small waves, becoming longer; fairly frequent white horses.'],
    y: ['Dobra żegluga; na małych jachtach pora pomyśleć o refie.', 'Good sailing; small yachts start thinking about reefing.'] },
  { kn: [17, 21], ms: [8, 10.7], h: 2, hMax: 2.5, T: 4.5, foam: 0.1, streak: 0, spray: 0.08, haze: 0,
    n: ['Dość silny wiatr', 'Fresh breeze'], sea: ['Umiarkowane fale o wyraźnie wydłużonym kształcie; wiele białych grzyw, możliwe pojedyncze bryzgi.', 'Moderate waves, taking a more pronounced long form; many white horses are formed; chance of some spray.'],
    y: ['Pierwszy ref – dla początkujących załóg granica komfortu.', 'First reef – the comfort limit for beginner crews.'] },
  { kn: [22, 27], ms: [10.8, 13.8], h: 3, hMax: 4, T: 5.3, foam: 0.17, streak: 0.06, spray: 0.25, haze: 0.03,
    n: ['Silny wiatr', 'Strong breeze'], sea: ['Zaczynają tworzyć się duże fale; białe grzbiety piany są wszędzie rozleglejsze, prawdopodobne bryzgi.', 'Large waves begin to form; the white foam crests are more extensive everywhere; probably some spray.'],
    y: ['Drugi ref i mniejszy fok; kamizelki i szelki asekuracyjne. „Wiatr jachtowy” się skończył.', 'Second reef and a smaller jib; lifejackets and harnesses on.'] },
  { kn: [28, 33], ms: [13.9, 17.1], h: 4, hMax: 5.5, T: 6.2, foam: 0.26, streak: 0.3, spray: 0.45, haze: 0.07,
    n: ['Bardzo silny wiatr', 'Near gale'], sea: ['Morze się spiętrza; biała piana z załamujących się fal zaczyna być wywiewana w pasmach w kierunku wiatru.', 'Sea heaps up and white foam from breaking waves begins to be blown in streaks along the direction of the wind.'],
    y: ['Trzeci ref i sztormfok; z portu wychodzi się tylko z konieczności.', 'Third reef and storm jib; leave harbour only if you must.'] },
  { kn: [34, 40], ms: [17.2, 20.7], h: 5.5, hMax: 7.5, T: 7.2, foam: 0.36, streak: 0.55, spray: 0.65, haze: 0.13,
    n: ['Sztorm', 'Gale'], sea: ['Umiarkowanie wysokie fale o większej długości; krawędzie grzbietów odrywają się w bryzgi; piana wywiewana w wyraźnych pasmach.', 'Moderately high waves of greater length; edges of crests begin to break into spindrift; foam is blown in well-marked streaks along the direction of the wind.'],
    y: ['Sztormowanie na sztormżaglach albo w dryfie; jachty powinny być w porcie.', 'Heave to or run under storm sails; yachts should be in harbour.'] },
  { kn: [41, 47], ms: [20.8, 24.4], h: 7, hMax: 10, T: 8.2, foam: 0.48, streak: 0.75, spray: 0.85, haze: 0.22,
    n: ['Silny sztorm', 'Strong gale'], sea: ['Wysokie fale; gęste pasma piany; grzbiety fal zaczynają się przewracać i przewalać; bryzgi mogą ograniczać widzialność.', 'High waves; dense streaks of foam along the direction of the wind; crests of waves begin to topple, tumble and roll over; spray may affect visibility.'],
    y: ['Walka o bezpieczeństwo jachtu i załogi.', 'Fighting for the safety of yacht and crew.'] },
  { kn: [48, 55], ms: [24.5, 28.4], h: 9, hMax: 12.5, T: 9.2, foam: 0.68, streak: 0.92, spray: 1, haze: 0.34,
    n: ['Bardzo silny sztorm', 'Storm'], sea: ['Bardzo wysokie fale z długimi, nawisającymi grzbietami; piana w wielkich płatach – morze wygląda na białe; przewalanie fal jest ciężkie i uderzeniowe; widzialność ograniczona.', 'Very high waves with long overhanging crests; the foam is blown in dense white streaks – the sea takes on a white appearance; the tumbling of the sea becomes heavy and shock-like; visibility affected.'],
    y: ['Warunki skrajnie niebezpieczne.', 'Extremely dangerous conditions.'] },
  { kn: [56, 63], ms: [28.5, 32.6], h: 11.5, hMax: 16, T: 10.2, foam: 0.82, streak: 1, spray: 1, haze: 0.45,
    n: ['Gwałtowny sztorm', 'Violent storm'], sea: ['Wyjątkowo wysokie fale; morze pokryte długimi białymi płatami piany; wszędzie krawędzie grzbietów zwiewane w pianę; widzialność ograniczona.', 'Exceptionally high waves; the sea is completely covered with long white patches of foam; everywhere the edges of the wave crests are blown into froth; visibility affected.'],
    y: ['Warunki skrajnie niebezpieczne.', 'Extremely dangerous conditions.'] },
  { kn: [64, 99], ms: [32.7, 60], h: 14, hMax: 18, T: 11, foam: 0.95, streak: 1, spray: 1, haze: 0.6,
    n: ['Huragan', 'Hurricane'], sea: ['Powietrze wypełnione pianą i bryzgami; morze całkowicie białe; widzialność bardzo poważnie ograniczona.', 'The air is filled with foam and spray; sea completely white with driving spray; visibility very seriously affected.'],
    y: ['Warunki skrajnie niebezpieczne.', 'Extremely dangerous conditions.'] }
];
export function beaufort(f) {
  const b = BFT[Math.max(0, Math.min(12, Math.round(f)))];
  return { ...b, f: BFT.indexOf(b), name: tx(b.n), seaText: tx(b.sea), yacht: tx(b.y),
    knText: b.kn[0] === 0 ? '< 1' : b.kn[1] >= 99 ? `≥ ${b.kn[0]}` : `${b.kn[0]}–${b.kn[1]}`,
    msText: b.ms[1] >= 60 ? `≥ ${b.ms[0]}` : `${b.ms[0].toFixed(1)}–${b.ms[1].toFixed(1)}`.replace(/\./g, getLang() === 'en' ? '.' : ',') };
}
export const BFT_MAX = 12;
// siła wiatru w skali Beauforta dla prędkości w węzłach
export function knToBft(kn) { for (let f = 12; f >= 0; f--) if (kn >= BFT[f].kn[0] - (f ? 0.5 : 0)) return f; return 0; }
// średnia prędkość wiatru w danej skali (do sceny 3D)
export const bftKn = (f) => (f >= 12 ? 70 : (BFT[f].kn[0] + BFT[f].kn[1]) / 2);

// ---------------- rodzaje chmur (10 rodzajów WMO) ----------------
// level: high – piętro wysokie (5–13 km), mid – średnie (2–7 km), low – niskie (< 2 km), vert – o budowie pionowej
const CLOUDS = [
  { id: 'Ci', latin: 'Cirrus', level: 'high', mean: 'front', n: ['Pierzaste', 'Cirrus'],
    look: ['Białe, włókniste pasma i „haczyki” (końskie ogony) na niebieskim niebie, bez cieni.', 'White fibrous strands and hooks (mares’ tails) on a blue sky, without shading.'],
    wx: ['Pojedyncze – ładna pogoda. Gęstniejące, z haczykami, nasuwające się od zachodu – za ok. 12–24 h pogorszenie: nadciąga front ciepły.', 'Isolated – fair weather. Thickening hooked cirrus spreading from the west – deterioration in about 12–24 h: a warm front is approaching.'] },
  { id: 'Cc', latin: 'Cirrocumulus', level: 'high', mean: 'fair', n: ['Kłębiasto-pierzaste', 'Cirrocumulus'],
    look: ['Drobne białe ziarenka i zmarszczki ułożone w rzędy („baranki”, „rybia łuska”), bez cieni.', 'Small white grains and ripples in rows (a “mackerel sky”), without shading.'],
    wx: ['Zwykle pogoda bez zmian; gdy przechodzą w Cs – zapowiedź pogorszenia.', 'Usually no change; when they turn into Cs – a sign of deterioration.'] },
  { id: 'Cs', latin: 'Cirrostratus', level: 'high', mean: 'front', n: ['Warstwowo-pierzaste', 'Cirrostratus'],
    look: ['Cienka, mlecznobiała zasłona na całym niebie; wokół Słońca lub Księżyca halo – jasny pierścień o promieniu 22°.', 'A thin, milky veil over the whole sky; a halo – a bright 22° ring – around the Sun or Moon.'],
    wx: ['Za ok. 12–24 h opady i wzrost wiatru – nadciąga front ciepły.', 'Rain and increasing wind in about 12–24 h – a warm front is approaching.'] },
  { id: 'Ac', latin: 'Altocumulus', level: 'mid', mean: 'unstable', n: ['Średnie kłębiaste', 'Altocumulus'],
    look: ['Białe lub szare płaty i kłębki w rzędach, z wyraźnym cieniowaniem, większe niż Cc.', 'White or grey patches and rolls in rows, with clear shading, larger than Cc.'],
    wx: ['Pogoda zmienna; wypiętrzone kłębki (Ac castellanus) rano zapowiadają burze po południu.', 'Changeable weather; turreted tufts (Ac castellanus) in the morning herald afternoon thunderstorms.'] },
  { id: 'As', latin: 'Altostratus', level: 'mid', mean: 'rainSoon', n: ['Średnie warstwowe', 'Altostratus'],
    look: ['Szara lub niebieskawa, jednolita warstwa; Słońce widać jak przez matowe szkło, bez halo, przedmioty nie rzucają cieni.', 'A grey or bluish uniform sheet; the Sun shows as through ground glass, no halo, no shadows.'],
    wx: ['Opady w ciągu kilku godzin – front ciepły jest blisko.', 'Rain within a few hours – the warm front is close.'] },
  { id: 'Ns', latin: 'Nimbostratus', level: 'low', mean: 'rain', n: ['Warstwowe deszczowe', 'Nimbostratus'],
    look: ['Ciemnoszara, gruba warstwa zasłaniająca Słońce; z niej ciągły deszcz lub śnieg, pod spodem postrzępione chmury.', 'A dark grey thick layer hiding the Sun; continuous rain or snow falls from it, ragged clouds beneath.'],
    wx: ['Długotrwałe, ciągłe opady i słaba widzialność.', 'Prolonged continuous precipitation and poor visibility.'] },
  { id: 'Sc', latin: 'Stratocumulus', level: 'low', mean: 'dull', n: ['Kłębiasto-warstwowe', 'Stratocumulus'],
    look: ['Szare i białawe, grube bryły i wałki w niskiej warstwie, często z prześwitami błękitu.', 'Grey and whitish lumps and rolls in a low layer, often with breaks of blue.'],
    wx: ['Pochmurno, najwyżej słabe opady; pogoda zwykle bez większych zmian.', 'Cloudy, at most light precipitation; usually little change.'] },
  { id: 'St', latin: 'Stratus', level: 'low', mean: 'drizzle', n: ['Warstwowe', 'Stratus'],
    look: ['Jednolita, szara, bardzo niska warstwa jak uniesiona mgła; zasłania wierzchołki wzgórz.', 'A uniform grey, very low layer like lifted fog; hides hilltops.'],
    wx: ['Mżawka i słaba widzialność; po nocy może przejść we mgłę.', 'Drizzle and poor visibility; may lower into fog.'] },
  { id: 'Cu', latin: 'Cumulus', level: 'vert', mean: 'fair', n: ['Kłębiaste', 'Cumulus'],
    look: ['Oddzielne, gęste chmury o płaskiej podstawie i białych, kalafiorowatych wierzchołkach.', 'Detached dense clouds with flat bases and white cauliflower tops.'],
    wx: ['Małe i płaskie – ładna pogoda. Gdy rosną w wysokie wieże (Cu congestus) – przelotne opady, możliwy rozwój w Cb.', 'Small and flat – fair weather. Growing into tall towers (Cu congestus) – showers, possibly turning into Cb.'] },
  { id: 'Cb', latin: 'Cumulonimbus', level: 'vert', mean: 'storm', n: ['Kłębiaste deszczowe (burzowe)', 'Cumulonimbus'],
    look: ['Ogromna, wysoka chmura o ciemnej podstawie; wierzchołek rozpływa się w płaskie kowadło; pod nią smugi ulewy.', 'A huge tall cloud with a dark base; the top spreads into a flat anvil; curtains of rain beneath.'],
    wx: ['Burza: gwałtowne szkwały, ulewa, grad, wyładowania. Zredukuj żagle zanim chmura nadejdzie!', 'Thunderstorm: violent squalls, downpour, hail, lightning. Reduce sail before it arrives!'] }
];
const MEANINGS = {
  fair: ['Ładna pogoda – bez większych zmian', 'Fair weather – little change'],
  front: ['Za ok. 12–24 h pogorszenie – nadciąga front ciepły', 'Deterioration in about 12–24 h – a warm front is approaching'],
  rainSoon: ['Opady w ciągu kilku godzin', 'Rain within a few hours'],
  unstable: ['Pogoda zmienna – później możliwe burze', 'Changeable – thunderstorms possible later'],
  dull: ['Pochmurno, najwyżej słabe opady', 'Cloudy, at most light precipitation'],
  rain: ['Długotrwałe, ciągłe opady', 'Prolonged, continuous rain'],
  drizzle: ['Mżawka i słaba widzialność', 'Drizzle and poor visibility'],
  storm: ['Burza: szkwał, ulewa, grad – zredukuj żagle!', 'Thunderstorm: squall, downpour, hail – reduce sail!']
};
const LEVELS = { high: ['piętro wysokie (5–13 km)', 'high level (5–13 km)'], mid: ['piętro średnie (2–7 km)', 'middle level (2–7 km)'], low: ['piętro niskie (do 2 km)', 'low level (below 2 km)'], vert: ['budowa pionowa – podstawa nisko, wierzchołek nawet do 12 km', 'vertical development – low base, tops up to 12 km'] };
export function clouds() { return CLOUDS.map((c) => cloud(c.id)); }
export function cloud(id) {
  const c = CLOUDS.find((q) => q.id === id);
  return c && { id: c.id, latin: c.latin, level: c.level, levelText: tx(LEVELS[c.level]), name: tx(c.n), look: tx(c.look), weather: tx(c.wx), mean: c.mean, meanText: tx(MEANINGS[c.mean]) };
}
export const CLOUD_IDS = CLOUDS.map((c) => c.id);
export function meanings() { return Object.keys(MEANINGS).map((id) => ({ id, label: tx(MEANINGS[id]) })); }

// ---------------- kierunki ----------------
const DIRS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const DIRS16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const norm360 = (d) => ((d % 360) + 360) % 360;
export const dir8 = (deg) => DIRS8[Math.round(norm360(deg) / 45) % 8];
export const dir16 = (deg) => DIRS16[Math.round(norm360(deg) / 22.5) % 16];
export const DIR8 = DIRS8;
export const dirDeg = (name) => DIRS8.indexOf(name) * 45;
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// ---------------- mapa synoptyczna: Europa Północna ----------------
// Odwzorowanie równoodległościowe: lon/lat → km (oś y na północ), skala długości dla 57°N
const LON0 = -11, LON1 = 33, LAT0 = 47.5, LAT1 = 66.5, KX = 111.32 * Math.cos(57 * DEG), KY = 111.32;
export const MAP = { w: (LON1 - LON0) * KX, h: (LAT1 - LAT0) * KY, lon0: LON0, lon1: LON1, lat0: LAT0, lat1: LAT1 };
export const toXY = (lon, lat) => [(lon - LON0) * KX, (lat - LAT0) * KY];
export const toLonLat = (x, y) => [LON0 + x / KX, LAT0 + y / KY];
// uproszczona linia brzegowa (lon, lat) – wystarczająca w skali mapy synoptycznej
const LAND_LL = [
  // kontynent: Francja – Niemcy – Polska – kraje bałtyckie – Rosja – Finlandia (zamknięty przez prawą i dolną krawędź)
  [[-12, 47], [-2.5, 47.2], [-4.6, 48.0], [-4.7, 48.6], [-3.0, 48.8], [-1.6, 48.7], [-1.9, 49.7], [-1.2, 49.4], [0.2, 49.5], [1.6, 50.2], [1.7, 50.9], [2.6, 51.1], [3.6, 51.4], [4.2, 52.0], [4.7, 52.9], [5.4, 53.4], [7.0, 53.6], [8.3, 53.5], [8.7, 53.9], [8.6, 54.9], [8.1, 55.5], [8.1, 56.6], [8.6, 57.1], [10.6, 57.75], [10.4, 57.0], [10.3, 56.3], [10.9, 56.3], [10.2, 55.8], [9.6, 55.2], [9.9, 54.8], [10.3, 54.4], [11.0, 54.3], [11.3, 54.0], [12.3, 54.3], [13.2, 54.5], [13.6, 54.6], [13.8, 54.1], [14.3, 53.9], [15.0, 54.0], [16.2, 54.25], [17.0, 54.6], [18.3, 54.83], [18.8, 54.6], [18.6, 54.4], [19.4, 54.4], [19.9, 54.6], [20.0, 54.95], [21.1, 55.2], [21.1, 56.0], [21.0, 56.5], [21.5, 57.4], [22.6, 57.75], [23.2, 57.2], [24.1, 57.0], [24.4, 57.6], [24.5, 58.4], [23.6, 58.6], [23.5, 59.0], [24.1, 59.3], [24.8, 59.45], [26.0, 59.6], [27.9, 59.4], [29.0, 59.9], [30.3, 59.95], [29.3, 60.2], [28.7, 60.7], [27.5, 60.5], [26.0, 60.4], [25.0, 60.2], [23.9, 60.0], [23.0, 59.85], [22.6, 60.3], [21.4, 60.6], [21.5, 61.6], [21.3, 62.3], [21.6, 63.1], [22.6, 63.7], [23.8, 64.2], [24.8, 64.8], [25.4, 65.0], [25.2, 65.5], [24.2, 65.8], [24.0, 67], [34, 67], [34, 47]],
  // Półwysep Skandynawski
  [[24.0, 67], [24.0, 65.8], [22.6, 65.75], [22.1, 65.55], [21.4, 64.8], [20.3, 63.8], [19.0, 63.2], [17.8, 62.6], [17.4, 62.0], [17.3, 61.0], [17.2, 60.7], [18.4, 60.3], [19.0, 59.9], [18.6, 59.4], [18.1, 59.3], [17.8, 58.9], [16.7, 58.6], [16.5, 57.9], [16.6, 57.3], [16.4, 56.7], [15.9, 56.1], [15.6, 56.2], [14.7, 56.1], [14.2, 55.4], [13.4, 55.35], [12.9, 55.5], [13.0, 55.7], [12.7, 56.0], [12.9, 56.4], [12.3, 56.9], [11.9, 57.6], [11.6, 58.3], [11.2, 58.9], [10.8, 59.2], [10.6, 59.0], [10.0, 59.0], [9.4, 58.7], [8.0, 58.1], [7.0, 58.0], [6.2, 58.3], [5.6, 58.8], [5.5, 59.3], [5.2, 59.9], [5.0, 60.6], [5.0, 61.3], [5.3, 62.0], [6.2, 62.5], [7.0, 62.9], [8.0, 63.2], [8.8, 63.6], [10.3, 64.3], [11.5, 65.0], [12.3, 66.0], [13.0, 67]],
  // wyspy
  [[11.0, 55.25], [11.1, 55.75], [11.9, 56.05], [12.6, 56.05], [12.6, 55.6], [12.2, 55.2], [11.8, 55.0]], // Zelandia
  [[9.75, 55.5], [10.25, 55.6], [10.8, 55.3], [10.6, 55.05], [10.05, 55.05]], // Fionia
  [[11.2, 54.95], [11.9, 54.95], [12.1, 54.75], [11.4, 54.65]], // Lolland–Falster
  [[14.7, 55.1], [14.8, 55.3], [15.1, 55.2], [15.15, 55.02], [14.85, 54.99]], // Bornholm
  [[18.1, 57.25], [18.4, 57.7], [18.8, 57.9], [19.15, 57.95], [18.9, 57.4], [18.5, 56.95], [18.2, 57.0]], // Gotlandia
  [[16.4, 56.2], [16.9, 57.0], [17.1, 57.35], [16.95, 57.35], [16.5, 56.7]], // Olandia
  [[21.8, 58.3], [22.3, 58.6], [23.3, 58.5], [22.8, 58.0], [22.0, 57.95]], // Sarema
  [[22.4, 58.75], [22.6, 59.0], [23.0, 58.95], [22.9, 58.7]], // Hiuma
  // Wielka Brytania i Irlandia
  [[-5.7, 50.05], [-4.2, 50.35], [-3.0, 50.65], [-1.2, 50.75], [0.4, 50.8], [1.4, 51.15], [1.4, 51.4], [0.9, 51.8], [1.75, 52.5], [1.6, 52.9], [0.3, 53.0], [0.2, 53.6], [-0.1, 54.4], [-1.2, 54.6], [-1.6, 55.6], [-2.2, 56.0], [-2.6, 56.4], [-2.0, 57.1], [-1.8, 57.6], [-3.3, 57.7], [-3.1, 58.6], [-5.0, 58.6], [-5.4, 57.9], [-5.7, 57.2], [-5.6, 56.5], [-5.9, 56.0], [-5.1, 55.4], [-4.9, 54.85], [-3.6, 54.9], [-3.2, 54.1], [-3.0, 53.4], [-4.6, 53.3], [-4.1, 52.6], [-4.5, 52.2], [-5.2, 51.8], [-4.2, 51.55], [-3.1, 51.4], [-3.4, 51.2], [-4.5, 51.1], [-5.1, 50.5]],
  [[-6.3, 52.2], [-6.0, 53.2], [-6.1, 54.0], [-5.6, 54.5], [-6.2, 55.2], [-7.4, 55.3], [-8.4, 55.1], [-8.6, 54.4], [-9.9, 54.2], [-10.0, 53.4], [-9.3, 53.1], [-9.9, 52.5], [-10.4, 51.9], [-9.6, 51.55], [-8.2, 51.8], [-7.2, 52.15]]
];
export const LAND = LAND_LL.map((poly) => poly.map(([lo, la]) => toXY(lo, la)));
export function isLand(x, y) {
  let inside = false;
  for (const poly of LAND) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}
// akweny, na których stawiamy jacht (lon, lat)
const SEA_SPOTS = [
  { ll: [16.8, 55.2], n: ['Bałtyk Południowy', 'Southern Baltic'] },
  { ll: [19.0, 54.75], n: ['Zatoka Gdańska', 'Gulf of Gdansk'] },
  { ll: [14.3, 54.75], n: ['Zatoka Pomorska', 'Pomeranian Bay'] },
  { ll: [13.6, 55.05], n: ['Cieśnina Bornholmska', 'Bornholm Strait'] },
  { ll: [19.8, 56.9], n: ['Bałtyk Środkowy', 'Central Baltic'] },
  { ll: [20.3, 58.6], n: ['Bałtyk Północny', 'Northern Baltic'] },
  { ll: [25.0, 59.85], n: ['Zatoka Fińska', 'Gulf of Finland'] },
  { ll: [19.6, 61.6], n: ['Morze Botnickie', 'Bothnian Sea'] },
  { ll: [11.5, 57.0], n: ['Kattegat', 'Kattegat'] },
  { ll: [9.0, 57.95], n: ['Skagerrak', 'Skagerrak'] },
  { ll: [4.0, 55.5], n: ['Morze Północne', 'North Sea'] },
  { ll: [2.4, 52.9], n: ['Południowa część Morza Północnego', 'Southern North Sea'] },
  { ll: [4.0, 60.6], n: ['Północna część Morza Północnego', 'Northern North Sea'] },
  { ll: [23.0, 57.6], n: ['Zatoka Ryska', 'Gulf of Riga'] }
];
export function seaSpots() { return SEA_SPOTS.map((s) => { const [x, y] = toXY(...s.ll); return { x, y, name: tx(s.n) }; }); }

// odległość punktu od łamanej + pozycja wzdłuż niej (0–1) i strona (+1 – po prawej patrząc wzdłuż łamanej)
function polyDist(px, py, pts) {
  let best = { d: Infinity, s: 0, side: 1 }, acc = 0;
  const lens = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(l); tot += l; }
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    const d = Math.hypot(px - (ax + dx * k), py - (ay + dy * k));
    if (d < best.d) best = { d, s: (acc + k * lens[i - 1]) / tot, side: dx * (py - ay) - dy * (px - ax) < 0 ? 1 : -1 };
    acc += lens[i - 1];
  }
  return best;
}
// łamana z zakrzywionym kursem: start, kurs początkowy i końcowy (stopnie kompasowe), długość [km]
function curve(x, y, h0, h1, len, n = 14) {
  const pts = [[x, y]];
  for (let i = 1; i <= n; i++) {
    const h = (h0 + (h1 - h0) * (i - 0.5) / n) * DEG, st = len / n;
    x += Math.sin(h) * st; y += Math.cos(h) * st;
    pts.push([x, y]);
  }
  return pts;
}

// Pole ciśnienia: tło + niże/wyże (gaussowskie) + zatoki niskiego ciśnienia wzdłuż frontów (załamania izobar)
export function pressureAt(S, x, y) {
  let p = S.base + (S.gx * (x - MAP.w / 2) + S.gy * (y - MAP.h / 2)) / 1000;
  for (const c of S.centers) { const r2 = ((x - c.x) ** 2 + (y - c.y) ** 2) / (c.r * c.r); p += c.d * (0.65 * Math.exp(-r2) + 0.35 / (1 + r2)); }
  for (const f of S.fronts) {
    const q = polyDist(x, y, f.pts);
    p -= f.trough * Math.exp(-((q.d / f.width) ** 2)) * (1 - q.s * q.s * 0.85);
  }
  return p;
}
// Wiatr przy powierzchni morza: geostroficzny (równoległy do izobar, niż po lewej) skręcony o ok. 20° w stronę niskiego ciśnienia, ok. 70% prędkości
export function windAt(S, x, y) {
  const e = 4, gx = (pressureAt(S, x + e, y) - pressureAt(S, x - e, y)) / (2 * e), gy = (pressureAt(S, x, y + e) - pressureAt(S, x, y - e)) / (2 * e);
  const g = Math.hypot(gx, gy) * 0.1; // hPa/km → Pa/m
  const lat = toLonLat(x, y)[1] * DEG, f = 2 * 7.2921e-5 * Math.sin(lat);
  const vg = g / (1.25 * f);
  let ux = -gy, uy = gx; const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n;
  const a = 20 * DEG, c = Math.cos(a), s = Math.sin(a);
  const vx = ux * c - uy * s, vy = ux * s + uy * c; // obrót w lewo (w stronę niżu)
  const kn = Math.min(75, (0.7 * vg) / 0.514444);
  const toward = norm360(Math.atan2(vx, vy) / DEG);
  return { kn, from: norm360(toward + 180), to: toward, grad: g };
}

// Scenariusz mapy synoptycznej (losowy, powtarzalny dla ziarna)
export function makeSynoptic(seed) {
  const r = rng(seed), R = (a, b) => a + r() * (b - a);
  const T = pick(r, ['scand', 'north', 'baltic', 'highBaltic']);
  const P = (lon, lat) => toXY(lon, lat);
  let low, high, low2 = null;
  if (T === 'scand') { low = P(R(4, 14), R(60.5, 64.5)); high = P(R(-9, -2), R(47.5, 50.5)); }
  else if (T === 'north') { low = P(R(0, 7), R(55.5, 59.5)); high = P(R(27, 32), R(55, 60)); }
  else if (T === 'baltic') { low = P(R(17, 25), R(55.5, 59)); high = P(R(-8, -2), R(52, 57)); }
  else { high = P(R(15, 22), R(55, 58.5)); low = P(R(-9, -3), R(60, 64)); low2 = r() < 0.5 ? P(R(26, 32), R(49, 52)) : null; }
  const dLow = T === 'highBaltic' ? R(-22, -14) : R(-36, -20);
  const S = {
    T, base: R(1010, 1014), gx: R(-1.5, 1.5), gy: R(-1.5, 1.5),
    centers: [
      { kind: 'L', x: low[0], y: low[1], d: dLow, r: R(520, 760) },
      { kind: 'H', x: high[0], y: high[1], d: R(14, 22), r: R(700, 1000) }
    ],
    fronts: [], move: { dir: R(65, 105), kn: Math.round(R(15, 30)) }
  };
  if (low2) S.centers.push({ kind: 'L', x: low2[0], y: low2[1], d: R(-14, -8), r: R(400, 600) });
  // fronty niżu głównego: okluzja od ośrodka do punktu potrójnego, ciepły na wschód–południowy wschód, chłodny na południe–południowy zachód
  if (T !== 'highBaltic') {
    const occ = R(140, 360), ho = R(115, 160);
    const tp = [low[0] + Math.sin(ho * DEG) * occ, low[1] + Math.cos(ho * DEG) * occ];
    S.fronts.push({ kind: 'occluded', pts: curve(low[0], low[1], ho - 25, ho, occ, 6), trough: R(3, 5), width: 110 });
    S.fronts.push({ kind: 'warm', pts: curve(tp[0], tp[1], R(95, 115), R(125, 150), R(650, 950)), trough: R(2.5, 4), width: 140 });
    S.fronts.push({ kind: 'cold', pts: curve(tp[0], tp[1], R(190, 205), R(215, 240), R(900, 1250)), trough: R(3.5, 5.5), width: 120 });
  }
  S.centers.forEach((c) => { c.p = Math.round(pressureAt(S, c.x, c.y)); });
  return S;
}

// strefa względem frontów: 'ahead' – przed frontem ciepłym, 'warm' – wycinek ciepły, 'behind' – za frontem chłodnym, 'high' – wyż, null – nie wiadomo
export function frontZone(S, x, y) {
  const H = S.centers.find((c) => c.kind === 'H');
  if (H && Math.hypot(x - H.x, y - H.y) < H.r * 0.45) return 'high';
  const wf = S.fronts.find((f) => f.kind === 'warm'), cf = S.fronts.find((f) => f.kind === 'cold');
  if (!wf || !cf) return null;
  const a = polyDist(x, y, wf.pts), b = polyDist(x, y, cf.pts);
  const lowC = S.centers[0];
  const inWarm = a.side > 0 && b.side < 0;
  if (inWarm && (a.d < 700 || b.d < 700) && a.s < 0.97 && b.s < 0.97) return 'warm';
  if (a.side < 0 && a.d < 650 && a.s > 0.08 && a.s < 0.95 && x > lowC.x) return 'ahead';
  if (b.side > 0 && b.d < 550 && b.s > 0.12 && b.s < 0.95 && y < lowC.y) return 'behind';
  return null;
}

// izobary (co 4 hPa) – marching squares na siatce, łączone w łamane
export function isobars(S, step = 4, nx = 96, ny = 72) {
  const dx = MAP.w / nx, dy = MAP.h / ny, P = [];
  for (let j = 0; j <= ny; j++) { const row = []; for (let i = 0; i <= nx; i++) row.push(pressureAt(S, i * dx, j * dy)); P.push(row); }
  let lo = Infinity, hi = -Infinity; for (const row of P) for (const v of row) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const out = [];
  for (let lev = Math.ceil(lo / step) * step; lev <= hi; lev += step) {
    // punkty na krawędziach: klucz krawędzi → [x, y]; odcinki łączą dwie krawędzie
    const pt = new Map(), adj = new Map();
    const ek = (i, j, o) => `${i},${j},${o}`; // o: 0 – pozioma (i,j)-(i+1,j), 1 – pionowa (i,j)-(i,j+1)
    const edgePt = (i, j, o) => {
      const k = ek(i, j, o); if (pt.has(k)) return k;
      const a = P[j][i], b = o ? P[j + 1][i] : P[j][i + 1], t = (lev - a) / (b - a);
      pt.set(k, o ? [i * dx, (j + t) * dy] : [(i + t) * dx, j * dy]); return k;
    };
    const link = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = [P[j][i], P[j][i + 1], P[j + 1][i + 1], P[j + 1][i]].map((q) => q >= lev);
      const code = v[0] | (v[1] << 1) | (v[2] << 2) | (v[3] << 3);
      if (code === 0 || code === 15) continue;
      const E = { b: () => edgePt(i, j, 0), r: () => edgePt(i + 1, j, 1), t: () => edgePt(i, j + 1, 0), l: () => edgePt(i, j, 1) };
      const segs = { 1: ['l', 'b'], 2: ['b', 'r'], 3: ['l', 'r'], 4: ['r', 't'], 6: ['b', 't'], 7: ['l', 't'], 8: ['t', 'l'], 9: ['t', 'b'], 11: ['t', 'r'], 12: ['r', 'l'], 13: ['r', 'b'], 14: ['b', 'l'] }[code];
      if (segs) link(E[segs[0]](), E[segs[1]]());
      else { // siodło: rozstrzygnięcie wg średniej
        const c = (P[j][i] + P[j][i + 1] + P[j + 1][i + 1] + P[j + 1][i]) / 4 >= lev;
        if ((code === 5) === c) { link(E.l(), E.t()); link(E.b(), E.r()); } else { link(E.l(), E.b()); link(E.t(), E.r()); }
      }
    }
    const used = new Set();
    const walk = (start) => {
      const line = [start]; used.add(start);
      let cur = start;
      for (;;) { const nx2 = (adj.get(cur) || []).find((n) => !used.has(n)); if (!nx2) break; used.add(nx2); line.push(nx2); cur = nx2; }
      return line;
    };
    // najpierw końce otwartych linii (na krawędzi mapy), potem pętle
    for (const [k, ns] of adj) if (ns.length === 1 && !used.has(k)) out.push({ p: lev, pts: walk(k).map((q) => pt.get(q)) });
    for (const k of adj.keys()) if (!used.has(k)) { const ln = walk(k); ln.push(ln[0]); out.push({ p: lev, pts: ln.map((q) => pt.get(q)), closed: true }); }
  }
  return out.filter((l) => l.pts.length > 3);
}

// ---------------- pytania: mapa synoptyczna ----------------
const MAP_KINDS = ['dir', 'dir', 'stronger', 'pressure', 'front', 'barb', 'lowWhere'];
export function makeMapQuestion(seed, kind = null) {
  for (let tries = 0; tries < 60; tries++) {
    const r = rng(seed * 7919 + tries * 104729 + 13);
    const S = makeSynoptic(Math.floor(r() * 1e9));
    const k = kind || pick(r, MAP_KINDS);
    const spots = shuffle(r, seaSpots());
    const ok = (s) => S.centers.every((c) => Math.hypot(s.x - c.x, s.y - c.y) > 160);
    const cand = spots.filter(ok);
    if (!cand.length) continue;
    const A = cand[0];
    const wA = windAt(S, A.x, A.y);
    const q = { kind: k, S, A, stations: [], seed };
    if (k === 'dir') {
      if (wA.kn < 6) continue;
      const sec = Math.round(wA.from / 45) % 8;
      if (angDiff(wA.from, sec * 45) > 16) continue; // kierunek blisko granicy sektorów – losuj dalej
      Object.assign(q, { prompt: L(`Z jakiego kierunku wieje wiatr w punkcie A (${A.name})?`, `From which direction is the wind blowing at A (${A.name})?`),
        answer: DIRS8[sec], ui: 'compass',
        explain: L(`Na półkuli północnej wiatr wieje wzdłuż izobar tak, że niż jest po lewej stronie (patrząc z wiatrem), a nad morzem odchyla się o ok. 15–20° w stronę niskiego ciśnienia. W punkcie A wieje z ${dir16(wA.from)} (${Math.round(wA.from)}°).`, `In the northern hemisphere the wind blows along the isobars with low pressure on the left (looking downwind), and over the sea it turns about 15–20° towards low pressure. At A it blows from ${dir16(wA.from)} (${Math.round(wA.from)}°).`) });
      return q;
    }
    if (k === 'lowWhere') {
      if (wA.kn < 6) continue;
      const lowDir = norm360(wA.from + 90);
      Object.assign(q, { hideCenters: true, prompt: L(`Na jachcie w punkcie A wiatr wieje z ${dir8(wA.from)}. W którą stronę od jachtu leży ośrodek niżu? (ośrodki układów ukryto)`, `On the yacht at A the wind blows from ${dir8(wA.from)}. In which direction from the yacht is the centre of the low? (pressure centres hidden)`),
        answer: dir8(lowDir), ui: 'compass',
        explain: L(`Prawo Buys-Ballota: stań plecami do wiatru – na półkuli północnej niż jest po lewej, nieco z przodu. Wiatr z ${dir8(wA.from)} → niż na ${dir8(lowDir)}.`, `Buys-Ballot’s law: stand with your back to the wind – in the northern hemisphere the low is on your left, slightly ahead. Wind from ${dir8(wA.from)} → low to the ${dir8(lowDir)}.`) });
      return q;
    }
    if (k === 'stronger') {
      const B = cand.slice(1).find((s) => { const w = windAt(S, s.x, s.y); const ra = Math.max(w.kn, wA.kn) / Math.max(1, Math.min(w.kn, wA.kn)); return ra > 1.8 && Math.hypot(s.x - A.x, s.y - A.y) > 300; });
      if (!B) continue;
      const wB = windAt(S, B.x, B.y), aStr = wA.kn > wB.kn;
      Object.assign(q, { B, prompt: L('W którym punkcie wiatr jest silniejszy?', 'At which point is the wind stronger?'),
        options: [{ id: 'A', label: `A – ${A.name}` }, { id: 'B', label: `B – ${B.name}` }], answer: aStr ? 'A' : 'B',
        explain: L(`Im gęściej leżą izobary, tym silniejszy wiatr. Ok. ${Math.round(wA.kn)} kn (${knToBft(wA.kn)}°B) w A i ${Math.round(wB.kn)} kn (${knToBft(wB.kn)}°B) w B.`, `The closer the isobars, the stronger the wind. About ${Math.round(wA.kn)} kn (Bft ${knToBft(wA.kn)}) at A and ${Math.round(wB.kn)} kn (Bft ${knToBft(wB.kn)}) at B.`) });
      return q;
    }
    if (k === 'pressure') {
      const p = pressureAt(S, A.x, A.y), lo = Math.floor(p / 4) * 4;
      if (p - lo < 0.6 || lo + 4 - p < 0.6) continue; // za blisko izobary
      const opts = shuffle(r, [-8, -4, 0, 4, 8].map((d) => lo + d)).slice(0, 4);
      if (!opts.includes(lo)) opts[0] = lo;
      Object.assign(q, { prompt: L('Jakie jest ciśnienie w punkcie A?', 'What is the pressure at A?'),
        options: shuffle(r, opts).sort((a, b) => a - b).map((v) => ({ id: String(v), label: `${v}–${v + 4} hPa` })), answer: String(lo),
        explain: L(`Izobary są co 4 hPa. Punkt A leży między izobarami ${lo} i ${lo + 4} hPa (ok. ${p.toFixed(0)} hPa).`, `Isobars are drawn every 4 hPa. A lies between the ${lo} and ${lo + 4} hPa isobars (about ${p.toFixed(0)} hPa).`) });
      return q;
    }
    if (k === 'front') {
      const z = frontZone(S, A.x, A.y);
      if (!z) continue;
      const ans = { ahead: 'wf', warm: 'cf', behind: 'post', high: 'high' }[z];
      Object.assign(q, { zone: z, prompt: L(`Układ przemieszcza się na ${dir8(S.move.dir)} z prędkością ok. ${S.move.kn} kn. Jakiej pogody spodziewać się w punkcie A w ciągu najbliższych kilkunastu godzin?`, `The system is moving ${dir8(S.move.dir)} at about ${S.move.kn} kn. What weather should be expected at A over the next several hours?`),
        options: shuffle(r, frontOptions()), answer: ans,
        explain: tx({
          ahead: ['A leży przed frontem ciepłym: najpierw Ci i Cs, potem As i Ns z ciągłym deszczem, ciśnienie stopniowo spada; po przejściu frontu wiatr skręca w prawo i robi się cieplej.', 'A is ahead of the warm front: first Ci and Cs, then As and Ns with continuous rain, the pressure falls steadily; after the front passes the wind veers and it gets warmer.'],
          warm: ['A leży w wycinku ciepłym – następny nadejdzie front chłodny: szkwał i ulewa z Cb, wiatr gwałtownie skręca w prawo (np. z SW na NW), potem ciśnienie szybko rośnie i poprawia się widzialność.', 'A is in the warm sector – the cold front comes next: a squall and downpour from Cb, the wind veers sharply (e.g. SW to NW), then the pressure rises quickly and visibility improves.'],
          behind: ['A leży za frontem chłodnym: ciśnienie rośnie, porywisty wiatr z sektora północno-zachodniego, chmury Cu i przelotne opady, bardzo dobra widzialność.', 'A is behind the cold front: rising pressure, a gusty north-westerly, Cu clouds with showers, very good visibility.'],
          high: ['A leży w pobliżu ośrodka wyżu: słaby wiatr i ładna pogoda, rano możliwe mgły.', 'A is near the centre of a high: light winds and fair weather, possibly morning fog.']
        }[z]) });
      return q;
    }
    if (k === 'barb') {
      // kilka stacji z symbolami wiatru; pytanie o stację A
      if (wA.kn < 4) continue;
      const kn5 = Math.max(5, Math.round(wA.kn / 5) * 5), d10 = Math.round(wA.from / 10) * 10;
      q.stations = cand.slice(0, 5).map((s) => { const w = windAt(S, s.x, s.y); return { x: s.x, y: s.y, from: Math.round(w.from / 10) * 10, kn: Math.max(0, Math.round(w.kn / 5) * 5) }; });
      q.hideIsobars = true;
      const correct = `${dir8(d10)} ${kn5} kn`;
      const set = new Set([correct]);
      const alts = [`${dir8(d10 + 180)} ${kn5} kn`, `${dir8(d10)} ${kn5 >= 15 ? kn5 - 10 : kn5 + 10} kn`, `${dir8(d10 + 90)} ${kn5} kn`, `${dir8(d10 - 90)} ${kn5 + 5} kn`, `${dir8(d10 + 180)} ${kn5 + 10} kn`];
      for (const a of alts) if (set.size < 4) set.add(a);
      Object.assign(q, { prompt: L('Odczytaj wiatr z symbolu stacji w punkcie A.', 'Read the wind from the station symbol at A.'),
        options: shuffle(r, [...set]).map((s) => ({ id: s, label: s })), answer: correct,
        explain: L(`Trzonek wskazuje, SKĄD wieje wiatr; długa kreska = 10 kn, krótka = 5 kn, chorągiewka = 50 kn. Tu: z ${dir8(d10)} (${d10}°), ${kn5} kn.`, `The shaft points to where the wind comes FROM; a long barb = 10 kn, a short one = 5 kn, a pennant = 50 kn. Here: from ${dir8(d10)} (${d10}°), ${kn5} kn.`) });
      return q;
    }
  }
  return makeMapQuestion(seed + 1, 'dir');
}
export function frontOptions() {
  return [
    { id: 'wf', label: L('Ciśnienie stopniowo spada, chmury gęstnieją (Ci → Cs → As → Ns), długotrwały deszcz; potem wiatr skręca w prawo i robi się cieplej', 'Pressure falls steadily, clouds thicken (Ci → Cs → As → Ns), prolonged rain; then the wind veers and it gets warmer') },
    { id: 'cf', label: L('Szkwał i ulewa z chmur Cb, wiatr gwałtownie skręca w prawo (np. z SW na NW), potem ciśnienie szybko rośnie i robi się przejrzyście', 'A squall and downpour from Cb, the wind veers sharply (e.g. SW to NW), then the pressure rises quickly and the air clears') },
    { id: 'post', label: L('Ciśnienie rośnie, porywisty wiatr NW, chmury Cu i przelotne opady, bardzo dobra widzialność', 'Rising pressure, a gusty NW wind, Cu clouds and showers, very good visibility') },
    { id: 'high', label: L('Słaby wiatr i ładna pogoda, rano możliwa mgła', 'Light winds and fair weather, possible morning fog') }
  ];
}

// ---------------- barograf ----------------
// zapis 24 h (co 15 min) i pytanie o jego znaczenie; tendencja wg terminologii prognoz morskich (zmiana w ciągu 3 h)
export function tendencyText(d3) {
  const a = Math.abs(d3), up = d3 > 0;
  if (a < 0.1) return L('bez zmian', 'steady');
  if (a <= 1.5) return up ? L('powoli rośnie', 'rising slowly') : L('powoli spada', 'falling slowly');
  if (a <= 3.5) return up ? L('rośnie', 'rising') : L('spada', 'falling');
  if (a <= 6) return up ? L('szybko rośnie', 'rising quickly') : L('szybko spada', 'falling quickly');
  return up ? L('bardzo szybko rośnie', 'rising very rapidly') : L('bardzo szybko spada', 'falling very rapidly');
}
const BARO = {
  steadyHigh: { m: ['Pogoda bez zmian – wyż, słaby lub umiarkowany wiatr', 'No change – a high, light or moderate winds'] },
  slowFall: { m: ['Powolne pogorszenie za kilkanaście godzin (front ciepły), wiatr stopniowo się wzmaga – pogoda „długo zapowiadana, długo trwa”', 'Slow deterioration in several hours (warm front), the wind gradually increases – “long foretold, long last”'] },
  fastFall: { m: ['Wkrótce silny wiatr, możliwy sztorm – szybko przygotuj jacht lub szukaj schronienia', 'Strong wind soon, possibly a gale – prepare the yacht or seek shelter at once'] },
  frontPass: { m: ['Przeszedł front chłodny: wiatr skręcił w prawo i jest porywisty, poprawa widzialności, przelotne opady', 'A cold front has passed: the wind has veered and is gusty, visibility improves, showers'] },
  slowRise: { m: ['Stopniowa poprawa i stabilizacja pogody', 'Gradual improvement and settled weather'] },
  fastRise: { m: ['Szybki wzrost: silny, porywisty wiatr, a poprawa będzie krótkotrwała – „szybko przyszło, szybko minie”', 'A quick rise: strong gusty winds, and the improvement will be short-lived – “quick rise after low, sure sign of stronger blow”'] }
};
export function baroOptions() { return Object.keys(BARO).map((id) => ({ id, label: tx(BARO[id].m) })); }
export function makeBaroQuestion(seed) {
  const r = rng(seed * 31 + 7), R = (a, b) => a + r() * (b - a);
  const kind = pick(r, Object.keys(BARO));
  const n = 97, pts = []; // 24 h co 15 min
  const p0 = { steadyHigh: R(1022, 1030), slowFall: R(1012, 1020), fastFall: R(1004, 1012), frontPass: R(1006, 1014), slowRise: R(1004, 1012), fastRise: R(990, 1000) }[kind];
  let p = p0;
  const tFront = R(0.62, 0.8);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let dp = 0;
    if (kind === 'steadyHigh') dp = Math.sin(t * Math.PI * 4 + 0.6) * 0.03;
    if (kind === 'slowFall') dp = t < 0.25 ? -0.02 : -R(0.08, 0.14);
    if (kind === 'fastFall') dp = t < 0.45 ? -0.08 : -R(0.4, 0.7) * Math.min(1, (t - 0.45) * 5);
    if (kind === 'frontPass') dp = t < tFront ? -R(0.15, 0.25) : R(0.35, 0.6);
    if (kind === 'slowRise') dp = R(0.06, 0.12);
    if (kind === 'fastRise') dp = t < 0.3 ? -0.05 : R(0.45, 0.65);
    p += dp + (r() - 0.5) * 0.05;
    pts.push(p);
  }
  const d3 = pts[n - 1] - pts[n - 13];
  return { kind, pts, d3, answer: kind, options: shuffle(r, baroOptions()),
    prompt: L('Zapis barografu z ostatniej doby. Czego się spodziewać?', 'A barograph trace from the last 24 hours. What should you expect?'),
    explain: L(`W ostatnich 3 godzinach ciśnienie zmieniło się o ${d3 > 0 ? '+' : ''}${d3.toFixed(1)} hPa – ${tendencyText(d3)}. ${tx(BARO[kind].m)}.`, `In the last 3 hours the pressure changed by ${d3 > 0 ? '+' : ''}${d3.toFixed(1)} hPa – ${tendencyText(d3)}. ${tx(BARO[kind].m)}.`) };
}

// ---------------- zjawiska i wiedza praktyczna ----------------
// każdy generator zwraca { prompt, options, answer, explain, fig? }; fig opisuje rysunek (rysuje UI)
const PHEN = [
  (r) => { // bryza
    const day = r() < 0.6;
    return { fig: { type: 'breeze', day }, prompt: day ? L('Słoneczny, letni dzień, wiatr z mapy synoptycznej jest słaby. Skąd po południu będzie wiał wiatr przy brzegu?', 'A sunny summer day with a weak gradient wind. Where will the wind blow from near the coast in the afternoon?') : L('Pogodna, bezwietrzna letnia noc. Skąd nad ranem wieje słaby wiatr przy brzegu?', 'A clear, calm summer night. Where does the light wind blow from near the coast before dawn?'),
      options: [{ id: 'sea', label: L('Od morza w stronę lądu', 'From the sea towards the land') }, { id: 'land', label: L('Od lądu w stronę morza', 'From the land towards the sea') }, { id: 'along', label: L('Wzdłuż brzegu', 'Along the coast') }, { id: 'calm', label: L('Będzie zupełna cisza', 'It will be completely calm') }],
      answer: day ? 'sea' : 'land',
      explain: day ? L('Bryza morska: ląd nagrzewa się szybciej niż woda, ciepłe powietrze unosi się nad lądem, a od morza napływa chłodniejsze. Zaczyna się przed południem, najsilniejsza (10–15 kn) po południu, sięga kilkanaście km od brzegu.', 'Sea breeze: the land heats faster than the water, warm air rises over the land and cooler air flows in from the sea. It starts late morning, is strongest (10–15 kn) in the afternoon and reaches a dozen or so km offshore.') : L('Bryza lądowa: nocą ląd stygnie szybciej niż woda, więc słaby wiatr wieje od lądu nad morze. Jest słabsza niż bryza morska.', 'Land breeze: at night the land cools faster than the water, so a light wind blows from the land out to sea. It is weaker than the sea breeze.') };
  },
  (r) => { // odległość burzy
    const s = pick(r, [3, 6, 9, 12, 15, 18, 21, 24, 30]), km = s / 3;
    const opts = shuffle(r, [...new Set([km, km * 3, Math.max(1, km / 2), km + 3, km * 2])]).slice(0, 4);
    if (!opts.includes(km)) opts[0] = km;
    return { fig: { type: 'thunder', s }, prompt: L(`Od błysku do grzmotu minęło ${s} s. Jak daleko jest burza?`, `${s} s passed between the flash and the thunder. How far away is the storm?`),
      options: opts.sort((a, b) => a - b).map((v) => ({ id: String(v), label: `${String(+v.toFixed(1)).replace('.', L(',', '.'))} km` })), answer: String(km),
      explain: L(`Dźwięk pokonuje ok. 1 km w 3 s: ${s} s ÷ 3 = ${km} km. Gdy odstęp się skraca, burza się zbliża – zrefuj żagle i zabezpiecz jacht.`, `Sound travels about 1 km in 3 s: ${s} s ÷ 3 = ${km} km. If the gap shortens, the storm is approaching – reef and secure the yacht.`) };
  },
  (r) => { // skręcanie / cofanie się wiatru
    const veer = r() < 0.5, start = pick(r, [0, 45, 90, 135, 180, 225, 270, 315]);
    const seq = [0, 1, 2].map((i) => dir8(start + (veer ? 45 : -45) * i));
    return { fig: { type: 'shift', seq: seq.map(dirDeg) }, prompt: L(`W ciągu kilku godzin wiatr zmienił kierunek: ${seq.join(' → ')}. Jak to nazywamy?`, `Over a few hours the wind changed: ${seq.join(' → ')}. What is this called?`),
      options: [{ id: 'veer', label: L('Wiatr skręca w prawo (zgodnie z ruchem wskazówek zegara)', 'The wind veers (clockwise)') }, { id: 'back', label: L('Wiatr cofa się – skręca w lewo (przeciwnie do ruchu wskazówek zegara)', 'The wind backs (anticlockwise)') }, { id: 'gust', label: L('Szkwał', 'A squall') }, { id: 'none', label: L('Wiatr zmienny', 'Variable wind') }],
      answer: veer ? 'veer' : 'back',
      explain: L('Zmiana kierunku zgodnie z ruchem wskazówek zegara (np. S → SW → W) to skręcanie w prawo – typowe przy przejściu frontów na półkuli północnej. Przeciwnie (np. W → SW → S) wiatr się cofa – często przed nadejściem niżu.', 'A clockwise change (e.g. S → SW → W) is veering – typical of frontal passages in the northern hemisphere. Anticlockwise (e.g. W → SW → S) is backing – often ahead of an approaching low.') };
  },
  (r) => { // mgła adwekcyjna / radiacyjna
    const adv = r() < 0.5;
    return { fig: { type: 'fog', adv }, prompt: adv ? L('Maj, ciepłe i wilgotne powietrze napływa znad lądu nad wciąż zimny Bałtyk, wiatr 3–4°B. Co grozi żeglarzowi?', 'May: warm, moist air flows from the land over the still cold Baltic, wind Bft 3–4. What is the hazard?') : L('Pogodna, bezwietrzna jesienna noc nad lądem. Rano w porcie i u ujścia rzeki leży gęsta mgła. Co się z nią stanie?', 'A clear, calm autumn night over land. In the morning there is thick fog in the harbour and river mouth. What will happen to it?'),
      options: adv ? [{ id: 'adv', label: L('Mgła adwekcyjna – może utrzymywać się długo, mimo wiatru', 'Advection fog – it may persist for a long time despite the wind') }, { id: 'rad', label: L('Mgła radiacyjna – zniknie przed południem', 'Radiation fog – it will clear before noon') }, { id: 'storm', label: L('Burza z gradem', 'A thunderstorm with hail') }, { id: 'none', label: L('Nic – wiatr rozwieje wilgoć', 'Nothing – the wind will disperse the moisture') }]
        : [{ id: 'rad', label: L('To mgła radiacyjna – zwykle rozproszy się, gdy słońce ogrzeje ląd', 'It is radiation fog – it usually clears once the sun warms the land') }, { id: 'adv', label: L('To mgła adwekcyjna – utrzyma się kilka dni', 'It is advection fog – it will last for days') }, { id: 'thick', label: L('Zgęstnieje, gdy wzmoże się wiatr', 'It will thicken when the wind rises') }, { id: 'rain', label: L('Zamieni się w ulewę', 'It will turn into a downpour') }],
      answer: adv ? 'adv' : 'rad',
      explain: adv ? L('Mgła adwekcyjna powstaje, gdy ciepłe, wilgotne powietrze ochładza się nad zimną wodą – na Bałtyku najczęściej wiosną i na początku lata. Słaby i umiarkowany wiatr jej nie rozwiewa.', 'Advection fog forms when warm, moist air is cooled over cold water – on the Baltic mostly in spring and early summer. Light and moderate winds do not disperse it.') : L('Mgła radiacyjna tworzy się nocą nad lądem przy bezchmurnym niebie i ciszy; spływa do portów i ujść rzek, a rano – gdy słońce ogrzeje ląd – zwykle się rozprasza.', 'Radiation fog forms over land on clear, calm nights; it drifts into harbours and river mouths and usually clears in the morning once the sun warms the land.') };
  },
  (r) => { // porywy
    const w = pick(r, [10, 14, 18, 22]), g = Math.round(w * 1.4);
    return { prompt: L(`Prognoza: wiatr ${w} kn. Jakich porywów trzeba się spodziewać przy niestabilnej pogodzie (przelotne opady)?`, `Forecast: wind ${w} kn. What gusts should you expect in unstable weather (showers)?`),
      options: [{ id: 'same', label: `${w} kn` }, { id: 'g', label: L(`ok. ${g} kn i więcej`, `about ${g} kn or more`) }, { id: 'less', label: `${Math.round(w * 0.7)} kn` }, { id: 'double', label: L(`zawsze dokładnie ${w * 2} kn`, `always exactly ${w * 2} kn`) }],
      answer: 'g', explain: L('Porywy bywają o 30–50% silniejsze od średniego wiatru, a pod chmurami Cb nawet dwukrotnie. Ożaglowanie dobiera się do porywów, nie do średniej.', 'Gusts are often 30–50% stronger than the mean wind, and under Cb even double. Choose your sail area for the gusts, not the mean.') };
  },
  (r) => { // wiatr pozorny – fordewind / bajdewind
    const tw = pick(r, [10, 12, 15, 18]), bs = pick(r, [5, 6, 7]);
    const down = r() < 0.5;
    const aw = down ? tw - bs : Math.round(Math.hypot(tw * Math.cos(45 * DEG) + bs, tw * Math.sin(45 * DEG)));
    return { fig: { type: 'apparent', tw, bs, down }, prompt: down ? L(`Jacht płynie z wiatrem (fordewind) z prędkością ${bs} kn, wiatr rzeczywisty ${tw} kn. Jaki wiatr czujesz na pokładzie?`, `The yacht runs dead downwind at ${bs} kn, true wind ${tw} kn. What wind do you feel on deck?`) : L(`Jacht płynie ostro na wiatr (ok. 45° do wiatru rzeczywistego) z prędkością ${bs} kn, wiatr rzeczywisty ${tw} kn. Jaki jest wiatr pozorny?`, `The yacht beats to windward (about 45° to the true wind) at ${bs} kn, true wind ${tw} kn. What is the apparent wind?`),
      options: [aw, ...shuffle(r, [...new Set([tw, tw + bs, Math.max(1, tw - bs), aw + 4, aw - 4])].filter((v) => v !== aw && v > 0)).slice(0, 3)].sort((a, b) => a - b).map((v) => ({ id: String(v), label: L(`ok. ${v} kn`, `about ${v} kn`) })),
      answer: String(aw),
      explain: down ? L(`Z wiatrem wiatr pozorny jest słabszy: ${tw} − ${bs} = ${aw} kn. Uwaga – po zwrocie na wiatr nagle poczujesz znacznie więcej!`, `Downwind the apparent wind is weaker: ${tw} − ${bs} = ${aw} kn. Beware – after turning upwind you will suddenly feel much more!`) : L(`Na kursie ostrym wiatr pozorny jest silniejszy od rzeczywistego (suma wektorów): ok. ${aw} kn.`, `Close-hauled the apparent wind is stronger than the true wind (vector sum): about ${aw} kn.`) };
  },
  (r) => { // Buys-Ballot (słownie)
    const from = pick(r, [0, 45, 90, 135, 180, 225, 270, 315]);
    return { fig: { type: 'buys', from }, prompt: L(`Wiatr wieje z ${dir8(from)}. Gdzie (na półkuli północnej) leży ośrodek niżu?`, `The wind blows from ${dir8(from)}. Where (northern hemisphere) is the centre of the low?`),
      options: shuffle(r, [90, 270, 0, 180].map((d) => ({ id: dir8(from + d), label: dir8(from + d) }))), answer: dir8(from + 90),
      explain: L(`Stań plecami do wiatru – niż jest po lewej, nieco z przodu. Wiatr z ${dir8(from)} → niż na ${dir8(from + 90)}.`, `Stand with your back to the wind – the low is on your left, slightly ahead. Wind from ${dir8(from)} → low to the ${dir8(from + 90)}.`) };
  },
  (r) => { // cyrkulacja w niżu / wyżu
    const low = r() < 0.5;
    return { fig: { type: 'circ', low }, prompt: low ? L('Jak krąży powietrze wokół niżu na półkuli północnej?', 'How does the air circulate around a low in the northern hemisphere?') : L('Jak krąży powietrze wokół wyżu na półkuli północnej?', 'How does the air circulate around a high in the northern hemisphere?'),
      options: [{ id: 'ccwIn', label: L('Przeciwnie do ruchu wskazówek zegara, zbiegając się do środka', 'Anticlockwise, converging towards the centre') }, { id: 'cwOut', label: L('Zgodnie z ruchem wskazówek zegara, rozbiegając się od środka', 'Clockwise, diverging from the centre') }, { id: 'ccwOut', label: L('Przeciwnie do ruchu wskazówek zegara, od środka', 'Anticlockwise, outwards from the centre') }, { id: 'cwIn', label: L('Zgodnie z ruchem wskazówek zegara, do środka', 'Clockwise, towards the centre') }],
      answer: low ? 'ccwIn' : 'cwOut',
      explain: L('Na półkuli północnej wokół niżu wiatr krąży przeciwnie do ruchu wskazówek zegara i zbiega się do środka (powietrze się unosi – chmury i opady), a wokół wyżu zgodnie z ruchem wskazówek zegara i rozbiega się (powietrze osiada – zwykle ładna pogoda).', 'In the northern hemisphere the wind circles a low anticlockwise and converges into it (rising air – clouds and rain), and circles a high clockwise and diverges from it (sinking air – usually fair weather).') };
  },
  (r) => { // fronty – zmiana wiatru
    const cold = r() < 0.5;
    return { prompt: cold ? L('Co dzieje się z wiatrem podczas przejścia frontu chłodnego?', 'What happens to the wind as a cold front passes?') : L('Co dzieje się z ciśnieniem i pogodą po przejściu frontu ciepłego?', 'What happens to the pressure and weather after a warm front passes?'),
      options: cold ? [{ id: 'a', label: L('Gwałtownie skręca w prawo (np. z SW na NW), wzmaga się w szkwałach', 'It veers sharply (e.g. SW to NW) and strengthens in squalls') }, { id: 'b', label: L('Powoli cofa się i słabnie', 'It slowly backs and eases') }, { id: 'c', label: L('Nie zmienia się', 'It does not change') }, { id: 'd', label: L('Zamiera na kilka dni', 'It dies away for several days') }]
        : [{ id: 'a', label: L('Ciśnienie przestaje spadać, wiatr skręca w prawo, robi się cieplej, często mżawka i słaba widzialność', 'The pressure stops falling, the wind veers, it gets warmer, often drizzle and poor visibility') }, { id: 'b', label: L('Ciśnienie gwałtownie rośnie i robi się bardzo przejrzyście', 'The pressure rises sharply and the air becomes very clear') }, { id: 'c', label: L('Przychodzi burza z gradem', 'A thunderstorm with hail arrives') }, { id: 'd', label: L('Robi się wyraźnie chłodniej', 'It becomes much colder') }],
      answer: 'a', explain: cold ? L('Front chłodny: wąski pas Cb, szkwały i ulewy, wiatr skręca w prawo nagle i porywiście, za frontem ciśnienie szybko rośnie, robi się chłodniej i przejrzyście.', 'Cold front: a narrow band of Cb, squalls and downpours, the wind veers suddenly and gustily; behind the front the pressure rises fast, it gets colder and clearer.') : L('Front ciepły: przed nim szeroki pas ciągłych opadów, po przejściu ciśnienie się stabilizuje, wiatr skręca w prawo, robi się cieplej, w wycinku ciepłym często St, mżawka i mgła.', 'Warm front: a broad belt of continuous rain ahead; once it passes the pressure levels off, the wind veers and it gets warmer; the warm sector often brings St, drizzle and fog.') };
  },
  (r) => { // widzialność w prognozach
    const v = pick(r, ['good', 'moderate', 'poor', 'fog']);
    const def = { good: [L('dobra', 'good'), L('powyżej 5 Mm', 'more than 5 NM')], moderate: [L('umiarkowana', 'moderate'), L('2–5 Mm', '2–5 NM')], poor: [L('słaba', 'poor'), L('od 1000 m do 2 Mm', '1000 m to 2 NM')], fog: [L('mgła', 'fog'), L('poniżej 1000 m', 'less than 1000 m')] };
    return { prompt: L(`W prognozie dla żeglugi widzialność określono jako „${def[v][0]}”. Co to znaczy?`, `A marine forecast gives visibility as “${def[v][0]}”. What does it mean?`),
      options: shuffle(r, Object.keys(def).map((k) => ({ id: k, label: def[k][1] }))), answer: v,
      explain: L('W prognozach morskich: dobra – powyżej 5 Mm, umiarkowana – 2–5 Mm, słaba – od 1000 m do 2 Mm, mgła – poniżej 1000 m.', 'In marine forecasts: good – more than 5 NM, moderate – 2–5 NM, poor – 1000 m to 2 NM, fog – less than 1000 m.') };
  },
  (r) => { // szkwał – działanie
    return { fig: { type: 'squall' }, prompt: L('Od nawietrznej szybko nadciąga ciemna chmura Cb z wałem chmur u podstawy. Co robisz najpierw?', 'A dark Cb with a roll cloud at its base is approaching fast from windward. What do you do first?'),
      options: shuffle(r, [{ id: 'reef', label: L('Refuję lub zrzucam żagle, zakładamy kamizelki i szelki, zamykam luki', 'Reef or drop sail, put on lifejackets and harnesses, close the hatches') }, { id: 'photo', label: L('Czekam, aż wiatr się wzmoże, i dopiero wtedy reaguję', 'Wait for the wind to increase before reacting') }, { id: 'land', label: L('Płynę pod brzeg zawietrzny, żeby się za nim schować', 'Head in towards the lee shore to hide') }, { id: 'full', label: L('Stawiam więcej żagli, by szybciej uciec', 'Set more sail to run away faster') }]),
      answer: 'reef', explain: L('Szkwał przychodzi nagle i jest silniejszy niż wiatr przed nim (porywy nawet 2×). Żagle trzeba zredukować zanim chmura nadejdzie; trzymaj się z dala od brzegu zawietrznego.', 'A squall arrives suddenly and is stronger than the wind before it (gusts up to 2×). Reduce sail before the cloud arrives; keep clear of a lee shore.') };
  },
  (r) => { // długo zapowiadana
    const slow = r() < 0.5;
    return { prompt: slow ? L('Ciśnienie spada powoli od półtorej doby. Jaka będzie zmiana pogody?', 'The pressure has been falling slowly for a day and a half. What will the change be like?') : L('Ciśnienie spadło gwałtownie w ciągu kilku godzin. Jaka będzie zmiana pogody?', 'The pressure has dropped sharply within a few hours. What will the change be like?'),
      options: [{ id: 'long', label: L('Pogorszenie przyjdzie powoli, ale potrwa długo', 'The deterioration will come slowly but last long') }, { id: 'short', label: L('Pogorszenie przyjdzie szybko, ale nie potrwa długo – za to wiatr może być bardzo silny', 'It will come quickly but not last long – though the wind may be very strong') }, { id: 'none', label: L('Ciśnienie nie ma związku z pogodą', 'Pressure has nothing to do with the weather') }, { id: 'fair', label: L('Będzie ładna pogoda', 'Fair weather will come') }],
      answer: slow ? 'long' : 'short', explain: L('Żeglarska reguła: „długo zapowiadana – długo trwa, krótko zapowiadana – szybko mija”. Szybki spadek ciśnienia oznacza głęboki, szybko poruszający się niż i silny wiatr.', 'The sailor’s rule: “long foretold, long last; short notice, soon past”. A rapid fall means a deep, fast-moving low and strong wind.') };
  }
];
export const PHEN_COUNT = PHEN.length;
export function makePhenQuestion(seed, idx = null) {
  const r = rng(seed * 131 + 17);
  const i = idx ?? Math.floor(r() * PHEN.length);
  return { idx: i, ...PHEN[i](r) };
}

// ---------------- pytania: skala Beauforta i chmury ----------------
export function makeBftQuestion(seed, range = [1, 10]) {
  const r = rng(seed * 997 + 3);
  const f = range[0] + Math.floor(r() * (range[1] - range[0] + 1));
  const b = beaufort(f);
  return { f, windFrom: Math.round(r() * 360), hour: 9 + r() * 7, seed: Math.floor(r() * 1e9),
    sky: f >= 8 ? pick(r, ['Ns', 'Sc', 'St']) : f >= 6 ? pick(r, ['Sc', 'Cu', 'As', null]) : pick(r, ['Cu', 'Ci', null, null, 'Sc', 'Ac']),
    explain: `${f}°B – ${b.name} (${b.knText} kn): ${b.seaText} ${L('Prawdopodobna wysokość fali', 'Probable wave height')}: ${String(b.h).replace('.', L(',', '.'))} m.` };
}
export function makeCloudQuestion(seed, forceId = null) {
  const r = rng(seed * 577 + 11);
  const id = forceId || pick(r, CLOUD_IDS), c = cloud(id);
  const others = shuffle(r, CLOUD_IDS.filter((x) => x !== id)).slice(0, 5);
  return { id, seed: Math.floor(r() * 1e9), hour: 9.5 + r() * 6, windFrom: Math.round(r() * 360),
    options: shuffle(r, [id, ...others]).map((k) => ({ id: k, label: `${cloud(k).name} (${k})` })),
    meanOptions: meanings(), mean: c.mean, explain: `${c.name} – ${c.latin} (${c.id}), ${c.levelText}. ${c.look} ${c.weather}` };
}

// Talia: każdy element losowany bez powtórek w obrębie rundy
export function makeDeck(r, n) {
  let bag = [];
  return () => { if (!bag.length) bag = shuffle(r, Array.from({ length: n }, (_, i) => i)); return bag.pop(); };
}
