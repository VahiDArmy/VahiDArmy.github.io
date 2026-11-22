import { store } from '../lib/store.js';
import { Sound } from '../lib/sound.js';
import { avatarHtml, esc, toast } from '../lib/ui.js';

function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export default function SwipeView(root) {
  const myPerson = store.myPerson;
  if (!myPerson) {
    root.innerHTML = `<div class="view-pad"><div class="empty">Link a person to your account to start scoring.</div></div>`;
    return { destroy: () => {} };
  }

  let queue = [];
  let idx = 0;
  let activeCard = null;

  function buildQueue() {
    const q = [];
    for (const t of store.people) {
      if (t.id === myPerson.id) continue;
      for (const tr of store.traits) {
        const cur = store.getScore(myPerson.id, t.id, tr.id);
        q.push({ target: t, trait: tr, cur });
      }
    }
    return shuffle(q);
  }

  function render() {
    root.innerHTML = `
      <div class="swipe-wrap">
        <div class="swipe-progress" id="sw-progress"></div>
        <div class="swipe-stack" id="sw-stack"></div>
        <div class="swipe-actions">
          <button class="nope" id="sw-nope"><i class="fa-solid fa-xmark"></i></button>
          <button class="love" id="sw-love"><i class="fa-solid fa-heart"></i></button>
        </div>
      </div>
    `;
    const stack = root.querySelector('#sw-stack');
    const prog = root.querySelector('#sw-progress');

    if (idx >= queue.length) {
      stack.innerHTML = `<div class="empty" style="position:absolute;inset:0;display:grid;place-items:center">All pairs scored — reshuffling.</div>`;
      prog.textContent = '';
      setTimeout(() => { queue = buildQueue(); idx = 0; render(); }, 900);
      return;
    }
    prog.textContent = `${idx + 1} / ${queue.length}`;

    // Render up to 3 upcoming cards
    for (let i = Math.min(idx + 2, queue.length - 1); i >= idx; i--) {
      const item = queue[i];
      const card = document.createElement('div');
      card.className = 'swipe-card';
      card.style.zIndex = 100 - (i - idx);
      card.style.transform = `translateY(${(i - idx) * 12}px) scale(${1 - (i - idx) * 0.05})`;
      if (i !== idx) card.style.opacity = '0.5';
      card.innerHTML = `
        <div class="swipe-preview"></div>
        ${avatarHtml(item.target, 150).replace('class="avatar"', 'class="swipe-avatar avatar"').replace('class="avatar avatar-fallback"', 'class="swipe-avatar avatar avatar-fallback"')}
        <div class="swipe-name">${esc(item.target.full_name)}</div>
        <div class="swipe-trait" style="background:${(item.trait.color || '#a855f7')}22;color:${item.trait.color || '#a855f7'}">
          <i class="fa-solid fa-${esc(item.trait.icon || 'sparkles')}"></i> ${esc(item.trait.name)}
        </div>
      `;
      if (item.cur !== null) {
        const tag = document.createElement('div');
        tag.style.cssText = 'position:absolute;bottom:16px;left:16px;font-family:var(--mono);font-size:11px;color:var(--text-faint)';
        tag.textContent = `current: ${item.cur}`;
        card.appendChild(tag);
      }
      if (i === idx) {
        activeCard = card;
        attachSwipe(card, item);
      }
      stack.appendChild(card);
    }
  }

  function attachSwipe(card, item) {
    const preview = card.querySelector('.swipe-preview');
    let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;

    card.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      card.setPointerCapture(e.pointerId);
      card.classList.add('moving');
    });
    card.addEventListener('pointermove', e => {
      if (!dragging) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      const rot = dx * 0.06;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
      const score = Math.round(Math.max(-10, Math.min(10, (dx / window.innerWidth) * 24)));
      preview.textContent = score > 0 ? `+${score}` : `${score}`;
      preview.classList.add('on');
      preview.classList.remove('pos', 'neg', 'zero');
      if (score > 0) preview.classList.add('pos');
      else if (score < 0) preview.classList.add('neg');
      else preview.classList.add('zero');
      preview.style.opacity = Math.min(1, Math.abs(dx) / 80);
    });
    card.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      card.classList.remove('moving');
      const score = Math.round(Math.max(-10, Math.min(10, (dx / window.innerWidth) * 24)));
      if (Math.abs(dx) > 70 && score !== 0) {
        card.style.transform = `translate(${dx > 0 ? 1 : -1}px * 150vw, ${dy}px) rotate(${dx * 0.06}deg)`;
        card.style.transform = `translate(${(dx > 0 ? 1 : -1) * window.innerWidth * 1.2}px, ${dy}px) rotate(${dx * 0.06}deg)`;
        card.style.opacity = '0';
        applyScore(item, score);
      } else {
        card.style.transform = `translateY(0) scale(1)`;
        preview.classList.remove('on');
      }
      dx = dy = 0;
    });
    card.addEventListener('pointercancel', () => {
      dragging = false;
      card.classList.remove('moving');
      card.style.transform = '';
      preview.classList.remove('on');
    });
  }

  async function applyScore(item, score) {
    try {
      await store.setScore(myPerson.id, item.target.id, item.trait.id, score);
      Sound.glass(score > 0 ? 1 : 0.7);
      idx++;
      setTimeout(render, 220);
    } catch (e) {
      toast(e.message, 'error');
      render();
    }
  }

  function skipWithScore(score) {
    const item = queue[idx];
    if (!item || !activeCard) return;
    activeCard.style.transform = `translate(${(score > 0 ? 1 : -1) * window.innerWidth * 1.2}px, 0) rotate(${score * 4}deg)`;
    activeCard.style.opacity = '0';
    applyScore(item, score);
  }

  render();
  setTimeout(() => {
    const nope = root.querySelector('#sw-nope');
    const love = root.querySelector('#sw-love');
    if (nope) nope.onclick = () => skipWithScore(-5);
    if (love) love.onclick = () => skipWithScore(5);
  }, 0);

  return { destroy: () => {} };
}
