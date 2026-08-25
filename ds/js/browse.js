let currentSurah = null;
let currentAyah = null;

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

  const annotationDisplay = document.getElementById('annotationDisplay');
  const { data, error } = await supabaseClient
    .from('annotations')
    .select('*')
    .eq('surah', surah)
    .eq('ayah', ayah)
    .maybeSingle();

  if (error) return;
  if (data) {
    annotationDisplay.innerHTML = `<h3>تفسیر شخصی</h3><p>${data.content}</p>`;
  } else {
    annotationDisplay.innerHTML = '<p>تفسیری ثبت نشده است.</p>';
  }
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
  const prevBtn = document.getElementById('prevAyahBtn');
  const nextBtn = document.getElementById('nextAyahBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => goToAyah(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => goToAyah(1));

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
  updateProgressDisplay();
});
