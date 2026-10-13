/**
 * Subject Picker — modal overlay showing all top-level subjects.
 *
 * Used by the topbar's subject button. Selecting a subject navigates to
 * that route. The current subject is highlighted.
 */

import { createElement, delegate } from "../utils/dom.js";
import { icon } from "./icons.js";
import { SUBJECTS, getSubject } from "../config/constants.js";
import { navigate } from "../router.js";

const ROOT_ID = "subject-picker-root";
let root = null;
let currentInstance = null;

function ensureRoot() {
  if (root && document.body.contains(root)) return root;
  root = document.getElementById(ROOT_ID);
  if (!root) {
    root = createElement("div", { id: ROOT_ID, class: "subject-picker", "aria-hidden": "true" });
    document.body.appendChild(root);
  }
  return root;
}

export function openSubjectPicker({ current }) {
  const r = ensureRoot();
  r.innerHTML = "";
  r.classList.add("is-open");
  r.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");

  const backdrop = createElement("div", { class: "subject-picker__backdrop" });

  const panel = createElement("div", { class: "subject-picker__panel", role: "dialog", "aria-label": "انتخاب بخش" });
  panel.innerHTML = `
    <div class="subject-picker__head">
      <div class="subject-picker__title">بخش مورد نظر را انتخاب کنید</div>
      <button class="subject-picker__close" type="button" aria-label="بستن">${icon("close", { size: 18 })}</button>
    </div>
    <div class="subject-grid">
      ${SUBJECTS.map((s) => `
        <button
          class="subject-tile ${s.id === current ? "is-active" : ""}"
          style="background:${s.gradient}"
          data-subject="${s.id}"
          type="button"
          aria-current="${s.id === current ? "page" : "false"}"
        >
          <div class="subject-tile__icon">${icon(s.icon, { size: 24 })}</div>
          <div class="subject-tile__label">${s.label}</div>
        </button>
      `).join("")}
    </div>
  `;

  r.appendChild(backdrop);
  r.appendChild(panel);

  function close() {
    r.classList.remove("is-open");
    r.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
    document.removeEventListener("keydown", onKey, true);
    setTimeout(() => { r.innerHTML = ""; }, 200);
    currentInstance = null;
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  }

  backdrop.addEventListener("click", close);
  panel.querySelector(".subject-picker__close").addEventListener("click", close);

  delegate(panel, "click", "[data-subject]", (e, btn) => {
    const id = btn.dataset.subject;
    close();
    if (id !== current) navigate(id);
  });

  document.addEventListener("keydown", onKey, true);
  currentInstance = { close };
  return currentInstance;
}

export function closeSubjectPicker() {
  currentInstance?.close();
}

/* ---------------------------------------------------------------
   Subject button (topbar) — the small pill that opens the picker
   --------------------------------------------------------------- */
export function mountSubjectButton(container, { current }) {
  const subject = getSubject(current);
  container.innerHTML = `
    <button class="subject-btn" type="button" id="subject-btn" aria-haspopup="dialog" aria-expanded="false"
            style="background:${subject.gradient}" data-subject="${subject.id}">
      <span class="subject-btn__icon">${icon(subject.icon, { size: 18 })}</span>
      <span class="subject-btn__label">${subject.label}</span>
      <span class="subject-btn__chevron">${icon("chevronDown", { size: 16 })}</span>
    </button>
  `;

  const btn = container.querySelector("#subject-btn");
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    btn.setAttribute("aria-expanded", "true");
    const inst = openSubjectPicker({ current });
    // Restore aria-expanded when closed
    const originalClose = inst.close;
    inst.close = function () {
      originalClose();
      btn.setAttribute("aria-expanded", "false");
    };
  });

  return {
    update(nextSubjectId) {
      const s = getSubject(nextSubjectId);
      btn.style.background = s.gradient;
      btn.dataset.subject = s.id;
      btn.querySelector(".subject-btn__icon").innerHTML = icon(s.icon, { size: 18 });
      btn.querySelector(".subject-btn__label").textContent = s.label;
    },
  };
}