/* =========================================================
   رندر خروجی AI — Markdown، تحلیل داستانی، نشان مدل
   ========================================================= */
window.AIRender = (function () {

  /* =========================================================
     Markdown renderer
     ========================================================= */
  function renderMarkdown(text) {
    if (!text) return '';
    let s = String(text);

    const codeBlocks = [];
    s = s.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, function (_, lang, code) {
      const idx = codeBlocks.length;
      codeBlocks.push('<pre class="ai-code"><code>' + Utils.esc(code.replace(/\n$/, '')) + '</code></pre>');
      return '\u0001CB' + idx + '\u0001';
    });

    s = Utils.esc(s);

    s = s.replace(
      /(?:^|\n)([ \t]*\|[^\n]*\|[ \t]*\n[ \t]*\|[ \t\-:|]+\|[ \t]*\n(?:[ \t]*\|[^\n]*\|[ \t]*(?:\n|$))*)/g,
      function (_, block) { return '\n\n' + parseMarkdownTable(block) + '\n\n'; }
    );

    s = s.replace(/^######[ \t]+(.+?)[ \t]*$/gm, '<h6>$1</h6>');
    s = s.replace(/^#####[ \t]+(.+?)[ \t]*$/gm, '<h5>$1</h5>');
    s = s.replace(/^####[ \t]+(.+?)[ \t]*$/gm, '<h4>$1</h4>');
    s = s.replace(/^###[ \t]+(.+?)[ \t]*$/gm, '<h3>$1</h3>');
    s = s.replace(/^##[ \t]+(.+?)[ \t]*$/gm, '<h2>$1</h2>');
    s = s.replace(/^#[ \t]+(.+?)[ \t]*$/gm, '<h1>$1</h1>');

    s = s.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, '<hr>');

    s = s.replace(/(?:^|\n)((?:&gt;[ \t]?[^\n]*(?:\n|$))+)/g, function (_, block) {
      const lines = block.trim().split('\n').map(function (l) {
        return l.replace(/^&gt;[ \t]?/, '');
      });
      return '\n<blockquote>' + lines.join('<br>') + '</blockquote>\n';
    });

    s = s.replace(/(?:^|\n)((?:[ \t]*[-*+][ \t]+[^\n]+(?:\n|$))+)/g, function (_, block) {
      const items = block.trim().split('\n').map(function (l) {
        return l.replace(/^[ \t]*[-*+][ \t]+/, '');
      });
      return '\n<ul>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>\n';
    });

    s = s.replace(/(?:^|\n)((?:[ \t]*\d+\.[ \t]+[^\n]+(?:\n|$))+)/g, function (_, block) {
      const items = block.trim().split('\n').map(function (l) {
        return l.replace(/^[ \t]*\d+\.[ \t]+/, '');
      });
      return '\n<ol>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ol>\n';
    });

    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');

    s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    s = s.replace(/(?<![*_\w])_([^_\n]+)_(?!_)/g, '<em>$1</em>');

    s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

    s = s.replace(/`([^`\n]+)`/g, '<code class="ai-inline">$1</code>');

    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    s = s.replace(/\u0001CB(\d+)\u0001/g, function (_, idx) {
      return codeBlocks[Number(idx)] || '';
    });

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
      if (right) return 'left';
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
     Helpers
     ========================================================= */
  function valueToText(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) {
      if (!v.length) return '';
      if (v.every(function (x) { return typeof x === 'string'; })) {
        return v.join(' · ');
      }
      try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }
    }
    if (typeof v === 'object') {
      try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }
    }
    return String(v);
  }

  function isEmptyValue(v) {
    if (v == null) return true;
    if (typeof v === 'string' && !v.trim()) return true;
    if (Array.isArray(v) && !v.length) return true;
    if (typeof v === 'object' && !Array.isArray(v)) {
      try { return Object.keys(v).length === 0; } catch (e) { return false; }
    }
    return false;
  }

  /* نشان مدل تولیدکننده */
  function modelBadge(info) {
    if (!info) return null;
    const children = [
      Utils.el('span', { class: 'ai-model-badge-icon' }, ['🪄']),
      Utils.el('span', { class: 'ai-model-badge-label' }, ['تولید شده با:']),
      Utils.el('span', { class: 'ai-model-badge-value' }, [info.label || info.id])
    ];
    if (info.vendor) children.push(Utils.el('span', { class: 'ai-model-badge-vendor' }, [info.vendor]));
    return Utils.el('div', { class: 'ai-model-badge' }, children);
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
      const badge = modelBadge(sa.ai_model);
      if (badge) badgeWrap.appendChild(badge);
      container.appendChild(badgeWrap);
    }
  }

  const KNOWN_ITEM_KEYS = {
    location: 1, scene: 1, rule_broken: 1, technique: 1,
    issue: 1, what_happened: 1, why: 1, why_assumes_stupidity: 1,
    cascade: 1, severity: 1, type: 1,
    _seasons: 1, _matchType: 1, _id: 1, _error: 1
  };

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

      Object.keys(item).forEach(function (k) {
        if (KNOWN_ITEM_KEYS[k]) return;
        const v = item[k];
        if (isEmptyValue(v)) return;
        const label = k.replace(/_/g, ' ') + ':';
        itemEl.appendChild(row(label, valueToText(v)));
      });

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

  const KNOWN_KEYS = {
    standard_title: 1, title_fa: 1, type: 1,
    year_start: 1, year_end: 1, seasons: 1, episodes: 1, episodes_per_season: 1,
    country: 1, language: 1, genre: 1, status: 1,
    creators: 1, main_cast: 1, summary: 1, reason: 1,
    strengths: 1, weaknesses: 1,
    plot_holes: 1, assumed_stupidity: 1,
    earned_outcomes: 1, forced_outcomes: 1
  };

  function buildExtrasBox(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;

    const extras = [];
    Object.keys(parsed).forEach(function (k) {
      if (k.indexOf('__') === 0) return;
      if (KNOWN_KEYS[k]) return;
      const v = parsed[k];
      if (isEmptyValue(v)) return;
      extras.push({ key: k, value: v });
    });

    if (!extras.length) return null;

    const box = Utils.el('div', { class: 'ai-extras-box' });
    box.appendChild(Utils.el('div', { class: 'ai-extras-title' }, ['بخش‌های اضافی پاسخ AI']));

    extras.forEach(function (item) {
      const row = Utils.el('div', { class: 'ai-extras-row' });
      row.appendChild(Utils.el('div', { class: 'ai-extras-key' }, [item.key]));

      const v = item.value;
      const valEl = Utils.el('div', { class: 'ai-extras-val' });

      if (typeof v === 'string') {
        valEl.innerHTML = renderMarkdown(v);
      } else if (Array.isArray(v) && v.every(function (x) { return typeof x === 'string'; })) {
        valEl.innerHTML = '<ul>' + v.map(function (x) { return '<li>' + Utils.esc(x) + '</li>'; }).join('') + '</ul>';
      } else {
        try {
          valEl.appendChild(Utils.el('pre', {}, [JSON.stringify(v, null, 2)]));
        } catch (e) {
          valEl.textContent = String(v);
        }
      }

      row.appendChild(valEl);
      box.appendChild(row);
    });

    return box;
  }

  return {
    renderMarkdown: renderMarkdown,
    renderStoryAnalysis: renderStoryAnalysis,
    buildExtrasBox: buildExtrasBox,
    modelBadge: modelBadge,
    valueToText: valueToText,
    isEmptyValue: isEmptyValue
  };
})();
