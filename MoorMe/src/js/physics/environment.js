// Środowisko: wiatr (z porywami i skrętami) oraz prąd wody
import { DEG, KN, smoothNoise, compassVec, rng } from '../math.js';

export class Environment {
  // weather: { windKn, windFrom (deg), gust (0..1), currentKn, currentTo (deg) }
  constructor(weather) {
    this.w = { ...weather };
    this.t = 0;
    this.nSpeed = smoothNoise(11);
    this.nSpeed2 = smoothNoise(23);
    this.nDir = smoothNoise(37);
    this.gustFactor = 1;
    this.dirOffset = 0;
    this.update(0);
  }

  update(dt) {
    this.t += dt;
    const g = this.w.gust || 0;
    // tło: drobna, nieregularna zmienność siły wiatru
    const slow = this.nSpeed(this.t * 0.21), fast = this.nSpeed2(this.t * 0.9);
    // pojedyncze porywy w losowych odstępach: narastanie 2–4 s, utrzymanie 2–7 s, słabnięcie 4–8 s
    if (!this.gr) { this.gr = rng(97); this.gNext = 8 + this.gr() * 20; this.gEv = null; }
    if (dt > 0) {
      if (!this.gEv && this.t >= this.gNext && g > 0) {
        const r = this.gr;
        this.gEv = { t0: this.t, up: 2 + r() * 2, hold: 2 + r() * 5, down: 4 + r() * 4, amp: g * (0.12 + r() * 0.2) * (r() < 0.25 ? -0.6 : 1) }; // czasem chwilowe osłabnięcie
      }
      if (this.gEv) {
        const e = this.gEv, u = this.t - e.t0;
        if (u > e.up + e.hold + e.down) { this.gEv = null; this.gNext = this.t + (20 + this.gr() * 50) * (1.2 - 0.5 * g); }
      }
    }
    let env = 0;
    if (this.gEv) {
      const e = this.gEv, u = this.t - e.t0;
      const sm = (x) => x * x * (3 - 2 * x);
      env = u < e.up ? sm(u / e.up) : u < e.up + e.hold ? 1 : sm(Math.max(0, 1 - (u - e.up - e.hold) / e.down));
      env *= e.amp;
    }
    let f = 1 + g * (0.1 * slow + 0.04 * fast) + env;
    if (f < 0.5) f = 0.5;
    this.gustFactor = f;
    this.dirOffset = g * 9 * this.nDir(this.t * 0.12) * DEG; // powolne, nieregularne skręty wiatru
  }

  // aktualny kierunek "z którego wieje" w stopniach
  get windFromDeg() {
    return this.w.windFrom + this.dirOffset / DEG;
  }
  get windSpeed() {
    // maxKn – górny limit razem z porywami (np. trening locji: najwyżej 5 kn)
    return Math.min(this.w.windKn * this.gustFactor, this.w.maxKn ?? Infinity) * KN;
  }
  // Wektor prędkości wiatru (dokąd wieje) w świecie, m/s
  windVec() {
    const d = compassVec(this.windFromDeg + 180);
    const s = this.windSpeed;
    return { x: d.x * s, z: d.z * s };
  }
  currentVec() {
    if (!this.w.currentKn) return { x: 0, z: 0 };
    const d = compassVec(this.w.currentTo || 0);
    const s = this.w.currentKn * KN;
    return { x: d.x * s, z: d.z * s };
  }
}
