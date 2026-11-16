/* ============================================================
   FAB — floating action button, mobile only
   Shows on small screens where header add button is hidden
   ============================================================ */
import { el } from '../utils.js';
import { icon } from './icons.js';
import { openPurchaseModal } from './purchase-modal.js';

export function mountFab() {
  const fab = el('button', {
    type: 'button',
    class: 'fab',
    'aria-label': 'ثبت خرید جدید',
    onclick: async () => {
      try {
        await openPurchaseModal({ mode: 'create' });
      } catch (err) {
        console.error('[fab] open failed:', err);
      }
    },
  }, [
    el('span', { class: 'fab__icon', html: icon('plus', 24) }),
    el('span', { class: 'fab__label', text: 'ثبت خرید' }),
  ]);

  injectStyles();
  return fab;
}

function injectStyles() {
  if (document.getElementById('fab-styles')) return;
  const s = document.createElement('style');
  s.id = 'fab-styles';
  s.textContent = `
    .fab {
      position: fixed;
      bottom: 24px;
      inset-inline-start: 24px;
      z-index: 350;
      display: none;
      align-items: center;
      gap: 8px;
      height: 52px;
      padding: 0 20px 0 16px;
      border-radius: 999px;
      background: var(--brand-grad);
      color: white;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.01em;
      border: 0;
      cursor: pointer;
      box-shadow:
        0 12px 32px rgba(139, 92, 246, 0.45),
        0 2px 8px rgba(0, 0, 0, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.25);
      transition:
        transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 220ms;
      animation: fab-in 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    .fab:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow:
        0 16px 40px rgba(139, 92, 246, 0.55),
        0 4px 12px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
    }
    .fab:active {
      transform: translateY(0) scale(0.97);
    }
    .fab__icon {
      display: grid;
      place-items: center;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }
    .fab__icon svg { display: block; }
    .fab__label {
      display: inline-block;
    }

    @keyframes fab-in {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.85);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Show only on mobile — hidden by default above */
    @media (max-width: 720px) {
      .fab { display: inline-flex; }
    }

    /* Compact on very small screens */
    @media (max-width: 380px) {
      .fab {
        padding: 0 16px;
        height: 48px;
        font-size: 13px;
      }
    }

    /* Respect reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .fab { animation: none; transition: none; }
      .fab:hover { transform: none; }
    }

    /* Hide when a modal/drawer is open to avoid overlap */
    body.has-modal .fab {
      opacity: 0;
      pointer-events: none;
      transform: translateY(10px) scale(0.9);
      transition: all 200ms;
    }
  `;
  document.head.appendChild(s);
}
