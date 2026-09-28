# MoorMe – symulator cumowania jachtów

MoorMe to aplikacja na Windows do ćwiczenia cumowania i odcumowywania jachtu żaglowego.
Grafika jest low-poly 3D, a kamera patrzy z ukosa z góry, jak w grach strategicznych (Age of Empires).
Modele jachtów oparto na danych Bavarii C34, C46 i C50.

## Instalacja (dla użytkownika)

1. Pobierz plik `MoorMe-Setup-1.0.0.exe` z zakładki **Releases** albo z artefaktów GitHub Actions („MoorMe-Setup”).
2. Uruchom instalator. Przy pierwszym uruchomieniu Windows SmartScreen może ostrzec, że aplikacja jest niepodpisana.
   Wybierz wtedy „Więcej informacji”, a potem „Uruchom mimo to”.
3. Instalator pozwala wybrać folder instalacji. Tworzy skróty na pulpicie i w menu Start.

## Jak to działa

Program prowadzi przez cztery kroki:

1. **Jacht**: Bavaria C34 (10,8 m), C46 (14,6 m) albo C50 (15,6 m).
2. **Wyposażenie**:
   - edytor pokładu w widoku z góry: rozmieszczasz knagi, kluzy, półkluzy i odbijacze;
   - śruba prawo- albo lewoskrętna, napęd saildrive albo wał;
   - ster strumieniowy dziobowy (brak, włącz/wyłącz albo proporcjonalny) i opcjonalnie rufowy;
   - winche ręczne albo elektryczne i rozmiar odbijaczy.
3. **Keja i sposób cumowania**:
   - nabrzeże betonowe: burtą (longside), rufą z muringiem, dziobem z muringiem;
   - pomost pływający: muring rufą albo dziobem, longside;
   - pomost z Y-bomami: dziobem albo rufą;
   - keja z dalbami (Bałtyk): dziobem do kei z rufą na dalbach, albo odwrotnie;
   - zadanie: **cumowanie** (podejście) albo **odcumowanie** (start zacumowany, liny założone na biegowo, jedna osoba na kei).
4. **Pogoda i start**: siła i kierunek wiatru, porywistość ze skrętami wiatru, prąd oraz miejsce startu na mapie portu.
   Wybierasz gotowe miejsce albo klikasz na mapie i przeciągasz, żeby ustawić kurs.

### Panel symulacji

- **Silnik**: manetka z luzem pośrodku. Zmiana biegu odbywa się ze zwłoką sprzęgła, obroty rosną i spadają płynnie.
  Panel pokazuje ciąg i kierunek, w którym śruba zarzuca rufę.
- **Ster**: płetwy sterowe obracają się ze skończoną prędkością.
- **Stery strumieniowe**: dziobowy i rufowy. Tracą skuteczność powyżej ok. 2 węzłów, a po ok. 2 minutach ciągłej pracy przegrzewają się i wyłącza je zabezpieczenie termiczne.
- **Odbijacze**: wystawiasz je lub chowasz osobno na lewej burcie, prawej burcie i rufie.
- **Załoga**: osoba może zejść na ląd, gdy burta jest blisko kei i jacht płynie wolno. Wraca na pokład w ten sam sposób.
- **Cumy i liny**:
  - przygotowujesz linę: rola (cuma, szpring, brest, boczna), knaga, prowadzenie przez kluzę, długość, sposób założenia (na stałe albo na biegowo) i obsługa na winchu;
  - „Załóż…” podświetla polery w zasięgu. Klikasz poler w widoku 3D albo wybierasz go z listy;
  - oko **na stałe** rzucasz z pokładu na poler z odległości do ok. 3,4 m i możesz chybić. Zdjąć je może tylko osoba na lądzie, i tylko gdy lina nie jest napięta;
  - linę **na biegowo** zakładasz z bliska (ok. 1,5 m), ale oddajesz ją z pokładu;
  - komendy: **Wybieraj** (przytrzymaj), **Luzuj** (przytrzymaj), **Obłóż**, **Luzem**, **Oddaj**;
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
- liny: sprężystość, tłumienie, wytrzymałość zależna od wielkości jachtu, siła i prędkość wybierania (ręcznie albo winchem);
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
| 1–9 | wybór liny |
| B | załóż wybraną linę / podejmij muring |
| T / G (przytrzymaj) | wybieraj / luzuj wybraną linę |
| Y | obłóż |
| N | oddaj |
| L | załoga na ląd / na pokład |
| P, Spacja | pauza |
| F / V | śledzenie kamerą / zmiana widoku |
| Mysz | LPM: przesuwanie widoku, PPM: obrót kamery, kółko: zoom |
| F11 | pełny ekran |

## Dla programistów

Aplikacja używa Electron i Three.js, bez frameworka UI. Kod leży w `src/js`:

- `physics/`: model jachtu, liny, świat symulacji z kontaktami, załogą i oceną. Nie zależy od grafiki, więc testy działają w Node;
- `render/`: proceduralne modele low-poly (jacht, port, woda) oraz widok 3D z kamerą;
- `ui/`: kreator, edytor pokładu i panel symulacji;
- `data/`: dane jachtów i generator portów.

```bash
npm install
npm start          # uruchomienie w trybie deweloperskim
npm test           # testy fizyki i scenariuszy cumowania
npm run dist       # instalator Windows (NSIS) w dist/MoorMe-Setup-<wersja>.exe
```

Na Windows `npm run dist` działa od razu. Na Linuksie budowa instalatora wymaga Wine (32- i 64-bit).
Workflow GitHub Actions (`.github/workflows/build-windows.yml` w katalogu głównym repozytorium) buduje instalator na `windows-latest` przy każdym pushu.
