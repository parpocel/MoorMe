// Testy charakterystyk manewrowych modeli łodzi (zakresy realistyczne)
import { BOATS, defaultEquipment } from '../src/js/data/boats.js';
import { BoatPhysics } from '../src/js/physics/boatPhysics.js';
import { Environment } from '../src/js/physics/environment.js';
const KN = 0.514444, DT = 1 / 240;
let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const calm = () => new Environment({ windKn: 0, windFrom: 0, gust: 0 });
const run = (b, env, s) => { for (let i = 0; i < s / DT; i++) b.step(DT, env); };
for (const id of Object.keys(BOATS)) {
  const spec = BOATS[id], eq = defaultEquipment(spec);
  let b = new BoatPhysics(spec, eq); b.throttle = 1; run(b, calm(), 120);
  const vmax = b.speed / KN;
  check(vmax > spec.maxSpeedKn * 0.9 && vmax < spec.maxSpeedKn * 1.1, `${id}: prędkość maks. ${vmax.toFixed(2)} kn`);
  b = new BoatPhysics(spec, eq); b.throttle = 0.12; run(b, calm(), 60);
  const vidle = b.speed / KN;
  check(vidle > 1.5 && vidle < 3.2, `${id}: prędkość na biegu jałowym ${vidle.toFixed(2)} kn`);
  b = new BoatPhysics(spec, eq); b.throttle = 0.5; run(b, calm(), 40); b.rudderCmd = 35 * Math.PI / 180;
  let mn = 1e9, mx = -1e9; for (let i = 0; i < 120 / DT; i++) { b.step(DT, calm()); mn = Math.min(mn, b.z); mx = Math.max(mx, b.z); }
  const d = (mx - mn) / spec.loa;
  check(d > 1.3 && d < 3.5, `${id}: średnica cyrkulacji ${d.toFixed(2)} L`);
  // prop walk: prawoskrętna na wstecznym – rufa w lewo => dziób w prawo (th rośnie)
  b = new BoatPhysics(spec, { ...eq, propHand: 'right' }); b.throttle = -0.7; run(b, calm(), 8);
  const r1 = b.th;
  b = new BoatPhysics(spec, { ...eq, propHand: 'left' }); b.throttle = -0.7; run(b, calm(), 8);
  const r2 = b.th;
  check(r1 > 0.02 && r2 < -0.02, `${id}: zarzucanie rufy prawo/lewoskrętna ${(r1 * 57.3).toFixed(1)}° / ${(r2 * 57.3).toFixed(1)}°`);
  // dryf w wietrze 15 kn z boku
  b = new BoatPhysics(spec, eq); const env = new Environment({ windKn: 15, windFrom: 0, gust: 0 }); run(b, env, 60);
  check(b.speed / KN > 0.4 && b.speed / KN < 2, `${id}: dryf przy 15 kn ${(b.speed / KN).toFixed(2)} kn`);
  check(b.vz > 0, `${id}: dryf z wiatrem (na południe)`);
  // ster strumieniowy
  b = new BoatPhysics(spec, { ...eq, bowThruster: 'onoff' }); b.bowCmd = 1; run(b, calm(), 10);
  check(b.th > 0.2, `${id}: ster strumieniowy obraca dziób w prawo (${(b.th * 57.3).toFixed(0)}° w 10 s)`);
}
console.log(fails ? `${fails} błędów` : 'Wszystko OK');
process.exit(fails ? 1 : 0);
