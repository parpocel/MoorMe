import { BOATS, defaultEquipment, ITEM_KIND_LABEL } from '../src/js/data/boats.js';
import { generateHarbor, PORTS, METHODS, ROLE_NAMES, berthOptions } from '../src/js/data/harbors.js';
import { LINE_STATE_LABEL, TENDING_LABEL } from '../src/js/physics/lines.js';
import { KEYS, LINES } from '../src/js/ui/help.js';
import { setLang, t, getLang } from '../src/js/i18n.js';

let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };

check(getLang() === 'pl' && t('Nowa symulacja') === 'Nowa symulacja', 'po polsku teksty zostają bez zmian');
setLang('en');

const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const strs = new Set();
const add = (s) => { if (typeof s === 'string') strs.add(s); };
Object.values(METHODS).forEach((m) => { add(m.name); add(m.desc); });
Object.values(PORTS).forEach((p) => { add(p.name); add(p.desc); p.zones.forEach((z) => add(z.name)); p.starts.forEach((s) => add(s.name)); });
[ROLE_NAMES, LINE_STATE_LABEL, TENDING_LABEL, ITEM_KIND_LABEL].forEach((o) => Object.values(o).forEach(add));
KEYS.forEach(([, d]) => add(d));
LINES.forEach(([k, d]) => { add(k + '.'); add(d); });
for (const b of Object.values(BOATS)) defaultEquipment(b).deck.forEach((i) => add(i.label));
for (const port of Object.keys(PORTS)) {
  for (const o of berthOptions(port)) {
    add(o.zoneName);
    generateHarbor({ port, zone: o.zone, method: o.method, side: 'port', boatSpec: BOATS.C46, seed: 3 }).bollards.forEach((b) => add(b.label));
  }
}
const missing = [...strs].filter((s) => t(s) === s || PL.test(t(s)));
check(missing.length === 0, `wszystkie nazwy, opisy, pomoc i etykiety mają tłumaczenie (${strs.size} tekstów)${missing.length ? ': ' + missing.slice(0, 5).join(' | ') : ''}`);

const samples = [
  ['Cuma rufowa L', 'Stern line port'],
  ['Szpring dziobowy P', 'Forward spring stbd'],
  ['Poler 3', 'Bollard 3'],
  ['Knaga dziobowa L 2', 'Bow cleat port 2'],
  ['Cuma rufowa L: założona na stałe (poler 3)', 'Stern line port: rigged as fixed (bollard 3)'],
  ['Cuma dziobowa P: chybiony rzut – załoga zbiera linę i rzuca jeszcze raz', 'Bow line stbd: missed throw – the crew gathers the line and throws again'],
  ['Uderzenie kadłubem! (1.2 kn)', 'Hull impact! (1.2 kn)'],
  ['Cuma boczna (Y-bom) L ZERWANA! (3.4 kN)', 'Side line (Y-boom) port BROKEN! (3.4 kN)'],
  ['Cel: zacumuj – burtą (longside)', 'Goal: moor – alongside'],
  ['Założona · Zaknagowana · Poler 3', 'Rigged · Made fast · Bollard 3'],
  ['3.2 m · z pokładu', '3.2 m · from the deck'],
  ['Kuba (kapitan) · Wojtek · Bartek', 'Kuba (skipper) · Wojtek · Bartek'],
  ['  Czas płynie (1 s = 1 min)', '  Time flows (1 s = 1 min)'],
  ['Zacumowano!', 'Moored!'],
  ['10 kn (3°B)', '10 kn (Bft 3)']
];
for (const [pl, en] of samples) check(t(pl) === en, `${JSON.stringify(pl)} -> ${JSON.stringify(t(pl))}`);

setLang('pl');
check(t('Zacumowano!') === 'Zacumowano!', 'powrót do polskiego');
if (fails) process.exit(1);
console.log('Wszystko OK');
