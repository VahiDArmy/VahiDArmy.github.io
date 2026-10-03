/* =========================================================
   رابط‌های کاربری AI
   ========================================================= */
window.AIUI = (function () {

  let activeAbort = null;

  /* =========================================================
     Markdown renderer — با پشتیبانی کامل از جدول
     ========================================================= */
  function renderMarkdown(text) {
    if (!text) return '';
    let s = String(text);

    /* ۱. استخراج کد بلاک‌ها (قبل از هر پردازش) */
    const codeBlocks = [];
    s = s.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, function (_, lang, code) {
      const idx = codeBlocks.length;
      codeBlocks.push('<pre class="ai-code"><code>' + Utils.esc(code.replace(/\n$/, '')) + '</code></pre>');
      return '\u0001CB' + idx + '\u0001';
    });

    /* ۲. escape */
    s = Utils.esc(s);

    /* ۳. جدول‌ها — قبل از هر چیز دیگر */
    s = s.replace(
      /(?:^|\n)([ \t]*\|[^\n]*\|[ \t]*\n[ \t]*\|[ \t\-:|]+\|[ \t]*\n(?:[ \t]*\|[^\n]*\|[ \t]*(?:\n|$))*)/g,
      function (_, block) { return '\n\n' + parseMarkdownTable(block) + '\n\n'; }
    );

    /* ۴. هدینگ‌ها */
    s = s.replace(/^######[ \t]+(.+?)[ \t]*$/gm, '<h6>$1</h6>');
    s = s.replace(/^#####[ \t]+(.+?)[ \t]*$/gm, '<h5>$1</h5>');
    s = s.replace(/^####[ \t]+(.+?)[ \t]*$/gm, '<h4>$1</h4>');
    s = s.replace(/^###[ \t]+(.+?)[ \t]*$/gm, '<h3>$1</h3>');
    s = s.replace(/^##[ \t]+(.+?)[ \t]*$/gm, '<h2>$1</h2>');
    s = s.replace(/^#[ \t]+(.+?)[ \t]*$/gm, '<h1>$1</h1>');

    /* ۵. خط افقی */
    s = s.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, '<hr>');

    /* ۶. بلاک‌کوت */
    s = s.replace(/(?:^|\n)((?:&gt;[ \t]?[^\n]*(?:\n|$))+)/g, function (_, block) {
      const lines = block.trim().split('\n').map(function (l) {
        return l.replace(/^&gt;[ \t]?/, '');
      });
      return '\n<blockquote>' + lines.join('<br>') + '</blockquote>\n';
    });

    /* ۷. لیست‌های نامرتب */
    s = s.replace(/(?:^|\n)((?:[ \t]*[-*+][ \t]+[^\n]+(?:\n|$))+)/g, function (_, block) {
      const items = block.trim().split('\n').map(function (l) {
        return l.replace(/^[ \t]*[-*+][ \t]+/, '');
      });
      return '\n<ul>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>\n';
    });

    /* ۸. لیست‌های مرتب */
    s = s.replace(/(?:^|\n)((?:[ \t]*\d+\.[ \t]+[^\n]+(?:\n|$))+)/g, function (_, block) {
      const items = block.trim().split('\n').map(function (l) {
        return l.replace(/^[ \t]*\d+\.[ \t]+/, '');
      });
      return '\n<ol>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ol>\n';
    });

    /* ۹. بولد */
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');

    /* ۱۰. ایتالیک */
    s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    s = s.replace(/(?<![*_\w])_([^_\n]+)_(?!_)/g, '<em>$1</em>');

    /* ۱۱. خط‌خورده */
    s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

    /* ۱۲. کد اینلاین */
    s = s.replace(/`([^`\n]+)`/g, '<code class="ai-inline">$1</code>');

    /* ۱۳. لینک */
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    /* ۱۴. بازگردانی کد بلاک‌ها */
    s = s.replace(/\u0001CB(\d+)\u0001/g, function (_, idx) {
      return codeBlocks[Number(idx)] || '';
    });

    /* ۱۵. پاراگراف‌ها */
    s = s.split(/\n{2,}/).map(function (p) {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (/^<(h\d|ul|ol|pre|hr|blockquote|div|table|thead|tbody|tr|td|th|p)/i.test(trimmed)) {
        return trimmed;
      }
      return '<p>' + trimmed.replace(/\n/g, '<br>') + '</p>';
    }).join('');

    return s;
  }

  /* =========================================================
     پارسر جدول Markdown
     ========================================================= */
  function parseMarkdownTable(block) {
    const lines = block.trim().split('\n').filter(function (l) { return l.trim(); });
    if (lines.length < 2) return Utils.esc(block);

    function splitRow(line) {
      let l = line.trim();
      if (l.charAt(0) === '|') l = l.slice(1);
      if (l.charAt(l.length - 1) === '|') l = l.slice(0, -1);
      return l.split('|').map(function (c) { return c.trim(); });
    }

    function alignOf(sep) {
      const t = sep.trim();
      const left = t.charAt(0) === ':';
      const right = t.charAt(t.length - 1) === ':';
      if (left && right) return 'center';
      if (right) return 'left';   /* در RTL: تراز چپ یعنی انتهای خط */
      if (left) return 'right';
      return '';
    }

    const headerCells = splitRow(lines[0]);
    const sepCells = splitRow(lines[1]);
    const aligns = sepCells.map(alignOf);
    const bodyRows = lines.slice(2).map(splitRow);

    let html = '<table class="ai-table">';
    html += '<thead><tr>';
    headerCells.forEach(function (c, i) {
      const align = aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '';
      html += '<th' + align + '>' + c + '</th>';
    });
    html += '</tr></thead>';

    if (bodyRows.length) {
      html += '<tbody>';
      bodyRows.forEach(function (row) {
        html += '<tr>';
        for (let i = 0; i < headerCells.length; i++) {
          const align = aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '';
          html += '<td' + align + '>' + (row[i] != null ? row[i] : '') + '</td>';
        }
        html += '</tr>';
      });
      html += '</tbody>';
    }

    html += '</table>';
    return html;
  }

  /* =========================================================
     badge مدل
     ========================================================= */
  function buildModelBadge(info) {
    if (!info) return null;
    const children = [
      Utils.el('span', { class: 'ai-model-badge-icon' }, ['🪄']),
      Utils.el('span', { class: 'ai-model-badge-label' }, ['تولید شده با:']),
      Utils.el('span', { class: 'ai-model-badge-value' }, [info.label || info.id])
    ];
    if (info.vendor) children.push(Utils.el('span', { class: 'ai-model-badge-vendor' }, [info.vendor]));
    const speed = info.meta && info.meta.speed;
    if (speed && speed !== '—') children.push(Utils.el('span', { class: 'ai-model-badge-meta' }, ['⚡ ' + speed + ' t/s']));
    return Utils.el('div', { class: 'ai-model-badge' }, children);
  }

  function appendModelBadge(container, info) {
    if (!container) return;
    const data = info || (AI.getLastUsedModel && AI.getLastUsedModel());
    if (!data) return;
    const old = container.querySelector(':scope > .ai-model-badge');
    if (old) old.remove();
    const badge = buildModelBadge(data);
    if (badge) container.appendChild(badge);
  }

  /* =========================================================
     پنل استریم
     ========================================================= */
  function createStreamPanel(titleText) {
    const body = Utils.el('div', { class: 'ai-stream-body' });
    const contentEl = Utils.el('div', { class: 'ai-stream-content' });
    body.appendChild(contentEl);
    const status = Utils.el('div', { class: 'ai-stream-status' }, [
      Utils.el('span', { class: 'ai-status-dot' }),
      Utils.el('span', { class: 'ai-status-text' }, ['آماده'])
    ]);
    const foot = Utils.el('div', { class: 'ai-stream-foot', hidden: true });
    const panel = Utils.el('div', { class: 'ai-stream-panel' }, [
      Utils.el('div', { class: 'ai-stream-head' }, [
        Utils.el('div', { class: 'ai-stream-title' }, [titleText]),
        status
      ]),
      body, foot
    ]);

    let pendingText = '';
    let rafScheduled = false;
    let lastRendered = '';

    function flushRender() {
      rafScheduled = false;
      if (pendingText === lastRendered) return;
      const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 60;
      contentEl.innerHTML = renderMarkdown(pendingText);
      lastRendered = pendingText;
      if (atBottom) body.scrollTop = body.scrollHeight;
    }
    function appendText(acc) {
      pendingText = acc;
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(flushRender);
    }
    function setContent(html) {
      pendingText = '';
      lastRendered = '';
      contentEl.innerHTML = html;
      body.scrollTop = 0;
    }
    function setStatus(text, state) {
      status.querySelector('.ai-status-text').textContent = text;
      status.dataset.state = state || 'idle';
    }
    function setModelBadge() {
      const info = AI.getLastUsedModel && AI.getLastUsedModel();
      if (!info) return;
      foot.hidden = false;
      foot.innerHTML = '';
      const badge = buildModelBadge(info);
      if (badge) foot.appendChild(badge);
    }

    return { panel: panel, body: body, setStatus: setStatus, setContent: setContent, appendText: appendText, setModelBadge: setModelBadge };
  }

  function requireAI() {
    if (window.AILog) {
      try { AILog.show(); } catch (e) {}
      try { AILog.info('بررسی تنظیمات AI'); } catch (e) {}
    }
    if (!AI.isConfigured()) {
      if (window.AILog) {
        try { AILog.error('کلید OpenRouter تنظیم نشده'); AILog.scheduleAutoHide(); } catch (e) {}
      }
      Toast.warning('ابتدا کلید OpenRouter را در تنظیمات وارد کن', {
        title: 'AI تنظیم نشده',
        action: { label: 'تنظیمات', onClick: function () { Events.openSettings(); } }
      });
      return false;
    }
    return true;
  }

  /* =========================================================
     رندر تحلیل داستانی
     ========================================================= */
  function renderStoryAnalysis(container, sa, reason, rating) {
    if (!sa && !reason) return;
    container.hidden = false;
    container.innerHTML = '';

    if (reason) {
      container.appendChild(Utils.el('div', {
        class: 'story-reason', dataset: { stars: String(rating || 0) }
      }, [
        Utils.el('div', { class: 'story-reason-label' }, ['چرا؟']),
        Utils.el('div', { class: 'story-reason-text' }, [reason])
      ]));
    }

    if (!sa) return;

    if (Array.isArray(sa.plot_holes) && sa.plot_holes.length) {
      container.appendChild(renderStructuredList('🕳️ سوراخ‌های داستانی', 'hole', sa.plot_holes));
    }
    if (Array.isArray(sa.assumed_stupidity) && sa.assumed_stupidity.length) {
      container.appendChild(renderStructuredList('🤦 لحظاتی که بیننده احمق فرض شد', 'dumb', sa.assumed_stupidity));
    }

    const simpleLists = [
      ['✨ نقاط قوت', sa.strengths, 'pos'],
      ['⚠️ نقاط ضعف', sa.weaknesses, 'neg'],
      ['🎯 نتیجه‌های به‌دست‌آمده', sa.earned_outcomes, 'earned'],
      ['💥 نتیجه‌های تحمیل‌شده', sa.forced_outcomes, 'forced']
    ];
    simpleLists.forEach(function (item) {
      const title = item[0], arr = item[1], kind = item[2];
      if (!Array.isArray(arr) || !arr.length) return;
      if (typeof arr[0] !== 'string') return;
      container.appendChild(Utils.el('div', { class: 'story-list', dataset: { kind: kind } }, [
        Utils.el('div', { class: 'story-list-title' }, [title]),
        Utils.el('ul', {}, arr.map(function (x) { return Utils.el('li', {}, [String(x)]); }))
      ]));
    });

    if (sa.ai_model) {
      const badgeWrap = Utils.el('div', { class: 'story-model-wrap' });
      appendModelBadge(badgeWrap, sa.ai_model);
      container.appendChild(badgeWrap);
    }
  }

  function renderStructuredList(title, kind, items) {
    const wrap = Utils.el('div', { class: 'story-list story-list-structured', dataset: { kind: kind } });
    wrap.appendChild(Utils.el('div', { class: 'story-list-title' }, [title]));
    const list = Utils.el('div', { class: 'story-structured-list' });

    items.forEach(function (item, idx) {
      if (typeof item === 'string') {
        list.appendChild(Utils.el('div', { class: 'story-structured-item story-structured-item-plain' }, [
          Utils.el('span', { class: 'story-structured-num' }, [Utils.toFa(idx + 1)]),
          Utils.el('span', {}, [item])
        ]));
        return;
      }
      const sev = item.severity || '';
      const sevClass = severityClass(sev);
      const itemEl = Utils.el('div', { class: 'story-structured-item', dataset: { severity: sevClass } });

      const headChildren = [Utils.el('span', { class: 'story-structured-num' }, [Utils.toFa(idx + 1)])];
      if (item.location) headChildren.push(Utils.el('span', { class: 'story-structured-loc' }, [item.location]));
      if (sev) headChildren.push(Utils.el('span', { class: 'story-structured-sev', dataset: { level: sevClass } }, [sev]));
      if (item.type) headChildren.push(Utils.el('span', { class: 'story-structured-type' }, [item.type]));
      itemEl.appendChild(Utils.el('div', { class: 'story-structured-head' }, headChildren));

      if (item.scene) itemEl.appendChild(row('صحنه:', item.scene));
      if (item.rule_broken) itemEl.appendChild(row('قاعده شکسته:', item.rule_broken));
      if (item.technique) itemEl.appendChild(row('تکنیک نویسنده:', item.technique));
      const mainIssue = item.issue || item.what_happened;
      if (mainIssue) itemEl.appendChild(row(item.issue ? 'مشکل:' : 'اتفاق:', mainIssue));
      const why = item.why || item.why_assumes_stupidity;
      if (why) itemEl.appendChild(row(item.why ? 'چرا سوراخ است:' : 'چرا احمق‌فرض‌گیری است:', why));
      if (item.cascade) itemEl.appendChild(row('اثر زنجیره‌ای:', item.cascade));

      list.appendChild(itemEl);
    });

    wrap.appendChild(list);
    return wrap;
  }

  function row(k, v) {
    return Utils.el('div', { class: 'story-structured-row' }, [
      Utils.el('span', { class: 'story-structured-k' }, [k]),
      Utils.el('span', { class: 'story-structured-v' }, [v])
    ]);
  }

  function severityClass(sev) {
    if (!sev) return 'unknown';
    if (sev.indexOf('بحرانی') > -1) return 'critical';
    if (sev.indexOf('جدی') > -1) return 'serious';
    if (sev.indexOf('متوسط') > -1) return 'medium';
    if (sev.indexOf('کم') > -1) return 'low';
    return 'unknown';
  }

  /* =========================================================
     تحلیل یک عنوان
     ========================================================= */
  function openAnalyzeSingle(id) {
    if (!requireAI()) return;
    const t = DB.getTitle(id);
    if (!t) return;

    const panel = createStreamPanel('تحلیل: ' + t.title);
    const resultBox = Utils.el('div', { class: 'ai-result-box', hidden: true });
    const storyBox = Utils.el('div', { class: 'story-analysis-box', hidden: true });
    const deepBtnWrap = Utils.el('div', { class: 'ai-deep-wrap', hidden: true });
    const applyBtn = Utils.el('button', { class: 'btn btn-primary', id: 'ai-apply-btn', disabled: true }, ['✅ اعمال روی دیتابیس']);

    const rating = Math.floor(Number(t.rating) || 0);
    const starMeta = CONFIG.STARS[rating];

    const body = Utils.el('div', { class: 'ai-layout' }, [
      Utils.el('div', { class: 'ai-source' }, [
        Utils.el('span', { class: 'ai-source-label' }, ['عنوان:']),
        Utils.el('span', { class: 'ai-source-value' }, [t.title]),
        starMeta && rating > 0
          ? Utils.el('span', { class: 'badge', style: { marginRight: '8px', color: starMeta.color } }, [starMeta.emoji + ' ' + starMeta.label])
          : Utils.el('span', { class: 'badge', style: { marginRight: '8px' } }, ['○ بدون امتیاز'])
      ]),
      Utils.el('div', { class: 'ai-source-std' }, ['ارسال به AI: ' + AIPrompts.standardLine(t.title, t.type, t.year, t)]),
      panel.panel, resultBox, storyBox, deepBtnWrap
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: function () { AI.abort(); Modal.close(); } }, ['بستن']),
      applyBtn
    ]);

    Modal.open({ title: 'تحلیل داستانی', icon: '🔬', size: 'xl', body: body, footer: footer });

    let lastResult = null;

    applyBtn.addEventListener('click', function () {
      if (!lastResult) return;
      AIStandardize.applyToDb(id, lastResult);
      State.loadAll(); State.applyFilters();
      Events.renderList(); Render.renderSidebarCounts();
      Toast.success('تحلیل ذخیره شد ✅');
      Modal.close();
    });

    panel.setStatus('در حال تحلیل…', 'loading');
    activeAbort = new AbortController();

    AIStandardize.analyzeOne(t.title, t.type, t.year, {
      meta: t,
      signal: activeAbort.signal,
      onToken: function (_, acc) { panel.appendText(acc); }
    })
      .then(function (result) {
        lastResult = result;
        panel.setStatus('انجام شد', 'done');
        panel.setModelBadge();

        resultBox.hidden = false;
        resultBox.innerHTML = '';
        const fix = AIStandardize.titleFix(t, result);
        if (fix.kind !== 'ok') {
          resultBox.appendChild(Utils.el('div', { class: 'ai-title-fix is-' + fix.kind }, [
            fix.kind === 'fixed'
              ? '✏️ تصحیح عنوان: «' + fix.from + '» ← «' + fix.to + '» (هنگام ذخیرهٔ تحلیل اعمال می‌شود)'
              : '⚠️ عنوان دقیقاً شناسایی نشد و تغییر نمی‌کند' + (fix.candidates.length ? ' — گزینه‌های محتمل: ' + fix.candidates.join(' · ') : '') + '. عنوان را اصلاح و دوباره تحلیل کنید.'
          ]));
        }
        [
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
        ].forEach(function (pair) {
          if (pair[1] == null || pair[1] === '') return;
          resultBox.appendChild(Utils.el('div', { class: 'ai-result-row' }, [
            Utils.el('span', { class: 'ai-result-key' }, [pair[0] + ':']),
            Utils.el('span', { class: 'ai-result-val' }, [String(pair[1])])
          ]));
        });

        const storyData = {
          strengths: result.strengths,
          weaknesses: result.weaknesses,
          plot_holes: result.plot_holes || [],
          assumed_stupidity: result.assumed_stupidity || [],
          earned_outcomes: result.earned_outcomes,
          forced_outcomes: result.forced_outcomes,
          ai_model: AI.getLastUsedModel ? AI.getLastUsedModel() : null,
          analyzed_at: new Date().toISOString()
        };
        lastResult.story_analysis = storyData;

        storyBox.hidden = false;
        renderStoryAnalysis(storyBox, storyData, result.reason, rating);

        const seasons = Number(result.seasons) || 0;
        if (seasons > 3) {
          deepBtnWrap.hidden = false;
          deepBtnWrap.innerHTML = '';
          deepBtnWrap.appendChild(Utils.el('div', { class: 'ai-deep-card' }, [
            Utils.el('div', { class: 'ai-deep-icon' }, ['🔬']),
            Utils.el('div', { class: 'ai-deep-info' }, [
              Utils.el('div', { class: 'ai-deep-title' }, ['این سریال ' + Utils.toFa(seasons) + ' فصل دارد']),
              Utils.el('div', { class: 'ai-deep-desc' }, ['تحلیل فصل به فصل برای شکار کامل سوراخ‌ها.'])
            ]),
            Utils.el('button', {
              class: 'btn btn-primary', id: 'btn-deep-analyze',
              onclick: function () { openSeasonalDeep(id, t.title, seasons, t.type, result.year_start); }
            }, ['🔬 تحلیل عمیق فصل به فصل'])
          ]));
        }

        applyBtn.disabled = false;
      })
      .catch(function (err) {
        panel.setStatus('خطا', 'error');
        panel.setContent('<div class="ai-error">' + Utils.esc(err.message) + '</div>');
      });
  }

  function openSeasonalDeep(id, title, seasonsCount, type, year) {
    const chunkCount = Math.ceil(seasonsCount / 3);
    const progressBox = Utils.el('div', { class: 'ai-deep-progress' });
    const logBox = Utils.el('div', { class: 'ai-deep-log' });
    const resultBox = Utils.el('div', { class: 'ai-deep-result', hidden: true });
    const startBtn = Utils.el('button', { class: 'btn btn-primary', id: 'btn-start-deep' }, ['▶ شروع']);

    const body = Utils.el('div', { class: 'ai-layout' }, [
      Utils.el('div', { class: 'ai-deep-info-box' }, [
        Utils.el('div', {}, ['سریال «' + title + '» به ' + Utils.toFa(chunkCount) + ' گروه تقسیم می‌شود:']),
        Utils.el('ul', { class: 'ai-deep-chunks' },
          Array.from({ length: chunkCount }, function (_, i) {
            const from = i * 3 + 1;
            const to = Math.min(from + 2, seasonsCount);
            return Utils.el('li', {}, ['فصل ' + Utils.toFa(from) + ' تا ' + Utils.toFa(to)]);
          })
        )
      ]),
      progressBox, logBox, resultBox
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: function () { AI.abort(); Modal.close(); } }, ['بستن']),
      startBtn
    ]);

    Modal.open({ title: 'تحلیل عمیق فصل به فصل', icon: '🔬', size: 'xl', body: body, footer: footer });

    startBtn.addEventListener('click', async function () {
      startBtn.disabled = true;
      startBtn.innerHTML = '<span class="spinner"></span> در حال اجرا…';

      const progressBar = Utils.el('div', { class: 'ai-deep-bar' }, [
        Utils.el('div', { class: 'ai-deep-bar-fill', style: { width: '0%' } })
      ]);
      const progressText = Utils.el('div', { class: 'ai-deep-bar-text' }, ['۰ از ' + Utils.toFa(chunkCount)]);
      progressBox.innerHTML = '';
      progressBox.appendChild(progressBar);
      progressBox.appendChild(progressText);
      logBox.innerHTML = '';

      activeAbort = new AbortController();

      try {
        const result = await AIStandardize.analyzeSeasonalDeep(title, seasonsCount, {
          type: type, year: year, meta: DB.getTitle(id),
          signal: activeAbort.signal,
          onProgress: function (info) {
            if (info.phase === 'start') {
              logBox.prepend(Utils.el('div', { class: 'ai-deep-log-line', dataset: { state: 'start' } }, ['⏳ فصل ' + Utils.toFa(info.fromSeason) + '-' + Utils.toFa(info.toSeason)]));
            } else if (info.phase === 'done') {
              const ph = (info.partial && info.partial.plot_holes && info.partial.plot_holes.length) || 0;
              const as = (info.partial && info.partial.assumed_stupidity && info.partial.assumed_stupidity.length) || 0;
              logBox.prepend(Utils.el('div', { class: 'ai-deep-log-line', dataset: { state: 'done' } }, ['✅ فصل ' + Utils.toFa(info.fromSeason) + '-' + Utils.toFa(info.toSeason) + ' — ' + Utils.toFa(ph) + ' سوراخ، ' + Utils.toFa(as) + ' احمق‌فرض']));
            } else if (info.phase === 'error') {
              logBox.prepend(Utils.el('div', { class: 'ai-deep-log-line', dataset: { state: 'error' } }, ['✗ خطا: ' + info.error]));
            }
            const pct = (info.current / info.total) * 100;
            progressBar.querySelector('.ai-deep-bar-fill').style.width = pct + '%';
            progressText.textContent = Utils.toFa(info.current) + ' از ' + Utils.toFa(info.total);
          }
        });

        AIStandardize.applyDeepToDb(id, result);

        resultBox.hidden = false;
        resultBox.innerHTML = '';
        resultBox.appendChild(Utils.el('div', { class: 'ai-deep-summary' }, [
          Utils.el('div', { class: 'ai-deep-summary-title' }, ['✅ تحلیل عمیق کامل شد']),
          Utils.el('div', { class: 'ai-deep-summary-stats' }, [
            Utils.el('span', {}, ['🕳️ ' + Utils.toFa(result.plot_holes.length) + ' سوراخ داستانی']),
            Utils.el('span', {}, ['🤦 ' + Utils.toFa(result.assumed_stupidity.length) + ' احمق‌فرض‌گیری'])
          ])
        ]));

        const storyBox = Utils.el('div', { class: 'story-analysis-box' });
        const cur = DB.getTitle(id);
        renderStoryAnalysis(storyBox, {
          plot_holes: result.plot_holes,
          assumed_stupidity: result.assumed_stupidity,
          ai_model: AI.getLastUsedModel ? AI.getLastUsedModel() : null
        }, null, cur ? Math.floor(cur.rating || 0) : 0);
        resultBox.appendChild(storyBox);

        State.loadAll(); State.applyFilters();
        Events.renderList(); Render.renderSidebarCounts();

        Toast.success('تحلیل عمیق ذخیره شد ✅');
        startBtn.innerHTML = '✅ پایان یافت';
      } catch (err) {
        logBox.prepend(Utils.el('div', { class: 'ai-deep-log-line', dataset: { state: 'error' } }, ['✗ خطا: ' + err.message]));
        startBtn.disabled = false;
        startBtn.textContent = '🔄 تلاش مجدد';
      }
    });
  }

  function openStandardizeBatch() {
    if (!requireAI()) return;
    const titles = DB.getAllTitles();
    if (!titles.length) { Toast.warning('هیچ عنوانی وجود ندارد'); return; }

    const panel = createStreamPanel('استانداردسازی ' + Utils.toFa(titles.length) + ' عنوان');
    const progressWrap = Utils.el('div', { class: 'ai-progress-wrap' }, [
      Utils.el('div', { class: 'ai-progress-bar' }, [
        Utils.el('div', { class: 'ai-progress-fill', style: { width: '0%' } })
      ]),
      Utils.el('div', { class: 'ai-progress-text' }, ['۰ از ' + Utils.toFa(titles.length)])
    ]);
    const resultList = Utils.el('div', { class: 'ai-result-list' });

    const body = Utils.el('div', { class: 'ai-layout' }, [
      Utils.el('div', { class: 'alert alert-warn' }, [
        Utils.el('span', { class: 'alert-icon' }, ['⚡']),
        Utils.el('div', {}, ['این عملیات ' + Utils.toFa(Math.ceil(titles.length / 5)) + ' درخواست سریع می‌فرستد.'])
      ]),
      progressWrap, panel.panel, resultList
    ]);

    const startBtn = Utils.el('button', { class: 'btn btn-primary' }, ['▶ شروع']);
    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: function () { AI.abort(); Modal.close(); } }, ['بستن']),
      startBtn
    ]);

    Modal.open({ title: 'استانداردسازی سریع', icon: '⚡', size: 'xl', body: body, footer: footer });

    startBtn.addEventListener('click', async function () {
      startBtn.disabled = true;
      startBtn.innerHTML = '<span class="spinner"></span> در حال اجرا…';
      panel.setStatus('در حال پردازش…', 'loading');
      activeAbort = new AbortController();
      try {
        const results = await AIStandardize.standardizeBatch(titles, {
          signal: activeAbort.signal,
          onProgress: function (info) {
            const pct = (info.done / info.total) * 100;
            progressWrap.querySelector('.ai-progress-fill').style.width = pct + '%';
            progressWrap.querySelector('.ai-progress-text').textContent = Utils.toFa(info.done) + ' از ' + Utils.toFa(info.total);
            const last = info.results[info.results.length - 1];
            if (last) {
              resultList.prepend(Utils.el('div', { class: 'ai-result-item' }, [
                Utils.el('span', { class: 'ai-result-icon' }, [last._error ? '⚠️' : '✅']),
                Utils.el('span', { class: 'ai-result-orig' }, [last.original]),
                last._error ? Utils.el('span', { class: 'ai-result-err' }, [last._error])
                  : Utils.el('span', { class: 'ai-result-new' }, [' → ' + (last.standard_title || '')])
              ]));
            }
            panel.setContent(renderMarkdown('**پیشرفت:** ' + Utils.toFa(info.done) + ' از ' + Utils.toFa(info.total)));
          }
        });

        panel.setStatus('پایان', 'done');
        panel.setModelBadge();

        let applied = 0;
        results.forEach(function (r) {
          if (r && r._id && !r._error) { AIStandardize.applyToDb(r._id, r); applied++; }
        });

        State.loadAll(); State.applyFilters();
        Events.renderList(); Render.renderSidebarCounts();

        Toast.success(Utils.toFa(applied) + ' عنوان استاندارد شد');
        panel.setContent(renderMarkdown('## ✅ پایان\n\n- مجموع: **' + Utils.toFa(titles.length) + '**\n- موفق: **' + Utils.toFa(applied) + '**'));
        startBtn.innerHTML = '✅ پایان یافت';
      } catch (err) {
        panel.setStatus('خطا', 'error');
        panel.setContent('<div class="ai-error">' + Utils.esc(err.message) + '</div>');
        startBtn.disabled = false;
        startBtn.textContent = '🔄 تلاش مجدد';
      }
    });
  }

  function openAnalysis() {
    if (!requireAI()) return;
    const panel = createStreamPanel('تحلیل سلیقه');
    panel.setContent('<p class="ai-hint">برای شروع دکمه را بزن.</p>');

    const kindPicker = Utils.el('div', { class: 'ai-kind-picker' }, [
      chip('both', '🎬 هر دو', true),
      chip('movie', '🎥 فقط فیلم'),
      chip('series', '📺 فقط سریال')
    ]);
    let selectedKind = 'both';
    kindPicker.querySelectorAll('.chip').forEach(function (c) {
      c.addEventListener('click', function () {
        kindPicker.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('is-on'); });
        c.classList.add('is-on');
        selectedKind = c.dataset.kind;
      });
    });
    function chip(kind, label, on) {
      return Utils.el('button', { class: 'chip' + (on ? ' is-on' : ''), dataset: { kind: kind } }, [label]);
    }

    const body = Utils.el('div', { class: 'ai-layout' }, [
      Utils.el('div', { class: 'ai-section' }, [
        Utils.el('div', { class: 'ai-section-title' }, ['۱. تحلیل عمیق سلیقه']),
        Utils.el('div', { class: 'ai-section-actions' }, [
          Utils.el('button', { class: 'btn btn-soft btn-sm', id: 'ai-analyze-btn' }, ['🔍 تحلیل کن'])
        ])
      ]),
      panel.panel,
      Utils.el('div', { class: 'divider' }),
      Utils.el('div', { class: 'ai-section' }, [
        Utils.el('div', { class: 'ai-section-title' }, ['۲. پیشنهاد هوشمند']),
        Utils.el('div', { class: 'ai-section-desc' }, ['بر اساس معیارهای سلیقه، پیشنهاد دقیق دریافت کن.']),
        kindPicker,
        Utils.el('button', { class: 'btn btn-soft btn-sm', id: 'ai-recommend-btn', style: { marginTop: '10px' } }, ['✨ پیشنهاد بده'])
      ])
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: function () { AI.abort(); Modal.close(); } }, ['بستن'])
    ]);

    Modal.open({ title: 'تحلیل و پیشنهاد AI', icon: '🧠', size: 'xl', body: body, footer: footer });

    const analyzeBtn = body.querySelector('#ai-analyze-btn');
    const recBtn = body.querySelector('#ai-recommend-btn');

    analyzeBtn.addEventListener('click', async function () {
      analyzeBtn.disabled = true; recBtn.disabled = true;
      panel.setStatus('در حال تحلیل…', 'loading');
      panel.setContent('');
      activeAbort = new AbortController();
      try {
        await AIAnalysis.analyze({
          signal: activeAbort.signal,
          onToken: function (_, acc) { panel.appendText(acc); }
        });
        panel.setStatus('تحلیل کامل شد', 'done');
        panel.setModelBadge();
      } catch (err) {
        panel.setStatus('خطا', 'error');
        panel.setContent('<div class="ai-error">' + Utils.esc(err.message) + '</div>');
      } finally { analyzeBtn.disabled = false; recBtn.disabled = false; }
    });

    recBtn.addEventListener('click', async function () {
      analyzeBtn.disabled = true; recBtn.disabled = true;
      panel.setStatus('در حال پیشنهاد…', 'loading');
      panel.setContent('');
      activeAbort = new AbortController();
      try {
        await AIAnalysis.recommend(selectedKind, {
          signal: activeAbort.signal,
          onToken: function (_, acc) { panel.appendText(acc); }
        });
        panel.setStatus('پیشنهاد آماده شد', 'done');
        panel.setModelBadge();
      } catch (err) {
        panel.setStatus('خطا', 'error');
        panel.setContent('<div class="ai-error">' + Utils.esc(err.message) + '</div>');
      } finally { analyzeBtn.disabled = false; recBtn.disabled = false; }
    });
  }

  function openTitleLookup(form, titleInput) {
    if (!requireAI()) return;
    const rawTitle = titleInput.value.trim();
    if (!rawTitle) {
      Toast.warning('اول عنوان را وارد کن');
      titleInput.focus();
      return;
    }

    const streamBox = Utils.el('div', { class: 'lookup-status' }, [
      Utils.el('span', { class: 'spinner' }),
      Utils.el('span', {}, ['در حال جستجو…'])
    ]);
    const resultBox = Utils.el('div', { class: 'lookup-results' });

    const body = Utils.el('div', { class: 'lookup-body' }, [
      Utils.el('div', { class: 'lookup-query' }, [
        Utils.el('span', { class: 'lookup-query-label' }, ['جستجو برای:']),
        Utils.el('span', { class: 'lookup-query-value' }, [rawTitle])
      ]),
      streamBox, resultBox
    ]);

    Modal.open({
      title: 'جستجوی هوشمند عنوان',
      icon: '🔍', size: 'lg', body: body,
      footer: Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
        Utils.el('button', { class: 'btn btn-ghost', onclick: function () { Modal.close(); } }, ['بستن'])
      ])
    });

    activeAbort = new AbortController();

    AITitleLookup.lookup(rawTitle, { signal: activeAbort.signal })
      .then(function (result) {
        streamBox.remove();

        if (result.corrected_query && result.corrected_query !== rawTitle) {
          resultBox.appendChild(Utils.el('div', { class: 'lookup-corrected' }, [
            Utils.el('span', {}, ['دیکته تصحیح‌شده: ']),
            Utils.el('strong', {}, [result.corrected_query])
          ]));
        }

        if (!result.candidates || !result.candidates.length) {
          resultBox.appendChild(Utils.el('div', { class: 'lookup-empty' }, [
            Utils.el('div', { class: 'lookup-empty-icon' }, ['😕']),
            Utils.el('div', { class: 'lookup-empty-text' }, ['هیچ نسخه‌ای پیدا نشد.'])
          ]));
          return;
        }

        const list = Utils.el('div', { class: 'lookup-list' });
        result.candidates.forEach(function (c) {
          const card = buildCandidateCard(c, function () {
            AITitleLookup.fillForm(form, c);
            Modal.close();
            Toast.success('اطلاعات عنوان پر شد');
            titleInput.focus();
          });
          list.appendChild(card);
        });

        resultBox.appendChild(Utils.el('div', { class: 'lookup-result-title' }, [
          Utils.toFa(result.candidates.length) + ' نسخه پیدا شد — یکی را انتخاب کن:'
        ]));
        resultBox.appendChild(list);
      })
      .catch(function (err) {
        streamBox.remove();
        resultBox.appendChild(Utils.el('div', { class: 'lookup-error' }, ['خطا: ' + Utils.esc(err.message)]));
      });
  }

  function buildCandidateCard(c, onPick) {
    const conf = Number(c.confidence) || 0;
    const confClass = conf >= 8 ? 'high' : conf >= 5 ? 'mid' : 'low';

    return Utils.el('button', {
      type: 'button', class: 'lookup-card', onclick: onPick
    }, [
      Utils.el('div', { class: 'lookup-card-head' }, [
        Utils.el('div', { class: 'lookup-card-title' }, [
          Utils.el('span', { class: 'lookup-card-standard' }, [c.standard_title || '—']),
          c.version_label ? Utils.el('span', { class: 'lookup-card-version' }, [c.version_label]) : null
        ].filter(Boolean)),
        Utils.el('div', { class: 'lookup-card-meta' }, [
          c.type ? Utils.el('span', { class: 'lookup-meta-item' }, [CONFIG.TYPES[c.type] || c.type]) : null,
          c.year_start ? Utils.el('span', { class: 'lookup-meta-item' }, [Utils.toFa(c.year_start)]) : null,
          c.country ? Utils.el('span', { class: 'lookup-meta-item' }, [c.country]) : null
        ].filter(Boolean))
      ]),
      c.title_fa ? Utils.el('div', { class: 'lookup-card-fa' }, [c.title_fa]) : null,
      c.summary ? Utils.el('div', { class: 'lookup-card-summary' }, [c.summary]) : null,
      Utils.el('div', { class: 'lookup-card-foot' }, [
        c.creators ? Utils.el('span', { class: 'lookup-card-creators' }, ['سازنده: ' + c.creators]) : Utils.el('span', {}, ['']),
        Utils.el('span', { class: 'lookup-card-conf', dataset: { level: confClass } }, ['● ' + Utils.toFa(conf) + '/۱۰'])
      ])
    ].filter(Boolean));
  }

  function cleanup() {
    if (activeAbort) { try { activeAbort.abort(); } catch (e) {} activeAbort = null; }
  }

  function showLog() {
    if (!window.AILog) return;
    AILog.show();
    AILog.info('نمایش دستی لاگ');
    AILog.scheduleAutoHide();
  }

  return {
    openAnalyzeSingle: openAnalyzeSingle,
    openSeasonalDeep: openSeasonalDeep,
    openStandardizeBatch: openStandardizeBatch,
    openAnalysis: openAnalysis,
    openTitleLookup: openTitleLookup,
    renderMarkdown: renderMarkdown,
    renderStoryAnalysis: renderStoryAnalysis,
    cleanup: cleanup,
    showLog: showLog
  };
})();