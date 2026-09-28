// Model dynamiki jachtu (3 stopnie swobody: posuw, dryf boczny, obrót)
// Siły: opór kadłuba, kil i płetwy sterowe (model płaskiej płyty), napór wiatru,
// śruba z efektem zarzucania rufy (prop walk), strumień zaśrubowy na sterze,
// stery strumieniowe, siły zewnętrzne (liny, odbijacze, kontakty).
import { DEG, KN, clamp, sign, vecToBody, vecToWorld } from '../math.js';
import { hullExtents, hullOutline, halfBeamAt } from '../data/boats.js';

const RHO_W = 1025;
const RHO_A = 1.225;

// Współczynnik siły normalnej płaskiej płyty (płetwa o małym wydłużeniu)
function plateCN(alpha) {
  const a = Math.abs(alpha);
  const stallA = 0.38;
  if (a < stallA) return 3.3 * a;
  // po przeciągnięciu spadek do ~1.0 przy 90°
  const peak = 3.3 * stallA;
  const t = (a - stallA) / (Math.PI / 2 - stallA);
  return peak * (1 - 0.35 * Math.sin(t * Math.PI / 2)) * (0.8 + 0.2 * Math.cos(t * Math.PI));
}

// Siła na płycie ustawionej pod kątem delta (0 = wzdłuż osi łodzi), płyn napływa z prędkością (-ur, -vr)
function plateForce(area, ur, vr, delta) {
  const wx = -ur, wy = -vr;
  const w2 = wx * wx + wy * wy;
  if (w2 < 1e-8) return { x: 0, y: 0 };
  const w = Math.sqrt(w2);
  const nx = Math.sin(delta), ny = Math.cos(delta); // normalna płyty
  const wn = wx * nx + wy * ny;
  const alpha = Math.asin(clamp(Math.abs(wn) / w, 0, 1));
  const F = 0.5 * RHO_W * area * w2 * plateCN(alpha) * sign(wn);
  return { x: F * nx, y: F * ny };
}

export class BoatPhysics {
  constructor(spec, equip) {
    this.spec = spec;
    this.equip = equip;
    const L = spec.loa;
    const m = spec.displacement;
    this.m = m;
    this.mx = m * 1.08;
    this.my = m * 1.65;
    this.Iz = m * Math.pow(0.26 * L, 2) * 1.35;
    const ext = hullExtents(spec);
    this.xs = ext.xs;
    this.xb = ext.xb;
    this.outline = hullOutline(spec);

    // Położenia elementów
    this.xKeel = 0.02 * L;
    this.xRudder = ext.xs + 0.07 * L;
    this.yRudder = spec.beam * 0.28; // podwójne płetwy – przesunięte od osi
    this.xProp = equip.drive === 'shaft' ? ext.xs + 0.15 * L : ext.xs + 0.2 * L;
    this.xBow = ext.xb - 0.1 * L;
    this.xStern = ext.xs + 0.08 * L;

    // Napęd
    this.hp = spec.engineHp;
    this.Tmax = 82 * spec.engineHp * Math.pow(spec.propDiameter / 0.4, 0.3); // uciąg na uwięzi [N]
    this.vmax = spec.maxSpeedKn * KN;
    this.Xu = m * 0.03;
    this.Xuu = (this.Tmax * 0.72 - this.Xu * this.vmax) / (this.vmax * this.vmax);
    this.propArea = Math.PI * Math.pow(spec.propDiameter / 2, 2);
    // Podwójne płetwy sterowe są poza osią – strumień zaśrubowy trafia w nie słabo
    this.washFrac = equip.drive === 'shaft' ? 0.22 : 0.16;
    this.propWalk = equip.drive === 'shaft' ? 0.36 : 0.24;
    this.propHandSign = equip.propHand === 'left' ? -1 : 1;

    // Pasy kadłuba do oporu poprzecznego
    this.strips = [];
    const N = 10;
    for (let i = 0; i < N; i++) {
      const x = this.xs + (this.xb - this.xs) * ((i + 0.5) / N);
      const t = (x - this.xs) / (this.xb - this.xs);
      const depth = spec.canoeDraft * (t > 0.85 ? (1 - t) / 0.15 : t < 0.08 ? 0.6 : 1);
      this.strips.push({ x, area: ((this.xb - this.xs) / N) * depth });
    }

    this.reset(0, 0, 0);
  }

  reset(x, z, th) {
    this.x = x; this.z = z; this.th = th;
    this.vx = 0; this.vz = 0; this.r = 0;
    this.throttle = 0;       // dźwignia -1..1
    this.rpm = 0;            // 0..1 (względne obroty)
    this.gear = 0;           // -1, 0, 1
    this.gearTimer = 0;
    this.rudder = 0;         // rad, + = ster na prawą burtę (dziób w prawo)
    this.rudderCmd = 0;
    this.bowCmd = 0;         // -1 (w lewo) .. 1 (w prawo)
    this.sternCmd = 0;
    this.bowOut = 0; this.sternOut = 0;
    this.bowHeat = 0; this.sternHeat = 0;
    this.bowTrip = false; this.sternTrip = false;
    this.thrust = 0;
    this.walkForce = 0;
    this.extFx = 0; this.extFz = 0; this.extN = 0;
    this.dbg = {};
  }

  // Prędkość punktu lokalnego w świecie
  pointVel(lx, ly) {
    const c = Math.cos(this.th), s = Math.sin(this.th);
    const rx = lx * c - ly * s, rz = lx * s + ly * c;
    return { x: this.vx - this.r * rz, z: this.vz + this.r * rx };
  }

  // Siła zewnętrzna w świecie przyłożona w punkcie świata
  addWorldForce(px, pz, fx, fz) {
    this.extFx += fx;
    this.extFz += fz;
    const rx = px - this.x, rz = pz - this.z;
    this.extN += rx * fz - rz * fx;
  }

  get speed() { return Math.hypot(this.vx, this.vz); }
  get u() { return vecToBody(this.th, this.vx, this.vz).u; }

  step(dt, env) {
    const spec = this.spec;
    const L = spec.loa;

    // --- Silnik i sprzęgło ---
    const lever = clamp(this.throttle, -1, 1);
    const neutral = 0.08;
    const wantGear = Math.abs(lever) < neutral ? 0 : sign(lever);
    if (wantGear !== this.gear) {
      // zmiana biegu tylko na niskich obrotach
      if (this.rpm < 0.35) {
        this.gearTimer += dt;
        if (this.gearTimer > 0.45) { this.gear = wantGear; this.gearTimer = 0; }
      }
    } else this.gearTimer = 0;
    const idle = 0.3;
    let rpmTarget = idle + (1 - idle) * clamp((Math.abs(lever) - neutral) / (1 - neutral), 0, 1);
    if (wantGear !== this.gear) rpmTarget = idle;
    const tc = rpmTarget > this.rpm ? 0.9 : 0.6;
    this.rpm += (rpmTarget - this.rpm) * clamp(dt / tc, 0, 1);

    // --- Prędkości względem wody ---
    const cur = env.currentVec();
    const rel = vecToBody(this.th, this.vx - cur.x, this.vz - cur.z);
    const u = rel.u, v = rel.v, r = this.r;

    // --- Ciąg śruby ---
    let T = 0;
    if (this.gear !== 0) {
      const n = this.rpm;
      const base = this.Tmax * n * n;
      if (this.gear > 0) T = base * clamp(1 - 0.28 * u / this.vmax, 0.4, 1.3);
      else T = -base * 0.62 * clamp(1 + 0.25 * u / this.vmax, 0.4, 1.3);
    }
    this.thrust = T;

    let X = 0, Y = 0, N = 0;
    X += T;

    // Zarzucanie rufy: śruba prawoskrętna na wstecznym rzuca rufę w lewo
    let walk = 0;
    if (T < 0) {
      walk = -this.propHandSign * this.propWalk * Math.abs(T) / (1 + Math.pow(Math.abs(u) / 1.2, 2));
    } else if (T > 0) {
      walk = this.propHandSign * this.propWalk * 0.22 * T / (1 + Math.pow(Math.abs(u) / 1.5, 2));
    }
    this.walkForce = walk;
    Y += walk;
    N += this.xProp * walk;

    // --- Opór kadłuba wzdłużny ---
    X += -this.Xu * u - this.Xuu * u * Math.abs(u) * (u < 0 ? 1.4 : 1);

    // --- Opór poprzeczny kadłuba (pasy) ---
    for (const s of this.strips) {
      const vi = v + r * s.x;
      const f = -0.5 * RHO_W * 0.85 * s.area * vi * Math.abs(vi) - 30 * s.area * vi;
      Y += f;
      N += s.x * f;
    }
    // Tłumienie obrotu – dodatkowe (fale, wiry)
    N += -this.Iz * 0.06 * r - this.Iz * 0.25 * r * Math.abs(r);

    // --- Kil ---
    {
      const f = plateForce(spec.keelArea, u, v + r * this.xKeel, 0);
      X += f.x; Y += f.y; N += this.xKeel * f.y;
    }

    // --- Płetwy sterowe (dwie, połowa powierzchni każda) ---
    const rRate = 28 * DEG;
    const dr = clamp(this.rudderCmd - this.rudder, -rRate * dt, rRate * dt);
    this.rudder = clamp(this.rudder + dr, -35 * DEG, 35 * DEG);
    let ur = u;
    if (T > 0) {
      // strumień zaśrubowy (teoria pędu)
      const vw2 = u * u + (2 * T) / (RHO_W * this.propArea);
      const vw = Math.sqrt(Math.max(vw2, 0));
      ur = u + (vw - Math.max(u, 0)) * this.washFrac;
    }
    for (const side of [-1, 1]) {
      const yR = side * this.yRudder;
      const vloc = v + r * this.xRudder;
      const uloc = ur - r * yR;
      // płetwa zawietrzna (bardziej zanurzona) – uproszczone równe działanie
      const f = plateForce(spec.rudderArea / 2, uloc, vloc, this.rudder);
      X += f.x; Y += f.y;
      N += this.xRudder * f.y - yR * f.x;
    }

    // --- Wiatr ---
    const wv = env.windVec();
    const app = vecToBody(this.th, wv.x - this.vx, wv.z - this.vz); // wiatr pozorny (dokąd wieje) w układzie łodzi
    const va2 = app.u * app.u + app.v * app.v;
    if (va2 > 1e-6) {
      const va = Math.sqrt(va2);
      // kąt, z którego wieje, względem dziobu: 0 = w dziób
      const gamma = Math.atan2(-app.v, -app.u);
      const cg = Math.cos(gamma), sg = Math.sin(gamma);
      const q = 0.5 * RHO_A * va2;
      const Fx = -q * spec.windageFront * 0.75 * cg;
      const Fy = -q * spec.windageSide * 1.0 * sg * (0.85 + 0.15 * Math.abs(sg));
      // środek naporu – przed środkiem ciężkości (wysoki dziób, maszt), zależny od kąta
      const xce = L * (0.07 + 0.11 * cg);
      X += Fx; Y += Fy; N += xce * Fy;
      this.dbg.windF = Math.hypot(Fx, Fy);
      this.dbg.appWind = va;
      this.dbg.appAngle = gamma;
    }

    // --- Stery strumieniowe ---
    const effBT = 1 / (1 + Math.pow(Math.abs(u) / 1.1, 2.2));
    const stepThr = (kind) => {
      const cfg = kind === 'bow' ? this.equip.bowThruster : this.equip.sternThruster ? 'onoff' : 'none';
      if (!cfg || cfg === 'none') return 0;
      const cmdKey = kind + 'Cmd', outKey = kind + 'Out', heatKey = kind + 'Heat', tripKey = kind + 'Trip';
      let cmd = clamp(this[cmdKey], -1, 1);
      if (cfg === 'onoff') cmd = sign(Math.round(cmd * 2) / 2);
      if (this[tripKey]) cmd = 0;
      this[outKey] += (cmd - this[outKey]) * clamp(dt / 0.35, 0, 1);
      const act = Math.abs(this[outKey]);
      this[heatKey] += dt * (act > 0.05 ? act / 150 : -1 / 240);
      this[heatKey] = clamp(this[heatKey], 0, 1);
      if (this[heatKey] >= 1) this[tripKey] = true;
      if (this[tripKey] && this[heatKey] < 0.45) this[tripKey] = false;
      const maxF = kind === 'bow' ? spec.bowThrusterN : spec.sternThrusterN;
      return maxF * this[outKey] * effBT;
    };
    const fb = stepThr('bow');
    const fs = stepThr('stern');
    Y += fb + fs;
    N += this.xBow * fb + this.xStern * fs;

    // --- Siły zewnętrzne (liny, kontakty) – już w świecie ---
    const ext = vecToBody(this.th, this.extFx, this.extFz);
    X += ext.u; Y += ext.v; N += this.extN;
    this.extFx = 0; this.extFz = 0; this.extN = 0;

    // --- Całkowanie ---
    const au = X / this.mx;
    const av = Y / this.my;
    const aw = vecToWorld(this.th, au, av);
    this.vx += aw.x * dt;
    this.vz += aw.z * dt;
    this.r += (N / this.Iz) * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.th += this.r * dt;

    this.dbg.X = X; this.dbg.Y = Y; this.dbg.N = N;
  }

  // Kąt przechyłu (tylko wizualnie) od wiatru
  heelAngle() {
    const f = this.dbg.windF || 0;
    const ang = this.dbg.appAngle || 0;
    return clamp(-Math.sin(ang) * f / (this.m * 9.81) * 18, -0.12, 0.12);
  }

  halfBeamAt(x) { return halfBeamAt(this.spec, x); }
}
