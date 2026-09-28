// Środowisko: wiatr (z porywami i skrętami) oraz prąd wody
import { DEG, KN, smoothNoise, compassVec } from '../math.js';

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
    // porywy: wolne zmiany + szybsze szkwały
    const slow = this.nSpeed(this.t * 0.35);
    const fast = this.nSpeed2(this.t * 1.3);
    let f = 1 + g * (0.45 * slow + 0.25 * fast);
    if (f < 0.3) f = 0.3;
    this.gustFactor = f;
    this.dirOffset = g * 12 * this.nDir(this.t * 0.25) * DEG; // skręty wiatru
  }

  // aktualny kierunek "z którego wieje" w stopniach
  get windFromDeg() {
    return this.w.windFrom + this.dirOffset / DEG;
  }
  get windSpeed() {
    return this.w.windKn * KN * this.gustFactor;
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
