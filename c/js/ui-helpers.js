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

  function toast(message) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = '<div class="toast__inner"></div>';
      document.body.appendChild(el);
    }
    el.querySelector('.toast__inner').textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2600);
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

  // اگر کلمه‌ای در متن دقیقاً با یکی از برچسب‌های همان تفسیر یکی باشد،
  // رنگی (هم‌رنگ با برچسب) + کمی گلو + لینک به صفحهٔ آن برچسب می‌شود.
  // ورودی باید از قبل escape شده باشد (خروجی escapeHtml).
  function highlightTags(escapedHtml, tags) {
    if (!tags || !tags.length) return escapedHtml;
    const clean = tags.map((t) => t.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!clean.length) return escapedHtml;
    const pattern = clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    let re;
    try {
      re = new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, 'gu');
    } catch (e) {
      re = new RegExp(`(${pattern})`, 'g'); // مرورگرهای خیلی قدیمی: بدون مرز کلمه
    }
    return escapedHtml.replace(re, (match) => {
      const c = tagColor(match);
      return `<a class="tag-inline" style="color:${c.color};text-shadow:0 0 5px ${c.glow},0 0 12px ${c.bg};" href="tags.html?tag=${encodeURIComponent(match)}">${match}</a>`;
    });
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

  // اجازه می‌دهد بعد از هر کلمهٔ تگ، یک پسوند رایج فارسی (ی، ها، ...) هم بیاید
  // مثلاً تگ «حقیقت بالاتر» با متن «حقیقتی بالاتر» هم تطبیق پیدا کند
  function tagToRegexSource(tag) {
    const words = tag
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => escapeRegExp(w) + '[یهاءٔ]{0,2}');
    return words.join('\\s+');
  }

  // کلمات/عبارت‌هایی از متن تفسیر که با یکی از تگ‌های خودش هم‌خانواده‌اند را
  // رنگی، با کمی گلو، و لینک‌شده به صفحهٔ همان برچسب می‌کند.
  // ورودی باید از قبل escape شده باشد (خروجی escapeHtml).
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
  };
})();
