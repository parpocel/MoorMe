import { VESSELS, VESSEL_BY_ID, DAY_VESSELS, ASPECTS, GEAR_SIDES, PASS_SIDES, relBearing, aspectOf, visibleLights, spawnVessel, answerOptions, makeDeck, passSide, lightSignature, typeSignatures } from '../src/js/data/shipLights.js';
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

// 3b) talia: każdy typ raz na rundę (statek na kotwicy nie dominuje), trałowce i rybacy zawsze się pojawiają
{
  const deck = makeDeck(rng(3));
  const round = Array.from({ length: VESSELS.length }, () => deck());
  check(new Set(round).size === VESSELS.length, `w jednej rundzie każdy z ${VESSELS.length} typów pojawia się raz`);
  const day = makeDeck(rng(4), true);
  const dr = Array.from({ length: DAY_VESSELS.length }, () => day());
  check(new Set(dr).size === DAY_VESSELS.length && dr.includes('dFishingGear'), `tryb dzienny: ${DAY_VESSELS.length} typów, w tym połów z sieciami`);
}
// 3c) sieci: dodatkowe białe światło / stożek po stronie sieci
{
  const v = spawnVessel(rng(11), { x: 0, z: 0, hdg: 90 }, { type: 'fishingGear' });
  const g = v.lights.find((l) => l.c === 'white' && l.s === 'all' && Math.abs(l.z) > 1);
  check(g && (g.z > 0) === (v.gearSide === 'starboard'), `światło sieci po stronie ${v.gearSide}`);
  const d = spawnVessel(rng(12), { x: 0, z: 0, hdg: 90 }, { type: 'dFishingGear', day: true });
  const c = d.shapes.find((s) => s.k === 'coneUp');
  check(c && (c.z > 0) === (d.gearSide === 'starboard') && d.hull === 'trawler', `stożek wierzchołkiem w górę po stronie sieci (${d.gearSide})`);
}

// 3d) statek prosto na nas: oba burtowe widoczne, a przejście przed dziobem / za rufą zgodne z ruchem względnym
{
  const r2 = rng(21), seen = { ahead: 0, astern: 0 };
  let okAll = true;
  for (let i = 0; i < 60; i++) {
    const obs = { x: 0, z: 0, hdg: 90, speed: 0.84 };
    const v = spawnVessel(r2, obs, { type: 'power', aspect: 'bow' });
    const rel = relBearing(v.x, v.z, v.hdg, 0, 0);
    if (Math.abs(rel) > 3 || !v.pass) { okAll = false; continue; }
    seen[v.pass]++;
    // symulacja: czy rzeczywiście przecina naszą linię kursu przed / za nami
    let x = v.x, z = v.z, ox = 0, cross = null;
    const vx = Math.sin(v.hdg * Math.PI / 180) * v.speed * 0.514444, vz = -Math.cos(v.hdg * Math.PI / 180) * v.speed * 0.514444;
    for (let t = 0; t < 2000 && cross === null; t += 0.5) {
      const pz = z; x += vx * 0.5; z += vz * 0.5; ox += 0.84 * 0.5;
      if (Math.sign(pz) !== Math.sign(z)) cross = x > ox ? 'ahead' : 'astern';
    }
    if (cross !== v.pass) okAll = false;
  }
  check(okAll && seen.ahead > 5 && seen.astern > 5, `statek prosto na nas: przejście przed dziobem ${seen.ahead}×, za rufą ${seen.astern}×, zgodne z symulacją`);
  check(Object.values(PASS_SIDES).every((s2) => s2.length > 5), 'opisy przejścia');
}

// 4) odpowiedzi: 6 różnych, w tym poprawna
const opts = answerOptions(r, 'pilot', 6);
check(opts.length === 6 && new Set(opts).size === 6 && opts.includes('pilot'), `6 różnych odpowiedzi z poprawną (${opts.join(', ')})`);

// 4b) jedna pasująca odpowiedź: wśród opcji nie ma innego typu, który mógłby pokazać te same światła
{
  const r3 = rng(77);
  let amb = 0, singleWhite = 0;
  for (let i = 0; i < 600; i++) {
    const obs = { x: 0, z: 0, hdg: 90, speed: 0.8 };
    const v = spawnVessel(r3, obs, { type: VESSELS[i % VESSELS.length].id });
    const rel = relBearing(v.x, v.z, v.hdg, obs.x, obs.z), sig = lightSignature(v.lights, rel);
    const opts = answerOptions(r3, v.type, 6, { lights: v.lights, rel });
    if (sig === 'white') singleWhite++;
    if (opts.filter((id) => id !== v.type && typeSignatures(id).has(sig)).length) amb++;
    if (!opts.includes(v.type)) amb++;
  }
  check(amb === 0 && singleWhite > 5, `opcje odpowiedzi jednoznaczne (pojedyncze białe światło ${singleWhite}×, niejednoznacznych: ${amb})`);
  check(lightSignature(VESSEL_BY_ID.fishing.lights(25), 180) !== lightSignature(VESSEL_BY_ID.pilot.lights(20), 180), 'czerwone nad białym ≠ białe nad czerwonym');
}

// 5) tłumaczenia
setLang('en');
const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const strs = [...VESSELS.flatMap((v) => [v.name, v.explain]), ...DAY_VESSELS.flatMap((v) => [v.name, v.explain]), ...Object.values(ASPECTS), ...Object.values(GEAR_SIDES), ...Object.values(PASS_SIDES)];
const missing = strs.filter((s) => t(s) === s || PL.test(t(s)));
check(missing.length === 0, `nazwy i opisy świateł mają tłumaczenie (${strs.length})${missing.length ? ': ' + missing.slice(0, 3).join(' | ') : ''}`);
check(t('Błąd – to: Statek pilotowy na służbie') === 'Wrong – it was: Pilot vessel on duty', 'komunikat o błędzie tłumaczy nazwę statku');
setLang('pl');

if (fails) process.exit(1);
console.log('Wszystko OK');
