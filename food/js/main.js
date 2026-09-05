import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { signUp, signIn, signOut, getCurrentUser, onAuthStateChange } from './auth.js';
import { getFoods, addIntake, getIntakesByDate, deleteIntake, getIntakesByMonth } from './food.js';
import { calculateDailyStats, calculateMonthlyStats } from './report.js';

// ---------- STATE ----------
let currentUser = null;
let selectedDate = new Date();
let allFoods = [];
let chartInstance = null;
let datepickerInstance = null;

// ---------- DOM REFS ----------
const $ = id => document.getElementById(id);
const authNav = $('authNav');
const viewDashboard = $('viewDashboard');
const viewReport = $('viewReport');
const viewLogin = $('viewLogin');
const viewRegister = $('viewRegister');
const navDashboard = $('navDashboard');
const navReport = $('navReport');
const navLogout = $('navLogout');
const datePicker = $('datePicker');
const todayBtn = $('todayBtn');
const prevDayBtn = $('prevDayBtn');
const nextDayBtn = $('nextDayBtn');
const foodSelect = $('foodSelect');
const quantityInput = $('quantityInput');
const addIntakeBtn = $('addIntakeBtn');
const intakeBody = $('intakeBody');
const statusMsg = $('statusMsg');
const totalCalories = $('totalCalories');
const totalProtein = $('totalProtein');
const totalCarbs = $('totalCarbs');
const totalFat = $('totalFat');
const monthAvg = $('monthAvg');
const monthMax = $('monthMax');
const monthMin = $('monthMin');
const monthDays = $('monthDays');
const monthChartCanvas = $('monthChart');
const loginForm = $('loginForm');
const registerForm = $('registerForm');
const switchToRegister = $('switchToRegister');
const switchToLogin = $('switchToLogin');

// ---------- DATE HELPERS ----------
function toJalaali(date) {
  const j = jalaali.toJalaali(date.getFullYear(), date.getMonth()+1, date.getDate());
  return `${j.jy}/${String(j.jm).padStart(2,'0')}/${String(j.jd).padStart(2,'0')}`;
}
function fromJalaali(jy, jm, jd) {
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm-1, g.gd);
}
function toGregorianStr(date) { return date.toISOString().slice(0,10); }

// ---------- VIEWS ----------
function showView(name) {
  [viewDashboard, viewReport, viewLogin, viewRegister].forEach(el => el.style.display = 'none');
  if (name === 'dashboard') viewDashboard.style.display = 'block';
  else if (name === 'report') viewReport.style.display = 'block';
  else if (name === 'login') viewLogin.style.display = 'block';
  else if (name === 'register') viewRegister.style.display = 'block';
  // active nav
  [navDashboard, navReport].forEach(el => el.classList.remove('active'));
  if (name === 'dashboard') navDashboard.classList.add('active');
  if (name === 'report') navReport.classList.add('active');
}

// ---------- AUTH UI ----------
function updateNav(user) {
  if (user) {
    authNav.innerHTML = `<span class="user-greeting">${user.user_metadata?.full_name || user.email}</span>`;
    navLogout.style.display = 'inline-flex';
    showView('dashboard');
  } else {
    authNav.innerHTML = '';
    navLogout.style.display = 'none';
    showView('login');
  }
}

// ---------- DATEPICKER ----------
function initDatepicker() {
  const options = {
    format: 'YYYY/MM/DD',
    autoClose: true,
    initialValue: false,
    onSelect: function(_, text) {
      const parts = text.split('/').map(Number);
      selectedDate = fromJalaali(parts[0], parts[1], parts[2]);
      loadDailyIntake();
    }
  };
  datepickerInstance = new PersianDatepicker(datePicker, options);
}

function updateDatepickerDisplay() {
  const j = toJalaali(selectedDate);
  datePicker.value = j;
  if (datepickerInstance) datepickerInstance.setDate(j);
  loadDailyIntake();
}

function goToday() { selectedDate = new Date(); updateDatepickerDisplay(); }
function goPrevDay() { selectedDate.setDate(selectedDate.getDate()-1); updateDatepickerDisplay(); }
function goNextDay() { selectedDate.setDate(selectedDate.getDate()+1); updateDatepickerDisplay(); }

// ---------- FOODS ----------
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
  } catch (err) { console.error(err); }
}

// ---------- DAILY INTAKE ----------
async function loadDailyIntake() {
  if (!currentUser) return;
  const dateStr = toGregorianStr(selectedDate);
  statusMsg.textContent = 'در حال بارگذاری...';
  statusMsg.className = '';
  try {
    const intakes = await getIntakesByDate(currentUser.id, dateStr);
    const stats = calculateDailyStats(intakes);

    if (intakes.length === 0) {
      intakeBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem;">هیچ مصرفی ثبت نشده</td></tr>`;
    } else {
      let html = '';
      intakes.forEach(item => {
        const f = item.foods || {};
        html += `<tr>
          <td>${f.persian_name || 'نامشخص'}</td>
          <td>${item.quantity}</td>
          <td>${item.total_calories.toFixed(0)}</td>
          <td><button class="btn btn-danger btn-sm delete-btn" data-id="${item.id}">✕</button></td>
        </tr>`;
      });
      intakeBody.innerHTML = html;
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm('حذف شود؟')) {
            await deleteIntake(btn.dataset.id);
            loadDailyIntake();
            loadMonthlyReport();
          }
        });
      });
    }

    totalCalories.textContent = stats.totalCal.toFixed(0);
    totalProtein.textContent = stats.totalProt.toFixed(1);
    totalCarbs.textContent = stats.totalCarb.toFixed(1);
    totalFat.textContent = stats.totalFat.toFixed(1);
    statusMsg.textContent = `${intakes.length} مورد برای ${toJalaali(selectedDate)}`;
    statusMsg.className = 'success';
  } catch (err) {
    statusMsg.textContent = 'خطا: ' + err.message;
    statusMsg.className = 'error';
  }
}

// ---------- ADD INTAKE ----------
async function handleAddIntake() {
  if (!currentUser) return;
  const foodId = parseInt(foodSelect.value);
  const quantity = parseFloat(quantityInput.value) || 0;
  if (!foodId || quantity <= 0) { alert('لطفاً غذا و مقدار معتبر وارد کنید.'); return; }
  const food = allFoods.find(f => f.id === foodId);
  if (!food) return;
  const totalCal = (food.calories || 0) * quantity;
  try {
    await addIntake(currentUser.id, foodId, toGregorianStr(selectedDate), quantity, totalCal);
    loadDailyIntake();
    loadMonthlyReport();
  } catch (err) { alert('خطا: ' + err.message); }
}

// ---------- MONTHLY REPORT ----------
async function loadMonthlyReport() {
  if (!currentUser) return;
  const year = selectedDate.getFullYear(), month = selectedDate.getMonth();
  try {
    const data = await getIntakesByMonth(currentUser.id, year, month);
    const stats = calculateMonthlyStats(data);

    monthAvg.textContent = stats.avg.toFixed(0);
    monthMax.textContent = stats.max.toFixed(0);
    monthMin.textContent = stats.min.toFixed(0);
    monthDays.textContent = stats.count;

    const ctx = monthChartCanvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();
    if (stats.days.length === 0) {
      chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: ['داده‌ای وجود ندارد'], datasets: [{ label: 'کالری', data: [0], backgroundColor: '#333' }] },
        options: { responsive: true, plugins: { legend: { labels: { color: '#a0a0c0' } } } }
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
          backgroundColor: 'rgba(212, 168, 67, 0.6)',
          borderColor: '#d4a843',
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#a0a0c0' } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0a0c0' } },
          x: { grid: { display: false }, ticks: { color: '#a0a0c0', maxRotation: 40 } }
        }
      }
    });
  } catch (err) { console.error(err); }
}

// ---------- AUTH HANDLERS ----------
async function handleLogin(e) {
  e.preventDefault();
  const email = $('loginEmail').value, password = $('loginPassword').value;
  try { await signIn(email, password); } catch (err) { alert('ورود ناموفق: ' + err.message); }
}
async function handleRegister(e) {
  e.preventDefault();
  const email = $('registerEmail').value, password = $('registerPassword').value, name = $('registerName').value;
  try {
    await signUp(email, password, name);
    alert('ثبت‌نام موفق! لطفاً وارد شوید.');
    showView('login');
  } catch (err) { alert('ثبت‌نام ناموفق: ' + err.message); }
}
async function handleLogout() { await signOut(); }

// ---------- SWITCH AUTH PAGES ----------
switchToRegister?.addEventListener('click', () => showView('register'));
switchToLogin?.addEventListener('click', () => showView('login'));

// ---------- NAV ----------
navDashboard.addEventListener('click', () => showView('dashboard'));
navReport.addEventListener('click', () => { showView('report'); loadMonthlyReport(); });
navLogout.addEventListener('click', handleLogout);

// ---------- DATE CONTROLS ----------
todayBtn.addEventListener('click', goToday);
prevDayBtn.addEventListener('click', goPrevDay);
nextDayBtn.addEventListener('click', goNextDay);
addIntakeBtn.addEventListener('click', handleAddIntake);

// ---------- AUTH STATE ----------
onAuthStateChange((event, user) => {
  currentUser = user;
  updateNav(user);
  if (user) { loadFoods(); goToday(); }
});

// ---------- INIT ----------
(async function init() {
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);

  try {
    const user = await getCurrentUser();
    currentUser = user;
    updateNav(user);
    if (user) {
      initDatepicker();
      await loadFoods();
      goToday();
      loadMonthlyReport();
    }
  } catch (err) { console.error(err); showView('login'); }
})();