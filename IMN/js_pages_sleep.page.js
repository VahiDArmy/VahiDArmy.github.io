/**
 * Sleep page — entry first, report block below.
 */

import { $, createElement, delegate } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { mountReportBlock } from "../components/report-block.js";
import { chart } from "../components/chart.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { sleep } from "../services/sleep.service.js";
import {
  todayISO, addDays, minutesBetween, formatShort, formatWeekdayShort,
} from "../utils/date.js";
import { formatDuration, formatNumber, escapeHTML } from "../utils/format.js";
import { SLEEP_QUALITY } from "../config/constants.js";

export default {
  title: "خواب",
  subtitle: "ساعت خواب و بیداری",
  icon: "moon",

  async render(container) {
    const unsubscribers = [];
    let currentRow = null;
    let reportBlock = null;

    container.innerHTML = `
      <section id="sleep-entry-form" class="section">
        <div class="sleep-hero" data-hero>
          <div class="sleep-hero__main">
            <div class="sleep-hero__title">${icon("bedtime", { size: 20 })}<span>خواب شب گذشته</span></div>
            <div class="sleep-hero__value">
              <span class="sleep-hero__duration" data-hero-duration>—</span>
              <small>ساعت</small>
            </div>
            <div class="sleep-hero__meta" data-hero-meta></div>
          </div>
          <div class="sleep-hero__quality" data-hero-quality></div>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="sleep-times">
            <div class="sleep-time sleep-time--sleep">
              <div class="sleep-time__label">${icon("moon", { size: 16 })}<span>ساعت خواب</span></div>
              <input type="time" class="sleep-time__input" data-input="sleep-time" />
            </div>
            <div class="sleep-time sleep-time--wake">
              <div class="sleep-time__label">${icon("sunrise", { size: 16 })}<span>ساعت بیداری</span></div>
              <input type="time" class="sleep-time__input" data-input="wake-time" />
            </div>
          </div>

          <div class="form-group" style="margin-top:16px">
            <label class="form-label">کیفیت خواب</label>
            <div class="quality-picker" data-quality></div>
          </div>

          <div class="sleep-notes">
            <label class="sleep-notes__label">یادداشت (اختیاری)</label>
            <textarea class="form-textarea" data-input="notes" rows="2" placeholder="مثال: بیداری شبانه، کابوس، ..."></textarea>
          </div>

          <div class="flex items-center justify-between gap-3 flex-wrap" style="margin-top:16px">
            <div class="text-xs text-muted" data-duration-hint></div>
            <div class="flex gap-2">
              <button class="btn btn--ghost btn--sm" data-action="clear" type="button">${icon("trash", { size: 14 })}<span>پاک کردن</span></button>
              <button class="btn btn--primary" data-action="save" type="button">${icon("save", { size: 16 })}<span>ذخیره</span></button>
            </div>
          </div>
        </div>
      </section>

      <div data-report-slot></div>
    `;

    function currentDate() {
      return store.get("selectedDate") || todayISO();
    }

    function renderQualityPicker(selected) {
      const q = $("[data-quality]", container);
      q.innerHTML = SLEEP_QUALITY.map((o) => `
        <div class="quality-opt ${o.id === selected ? "is-active" : ""}" data-q="${o.id}" role="button" tabindex="0">
          <div class="quality-opt__emoji">${o.emoji}</div>
          <div class="quality-opt__label">${o.label}</div>
        </div>
      `).join("");
    }

    delegate(container, "click", "[data-q]", (e, btn) => {
      const q = Number(btn.dataset.q);
      container.querySelectorAll("[data-q]").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.q) === q));
    });

    delegate(container, "input", "[data-input]", () => updateDurationHint());
    delegate(container, "change", "[data-input]", () => updateDurationHint());

    delegate(container, "click", "[data-action='save']", async () => {
      const iso = currentDate();
      const sleep_time = container.querySelector('[data-input="sleep-time"]').value;
      const wake_time = container.querySelector('[data-input="wake-time"]').value;
      const notes = container.querySelector('[data-input="notes"]').value;
      const selected = container.querySelector("[data-q].is-active");
      const quality = selected ? Number(selected.dataset.q) : null;

      if (!sleep_time || !wake_time) {
        toast.warning("ساعت خواب و بیداری را وارد کنید");
        return;
      }
      try {
        await sleep.save(iso, { sleep_time, wake_time, quality, notes });
        toast.success("ذخیره شد");
      } catch {
        toast.error("ذخیره ناموفق بود");
      }
    });

    delegate(container, "click", "[data-action='clear']", async () => {
      if (!currentRow) return;
      try {
        await sleep.remove(currentDate());
        toast.success("پاک شد");
      } catch { toast.error("خطا"); }
    });

    function updateDurationHint() {
      const s = container.querySelector('[data-input="sleep-time"]').value;
      const w = container.querySelector('[data-input="wake-time"]').value;
      const hint = $("[data-duration-hint]", container);
      if (s && w) {
        const mins = minutesBetween(s, w);
        hint.textContent = `مدت خواب: ${formatDuration(mins)}`;
      } else {
        hint.textContent = "";
      }
    }

    async function load() {
      const iso = currentDate();
      try {
        currentRow = await sleep.getByDate(iso);
        const sleepInput = container.querySelector('[data-input="sleep-time"]');
        const wakeInput = container.querySelector('[data-input="wake-time"]');
        const notesInput = container.querySelector('[data-input="notes"]');

        if (currentRow) {
          sleepInput.value = (currentRow.sleep_time || "").slice(0, 5);
          wakeInput.value = (currentRow.wake_time || "").slice(0, 5);
          notesInput.value = currentRow.notes || "";
          renderQualityPicker(currentRow.quality);
        } else {
          sleepInput.value = "";
          wakeInput.value = "";
          notesInput.value = "";
          renderQualityPicker(null);
        }
        updateDurationHint();
        renderHero(currentRow);
        reportBlock?.setDate(iso);
      } catch (err) {
        console.error("[sleep] load error", err);
        toast.error("خطا در بارگذاری اطلاعات خواب");
      }
    }

    function renderHero(row) {
      const durEl = $("[data-hero-duration]", container);
      const metaEl = $("[data-hero-meta]", container);
      const qEl = $("[data-hero-quality]", container);

      if (!row) {
        durEl.textContent = "—";
        metaEl.innerHTML = '<span class="text-muted">برای این روز خوابی ثبت نشده است</span>';
        qEl.innerHTML = "";
        return;
      }
      durEl.textContent = formatNumber(row.durationHours, { decimals: 1 });
      metaEl.innerHTML = `
        <span class="sleep-hero__meta-item">${icon("moon", { size: 16 })}<span>خواب: <strong>${(row.sleep_time || "").slice(0,5) || "—"}</strong></span></span>
        <span class="sleep-hero__meta-item">${icon("sunrise", { size: 16 })}<span>بیداری: <strong>${(row.wake_time || "").slice(0,5) || "—"}</strong></span></span>
        <span class="sleep-hero__meta-item">${icon("clock", { size: 16 })}<span>مدت: <strong>${formatDuration(row.durationMinutes)}</strong></span></span>
      `;
      const q = SLEEP_QUALITY.find((x) => x.id === row.quality);
      qEl.innerHTML = q
        ? `<div style="font-size:32px;line-height:1">${q.emoji}</div><div class="text-xs text-muted">${q.label}</div>`
        : "";
    }

    /* ---------- Report block --------------------------------------- */
    async function sleepSummary(range, dateISO) {
      const { start, end, label } = rangeWindow(range, dateISO);
      const rows = await sleep.listByRange(start, end);
      const withData = rows.filter((r) => r.durationMinutes > 0);

      const avgHours = withData.length
        ? withData.reduce((s, r) => s + r.durationHours, 0) / withData.length
        : 0;
      const avgQuality = withData.filter((r) => r.quality).length
        ? withData.filter((r) => r.quality).reduce((s, r) => s + r.quality, 0) / withData.filter((r) => r.quality).length
        : 0;

      const kpis = range === "daily"
        ? [
            { label: "مدت خواب", value: withData[0] ? formatNumber(withData[0].durationHours, { decimals: 1 }) : "—", unit: "ساعت", tone: "primary" },
            { label: "کیفیت", value: withData[0]?.quality || "—", unit: "از ۵", tone: "success" },
            { label: "ساعت خواب", value: (withData[0]?.sleep_time || "—").slice(0, 5), tone: "accent" },
            { label: "ساعت بیداری", value: (withData[0]?.wake_time || "—").slice(0, 5), tone: "warning" },
          ]
        : [
            { label: "میانگین خواب", value: formatNumber(avgHours, { decimals: 1 }), unit: "ساعت", tone: "primary" },
            { label: "میانگین کیفیت", value: formatNumber(avgQuality, { decimals: 1 }), unit: "از ۵", tone: "success" },
            { label: "شب‌های ثبت‌شده", value: withData.length, unit: "", tone: "accent" },
            { label: "مجموع خواب", value: formatNumber(withData.reduce((s, r) => s + r.durationHours, 0), { decimals: 1 }), unit: "ساعت", tone: "warning" },
          ];

      const chartData = withData.map((r) => ({
        label: formatWeekdayShort(r.log_date).slice(0, 2),
        value: Number(r.durationHours.toFixed(2)),
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
      subject: "sleep",
      date: currentDate(),
      summaryFn: sleepSummary,
      title: "گزارش خواب",
      scrollTarget: "#sleep-entry-form",
    });

    unsubscribers.push(bus.on("sleep:changed", () => load()));
    unsubscribers.push(bus.on("date:changed", () => load()));

    await load();

    return function cleanup() {
      unsubscribers.forEach((off) => off());
      reportBlock?.destroy?.();
    };
  },
};