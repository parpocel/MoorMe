// Edytor rozmieszczenia knag, kluz, półkluz i odbijaczy (widok z góry)
import { h } from './dom.js';
import { fenderLocal, drawHullPlan, drawDeckItemPretty, drawFenderPretty } from './draw2d.js';
import { hullExtents, halfBeamAt, ITEM_KIND_LABEL, fenderRadiusOf, sternFenderY } from '../data/boats.js';
import { t } from '../i18n.js';

export function autoLabel(spec, it) {
  const L = spec.loa;
  const pos = it.x > 0.25 * L ? 'dziobowa' : it.x < -0.25 * L ? 'rufowa' : 'śródokręcie';
  const side = it.y < 0 ? 'L' : 'P';
  return `${ITEM_KIND_LABEL[it.kind]} ${pos} ${side}`;
}

export function relabel(spec, deck) {
  const counts = {};
  for (const it of deck) {
    let base = autoLabel(spec, it);
    counts[base] = (counts[base] || 0) + 1;
    it.label = base;
  }
  // numeracja duplikatów
  const seen = {};
  for (const it of deck) {
    if (counts[it.label] > 1) {
      seen[it.label] = (seen[it.label] || 0) + 1;
      it.label = `${it.label} ${seen[it.label]}`;
    }
  }
}

export function createDeckEditor(spec, equip, onChange) {
  const canvas = h('canvas', { width: 1100, height: 520 });
  let tool = 'select';
  let selected = null;
  let drag = null;
  let nextId = 1000;
  const { xs, xb } = hullExtents(spec);
  const W = canvas.width, H = canvas.height;
  const scale = Math.min((W - 120) / spec.loa, (H - 80) / (spec.beam + 1.2));
  const cx = W / 2 - ((xs + xb) / 2) * scale, cy = H / 2;
  const toLocal = (px, py) => ({ x: (px - cx) / scale, y: (py - cy) / scale });

  const toolBtns = {};
  const tools = [
    ['select', '✋ Wybierz / przesuń'],
    ['cleat', '+ Knaga'],
    ['fairlead', '+ Kluza'],
    ['halfFairlead', '+ Półkluza'],
    ['fender', '+ Odbijacz'],
    ['ball', '+ Kula odbijacza'],
    ['delete', '✖ Usuń']
  ];
  const toolbar = h('div.tool-bar');
  for (const [id, label] of tools) {
    const b = h('button.btn.sm', { onclick: () => { tool = id; updateToolbar(); } }, label);
    toolBtns[id] = b;
    toolbar.appendChild(b);
  }
  const resetBtn = h('button.btn.sm', { style: { marginLeft: 'auto' }, onclick: () => { if (onChange) onChange('reset'); } }, '↺ Domyślne');
  toolbar.appendChild(resetBtn);
  function updateToolbar() {
    for (const [id, b] of Object.entries(toolBtns)) b.classList.toggle('on', id === tool);
    canvas.style.cursor = tool === 'select' ? 'grab' : tool === 'delete' ? 'not-allowed' : 'crosshair';
  }
  updateToolbar();

  const list = h('div.item-list');

  function clampItem(it) {
    it.x = Math.max(xs + 0.15, Math.min(xb - 0.4, it.x));
    const hb = halfBeamAt(spec, it.x);
    const side = it.y < 0 ? -1 : 1;
    if (it.kind === 'cleat') it.y = side * Math.min(Math.max(Math.abs(it.y), 0.1), hb - 0.15);
    else it.y = side * Math.max(hb - 0.06, 0.1);
    it.x = +it.x.toFixed(2); it.y = +it.y.toFixed(2);
  }

  // pozycja odbijacza: pawęż rufowa (dowolne miejsce w poprzek) albo dowolne miejsce burty aż po dziób
  function placeFender(f, p) {
    f.side = p.y < 0 ? -1 : 1;
    if (p.x < xs + 0.3) {
      f.stern = true; f.x = xs;
      f.y = +sternFenderY(spec, { ...f, y: p.y }, fenderRadiusOf(f, equip.fenderRadius)).toFixed(2);
    } else {
      delete f.stern; delete f.y;
      f.x = +Math.max(xs + 0.3, Math.min(xb - 0.12, p.x)).toFixed(2);
    }
  }

  function hitTest(p) {
    let best = null, bd = 0.45;
    for (const it of equip.deck) {
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (d < bd) { bd = d; best = { type: 'deck', it }; }
    }
    for (const f of equip.fenders) {
      const fp = fenderLocal(spec, f, equip.fenderRadius);
      const d = Math.hypot(fp.x - p.x, fp.y - p.y);
      if (d < bd) { bd = d; best = { type: 'fender', it: f }; }
    }
    return best;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const p = toLocal((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height));
    const hit = hitTest(p);
    if (tool === 'select') {
      selected = hit ? hit.it : null;
      if (hit) { drag = hit; canvas.setPointerCapture(e.pointerId); }
    } else if (tool === 'delete') {
      if (hit) {
        if (hit.type === 'deck') equip.deck.splice(equip.deck.indexOf(hit.it), 1);
        else equip.fenders.splice(equip.fenders.indexOf(hit.it), 1);
        relabel(spec, equip.deck);
      }
    } else if (tool === 'fender' || tool === 'ball') {
      const f = { id: (tool === 'ball' ? 'b' : 'f') + nextId++, x: 0, side: 1 };
      if (tool === 'ball') f.ball = true;
      placeFender(f, p);
      equip.fenders.push(f);
      selected = f;
    } else {
      const it = { id: tool + nextId++, kind: tool, x: p.x, y: p.y };
      clampItem(it);
      equip.deck.push(it);
      relabel(spec, equip.deck);
      selected = it;
    }
    render();
    if (onChange) onChange();
  });
  let hover = null;
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) {
      const r = canvas.getBoundingClientRect();
      const hit = hitTest(toLocal((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)));
      const hv = hit && hit.type === 'deck' ? hit.it : null;
      if (hv !== hover) { hover = hv; render(); }
      return;
    }
    const r = canvas.getBoundingClientRect();
    const p = toLocal((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height));
    if (drag.type === 'deck') {
      drag.it.x = p.x; drag.it.y = p.y;
      clampItem(drag.it);
    } else {
      placeFender(drag.it, p);
    }
    render();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag) { relabel(spec, equip.deck); drag = null; render(); if (onChange) onChange(); }
  });
  canvas.addEventListener('pointerleave', () => { if (hover) { hover = null; render(); } });

  function render() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    // tło: jasna woda z siatką metrową (jak karty wyboru jachtu)
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#e6f1f0'); bg.addColorStop(1, '#cfe2e4');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(47,68,104,0.07)'; ctx.lineWidth = 1;
    for (let x = cx % scale; x < W; x += scale) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = cy % scale; y < H; y += scale) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    // opisy burt
    const pill = (txt, x, y, col, align = 'left') => {
      ctx.font = '800 14px Nunito, Segoe UI, sans-serif';
      const w = ctx.measureText(txt).width + 18, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.roundRect(x0, y - 13, w, 24, 12); ctx.fill();
      ctx.fillStyle = col; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(txt, x0 + 9, y - 1);
    };
    pill(t('LEWA BURTA (bakburta)'), W / 2, 22, '#c0392b', 'center');
    pill(t('PRAWA BURTA (sterburta)'), W / 2, H - 18, '#1f8a4c', 'center');
    pill(t('DZIÓB →'), W - 14, 22, '#2f4468', 'right');
    pill(t('RUFA'), 14, 22, '#2f4468');
    // kadłub i wyposażenie
    drawHullPlan(ctx, spec, cx, cy, scale);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
    const px = 1 / scale;
    // stery strumieniowe (tunele)
    const tunnel = (x) => { const hb = halfBeamAt(spec, x) * 0.8; ctx.fillStyle = 'rgba(242,183,74,0.85)'; ctx.beginPath(); ctx.roundRect(x - 0.16, -hb, 0.32, hb * 2, 0.12); ctx.fill(); };
    if (equip.bowThruster && equip.bowThruster !== 'none') tunnel(xb - 0.1 * spec.loa);
    if (equip.sternThruster) tunnel(xs + 0.08 * spec.loa);
    const sel = selected && selected.id;
    for (const f of equip.fenders) drawFenderPretty(ctx, spec, f, equip.fenderRadius, f.id === sel, px);
    for (const it of equip.deck) drawDeckItemPretty(ctx, it, it.id === sel, px);
    ctx.restore();
    // podpisy elementów
    ctx.font = '700 12px Nunito, Segoe UI, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    // podpis tylko przy elemencie zaznaczonym i wskazanym myszą (pełna lista jest obok)
    for (const it of equip.deck) {
      if (it.id !== sel && it !== hover) continue;
      const x = cx + it.x * scale, y = cy + it.y * scale + (it.y < 0 ? 26 : -26);
      const txt = t(it.label);
      const w = ctx.measureText(txt).width + 12;
      ctx.fillStyle = it.id === sel ? '#d2695f' : 'rgba(47,68,104,0.82)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 9, w, 18, 9); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(txt, x, y + 0.5);
    }
    // skala
    ctx.strokeStyle = '#2f4468'; ctx.lineWidth = 2; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(20, H - 44); ctx.lineTo(20 + scale, H - 44); ctx.moveTo(20, H - 49); ctx.lineTo(20, H - 39); ctx.moveTo(20 + scale, H - 49); ctx.lineTo(20 + scale, H - 39); ctx.stroke();
    ctx.fillStyle = '#2f4468'; ctx.font = '700 12px Nunito, Segoe UI, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('1 m', 20 + scale + 6, H - 44);
    // lista
    list.innerHTML = '';
    const items = [...equip.deck].sort((a, b) => b.x - a.x);
    for (const it of items) {
      list.appendChild(h('div', { class: selected === it ? 'sel' : '', onclick: () => { selected = it; render(); } }, h('span', {}, it.label), h('span.muted', {}, `x ${it.x.toFixed(1)} m`)));
    }
    const nF = equip.fenders.length;
    const nB = equip.fenders.filter((f) => f.ball).length;
    if (nB) list.appendChild(h('div', {}, h('span', {}, `Kule odbijacza: ${nB}`), h('span.muted', {}, `rufa ${equip.fenders.filter((f) => f.ball && f.stern).length}`)));
    list.appendChild(h('div', {}, h('span', {}, `Odbijacze: ${nF - nB}`), h('span.muted', {}, `L ${equip.fenders.filter((f) => !f.ball && f.side < 0).length} / P ${equip.fenders.filter((f) => !f.ball && f.side > 0).length}`)));
  }
  render();
  return { canvas, toolbar, list, render };
}
