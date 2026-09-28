// Liny cumownicze: cumy, szpringi, bresty, muring.
// Tryby: 'fixed' – oko założone na stałe na poler, 'slip' – na biegowo (lina wraca na jacht, można oddać z pokładu).
import { clamp } from '../math.js';
import { ROLE_NAMES } from '../data/harbors.js';

let LINE_ID = 1;

export const LINE_STATE_LABEL = {
  ready: 'Przygotowana',
  pending: 'Zakładanie…',
  attached: 'Założona',
  retrieving: 'Wybieranie na pokład…',
  onQuay: 'Linka pilotowa przy kei',
  sinking: 'Tonie (uwaga na śrubę!)',
  broken: 'ZERWANA',
  waitingCrew: 'Czeka na załogę…'
};

export const TENDING_LABEL = {
  hold: 'Obłożona',
  haul: 'Wybieranie',
  ease: 'Luzowanie',
  free: 'Luzem'
};

export function breakLoadFor(spec) {
  if (spec.loa < 12) return 30000;
  if (spec.loa < 15) return 48000;
  return 58000;
}

export class MooringLine {
  constructor(opts) {
    this.id = LINE_ID++;
    this.role = opts.role || 'bow';
    this.name = opts.name || ROLE_NAMES[this.role];
    this.cleatId = opts.cleatId;
    this.fairleadId = opts.fairleadId ?? null;
    this.length = opts.length || 15;
    this.mode = opts.mode || 'fixed';
    this.winch = !!opts.winch;
    this.state = opts.state || 'ready';
    this.target = null; // poler {id,x,z,h} lub muring
    this.rest = this.length;
    this.tending = 'hold';
    this.tension = 0;
    this.maxTension = 0;
    this.prevStretch = 0;
    this.jumped = false;
    this.timer = 0;
    this.pendingTarget = null;
    this.pendingLimit = 0;
    this.isMooring = this.role === 'mooring';
    this.muring = opts.muring || null;
    this.suggestedTarget = opts.suggestedTarget || null;
    this.sag = 0;
  }

  get label() { return `${this.name}`; }
  get attached() { return this.state === 'attached'; }
}

// Fizyka pojedynczej liny – zwraca siłę (świat) przyłożoną w punkcie mocowania na jachcie
export function lineForce(line, lead, tgt, relSpeed, params, dt) {
  // lead, tgt: {x,y,z}; relSpeed – prędkość wydłużania [m/s]
  const dx = tgt.x - lead.x, dy = tgt.y - lead.y, dz = tgt.z - lead.z;
  const d3 = Math.hypot(dx, dy, dz) || 1e-6;
  const dh = Math.hypot(dx, dz) || 1e-6;
  const parts = line.mode === 'slip' && !line.isMooring ? 2 : 1;
  const path = d3 * parts;
  const stretch = path - line.rest;
  let T = 0;
  if (stretch > 0) {
    const k = params.EA / Math.max(line.rest, 1.0);
    const m = params.mass;
    const c = 0.35 * 2 * Math.sqrt(k * m) / parts;
    T = k * stretch + c * relSpeed * parts;
    if (T < 0) T = 0;
  }
  line.tension = T; // naciąg w jednej części liny
  line.slack = Math.max(0, -stretch) / parts;
  line.dist = d3;
  const Ftot = T * parts;
  // składowa pozioma
  const fx = (Ftot * dx) / d3, fz = (Ftot * dz) / d3;
  return { fx, fz, T, d3, dh };
}

// Zmiana długości roboczej liny zgodnie z obsługą (wybieranie / luzowanie)
export function tendLine(line, dt, params) {
  const parts = line.mode === 'slip' && !line.isMooring ? 2 : 1;
  const maxRest = line.length;
  const minRest = 0.8;
  switch (line.tending) {
    case 'haul': {
      const cap = line.winch ? params.winchPull : params.handPull;
      const spd = line.winch ? params.winchSpeed : params.handSpeed;
      // wybieranie z luzem jest szybkie, pod obciążeniem zwalnia i staje przy limicie siły
      const load = line.tension / cap;
      const f = line.tension < 50 ? 1.6 : clamp(1 - load, 0, 1);
      line.rest -= spd * f * dt * parts;
      break;
    }
    case 'ease':
      line.rest += params.easeSpeed * dt * parts;
      break;
    case 'free':
      line.rest = maxRest;
      break;
    default:
      break;
  }
  line.rest = clamp(line.rest, minRest, maxRest);
}
