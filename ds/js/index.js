let currentSurah = null;
let currentAyah = null;
let currentAnnotationId = null; // برای ویرایش

// تابعی که بعد از تغییر احراز هویت ادمین صدا زده می‌شود
function onAdminStateChange() {
  // اگر آیه انتخاب شده، وضعیت فرم تفسیر را به‌روز کن
  if (currentSurah && currentAyah) {
    loadAnnotationForEdit(currentSurah, currentAyah);
  }
}

// تابعی که بعد از تغییر انتخاب آیه صدا زده می‌شود
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
    document.getElementById('annotationContent').value = '';
    document.getElementById('commentsList').innerHTML = '<p class="empty-text">سوره و آیه را انتخاب کنید.</p>';
  }
}

async function loadAyahAndAnnotation(surah, ayah) {
  // بارگذاری متن آیه و ترجمه
  const surahData = await loadSurahData(surah);
  const ayahData = getAyahFromSurah(surahData, ayah);
  displayAyah(ayahData);

  // بارگذاری تفسیر موجود (اگر ادمین باشد برای ویرایش، در غیر این صورت فقط نمایش)
  const { data, error } = await supabaseClient
    .from('annotations')
    .select('*')
    .eq('surah', surah)
    .eq('ayah', ayah)
    .maybeSingle();

  if (error) {
    console.error('خطا در بارگذاری تفسیر:', error);
    return;
  }

  if (data) {
    currentAnnotationId = data.id;
    document.getElementById('annotationContent').value = data.content;
  } else {
    currentAnnotationId = null;
    document.getElementById('annotationContent').value = '';
  }

  // اگر ادمین نباشد، فرم مخفی است
  updateAdminUI();
}

// بارگذاری آخرین تفسیر
async function loadLastAnnotation() {
  const container = document.getElementById('lastAnnotationContainer');
  container.innerHTML = '<p class="loading-text">در حال بارگذاری آخرین تفسیر...</p>';

  const { data, error } = await supabaseClient
    .from('annotations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('خطا در بارگذاری آخرین تفسیر:', error);
    container.innerHTML = '<p>خطا در بارگذاری</p>';
    return;
  }

  if (!data) {
    container.innerHTML = '<p class="empty-text">هنوز تفسیری ثبت نشده است.</p>';
    return;
  }

  // بارگذاری آیه مربوطه
  const surahData = await loadSurahData(data.surah);
  const ayahData = getAyahFromSurah(surahData, data.ayah);

  container.innerHTML = `
    <div class="last-annotation-info">
      <p class="last-ayah-ref">سوره ${data.surah}، آیه ${data.ayah}</p>
      <p class="ayah-text small">${ayahData ? ayahData.text : ''}</p>
      <p class="translation-text">${ayahData ? ayahData.translation : ''}</p>
    </div>
    <div class="annotation-content">
      ${data.content}
    </div>
  `;
}

// ذخیره یا به‌روزرسانی تفسیر
async function saveAnnotation() {
  const content = document.getElementById('annotationContent').value.trim();
  if (!content) {
    alert('متن تفسیر خالی است');
    return;
  }
  if (!currentSurah || !currentAyah) {
    alert('ابتدا آیه را انتخاب کنید');
    return;
  }

  const saveBtn = document.getElementById('saveAnnotationBtn');
  const saveStatus = document.getElementById('saveStatus');
  saveBtn.disabled = true;
  saveStatus.textContent = 'در حال ذخیره...';

  const isAdmin = adminSession && adminSession.user.id === ADMIN_UUID;
  if (!isAdmin) {
    alert('شما اجازه ذخیره تفسیر ندارید');
    saveBtn.disabled = false;
    saveStatus.textContent = '';
    return;
  }

  let result;
  if (currentAnnotationId) {
    // ویرایش
    result = await supabaseClient
      .from('annotations')
      .update({ content, updated_at: new Date() })
      .eq('id', currentAnnotationId);
  } else {
    // ثبت جدید
    result = await supabaseClient
      .from('annotations')
      .insert([
        {
          surah: currentSurah,
          ayah: currentAyah,
          content,
        }
      ])
      .select()
      .single();
  }

  if (result.error) {
    console.error('خطا در ذخیره تفسیر:', result.error);
    saveStatus.textContent = 'خطا در ذخیره';
    saveBtn.disabled = false;
    return;
  }

  if (!currentAnnotationId && result.data) {
    currentAnnotationId = result.data.id;
  }

  saveStatus.textContent = 'ذخیره شد ✓';
  saveBtn.disabled = false;
  // بارگذاری مجدد آخرین تفسیر
  loadLastAnnotation();
}

// رویدادها
document.addEventListener('DOMContentLoaded', async () => {
  // بارگذاری آخرین تفسیر
  await loadLastAnnotation();

  // دکمه ذخیره تفسیر
  const saveBtn = document.getElementById('saveAnnotationBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveAnnotation);
  }

  // فراخوانی اولیه برای وضعیت ادمین
  updateAdminUI();
});
