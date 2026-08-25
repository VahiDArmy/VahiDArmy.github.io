let currentSurah = null;
let currentAyah = null;

function onAyahSelectionChange() {
  const surahSelect = document.getElementById('surahSelect');
  const ayahSelect = document.getElementById('ayahSelect');
  currentSurah = surahSelect.value ? parseInt(surahSelect.value) : null;
  currentAyah = ayahSelect.value ? parseInt(ayahSelect.value) : null;

  if (currentSurah && currentAyah) {
    loadAyahAndAnnotation(currentSurah, currentAyah);
    loadComments(currentSurah, currentAyah);
  } else {
    document.getElementById('ayahText').textContent = '';
    document.getElementById('translationText').textContent = '';
    document.getElementById('annotationDisplay').innerHTML = '';
    document.getElementById('commentsList').innerHTML = '<p class="empty-text">سوره و آیه را انتخاب کنید.</p>';
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

  if (error) {
    console.error('خطا در بارگذاری تفسیر:', error);
    annotationDisplay.innerHTML = '';
    return;
  }

  if (data) {
    annotationDisplay.innerHTML = `
      <div class="annotation-content">
        <h3>تفسیر شخصی</h3>
        <p>${data.content}</p>
      </div>
    `;
  } else {
    annotationDisplay.innerHTML = '<p class="empty-text">تفسیری برای این آیه ثبت نشده است.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // دراپ‌داون‌ها در ui.js مقداردهی اولیه می‌شوند
});