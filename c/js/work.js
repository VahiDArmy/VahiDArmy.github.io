(async function () {
  const latestFrameEl = document.getElementById('latestAyahFrame');
  const latestTafsirCardEl = document.getElementById('latestTafsirCard');
  const formSurahSelect = document.getElementById('formSurahSelect');
  const formAyahSelect = document.getElementById('formAyahSelect');
  const formAyahPreview = document.getElementById('formAyahPreview');
  const tafsirForm = document.getElementById('tafsirForm');
  const tafsirContent = document.getElementById('tafsirContent');
  const submitBtn = document.getElementById('tafsirSubmitBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const editingNoticeEl = document.getElementById('editingNotice');
  const nextAyahBtn = document.getElementById('nextAyahBtn');

  ayahSkeleton(latestFrameEl);

  const index = await QuranData.getIndex();

  // وضعیت ویرایش: اگر مقدار داشته باشد یعنی داریم یک تفسیر موجود را ویرایش می‌کنیم،
  // نه اینکه تفسیر تازه‌ای ثبت کنیم. ثبت و ویرایش دو مسیر جدا هستند.
  let editingId = null;

  function enterEditMode(t, surahData) {
    editingId = t.id;
    formSurahSelect.value = t.surah;
    UI.populateAyahSelect(formAyahSelect, surahData.ayah_count, t.ayah);
    updateFormPreview();
    tafsirContent.value = t.content;
    submitBtn.textContent = 'به‌روزرسانی تفسیر';
    editingNoticeEl.hidden = false;
    cancelEditBtn.hidden = false;
    tafsirContent.scrollIntoView({ behavior: 'smooth', block: 'center' });
    tafsirContent.focus();
  }

  function exitEditMode({ clearContent } = {}) {
    editingId = null;
    submitBtn.textContent = 'ثبت تفسیر';
    editingNoticeEl.hidden = true;
    cancelEditBtn.hidden = true;
    if (clearContent) tafsirContent.value = '';
  }

  cancelEditBtn.addEventListener('click', () => {
    exitEditMode({ clearContent: true });
  });

  // --- بارگذاری پیشرفت دور ---
  async function refreshProgress() {
    const p = await Store.getProgress();
    document.getElementById('roundNumber').textContent = UI.toPersianDigits(p.round);
    UI.countUp(document.getElementById('completedCount'), p.completed);
    UI.setProgressRing(document.getElementById('progressRing'), p.percent, document.getElementById('progressLabel'));
  }
  await refreshProgress();

  // --- محاسبهٔ آیهٔ بعدی در ترتیب قرآن (برای دکمهٔ «آیه بعدی») ---
  async function getNextAyah(surah, ayah) {
    const surahData = await QuranData.getSurah(surah);
    if (ayah < surahData.ayah_count) return { surah, ayah: ayah + 1 };
    if (surah < 114) return { surah: surah + 1, ayah: 1 };
    return { surah: 1, ayah: 1 }; // پایان قرآن → شروع دور جدید
  }

  // --- بارگذاری آخرین تفسیر ---
  let latestTafsir = null;

  async function loadLatest() {
    latestTafsir = await Store.getLatestTafsir();
    if (!latestTafsir) {
      latestFrameEl.innerHTML = '';
      latestTafsirCardEl.innerHTML = `
        <div class="empty-state card">
          <div class="empty-state__icon">✎</div>
          <p>هنوز هیچ تفسیری ثبت نشده. اولین تفسیر را از فرم پایین صفحه بنویسید.</p>
        </div>`;
      return;
    }
    const { surah, ayah } = latestTafsir;
    const surahData = await QuranData.getSurah(surah);
    const ayahData = surahData.ayahs.find((a) => a.v === ayah);
    renderAyahFrame(latestFrameEl, ayahData, surahData);
    renderTafsirCard(latestTafsir, surahData);
  }

  function renderTafsirCard(t, surahData) {
    const date = new Date(t.created_at).toLocaleDateString('fa-IR');
    latestTafsirCardEl.innerHTML = `
      <div class="tafsir-card">
        <div class="tafsir-card__meta">
          <span class="tafsir-card__round">دور ${UI.toPersianDigits(t.round_number)}</span>
          <span>${date}</span>
        </div>
        <p class="tafsir-card__body is-clamped">${escapeHtml(t.content)}</p>
        <button type="button" class="tafsir-card__more" data-more>نمایش کامل</button>
        <div class="tafsir-card__actions">
          <button class="btn btn--sm" data-edit="${t.id}">ویرایش</button>
          <button class="btn btn--sm" data-delete="${t.id}">حذف</button>
        </div>
      </div>
    `;
    const bodyEl = latestTafsirCardEl.querySelector('.tafsir-card__body');
    const moreBtn = latestTafsirCardEl.querySelector('[data-more]');
    moreBtn.addEventListener('click', () => {
      const isClamped = bodyEl.classList.toggle('is-clamped');
      moreBtn.textContent = isClamped ? 'نمایش کامل' : 'نمایش کمتر';
    });
    latestTafsirCardEl.querySelector('[data-delete]').addEventListener('click', async () => {
      if (!confirm('این تفسیر حذف شود؟')) return;
      await Store.deleteTafsir(t.id);
      if (editingId === t.id) exitEditMode({ clearContent: true });
      UI.toast('تفسیر حذف شد');
      await loadLatest();
      await refreshProgress();
    });
    latestTafsirCardEl.querySelector('[data-edit]').addEventListener('click', () => {
      enterEditMode(t, surahData);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  await loadLatest();

  // --- فرم افزودن تفسیر (با پشتیبانی از پیش‌پرشدن از طریق لینک صفحه مرور) ---
  const params = new URLSearchParams(location.search);
  const hasExplicitParams = params.has('surah') && params.has('ayah');

  let prefillSurah;
  let prefillAyah;
  if (hasExplicitParams) {
    // آمده از لینک صفحهٔ مرور → همان آیه را باز کن
    prefillSurah = Number(params.get('surah')) || 1;
    prefillAyah = Number(params.get('ayah')) || 1;
  } else if (latestTafsir) {
    // بدون پارامتر → همان «آیهٔ کاری فعلی» یعنی آخرین آیه‌ای که رویش کار شده
    // (کاربر می‌تواند تفسیر دیگری برایش اضافه کند یا با دکمهٔ «آیه بعدی» جلو برود)
    prefillSurah = latestTafsir.surah;
    prefillAyah = latestTafsir.ayah;
  } else {
    prefillSurah = 1;
    prefillAyah = 1;
  }

  UI.populateSurahSelect(formSurahSelect, index, prefillSurah);
  let currentFormSurah = await QuranData.getSurah(prefillSurah);
  UI.populateAyahSelect(formAyahSelect, currentFormSurah.ayah_count, prefillAyah);

  async function updateFormPreview() {
    const surahNum = Number(formSurahSelect.value);
    const ayahNum = Number(formAyahSelect.value);
    const surahData = await QuranData.getSurah(surahNum);
    const ayahData = surahData.ayahs.find((a) => a.v === ayahNum);
    renderAyahFrame(formAyahPreview, ayahData, surahData);
  }

  formSurahSelect.addEventListener('change', async () => {
    const surahNum = Number(formSurahSelect.value);
    currentFormSurah = await QuranData.getSurah(surahNum);
    UI.populateAyahSelect(formAyahSelect, currentFormSurah.ayah_count, 1);
    updateFormPreview();
  });
  formAyahSelect.addEventListener('change', updateFormPreview);

  nextAyahBtn.addEventListener('click', async () => {
    // رفتن به آیهٔ بعدی همیشه یعنی خروج از حالت ویرایش و شروع تفسیر تازه
    exitEditMode({ clearContent: true });
    const next = await getNextAyah(Number(formSurahSelect.value), Number(formAyahSelect.value));
    formSurahSelect.value = next.surah;
    currentFormSurah = await QuranData.getSurah(next.surah);
    UI.populateAyahSelect(formAyahSelect, currentFormSurah.ayah_count, next.ayah);
    await updateFormPreview();
    formAyahPreview.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  await updateFormPreview();

  if (hasExplicitParams) {
    tafsirForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  tafsirForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = tafsirContent.value.trim();
    if (!content) return;

    if (editingId) {
      // مسیر ویرایش: فقط همان تفسیر موجود به‌روزرسانی می‌شود، تفسیر جدید ساخته نمی‌شود
      await Store.updateTafsir(editingId, content);
      UI.toast('تفسیر به‌روزرسانی شد');
      exitEditMode({ clearContent: true });
    } else {
      // مسیر ثبت: همیشه یک تفسیر تازه اضافه می‌شود، حتی اگر آیه قبلاً تفسیر داشته باشد
      const result = await Store.addTafsir({
        surah: Number(formSurahSelect.value),
        ayah: Number(formAyahSelect.value),
        content,
      });
      tafsirContent.value = '';
      if (result.roundAdvanced) {
        UI.toast(`دور ${UI.toPersianDigits(result.newRound - 1)} تکمیل شد! دور ${UI.toPersianDigits(result.newRound)} آغاز شد ✦`);
      } else {
        UI.toast('تفسیر با موفقیت ثبت شد');
      }
    }

    await loadLatest();
    await refreshProgress();
  });
})();
