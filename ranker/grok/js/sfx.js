/* Procedural + sample SFX with Web Audio */
const SFX = (() => {
  let ctx = null;
  let volume = 0.6;
  let enabled = true;

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
  }

  function setEnabled(e) { enabled = !!e; }

  // Glass clink - two oscillators with short decay + noise burst
  function glassClink(intensity = 1) {
    if (!enabled || volume === 0) return;
    const c = ensureCtx();
    const now = c.currentTime;
    const g = c.createGain();
    g.gain.value = volume * 0.35 * intensity;
    g.connect(c.destination);

    // High crystal tone
    const o1 = c.createOscillator();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(1800 + Math.random() * 400, now);
    o1.frequency.exponentialRampToValueAtTime(900, now + 0.15);
    const g1 = c.createGain();
    g1.gain.setValueAtTime(0.6, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    o1.connect(g1); g1.connect(g);
    o1.start(now); o1.stop(now + 0.26);

    // Secondary lower
    const o2 = c.createOscillator();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(1200 + Math.random() * 200, now);
    o2.frequency.exponentialRampToValueAtTime(600, now + 0.12);
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.3, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    o2.connect(g2); g2.connect(g);
    o2.start(now); o2.stop(now + 0.2);

    // Soft noise transient
    const bufSize = c.sampleRate * 0.04;
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.15));
    const noise = c.createBufferSource();
    noise.buffer = buf;
    const ng = c.createGain();
    ng.gain.value = 0.15 * intensity;
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    noise.connect(filter); filter.connect(ng); ng.connect(g);
    noise.start(now);
  }

  function swipeWhoosh(dir = 1) {
    if (!enabled || volume === 0) return;
    const c = ensureCtx();
    const now = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(dir > 0 ? 200 : 280, now);
    o.frequency.exponentialRampToValueAtTime(dir > 0 ? 80 : 120, now + 0.2);
    const g = c.createGain();
    g.gain.setValueAtTime(volume * 0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    o.connect(f); f.connect(g); g.connect(c.destination);
    o.start(now); o.stop(now + 0.25);
  }

  function commitPop() {
    if (!enabled || volume === 0) return;
    const c = ensureCtx();
    const now = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, now);
    o.frequency.exponentialRampToValueAtTime(180, now + 0.1);
    const g = c.createGain();
    g.gain.setValueAtTime(volume * 0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    o.connect(g); g.connect(c.destination);
    o.start(now); o.stop(now + 0.13);
  }

  function softTick() {
    if (!enabled || volume === 0) return;
    const c = ensureCtx();
    const now = c.currentTime;
    const o = c.createOscillator();
    o.frequency.value = 800 + Math.random() * 200;
    const g = c.createGain();
    g.gain.setValueAtTime(volume * 0.05, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    o.connect(g); g.connect(c.destination);
    o.start(now); o.stop(now + 0.05);
  }

  function errorBuzz() {
    if (!enabled || volume === 0) return;
    const c = ensureCtx();
    const now = c.currentTime;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(120, now);
    o.frequency.setValueAtTime(90, now + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(volume * 0.1, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    o.connect(g); g.connect(c.destination);
    o.start(now); o.stop(now + 0.16);
  }

  function successChime() {
    if (!enabled || volume === 0) return;
    const c = ensureCtx();
    const now = c.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0, now + i * 0.07);
      g.gain.linearRampToValueAtTime(volume * 0.12, now + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.25);
      o.connect(g); g.connect(c.destination);
      o.start(now + i * 0.07); o.stop(now + i * 0.07 + 0.3);
    });
  }

  return { glassClink, swipeWhoosh, commitPop, softTick, errorBuzz, successChime, setVolume, setEnabled, ensureCtx };
})();
