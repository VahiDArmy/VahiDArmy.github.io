/* =========================================================
   Neon Calorie Tracker - app.js
   ========================================================= */

let currentUser = null;
let currentFood = null;
let weightChart = null;

let foods = [];
let todayLogs = [];

let currentGoals = {
  calories: 2000,
  protein: 100,
  carbs: 200,
  fat: 70
};

let authMode = "login";

/* ---------------------------------------------------------
   توابع کمکی
   --------------------------------------------------------- */

const $ = (selector) => document.querySelector(selector);

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function setValue(selector, value) {
  const element = $(selector);
  if (element) element.value = value;
}

function setWidth(selector, value, goal) {
  const element = $(selector);
  if (!element) return;

  const percentage = goal > 0 ? (value / goal) * 100 : 0;
  element.style.width = `${Math.min(Math.max(percentage, 0), 100)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/*
  استفاده از تاریخ محلی، برای جلوگیری از مشکل اختلاف ساعت ایران
*/
function getTodayDate() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function showMessage(message, type = "info") {
  const element =
    type === "error"
      ? $("#auth-error")
      : $("#auth-info");

  if (!element) {
    alert(message);
    return;
  }

  element.textContent = message;

  setTimeout(() => {
    element.textContent = "";
  }, 4000);
}

/* ---------------------------------------------------------
   شروع برنامه
   --------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", async () => {
  await loadFoods();
  setupFoodSearch();
  setupModalEvents();
  setupModalCloseEvents();

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      currentUser = session.user;
      await showDashboard();
    } else {
      currentUser = null;
      showAuth();
    }
  });

  const {
    data: { session },
    error
  } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("خطا در دریافت نشست کاربر:", error);
    showAuth();
    return;
  }

  if (session?.user) {
    currentUser = session.user;
    await showDashboard();
  } else {
    showAuth();
  }
});

/* ---------------------------------------------------------
   بارگذاری غذاها از foods.json
   --------------------------------------------------------- */

async function loadFoods() {
  try {
    const response = await fetch("foods.json");

    if (!response.ok) {
      throw new Error("فایل foods.json پیدا نشد.");
    }

    foods = await response.json();

    if (!Array.isArray(foods)) {
      throw new Error("فرمت foods.json صحیح نیست.");
    }

    console.log(`${foods.length} غذا با موفقیت بارگذاری شد.`);
  } catch (error) {
    console.error("خطا در بارگذاری غذاها:", error);
    showMessage("خطا در بارگذاری فایل غذاها.", "error");
  }
}

/* ---------------------------------------------------------
   مدیریت صفحات
   --------------------------------------------------------- */

function showAuth() {
  $("#auth-view")?.classList.add("active");
  $("#app-view")?.classList.remove("active");
}

async function showDashboard() {
  console.log("showDashboard شروع شد");

  const authView = document.querySelector("#auth-view");
  const appView = document.querySelector("#app-view");

  console.log("authView:", authView);
  console.log("appView:", appView);

  if (!authView || !appView) {
    console.error(
      "عنصر auth-view یا app-view در HTML پیدا نشد."
    );

    showMessage(
      "ساختار HTML صفحه‌ها پیدا نشد. idها را بررسی کنید.",
      "error"
    );

    return;
  }

  authView.classList.remove("active");
  appView.classList.add("active");

  console.log("کلاس‌های صفحات تغییر کردند");

  const userEmail = document.querySelector("#user-email");

  if (userEmail && currentUser) {
    userEmail.textContent = currentUser.email;
  }

  try {
    await loadGoals();
    await loadTodayLogs();
    await loadWeightLogs();

    console.log("اطلاعات داشبورد بارگذاری شد");
  } catch (error) {
    console.error("خطا در بارگذاری داشبورد:", error);
  }
}
/* ---------------------------------------------------------
   ورود و ثبت‌نام
   --------------------------------------------------------- */

function switchAuthMode(mode) {
  authMode = mode;

  $("#login-tab")?.classList.toggle("active", mode === "login");
  $("#signup-tab")?.classList.toggle("active", mode === "signup");

  if ($("#auth-submit")) {
    $("#auth-submit").textContent =
      mode === "login"
        ? "🚀 ورود به سیستم"
        : "🆕 ایجاد حساب کاربری";
  }

  if ($("#auth-error")) {
    $("#auth-error").textContent = "";
  }

  if ($("#auth-info")) {
    $("#auth-info").textContent = "";
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  console.log("1) تابع ورود اجرا شد");

  const email = document.querySelector("#auth-email")?.value.trim();
  const password = document.querySelector("#auth-password")?.value;

  const button = document.querySelector("#auth-submit");

  if (!email || !password) {
    showMessage("ایمیل و رمز عبور را وارد کنید.", "error");
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "در حال ورود...";
  }

  try {
    const result = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    console.log("2) نتیجه ورود:", result);
    console.log("User:", result.data?.user);
    console.log("Session:", result.data?.session);
    console.log("Error:", result.error);

    if (result.error) {
      showMessage(
        translateAuthError(result.error.message),
        "error"
      );
      return;
    }

    if (!result.data?.session || !result.data?.user) {
      console.log("ورود کامل نشده و session وجود ندارد.");
      showMessage(
        "ورود انجام نشد؛ session دریافت نشد.",
        "error"
      );
      return;
    }

    currentUser = result.data.user;

    console.log("3) کاربر با موفقیت وارد شد:", currentUser);

    await showDashboard();

    console.log("4) showDashboard اجرا شد");
  } catch (error) {
    console.error("خطای غیرمنتظره هنگام ورود:", error);
    showMessage("خطایی هنگام ورود رخ داد. Console را بررسی کنید.", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "🚀 ورود به سیستم";
    }
  }
}
async function handleLogout() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error(error);
    showMessage("خروج از حساب انجام نشد.", "error");
    return;
  }

  currentUser = null;
  showAuth();
}

function translateAuthError(message) {
  if (message.includes("Invalid login credentials")) {
    return "ایمیل یا رمز عبور اشتباه است.";
  }

  if (message.includes("User already registered")) {
    return "این ایمیل قبلاً ثبت‌نام کرده است.";
  }

  if (message.includes("Password should be at least")) {
    return "رمز عبور باید حداقل ۶ کاراکتر باشد.";
  }

  if (message.includes("Email not confirmed")) {
    return "ابتدا ایمیل خود را تأیید کنید.";
  }

  return message;
}

/* ---------------------------------------------------------
   جستجوی غذا
   --------------------------------------------------------- */

function setupFoodSearch() {
  const input = $("#food-search");
  const results = $("#search-results");

  if (!input || !results) return;

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();

    if (!query) {
      results.innerHTML = "";
      results.classList.add("hidden");
      return;
    }

    const matches = foods
      .filter((food) => {
        const persianName = String(food.Persian_Name || "").toLowerCase();
        const englishName = String(food.Name_En || "").toLowerCase();

        return (
          persianName.includes(query) ||
          englishName.includes(query)
        );
      })
      .slice(0, 15);

    results.innerHTML = "";

    if (matches.length === 0) {
      results.innerHTML = `
        <div class="empty-msg">
          غذایی با این نام پیدا نشد
        </div>
      `;

      results.classList.remove("hidden");
      return;
    }

    matches.forEach((food) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "search-result-item";

      button.innerHTML = `
        <span>${escapeHtml(food.Persian_Name)}</span>
        <small>${round(food.Calories)} kcal / 100g</small>
      `;

      button.addEventListener("click", () => {
        openQuantityModal(food);
      });

      results.appendChild(button);
    });

    results.classList.remove("hidden");
  });
}

/* ---------------------------------------------------------
   مودال مقدار غذا
   --------------------------------------------------------- */

function setupModalEvents() {
  const quantityInput = $("#modal-quantity");

  if (quantityInput) {
    quantityInput.addEventListener("input", updateModalCalories);
  }
}

function setupModalCloseEvents() {
  const modal = $("#quantity-modal");

  if (!modal) return;

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeQuantityModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeQuantityModal();
    }
  });
}

function openQuantityModal(food) {
  currentFood = food;

  setText("#modal-food-name", food.Persian_Name);

  setText(
    "#modal-food-calories",
    `${round(food.Calories)} کیلوکالری در هر ۱۰۰ گرم`
  );

  setValue("#modal-quantity", 100);
  updateModalCalories();

  $("#quantity-modal")?.classList.remove("hidden");
  $("#search-results")?.classList.add("hidden");
}

function closeQuantityModal() {
  currentFood = null;
  $("#quantity-modal")?.classList.add("hidden");
}

function updateModalCalories() {
  if (!currentFood) return;

  const quantity = Number($("#modal-quantity")?.value || 0);
  const calories =
    (Number(currentFood.Calories || 0) * quantity) / 100;

  setText("#modal-calculated", `≈ ${round(calories)} kcal`);
}

/* ---------------------------------------------------------
   افزودن غذا به دیتابیس
   --------------------------------------------------------- */

async function confirmAddFood() {
  if (!currentFood || !currentUser) return;

  const quantity = Number($("#modal-quantity")?.value);

  if (!quantity || quantity <= 0) {
    alert("مقدار غذا را به‌درستی وارد کنید.");
    return;
  }

  /*
    داده‌های foods.json بر اساس ۱۰۰ گرم هستند.
    بنابراین مقدار واردشده در ضریب quantity / 100 ضرب می‌شود.
  */
  const multiplier = quantity / 100;

  const foodLog = {
    user_id: currentUser.id,
    food_name: currentFood.Persian_Name || currentFood.Name_En,
    quantity: quantity,
    calories: Number(currentFood.Calories || 0) * multiplier,
    protein: Number(currentFood.Protein || 0) * multiplier,
    carbs: Number(currentFood.Carbs || 0) * multiplier,
    fat: Number(currentFood.Fat || 0) * multiplier,
    consumed_at: getTodayDate()
  };

  const { error } = await supabaseClient
    .from("food_logs")
    .insert(foodLog);

  if (error) {
    console.error("خطا در ثبت غذا:", error);
    showMessage("ثبت غذا انجام نشد.", "error");
    return;
  }

  closeQuantityModal();

  if ($("#food-search")) {
    $("#food-search").value = "";
  }

  await loadTodayLogs();
}

/* ---------------------------------------------------------
   دریافت غذاهای امروز
   --------------------------------------------------------- */

async function loadTodayLogs() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("food_logs")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("consumed_at", getTodayDate())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("خطا در دریافت غذاها:", error);
    return;
  }

  todayLogs = data || [];

  renderTodayLogs();
  updateDashboardStats();
}

/* ---------------------------------------------------------
   نمایش غذاهای امروز
   --------------------------------------------------------- */

function renderTodayLogs() {
  const container = $("#food-log-list");

  if (!container) return;

  if (todayLogs.length === 0) {
    container.innerHTML = `
      <p class="empty-msg">
        📡 هنوز داده‌ای ثبت نشده است...
      </p>
    `;

    return;
  }

  container.innerHTML = todayLogs
    .map((log) => {
      return `
        <div class="food-log-item">
          <div>
            <strong>${escapeHtml(log.food_name)}</strong>
            <small>${round(log.quantity)} گرم</small>
          </div>

          <div class="food-log-nutrients">
            <span>${round(log.calories)} kcal</span>
            <small>P: ${round(log.protein)}g</small>
            <small>C: ${round(log.carbs)}g</small>
            <small>F: ${round(log.fat)}g</small>
          </div>

          <button
            type="button"
            class="delete-food"
            onclick="deleteFoodLog(${log.id})"
            title="حذف غذا"
          >
            ×
          </button>
        </div>
      `;
    })
    .join("");
}

/* ---------------------------------------------------------
   حذف غذای ثبت‌شده
   --------------------------------------------------------- */

async function deleteFoodLog(id) {
  if (!currentUser) return;

  const confirmed = confirm("این مورد از لیست حذف شود؟");

  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("food_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("خطا در حذف غذا:", error);
    showMessage("حذف غذا انجام نشد.", "error");
    return;
  }

  await loadTodayLogs();
}

/* ---------------------------------------------------------
   محاسبه و نمایش آمار داشبورد
   --------------------------------------------------------- */

function updateDashboardStats() {
  const totals = todayLogs.reduce(
    (result, item) => {
      result.calories += Number(item.calories || 0);
      result.protein += Number(item.protein || 0);
      result.carbs += Number(item.carbs || 0);
      result.fat += Number(item.fat || 0);

      return result;
    },
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    }
  );

  const caloriePercentage =
    currentGoals.calories > 0
      ? (totals.calories / currentGoals.calories) * 100
      : 0;

  setText("#today-calories", round(totals.calories));
  setText("#daily-goal", round(currentGoals.calories));

  setText(
    "#remaining-calories",
    round(Math.max(currentGoals.calories - totals.calories, 0))
  );

  setText("#progress-percent", `${round(caloriePercentage)}%`);

  if ($("#today-fill")) {
    $("#today-fill").style.width =
      `${Math.min(caloriePercentage, 100)}%`;
  }

  if ($("#calorie-progress-bar")) {
    $("#calorie-progress-bar").style.width =
      `${Math.min(caloriePercentage, 100)}%`;
  }

  setText("#protein-value", round(totals.protein));
  setText("#carbs-value", round(totals.carbs));
  setText("#fat-value", round(totals.fat));

  setText("#protein-goal", round(currentGoals.protein));
  setText("#carbs-goal", round(currentGoals.carbs));
  setText("#fat-goal", round(currentGoals.fat));

  setWidth("#protein-bar", totals.protein, currentGoals.protein);
  setWidth("#carbs-bar", totals.carbs, currentGoals.carbs);
  setWidth("#fat-bar", totals.fat, currentGoals.fat);
}

/* ---------------------------------------------------------
   اهداف روزانه
   --------------------------------------------------------- */

async function loadGoals() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("خطا در دریافت اهداف:", error);
    return;
  }

  if (data) {
    currentGoals = {
      calories: Number(data.daily_calorie_goal || 2000),
      protein: Number(data.protein_goal || 100),
      carbs: Number(data.carbs_goal || 200),
      fat: Number(data.fat_goal || 70)
    };
  }

  setValue("#goal-input", currentGoals.calories);
  setValue("#protein-goal-input", currentGoals.protein);
  setValue("#carbs-goal-input", currentGoals.carbs);
  setValue("#fat-goal-input", currentGoals.fat);

  updateDashboardStats();
}

async function handleSaveGoals() {
  if (!currentUser) return;

  const calories = Number($("#goal-input")?.value);
  const protein = Number($("#protein-goal-input")?.value);
  const carbs = Number($("#carbs-goal-input")?.value);
  const fat = Number($("#fat-goal-input")?.value);

  if (
    !calories ||
    calories < 500 ||
    !protein ||
    protein < 0 ||
    !carbs ||
    carbs < 0 ||
    !fat ||
    fat < 0
  ) {
    alert("لطفاً مقادیر معتبر برای اهداف وارد کنید.");
    return;
  }

  const profile = {
    id: currentUser.id,
    daily_calorie_goal: calories,
    protein_goal: protein,
    carbs_goal: carbs,
    fat_goal: fat
  };

  const { error } = await supabaseClient
    .from("profiles")
    .upsert(profile);

  if (error) {
    console.error("خطا در ذخیره اهداف:", error);
    showMessage("ذخیره اهداف انجام نشد.", "error");
    return;
  }

  currentGoals = {
    calories,
    protein,
    carbs,
    fat
  };

  updateDashboardStats();
  showMessage("اهداف با موفقیت ذخیره شدند.");
}

/* ---------------------------------------------------------
   ثبت وزن
   --------------------------------------------------------- */

async function handleAddWeight() {
  if (!currentUser) return;

  const weight = Number($("#weight-input")?.value);

  if (!weight || weight < 20 || weight > 500) {
    alert("یک وزن معتبر بین ۲۰ تا ۵۰۰ کیلوگرم وارد کنید.");
    return;
  }

  const weightLog = {
    user_id: currentUser.id,
    weight,
    recorded_at: getTodayDate()
  };

  const { error } = await supabaseClient
    .from("weight_logs")
    .upsert(weightLog, {
      onConflict: "user_id,recorded_at"
    });

  if (error) {
    console.error("خطا در ثبت وزن:", error);
    showMessage("ثبت وزن انجام نشد.", "error");
    return;
  }

  $("#weight-input").value = "";

  await loadWeightLogs();
}

/* ---------------------------------------------------------
   دریافت وزن‌ها
   --------------------------------------------------------- */

async function loadWeightLogs() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("weight_logs")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("recorded_at", { ascending: true });

  if (error) {
    console.error("خطا در دریافت وزن‌ها:", error);
    return;
  }

  renderWeightChart(data || []);
}

/* ---------------------------------------------------------
   نمودار وزن با Chart.js
   --------------------------------------------------------- */

function renderWeightChart(logs) {
  const canvas = $("#weight-chart");

  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  if (weightChart) {
    weightChart.destroy();
  }

  weightChart = new Chart(canvas, {
    type: "line",

    data: {
      labels: logs.map((item) => item.recorded_at),

      datasets: [
        {
          label: "وزن",

          data: logs.map((item) => Number(item.weight)),

          borderColor: "#00fff9",
          backgroundColor: "rgba(0, 255, 249, 0.12)",

          pointBackgroundColor: "#ff00aa",
          pointBorderColor: "#00fff9",
          pointRadius: 5,

          borderWidth: 2,
          tension: 0.35,
          fill: true
        }
      ]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          labels: {
            color: "#d8d8f0",
            font: {
              family: "Vazirmatn"
            }
          }
        }
      },

      scales: {
        x: {
          ticks: {
            color: "#7a7a9a",
            font: {
              family: "Vazirmatn"
            }
          },

          grid: {
            color: "rgba(0, 255, 249, 0.1)"
          }
        },

        y: {
          ticks: {
            color: "#7a7a9a",
            font: {
              family: "Vazirmatn"
            }
          },

          grid: {
            color: "rgba(0, 255, 249, 0.1)"
          }
        }
      }
    }
  });
}