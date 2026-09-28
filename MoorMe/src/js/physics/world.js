// Świat symulacji: jacht, liny, kontakty (kadłub, odbijacze), załoga, ocena manewru.
// Niezależny od grafiki – można go testować w Node.
import { clamp, localToWorld, worldToLocal, pointInConvex, distToPoly, closestOnSegment, DEG, KN, wrapPi } from '../math.js';
import { BoatPhysics } from './boatPhysics.js';
import { Environment } from './environment.js';
import { MooringLine, lineForce, tendLine, breakLoadFor, LINE_STATE_LABEL } from './lines.js';
import { hullNormalAt, halfBeamAt } from '../data/boats.js';
import { neighborPolys, ROLE_NAMES } from '../data/harbors.js';

const DT = 1 / 240;

function aabb(poly) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, z] of poly) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); }
  return { minX: a, minZ: b, maxX: c, maxZ: d };
}

export class World {
  /**
   * cfg: { spec, equip, harbor, weather, scenario: 'moor'|'unmoor', start: {x,z,compass} }
   */
  constructor(cfg) {
    this.cfg = cfg;
    this.spec = cfg.spec;
    this.equip = cfg.equip;
    this.H = cfg.harbor;
    this.env = new Environment(cfg.weather);
    this.random = cfg.random || Math.random;
    this.boat = new BoatPhysics(cfg.spec, cfg.equip);
    this.time = 0;
    this.acc = 0;
    this.events = [];
    this.lines = [];
    this.stats = { hullHits: 0, maxHit: 0, hardFender: 0, breaks: 0, overheat: 0, fouled: false, lassoMiss: 0 };
    this.result = null;
    this.successTimer = 0;
    this.engineDead = false;
    this.fenderOut = { port: true, starboard: true, stern: cfg.harbor.method !== 'longside' };
    this.contacts = [];
    this.fenderState = {};
    this.prevContact = new Map();

    const sp = cfg.spec;
    this.lineParams = {
      EA: breakLoadFor(sp) / 0.16,
      mass: sp.displacement,
      breakLoad: breakLoadFor(sp),
      winchPull: sp.winchPull * (cfg.equip.electricWinch ? 1.3 : 1),
      winchSpeed: cfg.equip.electricWinch ? 0.32 : 0.16,
      handPull: 420,
      handSpeed: 0.55,
      easeSpeed: 0.7
    };

    // przeszkody
    this.obstacles = [];
    for (const s of this.H.structures) {
      this.obstacles.push({ poly: s.poly, box: aabb(s.poly), kind: s.kind, walk: s.walk, h: s.h });
    }
    neighborPolys(this.H).forEach((p, i) => {
      this.obstacles.push({ poly: p, box: aabb(p), kind: 'boat', neighbor: this.H.neighbors[i] });
    });

    this.crew = { ashore: false, x: 0, z: 0, task: null, busy: 0, anim: 0 };

    // pozycja startowa
    if (cfg.scenario === 'unmoor') {
      const b = this.H.berth;
      this.boat.reset(b.x, b.z, b.th);
    } else {
      const s = cfg.start;
      this.boat.reset(s.x, s.z, (s.compass - 90) * DEG);
      const sp0 = (cfg.start.speedKn || 0) * KN;
      this.boat.vx = Math.cos(this.boat.th) * sp0;
      this.boat.vz = Math.sin(this.boat.th) * sp0;
    }
    this.setupDefaultLines();
  }

  log(msg, type = 'info') {
    this.events.push({ t: this.time, msg, type });
    if (this.onEvent) this.onEvent({ t: this.time, msg, type });
  }

  // ---------- Wyposażenie pokładu ----------
  deckItem(id) { return this.equip.deck.find((d) => d.id === id); }
  cleats() { return this.equip.deck.filter((d) => d.kind === 'cleat'); }
  fairleads() { return this.equip.deck.filter((d) => d.kind !== 'cleat'); }

  autoFairlead(cleat) {
    let best = null, bd = 3.2;
    for (const f of this.fairleads()) {
      if (Math.sign(f.y) !== Math.sign(cleat.y)) continue;
      const d = Math.hypot(f.x - cleat.x, f.y - cleat.y);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  findCleat(where, side) {
    // where: 'bow' | 'stern' | 'mid'; side: -1 lewa, 1 prawa
    const cs = this.cleats().filter((c) => Math.sign(c.y) === side || Math.abs(c.y) < 0.05);
    if (!cs.length) return this.cleats()[0];
    if (where === 'bow') return cs.reduce((a, b) => (b.x > a.x ? b : a));
    if (where === 'stern') return cs.reduce((a, b) => (b.x < a.x ? b : a));
    return cs.reduce((a, b) => (Math.abs(b.x) < Math.abs(a.x) ? b : a));
  }

  deckHeight(x) {
    const sp = this.spec;
    const t = (x - this.boat.xs) / (this.boat.xb - this.boat.xs);
    return sp.freeboard + 0.25 * t * t;
  }

  // Punkt wyprowadzenia liny z pokładu (lokalnie)
  leadLocal(line) {
    const cleat = this.deckItem(line.cleatId);
    if (!cleat) return { x: 0, y: 0 };
    const f = line.fairleadId ? this.deckItem(line.fairleadId) : null;
    if (f && !line.jumped) return { x: f.x, y: f.y, item: f };
    return { x: cleat.x, y: cleat.y, item: cleat };
  }
  leadWorld(line) {
    const l = this.leadLocal(line);
    const w = localToWorld(this.boat.x, this.boat.z, this.boat.th, l.x, l.y);
    return { x: w.x, y: this.deckHeight(l.x) + 0.1, z: w.z, lx: l.x, ly: l.y };
  }
  targetPoint(line, t = line.target) {
    if (!t) return null;
    if (line.isMooring) return { x: t.anchor.x, y: -t.anchor.depth, z: t.anchor.z };
    return { x: t.x, y: t.h + (t.kind === 'pile' ? 0.3 : t.kind === 'ring' ? 0.05 : 0.35), z: t.z };
  }

  // ---------- Domyślne liny ----------
  addLine(opts) {
    const cleat = this.deckItem(opts.cleatId);
    if (opts.fairleadId === undefined && cleat) {
      const f = this.autoFairlead(cleat);
      opts.fairleadId = f ? f.id : null;
    }
    const line = new MooringLine(opts);
    this.lines.push(line);
    return line;
  }
  // Rola liny z geometrii: skąd (knaga) i dokąd (poler) prowadzi
  inferRole(cleat, bollard) {
    const b = this.boat, L = this.spec.loa;
    const loc = worldToLocal(b.x, b.z, b.th, bollard.x, bollard.z);
    const dx = loc.x - cleat.x, dy = loc.y - cleat.y;
    const ang = Math.atan2(Math.abs(dy), dx) / DEG; // 0 = do przodu, 90 = w bok, 180 = do tyłu
    const zone = cleat.x > 0.2 * L ? 'bow' : cleat.x < -0.2 * L ? 'stern' : 'mid';
    if (ang > 62 && ang < 118) return zone === 'bow' ? 'breastFwd' : zone === 'stern' ? 'breastAft' : 'side';
    if (zone === 'bow') return ang <= 62 ? 'bow' : 'springFwd';
    if (zone === 'stern') return ang >= 118 ? 'stern' : 'springAft';
    return ang >= 118 ? 'springFwd' : 'springAft';
  }

  /**
   * Lina wskazana myszą: knaga -> (opcjonalnie kluza/półkluza) -> poler.
   * fairleadId: id, null (prosto z knagi) lub undefined (automatycznie).
   * Jeśli poler jest w zasięgu – zakładanie od razu, inaczej lina czeka przygotowana z zaplanowanym celem.
   */
  rigLine(cleatId, fairleadId, bollard, mode = 'fixed') {
    const cleat = this.deckItem(cleatId);
    const role = this.inferRole(cleat, bollard);
    const tmp = { cleatId, fairleadId: fairleadId === undefined ? (this.autoFairlead(cleat)?.id ?? null) : fairleadId, jumped: false };
    const lead = this.leadWorld(tmp);
    const t = this.targetPoint({}, bollard);
    const d = Math.hypot(t.x - lead.x, t.y - lead.y, t.z - lead.z);
    const parts = mode === 'slip' ? 2 : 1;
    const length = Math.min(40, Math.max(8, Math.ceil(d * parts * 1.25 + 4)));
    const fl = tmp.fairleadId ? this.deckItem(tmp.fairleadId) : null;
    const line = this.addLine({
      role,
      name: `${ROLE_NAMES[role]} ${cleat.y < 0 ? 'L' : 'P'}`,
      cleatId,
      fairleadId: tmp.fairleadId,
      length,
      mode,
      winch: role === 'springFwd' || role === 'springAft'
    });
    line.plannedTarget = bollard;
    line.routeLabel = `${cleat.label}${fl ? ' → ' + fl.label : ''} → ${bollard.label}`;
    // w zasięgu – od razu; inaczej załoga zrobi to sama, gdy jacht podejdzie
    this.attach(line, bollard);
    return line;
  }

  removeLine(line) {
    if (line.state === 'attached' || line.state === 'pending') return false;
    this.lines = this.lines.filter((l) => l !== line);
    return true;
  }

  nearestBollard(px, pz, filter) {
    let best = null, bd = Infinity;
    for (const b of this.H.bollards) {
      if (filter && !filter(b)) continue;
      const d = Math.hypot(b.x - px, b.z - pz);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  setupDefaultLines() {
    const H = this.H, m = H.method, sp = this.spec, b = H.berth;
    const L = sp.loa;
    const bigBoat = L > 12;
    const plan = [];
    // pozycja jachtu na stanowisku (do wyznaczenia sugerowanych polerów)
    const bx = b.x, bz = b.z, bth = b.th;
    const wpt = (lx, ly) => localToWorld(bx, bz, bth, lx, ly);
    const quayBollard = (lx, ly, dxAlong = 0) => {
      const p = wpt(lx, ly);
      return this.nearestBollard(p.x + dxAlong, -0.4, (bb) => bb.kind !== 'pile' && bb.z < 0.1);
    };
    if (m === 'longside') {
      const s = H.berth.th === 0 ? -1 : 1; // burta od kei
      const fwd = Math.cos(bth); // kierunek x dziobu
      plan.push({ role: 'bow', where: 'bow', side: s, len: bigBoat ? 15 : 12, tgt: quayBollard(this.boat.xb, 0, fwd * 3.5) });
      plan.push({ role: 'stern', where: 'stern', side: s, len: bigBoat ? 15 : 12, tgt: quayBollard(this.boat.xs, 0, -fwd * 3.5) });
      plan.push({ role: 'springFwd', where: 'mid', side: s, len: bigBoat ? 18 : 15, tgt: quayBollard(this.boat.xs * 0.6, 0) });
      plan.push({ role: 'springAft', where: 'stern', side: s, len: bigBoat ? 18 : 15, tgt: quayBollard(this.boat.xb * 0.35, 0) });
    } else {
      const bowIn = b.bowIn;
      const quayEnd = bowIn ? 'bow' : 'stern';
      const farEnd = bowIn ? 'stern' : 'bow';
      const endX = bowIn ? this.boat.xb : this.boat.xs;
      const role = bowIn ? 'bow' : 'stern';
      for (const s of [-1, 1]) {
        const p = wpt(endX, s * sp.beam * 0.45);
        const tgt = this.nearestBollard(p.x + (p.x - bx) * 0.8, -0.4, (bb) => bb.z < 0.1 && bb.kind !== 'ring');
        plan.push({ role, where: quayEnd, side: s, len: bigBoat ? 12 : 10, tgt, name: `${ROLE_NAMES[role]} ${s < 0 ? 'L' : 'P'}` });
      }
      if (m === 'mooringStern' || m === 'mooringBow') {
        const mur = H.murings.find((x) => x.own);
        plan.push({ role: 'mooring', where: farEnd, side: 1, len: 60, muring: mur, name: 'Muring' });
      } else if (m.startsWith('yboom')) {
        for (const s of [-1, 1]) {
          const tgtX = b.x + s * (b.slotW / 2);
          const tgt = this.nearestBollard(tgtX, 0.72 * L - 0.35, (bb) => bb.kind === 'ring' && bb.z > 1);
          plan.push({ role: 'side', where: 'mid', side: s * (bowIn ? -1 : 1) * (b.th > 0 ? 1 : 1), len: bigBoat ? 12 : 10, tgt, name: `Cuma boczna (Y-bom) ${s < 0 ? 'L' : 'P'}` });
        }
      } else if (m.startsWith('piles')) {
        for (const s of [-1, 1]) {
          const tgt = this.nearestBollard(b.x + s * (b.slotW / 2), b.pileZ, (bb) => bb.kind === 'pile');
          plan.push({ role: bowIn ? 'stern' : 'bow', where: farEnd, side: 0, len: bigBoat ? 18 : 15, tgt, pileSide: s, name: `${bowIn ? 'Cuma rufowa' : 'Cuma dziobowa'} – dalba ${s < 0 ? 'W' : 'E'}` });
        }
      }
    }
    for (const p of plan) {
      // przy cumowaniu lista zawiera tylko aktywne liny – cumy tworzysz sam (knaga → poler); muring czeka przy kei
      if (this.cfg.scenario === 'moor' && p.role !== 'mooring') continue;
      let side = p.side;
      if (p.pileSide !== undefined || p.role === 'side') {
        // dobierz burtę jachtu najbliższą celowi
        if (p.tgt) {
          const loc = worldToLocal(bx, bz, bth, p.tgt.x, p.tgt.z);
          side = loc.y >= 0 ? 1 : -1;
        } else side = p.pileSide || 1;
      }
      const cleat = this.findCleat(p.where, side || 1);
      const line = this.addLine({
        role: p.role,
        name: p.name || ROLE_NAMES[p.role] + (p.role !== 'mooring' ? (side < 0 ? ' L' : ' P') : ''),
        cleatId: cleat.id,
        length: p.len,
        mode: this.cfg.scenario === 'unmoor' && p.role !== 'mooring' ? 'slip' : 'fixed',
        winch: p.role === 'springFwd' || p.role === 'springAft' || (bigBoat && p.role === 'stern' && m === 'longside'),
        muring: p.muring,
        suggestedTarget: p.tgt,
        state: p.role === 'mooring' ? 'onQuay' : 'ready'
      });
      if (this.cfg.scenario === 'unmoor') {
        if (line.isMooring) {
          line.target = p.muring;
          line.state = 'attached';
          const lead = this.leadWorld(line);
          const t = this.targetPoint(line);
          line.rest = Math.hypot(t.x - lead.x, t.y - lead.y, t.z - lead.z) - 0.25;
        } else if (p.tgt) {
          line.target = p.tgt;
          line.state = 'attached';
          const lead = this.leadWorld(line);
          const t = this.targetPoint(line);
          const d = Math.hypot(t.x - lead.x, t.y - lead.y, t.z - lead.z);
          line.rest = d * (line.mode === 'slip' ? 2 : 1) - 0.02;
          if (line.rest > line.length) { line.length = Math.ceil(line.rest + 3); }
        }
      }
    }
    if (this.cfg.scenario === 'unmoor') {
      // załoga na kei przy jachcie
      // najbliższy kei punkt burty
      const poly = this.boatPolyWorld();
      const near = poly.reduce((a, p) => (p[1] < a[1] ? p : a));
      this.crew.ashore = true;
      this.crew.x = near[0];
      this.crew.z = -0.6;
    }
  }

  // ---------- Komendy lin ----------
  lineReach(line, bollard) {
    // zasięg zakładania z pokładu
    if (bollard.kind === 'ring') return 1.3;
    if (line.mode === 'slip') return 1.5;
    return 3.4; // rzut okiem liny (lasso)
  }

  attachOptions(line) {
    // Lista polerów z informacją o możliwości założenia
    const lead = this.leadWorld(line);
    const res = [];
    const parts = line.mode === 'slip' ? 2 : 1;
    for (const b of this.H.bollards) {
      const t = this.targetPoint(line, b);
      const d3 = Math.hypot(t.x - lead.x, t.y - lead.y, t.z - lead.z);
      if (d3 > 45) continue;
      let ok = false, why = '', via = 'deck';
      const need = d3 * parts + 0.2;
      if (need > line.length) why = `za krótka lina (${line.length} m)`;
      else if (d3 <= this.lineReach(line, b)) ok = true;
      else if (this.crew.ashore && this.onFoot(b)) {
        // załoga podchodzi do krawędzi kei naprzeciw jachtu, łapie linę i zanosi ją na poler
        const c = this.catchPoint(lead);
        if (!c || c.d > 7) why = 'jacht za daleko od kei, by podać linę na ląd';
        else { ok = true; via = 'crew'; }
      } else why = this.crew.ashore ? 'poza zasięgiem' : `poza zasięgiem z pokładu (${this.lineReach(line, b).toFixed(1)} m)`;
      res.push({ bollard: b, ok, why, via, dist: d3 });
    }
    res.sort((a, b) => a.dist - b.dist);
    return res;
  }

  // Czy do polera da się dojść pieszo (keja, pomost, Y-bom) – dalby są tylko z wody
  onFoot(b) {
    return b.kind !== 'pile' && !(b.kind === 'ring' && b.z > 1 && this.H.quay.id !== 'yboom');
  }

  // Najbliższy punkt krawędzi kei/pomostu/Y-bomu (lekko w głąb), d – odległość od punktu
  catchPoint(p) {
    let best = null;
    for (const o of this.obstacles) {
      if (!o.walk && o.kind !== 'boom') continue;
      if (p.x < o.box.minX - 30 || p.x > o.box.maxX + 30 || p.z < o.box.minZ - 30 || p.z > o.box.maxZ + 30) continue;
      const r = distToPoly(o.poly, p.x, p.z);
      if (!best || r.dist < best.d) {
        const inset = o.kind === 'boom' ? 0.05 : 0.5;
        best = { x: p.x - r.nx * (r.dist + inset), z: p.z - r.nz * (r.dist + inset), d: Math.max(0, r.dist), kind: o.kind };
      }
    }
    return best;
  }

  // Punkt zejścia na ląd: najbliższa kei część burty
  shoreSpot() {
    const b = this.boat;
    let best = null;
    for (const [lx, ly] of b.outline) {
      const p = localToWorld(b.x, b.z, b.th, lx, ly);
      const c = this.catchPoint(p);
      if (c && (!best || c.d < best.d)) best = c;
    }
    return best;
  }

  canStepAshore() {
    const s = this.shoreSpot();
    const maxD = this.H.method === 'longside' ? 1.0 : 1.3;
    return !!s && s.d <= maxD && this.boat.speed <= 0.7;
  }

  crewWalk(points, extra = {}) {
    this.crew.task = { type: 'walk', path: points.map((p) => ({ x: p.x, z: p.z })), ...extra };
  }

  attach(line, bollard, quiet = false) {
    if (line.state !== 'ready' && line.state !== 'queued') return this.log(`${line.name}: lina nie jest gotowa`, 'warn');
    let opt = this.attachOptions(line).find((o) => o.bollard === bollard);
    // za krótka – załoga bierze dłuższą linę (do 40 m)
    if (opt && !opt.ok && opt.why.startsWith('za krótka')) {
      const need = opt.dist * (line.mode === 'slip' ? 2 : 1) + 2;
      if (need <= 40) {
        line.length = Math.ceil(need);
        line.rest = line.length;
        this.log(`${line.name}: wydłużona do ${line.length} m`);
        opt = this.attachOptions(line).find((o) => o.bollard === bollard);
      }
    }
    if (!opt) return this.log(`${line.name}: brak celu`, 'warn');
    if (!opt.ok) {
      // nie teraz – załoga zrobi to sama, gdy tylko będzie w zasięgu (zejdzie na ląd, jeśli trzeba)
      if (line.state !== 'queued') {
        line.state = 'queued';
        line.queuedTarget = bollard;
        line.queueTimer = 0;
        if (!quiet) this.log(`${line.name}: załoga założy na ${bollard.label.toLowerCase()}, gdy tylko będzie w zasięgu (${opt.why})`);
      }
      return;
    }
    line.queuedTarget = null;
    line.pendingTarget = bollard;
    line.state = 'pending';
    if (opt.via === 'crew') {
      const lead = this.leadWorld(line);
      const c = this.catchPoint(lead);
      const dest = this.bollardApproach(bollard);
      const walk = Math.hypot(c.x - this.crew.x, c.z - this.crew.z) + Math.hypot(dest.x - c.x, dest.z - c.z);
      line.timer = 2.5 + walk / 1.4 + 1.5;
      line.pendingVia = 'crew';
      this.crewWalk([c, dest]);
      this.log(`${line.name}: podana na ląd – załoga zakłada na ${bollard.label.toLowerCase()}`);
    } else {
      line.pendingVia = 'deck';
      line.pendingLimit = this.lineReach(line, bollard) * 1.35;
      line.timer = line.mode === 'slip' || bollard.kind === 'ring' ? 3.0 : 2.2;
      line.lassoDist = opt.dist;
      this.log(`${line.name}: zakładanie z pokładu (${line.mode === 'slip' ? 'na biegowo' : 'oko na poler'})…`);
    }
  }

  pickupMooring(line, quiet = false) {
    if (!line.isMooring || line.state !== 'onQuay') return;
    if (!quiet) line.mooringQueued = true; // załoga podejmie muring sama, gdy jacht podejdzie
    const mur = line.muring;
    // koniec jachtu przy kei musi być blisko linki pilotowej
    const b = this.boat;
    const endX = this.H.berth.bowIn ? b.xb : b.xs;
    const e = localToWorld(b.x, b.z, b.th, endX, 0);
    let d = Math.hypot(e.x - mur.pickup.x, e.z - mur.pickup.z);
    if (this.crew.ashore) d = Math.min(d, Math.hypot(this.crew.x - mur.pickup.x, this.crew.z - mur.pickup.z) + Math.max(0, Math.hypot(e.x - this.crew.x, e.z - this.crew.z) - 4));
    if (d > 3.5) {
      if (!quiet) this.log(`Muring: linka pilotowa ${d.toFixed(1)} m od jachtu – załoga podejmie ją, gdy podejdziesz na ~3 m`);
      return;
    }
    line.mooringQueued = false;
    line.state = 'pending';
    line.pendingVia = 'mooring';
    line.pendingTarget = mur;
    line.timer = 5 + this.spec.loa / 1.6;
    this.log('Muring: załoga podejmuje linkę pilotową i przechodzi z nią na drugi koniec jachtu…');
  }

  release(line) {
    if (line.state === 'queued') {
      line.state = 'ready';
      line.queuedTarget = null;
      this.log(`${line.name}: anulowano zakładanie`);
      return;
    }
    if (line.state === 'onQuay') { line.mooringQueued = false; return; }
    if (line.state === 'pending') {
      line.mooringQueued = false;
      line.state = line.isMooring ? 'onQuay' : 'ready';
      this.log(`${line.name}: przerwano zakładanie`);
      return;
    }
    if (line.state !== 'attached') return;
    if (line.isMooring) {
      line.state = 'sinking';
      line.timer = 14;
      line.sinkFrom = this.leadWorld(line);
      line.target = line.muring;
      this.log('Muring oddany – tonie. Nie włączaj biegu przez kilka sekund, żeby nie złapać go na śrubę!', 'warn');
      return;
    }
    if (line.mode === 'slip') {
      line.state = 'retrieving';
      line.timer = 1.5 + line.rest / 1.6;
      line.retrieveFrom = line.target;
      this.log(`${line.name}: oddana – wybieranie na pokład`);
      return;
    }
    // na stałe – trzeba zdjąć oko z polera
    const lead = this.leadWorld(line);
    const t = this.targetPoint(line);
    const dReach = Math.hypot(t.x - lead.x, t.y - lead.y, t.z - lead.z);
    if (dReach < 1.3) {
      if (line.tension > 400) return this.log(`${line.name}: lina napięta – najpierw poluzuj`, 'warn');
      line.state = 'retrieving';
      line.timer = 2;
      line.retrieveFrom = line.target;
      this.log(`${line.name}: zdjęta z polera z pokładu`);
      return;
    }
    if (!this.crew.ashore) {
      if (this.canStepAshore()) this.crewAshore(true);
      else {
        line.releaseQueued = true;
        this.log(`${line.name}: oko jest na polerze – załoga zejdzie i je zdejmie, gdy jacht będzie przy kei`);
        return;
      }
    }
    line.releaseQueued = false;
    line.state = 'waitingCrew';
    line.timer = 0;
    this.crewWalk([this.bollardApproach(line.target)], { line });
    this.log(`${line.name}: załoga idzie zdjąć oko z polera`);
  }

  bollardApproach(b) {
    if (b.z > 1) return { x: b.x, z: b.z }; // pierścień na Y-bomie
    return { x: b.x, z: b.z - 0.6 };
  }

  // Przełożenie liny na biegowo / na stałe (tylko gdy przygotowana)
  toggleMode(line) {
    if (line.isMooring) return;
    if (line.state === 'ready') {
      line.mode = line.mode === 'slip' ? 'fixed' : 'slip';
      line.rest = line.length;
      return;
    }
    if (line.state === 'attached' && !this.crew.ashore && this.canStepAshore()) this.crewAshore(true);
    if (line.state === 'attached' && this.crew.ashore) {
      // załoga przekłada cumę
      line.mode = line.mode === 'slip' ? 'fixed' : 'slip';
      const lead = this.leadWorld(line), t = this.targetPoint(line);
      const d = Math.hypot(t.x - lead.x, t.y - lead.y, t.z - lead.z);
      line.rest = Math.min(line.length, d * (line.mode === 'slip' ? 2 : 1) + 0.1);
      if (d * (line.mode === 'slip' ? 2 : 1) > line.length) {
        line.mode = 'fixed';
        return this.log(`${line.name}: za krótka, by założyć na biegowo`, 'warn');
      }
      this.log(`${line.name}: przełożona ${line.mode === 'slip' ? 'na biegowo' : 'na stałe'}`);
    } else if (line.state === 'attached') {
      this.log('Przełożenie założonej cumy wymaga załogi na lądzie', 'warn');
    }
  }

  setTending(line, mode) {
    if (line.state === 'broken') return;
    line.tending = mode;
  }

  crewAshore(auto = false) {
    if (this.crew.ashore) return this.log('Załoga już jest na lądzie');
    const b = this.boat;
    if (b.speed > 0.7) return this.log('Za szybko, by bezpiecznie zejść na ląd (max ~1.3 kn)', 'warn');
    const best = this.shoreSpot();
    const maxD = this.H.method === 'longside' ? 1.0 : 1.3;
    if (!best || best.d > maxD) return this.log(`Za daleko do kei, by zejść (${best ? best.d.toFixed(1) : '—'} m, max ${maxD} m)`, 'warn');
    this.crew.ashore = true;
    this.crew.x = best.x; this.crew.z = best.z;
    this.crew.task = null;
    this.crew.boardWarned = false;
    this.crew.manual = !auto; // zejście na polecenie gracza – bez automatycznego powrotu
    this.log(`${best.kind === 'boom' ? 'Załoga zeszła na Y-bom' : 'Załoga zeszła na ląd'}${auto ? ' (sama – do obsługi lin)' : ''}`);
  }

  // Czy załoga na lądzie ma jeszcze coś do zrobienia przy linach
  crewNeededAshore() {
    return this.lines.some((l) =>
      l.state === 'waitingCrew' || l.releaseQueued ||
      (l.state === 'pending' && l.pendingVia === 'crew') ||
      (l.state === 'queued' && l.queuedTarget && this.onFoot(l.queuedTarget)) ||
      (l.state === 'attached' && l.mode === 'fixed' && !l.isMooring && this.cfg.scenario === 'unmoor'));
  }

  crewAboard() {
    if (!this.crew.ashore) return;
    const b = this.boat;
    const poly = this.boatPolyWorld();
    const r = distToPoly(poly, this.crew.x, this.crew.z);
    if (r.dist > 1.6) return this.log(`Jacht za daleko od załogi (${r.dist.toFixed(1)} m)`, 'warn');
    if (b.speed > 0.8) return this.log('Jacht porusza się za szybko, by bezpiecznie wejść', 'warn');
    if (this.lines.some((l) => l.state === 'waitingCrew' || (l.state === 'pending' && l.pendingVia === 'crew'))) return this.log('Załoga jest zajęta liną', 'warn');
    this.crew.ashore = false;
    this.crew.task = null;
    this.crew.manual = false;
    this.log('Załoga na pokładzie');
  }

  boatPolyWorld() {
    const b = this.boat;
    return b.outline.map(([lx, ly]) => { const p = localToWorld(b.x, b.z, b.th, lx, ly); return [p.x, p.z]; });
  }

  // ---------- Odbijacze ----------
  fenderPoints() {
    const b = this.boat, sp = this.spec, rf = this.equip.fenderRadius;
    const pts = [];
    for (const f of this.equip.fenders) {
      if (f.stern) {
        if (!this.fenderOut.stern) continue;
        const lx = b.xs - rf * 0.9, ly = f.side * sp.beam * 0.28;
        pts.push({ id: f.id, lx, ly, r: rf, n: { x: -1, y: 0 } });
        continue;
      }
      if (f.side < 0 && !this.fenderOut.port) continue;
      if (f.side > 0 && !this.fenderOut.starboard) continue;
      const hb = halfBeamAt(sp, f.x);
      const n = hullNormalAt(sp, f.x, f.side);
      pts.push({ id: f.id, lx: f.x + n.x * rf, ly: f.side * hb + n.y * rf, r: rf, n });
    }
    return pts;
  }

  // ---------- Kontakty ----------
  computeContacts(dt) {
    const b = this.boat, sp = this.spec;
    const m = sp.displacement;
    const kHull = m * 70, cHull = 2 * 0.45 * Math.sqrt(kHull * m);
    const kF = 26000 * (m / 6300), cF = 2 * 0.35 * Math.sqrt(kF * m);
    const R = sp.loa * 0.6 + 2;
    const near = this.obstacles.filter((o) => !(b.x + R < o.box.minX || b.x - R > o.box.maxX || b.z + R < o.box.minZ || b.z - R > o.box.maxZ));
    const contacts = [];
    const newContact = new Map();
    let hullContact = false;

    const applyAt = (px, pz, nx, nz, depth, k, c, kind, key, rf) => {
      const rx = px - b.x, rz = pz - b.z;
      const vx = b.vx - b.r * rz, vz = b.vz + b.r * rx;
      const vn = vx * nx + vz * nz; // <0 zbliżanie
      let Fn;
      if (kind === 'fender') {
        const q = depth / rf;
        Fn = k * depth * (1 + 6 * q * q) - c * vn;
      } else Fn = k * depth - c * vn;
      if (Fn < 0) Fn = 0;
      // tarcie
      const tx = -nz, tz = nx;
      const vt = vx * tx + vz * tz;
      const mu = kind === 'fender' ? 0.45 : 0.3;
      const Ft = -mu * Fn * vt / (Math.abs(vt) + 0.05);
      b.addWorldForce(px, pz, nx * Fn + tx * Ft, nz * Fn + tz * Ft);
      contacts.push({ x: px, z: pz, kind, F: Fn, key });
      const was = this.prevContact.get(key);
      newContact.set(key, true);
      if (!was && -vn > 0.05) {
        const sp_ = -vn;
        if (kind === 'hull') {
          if (sp_ > 0.12) {
            this.stats.hullHits++;
            this.stats.maxHit = Math.max(this.stats.maxHit, sp_);
            this.log(`Uderzenie kadłubem! (${(sp_ / KN).toFixed(1)} kn)`, 'bad');
            if (this.onImpact) this.onImpact(sp_, 'hull', px, pz);
          }
        } else if (sp_ > 0.45) {
          this.stats.hardFender++;
          this.log(`Mocne uderzenie w odbijacz (${(sp_ / KN).toFixed(1)} kn)`, 'warn');
          if (this.onImpact) this.onImpact(sp_, 'fender', px, pz);
        } else if (this.onImpact) this.onImpact(sp_, 'soft', px, pz);
      }
    };

    // 1) punkty kadłuba w przeszkodach
    const outline = b.outline;
    for (let i = 0; i < outline.length; i++) {
      const [lx, ly] = outline[i];
      const p = localToWorld(b.x, b.z, b.th, lx, ly);
      for (let j = 0; j < near.length; j++) {
        const o = near[j];
        if (p.x < o.box.minX || p.x > o.box.maxX || p.z < o.box.minZ || p.z > o.box.maxZ) continue;
        const hit = pointInConvex(o.poly, p.x, p.z);
        if (hit) {
          hullContact = true;
          applyAt(p.x, p.z, hit.nx, hit.nz, hit.depth, kHull, cHull, 'hull', `h${i}_${j}`);
        }
      }
    }
    // 2) wierzchołki przeszkód w kadłubie
    const hp = this.boatPolyWorld();
    for (let j = 0; j < near.length; j++) {
      const o = near[j];
      for (let k = 0; k < o.poly.length; k++) {
        const [vx, vz] = o.poly[k];
        if (Math.hypot(vx - b.x, vz - b.z) > sp.loa * 0.6) continue;
        const hit = pointInConvex(hp, vx, vz);
        if (hit) {
          hullContact = true;
          // siła na jacht w kierunku przeciwnym do normalnej kadłuba
          applyAt(vx, vz, -hit.nx, -hit.nz, hit.depth, kHull, cHull, 'hull', `v${j}_${k}`);
        }
      }
    }
    // 3) odbijacze
    const fps = this.fenderPoints();
    for (const f of fps) {
      const p = localToWorld(b.x, b.z, b.th, f.lx, f.ly);
      let comp = 0;
      for (let j = 0; j < near.length; j++) {
        const o = near[j];
        if (p.x < o.box.minX - f.r || p.x > o.box.maxX + f.r || p.z < o.box.minZ - f.r || p.z > o.box.maxZ + f.r) continue;
        if (o.kind === 'shallow') continue;
        const r = distToPoly(o.poly, p.x, p.z);
        if (r.dist < f.r) {
          const depth = f.r - r.dist;
          comp = Math.max(comp, depth / f.r);
          const cx = p.x - r.nx * r.dist, cz = p.z - r.nz * r.dist;
          applyAt(cx, cz, r.nx, r.nz, depth, kF, cF, 'fender', `f${f.id}_${j}`, f.r);
        }
      }
      this.fenderState[f.id] = comp;
    }
    this.prevContact = newContact;
    this.contacts = contacts;
    this.hullContact = hullContact;
  }

  // ---------- Pętla ----------
  update(realDt) {
    this.acc += Math.min(realDt, 0.1);
    let n = 0;
    while (this.acc >= DT && n < 60) {
      this.step(DT);
      this.acc -= DT;
      n++;
    }
  }

  step(dt) {
    this.time += dt;
    const b = this.boat;
    this.env.update(dt);

    if (this.engineDead) { b.throttle = 0; }

    // liny
    for (const line of this.lines) this.stepLine(line, dt);
    // liny oddane (wybrane na pokład), zatopiony muring i zerwane znikają z listy
    if (this.lines.some((l) => l.done)) this.lines = this.lines.filter((l) => !l.done);
    // kontakty
    this.computeContacts(dt);
    // jacht
    const prevTrip = b.bowTrip || b.sternTrip;
    b.step(dt, this.env);
    if (!prevTrip && (b.bowTrip || b.sternTrip)) {
      this.stats.overheat++;
      this.log('Ster strumieniowy przegrzany – zabezpieczenie termiczne wyłączyło silnik!', 'bad');
    }
    // załoga
    this.stepCrew(dt);
    if (this.autoCrew !== false) this.stepAutoCrew(dt);
    // ocena
    this.evaluate(dt);
  }

  stepLine(line, dt) {
    const b = this.boat;
    if (line.state === 'pending') {
      line.timer -= dt;
      if (line.pendingVia === 'deck') {
        const lead = this.leadWorld(line);
        const t = this.targetPoint(line, line.pendingTarget);
        const d = Math.hypot(t.x - lead.x, t.y - lead.y, t.z - lead.z);
        if (d > line.pendingLimit) {
          line.state = 'ready';
          this.log(`${line.name}: nie udało się – jacht odszedł za daleko`, 'warn');
          return;
        }
      }
      if (line.timer <= 0) {
        if (line.pendingVia === 'deck' && line.mode === 'fixed' && line.pendingTarget.kind !== 'ring') {
          // rzut okiem liny – może chybić
          const p = 1 - 0.55 * Math.pow(clamp(line.lassoDist / 3.4, 0, 1), 3);
          if (this.random() > p) {
            // załoga zbiera linę i rzuca ponownie
            line.state = 'queued';
            line.queuedTarget = line.pendingTarget;
            line.queueTimer = -1.5;
            this.stats.lassoMiss++;
            this.log(`${line.name}: chybiony rzut – załoga zbiera linę i rzuca jeszcze raz`, 'warn');
            return;
          }
        }
        line.target = line.pendingTarget;
        line.state = 'attached';
        line.tending = 'hold';
        const lead = this.leadWorld(line);
        const t = this.targetPoint(line);
        const d = Math.hypot(t.x - lead.x, t.y - lead.y, t.z - lead.z);
        const parts = line.mode === 'slip' && !line.isMooring ? 2 : 1;
        line.rest = Math.min(line.length, d * parts + (line.isMooring ? 2.5 : 0.4));
        line.maxTension = 0;
        if (line.isMooring) this.log('Muring na knadze – wybieraj, aby naprężyć', 'good');
        else this.log(`${line.name}: założona ${line.mode === 'slip' ? 'na biegowo' : 'na stałe'} (${line.target.label.toLowerCase()})`, 'good');
      }
      return;
    }
    if (line.state === 'retrieving') {
      line.timer -= dt;
      if (line.timer <= 0) { line.state = 'ready'; line.target = null; line.rest = line.length; line.tension = 0; line.done = true; this.log(`${line.name}: na pokładzie`); }
      return;
    }
    if (line.state === 'sinking') {
      line.timer -= dt;
      // ryzyko wkręcenia muringu w śrubę
      if (b.gear !== 0 && !this.engineDead) {
        const pp = localToWorld(b.x, b.z, b.th, b.xProp, 0);
        const m = line.muring;
        const c = closestOnSegment(m.pickup.x, m.pickup.z, m.anchor.x, m.anchor.z, pp.x, pp.z);
        const d = Math.hypot(pp.x - c.x, pp.z - c.z);
        const sinkF = line.timer / 14;
        if (d < 1.2 + sinkF * 1.5 && Math.abs(b.rpm) > 0.2) {
          this.engineDead = true;
          this.stats.fouled = true;
          b.gear = 0; b.rpm = 0;
          this.log('Muring wkręcony w śrubę! Silnik zgasł.', 'bad');
        }
      }
      if (line.timer <= 0) { line.state = 'onQuay'; line.target = null; line.done = true; }
      return;
    }
    if (line.state === 'broken') {
      line.timer -= dt;
      if (line.timer <= 0) line.done = true;
    }
    if (line.state !== 'attached') { line.tension = 0; return; }

    tendLine(line, dt, this.lineParams);

    const lead = this.leadWorld(line);
    const t = this.targetPoint(line);
    const pv = b.pointVel(lead.lx, lead.ly);
    const dx = t.x - lead.x, dy = t.y - lead.y, dz = t.z - lead.z;
    const d3 = Math.hypot(dx, dy, dz) || 1e-6;
    // prędkość wydłużania (punkt na jachcie oddala się od celu)
    const rel = -(pv.x * dx + pv.z * dz) / d3;
    const f = lineForce(line, lead, t, rel, this.lineParams, dt);
    if (f.T > 0) b.addWorldForce(lead.x, lead.z, f.fx, f.fz);
    line.maxTension = Math.max(line.maxTension, f.T);

    // półkluza – lina może wyskoczyć przy dużym kącie
    const lc = this.leadLocal(line);
    const fl = line.fairleadId ? this.deckItem(line.fairleadId) : null;
    if (fl && fl.kind === 'halfFairlead' && f.T > 200) {
      const dirL = worldToLocal(0, 0, b.th, dx, dz);
      const n = hullNormalAt(this.spec, fl.x, Math.sign(fl.y) || 1);
      const cosA = (dirL.x * n.x + dirL.y * n.y) / (Math.hypot(dirL.x, dirL.y) || 1);
      if (!line.jumped && cosA < -0.2) {
        line.jumped = true;
        this.log(`${line.name}: lina wyskoczyła z półkluzy!`, 'warn');
      } else if (line.jumped && cosA > 0.3) line.jumped = false;
    }

    if (f.T > this.lineParams.breakLoad) {
      line.state = 'broken';
      line.timer = 4; // widoczna chwilę na liście, potem znika
      line.tension = 0;
      this.stats.breaks++;
      this.log(`${line.name} ZERWANA! (${(f.T / 1000).toFixed(1)} kN)`, 'bad');
      if (this.onImpact) this.onImpact(2, 'snap', lead.x, lead.z);
    }
  }

  // Załoga działa sama: ponawia zaplanowane liny, schodzi na ląd i wraca na pokład, gdy trzeba
  stepAutoCrew(dt) {
    this.autoTimer = (this.autoTimer || 0) + dt;
    if (this.autoTimer < 0.25) return;
    const tick = this.autoTimer;
    this.autoTimer = 0;
    const c = this.crew;
    // 1) liny czekające na zasięg
    for (const line of this.lines) {
      if (line.state === 'queued') {
        line.queueTimer = (line.queueTimer || 0) + tick;
        if (line.queueTimer < 0) continue;
        this.attach(line, line.queuedTarget, true);
        if (line.state === 'queued' && !c.ashore && this.onFoot(line.queuedTarget) && this.canStepAshore()) {
          this.crewAshore(true);
          this.attach(line, line.queuedTarget, true);
        }
      } else if (line.state === 'onQuay' && line.mooringQueued) {
        this.pickupMooring(line, true);
      } else if (line.state === 'attached' && line.releaseQueued) {
        if (c.ashore || this.canStepAshore()) this.release(line);
      }
    }
    // 2) powrót na pokład, gdy na lądzie nic już nie trzeba robić
    if (c.ashore && !c.manual && !c.task && !this.crewNeededAshore()) {
      const s = this.shoreSpot();
      if (s && Math.hypot(s.x - c.x, s.z - c.z) > 0.3) this.crewWalk([s], { board: true });
      else if (s && s.d <= 1.6 && this.boat.speed < 0.8) {
        c.ashore = false;
        c.task = null;
        this.log('Załoga wróciła na pokład');
      } else if (!c.boardWarned && s && s.d > 1.6) {
        c.boardWarned = true;
        this.log(`Załoga czeka na kei na powrót jachtu (${s.d.toFixed(1)} m od burty)`, 'warn');
      }
    }
  }

  stepCrew(dt) {
    const c = this.crew;
    if (!c.ashore) return;
    const task = c.task;
    if (!task) { c.walking = false; return; }
    if (task.type === 'walk') {
      const wp = task.path[0];
      const dx = wp.x - c.x, dz = wp.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.1) {
        const s = Math.min(d, 1.4 * dt);
        c.x += (dx / d) * s; c.z += (dz / d) * s;
        c.walking = true;
        c.heading = Math.atan2(dz, dx);
      } else if (task.path.length > 1) {
        task.path.shift();
      } else {
        c.walking = false;
        if (task.board) {
          // punkt zejścia mógł się przesunąć razem z jachtem – nowa trasa w następnym kroku
          c.task = null;
          return;
        }
        if (task.line && task.line.state === 'waitingCrew') {
          const line = task.line;
          line.timer += dt;
          if (line.tension > 450) {
            if (!line.warnedTension) { this.log(`${line.name}: lina napięta – załoga nie może zdjąć oka. Poluzuj!`, 'warn'); line.warnedTension = true; }
          } else if (line.timer > 1.5) {
            line.state = 'retrieving';
            line.timer = 2 + line.rest / 3;
            line.retrieveFrom = line.target;
            line.warnedTension = false;
            c.task = null;
            this.log(`${line.name}: zdjęta z polera, podana na jacht`);
          }
        } else c.task = null;
      }
    }
  }

  // ---------- Ocena ----------
  berthError() {
    const b = this.boat, t = this.H.berth;
    const loc = worldToLocal(t.x, t.z, t.th, b.x, b.z);
    const dth = wrapPi(b.th - t.th) / DEG;
    return { along: loc.x, across: loc.y, dth };
  }

  evaluate(dt) {
    if (this.result) return;
    const b = this.boat;
    if (this.cfg.scenario === 'moor') {
      const e = this.berthError();
      const t = this.H.berth;
      const inPose = Math.abs(e.along) < t.tolAlong && Math.abs(e.across) < t.tolAcross && Math.abs(e.dth) < t.tolTh;
      const att = this.lines.filter((l) => l.state === 'attached');
      const needed = this.H.method === 'longside' ? 2 : 3;
      const tensioned = att.filter((l) => l.tension > 80 || l.slack < 0.6).length;
      const still = b.speed < 0.15 && Math.abs(b.r) < 0.02;
      this.poseOk = inPose;
      this.linesOk = att.length >= needed && tensioned >= 2;
      if (inPose && this.linesOk && still && !this.hullContact) {
        this.successTimer += dt;
        if (this.successTimer > 6) this.finish(true);
      } else this.successTimer = 0;
    } else {
      const t = this.H.berth;
      const d = Math.hypot(b.x - t.x, b.z - t.z);
      const anyAttached = this.lines.some((l) => ['attached', 'pending', 'waitingCrew', 'retrieving', 'queued'].includes(l.state));
      this.poseOk = d > this.spec.loa * 2.2;
      this.linesOk = !anyAttached && !this.crew.ashore;
      if (this.poseOk && this.linesOk && !this.hullContact) {
        this.successTimer += dt;
        if (this.successTimer > 3) this.finish(true);
      } else this.successTimer = 0;
    }
  }

  finish(ok) {
    const s = this.stats;
    let score = 100;
    score -= s.hullHits * 15;
    score -= s.hardFender * 5;
    score -= s.breaks * 20;
    score -= s.overheat * 5;
    score -= s.lassoMiss * 1;
    if (s.fouled) score -= 30;
    score -= Math.max(0, (this.time - 180) / 20);
    score = Math.round(clamp(score, 0, 100));
    this.result = { ok, score, time: this.time, stats: { ...s } };
    this.log(ok ? (this.cfg.scenario === 'moor' ? 'Zacumowano!' : 'Odcumowano – jacht wolny!') : 'Koniec', ok ? 'good' : 'bad');
    if (this.onFinish) this.onFinish(this.result);
  }
}

export { LINE_STATE_LABEL };
