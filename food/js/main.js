import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { signUp, signIn, signOut, getCurrentUser, onAuthStateChange } from './auth.js';
import { getFoods, addIntake, getIntakesByDate, deleteIntake, getIntakesByMonth } from './food.js';
import { calculateDailyStats, calculateMonthlyStats } from './report.js';

// ---------- متغیرهای سراسری ----------
let currentUser = null;
let selectedDate = new Date(); // میلادی
let allFoods = [];
let chartInstance = null;
let currentView = 'dashboard'; // dashboard | report

// ---------- DOM المان‌ها ----------
const app = document.getElementById('app');
const authNav = document.getElementById('authNav');
const viewDashboard = document.getElementById('viewDashboard');
const viewReport = document.getElementById('viewReport');
const viewLogin = document.getElementById('viewLogin');
const viewRegister = document.getElementById('viewRegister');

// دکمه‌های نویگیشن
const navDashboard = document.getElementById('navDashboard');
const navReport = document.getElementById('navReport');
const navLogout = document.getElementById('navLogout');

// المان‌های داشبورد
const datePicker = document.getElementById('datePicker');
const todayBtn = document.getElementById('todayBtn');
const prevDayBtn = document.getElementById('prevDayBtn');
const nextDayBtn = document.getElementById('nextDayBtn');
const foodSelect = document.getElementById('foodSelect');
const quantityInput = document.getElementById('quantityInput');
const addIntakeBtn = document.getElementById('addIntakeBtn');
const intakeBody = document.getElementById('intakeBody');
const statusMsg = document.getElementById('statusMsg');
const totalCalories = document.getElementById('totalCalories');
const totalProtein = document.getElementById('totalProtein');
const totalCarbs = document.getElementById('totalCarbs');
const totalFat = document.getElementById('totalFat');

// المان‌های گزارش
const monthPicker = document.getElementById('monthPicker');
const monthAvg = document.getElementById('monthAvg');
const monthMax = document.getElementById('monthMax');
const monthMin = document.getElementById('monthMin');
const monthDays = document.getElementById('monthDays');
const monthChartCanvas = document.getElementById('monthChart');

// المان‌های ورود و ثبت‌نام
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// ---------- توابع کمکی تاریخ (Jalaali) ----------
function toJalaali(date) {
  const g = date.getFullYear(), m = date.getMonth()+1, d = date.getDate();
  const j = jalaali.toJalaali(g, m, d);
  return `${j.jy}/${j.jm}/${j.jd}`;
}
function fromJalaali(jy, jm, jd) {
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm-1, g.gd);
}
function toGregorianStr(date) {
  return date.toISOString().slice(0,10);
}

// ---------- راه‌اندازی Persian Datepicker ----------
function initDatepicker() {
  const options = {
    format: 'YYYY/MM/DD',
    autoClose: true,
    initialValue: false,
    onSelect: function(unix, text) {
      const parts = text.split('/');
      const jy = parseInt(parts[0]), jm = parseInt(parts[1]), jd = parseInt(parts[2]);
      selectedDate = fromJalaali(jy, jm, jd);
      loadDailyIntake();
    }
  };
  return new PersianDatepicker(datePicker, options);
}
let datepickerInstance = null;

// ---------- نمایش صفحات ----------
function showView(viewName) {
  // مخفی کردن همه
  [viewDashboard, viewReport, viewLogin, viewRegister].forEach(el => el.style.display = 'none');
  // نمایش صفحه مورد نظر
  if (viewName === 'dashboard') viewDashboard.style.display = 'block';
  else if (viewName === 'report') viewReport.style.display = 'block';
  else if (viewName === 'login') viewLogin.style.display = 'block';
  else if (viewName === 'register') viewRegister.style.display = 'block';
  currentView = viewName;
}

// ---------- به‌روزرسانی نویگیشن ----------
function updateNav(user) {
  if (user) {
    authNav.innerHTML = `
      <span class="user-greeting">👤 ${user.user_metadata?.full_name || user.email}</span>
    `;
    document.querySelectorAll('.nav-item').forEach(el => el.style.display = 'inline-block');
    navLogout.style.display = 'inline-block';
    showView('dashboard');
  } else {
    authNav.innerHTML = ``;
    document.querySelectorAll('.nav-item').forEach(el => el.style.display = 'none');
    navLogout.style.display = 'none';
    showView('login');
  }
}

// ---------- بارگذاری لیست غذاها ----------
async function loadFoods() {
  if (!currentUser) return;
  try {
    allFoods = await getFoods(currentUser.id);
    foodSelect.innerHTML = '';
    allFoods.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = `${f.persian_name} (${f.calories} کالری/گرم)`;
      opt.dataset.calories = f.calories;
      opt.dataset.protein = f.protein || 0;
      opt.dataset.carbs = f.carbs || 0;
      opt.dataset.fat = f.fat || 0;
      foodSelect.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
  }
}

// ---------- بارگذاری مصرف روزانه ----------
async function loadDailyIntake() {
  if (!currentUser) return;
  const dateStr = toGregorianStr(selectedDate);
  statusMsg.textContent = '⏳ در حال بارگذاری...';
  try {
    const intakes = await getIntakesByDate(currentUser.id, dateStr);
    const stats = calculateDailyStats(intakes);

    // نمایش در جدول
    if (intakes.length === 0) {
      intakeBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#aaa;">مصرفی ثبت نشده</td></tr>`;
    } else {
      let html = '';
      intakes.forEach(item => {
        const food = item.foods || {};
        html += `<tr>
          <td>${food.persian_name || 'نامشخص'}</td>
          <td>${item.quantity}</td>
          <td>${item.total_calories.toFixed(0)}</td>
          <td><button class="delete-btn" data-id="${item.id}">✕</button></td>
        </tr>`;
      });
      intakeBody.innerHTML = html;
      // اتصال رویداد حذف
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          if (confirm('آیا از حذف این آیتم مطمئنید؟')) {
            await deleteIntake(id);
            loadDailyIntake();
            loadMonthlyReport();
          }
        });
      });
    }

    // به‌روزرسانی آمار
    totalCalories.textContent = stats.totalCal.toFixed(0);
    totalProtein.textContent = stats.totalProt.toFixed(1);
    totalCarbs.textContent = stats.totalCarb.toFixed(1);
    totalFat.textContent = stats.totalFat.toFixed(1);
    statusMsg.textContent = `✅ ${intakes.length} مورد برای ${toJalaali(selectedDate)}`;
  } catch (err) {
    statusMsg.textContent = '❌ خطا: ' + err.message;
  }
}

// ---------- افزودن مصرف جدید ----------
async function handleAddIntake() {
  if (!currentUser) return;
  const foodId = parseInt(foodSelect.value);
  const quantity = parseFloat(quantityInput.value) || 0;
  if (!foodId || quantity <= 0) {
    alert('لطفاً غذا و مقدار معتبر وارد کنید.');
    return;
  }
  const food = allFoods.find(f => f.id === foodId);
  if (!food) return;
  const totalCal = (food.calories || 0) * quantity;
  const dateStr = toGregorianStr(selectedDate);

  try {
    await addIntake(currentUser.id, foodId, dateStr, quantity, totalCal);
    loadDailyIntake();
    loadMonthlyReport();
  } catch (err) {
    alert('خطا: ' + err.message);
  }
}

// ---------- گزارش ماهانه ----------
async function loadMonthlyReport() {
  if (!currentUser) return;
  // ماه جاری بر اساس selectedDate
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  try {
    const data = await getIntakesByMonth(currentUser.id, year, month);
    const stats = calculateMonthlyStats(data);

    // به‌روزرسانی کارت‌ها
    monthAvg.textContent = stats.avg.toFixed(0);
    monthMax.textContent = stats.max.toFixed(0);
    monthMin.textContent = stats.min.toFixed(0);
    monthDays.textContent = stats.count;

    // رسم نمودار
    const ctx = monthChartCanvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();
    if (stats.days.length === 0) {
      // نمایش پیام بدون داده
      chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['هیچ داده‌ای'],
          datasets: [{ label: 'کالری', data: [0], backgroundColor: '#555' }]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#e0e0ff' } } } }
      });
      return;
    }
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: stats.days.map(d => {
          const g = new Date(d + 'T00:00:00');
          return toJalaali(g);
        }),
        datasets: [{
          label: 'کالری مصرفی',
          data: stats.values,
          backgroundColor: 'rgba(0, 255, 255, 0.6)',
          borderColor: '#00ffff',
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#e0e0ff' } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#e0e0ff' } },
          x: { grid: { display: false }, ticks: { color: '#e0e0ff', maxRotation: 45 } }
        }
      }
    });
  } catch (err) {
    console.error(err);
  }
}

// ---------- کنترل تاریخ ----------
function updateDatepickerDisplay() {
  const j = toJalaali(selectedDate);
  datePicker.value = j;
  if (datepickerInstance) {
    datepickerInstance.setDate(j);
  }
  loadDailyIntake();
  loadMonthlyReport();
}

function goToday() {
  selectedDate = new Date();
  updateDatepickerDisplay();
}
function goPrevDay() {
  const d = new Date(selectedDate);
  d.setDate(d.getDate() - 1);
  selectedDate = d;
  updateDatepickerDisplay();
}
function goNextDay() {
  const d = new Date(selectedDate);
  d.setDate(d.getDate() + 1);
  selectedDate = d;
  updateDatepickerDisplay();
}

// ---------- مدیریت احراز هویت ----------
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    await signIn(email, password);
    // پس از ورود، صفحه به‌روز می‌شود
  } catch (err) {
    alert('ورود ناموفق: ' + err.message);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const fullName = document.getElementById('registerName').value;
  try {
    await signUp(email, password, fullName);
    alert('ثبت‌نام موفق! لطفاً وارد شوید.');
    showView('login');
  } catch (err) {
    alert('ثبت‌نام ناموفق: ' + err.message);
  }
}

async function handleLogout() {
  await signOut();
  // صفحه به‌روز می‌شود
}

// ---------- رویدادهای نویگیشن ----------
navDashboard.addEventListener('click', () => showView('dashboard'));
navReport.addEventListener('click', () => {
  showView('report');
  loadMonthlyReport();
});
navLogout.addEventListener('click', handleLogout);

// ---------- مقداردهی اولیه ----------
async function init() {
  // اتصال رویدادهای فرم‌ها
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);

  // دکمه‌های تاریخ
  todayBtn.addEventListener('click', goToday);
  prevDayBtn.addEventListener('click', goPrevDay);
  nextDayBtn.addEventListener('click', goNextDay);
  addIntakeBtn.addEventListener('click', handleAddIntake);

  // گوش دادن به تغییرات احراز هویت
  onAuthStateChange((event, user) => {
    currentUser = user;
    updateNav(user);
    if (user) {
      loadFoods();
      goToday(); // بارگذاری داده‌های امروز
    }
  });

  // بررسی کاربر فعلی در شروع
  try {
    const user = await getCurrentUser();
    currentUser = user;
    updateNav(user);
    if (user) {
      await loadFoods();
      datepickerInstance = initDatepicker();
      goToday();
    } else {
      showView('login');
    }
  } catch (err) {
    console.error(err);
    showView('login');
  }
}

// اجرا
init();