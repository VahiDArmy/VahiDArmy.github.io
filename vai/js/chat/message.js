// ============================================================================
// message.js — renders one message row (bubble, reasoning, error, actions)
// ============================================================================

import { renderMarkdownLazy } from "../markdown.js";
import { escapeHtml, formatTime, faInt, fmtTokens, fa } from "../utils.js";
import { ROLES } from "../config.js";
import { errorHeadline } from "./errors.js";

const ICONS = {
  copy: `<svg width="12" height="12" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  edit: `<svg width="12" height="12" viewBox="0 0 24 24"><path d="M4 20h4L20 8l-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  regen: `<svg width="12" height="12" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  del: `<svg width="12" height="12" viewBox="0 0 24 24"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  payload: `<svg width="12" height="12" viewBox="0 0 24 24"><path d="m9 7-5 5 5 5M15 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chev: `<svg width="12" height="12" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  alert: `<svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 3.5 21 20H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4M12 16.5v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  user: `<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.6 20c.9-3.6 3.9-5.6 7.4-5.6s6.5 2 7.4 5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  bot: `<svg width="14" height="14" viewBox="0 0 24 24"><rect x="4" y="6.5" width="16" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9.5" cy="12.5" r="1.3" fill="currentColor"/><circle cx="14.5" cy="12.5" r="1.3" fill="currentColor"/><path d="M12 3v3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  sys: `<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.8v2M12 19.2v2M21.2 12h-2M4.8 12h-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
};

function nl2br(s) {
  return escapeHtml(s).replace(/\n/g, "<br>");
}

function tokensOf(m) {
  const u = m.usage || {};
  return u.total_tokens || u.completion_tokens || u.prompt_tokens || 0;
}

function renderErrorBlock(err) {
  const e = err || {};
  const detailJson = e.detail ? JSON.stringify(e.detail, null, 2) : "";
  const raw = e.rawText || "";
  const parts = [];
  parts.push(`<div class="err">`);
  parts.push(
    `<div class="err__head">${ICONS.alert}<span>خطای ارائه‌دهنده</span>${
      e.httpStatus ? `<span class="err__code">${escapeHtml(String(e.httpStatus))}</span>` : ""
    }</div>`
  );
  parts.push(`<div class="err__body">`);
  parts.push(`<div style="font-weight:600;margin-bottom:4px;">${escapeHtml(e.message || "خطای نامشخص")}</div>`);
  if (e.provider) {
    parts.push(
      `<div style="font-size:11px;color:var(--text-3)">ارائه‌دهنده: <span class="mono">${escapeHtml(
        e.provider
      )}</span></div>`
    );
  }
  if (detailJson) {
    parts.push(`<details class="err__detail" open><summary>${ICONS.chev} پاسخ کامل خطا (دست‌نخورده)</summary><pre class="err__pre">${escapeHtml(
      detailJson
    )}</pre></details>`);
  }
  if (raw && raw !== detailJson) {
    parts.push(`<details class="err__detail"><summary>${ICONS.chev} متن خام پاسخ</summary><pre class="err__pre">${escapeHtml(
      raw
    )}</pre></details>`);
  }
  parts.push(`</div></div>`);
  return parts.join("");
}

function avatarFor(role, isError) {
  if (isError) return { cls: "msg__avatar--error", ico: ICONS.alert };
  if (role === "user") return { cls: "msg__avatar--user", ico: ICONS.user };
  if (role === "system") return { cls: "msg__avatar--system", ico: ICONS.sys };
  return { cls: "msg__avatar--assistant", ico: ICONS.bot };
}

export function renderMessage(msg) {
  const isError = msg.status === "error";
  const role = msg.role || "assistant";
  const av = avatarFor(role, isError && role === "assistant");

  const row = document.createElement("article");
  row.className = `msg msg--${role}${isError ? " msg--error" : ""}${
    msg.status === "streaming" ? " is-streaming" : ""
  }`;
  row.dataset.id = msg.id;
  row.dataset.role = role;

  const rail = document.createElement("div");
  rail.className = "msg__rail";
  rail.innerHTML = `<div class="msg__avatar ${av.cls}">${av.ico}</div>`;

  const main = document.createElement("div");
  main.className = "msg__main";

  const badges = [];
  if (msg.edited) badges.push(`<span class="badge">ویرایش‌شده</span>`);
  if (msg.resolved_model && msg.resolved_model !== msg.requested_model) {
    badges.push(
      `<span class="badge badge--accent" title="مدل واقعی انتخاب‌شده توسط OpenRouter">${escapeHtml(
        msg.resolved_model
      )}</span>`
    );
  }
  if (msg.provider) badges.push(`<span class="badge badge--info">${escapeHtml(msg.provider)}</span>`);

  const head = document.createElement("div");
  head.className = "msg__head";
  head.innerHTML = `
    <span class="msg__name">${escapeHtml(ROLES[role] || role)}</span>
    <span class="msg__badges">${badges.join("")}</span>
    <span class="msg__time">${formatTime(msg.created_at || Date.now())}</span>
  `;

  const body = document.createElement("div");
  body.className = "msg__body";

  if (msg.reasoning) {
    const r = document.createElement("div");
    r.className = "reasoning";
    r.innerHTML = `
      <div class="reasoning__head">${ICONS.chev}<span class="reasoning__label">استدلال مدل</span>
        <span class="reasoning__time">${faInt(msg.reasoning.length)} کاراکتر</span></div>
      <div class="reasoning__body"></div>`;
    r.querySelector(".reasoning__body").textContent = msg.reasoning;
    r.querySelector(".reasoning__head").addEventListener("click", () =>
      r.classList.toggle("is-open")
    );
    body.appendChild(r);
  }

  const md = document.createElement("div");
  md.className = "md";
  if (isError) {
    md.innerHTML = renderErrorBlock(msg.error);
  } else if (!msg.content && msg.status === "streaming") {
    md.innerHTML = `<span class="dots"><i></i><i></i><i></i></span>`;
  } else if (role === "user") {
    md.innerHTML = nl2br(msg.content || "");
  } else {
    md.innerHTML = renderMarkdownLazy(msg.content || "");
  }
  body.appendChild(md);

  if (msg.status === "streaming" && msg.content) {
    const st = document.createElement("div");
    st.className = "msg__status";
    st.innerHTML = `<span class="spinner"></span><span>در حال دریافت از مدل…</span>`;
    body.appendChild(st);
  }

  if (msg.status === "complete" && msg.usage) {
    const t = tokensOf(msg);
    const u = document.createElement("div");
    u.className = "usage-row";
    const bits = [];
    if (msg.usage.prompt_tokens != null)
      bits.push(`<span>ورودی <b>${fmtTokens(msg.usage.prompt_tokens)}</b></span>`);
    if (msg.usage.completion_tokens != null)
      bits.push(`<span>خروجی <b>${fmtTokens(msg.usage.completion_tokens)}</b></span>`);
    if (t) bits.push(`<span>جمع <b>${fmtTokens(t)}</b></span>`);
    if (msg.usage.total_cost != null)
      bits.push(`<span>هزینه <b>${fa(Number(msg.usage.total_cost).toFixed(6))}$</b></span>`);
    u.innerHTML = bits.join("");
    body.appendChild(u);
  }

  const actions = document.createElement("div");
  actions.className = "msg__actions";

  const mkAction = (act, label, ico, cls = "") => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `msg__action ${cls}`;
    b.dataset.action = act;
    b.dataset.id = msg.id;
    b.innerHTML = `${ico}<span>${label}</span>`;
    return b;
  };

  if (!isError || msg.content) actions.appendChild(mkAction("copy", "کپی", ICONS.copy));
  if (role === "user") actions.appendChild(mkAction("edit", "ویرایش", ICONS.edit));
  if (role === "assistant")
    actions.appendChild(mkAction("regen", "بازتولید", ICONS.regen));
  if (role === "assistant" && (msg.request_body || msg.status === "error"))
    actions.appendChild(mkAction("payload", "Payload", ICONS.payload));
  actions.appendChild(mkAction("delete", "حذف", ICONS.del, "msg__action--danger"));

  main.appendChild(head);
  main.appendChild(body);
  main.appendChild(actions);
  row.appendChild(rail);
  row.appendChild(main);
  return row;
}

/** Patch a mounted message in place (used during streaming). */
export function patchMessage(row, msg) {
  if (!row) return;
  const fresh = renderMessage(msg);
  row.replaceWith(fresh);
  return fresh;
}
