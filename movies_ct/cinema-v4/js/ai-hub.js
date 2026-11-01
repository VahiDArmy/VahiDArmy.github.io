/* =========================================================
   صفحهٔ اصلی — امکانات هوش مصنوعی
   ۱) انتخاب مدل سایت (+ همگام‌سازی OpenRouter)
   ۲) ابزارها: پرامپت آزاد، تحلیل سلیقه/پیشنهاد، استانداردسازی دسته‌ای
   ۳) جدول مدل‌ها و بازخورد (پذیرش / رد / خطا)
   ========================================================= */
(function () {
  const $ = function (s) { return document.querySelector(s); };

  const view = { q: '', provider: 'all', showInactive: false, sort: 'wins' };
  let freeReview = null;
  let kind = 'both';

  /* =========================================================
     ۱) کارت مدل سایت
     ========================================================= */
  function renderCurrent() {
    const m = AI.getModel();
    const all = DB.getAiModels();
    const active = all.filter(function (x) { return x.active; });
    const count = function (list, p) { return list.filter(function (x) { return x.provider === p; }).length; };

    const slot = $('#cur-model');
    slot.innerHTML = '';
    slot.appendChild(AIReview.modelChip(m));
    if (m.vendor) slot.appendChild(Utils.el('span', { class: 'cur-vendor' }, [m.vendor]));
    slot.appendChild(Utils.el('code', { class: 'cur-id' }, [m.id]));

    $('#pool-summary').textContent =
      Utils.toFa(active.length) + ' مدل فعال از ' + Utils.toFa(all.length) +
      ' — Google: ' + Utils.toFa(count(active, 'google')) + ' · OpenRouter: ' + Utils.toFa(count(active, 'openrouter'));
    $('#hd-models').textContent = Utils.toFa(active.length);
  }

  async function syncModels() {
    const btn = $('#btn-sync');
    btn.disabled = true;
    const old = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> در حال دریافت…';
    try {
      const r = await AI.syncOpenRouter();
      Toast.success(
        Utils.toFa(r.listed) + ' مدل رایگان در OpenRouter — ' + Utils.toFa(r.added) + ' جدید اضافه شد' +
        (r.deactivated ? ' · ' + Utils.toFa(r.deactivated) + ' مدلِ ناموجود غیرفعال شد' : ''),
        { title: 'همگام‌سازی انجام شد', duration: 6000 }
      );
      renderAll();
    } catch (e) {
      Toast.error(e.message || 'همگام‌سازی ناموفق بود', { title: 'OpenRouter' });
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }

  async function testConnection() {
    const btn = $('#btn-test');
    const m = AI.getModel();
    btn.disabled = true;
    try {
      const text = await AI.chat({ model: m.id, messages: [{ role: 'user', content: 'فقط بگو: ok' }], temperature: 0 });
      Toast.success('«' + m.label + '» پاسخ داد: ' + text.trim().slice(0, 40), { title: 'اتصال برقرار است' });
    } catch (e) {
      Toast.error(e.message || 'تست ناموفق', { title: '«' + m.label + '» پاسخ نداد' });
    } finally { btn.disabled = false; }
  }

  /* =========================================================
     ۲) جدول مدل‌ها
     ========================================================= */
  function rate(m) {
    const n = m.wins + m.losses + m.fails;
    return n ? m.wins / n : null;
  }

  function visibleModels() {
    const q = Utils.normalizeFa(view.q);
    const siteId = AI.getModelId();
    const list = DB.getAiModels().filter(function (m) {
      if (!view.showInactive && !m.active && m.id !== siteId) return false;
      if (view.provider !== 'all' && m.provider !== view.provider) return false;
      if (q && Utils.normalizeFa(m.label + ' ' + m.id + ' ' + m.vendor).indexOf(q) < 0) return false;
      return true;
    });
    const sorters = {
      wins: function (a, b) { return (b.wins - a.wins) || (a.fails - b.fails) || a.label.localeCompare(b.label); },
      fails: function (a, b) { return (a.fails - b.fails) || (b.wins - a.wins) || a.label.localeCompare(b.label); },
      name: function (a, b) { return a.label.localeCompare(b.label); }
    };
    list.sort(function (a, b) {
      if ((a.id === siteId) !== (b.id === siteId)) return a.id === siteId ? -1 : 1;
      return sorters[view.sort](a, b);
    });
    return list;
  }

  function modelRow(m) {
    const isSite = m.id === AI.getModelId();
    const r = rate(m);
    const sw = Utils.el('label', { class: 'switch', title: m.active ? 'در استخر تصادفی' : 'خارج از استخر تصادفی' });
    const cb = Utils.el('input', { type: 'checkbox' });
    cb.checked = m.active;
    cb.addEventListener('change', function () { DB.setAiModelActive(m.id, cb.checked); renderAll(); });
    sw.appendChild(cb);
    sw.appendChild(Utils.el('span', { class: 'switch-track' }));

    const useBtn = Utils.el('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: isSite }, [isSite ? '✓ مدل سایت' : 'انتخاب']);
    useBtn.addEventListener('click', function () {
      AI.setModel(m.id);
      Toast.success('«' + m.label + '» مدل سایت شد');
    });

    const reset = Utils.el('button', { class: 'icon-btn mr-reset', type: 'button', title: 'صفر کردن آمار' }, ['↺']);
    reset.disabled = !(m.wins || m.losses || m.fails);
    reset.addEventListener('click', function () { DB.resetAiStats(m.id); renderAll(); });

    return Utils.el('tr', { class: (isSite ? 'is-site ' : '') + (m.active ? '' : 'is-off') }, [
      Utils.el('td', { class: 'mr-name' }, [
        Utils.el('div', { class: 'mr-label' }, [m.label]),
        Utils.el('code', { class: 'mr-id' }, [m.id])
      ]),
      Utils.el('td', {}, [Utils.el('span', { class: 'mchip-prov', dataset: { provider: m.provider } }, [AIReview.PROVIDER_LABEL[m.provider] || m.provider])]),
      Utils.el('td', { class: 'mr-ctx' }, [m.context || '—']),
      Utils.el('td', { class: 'mr-n is-win' }, [Utils.toFa(m.wins)]),
      Utils.el('td', { class: 'mr-n is-loss' }, [Utils.toFa(m.losses)]),
      Utils.el('td', { class: 'mr-n is-fail' }, [Utils.toFa(m.fails)]),
      Utils.el('td', { class: 'mr-rate' }, [r == null ? '—' : Utils.toFa(Math.round(r * 100)) + '٪']),
      Utils.el('td', {}, [sw]),
      Utils.el('td', { class: 'mr-act' }, [useBtn, reset])
    ]);
  }

  function renderTable() {
    const body = $('#model-rows');
    body.innerHTML = '';
    const list = visibleModels();
    if (!list.length) {
      body.appendChild(Utils.el('tr', {}, [Utils.el('td', { colspan: '9', class: 'mr-empty' }, [
        DB.getAiModels().length > 1 ? 'مدلی با این فیلتر نیست' : 'هنوز مدل OpenRouter نداری — «همگام‌سازی» را بزن'
      ])]));
    } else list.forEach(function (m) { body.appendChild(modelRow(m)); });
    $('#model-count').textContent = Utils.toFa(list.length) + ' مدل';
  }

  function renderAll() { renderCurrent(); renderTable(); }

  function bindModels() {
    $('#btn-sync').addEventListener('click', syncModels);
    $('#btn-test').addEventListener('click', testConnection);
    $('#model-search').addEventListener('input', Utils.debounce(function (e) { view.q = e.target.value; renderTable(); }, 120));
    $('#model-sort').addEventListener('change', function (e) { view.sort = e.target.value; renderTable(); });
    $('#model-inactive').addEventListener('change', function (e) { view.showInactive = e.target.checked; renderTable(); });
    document.querySelectorAll('#provider-chips .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('#provider-chips .chip').forEach(function (x) { x.classList.toggle('is-on', x === c); });
        view.provider = c.dataset.provider;
        renderTable();
      });
    });
    AI.onModelChange(renderAll);
    window.addEventListener('ai:stats', renderAll);
  }

  /* =========================================================
     ۳) ابزارها
     ========================================================= */
  function fillTitleSelect() {
    const sel = $('#fp-title');
    DB.getAllTitles().forEach(function (t) { sel.appendChild(Utils.el('option', { value: t.id }, [t.title])); });
  }

  function sendFreePrompt() {
    const prompt = $('#fp-text').value.trim();
    if (!prompt) { Toast.warning('پرامپت خالی است'); $('#fp-text').focus(); return; }
    if (freeReview) freeReview.destroy();
    const mount = $('#fp-result');
    mount.innerHTML = '';
    mount.hidden = false;
    freeReview = AIReview.create(AITasks.freePromptOptions(prompt, $('#fp-title').value || null));
    mount.appendChild(freeReview.el);
    freeReview.start();
  }

  function refreshBatchInfo() {
    const only = $('#batch-only').checked;
    const all = DB.getAllTitles();
    const list = only ? all.filter(function (t) { return !t.ai_standardized_at; }) : all;
    $('#batch-info').textContent = Utils.toFa(list.length) + ' عنوان — ' + Utils.toFa(Math.ceil(list.length / CONFIG.AI.BATCH_SIZE)) + ' درخواست';
    return list;
  }

  function bindTools() {
    fillTitleSelect();
    $('#fp-send').addEventListener('click', sendFreePrompt);
    $('#fp-text').addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); sendFreePrompt(); }
    });
    $('#fp-history').addEventListener('click', openHistory);
    $('#btn-history').addEventListener('click', openHistory);

    document.querySelectorAll('#kind-chips .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('#kind-chips .chip').forEach(function (x) { x.classList.toggle('is-on', x === c); });
        kind = c.dataset.kind;
      });
    });
    $('#btn-taste').addEventListener('click', function () { AITasks.openTaste(); });
    $('#btn-suggest').addEventListener('click', function () { AITasks.openSuggest(kind); });

    $('#batch-only').addEventListener('change', refreshBatchInfo);
    $('#btn-batch').addEventListener('click', function () { AITasks.openBatch(refreshBatchInfo()); });
    window.addEventListener('titles:changed', refreshBatchInfo);
    refreshBatchInfo();
  }

  /* =========================================================
     تاریخچهٔ گفتگوها
     ========================================================= */
  function openHistory() {
    let all = DB.getAllConversations();
    const search = Utils.el('input', { class: 'field-input', type: 'search', placeholder: 'جستجو در پرامپت‌ها و پاسخ‌ها…', autocomplete: 'off' });
    const count = Utils.el('div', { class: 'conversations-count' });
    const list = Utils.el('div', { class: 'conversations-list' });

    function render() {
      all = DB.getAllConversations();
      count.textContent = Utils.toFa(all.length) + ' گفتگوی ذخیره‌شده';
      list.innerHTML = '';
      const q = Utils.normalizeFa(search.value);
      const rows = q ? all.filter(function (c) { return Utils.normalizeFa((c.prompt || '') + ' ' + (c.response || '') + ' ' + (c.title_context || '')).indexOf(q) > -1; }) : all;
      if (!rows.length) { list.appendChild(Utils.el('div', { class: 'conversations-empty' }, [all.length ? 'چیزی پیدا نشد' : 'هنوز گفتگویی ذخیره نکرده‌ای'])); return; }
      rows.forEach(function (c) {
        const model = typeof c.ai_model === 'string' ? c.ai_model : '';
        list.appendChild(Utils.el('div', { class: 'conv-item', role: 'button', tabindex: '0', onclick: function () { viewConversation(c, render); } }, [
          Utils.el('div', { class: 'conv-head' }, [
            Utils.el('div', { class: 'conv-title' }, [Utils.el('span', { class: 'conv-title-badge' + (c.title_context ? '' : ' conv-title-general') }, [c.title_context ? '🎬 ' + c.title_context : '📌 عمومی'])]),
            Utils.el('span', { class: 'conv-date' }, [(model ? model + ' · ' : '') + Utils.toJalali(c.created_at)])
          ]),
          Utils.el('div', { class: 'conv-prompt' }, [(c.prompt || '').slice(0, 120) + ((c.prompt || '').length > 120 ? '…' : '')]),
          c.response ? Utils.el('div', { class: 'conv-response' }, [c.response.replace(/[#*`_\-]/g, '').slice(0, 140) + '…']) : null
        ].filter(Boolean)));
      });
    }
    search.addEventListener('input', Utils.debounce(render, 150));
    render();

    Modal.open({
      title: 'تاریخچهٔ گفتگوها', icon: '📚', size: 'lg',
      body: Utils.el('div', { class: 'conversations-body' }, [search, count, list]),
      footer: Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [Utils.el('button', { class: 'btn btn-ghost', onclick: function () { Modal.close(); } }, ['بستن'])])
    });
  }

  function viewConversation(c, onChange) {
    const response = Utils.el('div', { class: 'conv-view-response' });
    response.innerHTML = AIRender.renderMarkdown(c.response || '');
    const model = typeof c.ai_model === 'string' ? c.ai_model : '';
    Modal.open({
      title: 'نمایش گفتگو', icon: '💬', size: 'lg',
      body: Utils.el('div', { class: 'conv-view' }, [
        Utils.el('div', { class: 'conv-view-meta' }, [
          Utils.el('span', {}, ['📅 ' + Utils.toJalaliLong(c.created_at)]),
          c.title_context ? Utils.el('span', {}, ['🎬 ' + c.title_context]) : null,
          model ? Utils.el('span', {}, ['🪄 ' + model]) : null
        ].filter(Boolean)),
        Utils.el('div', { class: 'conv-view-section' }, [Utils.el('div', { class: 'conv-view-label' }, ['سؤال:']), Utils.el('div', { class: 'conv-view-prompt' }, [c.prompt])]),
        Utils.el('div', { class: 'conv-view-section' }, [Utils.el('div', { class: 'conv-view-label' }, ['پاسخ:']), response])
      ]),
      footer: Utils.el('div', { class: 'flex gap-3 w-full' }, [
        Utils.el('button', { class: 'btn btn-danger', onclick: function () {
          Modal.confirm({ title: 'حذف گفتگو', message: 'این سؤال و جواب برای همیشه حذف شود؟', confirmText: 'حذف کن', danger: true, icon: '🗑️',
            onConfirm: function () { DB.deleteConversation(c.id); Toast.success('حذف شد'); Modal.close(); setTimeout(onChange, 200); } });
        } }, ['حذف']),
        Utils.el('button', { class: 'btn btn-ghost', onclick: function () {
          Utils.copyToClipboard(c.prompt + '\n\n---\n\n' + c.response).then(function (ok) { Toast.success(ok ? 'کپی شد' : 'کپی ناموفق'); });
        } }, ['📋 کپی']),
        Utils.el('div', { class: 'flex-1' }),
        Utils.el('button', { class: 'btn btn-primary', onclick: function () { Modal.close(); } }, ['بستن'])
      ])
    });
  }

  /* =========================================================
     شروع
     ========================================================= */
  Boot.start(async function () {
    $('#app-version').textContent = Utils.toFa(CONFIG.APP_VERSION);
    $('#hd-titles').textContent = Utils.toFa(DB.getAllTitles().length);
    bindModels();
    bindTools();
    renderAll();
  });
})();
