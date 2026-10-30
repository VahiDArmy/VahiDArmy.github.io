/* =========================================================
   AI Roulette — pick a random active model, run the analysis
   workload on a chosen title, Accept / Reject, keep score.
   ---------------------------------------------------------
   Score: +1 win on Accept, +1 loss on Reject OR auto-failure
   (HTTP error, timeout, empty response, network drop).

   Pool:  DB.getActiveAiModels() — inactive models never picked.
   Store: DB.recordAiTrial / DB.setAiModelActive — row persists,
          score is never reset by deactivation.

   Pick policy: random from the bottom half by (wins + losses),
   never the same twice in a row. Ensures even coverage without
   starving any model.
   ========================================================= */
window.AIRoulette = (function () {
  const TIMEOUT_MS = 90 * 1000;

  const state = {
    pickedModel: null,
    running: false,
    abandoned: false,
    abortController: null,
    currentTitle: null,
    lastResponse: '',
    lastError: null,
    timedOut: false,
    lastPickedId: null,
    sessionTrials: 0
  };

  let ui = null;

  /* =========================================================
     Pick
     ========================================================= */
  function pickRandom() {
    const pool = DB.getActiveAiModels();
    if (!pool.length) return null;

    let candidates = pool.filter(function (m) { return m.id !== state.lastPickedId; });
    if (!candidates.length) candidates = pool.slice();

    candidates.sort(function (a, b) {
      return ((a.wins || 0) + (a.losses || 0)) - ((b.wins || 0) + (b.losses || 0));
    });

    const bottomN = candidates.slice(0, Math.max(2, Math.ceil(candidates.length / 2)));
    const pick = bottomN[Math.floor(Math.random() * bottomN.length)];

    state.lastPickedId = pick.id;
    return pick;
  }

  /* =========================================================
     Open
     ========================================================= */
  function open() {
    state.pickedModel = null;
    state.running = false;
    state.abandoned = false;
    state.abortController = null;
    state.lastResponse = '';
    state.lastError = null;
    state.timedOut = false;

    buildUI();
  }

  /* =========================================================
     UI
     ========================================================= */
  function buildUI() {
    const titles = DB.getAllTitles();
    const titleSelect = Utils.el('select', { class: 'field-select', id: 'roulette-title' });
    titles.forEach(function (t) {
      titleSelect.appendChild(Utils.el('option', { value: String(t.id) }, [
        t.title + (t.year ? ' (' + t.year + ')' : '')
      ]));
    });
    state.currentTitle = titles[0] || null;

    titleSelect.addEventListener('change', function () {
      state.currentTitle = titles.filter(function (t) { return t.id === titleSelect.value; })[0] || null;
    });

    const pickBtn = Utils.el('button', {
      class: 'btn btn-primary', id: 'roulette-pick', type: 'button'
    }, ['🎲 انتخاب تصادفی']);

    const modelCard = Utils.el('div', { class: 'roulette-pick-card', id: 'roulette-model-card' }, [
      Utils.el('div', { class: 'roulette-pick-empty' }, ['هنوز مدلی انتخاب نشده — «انتخاب تصادفی» را بزن'])
    ]);

    const streamBody = Utils.el('div', { class: 'ai-stream-body roulette-stream-body' });
    const streamContent = Utils.el('div', { class: 'ai-stream-content' });
    streamBody.appendChild(streamContent);

    const streamStatus = Utils.el('div', { class: 'ai-stream-status' }, [
      Utils.el('span', { class: 'ai-status-dot' }),
      Utils.el('span', { class: 'ai-status-text' }, ['آماده'])
    ]);

    const streamPanel = Utils.el('div', {
      class: 'ai-stream-panel', id: 'roulette-stream-panel', hidden: true
    }, [
      Utils.el('div', { class: 'ai-stream-head' }, [
        Utils.el('div', { class: 'ai-stream-title' }, ['پاسخ AI']),
        streamStatus
      ]),
      streamBody
    ]);

    const runBtn = Utils.el('button', {
      class: 'btn btn-primary', id: 'roulette-run', type: 'button', disabled: true
    }, ['▶ اجرا']);
    const acceptBtn = Utils.el('button', {
      class: 'btn btn-primary', id: 'roulette-accept', type: 'button', disabled: true
    }, ['✓ قبول (+1)']);
    const rejectBtn = Utils.el('button', {
      class: 'btn btn-danger', id: 'roulette-reject', type: 'button', disabled: true
    }, ['✗ رد (−1)']);
    const nextBtn = Utils.el('button', {
      class: 'btn btn-ghost', id: 'roulette-next', type: 'button', hidden: true
    }, ['⟲ بعدی']);

    const actions = Utils.el('div', { class: 'roulette-actions' }, [runBtn, acceptBtn, rejectBtn, nextBtn]);

    const scoreboardEl = Utils.el('div', { class: 'roulette-scoreboard', id: 'roulette-scoreboard' });

    const sessionEl = Utils.el('span', { id: 'roulette-session-count' }, ['۰ تلاش در این نشست']);

    const body = Utils.el('div', { class: 'roulette-body' }, [
      Utils.el('div', { class: 'roulette-config' }, [
        Utils.el('label', { class: 'roulette-label' }, ['عنوان آزمایشی:']),
        titleSelect,
        pickBtn
      ]),
      Utils.el('div', { class: 'roulette-meta-line' }, [sessionEl]),
      modelCard,
      streamPanel,
      actions,
      Utils.el('h4', { style: { marginTop: '20px', marginBottom: '10px' } }, ['📊 جدول امتیازها']),
      scoreboardEl
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', {
        class: 'btn btn-ghost',
        onclick: function () { Modal.close(); }
      }, ['بستن'])
    ]);

    Modal.open({
      title: '🎲 رولت مدل‌های AI',
      icon: '🎲',
      size: 'xl',
      body: body,
      footer: footer,
      onClose: function () {
        if (state.running) {
          state.abandoned = true;
          if (state.abortController) {
            try { state.abortController.abort(); } catch (e) {}
          }
        }
      }
    });

    ui = {
      titleSelect: titleSelect,
      pickBtn: pickBtn,
      modelCard: modelCard,
      streamPanel: streamPanel,
      streamBody: streamBody,
      streamContent: streamContent,
      streamStatus: streamStatus,
      runBtn: runBtn,
      acceptBtn: acceptBtn,
      rejectBtn: rejectBtn,
      nextBtn: nextBtn,
      scoreboardEl: scoreboardEl,
      sessionEl: sessionEl
    };

    pickBtn.addEventListener('click', doPick);
    runBtn.addEventListener('click', doRun);
    acceptBtn.addEventListener('click', function () { doVerdict(true); });
    rejectBtn.addEventListener('click', function () { doVerdict(false); });
    nextBtn.addEventListener('click', function () { if (!state.running) doPick(); });

    renderScoreboard();
    updateSessionCount();

    if (!titles.length) {
      pickBtn.disabled = true;
      Toast.warning('برای آزمایش، ابتدا یک عنوان به آرشیو اضافه کن');
    }
    if (!DB.getActiveAiModels().length) {
      pickBtn.disabled = true;
      Toast.warning('هیچ مدل فعالی در استخر نیست. از پایین صفحه فعال کن.');
    }
  }

  function updateSessionCount() {
    if (ui && ui.sessionEl) {
      ui.sessionEl.textContent = Utils.toFa(state.sessionTrials) + ' تلاش در این نشست';
    }
  }

  /* =========================================================
     Pick
     ========================================================= */
  function doPick() {
    if (state.running) return;

    const pick = pickRandom();
    if (!pick) {
      Toast.warning('هیچ مدل فعالی برای انتخاب نیست');
      return;
    }

    state.pickedModel = pick;
    state.lastResponse = '';
    state.lastError = null;
    state.timedOut = false;
    state.abandoned = false;

    renderModelCard();
    if (ui.streamPanel) ui.streamPanel.hidden = true;
    if (ui.streamContent) ui.streamContent.innerHTML = '';
    if (ui.runBtn) ui.runBtn.disabled = false;
    if (ui.acceptBtn) ui.acceptBtn.disabled = true;
    if (ui.rejectBtn) ui.rejectBtn.disabled = true;
    if (ui.nextBtn) ui.nextBtn.hidden = true;
    if (ui.titleSelect) ui.titleSelect.disabled = false;
  }

  function renderModelCard() {
    const m = state.pickedModel;
    if (!m || !ui) return;

    ui.modelCard.innerHTML = '';

    if (!m.id) {
      ui.modelCard.appendChild(Utils.el('div', { class: 'roulette-pick-empty' }, ['هنوز مدلی انتخاب نشده']));
      return;
    }

    const isGoogle = m.provider === 'google';
    const total = (m.wins || 0) + (m.losses || 0);
    const rate = total > 0 ? Math.round((m.wins / total) * 100) : null;

    ui.modelCard.appendChild(Utils.el('div', {
      class: 'roulette-provider ' + (isGoogle ? 'provider-google' : 'provider-openrouter')
    }, [isGoogle ? 'Google · مستقیم' : 'OpenRouter']));
    ui.modelCard.appendChild(Utils.el('h3', { class: 'roulette-model-name' }, [m.label || m.id]));
    ui.modelCard.appendChild(Utils.el('div', { class: 'roulette-model-id' }, [m.id]));

    const statsChildren = [
      Utils.el('span', {}, ['✓ ' + Utils.toFa(m.wins || 0)]),
      Utils.el('span', {}, ['✗ ' + Utils.toFa(m.losses || 0)])
    ];
    if (rate !== null) statsChildren.push(Utils.el('span', {}, ['نرخ: ' + Utils.toFa(rate) + '٪']));
    if (total === 0) statsChildren.push(Utils.el('span', { class: 'roulette-fresh' }, ['جدید']));

    ui.modelCard.appendChild(Utils.el('div', { class: 'roulette-model-stats' }, statsChildren));

    ui.modelCard.classList.remove('is-fresh');
    void ui.modelCard.offsetWidth;
    ui.modelCard.classList.add('is-fresh');
  }

  function setStreamStatus(stateName, text) {
    if (!ui) return;
    const textEl = ui.streamStatus.querySelector('.ai-status-text');
    if (textEl) textEl.textContent = text;
    ui.streamStatus.dataset.state = stateName || 'idle';
  }

  /* =========================================================
     Run
     ========================================================= */
  async function doRun() {
    if (state.running || !state.pickedModel || !ui) return;
    if (!state.currentTitle) {
      Toast.warning('یک عنوان انتخاب کن');
      return;
    }

    state.running = true;
    state.abandoned = false;
    state.lastResponse = '';
    state.lastError = null;
    state.timedOut = false;

    ui.runBtn.disabled = true;
    ui.acceptBtn.disabled = true;
    ui.rejectBtn.disabled = true;
    ui.nextBtn.hidden = true;
    ui.titleSelect.disabled = true;
    ui.pickBtn.disabled = true;
    ui.streamPanel.hidden = false;
    ui.streamContent.innerHTML = '';

    setStreamStatus('loading', 'در حال اجرا…');

    const t = state.currentTitle;
    const messages = [
      { role: 'system', content: AIPrompts.analyzeSystem },
      { role: 'user', content: AIPrompts.analyzeUser(t.title, t.type, t.year, t) }
    ];

    state.abortController = new AbortController();
    const timeoutId = setTimeout(function () {
      state.timedOut = true;
      if (state.abortController) {
        try { state.abortController.abort(); } catch (e) {}
      }
    }, TIMEOUT_MS);

    let pending = '';
    let rafQueued = false;
    const flushRender = function () {
      rafQueued = false;
      if (!ui) return;
      ui.streamContent.innerHTML = AIUI.renderMarkdown(pending);
      ui.streamBody.scrollTop = ui.streamBody.scrollHeight;
    };

    try {
      await AI.chatStream({
        model: state.pickedModel.id,
        provider: state.pickedModel.provider,
        messages: messages,
        temperature: 0.3,
        signal: state.abortController.signal,
        onToken: function (delta, acc) {
          pending = acc;
          state.lastResponse = acc;
          if (!rafQueued) {
            rafQueued = true;
            requestAnimationFrame(flushRender);
          }
        }
      });

      clearTimeout(timeoutId);

      if (state.abandoned) return;

      if (!state.lastResponse || !state.lastResponse.trim()) {
        throw new Error('پاسخ خالی بود');
      }

      state.running = false;
      setStreamStatus('done', '✓ پاسخ کامل');
      ui.titleSelect.disabled = false;
      ui.pickBtn.disabled = false;
      ui.acceptBtn.disabled = false;
      ui.rejectBtn.disabled = false;

    } catch (err) {
      clearTimeout(timeoutId);

      if (state.abandoned) return;

      let reason = '';
      if (state.timedOut) {
        reason = 'زمان تمام شد (' + Math.round(TIMEOUT_MS / 1000) + ' ثانیه)';
      } else if (err && err.name === 'AbortError') {
        reason = 'لغو شد';
      } else {
        reason = (err && err.message) || String(err);
      }

      state.lastError = reason;
      state.running = false;
      setStreamStatus('error', '✗ خطا');
      ui.titleSelect.disabled = false;
      ui.pickBtn.disabled = false;

      recordVerdict(false, reason);
    }
  }

  /* =========================================================
     Verdict
     ========================================================= */
  function doVerdict(accepted) {
    if (!state.pickedModel || state.running) return;
    recordVerdict(accepted, null);
  }

  function recordVerdict(accepted, reason) {
    const m = state.pickedModel;
    if (!m || !ui) return;

    DB.recordAiTrial(m.id, accepted);
    state.sessionTrials++;
    updateSessionCount();

    const updated = DB.getAiModel(m.id) || m;
    state.pickedModel = updated;
    renderModelCard();
    renderScoreboard();

    if (reason && ui.streamContent) {
      ui.streamContent.appendChild(Utils.el('div', {
        class: 'ai-error', style: { marginTop: '10px' }
      }, ['✗ ' + reason]));
    }

    ui.acceptBtn.disabled = true;
    ui.rejectBtn.disabled = true;
    ui.runBtn.disabled = true;
    ui.nextBtn.hidden = false;
    ui.pickBtn.disabled = false;

    if (accepted) {
      Toast.success('✓ ثبت شد: قبول (+1)', { title: m.label || m.id });
    } else if (reason) {
      Toast.error('✗ ثبت شد: خطا (−1)', { title: m.label || m.id });
    } else {
      Toast.warning('✗ ثبت شد: رد (−1)', { title: m.label || m.id });
    }
  }

  /* =========================================================
     Scoreboard
     ========================================================= */
  function renderScoreboard() {
    if (!ui || !ui.scoreboardEl) return;
    const all = DB.getAiModels();
    if (!all.length) {
      ui.scoreboardEl.innerHTML = '<div class="roulette-empty">هیچ مدلی در دیتابیس نیست</div>';
      return;
    }

    const sorted = all.slice().sort(function (a, b) {
      const netA = (a.wins || 0) - (a.losses || 0);
      const netB = (b.wins || 0) - (b.losses || 0);
      if (netA !== netB) return netB - netA;
      const trA = (a.wins || 0) + (a.losses || 0);
      const trB = (b.wins || 0) + (b.losses || 0);
      if (trA !== trB) return trB - trA;
      return String(a.label || a.id).localeCompare(String(b.label || b.id), 'fa');
    });

    const activeCount = all.filter(function (m) { return m.active !== false; }).length;
    const inactiveCount = all.length - activeCount;

    ui.scoreboardEl.innerHTML = '';
    ui.scoreboardEl.appendChild(Utils.el('div', { class: 'roulette-scoreboard-summary' }, [
      Utils.el('span', {}, ['فعال: ' + Utils.toFa(activeCount)]),
      Utils.el('span', {}, ['غیرفعال: ' + Utils.toFa(inactiveCount)]),
      Utils.el('span', {}, ['مجموع: ' + Utils.toFa(all.length)])
    ]));

    const table = Utils.el('table', { class: 'roulette-table' });
    table.appendChild(Utils.el('thead', {}, [Utils.el('tr', {}, [
      Utils.el('th', { style: { width: '36px' } }, ['']),
      Utils.el('th', { style: { width: '36px' } }, ['']),
      Utils.el('th', {}, ['مدل']),
      Utils.el('th', { style: { width: '46px' } }, ['✓']),
      Utils.el('th', { style: { width: '46px' } }, ['✗']),
      Utils.el('th', { style: { width: '56px' } }, ['نرخ']),
      Utils.el('th', { style: { width: '56px' } }, ['خالص']),
      Utils.el('th', { style: { width: '80px' } }, ['آخرین'])
    ])]));

    const tbody = Utils.el('tbody');
    sorted.forEach(function (m) {
      const isActive = m.active !== false;
      const total = (m.wins || 0) + (m.losses || 0);
      const rate = total > 0 ? Math.round(((m.wins || 0) / total) * 100) : null;
      const net = (m.wins || 0) - (m.losses || 0);
      const isCurrent = state.pickedModel && state.pickedModel.id === m.id;

      const toggleBtn = Utils.el('button', {
        class: 'roulette-toggle ' + (isActive ? 'is-active' : 'is-inactive'),
        type: 'button',
        title: isActive
          ? 'غیرفعال کن (از استخر خارج شو)'
          : 'فعال کن (به استخر برگرد)',
        onclick: function (e) {
          e.stopPropagation();
          if (!isActive) {
            DB.setAiModelActive(m.id, true);
            renderScoreboard();
            Toast.success('فعال شد: ' + (m.label || m.id));
          } else {
            Modal.confirm({
              title: 'غیرفعال کردن مدل',
              message: '«' + (m.label || m.id) + '» از استخر رولت خارج شود؟ امتیازات حفظ می‌شوند و هر زمان می‌توانی دوباره فعالش کنی. ردیف حذف نمی‌شود.',
              icon: '⏸️',
              confirmText: 'غیرفعال کن',
              onConfirm: function () {
                DB.setAiModelActive(m.id, false);
                renderScoreboard();
                Toast.info('غیرفعال شد: ' + (m.label || m.id));
              }
            });
          }
        }
      }, [isActive ? '●' : '○']);

      const providerTag = Utils.el('span', {
        class: 'roulette-mini-provider ' +
          (m.provider === 'google' ? 'provider-google' : 'provider-openrouter')
      }, [m.provider === 'google' ? 'G' : 'OR']);

      const netText = (net > 0 ? '+' : '') + Utils.toFa(net);
      const netClass = net > 0 ? 'roulette-net-positive'
        : net < 0 ? 'roulette-net-negative' : '';

      tbody.appendChild(Utils.el('tr', {
        class: (isActive ? '' : 'is-inactive') + (isCurrent ? ' is-current' : '')
      }, [
        Utils.el('td', {}, [toggleBtn]),
        Utils.el('td', {}, [providerTag]),
        Utils.el('td', { class: 'roulette-td-name' }, [
          Utils.el('div', { class: 'roulette-name' }, [m.label || m.id]),
          Utils.el('div', { class: 'roulette-id' }, [m.id])
        ]),
        Utils.el('td', { class: 'roulette-td-num' }, [Utils.toFa(m.wins || 0)]),
        Utils.el('td', { class: 'roulette-td-num' }, [Utils.toFa(m.losses || 0)]),
        Utils.el('td', { class: 'roulette-td-num' }, [rate !== null ? Utils.toFa(rate) + '٪' : '—']),
        Utils.el('td', { class: 'roulette-td-num ' + netClass }, [netText]),
        Utils.el('td', { class: 'roulette-td-last' }, [
          m.last_tried_at ? Utils.relativeTime(m.last_tried_at) : '—'
        ])
      ]));
    });

    table.appendChild(tbody);
    ui.scoreboardEl.appendChild(table);
  }

  return { open: open };
})();