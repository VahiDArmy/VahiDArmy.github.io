// ========== تم ==========
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = document.getElementById('themeToggle');
  if (icon) {
    const theme = document.documentElement.getAttribute('data-theme');
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// ========== دراپ‌داون‌ها ==========
let metadataCache = null;

async function getMetadata() {
  if (!metadataCache) {
    metadataCache = await loadMetadata();
  }
  return metadataCache;
}

async function populateSurahSelect(selectElement) {
  const metadata = await getMetadata();
  selectElement.innerHTML = '<option value="">-- انتخاب سوره --</option>';
  metadata.forEach(surah => {
    const option = document.createElement('option');
    option.value = surah.number;
    option.textContent = `${surah.number} - ${surah.name}`;
    selectElement.appendChild(option);
  });
}

async function populateAyahSelect(surahNumber, selectElement) {
  selectElement.innerHTML = '<option value="">-- انتخاب آیه --</option>';
  if (!surahNumber) {
    selectElement.disabled = true;
    return;
  }
  const metadata = await getMetadata();
  const surahMeta = metadata.find(s => s.number === parseInt(surahNumber));
  if (!surahMeta) {
    selectElement.disabled = true;
    return;
  }
  const totalAyahs = surahMeta.totalAyahs;
  for (let i = 1; i <= totalAyahs; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    selectElement.appendChild(option);
  }
  selectElement.disabled = false;
}

// ========== نمایش آیه و ترجمه ==========
function displayAyah(ayahData) {
  const ayahTextEl = document.getElementById('ayahText');
  const translationTextEl = document.getElementById('translationText');
  if (!ayahData) {
    ayahTextEl.textContent = 'آیه انتخاب نشده است';
    translationTextEl.textContent = '';
    return;
  }
  ayahTextEl.textContent = ayahData.text;
  translationTextEl.textContent = ayahData.translation;
}

// ========== احراز هویت ادمین ==========
let adminSession = null;

async function checkAdminAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  adminSession = session;
  updateAdminUI();
  return session;
}

async function signInAdmin(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email, password
  });
  if (error) {
    console.error('خطا در ورود:', error.message);
    document.getElementById('loginError').textContent = 'ورود ناموفق: ' + error.message;
    return false;
  }
  adminSession = data.session;
  // پاک کردن پیام خطا
  document.getElementById('loginError').textContent = '';
  // مخفی کردن فرم
  document.getElementById('adminLoginForm').style.display = 'none';
  updateAdminUI();
  return true;
}

async function signOutAdmin() {
  await supabaseClient.auth.signOut();
  adminSession = null;
  updateAdminUI();
}

function updateAdminUI() {
  const adminBtn = document.getElementById('adminBtn');
  const adminStatus = document.getElementById('adminStatus');
  const annotationForm = document.getElementById('annotationFormWrapper');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const isAdmin = adminSession && adminSession.user && adminSession.user.id === ADMIN_UUID;

  if (adminBtn) {
    adminBtn.textContent = isAdmin ? 'خروج ادمین' : 'ورود ادمین';
  }
  if (adminStatus) {
    adminStatus.textContent = isAdmin ? 'وضعیت: ادمین' : '';
  }
  if (annotationForm) {
    annotationForm.style.display = isAdmin ? 'block' : 'none';
  }
  // اگر ادمین وارد شده، فرم ورود مخفی باشد
  if (adminLoginForm) {
    adminLoginForm.style.display = 'none';
  }
}

// ========== کامنت‌ها ==========
async function loadComments(surah, ayah) {
  const commentsList = document.getElementById('commentsList');
  if (!commentsList) return;
  commentsList.innerHTML = '<p class="loading-text">در حال بارگذاری نظرات...</p>';

  const { data, error } = await supabaseClient
    .from('comments')
    .select('*')
    .eq('surah', surah)
    .eq('ayah', ayah)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('خطا در بارگذاری کامنت‌ها:', error);
    commentsList.innerHTML = '<p>خطا در بارگذاری نظرات</p>';
    return;
  }

  if (data.length === 0) {
    commentsList.innerHTML = '<p class="empty-text">هنوز نظری ثبت نشده است.</p>';
    return;
  }

  commentsList.innerHTML = '';
  data.forEach(comment => {
    const item = document.createElement('div');
    item.className = 'comment-item';
    item.innerHTML = `
      <div class="comment-header">
        <span class="comment-author">${comment.author_name || 'ناشناس'}</span>
        <span class="comment-type">${comment.type || 'critique'}</span>
        <span class="comment-date">${new Date(comment.created_at).toLocaleDateString('fa-IR')}</span>
      </div>
      <div class="comment-content">${comment.content}</div>
    `;
    commentsList.appendChild(item);
  });
}

async function submitComment(surah, ayah) {
  const honeypot = document.getElementById('honeypot');
  if (honeypot && honeypot.value) {
    // ربات تشخیص داده شد
    return;
  }

  const author = document.getElementById('commentAuthor')?.value.trim() || null;
  const type = document.getElementById('commentType')?.value || 'critique';
  const content = document.getElementById('commentContent')?.value.trim();

  if (!content) {
    alert('متن نظر نمی‌تواند خالی باشد');
    return;
  }

  const { data, error } = await supabaseClient
    .from('comments')
    .insert([
      {
        surah: parseInt(surah),
        ayah: parseInt(ayah),
        author_name: author,
        type: type,
        content: content,
        status: 'pending' // پیش‌فرض در انتظار تأیید
      }
    ]);

  if (error) {
    console.error('خطا در ثبت نظر:', error);
    alert('خطا در ارسال نظر. لطفاً دوباره تلاش کنید.');
    return;
  }

  // پاک کردن فرم
  document.getElementById('commentContent').value = '';
  document.getElementById('commentAuthor').value = '';
  alert('نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود.');
  // بارگذاری مجدد کامنت‌ها (فقط تأیید شده‌ها)
  loadComments(surah, ayah);
}

// ========== مقداردهی اولیه ==========
document.addEventListener('DOMContentLoaded', async () => {
  // تم
  initTheme();
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  // احراز هویت
  await checkAdminAuth();

  // دکمه ادمین
  const adminBtn = document.getElementById('adminBtn');
  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      const isAdmin = adminSession && adminSession.user.id === ADMIN_UUID;
      if (isAdmin) {
        // خروج
        signOutAdmin();
      } else {
        // نمایش فرم ورود
        const loginForm = document.getElementById('adminLoginForm');
        loginForm.style.display = 'block';
        // فوکوس روی فیلد ایمیل
        document.getElementById('loginEmail').focus();
      }
    });
  }

  // مدیریت ارسال فرم ورود
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      if (email && password) {
        await signInAdmin(email, password);
      }
    });
  }

  // دکمه انصراف
  const cancelLoginBtn = document.getElementById('cancelLoginBtn');
  if (cancelLoginBtn) {
    cancelLoginBtn.addEventListener('click', () => {
      document.getElementById('adminLoginForm').style.display = 'none';
      document.getElementById('loginError').textContent = '';
    });
  }

  // دراپ‌داون‌ها را در صورت وجود پر کن
  const surahSelect = document.getElementById('surahSelect');
  if (surahSelect) {
    await populateSurahSelect(surahSelect);
    surahSelect.addEventListener('change', async (e) => {
      const surahNumber = e.target.value;
      const ayahSelect = document.getElementById('ayahSelect');
      await populateAyahSelect(surahNumber, ayahSelect);
      // در صورت تغییر، رویداد تغییر آیه را صدا بزن
      if (typeof onAyahSelectionChange === 'function') onAyahSelectionChange();
    });
  }

  const ayahSelect = document.getElementById('ayahSelect');
  if (ayahSelect) {
    ayahSelect.addEventListener('change', () => {
      if (typeof onAyahSelectionChange === 'function') onAyahSelectionChange();
    });
  }

  // نمایش/عدم نمایش ترجمه
  const translationToggle = document.getElementById('translationToggle');
  if (translationToggle) {
    translationToggle.addEventListener('click', () => {
      const collapse = document.getElementById('translationCollapse');
      collapse.classList.toggle('open');
    });
  }

  // ارسال کامنت
  const commentForm = document.getElementById('commentForm');
  if (commentForm) {
    commentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const surahSelect = document.getElementById('surahSelect');
      const ayahSelect = document.getElementById('ayahSelect');
      if (surahSelect && ayahSelect && surahSelect.value && ayahSelect.value) {
        submitComment(surahSelect.value, ayahSelect.value);
      } else {
        alert('ابتدا سوره و آیه را انتخاب کنید.');
      }
    });
  }
});
