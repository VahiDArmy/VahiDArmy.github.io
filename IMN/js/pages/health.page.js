/**
 * Health page — insulin, glucose, blood pressure, weight.
 *
 * Fixes vs. previous version:
 *   • Delegation is bound ONCE at container level, not per-render.
 *     Previously each `renderGrid` re-bound listeners to the same grid
 *     element, so actions fired N times after N renders.
 *   • Each handler reads the current date via `currentDate()` so it stays
 *     correct after date changes.
 */

import { $, createElement, delegate } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { insulin, glucose, bp, weight, healthSnapshot } from "../services/health.service.js";
import {
  todayISO, addDays, formatLong, formatRelative, nowTimeStr,
} from "../utils/date.js";
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

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header__info">
          <div class="page-header__title">سلامت</div>
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

      <div class="health-grid" data-health-grid></div>

      <div class="card" style="margin-top:20px" data-history>
        <div class="card__header">
          <div class="card__title">${icon("clock", { size: 20 })}<span>تاریخچه اخیر</span></div>
        </div>
        <div data-history-content></div>
      </div>
    `;

    function currentDate() {
      return store.get("selectedDate") || todayISO();
    }

    /* ---------- Delegated listeners — attached ONCE ----------------- */
    delegate(container, "click", "[data-nav]", (e, btn) => {
      const dir = btn.dataset.nav === "next" ? 1 : -1;
      store.setSelectedDate(addDays(currentDate(), dir));
      load();
    });

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
      } catch (err) {
        toast.error(err?.message || "حذف ناموفق بود");
      }
    });

    /* ---------- Load ------------------------------------------------ */
    async function load() {
      const iso = currentDate();
      $("[data-date-label]", container).textContent = formatRelative(iso);
      $("[data-date-sub]", container).textContent = formatLong(iso);

      try {
        const snap = await healthSnapshot(iso);
        renderGrid(snap, iso);
        renderHistory();
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
            ${rows.length ? rows.slice(0, 5).map((r) => `
              <div class="health-entry">
                <span class="health-entry__value num">${formatNumber(r.units, { decimals: 1 })}U</span>
                <span class="health-entry__note">${escapeHTML(r.type || "—")}${r.site ? " • " + escapeHTML(r.site) : ""}</span>
                <span class="health-entry__time">${(r.log_time || "").slice(0, 5) || "—"}</span>
                <button class="icon-btn" data-del="${r.id}" data-kind="insulin" type="button" title="حذف">${icon("trash", { size: 12 })}</button>
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
            ${rows.slice(0, 5).map((r) => `
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
            ${rows.slice(0, 5).map((r) => `
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
            ${rows.slice(0, 5).map((r) => `
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

    /* ---------- History -------------------------------------------- */
    async function renderHistory() {
      const end = currentDate();
      const start = addDays(end, -6);
      try {
        const [ins, glu, b, w] = await Promise.all([
          insulin.listByRange(start, end),
          glucose.listByRange(start, end),
          bp.listByRange(start, end),
          weight.listByRange(start, end),
        ]);
        const el = $("[data-history-content]", container);
        const rows = [];

        ins.forEach((r) => rows.push({ date: r.log_date, kind: "انسولین", value: `${formatNumber(r.units, { decimals: 1 })} واحد`, time: r.log_time }));
        glu.forEach((r) => rows.push({ date: r.log_date, kind: "قند خون", value: `${formatInteger(r.value)} mg/dL`, time: r.log_time }));
        b.forEach((r) => rows.push({ date: r.log_date, kind: "فشار خون", value: `${r.systolic}/${r.diastolic}`, time: r.log_time }));
        w.forEach((r) => rows.push({ date: r.log_date, kind: "وزن", value: `${formatNumber(r.weight, { decimals: 1 })} kg`, time: r.log_time }));

        rows.sort((a, b2) => (b2.date + (b2.time || "")).localeCompare(a.date + (a.time || "")));

        if (!rows.length) {
          el.innerHTML = '<div class="text-sm text-muted text-center" style="padding:32px 0">موردی در ۷ روز اخیر ثبت نشده است</div>';
          return;
        }

        el.innerHTML = `
          <div class="table-wrap">
            <table class="table table--compact">
              <thead><tr><th>تاریخ</th><th>نوع</th><th>مقدار</th><th>ساعت</th></tr></thead>
              <tbody>
                ${rows.slice(0, 20).map((r) => `
                  <tr>
                    <td>${formatRelative(r.date)}</td>
                    <td>${r.kind}</td>
                    <td class="num">${r.value}</td>
                    <td class="num">${(r.time || "").slice(0, 5) || "—"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      } catch (err) {
        console.error("[health] history error", err);
      }
    }

    /* ---------- Subscribe ----------------------------------------- */
    unsubscribers.push(bus.on("health:changed", () => load()));

    await load();

    return function cleanup() {
      unsubscribers.forEach((off) => off());
    };
  },
};