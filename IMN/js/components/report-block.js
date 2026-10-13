/**
 * Report Block — a reusable daily / weekly / monthly summary that sits
 * at the bottom of every subject page (food, health, sleep, activity).
 *
 * Each subject provides its own summary function that receives a range
 * and returns { kpis, chart, empty }.
 *
 * Public API:
 *   const block = mountReportBlock(container, {
 *     subject: "food",
 *     date: "2025-01-15",
 *     summaryFn: foodSummary,   // (range, dateISO) => { kpis, chart }
 *     onRangeChange: (range) => {},
 *     scrollTarget: "#food-entry-form",  // id of the entry section
 *   });
 *   block.setDate(iso);
 *   block.destroy();
 */

import { createElement, delegate } from "../utils/dom.js";
import { icon } from "./icons.js";
import { skeleton } from "./skeleton.js";
import { escapeHTML } from "../utils/format.js";

const RANGES = [
  { id: "daily", label: "روزانه" },
  { id: "weekly", label: "هفتگی" },
  { id: "monthly", label: "ماهانه" },
];

export function mountReportBlock(container, opts = {}) {
  const {
    subject = "dashboard",
    date,
    summaryFn,
    onRangeChange,
    scrollTarget,
    title = "گزارش",
  } = opts;

  let range = "daily";
  let currentDate = date;
  let requestId = 0;

  container.innerHTML = `
    <div class="report-block" data-report-block>
      <div class="report-block__head">
        <div class="report-block__title">
          ${icon("barChart", { size: 20 })}
          <span>${escapeHTML(title)}</span>
          <span class="report-block__subtitle" data-report-subtitle></span>
        </div>
        <div class="report-range" role="tablist" aria-label="بازه گزارش">
          ${RANGES.map((r) => `
            <button class="report-range__btn ${r.id === range ? "is-active" : ""}"
                    data-range="${r.id}" type="button" role="tab"
                    aria-selected="${r.id === range}">${r.label}</button>
          `).join("")}
        </div>
      </div>
      <div data-report-content></div>
    </div>
  `;

  const blockEl = container.querySelector("[data-report-block]");
  const contentEl = container.querySelector("[data-report-content]");
  const subtitleEl = container.querySelector("[data-report-subtitle]");

  delegate(blockEl, "click", "[data-range]", (e, btn) => {
    const next = btn.dataset.range;
    if (next === range) return;
    range = next;
    blockEl.querySelectorAll("[data-range]").forEach((b) => {
      const on = b.dataset.range === range;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    onRangeChange?.(range);
    load();
  });

  delegate(blockEl, "click", "[data-scroll-target]", (e, el) => {
    const sel = el.dataset.scrollTarget;
    const target = document.querySelector(sel);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      // Highlight the target briefly
      target.classList.add("is-highlighted");
      setTimeout(() => target.classList.remove("is-highlighted"), 1400);
    }
  });

  async function load() {
    if (!summaryFn) {
      contentEl.innerHTML = `<div class="report-block__empty">گزارشی برای نمایش نیست</div>`;
      return;
    }
    const myId = ++requestId;

    contentEl.innerHTML = `
      <div class="report-block__kpis">
        ${Array.from({ length: 4 }, () => `<div class="sk sk-block" style="height:76px"></div>`).join("")}
      </div>
      <div class="report-block__chart">${skeleton.chart(160)}</div>
    `;

    try {
      const result = await summaryFn(range, currentDate);
      if (myId !== requestId) return;

      const kpis = result?.kpis || [];
      const chart = result?.chart || "";
      const subtitle = result?.subtitle || rangeSubtitle(range, currentDate);

      subtitleEl.textContent = subtitle;

      if (!kpis.length && !chart) {
        contentEl.innerHTML = `<div class="report-block__empty">داده‌ای برای این بازه ثبت نشده است</div>`;
        return;
      }

      contentEl.innerHTML = `
        ${kpis.length ? `
          <div class="report-block__kpis">
            ${kpis.map(renderKpi).join("")}
          </div>
        ` : ""}
        ${chart ? `<div class="report-block__chart">${chart}</div>` : ""}
        ${scrollTarget ? `
          <div style="margin-top:16px;text-align:center">
            <button class="report-block__action" data-scroll-target="${scrollTarget}" type="button">
              ${icon("plus", { size: 13 })}
              <span>ثبت مورد جدید</span>
            </button>
          </div>
        ` : ""}
      `;
    } catch (err) {
      if (myId !== requestId) return;
      console.error("[report-block] load failed", err);
      contentEl.innerHTML = `
        <div class="report-block__empty" style="color:var(--color-danger)">
          خطا در بارگذاری گزارش
        </div>
      `;
    }
  }

  function renderKpi(k) {
    const deltaHtml = k.delta && k.delta.direction !== "flat"
      ? `<span class="report-block__kpi-delta report-block__kpi-delta--${k.delta.direction}">
          ${k.delta.direction === "up" ? "▲" : "▼"} ${Math.abs(k.delta.pct)}٪
        </span>`
      : "";
    return `
      <div class="report-block__kpi">
        <div class="report-block__kpi-label">${escapeHTML(k.label)}</div>
        <div class="report-block__kpi-value ${k.tone ? "report-block__kpi-value--" + k.tone : ""}">
          ${escapeHTML(String(k.value))}
          ${k.unit ? `<small>${escapeHTML(k.unit)}</small>` : ""}
        </div>
        ${deltaHtml}
      </div>
    `;
  }

  function rangeSubtitle(r, iso) {
    if (!iso) return "";
    if (r === "daily") return "امروز";
    if (r === "weekly") return "۷ روز اخیر";
    return "۳۰ روز اخیر";
  }

  load();

  return {
    el: blockEl,
    setDate(iso) {
      if (!iso) return;
      currentDate = iso;
      load();
    },
    get range() { return range; },
    refresh: load,
    destroy() {
      container.innerHTML = "";
    },
  };
}