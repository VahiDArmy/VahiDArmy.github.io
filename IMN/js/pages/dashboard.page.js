/**
 * Dashboard — compact overview.
 *
 * Every KPI card is a link to the relevant subject page. The `data-goto`
 * attribute is added to each `.kpi` element so the container-level
 * delegate handler picks up the click and navigates.
 */

import { $, delegate } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { mountReportBlock } from "../components/report-block.js";
import { chart, radial } from "../components/chart.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { dailyReport } from "../services/reports.service.js";
import { foodLog } from "../services/food-log.service.js";
import { activity } from "../services/activity.service.js";
import { sleep } from "../services/sleep.service.js";
import { healthSnapshot } from "../services/health.service.js";
import { navigate } from "../router.js";
import { todayISO, addDays, formatShort, formatWeekdayShort } from "../utils/date.js";
import { formatInteger, formatNumber, escapeHTML } from "../utils/format.js";
import { MEALS } from "../config/constants.js";

export default {
  title: "داشبورد",
  subtitle: "خلاصه امروز",
  icon: "dashboard",

  async render(container) {
    const unsubscribers = [];
    let reportBlock = null;

    container.innerHTML = `
      <section id="dashboard-entry" class="section">
        <div class="grid grid-kpi" data-kpis></div>

        <div class="grid" style="grid-template-columns: 1.4fr 1fr; gap:20px; margin-top:20px">
          <div class="dash-ring" data-ring></div>
          <div class="card">
            <div class="card__header">
              <div class="card__title">${icon("zap", { size: 20 })}<span>اقدامات سریع</span></div>
            </div>
            <div class="quick-actions" data-quick-actions></div>
          </div>
        </div>

        <div class="grid" style="grid-template-columns: 1fr 1fr; gap:20px; margin-top:20px">
          <div class="card">
            <div class="card__header">
              <div class="card__title">${icon("utensils", { size: 20 })}<span>وعده‌های امروز</span></div>
              <button class="btn btn--ghost btn--sm" data-goto="food" type="button">مشاهده کامل ${icon("arrowLeft", { size: 14 })}</button>
            </div>
            <div data-meals></div>
          </div>
          <div class="card">
            <div class="card__header">
              <div class="card__title">${icon("activity", { size: 20 })}<span>فعالیت‌ها</span></div>
              <button class="btn btn--ghost btn--sm" data-goto="activity" type="button">مشاهده کامل ${icon("arrowLeft", { size: 14 })}</button>
            </div>
            <div data-timeline></div>
          </div>
        </div>
      </section>

      <div data-report-slot></div>

      <style>
        @media (max-width: 900px) {
          [data-page="dashboard"] .grid[style*="grid-template-columns: 1.4fr"] { grid-template-columns: 1fr !important; }
          [data-page="dashboard"] .grid[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
        /* KPI cards are clickable */
        .kpi[data-goto] { cursor: pointer; }
        .kpi[data-goto]:focus-visible {
          outline: 2px solid var(--color-primary);
          outline-offset: 2px;
        }
      </style>
    `;

    function currentDate() {
      return store.get("selectedDate") || todayISO();
    }

    /* Every `[data-goto]` element navigates — KPIs, quick actions, headers. */
    delegate(container, "click", "[data-goto]", (e, btn) => {
      const route = btn.dataset.goto;
      if (route) navigate(route);
    });
    delegate(container, "keydown", "[data-goto]", (e, btn) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigate(btn.dataset.goto);
      }
    });

    async function load() {
      const iso = currentDate();
      try {
        const [report, snap, sleepRow, activityRows] = await Promise.all([
          dailyReport(iso),
          healthSnapshot(iso),
          sleep.getByDate(iso),
          activity.listByDate(iso),
        ]);
        renderKpis(report, snap, sleepRow);
        renderRing(report);
        renderMeals(report);
        renderTimeline(activityRows, snap);
        renderQuickActions();
        reportBlock?.setDate(iso);
      } catch (err) {
        console.error("[dashboard] load error", err);
        toast.error("خطا در بارگذاری اطلاعات");
      }
    }

    /* --------------------------------------------------------------
       KPI cards — each one links to the page that owns that metric
       -------------------------------------------------------------- */
    function renderKpis(report, snap, sleepRow) {
      const goals = store.get("goals");
      const f = report.food.totals;
      const a = report.activity.totals;
      const kcalPct = goals.calories ? Math.min(100, Math.round((f.calories / goals.calories) * 100)) : 0;

      const kpis = [
        {
          icon: "flame",
          tone: kcalPct > 110 ? "danger" : kcalPct > 90 ? "warning" : "success",
          label: "کالری",
          value: formatInteger(f.calories),
          unit: "از " + formatInteger(goals.calories),
          pct: kcalPct,
          route: "food",
        },
        {
          icon: "footsteps",
          tone: a.steps >= goals.steps ? "success" : "accent",
          label: "قدم‌ها",
          value: formatInteger(a.steps),
          unit: "از " + formatInteger(goals.steps),
          pct: goals.steps ? Math.min(100, Math.round((a.steps / goals.steps) * 100)) : 0,
          route: "activity",
        },
        {
          icon: "moon",
          tone: sleepRow && sleepRow.durationHours >= 7 ? "success" : sleepRow ? "warning" : "",
          label: "خواب",
          value: sleepRow ? formatNumber(sleepRow.durationHours, { decimals: 1 }) : "—",
          unit: "از " + formatNumber(goals.sleepHours, { decimals: 1 }) + " ساعت",
          pct: sleepRow ? Math.min(100, Math.round((sleepRow.durationHours / goals.sleepHours) * 100)) : 0,
          route: "sleep",
        },
        {
          icon: "droplet",
          tone: snap.glucoseAvg == null ? "" : snap.glucoseAvg > 140 ? "danger" : "success",
          label: "میانگین قند",
          value: snap.glucoseAvg == null ? "—" : formatInteger(snap.glucoseAvg),
          unit: "mg/dL",
          pct: null,
          route: "health",
        },
        {
          icon: "syringe",
          tone: "primary",
          label: "انسولین",
          value: formatNumber(snap.totals.insulinUnits, { decimals: 1 }),
          unit: "واحد",
          pct: null,
          route: "health",
        },
        {
          icon: "scale",
          tone: "accent",
          label: "آخرین وزن",
          value: snap.totals.latestWeight ? formatNumber(snap.totals.latestWeight.weight, { decimals: 1 }) : "—",
          unit: "کیلوگرم",
          pct: null,
          route: "health",
        },
      ];

      $("[data-kpis]", container).innerHTML = kpis.map((k) => `
        <div class="kpi anim-fade-in-up"
             data-goto="${k.route}"
             role="button"
             tabindex="0"
             aria-label="${escapeHTML(k.label)} — رفتن به صفحه مربوطه">
          <div class="kpi__head">
            <span class="kpi__icon kpi__icon--${k.tone}">${icon(k.icon, { size: 16 })}</span>
            <span>${escapeHTML(k.label)}</span>
            <span class="kpi__chevron" aria-hidden="true">${icon("chevronLeft", { size: 14 })}</span>
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

    function renderRing(report) {
      const goals = store.get("goals");
      const calories = report.food.totals.calories;
      const pct = goals.calories ? calories / goals.calories : 0;

      $("[data-ring]", container).innerHTML = `
        <div class="dash-ring__chart">
          ${radial({
            value: calories, max: goals.calories, size: 160, thickness: 12,
            label: formatInteger(calories), sublabel: "کالری",
          })}
        </div>
        <div class="dash-ring__details">
          <div class="dash-ring__row"><span>هدف روزانه</span><strong>${formatInteger(goals.calories)} kcal</strong></div>
          <div class="dash-ring__row"><span>باقی‌مانده</span><strong>${formatInteger(Math.max(0, goals.calories - calories))} kcal</strong></div>
          <div class="dash-ring__row"><span>درصد تحقق</span><strong>${Math.round(pct * 100)}٪</strong></div>
          <div class="progress" style="margin-top:10px">
            <div class="progress__bar ${pct > 1 ? "progress__bar--warning" : ""}" style="width:${Math.min(100, pct * 100)}%"></div>
          </div>
        </div>
      `;
    }

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

    function renderMeals(report) {
      const grouped = report.food.perMeal || {};
      $("[data-meals]", container).innerHTML = MEALS.map((m) => {
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
    }

    function renderTimeline(activityRows, snap) {
      const items = [];
      snap.insulin.forEach((r) => items.push({
        tone: "primary", time: r.log_time,
        title: `انسولین ${formatNumber(r.units, { decimals: 1 })} واحد`,
        body: r.type ? `نوع: ${r.type}` : "",
      }));
      snap.glucose.forEach((r) => items.push({
        tone: r.value > 140 ? "danger" : "success", time: r.log_time,
        title: `قند خون: ${formatInteger(r.value)} mg/dL`, body: "",
      }));
      snap.bp.forEach((r) => items.push({
        tone: "success", time: r.log_time,
        title: `فشار: ${r.systolic}/${r.diastolic}`, body: "",
      }));
      activityRows.forEach((r) => {
        const label = ACTIVITY_LABEL(r.type);
        items.push({
          tone: "accent", time: r.log_time,
          title: label + (r.distance_km ? ` • ${formatNumber(r.distance_km, { decimals: 2 })} کیلومتر` : ""),
          body: r.duration_min ? `${r.duration_min} دقیقه` : "",
        });
      });

      const el = $("[data-timeline]", container);
      if (!items.length) {
        el.innerHTML = '<div class="text-xs text-muted text-center" style="padding:24px 0">هنوز فعالیتی ثبت نشده</div>';
        return;
      }
      items.sort((a, b) => (b.time || "00:00").localeCompare(a.time || "00:00"));
      el.innerHTML = `<div class="timeline">${items.slice(0, 8).map((it) => `
        <div class="timeline__item">
          <div class="timeline__dot timeline__dot--${it.tone}"></div>
          <div class="timeline__head">
            <span class="timeline__title">${escapeHTML(it.title)}</span>
            <span class="timeline__time num">${(it.time || "—").slice(0, 5)}</span>
          </div>
          ${it.body ? `<div class="timeline__body">${escapeHTML(it.body)}</div>` : ""}
        </div>
      `).join("")}</div>`;
    }

    /* ---------- Report block --------------------------------------- */
    async function dashboardSummary(range, dateISO) {
      const { start, end, label } = rangeWindow(range, dateISO);
      const [foodDaily, actDaily] = await Promise.all([
        foodLog.totalsByRange(start, end),
        activity.dailyTotals(start, end),
      ]);

      const calTotal = foodDaily.reduce((s, d) => s + d.calories, 0);
      const stepsTotal = actDaily.reduce((s, d) => s + d.steps, 0);
      const avgCalories = foodDaily.length ? Math.round(calTotal / foodDaily.length) : 0;
      const activeDays = foodDaily.filter((d) => d.entries > 0).length;

      const kpis = [
        { label: "کالری کل", value: formatInteger(calTotal), unit: "kcal", tone: "warning" },
        { label: "میانگین روزانه", value: formatInteger(avgCalories), unit: "kcal", tone: "primary" },
        { label: "قدم کل", value: formatInteger(stepsTotal), unit: "قدم", tone: "accent" },
        { label: "روزهای فعال", value: activeDays, unit: `از ${foodDaily.length}`, tone: "success" },
      ];

      const chartData = foodDaily.map((d) => ({
        x: formatWeekdayShort(d.date).slice(0, 2),
        y: d.calories,
        label: formatWeekdayShort(d.date).slice(0, 2),
      }));
      const chartHtml = chart.lineChart({
        data: chartData,
        width: 900, height: 180,
        xLabel: (d) => d.label,
      });

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
      subject: "dashboard",
      date: currentDate(),
      summaryFn: dashboardSummary,
      title: "گزارش کلی",
      scrollTarget: "#dashboard-entry",
    });

    /* ---------- Events --------------------------------------------- */
    unsubscribers.push(bus.on("food-log:changed", () => load()));
    unsubscribers.push(bus.on("health:changed", () => load()));
    unsubscribers.push(bus.on("sleep:changed", () => load()));
    unsubscribers.push(bus.on("activity:changed", () => load()));
    unsubscribers.push(bus.on("date:changed", () => load()));

    await load();

    return function cleanup() {
      unsubscribers.forEach((off) => off());
      reportBlock?.destroy?.();
    };
  },
};

function ACTIVITY_LABEL(type) {
  const map = {
    walk: "پیاده‌روی", run: "دویدن", bike: "دوچرخه", gym: "باشگاه",
    swim: "شنا", yoga: "یوگا", other: "فعالیت",
  };
  return map[type] || type;
}