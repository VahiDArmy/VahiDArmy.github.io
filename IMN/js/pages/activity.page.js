/**
 * Activity page — steps, km, exercise logs.
 */

import { $, createElement, delegate } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { activity } from "../services/activity.service.js";
import {
  todayISO, addDays, formatLong, formatRelative, nowTimeStr,
  startOfWeek, endOfWeek, rangeDays, formatWeekdayShort,
} from "../utils/date.js";
import {
  formatInteger, formatNumber, formatDuration, escapeHTML, toLatinDigits,
} from "../utils/format.js";
import { ACTIVITY_TYPES } from "../config/constants.js";

export default {
  title: "فعالیت و ورزش",
  subtitle: "پیاده‌روی، ورزش و قدم‌ها",
  icon: "activity",

  async render(container) {
    const unsubscribers = [];

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header__info">
          <div class="page-header__title">فعالیت و ورزش</div>
          <div class="page-header__subtitle" data-date-sub></div>
        </div>
        <div class="page-header__actions">
          <div class="dash-hero__date-nav">
            <button class="btn btn--ghost btn--icon" data-nav="prev" type="button">${icon("chevronRight", { size: 16 })}</button>
            <span class="dash-hero__date-label" data-date-label></span>
            <button class="btn btn--ghost btn--icon" data-nav="next" type="button">${icon("chevronLeft", { size: 16 })}</button>
          </div>
        </div>
      </div>

      <div class="grid grid-kpi" data-kpis style="margin-bottom:20px"></div>

      <div class="grid" style="grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px">
        <div class="card">
          <div class="card__header">
            <div class="card__title">${icon("footsteps", { size: 20 })}<span>ثبت پیاده‌روی / دویدن</span></div>
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
            <div class="card__title">${icon("dumbbell", { size: 20 })}<span>ثبت فعالیت دیگر</span></div>
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

      <div class="card">
        <div class="card__header">
          <div class="card__title">${icon("clock", { size: 20 })}<span>فعالیت‌های امروز</span></div>
        </div>
        <div class="exercise-log" data-log></div>
      </div>

      <div class="card" style="margin-top:20px">
        <div class="card__header">
          <div class="card__title">${icon("barChart", { size: 20 })}<span>قدم‌های هفته</span></div>
        </div>
        <div class="activity-week-chart" data-week></div>
      </div>
    `;

    function currentDate() {
      return store.get("selectedDate") || todayISO();
    }

    delegate(container, "click", "[data-nav]", (e, btn) => {
      const dir = btn.dataset.nav === "next" ? 1 : -1;
      store.setSelectedDate(addDays(currentDate(), dir));
      load();
    });

    // Slider live value
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
      } catch {
        toast.error("ثبت ناموفق بود");
      }
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
      } catch {
        toast.error("ثبت ناموفق بود");
      }
    });

    delegate(container, "click", "[data-del]", async (e, btn) => {
      e.stopPropagation();
      const ok = await confirm({ title: "حذف", message: "این فعالیت حذف شود؟", variant: "danger", confirmLabel: "حذف" });
      if (!ok) return;
      try {
        await activity.remove(btn.dataset.del);
        toast.success("حذف شد");
      } catch {
        toast.error("حذف ناموفق بود");
      }
    });

    async function load() {
      const iso = currentDate();
      $("[data-date-label]", container).textContent = formatRelative(iso);
      $("[data-date-sub]", container).textContent = formatLong(iso);

      try {
        const rows = await activity.listByDate(iso);
        renderKpis(rows);
        renderLog(rows);
        await renderWeek(iso);
      } catch (err) {
        console.error("[activity] load error", err);
        toast.error("خطا در بارگذاری");
      }
    }

    function renderKpis(rows) {
      const totals = {
        steps: rows.reduce((s, r) => s + (Number(r.steps) || 0), 0),
        km: rows.reduce((s, r) => s + (Number(r.distance_km) || 0), 0),
        minutes: rows.reduce((s, r) => s + (Number(r.duration_min) || 0), 0),
        kcal: rows.reduce((s, r) => s + (Number(r.calories_burned) || 0), 0),
      };
      const goals = store.get("goals");
      const stepPct = goals.steps ? Math.min(100, Math.round((totals.steps / goals.steps) * 100)) : 0;

      $("[data-kpis]", container).innerHTML = `
        <div class="kpi">
          <div class="kpi__head"><span class="kpi__icon kpi__icon--accent">${icon("footsteps", { size: 16 })}</span><span>قدم‌ها</span></div>
          <div class="kpi__value num">${formatInteger(totals.steps)}<span class="kpi__unit">قدم</span></div>
          <div class="progress progress--sm" style="margin-top:auto"><div class="progress__bar" style="width:${stepPct}%"></div></div>
        </div>
        <div class="kpi">
          <div class="kpi__head"><span class="kpi__icon kpi__icon--primary">${icon("walk", { size: 16 })}</span><span>مسافت</span></div>
          <div class="kpi__value num">${formatNumber(totals.km, { decimals: 2 })}<span class="kpi__unit">km</span></div>
        </div>
        <div class="kpi">
          <div class="kpi__head"><span class="kpi__icon kpi__icon--success">${icon("clock", { size: 16 })}</span><span>مدت</span></div>
          <div class="kpi__value num">${formatInteger(totals.minutes)}<span class="kpi__unit">دقیقه</span></div>
        </div>
        <div class="kpi">
          <div class="kpi__head"><span class="kpi__icon kpi__icon--warning">${icon("flame", { size: 16 })}</span><span>کالری سوزانده</span></div>
          <div class="kpi__value num">${formatInteger(totals.kcal)}<span class="kpi__unit">kcal</span></div>
        </div>
      `;
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
            <span class="text-xs text-muted num">${r.log_time || "—"}</span>
            <button class="icon-btn" data-del="${r.id}" type="button" title="حذف">${icon("trash", { size: 14 })}</button>
          </div>
        `;
      }).join("");
    }

    async function renderWeek(iso) {
      const start = startOfWeek(iso);
      const end = endOfWeek(iso);
      const days = rangeDays(start, end);
      const rows = await activity.dailyTotals(start, end);
      const byDate = new Map(rows.map((d) => [d.date, d]));
      const maxSteps = Math.max(1, ...rows.map((r) => r.steps));

      $("[data-week]", container).innerHTML = days.map((d) => {
        const r = byDate.get(d);
        const steps = r?.steps || 0;
        const pct = (steps / maxSteps) * 100;
        return `
          <div class="activity-week-chart__bar ${d === iso ? "is-today" : ""}">
            <div class="activity-week-chart__bar-value">${steps ? formatInteger(steps) : ""}</div>
            <div class="activity-week-chart__bar-fill" style="height:${pct}%"></div>
            <div class="activity-week-chart__bar-label">${formatWeekdayShort(d).slice(0, 2)}</div>
          </div>
        `;
      }).join("");
    }

    unsubscribers.push(bus.on("activity:changed", () => load()));

    await load();

    return function cleanup() {
      unsubscribers.forEach((off) => off());
    };
  },
};