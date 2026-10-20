/**
 * Loading helpers — inline skeletons and overlays.
 * Used by list/detail pages while data is being fetched.
 */

import { el } from '../utils/dom.js';

export function skeletonList({ count = 4, variant = 'card' } = {}) {
  const wrap = el('div', {
    class: variant === 'row' ? 'theory-list' : 'people-grid',
    'aria-hidden': 'true',
  });
  for (let i = 0; i < count; i++) {
    if (variant === 'row') {
      wrap.appendChild(
        el('div', {
          class: 'skeleton skeleton--block',
          style: { height: '96px', borderRadius: 'var(--radius-lg)' },
        })
      );
    } else {
      wrap.appendChild(
        el('div', {
          class: 'skeleton skeleton--block',
          style: { height: '150px', borderRadius: 'var(--radius-lg)' },
        })
      );
    }
  }
  return wrap;
}

export function overlay(message = 'در حال بارگذاری...') {
  return el(
    'div',
    {
      class: 'loading-overlay',
      style: {
        position: 'fixed',
        inset: '0',
        zIndex: 'var(--z-overlay)',
        background: 'rgba(0,0,0,0.15)',
        backdropFilter: 'blur(2px)',
        display: 'grid',
        placeItems: 'center',
      },
    },
    [
      el(
        'div',
        {
          style: {
            padding: 'var(--space-4) var(--space-5)',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
          },
        },
        [
          el('span', {
            class: 'anim-spin',
            style: {
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: '2px solid var(--border-default)',
              borderTopColor: 'var(--accent)',
            },
          }),
          el('span', {}, [message]),
        ]
      ),
    ]
  );
}

export function withOverlay(node, message) {
  const overlayNode = overlay(message);
  document.body.appendChild(overlayNode);
  return () => {
    overlayNode.remove();
    return node;
  };
}