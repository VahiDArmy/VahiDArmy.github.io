/**
 * Dashboard — the "today at a glance" page.
 */

import { $, createElement, delegate } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { foodLog } from "../services/food-log.service.js";
import { healthSnapshot } from "../services/health.service.js";
import { sleep } from "../services/sleep.service.js";
import { activity } from "../services/activity.service.js";
import { dailyReport } from "../services/reports.service.js";
import {
  todayISO, formatLong, addDays, formatRelative, formatWeekdayShort,
} from "../utils/date.js";
import { formatInteger, formatNumber, formatDuration, escapeHTML } from "../utils/format.js";
import { MEALS, ACTIVITY_TYPES } from "../config/constants.js";
import { navigate } from "../router.js";
import { radial } from "../components/chart.js";

export default {
  title: "داشبورد",
  subtitle: "خلاصه امروز شما",
  icon: "dashboard",

  async render(container) {
    const dateISO = store.get("selectedDate") || todayISO();
    let unsubscribers = [];

    container.innerHTML = `
      <section class="dash-hero anim-fade-in">
        <div class="dash-hero__head">
          <div class="dash-hero__greeting">
            <div class="dash-hero__hello" data-greeting></div>
            <div class="dash-hero__sub" data-greeting-sub></div>
          </div>
          <div class="dash-hero__date-nav">
            <button class="btn btn--ghost btn--icon" data-nav="prev" type="button" title="روز قبل">${icon("chevronRight", { size: 16 })}</button>
            <span class="dash-hero__date-label" data-date-label></span>
            <button class="btn btn--ghost btn--icon" data-nav="next" type="button" title="روز بعد">${icon("chevronLeft", { size: 16 })}</button>
          </div>
        </div>
        <div class="dash-summary" data-summary></div>
      </section>

      <div class="grid grid-kpi" data-kpis style="margin-bottom:24px"></div>

      <div class="grid" style="grid-template-columns: 1.4fr 1fr; gap:20px; margin-bottom:24px">
        <div class="dash-ring" data-ring-container></div>
        <div class="card">
          <div class="card__header">
            <div class="card__title">${icon("zap", { size: 20 })}<span>اقدامات سریع</span></div>
          </div>
          <div class="quick-actions" data-quick-actions></div>
        </div>
      </div>

      <div class="grid" style="grid-template-columns: 1fr 1fr; gap:20px">
        <div class="card">
          <div class="card__header">
            <div class="card__title">${icon("utensils", { size: 20 })}<span>وعده‌های امروز</span></div>
            <button class="btn btn--ghost btn--sm" data-goto="food" type="button">مشاهده کامل ${icon("arrowLeft", { size: 14 })}</button>
          </div>
          <div data-meals></div>
        </div>
        <div class="card">
          <div class="card__header">
            <div class="card__title">${icon("activity", { size: 20 })}<span>فعالیت‌های امروز</span></div>
            <button class="btn btn--ghost btn--sm" data-goto="activity" type="button">مشاهده کامل ${icon("arrowLeft", { size: 14 })}</button>
          </div>
          <div data-timeline></div>
        </div>
      </div>

      <style>
        @media (max-width: 900px) {
          [data-page="dashboard"] > .grid { grid-template-columns: 1fr !important; }
        }
      </style>
    `;

    /* ---------- Greeting ---------------------------------------------- */
    const hour = new Date().getHours();
    const greeting =
      hour < 5 ? "شب بخیر" :
      hour < 12 ? "صبح بخیر" :
      hour < 17 ? "وقت بخیر" :
      hour < 21 ? "عصر بخیر" : "شب بخیر";
    const name = store.get("profile")?.display_name || store.get("user")?.email?.split("@")[0] || "دوست عزیز";
    $("[data-greeting]", container).textContent = `${greeting}، ${name}`;
    $("[data-greeting-sub]", container).textContent = formatLong(dateISO);

    /* ---------- Date navigation -------------------------------------- */
    function updateDate(iso) {
      store.setSelectedDate(iso);
      loadAll();
    }

    delegate(container, "click", "[data-nav]", (e, btn) => {
      const dir = btn.dataset.nav === "next" ? 1 : -1;
      updateDate(addDays(store.get("selectedDate"), dir));
    });

    delegate(container, "click", "[data-goto]", (e, btn) => {
      navigate(btn.dataset.goto);
    });

    /* ---------- Load everything -------------------------------------- */
    async function loadAll() {
      const iso = store.get("selectedDate");
      $("[data-date-label]", container).textContent = formatRelative(iso);

      // Goals
      const goals = store.get("goals");

      try {
        const [report, snap, sleepRow, activityRows] = await Promise.all([
          dailyReport(iso),
          healthSnapshot(iso),
          sleep.getByDate(iso),
          activity.listByDate(iso),
        ]);

        renderSummary(report);
        renderKpis(report, snap, sleepRow);
        renderRing(report);
        renderMeals(report);
        renderTimeline(activityRows, snap);
      } catch (err) {
        console.error("[dashboard] load error", err);
        toast.error("خطا در بارگذاری اطلاعات");
      }

      // Quick actions
      renderQuickActions();
    }

    /* ---------- Summary strip ---------------------------------------- */
    function renderSummary(report) {
      const goals = store.get("goals");
      const f = report.food.totals;
      const a = report.activity.totals;
      const summaryEl = $("[data-summary]", container);

      const items = [
        { label: "کالری مصرفی", value: formatInteger(f.calories), unit: "kcal", tone: "primary" },
        { label: "پروتئین", value: formatInteger(f.protein), unit: "گرم", tone: "success" },
        { label: "کربوهیدرات", value: formatInteger(f.carbs), unit: "گرم", tone: "warning" },
        { label: "چربی", value: formatInteger(f.fat), unit: "گرم", tone: "danger" },
        { label: "قدم‌ها", value: formatInteger(a.steps), unit: "قدم", tone: "" },
        { label: "خواب دیشب", value: report.sleep ? formatNumber(report.sleep.durationHours, { decimals: 1 }) : "—", unit: "ساعت", tone: "" },
      ];

      summaryEl.innerHTML = items.map((it) => `
        <div class="dash-summary__item">
          <div class="dash-summary__label">${it.label}</div>
          <div class="dash-summary__value ${it.tone ? "dash-summary__value--" + it.tone : ""}">
            ${it.value} <small>${it.unit}</small>
          </div>
        </div>
      `).join("");
    }

    /* ---------- KPI cards -------------------------------------------- */
    function renderKpis(report, snap, sleepRow) {
      const goals = store.get("goals");
      const f = report.food.totals;
      const a = report.activity.totals;
      const water = 0; // future: water tracking

      const kcalPct = goals.calories ? Math.min(100, Math.round((f.calories / goals.calories) * 100)) : 0;

      const kpis = [
        {
          icon: "flame",
          tone: kcalPct > 110 ? "danger" : kcalPct > 90 ? "warning" : "success",
          label: "کالری",
          value: formatInteger(f.calories),
          unit: "از " + formatInteger(goals.calories),
          pct: kcalPct,
        },
        {
          icon: "footsteps",
          tone: a.steps >= goals.steps ? "success" : "accent",
          label: "قدم‌ها",
          value: formatInteger(a.steps),
          unit: "از " + formatInteger(goals.steps),
          pct: goals.steps ? Math.min(100, Math.round((a.steps / goals.steps) * 100)) : 0,
        },
        {
          icon: "moon",
          tone: sleepRow && sleepRow.durationHours >= 7 ? "success" : sleepRow ? "warning" : "",
          label: "خواب",
          value: sleepRow ? formatNumber(sleepRow.durationHours, { decimals: 1 }) : "—",
          unit: "از " + formatNumber(goals.sleepHours, { decimals: 1 }) + " ساعت",
          pct: sleepRow ? Math.min(100, Math.round((sleepRow.durationHours / goals.sleepHours) * 100)) : 0,
        },
        {
          icon: "droplet",
          tone: snap.glucoseAvg == null ? "" : snap.glucoseAvg > 140 ? "danger" : "success",
          label: "میانگین قند",
          value: snap.glucoseAvg == null ? "—" : formatInteger(snap.glucoseAvg),
          unit: "mg/dL",
          pct: null,
        },
        {
          icon: "syringe",
          tone: "primary",
          label: "انسولین",
          value: formatNumber(snap.totals.insulinUnits, { decimals: 1 }),
          unit: "واحد",
          pct: null,
        },
        {
          icon: "scale",
          tone: "accent",
          label: "آخرین وزن",
          value: snap.totals.latestWeight ? formatNumber(snap.totals.latestWeight.weight, { decimals: 1 }) : "—",
          unit: "کیلوگرم",
          pct: null,
        },
      ];

      $("[data-kpis]", container).innerHTML = kpis.map((k) => `
        <div class="kpi anim-fade-in-up">
          <div class="kpi__head">
            <span class="kpi__icon kpi__icon--${k.tone}">${icon(k.icon, { size: 16 })}</span>
            <span>${escapeHTML(k.label)}</span>
          </div>
          <div class="kpi__value">${k.value}<span class="kpi__unit">${escapeHTML(k.unit)}</span></div>
          ${k.pct != null ? `
            <div class="progress progress--sm" style="margin-top:auto">
              <div class="progress__bar" style="width:${k.pct}%"></div>
            </div>
          ` : ""}
        </div>
      `).join("");
    }

    /* ---------- Radial calorie ring ---------------------------------- */
    function renderRing(report) {
      const goals = store.get("goals");
      const { calories } = report.food.totals;
      const pct = goals.calories ? calories / goals.calories : 0;

      const el = $("[data-ring-container]", container);
      el.innerHTML = `
        <div class="dash-ring__chart">
          ${radial({
            value: calories,
            max: goals.calories,
            size: 160,
            thickness: 12,
            label: formatInteger(calories),
            sublabel: "کالری",
          })}
        </div>
        <div class="dash-ring__details">
          <div class="dash-ring__row">
            <span>هدف روزانه</span>
            <strong>${formatInteger(goals.calories)} kcal</strong>
          </div>
          <div class="dash-ring__row">
            <span>باقی‌مانده</span>
            <strong>${formatInteger(Math.max(0, goals.calories - calories))} kcal</strong>
          </div>
          <div class="dash-ring__row">
            <span>درصد تحقق</span>
            <strong>${Math.round(pct * 100)}٪</strong>
          </div>
          <div class="progress" style="margin-top:10px">
            <div class="progress__bar ${pct > 1 ? "progress__bar--warning" : ""}" style="width:${Math.min(100, pct * 100)}%"></div>
          </div>
        </div>
      `;
    }

    /* ---------- Quick actions ---------------------------------------- */
    function renderQuickActions() {
      const actions = [
        { icon: "plus", label: "افزودن غذا", route: "food" },
        { icon: "syringe", label: "ثبت انسولین", route: "health" },
        { icon: "moon", label: "ثبت خواب", route: "sleep" },
        { icon: "walk", label: "ثبت ورزش", route: "activity" },
      ];
      $("[data-quick-actions]", container).innerHTML = actions.map((a) => `
        <div class="quick-action" data-goto="${a.route}" role="button" tabindex="0">
          <div class="quick-action__icon">${icon(a.icon, { size: 22 })}</div>
          <div class="quick-action__label">${escapeHTML(a.label)}</div>
        </div>
      `).join("");
    }

    /* ---------- Meals overview --------------------------------------- */
    function renderMeals(report) {
      const grouped = report.food.perMeal || {};
      const mealsEl = $("[data-meals]", container);
      const items = MEALS.map((m) => {
        const stats = grouped[m.id] || { calories: 0, count: 0 };
        return `
          <div class="flex items-center justify-between" style="padding:8px 0;border-bottom:1px solid var(--color-divider)">
            <div class="flex items-center gap-2">
              <span class="kpi__icon kpi__icon--primary">${icon(m.icon, { size: 14 })}</span>
              <span class="text-sm">${m.label}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-muted">${stats.count || 0} آیتم</span>
              <strong class="num text-sm" style="min-width:70px;text-align:left">${formatInteger(stats.calories)} kcal</strong>
            </div>
          </div>
        `;
      }).join("");

      mealsEl.innerHTML = items || '<div class="empty empty--compact"><div class="empty__text">موردی ثبت نشده</div></div>';
    }

    /* ---------- Timeline --------------------------------------------- */
    function renderTimeline(activityRows, snap) {
      const el = $("[data-timeline]", container);
      const items = [];

      // Health events
      snap.insulin.forEach((r) => items.push({
        type: "insulin", tone: "primary", time: r.log_time,
        title: `انسولین ${formatNumber(r.units, { decimals: 1 })} واحد`,
        body: r.type ? `نوع: ${r.type}` : "",
      }));
      snap.glucose.forEach((r) => items.push({
        type: "glucose", tone: r.value > 140 ? "danger" : "success", time: r.log_time,
        title: `قند خون: ${formatInteger(r.value)} mg/dL`,
        body: "",
      }));
      snap.bp.forEach((r) => items.push({
        type: "bp", tone: "success", time: r.log_time,
        title: `فشار خون: ${r.systolic}/${r.diastolic}`,
        body: "",
      }));
      activityRows.forEach((r) => {
        const label = ACTIVITY_TYPES.find((t) => t.id === r.type)?.label || r.type;
        items.push({
          type: "activity", tone: "accent", time: r.log_time,
          title: label + (r.distance_km ? ` • ${formatNumber(r.distance_km, { decimals: 2 })} کیلومتر` : ""),
          body: r.duration_min ? formatDuration(r.duration_min) : "",
        });
      });

      if (!items.length) {
        el.innerHTML = `
          <div class="empty empty--compact">
            <div class="empty__art"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.4"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
            <div class="empty__text">هنوز فعالیتی برای امروز ثبت نشده است</div>
          </div>
        `;
        return;
      }

      items.sort((a, b) => (b.time || "00:00").localeCompare(a.time || "00:00"));
      el.innerHTML = `<div class="timeline">${
        items.slice(0, 10).map((it) => `
          <div class="timeline__item">
            <div class="timeline__dot timeline__dot--${it.tone}"></div>
            <div class="timeline__head">
              <span class="timeline__title">${escapeHTML(it.title)}</span>
              <span class="timeline__time num">${it.time || "—"}</span>
            </div>
            ${it.body ? `<div class="timeline__body">${escapeHTML(it.body)}</div>` : ""}
          </div>
        `).join("")
      }</div>`;
    }

    /* ---------- Subscribe to changes --------------------------------- */
    const refresh = () => loadAll();
    unsubscribers.push(bus.on("food-log:changed", refresh));
    unsubscribers.push(bus.on("health:changed", refresh));
    unsubscribers.push(bus.on("sleep:changed", refresh));
    unsubscribers.push(bus.on("activity:changed", refresh));

    // Initial load
    await loadAll();

    return function cleanup() {
      unsubscribers.forEach((off) => off());
      unsubscribers = [];
    };
  },
};