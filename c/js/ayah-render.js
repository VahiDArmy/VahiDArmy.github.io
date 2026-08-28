// رندر قاب آیه (عنصر امضای طراحی) + نوار باریک ترجمه با قابلیت باز/بسته شدن
// options.marked: آیا این آیه نشان‌گذاری شده؟  options.onToggleMark: اگر داده شود، چراغ کلیک‌پذیر می‌شود
function renderAyahFrame(container, ayah, surahMeta, options = {}) {
  const { marked = false, onToggleMark = null } = options;
  container.innerHTML = `
    <div class="ayah-frame">
      <div class="ayah-frame__inner">
        <div class="ayah-frame__ref">
          <span class="ayah-frame__ref-text">
            ${onToggleMark ? `<button type="button" class="mark-toggle${marked ? ' is-marked' : ''}" aria-label="نشان‌گذاری این آیه" aria-pressed="${marked}"></button>` : marked ? `<span class="mark-toggle is-marked" aria-hidden="true"></span>` : ''}
            سورهٔ <b>${surahMeta.name_fa}</b> · آیهٔ ${UI.toPersianDigits(ayah.v)}
          </span>
          <span class="ayah-frame__ref-text">
            ${surahMeta.revelation}
            <button type="button" class="copy-ayah-btn" aria-label="کپی آیه و ترجمه" title="کپی آیه و ترجمه">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </span>
        </div>
        <p class="ayah-frame__arabic">${ayah.ar}</p>
        <div class="translation-bar">
          <button class="translation-toggle" type="button" aria-expanded="false">
            نمایش ترجمهٔ فولادوند
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="translation-content">
            <div><p>${ayah.fa}</p></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const toggle = container.querySelector('.translation-toggle');
  const content = container.querySelector('.translation-content');
  toggle.addEventListener('click', () => {
    const isOpen = content.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.firstChild.textContent = isOpen ? 'پنهان کردن ترجمه ' : 'نمایش ترجمهٔ فولادوند ';
  });

  if (onToggleMark) {
    const markBtn = container.querySelector('button.mark-toggle');
    markBtn.addEventListener('click', () => onToggleMark(markBtn));
  }

  container.querySelector('.copy-ayah-btn').addEventListener('click', async () => {
    const text = `${ayah.ar}\n\n${ayah.fa}\n\n— سورهٔ ${surahMeta.name_fa}، آیهٔ ${ayah.v}`;
    try {
      await navigator.clipboard.writeText(text);
      UI.toast('آیه و ترجمه کپی شد');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        UI.toast('آیه و ترجمه کپی شد');
      } catch (e2) {
        UI.toast('کپی ناموفق بود — متن را دستی انتخاب کنید');
      }
      document.body.removeChild(ta);
    }
  });
}

function ayahSkeleton(container) {
  container.innerHTML = `
    <div class="card">
      <div class="skeleton" style="height:14px; width:40%; margin-bottom:20px;"></div>
      <div class="skeleton" style="height:20px; width:90%; margin:0 auto 10px;"></div>
      <div class="skeleton" style="height:20px; width:70%; margin:0 auto;"></div>
    </div>
  `;
}
