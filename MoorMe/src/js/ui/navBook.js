// Podręcznik działu „Zadania nawigacyjne”: oznaczenia kursów, przeliczanie KK ↔ KDd (dewiacja, deklinacja, dryf, prąd),
// namiary i ich nanoszenie, linie pozycyjne i pozycja z namiarów, zliczenie drogi, czas–prędkość–droga, zasięg świateł.
import { h } from './dom.js';
import { getLang } from '../i18n.js';

const L = (pl, en) => (getLang() === 'en' ? en : pl);
const svgBox = (w, hh, inner, wide = false) => { const d = document.createElement('div'); d.className = 'hb-svg nb-fig' + (wide ? ' nb-wide' : ''); d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hh}" width="${w}" height="${hh}" font-family="Nunito, sans-serif">${inner}</svg>`; return d; };
const P = (...t) => h('p', {}, ...t);
const B = (t) => h('b', {}, t);
// lekcja na pełną szerokość: tekst po lewej, rysunek po prawej (rysunek „szeroki” – nad tekstem)
const isFig = (k) => k && k.classList && k.classList.contains('nb-fig');
const entry = (title, ...kids) => {
  kids = kids.filter(Boolean);
  const wide = kids.filter((k) => isFig(k) && k.classList.contains('nb-wide')), figs = kids.filter((k) => isFig(k) && !wide.includes(k)), text = kids.filter((k) => !isFig(k));
  return h('section.nb-lesson', {}, title ? h('h3', {}, title) : null, ...wide,
    h('div.nb-cols', { class: figs.length ? 'has-fig' : '' }, h('div.nb-text', {}, ...text), figs.length ? h('div.nb-figcol', {}, ...figs) : null));
};
// ramka z przykładem i z uwagą
const ex = (...t) => h('div.nb-example', {}, h('div.nb-tag', {}, L('Przykład', 'Example')), h('p', {}, ...t));
const note = (...t) => h('div.nb-note', {}, h('div.nb-tag', {}, L('Uwaga', 'Note')), h('p', {}, ...t));
const steps = (...li) => h('ol.nb-steps', {}, ...li.map((x) => h('li', {}, ...(Array.isArray(x) ? x : [x]))));
const table = (head, rows) => h('div.hb-ct-wrap', {}, h('table.hb-ctable', {}, h('tr', {}, ...head.map((x) => h('th', {}, x))), ...rows.map((r) => h('tr', {}, ...r.map((c) => h('td', {}, c))))));
const formula = (...lines) => h('div.nb-formula', {}, ...lines.map((l) => h('div', {}, l)));

// łańcuch kursów KK → KM → KR → KDw → KDd
function chainSVG() {
  const items = [['KK', L('kompasowy', 'compass')], ['KM', L('magnetyczny', 'magnetic')], ['KR', L('rzeczywisty', 'true')], ['KDw', L('drogi nad wodą', 'over water')], ['KDd', L('drogi nad dnem', 'over ground')]];
  const corr = ['+ δ', '+ d', '+ β', L('+ prąd', '+ current')];
  const W = 740, x0 = 20, step = 150;
  let g = `<rect width="${W}" height="150" rx="12" fill="#f6f1e1"/>`;
  items.forEach(([k, n], i) => {
    const x = x0 + i * step;
    g += `<rect x="${x}" y="40" width="${i === 4 ? 100 : 90}" height="48" rx="10" fill="#2f4468"/><text x="${x + (i === 4 ? 50 : 45)}" y="70" fill="#fff" font-size="20" font-weight="800" text-anchor="middle">${k}</text>`;
    g += `<text x="${x + (i === 4 ? 50 : 45)}" y="106" fill="#2f4468" font-size="12" text-anchor="middle">${n}</text>`;
    if (i < 4) {
      g += `<path d="M${x + 94} 56 H${x + step - 6}" stroke="#c2410c" stroke-width="2.5" marker-end="url(#nbA)"/><text x="${x + 92 + (step - 96) / 2}" y="48" fill="#c2410c" font-size="14" font-weight="800" text-anchor="middle">${corr[i]}</text>`;
      g += `<path d="M${x + step - 6} 74 H${x + 94}" stroke="#4a7c59" stroke-width="2.5" marker-end="url(#nbB)"/><text x="${x + 92 + (step - 96) / 2}" y="90" fill="#4a7c59" font-size="13" font-weight="800" text-anchor="middle">${corr[i].replace('+', '−')}</text>`;
    }
  });
  g += `<text x="20" y="24" fill="#c2410c" font-size="13" font-weight="700">${L('w prawo: dodajemy poprawki', 'to the right: add the corrections')}</text><text x="20" y="136" fill="#4a7c59" font-size="13" font-weight="700">${L('w lewo: odejmujemy poprawki', 'to the left: subtract the corrections')}</text>`;
  return svgBox(W, 150, `<defs><marker id="nbA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#c2410c"/></marker><marker id="nbB" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#4a7c59"/></marker></defs>${g}`, true);
}

// kierunki północy: rzeczywista, magnetyczna, kompasowa i poprawki między nimi
function northsSVG() {
  const cx = 120, cy = 250, R = 210;
  const pt = (deg, r) => [cx + Math.sin((deg * Math.PI) / 180) * r, cy - Math.cos((deg * Math.PI) / 180) * r];
  const ray = (deg, col, lbl, dash = '', rr = R) => { const [x, y] = pt(deg, rr); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${col}" stroke-width="3" ${dash}/><text x="${x}" y="${y - 8}" fill="${col}" font-size="16" font-weight="800" text-anchor="middle">${lbl}</text>`; };
  const arc = (a0, a1, r, col, lbl) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r), [lx, ly] = pt((a0 + a1) / 2, r + 14); return `<path d="M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}" fill="none" stroke="${col}" stroke-width="2.5"/><text x="${lx}" y="${ly + 5}" fill="${col}" font-size="16" font-weight="800" text-anchor="middle">${lbl}</text>`; };
  let g = `<rect width="560" height="270" rx="12" fill="#f6f1e1"/>`;
  g += ray(0, '#1b1f24', 'Nr') + ray(14, '#2563eb', 'Nm') + ray(28, '#c2410c', 'Nk') + ray(58, '#2f4468', L('dziób', 'bow'), 'stroke-dasharray="7 5"', 175);
  g += arc(0, 14, 150, '#2563eb', 'd') + arc(14, 28, 115, '#c2410c', 'δ');
  const leg = [['#1b1f24', L('Nr – północ rzeczywista', 'Nt – true north')], ['#2563eb', L('Nm – północ magnetyczna', 'Nm – magnetic north')], ['#c2410c', L('Nk – północ kompasowa', 'Nc – compass north')], null,
    ['#2563eb', L('d – deklinacja (od Nr do Nm)', 'd – variation (Nt to Nm)')], ['#c2410c', L('δ – dewiacja (od Nm do Nk)', 'δ – deviation (Nm to Nc)')], null,
    ['#2f4468', L('E / w prawo = dodatnie (+)', 'E / to the right = positive (+)')], ['#2f4468', L('W / w lewo = ujemne (−)', 'W / to the left = negative (−)')]];
  let y = 46;
  for (const it of leg) { if (!it) { y += 12; continue; } g += `<text x="318" y="${y}" fill="${it[0]}" font-size="15">${it[1]}</text>`; y += 24; }
  return svgBox(560, 270, g);
}

// trójkąt prędkości: KR/V po wodzie + prąd = KDd/SOG nad dnem
function currentSVG() {
  const A = [50, 220], Bp = [250, 60], C = [330, 120];
  const arrow = (p, q, col, w = 3) => `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${col}" stroke-width="${w}" marker-end="url(#nbC${col.slice(1)})"/>`;
  const mk = (col) => `<marker id="nbC${col.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${col}"/></marker>`;
  let g = `<defs>${mk('#2f4468')}${mk('#2563eb')}${mk('#c2410c')}</defs><rect width="420" height="250" rx="12" fill="#f6f1e1"/>`;
  g += arrow(A, Bp, '#2f4468') + arrow(Bp, C, '#2563eb') + arrow(A, C, '#c2410c', 3.5);
  g += `<text x="${(A[0] + Bp[0]) / 2 - 14}" y="${(A[1] + Bp[1]) / 2 - 6}" fill="#2f4468" font-size="13" font-weight="800" text-anchor="end">${L('KDw, V (po wodzie)', 'CTW, STW (through water)')}</text>`;
  g += `<text x="${Bp[0] - 10}" y="${Bp[1] - 16}" fill="#2563eb" font-size="13" font-weight="800">${L('prąd: kierunek, prędkość', 'current: set, rate')}</text>`;
  g += `<text x="${(A[0] + C[0]) / 2 + 10}" y="${(A[1] + C[1]) / 2 + 30}" fill="#c2410c" font-size="13" font-weight="800">${L('KDd, SOG (nad dnem)', 'COG, SOG (over ground)')}</text>`;
  g += `<circle cx="${A[0]}" cy="${A[1]}" r="4" fill="#1b1f24"/><text x="${A[0] - 6}" y="${A[1] + 20}" font-size="12">${L('pozycja wyjściowa', 'start')}</text>`;
  return svgBox(420, 250, g);
}

// pozycja z dwóch namiarów
function fixSVG() {
  let g = `<rect width="420" height="250" rx="12" fill="#eef5fa"/>`;
  g += `<path d="M20 30 Q60 20 90 50 T140 40 L150 0 L0 0 L0 60 Z" fill="#f2e2b0" stroke="#5b4a2c"/><path d="M300 0 L420 0 L420 90 Q380 70 350 80 T300 40 Z" fill="#f2e2b0" stroke="#5b4a2c"/>`;
  g += `<g fill="#1b1f24"><path d="M96 46 l5 -12 l5 12 z"/></g><text x="90" y="64" font-size="12" text-anchor="end">${L('latarnia A', 'light A')}</text>`;
  g += `<g fill="#1b1f24"><path d="M344 70 l5 -12 l5 12 z"/></g><text x="362" y="100" font-size="12">${L('cypel B', 'point B')}</text>`;
  g += `<line x1="101" y1="44" x2="250" y2="236" stroke="#2f4468" stroke-width="2"/><line x1="349" y1="68" x2="160" y2="236" stroke="#2f4468" stroke-width="2"/>`;
  g += `<circle cx="214" cy="190" r="6" fill="none" stroke="#c2410c" stroke-width="2.5"/><circle cx="214" cy="190" r="2" fill="#c2410c"/><text x="226" y="194" fill="#c2410c" font-size="13" font-weight="800">${L('pozycja obserwowana', 'observed fix')}</text>`;
  g += `<text x="20" y="150" fill="#2f4468" font-size="12">${L('NR na A = 145°', 'TB of A = 145°')}</text><text x="300" y="160" fill="#2f4468" font-size="12">${L('NR na B = 222°', 'TB of B = 222°')}</text>`;
  return svgBox(420, 250, g);
}

// namiar podwójny: kąt kursowy 45° i 90° (namiar czteropunktowy)
function doubleSVG() {
  let g = `<rect width="420" height="220" rx="12" fill="#eef5fa"/>`;
  g += `<line x1="30" y1="180" x2="390" y2="180" stroke="#2f4468" stroke-width="2.5" stroke-dasharray="8 5"/><text x="392" y="170" fill="#2f4468" font-size="12" text-anchor="end">${L('kurs', 'course')}</text>`;
  g += `<g fill="#1b1f24"><path d="M255 50 l6 -14 l6 14 z"/></g><text x="272" y="46" font-size="12">${L('obiekt', 'object')}</text>`;
  g += `<line x1="131" y1="180" x2="261" y2="50" stroke="#c2410c" stroke-width="2"/><line x1="261" y1="180" x2="261" y2="50" stroke="#c2410c" stroke-width="2"/>`;
  g += `<circle cx="131" cy="180" r="5" fill="#1b1f24"/><circle cx="261" cy="180" r="5" fill="#1b1f24"/>`;
  g += `<text x="100" y="205" font-size="12">${L('1: kąt kursowy 45°', '1: relative bearing 45°')}</text><text x="230" y="205" font-size="12">${L('2: kąt kursowy 90°', '2: relative bearing 90°')}</text>`;
  g += `<text x="150" y="172" fill="#2563eb" font-size="13" font-weight="800">${L('droga s', 'run s')}</text><text x="268" y="120" fill="#2563eb" font-size="13" font-weight="800">${L('odległość = s', 'distance = s')}</text>`;
  return svgBox(420, 220, g);
}

export function navBook() {
  return [
    { id: 'intro', name: L('Wstęp', 'Introduction'), entries: [
      entry(L('Po co przeliczać kursy', 'Why courses are converted'),
        P(L('Kompas na jachcie nie wskazuje północy rzeczywistej: igłę odchyla pole magnetyczne Ziemi (deklinacja) i żelazo oraz elektryka na jachcie (dewiacja). Wiatr spycha jacht z kursu (dryf), a prąd niesie całą wodę razem z jachtem. Mapa jest wykreślona względem północy rzeczywistej, a nad dnem liczy się droga, którą jacht naprawdę przebywa – dlatego kurs odczytany z kompasu trzeba przeliczyć na kurs na mapie i odwrotnie.', 'The ship’s compass does not point to true north: the needle is deflected by the Earth’s magnetic field (variation) and by iron and electrics on board (deviation). The wind pushes the yacht off its heading (leeway) and the current carries the whole body of water with it. The chart is drawn relative to true north and what counts over the ground is the track the yacht really makes – so a compass course has to be converted into a chart course and back.'))),
      entry(L('Oznaczenia', 'Notation'),
        table([L('Skrót', 'Abbr.'), L('Nazwa', 'Name'), L('Co oznacza', 'Meaning')], [
          ['KK', L('kurs kompasowy', 'compass course'), L('kąt między północą kompasową a dziobem – to, co pokazuje kompas sterowy', 'angle from compass north to the bow – what the steering compass shows')],
          ['KM', L('kurs magnetyczny', 'magnetic course'), L('kąt między północą magnetyczną a dziobem', 'angle from magnetic north to the bow')],
          ['KR', L('kurs rzeczywisty', 'true course'), L('kąt między północą rzeczywistą a dziobem', 'angle from true north to the bow')],
          ['KDw', L('kurs drogi nad wodą', 'course through the water'), L('kierunek, w którym jacht naprawdę przesuwa się po wodzie (z dryfem)', 'direction the yacht actually moves through the water (with leeway)')],
          ['KDd', L('kurs drogi nad dnem', 'course over the ground'), L('kierunek ruchu nad dnem – z dryfem i prądem; to linia na mapie', 'direction of motion over the ground – with leeway and current; the line on the chart')],
          ['δ', L('dewiacja', 'deviation'), L('odchylenie kompasu od północy magnetycznej; zależy od kursu jachtu', 'compass error from magnetic north; depends on the heading')],
          ['d', L('deklinacja', 'variation'), L('kąt między północą magnetyczną a rzeczywistą; z mapy, zmienia się z rokiem i miejscem', 'angle between magnetic and true north; from the chart, changes with year and place')],
          ['p', L('poprawka całkowita', 'total correction'), 'p = δ + d'],
          ['β', L('dryf', 'leeway'), L('kąt, o który wiatr znosi jacht z kursu', 'angle the wind pushes the yacht off its heading')],
          ['NK, NM, NR', L('namiar kompasowy, magnetyczny, rzeczywisty', 'compass, magnetic, true bearing'), L('kierunek na obiekt mierzony od odpowiedniej północy', 'direction to an object measured from the matching north')]
        ]),
        P(B(L('Zasada znaków: ', 'Sign rule: ')), L('poprawki na wschód (E) i w prawo są dodatnie (+), na zachód (W) i w lewo są ujemne (−).', 'corrections to the east (E) and to the right are positive (+), to the west (W) and to the left negative (−).')),
        northsSVG())
    ] },
    { id: 'courses', name: L('Przeliczanie kursów', 'Converting courses'), entries: [
      entry(L('Od kompasu do mapy: KK → KDd', 'From the compass to the chart: CC → COG'),
        chainSVG(),
        formula('KM = KK + δ', 'KR = KM + d = KK + p', 'KDw = KR + β', L('KDd = KDw „+” prąd (dodawanie wektorów – trójkąt prędkości)', 'COG = CTW “+” current (vector addition – the velocity triangle)')),
        P(L('Idąc w prawo dodajemy poprawki z ich znakami. Wynik zawsze sprowadzamy do zakresu 000°–359° (np. 365° → 005°, −4° → 356°).', 'Going to the right, add the corrections with their signs. Always bring the result into 000°–359° (e.g. 365° → 005°, −4° → 356°).')),
        ex(L('KK = 090°, δ = +2°, d = 4°E (+4°), wiatr z lewej burty znosi o 5° w prawo (β = +5°) → KM = 092°, KR = 096°, KDw = 101°.', 'CC = 090°, δ = +2°, d = 4°E (+4°), wind from port pushes 5° to starboard (β = +5°) → MC = 092°, TC = 096°, CTW = 101°.'))),
      entry(L('Od mapy do kompasu: KDd → KK', 'From the chart to the compass: COG → CC'),
        P(L('Gdy chcesz popłynąć wyznaczoną na mapie linią, idziesz łańcuchem w lewo i ', 'To follow a track drawn on the chart, go along the chain to the left and '), B(L('odejmujesz', 'subtract')), L(' poprawki:', ' the corrections:')),
        formula(L('KDw – z trójkąta prądu (kurs z poprawką na prąd)', 'CTW – from the current triangle (course to steer)'), 'KR = KDw − β', 'KM = KR − d', 'KK = KM − δ'),
        ex(L('Na mapie KDw = 220°, wiatr z prawej burty znosi o 4° w lewo (β = −4°), d = 3°W (−3°), δ dla tego kursu = −1° → KR = 220° − (−4°) = 224°, KM = 224° − (−3°) = 227°, KK = 227° − (−1°) = 228°. Sterujesz 228° według kompasu.', 'On the chart CTW = 220°, wind from starboard pushes 4° to port (β = −4°), d = 3°W (−3°), δ for this heading = −1° → TC = 220° − (−4°) = 224°, MC = 224° − (−3°) = 227°, CC = 227° − (−1°) = 228°. You steer 228° by the compass.')),
        note(L('Dewiację odczytuje się z tabeli dla kursu, którym jacht płynie. Przy przeliczaniu od mapy znasz najpierw KM, więc wejdź do tabeli z kursem magnetycznym (jeśli tabela jest dla KK – sprawdź wynik jeszcze raz dla otrzymanego KK).', 'Deviation is read from the table for the heading the yacht is on. Working from the chart you know MC first, so enter the table with the magnetic course (if the table is for CC, check again with the CC you got).'))),
      entry(L('Deklinacja z mapy', 'Variation from the chart'),
        P(L('Na róży kompasowej mapy podana jest deklinacja z rokiem odniesienia i roczną zmianą, np. „3°40′E 2015 (8′E)”. Deklinację na bieżący rok liczysz tak:', 'The chart’s compass rose gives the variation with a reference year and an annual change, e.g. “3°40′E 2015 (8′E)”. For the current year:')),
        formula(L('d = d(rok mapy) + zmiana roczna × liczba lat', 'd = d(chart year) + annual change × years')),
        ex(L('Dla roku 2025: 3°40′E + 10 × 8′E = 3°40′ + 1°20′ = 5°00′E, czyli d = +5°. Zmiana roczna W jest ujemna – wtedy deklinacja maleje.', 'For 2025: 3°40′E + 10 × 8′E = 3°40′ + 1°20′ = 5°00′E, i.e. d = +5°. An annual change W is negative – the variation then decreases.'))),
      entry(L('Dewiacja i tabela dewiacji', 'Deviation and the deviation table'),
        P(L('Dewiacja zależy od kursu, bo żelazo na jachcie obraca się razem z nim względem pola Ziemi. Tabela dewiacji podaje δ co 15°–45° kursu; dla kursów pośrednich interpolujesz liniowo.', 'Deviation depends on the heading, because the iron on board turns with the yacht relative to the Earth’s field. The deviation table gives δ every 15°–45°; interpolate linearly in between.')),
        ex(L('δ(090°) = +2°, δ(135°) = −1°. Dla KK = 120° (2/3 drogi od 090° do 135°): δ = +2° + (−3°) · 2/3 = 0°.', 'δ(090°) = +2°, δ(135°) = −1°. For CC = 120° (2/3 of the way from 090° to 135°): δ = +2° + (−3°) · 2/3 = 0°.')),
        P(L('Dewiację na danym kursie sprawdzisz też na nabieżniku: KR nabieżnika z mapy, NK z kompasu → p = NR − NK, δ = p − d.', 'You can also check deviation on a transit: TB of the transit from the chart, CB from the compass → p = TB − CB, δ = p − d.'))),
      entry(L('Dryf', 'Leeway'),
        P(L('Wiatr spycha jacht na zawietrzną: kurs drogi nad wodą (kilwater) odchyla się od osi jachtu w stronę, w którą wieje wiatr.', 'The wind pushes the yacht to leeward: the course through the water (the wake) diverges from the yacht’s heading towards where the wind blows.')),
        table([L('Wiatr z', 'Wind from'), L('Jacht znoszony', 'Yacht pushed'), 'β'], [[L('lewej burty', 'port'), L('w prawo', 'to starboard'), '+'], [L('prawej burty', 'starboard'), L('w lewo', 'to port'), '−']]),
        P(L('Typowo 2°–10°; więcej przy ostrym kursie, silnym wietrze, małej prędkości i dużym przechyle. Na kursie z wiatrem β ≈ 0.', 'Typically 2°–10°; more when close-hauled, in strong wind, at low speed and heeled hard. Running before the wind β ≈ 0.')))
    ] },
    { id: 'current', name: L('Prąd', 'Current'), entries: [
      entry(L('Trójkąt prędkości', 'The velocity triangle'),
        currentSVG(),
        P(L('Prąd przesuwa całą wodę – a z nią jacht – w swoim kierunku. Kierunek prądu podaje się „dokąd płynie” (odwrotnie niż wiatr, który podaje się „skąd wieje”). Ruch nad dnem to suma wektorów: prędkości jachtu po wodzie (KDw, V) i prędkości prądu.', 'A current moves the whole body of water – and the yacht with it – in its direction. Its set is given as “where it flows to” (unlike the wind, given as “where it blows from”). Motion over the ground is the vector sum of the yacht’s velocity through the water (CTW, STW) and the current.'))),
      entry(L('Znam KR – jaki będzie KDd? (wykreślnie)', 'I know my heading – what is the COG? (by plotting)'),
        h('ol', {}, h('li', {}, L('Z pozycji wyjściowej wykreśl KDw i odłóż na nim drogę po wodzie w 1 h (V Mm).', 'From the start position draw the CTW and mark the distance through the water in 1 h (STW NM).')),
          h('li', {}, L('Z końca tego odcinka wykreśl wektor prądu w jego kierunku, długości równej prędkości prądu w 1 h.', 'From its end draw the current vector in its set, as long as the rate for 1 h.')),
          h('li', {}, L('Połącz pozycję wyjściową z końcem wektora prądu: to KDd, a jego długość to prędkość nad dnem (SOG).', 'Join the start to the end of the current vector: that is the COG, and its length the speed over ground (SOG).')))),
      entry(L('Chcę iść KDd – jaki kurs sterować? (kurs z poprawką na prąd)', 'I want to make a COG – what course to steer?'),
        h('ol', {}, h('li', {}, L('Wykreśl na mapie linię zamierzonej drogi nad dnem (KDd) od pozycji wyjściowej.', 'Draw the intended track (COG) from the start.')),
          h('li', {}, L('Z pozycji wyjściowej odłóż wektor prądu na 1 h.', 'From the start draw the current vector for 1 h.')),
          h('li', {}, L('Z końca wektora prądu cyrklem rozwartym na V (prędkość jachtu w 1 h) zatocz łuk do przecięcia z linią KDd.', 'From the end of the current vector swing an arc with the dividers set to STW (1 h) to meet the COG line.')),
          h('li', {}, L('Kierunek od końca prądu do punktu przecięcia to KDw – kurs do sterowania (potem odejmij β, d, δ). Odległość od startu do przecięcia to SOG.', 'The direction from the end of the current vector to that point is the CTW – the course to steer (then subtract β, d, δ). The distance from the start to the intersection is the SOG.'))),
        P(L('Prąd z przodu skraca drogę nad dnem, z tyłu – wydłuża; prąd z boku wymaga „podrywania” dziobu pod prąd.', 'A head current shortens the run over the ground, a following one lengthens it; a cross current makes you point the bow up into it.')))
    ] },
    { id: 'bearings', name: L('Namiary', 'Bearings'), entries: [
      entry(L('Namiar i jego przeliczanie', 'A bearing and its conversion'),
        P(L('Namiar to kierunek z jachtu na obiekt (latarnię, cypel, wieżę), mierzony kompasem namiarowym albo przez kompas sterowy. Przeliczasz go tak samo jak kurs – ale ', 'A bearing is the direction from the yacht to an object (light, headland, tower), taken with a hand-bearing compass or over the steering compass. You convert it like a course – but '), B(L('dewiację bierzesz dla kursu jachtu', 'deviation is taken for the yacht’s heading')), L(', nie dla namiaru (bo to od kursu zależy, jak żelazo jachtu działa na kompas).', ', not for the bearing (the heading decides how the yacht’s iron acts on the compass).')),
        formula('NM = NK + δ(KK)', 'NR = NM + d = NK + p'),
        P(L('Kompas ręczny trzymany z dala od żelaza ma zwykle δ ≈ 0, wtedy NR = NK + d.', 'A hand-bearing compass held away from iron usually has δ ≈ 0, so TB = CB + d.')),
        P(B(L('Kąt kursowy ', 'Relative bearing ')), L('(namiar względny, KĄT) – kąt od dziobu do obiektu, w prawo 0°–360° albo „z prawej/lewej burty”. NR = KR + KĄT (z lewej burty odejmij).', '– the angle from the bow to the object, 0°–360° clockwise or “on the starboard/port side”. TB = TC + RB (subtract when on the port side).'))),
      entry(L('Nanoszenie namiaru na mapę', 'Plotting a bearing on the chart'),
        h('ol', {}, h('li', {}, L('Przelicz namiar na rzeczywisty (NR).', 'Convert the bearing to true (TB).')),
          h('li', {}, L('Przyłóż trójkąt nawigacyjny środkiem do obiektu na mapie, ustaw kąt NR względem południków (albo przenieś kierunek z róży linijką równoległą).', 'Put the plotter’s centre on the object, set TB relative to the meridians (or transfer it from the rose with a parallel ruler).')),
          h('li', {}, L('Narysuj linię przez obiekt w kierunku NR ± 180° – po stronie, z której patrzysz. Jacht leży gdzieś na tej linii: to ', 'Draw a line through the object in the direction TB ± 180° – on your side of it. The yacht is somewhere on that line: a '), B(L('linia pozycyjna', 'position line')), '.')),
        ex(L('Latarnia w namiarze NR = 045° → jacht jest na linii biegnącej od latarni w kierunku 225°.', 'A light bearing TB = 045° → the yacht lies on a line running from the light towards 225°.')))
    ] },
    { id: 'lop', name: L('Linie pozycyjne i pozycja', 'Position lines and fixes'), entries: [
      entry(L('Linie pozycyjne', 'Position lines'),
        P(L('Linia pozycyjna to zbiór punktów, na których może być jacht, wyznaczony jednym pomiarem:', 'A position line is the set of points where the yacht may be, given by one observation:')),
        h('ul', {}, h('li', {}, B(L('namiar', 'bearing')), L(' – prosta przez obiekt (NR ± 180°);', ' – a straight line through the object (TB ± 180°);')),
          h('li', {}, B(L('nabieżnik', 'transit')), L(' – dwa obiekty w jednej linii: najdokładniejsza linia pozycyjna, bez kompasu;', ' – two objects in line: the most accurate position line, no compass needed;')),
          h('li', {}, B(L('odległość', 'distance')), L(' – okrąg wokół obiektu (radar, kąt pionowy, zasięg światła);', ' – a circle round the object (radar, vertical angle, light range);')),
          h('li', {}, B(L('izobata', 'depth contour')), L(' – głębokość z echosondy porównana z mapą (pomocniczo).', ' – sounding compared with the chart (as a check).')))),
      entry(L('Pozycja z dwóch i trzech namiarów', 'A fix from two and three bearings'),
        fixSVG(),
        h('ol', {}, h('li', {}, L('Namierz dwa (lepiej trzy) obiekty rozpoznane na mapie, jak najszybciej jeden po drugim – najpierw te z boku, na końcu te przed dziobem lub za rufą (ich namiar zmienia się najwolniej).', 'Take bearings of two (better three) objects identified on the chart, as quickly as possible – first those abeam, last those ahead or astern (their bearings change slowest).')),
          h('li', {}, L('Przelicz na NR i wykreśl linie przez obiekty.', 'Convert to true and plot the lines through the objects.')),
          h('li', {}, L('Przecięcie to pozycja obserwowana – zaznacz kółkiem z godziną i logiem.', 'The intersection is the observed fix – mark it with a circle, the time and the log reading.'))),
        P(L('Linie powinny przecinać się pod kątem 30°–150°, najlepiej blisko 90°. Przy trzech namiarach zwykle powstaje mały ', 'The lines should cross at 30°–150°, ideally near 90°. With three bearings you usually get a small '), B(L('trójkąt błędów', 'cocked hat')), L(' – przyjmij pozycję w jego środku albo w rogu najbliższym niebezpieczeństwa. Duży trójkąt oznacza błąd: zły obiekt, zła dewiacja lub pomyłka w przeliczeniu.', ' – take the position at its centre or at the corner nearest danger. A large triangle means an error: wrong object, wrong deviation or a conversion slip.'))),
      entry(L('Namiar podwójny', 'Doubling the angle on the bow'),
        doubleSVG(),
        P(L('Jeden obiekt namierzony dwa razy przy stałym kursie. Gdy kąt kursowy się podwoi (np. 30° → 60°, 45° → 90°), odległość od obiektu w chwili drugiego namiaru równa się drodze przebytej między namiarami. Przy 45° i 90° (namiar czteropunktowy) to od razu odległość mijania obiektu na trawersie.', 'One object observed twice on a steady course. When the relative bearing doubles (e.g. 30° → 60°, 45° → 90°), the distance off at the second bearing equals the distance run between them. With 45° and 90° (the four-point bearing) it is directly the distance off when abeam.')),
        P(L('Między namiarami trzeba uwzględnić prąd – jeśli jest, użyj drogi nad dnem.', 'Allow for current between the bearings – if there is one, use the distance over the ground.'))),
      entry(L('Namiar i odległość', 'Bearing and distance'),
        P(L('Gdy znasz odległość od obiektu (radar, zasięg światła na granicy widoczności), zatocz cyrklem okrąg o tym promieniu wokół obiektu; pozycja to przecięcie okręgu z linią namiaru.', 'When you know the distance (radar, a light just rising), swing a circle of that radius round the object; the fix is where it meets the bearing line.')))
    ] },
    { id: 'dr', name: L('Zliczenie i droga', 'Dead reckoning and distance'), entries: [
      entry(L('Czas, prędkość, droga', 'Time, speed, distance'),
        formula('s = v · t', 'v = s / t', 't = s / v'),
        P(L('s w milach morskich (Mm), v w węzłach (kn = Mm/h), t w godzinach. 1 Mm = 1852 m; 6 minut = 0,1 h – przy 6 kn w 6 minut przepłyniesz 0,6 Mm.', 's in nautical miles (NM), v in knots (kn = NM/h), t in hours. 1 NM = 1852 m; 6 minutes = 0.1 h – at 6 kn you make 0.6 NM in 6 minutes.'))),
      entry(L('Mierzenie odległości na mapie', 'Measuring distance on the chart'),
        P(L('1 minuta szerokości (1′) = 1 Mm. Odległość mierzysz cyrklem i przykładasz go do ', '1 minute of latitude (1′) = 1 NM. Measure with the dividers and lay them against the '), B(L('skali szerokości', 'latitude scale')), L(' na bocznych ramkach mapy – na wysokości mierzonego odcinka (na mapach Merkatora skala zmienia się z szerokością). Nigdy nie mierz odległości na skali długości u góry i u dołu mapy.', ' at the side of the chart – level with the leg you measure (on Mercator charts the scale changes with latitude). Never measure distance on the longitude scale at the top or bottom.'))),
      entry(L('Zliczenie drogi (DR)', 'Dead reckoning (DR)'),
        P(L('Od ostatniej pewnej pozycji odkładasz KDd i drogę nad dnem (s = SOG · t) – otrzymujesz pozycję zliczoną. Bez prądu i dryfu wystarczy KR i prędkość z logu. Pozycję zliczoną oznacza się półkolem z kreską i godziną; co pewien czas sprawdzaj ją pozycją obserwowaną.', 'From the last reliable position lay off the COG and the distance over the ground (s = SOG · t) – that is the DR position. With no current or leeway the true course and the log speed are enough. Mark DR with a half circle and the time; check it regularly with an observed fix.')))
    ] },
    { id: 'range', name: L('Zasięg widoczności', 'Range of visibility'), entries: [
      entry(L('Zasięg geograficzny i nominalny', 'Geographic and nominal range'),
        formula(L('Dg = 2,08 · (√h + √H)   [Mm, h i H w metrach]', 'Dg = 2.08 · (√h + √H)   [NM, h and H in metres]')),
        P(L('h – wysokość światła nad wodą (z mapy lub spisu świateł), H – wysokość oka obserwatora. Zasięg nominalny (siła światła) podaje mapa, np. „15M”. Światło zobaczysz z mniejszej z tych dwóch odległości.', 'h – height of the light above the water (from the chart or list of lights), H – height of the observer’s eye. The nominal range (the light’s power) is on the chart, e.g. “15M”. You will see the light at the smaller of the two distances.')),
        ex(L('h = 36 m, H = 2,25 m: Dg = 2,08 · (6 + 1,5) = 15,6 Mm; zasięg nominalny 18 Mm → światło pojawi się na horyzoncie w odległości ok. 15,6 Mm. To daje linię pozycyjną (okrąg) – razem z namiarem: pozycję.', 'h = 36 m, H = 2.25 m: Dg = 2.08 · (6 + 1.5) = 15.6 NM; nominal range 18 NM → the light rises over the horizon at about 15.6 NM. That gives a position circle – with its bearing, a fix.')))
    ] }
  ];
}
