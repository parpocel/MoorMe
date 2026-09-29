// Treść pomocy: sterowanie klawiaturą, praca na linach – używana w menu głównym i w symulacji
import { h } from './dom.js';

const KEYS = [
  ['W / S, ↑ / ↓', 'Manetka naprzód / wstecz (środek = luz)'], ['X', 'Luz (neutral)'], ['A / D, ← / →', 'Ster w lewo / w prawo'], ['R', 'Ster na zero'],
  ['Q / E', 'Ster strumieniowy dziobowy: dziób w lewo / w prawo'], ['Z / C', 'Ster strumieniowy rufowy: rufa w lewo / w prawo'],
  ['K / klik knagi', 'Nowa lina myszą: knaga → (kluza/półkluza) → poler'], ['Klik na linę', 'Menu okrągłe: wybieraj, wybierz, luzuj, luz, knaguj, oddaj (przytrzymaj wybieraj/luzuj – działa tylko podczas trzymania)'],
  ['O', 'Pogoda i pora dnia'], ['1 – 9', 'Wybierz linę'], ['B', 'Załóż wybraną linę / podejmij muring'], ['T (przytrzymaj)', 'Wybieraj linę'], ['U', 'Wybierz – wybieraj aż lina się napnie'], ['G (przytrzymaj)', 'Luzuj linę'], ['Y', 'Knaguj (zablokuj długość)'], ['N', 'Oddaj linę'],
  ['L', 'Załoga: zejdź na ląd / wróć na pokład'], ['P / Spacja', 'Pauza'], ['F', 'Kamera śledzi jacht'], ['V', 'Zmień widok (izo, blisko, z góry, za rufą, kapitan)'], ['Widok kapitana', 'Przeciągnij myszą – rozglądanie się, kółko – przybliżenie'],
  ['Mysz', 'LPM – przesuwanie, PPM – obrót kamery, kółko – zoom'], ['F11', 'Pełny ekran']
];

const LINES = [
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
