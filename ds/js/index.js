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
    loadComments(currentSurah, currentAyah);
  }
}

async function loadAyahAndAnnotations(surah, ayah) {
  const surahData = await loadSurahData(surah);
  const ayahData = getAyahFromSurah(surahData, ayah);
  displayAyah(ayahData);

  const container = document.getElementById('annotationsContainer');
  container.innerHTML = '';

  if (!isAdmin()) {
    // نمایش تفاسیر موجود برای کاربر عادی
    const { data, error } = await supabaseClient
      .from('annotations')
      .select('*')
      .eq('surah', surah)
      .eq('ayah', ayah)
      .order('created_at', { ascending: true });

    if (error) return;
    if (data.length === 0) {
      container.innerHTML = '<p>تفسیری ثبت نشده است.</p>';
      return;
    }
    data.forEach(ann => {
      const div = document.createElement('div');
      div.className = 'annotation-item';
      div.innerHTML = `<p>${ann.content}</p>`;
      container.appendChild(div);
    });
    return;
  }

  // حالت ادمین: نمایش لیست با قابلیت ویرایش و افزودن
  const { data, error } = await supabaseClient
    .from('annotations')
    .select('*')
    .eq('surah', surah)
    .eq('ayah', ayah)
    .order('created_at', { ascending: true });

  if (error) return;

  data.forEach(ann => {
    const item = document.createElement('div');
    item.className = 'annotation-item';
    item.innerHTML = `
      <textarea class="annotation-edit">${ann.content}</textarea>
      <div class="annotation-actions">
        <button class="btn btn-primary save-edit" data-id="${ann.id}">ذخیره</button>
        <button class="btn btn-danger delete-annotation" data-id="${ann.id}">حذف</button>
      </div>
    `;
    container.appendChild(item);
  });

  // دکمه افزودن تفسیر جدید
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.textContent = '+ افزودن تفسیر جدید';
  addBtn.addEventListener('click', () => {
    const newItem = document.createElement('div');
    newItem.className = 'annotation-item';
    newItem.innerHTML = `
      <textarea class="new-annotation-text" placeholder="تفسیر جدید..."></textarea>
      <div class="annotation-actions">
        <button class="btn btn-primary add-new-annotation">ثبت</button>
      </div>
    `;
    container.appendChild(newItem);
    newItem.querySelector('.add-new-annotation').addEventListener('click', async () => {
      const text = newItem.querySelector('.new-annotation-text').value.trim();
      if (!text) return;
      const { error } = await supabaseClient
        .from('annotations')
        .insert([{ surah, ayah, content: text }]);
      if (!error) loadAyahAndAnnotations(surah, ayah);
    });
  });
  container.appendChild(addBtn);

  // اتصال رویدادهای ذخیره و حذف
  container.querySelectorAll('.save-edit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const textarea = btn.closest('.annotation-item').querySelector('.annotation-edit');
      const content = textarea.value.trim();
      if (!content) return;
      const { error } = await supabaseClient
        .from('annotations')
        .update({ content, updated_at: new Date() })
        .eq('id', id);
      if (!error) loadAyahAndAnnotations(surah, ayah);
    });
  });

  container.querySelectorAll('.delete-annotation').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('این تفسیر حذف شود؟')) {
        const { error } = await supabaseClient
          .from('annotations')
          .delete()
          .eq('id', id);
        if (!error) loadAyahAndAnnotations(surah, ayah);
      }
    });
  });
}

async function loadLastAnnotation() {
  const container = document.getElementById('lastAnnotationContainer');
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
  loadComments(newSurah, newAyah);
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadLastAnnotation();

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
  loadComments(progress.surah, progress.ayah);
  updateAdminUI();
});