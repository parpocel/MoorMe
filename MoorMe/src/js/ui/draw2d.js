// Rysunki 2D: widok jachtu z góry, mapa portu
import { hullExtents, hullOutline, halfBeamAt } from '../data/boats.js';

export function drawBoatTop(ctx, spec, cx, cy, scale, rot = 0, opts = {}) {
  const { xs, xb } = hullExtents(spec);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  const out = hullOutline(spec, 24);
  // kadłub
  ctx.beginPath();
  out.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = opts.hull || '#eef2f5';
  ctx.fill();
  ctx.lineWidth = 0.06;
  ctx.strokeStyle = opts.stroke || '#6a7f93';
  ctx.stroke();
  if (opts.simple) { ctx.restore(); return; }
  // pokład – teak w kokpicie
  const L = spec.loa;
  const ck0 = xs + 0.03 * L, ck1 = xs + 0.3 * L - 0.05;
  const ckw = halfBeamAt(spec, (ck0 + ck1) / 2) * 1.35;
  ctx.fillStyle = '#b68a5c';
  ctx.fillRect(ck0, -ckw / 2, ck1 - ck0, ckw);
  // nadbudówka
  const x0 = xs + 0.3 * L, x1 = xb - 0.3 * L;
  const wA = halfBeamAt(spec, x0) * 0.66, wF = halfBeamAt(spec, x1) * 0.5;
  ctx.beginPath();
  ctx.moveTo(x0, -wA); ctx.lineTo(x1 - 0.4, -wF); ctx.lineTo(x1, -wF * 0.6); ctx.lineTo(x1, wF * 0.6); ctx.lineTo(x1 - 0.4, wF); ctx.lineTo(x0, wA); ctx.closePath();
  ctx.fillStyle = '#dfe4e8';
  ctx.fill();
  ctx.strokeStyle = '#8fa1b1';
  ctx.stroke();
  // maszt
  ctx.fillStyle = '#56606a';
  ctx.beginPath(); ctx.arc(0.1 * L, 0, 0.14, 0, Math.PI * 2); ctx.fill();
  // koła sterowe
  ctx.strokeStyle = '#6d7780';
  ctx.lineWidth = 0.08;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(ck0 + 0.55, s * spec.beam * 0.27 - 0.45); ctx.lineTo(ck0 + 0.55, s * spec.beam * 0.27 + 0.45); ctx.stroke(); }
  // ster strumieniowy
  if (opts.bowThruster && opts.bowThruster !== 'none') {
    ctx.fillStyle = 'rgba(255,209,102,0.9)';
    ctx.fillRect(xb - 0.1 * L - 0.15, -halfBeamAt(spec, xb - 0.1 * L) * 0.8, 0.3, halfBeamAt(spec, xb - 0.1 * L) * 1.6);
  }
  if (opts.sternThruster) {
    ctx.fillStyle = 'rgba(255,209,102,0.9)';
    const x = xs + 0.08 * L;
    ctx.fillRect(x - 0.15, -halfBeamAt(spec, x) * 0.8, 0.3, halfBeamAt(spec, x) * 1.6);
  }
  // wyposażenie
  if (opts.deck) for (const it of opts.deck) drawDeckItem(ctx, it, it.id === opts.selected);
  if (opts.fenders) for (const f of opts.fenders) drawFender(ctx, spec, f, opts.fenderRadius || 0.12, f.id === opts.selected);
  ctx.restore();
}

export function drawDeckItem(ctx, it, sel) {
  ctx.save();
  ctx.translate(it.x, it.y);
  if (it.kind === 'cleat') {
    ctx.fillStyle = sel ? '#ffd166' : '#2d3a46';
    ctx.fillRect(-0.2, -0.06, 0.4, 0.12);
    ctx.fillRect(-0.06, -0.1, 0.12, 0.2);
  } else {
    ctx.strokeStyle = sel ? '#ffd166' : it.kind === 'fairlead' ? '#1f6fa8' : '#b0561f';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    if (it.kind === 'fairlead') ctx.arc(0, 0, 0.14, 0, Math.PI * 2);
    else ctx.arc(0, 0, 0.14, it.y > 0 ? 0 : Math.PI, it.y > 0 ? Math.PI : 0);
    ctx.stroke();
  }
  ctx.restore();
}

export function fenderLocal(spec, f, rf) {
  const { xs } = hullExtents(spec);
  if (f.stern) return { x: xs - rf, y: f.side * spec.beam * 0.28, stern: true };
  return { x: f.x, y: f.side * (halfBeamAt(spec, f.x) + rf) };
}

export function drawFender(ctx, spec, f, rf, sel) {
  const p = fenderLocal(spec, f, rf);
  ctx.save();
  ctx.fillStyle = sel ? '#ffd166' : '#f5f5f5';
  ctx.strokeStyle = '#1d3557';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  if (p.stern) ctx.ellipse(p.x, p.y, rf, rf * 2.2, 0, 0, Math.PI * 2);
  else ctx.ellipse(p.x, p.y, rf * 2.2, rf, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---------- Mapa portu ----------
export function mapTransform(canvas, bounds, pad = 10) {
  const w = canvas.width, h = canvas.height;
  const sx = (w - 2 * pad) / (bounds.maxX - bounds.minX);
  const sz = (h - 2 * pad) / (bounds.maxZ - bounds.minZ);
  const s = Math.min(sx, sz);
  const ox = pad + ((w - 2 * pad) - s * (bounds.maxX - bounds.minX)) / 2 - bounds.minX * s;
  const oz = pad + ((h - 2 * pad) - s * (bounds.maxZ - bounds.minZ)) / 2 - bounds.minZ * s;
  return { s, toPx: (x, z) => [ox + x * s, oz + z * s], toWorld: (px, py) => [(px - ox) / s, (py - oz) / s] };
}

export function drawHarborMap(ctx, H, T, opts = {}) {
  const c = ctx.canvas;
  ctx.fillStyle = '#1e6f8f';
  ctx.fillRect(0, 0, c.width, c.height);
  const poly = (p, fill, stroke) => {
    ctx.beginPath();
    p.forEach(([x, z], i) => { const [a, b] = T.toPx(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  };
  const colors = { quay: '#a3a29b', pontoon: '#d4d2cc', pier: '#a07a52', land: '#6f9a4c', breakwater: '#8b8a84', boom: '#c9d0d6', pile: '#5a4632', shallow: '#b8a878' };
  const styles = { stone: '#d8cdb5', wood: '#a07a52', rock: '#a9a293', sand: '#d9c99a', port: '#9a9a94', concrete: '#a3a29b' };
  for (const s of H.structures) poly(s.poly, (s.kind !== 'land' || s.style) && styles[s.style] && s.kind !== 'pier' ? styles[s.style] : colors[s.kind] || '#999');
  // sąsiedzi
  for (const n of H.neighbors) {
    const [px, pz] = T.toPx(n.x, n.z);
    drawBoatTop(ctx, n.spec, px, pz, T.s, n.th, { simple: true, hull: '#' + n.color.toString(16).padStart(6, '0'), stroke: '#23384b' });
  }
  // polery
  if (opts.bollards !== false) {
    ctx.fillStyle = '#1a1a1a';
    for (const b of H.bollards) { const [px, pz] = T.toPx(b.x, b.z); ctx.fillRect(px - 1.5, pz - 1.5, 3, 3); }
  }
  // stanowisko
  const b = H.berth;
  if (b && opts.spec) {
    const [px, pz] = T.toPx(b.x, b.z);
    // wyraźny znacznik: przerywany obrys + podpis
    ctx.save();
    ctx.setLineDash([6, 4]);
    drawBoatTop(ctx, opts.spec, px, pz, T.s, b.th, { simple: true, hull: 'rgba(61,220,132,0.28)', stroke: '#3ddc84' });
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#3ddc84';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    const r = (opts.spec.loa / 2 + 0.6) * T.s;
    ctx.beginPath();
    ctx.ellipse(px, pz, Math.abs(Math.cos(b.th)) * r + Math.abs(Math.sin(b.th)) * (opts.spec.beam / 2 + 0.4) * T.s,
      Math.abs(Math.sin(b.th)) * r + Math.abs(Math.cos(b.th)) * (opts.spec.beam / 2 + 0.4) * T.s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#3ddc84';
    ctx.font = 'bold 13px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('TU', px, pz + 4);
    ctx.restore();
  }
  // muringi
  for (const m of H.murings) {
    const [ax, az] = T.toPx(m.anchor.x, m.anchor.z);
    const [qx, qz] = T.toPx(m.pickup.x, m.pickup.z);
    ctx.strokeStyle = m.own ? 'rgba(255,209,102,0.9)' : 'rgba(255,255,255,0.18)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(qx, qz); ctx.lineTo(ax, az); ctx.stroke();
    ctx.setLineDash([]);
  }
}

export function drawArrow(ctx, x, y, ang, len, color, width = 3) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2 - 6, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(len / 2, 0); ctx.lineTo(len / 2 - 10, -6); ctx.lineTo(len / 2 - 10, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}
