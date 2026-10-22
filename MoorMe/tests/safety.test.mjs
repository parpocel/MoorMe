// Moduł bezpieczeństwa: informacje o urządzeniach, kanały VHF, procedury i test korespondencji
import { deviceInfo, DEVICE_IDS, channels, VALID_CHANNELS, procedureCard, makeRadioTask, checkRadio, makeRadioDeck, radioTaskKeys } from '../src/js/data/safety.js';
import { setLang } from '../src/js/i18n.js';
import { rng } from '../src/js/math.js';

let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const ship = { name: 'ZEFIR', call: 'SPS2024', mmsi: '261012345' };

check(DEVICE_IDS.every((id) => deviceInfo(id) && deviceInfo(id).name && deviceInfo(id).short), 'każde urządzenie ma nazwę i opis');
const ch = channels();
check(ch.find((c) => c.ch === 16).f === '156.800' && ch.find((c) => c.ch === 70).f === '156.525' && ch.find((c) => c.ch === 13).f === '156.650' && ch.find((c) => c.ch === 6).f === '156.300', 'częstotliwości kanałów 16, 70, 13, 06');
check(ch.every((c) => VALID_CHANNELS.includes(c.ch)), 'kanały z tabeli da się ustawić w radiu');
for (const k of ['mayday', 'pan', 'securite']) { const p = procedureCard(k); check(p.lines.length >= 5, `karta ${p.title}: ${p.lines.length} linii`); }
check(procedureCard('mayday').lines.at(-1) === 'OVER' && procedureCard('securite').lines.at(-1) === 'OUT', 'MAYDAY kończy się OVER, SÉCURITÉ – OUT');

const r = rng(5), kinds = {};
let allOk = true, twoStep = 0;
for (let i = 0; i < 300; i++) {
  const t = makeRadioTask(r, ship);
  kinds[t.id] = (kinds[t.id] || 0) + 1;
  if (t.steps.length > 1) twoStep++;
  for (const st of t.steps) {
    const good = checkRadio(st, { channel: st.channels[0], power: st.power || 25, dscSent: true, lines: st.lines ? [...st.lines] : [] });
    const badCh = checkRadio(st, { channel: st.channels.includes(16) ? 70 : 16, power: st.power || 25, dscSent: true, lines: st.lines ? [...st.lines] : [] });
    if (!good.ok || badCh.ok) allOk = false;
    if (st.power && checkRadio(st, { channel: st.channels[0], power: st.power === 1 ? 25 : 1, dscSent: true, lines: st.lines ? [...st.lines] : [] }).ok) allOk = false;
    if (st.lines) {
      if (st.pool.length !== st.lines.length + st.distractors.length || new Set(st.pool).size !== st.pool.length) allOk = false;
      if (st.distractors.some((d) => st.lines.includes(d))) allOk = false;
      const swapped = [...st.lines]; [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      if (checkRadio(st, { channel: st.channels[0], power: st.power || 25, dscSent: true, lines: swapped }).ok) allOk = false;
    }
    if (st.dsc && checkRadio(st, { channel: 16, power: 25, dscSent: false, lines: [...st.lines] }).ok) allOk = false;
  }
}
check(allOk, 'test radiowy: poprawne odpowiedzi przechodzą, zły kanał / moc / kolejność / brak DSC – nie');
check(Object.keys(kinds).length >= 11, `losowane są wszystkie rodzaje zadań (${Object.keys(kinds).join(', ')})`);
const mt = makeRadioTask(rng(1), ship, 'mayday').steps[0], sec = makeRadioTask(rng(2), ship, 'securite');
check(mt.dsc === true && mt.power === 25, 'MAYDAY: alarm DSC i pełna moc 25 W');
check(sec.steps.length === 2 && sec.steps[0].channels[0] === 16 && [72, 77].includes(sec.steps[1].channels[0]) && !sec.steps.some((s) => s.channels.includes(6)), 'SÉCURITÉ: zapowiedź na 16, komunikat na kanale roboczym 72/77 (nie 06)');
check(makeRadioTask(rng(3), ship, 'onboard').steps[0].power === 1, 'łączność na pokładzie (15/17) tylko 1 W');
{
  // talia: każde odrębne zadanie (rodzaj + scenariusz) raz na cykl – inna nazwa jachtu czy pozycja to nie nowe zadanie
  const deck = makeRadioDeck(rng(7)), N = radioTaskKeys().length, seen = [];
  for (let i = 0; i < N * 3; i++) seen.push(deck.next(ship).key);
  let cyc = true, rep = false;
  for (let c = 0; c < 3; c++) if (new Set(seen.slice(c * N, c * N + N)).size !== N) cyc = false;
  for (let i = 1; i < seen.length; i++) if (seen[i] === seen[i - 1]) rep = true;
  check(cyc && !rep && N >= 15, `talia zadań radiowych: ${N} odrębnych zadań, każde raz na cykl, bez powtórki pod rząd`);
}
setLang('en');
const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const en = [...DEVICE_IDS.flatMap((id) => { const d = deviceInfo(id); return [d.name, d.short, ...d.sections.flat()]; }), ...channels().map((c) => c.use), ...['mayday', 'pan', 'securite'].flatMap((k) => { const p = procedureCard(k); return [p.when, p.after, ...p.steps]; })];
const tk = Array.from({ length: 40 }, (_, i) => makeRadioTask(rng(i + 1), ship)).flatMap((t) => [t.text, t.explain, ...t.steps.map((s) => s.label || '')]);
check([...en, ...tk].every((s) => !PL.test(s)), 'treści modułu po angielsku');
setLang('pl');
if (fails) process.exit(1);
console.log('Wszystko OK');
