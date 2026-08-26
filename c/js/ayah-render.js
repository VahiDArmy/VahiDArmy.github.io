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
          <span class="ayah-frame__ref-text">${surahMeta.revelation}</span>
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
