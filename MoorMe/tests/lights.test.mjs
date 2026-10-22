import { VESSELS, VESSEL_BY_ID, ASPECTS, relBearing, aspectOf, visibleLights, spawnVessel, answerOptions } from '../src/js/data/shipLights.js';
import { setLang, t } from '../src/js/i18n.js';
import { rng } from '../src/js/math.js';

let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const colors = (ls) => ls.map((l) => l.c).sort().join(',');

// 1) sektory świateł statku o napędzie mechanicznym (< 50 m)
const P = VESSEL_BY_ID.power.lights(30);
check(colors(visibleLights(P, 0)) === 'green,red,white', `na wprost dziobu: masztowe + oba burtowe (${colors(visibleLights(P, 0))})`);
check(colors(visibleLights(P, 60)) === 'green,white', `z prawej burty: masztowe + zielone (${colors(visibleLights(P, 60))})`);
check(colors(visibleLights(P, -60)) === 'red,white', `z lewej burty: masztowe + czerwone (${colors(visibleLights(P, -60))})`);
check(colors(visibleLights(P, 180)) === 'white', `od rufy: tylko rufowe (${colors(visibleLights(P, 180))})`);
check(visibleLights(VESSEL_BY_ID.sailing.lights(12, () => 0.9), 0).every((l) => l.c !== 'white'), 'jacht żaglowy od dziobu: bez białego masztowego');
check(visibleLights(VESSEL_BY_ID.anchor.lights(30), 137).length === 1, 'kotwiczne widać ze wszystkich stron');
check(visibleLights(VESSEL_BY_ID.towing.lights(30), 180).some((l) => l.c === 'yellow'), 'holujący od rufy: żółte światło holownicze');

// 2) kąt względny i aspekt
check(Math.abs(relBearing(0, 0, 0, 0, -100)) < 1e-6, 'obserwator przed dziobem statku płynącego na N: kąt 0°');
check(Math.abs(relBearing(0, 0, 0, 100, 0) - 90) < 1e-6, 'obserwator na wschód od statku płynącego na N: +90° (prawa burta)');
check(aspectOf(0, true) === 'bow' && aspectOf(50, true) === 'starboard' && aspectOf(-50, true) === 'port' && aspectOf(170, true) === 'stern' && aspectOf(10, false) === 'none', 'aspekty: dziób, prawa, lewa, rufa, stoi');

// 3) losowanie statków: po właściwej burcie jachtu, w zasięgu, aspekt zgodny z kursem
const r = rng(7);
let sideOk = 0, distOk = 0, n = 0;
const seen = new Set();
for (let i = 0; i < 400; i++) {
  const obs = { x: 1000, z: -200, hdg: 90 };
  const v = spawnVessel(r, obs);
  seen.add(v.type);
  n++;
  const relY = relBearing(obs.x, obs.z, obs.hdg, v.x, v.z);
  if ((v.side === 'port' && relY < 0) || (v.side === 'starboard' && relY > 0)) sideOk++;
  const d = Math.hypot(v.x - obs.x, v.z - obs.z);
  if (d > 400 && d < 1300) distOk++;
  if (!v.lights.length) check(false, `${v.type}: brak świateł`);
}
check(sideOk === n, `statki pojawiają się na zapowiedzianej burcie (${sideOk}/${n})`);
check(distOk === n, `statki w odległości 0,2–0,7 nm (${distOk}/${n})`);
check(seen.size === VESSELS.length, `losowane są wszystkie typy jednostek (${seen.size}/${VESSELS.length})`);
for (const asp of ['bow', 'starboard', 'port', 'stern']) {
  let ok = 0, tot = 0;
  for (let i = 0; i < 200; i++) {
    const v = spawnVessel(r, { x: 0, z: 0, hdg: 90 }, { type: 'power' });
    const a = aspectOf(relBearing(v.x, v.z, v.hdg, 0, 0), true);
    if (a === asp) { tot++; ok++; }
  }
  check(tot > 10, `aspekt „${asp}” występuje (${tot}/200)`);
}

// 4) odpowiedzi: 6 różnych, w tym poprawna
const opts = answerOptions(r, 'pilot', 6);
check(opts.length === 6 && new Set(opts).size === 6 && opts.includes('pilot'), `6 różnych odpowiedzi z poprawną (${opts.join(', ')})`);

// 5) tłumaczenia
setLang('en');
const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const strs = [...VESSELS.flatMap((v) => [v.name, v.explain]), ...Object.values(ASPECTS)];
const missing = strs.filter((s) => t(s) === s || PL.test(t(s)));
check(missing.length === 0, `nazwy i opisy świateł mają tłumaczenie (${strs.length})${missing.length ? ': ' + missing.slice(0, 3).join(' | ') : ''}`);
check(t('Błąd – to: Statek pilotowy na służbie') === 'Wrong – it was: Pilot vessel on duty', 'komunikat o błędzie tłumaczy nazwę statku');
setLang('pl');

if (fails) process.exit(1);
console.log('Wszystko OK');
