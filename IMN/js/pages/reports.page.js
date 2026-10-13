/**
 * Reports page — daily / weekly / monthly / custom.
 *
 * Fixes vs. previous version:
 *   • Date picker uses the actual trigger element, not `e.currentTarget`
 *     (unreliable in delegated handlers).
 *   • Range label no longer splits the date string.
 *   • Range report errors surface as an error card, not as "no data".
 */

import { $, createElement, delegate } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { attachPicker } from "../components/calendar.js";
import { chart } from "../components/chart.js";
import { skeleton } from "../components/skeleton.js";
import { store } from "../core/state.js";
import {
  dailyReport, weeklyReport, monthlyReport, customReport, comparisonReport, heatmapData,
} from "../services/reports.service.js";
import {
  todayISO, addDays, addMonths, formatLong, formatShort, formatMonthYear,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  rangeDays, formatWeekdayShort, toJalali,
} from "../utils/date.js";
import {
  formatInteger, formatNumber, formatDuration, escapeHTML,
} from "../utils/format.js";
import { MEALS } from "../config/constants.js";

export default {
  title: "گزارش‌ها",
  subtitle: "تحلیل کامل داده‌ها",
  icon: "barChart",

  async render(container) {
    let currentRange = "weekly";
    let anchorDate = todayISO();
    let currentData = null;
    let pickerDetach = null;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header__info">
          <div class="page-header__title">گزارش‌ها</div>
          <div class="page-header__subtitle">تحلیل جامع تمام داده‌های شما</div>
        </div>
        <div class="page-header__actions">
          <div class="export-row" data-exports>
            <button class="btn btn--secondary btn--sm" data-export="json" type="button">${icon("download", { size: 14 })}<span>JSON</span></button>
            <button class="btn btn--secondary btn--sm" data-export="csv" type="button">${icon("download", { size: 14 })}<span>CSV</span></button>
            <button class="btn btn--secondary btn--sm" data-export="print" type="button">${icon("printer", { size: 14 })}<span>چاپ</span></button>
          </div>
        </div>
      </div>

      <div class="reports-controls">
        <div class="reports-controls__group">
          <span class="reports-controls__label">بازه:</span>
          <div class="report-tabs" data-ranges>
            <button class="report-tab" data-range="daily" type="button">روزانه</button>
            <button class="report-tab is-active" data-range="weekly" type="button">هفتگی</button>
            <button class="report-tab" data-range="monthly" type="button">ماهانه</button>
          </div>
        </div>
        <div class="reports-controls__spacer"></div>
        <div class="reports-controls__group">
          <button class="btn btn--ghost btn--icon" data-nav="prev" type="button" title="بازه قبل">${icon("chevronRight", { size: 16 })}</button>
          <button class="range-chip" data-picker type="button">
            ${icon("calendar", { size: 16 })}
            <span data-range-label>—</span>
          </button>
          <button class="btn btn--ghost btn--icon" data-nav="next" type="button" title="بازه بعد">${icon("chevronLeft", { size: 16 })}</button>
        </div>
      </div>

      <div data-report-body>
        <div style="padding:40px 0;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>
      </div>
    `;

    /* ---------- Exports --------------------------------------------- */
    delegate(container, "click", "[data-export]", (e, btn) => {
      if (!currentData) return;
      const kind = btn.dataset.export;
      if (kind === "print") return window.print();
      if (kind === "json") return downloadJSON(currentData);
      if (kind === "csv") return downloadCSV(currentData);
    });

    /* ---------- Range switching -------------------------------------- */
    delegate(container, "click", "[data-range]", (e, btn) => {
      currentRange = btn.dataset.range;
      container.querySelectorAll("[data-range]").forEach((b) => b.classList.toggle("is-active", b === btn));
      load();
    });

    /* ---------- Date navigation -------------------------------------- */
    delegate(container, "click", "[data-nav]", (e, btn) => {
      const dir = btn.dataset.nav === "next" ? 1 : -1;
      if (currentRange === "daily") anchorDate = addDays(anchorDate, dir);
      else if (currentRange === "weekly") anchorDate = addDays(anchorDate, dir * 7);
      else if (currentRange === "monthly") anchorDate = addMonths(anchorDate, dir);
      load();
    });

    /* ---------- Date picker ------------------------------------------
       Use the real trigger element, not `e.currentTarget` (which is the
       delegated container). attachPicker handles its own outside-click. */
    delegate(container, "click", "[data-picker]", (e, btn) => {
      e.stopPropagation();
      if (pickerDetach) { pickerDetach(); pickerDetach = null; }
      pickerDetach = attachPicker(btn, {
        value: anchorDate,
        onSelect: (iso) => {
          pickerDetach = null;
          if (iso) anchorDate = iso;
          load();
        },
      });
      // Fire the picker immediately (attachPicker's listener is also
      // bound, but delegation has already consumed this event).
      btn.dispatchEvent(new MouseEvent("click", { bubbles: false }));
      e.stopImmediatePropagation();
    });

    /* ---------- Load ------------------------------------------------- */
    async function load() {
      const body = $("[data-report-body]", container);
      body.innerHTML = `
        ${skeleton.kpiGrid(4)}
        <div style="margin-top:20px">${skeleton.chart()}</div>
        <div style="margin-top:20px">${skeleton.table(4, 4)}</div>
      `;

      const rangeInfo = computeRange();
      $("[data-range-label]", container).textContent = rangeInfo.label;

      try {
        if (currentRange === "daily") {
          currentData = await dailyReport(anchorDate);
          renderDaily(currentData);
        } else if (currentRange === "weekly") {
          currentData = await weeklyReport(anchorDate);
          await renderRange(currentData);
        } else if (currentRange === "monthly") {
          currentData = await monthlyReport(anchorDate);
          await renderRange(currentData);
        }
      } catch (err) {
        console.error("[reports] load error", err);
        body.innerHTML = `
          <div class="empty" style="min-height:300px">
            <div class="empty__art">
              <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" stroke-width="1.4">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12" y2="17.5"/>
              </svg>
            </div>
            <div class="empty__title">خطا در بارگذاری گزارش</div>
            <div class="empty__text">${escapeHTML(err?.message || "خطای نامشخص")}</div>
          </div>
        `;
        toast.error(err?.message || "خطا در بارگذاری گزارش");
      }
    }

    function computeRange() {
      if (currentRange === "daily") {
        return { start: anchorDate, end: anchorDate, label: formatLong(anchorDate) };
      }
      if (currentRange === "weekly") {
        const start = startOfWeek(anchorDate);
        const end = endOfWeek(anchorDate);
        return { start, end, label: `${formatShort(start)} — ${formatShort(end)}` };
      }
      const start = startOfMonth(anchorDate);
      const end = endOfMonth(anchorDate);
      return { start, end, label: formatMonthYear(anchorDate) };
    }

    /* ---------- Renders (unchanged from before) --------------------- */
    function renderDaily(rep) {
      const body = $("[data-report-body]", container);
      const f = rep.food.totals;
      const a = rep.activity.totals;
      const g = store.get("goals") || {};

      body.innerHTML = `
        <div class="report-summary" style="margin-bottom:20px">
          ${summaryItem("flame", "کالری", formatInteger(f.calories), "kcal", pct(f.calories, g.calories), "warning")}
          ${summaryItem("zap", "پروتئین", formatNumber(f.protein, { decimals: 1 }), "گرم", pct(f.protein, g.protein), "success")}
          ${summaryItem("apple", "کربوهیدرات", formatNumber(f.carbs, { decimals: 1 }), "گرم", pct(f.carbs, g.carbs), "info")}
          ${summaryItem("droplet", "چربی", formatNumber(f.fat, { decimals: 1 }), "گرم", pct(f.fat, g.fat), "danger")}
          ${summaryItem("footsteps", "قدم", formatInteger(a.steps), "قدم", pct(a.steps, g.steps), "accent")}
          ${summaryItem("moon", "خواب", rep.sleep ? formatNumber(rep.sleep.durationHours, { decimals: 1 }) : "—", "ساعت", null, "primary")}
        </div>

        <div class="reports-grid">
          <div class="col-8">
            <div class="report-section">
              <div class="report-section__head">
                <div class="report-section__title">${icon("pieChart", { size: 20 })}<span>توزیع کالری وعده‌ها</span></div>
              </div>
              ${renderMealDonut(rep.food.perMeal)}
            </div>
          </div>
          <div class="col-4">
            <div class="report-section">
              <div class="report-section__head">
                <div class="report-section__title">${icon("target", { size: 20 })}<span>تحقق اهداف</span></div>
              </div>
              ${renderGoalsProgress(rep)}
            </div>
          </div>
          <div class="col-6">
            <div class="report-section">
              <div class="report-section__head">
                <div class="report-section__title">${icon("heartPulse", { size: 20 })}<span>خلاصه سلامت</span></div>
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
          ${summaryItem("walk", "مسافت کل", formatNumber(a.km, { decimals: 1 }), "km", null, "success", comparison?.deltas.km)}
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
          ${currentRange === "monthly" ? `
            <div class="col-12">
              <div class="report-section">
                <div class="report-section__head">
                  <div class="report-section__title">${icon("calendar", { size: 20 })}<span>نمای ماهانه</span></div>
                </div>
                ${await renderMonthlyGrid(rep)}
              </div>
            </div>
          ` : ""}
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

    function renderGoalsProgress(rep) {
      const g = store.get("goals") || {};
      const f = rep.food.totals;
      const a = rep.activity.totals;
      const rows = [
        { label: "کالری", value: f.calories, goal: g.calories, unit: "kcal", tone: "primary" },
        { label: "پروتئین", value: f.protein, goal: g.protein, unit: "g", tone: "success" },
        { label: "کربوهیدرات", value: f.carbs, goal: g.carbs, unit: "g", tone: "info" },
        { label: "چربی", value: f.fat, goal: g.fat, unit: "g", tone: "warning" },
        { label: "فیبر", value: f.fiber, goal: g.fiber, unit: "g", tone: "accent" },
        { label: "قدم", value: a.steps, goal: g.steps, unit: "", tone: "primary" },
      ];
      return `
        <div class="flex flex-col gap-3">
          ${rows.map((r) => {
            const p = r.goal ? Math.min(100, Math.round((r.value / r.goal) * 100)) : 0;
            return `
              <div class="progress-row">
                <div class="progress-row__head">
                  <span class="progress-row__label">${r.label}</span>
                  <span class="progress-row__value"><strong>${formatInteger(r.value)}</strong> / ${formatInteger(r.goal)} ${r.unit} • ${p}٪</span>
                </div>
                <div class="progress"><div class="progress__bar progress__bar--${r.tone}" style="width:${p}%"></div></div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    function renderHealthSummary(rep) {
      const items = [
        { label: "تزریق انسولین", value: formatNumber(rep.insulin.totalUnits, { decimals: 1 }), unit: "واحد", icon: "syringe", tone: "primary" },
        { label: "میانگین قند خون", value: rep.glucose.avg ? formatInteger(rep.glucose.avg) : "—", unit: "mg/dL", icon: "droplet", tone: rep.glucose.avg > 140 ? "danger" : "success" },
        { label: "آخرین فشار خون", value: rep.bp.latest ? `${rep.bp.latest.systolic}/${rep.bp.latest.diastolic}` : "—", unit: "mmHg", icon: "stethoscope", tone: "success" },
        { label: "وزن فعلی", value: rep.weight.latest ? formatNumber(rep.weight.latest.weight, { decimals: 1 }) : "—", unit: "kg", icon: "scale", tone: "accent" },
      ];
      return `
        <div class="report-kpis">
          ${items.map((it) => `
            <div class="report-kpi">
              <div class="report-kpi__label">${icon(it.icon, { size: 12 })} ${escapeHTML(it.label)}</div>
              <div class="report-kpi__value report-kpi__value--${it.tone}">${it.value}<small>${it.unit}</small></div>
            </div>
          `).join("")}
        </div>
      `;
    }

    function renderActivitySummary(rep) {
      const a = rep.activity.totals;
      const items = [
        { label: "قدم", value: formatInteger(a.steps), unit: "قدم" },
        { label: "مسافت", value: formatNumber(a.km, { decimals: 2 }), unit: "km" },
        { label: "مدت ورزش", value: formatDuration(a.minutes), unit: "" },
        { label: "کالری سوزانده", value: formatInteger(a.kcalBurned), unit: "kcal" },
      ];
      return `
        <div class="report-kpis">
          ${items.map((it) => `
            <div class="report-kpi">
              <div class="report-kpi__label">${escapeHTML(it.label)}</div>
              <div class="report-kpi__value">${it.value}<small>${escapeHTML(it.unit)}</small></div>
            </div>
          `).join("")}
        </div>
      `;
    }

    function renderFoodTable(entries) {
      if (!entries?.length) return '<div class="empty empty--compact"><div class="empty__text">غذایی ثبت نشده است</div></div>';
      return `
        <div class="table-wrap">
          <table class="table table--compact">
            <thead><tr>
              <th>وعده</th><th>غذا</th><th class="num">گرم</th>
              <th class="num">کالری</th><th class="num">پ</th>
              <th class="num">ک</th><th class="num">چ</th><th class="num">فیبر</th>
            </tr></thead>
            <tbody>
              ${entries.map((r) => `
                <tr>
                  <td>${mealLabel(r.meal)}</td>
                  <td>${escapeHTML(r.food_name)}</td>
                  <td class="num">${r.grams}</td>
                  <td class="num">${formatInteger(r.calories)}</td>
                  <td class="num">${formatNumber(r.protein, { decimals: 1 })}</td>
                  <td class="num">${formatNumber(r.carbs, { decimals: 1 })}</td>
                  <td class="num">${formatNumber(r.fat, { decimals: 1 })}</td>
                  <td class="num">${formatNumber(r.fiber, { decimals: 1 })}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    function renderCaloriesLine(daily) {
      const data = daily.map((d) => ({ x: d.date, y: d.calories, label: formatWeekdayShort(d.date).slice(0, 2) }));
      return chart.lineChart({ data, width: 900, height: 260, xLabel: (d) => d.label });
    }

    function renderStepsBar(daily) {
      const data = daily.map((d) => ({ label: formatWeekdayShort(d.date).slice(0, 2), value: d.steps }));
      return chart.barChart({ data, width: 500, height: 260 });
    }

    function renderMacroDonut(food) {
      const avg2 = food.averages;
      if (!avg2) return '<div class="empty empty--compact"><div class="empty__text">داده‌ای برای نمایش نیست</div></div>';
      const slices = [
        { label: "پروتئین", value: avg2.protein, color: "#6366f1" },
        { label: "کربوهیدرات", value: avg2.carbs, color: "#22d3ee" },
        { label: "چربی", value: avg2.fat, color: "#f59e0b" },
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
        { label: "میانگین انسولین روزانه", value: formatNumber(rep.insulin.avgPerDay, { decimals: 2 }), unit: "واحد/روز" },
        { label: "میانگین قند", value: rep.glucose.avg ? formatInteger(rep.glucose.avg) : "—", unit: "mg/dL" },
        { label: "حداقل قند", value: rep.glucose.min ? formatInteger(rep.glucose.min) : "—", unit: "mg/dL" },
        { label: "حداکثر قند", value: rep.glucose.max ? formatInteger(rep.glucose.max) : "—", unit: "mg/dL" },
        { label: "میانگین سیستولیک", value: rep.bp.systolicAvg ? formatInteger(rep.bp.systolicAvg) : "—", unit: "mmHg" },
        { label: "میانگین دیاستولیک", value: rep.bp.diastolicAvg ? formatInteger(rep.bp.diastolicAvg) : "—", unit: "mmHg" },
        { label: "تغییر وزن", value: rep.weight.change ? (rep.weight.change > 0 ? "+" + formatNumber(rep.weight.change, { decimals: 1 }) : formatNumber(rep.weight.change, { decimals: 1 })) : "—", unit: "kg" },
      ];
      return `
        <div class="report-averages">
          ${items.map((it) => `
            <div class="report-average">
              <div class="report-average__label">${escapeHTML(it.label)}</div>
              <div class="report-average__value">${it.value} <small class="text-2xs text-muted">${escapeHTML(it.unit)}</small></div>
            </div>
          `).join("")}
        </div>
      `;
    }

    function renderSleepRangeSummary(rep) {
      if (!rep.sleep) return '<div class="empty empty--compact"><div class="empty__text">داده‌ای برای نمایش نیست</div></div>';
      const s = rep.sleep;
      return `
        <div class="report-averages">
          <div class="report-average">
            <div class="report-average__label">میانگین ساعت خواب</div>
            <div class="report-average__value">${formatNumber(s.avgHours, { decimals: 1 })} <small class="text-2xs text-muted">ساعت</small></div>
          </div>
          <div class="report-average">
            <div class="report-average__label">مجموع خواب</div>
            <div class="report-average__value">${formatNumber(s.totalHours, { decimals: 1 })} <small class="text-2xs text-muted">ساعت</small></div>
          </div>
          <div class="report-average">
            <div class="report-average__label">میانگین کیفیت</div>
            <div class="report-average__value">${formatNumber(s.avgQuality, { decimals: 1 })} <small class="text-2xs text-muted">از ۵</small></div>
          </div>
          <div class="report-average">
            <div class="report-average__label">بهترین شب</div>
            <div class="report-average__value">${formatNumber(s.best.durationHours, { decimals: 1 })} <small class="text-2xs text-muted">ساعت</small></div>
          </div>
        </div>
      `;
    }

    async function renderMonthlyGrid(rep) {
      const data = await heatmapData(rep.start, rep.end, "calories");
      const byDate = new Map(data.map((d) => [d.date, d]));
      const days = rangeDays(rep.start, rep.end);
      const cells = days.map((d) => {
        const row = byDate.get(d);
        return { date: d, level: row?.level || 0, kcal: row?.calories || 0 };
      });
      return `
        <div class="report-month-grid">
          <div class="report-month-dow">ش</div>
          <div class="report-month-dow">ی</div>
          <div class="report-month-dow">د</div>
          <div class="report-month-dow">س</div>
          <div class="report-month-dow">چ</div>
          <div class="report-month-dow">پ</div>
          <div class="report-month-dow">ج</div>
          ${cells.map((c) => `
            <div class="report-month-cell" data-level="${c.level}" data-date="${c.date}" title="${formatShort(c.date)} — ${formatInteger(c.kcal)} kcal">
              <div class="report-month-cell__day">${toJalali(c.date).day}</div>
              ${c.kcal ? `<div class="report-month-cell__kcal">${formatInteger(c.kcal)}</div>` : ""}
            </div>
          `).join("")}
        </div>
      `;
    }

    function renderWeekTable(foodDaily, actDaily) {
      const actByDate = new Map(actDaily.map((d) => [d.date, d]));
      return `
        <div class="table-wrap">
          <table class="report-week-table">
            <thead><tr>
              <th>روز</th><th class="num">کالری</th><th class="num">پروتئین</th>
              <th class="num">کربوهیدرات</th><th class="num">چربی</th>
              <th class="num">قدم</th><th class="num">کیلومتر</th>
            </tr></thead>
            <tbody>
              ${foodDaily.map((d) => {
                const a = actByDate.get(d.date) || { steps: 0, km: 0 };
                return `
                  <tr>
                    <td class="${d.date === todayISO() ? "is-today" : ""}">
                      ${formatWeekdayShort(d.date)} ${formatShort(d.date)}
                    </td>
                    <td class="num">${formatInteger(d.calories)}</td>
                    <td class="num">${formatNumber(d.protein, { decimals: 1 })}</td>
                    <td class="num">${formatNumber(d.carbs, { decimals: 1 })}</td>
                    <td class="num">${formatNumber(d.fat, { decimals: 1 })}</td>
                    <td class="num">${formatInteger(a.steps)}</td>
                    <td class="num">${formatNumber(a.km, { decimals: 2 })}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
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

    /* ---------- Exports --------------------------------------------- */
    function downloadJSON(data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      triggerDownload(blob, `report-${currentRange}-${anchorDate}.json`);
      toast.success("فایل JSON دانلود شد");
    }

    function downloadCSV(data) {
      const rows = [];
      if (currentRange === "daily") {
        rows.push(["نوع", "مقدار", "واحد"]);
        rows.push(["کالری", data.food.totals.calories, "kcal"]);
        rows.push(["پروتئین", data.food.totals.protein, "g"]);
        rows.push(["کربوهیدرات", data.food.totals.carbs, "g"]);
        rows.push(["چربی", data.food.totals.fat, "g"]);
        rows.push([]);
        rows.push(["وعده", "غذا", "گرم", "کالری", "پروتئین", "کربوهیدرات", "چربی"]);
        data.food.entries.forEach((r) => rows.push([r.meal, r.food_name, r.grams, r.calories, r.protein, r.carbs, r.fat]));
      } else {
        rows.push(["تاریخ", "کالری", "پروتئین", "کربوهیدرات", "چربی", "قدم"]);
        const actByDate = new Map((data.activity.daily || []).map((d) => [d.date, d]));
        (data.food.daily || []).forEach((d) => {
          const a = actByDate.get(d.date) || {};
          rows.push([d.date, d.calories, d.protein, d.carbs, d.fat, a.steps || 0]);
        });
      }
      const csv = rows.map((r) => r.join(",")).join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      triggerDownload(blob, `report-${currentRange}-${anchorDate}.csv`);
      toast.success("فایل CSV دانلود شد");
    }

    function triggerDownload(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /* ---------- Lifecycle ------------------------------------------- */
    await load();

    return function cleanup() {
      if (pickerDetach) { try { pickerDetach(); } catch {} pickerDetach = null; }
    };
  },
};