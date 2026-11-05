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
const others = (r, pool, good, key = (x) => x) => shuffle(r, pool.filter((x) => key(x) !== key(good))).filter((x, i, a) => a.findIndex((y) => key(y) === key(x)) === i);

// ---------------- bank pytań pisanych ręcznie ----------------
// [zakres: 'sea' | 'inland' | 'both', temat, pytanie [pl, en], poprawna [pl, en], błędna, błędna, wyjaśnienie?]
const BANK = [
  ["sea", "rules", ["Dwa jachty żaglowe mają wiatr z różnych burt. Który ustępuje drogi?", "Two sailing yachts have the wind on different sides. Which gives way?"], ["Ten z wiatrem z lewej burty", "The one on port tack"], ["Ten z wiatrem z prawej burty", "The one on starboard tack"], ["Ten na nawietrznej", "The windward one"]],
  ["sea", "rules", ["Dwa jachty żaglowe mają wiatr z tej samej burty. Który ustępuje drogi?", "Two sailing yachts have the wind on the same side. Which gives way?"], ["Nawietrzny", "The windward one"], ["Zawietrzny", "The leeward one"], ["Ten, który ma drugi po prawej burcie", "The one with the other to starboard"]],
  ["sea", "rules", ["Jacht na lewym halsie widzi jacht na nawietrznej, ale nie wie, z której burty tamten ma wiatr. Co robi?", "A port-tack yacht sees a yacht to windward but cannot tell her tack. What does she do?"], ["Ustępuje drogi", "Keeps out of the way"], ["Utrzymuje kurs i prędkość", "Holds course and speed"], ["Daje 5 krótkich i utrzymuje kurs", "Sounds 5 short and holds course"]],
  ["sea", "rules", ["Jacht żaglowy dogania od rufy statek o napędzie mechanicznym. Kto ustępuje drogi?", "A sailing yacht is overtaking a power-driven vessel. Who gives way?"], ["Jacht żaglowy", "The sailing yacht"], ["Statek o napędzie mechanicznym", "The power-driven vessel"], ["Ten, który ma drugi po prawej burcie", "The one with the other to starboard"]],
  ["sea", "rules", ["Dwa statki o napędzie mechanicznym idą kursami przeciwnymi. Co robią?", "Two power-driven vessels meet head-on. What do they do?"], ["Oba zmieniają kurs w prawo", "Both alter to starboard"], ["Oba zmieniają kurs w lewo", "Both alter to port"], ["Jeden w prawo, drugi utrzymuje kurs", "One alters to starboard, the other stands on"]],
  ["sea", "rules", ["Kursy dwóch statków o napędzie mechanicznym przecinają się. Który ustępuje?", "Two power-driven vessels are crossing. Which gives way?"], ["Ten, który ma drugiego po prawej burcie", "The one with the other to starboard"], ["Ten, który ma drugi po lewej burcie", "The one with the other to port"], ["Mniejszy", "The smaller one"]],
  ["sea", "rules", ["Jacht żaglowy spotyka statek zajęty połowem. Kto ustępuje drogi?", "A sailing yacht meets a vessel engaged in fishing. Who gives way?"], ["Jacht żaglowy", "The sailing yacht"], ["Statek rybacki", "The fishing vessel"], ["Ten, który ma drugi po prawej burcie", "The one with the other to starboard"]],
  ["sea", "rules", ["Statek o napędzie mechanicznym ma jacht żaglowy po swojej lewej burcie na kursie kolizyjnym. Kto ustępuje?", "A power-driven vessel has a sailing yacht on her port side on a collision course. Who gives way?"], ["Statek o napędzie mechanicznym", "The power-driven vessel"], ["Jacht żaglowy", "The sailing yacht"], ["Oba zmieniają kurs w prawo", "Both alter to starboard"]],
  ["sea", "rules", ["Jacht < 20 m w wąskim przejściu spotyka duży statek, który może płynąć tylko tym przejściem. Co obowiązuje jacht?", "A yacht < 20 m in a narrow channel meets a large ship confined to it. What applies to the yacht?"], ["Nie może mu utrudniać przejścia", "Must not impede it"], ["Ma pierwszeństwo jako żaglowiec", "Has right of way as a sailing vessel"], ["Ma pierwszeństwo, jeśli ma go po prawej", "Has right of way if it is to starboard"]],
  ["sea", "rules", ["Jak przecina się tor ruchu w systemie rozgraniczenia ruchu (TSS)?", "How is a traffic lane in a TSS crossed?"], ["Kursem prostopadłym do kierunku ruchu w TSS", "On a heading at right angles to the traffic flow"], ["Kursem najbardziej zbliżonym do kierunku ruchu w TSS", "On a heading as close as possible to the traffic flow"], ["Kursem ok. 45° do kierunku ruchu w TSS", "At about 45° to the traffic flow"]],
  ["sea", "rules", ["Bezpieczna prędkość to prędkość, przy której…", "A safe speed is one at which you…"], ["Zdążysz uniknąć zderzenia lub się zatrzymać", "Can avoid collision or stop in time"], ["Nie przekraczasz 6 kn we mgle", "Do not exceed 6 kn in fog"], ["Masz jeszcze sterowność", "Still have steerage way"]],
  ["both", "rules", ["Po czym poznasz niebezpieczeństwo zderzenia?", "How do you recognise a risk of collision?"], ["Namiar się nie zmienia", "The bearing does not change"], ["Kąt kursowy rośnie", "The relative bearing increases"], ["Namiar się zmienia, odległość maleje", "The bearing changes and the range closes"]],
  ["both", "rules", ["Jak manewruje statek ustępujący drogi?", "How should the give-way vessel act?"], ["Wcześnie i zdecydowanie", "Early and substantially"], ["Stopniowo, małymi zmianami kursu", "Gradually, by small changes"], ["Dopiero po sygnale drugiego statku", "Only after the other sounds a signal"]],
  ["both", "rules", ["Co robi statek uprzywilejowany (nieustępujący drogi)?", "What does the stand-on vessel do?"], ["Utrzymuje kurs i prędkość", "Keeps her course and speed"], ["Od razu zmienia kurs w prawo", "Alters to starboard at once"], ["Zwalnia do zatrzymania", "Slows down to a stop"]],
  ["sea", "rules", ["Kiedy statek uprzywilejowany musi sam manewrować?", "When must the stand-on vessel act herself?"], ["Gdy sam manewr ustępującego nie wystarczy", "When the give-way vessel’s action alone is not enough"], ["Gdy usłyszy 5 krótkich sygnałów", "When she hears 5 short blasts"], ["Gdy odległość spadnie poniżej 1 Mm", "When the range drops below 1 NM"]],
  ["sea", "rules", ["Statek uprzywilejowany ma ustępującego po lewej burcie, a ten nie manewruje. Czego unika?", "The stand-on vessel has the give-way vessel to port and it does not act. What does she avoid?"], ["Zmiany kursu w lewo", "Altering to port"], ["Zmiany kursu w prawo", "Altering to starboard"], ["Zmniejszenia prędkości", "Reducing speed"]],
  ["sea", "rules", ["We mgle słyszysz przed trawersem sygnał mgłowy statku, którego nie widzisz. Co robisz?", "In fog you hear a fog signal forward of the beam. What do you do?"], ["Zwalniam do minimum, w razie potrzeby stop", "Slow to bare steerage, stop if needed"], ["Zmieniam kurs w prawo", "Alter to starboard"], ["Zmieniam kurs w lewo", "Alter to port"]],
  ["sea", "rules", ["Któremu statkowi jacht żaglowy musi ustąpić drogi?", "Which vessel must a sailing yacht keep clear of?"], ["O ograniczonej zdolności manewrowania", "One restricted in her ability to manoeuvre"], ["O napędzie mechanicznym na kursie przecinającym", "A crossing power-driven vessel"], ["O napędzie mechanicznym, który go dogania", "A power-driven vessel overtaking her"]],
  ["both", "rules", ["Jacht płynie na żaglach z pracującym silnikiem. Jak traktują go przepisy?", "A yacht sails with her engine running. How do the rules treat her?"], ["Jak statek o napędzie mechanicznym", "As a power-driven vessel"], ["Jak jednostkę żaglową", "As a sailing vessel"], ["Jak żaglową, gdy silnik jest na luzie", "As sailing if the engine is in neutral"]],
  ["sea", "rules", ["Jaki sektor oświetla światło masztowe?", "What arc does a masthead light show?"], ["225°", "225°"], ["112,5°", "112.5°"], ["135°", "135°"]],
  ["sea", "rules", ["Jaki sektor oświetla światło rufowe?", "What arc does a stern light show?"], ["135°", "135°"], ["112,5°", "112.5°"], ["225°", "225°"]],
  ["sea", "rules", ["Jaki sektor oświetla każde ze świateł burtowych?", "What arc does each sidelight show?"], ["112,5°", "112.5°"], ["135°", "135°"], ["90°", "90°"]],
  ["sea", "rules", ["Do jakiej długości jacht żaglowy może nieść latarnię trójsektorową na topie masztu?", "Below what length may a sailing vessel carry a masthead tricolour?"], ["Poniżej 20 m", "Less than 20 m"], ["Poniżej 12 m", "Less than 12 m"], ["Poniżej 50 m", "Less than 50 m"]],
  ["sea", "rules", ["Jacht żaglowy < 7 m nie może nieść świateł burtowych i rufowego. Co musi mieć?", "A sailing vessel < 7 m cannot carry sidelights and stern light. What must she have?"], ["Latarkę z białym światłem pod ręką", "A white torch ready to hand"], ["Białe dookólne na topie masztu", "A white all-round masthead light"], ["Czerwone dookólne", "A red all-round light"]],
  ["sea", "rules", ["Kiedy jacht nie może nieść czerwonego nad zielonym na topie masztu?", "When may a yacht not show red over green at the masthead?"], ["Gdy używa latarni trójsektorowej", "When using a tricolour"], ["Gdy jest krótszy niż 20 m", "When under 20 m"], ["Gdy płynie bajdewindem", "When close-hauled"]],
  ["sea", "rules", ["Jak jacht postępuje wobec statku ograniczonego zanurzeniem?", "How does a yacht act towards a vessel constrained by her draught?"], ["Nie utrudnia mu przejścia", "Avoids impeding her"], ["Ustępuje tylko, gdy ma go po prawej", "Gives way only if she is to starboard"], ["Nic – to on ustępuje żaglowcowi", "Nothing – she gives way to sail"]],
  ["both", "rules", ["Kto odpowiada za uniknięcie zderzenia?", "Who is responsible for avoiding a collision?"], ["Obie jednostki, jednak w pierwszej kolejności statek ustępujący", "Both vessels, but first of all the give-way vessel"], ["Tylko statek uprzywilejowany", "Only the stand-on vessel"], ["Tylko statek ustępujący", "Only the give-way vessel"]],
  ["both", "rules", ["Jak prowadzi się obserwację?", "How is a lookout kept?"], ["Stale, wzrokiem, słuchem i wszystkimi środkami", "At all times, by sight, hearing and all means"], ["Wzrokiem, a we mgle wystarczy radar", "By sight; radar alone in fog"], ["Przez AIS, wzrokiem tylko nocą", "By AIS; by sight only at night"]],
  ["sea", "rules", ["Której strony wąskiego przejścia trzyma się jacht?", "Which side of a narrow channel does a yacht keep to?"], ["Prawej", "Starboard"], ["Lewej", "Port"], ["Środka", "The middle"]],
  ["sea", "rules", ["Jak płynie jacht torem ruchu w systemie rozgraniczenia ruchu?", "How does a yacht proceed in a traffic lane?"], ["Zgodnie z kierunkiem ruchu na torze", "With the traffic flow of the lane"], ["Strefą rozgraniczenia", "Along the separation zone"], ["Dowolnie, byle przy krawędzi toru", "Either way, near the lane edge"]],
  ["sea", "rules", ["Kto może korzystać ze strefy żeglugi przybrzeżnej?", "Who may use an inshore traffic zone?"], ["Statki < 20 m, żaglowce i rybacy", "Vessels < 20 m, sailing vessels and fishing vessels"], ["Tylko statki < 12 m", "Only vessels < 12 m"], ["Wszyscy, ale tylko w dzień", "Everyone, by day only"]],
  ["sea", "rules", ["Kiedy wolno wejść do strefy rozgraniczenia ruchu jachtowi żaglowemu?", "When may a sailing yacht enter a separation zone?"], ["Przy przecinaniu", "When crossing it"], ["Gdy płynie wolniej niż 5 kn", "When slower than 5 kn"], ["W celu stanięcia na kotwicy", "To anchor"]],
  ["sea", "rules", ["Kiedy kończy się obowiązek ustępowania przez statek wyprzedzający?", "When does the overtaking vessel’s duty to keep clear end?"], ["Gdy całkiem minie i oddali się od statku wyprzedzanego", "When finally past and clear of the overtaken vessel"], ["Gdy wyprzedzany zostanie za jego trawersem", "When the other is abaft her beam"], ["Gdy znajdzie się na trawersie", "When abeam"]],
  ["sea", "rules", ["Statek jest „niezdolny do manewrowania”, gdy…", "A vessel is “not under command” when…"], ["Np. ma awarię steru", "E.g. her steering has failed"], ["Np. kładzie kabel", "E.g. she is laying cable"], ["Np. ogranicza go zanurzenie", "E.g. her draught restricts her"]],
  ["sea", "rules", ["Statek ma „ograniczoną zdolność manewrowania”, gdy…", "A vessel is “restricted in her ability to manoeuvre” when…"], ["Np. pogłębia tor", "E.g. she is dredging"], ["Np. ma awarię silnika", "E.g. her engine has failed"], ["Np. ogranicza go zanurzenie", "E.g. her draught restricts her"]],
  ["sea", "rules", ["Statek jest „w drodze”, gdy…", "A vessel is “under way” when…"], ["Nie stoi na kotwicy, cumach ani mieliźnie", "Not at anchor, moored or aground"], ["Płynie szybciej niż 1 kn", "Moving faster than 1 kn"], ["Ma pracujący silnik", "Her engine is running"]],
  ["sea", "rules", ["Od jakiej długości statek na kotwicy musi oświetlać pokład?", "From what length must a vessel at anchor light her decks?"], ["Od 100 m", "From 100 m"], ["Od 50 m", "From 50 m"], ["Od 150 m", "From 150 m"]],
  ["sea", "rules", ["Kiedy statki muszą pokazywać światła?", "When must vessels show their lights?"], ["Od zachodu do wschodu słońca i w ograniczonej widzialności", "Sunset to sunrise and in restricted visibility"], ["Od zmierzchu do świtu, nigdy w dzień", "Dusk to dawn, never by day"], ["Tylko w ograniczonej widzialności", "Only in restricted visibility"]],
  ["sea", "rules", ["Przed dziobem widzisz czerwone, zielone i jedno białe nad nimi. Co to?", "Ahead you see red, green and one white above them. What is it?"], ["Statek o napędzie mechanicznym < 50 m idący na ciebie", "A power vessel < 50 m heading for you"], ["Statek o napędzie mechanicznym ≥ 50 m widziany z boku", "A power vessel ≥ 50 m seen from abeam"], ["Jacht żaglowy idący na ciebie", "A sailing yacht heading for you"]],
  ["sea", "rules", ["Przed dziobem widzisz tylko czerwone i zielone (bez białego). Co to?", "Ahead you see only red and green, no white. What is it?"], ["Jacht żaglowy idący na ciebie", "A sailing yacht heading for you"], ["Statek rybacki", "A fishing vessel"], ["Statek o napędzie mechanicznym idący na ciebie", "A power vessel heading for you"]],
  ["both", "rules", ["Widzisz tylko zielone światło. Którą część statku widzisz?", "You see only a green light. Which part of the vessel do you see?"], ["Prawą burtę", "Her starboard side"], ["Rufę", "Her stern"], ["Lewą burtę", "Her port side"]],
  ["both", "rules", ["Widzisz tylko czerwone światło. Którą część statku widzisz?", "You see only a red light. Which part of the vessel do you see?"], ["Lewą", "Port"], ["Dziób", "Her bow"], ["Prawą", "Starboard"]],
  ["sea", "rules", ["Przed dziobem widzisz jedno białe światło, namiar stały, odległość maleje. Co to może być?", "Ahead: one white light, steady bearing, closing. What might it be?"], ["Rufa statku lub mały statek na kotwicy", "A stern light or a small vessel at anchor"], ["Jacht żaglowy widziany z boku", "A sailing yacht seen from abeam"], ["Statek o napędzie mechanicznym idący na ciebie", "A power vessel heading for you"]],
  ["sea", "rules", ["Czego dotyczy prawidło 19?", "What does Rule 19 cover?"], ["Statków niewidzących się w ograniczonej widzialności", "Vessels not in sight of one another in restricted visibility"], ["Statków widzących się wzajemnie", "Vessels in sight of one another"], ["Sygnałów mgłowych", "Fog signals"]],
  ["sea", "rules", ["Co jest „ograniczoną widzialnością” według MPZZM?", "What counts as “restricted visibility”?"], ["Mgła, opady, zamglenie, burza piaskowa", "Fog, rain, mist, sandstorm"], ["Każda żegluga nocą", "Any night navigation"], ["Widzialność poniżej 5 Mm", "Visibility under 5 NM"]],
  ["sea", "rules", ["Jacht żaglowy spotyka wodnosamolot na wodzie. Kto ustępuje?", "A sailing yacht meets a seaplane on the water. Who gives way?"], ["Wodnosamolot", "The seaplane"], ["Jacht", "The yacht"], ["Ten, który ma drugi po prawej", "The one with the other to starboard"]],
  ["sea", "rules", ["Jaki manewr najlepiej pokazuje drugiemu statkowi, że ustępujesz?", "Which action best shows you are giving way?"], ["Duża, wczesna zmiana kursu", "A large, early course change"], ["Kilka małych zmian kursu", "Several small course changes"], ["Mała zmiana kursu i sygnał", "A small change plus a sound signal"]],
  ["sea", "rules", ["Co pokazuje nocą statek na mieliźnie?", "What does a vessel aground show at night?"], ["Kotwiczne i dwa czerwone w pionie", "Anchor lights and two reds in a line"], ["Trzy czerwone w pionie", "Three reds in a line"], ["Dwa czerwone w pionie i burtowe", "Two reds in a line and sidelights"]],
  ["sea", "rules", ["Co pokazuje nocą statek pilotowy na służbie, w drodze?", "What does a pilot vessel on duty show at night, under way?"], ["Białe nad czerwonym, burtowe i rufowe", "White over red, sidelights, stern light"], ["Czerwone nad białym, burtowe i rufowe", "Red over white, sidelights, stern light"], ["Białe nad czerwonym i masztowe", "White over red and a masthead light"]],
  ["sea", "rules", ["Dwa czerwone dookólne w pionie, bez świateł burtowych – co to?", "Two red all-round lights in a line, no sidelights – what is it?"], ["Niezdolny do manewrowania, bez biegu", "NUC, not making way"], ["Niezdolny do manewrowania, z biegiem", "NUC, making way"], ["Statek na mieliźnie", "A vessel aground"]],
  ["sea", "rules", ["Co oznacza żółte światło nad światłem rufowym?", "What does a yellow light above the stern light mean?"], ["Holuje za rufą", "Towing astern"], ["Pcha przed sobą", "Pushing ahead"], ["Jest holowany", "Being towed"]],
  ["sea", "rules", ["Ile świateł masztowych w pionie ma holownik z zestawem dłuższym niż 200 m?", "How many masthead lights in a line has a tug with a tow over 200 m?"], ["Trzy", "Three"], ["Dwa", "Two"], ["Cztery", "Four"]],
  ["inland", "inlandRules", ["Mała jednostka według przepisów śródlądowych to statek o długości kadłuba…", "A small craft under inland rules has a hull length…"], ["Poniżej 20 m", "Under 20 m"], ["Poniżej 15 m", "Under 15 m"], ["Poniżej 7,5 m", "Under 7.5 m"]],
  ["inland", "inlandRules", ["Mały jacht spotyka barkę motorową (nie małą jednostkę). Kto ustępuje?", "A small yacht meets a motor barge (not a small craft). Who gives way?"], ["Mały jacht", "The small yacht"], ["Barka", "The barge"], ["Ten, kto płynie pod prąd", "Whoever goes upstream"]],
  ["inland", "inlandRules", ["Mała motorówka spotyka małą jednostkę żaglową. Kto ustępuje?", "A small motor boat meets a small sailing craft. Who gives way?"], ["Motorówka", "The motor boat"], ["Jednostka żaglowa", "The sailing craft"], ["Ta, która ma drugą po prawej", "The one with the other to starboard"]],
  ["inland", "inlandRules", ["Łódź wiosłowa spotyka małą jednostkę żaglową. Kto ustępuje?", "A rowing boat meets a small sailing craft. Who gives way?"], ["Łódź wiosłowa", "The rowing boat"], ["Jednostka żaglowa", "The sailing craft"], ["Ta, która ma drugą po prawej", "The one with the other to starboard"]],
  ["inland", "inlandRules", ["Mała motorówka spotyka łódź wiosłową. Kto ustępuje?", "A small motor boat meets a rowing boat. Who gives way?"], ["Motorówka", "The motor boat"], ["Łódź wiosłowa", "The rowing boat"], ["Ta, która płynie pod prąd", "Whichever goes upstream"]],
  ["inland", "inlandRules", ["Dwie małe jednostki żaglowe mają wiatr z różnych burt. Która ustępuje?", "Two small sailing craft have the wind on different sides. Which gives way?"], ["Ta z wiatrem z lewej burty", "The one on port tack"], ["Ta z wiatrem z prawej burty", "The one on starboard tack"], ["Ta, która płynie z prądem", "The one going downstream"]],
  ["inland", "inlandRules", ["Dwie małe jednostki żaglowe mają wiatr z tej samej burty. Która ustępuje?", "Two small sailing craft have the wind on the same side. Which gives way?"], ["Nawietrzna", "The windward one"], ["Zawietrzna", "The leeward one"], ["Ta, która płynie pod prąd", "The one going upstream"]],
  ["inland", "inlandRules", ["Z której strony zwykle wyprzedza się statek na drodze śródlądowej?", "On which side is a vessel normally overtaken on inland waters?"], ["Z jego lewej burty", "On her port side"], ["Z jego prawej burty", "On her starboard side"], ["Od strony głębszej wody", "On the deeper side"]],
  ["inland", "inlandRules", ["Jak mijają się statki płynące w przeciwnych kierunkach?", "How do vessels on opposite courses pass each other?"], ["Lewymi burtami", "Port to port"], ["Prawymi burtami", "Starboard to starboard"], ["Dowolnie", "Either way"]],
  ["inland", "inlandRules", ["W wąskim przejściu na rzece spotykają się statki płynące w górę i w dół. Który czeka?", "In a narrow passage vessels going upstream and downstream meet. Which waits?"], ["Płynący w górę rzeki", "The one going upstream"], ["Płynący w dół rzeki", "The one going downstream"], ["Mniejszy", "The smaller one"]],
  ["inland", "inlandRules", ["Gdzie zabroniony jest postój statków?", "Where is berthing prohibited?"], ["Pod mostami i liniami energetycznymi", "Under bridges and power lines"], ["Tylko przy znaku A.5", "Only at sign A.5"], ["Tylko na jeziorach", "Only on lakes"]],
  ["inland", "inlandRules", ["Prawy i lewy brzeg rzeki określa się, patrząc…", "The right and left banks of a river are named looking…"], ["W dół rzeki", "Downstream"], ["W górę rzeki", "Upstream"], ["Od strony morza", "From the sea"]],
  ["inland", "inlandRules", ["Kto ma pierwszeństwo: mały jacht czy prom?", "Who has priority: a small yacht or a ferry?"], ["Prom", "The ferry"], ["Mały jacht pod żaglami", "The small yacht under sail"], ["Ten, który ma drugi po prawej", "The one with the other to starboard"]],
  ["inland", "inlandRules", ["Jak wchodzi się do śluzy?", "How do you enter a lock?"], ["Na zielone światło, w kolejności wskazanej przez obsługę", "On green, in the order set by the lock staff"], ["Małe jednostki zawsze pierwsze", "Small craft always first"], ["Na żółte światło, kto pierwszy", "On amber, first come first served"]],
  ["inland", "inlandRules", ["Co robisz z cumami w śluzie podczas zmiany poziomu wody?", "What do you do with lines in a lock as the level changes?"], ["Luzuję lub wybieram na bieżąco", "Ease or take them in continuously"], ["Knaguję na stałe", "Make them fast"], ["Zdejmuję i trzymam jacht bosakiem", "Cast off and hold on with a boathook"]],
  ["inland", "inlandRules", ["Co oznacza znak A.9 (zakaz wytwarzania fali)?", "What does sign A.9 (no wash) mean?"], ["Zwolnij, by nie robić fali", "Slow down so as not to make wash"], ["Utrzymuj prędkość, aby nie zwiększać fali", "Keep your speed so as not to add to the wash"], ["Wyłącz silnik", "Switch off the engine"]],
  ["inland", "inlandRules", ["Jak oznakowana jest prawa strona szlaku na rzece?", "How is the right side of a river fairway marked?"], ["Czerwonymi pławami walcowymi", "Red can buoys"], ["Zielonymi pławami stożkowymi", "Green conical buoys"], ["Czerwono-zielonymi pławami", "Red-and-green buoys"]],
  ["inland", "inlandRules", ["Jakie światło niesie nocą łódź wiosłowa?", "What light does a rowing boat show at night?"], ["Białe dookólne", "A white all-round light"], ["Burtowe i rufowe", "Sidelights and stern light"], ["Żółte dookólne", "A yellow all-round light"]],
  ["inland", "inlandRules", ["Jaki jacht żaglowy pełnoletni może prowadzić bez patentu?", "What sailing yacht may an adult skipper without a licence?"], ["Do 7,5 m długości kadłuba", "Up to 7.5 m hull length"], ["Do 10 m długości kadłuba", "Up to 10 m hull length"], ["Do 5 m długości kadłuba", "Up to 5 m hull length"]],
  ["inland", "inlandRules", ["Co sprawdzasz przed przejściem jachtem z masztem pod mostem?", "What do you check before taking a masted yacht under a bridge?"], ["Prześwit i wysokość masztu", "The clearance and mast height"], ["Głębokość pod mostem", "The depth under the bridge"], ["Szerokość przęsła", "The span width"]],
  ["inland", "inlandRules", ["Gdzie nie wolno kotwiczyć?", "Where must you not anchor?"], ["Na szlaku, gdzie utrudnia to ruch", "In the fairway where it obstructs traffic"], ["Poza szlakiem, przy brzegu", "Off the fairway near the bank"], ["Na jeziorze w nocy", "On a lake at night"]],
  ["inland", "inlandRules", ["Jeden długi dźwięk na drodze śródlądowej oznacza…", "One long blast on inland waters means…"], ["Uwaga", "Attention"], ["Zmieniam kurs w prawo", "Altering to starboard"], ["Nie mogę manewrować", "I cannot manoeuvre"]],
  ["inland", "inlandRules", ["Cztery krótkie dźwięki na drodze śródlądowej oznaczają…", "Four short blasts on inland waters mean…"], ["Nie mogę manewrować", "I cannot manoeuvre"], ["Pracuję wstecz", "Going astern"], ["Zawracam w prawo", "Turning to starboard"]],
  ["inland", "inlandRules", ["Jakie światło niesie nocą statek na postoju przy brzegu?", "What light does a vessel berthed at the bank show at night?"], ["Białe dookólne od strony szlaku", "White all-round on the fairway side"], ["Burtowe i rufowe", "Sidelights and stern light"], ["Czerwone dookólne od strony szlaku", "Red all-round on the fairway side"]],
  ["inland", "inlandRules", ["Czy wolno prowadzić jacht po alkoholu?", "May you skipper a yacht after drinking?"], ["Nie", "No"], ["Tak, po upływie 12h od zakończenia picia alkoholu", "Yes, 12 h after the last drink"], ["Tylko na żaglach", "Only under sail"]],
  ["inland", "inlandRules", ["Jak zwykle kotwiczy się na rzece?", "How do you usually anchor on a river?"], ["Dziobem pod prąd", "Bow upstream"], ["Rufą pod prąd", "Stern upstream"], ["Burtą do prądu", "Beam to the current"]],
  ["inland", "inlandRules", ["Jak podchodzisz do pomostu na rzece?", "How do you approach a pontoon on a river?"], ["Pod prąd", "Against the current"], ["Z prądem", "With the current"], ["W poprzek prądu", "Across the current"]],
  ["inland", "inlandRules", ["Dlaczego zestaw pchany jest groźny dla małego jachtu?", "Why is a pushed convoy dangerous to a small yacht?"], ["Długo hamuje i słabo widzi przed dziobem", "Long stopping distance, poor view ahead"], ["Nie może dawać sygnałów dźwiękowych", "It cannot sound signals"], ["Zawsze płynie środkiem szlaku", "It always keeps to the middle"]],
  ["inland", "inlandRules", ["Kto kieruje zestawem holowanym?", "Who is in charge of a towed convoy?"], ["Kierownik zestawu, zwykle na holowniku", "The convoy master, usually on the tug"], ["Kapitan ostatniego statku", "The skipper of the last vessel"], ["Każdy statek osobno", "Each vessel separately"]],
  ["inland", "inlandRules", ["Kiedy statek daje sygnał „uwaga” przed zakrętem rzeki?", "When does a vessel sound “attention” before a river bend?"], ["Gdy zakręt ogranicza widoczność", "When the bend limits visibility"], ["Po minięciu zakrętu", "After passing the bend"], ["Tylko w nocy", "Only at night"]],
  ["inland", "inlandRules", ["Co oznacza czerwone światło przy śluzie?", "What does a red light at a lock mean?"], ["Wejście zabronione", "No entry"], ["Przygotuj się do wejścia", "Prepare to enter"], ["Śluza w remoncie, płyń obok", "Lock closed, pass beside it"]],
  ["inland", "inlandRules", ["Co oznacza zielone światło przy śluzie?", "What does a green light at a lock mean?"], ["Wejście dozwolone", "Entry allowed"], ["Przygotuj się do wejścia", "Prepare to enter"], ["Wyjście ze śluzy", "Exit the lock"]],
  ["inland", "inlandRules", ["Czy mały jacht może wyprzedzić zestaw pchany w wąskim przejściu?", "May a small yacht overtake a pushed convoy in a narrow passage?"], ["Tylko gdy to bezpieczne i nie ma zakazu", "Only if safe and not prohibited"], ["Zawsze, bo jest szybszy", "Always, it is faster"], ["Tylko z prawej strony zestawu", "Only on the convoy’s starboard side"]],
  ["inland", "inlandRules", ["Duży statek zbliża się szlakiem do twojego małego jachtu. Co robisz?", "A large vessel approaches your small yacht in the fairway. What do you do?"], ["Wcześnie schodzę mu z drogi", "Get out of its way early"], ["Utrzymuję kurs pod żaglami", "Hold course under sail"], ["Płynę środkiem, żeby mnie widział", "Keep to the middle so it sees me"]],
  ["inland", "inlandRules", ["Jakim światłem oznakowany jest nocą lewy brzeg szlaku?", "What light marks the left side of the fairway at night?"], ["Zielonym", "Green"], ["Czerwonym", "Red"], ["Żółtym", "Yellow"]],
  ["inland", "inlandRules", ["Jakim światłem oznakowany jest nocą prawy brzeg szlaku?", "What light marks the right side of the fairway at night?"], ["Czerwonym", "Red"], ["Zielonym", "Green"], ["Białym", "White"]],
  ["inland", "inlandRules", ["Jakim światłem oznakowane jest przejście szlaku na drugi brzeg?", "What light marks a fairway crossover to the other bank?"], ["Żółtym", "Yellow"], ["Białym", "White"], ["Zielonym", "Green"]],
  ["inland", "inlandRules", ["Jakie światło pokazuje nocą jacht na kotwicy poza miejscem postoju?", "What light does a yacht at anchor show at night outside a berthing area?"], ["Białe dookólne", "A white all-round light"], ["Czerwone dookólne", "A red all-round light"], ["Białe i czerwone w pionie", "White over red"]],
  ["inland", "inlandRules", ["Czy wolno cumować do pław i tyczek szlaku?", "May you moor to fairway buoys and spars?"], ["Nie", "No"], ["Tak, na krótko", "Yes, briefly"], ["Tak, w dzień", "Yes, by day"]],
  ["inland", "inlandRules", ["Co obowiązuje przy znaku zakazu ruchu statków o napędzie mechanicznym?", "What applies at a sign prohibiting powered vessels?"], ["Nie wolno płynąć na silniku", "You may not use the engine"], ["Silnik wolno używać do 10 km/h", "The engine is allowed up to 10 km/h"], ["Zakaz dotyczy tylko statków > 20 m", "It applies only to vessels > 20 m"]],
  ["inland", "inlandRules", ["Jaki patent uprawnia do prowadzenia jachtu żaglowego > 7,5 m na śródlądziu?", "Which certificate lets you skipper a sailing yacht > 7.5 m inland?"], ["Żeglarz jachtowy", "Yacht sailor"], ["Karta pływacka", "Swimming card"], ["Sternik motorowodny", "Motorboat helmsman"]],
  ["both", "seaman", ["Jak nazywa się lewa burta?", "What is the left side of a boat called?"], ["Portburta (Bakburta)", "Port"], ["Sterburta", "Starboard"], ["Zawietrzna", "Leeward"]],
  ["both", "seaman", ["Jak nazywa się prawa burta?", "What is the right side of a boat called?"], ["Sterburta", "Starboard"], ["Portburta", "Larboard"], ["Bakburta", "Port"]],
  ["both", "seaman", ["Strona nawietrzna to strona…", "The windward side is the side…"], ["Z której wieje wiatr", "The wind comes from"], ["Zależna od kursu jachtu", "Depends on the yacht’s course"], ["Osłonięta od wiatru", "Sheltered from the wind"]],
  ["both", "seaman", ["„Odpadać” to…", "“Bearing away” means…"], ["Zwiększać kurs względem wiatru", "Increasing the course angle to the wind"], ["Zmieniać hals zwrotem przez rufę", "Changing tack by gybing"], ["Zmniejszać kurs względem wiatru", "Decreasing the course angle to the wind"]],
  ["both", "seaman", ["„Ostrzyć” to…", "“Luffing up” means…"], ["Zmniejszać kurs względem wiatru", "Decreasing the course angle to the wind"], ["Zwiększać kurs względem wiatru", "Increasing the course angle to the wind"], ["Zmieniać hals przez sztag", "Tacking"]],
  ["both", "seaman", ["Zwrot przez sztag to zmiana halsu…", "Tacking is changing tack…"], ["Kiedy wiatr wieje od dziobu", "When the wind is from ahead"], ["Bez przechodzenia przez linię wiatru", "Without crossing the wind"], ["Kiedy wiatr wieje od rufy", "When the wind is from astern"]],
  ["both", "seaman", ["Zwrot przez rufę to zmiana halsu…", "Gybing is changing tack…"], ["Kiedy wiatr wieje od rufy", "When the wind is from astern"], ["Po zatrzymaniu jachtu w kącie martwym", "After stopping the yacht in the no-go zone"], ["Kiedy wiatr wieje od dziobu", "When the wind is from ahead"]],
  ["both", "seaman", ["Kurs ok. 45° do wiatru to…", "A course about 45° to the wind is…"], ["Bajdewind", "Close-hauled"], ["Półwiatr", "A beam reach"], ["Baksztag", "A broad reach"]],
  ["both", "seaman", ["Kurs z wiatrem prosto od rufy to…", "A course with the wind dead astern is…"], ["Fordewind", "A run"], ["Baksztag", "A broad reach"], ["Półwiatr", "A beam reach"]],
  ["both", "seaman", ["Kurs z wiatrem prostopadle do osi jachtu to…", "A course with the wind at right angles is…"], ["Półwiatr", "A beam reach"], ["Baksztag", "A broad reach"], ["Bajdewind", "Close-hauled"]],
  ["both", "seaman", ["Kurs z wiatrem z boku od tyłu (ok. 135°) to…", "A course with the wind on the quarter (about 135°) is…"], ["Baksztag", "A broad reach"], ["Półwiatr", "A beam reach"], ["Fordewind", "A run"]],
  ["both", "seaman", ["Do czego służy szot?", "What is a sheet for?"], ["Do ustawiania pozycji żagla", "Setting the sail’s position"], ["Do podnoszenia żagla", "Hoisting a sail"], ["Do rolowania foka", "Furling the jib"]],
  ["both", "seaman", ["Do czego służy fał?", "What is a halyard for?"], ["Do podnoszenia żagla", "Hoisting a sail"], ["Do ściągania bomu w dół", "Pulling the boom down"], ["Do zmiany położenia żagli z jednej burty na drugą", "Moving the sails from one side to the other"]],
  ["both", "seaman", ["Refowanie to…", "Reefing is…"], ["Zmniejszanie powierzchni żagla", "Reducing sail area"], ["Zwiększanie powierzchni żagla", "Increasing sail area"], ["Wybieranie szotów", "Trimming the sheets"]],
  ["both", "seaman", ["Który węzeł tworzy pętlę, która się nie zaciska?", "Which knot makes a loop that does not slip?"], ["Ratowniczy", "Bowline"], ["Węzeł płaski", "Reef knot"], ["Wyblinka", "Clove hitch"]],
  ["both", "seaman", ["Do czego zwykle służy wyblinka?", "What is a clove hitch usually for?"], ["Do mocowania odbijaczy", "Tying on fenders"], ["Do łączenia dwóch lin o różnych średnicach", "Joining two ropes of different diameters"], ["Do łączenia dwóch lin o tej samej średnicy", "Joining two ropes of the same diameter"]],
  ["both", "seaman", ["Do czego służy ósemka?", "What is a figure-of-eight knot for?"], ["Zabezpiecza koniec liny przed wysunięciem", "Stopping a rope end running out"], ["Łączy dwie liny", "Joining two ropes"], ["Mocuje linę do knagi", "Making fast to a cleat"]],
  ["both", "seaman", ["Do czego służy węzeł płaski?", "What is a reef knot for?"], ["Łączenie lin tej samej grubości", "Joining ropes of equal size"], ["Łączenie lin różnej grubości", "Joining ropes of different sizes"], ["Mocowanie liny do polera", "Tying a rope to a bollard"]],
  ["both", "seaman", ["Do czego służy węzeł szotowy?", "What is a sheet bend for?"], ["Łączenie lin o różnej grubości", "Joining ropes of different sizes"], ["Refowania żagli", "Reefing sails"], ["Łączenie lin o tej samej grubości", "Joining ropes of the same size"]],
  ["both", "seaman", ["Do czego służy węzeł knagowy?", "What is a cleat hitch for?"], ["Mocowania liny na knadze", "Making fast on a cleat"], ["Mocowania liny do polera", "Making fast to a bollard"], ["Skracania liny", "Shortening a rope"]],
  ["both", "seaman", ["Szpring to cuma…", "A spring is a line…"], ["Prowadzona od rufy lub dziobu do polera lub knagi w kierunku do środokręcia", "Led from the bow or stern to a bollard or cleat towards amidships"], ["Prowadzona prostopadle z dziobu", "Led square from the bow"], ["Prowadzona od rufy lub dziobu do polera lub knagi w kierunku od środokręcia", "Led from the bow or stern to a bollard or cleat away from amidships"]],
  ["both", "seaman", ["Sztag to lina…", "A forestay runs…"], ["Od masztu do dziobu", "From mast to bow"], ["Od masztu do rufy", "From mast to stern"], ["Od masztu do burty", "From mast to the side"]],
  ["both", "seaman", ["Achtersztag to lina…", "A backstay runs…"], ["Od topu masztu do rufy", "From masthead to stern"], ["Od masztu do dziobu", "From mast to bow"], ["Od masztu do burty", "From mast to the side"]],
  ["both", "seaman", ["Wanty to liny…", "Shrouds are wires…"], ["Podtrzymujące maszt z boków", "Supporting the mast from the sides"], ["Podtrzymujące maszt od dziobu", "Supporting the mast from forward"], ["Podtrzymujące bom", "Supporting the boom"]],
  ["both", "seaman", ["Salingi to…", "Spreaders are…"], ["Rozpórki want na maszcie", "Struts spreading the shrouds"], ["Prowadnice szotów na pokładzie", "Sheet leads on deck"], ["Elementy do mocowania cum", "Fittings for making fast mooring lines"]],
  ["both", "seaman", ["Do bomu mocuje się…", "The boom carries…"], ["Dolny róg grota", "The clew of the mainsail"], ["Górny róg grota", "The head of the mainsail"], ["Przedni lik foka", "The luff of the jib"]],
  ["both", "seaman", ["Odciągacz bomu służy do…", "A boom vang is for…"], ["Ściągania bomu w dół", "Pulling the boom down"], ["Przesuwania bomu na burtę", "Pulling the boom to the side"], ["Podnoszenia bomu", "Lifting the boom"]],
  ["both", "seaman", ["Grot to…", "The mainsail is…"], ["Żagiel na maszcie i bomie", "The sail on the mast and boom"], ["Żagiel na sztagu", "The sail on the forestay"], ["Żagiel stosowany zamiennie do foka na kursach pełnych", "A sail used instead of the jib downwind"]],
  ["both", "seaman", ["Fok to…", "A jib is…"], ["Przedni żagiel na sztagu", "The headsail on the forestay"], ["Główny żagiel", "The main sail"], ["Żagiel na bezanmaszcie", "A sail on the mizzen"]],
  ["both", "seaman", ["Na jakich kursach stawia się spinaker?", "On which points of sail is a spinnaker set?"], ["Pełnych – z wiatrem", "Downwind"], ["Bajdewindzie", "Close-hauled"], ["Półwietrze i ostrzej", "Beam reach and higher"]],
  ["both", "seaman", ["Sztormfok to…", "A storm jib is…"], ["Mały, mocny przedni żagiel", "A small, strong headsail"], ["Zrefowany grot", "A reefed mainsail"], ["Lekki żagiel na słaby wiatr", "A light-air sail"]],
  ["both", "seaman", ["Takielunek ruchomy to…", "Running rigging is…"], ["Fały i szoty", "Halyards and sheets"], ["Wanty", "Shrouds"], ["Sztagi", "Stays"]],
  ["both", "seaman", ["Takielunek stały to…", "Standing rigging is…"], ["Wanty i sztagi", "Shrouds and stays"], ["Fały i szoty", "Halyards and sheets"], ["Kontrafały", "Downhauls"]],
  ["both", "seaman", ["Miecz lub balastowy kil…", "A centreboard or ballast keel…"], ["Zmniejsza dryf i daje stateczność", "Reduces leeway and gives stability"], ["Zmniejsza opór na fali", "Reduces drag in waves"], ["Zwiększa prędkość z wiatrem", "Increases speed downwind"]],
  ["both", "seaman", ["Kambuz to inaczej…", "The galley is…"], ["Kuchnia", "The galley"], ["Kabina sypialna", "A sleeping cabin"], ["Toaleta", "The toilet (heads)"]],
  ["both", "seaman", ["Mesa to inaczej…", "The saloon is…"], ["Główne pomieszczenie dostępne dla wszystkich członków załogi", "The main space open to the whole crew"], ["Kuchnia", "The galley"], ["Kabina rufowa", "The aft cabin"]],
  ["both", "seaman", ["Kokpit to…", "The cockpit is…"], ["Miejsce sternika i załogi na pokładzie", "The helm and crew area on deck"], ["Schowek na dziobie", "The forepeak locker"], ["Stanowisko nawigacyjne w mesie", "The chart table in the saloon"]],
  ["both", "seaman", ["Kingston to inaczej…", "In Polish yacht slang a “kingston” is…"], ["Toaleta", "The toilet (heads)"], ["Schowek na środki ratunkowe", "A locker for safety gear"], ["Zbiornik na nieczystości", "The holding tank"]],
  ["both", "seaman", ["Zęza to…", "The bilge is…"], ["Najniższa część wnętrza kadłuba", "The lowest part inside the hull"], ["Schowek na żagle", "The sail locker"], ["Przestrzeń pod kokpitem", "The space under the cockpit"]],
  ["both", "seaman", ["Pawęż to…", "A transom is…"], ["Płaskie zakończenie rufy", "The flat end of the stern"], ["Słupek przez który prowadzony jest sztormreling", "A stanchion carrying the guardrail"], ["Ster", "The rudder"]],
  ["both", "seaman", ["Reling to…", "A guardrail is…"], ["Barierka wokół pokładu", "A rail round the deck"], ["Lina do podnoszenia żagla", "A halyard"], ["Listwa odbojowa na burcie", "A rubbing strake"]],
  ["both", "seaman", ["Kosz dziobowy to…", "A pulpit is…"], ["Barierka na dziobie", "The rail at the bow"], ["Schowek na kotwicę", "The anchor locker"], ["Schowek w części dziobowej", "A locker in the bow"]],
  ["both", "seaman", ["Szekla to…", "A shackle is…"], ["Łącznik w kształcie U z bolcem", "A U-shaped link with a pin"], ["Bloczek z kółkiem", "A block with a sheave"], ["Okucie do knagowania", "A cleat"]],
  ["both", "seaman", ["Knaga służy do…", "A cleat is for…"], ["Mocowania liny", "Making a line fast"], ["Rozwiązywania mocno zaciśniętej pętli", "Undoing a jammed loop"], ["Ścinania liny w sytuacji awaryjnej", "Cutting a rope in an emergency"]],
  ["both", "seaman", ["Kipa to…", "A fairlead is…"], ["Prowadnica do liny", "A rope guide"], ["Zaczep lifeliny", "A harness point"], ["Klapa do zamykania zejściówki", "The companionway hatch board"]],
  ["both", "seaman", ["Ster strumieniowy…", "A bow thruster…"], ["Przesuwa dziób lub rufę w bok", "Pushes the bow or stern sideways"], ["Zastępuje silnik podczas manewrów portowych", "Replaces the engine in harbour manoeuvres"], ["Zastępuje ster", "Replaces the rudder"]],
  ["both", "seaman", ["Efekt śruby to…", "Prop walk is…"], ["Znoszenie rufy w bok", "The stern kicking sideways"], ["Efekt przyśpieszenia w kierunku płynięcia jachtu", "Acceleration in the direction of travel"], ["Przechył na jedną burtę przy utrzymaniu stałego kursu", "Heeling to one side while holding course"]],
  ["both", "seaman", ["Halsowanie to…", "Beating is…"], ["Żegluga zygzakiem pod wiatr", "Zigzagging to windward"], ["Zmiana żagli w czasie rejsu", "Changing sails under way"], ["Zmniejszenie powierzchni żagli przed spodziewanym pogorszeniem pogody", "Reducing sail ahead of expected bad weather"]],
  ["both", "seaman", ["Dlaczego niekontrolowany zwrot przez rufę jest groźny?", "Why is an uncontrolled gybe dangerous?"], ["Bom gwałtownie przechodzi na drugą burtę", "The boom swings violently across"], ["Jacht gwałtownie przyśpiesza", "The yacht suddenly accelerates"], ["Żagle tracą siłę nośną i jacht gwałtownie traci prędkość", "The sails stall and the yacht loses speed suddenly"]],
  ["both", "seaman", ["Dryfkotwa…", "A drogue…"], ["Spowalnia dryf i ustawia jacht do fali", "Slows drift and holds the yacht to the sea"], ["Zastępuje kotwicę w porcie", "Replaces the anchor in harbour"], ["Trzyma jacht w miejscu na dużej głębokości, gdzie zarzucenie kotwicy byłoby niemożliwe", "Holds the yacht in place in deep water where anchoring is impossible"]],
  ["both", "seaman", ["Stanie w dryfie wymaga…", "Heaving-to requires…"], ["Wykorzystania ułożenia więcej niż jednego żagla", "Using more than one sail set against each other"], ["Zrzucenia wszystkich żagli", "Dropping all sails"], ["Pozostawienie tylko jednego żagla", "Leaving only one sail up"]],
  ["both", "seaman", ["Odbijacze służą do…", "Fenders are for…"], ["Ochrony kadłuba przed uderzeniem", "Protecting the hull from impact"], ["Oznaczenia miejsca kotwicy", "Marking the anchor"], ["Odbicia bomu w przypadku maksymalnego poluzowania szota grota", "Stopping the boom when the mainsheet is fully eased"]],
  ["both", "seaman", ["Bosak służy do…", "A boathook is for…"], ["Chwytania cum i muringów", "Catching lines and mooring lines"], ["Zwiększenia siły przy wybieraniu szota", "More power when hauling a sheet"], ["Zabezpieczenia kokpitu przed uderzeniem masztu przy jego wyłamaniu", "Protecting the cockpit if the mast breaks"]],
  ["both", "seaman", ["Muring to lina…", "A lazy line is a line…"], ["Od stałego elementu na dnie w miejscach postoju jachtów", "From a fixed ground anchor at berths"], ["Z kei do burty", "From the quay to the side"], ["Od kotwicy jachtu", "From the yacht’s anchor"]],
  ["both", "seaman", ["Żagiel łopocze. Co to znaczy?", "The sail is flapping. What does it mean?"], ["Trzeba odpaść lub wybrać żagiel", "Bear away or sheet in"], ["Żagiel jest wybrany za mocno", "The sail is sheeted too hard"], ["Fał jest za mocno napięty", "The halyard is too tight"]],
  ["both", "seaman", ["Po co szpring przy odchodzeniu od kei?", "Why use a spring when leaving a quay?"], ["Pracując na nim, odsuwasz dziób lub rufę", "Working against it swings the bow or stern out"], ["Żeby jacht szybciej nabrał prędkości", "To gather speed faster"], ["Żeby dociągnąć jacht do kei", "To pull the yacht onto the quay"]],
  ["both", "seaman", ["Jak podchodzisz do miejsca kotwiczenia?", "How do you approach an anchorage?"], ["Pod wiatr, powoli", "Into the wind, slowly"], ["Z wiatrem, powoli", "Downwind, slowly"], ["Bokiem do wiatru", "Beam to the wind"]],
  ["both", "seaman", ["Ile łańcucha wydajesz w celu zakotwiczenia jachtu?", "How much chain do you let out to anchor the yacht?"], ["3–5 głębokości", "3–5 times the depth"], ["8–10 głębokości", "8–10 times the depth"], ["1–2 głębokości", "1–2 times the depth"]],
  ["both", "seaman", ["Jak sprawdzisz, czy kotwica trzyma?", "How do you check the anchor is holding?"], ["Obserwuję prędkość jachtu względem ziemi (SOG)", "Watch the speed over ground (SOG)"], ["Patrzę, czy łańcuch jest luźny", "See if the chain is slack"], ["Obserwuję wskaźnik wiatru", "Watch the wind indicator"]],
  ["both", "seaman", ["Zanurzenie to odległość od linii wody do…", "Draught is the distance from the waterline to…"], ["Najniższego punktu kila", "The lowest point of the keel"], ["Dna akwenu", "The seabed"], ["Miejsca połączenia kila z kadłubem", "The keel-to-hull joint"]],
  ["both", "seaman", ["Wolna burta to wysokość od linii wody do…", "Freeboard is the height from the waterline to…"], ["Pokładu", "The deck"], ["Topu masztu", "The masthead"], ["Dna kilu", "The keel bottom"]],
  ["both", "seaman", ["Jak zmienia się przechył, gdy zluzujesz szot grota?", "How does heel change when you ease the mainsheet?"], ["Maleje", "It decreases"], ["Rośnie", "It increases"], ["Nie zmienia się", "It stays the same"]],
  ["both", "seaman", ["Martwy kąt to zakres kursów…", "The no-go zone is the range of headings…"], ["Zbyt ostrych do wiatru", "Too close to the wind"], ["Na których żagluga grozi obróceniem jednostki do góry dnem", "On which the boat risks capsizing"], ["Na półwietrze", "On a beam reach"]],
  ["both", "seaman", ["Wiatr pozorny to wiatr…", "Apparent wind is the wind…"], ["Odczuwany na płynącym jachcie", "Felt on a moving yacht"], ["Podawany w prognozie", "In the forecast"], ["Mierzony nad lądem", "Measured over land"]],
  ["both", "seaman", ["Jacht płynie bajdewindem i przyspiesza. Wiatr pozorny…", "A close-hauled yacht speeds up. The apparent wind…"], ["Wzmacnia się", "It strengthens"], ["Zmniejsza się", "It decreases"], ["Nie zmienia się", "It stays the same"]],
  ["both", "seaman", ["Cumowanie longside to cumowanie…", "Mooring alongside means…"], ["Burtą", "Side-to"], ["Rufą", "Stern-to"], ["Dziobem", "Bow-to"]],
  ["both", "seaman", ["„Klar do zwrotu” oznacza…", "“Ready about” means…"], ["Przygotuj się do przecięcia linii wiatru", "Prepare to put the bow through the wind"], ["Przygotuj się do kotwiczenia", "Prepare to anchor"], ["Przygotuj się do odpadnięcia", "Prepare to bear away"]],
  ["both", "seaman", ["Hals określa burta, na którą…", "The tack is named by the side towards which…"], ["Wieje wiatr", "The wind comes from"], ["Jest wystawiony ster", "The rudder is turned"], ["Jest zwrócony grot", "The mainsail faces"]],
  ["both", "seaman", ["Jak przechodzisz na dziób przy fali i postawionych żaglach?", "How do you go forward in a seaway with the sails up?"], ["Po nawietrznej, przypięty", "On the windward side, clipped on"], ["Po nawietrznej, bez przypinania", "On the windward side, unclipped"], ["Po zawietrznej, przypięty", "On the leeward side, clipped on"]],
  ["both", "seaman", ["Jak ustawić mały jacht do dużej fali od statku?", "How should a small yacht meet a big ship’s wash?"], ["Dziobem lub rufą", "Bow or stern on"], ["Burtą", "Beam on"], ["Pod kątem 45° burtą", "At 45° beam on"]],
  ["both", "seaman", ["Mila morska ma…", "A nautical mile is…"], ["1852 m", "1852 m"], ["1609 m", "1609 m"], ["1000 m", "1000 m"]],
  ["both", "seaman", ["Węzeł to…", "A knot is…"], ["1 Mm/h", "1 NM/h"], ["1 km/h", "1 km/h"], ["1 m/s", "1 m/s"]],
  ["both", "safety", ["Człowiek za burtą. Co robisz najpierw?", "Man overboard. What do you do first?"], ["Alarm, koło ratunkowe, obserwator", "Raise the alarm, throw a lifebuoy, post a spotter"], ["Alarm, zwrot przez rufę, obserwator", "Raise the alarm, gybe, post a spotter"], ["Koło ratunkowe, potem zrzucenie żagli", "Throw a lifebuoy, then drop the sails"]],
  ["both", "safety", ["Jak ogrzewasz osobę wyziębioną, wyciągniętą z wody?", "How do you rewarm a hypothermic casualty?"], ["Stopniowo, w pozycji poziomej", "Gradually, lying flat"], ["Jak najszybciej, poprzez nadmuch ciepłego powietrza np. z webasto", "As fast as possible, with warm air e.g. from the cabin heater"], ["Jak najszybciej, np. przez podanie gorącego napoju", "As fast as possible, e.g. with a hot drink"]],
  ["both", "safety", ["Czym gasisz płonący tłuszcz na kuchence?", "How do you put out burning fat on the stove?"], ["Kocem gaśniczym", "A fire blanket"], ["Wodą", "Water"], ["Mokrą ścierką z wodą", "A dripping wet cloth"]],
  ["both", "safety", ["Kamizelka ratunkowa w odróżnieniu od asekuracyjnej…", "Unlike a buoyancy aid, a lifejacket…"], ["Obraca nieprzytomnego twarzą do góry", "Turns an unconscious person face up"], ["Ma mniejszą wyporność", "Has less buoyancy"], ["Służy tylko do pływania na pontonie", "Is only for use in the dinghy"]],
  ["both", "safety", ["Ile kamizelek ratunkowych musi być na jachcie?", "How many lifejackets must there be on board?"], ["Po jednej dla każdej osoby", "One per person"], ["Po jednej na dwie osoby", "One per two people"], ["Tyle, ile miejsc w tratwie", "As many as liferaft places"]],
  ["both", "safety", ["Do czego wpinasz pasy przyczepione do kamizelki ratunkowej?", "What do you clip the tether on your lifejacket harness to?"], ["Do lifeliny wzdłuż pokładu", "To the jackstay along the deck"], ["Do szotów", "To the sheets"], ["Do relingu", "To the guardrail"]],
  ["both", "safety", ["Czerwona rakieta spadochronowa oznacza…", "A red parachute rocket means…"], ["Wzywanie pomocy", "Distress"], ["Ostrzeżenie przed mielizną", "A shoal warning"], ["Prośbę o pilota", "Pilot required"]],
  ["both", "safety", ["Pomarańczowy dym oznacza…", "Orange smoke means…"], ["Pozycję rozbitków", "The position of survivors"], ["Ostrzeżenie przed nurkami", "Divers down"], ["Prośbę o pilota", "Pilot required"]],
  ["both", "safety", ["Który sygnał wzywania pomocy dasz bez sprzętu?", "Which distress signal needs no equipment?"], ["Powolne podnoszenie i opuszczanie rąk", "Slowly raising and lowering the arms"], ["Machanie jedną ręką nad głową", "Waving one arm overhead"], ["Krzyżowanie rąk nad głową", "Crossing the arms overhead"]],
  ["both", "safety", ["Jacht wywrócił się i swobodnie dryfuje. Co robisz?", "The yacht has capsized and is drifting. What do you do?"], ["Zostaję przy jachcie w tratwie ratunkowej i wzywam pomoc", "Stay by the yacht in the liferaft and call for help"], ["Zdejmuję kamizelkę, żeby nurkować", "Take off the lifejacket to dive"], ["Płynę do brzegu", "Swim for the shore"]],
  ["both", "safety", ["Nieprzytomnego, który oddycha, układasz…", "An unconscious casualty who is breathing is placed…"], ["W pozycji bocznej ustalonej", "In the recovery position"], ["Na plecach z uniesionymi nogami", "On the back with legs raised"], ["W pozycji półsiedzącej", "Half sitting"]],
  ["both", "safety", ["Stosunek uciśnięć do oddechów przy RKO dorosłego to…", "The compression to breath ratio in adult CPR is…"], ["30 : 2", "30 : 2"], ["15 : 2", "15 : 2"], ["30 : 5", "30 : 5"]],
  ["both", "safety", ["Co pomaga na chorobę morską?", "What helps with seasickness?"], ["Przebywanie w kokpicie i patrzenie na horyzont", "Staying in the cockpit and watching the horizon"], ["Leżenie w kabinie dziobowej", "Lying in the forepeak"], ["Czytanie w mesie", "Reading in the saloon"]],
  ["both", "safety", ["Pali się komora silnika. Co robisz?", "The engine compartment is on fire. What do you do?"], ["Stop silnika i paliwa, gaśnica przez mały otwór", "Stop engine and fuel, extinguisher through a small opening"], ["Otwieram szeroko klapę i gaszę", "Open the hatch wide and fight it"], ["Polewam wodą z wiadra", "Throw buckets of water"]],
  ["both", "safety", ["Czujesz gaz w kabinie. Co robisz?", "You smell gas below. What do you do?"], ["Zakręcam butlę i wietrzę", "Turn off the bottle and ventilate"], ["Zapalam światło, by szukać wycieku", "Switch on a light to find the leak"], ["Włączam pompę zęzową i wentylator", "Run the bilge pump and fan"]],
  ["both", "safety", ["Gaz propan-butan na jachcie zbiera się…", "Propane/butane on a yacht collects…"], ["W zęzie – jest cięższy od powietrza", "In the bilge – it is heavier than air"], ["Pod sufitem – jest lżejszy od powietrza", "Under the deckhead – it is lighter than air"], ["Równomiernie w całej kabinie – ma gęstość taką samą jak powietrze", "Evenly throughout the cabin – it has the same density as air"]],
  ["both", "safety", ["Ostatni odcinek podejścia na żaglach do człowieka za burtą płyniesz…", "Under sail, the final approach to a person overboard is…"], ["Kursem ostrym, by wytracić prędkość", "Close-hauled, to lose speed"], ["Fordewindem, by szybciej dopłynąć", "On a run, to get there faster"], ["Półwiatrem z pełną prędkością", "On a beam reach at full speed"]],
  ["both", "safety", ["Kiedy przesiadasz się do tratwy?", "When do you take to the liferaft?"], ["Gdy jacht tonie lub płonie", "When the yacht sinks or burns"], ["Gdy ma przechył ponad 45°", "When heeling over 45°"], ["Gdy pojawia się przeciek", "When a leak appears"]],
  ["both", "safety", ["Jak sprawdzasz kamizelkę pneumatyczną?", "How do you check an inflatable lifejacket?"], ["Nabój CO2, wyzwalacz, szczelność", "CO2 cylinder, firing head, air-tightness"], ["Tylko datę produkcji", "Only the date of manufacture"], ["Odpalam nabój przed każdym rejsem", "Fire the cylinder before each trip"]],
  ["both", "safety", ["Kiedy zakładasz kamizelkę?", "When do you wear a lifejacket?"], ["Przy złej pogodzie, nocą, we mgle, na pontonie", "In bad weather, at night, in fog, in the dinghy"], ["Tylko gdy jacht tonie", "Only when sinking"], ["Tylko gdy nie umiesz pływać", "Only if you cannot swim"]],
  ["both", "safety", ["Pojawił się przeciek. Co robisz?", "A leak appears. What do you do?"], ["Szukam źródła, uszczelniam, pompuję", "Find the source, plug it, pump"], ["Od razu wsiadam do tratwy", "Take to the liferaft at once"], ["Tylko pompuję wodę", "Only pump"]],
  ["both", "safety", ["Drewniane kołki w wyposażeniu jachtu służą do…", "Tapered wooden plugs on board are for…"], ["Zatkania uszkodzonego otworu w kadłubie jachtu", "Plugging a damaged hole in the hull"], ["Klinowania steru", "Wedging the rudder"], ["Mocowania odbijaczy", "Securing fenders"]],
  ["both", "safety", ["Kto musi znać rozmieszczenie środków ratunkowych?", "Who must know where the safety gear is?"], ["Cała załoga", "The whole crew"], ["Kapitan i oficer", "Skipper and mate"], ["Tylko kapitan", "Only the skipper"]],
  ["both", "safety", ["Pierwsza pomoc przy oparzeniu to…", "First aid for a burn is…"], ["Chłodzenie wodą", "Cooling with water"], ["Posmarowanie tłustym kremem", "Applying greasy cream"], ["Przebicie pęcherzy", "Bursting the blisters"]],
  ["both", "safety", ["Przy silnym krwawieniu z rany…", "With heavy bleeding from a wound…"], ["Uciskasz ranę opatrunkiem", "Press a dressing on it"], ["Zakładasz luźny bandaż", "Apply a loose bandage"], ["Przemywasz ranę spirytusem lub wodą utlenioną", "Wash it with alcohol or hydrogen peroxide"]],
  ["both", "safety", ["Co chroni przed udarem słonecznym?", "What protects against heatstroke?"], ["Nakrycie głowy", "A hat"], ["Krem z filtrem", "Sun cream"], ["Zimne napoje", "Cold drinks"]],
  ["both", "safety", ["Gdzie powinna być gaśnica?", "Where should the extinguisher be?"], ["Zawsze w miejscu łatwo dostępnym", "Always somewhere easily reached"], ["W miejscu łatwo dostępnym podczas żeglugi. W porcie może być schowana w bakiście.", "Easily reached while sailing; in harbour it may be stowed in a locker."], ["W schowku dziobowym", "In the forepeak locker"]],
  ["both", "safety", ["Jak gasisz pożar instalacji elektrycznej?", "How do you fight an electrical fire?"], ["Odcinam prąd, gaśnica proszkowa lub CO2", "Isolate power, powder or CO2 extinguisher"], ["Polewam wodą", "Water"], ["Gaśnicą pianową bez odcinania prądu", "Foam extinguisher with the power on"]],
  ["both", "safety", ["Wiatr i fala gwałtownie rosną. Kiedy refujesz?", "Wind and sea are rising fast. When do you reef?"], ["Niezwłocznie", "Immediately"], ["Gdy wiatr osiągnie 7°B", "When the wind reaches Bft 7"], ["Gdy przechył przekroczy 30°", "When heel exceeds 30°"]],
  ["both", "safety", ["Jaki jest numer ratunkowy nad wodą (WOPR)?", "What is the water rescue (WOPR) number?"], ["601 100 100 lub 112", "601 100 100 or 112"], ["600 100 100 lub 112", "600 100 100 or 112"], ["601 200 200 lub 112", "601 200 200 or 112"]],
  ["sea", "safety", ["Którym słowem zaczyna się wezwanie w niebezpieczeństwie?", "Which word starts a distress call?"], ["MAYDAY", "MAYDAY"], ["PAN-PAN", "PAN-PAN"], ["SÉCURITÉ", "SÉCURITÉ"]],
  ["sea", "safety", ["Awaria silnika przy brzegu, bez zagrożenia życia, potrzebujesz holowania. Co nadajesz?", "Engine failure near the coast, no danger to life, you need a tow. What do you send?"], ["PAN-PAN", "PAN-PAN"], ["MAYDAY", "MAYDAY"], ["SÉCURITÉ", "SÉCURITÉ"]],
  ["sea", "safety", ["Którym słowem zaczyna się ostrzeżenie nawigacyjne?", "Which word starts a navigational warning?"], ["SÉCURITÉ", "SÉCURITÉ"], ["PAN-PAN", "PAN-PAN"], ["MAYDAY", "MAYDAY"]],
  ["sea", "safety", ["Ile razy mówi się MAYDAY na początku wezwania?", "How many times is MAYDAY said at the start?"], ["Trzy", "Three"], ["Dwa", "Two"], ["Jeden", "One"]],
  ["sea", "safety", ["Na jakim kanale wysyła się alarm DSC?", "On which channel is a DSC alert sent?"], ["70", "70"], ["16", "16"], ["13", "13"]],
  ["sea", "safety", ["Po alarmie DSC MAYDAY głosem nadajesz na kanale…", "After a DSC alert, the MAYDAY voice call goes on channel…"], ["16", "16"], ["70", "70"], ["6", "6"]],
  ["sea", "safety", ["Jak długo trzymasz przycisk DISTRESS?", "How long do you hold the DISTRESS button?"], ["Ok. 5 s", "About 5 s"], ["Ok. 1 s", "About 1 s"], ["Ok. 30 s", "About 30 s"]],
  ["sea", "safety", ["MMSI to…", "An MMSI is…"], ["9-cyfrowy numer stacji radiowej", "A 9-digit radio station number"], ["Numer rejestracyjny jachtu", "The yacht’s registration number"], ["Sygnał wywoławczy literowy", "A letter call sign"]],
  ["sea", "safety", ["AIS przekazuje…", "AIS transmits…"], ["Nazwę, pozycję, kurs i prędkość", "Name, position, course and speed"], ["Obraz radarowy", "The radar picture"], ["Prognozy pogody", "Weather forecasts"]],
  ["sea", "safety", ["„Seelonce Mayday” oznacza…", "“Seelonce Mayday” means…"], ["Ciszę radiową – trwa akcja ratunkowa", "Radio silence – distress in progress"], ["Koniec akcji ratunkowej", "Distress over"], ["Powtórzenie wezwania MAYDAY", "A MAYDAY relay"]],
  ["sea", "safety", ["„Seelonce Feenee” oznacza…", "“Seelonce Feenee” means…"], ["Koniec ciszy radiowej", "Radio silence lifted"], ["Początek ciszy radiowej", "Radio silence imposed"], ["Przekazanie wezwania", "A MAYDAY relay"]],
  ["sea", "safety", ["Odebrałeś MAYDAY od statku w pobliżu. Jak potwierdzasz?", "You hear a MAYDAY from a nearby vessel. How do you acknowledge?"], ["„… RECEIVED MAYDAY”", "“… RECEIVED MAYDAY”"], ["„… ROGER MAYDAY”", "“… ROGER MAYDAY”"], ["„… MAYDAY RELAY”", "“… MAYDAY RELAY”"]],
  ["sea", "safety", ["Jaką moc wybierasz do rozmowy z jachtem w porcie?", "Which power do you use to call a yacht in harbour?"], ["1 W", "1 W"], ["25 W", "25 W"], ["5 W", "5 W"]],
  ["sea", "safety", ["Co robi EPIRB po uruchomieniu?", "What does an EPIRB do when activated?"], ["Wysyła alarm z pozycją przez satelity", "Sends an alert with position via satellite"], ["Wysyła MAYDAY na kanale 16", "Sends MAYDAY on channel 16"], ["Pokazuje echo na radarze ratowników", "Shows on rescuers’ radar"]],
  ["sea", "safety", ["Do czego służy SART?", "What is a SART for?"], ["Pokazuje ratownikom pozycję tratwy z bliska", "Shows rescuers the liferaft at close range"], ["Wysyła alarm przez satelity", "Sends an alert via satellite"], ["Do łączności głosowej z tratwy", "Voice calls from the raft"]],
  ["sea", "safety", ["Na jakiej częstotliwości nadaje EPIRB alarm do satelitów?", "On which frequency does an EPIRB alert satellites?"], ["406 MHz", "406 MHz"], ["121,5 MHz", "121.5 MHz"], ["156,8 MHz", "156.8 MHz"]],
  ["sea", "safety", ["Gdzie znajdziesz godziny prognoz dla żeglugi?", "Where do you find shipping forecast times?"], ["W spisie radiostacji lub almanachu", "In a list of radio signals or almanac"], ["Na mapie morskiej", "On the chart"], ["W spisie świateł", "In the list of lights"]],
  ["both", "meteo", ["Jak krąży wiatr wokół niżu na półkuli północnej?", "How does wind circulate round a low in the northern hemisphere?"], ["Przeciwnie do wskazówek zegara, do środka", "Anticlockwise, inwards"], ["Zgodnie ze wskazówkami zegara, do środka", "Clockwise, inwards"], ["Przeciwnie do wskazówek zegara, od środka", "Anticlockwise, outwards"]],
  ["both", "meteo", ["Jak krąży wiatr wokół wyżu na półkuli północnej?", "How does wind circulate round a high in the northern hemisphere?"], ["Zgodnie ze wskazówkami zegara, od środka", "Clockwise, outwards"], ["Przeciwnie do wskazówek zegara, od środka", "Anticlockwise, outwards"], ["Zgodnie ze wskazówkami zegara, do środka", "Clockwise, inwards"]],
  ["both", "meteo", ["Stoisz plecami do wiatru. Gdzie jest centrum niżu (półkula północna)?", "You stand with your back to the wind. Where is the centre of the low (northern hemisphere)?"], ["Po lewej", "On the left"], ["Po prawej", "On the right"], ["Przed Tobą", "Ahead of you"]],
  ["both", "meteo", ["Izobary blisko siebie oznaczają…", "Closely spaced isobars mean…"], ["Silny wiatr", "Strong wind"], ["Słaby wiatr", "Light wind"], ["Opady", "Rain"]],
  ["both", "meteo", ["Po przejściu frontu chłodnego wiatr…", "After a cold front passes the wind…"], ["Skręca w prawo, ciśnienie rośnie", "Veers and pressure rises"], ["Cofa się, ciśnienie spada", "Backs and pressure falls"], ["Słabnie do ciszy na kilka dni", "Dies to calm for days"]],
  ["both", "meteo", ["W wyżu zwykle jest…", "In a high there is usually…"], ["Pogodnie i słaby wiatr", "Fair weather and light wind"], ["Silny wiatr i deszcz", "Strong wind and rain"], ["Mżawka i zachmurzenie", "Drizzle and overcast"]],
  ["both", "meteo", ["Nadciąga Cb z wałem szkwałowym. Co robisz?", "A Cb with a squall line approaches. What do you do?"], ["Refuję lub zrzucam żagle", "Reef or drop the sails"], ["Stawiam więcej żagli", "Set more sail"], ["Płynę pod chmurę, by ją ominąć", "Sail under the cloud to dodge it"]],
  ["both", "meteo", ["Szybki spadek ciśnienia zapowiada…", "A rapid pressure fall foretells…"], ["Silny wiatr", "Strong wind"], ["Ładną pogodę", "Fair weather"], ["Mgłę", "Fog"]],
  ["both", "meteo", ["Bryza morska wieje…", "A sea breeze blows…"], ["W dzień od morza", "By day, from the sea"], ["W nocy od morza", "At night from the sea"], ["W dzień od lądu", "By day, from the land"]],
  ["both", "meteo", ["Szkwał to…", "A squall is…"], ["Nagły, krótki, silny wzrost wiatru", "A sudden, short, strong increase in wind"], ["Stały silny wiatr przez kilka godzin", "A steady strong wind for hours"], ["Nagła cisza przed burzą", "A sudden calm before a storm"]],
  ["both", "meteo", ["Mgła adwekcyjna powstaje, gdy…", "Advection fog forms when…"], ["Wilgotne powietrze napływa nad zimną wodę", "Moist air flows over cold water"], ["Wilgotne powietrze unosi się pionowo nad lądem i ochładza", "Moist air rises over land and cools"], ["Zimne powietrze napływa nad ciepłą wodę", "Cold air flows over warm water"]],
  ["both", "meteo", ["Front zokludowany powstaje, gdy…", "An occluded front forms when…"], ["Front chłodny dogoni ciepły", "A cold front catches a warm front"], ["Front ciepły dogoni chłodny", "A warm front catches a cold front"], ["Front się zatrzyma", "A front stops moving"]],
  ["both", "meteo", ["Cirrusy widoczne na niebie oznaczają…", "Cirrus clouds in the sky mean…"], ["Pogorszenie pogody za 12–24 h", "Worse weather in 12–24 h"], ["Długą ładną pogodę", "Long fair weather"], ["Burzę w ciągu godziny", "A storm within an hour"]],
  ["both", "meteo", ["Ciśnienie na mapach synoptycznych podaje się w…", "Pressure on weather maps is in…"], ["hPa", "hPa"], ["mmHg", "mmHg"], ["kPa", "kPa"]],
  ["both", "meteo", ["Średnie ciśnienie na poziomie morza to ok.…", "Mean sea-level pressure is about…"], ["1013 hPa", "1013 hPa"], ["1000 hPa", "1000 hPa"], ["1033 hPa", "1033 hPa"]],
  ["both", "meteo", ["Wiatr wieje od zalesionego brzegu jeziora. Czego się spodziewasz?", "The wind blows off a wooded lake shore. What do you expect?"], ["Porywów i zmian kierunku", "Gusts and wind shifts"], ["Równego wiatru", "A steady wind"], ["Ciszy przy samym brzegu", "Calm right by the shore"]],
  ["both", "meteo", ["Wał szkwałowy pod Cb zapowiada…", "A roll cloud under a Cb foretells…"], ["Gwałtowny wiatr", "A violent wind"], ["Mgłę", "Fog"], ["Koniec burzy", "The end of the storm"]],
  ["sea", "rules", ["Statek o napędzie mechanicznym widzisz od rufy. Jakie światło widzisz?", "You see a power-driven vessel from astern. Which light do you see?"], ["Białe rufowe", "The white stern light"], ["Białe masztowe", "The white masthead light"], ["Białe rufowe i żółte", "White stern and yellow"]],
  ["sea", "rules", ["Ile świateł masztowych ma statek o napędzie mechanicznym o długości 50 m i więcej?", "How many masthead lights does a power-driven vessel of 50 m or more show?"], ["Dwa", "Two"], ["Trzy", "Three"], ["Jedno", "One"]],
  ["sea", "rules", ["Statek o napędzie mechanicznym < 12 m może zamiast masztowego i rufowego nieść…", "A power-driven vessel < 12 m may instead of masthead and stern lights show…"], ["Jedno białe dookólne i burtowe", "One white all-round and sidelights"], ["Tylko burtowe", "Sidelights only"], ["Dwa białe w pionie", "Two whites in a line"]],
  ["sea", "rules", ["Co nosi w dzień statek na kotwicy?", "What does a vessel at anchor show by day?"], ["Jedną czarną kulę", "One black ball"], ["Dwie czarne kule", "Two black balls"], ["Czarny stożek", "A black cone"]],
  ["sea", "rules", ["Co nosi w dzień statek niezdolny do manewrowania?", "What does a vessel not under command show by day?"], ["Dwie czarne kule w pionie", "Two black balls in a line"], ["Trzy czarne kule w pionie", "Three black balls in a line"], ["Kula – romb – kula (czarne)", "Ball – diamond – ball (black)"]],
  ["sea", "rules", ["Co nosi w dzień statek na mieliźnie?", "What does a vessel aground show by day?"], ["Trzy kule w pionie (czarne)", "Three balls in a line (black)"], ["Walec (czarny)", "A cylinder (black)"], ["Dwie kule w pionie (czarne)", "Two balls in a line (black)"]],
  ["sea", "rules", ["Co nosi w dzień statek ograniczony zanurzeniem?", "What does a vessel constrained by her draught show by day?"], ["Walec (czarny)", "A cylinder (black)"], ["Romb (czarny)", "A diamond (black)"], ["Trzy kule w pionie (czarne)", "Three balls in a line (black)"]],
  ["sea", "rules", ["Co nosi w dzień statek zajęty połowem?", "What does a vessel engaged in fishing show by day?"], ["Dwa stożki wierzchołkami do siebie (czarne)", "Two cones points together (black)"], ["Dwa stożki podstawami do siebie (czarne)", "Two cones bases together (black)"], ["Stożek wierzchołkiem w dół (czarny)", "A cone point down (black)"]],
  ["sea", "rules", ["Co nosi w dzień statek holujący, gdy hol przekracza 200 m?", "What does a towing vessel show by day when the tow exceeds 200 m?"], ["Romb (czarny)", "A diamond (black)"], ["Kulę (czarną)", "A ball (black)"], ["Walec (czarny)", "A cylinder (black)"]],
  ["both", "rules", ["Co nosi w dzień jacht żaglowy idący na silniku?", "What does a yacht under sail and power show by day?"], ["Stożek wierzchołkiem w dół", "A cone point down"], ["Stożek wierzchołkiem w górę", "A cone point up"], ["Kulę", "A ball"]],
  ["sea", "rules", ["Statek o napędzie mechanicznym w ograniczonej widzialności, w drodze, posuwający się po wodzie, daje co 2 minuty…", "A power-driven vessel making way in restricted visibility sounds every 2 minutes…"], ["Jeden długi", "One prolonged"], ["Dwa długie", "Two prolonged"], ["Długi i dwa krótkie", "One prolonged, two short"]],
  ["sea", "rules", ["Jacht żaglowy w ograniczonej widzialności daje co 2 minuty…", "A sailing yacht in restricted visibility sounds every 2 minutes…"], ["Długi i dwa krótkie", "One prolonged, two short"], ["Jeden długi", "One prolonged"], ["Dwa długie", "Two prolonged"]],
  ["sea", "rules", ["Jak długo trwa długi dźwięk?", "How long is a prolonged blast?"], ["4–6 s", "4–6 s"], ["1–2 s", "1–2 s"], ["8–10 s", "8–10 s"]],
  ["sea", "rules", ["Jak długo trwa krótki dźwięk?", "How long is a short blast?"], ["Ok. 1 s", "About 1 s"], ["Ok. 3 s", "About 3 s"], ["Ok. 0,2 s", "About 0.2 s"]],
  ["both", "seaman", ["Co to jest szpring dziobowy?", "What is a bow spring?"], ["Cuma z dziobu skośnie w kierunku śródokręcia", "A line from the bow led diagonally towards amidships"], ["Cuma z dziobu prostopadle do burty jachtu", "A line from the bow at right angles to the hull"], ["Cuma ze środokręcia w kierunku dziobu", "A line from amidships towards the bow"]],
  ["both", "seaman", ["Kiedy refujesz grota?", "When do you reef the mainsail?"], ["Gdy jacht za mocno się przechyla", "When the yacht heels too much"], ["Gdy wiatr słabnie", "When the wind drops"], ["Przed zwrotem przez sztag", "Before tacking"]],
  ["both", "seaman", ["Płetwa sterowa działa skutecznie, gdy…", "A rudder blade is effective when…"], ["Woda opływa płetwę", "Water flows past the blade"], ["Jacht stoi w miejscu", "The yacht is stationary"], ["Jacht ma przechył", "The yacht is heeling"]],
  ["both", "safety", ["Kto na jachcie odpowiada za bezpieczeństwo załogi?", "Who is responsible for the crew’s safety on board?"], ["Kapitan", "The skipper"], ["Armator jachtu", "The owner"], ["Każdy za siebie", "Everyone for themselves"]],
  ["both", "safety", ["Gdzie trzyma się koło ratunkowe?", "Where is the lifebuoy kept?"], ["Przy kokpicie, gotowe do rzutu", "By the cockpit, ready to throw"], ["W bakiście pod kokpitem", "In a cockpit locker"], ["W kabinie dziobowej", "In the forepeak"]],
  ["both", "meteo", ["Gdy ciśnienie rośnie po przejściu niżu, wiatr zwykle…", "When pressure rises after a low passes, the wind usually…"], ["Słabnie stopniowo", "Eases gradually"], ["Wzmaga się", "It increases"], ["Nagle cichnie do zera", "Drops suddenly to nothing"]],
  ["both", "meteo", ["Najsilniejsze porywy w burzy występują…", "The strongest gusts in a thunderstorm come…"], ["Tuż przed opadem, z wałem szkwałowym", "Just before the rain, with the squall line"], ["Po ustaniu opadu", "After the rain stops"], ["W środku opadu", "In the middle of the rain"]]
];

// ---------------- pula pytań ----------------
// Pozycja puli: { id, g (grupa w planie egzaminu), key (temat – bez dwóch pytań o to samo w jednym teście), make(r) → pytanie }
const P = (id, g, make, key = id) => ({ id, g, key, make });
const bankEntry = (b, i) => P(`b${i}`, b[1], (r) => { const [, topic, q, good, b1, b2] = b; return mk(r, topic, tx(q), tx(good), [tx(b1), tx(b2)]); });

// prawo drogi – sytuacje z hierarchii prawidła 18 (morze) i przepisów śródlądowych
const SEA_TYPES = [
  ['seaplane', ['wodnosamolot na wodzie', 'a seaplane on the water'], -1], ['cbd', ['statek ograniczony zanurzeniem', 'a vessel constrained by her draught'], 2.5],
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
        { explain: scope === 'inland' ? L('Na drogach śródlądowych małe jednostki ustępują pozostałym statkom; spośród małych – motorowe ustępują wszystkim, wiosłowe – żaglowym.', 'On inland waterways small craft give way to all other vessels; among small craft motor craft give way to all, rowing boats to sailing craft.') : L('Prawidło 18: statek o napędzie mechanicznym ustępuje żaglowcowi, żaglowiec – statkowi zajętemu połowem, a ten – statkom niezdolnym do manewrowania i o ograniczonej zdolności manewrowania; statkowi ograniczonemu zanurzeniem nie utrudnia się przejścia, a wodnosamolot trzyma się z dala od wszystkich.', 'Rule 18: power gives way to sail, sail to vessels fishing, and these to NUC and RAM vessels; a vessel constrained by her draught must not be impeded, and a seaplane keeps clear of all.') });
    }, `sit:${scope}:${[A[0], B[0]].sort().join(':')}`));
    if (scope === 'sea' && !['nuc', 'ram', 'cbd'].includes(A[0])) out.push(P(`sit:sea:${A[0]}:${B[0]}:o`, 'rules', (r) => mk(r, 'rules',
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
function charDesc(k, n, c, T0) {
  const col = tx(COLN[c]), T = String(T0).replace('.', L(',', '.'));
  if (k === 'Iso') return L(`${cap(col)}, izofazowe, okres ${T} s`, `${cap(col)}, isophase, period ${T} s`);
  const [name, one, many] = KIND[k];
  return n > 1 ? L(`${cap(col)}, ${tx(name).split(' ')[0]} – grupy po ${n} ${tx(many)}, okres ${T} s`, `${cap(col)}, ${tx(name).split(' ')[0]} – groups of ${n} ${tx(many)}, period ${T} s`)
    : L(`${cap(col)}, ${tx(name).split(' ')[0]} – pojedyncze ${tx(many)}, okres ${T} s`, `${cap(col)}, ${tx(name).split(' ')[0]} – single ${tx(many)}, period ${T} s`);
}
function lightChars() {
  const out = [], code = (k, n, c, T) => `${k}${n > 1 ? `(${n})` : ''}${c ? ' ' + c : ''} ${T}s`;
  const sets = [['Fl', [1, 2, 3, 4, 5], [2, 2.5, 3, 4, 5, 6, 7.5, 8, 9, 10, 12, 15, 20]], ['Oc', [1, 2, 3], [3, 4, 5, 6, 8, 10, 12, 15]], ['LFl', [1, 2], [5, 6, 8, 10, 12, 15]], ['Iso', [1], [2, 3, 4, 5, 6, 8, 10]]];
  for (const [k, ns, Ts] of sets) for (const n of ns) for (const c of ['', 'R', 'G', 'Y']) for (const T of Ts) {
    if (n * 1.5 >= T && k !== 'Iso') continue; // grupa musi się zmieścić w okresie
    out.push(P(`lc:${code(k, n, c, T)}`, 'mark', (r) => {
      const good = charDesc(k, n, c, T);
      const altK = k === 'Fl' ? 'Oc' : k === 'Oc' ? 'Fl' : k === 'LFl' ? 'Fl' : 'Oc';
      const altC = pick(r, ['', 'R', 'G', 'Y'].filter((x) => x !== c));
      const bad = [charDesc(altK, altK === 'Iso' ? 1 : Math.max(1, n), c, T), r() < 0.5 ? charDesc(k, n, altC, T) : charDesc(k, k === 'Iso' ? 1 : n === 1 ? 2 : n - 1, c, T === Ts[Ts.length - 1] ? Ts[Ts.length - 2] : Ts[Ts.length - 1])];
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
  // szybkobłyskowe, przemienne i alfabetem Morse'a
  const QK = { Q: [['szybkobłyskowe', 'quick'], ['ok. 60 błysków na minutę', 'about 60 flashes a minute']], VQ: [['bardzo szybkobłyskowe', 'very quick'], ['ok. 120 błysków na minutę', 'about 120 flashes a minute']] };
  const qDesc = (k, n, c, T) => { const col = cap(tx(COLN[c])); return n === 1 ? L(`${col}, ${QK[k][0][0]} – ciągłe błyski (${QK[k][1][0]})`, `${col}, ${QK[k][0][1]} – continuous (${QK[k][1][1]})`) : L(`${col}, ${QK[k][0][0]} – grupy po ${n} błyski, okres ${T} s`, `${col}, ${QK[k][0][1]} – groups of ${n} flashes, period ${T} s`); };
  for (const k of ['Q', 'VQ']) for (const c of ['', 'R', 'G', 'Y']) for (const [n, T] of [[1, 0], [2, 5], [3, 5], [3, 10], [4, 10], [6, 10], [6, 15], [9, 10], [9, 15], [2, 10]]) {
    if (k === 'Q' && n * 1.2 >= T && n > 1) continue;
    const cd = `${k}${n > 1 ? `(${n})` : ''}${c ? ' ' + c : ''}${T ? ` ${T}s` : ''}`, other = k === 'Q' ? 'VQ' : 'Q';
    out.push(P(`lq:${cd}`, 'mark', (r) => mk(r, 'marks', L(`Co oznacza charakterystyka światła „${cd}”?`, `What does the light characteristic “${cd}” mean?`), qDesc(k, n, c, T),
      [qDesc(other, n, c, T), qDesc(k, n, pick(r, ['', 'R', 'G', 'Y'].filter((x) => x !== c)), T), qDesc(k, n === 1 ? 3 : 1, c, n === 1 ? 10 : 0)])));
  }
  const ALN = { WR: ['białe i czerwone', 'white and red'], WG: ['białe i zielone', 'white and green'], RG: ['czerwone i zielone', 'red and green'] };
  for (const pair of Object.keys(ALN)) for (const T of [3, 4, 5, 6, 8, 10]) {
    const cd = `Al.${pair} ${T}s`, d = (pp, tt2) => L(`Przemienne – na zmianę ${tx(ALN[pp])}, okres ${tt2} s`, `Alternating – ${tx(ALN[pp])} in turn, period ${tt2} s`);
    out.push(P(`la:${cd}`, 'mark', (r) => mk(r, 'marks', L(`Co oznacza charakterystyka światła „${cd}”?`, `What does the light characteristic “${cd}” mean?`), d(pair, T),
      [d(pick(r, Object.keys(ALN).filter((x) => x !== pair)), T), L(`Stałe ${tx(ALN[pair])} w dwóch sektorach`, `Fixed ${tx(ALN[pair])} in two sectors`), L(`Błyskowe ${tx(COLN[pair[0] === 'W' ? '' : pair[0]])}, okres ${T} s`, `Flashing ${tx(COLN[pair[0] === 'W' ? '' : pair[0]])}, period ${T} s`)])));
  }
  for (const ch of ['A', 'U', 'D', 'K', 'N']) for (const T of [6, 8, 10, 12, 15]) {
    const cd = `Mo(${ch}) ${T}s`;
    out.push(P(`lm:${cd}`, 'mark', (r) => mk(r, 'marks', L(`Co oznacza charakterystyka światła „${cd}”?`, `What does the light characteristic “${cd}” mean?`), L(`Białe, błyski układające się w literę ${ch} alfabetu Morse'a, okres ${T} s`, `White, flashes forming the Morse letter ${ch}, period ${T} s`),
      [L(`Białe, ${ch === 'A' ? 'dwa' : 'trzy'} jednakowe błyski w grupie, okres ${T} s`, `White, ${ch === 'A' ? 'two' : 'three'} equal flashes in a group, period ${T} s`), L(`Światło widoczne tylko w sektorze ${ch}, okres ${T} s`, `A light visible only in sector ${ch}, period ${T} s`)])));
  }
  return out;
}

const n360 = (a) => ((Math.round(a) % 360) + 360) % 360, d3 = (a) => `${String(n360(a)).padStart(3, '0')}°`;
const sg = (a) => `${a > 0 ? '+' : a < 0 ? '−' : ''}${String(Math.abs(a)).replace('.', L(',', '.'))}°`;
const nm = (x, dec = 2) => `${String(Math.round(x * 10 ** dec) / 10 ** dec).replace('.', L(',', '.'))}`;


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
const ASPECTS = [['bow', 0, ['od dziobu', 'from ahead']], ['stern', 180, ['od rufy', 'from astern']], ['port', -60, ['od lewej burty', 'from the port side']], ['stbd', 60, ['od prawej burty', 'from the starboard side']],
  ['bowP', -25, ['z lewej strony, blisko dziobu', 'on the port bow']], ['bowS', 25, ['z prawej strony, blisko dziobu', 'on the starboard bow']],
  ['qP', -145, ['z lewej strony, od rufy', 'on the port quarter']], ['qS', 145, ['z prawej strony, od rufy', 'on the starboard quarter']]];

const SYMG = { danger: ['Niebezpieczeństwa', 'Dangers'], depth: ['Głębokości i dno', 'Depths and seabed'], tide: ['Pływy i prądy', 'Tides and currents'], area: ['Obszary i granice', 'Areas and limits'],
  aid: ['Światła i pomoce nawigacyjne', 'Lights and aids'], buoy: ['Pławy i znaki', 'Buoys and beacons'], land: ['Ląd, porty i punkty orientacyjne', 'Land, harbours and landmarks'], note: ['Oznaczenia i skróty', 'Notes and abbreviations'] };

// ---------- podchwytliwe odpowiedzi: najpierw podobne („z tej samej rodziny”), potem pozostałe ----------
const FAMILIES = [
  ['trawling', 'fishing', 'fishingGear', 'mineClear'], ['towing', 'towingLong', 'towingBig', 'towingBigLong', 'towingRam'],
  ['anchor', 'anchorLarge', 'anchor100', 'aground'], ['nuc', 'ram', 'ramObstruct', 'cbd', 'aground', 'mineClear'], ['power', 'powerLarge', 'pilot', 'sailing'],
  ['iTowing', 'iTowingDangerous', 'iDangerous'], ['iWork', 'iWorkWash'], ['iFerryPriority', 'iSmall', 'iDangerous'],
  ['dFishing', 'dFishingGear', 'dMotorSail'], ['dTowing', 'dTowingRam', 'dRam'], ['dNuc', 'dAground', 'dAnchor', 'dMineClear'], ['dRam', 'dRamObstruct', 'dTowingRam', 'dCbd'], ['dPower', 'dCbd', 'dMotorSail'],
  ['dITowing', 'dITowingDangerous', 'dIDangerous'], ['dIWork', 'dIWorkWash'], ['dIFerryPriority', 'dIPriority', 'dIDangerous'],
  ['epirb', 'sart', 'vhf'], ['raft', 'jacket', 'harness'], ['extinguisher', 'flares', 'firstaid']
];
const famOf = (id) => new Set(FAMILIES.filter((f) => f.includes(id)).flat());
// kandydaci na błędne odpowiedzi: najpierw podobni (same), potem reszta – każda grupa w losowej kolejności
const similar = (r, list, good, isSame, key = (x) => x) => {
  const rest = list.filter((x) => key(x) !== key(good));
  return [...shuffle(r, rest.filter((x) => isSame(x))), ...shuffle(r, rest.filter((x) => !isSame(x)))];
};
const simVessel = (r, list, v) => similar(r, list, v, (x) => famOf(v.id).has(x.id), (x) => x.id);
// odległość edycyjna zapisów sygnałów (podobnie brzmiące sygnały jako błędne odpowiedzi)
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const simSignal = (r, list, s) => list.filter((x) => x.p !== s.p).map((x) => [lev(x.p, s.p) + r() * 0.9, x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
// krótkie wersje tekstów z danych
const shortName = (n) => tt(n).replace(/ – (drogi śródlądowe|inland waterways)$/i, '');
const firstSentence = (e) => e.split(/(?<!\b(?:np|ok|tzw|m|maks|min|godz|e\.g|approx))\.\s(?=[A-ZĄĆĘŁŃÓŚŹŻ„“])/)[0].replace(/\.$/, '');
const shortText = (e) => {
  let x = firstSentence(tt(e)).replace(/\s*\([^)]*\)/g, '').split(/ – „| – "|;/)[0];
  for (const sep of [' – ', ': ']) { const i = x.indexOf(sep); if (i > 24) x = x.slice(0, i); }
  return x.trim();
};


// krótkie opisy świateł i znaków dziennych do odpowiedzi
const SHORT = {
  power: ['Masztowe, burtowe, rufowe', 'Masthead, sidelights, stern light'],
  powerLarge: ['Dwa masztowe (tylne wyżej), burtowe, rufowe', 'Two masthead (aft higher), sidelights, stern'],
  sailing: ['Burtowe i rufowe, bez masztowego', 'Sidelights and stern, no masthead'],
  anchor: ['Jedno białe dookólne na dziobie', 'One white all-round forward'],
  anchorLarge: ['Dwa białe dookólne, przednie wyżej', 'Two white all-round, forward higher'],
  anchor100: ['Dwa białe dookólne i oświetlony pokład', 'Two white all-round and deck lights'],
  trawling: ['Zielone nad białym, burtowe, rufowe', 'Green over white, sidelights, stern'],
  fishing: ['Czerwone nad białym, burtowe, rufowe', 'Red over white, sidelights, stern'],
  fishingGear: ['Czerwone nad białym i białe od strony sieci', 'Red over white and a white towards the gear'],
  nuc: ['Dwa czerwone w pionie, burtowe, rufowe', 'Two reds in a line, sidelights, stern'],
  ram: ['Czerwone–białe–czerwone, masztowe, burtowe, rufowe', 'Red–white–red, masthead, sidelights, stern'],
  ramObstruct: ['Czerwone–białe–czerwone, z boków dwa czerwone i dwa zielone', 'Red–white–red, two reds and two greens at the sides'],
  mineClear: ['Trzy zielone dookólne, masztowe, burtowe, rufowe', 'Three green all-round, masthead, sidelights, stern'],
  cbd: ['Trzy czerwone w pionie, masztowe, burtowe, rufowe', 'Three reds in a line, masthead, sidelights, stern'],
  towing: ['Dwa masztowe w pionie, burtowe, rufowe, żółte', 'Two masthead in a line, sidelights, stern, yellow'],
  towingLong: ['Trzy masztowe w pionie, burtowe, rufowe, żółte', 'Three masthead in a line, sidelights, stern, yellow'],
  towingBig: ['Dwa masztowe w pionie i przednie, burtowe, rufowe, żółte', 'Two masthead in a line plus forward, sidelights, stern, yellow'],
  towingBigLong: ['Trzy masztowe w pionie i przednie, burtowe, rufowe, żółte', 'Three masthead in a line plus forward, sidelights, stern, yellow'],
  towingRam: ['Trzy masztowe, czerwone–białe–czerwone, burtowe, rufowe, żółte', 'Three masthead, red–white–red, sidelights, stern, yellow'],
  pilot: ['Białe nad czerwonym, burtowe, rufowe', 'White over red, sidelights, stern'],
  aground: ['Dwa białe kotwiczne i dwa czerwone w pionie', 'Two white anchor lights and two reds in a line'],
  iTowing: ['Dwa masztowe, burtowe, żółte rufowe; na barkach białe', 'Two masthead, sidelights, yellow stern; white on the barges'],
  iTowingDangerous: ['Jak holownik z zestawem, na barkach białe i niebieskie', 'As a towing convoy, white and blue on the barges'],
  iDangerous: ['Światła statku w drodze i jedno niebieskie', 'Under-way lights and one blue'],
  iFerryPriority: ['Dwa zielone nad białym, burtowe, rufowe', 'Two greens over white, sidelights, stern'],
  iWork: ['Od strony wolnej dwa zielone, od zamkniętej czerwone', 'Two greens on the open side, red on the closed side'],
  iWorkWash: ['Od strony wolnej czerwone nad białym, od zabronionej czerwone', 'Red over white on the open side, red on the closed side'],
  iSmall: ['Jedno białe dookólne', 'One white all-round'],
  dPower: ['Bez znaków', 'No shapes'], dAnchor: ['Jedna kula na dziobie', 'One ball forward'], dAground: ['Trzy kule w pionie', 'Three balls in a line'],
  dNuc: ['Dwie kule w pionie', 'Two balls in a line'], dRam: ['Kula – romb – kula', 'Ball – diamond – ball'], dCbd: ['Walec', 'A cylinder'],
  dFishing: ['Dwa stożki wierzchołkami do siebie', 'Two cones points together'], dFishingGear: ['Dwa stożki wierzchołkami do siebie i stożek w górę od strony sieci', 'Two cones points together and a cone up towards the gear'],
  dTowing: ['Romb na holowniku i na holowanym', 'A diamond on the tug and on the tow'], dTowingRam: ['Kula – romb – kula oraz romby na holowniku i holowanym', 'Ball – diamond – ball and diamonds on tug and tow'],
  dRamObstruct: ['Kula – romb – kula, z boków dwie kule i dwa romby', 'Ball – diamond – ball, two balls and two diamonds at the sides'], dMineClear: ['Trzy kule: na maszcie i na nokach rei', 'Three balls: at the mast and yardarms'],
  dMotorSail: ['Stożek wierzchołkiem w dół', 'A cone point down'],
  dITowing: ['Żółty walec w pasy, na holowanych żółte kule', 'A striped yellow cylinder, yellow balls on the tow'], dITowingDangerous: ['Żółty walec, na holowanych żółte kule i niebieskie stożki', 'A yellow cylinder, yellow balls and blue cones on the tow'],
  dIDangerous: ['Niebieski stożek wierzchołkiem w dół', 'A blue cone point down'], dIFerryPriority: ['Zielona kula nad białym walcem', 'A green ball over a white cylinder'],
  dIPriority: ['Czerwony trójkątny proporzec na dziobie', 'A red triangular pennant forward'], dIWork: ['Od strony wolnej dwa zielone romby, od zamkniętej czerwona kula', 'Two green diamonds on the open side, a red ball on the closed side'],
  dIWorkWash: ['Od strony wolnej flaga czerwono-biała, od zamkniętej czerwona', 'A red-and-white flag on the open side, a red flag on the closed side']
};
const shortOf = (v) => (SHORT[v.id] ? tx(SHORT[v.id]) : shortText(v.explain));


// Poprawki z przeglądu bazy (plik Word): pytania usunięte i pytania z poprawioną treścią (stała treść zamiast generowanej)
const EXCLUDE = new Set(["ds:extinguisher:0", "ds:firstaid:0", "ds:firstaid:1", "ds:harness:0", "ds:jacket:1", "ds:raft:1", "vc9", "vc10", "vc80", "vu9", "vu80", "bn0", "bn1", "bn3", "bn4", "bn5", "bn6", "bn7", "bn9", "bn10", "bn11", "by7", "cr:Cu", "cw:Ci", "ph5:0", "ph5:1", "ph5:2", "ph5:3", "ph5:4", "ph5:5", "ph5:6", "ph5:7", "ph5:10", "ph5:12", "ph5:13", "ph5:14", "ph5:19", "ph5:20", "ph5:22", "ph5:28", "ph5:36", "ph5:38", "ph5:51", "ph5:57", "ph5:70", "ph5:72", "ph5:88", "ph5:109", "cm:ed"]);
const OVERRIDE = {"ds:epirb:1": {"q": ["Który element wyposażenia łączy się z satelitami COSPAS-SARSAT?", "Which equipment communicates with COSPAS-SARSAT satellites?"], "opts": [["Nadajnik AIS", "An AIS transmitter"], ["Radiotelefon VHF z DSC", "VHF DSC radio"], ["Radiopława EPIRB", "EPIRB"]], "answer": 2}, "ds:epirb:2": {"q": ["Którego wyposażenia dotyczy informacja: „Tylko w niebezpieczeństwie – gdy grozi utrata życia lub jachtu: tonięcie, pożar poza kontrolą, opuszczanie jachtu.”", "Which equipment is this about: “Only in distress – when life or the yacht is at risk: sinking, fire out of control, abandoning ship.”"], "opts": [["Radiopława EPIRB 406", "EPIRB 406"], ["Radiotelefon VHF z DSC", "VHF DSC radio"], ["Nadajnik AIS", "An AIS transmitter"]], "answer": 0}, "ds:epirb:3": {"q": ["Którego wyposażenia dotyczy instrukcja: „Wyjmij z uchwytu, rozwiń antenę, przesuń osłonę i naciśnij ON – zacznie błyskać lampa.”", "Which equipment is this instruction for: “Take it out of the bracket, deploy the antenna, slide the cover and press ON – the lamp starts flashing.”"], "opts": [["Wbudowana radiostacja VHF z DSC", "Fixed VHF DSC radio"], ["Ręczna radiostacja VHF z DSC", "Handheld VHF DSC radio"], ["Radiopława EPIRB 406 MHz", "EPIRB 406 MHz"]], "answer": 2}, "ds:jacket:0": {"q": ["Którego wyposażenia dotyczy informacja: „…zawsze na pokładzie nocą, przy silnym wietrze i fali, we mgle, przy samotnej wachcie, w pontonie, a także zawsze, gdy każe kapitan.”", "Which equipment is this about: “…always on deck at night, in strong wind and waves, in fog, on solo watch, in the dinghy, and whenever the skipper says so.”"], "opts": [["Kamizelka ratunkowa", "A lifejacket"], ["Kamizelka asekuracyjna", "A buoyancy aid"], ["Tratwa ratunkowa", "Liferaft"]], "answer": 0}, "ds:vhf:3": {"q": ["Którego wyposażenia dotyczy instrukcja: „Podnieś osłonę i przytrzymaj DISTRESS ok. 5 s (jeśli zdążysz – najpierw wybierz rodzaj zagrożenia).”", "Which equipment is this instruction for: “Lift the cover and hold DISTRESS for about 5 s (if there is time, select the nature of distress first).”"], "opts": [["Transponder SART", "SART transponder"], ["Radiopława EPIRB", "EPIRB"], ["Radiotelefon VHF z DSC (stacjonarny)", "Fixed VHF DSC radio"]], "answer": 2}, "vc12": {"q": ["Który kanał VHF: Operacje portowe, VTS (ruch statków)?", "Which VHF channel: port operations, VTS?"], "opts": [["Kanał 72", "Channel 72"], ["Kanał 12", "Channel 12"], ["Kanał 10", "Channel 10"]], "answer": 1}, "vc14": {"q": ["Który kanał VHF: Operacje portowe, VTS (ruch statków)?", "Which VHF channel: port operations, VTS?"], "opts": [["Kanał 14", "Channel 14"], ["Kanał 13", "Channel 13"], ["Kanał 70", "Channel 70"]], "answer": 0}, "vc24": {"q": ["Który kanał VHF: Stacje brzegowe – korespondencja publiczna (duplex)?", "Which VHF channel: coast stations – public correspondence (duplex)?"], "opts": [["Kanał 14", "Channel 14"], ["Kanał 24", "Channel 24"], ["Kanał 10", "Channel 10"]], "answer": 1}, "vc67": {"q": ["Który kanał VHF: Łączność ze służbami SAR (Wielka Brytania i kraje skandynawskie)?", "Which VHF channel: communication with SAR services (UK and Scandinavia)?"], "opts": [["Kanał 16", "Channel 16"], ["Kanał 67", "Channel 67"], ["Kanał 80", "Channel 80"]], "answer": 1}, "vu6": {"q": ["Do czego służy kanał 6 VHF?", "What is VHF channel 6 used for?"], "opts": [["Statek–statek (operacje SAR)", "Intership (SAR operations)"], ["Statek–statek (operacje portowe)", "Intership (port operations)"], ["Bezpieczeństwo nawigacji „mostek–mostek”", "Bridge-to-bridge navigational safety"]], "answer": 0}, "vu13": {"q": ["Do czego służy kanał 13 VHF?", "What is VHF channel 13 used for?"], "opts": [["Bezpieczeństwo nawigacji „mostek–mostek”, manewry w portach", "Bridge-to-bridge navigational safety, manoeuvres in port"], ["Tylko DSC", "DSC only"], ["Operacje portowe i statek–statek", "Port operations and intership"]], "answer": 0}, "bh2": {"q": ["Jaka jest prawdopodobna wysokość fali na otwartym morzu przy wietrze 2°B?", "What is the probable wave height in the open sea at Beaufort 2?"], "opts": [["1 m", "1 m"], ["0 m", "0 m"], ["0,2 m", "0.2 m"]], "answer": 2}, "bh3": {"q": ["Jaka jest prawdopodobna wysokość fali na otwartym morzu przy wietrze 3°B?", "What is the probable wave height in the open sea at Beaufort 3?"], "opts": [["2 m", "2 m"], ["0,1 m", "0.1 m"], ["0,6 m", "0.6 m"]], "answer": 2}, "bh5": {"q": ["Jaka jest prawdopodobna wysokość fali na otwartym morzu przy wietrze 5°B?", "What is the probable wave height in the open sea at Beaufort 5?"], "opts": [["2 m", "2 m"], ["4 m", "4 m"], ["1 m", "1 m"]], "answer": 0}, "bh6": {"q": ["Jaka jest prawdopodobna wysokość fali na otwartym morzu przy wietrze 6°B?", "What is the probable wave height in the open sea at Beaufort 6?"], "opts": [["1 m", "1 m"], ["3 m", "3 m"], ["5 m", "5 m"]], "answer": 1}, "bh11": {"q": ["Jaka jest prawdopodobna wysokość fali na otwartym morzu przy wietrze 11°B?", "What is the probable wave height in the open sea at Beaufort 11?"], "opts": [["14 m", "14 m"], ["11,5 m", "11.5 m"], ["8 m", "8 m"]], "answer": 1}, "bn2": {"q": ["Jak można nazwać wiatr o sile 2°B?", "What can a Beaufort 2 wind be called?"], "opts": [["Umiarkowany wiatr", "Moderate breeze"], ["Cisza", "Calm"], ["Słaby wiatr", "Light wind"]], "answer": 2}, "bn8": {"q": ["Jak można nazwać wiatr o sile 8°B?", "What can a Beaufort 8 wind be called?"], "opts": [["Silny wiatr", "Strong wind"], ["Bardzo silny wiatr", "Near gale"], ["Sztorm", "Gale"]], "answer": 2}, "bn12": {"q": ["Jak można nazwać wiatr o sile 12°B?", "What can a Beaufort 12 wind be called?"], "opts": [["Bardzo silny sztorm", "Storm"], ["Gwałtowny sztorm", "Violent storm"], ["Huragan", "Hurricane"]], "answer": 2}, "by3": {"q": ["Co oznacza dla jachtu wiatr 3°B (Łagodny wiatr)?", "What does Beaufort 3 (Gentle breeze) mean for a yacht?"], "opts": [["Warunki skrajnie niebezpieczne.", "Extremely dangerous conditions."], ["Bardzo dobre warunki – jacht wyraźnie się przechyla.", "Very good sailing – the yacht heels noticeably."], ["Dobra żegluga; na małych jachtach pora pomyśleć o refowaniu żagli.", "Good sailing; small yachts start thinking about reefing the sails."]], "answer": 1}, "by4": {"q": ["Co oznacza dla jachtu wiatr 4°B (Umiarkowany wiatr)?", "What does Beaufort 4 (Moderate breeze) mean for a yacht?"], "opts": [["Spokojna żegluga na pełnych żaglach.", "Gentle sailing under full sail."], ["Drugi ref i mniejszy fok; kamizelki i szelki asekuracyjne.", "Second reef and a smaller jib; lifejackets and harnesses on."], ["Dobra żegluga, ostatni moment przed refowaniem.", "Good sailing, the last moment before reefing."]], "answer": 2}, "by5": {"q": ["Co oznacza dla jachtu wiatr 5°B (Dość silny wiatr)?", "What does Beaufort 5 (Fresh breeze) mean for a yacht?"], "opts": [["Trzeci ref i sztormfok; z portu wychodzi się tylko z konieczności.", "Third reef and storm jib; leave harbour only if you must."], ["Spokojne warunki, ale jacht wyraźnie się przechyla na kursach ostrych.", "Easy conditions, but the yacht heels noticeably close-hauled."], ["Pierwszy ref – dla początkujących załóg granica komfortu.", "First reef – the comfort limit for beginner crews."]], "answer": 2}, "by6": {"q": ["Co oznacza dla jachtu wiatr 6°B (Silny wiatr)?", "What does Beaufort 6 (Strong breeze) mean for a yacht?"], "opts": [["Dobra żegluga; na małych jachtach pora pomyśleć o refie.", "Good sailing; small yachts start thinking about reefing."], ["Drugi ref i mniejszy fok; kamizelki i szelki asekuracyjne.", "Second reef and a smaller jib; lifejackets and harnesses on."], ["Zrzucanie żagli celem uniknięcia obrócenia jednostki.", "Dropping the sails to avoid capsizing."]], "answer": 1}, "by9": {"q": ["Co oznacza dla jachtu wiatr 9°B (Silny sztorm)?", "What does Beaufort 9 (Strong gale) mean for a yacht?"], "opts": [["Czas na refowanie żagli.", "Time to reef."], ["Walka o bezpieczeństwo jachtu i załogi.", "Fighting for the safety of yacht and crew."], ["Spokojna żegluga na pełnych żaglach.", "Gentle sailing under full sail."]], "answer": 1}, "cl:Cb": {"q": ["Jakie to chmury? Ogromna, wysoka chmura o ciemnej podstawie; wierzchołek rozpływa się w płaskie kowadło.", "Which clouds are these? A huge, tall cloud with a dark base; the top spreads into a flat anvil."], "opts": [["Kłębiaste (Cu)", "Cumulus (Cu)"], ["Kłębiaste deszczowe (burzowe) (Cb)", "Cumulonimbus (Cb)"], ["Warstwowe deszczowe (Ns)", "Nimbostratus (Ns)"]], "answer": 1}, "sg:A.1": {"q": ["Co oznacza ten znak żeglugowy?", "What does this waterway sign mean?"], "opts": [["Zakaz cumowania do brzegu", "No making fast to the bank"], ["Zakaz uprawiania narciarstwa wodnego oraz holowania statków powietrznych za statkiem", "No water skiing or towing of airborne craft"], ["Zakaz przejścia", "No passage"]], "answer": 2}};
function applyReview(list) {
  return list.filter((e) => !EXCLUDE.has(e.id) && !/^ph5:/.test(e.id)).map((e) => {
    const ov = OVERRIDE[e.id];
    if (!ov) return e;
    return { ...e, make: (r) => { const base = e.make(r); const good = tx(ov.opts[ov.answer]); const opts = shuffle(r, ov.opts.map(tx)); return { ...base, q: tx(ov.q), options: opts, answer: opts.indexOf(good) }; } };
  });
}

// marks: rysunki znaków z warstwy UI – [{ scope, name, svg, look }]
export function buildPool(scope, marks = []) {
  const inScope = (s) => s === 'both' || s === scope;
  const out = [];
  BANK.forEach((b, i) => { if (inScope(b[0]) && b[1] !== 'nav') out.push(bankEntry(b, i)); }); // nawigację sprawdza zadanie nawigacyjne na końcu
  out.push(...situations(scope));
  // jednostki: model 3D → nazwa, nazwa → opis świateł / znaków
  for (const day of [false, true]) {
    const list = (day ? DAY_VESSELS : VESSELS).filter((v) => (scope === 'inland' ? v.inland : !v.inland));
    const g = day ? 'day' : 'lights';
    for (const v of list) {
      out.push(P(`v3:${v.id}`, g, (r) => mk(r, g, day ? L('Jaki statek nosi takie znaki dzienne?', 'Which vessel shows these day shapes?') : L('Jaki statek pokazuje takie światła nocą?', 'Which vessel shows these lights at night?'),
        shortName(v.name), simVessel(r, list, v).map((x) => shortName(x.name)), { explain: tt(v.explain), media: { kind: day ? 'day' : 'lights', id: v.id } }), v.id));
      out.push(P(`vx:${v.id}`, g, (r) => mk(r, g, day ? L(`Jakie znaki dzienne nosi: ${shortName(v.name)}?`, `What day shapes does this vessel show: ${shortName(v.name)}?`) : L(`Jakie światła niesie nocą: ${shortName(v.name)}?`, `What lights does this vessel show at night: ${shortName(v.name)}?`),
        shortOf(v), simVessel(r, list, v).map(shortOf), { explain: tt(v.explain) }), v.id));
    }
  }

  // co widać z danego kierunku (statki w drodze)
  {
    const list = VESSELS.filter((v) => (scope === 'inland' ? v.inland : !v.inland) && v.moving);
    const lightsOf = (v) => v.lights((v.L[0] + v.L[1]) / 2, () => 0.5, { gearSide: 'starboard' });
    for (const v of list) for (const [ak, rel, an] of ASPECTS) {
      const good = describeLights(lightsOf(v), rel);
      out.push(P(`va:${v.id}:${ak}`, 'lights', (r) => {
        // podobne: ten sam statek z innego kierunku i statki z tej samej rodziny z tego kierunku
        const bad = [...shuffle(r, [...ASPECTS.map((a) => describeLights(lightsOf(v), a[1])), ...simVessel(r, list, v).slice(0, 3).map((x) => describeLights(lightsOf(x), rel))])];
        return mk(r, 'lights', L(`Nocą widzisz ${tx(an)}: ${shortName(v.name)}. Jakie światła widzisz?`, `At night you see ${tx(an)}: ${shortName(v.name)}. Which lights do you see?`), good, bad, { explain: tt(v.explain) });
      }, v.id));
      const twins = list.filter((x) => x !== v && describeLights(lightsOf(x), rel) === good);
      if (!twins.length && !/Nie widać|No lights/.test(good)) out.push(P(`vr:${v.id}:${ak}`, 'lights', (r) => mk(r, 'lights',
        L(`Nocą widzisz statek ${tx(an)} i jego światła: ${good.charAt(0).toLowerCase() + good.slice(1)}. Jaki to statek?`, `At night you see a vessel ${tx(an)} showing: ${good.charAt(0).toLowerCase() + good.slice(1)}. What is it?`),
        shortName(v.name), simVessel(r, list, v).map((x) => shortName(x.name)), { explain: tt(v.explain) }), v.id));
    }
  }
  // sygnały dźwiękowe: zapis → znaczenie, znaczenie → zapis
  const sigs = SIGNALS.filter((s) => (scope === 'inland' ? s.ctx === 'inland' : s.ctx !== 'inland'));
  const ctxQ = (s) => (s.ctx === 'fog' ? L(' (ograniczona widzialność)', ' (restricted visibility)') : '');
  for (const s of sigs) {
    const same = sigs.filter((x) => x.ctx === s.ctx && x.p !== s.p);
    out.push(P(`sn:${s.id}`, 'sound', (r) => mk(r, 'sounds', L(`Co oznacza ten sygnał dźwiękowy${ctxQ(s)}?`, `What does this sound signal mean${ctxQ(s)}?`), tt(s.name), simSignal(r, same, s).map((x) => tt(x.name)), { explain: tt(s.desc), media: { kind: 'sound', p: s.p } }), s.id));
    out.push(P(`sp:${s.id}`, 'sound', (r) => mk(r, 'sounds', L(`Jakim sygnałem dźwiękowym statek informuje: „${tt(s.name)}”${ctxQ(s)}?`, `Which sound signal means “${tt(s.name)}”${ctxQ(s)}?`), notation(s.p), [...simSignal(r, same, s).map((x) => x.p), s.p + (s.p.endsWith('S') ? 'S' : 'L'), s.p.length > 1 ? s.p.slice(0, -1) : 'S'].filter((p) => p !== s.p).map(notation), { explain: `${tt(s.desc)} (• ${L('krótki', 'short')}, — ${L('długi', 'long')})` }), s.id));
  }
  if (scope === 'sea') {
    for (const s of CHART_SYMBOLS) {
      const grp = CHART_SYMBOLS.filter((x) => x.grp === s.grp && x !== s), pool = grp.length >= 2 ? grp : CHART_SYMBOLS.filter((x) => x !== s);
      out.push(P(`cs:${s.id}`, 'chart', (r) => mk(r, 'chart', L('Co oznacza ten symbol na mapie morskiej?', 'What does this chart symbol mean?'), s.name(), shuffle(r, pool).map((x) => x.name()), { explain: s.mean(), media: { kind: 'svg', svg: symbolSVG(s, 240, 165) } }), s.id));
      out.push(P(`ci:${s.id}`, 'chart', (r) => mk(r, 'chart', L(`Który symbol oznacza na mapie: ${s.name()}?`, `Which chart symbol means: ${s.name()}?`), `@svg:${symbolSVG(s, 160, 110)}`, shuffle(r, pool).map((x) => `@svg:${symbolSVG(x, 160, 110)}`), { explain: s.mean() }), s.id));
      out.push(P(`cm:${s.id}`, 'chart', (r) => mk(r, 'chart', L('Co oznacza na mapie?', 'What does this mean on a chart?'), s.mean(), shuffle(r, pool).map((x) => x.mean()), { media: { kind: 'svg', svg: symbolSVG(s, 240, 165) } }), s.id));
    }
    out.push(...lightChars());
    for (const k of ['N', 'E', 'S', 'W']) out.push(P(`mr:${k}`, 'mark', (r) => markRule(r, k)));
  } else {
    for (const gr of SIGN_GROUPS) for (const [code, pl, en] of gr.signs) {
      out.push(P(`sg:${code}`, 'sign', (r) => mk(r, 'signs', L('Co oznacza ten znak żeglugowy?', 'What does this waterway sign mean?'), L(pl, en), shuffle(r, gr.signs.filter((x) => x[0] !== code && x[1] !== pl)).map((x) => L(x[1], x[2])), { explain: `${code}: ${L(pl, en)}`, media: { kind: 'img', src: signImage(code) } }), code));
      out.push(P(`si:${code}`, 'sign', (r) => mk(r, 'signs', L(`Który znak żeglugowy oznacza: „${pl}”?`, `Which waterway sign means: “${en}”?`), `@img:${signImage(code)}`, shuffle(r, gr.signs.filter((x) => x[0] !== code && x[1] !== pl)).map((x) => `@img:${signImage(x[0])}`), { explain: `${code}: ${L(pl, en)}` }), code));
      out.push(P(`sk:${code}`, 'sign', (r) => mk(r, 'signs', L('Do której grupy znaków żeglugowych należy ten znak?', 'Which group of waterway signs does this sign belong to?'), L(gr.pl, gr.en), shuffle(r, SIGN_GROUPS.filter((x) => x !== gr)).map((x) => L(x.pl, x.en)), { explain: `${code}: ${L(pl, en)}`, media: { kind: 'img', src: signImage(code) } }), code));
    }
  }
  // znaki nawigacyjne z rysunkami
  const mks = marks.filter((m) => m.scope === scope);
  for (const m of mks) {
    out.push(P(`mk:${m.name}`, 'mark', (r) => mk(r, 'marks', L('Jaki to znak nawigacyjny?', 'What is this navigation mark?'), m.name, similar(r, mks, m, (x) => x.fam === m.fam, (x) => x.name).map((x) => x.name), { explain: m.look || '', media: { kind: 'svg', svg: m.svg } }), m.name));
    out.push(P(`mi:${m.name}`, 'mark', (r) => mk(r, 'marks', L(`Który rysunek przedstawia: ${m.name}?`, `Which picture shows: ${m.name}?`), `@svg:${m.svg}`, similar(r, mks, m, (x) => x.fam === m.fam, (x) => x.name).map((x) => `@svg:${x.svg}`), { explain: m.look || '' }), m.name));
    if (m.look) out.push(P(`ml2:${m.name}`, 'mark', (r) => mk(r, 'marks', L(`Jak wygląda: ${m.name}?`, `What does it look like: ${m.name}?`), m.look, similar(r, mks.filter((x) => x.look), m, (x) => x.fam === m.fam, (x) => x.name).map((x) => x.look)), m.name));
  }
  // meteorologia
  for (let f = 0; f <= 12; f++) {
    const b = beaufort(f), near = [f - 2, f - 1, f + 1, f + 2].filter((x) => x >= 0 && x <= 12);
    const nb = (r) => shuffle(r, near).map(beaufort);
    out.push(P(`bk${f}`, 'meteo', (r) => mk(r, 'meteo', L(`Jaka prędkość wiatru odpowiada sile ${f}°B?`, `What wind speed corresponds to Beaufort force ${f}?`), `${b.knText} kn`, nb(r).map((x) => `${x.knText} kn`), { explain: `${f}°B – ${b.name}: ${b.knText} kn.` }), `bft${f}`));
    out.push(P(`bs${f}`, 'meteo', (r) => mk(r, 'meteo', L(`Stan morza: „${b.seaText}” Jaka to siła wiatru?`, `Sea state: “${b.seaText}” What is the wind force?`), `${f}°B – ${b.name}`, nb(r).map((x) => `${x.f}°B – ${x.name}`), { explain: `${f}°B – ${b.name} (${b.knText} kn).` }), `bft${f}`));
    out.push(P(`br${f}`, 'meteo', (r) => mk(r, 'meteo', L(`Wiatr wieje z prędkością ${b.knText} kn. Jaka to siła w skali Beauforta?`, `The wind is ${b.knText} kn. What Beaufort force is it?`), `${f}°B`, nb(r).map((x) => `${x.f}°B`)), `bft${f}`));
    out.push(P(`bn${f}`, 'meteo', (r) => mk(r, 'meteo', L(`Jak nazywa się wiatr o sile ${f}°B?`, `What is Beaufort force ${f} called?`), b.name, nb(r).map((x) => x.name)), `bft${f}`));
    if (f >= 3 && f <= 10) out.push(P(`by${f}`, 'meteo', (r) => mk(r, 'meteo', L(`Co oznacza dla jachtu wiatr ${f}°B (${b.name})?`, `What does Beaufort ${f} (${b.name}) mean for a yacht?`), b.yacht, shuffle(r, [...nb(r), ...[2, 4, 6, 8, 11].map(beaufort)]).map((x) => x.yacht)), `bft${f}`));
    if (f >= 2 && f <= 11) out.push(P(`bh${f}`, 'meteo', (r) => mk(r, 'meteo', L(`Jaka jest prawdopodobna wysokość fali na otwartym morzu przy wietrze ${f}°B?`, `What is the probable wave height in the open sea at Beaufort ${f}?`), `${nm(b.h, 1)} m`, nb(r).filter((x) => x.h !== b.h).map((x) => `${nm(x.h, 1)} m`).concat([`${nm(b.h * 3, 1)} m`]).slice(0, 2)), `bft${f}`));
  }
  const cl = clouds(), lv = [...new Set(cl.map((x) => x.levelText))];
  for (const c of cl) {
    out.push(P(`cl:${c.id}`, 'meteo', (r) => mk(r, 'meteo', L(`Jakie to chmury? ${c.look}`, `Which clouds are these? ${c.look}`), `${c.name} (${c.id})`, similar(r, cl, c, (x) => x.level === c.level, (x) => x.id).map((x) => `${x.name} (${x.id})`), { explain: c.weather }), c.id));
    out.push(P(`cv:${c.id}`, 'meteo', (r) => mk(r, 'meteo', L(`Do którego piętra należą chmury „${c.name}” (${c.id})?`, `Which level do ${c.name} (${c.id}) clouds belong to?`), c.levelText, shuffle(r, lv.filter((x) => x !== c.levelText)).slice(0, 2)), c.id));
    out.push(P(`cw:${c.id}`, 'meteo', (r) => mk(r, 'meteo', L(`Co zapowiadają chmury „${c.name}” (${c.id})?`, `What do ${c.name} (${c.id}) clouds indicate?`), shortText(c.weather), similar(r, cl, c, (x) => x.level === c.level, (x) => x.id).map((x) => shortText(x.weather)), { explain: c.weather }), c.id));
    out.push(P(`cr:${c.id}`, 'meteo', (r) => mk(r, 'meteo', L(`Które chmury pasują do opisu: ${c.levelText}?`, `Which clouds match this description: ${c.levelText}?`), `${c.name} (${c.id})`, shuffle(r, cl.filter((x) => x.levelText !== c.levelText)).map((x) => `${x.name} (${x.id})`)), c.id));
    out.push(P(`cn:${c.id}`, 'meteo', (r) => mk(r, 'meteo', L(`Jaki jest skrót i łacińska nazwa chmur „${c.name}”?`, `What is the abbreviation for ${c.name} clouds?`), `${c.id} – ${c.latin}`, others(r, cl, c, (x) => x.id).map((x) => `${x.id} – ${x.latin}`)), c.id));
  }
  // zjawiska: różne warianty pytań (ziarno → treść)
  const seenPh = new Set();
  for (let i = 0; i < PHEN_COUNT; i++) for (let sd = 0; sd < 160; sd++) {
    const q = makePhenQuestion(7919 * i + sd, i);
    if (seenPh.has(q.prompt)) continue;
    seenPh.add(q.prompt);
    out.push(P(`ph${i}:${sd}`, 'meteo', (r) => { const good = q.options.find((o) => o.id === q.answer); return mk(r, 'meteo', q.prompt, good.label, shuffle(r, q.options.filter((o) => o.id !== q.answer)).map((o) => o.label), { explain: q.explain }); }, `ph${i}`));
  }
  // bezpieczeństwo: kanały VHF, urządzenia
  const ch = channels().filter((c) => !c.guard);
  const shortUse = (u) => u.split(/ – |;/)[0].replace(/\s*\([^)]*\)/g, '').trim();
  for (const c of ch) {
    out.push(P(`vu${c.ch}`, 'safety', (r) => mk(r, 'safety', L(`Do czego służy kanał ${c.ch} VHF?`, `What is VHF channel ${c.ch} used for?`), shortUse(c.use), shuffle(r, ch.filter((x) => shortUse(x.use) !== shortUse(c.use))).map((x) => shortUse(x.use)), { explain: `${c.ch} (${c.f} MHz): ${c.use}` }), `ch${c.ch}`));
    out.push(P(`vc${c.ch}`, 'safety', (r) => mk(r, 'safety', L(`Który kanał VHF: ${c.use}?`, `Which VHF channel: ${c.use}?`), `${L('Kanał', 'Channel')} ${c.ch}`, shuffle(r, ch.filter((x) => x.use !== c.use)).map((x) => `${L('Kanał', 'Channel')} ${x.ch}`)), `ch${c.ch}`));
  }
  const DEV = ['epirb', 'sart', 'vhf', 'raft', 'jacket', 'harness', 'extinguisher', 'flares', 'firstaid'];
  for (const id of DEV) {
    const d = deviceInfo(id), first = (txt) => firstSentence(txt) + '.';
    // pomijamy zdania, które same zdradzają nazwę urządzenia
    const ROOT = { epirb: /EPIRB|radiopław|beacon/i, sart: /SART|transponder/i, vhf: /VHF|radiotelefon|radio/i, raft: /tratw|liferaft|raft/i, jacket: /kamizelk|lifejacket/i, harness: /szel|lifelin|harness|tether/i, extinguisher: /gaśnic|extinguisher/i, flares: /rakiet|pochodni|flar|pirotechn|rocket|flare/i, firstaid: /apteczk|first.aid|kit/i }[id];
    const bad = (r) => similar(r, DEV, id, (x) => famOf(id).has(x)).map((x) => deviceInfo(x).name);
    if (!ROOT.test(first(d.short))) out.push(P(`dv:${id}`, 'safety', (r) => mk(r, 'safety', L(`Które wyposażenie opisuje zdanie: „${first(d.short)}”`, `Which equipment is described: “${first(d.short)}”`), d.name, bad(r), { explain: d.short }), id));
    (d.sections || []).forEach(([title, txt], k) => !ROOT.test(first(txt)) && !ROOT.test(title) && !/Obsługa|Kontrola|Przechowywanie|Maintenance|Check|Storage|Servic/i.test(title) && out.push(P(`ds:${id}:${k}`, 'safety', (r) => mk(r, 'safety', L(`${title} – którego wyposażenia dotyczy informacja: „${first(txt)}”`, `${title} – which equipment does this refer to: “${first(txt)}”`), d.name, bad(r), { explain: txt }), id)));
  }
  return applyReview(out);
}
function markRule(r, k) {
  const nm2 = { N: L('północny', 'north'), E: L('wschodni', 'east'), S: L('południowy', 'south'), W: L('zachodni', 'west') };
  const side = { N: L('Od północy', 'To the north of it'), E: L('Od wschodu', 'To the east of it'), S: L('Od południa', 'To the south of it'), W: L('Od zachodu', 'To the west of it') };
  const opp = { N: 'S', S: 'N', E: 'W', W: 'E' }[k], third = pick(r, Object.keys(side).filter((x) => x !== k && x !== opp));
  return mk(r, 'marks', L(`Z której strony mijasz znak kardynalny ${nm2[k]}?`, `On which side do you pass a ${nm2[k]} cardinal mark?`), side[k], [side[opp], side[third]], { explain: L('Znak kardynalny nazywa stronę, po której jest bezpieczna woda.', 'A cardinal mark is named after the side where the safe water is.') });
}

// Skład egzaminu: liczba pytań z każdej grupy (razem 75)
const PLAN = {
  sea: [['rules', 13], ['seaman', 10], ['safety', 10], ['lights', 9], ['day', 5], ['sound', 7], ['mark', 8], ['chart', 5], ['meteo', 8]],
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
  return shuffle(r, chosen).slice(0, EXAM.questions).map((e) => { const q = { id: e.id, ...e.make(r) }; delete q.explain; return q; });
}
export const poolSize = (scope, marks = []) => buildPool(scope, marks).length;
