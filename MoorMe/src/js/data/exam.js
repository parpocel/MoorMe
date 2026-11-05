// Moduł „Test”: losowy egzamin jednokrotnego wyboru (75 pytań, 3 odpowiedzi, jedna poprawna) z dziedzin omawianych
// w programie – osobno dla morza i dla śródlądzia – oraz zadanie nawigacyjne o średnim poziomie trudności.
// Czysta logika (bez DOM): pytanie to { topic, q, options: [3], answer: indeks, explain, media? }.
// media: { kind: 'lights'|'day', id } – model 3D jednostki, { kind: 'sound', p } – sygnał dźwiękowy,
// { kind: 'svg', svg } – rysunek, { kind: 'img', src } – obraz znaku.
import { getLang, t as tt } from '../i18n.js';
import { VESSELS, DAY_VESSELS, visibleLights } from './shipLights.js';
import { SIGNALS, notation } from './soundSignals.js';
import { rng } from '../math.js';
import { CHART_SYMBOLS, symbolSVG } from './chartSymbols.js';
import { SIGN_GROUPS, signImage } from './inlandSigns.js';
import { beaufort, clouds, makePhenQuestion, PHEN_COUNT } from './meteo.js';
import { channels, deviceInfo } from './safety.js';

const L = (pl, en) => (getLang() === 'en' ? en : pl);
const tx = (a) => (Array.isArray(a) ? L(a[0], a[1]) : a);

export const EXAM = { questions: 75, pass: 65, testMin: 60, navMin: 30 };
// zadania nawigacyjne o średnim poziomie trudności (z mapą lub trójkątem prądu)
export const NAV_EXAM_CATS = ['current', 'steer', 'fix', 'dr', 'abeam'];

export const TOPICS = {
  rules: ['Prawo drogi', 'Rules of the road'],
  inlandRules: ['Przepisy śródlądowe', 'Inland regulations'],
  lights: ['Światła statków', 'Vessel lights'],
  day: ['Znaki dzienne', 'Day shapes'],
  sounds: ['Sygnały dźwiękowe', 'Sound signals'],
  marks: ['Oznakowanie nawigacyjne', 'Buoyage'],
  signs: ['Znaki żeglugowe', 'Waterway signs'],
  chart: ['Mapa morska', 'Nautical chart'],
  nav: ['Nawigacja', 'Navigation'],
  meteo: ['Meteorologia', 'Meteorology'],
  safety: ['Bezpieczeństwo i łączność', 'Safety and radio'],
  seaman: ['Budowa jachtu i locja', 'Yacht and seamanship']
};
export const topicName = (k) => tx(TOPICS[k]);

function shuffle(r, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
// pytanie z poprawną odpowiedzią i dwiema błędnymi – kolejność odpowiedzi losowa
// bad – kandydaci na błędne odpowiedzi (bierzemy dwie pierwsze różne od poprawnej i od siebie)
function mk(r, topic, q, good, bad, extra = {}) {
  const wrong = [...new Set(bad.filter((b) => b && b !== good))].slice(0, 2);
  const opts = shuffle(r, [good, ...wrong]);
  return { topic, q, options: opts, answer: opts.indexOf(good), ...extra };
}
// dwie błędne odpowiedzi z puli (różne od poprawnej i od siebie)
const others = (r, pool, good, key = (x) => x) => shuffle(r, pool.filter((x) => key(x) !== key(good))).filter((x, i, a) => a.findIndex((y) => key(y) === key(x)) === i).slice(0, 2);

// ---------------- bank pytań pisanych ręcznie ----------------
// [zakres: 'sea' | 'inland' | 'both', temat, pytanie [pl, en], poprawna [pl, en], błędna, błędna, wyjaśnienie?]
const BANK = [
  // --- prawo drogi na morzu (MPZZM / COLREG) ---
  ['sea', 'rules', ['Dwa jachty żaglowe zbliżają się, mając wiatr z różnych burt. Który ustępuje drogi?', 'Two sailing yachts approach with the wind on different sides. Which gives way?'], ['Jacht mający wiatr z lewej burty (lewy hals)', 'The yacht with the wind on the port side (port tack)'], ['Jacht mający wiatr z prawej burty (prawy hals)', 'The yacht with the wind on the starboard side (starboard tack)'], ['Jacht znajdujący się na zawietrznej', 'The yacht to leeward'], ['Prawidło 12: jacht na lewym halsie ustępuje jachtowi na prawym halsie.', 'Rule 12: port tack gives way to starboard tack.']],
  ['sea', 'rules', ['Dwa jachty żaglowe mają wiatr z tej samej burty. Który ustępuje drogi?', 'Two sailing yachts have the wind on the same side. Which gives way?'], ['Jacht znajdujący się na nawietrznej', 'The yacht to windward'], ['Jacht znajdujący się na zawietrznej', 'The yacht to leeward'], ['Jacht mniejszy', 'The smaller yacht'], ['Prawidło 12(a)(ii): nawietrzny ustępuje zawietrznemu.', 'Rule 12(a)(ii): windward keeps clear of leeward.']],
  ['sea', 'rules', ['Kto ustępuje drogi przy wyprzedzaniu?', 'Who gives way when overtaking?'], ['Zawsze statek wyprzedzający – także żaglowiec wyprzedzający motorowiec', 'Always the overtaking vessel – even a sailing vessel overtaking a power vessel'], ['Statek wyprzedzany', 'The vessel being overtaken'], ['Statek o napędzie mechanicznym – żaglowiec ma zawsze pierwszeństwo', 'The power-driven vessel – sail always has right of way'], ['Prawidło 13: statek wyprzedzający ustępuje drogi niezależnie od innych prawideł.', 'Rule 13: the overtaking vessel keeps clear regardless of other rules.']],
  ['sea', 'rules', ['Kiedy statek jest statkiem wyprzedzającym?', 'When is a vessel overtaking?'], ['Gdy zbliża się z kierunku większego niż 22,5° za trawersem drugiego statku', 'When coming up from more than 22.5° abaft the other vessel’s beam'], ['Gdy zbliża się z kierunku większego niż 10° za trawersem', 'When coming up from more than 10° abaft the beam'], ['Gdy jest szybszy od drugiego statku, niezależnie od kierunku', 'Whenever it is faster than the other vessel, whatever the direction'], ['Nocą wyprzedzający widzi tylko światło rufowe statku wyprzedzanego.', 'At night the overtaking vessel sees only the stern light of the other.']],
  ['sea', 'rules', ['Dwa statki o napędzie mechanicznym idą kursami przeciwnymi na jednej linii. Co robią?', 'Two power-driven vessels meet head-on. What do they do?'], ['Oba zmieniają kurs w prawo', 'Both alter course to starboard'], ['Oba zmieniają kurs w lewo', 'Both alter course to port'], ['Mniejszy ustępuje większemu', 'The smaller gives way to the larger'], ['Prawidło 14: mijają się lewymi burtami.', 'Rule 14: they pass port to port.']],
  ['sea', 'rules', ['Kursy dwóch statków o napędzie mechanicznym przecinają się. Który ustępuje?', 'The courses of two power-driven vessels cross. Which gives way?'], ['Ten, który ma drugi statek po swojej prawej burcie', 'The one that has the other on its starboard side'], ['Ten, który ma drugi statek po swojej lewej burcie', 'The one that has the other on its port side'], ['Ten, który jest szybszy', 'The faster one'], ['Prawidło 15. Unika przechodzenia przed dziobem drugiego statku.', 'Rule 15. It avoids crossing ahead of the other.']],
  ['sea', 'rules', ['Jacht żaglowy spotyka statek rybacki zajęty połowem. Kto ustępuje drogi?', 'A sailing yacht meets a vessel engaged in fishing. Who gives way?'], ['Jacht żaglowy', 'The sailing yacht'], ['Statek rybacki', 'The fishing vessel'], ['Oba zmieniają kurs w prawo', 'Both alter course to starboard'], ['Prawidło 18: żaglowiec ustępuje statkom niezdolnym do manewrowania, o ograniczonej zdolności manewrowania i zajętym połowem.', 'Rule 18: sail gives way to NUC, RAM and vessels engaged in fishing.']],
  ['sea', 'rules', ['Na otwartym morzu kursy jachtu żaglowego i statku o napędzie mechanicznym się przecinają. Kto ustępuje?', 'In open water a sailing yacht and a power-driven vessel are crossing. Who gives way?'], ['Statek o napędzie mechanicznym', 'The power-driven vessel'], ['Jacht żaglowy', 'The sailing yacht'], ['Ten, który ma drugi po lewej burcie', 'The one that has the other on its port side'], ['Prawidło 18(a) – o ile nie wyprzedza go żaglowiec i nie jest to wąskie przejście.', 'Rule 18(a) – unless the sailing vessel is overtaking or it is a narrow channel.']],
  ['sea', 'rules', ['Jacht krótszy niż 20 m w wąskim przejściu spotyka duży statek, który może płynąć tylko torem. Co obowiązuje jacht?', 'A yacht under 20 m in a narrow channel meets a large ship that can navigate only within it. What applies to the yacht?'], ['Nie może utrudniać przejścia temu statkowi', 'It must not impede the ship’s passage'], ['Ma pierwszeństwo, bo jest pod żaglami', 'It has right of way because it is under sail'], ['Musi rzucić kotwicę i czekać', 'It must anchor and wait'], ['Prawidło 9(b).', 'Rule 9(b).']],
  ['sea', 'rules', ['Pod jakim kątem przecina się tor ruchu w systemie rozgraniczenia ruchu?', 'At what angle should a traffic lane be crossed in a traffic separation scheme?'], ['Możliwie zbliżonym do prostego (dziobem prostopadle do kierunku ruchu)', 'As close as practicable to a right angle (heading perpendicular to the traffic flow)'], ['Pod kątem 45° do kierunku ruchu', 'At 45° to the traffic flow'], ['Równolegle, płynąc pod prąd ruchu', 'Parallel, against the flow'], ['Prawidło 10(c).', 'Rule 10(c).']],
  ['sea', 'rules', ['Co oznacza „bezpieczna prędkość” według prawidła 6?', 'What is a “safe speed” under Rule 6?'], ['Prędkość pozwalająca skutecznie uniknąć zderzenia i zatrzymać się na odległość odpowiednią do warunków', 'A speed that allows effective action to avoid collision and stopping within a distance appropriate to the conditions'], ['Najwyżej 10 węzłów na każdym akwenie', 'At most 10 knots in any waters'], ['Prędkość podana w locji dla danego akwenu', 'The speed given in the pilot book for the area'], ['Zależy m.in. od widzialności, natężenia ruchu, manewrowości jednostki i stanu morza.', 'It depends on visibility, traffic density, manoeuvrability and sea state, among others.']],
  ['both', 'rules', ['Po czym poznasz, że istnieje niebezpieczeństwo zderzenia?', 'How can you tell that a risk of collision exists?'], ['Namiar na zbliżający się statek nie zmienia się wyraźnie', 'The compass bearing of an approaching vessel does not change appreciably'], ['Namiar na statek szybko się zmienia', 'The bearing of the vessel changes quickly'], ['Statek jest dalej niż 2 Mm', 'The vessel is more than 2 NM away'], ['Stały namiar przy malejącej odległości to kurs kolizyjny (prawidło 7).', 'A steady bearing with decreasing range means a collision course (Rule 7).']],
  ['both', 'rules', ['Jak powinien manewrować statek ustępujący drogi?', 'How should the give-way vessel act?'], ['Wcześnie i zdecydowanie, tak by zmiana była dobrze widoczna dla drugiego statku', 'Early and substantially, so the change is readily apparent to the other vessel'], ['Małymi, stopniowymi zmianami kursu', 'With small, gradual course changes'], ['Dopiero w ostatniej chwili, aby nie dezorientować drugiego statku', 'Only at the last moment, so as not to confuse the other vessel'], ['Prawidła 8 i 16.', 'Rules 8 and 16.']],
  ['both', 'rules', ['Co robi statek uprzywilejowany (nieustępujący drogi)?', 'What does the stand-on vessel do?'], ['Utrzymuje kurs i prędkość, ale manewruje, gdy sam ustępujący nie wystarczy', 'Keeps its course and speed, but acts when the give-way vessel’s action alone will not do'], ['Zawsze zmienia kurs w prawo', 'Always alters course to starboard'], ['Zatrzymuje się do czasu minięcia drugiego statku', 'Stops until the other vessel has passed'], ['Prawidło 17.', 'Rule 17.']],
  ['sea', 'rules', ['We mgle słyszysz sygnał mgłowy innego statku przed swoim trawersem. Co robisz?', 'In fog you hear another vessel’s fog signal forward of your beam. What do you do?'], ['Zmniejszam prędkość do najmniejszej pozwalającej sterować, a w razie potrzeby zatrzymuję się', 'Reduce speed to the minimum at which I can steer and, if necessary, stop'], ['Zwiększam prędkość, by szybciej minąć statek', 'Increase speed to get past the vessel quickly'], ['Zmieniam kurs w lewo', 'Alter course to port'], ['Prawidło 19(e).', 'Rule 19(e).']],
  ['sea', 'rules', ['Któremu statkowi jacht żaglowy w drodze musi ustąpić drogi?', 'Which vessel must a sailing yacht under way keep out of the way of?'], ['Statkowi o ograniczonej zdolności manewrowania', 'A vessel restricted in her ability to manoeuvre'], ['Statkowi o napędzie mechanicznym w drodze na otwartym morzu', 'A power-driven vessel under way in open water'], ['Wodnosamolotowi na wodzie', 'A seaplane on the water'], ['Prawidło 18(b).', 'Rule 18(b).']],
  ['both', 'rules', ['Jacht płynie pod żaglami i jednocześnie na silniku. Jak traktują go przepisy?', 'A yacht is sailing with its engine running. How do the rules treat it?'], ['Jak statek o napędzie mechanicznym', 'As a power-driven vessel'], ['Jak jednostkę żaglową', 'As a sailing vessel'], ['Jak statek o ograniczonej zdolności manewrowania', 'As a vessel restricted in her ability to manoeuvre'], ['W dzień niesie stożek wierzchołkiem w dół, nocą – światło masztowe.', 'By day it shows a cone point down, at night a masthead light.']],
  ['sea', 'rules', ['Jaki kąt poziomy oświetla światło masztowe?', 'What horizontal arc does a masthead light show?'], ['225°', '225°'], ['360°', '360°'], ['135°', '135°'], ['Od dziobu do 22,5° za trawersem na każdą burtę.', 'From ahead to 22.5° abaft the beam on each side.']],
  ['sea', 'rules', ['Jaki kąt poziomy oświetla światło rufowe?', 'What horizontal arc does a stern light show?'], ['135°', '135°'], ['112,5°', '112.5°'], ['225°', '225°']],
  ['sea', 'rules', ['Jaki kąt poziomy oświetla każde ze świateł burtowych?', 'What horizontal arc does each sidelight show?'], ['112,5°', '112.5°'], ['135°', '135°'], ['180°', '180°']],
  ['sea', 'rules', ['Od jakiego rozmiaru jacht żaglowy może nieść latarnię trójsektorową na topie masztu zamiast świateł burtowych i rufowego?', 'Below what length may a sailing vessel carry a tricolour at the masthead instead of sidelights and stern light?'], ['Poniżej 20 m długości', 'Less than 20 m in length'], ['Poniżej 7 m długości', 'Less than 7 m in length'], ['Poniżej 50 m długości', 'Less than 50 m in length'], ['Prawidło 25(b). Trójsektorowej nie łączy się z silnikiem – na silniku obowiązują światła motorowca.', 'Rule 25(b). Not to be used under engine – then power-driven lights apply.']],
  // --- przepisy śródlądowe ---
  ['inland', 'inlandRules', ['Która jednostka jest „małą jednostką” według przepisów żeglugowych na śródlądowych drogach wodnych?', 'Which craft is a “small craft” under the inland navigation regulations?'], ['Statek o długości kadłuba mniejszej niż 20 m (poza holownikami, pchaczami, promami i statkami pasażerskimi)', 'A vessel with a hull length under 20 m (except tugs, pushers, ferries and passenger vessels)'], ['Każdy jacht żaglowy, niezależnie od długości', 'Every sailing yacht, whatever its length'], ['Statek o długości mniejszej niż 7 m', 'A vessel under 7 m in length']],
  ['inland', 'inlandRules', ['Mały jacht spotyka na szlaku statek, który nie jest małą jednostką (np. barkę). Kto ustępuje drogi?', 'A small yacht meets a vessel that is not a small craft (e.g. a barge). Who gives way?'], ['Mały jacht – małe jednostki ustępują drogi wszystkim pozostałym statkom', 'The small yacht – small craft give way to all other vessels'], ['Barka, bo jacht jest pod żaglami', 'The barge, because the yacht is under sail'], ['Ten, kto płynie pod prąd', 'Whoever is going upstream']],
  ['inland', 'inlandRules', ['Mała jednostka o napędzie mechanicznym spotyka małą jednostkę żaglową. Kto ustępuje drogi?', 'A small motor craft meets a small sailing craft. Who gives way?'], ['Jednostka o napędzie mechanicznym', 'The motor craft'], ['Jednostka żaglowa', 'The sailing craft'], ['Ta, która ma drugą po prawej stronie', 'The one that has the other on its starboard side']],
  ['inland', 'inlandRules', ['Łódź wiosłowa spotyka małą jednostkę żaglową. Kto ustępuje drogi?', 'A rowing boat meets a small sailing craft. Who gives way?'], ['Łódź wiosłowa', 'The rowing boat'], ['Jednostka żaglowa', 'The sailing craft'], ['Ta, która jest bliżej brzegu', 'The one nearer the bank']],
  ['inland', 'inlandRules', ['Dwie małe jednostki żaglowe na śródlądziu mają wiatr z różnych burt. Która ustępuje?', 'Two small sailing craft on inland waters have the wind on different sides. Which gives way?'], ['Ta, która ma wiatr z lewej burty', 'The one with the wind on the port side'], ['Ta, która ma wiatr z prawej burty', 'The one with the wind on the starboard side'], ['Ta, która płynie z prądem', 'The one going downstream']],
  ['inland', 'inlandRules', ['Z której strony wyprzedza się zwykle statek na drodze śródlądowej?', 'On which side is a vessel normally overtaken on an inland waterway?'], ['Z lewej burty statku wyprzedzanego', 'On the port side of the vessel being overtaken'], ['Z prawej burty statku wyprzedzanego', 'On the starboard side of the vessel being overtaken'], ['Zawsze od strony głębszej wody, niezależnie od burty', 'Always on the deeper-water side, whatever the side']],
  ['inland', 'inlandRules', ['Jak mijają się statki płynące w przeciwnych kierunkach na drodze śródlądowej?', 'How do vessels proceeding in opposite directions pass on an inland waterway?'], ['Lewymi burtami – każdy trzyma się prawej strony szlaku', 'Port to port – each keeps to the starboard side of the fairway'], ['Prawymi burtami', 'Starboard to starboard'], ['Dowolnie, zależnie od wiatru', 'Either way, depending on the wind']],
  ['inland', 'inlandRules', ['W wąskim przejściu na rzece spotykają się statek płynący w górę i statek płynący w dół rzeki. Który ustępuje?', 'In a narrow passage on a river a vessel going upstream meets one going downstream. Which gives way?'], ['Płynący w górę rzeki (pod prąd) – czeka poniżej przejścia', 'The one going upstream – it waits below the passage'], ['Płynący w dół rzeki (z prądem)', 'The one going downstream'], ['Ten, który jest większy', 'The larger one']],
  ['inland', 'inlandRules', ['Gdzie zabroniony jest postój statków na drogach śródlądowych?', 'Where is berthing prohibited on inland waterways?'], ['M.in. pod mostami i liniami wysokiego napięcia, w przejściach wąskich, na wejściach do portów i trasach promów', 'Among others under bridges and power lines, in narrow passages, at harbour entrances and on ferry routes'], ['Wyłącznie w miejscach oznaczonych znakiem A.5', 'Only where sign A.5 is displayed'], ['Nigdzie – postój jest wszędzie dozwolony', 'Nowhere – berthing is allowed everywhere']],
  ['inland', 'inlandRules', ['Jak określa się prawy i lewy brzeg rzeki?', 'How are the right and left banks of a river defined?'], ['Patrząc w dół rzeki – zgodnie z kierunkiem prądu', 'Looking downstream – in the direction of the current'], ['Patrząc w górę rzeki – pod prąd', 'Looking upstream – against the current'], ['Patrząc od strony morza', 'Looking from the sea']],
  ['inland', 'inlandRules', ['Kto ma pierwszeństwo: mały jacht czy prom?', 'Who has priority: a small yacht or a ferry?'], ['Prom – małe jednostki ustępują promom', 'The ferry – small craft give way to ferries'], ['Mały jacht pod żaglami', 'The small yacht under sail'], ['Ten, kto pierwszy da sygnał dźwiękowy', 'Whoever sounds a signal first']],
  ['inland', 'inlandRules', ['Jak wchodzi się do śluzy?', 'How do you enter a lock?'], ['Na sygnał zezwalający (zielone światło) i w kolejności ustalonej przez obsługę śluzy', 'On the permissive signal (green light) and in the order set by the lock staff'], ['Małe jednostki wchodzą zawsze pierwsze', 'Small craft always enter first'], ['Każdy, kto zdąży, niezależnie od sygnałów', 'Anyone who gets there first, regardless of signals']],
  ['inland', 'inlandRules', ['Jak zachowujesz się w śluzie podczas zmiany poziomu wody?', 'How do you behave in a lock while the water level changes?'], ['Pilnuję cum i luzuję je lub wybieram w miarę zmiany poziomu', 'I tend the lines, easing or taking them in as the level changes'], ['Mocno knaguję cumy na stałe', 'I make the lines fast and leave them'], ['Rzucam kotwicę, aby jacht się nie przesuwał', 'I drop the anchor so the yacht does not move']],
  ['inland', 'inlandRules', ['Co oznacza obowiązek nietworzenia fali (znak A.9)?', 'What does the no-wash obligation (sign A.9) mean?'], ['Trzeba zmniejszyć prędkość, aby fala nie szkodziła statkom na postoju, brzegom i budowlom', 'Slow down so that the wash does not harm moored vessels, banks and structures'], ['Wolno płynąć tylko na żaglach', 'You may proceed under sail only'], ['Trzeba płynąć środkiem szlaku', 'You must keep to the middle of the fairway']],
  ['inland', 'inlandRules', ['Jak oznakowana jest prawa strona szlaku żeglownego na drogach śródlądowych?', 'How is the right-hand side of the fairway marked on inland waterways?'], ['Czerwonymi pławami walcowymi lub tyczkami z czerwonym walcem', 'With red can buoys or spars with a red cylinder'], ['Zielonymi pławami stożkowymi', 'With green conical buoys'], ['Żółtymi pławami z krzyżem', 'With yellow buoys with a cross']],
  ['inland', 'inlandRules', ['Jakie światło niesie nocą łódź wiosłowa na drodze śródlądowej?', 'What light does a rowing boat show at night on an inland waterway?'], ['Jedno białe światło widoczne dookoła widnokręgu', 'One white all-round light'], ['Światła burtowe i rufowe', 'Sidelights and a stern light'], ['Czerwone nad białym', 'Red over white']],
  ['inland', 'inlandRules', ['Jakiej długości jacht żaglowy wolno prowadzić na wodach śródlądowych bez patentu (osoba pełnoletnia)?', 'What length of sailing yacht may an adult skipper without a licence handle on inland waters?'], ['Do 7,5 m długości kadłuba', 'Up to 7.5 m hull length'], ['Do 12 m długości kadłuba', 'Up to 12 m hull length'], ['Do 5 m długości kadłuba', 'Up to 5 m hull length']],
  ['inland', 'inlandRules', ['Co sprawdzasz przed podejściem pod most na jachcie z masztem?', 'What do you check before passing under a bridge with a masted yacht?'], ['Prześwit pod mostem i wysokość masztu nad wodą (wraz z antenami)', 'The bridge clearance and the height of the mast above the water (with aerials)'], ['Tylko głębokość wody pod mostem', 'Only the depth under the bridge'], ['Kierunek wiatru nad mostem', 'The wind direction above the bridge']],
  ['inland', 'inlandRules', ['Jacht płynie w nocy po rzece z prądem. Która jednostka na szlaku ma zawsze pierwszeństwo przed małym jachtem?', 'A yacht is going downstream at night. Which vessel always has priority over a small yacht?'], ['Statek, który nie jest małą jednostką – np. pchacz z zestawem', 'A vessel that is not a small craft – e.g. a pusher with its convoy'], ['Inna mała jednostka żaglowa na lewym halsie', 'Another small sailing craft on port tack'], ['Łódź wiosłowa', 'A rowing boat']],
  ['inland', 'inlandRules', ['Która odpowiedź dotycząca kotwiczenia na szlaku żeglownym jest prawdziwa?', 'Which statement about anchoring in the fairway is true?'], ['Nie wolno kotwiczyć tam, gdzie utrudnia to żeglugę, ani w miejscach oznaczonych zakazem A.6', 'You must not anchor where it obstructs navigation or where sign A.6 is displayed'], ['Kotwiczyć wolno wszędzie, o ile wystawi się światło kotwiczne', 'You may anchor anywhere as long as you show an anchor light'], ['Kotwiczyć wolno tylko pod mostami', 'Anchoring is allowed only under bridges']],
  ['inland', 'inlandRules', ['Statek na szlaku daje jeden długi dźwięk. Co to oznacza na drogach śródlądowych?', 'A vessel on the waterway gives one long blast. What does it mean on inland waters?'], ['„Uwaga” – sygnał ogólny', '“Attention” – general signal'], ['„Zmieniam kurs w prawo”', '“I am altering course to starboard”'], ['„Jestem niezdolny do manewrowania”', '“I am unable to manoeuvre”']],
  // --- budowa jachtu, żeglowanie, locja ---
  ['both', 'seaman', ['Jak nazywa się lewa burta jachtu?', 'What is the left side of a yacht called (in Polish: bakburta)?'], ['Bakburta', 'Port'], ['Sterburta', 'Starboard'], ['Nawietrzna', 'Windward']],
  ['both', 'seaman', ['Jak nazywa się prawa burta jachtu?', 'What is the right side of a yacht called?'], ['Sterburta', 'Starboard'], ['Bakburta', 'Port'], ['Zawietrzna', 'Leeward']],
  ['both', 'seaman', ['Co to jest strona nawietrzna?', 'What is the windward side?'], ['Strona, z której wieje wiatr', 'The side the wind blows from'], ['Strona, na którą wieje wiatr', 'The side the wind blows towards'], ['Strona bliższa brzegu', 'The side nearer the shore']],
  ['both', 'seaman', ['Co oznacza „odpadać”?', 'What does “bearing away” mean?'], ['Zwiększać kąt między kursem jachtu a kierunkiem wiatru', 'Increasing the angle between the course and the wind'], ['Zmniejszać kąt między kursem a kierunkiem wiatru', 'Decreasing the angle between the course and the wind'], ['Zmieniać hals rufą przez linię wiatru', 'Changing tack with the stern through the wind']],
  ['both', 'seaman', ['Co to jest zwrot przez sztag?', 'What is tacking?'], ['Zmiana halsu, podczas której dziób jachtu przechodzi przez linię wiatru', 'A change of tack in which the bow passes through the wind'], ['Zmiana halsu, podczas której rufa przechodzi przez linię wiatru', 'A change of tack in which the stern passes through the wind'], ['Zatrzymanie jachtu dziobem do wiatru', 'Stopping the yacht head to wind']],
  ['both', 'seaman', ['Jak nazywa się kurs ostry, ok. 45° do wiatru?', 'What is the close-hauled point of sail, about 45° to the wind, called (in Polish: bajdewind)?'], ['Bajdewind', 'Close-hauled'], ['Fordewind', 'Running'], ['Półwiatr', 'Beam reach']],
  ['both', 'seaman', ['Jak nazywa się kurs z wiatrem wiejącym prosto od rufy?', 'What is the point of sail with the wind dead astern called?'], ['Fordewind', 'Running (dead run)'], ['Baksztag', 'Broad reach'], ['Bajdewind', 'Close-hauled']],
  ['both', 'seaman', ['Jak nazywa się kurs z wiatrem wiejącym prostopadle do osi jachtu?', 'What is the point of sail with the wind at right angles to the yacht called?'], ['Półwiatr', 'Beam reach'], ['Baksztag', 'Broad reach'], ['Fordewind', 'Running']],
  ['both', 'seaman', ['Do czego służy szot?', 'What is a sheet used for?'], ['Do ustawiania żagla względem wiatru', 'To trim the sail to the wind'], ['Do podnoszenia żagla', 'To hoist the sail'], ['Do cumowania jachtu', 'To moor the yacht']],
  ['both', 'seaman', ['Do czego służy fał?', 'What is a halyard used for?'], ['Do podnoszenia i opuszczania żagla', 'To hoist and lower a sail'], ['Do ustawiania żagla względem wiatru', 'To trim a sail'], ['Do mocowania bomu do pokładu', 'To fasten the boom to the deck']],
  ['both', 'seaman', ['Co to jest refowanie?', 'What is reefing?'], ['Zmniejszanie powierzchni żagla', 'Reducing the sail area'], ['Zwiększanie powierzchni żagla', 'Increasing the sail area'], ['Zmiana halsu', 'Changing tack']],
  ['both', 'seaman', ['Który węzeł tworzy pętlę, która się nie zaciska (np. do ratowania człowieka)?', 'Which knot forms a loop that does not slip (e.g. for rescuing a person)?'], ['Węzeł ratowniczy (bulin)', 'Bowline'], ['Wyblinka', 'Clove hitch'], ['Węzeł płaski', 'Reef knot']],
  ['both', 'seaman', ['Do czego służy zwykle wyblinka?', 'What is a clove hitch usually used for?'], ['Do szybkiego mocowania liny do relingu lub słupka, np. odbijaczy', 'To make a line fast quickly to a rail or post, e.g. fenders'], ['Do łączenia dwóch lin różnej grubości', 'To join two ropes of different sizes'], ['Do tworzenia pętli ratowniczej', 'To make a rescue loop']],
  ['both', 'seaman', ['Do czego służy węzeł ósemka?', 'What is a figure-of-eight knot used for?'], ['Zabezpiecza koniec liny przed wysunięciem się z bloczka lub przelotki', 'It stops the end of a line running out through a block or fairlead'], ['Do cumowania do pachołka', 'To moor to a bollard'], ['Do skracania liny', 'To shorten a rope']],
  ['both', 'seaman', ['Co to jest szpring?', 'What is a spring line?'], ['Cuma prowadzona skośnie wzdłuż burty – zapobiega przesuwaniu się jachtu wzdłuż kei', 'A line led diagonally along the side – it stops the yacht moving along the quay'], ['Cuma dziobowa prowadzona prostopadle do kei', 'A bow line led at right angles to the quay'], ['Lina do podnoszenia kotwicy', 'A line for raising the anchor']],
  ['both', 'seaman', ['Co to jest sztag?', 'What is a forestay?'], ['Lina olinowania stałego od masztu do dziobu', 'A standing-rigging wire from the mast to the bow'], ['Lina od masztu do rufy', 'A wire from the mast to the stern'], ['Lina podtrzymująca maszt z boku', 'A wire supporting the mast from the side']],
  ['both', 'seaman', ['Co to są wanty?', 'What are shrouds?'], ['Liny olinowania stałego podtrzymujące maszt z boków', 'Standing rigging supporting the mast from the sides'], ['Liny do podnoszenia żagli', 'Lines for hoisting sails'], ['Liny do ustawiania żagli', 'Lines for trimming sails']],
  ['both', 'seaman', ['Do czego służy bom?', 'What is the boom for?'], ['Do niego mocuje się dolny lik grota', 'The foot of the mainsail is attached to it'], ['Podtrzymuje maszt od dziobu', 'It supports the mast from forward'], ['Służy do sterowania jachtem', 'It is used to steer the yacht']],
  ['both', 'seaman', ['Do czego służy miecz lub balastowy kil?', 'What is a centreboard or ballast keel for?'], ['Przeciwdziała znoszeniu jachtu i zapewnia stateczność', 'It resists leeway and gives stability'], ['Zwiększa prędkość przy wietrze od rufy', 'It increases speed downwind'], ['Służy do kotwiczenia', 'It is used for anchoring']],
  ['both', 'seaman', ['Jak nazywa się kuchnia na jachcie?', 'What is the kitchen on a yacht called?'], ['Kambuz', 'Galley'], ['Mesa', 'Saloon'], ['Kokpit', 'Cockpit']],
  ['both', 'seaman', ['Ile metrów ma mila morska?', 'How many metres is a nautical mile?'], ['1852 m', '1852 m'], ['1609 m', '1609 m'], ['1000 m', '1000 m']],
  ['both', 'seaman', ['Co oznacza prędkość 1 węzła?', 'What is a speed of 1 knot?'], ['1 mila morska na godzinę', '1 nautical mile per hour'], ['1 kilometr na godzinę', '1 kilometre per hour'], ['1 metr na sekundę', '1 metre per second']],
  ['both', 'seaman', ['Przy jakim wietrze wygodniej jest podejść do kei?', 'Which wind makes it easier to come alongside a quay?'], ['Przy wietrze odpychającym od kei, podchodząc pod niewielkim kątem i pod wiatr', 'With the wind blowing off the quay, approaching at a small angle into the wind'], ['Przy silnym wietrze od rufy, z dużą prędkością', 'With a strong following wind, at high speed'], ['Zawsze z wiatrem w burtę od strony wody', 'Always with the wind on the beam from seaward']],
  ['both', 'seaman', ['Ile łańcucha wydajesz przy kotwiczeniu w dobrych warunkach?', 'How much chain do you let out when anchoring in good conditions?'], ['Ok. 3–5 głębokości (lina – więcej)', 'About 3–5 times the depth (more with rope)'], ['Tyle, ile wynosi głębokość', 'As much as the depth'], ['Zawsze cały łańcuch', 'Always the whole chain']],
  // --- nawigacja na morzu ---
  ['sea', 'nav', ['Co to jest deklinacja?', 'What is variation (magnetic declination)?'], ['Kąt między północą rzeczywistą a magnetyczną', 'The angle between true and magnetic north'], ['Odchylenie kompasu spowodowane żelazem na jachcie', 'The compass error caused by iron on board'], ['Kąt znoszenia jachtu przez wiatr', 'The angle the wind pushes the yacht off course']],
  ['sea', 'nav', ['Co to jest dewiacja?', 'What is deviation?'], ['Odchylenie igły kompasu spowodowane polem magnetycznym jachtu', 'The compass error caused by the yacht’s own magnetic field'], ['Kąt między północą rzeczywistą a magnetyczną', 'The angle between true and magnetic north'], ['Znoszenie jachtu przez prąd', 'The set of the yacht by the current']],
  ['sea', 'nav', ['Ile wynosi 1 minuta szerokości geograficznej?', 'How much is 1 minute of latitude?'], ['1 mila morska', '1 nautical mile'], ['1 kilometr', '1 kilometre'], ['1 kabel', '1 cable']],
  ['sea', 'nav', ['Gdzie na mapie mierzysz odległość cyrklem?', 'Where on the chart do you measure distance with dividers?'], ['Na skali szerokości (pionowa ramka mapy), na wysokości mierzonego odcinka', 'On the latitude scale (vertical border) level with the distance measured'], ['Na skali długości (pozioma ramka mapy)', 'On the longitude scale (horizontal border)'], ['Na róży kompasowej', 'On the compass rose']],
  ['sea', 'nav', ['Do jakiego poziomu odnoszą się głębokości na mapie morskiej?', 'To what level are chart depths referred?'], ['Do zera mapy (poziomu odniesienia głębokości)', 'To chart datum'], ['Do najwyższego poziomu wody', 'To the highest water level'], ['Do poziomu wody w chwili pomiaru', 'To the water level at the time of the survey']],
  ['sea', 'nav', ['Co to jest nabieżnik?', 'What is a transit (leading line)?'], ['Linia wyznaczona przez dwa znaki widziane jeden za drugim', 'A line given by two marks seen one behind the other'], ['Znak kardynalny wskazujący kierunek', 'A cardinal mark showing direction'], ['Światło o zmiennym kolorze', 'A light that changes colour']],
  // --- meteorologia ---
  ['both', 'meteo', ['Jak krąży wiatr wokół niżu na półkuli północnej?', 'How does the wind circulate round a low in the northern hemisphere?'], ['Przeciwnie do ruchu wskazówek zegara, ze zbieżnością do środka', 'Anticlockwise, converging towards the centre'], ['Zgodnie z ruchem wskazówek zegara, od środka na zewnątrz', 'Clockwise, outward from the centre'], ['Prosto od wyżu do niżu, bez skręcania', 'Straight from high to low without turning']],
  ['both', 'meteo', ['Prawo Buys-Ballota: stoisz plecami do wiatru. Gdzie jest niż?', 'Buys Ballot’s law: you stand with your back to the wind. Where is the low?'], ['Po lewej stronie, nieco z przodu', 'On the left, slightly ahead'], ['Po prawej stronie', 'On the right'], ['Dokładnie za tobą', 'Directly behind you']],
  ['both', 'meteo', ['Co oznaczają izobary położone blisko siebie na mapie synoptycznej?', 'What do closely spaced isobars on a weather map mean?'], ['Silny wiatr', 'Strong wind'], ['Słaby wiatr lub ciszę', 'Light wind or calm'], ['Mgłę', 'Fog']],
  ['both', 'meteo', ['Jak zmienia się pogoda przy przejściu frontu chłodnego?', 'How does the weather change as a cold front passes?'], ['Szkwały i przelotne ulewy, wiatr skręca w prawo, ciśnienie zaczyna rosnąć, potem przejaśnienia', 'Squalls and showers, the wind veers, pressure starts rising, then clearing'], ['Długotrwała mżawka i stopniowy spadek ciśnienia', 'Long-lasting drizzle and slowly falling pressure'], ['Nic się nie zmienia', 'Nothing changes']],
  ['both', 'meteo', ['Jakiej pogody można się spodziewać w wyżu?', 'What weather can you expect in a high?'], ['Zwykle pogodnej, ze słabym wiatrem; latem możliwa bryza, jesienią mgły', 'Usually fair with light wind; sea breezes in summer, fog in autumn'], ['Silnego wiatru i ulew', 'Strong wind and heavy rain'], ['Burz i szkwałów przez cały czas', 'Constant thunderstorms and squalls']],
  ['both', 'meteo', ['Na jeziorze nadciąga ciemna chmura burzowa (Cb) z wałem szkwałowym. Co robisz?', 'A dark thundercloud (Cb) with a squall line is approaching on a lake. What do you do?'], ['Refuję lub zrzucam żagle, zakładam kamizelki i kieruję się w bezpieczne miejsce', 'Reef or drop the sails, put on lifejackets and head for safety'], ['Stawiam więcej żagli, by szybciej dopłynąć', 'Set more sail to get there faster'], ['Nic – szkwał nie zagraża jachtom', 'Nothing – a squall does not threaten yachts']],
  // --- bezpieczeństwo ---
  ['both', 'safety', ['Człowiek wypadł za burtę. Co robisz najpierw?', 'Someone has fallen overboard. What do you do first?'], ['Alarmuję załogę okrzykiem, rzucam koło ratunkowe i wyznaczam osobę, która cały czas wskazuje rozbitka', 'Shout the alarm, throw a lifebuoy and have one person keep pointing at the casualty'], ['Natychmiast skaczę do wody', 'Jump in at once'], ['Najpierw zrzucam wszystkie żagle', 'First drop all the sails']],
  ['both', 'safety', ['Jak postępujesz z osobą wyziębioną, wyciągniętą z wody?', 'How do you treat a hypothermic person taken out of the water?'], ['Ogrzewam ją stopniowo w pozycji poziomej, osłaniam przed wiatrem, nie podaję alkoholu', 'Rewarm gradually, keep horizontal, shelter from wind, no alcohol'], ['Podaję alkohol na rozgrzewkę', 'Give alcohol to warm up'], ['Intensywnie masuję kończyny', 'Rub the limbs vigorously']],
  ['both', 'safety', ['Czym gasisz płonący tłuszcz na kuchence?', 'How do you put out burning fat on the stove?'], ['Kocem gaśniczym (odcięciem dopływu powietrza)', 'With a fire blanket (smothering)'], ['Wodą', 'With water'], ['Gaśnicą wodną', 'With a water extinguisher']],
  ['both', 'safety', ['Czym różni się kamizelka ratunkowa od asekuracyjnej?', 'How does a lifejacket differ from a buoyancy aid?'], ['Ratunkowa obraca nieprzytomnego twarzą do góry i utrzymuje go nad wodą', 'A lifejacket turns an unconscious person face up and keeps them afloat'], ['Asekuracyjna ma większą wyporność', 'A buoyancy aid has more buoyancy'], ['Niczym – to nazwy zamienne', 'No difference – the names are interchangeable']],
  ['both', 'safety', ['Ile kamizelek ratunkowych powinno być na jachcie?', 'How many lifejackets should there be on board?'], ['Co najmniej tyle, ile osób na pokładzie', 'At least one per person on board'], ['Jedna na trzy osoby', 'One per three people'], ['Wystarczy jedna dla sternika', 'One for the helmsman is enough']],
  ['both', 'safety', ['Do czego wpinasz lifelinę szelek asekuracyjnych?', 'What do you clip a safety harness tether to?'], ['Do lifeliny rozpiętej wzdłuż pokładu lub do mocnych punktów kotwiczenia', 'To a jackstay along the deck or to strong anchorage points'], ['Do relingu lub szotów', 'To the guardrail or the sheets'], ['Do bomu', 'To the boom']],
  ['both', 'safety', ['Co oznacza czerwona rakieta spadochronowa lub czerwona flara ręczna?', 'What does a red parachute rocket or red hand flare mean?'], ['Wzywanie pomocy – jacht lub ludzie są w niebezpieczeństwie', 'Distress – the vessel or people are in danger'], ['Ostrzeżenie przed mielizną', 'A warning of shoal water'], ['Prośbę o pilota', 'A request for a pilot']],
  ['both', 'safety', ['Jaki sygnał wzywania pomocy możesz dać bez żadnego sprzętu?', 'What distress signal can you give without any equipment?'], ['Powolne podnoszenie i opuszczanie wyciągniętych w bok ramion', 'Slowly raising and lowering outstretched arms'], ['Machanie jedną ręką nad głową', 'Waving one arm above the head'], ['Klaskanie w dłonie', 'Clapping hands']],
  ['both', 'safety', ['Mały jacht wywrócił się na jeziorze. Co robisz?', 'A small yacht has capsized on a lake. What do you do?'], ['Zostaję przy jachcie, sprawdzam załogę i próbuję go postawić lub czekam na pomoc', 'Stay with the boat, check the crew and try to right it or wait for help'], ['Płynę wpław do brzegu, zostawiając jacht', 'Swim for the shore, leaving the boat'], ['Zdejmuję kamizelkę, by łatwiej płynąć', 'Take off the lifejacket to swim more easily']],
  ['sea', 'safety', ['Jakiego słowa używasz w komunikacie o niebezpieczeństwie grożącym życiu?', 'Which word starts a distress call when life is in danger?'], ['MAYDAY', 'MAYDAY'], ['PAN-PAN', 'PAN-PAN'], ['SÉCURITÉ', 'SÉCURITÉ']],
  ['sea', 'safety', ['Awaria silnika blisko brzegu, nikomu nic nie grozi bezpośrednio, ale potrzebujesz holowania. Jaki komunikat nadajesz?', 'Engine failure near the coast, no immediate danger to life, but you need a tow. Which message do you send?'], ['PAN-PAN', 'PAN-PAN'], ['MAYDAY', 'MAYDAY'], ['SÉCURITÉ', 'SÉCURITÉ']],
  ['sea', 'safety', ['Którym słowem zaczyna się ostrzeżenie nawigacyjne lub meteorologiczne?', 'Which word starts a navigational or meteorological warning?'], ['SÉCURITÉ', 'SÉCURITÉ'], ['PAN-PAN', 'PAN-PAN'], ['MAYDAY', 'MAYDAY']],
  ['both', 'safety', ['Pod jakim numerem alarmowym wezwiesz pomoc nad wodą w Polsce?', 'Which emergency number calls for help on the water in Poland?'], ['984 (lub 601 100 100 – WOPR, oraz ogólny 112)', '984 (or 601 100 100 – WOPR, and the general 112)'], ['997 wyłącznie', '997 only'], ['999 wyłącznie', '999 only']],
  // --- dodatkowe pytania: prawo drogi ---
  ['sea', 'rules', ['Jak postępuje jacht wobec statku ograniczonego zanurzeniem (w nocy trzy czerwone światła dookólne)?', 'How does a yacht act towards a vessel constrained by her draught (three red all-round lights at night)?'], ['Unika utrudniania mu bezpiecznego przejścia', 'It avoids impeding her safe passage'], ['Statek ten musi ustąpić drogi jachtowi', 'That vessel must give way to the yacht'], ['Może przeciąć mu kurs tuż przed dziobem', 'It may cross close ahead of her'], ['Prawidło 18(d).', 'Rule 18(d).']],
  ['both', 'rules', ['Kto odpowiada za uniknięcie zderzenia?', 'Who is responsible for avoiding a collision?'], ['Każdy kapitan – przepisy nie zwalniają z zachowania dobrej praktyki morskiej', 'Every master – the rules do not excuse neglecting good seamanship'], ['Tylko statek ustępujący drogi', 'Only the give-way vessel'], ['Tylko większy statek', 'Only the larger vessel'], ['Prawidło 2.', 'Rule 2.']],
  ['both', 'rules', ['Jak należy prowadzić obserwację?', 'How should a lookout be kept?'], ['Stale – wzrokiem, słuchem i wszystkimi dostępnymi środkami', 'At all times – by sight, hearing and all available means'], ['Tylko nocą i we mgle', 'Only at night and in fog'], ['Wystarczy radar lub AIS', 'Radar or AIS is enough'], ['Prawidło 5.', 'Rule 5.']],
  ['sea', 'rules', ['Której strony wąskiego przejścia trzyma się jacht?', 'Which side of a narrow channel does a yacht keep to?'], ['Zewnętrznej granicy przejścia po swojej prawej burcie', 'The outer limit of the channel on her starboard side'], ['Lewej strony przejścia', 'The port side of the channel'], ['Środka toru, gdzie jest najgłębiej', 'The middle, where it is deepest'], ['Prawidło 9(a).', 'Rule 9(a).']],
  ['sea', 'rules', ['Jak płynie jacht korzystający z systemu rozgraniczenia ruchu?', 'How does a yacht proceed when using a traffic separation scheme?'], ['Właściwym torem ruchu, w ogólnym kierunku ruchu dla tego toru', 'In the appropriate lane, in the general direction of traffic flow'], ['Strefą rozgraniczenia między torami', 'Along the separation zone'], ['Dowolnym torem, pod prąd ruchu', 'In any lane, against the traffic flow'], ['Prawidło 10(b).', 'Rule 10(b).']],
  ['sea', 'rules', ['Kto może korzystać ze strefy żeglugi przybrzeżnej obok systemu rozgraniczenia ruchu?', 'Who may use an inshore traffic zone next to a TSS?'], ['Statki krótsze niż 20 m, żaglowce i statki zajęte połowem', 'Vessels under 20 m, sailing vessels and vessels engaged in fishing'], ['Tylko statki dłuższe niż 50 m', 'Only vessels over 50 m'], ['Nikt – to strefa zamknięta', 'Nobody – it is a closed zone'], ['Prawidło 10(d).', 'Rule 10(d).']],
  ['sea', 'rules', ['Przed dziobem widzisz jednocześnie czerwone i zielone światło burtowe oraz białe masztowe. Co to oznacza?', 'Ahead you see both sidelights, red and green, and a white masthead light. What does it mean?'], ['Statek o napędzie mechanicznym idzie prosto na ciebie', 'A power-driven vessel is heading straight at you'], ['Statek oddala się od ciebie', 'A vessel is moving away from you'], ['Jacht żaglowy przecina twój kurs', 'A sailing yacht is crossing your course']],
  ['both', 'rules', ['Nocą widzisz tylko zielone światło burtowe innego statku. Którą jego stronę widzisz?', 'At night you see only the green sidelight of another vessel. Which side of it are you looking at?'], ['Prawą burtę', 'The starboard side'], ['Lewą burtę', 'The port side'], ['Rufę', 'The stern']],
  ['both', 'rules', ['Nocą widzisz tylko czerwone światło burtowe innego statku. Którą jego stronę widzisz?', 'At night you see only the red sidelight of another vessel. Which side of it are you looking at?'], ['Lewą burtę', 'The port side'], ['Prawą burtę', 'The starboard side'], ['Dziób – statek idzie prosto na ciebie', 'The bow – it is heading straight at you']],
  ['sea', 'rules', ['Przed dziobem widzisz jedno białe światło, namiar się nie zmienia, odległość maleje. Co to może być?', 'Ahead you see one white light, steady bearing, decreasing range. What could it be?'], ['Statek widziany od rufy (doganiasz go) albo statek na kotwicy', 'A vessel seen from astern (you are catching up) or a vessel at anchor'], ['Statek o napędzie mechanicznym idący na ciebie', 'A power-driven vessel heading towards you'], ['Jacht żaglowy widziany z boku', 'A sailing yacht seen from the side']],
  ['sea', 'rules', ['Czego dotyczy prawidło 19?', 'What does Rule 19 cover?'], ['Postępowania statków w ograniczonej widzialności, gdy się nawzajem nie widzą', 'Conduct of vessels in restricted visibility, not in sight of one another'], ['Statków widzących się wzajemnie', 'Vessels in sight of one another'], ['Kotwiczenia na redach', 'Anchoring in roadsteads']],
  ['sea', 'rules', ['We mgle wykrywasz radarem statek przed trawersem (nie wyprzedzasz go). Jakiej zmiany kursu unikasz?', 'In fog you detect by radar a vessel forward of the beam (not being overtaken). Which course change do you avoid?'], ['Zmiany kursu w lewo', 'Altering course to port'], ['Zmiany kursu w prawo', 'Altering course to starboard'], ['Zmniejszenia prędkości', 'Reducing speed'], ['Prawidło 19(d)(i).', 'Rule 19(d)(i).']],
  ['sea', 'rules', ['Co oznacza statek „w drodze”?', 'What does “under way” mean?'], ['Statek, który nie stoi na kotwicy, nie jest przycumowany i nie stoi na mieliźnie', 'A vessel not at anchor, not made fast to the shore and not aground'], ['Tylko statek, który płynie z prędkością powyżej 1 kn', 'Only a vessel moving faster than 1 kn'], ['Tylko statek z pracującym silnikiem', 'Only a vessel with her engine running']],
  ['sea', 'rules', ['Od jakiej długości statek na kotwicy musi oświetlać pokład?', 'From what length must a vessel at anchor illuminate her decks?'], ['Od 100 m', 'From 100 m'], ['Od 50 m', 'From 50 m'], ['Od 20 m', 'From 20 m']],
  ['sea', 'rules', ['Jaki zasięg musi mieć światło masztowe statku o długości 50 m i więcej?', 'What range must the masthead light of a vessel of 50 m or more have?'], ['6 Mm', '6 NM'], ['2 Mm', '2 NM'], ['12 Mm', '12 NM']],
  // --- dodatkowe: budowa jachtu i żeglowanie ---
  ['both', 'seaman', ['Co to jest dryf?', 'What is leeway?'], ['Znoszenie jachtu przez wiatr na zawietrzną', 'The yacht being pushed to leeward by the wind'], ['Znoszenie jachtu przez prąd', 'The yacht being set by the current'], ['Kołysanie wzdłużne jachtu', 'The pitching of the yacht']],
  ['both', 'seaman', ['Co to jest pawęż?', 'What is a transom?'], ['Płaskie, poprzeczne zakończenie rufy', 'The flat, transverse end of the stern'], ['Część masztu nad salingiem', 'The part of the mast above the spreaders'], ['Rodzaj żagla przedniego', 'A kind of headsail']],
  ['both', 'seaman', ['Co to jest grot?', 'What is the mainsail?'], ['Główny żagiel, mocowany do masztu i bomu', 'The principal sail, set on the mast and boom'], ['Żagiel stawiany na sztagu', 'The sail set on the forestay'], ['Lina do podnoszenia żagla', 'A line for hoisting a sail']],
  ['both', 'seaman', ['Co to jest fok (genua)?', 'What is a jib (genoa)?'], ['Przedni żagiel stawiany na sztagu', 'The headsail set on the forestay'], ['Główny żagiel na maszcie', 'The main sail on the mast'], ['Żagiel stawiany na bezanmaszcie', 'A sail set on the mizzen mast']],
  ['both', 'seaman', ['Na jakich kursach stawia się spinaker?', 'On which points of sail is a spinnaker set?'], ['Na kursach pełnych – z wiatrem od rufy lub z boku od tyłu', 'Downwind – with the wind astern or on the quarter'], ['Na bajdewindzie', 'Close-hauled'], ['Tylko podczas sztormu', 'Only in a storm']],
  ['both', 'seaman', ['Co to jest achtersztag?', 'What is a backstay?'], ['Lina olinowania stałego od topu masztu do rufy', 'A standing-rigging wire from the masthead to the stern'], ['Lina od masztu do dziobu', 'A wire from the mast to the bow'], ['Lina do ustawiania grota', 'A line for trimming the mainsail']],
  ['both', 'seaman', ['Do czego służy odciągacz bomu (kicking)?', 'What is a boom vang (kicker) for?'], ['Ściąga bom w dół i ogranicza skręcenie grota', 'It pulls the boom down and controls mainsail twist'], ['Podnosi bom do góry na postoju', 'It lifts the boom when moored'], ['Mocuje bom do sztagu', 'It ties the boom to the forestay']],
  ['both', 'seaman', ['Co to jest szekla?', 'What is a shackle?'], ['Metalowy łącznik w kształcie litery U z zakręcanym bolcem', 'A U-shaped metal connector closed by a screw pin'], ['Rodzaj węzła', 'A kind of knot'], ['Część steru', 'A part of the rudder']],
  ['both', 'seaman', ['Do czego służy knaga?', 'What is a cleat for?'], ['Do mocowania (knagowania) liny', 'For making a line fast'], ['Do prowadzenia szotów przez blok', 'For leading sheets through a block'], ['Do mocowania odbijaczy do burty', 'For fixing fenders to the hull']],
  ['both', 'seaman', ['Do czego służy ster strumieniowy?', 'What does a bow thruster do?'], ['Śruba w poprzecznym tunelu na dziobie przesuwa dziób w bok', 'A propeller in a transverse tunnel pushes the bow sideways'], ['Zwiększa prędkość jachtu na wprost', 'It increases the yacht’s speed ahead'], ['Zastępuje płetwę sterową na rufie', 'It replaces the rudder at the stern']],
  ['both', 'seaman', ['Na czym polega efekt śruby (prop walk) przy biegu wstecz?', 'What is prop walk when going astern?'], ['Rufę ściąga w bok, zanim jacht nabierze prędkości', 'The stern is pulled sideways before the yacht gathers way'], ['Jacht płynie szybciej niż do przodu', 'The yacht goes faster than ahead'], ['Dziób unosi się nad wodę', 'The bow lifts out of the water']],
  ['both', 'seaman', ['Co to jest halsowanie?', 'What is beating (tacking upwind)?'], ['Żegluga zygzakiem pod wiatr kolejnymi halsami', 'Sailing a zigzag to windward on alternate tacks'], ['Żegluga z wiatrem w rufę', 'Sailing with the wind astern'], ['Holowanie jachtu na linie', 'Towing a yacht on a line']],
  ['both', 'seaman', ['Dlaczego niekontrolowany zwrot przez rufę jest niebezpieczny?', 'Why is an uncontrolled gybe dangerous?'], ['Bom gwałtownie przerzuca się na drugą burtę – może uderzyć załogę i uszkodzić olinowanie', 'The boom swings violently across – it can hit the crew and damage the rig'], ['Jacht zawsze się wtedy wywraca', 'The yacht always capsizes'], ['Silnik przestaje działać', 'The engine stops']],
  ['both', 'seaman', ['Co to jest dryfkotwa?', 'What is a drogue (sea anchor)?'], ['Stożek lub spadochron z tkaniny na linie – spowalnia dryf i ustawia jacht do fali', 'A fabric cone or parachute on a line – it slows drift and holds the yacht to the sea'], ['Kotwica na łańcuchu do kotwiczenia w porcie', 'A chain anchor for use in harbour'], ['Lina łącząca dwa jachty w tratwie', 'A line rafting two yachts together']],
  ['both', 'seaman', ['Co to jest stanie w dryfie (heave-to)?', 'What is heaving-to?'], ['Fok wybrany na przeciwną burtę i ster na nawietrzną – jacht prawie stoi', 'Jib backed and helm to windward – the yacht almost stops'], ['Płynięcie z maksymalną prędkością z wiatrem', 'Running at full speed downwind'], ['Kotwiczenie na dwóch kotwicach', 'Anchoring with two anchors']],
  ['both', 'seaman', ['Do czego służą odbijacze?', 'What are fenders for?'], ['Chronią burtę przed uderzeniem o keję lub inne jachty', 'They protect the hull against the quay or other boats'], ['Utrzymują jacht na wodzie po zalaniu', 'They keep the yacht afloat if flooded'], ['Służą do sygnalizacji', 'They are used for signalling']],
  ['both', 'seaman', ['Do czego służy bosak?', 'What is a boathook for?'], ['Do chwytania cum, muringów i przedmiotów z wody', 'To catch lines, mooring lines and objects in the water'], ['Do wybierania szotów', 'To trim sheets'], ['Do mierzenia głębokości', 'To measure depth']],
  ['both', 'seaman', ['Co to jest muring?', 'What is a lazy line (mooring line)?'], ['Lina od martwej kotwicy na dnie, podawana z kei do zacumowania dziobu lub rufy', 'A line from a ground anchor on the seabed, led from the quay to secure the bow or stern'], ['Lina do podnoszenia grota', 'A line for hoisting the mainsail'], ['Rodzaj odbijacza', 'A type of fender']],
  ['both', 'seaman', ['Łopocze przednia krawędź żagla (przedni lik). Co to oznacza?', 'The luff of the sail is flapping. What does it mean?'], ['Jacht ostrzy za bardzo albo szot jest za luźno – odpadnij lub wybierz szot', 'You are pointing too high or the sheet is too loose – bear away or trim in'], ['Żagiel jest wybrany za mocno', 'The sail is sheeted in too hard'], ['Wiatr ucichł zupełnie', 'The wind has died completely']],
  ['both', 'seaman', ['Po co zakłada się szpring przy odchodzeniu od kei?', 'Why is a spring used when leaving a quay?'], ['Pracując na szpringu silnikiem, odsuwa się dziób lub rufę od kei', 'Motoring against the spring swings the bow or stern away from the quay'], ['Żeby jacht szybciej nabrał prędkości', 'To make the yacht gather speed faster'], ['Szpringu nigdy nie używa się przy odchodzeniu', 'A spring is never used when leaving']],
  ['both', 'seaman', ['Jak podchodzi się do miejsca kotwiczenia?', 'How do you approach an anchorage?'], ['Pod wiatr lub pod prąd, z małą prędkością; kotwicę rzuca się, gdy jacht się zatrzymuje', 'Into the wind or current, slowly; drop the anchor as the yacht stops'], ['Z wiatrem, z pełną prędkością', 'Downwind at full speed'], ['Bokiem do wiatru, nie zatrzymując jachtu', 'Beam-on to the wind without stopping']],
  // --- dodatkowe: bezpieczeństwo i łączność ---
  ['both', 'safety', ['W jakiej pozycji układasz nieprzytomnego, który oddycha?', 'How do you place an unconscious casualty who is breathing?'], ['W pozycji bezpiecznej (bocznej ustalonej)', 'In the recovery position'], ['Na plecach z głową wyżej', 'On the back with the head raised'], ['W pozycji siedzącej', 'Sitting up']],
  ['both', 'safety', ['Jaki jest stosunek uciśnięć klatki piersiowej do oddechów ratowniczych u dorosłego?', 'What is the ratio of chest compressions to rescue breaths for an adult?'], ['30 : 2', '30 : 2'], ['15 : 1', '15 : 1'], ['5 : 1', '5 : 1']],
  ['both', 'safety', ['Co pomaga na chorobę morską?', 'What helps with seasickness?'], ['Przebywanie na pokładzie, patrzenie na horyzont, sterowanie, picie wody', 'Staying on deck, looking at the horizon, steering, drinking water'], ['Leżenie w kabinie dziobowej', 'Lying in the forepeak cabin'], ['Czytanie w mesie', 'Reading in the saloon']],
  ['both', 'safety', ['Pali się komora silnika. Co robisz?', 'The engine compartment is on fire. What do you do?'], ['Wyłączam silnik i dopływ paliwa, gaszę gaśnicą przez mały otwór, nie otwierając szeroko komory', 'Stop the engine and fuel, discharge the extinguisher through a small opening without opening the compartment wide'], ['Otwieram szeroko pokrywę, by wywietrzyć dym', 'Open the hatch wide to let the smoke out'], ['Polewam silnik wodą z wiadra', 'Pour buckets of water on the engine']],
  ['both', 'safety', ['Czujesz gaz w kabinie. Co robisz?', 'You smell gas in the cabin. What do you do?'], ['Zakręcam zawór butli, wietrzę, nie używam ognia ani przełączników elektrycznych', 'Close the cylinder valve, ventilate, avoid flames and electrical switches'], ['Zapalam światło, by znaleźć wyciek', 'Switch on the light to find the leak'], ['Uruchamiam silnik, by szybciej dopłynąć do portu', 'Start the engine to reach harbour sooner']],
  ['both', 'safety', ['Dlaczego gaz propan-butan jest szczególnie groźny na jachcie?', 'Why is propane/butane gas especially dangerous on a yacht?'], ['Jest cięższy od powietrza i zbiera się w zęzie', 'It is heavier than air and collects in the bilge'], ['Jest lżejszy od powietrza i zbiera się pod sufitem', 'It is lighter than air and collects under the deckhead'], ['Nie pali się w zamkniętych pomieszczeniach', 'It does not burn in enclosed spaces']],
  ['both', 'safety', ['Jak podchodzisz na żaglach do człowieka za burtą?', 'How do you approach a person overboard under sail?'], ['Ostatni odcinek kursem ostrym, by wytracić prędkość przy rozbitku', 'The final approach close-hauled, to lose speed alongside the casualty'], ['Z wiatrem, z dużą prędkością', 'Downwind at high speed'], ['Przepływam obok bez zatrzymywania i rzucam linę', 'Sail past without stopping and throw a line']],
  ['both', 'safety', ['Kiedy przesiadasz się do tratwy ratunkowej?', 'When do you take to the liferaft?'], ['Dopiero gdy jacht tonie lub płonie – zostaje się na nim jak najdłużej', 'Only when the yacht is sinking or on fire – stay aboard as long as possible'], ['Przy pierwszej awarii silnika', 'At the first engine failure'], ['Gdy zbliża się burza', 'When a storm is approaching']],
  ['sea', 'safety', ['Co to jest MMSI?', 'What is an MMSI?'], ['Dziewięciocyfrowy numer identyfikacyjny stacji radiowej statku (DSC, AIS)', 'A nine-digit identity number of a ship’s radio station (DSC, AIS)'], ['Numer rejestracyjny jachtu w porcie', 'The yacht’s harbour registration number'], ['Kanał łączności z kapitanatem', 'The channel used to call the harbour master']],
  ['sea', 'safety', ['Do czego służy AIS?', 'What is AIS for?'], ['Automatyczna wymiana nazwy, pozycji, kursu i prędkości statków', 'Automatic exchange of vessel names, positions, courses and speeds'], ['Pomiar głębokości pod jachtem', 'Measuring the depth under the yacht'], ['Odbiór prognoz pogody faksem', 'Receiving weather faxes']],
  ['sea', 'safety', ['Jak wysyła się alarm o niebezpieczeństwie radiotelefonem z DSC?', 'How do you send a distress alert with a DSC radio?'], ['Przytrzymuję przycisk DISTRESS ok. 5 s, potem nadaję MAYDAY głosem na kanale 16', 'Hold DISTRESS for about 5 s, then send MAYDAY by voice on channel 16'], ['Nadaję MAYDAY na kanale 70 głosem', 'Send MAYDAY by voice on channel 70'], ['Wywołuję najbliższy jacht na kanale 72', 'Call the nearest yacht on channel 72']],
  ['sea', 'safety', ['Jak często na morzu powtarza się słowo MAYDAY na początku wywołania?', 'How many times is MAYDAY said at the start of a distress call?'], ['Trzy razy', 'Three times'], ['Raz', 'Once'], ['Pięć razy', 'Five times']],
  ['both', 'safety', ['Co oznacza pomarańczowy dym?', 'What does orange smoke mean?'], ['Wzywanie pomocy w dzień', 'A distress signal by day'], ['Prośbę o pilota', 'A request for a pilot'], ['Zamiar wejścia do portu', 'Intention to enter harbour']],
  // --- dodatkowe: śródlądzie ---
  ['inland', 'inlandRules', ['Jakie światło niesie nocą statek na postoju przy brzegu?', 'What light does a vessel berthed at the bank show at night?'], ['Białe światło widoczne dookoła, od strony szlaku żeglownego', 'A white all-round light on the fairway side'], ['Światła burtowe i rufowe', 'Sidelights and a stern light'], ['Nie niesie żadnych świateł', 'No lights at all']],
  ['inland', 'inlandRules', ['Czy wolno prowadzić jacht po spożyciu alkoholu?', 'May you skipper a yacht after drinking alcohol?'], ['Nie – nie wolno prowadzić statku w stanie po użyciu alkoholu ani w stanie nietrzeźwości', 'No – you must not be in charge of a vessel under the influence of alcohol'], ['Tak, jeśli jacht płynie na żaglach', 'Yes, if the yacht is under sail'], ['Tak, na jeziorach bez ograniczeń', 'Yes, on lakes without limits']],
  ['inland', 'inlandRules', ['Jak zwykle kotwiczy się na rzece?', 'How do you usually anchor on a river?'], ['Dziobem pod prąd', 'Bow upstream (into the current)'], ['Rufą pod prąd', 'Stern upstream'], ['Burtą do prądu', 'Beam-on to the current']],
  ['inland', 'inlandRules', ['Jak najlepiej podchodzić do brzegu lub pomostu na rzece?', 'How is it best to come alongside a bank or pontoon on a river?'], ['Pod prąd – prąd hamuje jacht i ułatwia sterowanie', 'Against the current – it slows the yacht and keeps steerage'], ['Z prądem, z dużą prędkością', 'With the current, at speed'], ['Kierunek prądu nie ma znaczenia', 'The current direction does not matter']],
  ['inland', 'inlandRules', ['Dlaczego zestaw pchany jest groźny dla małego jachtu?', 'Why is a pushed convoy dangerous for a small yacht?'], ['Ma długą drogę hamowania i ograniczoną widoczność przed dziobem', 'It has a long stopping distance and limited visibility ahead'], ['Płynie zawsze środkiem szlaku pod prąd', 'It always goes up the middle against the current'], ['Nie może dawać sygnałów dźwiękowych', 'It cannot sound signals']],
  ['both', 'seaman', ['Jak ustawić mały jacht do dużej fali od przepływającego statku?', 'How should a small yacht meet a big wash from a passing ship?'], ['Dziobem lub rufą do fali, nie burtą', 'Bow or stern to the waves, not beam-on'], ['Burtą do fali', 'Beam-on to the waves'], ['Zatrzymać się i postawić żagle', 'Stop and hoist the sails']],
  ['inland', 'inlandRules', ['Statki w zestawie holowanym na drogach śródlądowych – kto steruje zestawem?', 'In an inland towed convoy, who is in charge of the convoy?'], ['Kierownik zestawu – zwykle kapitan holownika', 'The convoy master – usually the tug’s skipper'], ['Kapitan ostatniego statku w zestawie', 'The skipper of the last vessel'], ['Każdy statek steruje osobno, bez koordynacji', 'Each vessel steers on its own']],
  // --- dodatkowe: nawigacja ---
  ['sea', 'nav', ['Co to jest namiar?', 'What is a bearing?'], ['Kąt między kierunkiem północy a kierunkiem na obiekt', 'The angle from north to the direction of an object'], ['Odległość do obiektu', 'The distance to an object'], ['Kąt między dziobem a wiatrem', 'The angle between the bow and the wind']],
  ['sea', 'nav', ['Co to jest kąt kursowy?', 'What is a relative bearing?'], ['Kąt między dziobem jachtu a kierunkiem na obiekt', 'The angle between the yacht’s bow and the direction of an object'], ['Kąt między północą a dziobem', 'The angle between north and the bow'], ['Kąt znoszenia przez prąd', 'The angle of set by the current']],
  ['sea', 'nav', ['Co to jest pozycja zliczona?', 'What is a dead-reckoning position?'], ['Pozycja wyliczona z kursu, prędkości i czasu od ostatniej pewnej pozycji', 'A position worked out from course, speed and time since the last fix'], ['Pozycja z dwóch namiarów', 'A position from two bearings'], ['Pozycja odczytana z GPS', 'A position read from GPS']],
  ['sea', 'nav', ['Co to jest izobata?', 'What is a depth contour?'], ['Linia łącząca punkty o jednakowej głębokości', 'A line joining points of equal depth'], ['Linia jednakowego ciśnienia', 'A line of equal pressure'], ['Granica wód terytorialnych', 'The limit of territorial waters']],
  ['sea', 'nav', ['Ile minut kątowych ma jeden stopień?', 'How many minutes of arc are in one degree?'], ['60', '60'], ['100', '100'], ['360', '360']],
  ['sea', 'nav', ['Co mierzy log?', 'What does a log measure?'], ['Prędkość jachtu względem wody i przebytą drogę', 'The yacht’s speed through the water and distance run'], ['Głębokość pod jachtem', 'The depth under the yacht'], ['Kierunek i siłę wiatru', 'Wind direction and strength']],
  ['sea', 'nav', ['Co mierzy echosonda?', 'What does an echo sounder measure?'], ['Głębokość wody pod jachtem', 'The depth of water under the yacht'], ['Prędkość nad dnem', 'Speed over the ground'], ['Odległość do brzegu', 'Distance to the shore']],
  ['sea', 'nav', ['Jaką linią na mapie Merkatora jest kurs stały (loksodroma)?', 'How does a constant course (rhumb line) appear on a Mercator chart?'], ['Linią prostą', 'As a straight line'], ['Łukiem okręgu', 'As an arc of a circle'], ['Linią falistą', 'As a wavy line']],
  ['sea', 'nav', ['Jak zmienia się szerokość geograficzna?', 'How is latitude measured?'], ['Od 0° na równiku do 90° N lub S na biegunach', 'From 0° at the equator to 90° N or S at the poles'], ['Od 0° w Greenwich do 180° E lub W', 'From 0° at Greenwich to 180° E or W'], ['Od 0° do 360° w prawo', 'From 0° to 360° clockwise']],
  ['sea', 'nav', ['Skąd odczytasz deklinację dla danego miejsca?', 'Where do you find the variation for a place?'], ['Z róży kompasowej na mapie (wartość z roku wydania i roczna zmiana)', 'From the compass rose on the chart (value for the year and annual change)'], ['Z tabeli dewiacji jachtu', 'From the yacht’s deviation card'], ['Z logu', 'From the log']]
];

// ---------------- pula pytań ----------------
// Pozycja puli: { id, g (grupa w planie egzaminu), key (temat – bez dwóch pytań o to samo w jednym teście), make(r) → pytanie }
const P = (id, g, make, key = id) => ({ id, g, key, make });
const bankEntry = (b, i) => P(`b${i}`, b[1], (r) => { const [, topic, q, good, b1, b2, ex] = b; return mk(r, topic, tx(q), tx(good), [tx(b1), tx(b2)], ex ? { explain: tx(ex) } : {}); });

// prawo drogi – sytuacje z hierarchii prawidła 18 (morze) i przepisów śródlądowych
const SEA_TYPES = [
  ['power', ['statek o napędzie mechanicznym w drodze', 'a power-driven vessel under way'], 0], ['sail', ['jacht żaglowy', 'a sailing yacht'], 1],
  ['fish', ['statek zajęty połowem', 'a vessel engaged in fishing'], 2], ['ram', ['statek o ograniczonej zdolności manewrowania', 'a vessel restricted in her ability to manoeuvre'], 3],
  ['nuc', ['statek niezdolny do manewrowania', 'a vessel not under command'], 3]];
const INLAND_TYPES = [
  ['smotor', ['mała jednostka o napędzie mechanicznym', 'a small motor craft'], 0], ['srow', ['łódź wiosłowa', 'a rowing boat'], 1],
  ['ssail', ['mała jednostka żaglowa', 'a small sailing craft'], 2], ['big', ['barka motorowa (statek, który nie jest małą jednostką)', 'a motor barge (not a small craft)'], 3]];
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
function situations(scope) {
  const T = scope === 'inland' ? INLAND_TYPES : SEA_TYPES, out = [];
  for (const A of T) for (const B of T) {
    if (A === B || A[2] === B[2]) continue;
    const g = scope === 'inland' ? 'inlandRules' : 'rules';
    out.push(P(`sit:${scope}:${A[0]}:${B[0]}:x`, g, (r) => {
      const gw = A[2] < B[2] ? A : B, so = gw === A ? B : A;
      return mk(r, g, L(`Kursy jednostek się przecinają: ${tx(A[1])} i ${tx(B[1])}. Kto ustępuje drogi?`, `Their courses cross: ${tx(A[1])} and ${tx(B[1])}. Who gives way?`),
        cap(tx(gw[1])), [cap(tx(so[1])), L('Obie jednostki zmieniają kurs w prawo', 'Both alter course to starboard')],
        { explain: scope === 'inland' ? L('Na drogach śródlądowych małe jednostki ustępują pozostałym statkom; spośród małych – motorowe ustępują wszystkim, wiosłowe – żaglowym.', 'On inland waterways small craft give way to all other vessels; among small craft motor craft give way to all, rowing boats to sailing craft.') : L('Prawidło 18: statek o napędzie mechanicznym ustępuje żaglowcowi, żaglowiec – statkowi zajętemu połowem, a ten – statkom niezdolnym do manewrowania i o ograniczonej zdolności manewrowania.', 'Rule 18: power gives way to sail, sail to vessels fishing, and these to NUC and RAM vessels.') });
    }, `sit:${scope}:${[A[0], B[0]].sort().join(':')}`));
    if (scope === 'sea' && A[0] !== 'nuc' && A[0] !== 'ram') out.push(P(`sit:sea:${A[0]}:${B[0]}:o`, 'rules', (r) => mk(r, 'rules',
      L(`${cap(tx(A[1]))} wyprzedza ${tx(B[1])}. Kto ustępuje drogi?`, `${cap(tx(A[1]))} is overtaking ${tx(B[1])}. Who gives way?`),
      L(`${cap(tx(A[1]))} – statek wyprzedzający`, `${cap(tx(A[1]))} – the overtaking vessel`), [L(`${cap(tx(B[1]))} – statek wyprzedzany`, `${cap(tx(B[1]))} – the vessel being overtaken`), L('Ten, który jest niżej w hierarchii prawidła 18', 'Whichever is lower in the Rule 18 hierarchy')],
      { explain: L('Prawidło 13: statek wyprzedzający zawsze ustępuje drogi – niezależnie od rodzaju statków.', 'Rule 13: the overtaking vessel always keeps clear, whatever the types of vessel.') }), `sit:sea:${[A[0], B[0]].sort().join(':')}`));
  }
  return out;
}

// charakterystyki świateł: opis zapisu i znak po świetle
const COLN = { '': ['białe', 'white'], R: ['czerwone', 'red'], G: ['zielone', 'green'], Y: ['żółte', 'yellow'] };
const KIND = {
  Fl: [['błyskowe', 'flashing'], ['błysk', 'flash'], ['błyski', 'flashes']], LFl: [['długobłyskowe', 'long-flashing'], ['długi błysk', 'long flash'], ['długie błyski', 'long flashes']],
  Oc: [['przerywane (świecenie dłuższe niż przerwy)', 'occulting (light longer than dark)'], ['przerwa', 'eclipse'], ['przerwy', 'eclipses']], Iso: [['izofazowe (równe okresy świecenia i ciemności)', 'isophase (equal light and dark)']]
};
function charDesc(k, n, c, T) {
  const col = tx(COLN[c]);
  if (k === 'Iso') return L(`${cap(col)}, izofazowe, okres ${T} s`, `${cap(col)}, isophase, period ${T} s`);
  const [name, one, many] = KIND[k];
  return n > 1 ? L(`${cap(col)}, ${tx(name).split(' ')[0]} – grupy po ${n} ${tx(many)}, okres ${T} s`, `${cap(col)}, ${tx(name).split(' ')[0]} – groups of ${n} ${tx(many)}, period ${T} s`)
    : L(`${cap(col)}, ${tx(name).split(' ')[0]} – pojedyncze ${tx(many)}, okres ${T} s`, `${cap(col)}, ${tx(name).split(' ')[0]} – single ${tx(many)}, period ${T} s`);
}
function lightChars() {
  const out = [], code = (k, n, c, T) => `${k}${n > 1 ? `(${n})` : ''}${c ? ' ' + c : ''} ${T}s`;
  const sets = [['Fl', [1, 2, 3, 4], [3, 4, 5, 6, 10, 12, 15]], ['Oc', [1, 2, 3], [4, 6, 8, 10, 12]], ['LFl', [1, 2], [6, 8, 10, 12]], ['Iso', [1], [2, 4, 6, 8]]];
  for (const [k, ns, Ts] of sets) for (const n of ns) for (const c of ['', 'R', 'G', 'Y']) for (const T of Ts) {
    if (n * 1.5 >= T && k !== 'Iso') continue; // grupa musi się zmieścić w okresie
    out.push(P(`lc:${code(k, n, c, T)}`, 'mark', (r) => {
      const good = charDesc(k, n, c, T);
      const altK = k === 'Fl' ? 'Oc' : k === 'Oc' ? 'Fl' : k === 'LFl' ? 'Fl' : 'Oc';
      const altC = pick(r, ['', 'R', 'G', 'Y'].filter((x) => x !== c));
      const bad = [charDesc(altK, altK === 'Iso' ? 1 : Math.max(1, n), c, T), r() < 0.5 ? charDesc(k, n, altC, T) : charDesc(k, k === 'Iso' ? 1 : n === 1 ? 2 : n - 1, c, T === Ts[0] ? Ts[1] : Ts[0])];
      return mk(r, 'marks', L(`Co oznacza charakterystyka światła „${code(k, n, c, T)}”?`, `What does the light characteristic “${code(k, n, c, T)}” mean?`), good, bad,
        { explain: L('Fl – błysk krótszy od przerwy, LFl – błysk co najmniej 2 s, Oc – przerwy krótsze od świecenia, Iso – równe okresy; brak litery koloru oznacza światło białe; liczba w nawiasie to liczba błysków w grupie, na końcu okres całej sekwencji.', 'Fl – flash shorter than dark, LFl – flash of at least 2 s, Oc – eclipses shorter than light, Iso – equal periods; no colour letter means white; the number in brackets is the group, the last figure the period.') });
    }));
  }
  // jaki znak ma takie światło
  const MARK_LIGHTS = [['VQ', ['Znak kardynalny północny', 'North cardinal mark']], ['Q', ['Znak kardynalny północny', 'North cardinal mark']], ['VQ(3) 5s', ['Znak kardynalny wschodni', 'East cardinal mark']], ['Q(3) 10s', ['Znak kardynalny wschodni', 'East cardinal mark']],
    ['VQ(6)+LFl 10s', ['Znak kardynalny południowy', 'South cardinal mark']], ['Q(6)+LFl 15s', ['Znak kardynalny południowy', 'South cardinal mark']], ['VQ(9) 10s', ['Znak kardynalny zachodni', 'West cardinal mark']], ['Q(9) 15s', ['Znak kardynalny zachodni', 'West cardinal mark']],
    ['Fl(2) 5s', ['Znak odosobnionego niebezpieczeństwa', 'Isolated danger mark']], ['Fl(2) 10s', ['Znak odosobnionego niebezpieczeństwa', 'Isolated danger mark']], ['LFl 10s', ['Znak wody bezpiecznej', 'Safe water mark']], ['Iso 4s', ['Znak wody bezpiecznej', 'Safe water mark']], ['Mo(A) 6s', ['Znak wody bezpiecznej', 'Safe water mark']], ['Oc 6s', ['Znak wody bezpiecznej', 'Safe water mark']],
    ['Fl Y 5s', ['Znak specjalny', 'Special mark']], ['Al.Bu.Y 3s', ['Znak nowego niebezpieczeństwa (wrak)', 'Emergency wreck marking buoy']], ['Fl(2+1) R 10s', ['Znak rozwidlenia toru (zmodyfikowany znak boczny)', 'Preferred channel mark']], ['Fl R 4s', ['Znak boczny lewy (IALA A)', 'Port-hand lateral mark (IALA A)']], ['Fl G 4s', ['Znak boczny prawy (IALA A)', 'Starboard-hand lateral mark (IALA A)']]];
  const names = [...new Set(MARK_LIGHTS.map((m) => m[1][0]))].map((pl) => MARK_LIGHTS.find((m) => m[1][0] === pl)[1]);
  for (const [c, n] of MARK_LIGHTS) out.push(P(`ml:${c}`, 'mark', (r) => mk(r, 'marks', L(`Który znak nawigacyjny może mieć światło „${c}”?`, `Which navigation mark may show the light “${c}”?`), tx(n), shuffle(r, names.filter((x) => x[0] !== n[0])).slice(0, 2).map(tx))));
  return out;
}

// obliczenia nawigacyjne – parametry z ziarna (każde ziarno = inne pytanie)
const n360 = (a) => ((Math.round(a) % 360) + 360) % 360, d3 = (a) => `${String(n360(a)).padStart(3, '0')}°`;
const sg = (a) => `${a > 0 ? '+' : a < 0 ? '−' : ''}${String(Math.abs(a)).replace('.', L(',', '.'))}°`;
const nm = (x, dec = 2) => `${String(Math.round(x * 10 ** dec) / 10 ** dec).replace('.', L(',', '.'))}`;
function calcs() {
  const out = [];
  const par = (seed) => { const r = rng(seed); return { KK: Math.round(r() * 71) * 5 + Math.round(r() * 4), dev: Math.round(r() * 8) - 4 || 2, dec: (Math.round(r() * 12) - 6) / 2 || -1.5 }; };
  for (let i = 0; i < 220; i++) out.push(P(`kr${i}`, 'calc', (r) => { const { KK, dev, dec } = par(1000 + i), KR = KK + dev + dec;
    return mk(r, 'nav', L(`KK = ${d3(KK)}, dewiacja δ = ${sg(dev)}, deklinacja d = ${sg(dec)}. Ile wynosi kurs rzeczywisty KR?`, `CC = ${d3(KK)}, deviation δ = ${sg(dev)}, variation d = ${sg(dec)}. What is the true course TC?`),
      d3(KR), [d3(KK - dev - dec), d3(KK + dev - dec), d3(KK - dev + dec), d3(KR + 5), d3(KR - 5)], { explain: `KR = KK + δ + d = ${d3(KK)} ${sg(dev)} ${sg(dec)} = ${d3(KR)}` }); }));
  for (let i = 0; i < 220; i++) out.push(P(`kk${i}`, 'calc', (r) => { const { KK: KR, dev, dec } = par(5000 + i), KK = KR - dev - dec;
    return mk(r, 'nav', L(`Chcesz płynąć kursem rzeczywistym KR = ${d3(KR)}. Deklinacja d = ${sg(dec)}, dewiacja δ = ${sg(dev)}. Jakim kursem kompasowym KK sterujesz?`, `You want to make a true course TC = ${d3(KR)}. Variation d = ${sg(dec)}, deviation δ = ${sg(dev)}. Which compass course CC do you steer?`),
      d3(KK), [d3(KR + dev + dec), d3(KR - dev + dec), d3(KR + dev - dec), d3(KK + 5), d3(KK - 5)], { explain: `KK = KR − d − δ = ${d3(KK)}` }); }));
  for (let i = 0; i < 80; i++) out.push(P(`km${i}`, 'calc', (r) => { const { KK, dev } = par(9000 + i), KM = KK + dev;
    return mk(r, 'nav', L(`Kurs kompasowy KK = ${d3(KK)}, dewiacja δ = ${sg(dev)}. Ile wynosi kurs magnetyczny KM?`, `Compass course CC = ${d3(KK)}, deviation δ = ${sg(dev)}. What is the magnetic course MC?`), d3(KM), [d3(KK - dev), d3(KM + 10), d3(KM - 10)], { explain: `KM = KK + δ = ${d3(KM)}` }); }));
  for (let i = 0; i < 120; i++) out.push(P(`nr${i}`, 'calc', (r) => { const { KK: NK, dev, dec } = par(13000 + i), NR = NK + dev + dec;
    return mk(r, 'nav', L(`Namiar kompasowy NK = ${d3(NK)}, poprawka całkowita p = ${sg(dev + dec)}. Ile wynosi namiar rzeczywisty NR?`, `Compass bearing = ${d3(NK)}, total correction = ${sg(dev + dec)}. What is the true bearing?`), d3(NR), [d3(NK - dev - dec), d3(NR + 180), d3(NR + 10)], { explain: `NR = NK + p = ${d3(NR)}` }); }));
  const V = [3, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8], T = [10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 48, 50, 54, 72, 75, 90, 105, 120];
  let k = 0;
  for (const v of V) for (const t of T) {
    const s = (v * t) / 60, id = k++;
    if (Math.abs(s * 100 - Math.round(s * 100)) > 1e-9) continue;
    const f = (x) => `${nm(x)} Mm`, fv = (x) => `${nm(x, 1)} kn`, ft = (x) => `${Math.round(x)} min`;
    const form = id % 3;
    out.push(P(`ts${v}:${t}`, 'calc', (r) => form === 0
      ? mk(r, 'nav', L(`Jacht płynie z prędkością ${nm(v, 1)} kn. Jaką drogę przepłynie w ${t} minut?`, `A yacht makes ${nm(v, 1)} kn. How far does it go in ${t} minutes?`), f(s), [f(s * 1.5), f(s / 2)], { explain: `s = v · t = ${nm(v, 1)} · ${t}/60 = ${f(s)}` })
      : form === 1 ? mk(r, 'nav', L(`Jacht przepłynął ${nm(s)} Mm w ${t} minut. Jaka była jego prędkość?`, `A yacht covered ${nm(s)} NM in ${t} minutes. What was its speed?`), fv(v), [fv(v * 1.5), fv(v / 2)], { explain: `v = s / t = ${nm(s)} / (${t}/60) = ${fv(v)}` })
        : mk(r, 'nav', L(`Ile czasu zajmie przepłynięcie ${nm(s)} Mm z prędkością ${nm(v, 1)} kn?`, `How long does it take to cover ${nm(s)} NM at ${nm(v, 1)} kn?`), ft(t), [ft(t * 1.5), ft(t / 2)], { explain: `t = s / v = ${nm(s)} / ${nm(v, 1)} h = ${ft(t)}` })));
  }
  for (const hh of [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144]) for (const H of [1, 2.25, 4, 6.25]) out.push(P(`rg${hh}:${H}`, 'calc', (r) => {
    const D = 2.08 * (Math.sqrt(hh) + Math.sqrt(H));
    return mk(r, 'nav', L(`Światło latarni jest ${hh} m nad wodą, oko obserwatora ${nm(H)} m. Jaki jest zasięg geograficzny światła? (Dg = 2,08·(√h + √H))`, `A light is ${hh} m above the water, the observer’s eye ${nm(H)} m. What is its geographic range? (Dg = 2.08·(√h + √H))`),
      `${nm(D, 1)} Mm`, [`${nm(2.08 * Math.sqrt(hh), 1)} Mm`, `${nm(D * 1.6, 1)} Mm`], { explain: `Dg = 2,08 · (${Math.sqrt(hh)} + ${nm(Math.sqrt(H))}) = ${nm(D, 1)} Mm` });
  }));
  for (const kn of [2, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40]) out.push(P(`un${kn}`, 'calc', (r) => mk(r, 'nav', L(`Ile to jest ${kn} węzłów w km/h?`, `How much is ${kn} knots in km/h?`), `${nm(kn * 1.852, 1)} km/h`, [`${nm(kn * 1.609, 1)} km/h`, `${nm(kn, 1)} km/h`], { explain: '1 kn = 1,852 km/h' })));
  for (const m of [1, 2, 3, 5, 8, 10, 15, 20]) out.push(P(`um${m}`, 'calc', (r) => mk(r, 'nav', L(`Ile kilometrów ma ${m} Mm?`, `How many kilometres are ${m} NM?`), `${nm(m * 1.852, 3)} km`, [`${nm(m * 1.609, 3)} km`, `${m} km`], { explain: '1 Mm = 1852 m' })));
  return out;
}


// opis świateł widocznych z danego kierunku: kolumny „czerwone nad białym”, pojedyncze z nazwą sektora
const LN = { white: ['białe', 'białym', 'white'], red: ['czerwone', 'czerwonym', 'red'], green: ['zielone', 'zielonym', 'green'], yellow: ['żółte', 'żółtym', 'yellow'], blue: ['niebieskie', 'niebieskim', 'blue'] };
const SN = { mast: ['masztowe', 'masthead'], port: ['burtowe', 'sidelight'], stbd: ['burtowe', 'sidelight'], stern: ['rufowe', 'stern light'], tow: ['holownicze', 'towing light'], all: ['dookólne', 'all-round'] };
function describeLights(lights, rel) {
  const vis = visibleLights(lights, rel), deck = vis.some((l) => l.c === 'deck');
  const cols = new Map();
  for (const l of vis) { if (l.c === 'deck') continue; const k = `${Math.round(l.x * 2)}:${Math.round(l.z * 2)}`; if (!cols.has(k)) cols.set(k, []); cols.get(k).push(l); }
  const parts = [];
  for (const g of cols.values()) {
    g.sort((a, b) => b.y - a.y);
    const same = g.every((l) => l.s === g[0].s);
    if (g.length > 1 && same && g[0].s === 'all') parts.push(L(`${g.map((l, i) => (i ? LN[l.c][1] : LN[l.c][0])).join(' nad ')} (${g.length > 2 ? 'dookólne w pionie' : 'dookólne'})`, `${g.map((l) => LN[l.c][2]).join(' over ')} (all-round)`));
    else if (g.length > 1 && same) parts.push(L(`${g.length} × ${LN[g[0].c][0]} ${SN[g[0].s][0]} w pionie`, `${g.length} × ${LN[g[0].c][2]} ${SN[g[0].s][1]}s in a vertical line`));
    else for (const l of g) parts.push(L(`${LN[l.c][0]} ${SN[l.s][0]}`, `${LN[l.c][2]} ${SN[l.s][1]}`));
  }
  const cnt = new Map();
  for (const p of parts) cnt.set(p, (cnt.get(p) || 0) + 1);
  const out = [...cnt].map(([p, n]) => (n > 1 ? `${n} × ${p}` : p)).sort();
  if (deck) out.push(L('oświetlony pokład', 'deck lights'));
  return out.length ? cap(out.join(', ')) : L('Nie widać żadnych świateł', 'No lights visible');
}
const ASPECTS = [['bow', 0, ['od dziobu', 'from ahead']], ['stern', 180, ['od rufy', 'from astern']], ['port', -60, ['od lewej burty', 'from the port side']], ['stbd', 60, ['od prawej burty', 'from the starboard side']]];

// marks: rysunki znaków z warstwy UI – [{ scope, name, svg, look }]
export function buildPool(scope, marks = []) {
  const inScope = (s) => s === 'both' || s === scope;
  const out = [];
  BANK.forEach((b, i) => { if (inScope(b[0])) out.push(bankEntry(b, i)); });
  out.push(...situations(scope));
  // jednostki: model 3D → nazwa, nazwa → opis świateł / znaków
  for (const day of [false, true]) {
    const list = (day ? DAY_VESSELS : VESSELS).filter((v) => (scope === 'inland' ? v.inland : !v.inland));
    const g = day ? 'day' : 'lights';
    for (const v of list) {
      out.push(P(`v3:${v.id}`, g, (r) => mk(r, g, day ? L('Jaki statek nosi takie znaki dzienne?', 'Which vessel shows these day shapes?') : L('Jaki statek pokazuje takie światła nocą?', 'Which vessel shows these lights at night?'),
        tt(v.name), others(r, list, v, (x) => x.name).map((x) => tt(x.name)), { explain: tt(v.explain), media: { kind: day ? 'day' : 'lights', id: v.id } }), v.id));
      out.push(P(`vx:${v.id}`, g, (r) => mk(r, g, day ? L(`Jakie znaki dzienne nosi: ${tt(v.name)}?`, `What day shapes does this vessel show: ${tt(v.name)}?`) : L(`Jakie światła niesie nocą: ${tt(v.name)}?`, `What lights does this vessel show at night: ${tt(v.name)}?`),
        tt(v.explain), others(r, list, v, (x) => x.explain).map((x) => tt(x.explain))), v.id));
    }
  }

  // co widać z danego kierunku (statki w drodze)
  {
    const list = VESSELS.filter((v) => (scope === 'inland' ? v.inland : !v.inland) && v.moving);
    const lightsOf = (v) => v.lights((v.L[0] + v.L[1]) / 2, () => 0.5, { gearSide: 'starboard' });
    for (const v of list) for (const [ak, rel, an] of ASPECTS) {
      const good = describeLights(lightsOf(v), rel);
      out.push(P(`va:${v.id}:${ak}`, 'lights', (r) => {
        const alts = [...new Set([...ASPECTS.map((a) => describeLights(lightsOf(v), a[1])), ...shuffle(r, list).map((x) => describeLights(lightsOf(x), rel))])].filter((x) => x !== good);
        const bad = shuffle(r, alts.slice(0, 3)).slice(0, 2);
        return mk(r, 'lights', L(`Nocą widzisz ${tx(an)}: ${tt(v.name)}. Jakie światła widzisz?`, `At night you see ${tx(an)}: ${tt(v.name)}. Which lights do you see?`), good, bad, { explain: tt(v.explain) });
      }, v.id));
    }
  }
  // sygnały dźwiękowe: zapis → znaczenie, znaczenie → zapis
  const sigs = SIGNALS.filter((s) => (scope === 'inland' ? s.ctx === 'inland' : s.ctx !== 'inland'));
  const ctxQ = (s) => (s.ctx === 'fog' ? L(' (ograniczona widzialność)', ' (restricted visibility)') : '');
  for (const s of sigs) {
    const same = sigs.filter((x) => x.ctx === s.ctx && x.p !== s.p);
    out.push(P(`sn:${s.id}`, 'sound', (r) => mk(r, 'sounds', L(`Co oznacza ten sygnał dźwiękowy${ctxQ(s)}?`, `What does this sound signal mean${ctxQ(s)}?`), tt(s.name), others(r, same, s, (x) => x.name).map((x) => tt(x.name)), { explain: tt(s.desc), media: { kind: 'sound', p: s.p } }), s.id));
    out.push(P(`sp:${s.id}`, 'sound', (r) => mk(r, 'sounds', L(`Jakim sygnałem dźwiękowym statek informuje: „${tt(s.name)}”${ctxQ(s)}?`, `Which sound signal means “${tt(s.name)}”${ctxQ(s)}?`), notation(s.p), others(r, same, s, (x) => x.p).map((x) => notation(x.p)), { explain: `${tt(s.desc)} (• ${L('krótki', 'short')}, — ${L('długi', 'long')})` }), s.id));
  }
  if (scope === 'sea') {
    for (const s of CHART_SYMBOLS) {
      const grp = CHART_SYMBOLS.filter((x) => x.grp === s.grp && x !== s), pool = grp.length >= 2 ? grp : CHART_SYMBOLS.filter((x) => x !== s);
      out.push(P(`cs:${s.id}`, 'chart', (r) => mk(r, 'chart', L('Co oznacza ten symbol na mapie morskiej?', 'What does this chart symbol mean?'), s.name(), shuffle(r, pool).slice(0, 2).map((x) => x.name()), { explain: s.mean(), media: { kind: 'svg', svg: symbolSVG(s, 240, 165) } }), s.id));
      out.push(P(`cm:${s.id}`, 'chart', (r) => mk(r, 'chart', L(`Co oznacza na mapie: ${s.name()}?`, `What does this chart feature mean: ${s.name()}?`), s.mean(), shuffle(r, pool).slice(0, 2).map((x) => x.mean()), { media: { kind: 'svg', svg: symbolSVG(s, 240, 165) } }), s.id));
    }
    out.push(...lightChars());
    out.push(...calcs());
    for (const k of ['N', 'E', 'S', 'W']) out.push(P(`mr:${k}`, 'mark', (r) => markRule(r, k)));
  } else {
    for (const gr of SIGN_GROUPS) for (const [code, pl, en] of gr.signs) {
      out.push(P(`sg:${code}`, 'sign', (r) => mk(r, 'signs', L('Co oznacza ten znak żeglugowy?', 'What does this waterway sign mean?'), L(pl, en), shuffle(r, gr.signs.filter((x) => x[0] !== code && x[1] !== pl)).slice(0, 2).map((x) => L(x[1], x[2])), { explain: `${code}: ${L(pl, en)}`, media: { kind: 'img', src: signImage(code) } }), code));
      out.push(P(`sk:${code}`, 'sign', (r) => mk(r, 'signs', L('Do której grupy znaków żeglugowych należy ten znak?', 'Which group of waterway signs does this sign belong to?'), L(gr.pl, gr.en), shuffle(r, SIGN_GROUPS.filter((x) => x !== gr)).slice(0, 2).map((x) => L(x.pl, x.en)), { explain: `${code}: ${L(pl, en)}`, media: { kind: 'img', src: signImage(code) } }), code));
    }
  }
  // znaki nawigacyjne z rysunkami
  const mks = marks.filter((m) => m.scope === scope);
  for (const m of mks) {
    out.push(P(`mk:${m.name}`, 'mark', (r) => mk(r, 'marks', L('Jaki to znak nawigacyjny?', 'What is this navigation mark?'), m.name, others(r, mks, m, (x) => x.name).map((x) => x.name), { explain: m.look || '', media: { kind: 'svg', svg: m.svg } }), m.name));
    if (m.look) out.push(P(`ml2:${m.name}`, 'mark', (r) => mk(r, 'marks', L(`Jak wygląda: ${m.name}?`, `What does it look like: ${m.name}?`), m.look, others(r, mks.filter((x) => x.look), m, (x) => x.look).map((x) => x.look)), m.name));
  }
  // meteorologia
  for (let f = 0; f <= 12; f++) {
    const b = beaufort(f), near = [f - 2, f - 1, f + 1, f + 2].filter((x) => x >= 0 && x <= 12);
    const nb = (r) => shuffle(r, near).slice(0, 2).map(beaufort);
    out.push(P(`bk${f}`, 'meteo', (r) => mk(r, 'meteo', L(`Jaka prędkość wiatru odpowiada sile ${f}°B?`, `What wind speed corresponds to Beaufort force ${f}?`), `${b.knText} kn`, nb(r).map((x) => `${x.knText} kn`), { explain: `${f}°B – ${b.name}: ${b.knText} kn.` }), `bft${f}`));
    out.push(P(`bs${f}`, 'meteo', (r) => mk(r, 'meteo', L(`Stan morza: „${b.seaText}” Jaka to siła wiatru?`, `Sea state: “${b.seaText}” What is the wind force?`), `${f}°B – ${b.name}`, nb(r).map((x) => `${x.f}°B – ${x.name}`), { explain: `${f}°B – ${b.name} (${b.knText} kn).` }), `bft${f}`));
    out.push(P(`bn${f}`, 'meteo', (r) => mk(r, 'meteo', L(`Jak nazywa się wiatr o sile ${f}°B?`, `What is Beaufort force ${f} called?`), b.name, nb(r).map((x) => x.name)), `bft${f}`));
    out.push(P(`bm${f}`, 'meteo', (r) => mk(r, 'meteo', L(`Ile metrów na sekundę to wiatr o sile ${f}°B?`, `How many metres per second is Beaufort force ${f}?`), `${b.msText} m/s`, nb(r).map((x) => `${x.msText} m/s`)), `bft${f}`));
    if (f >= 3 && f <= 10) out.push(P(`by${f}`, 'meteo', (r) => mk(r, 'meteo', L(`Co oznacza dla jachtu wiatr ${f}°B (${b.name})?`, `What does Beaufort ${f} (${b.name}) mean for a yacht?`), b.yacht, shuffle(r, [...nb(r), ...[2, 4, 6, 8, 11].map(beaufort)]).map((x) => x.yacht)), `bft${f}`));
    if (f >= 2 && f <= 11) out.push(P(`bh${f}`, 'meteo', (r) => mk(r, 'meteo', L(`Jaka jest prawdopodobna wysokość fali na otwartym morzu przy wietrze ${f}°B?`, `What is the probable wave height in the open sea at Beaufort ${f}?`), `${nm(b.h, 1)} m`, nb(r).filter((x) => x.h !== b.h).map((x) => `${nm(x.h, 1)} m`).concat([`${nm(b.h * 3, 1)} m`]).slice(0, 2)), `bft${f}`));
  }
  const cl = clouds(), lv = [...new Set(cl.map((x) => x.levelText))];
  for (const c of cl) {
    out.push(P(`cl:${c.id}`, 'meteo', (r) => mk(r, 'meteo', L(`Jakie to chmury? ${c.look}`, `Which clouds are these? ${c.look}`), `${c.name} (${c.id})`, others(r, cl, c, (x) => x.id).map((x) => `${x.name} (${x.id})`), { explain: c.weather }), c.id));
    out.push(P(`cv:${c.id}`, 'meteo', (r) => mk(r, 'meteo', L(`Do którego piętra należą chmury „${c.name}” (${c.id})?`, `Which level do ${c.name} (${c.id}) clouds belong to?`), c.levelText, shuffle(r, lv.filter((x) => x !== c.levelText)).slice(0, 2)), c.id));
    out.push(P(`cw:${c.id}`, 'meteo', (r) => mk(r, 'meteo', L(`Co zapowiadają chmury „${c.name}” (${c.id})?`, `What do ${c.name} (${c.id}) clouds indicate?`), c.weather, others(r, cl.filter((x) => x.weather !== c.weather), c, (x) => x.weather).map((x) => x.weather)), c.id));
    out.push(P(`cn:${c.id}`, 'meteo', (r) => mk(r, 'meteo', L(`Jaki jest skrót i łacińska nazwa chmur „${c.name}”?`, `What is the abbreviation for ${c.name} clouds?`), `${c.id} – ${c.latin}`, others(r, cl, c, (x) => x.id).map((x) => `${x.id} – ${x.latin}`)), c.id));
  }
  // zjawiska: różne warianty pytań (ziarno → treść)
  const seenPh = new Set();
  for (let i = 0; i < PHEN_COUNT; i++) for (let sd = 0; sd < 160; sd++) {
    const q = makePhenQuestion(7919 * i + sd, i);
    if (seenPh.has(q.prompt)) continue;
    seenPh.add(q.prompt);
    out.push(P(`ph${i}:${sd}`, 'meteo', (r) => { const good = q.options.find((o) => o.id === q.answer); return mk(r, 'meteo', q.prompt, good.label, shuffle(r, q.options.filter((o) => o.id !== q.answer)).slice(0, 2).map((o) => o.label), { explain: q.explain }); }, `ph${i}`));
  }
  // bezpieczeństwo: kanały VHF, urządzenia
  const ch = channels().filter((c) => !c.guard);
  for (const c of ch) {
    out.push(P(`vu${c.ch}`, 'safety', (r) => mk(r, 'safety', L(`Do czego służy kanał ${c.ch} VHF?`, `What is VHF channel ${c.ch} used for?`), c.use, shuffle(r, ch.filter((x) => x.use !== c.use)).slice(0, 2).map((x) => x.use), { explain: `${c.ch} (${c.f} MHz): ${c.use}` }), `ch${c.ch}`));
    out.push(P(`vc${c.ch}`, 'safety', (r) => mk(r, 'safety', L(`Który kanał VHF: ${c.use}?`, `Which VHF channel: ${c.use}?`), `${L('Kanał', 'Channel')} ${c.ch}`, shuffle(r, ch.filter((x) => x.use !== c.use)).slice(0, 2).map((x) => `${L('Kanał', 'Channel')} ${x.ch}`)), `ch${c.ch}`));
  }
  const DEV = ['epirb', 'sart', 'vhf', 'raft', 'jacket', 'harness', 'extinguisher', 'flares', 'firstaid'];
  for (const id of DEV) {
    const d = deviceInfo(id), first = (txt) => txt.split(/(?<=\.)\s/)[0];
    const bad = (r) => shuffle(r, DEV.filter((x) => x !== id)).slice(0, 2).map((x) => deviceInfo(x).name);
    out.push(P(`dv:${id}`, 'safety', (r) => mk(r, 'safety', L(`Które wyposażenie opisuje zdanie: „${first(d.short)}”`, `Which equipment is described: “${first(d.short)}”`), d.name, bad(r), { explain: d.short }), id));
    (d.sections || []).forEach(([title, txt], k) => out.push(P(`ds:${id}:${k}`, 'safety', (r) => mk(r, 'safety', L(`${title} – którego wyposażenia dotyczy informacja: „${first(txt)}”`, `${title} – which equipment does this refer to: “${first(txt)}”`), d.name, bad(r), { explain: txt }), id)));
  }
  return out;
}
function markRule(r, k) {
  const nm2 = { N: L('północny', 'north'), E: L('wschodni', 'east'), S: L('południowy', 'south'), W: L('zachodni', 'west') };
  const side = { N: L('Od północy', 'To the north of it'), E: L('Od wschodu', 'To the east of it'), S: L('Od południa', 'To the south of it'), W: L('Od zachodu', 'To the west of it') };
  const opp = { N: 'S', S: 'N', E: 'W', W: 'E' }[k], third = pick(r, Object.keys(side).filter((x) => x !== k && x !== opp));
  return mk(r, 'marks', L(`Z której strony mijasz znak kardynalny ${nm2[k]}?`, `On which side do you pass a ${nm2[k]} cardinal mark?`), side[k], [side[opp], side[third]], { explain: L('Znak kardynalny nazywa stronę, po której jest bezpieczna woda.', 'A cardinal mark is named after the side where the safe water is.') });
}

// Skład egzaminu: liczba pytań z każdej grupy (razem 75)
const PLAN = {
  sea: [['rules', 12], ['seaman', 9], ['nav', 2], ['calc', 3], ['safety', 10], ['lights', 9], ['day', 5], ['sound', 7], ['mark', 7], ['chart', 4], ['meteo', 7]],
  inland: [['inlandRules', 14], ['rules', 3], ['seaman', 10], ['safety', 9], ['lights', 7], ['day', 5], ['sound', 7], ['sign', 10], ['mark', 3], ['meteo', 7]]
};

// history: { id: numer egzaminu, w którym pytanie było ostatnio } – najpierw pytania dawno niewidziane lub nowe
export function makeExam(r, scope, marks = [], history = {}) {
  const pool = buildPool(scope, marks);
  const byG = {};
  for (const e of pool) (byG[e.g] = byG[e.g] || []).push(e);
  const keys = new Set(), chosen = [];
  const take = (list, n) => {
    const order = list.map((e) => [history[e.id] ?? -1, r(), e]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
    let k = 0;
    for (const e of order) { if (k >= n) break; if (keys.has(e.key)) continue; keys.add(e.key); chosen.push(e); k++; }
    return k;
  };
  let missing = 0;
  for (const [g, n] of PLAN[scope]) missing += n - take(byG[g] || [], n);
  if (missing > 0) take(pool.filter((e) => !chosen.includes(e)), missing);
  return shuffle(r, chosen).slice(0, EXAM.questions).map((e) => ({ id: e.id, ...e.make(r) }));
}
export const poolSize = (scope, marks = []) => buildPool(scope, marks).length;
