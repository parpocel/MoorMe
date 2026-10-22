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
      short: L('Awaryjna radiopława alarmowa – wysyła sygnał wzywania pomocy przez satelity COSPAS-SARSAT.', 'Emergency position-indicating radio beacon – sends a distress alert via the COSPAS-SARSAT satellites.'),
      sections: [
        [L('Częstotliwości', 'Frequencies'), L('406 MHz – zakodowany alarm z identyfikatorem (HEX ID / MMSI) i pozycją GNSS; 121,5 MHz – sygnał naprowadzający dla jednostek i śmigłowców ratowniczych; nowsze modele także AIS (161,975 / 162,025 MHz).', '406 MHz – coded alert with the beacon ID (HEX ID / MMSI) and GNSS position; 121.5 MHz – homing signal for rescue vessels and helicopters; newer models also AIS (161.975 / 162.025 MHz).')],
        [L('Gdzie trafia sygnał', 'Where the signal goes'), L('Satelity COSPAS-SARSAT (MEOSAR, LEOSAR, GEOSAR) → stacja naziemna LUT → centrum MCC → właściwe RCC/MRCC (w Polsce MRCK Gdynia), które koordynuje akcję ratowniczą. Działa na całym świecie (obszary A1–A4).', 'COSPAS-SARSAT satellites (MEOSAR, LEOSAR, GEOSAR) → LUT ground station → MCC → the responsible RCC/MRCC, which coordinates the rescue. Works worldwide (sea areas A1–A4).')],
        [L('Kiedy używać', 'When to use'), L('Tylko w niebezpieczeństwie – bezpośrednie zagrożenie życia lub jachtu, gdy nie da się wezwać pomocy przez VHF albo przy opuszczaniu jachtu. Zabierz radiopławę do tratwy.', 'Only in distress – grave and imminent danger to life or the yacht, when you cannot call for help on VHF or when abandoning ship. Take the beacon into the liferaft.')],
        [L('Jak używać', 'How to use'), L('Wyjmij z uchwytu, wysuń antenę, włącz (ON / zerwanie plomby). Kategoria I uruchamia się sama po zanurzeniu (zwalniak hydrostatyczny). Trzymaj antenę pionowo, nad wodą, z widokiem na niebo; przywiąż linką do tratwy. Nadaje co najmniej 48 h.', 'Remove from the bracket, extend the antenna, switch ON (break the seal). Category I activates automatically when immersed (hydrostatic release). Keep the antenna upright, clear of the water with a view of the sky; tether it to the raft. Transmits for at least 48 h.')],
        [L('Obsługa', 'Maintenance'), L('Rejestracja w urzędzie (dane jachtu i kontakty), comiesięczny autotest (TEST), daty ważności baterii i zwalniaka. Fałszywy alarm: wyłącz i natychmiast powiadom MRCC.', 'Register it (yacht data and contacts), monthly self-test (TEST), check battery and release expiry dates. False alert: switch off and inform the MRCC immediately.')]
      ]
    },
    sart: {
      name: L('Transponder SAR (SART)', 'Search and rescue transponder (SART)'),
      short: L('Pozwala ratownikom odnaleźć tratwę: radar-SART odpowiada na impulsy radaru, AIS-SART nadaje pozycję w AIS.', 'Lets rescuers home in on the liferaft: a radar SART answers radar pulses, an AIS-SART transmits its position over AIS.'),
      sections: [
        [L('Częstotliwości', 'Frequencies'), L('Radar-SART: pasmo 9 GHz (radar X, 9,2–9,5 GHz). AIS-SART: kanały AIS 1 i 2 – 161,975 i 162,025 MHz.', 'Radar SART: 9 GHz band (X-band radar, 9.2–9.5 GHz). AIS-SART: AIS channels 1 and 2 – 161.975 and 162.025 MHz.')],
        [L('Gdzie odbierany', 'Where it is received'), L('Na radarach statków i samolotów: linia 12 kropek od pozycji SART (z bliska łuki, potem okręgi). AIS-SART – na ekranach AIS i ploterach jako kółko z krzyżykiem „SART ACTIVE”. Zasięg ok. 5 Mm ze statku, do 30 Mm z samolotu.', 'On ship and aircraft radars: a line of 12 dots from the SART position (arcs, then circles at close range). AIS-SART – on AIS displays and plotters as a crossed circle “SART ACTIVE”. Range about 5 NM from a ship, up to 30 NM from an aircraft.')],
        [L('Kiedy używać', 'When to use'), L('W tratwie lub w wodzie, gdy czekasz na ratunek – uzupełnia EPIRB (ta alarmuje, SART naprowadza).', 'In the liferaft or in the water while waiting for rescue – it complements the EPIRB (the EPIRB alerts, the SART guides).')],
        [L('Jak używać', 'How to use'), L('Włącz i zamocuj na maszcie teleskopowym min. 1 m nad wodą (wyżej = większy zasięg). Czuwanie 96 h, potem co najmniej 8 h nadawania.', 'Switch on and mount it on the telescopic pole at least 1 m above the water (higher = longer range). 96 h standby, then at least 8 h of transmission.')]
      ]
    },
    vhf: {
      name: L('Radiotelefon VHF z DSC (stacjonarny)', 'Fixed VHF radio with DSC'),
      short: L('Podstawowe radio jachtu: łączność głosowa na kanałach morskich i cyfrowy alarm DSC na kanale 70. Kliknij, aby otworzyć kanały i test.', 'The yacht’s main radio: voice on marine channels and a digital DSC alert on channel 70. Click to open the channels and the test.'),
      sections: [
        [L('Częstotliwości', 'Frequencies'), L('Pasmo morskie VHF 156–162 MHz. Kanał 16 (156,800 MHz) – wzywanie pomocy, pilność, bezpieczeństwo i wywołania; kanał 70 (156,525 MHz) – tylko DSC (bez głosu). Moc 25 W lub 1 W.', 'Marine VHF band 156–162 MHz. Channel 16 (156.800 MHz) – distress, urgency, safety and calling; channel 70 (156.525 MHz) – DSC only (no voice). Power 25 W or 1 W.')],
        [L('Kanały osłonowe', 'Guard channels'), L('Kanał 16 chronią sąsiednie częstotliwości: 75 (156,775) i 76 (156,825 MHz) – tylko łączność nawigacyjna z mocą maks. 1 W – oraz 15 i 17 – łączność na pokładzie, też maks. 1 W. Dzięki temu silny nadajnik obok nie zagłusza wezwań o pomoc na 16.', 'Channel 16 is protected by the adjacent frequencies: 75 (156.775) and 76 (156.825 MHz) – navigation-related communications only, max 1 W – and 15 and 17 – on-board communications, also max 1 W. This keeps a strong transmitter next door from blocking distress calls on 16.')],
        [L('Gdzie odbierany', 'Where it is received'), L('Stacje brzegowe i MRCC oraz statki w zasięgu – praktycznie linia horyzontu radiowego, dla jachtu ok. 20–30 Mm (obszar A1).', 'Coast stations and MRCCs, plus vessels within range – roughly the radio horizon, about 20–30 NM for a yacht (sea area A1).')],
        [L('Alarm DSC', 'DSC alert'), L('Podnieś osłonę, przytrzymaj DISTRESS ok. 5 s (najpierw, jeśli zdążysz, wybierz rodzaj zagrożenia). Radio wysyła MMSI i pozycję z GPS, powtarza alarm do potwierdzenia. Potem nadaj MAYDAY głosem na kanale 16.', 'Lift the cover and hold DISTRESS for about 5 s (if there is time, select the nature of distress first). The radio sends the MMSI and the GPS position and repeats the alert until acknowledged. Then send the MAYDAY by voice on channel 16.')],
        [L('Wymagania', 'Requirements'), L('Świadectwo operatora (SRC), pozwolenie radiowe dla jachtu, numer MMSI i znak wywoławczy; podłączony GPS.', 'Operator’s certificate (SRC), ship station licence, MMSI and call sign; a connected GPS.')]
      ]
    },
    raft: {
      name: L('Tratwa ratunkowa', 'Liferaft'),
      short: L('Samonapełniająca się tratwa (ISO 9650) w torbie lub pojemniku – ostatnia deska ratunku po opuszczeniu jachtu.', 'Self-inflating liferaft (ISO 9650) in a valise or canister – the last resort after abandoning the yacht.'),
      sections: [
        [L('Kiedy', 'When'), L('Opuszczaj jacht dopiero wtedy, gdy naprawdę tonie lub płonie – „wchodzi się do tratwy w górę”. Wcześniej nadaj MAYDAY i uruchom EPIRB.', 'Leave the yacht only when it is really sinking or burning – “step up into the liferaft”. Send a MAYDAY and activate the EPIRB first.')],
        [L('Jak', 'How'), L('Przywiąż linkę (fangę) do mocnego punktu, wyrzuć tratwę po zawietrznej, szarpnij fangę – butla CO₂ napełni tratwę. Wsiadaj prosto z pokładu, najsilniejsza osoba pierwsza, potem pomoże reszcie. Odetnij fangę nożem z tratwy, wypuść dryfkotwę.', 'Tie the painter to a strong point, launch the raft to leeward, pull the painter – the CO₂ cylinder inflates it. Board directly from the deck, strongest person first to help the others. Cut the painter with the raft knife and stream the drogue.')],
        [L('Wyposażenie', 'Contents'), L('Dryfkotwa, wiosełka, czerpak, nóż, zestaw naprawczy, pirotechnika, woda, apteczka, latarka. Zabierz też: EPIRB, SART, VHF ręczne, dziennik pokładowy (ostatnia pozycja, kurs, wydarzenia – potrzebne ratownikom i do raportu), dokumenty jachtu i załogi, wodę, ciepłe ubrania, leki.', 'Drogue, paddles, bailer, knife, repair kit, flares, water, first-aid kit, torch. Also take: EPIRB, SART, handheld VHF, the logbook (last position, course, events – needed by rescuers and for the report), the yacht’s and crew’s documents, water, warm clothing, medication.')],
        [L('Obsługa', 'Maintenance'), L('Przegląd w serwisie co 1–3 lata (wg producenta), zwalniak hydrostatyczny (np. Hammar) – wymiana co 2 lata.', 'Service every 1–3 years (per the manufacturer), hydrostatic release (e.g. Hammar) – replace every 2 years.')]
      ]
    },
    jacket: {
      name: L('Kamizelka ratunkowa (pneumatyczna)', 'Lifejacket (inflatable)'),
      short: L('Kamizelka 150 N (ISO 12402-3) z automatycznym napełnianiem, szelkami i pasem krokowym – utrzymuje twarz nad wodą.', '150 N lifejacket (ISO 12402-3) with automatic inflation, harness and crotch strap – keeps the face clear of the water.'),
      sections: [
        [L('Kiedy zakładać', 'When to wear it'), L('Zawsze na pokładzie nocą, przy złej pogodzie, przy samotnej wachcie, w pontonie i przy manewrach w porcie, jeśli tak ustali kapitan. Na sztormowej pogodzie przypinaj się lifeliną do linki asekuracyjnej.', 'Always on deck at night, in bad weather, on a solo watch, in the tender and during harbour manoeuvres if the skipper says so. In heavy weather clip your lifeline to the jackstay.')],
        [L('Budowa', 'Features'), L('Butla CO₂ i automat (tabletka lub hydrostat), linka do ręcznego napełnienia, ustnik, światło, gwizdek, kaptur przeciwbryzgowy, pas krokowy, kółko D do lifeliny, taśmy odblaskowe.', 'CO₂ cylinder and automatic firing head (bobbin or hydrostatic), manual pull toggle, oral inflation tube, light, whistle, spray hood, crotch strap, D-ring for the lifeline, reflective tape.')],
        [L('Kontrola', 'Checks'), L('Przed rejsem: butla dokręcona i nieprzebita, wskaźnik automatu zielony, data ważności, pas krokowy dopasowany.', 'Before sailing: cylinder screwed in and not pierced, firing head indicator green, expiry date, crotch strap adjusted.')]
      ]
    },
    extinguisher: {
      name: L('Gaśnica proszkowa', 'Dry-powder fire extinguisher'),
      short: L('Gaśnica 2 kg ABC przy zejściówce – na pożary materiałów stałych, paliwa i instalacji elektrycznej.', '2 kg ABC extinguisher by the companionway – for fires of solids, fuel and electrical installations.'),
      sections: [[L('Jak', 'How'), L('Zerwij zawleczkę, celuj w podstawę ognia krótkimi seriami, stój tyłem do drogi ucieczki. Pożar w maszynowni – nie otwieraj szeroko pokrywy (dopływ powietrza). Gdy ogień jest poza kontrolą – MAYDAY.', 'Pull the pin, aim at the base of the fire in short bursts, keep your escape route behind you. Engine fire – do not open the hatch wide (air supply). If the fire is out of control – MAYDAY.')]]
    },
    flares: {
      name: L('Pirotechnika ratunkowa', 'Distress flares'),
      short: L('Rakiety spadochronowe (czerwone), pochodnie ręczne i pławka dymna – sygnały niebezpieczeństwa widoczne z daleka.', 'Red parachute rockets, red hand flares and an orange smoke signal – distress signals visible from afar.'),
      sections: [[L('Jak', 'How'), L('Rakietę odpal z wiatrem lekko z boku, gdy w pobliżu może być ktoś, kto ją zobaczy; pochodnię trzymaj po zawietrznej, gdy ratownicy są blisko; dym – w dzień, dla śmigłowca. Sprawdzaj daty ważności.', 'Fire a rocket slightly downwind when someone may be close enough to see it; hold a hand flare to leeward when rescuers are near; smoke – by day, for a helicopter. Check expiry dates.')]]
    },
    firstaid: {
      name: L('Apteczka', 'First-aid kit'),
      short: L('Apteczka jachtowa z instrukcją – w razie poważnego urazu wezwij poradę medyczną przez radio (PAN-PAN).', 'Yacht first-aid kit with instructions – for a serious injury call for medical advice by radio (PAN-PAN).'),
      sections: []
    },
    cardMayday: { name: 'MAYDAY', short: L('Karta procedury: wzywanie pomocy w niebezpieczeństwie. Kliknij, aby przeczytać.', 'Procedure card: distress call. Click to read.'), sections: [] },
    cardPan: { name: 'PAN-PAN', short: L('Karta procedury: komunikat pilności. Kliknij, aby przeczytać.', 'Procedure card: urgency message. Click to read.'), sections: [] },
    cardSecurite: { name: 'SÉCURITÉ', short: L('Karta procedury: komunikat bezpieczeństwa. Kliknij, aby przeczytać.', 'Procedure card: safety message. Click to read.'), sections: [] }
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
      when: L('Niebezpieczeństwo: poważne i bezpośrednie zagrożenie życia lub jachtu (tonięcie, pożar poza kontrolą, człowiek za burtą, wejście na skały).', 'Distress: grave and imminent danger to life or the yacht (sinking, fire out of control, man overboard, going aground on rocks).'),
      steps: [
        L('Alarm DSC: podnieś osłonę, przytrzymaj DISTRESS 5 s (jeśli zdążysz – wybierz rodzaj zagrożenia).', 'DSC alert: lift the cover, hold DISTRESS for 5 s (if there is time – select the nature of distress).'),
        L('Kanał 16, pełna moc (25 W). Naciśnij PTT i mów powoli, wyraźnie:', 'Channel 16, high power (25 W). Press PTT and speak slowly and clearly:')
      ],
      lines: ['MAYDAY, MAYDAY, MAYDAY', 'THIS IS [YACHT ×3], [CALL SIGN], MMSI [9 DIGITS]', 'MAYDAY [YACHT], [CALL SIGN], MMSI', 'MY POSITION [LAT / LONG or bearing and distance from a landmark]', 'NATURE OF DISTRESS [e.g. SINKING / FIRE]', 'I REQUIRE IMMEDIATE ASSISTANCE', '[N] PERSONS ON BOARD', '[OTHER INFORMATION: abandoning to liferaft, EPIRB activated…]', 'OVER'],
      after: L('Czekaj na odpowiedź MRCC/stacji brzegowej; bez odpowiedzi – powtarzaj. Odwołanie fałszywego alarmu: kanał 16 „ALL STATIONS ×3, THIS IS …, MMSI …, POSITION …, CANCEL MY DISTRESS ALERT OF [time]”.', 'Wait for the MRCC / coast station to answer; if there is no answer – repeat. Cancelling a false alert: channel 16 “ALL STATIONS ×3, THIS IS …, MMSI …, POSITION …, CANCEL MY DISTRESS ALERT OF [time]”.')
    },
    pan: {
      title: 'PAN-PAN',
      when: L('Pilność: pilna sprawa bezpieczeństwa jachtu lub osoby, ale bez bezpośredniego zagrożenia życia (awaria steru lub silnika z dryfem na niebezpieczeństwo, uraz wymagający porady medycznej).', 'Urgency: an urgent matter concerning the safety of the yacht or a person, without immediate danger to life (steering or engine failure drifting into danger, injury requiring medical advice).'),
      steps: [
        L('Opcjonalnie wywołanie DSC „URGENCY” do wszystkich stacji.', 'Optionally a DSC “URGENCY” call to all stations.'),
        L('Kanał 16:', 'Channel 16:')
      ],
      lines: ['PAN-PAN, PAN-PAN, PAN-PAN', 'ALL STATIONS, ALL STATIONS, ALL STATIONS', 'THIS IS [YACHT ×3], [CALL SIGN], MMSI', 'MY POSITION […]', '[NATURE OF URGENCY]', 'I REQUIRE [TOW / MEDICAL ADVICE …]', '[N] PERSONS ON BOARD', 'OVER'],
      after: L('Gdy problem zniknie – odwołaj komunikat do wszystkich stacji.', 'When the problem is solved – cancel the message to all stations.')
    },
    securite: {
      title: 'SÉCURITÉ',
      when: L('Bezpieczeństwo: ważne ostrzeżenie nawigacyjne lub meteorologiczne (dryfująca przeszkoda, niedziałający znak, nagłe załamanie pogody).', 'Safety: an important navigational or meteorological warning (drifting obstruction, unlit mark, sudden deterioration of the weather).'),
      steps: [
        L('Na kanale 16 zapowiedz komunikat i podaj kanał roboczy (np. 06 albo 13); długi komunikat nadaj już na kanale roboczym.', 'On channel 16 announce the message and give a working channel (e.g. 06 or 13); send a long message on the working channel.'),
        L('Komunikat:', 'Message:')
      ],
      lines: ['SÉCURITÉ, SÉCURITÉ, SÉCURITÉ', 'ALL STATIONS, ALL STATIONS, ALL STATIONS', 'THIS IS [YACHT ×3], [CALL SIGN], MMSI', 'POSITION […]', '[WARNING: e.g. DRIFTING CONTAINER, DANGEROUS TO NAVIGATION]', 'OUT'],
      after: L('SÉCURITÉ kończy się „OUT” – nie oczekujesz odpowiedzi.', 'SÉCURITÉ ends with “OUT” – no reply is expected.')
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
 * Zadanie: { id, kind, text, channels: [poprawne kanały], dsc: wymagany alarm DSC, lines: [poprawna kolejność] | null, distractors, explain }
 * ship: { name, call, mmsi }
 */
export function makeRadioTask(r, ship, only) {
  const N = ship.name.toUpperCase(), ID = `THIS IS ${N}, ${N}, ${N}, ${ship.call}, MMSI ${ship.mmsi}`;
  const pos = randomPos(r), pob = 2 + Math.floor(r() * 5);
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
        channels: [16], dsc: true,
        lines: ['MAYDAY, MAYDAY, MAYDAY', ID, `MAYDAY ${N}, ${ship.call}, MMSI ${ship.mmsi}`, `MY POSITION ${pos}`, sc.nat, 'I REQUIRE IMMEDIATE ASSISTANCE', `${pob} PERSONS ON BOARD`, sc.other, 'OVER'],
        distractors: ['PAN-PAN, PAN-PAN, PAN-PAN', 'ALL STATIONS, ALL STATIONS, ALL STATIONS', 'OUT'],
        explain: L('Zagrożenie życia → MAYDAY: najpierw alarm DSC (DISTRESS), potem głos na kanale 16; kończysz „OVER”.', 'Danger to life → MAYDAY: first the DSC alert (DISTRESS), then voice on channel 16; end with “OVER”.')
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
        channels: [16], dsc: false,
        lines: ['PAN-PAN, PAN-PAN, PAN-PAN', 'ALL STATIONS, ALL STATIONS, ALL STATIONS', ID, `MY POSITION ${pos}`, sc.nat, sc.req, `${pob} PERSONS ON BOARD`, 'OVER'],
        distractors: ['MAYDAY, MAYDAY, MAYDAY', 'SÉCURITÉ, SÉCURITÉ, SÉCURITÉ', 'OUT'],
        explain: L('Pilna sprawa bez bezpośredniego zagrożenia życia → PAN-PAN na kanale 16 do wszystkich stacji; kończysz „OVER”.', 'Urgent matter without immediate danger to life → PAN-PAN on channel 16 to all stations; end with “OVER”.')
      };
    },
    securite() {
      const sc = pick(r, [
        { pl: 'Mijasz dryfujący kontener, ledwo wystający nad wodę.', en: 'You pass a drifting container, barely above the water.', w: 'DRIFTING CONTAINER, DANGEROUS TO NAVIGATION' },
        { pl: 'Północny znak kardynalny przy torze wodnym nie świeci.', en: 'The north cardinal mark next to the fairway is unlit.', w: 'NORTH CARDINAL MARK UNLIT' },
        { pl: 'Widzisz dryfujący, duży pień drzewa na torze podejściowym.', en: 'You see a large drifting tree trunk in the approach channel.', w: 'DRIFTING TREE TRUNK, DANGEROUS TO NAVIGATION' }
      ]);
      return {
        kind: 'securite',
        text: L(`${sc.pl} Pozycja ${pos}. Ostrzeż inne jednostki.`, `${sc.en} Position ${pos}. Warn other vessels.`),
        channels: [16], dsc: false,
        lines: ['SÉCURITÉ, SÉCURITÉ, SÉCURITÉ', 'ALL STATIONS, ALL STATIONS, ALL STATIONS', ID, `POSITION ${pos}`, sc.w, 'OUT'],
        distractors: ['PAN-PAN, PAN-PAN, PAN-PAN', 'I REQUIRE IMMEDIATE ASSISTANCE', 'OVER'],
        explain: L('Ostrzeżenie nawigacyjne → SÉCURITÉ; zapowiedź na kanale 16 (dłuższy komunikat na kanale roboczym); kończysz „OUT”.', 'Navigational warning → SÉCURITÉ; announce on channel 16 (a longer message on a working channel); end with “OUT”.')
      };
    },
    ack() {
      const o = pick(r, OTHERS);
      return {
        kind: 'ack',
        text: L(`Odebrałeś MAYDAY jachtu ${o}, jesteś 2 Mm od niego i możesz pomóc. Stacja brzegowa nie potwierdziła odbioru od 5 minut. Potwierdź odbiór.`, `You have received a MAYDAY from the yacht ${o}; you are 2 NM away and can help. The coast station has not acknowledged for 5 minutes. Acknowledge it.`),
        channels: [16], dsc: false,
        lines: ['MAYDAY', `${o}, ${o}, ${o}`, `THIS IS ${N}, ${N}, ${N}`, 'RECEIVED MAYDAY', 'OVER'],
        distractors: ['ALL STATIONS, ALL STATIONS, ALL STATIONS', 'SÉCURITÉ', 'OUT'],
        explain: L('Potwierdzenie MAYDAY: kanał 16 – „MAYDAY, [jacht w niebezpieczeństwie ×3], THIS IS [własny ×3], RECEIVED MAYDAY”, potem przekaż MRCC informacje.', 'Acknowledging a MAYDAY: channel 16 – “MAYDAY, [vessel in distress ×3], THIS IS [own ×3], RECEIVED MAYDAY”, then pass the information to the MRCC.')
      };
    },
    routine() {
      const o = pick(r, OTHERS), wc = pick(r, [72, 77]);
      return {
        kind: 'routine',
        text: L(`Chcesz porozmawiać z jachtem ${o}, który prowadzi nasłuch na kanale 16. Wywołaj go i zaproponuj przejście na kanał statek–statek ${wc}.`, `You want to talk to the yacht ${o}, which keeps a watch on channel 16. Call it and propose moving to intership channel ${wc}.`),
        channels: [16], dsc: false,
        lines: [`${o}, ${o}, ${o}`, `THIS IS ${N}, ${N}, ${N}`, `CHANNEL ${wc}`, 'OVER'],
        distractors: ['MAYDAY', 'ALL STATIONS, ALL STATIONS, ALL STATIONS', 'OUT'],
        explain: L('Wywołanie rutynowe: krótko na kanale 16 (najpierw stacja wywoływana, potem własna nazwa), od razu przejście na kanał roboczy.', 'Routine call: briefly on channel 16 (called station first, then your own name), then move straight to a working channel.')
      };
    },
    bridge() {
      return {
        kind: 'channel', text: L('W wąskim torze chcesz uzgodnić z mostkiem nadpływającego statku, którą burtą się miniecie.', 'In a narrow channel you want to agree with the bridge of an approaching ship which side you will pass on.'),
        channels: [13], dsc: false, lines: null, explain: L('Kanał 13 – bezpieczeństwo nawigacji mostek–mostek.', 'Channel 13 – bridge-to-bridge navigational safety.')
      };
    },
    sar() {
      return {
        kind: 'channel', text: L('Nad tratwą krąży śmigłowiec SAR, a MRCC poleca rozmawiać z nim bezpośrednio na kanale statek–samolot.', 'A SAR helicopter is circling over the liferaft and the MRCC tells you to talk to it directly on the ship–aircraft channel.'),
        channels: [6], dsc: false, lines: null, explain: L('Kanał 06 – łączność statków z samolotami i śmigłowcami w akcji SAR.', 'Channel 06 – ship–aircraft communication in SAR operations.')
      };
    },
    dsc() {
      return {
        kind: 'channel', text: L('Na którym kanale radio wysyła i odbiera cyfrowe wywołania DSC (alarm DISTRESS)?', 'On which channel does the radio send and receive digital DSC calls (DISTRESS alerts)?'),
        channels: [70], dsc: false, lines: null, explain: L('Kanał 70 – wyłącznie DSC, bez łączności głosowej.', 'Channel 70 – DSC only, no voice.')
      };
    },
    port() {
      const ch = pick(r, [12, 14]);
      return {
        kind: 'channel', text: L(`Locja podaje, że Kapitanat Portu i VTS pracują na kanale ${ch}. Ustaw radio, aby zgłosić wejście do portu.`, `The pilot book says the harbour master and VTS work on channel ${ch}. Set the radio to report entering the harbour.`),
        channels: [ch], dsc: false, lines: null, explain: L(`Operacje portowe – kanał z locji (${ch}).`, `Port operations – the channel from the pilot book (${ch}).`)
      };
    },
    onboard() {
      return {
        kind: 'channel', text: L('Podczas cumowania chcesz rozmawiać przez radiotelefony ręczne z załogą na dziobie (łączność na pokładzie, mała moc).', 'While mooring you want to talk on handheld radios with the crew on the foredeck (on-board communications, low power).'),
        channels: [15, 17], dsc: false, lines: null, explain: L('Łączność na pokładzie: kanały 15 i 17, moc 1 W – sąsiadują z kanałem 16, więc tylko mała moc. Kanały 75 i 76 – tylko łączność nawigacyjna, też 1 W.', 'On-board communications: channels 15 and 17 at 1 W – they are next to channel 16, so low power only. Channels 75 and 76 – navigation-related only, also 1 W.')
      };
    },
    intership() {
      return {
        kind: 'channel', text: L('Chcesz pogadać z kolegą z drugiego jachtu płynącego obok (rutynowa rozmowa statek–statek). Wybierz kanał roboczy.', 'You want a chat with a friend on another yacht sailing nearby (routine intership talk). Choose a working channel.'),
        channels: [72, 77, 8], dsc: false, lines: null, explain: L('Statek–statek: np. 72, 77 lub 08 – nie 16, 70, 06 ani 13.', 'Intership: e.g. 72, 77 or 08 – not 16, 70, 06 or 13.')
      };
    }
  };
  const keys = Object.keys(gens);
  const id = only && gens[only] ? only : keys[Math.floor(r() * keys.length)];
  const t = gens[id]();
  t.id = id;
  if (t.lines) t.pool = shuffle(r, [...t.lines, ...t.distractors]);
  return t;
}

// ocena: kanał, DSC (dla MAYDAY) i kolejność linii korespondencji
export function checkRadio(task, { channel, dscSent, lines }) {
  const chOk = task.channels.includes(Number(channel));
  const dscOk = !task.dsc || !!dscSent;
  const msgOk = !task.lines || (lines.length === task.lines.length && lines.every((l, i) => l === task.lines[i]));
  return { chOk, dscOk, msgOk, ok: chOk && dscOk && msgOk };
}
