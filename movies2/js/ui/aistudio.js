/* =========================================================
   AI studio — taste, suggestions, free prompt, models, log
   ========================================================= */
(function (UI) {
  'use strict';

  var state = {
    tab: 'personality',
    kind: 'movie',
    sugKind: 'both',
    lastAnalysis: null,
    lastSuggestion: null,
    lastPrompt: null,
    busy: false
  };

  var root = null;

  function shell() {
    return [
      '<header class="viewhead">',
      '  <div class="viewhead__titles">',
      '    <h1 class="viewtitle">استودیوی هوش مصنوعی</h1>',
      '    <p class="viewsub">تحلیل سلیقه، پیشنهاد تماشا و گفتگو با مدل</p>',
      '  </div>',
      '  <div class="viewhead__actions">',
      '    <div class="modelchip" data-modelchip></div>',
      '    <button class="btn is-quiet" type="button" data-act="change-model">' + UI.icon('sparkle') + 'تغییر مدل</button>',
      '  </div>',
      '</header>',
      '<div class="tabs" role="tablist">',
      tabBtn('personality', 'شخصیت و پیشنهاد', 'brain'),
      tabBtn('suggest', 'پیشنهاد تماشا', 'sparkle'),
      tabBtn('prompt', 'پرامپت آزاد', 'terminal'),
      tabBtn('standardize', 'استانداردسازی', 'wand'),
      tabBtn('models', 'مدل‌ها', 'layers'),
      tabBtn('log', 'گزارش', 'terminalLine'),
      '</div>',
      '<div class="aistage" data-aistage></div>'
    ].join('');
  }

  function tabBtn(id, label, iconName) {
    return '<button class="tabs__btn' + (state.tab === id ? ' is-on' : '') + '" type="button" data-tab="' + id + '" role="tab">' +
      UI.icon(iconName) + '<span>' + label + '</span></button>';
  }

  function render(host) {
    root = host;
    root.innerHTML = shell();
    paintModelChip();
    paintStage();
    bind();
  }

  function paintModelChip() {
    var chip = UI.qs('[data-modelchip]', root);
    if (!chip) return;
    var meta = AI.getModelMeta();
    chip.innerHTML = '<span class="modelchip__dot"></span>' +
      '<span class="modelchip__text"><em>مدل فعال</em><strong>' + UI.esc(meta.label || meta.id) + '</strong></span>' +
      (meta.provider ? '<span class="modelchip__provider">' + UI.esc(meta.provider === 'google' ? 'Gemini' : 'OpenRouter') + '</span>' : '');
  }

  function bind() {
    UI.on(root, 'click', '[data-tab]', function (ev, target) {
      state.tab = target.dataset.tab;
      UI.qsa('[data-tab]', root).forEach(function (b) { b.classList.toggle('is-on', b.dataset.tab === state.tab); });
      paintStage();
    });
    UI.on(root, 'click', '[data-act="change-model"]', function () {
      state.tab = 'models';
      UI.qsa('[data-tab]', root).forEach(function (b) { b.classList.toggle('is-on', b.dataset.tab === 'models'); });
      paintStage();
    });
  }

  function paintStage() {
    var stage = UI.qs('[data-aistage]', root);
    if (!stage) return;
    if (state.tab === 'personality') return paintPersonality(stage);
    if (state.tab === 'suggest') return paintSuggest(stage);
    if (state.tab === 'prompt') return paintPrompt(stage);
    if (state.tab === 'standardize') return paintStandardize(stage);
    if (state.tab === 'models') return paintModels(stage);
    if (state.tab === 'log') return paintLog(stage);
  }

  /* =========================================================
     Personality / taste
     ========================================================= */
  function paintPersonality(stage) {
    stage.innerHTML = [
      '<div class="aigrid">',
      '  <div class="aigrid__main">',
      '    <section class="panel">',
      '      <div class="panel__head">',
      '        <h2 class="panel__title">تحلیل عمیق شخصیت</h2>',
      '        <div class="seg" data-kind-seg>',
      '          <button class="seg__btn' + (state.kind === 'movie' ? ' is-on' : '') + '" data-kind="movie" type="button">فیلم</button>',
      '          <button class="seg__btn' + (state.kind === 'series' ? ' is-on' : '') + '" data-kind="series" type="button">سریال</button>',
      '        </div>',
      '      </div>',
      '      <p class="muted">بر اساس ' + UI.fa(DB.getAllTitles().filter(function (t) { return Number(t.rating) > 0; }).length) +
             ' عنوان امتیازداده‌شده، الگوی سلیقه و پیشنهاد بعدی ساخته می‌شود.</p>',
      '      <div class="row">',
      '        <button class="btn is-primary" type="button" data-act="analyze">' + UI.icon('play') + 'اجرای تحلیل</button>',
      '        <button class="btn is-quiet" type="button" data-act="suggest-here">' + UI.icon('sparkle') + 'پیشنهاد یک عنوان</button>',
      '      </div>',
      '    </section>',
      '    <div data-streamslot></div>',
      '  </div>',
      '  <aside class="aigrid__side">',
      '    <h3 class="panel__title">تحلیل‌های اخیر</h3>',
      '    <div class="histlist" data-history></div>',
      '  </aside>',
      '</div>'
    ].join('');

    var slot = UI.qs('[data-streamslot]', stage);
    var stream = state.lastAnalysis && state.lastAnalysis.stream ? state.lastAnalysis.stream : null;
    if (stream) slot.appendChild(stream.el);

    UI.qs('[data-kind-seg]', stage).addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-kind]');
      if (!btn) return;
      state.kind = btn.dataset.kind;
      UI.qsa('[data-kind]', stage).forEach(function (b) { b.classList.toggle('is-on', b.dataset.kind === state.kind); });
    });

    UI.qs('[data-act="analyze"]', stage).addEventListener('click', runAnalysis);
    UI.qs('[data-act="suggest-here"]', stage).addEventListener('click', function () { runSuggestion(slot); });

    renderHistory();
  }

  function renderHistory() {
    var host = UI.qs('[data-history]', root);
    if (!host) return;
    var items = (AIAnalysis.getLatestTasteAnalyses ? AIAnalysis.getLatestTasteAnalyses(6) : []) || [];
    if (!items.length) {
      host.innerHTML = '<p class="muted">تحلیلی ذخیره نشده. اولین تحلیل را اجرا کن.</p>';
      return;
    }
    host.innerHTML = items.map(function (item) {
      var pinned = AIAnalysis.isPinnedAnalysis ? AIAnalysis.isPinnedAnalysis(item) : false;
      return '<button class="histitem" type="button" data-analysis="' + UI.esc(item.id) + '">' +
        '<span class="histitem__title">' + (pinned ? UI.icon('star') : '') +
          UI.esc(String(item.response || '').replace(/[#*`]/g, ' ').trim().slice(0, 80)) + '</span>' +
        '<span class="histitem__meta">' + UI.esc(UI.timeAgo(item.created_at)) + ' · ' + UI.esc(item.ai_model || '—') + '</span>' +
        '</button>';
    }).join('');

    if (host.dataset.bound === '1') return;
    host.dataset.bound = '1';
    UI.on(host, 'click', '[data-analysis]', function (ev, target) {
      var item = DB.getConversation(target.dataset.analysis);
      if (!item) return;
      var slot = UI.qs('[data-streamslot]', root);
      if (!slot) return;
      var stream = UI.stream('تحلیل ذخیره‌شده');
      stream.setHTML('<div class="prose">' + UI.md(item.response || '') + '</div>');
      stream.setStatus(UI.timeAgo(item.created_at), 'done');
      UI.clear(slot);
      slot.appendChild(stream.el);
      var pinned = AIAnalysis.isPinnedAnalysis && AIAnalysis.isPinnedAnalysis(item);
      var pinBtn = UI.el('button', { class: 'btn is-quiet is-sm', type: 'button' }, [
        UI.nodeFromHTML(UI.icon('star')), UI.el('span', { text: pinned ? 'برداشتن سنجاق' : 'سنجاق کردن' })
      ]);
      pinBtn.addEventListener('click', function () {
        AIAnalysis.togglePinTasteAnalysis(item.id);
        renderHistory();
        Toast.success('به‌روز شد');
      });
      stream.el.appendChild(UI.el('div', { class: 'row' }, [pinBtn]));
    });
  }

  function runAnalysis() {
    var slot = UI.qs('[data-streamslot]', root);
    if (!slot) return;
    if (state.busy) { Toast.warning('یک درخواست در جریان است'); return; }

    var stream = UI.stream('تحلیل سلیقه — ' + (state.kind === 'series' ? 'سریال' : 'فیلم'));
    UI.clear(slot);
    slot.appendChild(stream.el);
    state.lastAnalysis = { stream: stream, partial: '', messages: null };
    state.busy = true;

    var messages = AIAnalysis.buildTasteAnalysisMessages(state.kind);
    state.lastAnalysis.messages = messages;

    stream.setStatus('در حال تحلیل…', 'loading');
    AIAnalysis.analyzeTaste({
      kind: state.kind,
      messages: messages,
      onToken: function (_chunk, full) {
        state.lastAnalysis.partial = full;
        stream.append(full);
      }
    }).then(function (text) {
      state.busy = false;
      stream.setStatus('انجام شد', 'done');
      stream.modelBadge();
      try {
        AIAnalysis.saveTasteAnalysis(PromptGate.serialize(messages), text || '', AI.getModel());
      } catch (e) { console.error(e); }
      renderHistory();
      if (AIAnalysis.looksTruncated(text || '')) addContinueBar(stream, messages, text || '');
    }).catch(function (err) {
      state.busy = false;
      if (err && err.code === 'PROMPT_CANCELLED') { stream.setStatus('لغو شد', 'idle'); return; }
      if (err && err.name === 'AbortError') { stream.setStatus('لغو شد', 'idle'); return; }
      stream.error(err);
    });
  }

  function addContinueBar(stream, messages, partial) {
    var bar = UI.el('div', { class: 'continuebar' }, [
      UI.el('p', { text: 'پاسخ به‌نظر ناقص قطع شده. می‌شود از همان‌جا ادامه داد.' })
    ]);
    var btn = UI.el('button', { class: 'btn is-primary', type: 'button' }, [UI.icon('arrowRight'), UI.el('span', { text: 'ادامه بده' })]);
    btn.addEventListener('click', function () {
      btn.disabled = true;
      stream.setStatus('در حال ادامه…', 'loading');
      AIAnalysis.continueTasteAnalysis({
        messages: messages,
        partial: partial,
        onToken: function (_chunk, full) {
          stream.append(partial + '\n\n' + full);
        }
      }).then(function (more) {
        var combined = partial + '\n\n' + more;
        stream.append(combined);
        stream.setStatus('کامل شد', 'done');
        try { AIAnalysis.saveTasteAnalysis(PromptGate.serialize(messages), combined, AI.getModel()); } catch (e) {}
        renderHistory();
        bar.remove();
      }).catch(function (err) {
        btn.disabled = false;
        stream.error(err);
      });
    });
    bar.appendChild(btn);
    stream.el.appendChild(bar);
  }

  /* =========================================================
     Suggestions
     ========================================================= */
  function paintSuggest(stage) {
    stage.innerHTML = [
      '<div class="panel">',
      '  <div class="panel__head">',
      '    <h2 class="panel__title">پیشنهاد تماشا</h2>',
      '    <div class="seg" data-sug-kind>',
      '      <button class="seg__btn' + (state.sugKind === 'both' ? ' is-on' : '') + '" data-k="both" type="button">هر دو</button>',
      '      <button class="seg__btn' + (state.sugKind === 'movie' ? ' is-on' : '') + '" data-k="movie" type="button">فیلم</button>',
      '      <button class="seg__btn' + (state.sugKind === 'series' ? ' is-on' : '') + '" data-k="series" type="button">سریال</button>',
      '    </div>',
      '  </div>',
      '  <p class="muted">یک اثر پیشنهادی با دلیل، بر اساس الگوی سلیقهٔ تو. می‌توانی مستقیم به آرشیو اضافه کنی.</p>',
      '  <div class="row"><button class="btn is-primary" type="button" data-act="suggest">' + UI.icon('sparkle') + 'دریافت پیشنهاد</button></div>',
      '</div>',
      '<div data-streamslot></div>',
      '<div data-actions></div>'
    ].join('');

    UI.qs('[data-sug-kind]', stage).addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-k]');
      if (!btn) return;
      state.sugKind = btn.dataset.k;
      UI.qsa('[data-k]', stage).forEach(function (b) { b.classList.toggle('is-on', b.dataset.k === state.sugKind); });
    });

    UI.qs('[data-act="suggest"]', stage).addEventListener('click', function () {
      runSuggestion(UI.qs('[data-streamslot]', stage));
    });
  }

  function runSuggestion(slot) {
    if (!slot) return;
    var stream = UI.stream('پیشنهاد تماشا');
    UI.clear(slot);
    slot.appendChild(stream.el);

    var actions = UI.qs('[data-actions]', root);
    if (actions) UI.clear(actions);

    stream.setStatus('در حال فکر کردن…', 'loading');
    AIAnalysis.suggest({
      kind: state.sugKind,
      onToken: function (_chunk, full) { stream.append(full); }
    }).then(function (text) {
      stream.setStatus('پیشنهاد آماده است', 'done');
      stream.modelBadge();
      var parsed = AIAnalysis.parseSuggestion(text || '', state.sugKind === 'movie' ? 'movie' : 'series');
      if (actions) paintSuggestionActions(actions, parsed);
    }).catch(function (err) {
      if (err && (err.code === 'PROMPT_CANCELLED' || err.name === 'AbortError')) { stream.setStatus('لغو شد', 'idle'); return; }
      stream.error(err);
    });
  }

  function paintSuggestionActions(host, parsed) {
    UI.clear(host);
    if (!parsed || !parsed.title) return;
    host.appendChild(UI.nodeFromHTML(
      '<section class="panel"><h2 class="panel__title">اثر پیشنهادی</h2>' +
      '<div class="suggest">' +
        '<strong>' + UI.esc(parsed.title) + '</strong>' +
        '<span class="muted">' + [parsed.original_title, parsed.year ? UI.fa(parsed.year) : '', UI.typeLabel(parsed.type)].filter(Boolean).join(' · ') + '</span>' +
        (parsed.reason ? '<p>' + UI.esc(parsed.reason) + '</p>' : '') +
        '<div class="row">' +
          '<button class="btn is-primary" type="button" data-add="seen">' + UI.icon('plus') + 'ثبت در آرشیو</button>' +
          '<button class="btn is-quiet" type="button" data-add="later">' + UI.icon('clock') + 'خواهم دید</button>' +
        '</div>' +
      '</div></section>'
    ));

    var seenBtn = UI.qs('[data-add="seen"]', host);
    var laterBtn = UI.qs('[data-add="later"]', host);

    seenBtn.addEventListener('click', function () {
      UI.Item.openForm(null, parsed);
    });

    laterBtn.addEventListener('click', function () {
      var exists = DB.getAllTitles().some(function (t) {
        return String(t.title || '').toLowerCase() === String(parsed.title || '').toLowerCase();
      });
      if (exists) { Toast.info('این عنوان از قبل در آرشیو هست'); return; }
      State.addTitle({
        title: parsed.title,
        original_title: parsed.original_title || '',
        type: parsed.type || 'series',
        year: parsed.year || null,
        rating: 0,
        reason: parsed.reason || '',
        notes: 'پیشنهاد AI',
        status: 'will_watch',
        category: 'good'
      });
      Toast.success('به فهرست «خواهم دید» اضافه شد');
      App.refresh();
      setTimeout(function () { App.refresh(); }, 900);
    });
  }

  /* =========================================================
     Free prompt
     ========================================================= */
  function paintPrompt(stage) {
    var titles = DB.getAllTitles();
    stage.innerHTML = [
      '<div class="aigrid">',
      '  <div class="aigrid__main">',
      '    <section class="panel">',
      '      <h2 class="panel__title">گفتگو با مدل</h2>',
      '      <label class="field"><span class="field__label">زمینه <em>اختیاری</em></span>',
      '        <select class="select" data-prompt-title>',
      '          <option value="">بدون زمینهٔ عنوان</option>',
      titles.map(function (t) { return '<option value="' + UI.esc(t.id) + '">' + UI.esc(t.title) + '</option>'; }).join(''),
      '        </select></label>',
      '      <label class="field"><span class="field__label">پرامپت</span>',
      '        <textarea class="textarea" rows="5" data-prompt-input placeholder="مثلاً: سه سریال با پایان‌بندی رضایت‌بخش پیشنهاد بده"></textarea>',
      '      </label>',
      '      <div class="row">',
      '        <button class="btn is-primary" type="button" data-act="send">' + UI.icon('arrowRight') + 'ارسال</button>',
      '        <button class="btn is-quiet" type="button" data-act="stop">' + UI.icon('close') + 'توقف</button>',
      '        <button class="btn is-quiet" type="button" data-act="save" disabled>' + UI.icon('check') + 'ذخیره گفتگو</button>',
      '      </div>',
      '    </section>',
      '    <div data-streamslot></div>',
      '  </div>',
      '  <aside class="aigrid__side">',
      '    <h3 class="panel__title">گفتگوهای ذخیره‌شده</h3>',
      '    <div class="histlist" data-convos></div>',
      '  </aside>',
      '</div>'
    ].join('');

    var slot = UI.qs('[data-streamslot]', stage);
    var saveBtn = UI.qs('[data-act="save"]', stage);
    var stream = null;
    var lastPrompt = '';
    var lastResponse = '';
    var lastTitleId = '';

    UI.qs('[data-act="send"]', stage).addEventListener('click', function () {
      var area = UI.qs('[data-prompt-input]', stage);
      var text = (area.value || '').trim();
      if (!text) { Toast.warning('پرامپت خالی است'); area.focus(); return; }

      var titleId = UI.qs('[data-prompt-title]', stage).value;
      var title = titleId ? DB.getTitle(titleId) : null;
      var system = 'تو دستیار سینمایی شخصی من هستی. پاسخ را فارسی، دقیق و بدون چاپلوسی بنویس. اگر مطمئن نیستی، بگو.';
      if (title) system += '\n\n' + AIPrompts.standardLine(title.title, title.type, title.year, title);

      lastPrompt = text;
      lastTitleId = titleId;

      stream = UI.stream(title ? 'دربارهٔ ' + title.title : 'گفتگوی آزاد');
      UI.clear(slot);
      slot.appendChild(stream.el);
      stream.setStatus('در حال پاسخ…', 'loading');

      AI.chatStream({
        messages: [{ role: 'system', content: system }, { role: 'user', content: text }],
        temperature: 0.7,
        onToken: function (_delta, full) { stream.append(full); },
        onDone: function () {}
      }).then(function (full) {
        lastResponse = full || '';
        stream.setStatus('پاسخ کامل شد', 'done');
        stream.modelBadge();
        saveBtn.disabled = false;
      }).catch(function (err) {
        if (err && (err.code === 'PROMPT_CANCELLED' || err.name === 'AbortError')) {
          stream.setStatus('لغو شد', 'idle');
          return;
        }
        stream.error(err);
      });
    });

    UI.qs('[data-act="stop"]', stage).addEventListener('click', function () {
      AI.abort();
      if (stream) stream.setStatus('متوقف شد', 'idle');
    });

    saveBtn.addEventListener('click', function () {
      if (!lastResponse) return;
      DB.saveConversation({
        title_id: lastTitleId || null,
        title_context: lastTitleId ? (DB.getTitle(lastTitleId) || {}).title || '' : '',
        prompt: lastPrompt,
        response: lastResponse,
        ai_model: AI.getModel(),
        tags: 'free_prompt'
      });
      Toast.success('گفتگو ذخیره شد');
      saveBtn.disabled = true;
      renderConvos();
    });

    function renderConvos() {
      var host = UI.qs('[data-convos]', stage);
      if (!host) return;
      var list = DB.getAllConversations().slice(0, 12);
      if (!list.length) {
        host.innerHTML = '<p class="muted">هنوز گفتگویی ذخیره نشده.</p>';
        return;
      }
      host.innerHTML = list.map(function (c) {
        return '<div class="histitem histitem--row">' +
          '<button class="histitem__open" type="button" data-open="' + UI.esc(c.id) + '">' +
            '<span class="histitem__title">' + UI.esc(String(c.prompt || 'گفتگو').slice(0, 70)) + '</span>' +
            '<span class="histitem__meta">' + UI.esc(UI.timeAgo(c.created_at)) + (c.ai_model ? ' · ' + UI.esc(c.ai_model) : '') + '</span>' +
          '</button>' +
          '<button class="iconbtn" type="button" data-del="' + UI.esc(c.id) + '" title="حذف">' + UI.icon('trash') + '</button>' +
          '</div>';
      }).join('');
    }

    UI.on(stage, 'click', '[data-open]', function (ev, target) {
      var c = DB.getConversation(target.dataset.open);
      if (!c) return;
      var s = UI.stream('گفتگوی ذخیره‌شده');
      s.setHTML('<div class="prose">' + UI.md(c.response || '') + '</div>');
      s.setStatus(UI.timeAgo(c.created_at), 'done');
      UI.clear(slot);
      slot.appendChild(s.el);
    });

    UI.on(stage, 'click', '[data-del]', function (ev, target) {
      DB.deleteConversation(target.dataset.del);
      renderConvos();
      Toast.info('حذف شد');
    });

    renderConvos();
  }

  /* =========================================================
     Batch standardize
     ========================================================= */
  function paintStandardize(stage) {
    var titles = DB.getAllTitles();
    var batches = Math.ceil(titles.length / (CONFIG.AI.BATCH_SIZE || 5));

    stage.innerHTML = [
      '<section class="panel">',
      '  <h2 class="panel__title">استانداردسازی گروهی</h2>',
      '  <p class="muted">برای هر عنوان، عنوان استاندارد، سال، فصل‌ها، کشور و ژانر استخراج و جایگزین می‌شود. امتیاز و یادداشت‌ها دست‌نخورده می‌مانند.</p>',
      '  <div class="kpis kpis--inline">',
      '    <div class="kpi"><span class="kpi__label">عنوان‌ها</span><strong class="kpi__value">' + UI.fa(titles.length) + '</strong></div>',
      '    <div class="kpi"><span class="kpi__label">درخواست‌ها</span><strong class="kpi__value">' + UI.fa(batches) + '</strong></div>',
      '  </div>',
      '  <div class="row"><button class="btn is-primary" type="button" data-act="run">' + UI.icon('bolt') + 'شروع استانداردسازی</button></div>',
      '</section>',
      '<div data-progress></div>',
      '<div data-results class="loglist"></div>'
    ].join('');

    UI.qs('[data-act="run"]', stage).addEventListener('click', function () {
      var btn = UI.qs('[data-act="run"]', stage);
      btn.disabled = true;
      var progressHost = UI.qs('[data-progress]', stage);
      var results = UI.qs('[data-results]', stage);
      var fill = UI.el('div', { class: 'progress__fill', style: { width: '0%' } });
      var label = UI.el('p', { class: 'muted', text: '۰ از ' + UI.fa(titles.length) });
      progressHost.appendChild(UI.el('div', { class: 'progress' }, [fill]));
      progressHost.appendChild(label);

      AIStandardize.standardizeBatch(titles, {
        onProgress: function (info) {
          fill.style.width = Math.round((info.done / info.total) * 100) + '%';
          label.textContent = UI.fa(info.done) + ' از ' + UI.fa(info.total);
          var last = info.results[info.results.length - 1];
          if (last) {
            results.prepend(UI.el('p', { class: 'loglist__line' + (last._error ? ' is-bad' : ' is-done') }, [
              UI.el('span', { text: last.original }),
              UI.el('span', { text: last._error ? ' — ' + last._error : ' → ' + (last.standard_title || '—') })
            ]));
          }
        }
      }).then(function (list) {
        var applied = 0;
        (list || []).forEach(function (r) {
          if (r && r._id && !r._error) { AIStandardize.applyStandardToDb(r._id, r); applied++; }
        });
        State.loadAll(); State.applyFilters();
        App.refresh();
        Toast.success(UI.fa(applied) + ' عنوان استاندارد شد');
        btn.disabled = false;
        btn.textContent = 'پایان یافت';
      }).catch(function (err) {
        Toast.error('خطا: ' + (err.message || err));
        btn.disabled = false;
      });
    });
  }

  /* =========================================================
     Models
     ========================================================= */
  function paintModels(stage) {
    var models = DB.getAiModels();
    var current = AI.getModel();

    stage.innerHTML = [
      '<section class="panel">',
      '  <div class="panel__head">',
      '    <h2 class="panel__title">استخر مدل‌ها</h2>',
      '    <div class="row">',
      '      <button class="btn is-quiet" type="button" data-act="openrouter">' + UI.icon('download') + 'افزودن رایگان از OpenRouter</button>',
      '      <button class="btn is-quiet" type="button" data-act="manual">' + UI.icon('plus') + 'افزودن دستی</button>',
      '    </div>',
      '  </div>',
      '  <p class="muted">مدل خاموش از استخر انتخاب حذف می‌شود اما ردیفش می‌ماند. مدل تست‌شده امتیاز برد/باخت می‌گیرد.</p>',
      '  <div class="tablewrap"><table class="modeltable">',
      '    <thead><tr><th>مدل</th><th>سازنده</th><th>کانتکست</th><th>سرعت</th><th>برد/باخت</th><th>وضعیت</th><th></th></tr></thead>',
      '    <tbody>',
      models.map(function (m) {
        return '<tr' + (m.id === current ? ' class="is-current"' : '') + '>' +
          '<td><strong>' + UI.esc(m.label || m.id) + '</strong>' +
            (m.id === current ? '<span class="badge badge--ai">فعال</span>' : '') +
            '<div class="muted mono">' + UI.esc(m.id) + '</div></td>' +
          '<td>' + UI.esc(m.vendor || '—') + '</td>' +
          '<td class="mono">' + UI.esc(m.context || '—') + '</td>' +
          '<td class="mono">' + UI.esc(m.speed || '—') + '</td>' +
          '<td class="mono">' + UI.fa(m.wins || 0) + ' / ' + UI.fa(m.losses || 0) + '</td>' +
          '<td>' +
            '<button class="switch switch--bare" type="button" data-toggle="' + UI.esc(m.id) + '" aria-pressed="' + (m.active !== false) + '">' +
              '<span class="switch__track' + (m.active !== false ? ' is-on' : '') + '"><span class="switch__thumb"></span></span>' +
            '</button>' +
          '</td>' +
          '<td class="row">' +
            (m.active !== false && m.id !== current
              ? '<button class="btn is-sm is-quiet" type="button" data-use="' + UI.esc(m.id) + '">انتخاب</button>' : '') +
            '<button class="btn is-sm is-quiet" type="button" data-test="' + UI.esc(m.id) + '">تست</button>' +
          '</td>' +
        '</tr>';
      }).join(''),
      '    </tbody>',
      '  </table></div>',
      '</section>',
      '<div data-modelslot></div>'
    ].join('');

    UI.on(stage, 'click', '[data-use]', function (ev, target) {
      AI.setModel(target.dataset.use);
      paintModelChip();
      paintStage();
      App.refreshModelChips();
      Toast.success('مدل فعال عوض شد');
    });

    UI.on(stage, 'click', '[data-toggle]', function (ev, target) {
      var id = target.dataset.toggle;
      var model = DB.getAiModel(id);
      if (!model) return;
      var next = model.active === false;
      if (!next && DB.getActiveAiModels().length <= 1) {
        Toast.warning('حداقل یک مدل باید فعال بماند');
        return;
      }
      DB.setAiModelActive(id, next);
      paintStage();
    });

    UI.on(stage, 'click', '[data-test]', function (ev, target) {
      var id = target.dataset.test;
      testModel(id, stage);
    });

    UI.qs('[data-act="openrouter"]', stage).addEventListener('click', openRouterBrowser);
    UI.qs('[data-act="manual"]', stage).addEventListener('click', manualAdd);
  }

  function testModel(id, stage) {
    var host = UI.qs('[data-modelslot]', stage);
    var stream = UI.stream('تست مدل: ' + id);
    UI.clear(host);
    host.appendChild(stream.el);
    stream.setStatus('در حال ارسال پینگ…', 'loading');

    var previous = AI.getModel();
    AI.setModel(id);
    AI.chat({
      messages: [{ role: 'user', content: 'فقط بنویس: ok' }],
      temperature: 0
    }).then(function (text) {
      var ok = String(text || '').trim().length > 0;
      DB.recordAiTrial(id, ok);
      stream.setHTML('<div class="notice ' + (ok ? 'notice--ok' : 'notice--warn') + '">' +
        (ok ? 'مدل پاسخ داد: ' : 'پاسخ خالی بود: ') + UI.esc(String(text || '').slice(0, 200)) + '</div>');
      stream.setStatus(ok ? 'سالم' : 'مشکوک', ok ? 'done' : 'error');
      Toast[ok ? 'success' : 'warning']('تست ثبت شد');
      paintStage();
    }).catch(function (err) {
      DB.recordAiTrial(id, false);
      stream.error(err);
      Toast.error('تست ناموفق: ' + (err.message || err));
    }).finally(function () {
      if (previous && previous !== id) AI.setModel(previous);
      App.refreshModelChips();
    });
  }

  function openRouterBrowser() {
    var box = UI.el('div', { class: 'stack' }, [
      UI.el('p', { class: 'notice' }, ['فهرست مدل‌های رایگان OpenRouter خوانده می‌شود. هر مدلی را بخواهی به استخر اضافه کن.']),
      UI.el('div', { class: 'muted', text: 'در حال دریافت…' })
    ]);
    var dlg = Modal.open({
      title: 'مدل‌های رایگان OpenRouter',
      icon: 'download',
      size: 'lg',
      body: box,
      footer: (function () {
        var foot = UI.el('div', { class: 'dlg__actions' });
        var close = UI.el('button', { class: 'btn is-quiet', type: 'button', text: 'بستن' });
        close.addEventListener('click', function () { dlg.close(); });
        foot.appendChild(close);
        return foot;
      })()
    });

    fetch('https://openrouter.ai/api/v1/models', { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var free = (json.data || []).filter(function (m) {
          var price = m.pricing || {};
          return (Number(price.prompt || 0) === 0 && Number(price.completion || 0) === 0) ||
            String(m.id || '').endsWith(':free');
        }).slice(0, 80);

        UI.clear(box);
        box.appendChild(UI.el('p', { class: 'muted', text: UI.fa(free.length) + ' مدل رایگان پیدا شد' }));
        var list = UI.el('div', { class: 'pickerlist' });
        free.forEach(function (m) {
          var exists = !!DB.getAiModel(m.id);
          var row = UI.el('div', { class: 'pickerrow' }, [
            UI.el('div', { class: 'pickerrow__main' }, [
              UI.el('strong', { text: m.name || m.id }),
              UI.el('span', { class: 'mono muted', text: m.id }),
              UI.el('span', { class: 'muted', text: m.context_length ? UI.fa(Math.round(m.context_length / 1000)) + 'K context' : '' })
            ]),
            (function () {
              var btn = UI.el('button', { class: 'btn is-sm ' + (exists ? 'is-quiet' : 'is-primary'), type: 'button', text: exists ? 'در استخر' : 'افزودن' });
              btn.disabled = exists;
              btn.addEventListener('click', function () {
                DB.upsertAiModel({
                  id: m.id,
                  label: m.name || m.id,
                  vendor: (m.id || '').split('/')[0] || '',
                  provider: 'openrouter',
                  context: m.context_length ? Math.round(m.context_length / 1000) + 'K' : '',
                  note: (m.description || '').slice(0, 160),
                  tags: ['رایگان'],
                  isFree: true,
                  source: 'openrouter',
                  fetchedAt: new Date().toISOString()
                });
                btn.disabled = true;
                btn.textContent = 'افزوده شد';
                Toast.success('«' + (m.name || m.id) + '» اضافه شد');
                paintStage();
              });
              return btn;
            })()
          ]);
          list.appendChild(row);
        });
        box.appendChild(list);
      })
      .catch(function (err) {
        UI.clear(box);
        box.appendChild(UI.el('div', { class: 'notice notice--bad', text: 'دریافت فهرست ناموفق: ' + (err.message || err) }));
      });
  }

  function manualAdd() {
    var input = UI.el('input', { class: 'input mono', dir: 'ltr', placeholder: 'vendor/model:free' });
    var label = UI.el('input', { class: 'input', placeholder: 'نام نمایشی (اختیاری)' });
    var body = UI.el('div', { class: 'stack' }, [
      UI.el('label', { class: 'field' }, [UI.el('span', { class: 'field__label', text: 'شناسهٔ مدل' }), input]),
      UI.el('label', { class: 'field' }, [UI.el('span', { class: 'field__label', text: 'نام' }), label])
    ]);
    var foot = UI.el('div', { class: 'dlg__actions' });
    var cancel = UI.el('button', { class: 'btn is-quiet', type: 'button', text: 'انصراف' });
    var add = UI.el('button', { class: 'btn is-primary', type: 'button', text: 'افزودن' });
    cancel.addEventListener('click', function () { dlg.close(); });
    add.addEventListener('click', function () {
      var id = (input.value || '').trim();
      if (!id) { input.focus(); return; }
      DB.upsertAiModel({
        id: id,
        label: (label.value || '').trim() || id,
        vendor: id.split('/')[0],
        provider: id.toLowerCase().indexOf('gemini') === 0 ? 'google' : 'openrouter',
        source: 'manual',
        tags: ['دستی']
      });
      Toast.success('مدل اضافه شد');
      dlg.close();
      paintStage();
    });
    foot.appendChild(cancel);
    foot.appendChild(add);
    var dlg = Modal.open({ title: 'افزودن مدل دستی', icon: 'plus', size: 'sm', body: body, footer: foot });
    setTimeout(function () { input.focus(); }, 60);
  }

  /* =========================================================
     Log
     ========================================================= */
  function paintLog(stage) {
    var entries = AILog.entries ? AILog.entries() : [];
    stage.innerHTML = '<section class="panel">' +
      '<div class="panel__head"><h2 class="panel__title">گزارش درخواست‌ها</h2>' +
      '<button class="btn is-quiet is-sm" type="button" data-act="clear">' + UI.icon('trash') + 'پاک کردن</button></div>' +
      (entries.length
        ? '<div class="loglist loglist--full">' + entries.slice().reverse().map(function (e) {
            return '<p class="loglist__line" data-level="' + UI.esc(e.level) + '"><time>' + UI.esc(e.at) + '</time>' + UI.esc(e.message) + '</p>';
          }).join('') + '</div>'
        : '<p class="muted">هنوز درخواستی ثبت نشده.</p>') +
      '</section>';

    UI.qs('[data-act="clear"]', stage).addEventListener('click', function () {
      AILog.clear();
      paintStage();
    });
  }

  UI.AIStudio = {
    render: render,
    setTab: function (tab) {
      state.tab = tab;
      if (root) {
        UI.qsa('[data-tab]', root).forEach(function (b) { b.classList.toggle('is-on', b.dataset.tab === tab); });
        paintStage();
      }
    },
    refreshModels: function () {
      if (root && state.tab === 'models') paintStage();
      paintModelChip();
    }
  };
})(window.UI);
