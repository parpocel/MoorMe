// Moduł „Bezpieczeństwo”: wyposażenie ratunkowe (EPIRB, SART, VHF DSC, tratwa, kamizelki…),
// kanały VHF, procedury MAYDAY / PAN-PAN / SÉCURITÉ i test korespondencji radiowej.
// Frazy proceduralne – po angielsku, tak jak nadaje się je w eterze (standard GMDSS / SRC).
import { getLang } from '../i18n.js';

const L = (pl, en) => (getLang() === 'en' ? en : pl);

// ---------- Urządzenia i wyposażenie ----------
// sections: [tytuł, treść] – okno po najechaniu pokazuje „short” i pierwsze sekcje, kliknięcie – całość
export function deviceInfo(id) {
  const D = {
    epirb: {
      name: L('Radiopława EPIRB 406 MHz', 'EPIRB 406 MHz'),
      short: L('Awaryjna radiopława wskazująca pozycję. Po włączeniu wysyła przez satelity COSPAS-SARSAT alarm z identyfikatorem jachtu i pozycją GPS – działa na całym świecie, także daleko poza zasięgiem VHF.', 'Emergency position-indicating radio beacon. Once switched on it sends an alert with the yacht’s ID and GPS position via the COSPAS-SARSAT satellites – it works worldwide, far beyond VHF range.'),
      sections: [
        [L('Częstotliwości', 'Frequencies'), L('406 MHz – cyfrowy alarm z numerem radiopławy (HEX ID, zwykle powiązanym z MMSI jachtu) i pozycją z wbudowanego GPS. 121,5 MHz – słaby sygnał naprowadzający, na który ratownicy (statki, śmigłowce, samoloty) namierzają radiopławę z bliska. Nowsze modele nadają także AIS (161,975 i 162,025 MHz), więc pojawiają się na ploterach statków w pobliżu.', '406 MHz – a digital alert with the beacon number (HEX ID, usually linked to the yacht’s MMSI) and the position from the built-in GPS. 121.5 MHz – a weak homing signal that rescuers (ships, helicopters, aircraft) use to find the beacon at close range. Newer models also transmit AIS (161.975 and 162.025 MHz), so they appear on the plotters of nearby vessels.')],
        [L('Gdzie trafia sygnał', 'Where the signal goes'), L('Satelity COSPAS-SARSAT (MEOSAR na orbitach średnich – wykrycie zwykle w ciągu minut, LEOSAR polarne i GEOSAR geostacjonarne) → naziemna stacja odbiorcza LUT → krajowe centrum MCC → właściwe centrum koordynacji ratownictwa RCC/MRCC. Na polskich obszarach SAR jest to MRCK w Gdyni, które wysyła jednostki ratownicze i śmigłowiec. Część radiopław ma też potwierdzenie odbioru (Return Link Service przez Galileo).', 'COSPAS-SARSAT satellites (MEOSAR in medium orbits – detection usually within minutes, polar LEOSAR and geostationary GEOSAR) → a ground receiving station (LUT) → a national mission control centre (MCC) → the responsible rescue coordination centre (RCC/MRCC), which sends lifeboats and a helicopter. Some beacons also confirm reception (Return Link Service via Galileo).')],
        [L('Kiedy używać', 'When to use'), L('Tylko w niebezpieczeństwie – gdy grozi utrata życia lub jachtu: tonięcie, pożar poza kontrolą, opuszczanie jachtu, a także gdy nie da się wezwać pomocy przez VHF (brak zasięgu, awaria, brak zasilania). Zabierz ją do tratwy – ratownicy szukają radiopławy, nie jachtu.', 'Only in distress – when life or the yacht is in danger: sinking, fire out of control, abandoning ship, and also when you cannot call for help on VHF (out of range, radio failure, no power). Take it into the liferaft – rescuers home in on the beacon, not the yacht.')],
        [L('Jak używać', 'How to use'), L('Kategoria II (ręczna, jak ta): wyjmij z uchwytu, rozwiń antenę, przesuń osłonę i naciśnij ON – zacznie błyskać lampa. Kategoria I uruchamia się sama: po zatonięciu jachtu zwalniak hydrostatyczny uwalnia ją z pojemnika, a woda ją włącza. Trzymaj antenę pionowo, nad wodą, z widokiem na niebo; przywiąż ją linką do tratwy lub siebie i nie wyłączaj, dopóki ratownicy nie przypłyną. Bateria wystarcza na co najmniej 48 h.', 'Category II (manual, like this one): take it out of the bracket, unfold the antenna, slide the cover and press ON – the strobe starts flashing. Category I activates itself: when the yacht sinks a hydrostatic release frees it and the water switches it on. Keep the antenna upright, clear of the water with a view of the sky; tie it to the raft or to yourself with the lanyard and leave it on until rescuers arrive. The battery lasts at least 48 h.')],
        [L('Obsługa i fałszywy alarm', 'Maintenance and false alerts'), L('Zarejestruj radiopławę w krajowym rejestrze (dane jachtu, armatora i kontakty alarmowe) – bez tego ratownicy nie wiedzą, kogo szukają. Rób tylko autotest przyciskiem TEST według instrukcji (zwykle raz w miesiącu), pilnuj dat ważności baterii i zwalniaka. Jeśli włączysz ją przypadkiem: wyłącz i natychmiast powiadom MRCC lub stację brzegową – nie wyrzucaj jej, nie „czekaj, aż przestanie”.', 'Register the beacon in the national register (yacht, owner and emergency contacts) – otherwise rescuers do not know whom they are looking for. Only use the TEST button as the manufacturer says (usually once a month) and watch the battery and release expiry dates. If it goes off by accident: switch it off and inform the MRCC or a coast station immediately.')],
        [L('EPIRB a PLB', 'EPIRB vs PLB'), L('PLB to osobista radiopława (np. przy kamizelce) – działa tak samo na 406 MHz, ale jest mniejsza, rejestrowana na osobę i nadaje krócej (min. 24 h).', 'A PLB is a personal beacon (e.g. on a lifejacket) – it works the same way on 406 MHz but is smaller, registered to a person and transmits for a shorter time (at least 24 h).')]
      ]
    },
    sart: {
      name: L('Transponder SAR (AIS-SART / radar-SART)', 'Search and rescue transponder (AIS-SART / radar SART)'),
      short: L('Urządzenie do odnalezienia rozbitków w ostatniej fazie akcji: EPIRB alarmuje, a SART pokazuje statkom ratowniczym, gdzie dokładnie jest tratwa.', 'A device for locating survivors in the final stage of a rescue: the EPIRB raises the alarm, the SART shows rescue vessels exactly where the raft is.'),
      sections: [
        [L('Rodzaje i częstotliwości', 'Types and frequencies'), L('AIS-SART (jak ten na stole) nadaje swoją pozycję GPS w systemie AIS na kanałach AIS 1 i 2 (161,975 i 162,025 MHz), co minutę serię komunikatów. Radar-SART działa w paśmie 9 GHz (9,2–9,5 GHz) i odpowiada na impulsy radarów pasma X (3 cm) – radarów 10 cm (pasmo S) nie widzi.', 'An AIS-SART (like the one on the table) transmits its GPS position over AIS on AIS channels 1 and 2 (161.975 and 162.025 MHz), a burst of messages every minute. A radar SART works in the 9 GHz band (9.2–9.5 GHz) and answers X-band (3 cm) radar pulses – it is not seen by 10 cm (S-band) radars.')],
        [L('Co widzą ratownicy', 'What rescuers see'), L('AIS-SART: na ploterze i ekranie AIS kółko z krzyżykiem z opisem „SART ACTIVE” (przy teście „SART TEST”). Radar-SART: na ekranie radaru linia 12 kropek od pozycji SART w kierunku od radaru; gdy statek jest bliżej niż ok. 1 Mm, kropki zmieniają się w łuki, a tuż obok – w koncentryczne okręgi.', 'AIS-SART: a crossed circle labelled “SART ACTIVE” on the plotter and AIS display (“SART TEST” during a test). Radar SART: a line of 12 dots on the radar screen starting at the SART and pointing away from the radar; within about 1 NM the dots become arcs and, very close, concentric circles.')],
        [L('Zasięg', 'Range'), L('Zależy od wysokości: z SART-em 1 m nad wodą statek wykryje go z ok. 5 Mm, samolot lub śmigłowiec – z 30 Mm i więcej. Dlatego mocuje się go jak najwyżej.', 'It depends on height: with the SART 1 m above the water a ship detects it at about 5 NM, an aircraft or helicopter at 30 NM or more. That is why it is mounted as high as possible.')],
        [L('Jak używać', 'How to use'), L('W tratwie włącz SART i zamocuj na maszcie teleskopowym co najmniej 1 m nad wodą (albo przywiąż jak najwyżej do daszku). Działa min. 96 h w czuwaniu i 8 h nadawania. Nie włączaj go na jachcie „na zapas” – po teście wyłącz.', 'In the liferaft switch the SART on and mount it on its telescopic pole at least 1 m above the water (or tie it as high as possible on the canopy). It runs at least 96 h on standby and 8 h transmitting. Do not leave it on aboard “just in case” – switch it off after a test.')]
      ]
    },
    vhf: {
      name: L('Radiotelefon VHF z DSC (stacjonarny)', 'Fixed VHF radio with DSC'),
      short: L('Podstawowe radio jachtu do łączności z innymi statkami, mariną i stacjami brzegowymi, a w niebezpieczeństwie – do cyfrowego alarmu DSC i wezwania MAYDAY. Kliknij, aby otworzyć kanały i test.', 'The yacht’s main radio for talking to other vessels, marinas and coast stations and, in distress, for the digital DSC alert and the MAYDAY call. Click to open the channels and the test.'),
      sections: [
        [L('Częstotliwości i moc', 'Frequencies and power'), L('Pasmo morskie VHF 156–162 MHz. Kanał 16 (156,800 MHz) – wzywanie pomocy, pilność, bezpieczeństwo i wywołania; kanał 70 (156,525 MHz) – wyłącznie cyfrowe wywołania DSC, bez głosu. Moc: 25 W albo 1 W – używaj najmniejszej mocy, która wystarcza (w porcie i blisko innych statków 1 W), pełnej przy MAYDAY i PAN-PAN.', 'Marine VHF band 156–162 MHz. Channel 16 (156.800 MHz) – distress, urgency, safety and calling; channel 70 (156.525 MHz) – digital DSC calls only, no voice. Power: 25 W or 1 W – use the lowest power that works (1 W in harbour and close to other vessels), full power for MAYDAY and PAN-PAN.')],
        [L('Kanały osłonowe', 'Guard channels'), L('Kanał 16 chronią sąsiednie częstotliwości: 75 (156,775) i 76 (156,825 MHz) – tylko łączność dotycząca nawigacji, moc maks. 1 W – oraz 15 i 17 – łączność na pokładzie, też maks. 1 W. Dzięki temu silny nadajnik na sąsiednim kanale nie zagłusza wezwań o pomoc na 16.', 'Channel 16 is protected by the adjacent frequencies: 75 (156.775) and 76 (156.825 MHz) – navigation-related communications only, max 1 W – and 15 and 17 – on-board communications, also max 1 W. This keeps a strong transmitter on a neighbouring channel from blocking distress calls on 16.')],
        [L('Zasięg', 'Range'), L('VHF działa na „linię wzroku”: zasięg zależy od wysokości anten. Między dwoma jachtami to zwykle 5–15 Mm, do stacji brzegowej z wysoką anteną – ok. 20–30 Mm (obszar morza A1 systemu GMDSS). Ręczne radio 5 W na wysokości człowieka – kilka mil.', 'VHF works by line of sight: range depends on antenna heights. Between two yachts it is usually 5–15 NM, to a coast station with a high antenna about 20–30 NM (GMDSS sea area A1). A 5 W handheld at head height – a few miles.')],
        [L('Alarm DSC', 'DSC alert'), L('Podnieś osłonę i przytrzymaj DISTRESS ok. 5 s (jeśli zdążysz – najpierw wybierz rodzaj zagrożenia). Radio wysyła na kanale 70 numer MMSI, rodzaj zagrożenia, pozycję i czas z GPS, powtarza alarm co kilka minut do potwierdzenia przez stację brzegową i samo przełącza się na kanał 16 – wtedy nadaj MAYDAY głosem. Bez podłączonego GPS trzeba wpisać pozycję ręcznie.', 'Lift the cover and hold DISTRESS for about 5 s (if there is time – select the nature of distress first). On channel 70 the radio sends the MMSI, the nature of distress and the GPS position and time, repeats the alert every few minutes until a coast station acknowledges it and switches to channel 16 by itself – then send the MAYDAY by voice. Without a GPS connection the position must be entered by hand.')],
        [L('Wymagania', 'Requirements'), L('Operator musi mieć świadectwo SRC (w Polsce egzamin w UKE), jacht – pozwolenie radiowe na stację statkową, numer MMSI (polskie zaczynają się od 261) i znak wywoławczy. Rozmowy prowadź krótko, procedury po angielsku, kanał 16 zwalniaj jak najszybciej.', 'The operator needs an SRC certificate, the yacht a ship station licence, an MMSI (Polish ones start with 261) and a call sign. Keep calls short, use the standard English procedure words and leave channel 16 as quickly as possible.')]
      ]
    },
    raft: {
      name: L('Tratwa ratunkowa', 'Liferaft'),
      short: L('Samonapełniająca się tratwa w torbie (jak ta) albo w pojemniku na pokładzie – miejsce schronienia, gdy jacht naprawdę tonie albo płonie. Pojemność dobiera się do liczby osób na pokładzie.', 'A self-inflating liferaft in a valise (like this one) or a canister on deck – a refuge when the yacht is really sinking or on fire. Its capacity must match the number of people aboard.'),
      sections: [
        [L('Kiedy opuścić jacht', 'When to abandon ship'), L('Dopiero gdy jacht naprawdę tonie lub płonie – nawet zalany jacht jest większy i łatwiejszy do znalezienia niż tratwa („do tratwy wchodzi się w górę”). Przedtem nadaj MAYDAY, włącz EPIRB, ubierz załogę ciepło i w kamizelki, przygotuj torbę ratunkową.', 'Only when the yacht is really sinking or burning – even a swamped yacht is bigger and easier to find than a raft (“step up into the liferaft”). Before that send a MAYDAY, activate the EPIRB, dress the crew warmly with lifejackets on and get the grab bag ready.')],
        [L('Jak zwodować', 'How to launch'), L('Sprawdź, czy linka (fanga) jest przywiązana do mocnego punktu jachtu. Wyrzuć tratwę za burtę po zawietrznej, wyciągnij całą fangę i mocno szarpnij – butla CO₂ napełni tratwę w kilkadziesiąt sekund. Gdy tratwa odwróci się dnem do góry, postaw ją: stań na butli i pociągnij za taśmę do odwracania.', 'Check that the painter is tied to a strong point on the yacht. Throw the raft overboard to leeward, pull out the whole painter and give it a sharp tug – the CO₂ cylinder inflates the raft in under a minute. If it inflates upside down, right it: stand on the gas cylinder and pull the righting strap.')],
        [L('Wsiadanie i pierwsze czynności', 'Boarding and first actions'), L('Wsiadaj prosto z jachtu, bez skakania do wody; pierwsza najsilniejsza osoba pomaga pozostałym. Fangę odetnij nożem przy wejściu dopiero, gdy wszyscy są w środku albo jacht idzie na dno. Potem: wyrzuć dryfkotwę, zamknij wejścia, wybierz wodę, sprawdź, czy nikt nie jest ranny, weź tabletki na chorobę morską, wystaw obserwatora, ustaw EPIRB i SART.', 'Board directly from the yacht without jumping into the water; the strongest person goes first to help the others. Cut the painter with the knife by the entrance only when everyone is aboard or the yacht is going down. Then: stream the drogue, close the entrances, bail out, check for injuries, take seasickness tablets, post a lookout, set up the EPIRB and SART.')],
        [L('Co zabrać', 'Take along'), L('W tratwie jest m.in. dryfkotwa, wiosełka, czerpak, nóż, zestaw naprawczy, pompka, latarka, pirotechnika, woda i apteczka (zależnie od pakietu). Zabierz też torbę ratunkową: EPIRB, SART, VHF ręczne, telefon w wodoszczelnym etui, dziennik pokładowy (ostatnia pozycja, kurs i zdarzenia – potrzebne ratownikom i do raportu), dokumenty jachtu i załogi, dodatkową wodę, ciepłe ubrania, leki.', 'The raft contains, among other things, a drogue, paddles, a bailer, a knife, a repair kit, a pump, a torch, flares, water and a first-aid kit (depending on the pack). Also take the grab bag: EPIRB, SART, handheld VHF, a phone in a waterproof case, the logbook (last position, course and events – needed by rescuers and for the report), the yacht’s and crew’s documents, extra water, warm clothes, medication.')],
        [L('Obsługa', 'Maintenance'), L('Przegląd w autoryzowanym serwisie w terminie podanym przez producenta (zwykle co 1–3 lata). Tratwa w pojemniku na pokładzie ma zwalniak hydrostatyczny (np. Hammar), który uwalnia ją, gdy jacht zatonie – wymienia się go co 2 lata.', 'Service at an authorised station at the interval given by the manufacturer (usually every 1–3 years). A raft in a canister on deck has a hydrostatic release (e.g. Hammar) that frees it if the yacht sinks – it is replaced every 2 years.')]
      ]
    },
    jacket: {
      name: L('Kamizelka ratunkowa (pneumatyczna)', 'Lifejacket (inflatable)'),
      short: L('Kamizelka 150 N (ISO 12402-3) z automatycznym napełnianiem, uprzężą i pasem krokowym – w wodzie sama obraca człowieka na plecy i utrzymuje twarz nad wodą, także nieprzytomnego.', '150 N lifejacket (ISO 12402-3) with automatic inflation, harness and crotch strap – in the water it turns the wearer onto their back and keeps the face clear, even if unconscious.'),
      sections: [
        [L('Kiedy zakładać', 'When to wear it'), L('Zawsze na pokładzie nocą, przy silnym wietrze i fali, we mgle, przy samotnej wachcie, w pontonie, a także zawsze, gdy każe kapitan. Przy złej pogodzie przypinaj się lifeliną do linki asekuracyjnej (jackstay) jeszcze w zejściówce, zanim wyjdziesz z kokpitu.', 'Always on deck at night, in strong wind and waves, in fog, on a solo watch, in the tender and whenever the skipper says so. In bad weather clip your tether to the jackstay while still in the companionway, before leaving the cockpit.')],
        [L('Budowa', 'Features'), L('Butla CO₂ (dla 150 N zwykle 33 g) i automat: tabletkowy – rozpuszcza się w wodzie (może zadziałać od silnej bryzgi), albo hydrostatyczny (np. Hammar) – zadziała dopiero ok. 10 cm pod wodą. Do tego linka do ręcznego napełnienia, ustnik do dmuchania, światło włączane wodą, gwizdek, kaptur przeciwbryzgowy, pas krokowy (żeby kamizelka nie zsunęła się przez głowę), kółko D do lifeliny, taśmy odblaskowe.', 'A CO₂ cylinder (usually 33 g for 150 N) and a firing head: a bobbin type dissolves in water (heavy spray can set it off) or a hydrostatic one (e.g. Hammar) fires only about 10 cm under water. Plus a manual pull toggle, an oral inflation tube, a water-activated light, a whistle, a spray hood, a crotch strap (so the jacket cannot ride up over the head), a D-ring for the tether and reflective tape.')],
        [L('Kontrola', 'Checks'), L('Przed rejsem: butla dokręcona i nieprzebita, wskaźnik automatu zielony, daty ważności, pas krokowy i klamra dopasowane. Raz w roku przegląd (napełnij ustnikiem i sprawdź szczelność przez noc).', 'Before sailing: cylinder screwed in and not pierced, firing head indicator green, expiry dates, crotch strap and buckle adjusted. An annual check (inflate orally and leave it overnight to test for leaks).')]
      ]
    },
    extinguisher: {
      name: L('Gaśnica proszkowa', 'Dry-powder fire extinguisher'),
      short: L('Gaśnica 2 kg ABC przy zejściówce – na pożary materiałów stałych (A), cieczy jak paliwo (B) i gazów (C); nadaje się też do urządzeń elektrycznych do napięcia podanego na etykiecie.', '2 kg ABC extinguisher by the companionway – for fires of solids (A), liquids such as fuel (B) and gases (C); also suitable for electrical equipment up to the voltage on the label.'),
      sections: [
        [L('Jak gasić', 'How to use'), L('Zerwij zawleczkę, celuj w podstawę ognia krótkimi seriami z odległości 1–2 m, miej drogę ucieczki za plecami. Pożar silnika: wyłącz silnik i zamknij dopływ paliwa, nie otwieraj szeroko pokrywy (dopływ powietrza) – gaś przez otwór gaśniczy. Płonący tłuszcz w kambuzie gaś kocem gaśniczym, nigdy wodą. Gdy ogień jest poza kontrolą – MAYDAY i przygotowanie do opuszczenia jachtu.', 'Pull the pin, aim at the base of the fire in short bursts from 1–2 m and keep your escape route behind you. Engine fire: stop the engine and shut off the fuel, do not open the engine hatch wide (air supply) – discharge through the fire port. Burning fat in the galley: use a fire blanket, never water. If the fire is out of control – MAYDAY and prepare to abandon ship.')],
        [L('Kontrola', 'Checks'), L('Wskazówka manometru w zielonym polu, plomba cała; proszek co jakiś czas „rozbij”, odwracając gaśnicę. Przegląd zgodnie z przepisami i etykietą (zwykle co rok).', 'The pressure gauge needle in the green, seal intact; turn the extinguisher over now and then so the powder does not compact. Service as required by regulations and the label (usually yearly).')]
      ]
    },
    flares: {
      name: L('Pirotechnika ratunkowa', 'Distress flares'),
      short: L('Czerwone rakiety spadochronowe, czerwone pochodnie ręczne i pomarańczowa pława dymna – sygnały niebezpieczeństwa (MPZZM, zał. IV), które widać z daleka.', 'Red parachute rockets, red hand flares and an orange smoke signal – distress signals (COLREG Annex IV) visible from afar.'),
      sections: [
        [L('Rakieta spadochronowa', 'Parachute rocket'), L('Wznosi się na ok. 300 m i świeci na czerwono co najmniej 40 s – widać ją z daleka, nawet zza horyzontu. Odpal, gdy w okolicy może być ktoś, kto ją zobaczy; trzymaj pionowo, przy silnym wietrze lekko z wiatrem. Nigdy w stronę śmigłowca.', 'It climbs to about 300 m and burns red for at least 40 s – it can be seen from far away, even beyond the horizon. Fire it when someone may be in the area to see it; hold it vertically, in a strong wind slightly downwind. Never towards a helicopter.')],
        [L('Pochodnia i dym', 'Hand flare and smoke'), L('Pochodnia ręczna (czerwona, ok. 1 minuty) – gdy ratownicy są już w zasięgu wzroku, żeby wskazać dokładne miejsce; trzymaj po zawietrznej, ręką w rękawicy, nad wodą. Pława dymna (pomarańczowa, ok. 3 minuty) – w dzień, zwłaszcza dla samolotu i śmigłowca; pokazuje też kierunek wiatru.', 'Hand flare (red, about one minute) – when rescuers are already in sight, to pinpoint your position; hold it to leeward with a gloved hand, over the water. Smoke (orange, about 3 minutes) – by day, especially for aircraft and helicopters; it also shows the wind direction.')],
        [L('Przechowywanie', 'Storage'), L('Suchy, wodoszczelny pojemnik pod ręką. Pirotechnika ma datę ważności (zwykle 3–4 lata); przeterminowaną oddaje się do utylizacji – nie odpala „na próbę”.', 'A dry, waterproof container within reach. Flares have an expiry date (usually 3–4 years); hand in expired ones for disposal – do not fire them “to test”.')]
      ]
    },
    firstaid: {
      name: L('Apteczka', 'First-aid kit'),
      short: L('Apteczka jachtowa z instrukcją, dobrana do rejonu i długości rejsu. Przy poważnym urazie lub chorobie wezwij przez radio poradę medyczną (PAN-PAN), a w zagrożeniu życia – MAYDAY.', 'A yacht first-aid kit with instructions, matched to the area and length of the voyage. For a serious injury or illness call for medical advice by radio (PAN-PAN); if life is in danger – MAYDAY.'),
      sections: [
        [L('Porada medyczna przez radio', 'Radio medical advice'), L('Wywołaj stację brzegową lub MRCC i poproś o poradę lekarza (służba TMAS). Przygotuj: wiek i płeć chorego, objawy, puls, oddech, temperaturę, przyjęte leki, pozycję jachtu i czas dotarcia do portu.', 'Call a coast station or the MRCC and ask for a doctor’s advice (TMAS service). Have ready: the patient’s age and sex, symptoms, pulse, breathing, temperature, medication taken, the yacht’s position and time to port.')],
        [L('Zawartość', 'Contents'), L('Opatrunki i bandaże, plastry, opaska uciskowa, folia NRC, rękawiczki, maseczka do resuscytacji, środki przeciwbólowe, na chorobę morską, na oparzenia, krople do oczu, szyny. Sprawdzaj daty ważności przed sezonem.', 'Dressings and bandages, plasters, a tourniquet, a foil blanket, gloves, a resuscitation mask, painkillers, seasickness tablets, burn gel, eye drops, splints. Check expiry dates before the season.')]
      ]
    },
    cardMayday: { name: 'MAYDAY', short: L('Karta procedury: wzywanie pomocy w niebezpieczeństwie (zagrożenie życia lub jachtu). Kliknij, aby przeczytać.', 'Procedure card: distress call (danger to life or the yacht). Click to read.'), sections: [] },
    cardPan: { name: 'PAN-PAN', short: L('Karta procedury: komunikat pilności (pilna sprawa bez bezpośredniego zagrożenia życia). Kliknij, aby przeczytać.', 'Procedure card: urgency message (an urgent matter without immediate danger to life). Click to read.'), sections: [] },
    cardSecurite: { name: 'SÉCURITÉ', short: L('Karta procedury: komunikat bezpieczeństwa (ostrzeżenie nawigacyjne lub meteorologiczne). Kliknij, aby przeczytać.', 'Procedure card: safety message (a navigational or meteorological warning). Click to read.'), sections: [] }
  };
  return D[id];
}
export const DEVICE_IDS = ['epirb', 'sart', 'vhf', 'raft', 'jacket', 'extinguisher', 'flares', 'firstaid', 'cardMayday', 'cardPan', 'cardSecurite'];

// ---------- Kanały VHF (Załącznik 18 Regulaminu Radiokomunikacyjnego ITU + praktyka) ----------
export function channels() {
  return [
    { ch: 16, f: '156.800', use: L('Wzywanie pomocy, pilność, bezpieczeństwo i wywołania – stały nasłuch', 'Distress, urgency, safety and calling – keep a listening watch') },
    { ch: 70, f: '156.525', use: L('Tylko DSC – cyfrowe alarmy i wywołania (zakaz łączności głosowej)', 'DSC only – digital alerts and calls (no voice)') },
    { ch: 6, f: '156.300', use: L('Statek–statek; łączność z samolotami i śmigłowcami w akcji SAR', 'Intership; communication with aircraft and helicopters in SAR operations') },
    { ch: 13, f: '156.650', use: L('Bezpieczeństwo nawigacji „mostek–mostek” (manewry, mijanie)', 'Bridge-to-bridge navigational safety (manoeuvres, passing)') },
    { ch: 8, f: '156.400', use: L('Statek–statek', 'Intership') },
    { ch: 72, f: '156.625', use: L('Statek–statek (popularny wśród jachtów)', 'Intership (popular with yachts)') },
    { ch: 77, f: '156.875', use: L('Statek–statek (popularny wśród jachtów)', 'Intership (popular with yachts)') },
    { ch: 9, f: '156.450', use: L('Operacje portowe i statek–statek; w wielu krajach mariny', 'Port operations and intership; marinas in many countries') },
    { ch: 10, f: '156.500', use: L('Statek–statek i operacje portowe; w wielu krajach także działania przeciw zanieczyszczeniom', 'Intership and port operations; in many countries also pollution response') },
    { ch: 12, f: '156.600', use: L('Operacje portowe, VTS (ruch statków) – kanał podany w locji', 'Port operations, VTS – channel given in the pilot book') },
    { ch: 14, f: '156.700', use: L('Operacje portowe, VTS – kanał podany w locji', 'Port operations, VTS – channel given in the pilot book') },
    { ch: 67, f: '156.375', use: L('Wielka Brytania: kanał roboczy straży wybrzeża dla małych jednostek', 'UK: Coastguard small craft safety working channel') },
    { ch: 80, f: '157.025', use: L('Wielka Brytania: mariny', 'UK: marinas') },
    { ch: 75, f: '156.775', use: L('Kanał osłonowy kanału 16 – tylko łączność dotycząca nawigacji, moc maks. 1 W (także AIS dalekiego zasięgu)', 'Guard channel for channel 16 – navigation-related communications only, max 1 W (also long-range AIS)'), guard: true },
    { ch: 76, f: '156.825', use: L('Kanał osłonowy kanału 16 – tylko łączność dotycząca nawigacji, moc maks. 1 W (także AIS dalekiego zasięgu)', 'Guard channel for channel 16 – navigation-related communications only, max 1 W (also long-range AIS)'), guard: true },
    { ch: 15, f: '156.750', use: L('Sąsiad kanału 16: łączność na pokładzie, moc maks. 1 W', 'Next to channel 16: on-board communications, max 1 W'), guard: true },
    { ch: 17, f: '156.850', use: L('Sąsiad kanału 16: łączność na pokładzie, moc maks. 1 W', 'Next to channel 16: on-board communications, max 1 W'), guard: true },
    { ch: 24, f: '157.200 / 161.800', use: L('Stacje brzegowe – korespondencja publiczna (przykład kanału dupleksowego, także 23–28, 84–87)', 'Coast stations – public correspondence (example duplex channel, also 23–28, 84–87)') }
  ];
}
export const VALID_CHANNELS = [6, 8, 9, 10, 12, 13, 14, 15, 16, 17, 24, 67, 70, 72, 75, 76, 77, 80];

// ---------- Procedury (karty na stole) ----------
export function procedureCard(kind) {
  const P = {
    mayday: {
      title: 'MAYDAY',
      when: L('Niebezpieczeństwo: poważne i bezpośrednie zagrożenie życia lub jachtu – tonięcie, pożar poza kontrolą, człowiek za burtą, wejście na skały, wypadek zagrażający życiu.', 'Distress: grave and imminent danger to life or the yacht – sinking, fire out of control, man overboard, going aground on rocks, a life-threatening accident.'),
      steps: [
        L('Alarm DSC: podnieś osłonę i przytrzymaj DISTRESS ok. 5 s (jeśli zdążysz – najpierw wybierz rodzaj zagrożenia). Radio przejdzie na kanał 16.', 'DSC alert: lift the cover and hold DISTRESS for about 5 s (if there is time – select the nature of distress first). The radio switches to channel 16.'),
        L('Kanał 16, pełna moc (25 W). Naciśnij PTT, mów powoli i wyraźnie:', 'Channel 16, high power (25 W). Press PTT and speak slowly and clearly:')
      ],
      lines: ['MAYDAY, MAYDAY, MAYDAY', 'THIS IS [YACHT ×3], [CALL SIGN], MMSI [9 DIGITS]', 'MAYDAY [YACHT], [CALL SIGN], MMSI', 'MY POSITION [LAT / LONG or bearing and distance from a landmark]', 'NATURE OF DISTRESS [e.g. SINKING / FIRE]', 'I REQUIRE IMMEDIATE ASSISTANCE', '[N] PERSONS ON BOARD', '[OTHER INFORMATION: abandoning to liferaft, EPIRB activated…]', 'OVER'],
      after: L('Czekaj na odpowiedź MRCC lub stacji brzegowej; bez odpowiedzi – powtarzaj. Jeśli nie możesz zostać przy radiu, zostaw je włączone na kanale 16. Fałszywy alarm odwołaj od razu na kanale 16: „ALL STATIONS ×3, THIS IS [jacht ×3], [znak], MMSI …, POSITION …, CANCEL MY DISTRESS ALERT OF [data, czas UTC]”.', 'Wait for the MRCC or a coast station to answer; if there is no answer – repeat. If you cannot stay at the radio, leave it on channel 16. Cancel a false alert straight away on channel 16: “ALL STATIONS ×3, THIS IS [yacht ×3], [call sign], MMSI …, POSITION …, CANCEL MY DISTRESS ALERT OF [date, time UTC]”.')
    },
    pan: {
      title: 'PAN-PAN',
      when: L('Pilność: pilna sprawa bezpieczeństwa jachtu lub osoby, ale bez bezpośredniego zagrożenia życia – awaria steru lub silnika z dryfem w stronę niebezpieczeństwa, uraz lub choroba wymagająca porady lekarza albo ewakuacji.', 'Urgency: an urgent matter concerning the safety of the yacht or a person, without immediate danger to life – steering or engine failure drifting towards danger, an injury or illness requiring a doctor’s advice or evacuation.'),
      steps: [
        L('Można najpierw nadać wywołanie DSC „URGENCY” do wszystkich stacji (kanał 70).', 'You may first send a DSC “URGENCY” call to all stations (channel 70).'),
        L('Kanał 16, pełna moc (25 W):', 'Channel 16, high power (25 W):')
      ],
      lines: ['PAN-PAN, PAN-PAN, PAN-PAN', 'ALL STATIONS, ALL STATIONS, ALL STATIONS', 'THIS IS [YACHT ×3], [CALL SIGN], MMSI', 'MY POSITION […]', '[NATURE OF URGENCY]', 'I REQUIRE [TOW / MEDICAL ADVICE …]', '[N] PERSONS ON BOARD', 'OVER'],
      after: L('Komunikat można skierować do konkretnej stacji (np. MRCC) zamiast „ALL STATIONS”. Gdy problem zniknie – odwołaj komunikat do wszystkich stacji. Gdy sytuacja się pogorszy i zagrozi życiu – nadaj MAYDAY.', 'The message may be addressed to a particular station (e.g. the MRCC) instead of “ALL STATIONS”. When the problem is solved – cancel it to all stations. If the situation worsens and life is in danger – send a MAYDAY.')
    },
    securite: {
      title: 'SÉCURITÉ',
      when: L('Bezpieczeństwo: ważne ostrzeżenie nawigacyjne lub meteorologiczne – dryfująca przeszkoda, niedziałający znak, nagłe załamanie pogody.', 'Safety: an important navigational or meteorological warning – a drifting obstruction, an unlit mark, a sudden deterioration of the weather.'),
      steps: [
        L('1) Zapowiedź na kanale 16 (można też wywołanie DSC „SAFETY”): kim jesteś i na którym kanale roboczym nadasz ostrzeżenie – np. 72 lub 77. Kanał 16 tylko na zapowiedź, żeby nie zajmować go dłużej niż trzeba.', '1) Announcement on channel 16 (or a DSC “SAFETY” call): who you are and on which working channel you will send the warning – e.g. 72 or 77. Channel 16 for the announcement only, so it is not kept busy longer than necessary.'),
        L('2) Przejdź na kanał roboczy i nadaj komunikat:', '2) Change to the working channel and send the message:')
      ],
      lines: ['SÉCURITÉ, SÉCURITÉ, SÉCURITÉ', 'ALL STATIONS, ALL STATIONS, ALL STATIONS', 'THIS IS [YACHT ×3], [CALL SIGN], MMSI', 'POSITION […]', '[WARNING: e.g. DRIFTING CONTAINER, DANGEROUS TO NAVIGATION]', 'OUT'],
      after: L('Zapowiedź na kanale 16 brzmi: „SÉCURITÉ ×3, ALL STATIONS ×3, THIS IS [jacht ×3], [znak], MMSI, NAVIGATIONAL WARNING, LISTEN CHANNEL [72], OUT”. Kanał 06 to kanał statek–statek, ale służy też do łączności z samolotami i śmigłowcami w akcjach SAR – lepiej nie zajmować go komunikatami. SÉCURITÉ kończy się „OUT” – nie oczekujesz odpowiedzi.', 'The announcement on channel 16: “SÉCURITÉ ×3, ALL STATIONS ×3, THIS IS [yacht ×3], [call sign], MMSI, NAVIGATIONAL WARNING, LISTEN CHANNEL [72], OUT”. Channel 06 is an intership channel but is also used for working with aircraft in SAR operations – better not to tie it up with messages. SÉCURITÉ ends with “OUT” – no reply is expected.')
    }
  };
  return P[kind];
}

// ---------- Test korespondencji radiowej ----------
const pick = (r, a) => a[Math.floor(r() * a.length)];
const shuffle = (r, a) => a.map((x) => [r(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
const pad2 = (n) => String(n).padStart(2, '0');
function randomPos(r) {
  const lat = 54 + 25 / 60 + r() * 20 / 60, lon = 18 + 30 / 60 + r() * 40 / 60;
  const dm = (v) => { const d = Math.floor(v), m = (v - d) * 60; return `${d} ${pad2(Math.floor(m))}.${Math.floor((m % 1) * 10)}`; };
  return `${dm(lat)} N, 0${dm(lon)} E`;
}
const OTHERS = ['ORKA', 'MEWA', 'BALTICA', 'NEPTUN', 'ZAWISZA'];

/**
 * Zadanie: { id, kind, text, explain, steps: [{ label, channels, power: 25|1|null, dsc, lines|null, distractors, pool }] }
 * Kroki wykonuje się po kolei (np. SÉCURITÉ: zapowiedź na 16, potem komunikat na kanale roboczym).
 * ship: { name, call, mmsi }
 */
export function makeRadioTask(r, ship, only) {
  const N = ship.name.toUpperCase(), ID = `THIS IS ${N}, ${N}, ${N}, ${ship.call}, MMSI ${ship.mmsi}`;
  const pos = randomPos(r), pob = 2 + Math.floor(r() * 5);
  const step = (o) => ({ label: null, power: null, dsc: false, lines: null, distractors: [], ...o });
  const gens = {
    mayday() {
      const sc = pick(r, [
        { pl: 'Po uderzeniu w zatopioną przeszkodę jacht szybko nabiera wody, pompy nie nadążają.', en: 'After hitting a submerged object the yacht is taking water fast and the pumps cannot keep up.', nat: 'TAKING WATER, SINKING', other: 'PREPARING TO ABANDON TO LIFERAFT' },
        { pl: 'Pożar w komorze silnika, gaśnice nie pomogły, ogień się rozprzestrzenia.', en: 'Fire in the engine compartment, the extinguishers did not help and the fire is spreading.', nat: 'FIRE ON BOARD, OUT OF CONTROL', other: 'LIFERAFT READY' },
        { pl: 'Członek załogi wypadł za burtę, straciliście go z oczu.', en: 'A crew member fell overboard and you have lost sight of them.', nat: 'MAN OVERBOARD, LOST FROM SIGHT', other: 'WE ARE SEARCHING THE AREA' }
      ]);
      return {
        kind: 'mayday',
        text: L(`${sc.pl} Pozycja ${pos}, na pokładzie ${pob} osób. Wezwij pomoc.`, `${sc.en} Position ${pos}, ${pob} persons on board. Call for help.`),
        steps: [step({ channels: [16], power: 25, dsc: true,
          lines: ['MAYDAY, MAYDAY, MAYDAY', ID, `MAYDAY ${N}, ${ship.call}, MMSI ${ship.mmsi}`, `MY POSITION ${pos}`, sc.nat, 'I REQUIRE IMMEDIATE ASSISTANCE', `${pob} PERSONS ON BOARD`, sc.other, 'OVER'],
          distractors: ['PAN-PAN, PAN-PAN, PAN-PAN', 'ALL STATIONS, ALL STATIONS, ALL STATIONS', 'OUT'] })],
        explain: L('Zagrożenie życia → MAYDAY: najpierw alarm DSC (DISTRESS), potem głos na kanale 16 z pełną mocą 25 W; kończysz „OVER”.', 'Danger to life → MAYDAY: first the DSC alert (DISTRESS), then voice on channel 16 at full power (25 W); end with “OVER”.')
      };
    },
    pan() {
      const sc = pick(r, [
        { pl: 'Zerwała się linka sterowa, jacht jest niesterowny i dryfuje w stronę brzegu odległego o 3 Mm. Nikomu nic nie grozi.', en: 'The steering cable has parted, the yacht cannot be steered and is drifting towards the shore 3 NM away. Nobody is in danger.', nat: 'LOST STEERING, DRIFTING TOWARDS THE COAST', req: 'I REQUIRE A TOW' },
        { pl: 'Członek załogi złamał rękę, jest przytomny i stabilny; potrzebujesz porady lekarza.', en: 'A crew member has broken an arm, is conscious and stable; you need a doctor’s advice.', nat: 'CREW MEMBER WITH A BROKEN ARM', req: 'I REQUIRE MEDICAL ADVICE' },
        { pl: 'Silnik nie działa, jest flauta, a prąd znosi jacht na tor wodny.', en: 'The engine has failed, there is no wind and the current is setting the yacht into the fairway.', nat: 'ENGINE FAILURE, DRIFTING INTO THE FAIRWAY', req: 'I REQUIRE A TOW' }
      ]);
      return {
        kind: 'pan',
        text: L(`${sc.pl} Pozycja ${pos}, na pokładzie ${pob} osób.`, `${sc.en} Position ${pos}, ${pob} persons on board.`),
        steps: [step({ channels: [16], power: 25,
          lines: ['PAN-PAN, PAN-PAN, PAN-PAN', 'ALL STATIONS, ALL STATIONS, ALL STATIONS', ID, `MY POSITION ${pos}`, sc.nat, sc.req, `${pob} PERSONS ON BOARD`, 'OVER'],
          distractors: ['MAYDAY, MAYDAY, MAYDAY', 'SÉCURITÉ, SÉCURITÉ, SÉCURITÉ', 'OUT'] })],
        explain: L('Pilna sprawa bez bezpośredniego zagrożenia życia → PAN-PAN na kanale 16 do wszystkich stacji, pełna moc; kończysz „OVER”.', 'Urgent matter without immediate danger to life → PAN-PAN on channel 16 to all stations, full power; end with “OVER”.')
      };
    },
    securite() {
      const sc = pick(r, [
        { pl: 'Mijasz dryfujący kontener, ledwo wystający nad wodę.', en: 'You pass a drifting container, barely above the water.', w: 'DRIFTING CONTAINER, DANGEROUS TO NAVIGATION' },
        { pl: 'Północny znak kardynalny przy torze wodnym nie świeci.', en: 'The north cardinal mark next to the fairway is unlit.', w: 'NORTH CARDINAL MARK UNLIT' },
        { pl: 'Widzisz dryfujący, duży pień drzewa na torze podejściowym.', en: 'You see a large drifting tree trunk in the approach channel.', w: 'DRIFTING TREE TRUNK, DANGEROUS TO NAVIGATION' }
      ]);
      const wc = pick(r, [72, 77]);
      return {
        kind: 'securite',
        text: L(`${sc.pl} Pozycja ${pos}. Ostrzeż inne jednostki – zapowiedz komunikat na kanale 16 i nadaj go na kanale roboczym ${wc}.`, `${sc.en} Position ${pos}. Warn other vessels – announce the message on channel 16 and send it on working channel ${wc}.`),
        steps: [
          step({ label: L('Krok 1: zapowiedź', 'Step 1: announcement'), channels: [16],
            lines: ['SÉCURITÉ, SÉCURITÉ, SÉCURITÉ', 'ALL STATIONS, ALL STATIONS, ALL STATIONS', ID, 'NAVIGATIONAL WARNING', `LISTEN CHANNEL ${wc}`, 'OUT'],
            distractors: ['PAN-PAN, PAN-PAN, PAN-PAN', `POSITION ${pos}`, 'OVER'] }),
          step({ label: L(`Krok 2: komunikat na kanale ${wc}`, `Step 2: the message on channel ${wc}`), channels: [wc],
            lines: ['SÉCURITÉ, SÉCURITÉ, SÉCURITÉ', 'ALL STATIONS, ALL STATIONS, ALL STATIONS', ID, `POSITION ${pos}`, sc.w, 'OUT'],
            distractors: ['I REQUIRE IMMEDIATE ASSISTANCE', `LISTEN CHANNEL ${wc}`, 'OVER'] })
        ],
        explain: L(`Ostrzeżenie nawigacyjne → SÉCURITÉ: na kanale 16 tylko krótka zapowiedź z podaniem kanału roboczego, sam komunikat na kanale ${wc}; oba kończysz „OUT”.`, `Navigational warning → SÉCURITÉ: only a short announcement naming the working channel on channel 16, the message itself on channel ${wc}; end both with “OUT”.`)
      };
    },
    ack() {
      const o = pick(r, OTHERS);
      return {
        kind: 'ack',
        text: L(`Odebrałeś MAYDAY jachtu ${o}, jesteś 2 Mm od niego i możesz pomóc. Stacja brzegowa nie potwierdziła odbioru od 5 minut. Potwierdź odbiór.`, `You have received a MAYDAY from the yacht ${o}; you are 2 NM away and can help. The coast station has not acknowledged for 5 minutes. Acknowledge it.`),
        steps: [step({ channels: [16], power: 25,
          lines: ['MAYDAY', `${o}, ${o}, ${o}`, `THIS IS ${N}, ${N}, ${N}`, 'RECEIVED MAYDAY', 'OVER'],
          distractors: ['ALL STATIONS, ALL STATIONS, ALL STATIONS', 'SÉCURITÉ', 'OUT'] })],
        explain: L('Potwierdzenie MAYDAY: kanał 16, pełna moc – „MAYDAY, [jacht w niebezpieczeństwie ×3], THIS IS [własny ×3], RECEIVED MAYDAY”, potem podaj swoją pozycję i czas dotarcia i przekaż informacje MRCC.', 'Acknowledging a MAYDAY: channel 16, full power – “MAYDAY, [vessel in distress ×3], THIS IS [own ×3], RECEIVED MAYDAY”, then give your position and ETA and pass the information to the MRCC.')
      };
    },
    routine() {
      const o = pick(r, OTHERS), wc = pick(r, [72, 77]);
      return {
        kind: 'routine',
        text: L(`Chcesz porozmawiać z jachtem ${o}, który prowadzi nasłuch na kanale 16 i jest 1 Mm od ciebie. Wywołaj go i zaproponuj przejście na kanał statek–statek ${wc}.`, `You want to talk to the yacht ${o}, which keeps a watch on channel 16 and is 1 NM away. Call it and propose moving to intership channel ${wc}.`),
        steps: [step({ channels: [16],
          lines: [`${o}, ${o}, ${o}`, `THIS IS ${N}, ${N}, ${N}`, `CHANNEL ${wc}`, 'OVER'],
          distractors: ['MAYDAY', 'ALL STATIONS, ALL STATIONS, ALL STATIONS', 'OUT'] })],
        explain: L('Wywołanie rutynowe: krótko na kanale 16 (najpierw stacja wywoływana, potem własna nazwa), od razu przejście na kanał roboczy. Statek jest blisko – zalecana mała moc 1 W.', 'Routine call: briefly on channel 16 (called station first, then your own name), then move straight to a working channel. The vessel is close – low power (1 W) is recommended.')
      };
    },
    bridge() {
      return { kind: 'channel', text: L('W wąskim torze chcesz uzgodnić z mostkiem nadpływającego statku, którą burtą się miniecie.', 'In a narrow channel you want to agree with the bridge of an approaching ship which side you will pass on.'),
        steps: [step({ channels: [13] })], explain: L('Kanał 13 – bezpieczeństwo nawigacji mostek–mostek.', 'Channel 13 – bridge-to-bridge navigational safety.') };
    },
    sar() {
      return { kind: 'channel', text: L('Nad tratwą krąży śmigłowiec SAR, a MRCC poleca rozmawiać z nim bezpośrednio na kanale statek–samolot.', 'A SAR helicopter is circling over the liferaft and the MRCC tells you to talk to it directly on the ship–aircraft channel.'),
        steps: [step({ channels: [6] })], explain: L('Kanał 06 – łączność statków z samolotami i śmigłowcami w akcji SAR.', 'Channel 06 – ship–aircraft communication in SAR operations.') };
    },
    dsc() {
      return { kind: 'channel', text: L('Na którym kanale radio wysyła i odbiera cyfrowe wywołania DSC (alarm DISTRESS)?', 'On which channel does the radio send and receive digital DSC calls (DISTRESS alerts)?'),
        steps: [step({ channels: [70] })], explain: L('Kanał 70 – wyłącznie DSC, bez łączności głosowej.', 'Channel 70 – DSC only, no voice.') };
    },
    port() {
      const ch = pick(r, [12, 14]);
      return { kind: 'channel', text: L(`Locja podaje, że Kapitanat Portu i VTS pracują na kanale ${ch}. Ustaw radio, aby zgłosić wejście do portu.`, `The pilot book says the harbour master and VTS work on channel ${ch}. Set the radio to report entering the harbour.`),
        steps: [step({ channels: [ch] })], explain: L(`Operacje portowe – kanał z locji (${ch}).`, `Port operations – the channel from the pilot book (${ch}).`) };
    },
    onboard() {
      return { kind: 'channel', text: L('Podczas cumowania chcesz rozmawiać przez radiotelefony ręczne z załogą na dziobie (łączność na pokładzie). Ustaw kanał i moc.', 'While mooring you want to talk on handheld radios with the crew on the foredeck (on-board communications). Set the channel and power.'),
        steps: [step({ channels: [15, 17], power: 1 })], explain: L('Łączność na pokładzie: kanały 15 i 17, wyłącznie 1 W – sąsiadują z kanałem 16. Kanały 75 i 76 – tylko łączność nawigacyjna, też 1 W.', 'On-board communications: channels 15 and 17, 1 W only – they are next to channel 16. Channels 75 and 76 – navigation-related only, also 1 W.') };
    },
    intership() {
      return { kind: 'channel', text: L('Chcesz pogadać z kolegą z drugiego jachtu płynącego obok (rutynowa rozmowa statek–statek). Wybierz kanał roboczy.', 'You want a chat with a friend on another yacht sailing nearby (routine intership talk). Choose a working channel.'),
        steps: [step({ channels: [72, 77, 8] })], explain: L('Statek–statek: np. 72, 77 lub 08 – nie 16, 70, 06 ani 13; jacht jest obok, więc zalecana moc 1 W.', 'Intership: e.g. 72, 77 or 08 – not 16, 70, 06 or 13; the yacht is next to you, so 1 W is recommended.') };
    }
  };
  const keys = Object.keys(gens);
  const id = only && gens[only] ? only : keys[Math.floor(r() * keys.length)];
  const t = gens[id]();
  t.id = id;
  for (const st of t.steps) if (st.lines) st.pool = shuffle(r, [...st.lines, ...st.distractors]);
  return t;
}

// ocena kroku: kanał, moc (gdy ma znaczenie), alarm DSC (MAYDAY) i kolejność linii korespondencji
export function checkRadio(step, { channel, power, dscSent, lines }) {
  const chOk = step.channels.includes(Number(channel));
  const powerOk = !step.power || Number(power) === step.power;
  const dscOk = !step.dsc || !!dscSent;
  const msgOk = !step.lines || (lines.length === step.lines.length && lines.every((l, i) => l === step.lines[i]));
  return { chOk, powerOk, dscOk, msgOk, ok: chOk && powerOk && dscOk && msgOk };
}
