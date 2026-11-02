// Chartploter: mapa 2D akwenu z trasą, znakami IALA, mieliznami i pozycją jachtu.
import { DEG } from '../math.js';
import { lateralColors } from '../data/passage.js';
import { t } from '../i18n.js';

const STATE_COLOR = { ok: '#2faa5c', wrong: '#e03a3a', violated: '#e03a3a', missed: '#e0a13a' };

// Symbol znaku jak na mapie morskiej (INT 1): okrąg pozycji, pochylona sylwetka pławy w kolorach znaku,
// znak szczytowy i fioletowa flara światła. Pozycja znaku w (0, 0), r – skala symbolu.
export function drawMarkSymbol(ctx, type, r) {
  const lc = lateralColors(), hx = (c) => '#' + c.toString(16).padStart(6, '0');
  const P = hx(lc.port), S = hx(lc.stbd), Y = '#f2c230', B = '#15181c', R = '#d62828', W = '#ffffff', BU = '#1d4e9a';
  const k = r / 4.2; // jednostka rysunku
  ctx.save();
  ctx.lineJoin = 'round';
  // flara światła (fioletowa łza od pozycji, w prawo do góry)
  ctx.save();
  ctx.rotate(0.75);
  ctx.fillStyle = 'rgba(200,40,170,0.75)';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(3.2 * k, -6 * k, 0, -11 * k); ctx.quadraticCurveTo(-3.2 * k, -6 * k, 0, 0); ctx.fill();
  ctx.restore();
  ctx.rotate(-0.33); // sylwetka pławy pochylona jak na mapie
  ctx.strokeStyle = '#1b1f24'; ctx.lineWidth = Math.max(0.8, k * 0.9);
  // wypełnienie konturu pasami poziomymi (od dołu) albo pionowymi
  const fillBands = (path, cols, vertical, x0, x1, y0, y1) => {
    ctx.save(); path(); ctx.clip();
    cols.forEach((c, i) => {
      ctx.fillStyle = c;
      if (vertical) { const w = (x1 - x0) / cols.length; ctx.fillRect(x0 + i * w, y1, w + 0.3, y0 - y1); }
      else { const h = (y0 - y1) / cols.length; ctx.fillRect(x0, y0 - (i + 1) * h - 0.3, x1 - x0, h + 0.6); }
    });
    ctx.restore(); path(); ctx.stroke();
  };
  const pillar = (cols, vertical = false) => fillBands(() => { ctx.beginPath(); ctx.moveTo(-3 * k, -1.2 * k); ctx.lineTo(3 * k, -1.2 * k); ctx.lineTo(1.4 * k, -11 * k); ctx.lineTo(-1.4 * k, -11 * k); ctx.closePath(); }, cols, vertical, -3 * k, 3 * k, -1.2 * k, -11 * k);
  const can = (cols) => fillBands(() => { ctx.beginPath(); ctx.moveTo(-3.6 * k, -1.2 * k); ctx.lineTo(3.6 * k, -1.2 * k); ctx.lineTo(3 * k, -8 * k); ctx.lineTo(-3 * k, -8 * k); ctx.closePath(); }, cols, false, -3.6 * k, 3.6 * k, -1.2 * k, -8 * k);
  const conical = (cols) => fillBands(() => { ctx.beginPath(); ctx.moveTo(-3.8 * k, -1.2 * k); ctx.lineTo(3.8 * k, -1.2 * k); ctx.lineTo(0, -9.5 * k); ctx.closePath(); }, cols, false, -3.8 * k, 3.8 * k, -1.2 * k, -9.5 * k);
  const top = -12 * k; // podstawa znaku szczytowego
  const tri = (y, up, col = B) => { ctx.fillStyle = col; ctx.beginPath(); if (up) { ctx.moveTo(-1.8 * k, y); ctx.lineTo(1.8 * k, y); ctx.lineTo(0, y - 2.6 * k); } else { ctx.moveTo(-1.8 * k, y - 2.6 * k); ctx.lineTo(1.8 * k, y - 2.6 * k); ctx.lineTo(0, y); } ctx.closePath(); ctx.fill(); };
  const ball = (y, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, y - 1.4 * k, 1.4 * k, 0, Math.PI * 2); ctx.fill(); };
  const stem = (h = 1) => { ctx.beginPath(); ctx.moveTo(0, -11 * k); ctx.lineTo(0, -11 * k - h * k); ctx.stroke(); };
  switch (type) {
    case 'lateralPort': can([P]); break;
    case 'lateralStbd': conical([S]); break;
    case 'prefStbd': pillar([P, S, P]); stem(); ctx.fillStyle = P; ctx.fillRect(-1.5 * k, top - 2.6 * k, 3 * k, 2.6 * k); ctx.strokeRect(-1.5 * k, top - 2.6 * k, 3 * k, 2.6 * k); break;
    case 'prefPort': pillar([S, P, S]); stem(); tri(top, true, S); break;
    case 'cardN': pillar([Y, B]); stem(); tri(top, true); tri(top - 3 * k, true); break;
    case 'cardS': pillar([B, Y]); stem(); tri(top, false); tri(top - 3 * k, false); break;
    case 'cardE': pillar([B, Y, B]); stem(); tri(top, false); tri(top - 3 * k, true); break;
    case 'cardW': pillar([Y, B, Y]); stem(); tri(top, true); tri(top - 3 * k, false); break;
    case 'safe': pillar([R, W, R, W], true); stem(); ball(top, R); break;
    case 'isolated': pillar([B, R, B]); stem(); ball(top, B); ball(top - 3 * k, B); break;
    case 'special': pillar([Y]); stem(); ctx.strokeStyle = Y; ctx.lineWidth = Math.max(1.2, k * 1.1); ctx.beginPath(); ctx.moveTo(-1.6 * k, top); ctx.lineTo(1.6 * k, top - 3 * k); ctx.moveTo(1.6 * k, top); ctx.lineTo(-1.6 * k, top - 3 * k); ctx.stroke(); break;
    case 'wreck': pillar([BU, Y, BU, Y], true); stem(); ctx.strokeStyle = Y; ctx.lineWidth = Math.max(1.2, k * 1.1); ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(0, top - 3.2 * k); ctx.moveTo(-1.6 * k, top - 1.6 * k); ctx.lineTo(1.6 * k, top - 1.6 * k); ctx.stroke(); break;
    default: pillar([W]);
  }
  ctx.restore();
  // okrąg pozycji (bez pochylenia)
  ctx.save();
  ctx.strokeStyle = '#1b1f24'; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(0.8, k * 0.8);
  ctx.beginPath(); ctx.arc(0, 0, Math.max(1.6, 1.2 * k), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/**
 * opts: { cx, cz, scale (px/m), headUp (bool), world (PassageWorld), labels (bool) }
 */
export function drawChart(ctx, W, Hh, opts) {
  const w = opts.world, P = w.H, b = w.boat;
  const s = opts.scale;
  const phi = opts.headUp ? ((b.th / DEG + 90) % 360 + 360) % 360 * DEG : 0; // kurs kompasowy (rad)
  const cph = Math.cos(phi), sph = Math.sin(phi);
  const cx = opts.cx, cz = opts.cz;
  const X = (x, z) => W / 2 + ((x - cx) * cph + (z - cz) * sph) * s;
  const Y = (x, z) => Hh / 2 + (-(x - cx) * sph + (z - cz) * cph) * s;
  const path = (poly) => { ctx.beginPath(); poly.forEach(([x, z], i) => (i ? ctx.lineTo(X(x, z), Y(x, z)) : ctx.moveTo(X(x, z), Y(x, z)))); ctx.closePath(); };

  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, Hh); ctx.clip();
  const N = !!opts.night;
  ctx.fillStyle = N ? '#0b1a29' : '#dcedf4';
  ctx.fillRect(0, 0, W, Hh);

  const lands = P.structures.filter((q) => q.kind === 'land' || q.kind === 'breakwater');
  // „izobaty”: jaśniejsze pasy płytkiej wody wokół lądu
  ctx.lineJoin = 'round';
  for (const [wd, col] of (N ? [[420, 'rgba(24,52,76,0.55)'], [200, 'rgba(28,62,90,0.65)'], [80, 'rgba(34,74,104,0.8)']] : [[420, 'rgba(176,216,233,0.55)'], [200, 'rgba(142,200,222,0.65)'], [80, 'rgba(112,184,212,0.8)']])) {
    ctx.strokeStyle = col; ctx.lineWidth = wd * s * 2;
    for (const q of lands) { if (q.kind === 'land') { path(q.poly); ctx.stroke(); } }
  }
  // mielizny
  // na otwartym morzu mapa pokazuje tylko mielizny i znaki, które już widać z pokładu
  const seenMark = (m) => !P.offshore || m.seen;
  for (const sh of (w.blind ? [] : P.shoals)) {
    if (P.offshore && !(w.seenShoals && w.seenShoals.has(sh))) continue;
    path(sh.poly);
    ctx.fillStyle = N ? 'rgba(40,96,120,0.95)' : 'rgba(84,170,196,0.95)'; ctx.fill();
    ctx.setLineDash([4, 3]); ctx.strokeStyle = '#2b6f86'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    const mx = sh.poly.reduce((a, p) => a + p[0], 0) / sh.poly.length, mz = sh.poly.reduce((a, p) => a + p[1], 0) / sh.poly.length;
    if (s > 0.02) { ctx.fillStyle = '#17506a'; ctx.font = '10px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText(`${sh.depth.toFixed(1)}`, X(mx, mz), Y(mx, mz) + 3); }
  }
  // ląd
  for (const q of lands) {
    path(q.poly);
    ctx.fillStyle = N ? (q.kind === 'breakwater' ? '#4a4a44' : '#3d3a2c') : (q.kind === 'breakwater' ? '#c9c4b6' : '#ecdfae');
    ctx.fill();
    ctx.strokeStyle = '#7a6a3c'; ctx.lineWidth = 1.3; ctx.stroke();
  }
  // wraki
  for (const wr of (w.blind ? [] : P.wrecks)) {
    if (P.offshore && !w.marks.some((m) => m.type === 'wreck' && m.seen && Math.hypot(m.x - wr.x, m.z - wr.z) < 60)) continue;
    const x = X(wr.x, wr.z), y = Y(wr.x, wr.z);
    ctx.strokeStyle = '#17506a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x - 6, y - 4); ctx.lineTo(x + 6, y + 4); ctx.moveTo(x + 6, y - 4); ctx.lineTo(x - 6, y + 4); ctx.stroke();
  }
  // latarnie
  for (const l of P.lighthouses) {
    const x = X(l.x, l.z), y = Y(l.x, l.z);
    ctx.fillStyle = '#d62828'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a21'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
  }

  // trasa, strefy i waypointy – tylko w trybie z pełną pomocą
  const R = w.route;
  if (!w.blind) {
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = 'rgba(210,40,170,0.35)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  R.forEach((p, i) => (i ? ctx.lineTo(X(p.x, p.z), Y(p.x, p.z)) : ctx.moveTo(X(p.x, p.z), Y(p.x, p.z))));
  ctx.stroke();
  ctx.setLineDash([]);
  // pozostała część odcinka do następnego waypointu – grubiej
  const nx = w.next, nxp = R[nx];
  ctx.strokeStyle = 'rgba(210,35,170,0.55)'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(X(R[nx - 1].x, R[nx - 1].z), Y(R[nx - 1].x, R[nx - 1].z)); ctx.lineTo(X(nxp.x, nxp.z), Y(nxp.x, nxp.z)); ctx.stroke();

  // strefy zagrożeń
  for (const m of w.marks) {
    if (m.rule !== 'avoid' || !seenMark(m)) continue;
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = m.state === 'violated' ? '#e03a3a' : 'rgba(200,50,50,0.7)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(X(m.x, m.z), Y(m.x, m.z), m.radius * s, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  }
  // znaki – zawsze na mapie (jak na prawdziwej mapie nawigacyjnej); nazwy i oceny tylko z pełną pomocą
  {
  const rs = Math.max(5, Math.min(9, 150 * s + 4));
  ctx.font = '10px Segoe UI'; ctx.textAlign = 'left';
  for (const m of w.marks) {
    const x = X(m.x, m.z), y = Y(m.x, m.z);
    if (x < -20 || y < -20 || x > W + 20 || y > Hh + 20) continue;
    ctx.save();
    ctx.translate(x, y);
    drawMarkSymbol(ctx, m.type, rs);
    if (!w.blind && STATE_COLOR[m.state]) { ctx.strokeStyle = STATE_COLOR[m.state]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, rs + 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    if (opts.labels && !w.blind && s > 0.03 && !/^lateral/.test(m.type)) { // znaki boczne są czytelne z samego symbolu
      ctx.fillStyle = N ? '#a9c3d8' : '#243447';
      ctx.fillText(t(m.label), x + rs * 1.2 + 6, y + 3);
    }
  }
  }
  if (!w.blind) {
  // waypointy
  const nx = w.next;
  R.forEach((p, i) => {
    if (i === 0) return;
    const x = X(p.x, p.z), y = Y(p.x, p.z);
    ctx.globalAlpha = i === nx ? 0.8 : 0.4;
    ctx.beginPath(); ctx.arc(x, y, i === nx ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = i < nx ? 'rgba(120,120,120,0.6)' : i === nx ? '#d223aa' : 'rgba(255,255,255,0.9)';
    ctx.fill(); ctx.strokeStyle = '#d223aa'; ctx.lineWidth = 1.2; ctx.stroke();
    if (i === nx || i === R.length - 1) { ctx.fillStyle = i === nx ? '#fff' : '#a0187f'; ctx.font = 'bold 8px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText(i === R.length - 1 ? 'M' : String(i), x, y + 3); }
    ctx.globalAlpha = 1;
  });

  }

  // wektor kursu nad dnem (2 min) i jacht
  const bx = X(b.x, b.z), by = Y(b.x, b.z);
  const sp = b.speed;
  if (sp > 0.3) {
    ctx.strokeStyle = '#1b1f24'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(X(b.x + b.vx * 120, b.z + b.vz * 120), Y(b.x + b.vx * 120, b.z + b.vz * 120)); ctx.stroke();
  }
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate((b.th / DEG + 90) * DEG - phi); // kierunek dziobu względem ekranu
  const L = Math.max(14, Math.min(26, b.boatLen ? b.boatLen * s * 3 : 18));
  ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#1b1f24'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(L * 0.42, L * 0.6); ctx.lineTo(0, L * 0.3); ctx.lineTo(-L * 0.42, L * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();

  // skala i północ
  // podziałka w milach morskich
  const NMI = 1852, targets = [0.05, 0.1, 0.2, 0.5, 1, 2, 5].map((v) => v * NMI);
  let len = targets[0];
  for (const tg of targets) if (tg * s <= W * 0.28) len = tg;
  const sx0 = 12, sy0 = Hh - 12;
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(sx0 - 4, sy0 - 22, len * s + 40, 24);
  ctx.strokeStyle = '#1b1f24'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx0, sy0 - 4); ctx.lineTo(sx0 + len * s, sy0 - 4); ctx.moveTo(sx0, sy0 - 9); ctx.lineTo(sx0, sy0 - 1); ctx.moveTo(sx0 + len * s, sy0 - 9); ctx.lineTo(sx0 + len * s, sy0 - 1); ctx.stroke();
  ctx.fillStyle = '#1b1f24'; ctx.font = '11px Segoe UI'; ctx.textAlign = 'left';
  ctx.fillText(`${+(len / NMI).toFixed(2)} nm`, sx0 + len * s + 6, sy0 - 3);
  ctx.save();
  ctx.translate(W - 24, 26); ctx.rotate(-phi);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d62828'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(5, 3); ctx.lineTo(-5, 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1b1f24'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('N', 0, 13);
  ctx.restore();
  ctx.restore();
}
