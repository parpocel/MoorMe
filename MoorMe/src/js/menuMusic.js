// Tło dźwiękowe menu (Web Audio): szum fal z wolnym „oddechem” i lekki wiatr – bez melodii.
// Nazwa i interfejs bez zmian (start / stop / refresh), głośność z ustawień muzyki.
import { getSettings } from './settings.js';

// szum o łagodnym widmie (brązowawy): kolejne próbki to wygładzony szum biały
function noiseBuffer(c, seconds, smooth) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = last * smooth + (Math.random() * 2 - 1) * (1 - smooth); d[i] = last; }
  let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  for (let i = 0; i < d.length; i++) d[i] /= peak || 1;
  return b;
}
const loop = (c, buf) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; return s; };
// wolna modulacja parametru: sinus o danej częstotliwości i głębokości
function lfo(c, freq, depth, target) { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = freq; g.gain.value = depth; o.connect(g); g.connect(target); o.start(); return o; }

class MenuMusic {
  constructor() { this.ctx = null; this.on = false; }

  init() {
    if (this.ctx) return true;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0;
    this.master.connect(c.destination);

    // fale: niski szum przez filtr dolnoprzepustowy; głośność i jasność „oddychają” jak napływające fale
    const sea = c.createGain(); sea.gain.value = 0.32;
    const seaLp = c.createBiquadFilter(); seaLp.type = 'lowpass'; seaLp.frequency.value = 480; seaLp.Q.value = 0.4;
    const seaSrc = loop(c, noiseBuffer(c, 6, 0.985));
    seaSrc.connect(seaLp); seaLp.connect(sea); sea.connect(this.master);
    lfo(c, 0.085, 0.16, sea.gain); lfo(c, 0.085, 180, seaLp.frequency); // fala narasta i opada co ok. 12 s
    lfo(c, 0.031, 0.06, sea.gain); // dłuższy rytm – co jakiś czas większa fala
    seaSrc.start();
    // drobne bryzgi przy brzegu: cichy, jaśniejszy szum w rytmie fal
    const foam = c.createGain(); foam.gain.value = 0.035;
    const foamBp = c.createBiquadFilter(); foamBp.type = 'bandpass'; foamBp.frequency.value = 2200; foamBp.Q.value = 0.6;
    const foamSrc = loop(c, noiseBuffer(c, 4, 0.2));
    foamSrc.connect(foamBp); foamBp.connect(foam); foam.connect(this.master);
    lfo(c, 0.085, 0.03, foam.gain);
    foamSrc.start();

    // lekki wiatr: szum pasmowy z powolnymi podmuchami i zmienną barwą
    const wind = c.createGain(); wind.gain.value = 0.05;
    const windBp = c.createBiquadFilter(); windBp.type = 'bandpass'; windBp.frequency.value = 650; windBp.Q.value = 0.9;
    const windSrc = loop(c, noiseBuffer(c, 5, 0.9));
    windSrc.connect(windBp); windBp.connect(wind); wind.connect(this.master);
    lfo(c, 0.045, 0.035, wind.gain); lfo(c, 0.13, 0.012, wind.gain); // podmuchy
    lfo(c, 0.06, 220, windBp.frequency); // wiatr „gwiżdże” raz wyżej, raz niżej
    windSrc.start();

    // przeglądarka może wstrzymać dźwięk do pierwszego kliknięcia
    const resume = () => { if (c.state === 'suspended') c.resume(); };
    window.addEventListener('pointerdown', resume, { capture: true });
    window.addEventListener('keydown', resume, { capture: true });
    return true;
  }

  volume() { const s = getSettings(); return s.music === false ? 0 : 0.5 * (s.musicVol ?? 0.5); }

  start() {
    if (this.volume() <= 0) { this.stop(); return; }
    if (!this.init()) return;
    const c = this.ctx;
    if (c.state === 'suspended') c.resume();
    this.master.gain.cancelScheduledValues(c.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, c.currentTime);
    this.master.gain.linearRampToValueAtTime(this.volume(), c.currentTime + 2.5);
    this.on = true;
  }

  stop(fade = 1.2) {
    if (!this.ctx || !this.on) return;
    const c = this.ctx;
    this.master.gain.cancelScheduledValues(c.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, c.currentTime);
    this.master.gain.linearRampToValueAtTime(0, c.currentTime + fade);
    this.on = false;
  }

  // zmiana głośności z ustawień w trakcie grania
  refresh() { if (this.on || this.volume() > 0) this.start(); if (this.volume() <= 0) this.stop(0.3); }
}

export const menuMusic = new MenuMusic();
