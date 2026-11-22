(function () {
  const T3D = window.T3D;
  const { h, esc } = T3D.lib;

  /**
   * Create a 3D deck.
   * opts: { items, renderCard(item, index) -> HTML string or element, onFocus(item, index), onSelect(item, index), getId(item) }
   */
  function createDeck(opts) {
    const wrap = h('div', { class: 'deck-wrap' });
    const status = h('div', { class: 'tinder--status' },
      h('i', { class: 'fa-solid fa-times' }),
      h('i', { class: 'fa-solid fa-heart' })
    );
    const deck = h('div', { class: 'deck' });
    const controls = h('div', { class: 'deck-controls' });
    wrap.appendChild(status);
    wrap.appendChild(deck);
    wrap.appendChild(controls);

    let index = 0;
    const cards = [];

    function build() {
      deck.innerHTML = '';
      cards.length = 0;
      opts.items.forEach((item, i) => {
        const inner = opts.renderCard(item, i);
        const card = h('div', { class: 'deck-card', dataset: { idx: String(i) } });
        if (typeof inner === 'string') card.innerHTML = inner;
        else card.appendChild(inner);
        deck.appendChild(card);
        cards.push(card);
        attachGestures(card, i);
      });
      layout();
    }

    function layout() {
      const n = cards.length;
      // Focused at index
      cards.forEach((card, i) => {
        const rel = i - index;
        if (rel < 0) {
          // Gone to the left
          card.style.transform = `translateX(-120%) translateY(20px) scale(0.9)`;
          card.style.opacity = '0';
          card.style.zIndex = String(0);
          card.style.pointerEvents = 'none';
          return;
        }
        if (rel > 4) {
          card.style.transform = `translateY(40px) scale(0.82)`;
          card.style.opacity = '0';
          card.style.zIndex = String(0);
          card.style.pointerEvents = 'none';
          return;
        }
        const scale = 1 - rel * 0.06;
        const ty = rel * 16;
        const tz = -rel * 40;
        card.style.transform = `translateY(${ty}px) translateZ(${tz}px) scale(${scale})`;
        card.style.opacity = String(1 - rel * 0.14);
        card.style.zIndex = String(n - rel);
        card.style.pointerEvents = rel === 0 ? 'auto' : 'none';
        card.classList.toggle('focused', rel === 0);
      });
      const item = opts.items[index];
      if (item && opts.onFocus) opts.onFocus(item, index);
      updateControls();
    }

    function attachGestures(card, i) {
      if (!window.Hammer) return;
      const hm = new Hammer(card);
      hm.get('pan').set({ direction: Hammer.DIRECTION_ALL, threshold: 4 });
      let moved = false;
      hm.on('panstart', () => { moved = false; });
      hm.on('pan', (e) => {
        if (i !== index) return;
        moved = true;
        card.classList.add('moving');
        const dx = e.deltaX, dy = e.deltaY;
        const rot = dx * 0.05;
        card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
        wrap.classList.toggle('deck-love', dx > 40);
        wrap.classList.toggle('deck-nope', dx < -40);
      });
      hm.on('panend', (e) => {
        card.classList.remove('moving');
        wrap.classList.remove('deck-love', 'deck-nope');
        if (!moved) return;
        const threshold = 90;
        if (Math.abs(e.deltaX) > threshold || Math.abs(e.velocityX) > 0.6) {
          T3D.sound.whoosh(0.06);
          T3D.vibrate.tick();
          next(e.deltaX < 0 ? 1 : -1);
        } else {
          layout();
        }
      });
      // Tap
      let downAt = 0, downX = 0, downY = 0;
      card.addEventListener('pointerdown', (e) => { downAt = Date.now(); downX = e.clientX; downY = e.clientY; });
      card.addEventListener('pointerup', (e) => {
        if (Date.now() - downAt < 300 && Math.hypot(e.clientX - downX, e.clientY - downY) < 6) {
          if (i === index && opts.onSelect) opts.onSelect(opts.items[index], index);
        }
      });
    }

    function next(dir) {
      if (dir > 0) index = Math.min(opts.items.length - 1, index + 1);
      else index = Math.max(0, index - 1);
      layout();
    }

    function updateControls() {
      controls.innerHTML = '';
      const prev = h('button', { class: 'deck-btn ghost', title: 'Previous' },
        h('i', { class: 'fa-solid fa-arrow-left' }));
      prev.addEventListener('click', (e) => { e.stopPropagation(); T3D.sound.clink(0.08); next(-1); });
      const focus = h('button', { class: 'deck-btn primary', title: 'Open' },
        h('i', { class: 'fa-solid fa-expand' }));
      focus.addEventListener('click', (e) => { e.stopPropagation(); T3D.sound.clink(0.12); T3D.vibrate.tick(); if (opts.onSelect && opts.items[index]) opts.onSelect(opts.items[index], index); });
      const nxt = h('button', { class: 'deck-btn ghost', title: 'Next' },
        h('i', { class: 'fa-solid fa-arrow-right' }));
      nxt.addEventListener('click', (e) => { e.stopPropagation(); T3D.sound.clink(0.08); next(1); });
      controls.appendChild(prev);
      controls.appendChild(focus);
      controls.appendChild(nxt);
      prev.disabled = index === 0;
      nxt.disabled = index === opts.items.length - 1;
    }

    function focusId(id) {
      const i = opts.items.findIndex(it => (opts.getId ? opts.getId(it) : it.id) === id);
      if (i >= 0) { index = i; layout(); }
    }

    build();

    return {
      el: wrap,
      refresh: () => { build(); },
      focusId,
      getIndex: () => index,
      setItems: (newItems) => { opts.items = newItems; build(); }
    };
  }

  T3D.createDeck = createDeck;
})();
