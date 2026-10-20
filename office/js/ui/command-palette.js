/**
 * Command palette (Ctrl+K) — fuzzy search across app actions + navigation.
 *
 *   openCommandPalette({ actions: [ { label, icon, onClick, keywords } ] });
 */

import { el, icon, lockBodyScroll, unlockBodyScroll } from '../utils/dom.js';

let paletteNode = null;
let backdropNode = null;
let cleanupFns = [];

function close() {
  if (backdropNode) backdropNode.remove();
  if (paletteNode) paletteNode.remove();
  backdropNode = null;
  paletteNode = null;
  for (const fn of cleanupFns) fn();
  cleanupFns = [];
  unlockBodyScroll();
}

function fuzzyMatch(query, text) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return true;
  const t = String(text || '').toLowerCase();
  // Simple substring first
  if (t.includes(q)) return true;
  // Subsequence check
  let i = 0;
  for (const c of t) {
    if (c === q[i]) i++;
    if (i === q.length) return true;
  }
  return false;
}

/**
 * @param {Object} opts
 * @param {Array<{ label:string, keywords?:string, icon?:string, section?:string, onClick:Function }>} opts.actions
 */
export function openCommandPalette({ actions = [] } = {}) {
  close();

  const input = el('input', {
    type: 'text',
    class: 'input',
    placeholder: 'جستجوی فرمان یا مسیر...',
    autocomplete: 'off',
    spellcheck: 'false',
  });

  const list = el('div', {
    style: {
      maxHeight: '340px',
      overflowY: 'auto',
      padding: 'var(--space-2)',
    },
  });

  paletteNode = el(
    'div',
    {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'پالت فرمان',
      style: {
        width: '100%',
        maxWidth: '560px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden',
        animation: 'pop-in var(--dur-slow) var(--ease-spring) both',
      },
    },
    [
      el(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            borderBlockEnd: '1px solid var(--border-subtle)',
          },
        },
        [
          el('span', { style: { color: 'var(--text-tertiary)' } }, [icon('search')]),
          input,
          el('kbd', {}, ['Esc']),
        ]
      ),
      list,
    ]
  );

  backdropNode = el(
    'div',
    {
      style: {
        position: 'fixed',
        inset: '0',
        background: 'var(--bg-overlay)',
        backdropFilter: 'blur(4px)',
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingBlockStart: '12vh',
        paddingInline: 'var(--space-4)',
        animation: 'fade-in var(--dur-base) var(--ease-out) both',
      },
      on: {
        mousedown: (e) => {
          if (e.target === backdropNode) close();
        },
      },
    },
    [paletteNode]
  );

  document.body.appendChild(backdropNode);
  lockBodyScroll();

  let activeIndex = 0;
  let filtered = [];

  function render() {
    list.innerHTML = '';
    filtered = actions.filter((a) => fuzzyMatch(input.value, `${a.label} ${a.keywords || ''}`));

    if (!filtered.length) {
      list.appendChild(
        el(
          'div',
          {
            style: {
              padding: 'var(--space-8) var(--space-4)',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--text-sm)',
            },
          },
          ['نتیجه‌ای پیدا نشد.']
        )
      );
      return;
    }

    let lastSection = null;
    filtered.forEach((action, idx) => {
      if (action.section && action.section !== lastSection) {
        lastSection = action.section;
        list.appendChild(
          el(
            'div',
            {
              style: {
                padding: 'var(--space-2) var(--space-3) var(--space-1)',
                fontSize: 'var(--text-2xs)',
                fontWeight: 'var(--fw-semibold)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
              },
            },
            [action.section]
          )
        );
      }

      const isActive = idx === activeIndex;
      const item = el(
        'button',
        {
          type: 'button',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            width: '100%',
            padding: 'var(--space-2-5) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            background: isActive ? 'var(--accent-soft)' : 'transparent',
            color: isActive ? 'var(--accent)' : 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            textAlign: 'start',
            cursor: 'pointer',
            transition: 'background var(--dur-fast) var(--ease-out)',
          },
          on: {
            mouseenter: () => {
              activeIndex = idx;
              render();
            },
            click: () => {
              close();
              try { action.onClick(); } catch (err) { console.error(err); }
            },
          },
        },
        [
          action.icon ? el('span', { style: { width: '16px', height: '16px', flex: 'none' } }, [icon(action.icon)]) : null,
          el('span', { style: { flex: '1 1 auto' } }, [action.label]),
          isActive ? el('span', { style: { fontSize: 'var(--text-2xs)', opacity: '0.7' } }, ['↵']) : null,
        ]
      );
      list.appendChild(item);
    });
  }

  render();

  const onInput = () => {
    activeIndex = 0;
    render();
  };
  input.addEventListener('input', onInput);

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!filtered.length) return;
      activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!filtered.length) return;
      activeIndex = Math.max(activeIndex - 1, 0);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const action = filtered[activeIndex];
      if (action) {
        close();
        try { action.onClick(); } catch (err) { console.error(err); }
      }
    }
  };
  document.addEventListener('keydown', onKey, true);
  cleanupFns.push(() => document.removeEventListener('keydown', onKey, true));

  requestAnimationFrame(() => input.focus());

  return { close };
}

export const commandPalette = { open: openCommandPalette };
export default openCommandPalette;