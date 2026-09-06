// =============================================================
// نشانه‌گذاری ارجاع به آیهٔ دیگر داخل متن تفسیر:
//   [[2:255]]              ارجاع به کل آیه
//   [[2:255|بخش گزیده]]    ارجاع همراه با یک عبارت گزیده (حداکثر ۱۲۰ حرف)
// =============================================================
const AyahLinks = (function () {
  const TOKEN_SOURCE = '\\[\\[(\\d{1,3}):(\\d{1,3})(?:\\|([^\\]]{1,120}))?\\]\\]';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // همهٔ ارجاع‌های موجود در یک متن را استخراج می‌کند
  function extract(content) {
    const re = new RegExp(TOKEN_SOURCE, 'g');
    const links = [];
    let m;
    while ((m = re.exec(content))) {
      links.push({ surah: Number(m[1]), ayah: Number(m[2]), excerpt: m[3] ? m[3].trim() : null });
    }
    return links;
  }

  // متن را به HTML امن تبدیل می‌کند؛ ارجاع‌ها به لینک بنفش فسفری تبدیل می‌شوند.
  // transformSegment (اختیاری) روی هر تکه‌متن ساده (بین ارجاع‌ها) اجرا می‌شود —
  // مثلاً برای هایلایت کردن برچسب‌ها بدون تودرتو شدن با لینک آیه.
  function renderContent(content, surahIndex, transformSegment) {
    const nameOf = (n) => (surahIndex.find((s) => s.number === n) || {}).name_fa || n;
    const transform = transformSegment || ((s) => s);
    const re = new RegExp(TOKEN_SOURCE, 'g');
    let out = '';
    let lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      out += transform(escapeHtml(content.slice(lastIndex, m.index)));
      const surah = Number(m[1]);
      const ayah = Number(m[2]);
      const excerpt = m[3] ? m[3].trim() : null;
      const label = excerpt || `سورهٔ ${nameOf(surah)}، آیهٔ ${ayah}`;
      out += `<a class="ayah-link" href="browse.html?surah=${surah}&ayah=${ayah}" title="سورهٔ ${nameOf(surah)}، آیهٔ ${ayah}">${escapeHtml(label)}</a>`;
      lastIndex = re.lastIndex;
    }
    out += transform(escapeHtml(content.slice(lastIndex)));
    return out;
  }

  function makeToken(surah, ayah, excerpt) {
    const clean = excerpt ? excerpt.trim().replace(/[\[\]|]/g, '').slice(0, 120) : '';
    return clean ? `[[${surah}:${ayah}|${clean}]]` : `[[${surah}:${ayah}]]`;
  }

  return { extract, renderContent, makeToken };
})();
