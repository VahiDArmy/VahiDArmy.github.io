let currentSurah = null;
let currentAyah = null;
let currentAnnotationId = null;

function onAyahSelectionChange() {
  const surahSelect = document.getElementById('surahSelect');
  const ayahSelect = document.getElementById('ayahSelect');
  currentSurah = parseInt(surahSelect.value);
  currentAyah = parseInt(ayahSelect.value);

  if (currentSurah && currentAyah) {
    saveProgress(currentSurah, currentAyah);
    loadAyahAndAnnotation(currentSurah, currentAyah);
    loadComments(currentSurah, currentAyah);
  }
}

async function loadAyahAndAnnotation(surah, ayah) {
  const surahData = await loadSurahData(surah);
  const ayahData = getAyahFromSurah(surahData, ayah);
  displayAyah(ayahData);

  const { data, error } = await supabaseClient
    .from('annotations')
    .select('*')
    .eq('surah', surah)
    .eq('ayah', ayah)
    .maybeSingle();

  if (error) return;
  currentAnnotationId = data ? data.id : null;
  document.getElementById('annotationContent').value = data ? data.content : '';
  document.getElementById('saveStatus').textContent = '';
  updateAdminUI();
}

async function loadLastAnnotation() {
  const container = document.getElementById('lastAnnotationContainer');
  container.innerHTML = '<p>در حال بارگذاری...</p>';
  const { data, error } = await supabaseClient
    .from('annotations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return;
  if (!data) {
    container.innerHTML = '<p>هنوز تفسیری ثبت نشده است.</p>';
    return;
  }
  const surahData = await loadSurahData(data.surah);
  const ayahData = getAyahFromSurah(surahData, data.ayah);
  container.innerHTML = `
    <div>
      <p>سوره ${data.surah}، آیه ${data.ayah}</p>
      <p class="ayah-text small">${ayahData ? ayahData.ar : ''}</p>
      <p>${ayahData ? ayahData.fa : ''}</p>
    </div>
    <div>${data.content}</div>
  `;
}

async function saveAnnotation() {
  const content = document.getElementById('annotationContent').value.trim();
  if (!content) return;
  if (!currentSurah || !currentAyah) return;
  const saveBtn = document.getElementById('saveAnnotationBtn');
  const status = document.getElementById('saveStatus');
  saveBtn.disabled = true;
  status.textContent = 'در حال ذخیره...';

  if (!isAdmin()) {
    status.textContent = 'اجازه ذخیره ندارید';
    saveBtn.disabled = false;
    return;
  }

  let result;
  if (currentAnnotationId) {
    result = await supabaseClient
      .from('annotations')
      .update({ content, updated_at: new Date() })
      .eq('id', currentAnnotationId);
  } else {
    result = await supabaseClient
      .from('annotations')
      .insert([{ surah: currentSurah, ayah: currentAyah, content }])
      .select()
      .single();
    if (!result.error && result.data) currentAnnotationId = result.data.id;
  }

  if (result.error) {
    status.textContent = 'خطا در ذخیره';
  } else {
    status.textContent = 'ذخیره شد ✓';
    loadLastAnnotation();
  }
  saveBtn.disabled = false;
}

function cancelAnnotationEdit() {
  document.getElementById('saveStatus').textContent = '';
  const surahData = loadSurahData(currentSurah);
  surahData.then(data => {
    const ayahData = getAyahFromSurah(data, currentAyah);
    // just reload existing annotation
    loadAyahAndAnnotation(currentSurah, currentAyah);
  });
}

async function goToAyah(delta) {
  if (!currentSurah || !currentAyah) return;
  const surahData = await loadSurahData(currentSurah);
  const ayahCount = surahData.ayahs.length;
  let newSurah = currentSurah;
  let newAyah = currentAyah + delta;

  if (delta > 0 && newAyah > ayahCount) {
    newSurah = currentSurah + 1;
    newAyah = 1;
    if (newSurah > 114) return;
  } else if (delta < 0 && newAyah < 1) {
    newSurah = currentSurah - 1;
    if (newSurah < 1) return;
    const prevData = await loadSurahData(newSurah);
    newAyah = prevData.ayahs.length;
  }

  const surahSelect = document.getElementById('surahSelect');
  const ayahSelect = document.getElementById('ayahSelect');
  surahSelect.value = newSurah;
  await populateAyahSelect(newSurah, ayahSelect);
  ayahSelect.value = newAyah;
  currentSurah = newSurah;
  currentAyah = newAyah;
  saveProgress(newSurah, newAyah);
  loadAyahAndAnnotation(newSurah, newAyah);
  loadComments(newSurah, newAyah);
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadLastAnnotation();

  const saveBtn = document.getElementById('saveAnnotationBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveAnnotation);

  const cancelBtn = document.getElementById('cancelAnnotationBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelAnnotationEdit);

  const prevBtn = document.getElementById('prevAyahBtn');
  const nextBtn = document.getElementById('nextAyahBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => goToAyah(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => goToAyah(1));

  // بارگذاری آخرین آیه مشاهده‌شده
  const progress = getProgress();
  const surahSelect = document.getElementById('surahSelect');
  const ayahSelect = document.getElementById('ayahSelect');
  surahSelect.value = progress.surah;
  await populateAyahSelect(progress.surah, ayahSelect);
  ayahSelect.value = progress.ayah;
  currentSurah = progress.surah;
  currentAyah = progress.ayah;
  saveProgress(progress.surah, progress.ayah);
  loadAyahAndAnnotation(progress.surah, progress.ayah);
  loadComments(progress.surah, progress.ayah);
  updateAdminUI();
});
