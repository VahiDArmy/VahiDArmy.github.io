// ابزارهای مشترک رابط کاربری
const UI = (function () {
  function populateSurahSelect(selectEl, index, selected) {
    selectEl.innerHTML = index
      .map(
        (s) =>
          `<option value="${s.number}" ${s.number === selected ? 'selected' : ''}>${s.number} - ${s.name_fa}</option>`
      )
      .join('');
  }

  function populateAyahSelect(selectEl, ayahCount, selected) {
    let html = '';
    for (let i = 1; i <= ayahCount; i++) {
      html += `<option value="${i}" ${i === selected ? 'selected' : ''}>آیه ${i}</option>`;
    }
    selectEl.innerHTML = html;
  }

  function toast(message, urlOrCallback = null) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = '<div class="toast__inner"></div>';
      document.body.appendChild(el);
    }
    const inner = el.querySelector('.toast__inner');
    inner.textContent = message;
    // تنظیم کلیک
    if (urlOrCallback) {
      el.style.cursor = 'pointer';
      el.onclick = (e) => {
        if (typeof urlOrCallback === 'string') {
          location.href = urlOrCallback;
        } else if (typeof urlOrCallback === 'function') {
          urlOrCallback();
        }
        el.classList.remove('show');
      };
    } else {
      el.style.cursor = 'default';
      el.onclick = null;
    }
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.classList.remove('show');
      // پاک کردن کلیک بعد از مخفی شدن
      setTimeout(() => { el.onclick = null; el.style.cursor = 'default'; }, 300);
    }, 4000);
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
    if (labelEl) labelEl.textContent = `${toPersianDigits(percent.toFixed(2))}٪`;
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

  function toPersianDigits(str) {
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (d) => fa[d]);
  }

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

  function highlightTags(escapedHtml, tags) {
    if (!tags || !tags.length) return escapedHtml;
    let matches = [];
    tags.forEach((tag) => {
      const re = new RegExp(tagToRegexSource(tag), 'g');
      let m;
      while ((m = re.exec(escapedHtml))) {
        matches.push({ start: m.index, end: m.index + m[0].length, text: m[0], tag });
        if (m[0].length === 0) re.lastIndex++;
      }
    });
    if (!matches.length) return escapedHtml;

    matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
    const filtered = [];
    let lastEnd = -1;
    for (const m of matches) {
      if (m.start >= lastEnd) {
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

  function tagPill(tag, { href, count, active } = {}) {
    const c = tagColor(tag);
    const style = active
      ? `background:${c.color};border-color:${c.color};color:#0B0E14;`
      : `background:${c.bg};border-color:${c.border};color:${c.color};`;
    const countHtml = count != null ? ` <span class="tag-pill__count">${toPersianDigits(count)}</span>` : '';
    const tagEsc = tag.replace(/</g, '&lt;');
    return `<a class="tag-pill" style="${style}" href="${href}">${tagEsc}${countHtml}</a>`;
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

  async function copyToClipboard(text, successMessage = 'متن کپی شد') {
    try {
      await navigator.clipboard.writeText(text);
      toast(successMessage);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        toast(successMessage);
      } catch (e2) {
        toast('کپی ناموفق بود — متن را دستی انتخاب کنید');
      }
      document.body.removeChild(ta);
    }
  }

  return {
    populateSurahSelect,
    populateAyahSelect,
    toast,
    setProgressRing,
    countUp,
    toPersianDigits,
    tagColor,
    tagPill,
    highlightTags,
    copyToClipboard,
  };
})();