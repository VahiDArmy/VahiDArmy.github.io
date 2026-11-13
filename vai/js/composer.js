// ============================================================================
// composer.js — textarea + edit mode + send / stop
// The textarea uses a bulletproof resize:
//   1. set inline height to 'auto'
//   2. read scrollHeight (content height + padding)
//   3. clamp to max & assign
// CSS sets line-height: 22px, padding: 8px 12px → 1 line = 38px exactly.
// ============================================================================

import { store, getSettings } from "./store.js";
import { sendMessage, cancelStream, isStreaming } from "./chat/session.js";
import { modelDisplayName, modelContextLength } from "./models.js";
import { faInt } from "./utils.js";
import { toast } from "./ui/toast.js";

const els = {};

function autoResize() {
  const t = els.input;
  if (!t) return;

  // Reset height to 'auto' so we can read the natural content height.
  t.style.height = "auto";
  // Force reflow in some browsers so scrollHeight reflects new value.
  // (Touching offsetHeight is enough.)
  void t.offsetHeight;

  const scrollH = t.scrollHeight;
  const maxH = Math.round(window.innerHeight * 0.46);

  if (scrollH > maxH) {
    t.style.height = maxH + "px";
    t.style.overflowY = "auto";
  } else {
    t.style.height = scrollH + "px";
    t.style.overflowY = "hidden";
  }
}

function updateCount() {
  const v = els.input?.value || "";
  els.count.textContent = v ? faInt(v.length) : "";
}

function enterEditMode(id) {
  const msg = store.get().messages.find((m) => m.id === id);
  if (!msg) return;
  store.setEditing(id);
  els.input.value = msg.content || "";
  els.banner.hidden = false;
  els.bannerText.textContent = "در حال ویرایش پیام ارسال‌شده…";
  els.box.classList.add("is-editing");
  autoResize();
  updateCount();
  els.input.focus();
  els.input.setSelectionRange(els.input.value.length, els.input.value.length);
}

function exitEditMode() {
  store.setEditing(null);
  els.banner.hidden = true;
  els.box.classList.remove("is-editing");
  els.input.value = "";
  autoResize();
  updateCount();
}

async function submit() {
  const text = els.input.value;
  if (!text.trim() || isStreaming()) return;
  const editing = store.get().editingMessageId;
  els.input.value = "";
  autoResize();
  updateCount();
  els.banner.hidden = true;
  els.box.classList.remove("is-editing");
  if (editing) store.setEditing(null);
  try {
    await sendMessage(text);
  } catch (e) {
    console.error(e);
    toast.err(String(e.message || e));
  }
}

export function initComposer() {
  els.input = document.getElementById("composerInput");
  els.box = document.getElementById("composerBox");
  els.send = document.getElementById("sendBtn");
  els.stop = document.getElementById("stopBtn");
  els.clear = document.getElementById("clearInputBtn");
  els.count = document.getElementById("composerCount");
  els.banner = document.getElementById("editBanner");
  els.bannerText = document.getElementById("editBannerText");
  els.cancelEdit = document.getElementById("editCancelBtn");
  els.hint = document.getElementById("composerHint");
  els.ctx = document.getElementById("composerCtx");

  if (!els.input) {
    console.error("[composer] #composerInput not found in DOM");
    return;
  }

  els.input.addEventListener("input", () => {
    autoResize();
    updateCount();
    refreshFooter();
  });

  // Ctrl/Cmd + Enter sends. Plain Enter inserts a newline.
  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  });

  els.send.addEventListener("click", submit);
  els.stop.addEventListener("click", () => {
    cancelStream();
    toast.info("توقف درخواست شد…");
  });
  els.clear.addEventListener("click", () => {
    els.input.value = "";
    autoResize();
    updateCount();
    els.input.focus();
  });
  els.cancelEdit.addEventListener("click", exitEditMode);

  store.on("edit:change", (id) => {
    if (id) enterEditMode(id);
    else {
      els.banner.hidden = true;
      els.box.classList.remove("is-editing");
    }
  });
  store.on("streaming:change", refreshSendState);
  store.on("model:change", refreshFooter);
  store.on("thread:reload", refreshFooter);

  refreshSendState();
  refreshFooter();

  // Force textarea to its correct height as soon as layout settles.
  requestAnimationFrame(autoResize);
  setTimeout(autoResize, 30);
}

function refreshSendState() {
  const streaming = isStreaming();
  els.send.hidden = streaming;
  els.stop.hidden = !streaming;
}

export function refreshFooter() {
  const s = store.get();
  const name = modelDisplayName(s.model);
  els.hint.textContent = `مدل: ${name}`;
  const ctx = modelContextLength(s.model);
  if (ctx) {
    const settings = s.settings || getSettings();
    els.ctx.textContent = `ظرفیت: ${faInt(ctx)} · حداکثر خروجی: ${faInt(settings.max_tokens)}`;
  } else {
    els.ctx.textContent = "ظرفیت: نامشخص (Auto/Free)";
  }
}

export function focusComposer(text = "") {
  if (text) {
    els.input.value = text;
    autoResize();
    updateCount();
  }
  els.input.focus();
}
