// ============================================================================
// payload.js — the "exact bytes sent to the API" inspector.
// The body tab renders the request body VERBATIM (textContent, never HTML),
// so what you copy here is byte-for-byte what was handed to fetch().
// ============================================================================

import { openModal } from "./modal.js";
import { toast } from "./toast.js";
import { escapeHtml, copyText, byteLength, fmtBytes, fa } from "../utils.js";
import { OPENROUTER_CHAT } from "../config.js";

function lineNumbered(text) {
  const lines = String(text ?? "").split("\n");
  const frag = document.createDocumentFragment();
  lines.forEach((ln, i) => {
    const row = document.createElement("span");
    row.className = "l";
    row.dataset.n = String(i + 1);
    row.textContent = ln.length ? ln : " ";
    frag.appendChild(row);
    if (i < lines.length - 1) frag.appendChild(document.createTextNode("\n"));
  });
  return frag;
}

function preText(text, { wrap = false, numbered = false } = {}) {
  const pre = document.createElement("pre");
  pre.className = "payload__pre";
  if (wrap) pre.classList.add("payload__pre--wrap");
  if (numbered) {
    pre.classList.add("payload__pre--numbered");
    pre.appendChild(lineNumbered(text));
  } else {
    pre.textContent = String(text ?? "");
  }
  return pre;
}

function toolbar({ text, filename, wrap, onToggleWrap, extra }) {
  const bar = document.createElement("div");
  bar.className = "payload__toolbar";

  const size = document.createElement("span");
  size.textContent = `طول: ${fa(String(text).length)} کاراکتر · ${fmtBytes(byteLength(text))}`;
  bar.appendChild(size);

  const grow = document.createElement("span");
  grow.className = "grow";
  bar.appendChild(grow);

  if (extra) bar.appendChild(extra);

  if (onToggleWrap) {
    const wrapBtn = document.createElement("button");
    wrapBtn.type = "button";
    wrapBtn.className = "copy-btn";
    wrapBtn.textContent = "شکستن خطوط";
    wrapBtn.addEventListener("click", () => {
      wrap = !wrap;
      wrapBtn.classList.toggle("is-done", wrap);
      onToggleWrap(wrap);
    });
    bar.appendChild(wrapBtn);
  }

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "copy-btn";
  copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>کپی دقیق</span>`;
  copyBtn.addEventListener("click", async () => {
    const ok = await copyText(String(text));
    copyBtn.classList.toggle("is-done", ok);
    if (ok) toast.ok("عیناً کپی شد");
    else toast.err("کپی ناموفق بود");
    setTimeout(() => copyBtn.classList.remove("is-done"), 1200);
  });
  bar.appendChild(copyBtn);

  if (filename) {
    const dl = document.createElement("button");
    dl.type = "button";
    dl.className = "copy-btn";
    dl.textContent = "دانلود";
    dl.addEventListener("click", () => {
      const blob = new Blob([String(text)], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    });
    bar.appendChild(dl);
  }

  return bar;
}

/**
 * openPayloadModal({
 *   message?: object,          // assistant message whose request_body we show
 *   body?: string,             // override exact body string
 *   payload?: object,          // parsed payload (for the messages tab)
 *   headers?: object,
 *   rawResponse?: string,
 *   error?: object,
 *   preview?: boolean
 * })
 */
export function openPayloadModal(opts = {}) {
  const msg = opts.message || null;
  const bodyString = opts.body != null ? opts.body : msg?.request_body ?? "";
  const payloadObj = opts.payload != null ? opts.payload : msg?.request_payload ?? null;
  const headers = opts.headers != null ? opts.headers : msg?.request_headers ?? {};
  const rawResponse = opts.rawResponse != null ? opts.rawResponse : msg?.response_raw ?? "";
  const error = opts.error != null ? opts.error : msg?.error ?? null;

  const holder = document.createElement("div");
  holder.style.cssText = "display:flex;flex-direction:column;min-height:0;flex:1 1 auto;";

  const tabsBar = document.createElement("div");
  tabsBar.className = "payload__tabs";

  const bodyPane = document.createElement("div");
  bodyPane.className = "payload__body";

  let wrapState = false;

  const tabs = [
    {
      id: "body",
      label: "بدنهٔ دقیق درخواست",
      badge: opts.preview ? "پیش‌نمایش" : "ارسال‌شده",
      render: () => {
        bodyPane.innerHTML = "";
        const text = bodyString || "(خالی)";
        bodyPane.appendChild(
          toolbar({
            text,
            filename: "request-body.json",
            wrap: wrapState,
            onToggleWrap: (v) => {
              wrapState = v;
              bodyPane.innerHTML = "";
              bodyPane.appendChild(
                toolbar({
                  text,
                  filename: "request-body.json",
                  wrap: wrapState,
                  onToggleWrap: () => {
                    wrapState = !wrapState;
                    renderActive("body");
                  },
                })
              );
              bodyPane.appendChild(preText(text, { wrap: wrapState, numbered: !wrapState }));
            },
          })
        );
        bodyPane.appendChild(preText(text, { wrap: wrapState, numbered: !wrapState }));
      },
    },
    {
      id: "http",
      label: "درخواست HTTP",
      render: () => {
        bodyPane.innerHTML = "";
        const httpText =
          `POST ${OPENROUTER_CHAT} HTTP/1.1\n` +
          Object.entries(headers || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n") +
          `\n\n` +
          (bodyString || "");
        bodyPane.appendChild(toolbar({ text: httpText, filename: "request.http" }));
        bodyPane.appendChild(preText(httpText, { wrap: true }));
      },
    },
    {
      id: "messages",
      label: "پیام‌های ساختاریافته",
      render: () => {
        bodyPane.innerHTML = "";
        const list = payloadObj?.messages || [];
        const pretty = JSON.stringify(list, null, 2);
        bodyPane.appendChild(
          toolbar({ text: pretty, filename: "messages.json", extra: null })
        );
        bodyPane.appendChild(preText(pretty, { wrap: false }));
      },
    },
    {
      id: "response",
      label: "پاسخ خام",
      badge: rawResponse ? "موجود" : "—",
      render: () => {
        bodyPane.innerHTML = "";
        const text = rawResponse || "(پاسخی ذخیره نشده است)";
        bodyPane.appendChild(
          toolbar({ text, filename: "response.txt" })
        );
        bodyPane.appendChild(preText(text, { wrap: true }));
      },
    },
    {
      id: "error",
      label: "خطا",
      badge: error ? "خطا" : "—",
      render: () => {
        bodyPane.innerHTML = "";
        if (!error) {
          const p = document.createElement("div");
          p.className = "empty-note";
          p.textContent = "برای این درخواست خطایی ثبت نشده است.";
          bodyPane.appendChild(p);
          return;
        }
        const text = JSON.stringify(error, null, 2);
        bodyPane.appendChild(toolbar({ text, filename: "error.json" }));
        bodyPane.appendChild(preText(text, { wrap: false }));
      },
    },
  ];

  let active = "body";
  function renderActive(id) {
    active = id;
    for (const b of tabsBar.children) b.classList.toggle("is-active", b.dataset.tab === id);
    const t = tabs.find((x) => x.id === id);
    if (t) t.render();
  }

  for (const t of tabs) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "payload__tab";
    b.dataset.tab = t.id;
    b.innerHTML = `${escapeHtml(t.label)}${
      t.badge ? ` <span class="badge">${escapeHtml(t.badge)}</span>` : ""
    }`;
    b.addEventListener("click", () => renderActive(t.id));
    tabsBar.appendChild(b);
  }

  holder.appendChild(tabsBar);
  holder.appendChild(bodyPane);

  const sub = opts.preview
    ? "این همان متنی است که با ارسال، عیناً به OpenRouter فرستاده می‌شود."
    : "این همان متنی است که عیناً به OpenRouter فرستاده شد.";

  const m = openModal({
    title: "Payload دقیق",
    subtitle: sub,
    className: "modal--full payload",
    body: holder,
    footer: "",
  });

  // Mount into the body area directly (openModal gives us .modal__body)
  m.modal.querySelector(".modal__body").style.padding = "0";
  m.modal.querySelector(".modal__body").style.display = "flex";
  m.modal.querySelector(".modal__body").style.flexDirection = "column";
  m.modal.querySelector(".modal__body").style.minHeight = "0";

  renderActive("body");
  return m;
}
