// Moduł „Test”: pula pytań, skład egzaminu, poprawność odpowiedzi
import { buildPool, makeExam, EXAM } from '../src/js/data/exam.js';
import { rng } from '../src/js/math.js';
import { setLang } from '../src/js/i18n.js';

let fails = 0;
const check = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };

for (const lang of ['pl', 'en']) {
  setLang(lang);
  const sea = buildPool('sea'), inland = buildPool('inland');
  const ids = new Set([...sea, ...inland].map((e) => e.id));
  check(ids.size >= 2000, `[${lang}] baza ma co najmniej 2000 różnych pytań (${ids.size})`);
  check(new Set(sea.map((e) => e.id)).size === sea.length && new Set(inland.map((e) => e.id)).size === inland.length, `[${lang}] identyfikatory pytań są unikalne`);
  for (const [scope, pool] of [['sea', sea], ['inland', inland]]) {
    const r = rng(11);
    const bad = [];
    for (const e of pool) {
      const q = e.make(r);
      if (!q.q || q.options.length !== 3 || new Set(q.options).size !== 3 || !(q.answer >= 0 && q.answer < 3) || q.options.some((o) => !o)) bad.push(e.id);
    }
    if (lang === 'en') {
      const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/, rr = rng(4);
      const pl = pool.filter((e) => { const q = e.make(rr); return PL.test([q.q, ...q.options, q.explain || ''].join(' ')); });
      check(pl.length === 0, `[en] ${scope}: pytania są przetłumaczone${pl.length ? ': ' + pl.slice(0, 5).map((e) => e.id).join(', ') : ''}`);
    }
    check(bad.length === 0, `[${lang}] ${scope}: każde pytanie ma 3 różne odpowiedzi i jedną poprawną${bad.length ? ': ' + bad.slice(0, 5).join(', ') : ''}`);
    const ex = makeExam(rng(7), scope);
    check(ex.length === EXAM.questions, `[${lang}] ${scope}: egzamin ma ${EXAM.questions} pytań (${ex.length})`);
    // historia: drugi egzamin z historią pierwszego nie powtarza pytań
    const hist = Object.fromEntries(ex.map((q) => [q.id, 1]));
    const ex2 = makeExam(rng(8), scope, [], hist);
    const rep = ex2.filter((q) => hist[q.id]).length;
    check(rep <= 10, `[${lang}] ${scope}: kolejny egzamin prawie nie powtarza pytań (powtórzeń: ${rep})`);
  }
}
setLang('pl');
if (fails) { console.log(`\n${fails} błędów`); process.exit(1); }
console.log('\nWszystko OK');
