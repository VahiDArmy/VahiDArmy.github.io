/* =========================================================
   Item surfaces — detail drawer, form, AI per title
   ========================================================= */
(function (UI) {
  'use strict';

  var drawer = null;
  var activeId = null;

  /* =========================================================
     Detail drawer
     ========================================================= */
  function ensureDrawer() {
    if (drawer && document.body.contains(drawer)) return drawer;
    drawer = UI.nodeFromHTML([
      '<div class="drawer" id="drawer" aria-hidden="true">',
      '  <div class="drawer__scrim" data-act="close"></div>',
      '  <aside class="drawer__panel" role="dialog" aria-modal="true" aria-label="جزئیات عنوان">',
      '    <div class="drawer__body" data-drawer-body></div>',
      '    <div class="drawer__foot" data-drawer-foot></div>',
      '  </aside>',
      '</div>'
    ].join(''));
    document.body.appendChild(drawer);

    drawer.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-act="close"]')) closeDetail();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && drawer && drawer.classList.contains('is-open') && !document.getElementById('dlg-root').classList.contains('is-open')) {
        closeDetail();
      }
    });
    return drawer;
  }

  function closeDetail() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-drawer');
    activeId = null;
  }

  function kv(label, value) {
    if (value == null || value === '' || value === 0) return '';
    return '<div class="kv"><dt>' + UI.esc(label) + '</dt><dd>' + UI.esc(value) + '</dd></div>';
  }

  function section(title, inner, extra) {
    if (!inner) return '';
    return '<section class="sec' + (extra ? ' ' + extra : '') + '">' +
      '<h3 class="sec__title">' + UI.esc(title) + '</h3>' + inner + '</section>';
  }

  function storyFrom(t) {
    var raw = t.story_analysis;
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    var parsed = Utils.safeParse(raw, null);
    return parsed && typeof parsed === 'object' ? parsed : null;
  }

  function listBlock(title, items, kind) {
    if (!Array.isArray(items) || !items.length) return '';
    var rows = items.map(function (item) {
      if (typeof item === 'string') return '<li>' + UI.esc(item) + '</li>';
      var head = item.location || item.scene || item.type || '';
      var sev = item.severity || '';
      var body = item.issue || item.what_happened || item.rule_broken || item.technique || item.why || item.why_assumes_stupidity || '';
      var extra = item.cascade ? '<p class="storyline__cascade">اثر زنجیره‌ای: ' + UI.esc(item.cascade) + '</p>' : '';
      return '<li class="storyline">' +
        (head ? '<span class="storyline__head">' + UI.esc(head) + '</span>' : '') +
        (sev ? '<span class="chip chip--sev">' + UI.esc(sev) + '</span>' : '') +
        (body ? '<p>' + UI.esc(body) + '</p>' : '') + extra +
        '</li>';
    }).join('');
    return '<div class="storyblock storyblock--' + kind + '"><h4>' + UI.esc(title) + '</h4><ul>' + rows + '</ul></div>';
  }

  function storyHTML(story) {
    if (!story) return '';
    return [
      listBlock('سوراخ‌های داستانی', story.plot_holes, 'bad'),
      listBlock('جایی که بیننده احمق فرض شد', story.assumed_stupidity, 'bad'),
      listBlock('نقاط قوت', story.strengths, 'good'),
      listBlock('نقاط ضعف', story.weaknesses, 'warn'),
      listBlock('نتیجه‌های به‌دست‌آمده', story.earned_outcomes, 'good'),
      listBlock('نتیجه‌های تحمیل‌شده', story.forced_outcomes, 'warn'),
      story.deep_analyzed_at ? '<p class="muted">تحلیل فصل‌به‌فصل: ' + UI.esc(UI.timeAgo(story.deep_analyzed_at)) + '</p>' : '',
      story.analyzed_at ? '<p class="muted">آخرین تحلیل: ' + UI.esc(UI.timeAgo(story.analyzed_at)) + '</p>' : ''
    ].join('');
  }

  function ratingControl(value) {
    var out = '<div class="rating" data-rating-control>';
    for (var i = 0; i <= 5; i++) {
      var meta = UI.starMeta(i);
      out += '<button type="button" class="rating__btn' + (i === value ? ' is-on' : '') + '" data-rate="' + i + '" ' +
        'style="--star:' + meta.color + '" title="' + UI.esc(meta.label) + '">' +
        (i === 0 ? '○' : UI.fa(i)) + '</button>';
    }
    out += '<span class="rating__label" data-rating-label>' + UI.esc(UI.starMeta(value).label) + '</span>';
    out += '</div>';
    return out;
  }

  function detailHTML(t) {
    var rating = Math.floor(Number(t.rating) || 0);
    var meta = UI.starMeta(rating);
    var story = storyFrom(t);
    var convos = DB.getConversationsByTitle(t.id) || [];

    var kicker = [UI.typeLabel(t.type), t.year ? UI.fa(t.year) : '', t.genre || '']
      .filter(Boolean).join(' · ');

    var details = '';
    if (t.seasons) details += kv('فصل‌ها', UI.fa(t.seasons));
    if (t.episodes) details += kv('قسمت‌ها', UI.fa(t.episodes));
    if (t.episodes_per_season) details += kv('قسمت در فصل', UI.fa(t.episodes_per_season));
    if (t.country) details += kv('کشور', t.country);
    if (t.language) details += kv('زبان', t.language);
    if (t.status === 'will_watch') details += kv('وضعیت', 'در فهرست «خواهم دید»');
    else if (t.status) details += kv('وضعیت', t.status);
    if (t.watched_date) details += kv('تاریخ تماشا', Utils.toJalali(t.watched_date));
    details += kv('افزوده شده', Utils.toJalali(t.created_at));
    if (t.ai_standardized_at) details += kv('استانداردسازی', UI.timeAgo(t.ai_standardized_at));

    var convHTML = convos.length ? convos.map(function (c) {
      return '<button class="histitem" data-conv="' + UI.esc(c.id) + '" type="button">' +
        '<span class="histitem__title">' + UI.esc((c.prompt || 'گفتگو').slice(0, 70)) + '</span>' +
        '<span class="histitem__meta">' + UI.esc(UI.timeAgo(c.created_at)) + '</span>' +
        '</button>';
    }).join('') : '';

    return [
      '<header class="drawer__head" style="--star:' + meta.color + '">',
      '  <div class="drawer__top">',
      '    <span class="drawer__kicker">' + UI.esc(kicker) + '</span>',
      '    <button class="iconbtn" data-act="close" type="button" aria-label="بستن">' + UI.icon('close') + '</button>',
      '  </div>',
      '  <h2 class="drawer__title">' + UI.esc(t.title) + '</h2>',
      (t.original_title ? '  <p class="drawer__orig" dir="ltr">' + UI.esc(t.original_title) + '</p>' : ''),
      '  <div class="drawer__badges">' +
        (t.favorite ? '<span class="badge badge--fav">' + UI.icon('heart') + 'علاقه‌مندی</span>' : '') +
        (t.ai_standardized_at ? '<span class="badge badge--ai">' + UI.icon('wand') + 'استانداردشده</span>' : '') +
        (story ? '<span class="badge">' + UI.icon('layers') + 'تحلیل داستانی</span>' : '') +
      '  </div>',
      '  <div class="drawer__rating">' + ratingControl(rating) + '</div>',
      '</header>',
      '<div class="drawer__sections">',
      section('چرا این امتیاز', t.reason ? '<p class="lead">' + UI.esc(t.reason) + '</p>' : ''),
      section('یادداشت من', t.notes ? '<p>' + UI.esc(t.notes) + '</p>' : ''),
      section('خلاصه', t.summary ? '<p>' + UI.esc(t.summary) + '</p>' : ''),
      section('مشخصات', details ? '<dl class="kvlist">' + details + '</dl>' : ''),
      section('تحلیل داستان', storyHTML(story)),
      section('گفتگوهای AI', convHTML ? '<div class="histlist">' + convHTML + '</div>' : ''),
      '</div>'
    ].join('');
  }

  function footHTML(t) {
    return [
      '<button class="btn is-primary" data-act="edit" type="button">' + UI.icon('edit') + 'ویرایش</button>',
      '<button class="btn is-quiet" data-act="standardize" type="button">' + UI.icon('wand') + 'استانداردسازی</button>',
      '<button class="btn is-quiet" data-act="analyze" type="button">' + UI.icon('brain') + 'تحلیل داستانی</button>',
      '<button class="btn is-quiet" data-act="fav" type="button">' + UI.icon('heart') + (t.favorite ? 'حذف از علاقه‌مندی' : 'علاقه‌مندی') + '</button>',
      '<button class="btn is-danger is-icon" data-act="delete" type="button" aria-label="حذف">' + UI.icon('trash') + '</button>'
    ].join('');
  }

  function paintDetail(id) {
    var t = DB.getTitle(id);
    if (!t) return closeDetail();
    var d = ensureDrawer();
    d.querySelector('[data-drawer-body]').innerHTML = detailHTML(t);
    d.querySelector('[data-drawer-foot]').innerHTML = footHTML(t);
    activeId = id;

    var ctrl = d.querySelector('[data-rating-control]');
    if (ctrl) {
      ctrl.onclick = function (ev) {
        var btn = ev.target.closest('[data-rate]');
        if (!btn) return;
        var value = Number(btn.dataset.rate);
        State.setRating(id, value);
        paintDetail(id);
        App.refresh();
      };
    }

    d.querySelector('[data-drawer-body]').onclick = function (ev) {
      var convo = ev.target.closest('[data-conv]');
      if (convo) showConversation(convo.dataset.conv);
    };

    d.querySelector('[data-drawer-foot]').onclick = function (ev) {
      var btn = ev.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.dataset.act;
      if (act === 'edit') { closeDetail(); openForm(id); }
      if (act === 'fav') { State.toggleFavorite(id); paintDetail(id); App.refresh(); }
      if (act === 'delete') { closeDetail(); removeTitle(id); }
      if (act === 'standardize') standardize(id);
      if (act === 'analyze') analyze(id);
    };
  }

  function openDetail(id) {
    var d = ensureDrawer();
    paintDetail(id);
    d.classList.add('is-open');
    d.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-drawer');
    setTimeout(function () {
      var first = d.querySelector('.drawer__panel button');
      if (first) first.focus();
    }, 60);
  }

  function showConversation(id) {
    var c = DB.getConversation(id);
    if (!c) return;
    var body = UI.el('div', { class: 'convo' }, [
      UI.el('div', { class: 'convo__meta' }, [
        UI.el('span', { text: UI.timeAgo(c.created_at) }),
        c.ai_model ? UI.el('span', { text: c.ai_model }) : null
      ]),
      UI.nodeFromHTML('<div class="prose">' + UI.md(c.response || '') + '</div>')
    ]);
    Modal.open({
      title: 'گفتگو',
      icon: 'terminal',
      size: 'lg',
      body: body,
      footer: UI.el('div', { class: 'dlg__actions' }, [
        (function () {
          var b = UI.el('button', { class: 'btn is-quiet', type: 'button', text: 'بستن' });
          b.addEventListener('click', Modal.close);
          return b;
        })()
      ])
    });
  }

  /* =========================================================
     Form
     ========================================================= */
  function field(opts) {
    var id = 'f-' + opts.name;
    var input;
    if (opts.type === 'textarea') {
      input = '<textarea class="textarea" id="' + id + '" name="' + opts.name + '" rows="' + (opts.rows || 3) + '" ' +
        (opts.placeholder ? 'placeholder="' + UI.esc(opts.placeholder) + '"' : '') + '>' + UI.esc(opts.value || '') + '</textarea>';
    } else if (opts.type === 'select') {
      input = '<select class="select" id="' + id + '" name="' + opts.name + '">' + opts.options + '</select>';
    } else if (opts.type === 'date') {
      input = '<input class="input" id="' + id + '" name="' + opts.name + '" type="date" value="' + UI.esc(opts.value || '') + '" />';
    } else {
      input = '<input class="input" id="' + id + '" name="' + opts.name + '" type="' + (opts.type || 'text') + '" ' +
        'value="' + UI.esc(opts.value == null ? '' : opts.value) + '" ' +
        (opts.placeholder ? 'placeholder="' + UI.esc(opts.placeholder) + '"' : '') + ' ' +
        (opts.inputmode ? 'inputmode="' + opts.inputmode + '"' : '') + ' ' +
        (opts.list ? 'list="' + opts.list + '"' : '') + ' />';
    }
    return '<label class="field" for="' + id + '">' +
      '<span class="field__label">' + UI.esc(opts.label) + (opts.hint ? ' <em>' + UI.esc(opts.hint) + '</em>' : '') + '</span>' +
      input + '</label>';
  }

  function buildForm(t) {
    t = t || {};
    var rating = Math.floor(Number(t.rating) || 0);
    var wrapper = UI.el('form', { class: 'form', novalidate: 'novalidate' });

    wrapper.innerHTML = [
      '<div class="form__grid">',
      '  <div class="form__col">',
      '    <div class="form__section">',
      '      <h3 class="form__title">شناسنامه</h3>',
      '      <div class="field field--with-action">',
      '        <span class="field__label">عنوان</span>',
      '        <div class="field__row">',
      '          <input class="input" name="title" id="f-title" required maxlength="200" value="' + UI.esc(t.title || '') + '" placeholder="نام اثر" />',
      '          <button class="btn is-quiet is-icon" type="button" data-act="lookup" title="جستجوی هوشمند با AI">' + UI.icon('search') + '</button>',
      '        </div>',
      '      </div>',
      field({ name: 'original_title', label: 'عنوان اصلی', value: t.original_title, placeholder: 'Original title', hint: 'اختیاری' }),
      '      <div class="form__pair">',
      field({ name: 'type', label: 'نوع', type: 'select', options: UI.typeOptions(t.type || 'series') }),
      field({ name: 'year', label: 'سال', type: 'number', value: t.year, placeholder: '۲۰۲۴', inputmode: 'numeric' }),
      '      </div>',
      '      <div class="form__pair">',
      field({ name: 'genre', label: 'ژانر', value: t.genre, placeholder: 'درام، جنایی…', list: 'genre-list' }),
      field({ name: 'status', label: 'وضعیت', value: t.status, placeholder: 'will_watch' }),
      '      </div>',
      '      <datalist id="genre-list">' + CONFIG.GENRES.map(function (g) { return '<option value="' + UI.esc(g) + '"></option>'; }).join('') + '</datalist>',
      '    </div>',
      '    <div class="form__section">',
      '      <h3 class="form__title">ساختار</h3>',
      '      <div class="form__triple">',
      field({ name: 'seasons', label: 'فصل', type: 'number', value: t.seasons, inputmode: 'numeric' }),
      field({ name: 'episodes', label: 'قسمت', type: 'number', value: t.episodes, inputmode: 'numeric' }),
      field({ name: 'episodes_per_season', label: 'قسمت/فصل', type: 'number', value: t.episodes_per_season, inputmode: 'numeric' }),
      '      </div>',
      '      <div class="form__pair">',
      field({ name: 'country', label: 'کشور', value: t.country, placeholder: 'آمریکا' }),
      field({ name: 'language', label: 'زبان', value: t.language, placeholder: 'انگلیسی' }),
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="form__col">',
      '    <div class="form__section">',
      '      <h3 class="form__title">تجربهٔ من</h3>',
      '      <div class="field">',
      '        <span class="field__label">امتیاز</span>',
      '        <input type="hidden" name="rating" value="' + rating + '" />',
      '        ' + ratingControl(rating).replace('<div class="rating" data-rating-control>', '<div class="rating rating--form" data-rating-control>'),
      '      </div>',
      '      <label class="switch">',
      '        <input type="checkbox" name="favorite"' + (t.favorite ? ' checked' : '') + ' />',
      '        <span class="switch__track"><span class="switch__thumb"></span></span>',
      '        <span class="switch__label">' + UI.icon('heart') + 'علاقه‌مندی</span>',
      '      </label>',
      field({ name: 'watched_date', label: 'تاریخ تماشا', type: 'date', value: (t.watched_date || '').slice(0, 10) }),
      field({ name: 'reason', label: 'چرا این امتیاز', type: 'textarea', value: t.reason, rows: 3, placeholder: 'در یک یا دو جمله…' }),
      field({ name: 'notes', label: 'یادداشت', type: 'textarea', value: t.notes, rows: 3, placeholder: 'هر چیزی که می‌خواهی یادت بماند' }),
      field({ name: 'summary', label: 'خلاصه', type: 'textarea', value: t.summary, rows: 3, placeholder: 'خلاصهٔ داستان' }),
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

    /* rating control inside form */
    var hidden = wrapper.querySelector('[name="rating"]');
    var ctrl = wrapper.querySelector('[data-rating-control]');
    var label = ctrl.querySelector('[data-rating-label]');
    ctrl.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-rate]');
      if (!btn) return;
      var value = Number(btn.dataset.rate);
      hidden.value = String(value);
      UI.qsa('[data-rate]', ctrl).forEach(function (b) { b.classList.toggle('is-on', Number(b.dataset.rate) === value); });
      label.textContent = UI.starMeta(value).label;
    });

    wrapper.addEventListener('click', function (ev) {
      var lookup = ev.target.closest('[data-act="lookup"]');
      if (!lookup) return;
      var input = wrapper.querySelector('[name="title"]');
      if (!input.value.trim()) { Toast.warning('اول عنوان را بنویس'); input.focus(); return; }
      lookupWithAI(input.value.trim(), function (candidate) {
        fillForm(wrapper, candidate);
      });
    });

    return wrapper;
  }

  function readForm(form) {
    function val(name) {
      var node = form.querySelector('[name="' + name + '"]');
      return node ? String(node.value || '').trim() : '';
    }
    function num(name) {
      var raw = Utils.toEn(val(name));
      if (!raw) return null;
      var n = Number(raw);
      return isNaN(n) ? null : n;
    }
    var favorite = form.querySelector('[name="favorite"]');
    return {
      title: val('title'),
      original_title: val('original_title'),
      type: val('type') || 'series',
      year: num('year'),
      genre: val('genre'),
      status: val('status'),
      seasons: num('seasons'),
      episodes: num('episodes'),
      episodes_per_season: num('episodes_per_season'),
      country: val('country'),
      language: val('language'),
      rating: Number(val('rating')) || 0,
      favorite: !!(favorite && favorite.checked),
      watched_date: val('watched_date') || null,
      reason: val('reason'),
      notes: val('notes'),
      summary: val('summary')
    };
  }

  function fillForm(form, candidate) {
    function set(name, value) {
      if (value == null || value === '') return;
      var node = form.querySelector('[name="' + name + '"]');
      if (!node) return;
      node.value = String(value);
    }
    set('title', candidate.title || candidate.standard_title || candidate.title_fa);
    set('original_title', candidate.original_title);
    set('year', candidate.year || candidate.year_start);
    if (candidate.type) set('type', candidate.type);
    set('genre', candidate.genre);
    set('country', candidate.country);
    set('language', candidate.language);
    set('seasons', candidate.seasons);
    set('episodes', candidate.episodes);
    set('episodes_per_season', candidate.episodes_per_season);
    set('summary', candidate.summary);
    if (candidate.type && CONFIG.TYPES[candidate.type]) {
      var sel = form.querySelector('[name="type"]');
      if (sel) sel.value = candidate.type;
    }
  }

  function lookupWithAI(query, onPick) {
    var stream = UI.stream('جستجوی عنوان: ' + query);
    var results = UI.el('div', { class: 'lookup' });

    var body = UI.el('div', { class: 'stack' }, [
      UI.el('p', { class: 'notice' }, ['عنوان را با AI تصحیح و کامل می‌کنیم؛ نتیجه را قبل از ثبت ببین.']),
      stream.el,
      results
    ]);

    var abort = new AbortController();
    var dlg = Modal.open({
      title: 'جستجوی هوشمند عنوان',
      icon: 'search',
      size: 'lg',
      body: body,
      footer: (function () {
        var foot = UI.el('div', { class: 'dlg__actions' });
        var close = UI.el('button', { class: 'btn is-quiet', type: 'button', text: 'بستن' });
        close.addEventListener('click', function () { abort.abort(); Modal.close(); });
        foot.appendChild(close);
        return foot;
      })(),
      onClose: function () { abort.abort(); }
    });

    stream.setStatus('در حال جستجو…', 'loading');
    AITitleLookup.lookup(query, { signal: abort.signal })
      .then(function (result) {
        stream.hide();
        stream.setStatus('انجام شد', 'done');
        var candidates = (result.candidates || []);
        if (!candidates.length) {
          results.appendChild(UI.el('div', { class: 'notice notice--warn', text: 'کاندیدایی پیدا نشد. عنوان را دستی کامل کن.' }));
          return;
        }
        candidates.forEach(function (cand) {
          var item = UI.el('button', { class: 'cand', type: 'button' }, [
            UI.el('div', { class: 'cand__main' }, [
              UI.el('strong', { text: cand.title || cand.title_fa || '—' }),
              UI.el('span', { class: 'cand__orig', text: cand.original_title || '' }),
              UI.el('span', { class: 'cand__meta', text: [cand.year || cand.year_start, cand.type ? UI.typeLabel(cand.type) : '', cand.country || ''].filter(Boolean).join(' · ') })
            ]),
            UI.el('span', { class: 'cand__confidence', text: cand.confidence != null ? UI.fa(Math.round(cand.confidence * 100)) + '٪' : '' })
          ]);
          item.addEventListener('click', function () {
            onPick(cand);
            dlg.close();
            Toast.success('فیلدها پر شد — بازبینی کن');
          });
          results.appendChild(item);
        });
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
        stream.error(err);
      });
  }

  function openForm(id, prefill) {
    var existing = id ? DB.getTitle(id) : null;
    var data = existing || prefill || {};
    var form = buildForm(data);

    var foot = UI.el('div', { class: 'dlg__actions dlg__actions--split' }, []);
    var left = UI.el('div', { class: 'dlg__group' });
    if (existing) {
      var del = UI.el('button', { class: 'btn is-danger is-quiet', type: 'button' }, [UI.icon('trash'), UI.el('span', { text: 'حذف' })]);
      del.addEventListener('click', function () { dlg.close(); removeTitle(existing.id); });
      left.appendChild(del);
    }
    left.appendChild(UI.el('span', { class: 'muted', text: existing ? 'شناسه: ' + existing.id.slice(0, 8) : 'عنوان جدید' }));

    var right = UI.el('div', { class: 'dlg__group' });
    var cancel = UI.el('button', { class: 'btn is-quiet', type: 'button', text: 'انصراف' });
    cancel.addEventListener('click', function () { dlg.close(); });
    var save = UI.el('button', { class: 'btn is-primary', type: 'button' }, [UI.icon('check'), UI.el('span', { text: existing ? 'ذخیره تغییرات' : 'افزودن به آرشیو' })]);
    save.addEventListener('click', submit);
    right.appendChild(cancel);
    right.appendChild(save);

    foot.appendChild(left);
    foot.appendChild(right);

    var dlg = Modal.open({
      title: existing ? 'ویرایش عنوان' : 'عنوان جدید',
      icon: existing ? 'edit' : 'plus',
      size: 'xl',
      body: form,
      footer: foot
    });

    form.addEventListener('submit', function (ev) { ev.preventDefault(); submit(); });

    function submit() {
      var payload = readForm(form);
      if (!payload.title) {
        Toast.warning('عنوان نمی‌تواند خالی باشد');
        var input = form.querySelector('[name="title"]');
        if (input) input.focus();
        return;
      }
      if (existing) {
        State.editTitle(existing.id, Object.assign({}, existing, payload));
        Toast.success('ذخیره شد');
      } else {
        State.addTitle(Object.assign({ category: 'good' }, payload));
        Toast.success('«' + payload.title + '» اضافه شد');
      }
      dlg.close();
      App.refresh();
      setTimeout(function () { App.refresh(); }, 900);
    }

    setTimeout(function () {
      var input = form.querySelector('[name="title"]');
      if (input) { input.focus(); if (input.value) input.select(); }
    }, 80);
  }

  /* =========================================================
     Delete with undo
     ========================================================= */
  function removeTitle(id) {
    var t = DB.getTitle(id);
    if (!t) return;
    var snapshot = State.removeTitle(id);
    App.refresh();
    Toast.show('«' + t.title + '» حذف شد', 'info', {
      title: 'حذف شد',
      duration: 7000,
      action: {
        label: 'بازگردانی',
        onClick: function () {
          State.restoreTitle(snapshot || t);
          App.refresh();
          setTimeout(function () { App.refresh(); }, 900);
          Toast.success('بازگردانی شد');
        }
      }
    });
  }

  /* =========================================================
     AI: standardize metadata
     ========================================================= */
  function standardize(id) {
    var t = DB.getTitle(id);
    if (!t) return;

    var stream = UI.stream('استانداردسازی: ' + t.title);
    var resultBox = UI.el('div', { class: 'resultcard', hidden: true });
    var applyBtn = UI.el('button', { class: 'btn is-primary', type: 'button', disabled: true }, [UI.icon('check'), UI.el('span', { text: 'ذخیره در آرشیو' })]);

    var abort = new AbortController();
    var body = UI.el('div', { class: 'stack' }, [
      UI.el('div', { class: 'notice' }, [
        UI.icon('wand'),
        UI.el('span', { text: 'فقط متادیتا (عنوان، سال، فصل‌ها…) استخراج می‌شود. امتیاز و یادداشت تو دست‌نخورده می‌ماند.' })
      ]),
      stream.el,
      resultBox
    ]);

    var foot = UI.el('div', { class: 'dlg__actions' });
    var close = UI.el('button', { class: 'btn is-quiet', type: 'button', text: 'بستن' });
    close.addEventListener('click', function () { abort.abort(); dlg.close(); });
    foot.appendChild(close);
    foot.appendChild(applyBtn);

    var dlg = Modal.open({
      title: 'استانداردسازی متادیتا',
      icon: 'wand',
      size: 'lg',
      body: body,
      footer: foot,
      onClose: function () { abort.abort(); }
    });

    var lastResult = null;
    applyBtn.addEventListener('click', function () {
      if (!lastResult) return;
      AIStandardize.applyStandardToDb(id, lastResult);
      State.loadAll(); State.applyFilters();
      App.refresh();
      Toast.success('متادیتا ذخیره شد');
      dlg.close();
      if (activeId === id) paintDetail(id);
    });

    stream.setStatus('در حال استخراج…', 'loading');
    AIStandardize.standardizeSingle(t.title, t.type, t.year, {
      meta: t,
      signal: abort.signal,
      onToken: function (_delta, full) { stream.append(full); }
    }).then(function (result) {
      lastResult = result;
      stream.setStatus('انجام شد', 'done');
      stream.modelBadge();
      resultBox.hidden = false;
      var rows = [
        ['عنوان استاندارد', result.standard_title],
        ['عنوان فارسی', result.title_fa],
        ['نوع', CONFIG.TYPES[result.type] || result.type],
        ['سال', [result.year_start, result.year_end].filter(Boolean).join('–')],
        ['فصل‌ها', result.seasons],
        ['قسمت‌ها', result.episodes],
        ['قسمت در فصل', result.episodes_per_season],
        ['کشور', result.country],
        ['زبان', result.language],
        ['ژانر', result.genre],
        ['وضعیت', result.status],
        ['سازنده', result.creators],
        ['بازیگران', Array.isArray(result.main_cast) ? result.main_cast.join('، ') : result.main_cast]
      ].filter(function (pair) { return pair[1] != null && pair[1] !== ''; });
      resultBox.innerHTML = '<h3 class="sec__title">استخراج‌شده</h3>' + rows.map(function (pair) {
        return '<div class="kv"><dt>' + UI.esc(pair[0]) + '</dt><dd>' + UI.esc(pair[1]) + '</dd></div>';
      }).join('');
      applyBtn.disabled = false;
      setTimeout(function () { stream.hide(); }, 400);
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      stream.error(err);
    });
  }

  /* =========================================================
     AI: deep story analysis
     ========================================================= */
  function analyze(id) {
    var t = DB.getTitle(id);
    if (!t) return;

    var rating = Math.floor(Number(t.rating) || 0);
    var stream = UI.stream('تحلیل داستانی: ' + t.title);
    var proseBox = UI.el('div', { class: 'resultcard prose', hidden: true });
    var metaBox = UI.el('div', { class: 'resultcard', hidden: true });
    var storyBox = UI.el('div', { class: 'resultcard', hidden: true });
    var deepBox = UI.el('div', { hidden: true });

    var applyBtn = UI.el('button', { class: 'btn is-primary', type: 'button', disabled: true }, [UI.icon('check'), UI.el('span', { text: 'اعمال روی آرشیو' })]);
    var abort = new AbortController();

    var body = UI.el('div', { class: 'stack' }, [
      UI.el('div', { class: 'notice' }, [
        UI.nodeFromHTML(UI.icon('brain')),
        UI.el('span', { text: 'تحلیل بر اساس معیارهای سلیقهٔ تو انجام می‌شود: انسجام روایی، علّیت، نتیجهٔ به‌دست‌آمده.' })
      ]),
      stream.el, proseBox, metaBox, storyBox, deepBox
    ]);

    var foot = UI.el('div', { class: 'dlg__actions' });
    var close = UI.el('button', { class: 'btn is-quiet', type: 'button', text: 'بستن' });
    close.addEventListener('click', function () { abort.abort(); dlg.close(); });
    foot.appendChild(close);
    foot.appendChild(applyBtn);

    var dlg = Modal.open({
      title: 'تحلیل داستانی',
      icon: 'brain',
      size: 'xl',
      body: body,
      footer: foot,
      onClose: function () { abort.abort(); }
    });

    var lastResult = null;
    applyBtn.addEventListener('click', function () {
      if (!lastResult) return;
      AIStandardize.applyToDb(id, lastResult);
      State.loadAll(); State.applyFilters();
      App.refresh();
      Toast.success('تحلیل ذخیره شد');
      dlg.close();
      if (activeId === id) paintDetail(id);
    });

    stream.setStatus('در حال تحلیل…', 'loading');
    AIStandardize.analyzeOne(t.title, t.type, t.year, {
      meta: t,
      signal: abort.signal,
      onToken: function (_delta, full) { stream.append(full); }
    }).then(function (result) {
      lastResult = result;
      stream.setStatus('انجام شد', 'done');
      stream.modelBadge();

      var before = (result.__before || '').trim();
      var after = (result.__after || '').trim();
      if (before || after) {
        proseBox.hidden = false;
        proseBox.innerHTML = UI.md(before) + (before && after ? '<hr />' : '') + UI.md(after);
      }

      var rows = [
        ['عنوان استاندارد', result.standard_title],
        ['نوع', CONFIG.TYPES[result.type] || result.type],
        ['سال', [result.year_start, result.year_end].filter(Boolean).join('–')],
        ['فصل‌ها', result.seasons],
        ['قسمت‌ها', result.episodes],
        ['کشور', result.country],
        ['زبان', result.language],
        ['ژانر', result.genre],
        ['خلاصه', result.summary]
      ].filter(function (pair) { return pair[1] != null && pair[1] !== ''; });
      if (rows.length) {
        metaBox.hidden = false;
        metaBox.innerHTML = '<h3 class="sec__title">متادیتای پیشنهادی</h3>' + rows.map(function (pair) {
          return '<div class="kv"><dt>' + UI.esc(pair[0]) + '</dt><dd>' + UI.esc(pair[1]) + '</dd></div>';
        }).join('');
      }

      var storyData = {
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        plot_holes: result.plot_holes || [],
        assumed_stupidity: result.assumed_stupidity || [],
        earned_outcomes: result.earned_outcomes,
        forced_outcomes: result.forced_outcomes,
        ai_model: AI.getLastUsedModel ? AI.getLastUsedModel() : null,
        analyzed_at: new Date().toISOString()
      };
      lastResult.story_analysis = storyData;

      storyBox.hidden = false;
      storyBox.innerHTML = '<h3 class="sec__title">تحلیل ساختار</h3>' + storyHTML(storyData);

      var seasons = Number(result.seasons) || 0;
      if (seasons > 3) {
        deepBox.hidden = false;
        deepBox.innerHTML = '<div class="deepcard">' +
          '<div><strong>این سریال ' + UI.fa(seasons) + ' فصل دارد</strong>' +
          '<p class="muted">تحلیل فصل‌به‌فصل برای پیدا کردن کامل سوراخ‌ها.</p></div>' +
          '<button class="btn is-primary" type="button" data-act="deep">' + UI.icon('layers') + 'تحلیل عمیق</button>' +
          '</div>';
        deepBox.querySelector('[data-act="deep"]').addEventListener('click', function () {
          openDeep(id, t.title, seasons, t.type, result.year_start);
        });
      }

      applyBtn.disabled = false;
      setTimeout(function () { stream.hide(); }, 400);
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      stream.error(err);
    });
  }

  function openDeep(id, title, seasonsCount, type, year) {
    var chunkCount = Math.ceil(seasonsCount / 3);
    var progressFill = UI.el('div', { class: 'progress__fill', style: { width: '0%' } });
    var progressText = UI.el('p', { class: 'muted', text: '۰ از ' + UI.fa(chunkCount) });
    var logBox = UI.el('div', { class: 'loglist' });
    var resultBox = UI.el('div', { class: 'resultcard', hidden: true });
    var startBtn = UI.el('button', { class: 'btn is-primary', type: 'button' }, [UI.icon('play'), UI.el('span', { text: 'شروع' })]);

    var body = UI.el('div', { class: 'stack' }, [
      UI.el('p', { class: 'notice' }, ['«' + title + '» به ' + UI.fa(chunkCount) + ' بخش سه‌فصلی تقسیم می‌شود. هر بخش مستقل تحلیل می‌شود.']),
      UI.el('div', { class: 'progress' }, [progressFill]),
      progressText,
      logBox,
      resultBox
    ]);

    var foot = UI.el('div', { class: 'dlg__actions' });
    var close = UI.el('button', { class: 'btn is-quiet', type: 'button', text: 'بستن' });
    close.addEventListener('click', function () { AI.abort(); dlg.close(); });
    foot.appendChild(close);
    foot.appendChild(startBtn);

    var dlg = Modal.open({ title: 'تحلیل فصل‌به‌فصل', icon: 'layers', size: 'lg', body: body, footer: foot });

    startBtn.addEventListener('click', function () {
      startBtn.disabled = true;
      UI.clear(startBtn);
      startBtn.appendChild(UI.nodeFromHTML('<span class="spin"></span>'));
      startBtn.appendChild(UI.el('span', { text: 'در حال اجرا…' }));

      AIStandardize.analyzeSeasonalDeep(title, seasonsCount, {
        type: type,
        year: year,
        meta: DB.getTitle(id),
        onProgress: function (info) {
          var pct = (info.current / info.total) * 100;
          progressFill.style.width = pct + '%';
          progressText.textContent = UI.fa(info.current) + ' از ' + UI.fa(info.total);
          if (info.phase === 'start') {
            logBox.prepend(UI.el('p', { class: 'loglist__line', text: 'فصل ' + UI.fa(info.fromSeason) + '–' + UI.fa(info.toSeason) + ' …' }));
          } else if (info.phase === 'done') {
            var holes = (info.partial && info.partial.plot_holes || []).length;
            var dumb = (info.partial && info.partial.assumed_stupidity || []).length;
            logBox.prepend(UI.el('p', { class: 'loglist__line is-done', text: 'فصل ' + UI.fa(info.fromSeason) + '–' + UI.fa(info.toSeason) + ' — ' + UI.fa(holes) + ' سوراخ، ' + UI.fa(dumb) + ' احمق‌فرض' }));
          } else if (info.phase === 'error') {
            logBox.prepend(UI.el('p', { class: 'loglist__line is-bad', text: 'خطا: ' + info.error }));
          }
        }
      }).then(function (result) {
        AIStandardize.applyDeepToDb(id, result);
        State.loadAll(); State.applyFilters();
        App.refresh();
        resultBox.hidden = false;
        resultBox.innerHTML = '<h3 class="sec__title">نتیجه</h3>' +
          '<p>' + UI.fa(result.plot_holes.length) + ' سوراخ داستانی · ' + UI.fa(result.assumed_stupidity.length) + ' احمق‌فرض‌گیری</p>' +
          storyHTML({ plot_holes: result.plot_holes, assumed_stupidity: result.assumed_stupidity });
        UI.clear(startBtn);
        startBtn.appendChild(UI.nodeFromHTML(UI.icon('check')));
        startBtn.appendChild(UI.el('span', { text: 'پایان یافت' }));
        Toast.success('تحلیل عمیق ذخیره شد');
        if (activeId === id) paintDetail(id);
      }).catch(function (err) {
        logBox.prepend(UI.el('p', { class: 'loglist__line is-bad', text: 'خطا: ' + err.message }));
        startBtn.disabled = false;
        UI.clear(startBtn);
        startBtn.appendChild(UI.nodeFromHTML(UI.icon('refresh')));
        startBtn.appendChild(UI.el('span', { text: 'تلاش مجدد' }));
      });
    });
  }

  UI.Item = {
    openDetail: openDetail,
    closeDetail: closeDetail,
    openForm: openForm,
    remove: removeTitle,
    paintDetail: paintDetail,
    activeId: function () { return activeId; }
  };
})(window.UI);
