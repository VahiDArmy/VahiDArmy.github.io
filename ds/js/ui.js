// ========== نام سوره‌ها ==========
const surahNamesFa = [
  "فاتحه", "بقره", "آل‌عمران", "نساء", "مائده", "انعام", "اعراف", "انفال", "توبه", "یونس",
  "هود", "یوسف", "رعد", "ابراهیم", "حجر", "نحل", "اسراء", "کهف", "مریم", "طه",
  "انبیاء", "حج", "مؤمنون", "نور", "فرقان", "شعراء", "نمل", "قصص", "عنکبوت", "روم",
  "لقمان", "سجده", "احزاب", "سبأ", "فاطر", "یس", "صافات", "ص", "زمر", "غافر",
  "فصلت", "شوری", "زخرف", "دخان", "جاثیه", "احقاف", "محمد", "فتح", "حجرات", "ق",
  "ذاریات", "طور", "نجم", "قمر", "الرحمن", "واقعه", "حدید", "مجادله", "حشر", "ممتحنه",
  "صف", "جمعه", "منافقون", "تغابن", "طلاق", "تحریم", "ملک", "قلم", "حاقه", "معارج",
  "نوح", "جن", "مزمل", "مدثر", "قیامت", "انسان", "مرسلات", "نبأ", "نازعات", "عبس",
  "تکویر", "انفطار", "مطففین", "انشقاق", "بروج", "طارق", "اعلی", "غاشیه", "فجر", "بلد",
  "شمس", "لیل", "ضحی", "شرح", "تین", "علق", "قدر", "بینه", "زلزله", "عادیات",
  "قارعه", "تکاثر", "عصر", "همزه", "فیل", "قریش", "ماعون", "کوثر", "کافرون", "نصر",
  "مسد", "اخلاص", "فلق", "ناس"
];

// ========== تعداد آیات هر سوره ==========
const AYAH_COUNTS = [
  7,286,200,176,120,165,206,75,129,109,
  123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,
  34,30,73,54,45,83,182,88,75,85,
  54,53,89,59,37,35,38,29,18,45,
  60,49,62,55,78,96,29,22,24,13,
  14,11,11,18,12,12,30,52,52,44,
  28,28,20,56,40,31,50,40,46,42,
  29,19,36,25,22,17,19,26,30,20,
  15,21,11,8,8,19,5,8,8,11,
  11,8,3,9,5,4,7,3,6,3,
  5,4,5,6
];

// ========== ذخیره پیشرفت ==========
const PROGRESS_KEY = 'quran_progress';

function getProgress() {
  const saved = localStorage.getItem(PROGRESS_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch(e) {}
  }
  return { surah: 1, ayah: 1 };
}

function saveProgress(surah, ayah) {
  const progress = { surah: parseInt(surah), ayah: parseInt(ayah) };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  updateProgressDisplay();
}

function getGlobalAyahNumber(surah, ayah) {
  let sum = 0;
  for (let i = 0; i < surah - 1; i++) {
    sum += AYAH_COUNTS[i] || 0;
  }
  return sum + ayah;
}

function updateProgressDisplay() {
  const progress = getProgress();
  const global = getGlobalAyahNumber(progress.surah, progress.ayah);
  const percent = (global / 6236) * 100;
  document.getElementById('currentPosition').textContent = `سوره ${progress.surah}، آیه ${progress.ayah}`;
  document.getElementById('progressPercent').textContent = percent.toFixed(2) + '٪';
  document.getElementById('progressFill').style.width = percent + '%';
}

// ========== تم ==========
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
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
async function populateSurahSelect(selectElement) {
  selectElement.innerHTML = '<option value="">-- انتخاب سوره --</option>';
  for (let i = 1; i <= 114; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${i} - ${surahNamesFa[i-1]}`;
    selectElement.appendChild(option);
  }
}

async function populateAyahSelect(surahNumber, selectElement) {
  selectElement.innerHTML = '<option value="">-- انتخاب آیه --</option>';
  if (!surahNumber) {
    selectElement.disabled = true;
    return;
  }
  const surahData = await loadSurahData(surahNumber);
  if (!surahData || !surahData.ayahs) {
    selectElement.disabled = true;
    return;
  }
  const totalAyahs = surahData.ayahs.length;
  for (let i = 1; i <= totalAyahs; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    selectElement.appendChild(option);
  }
  selectElement.disabled = false;
}

// ========== نمایش آیه ==========
function displayAyah(ayahData) {
  const ayahTextEl = document.getElementById('ayahText');
  const translationTextEl = document.getElementById('translationText');
  if (!ayahData) {
    ayahTextEl.textContent = 'آیه انتخاب نشده است';
    translationTextEl.textContent = '';
    return;
  }
  ayahTextEl.textContent = ayahData.ar;
  translationTextEl.textContent = ayahData.fa;
}

// ========== احراز هویت ادمین ==========
let adminSession = null;

async function checkAdminAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  adminSession = session;
  updateAdminUI();
  return session;
}

function isAdmin() {
  return adminSession && adminSession.user && adminSession.user.id === ADMIN_UUID;
}

function updateAdminUI() {
  const adminBtn = document.getElementById('adminBtn');
  const adminStatus = document.getElementById('adminStatus');
  const annotationsContainer = document.getElementById('annotationsContainer');
  const admin = isAdmin();

  if (adminBtn) {
    adminBtn.textContent = admin ? 'خروج ادمین' : 'ورود ادمین';
    adminBtn.onclick = () => {
      if (admin) {
        signOutAdmin();
      } else {
        window.location.href = 'login.html';
      }
    };
  }
  if (adminStatus) {
    adminStatus.textContent = admin ? 'وضعیت: ادمین' : '';
  }
  if (annotationsContainer) {
    annotationsContainer.style.display = admin ? 'block' : 'none';
  }
}

async function signOutAdmin() {
  await supabaseClient.auth.signOut();
  adminSession = null;
  updateAdminUI();
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
          if (!error) loadComments(surah, ayah);
        }
      });
      item.appendChild(delBtn);
    }
    commentsList.appendChild(item);
  });
}

async function submitComment(surah, ayah) {
  const honeypot = document.getElementById('honeypot');
  if (honeypot && honeypot.value) return;

  const authorInput = document.getElementById('commentAuthor');
  const contentInput = document.getElementById('commentContent');
  const typeInput = document.getElementById('commentType');
  const commentStatus = document.getElementById('commentStatus');

  const author = authorInput.value.trim();
  const content = contentInput.value.trim();
  const type = typeInput.value;

  if (!author) {
    commentStatus.textContent = 'نام الزامی است';
    commentStatus.style.color = '#ff3366';
    return;
  }
  if (!content) {
    commentStatus.textContent = 'متن نظر خالی است';
    commentStatus.style.color = '#ff3366';
    return;
  }

  const { error } = await supabaseClient
    .from('comments')
    .insert([{ surah: parseInt(surah), ayah: parseInt(ayah), author_name: author, type, content, status: 'pending' }]);

  if (error) {
    commentStatus.textContent = 'خطا در ثبت نظر';
    commentStatus.style.color = '#ff3366';
    return;
  }

  contentInput.value = '';
  commentStatus.textContent = 'نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود';
  commentStatus.style.color = '#33ff99';
  loadComments(surah, ayah);
}

// ========== مقداردهی اولیه ==========
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  await checkAdminAuth();

  const surahSelect = document.getElementById('surahSelect');
  if (surahSelect) {
    await populateSurahSelect(surahSelect);
    surahSelect.addEventListener('change', async (e) => {
      const ayahSelect = document.getElementById('ayahSelect');
      await populateAyahSelect(e.target.value, ayahSelect);
      if (typeof onAyahSelectionChange === 'function') onAyahSelectionChange();
    });
  }

  const ayahSelect = document.getElementById('ayahSelect');
  if (ayahSelect) {
    ayahSelect.addEventListener('change', () => {
      if (typeof onAyahSelectionChange === 'function') onAyahSelectionChange();
    });
  }

  const translationToggle = document.getElementById('translationToggle');
  if (translationToggle) {
    translationToggle.addEventListener('click', () => {
      document.getElementById('translationCollapse').classList.toggle('open');
    });
  }

  const commentForm = document.getElementById('commentForm');
  if (commentForm) {
    commentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const surahSelect = document.getElementById('surahSelect');
      const ayahSelect = document.getElementById('ayahSelect');
      if (surahSelect.value && ayahSelect.value) {
        submitComment(surahSelect.value, ayahSelect.value);
      } else {
        document.getElementById('commentStatus').textContent = 'ابتدا آیه را انتخاب کنید';
      }
    });
  }

  updateProgressDisplay();
});