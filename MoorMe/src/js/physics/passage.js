// Rejs wzdłuż wybrzeża: ten sam model jachtu i wiatru co w porcie, ale zamiast cum – trasa z waypointami,
// znaki nawigacyjne (boczne, kardynalne, wody bezpiecznej, odosobnionego niebezpieczeństwa, wrak, szczególne),
// mielizny i ląd. Niezależny od grafiki (testy w Node).
import { World } from './world.js';
import { buildPassage, makeSituation, pickSituationKind, markRecord } from '../data/passage.js';
import { clamp, wrapPi, DEG, KN, distToPoly, pointInConvex, thetaToCompass, rng } from '../math.js';

function aabb(poly) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, z] of poly) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); }
  return { minX: a, minZ: b, maxX: c, maxZ: d };
}
const ngon = (cx, cz, r, n) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cz + Math.sin((i / n) * Math.PI * 2) * r]);
const bearingDeg = (dx, dz) => ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;

// Kąt (w stopniach, kompas) od znaku do jachtu mieści się w sektorze kardynalnym?
const SECTOR = { N: 0, E: 90, S: 180, W: 270 };
const SECTOR_HALF = 65; // z zakrętami toru znak mija się pod kątem, więc sektory są szersze niż 90°
export const SEEN_RANGE = 1800; // z tej odległości znak w dzień wyłania się nad horyzontem fali (otwarte morze)
export function inCardinalSector(rule, brgFromMark) {
  const d = Math.abs(((brgFromMark - SECTOR[rule] + 540) % 360) - 180);
  return d <= SECTOR_HALF;
}

export class PassageWorld extends World {
  /**
   * cfg: { spec, equip, passageId, weather, start? }
   */
  constructor(cfg) {
    const H = cfg.harbor || buildPassage(cfg.passageId, cfg.seed);
    const K = cfg.blind && H.keyRoute;
    const compass = K ? bearingDeg(K[1].x - K[0].x, K[1].z - K[0].z) : H.start.compass;
    super({ ...cfg, harbor: H, scenario: 'passage', start: cfg.start || { x: H.start.x, z: H.start.z, compass, speedKn: 0 } });
    this.isPassage = true;
    this.blind = !!cfg.blind; // bez trasy i waypointów: tylko BRG na port, znaki rozpoznawane po światłach
    H.blind = this.blind;
    this.fenderOut = { port: false, starboard: false, stern: false };
    this.route = H.route;
    // na otwartym morzu tryb „tylko BRG” prowadzi po punktach kontrolnych leżących na prostej przez niebezpieczeństwa
    this.navRoute = this.blind && H.keyRoute ? H.keyRoute : H.route;
    this.next = 1; // indeks waypointu, do którego płyniemy
    this.autopilot = { on: false, hdg: compass };
    if (this.blind && !H.keyRoute && !H.dynamic) this.next = H.route.length - 1; // BRG tylko na port
    this.instruction = null; // bieżące polecenie (np. którym torem płynąć za rozwidleniem)
    this._notes = (H.notes || []).map((n) => ({ ...n, fired: false }));
    this.wrongFork = {};
    this.seenShoals = new Set();
    this.nav = { next: this.next, dtw: 0, brg: 0, xte: 0, along: 0, legLen: 0, legBrg: 0, eta: 0, remaining: H.routeLength, cog: 0, sog: 0, depth: 0 };
    this.pstats = { xteSum: 0, xteTime: 0, offTime: 0, wrongSide: 0, missed: 0, avoid: 0, markHits: 0, groundings: 0, wpReached: 0, dist: 0, wrongChannel: 0 };
    this.breakdown = null;
    this._navAcc = 0;
    this._contact = { kind: null, clear: 0 };

    // znaki jako małe przeszkody (zderzenie = kara) i dane do oceny
    this.marks = H.marks.map((m) => this.prepMark(m));
    for (const m of this.marks) {
      const poly = ngon(m.x, m.z, 1.4, 8);
      this.obstacles.push({ poly, box: aabb(poly), kind: 'mark', mark: m });
    }
    this._hazards = this.obstacles.filter((o) => o.kind === 'land' || o.kind === 'breakwater' || o.kind === 'shoal' || o.kind === 'mark');
    this._land = this.obstacles.filter((o) => o.kind === 'land' || o.kind === 'breakwater');
    this._shoals = this.obstacles.filter((o) => o.kind === 'shoal').map((o) => ({ ...o, depth: (H.shoals.find((q) => q.poly === o.poly) || { depth: 1 }).depth }));
    // otwarte morze: sytuacje losowane w locie przed dziobem
    if (H.dynamic) this.spawner = { r: rng(H.spawnSeed || 1), sits: [], n: 0, seq: this.marks.length, acc: 1 };
    this.updateNav(0.1);
  }

  // Dane znaku do oceny: odcinek trasy, wzdłuż którego się go mija (albo kierunek toru podany przy znaku)
  prepMark(m) {
    const H = this.H;
    {
      let dRoute = Infinity, legDir = { x: 1, z: 0 };
      for (let i = 0; i < H.route.length - 1; i++) {
        const a = H.route[i], b = H.route[i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
        const t = clamp(((m.x - a.x) * dx + (m.z - a.z) * dz) / L2, 0, 1);
        const d = Math.hypot(m.x - (a.x + dx * t), m.z - (a.z + dz * t));
        if (d < dRoute) { dRoute = d; const l = Math.sqrt(L2); legDir = { x: dx / l, z: dz / l }; }
      }
      if (m.legDir) legDir = m.legDir;
      const lateral = m.rule === 'port' || m.rule === 'starboard';
      const cardinal = SECTOR[m.rule] !== undefined;
      // na otwartym morzu trasy nie ma – żaden znak nie jest obowiązkowy, liczy się poprawne mijanie
      const required = !H.dynamic && ((lateral && !m.off) || (cardinal && dRoute < 160));
      return { ...m, dRoute, legDir, required, seen: false, state: 'pending', minD: Infinity, atMin: null, inside: false, inZone: false };
    }
  }

  // ---------- Otwarte morze: nowe sytuacje przed dziobem ----------
  // Utrzymuje przed jachtem (±30° od kierunku płynięcia) co najmniej dwie sytuacje; nowe powstają tuż za zasięgiem widoczności,
  // nie nachodzą na wcześniejsze i nie zasłaniają boi docelowej.
  updateSpawner(dt) {
    const sp = this.spawner;
    if (!sp || this.result) return;
    sp.acc += dt;
    if (sp.acc < 0.5) return;
    sp.acc = 0;
    const b = this.boat;
    const hb = b.speed > 0.6 ? bearingDeg(b.vx, b.vz) : thetaToCompass(b.th);
    const ahead = sp.sits.filter((q) => {
      const d = Math.hypot(q.cx - b.x, q.cz - b.z);
      if (d - q.rad > 2100 || d + q.rad < 150) return false;
      return Math.abs(((bearingDeg(q.cx - b.x, q.cz - b.z) - hb + 540) % 360) - 180) <= 38 || d < q.rad + 100;
    }).length;
    if (ahead >= 2) return;
    const goal = this.route[this.route.length - 1];
    if (Math.hypot(goal.x - b.x, goal.z - b.z) < 900) return; // przed metą już nic nowego
    const wps = this.route.slice(Math.max(1, this.next));
    const r = sp.r;
    let kind = pickSituationKind(r);
    for (let tries = 0; tries < 10; tries++) {
      if (tries === 6) kind = pickSituationKind(r); // duże tory najpierw próbują dalej i pod innym kątem
      const a = hb + (r() - 0.5) * 60, dist = 1350 + r() * 350 + (tries % 3) * 250;
      const u = { x: Math.sin(a * DEG), z: -Math.cos(a * DEG) };
      const E = { x: b.x + u.x * dist, z: b.z + u.z * dist };
      // tor ustawiony mniej więcej w kierunku płynięcia (z niewielkim skosem)
      const sit = makeSituation(kind, E, a + (r() - 0.5) * 30, r, sp.n + 1);
      if (Math.hypot(sit.cx - b.x, sit.cz - b.z) < sit.rad + 250) continue;
      if (wps.some((p) => Math.hypot(sit.cx - p.x, sit.cz - p.z) < sit.rad + 200)) continue; // waypointy zostają osiągalne
      if (sp.sits.some((q) => Math.hypot(q.cx - sit.cx, q.cz - sit.cz) < q.rad + sit.rad + 120)) continue;
      sp.n++;
      this.addSituation(sit);
      return;
    }
  }

  addSituation(sit) {
    const H = this.H, sp = this.spawner;
    const marks = sit.marks.map((md) => markRecord(md, 'm' + sp.seq++));
    for (const m of marks) {
      H.marks.push(m);
      const pm = this.prepMark(m);
      this.marks.push(pm);
      const poly = ngon(m.x, m.z, 1.4, 8), o = { poly, box: aabb(poly), kind: 'mark', mark: pm };
      this.obstacles.push(o); this._hazards.push(o);
    }
    for (const s of sit.shoals) {
      H.shoals.push(s);
      H.structures.push({ kind: 'shoal', style: 'shoal', poly: s.poly, h: 0, walk: false, depth: s.depth, name: s.name });
      const o = { poly: s.poly, box: aabb(s.poly), kind: 'shoal', h: 0 };
      this.obstacles.push(o); this._hazards.push(o); this._shoals.push({ ...o, depth: s.depth });
    }
    H.wrecks.push(...sit.wrecks);
    H.forks.push(...sit.forks);
    this._notes.push(...sit.notes.map((n) => ({ ...n, fired: false })));
    sp.sits.push(sit);
    if (this.onSpawn) this.onSpawn({ marks, shoals: sit.shoals, wrecks: sit.wrecks });
  }

  markName(m) { return this.blind ? m.typeName : m.label; }

  setupDefaultLines() { /* w rejsie nie ma cum */ }

  log(msg, type = 'info') {
    if (typeof msg === 'string' && msg.startsWith('Uderzenie kadłubem')) return; // własne komunikaty o kontakcie z lądem/mielizną/znakiem
    if (type === 'bad') (this.mistakes || (this.mistakes = [])).push({ t: this.time, msg }); // do podsumowania rejsu
    super.log(msg, type);
  }

  // ---------- Autopilot (utrzymanie kursu kompasowego) ----------
  setAutopilot(on, hdg) {
    this.autopilot.on = !!on;
    if (hdg !== undefined) this.autopilot.hdg = ((hdg % 360) + 360) % 360;
    else if (on) this.autopilot.hdg = thetaToCompass(this.boat.th);
  }
  adjustAutopilot(deg) { this.autopilot.hdg = (((this.autopilot.hdg + deg) % 360) + 360) % 360; }

  runAutopilot() {
    const ap = this.autopilot;
    if (!ap.on) return;
    const b = this.boat;
    const err = wrapPi((ap.hdg - 90) * DEG - b.th);
    b.rudderCmd = clamp(1.1 * err - 1.7 * b.r, -30 * DEG, 30 * DEG);
  }

  // ---------- Głębokość ----------
  depthAt(x, z) {
    const H = this.H;
    let dist = 1e9;
    for (const o of this._land) {
      if (x < o.box.minX - 600 || x > o.box.maxX + 600 || z < o.box.minZ - 600 || z > o.box.maxZ + 600) continue;
      const d = distToPoly(o.poly, x, z).dist;
      if (d < dist) dist = d;
    }
    let depth = Math.min(H.depthMax, 1.2 + Math.max(0, dist) * (H.depthMax / 450));
    for (const o of this._shoals) {
      const d = distToPoly(o.poly, x, z).dist;
      if (d < 80) depth = Math.min(depth, o.depth + Math.max(0, d) * 0.12);
    }
    return depth;
  }
  // ---------- Pętla ----------
  step(dt) {
    this.time += dt;
    const b = this.boat;
    this.env.update(dt);
    this.runAutopilot();
    this.computeContacts(dt);
    b.step(dt, this.env);
    this.pstats.dist += b.speed * dt;
    this._navAcc += dt;
    if (this._navAcc >= 0.1) {
      const d = this._navAcc;
      this._navAcc = 0;
      this.updateNav(d);
    }
  }

  updateNav(dt) {
    if (this.result) return;
    const b = this.boat, R = this.navRoute, ps = this.pstats;
    const px = b.x, pz = b.z;
    this.updateAware(px, pz);
    this.updateSpawner(dt);
    if (this.blind && !this.H.keyRoute && !this.H.dynamic) {
      const goal = R[R.length - 1], n = this.nav;
      const dtw = Math.hypot(goal.x - px, goal.z - pz);
      n.next = R.length - 1; n.dtw = dtw; n.remaining = dtw; n.xte = 0;
      n.brg = bearingDeg(goal.x - px, goal.z - pz);
      n.sog = b.speed / KN;
      n.cog = b.speed > 0.3 ? bearingDeg(b.vx, b.vz) : thetaToCompass(b.th);
      n.eta = dtw / Math.max(0.5, b.speed);
      if (dtw < 60) { ps.wpReached++; this.finishPassage(); return; }
      this.updateMarks(px, pz, dt);
      this.updateContact(dt);
      return;
    }
    // waypoint i odcinek
    for (let guard = 0; guard < 3 && !this.result; guard++) {
      const k = this.next, wp = R[k], pr = R[k - 1];
      const dx = wp.x - pr.x, dz = wp.z - pr.z, len = Math.hypot(dx, dz) || 1;
      const ux = dx / len, uz = dz / len;
      const along = (px - pr.x) * ux + (pz - pr.z) * uz;
      const xte = (ux * (pz - pr.z) - uz * (px - pr.x)); // + = na prawo od toru
      const dtw = Math.hypot(wp.x - px, wp.z - pz);
      const n = this.nav;
      n.next = k; n.along = along; n.xte = xte; n.dtw = dtw; n.legLen = len; n.legBrg = bearingDeg(dx, dz);
      n.brg = bearingDeg(wp.x - px, wp.z - pz);
      n.sog = b.speed / KN;
      n.cog = b.speed > 0.3 ? bearingDeg(b.vx, b.vz) : thetaToCompass(b.th);
      let rest = dtw;
      for (let i = k; i < R.length - 1; i++) rest += Math.hypot(R[i + 1].x - R[i].x, R[i + 1].z - R[i].z);
      n.remaining = rest;
      const vmg = Math.max(0.5, b.speed);
      n.eta = rest / vmg;
      // punkt za rozwidleniem (tryb z BRG) jest osiągnięty także przy końcu któregokolwiek z torów
      const reached = dtw < 50 || (along > len && dtw < 260) || (wp.ends && wp.ends.some((e) => Math.hypot(e.x - px, e.z - pz) < 170));
      if (reached) {
        ps.wpReached++;
        if (k >= R.length - 1) { this.finishPassage(); return; }
        this.log(`Waypoint osiągnięty: ${wp.name || 'WP' + k}`, 'good');
        this.next = k + 1;
        continue;
      }
      break;
    }
    if (this.result) return;
    const n = this.nav;
    if (!this.blind && !this.H.dynamic) { // na otwartym morzu omijanie przeszkód wymaga zejścia z linii trasy – bez kary za XTE
      ps.xteSum += Math.abs(n.xte) * dt;
      ps.xteTime += dt;
      if (Math.abs(n.xte) > 150) ps.offTime += dt;
    }
    this.updateMarks(px, pz, dt);
    this.updateContact(dt);
  }

  // Polecenia na trasie (tor wodny, rozwidlenie) i to, co już widać z pokładu (do chartplotera na otwartym morzu)
  updateAware(px, pz) {
    for (const n of this._notes) {
      if (!n.fired && Math.hypot(n.x - px, n.z - pz) < n.r) {
        n.fired = true;
        this.instruction = n;
        this.log(n.text, 'info');
      }
    }
    if (this.instruction && Math.hypot(this.instruction.end.x - px, this.instruction.end.z - pz) < 150) this.instruction = null;
    if (this.H.offshore) {
      for (const s of this.H.shoals) if (!this.seenShoals.has(s) && distToPoly(s.poly, px, pz).dist < SEEN_RANGE - 200) this.seenShoals.add(s);
    }
  }

  updateMarks(px, pz, dt) {
    const ps = this.pstats;
    for (const m of this.marks) {
      const d = Math.hypot(px - m.x, pz - m.z);
      if (d < SEEN_RANGE) m.seen = true;
      // znak toru, którego nie wybrano za rozwidleniem: wpłynięcie w niego to błąd wyboru toru
      if (m.off && d < 45 && !this.wrongFork[m.fork]) {
        this.wrongFork[m.fork] = true;
        ps.wrongChannel++;
        this.log('Wpłynąłeś w niewłaściwy tor!', 'bad');
      }
      if (m.rule === 'avoid') {
        if (!m.inZone && d < m.radius) {
          m.inZone = true;
          ps.avoid++;
          m.state = 'violated';
          this.log(`Wpłynąłeś w strefę zagrożenia: ${this.markName(m)}`, 'bad');
        } else if (m.inZone && d > m.radius + 20) m.inZone = false;
        if (m.state === 'pending' && d < m.gate) { m.minD = Math.min(m.minD, d); }
        else if (m.state === 'pending' && m.minD < Infinity && d > m.gate + 20) m.state = 'ok';
        continue;
      }
      if (m.state !== 'pending') continue;
      if (d < m.gate) {
        m.inside = true;
        if (d < m.minD) { m.minD = d; m.atMin = { x: px, z: pz }; }
        else if (d > m.minD + 30) this.evalMark(m);
      } else if (m.inside) this.evalMark(m);
    }
  }

  // Ocena minięcia znaku w punkcie najbliższego zbliżenia
  evalMark(m) {
    if (m.state !== 'pending' || !m.atMin) return;
    const p = m.atMin;
    let ok = true;
    if (m.rule === 'port' || m.rule === 'starboard') {
      const cross = m.legDir.x * (m.z - p.z) - m.legDir.z * (m.x - p.x); // < 0: znak po lewej burcie
      ok = (cross < 0 ? 'port' : 'starboard') === m.rule;
    } else if (SECTOR[m.rule] !== undefined) {
      ok = inCardinalSector(m.rule, bearingDeg(p.x - m.x, p.z - m.z));
    }
    m.state = ok ? 'ok' : 'wrong';
    if (!ok) {
      this.pstats.wrongSide++;
      this.log(`Znak minięty z niewłaściwej strony: ${this.markName(m)}`, 'bad');
    }
  }

  // Kontakt z lądem, mielizną albo znakiem (raz na zdarzenie)
  updateContact(dt) {
    const b = this.boat, c = this._contact;
    let kind = null;
    const outline = b.outline;
    const pts = outline.map(([lx, ly]) => {
      const cs = Math.cos(b.th), sn = Math.sin(b.th);
      return [b.x + lx * cs - ly * sn, b.z + lx * sn + ly * cs];
    });
    for (const o of this._hazards) {
      if (b.x + 14 < o.box.minX || b.x - 14 > o.box.maxX || b.z + 14 < o.box.minZ || b.z - 14 > o.box.maxZ) continue;
      for (const [x, z] of pts) {
        if (x < o.box.minX || x > o.box.maxX || z < o.box.minZ || z > o.box.maxZ) continue;
        if (pointInConvex(o.poly, x, z)) { kind = o.kind; break; }
      }
      if (kind) break;
    }
    if (kind) {
      c.clear = 0;
      if (!c.kind) {
        c.kind = kind;
        if (kind === 'mark') { this.pstats.markHits++; this.log('Zderzenie ze znakiem nawigacyjnym!', 'bad'); }
        else if (kind === 'shoal') { this.pstats.groundings++; this.log('Wszedłeś na mieliznę!', 'bad'); }
        else { this.pstats.groundings++; this.log('Kontakt z brzegiem!', 'bad'); }
      }
    } else if (c.kind) {
      c.clear += dt;
      if (c.clear > 3) c.kind = null;
    }
  }

  // ---------- Wynik ----------
  finishPassage() {
    if (this.result) return;
    const ps = this.pstats;
    for (const m of this.marks) {
      if (m.state === 'pending' && m.inside) this.evalMark(m);
      if (m.state === 'pending' && m.required) { ps.missed++; m.state = 'missed'; }
    }
    const t = this.time;
    const L = this.H.routeLength;
    const avgXte = ps.xteTime > 0 ? ps.xteSum / ps.xteTime : 0;
    const nominal = L / (5 * KN);
    const items = [];
    const add = (label, pts) => { if (pts > 0.05) items.push({ label, pts: Math.round(pts * 10) / 10 }); };
    add('Odchylenie od trasy', Math.min(18, avgXte / 8));
    add('Czas poza torem (>150 m)', Math.min(10, ps.offTime / 20));
    add('Znaki minięte z niewłaściwej strony', Math.min(40, ps.wrongSide * 10));
    add('Pominięte znaki', Math.min(15, ps.missed * 5));
    add('Wejścia w strefy zagrożenia', Math.min(32, ps.avoid * 8));
    add('Zderzenia ze znakami', Math.min(20, ps.markHits * 10));
    add('Mielizna i kontakt z brzegiem', Math.min(40, ps.groundings * 15));
    add('Wybór niewłaściwego toru', Math.min(30, ps.wrongChannel * 15));
    add('Zbyt długi rejs', Math.min(10, Math.max(0, (t - nominal * 1.6) / 120)));
    const loss = items.reduce((s, i) => s + i.pts, 0);
    const score = Math.round(clamp(100 - loss, 0, 100));
    this.breakdown = items;
    this.result = { ok: true, passage: true, score, time: t, items, mistakes: [...(this.mistakes || [])], stats: { ...ps, avgXte, length: L } };
    this.log('Meta! Rejs ukończony', 'good');
    if (this.onFinish) this.onFinish(this.result);
  }
}
