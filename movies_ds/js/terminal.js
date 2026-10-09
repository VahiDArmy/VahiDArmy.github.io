/* =========================================================
   لایهٔ ترمینال — فقط روی DOM و API عمومی (State / CONFIG / Utils) سوار می‌شود؛
   منطق اصلی برنامه دست‌نخورده می‌ماند: هر دستور همان دکمه/فیلتر موجود را می‌زند.
   ========================================================= */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const fa = (v) => (window.Utils && Utils.toFa ? Utils.toFa(v) : String(v));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const titles = () => (window.State && State.get().titles) || [];
  const TYPES = (window.CONFIG && CONFIG.TYPES) || {};
  const rate = (t) => Math.floor(Number(t.rating) || 0);
  const when = (t) => { const d = new Date(t.created_at); return isNaN(d) ? 0 : d.getTime(); };
  const cmd = $('#cmd'), out = $('#cmd-out'), grid = $('#grid'), rail = $('#rail');
  if (!cmd || !grid || !rail) return;

  /* ── ساعت زنده ── */
  const clock = $('#hd-clock');
  const tick = () => { const d = new Date(); clock.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':'); };
  tick(); setInterval(tick, 1000);

  /* ── کمک‌ها: هر عمل از مسیر کنترل‌های خود برنامه می‌گذرد ── */
  let st;
  function say(m, bad) { out.textContent = m; out.classList.toggle('is-bad', !!bad); clearTimeout(st); st = setTimeout(() => { out.textContent = ''; }, 3200); }
  const click = (s) => { const el = $(s); if (el) el.click(); return !!el; };
  const setVal = (s, v) => { const el = $(s); if (!el) return false; el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); return el.value === v; };
  const search = (v) => { const s = $('#global-search'); if (!s) return false; s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); return true; };
  const isList = () => grid.classList.contains('is-list');

  const SORTS = { recent: 'recent', new: 'recent', old: 'oldest', oldest: 'oldest', rating: 'rating-desc', top: 'rating-desc', low: 'rating-asc', name: 'title-asc', title: 'title-asc', 'title-desc': 'title-desc', year: 'year-desc' };
  const CMDS = {
    star: (a) => click('.side-item[data-star="' + (a || 'all') + '"]') && 'star ' + (a || 'all'),
    type: (a) => setVal('#filter-type', a || 'all') && 'type ' + (a || 'all'),
    sort: (a) => SORTS[a] && setVal('#filter-sort', SORTS[a]) && 'sort ' + SORTS[a],
    fav: () => click('#filter-favorite') && 'favorites toggled',
    rated: () => click('#filter-rated') && 'rated-only toggled',
    view: (a) => { const v = a === 'list' ? 'list' : 'grid'; return click('.view-btn[data-view="' + v + '"]') && 'view ' + v; },
    reset: () => {
      click('.side-item[data-star="all"]'); setVal('#filter-type', 'all'); setVal('#filter-sort', 'recent');
      ['#filter-favorite', '#filter-rated'].forEach((s) => { const c = $(s); if (c && c.checked) c.click(); });
      search(''); return 'filters cleared';
    },
    add: () => click('#btn-add') && 'new title', stats: () => click('#btn-stats') && 'stats', theme: () => click('#btn-theme') && 'theme',
    settings: () => click('#btn-settings') && 'settings', export: () => click('#btn-export') && 'export json', import: () => click('#btn-import') && 'import json',
    pull: () => click('#btn-pull') && 'pull from github', push: () => click('#btn-push') && 'push to github',
    ai: () => click('#btn-ai-analyze') && 'ai analyze', prompt: () => click('#btn-free-prompt') && 'free prompt',
    db: () => { if (!window.DBAdmin) return false; DBAdmin.open(); return 'db admin'; },
    help: () => { help.hidden = false; return 'help'; }
  };
  function run(line) {
    line = (line || '').trim(); if (!line) return;
    const p = line.split(/\s+/), h = CMDS[p[0].toLowerCase()], m = h && h(p.slice(1).join(' ').toLowerCase());
    if (m) say('✓ ' + m); else { search(line); say('search: ' + line); }   // هر چیزی که دستور نیست ← جستجو
  }

  /* ── راهنما ── */
  const help = document.createElement('div');
  help.className = 'cmd-help'; help.hidden = true;
  help.innerHTML = '<div class="ch-h"><span>COMMANDS</span><kbd>Esc</kbd></div><div class="ch-g">' + [
    ['star 5 · 4 · 3 · 2 · 1 · 0 · all', 'فیلتر ستاره'], ['type movie · series · anime · documentary', 'فیلتر نوع'],
    ['sort rating · recent · old · name · year · low', 'مرتب‌سازی'], ['fav · rated · view list · reset', 'علاقه‌مندی، امتیازدار، نما، پاک‌کردن'],
    ['add · stats · theme · settings', 'میان‌بر دکمه‌ها'], ['export · import · pull · push · ai · prompt', 'ابزارها و هوش مصنوعی'],
    ['db', 'مدیریت دیتابیس'], ['هر متن دیگر', 'جستجو']
  ].map((r) => '<code>' + r[0] + '</code><span>' + r[1] + '</span>').join('') + '</div><div class="ch-k">' + [
    ['J K', 'حرکت'], ['O', 'باز کردن'], ['F', 'علاقه‌مندی'], ['E', 'ویرایش'], ['A', 'تحلیل AI'], ['0-5', 'ستاره'], ['R', 'ریست'], ['V', 'نما'], ['T', 'تم'], ['/', 'جستجو'], [':', 'دستور'], ['N', 'جدید'], ['S', 'آمار'], ['D', 'دیتابیس']
  ].map((k) => '<span><kbd>' + k[0] + '</kbd> ' + k[1] + '</span>').join('') + '</div>';
  document.body.appendChild(help);

  /* ── ورودی دستور: Enter اجرا · ↑↓ تاریخچه · Tab تکمیل ── */
  const hist = []; let hi = -1;
  cmd.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { if (cmd.value.trim()) { hist.unshift(cmd.value); hi = -1; run(cmd.value); } cmd.value = ''; }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); hi = Math.max(-1, Math.min(hist.length - 1, hi + (e.key === 'ArrowUp' ? 1 : -1))); cmd.value = hi < 0 ? '' : hist[hi]; }
    else if (e.key === 'Tab') { e.preventDefault(); const q = cmd.value.trim().toLowerCase(), m = q && Object.keys(CMDS).find((c) => c.startsWith(q)); if (m) cmd.value = m + ' '; }
  });

  /* ── ناوبری با کیبورد روی کارت‌ها ── */
  let keep = null;
  const cards = () => $$('#grid .card');
  const cur = () => cards().indexOf(document.activeElement && document.activeElement.closest('.card'));
  function move(d) {
    const cs = cards(); if (!cs.length) return;
    const i = cur(), n = Math.max(0, Math.min(cs.length - 1, i < 0 ? (d > 0 ? 0 : cs.length - 1) : i + d));
    cs[n].focus(); cs[n].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function onCard(fn) { const c = cards()[cur()]; if (c) { keep = c.dataset.id; setTimeout(() => { keep = null; }, 1200); fn(c); } else say('✗ focus a card first — J / K', true); }
  const act = (n) => onCard((c) => { const b = $('[data-act="' + n + '"]', c); if (b) b.click(); });
  const focusEl = (s) => { const el = $(s); if (el) { el.focus(); if (el.select) el.select(); } };

  const KEYS = {
    j: () => move(1), k: () => move(-1), o: () => onCard((c) => c.click()), f: () => act('fav'), e: () => act('edit'), a: () => act('ai'),
    r: () => run('reset'), v: () => run('view ' + (isList() ? 'grid' : 'list')), t: () => run('theme'),
    d: () => run('db'),
    '/': () => focusEl('#global-search'), ':': () => focusEl('#cmd'), '?': () => { help.hidden = !help.hidden; }
  };
  document.addEventListener('keydown', (e) => {
    const t = e.target, field = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    if (e.key === 'Escape') { if (t === cmd) { cmd.value = ''; cmd.blur(); } help.hidden = true; return; }
    if (field || e.ctrlKey || e.metaKey || e.altKey || document.body.classList.contains('modal-open')) return;
    if (/^[0-5]$/.test(e.key)) { e.preventDefault(); run('star ' + e.key); return; }
    if (KEYS[e.key]) { e.preventDefault(); KEYS[e.key](); }
  });

  /* ── پنل‌های زندهٔ ستون کناری ── */
  function bars(ul, rows) {
    const mx = Math.max(1, ...rows.map((r) => r.n));
    ul.innerHTML = rows.map((r) => '<li class="rl-row"' + (r.s ? ' data-stars="' + r.s + '"' : '') + ' data-go="' + esc(r.go) + '" tabindex="0"><span class="rl-k">' + r.k + '</span><span class="rl-bar"><i style="width:' + Math.round((r.n / mx) * 100) + '%"></i></span><em>' + fa(r.n) + '</em></li>').join('');
  }
  function drawTicker(all) {
    const el = $('#tk-inner'); if (!el) return;
    const recent = all.slice().sort((a, b) => when(b) - when(a)).slice(0, 14);
    el.innerHTML = recent.length ? recent.map((t) => { const r = rate(t);
      return '<span class="tk-item"><b class="tk-tag"' + (r ? ' data-stars="' + r + '"' : '') + '>' + (r ? '★' + r : '○') + '</b><bdi>' + esc(t.title) + '</bdi></span><span class="tk-sep">◆</span>'; }).join('')
      : '<span class="tk-item">NO DATA — N برای افزودن اولین عنوان</span>';
    el.style.animationDuration = Math.max(24, recent.length * 5) + 's';
  }
  function refresh() {
    const all = titles(), rated = all.filter((t) => rate(t) > 0);
    $('#hd-total').textContent = fa(all.length);
    $('#hd-avg').textContent = rated.length ? fa((rated.reduce((s, t) => s + Number(t.rating), 0) / rated.length).toFixed(1)) : '—';
    bars($('#rail-stars'), [5, 4, 3, 2, 1, 0].map((s) => ({ s: s, k: s ? '★' + s : '○', n: all.filter((t) => rate(t) === s).length, go: 'star ' + s })));
    const byType = {}; all.forEach((t) => { const k = t.type || '—'; byType[k] = (byType[k] || 0) + 1; });
    bars($('#rail-types'), Object.keys(byType).sort((a, b) => byType[b] - byType[a]).map((k) => ({ k: esc(TYPES[k] || k), n: byType[k], go: 'type ' + k })));
    const W = 12, wk = 6048e5, now = Date.now(), bk = new Array(W).fill(0);
    all.forEach((t) => { const w = when(t), i = W - 1 - Math.floor((now - w) / wk); if (w && i >= 0 && i < W) bk[i]++; });
    const mx = Math.max(1, ...bk), pts = bk.map((v, i) => ((i * 200) / (W - 1)).toFixed(1) + ',' + (54 - (v / mx) * 46).toFixed(1)).join(' ');
    $('#sp-line').setAttribute('points', pts);
    $('#sp-fill').setAttribute('points', '0,60 ' + pts + ' 200,60');
    $('#rail-act-meta').textContent = '+' + fa(bk.reduce((s, v) => s + v, 0)) + ' · 12W';
    const top = rated.filter((t) => rate(t) >= 4).sort((a, b) => rate(b) - rate(a) || (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || when(b) - when(a)).slice(0, 5);
    $('#rail-picks').innerHTML = top.length ? top.map((t, i) => '<li data-stars="' + rate(t) + '" data-id="' + esc(t.id) + '" tabindex="0"><b>' + (i + 1) + '</b><span>' + esc(t.title) + '</span><em>★' + rate(t) + '</em></li>').join('') : '<li class="rl-empty">هنوز عنوان ۴+ ستاره‌ای نیست</li>';
    drawTicker(all);
  }
  function decorate() {           // نشان NEW برای عنوان‌های کمتر از ۴۸ ساعت
    const map = new Map(titles().map((t) => [String(t.id), t]));
    $$('#grid .card').forEach((c) => {
      const t = map.get(c.dataset.id), m = $('.card-meta', c);
      if (t && m && when(t) && !$('.tm-new', m) && Date.now() - when(t) < 1728e5) m.insertAdjacentHTML('beforeend', '<span class="tm-new">NEW</span>');
    });
    if (keep) { const c = $('#grid .card[data-id="' + keep + '"]'); if (c) c.focus({ preventScroll: true }); keep = null; }
  }
  let timer;
  const queue = () => { clearTimeout(timer); timer = setTimeout(() => { refresh(); decorate(); }, 60); };
  new MutationObserver(queue).observe(grid, { childList: true });
  if (window.State) ['filtered', 'titles:loaded', 'title:added', 'title:updated', 'title:deleted', 'title:restored'].forEach((ev) => State.on(ev, queue));
  queue();

  rail.addEventListener('click', (e) => {
    const r = e.target.closest('[data-go]'); if (r) return run(r.dataset.go);
    const p = e.target.closest('[data-id]'); if (!p) return;
    const c = $('#grid .card[data-id="' + p.dataset.id + '"]');
    if (c) { c.focus(); c.scrollIntoView({ block: 'center', behavior: 'smooth' }); } else search($('span', p).textContent);
  });
  rail.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.click) e.target.click(); });
})();