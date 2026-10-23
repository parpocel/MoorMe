// Charakterystyki świateł nawigacyjnych (IALA): sekwencje świecenia i ciemności w sekundach.
// Używane w podręczniku: wykres czasowy i animacja lampy z prawdziwym taktowaniem.

export const LIGHT_COLORS = { W: '#fff4c8', R: '#ff3b2f', G: '#29e05a', Y: '#ffd21f', Bu: '#3a8bff' };

// rytmy (IALA): błysk Fl ≈ 0,5 s; długi błysk LFl ≥ 2 s; Q – 60/min; VQ – 120/min; UQ – 240/min
const FL = 0.5, FL_GAP = 1.0, Q = { on: 0.3, per: 1.0 }, VQ = { on: 0.18, per: 0.5 }, UQ = { on: 0.09, per: 0.25 };

// pomocnicze: kolejne odcinki { on, d, c }
const on = (d, c) => ({ on: true, d, c });
const off = (d) => ({ on: false, d });
const fill = (segs, period) => { const used = segs.reduce((s, x) => s + x.d, 0); return period > used + 1e-9 ? [...segs, off(period - used)] : segs; };
const flashes = (n, f, gap, c) => Array.from({ length: n }, (_, i) => (i < n - 1 ? [on(f, c), off(gap)] : [on(f, c)])).flat();
const quick = (n, q, c) => flashes(n, q.on, q.per - q.on, c);

/**
 * Sekwencja dla zapisu, np. 'Fl G 4s', 'Fl(2) 5s', 'Fl(2+1) R 10s', 'Q', 'VQ(3) 5s', 'Q(6)+LFl 15s',
 * 'Iso 4s', 'Oc 4s', 'Oc(2) 8s', 'LFl 10s', 'Mo(A) 6s', 'Al.Bu.Y 3s', 'F R'.
 * Zwraca { segs: [{ on, d, c }], period } – suma d = period.
 */
export function lightSequence(code) {
  const m = String(code).trim().match(/^(Al\.)?([A-Za-z]+)(?:\(([^)]*)\))?(\+LFl)?(?:\.([A-Za-z.]+))?(?:\s+([A-Za-z]+(?:\.[A-Za-z]+)*))?(?:\s+(\d+(?:[.,]\d+)?)s)?$/);
  if (!m) throw new Error(`Nieznana charakterystyka: ${code}`);
  const [, alt, kind, grp, plusL, altCols, colTok, perTok] = m;
  const per = perTok ? parseFloat(perTok.replace(',', '.')) : null;
  const cols = (altCols || colTok || 'W').split('.').filter(Boolean);
  const c = cols[0];
  const n = grp && /^\d+$/.test(grp) ? Number(grp) : 1;
  let segs;
  if (alt) {
    // zmiennobarwne (np. Al.Bu.Y): kolory na zmianę z krótką przerwą
    const ac = [kind, ...(altCols || '').split('.').filter(Boolean)], p = per || ac.length * 1.5;
    segs = ac.map((cc) => [on(p / ac.length - 0.5, cc), off(0.5)]).flat();
    return { segs, period: p };
  }
  switch (kind) {
    case 'F': return { segs: [on(per || 2, c)], period: per || 2 };
    case 'Fl': {
      if (grp && grp.includes('+')) {
        const [a, b] = grp.split('+').map(Number);
        segs = [...flashes(a, FL, FL_GAP, c), off(2.5), ...flashes(b, FL, FL_GAP, c)];
      } else segs = flashes(n, FL, FL_GAP, c);
      return { segs: fill(segs, per || 4), period: per || 4 };
    }
    case 'LFl': return { segs: fill([on(2, c)], per || 10), period: per || 10 };
    case 'Q': case 'VQ': case 'UQ': {
      const q = { Q, VQ, UQ }[kind];
      if (!grp && !plusL && !per) return { segs: quick(1, q, c).concat(off(q.per - q.on)), period: q.per }; // ciągłe
      segs = quick(n, q, c);
      if (plusL) segs = [...segs, off(q.per - q.on), on(2, c)];
      return { segs: fill(segs, per), period: per };
    }
    case 'Iso': { const p = per || 4; return { segs: [on(p / 2, c), off(p / 2)], period: p }; }
    case 'Oc': {
      const p = per || 4;
      if (n === 1) return { segs: [on(p - 1, c), off(1)], period: p };
      // grupowe przerywane: n zaćmień po 1 s rozdzielonych 1 s światła
      const tail = Array.from({ length: n - 1 }, () => [off(1), on(1, c)]).flat();
      return { segs: [on(p - (2 * n - 1), c), ...tail, off(1)], period: p };
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

// stan lampy w chwili t (s): { on, c }
export function lightAt(seq, t) {
  let x = ((t % seq.period) + seq.period) % seq.period;
  for (const s of seq.segs) { if (x < s.d) return s; x -= s.d; }
  return seq.segs[seq.segs.length - 1];
}
