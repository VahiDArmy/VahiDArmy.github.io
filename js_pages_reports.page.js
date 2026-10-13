/**
 * Reports page — cross-subject overview.
 *
 * Uses the day swiper's selected date as the anchor. Range switching
 * (daily / weekly / monthly) is local to this page.
 *
 * Layout:
 *   - Range switcher (daily / weekly / monthly)
 *   - Summary strip (all subjects)
 *   - Charts: calories trend, steps trend
 *   - Per-subject breakdown
 */

import { $, delegate } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { skeleton } from "../components/skeleton.js";
import { chart } from "../components/chart.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import {
  dailyReport, weeklyReport, monthlyReport, comparisonReport,
} from "../services/reports.service.js";
import {
  todayISO, addDays, addMonths, formatShort, formatMonthYear,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  formatWeekdayShort,
} from "../utils/date.js";
import {
  formatInteger, formatNumber, escapeHTML,
} from "../utils/format.js";
import { MEALS } from "../config/constants.js";

export default {
  title: "گزارش‌ها",
  subtitle: "تحلیل جامع",
  icon: "barChart",

  async render(container) {
    const unsubscribers = [];
    let currentRange = "weekly";
    let anchorDate = store.get("selectedDate") || todayISO();
    let currentData = null;

    container.innerHTML = `
      <div class="reports-controls">
        <div class="reports-controls__group">
          <div class="report-tabs" data-ranges>
            <button class="report-tab" data-range="daily" type="button">روزانه</button>
            <button class="report-tab is-active" data-range="weekly" type="button">هفتگی</button>
            <button class="report-tab" data-range="monthly" type="button">ماهانه</button>
          </div>
        </div>
        <div class="reports-controls__spacer"></div>
        <div class="reports-controls__group">
          <button class="btn btn--ghost btn--icon" data-nav="prev" type="button" title="بازه قبل">${icon("chevronRight", { size: 16 })}</button>
          <div class="range-chip" data-range-label>—</div>
          <button class="btn btn--ghost btn--icon" data-nav="next" type="button" title="بازه بعد">${icon("chevronLeft", { size: 16 })}</button>
        </div>
      </div>

      <div data-report-body>
        <div style="padding:40px 0;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>
      </div>
    `;

    delegate(container, "click", "[data-range]", (e, btn) => {
      currentRange = btn.dataset.range;
      container.querySelectorAll("[data-range]").forEach((b) => b.classList.toggle("is-active", b === btn));
      load();
    });

    delegate(container, "click", "[data-nav]", (e, btn) => {
      const dir = btn.dataset.nav === "next" ? 1 : -1;
      if (currentRange === "daily") anchorDate = addDays(anchorDate, dir);
      else if (currentRange === "weekly") anchorDate = addDays(anchorDate, dir * 7);
      else if (currentRange === "monthly") anchorDate = addMonths(anchorDate, dir);
      load();
    });

    async function load() {
      const body = $("[data-report-body]", container);
      body.innerHTML = `
        ${skeleton.kpiGrid(4)}
        <div style="margin-top:20px">${skeleton.chart()}</div>
        <div style="margin-top:20px">${skeleton.table(4, 4)}</div>
      `;

      try {
        const rangeInfo = computeRange();
        $("[data-range-label]", container).textContent = rangeInfo.label;

        if (currentRange === "daily") {
          currentData = await dailyReport(anchorDate);
          renderDaily(currentData);
        } else {
          const report = currentRange === "weekly"
            ? await weeklyReport(anchorDate)
            : await monthlyReport(anchorDate);
          currentData = report;
          await renderRange(report);
        }
      } catch (err) {
        console.error("[reports] load error", err);
        body.innerHTML = `
          <div class="empty" style="min-height:300px">
            <div class="empty__title">خطا در بارگذاری گزارش</div>
            <div class="empty__text">${escapeHTML(err?.message || "")}</div>
          </div>
        `;
        toast.error("خطا در بارگذاری گزارش");
      }
    }

    function computeRange() {
      if (currentRange === "daily") return { label: formatShort(anchorDate) };
      if (currentRange === "weekly") {
        const start = startOfWeek(anchorDate);
        const end = endOfWeek(anchorDate);
        return { label: `${formatShort(start)} — ${formatShort(end)}` };
      }
      return { label: formatMonthYear(anchorDate) };
    }

    /* ---------- Daily view ----------------------------------------- */
    function renderDaily(rep) {
      const f = rep.food.totals;
      const a = rep.activity.totals;
      const g = store.get("goals") || {};

      $("[data-report-body]", container).innerHTML = `
        <div class="report-summary" style="margin-bottom:20px">
          ${summaryItem("flame", "کالری", formatInteger(f.calories), "kcal", pct(f.calories, g.calories), "warning")}
          ${summaryItem("zap", "پروتئین", formatNumber(f.protein, { decimals: 1 }), "گرم", pct(f.protein, g.protein), "success")}
          ${summaryItem("apple", "کربوهیدرات", formatNumber(f.carbs, { decimals: 1 }), "گرم", pct(f.carbs, g.carbs), "primary")}
          ${summaryItem("droplet", "چربی", formatNumber(f.fat, { decimals: 1 }), "گرم", pct(f.fat, g.fat), "danger")}
          ${summaryItem("footsteps", "قدم", formatInteger(a.steps), "قدم", pct(a.steps, g.steps), "accent")}
          ${summaryItem("moon", "خواب", rep.sleep ? formatNumber(rep.sleep.durationHours, { decimals: 1 }) : "—", "ساعت", null, "primary")}
        </div>

        <div class="reports-grid">
          <div class="col-12">
            <div class="report-section">
              <div class="report-section__head">
                <div class="report-section__title">${icon("pieChart", { size: 20 })}<span>توزیع کالری وعده‌ها</span></div>
              </div>
              ${renderMealDonut(rep.food.perMeal)}
            </div>
          </div>
          <div class="col-6">
            <div class="report-section">
              <div class="report-section__head">
                <div class="report-section__title">${icon("heartPulse", { size: 20 })}<span>سلامت</span></div>
              </div>
              ${renderHealthSummary(rep)}
            </div>
          </div>
          <div class="col-6">
            <div class="report-section">
              <div class="report-section__head">
                <div class="report-section__title">${icon("activity", { size: 20 })}<span>فعالیت</span></div>
              </div>
              ${renderActivitySummary(rep)}
            </div>
          </div>
          <div class="col-12">
            <div class="report-section">
              <div class="report-section__head">
                <div class="report-section__title">${icon("utensils", { size: 20 })}<span>ریز مواد غذایی</span></div>
              </div>
              ${renderFoodTable(rep.food.entries)}
            </div>
          </div>
        </div>
      `;
    }

    /* ---------- Range view ----------------------------------------- */
    async function renderRange(rep) {
      const body = $("[data-report-body]", container);
      const comparison = await comparisonReport(anchorDate, currentRange).catch(() => null);
      const f = rep.food.totals;
      const a = rep.activity.totals;

      body.innerHTML = `
        <div class="report-summary" style="margin-bottom:20px">
          ${summaryItem("flame", "کالری کل", formatInteger(f.calories), "kcal", null, "warning", comparison?.deltas.calories)}
          ${summaryItem("clock", "میانگین روزانه", formatInteger(rep.food.averages?.calories || 0), "kcal", null, "primary")}
          ${summaryItem("footsteps", "قدم کل", formatInteger(a.steps), "قدم", null, "accent", comparison?.deltas.steps)}
          ${summaryItem("walk", "مسافت", formatNumber(a.km, { decimals: 1 }), "km", null, "success", comparison?.deltas.km)}
          ${summaryItem("moon", "میانگین خواب", rep.sleep ? formatNumber(rep.sleep.avgHours, { decimals: 1 }) : "—", "ساعت", null, "info", comparison?.deltas.sleepHours)}
          ${summaryItem("scale", "تغییر وزن", rep.weight.change ? (rep.weight.change > 0 ? "+" + formatNumber(rep.weight.change, { decimals: 1 }) : formatNumber(rep.weight.change, { decimals: 1 })) : "—", "kg", null, rep.weight.change > 0 ? "danger" : "success", comparison?.deltas.weight)}
        </div>

        <div class="reports-grid">
          <div class="col-12">
            <div class="report-section">
              <div class="report-section__head">
                <div class="report-section__title">${icon("lineChart", { size: 20 })}<span>روند کالری روزانه</span></div>
                <div class="report-section__actions">
                  <div class="badge badge--outline">${rep.activeDays} روز فعال از ${rep.dayCount}</div>
                </div>
              </div>
              ${renderCaloriesLine(rep.food.daily)}
            </div>
          </div>
          <div class="col-6">
            <div class="report-section">
              <div class="report-section__head">
                <div class="report-section__title">${icon("barChart", { size: 20 })}<span>قدم‌های روزانه</span></div>
              </div>
              ${renderStepsBar(rep.activity.daily)}
            </div>
          </div>
          <div class="col-6">
            <div class="report-section">
              <div class="report-section__head">
                <div class="report-section__title">${icon("pieChart", { size: 20 })}<span>میانگین درشت‌مغذی‌ها</span></div>
              </div>
              ${renderMacroDonut(rep.food)}
            </div>
          </div>
          <div class="col-6">
            <div class="report-section">
              <div class="report-section__head">
                <div class="report-section__title">${icon("heartPulse", { size: 20 })}<span>سلامت</span></div>
              </div>
              ${renderHealthRangeSummary(rep)}
            </div>
          </div>
          <div class="col-6">
            <div class="report-section">
              <div class="report-section__head">
                <div class="report-section__title">${icon("moon", { size: 20 })}<span>خواب</span></div>
              </div>
              ${renderSleepRangeSummary(rep)}
            </div>
          </div>
          <div class="col-12">
            <div class="report-section">
              <div class="report-section__head">
                <div class="report-section__title">${icon("table", { size: 20 })}<span>جدول روزانه</span></div>
              </div>
              ${renderWeekTable(rep.food.daily, rep.activity.daily)}
            </div>
          </div>
        </div>
      `;
    }

    /* ---------- Renderers ------------------------------------------ */
    function summaryItem(iconName, label, value, unit, percent, tone, delta) {
      const deltaBadge = delta && delta.direction !== "flat"
        ? `<span class="report-summary__delta report-summary__delta--${delta.direction}">${delta.direction === "up" ? "▲" : "▼"} ${Math.abs(delta.pct)}٪</span>`
        : "";
      return `
        <div class="report-summary__item">
          <div class="report-summary__label">${icon(iconName, { size: 12 })}<span>${escapeHTML(label)}</span></div>
          <div class="report-summary__value">${value}<small>${escapeHTML(unit)}</small></div>
          ${deltaBadge}
          ${percent != null ? `<div class="progress progress--sm" style="margin-top:6px"><div class="progress__bar progress__bar--${tone}" style="width:${Math.min(100, percent)}%"></div></div>` : ""}
        </div>
      `;
    }

    function renderMealDonut(perMeal) {
      const slices = MEALS.map((m) => ({
        label: m.label, value: perMeal[m.id]?.calories || 0, color: mealColor(m.id),
      })).filter((s) => s.value > 0);
      const total = slices.reduce((s, x) => s + x.value, 0);
      if (!total) return '<div class="empty empty--compact"><div class="empty__text">داده‌ای برای نمایش نیست</div></div>';
      return `
        <div class="flex items-center justify-center gap-6 flex-wrap">
          <div style="max-width:240px">
            ${chart.donut({ slices, size: 220, thickness: 22, centerLabel: formatInteger(total), centerSub: "kcal" })}
          </div>
          <div class="flex flex-col gap-2" style="min-width:200px">
            ${MEALS.map((m) => {
              const v = perMeal[m.id]?.calories || 0;
              const p = total ? (v / total) * 100 : 0;
              return `
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <span style="width:10px;height:10px;border-radius:3px;background:${mealColor(m.id)}"></span>
                    <span class="text-sm">${m.label}</span>
                  </div>
                  <div class="text-sm num"><strong>${formatInteger(v)}</strong> <span class="text-xs text-muted">(${Math.round(p)}٪)</span></div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    function renderHealthSummary(rep) {
      const items = [
        { label: "انسولین", value: formatNumber(rep.insulin.totalUnits, { decimals: 1 }), unit: "واحد", icon: "syringe", tone: "primary" },
        { label: "میانگین قند", value: rep.glucose.avg ? formatInteger(rep.glucose.avg) : "—", unit: "mg/dL", icon: "droplet", tone: rep.glucose.avg > 140 ? "danger" : "success" },
        { label: "فشار خون", value: rep.bp.latest ? `${rep.bp.latest.systolic}/${rep.bp.latest.diastolic}` : "—", unit: "mmHg", icon: "stethoscope", tone: "success" },
        { label: "وزن", value: rep.weight.latest ? formatNumber(rep.weight.latest.weight, { decimals: 1 }) : "—", unit: "kg", icon: "scale", tone: "accent" },
      ];
      return `<div class="report-kpis">${items.map((it) => `
        <div class="report-kpi">
          <div class="report-kpi__label">${icon(it.icon, { size: 12 })} ${escapeHTML(it.label)}</div>
          <div class="report-kpi__value report-kpi__value--${it.tone}">${it.value}<small>${it.unit}</small></div>
        </div>
      `).join("")}</div>`;
    }

    function renderActivitySummary(rep) {
      const a = rep.activity.totals;
      const items = [
        { label: "قدم", value: formatInteger(a.steps), unit: "قدم" },
        { label: "مسافت", value: formatNumber(a.km, { decimals: 2 }), unit: "km" },
        { label: "مدت", value: formatInteger(a.minutes), unit: "دقیقه" },
        { label: "کالری سوزانده", value: formatInteger(a.kcalBurned), unit: "kcal" },
      ];
      return `<div class="report-kpis">${items.map((it) => `
        <div class="report-kpi">
          <div class="report-kpi__label">${escapeHTML(it.label)}</div>
          <div class="report-kpi__value">${it.value}<small>${escapeHTML(it.unit)}</small></div>
        </div>
      `).join("")}</div>`;
    }

    function renderFoodTable(entries) {
      if (!entries?.length) return '<div class="empty empty--compact"><div class="empty__text">غذایی ثبت نشده است</div></div>';
      return `
        <div class="table-wrap">
          <table class="table table--compact">
            <thead><tr><th>وعده</th><th>غذا</th><th class="num">گرم</th><th class="num">کالری</th><th class="num">پ</th><th class="num">ک</th><th class="num">چ</th></tr></thead>
            <tbody>${entries.map((r) => `
              <tr>
                <td>${mealLabel(r.meal)}</td>
                <td>${escapeHTML(r.food_name)}</td>
                <td class="num">${r.grams}</td>
                <td class="num">${formatInteger(r.calories)}</td>
                <td class="num">${formatNumber(r.protein, { decimals: 1 })}</td>
                <td class="num">${formatNumber(r.carbs, { decimals: 1 })}</td>
                <td class="num">${formatNumber(r.fat, { decimals: 1 })}</td>
              </tr>
            `).join("")}</tbody>
          </table>
        </div>
      `;
    }

    function renderCaloriesLine(daily) {
      const data = daily.map((d) => ({ x: formatWeekdayShort(d.date).slice(0, 2), y: d.calories, label: formatWeekdayShort(d.date).slice(0, 2) }));
      return chart.lineChart({ data, width: 900, height: 260, xLabel: (d) => d.label });
    }

    function renderStepsBar(daily) {
      const data = daily.map((d) => ({ label: formatWeekdayShort(d.date).slice(0, 2), value: d.steps }));
      return chart.barChart({ data, width: 500, height: 260 });
    }

    function renderMacroDonut(food) {
      const avg = food.averages;
      if (!avg) return '<div class="empty empty--compact"><div class="empty__text">داده‌ای برای نمایش نیست</div></div>';
      const slices = [
        { label: "پروتئین", value: avg.protein, color: "#6366f1" },
        { label: "کربوهیدرات", value: avg.carbs, color: "#22d3ee" },
        { label: "چربی", value: avg.fat, color: "#f59e0b" },
      ];
      const total = slices.reduce((s, x) => s + x.value, 0);
      return `
        <div class="flex items-center justify-center gap-6 flex-wrap">
          <div style="max-width:220px">
            ${chart.donut({ slices, size: 200, thickness: 22, centerLabel: formatInteger(total), centerSub: "گرم/روز" })}
          </div>
          <div class="flex flex-col gap-2">
            ${slices.map((s) => `
              <div class="flex items-center gap-2">
                <span style="width:10px;height:10px;border-radius:3px;background:${s.color}"></span>
                <span class="text-sm">${s.label}</span>
                <strong class="num text-sm" style="margin-inline-start:auto">${formatNumber(s.value, { decimals: 1 })} گ</strong>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    function renderHealthRangeSummary(rep) {
      const items = [
        { label: "انسولین کل", value: formatNumber(rep.insulin.total, { decimals: 1 }), unit: "واحد" },
        { label: "میانگین قند", value: rep.glucose.avg ? formatInteger(rep.glucose.avg) : "—", unit: "mg/dL" },
        { label: "میانگین سیستولیک", value: rep.bp.systolicAvg ? formatInteger(rep.bp.systolicAvg) : "—", unit: "mmHg" },
        { label: "تغییر وزن", value: rep.weight.change ? (rep.weight.change > 0 ? "+" + formatNumber(rep.weight.change, { decimals: 1 }) : formatNumber(rep.weight.change, { decimals: 1 })) : "—", unit: "kg" },
      ];
      return `<div class="report-averages">${items.map((it) => `
        <div class="report-average">
          <div class="report-average__label">${escapeHTML(it.label)}</div>
          <div class="report-average__value">${it.value} <small class="text-2xs text-muted">${escapeHTML(it.unit)}</small></div>
        </div>
      `).join("")}</div>`;
    }

    function renderSleepRangeSummary(rep) {
      if (!rep.sleep) return '<div class="empty empty--compact"><div class="empty__text">داده‌ای برای نمایش نیست</div></div>';
      const s = rep.sleep;
      const items = [
        { label: "میانگین ساعت خواب", value: formatNumber(s.avgHours, { decimals: 1 }), unit: "ساعت" },
        { label: "مجموع خواب", value: formatNumber(s.totalHours, { decimals: 1 }), unit: "ساعت" },
        { label: "میانگین کیفیت", value: formatNumber(s.avgQuality, { decimals: 1 }), unit: "از ۵" },
        { label: "بهترین شب", value: formatNumber(s.best.durationHours, { decimals: 1 }), unit: "ساعت" },
      ];
      return `<div class="report-averages">${items.map((it) => `
        <div class="report-average">
          <div class="report-average__label">${escapeHTML(it.label)}</div>
          <div class="report-average__value">${it.value} <small class="text-2xs text-muted">${escapeHTML(it.unit)}</small></div>
        </div>
      `).join("")}</div>`;
    }

    function renderWeekTable(foodDaily, actDaily) {
      const actByDate = new Map(actDaily.map((d) => [d.date, d]));
      return `
        <div class="table-wrap">
          <table class="report-week-table">
            <thead><tr><th>روز</th><th class="num">کالری</th><th class="num">پروتئین</th><th class="num">کربوهیدرات</th><th class="num">چربی</th><th class="num">قدم</th></tr></thead>
            <tbody>${foodDaily.map((d) => {
              const a = actByDate.get(d.date) || { steps: 0 };
              return `
                <tr>
                  <td>${formatWeekdayShort(d.date)} ${formatShort(d.date)}</td>
                  <td class="num">${formatInteger(d.calories)}</td>
                  <td class="num">${formatNumber(d.protein, { decimals: 1 })}</td>
                  <td class="num">${formatNumber(d.carbs, { decimals: 1 })}</td>
                  <td class="num">${formatNumber(d.fat, { decimals: 1 })}</td>
                  <td class="num">${formatInteger(a.steps)}</td>
                </tr>
              `;
            }).join("")}</tbody>
          </table>
        </div>
      `;
    }

    function pct(v, goal) {
      if (!goal) return 0;
      return Math.min(100, Math.round((v / goal) * 100));
    }

    function mealColor(id) {
      return {
        breakfast: "#f59e0b", snack1: "#22d3ee", lunch: "#10b981",
        snack2: "#06b6d4", dinner: "#8b5cf6", snack3: "#a855f7",
      }[id] || "#6366f1";
    }

    function mealLabel(id) {
      return MEALS.find((m) => m.id === id)?.label || id;
    }

    /* ---------- Events --------------------------------------------- */
    unsubscribers.push(bus.on("date:changed", (iso) => {
      anchorDate = iso || anchorDate;
      load();
    }));

    await load();

    return function cleanup() {
      unsubscribers.forEach((off) => off());
    };
  },
};