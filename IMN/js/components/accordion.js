/**
 * Accordion — CSS-driven with JS for state + events.
 *
 *   const acc = accordionInit(el, { multiple: false, defaultOpen: ["a"] });
 *   acc.open("b"); acc.close("a"); acc.toggle("c");
 *
 * Markup:
 *   <div class="accordion" data-accordion>
 *     <div class="accordion__item" data-acc-item="a">
 *       <div class="accordion__head">...</div>
 *       <div class="accordion__body">...</div>
 *     </div>
 *   </div>
 */

export function accordionInit(container, opts = {}) {
  if (!container) return null;

  const { multiple = false, defaultOpen = [], onChange } = opts;
  const items = [...container.querySelectorAll("[data-acc-item]")];

  function setOpen(item, open, { silent = false } = {}) {
    const id = item.dataset.accItem;
    item.classList.toggle("is-open", open);
    const head = item.querySelector(".accordion__head");
    head?.setAttribute("aria-expanded", open ? "true" : "false");
    if (!silent) onChange?.(id, open);
  }

  function isOpen(item) {
    return item.classList.contains("is-open");
  }

  function open(id) {
    const item = items.find((i) => i.dataset.accItem === id);
    if (!item) return;
    if (!multiple) items.forEach((i) => i !== item && setOpen(i, false, { silent: true }));
    setOpen(item, true);
  }

  function close(id) {
    const item = items.find((i) => i.dataset.accItem === id);
    if (item) setOpen(item, false);
  }

  function toggle(id) {
    const item = items.find((i) => i.dataset.accItem === id);
    if (!item) return;
    setOpen(item, !isOpen(item));
  }

  items.forEach((item) => {
    const head = item.querySelector(".accordion__head");
    if (!head) return;
    head.setAttribute("role", "button");
    head.setAttribute("tabindex", "0");
    head.setAttribute("aria-expanded", isOpen(item) ? "true" : "false");
    head.addEventListener("click", () => toggle(item.dataset.accItem));
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(item.dataset.accItem);
      }
    });
  });

  defaultOpen.forEach((id) => open(id));

  return { open, close, toggle, items, isOpen };
}