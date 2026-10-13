/**
 * Activity page — entry first, report block below.
 */

import { $, createElement, delegate } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import { mountReportBlock } from "../components/report-block.js";
import { chart } from "../components/chart.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { activity } from "../services/activity.service.js";
import { todayISO, addDays, nowTimeStr, formatShort, formatWeekdayShort } from "../utils/date.js";
import { formatInteger, formatNumber, formatDuration, escapeHTML } from "../utils/format.js";
import { ACTIVITY_TYPES } from "../config/constants.js";

export default {
  title: "فعالیت",
  subtitle: "پیاده‌روی، ورزش و قدم‌ها",
  icon: "activity",

  async render(container) {
    const unsubscribers = [];
    let reportBlock = null;

    container.innerHTML = `
      <section id="activity-entry-form" class="section">
        <div class="grid" style="grid-template-columns: 1fr 1fr; gap:20px">
          <div class="card">
            <div class="card__header">
              <div class="card__title">${icon("footsteps", { size: 20 })}<span>پیاده‌روی / دویدن</span></div>
            </div>
            <div class="km-input">
              <div class="km-input__row">
                <div class="km-input__value num" data-km-value>0</div>
                <span class="km-input__unit">کیلومتر</span>
              </div>
              <input type="range" class="form-range km-input__slider" data-km-slider min="0" max="30" step="0.1" value="0" />
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">نوع</label>
                  <select class="form-select" data-input="walk-type">
                    ${ACTIVITY_TYPES.filter((t) => t.hasKm).map((t) => `<option value="${t.id}">${t.label}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">مدت (دقیقه)</label>
                  <input type="number" class="form-input" data-input="walk-min" value="30" min="1" />
                </div>
              </div>
              <button class="btn btn--primary btn--block" data-action="add-walk" type="button">${icon("plus", { size: 16 })}<span>ثبت فعالیت</span></button>
            </div>
          </div>

          <div class="card">
            <div class="card__header">
              <div class="card__title">${icon("dumbbell", { size: 20 })}<span>فعالیت دیگر</span></div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">نوع</label>
                <select class="form-select" data-input="other-type">
                  ${ACTIVITY_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">مدت (دقیقه)</label>
                <input type="number" class="form-input" data-input="other-min" value="30" min="1" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">یادداشت</label>
              <textarea class="form-textarea" data-input="other-notes" rows="2" placeholder="توضیحات..."></textarea>
            </div>
            <button class="btn btn--primary btn--block" data-action="add-other" type="button">${icon("plus", { size: 16 })}<span>ثبت</span></button>
          </div>
        </div>

        <div class="card" style="margin-top:20px">
          <div class="card__header">
            <div class="card__title">${icon("clock", { size: 20 })}<span>فعالیت‌های امروز</span></div>
          </div>
          <div class="exercise-log" data-log></div>
        </div>
      </section>

      <div data-report-slot></div>

      <style>
        @media (max-width: 720px) {
          [data-page="activity"] .grid { grid-template-columns: 1fr !important; }
        }
      </style>
    `;

    function currentDate() {
      return store.get("selectedDate") || todayISO();
    }

    delegate(container, "input", "[data-km-slider]", (e, slider) => {
      $("[data-km-value]", container).textContent = slider.value;
    });

    delegate(container, "click", "[data-action='add-walk']", async () => {
      const km = Number(container.querySelector("[data-km-slider]").value) || 0;
      const type = container.querySelector('[data-input="walk-type"]').value;
      const minutes = Number(container.querySelector('[data-input="walk-min"]').value) || 0;
      if (km <= 0 || minutes <= 0) return toast.warning("کیلومتر و مدت را وارد کنید");
      try {
        await activity.add({
          log_date: currentDate(),
          log_time: nowTimeStr(),
          type,
          distance_km: km,
          duration_min: minutes,
          calories_burned: activity.estimateCaloriesBurned(type, minutes, km),
        });
        toast.success("فعالیت ثبت شد");
        $("[data-km-value]", container).textContent = "0";
        container.querySelector("[data-km-slider]").value = 0;
      } catch { toast.error("ثبت ناموفق بود"); }
    });

    delegate(container, "click", "[data-action='add-other']", async () => {
      const type = container.querySelector('[data-input="other-type"]').value;
      const minutes = Number(container.querySelector('[data-input="other-min"]').value) || 0;
      const notes = container.querySelector('[data-input="other-notes"]').value;
      if (minutes <= 0) return toast.warning("مدت را وارد کنید");
      try {
        await activity.add({
          log_date: currentDate(),
          log_time: nowTimeStr(),
          type,
          duration_min: minutes,
          notes,
          calories_burned: activity.estimateCaloriesBurned(type, minutes),
        });
        toast.success("فعالیت ثبت شد");
        container.querySelector('[data-input="other-notes"]').value = "";
      } catch { toast.error("ثبت ناموفق بود"); }
    });

    delegate(container, "click", "[data-del]", async (e, btn) => {
      e.stopPropagation();
      const ok = await confirm({ title: "حذف", message: "این فعالیت حذف شود؟", variant: "danger", confirmLabel: "حذف" });
      if (!ok) return;
      try {
        await activity.remove(btn.dataset.del);
        toast.success("حذف شد");
      } catch { toast.error("حذف ناموفق بود"); }
    });

    async function load() {
      const iso = currentDate();
      try {
        const rows = await activity.listByDate(iso);
        renderLog(rows);
        reportBlock?.setDate(iso);
      } catch (err) {
        console.error("[activity] load error", err);
        toast.error("خطا در بارگذاری");
      }
    }

    function renderLog(rows) {
      const el = $("[data-log]", container);
      if (!rows.length) {
        el.innerHTML = '<div class="text-sm text-muted text-center" style="padding:32px 0">هنوز فعالیتی ثبت نشده است</div>';
        return;
      }
      el.innerHTML = rows.map((r) => {
        const type = ACTIVITY_TYPES.find((t) => t.id === r.type);
        const iconName = type?.icon || "activity";
        return `
          <div class="exercise-entry">
            <div class="exercise-entry__icon">${icon(iconName, { size: 16 })}</div>
            <div class="exercise-entry__body">
              <div class="exercise-entry__name">${escapeHTML(type?.label || r.type)}</div>
              <div class="exercise-entry__meta">
                ${r.distance_km ? `<span>${formatNumber(r.distance_km, { decimals: 2 })} کیلومتر</span>` : ""}
                ${r.duration_min ? `<span>${formatDuration(r.duration_min)}</span>` : ""}
                ${r.calories_burned ? `<span>${formatInteger(r.calories_burned)} kcal</span>` : ""}
              </div>
            </div>
            <span class="text-xs text-muted num">${(r.log_time || "").slice(0, 5) || "—"}</span>
            <button class="icon-btn" data-del="${r.id}" type="button" title="حذف">${icon("trash", { size: 14 })}</button>
          </div>
        `;
      }).join("");
    }

    /* ---------- Report block --------------------------------------- */
    async function activitySummary(range, dateISO) {
      const { start, end, label } = rangeWindow(range, dateISO);
      const rows = await activity.dailyTotals(start, end);

      const totals = rows.reduce((acc, d) => {
        acc.steps += d.steps; acc.km += d.km; acc.minutes += d.minutes; acc.kcal += d.kcal;
        return acc;
      }, { steps: 0, km: 0, minutes: 0, kcal: 0 });

      const activeDays = rows.filter((d) => d.entries > 0).length;
      const goals = store.get("goals");

      const kpis = range === "daily"
        ? [
            { label: "قدم", value: formatInteger(totals.steps), unit: "قدم", tone: totals.steps >= goals.steps ? "success" : "primary" },
            { label: "مسافت", value: formatNumber(totals.km, { decimals: 2 }), unit: "km", tone: "accent" },
            { label: "مدت", value: formatInteger(totals.minutes), unit: "دقیقه", tone: "primary" },
            { label: "کالری سوزانده", value: formatInteger(totals.kcal), unit: "kcal", tone: "warning" },
          ]
        : [
            { label: "قدم کل", value: formatInteger(totals.steps), unit: "قدم", tone: "primary" },
            { label: "میانگین روزانه", value: formatInteger(totals.steps / Math.max(1, rows.length)), unit: "قدم", tone: "accent" },
            { label: "مسافت کل", value: formatNumber(totals.km, { decimals: 1 }), unit: "km", tone: "success" },
            { label: "روزهای فعال", value: activeDays, unit: `از ${rows.length}`, tone: "warning" },
          ];

      const chartData = rows.map((d) => ({
        label: formatWeekdayShort(d.date).slice(0, 2),
        value: d.steps,
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
      subject: "activity",
      date: currentDate(),
      summaryFn: activitySummary,
      title: "گزارش فعالیت",
      scrollTarget: "#activity-entry-form",
    });

    unsubscribers.push(bus.on("activity:changed", () => load()));
    unsubscribers.push(bus.on("date:changed", () => load()));

    await load();

    return function cleanup() {
      unsubscribers.forEach((off) => off());
      reportBlock?.destroy?.();
    };
  },
};