/* =========================================================
   رابط‌های کاربری AI (مودال‌ها)
   ========================================================= */
window.AIUI = (function () {

  let activeAbort = null;

  /* ---- رندر Markdown ---- */
  function renderMarkdown(text) {
    if (!text) return '';
    let html = Utils.esc(text);
    html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
      `<pre class="ai-code">${code.trim()}</pre>`);
    html = html.replace(/`([^`]+)`/g, '<code class="ai-inline">$1</code>');
    html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    html = html.replace(/(?<![*_\w])\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<![*_\w])_([^_\n]+)_(?!_)/g, '<em>$1</em>');
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/^\s*---+\s*$/gm, '<hr>');
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/(?:^|\n)((?:[-*] .+(?:\n|$))+)/g, (_, block) => {
      const items = block.trim().split('\n').map(l => l.replace(/^[-*]\s*/, ''));
      return '\n<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
    });
    html = html.replace(/(?:^|\n)((?:\d+\. .+(?:\n|$))+)/g, (_, block) => {
      const items = block.trim().split('\n').map(l => l.replace(/^\d+\.\s*/, ''));
      return '\n<ol>' + items.map(i => `<li>${i}</li>`).join('') + '</ol>';
    });
    html = html.split(/\n{2,}/).map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (/^<(h\d|ul|ol|pre|hr|blockquote|div)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('');
    return html;
  }

  /* ---- پنل استریم بدون چشمک ---- */
  function createStreamPanel(titleText) {
    const body = Utils.el('div', { class: 'ai-stream-body' });
    const contentEl = Utils.el('div', { class: 'ai-stream-content' });
    body.appendChild(contentEl);

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

    return { panel, body, setStatus, setContent, appendText };
  }

  /* ---- چک تنظیم بودن AI ---- */
  function requireAI() {
    if (window.AILog) {
      try { AILog.show(); } catch {}
      try { AILog.info('▸ بررسی تنظیمات AI…'); } catch {}
    }
    if (!AI.isConfigured()) {
      if (window.AILog) {
        try { AILog.error('✗ کلید OpenRouter تنظیم نشده است'); } catch {}
        try { AILog.meta('کلید را از تنظیمات (⚙) → «هوش مصنوعی» وارد کنید'); } catch {}
        try { AILog.scheduleAutoHide(); } catch {}
      }
      Toast.warning('ابتدا کلید OpenRouter را در تنظیمات وارد کن', {
        title: 'AI تنظیم نشده',
        action: { label: 'تنظیمات', onClick: () => Events.openSettings() }
      });
      return false;
    }
    if (window.AILog) { try { AILog.success('✓ کلید OpenRouter موجود است'); } catch {} }
    return true;
  }

  /* ============================================================
     کارت تحلیل داستان — سازگار با ساختار قدیم و جدید
     ============================================================ */
  function renderStoryAnalysis(container, sa, reason, category) {
    if (!sa && !reason) return;
    container.hidden = false;
    container.innerHTML = '';

    /* --- سازگاری با فیلدهای قدیم --- */
    const respectScore = sa?.respects_intelligence_score
      ?? (typeof sa?.respects_intelligence === 'number' ? sa.respects_intelligence : null);
    const respectEvidence = Array.isArray(sa?.respects_intelligence) ? sa.respects_intelligence : [];

    /* --- دلیل اصلی --- */
    if (reason) {
      container.appendChild(Utils.el('div', {
        class: 'story-reason',
        dataset: { cat: category }
      }, [
        Utils.el('div', { class: 'story-reason-label' }, ['چرا؟']),
        Utils.el('div', { class: 'story-reason-text' }, [reason])
      ]));
    }

    if (!sa) return;

    /* --- پیش‌درآمد توصیفی (فاز ۱) --- */
    if (sa.neutral_premise || sa.neutral_structure) {
      const box = Utils.el('div', { class: 'story-neutral' }, [
        Utils.el('div', { class: 'story-neutral-label' }, ['توصیف بی‌طرف']),
        sa.neutral_premise ? Utils.el('div', { class: 'story-neutral-row' }, [
          Utils.el('span', { class: 'story-neutral-k' }, ['داستان:']),
          Utils.el('span', { class: 'story-neutral-v' }, [sa.neutral_premise])
        ]) : null,
        sa.neutral_structure ? Utils.el('div', { class: 'story-neutral-row' }, [
          Utils.el('span', { class: 'story-neutral-k' }, ['ساختار:']),
          Utils.el('span', { class: 'story-neutral-v' }, [sa.neutral_structure])
        ]) : null
      ].filter(Boolean));
      container.appendChild(box);
    }

    /* --- امتیازها --- */
    const scores = [];
    if (sa.consistency_score != null) {
      scores.push(scoreBar('انسجام داستانی', sa.consistency_score, 'consistency'));
    }
    if (respectScore != null) {
      scores.push(scoreBar('احترام به هوش بیننده', respectScore, 'respect'));
    }
    if (sa.earns_ending_score != null) {
      scores.push(scoreBar('پایانِ به‌دست‌آمده', sa.earns_ending_score, 'earn'));
    }
    if (sa.gossip_score != null) {
      /* خاله‌زنکی: هرچه کمتر، بهتر — پس رنگ را معکوس می‌کنیم */
      scores.push(scoreBar('خاله‌زنکی', sa.gossip_score, 'gossip', true));
    }
    if (scores.length) {
      container.appendChild(Utils.el('div', { class: 'story-scores' }, scores));
    }

    /* --- کیفیت خاله‌زنکی --- */
    if (sa.gossip_quality && sa.gossip_quality !== 'absent') {
      const labels = {
        'used-well': '🟢 آگاهانه و ماهرانه به کار رفته',
        'used-lazily': '🔴 تنبلانه — به‌عنوان عصا برای پیشبرد پیرنگ',
        'mixed': '🟡 ترکیبی — هم استفاده‌ی خوب، هم ضعف'
      };
      if (labels[sa.gossip_quality]) {
        container.appendChild(Utils.el('div', {
          class: 'story-gossip-note',
          dataset: { kind: sa.gossip_quality }
        }, [
          Utils.el('span', { class: 'story-gossip-label' }, ['نوعِ خاله‌زنکی:']),
          Utils.el('span', {}, [labels[sa.gossip_quality]])
        ]));
      }
    }

    /* --- حکم --- */
    if (sa.verdict) {
      const vk = verdictKey(sa.verdict);
      container.appendChild(Utils.el('div', {
        class: 'story-verdict',
        dataset: { verdict: vk }
      }, [
        Utils.el('span', { class: 'story-verdict-icon' }, [verdictIcon(sa.verdict)]),
        Utils.el('div', {}, [
          Utils.el('div', { class: 'story-verdict-title' }, [sa.verdict]),
          sa.verdict_explanation
            ? Utils.el('div', { class: 'story-verdict-desc' }, [sa.verdict_explanation])
            : null
        ].filter(Boolean))
      ]));
    }

    /* --- لیست‌ها --- */
    const lists = [
      ['✨ نقاط قوت', sa.strengths, 'pos'],
      ['⚠️ نقاط ضعف', sa.weaknesses, 'neg'],
      ['🕳️ سوراخ‌های داستانی', sa.plot_holes, 'hole'],
      ['🤦 لحظاتی که بیننده احمق فرض شد', sa.assumed_stupidity, 'dumb'],
      ['🧠 لحظاتی که به هوش بیننده احترام گذاشته شد', respectEvidence, 'smart'],
      ['🎯 نتیجه‌هایی که به دست آمده', sa.earned_outcomes, 'earned'],
      ['💥 نتیجه‌هایی که تحمیل شده', sa.forced_outcomes, 'forced'],
      ['☕ شواهدِ خاله‌زنکی', sa.gossip_evidence, 'gossip']
    ];

    lists.forEach(([title, arr, kind]) => {
      if (!Array.isArray(arr) || !arr.length) return;
      container.appendChild(Utils.el('div', {
        class: 'story-list',
        dataset: { kind }
      }, [
        Utils.el('div', { class: 'story-list-title' }, [title]),
        Utils.el('ul', {}, arr.map(item =>
          Utils.el('li', {}, [String(item)])
        ))
      ]));
    });

    /* --- نگاه مقابل (ضدتعصب) --- */
    if (sa.counter_perspective && !/قابل توجهی وجود ندارد|وجود ندارد/i.test(sa.counter_perspective)) {
      container.appendChild(Utils.el('div', { class: 'story-counter' }, [
        Utils.el('div', { class: 'story-counter-label' }, ['⚖️ نگاه مقابل']),
        Utils.el('div', { class: 'story-counter-text' }, [sa.counter_perspective])
      ]));
    }

    /* --- تناقض با دسته‌بندی کاربر --- */
    if (sa.disagreement && !/همسو است|موافق/i.test(sa.disagreement)) {
      container.appendChild(Utils.el('div', { class: 'story-disagreement' }, [
        Utils.el('div', { class: 'story-disagreement-label' }, ['🤔 ناهم‌خوانی با دسته‌بندی']),
        Utils.el('div', { class: 'story-disagreement-text' }, [sa.disagreement])
      ]));
    }

    /* --- اطمینان --- */
    if (sa.confidence != null) {
      container.appendChild(Utils.el('div', { class: 'story-confidence' }, [
        Utils.el('span', { class: 'story-confidence-label' }, ['اطمینانِ تحلیل:']),
        Utils.el('span', { class: 'story-confidence-value' }, [
          Utils.toFa(Number(sa.confidence).toFixed(0)) + ' از ۱۰'
        ])
      ]));
    }
  }

  function scoreBar(label, value, kind, invert = false) {
    const v = Number(value);
    const pct = Math.max(0, Math.min(100, (v / 10) * 100));
    let color;
    if (invert) {
      /* خاله‌زنکی: کمتر = بهتر */
      color = v <= 3 ? 'good' : v <= 6 ? 'warn' : 'bad';
    } else {
      color = v >= 7 ? 'good' : v >= 4 ? 'warn' : 'bad';
    }
    return Utils.el('div', { class: 'score-row', dataset: { kind } }, [
      Utils.el('div', { class: 'score-label' }, [label]),
      Utils.el('div', { class: 'score-track' }, [
        Utils.el('div', {
          class: 'score-fill',
          dataset: { color },
          style: { width: '0%' },
          'data-pct': pct
        })
      ]),
      Utils.el('div', { class: 'score-num' }, [Utils.toFa(v.toFixed(1))])
    ]);
  }

  function verdictKey(v) {
    if (!v) return 'unknown';
    if (v.includes('همسو') && !v.includes('نسبتاً') && !v.includes('مغایر')) return 'match';
    if (v.includes('نسبتاً')) return 'partial';
    if (v.includes('مغایر')) return 'against';
    return 'unknown';
  }
  function verdictIcon(v) {
    const k = verdictKey(v);
    return { match: '✅', partial: '🟡', against: '❌', unknown: '❔' }[k];
  }

  /* ============================================================
     تحلیل یک عنوان
     ============================================================ */
  function openAnalyzeSingle(id) {
    if (!requireAI()) return;
    const t = DB.getTitle(id);
    if (!t) return;

    const panel = createStreamPanel(`تحلیل: ${t.title}`);
    const resultBox = Utils.el('div', { class: 'ai-result-box', hidden: true });
    const storyBox = Utils.el('div', { class: 'story-analysis-box', hidden: true });
    const applyBtn = Utils.el('button', {
      class: 'btn btn-primary', id: 'ai-apply-btn', disabled: true
    }, ['✅ اعمال روی دیتابیس']);

    const catLabel = CONFIG.CATEGORIES[t.category];

    const body = Utils.el('div', { class: 'ai-layout' }, [
      Utils.el('div', { class: 'ai-source' }, [
        Utils.el('span', { class: 'ai-source-label' }, ['عنوان:']),
        Utils.el('span', { class: 'ai-source-value' }, [t.title]),
        Utils.el('span', {
          class: 'cat-badge',
          dataset: { cat: t.category },
          style: { marginRight: '8px' }
        }, [`${catLabel.emoji} ${catLabel.label}`])
      ]),
      panel.panel,
      resultBox,
      storyBox
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => { AI.abort(); Modal.close(); } }, ['بستن']),
      applyBtn
    ]);

    Modal.open({
      title: 'استانداردسازی و تحلیل سه‌فازی',
      icon: '🔬',
      size: 'xl',
      body, footer
    });

    let lastResult = null;

    applyBtn.addEventListener('click', () => {
      if (!lastResult) return;
      AIStandardize.applyToDb(id, lastResult);
      State.loadAll(); State.applyFilters();
      Events.renderList(); Render.renderSidebarCounts();
      Toast.success('تحلیل ذخیره شد ✅');
      Modal.close();
    });

    panel.setStatus('در حال تحلیل…', 'loading');
    activeAbort = new AbortController();

    AIStandardize.analyzeOne(t.title, t.category, {
      signal: activeAbort.signal,
      onToken: (_, acc) => panel.appendText(acc)
    })
      .then((result) => {
        lastResult = result;
        panel.setStatus('انجام شد', 'done');
        resultBox.hidden = false;
        resultBox.innerHTML = '';
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
        ].filter(([, v]) => v != null && v !== '').forEach(([k, v]) => {
          resultBox.appendChild(Utils.el('div', { class: 'ai-result-row' }, [
            Utils.el('span', { class: 'ai-result-key' }, [k + ':']),
            Utils.el('span', { class: 'ai-result-val' }, [String(v)])
          ]));
        });

        /* --- ساخت ساختار story_analysis از پاسخ AI --- */
        const storyData = {
          neutral_premise: result.neutral_premise,
          neutral_structure: result.neutral_structure,
          consistency_score: result.consistency_score,
          respects_intelligence_score: result.respects_intelligence_score,
          earns_ending_score: result.earns_ending_score,
          gossip_score: result.gossip_score,
          gossip_quality: result.gossip_quality,
          confidence: result.confidence,
          strengths: result.strengths,
          weaknesses: result.weaknesses,
          plot_holes: result.plot_holes,
          assumed_stupidity: result.assumed_stupidity,
          respects_intelligence: result.respects_intelligence,
          earned_outcomes: result.earned_outcomes,
          forced_outcomes: result.forced_outcomes,
          gossip_evidence: result.gossip_evidence,
          counter_perspective: result.counter_perspective,
          disagreement: result.disagreement,
          verdict: result.verdict,
          verdict_explanation: result.verdict_explanation
        };
        /* نگه‌داشتن برای applyToDb */
        lastResult.story_analysis = storyData;

        storyBox.hidden = false;
        renderStoryAnalysis(storyBox, storyData, result.reason, t.category);
        setTimeout(() => {
          storyBox.querySelectorAll('.score-fill').forEach(f => {
            f.style.width = (f.dataset.pct || '0') + '%';
          });
        }, 60);

        applyBtn.disabled = false;
      })
      .catch((err) => {
        panel.setStatus('خطا', 'error');
        panel.setContent(`<div class="ai-error">${Utils.esc(err.message)}</div>`);
      });
  }

  /* ============================================================
     استانداردسازی سریع همه
     ============================================================ */
  function openStandardizeBatch() {
    if (!requireAI()) return;
    const titles = DB.getAllTitles();
    if (!titles.length) {
      if (window.AILog) { try { AILog.warn('⚠ هیچ عنوانی وجود ندارد'); AILog.scheduleAutoHide(); } catch {} }
      Toast.warning('هیچ عنوانی وجود ندارد');
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
        Utils.el('span', { class: 'alert-icon' }, ['⚡']),
        Utils.el('div', {}, [
          `این عملیات ${Utils.toFa(Math.ceil(titles.length / 5))} درخواست سریع می‌فرستد. `,
          'فقط داده‌های پایه را پر می‌کند — بدون تحلیل داستانی. ',
          'برای تحلیل عمیق، از دکمه 🪄 روی هر کارت استفاده کن.'
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

    Modal.open({ title: 'استانداردسازی سریع', icon: '⚡', size: 'xl', body, footer });

    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      startBtn.innerHTML = '<span class="spinner"></span> در حال اجرا…';
      panel.setStatus('در حال پردازش…', 'loading');
      if (window.AILog) { try { AILog.request(`▸ استانداردسازی سریع: ${titles.length} عنوان`); } catch {} }

      activeAbort = new AbortController();
      try {
        const results = await AIStandardize.standardizeBatch(titles, {
          signal: activeAbort.signal,
          onProgress: ({ done, total, results: current }) => {
            const pct = (done / total) * 100;
            progressWrap.querySelector('.ai-progress-fill').style.width = pct + '%';
            progressWrap.querySelector('.ai-progress-text').textContent =
              `${Utils.toFa(done)} از ${Utils.toFa(total)}`;
            if (window.AILog) { try { AILog.stream(`↓ ${done}/${total}`); } catch {} }

            const last = current[current.length - 1];
            if (last) {
              resultList.prepend(Utils.el('div', { class: 'ai-result-item' }, [
                Utils.el('span', { class: 'ai-result-icon' }, [last._error ? '⚠️' : '✅']),
                Utils.el('span', { class: 'ai-result-orig' }, [last.original]),
                last._error
                  ? Utils.el('span', { class: 'ai-result-err' }, [last._error])
                  : Utils.el('span', { class: 'ai-result-new' }, [' → ' + (last.standard_title || '')])
              ]));
            }
            panel.setContent(renderMarkdown(`**پیشرفت:** ${Utils.toFa(done)} از ${Utils.toFa(total)}`));
          }
        });

        panel.setStatus('پایان', 'done');

        let applied = 0;
        results.forEach(r => {
          if (r && r._id && !r._error) { AIStandardize.applyToDb(r._id, r); applied++; }
        });

        State.loadAll(); State.applyFilters();
        Events.renderList(); Render.renderSidebarCounts();

        if (window.AILog) {
          try { AILog.success(`✓ ${applied} از ${titles.length} استاندارد شد`); AILog.scheduleAutoHide(); } catch {}
        }
        Toast.success(`${Utils.toFa(applied)} عنوان استاندارد شد`);
        panel.setContent(renderMarkdown(
          `## ✅ پایان\n\n- مجموع: **${Utils.toFa(titles.length)}**\n- موفق: **${Utils.toFa(applied)}**`
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
     تحلیل سلیقه + پیشنهاد
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
      return Utils.el('button', { class: 'chip' + (on ? ' is-on' : ''), dataset: { kind } }, [label]);
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
        Utils.el('div', { class: 'ai-section-desc' }, ['بر اساس منشور سلیقه، پیشنهاد دقیق دریافت کن.']),
        kindPicker,
        Utils.el('button', {
          class: 'btn btn-soft btn-sm', id: 'ai-recommend-btn',
          style: { marginTop: '10px' }
        }, ['✨ پیشنهاد بده'])
      ])
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => { AI.abort(); Modal.close(); } }, ['بستن'])
    ]);

    Modal.open({ title: 'تحلیل و پیشنهاد AI', icon: '🧠', size: 'xl', body, footer });

    const analyzeBtn = body.querySelector('#ai-analyze-btn');
    const recBtn = body.querySelector('#ai-recommend-btn');

    analyzeBtn.addEventListener('click', async () => {
      analyzeBtn.disabled = true; recBtn.disabled = true;
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
        analyzeBtn.disabled = false; recBtn.disabled = false;
      }
    });

    recBtn.addEventListener('click', async () => {
      analyzeBtn.disabled = true; recBtn.disabled = true;
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
        analyzeBtn.disabled = false; recBtn.disabled = false;
      }
    });
  }

  function cleanup() {
    if (activeAbort) { try { activeAbort.abort(); } catch {} activeAbort = null; }
  }

  function showLog() {
    if (!window.AILog) return;
    AILog.show();
    AILog.info('▸ نمایش دستی لاگ');
    AILog.meta(`زمان: ${new Date().toLocaleString('fa-IR')}`);
    if (AI.isConfigured()) {
      AILog.success('✓ کلید OpenRouter تنظیم شده است');
      const k = AI.getKey();
      AILog.meta(`کلید: ${k.slice(0, 10)}…${k.slice(-4)}`);
    } else {
      AILog.warn('⚠ کلید OpenRouter تنظیم نشده است');
    }
    AILog.scheduleAutoHide();
  }

  return {
    openAnalyzeSingle,
    openStandardizeBatch,
    openAnalysis,
    renderMarkdown,
    renderStoryAnalysis,
    cleanup,
    showLog
  };
})();