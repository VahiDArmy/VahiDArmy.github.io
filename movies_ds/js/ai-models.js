/* =========================================================
   UI مدل‌های AI — انتخاب‌گر + جستجوی رایگان OpenRouter
   ========================================================= */
window.AIModelsUI = (function () {

  const OR_MODELS_URL = 'https://openrouter.ai/api/v1/models';

  /* =========================================================
     Helpers
     ========================================================= */
  function formatContextLength(n) {
    n = Number(n) || 0;
    if (!n) return '';
    if (n >= 1e6) {
      const v = n / 1e6;
      return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'M';
    }
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(n);
  }

  function suspendParentWrapper() {
    const root = document.getElementById('modal-root');
    const wrappers = root ? Array.from(root.querySelectorAll('.modal-wrapper')) : [];
    const prev = wrappers.length > 0 ? wrappers[wrappers.length - 1] : null;
    if (prev) prev.classList.add('is-suspended');
    return function restore() {
      if (!prev || !document.body.contains(prev)) return;
      const m = prev.querySelector('.modal');
      if (m && m.classList.contains('is-closing')) return;
      prev.classList.remove('is-suspended');
    };
  }

  /* =========================================================
     OpenRouter — دریافت مدل‌های رایگان
     ========================================================= */
  async function fetchOpenRouterFreeModels() {
    const res = await fetch(OR_MODELS_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error('OpenRouter HTTP ' + res.status);
    const json = await res.json();
    const all = Array.isArray(json.data) ? json.data : [];
    const free = all.filter(function (m) {
      const p = m.pricing || {};
      const pp = Number(p.prompt || 0);
      const cp = Number(p.completion || 0);
      const isFreePrice = pp === 0 && cp === 0;
      const isFreeTag = String(m.id || '').endsWith(':free');
      return isFreePrice || isFreeTag;
    });
    return free.map(function (m) {
      return {
        id: m.id,
        name: m.name || m.id,
        description: m.description || '',
        context_length: m.context_length || 0,
        vendor: (m.id || '').split('/')[0] || ''
      };
    });
  }

  /* =========================================================
     انتخاب‌گر مدل
     ========================================================= */
  function buildModelPicker(currentModelId, onSelect) {
    let selected = currentModelId;
    let models = AI.getModels();
    const defaultId = (models.filter(function (m) { return m.recommended; })[0] || models[0] || {}).id || '';

    const searchInput = Utils.el('input', {
      class: 'field-input model-search',
      type: 'text',
      placeholder: 'جستجو در مدل‌ها…',
      autocomplete: 'off'
    });

    const fetchBtn = Utils.el('button', {
      class: 'model-fetch-btn',
      type: 'button',
      title: 'جستجوی مدل‌های رایگان OpenRouter',
      onclick: function () {
        openOpenRouterFetch({ onChanged: refresh });
      }
    }, ['🔍 OpenRouter']);

    const listWrap = Utils.el('div', { class: 'model-list' });
    const statsBar = Utils.el('div', { class: 'model-stats' });

    function renderList(query) {
      listWrap.innerHTML = '';
      const q = Utils.normalizeFa(query || '').toLowerCase();
      const filtered = models.filter(function (m) {
        if (!q) return true;
        const hay = Utils.normalizeFa(
          m.label + ' ' + m.vendor + ' ' + m.id + ' ' +
          (m.tags || []).join(' ') + ' ' + (m.note || '')
        ).toLowerCase();
        return hay.indexOf(q) > -1;
      });

      if (!filtered.length) {
        listWrap.appendChild(Utils.el('div', { class: 'model-empty' }, [
          models.length ? 'مدلی با این جستجو پیدا نشد' : 'هیچ مدلی ثبت نشده — با دکمه 🔍 اضافه کن'
        ]));
        return;
      }

      filtered.forEach(function (m) {
        const isActive = m.id === selected;
        const isDefault = m.id === defaultId;

        const card = Utils.el('div', {
          class: 'model-card' + (isActive ? ' is-active' : ''),
          dataset: { model: m.id },
          role: 'button',
          tabindex: '0'
        }, [
          Utils.el('button', {
            class: 'model-card-del',
            type: 'button',
            title: 'حذف مدل',
            onclick: function (e) {
              e.stopPropagation();
              confirmDeleteModel(m);
            }
          }, ['✕']),
          Utils.el('div', { class: 'model-card-head' }, [
            Utils.el('div', { class: 'model-card-title' }, [
              Utils.el('span', { class: 'model-card-label' }, [m.label || m.id]),
              Utils.el('span', { class: 'model-card-vendor' }, [m.vendor || ''])
            ]),
            Utils.el('div', { class: 'model-card-badges' }, [
              isDefault ? Utils.el('span', { class: 'model-badge model-badge-default' }, ['پیش‌فرض']) : null,
              m.recommended ? Utils.el('span', { class: 'model-badge model-badge-rec' }, ['★']) : null,
              isActive ? Utils.el('span', { class: 'model-badge model-badge-active' }, ['✓']) : null
            ].filter(Boolean))
          ]),
          Utils.el('div', { class: 'model-card-meta' }, [
            m.size && m.size !== '—' ? Utils.el('span', { class: 'model-meta-item' }, [m.size]) : null,
            m.context ? Utils.el('span', { class: 'model-meta-item' }, [m.context + ' ctx']) : null,
            m.speed && m.speed !== '—' ? Utils.el('span', { class: 'model-meta-item' }, [m.speed + ' t/s']) : null
          ].filter(Boolean)),
          m.note ? Utils.el('div', { class: 'model-card-note' }, [m.note]) : null,
          Utils.el('div', { class: 'model-card-id' }, [m.id])
        ]);

        function select() {
          selected = m.id;
          if (onSelect) onSelect(m.id);
          renderList(searchInput.value);
          updateStats();
        }
        card.addEventListener('click', select);
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
        });
        listWrap.appendChild(card);
      });
    }

    function updateStats() {
      const meta = models.filter(function (m) { return m.id === selected; })[0];
      statsBar.innerHTML = '';
      statsBar.appendChild(Utils.el('span', { class: 'model-stats-count' }, [Utils.toFa(models.length) + ' مدل']));
      if (meta) {
        statsBar.appendChild(Utils.el('span', { class: 'model-stats-sep' }, ['·']));
        statsBar.appendChild(Utils.el('span', { class: 'model-stats-current' }, ['فعال: ' + (meta.label || meta.id)]));
      }
    }

    function confirmDeleteModel(m) {
      Modal.confirm({
        title: 'حذف مدل',
        message: '«' + (m.label || m.id) + '» از لیست مدل‌های ذخیره‌شده حذف شود؟',
        icon: '🗑️',
        danger: true,
        confirmText: 'حذف کن',
        onConfirm: function () {
          try {
            DB.deleteAiModel(m.id);
            if (selected === m.id) selected = '';
            Toast.success('«' + (m.label || m.id) + '» حذف شد');
            refresh();
          } catch (e) {
            Toast.error('حذف: ' + e.message);
          }
        }
      });
    }

    function refresh() {
      models = AI.getModels();
      renderList(searchInput.value);
      updateStats();
    }

    searchInput.addEventListener('input', Utils.debounce(function (e) { renderList(e.target.value); }, 120));
    renderList('');
    updateStats();

    return {
      el: Utils.el('div', { class: 'model-picker' }, [
        Utils.el('div', { class: 'model-picker-toolbar' }, [searchInput, fetchBtn]),
        statsBar,
        listWrap
      ]),
      getSelected: function () { return selected; },
      refresh: refresh
    };
  }

  /* =========================================================
     مودال جستجوی مدل‌های رایگان OpenRouter
     ========================================================= */
  function openOpenRouterFetch(opts) {
    opts = opts || {};
    const onChanged = opts.onChanged || function () {};
    const restoreParent = suspendParentWrapper();

    const listWrap = Utils.el('div', { class: 'orm-list' });
    const statusBar = Utils.el('div', { class: 'orm-status' }, ['در حال بارگذاری…']);
    const refreshBtn = Utils.el('button', {
      class: 'orm-refresh-btn',
      type: 'button',
      onclick: function () { load(); }
    }, ['🔄 بروزرسانی']);

    const body = Utils.el('div', { class: 'orm-body' }, [
      Utils.el('div', { class: 'orm-toolbar' }, [
        statusBar,
        Utils.el('div', { class: 'flex-1' }),
        refreshBtn
      ]),
      listWrap
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', {
        class: 'btn btn-ghost',
        onclick: function () { Modal.close(); }
      }, ['بستن'])
    ]);

    Modal.open({
      title: 'مدل‌های رایگان OpenRouter',
      icon: '🔍',
      size: 'lg',
      body: body,
      footer: footer,
      onClose: restoreParent
    });

    load();

    async function load() {
      listWrap.innerHTML = '';
      listWrap.appendChild(Utils.el('div', { class: 'orm-loading' }, [
        Utils.el('span', { class: 'spinner' }),
        Utils.el('span', {}, ['در حال دریافت از OpenRouter…'])
      ]));
      statusBar.textContent = 'در حال بارگذاری…';
      refreshBtn.disabled = true;

      try {
        const models = await fetchOpenRouterFreeModels();
        statusBar.textContent = Utils.toFa(models.length) + ' مدل رایگان';
        renderList(models);
      } catch (e) {
        listWrap.innerHTML = '';
        listWrap.appendChild(Utils.el('div', { class: 'orm-error' }, [
          Utils.el('div', { class: 'orm-error-icon' }, ['⚠️']),
          Utils.el('div', {}, ['خطا در دریافت: ' + Utils.esc(e.message || String(e))]),
          Utils.el('div', { class: 'orm-error-hint' }, ['مطمئن شو به اینترنت دسترسی داری.'])
        ]));
        statusBar.textContent = 'خطا';
      } finally {
        refreshBtn.disabled = false;
      }
    }

    function renderList(models) {
      listWrap.innerHTML = '';
      if (!models.length) {
        listWrap.appendChild(Utils.el('div', { class: 'orm-empty' }, ['مدل رایگانی پیدا نشد.']));
        return;
      }

      const inDb = {};
      DB.getAiModels().forEach(function (m) { inDb[m.id] = true; });

      const sorted = models.slice().sort(function (a, b) {
        const aIn = inDb[a.id] ? 1 : 0;
        const bIn = inDb[b.id] ? 1 : 0;
        if (aIn !== bIn) return aIn - bIn;
        return String(a.name).localeCompare(String(b.name));
      });

      sorted.forEach(function (m) {
        listWrap.appendChild(buildOrItem(m, inDb[m.id], function () {
          openAddModelForm(m, function () {
            onChanged();
            /* لیست را با inDb به‌روز دوباره رندر کن */
            inDb[m.id] = true;
            renderList(sorted);
            statusBar.textContent = Utils.toFa(sorted.length) + ' مدل رایگان';
          });
        }));
      });
    }

    function buildOrItem(m, alreadyIn, onAdd) {
      const ctx = formatContextLength(m.context_length);
      const item = Utils.el('div', { class: 'orm-item' + (alreadyIn ? ' is-added' : '') });
      item.appendChild(Utils.el('div', { class: 'orm-item-info' }, [
        Utils.el('div', { class: 'orm-item-name' }, [m.name]),
        Utils.el('div', { class: 'orm-item-id' }, [m.id]),
        Utils.el('div', { class: 'orm-item-meta' }, [
          ctx ? Utils.el('span', {}, [ctx + ' ctx']) : null,
          m.vendor ? Utils.el('span', {}, [m.vendor]) : null
        ].filter(Boolean))
      ]));
      if (alreadyIn) {
        item.appendChild(Utils.el('span', { class: 'orm-badge-added' }, ['✓ افزوده شده']));
      } else {
        item.appendChild(Utils.el('button', {
          class: 'orm-add-btn',
          type: 'button',
          onclick: onAdd
        }, ['+ افزودن']));
      }
      return item;
    }
  }

  /* =========================================================
     فرم افزودن مدل — با استخراج خودکار مشخصات از AI
     ========================================================= */
  function openAddModelForm(prefill, onSaved) {
    const restoreParent = suspendParentWrapper();
    const ctxText = formatContextLength(prefill.context_length);

    const idInp = Utils.el('input', {
      class: 'field-input', type: 'text',
      value: prefill.id || '', readonly: true, dir: 'ltr'
    });
    const labelInp = Utils.el('input', {
      class: 'field-input', type: 'text',
      value: prefill.name || '', maxlength: 120
    });
    const vendorInp = Utils.el('input', {
      class: 'field-input', type: 'text',
      value: prefill.vendor || '', maxlength: 80
    });
    const sizeInp = Utils.el('input', {
      class: 'field-input', type: 'text',
      placeholder: 'مثلاً 550B یا —', maxlength: 20
    });
    const ctxInp = Utils.el('input', {
      class: 'field-input', type: 'text',
      value: ctxText, maxlength: 20
    });
    const speedInp = Utils.el('input', {
      class: 'field-input', type: 'text',
      placeholder: 'مثلاً 44 یا —', maxlength: 10
    });
    const tagsInp = Utils.el('input', {
      class: 'field-input', type: 'text',
      placeholder: 'تحلیل عمیق، کانتکست بزرگ', maxlength: 200
    });
    const noteArea = Utils.el('textarea', {
      class: 'field-textarea',
      placeholder: 'توضیح کوتاه فارسی…',
      maxlength: 400
    });
    const recCheck = Utils.el('input', { type: 'checkbox' });
    const bestForSel = Utils.el('select', { class: 'field-select' });
    [['', 'عمومی'], ['analysis', 'تحلیل عمیق'], ['batch', 'استانداردسازی دسته‌ای'], ['long', 'کانتکست طولانی']].forEach(function (pair) {
      bestForSel.appendChild(Utils.el('option', { value: pair[0] }, [pair[1]]));
    });

    /* ---- نوار استخراج با AI ---- */
    const enrichStatus = Utils.el('div', { class: 'orm-enrich-status' });
    const enrichBtn = Utils.el('button', {
      class: 'orm-enrich-btn',
      type: 'button',
      onclick: function () { enrichFromAI(); }
    }, ['🪄 پرکردن با AI']);

    const enrichBar = Utils.el('div', { class: 'orm-enrich-bar' }, [
      enrichBtn,
      enrichStatus
    ]);

    /* ---- وضعیت ---- */
    const aiReady = AI.isConfigured() && AI.getModels().length > 0;

    if (!aiReady) {
      if (!AI.isConfigured()) {
        enrichStatus.textContent = 'AI تنظیم نشده — مشخصات را دستی پر کن';
        enrichStatus.dataset.state = 'warn';
      } else {
        enrichStatus.textContent = 'هیچ مدلی برای صدا زدن AI موجود نیست';
        enrichStatus.dataset.state = 'warn';
      }
      enrichBtn.disabled = true;
    } else {
      enrichStatus.textContent = 'آماده استخراج…';
      enrichStatus.dataset.state = 'idle';
    }

    function field(labelText, inputEl, hint) {
      return Utils.el('div', { class: 'field' }, [
        Utils.el('label', { class: 'field-label' }, [labelText]),
        inputEl,
        hint ? Utils.el('div', { class: 'field-hint' }, [hint]) : null
      ].filter(Boolean));
    }

    const form = Utils.el('div', { class: 'orm-form' }, [
      field('شناسه OpenRouter', idInp),
      field('نام نمایشی', labelInp, 'این همان چیزی است که در تنظیمات دیده می‌شود'),
      Utils.el('div', { class: 'form-row form-row-3' }, [
        field('سازنده', vendorInp),
        field('اندازه', sizeInp),
        field('کانتکست', ctxInp)
      ]),
      Utils.el('div', { class: 'form-row' }, [
        field('سرعت (t/s)', speedInp),
        field('برچسب‌ها', tagsInp, 'با کاما جدا کن')
      ]),
      field('یادداشت', noteArea),
      Utils.el('div', { class: 'form-row' }, [
        field('بهترین کاربرد', bestForSel),
        Utils.el('div', { class: 'field' }, [
          Utils.el('label', { class: 'field-label' }, ['پیشنهاد ویژه']),
          Utils.el('label', { class: 'orm-check' }, [
            recCheck,
            Utils.el('span', {}, ['ستاره‌دار (★)'])
          ])
        ])
      ])
    ]);

    const body = Utils.el('div', {}, [
      Utils.el('div', { class: 'alert alert-info' }, [
        Utils.el('span', { class: 'alert-icon' }, ['💡']),
        Utils.el('div', {}, [
          'AI بر اساس شناسه، نام و توضیح مدل، اندازه و سرعت را تخمین می‌زند. ',
          'هر فیلدی را می‌توانی دستی اصلاح کنی.'
        ])
      ]),
      enrichBar,
      form
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: function () { Modal.close(); } }, ['انصراف']),
      Utils.el('button', { class: 'btn btn-primary', id: 'orm-save' }, ['افزودن به دیتابیس'])
    ]);

    Modal.open({
      title: 'افزودن مدل جدید',
      icon: '➕',
      size: 'lg',
      body: body,
      footer: footer,
      onClose: restoreParent
    });

    /* ---- AI enrichment ---- */
    let enriching = false;

    async function enrichFromAI() {
      if (enriching) return;
      if (!AI.isConfigured()) {
        Toast.warning('کلید OpenRouter تنظیم نشده — از تنظیمات وارد کن');
        return;
      }
      if (!AI.getModels().length) {
        Toast.warning('هیچ مدلی در دیتابیس نیست — AI قابل صدا زدن نیست');
        return;
      }

      enriching = true;
      enrichBtn.disabled = true;
      enrichBtn.innerHTML = '<span class="spinner"></span> در حال استخراج…';
      enrichStatus.textContent = 'در حال استخراج…';
      enrichStatus.dataset.state = 'loading';

      try {
        const raw = await AI.chatJSON({
          messages: [
            { role: 'system', content: AIPrompts.modelEnrichSystem },
            { role: 'user', content: AIPrompts.modelEnrichUser(prefill) }
          ],
          temperature: 0.2
        });

        const parsed = AI.parseJSONResponse(raw);
        if (!parsed) throw new Error('پاسخ قابل تفسیر نبود');

        let filled = 0;
        if (parsed.size && !sizeInp.value.trim()) { sizeInp.value = String(parsed.size); filled++; }
        if (parsed.speed && !speedInp.value.trim()) { speedInp.value = String(parsed.speed); filled++; }
        if (parsed.note && !noteArea.value.trim()) { noteArea.value = String(parsed.note); filled++; }
        if (Array.isArray(parsed.tags) && parsed.tags.length && !tagsInp.value.trim()) {
          tagsInp.value = parsed.tags.map(function (t) { return String(t).trim(); }).filter(Boolean).join('، ');
          filled++;
        }
        if (parsed.bestFor && !bestForSel.value) { bestForSel.value = String(parsed.bestFor); filled++; }

        /* اگر سازنده خالی بود و AI حدس زد */
        if (!vendorInp.value.trim() && prefill.vendor) {
          vendorInp.value = prefill.vendor;
        }

        if (filled > 0) {
          enrichStatus.textContent = '✓ ' + Utils.toFa(filled) + ' فیلد پر شد';
          enrichStatus.dataset.state = 'done';
        } else {
          enrichStatus.textContent = 'پاسخ AI فیلد جدیدی نداشت';
          enrichStatus.dataset.state = 'warn';
        }
      } catch (e) {
        enrichStatus.textContent = '✗ ' + (e.message || 'خطا در استخراج');
        enrichStatus.dataset.state = 'error';
      } finally {
        enriching = false;
        enrichBtn.disabled = false;
        enrichBtn.textContent = '🪄 پرکردن مجدد';
      }
    }

    /* ---- ذخیره ---- */
    document.getElementById('orm-save').addEventListener('click', function () {
      const label = labelInp.value.trim();
      if (!label) {
        Toast.error('نام نمایشی الزامی است');
        labelInp.focus();
        return;
      }
      const tags = tagsInp.value.split(/[،,]/).map(function (s) { return s.trim(); }).filter(Boolean);

      try {
        DB.upsertAiModel({
          id: prefill.id,
          label: label,
          vendor: vendorInp.value.trim(),
          size: sizeInp.value.trim(),
          context: ctxInp.value.trim(),
          speed: speedInp.value.trim(),
          note: noteArea.value.trim(),
          tags: tags,
          recommended: recCheck.checked,
          bestFor: bestForSel.value,
          isFree: true,
          source: 'fetched',
          fetchedAt: new Date().toISOString()
        });
        Toast.success('«' + label + '» اضافه شد');
        Modal.close();
        if (typeof onSaved === 'function') setTimeout(onSaved, 160);
      } catch (e) {
        Toast.error('ذخیره: ' + e.message);
      }
    });

    setTimeout(function () { labelInp.focus(); }, 80);

    /* ---- خودکار: استخراج با AI هنگام باز شدن فرم ---- */
    if (aiReady) {
      setTimeout(function () { enrichFromAI(); }, 220);
    }
  }

  return {
    buildModelPicker: buildModelPicker,
    openOpenRouterFetch: openOpenRouterFetch
  };
})();