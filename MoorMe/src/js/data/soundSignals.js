// Sygnały dźwiękowe wg MPZZM/COLREG (część D): manewrowe i ostrzegawcze (prawidło 34) oraz w ograniczonej widoczności (35).
// Zapis: S – krótki dźwięk (ok. 1 s), L – długi (4–6 s), B – szybkie dzwonienie dzwonem przez ok. 5 s,
// b – pojedyncze, wyraźne uderzenie w dzwon, G – gong przez ok. 5 s.

export const CONTEXTS = {
  sight: 'Dobra widoczność – statki widzą się nawzajem',
  fog: 'Ograniczona widoczność – mgła'
};

export const SIGNALS = [
  { id: 'stbd', ctx: 'sight', p: 'S', name: 'Zmieniam kurs w prawo' },
  { id: 'port', ctx: 'sight', p: 'SS', name: 'Zmieniam kurs w lewo' },
  { id: 'astern', ctx: 'sight', p: 'SSS', name: 'Pracuję śrubą wstecz' },
  { id: 'doubt', ctx: 'sight', p: 'SSSSS', name: 'Nie rozumiem Twoich zamiarów / wątpię, czy wykonujesz wystarczający manewr' },
  { id: 'overStbd', ctx: 'sight', p: 'LLS', name: 'W wąskim przejściu: zamierzam Cię wyprzedzić z Twojej prawej burty' },
  { id: 'overPort', ctx: 'sight', p: 'LLSS', name: 'W wąskim przejściu: zamierzam Cię wyprzedzić z Twojej lewej burty' },
  { id: 'agree', ctx: 'sight', p: 'LSLS', name: 'Zgoda na wyprzedzanie' },
  { id: 'bend', ctx: 'sight', p: 'L', name: 'Zbliżam się do zakrętu lub miejsca, gdzie inne statki mogą być zasłonięte' },
  { id: 'fPower', ctx: 'fog', p: 'L', name: 'Statek o napędzie mechanicznym, posuwający się po wodzie (co 2 min)' },
  { id: 'fStopped', ctx: 'fog', p: 'LL', name: 'Statek o napędzie mechanicznym w drodze, zatrzymany – nie posuwa się po wodzie (co 2 min)' },
  { id: 'fSpecial', ctx: 'fog', p: 'LSS', name: 'Niezdolny do manewrowania, o ograniczonej zdolności manewrowania, ograniczony zanurzeniem, żaglowy, rybacki lub holujący (co 2 min)' },
  { id: 'fTowed', ctx: 'fog', p: 'LSSS', name: 'Statek holowany z załogą (zaraz po sygnale holownika)' },
  { id: 'fPilot', ctx: 'fog', p: 'SSSS', name: 'Statek pilotowy na służbie – sygnał rozpoznawczy' },
  { id: 'fAnchor', ctx: 'fog', p: 'B', name: 'Statek na kotwicy (< 100 m) – dzwon przez 5 s co minutę' },
  { id: 'fAnchorL', ctx: 'fog', p: 'BG', name: 'Statek na kotwicy (≥ 100 m) – dzwon na dziobie, zaraz potem gong na rufie' },
  { id: 'fAground', ctx: 'fog', p: 'bbbBbbb', name: 'Statek na mieliźnie – 3 uderzenia w dzwon, dzwonienie, 3 uderzenia' },
  { id: 'fWarn', ctx: 'fog', p: 'SLS', name: 'Statek na kotwicy ostrzega zbliżający się statek o możliwości zderzenia' }
];

export const SIGNAL_BY_ID = Object.fromEntries(SIGNALS.map((s) => [s.id, s]));

// Zapis graficzny sygnału: • krótki, — długi, 🔔 dzwon
export function notation(p) {
  return [...p].map((c) => ({ S: '•', L: '—', B: '🔔🔔🔔', b: '🔔', G: '◎ gong' }[c])).join(' ');
}

// Plan odtwarzania: [{ kind: 'horn'|'bell'|'stroke'|'gong', t0, dur }]
export const DUR = { S: 1.0, L: 4.5, B: 5.0, b: 0.6, G: 5.0 };
export function schedule(p) {
  const out = [];
  let t = 0;
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    const kind = c === 'S' || c === 'L' ? 'horn' : c === 'B' ? 'bell' : c === 'b' ? 'stroke' : 'gong';
    out.push({ kind, t0: t, dur: DUR[c] });
    const next = p[i + 1];
    t += DUR[c] + (c === 'b' && next === 'b' ? 0.35 : 1.0); // przerwa ok. 1 s między dźwiękami
  }
  return { parts: out, total: t };
}

export function signalOptions(r, correctId, n = 5) {
  const ctx = SIGNAL_BY_ID[correctId].ctx;
  const others = SIGNALS.filter((s) => s.ctx === ctx && s.id !== correctId).map((s) => [r(), s.id]).sort((a, b) => a[0] - b[0]).slice(0, n - 1).map((x) => x[1]);
  return [...others, correctId].map((id) => [r(), id]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

export function makeSignalDeck(r) {
  let deck = [], last = null;
  return () => {
    if (!deck.length) {
      deck = SIGNALS.map((s) => [r(), s.id]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      if (deck[0] === last && deck.length > 1) deck.push(deck.shift());
    }
    last = deck.shift();
    return last;
  };
}
