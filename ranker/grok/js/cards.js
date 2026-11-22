/* Enhanced stack engine inspired by the provided Tinder code */

const CardStacks = (() => {
  let stacks = []; // { el, cards: [], label, onSwipe, onSelect }

  function createStack(container, { label, items, onSwipe, onSelect, accent }) {
    const stackEl = document.createElement('div');
    stackEl.className = 'stack';
    stackEl.innerHTML = `
      <div class="stack-label">${label}</div>
      <div class="tinder-stack"></div>
      <div class="stack-status love"><i class="fa-solid fa-heart"></i></div>
      <div class="stack-status nope"><i class="fa-solid fa-xmark"></i></div>
    `;
    container.appendChild(stackEl);
    const cardsRoot = stackEl.querySelector('.tinder-stack');

    const cardEls = items.map((item, idx) => {
      const card = document.createElement('div');
      card.className = 'tinder--card';
      card.dataset.id = item.id;
      card.style.setProperty('--card-accent', item.color || accent || 'var(--accent)');
      const initial = (item.name || '?')[0].toUpperCase();
      card.innerHTML = `
        <div class="card-top">
          <div class="card-avatar">${initial}</div>
          <div class="card-score-preview">0</div>
        </div>
        <div class="card-body">
          <h3>${escapeHtml(item.name)}</h3>
          <div class="card-meta">${escapeHtml(item.meta || '')}</div>
          <div class="card-traits">${(item.tags || []).slice(0, 4).map(t => `<span class="mini-trait">${escapeHtml(t)}</span>`).join('')}</div>
        </div>
      `;
      cardsRoot.appendChild(card);
      return card;
    });

    const stack = {
      el: stackEl,
      cardsRoot,
      cards: cardEls,
      items,
      label,
      onSwipe,
      onSelect,
      activeIndex: 0
    };
    stacks.push(stack);
    initCards(stack);
    bindHammer(stack);
    return stack;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function initCards(stack) {
    const remaining = stack.cards.filter(c => !c.classList.contains('removed'));
    remaining.forEach((card, index) => {
      card.style.zIndex = remaining.length - index;
      const scale = (20 - index) / 20;
      const ty = 18 * index;
      card.style.transform = `scale(${scale}) translateY(-${ty}px)`;
      card.style.opacity = (12 - index) / 12;
    });
    if (remaining.length === 0) {
      if (!stack.cardsRoot.querySelector('.stack-empty')) {
        const empty = document.createElement('div');
        empty.className = 'stack-empty';
        empty.textContent = 'DONE';
        stack.cardsRoot.appendChild(empty);
      }
    }
  }

  function bindHammer(stack) {
    stack.cards.forEach((el) => {
      const hammertime = new Hammer(el);
      hammertime.get('pan').set({ direction: Hammer.DIRECTION_ALL });

      hammertime.on('pan', (event) => {
        el.classList.add('moving');
        if (event.deltaX === 0 && event.deltaY === 0) return;
        stack.el.classList.toggle('tinder_love', event.deltaX > 40);
        stack.el.classList.toggle('tinder_nope', event.deltaX < -40);

        const xMulti = event.deltaX * 0.03;
        const yMulti = event.deltaY / 80;
        const rotate = xMulti * yMulti;
        el.style.transform = `translate(${event.deltaX}px, ${event.deltaY}px) rotate(${rotate}deg)`;

        const preview = el.querySelector('.card-score-preview');
        if (preview) {
          const score = Math.max(-5, Math.min(5, (event.deltaX / 60).toFixed(1)));
          preview.textContent = (score > 0 ? '+' : '') + score;
          preview.style.color = score > 0 ? 'var(--love)' : score < 0 ? 'var(--nope)' : 'var(--text2)';
        }
      });

      hammertime.on('panend', (event) => {
        el.classList.remove('moving');
        stack.el.classList.remove('tinder_love', 'tinder_nope');

        const moveOutWidth = document.body.clientWidth * 1.2;
        const keep = Math.abs(event.deltaX) < 90 || Math.abs(event.velocityX) < 0.45;

        if (keep) {
          el.style.transform = '';
          initCards(stack);
          SFX.softTick();
        } else {
          const endX = Math.max(Math.abs(event.velocityX) * moveOutWidth, moveOutWidth);
          const toX = event.deltaX > 0 ? endX : -endX;
          const endY = Math.abs(event.velocityY) * moveOutWidth * 0.3;
          const toY = event.deltaY > 0 ? endY : -endY;
          const xMulti = event.deltaX * 0.03;
          const yMulti = event.deltaY / 80;
          const rotate = xMulti * yMulti;

          el.style.transform = `translate(${toX}px, ${toY + event.deltaY}px) rotate(${rotate}deg)`;
          el.classList.add('removed');

          const direction = event.deltaX > 0 ? 1 : -1;
          const scoreHint = Math.max(-5, Math.min(5, Number((event.deltaX / 50).toFixed(1))));
          SFX.swipeWhoosh(direction);
          SFX.glassClink(0.7 + Math.min(1, Math.abs(event.velocityX)));
          if (navigator.vibrate) navigator.vibrate(direction > 0 ? [12, 30, 12] : 20);

          const item = stack.items.find(i => i.id === el.dataset.id);
          if (stack.onSwipe) stack.onSwipe({ item, direction, scoreHint, el });
          setTimeout(() => initCards(stack), 50);
        }
      });

      el.addEventListener('click', (e) => {
        if (el.classList.contains('moving') || el.classList.contains('removed')) return;
        if (stack.onSelect) stack.onSelect({ item: stack.items.find(i => i.id === el.dataset.id), el });
      });
    });
  }

  function clear(container) {
    stacks = [];
    if (container) container.innerHTML = '';
  }

  function forceSwipe(stack, direction) {
    const remaining = stack.cards.filter(c => !c.classList.contains('removed'));
    if (!remaining.length) return;
    const el = remaining[0];
    const moveOutWidth = document.body.clientWidth * 1.4;
    const toX = direction > 0 ? moveOutWidth : -moveOutWidth;
    el.style.transform = `translate(${toX}px, -80px) rotate(${direction * -25}deg)`;
    el.classList.add('removed');
    SFX.swipeWhoosh(direction);
    SFX.glassClink(0.9);
    if (navigator.vibrate) navigator.vibrate(15);
    const item = stack.items.find(i => i.id === el.dataset.id);
    if (stack.onSwipe) stack.onSwipe({ item, direction, scoreHint: direction * 3, el });
    setTimeout(() => initCards(stack), 40);
  }

  return { createStack, clear, forceSwipe, getStacks: () => stacks };
})();

window.CardStacks = CardStacks;
