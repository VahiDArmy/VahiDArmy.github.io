/**
 * Sleep page — bedtime, wake time, quality, notes.
 */

import { $, createElement, delegate } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { sleep } from "../services/sleep.service.js";
import {
  todayISO, addDays, formatLong, formatRelative, formatWeekdayShort,
  startOfWeek, endOfWeek, rangeDays, minutesBetween,
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

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header__info">
          <div class="page-header__title">خواب</div>
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

      <div class="sleep-hero">
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

      <div class="card" style="margin-bottom:20px">
        <div class="card__header">
          <div class="card__title">${icon("clock", { size: 20 })}<span>ثبت خواب</span></div>
        </div>
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
        <div class="form-group">
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

      <div class="card">
        <div class="card__header">
          <div class="card__title">${icon("barChart", { size: 20 })}<span>هفته جاری</span></div>
        </div>
        <div class="sleep-week" data-week></div>
        <div class="grid grid-3" style="margin-top:20px" data-stats></div>
      </div>
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

    delegate(container, "click", "[data-nav]", (e, btn) => {
      const dir = btn.dataset.nav === "next" ? 1 : -1;
      store.setSelectedDate(addDays(currentDate(), dir));
      load();
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
      } catch (err) {
        console.error(err);
        toast.error("ذخیره ناموفق بود");
      }
    });

    delegate(container, "click", "[data-action='clear']", async () => {
      if (!currentRow) return;
      try {
        await sleep.remove(currentDate());
        toast.success("پاک شد");
        await load();
      } catch {
        toast.error("خطا");
      }
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
      $("[data-date-label]", container).textContent = formatRelative(iso);
      $("[data-date-sub]", container).textContent = formatLong(iso);

      try {
        currentRow = await sleep.getByDate(iso);
        const sleepInput = container.querySelector('[data-input="sleep-time"]');
        const wakeInput = container.querySelector('[data-input="wake-time"]');
        const notesInput = container.querySelector('[data-input="notes"]');

        if (currentRow) {
          sleepInput.value = currentRow.sleep_time || "";
          wakeInput.value = currentRow.wake_time || "";
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
        await renderWeek(iso);
        await renderStats(iso);
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
        <span class="sleep-hero__meta-item">${icon("moon", { size: 16 })}<span>خواب: <strong>${row.sleep_time || "—"}</strong></span></span>
        <span class="sleep-hero__meta-item">${icon("sunrise", { size: 16 })}<span>بیداری: <strong>${row.wake_time || "—"}</strong></span></span>
        <span class="sleep-hero__meta-item">${icon("clock", { size: 16 })}<span>مدت: <strong>${formatDuration(row.durationMinutes)}</strong></span></span>
      `;
      const q = SLEEP_QUALITY.find((x) => x.id === row.quality);
      qEl.innerHTML = q
        ? `<div style="font-size:32px;line-height:1">${q.emoji}</div><div class="text-xs text-muted">${q.label}</div>`
        : "";
    }

    async function renderWeek(iso) {
      const start = startOfWeek(iso);
      const end = endOfWeek(iso);
      const days = rangeDays(start, end);
      const rows = await sleep.listByRange(start, end);
      const byDate = new Map(rows.map((r) => [r.log_date, r]));
      const maxH = Math.max(10, ...rows.map((r) => r.durationHours));

      $("[data-week]", container).innerHTML = days.map((d) => {
        const r = byDate.get(d);
        const h = r?.durationHours || 0;
        const pct = (h / maxH) * 100;
        return `
          <div class="sleep-week__day ${d === iso ? "is-today" : ""}" data-date="${d}" role="button" tabindex="0">
            <div class="sleep-week__label">${formatWeekdayShort(d).slice(0, 2)}</div>
            <div class="sleep-week__bar">
              <div class="sleep-week__fill" style="height:${pct}%"></div>
            </div>
            <div class="sleep-week__value">${h ? formatNumber(h, { decimals: 1 }) : "—"}</div>
          </div>
        `;
      }).join("");

      $("[data-week]", container).querySelectorAll("[data-date]").forEach((el) => {
        el.addEventListener("click", () => {
          store.setSelectedDate(el.dataset.date);
          load();
        });
      });
    }

    async function renderStats(iso) {
      const start = startOfWeek(iso);
      const end = endOfWeek(iso);
      const stats = await sleep.stats(start, end);
      $("[data-stats]", container).innerHTML = `
        <div class="stat-tile">
          <div class="stat-tile__icon">${icon("clock", { size: 18 })}</div>
          <div class="stat-tile__body">
            <div class="stat-tile__value num">${formatNumber(stats.avgHours, { decimals: 1 })}</div>
            <div class="stat-tile__label">میانگین ساعت خواب</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile__icon" style="background:var(--color-success-soft);color:var(--color-success)">${icon("trophy", { size: 18 })}</div>
          <div class="stat-tile__body">
            <div class="stat-tile__value num">${stats.best ? formatNumber(stats.best.durationHours, { decimals: 1 }) : "—"}</div>
            <div class="stat-tile__label">بهترین خواب</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile__icon" style="background:var(--color-warning-soft);color:var(--color-warning)">${icon("heart", { size: 18 })}</div>
          <div class="stat-tile__body">
            <div class="stat-tile__value num">${formatNumber(stats.avgQuality, { decimals: 1 })}</div>
            <div class="stat-tile__label">میانگین کیفیت</div>
          </div>
        </div>
      `;
    }

    unsubscribers.push(bus.on("sleep:changed", () => load()));

    await load();

    return function cleanup() {
      unsubscribers.forEach((off) => off());
    };
  },
};