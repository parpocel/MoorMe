import { lightSequence, lightAt } from '../src/js/data/lightChar.js';

let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
// liczba błysków (włączeń) w ciągu minuty
const perMinute = (code) => { const s = lightSequence(code); let n = 0, prev = false; for (let t = 0; t < 60; t += 0.01) { const on = lightAt(s, t).on; if (on && !prev) n++; prev = on; } return n; };

const codes = ['F R', 'Fl G 4s', 'Fl(2) 5s', 'Fl(2+1) R 10s', 'LFl 10s', 'Q', 'VQ', 'UQ', 'Q(3) 10s', 'VQ(3) 5s', 'VQ(6)+LFl 10s', 'Q(6)+LFl 15s', 'VQ(9) 10s', 'Iso 4s', 'Oc 4s', 'Oc(2) 8s', 'Mo(A) 6s', 'Al.Bu.Y 3s'];
check(codes.every((c) => { const s = lightSequence(c); return Math.abs(s.segs.reduce((a, x) => a + x.d, 0) - s.period) < 1e-9; }), 'każda charakterystyka: suma faz = okres');
const q = perMinute('Q'), vq = perMinute('VQ'), uq = perMinute('UQ');
check(q >= 50 && q <= 79 && vq >= 80 && vq <= 159 && uq >= 160, `Q ${q}/min, VQ ${vq}/min, UQ ${uq}/min – w przedziałach IALA`);
check(perMinute('Fl G 4s') <= 30, 'Fl: najwyżej 30 błysków na minutę');
const grp = (code) => lightSequence(code).segs.filter((s) => s.on).length;
check(grp('VQ(3) 5s') === 3 && grp('VQ(6)+LFl 10s') === 7 && grp('VQ(9) 10s') === 9 && grp('Fl(2+1) R 10s') === 3, 'kardynalne 3 / 6+długi / 9 błysków, Fl(2+1) – 3 błyski');
const iso = lightSequence('Iso 4s').segs, oc = lightSequence('Oc 4s').segs, fl = lightSequence('Fl G 4s').segs;
check(iso[0].d === iso[1].d && oc[0].d > oc[1].d && fl[0].d < fl[1].d, 'Iso: światło = ciemność; Oc: światło dłużej; Fl: błysk krócej');
check(lightSequence('LFl 10s').segs[0].d >= 2 && lightSequence('VQ(6)+LFl 10s').segs.filter((s) => s.on).pop().d >= 2, 'długi błysk ≥ 2 s');
const al = lightSequence('Al.Bu.Y 3s').segs.filter((s) => s.on).map((s) => s.c).join(',');
check(al === 'Bu,Y', 'Al.Bu.Y – niebieskie i żółte na zmianę');
{
  // zestawienie z podręcznika: wszystkie zapisy dają poprawne sekwencje
  const all = ['F', 'FFl 5s', 'FFl(2) 8s', 'Oc 4s', 'Oc(2) 8s', 'Oc(2+1) 12s', 'Iso 4s', 'LFl 10s', 'LFl(2) 12s', 'LFl(2+1) 18s', 'Fl 4s', 'Fl(3) 10s', 'Fl(2+1) 10s', 'Q', 'Q(3) 10s', 'Q(6)+LFl 15s', 'IQ 13s', 'VQ', 'VQ(3) 5s', 'VQ(6)+LFl 10s', 'IVQ 10s', 'UQ', 'Mo(A) 6s', 'Al.WR 4s'];
  check(all.every((c) => { const s = lightSequence(c); return Math.abs(s.segs.reduce((a, x) => a + x.d, 0) - s.period) < 1e-9 && s.segs.every((x) => x.d > 0); }), `zestawienie: ${all.length} charakterystyk, suma faz = okres`);
  const iq = (c) => { const s = lightSequence(c).segs; return { n: s.filter((x) => x.on).length, gap: s[s.length - 1].d }; };
  check(iq('IQ 13s').n >= 8 && iq('IQ 13s').gap >= 3 && iq('IVQ 10s').n >= 8 && iq('IVQ 10s').gap >= 3, 'IQ / IVQ: co najmniej 8 błysków i przerwa ≥ 3 s');
  const ffl = lightSequence('FFl(2) 8s').segs;
  check(ffl.every((x) => x.on) && ffl.filter((x) => x.b === 1).length === 2, 'FFl(2): światło stałe z dwoma rozbłyskami');
  const oc21 = lightSequence('Oc(2+1) 12s').segs.filter((x) => !x.on).length, lf21 = lightSequence('LFl(2+1) 18s').segs.filter((x) => x.on);
  check(oc21 === 3 && lf21.length === 3 && lf21.every((x) => x.d >= 2), 'Oc(2+1): 3 zaciemnienia; LFl(2+1): 3 blaski ≥ 2 s');
  check(lightSequence('Al.WR 4s').segs.filter((x) => x.on).map((x) => x.c).join('') === 'WR', 'Al.WR – białe i czerwone na zmianę');
}
if (fails) process.exit(1);
console.log('Wszystko OK');
