// Rich tooltip system — attach to any element via data-tip or `tooltip()`.

let host = null;
let currentNode = null;
let hideTimer = null;
let showTimer = null;

function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.className = 'tip-host';
  host.setAttribute('role', 'tooltip');
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '0';
  host.style.zIndex = '1000';
  host.style.pointerEvents = 'none';
  host.style.opacity = '0';
  host.style.transition = 'opacity 120ms ease, transform 120ms ease';
  host.style.transform = 'translateY(4px)';
  host.style.padding = '6px 10px';
  host.style.borderRadius = '6px';
  host.style.border = '1px solid var(--line-2)';
  host.style.background = 'var(--surface-3)';
  host.style.color = 'var(--ink)';
  host.style.fontSize = '11px';
  host.style.lineHeight = '1.4';
  host.style.boxShadow = 'var(--shadow-2)';
  host.style.maxWidth = '280px';
  host.style.whiteSpace = 'normal';
  host.style.fontFamily = 'var(--font-ui)';
  document.body.appendChild(host);
  return host;
}

export function initTooltips() {
  document.addEventListener('mouseover', (event) => {
    const target = event.target.closest('[data-tip]');
    if (!target) return;
    if (target === currentNode) return;
    schedule(target);
  });

  document.addEventListener('mouseout', (event) => {
    const target = event.target.closest('[data-tip]');
    if (!target) return;
    const related = event.relatedTarget;
    if (related && target.contains(related)) return;
    if (target === currentNode) {
      hide();
    }
  });

  document.addEventListener('focusin', (event) => {
    const target = event.target.closest('[data-tip]');
    if (target) schedule(target);
  });

  document.addEventListener('focusout', (event) => {
    const target = event.target.closest('[data-tip]');
    if (target && target === currentNode) hide();
  });

  window.addEventListener('scroll', () => { if (currentNode) hide(); }, { passive: true });
}

function schedule(target) {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  showTimer = setTimeout(() => show(target), 220);
}

function show(target) {
  if (!target) return;
  const text = target.getAttribute('data-tip');
  if (!text) return;
  const node = ensureHost();
  node.textContent = text;
  node.style.opacity = '1';
  node.style.transform = 'translateY(0)';

  const rect = target.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // measure after content is set
  const size = node.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - size.width / 2;
  let top = rect.top - size.height - 8;
  let placement = 'top';

  if (top < 8) {
    top = rect.bottom + 8;
    placement = 'bottom';
  }
  if (left < 8) left = 8;
  if (left + size.width > vw - 8) left = vw - size.width - 8;
  if (top + size.height > vh - 8) top = Math.max(8, vh - size.height - 8);

  node.style.left = Math.round(left) + 'px';
  node.style.top = Math.round(top) + 'px';
  node.dataset.placement = placement;
  node.setAttribute('aria-hidden', 'false');

  currentNode = target;
  target.setAttribute('aria-describedby', node.id || '');
}

function hide() {
  clearTimeout(showTimer);
  hideTimer = setTimeout(() => {
    if (!host) return;
    host.style.opacity = '0';
    host.style.transform = 'translateY(4px)';
    host.setAttribute('aria-hidden', 'true');
    currentNode = null;
  }, 40);
}

export function tooltip(node, text) {
  if (!node) return;
  if (text === undefined || text === null) {
    node.removeAttribute('data-tip');
  } else {
    node.setAttribute('data-tip', text);
  }
}
