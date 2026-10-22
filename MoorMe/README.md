# MoorMe – symulator cumowania jachtów

MoorMe to aplikacja na Windows do ćwiczenia cumowania i odcumowywania jachtu żaglowego.
Grafika jest low-poly 3D, a kamera patrzy z ukosa z góry, jak w grach strategicznych (Age of Empires).
Modele jachtów oparto na danych Bavarii C34, C46 i C50.

## Instalacja (dla użytkownika)

1. Pobierz plik `MoorMe-Setup-1.0.0.exe` z zakładki **Releases** albo z artefaktów GitHub Actions („MoorMe-Setup”).
2. Uruchom instalator. Przy pierwszym uruchomieniu Windows SmartScreen może ostrzec, że aplikacja jest niepodpisana.
   Wybierz wtedy „Więcej informacji”, a potem „Uruchom mimo to”.
3. Instalator pozwala wybrać folder instalacji. Tworzy skróty na pulpicie i w menu Start.

## Tryby gry

Po uruchomieniu otwiera się okno wyboru trybu:

- **Cumowanie** – manewry w porcie (opis niżej).
- **Rejs wzdłuż wybrzeża** – płyniesz po morzu po waypointach i stosujesz się do znaków nawigacyjnych IALA (region A).

### Rejs wzdłuż wybrzeża

- **Nawigacja:** domyślnie „Tylko BRG na port” – bez trasy, waypointów i nazw znaków (znaki rozpoznajesz po kształcie i charakterze światła); w ustawieniach rejsu można wybrać wariant z trasą i waypointami.
- **Akweny:** Bałtyk (piaszczyste mielizny) i Adriatyk (skaliste grzbiety). Układ jest **generowany proceduralnie przy każdym rejsie**: długie, pochyłe bariery z przejściami na przemian od północy i południa tworzą meandry (zmiany kursu powyżej 90°), oznaczone kardynałami; trasa ma ok. 1,7–2 nm (ok. 15–20 min). Znaki boczne (czerwone/zielone) są tylko przy wejściu do portu.
- **Cel:** przepłyń po kolejnych waypointach (magenta) do mety. Waypoint zalicza się w promieniu ok. 60 m. Panel nawigacyjny pokazuje kurs na waypoint (BRG), odległość, odchylenie od toru (XTE), ETA, głębokość i najbliższe znaki wraz z regułą mijania. Kurs na waypoint jest też zaznaczony na tarczy kompasu.
- **Znaki:** boczne (czerwony po lewej burcie, zielony po prawej), kardynalne N/E/S/W (miń od odpowiedniej strony), woda bezpieczna, odosobnione niebezpieczeństwo, wrak (nowe niebezpieczeństwo) i znaki szczególne. Znaki mają poprawne kolory, topmarki i charakterystyki świateł (np. VQ, Fl(2)).
- **Kartplotter:** mapa 2D z lądem, mieliznami, trasą, znakami i pozycją jachtu; przybliżanie, orientacja „północ u góry / kurs u góry”, nazwy znaków, widok całej trasy.
- **Autopilot** (J, `,` `.`) tylko trzyma zadany kurs – o trasie decydujesz Ty.
- **Noc:** w trybie nocnym z daleka widać wyłącznie światła pław i latarni, a trasa znika z widoku 3D (zostaje na kartplotterze).
- **Ocena:** punkty karne za odchylenie od trasy, znaki minięte z niewłaściwej strony, pominięte znaki, wejście w strefy zagrożeń (odosobnione niebezpieczeństwo, wrak, znak szczególny), mieliznę/brzeg i zderzenia ze znakami. Czas można przyspieszyć do 8×.

## Jak to działa (cumowanie)

Na ekranie startowym są dwie drogi:

- **Nowa symulacja**: kreator, w którym sam ustawiasz jacht, keję i warunki (opis niżej).
- **🎲 Random**: program losuje zadanie (cumowanie albo odcumowanie) i warunki: jacht, wyposażenie, keję, sposób cumowania, wiatr, prąd, porę dnia i niebo. Przed startem widzisz odprawę z mapą, opisem wiatru względem kei i oceną trudności. Możesz losować ponownie.

Kreator prowadzi przez cztery kroki:

1. **Jacht**: Bavaria C34 (10,8 m), C46 (14,6 m) albo C50 (15,6 m).
2. **Wyposażenie**:
   - edytor pokładu w widoku z góry: rozmieszczasz knagi, kluzy, półkluzy i odbijacze;
   - śruba prawo- albo lewoskrętna, napęd saildrive albo wał;
   - ster strumieniowy dziobowy (brak, włącz/wyłącz albo proporcjonalny) i opcjonalnie rufowy;
   - kabestany ręczne albo elektryczne i rozmiar odbijaczy.
3. **Port i stanowisko**. Do wyboru są dwa porty, a stanowisko wybierasz z listy (mapa pokazuje stanowisko albo cały port):
   - **Adriatyk – marina i riva (Dalmacja)**: miasteczko na zboczu z kamienną rivą (cumowanie rufą albo dziobem na muringach), betonowe pomosty mariny z muringami i falochron z keją do cumowania burtą. Wejście od południa, między czerwonym a zielonym światłem;
   - **Ystad – Småbåtshamn (Bałtyk)**, wzorowany na układzie mariny w Ystad: drewniane pomosty z dalbami (dziobem albo rufą do pomostu) i z Y-bomami, długi pomost wzdłuż zachodniego falochronu do cumowania burtą, muringi przy kei północnej, a obok mola promowego stoi prom. Podejście od południa;
   - przy Y-bomach i dalbach suwakiem ustawiasz szerokość stanowiska (prześwit ponad szerokość jachtu, od 0,1 do 2,5 m);
   - zadanie: **cumowanie** (podejście) albo **odcumowanie** (start zacumowany, liny założone na biegowo, jedna osoba na kei).
4. **Pogoda i start** (pogodę, niebo i porę dnia – także noc – zmienisz też w trakcie symulacji przyciskiem „🌦 Pogoda”): siła i kierunek wiatru, porywistość ze skrętami wiatru, prąd oraz miejsce startu na mapie portu.
   Wybierasz gotowe miejsce albo klikasz na mapie i przeciągasz, żeby ustawić kurs.

### Język

Gra jest dostępna po polsku i po angielsku. Przy pierwszym uruchomieniu pokazuje się wybór języka. Później zmienisz go w menu głównym: **Ustawienia → Język**. Wybór jest zapamiętywany.

Teksty źródłowe w kodzie są po polsku, a angielskie tłumaczenia leżą w `src/js/i18n/en.js` (słownik oraz reguły dla komunikatów z liczbami). Obserwator DOM w `src/js/i18n.js` tłumaczy je na ekranie, a napisy rysowane na płótnach przechodzą przez `t()`. Nowy tekst w interfejsie trzeba dopisać do słownika; test `tests/i18n.test.mjs` sprawdza, czy nazwy, opisy, pomoc i komunikaty symulacji mają tłumaczenie.

### Panel symulacji

- **Silnik**: manetka z luzem pośrodku. Zmiana biegu odbywa się ze zwłoką sprzęgła, obroty rosną i spadają płynnie.
  Panel pokazuje ciąg i kierunek, w którym śruba zarzuca rufę.
- **Ster**: płetwy sterowe obracają się ze skończoną prędkością.
- **Stery strumieniowe**: dziobowy i rufowy. Tracą skuteczność powyżej ok. 2 węzłów, a po ok. 2 minutach ciągłej pracy przegrzewają się i wyłącza je zabezpieczenie termiczne.
- **Odbijacze**: wystawiasz je lub chowasz osobno na lewej burcie, prawej burcie i rufie.
- **Załoga**: osoba może zejść na ląd, gdy burta jest blisko kei i jacht płynie wolno. Wraca na pokład w ten sam sposób.
- **Cumy i liny**:
  - najszybciej myszą: kliknij knagę na pokładzie, opcjonalnie kluzę lub półkluzę, którą ma iść lina, a na końcu poler. Rolę liny (cuma, szpring, brest) program rozpozna sam z kierunku. Jeśli poler jest w zasięgu, załoga od razu zakłada linę; jeśli nie, lina czeka przygotowana z zapamiętanym polerem i zakładasz ją przyciskiem „Załóż na …” (B), gdy podejdziesz bliżej. Linie są w panelu w lewym dolnym rogu;
  - albo przygotowujesz linę z listy: rola (cuma, szpring, brest, boczna), knaga, prowadzenie przez kluzę, długość, sposób założenia (na stałe albo na biegowo) i obsługa na kabestanie;
  - „Załóż…” podświetla polery w zasięgu. Klikasz poler w widoku 3D albo wybierasz go z listy;
  - oko **na stałe** rzucasz z pokładu na poler z odległości do ok. 3,4 m i możesz chybić. Zdjąć je może tylko osoba na lądzie, i tylko gdy lina nie jest napięta;
  - linę **na biegowo** zakładasz z bliska (ok. 1,5 m), ale oddajesz ją z pokładu;
  - komendy: **Wybieraj** (przytrzymaj), **Luzuj** (przytrzymaj), **Wybierz** (do napięcia), **Luz**, **Knaguj**, **Oddaj**;
  - lina rozciąga się sprężyście i zwisa, gdy ma luz. Kolor pokazuje naciąg. Po przekroczeniu wytrzymałości lina się zrywa. Z półkluzy lina może wyskoczyć, gdy ciągnie pod dużym kątem;
  - **muring**: załoga podejmuje linkę pilotową przy kei i przenosi ją na dziób (albo rufę). Oddany muring tonie przez kilka sekund. Jeśli w tym czasie włączysz bieg nad nim, lina wkręci się w śrubę.
- **Ocena**: liczy uderzenia kadłubem, mocne uderzenia w odbijacze, zerwane liny, przegrzanie steru strumieniowego i czas. Na końcu dostajesz wynik w punktach na 100.

### Model fizyczny

Model ma 3 stopnie swobody: ruch wzdłużny, dryf boczny i obrót. Uwzględnia:

- opór kadłuba liczony pasami wzdłuż długości, co daje też tłumienie obrotu;
- kil i dwie płetwy sterowe liczone jak płaskie płyty z przeciągnięciem. Dzięki temu jacht z prędkością „trzyma kurs”, a stojący dryfuje;
- napór wiatru na nadbudowę. Środek naporu leży przed kilem, więc przy bocznym wietrze dziób odpada. Wiatr ma porywy i skręty;
- prąd wody;
- ciąg śruby zależny od obrotów i prędkości jachtu;
- **zarzucanie rufy** (prop walk). Śruba prawoskrętna na wstecznym ściąga rufę w lewo, lewoskrętna w prawo, a na biegu naprzód efekt jest słabszy i odwrotny. Wał daje silniejszy efekt niż saildrive;
- strumień zaśrubowy na płetwach sterowych. Seria C ma podwójne płetwy poza osią, więc strumień słabo na nie działa;
- stery strumieniowe;
- liny: sprężystość, tłumienie, wytrzymałość zależna od wielkości jachtu, siła i prędkość wybierania (ręcznie albo kabestanem);
- kontakty: nieliniowo sprężyste odbijacze, twarde uderzenia kadłubem z tarciem, a do tego kolizje z keją, pomostami, Y-bomami, dalbami i sąsiednimi jachtami.

Dane jachtów są orientacyjne i służą ćwiczeniu. To nie jest dokumentacja producenta.

## Sterowanie z klawiatury

| Klawisz | Działanie |
|---|---|
| W / S, ↑ / ↓ | manetka naprzód / wstecz |
| X | luz |
| A / D, ← / → | ster w lewo / w prawo |
| R | ster na zero |
| Q / E | ster strumieniowy dziobowy: dziób w lewo / w prawo |
| Z / C | ster strumieniowy rufowy: rufa w lewo / w prawo |
| K / klik na knagę | nowa lina myszą: knaga → (kluza/półkluza) → poler |
| klik na linę | okrągłe menu: wybieraj, wybierz, luzuj, luz, knaguj, oddaj |
| O | pogoda i pora dnia w trakcie symulacji |
| 1–9 | wybór liny |
| B | załóż wybraną linę / podejmij muring |
| T / G (przytrzymaj) | wybieraj / luzuj wybraną linę |
| Y | knaguj |
| U | wybierz (do napięcia) |
| N | oddaj |
| L | załoga na ląd / na pokład |
| P, Spacja | pauza |
| F / V | śledzenie kamerą / zmiana widoku (w tym widok kapitana „👁 Kapitan” – przeciąganie myszą obraca głowę, kółko przybliża) |
| Mysz | LPM: przesuwanie widoku, PPM: obrót kamery, kółko: zoom |
| F11 | pełny ekran |

## Dla programistów

Aplikacja używa Electron i Three.js, bez frameworka UI. Kod leży w `src/js`:

- `physics/`: model jachtu, liny, świat symulacji z kontaktami, załogą i oceną oraz `passage.js` (tryb rejsu: nawigacja, ocena znaków). Nie zależy od grafiki, więc testy działają w Node;
- `render/`: proceduralne modele low-poly (jacht, port, woda) oraz widok 3D z kamerą;
- `ui/`: kreator, edytor pokładu i panel symulacji;
- `data/`: dane jachtów, generator portów i akweny rejsu (`passage.js`).

```bash
npm install
npm start          # uruchomienie w trybie deweloperskim
npm test           # testy fizyki i scenariuszy cumowania
npm run dist       # instalator Windows (NSIS) w dist/MoorMe-Setup-<wersja>.exe
```

Na Windows `npm run dist` działa od razu. Na Linuksie budowa instalatora wymaga Wine (32- i 64-bit).
Workflow GitHub Actions (`.github/workflows/build-windows.yml` w katalogu głównym repozytorium) buduje instalator na `windows-latest` przy każdym pushu.

## Rozpoznawanie świateł

Trzeci tryb (karta „Rozpoznawanie świateł” w oknie wyboru trybu). Jest noc (czarne niebo, przygaszony księżyc), a zwykła łódź wiosłowa – bez masztu i olinowania, które zasłaniałyby widok – płynie stałym kursem 090°. Patrzysz z pozycji wioślarza i rozglądasz się, przeciągając myszą (kółko przybliża). Co kilka sekund na lewej albo prawej burcie, w odległości 0,25–0,65 nm, pojawia się statek widoczny wyłącznie po światłach (MPZZM/COLREG, część C). Trzeba rozpoznać:

- **co to za jednostka i co robi** – 6 odpowiedzi do wyboru, a w katalogu jest 13 typów: statek o napędzie mechanicznym < 50 m i ≥ 50 m, jednostka żaglowa, statek na kotwicy < 50 m i ≥ 50 m, trałowiec, statek rybacki, niezdolny do manewrowania, o ograniczonej zdolności manewrowania, ograniczony zanurzeniem, holujący (z holowaną jednostką), pilotowy i statek na mieliźnie;
- **którą stronę statku widzisz** – dziób, prawą burtę, lewą burtę albo rufę (dla statków w ruchu).

Światła świecą w swoich sektorach (masztowe 225°, burtowe po 112,5°, rufowe i holownicze 135°, dookólne 360°), więc zestaw widocznych świateł zależy od kursu statku względem jachtu. Żółty punkt na kompasie wskazuje kierunek świateł. Po odpowiedzi wyświetla się wyjaśnienie, a „Pomoc” zawiera ściągę ze wszystkimi zestawami świateł.

Po wybraniu trybu wybierasz porę:
- **Noc – światła:** 14 typów jednostek, w tym statek rybacki z sieciami wystającymi ponad 150 m (dodatkowe białe światło dookólne po stronie sieci). Przy takim statku pada też pytanie, z której burty ma sieci.
- **Dzień – znaki dzienne:** statki widać jako ciemne sylwetki z czarnymi znakami. Jest 10 typów: kula (kotwica), trzy kule (mielizna), dwie kule (niezdolny do manewrowania), kula–romb–kula (ograniczona zdolność manewrowania), walec (ograniczony zanurzeniem), klepsydra (połów), klepsydra ze stożkiem wierzchołkiem w górę po stronie sieci, romb na holowniku i holowanym (hol > 200 m), stożek wierzchołkiem w dół (jacht na silniku) oraz statek bez znaków.

Typy losowane są „talią”: każdy pojawia się raz w rundzie, w losowej kolejności, więc żaden (np. statek na kotwicy) nie powtarza się zbyt często.

## Sygnały dźwiękowe

Kolejny tryb (karta „Sygnały dźwiękowe”). Z łodzi wiosłowej słychać sygnały statków (MPZZM/COLREG, część D), odtwarzane w stereo z kierunku, z którego płynie dźwięk. Sygnały to buczek (krótki ok. 1 s, długi 4,5 s), dzwon i gong. Każdy sygnał trzeba rozpoznać spośród 5 odpowiedzi; „Odtwórz ponownie” powtarza sygnał. Po odpowiedzi wyświetla się tylko wynik, poprawna odpowiedź i zapis sygnału (• — 🔔 ◎).

- **Dobra widoczność** (statek widać na horyzoncie): • w prawo, •• w lewo, ••• wstecz, ••••• wątpliwość, —— • / —— •• wyprzedzanie w wąskim przejściu z prawej/lewej burty, — • — • zgoda, — zakręt.
- **Mgła** (statku nie widać): — w drodze z szybkością, — — zatrzymany, — • • specjalne statki, — • • • holowany, •••• pilot, dzwon (kotwica < 100 m), dzwon + gong (kotwica ≥ 100 m), 3 uderzenia + dzwon + 3 uderzenia (mielizna), • — • ostrzeżenie statku na kotwicy.

## Zadania nawigacyjne

Tryb z losowo generowanymi zadaniami do rozwiązania na kartce, z kalkulatorem albo na mapie. Odpowiedź wpisujesz w pola, a „Sprawdź” ocenia każdą wartość z tolerancją (kąty ±1–1,5°, prędkość ±0,15 kn, minuty pozycji ±0,2–0,35'). „Pokaż rozwiązanie” wyświetla obliczenia krok po kroku; dla zadań z prądem i z pozycją jest też rysunek (trójkąt prędkości, linie namiarów). Kategorie:

- **Kursy:** KK → KM → KR z dewiacją i deklinacją z mapy (z aktualizacją rocznej zmiany do bieżącego roku);
- **Tabela dewiacji:** KR → KK z interpolacją i iteracją, bo dewiacja zależy od kursu kompasowego;
- **Dryf:** strona wiatru, β, KDw;
- **Prąd:** KDd i SOG z trójkąta prędkości;
- **Kurs z poprawką na prąd:** jaki KR/KK trzymać, żeby iść po zadanej KDd, i jaka będzie SOG;
- **Namiary:** NK → NR, namiar zwrotny, kąt kursowy;
- **Pozycja z dwóch namiarów:** latarnie podane współrzędnymi;
- **Zliczenie drogi:** droga i pozycja zliczona po czasie.

Konwencja: poprawki na E i dryf w prawo są dodatnie.

