import { Sound } from './sound.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

export function scoreColor(v) {
  if (v === null || v === undefined) return 'transparent';
  if (v === 0) return 'rgba(255,255,255,0.04)';
  const intensity = Math.min(Math.abs(v) / 10, 1);
  const alpha = 0.10 + intensity * 0.62;
  const hue = v > 0 ? 150 : 350;
  return `hsla(${hue}, 85%, 55%, ${alpha})`;
}

export function avatarHtml(p, size = 32) {
  if (!p) return '';
  if (p.avatar_url) {
    return `<img class="avatar" src="${esc(p.avatar_url)}" style="width:${size}px;height:${size}px" alt="">`;
  }
  const initials = (p.full_name || '?').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  return `<div class="avatar avatar-fallback" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px">${esc(initials)}</div>`;
}

export function toast(msg, type = 'info', ms = 3000) {
  const root = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success' ? 'circle-check' : type === 'error' ? 'circle-exclamation' : 'circle-info';
  t.innerHTML = `<i class="fa-solid fa-${icon}"></i><span>${esc(msg)}</span>`;
  root.appendChild(t);
  if (type === 'success') Sound.success();
  else if (type === 'error') Sound.error();
  else Sound.tap();
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

export function openModal({ title, subtitle = '', content, actions = [] }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-title">${esc(title)}</div>
    ${subtitle ? `<div class="modal-sub">${esc(subtitle)}</div>` : ''}
    <div class="modal-body"></div>
    <div class="modal-actions"></div>
  `;
  const body = modal.querySelector('.modal-body');
  if (typeof content === 'string') body.innerHTML = content;
  else if (content) body.appendChild(content);

  const acts = modal.querySelector('.modal-actions');
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = `btn ${a.className || 'btn-ghost'}`;
    btn.textContent = a.label;
    btn.onclick = () => {
      Sound.tap();
      const keep = a.onClick ? a.onClick(body, modal) : false;
      if (keep !== false) close();
    };
    acts.appendChild(btn);
  });

  function close() { root.classList.remove('on'); root.innerHTML = ''; }
  root.classList.add('on');
  root.onclick = e => { if (e.target === root) close(); };
  const esc = e => { if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(); } };
  document.addEventListener('keydown', esc);
  return { close, body, modal };
}

export function confirmDialog(title, subtitle) {
  return new Promise(resolve => {
    openModal({
      title, subtitle,
      actions: [
        { label: 'Cancel', onClick: () => { resolve(false); return true; } },
        { label: 'Confirm', className: 'btn-danger', onClick: () => { resolve(true); return true; } }
      ]
    });
  });
}

export function openScoreEditor(anchor, current, onSave, onClear) {
  document.querySelectorAll('.score-pop').forEach(n => n.remove());
  const pop = document.createElement('div');
  pop.className = 'score-pop';
  const val = current ?? 0;
  pop.innerHTML = `
    <div class="score-pop-val" data-val>${current === null ? '—' : current}</div>
    <input type="range" min="-10" max="10" step="1" value="${val}">
    <div class="score-pop-actions">
      <button data-act="clear">Clear</button>
      <button data-act="save">Save</button>
    </div>
  `;
  document.body.appendChild(pop);

  const rect = anchor.getBoundingClientRect();
  const popW = 230, popH = 180;
  let left = rect.left + rect.width / 2 - popW / 2;
  let top = rect.bottom + 8;
  if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
  if (left < 8) left = 8;
  if (top + popH > window.innerHeight - 8) top = rect.top - popH - 8;
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;

  const range = pop.querySelector('input');
  const display = pop.querySelector('[data-val]');
  const render = v => {
    display.textContent = v;
    if (v > 0) display.style.background = 'linear-gradient(135deg,#4ade80,#22d3ee)';
    else if (v < 0) display.style.background = 'linear-gradient(135deg,#f43f5e,#ec4899)';
    else display.style.background = 'linear-gradient(135deg,#888,#555)';
    display.style.webkitBackgroundClip = 'text';
    display.style.backgroundClip = 'text';
    display.style.color = 'transparent';
  };
  render(val);
  range.oninput = () => { render(Number(range.value)); Sound.tap(); };

  pop.querySelector('[data-act=save]').onclick = async () => {
    pop.remove();
    await onSave(Number(range.value));
  };
  pop.querySelector('[data-act=clear]').onclick = async () => {
    pop.remove();
    await onClear();
  };

  setTimeout(() => {
    const closer = e => {
      if (!pop.contains(e.target)) {
        pop.remove();
        document.removeEventListener('mousedown', closer);
      }
    };
    document.addEventListener('mousedown', closer);
  }, 0);
}
