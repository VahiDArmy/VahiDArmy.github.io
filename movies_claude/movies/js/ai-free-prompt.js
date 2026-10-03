/* =========================================================
   پرامپت آزاد — نوشتن، پاسخ گرفتن، ذخیره
   ========================================================= */
window.AIFreePrompt = (function () {

  let activeAbort = null;

  /* =========================================================
     مودال پرامپت
     ========================================================= */
  function open(opts) {
    opts = opts || {};
    const presetTitleId = opts.titleId || null;

    if (!AI.isConfigured()) {
      Toast.warning('ابتدا کلید OpenRouter را در تنظیمات وارد کن', {
        title: 'AI تنظیم نشده',
        action: { label: 'تنظیمات', onClick: function () { Events.openSettings(); } }
      });
      return;
    }

    /* ---- عناصر ---- */
    const titleSelect = buildTitleSelect(presetTitleId);
    const promptArea = Utils.el('textarea', {
      class: 'freeprompt-textarea',
      placeholder: 'پرامپت خودت را اینجا بنویس…\n\nمثال: چرا در فصل ۴ فلان شخصیت تصمیم غیرمنطقی گرفت؟'
    });
    if (opts.presetPrompt) promptArea.value = opts.presetPrompt;

    const sendBtn = Utils.el('button', {
      class: 'btn btn-primary', id: 'fp-send'
    }, ['ارسال']);
    const saveBtn = Utils.el('button', {
      class: 'btn btn-soft', id: 'fp-save', disabled: true
    }, ['💾 ذخیره سؤال و جواب']);

    const panel = buildPanel();
    const panelWrap = Utils.el('div', { class: 'freeprompt-response', hidden: true }, [panel.el]);

    let lastResponse = '';
    let lastPrompt = '';
    let lastModel = null;
    let savedAlready = false;

    /* ---- reset وضعیت ذخیره ---- */
    function resetSaveState() {
      savedAlready = false;
      saveBtn.disabled = true;
      saveBtn.classList.remove('is-saved');
      saveBtn.innerHTML = '💾 ذخیره سؤال و جواب';
    }

    /* ---- ارسال ---- */
    sendBtn.addEventListener('click', async function () {
      const prompt = promptArea.value.trim();
      if (!prompt) {
        Toast.warning('پرامپت خالی است');
        promptArea.focus();
        return;
      }

      const titleId = titleSelect.value ? Number(titleSelect.value) : null;
      const t = titleId ? DB.getTitle(titleId) : null;

      let system = 'تو یک دستیار متخصص سینما و سریال هستی. به فارسی روان، دقیق و بدون تعارف پاسخ بده.';
      system += ' پاسخ‌ها با Markdown استاندارد بنویس (## برای تیتر، **bold**، - برای لیست).';
      if (t) {
        system += '\n\nاطلاعات زمینه‌ای:\n';
        system += 'عنوان استاندارد: ' + AIPrompts.standardLine(t.title, t.type, t.year, t) + '\n';
        if (t.genre) system += 'ژانر: ' + t.genre + '\n';
        if (t.summary) system += 'خلاصه: ' + t.summary + '\n';
      }

      panelWrap.hidden = false;
      panel.setContent('');
      panel.setStatus('loading', 'در حال دریافت…');
      resetSaveState();
      lastResponse = '';
      lastPrompt = prompt;

      activeAbort = new AbortController();
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<span class="spinner"></span> در حال اجرا…';

      try {
        await AI.chatStream({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          signal: activeAbort.signal,
          onToken: function (delta, acc) {
            lastResponse = acc;
            panel.appendText(acc);
          }
        });
        panel.setStatus('done', 'انجام شد ✓');
        lastModel = (AI.getLastUsedModel && AI.getLastUsedModel()) || null;

        console.log('[FreePrompt] response received, length:', lastResponse.length);

        if (lastResponse && lastResponse.trim()) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '💾 ذخیره سؤال و جواب';
        } else {
          Toast.warning('پاسخ خالی بود');
        }
      } catch (err) {
        console.error('[FreePrompt] stream error:', err);
        panel.setStatus('error', 'خطا');
        panel.setContent('<div class="ai-error">' + Utils.esc(err.message) + '</div>');
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'ارسال';
      }
    });

    /* ---- ذخیره ---- */
    saveBtn.addEventListener('click', function () {
      if (savedAlready) return;
      if (!lastResponse || !lastResponse.trim()) {
        Toast.warning('هنوز پاسخی نیست');
        return;
      }
      if (!lastPrompt || !lastPrompt.trim()) {
        Toast.warning('پرامپت خالی است');
        return;
      }

      const titleId = titleSelect.value ? Number(titleSelect.value) : null;
      const titleContext = titleId ? ((DB.getTitle(titleId) || {}).title || '') : '';

      console.log('[FreePrompt] saving conversation:', {
        titleId: titleId,
        titleContext: titleContext,
        promptLen: lastPrompt.length,
        responseLen: lastResponse.length,
        hasModel: !!lastModel
      });

      try {
        const id = DB.saveConversation({
          title_id: titleId,
          title_context: titleContext,
          prompt: lastPrompt,
          response: lastResponse,
          ai_model: lastModel
        });

        console.log('[FreePrompt] saved with id:', id);

        savedAlready = true;
        saveBtn.disabled = true;
        saveBtn.classList.add('is-saved');
        saveBtn.innerHTML = '✅ ذخیره شد';

        Toast.success('سؤال و جواب ذخیره شد', {
          title: '✅ ذخیره',
          duration: 5000,
          action: {
            label: '📚 نمایش در تاریخچه',
            onClick: function () {
              try { openHistory(); } catch (e) { console.error(e); }
            }
          }
        });
      } catch (e) {
        console.error('[FreePrompt] save error:', e);
        Toast.error('ذخیره ناموفق: ' + (e.message || 'خطای نامشخص'));
      }
    });

    /* ---- Ctrl+Enter ---- */
    promptArea.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!sendBtn.disabled) sendBtn.click();
      }
    });

    /* ---- بدنه ---- */
    const body = Utils.el('div', { class: 'freeprompt-body' }, [
      Utils.el('div', { class: 'freeprompt-context' }, [
        Utils.el('label', { class: 'freeprompt-context-label' }, ['مرتبط با:']),
        titleSelect
      ]),
      Utils.el('div', { class: 'freeprompt-input-wrap' }, [
        promptArea,
        Utils.el('div', { class: 'freeprompt-input-foot' }, [
          Utils.el('span', { class: 'freeprompt-hint' }, ['Ctrl+Enter = ارسال']),
          sendBtn
        ])
      ]),
      panelWrap,
      Utils.el('div', { class: 'freeprompt-save-row' }, [saveBtn])
    ]);

    /* ---- فوتر ---- */
    const footer = Utils.el('div', { class: 'flex gap-3 w-full items-center' }, [
      Utils.el('button', {
        class: 'btn btn-ghost', id: 'fp-history'
      }, ['📚 تاریخچه']),
      Utils.el('div', { class: 'flex-1' }),
      Utils.el('button', {
        class: 'btn btn-ghost',
        onclick: function () { Modal.close(); }
      }, ['بستن'])
    ]);

    Modal.open({
      title: 'پرامپت آزاد',
      icon: '✨',
      size: 'xl',
      body: body,
      footer: footer
    });

    document.getElementById('fp-history').addEventListener('click', function () {
      openHistory();
    });

    setTimeout(function () { promptArea.focus(); }, 100);
  }

  /* =========================================================
     انتخاب‌گر عنوان
     ========================================================= */
  function buildTitleSelect(presetTitleId) {
    const sel = Utils.el('select', { class: 'freeprompt-title-select', id: 'fp-title-select' });
    sel.appendChild(Utils.el('option', { value: '' }, ['— بدون عنوان خاص —']));

    const titles = DB.getAllTitles();
    titles.forEach(function (t) {
      const o = Utils.el('option', { value: String(t.id) }, [t.title]);
      if (presetTitleId && t.id === presetTitleId) o.selected = true;
      sel.appendChild(o);
    });

    return sel;
  }

  /* =========================================================
     پنل استریم
     ========================================================= */
  function buildPanel() {
    const body = Utils.el('div', { class: 'ai-stream-body freeprompt-stream' });
    const content = Utils.el('div', { class: 'ai-stream-content' });
    body.appendChild(content);

    const status = Utils.el('div', { class: 'ai-stream-status' }, [
      Utils.el('span', { class: 'ai-status-dot' }),
      Utils.el('span', { class: 'ai-status-text' }, ['آماده'])
    ]);

    const panel = Utils.el('div', { class: 'ai-stream-panel freeprompt-panel' }, [
      Utils.el('div', { class: 'ai-stream-head' }, [
        Utils.el('div', { class: 'ai-stream-title' }, ['پاسخ AI']),
        status
      ]),
      body
    ]);

    let pendingText = '';
    let raf = false;
    let last = '';

    function flush() {
      raf = false;
      if (pendingText === last) return;
      const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 60;
      content.innerHTML = AIUI.renderMarkdown(pendingText);
      last = pendingText;
      if (atBottom) body.scrollTop = body.scrollHeight;
    }
    function appendText(acc) {
      pendingText = acc;
      if (raf) return;
      raf = true;
      requestAnimationFrame(flush);
    }
    function setContent(html) {
      pendingText = '';
      last = '';
      content.innerHTML = html;
    }
    function setStatus(state, text) {
      status.querySelector('.ai-status-text').textContent = text;
      status.dataset.state = state;
    }

    return { el: panel, body: body, appendText: appendText, setContent: setContent, setStatus: setStatus };
  }

  /* =========================================================
     مودال تاریخچه
     ========================================================= */
  function openHistory() {
    /* ---- همیشه از دیتابیس می‌خوانیم — نه از cache ---- */
    let all = DB.getAllConversations();

    console.log('[FreePrompt] history loaded:', all.length, 'items');

    const searchInput = Utils.el('input', {
      class: 'field-input',
      type: 'search',
      placeholder: 'جستجو در پرامپت‌ها و پاسخ‌ها…',
      autocomplete: 'off'
    });

    const listWrap = Utils.el('div', { class: 'conversations-list' });
    const countEl = Utils.el('div', { class: 'conversations-count' }, [
      Utils.toFa(all.length) + ' پرامپت ذخیره‌شده'
    ]);

    function reload() {
      all = DB.getAllConversations();
      countEl.textContent = Utils.toFa(all.length) + ' پرامپت ذخیره‌شده';
      renderList(searchInput.value);
    }

    function renderList(query) {
      listWrap.innerHTML = '';
      const q = Utils.normalizeFa(query || '').toLowerCase();

      let filtered = all;
      if (q) {
        filtered = all.filter(function (c) {
          const hay = Utils.normalizeFa((c.prompt || '') + ' ' + (c.response || '') + ' ' + (c.title_context || ''));
          return hay.indexOf(q) > -1;
        });
      }

      if (!filtered.length) {
        listWrap.appendChild(Utils.el('div', { class: 'conversations-empty' }, [
          all.length ? 'چیزی با این جستجو پیدا نشد' : 'هنوز پرامپتی ذخیره نکرده‌ای'
        ]));
        return;
      }

      filtered.forEach(function (c) {
        listWrap.appendChild(buildConvItem(c, function () {
          viewConversation(c, function () {
            reload();
          });
        }));
      });
    }

    searchInput.addEventListener('input', Utils.debounce(function (e) {
      renderList(e.target.value);
    }, 150));

    renderList('');

    const body = Utils.el('div', { class: 'conversations-body' }, [
      searchInput,
      countEl,
      listWrap
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full items-center' }, [
      Utils.el('button', {
        class: 'btn btn-ghost',
        id: 'conv-refresh',
        onclick: function () { reload(); Toast.info('تاریخچه بروزرسانی شد'); }
      }, ['🔄 بروزرسانی']),
      Utils.el('div', { class: 'flex-1' }),
      Utils.el('button', { class: 'btn btn-ghost', onclick: function () { Modal.close(); } }, ['بستن'])
    ]);

    Modal.open({
      title: 'تاریخچه پرامپت‌ها',
      icon: '📚',
      size: 'lg',
      body: body,
      footer: footer
    });
  }

  function buildConvItem(c, onClick) {
    const date = Utils.toJalali(c.created_at);
    const promptPreview = (c.prompt || '').slice(0, 120);
    const responsePreview = (c.response || '').replace(/[#*`_\-]/g, '').slice(0, 140);

    return Utils.el('div', {
      class: 'conv-item',
      role: 'button',
      tabindex: '0',
      onclick: onClick
    }, [
      Utils.el('div', { class: 'conv-head' }, [
        Utils.el('div', { class: 'conv-title' }, [
          c.title_context
            ? Utils.el('span', { class: 'conv-title-badge' }, ['🎬 ' + c.title_context])
            : Utils.el('span', { class: 'conv-title-badge conv-title-general' }, ['📌 عمومی'])
        ]),
        Utils.el('span', { class: 'conv-date' }, [date])
      ]),
      Utils.el('div', { class: 'conv-prompt' }, [promptPreview + (c.prompt.length > 120 ? '…' : '')]),
      responsePreview
        ? Utils.el('div', { class: 'conv-response' }, [responsePreview + '…'])
        : null
    ].filter(Boolean));
  }

  function viewConversation(c, onDelete) {
    const date = Utils.toJalaliLong(c.created_at);

    const promptBox = Utils.el('div', { class: 'conv-view-section' }, [
      Utils.el('div', { class: 'conv-view-label' }, ['سؤال:']),
      Utils.el('div', { class: 'conv-view-prompt' }, [c.prompt])
    ]);

    const responseBox = Utils.el('div', { class: 'conv-view-section' }, [
      Utils.el('div', { class: 'conv-view-label' }, ['پاسخ:']),
      Utils.el('div', { class: 'conv-view-response' })
    ]);
    responseBox.lastChild.innerHTML = AIUI.renderMarkdown(c.response || '');

    const metaBox = Utils.el('div', { class: 'conv-view-meta' }, [
      Utils.el('span', {}, ['📅 ' + date]),
      c.title_context ? Utils.el('span', {}, ['🎬 ' + c.title_context]) : null,
      c.ai_model && c.ai_model.label ? Utils.el('span', {}, ['✨ ' + c.ai_model.label]) : null
    ].filter(Boolean));

    const body = Utils.el('div', { class: 'conv-view' }, [
      metaBox,
      promptBox,
      responseBox
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full' }, [
      Utils.el('button', {
        class: 'btn btn-danger',
        onclick: function () {
          Modal.confirm({
            title: 'حذف پرامپت',
            message: 'این سؤال و جواب برای همیشه حذف شود؟',
            confirmText: 'حذف کن',
            danger: true,
            icon: '🗑️',
            onConfirm: function () {
              try {
                DB.deleteConversation(c.id);
                Toast.success('حذف شد');
              } catch (e) {
                Toast.error('حذف ناموفق: ' + e.message);
              }
              Modal.close();
              setTimeout(function () {
                if (typeof onDelete === 'function') onDelete();
              }, 200);
            }
          });
        }
      }, ['حذف']),
      Utils.el('button', {
        class: 'btn btn-ghost',
        onclick: function () {
          Utils.copyToClipboard(c.prompt + '\n\n---\n\n' + c.response).then(function (ok) {
            Toast.success(ok ? 'کپی شد' : 'کپی ناموفق');
          });
        }
      }, ['📋 کپی']),
      Utils.el('div', { class: 'flex-1' }),
      Utils.el('button', {
        class: 'btn btn-primary',
        onclick: function () { Modal.close(); }
      }, ['بستن'])
    ]);

    Modal.open({
      title: 'نمایش پرامپت',
      icon: '💬',
      size: 'lg',
      body: body,
      footer: footer
    });
  }

  function cleanup() {
    if (activeAbort) {
      try { activeAbort.abort(); } catch (e) {}
      activeAbort = null;
    }
  }

  return {
    open: open,
    openHistory: openHistory,
    cleanup: cleanup
  };
})();

/* =========================================================
   اتصال دکمه‌های سایدبار
   ========================================================= */
(function () {
  function bind() {
    const sidebarBtn = document.getElementById('btn-free-prompt');
    if (sidebarBtn && !sidebarBtn.__fpBound) {
      sidebarBtn.__fpBound = true;
      sidebarBtn.addEventListener('click', function () {
        AIFreePrompt.open();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();