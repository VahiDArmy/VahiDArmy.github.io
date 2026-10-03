/* =========================================================
   Glitch layer — برگرفته از پن «Retro glitchy navigation with GSAP» (jdillon)، بدون وابستگی به GSAP.
   همان فیلتر feDisplacementMap با ۲۰ نوار متناوب؛ فقط روی المان‌های ناوبری‌مانند و فقط لحظه‌ای
   (هاور، کلیک، و یک لرزش ریز و گاه‌به‌گاه روی ردیف فعال). با prefers-reduced-motion خاموش می‌شود.
   ========================================================= */
(function () {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const NS = 'http://www.w3.org/2000/svg';
  const HOVER = '.side-item, .side-action, .btn-primary, .title-lookup-btn, .brand-title';
  const AUTO = '#btn-add, #btn-empty-add, .title-lookup-btn';        // روی موبایل خودکار پالس می‌زنند
  const defs = document.createElementNS(NS, 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.setAttribute('aria-hidden', 'true');
  defs.style.cssText = 'position:absolute;pointer-events:none';
  document.body.appendChild(defs);

  const fx = new WeakMap(); let n = 0;
  function filterFor(el) {                      // برای هر المان یک فیلتر مستقل
    if (fx.has(el)) return fx.get(el);
    const id = 'gl-fx-' + (++n); let s = '';
    for (let i = 0; i < 20; i++) s += '<feFlood flood-color="' + (i % 2 ? '#888800' : '#8888FF') + '" y="' + i * 5 + '%" height="5%" result="s' + i + '"/>';
    s += '<feMerge result="bands">' + Array.from({ length: 20 }, (_, i) => '<feMergeNode in="s' + i + '"/>').join('') + '</feMerge>' +
         '<feDisplacementMap in="SourceGraphic" in2="bands" scale="0" xChannelSelector="B" yChannelSelector="R"/>';
    const f = document.createElementNS(NS, 'filter');
    f.setAttribute('id', id); f.setAttribute('primitiveUnits', 'objectBoundingBox'); f.setAttribute('color-interpolation-filters', 'sRGB');
    f.innerHTML = s; defs.appendChild(f);
    const rec = { id: id, map: f.lastElementChild, t: 0, busy: false };
    fx.set(el, rec); return rec;
  }
  function glitch(el, ms, lo, hi) {
    const r = filterFor(el), t0 = performance.now();
    if (r.busy || t0 - r.t < 450) return;       // پشت‌سرهم تکرار نشود
    r.busy = true; r.t = t0; el.style.filter = 'url(#' + r.id + ')';
    (function step(t) {
      const p = (t - t0) / ms;
      if (p >= 1) { r.map.setAttribute('scale', '0'); el.style.filter = ''; r.busy = false; return; }
      r.map.setAttribute('scale', ((lo + Math.random() * (hi - lo)) * (1 - p)).toFixed(3));   // پرش تصادفی با افت تدریجی، مثل RoughEase
      setTimeout(() => step(performance.now()), 45);
    })(t0);
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest(HOVER);
    if (el && !el.contains(e.relatedTarget)) glitch(el, 320, 0.02, 0.1);
  });
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('.side-item');
    if (el) glitch(el, 280, 0.03, 0.12);
  });
  setInterval(() => {                           // ردیف فعال: لرزش خیلی ریز، هر چند ثانیه
    const a = document.querySelector('.side-item.is-active');
    if (a && !document.hidden && !document.body.classList.contains('modal-open')) glitch(a, 180, 0.008, 0.035);
  }, 2600);

  /* موبایل (بدون هاور): لمس ← پالس ۱ ثانیه‌ای؛ دکمه‌های کلیدی هر ۴ ثانیه خودکار ۲ ثانیه پالس می‌زنند */
  function pulse(el, ms) {
    if (el.classList.contains('is-pulse')) return;
    el.classList.add('is-pulse'); glitch(el, 380, 0.03, 0.1);
    setTimeout(() => glitch(el, 300, 0.02, 0.07), ms / 2);
    setTimeout(() => el.classList.remove('is-pulse'), ms);
  }
  if (matchMedia('(hover: none)').matches) {
    document.addEventListener('pointerdown', (e) => {
      const el = e.pointerType === 'touch' && e.target.closest && e.target.closest(HOVER);
      if (el) pulse(el, 1000);
    });
    setInterval(() => {
      if (document.hidden) return;
      const modal = document.body.classList.contains('modal-open');
      Array.from(document.querySelectorAll(AUTO)).forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (!el.getClientRects().length || r.bottom < 0 || r.top > innerHeight) return;
        if (modal && !el.closest('#modal-root')) return;
        setTimeout(() => pulse(el, 2000), i * 500);
      });
    }, 4000);
  }

  const logo = document.querySelector('.boot-logo-text'), boot = document.getElementById('boot-loader');
  if (logo && boot) {                           // لوگوی صفحهٔ بوت تا وقتی نمایان است
    const iv = setInterval(() => {
      if (!boot.isConnected || boot.classList.contains('is-hidden')) return clearInterval(iv);
      glitch(logo, 380, 0.03, 0.14);
    }, 700);
  }
})();
