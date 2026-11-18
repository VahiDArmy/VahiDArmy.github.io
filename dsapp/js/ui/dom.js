export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'value') {
      // These are properties, not attributes. setAttribute('checked', false) would
      // still mark a checkbox as checked, because attribute presence is what counts.
      node[k] = v;
    }
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function qs(sel, root = document) { return root.querySelector(sel); }
export function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function timeAgo(iso) {
  const d = typeof iso === 'number' ? iso : Date.parse(iso);
  const diff = Date.now() - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function statusBadge(status) {
  const map = {
    pending: 'badge-pending',
    in_progress: 'badge-progress',
    running: 'badge-progress',
    completed: 'badge-done',
    success: 'badge-done',
    blocked: 'badge-blocked',
    failed: 'badge-failed',
    error: 'badge-failed',
    interrupted: 'badge-blocked',
  };
  return el('span', { class: `badge ${map[status] || 'badge-pending'}` }, status);
}
