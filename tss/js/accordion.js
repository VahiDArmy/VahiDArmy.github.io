/* ==========================================================================
   Accordion — adapted from "Arco · Accordion"
   github.com/emanuelbento/arco-components

   Motion is the reference's, untouched: same CustomEase curves, same
   durations, same Flip + SplitText choreography, same hover-intent logic.
   Needs gsap + Flip + SplitText + CustomEase (loaded before this file).

   What differs from the reference, and why:
     1. RTL aware      – panel content slides in from the correct side and the
                         arrow keys follow the visual order.
     2. Input safe     – the reference listens for arrow keys on the whole list;
                         here they only work on the pill triggers, otherwise
                         typing in a textarea/select inside a panel would
                         switch panels.
     3. Panel body     – the "media" slot is the scrollable .rm-body, the "text"
                         slot is .rm-head__aside; elements that don't exist
                         in a panel are skipped instead of tweened.
     4. Dynamic        – open(key), badge(key, n), hide/show(key), refresh().
     5. Hygiene        – leftover transform/clip-path are cleared after the
                         reveal (they would create stacking contexts around
                         scrolling content), focus never scrolls the panel.
     6. Fallback       – if GSAP didn't load, html.rm-acc is removed and the
                         page shows the plain stacked sections.
   ========================================================================== */

(() => {
  const root = document.documentElement;

  if (!(window.gsap && window.Flip && window.SplitText && window.CustomEase)) {
    root.classList.remove("rm-acc");
    console.warn("[accordion] GSAP (core, Flip, SplitText, CustomEase) not available — using stacked sections.");
    return;
  }

  gsap.registerPlugin(Flip, SplitText, CustomEase);

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
      this.counter = (el.closest("section") ?? el).querySelector(".arco-accordion_counter");
      this.digits = new Intl.NumberFormat(root.lang || "en", { minimumIntegerDigits: 2, useGrouping: false });

      this.stacked = window.matchMedia(STACKED);
      this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

      el.style.setProperty("--arco-count", this.items.length);
      this.panels = this.items.map((item, i) => this.setup(item, i));

      this.panels.forEach((panel, i) => {
        this.toggle(panel, i === this.index);
        this.reset(panel, i === this.index);
      });
      this.bind();
      this.count();

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
      const [badge] = q(".rm-badge");

      content.id ||= `${this.id}-panel-${i}`;
      content.setAttribute("role", "region");
      label?.setAttribute("aria-hidden", "true");

      if (heading) {
        heading.id ||= `${this.id}-heading-${i}`;
        content.setAttribute("aria-labelledby", heading.id);
      }

      let [button] = q(".arco-accordion_trigger");
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "arco-accordion_trigger";
        button.setAttribute("aria-label", `Open ${(label ?? heading).textContent.trim()}`);
        item.prepend(button);
      }
      button.setAttribute("aria-controls", content.id);

      const split = heading
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
        // the pill label and the count bubble fade together
        labels: [label, badge].filter(Boolean),
        badge,
        content,
        split,
        media: q(".arco-accordion_media, .rm-body")[0],
        visual: q(".arco-accordion_visual")[0],
        text: q(".arco-accordion_text, .rm-head__aside"),
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

    go(index) {
      if (index === this.index || !this.panels[index]) return;

      const from = this.panels[this.index];
      const to = this.panels[index];
      const dir = index > this.index ? 1 : -1;
      const state = Flip.getState(this.items, { props: "borderRadius" });

      this.index = index;
      this.panels.forEach((panel, i) => this.toggle(panel, i === index));

      if (this.reduced.matches) {
        this.panels.forEach((panel, i) => this.reset(panel, i === index));
      } else {
        this.flip = Flip.from(state, { ...this.motion, absolute: true });
        this.leave(from, dir);
        this.enter(to, dir);
      }

      this.count();
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

    badge(key, value) {
      const panel = this.panels.find((p) => p.key === key);
      if (!panel?.badge) return;
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) {
        panel.badge.hidden = true;
        return;
      }
      panel.badge.textContent = n.toLocaleString(root.lang || "en");
      panel.badge.hidden = false;
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
      this.panels = items.map((item) => this.panels.find((p) => p.item === item) ?? this.setup(item, items.indexOf(item)));
      const kept = items.indexOf(openItem);
      this.index = kept > -1 ? kept : 0;

      this.el.style.setProperty("--arco-count", items.length);
      this.panels.forEach((panel, i) => {
        this.toggle(panel, i === this.index);
        this.reset(panel, i === this.index);
      });
      this.count();
    }

    setEase(name) {
      if (!presets[name]) return;
      this.motion = presets[name];
      this.emit("ease", { ease: name });
    }

    count() {
      if (!this.counter) return;
      this.counter.textContent = `${this.digits.format(this.index + 1)} / ${this.digits.format(this.items.length)}`;
    }

    toggle({ item, button, content }, open) {
      item.classList.toggle("is-active", open);
      button.setAttribute("aria-expanded", open);
      button.tabIndex = open ? 0 : -1;
      content.inert = !open;
    }

    // Reveal finished: drop the leftover transform / clip-path so the scrolling
    // body isn't wrapped in extra stacking contexts.
    settle(panel) {
      gsap.set(panel.content, { clearProps: "transform" });
      if (panel.media) gsap.set(panel.media, { clearProps: "clipPath" });
    }

    reset(panel, open) {
      panel.tl?.kill();
      gsap.set(panel.content, { autoAlpha: open ? 1 : 0, xPercent: 0, yPercent: 0 });
      gsap.set(panel.labels, { autoAlpha: open ? 0 : 1 });
      if (has(this.lines(panel))) gsap.set(this.lines(panel), { yPercent: 0 });
      if (panel.media) gsap.set(panel.media, { clipPath: "inset(0% 0% 0% 0%)" });
      if (panel.visual) gsap.set(panel.visual, { scale: 1 });
      if (has(panel.text)) gsap.set(panel.text, { autoAlpha: 1, y: 0 });
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
      if (has(panel.labels)) tl.to(panel.labels, { autoAlpha: 0, duration: 0.2, ease: "power1.out" }, 0);
      tl.fromTo(panel.content, { [axis]: shift }, { [axis]: 0, duration: duration * 1.15, ease }, 0);
      if (has(lines)) tl.fromTo(lines, { yPercent: 140 }, { yPercent: 0, stagger: 0.075 }, at);
      if (panel.media) {
        tl.fromTo(panel.media, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }, at + 0.08);
      }
      if (panel.visual) tl.fromTo(panel.visual, { scale: 1.3 }, { scale: 1, duration: 1.4 }, "<");
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
      if (panel.media) gsap.set(panel.media, { clipPath: "inset(0% 0% 0% 0%)" });

      const tl = gsap.timeline({ defaults: { ease: "arco-exit", duration: 0.42 } });
      if (has(panel.text)) tl.to(panel.text, { autoAlpha: 0, duration: 0.2, ease: "none" }, 0);
      if (panel.media) tl.to(panel.media, { clipPath: "inset(0% 0% 100% 0%)" }, 0);
      if (has(lines)) tl.to(lines, { yPercent: -140, stagger: 0.03 }, 0);
      tl.to(panel.content, { [axis]: shift, duration: 0.6 }, 0);
      tl.to(panel.content, { autoAlpha: 0, duration: 0.12, ease: "none" }, 0.38);
      if (has(panel.labels)) {
        tl.to(panel.labels, { autoAlpha: 1, duration: 0.8, ease: "arco-reveal" }, this.motion.duration * 0.45);
      }
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
      this.panels.forEach((panel) => {
        panel.tl?.kill();
        panel.split?.revert();
        gsap.set([panel.item, panel.content, panel.media, panel.visual, ...panel.labels].filter(Boolean), { clearProps: "all" });
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
