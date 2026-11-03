// Delikatna muzyka w menu (generowana Web Audio): tradycyjna szanta „Shenandoah” (domena publiczna)
// w wolnym tempie – miękka melodia na tle cichych akordów, pogłos i szum morza.
import { getSettings } from './settings.js';

const hz = (semi) => 130.81 * Math.pow(2, semi / 12); // półtony względem C3
const BEAT = 0.8; // s na ćwierćnutę – zwykłe tempo (ok. 75 uderzeń na minutę)
// nuty (półtony od C3) i długości w ćwierćnutach; D-dur
const N = { A3: 9, B3: 11, D4: 14, E4: 16, Fs4: 18, G4: 19, A4: 21, B4: 23, Cs5: 25, D5: 26 };
// akordy (półtony od C3): D, G, A, Bm
const CH = { D: [2, 9, 14, 18], G: [-5, 7, 11, 14], A: [-3, 9, 13, 16], Bm: [-1, 6, 11, 14] };
const PHRASES = [
  { chords: ['D', 'G', 'D'], notes: [['A3', 1], ['D4', 1], ['D4', 1], ['D4', 2], ['E4', 1], ['Fs4', 1], ['G4', 1], ['B4', 1], ['A4', 3]] }, // O Shenandoah, I long to see you
  { chords: ['G', 'D', 'D'], notes: [['D5', 1], ['Cs5', 1], ['B4', 2], ['A4', 1], ['B4', 1], ['A4', 1], ['Fs4', 1], ['A4', 3]] }, // Away, you rolling river
  { chords: ['D', 'G', 'D'], notes: [['A4', 1], ['B4', 1], ['B4', 1], ['B4', 2], ['A4', 1], ['Fs4', 1], ['E4', 1], ['D4', 1], ['E4', 3]] }, // O Shenandoah, I long to see you
  { chords: ['Bm', 'G', 'A'], notes: [['E4', 1], ['Fs4', 2], ['D4', 1], ['Fs4', 1], ['B4', 1], ['A4', 3]] }, // Away, I'm bound away
  { chords: ['D', 'A', 'D'], notes: [['D4', 1], ['E4', 1], ['Fs4', 2], ['D4', 1], ['E4', 1], ['D4', 4]] } // 'Cross the wide Missouri
];
const REST = 4; // ćwierćnuty ciszy (same akordy) przed powtórką

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

  // miękki akord (sinus + trójkąt, filtr dolnoprzepustowy, wolne narastanie)
  pad(t, chord, dur) {
    const c = this.ctx;
    for (const [k, semi] of chord.entries()) {
      for (const det of [-4, 4]) {
        const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = k === 0 ? 'sine' : 'triangle';
        o.frequency.value = hz(semi - (k === 0 ? 12 : 0)); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = 760;
        const peak = k === 0 ? 0.04 : 0.014;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + Math.min(1.8, dur * 0.4));
        g.gain.setValueAtTime(peak, t + dur - 0.3);
        g.gain.linearRampToValueAtTime(0, t + dur + 1.6);
        o.connect(f); f.connect(g); g.connect(this.bus);
        o.start(t); o.stop(t + dur + 1.7);
      }
    }
  }

  // melodia: ciepła, miękka barwa (sinus z cichą oktawą i lekkim vibrato), łagodny atak jak flet / wibrafon
  note(t, semi, dur) {
    const c = this.ctx;
    const len = dur * BEAT;
    const g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1700;
    const peak = 0.05;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.09);
    g.gain.exponentialRampToValueAtTime(peak * 0.55, t + Math.min(0.9, len * 0.6));
    g.gain.setValueAtTime(peak * 0.55, t + len * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.9);
    f.connect(g); g.connect(this.bus);
    const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 4.6; vg.gain.value = 3.5; vib.connect(vg);
    for (const [mul, amp, type] of [[1, 1, 'sine'], [2, 0.12, 'sine'], [1, 0.18, 'triangle']]) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.frequency.value = hz(semi) * mul; og.gain.value = amp;
      vg.connect(o.detune);
      o.connect(og); og.connect(f);
      o.start(t); o.stop(t + len + 1);
    }
    vib.start(t); vib.stop(t + len + 1);
  }

  // jedna fraza: akordy pod spodem, nuty melodii; zwraca czas trwania
  phrase(t, ph) {
    const beats = ph.notes.reduce((a, [, d]) => a + d, 0);
    const part = beats / ph.chords.length;
    ph.chords.forEach((k, i) => this.pad(t + i * part * BEAT, CH[k], part * BEAT));
    let tt = t;
    for (const [n, d] of ph.notes) { this.note(tt, N[n], d); tt += d * BEAT; }
    return beats * BEAT;
  }

  tick() {
    const c = this.ctx;
    while (this.next < c.currentTime + 1.5) {
      const i = this.bar % (PHRASES.length + 1);
      if (i < PHRASES.length) this.next += this.phrase(this.next, PHRASES[i]) + 0.35 * BEAT; // oddech między frazami
      else { this.pad(this.next, CH.D, REST * BEAT); this.next += REST * BEAT; } // przerwa – same akordy i morze
      this.bar++;
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
