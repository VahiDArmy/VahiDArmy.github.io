/* =========================================================
   رابط‌های کاربری AI (مودال‌ها)
   ========================================================= */
window.AIUI = (function () {

  let activeAbort = null;

  /* ---- رندر ساده Markdown ---- */
  function renderMarkdown(text) {
    if (!text) return '';
    let html = Utils.esc(text);
    // code blocks
    html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
      `<pre class="ai-code">${code}</pre>`);
    // inline code
    html = html.replace(/`([^`]+)`/g, '<code class="ai-inline">$1</code>');
    // headings
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    // bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // italic
    html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    // lists
    html = html.replace(/(?:^|\n)((?:- .+(?:\n|$))+)/g, (_, block) => {
      const items = block.trim().split('\n').map(l => l.replace(/^-\s*/, ''));
      return '\n<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
    });
    html = html.replace(/(?:^|\n)((?:\d+\. .+(?:\n|$))+)/g, (_, block) => {
      const items = block.trim().split('\n').map(l => l.replace(/^\d+\.\s*/, ''));
      return '\n<ol>' + items.map(i => `<li>${i}</li>`).join('') + '</ol>';
    });
    // paragraphs
    html = html.split(/\n{2,}/).map(p => {
      if (/^<(h\d|ul|ol|pre|div)/.test(p.trim())) return p;
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');
    return html;
  }

  /* ---- ساخت پنل استریم ---- */
  function createStreamPanel(titleText) {
    const body = Utils.el('div', { class: 'ai-stream-body' });
    const status = Utils.el('div', { class: 'ai-stream-status' }, [
      Utils.el('span', { class: 'ai-status-dot' }),
      Utils.el('span', { class: 'ai-status-text' }, ['آماده'])
    ]);
    const panel = Utils.el('div', { class: 'ai-stream-panel' }, [
      Utils.el('div', { class: 'ai-stream-head' }, [
        Utils.el('div', { class: 'ai-stream-title' }, [titleText]),
        status
      ]),
      body
    ]);

    function setStatus(text, state) {
      status.querySelector('.ai-status-text').textContent = text;
      status.dataset.state = state || 'idle';
    }

    function setContent(html) {
      body.innerHTML = html;
      body.scrollTop = body.scrollHeight;
    }

    function appendText(acc) {
      setContent(renderMarkdown(acc));
    }

    return { panel, body, setStatus, setContent, appendText };
  }

  /* ---- چک تنظیم بودن AI ---- */
  function requireAI() {
    if (!AI.isConfigured()) {
      Toast.warning('ابتدا کلید OpenRouter را در تنظیمات وارد کن', {
        title: 'AI تنظیم نشده',
        action: {
          label: 'تنظیمات',
          onClick: () => Events.openSettings()
        }
      });
      return false;
    }
    return true;
  }

  /* ============================================================
     استانداردسازی یک عنوان
     ============================================================ */
  function openStandardizeSingle(id) {
    if (!requireAI()) return;
    const t = DB.getTitle(id);
    if (!t) return;

    const panel = createStreamPanel(`استانداردسازی: ${t.title}`);

    const resultBox = Utils.el('div', { class: 'ai-result-box', hidden: true });
    const applyBtn = Utils.el('button', {
      class: 'btn btn-primary', id: 'ai-apply-btn', disabled: true
    }, ['✅ اعمال روی دیتابیس']);

    const body = Utils.el('div', { class: 'ai-layout' }, [
      Utils.el('div', { class: 'ai-source' }, [
        Utils.el('span', { class: 'ai-source-label' }, ['عنوان فعلی:']),
        Utils.el('span', { class: 'ai-source-value' }, [t.title])
      ]),
      panel.panel,
      resultBox
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => { AI.abort(); Modal.close(); } }, ['بستن']),
      applyBtn
    ]);

    Modal.open({
      title: 'استانداردسازی با AI',
      icon: '🪄',
      size: 'lg',
      body,
      footer
    });

    let lastResult = null;
    let wasAborted = false;

    applyBtn.addEventListener('click', () => {
      if (!lastResult) return;
      AIStandardize.applyToDb(id, lastResult);
      State.loadAll();
      State.applyFilters();
      Events.renderList();
      Render.renderSidebarCounts();
      Toast.success('اطلاعات عنوان به‌روزرسانی شد ✅');
      Modal.close();
    });

    // شروع
    panel.setStatus('در حال دریافت…', 'loading');
    activeAbort = new AbortController();

    AIStandardize.standardizeOne(t.title, {
      signal: activeAbort.signal,
      onToken: (_, acc) => {
        panel.appendText(acc);
      }
    })
      .then((result) => {
        if (wasAborted) return;
        lastResult = result;
        panel.setStatus('انجام شد', 'done');
        // نمایش خلاصه
        resultBox.hidden = false;
        resultBox.innerHTML = '';
        const fields = [
          ['عنوان استاندارد', result.standard_title],
          ['عنوان فارسی', result.title_fa],
          ['نوع', CONFIG.TYPES[result.type] || result.type],
          ['سال شروع', result.year_start],
          ['سال پایان', result.year_end],
          ['فصل‌ها', result.seasons],
          ['قسمت‌ها', result.episodes],
          ['قسمت در فصل', result.episodes_per_season],
          ['کشور', result.country],
          ['زبان', result.language],
          ['ژانر', result.genre],
          ['وضعیت', result.status],
          ['سازنده', result.creators],
          ['بازیگران', result.main_cast],
          ['خلاصه', result.summary]
        ].filter(([, v]) => v != null && v !== '');

        fields.forEach(([k, v]) => {
          resultBox.appendChild(Utils.el('div', { class: 'ai-result-row' }, [
            Utils.el('span', { class: 'ai-result-key' }, [k + ':']),
            Utils.el('span', { class: 'ai-result-val' }, [String(v)])
          ]));
        });

        applyBtn.disabled = false;
      })
      .catch((err) => {
        if (wasAborted) return;
        panel.setStatus('خطا', 'error');
        panel.setContent(`<div class="ai-error">${Utils.esc(err.message)}</div>`);
      });
  }

  /* ============================================================
     استانداردسازی همه
     ============================================================ */
  function openStandardizeBatch() {
    if (!requireAI()) return;
    const titles = DB.getAllTitles();
    if (!titles.length) {
      Toast.warning('هیچ عنوانی برای استانداردسازی وجود ندارد');
      return;
    }

    const panel = createStreamPanel(`استانداردسازی ${Utils.toFa(titles.length)} عنوان`);
    const progressWrap = Utils.el('div', { class: 'ai-progress-wrap' }, [
      Utils.el('div', { class: 'ai-progress-bar' }, [
        Utils.el('div', { class: 'ai-progress-fill', style: { width: '0%' } })
      ]),
      Utils.el('div', { class: 'ai-progress-text' }, [`۰ از ${Utils.toFa(titles.length)}`])
    ]);
    const resultList = Utils.el('div', { class: 'ai-result-list' });

    const body = Utils.el('div', { class: 'ai-layout' }, [
      Utils.el('div', { class: 'alert alert-warn' }, [
        Utils.el('span', { class: 'alert-icon' }, ['⏳']),
        Utils.el('div', {}, [
          `این عملیات ${Utils.toFa(Math.ceil(titles.length / 5))} درخواست به AI ارسال می‌کند. `,
          'ممکن است چند دقیقه طول بکشد و از سهمیه‌ی رایگان مصرف کند.'
        ])
      ]),
      progressWrap,
      panel.panel,
      resultList
    ]);

    const startBtn = Utils.el('button', { class: 'btn btn-primary' }, ['▶ شروع']);
    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => { AI.abort(); Modal.close(); } }, ['بستن']),
      startBtn
    ]);

    Modal.open({
      title: 'استانداردسازی دسته‌جمعی',
      icon: '⚡',
      size: 'xl',
      body,
      footer
    });

    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      startBtn.innerHTML = '<span class="spinner"></span> در حال اجرا…';
      panel.setStatus('در حال پردازش…', 'loading');

      activeAbort = new AbortController();
      try {
        const results = await AIStandardize.standardizeBatch(titles, {
          signal: activeAbort.signal,
          onProgress: ({ done, total, results: current }) => {
            const pct = (done / total) * 100;
            progressWrap.querySelector('.ai-progress-fill').style.width = pct + '%';
            progressWrap.querySelector('.ai-progress-text').textContent =
              `${Utils.toFa(done)} از ${Utils.toFa(total)}`;

            // رندر نتیجه‌ی جدید
            const last = current[current.length - 1];
            if (last) {
              const row = Utils.el('div', { class: 'ai-result-item' }, [
                Utils.el('span', { class: 'ai-result-icon' }, [last._error ? '⚠️' : '✅']),
                Utils.el('span', { class: 'ai-result-orig' }, [last.original]),
                last._error
                  ? Utils.el('span', { class: 'ai-result-err' }, [last._error])
                  : Utils.el('span', { class: 'ai-result-new' }, [' → ' + (last.standard_title || ''))
              ]);
              resultList.prepend(row);
            }
            panel.setContent(renderMarkdown(`**پیشرفت:** ${Utils.toFa(done)} از ${Utils.toFa(total)} عنوان پردازش شد.`));
          }
        });

        panel.setStatus('پایان', 'done');

        // اعمال نتایج
        let applied = 0;
        results.forEach(r => {
          if (r && r._id && !r._error) {
            AIStandardize.applyToDb(r._id, r);
            applied++;
          }
        });

        State.loadAll();
        State.applyFilters();
        Events.renderList();
        Render.renderSidebarCounts();

        Toast.success(`${Utils.toFa(applied)} عنوان استاندارد شد`);
        panel.setContent(renderMarkdown(
          `## ✅ پایان\n\n- مجموع: **${Utils.toFa(titles.length)}**\n- موفق: **${Utils.toFa(applied)}**\n- خطا: **${Utils.toFa(titles.length - applied)}**`
        ));
        startBtn.innerHTML = '✅ پایان یافت';
      } catch (err) {
        panel.setStatus('خطا', 'error');
        panel.setContent(`<div class="ai-error">${Utils.esc(err.message)}</div>`);
        startBtn.disabled = false;
        startBtn.textContent = '🔄 تلاش مجدد';
      }
    });
  }

  /* ============================================================
     تحلیل سلیقه
     ============================================================ */
  function openAnalysis() {
    if (!requireAI()) return;

    const panel = createStreamPanel('تحلیل سلیقه‌ی شما');
    panel.setContent('<p class="ai-hint">برای شروع دکمه‌ی «تحلیل کن» را بزن.</p>');

    const kindPicker = Utils.el('div', { class: 'ai-kind-picker' }, [
      chip('both', '🎬 هر دو', true),
      chip('movie', '🎥 فقط فیلم'),
      chip('series', '📺 فقط سریال')
    ]);

    let selectedKind = 'both';
    kindPicker.querySelectorAll('.chip').forEach(c => {
      c.addEventListener('click', () => {
        kindPicker.querySelectorAll('.chip').forEach(x => x.classList.remove('is-on'));
        c.classList.add('is-on');
        selectedKind = c.dataset.kind;
      });
    });
    function chip(kind, label, on) {
      const c = Utils.el('button', { class: 'chip' + (on ? ' is-on' : ''), dataset: { kind } }, [label]);
      return c;
    }

    const body = Utils.el('div', { class: 'ai-layout' }, [
      Utils.el('div', { class: 'ai-section' }, [
        Utils.el('div', { class: 'ai-section-title' }, ['۱. تحلیل عمیق سلیقه']),
        Utils.el('div', { class: 'ai-section-actions' }, [
          Utils.el('button', {
            class: 'btn btn-soft btn-sm',
            id: 'ai-analyze-btn'
          }, ['🔍 تحلیل کن'])
        ])
      ]),
      panel.panel,
      Utils.el('div', { class: 'divider' }),
      Utils.el('div', { class: 'ai-section' }, [
        Utils.el('div', { class: 'ai-section-title' }, ['۲. پیشنهاد هوشمند']),
        Utils.el('div', { class: 'ai-section-desc' }, ['بر اساس تحلیل بالا، پیشنهاد شخصی‌سازی‌شده دریافت کن.']),
        kindPicker,
        Utils.el('button', {
          class: 'btn btn-soft btn-sm',
          id: 'ai-recommend-btn',
          style: { marginTop: '10px' }
        }, ['✨ پیشنهاد بده'])
      ])
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => { AI.abort(); Modal.close(); } }, ['بستن'])
    ]);

    Modal.open({
      title: 'تحلیل و پیشنهاد AI',
      icon: '🧠',
      size: 'xl',
      body,
      footer
    });

    const analyzeBtn = body.querySelector('#ai-analyze-btn');
    const recBtn = body.querySelector('#ai-recommend-btn');

    analyzeBtn.addEventListener('click', async () => {
      analyzeBtn.disabled = true;
      recBtn.disabled = true;
      panel.setStatus('در حال تحلیل…', 'loading');
      panel.setContent('');
      activeAbort = new AbortController();

      try {
        await AIAnalysis.analyze({
          signal: activeAbort.signal,
          onToken: (_, acc) => panel.appendText(acc)
        });
        panel.setStatus('تحلیل کامل شد', 'done');
      } catch (err) {
        panel.setStatus('خطا', 'error');
        panel.setContent(`<div class="ai-error">${Utils.esc(err.message)}</div>`);
      } finally {
        analyzeBtn.disabled = false;
        recBtn.disabled = false;
      }
    });

    recBtn.addEventListener('click', async () => {
      analyzeBtn.disabled = true;
      recBtn.disabled = true;
      panel.setStatus('در حال پیشنهاد…', 'loading');
      panel.setContent('');
      activeAbort = new AbortController();

      try {
        await AIAnalysis.recommend(selectedKind, {
          signal: activeAbort.signal,
          onToken: (_, acc) => panel.appendText(acc)
        });
        panel.setStatus('پیشنهاد آماده شد', 'done');
      } catch (err) {
        panel.setStatus('خطا', 'error');
        panel.setContent(`<div class="ai-error">${Utils.esc(err.message)}</div>`);
      } finally {
        analyzeBtn.disabled = false;
        recBtn.disabled = false;
      }
    });
  }

  function cleanup() {
    if (activeAbort) {
      try { activeAbort.abort(); } catch {}
      activeAbort = null;
    }
  }

  return {
    openStandardizeSingle,
    openStandardizeBatch,
    openAnalysis,
    renderMarkdown,
    cleanup
  };
})();