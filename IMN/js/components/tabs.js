/**
 * Tab component.
 *
 *   const tabs = tabsInit(containerEl, {
 *     defaultTab: "daily",
 *     onChange: (id) => render(id),
 *   });
 *   tabs.activate("weekly");
 *   tabs.active; // "daily"
 *
 * Markup contract:
 *   <div class="tabs" data-tabs>
 *     <div class="tabs__nav">
 *       <button class="tabs__tab" data-tab="daily">...</button>
 *       <button class="tabs__tab" data-tab="weekly">...</button>
 *     </div>
 *     <div class="tabs__panel" data-panel="daily">...</div>
 *     <div class="tabs__panel" data-panel="weekly">...</div>
 *   </div>
 */

export function tabsInit(container, opts = {}) {
  if (!container) throw new Error("tabsInit: container is required");

  const { defaultTab, onChange } = opts;
  const tabButtons = [...container.querySelectorAll("[data-tab]")];
  const panels = [...container.querySelectorAll("[data-panel]")];

  if (!tabButtons.length) return null;

  let active = null;

  function activate(id, { silent = false } = {}) {
    if (id === active) return;
    const btn = tabButtons.find((b) => b.dataset.tab === id);
    if (!btn) return;

    tabButtons.forEach((b) => {
      const on = b.dataset.tab === id;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.setAttribute("tabindex", on ? "0" : "-1");
    });
    panels.forEach((p) => {
      p.classList.toggle("is-active", p.dataset.panel === id);
    });
    active = id;
    if (!silent) onChange?.(id, btn);
  }

  tabButtons.forEach((btn) => {
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-controls", `panel-${btn.dataset.tab}`);
    btn.addEventListener("click", () => activate(btn.dataset.tab));
    btn.addEventListener("keydown", (e) => {
      const idx = tabButtons.indexOf(btn);
      if (e.key === "ArrowRight") {
        e.preventDefault();
        tabButtons[(idx - 1 + tabButtons.length) % tabButtons.length].focus();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        tabButtons[(idx + 1) % tabButtons.length].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        tabButtons[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        tabButtons[tabButtons.length - 1].focus();
      }
    });
  });

  panels.forEach((p) => {
    p.setAttribute("role", "tabpanel");
    p.id = `panel-${p.dataset.panel}`;
  });

  activate(defaultTab || tabButtons[0].dataset.tab, { silent: true });

  return {
    activate,
    get active() { return active; },
    buttons: tabButtons,
    panels,
  };
}

/** Markup helpers so consumers can build tabs without duplicating HTML. */
export function tabsMarkup({ tabs, variant = "" }) {
  const nav = tabs
    .map(
      (t) =>
        `<button class="tabs__tab${t.badge ? " tabs__tab--badge" : ""}" data-tab="${t.id}" type="button">${t.icon || ""}<span>${t.label}</span>${t.badge ? `<span class="tabs__tab__badge">${t.badge}</span>` : ""}</button>`
    )
    .join("");
  const panels = tabs
    .map((t) => `<div class="tabs__panel" data-panel="${t.id}">${t.content || ""}</div>`)
    .join("");
  return `
    <div class="tabs ${variant}">
      <div class="tabs__nav" role="tablist">${nav}</div>
      <div class="tabs__panels">${panels}</div>
    </div>
  `;
}