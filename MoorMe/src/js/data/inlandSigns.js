// Znaki żeglugowe na śródlądowych drogach wodnych – wzory i określenia dokładnie według
// załącznika nr 7 do przepisów żeglugowych na śródlądowych drogach wodnych (Dz.U. 2003 nr 212 poz. 2072, s. 14647–14665).
// Rysunki w src/assets/cevni/ są wycięte bezpośrednio z tekstu rozporządzenia (akt urzędowy – bez praw autorskich).
// [symbol, określenie znaku (PL, jak w rozporządzeniu), określenie (EN)]

export const SIGN_GROUPS = [
  {
    id: 'A', pl: 'A. Znaki zakazu', en: 'A. Prohibitory signs', signs: [
      ['A.1', 'Zakaz przejścia (znak ogólny): tablica lub czerwone światła lub czerwone flagi. Dwie tablice, dwa światła lub dwie flagi – jedna nad drugą – oznacza długotrwały zakaz przejścia', 'No passage (general sign): a board, red lights or red flags. Two boards, two lights or two flags, one above the other, mean a prolonged prohibition of passage'],
      ['A.2', 'Zakaz wyprzedzania', 'No overtaking'],
      ['A.3', 'Zakaz wyprzedzania; dotyczy tylko zestawów', 'No overtaking; applies to convoys only'],
      ['A.4', 'Zakaz mijania i wyprzedzania', 'No passing or overtaking'],
      ['A.5', 'Zakaz postoju (na kotwicy lub na cumach przy brzegu)', 'No berthing (at anchor or made fast to the bank)'],
      ['A.5.1', 'Zakaz postoju na szerokości określonej na znaku w metrach (od znaku)', 'No berthing within the width shown on the sign in metres (from the sign)'],
      ['A.6', 'Zakaz kotwiczenia, wleczenia kotwicy, łańcucha lub liny', 'No anchoring or dragging of anchors, chains or cables'],
      ['A.7', 'Zakaz cumowania do brzegu', 'No making fast to the bank'],
      ['A.8', 'Zakaz zawracania', 'No turning'],
      ['A.9', 'Zakaz wytwarzania fali', 'Do not create wash'],
      ['A.10', 'Zakaz przejścia poza skrajnią określoną tablicami (pod mostem, przez jaz)', 'No passage outside the area marked by the boards (under a bridge, through a weir)'],
      ['A.11', 'Zakaz przejścia – przygotować się do wejścia lub przejścia', 'No passage – prepare to enter or pass'],
      ['A.12', 'Zakaz ruchu statków o napędzie mechanicznym', 'No motorised vessels'],
      ['A.13', 'Zakaz ruchu statków używanych wyłącznie do uprawiania sportu lub rekreacji', 'No sport or pleasure craft'],
      ['A.14', 'Zakaz uprawiania narciarstwa wodnego oraz holowania statków powietrznych za statkiem', 'No water skiing or towing of airborne craft behind a vessel'],
      ['A.15', 'Zakaz ruchu statków żaglowych', 'No sailing vessels'],
      ['A.16', 'Zakaz ruchu statków, które nie są statkami o napędzie mechanicznym i żaglowym', 'No vessels other than motorised or sailing vessels'],
      ['A.17', 'Zakaz pływania na desce z żaglem', 'No sailboards'],
      ['A.18', 'Koniec strefy, w której małe statki używane wyłącznie do uprawiania sportu lub rekreacji mogły rozwijać duże prędkości', 'End of the zone where small sport or pleasure craft could travel at high speed'],
      ['A.19', 'Zakaz wodowania i wciągania statków na brzeg', 'No launching or beaching of vessels'],
      ['A.20', 'Zakaz ruchu skuterów wodnych', 'No water bikes']
    ]
  },
  {
    id: 'B', pl: 'B. Znaki nakazu', en: 'B. Mandatory signs', signs: [
      ['B.1', 'Nakaz ruchu w kierunku wskazanym przez znak', 'Proceed in the direction shown by the sign'],
      ['B.2a', 'Nakaz skierowania statku na tę stronę szlaku żeglownego, która leży z lewej strony burty', 'Move to the side of the fairway on your port side'],
      ['B.2b', 'Nakaz skierowania statku na tę stronę szlaku żeglownego, która leży z prawej strony burty', 'Move to the side of the fairway on your starboard side'],
      ['B.3a', 'Nakaz trzymania się tej strony szlaku żeglownego, która leży z lewej burty', 'Keep to the side of the fairway on your port side'],
      ['B.3b', 'Nakaz trzymania się tej strony szlaku żeglownego, która leży z prawej burty', 'Keep to the side of the fairway on your starboard side'],
      ['B.4a', 'Nakaz przejścia na tę stronę szlaku żeglownego, która leży z lewej burty', 'Cross the fairway to port'],
      ['B.4b', 'Nakaz przejścia na tę stronę szlaku żeglownego, która leży z prawej burty', 'Cross the fairway to starboard'],
      ['B.5', 'Nakaz zatrzymania statku w warunkach określonych przepisami', 'Stop as prescribed by the regulations'],
      ['B.6', 'Nakaz nieprzekraczania podanej na znaku prędkości w km/h', 'Do not exceed the speed shown (km/h)'],
      ['B.7', 'Nakaz nadania sygnału dźwiękowego', 'Give a sound signal'],
      ['B.8', 'Nakaz zachowania szczególnej ostrożności', 'Keep a particularly sharp lookout'],
      ['B.9a', 'Nakaz zachowania szczególnej ostrożności. Wyjście na główną drogę dozwolone, gdy nie zmusi to statków na tej drodze do zmiany kursu lub prędkości', 'Keep a sharp lookout. Entering the main waterway is allowed only if vessels on it will not have to change course or speed'],
      ['B.9b', 'Nakaz zachowania szczególnej ostrożności przy przecinaniu głównej drogi wodnej, które może mieć miejsce, gdy nie zmusza to statków do zmiany kursu lub prędkości', 'Keep a sharp lookout when crossing the main waterway, allowed only if vessels on it will not have to change course or speed'],
      ['B.10', 'Nakaz zmiany kursu lub prędkości przez statki idące główną drogą wodną w sytuacjach, gdy z portu lub bocznej drogi wodnej wychodzą statki', 'Vessels on the main waterway must change course or speed when vessels leave a port or side waterway'],
      ['B.11a', 'Nakaz prowadzenia nasłuchu radiotelefonicznego', 'Keep a radiotelephone watch'],
      ['B.11b', 'Nakaz prowadzenia nasłuchu radiotelefonicznego na wskazanym kanale', 'Keep a radiotelephone watch on the channel shown']
    ]
  },
  {
    id: 'C', pl: 'C. Znaki ograniczenia', en: 'C. Restrictive signs',
    note: ['Na znakach C.1, C.2 i C.3 mogą być naniesione liczby wskazujące odpowiednio: głębokość, wysokość nad poziomem wody oraz szerokość przejścia. Na rzekach o zmiennym poziomie wody wysokość określona jest nad poziom najwyższej wody żeglownej.', 'Signs C.1, C.2 and C.3 may carry numbers giving the depth, the headroom above the water level and the width of the passage respectively. On rivers with a varying water level the headroom is given above the highest navigable water level.'],
    signs: [
      ['C.1', 'Ograniczona głębokość', 'Depth of water limited'],
      ['C.2', 'Ograniczona wysokość prześwitu nad zwierciadłem wody', 'Headroom above the water limited'],
      ['C.3', 'Ograniczona szerokość szlaku lub kanału żeglownego', 'Width of the fairway or channel limited'],
      ['C.4', 'Inne ograniczenia ruchu żeglugowego – należy się z nimi zapoznać. Ograniczenia te mogą też być podane na białym polu znaku lub pod znakiem w formie symbolu lub napisu', 'Other restrictions on navigation – find out what they are. They may also be shown on the white field of the sign or below it as a symbol or text'],
      ['C.5', 'Granica szlaku żeglownego oddalona od prawego (lewego) brzegu, w metrach podanych liczbą na znaku. Statki powinny przechodzić w odległości większej', 'The fairway lies the number of metres shown from the right (left) bank. Vessels should pass at a greater distance']
    ]
  },
  {
    id: 'D', pl: 'D. Znaki zalecenia', en: 'D. Recommendatory signs', signs: [
      ['D.1a', 'Zalecenie przejścia w obydwu kierunkach', 'Recommended passage – traffic in both directions'],
      ['D.1b', 'Zalecenie przejścia w jednym kierunku (przejście z przeciwnego kierunku zabronione)', 'Recommended passage in one direction (passage from the opposite direction prohibited)'],
      ['D.2', 'Zalecenie trzymania się we wskazanym obszarze', 'Recommendation to keep within the area indicated'],
      ['D.3', 'Zalecenie przejścia w kierunku określonym strzałką lub w nocy w kierunku światła izofazowego', 'Recommendation to proceed in the direction of the arrow, or at night towards the isophase light']
    ]
  },
  {
    id: 'E', pl: 'E. Znaki informacyjne', en: 'E. Informative signs', signs: [
      ['E.1', 'Zezwolenie przejścia (znak ogólny)', 'Passage permitted (general sign)'],
      ['E.2', 'Wskazanie linii napowietrznej nad drogą wodną (liczba w prawym dolnym rogu oznacza wysokość linii napowietrznej nad poziomem najwyższej wody żeglownej)', 'Overhead cable across the waterway (the number in the lower right corner is its height above the highest navigable water level)'],
      ['E.3', 'Jaz w bliskiej odległości', 'Weir close by'],
      ['E.4a', 'Prom na uwięzi', 'Ferry on a cable'],
      ['E.4b', 'Prom przemieszczający się swobodnie', 'Free-moving ferry'],
      ['E.5', 'Zezwolenie na postój (na kotwicy lub na cumach przy brzegu)', 'Berthing permitted (at anchor or made fast to the bank)'],
      ['E.5.1', 'Zezwolenie na postój na akwenie, którego szerokość w metrach jest podana na znaku, licząc od miejsca ustawienia znaku', 'Berthing permitted within the width in metres shown on the sign, measured from the sign'],
      ['E.5.2', 'Zezwolenie na postój na akwenie ograniczonym odstępami w metrach, podanymi na znaku, licząc od miejsca ustawienia znaku', 'Berthing permitted between the distances in metres shown on the sign, measured from the sign'],
      ['E.5.3', 'Zezwolenie na postój, burta przy burcie, w maksymalnej liczbie podanej na znaku', 'Berthing permitted abreast, up to the number of vessels shown on the sign'],
      ['E.5.4', 'Miejsce postoju zarezerwowane dla statków przeznaczonych do pchania, które nie są obowiązane do pokazywania znaków wskazanych w § 3.14', 'Berth reserved for pushed vessels not required to show the signs of § 3.14'],
      ['E.5.5', 'Miejsce postoju zarezerwowane dla statków przeznaczonych do pchania, które powinny pokazywać jedno niebieskie światło lub jeden niebieski stożek na podstawie § 3.14 ust. 1', 'Berth reserved for pushed vessels that must show one blue light or one blue cone (§ 3.14.1)'],
      ['E.5.6', 'Miejsce postoju zarezerwowane dla statków przeznaczonych do pchania, które powinny pokazywać dwa niebieskie światła lub dwa niebieskie stożki na podstawie § 3.14 ust. 2', 'Berth reserved for pushed vessels that must show two blue lights or two blue cones (§ 3.14.2)'],
      ['E.5.7', 'Miejsce postoju zarezerwowane dla statków przeznaczonych do pchania, które powinny pokazywać trzy niebieskie światła lub trzy niebieskie stożki na podstawie § 3.14 ust. 3', 'Berth reserved for pushed vessels that must show three blue lights or three blue cones (§ 3.14.3)'],
      ['E.5.8', 'Miejsce postoju zarezerwowane dla statków, z wyjątkiem statków przeznaczonych do pchania, które nie są obowiązane pokazywać znaków wskazanych w § 3.14', 'Berth reserved for vessels other than pushed vessels not required to show the signs of § 3.14'],
      ['E.5.9', 'Miejsce postoju zarezerwowane dla statków, z wyjątkiem statków przeznaczonych do pchania, które powinny pokazywać jedno niebieskie światło lub jeden niebieski stożek na podstawie § 3.14 ust. 1', 'Berth reserved for vessels other than pushed vessels that must show one blue light or one blue cone (§ 3.14.1)'],
      ['E.5.10', 'Miejsce postoju zarezerwowane dla statków, z wyjątkiem statków przeznaczonych do pchania, które powinny pokazywać dwa niebieskie światła lub dwa niebieskie stożki na podstawie § 3.14 ust. 2', 'Berth reserved for vessels other than pushed vessels that must show two blue lights or two blue cones (§ 3.14.2)'],
      ['E.5.11', 'Miejsce postoju zarezerwowane dla statków, z wyjątkiem statków przeznaczonych do pchania, które powinny pokazywać trzy niebieskie światła lub trzy niebieskie stożki na podstawie § 3.14 ust. 3', 'Berth reserved for vessels other than pushed vessels that must show three blue lights or three blue cones (§ 3.14.3)'],
      ['E.5.12', 'Miejsce postoju zarezerwowane dla wszystkich statków, które nie są obowiązane pokazywać znaków wskazanych w § 3.14', 'Berth reserved for all vessels not required to show the signs of § 3.14'],
      ['E.5.13', 'Miejsce postoju zarezerwowane dla wszystkich statków, które powinny pokazywać jedno niebieskie światło lub jeden niebieski stożek na podstawie § 3.14 ust. 1', 'Berth reserved for all vessels that must show one blue light or one blue cone (§ 3.14.1)'],
      ['E.5.14', 'Miejsce postoju zarezerwowane dla wszystkich statków, które powinny pokazywać dwa niebieskie światła lub dwa niebieskie stożki na podstawie § 3.14 ust. 2', 'Berth reserved for all vessels that must show two blue lights or two blue cones (§ 3.14.2)'],
      ['E.5.15', 'Miejsce postoju zarezerwowane dla wszystkich statków, które powinny pokazywać trzy niebieskie światła lub trzy niebieskie stożki na podstawie § 3.14 ust. 3', 'Berth reserved for all vessels that must show three blue lights or three blue cones (§ 3.14.3)'],
      ['E.6', 'Zezwolenie na postój na kotwicy i wleczenie kotwicy, łańcucha lub liny', 'Anchoring and dragging of anchors, chains or cables permitted'],
      ['E.7', 'Zezwolenie na cumowanie do brzegu', 'Making fast to the bank permitted'],
      ['E.7.1', 'Miejsce postoju zarezerwowane dla załadunku i wyładunku samochodów (maksymalny dozwolony czas cumowania może być umieszczony na tablicy poniżej znaku)', 'Berth reserved for loading and unloading cars (the maximum mooring time may be shown on a panel below the sign)'],
      ['E.8', 'Wskazanie miejsca do zawracania', 'Turning area'],
      ['E.9a', 'Skrzyżowanie z drogą uznaną za boczną drogę wodną w stosunku do drogi wodnej, po której idzie statek', 'Crossing with a waterway regarded as a side waterway relative to the one the vessel is on'],
      ['E.9b', 'Połączenie z drogą uznaną za boczną drogę wodną w stosunku do drogi, po której idzie statek', 'Junction with a waterway regarded as a side waterway relative to the one the vessel is on'],
      ['E.10a', 'Skrzyżowanie z drogą uznaną za główną drogę wodną w stosunku do drogi, po której idzie statek', 'Crossing with a waterway regarded as the main waterway relative to the one the vessel is on'],
      ['E.10b', 'Połączenie z drogą uznaną za główną drogę wodną w stosunku do drogi, po której idzie statek', 'Junction with a waterway regarded as the main waterway relative to the one the vessel is on'],
      ['E.11', 'Koniec obowiązywania zakazu lub nakazu albo ograniczenia – obowiązuje tylko w jednym kierunku ruchu żeglugowego', 'End of a prohibition, obligation or restriction – applies in one direction of traffic only'],
      ['E.12a', 'Znaki sygnałowe uprzedzające – jedno lub dwa białe światła stałe, przed przeszkodą: należy się zatrzymać, jeżeli wymagają tego przepisy', 'Advance signals – one or two fixed white lights before an obstacle: stop if the regulations require it'],
      ['E.12b', 'Znaki sygnałowe uprzedzające – jedno lub dwa białe światła migające przed przeszkodą: przejście dozwolone', 'Advance signals – one or two quick-flashing white lights before an obstacle: passage permitted'],
      ['E.13', 'Miejsce poboru wody pitnej', 'Drinking water supply'],
      ['E.14', 'Miejsce, w którym można korzystać z telefonu', 'Telephone'],
      ['E.15', 'Zezwolenie na ruch żeglugowy statków o napędzie mechanicznym', 'Motorised vessels permitted'],
      ['E.16', 'Zezwolenie na ruch żeglugowy statków używanych wyłącznie do uprawiania sportu lub rekreacji', 'Sport or pleasure craft permitted'],
      ['E.17', 'Zezwolenie na uprawianie narciarstwa wodnego oraz holowanie statków powietrznych za statkiem', 'Water skiing and towing of airborne craft permitted'],
      ['E.18', 'Zezwolenie na ruch statków żaglowych', 'Sailing vessels permitted'],
      ['E.19', 'Zezwolenie na ruch statków o napędzie wiosłowym', 'Rowing vessels permitted'],
      ['E.20', 'Zezwolenie na pływanie na desce z żaglem', 'Sailboards permitted'],
      ['E.21', 'Zezwolenie na ruch małych statków używanych wyłącznie do uprawiania sportu lub rekreacji z dużą prędkością', 'High-speed navigation of small sport or pleasure craft permitted'],
      ['E.22', 'Zezwolenie na wodowanie i wciąganie statków na brzeg', 'Launching and beaching of vessels permitted'],
      ['E.23', 'Wskazanie kanału radiotelefonicznego, na którym można uzyskać informacje nawigacyjne', 'Radiotelephone channel for nautical information'],
      ['E.24', 'Zezwolenie na ruch skuterów wodnych', 'Water bikes permitted']
    ]
  }
];

// II. Znaki pomocnicze (przykłady z rozporządzenia)
export const AUX_SIGNS = [
  ['F.1', '1. Tabliczki z napisami wskazującymi odległość od znaku do miejsca, gdzie zaczyna obowiązywać przepis znaku podstawowego', 'Tabliczki w kolorze białym z czarnym napisem umieszcza się nad znakiem podstawowym. Przykład: nakaz zatrzymania się w odległości 1000 m od znaku; prom na uwięzi w odległości 1500 m od znaku.', '1. Panels giving the distance from the sign to where the rule of the main sign begins', 'White panels with black text placed above the main sign. Example: stop 1000 m from the sign; cable ferry 1500 m from the sign.'],
  ['F.2', '2. Uzupełniające sygnały świetlne', 'Biała strzałka świetlna w połączeniu ze światłami oznacza: a) na przykład z zielonym światłem – wejście do portu lub drogi wodnej w kierunku wskazanym przez strzałkę dozwolone; b) na przykład z czerwonym światłem – wejście do portu lub drogi wodnej w kierunku wskazanym przez strzałkę zabronione.', '2. Supplementary light signals', 'A white light arrow combined with lights means: a) e.g. with a green light – entry into the port or waterway in the direction of the arrow permitted; b) e.g. with a red light – entry in the direction of the arrow prohibited.'],
  ['F.3', '3. Strzałki wskazujące kierunek, w którym obowiązuje przepis znaku podstawowego', 'Strzałki mogą być białe lub innego koloru i mogą być umieszczone obok znaku lub pod nim. Przykłady: zezwolenie postoju; zakaz postoju na odcinku 1000 m.', '3. Arrows showing the direction in which the rule of the main sign applies', 'The arrows may be white or another colour and may be placed beside or below the sign. Examples: berthing permitted; no berthing over a 1000 m stretch.'],
  ['F.4', '4. Tabliczki z napisami lub znakami uzupełniającymi przepis znaku podstawowego', 'Tabliczki należy umieszczać pod znakiem podstawowym. Przykłady: nakaz zatrzymania statku dla przeprowadzenia odprawy celnej; nakaz podania jednego długiego sygnału dźwiękowego.', '4. Panels with text or symbols supplementing the main sign', 'Panels are placed below the main sign. Examples: stop for customs clearance; give one long sound signal.']
];

export const signImage = (code) => `assets/cevni/${code.replace(/\./g, '_')}.png`;
