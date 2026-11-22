(function () {
  const T3D = window.T3D;

  // ---------- DOM ----------
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'html') el.innerHTML = v;
        else el.setAttribute(k, v);
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
  }
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- util ----------
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const fmtNum = (n, d = 1) => Number(n).toFixed(d).replace(/\.0+$/, '');
  const initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  function colorFromString(s) {
    let hash = 0;
    for (let i = 0; i < String(s).length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return `linear-gradient(135deg, hsl(${hue} 80% 72%), hsl(${(hue + 40) % 360} 80% 60%))`;
  }

  // ---------- storage ----------
  const store = {
    get(k, def) { try { const v = localStorage.getItem(T3D.CONFIG.LS_PREFIX + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
    set(k, v) { try { localStorage.setItem(T3D.CONFIG.LS_PREFIX + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(T3D.CONFIG.LS_PREFIX + k); } catch {} }
  };

  // ---------- sound (Web Audio) ----------
  let ctx = null;
  const Sound = {
    enabled: store.get('sound', true),
    ensure() {
      if (!this.enabled) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    },
    // Two-glass clink
    clink(volume = 0.15) {
      const ac = this.ensure();
      if (!ac) return;
      const now = ac.currentTime;
      const freqs = [1600, 2100, 2600];
      freqs.forEach((f, i) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(f + Math.random() * 80, now);
        o.frequency.exponentialRampToValueAtTime(f * 0.9, now + 0.28);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(volume / (i + 1), now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        o.connect(g).connect(ac.destination);
        o.start(now);
        o.stop(now + 0.32);
      });
    },
    // Soft thud for navigation
    thud(volume = 0.08) {
      const ac = this.ensure();
      if (!ac) return;
      const now = ac.currentTime;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(220, now);
      o.frequency.exponentialRampToValueAtTime(90, now + 0.15);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(volume, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      o.connect(g).connect(ac.destination);
      o.start(now);
      o.stop(now + 0.2);
    },
    // Whoosh for swipe
    whoosh(volume = 0.06) {
      const ac = this.ensure();
      if (!ac) return;
      const now = ac.currentTime;
      const bufSize = ac.sampleRate * 0.3;
      const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      filter.Q.value = 0.7;
      const g = ac.createGain();
      g.gain.value = volume;
      src.connect(filter).connect(g).connect(ac.destination);
      src.start(now);
    },
    // Success chime
    chime(volume = 0.12) {
      const ac = this.ensure();
      if (!ac) return;
      const now = ac.currentTime;
      [523.25, 659.25, 783.99].forEach((f, i) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0, now + i * 0.06);
        g.gain.linearRampToValueAtTime(volume, now + i * 0.06 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.5);
        o.connect(g).connect(ac.destination);
        o.start(now + i * 0.06);
        o.stop(now + i * 0.06 + 0.55);
      });
    },
    toggle() { this.enabled = !this.enabled; store.set('sound', this.enabled); if (this.enabled) this.clink(0.1); return this.enabled; }
  };

  // ---------- vibration ----------
  const Vibrate = {
    enabled: store.get('vibrate', true),
    play(p) { if (this.enabled && navigator.vibrate) navigator.vibrate(p); },
    tick() { this.play(10); },
    thump() { this.play([20, 30, 20]); },
    long() { this.play([40, 60, 40]); },
    toggle() { this.enabled = !this.enabled; store.set('vibrate', this.enabled); return this.enabled; }
  };

  // ---------- toast ----------
  function toast(msg, type = 'info', ms = 2800) {
    const root = document.getElementById('toasts');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const icons = { success: 'fa-check', error: 'fa-exclamation', info: 'fa-info' };
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${esc(msg)}</span>`;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    }, ms);
  }

  // ---------- statusbar ----------
  function setStatus(left, right) {
    const l = document.getElementById('status-left');
    const r = document.getElementById('status-right');
    if (l && left != null) l.textContent = left;
    if (r && right != null) r.textContent = right;
  }

  // ---------- markdown-lite ----------
  function md(t) {
    if (!t) return '';
    let s = esc(t);
    s = s.replace(/```([\s\S]*?)```/g, (_, c) => `<pre>${c}</pre>`);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    s = s.replace(/^- (.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>[\s\S]*?<\/li>)/g, (m) => '<ul>' + m + '</ul>');
    s = s.replace(/\n\n/g, '</p><p>');
    return s;
  }

  T3D.lib = { h, $, $$, esc, uid, clamp, debounce, fmtNum, initials, colorFromString };
  T3D.store = store;
  T3D.sound = Sound;
  T3D.vibrate = Vibrate;
  T3D.toast = toast;
  T3D.setStatus = setStatus;
  T3D.md = md;
})();
