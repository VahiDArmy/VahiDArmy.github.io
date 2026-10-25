/* ==========================================================================
   Accordion — adapted from "Arco · Accordion"
   github.com/emanuelbento/arco-components

   Motion is the reference's: same CustomEase curves, same durations, same
   Flip choreography, same hover-intent logic, same ARIA wiring.
   Needs gsap + Flip + CustomEase (SplitText is used only if a panel has an
   .arco-accordion_heading and the plugin is loaded).

   What differs from the reference, and why:
     1. Sized by content – the reference gives the component a fixed height and
                         clips the panel. Here an open panel is exactly as tall
                         as the original section (a ResizeObserver keeps
                         --rm-open-h in sync), so the PAGE scrolls like before
                         and the section looks exactly as it did.
     2. Original text  – the section's own .section__label plays the role of the
                         reference's heading; the section content gets the
                         reference's clip reveal.
     3. RTL aware      – panel content slides in from the correct side and the
                         arrow keys follow the visual order.
     4. Input safe     – arrow keys only act on the pill buttons, otherwise
                         typing in a textarea/select would switch panels.
     5. Dynamic        – open(key), hide/show(key), refresh().
     6. Hygiene        – leftover transform/clip-path are cleared after the
                         reveal; focus never scrolls the panel.
     7. Fallback       – no GSAP: html.rm-acc is removed and the sections stack
                         exactly like the original page.
   ========================================================================== */

(() => {
  const root = document.documentElement;

  if (!(window.gsap && window.Flip && window.CustomEase)) {
    root.classList.remove("rm-acc");
    console.warn("[accordion] GSAP (core, Flip, CustomEase) not available — using stacked sections.");
    return;
  }

  gsap.registerPlugin(Flip, CustomEase);
  if (window.SplitText) gsap.registerPlugin(SplitText);

  CustomEase.create("arco-signature", "0.625, 0.05, 0, 1");
  CustomEase.create("arco-smooth", "0.76, 0, 0.24, 1");
  CustomEase.create("arco-snappy", "0.16, 1, 0.3, 1");
  CustomEase.create("arco-reveal", "0.16, 1, 0.3, 1");
  CustomEase.create("arco-exit", "0.7, 0, 0.84, 0");

  const presets = {
    signature: { ease: "arco-signature", duration: 1.1 },
    smooth: { ease: "arco-smooth", duration: 1.25 },
    snappy: { ease: "arco-snappy", duration: 0.9 },
  };

  // Must match the stacked layout query in accordion.css
  const STACKED = "(max-width: 767px), (max-width: 991px) and (orientation: portrait)";

  // While panels resize they slide under a still cursor, so hover is held
  // for a moment and then resolved against whatever is under the pointer.
  const HOVER_LOCK = 0.34;
  const HOVER_INTENT = 0.05;

  const has = (x) => (Array.isArray(x) ? x.length > 0 : !!x);

  let count = 0;

  class ArcoAccordion {
    constructor(el, options = {}) {
      this.el = el;
      this.items = this.visibleItems();
      if (this.items.length < 2) return;

      // data-arco-accordion-* matches the other components, data-arco-* still works
      const data = el.dataset;
      this.options = {
        active: Number(data.arcoAccordionActive ?? data.arcoActive ?? 0),
        trigger: data.arcoAccordionTrigger ?? data.arcoTrigger ?? "hover",
        ease: data.arcoAccordionEase ?? data.arcoEase ?? "signature",
        ...options,
      };

      this.id = el.id || `arco-accordion-${++count}`;
      this.rtl = getComputedStyle(el).direction === "rtl";
      this.index = gsap.utils.clamp(0, this.items.length - 1, this.options.active);
      this.motion = presets[this.options.ease] ?? presets.signature;
      this.abort = new AbortController();
      this.pointer = null;

      this.stacked = window.matchMedia(STACKED);
      this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

      el.style.setProperty("--arco-count", this.items.length);
      this.panels = this.items.map((item, i) => this.setup(item, i));

      // an open panel is as tall as its content, whatever the content does later
      this.resizer = new ResizeObserver((entries) => {
        const open = this.panels[this.index];
        if (entries.some((entry) => entry.target === open?.content)) this.syncHeight(open);
      });
      this.panels.forEach((panel) => this.resizer.observe(panel.content));

      this.panels.forEach((panel, i) => {
        this.syncHeight(panel);
        this.toggle(panel, i === this.index);
        this.reset(panel, i === this.index);
      });
      this.bind();

      el.arcoAccordion = this;
      this.emit("init");
    }

    visibleItems() {
      return gsap.utils.toArray(".arco-accordion_item", this.el).filter((item) => !item.hidden);
    }

    setup(item, i) {
      const q = gsap.utils.selector(item);
      const [label] = q(".arco-accordion_label");
      const [content] = q(".arco-accordion_content");
      const [heading] = q(".arco-accordion_heading");
      const [title] = q(".section__label");

      content.id ||= `${this.id}-panel-${i}`;
      content.setAttribute("role", "region");
      label?.setAttribute("aria-hidden", "true");

      // name the region from the section's own aria-label, else from its title
      const named = heading ?? title;
      if (!content.hasAttribute("aria-label") && named) {
        named.id ||= `${this.id}-title-${i}`;
        content.setAttribute("aria-labelledby", named.id);
      }

      let [button] = q(".arco-accordion_trigger");
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "arco-accordion_trigger";
        const name = content.getAttribute("aria-label") ?? (label ?? named)?.textContent.trim() ?? "";
        button.setAttribute("aria-label", `Open ${name}`);
        item.prepend(button);
      }
      button.setAttribute("aria-controls", content.id);

      const split =
        heading && window.SplitText
          ? SplitText.create(heading, {
              type: "lines",
              mask: "lines",
              linesClass: "arco-accordion_line",
              aria: "none",
              autoSplit: true,
            })
          : null;

      return {
        item,
        key: item.dataset.panelKey || String(i),
        button,
        label,
        content,
        split,
        // the section's own title rises in like the reference's text block
        text: [...q(".arco-accordion_text"), ...(split ? [] : title ? [title] : [])],
        tl: null,
      };
    }

    lines(panel) {
      return panel.split?.lines ?? [];
    }

    // x flips in RTL (the "next" panel is on the left), y never does
    axis() {
      return this.stacked.matches ? "yPercent" : "xPercent";
    }

    sign() {
      return this.stacked.matches || !this.rtl ? 1 : -1;
    }

    // The open item takes the height of its content (content is absolutely
    // positioned at the open width, so this never depends on the animation).
    syncHeight(panel) {
      if (!panel) return;
      panel.item.style.setProperty("--rm-open-h", `${Math.ceil(panel.content.offsetHeight)}px`);
    }

    go(index) {
      if (index === this.index || !this.panels[index]) return;

      const from = this.panels[this.index];
      const to = this.panels[index];
      const dir = index > this.index ? 1 : -1;

      const startH = this.el.getBoundingClientRect().height;
      this.syncHeight(to); // before the layout switch, so the end state is right
      const state = Flip.getState(this.items, { props: "borderRadius" });

      this.index = index;
      this.panels.forEach((panel, i) => this.toggle(panel, i === index));

      const endH = this.el.getBoundingClientRect().height;
      const finalTop = to.item.getBoundingClientRect().top;

      if (this.reduced.matches) {
        this.panels.forEach((panel, i) => this.reset(panel, i === index));
      } else {
        this.flip = Flip.from(state, { ...this.motion, absolute: true });
        // the items leave the flow while they animate; carry the page height across
        gsap.fromTo(
          this.el,
          { height: startH },
          { height: endH, duration: this.motion.duration, ease: this.motion.ease, clearProps: "height", overwrite: true }
        );
        this.leave(from, dir);
        this.enter(to, dir);
      }

      // the newly opened section must be where the reader is looking
      if (finalTop < 8 || finalTop > window.innerHeight - 120) {
        window.scrollTo({
          top: window.scrollY + finalTop - 12,
          behavior: this.reduced.matches ? "auto" : "smooth",
        });
      }

      this.emit("change", { index, previous: this.panels.indexOf(from), key: to.key });
    }

    next() {
      this.go(gsap.utils.wrap(0, this.items.length, this.index + 1));
    }

    prev() {
      this.go(gsap.utils.wrap(0, this.items.length, this.index - 1));
    }

    // Open a panel by data-panel-key (or index). Resolves once its content is
    // focusable, so callers can focus a field right after.
    open(keyOrIndex) {
      const index =
        typeof keyOrIndex === "number"
          ? keyOrIndex
          : this.panels.findIndex((panel) => panel.key === keyOrIndex);
      if (index < 0) return Promise.resolve(false);
      this.go(index);
      return new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
    }

    isOpen(key) {
      return this.panels[this.index]?.key === key;
    }

    // hide/show a panel entirely (e.g. a feature that needs a signed-in user)
    setHidden(key, hidden) {
      const item = gsap.utils.toArray(".arco-accordion_item", this.el).find((i) => i.dataset.panelKey === key);
      if (!item || item.hidden === hidden) return;
      item.hidden = hidden;
      this.refresh();
    }

    // Re-read which panels exist (after setHidden). Keeps the open panel if it
    // survived, otherwise falls back to the first one.
    refresh() {
      const openItem = this.panels[this.index]?.item;
      const items = this.visibleItems();
      if (items.length < 2) return;

      this.items = items;
      this.panels = items.map((item) => {
        const known = this.panels.find((p) => p.item === item);
        if (known) return known;
        const panel = this.setup(item, items.indexOf(item));
        this.resizer.observe(panel.content);
        return panel;
      });
      const kept = items.indexOf(openItem);
      this.index = kept > -1 ? kept : 0;

      this.el.style.setProperty("--arco-count", items.length);
      this.panels.forEach((panel, i) => {
        this.syncHeight(panel);
        this.toggle(panel, i === this.index);
        this.reset(panel, i === this.index);
      });
    }

    setEase(name) {
      if (!presets[name]) return;
      this.motion = presets[name];
      this.emit("ease", { ease: name });
    }

    toggle({ item, button, content }, open) {
      item.classList.toggle("is-active", open);
      button.setAttribute("aria-expanded", open);
      button.tabIndex = open ? 0 : -1;
      content.inert = !open;
    }

    // Reveal finished: drop the leftover transform / clip-path / opacity so the
    // original section is left exactly as the page had it.
    // the pill's colour as "same colour, with and without alpha" so the fade never passes through grey
    fill(panel) {
      const raw = getComputedStyle(panel.item).getPropertyValue("--arco-panel").trim();
      const hex = /^#([0-9a-f]{6})$/i.exec(raw);
      if (!hex) return { solid: raw || "#b9b0e3", clear: "rgba(0, 0, 0, 0)" };
      const n = parseInt(hex[1], 16);
      const rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
      return { solid: `rgb(${rgb})`, clear: `rgba(${rgb}, 0)` };
    }

    settle(panel) {
      gsap.set(panel.item, { clearProps: "backgroundColor" });
      gsap.set(panel.content, { clearProps: "transform,clipPath" });
      if (has(panel.text)) gsap.set(panel.text, { clearProps: "opacity,visibility,transform" });
    }

    reset(panel, open) {
      panel.tl?.kill();
      gsap.set(panel.content, { autoAlpha: open ? 1 : 0, xPercent: 0, yPercent: 0 });
      if (panel.label) gsap.set(panel.label, { autoAlpha: open ? 0 : 1 });
      if (has(this.lines(panel))) gsap.set(this.lines(panel), { yPercent: 0 });
      this.settle(panel);
    }

    enter(panel, dir) {
      const { ease, duration } = this.motion;
      const axis = this.axis();
      const shift = dir * this.sign() * 6;
      const at = duration * 0.2;
      const lines = this.lines(panel);

      panel.tl?.kill();
      // focusable straight away; every child is already in its "from" pose
      gsap.set(panel.content, { autoAlpha: 1 });

      const tl = gsap.timeline({
        defaults: { ease: "arco-reveal", duration: 1 },
        onComplete: () => this.settle(panel),
      });

      tl.set(panel.content, { autoAlpha: 1 });
      // opening: the pill's colour dissolves while the original section wipes in (the open section has no fill)
      const colour = this.fill(panel);
      tl.fromTo(panel.item, { backgroundColor: colour.solid }, { backgroundColor: colour.clear, duration: 0.35, ease: "power2.out" }, 0);
      if (panel.label) tl.to(panel.label, { autoAlpha: 0, duration: 0.2, ease: "power1.out" }, 0);
      tl.fromTo(panel.content, { [axis]: shift }, { [axis]: 0, duration: duration * 1.15, ease }, 0);
      if (has(lines)) tl.fromTo(lines, { yPercent: 140 }, { yPercent: 0, stagger: 0.075 }, at);
      tl.fromTo(panel.content, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }, at + 0.08);
      if (has(panel.text)) {
        tl.fromTo(panel.text, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8 }, at + 0.18);
      }
      panel.tl = tl;
    }

    leave(panel, dir) {
      const axis = this.axis();
      const shift = dir * this.sign() * -6;
      const lines = this.lines(panel);

      panel.tl?.kill();
      // the settled panel has no inline clip-path to tween from
      gsap.set(panel.content, { clipPath: "inset(0% 0% 0% 0%)" });

      const tl = gsap.timeline({ defaults: { ease: "arco-exit", duration: 0.42 } });
      // closing: the pill colour only arrives once the old content has left, so the
      // section never sits on a coloured fill while it closes
      const colour = this.fill(panel);
      tl.fromTo(panel.item, { backgroundColor: colour.clear }, { backgroundColor: colour.solid, duration: 0.5, ease: "arco-reveal" }, 0.4);
      if (has(panel.text)) tl.to(panel.text, { autoAlpha: 0, duration: 0.2, ease: "none" }, 0);
      tl.to(panel.content, { clipPath: "inset(0% 0% 100% 0%)" }, 0);
      if (has(lines)) tl.to(lines, { yPercent: -140, stagger: 0.03 }, 0);
      tl.to(panel.content, { [axis]: shift, duration: 0.6 }, 0);
      tl.to(panel.content, { autoAlpha: 0, duration: 0.12, ease: "none" }, 0.38);
      if (panel.label) {
        tl.to(panel.label, { autoAlpha: 1, duration: 0.8, ease: "arco-reveal" }, this.motion.duration * 0.45);
      }
      tl.add(() => this.settle(panel));
      panel.tl = tl;
    }

    hovered() {
      if (!this.pointer) return -1;
      const item = document.elementFromPoint(this.pointer.x, this.pointer.y)?.closest(".arco-accordion_item");
      return this.items.indexOf(item);
    }

    resolveHover() {
      this.intent?.kill();
      const locked = this.flip?.isActive() ? Math.max(HOVER_LOCK - this.flip.time(), 0) : 0;

      this.intent = gsap.delayedCall(locked + HOVER_INTENT, () => {
        const index = this.hovered();
        if (index > -1) this.go(index);
      });
    }

    bind() {
      const { signal } = this.abort;
      const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");

      this.el.addEventListener(
        "pointermove",
        (e) => {
          if (e.pointerType !== "mouse" || this.options.trigger !== "hover" || !canHover.matches) return;
          const before = this.hovered();
          this.pointer = { x: e.clientX, y: e.clientY };
          if (this.hovered() !== before) this.resolveHover();
        },
        { signal }
      );

      this.el.addEventListener(
        "pointerleave",
        () => {
          this.pointer = null;
          this.intent?.kill();
        },
        { signal }
      );

      // Delegated, so panels added later (refresh) work without re-binding
      this.el.addEventListener(
        "click",
        (e) => {
          const button = e.target.closest?.(".arco-accordion_trigger");
          if (!button) return;
          const index = this.panels.findIndex((panel) => panel.button === button);
          if (index > -1) this.go(index);
        },
        { signal }
      );

      // Arrow keys only act on the pill triggers. Anything typed inside a
      // panel (textarea, select, buttons) must never switch panels.
      this.el.addEventListener(
        "keydown",
        (e) => {
          if (!e.target.classList?.contains("arco-accordion_trigger")) return;

          // arrows follow the visual order: in RTL the next panel is on the left
          const horizontal = this.stacked.matches ? 1 : this.rtl ? -1 : 1;
          const keys = { ArrowRight: horizontal, ArrowLeft: -horizontal, ArrowDown: 1, ArrowUp: -1 };
          let index = null;

          if (e.key in keys) index = gsap.utils.wrap(0, this.items.length, this.index + keys[e.key]);
          if (e.key === "Home") index = 0;
          if (e.key === "End") index = this.items.length - 1;
          if (index === null) return;

          e.preventDefault();
          this.go(index);
          this.panels[index].button.focus({ preventScroll: true });
        },
        { signal }
      );
    }

    emit(name, detail = {}) {
      this.el.dispatchEvent(new CustomEvent(`arco:${name}`, { detail: { instance: this, ...detail } }));
    }

    destroy() {
      this.abort.abort();
      this.intent?.kill();
      this.flip?.kill();
      this.resizer?.disconnect();
      this.panels.forEach((panel) => {
        panel.tl?.kill();
        panel.split?.revert();
        gsap.set([panel.item, panel.content, panel.label].filter(Boolean), { clearProps: "all" });
        if (has(panel.text)) gsap.set(panel.text, { clearProps: "all" });
      });
      delete this.el.arcoAccordion;
    }

    static init(scope = document) {
      return gsap.utils
        .toArray("[data-arco-accordion]", scope)
        .map((el) => el.arcoAccordion ?? new ArcoAccordion(el));
    }
  }

  ArcoAccordion.presets = presets;
  window.ArcoAccordion = ArcoAccordion;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => ArcoAccordion.init());
  } else {
    ArcoAccordion.init();
  }
})();
