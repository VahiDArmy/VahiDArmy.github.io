/* =========================================================
   App — bootstrap, auth, shell, routing
   ========================================================= */
window.App = (function () {
  'use strict';

  var currentView = 'library';
  var searchDebounced = null;
  var ready = false;

  /* =========================================================
     Boot
     ========================================================= */
  function boot() {
    var msg = document.getElementById('boot-msg');
    var fill = document.getElementById('boot-fill');

    function step(text, pct) {
      if (msg) msg.textContent = text;
      if (fill) fill.style.width = pct + '%';
    }

    step('آماده‌سازی محیط…', 12);

    if (!window.supabase) {
      step('کتابخانهٔ Supabase بارگذاری نشد — اتصال اینترنت را بررسی کن.', 100);
      showBootError('اتصال به Supabase برقرار نشد. اتصال اینترنت یا مسدودکنندهٔ تبلیغات را بررسی کن.');
      return;
    }

    step('بررسی نشست…', 28);

    DB.init()
      .then(function (loggedIn) {
        if (!loggedIn) {
          step('نیاز به ورود', 100);
          renderAuth();
          hideBoot();
          return;
        }
        step('بارگذاری آرشیو…', 62);
        startApp();
      })
      .catch(function (err) {
        console.error('[boot]', err);
        showBootError(err && err.message ? err.message : 'خطای ناشناخته در اتصال');
      });
  }

  function showBootError(message) {
    var boot = document.getElementById('boot');
    if (!boot) return;
    var box = document.getElementById('boot-error');
    if (box) {
      box.hidden = false;
      box.textContent = message;
    }
    var bar = document.getElementById('boot-bar');
    if (bar) bar.classList.add('is-error');
  }

  function hideBoot() {
    var boot = document.getElementById('boot');
    if (!boot) return;
    boot.classList.add('is-done');
    setTimeout(function () { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 400);
  }

  function startApp() {
    var savedView = localStorage.getItem(CONFIG.STORAGE.VIEW) || 'grid';
    var savedStar = localStorage.getItem(CONFIG.STORAGE.LAST_STAR_FILTER) || 'all';

    State.loadAll();
    State.set({ view: savedView === 'list' ? 'list' : 'grid' });
    State.setStarFilter(savedStar === 'all' ? 'all' : Number(savedStar));
    State.set({ search: '', filterType: 'all', onlyFav: false, onlyRated: false, sort: 'recent' });
    State.applyFilters();

    renderShell();
    document.getElementById('app-shell').hidden = false;
    ready = true;

    go('library');
    refreshNav();
    hideBoot();

    setTimeout(function () {
      var stats = DB.getStats();
      Toast.info('آرشیو آماده است — ' + UI.fa(stats.total || 0) + ' عنوان', {
        title: 'خوش آمدی',
        duration: 4200
      });
    }, 500);
  }

  /* =========================================================
     Auth
     ========================================================= */
  function renderAuth() {
    var host = document.getElementById('auth-root');
    if (!host) return;
    var mode = 'login';

    host.innerHTML = [
      '<div class="authscreen">',
      '  <aside class="authscreen__art">',
      '    <div class="authscreen__brand">' + UI.icon('film') + '<span>سینما من</span></div>',
      '    <h1 class="authscreen__headline">آرشیوی که<br>سلیقه‌ات را<br>به یاد می‌آورد.</h1>',
      '    <p class="authscreen__quote">' + UI.esc((CONFIG.TASTE_PROFILE && CONFIG.TASTE_PROFILE.manifesto) || '') + '</p>',
      '    <ul class="authscreen__points">',
      '      <li>' + UI.icon('star') + 'امتیاز ۰ تا ۵ با معنی مشخص</li>',
      '      <li>' + UI.icon('brain') + 'تحلیل داستانی و پیدا کردن سوراخ‌های روایت</li>',
      '      <li>' + UI.icon('sparkle') + 'پیشنهاد تماشا بر اساس الگوی خودت</li>',
      '    </ul>',
      '  </aside>',
      '  <div class="authcard">',
      '    <div class="authcard__tabs">',
      '      <button class="authcard__tab is-on" type="button" data-mode="login">ورود</button>',
      '      <button class="authcard__tab" type="button" data-mode="signup">ساخت حساب</button>',
      '    </div>',
      '    <form class="authcard__form" novalidate>',
      '      <label class="field"><span class="field__label">ایمیل</span>',
      '        <input class="input" type="email" name="email" autocomplete="email" dir="ltr" required placeholder="you@example.com" />',
      '      </label>',
      '      <label class="field"><span class="field__label">رمز عبور</span>',
      '        <input class="input" type="password" name="password" autocomplete="current-password" dir="ltr" required minlength="6" placeholder="••••••••" />',
      '      </label>',
      '      <p class="authcard__error" data-error role="alert"></p>',
      '      <button class="btn is-primary btn--block" type="submit" data-submit>ورود به آرشیو</button>',
      '      <p class="authcard__note" data-note></p>',
      '    </form>',
      '  </div>',
      '</div>'
    ].join('');

    var form = host.querySelector('form');
    var errorEl = host.querySelector('[data-error]');
    var noteEl = host.querySelector('[data-note]');
    var submit = host.querySelector('[data-submit]');

    host.querySelectorAll('[data-mode]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        mode = tab.dataset.mode;
        host.querySelectorAll('[data-mode]').forEach(function (t) { t.classList.toggle('is-on', t === tab); });
        submit.textContent = mode === 'login' ? 'ورود به آرشیو' : 'ساخت حساب';
        errorEl.textContent = '';
        noteEl.textContent = '';
      });
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = form.querySelector('[name="email"]').value.trim();
      var password = form.querySelector('[name="password"]').value;
      errorEl.textContent = '';
      noteEl.textContent = '';

      if (!email || !password) {
        errorEl.textContent = 'ایمیل و رمز عبور را وارد کن.';
        return;
      }

      submit.disabled = true;
      submit.textContent = mode === 'login' ? 'در حال ورود…' : 'در حال ساخت…';

      var action = mode === 'login' ? DB.signIn(email, password) : DB.signUp(email, password);

      action.then(function (data) {
        if (mode === 'signup' && data && !data.session) {
          noteEl.textContent = 'حساب ساخته شد. لینک تأیید را از ایمیل باز کن و بعد وارد شو.';
          submit.disabled = false;
          submit.textContent = 'ساخت حساب';
          return;
        }
        return DB.init().then(function (ok) {
          if (!ok) throw new Error('نشست معتبر نشد');
          var authHost = document.getElementById('auth-root');
          if (authHost) authHost.innerHTML = '';
          startApp();
        });
      }).catch(function (err) {
        var text = (err && err.message) ? err.message : 'خطا در ورود';
        if (/Invalid login credentials/i.test(text)) text = 'ایمیل یا رمز عبور درست نیست.';
        if (/Email not confirmed/i.test(text)) text = 'ایمیل تأیید نشده. صندوق ورودی را بررسی کن.';
        errorEl.textContent = text;
        submit.disabled = false;
        submit.textContent = mode === 'login' ? 'ورود به آرشیو' : 'ساخت حساب';
      });
    });

    setTimeout(function () {
      var first = form.querySelector('[name="email"]');
      if (first) first.focus();
    }, 120);
  }

  /* =========================================================
     Shell
     ========================================================= */
  function navButton(view, label, iconName) {
    return '<button class="navbtn' + (currentView === view ? ' is-on' : '') + '" type="button" data-nav="' + view + '">' +
      UI.icon(iconName) + '<span>' + label + '</span></button>';
  }

  function renderShell() {
    var shell = document.getElementById('app-shell');
    var user = DB.getUser();

    shell.innerHTML = [
      '<header class="topbar">',
      '  <button class="iconbtn topbar__menu" type="button" data-act="menu" aria-label="منو">' + UI.icon('menu') + '</button>',
      '  <a class="brand" href="#" data-act="home">',
      '    <span class="brand__mark">' + UI.icon('film') + '</span>',
      '    <span class="brand__text"><strong>سینما من</strong><em>آرشیو شخصی</em></span>',
      '  </a>',
      '  <div class="searchbox">',
      UI.icon('search'),
      '    <input id="global-search" type="search" placeholder="جستجو در عنوان‌ها، ژانر، یادداشت…" autocomplete="off" spellcheck="false" />',
      '    <button class="iconbtn searchbox__clear" type="button" data-act="clear-search" aria-label="پاک کردن" hidden>' + UI.icon('close') + '</button>',
      '    <kbd class="searchbox__kbd">Ctrl K</kbd>',
      '  </div>',
      '  <div class="topbar__actions">',
      '    <button class="iconbtn" type="button" data-act="palette" title="دستورها (Ctrl+K)">' + UI.icon('terminal') + '</button>',
      '    <button class="iconbtn" type="button" data-act="insights" title="تحلیل و آمار">' + UI.icon('chart') + '</button>',
      '    <button class="iconbtn" type="button" data-act="settings" title="تنظیمات">' + UI.icon('gear') + '</button>',
      '    <button class="avatar" type="button" data-act="account" title="' + UI.esc(user && user.email ? user.email : 'حساب') + '">' +
        UI.esc(UI.initials(user && user.email)) + '</button>',
      '  </div>',
      '</header>',
      '<div class="workspace">',
      '  <aside class="side" id="side">',
      '    <div class="side__inner">',
      '      <div class="navgroup">',
      '        <p class="navlabel">آرشیو</p>',
      navButton('library', 'همهٔ عنوان‌ها', 'film'),
      navButton('insights', 'تحلیل و آمار', 'chart'),
      navButton('ai', 'استودیوی هوش مصنوعی', 'sparkle'),
      '      </div>',
      '      <div class="navgroup">',
      '        <p class="navlabel">بر اساس امتیاز</p>',
      '        <button class="navbtn' + (State.get().starFilter === 'all' ? ' is-on' : '') + '" type="button" data-star="all">',
      '          <span class="navbtn__stars">' + UI.meter(0) + '</span><span>همه</span><b class="navcount" data-count="all">۰</b>',
      '        </button>',
      [5, 4, 3, 2, 1].map(function (n) {
        var meta = UI.starMeta(n);
        return '<button class="navbtn' + (String(State.get().starFilter) === String(n) ? ' is-on' : '') + '" type="button" data-star="' + n + '">' +
          '<span class="navbtn__stars" style="--star:' + meta.color + '">' + UI.meter(n) + '</span>' +
          '<span>' + UI.esc(meta.label) + '</span><b class="navcount" data-count="' + n + '">۰</b></button>';
      }).join(''),
      '        <button class="navbtn' + (String(State.get().starFilter) === '0' ? ' is-on' : '') + '" type="button" data-star="0">',
      '          <span class="navbtn__stars">' + UI.icon('star') + '</span><span>بدون امتیاز</span><b class="navcount" data-count="0">۰</b>',
      '        </button>',
      '      </div>',
      '      <div class="navgroup">',
      '        <p class="navlabel">نوع</p>',
      '        <button class="navbtn' + (State.get().filterType === 'all' ? ' is-on' : '') + '" type="button" data-type="all">',
      '          <span>همه</span><b class="navcount" data-type-count="all">۰</b></button>',
      Object.keys(CONFIG.TYPES).map(function (key) {
        return '<button class="navbtn' + (State.get().filterType === key ? ' is-on' : '') + '" type="button" data-type="' + key + '">' +
          '<span>' + UI.esc(CONFIG.TYPES[key]) + '</span><b class="navcount" data-type-count="' + key + '">۰</b></button>';
      }).join(''),
      '      </div>',
      '      <div class="side__foot">',
      '        <div class="side__sum"><span>میانگین امتیاز</span><strong data-side-avg>—</strong></div>',
      '        <div class="side__sum"><span>علاقه‌مندی</span><strong data-side-fav>۰</strong></div>',
      '      </div>',
      '    </div>',
      '  </aside>',
      '  <div class="side__scrim" data-act="close-menu"></div>',
      '  <main class="canvas" id="canvas"></main>',
      '</div>'
    ].join('');

    bindShell();
    refreshModelChips();
  }

  function bindShell() {
    var shell = document.getElementById('app-shell');

    UI.on(shell, 'click', '[data-nav]', function (ev, target) { go(target.dataset.nav); });

    UI.on(shell, 'click', '[data-star]', function (ev, target) {
      var value = target.dataset.star;
      State.setStarFilter(value === 'all' ? 'all' : Number(value));
      State.applyFilters();
      if (currentView !== 'library') go('library');
      else UI.Library.renderList();
      refreshNav();
      closeMenu();
    });

    UI.on(shell, 'click', '[data-type]', function (ev, target) {
      var value = target.dataset.type;
      State.set({ filterType: value });
      State.applyFilters();
      if (currentView !== 'library') go('library');
      else UI.Library.renderList();
      refreshNav();
      closeMenu();
    });

    UI.on(shell, 'click', '[data-act="settings"], [data-act="account"]', function () { UI.Settings.open(); });
    UI.on(shell, 'click', '[data-act="insights"]', function () { go('insights'); });
    UI.on(shell, 'click', '[data-act="palette"]', function () { UI.Palette.open(); });
    UI.on(shell, 'click', '[data-act="home"]', function (ev) { ev.preventDefault(); go('library'); });
    UI.on(shell, 'click', '[data-act="menu"]', function () {
      var side = document.getElementById('side');
      if (!side) return;
      var open = side.classList.toggle('is-open');
      document.body.classList.toggle('has-menu', open);
    });
    UI.on(shell, 'click', '[data-act="close-menu"]', closeMenu);

    var search = document.getElementById('global-search');
    if (search) {
      var clear = shell.querySelector('[data-act="clear-search"]');
      searchDebounced = Utils.debounce(function (value) {
        State.set({ search: value });
        State.applyFilters();
        if (currentView !== 'library') go('library');
        else UI.Library.renderList();
        refreshNav();
      }, 200);
      search.addEventListener('input', function () {
        if (clear) clear.hidden = !search.value;
        searchDebounced(search.value);
      });
      search.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') { search.value = ''; search.dispatchEvent(new Event('input')); search.blur(); }
      });
      clear.addEventListener('click', function () {
        search.value = '';
        search.dispatchEvent(new Event('input'));
        search.focus();
      });
    }

    document.addEventListener('keydown', onKeyDown);
  }

  function onKeyDown(ev) {
    if (!ready) return;
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    var typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (document.activeElement && document.activeElement.isContentEditable);

    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      UI.Palette.open();
      return;
    }
    if (typing) return;
    if (ev.key === 'n' || ev.key === 'N') {
      ev.preventDefault();
      UI.Item.openForm(null);
    } else if (ev.key === '/') {
      ev.preventDefault();
      var search = document.getElementById('global-search');
      if (search) search.focus();
    }
  }

  function closeMenu() {
    var side = document.getElementById('side');
    if (side) side.classList.remove('is-open');
    document.body.classList.remove('has-menu');
  }

  function setSearch(value) {
    var search = document.getElementById('global-search');
    if (!search) return;
    search.value = value || '';
    search.dispatchEvent(new Event('input'));
  }

  /* =========================================================
     Routing & refresh
     ========================================================= */
  function go(view, tab) {
    currentView = view;
    var canvas = document.getElementById('canvas');
    if (!canvas) return;
    UI.clear(canvas);

    var page = document.createElement('div');
    page.className = 'view view--' + view;
    canvas.appendChild(page);

    if (view === 'insights') UI.Insights.render(page);
    else if (view === 'ai') UI.AIStudio.render(page);
    else UI.Library.render(page);

    if (view === 'ai' && tab) UI.AIStudio.setTab(tab);

    UI.qsa('[data-nav]').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.dataset.nav === view);
    });
    canvas.scrollTop = 0;
    window.scrollTo({ top: 0 });
    closeMenu();
  }

  function refresh() {
    if (!ready) return;
    if (currentView === 'library') {
      var list = UI.qs('[data-lib-list]');
      if (list) UI.Library.renderList();
      else UI.Library.render(UI.qs('#canvas .view'));
    } else if (currentView === 'insights') {
      UI.Insights.render(UI.qs('#canvas .view'));
    }
    refreshNav();
  }

  function refreshNav() {
    var stats = DB.getStats();
    var counts = DB.getStarCounts();
    var titles = State.get().titles || [];

    UI.qsa('[data-count]').forEach(function (el) {
      var key = el.dataset.count;
      el.textContent = UI.fa(key === 'all' ? (counts.all != null ? counts.all : titles.length) : (counts[Number(key)] || 0));
    });
    UI.qsa('[data-type-count]').forEach(function (el) {
      var key = el.dataset.typeCount;
      var value = key === 'all' ? titles.length : titles.filter(function (t) { return t.type === key; }).length;
      el.textContent = UI.fa(value);
    });
    var avg = UI.qs('[data-side-avg]');
    if (avg) avg.textContent = stats.avgRating ? UI.fa(stats.avgRating.toFixed(1)) : '—';
    var fav = UI.qs('[data-side-fav]');
    if (fav) fav.textContent = UI.fa(stats.favoriteCount || 0);

    var star = State.get().starFilter;
    UI.qsa('[data-star]').forEach(function (btn) {
      btn.classList.toggle('is-on', String(btn.dataset.star) === String(star));
    });
    UI.qsa('[data-type]').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.dataset.type === State.get().filterType);
    });
  }

  function refreshModelChips() {
    var chips = UI.qsa('[data-modelchip]');
    chips.forEach(function (chip) {
      var meta = AI.getModelMeta();
      chip.innerHTML = '<span class="modelchip__dot"></span>' +
        '<span class="modelchip__text"><em>مدل فعال</em><strong>' + UI.esc(meta.label || meta.id) + '</strong></span>';
    });
    UI.AIStudio.refreshModels();
  }

  function quickFilter(patch) {
    State.set(patch);
    State.applyFilters();
    go('library');
    refreshNav();
  }

  function resetLibraryFilters() {
    State.set({ filterType: 'all', onlyFav: false, onlyRated: false, search: '', sort: 'recent', starFilter: 'all' });
    State.setStarFilter('all');
    State.applyFilters();
    setSearch('');
    refreshNav();
  }

  return {
    boot: boot,
    go: go,
    refresh: refresh,
    refreshNav: refreshNav,
    refreshModelChips: refreshModelChips,
    setSearch: setSearch,
    quickFilter: quickFilter,
    resetLibraryFilters: resetLibraryFilters
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', App.boot);
} else {
  App.boot();
}
