/**
 * Shortcut help dialog — a modal listing all registered shortcuts.
 * Opened by Shift+? or from settings.
 */

import { open as openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { listShortcuts, CANONICAL_SHORTCUTS } from '../core/keyboard.js';

export function openShortcutsHelp() {
  const registered = listShortcuts();
  const extra = registered.filter(
    (s) => !CANONICAL_SHORTCUTS.some((c) => c.keys === s.keys)
  );
  const all = [...CANONICAL_SHORTCUTS, ...extra];

  const body = el('div', { class: 'shortcut-list' },
    all.map((s) =>
      el('div', { class: 'shortcut-row' }, [
        el('span', { class: 'shortcut-row__label' }, [s.label || '—']),
        el(
          'span',
          { class: 'shortcut-row__keys' },
          String(s.keys)
            .split(/\s*\+\s*|\s*سپس\s*/)
            .filter(Boolean)
            .flatMap((part, i, arr) => {
              const kbd = el('kbd', {}, [part]);
              return i < arr.length - 1 ? [kbd, el('span', { style: { color: 'var(--text-tertiary)' } }, ['+'])] : [kbd];
            })
        ),
      ])
    )
  );

  openModal({
    title: 'میانبرهای صفحه‌کلید',
    subtitle: 'برای دسترسی سریع از این ترکیب‌ها استفاده کنید.',
    body,
    size: 'sm',
  });
}