export const Sound = {
  ctx: null,
  enabled: JSON.parse(localStorage.getItem('mx_sound') ?? 'true'),
  vib: JSON.parse(localStorage.getItem('mx_vib') ?? 'true'),
  vol: 0.35,

  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  setEnabled(v) { this.enabled = v; localStorage.setItem('mx_sound', JSON.stringify(v)); },
  setVib(v) { this.vib = v; localStorage.setItem('mx_vib', JSON.stringify(v)); },

  vibrate(pattern) {
    if (!this.vib) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  },

  glass(intensity = 1) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const clinks = [0, 0.055];
    clinks.forEach((delay, i) => {
      const t = now + delay;
      [2380, 3590, 4820, 6100].forEach((freq, j) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * (i === 1 ? 1.03 : 1);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(
          this.vol * intensity * (0.45 - j * 0.09), t + 0.004
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.85 - j * 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 1);
      });
      // noise burst
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let k = 0; k < data.length; k++) data[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / data.length, 3);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const ng = ctx.createGain(); ng.gain.value = this.vol * intensity * 0.25;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
      src.connect(hp).connect(ng).connect(ctx.destination);
      src.start(t);
    });
    this.vibrate(12);
  },

  tap() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.06);
    gain.gain.setValueAtTime(this.vol * 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t); osc.stop(t + 0.1);
    this.vibrate(6);
  },

  swipe(dir = 1) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(dir > 0 ? 400 : 700, t);
    osc.frequency.exponentialRampToValueAtTime(dir > 0 ? 900 : 300, t + 0.15);
    gain.gain.setValueAtTime(this.vol * 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t); osc.stop(t + 0.2);
    this.vibrate(8);
  },

  success() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.value = freq;
      const st = t + i * 0.08;
      gain.gain.setValueAtTime(0, st);
      gain.gain.linearRampToValueAtTime(this.vol * 0.22, st + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, st + 0.35);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(st); osc.stop(st + 0.4);
    });
    this.vibrate([10, 30, 10]);
  },

  error() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [220, 180].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const st = t + i * 0.1;
      gain.gain.setValueAtTime(0, st);
      gain.gain.linearRampToValueAtTime(this.vol * 0.15, st + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, st + 0.2);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(st); osc.stop(st + 0.25);
    });
    this.vibrate([20, 60, 20]);
  }
};
