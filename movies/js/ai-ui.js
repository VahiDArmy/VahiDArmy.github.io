/* =========================================================
   رابط‌های کاربری AI
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

  /* ============================================================
     badge مدل
     ============================================================ */
  function buildModelBadge(info) {
    if (!info) return null;

    const children = [
      Utils.el('span', { class: 'ai-model-badge-icon' }, ['🪄']),
      Utils.el('span', { class: 'ai-model-badge-label' }, ['تولید شده با:']),
      Utils.el('span', { class: 'ai-model-badge-value' }, [info.label || info.id])
    ];

    if (info.vendor) {
      children.push(Utils.el('span', { class: 'ai-model-badge-vendor' }, [info.vendor]));
    }

    const speed = info.meta && info.meta.speed;
    if (speed && speed !== '—') {
      children.push(Utils.el('span', { class: 'ai-model-badge-meta' }, ['⚡ ' + speed + ' t/s']));
    }

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

  /* ---- پنل استریم ---- */
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
      body,
      foot
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

    return { panel, body, setStatus, setContent, appendText, setModelBadge };
  }

  function requireAI() {
    if (window.AILog) {
      try { AILog.show(); } catch {}
      try { AILog.info('▸ بررسی تنظیمات AI…'); } catch {}
    }
    if (!AI.isConfigured()) {
      if (window.AILog) {
        try { AILog.error('✗ کلید OpenRouter تنظیم نشده است'); } catch {}
        try { AILog.meta('کلید را از تنظیمات (⚙) وارد کنید'); } catch {}
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
     رندر تحلیل داستانی — با badge مدل در انتها
     ============================================================ */
  function renderStoryAnalysis(container, sa, reason, category) {
    if (!sa && !reason) return;
    container.hidden = false;
    container.innerHTML = '';

    /* ---- چرا؟ ---- */
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

    /* ---- سوراخ‌های داستانی ---- */
    if (Array.isArray(sa.plot_holes) && sa.plot_holes.length) {
      container.appendChild(renderStructuredList({
        title: '🕳️ سوراخ‌های داستانی',
        kind: 'hole',
        items: sa.plot_holes
      }));
    }

    /* ---- احمق فرض کردن بیننده ---- */
    if (Array.isArray(sa.assumed_stupidity) && sa.assumed_stupidity.length) {
      container.appendChild(renderStructuredList({
        title: '🤦 لحظاتی که بیننده احمق فرض شد',
        kind: 'dumb',
        items: sa.assumed_stupidity
      }));
    }

    /* ---- لیست‌های ساده ---- */
    const simpleLists = [
      ['✨ نقاط قوت', sa.strengths, 'pos'],
      ['⚠️ نقاط ضعف', sa.weaknesses, 'neg'],
      ['🎯 نتیجه‌هایی که به دست آمده', sa.earned_outcomes, 'earned'],
      ['💥 نتیجه‌هایی که تحمیل شده', sa.forced_outcomes, 'forced']
    ];

    simpleLists.forEach(([title, arr, kind]) => {
      if (!Array.isArray(arr) || !arr.length) return;
      if (typeof arr[0] !== 'string') return;
      container.appendChild(Utils.el('div', {
        class: 'story-list',
        dataset: { kind }
      }, [
        Utils.el('div', { class: 'story-list-title' }, [title]),
        Utils.el('ul', {}, arr.map(item => Utils.el('li', {}, [String(item)])))
      ]));
    });

    /* ---- badge مدل در انتها (فقط یک‌بار) ---- */
    const modelInfo = sa.ai_model || null;
    if (modelInfo) {
      const badgeWrap = Utils.el('div', { class: 'story-model-wrap' });
      appendModelBadge(badgeWrap, modelInfo);
      container.appendChild(badgeWrap);
    }
  }

  /* ============================================================
     لیست ساختاریافته — با فیلدهای جدید عمیق
     ============================================================ */
  function renderStructuredList({ title, kind, items }) {
    const wrap = Utils.el('div', {
      class: 'story-list story-list-structured',
      dataset: { kind }
    });

    wrap.appendChild(Utils.el('div', { class: 'story-list-title' }, [title]));

    const list = Utils.el('div', { class: 'story-structured-list' });

    items.forEach((item, idx) => {
      if (typeof item === 'string') {
        list.appendChild(Utils.el('div', { class: 'story-structured-item story-structured-item-plain' }, [
          Utils.el('span', { class: 'story-structured-num' }, [Utils.toFa(idx + 1)]),
          Utils.el('span', {}, [item])
        ]));
        return;
      }

      const sev = item.severity || '';
      const sevClass = severityClass(sev);

      const itemEl = Utils.el('div', {
        class: 'story-structured-item',
        dataset: { severity: sevClass }
      });

      /* سر آیتم: شماره + مکان + شدت + نوع */
      const head = Utils.el('div', { class: 'story-structured-head' }, [
        Utils.el('span', { class: 'story-structured-num' }, [Utils.toFa(idx + 1)]),
        item.location
          ? Utils.el('span', { class: 'story-structured-loc' }, [item.location])
          : null,
        sev
          ? Utils.el('span', { class: 'story-structured-sev', dataset: { level: sevClass } }, [sev])
          : null,
        item.type
          ? Utils.el('span', { class: 'story-structured-type' }, [item.type])
          : null
      ].filter(Boolean));
      itemEl.appendChild(head);

      /* ---- صحنه ---- */
      if (item.scene) {
        itemEl.appendChild(Utils.el('div', { class: 'story-structured-row' }, [
          Utils.el('span', { class: 'story-structured-k' }, ['صحنه:']),
          Utils.el('span', { class: 'story-structured-v' }, [item.scene])
        ]));
      }

      /* ---- قاعده‌ی شکسته (فقط برای plot_hole) ---- */
      if (item.rule_broken) {
        itemEl.appendChild(Utils.el('div', { class: 'story-structured-row' }, [
          Utils.el('span', { class: 'story-structured-k' }, ['قاعده‌ی شکسته:']),
          Utils.el('span', { class: 'story-structured-v' }, [item.rule_broken])
        ]));
      }

      /* ---- تکنیک نویسنده (فقط برای assumed_stupidity) ---- */
      if (item.technique) {
        itemEl.appendChild(Utils.el('div', { class: 'story-structured-row' }, [
          Utils.el('span', { class: 'story-structured-k' }, ['تکنیک نویسنده:']),
          Utils.el('span', { class: 'story-structured-v' }, [item.technique])
        ]));
      }

      /* ---- مشکل / اتفاق ---- */
      const mainIssue = item.issue || item.what_happened;
      if (mainIssue) {
        itemEl.appendChild(Utils.el('div', { class: 'story-structured-row' }, [
          Utils.el('span', { class: 'story-structured-k' }, [
            item.issue ? 'مشکل:' : 'اتفاق:'
          ]),
          Utils.el('span', { class: 'story-structured-v' }, [mainIssue])
        ]));
      }

      /* ---- چرا ---- */
      const why = item.why || item.why_assumes_stupidity;
      if (why) {
        itemEl.appendChild(Utils.el('div', { class: 'story-structured-row' }, [
          Utils.el('span', { class: 'story-structured-k' }, [
            item.why ? 'چرا سوراخ است:' : 'چرا احمق‌فرض‌گیری است:'
          ]),
          Utils.el('span', { class: 'story-structured-v' }, [why])
        ]));
      }

      /* ---- زنجیره‌ی اثر ---- */
      if (item.cascade) {
        itemEl.appendChild(Utils.el('div', { class: 'story-structured-row' }, [
          Utils.el('span', { class: 'story-structured-k' }, ['اثر زنجیره‌ای:']),
          Utils.el('span', { class: 'story-structured-v' }, [item.cascade])
        ]));
      }

      list.appendChild(itemEl);
    });

    wrap.appendChild(list);
    return wrap;
  }

  function severityClass(sev) {
    if (!sev) return 'unknown';
    if (sev.includes('بحرانی')) return 'critical';
    if (sev.includes('جدی')) return 'serious';
    if (sev.includes('متوسط')) return 'medium';
    if (sev.includes('کم')) return 'low';
    return 'unknown';
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
    const deepBtnWrap = Utils.el('div', { class: 'ai-deep-wrap', hidden: true });
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
      storyBox,
      deepBtnWrap
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => { AI.abort(); Modal.close(); } }, ['بستن']),
      applyBtn
    ]);

    Modal.open({
      title: 'تحلیل داستانی و شکار سوراخ‌ها',
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
        panel.setModelBadge();

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
        renderStoryAnalysis(storyBox, storyData, result.reason, t.category);

        const seasons = Number(result.seasons) || 0;
        if (seasons > 3) {
          deepBtnWrap.hidden = false;
          deepBtnWrap.innerHTML = '';
          deepBtnWrap.appendChild(Utils.el('div', { class: 'ai-deep-card' }, [
            Utils.el('div', { class: 'ai-deep-icon' }, ['🔬']),
            Utils.el('div', { class: 'ai-deep-info' }, [
              Utils.el('div', { class: 'ai-deep-title' }, [
                `این سریال ${Utils.toFa(seasons)} فصل دارد`
              ]),
              Utils.el('div', { class: 'ai-deep-desc' }, [
                'تحلیل فعلی ممکن است همه‌ی قسمت‌ها را عمیق پوشش نداده باشد. ',
                'برای شکار کامل سوراخ‌ها و لحظات احمق‌فرض‌گیری، تحلیل فصل به فصل اجرا کن.'
              ])
            ]),
            Utils.el('button', {
              class: 'btn btn-primary',
              id: 'btn-deep-analyze',
              onclick: () => openSeasonalDeep(id, t.title, seasons, storyData)
            }, ['🔬 شروع تحلیل عمیق فصل به فصل'])
          ]));
        }

        applyBtn.disabled = false;
      })
      .catch((err) => {
        panel.setStatus('خطا', 'error');
        panel.setContent(`<div class="ai-error">${Utils.esc(err.message)}</div>`);
      });
  }

  /* ============================================================
     تحلیل عمیق فصل به فصل
     ============================================================ */
  function openSeasonalDeep(id, title, seasonsCount, existingStory) {
    const chunkCount = Math.ceil(seasonsCount / 3);
    const progressBox = Utils.el('div', { class: 'ai-deep-progress' });
    const logBox = Utils.el('div', { class: 'ai-deep-log' });
    const resultBox = Utils.el('div', { class: 'ai-deep-result', hidden: true });
    const startBtn = Utils.el('button', { class: 'btn btn-primary', id: 'btn-start-deep' }, ['▶ شروع']);

    const body = Utils.el('div', { class: 'ai-layout' }, [
      Utils.el('div', { class: 'ai-deep-info-box' }, [
        Utils.el('div', {}, [
          `سریال «${title}» به ${Utils.toFa(chunkCount)} گروه تقسیم می‌شود:`
        ]),
        Utils.el('ul', { class: 'ai-deep-chunks' },
          Array.from({ length: chunkCount }, (_, i) => {
            const from = i * 3 + 1;
            const to = Math.min(from + 2, seasonsCount);
            return Utils.el('li', {}, [`فصل ${Utils.toFa(from)} تا ${Utils.toFa(to)}`]);
          })
        )
      ]),
      progressBox,
      logBox,
      resultBox
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => { AI.abort(); Modal.close(); } }, ['بستن']),
      startBtn
    ]);

    Modal.open({
      title: 'تحلیل عمیق فصل به فصل',
      icon: '🔬',
      size: 'xl',
      body, footer
    });

    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      startBtn.innerHTML = '<span class="spinner"></span> در حال اجرا…';

      if (window.AILog) {
        try {
          AILog.show();
          AILog.request(`▸ شروع تحلیل عمیق: ${title}`);
          AILog.meta(`${chunkCount} گروه فصل`);
        } catch {}
      }

      const progressBar = Utils.el('div', { class: 'ai-deep-bar' }, [
        Utils.el('div', { class: 'ai-deep-bar-fill', style: { width: '0%' } })
      ]);
      const progressText = Utils.el('div', { class: 'ai-deep-bar-text' }, [`۰ از ${Utils.toFa(chunkCount)}`]);
      progressBox.innerHTML = '';
      progressBox.appendChild(progressBar);
      progressBox.appendChild(progressText);
      logBox.innerHTML = '';

      activeAbort = new AbortController();

      try {
        const result = await AIStandardize.analyzeSeasonalDeep(
          title,
          seasonsCount,
          {
            signal: activeAbort.signal,
            onProgress: ({ current, total, fromSeason, toSeason, phase, partial, error }) => {
              if (phase === 'start') {
                logBox.prepend(Utils.el('div', { class: 'ai-deep-log-line', dataset: { state: 'start' } }, [
                  `⏳ فصل ${Utils.toFa(fromSeason)}-${Utils.toFa(toSeason)} — شروع`
                ]));
              } else if (phase === 'done') {
                const ph = partial?.plot_holes?.length || 0;
                const as = partial?.assumed_stupidity?.length || 0;
                logBox.prepend(Utils.el('div', { class: 'ai-deep-log-line', dataset: { state: 'done' } }, [
                  `✅ فصل ${Utils.toFa(fromSeason)}-${Utils.toFa(toSeason)} — ${Utils.toFa(ph)} سوراخ، ${Utils.toFa(as)} احمق‌فرض`
                ]));
              } else if (phase === 'error') {
                logBox.prepend(Utils.el('div', { class: 'ai-deep-log-line', dataset: { state: 'error' } }, [
                  `✗ فصل ${Utils.toFa(fromSeason)}-${Utils.toFa(toSeason)} — ${error}`
                ]));
              }
              const pct = (current / total) * 100;
              progressBar.querySelector('.ai-deep-bar-fill').style.width = pct + '%';
              progressText.textContent = `${Utils.toFa(current)} از ${Utils.toFa(total)}`;
            }
          }
        );

        AIStandardize.applyDeepToDb(id, result);

        resultBox.hidden = false;
        resultBox.innerHTML = '';
        resultBox.appendChild(Utils.el('div', { class: 'ai-deep-summary' }, [
          Utils.el('div', { class: 'ai-deep-summary-title' }, ['✅ تحلیل عمیق کامل شد']),
          Utils.el('div', { class: 'ai-deep-summary-stats' }, [
            Utils.el('span', {}, [`🕳️ ${Utils.toFa(result.plot_holes.length)} سوراخ داستانی`]),
            Utils.el('span', {}, [`🤦 ${Utils.toFa(result.assumed_stupidity.length)} احمق‌فرض‌گیری`])
          ])
        ]));

        const storyBox = Utils.el('div', { class: 'story-analysis-box' });
        renderStoryAnalysis(storyBox, {
          plot_holes: result.plot_holes,
          assumed_stupidity: result.assumed_stupidity,
          ai_model: AI.getLastUsedModel ? AI.getLastUsedModel() : null
        }, null, DB.getTitle(id)?.category);
        resultBox.appendChild(storyBox);

        State.loadAll(); State.applyFilters();
        Events.renderList(); Render.renderSidebarCounts();

        if (window.AILog) {
          try {
            AILog.success(`✓ تحلیل عمیق کامل — ${result.plot_holes.length} سوراخ، ${result.assumed_stupidity.length} احمق‌فرض`);
            AILog.scheduleAutoHide();
          } catch {}
        }

        Toast.success('تحلیل عمیق ذخیره شد ✅');
        startBtn.innerHTML = '✅ پایان یافت';
      } catch (err) {
        logBox.prepend(Utils.el('div', { class: 'ai-deep-log-line', dataset: { state: 'error' } }, [
          `✗ خطا: ${err.message}`
        ]));
        startBtn.disabled = false;
        startBtn.textContent = '🔄 تلاش مجدد';
        if (window.AILog) {
          try { AILog.error(`✗ ${err.message}`); AILog.scheduleAutoHide(); } catch {}
        }
      }
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
    const badgeBox = Utils.el('div', { class: 'ai-result-badge-wrap', hidden: true });

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
      resultList,
      badgeBox
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

      activeAbort = new AbortController();
      try {
        const results = await AIStandardize.standardizeBatch(titles, {
          signal: activeAbort.signal,
          onProgress: ({ done, total, results: current }) => {
            const pct = (done / total) * 100;
            progressWrap.querySelector('.ai-progress-fill').style.width = pct + '%';
            progressWrap.querySelector('.ai-progress-text').textContent =
              `${Utils.toFa(done)} از ${Utils.toFa(total)}`;

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
        panel.setModelBadge();

        let applied = 0;
        results.forEach(r => {
          if (r && r._id && !r._error) { AIStandardize.applyToDb(r._id, r); applied++; }
        });

        State.loadAll(); State.applyFilters();
        Events.renderList(); Render.renderSidebarCounts();

        badgeBox.hidden = false;
        badgeBox.innerHTML = '';
        appendModelBadge(badgeBox);

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
        Utils.el('div', { class: 'ai-section-desc' }, ['بر اساس معیارهای سلیقه، پیشنهاد دقیق دریافت کن.']),
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
        panel.setModelBadge();
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
        panel.setModelBadge();
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
    openSeasonalDeep,
    openStandardizeBatch,
    openAnalysis,
    renderMarkdown,
    renderStoryAnalysis,
    cleanup,
    showLog
  };
})();