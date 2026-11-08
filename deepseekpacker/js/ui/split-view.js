// Draggable split panes — used by the diff view and future layouts.

export function createSplit(options = {}) {
  const {
    left = document.createElement('div'),
    right = document.createElement('div'),
    initial = 50,
    min = 20,
    max = 80,
    direction = 'horizontal',
  } = options;

  const root = document.createElement('div');
  root.className = 'split-view split-' + direction;
  Object.assign(root.style, {
    display: 'grid',
    gap: '0',
    position: 'relative',
    minHeight: '0',
    minWidth: '0',
  });

  const divider = document.createElement('div');
  divider.className = 'split-divider';
  Object.assign(divider.style, {
    position: 'relative',
    cursor: direction === 'horizontal' ? 'col-resize' : 'row-resize',
    userSelect: 'none',
    touchAction: 'none',
  });

  let ratio = clamp(initial, min, max);
  let dragging = false;

  function applyRatio(r) {
    ratio = clamp(r, min, max);
    const tpl = direction === 'horizontal'
      ? ratio + '% 6px 1fr'
      : '1fr 6px ' + ratio + '%';
    root.style.gridTemplateColumns = direction === 'horizontal' ? tpl : '';
    root.style.gridTemplateRows = direction === 'vertical' ? tpl.replace('1fr 6px ', '') : '';
    if (direction === 'vertical') {
      root.style.gridTemplateRows = (100 - ratio) + '% 6px ' + ratio + '%';
      root.style.gridTemplateColumns = '';
    }
    if (typeof options.onChange === 'function') options.onChange(ratio);
  }

  function onDown(e) {
    dragging = true;
    divider.setPointerCapture && divider.setPointerCapture(e.pointerId);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging) return;
    const rect = root.getBoundingClientRect();
    let pos;
    if (direction === 'horizontal') {
      pos = ((e.clientX - rect.left) / rect.width) * 100;
    } else {
      pos = ((e.clientY - rect.top) / rect.height) * 100;
    }
    applyRatio(pos);
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  divider.addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);

  divider.style.background = 'var(--line)';
  divider.addEventListener('mouseenter', () => { divider.style.background = 'var(--accent)'; });
  divider.addEventListener('mouseleave', () => { if (!dragging) divider.style.background = 'var(--line)'; });

  root.appendChild(left);
  root.appendChild(divider);
  root.appendChild(right);
  applyRatio(initial);

  root.setRatio = (r) => applyRatio(r);
  root.getRatio = () => ratio;
  root.destroy = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    if (root.parentNode) root.parentNode.removeChild(root);
  };

  return root;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
