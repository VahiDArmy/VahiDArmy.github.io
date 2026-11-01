/* =========================================================
   AIReview — جریان «اجرا ← نمایش ← پذیرش یا رد»
   ---------------------------------------------------------
   • اولین تلاش با مدل سایت انجام می‌شود.
   • اگر مدل خطا بدهد (شبکه، سرور، پاسخ خالی، پاسخ نامعتبر)
       → fails مدل +۱ و مدل تصادفی بعدی خودکار امتحان می‌شود.
   • اگر پاسخ موفق بود، نتیجه به کاربر نشان داده می‌شود:
       ✅ پذیرش  → wins +۱ و اعمال نتیجه
       ❌ رد     → losses +۱ و مدل تصادفی بعدی پیشنهاد/اجرا می‌شود
   • مدل‌هایی که در این جلسه امتحان شده‌اند دوباره انتخاب نمی‌شوند.

   مصرف:
     AIReview.open({
       title, icon,
       run: async (ctx) => value,        // ctx.model · ctx.signal · ctx.onToken · ctx.progress
       render: (container, value, api) => {},   // اختیاری؛ api.accept(v) · api.reject()
       onAccept: async (value, model) => {},
       live: 'markdown' | 'raw' | 'none',
       hideAccept: false, acceptLabel, closeOnAccept: true
     });
   ========================================================= */
window.AIReview = (function () {

  const PROVIDER_LABEL = { google: 'Google', openrouter: 'OpenRouter' };

  /* چیپ مدل: نام + منبع + کانتکست + آمار بازخورد */
  function modelChip(m, opts) {
    opts = opts || {};
    const kids = [
      Utils.el('span', { class: 'mchip-prov', dataset: { provider: m.provider } }, [PROVIDER_LABEL[m.provider] || m.provider]),
      Utils.el('span', { class: 'mchip-name' }, [m.label || m.id])
    ];
    if (m.context) kids.push(Utils.el('span', { class: 'mchip-ctx' }, [m.context]));
    if (opts.stats !== false && (m.wins || m.losses || m.fails)) {
      kids.push(Utils.el('span', { class: 'mchip-stats' }, [
        Utils.el('b', { class: 'is-win', title: 'پذیرفته‌شده' }, ['✓' + Utils.toFa(m.wins)]),
        Utils.el('b', { class: 'is-loss', title: 'ردشده' }, ['✗' + Utils.toFa(m.losses)]),
        Utils.el('b', { class: 'is-fail', title: 'خطا' }, ['⚠' + Utils.toFa(m.fails)])
      ]));
    }
    return Utils.el('span', { class: 'mchip' }, kids);
  }

  function create(opts) {
    const liveMode = opts.live || 'markdown';
    let abortCtl = null;
    let current = null;          /* مدل در حال اجرا/بازبینی */
    let currentValue = null;
    let tried = new Set();
    let autoFails = 0;
    let finished = false;
    let destroyed = false;

    /* ---------------- عناصر ---------------- */
    const modelSlot = Utils.el('div', { class: 'ar-model' });
    const statusEl = Utils.el('div', { class: 'ar-status', dataset: { state: 'idle' } }, ['آماده']);
    const trail = Utils.el('ol', { class: 'ar-trail', hidden: true });

    const progressFill = Utils.el('i', { style: { width: '0%' } });
    const progressText = Utils.el('span', {}, ['']);
    const progress = Utils.el('div', { class: 'ar-progress', hidden: true }, [
      Utils.el('div', { class: 'ar-progress-bar' }, [progressFill]), progressText
    ]);

    const liveBody = Utils.el('div', { class: liveMode === 'raw' ? 'ar-live-body is-raw' : 'ar-live-body ai-stream-body' });
    const live = Utils.el('div', { class: 'ar-live', hidden: liveMode === 'none' }, [liveBody]);
    const note = Utils.el('div', { class: 'ar-note', hidden: true });
    const result = Utils.el('div', { class: 'ar-result', hidden: true });
    const actions = Utils.el('div', { class: 'ar-actions' });

    const el = Utils.el('div', { class: 'ai-review' }, [
      Utils.el('div', { class: 'ar-head' }, [modelSlot, statusEl]),
      trail, progress, live, note, result, actions
    ]);

    /* ---------------- کمک‌ها ---------------- */
    function setStatus(text, state) { statusEl.textContent = text; statusEl.dataset.state = state; }

    function showModel(m) {
      modelSlot.innerHTML = '';
      const isSite = m.id === AI.getModelId();
      modelSlot.appendChild(modelChip(m));
      if (!isSite) modelSlot.appendChild(Utils.el('span', { class: 'ar-tag' }, ['مدل پیشنهادی']));
    }

    function addTrail(m, text, kind) {
      trail.hidden = false;
      trail.appendChild(Utils.el('li', { dataset: { kind: kind } }, [
        Utils.el('b', {}, [m.label || m.id]), Utils.el('span', {}, [' — ' + text])
      ]));
    }

    function setNote(text, kind) {
      note.hidden = !text;
      note.textContent = text || '';
      note.dataset.kind = kind || '';
    }

    function btn(label, cls, handler, disabled) {
      const b = Utils.el('button', { class: 'btn ' + cls, type: 'button' }, [label]);
      if (disabled) b.disabled = true;
      b.addEventListener('click', handler);
      return b;
    }

    function setActions(list) {
      actions.innerHTML = '';
      list.forEach(function (b) { if (b) actions.appendChild(b); });
    }

    /* پنل زندهٔ استریم (throttle با rAF) */
    let pending = '', raf = false;
    function paintLive() {
      raf = false;
      if (liveMode === 'markdown') liveBody.innerHTML = AIRender.renderMarkdown(pending);
      else liveBody.textContent = pending;
      live.scrollTop = live.scrollHeight;
    }
    function onToken(_delta, acc) {
      if (liveMode === 'none') return;
      pending = acc;
      if (!raf) { raf = true; requestAnimationFrame(paintLive); }
    }
    function setProgress(text, pct) {
      progress.hidden = false;
      progressText.textContent = text || '';
      if (pct != null) progressFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    }

    /* ---------------- یک تلاش ---------------- */
    async function attempt(model) {
      if (destroyed) return;
      current = model;
      currentValue = null;
      tried.add(model.id);
      abortCtl = new AbortController();

      showModel(model);
      setStatus('در حال اجرا…', 'loading');
      setNote('');
      result.hidden = true; result.innerHTML = '';
      progress.hidden = true; progressFill.style.width = '0%';
      pending = ''; liveBody.innerHTML = ''; liveBody.textContent = '';
      live.hidden = liveMode === 'none';
      setActions([btn('⏹ توقف', 'btn-ghost', stop)]);

      const ctx = { model: model, signal: abortCtl.signal, onToken: onToken, progress: setProgress };

      let value;
      try {
        value = await opts.run(ctx);
      } catch (err) {
        if (destroyed) return;
        if (err && err.name === 'AbortError') {
          setStatus('متوقف شد', 'stopped');
          setActions([
            btn('↻ دوباره با همین مدل', 'btn-ghost', function () { tried.delete(model.id); attempt(model); }),
            btn('🎲 مدل تصادفی بعدی', 'btn-primary', nextRandom)
          ]);
          return;
        }
        handleFailure(model, err);
        return;
      }
      if (destroyed) return;

      autoFails = 0;
      currentValue = value;
      showResult(model, value);
    }

    function handleFailure(model, err) {
      const msg = (err && err.message) || 'خطای نامشخص';
      AI.record(model.id, 'fail');
      refreshModelStats(model);
      addTrail(model, 'خطا: ' + msg, 'fail');
      autoFails++;
      live.hidden = true;

      const limit = CONFIG.AI.AUTO_RETRY || 5;
      const nxt = AI.pickRandom(tried);
      if (!nxt) return exhausted('همهٔ مدل‌های فعال امتحان شدند و هیچ‌کدام جواب نداد.');

      if (autoFails >= limit) {
        setStatus('متوقف — ' + Utils.toFa(autoFails) + ' خطای پشت‌سرهم', 'error');
        setNote('چند مدل پشت‌سرهم خطا دادند؛ شاید مشکل از شبکه یا سرور است. خودت ادامه بده.', 'warn');
        setActions([btn('🎲 ادامه با مدل تصادفی بعدی', 'btn-primary', function () { autoFails = 0; nextRandom(); })]);
        return;
      }

      setStatus('خطا — مدل بعدی…', 'error');
      setNote('«' + (model.label || model.id) + '» خطا داد: ' + msg + ' — مدل تصادفی بعدی: «' + (nxt.label || nxt.id) + '»', 'warn');
      setActions([btn('⏹ توقف', 'btn-ghost', function () { clearTimeout(retryTimer); setStatus('متوقف شد', 'stopped'); setActions([btn('🎲 مدل تصادفی بعدی', 'btn-primary', nextRandom)]); })]);
      retryTimer = setTimeout(function () { attempt(nxt); }, 900);
    }
    let retryTimer = null;

    function exhausted(msg) {
      setStatus('استخر مدل‌ها تمام شد', 'error');
      setNote(msg, 'warn');
      setActions([btn('↺ شروع دوباره از مدل سایت', 'btn-primary', function () { tried = new Set(); autoFails = 0; attempt(AI.getModel()); })]);
    }

    function refreshModelStats(model) {
      const fresh = DB.getAiModel(model.id);
      if (fresh && current && current.id === model.id) { current = fresh; showModel(fresh); }
    }

    /* ---------------- نمایش نتیجه ---------------- */
    function showResult(model, value) {
      setStatus('نتیجه آماده است', 'review');
      live.hidden = true;
      progress.hidden = true;
      result.hidden = false;
      result.innerHTML = '';

      const api = { accept: function (v) { accept(v); }, reject: reject, model: model };
      if (opts.render) opts.render(result, value, api);
      else if (typeof value === 'string') result.innerHTML = '<div class="ai-stream-body">' + AIRender.renderMarkdown(value) + '</div>';

      const isSite = model.id === AI.getModelId();
      setActions([
        opts.hideAccept ? null : btn(opts.acceptLabel || '✅ بپذیر', 'btn-primary', function () { accept(); }),
        btn(opts.rejectLabel || '❌ رد کن — مدل تصادفی بعدی', 'btn-ghost', reject),
        isSite ? null : btn('📌 همین مدل، مدل سایت شود', 'btn-ghost', function (e) {
          AI.setModel(model.id);
          Toast.success('«' + (model.label || model.id) + '» مدل سایت شد');
          e.currentTarget.disabled = true;
          showModel(current);
        })
      ]);
    }

    async function accept(valueOverride) {
      if (finished || !current) return;
      const model = current;
      const value = valueOverride !== undefined ? valueOverride : currentValue;
      setActions([btn('در حال اعمال…', 'btn-primary', function () {}, true)]);
      try {
        if (opts.onAccept) await opts.onAccept(value, model);
      } catch (err) {
        console.error('[AIReview] onAccept', err);
        Toast.error('اعمال نتیجه ناموفق: ' + (err.message || err));
        showResult(model, currentValue);
        return;
      }
      finished = true;
      AI.record(model.id, 'win');
      addTrail(model, 'پذیرفته شد', 'win');
      setStatus('پذیرفته شد ✓', 'done');
      setNote('');
      setActions([]);
      if (opts.onFinish) opts.onFinish(model, value);
    }

    function reject() {
      if (finished || !current) return;
      const model = current;
      AI.record(model.id, 'loss');
      refreshModelStats(model);
      addTrail(model, 'رد شد', 'loss');
      nextRandom();
    }

    function nextRandom() {
      clearTimeout(retryTimer);
      const nxt = AI.pickRandom(tried);
      if (!nxt) return exhausted('مدل فعال دیگری برای امتحان نمانده است.');
      attempt(nxt);
    }

    function stop() { if (abortCtl) { try { abortCtl.abort(); } catch (e) { /* noop */ } } }

    function start() { tried = new Set(); autoFails = 0; finished = false; attempt(opts.startModel || AI.getModel()); }

    function destroy() { destroyed = true; clearTimeout(retryTimer); stop(); }

    return { el: el, start: start, stop: stop, destroy: destroy };
  }

  /* باز کردن در مودال */
  function open(opts) {
    const review = create(Object.assign({}, opts, {
      onFinish: function (model, value) {
        if (opts.onFinish) opts.onFinish(model, value);
        if (opts.closeOnAccept !== false) setTimeout(function () { Modal.close(); }, 700);
      }
    }));
    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { Modal.close(); } }, ['بستن'])
    ]);
    Modal.open({
      title: opts.title || 'هوش مصنوعی', icon: opts.icon || '🪄', size: opts.size || 'xl',
      body: Utils.el('div', {}, [opts.header || null, review.el].filter(Boolean)),
      footer: footer,
      onClose: function () { review.destroy(); if (opts.onClose) opts.onClose(); }
    });
    review.start();
    return review;
  }

  return { create: create, open: open, modelChip: modelChip, PROVIDER_LABEL: PROVIDER_LABEL };
})();
