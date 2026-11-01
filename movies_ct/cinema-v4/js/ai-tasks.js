/* =========================================================
   وظایف AI — هر وظیفه یک تنظیمات برای AIReview می‌سازد:
   پرامپت ← اجرا روی مدلِ داده‌شده ← نمایش ← (پذیرش) اعمال روی دیتابیس
   ========================================================= */
window.AITasks = (function () {

  const TEMP = { standardize: 0.1, batch: 0.2, lookup: 0.2, analyze: 0.3, taste: 0.55, suggest: 0.6, free: 0.7 };

  /* ---------------- کمک‌ها ---------------- */
  function notifyTitlesChanged() { window.dispatchEvent(new CustomEvent('titles:changed')); }

  function modelStamp(model) { return model ? { id: model.id, label: model.label, vendor: model.vendor || '' } : null; }

  function normalizeType(t) {
    if (!t) return null;
    const s = String(t).toLowerCase();
    if (s.indexOf('seri') > -1 || s === 'tv') return 'series';
    if (s.indexOf('movie') > -1 || s.indexOf('film') > -1) return 'movie';
    if (s.indexOf('anime') > -1) return 'anime';
    if (s.indexOf('doc') > -1) return 'documentary';
    return 'series';
  }

  /* اجرای یک پیام روی مدل جاری و گرفتن JSON؛ اگر قابل‌تفسیر نبود خطا (= مدل بعدی) */
  async function askJSON(ctx, messages, temperature, live) {
    const raw = await AI.stream({
      model: ctx.model.id, messages: AI.withJsonHint(messages), temperature: temperature,
      signal: ctx.signal, onToken: live ? ctx.onToken : null
    });
    const ex = AI.extractJsonAndText(raw);
    if (!ex.parsed || typeof ex.parsed !== 'object') throw new Error('پاسخ مدل قابل تفسیر نبود (JSON نامعتبر)');
    return ex;
  }

  /* سطرهای متادیتا برای نمایش */
  function metaBox(r) {
    const box = Utils.el('div', { class: 'ai-result-box' });
    [
      ['عنوان استاندارد', r.standard_title], ['عنوان فارسی', r.title_fa],
      ['نوع', CONFIG.TYPES[r.type] || r.type], ['سال شروع', r.year_start], ['سال پایان', r.year_end],
      ['فصل‌ها', r.seasons], ['قسمت‌ها', r.episodes], ['قسمت در فصل', r.episodes_per_season],
      ['کشور', r.country], ['زبان', r.language], ['ژانر', r.genre], ['وضعیت', r.status],
      ['سازنده', r.creators], ['بازیگران', r.main_cast], ['خلاصه', r.summary]
    ].forEach(function (p) {
      if (AIRender.isEmptyValue(p[1])) return;
      box.appendChild(Utils.el('div', { class: 'ai-result-row' }, [
        Utils.el('span', { class: 'ai-result-key' }, [p[0] + ':']),
        Utils.el('span', { class: 'ai-result-val' }, [AIRender.valueToText(p[1])])
      ]));
    });
    return box;
  }

  /* =========================================================
     ذخیره روی دیتابیس
     ========================================================= */
  function standardPatch(cur, m) {
    return {
      type: normalizeType(m.type) || cur.type,
      genre: m.genre || cur.genre,
      summary: m.summary || cur.summary || '',
      original_title: m.standard_title || cur.original_title || '',
      seasons: m.seasons != null ? m.seasons : cur.seasons,
      episodes: m.episodes != null ? m.episodes : cur.episodes,
      episodes_per_season: m.episodes_per_season != null ? m.episodes_per_season : cur.episodes_per_season,
      country: m.country || cur.country || '',
      language: m.language || cur.language || '',
      status: m.status || cur.status || '',
      ai_standardized_at: new Date().toISOString()
    };
  }

  /* فقط متادیتا — امتیاز، سال، دلیل و یادداشت کاربر دست‌نخورده می‌مانند */
  function applyStandard(id, meta) {
    const cur = DB.getTitle(id);
    if (!cur || !meta) return;
    DB.updateTitle(id, standardPatch(cur, meta), false);
    DB.logActivity('ai_standardize', 'title', id, cur.title);
  }

  function applyAnalysis(id, ai, model) {
    const cur = DB.getTitle(id);
    if (!cur || !ai) return;
    const old = cur.story_analysis || {};
    const story = {
      strengths: ai.strengths || old.strengths || [],
      weaknesses: ai.weaknesses || old.weaknesses || [],
      plot_holes: ai.plot_holes || old.plot_holes || [],
      assumed_stupidity: ai.assumed_stupidity || old.assumed_stupidity || [],
      earned_outcomes: ai.earned_outcomes || old.earned_outcomes || [],
      forced_outcomes: ai.forced_outcomes || old.forced_outcomes || [],
      ai_model: modelStamp(model) || old.ai_model || null,
      analyzed_at: new Date().toISOString()
    };
    const patch = standardPatch(cur, ai);
    patch.reason = ai.reason || cur.reason || '';
    patch.story_analysis = story;
    DB.updateTitle(id, patch, false);
    DB.logActivity('ai_analyze', 'title', id, cur.title);
  }

  function applyDeep(id, deep, model) {
    const cur = DB.getTitle(id);
    if (!cur || !deep) return;
    const old = cur.story_analysis || {};
    DB.updateTitle(id, {
      story_analysis: Object.assign({}, old, {
        plot_holes: deep.plot_holes, assumed_stupidity: deep.assumed_stupidity,
        ai_model: modelStamp(model) || old.ai_model || null, deep_analyzed_at: new Date().toISOString()
      })
    }, false);
    DB.logActivity('ai_deep_analyze', 'title', id, cur.title);
  }

  /* =========================================================
     استانداردسازی یک عنوان
     ========================================================= */
  function openStandardize(id) {
    const t = DB.getTitle(id);
    if (!t) return;
    AIReview.open({
      title: 'استانداردسازی: ' + t.title, icon: '✨', size: 'lg', live: 'raw',
      header: Utils.el('div', { class: 'alert alert-info' }, [
        Utils.el('span', { class: 'alert-icon' }, ['🪄']),
        Utils.el('div', {}, ['فقط متادیتا (عنوان، فصل‌ها، کشور و …) به‌روز می‌شود. امتیاز، دلیل و یادداشت تو دست‌نخورده می‌ماند.'])
      ]),
      run: async function (ctx) {
        const ex = await askJSON(ctx, [
          { role: 'system', content: AIPrompts.standardizeSingleSystem },
          { role: 'user', content: AIPrompts.standardizeUser(t.title, t.type, t.year, t) }
        ], TEMP.standardize, true);
        return Array.isArray(ex.parsed) ? ex.parsed[0] || {} : ex.parsed;
      },
      render: function (box, r) { box.appendChild(metaBox(r)); },
      acceptLabel: '✅ بپذیر و ذخیره کن',
      onAccept: function (r) { applyStandard(id, r); notifyTitlesChanged(); Toast.success('اطلاعات ذخیره شد'); }
    });
  }

  /* =========================================================
     تحلیل کامل داستانی
     ========================================================= */
  function openAnalyze(id) {
    const t = DB.getTitle(id);
    if (!t) return;
    const rating = Math.floor(Number(t.rating) || 0);
    const star = CONFIG.STARS[rating];

    AIReview.open({
      title: 'تحلیل داستانی: ' + t.title, icon: '🔬', size: 'xl', live: 'raw',
      header: Utils.el('div', { class: 'ai-layout' }, [
        Utils.el('div', { class: 'ai-source' }, [
          Utils.el('span', { class: 'ai-source-label' }, ['عنوان:']),
          Utils.el('span', { class: 'ai-source-value' }, [t.title]),
          Utils.el('span', { class: 'badge', style: { marginInlineStart: '8px', color: star && rating ? star.color : '' } },
            [rating && star ? star.emoji + ' ' + star.label : '○ بدون امتیاز'])
        ]),
        Utils.el('div', { class: 'ai-source-std' }, ['ارسال به AI: ' + AIPrompts.standardLine(t.title, t.type, t.year, t)])
      ]),
      run: async function (ctx) {
        const ex = await askJSON(ctx, [
          { role: 'system', content: AIPrompts.analyzeSystem },
          { role: 'user', content: AIPrompts.analyzeUser(t.title, t.type, t.year, t) }
        ], TEMP.analyze, true);
        return { data: ex.parsed, before: ex.before, after: ex.after };
      },
      render: function (box, v, api) {
        const r = v.data;
        const prose = [v.before, v.after].filter(function (x) { return x && x.trim(); });
        if (prose.length) {
          box.appendChild(Utils.el('div', { class: 'ai-prose-box', html: prose.map(function (p) { return AIRender.renderMarkdown(p); }).join('<hr class="ai-prose-hr">') }));
        }
        box.appendChild(metaBox(r));
        const story = Utils.el('div', { class: 'story-analysis-box' });
        AIRender.renderStoryAnalysis(story, {
          strengths: r.strengths, weaknesses: r.weaknesses, plot_holes: r.plot_holes || [],
          assumed_stupidity: r.assumed_stupidity || [], earned_outcomes: r.earned_outcomes,
          forced_outcomes: r.forced_outcomes, ai_model: modelStamp(api.model)
        }, r.reason, rating);
        box.appendChild(story);
        const extras = AIRender.buildExtrasBox(r);
        if (extras) box.appendChild(extras);
      },
      acceptLabel: '✅ بپذیر و روی دیتابیس اعمال کن',
      onAccept: function (v, model) {
        applyAnalysis(id, v.data, model);
        notifyTitlesChanged();
        const seasons = Number(v.data.seasons) || 0;
        if (seasons > CONFIG.AI.SEASON_CHUNK) {
          Toast.show('تحلیل ذخیره شد. این سریال ' + Utils.toFa(seasons) + ' فصل دارد.', 'success', {
            duration: 9000,
            action: { label: '🔬 تحلیل عمیق فصل‌به‌فصل', onClick: function () { openDeep(id, seasons); } }
          });
        } else Toast.success('تحلیل ذخیره شد');
      }
    });
  }

  /* =========================================================
     تحلیل عمیق فصل‌به‌فصل
     ========================================================= */
  function openDeep(id, seasonsCount) {
    const t = DB.getTitle(id);
    if (!t) return;
    seasonsCount = seasonsCount || Number(t.seasons) || 0;
    if (seasonsCount < 1) { Toast.warning('تعداد فصل‌ها مشخص نیست — اول استانداردسازی کن'); return; }

    const chunks = [];
    for (let s = 1; s <= seasonsCount; s += CONFIG.AI.SEASON_CHUNK) chunks.push([s, Math.min(s + CONFIG.AI.SEASON_CHUNK - 1, seasonsCount)]);
    const order = { 'بحرانی': 0, 'جدی': 1, 'متوسط': 2, 'کم': 3 };
    const bySev = function (a, b) { return (order[a.severity] == null ? 99 : order[a.severity]) - (order[b.severity] == null ? 99 : order[b.severity]); };

    AIReview.open({
      title: 'تحلیل عمیق: ' + t.title, icon: '🔬', size: 'xl', live: 'none',
      header: Utils.el('div', { class: 'alert alert-warn' }, [
        Utils.el('span', { class: 'alert-icon' }, ['⚡']),
        Utils.el('div', {}, ['این کار در ' + Utils.toFa(chunks.length) + ' درخواست پشت‌سرهم (هر ' + Utils.toFa(CONFIG.AI.SEASON_CHUNK) + ' فصل) انجام می‌شود.'])
      ]),
      run: async function (ctx) {
        const holes = [], dumb = [];
        let okChunks = 0, lastErr = null;
        for (let i = 0; i < chunks.length; i++) {
          const c = chunks[i];
          ctx.progress('فصل ' + Utils.toFa(c[0]) + ' تا ' + Utils.toFa(c[1]) + ' — ' + Utils.toFa(i + 1) + ' از ' + Utils.toFa(chunks.length), (i / chunks.length) * 100);
          try {
            const ex = await askJSON(ctx, [
              { role: 'system', content: AIPrompts.analyzeSystem },
              { role: 'user', content: AIPrompts.analyzeDeepUser(t.title, c[0], c[1], t.type, t.year, t) }
            ], TEMP.analyze, false);
            const tag = c[0] + '-' + c[1];
            (ex.parsed.plot_holes || []).forEach(function (x) { holes.push(Object.assign({}, x, { _seasons: tag })); });
            (ex.parsed.assumed_stupidity || []).forEach(function (x) { dumb.push(Object.assign({}, x, { _seasons: tag })); });
            okChunks++;
          } catch (e) {
            if (e.name === 'AbortError') throw e;
            lastErr = e;
          }
        }
        if (!okChunks) throw lastErr || new Error('هیچ بازه‌ای تحلیل نشد');
        ctx.progress('پایان', 100);
        return { plot_holes: holes.sort(bySev), assumed_stupidity: dumb.sort(bySev), okChunks: okChunks, total: chunks.length };
      },
      render: function (box, v, api) {
        box.appendChild(Utils.el('div', { class: 'ai-deep-summary' }, [
          Utils.el('div', { class: 'ai-deep-summary-title' }, ['بازه‌های موفق: ' + Utils.toFa(v.okChunks) + ' از ' + Utils.toFa(v.total)]),
          Utils.el('div', { class: 'ai-deep-summary-stats' }, [
            Utils.el('span', {}, ['🕳️ ' + Utils.toFa(v.plot_holes.length) + ' سوراخ داستانی']),
            Utils.el('span', {}, ['🤦 ' + Utils.toFa(v.assumed_stupidity.length) + ' احمق‌فرض‌گیری'])
          ])
        ]));
        const story = Utils.el('div', { class: 'story-analysis-box' });
        AIRender.renderStoryAnalysis(story, { plot_holes: v.plot_holes, assumed_stupidity: v.assumed_stupidity, ai_model: modelStamp(api.model) }, null, Math.floor(t.rating || 0));
        box.appendChild(story);
      },
      acceptLabel: '✅ بپذیر و ذخیره کن',
      onAccept: function (v, model) { applyDeep(id, v, model); notifyTitlesChanged(); Toast.success('تحلیل عمیق ذخیره شد'); }
    });
  }

  /* =========================================================
     استانداردسازی دسته‌ای
     ========================================================= */
  function openBatch(titles) {
    if (!titles || !titles.length) { Toast.warning('عنوانی برای استانداردسازی نیست'); return; }
    const size = CONFIG.AI.BATCH_SIZE;

    AIReview.open({
      title: 'استانداردسازی ' + Utils.toFa(titles.length) + ' عنوان', icon: '⚡', size: 'xl', live: 'none',
      header: Utils.el('div', { class: 'alert alert-warn' }, [
        Utils.el('span', { class: 'alert-icon' }, ['⚡']),
        Utils.el('div', {}, [Utils.toFa(Math.ceil(titles.length / size)) + ' درخواست؛ اگر مدل کاملاً شکست بخورد مدل تصادفی بعدی جایگزین می‌شود. اگر فقط بعضی عنوان‌ها خطا بدهند، همان‌ها دست‌نخورده می‌مانند.'])
      ]),
      run: async function (ctx) {
        const results = [];
        let ok = 0, lastErr = null;
        for (let i = 0; i < titles.length; i += size) {
          const batch = titles.slice(i, i + size);
          ctx.progress(Utils.toFa(Math.min(i + size, titles.length)) + ' از ' + Utils.toFa(titles.length), (i / titles.length) * 100);
          try {
            const raw = await AI.stream({
              model: ctx.model.id, temperature: TEMP.batch, signal: ctx.signal,
              messages: AI.withJsonHint([
                { role: 'system', content: AIPrompts.standardizeBatchSystem },
                { role: 'user', content: AIPrompts.standardizeBatchUser(batch.map(function (t) { return t.title; })) }
              ])
            });
            const p = AI.parseJSON(raw);
            const arr = Array.isArray(p) ? p : (p && p.items) || null;
            if (!arr) throw new Error('پاسخ مدل قابل تفسیر نبود');
            batch.forEach(function (t, idx) {
              const found = arr.filter(function (a) { return a && a.original === t.title; })[0] || arr[idx];
              if (found) { results.push(Object.assign({}, found, { _id: t.id, _orig: t.title })); ok++; }
              else results.push({ _id: t.id, _orig: t.title, _error: 'بدون نتیجه' });
            });
          } catch (e) {
            if (e.name === 'AbortError') throw e;
            lastErr = e;
            batch.forEach(function (t) { results.push({ _id: t.id, _orig: t.title, _error: e.message }); });
          }
        }
        if (!ok) throw lastErr || new Error('هیچ عنوانی استاندارد نشد');
        ctx.progress('پایان', 100);
        return results;
      },
      render: function (box, results) {
        const good = results.filter(function (r) { return !r._error; }).length;
        box.appendChild(Utils.el('div', { class: 'ai-deep-summary' }, [
          Utils.el('div', { class: 'ai-deep-summary-title' }, ['موفق: ' + Utils.toFa(good) + ' از ' + Utils.toFa(results.length)])
        ]));
        const list = Utils.el('div', { class: 'ai-result-list' });
        results.forEach(function (r) {
          list.appendChild(Utils.el('div', { class: 'ai-result-item' }, [
            Utils.el('span', { class: 'ai-result-icon' }, [r._error ? '⚠️' : '✅']),
            Utils.el('span', { class: 'ai-result-orig' }, [r._orig]),
            r._error ? Utils.el('span', { class: 'ai-result-err' }, [r._error])
              : Utils.el('span', { class: 'ai-result-new' }, [' → ' + (r.standard_title || '')])
          ]));
        });
        box.appendChild(list);
      },
      acceptLabel: '✅ بپذیر و روی موفق‌ها اعمال کن',
      onAccept: function (results) {
        let n = 0;
        results.forEach(function (r) { if (r._id && !r._error) { applyStandard(r._id, r); n++; } });
        notifyTitlesChanged();
        Toast.success(Utils.toFa(n) + ' عنوان استاندارد شد');
      }
    });
  }

  /* =========================================================
     جستجوی هوشمند عنوان (فرم افزودن) — انتخاب یک نسخه = پذیرش
     ========================================================= */
  function fillForm(form, c) {
    const setVal = function (name, value) {
      const el = form.querySelector('[name="' + name + '"]');
      if (el) el.value = value == null ? '' : value;
    };
    if (c.standard_title) setVal('title', c.standard_title);
    if (c.type) {
      const sel = form.querySelector('[name="type"]');
      if (sel && sel.querySelector('option[value="' + c.type + '"]')) sel.value = c.type;
    }
    if (c.year_start) setVal('year', c.year_start);
    if (c.genre) setVal('genre', c.genre);

    const rating = form.querySelector('[name="rating"]');
    if (rating && !Number(rating.value)) {
      const picker = form.querySelector('.star-picker-wrap');
      if (picker && picker.__setValue) picker.__setValue(3);
    }
    const hidden = {
      _ai_standard_title: c.standard_title, _ai_seasons: c.seasons, _ai_episodes: c.episodes,
      _ai_episodes_per_season: c.episodes_per_season, _ai_country: c.country, _ai_language: c.language,
      _ai_status: c.status, _ai_summary: c.summary
    };
    Object.keys(hidden).forEach(function (name) {
      let el = form.querySelector('[name="' + name + '"]');
      if (!el) { el = document.createElement('input'); el.type = 'hidden'; el.name = name; form.appendChild(el); }
      el.value = hidden[name] == null ? '' : hidden[name];
    });
  }

  function candidateCard(c, onPick) {
    const conf = Number(c.confidence) || 0;
    const level = conf >= 8 ? 'high' : conf >= 5 ? 'mid' : 'low';
    return Utils.el('button', { type: 'button', class: 'lookup-card', onclick: onPick }, [
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
        Utils.el('span', {}, [c.creators ? 'سازنده: ' + c.creators : '']),
        Utils.el('span', { class: 'lookup-card-conf', dataset: { level: level } }, ['● ' + Utils.toFa(conf) + '/۱۰'])
      ])
    ].filter(Boolean));
  }

  function openLookup(form, titleInput) {
    const raw = titleInput.value.trim();
    if (!raw) { Toast.warning('اول عنوان را وارد کن'); titleInput.focus(); return; }

    AIReview.open({
      title: 'جستجوی هوشمند عنوان', icon: '🔍', size: 'lg', live: 'raw', hideAccept: true,
      rejectLabel: '❌ هیچ‌کدام نیست — مدل تصادفی بعدی',
      header: Utils.el('div', { class: 'lookup-query' }, [
        Utils.el('span', { class: 'lookup-query-label' }, ['جستجو برای:']),
        Utils.el('span', { class: 'lookup-query-value' }, [raw])
      ]),
      run: async function (ctx) {
        const ex = await askJSON(ctx, [
          { role: 'system', content: AIPrompts.lookupSystem },
          { role: 'user', content: AIPrompts.lookupUser(raw) }
        ], TEMP.lookup, true);
        return { corrected: ex.parsed.corrected_query || raw, candidates: Array.isArray(ex.parsed.candidates) ? ex.parsed.candidates : [] };
      },
      render: function (box, v, api) {
        if (v.corrected && v.corrected !== raw) {
          box.appendChild(Utils.el('div', { class: 'lookup-corrected' }, [Utils.el('span', {}, ['دیکتهٔ تصحیح‌شده: ']), Utils.el('strong', {}, [v.corrected])]));
        }
        if (!v.candidates.length) {
          box.appendChild(Utils.el('div', { class: 'lookup-empty' }, [Utils.el('div', { class: 'lookup-empty-text' }, ['این مدل هیچ نسخه‌ای پیدا نکرد.'])]));
          return;
        }
        box.appendChild(Utils.el('div', { class: 'lookup-result-title' }, [Utils.toFa(v.candidates.length) + ' نسخه پیدا شد — یکی را انتخاب کن:']));
        const list = Utils.el('div', { class: 'lookup-list' });
        v.candidates.forEach(function (c) { list.appendChild(candidateCard(c, function () { api.accept(c); })); });
        box.appendChild(list);
      },
      onAccept: function (c) { fillForm(form, c); Toast.success('اطلاعات عنوان پر شد'); titleInput.focus(); }
    });
  }

  /* =========================================================
     تحلیل سلیقه و پیشنهاد
     ========================================================= */
  const STAR_MEANINGS = {
    5: 'عالی بود به قدری که بیش از یک بار خواهم دید', 4: 'خوب بود و خوشحالم که تماشا کردم', 3: 'خوب بود',
    2: 'افتضاح بود و اگر به گذشته برگردم هرگز تماشا نخواهم کرد', 1: 'افتضاح بود و از تماشایش عصبانی هستم', 0: 'هنوز امتیاز نداده'
  };

  function ratedTitles() {
    return DB.getAllTitles().filter(function (t) { return (t.rating || 0) > 0; }).map(function (t) {
      const r = Math.max(0, Math.min(5, Math.round(Number(t.rating) || 0)));
      return { title: t.title, type: t.type, year: t.year, genre: t.genre || '', rating: r, meaning: STAR_MEANINGS[r], reason: (t.reason || '').trim(), notes: (t.notes || '').trim() };
    });
  }

  function titleLine(t) {
    let line = ['• «' + t.title + '»', t.year ? '(' + t.year + ')' : '', '[' + (t.type || 'نامشخص') + ']', t.genre ? 'ژانر: ' + t.genre : '', 'امتیاز: ' + t.rating + '/5 — ' + t.meaning].filter(Boolean).join(' ');
    if (t.reason) line += '\n  دلیل/نظر: ' + t.reason;
    if (t.notes) line += '\n  یادداشت: ' + t.notes;
    return line;
  }

  function legend() {
    return ['معنی امتیازهای کاربر (حتماً رعایت کن):', '۵⭐ = ' + STAR_MEANINGS[5], '۴⭐ = ' + STAR_MEANINGS[4], '۳⭐ = ' + STAR_MEANINGS[3], '۲⭐ = ' + STAR_MEANINGS[2], '۱⭐ = ' + STAR_MEANINGS[1]].join('\n');
  }

  function tasteBlock() {
    const tp = CONFIG.TASTE_PROFILE;
    const lines = ['معیار کلی سلیقهٔ اعلام‌شده توسط کاربر:', 'مانیفست: ' + tp.manifesto, 'علاقه‌ها:'];
    tp.loves.forEach(function (x) { lines.push('  + ' + x); });
    lines.push('بیزاری‌ها:');
    tp.hates.forEach(function (x) { lines.push('  - ' + x); });
    return lines.join('\n');
  }

  function tasteMessages() {
    const rated = ratedTitles();
    if (rated.length < 3) throw new Error('حداقل ۳ عنوان امتیازداده‌شده لازم است.');
    const group = function (fn) { const g = rated.filter(fn); return g.length ? g.map(titleLine).join('\n') : '(هیچ)'; };
    return [
      { role: 'system', content: ['تو منتقد و تحلیل‌گر عمیق سلیقهٔ سینمایی هستی.', 'فقط بر اساس دادهٔ کاربر حرف بزن؛ حدس بی‌پایه نزن.', 'پاسخ را فارسی، منسجم و با Markdown بنویس.', 'از کلی‌گویی پرهیز کن؛ به آثار مشخص و امتیاز+معنی آن‌ها ارجاع بده.'].join('\n') },
      { role: 'user', content: [
        legend(), '', tasteBlock(), '',
        '## آثار با امتیاز ۴ و ۵ (خوشایند)', group(function (t) { return t.rating >= 4; }), '',
        '## آثار با امتیاز ۳ (متوسط/قابل قبول)', group(function (t) { return t.rating === 3; }), '',
        '## آثار با امتیاز ۱ و ۲ (ناخوشایند / پشیمانی)', group(function (t) { return t.rating <= 2; }), '',
        '## خواسته',
        'یک تحلیل عمیق از سلیقهٔ این بیننده بنویس که حداقل این بخش‌ها را داشته باشد:',
        '1. خلاصهٔ شخصیت سلیقه‌ای (یک پاراگراف)',
        '2. از چه چیزهایی و به‌چه دلیل خوشش می‌آید (با ارجاع به آثار ۵⭐ و ۴⭐)',
        '3. از چه چیزهایی و به‌چه دلیل خوشش نمی‌آید (با ارجاع به آثار ۱⭐ و ۲⭐)',
        '4. الگوهای تکراری (ژانر، لحن، شخصیت‌پردازی، پایان‌بندی، ریتم، جهان‌سازی، ...)',
        '5. تناقض‌ها یا نقاط خاکستری (اگر هست)',
        '6. جمع‌بندی: چه نوع اثری احتمالاً برایش «۵ ستاره» می‌شود و چه نوعی را باید رد کند'
      ].join('\n') }
    ];
  }

  function suggestMessages(kind) {
    const rated = ratedTitles();
    if (rated.length < 3) throw new Error('حداقل ۳ عنوان امتیازداده‌شده لازم است.');
    const kindFa = kind === 'movie' ? 'فیلم' : kind === 'series' ? 'سریال' : 'فیلم یا سریال';
    return [
      { role: 'system', content: ['تو متخصص پیشنهاد ' + kindFa + ' بر اساس سلیقهٔ واقعی کاربر هستی.', 'فقط یک اثر پیشنهاد بده که در لیست دیده‌شده‌ها نباشد.', 'پاسخ فارسی با Markdown.', 'در انتها یک بلوک JSON با این شکل بگذار:', '```json', '{"title":"...","original_title":"...","year":2020,"type":"movie|series","reason":"..."}', '```'].join('\n') },
      { role: 'user', content: [legend(), '', tasteBlock(), '', '## لیست دیده‌شده با امتیاز و معنی', rated.map(titleLine).join('\n'), '', 'فقط یک ' + kindFa + ' پیشنهاد بده که با الگوی امتیازهای بالا هم‌خوان باشد و شبیه آثار ۱–۲ ستاره نباشد.', 'دلیل پیشنهاد را با ارجاع به سلیقهٔ کاربر بنویس.'].join('\n') }
    ];
  }

  function saveConversation(prompt, response, model, titleContext, tags) {
    DB.saveConversation({ prompt: prompt, response: response, ai_model: model ? model.label : '', title_context: titleContext || '', tags: tags || '' });
  }

  function openTaste() {
    let messages;
    try { messages = tasteMessages(); } catch (e) { Toast.warning(e.message); return; }
    AIReview.open({
      title: 'تحلیل عمیق سلیقه', icon: '🔍', size: 'xl', live: 'markdown',
      run: function (ctx) { return AI.stream({ model: ctx.model.id, messages: messages, temperature: TEMP.taste, signal: ctx.signal, onToken: ctx.onToken }); },
      acceptLabel: '✅ بپذیر و در تاریخچه ذخیره کن',
      onAccept: function (text, model) { saveConversation('تحلیل عمیق سلیقه', text, model, 'تحلیل سلیقه', 'taste'); Toast.success('در تاریخچه ذخیره شد'); }
    });
  }

  function parseSuggestion(text, kind) {
    const ex = AI.extractJsonAndText(text);
    const j = ex.parsed && !Array.isArray(ex.parsed) ? ex.parsed : null;
    if (j && j.title) return { title: j.title, original_title: j.original_title || '', year: j.year || null, type: j.type || (kind === 'movie' ? 'movie' : 'series'), reason: j.reason || '' };
    const bold = text.match(/\*\*([^*]{2,80})\*\*/);
    const yr = text.match(/\b(19|20)\d{2}\b/);
    return { title: bold ? bold[1].trim() : '', original_title: '', year: yr ? Number(yr[0]) : null, type: kind === 'movie' ? 'movie' : 'series', reason: '' };
  }

  /* جعبهٔ اقدام روی اثر پیشنهادی */
  function suggestionActions(p) {
    const title = Utils.el('input', { class: 'field-input', type: 'text', value: p.title || '', placeholder: 'نام اثر پیشنهادی' });
    const type = Utils.el('select', { class: 'field-select' }, Object.keys(CONFIG.TYPES).map(function (k) { return Utils.el('option', { value: k }, [CONFIG.TYPES[k]]); }));
    type.value = CONFIG.TYPES[p.type] ? p.type : 'series';
    const year = Utils.el('input', { class: 'field-input', type: 'number', value: p.year || '', placeholder: 'سال' });

    function payload() { return { title: title.value.trim(), type: type.value, year: year.value ? Number(year.value) : null, reason: p.reason || '', original_title: p.original_title || '' }; }
    function exists(t) { return DB.getAllTitles().some(function (x) { return Utils.normalizeFa(x.title) === Utils.normalizeFa(t); }); }

    const seen = Utils.el('button', { class: 'btn btn-primary', type: 'button' }, ['✅ دیده‌ام — ثبت در آرشیو']);
    seen.addEventListener('click', function () {
      const d = payload();
      if (!d.title) { Toast.warning('عنوان را وارد کن'); return; }
      const q = new URLSearchParams({ add: '1', title: d.title, type: d.type, reason: d.reason, notes: 'پیشنهاد AI' });
      if (d.year) q.set('year', d.year);
      location.href = CONFIG.PAGES.MOVIES + '?' + q.toString();
    });
    const will = Utils.el('button', { class: 'btn btn-ghost', type: 'button' }, ['👀 خواهم دید']);
    will.addEventListener('click', function () {
      const d = payload();
      if (!d.title) { Toast.warning('عنوان را وارد کن'); return; }
      if (exists(d.title)) { Toast.info('این عنوان از قبل در آرشیو هست'); return; }
      DB.insertTitle({ title: d.title, type: d.type, year: d.year, original_title: d.original_title, rating: 0, favorite: false, notes: 'پیشنهاد AI — خواهم دید', reason: d.reason, status: 'will_watch' });
      Toast.success('به لیست «خواهم دید» اضافه شد');
    });
    return Utils.el('div', { class: 'ai-suggest-box' }, [
      Utils.el('div', { class: 'ai-section-title' }, ['اثر پیشنهادی']),
      title, Utils.el('div', { class: 'form-row' }, [type, year]),
      Utils.el('div', { class: 'flex gap-3', style: { flexWrap: 'wrap' } }, [seen, will])
    ]);
  }

  function openSuggest(kind) {
    let messages;
    try { messages = suggestMessages(kind); } catch (e) { Toast.warning(e.message); return; }
    AIReview.open({
      title: 'پیشنهاد اثر', icon: '✨', size: 'xl', live: 'markdown', closeOnAccept: false,
      run: function (ctx) { return AI.stream({ model: ctx.model.id, messages: messages, temperature: TEMP.suggest, signal: ctx.signal, onToken: ctx.onToken }); },
      render: function (box, text) {
        box.appendChild(Utils.el('div', { class: 'ai-stream-body', html: AIRender.renderMarkdown(text) }));
        box.appendChild(suggestionActions(parseSuggestion(text, kind)));
      },
      acceptLabel: '💾 بپذیر و در تاریخچه ذخیره کن',
      onAccept: function (text, model) { saveConversation('پیشنهاد اثر', text, model, 'پیشنهاد', 'suggest'); Toast.success('در تاریخچه ذخیره شد'); }
    });
  }

  /* =========================================================
     پرامپت آزاد — تنظیمات برای AIReview.create (جاسازی در صفحه)
     ========================================================= */
  function freePromptOptions(prompt, titleId, mount) {
    const t = titleId ? DB.getTitle(titleId) : null;
    let system = 'تو یک دستیار متخصص سینما و سریال هستی. به فارسی روان، دقیق و بدون تعارف پاسخ بده. پاسخ‌ها را با Markdown استاندارد بنویس (## برای تیتر، **bold**، - برای لیست).';
    if (t) {
      system += '\n\nاطلاعات زمینه‌ای:\nعنوان استاندارد: ' + AIPrompts.standardLine(t.title, t.type, t.year, t) + '\n';
      if (t.genre) system += 'ژانر: ' + t.genre + '\n';
      if (t.summary) system += 'خلاصه: ' + t.summary + '\n';
    }
    return Object.assign({
      live: 'markdown',
      run: function (ctx) {
        return AI.stream({ model: ctx.model.id, temperature: TEMP.free, signal: ctx.signal, onToken: ctx.onToken,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] });
      },
      acceptLabel: '✅ بپذیر و در تاریخچه ذخیره کن',
      onAccept: function (text, model) {
        DB.saveConversation({ title_id: t ? t.id : null, title_context: t ? t.title : '', prompt: prompt, response: text, ai_model: model ? model.label : '' });
        Toast.success('سؤال و جواب ذخیره شد');
      }
    }, mount || {});
  }

  return {
    openStandardize: openStandardize, openAnalyze: openAnalyze, openDeep: openDeep, openBatch: openBatch,
    openLookup: openLookup, openTaste: openTaste, openSuggest: openSuggest,
    freePromptOptions: freePromptOptions, ratedTitles: ratedTitles
  };
})();
