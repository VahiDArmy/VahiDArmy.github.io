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

    const filterActiveBtn = Utils.el('button', {
      class: 'model-fetch-btn',
      type: 'button',
      title: 'فقط مدل‌های فعال در استخر',
      dataset: { on: '0' }
    }, ['فقط فعال‌ها']);

    let onlyActive = false;
    filterActiveBtn.addEventListener('click', function () {
      onlyActive = !onlyActive;
      filterActiveBtn.dataset.on = onlyActive ? '1' : '0';
      filterActiveBtn.classList.toggle('is-on', onlyActive);
      renderList(searchInput.value);
    });

    const listWrap = Utils.el('div', { class: 'model-list' });
    const statsBar = Utils.el('div', { class: 'model-stats' });

    function scoreOf(m) {
      var w = Number(m.wins) || 0;
      var l = Number(m.losses) || 0;
      return w - l;
    }

    function renderList(query) {
      listWrap.innerHTML = '';
      const q = Utils.normalizeFa(query || '').toLowerCase();
      var filtered = models.filter(function (m) {
        if (onlyActive && m.active === false) return false;
        if (!q) return true;
        const hay = Utils.normalizeFa(
          m.label + ' ' + m.vendor + ' ' + m.id + ' ' +
          (m.tags || []).join(' ') + ' ' + (m.note || '') + ' ' + (m.provider || '')
        ).toLowerCase();
        return hay.indexOf(q) > -1;
      });

      /* مرتب‌سازی: انتخاب‌شده، بعد امتیاز (wins-losses)، بعد recommended */
      filtered = filtered.slice().sort(function (a, b) {
        if (a.id === selected) return -1;
        if (b.id === selected) return 1;
        var ds = scoreOf(b) - scoreOf(a);
        if (ds) return ds;
        if (!!b.recommended - !!a.recommended) return (!!b.recommended) - (!!a.recommended);
        return String(a.label || a.id).localeCompare(String(b.label || b.id), 'fa');
      });

      if (!filtered.length) {
        listWrap.appendChild(Utils.el('div', { class: 'model-empty' }, [
          models.length ? 'مدلی با این جستجو پیدا نشد' : 'هیچ مدلی ثبت نشده — با دکمه 🔍 اضافه کن'
        ]));
        return;
      }

      filtered.forEach(function (m) {
        const isSelected = m.id === selected;
        const isDefault = m.id === defaultId;
        const isPoolActive = m.active !== false;
        const wins = Number(m.wins) || 0;
        const losses = Number(m.losses) || 0;
        const provider = m.provider || (String(m.id).indexOf('gemini') === 0 ? 'google' : 'openrouter');

        const card = Utils.el('div', {
          class: 'model-card'
            + (isSelected ? ' is-active' : '')
            + (isPoolActive ? '' : ' is-inactive'),
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
              Utils.el('span', {
                class: 'model-badge model-badge-provider provider-' + provider
              }, [provider === 'google' ? 'Google' : 'OpenRouter']),
              isDefault ? Utils.el('span', { class: 'model-badge model-badge-default' }, ['پیش‌فرض']) : null,
              m.recommended ? Utils.el('span', { class: 'model-badge model-badge-rec' }, ['★']) : null,
              isSelected ? Utils.el('span', { class: 'model-badge model-badge-active' }, ['انتخاب']) : null,
              !isPoolActive ? Utils.el('span', { class: 'model-badge model-badge-off' }, ['غیرفعال']) : null
            ].filter(Boolean))
          ]),
          Utils.el('div', { class: 'model-card-meta' }, [
            m.size && m.size !== '—' ? Utils.el('span', { class: 'model-meta-item' }, [m.size]) : null,
            m.context ? Utils.el('span', { class: 'model-meta-item' }, [m.context + ' ctx']) : null,
            m.speed && m.speed !== '—' ? Utils.el('span', { class: 'model-meta-item' }, [m.speed + ' t/s']) : null
          ].filter(Boolean)),
          Utils.el('div', { class: 'model-card-feedback' }, [
            Utils.el('span', { class: 'mf-win', title: 'قبول‌شده' }, ['✓ ' + wins]),
            Utils.el('span', { class: 'mf-loss', title: 'رد‌شده' }, ['✗ ' + losses]),
            Utils.el('button', {
              class: 'mf-toggle' + (isPoolActive ? ' is-on' : ''),
              type: 'button',
              title: isPoolActive ? 'غیرفعال کردن (خارج از استخر)' : 'فعال کردن',
              onclick: function (e) {
                e.stopPropagation();
                try {
                  DB.setAiModelActive(m.id, !isPoolActive);
                  Toast.info((m.label || m.id) + (isPoolActive ? ' غیرفعال شد' : ' فعال شد'));
                  refresh();
                } catch (err) {
                  Toast.error(err.message || 'خطا');
                }
              }
            }, [isPoolActive ? 'فعال' : 'غیرفعال'])
          ]),
          m.note ? Utils.el('div', { class: 'model-card-note' }, [m.note]) : null,
          Utils.el('div', { class: 'model-card-id' }, [m.id])
        ]);

        function select() {
          selected = m.id;
          if (typeof AI !== 'undefined' && AI.setModel) AI.setModel(m.id);
          if (onSelect) onSelect(m.id);
          renderList(searchInput.value);
          updateStats();
          try {
            if (window.Toast) Toast.info('مدل: ' + (m.label || m.id));
          } catch (e) {}
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
      const activeCount = models.filter(function (m) { return m.active !== false; }).length;
      statsBar.innerHTML = '';
      statsBar.appendChild(Utils.el('span', { class: 'model-stats-count' }, [
        Utils.toFa(models.length) + ' مدل · ' + Utils.toFa(activeCount) + ' فعال'
      ]));
      if (meta) {
        var w = Number(meta.wins) || 0;
        var l = Number(meta.losses) || 0;
        statsBar.appendChild(Utils.el('span', { class: 'model-stats-sep' }, ['·']));
        statsBar.appendChild(Utils.el('span', { class: 'model-stats-current' }, [
          'انتخاب: ' + (meta.label || meta.id)
        ]));
        statsBar.appendChild(Utils.el('span', { class: 'model-stats-sep' }, ['·']));
        statsBar.appendChild(Utils.el('span', { class: 'model-stats-score' }, [
          '✓' + w + ' / ✗' + l
        ]));
      }
    }

    function confirmDeleteModel(m) {
      Modal.confirm({
        title: 'حذف مدل',
        message: '«' + (m.label || m.id) + '» از لیست مدل‌ها حذف شود؟ در جستجوی OpenRouter هم دیگر پیشنهاد نمی‌شود.',
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
        Utils.el('div', { class: 'model-picker-toolbar' }, [searchInput, filterActiveBtn, fetchBtn]),
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

    /* ---- وضعیت محلی ---- */
    let allModels = [];             /* همه‌ی مدل‌های رایگان از OpenRouter */
    let inDb = {};                  /* id → true برای مدل‌های موجود در دیتابیس */
    let deleted = {};               /* id → true برای سنگ‌قبرها */
    let showDeleted = false;        /* نمایش حذف‌شده‌ها */

    /* ---- عناصر ---- */
    const listWrap = Utils.el('div', { class: 'orm-list' });
    const statusBar = Utils.el('div', { class: 'orm-status' }, ['در حال بارگذاری…']);

    const toggleLabel = Utils.el('label', { class: 'orm-toggle' });
    const toggleCheck = Utils.el('input', { type: 'checkbox' });
    toggleLabel.appendChild(toggleCheck);
    toggleLabel.appendChild(Utils.el('span', { class: 'orm-toggle-box' }));
    const toggleText = Utils.el('span', { class: 'orm-toggle-text' }, ['نمایش حذف‌شده‌ها']);
    toggleLabel.appendChild(toggleText);
    toggleCheck.addEventListener('change', function () {
      showDeleted = toggleCheck.checked;
      renderList();
    });

    const clearBtn = Utils.el('button', {
      class: 'orm-clear-btn',
      type: 'button',
      title: 'پاک کردن لیست حذف‌شده‌ها',
      onclick: function () {
        const n = DB.countDeletedAiModels();
        if (!n) return;
        Modal.confirm({
          title: 'پاک کردن لیست حذف‌شده‌ها',
          message: Utils.toFa(n) + ' مدلِ حذف‌شده از لیست سیاه پاک شود؟ دوباره در جستجو ظاهر می‌شوند.',
          icon: '↺',
          confirmText: 'پاک کن',
          onConfirm: function () {
            DB.clearDeletedAiModelIds();
            deleted = {};
            refreshState();
            renderList();
            updateToggleLabel();
            Toast.success('لیست حذف‌شده‌ها پاک شد');
          }
        });
      }
    }, ['↺ پاک کردن حذف‌شده‌ها']);

    const refreshBtn = Utils.el('button', {
      class: 'orm-refresh-btn',
      type: 'button',
      onclick: function () { load(); }
    }, ['🔄 بروزرسانی']);

    const body = Utils.el('div', { class: 'orm-body' }, [
      Utils.el('div', { class: 'orm-toolbar' }, [
        statusBar,
        Utils.el('div', { class: 'flex-1' }),
        clearBtn,
        toggleLabel,
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

    /* ---- وضعیت را از دیتابیس تازه کن ---- */
    function refreshState() {
      inDb = {};
      DB.getAiModels().forEach(function (m) { inDb[m.id] = true; });
      deleted = {};
      DB.getDeletedAiModelIds().forEach(function (id) { deleted[id] = true; });
    }

    function updateToggleLabel() {
      const n = Object.keys(deleted).length;
      toggleText.textContent = n
        ? 'نمایش حذف‌شده‌ها (' + Utils.toFa(n) + ')'
        : 'نمایش حذف‌شده‌ها';
      clearBtn.hidden = n === 0;
    }

    async function load() {
      listWrap.innerHTML = '';
      listWrap.appendChild(Utils.el('div', { class: 'orm-loading' }, [
        Utils.el('span', { class: 'spinner' }),
        Utils.el('span', {}, ['در حال دریافت از OpenRouter…'])
      ]));
      statusBar.textContent = 'در حال بارگذاری…';
      refreshBtn.disabled = true;

      try {
        allModels = await fetchOpenRouterFreeModels();
        refreshState();
        updateToggleLabel();

        const visibleCount = allModels.filter(function (m) { return !deleted[m.id]; }).length;
        statusBar.textContent = Utils.toFa(visibleCount) + ' مدل قابل افزودن';
        renderList();
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

    function renderList() {
      listWrap.innerHTML = '';

      if (!allModels.length) {
        listWrap.appendChild(Utils.el('div', { class: 'orm-empty' }, ['مدل رایگانی پیدا نشد.']));
        return;
      }

      /* دسته‌بندی: در دیتابیس / قابل افزودن / حذف‌شده */
      const added = [];
      const available = [];
      const hidden = [];

      allModels.forEach(function (m) {
        if (inDb[m.id]) added.push(m);
        else if (deleted[m.id]) hidden.push(m);
        else available.push(m);
      });

      const sortByName = function (a, b) { return String(a.name).localeCompare(String(b.name)); };
      added.sort(sortByName);
      available.sort(sortByName);
      hidden.sort(sortByName);

      /* در حالت پیش‌فرض، حذف‌شده‌ها نمایش داده نمی‌شوند */
      const hiddenToShow = showDeleted ? hidden : [];

      if (!added.length && !available.length && !hiddenToShow.length) {
        listWrap.appendChild(Utils.el('div', { class: 'orm-empty' }, [
          'همه‌ی مدل‌های رایگان یا اضافه شده‌اند یا حذف.'
        ]));
        return;
      }

      available.forEach(function (m) {
        listWrap.appendChild(buildOrItem(m, 'available'));
      });
      added.forEach(function (m) {
        listWrap.appendChild(buildOrItem(m, 'added'));
      });
      hiddenToShow.forEach(function (m) {
        listWrap.appendChild(buildOrItem(m, 'hidden'));
      });
    }

    function buildOrItem(m, state) {
      const ctx = formatContextLength(m.context_length);
      const item = Utils.el('div', {
        class: 'orm-item' +
          (state === 'added' ? ' is-added' : '') +
          (state === 'hidden' ? ' is-deleted' : '')
      });

      item.appendChild(Utils.el('div', { class: 'orm-item-info' }, [
        Utils.el('div', { class: 'orm-item-name' }, [m.name]),
        Utils.el('div', { class: 'orm-item-id' }, [m.id]),
        Utils.el('div', { class: 'orm-item-meta' }, [
          ctx ? Utils.el('span', {}, [ctx + ' ctx']) : null,
          m.vendor ? Utils.el('span', {}, [m.vendor]) : null
        ].filter(Boolean))
      ]));

      if (state === 'added') {
        item.appendChild(Utils.el('span', { class: 'orm-badge-added' }, ['✓ افزوده شده']));
      } else if (state === 'hidden') {
        item.appendChild(Utils.el('span', { class: 'orm-badge-deleted' }, ['🗑 حذف‌شده']));
        item.appendChild(Utils.el('button', {
          class: 'orm-restore-btn',
          type: 'button',
          title: 'خارج کردن از لیست حذف‌شده‌ها',
          onclick: function () {
            try {
              DB.unmarkAiModelDeleted(m.id);
              delete deleted[m.id];
              updateToggleLabel();
              renderList();
              statusBar.textContent = Utils.toFa(
                allModels.filter(function (x) { return !deleted[x.id]; }).length
              ) + ' مدل قابل افزودن';
              Toast.success('«' + m.name + '» از لیست حذف خارج شد');
            } catch (e) {
              Toast.error('بازگردانی: ' + e.message);
            }
          }
        }, ['↺ بازگردانی']));
      } else {
        item.appendChild(Utils.el('button', {
          class: 'orm-add-btn',
          type: 'button',
          onclick: function () {
            openAddModelForm(m, function () {
              onChanged();
              inDb[m.id] = true;   /* حالا در دیتابیس است */
              renderList();
              statusBar.textContent = Utils.toFa(
                allModels.filter(function (x) { return !deleted[x.id]; }).length
              ) + ' مدل قابل افزودن';
            });
          }
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

    const enrichStatus = Utils.el('div', { class: 'orm-enrich-status' });
    const enrichBtn = Utils.el('button', {
      class: 'orm-enrich-btn',
      type: 'button',
      onclick: function () { enrichFromAI(); }
    }, ['🪄 پرکردن با AI']);

    const enrichBar = Utils.el('div', { class: 'orm-enrich-bar' }, [enrichBtn, enrichStatus]);

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

    if (aiReady) {
      setTimeout(function () { enrichFromAI(); }, 220);
    }
  }

  /* انتخاب‌گر سراسری + بازخورد (تست / قبول / رد / پیشنهاد بعدی) */
  var TEST_PROMPT =
    'به فارسی و خیلی کوتاه (حداکثر ۲ جمله) بگو: «من یک دستیار فیلم و سریال هستم و آماده‌ام.»';

  function pickNextActive(excludeIds) {
    excludeIds = excludeIds || [];
    var pool = [];
    try {
      pool = (DB.getActiveAiModels && DB.getActiveAiModels()) || AI.getModels().filter(function (m) {
        return m.active !== false;
      });
    } catch (e) {
      pool = AI.getModels().filter(function (m) { return m.active !== false; });
    }
    pool = pool.filter(function (m) { return excludeIds.indexOf(m.id) === -1; });
    if (!pool.length) {
      try { pool = (DB.getActiveAiModels && DB.getActiveAiModels()) || []; } catch (e2) { pool = []; }
    }
    if (!pool.length) return null;
    pool = pool.slice().sort(function (a, b) {
      return ((b.wins || 0) - (b.losses || 0)) - ((a.wins || 0) - (a.losses || 0));
    });
    var topN = Math.max(1, Math.ceil(pool.length * 0.6));
    var slice = Math.random() < 0.65 ? pool.slice(0, topN) : pool;
    return slice[Math.floor(Math.random() * slice.length)];
  }

  function openPicker(currentModelId, onSelect) {
    var tried = [];
    var running = false;
    var lastOk = false;
    var lossRecordedFor = null; /* id که در تست ناموفق loss خورده */

    var picker = buildModelPicker(currentModelId, function () {
      lastOk = false;
      lossRecordedFor = null;
      setStatus('مدل انتخاب شد — می‌توانی تست کنی یا مستقیم تأیید کنی', 'info');
      enableFeedback(false);
    });

    var statusEl = Utils.el('div', { class: 'model-feedback-status', id: 'mf-status' }, [
      'یک مدل انتخاب کن، در صورت تمایل تست کن، بعد قبول یا رد'
    ]);
    var resultEl = Utils.el('pre', {
      class: 'model-feedback-result',
      id: 'mf-result',
      hidden: true
    });

    var body = Utils.el('div', { class: 'model-picker-with-feedback' }, [
      picker.el,
      statusEl,
      resultEl
    ]);

    var btnTest = Utils.el('button', {
      class: 'btn btn-secondary',
      type: 'button',
      id: 'btn-mf-test'
    }, ['▶ تست مدل']);

    var btnAccept = Utils.el('button', {
      class: 'btn btn-primary',
      type: 'button',
      id: 'btn-mf-accept'
    }, ['✓ قبول و استفاده']);

    var btnReject = Utils.el('button', {
      class: 'btn btn-ghost',
      type: 'button',
      id: 'btn-mf-reject',
      disabled: true
    }, ['✗ رد → بعدی']);

    var btnSuggest = Utils.el('button', {
      class: 'btn btn-ghost',
      type: 'button',
      id: 'btn-mf-suggest'
    }, ['پیشنهاد تصادفی']);

    var footer = Utils.el('div', { class: 'modal-footer-actions model-feedback-actions' }, [
      btnSuggest,
      btnTest,
      btnReject,
      btnAccept
    ]);

    Modal.open({
      title: 'مدل AI سراسری',
      size: 'lg',
      body: body,
      footer: footer,
      onClose: function () {
        if (running && typeof AI !== 'undefined' && AI.abort) {
          try { AI.abort(); } catch (e) {}
        }
      }
    });

    function setStatus(msg, kind) {
      statusEl.textContent = msg;
      statusEl.dataset.kind = kind || 'info';
    }

    function enableFeedback(on) {
      btnReject.disabled = !on && !lastOk;
      /* قبول همیشه ممکن است (انتخاب بدون تست) */
    }

    function applyGlobal(id, recordWin) {
      if (!id) return;
      if (typeof AI !== 'undefined' && AI.setModel) AI.setModel(id);
      if (recordWin && DB.recordAiTrial) {
        try { DB.recordAiTrial(id, true); } catch (e) {}
      }
      picker.refresh();
      if (typeof onSelect === 'function') onSelect(id);
    }

    function selectInPicker(id) {
      /* بازسازی لیست با selected جدید */
      var fake = buildModelPicker;
      /* ساده‌ترین راه: setModel موقت UI از طریق refresh با current */
      /* picker داخلی selected را نگه می‌دارد — با کلیک شبیه‌سازی نمی‌کنیم؛
         به‌جای آن selected را از بیرون ست می‌کنیم با باز کردن دوباره نه.
         از getSelected استفاده می‌کنیم بعد از اینکه کاربر کارت را زد. */
    }

    btnSuggest.addEventListener('click', function () {
      if (running) return;
      var cur = picker.getSelected();
      if (cur && tried.indexOf(cur) === -1) tried.push(cur);
      var next = pickNextActive(tried);
      if (!next) {
        setStatus('مدل فعالی برای پیشنهاد نیست', 'error');
        Toast.error('استخر مدل‌های فعال خالی است');
        return;
      }
      tried.push(next.id);
      /* انتخاب با بازسازی picker سخت است؛ مستقیم set و refresh */
      /* rebuild selected: close-open سنگین است — از DOM کارت کلیک می‌کنیم */
      var card = body.querySelector('.model-card[data-model="' + CSS.escape(next.id) + '"]');
      if (card) card.click();
      else {
        /* اگر فیلتر شده، فیلتر را بردار */
        setStatus('پیشنهاد: ' + (next.label || next.id) + ' — در لیست پیدا نشد (فیلتر؟)', 'info');
        Toast.info('مدل پیشنهادی: ' + (next.label || next.id));
      }
      lastOk = false;
      resultEl.hidden = true;
      setStatus('پیشنهاد شد: ' + (next.label || next.id) + ' — تست یا قبول کن', 'info');
    });

    btnTest.addEventListener('click', async function () {
      var id = picker.getSelected();
      if (!id) {
        Toast.error('اول یک مدل انتخاب کن');
        return;
      }
      if (running) return;
      running = true;
      lastOk = false;
      btnTest.disabled = true;
      btnAccept.disabled = true;
      btnReject.disabled = true;
      setStatus('در حال تست «' + id + '»…', 'loading');
      resultEl.hidden = false;
      resultEl.textContent = '…';

      try {
        var text = '';
        if (typeof AI !== 'undefined' && AI.chat) {
          text = await AI.chat({
            model: id,
            messages: [{ role: 'user', content: TEST_PROMPT }],
            temperature: 0.3
          });
        } else {
          throw new Error('کلاینت AI در دسترس نیست');
        }
        text = String(text || '').trim();
        resultEl.textContent = text || '(پاسخ خالی)';
        lastOk = true;
        setStatus('تست موفق — قبول کن یا رد کن و مدل بعدی را بگیر', 'ok');
        btnReject.disabled = false;
      } catch (err) {
        var msg = (err && err.message) ? err.message : String(err);
        resultEl.textContent = 'خطا: ' + msg;
        lastOk = false;
        setStatus('تست ناموفق — رد کن تا مدل بعدی پیشنهاد شود', 'error');
        btnReject.disabled = false;
        /* ثبت loss برای مدل شکست‌خورده */
        if (DB.recordAiTrial) {
          try { DB.recordAiTrial(id, false); lossRecordedFor = id; } catch (e) {}
        }
        picker.refresh();
      } finally {
        running = false;
        btnTest.disabled = false;
        btnAccept.disabled = false;
      }
    });

    btnAccept.addEventListener('click', function () {
      var id = picker.getSelected();
      if (!id) {
        Toast.error('مدلی انتخاب نشده');
        return;
      }
      applyGlobal(id, true);
      Modal.close();
      Toast.success('مدل سراسری تنظیم شد');
    });

    btnReject.addEventListener('click', function () {
      var id = picker.getSelected();
      if (id) {
        if (DB.recordAiTrial && lossRecordedFor !== id) {
          try { DB.recordAiTrial(id, false); } catch (e) {}
        }
        lossRecordedFor = null;
        if (tried.indexOf(id) === -1) tried.push(id);
        picker.refresh();
      }
      var next = pickNextActive(tried);
      if (!next) {
        setStatus('مدل فعال دیگری نیست', 'error');
        Toast.error('استخر خالی است');
        return;
      }
      tried.push(next.id);
      lastOk = false;
      resultEl.hidden = true;
      var card = body.querySelector('.model-card[data-model="' + (window.CSS && CSS.escape ? CSS.escape(next.id) : next.id.replace(/"/g, '\\"')) + '"]');
      if (card) card.click();
      setStatus('رد شد → پیشنهاد بعدی: ' + (next.label || next.id), 'info');
      Toast.info('مدل بعدی: ' + (next.label || next.id));
    });
  }

  return {
    buildModelPicker: buildModelPicker,
    openOpenRouterFetch: openOpenRouterFetch,
    openPicker: openPicker
  };
})();