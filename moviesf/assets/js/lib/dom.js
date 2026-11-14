/* ============================================================================
   FULL METAL CINEMA — dom kit
   tiny hyperscript, markdown, modal / toast / sheet, formatters, downloads
   ========================================================================== */

/* ---------- hyperscript ------------------------------------------------ */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props && (typeof props !== 'object' || Array.isArray(props) || props instanceof Node)) {
    kids.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === true) continue;
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export const frag = (...kids) => append(document.createDocumentFragment(), kids);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- markdown (safe subset) ------------------------------------- */
export function md(src) {
  const lines = String(src ?? '').replace(/\r/g, '').split('\n');
  const out = [];
  let inCode = false, codeBuf = [], list = null, listType = '';

  const inline = (t) => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  const flushList = () => {
    if (list) { out.push(`<${listType}>${list.join('')}</${listType}>`); list = null; }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^```/.test(line)) {
      if (inCode) { out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`); codeBuf = []; inCode = false; }
      else { flushList(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }
    if (!line.trim()) { flushList(); continue; }

    const head = line.match(/^(#{1,4})\s+(.*)$/);
    if (head) { flushList(); out.push(`<h${head[1].length + 1}>${inline(head[2])}</h${head[1].length + 1}>`); continue; }
    if (/^>\s?/.test(line)) { flushList(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); continue; }
    if (/^([-*+])\s+/.test(line)) {
      if (listType !== 'ul') { flushList(); listType = 'ul'; list = []; }
      list.push(`<li>${inline(line.replace(/^([-*+])\s+/, ''))}</li>`);
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      if (listType !== 'ol') { flushList(); listType = 'ol'; list = []; }
      list.push(`<li>${inline(line.replace(/^\d+[.)]\s+/, ''))}</li>`);
      continue;
    }
    if (/^([-*_])\1{2,}$/.test(line)) { flushList(); out.push('<hr>'); continue; }
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  if (inCode && codeBuf.length) out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`);
  return out.join('');
}

/* ---------- formatting ------------------------------------------------- */
const nf = new Intl.NumberFormat('en-US');
export const fmtNum = (n, fallback = '0') => (n == null || Number.isNaN(+n) ? fallback : nf.format(+n));
export const fmtDec = (n, d = 1) => (n == null || n === '' ? '—' : Number(n).toFixed(d));
export const pad2 = (n) => String(n).padStart(2, '0');

export function fmtDate(v, style = 'short') {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  if (style === 'iso') return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  if (style === 'long') {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtRel(v) {
  if (!v) return '—';
  const d = new Date(v);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (Number.isNaN(diff)) return '—';
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.round(diff / 86400)}d ago`;
  if (diff < 86400 * 365) return `${Math.round(diff / 86400 / 30)}mo ago`;
  return `${Math.round(diff / 86400 / 365)}y ago`;
}

export function fmtDur(minutes) {
  if (!minutes) return '—';
  const hh = Math.floor(minutes / 60), mm = Math.round(minutes % 60);
  return hh ? `${hh}h ${mm ? `${mm}m` : ''}`.trim() : `${mm}m`;
}

export function fmtBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), 3);
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function initials(str, max = 2) {
  return String(str || '?')
    .replace(/^(the|a|an|le|la|les|el)\s+/i, '')
    .split(/[\s:–\-—/]+/)
    .filter(Boolean)
    .slice(0, max)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';
}

export function hash(str) {
  let x = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    x ^= String(str).charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return Math.abs(x);
}

export function posterStyle(seed = '', category = 'good') {
  const hue = hash(seed) % 360;
  const cat = category === 'love' ? 348 : category === 'hate' ? 18 : 96;
  const h1 = (hue + cat) % 360;
  const h2 = (hue + cat + 40) % 360;
  return `--p-a: hsl(${h1} 26% 22%); --p-b: hsl(${h2} 34% 8%);`;
}

export function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
export function slug(s) {
  return String(s).toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60);
}
export function debounce(fn, ms = 220) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
export function throttle(fn, ms = 120) {
  let last = 0, timer;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
    else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn(...args); }, ms - (now - last)); }
  };
}
export function groupBy(arr, fn) {
  const m = new Map();
  for (const item of arr) {
    const k = fn(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}
export function sum(arr, fn = (x) => x) { return arr.reduce((a, b) => a + (Number(fn(b)) || 0), 0); }
export function avg(arr, fn = (x) => x) {
  const vals = arr.map(fn).filter((v) => v != null && !Number.isNaN(+v));
  return vals.length ? sum(vals) / vals.length : 0;
}
export function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }
export function sortBy(arr, fn, dir = 1) {
  return [...arr].sort((a, b) => {
    const x = fn(a), y = fn(b);
    if (x == null) return 1;
    if (y == null) return -1;
    return x > y ? dir : x < y ? -dir : 0;
  });
}

/* ---------- toast ------------------------------------------------------ */
export function toast(message, kind = 'ok', ms = 3400) {
  const root = $('#toastRoot');
  if (!root) return;
  const el = h('div', { class: `toast toast--${kind}` },
    h('div', { class: 'toast__kind' }, kind === 'err' ? 'FAULT' : kind === 'warn' ? 'CAUTION' : 'LOGGED'),
    h('div', { class: 'toast__msg' }, message),
  );
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 260);
  }, ms);
  return el;
}

/* ---------- modal ------------------------------------------------------ */
let modalStack = [];

export function openModal({
  title = '', body = null, foot = null, wide = false, full = false,
  flush = false, onClose = null, closable = true, strip = true,
} = {}) {
  const root = $('#modalRoot');
  const prevFocus = document.activeElement;
  const panel = h('div', { class: `modal__panel ${wide ? 'modal--wide' : ''} ${full ? 'modal--full' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' });

  const close = (val) => {
    if (!root.contains(wrap)) return;
    wrap.remove();
    modalStack = modalStack.filter((x) => x !== api);
    if (!modalStack.length) document.body.style.overflow = '';
    if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch { /* ignore */ }
    onClose && onClose(val);
  };

  if (strip) panel.appendChild(h('div', { class: 'modal__strip' }));
  if (title || closable) {
    panel.appendChild(h('div', { class: 'modal__head' },
      h('h2', {}, title),
      closable && h('button', { class: 'iconbtn modal__x', 'aria-label': 'Close', onClick: () => close('x') }, '✕'),
    ));
  }
  if (body) panel.appendChild(h('div', { class: `modal__body ${flush ? 'modal__body--flush' : ''}` }, body));
  if (foot) panel.appendChild(h('div', { class: 'modal__foot' }, foot));

  const wrap = h('div', { class: 'modal' }, h('div', { class: 'modal__scrim', onClick: () => closable && close('scrim') }), panel);
  root.appendChild(wrap);
  document.body.style.overflow = 'hidden';

  const onKey = (e) => {
    if (e.key === 'Escape' && closable) { e.stopPropagation(); close('esc'); }
  };
  document.addEventListener('keydown', onKey, true);

  const api = { el: panel, close, wrap, destroy: () => { document.removeEventListener('keydown', onKey, true); } };
  const origClose = api.close;
  api.close = (v) => { document.removeEventListener('keydown', onKey, true); origClose(v); };
  modalStack.push(api);

  const first = panel.querySelector('input:not([type=hidden]), textarea, select, button.btn--primary');
  if (first) setTimeout(() => first.focus(), 40);
  return api;
}

export function confirmAction({ title = 'Confirm', body = '', ok = 'Do it', danger = true } = {}) {
  return new Promise((resolve) => {
    const dlg = $('#confirmDialog');
    if (!dlg || typeof dlg.showModal !== 'function') { resolve(window.confirm(`${title}\n\n${body}`)); return; }
    $('#confirmTitle').textContent = title;
    $('#confirmBody').textContent = body;
    const okBtn = $('#confirmOk');
    okBtn.textContent = ok;
    okBtn.className = `btn ${danger ? 'btn--danger' : 'btn--primary'}`;
    const done = () => { dlg.removeEventListener('close', done); resolve(dlg.returnValue === 'ok'); };
    dlg.addEventListener('close', done);
    dlg.returnValue = '';
    dlg.showModal();
  });
}

/* ---------- bottom sheet ---------------------------------------------- */
export function openSheet({ body, onClose = null } = {}) {
  const root = $('#sheetRoot');
  const wrap = h('div', { class: 'sheet' },
    h('div', { class: 'sheet__scrim', onClick: () => close() }),
    h('div', { class: 'sheet__panel' }, h('div', { class: 'sheet__grab' }), body),
  );
  root.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  function close() {
    wrap.remove();
    document.body.style.overflow = '';
    onClose && onClose();
  }
  return { el: wrap, close };
}

/* ---------- clipboard / files ----------------------------------------- */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
    return true;
  } catch {
    toast('Clipboard blocked by the browser', 'warn');
    return false;
  }
}

export function download(filename, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toCsv(rows, columns) {
  const cols = columns || Object.keys(rows[0] || {});
  const cell = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
}

export function safeJson(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

export function readFile(file, as = 'text') {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    if (as === 'text') fr.readAsText(file);
    else if (as === 'dataurl') fr.readAsDataURL(file);
    else fr.readAsArrayBuffer(file);
  });
}

/* ---------- small components ------------------------------------------ */
export function posterEl(title, { small = false } = {}) {
  const cat = title.category || 'good';
  const p = h('div', {
    class: `poster poster--${cat}`,
    style: posterStyle(title.title || '', cat),
  });
  p.appendChild(h('div', { class: 'poster__cat' }));
  if (title.poster_url) {
    p.appendChild(h('img', { class: 'poster__img', src: title.poster_url, alt: '', loading: 'lazy', onError: (e) => e.target.remove() }));
  } else {
    p.appendChild(h('div', { class: 'poster__initials' }, initials(title.title)));
  }
  if (title.rating) {
    p.appendChild(h('div', { class: 'poster__rating' }, fmtDec(title.rating, 1), h('small', {}, 'SCORE')));
  }
  if (title.favorite) p.appendChild(h('div', { class: 'poster__keep', title: 'Kept forever' }, '★'));
  const bars = h('div', { class: 'poster__bars' });
  const seedN = hash(title.title || 'x');
  for (let i = 0; i < 4; i++) bars.appendChild(h('i', { style: { height: `${6 + ((seedN >> (i * 3)) % 18)}px` } }));
  p.appendChild(bars);
  if (!small) {
    p.appendChild(h('div', { class: 'poster__foot' },
      h('div', { class: 'poster__title' }, title.title || 'untitled'),
      h('div', { class: 'poster__meta' },
        h('span', {}, title.type || '—'),
        title.year ? h('span', {}, `· ${title.year}`) : null,
      ),
    ));
  }
  return p;
}

export function emptyState({ glyph = '∅', title = 'Nothing here', body = '', action = null } = {}) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty__glyph' }, glyph),
    h('h3', {}, title),
    body && h('p', {}, body),
    action,
  );
}

export function skeletonGrid(n = 12) {
  const g = h('div', { class: 'grid-posters' });
  for (let i = 0; i < n; i++) {
    g.appendChild(h('div', { class: 'card' },
      h('div', { class: 'skel skel--poster' }),
      h('div', { style: { padding: '8px' } }, h('div', { class: 'skel skel--line' }), h('div', { class: 'skel skel--line', style: { width: '55%' } })),
    ));
  }
  return g;
}

export function chips(items, { active = [], onToggle = () => {}, multi = true, cls = '' } = {}) {
  const set = new Set(active);
  const wrap = h('div', { class: `pillrow ${cls}` });
  for (const it of items) {
    const id = typeof it === 'string' ? it : it.id;
    const label = typeof it === 'string' ? it : it.label;
    const chip = h('button', {
      class: `chip ${set.has(id) ? 'is-on' : ''}`,
      type: 'button',
      onClick: () => {
        if (multi) {
          if (set.has(id)) set.delete(id); else set.add(id);
        } else {
          set.clear(); set.add(id);
        }
        chip.classList.toggle('is-on');
        onToggle([...set]);
      },
    }, label);
    wrap.appendChild(chip);
  }
  return wrap;
}

export function tabBar(tabs, { active, onChange, compact = false } = {}) {
  const bar = h('div', { class: `tabs ${compact ? 'tabs--compact' : ''}` });
  for (const t of tabs) {
    bar.appendChild(h('button', {
      class: `tab ${t.id === active ? 'is-active' : ''}`,
      type: 'button',
      onClick: (e) => {
        [...bar.children].forEach((c) => c.classList.remove('is-active'));
        e.currentTarget.classList.add('is-active');
        onChange(t.id);
      },
    }, t.label));
  }
  return bar;
}

export function field(label, control, hint = '') {
  return h('label', { class: 'field' },
    h('span', { class: 'field__label' }, label),
    control,
    hint && h('span', { class: 'field__hint' }, hint),
  );
}

export function switchRow(label, checked, onChange, hint = '') {
  const input = h('input', { type: 'checkbox', checked, onChange: (e) => onChange(e.target.checked) });
  return h('label', { class: 'switch' },
    input,
    h('span', { class: 'switch__track' }),
    h('span', { class: 'switch__label' }, label, hint ? h('small', { class: 'dim', style: { display: 'block', fontSize: '10px' } }, hint) : null),
  );
}
