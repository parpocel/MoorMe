// Proste dźwięki syntetyzowane (WebAudio): silnik, ster strumieniowy, uderzenia, skrzypienie lin
export class Sound {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }
  init() {
    if (this.ctx) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(ctx.destination);
      // silnik: piłokształtny + filtr
      this.eng = ctx.createOscillator();
      this.eng.type = 'sawtooth';
      this.eng2 = ctx.createOscillator();
      this.eng2.type = 'square';
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 280;
      this.engGain = ctx.createGain();
      this.engGain.gain.value = 0;
      this.eng.connect(f); this.eng2.connect(f);
      f.connect(this.engGain); this.engGain.connect(this.master);
      this.eng.start(); this.eng2.start();
      // ster strumieniowy: szum pasmowy
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      const n = ctx.createBufferSource();
      n.buffer = buf; n.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.2;
      this.thrGain = ctx.createGain();
      this.thrGain.gain.value = 0;
      n.connect(bp); bp.connect(this.thrGain); this.thrGain.connect(this.master);
      n.start();
      // woda / wiatr
      const n2 = ctx.createBufferSource();
      n2.buffer = buf; n2.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 500;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      n2.connect(lp); lp.connect(this.windGain); this.windGain.connect(this.master);
      n2.start();
    } catch (e) {
      this.ctx = null;
    }
  }
  update(boat, windKn) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const on = this.enabled ? 1 : 0;
    const rpm = boat.rpm;
    this.eng.frequency.setTargetAtTime(28 + rpm * 62, t, 0.1);
    this.eng2.frequency.setTargetAtTime(14 + rpm * 31, t, 0.1);
    this.engGain.gain.setTargetAtTime(on * (0.05 + rpm * 0.12), t, 0.1);
    const thr = Math.max(Math.abs(boat.bowOut), Math.abs(boat.sternOut));
    this.thrGain.gain.setTargetAtTime(on * thr * 0.25, t, 0.05);
    this.windGain.gain.setTargetAtTime(on * Math.min(windKn / 35, 1) * 0.12, t, 0.5);
  }
  bump(strength = 1, kind = 'hull') {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = kind === 'hull' ? 380 : kind === 'snap' ? 2500 : 220;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const v = Math.min(1, 0.2 + strength) * (kind === 'soft' ? 0.25 : 0.9);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'snap' ? 0.25 : 0.4));
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.5);
  }
  // krzyk mewy: dwa krótkie opadające tony
  gull(volume = 0.5) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) {
      const t = t0 + k * 0.22;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const f0 = 1500 + Math.random() * 400;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.18);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12 * volume, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(bp); bp.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.22);
    }
  }

  suspend() { if (this.ctx) this.ctx.suspend(); }
  resume() { if (this.ctx) this.ctx.resume(); }
  close() { if (this.ctx) { this.ctx.close(); this.ctx = null; } }
}
