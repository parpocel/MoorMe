// Rysunki 2D: widok jachtu z góry, mapa portu
import { hullExtents, hullOutline, halfBeamAt, fenderGeom } from '../data/boats.js';
import { t } from '../i18n.js';
import { distToPoly, rng } from '../math.js';

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

// Karta wyboru jachtu: rzut z góry w stylu planu technicznego (siatka, cień, detale pokładu, wymiary)
// Ładny rzut kadłuba z góry (karta wyboru jachtu, edytor pokładu): cień, cieniowanie, tek w kokpicie, nadbudówka, maszt
export function drawHullPlan(ctx, spec, cx, cy, scale) {
  const { xs, xb } = hullExtents(spec);
  const L = spec.loa, B = spec.beam;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(scale, scale); // dziób w prawo, lewa burta (y < 0) u góry
  const px = 1 / scale;
  const out = hullOutline(spec, 40);
  const path = () => { ctx.beginPath(); out.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  // cień
  ctx.save(); ctx.shadowColor = 'rgba(47,68,104,0.28)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
  path(); ctx.fillStyle = '#e9eef2'; ctx.fill(); ctx.restore();
  // kadłub z cieniowaniem w poprzek
  const hg = ctx.createLinearGradient(0, -B / 2, 0, B / 2);
  hg.addColorStop(0, '#e3e2e6'); hg.addColorStop(0.5, '#ffffff'); hg.addColorStop(1, '#e3e2e6');
  path(); ctx.fillStyle = hg; ctx.fill();
  ctx.save(); path(); ctx.clip();
  // relingi / listwa odbojowa
  ctx.strokeStyle = '#a8b0bf'; ctx.lineWidth = 2.2 * px; path(); ctx.stroke();
  // teak w kokpicie
  const ck0 = xs + 0.02 * L, ck1 = xs + 0.3 * L;
  const ckw = halfBeamAt(spec, (ck0 + ck1) / 2) * 1.32;
  ctx.fillStyle = '#ecebe7'; roundRect(ctx, ck0, -ckw / 2, ck1 - ck0, ckw, 0.25); ctx.fill(); // biała podłoga kokpitu
  ctx.strokeStyle = 'rgba(47,68,104,0.18)'; ctx.lineWidth = 1 * px; roundRect(ctx, ck0, -ckw / 2, ck1 - ck0, ckw, 0.25); ctx.stroke();
  // ławki kokpitu (tekowe gretingi)
  ctx.fillStyle = '#c99566';
  for (const s of [-1, 1]) roundRect(ctx, ck0 + 0.9, s > 0 ? ckw / 2 - 0.42 : -ckw / 2, ck1 - ck0 - 1.1, 0.42, 0.1), ctx.fill();
  // koła sterowe
  ctx.strokeStyle = '#2f4468'; ctx.lineWidth = 2.4 * px;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(ck0 + 0.6, s * B * 0.22, 0.09, 0.42, 0, 0, Math.PI * 2); ctx.stroke(); }
  // nadbudówka z oknami
  const x0 = xs + 0.3 * L, x1 = xb - 0.3 * L;
  const wA = halfBeamAt(spec, x0) * 0.66, wF = halfBeamAt(spec, x1) * 0.5;
  const cabin = () => { ctx.beginPath(); ctx.moveTo(x0, -wA); ctx.lineTo(x1 - 0.6, -wF); ctx.quadraticCurveTo(x1 + 0.1, -wF * 0.7, x1 + 0.1, 0); ctx.quadraticCurveTo(x1 + 0.1, wF * 0.7, x1 - 0.6, wF); ctx.lineTo(x0, wA); ctx.closePath(); };
  ctx.save(); ctx.shadowColor = 'rgba(47,68,104,0.22)'; ctx.shadowBlur = 6; cabin();
  const cg = ctx.createLinearGradient(0, -wA, 0, wA); cg.addColorStop(0, '#efeae6'); cg.addColorStop(0.5, '#ffffff'); cg.addColorStop(1, '#efeae6');
  ctx.fillStyle = cg; ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#8f9ab0'; ctx.lineWidth = 1.2 * px; cabin(); ctx.stroke();
  ctx.fillStyle = '#2f4468';
  for (const s of [-1, 1]) roundRect(ctx, x0 + 0.5, s * wA * 0.86 - 0.06, (x1 - x0) * 0.62, 0.12, 0.06), ctx.fill();
  ctx.fillStyle = 'rgba(47,68,104,0.7)'; roundRect(ctx, x0 + (x1 - x0) * 0.55, -0.28, 0.55, 0.56, 0.08); ctx.fill(); // luk
  // niekrop na dziobie
  ctx.fillStyle = 'rgba(210,200,190,0.45)';
  ctx.beginPath(); ctx.moveTo(x1 + 0.5, -halfBeamAt(spec, x1 + 0.5) * 0.7); ctx.lineTo(xb - 0.6, -0.15); ctx.lineTo(xb - 0.6, 0.15); ctx.lineTo(x1 + 0.5, halfBeamAt(spec, x1 + 0.5) * 0.7); ctx.closePath(); ctx.fill();
  ctx.restore(); // clip
  ctx.strokeStyle = '#2f4468'; ctx.lineWidth = 1.6 * px; path(); ctx.stroke();
  // bom, maszt, wanty
  const mx = 0.1 * L;
  ctx.strokeStyle = '#3a4a6d'; ctx.lineWidth = 3 * px; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(xs + 0.27 * L, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(47,68,104,0.55)'; ctx.lineWidth = 0.9 * px;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx - 0.3, s * halfBeamAt(spec, mx - 0.3) * 0.95); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(xb - 0.05, 0); ctx.stroke(); // sztag
  ctx.fillStyle = '#2f4468'; ctx.beginPath(); ctx.ellipse(mx, 0, 0.17, 0.11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

}

export function drawBoatCard(ctx, spec, W, H, scale) {
  const { xs, xb } = hullExtents(spec);
  const L = spec.loa, B = spec.beam;
  // tło – gradient i delikatna siatka metrowa
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#e4f0ef'); bg.addColorStop(1, '#cfe2e4');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const cx = W / 2 - (xs + xb) / 2 * scale, cy = H * 0.46;
  ctx.strokeStyle = 'rgba(47,68,104,0.07)'; ctx.lineWidth = 1;
  for (let x = cx % scale; x < W; x += scale) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
  for (let y = cy % scale; y < H; y += scale) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
  glow.addColorStop(0, 'rgba(255,255,255,0.55)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  drawHullPlan(ctx, spec, cx, cy, scale);

  // linie wymiarowe
  ctx.save();
  ctx.strokeStyle = 'rgba(210,105,95,0.9)'; ctx.fillStyle = '#2f4468'; ctx.lineWidth = 1;
  ctx.font = '800 38px Nunito, Segoe UI, system-ui, sans-serif'; ctx.textBaseline = 'middle';
  const sx = cx + xs * scale, bx = cx + xb * scale, yL = cy + B / 2 * scale + 34;
  const tick = (x, y, v) => { ctx.beginPath(); if (v) { ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); } else { ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); } ctx.stroke(); };
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(sx, yL - 14); ctx.lineTo(sx, cy); ctx.moveTo(bx, yL - 14); ctx.lineTo(bx, cy); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(sx, yL); ctx.lineTo(bx, yL); ctx.stroke(); tick(sx, yL); tick(bx, yL);
  const tL = `${L.toFixed(2)} m`, tw = ctx.measureText(tL).width + 16, mxp = (sx + bx) / 2;
  ctx.fillStyle = '#d4e5e6'; ctx.fillRect(mxp - tw / 2, yL - 22, tw, 44);
  ctx.fillStyle = '#2f4468'; ctx.textAlign = 'center'; ctx.fillText(tL, mxp, yL + 1);
  const xB = cx + (xs + 0.42 * L) * scale, yT = cy - B / 2 * scale, yB = cy + B / 2 * scale, xd = sx - 30;
  ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(xd, yT); ctx.lineTo(xB, yT); ctx.moveTo(xd, yB); ctx.lineTo(xB, yB); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(xd, yT); ctx.lineTo(xd, yB); ctx.stroke(); tick(xd, yT, true); tick(xd, yB, true);
  ctx.save(); ctx.translate(xd - 26, cy); ctx.rotate(-Math.PI / 2); ctx.fillText(`${B.toFixed(2)} m`, 0, 0); ctx.restore();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------- Edytor pokładu: elementy w ładniejszej grafice (współrzędne w metrach, ctx już przeskalowany) ----------
const SEL = '#d2695f';
export function drawDeckItemPretty(ctx, it, sel, px) {
  ctx.save();
  ctx.translate(it.x, it.y);
  if (sel) { ctx.fillStyle = 'rgba(210,105,95,0.22)'; ctx.beginPath(); ctx.arc(0, 0, 0.36, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = SEL; ctx.lineWidth = 2 * px; ctx.stroke(); }
  ctx.shadowColor = 'rgba(20,30,60,0.35)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1.5;
  if (it.kind === 'cleat') {
    // knaga rogowa: podstawa + pręt z rogami, aluminium
    const g = ctx.createLinearGradient(0, -0.09, 0, 0.09);
    g.addColorStop(0, '#f2f4f7'); g.addColorStop(0.5, '#a9b2bd'); g.addColorStop(1, '#6f7a87');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.11, 0.07, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-0.24, -0.035); ctx.quadraticCurveTo(-0.28, 0, -0.24, 0.035); ctx.lineTo(0.24, 0.035); ctx.quadraticCurveTo(0.28, 0, 0.24, -0.035); ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#4d5866'; ctx.lineWidth = 1.1 * px; ctx.stroke();
  } else if (it.kind === 'fairlead') {
    // kluza zamknięta: chromowany pierścień z otworem
    const g = ctx.createRadialGradient(-0.04, -0.04, 0.02, 0, 0, 0.17);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#b7c2ce'); g.addColorStop(1, '#6b7886');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#2f4468'; ctx.beginPath(); ctx.ellipse(0, 0, 0.085, 0.06, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4d5866'; ctx.lineWidth = 1 * px; ctx.beginPath(); ctx.arc(0, 0, 0.16, 0, Math.PI * 2); ctx.stroke();
  } else {
    // półkluza: otwarta „podkowa” – otwarcie do środka pokładu
    const dir = it.y > 0 ? -1 : 1;
    ctx.rotate(dir > 0 ? 0 : Math.PI);
    const g = ctx.createLinearGradient(0, -0.16, 0, 0.16);
    g.addColorStop(0, '#f2f4f7'); g.addColorStop(1, '#7a8693');
    ctx.strokeStyle = g; ctx.lineWidth = 0.075; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 0.12, Math.PI * 1.05, Math.PI * 1.95, false); ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#4d5866'; ctx.lineWidth = 1 * px; ctx.beginPath(); ctx.arc(0, 0, 0.16, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  }
  ctx.restore();
}

export function drawFenderPretty(ctx, spec, f, rf, sel, px) {
  const p = fenderLocal(spec, f, rf);
  ctx.save();
  ctx.translate(p.x, p.y);
  if (sel) { ctx.fillStyle = 'rgba(210,105,95,0.22)'; ctx.beginPath(); ctx.arc(0, 0, (p.ball ? p.r : rf * 2.2) + 0.12, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = SEL; ctx.lineWidth = 2 * px; ctx.stroke(); }
  ctx.shadowColor = 'rgba(20,30,60,0.35)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
  if (p.ball) {
    const g = ctx.createRadialGradient(-p.r * 0.35, -p.r * 0.35, p.r * 0.1, 0, 0, p.r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#eceeef'); g.addColorStop(1, '#a9b2bb');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#1d3557'; ctx.lineWidth = 1.2 * px; ctx.beginPath(); ctx.arc(0, -p.r * 0.85, p.r * 0.14, 0, Math.PI * 2); ctx.stroke();
  } else {
    const ang = p.stern ? Math.PI / 2 : Math.atan2(p.n.y, p.n.x) + Math.PI / 2;
    ctx.rotate(ang);
    const Lh = rf * 2.1, R = rf;
    const g = ctx.createLinearGradient(0, -R, 0, R);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#e8ecf0'); g.addColorStop(1, '#a9b4bf');
    ctx.fillStyle = g; roundRect(ctx, -Lh, -R, Lh * 2, R * 2, R * 0.9); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#1d3557';
    roundRect(ctx, -Lh, -R * 0.7, R * 0.45, R * 1.4, R * 0.3); ctx.fill();
    roundRect(ctx, Lh - R * 0.45, -R * 0.7, R * 0.45, R * 1.4, R * 0.3); ctx.fill();
    ctx.strokeStyle = 'rgba(29,53,87,0.6)'; ctx.lineWidth = 1 * px; roundRect(ctx, -Lh, -R, Lh * 2, R * 2, R * 0.9); ctx.stroke();
  }
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
  const g = fenderGeom(spec, f, rf);
  return { x: g.x, y: g.y, stern: g.stern, ball: g.ball, r: g.r, n: g.n };
}

export function drawFender(ctx, spec, f, rf, sel) {
  const p = fenderLocal(spec, f, rf);
  ctx.save();
  ctx.strokeStyle = '#1d3557';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  if (p.ball) {
    ctx.fillStyle = sel ? '#ffd166' : '#f4f4f1';
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  } else {
    ctx.fillStyle = sel ? '#ffd166' : '#f5f5f5';
    const ang = p.stern ? Math.PI / 2 : Math.atan2(p.n.y, p.n.x) + Math.PI / 2;
    ctx.ellipse(p.x, p.y, rf * 2.2, rf, ang, 0, Math.PI * 2);
  }
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

// Tło mapy (woda z cieniowaniem głębokości, nabrzeża, pomosty, ląd z drzewami i domami) – liczone raz i zapamiętane
const mapCache = new WeakMap();
const lerpHex = (a, b, t) => {
  const pa = [a >> 16, (a >> 8) & 255, a & 255], pb = [b >> 16, (b >> 8) & 255, b & 255];
  return pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
};
function harborBackground(H, T, w, h) {
  const [ox, oz] = T.toPx(0, 0);
  const key = `${w}x${h}|${T.s.toFixed(5)}|${ox.toFixed(1)},${oz.toFixed(1)}`;
  const hit = mapCache.get(H);
  if (hit && hit.key === key) return hit.cv;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const solids = H.structures.filter((q) => q.poly && q.kind !== 'boom' && q.kind !== 'pile').map((q) => {
    const xs = q.poly.map((p) => p[0]), zs = q.poly.map((p) => p[1]);
    return { poly: q.poly, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  });
  // woda: jednolita, w kolorze wody z widoku 3D (bez rozjaśnienia przy kejach)
  const R = 45;
  const distAt = (x, z) => {
    let d = R;
    for (const q of solids) {
      if (x < q.minX - d || x > q.maxX + d || z < q.minZ - d || z > q.maxZ + d) continue;
      d = Math.min(d, Math.max(0, distToPoly(q.poly, x, z).dist));
    }
    return d;
  };
  { const wg = g.createLinearGradient(0, 0, 0, h); wg.addColorStop(0, '#225a80'); wg.addColorStop(1, '#1d5178'); g.fillStyle = wg; g.fillRect(0, 0, w, h); }
  // zmarszczki na wodzie
  const r = rng(11);
  g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 1;
  for (let n = 0; n < (w * h) / 2600; n++) {
    const px = r() * w, py = r() * h, [x, z] = T.toWorld(px, py);
    if (distAt(x, z) < 6) continue;
    const L = 4 + r() * 7;
    g.beginPath(); g.moveTo(px - L, py); g.quadraticCurveTo(px, py - 2.5, px + L, py); g.stroke();
  }
  const path = (poly, dx = 0, dy = 0) => { g.beginPath(); poly.forEach(([x, z], i) => { const [a, b] = T.toPx(x, z); i ? g.lineTo(a + dx, b + dy) : g.moveTo(a + dx, b + dy); }); g.closePath(); };
  // kolory i faktury takie jak materiały modelu 3D (harborModel: surf())
  const fillOf = (q) => {
    const st = q.style || q.kind;
    if (st === 'wood' || q.kind === 'pier') return '#a8805a';
    if (st === 'stone') return '#b4ac97';
    if (q.kind === 'pontoon') return '#aaa89f';
    if (st === 'rock') return '#a9a293';
    if (st === 'sand') return '#d9c99a';
    if (st === 'port') return '#9a9a94';
    if (q.kind === 'land') return '#6f9a4c';
    if (q.kind === 'boom') return '#c9d0d6';
    if (q.kind === 'pile') return '#5a4632';
    return '#b0afa8'; // beton
  };
  // cienie nabrzeży i pomostów na wodzie
  g.fillStyle = 'rgba(8,30,50,0.28)';
  for (const q of H.structures) if (q.poly && q.kind !== 'land') { path(q.poly, 2, 3); g.fill(); }
  const sc = T.s;
  for (const q of H.structures) {
    if (!q.poly) continue;
    path(q.poly); g.fillStyle = fillOf(q); g.fill();
    g.save(); path(q.poly); g.clip();
    const xs = q.poly.map((p) => T.toPx(p[0], p[1])), minX = Math.min(...xs.map((p) => p[0])), maxX = Math.max(...xs.map((p) => p[0])), minY = Math.min(...xs.map((p) => p[1])), maxY = Math.max(...xs.map((p) => p[1]));
    const wood = q.kind === 'pier' || q.style === 'wood';
    if (wood) {
      // deski w poprzek dłuższego boku
      const horiz = maxX - minX > maxY - minY, gap = Math.max(2.5, 0.7 * sc);
      g.strokeStyle = 'rgba(60,35,15,0.35)'; g.lineWidth = 1;
      g.beginPath();
      if (horiz) for (let x = minX; x < maxX; x += gap) { g.moveTo(x, minY); g.lineTo(x, maxY); }
      else for (let y = minY; y < maxY; y += gap) { g.moveTo(minX, y); g.lineTo(maxX, y); }
      g.stroke();
    } else if (q.kind === 'quay' || q.kind === 'breakwater' || q.kind === 'pontoon' || q.style === 'stone' || q.style === 'concrete') {
      // płyty nabrzeża / kamienie falochronu
      if (q.kind === 'breakwater' || q.style === 'rock') {
        const rr = rng(Math.round(minX * 7 + minY * 13));
        for (let n = 0; n < ((maxX - minX) * (maxY - minY)) / 30; n++) {
          g.fillStyle = rr() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
          g.beginPath(); g.arc(minX + rr() * (maxX - minX), minY + rr() * (maxY - minY), 1 + rr() * Math.max(1.5, 0.6 * sc), 0, Math.PI * 2); g.fill();
        }
      } else {
        const tile = Math.max(5, 4 * sc); // płyty jak na teksturze betonu (co ok. 4 m)
        g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1; g.beginPath();
        for (let x = minX - ((minX % tile) + tile) % tile; x < maxX; x += tile) { g.moveTo(x, minY); g.lineTo(x, maxY); }
        for (let y = minY - ((minY % tile) + tile) % tile; y < maxY; y += tile) { g.moveTo(minX, y); g.lineTo(maxX, y); }
        g.stroke();
      }
    } else if (q.kind === 'land') {
      // ląd: skały z sosnami, wydmy z kępami traw, teren portowy z magazynami, zieleń z drzewami i domami
      const rr = rng(Math.round(minX * 3 + minY * 5) + 1);
      const area = ((maxX - minX) * (maxY - minY)) / (sc * sc);
      const st = q.style || 'grass';
      const roof = st === 'port' ? ['#7d8a96', '#5f6e7c', '#9aa5ae', '#b85a3c'] : H.style === 'med' ? ['#c4643f', '#b5563a', '#d07a4c'] : ['#9c3b28', '#3d3d44', '#a6432d'];
      if (st === 'rock' || st === 'sand') {
        for (let n = 0; n < Math.min(500, area / 18); n++) {
          g.fillStyle = st === 'rock' ? (rr() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)') : 'rgba(150,120,60,0.18)';
          g.beginPath(); g.arc(minX + rr() * (maxX - minX), minY + rr() * (maxY - minY), 0.8 + rr() * Math.max(1.5, 0.8 * sc), 0, Math.PI * 2); g.fill();
        }
      }
      if (st === 'port') {
        // drogi
        g.strokeStyle = 'rgba(60,62,66,0.35)'; g.lineWidth = Math.max(3, 4 * sc);
        g.beginPath(); g.moveTo(minX, (minY + maxY) / 2); g.lineTo(maxX, (minY + maxY) / 2); g.moveTo((minX + maxX) / 2, minY); g.lineTo((minX + maxX) / 2, maxY); g.stroke();
      }
      const density = st === 'port' ? 70 : st === 'sand' ? 60 : st === 'rock' ? 45 : 35;
      for (let n = 0; n < Math.min(400, area / density); n++) {
        const px = minX + rr() * (maxX - minX), py = minY + rr() * (maxY - minY), [x, z] = T.toWorld(px, py);
        const inside = -distToPoly(q.poly, x, z).dist;
        if (inside < (st === 'sand' ? 18 : 4)) continue;
        if (inside > 14 && rr() < (st === 'port' ? 0.75 : st === 'rock' ? 0.1 : 0.18)) {
          const big = st === 'port' ? 2.6 : 1, hw = (3 + rr() * 2.5) * sc * big, hd = (2.5 + rr() * 2) * sc * big;
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px - hw / 2 + 2, py - hd / 2 + 2, hw, hd);
          g.fillStyle = roof[Math.floor(rr() * roof.length)]; g.fillRect(px - hw / 2, py - hd / 2, hw, hd);
          g.strokeStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(px - hw / 2, py); g.lineTo(px + hw / 2, py); g.stroke();
        } else {
          const tr = (1.3 + rr() * 1.2) * sc;
          g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.arc(px + tr * 0.35, py + tr * 0.35, tr, 0, Math.PI * 2); g.fill();
          g.fillStyle = st === 'rock' ? (rr() < 0.5 ? '#4f6b36' : '#5d7a3c') : rr() < 0.5 ? '#3f7a3a' : '#4f8a42'; g.beginPath(); g.arc(px, py, tr, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.arc(px - tr * 0.3, py - tr * 0.3, tr * 0.45, 0, Math.PI * 2); g.fill();
        }
      }
    }
    g.restore();
    path(q.poly); g.strokeStyle = 'rgba(30,40,45,0.45)'; g.lineWidth = 1; g.stroke();
  }
  mapCache.set(H, { key, cv });
  return cv;
}

export function drawHarborMap(ctx, H, T, opts = {}) {
  const c = ctx.canvas;
  ctx.drawImage(harborBackground(H, T, c.width, c.height), 0, 0);
  // sąsiedzi – z cieniem na wodzie
  for (const n of H.neighbors) {
    const [px, pz] = T.toPx(n.x, n.z);
    ctx.save(); ctx.globalAlpha = 0.25; drawBoatTop(ctx, n.spec, px + 2, pz + 3, T.s, n.th, { simple: true, hull: '#06192a', stroke: 'rgba(0,0,0,0)' }); ctx.restore();
    drawBoatTop(ctx, n.spec, px, pz, T.s, n.th, { simple: true, hull: '#' + n.color.toString(16).padStart(6, '0'), stroke: '#23384b' });
  }
  // polery
  if (opts.bollards !== false) {
    for (const b of H.bollards) {
      const [px, pz] = T.toPx(b.x, b.z);
      ctx.fillStyle = '#16191c'; ctx.beginPath(); ctx.arc(px, pz, 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
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
    ctx.fillText(t('TU'), px, pz + 4);
    ctx.restore();
  }
  // muringi: linka od kei do kotwicy, pława przy kei
  for (const m of H.murings) {
    const [ax, az] = T.toPx(m.anchor.x, m.anchor.z);
    const [qx, qz] = T.toPx(m.pickup.x, m.pickup.z);
    ctx.strokeStyle = m.own ? 'rgba(255,209,102,0.95)' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = m.own ? 1.6 : 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(qx, qz); ctx.lineTo(ax, az); ctx.stroke();
    ctx.setLineDash([]);
    if (m.own) { ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(ax, az, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
  // róża kierunków i podziałka
  if (c.width >= 300 && opts.decor !== false) {
    ctx.save();
    const rx = c.width - 30, ry = 30;
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(rx, ry, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d62828'; ctx.beginPath(); ctx.moveTo(rx, ry - 14); ctx.lineTo(rx + 5, ry + 2); ctx.lineTo(rx - 5, ry + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#23384b'; ctx.beginPath(); ctx.moveTo(rx, ry + 14); ctx.lineTo(rx + 5, ry + 2); ctx.lineTo(rx - 5, ry + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b1f24'; ctx.font = 'bold 10.5px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('N', rx, ry - 17 + 0);
    const opt = [5, 10, 20, 50, 100, 200];
    let len = opt[0];
    for (const v of opt) if (v * T.s <= c.width * 0.22) len = v;
    const sx = c.width - len * T.s - 52, sy = c.height - 14; // w prawym dolnym rogu (lewy zajmuje podpis)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(sx - 6, sy - 16, len * T.s + 46, 22);
    ctx.strokeStyle = '#1b1f24'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + len * T.s, sy - 4); ctx.moveTo(sx, sy - 8); ctx.lineTo(sx, sy); ctx.moveTo(sx + len * T.s, sy - 8); ctx.lineTo(sx + len * T.s, sy); ctx.stroke();
    ctx.fillStyle = '#1b1f24'; ctx.font = '11px Segoe UI'; ctx.textAlign = 'left'; ctx.fillText(`${len} m`, sx + len * T.s + 6, sy - 1);
    ctx.restore();
  }
}

// chorągiewka wiatrowa: maszt (kropka) i trójkątny proporzec powiewający z wiatrem; ang – kierunek, DOKĄD wieje
export function drawWindFlag(ctx, x, y, ang, kn, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  const len = (22 + Math.min(18, kn * 0.9)) * s, wv = Math.min(1, kn / 12);
  ctx.rotate(ang);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.moveTo(2, 3); ctx.quadraticCurveTo(len * 0.5 + 2, 3 - 3 * wv, len + 2, 3 + 2); ctx.lineTo(2, 3 + 9 * s); ctx.closePath(); ctx.fill();
  const gr = ctx.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, '#e63946'); gr.addColorStop(1, '#ff7b6b');
  ctx.fillStyle = gr; ctx.strokeStyle = '#7a1c22'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -5 * s); ctx.quadraticCurveTo(len * 0.5, -5 * s - 4 * wv * s, len, 0); ctx.quadraticCurveTo(len * 0.5, 5 * s + 2 * wv * s, 0, 5 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(len * 0.32, -4 * s, 2.5 * s, 8 * s);
  ctx.restore();
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1b2a3a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, 3.2 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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
