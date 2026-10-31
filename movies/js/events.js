/* =========================================================
   رویدادها و تعاملات
   ========================================================= */
window.Events = (function () {

  function bind() {
    bindHeader();
    bindSidebar();
    bindPages();
    bindAiPage();
    bindPersonalityPage();
    bindToolbar();
    bindContent();
    bindKeyboard();
    bindNetwork();
    bindState();
    bindDbAdmin();
  }

  function bindHeader() {
    const search = document.getElementById('global-search');
    const clear = document.getElementById('btn-search-clear');

    if (search) {
      search.addEventListener('input', Utils.debounce(function (e) {
        State.set({ search: e.target.value });
        State.applyFilters();
        Render.renderPageTitle();
        renderList();
        clear.hidden = !e.target.value;
      }, CONFIG.DEBOUNCE.SEARCH));
    }
    if (clear) {
      clear.addEventListener('click', function () {
        search.value = '';
        clear.hidden = true;
        State.set({ search: '' });
        State.applyFilters();
        renderList();
        search.focus();
      });
    }

    const btnTheme = document.getElementById('btn-theme');
    if (btnTheme) {
      btnTheme.addEventListener('click', function () {
        const next = State.get().theme === 'dark' ? 'light' : 'dark';
        State.setTheme(next);
        Toast.info(next === 'dark' ? 'تم تاریک فعال شد' : 'تم روشن فعال شد');
      });
    }

    const btnStats = document.getElementById('btn-stats');
    if (btnStats) btnStats.addEventListener('click', function () { Stats.openDashboard(); });

    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', function () {
        try { openSettings(); }
        catch (err) { console.error('[settings]', err); Toast.error('باز کردن تنظیمات ناموفق'); }
      });
    }

    const btnMenu = document.getElementById('btn-menu-toggle');
    if (btnMenu) {
      btnMenu.addEventListener('click', function () {
        const sb = document.getElementById('sidebar');
        const opening = !sb.classList.contains('is-open');
        sb.classList.toggle('is-open', opening);
        document.body.classList.toggle('sidebar-open', opening);
        toggleSidebarBackdrop(opening);
      });
    }

    const syncEl = document.getElementById('sync-status');
    if (syncEl) {
      syncEl.title = 'متصل به Supabase';
      // no-op click — data saves automatically
    }
  }

  function toggleSidebarBackdrop(show) {
    let bd = document.querySelector('.sidebar-backdrop');
    if (show && !bd) {
      bd = document.createElement('div');
      bd.className = 'sidebar-backdrop';
      bd.addEventListener('click', function () {
        const sb = document.getElementById('sidebar');
        if (sb) sb.classList.remove('is-open');
        document.body.classList.remove('sidebar-open');
        toggleSidebarBackdrop(false);
      });
      const mount = document.querySelector('.app') || document.body;
      mount.appendChild(bd);
      requestAnimationFrame(function () { bd.classList.add('is-open'); });
    } else if (bd && !show) {
      bd.classList.remove('is-open');
      setTimeout(function () { bd.remove(); }, 250);
    }
  }

  function bindSidebar() {
    document.querySelectorAll('#star-list .side-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#star-list .side-item').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        State.setStarFilter(btn.dataset.star);
        State.applyFilters();
        Render.renderPageTitle();
        renderList();
        if (window.innerWidth <= 900) {
          const sb = document.getElementById('sidebar');
          if (sb) sb.classList.remove('is-open');
          document.body.classList.remove('sidebar-open');
          toggleSidebarBackdrop(false);
        }
      });
    });

    const ft = document.getElementById('filter-type');
    if (ft) ft.addEventListener('change', function (e) {
      State.set({ filterType: e.target.value }); State.applyFilters(); Render.renderPageTitle(); renderList();
    });
    const fs = document.getElementById('filter-sort');
    if (fs) fs.addEventListener('change', function (e) {
      State.set({ sort: e.target.value }); State.applyFilters(); renderList();
    });
    const ff = document.getElementById('filter-favorite');
    if (ff) ff.addEventListener('change', function (e) {
      State.set({ onlyFav: e.target.checked }); State.applyFilters(); Render.renderPageTitle(); renderList();
    });
    const fr = document.getElementById('filter-rated');
    if (fr) fr.addEventListener('change', function (e) {
      State.set({ onlyRated: e.target.checked }); State.applyFilters(); Render.renderPageTitle(); renderList();
    });

    const btnExport = document.getElementById('btn-export');
    if (btnExport) btnExport.addEventListener('click', function () {
      Utils.download(Utils.timestampName('cinema-backup'), JSON.stringify(DB.exportJSON(), null, 2));
      Toast.success('خروجی JSON ساخته شد');
    });

    const btnImport = document.getElementById('btn-import');
    if (btnImport) btnImport.addEventListener('click', function () {
      document.getElementById('import-file').click();
    });

    const impFile = document.getElementById('import-file');
    if (impFile) impFile.addEventListener('change', async function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        Modal.confirm({
          title: 'ورود داده',
          message: 'آیا ' + Utils.toFa(payload.titles ? payload.titles.length : 0) + ' عنوان اضافه شود؟',
          confirmText: 'افزودن',
          onConfirm: function () {
            const n = DB.importJSON(payload, false);
            State.loadAll(); State.applyFilters();
            Render.renderSidebarCounts(); Render.renderPageTitle(); renderList();
            Toast.success(Utils.toFa(n) + ' عنوان اضافه شد');
          }
        });
      } catch (err) { Toast.error('فایل نامعتبر است'); }
      e.target.value = '';
    });

    /* GitHub pull/push removed */

    const btnAnalyze = document.getElementById('btn-ai-analyze');
    if (btnAnalyze) btnAnalyze.addEventListener('click', function () { setPage('personality'); });
  }


  /* =========================================================
     دو صفحه: AI (اصلی) و Library (لیست فیلم/سریال)
     ========================================================= */
  function setPage(page) {
    if (page !== 'library' && page !== 'personality') page = 'ai';
    var app = document.getElementById('app');
    if (app) app.dataset.page = page;

    var aiPage = document.getElementById('ai-page');
    var libPage = document.getElementById('library-page');
    var persPage = document.getElementById('personality-page');
    if (aiPage) aiPage.classList.toggle('is-active', page === 'ai');
    if (libPage) libPage.classList.toggle('is-active', page === 'library');
    if (persPage) persPage.classList.toggle('is-active', page === 'personality');

    document.querySelectorAll('#side-page-nav .side-page-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.page === page);
    });

    var rail = document.getElementById('rail');
    if (rail) rail.style.display = page === 'library' ? '' : 'none';

    if (page === 'ai') refreshAiGlobalLabel();
    if (page === 'personality') renderPersonalityHistory();
  }

  function refreshAiGlobalLabel() {
    var el = document.getElementById('ai-global-model-label');
    var idEl = document.getElementById('ai-global-model-id');
    if (!el) return;
    try {
      var meta = (typeof AI !== 'undefined' && AI.getModelMeta) ? AI.getModelMeta() : null;
      var id = (typeof AI !== 'undefined' && AI.getModel) ? AI.getModel() : '';
      el.textContent = meta ? (meta.label || meta.id || id) : (id || '—');
      if (idEl) {
        var provider = meta && meta.provider ? meta.provider : '';
        idEl.textContent = id
          ? ((provider === 'google' ? 'Google' : provider === 'openrouter' ? 'OpenRouter' : '') +
             (provider ? ' · ' : '') + id)
          : '';
      }
    } catch (err) {
      el.textContent = '—';
      if (idEl) idEl.textContent = '';
    }
  }

  function bindPages() {
    document.querySelectorAll('#side-page-nav .side-page-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setPage(btn.dataset.page);
        if (window.innerWidth <= 900) {
          var sb = document.getElementById('sidebar');
          if (sb) sb.classList.remove('is-open');
          document.body.classList.remove('sidebar-open');
          toggleSidebarBackdrop(false);
        }
      });
    });
    /* پیش‌فرض: صفحه AI */
    setPage('ai');
  }

  function bindAiPage() {
    refreshAiGlobalLabel();

    var btnChange = document.getElementById('btn-ai-change-model');
    if (btnChange) {
      btnChange.addEventListener('click', function () {
        var current = (typeof AI !== 'undefined' && AI.getModel) ? AI.getModel() : '';
        if (typeof AIModelsUI !== 'undefined' && AIModelsUI.openPicker) {
          AIModelsUI.openPicker(current, function () { refreshAiGlobalLabel(); });
        } else {
          Toast.error('انتخاب‌گر مدل در دسترس نیست');
        }
      });
    }

    var btnFetch = document.getElementById('btn-ai-fetch-models');
    if (btnFetch) {
      btnFetch.addEventListener('click', function () {
        if (typeof AIModelsUI !== 'undefined' && AIModelsUI.openOpenRouterFetch) {
          AIModelsUI.openOpenRouterFetch({
            onChanged: function () { refreshAiGlobalLabel(); }
          });
        }
      });
    }

    function wireCard(id, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    }

    wireCard('ai-card-free-prompt', function () {
      var btn = document.getElementById('btn-free-prompt');
      if (btn) btn.click();
      else if (typeof AIFreePrompt !== 'undefined' && AIFreePrompt.open) AIFreePrompt.open();
    });
    wireCard('ai-card-analyze', function () {
      setPage('personality');
    });

    document.addEventListener('cinema:model-changed', function () {
      refreshAiGlobalLabel();
    });
  }


  /* =========================================================
     صفحه تحلیل عمیق شخصیت
     ========================================================= */
  var persPanel = null;
  var persRunning = false;
  var persLastContext = null; /* { messages, result, kind } */
  var persSelectedKind = 'movie';

  function formatPersDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso).slice(0, 16);
      return d.toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return String(iso).slice(0, 16);
    }
  }

  function renderPersonalityHistory(activeId) {
    var list = document.getElementById('pers-history-list');
    if (!list) return;
    list.innerHTML = '';
    var items = [];
    try {
      items = (typeof AIAnalysis !== 'undefined' && AIAnalysis.getLatestTasteAnalyses)
        ? AIAnalysis.getLatestTasteAnalyses(5)
        : [];
    } catch (e) { items = []; }

    if (!items.length) {
      list.appendChild(Utils.el('div', { class: 'pers-history-empty' }, [
        'هنوز تحلیلی ذخیره نشده. یک تحلیل جدید اجرا کن.'
      ]));
      return;
    }

    items.forEach(function (item, idx) {
      var pinned = (typeof AIAnalysis !== 'undefined' && AIAnalysis.isPinnedAnalysis)
        ? AIAnalysis.isPinnedAnalysis(item) : false;
      var preview = String(item.response || '').replace(/\s+/g, ' ').trim().slice(0, 90);
      var card = Utils.el('div', {
        class: 'pers-history-card' + (activeId && item.id === activeId ? ' is-active' : '') + (pinned ? ' is-pinned' : ''),
        dataset: { id: item.id }
      }, [
        Utils.el('div', { class: 'pers-history-card-top' }, [
          Utils.el('span', { class: 'pers-history-idx' }, [pinned ? '📌' : ('#' + (idx + 1))]),
          Utils.el('span', { class: 'pers-history-date' }, [formatPersDate(item.created_at)]),
          Utils.el('button', {
            type: 'button',
            class: 'pers-pin-btn' + (pinned ? ' is-on' : ''),
            title: pinned ? 'برداشتن سنجاق (دیگر دائمی نیست)' : 'سنجاق دائمی',
            dataset: { id: item.id }
          }, [pinned ? '📌' : '📍'])
        ]),
        Utils.el('div', { class: 'pers-history-model' }, [item.ai_model || '—']),
        Utils.el('div', { class: 'pers-history-preview' }, [preview || '(خالی)'])
      ]);
      card.addEventListener('click', function (ev) {
        if (ev.target.closest && ev.target.closest('.pers-pin-btn')) return;
        var fresh = DB.getConversation(item.id) || item;
        showPersonalityResult(fresh);
        renderPersonalityHistory(item.id);
      });
      var pinBtn = card.querySelector('.pers-pin-btn');
      if (pinBtn) {
        pinBtn.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          try {
            AIAnalysis.togglePinTasteAnalysis(item.id);
            var nowPinned = AIAnalysis.isPinnedAnalysis(DB.getConversation(item.id) || item);
            Toast.success(nowPinned ? 'تحلیل سنجاق شد — دائمی نگه داشته می‌شود' : 'سنجاق برداشته شد');
            renderPersonalityHistory(item.id);
          } catch (err) {
            Toast.error(err.message || 'خطا');
          }
        });
      }
      list.appendChild(card);
    });
  }

  function showPersonalityResult(item) {
    var empty = document.getElementById('pers-stream-empty');
    var host = document.getElementById('pers-stream-host');
    if (empty) empty.hidden = true;
    if (!host) return;
    host.innerHTML = '';
    item = DB.getConversation(item.id) || item;
    var pinned = (typeof AIAnalysis !== 'undefined' && AIAnalysis.isPinnedAnalysis)
      ? AIAnalysis.isPinnedAnalysis(item) : false;
    var md = (typeof AIUI !== 'undefined' && AIUI.renderMarkdown)
      ? AIUI.renderMarkdown(item.response || '')
      : Utils.esc(item.response || '');
    var pinBtn = Utils.el('button', {
      type: 'button',
      class: 'btn btn-ghost btn-sm pers-result-pin' + (pinned ? ' is-on' : '')
    }, [pinned ? '📌 برداشتن سنجاق' : '📍 سنجاق دائمی']);
    pinBtn.addEventListener('click', function () {
      AIAnalysis.togglePinTasteAnalysis(item.id);
      var now = AIAnalysis.isPinnedAnalysis(DB.getConversation(item.id) || item);
      Toast.success(now ? 'دائمی شد' : 'سنجاق برداشته شد');
      showPersonalityResult(DB.getConversation(item.id) || item);
      renderPersonalityHistory(item.id);
    });
    var body = Utils.el('div', { class: 'ai-stream-panel' }, [
      Utils.el('div', { class: 'ai-stream-head' }, [
        Utils.el('div', { class: 'ai-stream-title' }, [
          (pinned ? '📌 ' : '') + 'تحلیل ذخیره‌شده'
        ]),
        Utils.el('div', { class: 'ai-stream-status', dataset: { state: 'done' } }, [
          Utils.el('span', { class: 'ai-status-dot' }),
          Utils.el('span', { class: 'ai-status-text' }, [formatPersDate(item.created_at)])
        ])
      ]),
      Utils.el('div', { class: 'ai-stream-body' }, [
        Utils.el('div', { class: 'ai-stream-content', html: md })
      ]),
      Utils.el('div', { class: 'ai-stream-foot' }, [
        Utils.el('span', { class: 'pers-foot-model' }, [item.ai_model || '']),
        pinBtn
      ])
    ]);
    host.appendChild(body);
  }

  function ensurePersStreamPanel() {
    var empty = document.getElementById('pers-stream-empty');
    var host = document.getElementById('pers-stream-host');
    if (empty) empty.hidden = true;
    if (!host) return null;
    host.innerHTML = '';
    /* use AIUI internal if exposed; else local mirror via openAnalysis pattern */
    if (typeof AIUI !== 'undefined' && typeof AIUI.createStreamPanelForPage === 'function') {
      persPanel = AIUI.createStreamPanelForPage('تحلیل عمیق شخصیت');
      host.appendChild(persPanel.panel);
      return persPanel;
    }
    /* minimal panel compatible with appendText API from createStreamPanel — call through AIUI */
    var fake = document.createElement('div');
    host.appendChild(fake);
    /* Build via modal-less copy: invoke AIUI helper */
    return null;
  }

  async function runPersonalityAnalysis() {
    if (persRunning) return;
    if (typeof AIAnalysis === 'undefined') {
      Toast.error('ماژول تحلیل در دسترس نیست');
      return;
    }

    var messages;
    try {
      messages = AIAnalysis.buildTasteAnalysisMessages(persSelectedKind);
    } catch (errBuild) {
      Toast.error(errBuild.message || 'ساخت پرامپت ناموفق');
      return;
    }

    persRunning = true;
    var btn = document.getElementById('btn-run-personality');
    if (btn) { btn.disabled = true; btn.textContent = 'در حال تحلیل…'; }

    var empty = document.getElementById('pers-stream-empty');
    var host = document.getElementById('pers-stream-host');
    if (empty) empty.hidden = true;
    if (host) host.innerHTML = '';

    var panel = null;
    try {
      panel = AIUI.createStreamPanelForPage('تحلیل عمیق شخصیت');
      if (host) host.appendChild(panel.panel);
    } catch (e) {
      Toast.error('پنل استریم ساخته نشد');
      persRunning = false;
      if (btn) { btn.disabled = false; btn.textContent = '▶ اجرای تحلیل جدید'; }
      return;
    }

    panel.setContent('');
    panel.setStatus('استریم تحلیل…', 'loading');

    try {
      var result = await AIAnalysis.analyzeTaste({
        kind: persSelectedKind,
        messages: messages,
        onToken: function (_c, full) { panel.appendText(full); }
      });
      panel.appendText(result || '');
      panel.setModelBadge();
      panel.setStatus('آماده', 'done');
      try {
        var promptText = (messages || []).map(function (m) {
          return '## ' + m.role + '\n' + m.content;
        }).join('\n\n');
        AIAnalysis.saveTasteAnalysis(
          promptText,
          result || '',
          (typeof AI !== 'undefined' && AI.getModel) ? AI.getModel() : ''
        );
      } catch (e2) { console.error(e2); }
      persLastContext = {
        messages: messages,
        result: result || '',
        kind: persSelectedKind
      };
      renderPersonalityHistory();
      showPersonalitySuggestionActions(result || '', persSelectedKind);
      showPersonalityContinueBar(panel);
      Toast.success('تحلیل ذخیره شد');
    } catch (err) {
      if (err && err.code === 'PROMPT_CANCELLED') {
        panel.setStatus('لغو شد', 'done');
        Toast.info('ارسال لغو شد');
      } else {
        panel.setStatus('خطا', 'error');
        panel.setContent('<div class="ai-error">' + Utils.esc(err.message || String(err)) + '</div>');
        Toast.error(err.message || 'خطا در تحلیل');
      }
    } finally {
      persRunning = false;
      if (btn) { btn.disabled = false; btn.textContent = '▶ اجرای تحلیل جدید'; }
    }
  }



  function showPersonalityContinueBar(panel, opts) {
    opts = opts || {};
    var host = document.getElementById('pers-stream-host');
    if (!host) return;
    var old = document.getElementById('pers-continue-bar');
    if (old) old.remove();

    var bar = Utils.el('div', { id: 'pers-continue-bar', class: 'pers-continue-bar' }, [
      Utils.el('button', {
        type: 'button',
        class: 'btn btn-ghost btn-sm',
        id: 'btn-pers-continue'
      }, ['ادامه'])
    ]);

    var suggest = document.getElementById('pers-suggest-actions');
    if (suggest && suggest.parentNode) {
      suggest.parentNode.insertBefore(bar, suggest);
    } else if (panel && panel.panel && panel.panel.parentNode) {
      panel.panel.parentNode.insertBefore(bar, panel.panel.nextSibling);
    } else {
      host.appendChild(bar);
    }

    document.getElementById('btn-pers-continue').addEventListener('click', function () {
      continuePersonalityAnalysis(panel);
    });
  }

  async function continuePersonalityAnalysis(panel) {
    if (persRunning) return;
    if (!persLastContext || !persLastContext.result) {
      Toast.warning('تحلیل قبلی برای ادامه در دسترس نیست');
      return;
    }
    if (typeof AIAnalysis === 'undefined' || !AIAnalysis.continueTasteAnalysis) {
      Toast.error('ادامه پشتیبانی نمی‌شود');
      return;
    }

    persRunning = true;
    var btn = document.getElementById('btn-pers-continue');
    var runBtn = document.getElementById('btn-run-personality');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    if (runBtn) runBtn.disabled = true;

    if (panel && panel.setStatus) panel.setStatus('ادامه استریم…', 'loading');

    var before = String(persLastContext.result || '');
    try {
      var more = await AIAnalysis.continueTasteAnalysis({
        messages: persLastContext.messages,
        partial: before,
        onToken: function (_c, full) {
          if (panel && panel.appendText) {
            panel.appendText(before + '\n\n' + full);
          }
        }
      });
      var combined = before;
      if (more && String(more).trim()) {
        combined = before + (before.endsWith('\n') ? '\n' : '\n\n') + String(more).trim();
      }
      persLastContext.result = combined;
      if (panel && panel.appendText) panel.appendText(combined);
      if (panel && panel.setStatus) panel.setStatus('ادامه آماده شد', 'done');
      if (panel && panel.setModelBadge) panel.setModelBadge();

      try {
        var promptText = (persLastContext.messages || []).map(function (m) {
          return '## ' + m.role + '\n' + m.content;
        }).join('\n\n');
        AIAnalysis.saveTasteAnalysis(
          promptText + '\n\n## continue',
          combined,
          (typeof AI !== 'undefined' && AI.getModel) ? AI.getModel() : ''
        );
      } catch (e2) { console.error(e2); }

      renderPersonalityHistory();
      showPersonalitySuggestionActions(combined, persLastContext.kind || persSelectedKind);
      showPersonalityContinueBar(panel);
      Toast.success('ادامه به پاسخ اضافه شد');
    } catch (err) {
      if (err && err.code === 'PROMPT_CANCELLED') {
        Toast.info('ادامه لغو شد');
        if (panel && panel.setStatus) panel.setStatus('لغو شد', 'done');
      } else {
        Toast.error(err.message || 'خطا در ادامه');
        if (panel && panel.setStatus) panel.setStatus('خطا', 'error');
      }
    } finally {
      persRunning = false;
      if (btn) { btn.disabled = false; btn.textContent = 'ادامه'; }
      if (runBtn) runBtn.disabled = false;
    }
  }

  function showPersonalitySuggestionActions(resultText, kind) {
    var host = document.getElementById('pers-stream-host');
    var wrap = document.getElementById('pers-stream-wrap') || host;
    if (!wrap) return;
    var old = document.getElementById('pers-suggest-actions');
    if (old) old.remove();

    var parsed = (typeof AIAnalysis !== 'undefined' && AIAnalysis.parseSuggestion)
      ? AIAnalysis.parseSuggestion(resultText, kind)
      : { title: '', type: kind, year: null, reason: '', original_title: '' };

    var titleInput = Utils.el('input', {
      class: 'field-input', type: 'text', id: 'pers-suggest-title',
      value: parsed.title || '', placeholder: 'عنوان پیشنهاد'
    });
    var yearInput = Utils.el('input', {
      class: 'field-input', type: 'number', id: 'pers-suggest-year',
      value: parsed.year || '', placeholder: 'سال', style: { width: '100px' }
    });
    var typeSelect = Utils.el('select', { class: 'field-input', id: 'pers-suggest-type' }, [
      Utils.el('option', { value: 'movie', selected: (parsed.type || kind) !== 'series' }, ['فیلم']),
      Utils.el('option', { value: 'series', selected: (parsed.type || kind) === 'series' }, ['سریال'])
    ]);

    var box = Utils.el('div', { id: 'pers-suggest-actions', class: 'pers-suggest-actions' }, [
      Utils.el('div', { class: 'pers-suggest-title' }, ['افزودن پیشنهاد AI به لیست']),
      Utils.el('div', { class: 'pers-suggest-fields' }, [titleInput, yearInput, typeSelect]),
      Utils.el('div', { class: 'pers-suggest-btns' }, [
        Utils.el('button', { class: 'btn btn-primary', type: 'button', id: 'pers-add-archive' }, ['➕ افزودن به آرشیو']),
        Utils.el('button', { class: 'btn btn-ghost', type: 'button', id: 'pers-add-will' }, ['👀 خواهم دید'])
      ])
    ]);
    wrap.appendChild(box);

    function alreadyExists(title) {
      return DB.getAllTitles().some(function (t) {
        return String(t.title || '').toLowerCase() === String(title || '').toLowerCase();
      });
    }

    function readForm() {
      return {
        title: (document.getElementById('pers-suggest-title').value || '').trim(),
        year: document.getElementById('pers-suggest-year').value
          ? Number(document.getElementById('pers-suggest-year').value) : null,
        type: document.getElementById('pers-suggest-type').value || kind || 'movie',
        original_title: parsed.original_title || '',
        reason: parsed.reason || ''
      };
    }

    function payload(willWatch) {
      var f = readForm();
      return {
        title: f.title,
        original_title: f.original_title,
        type: f.type,
        year: f.year,
        rating: 0,
        category: 'good',
        status: willWatch ? 'will_watch' : '',
        source: 'ai',
        notes: willWatch ? '[AI · خواهم دید]' : '[AI]',
        reason: f.reason,
        story_analysis: resultText || '',
        favorite: false
      };
    }

    function doAdd(willWatch) {
      var f = readForm();
      if (!f.title) {
        Toast.warning('عنوان را وارد کن');
        return;
      }
      if (alreadyExists(f.title)) {
        Toast.info('این عنوان از قبل در آرشیو هست');
        return;
      }
      try {
        State.addTitle(payload(willWatch));
        Toast.success(willWatch
          ? 'به «خواهم دید» اضافه شد (امتیاز ۰ — در تحلیل بعدی نمی‌آید)'
          : 'با برچسب AI به آرشیو اضافه شد');
        if (typeof Events !== 'undefined' && Events.renderList) Events.renderList();
      } catch (err) {
        console.error(err);
        Toast.error(err.message || 'خطا در افزودن');
      }
    }

    document.getElementById('pers-add-archive').addEventListener('click', function () { doAdd(false); });
    document.getElementById('pers-add-will').addEventListener('click', function () { doAdd(true); });
  }

  function bindPersonalityPage() {
    document.querySelectorAll('.pers-kind-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        persSelectedKind = b.dataset.kind === 'series' ? 'series' : 'movie';
        document.querySelectorAll('.pers-kind-btn').forEach(function (x) {
          x.classList.toggle('is-active', x === b);
        });
      });
    });
    var btn = document.getElementById('btn-run-personality');
    if (btn) btn.addEventListener('click', function () { runPersonalityAnalysis(); });
  }

  function bindToolbar() {
    document.querySelectorAll('.view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.view-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        State.setView(btn.dataset.view);
        applyViewClass();
      });
    });
    const bAdd = document.getElementById('btn-add');
    if (bAdd) bAdd.addEventListener('click', function () { openAddEdit(); });
    const bEmpty = document.getElementById('btn-empty-add');
    if (bEmpty) bEmpty.addEventListener('click', function () { openAddEdit(); });
  }

  function applyViewClass() {
    const grid = document.getElementById('grid');
    grid.classList.toggle('is-list', State.get().view === 'list');
  }

  function bindContent() {
    const grid = document.getElementById('grid');
    if (!grid) return;
    grid.addEventListener('click', function (e) {
      const card = e.target.closest('.card');
      if (!card) return;
      const id = card.dataset.id;
      const actEl = e.target.closest('[data-act]');
      const act = actEl ? actEl.dataset.act : null;
      if (act === 'fav') { State.toggleFavorite(id); renderList(); Render.renderSidebarCounts(); }
      else if (act === 'edit') { openAddEdit(id); }
      else if (act === 'delete') { deleteWithUndo(id); }
      else if (act === 'ai') { AIUI.openAnalyzeSingle(id); }
      else if (act === 'standardize') { AIUI.openStandardizeSingle(id); }
      else { openDetail(id); }
    });
    grid.addEventListener('keydown', function (e) {
      const card = e.target.closest('.card');
      if (!card) return;
      if (e.key === 'Enter') openDetail(card.dataset.id);
    });
  }

  function deleteWithUndo(id) {
    const t = DB.getTitle(id);
    if (!t) return;
    const title = t.title;
    const row = State.removeTitle(id);
    if (!row) { Toast.error('حذف ناموفق'); return; }
    renderList();
    Render.renderSidebarCounts();
    Toast.show('«' + title + '» حذف شد', 'info', {
      title: '🗑️ حذف',
      duration: CONFIG.UNDO.DELETE_TIMEOUT,
      action: {
        label: 'بازگردانی',
        onClick: function () {
          State.restoreTitle(row);
          renderList();
          Render.renderSidebarCounts();
          Toast.success('«' + title + '» بازگردانده شد');
        }
      }
    });
  }

  function bindKeyboard() {
    document.addEventListener('keydown', function (e) {
      const active = document.activeElement;
      const inField = active && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(active.tagName) > -1;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const s = document.getElementById('global-search');
        if (s) s.focus();
        return;
      }
      if (!inField && e.key.toLowerCase() === 'n') { e.preventDefault(); openAddEdit(); }
      if (!inField && e.key.toLowerCase() === 's' && !mod) Stats.openDashboard();
    });
  }

  function bindNetwork() {
    window.addEventListener('online', function () { updateSyncStatus('online'); Toast.success('اتصال برقرار'); });
    window.addEventListener('offline', function () { updateSyncStatus('offline'); Toast.warning('اتصال قطع'); });
  }

  function bindState() {
    State.on('title:added', function () { renderList(); Render.renderSidebarCounts(); });
    State.on('title:updated', function () { renderList(); Render.renderSidebarCounts(); });
    State.on('title:deleted', function () { renderList(); Render.renderSidebarCounts(); });
    State.on('title:restored', function () { renderList(); Render.renderSidebarCounts(); });
  }

  function bindDbAdmin() {
    document.addEventListener('click', function (e) {
      const btn = e.target.closest && e.target.closest('#btn-db-admin, [data-action="db-admin"]');
      if (!btn) return;
      e.preventDefault();
      openDbAdmin();
    });
  }

  function openDbAdmin() {
    if (!window.DBAdmin) {
      console.error('[db-admin] window.DBAdmin is not defined — js/db-admin.js not loaded');
      Toast.error('مدیریت دیتابیس بارگذاری نشده');
      return;
    }
    try {
      DBAdmin.open();
    } catch (err) {
      console.error('[db-admin] open failed:', err);
      Toast.error('باز کردن مدیریت دیتابیس ناموفق: ' + (err && err.message || err));
    }
  }

  function renderList() {
    const grid = document.getElementById('grid');
    const s = State.get();
    Render.renderGrid(grid, s.filtered, s.search);
    Render.toggleEmpty(s.filtered.length === 0);
    Render.renderPageTitle();
  }

  function openAddEdit(id) {
    const editing = id != null;
    const data = editing ? DB.getTitle(id) : {
      title: '', type: 'series', genre: '',
      year: null, rating: 0, favorite: false, notes: '', reason: '', watched_date: null
    };
    if (!data) { Toast.error('عنوان پیدا نشد'); return; }

    const form = buildItemForm(data);
    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: function () { Modal.close(); } }, ['انصراف']),
      Utils.el('button', { class: 'btn btn-primary', id: 'form-save' }, [editing ? 'ذخیره تغییرات' : 'افزودن'])
    ]);

    Modal.open({
      title: editing ? 'ویرایش عنوان' : 'افزودن عنوان جدید',
      icon: editing ? '✏️' : '➕',
      body: form, footer: footer, size: 'lg'
    });

    document.getElementById('form-save').addEventListener('click', function () {
      const payload = collectForm(form, data);
      if (!payload) return;
      if (!editing) {
        const similar = DB.findSimilar(payload.title);
        if (similar.length > 0) {
          showDuplicateWarning(similar, payload.title, function () {
            State.addTitle(payload);
            Toast.success('عنوان اضافه شد');
            Modal.close();
          });
          return;
        }
      }
      if (editing) { State.editTitle(id, payload); Toast.success('تغییرات ذخیره شد'); }
      else { State.addTitle(payload); Toast.success('عنوان اضافه شد'); }
      Modal.close();
    });
  }

  function buildItemForm(data) {
    const form = Utils.el('form', { class: 'form' });

    form.appendChild(Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, ['عنوان ', Utils.el('span', { class: 'req' }, ['*'])]),
      Utils.el('div', { class: 'title-input-wrap' }, [
        Utils.el('input', {
          class: 'field-input', type: 'text', name: 'title',
          value: data.title || '', placeholder: 'مثلاً Breaking Bad',
          maxlength: CONFIG.LIMITS.TITLE_MAX, required: true
        }),
        Utils.el('button', {
          type: 'button', class: 'title-lookup-btn', title: 'جستجوی خودکار با AI',
          onclick: function (e) {
            e.preventDefault();
            const f = e.target.closest('form');
            const input = f.querySelector('[name="title"]');
            AIUI.openTitleLookup(f, input);
          }
        }, ['🪄'])
      ]),
      Utils.el('div', { class: 'field-hint' }, [
        'با دکمه 🪄 عنوان را هوشمندانه جستجو کن — AI دیکته را اصلاح و نسخه‌های مختلف را پیدا می‌کند.'
      ])
    ]));

    form.appendChild(buildStarPicker(Number(data.rating) || 0));

    form.appendChild(Utils.el('div', { class: 'form-row form-row-3' }, [
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', { class: 'field-label' }, ['نوع']),
        (function () {
          const s = Utils.el('select', { class: 'field-select', name: 'type' });
          Object.keys(CONFIG.TYPES).forEach(function (k) {
            const o = Utils.el('option', { value: k }, [CONFIG.TYPES[k]]);
            if (data.type === k) o.selected = true;
            s.appendChild(o);
          });
          return s;
        })()
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', { class: 'field-label' }, ['سال']),
        Utils.el('input', { class: 'field-input', type: 'number', name: 'year',
          value: data.year || '', placeholder: '2020', min: 1900, max: 2100 })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', { class: 'field-label' }, ['ژانر']),
        Utils.el('input', { class: 'field-input', type: 'text', name: 'genre',
          value: data.genre || '', placeholder: 'درام، جنایی', maxlength: CONFIG.LIMITS.GENRE_MAX })
      ])
    ]));

    form.appendChild(Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, [
        'چرا؟ ',
        Utils.el('span', { class: 'field-hint-inline' }, ['(اختیاری — دلیل ستاره)'])
      ]),
      Utils.el('textarea', {
        class: 'field-textarea', name: 'reason',
        placeholder: 'مثلاً: شبکه منطقی قوی، بدون سوراخ داستانی…',
        maxlength: CONFIG.LIMITS.REASON_MAX, style: { minHeight: '70px' }
      }, [data.reason || ''])
    ]));

    if (data.summary || data.seasons || data.country) {
      form.appendChild(Utils.el('div', { class: 'alert alert-info' }, [
        Utils.el('span', { class: 'alert-icon' }, ['🪄']),
        Utils.el('div', {}, [
          'این عنوان با AI تحلیل شده. ',
          data.seasons ? Utils.toFa(data.seasons) + ' فصل' : '',
          data.episodes ? ' · ' + Utils.toFa(data.episodes) + ' قسمت' : '',
          data.country ? ' · ' + data.country : ''
        ].filter(Boolean))
      ]));
    }

    form.appendChild(Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, [
        'یادداشت ',
        Utils.el('span', { class: 'field-hint-inline' }, ['(تأثیرگذار در تحلیل و پیشنهاد)'])
      ]),
      Utils.el('textarea', {
        class: 'field-textarea', name: 'notes',
        placeholder: 'نظر شخصی شما درباره‌ی این اثر…',
        maxlength: CONFIG.LIMITS.NOTES_MAX
      }, [data.notes || '']),
      Utils.el('div', { class: 'field-hint' }, [
        '📝 این یادداشت به همراه امتیاز شما، مستقیماً برای تحلیل سلیقه و پیشنهاد تک‌اثر به هوش مصنوعی ارسال می‌شود.'
      ])
    ]));

    const favSwitch = Utils.el('label', { class: 'switch' });
    const favInp = Utils.el('input', { type: 'checkbox', name: 'favorite' });
    favInp.checked = !!data.favorite;
    favSwitch.appendChild(favInp);
    favSwitch.appendChild(Utils.el('span', { class: 'switch-track' }));

    form.appendChild(Utils.el('div', { class: 'switch-row' }, [
      Utils.el('div', {}, [
        Utils.el('div', { class: 'switch-label' }, ['افزودن به علاقه‌مندی‌ها ⭐']),
        Utils.el('div', { class: 'switch-desc' }, ['برای دسترسی سریع'])
      ]),
      favSwitch
    ]));

    return form;
  }

  function buildStarPicker(initial) {
    let current = Math.max(0, Math.min(5, Math.round(initial)));
    const ratingInput = Utils.el('input', { type: 'hidden', name: 'rating', value: String(current) });
    const wrap = Utils.el('div', { class: 'star-picker-wrap' });
    const starsRow = Utils.el('div', { class: 'star-picker-row' });
    const label = Utils.el('div', { class: 'star-picker-label' });
    const desc = Utils.el('div', { class: 'star-picker-desc' });

    const starEls = [];
    for (let i = 1; i <= 5; i++) {
      const star = Utils.el('button', {
        type: 'button', class: 'star-picker-star', dataset: { value: String(i) }, 'aria-label': i + ' ستاره'
      });
      star.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" width="34" height="34"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>';
      star.addEventListener('click', function () { setValue(i); });
      star.addEventListener('mouseenter', function () { previewValue(i); });
      starEls.push(star);
      starsRow.appendChild(star);
    }

    const clearBtn = Utils.el('button', { type: 'button', class: 'star-picker-clear', title: 'پاک کردن امتیاز' }, ['○']);
    clearBtn.addEventListener('click', function () { setValue(0); });
    starsRow.addEventListener('mouseleave', function () { previewValue(current); });

    wrap.appendChild(starsRow);
    wrap.appendChild(clearBtn);
    wrap.appendChild(label);
    wrap.appendChild(desc);
    wrap.appendChild(ratingInput);

    function updateUI(displayValue) {
      const v = displayValue;
      starEls.forEach(function (s, i) { s.classList.toggle('is-on', (i + 1) <= v); });
      if (v === 0) {
        label.textContent = 'بدون امتیاز';
        desc.textContent = 'هنوز نمره نداده‌ام';
        wrap.dataset.color = 'none';
      } else {
        const meta = CONFIG.STARS[v];
        label.textContent = meta.emoji + '  ' + meta.label;
        desc.textContent = meta.description;
        wrap.dataset.color = String(v);
        wrap.style.setProperty('--star-current-color', meta.color);
        wrap.style.setProperty('--star-current-glow', meta.glow || 'transparent');
      }
    }
    function setValue(v) { current = v; ratingInput.value = String(v); updateUI(v); }
    function previewValue(v) { updateUI(v); }
    updateUI(current);
    wrap.__setValue = setValue;

    return Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, ['امتیاز']),
      wrap
    ]);
  }

  function collectForm(form, original) {
    original = original || {};
    const readHidden = function (name) {
      const el = form.querySelector('[name="' + name + '"]');
      return el ? el.value : '';
    };
    const data = {
      title: form.querySelector('[name="title"]').value.trim(),
      type: form.querySelector('[name="type"]').value,
      genre: form.querySelector('[name="genre"]').value.trim(),
      year: form.querySelector('[name="year"]').value ? Number(form.querySelector('[name="year"]').value) : null,
      rating: Number(form.querySelector('[name="rating"]').value) || 0,
      favorite: form.querySelector('[name="favorite"]').checked,
      notes: form.querySelector('[name="notes"]').value.trim(),
      reason: form.querySelector('[name="reason"]').value.trim(),
      watched_date: original.watched_date || null,
      summary: readHidden('_ai_summary') || original.summary || '',
      original_title: readHidden('_ai_standard_title') || original.original_title || '',
      seasons: readHidden('_ai_seasons') ? Number(readHidden('_ai_seasons')) : (original.seasons != null ? original.seasons : null),
      episodes: readHidden('_ai_episodes') ? Number(readHidden('_ai_episodes')) : (original.episodes != null ? original.episodes : null),
      episodes_per_season: readHidden('_ai_episodes_per_season') ? Number(readHidden('_ai_episodes_per_season')) : (original.episodes_per_season != null ? original.episodes_per_season : null),
      country: readHidden('_ai_country') || original.country || '',
      language: readHidden('_ai_language') || original.language || '',
      status: readHidden('_ai_status') || original.status || '',
      story_analysis: original.story_analysis ? JSON.stringify(original.story_analysis) : '',
      ai_standardized_at: readHidden('_ai_standard_title') ? new Date().toISOString() : (original.ai_standardized_at || null)
    };
    if (!data.title) {
      Toast.error('عنوان الزامی است');
      form.querySelector('[name="title"]').focus();
      form.classList.add('anim-shake');
      setTimeout(function () { form.classList.remove('anim-shake'); }, 500);
      return null;
    }
    return data;
  }

  function showDuplicateWarning(similar, newTitle, onConfirm) {
    const root = document.getElementById('modal-root');
    const wrappers = root ? Array.from(root.querySelectorAll('.modal-wrapper')) : [];
    const previousWrapper = wrappers.length > 0 ? wrappers[wrappers.length - 1] : null;
    if (previousWrapper) previousWrapper.classList.add('is-suspended');

    function restorePrevious() {
      if (!previousWrapper || !document.body.contains(previousWrapper)) return;
      const m = previousWrapper.querySelector('.modal');
      if (m && m.classList.contains('is-closing')) return;
      previousWrapper.classList.remove('is-suspended');
    }

    const matchLabels = { exact: 'دقیقاً یکسان', contains: 'شامل می‌شود', similar: 'شبیه' };
    const matchIcons = { exact: '⚠️', contains: '🔶', similar: '🔸' };

    const list = similar.map(function (s) {
      const meta = [];
      if (s.year) meta.push(Utils.toFa(s.year));
      const typeLabel = CONFIG.TYPES[s.type] || s.type;
      if (typeLabel) meta.push(typeLabel);
      return Utils.el('div', { class: 'dup-item', dataset: { match: s._matchType } }, [
        Utils.el('span', { class: 'dup-icon' }, [matchIcons[s._matchType] || '🔸']),
        Utils.el('div', { class: 'dup-info' }, [
          Utils.el('div', { class: 'dup-title' }, [s.title]),
          meta.length ? Utils.el('div', { class: 'dup-meta' }, [meta.join(' · ')]) : null
        ].filter(Boolean)),
        Utils.el('span', { class: 'dup-tag' }, [matchLabels[s._matchType] || 'شبیه'])
      ]);
    });

    const body = Utils.el('div', { class: 'dup-warning' }, [
      Utils.el('p', { class: 'dup-intro' }, [
        'عنوانی که می‌خواهی اضافه کنی — ',
        Utils.el('strong', {}, ['«' + newTitle + '»']),
        ' — شبیه این عنوان‌های موجود در آرشیو است:'
      ]),
      Utils.el('div', { class: 'dup-list' }, list),
      Utils.el('p', { class: 'dup-question' }, [
        'اگر یکی از این‌ها همان است که می‌خواستی، انصراف بزن و به‌جایش آن کارت را ویرایش کن.'
      ])
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: function () { Modal.close(); } }, ['انصراف']),
      Utils.el('button', {
        class: 'btn btn-danger',
        onclick: function () { Modal.close(); onConfirm(); }
      }, ['بله، اضافه کن'])
    ]);

    Modal.open({
      title: 'عنوان مشابه پیدا شد',
      icon: '⚠️', size: 'sm', body: body, footer: footer, onClose: restorePrevious
    });
  }

  function openDetail(id) {
    const t = DB.getTitle(id);
    if (!t) return;
    const rating = Math.floor(Number(t.rating) || 0);
    const meta = CONFIG.STARS[rating];

    const body = Utils.el('div', {}, [
      Utils.el('div', { class: 'detail-hero', dataset: { stars: String(rating) } }, [
        Utils.el('h2', { class: 'detail-title' }, [t.title]),
        t.original_title && t.original_title !== t.title
          ? Utils.el('div', { class: 'text-sm text-3 mb-2' }, [t.original_title])
          : null,
        Utils.el('div', { class: 'detail-tags' }, [
          meta && rating > 0
            ? Utils.el('span', { class: 'badge', style: { color: meta.color, borderColor: meta.color + '55' } }, [meta.emoji + ' ' + meta.label])
            : Utils.el('span', { class: 'badge' }, ['○ بدون امتیاز']),
          Utils.el('span', { class: 'badge' }, [CONFIG.TYPES[t.type] || t.type]),
          t.year ? Utils.el('span', { class: 'badge' }, [Utils.toFa(t.year)]) : null,
          t.favorite ? Utils.el('span', { class: 'badge', style: { color: 'var(--warning)' } }, ['⭐ علاقه‌مندی']) : null,
          t.ai_standardized_at ? Utils.el('span', { class: 'badge ai-badge' }, ['🪄 AI']) : null
        ].filter(Boolean))
      ]),

      Utils.el('div', { class: 'detail-grid' }, [
        detailItem('نوع', CONFIG.TYPES[t.type] || t.type),
        detailItem('سال', t.year ? Utils.toFa(t.year) : '—'),
        detailItem('ژانر', t.genre || '—'),
        t.seasons ? detailItem('فصل‌ها', Utils.toFa(t.seasons)) : null,
        t.episodes ? detailItem('قسمت‌ها', Utils.toFa(t.episodes)) : null,
        t.episodes_per_season ? detailItem('قسمت در فصل', Utils.toFa(t.episodes_per_season)) : null,
        t.country ? detailItem('کشور', t.country) : null,
        t.language ? detailItem('زبان', t.language) : null,
        t.status ? detailItem('وضعیت', t.status) : null
      ].filter(Boolean)),

      t.summary ? Utils.el('div', { class: 'mb-3' }, [
        Utils.el('h4', { class: 'mb-2' }, ['📖 خلاصه']),
        Utils.el('div', { class: 'detail-notes' }, [t.summary])
      ]) : null,

      (t.reason || t.story_analysis) ? (function () {
        const box = Utils.el('div', { class: 'story-analysis-box mb-3' });
        AIUI.renderStoryAnalysis(box, t.story_analysis, t.reason, rating);
        setTimeout(function () {
          box.querySelectorAll('.score-fill').forEach(function (f) { f.style.width = (f.dataset.pct || '0') + '%'; });
        }, 80);
        return box;
      })() : null,

      t.notes ? Utils.el('div', { class: 'mb-3' }, [
        Utils.el('h4', { class: 'mb-2' }, ['📝 یادداشت من']),
        Utils.el('div', { class: 'detail-notes' }, [t.notes])
      ]) : null
    ].filter(Boolean));

    const footer = Utils.el('div', { class: 'detail-footer' }, [
      Utils.el('div', { class: 'detail-footer-actions' }, [
        Utils.el('button', {
          class: 'btn btn-ghost danger-text',
          title: 'حذف',
          onclick: function () { Modal.close(); setTimeout(function () { deleteWithUndo(id); }, 150); }
        }, ['🗑️ حذف']),
        Utils.el('button', {
          class: 'btn btn-ghost',
          title: 'ویرایش',
          onclick: function () { Modal.close(); setTimeout(function () { openAddEdit(id); }, 150); }
        }, ['✏️ ویرایش']),
        Utils.el('button', {
          class: 'btn btn-ghost',
          title: 'استانداردسازی',
          onclick: function () { Modal.close(); setTimeout(function () { AIUI.openStandardizeSingle(id); }, 150); }
        }, ['✨ استانداردسازی']),
        Utils.el('button', {
          class: 'btn btn-soft',
          title: 'تحلیل AI',
          onclick: function () { Modal.close(); setTimeout(function () { AIUI.openAnalyzeSingle(id); }, 150); }
        }, ['🔬 تحلیل AI'])
      ]),
      Utils.el('button', { class: 'btn btn-primary', onclick: function () { Modal.close(); } }, ['بستن'])
    ]);

    Modal.open({ title: 'جزئیات', icon: '🎬', size: 'xl', body: body, footer: footer });
  }

  function detailItem(k, v) {
    return Utils.el('div', { class: 'detail-item' }, [
      Utils.el('div', { class: 'k' }, [k]),
      Utils.el('div', { class: 'v' }, [v])
    ]);
  }


  function openSettings() {
    const aiKey = AI.getKey();
    const currentModel = (typeof AI.getModel === 'function') ? AI.getModel() : '';
    const aiOK = !!aiKey;
    const user = DB.getUser && DB.getUser();
    const email = user && user.email ? user.email : '—';

    function row(label, input, hint) {
      const children = [Utils.el('label', {}, [label]), input];
      if (hint) children.push(Utils.el('small', {}, [hint]));
      return Utils.el('div', { class: 'settings-row' }, children);
    }
    function input(name, value, opts) {
      opts = opts || {};
      return Utils.el('input', {
        class: 'field-input', type: opts.type || 'text', name: name,
        value: value || '', placeholder: opts.placeholder || '',
        autocomplete: opts.autocomplete || 'off', spellcheck: 'false'
      });
    }

    /* ---- Account ---- */
    const accountSection = Utils.el('div', { class: 'settings-section' }, [
      Utils.el('div', { class: 'settings-section-head' }, [
        Utils.el('div', { class: 'settings-icon' }, ['👤']),
        Utils.el('div', { class: 'settings-info' }, [
          Utils.el('h4', {}, ['حساب کاربری']),
          Utils.el('p', {}, [email])
        ]),
        Utils.el('span', { class: 'settings-status', dataset: { status: user ? 'ok' : 'missing' } }, [user ? 'وارد شده' : 'خارج'])
      ]),
      Utils.el('div', { class: 'settings-tests' }, [
        Utils.el('button', { class: 'settings-test-btn', id: 'btn-logout', type: 'button' }, ['خروج از حساب'])
      ])
    ]);

    /* ---- AI ---- */
    const picker = AIModelsUI.buildModelPicker(currentModel, function () {});

    const aiSection = Utils.el('div', { class: 'settings-section' }, [
      Utils.el('div', { class: 'settings-section-head' }, [
        Utils.el('div', { class: 'settings-icon' }, ['🪄']),
        Utils.el('div', { class: 'settings-info' }, [
          Utils.el('h4', {}, ['هوش مصنوعی (Edge)']),
          Utils.el('p', {}, ['Gemini مستقیم + OpenRouter — کلیدها روی سرور'])
        ]),
        Utils.el('span', { class: 'settings-status', dataset: { status: aiOK ? 'ok' : 'missing' } }, [aiOK ? 'فعال' : 'تنظیم نشده'])
      ]),
      Utils.el('div', { class: 'settings-fields' }, [
        Utils.el('div', { class: 'settings-hint' }, [Utils.el('span', {}, ['کلیدها فقط روی سرور (GEM_MALI و OPENROUTER_API_KEY) هستند و در مرورگر ذخیره نمی‌شوند.'])])
      ]),
      Utils.el('div', { class: 'settings-fieldset' }, [
        Utils.el('div', { class: 'settings-fieldset-label' }, ['مدل فعال']),
        picker.el
      ]),
      Utils.el('div', { class: 'settings-tests' }, [
        Utils.el('button', { class: 'settings-test-btn', id: 'btn-ai-log', type: 'button' }, ['📋 نمایش لاگ AI']),
        Utils.el('button', { class: 'settings-test-btn', id: 'btn-test-ai', type: 'button' }, ['✨ تست اتصال AI'])
      ])
    ]);

    const body = Utils.el('div', { class: 'settings' }, [accountSection, aiSection]);

    const footer = Utils.el('div', { class: 'settings-footer' }, [
      Utils.el('button', {
        class: 'settings-test-btn',
        id: 'btn-db-admin',
        'data-action': 'db-admin',
        type: 'button'
      }, ['🗄️ مدیریت دیتابیس']),
      Utils.el('div', { class: 'spacer' }),
      Utils.el('button', { class: 'btn btn-ghost', onclick: function () { Modal.close(); } }, ['بستن']),
      Utils.el('button', { class: 'btn btn-primary', id: 'btn-save-settings' }, ['💾 ذخیره تنظیمات AI'])
    ]);

    Modal.open({ title: 'تنظیمات', icon: '⚙️', size: 'lg', body: body, footer: footer });

    /* ---- handlers ---- */
    document.getElementById('btn-logout')?.addEventListener('click', async function () {
      if (!confirm('خروج از حساب؟')) return;
      try {
        await DB.signOut();
        location.reload();
      } catch (e) {
        Toast.error(e.message || 'خطا در خروج');
      }
    });

    document.getElementById('btn-save-settings')?.addEventListener('click', function () {
      if (picker && typeof picker.getSelected === 'function') {
        const m = picker.getSelected();
        if (m && typeof AI.setModel === 'function') AI.setModel(m);
      }
      Toast.success('تنظیمات ذخیره شد');
      Modal.close();
    });

    document.getElementById('btn-ai-log')?.addEventListener('click', function () {
      try {
        if (typeof AIUI !== 'undefined' && typeof AIUI.showLog === 'function') {
          AIUI.showLog();
        } else if (typeof AILog !== 'undefined' && typeof AILog.show === 'function') {
          AILog.show();
        } else {
          Toast.info('لاگ AI در دسترس نیست');
        }
      } catch (e) { console.error('[ai-log]', e); }
    });

    document.getElementById('btn-test-ai')?.addEventListener('click', async function () {
      try {
        Toast.info('در حال تست AI…');
        if (typeof AI.testConnection === 'function') {
          await AI.testConnection();
          Toast.success('اتصال AI برقرار است');
        } else {
          Toast.info('کلید ذخیره شد — برای تست از تحلیل یک عنوان استفاده کن');
        }
      } catch (e) {
        Toast.error(e.message || 'تست ناموفق');
      }
    });

    document.getElementById('btn-db-admin')?.addEventListener('click', function () {
      if (typeof DBAdmin !== 'undefined' && DBAdmin.open) DBAdmin.open();
      else Toast.info('مدیریت دیتابیس در نسخه آنلاین محدود است');
    });
  }

  async function pullFromGitHub() {
    Toast.info('همگام‌سازی با گیت‌هاب در نسخه آنلاین غیرفعال است');
  }

  async function pushToGitHub() {
    Toast.info('داده‌ها به‌صورت خودکار روی Supabase ذخیره می‌شوند');
  }

  function updateSyncStatus(state) {
    const el = document.getElementById('sync-status');
    const lbl = document.getElementById('sync-label');
    if (!el || !lbl) return;
    el.dataset.state = 'online';
    lbl.textContent = 'آنلاین';
  }

  function refreshSyncStatus() {
    updateSyncStatus('online');
  }

  return {
    bind: bind, renderList: renderList,
    openAddEdit: openAddEdit, openDetail: openDetail, openSettings: openSettings,
    deleteWithUndo: deleteWithUndo,
    updateSyncStatus: updateSyncStatus, refreshSyncStatus: refreshSyncStatus,
    pullFromGitHub: pullFromGitHub, pushToGitHub: pushToGitHub,
    openDbAdmin: openDbAdmin
  };
})();