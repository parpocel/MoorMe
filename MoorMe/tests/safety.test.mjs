// Moduł bezpieczeństwa: informacje o urządzeniach, kanały VHF, procedury i test korespondencji
import { deviceInfo, DEVICE_IDS, channels, VALID_CHANNELS, procedureCard, makeRadioTask, checkRadio } from '../src/js/data/safety.js';
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
let allOk = true;
for (let i = 0; i < 300; i++) {
  const t = makeRadioTask(r, ship);
  kinds[t.id] = (kinds[t.id] || 0) + 1;
  // poprawna odpowiedź przechodzi, zła nie
  const good = checkRadio(t, { channel: t.channels[0], dscSent: true, lines: t.lines ? [...t.lines] : [] });
  const badCh = checkRadio(t, { channel: t.channels.includes(16) ? 70 : 16, dscSent: true, lines: t.lines ? [...t.lines] : [] });
  if (!good.ok || badCh.ok) allOk = false;
  if (t.lines) {
    if (t.pool.length !== t.lines.length + t.distractors.length || new Set(t.pool).size !== t.pool.length) allOk = false;
    if (t.distractors.some((d) => t.lines.includes(d))) allOk = false;
    const swapped = [...t.lines]; [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    if (checkRadio(t, { channel: t.channels[0], dscSent: true, lines: swapped }).ok) allOk = false;
    if (!t.lines.some((l) => l.includes('ZEFIR'))) allOk = false;
  }
  if (t.dsc && checkRadio(t, { channel: 16, dscSent: false, lines: [...t.lines] }).ok) allOk = false;
}
check(allOk, 'test radiowy: poprawne odpowiedzi przechodzą, zły kanał / kolejność / brak DSC – nie');
check(Object.keys(kinds).length >= 10, `losowane są wszystkie rodzaje zadań (${Object.keys(kinds).join(', ')})`);
check(makeRadioTask(rng(1), ship, 'mayday').dsc === true && makeRadioTask(rng(1), ship, 'pan').dsc === false, 'MAYDAY wymaga alarmu DSC');

setLang('en');
const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const en = [...DEVICE_IDS.flatMap((id) => { const d = deviceInfo(id); return [d.name, d.short, ...d.sections.flat()]; }), ...channels().map((c) => c.use), ...['mayday', 'pan', 'securite'].flatMap((k) => { const p = procedureCard(k); return [p.when, p.after, ...p.steps]; })];
const tk = Array.from({ length: 40 }, (_, i) => makeRadioTask(rng(i + 1), ship)).flatMap((t) => [t.text, t.explain]);
check([...en, ...tk].every((s) => !PL.test(s)), 'treści modułu po angielsku');
setLang('pl');
if (fails) process.exit(1);
console.log('Wszystko OK');
