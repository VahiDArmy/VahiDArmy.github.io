/* ==========================================================================
   utils.js — ابزارهای عمومی (DOM، اعداد فارسی، ذخیره‌سازی، دو-ضربه)
   ========================================================================== */

import { CONFIG } from './config.js';

/* --------------------------------------------------------------------------
   DOM
   -------------------------------------------------------------------------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') {
      node.className = Array.isArray(value) ? value.join(' ') : String(value);
    } else if (key === 'dataset' && typeof value === 'object') {
      for (const [dk, dv] of Object.entries(value)) {
        if (dv !== null && dv !== undefined) node.dataset[dk] = String(dv);
      }
    } else if (key === 'style' && typeof value === 'object') {
      for (const [sk, sv] of Object.entries(value)) node.style.setProperty(sk, sv);
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (key === 'text') {
      node.textContent = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'attrs' && typeof value === 'object') {
      for (const [ak, av] of Object.entries(value)) {
        if (av === true) node.setAttribute(ak, '');
        else if (av !== false && av !== null && av !== undefined) node.setAttribute(ak, String(av));
      }
    } else {
      node.setAttribute(key, String(value));
    }
  }

  const kids = Array.isArray(children) ? children : [children];
  for (const child of kids) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}

export function clear(node) {
  if (!node) return node;
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function show(node, display = '') {
  if (!node) return;
  node.hidden = false;
  node.style.display = display;
}

export function hide(node) {
  if (!node) return;
  node.hidden = true;
  node.style.display = 'none';
}

export function toggleClass(node, className, force) {
  if (!node) return;
  if (typeof force === 'boolean') node.classList.toggle(className, force);
  else node.classList.toggle(className);
}

/* --------------------------------------------------------------------------
   اعداد و متن فارسی
   -------------------------------------------------------------------------- */
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function faDigits(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function enDigits(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function formatFaNumber(n, { pad = 0, group = false } = {}) {
  let num = Number(n) || 0;
  let str = String(num);

  if (group) str = str.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  if (pad > 0) str = str.padStart(pad, '0');

  return faDigits(str);
}

/* --------------------------------------------------------------------------
   امنیت متن
   -------------------------------------------------------------------------- */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripTags(str) {
  return String(str ?? '').replace(/<[^>]*>/g, '');
}

export function truncate(str, max = 120) {
  const s = String(str ?? '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

/* --------------------------------------------------------------------------
   کنترل نرخ
   -------------------------------------------------------------------------- */
export function debounce(fn, wait = 120) {
  let t = null;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function throttle(fn, wait = 120) {
  let last = 0;
  let timer = null;
  return function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/* --------------------------------------------------------------------------
   ذخیره‌سازی محلی (با try/catch برای حالت private)
   -------------------------------------------------------------------------- */
export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  },
};

/* --------------------------------------------------------------------------
   دو-ضربه (Double Tap) — پشتیبانی از ماوس و لمس، بدون دوبار اجرا
   -------------------------------------------------------------------------- */
export function onDblTap(target, handler, { window: win = CONFIG.ui.doubleTapWindow } = {}) {
  if (!target) return () => {};

  let lastTap = 0;
  let lastPointerType = 'mouse';
  let fired = false;

  const run = (event) => {
    if (fired) return;
    fired = true;
    setTimeout(() => { fired = false; }, 40);
    handler(event);
  };

  const onPointerUp = (event) => {
    // در دسکتاپ به dblclick واگذار می‌کنیم تا دوبار اجرا نشود
    if (event.pointerType === 'mouse') {
      lastPointerType = 'mouse';
      return;
    }
    lastPointerType = 'touch';
    const now = Date.now();
    if (now - lastTap < win) {
      lastTap = 0;
      run(event);
    } else {
      lastTap = now;
    }
  };

  const onDblClick = (event) => {
    if (lastPointerType === 'touch') return;
    run(event);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handler(event);
    }
  };

  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('dblclick', onDblClick);
  target.addEventListener('keydown', onKeyDown);

  return () => {
    target.removeEventListener('pointerup', onPointerUp);
    target.removeEventListener('dblclick', onDblClick);
    target.removeEventListener('keydown', onKeyDown);
  };
}

/* --------------------------------------------------------------------------
   کمکی‌های ظاهری
   -------------------------------------------------------------------------- */
export function setCSSVar(name, value, root = document.documentElement) {
  root.style.setProperty(name, value);
}

export function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function slugify(str) {
  return String(str ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\u200c]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/* --------------------------------------------------------------------------
   تشخیص دستگاه
   -------------------------------------------------------------------------- */
export const device = {
  get isMobile() {
    return window.matchMedia('(max-width: 720px)').matches;
  },
  get prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },
  get isTouch() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  },
};

/* --------------------------------------------------------------------------
   Intersection Observer — برای ظاهر شدن نرم کارت‌ها
   -------------------------------------------------------------------------- */
export function observeReveal(nodes, { threshold = 0.12, rootMargin = '0px 0px -8% 0px' } = {}) {
  const list = Array.from(nodes || []).filter(Boolean);
  if (!list.length) return () => {};

  if (!('IntersectionObserver' in window)) {
    list.forEach((n) => n.classList.add('is-revealed'));
    return () => {};
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold, rootMargin }
  );

  list.forEach((n) => {
    n.classList.add('reveal');
    io.observe(n);
  });

  return () => io.disconnect();
}