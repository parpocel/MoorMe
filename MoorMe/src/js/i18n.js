// Tłumaczenia: tekst źródłowy jest po polsku (pl = klucz i fallback), słownik angielski w i18n/en.js.
// Teksty w DOM tłumaczy obserwator zmian (installDomTranslator), a napisy na płótnach – jawne t().
import { EN, RULES } from './i18n/en.js';

const KEY = 'moorme.lang';
let lang = 'pl';
try {
  const s = typeof localStorage !== 'undefined' && localStorage.getItem(KEY);
  if (s === 'en' || s === 'pl') lang = s;
} catch (e) { /* brak zapisu */ }

export const LANGS = [{ id: 'pl', name: 'Polski' }, { id: 'en', name: 'English' }];
export const getLang = () => lang;
export function hasSavedLang() {
  try { return typeof localStorage !== 'undefined' && !!localStorage.getItem(KEY); } catch (e) { return true; }
}
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'pl';
  try { localStorage.setItem(KEY, lang); } catch (e) { /* ignoruj */ }
  cache.clear();
}
// litery boków: lewa/prawa burta (PL: L/P, EN: P/S)
export const sideLetters = () => (lang === 'en' ? ['P', 'S'] : ['L', 'P']);

const HAS_LETTER = /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/;
const cache = new Map();

function lowerFirst(s) { return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s; }

function tr(core, depth) {
  if (depth > 6) return core;
  const hit = EN[core];
  if (hit !== undefined) return hit;
  if (core.includes(' · ')) {
    const parts = core.split(' · ');
    const out = parts.map((p) => tr(p, depth + 1));
    if (out.some((x, i) => x !== parts[i])) return out.join(' · ');
  }
  for (const [re, fn] of RULES) {
    const m = re.exec(core);
    if (m) {
      const r = fn(m, (x) => tr(x, depth + 1));
      if (r != null) return r;
    }
  }
  const c = core[0];
  if (c !== c.toUpperCase()) {
    const up = c.toUpperCase() + core.slice(1);
    const r = tr(up, depth + 1);
    if (r !== up) return lowerFirst(r);
  }
  return core;
}

export function t(s) {
  if (lang !== 'en' || typeof s !== 'string' || !HAS_LETTER.test(s)) return s;
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  const core = m[2];
  const out = core ? m[1] + tr(core, 0) + m[3] : s;
  if (!/\d/.test(s)) cache.set(s, out);
  return out;
}

// Obserwator: tłumaczy teksty węzłów i atrybuty title/placeholder dodawane do dokumentu
export function installDomTranslator(root = document.body) {
  if (lang !== 'en') return;
  const done = new WeakMap();
  const fixText = (n) => {
    const v = n.nodeValue;
    if (done.get(n) === v) return;
    const o = t(v);
    if (o !== v) n.nodeValue = o;
    done.set(n, n.nodeValue);
  };
  const fixAttrs = (el) => {
    for (const a of ['title', 'placeholder']) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) { const o = t(v); if (o !== v) el.setAttribute(a, o); }
    }
  };
  const walk = (node) => {
    if (node.nodeType === 3) { fixText(node); return; }
    if (node.nodeType !== 1) return;
    fixAttrs(node);
    const tw = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (n.nodeType === 3) fixText(n); else fixAttrs(n);
    }
  };
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach(walk);
      else if (m.type === 'characterData') fixText(m.target);
      else if (m.type === 'attributes') fixAttrs(m.target);
    }
  });
  mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder'] });
  walk(root);
}
