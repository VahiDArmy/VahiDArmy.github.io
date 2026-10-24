// ابزارهای مشترک رابط کاربری
const UI = (function () {
  // ---------------------------------------------------------------
  // متن و نویسه‌ها
  // ---------------------------------------------------------------
  const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  // فرار کامل HTML — برای متن و برای مقدار attribute هر دو امن است
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => HTML_ESC[c]);
  }

  function toPersianDigits(str) {
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (d) => fa[d]);
  }

  // ---------------------------------------------------------------
  // localStorage امن (حالت خصوصی/مسدود نباید صفحه را بشکند)
  // ---------------------------------------------------------------
  const storage = {
    get(key, fallback = null) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : v;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        return false;
      }
    },
  };

  // ---------------------------------------------------------------
  // فرم‌ها
  // ---------------------------------------------------------------
  function populateSurahSelect(selectEl, index, selected) {
    selectEl.innerHTML = index
      .map(
        (s) =>
          `<option value="${s.number}" ${s.number === selected ? 'selected' : ''}>${s.number} - ${escapeHtml(s.name_fa)}</option>`
      )
      .join('');
  }

  function populateAyahSelect(selectEl, ayahCount, selected) {
    let html = '';
    for (let i = 1; i <= ayahCount; i++) {
      html += `<option value="${i}" ${i === selected ? 'selected' : ''}>آیه ${toPersianDigits(i)}</option>`;
    }
    selectEl.innerHTML = html;
  }

  // ---------------------------------------------------------------
  // Toast — پیام کوتاه؛ اگر link داده شود پیام قابل کلیک می‌شود
  // ---------------------------------------------------------------
  function toast(message, link) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.innerHTML = '<div class="toast__inner"></div>';
      document.body.appendChild(el);
    }
    const inner = el.querySelector('.toast__inner');
    inner.textContent = '';
    inner.style.pointerEvents = '';
    if (link) {
      const a = document.createElement('a');
      a.href = link;
      a.textContent = message;
      a.style.cssText = 'color:inherit; text-decoration:underline; text-underline-offset:4px;';
      inner.appendChild(a);
      inner.style.pointerEvents = 'auto';
    } else {
      inner.textContent = message;
    }
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), link ? 7000 : 2600);
  }

  // ---------------------------------------------------------------
  // پیشرفت
  // ---------------------------------------------------------------
  function formatPercent(percent) {
    return (
      Number(percent).toLocaleString('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '٪'
    );
  }

  function setProgressRing(ringEl, percent, labelEl) {
    const circle = ringEl.querySelector('.ring-fg');
    const r = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * r;
    circle.style.strokeDasharray = `${circumference}`;
    const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
    requestAnimationFrame(() => {
      circle.style.strokeDashoffset = offset;
    });
    if (labelEl) labelEl.textContent = formatPercent(percent);
  }

  function countUp(el, target, duration = 900) {
    const start = 0;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(start + (target - start) * eased).toLocaleString('fa-IR');
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------
  // برچسب‌ها
  // ---------------------------------------------------------------
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
    return Math.abs(h);
  }

  function tagColor(tag) {
    const hue = hashStr(tag) % 360;
    return {
      bg: `hsla(${hue},70%,50%,0.15)`,
      border: `hsla(${hue},70%,55%,0.45)`,
      color: `hsl(${hue},80%,70%)`,
      glow: `hsla(${hue},85%,60%,0.85)`,
    };
  }

  function tagPill(tag, { href, count, active } = {}) {
    const c = tagColor(tag);
    const style = active
      ? `background:${c.color};border-color:${c.color};color:#0B0E14;`
      : `background:${c.bg};border-color:${c.border};color:${c.color};`;
    const countHtml = count != null ? ` <span class="tag-pill__count">${toPersianDigits(count)}</span>` : '';
    return `<a class="tag-pill" style="${style}" href="${escapeHtml(href)}">${escapeHtml(tag)}${countHtml}</a>`;
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function tagToRegexSource(tag) {
    const words = tag
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => escapeRegExp(w) + '[یهاءٔ]{0,2}');
    return words.join('\\s+');
  }

  // روی «متن ساده‌ی فرار‌شده» کار می‌کند (نه روی HTML دلخواه).
  // اگر ورودی HTML دارد از highlightTagsInHtml استفاده کنید.
  function highlightTags(escapedHtml, tags) {
    if (!tags || !tags.length) return escapedHtml;
    const matches = [];
    tags.forEach((tag) => {
      if (!tag || !String(tag).trim()) return;
      const re = new RegExp(tagToRegexSource(tag), 'g');
      let m;
      while ((m = re.exec(escapedHtml))) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        matches.push({ start: m.index, end: m.index + m[0].length, text: m[0], tag });
      }
    });
    if (!matches.length) return escapedHtml;

    // هرگز وسط یک entity (مثل &amp;) برش نزن
    const entities = [];
    const entRe = /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi;
    let em;
    while ((em = entRe.exec(escapedHtml))) entities.push([em.index, em.index + em[0].length]);
    const inEntity = (m) => entities.some(([s, e]) => m.start < e && m.end > s);

    matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
    const filtered = [];
    let lastEnd = -1;
    for (const m of matches) {
      if (m.start >= lastEnd && !inEntity(m)) {
        filtered.push(m);
        lastEnd = m.end;
      }
    }

    let out = '';
    let cursor = 0;
    for (const m of filtered) {
      out += escapedHtml.slice(cursor, m.start);
      const c = tagColor(m.tag);
      out += `<a class="tag-mention" style="color:${c.color};text-shadow:0 0 6px ${c.border}" href="tags.html?tag=${encodeURIComponent(m.tag)}">${m.text}</a>`;
      cursor = m.end;
    }
    out += escapedHtml.slice(cursor);
    return out;
  }

  // برجسته‌کردن برچسب‌ها داخل HTML آماده (مثلاً خروجی markdown):
  // فقط گره‌های متنی را تغییر می‌دهد؛ attributeها، لینک‌ها و کد دست‌نخورده می‌مانند.
  function highlightTagsInHtml(html, tags) {
    if (!html || !tags || !tags.length) return html;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        for (let p = n.parentElement; p; p = p.parentElement) {
          if (/^(A|CODE|PRE|BUTTON|SCRIPT|STYLE)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (const node of nodes) {
      const escaped = escapeHtml(node.nodeValue);
      const out = highlightTags(escaped, tags);
      if (out === escaped) continue;
      const frag = document.createElement('template');
      frag.innerHTML = out;
      node.replaceWith(frag.content);
    }
    return tpl.innerHTML;
  }

  // ---------------------------------------------------------------
  // Markdown امن (marked + DOMPurify؛ بدون آن‌ها متن ساده)
  // ---------------------------------------------------------------
  let purifyHooked = false;
  function hookPurify() {
    if (purifyHooked || !window.DOMPurify) return;
    purifyHooked = true;
    // لینک‌هایی که target دارند باید rel امن داشته باشند (reverse-tabnabbing)
    window.DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && node.getAttribute('target')) {
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  function renderMarkdown(md) {
    if (!md) return '';
    if (!window.marked || !window.DOMPurify) {
      return escapeHtml(md).replace(/\n/g, '<br>');
    }
    hookPurify();
    const raw = window.marked.parse(md);
    const clean = window.DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] });
    const tmp = document.createElement('div');
    tmp.innerHTML = clean;
    tmp.querySelectorAll('table').forEach((table) => {
      if (table.parentElement && table.parentElement.classList.contains('table-scroll')) return;
      const wrap = document.createElement('div');
      wrap.className = 'table-scroll';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
    return tmp.innerHTML;
  }

  // ---------------------------------------------------------------
  // اتصال به آکاردئون صفحهٔ کار (در صفحه‌های بدون آکاردئون بی‌اثر است)
  // ---------------------------------------------------------------
  function accordion() {
    const el = document.getElementById('workAccordion');
    return (el && el.arcoAccordion) || null;
  }

  // بخش را باز می‌کند؛ بعد از آماده‌شدن محتوا (قابل فوکوس) resolve می‌شود
  function openPanel(key) {
    const a = accordion();
    return a ? a.open(key) : Promise.resolve(false);
  }

  function isPanelOpen(key) {
    const a = accordion();
    return a ? a.isOpen(key) : true;
  }

  // شمارندهٔ روی قرص بخش؛ مستقیم روی DOM کار می‌کند تا به زمان آماده‌شدن آکاردئون وابسته نباشد
  function setPanelBadge(key, value) {
    const li = document.querySelector(`.arco-accordion_item[data-panel-key="${key}"]`);
    const badge = li && li.querySelector('.rm-badge');
    if (!badge) return;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      badge.hidden = true;
      return;
    }
    badge.textContent = n.toLocaleString('fa-IR');
    badge.hidden = false;
  }

  function setPanelHidden(key, hidden) {
    const a = accordion();
    if (a) a.setHidden(key, hidden);
    else {
      const li = document.querySelector(`.arco-accordion_item[data-panel-key="${key}"]`);
      if (li) li.hidden = hidden;
    }
  }

  // اسکرول به عنصر داخل بدنهٔ بخش (نه کل صفحه)
  function scrollInPanel(el, block = 'start') {
    if (!el) return;
    const body = el.closest('.rm-body');
    if (!body) { el.scrollIntoView({ behavior: 'smooth', block }); return; }
    const top = el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
    const target = block === 'center' ? top - (body.clientHeight - el.offsetHeight) / 2 : top;
    body.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }

  function scrollPanelTop(el) {
    const body = el && el.closest ? el.closest('.rm-body') : null;
    if (body) body.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return {
    escapeHtml,
    storage,
    populateSurahSelect,
    populateAyahSelect,
    toast,
    setProgressRing,
    countUp,
    toPersianDigits,
    tagColor,
    tagPill,
    highlightTags,
    highlightTagsInHtml,
    renderMarkdown,
    openPanel,
    isPanelOpen,
    setPanelBadge,
    setPanelHidden,
    scrollInPanel,
    scrollPanelTop,
  };
})();
