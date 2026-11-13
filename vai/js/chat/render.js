// ============================================================================
// render.js — draws the thread, handles incremental updates and scrolling
// ============================================================================

import { renderMessage } from "./message.js";
import { autoScroll, isNearBottom } from "../utils.js";

const els = {};
const rows = new Map();

export function initRender() {
  els.thread = document.getElementById("thread");
  els.empty = document.getElementById("threadEmpty");
  els.scrollDown = document.getElementById("scrollDownBtn");
  els.scrollDown?.addEventListener("click", () => {
    els.thread?.scrollTo({ top: els.thread.scrollHeight, behavior: "smooth" });
  });
  els.thread?.addEventListener("scroll", () => {
    const near = isNearBottom(els.thread, 160);
    if (els.scrollDown) els.scrollDown.hidden = near;
  });
}

export function renderThread(messages) {
  const thread = els.thread;
  if (!thread) return;
  rows.clear();
  thread.innerHTML = "";
  if (!messages || !messages.length) {
    els.empty?.removeAttribute("hidden");
    if (els.scrollDown) els.scrollDown.hidden = true;
    return;
  }
  els.empty?.setAttribute("hidden", "");
  const frag = document.createDocumentFragment();
  for (const m of messages) {
    const row = renderMessage(m);
    rows.set(m.id, row);
    frag.appendChild(row);
  }
  thread.appendChild(frag);
  thread.scrollTo({ top: thread.scrollHeight, behavior: "auto" });
  if (els.scrollDown) els.scrollDown.hidden = true;
}

export function patchStreamingMessage(msg) {
  const thread = els.thread;
  const row = rows.get(msg.id);
  if (!thread) return;
  const atBottom = isNearBottom(thread, 140);
  if (row) {
    const fresh = renderMessage(msg);
    row.replaceWith(fresh);
    rows.set(msg.id, fresh);
  } else {
    const fresh = renderMessage(msg);
    rows.set(msg.id, fresh);
    thread.appendChild(fresh);
  }
  if (atBottom) autoScroll(thread, { threshold: 400 });
  if (els.scrollDown) els.scrollDown.hidden = isNearBottom(thread, 160);
}

export function scrollThreadToMessage(id) {
  const row = rows.get(id);
  if (!row) return;
  row.scrollIntoView({ behavior: "smooth", block: "center" });
  row.classList.add("is-highlighted");
  setTimeout(() => row.classList.remove("is-highlighted"), 1500);
}

export function showEmpty(onPickSuggestion) {
  els.empty?.removeAttribute("hidden");
  const cards = document.getElementById("emptyCards");
  if (!cards || cards.childElementCount) return;
  const suggestions = [
    { t: "توضیح ساده", s: "یک مفهوم پیچیده را ساده توضیح بده", p: "یادگیری ماشین را در سه سطح ساده، متوسط و پیشرفته توضیح بده." },
    { t: "کدنویسی", s: "یک تابع پایتون بنویس", p: "یک تابع پایتون بنویس که لیست اعداد را گرفته و میانه و انحراف معیار را برگرداند." },
    { t: "مقایسه", s: "دو رویکرد را مقایسه کن", p: "REST و GraphQL را با جدول مقایسه کن و برای یک اپ موبایل پیشنهاد بده." },
    { t: "نوشتن", s: "یک متن حرفه‌ای بنویس", p: "یک ایمیل حرفه‌ای برای درخواست تمدید ددلاین پروژه بنویس." },
  ];
  for (const s of suggestions) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "empty-card";
    b.innerHTML = `<b>${s.t}</b><span>${s.s}</span>`;
    b.addEventListener("click", () => onPickSuggestion?.(s.p));
    cards.appendChild(b);
  }
}

export function hideEmpty() {
  els.empty?.setAttribute("hidden", "");
}
