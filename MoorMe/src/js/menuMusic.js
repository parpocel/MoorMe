// Delikatna muzyka w menu (generowana Web Audio): sześć spokojnych, ambientowych melodii odtwarzanych losowo,
// na tle cichego szumu fal i ledwo słyszalnego wiatru. Melodie są własne, poza „Shenandoah” (szanta z domeny publicznej).
import { getSettings } from './settings.js';

// nazwa nuty → półtony względem C3 (np. 'D4', 'F#4', 'Bb3')
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const semi = (n) => { const m = /^([A-G])([#b]?)(\d)$/.exec(n); return SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 3) * 12; };
const hz = (s) => 130.81 * Math.pow(2, s / 12);
// akordy (nazwy nut od najniższej); pierwsza – bas grany oktawę niżej
const CHORDS = {
  D: ['D3', 'A3', 'D4', 'F#4'], G: ['G2', 'D3', 'G3', 'B3'], A: ['A2', 'E3', 'A3', 'C#4'], Bm: ['B2', 'F#3', 'B3', 'D4'], Em: ['E3', 'B3', 'E4', 'G4'],
  Am: ['A2', 'E3', 'A3', 'C4'], F: ['F2', 'C3', 'F3', 'A3'], C: ['C3', 'G3', 'C4', 'E4'], G7: ['G2', 'D3', 'F3', 'B3'], Dm: ['D3', 'A3', 'D4', 'F4'],
  Cmaj7: ['C3', 'G3', 'B3', 'E4'], Fmaj7: ['F2', 'C3', 'E3', 'A3'], Gsus: ['G2', 'D3', 'G3', 'C4'], Esus: ['E3', 'B3', 'E4', 'A4']
};
// utwór: tempo (s na ćwierćnutę), frazy: akordy (równo podzielone) i nuty [nazwa | null = pauza, długość w ćwierćnutach]
const PIECES = [
  { name: 'Shenandoah', beat: 0.8, phrases: [
    { chords: ['D', 'G', 'D'], notes: [['A3', 1], ['D4', 1], ['D4', 1], ['D4', 2], ['E4', 1], ['F#4', 1], ['G4', 1], ['B4', 1], ['A4', 3]] },
    { chords: ['G', 'D', 'D'], notes: [['D5', 1], ['C#5', 1], ['B4', 2], ['A4', 1], ['B4', 1], ['A4', 1], ['F#4', 1], ['A4', 3]] },
    { chords: ['D', 'G', 'D'], notes: [['A4', 1], ['B4', 1], ['B4', 1], ['B4', 2], ['A4', 1], ['F#4', 1], ['E4', 1], ['D4', 1], ['E4', 3]] },
    { chords: ['Bm', 'G', 'A'], notes: [['E4', 1], ['F#4', 2], ['D4', 1], ['F#4', 1], ['B4', 1], ['A4', 3]] },
    { chords: ['D', 'A', 'D'], notes: [['D4', 1], ['E4', 1], ['F#4', 2], ['D4', 1], ['E4', 1], ['D4', 4]] }] },
  { name: 'Poranna cisza', beat: 0.9, phrases: [ // D-dur, pentatonika – spokojny poranek w zatoce
    { chords: ['D', 'Bm'], notes: [['F#4', 2], ['A4', 2], ['B4', 1], ['A4', 3]] },
    { chords: ['G', 'D'], notes: [['D5', 2], ['B4', 1], ['A4', 1], ['F#4', 4]] },
    { chords: ['Bm', 'G'], notes: [['E4', 2], ['F#4', 2], ['A4', 2], ['B4', 2]] },
    { chords: ['Gsus', 'D'], notes: [['A4', 3], ['F#4', 1], ['E4', 2], ['D4', 2], [null, 2]] }] },
  { name: 'Dryf', beat: 0.85, phrases: [ // a-moll – fale kołyszą łodzią
    { chords: ['Am', 'F'], notes: [['E4', 1], ['A4', 1], ['C5', 2], ['B4', 1], ['A4', 3]] },
    { chords: ['C', 'G'], notes: [['G4', 1], ['C5', 1], ['E5', 2], ['D5', 2], [null, 2]] },
    { chords: ['Am', 'F'], notes: [['C5', 1], ['B4', 1], ['A4', 2], ['F4', 1], ['G4', 1], ['A4', 2]] },
    { chords: ['Dm', 'Esus'], notes: [['F4', 2], ['E4', 1], ['D4', 1], ['E4', 4]] }] },
  { name: 'Światła portu', beat: 0.62, phrases: [ // G-dur, w rytmie walca (3/4)
    { chords: ['G', 'Em'], notes: [['B4', 2], ['D5', 1], ['C5', 2], ['B4', 1]] },
    { chords: ['C', 'D'], notes: [['A4', 2], ['G4', 1], ['A4', 3]] },
    { chords: ['G', 'Em'], notes: [['B4', 2], ['D5', 1], ['E5', 2], ['D5', 1]] },
    { chords: ['C', 'D', 'G'], notes: [['C5', 2], ['B4', 1], ['A4', 2], ['F#4', 1], ['G4', 3]] }] },
  { name: 'Nocna wachta', beat: 1.0, phrases: [ // e-moll, oszczędne nuty i długie akordy
    { chords: ['Em', 'Cmaj7'], notes: [['B4', 3], ['G4', 1], ['E4', 4]] },
    { chords: ['G', 'D'], notes: [['D5', 2], ['B4', 2], ['A4', 2], [null, 2]] },
    { chords: ['Em', 'Cmaj7'], notes: [['G4', 2], ['A4', 1], ['B4', 1], ['E5', 4]] },
    { chords: ['Am', 'Esus', 'Em'], notes: [['D5', 2], ['C5', 2], ['B4', 2], [null, 2]] }] },
  { name: 'Bryza', beat: 0.75, phrases: [ // F-dur, lekko i jasno
    { chords: ['Fmaj7', 'C'], notes: [['A4', 1], ['C5', 1], ['F5', 2], ['E5', 1], ['C5', 3]] },
    { chords: ['Dm', 'G7'], notes: [['D5', 2], ['F5', 1], ['E5', 1], ['D5', 2], ['B4', 2]] },
    { chords: ['Fmaj7', 'Am'], notes: [['C5', 2], ['A4', 1], ['C5', 1], ['E5', 4]] },
    { chords: ['Dm', 'G7', 'C'], notes: [['F5', 1], ['E5', 1], ['D5', 2], ['B4', 2], ['C5', 2], [null, 2]] }] }
];
const REST = 5; // ćwierćnuty samych akordów i morza między utworami

function noiseBuffer(c, seconds, smooth) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate), d = b.getChannelData(0);
  let last = 0, peak = 0;
  for (let i = 0; i < d.length; i++) { last = last * smooth + (Math.random() * 2 - 1) * (1 - smooth); d[i] = last; peak = Math.max(peak, Math.abs(last)); }
  for (let i = 0; i < d.length; i++) d[i] /= peak || 1;
  return b;
}
const lfo = (c, freq, depth, target) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = freq; g.gain.value = depth; o.connect(g); g.connect(target); o.start(); };

class MenuMusic {
  constructor() { this.ctx = null; this.on = false; this.timer = null; this.next = 0; this.queue = []; this.last = -1; }

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
    // szum fal – cichy, w tle: niski szum z wolnym „oddechem”
    const sea = c.createGain(); sea.gain.value = 0.05;
    const seaLp = c.createBiquadFilter(); seaLp.type = 'lowpass'; seaLp.frequency.value = 460;
    const seaSrc = c.createBufferSource(); seaSrc.buffer = noiseBuffer(c, 6, 0.985); seaSrc.loop = true;
    seaSrc.connect(seaLp); seaLp.connect(sea); sea.connect(this.master);
    lfo(c, 0.085, 0.03, sea.gain); lfo(c, 0.085, 140, seaLp.frequency);
    seaSrc.start();
    // ledwo słyszalny wiatr
    const wind = c.createGain(); wind.gain.value = 0.008;
    const windBp = c.createBiquadFilter(); windBp.type = 'bandpass'; windBp.frequency.value = 650; windBp.Q.value = 0.9;
    const windSrc = c.createBufferSource(); windSrc.buffer = noiseBuffer(c, 5, 0.9); windSrc.loop = true;
    windSrc.connect(windBp); windBp.connect(wind); wind.connect(this.master);
    lfo(c, 0.045, 0.006, wind.gain); lfo(c, 0.06, 200, windBp.frequency);
    windSrc.start();
    const resume = () => { if (c.state === 'suspended') c.resume(); };
    window.addEventListener('pointerdown', resume, { capture: true });
    window.addEventListener('keydown', resume, { capture: true });
    return true;
  }

  // miękki akord (sinus + trójkąt, filtr dolnoprzepustowy, wolne narastanie)
  pad(t, chord, dur) {
    const c = this.ctx;
    for (const [k, n] of chord.entries()) {
      for (const det of [-4, 4]) {
        const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = k === 0 ? 'sine' : 'triangle';
        o.frequency.value = hz(semi(n) - (k === 0 ? 12 : 0)); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = 760;
        const peak = k === 0 ? 0.04 : 0.013;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + Math.min(1.8, dur * 0.4));
        g.gain.setValueAtTime(peak, t + Math.max(0.1, dur - 0.3));
        g.gain.linearRampToValueAtTime(0, t + dur + 1.6);
        o.connect(f); f.connect(g); g.connect(this.bus);
        o.start(t); o.stop(t + dur + 1.7);
      }
    }
  }

  // nuta melodii: ciepła barwa (sinus z cichą oktawą i lekkim vibrato), łagodny atak jak flet / wibrafon
  note(t, n, len) {
    const c = this.ctx;
    const g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1700;
    const peak = 0.045;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.09);
    g.gain.exponentialRampToValueAtTime(peak * 0.55, t + Math.min(0.9, len * 0.6));
    g.gain.setValueAtTime(peak * 0.55, t + len * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.9);
    f.connect(g); g.connect(this.bus);
    const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 4.6; vg.gain.value = 3.5; vib.connect(vg);
    for (const [mul, amp, type] of [[1, 1, 'sine'], [2, 0.12, 'sine'], [1, 0.18, 'triangle']]) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.frequency.value = hz(semi(n)) * mul; og.gain.value = amp;
      vg.connect(o.detune);
      o.connect(og); og.connect(f);
      o.start(t); o.stop(t + len + 1);
    }
    vib.start(t); vib.stop(t + len + 1);
  }

  phrase(t, ph, beat) {
    const beats = ph.notes.reduce((a, [, d]) => a + d, 0), part = beats / ph.chords.length;
    ph.chords.forEach((k, i) => this.pad(t + i * part * beat, CHORDS[k], part * beat));
    let tt = t;
    for (const [n, d] of ph.notes) { if (n) this.note(tt, n, d * beat); tt += d * beat; }
    return beats * beat;
  }

  // kolejny utwór losowo (bez powtórki tego samego pod rząd), każdy raz albo dwa razy
  nextPiece() {
    let i;
    do i = Math.floor(Math.random() * PIECES.length); while (PIECES.length > 1 && i === this.last);
    this.last = i;
    const p = PIECES[i], reps = Math.random() < 0.4 ? 2 : 1;
    for (let k = 0; k < reps; k++) for (const ph of p.phrases) this.queue.push({ ph, beat: p.beat });
    this.queue.push({ rest: true, beat: p.beat, chord: p.phrases[p.phrases.length - 1].chords.slice(-1)[0] });
  }

  tick() {
    const c = this.ctx;
    while (this.next < c.currentTime + 1.5) {
      if (!this.queue.length) this.nextPiece();
      const q = this.queue.shift();
      if (q.rest) { this.pad(this.next, CHORDS[q.chord], REST * q.beat); this.next += REST * q.beat; }
      else this.next += this.phrase(this.next, q.ph, q.beat) + 0.35 * q.beat; // oddech między frazami
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

  refresh() { if (this.on || this.volume() > 0) this.start(); if (this.volume() <= 0) this.stop(0.3); }
}

export const menuMusic = new MenuMusic();
export const MENU_PIECES = PIECES.map((p) => p.name);
