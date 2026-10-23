import { SIGNALS, SIGNAL_BY_ID, CONTEXTS, notation, schedule, signalOptions, makeSignalDeck } from '../src/js/data/soundSignals.js';
import { setLang, t } from '../src/js/i18n.js';
import { rng } from '../src/js/math.js';

let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };

// 1) w obrębie jednego kontekstu każdy sygnał ma inny zapis (da się je odróżnić słuchem)
for (const c of Object.keys(CONTEXTS)) {
  const ps = SIGNALS.filter((s) => s.ctx === c).map((s) => s.p);
  check(new Set(ps).size === ps.length, `${c}: sygnały mają różne zapisy (${ps.join(' ')})`);
}
check(SIGNAL_BY_ID.port.p === 'SS' && SIGNAL_BY_ID.astern.p === 'SSS' && SIGNAL_BY_ID.fSpecial.p === 'LSS' && SIGNAL_BY_ID.doubt.p.length >= 5, 'zapisy zgodne z MPZZM (2 krótkie – w lewo, 3 – wstecz, —•• – mgła, ≥5 krótkich – wątpliwość)');
// 2) plan odtwarzania: długi 4–6 s, krótki ok. 1 s, przerwy ok. 1 s
const sc = schedule('LSS');
check(sc.parts.length === 3 && sc.parts[0].dur >= 4 && sc.parts[0].dur <= 6 && sc.parts[1].dur === 1 && Math.abs(sc.parts[1].t0 - (sc.parts[0].dur + 1)) < 1e-9, `—•• : ${sc.parts.map((p) => `${p.kind}@${p.t0}`).join(', ')}`);
check(notation('LLS') === '— — •', `zapis graficzny: ${notation('LLS')}`);
{ // człowiek za burtą (śródlądowe): pary krótkich rozdzielone dłuższą przerwą
  const m = schedule(SIGNAL_BY_ID.iMob.p), gaps = m.parts.slice(1).map((q, i) => q.t0 - (m.parts[i].t0 + m.parts[i].dur));
  check(m.parts.length === 6 && gaps[0] < 1.5 && gaps[1] > 2 && gaps[2] < 1.5 && gaps[3] > 2, `•• •• •• – przerwy ${gaps.map((g) => g.toFixed(1)).join('/')} s`);
}
// 3) odpowiedzi z tego samego kontekstu, talia bez powtórek
const r = rng(5);
const o = signalOptions(r, 'fAnchor', 5);
check(o.length === 5 && o.includes('fAnchor') && o.every((id) => SIGNAL_BY_ID[id].ctx === 'fog'), `odpowiedzi tylko z kontekstu mgły (${o.join(', ')})`);
const deck = makeSignalDeck(rng(9));
const round = Array.from({ length: SIGNALS.length }, () => deck());
check(new Set(round).size === SIGNALS.length, `każdy z ${SIGNALS.length} sygnałów raz na rundę`);
// 4) tłumaczenia
setLang('en');
const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const strs = [...SIGNALS.map((s) => s.name), ...Object.values(CONTEXTS)];
const missing = strs.filter((s) => t(s) === s || PL.test(t(s)));
check(missing.length === 0, `sygnały mają tłumaczenie (${strs.length})${missing.length ? ': ' + missing.slice(0, 3).join(' | ') : ''}`);
setLang('pl');
// sygnał rozpoznany 3× w sesji już nie wraca; po opanowaniu wszystkich talia jest pusta
{
  const { makeSignalDeck: mk } = await import('../src/js/data/soundSignals.js');
  const d = mk(rng(5), ['inland']);
  const seen = new Map();
  for (let i = 0; i < 200; i++) { const id = d(); if (!id) break; seen.set(id, (seen.get(id) || 0) + 1); d.correct(id); }
  check(d() === null && [...seen.values()].every((n) => n === 3) && d.learnedCount() === d.total(), `opanowane po 3 poprawnych: każdy sygnał ${[...new Set(seen.values())].join('/')}×, potem talia pusta`);
}
if (fails) process.exit(1);
console.log('Wszystko OK');
