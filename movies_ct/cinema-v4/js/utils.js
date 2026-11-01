/* =========================================================
   توابع کمکی عمومی
   ========================================================= */
window.Utils = (function () {

  const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') node.innerHTML = v;
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeFa(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/ۀ/g, 'ه')
      .replace(/ة/g, 'ه')
      .replace(/[ًٌٍَُِّْ]/g, '')
      .replace(/[\u200c\u200f\u200e]/g, ' ')
      .replace(/[-\u2010-\u2015]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function toFa(input) {
    if (input == null) return '';
    return String(input).replace(/\d/g, d => FA_DIGITS[+d]);
  }

  function toJalali(dateInput) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d)) return '—';
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(d);
    } catch { return d.toLocaleDateString(); }
  }

  function toJalaliLong(dateInput) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d)) return '—';
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch { return d.toLocaleString(); }
  }

  function relativeTime(dateInput) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d)) return '—';
    const diff = Date.now() - d.getTime();
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (sec < 60) return 'لحظه‌ای پیش';
    if (min < 60) return toFa(min) + ' دقیقه پیش';
    if (hr < 24) return toFa(hr) + ' ساعت پیش';
    if (day < 30) return toFa(day) + ' روز پیش';
    return toJalali(d);
  }

  function debounce(fn, wait = 200) {
    let t;
    const wrapped = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
    wrapped.cancel = () => clearTimeout(t);
    return wrapped;
  }

  function download(filename, content, mime = 'application/json') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const ta = el('textarea', { style: { position: 'fixed', opacity: 0 } });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch { return false; }
  }

  function highlight(text, query) {
    if (!query) return esc(text);
    const safe = esc(text);
    const words = normalizeFa(query).split(' ').filter(w => w.length > 0);
    if (!words.length) return safe;
    let out = safe;
    words.forEach(w => {
      const re = new RegExp(`(${escapeRegex(w)})`, 'gi');
      out = out.replace(re, '<mark style="background:rgba(124,92,255,0.35);color:inherit;border-radius:3px;padding:0 2px;">$1</mark>');
    });
    return out;
  }

  function stagger(children, base = 25, max = 300) {
    children.forEach((c, i) => {
      c.style.animationDelay = Math.min(i * base, max) + 'ms';
    });
  }

  function timestampName(prefix = 'backup', ext = 'json') {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${prefix}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
  }

  function safeParse(json, fallback = null) {
    if (json == null) return fallback;
    if (typeof json === 'string') {
      const trimmed = json.trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return fallback;
    }
    try {
      const out = JSON.parse(json);
      return out == null ? fallback : out;
    } catch {
      return fallback;
    }
  }

  return {
    el, esc, normalizeFa, toFa, toJalali, toJalaliLong, relativeTime, debounce, download, copyToClipboard, highlight, stagger, timestampName, safeParse
  };
})();
