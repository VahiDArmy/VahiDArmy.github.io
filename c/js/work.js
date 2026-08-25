(async function () {
  const latestFrameEl = document.getElementById('latestAyahFrame');
  const latestTafsirCardEl = document.getElementById('latestTafsirCard');
  const formSurahSelect = document.getElementById('formSurahSelect');
  const formAyahSelect = document.getElementById('formAyahSelect');
  const formAyahPreview = document.getElementById('formAyahPreview');
  const tafsirForm = document.getElementById('tafsirForm');
  const tafsirContent = document.getElementById('tafsirContent');

  ayahSkeleton(latestFrameEl);

  const index = await QuranData.getIndex();

  // --- بارگذاری پیشرفت دور ---
  async function refreshProgress() {
    const p = await Store.getProgress();
    document.getElementById('roundNumber').textContent = UI.toPersianDigits(p.round);
    UI.countUp(document.getElementById('completedCount'), p.completed);
    UI.setProgressRing(document.getElementById('progressRing'), p.percent, document.getElementById('progressLabel'));
  }
  await refreshProgress();

  // --- بارگذاری آخرین تفسیر ---
  async function loadLatest() {
    const latest = await Store.getLatestTafsir();
    if (!latest) {
      latestFrameEl.innerHTML = '';
      latestTafsirCardEl.innerHTML = `
        <div class="empty-state card">
          <div class="empty-state__icon">✎</div>
          <p>هنوز هیچ تفسیری ثبت نشده. اولین تفسیر را از فرم پایین صفحه بنویسید.</p>
        </div>`;
      return;
    }
    const { surah, ayah } = latest;
    const surahData = await QuranData.getSurah(surah);
    const ayahData = surahData.ayahs.find((a) => a.v === ayah);
    renderAyahFrame(latestFrameEl, ayahData, surahData);
    renderTafsirCard(latest, surahData);
  }

  function renderTafsirCard(t, surahData) {
    const date = new Date(t.created_at).toLocaleDateString('fa-IR');
    latestTafsirCardEl.innerHTML = `
      <div class="tafsir-card">
        <div class="tafsir-card__meta">
          <span class="tafsir-card__round">دور ${UI.toPersianDigits(t.round_number)}</span>
          <span>${date}</span>
        </div>
        <p class="tafsir-card__body">${escapeHtml(t.content)}</p>
        <div class="tafsir-card__actions">
          <button class="btn btn--sm" data-edit="${t.id}">ویرایش</button>
          <button class="btn btn--sm" data-delete="${t.id}">حذف</button>
        </div>
      </div>
    `;
    latestTafsirCardEl.querySelector('[data-delete]').addEventListener('click', async () => {
      if (!confirm('این تفسیر حذف شود؟')) return;
      await Store.deleteTafsir(t.id);
      UI.toast('تفسیر حذف شد');
      loadLatest();
      refreshProgress();
    });
    latestTafsirCardEl.querySelector('[data-edit]').addEventListener('click', () => {
      formSurahSelect.value = t.surah;
      UI.populateAyahSelect(formAyahSelect, surahData.ayah_count, t.ayah);
      tafsirContent.value = t.content;
      tafsirContent.scrollIntoView({ behavior: 'smooth', block: 'center' });
      tafsirContent.focus();
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
  const prefillSurah = Number(params.get('surah')) || 1;
  const prefillAyah = Number(params.get('ayah')) || 1;

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

  await updateFormPreview();

  if (params.has('surah')) {
    tafsirForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  tafsirForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = tafsirContent.value.trim();
    if (!content) return;
    await Store.addTafsir({
      surah: Number(formSurahSelect.value),
      ayah: Number(formAyahSelect.value),
      content,
    });
    tafsirContent.value = '';
    UI.toast('تفسیر با موفقیت ثبت شد');
    await loadLatest();
    await refreshProgress();
  });
})();
