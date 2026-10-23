// Charakterystyki świateł nawigacyjnych (IALA): sekwencje świecenia i ciemności w sekundach.
// Używane w podręczniku: wykres czasowy i animacja lampy z prawdziwym taktowaniem.

export const LIGHT_COLORS = { W: '#fff4c8', R: '#ff3b2f', G: '#29e05a', Y: '#ffd21f', Bu: '#3a8bff' };

// rytmy (IALA): błysk Fl ≈ 0,5 s; blask LFl ≥ 2 s; Q – 60/min; VQ – 120/min; UQ – 240/min
const FL = 0.5, FL_GAP = 1.0, LF = 2, LF_GAP = 1.5, Q = { on: 0.3, per: 1.0 }, VQ = { on: 0.18, per: 0.5 }, UQ = { on: 0.09, per: 0.25 };
const BASE = 0.4; // jasność światła stałego, na którym są rozbłyski (FFl)

// pomocnicze: kolejne odcinki { on, d, c, b } (b – jasność 0..1)
const on = (d, c, b = 1) => ({ on: true, d, c, b });
const off = (d) => ({ on: false, d });
const sum = (segs) => segs.reduce((s, x) => s + x.d, 0);
const fill = (segs, period) => { const used = sum(segs); return period > used + 1e-9 ? [...segs, off(period - used)] : segs; };
const flashes = (n, f, gap, c) => Array.from({ length: n }, (_, i) => (i < n - 1 ? [on(f, c), off(gap)] : [on(f, c)])).flat();
const quick = (n, q, c) => flashes(n, q.on, q.per - q.on, c);
// grupa „a+b” albo „n”
const groups = (grp) => (grp && /^\d+(\+\d+)?$/.test(grp) ? grp.split('+').map(Number) : [1]);
const colorsOf = (tok) => (tok || '').split('.').flatMap((t) => t.match(/Bu|W|R|G|Y/g) || []);

/**
 * Sekwencja dla zapisu, np. 'Fl G 4s', 'Fl(3) 10s', 'Fl(2+1) R 10s', 'FFl 6s', 'FFl(2) 10s', 'Oc 4s', 'Oc(2) 8s', 'Oc(2+1) 12s',
 * 'Iso 4s', 'LFl 10s', 'LFl(2) 12s', 'LFl(2+1) 15s', 'Q', 'Q(3) 10s', 'Q(6)+LFl 15s', 'IQ 13s', 'VQ', 'VQ(3) 5s',
 * 'VQ(6)+LFl 10s', 'IVQ 10s', 'UQ', 'Mo(A) 6s', 'Al.WR 4s', 'Al.Bu.Y 3s', 'F R'.
 * Zwraca { segs: [{ on, d, c, b }], period } – suma d = period.
 */
export function lightSequence(code) {
  const str = String(code).trim();
  const alt = str.match(/^Al\.([A-Za-z.]+)(?:\s+(\d+(?:[.,]\d+)?)s)?$/);
  if (alt) {
    // zmiennobarwne: kolory na zmianę, z krótką przerwą
    const ac = colorsOf(alt[1]), p = alt[2] ? parseFloat(alt[2].replace(',', '.')) : ac.length * 1.5;
    if (ac.length < 2) throw new Error(`Nieznana charakterystyka: ${code}`);
    return { segs: ac.map((cc) => [on(p / ac.length - 0.5, cc), off(0.5)]).flat(), period: p };
  }
  const m = str.match(/^([A-Za-z]+)(?:\(([^)]*)\))?(\+LFl)?(?:\s+([A-Za-z]+))?(?:\s+(\d+(?:[.,]\d+)?)s)?$/);
  if (!m) throw new Error(`Nieznana charakterystyka: ${code}`);
  const [, kind, grp, plusL, colTok, perTok] = m;
  const per = perTok ? parseFloat(perTok.replace(',', '.')) : null;
  const c = colorsOf(colTok)[0] || 'W';
  const [a, b2] = groups(grp);
  let segs;
  switch (kind) {
    case 'F': return { segs: [on(per || 2, c)], period: per || 2 };
    case 'FFl': {
      // światło stałe z rozbłyskami (jaśniejszymi błyskami)
      const p = per || (b2 ? 12 : a > 1 ? 8 : 5), fl = (n) => Array.from({ length: n }, (_, i) => (i ? [on(0.7, c, BASE), on(FL, c)] : [on(FL, c)])).flat();
      segs = b2 ? [...fl(a), on(2, c, BASE), ...fl(b2)] : fl(a);
      return { segs: [...segs, on(p - sum(segs), c, BASE)], period: p };
    }
    case 'Fl': {
      segs = b2 ? [...flashes(a, FL, FL_GAP, c), off(2.5), ...flashes(b2, FL, FL_GAP, c)] : flashes(a, FL, FL_GAP, c);
      return { segs: fill(segs, per || 4), period: per || 4 };
    }
    case 'LFl': {
      segs = b2 ? [...flashes(a, LF, LF_GAP, c), off(3), ...flashes(b2, LF, LF_GAP, c)] : flashes(a, LF, LF_GAP, c);
      const p = per || (b2 ? 18 : a > 1 ? 12 : 10);
      return { segs: fill(segs, p), period: p };
    }
    case 'Q': case 'VQ': case 'UQ': {
      const q = { Q, VQ, UQ }[kind];
      if (!grp && !plusL && !per) return { segs: [on(q.on, c), off(q.per - q.on)], period: q.per }; // ciągłe
      segs = quick(a, q, c);
      if (plusL) segs = [...segs, off(q.per - q.on), on(LF, c)];
      return { segs: fill(segs, per), period: per };
    }
    case 'IQ': case 'IVQ': {
      // migające przerywane: seria błysków, potem zaciemnienie co najmniej 3 s
      const q = kind === 'IQ' ? Q : VQ, p = per || (kind === 'IQ' ? 13 : 10), n = Math.round((p - 3) / q.per);
      segs = quick(n, q, c);
      return { segs: fill(segs, p), period: p };
    }
    case 'Iso': { const p = per || 4; return { segs: [on(p / 2, c), off(p / 2)], period: p }; }
    case 'Oc': {
      // zaciemnienia po 1 s rozdzielone 1 s światła; między grupami „a+b” – dłuższe światło
      const ecl = (n) => Array.from({ length: n }, (_, i) => (i ? [on(1, c), off(1)] : [off(1)])).flat();
      segs = b2 ? [...ecl(a), on(2.5, c), ...ecl(b2)] : ecl(a);
      const p = per || (b2 ? 12 : a > 1 ? 8 : 4);
      return { segs: [on(p - sum(segs), c), ...segs], period: p };
    }
    case 'Mo': {
      // kropka 0,5 s, kreska 1,5 s, przerwa między znakami 0,5 s
      const MORSE = { A: '.-', U: '..-', D: '-..', N: '-.', B: '-...' };
      const code2 = MORSE[(grp || 'A').toUpperCase()] || '.-';
      segs = code2.split('').map((s, i) => (i ? [off(0.5), on(s === '.' ? 0.5 : 1.5, c)] : [on(s === '.' ? 0.5 : 1.5, c)])).flat();
      return { segs: fill(segs, per || 6), period: per || 6 };
    }
    default: throw new Error(`Nieznana charakterystyka: ${code}`);
  }
}

// stan lampy w chwili t (s): { on, c, b }
export function lightAt(seq, t) {
  let x = ((t % seq.period) + seq.period) % seq.period;
  for (const s of seq.segs) { if (x < s.d) return s; x -= s.d; }
  return seq.segs[seq.segs.length - 1];
}
