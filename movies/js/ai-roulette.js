/* =========================================================
   رولت مدل‌های AI — تست، بازخورد، قبول / رد
   ---------------------------------------------------------
   جریان:
     1) یک مدل فعال تصادفی از استخر انتخاب می‌شود
     2) یک پرامپت تست کوتاه روی آن اجرا می‌شود
     3) نتیجه به کاربر نشان داده می‌شود
     4) قبول → مدل سراسری سایت + win
        رد   → loss + پیشنهاد مدل تصادفی بعدی
   ========================================================= */
window.AIRoulette = (function () {

  var TEST_PROMPT =
    'به فارسی و خیلی کوتاه (حداکثر ۲ جمله) بگو: «من یک دستیار فیلم و سریال هستم و آماده‌ام.»';

  var state = {
    current: null,       /* مدل در حال آزمون */
    tried: [],           /* idهای امتحان‌شده در این جلسه */
    running: false,
    lastText: '',
    lastError: null
  };

  /* ---- helpers ---- */
  function activePool() {
    try {
      return (DB.getActiveAiModels && DB.getActiveAiModels()) || [];
    } catch (e) {
      return [];
    }
  }

  function pickRandom(excludeIds) {
    excludeIds = excludeIds || [];
    var pool = activePool().filter(function (m) {
      return excludeIds.indexOf(m.id) === -1;
    });
    if (!pool.length) {
      /* همه امتحان شدند — دوباره از کل استخر */
      pool = activePool();
    }
    if (!pool.length) return null;
    /* کمی وزن به مدل‌هایی که win بیشتر / loss کمتر دارند */
    pool = pool.slice().sort(function (a, b) {
      var sa = (a.wins || 0) - (a.losses || 0);
      var sb = (b.wins || 0) - (b.losses || 0);
      return sb - sa;
    });
    /* 60٪ از بالای لیست، 40٪ کاملاً تصادفی */
    var topN = Math.max(1, Math.ceil(pool.length * 0.6));
    var slice = Math.random() < 0.6 ? pool.slice(0, topN) : pool;
    return slice[Math.floor(Math.random() * slice.length)];
  }

  function record(id, accepted) {
    try {
      if (DB.recordAiTrial) DB.recordAiTrial(id, accepted);
    } catch (e) {}
  }

  function setGlobalModel(id) {
    if (typeof AI !== 'undefined' && AI.setModel) AI.setModel(id);
    try {
      document.dispatchEvent(new CustomEvent('cinema:model-changed', { detail: { id: id } }));
    } catch (e) {}
  }

  /* ---- UI ---- */
  function buildCard(model) {
    if (!model) {
      return Utils.el('div', { class: 'roulette-empty' }, [
        'هیچ مدل فعالی در استخر نیست. از تنظیمات یا OpenRouter مدل اضافه کن.'
      ]);
    }
    var win = model.wins || 0;
    var loss = model.losses || 0;
    var rate = (win + loss) ? Math.round((win / (win + loss)) * 100) : null;

    return Utils.el('div', { class: 'roulette-model-card' }, [
      Utils.el('div', { class: 'roulette-model-head' }, [
        Utils.el('div', { class: 'roulette-model-title' }, [
          Utils.el('span', { class: 'roulette-model-label' }, [model.label || model.id]),
          Utils.el('span', { class: 'roulette-model-vendor' }, [model.vendor || ''])
        ]),
        Utils.el('div', { class: 'roulette-model-badges' }, [
          Utils.el('span', {
            class: 'roulette-badge provider-' + (model.provider || 'openrouter')
          }, [model.provider === 'google' ? 'Google' : 'OpenRouter']),
          model.recommended
            ? Utils.el('span', { class: 'roulette-badge recommended' }, ['پیشنهادی'])
            : null
        ].filter(Boolean))
      ]),
      Utils.el('div', { class: 'roulette-model-meta' }, [
        model.context ? Utils.el('span', {}, ['کانتکست: ' + model.context]) : null,
        model.speed ? Utils.el('span', {}, ['سرعت: ' + model.speed]) : null,
        model.size && model.size !== '—' ? Utils.el('span', {}, ['حجم: ' + model.size]) : null
      ].filter(Boolean)),
      Utils.el('div', { class: 'roulette-model-stats' }, [
        Utils.el('span', { class: 'stat win' }, ['✓ ' + win]),
        Utils.el('span', { class: 'stat loss' }, ['✗ ' + loss]),
        rate !== null
          ? Utils.el('span', { class: 'stat rate' }, [rate + '%'])
          : Utils.el('span', { class: 'stat rate muted' }, ['بدون سابقه'])
      ]),
      model.note
        ? Utils.el('p', { class: 'roulette-model-note' }, [model.note])
        : null
    ].filter(Boolean));
  }

  function open() {
    state.tried = [];
    state.current = null;
    state.running = false;
    state.lastText = '';
    state.lastError = null;

    var body = Utils.el('div', { class: 'roulette-body' });

    /* ---- header / current global ---- */
    var globalMeta = (typeof AI !== 'undefined' && AI.getModelMeta) ? AI.getModelMeta() : null;
    var globalBar = Utils.el('div', { class: 'roulette-global' }, [
      Utils.el('span', { class: 'roulette-global-label' }, ['مدل فعلی سایت:']),
      Utils.el('strong', { class: 'roulette-global-value', id: 'roulette-global-value' }, [
        globalMeta ? (globalMeta.label || globalMeta.id) : '—'
      ]),
      Utils.el('button', {
        class: 'btn btn-ghost btn-sm',
        type: 'button',
        id: 'roulette-btn-change-global',
        title: 'انتخاب دستی مدل سراسری'
      }, ['تغییر'])
    ]);

    /* ---- spin area ---- */
    var modelSlot = Utils.el('div', { class: 'roulette-slot', id: 'roulette-slot' }, [
      Utils.el('div', { class: 'roulette-placeholder' }, [
        'برای شروع، «پیشنهاد مدل» را بزن'
      ])
    ]);

    var resultBox = Utils.el('div', {
      class: 'roulette-result',
      id: 'roulette-result',
      hidden: true
    }, [
      Utils.el('div', { class: 'roulette-result-label' }, ['پاسخ مدل']),
      Utils.el('pre', { class: 'roulette-result-text', id: 'roulette-result-text' })
    ]);

    var statusLine = Utils.el('div', {
      class: 'roulette-status',
      id: 'roulette-status'
    }, ['آماده']);

    /* ---- actions ---- */
    var btnSpin = Utils.el('button', {
      class: 'btn btn-primary',
      type: 'button',
      id: 'roulette-btn-spin'
    }, ['🎲 پیشنهاد مدل']);

    var btnTest = Utils.el('button', {
      class: 'btn btn-secondary',
      type: 'button',
      id: 'roulette-btn-test',
      disabled: true
    }, ['▶ تست مدل']);

    var btnAccept = Utils.el('button', {
      class: 'btn btn-success',
      type: 'button',
      id: 'roulette-btn-accept',
      disabled: true
    }, ['✓ قبول و استفاده']);

    var btnReject = Utils.el('button', {
      class: 'btn btn-danger',
      type: 'button',
      id: 'roulette-btn-reject',
      disabled: true
    }, ['✗ رد و بعدی']);

    var actions = Utils.el('div', { class: 'roulette-actions' }, [
      btnSpin, btnTest, btnAccept, btnReject
    ]);

    /* ---- pool summary ---- */
    var pool = activePool();
    var poolInfo = Utils.el('div', { class: 'roulette-pool' }, [
      Utils.el('span', {}, ['استخر فعال: ' + pool.length + ' مدل']),
      Utils.el('span', { class: 'muted' }, [
        'Google: ' + pool.filter(function (m) { return m.provider === 'google'; }).length +
        ' · OpenRouter: ' + pool.filter(function (m) { return m.provider !== 'google'; }).length
      ])
    ]);

    body.appendChild(globalBar);
    body.appendChild(poolInfo);
    body.appendChild(modelSlot);
    body.appendChild(statusLine);
    body.appendChild(resultBox);
    body.appendChild(actions);

    /* ---- modal ---- */
    var modal = Modal.open({
      title: 'رولت مدل‌های AI',
      size: 'lg',
      body: body,
      onClose: function () {
        if (state.running && typeof AI !== 'undefined' && AI.abort) {
          try { AI.abort(); } catch (e) {}
        }
        state.running = false;
      }
    });

    /* ---- wire buttons ---- */
    document.getElementById('roulette-btn-change-global').addEventListener('click', function () {
      if (typeof AIModelsUI === 'undefined') return;
      var current = (typeof AI !== 'undefined' && AI.getModel) ? AI.getModel() : '';
      AIModelsUI.openPicker(current, function (id) {
        setGlobalModel(id);
        var meta = AI.getModelMeta ? AI.getModelMeta() : { label: id };
        var el = document.getElementById('roulette-global-value');
        if (el) el.textContent = meta.label || id;
        Toast.success('مدل سراسری تغییر کرد');
      });
    });

    function setStatus(text, kind) {
      var el = document.getElementById('roulette-status');
      if (!el) return;
      el.textContent = text;
      el.dataset.kind = kind || 'info';
    }

    function refreshSlot() {
      var slot = document.getElementById('roulette-slot');
      if (!slot) return;
      slot.innerHTML = '';
      slot.appendChild(buildCard(state.current));
    }

    function enableFeedback(enable) {
      btnAccept.disabled = !enable;
      btnReject.disabled = !enable;
    }

    function enableTest(enable) {
      btnTest.disabled = !enable || state.running;
    }

    btnSpin.addEventListener('click', function () {
      if (state.running) return;
      var next = pickRandom(state.tried);
      if (!next) {
        setStatus('مدلی برای پیشنهاد نیست', 'error');
        Toast.error('استخر مدل خالی است');
        return;
      }
      state.current = next;
      if (state.tried.indexOf(next.id) === -1) state.tried.push(next.id);
      state.lastText = '';
      state.lastError = null;
      refreshSlot();
      enableTest(true);
      enableFeedback(false);
      var res = document.getElementById('roulette-result');
      if (res) res.hidden = true;
      setStatus('مدل پیشنهاد شد — تست کن یا رد کن', 'info');
    });

    btnTest.addEventListener('click', async function () {
      if (!state.current || state.running) return;
      state.running = true;
      enableTest(false);
      enableFeedback(false);
      btnSpin.disabled = true;
      setStatus('در حال اجرای تست…', 'loading');

      var resBox = document.getElementById('roulette-result');
      var resText = document.getElementById('roulette-result-text');
      if (resBox) resBox.hidden = false;
      if (resText) resText.textContent = '…';

      try {
        var text = '';
        if (typeof AI !== 'undefined' && AI.chat) {
          text = await AI.chat({
            model: state.current.id,
            messages: [{ role: 'user', content: TEST_PROMPT }],
            temperature: 0.3,
            max_tokens: 120
          });
        } else if (typeof AI !== 'undefined' && AI.chatStream) {
          text = await AI.chatStream({
            model: state.current.id,
            messages: [{ role: 'user', content: TEST_PROMPT }],
            temperature: 0.3,
            max_tokens: 120,
            onToken: function (t) {
              text += t;
              if (resText) resText.textContent = text;
            }
          });
        } else {
          throw new Error('کلاینت AI در دسترس نیست');
        }
        state.lastText = String(text || '').trim();
        state.lastError = null;
        if (resText) resText.textContent = state.lastText || '(پاسخ خالی)';
        setStatus('تست موفق — قبول یا رد کن', 'ok');
        enableFeedback(true);
      } catch (err) {
        state.lastError = err;
        state.lastText = '';
        var msg = (err && err.message) ? err.message : String(err);
        if (resText) resText.textContent = 'خطا: ' + msg;
        setStatus('تست ناموفق — رد کن یا مدل دیگری پیشنهاد بده', 'error');
        /* روی خطا هم امکان رد می‌دهیم؛ قبول را غیرفعال می‌گذاریم */
        btnReject.disabled = false;
        btnAccept.disabled = true;
      } finally {
        state.running = false;
        btnSpin.disabled = false;
        enableTest(!!state.current);
      }
    });

    btnAccept.addEventListener('click', function () {
      if (!state.current) return;
      record(state.current.id, true);
      setGlobalModel(state.current.id);
      var el = document.getElementById('roulette-global-value');
      if (el) el.textContent = state.current.label || state.current.id;
      setStatus('مدل قبول شد و به‌عنوان مدل سراسری تنظیم شد', 'ok');
      enableFeedback(false);
      Toast.success('مدل «' + (state.current.label || state.current.id) + '» فعال شد');
      refreshSlot();
    });

    btnReject.addEventListener('click', function () {
      if (!state.current) return;
      record(state.current.id, false);
      setStatus('رد شد — پیشنهاد بعدی…', 'info');
      enableFeedback(false);
      /* بلافاصله مدل بعدی */
      var next = pickRandom(state.tried.concat([state.current.id]));
      if (!next) {
        setStatus('مدل دیگری برای پیشنهاد نیست', 'error');
        state.current = null;
        refreshSlot();
        enableTest(false);
        return;
      }
      state.current = next;
      if (state.tried.indexOf(next.id) === -1) state.tried.push(next.id);
      state.lastText = '';
      state.lastError = null;
      refreshSlot();
      enableTest(true);
      var res = document.getElementById('roulette-result');
      if (res) res.hidden = true;
      setStatus('مدل بعدی پیشنهاد شد — تست کن', 'info');
    });
  }

  /* باز کردن مستقیم از صفحه AI بدون مودال — برای embed در صفحه اصلی */
  function mount(container) {
    if (!container) return;
    container.innerHTML = '';
    var wrap = Utils.el('div', { class: 'roulette-inline' });
    var openBtn = Utils.el('button', {
      class: 'btn btn-primary',
      type: 'button',
      onclick: function () { open(); }
    }, ['🎲 باز کردن رولت مدل‌ها']);
    var hint = Utils.el('p', { class: 'roulette-inline-hint' }, [
      'اگر مدلی خطا داد، رولت یک مدل تصادفی دیگر پیشنهاد می‌دهد. نتیجه را می‌بینی و قبول یا رد می‌کنی.'
    ]);
    wrap.appendChild(openBtn);
    wrap.appendChild(hint);
    container.appendChild(wrap);
  }

  return {
    open: open,
    mount: mount,
    pickRandom: pickRandom
  };
})();
