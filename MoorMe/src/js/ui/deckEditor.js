// Edytor rozmieszczenia knag, kluz, półkluz i odbijaczy (widok z góry)
import { h } from './dom.js';
import { drawBoatTop, fenderLocal } from './draw2d.js';
import { hullExtents, halfBeamAt, ITEM_KIND_LABEL } from '../data/boats.js';

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
    } else if (tool === 'fender') {
      const side = p.y < 0 ? -1 : 1;
      if (p.x < xs + 0.5) equip.fenders.push({ id: 'f' + nextId++, x: xs, side, stern: true });
      else equip.fenders.push({ id: 'f' + nextId++, x: +Math.max(xs + 0.4, Math.min(xb - 1.2, p.x)).toFixed(2), side });
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
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    const p = toLocal((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height));
    if (drag.type === 'deck') {
      drag.it.x = p.x; drag.it.y = p.y;
      clampItem(drag.it);
    } else {
      const f = drag.it;
      f.side = p.y < 0 ? -1 : 1;
      if (!f.stern) f.x = +Math.max(xs + 0.4, Math.min(xb - 1.2, p.x)).toFixed(2);
    }
    render();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag) { relabel(spec, equip.deck); drag = null; render(); if (onChange) onChange(); }
  });

  function render() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    // siatka
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = '#ff8080'; ctx.font = 'bold 15px Segoe UI';
    ctx.fillText('LEWA BURTA (bakburta)', cx + xs * scale, 22);
    ctx.fillStyle = '#80ffb0';
    ctx.fillText('PRAWA BURTA (sterburta)', cx + xs * scale, H - 12);
    ctx.fillStyle = '#9fb8cc';
    ctx.fillText('DZIÓB →', cx + xb * scale - 20, cy - (spec.beam / 2) * scale - 14);
    ctx.fillText('RUFA', cx + xs * scale - 50, cy + 5);
    drawBoatTop(ctx, spec, cx, cy, scale, 0, { deck: equip.deck, fenders: equip.fenders, fenderRadius: equip.fenderRadius, selected: selected && selected.id, bowThruster: equip.bowThruster, sternThruster: equip.sternThruster });
    // podpisy
    ctx.font = '11px Segoe UI';
    ctx.fillStyle = '#d7e6f2';
    for (const it of equip.deck) {
      const px = cx + it.x * scale, py = cy + it.y * scale;
      ctx.fillText(it.label.split(' ')[0].slice(0, 5), px - 12, py + (it.y < 0 ? -12 : 20));
    }
    // skala
    ctx.strokeStyle = '#9fb8cc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, H - 30); ctx.lineTo(20 + scale, H - 30); ctx.stroke();
    ctx.fillStyle = '#9fb8cc'; ctx.fillText('1 m', 20, H - 36);
    // lista
    list.innerHTML = '';
    const items = [...equip.deck].sort((a, b) => b.x - a.x);
    for (const it of items) {
      list.appendChild(h('div', { class: selected === it ? 'sel' : '', onclick: () => { selected = it; render(); } }, h('span', {}, it.label), h('span.muted', {}, `x ${it.x.toFixed(1)} m`)));
    }
    const nF = equip.fenders.length;
    list.appendChild(h('div', {}, h('span', {}, `Odbijacze: ${nF}`), h('span.muted', {}, `L ${equip.fenders.filter((f) => f.side < 0).length} / P ${equip.fenders.filter((f) => f.side > 0).length}`)));
  }
  render();
  return { canvas, toolbar, list, render };
}
