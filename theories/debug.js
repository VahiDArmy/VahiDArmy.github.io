/*!
 * debug.js — Floating error panel for the نظریه app.
 *
 * Loaded FIRST in <body> so it can catch every subsequent error
 * (including module-load, CDN, syntax, runtime, and unhandled rejections).
 *
 * To disable: delete this file and the marked <script> tag in index.html.
 * It does not touch app code, UI, styles, storage keys, or global state
 * beyond a read-only `window.__debug` helper and a `console.error` tap
 * that forwards to the original function unchanged.
 */
(function () {
  "use strict";

  var MAX_ERRORS = 50;
  var WATCHDOG_MS = 3500;
  var STORAGE_KEY = "__nazariyeh_debug_errors";

  var errors = [];
  var host = null;
  var shadow = null;
  var expanded = false;
  var lastSeen = {};
  var watchdogDone = false;

  /* ---------- restore previous errors across reloads ---------- */
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      var parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) errors = parsed.slice(0, MAX_ERRORS);
    }
  } catch (e) {}

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(errors.slice(0, MAX_ERRORS)));
    } catch (e) {}
  }

  function stringifyError(err) {
    if (!err) return "";
    if (typeof err === "string") return err;
    if (err.stack) return String(err.stack);
    try {
      return JSON.stringify(err, null, 2);
    } catch (e) {
      return String(err);
    }
  }

  function truncate(str, n) {
    str = String(str == null ? "" : str);
    return str.length > n ? str.slice(0, n) + "…" : str;
  }

  function addError(type, message, detail) {
    message = truncate(message, 1000);
    detail = truncate(detail, 4000);

    var key = type + "|" + message;
    var now = Date.now();
    if (lastSeen[key] && now - lastSeen[key] < 700) return;
    lastSeen[key] = now;

    var entry = {
      type: type,
      message: message || "(no message)",
      detail: detail || "",
      time: now,
      url: location.href,
    };

    errors.unshift(entry);
    if (errors.length > MAX_ERRORS) errors.length = MAX_ERRORS;
    persist();

    var critical =
      type === "uncaught" ||
      type === "script-load" ||
      type === "style-load" ||
      type === "resource-load" ||
      type === "watchdog";

    if (critical && !expanded) expanded = true;
    render();
  }

  /* ---------- global error handlers (capture phase) ---------- */
  window.addEventListener(
    "error",
    function (event) {
      /* resource load failure (capture phase) */
      if (event.target && event.target !== window && event.target.tagName) {
        var tag = String(event.target.tagName).toLowerCase();
        if (tag === "script") {
          addError(
            "script-load",
            "Failed to load script: " + (event.target.src || "(inline)"),
            "The browser could not fetch or execute this script.\n" +
              "Common causes:\n" +
              "  • 404 — wrong path (check Network tab)\n" +
              "  • server returned HTML instead of JS (MIME mismatch)\n" +
              "  • CDN blocked by extension / firewall"
          );
          return;
        }
        if (tag === "link") {
          addError(
            "style-load",
            "Failed to load stylesheet: " + (event.target.href || "(inline)"),
            ""
          );
          return;
        }
        if (tag === "img" || tag === "video" || tag === "audio" || tag === "source") {
          return;
        }
        addError(
          "resource-load",
          "Failed to load <" + tag + ">: " + (event.target.src || event.target.href || ""),
          ""
        );
        return;
      }

      /* runtime error */
      var msg = event.message || "Uncaught error";
      var detail = "";
      if (event.error) {
        detail = stringifyError(event.error);
        if (event.error.name && msg.indexOf(event.error.name) === -1) {
          msg = event.error.name + ": " + msg;
        }
      } else if (event.filename) {
        detail = "at " + event.filename + ":" + event.lineno + ":" + event.colno;
      }
      addError("uncaught", msg, detail);
    },
    true
  );

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    var msg = "Unhandled promise rejection";
    var detail = "";
    if (reason) {
      if (reason.message) {
        msg = (reason.name || "Error") + ": " + reason.message;
        detail = reason.stack || "";
      } else {
        msg = truncate(String(reason), 1000);
      }
    }
    addError("promise", msg, detail);
  });

  /* ---------- console.error tap (forwards to original) ---------- */
  var origError = console.error;
  console.error = function () {
    try {
      var args = Array.prototype.slice.call(arguments);
      var msg = args
        .map(function (a) {
          if (a instanceof Error) return stringifyError(a);
          if (typeof a === "object") {
            try {
              return JSON.stringify(a);
            } catch (e) {
              return String(a);
            }
          }
          return String(a);
        })
        .join(" ");
      addError("console.error", msg, "");
    } catch (e) {}
    return origError.apply(console, arguments);
  };

  /* ---------- watchdog: did the app actually boot? ---------- */
  function checkBoot() {
    if (watchdogDone) return;
    var boot = document.querySelector("#app .boot-screen");
    if (!boot) return;
    watchdogDone = true;
    if (errors.length > 0) {
      addError(
        "watchdog",
        "Boot screen still visible after " + Math.round(performance.now()) + "ms (" + errors.length + " prior error" + (errors.length === 1 ? "" : "s") + ").",
        "Likely cause: one of the modules in the boot chain threw or failed to import. Scroll up for the first error."
      );
    } else {
      addError(
        "watchdog",
        "Boot screen still visible after " + Math.round(performance.now()) + "ms but no JS errors were caught.",
        "Possible causes:\n" +
          "  • a script failed to load and the error event was suppressed\n" +
          "  • the CDN for Supabase was blocked (network)\n" +
          "  • the auth check is hanging on the network\n" +
          "  • open DevTools → Network tab and hard-refresh (Ctrl/⌘+Shift+R)"
      );
    }
  }

  /* ---------- UI ---------- */
  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  function baseStyles() {
    return [
      ":host{all:initial}",
      "*{box-sizing:border-box;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
      ".badge{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.35);user-select:none;border:none;color:#fff;transition:transform .15s,filter .15s}",
      ".badge:hover{transform:translateY(-1px);filter:brightness(1.08)}",
      ".badge:active{transform:translateY(0)}",
      ".badge.has-errors{background:#dc2626}",
      ".badge.no-errors{background:#16a34a}",
      ".badge .count{background:rgba(255,255,255,.25);padding:1px 7px;border-radius:10px;font-size:11px}",
      ".badge .dot{width:8px;height:8px;border-radius:50%;background:#fff;animation:__dbg_pulse 1.5s infinite}",
      "@keyframes __dbg_pulse{0%,100%{opacity:1}50%{opacity:.35}}",
      ".panel{position:fixed;bottom:16px;left:16px;width:min(720px,calc(100vw - 32px));max-height:calc(100vh - 32px);background:#0b0b14;color:#e5e5f0;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden;border:1px solid #2a2a3a}",
      ".head{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#15151f;border-bottom:1px solid #2a2a3a;font-size:13px;font-weight:600;color:#fff}",
      ".head .title{flex:1}",
      ".head button{background:transparent;border:1px solid #3a3a4a;color:#e5e5f0;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit}",
      ".head button:hover{background:#2a2a3a}",
      ".head button.close{border-color:#7f1d1d;color:#fca5a5}",
      ".head button.close:hover{background:#7f1d1d;color:#fff}",
      ".list{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px}",
      ".empty{padding:40px 16px;text-align:center;color:#6b6b80;font-size:13px}",
      ".item{background:#15151f;border:1px solid #2a2a3a;border-radius:8px;padding:10px 12px;border-left:3px solid #dc2626}",
      ".item.type-script-load,.item.type-style-load,.item.type-resource-load{border-left-color:#f59e0b}",
      ".item.type-watchdog{border-left-color:#8b5cf6}",
      ".item.type-console-error{border-left-color:#f97316}",
      ".item.type-promise{border-left-color:#ec4899}",
      ".item-head{display:flex;align-items:center;gap:8px;margin-bottom:4px}",
      ".item-type{font-size:10px;text-transform:uppercase;color:#a1a1b0;background:#242432;padding:2px 6px;border-radius:4px;letter-spacing:.05em}",
      ".item-time{font-size:10px;color:#6b6b80;margin-left:auto}",
      ".item-msg{font-size:13px;color:#fff;line-height:1.5;word-break:break-word}",
      ".item-detail{font-size:11px;color:#a1a1b0;margin-top:6px;padding:8px;background:#07070d;border-radius:4px;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;line-height:1.5}",
      ".item-url{font-size:10px;color:#6b6b80;margin-top:4px;word-break:break-all}",
    ].join("");
  }

  function ensureHost() {
    if (host) return host;
    if (!document.body) return null;
    host = document.createElement("div");
    host.id = "__debug_host__";
    host.style.cssText =
      "all:initial;position:fixed;bottom:16px;left:16px;z-index:2147483647;" +
      "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;";
    document.body.appendChild(host);
    shadow = host.attachShadow({ mode: "open" });
    render();
    return host;
  }

  function panelHTML() {
    var count = errors.length;
    var listHTML = count
      ? errors
          .map(function (e) {
            var t = new Date(e.time);
            var hh = String(t.getHours()).padStart(2, "0");
            var mm = String(t.getMinutes()).padStart(2, "0");
            var ss = String(t.getSeconds()).padStart(2, "0");
            var typeClass = String(e.type).replace(/[^a-z0-9]/gi, "-");
            return (
              '<div class="item type-' +
              escapeHtml(typeClass) +
              '">' +
              '<div class="item-head">' +
              '<span class="item-type">' +
              escapeHtml(e.type) +
              "</span>" +
              '<span class="item-time">' +
              hh +
              ":" +
              mm +
              ":" +
              ss +
              "</span>" +
              "</div>" +
              '<div class="item-msg">' +
              escapeHtml(e.message) +
              "</div>" +
              (e.detail
                ? '<div class="item-detail">' + escapeHtml(e.detail) + "</div>"
                : "") +
              (e.url
                ? '<div class="item-url">' + escapeHtml(e.url) + "</div>"
                : "") +
              "</div>"
            );
          })
          .join("")
      : '<div class="empty">✓ No errors captured so far.</div>';

    return (
      '<div class="panel">' +
      '<div class="head">' +
      '<span class="title">Debug Console · ' +
      count +
      (count === 1 ? " error" : " errors") +
      "</span>" +
      '<button type="button" data-action="copy">Copy</button>' +
      '<button type="button" data-action="clear">Clear</button>' +
      '<button type="button" class="close" data-action="close">✕</button>' +
      "</div>" +
      '<div class="list">' +
      listHTML +
      "</div>" +
      "</div>"
    );
  }

  function copyAll(btn) {
    var text = errors
      .map(function (e) {
        return (
          "[" +
          e.type +
          "] " +
          e.message +
          (e.detail ? "\n" + e.detail : "") +
          (e.url ? "\nURL: " + e.url : "") +
          "\nTime: " +
          new Date(e.time).toISOString()
        );
      })
      .join("\n\n---\n\n");

    var done = function () {
      btn.textContent = "Copied!";
      setTimeout(function () {
        btn.textContent = "Copy";
      }, 1400);
    };

    var fallbackCopy = function () {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch (e) {}
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  function render() {
    if (!shadow) return;
    var count = errors.length;

    if (!expanded) {
      shadow.innerHTML =
        "<style>" +
        baseStyles() +
        "</style>" +
        '<button type="button" class="badge ' +
        (count > 0 ? "has-errors" : "no-errors") +
        '" data-badge title="نظریه Debug Console — click to expand">' +
        (count > 0 ? '<span class="dot"></span>' : "✓") +
        "<span>Debug</span>" +
        '<span class="count">' +
        count +
        "</span>" +
        "</button>";
      var badge = shadow.querySelector("[data-badge]");
      if (badge) {
        badge.addEventListener("click", function () {
          expanded = true;
          render();
        });
      }
      return;
    }

    shadow.innerHTML = "<style>" + baseStyles() + "</style>" + panelHTML();

    shadow.querySelectorAll("[data-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var action = btn.getAttribute("data-action");
        if (action === "close") {
          expanded = false;
          render();
        } else if (action === "clear") {
          errors = [];
          lastSeen = {};
          persist();
          render();
        } else if (action === "copy") {
          copyAll(btn);
        }
      });
    });
  }

  /* ---------- boot ---------- */
  function start() {
    ensureHost();
    setTimeout(checkBoot, WATCHDOG_MS);
    setTimeout(checkBoot, WATCHDOG_MS + 2000);
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
    var poll = setInterval(function () {
      if (document.body) {
        clearInterval(poll);
        start();
      }
    }, 50);
  }

  /* ---------- public API ---------- */
  window.__debug = {
    getErrors: function () {
      return errors.slice();
    },
    clear: function () {
      errors = [];
      lastSeen = {};
      persist();
      render();
    },
    show: function () {
      expanded = true;
      ensureHost();
      render();
    },
    hide: function () {
      expanded = false;
      render();
    },
    add: addError,
  };
})();
