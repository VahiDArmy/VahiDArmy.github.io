/* =========================================================
   ابزارهای کمکی
   ========================================================= */
window.Utils = (function () {
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fa-IR');
    } catch { return iso; }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  function showLoader(show = true) {
    const el = document.getElementById('global-loader');
    if (el) el.classList.toggle('show', show);
  }

  function ratingStars(r) {
    const n = Math.round(Number(r) || 0);
    if (n <= 0) return '○';
    return '⭐'.repeat(Math.min(5, n));
  }

  function categoryLabel(cat) {
    return (CONFIG.CATEGORIES[cat] || {}).label || cat;
  }

  function categoryEmoji(cat) {
    return (CONFIG.CATEGORIES[cat] || {}).emoji || '🎬';
  }

  return {
    $, $$, debounce, formatDate, escapeHtml, toast, showLoader,
    ratingStars, categoryLabel, categoryEmoji
  };
})();
