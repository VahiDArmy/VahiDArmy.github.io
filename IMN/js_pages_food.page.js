/**
 * Food page — entry first, report block below.
 *
 * Layout:
 *   1. Totals strip (today's macros + progress)
 *   2. Meals grid (entry forms)
 *   3. Report block (daily / weekly / monthly)
 *
 * The day swiper in the topbar drives the date — this page reacts to
 * `date:changed` events instead of owning its own date navigation.
 */

import { $, createElement, delegate } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { modal } from "../components/modal.js";
import { confirm } from "../components/confirm.js";
import { contextMenu } from "../components/context-menu.js";
import { searchField } from "../components/search.js";
import { mountReportBlock } from "../components/report-block.js";
import { chart } from "../components/chart.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { foods } from "../services/foods.service.js";
import { foodLog } from "../services/food-log.service.js";
import { MEALS } from "../config/constants.js";
import { todayISO, addDays, nowTimeStr, formatWeekdayShort, formatShort } from "../utils/date.js";
import { formatInteger, formatNumber, escapeHTML, toLatinDigits } from "../utils/format.js";

export default {
  title: "غذا",
  subtitle: "ثبت غذا و کالری",
  icon: "utensils",

  async render(container) {
    const unsubscribers = [];
    let currentData = null;
    let reportBlock = null;

    await foods.load().catch(() => toast.warning("کتابخانه غذا بارگذاری نشد"));

    container.innerHTML = `
      <div class="food-totals card card--compact" data-food-totals>
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-4 flex-wrap">
            <div class="flex items-center gap-2"><span class="kpi__icon kpi__icon--warning">${icon("flame", { size: 16 })}</span><div><div class="text-2xs text-muted">کالری امروز</div><strong class="num" data-total="calories">0</strong></div></div>
            <div class="flex items-center gap-2"><span class="kpi__icon kpi__icon--success">${icon("zap", { size: 16 })}</span><div><div class="text-2xs text-muted">پروتئین</div><strong class="num" data-total="protein">0</strong></div></div>
            <div class="flex items-center gap-2"><span class="kpi__icon kpi__icon--info">${icon("apple", { size: 16 })}</span><div><div class="text-2xs text-muted">کربوهیدرات</div><strong class="num" data-total="carbs">0</strong></div></div>
            <div class="flex items-center gap-2"><span class="kpi__icon kpi__icon--danger">${icon("droplet", { size: 16 })}</span><div><div class="text-2xs text-muted">چربی</div><strong class="num" data-total="fat">0</strong></div></div>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn btn--secondary btn--sm" data-action="duplicate" type="button" title="کپی روز قبل">
              ${icon("copy", { size: 14 })}<span>کپی روز قبل</span>
            </button>
          </div>
          <div style="min-width:240px;flex:1;max-width:360px">
            <div class="progress-row">
              <div class="progress-row__head">
                <span class="progress-row__label">پیشرفت روزانه</span>
                <span class="progress-row__value"><strong data-total="pct">0</strong>٪</span>
              </div>
              <div class="progress"><div class="progress__bar" data-total="progress" style="width:0%"></div></div>
            </div>
          </div>
        </div>
      </div>

      <section id="food-entry-form" class="section" style="margin-top:20px">
        <div class="section__head">
          <div class="section__title">${icon("utensils", { size: 20 })}<span>وعده‌های امروز</span></div>
        </div>
        <div class="meals-grid" data-meals></div>
      </section>

      <div data-report-slot></div>
    `;

    const mealsWrap = $("[data-meals]", container);

    function currentDate() {
      return store.get("selectedDate") || todayISO();
    }

    delegate(container, "click", "[data-action='duplicate']", async () => {
      const prev = addDays(currentDate(), -1);
      const ok = await confirm({
        title: "کپی وعده‌ها",
        message: `همه وعده‌های روز قبل به امروز کپی شوند؟`,
        confirmLabel: "کپی کن",
        variant: "primary",
      });
      if (!ok) return;
      try {
        const rows = await foodLog.duplicateDay(prev, currentDate());
        toast.success(`${rows.length} آیتم کپی شد`);
      } catch {
        toast.error("کپی ناموفق بود");
      }
    });

    async function load() {
      const iso = currentDate();
      try {
        const { rows, grouped } = await foodLog.listByDate(iso);
        currentData = { rows, grouped, date: iso };
        renderMeals(grouped, iso);
        renderTotals(rows);
        reportBlock?.setDate(iso);
      } catch (err) {
        console.error("[food] load error", err);
        toast.error("خطا در بارگذاری وعده‌ها");
      }
    }

    function renderTotals(rows) {
      const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      rows.forEach((r) => {
        totals.calories += Number(r.calories) || 0;
        totals.protein += Number(r.protein) || 0;
        totals.carbs += Number(r.carbs) || 0;
        totals.fat += Number(r.fat) || 0;
      });
      const goals = store.get("goals");
      const pct = goals.calories ? Math.round((totals.calories / goals.calories) * 100) : 0;

      $("[data-total='calories']", container).textContent = formatInteger(totals.calories);
      $("[data-total='protein']", container).textContent = formatNumber(totals.protein, { decimals: 1 }) + " گرم";
      $("[data-total='carbs']", container).textContent = formatNumber(totals.carbs, { decimals: 1 }) + " گرم";
      $("[data-total='fat']", container).textContent = formatNumber(totals.fat, { decimals: 1 }) + " گرم";
      $("[data-total='pct']", container).textContent = pct;
      const bar = $("[data-total='progress']", container);
      bar.style.width = Math.min(100, pct) + "%";
      bar.classList.toggle("progress__bar--warning", pct > 100);
    }

    function renderMeals(grouped) {
      mealsWrap.innerHTML = MEALS.map((meal) => {
        const rows = grouped[meal.id] || [];
        const totalKcal = rows.reduce((s, r) => s + (Number(r.calories) || 0), 0);
        return `
          <div class="meal-card meal-card--${mealColor(meal.id)}" data-meal="${meal.id}">
            <div class="meal-card__head">
              <div class="meal-card__title">
                <span class="meal-card__icon">${icon(meal.icon, { size: 18 })}</span>
                <span>${escapeHTML(meal.label)}</span>
              </div>
              <div class="meal-card__calories">
                ${formatInteger(totalKcal)}
                <small>kcal</small>
              </div>
            </div>
            <div class="food-list" data-meal-list="${meal.id}">
              ${rows.length
                ? rows.map((r) => renderFoodItem(r)).join("")
                : '<div class="text-xs text-muted text-center" style="padding:16px 0">موردی ثبت نشده</div>'}
            </div>
            <button class="meal-card__add" data-add="${meal.id}" type="button">
              ${icon("plus", { size: 14 })}<span>افزودن غذا</span>
            </button>
          </div>
        `;
      }).join("");

      mealsWrap.querySelectorAll(".food-item").forEach((el) => {
        el.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          const id = el.dataset.id;
          const row = currentData.rows.find((r) => r.id === id);
          if (!row) return;
          contextMenu.show(e, [
            { label: "ویرایش مقدار", icon: "edit", onClick: () => openEditItem(row) },
            { label: "انتقال به وعده دیگر", icon: "plus", onClick: () => openMoveItem(row) },
            { divider: true },
            { label: "حذف", icon: "trash", variant: "danger", onClick: () => deleteItem(row) },
          ]);
        });
        el.addEventListener("click", (e) => {
          if (e.target.closest("input")) return;
          const row = currentData.rows.find((r) => r.id === el.dataset.id);
          if (row) openEditItem(row);
        });
      });

      mealsWrap.querySelectorAll(".food-item__amount input").forEach((input) => {
        input.addEventListener("click", (e) => e.stopPropagation());
        input.addEventListener("change", async () => {
          const row = currentData.rows.find((r) => r.id === input.dataset.id);
          if (!row) return;
          const grams = Math.max(1, Number(toLatinDigits(input.value)) || 100);
          await updateGrams(row, grams);
        });
      });
    }

    function renderFoodItem(row) {
      return `
        <div class="food-item" data-id="${row.id}" role="button" tabindex="0">
          <div class="food-item__body">
            <div class="food-item__name">${escapeHTML(row.food_name)}</div>
            <div class="food-item__meta">
              <span>${formatNumber(row.protein, { decimals: 1 })}پ</span>
              <span>${formatNumber(row.carbs, { decimals: 1 })}ک</span>
              <span>${formatNumber(row.fat, { decimals: 1 })}چ</span>
            </div>
          </div>
          <div class="food-item__amount">
            <input type="number" value="${row.grams}" data-id="${row.id}" min="1" step="5" />
            <small>گرم</small>
          </div>
          <div class="food-item__kcal num">${formatInteger(row.calories)}</div>
        </div>
      `;
    }

    async function updateGrams(row, grams) {
      try {
        const food = foods.getById(row.food_id) || {
          Persian_Name: row.food_name, Name_En: row.food_en,
          Calories: (row.calories / row.grams) * 100,
          Protein: (row.protein / row.grams) * 100,
          Carbs: (row.carbs / row.grams) * 100,
          Fat: (row.fat / row.grams) * 100,
          Fiber: (row.fiber / row.grams) * 100, Sugar: null,
        };
        await foodLog.update(row.id, { grams, food_macros: food });
      } catch {
        toast.error("به‌روزرسانی ناموفق بود");
      }
    }

    async function deleteItem(row) {
      const ok = await confirm({
        title: "حذف آیتم",
        message: `«${row.food_name}» از وعده حذف شود؟`,
        variant: "danger",
        confirmLabel: "حذف",
      });
      if (!ok) return;
      try {
        await foodLog.remove(row.id);
        toast.success("حذف شد");
      } catch {
        toast.error("حذف ناموفق بود");
      }
    }

    delegate(container, "click", "[data-add]", (e, btn) => openAddModal(btn.dataset.add));

    /* ---------- Add food modal --------------------------------------- */
    function openAddModal(mealId) {
      const meal = MEALS.find((m) => m.id === mealId);
      const selected = new Map();

      const wrapper = createElement("div");
      wrapper.innerHTML = `
        <div class="food-modal-toolbar" data-search-slot></div>
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs text-muted">وعده: <strong style="color:var(--color-text-1)">${escapeHTML(meal.label)}</strong></div>
          <div class="serving-size" data-serving>
            <button class="serving-size__opt is-active" data-grams="100" type="button">۱۰۰ گرم</button>
            <button class="serving-size__opt" data-grams="150" type="button">۱۵۰ گرم</button>
            <button class="serving-size__opt" data-grams="200" type="button">۲۰۰ گرم</button>
          </div>
        </div>
        <div class="food-search-results" data-results>
          <div class="food-search-empty">برای جستجوی غذا تایپ کنید…</div>
        </div>
        <div data-summary></div>
      `;

      const m = modal.open({
        title: `افزودن غذا به ${meal.label}`,
        iconName: "plus",
        size: "lg",
        content: wrapper,
        footer: [
          { label: "انصراف", variant: "ghost" },
          {
            label: "افزودن",
            variant: "primary",
            onClick: async () => {
              if (!selected.size) {
                toast.warning("حداقل یک غذا انتخاب کنید");
                return false;
              }
              const items = [...selected.values()].map(({ food, grams }) => ({ food, grams }));
              try {
                await foodLog.addMany({
                  date: currentDate(),
                  meal: mealId,
                  mealTime: nowTimeStr(),
                  items,
                });
                toast.success(`${items.length} آیتم اضافه شد`);
              } catch {
                toast.error("افزودن ناموفق بود");
                return false;
              }
            },
          },
        ],
      });

      const resultsEl = wrapper.querySelector("[data-results]");
      const summaryEl = wrapper.querySelector("[data-summary]");
      let defaultGrams = 100;

      wrapper.querySelectorAll("[data-serving] .serving-size__opt").forEach((btn) => {
        btn.addEventListener("click", () => {
          wrapper.querySelectorAll("[data-serving] .serving-size__opt").forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          defaultGrams = Number(btn.dataset.grams);
        });
      });

      const search = searchField({
        placeholder: "جستجوی غذا (فارسی یا انگلیسی)…",
        minChars: 1,
        onQuery: async (q) => foods.search(q, { limit: 30 }),
        onSelect: (food) => addSelection(food),
        renderItem: (food) => ({
          title: food.Persian_Name,
          subtitle: `${food.Name_En} • ${Math.round(food.Calories)} kcal / 100g`,
          badge: Math.round(food.Calories) + "kcal",
          icon: "apple",
        }),
        emptyText: "نتیجه‌ای یافت نشد",
      });
      wrapper.querySelector("[data-search-slot]").appendChild(search.el);
      search.focus();

      function addSelection(food) {
        const key = food._id || food.Persian_Name;
        if (selected.has(key)) {
          toast.info("این غذا قبلاً اضافه شده است");
          return;
        }
        selected.set(key, { food, grams: defaultGrams });
        search.clear();
        renderSelection();
      }

      function renderSelection() {
        if (!selected.size) { summaryEl.innerHTML = ""; return; }
        const items = [...selected.values()];
        const totals = foods.sumMacros(items);
        summaryEl.innerHTML = `
          <div class="food-selection-summary">
            <div class="food-selection-summary__info">
              <strong>${items.length}</strong> آیتم — <strong>${formatInteger(totals.calories)}</strong> kcal
            </div>
            <button class="btn btn--ghost btn--sm" data-clear-selection type="button">${icon("trash", { size: 14 })}<span>پاک کردن</span></button>
          </div>
        `;
        summaryEl.querySelector("[data-clear-selection]")?.addEventListener("click", () => {
          selected.clear();
          renderSelection();
        });
      }

      // Hot suggestions
      (async () => {
        const frequent = await foodLog.frequentForMeal(mealId, 6).catch(() => []);
        if (frequent.length && !search.input.value) {
          resultsEl.innerHTML = `
            <div class="text-2xs text-muted" style="padding:6px 8px">پیشنهاد بر اساس سابقه شما:</div>
            ${frequent.map((f) => `
              <div class="food-list-item" data-suggest='${JSON.stringify({ name: f.name })}' style="cursor:pointer">
                <div class="food-list-item__info">
                  <div class="food-list-item__name">${escapeHTML(f.name)}</div>
                  <div class="food-list-item__en">${f.count} بار</div>
                </div>
              </div>
            `).join("")}
          `;
          resultsEl.querySelectorAll("[data-suggest]").forEach((el) => {
            el.addEventListener("click", () => {
              const payload = JSON.parse(el.dataset.suggest);
              const found = foods.search(payload.name, { limit: 1 })[0];
              if (found) addSelection(found);
            });
          });
        }
      })();

      return m;
    }

    /* ---------- Edit item -------------------------------------------- */
    function openEditItem(row) {
      const wrapper = createElement("div");
      wrapper.innerHTML = `
        <div class="form-group">
          <label class="form-label">نام غذا</label>
          <input class="form-input" value="${escapeHTML(row.food_name)}" disabled />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">مقدار (گرم)</label>
            <input type="number" class="form-input" data-edit="grams" value="${row.grams}" min="1" />
          </div>
          <div class="form-group">
            <label class="form-label">وعده</label>
            <select class="form-select" data-edit="meal">
              ${MEALS.map((m) => `<option value="${m.id}" ${m.id === row.meal ? "selected" : ""}>${m.label}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">ساعت</label>
            <input type="time" class="form-input" data-edit="meal_time" value="${(row.meal_time || "").slice(0,5)}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">یادداشت</label>
          <textarea class="form-textarea" data-edit="notes" rows="2">${escapeHTML(row.notes || "")}</textarea>
        </div>
      `;
      modal.open({
        title: "ویرایش آیتم",
        iconName: "edit",
        size: "md",
        content: wrapper,
        footer: [
          { label: "انصراف", variant: "ghost" },
          {
            label: "ذخیره",
            variant: "primary",
            onClick: async () => {
              const grams = Number(wrapper.querySelector('[data-edit="grams"]').value);
              const meal = wrapper.querySelector('[data-edit="meal"]').value;
              const meal_time = wrapper.querySelector('[data-edit="meal_time"]').value;
              const notes = wrapper.querySelector('[data-edit="notes"]').value;
              const patch = { grams, meal, meal_time, notes };
              if (grams !== row.grams) {
                patch.food_macros = foods.getById(row.food_id) || {
                  Calories: (row.calories / row.grams) * 100,
                  Protein: (row.protein / row.grams) * 100,
                  Carbs: (row.carbs / row.grams) * 100,
                  Fat: (row.fat / row.grams) * 100,
                  Fiber: (row.fiber / row.grams) * 100,
                  Sugar: null,
                };
              }
              try {
                await foodLog.update(row.id, patch);
                toast.success("ذخیره شد");
              } catch {
                toast.error("ذخیره ناموفق بود");
                return false;
              }
            },
          },
        ],
      });
    }

    function openMoveItem(row) {
      const wrapper = createElement("div");
      wrapper.innerHTML = `
        <p class="text-sm text-muted" style="margin-bottom:12px">
          «${escapeHTML(row.food_name)}» به کدام وعده منتقل شود؟
        </p>
        <div class="flex flex-wrap gap-2">
          ${MEALS.filter((m) => m.id !== row.meal).map((m) => `
            <button class="filter-chip" data-target="${m.id}" type="button">${icon(m.icon, { size: 14 })}<span>${m.label}</span></button>
          `).join("")}
        </div>
      `;
      const m = modal.open({ title: "انتقال به وعده دیگر", size: "sm", content: wrapper, footer: [{ label: "انصراف", variant: "ghost" }] });
      wrapper.querySelectorAll("[data-target]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await foodLog.update(row.id, { meal: btn.dataset.target });
            toast.success("منتقل شد");
            m.close();
          } catch { toast.error("انتقال ناموفق بود"); }
        });
      });
    }

    /* ---------- Report block ---------------------------------------- */
    async function foodSummary(range, dateISO) {
      const { start, end, label } = rangeWindow(range, dateISO);
      const rows = await foodLog.totalsByRange(start, end);
      const totals = rows.reduce((acc, d) => {
        acc.calories += d.calories;
        acc.protein += d.protein;
        acc.carbs += d.carbs;
        acc.fat += d.fat;
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
      const activeDays = rows.filter((d) => d.entries > 0).length;
      const avgCalories = activeDays ? Math.round(totals.calories / activeDays) : 0;
      const goals = store.get("goals");

      const kpis = range === "daily"
        ? [
            { label: "کالری", value: formatInteger(totals.calories), unit: "kcal", tone: totals.calories > goals.calories ? "danger" : "warning" },
            { label: "پروتئین", value: formatNumber(totals.protein, { decimals: 1 }), unit: "گرم", tone: "success" },
            { label: "کربوهیدرات", value: formatNumber(totals.carbs, { decimals: 1 }), unit: "گرم", tone: "primary" },
            { label: "چربی", value: formatNumber(totals.fat, { decimals: 1 }), unit: "گرم", tone: "danger" },
          ]
        : [
            { label: "کالری کل", value: formatInteger(totals.calories), unit: "kcal", tone: "warning" },
            { label: "میانگین روزانه", value: formatInteger(avgCalories), unit: "kcal", tone: "primary" },
            { label: "روزهای فعال", value: activeDays, unit: `از ${rows.length}`, tone: "success" },
            { label: "پروتئین کل", value: formatNumber(totals.protein, { decimals: 0 }), unit: "گرم", tone: "success" },
          ];

      const chartData = rows.map((d) => ({
        label: formatWeekdayShort(d.date).slice(0, 2),
        value: d.calories,
      }));
      const chartHtml = chart.barChart({ data: chartData, width: 720, height: 180 });

      return { kpis, chart: chartHtml, subtitle: label };
    }

    function rangeWindow(range, dateISO) {
      if (range === "daily") return { start: dateISO, end: dateISO, label: formatShort(dateISO) };
      if (range === "weekly") {
        const start = addDays(dateISO, -6);
        return { start, end: dateISO, label: `${formatShort(start)} — ${formatShort(dateISO)}` };
      }
      const start = addDays(dateISO, -29);
      return { start, end: dateISO, label: `${formatShort(start)} — ${formatShort(dateISO)}` };
    }

    reportBlock = mountReportBlock($("[data-report-slot]", container), {
      subject: "food",
      date: currentDate(),
      summaryFn: foodSummary,
      title: "گزارش غذا",
      scrollTarget: "#food-entry-form",
    });

    /* ---------- Events --------------------------------------------- */
    unsubscribers.push(bus.on("food-log:changed", () => load()));
    unsubscribers.push(bus.on("date:changed", () => load()));

    await load();

    return function cleanup() {
      unsubscribers.forEach((off) => off());
      reportBlock?.destroy?.();
    };
  },
};

function mealColor(id) {
  if (id === "breakfast") return "breakfast";
  if (id === "lunch") return "lunch";
  if (id === "dinner") return "dinner";
  return "snack";
}