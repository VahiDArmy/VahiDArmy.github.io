/**
 * UI Helpers (Toast, Escape HTML, Theme, Modal)
 */

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function showToast(msg, type = 'success') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

export function initTheme() {
  const saved = localStorage.getItem('madacto-theme');
  const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', saved || sys);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('madacto-theme', next);
}

// Simple Modal System for Manual Entry & Preview
export function openModal({ title, content, actions }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body" id="modal-body"></div>
        <div class="modal-footer" id="modal-footer"></div>
      </div>
    </div>
  `;
  
  document.getElementById('modal-body').appendChild(content);
  
  const footer = document.getElementById('modal-footer');
  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = `btn ${action.primary ? 'btn--primary' : 'btn--secondary'}`;
    btn.textContent = action.label;
    btn.onclick = action.onClick;
    footer.appendChild(btn);
  });

  const close = () => { root.innerHTML = ''; };
  document.getElementById('modal-close-btn').onclick = close;
  
  return { close };
}