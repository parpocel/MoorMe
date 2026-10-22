// Delikatna muzyka ambientowa w menu (generowana Web Audio): powolne akordy, pojedyncze dzwoneczki, cichy szum morza.
import { getSettings } from './settings.js';

const CHORDS = [ // Cmaj9 – Am7 – Fmaj7 – G6 (półtony względem C3)
  [0, 7, 11, 14, 16],
  [-3, 4, 7, 12, 16],
  [-7, 0, 4, 9, 12],
  [-5, 2, 7, 11, 14]
];
const BAR = 9; // s na akord
const hz = (semi) => 130.81 * Math.pow(2, semi / 12);

class MenuMusic {
  constructor() { this.ctx = null; this.on = false; this.timer = null; this.next = 0; this.bar = 0; }

  init() {
    if (this.ctx) return true;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0;
    // pogłos z wygenerowanej odpowiedzi impulsowej
    const len = c.sampleRate * 4, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.rev = c.createConvolver(); this.rev.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.55;
    this.dry = c.createGain(); this.dry.gain.value = 0.6;
    this.bus = c.createGain();
    this.bus.connect(this.dry); this.bus.connect(this.rev); this.rev.connect(wet);
    this.dry.connect(this.master); wet.connect(this.master); this.master.connect(c.destination);
    // szum morza: filtrowany szum z wolnym „oddechem” fal
    const nb = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), nd = nb.getChannelData(0);
    let last = 0; for (let i = 0; i < nd.length; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; nd[i] = last * 3; }
    const noise = c.createBufferSource(); noise.buffer = nb; noise.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const sea = c.createGain(); sea.gain.value = 0.05;
    const lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = 0.09; lfoG.gain.value = 0.035; lfo.connect(lfoG); lfoG.connect(sea.gain);
    noise.connect(lp); lp.connect(sea); sea.connect(this.master); noise.start(); lfo.start();
    // przeglądarka może wstrzymać dźwięk do pierwszego kliknięcia
    const resume = () => { if (c.state === 'suspended') c.resume(); };
    window.addEventListener('pointerdown', resume, { capture: true });
    window.addEventListener('keydown', resume, { capture: true });
    return true;
  }

  pad(t, chord) {
    const c = this.ctx;
    for (const [k, semi] of chord.entries()) {
      for (const det of [-4, 4]) {
        const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = k === 0 ? 'sine' : 'triangle';
        o.frequency.value = hz(semi - (k === 0 ? 12 : 0)); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = 900;
        const peak = (k === 0 ? 0.05 : 0.022);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + 3.5);
        g.gain.setValueAtTime(peak, t + BAR - 1.5);
        g.gain.linearRampToValueAtTime(0, t + BAR + 2.5);
        o.connect(f); f.connect(g); g.connect(this.bus);
        o.start(t); o.stop(t + BAR + 2.6);
      }
    }
    // kilka miękkich dzwoneczków z nut akordu (pentatonicznie wysoko)
    const notes = chord.slice(1).map((s) => s + 24);
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const tt = t + 1 + Math.random() * (BAR - 2), semi = notes[Math.floor(Math.random() * notes.length)];
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = hz(semi);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.03, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 3.2);
      o.connect(g); g.connect(this.bus); o.start(tt); o.stop(tt + 3.3);
    }
  }

  tick() {
    const c = this.ctx;
    while (this.next < c.currentTime + 1.5) {
      this.pad(this.next, CHORDS[this.bar % CHORDS.length]);
      this.bar++; this.next += BAR;
    }
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
    if (this.on) return;
    this.on = true;
    this.next = Math.max(this.next, c.currentTime + 0.1);
    this.tick();
    this.timer = setInterval(() => this.tick(), 500);
  }

  stop(fade = 1.2) {
    if (!this.ctx || !this.on) return;
    const c = this.ctx;
    this.master.gain.cancelScheduledValues(c.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, c.currentTime);
    this.master.gain.linearRampToValueAtTime(0, c.currentTime + fade);
    this.on = false;
    clearInterval(this.timer); this.timer = null;
  }

  // zmiana głośności z ustawień w trakcie grania
  refresh() { if (this.on || this.volume() > 0) this.start(); if (this.volume() <= 0) this.stop(0.3); }
}

export const menuMusic = new MenuMusic();
