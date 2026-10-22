// Treść pomocy: sterowanie klawiaturą, praca na linach – używana w menu głównym i w symulacji
import { h } from './dom.js';

export const KEYS = [
  ['W / S, ↑ / ↓', 'Manetka naprzód / wstecz (środek = luz)'], ['X', 'Luz (neutral)'], ['A / D, ← / →', 'Ster w lewo / w prawo'], ['R', 'Ster na zero'],
  ['Q / E', 'Ster strumieniowy dziobowy: dziób w lewo / w prawo'], ['Z / C', 'Ster strumieniowy rufowy: rufa w lewo / w prawo'],
  ['K / klik knagi', 'Nowa lina myszą: knaga → (kluza/półkluza) → poler'], ['Klik na linę', 'Menu okrągłe: wybieraj, wybierz, luzuj, luz, knaguj, oddaj (przytrzymaj wybieraj/luzuj – działa tylko podczas trzymania)'],
  ['O', 'Pogoda i pora dnia'], ['1 – 9', 'Wybierz linę'], ['B', 'Załóż wybraną linę / podejmij muring'], ['T (przytrzymaj)', 'Wybieraj linę'], ['U', 'Wybierz – wybieraj aż lina się napnie'], ['G (przytrzymaj)', 'Luzuj linę'], ['Y', 'Knaguj (zablokuj długość)'], ['N', 'Oddaj linę'],
  ['L', 'Załoga: zejdź na ląd / wróć na pokład'], ['P / Spacja', 'Pauza'], ['F', 'Kamera śledzi jacht'], ['V', 'Zmień widok (izo, blisko, z góry, za rufą, kapitan)'], ['Widok kapitana', 'Przeciągnij myszą – rozglądanie się, kółko – przybliżenie'],
  ['Mysz', 'LPM – przesuwanie, PPM – obrót kamery, kółko – zoom'], ['F11', 'Pełny ekran']
];

export const LINES = [
  ['Zakładanie liny', 'Kliknij knagę na jachcie, opcjonalnie kluzę lub półkluzę, a potem poler (dalbę, pal) na nabrzeżu. Rolę liny (dziobowa, rufowa, szpring, brest) program rozpozna sam z położenia polera. Jeśli poler jest poza zasięgiem, lina czeka w kolejce, a załoga założy ją sama, gdy jacht podejdzie.'],
  ['Na stałe i na biegowo', 'Na stałe: oko rzucasz na poler z pokładu (do ok. 3,4 m), zdjąć je może tylko załoga na lądzie. Na biegowo: lina okłada poler i wraca na jacht (potrzebny bliższy dostęp, ok. 1,5 m), oddasz ją z pokładu. Tryb zmienisz przyciskiem „⇄” na karcie liny.'],
  ['Wybieranie i luzowanie', 'Na karcie liny (lewy dolny róg) lub w menu kołowym po kliknięciu liny: Wybieraj (przytrzymaj – wybiera), Wybierz (wybiera samo do napięcia liny), Luzuj (popuszczanie), Luz (lina bez naciągu), Knaguj (zablokuj długość), Oddaj. Kabestan daje większą siłę, ale wybiera wolniej.'],
  ['Kolor liny', 'Zielona – luźna lub lekko napięta, żółta – wyraźnie napięta, czerwona – duży naciąg, blisko zerwania. Ten sam kolor ma pasek naciągu na karcie liny.'],
  ['Muring', 'Przy cumowaniu rufą lub dziobem z muringiem podejmij linkę pilotową z kei („Podejmij muring”), wybierz ją i zaknaguj. Oddany muring tonie – nie włączaj biegu, żeby nie złapać go na śrubę.'],
  ['Załoga', 'Kuba to kapitan, reszta załogi obsługuje liny. Gdy lina wymaga człowieka na lądzie, załoga schodzi sama; przyciskiem „Zejdź na ląd” (L) możesz to zrobić ręcznie. Czekającą linę można anulować przyciskiem „Anuluj”.'],
  ['Wskazówki', 'Śruba prawoskrętna na biegu wstecz ściąga rufę w lewo – wykorzystaj to przy cofaniu. Podwójne płetwy sterowe słabo działają bez prędkości – pomagaj sobie krótkim „kopnięciem” silnika lub sterem strumieniowym (przegrzewa się po ok. 2 minutach ciągłej pracy). Przygotuj liny i odbijacze przed podejściem.']
];

export function buildHelpContent() {
  return [
    h('h3', { class: 'help-h' }, 'Sterowanie'),
    h('div.help-grid', {}, KEYS.map(([k, d]) => [h('kbd', {}, k), h('span', {}, d)])),
    h('h3', { class: 'help-h' }, 'Praca na cumach'),
    ...LINES.map(([t, d]) => h('div.hint', {}, h('b', {}, t + '. '), d))
  ];
}

// ---------- Pomoc do trybu rejsu ----------
export const PASSAGE_KEYS = [
  ['W / S, ↑ / ↓', 'Manetka naprzód / wstecz (środek = luz)'], ['X', 'Luz (neutral)'], ['A / D, ← / →', 'Ster w lewo / w prawo (wyłącza autopilota)'], ['R', 'Ster na zero'],
  ['J', 'Autopilot: włącz / wyłącz utrzymanie kursu'], [', / .', 'Zadany kurs autopilota −1° / +1° (z Shift: ±10°)'],
  ['N', 'Mapa: północ u góry / kurs u góry'], ['+ / −', 'Przybliż / oddal kartplotter (także kółko myszy nad mapą)'],
  ['O', 'Pogoda i pora dnia'], ['P / Spacja', 'Pauza'], ['F', 'Kamera śledzi jacht'], ['V', 'Zmień widok (izo, blisko, z góry, za rufą, kapitan)'],
  ['Mysz', 'LPM – przesuwanie, PPM – obrót kamery, kółko – zoom'], ['F11', 'Pełny ekran']
];

export const PASSAGE_TEXT = [
  ['Cel rejsu', 'Przepłyń trasę po kolejnych waypointach (magenta na mapie i w 3D) aż do mety. Waypoint zalicza się po zbliżeniu na ok. 60 m. Kurs na najbliższy waypoint (BRG) i odchylenie od toru (XTE) widzisz w panelu po lewej oraz na tarczy kompasu.'],
  ['Trzymanie kursu', 'Skręcaj tak, aby kurs jachtu zgadzał się z BRG, a XTE było bliskie zera. Wiatr znosi jacht (dryf), więc kurs nad dnem (COG) może różnić się od kursu kompasowego. Autopilot trzyma tylko zadany kurs – o trasie decydujesz Ty.'],
  ['Znaki boczne (IALA A)', 'Płyniesz w kierunku wejścia do portu: czerwona beczka (znak lewy) ma zostać po lewej burcie, zielony stożek (znak prawy) – po prawej. Na mapie czerwony kwadrat i zielony trójkąt.'],
  ['Znaki boczne (IALA B)', 'W regionie B (obie Ameryki, Japonia, Korea, Filipiny) kolory są odwrócone: zielona beczka po lewej burcie, czerwony stożek po prawej („red right returning”). Kształty się nie zmieniają. Region wybierzesz w Ustawieniach.'],
  ['Znaki kardynalne', 'Żółto-czarne pławy wskazują, po której stronie przeszkody jest bezpieczna woda: północny – miń od północy (dwa stożki w górę), południowy – od południa (dwa w dół), wschodni – od wschodu (stożki podstawami do siebie), zachodni – od zachodu (wierzchołkami do siebie).'],
  ['Woda bezpieczna', 'Czerwono-biała kula z czerwoną kulką oznacza otwartą, bezpieczną wodę (np. początek toru). Możesz minąć ją z dowolnej strony.'],
  ['Odosobnione niebezpieczeństwo', 'Czarna pława z czerwonym pasem i dwiema czarnymi kulami stoi na skale lub mieliźnie. Omijaj ją szerokim łukiem (strefa ok. 75 m).'],
  ['Wrak i znaki szczególne', 'Niebiesko-żółta pława z krzyżem oznacza nowy wrak – trzymaj się z dala (ok. 120 m). Żółty znak z X wyznacza strefę specjalną (kabel, regaty) – nie wpływaj w nią.'],
  ['Mielizny i brzeg', 'Jasne plamy na wodzie i na mapie to mielizny. Wejście na mieliznę lub na ląd oraz zderzenie ze znakiem to poważne błędy. Głębokość pod stępką widzisz w panelu nawigacyjnym – czerwony ostrzega przed płyciznami.'],
  ['Ocena', 'Za odchylenie od trasy, znaki minięte z niewłaściwej strony, pominięte znaki, wejście w strefy zagrożeń, mieliznę i zderzenia odejmowane są punkty. Rejs można przyspieszyć przyciskami 2×, 4×, 8×.']
];

export function buildPassageHelpContent() {
  return [
    h('h3', { class: 'help-h' }, 'Sterowanie'),
    h('div.help-grid', {}, PASSAGE_KEYS.map(([k, d]) => [h('kbd', {}, k), h('span', {}, d)])),
    h('h3', { class: 'help-h' }, 'Nawigacja i znaki'),
    ...PASSAGE_TEXT.map(([t, d]) => h('div.hint', {}, h('b', {}, t + '. '), d))
  ];
}

