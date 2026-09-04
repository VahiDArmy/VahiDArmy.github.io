let currentUser = null;
let currentFood = null;
let currentGoals = {
  calories: 2000,
  protein: 100,
  carbs: 200,
  fat: 70
};

let weightChart = null;
let foods = [];
let todayLogs = [];

const $ = (selector) => document.querySelector(selector);

const today = () => {
  return new Date().toISOString().split("T")[0];
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadFoods();
  setupFoodSearch();

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
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (session?.user) {
    currentUser = session.user;
    await showDashboard();
  } else {
    showAuth();
  }

  $("#modal-quantity")?.addEventListener("input", updateModalCalories);
});