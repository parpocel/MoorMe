// Sygnały dźwiękowe.
// Morze – MPZZM/COLREG część D: manewrowe i ostrzegawcze (prawidło 34), w ograniczonej widoczności (35), wzywanie pomocy (37).
// Śródlądowe drogi wodne – CEVNI (Europejskie przepisy żeglugi śródlądowej, w Polsce przepisy żeglugowe na śródlądowych
// drogach wodnych, zał. 6): część sygnałów ma tam inne znaczenie niż na morzu (np. 4 krótkie = nie mogę manewrować).
// Zapis: S – krótki dźwięk (ok. 1 s), L – długi (4–6 s), v – bardzo krótki (ok. ¼ s), C – ciągły dźwięk,
// B – szybkie dzwonienie dzwonem przez ok. 5 s, b – pojedyncze uderzenie w dzwon, G – gong przez ok. 5 s,
// p – dłuższa przerwa między grupami (np. pary krótkich w sygnale „człowiek za burtą”).

export const CONTEXTS = {
  sight: 'Morze, dobra widoczność – statki widzą się nawzajem',
  fog: 'Morze, ograniczona widoczność – mgła',
  inland: 'Śródlądowe drogi wodne (CEVNI)'
};

// name – odpowiedź w quizie (bez podpowiedzi o samym dźwięku); desc – opis w podręczniku;
// scene – gdzie i jak porusza się statek, który daje sygnał (kąt od naszego dziobu, odległość, kurs, prędkość, manewr)
export const SIGNALS = [
  { id: 'stbd', ctx: 'sight', p: 'S', name: 'Zmieniam kurs w prawo', desc: 'Jeden krótki dźwięk. Statek w drodze widzący inny statek zmienia kurs w prawo (prawidło 34(a)).',
    scene: { brg: [12, 35], dist: [380, 520], hdg: 'toward', off: 10, speed: 6, beh: { turn: 40, rate: 2.5, delay: 1.5 } } },
  { id: 'port', ctx: 'sight', p: 'SS', name: 'Zmieniam kurs w lewo', desc: 'Dwa krótkie dźwięki. Statek zmienia kurs w lewo.',
    scene: { brg: [12, 35], dist: [380, 520], hdg: 'toward', off: -10, speed: 6, beh: { turn: -40, rate: 2.5, delay: 2.5 } } },
  { id: 'astern', ctx: 'sight', p: 'SSS', name: 'Pracuję śrubą wstecz', desc: 'Trzy krótkie dźwięki. Statek pracuje maszyną wstecz – zwalnia albo cofa się.',
    scene: { brg: [20, 45], dist: [300, 420], hdg: 'toward', off: 35, speed: 2.5, beh: { speedTo: -2, accel: 0.25, delay: 2 } } },
  { id: 'doubt', ctx: 'sight', p: 'SSSSS', name: 'Nie rozumiem Twoich zamiarów / wątpię, czy wykonujesz wystarczający manewr', desc: 'Co najmniej pięć krótkich, szybkich dźwięków (prawidło 34(d)) – sygnał wątpliwości, gdy statki się do siebie zbliżają. Można go uzupełnić pięcioma krótkimi błyskami.',
    scene: { brg: [30, 60], dist: [400, 560], hdg: 'collision', speed: 7 } },
  { id: 'overStbd', ctx: 'sight', p: 'LLS', name: 'W wąskim przejściu: zamierzam Cię wyprzedzić z Twojej prawej burty', desc: 'Dwa długie i jeden krótki dźwięk – w wąskim przejściu lub torze wodnym statek z tyłu chce wyprzedzić z prawej burty statku wyprzedzanego (prawidło 34(c)(i)).',
    scene: { brg: [158, 170], side: 1, dist: [220, 320], hdg: 'same', speed: 4.5 } },
  { id: 'overPort', ctx: 'sight', p: 'LLSS', name: 'W wąskim przejściu: zamierzam Cię wyprzedzić z Twojej lewej burty', desc: 'Dwa długie i dwa krótkie dźwięki – statek z tyłu chce wyprzedzić z lewej burty statku wyprzedzanego.',
    scene: { brg: [158, 170], side: -1, dist: [220, 320], hdg: 'same', speed: 4.5 } },
  { id: 'agree', ctx: 'sight', p: 'LSLS', name: 'Zgoda na wyprzedzanie', desc: 'Długi, krótki, długi, krótki dźwięk – statek wyprzedzany zgadza się na wyprzedzanie (prawidło 34(c)(ii)). Gdy ma wątpliwości – daje sygnał 5 krótkich.',
    scene: { brg: [6, 16], dist: [220, 320], hdg: 'same', speed: 0.6 } },
  { id: 'bend', ctx: 'sight', p: 'L', name: 'Zbliżam się do zakrętu lub miejsca, gdzie inne statki mogą być zasłonięte', desc: 'Jeden długi dźwięk przy zbliżaniu się do zakrętu albo miejsca, gdzie przeszkoda może zasłaniać inne statki; statek po drugiej stronie odpowiada też jednym długim (prawidło 34(e)).',
    scene: { brg: [50, 80], dist: [500, 650], hdg: 'cross', speed: 6 } },
  { id: 'distress', ctx: 'sight', p: 'C', name: 'Wzywam pomocy – jestem w niebezpieczeństwie', desc: 'Ciągły dźwięk dowolnego urządzenia mgłowego (prawidło 37, zał. IV) – sygnał niebezpieczeństwa i wzywania pomocy, w każdej widoczności. Także: wystrzał co ok. minutę.',
    scene: { brg: [35, 90], dist: [450, 650], hdg: 'cross', speed: 0 } },
  { id: 'fPower', ctx: 'fog', p: 'L', name: 'Statek o napędzie mechanicznym posuwający się po wodzie', desc: 'Jeden długi dźwięk co najwyżej co 2 minuty (prawidło 35(a)).',
    scene: { brg: [30, 150], dist: [500, 750], hdg: 'random', speed: 6 } },
  { id: 'fStopped', ctx: 'fog', p: 'LL', name: 'Statek o napędzie mechanicznym w drodze, nieposuwający się po wodzie', desc: 'Dwa długie dźwięki z przerwą ok. 2 s, co najwyżej co 2 minuty – statek w drodze, ale zatrzymany (prawidło 35(b)).',
    scene: { brg: [30, 150], dist: [500, 750], hdg: 'random', speed: 0 } },
  { id: 'fSpecial', ctx: 'fog', p: 'LSS', name: 'Statek niezdolny do manewrowania, o ograniczonej zdolności manewrowania, ograniczony zanurzeniem, żaglowy, rybacki albo holujący lub pchający', desc: 'Jeden długi i dwa krótkie dźwięki co najwyżej co 2 minuty (prawidło 35(c)). Tak samo statek rybacki i o ograniczonej zdolności manewrowania na kotwicy (35(d)).',
    scene: { brg: [30, 150], dist: [500, 750], hdg: 'random', speed: 3 } },
  { id: 'fTowed', ctx: 'fog', p: 'LSSS', name: 'Statek holowany (ostatni w zestawie holowniczym)', desc: 'Jeden długi i trzy krótkie dźwięki, w miarę możliwości zaraz po sygnale holownika – daje go jednostka holowana (albo ostatnia z kilku holowanych), jeśli jest na niej załoga (prawidło 35(e)).',
    scene: { brg: [30, 150], dist: [500, 750], hdg: 'random', speed: 4 } },
  { id: 'fPilot', ctx: 'fog', p: 'SSSS', name: 'Statek pilotowy na służbie', desc: 'Cztery krótkie dźwięki – sygnał rozpoznawczy statku pilotowego, dawany dodatkowo do sygnałów statku w drodze lub na kotwicy (prawidło 35(k)). Uwaga: na drogach śródlądowych (CEVNI) cztery krótkie znaczą „nie mogę manewrować”.',
    scene: { brg: [30, 150], dist: [500, 750], hdg: 'random', speed: 5 } },
  { id: 'fAnchor', ctx: 'fog', p: 'B', name: 'Statek na kotwicy (krótszy niż 100 m)', desc: 'Szybkie dzwonienie dzwonem przez ok. 5 s co najwyżej co minutę, na dziobie (prawidło 35(g)).',
    scene: { brg: [30, 150], dist: [500, 750], hdg: 'random', speed: 0 } },
  { id: 'fAnchorL', ctx: 'fog', p: 'BG', name: 'Statek na kotwicy (100 m i dłuższy)', desc: 'Dzwon na dziobie przez ok. 5 s, a zaraz potem gong na rufie przez ok. 5 s, co najwyżej co minutę.',
    scene: { brg: [30, 150], dist: [500, 750], hdg: 'random', speed: 0 } },
  { id: 'fAground', ctx: 'fog', p: 'bbbBbbb', name: 'Statek na mieliźnie', desc: 'Trzy oddzielne, wyraźne uderzenia w dzwon, szybkie dzwonienie, znów trzy uderzenia (prawidło 35(h)); duży statek dodaje gong.',
    scene: { brg: [30, 150], dist: [500, 750], hdg: 'random', speed: 0 } },
  { id: 'fWarn', ctx: 'fog', p: 'SLS', name: 'Statek na kotwicy ostrzega zbliżający się statek przed niebezpieczeństwem zderzenia', desc: 'Krótki, długi, krótki – statek na kotwicy może dodatkowo dać ten sygnał, by ostrzec zbliżającą się jednostkę o swojej pozycji (prawidło 35(g)).',
    scene: { brg: [30, 150], dist: [450, 650], hdg: 'random', speed: 0 } },
  // ---- śródlądowe drogi wodne (CEVNI, zał. 6) ----
  { id: 'iAttention', ctx: 'inland', p: 'L', name: 'Uwaga', desc: 'Jeden długi dźwięk – sygnał ogólny „uwaga”.',
    scene: { brg: [30, 60], dist: [400, 560], hdg: 'toward', off: 20, speed: 5 } },
  { id: 'iStbd', ctx: 'inland', p: 'S', name: 'Zmieniam kurs w prawo', desc: 'Jeden krótki dźwięk.',
    scene: { brg: [12, 35], dist: [380, 520], hdg: 'toward', off: 10, speed: 5, beh: { turn: 35, rate: 2.5, delay: 1.5 } } },
  { id: 'iPort', ctx: 'inland', p: 'SS', name: 'Zmieniam kurs w lewo', desc: 'Dwa krótkie dźwięki.',
    scene: { brg: [12, 35], dist: [380, 520], hdg: 'toward', off: -10, speed: 5, beh: { turn: -35, rate: 2.5, delay: 2.5 } } },
  { id: 'iAstern', ctx: 'inland', p: 'SSS', name: 'Pracuję śrubą wstecz', desc: 'Trzy krótkie dźwięki.',
    scene: { brg: [20, 45], dist: [300, 420], hdg: 'toward', off: 35, speed: 2.5, beh: { speedTo: -2, accel: 0.25, delay: 2 } } },
  { id: 'iUnable', ctx: 'inland', p: 'SSSS', name: 'Nie mogę manewrować', desc: 'Cztery krótkie dźwięki – statek jest niezdolny do manewrowania (na morzu ten sam sygnał we mgle daje statek pilotowy).',
    scene: { brg: [25, 60], dist: [350, 500], hdg: 'cross', speed: 0.4 } },
  { id: 'iDanger', ctx: 'inland', p: 'vvvvvvvv', name: 'Niebezpieczeństwo', desc: 'Seria bardzo krótkich dźwięków (ok. ¼ s każdy) – sygnał „niebezpieczeństwo”, np. gdy grozi zderzenie.',
    scene: { brg: [30, 60], dist: [320, 450], hdg: 'collision', speed: 7 } },
  { id: 'iTurnStbd', ctx: 'inland', p: 'LS', name: 'Zawracam w prawo', desc: 'Jeden długi i jeden krótki dźwięk – statek zawraca (obraca się) przez prawą burtę.',
    scene: { brg: [25, 55], dist: [380, 520], hdg: 'cross', speed: 3, beh: { turn: 170, rate: 4, delay: 2 } } },
  { id: 'iTurnPort', ctx: 'inland', p: 'LSS', name: 'Zawracam w lewo', desc: 'Jeden długi i dwa krótkie dźwięki – statek zawraca przez lewą burtę.',
    scene: { brg: [25, 55], dist: [380, 520], hdg: 'cross', speed: 3, beh: { turn: -170, rate: 4, delay: 2 } } },
  { id: 'iDistress', ctx: 'inland', p: 'LLL', name: 'Wzywam pomocy', desc: 'Powtarzające się długie dźwięki albo uderzenia w dzwon – sygnał wzywania pomocy na drogach śródlądowych.',
    scene: { brg: [35, 90], dist: [450, 650], hdg: 'cross', speed: 0 } },
  { id: 'iMob', ctx: 'inland', p: 'SSpSSpSS', name: 'Człowiek za burtą', desc: 'Seria podwójnych krótkich dźwięków: dwa krótkie, przerwa, dwa krótkie… – „człowiek za burtą”. Nie myl z dwoma krótkimi „zmieniam kurs w lewo” – tu pary się powtarzają.',
    scene: { brg: [35, 80], dist: [400, 560], hdg: 'cross', speed: 3, beh: { turn: 120, rate: 3, delay: 2 } } },
  { id: 'iStopNow', ctx: 'inland', p: 'SLSS', name: 'Zatrzymajcie natychmiast statek', desc: 'Jeden krótki, jeden długi i dwa krótkie dźwięki – wezwanie do natychmiastowego zatrzymania statku.',
    scene: { brg: [15, 40], dist: [350, 500], hdg: 'toward', off: 15, speed: 4 } }
];

export const SIGNAL_BY_ID = Object.fromEntries(SIGNALS.map((s) => [s.id, s]));

// Zapis graficzny sygnału: • krótki, — długi, · bardzo krótki, ━ ciągły, 🔔 dzwon
export function notation(p) {
  if (/^v+$/.test(p)) return '· · · · · · · ·';
  return [...p].map((c) => ({ S: '•', L: '—', C: '━━━━━━', v: '·', B: '🔔🔔🔔', b: '🔔', G: '◎ gong', p: '\u2003' }[c])).join(' ');
}

// Plan odtwarzania: [{ kind: 'horn'|'bell'|'stroke'|'gong', t0, dur }]
export const DUR = { S: 1.0, L: 4.5, v: 0.25, C: 9.0, B: 5.0, b: 0.6, G: 5.0 };
export function schedule(p) {
  const out = [];
  let t = 0;
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === 'p') { t += 1.6; continue; } // przerwa między grupami
    const kind = 'SLvC'.includes(c) ? 'horn' : c === 'B' ? 'bell' : c === 'b' ? 'stroke' : 'gong';
    out.push({ kind, t0: t, dur: DUR[c] });
    const next = p[i + 1];
    const pair = c === 'S' && next === 'S' && p.includes('p'); // pary krótkich (grupy rozdzielone „p”) – dźwięki w parze blisko siebie
    t += DUR[c] + (c === 'v' ? 0.25 : c === 'b' && next === 'b' ? 0.35 : pair ? 0.5 : 1.0); // przerwa ok. 1 s między dźwiękami
  }
  return { parts: out, total: t };
}

export function signalOptions(r, correctId, n = 5) {
  const ctx = SIGNAL_BY_ID[correctId].ctx;
  // bez identycznie brzmiących odpowiedzi w tym samym zestawie
  const p = SIGNAL_BY_ID[correctId].p;
  const others = SIGNALS.filter((s) => s.ctx === ctx && s.id !== correctId && s.p !== p).map((s) => [r(), s.id]).sort((a, b) => a[0] - b[0]).slice(0, n - 1).map((x) => x[1]);
  return [...others, correctId].map((id) => [r(), id]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

// Talia sygnałów: każdy raz na rundę; sygnał rozpoznany poprawnie 3 razy w sesji nie wraca (opanowany)
export function makeSignalDeck(r, ctxs = ['sight', 'fog', 'inland']) {
  let deck = [], last = null;
  const learned = new Map();
  const pool = () => SIGNALS.filter((s) => ctxs.includes(s.ctx) && (learned.get(s.id) || 0) < 3);
  const next = () => {
    if (!pool().length) return null;
    if (!deck.length) {
      deck = pool().map((s) => [r(), s.id]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      if (deck[0] === last && deck.length > 1) deck.push(deck.shift());
    }
    last = deck.shift();
    if ((learned.get(last) || 0) >= 3) return next();
    return last;
  };
  next.correct = (id) => learned.set(id, (learned.get(id) || 0) + 1);
  next.learnedCount = () => [...learned.values()].filter((v) => v >= 3).length;
  next.total = () => SIGNALS.filter((s) => ctxs.includes(s.ctx)).length;
  next.reset = () => { learned.clear(); deck = []; };
  return next;
}
