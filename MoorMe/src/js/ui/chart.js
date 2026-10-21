// Kartplotter: mapa 2D akwenu z trasą, znakami IALA, mieliznami i pozycją jachtu.
import { DEG } from '../math.js';
import { t } from '../i18n.js';

const STATE_COLOR = { ok: '#2faa5c', wrong: '#e03a3a', violated: '#e03a3a', missed: '#e0a13a' };

// Rysuje symbol znaku nawigacyjnego (środek w 0,0, promień r)
export function drawMarkSymbol(ctx, type, r) {
  ctx.save();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#1b1f24';
  const stripes = (cols) => {
    const h = (r * 2) / cols.length;
    cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-r * 0.8, -r + i * h, r * 1.6, h); });
    ctx.strokeRect(-r * 0.8, -r, r * 1.6, r * 2);
  };
  const Y = '#f2c230', B = '#15181c';
  switch (type) {
    case 'lateralPort':
      ctx.fillStyle = '#d62828'; ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); ctx.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      break;
    case 'lateralStbd':
      ctx.fillStyle = '#1f9d55'; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.95, r * 0.8); ctx.lineTo(-r * 0.95, r * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'cardN': stripes([B, Y]); break;
    case 'cardS': stripes([Y, B]); break;
    case 'cardE': stripes([B, Y, B]); break;
    case 'cardW': stripes([Y, B, Y]); break;
    case 'safe':
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d62828'; ctx.fillRect(-r * 0.33, -r, r * 0.66, r * 2);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'isolated':
      ctx.fillStyle = B; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d62828'; ctx.fillRect(-r, -r * 0.28, r * 2, r * 0.56);
      break;
    case 'wreck':
      ctx.fillStyle = '#1d4e9a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = Y; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 0.6); ctx.stroke();
      break;
    case 'special':
      ctx.fillStyle = Y; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = B; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.55); ctx.lineTo(r * 0.55, r * 0.55); ctx.moveTo(r * 0.55, -r * 0.55); ctx.lineTo(-r * 0.55, r * 0.55); ctx.stroke();
      break;
    default:
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
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
  for (const sh of (w.blind ? [] : P.shoals)) {
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

  // trasa, strefy, znaki i waypointy – tylko w trybie z pełną pomocą
  const R = w.route;
  if (!w.blind) {
  ctx.setLineDash([9, 6]);
  ctx.strokeStyle = 'rgba(210,40,170,0.9)'; ctx.lineWidth = 2;
  ctx.beginPath();
  R.forEach((p, i) => (i ? ctx.lineTo(X(p.x, p.z), Y(p.x, p.z)) : ctx.moveTo(X(p.x, p.z), Y(p.x, p.z))));
  ctx.stroke();
  ctx.setLineDash([]);
  // pozostała część odcinka do następnego waypointu – grubiej
  const nx = w.next, nxp = R[nx];
  ctx.strokeStyle = '#d223aa'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(X(R[nx - 1].x, R[nx - 1].z), Y(R[nx - 1].x, R[nx - 1].z)); ctx.lineTo(X(nxp.x, nxp.z), Y(nxp.x, nxp.z)); ctx.stroke();

  // strefy zagrożeń
  for (const m of w.marks) {
    if (m.rule !== 'avoid') continue;
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = m.state === 'violated' ? '#e03a3a' : 'rgba(200,50,50,0.7)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(X(m.x, m.z), Y(m.x, m.z), m.radius * s, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  // znaki
  const rs = Math.max(5, Math.min(9, 150 * s + 4));
  ctx.font = '10px Segoe UI'; ctx.textAlign = 'left';
  for (const m of w.marks) {
    const x = X(m.x, m.z), y = Y(m.x, m.z);
    if (x < -20 || y < -20 || x > W + 20 || y > Hh + 20) continue;
    ctx.save();
    ctx.translate(x, y);
    drawMarkSymbol(ctx, m.type, rs);
    if (STATE_COLOR[m.state]) { ctx.strokeStyle = STATE_COLOR[m.state]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, rs + 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    if (opts.labels && s > 0.03) {
      ctx.fillStyle = N ? '#a9c3d8' : '#243447';
      ctx.fillText(t(m.label), x + rs + 4, y + 3);
    }
  }
  // waypointy
  R.forEach((p, i) => {
    if (i === 0) return;
    const x = X(p.x, p.z), y = Y(p.x, p.z);
    ctx.beginPath(); ctx.arc(x, y, i === nx ? 9 : 6, 0, Math.PI * 2);
    ctx.fillStyle = i < nx ? 'rgba(120,120,120,0.6)' : i === nx ? '#d223aa' : 'rgba(255,255,255,0.9)';
    ctx.fill(); ctx.strokeStyle = '#d223aa'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = i === nx ? '#fff' : '#a0187f'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText(i === R.length - 1 ? 'M' : String(i), x, y + 3);
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
  const targets = [100, 200, 500, 1000, 2000, 5000];
  let len = targets[0];
  for (const tg of targets) if (tg * s <= W * 0.28) len = tg;
  const sx0 = 12, sy0 = Hh - 12;
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(sx0 - 4, sy0 - 22, len * s + 40, 24);
  ctx.strokeStyle = '#1b1f24'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx0, sy0 - 4); ctx.lineTo(sx0 + len * s, sy0 - 4); ctx.moveTo(sx0, sy0 - 9); ctx.lineTo(sx0, sy0 - 1); ctx.moveTo(sx0 + len * s, sy0 - 9); ctx.lineTo(sx0 + len * s, sy0 - 1); ctx.stroke();
  ctx.fillStyle = '#1b1f24'; ctx.font = '11px Segoe UI'; ctx.textAlign = 'left';
  ctx.fillText(len >= 1000 ? `${len / 1000} km` : `${len} m`, sx0 + len * s + 6, sy0 - 3);
  ctx.save();
  ctx.translate(W - 24, 26); ctx.rotate(-phi);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d62828'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(5, 3); ctx.lineTo(-5, 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1b1f24'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('N', 0, 13);
  ctx.restore();
  ctx.restore();
}
