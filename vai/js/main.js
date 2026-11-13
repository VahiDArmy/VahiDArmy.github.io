// ============================================================================
// main.js — bootstrap: wires modules, loads state, handles global actions
// ============================================================================

import "./dev/watchdog.js";
import { store, api, getTheme, getSettings, localDB } from "./store.js";
import { loadModels } from "./models.js";
import { initComposer, focusComposer, refreshFooter } from "./composer.js";
import { initSidebar, renderSidebar, startNewChat, openConversation } from "./sidebar.js";
import { initTopbar } from "./topbar.js";
import { initInspector } from "./panels/inspector.js";
import { openSettingsModal } from "./panels/settings.js";
import { openModelsModal } from "./panels/models.js";
import { openPayloadModal } from "./ui/payload.js";
import { initRender, renderThread, patchStreamingMessage, showEmpty, hideEmpty, scrollThreadToMessage } from "./chat/render.js";
import {
  sendMessage,
  regenerateFrom,
  deleteMessageById,
  loadMessagesFor,
  setEditing,
  isStreaming,
} from "./chat/session.js";
import { emitter, copyText, debounce } from "./utils.js";
import { toast } from "./ui/toast.js";
import { confirmDialog } from "./ui/modal.js";
import { sb } from "./supabase.js";

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
async function boot() {
  document.documentElement.setAttribute("data-theme", getTheme());

  initRender();
  initTopbar();
  initSidebar();
  initComposer();
  initInspector();
  wireGlobalButtons();
  wireStoreEvents();
  wireMessageActions();
  wireKeyboard();

  showEmpty((prompt) => focusComposer(prompt));

  // Backend status
  setBackendStatus("busy", "در حال اتصال…");
  sb.ping()
    .then((r) => {
      if (r.ok) setBackendStatus("ok", "متصل به Supabase");
      else setBackendStatus("warn", `Supabase: HTTP ${r.status}`);
    })
    .catch(() => setBackendStatus("warn", "حالت محلی (بدون Supabase)"));

  // Models
  loadModels().catch((e) => toast.err(String(e.message || e), "خطا در دریافت مدل‌ها"));

  // Conversations
  store.set({ convsLoading: true });
  try {
    const convs = await api.listConversations();
    store.set({ conversations: convs, convsLoading: false }, "convs:change");
    const lastId = store.get().activeConvId;
    const target = convs.find((c) => c.id === lastId) || convs[0];
    if (target) {
      store.setActiveConv(target.id);
      if (target.model) store.setModel(target.model);
      await loadMessagesFor(target.id);
    } else {
      hideEmpty();
      showEmpty((p) => focusComposer(p));
      renderThread([]);
    }
  } catch (e) {
    store.set({ convsLoading: false, convsError: String(e.message || e) }, "convs:change");
    toast.err(String(e.message || e), "خطا در بارگذاری گفتگوها");
  }

  refreshFooter();
}

// ---------------------------------------------------------------------------
// backend status pill
// ---------------------------------------------------------------------------
function setBackendStatus(kind, label) {
  const dot = document.getElementById("connDot");
  const text = document.getElementById("connLabel");
  if (!dot || !text) return;
  dot.className = "dot";
  if (kind === "ok") dot.classList.add("is-ok");
  else if (kind === "warn") dot.classList.add("is-warn");
  else if (kind === "err") dot.classList.add("is-err");
  else dot.classList.add("is-busy");
  text.textContent = label;
}

// ---------------------------------------------------------------------------
// buttons
// ---------------------------------------------------------------------------
function wireGlobalButtons() {
  document.getElementById("modelsBtn")?.addEventListener("click", openModelsModal);
  document.getElementById("settingsBtn")?.addEventListener("click", openSettingsModal);
  document.getElementById("brandBtn")?.addEventListener("click", () => {
    startNewChat();
  });
}

// ---------------------------------------------------------------------------
// store events → view
// ---------------------------------------------------------------------------
function wireStoreEvents() {
  store.on("thread:reload", () => {
    const msgs = store.get().messages || [];
    renderThread(msgs);
    if (msgs.length) hideEmpty();
    else showEmpty((p) => focusComposer(p));
    refreshFooter();
    const active = store.get().conversations.find((c) => c.id === store.get().activeConvId);
    if (active?.title) document.title = `${active.title} · معراج`;
  });

  store.on("convs:change", () => renderSidebar());
  store.on("conv:active", () => renderSidebar());

  emitter.on("message:patch", (msg) => {
    patchStreamingMessage(msg);
  });
}

// ---------------------------------------------------------------------------
// message action delegation
// ---------------------------------------------------------------------------
function wireMessageActions() {
  const thread = document.getElementById("thread");
  if (!thread) return;

  thread.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (btn) {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const msg = (store.get().messages || []).find((m) => m.id === id);
      if (!msg) return;
      if (action === "copy") {
        const ok = await copyText(msg.content || "");
        btn.classList.toggle("is-done", ok);
        if (ok) toast.ok("کپی شد");
        else toast.err("کپی ناموفق بود");
        return;
      }
      if (action === "edit") {
        setEditing(id);
        scrollThreadToMessage(id);
        return;
      }
      if (action === "regen") {
        await regenerateFrom(id);
        return;
      }
      if (action === "delete") {
        const ok = await confirmDialog({
          title: "حذف پیام",
          message: "این پیام حذف شود؟ این عمل قابل بازگشت نیست.",
          okLabel: "حذف",
          danger: true,
        });
        if (ok) await deleteMessageById(id);
        return;
      }
      if (action === "payload") {
        openPayloadModal({ message: msg });
        return;
      }
      return;
    }

    // copy-code inside markdown blocks
    const copyCode = e.target.closest('[data-act="copy-code"]');
    if (copyCode) {
      const block = copyCode.closest(".codeblock");
      const code = block?.querySelector("pre code");
      if (code) {
        const raw = code.getAttribute("data-raw") ?? code.textContent;
        const ok = await copyText(raw);
        copyCode.classList.toggle("is-done", ok);
        const label = copyCode.querySelector("span");
        if (label) label.textContent = ok ? "کپی شد" : "کپی";
        setTimeout(() => {
          copyCode.classList.remove("is-done");
          if (label) label.textContent = "کپی";
        }, 1400);
      }
    }
  });

  // Right-click / keyboard shortcuts on messages could be added later
}

// ---------------------------------------------------------------------------
// keyboard shortcuts
// ---------------------------------------------------------------------------
function wireKeyboard() {
  window.addEventListener("keydown", (e) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === "k") {
      e.preventDefault();
      startNewChat();
    } else if (meta && e.key.toLowerCase() === "b") {
      e.preventDefault();
      const el = document.getElementById("sidebar");
      el?.classList.toggle("is-open");
      const scrim = document.getElementById("scrim");
      if (scrim) scrim.hidden = !el?.classList.contains("is-open");
    } else if (e.key === "Escape") {
      const scrim = document.getElementById("scrim");
      if (scrim && !scrim.hidden) {
        document.getElementById("sidebar")?.classList.remove("is-open");
        scrim.hidden = true;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// go
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", boot);
