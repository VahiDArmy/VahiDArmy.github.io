let currentSurah = null;
let currentAyah = null;

function onAyahSelectionChange() {
  const surahSelect = document.getElementById('surahSelect');
  const ayahSelect = document.getElementById('ayahSelect');
  currentSurah = parseInt(surahSelect.value);
  currentAyah = parseInt(ayahSelect.value);

  if (currentSurah && currentAyah) {
    saveProgress(currentSurah, currentAyah);
    loadAyahAndAnnotations(currentSurah, currentAyah);
  }
}

async function loadAyahAndAnnotations(surah, ayah) {
  const surahData = await loadSurahData(surah);
  const ayahData = getAyahFromSurah(surahData, ayah);
  displayAyah(ayahData);

  const annotationsList = document.getElementById('annotationsList');
  if (annotationsList) {
    annotationsList.innerHTML = '';
  }

  const newArea = document.getElementById('newAnnotationArea');
  if (newArea) {
    if (isAdmin()) {
      newArea.style.display = 'block';
      document.getElementById('newAnnotationTextarea').value = '';
    } else {
      newArea.style.display = 'none';
    }
  }

  const { data, error } = await supabaseClient
    .from('annotations')
    .select('*')
    .eq('surah', surah)
    .eq('ayah', ayah)
    .order('created_at', { ascending: true });

  if (error) return;

  if (!annotationsList) return;

  if (data.length === 0) {
    annotationsList.innerHTML = '<p>تفسیری ثبت نشده است.</p>';
    return;
  }

  data.forEach(ann => {
    const item = document.createElement('div');
    item.className = 'annotation-item';

    const snippet = ann.content.length > 150 ? ann.content.substring(0, 150) + '...' : ann.content;
    item.innerHTML = `
      <div class="annotation-snippet">${snippet}</div>
      <div class="annotation-full hidden">${ann.content}</div>
      <div class="annotation-actions">
        <button class="btn btn-outline toggle-more" data-id="${ann.id}">بیشتر</button>
        ${isAdmin() ? `
          <button class="btn btn-primary edit-annotation" data-id="${ann.id}">ویرایش</button>
          <button class="btn btn-danger delete-annotation" data-id="${ann.id}">حذف</button>
        ` : ''}
      </div>
    `;

    annotationsList.appendChild(item);
  });

  annotationsList.querySelectorAll('.toggle-more').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.annotation-item');
      const snippetEl = item.querySelector('.annotation-snippet');
      const fullEl = item.querySelector('.annotation-full');
      if (fullEl.classList.contains('hidden')) {
        fullEl.classList.remove('hidden');
        snippetEl.style.display = 'none';
        btn.textContent = 'بستن';
      } else {
        fullEl.classList.add('hidden');
        snippetEl.style.display = 'block';
        btn.textContent = 'بیشتر';
      }
    });
  });

  annotationsList.querySelectorAll('.edit-annotation').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const item = btn.closest('.annotation-item');
      const fullEl = item.querySelector('.annotation-full');
      const newTextarea = document.getElementById('newAnnotationTextarea');
      newTextarea.value = fullEl.textContent;
      newTextarea.scrollIntoView({ behavior: 'smooth' });
      newTextarea.focus();
      newTextarea.dataset.editId = id;
    });
  });

  annotationsList.querySelectorAll('.delete-annotation').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('این تفسیر حذف شود؟')) {
        const { error } = await supabaseClient.from('annotations').delete().eq('id', id);
        if (!error) loadAyahAndAnnotations(surah, ayah);
      }
    });
  });
}

async function saveNewAnnotation() {
  const textarea = document.getElementById('newAnnotationTextarea');
  const content = textarea.value.trim();
  if (!content) return;

  const editId = textarea.dataset.editId;
  let result;
  if (editId) {
    result = await supabaseClient
      .from('annotations')
      .update({ content, updated_at: new Date() })
      .eq('id', editId);
    delete textarea.dataset.editId;
  } else {
    result = await supabaseClient
      .from('annotations')
      .insert([{ surah: currentSurah, ayah: currentAyah, content }]);
  }

  if (!result.error) {
    textarea.value = '';
    loadAyahAndAnnotations(currentSurah, currentAyah);
    loadLastAnnotation();
  }
}

async function loadLastAnnotation() {
  const container = document.getElementById('lastAnnotationContainer');
  if (!container) return;
  container.innerHTML = '<p>در حال بارگذاری...</p>';
  const { data, error } = await supabaseClient
    .from('annotations')
    .select('*')
    .order('created_at', { ascending: false })
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
  loadAyahAndAnnotations(newSurah, newAyah);
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadLastAnnotation();

  const saveNewBtn = document.getElementById('saveNewAnnotationBtn');
  if (saveNewBtn) saveNewBtn.addEventListener('click', saveNewAnnotation);

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
  loadAyahAndAnnotations(progress.surah, progress.ayah);
  updateAdminUI();
});