/**
 * Health page — entry first, report block below.
 */

import { $, createElement, delegate } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import { mountReportBlock } from "../components/report-block.js";
import { chart } from "../components/chart.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { insulin, glucose, bp, weight, healthSnapshot } from "../services/health.service.js";
import { todayISO, addDays, nowTimeStr, formatShort } from "../utils/date.js";
import {
  formatInteger, formatNumber, escapeHTML, toLatinDigits,
} from "../utils/format.js";
import { INSULIN_TYPES, INSULIN_SITES } from "../config/constants.js";

export default {
  title: "سلامت",
  subtitle: "انسولین، قند، فشار خون و وزن",
  icon: "heartPulse",

  async render(container) {
    const unsubscribers = [];
    let reportBlock = null;

    container.innerHTML = `
      <section id="health-entry-form" class="section">
        <div class="health-grid" data-health-grid></div>
      </section>

      <div data-report-slot></div>
    `;

    function currentDate() {
      return store.get("selectedDate") || todayISO();
    }

    /* ---------- Delegated listeners --------------------------------- */
    delegate(container, "click", "[data-add]", async (e, btn) => {
      const kind = btn.dataset.add;
      const iso = currentDate();
      try {
        const time = nowTimeStr();
        if (kind === "insulin") {
          const units = Number(toLatinDigits($('[data-input="ins-units"]', container).value));
          if (!units || units <= 0) return toast.warning("مقدار واحد را وارد کنید");
          await insulin.add({
            log_date: iso, log_time: time, units,
            type: $('[data-input="ins-type"]', container).value || null,
            site: $('[data-input="ins-site"]', container).value || null,
          });
        } else if (kind === "glucose") {
          const value = Number(toLatinDigits($('[data-input="gl-value"]', container).value));
          if (!value) return toast.warning("مقدار قند را وارد کنید");
          await glucose.add({
            log_date: iso, log_time: time, value,
            context: $('[data-input="gl-ctx"]', container).value || null,
          });
        } else if (kind === "bp") {
          const systolic = Number(toLatinDigits($('[data-input="bp-sys"]', container).value));
          const diastolic = Number(toLatinDigits($('[data-input="bp-dia"]', container).value));
          if (!systolic || !diastolic) return toast.warning("هر دو مقدار را وارد کنید");
          await bp.add({ log_date: iso, log_time: time, systolic, diastolic });
        } else if (kind === "weight") {
          const w = Number(toLatinDigits($('[data-input="w-value"]', container).value));
          if (!w) return toast.warning("وزن را وارد کنید");
          await weight.add({ log_date: iso, log_time: time, weight: w });
        }
        toast.success("ثبت شد");
      } catch (err) {
        console.error("[health] add failed", err);
        toast.error(err?.message || "ثبت ناموفق بود");
      }
    });

    delegate(container, "click", "[data-del]", async (e, btn) => {
      e.stopPropagation();
      const kind = btn.dataset.kind;
      const id = btn.dataset.del;
      const ok = await confirm({ title: "حذف", message: "این مورد حذف شود؟", variant: "danger", confirmLabel: "حذف" });
      if (!ok) return;
      try {
        const svc = { insulin, glucose, bp, weight }[kind];
        await svc.remove(id);
        toast.success("حذف شد");
      } catch {
        toast.error("حذف ناموفق بود");
      }
    });

    /* ---------- Load ------------------------------------------------ */
    async function load() {
      const iso = currentDate();
      try {
        const snap = await healthSnapshot(iso);
        renderGrid(snap);
        reportBlock?.setDate(iso);
      } catch (err) {
        console.error("[health] load error", err);
        toast.error(err?.message || "خطا در بارگذاری اطلاعات");
      }
    }

    function renderGrid(snap) {
      const grid = $("[data-health-grid]", container);
      grid.innerHTML = `
        ${insulinCard(snap.insulin, snap.totals.insulinUnits)}
        ${glucoseCard(snap.glucose, snap.totals.glucoseAvg)}
        ${bpCard(snap.bp, snap.totals.latestBP)}
        ${weightCard(snap.weight, snap.totals.latestWeight)}
      `;
    }

    function insulinCard(rows, total) {
      return `
        <div class="health-card health-card--insulin">
          <div class="health-card__head">
            <div class="health-card__title">
              <span class="health-card__icon">${icon("syringe", { size: 18 })}</span>
              <span>انسولین</span>
            </div>
            <div class="badge badge--primary"><span class="num">${formatNumber(total, { decimals: 1 })} واحد</span></div>
          </div>
          <div class="health-card__latest">
            <span class="health-card__value num">${rows.length}</span>
            <span class="health-card__unit">تزریق امروز</span>
          </div>
          <div class="health-entries">
            ${rows.length ? rows.slice(0, 4).map((r) => `
              <div class="health-entry">
                <span class="health-entry__value num">${formatNumber(r.units, { decimals: 1 })}U</span>
                <span class="health-entry__note">${escapeHTML(r.type || "—")}${r.site ? " • " + escapeHTML(r.site) : ""}</span>
                <span class="health-entry__time">${(r.log_time || "").slice(0, 5) || "—"}</span>
                <button class="icon-btn" data-del="${r.id}" data-kind="insulin" type="button">${icon("trash", { size: 12 })}</button>
              </div>
            `).join("") : '<div class="text-2xs text-muted text-center" style="padding:12px 0">موردی ثبت نشده</div>'}
          </div>
          <div class="insulin-fields">
            <div class="form-row">
              <input class="form-input" type="number" step="0.5" min="0.5" placeholder="واحد" data-input="ins-units" />
              <select class="form-select" data-input="ins-type">
                <option value="">نوع…</option>
                ${INSULIN_TYPES.map((t) => `<option value="${t.label}">${t.label}</option>`).join("")}
              </select>
              <select class="form-select" data-input="ins-site">
                <option value="">محل…</option>
                ${INSULIN_SITES.map((s) => `<option value="${s.label}">${s.label}</option>`).join("")}
              </select>
            </div>
            <button class="btn btn--primary btn--sm" data-add="insulin" type="button">${icon("plus", { size: 14 })}<span>ثبت</span></button>
          </div>
        </div>
      `;
    }

    function glucoseCard(rows, avg) {
      const avgClass = avg == null ? "flat" : avg > 140 ? "danger" : avg < 70 ? "warning" : "success";
      return `
        <div class="health-card health-card--glucose">
          <div class="health-card__head">
            <div class="health-card__title">
              <span class="health-card__icon">${icon("droplet", { size: 18 })}</span>
              <span>قند خون</span>
            </div>
            ${avg != null ? `<div class="badge badge--${avgClass}"><span class="num">${formatInteger(avg)} mg/dL</span></div>` : ""}
          </div>
          <div class="health-card__latest">
            <span class="health-card__value num">${rows.length ? formatInteger(rows[0].value) : "—"}</span>
            <span class="health-card__unit">mg/dL</span>
          </div>
          <div class="health-card__time">${rows.length ? `آخرین: ${(rows[0].log_time || "").slice(0, 5) || "—"}` : "ثبت نشده"}</div>
          <div class="health-entries">
            ${rows.slice(0, 4).map((r) => `
              <div class="health-entry">
                <span class="health-entry__value num">${formatInteger(r.value)}</span>
                <span class="health-entry__note">${escapeHTML(r.context || "")}</span>
                <span class="health-entry__time">${(r.log_time || "").slice(0, 5) || "—"}</span>
                <button class="icon-btn" data-del="${r.id}" data-kind="glucose" type="button">${icon("trash", { size: 12 })}</button>
              </div>
            `).join("")}
          </div>
          <div class="health-add">
            <input type="number" min="20" max="600" placeholder="قند (mg/dL)" data-input="gl-value" />
            <select class="form-select" style="max-width:130px" data-input="gl-ctx">
              <option value="">وضعیت…</option>
              <option value="ناشتا">ناشتا</option>
              <option value="قبل غذا">قبل غذا</option>
              <option value="بعد غذا">بعد غذا</option>
              <option value="شب">شب</option>
            </select>
            <button class="btn btn--primary" data-add="glucose" type="button">${icon("plus", { size: 14 })}</button>
          </div>
        </div>
      `;
    }

    function bpCard(rows, latest) {
      const cls = latest ? bp.classify(latest.systolic, latest.diastolic) : null;
      return `
        <div class="health-card health-card--bp">
          <div class="health-card__head">
            <div class="health-card__title">
              <span class="health-card__icon">${icon("stethoscope", { size: 18 })}</span>
              <span>فشار خون</span>
            </div>
            ${cls ? `<div class="badge badge--${cls.tone}">${cls.label}</div>` : ""}
          </div>
          <div class="health-card__latest">
            <span class="health-card__value num">${latest ? `${latest.systolic}/${latest.diastolic}` : "—"}</span>
            <span class="health-card__unit">mmHg</span>
          </div>
          <div class="health-card__time">${latest ? `آخرین: ${(latest.log_time || "").slice(0, 5) || "—"}` : "ثبت نشده"}</div>
          <div class="health-entries">
            ${rows.slice(0, 4).map((r) => `
              <div class="health-entry">
                <span class="health-entry__value num">${r.systolic}/${r.diastolic}</span>
                <span class="health-entry__note">${r.pulse ? "نبض " + r.pulse : ""}</span>
                <span class="health-entry__time">${(r.log_time || "").slice(0, 5) || "—"}</span>
                <button class="icon-btn" data-del="${r.id}" data-kind="bp" type="button">${icon("trash", { size: 12 })}</button>
              </div>
            `).join("")}
          </div>
          <div class="health-add">
            <div class="bp-inputs">
              <input type="number" placeholder="سیستولیک" data-input="bp-sys" />
              <input type="number" placeholder="دیاستولیک" data-input="bp-dia" />
            </div>
            <button class="btn btn--primary" data-add="bp" type="button">${icon("plus", { size: 14 })}</button>
          </div>
        </div>
      `;
    }

    function weightCard(rows, latest) {
      return `
        <div class="health-card health-card--weight">
          <div class="health-card__head">
            <div class="health-card__title">
              <span class="health-card__icon">${icon("scale", { size: 18 })}</span>
              <span>وزن</span>
            </div>
          </div>
          <div class="health-card__latest">
            <span class="health-card__value num">${latest ? formatNumber(latest.weight, { decimals: 1 }) : "—"}</span>
            <span class="health-card__unit">کیلوگرم</span>
          </div>
          <div class="health-card__time">${latest ? `آخرین: ${(latest.log_time || "").slice(0, 5) || "—"}` : "ثبت نشده"}</div>
          <div class="health-entries">
            ${rows.slice(0, 4).map((r) => `
              <div class="health-entry">
                <span class="health-entry__value num">${formatNumber(r.weight, { decimals: 1 })}</span>
                <span class="health-entry__time">${(r.log_time || "").slice(0, 5) || "—"}</span>
                <button class="icon-btn" data-del="${r.id}" data-kind="weight" type="button">${icon("trash", { size: 12 })}</button>
              </div>
            `).join("")}
          </div>
          <div class="health-add">
            <input type="number" step="0.1" placeholder="وزن (kg)" data-input="w-value" />
            <button class="btn btn--primary" data-add="weight" type="button">${icon("plus", { size: 14 })}</button>
          </div>
        </div>
      `;
    }

    /* ---------- Report block --------------------------------------- */
    async function healthSummary(range, dateISO) {
      const { start, end, label } = rangeWindow(range, dateISO);
      const [ins, glu, b, w] = await Promise.all([
        insulin.listByRange(start, end),
        glucose.listByRange(start, end),
        bp.listByRange(start, end),
        weight.listByRange(start, end),
      ]);

      const insulinTotal = ins.reduce((s, r) => s + (Number(r.units) || 0), 0);
      const glucoseAvg = glu.length
        ? glu.reduce((s, r) => s + (Number(r.value) || 0), 0) / glu.length
        : null;
      const latestBP = b[0] || null;
      const weightChange = w.length >= 2
        ? Number(w[w.length - 1].weight) - Number(w[0].weight)
        : 0;

      const kpis = [
        { label: "انسولین", value: formatNumber(insulinTotal, { decimals: 1 }), unit: "واحد", tone: "primary" },
        { label: "میانگین قند", value: glucoseAvg ? formatInteger(glucoseAvg) : "—", unit: "mg/dL", tone: glucoseAvg > 140 ? "danger" : "success" },
        { label: "فشار آخر", value: latestBP ? `${latestBP.systolic}/${latestBP.diastolic}` : "—", unit: "mmHg", tone: "success" },
        { label: "تغییر وزن", value: weightChange ? (weightChange > 0 ? "+" + formatNumber(weightChange, { decimals: 1 }) : formatNumber(weightChange, { decimals: 1 })) : "—", unit: "kg", tone: weightChange > 0 ? "danger" : "success" },
      ];

      // Chart: glucose trend
      let chartHtml = "";
      if (glu.length) {
        const glucosePoints = glu.map((r) => ({
          label: formatShort(r.log_date).split("/")[2] || "",
          y: Number(r.value),
        }));
        chartHtml = chart.lineChart({ data: glucosePoints, width: 720, height: 180 });
      }

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
      subject: "health",
      date: currentDate(),
      summaryFn: healthSummary,
      title: "گزارش سلامت",
      scrollTarget: "#health-entry-form",
    });

    /* ---------- Events --------------------------------------------- */
    unsubscribers.push(bus.on("health:changed", () => load()));
    unsubscribers.push(bus.on("date:changed", () => load()));

    await load();

    return function cleanup() {
      unsubscribers.forEach((off) => off());
      reportBlock?.destroy?.();
    };
  },
};