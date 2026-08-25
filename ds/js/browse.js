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
  annotationsList.innerHTML = '';

  const { data, error } = await supabaseClient
    .from('annotations')
    .select('*')
    .eq('surah', surah)
    .eq('ayah', ayah)
    .order('created_at', { ascending: true });

  if (error) return;

  if (data.length === 0) {
    annotationsList.innerHTML = '<p>تفسیری ثبت نشده است.</p>';
    return;
  }

  for (const ann of data) {
    const item = document.createElement('div');
    item.className = 'annotation-item';
    item.innerHTML = `
      <div class="annotation-content">${ann.content}</div>
    `;
    annotationsList.appendChild(item);

    // کامنت‌های این تفسیر
    const commentsContainer = document.createElement('div');
    commentsContainer.className = 'comments-section';
    commentsContainer.innerHTML = `
      <h4 class="comments-title">نظرات این تفسیر</h4>
      <div class="comments-list" id="comments-${ann.id}"></div>
      <form class="comment-form" data-annotation-id="${ann.id}">
        <input type="text" class="comment-author" placeholder="نام شما (الزامی)" maxlength="50">
        <select class="comment-type">
          <option value="critique">نقد</option>
          <option value="oppose">مخالف</option>
          <option value="agree">موافق</option>
        </select>
        <textarea class="comment-content" rows="2" placeholder="نظر شما..." required></textarea>
        <input type="text" class="hp-field" tabindex="-1" autocomplete="off">
        <button type="submit" class="btn btn-secondary">ارسال نظر</button>
      </form>
      <p class="comment-status"></p>
    `;
    item.appendChild(commentsContainer);

    // بارگذاری کامنت‌های تأییدشده
    await loadCommentsForAnnotation(ann.id, commentsContainer.querySelector('.comments-list'));

    // ارسال کامنت
    const form = commentsContainer.querySelector('.comment-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const honeypot = form.querySelector('.hp-field');
      if (honeypot && honeypot.value) return;
      const author = form.querySelector('.comment-author').value.trim();
      const type = form.querySelector('.comment-type').value;
      const content = form.querySelector('.comment-content').value.trim();
      const statusEl = commentsContainer.querySelector('.comment-status');

      if (!author) {
        statusEl.textContent = 'نام الزامی است';
        statusEl.style.color = '#ff3366';
        return;
      }
      if (!content) {
        statusEl.textContent = 'متن نظر خالی است';
        statusEl.style.color = '#ff3366';
        return;
      }

      const { error } = await supabaseClient
        .from('comments')
        .insert([{ annotation_id: ann.id, author_name: author, type, content, status: 'pending' }]);

      if (error) {
        statusEl.textContent = 'خطا در ثبت نظر';
        statusEl.style.color = '#ff3366';
      } else {
        form.querySelector('.comment-content').value = '';
        statusEl.textContent = 'نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود';
        statusEl.style.color = '#33ff99';
        loadCommentsForAnnotation(ann.id, commentsContainer.querySelector('.comments-list'));
      }
    });
  }
}

async function loadCommentsForAnnotation(annotationId, container) {
  container.innerHTML = '<p>در حال بارگذاری...</p>';
  const { data, error } = await supabaseClient
    .from('comments')
    .select('*')
    .eq('annotation_id', annotationId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = '<p>خطا در بارگذاری</p>';
    return;
  }

  if (data.length === 0) {
    container.innerHTML = '<p>نظری ثبت نشده است.</p>';
    return;
  }

  container.innerHTML = '';
  data.forEach(comment => {
    const item = document.createElement('div');
    item.className = 'comment-item';
    item.innerHTML = `
      <div class="comment-header">
        <span>${comment.author_name || 'ناشناس'}</span>
        <span>${comment.type || 'critique'}</span>
        <span>${new Date(comment.created_at).toLocaleDateString('fa-IR')}</span>
      </div>
      <div class="comment-content">${comment.content}</div>
    `;
    if (isAdmin()) {
      const delBtn = document.createElement('button');
      delBtn.className = 'comment-delete-btn';
      delBtn.textContent = 'حذف';
      delBtn.addEventListener('click', async () => {
        if (confirm('این نظر حذف شود؟')) {
          const { error } = await supabaseClient.from('comments').delete().eq('id', comment.id);
          if (!error) loadCommentsForAnnotation(annotationId, container);
        }
      });
      item.appendChild(delBtn);
    }
    container.appendChild(item);
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
  loadAyahAndAnnotations(newSurah, newAyah);
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
  loadAyahAndAnnotations(progress.surah, progress.ayah);
  updateProgressDisplay();
});