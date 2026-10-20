/**
 * Theme toggle button (icon-only). Reflects current theme.
 * Emits a subtle rotate animation on click.
 */

import { el, icon } from '../utils/dom.js';
import { theme as themeCore } from '../core/theme.js';
import { bus } from '../utils/events.js';

export function createThemeToggle({ variant = 'icon' } = {}) {
  const btn = el(
    'button',
    {
      type: 'button',
      class: 'icon-btn theme-toggle',
      'aria-label': 'تغییر تم',
      title: 'تغییر تم',
      on: {
        click: () => {
          const next = themeCore.toggle();
          update(next);
          bus.emit('theme:toggled', next);
        },
      },
    },
    [icon('moon')]
  );

  function update(current) {
    btn.innerHTML = '';
    btn.appendChild(icon(current === 'dark' ? 'sun' : 'moon'));
    btn.setAttribute('aria-pressed', current === 'dark' ? 'true' : 'false');
    btn.setAttribute('data-theme-current', current);
  }

  update(themeCore.get());

  // Follow external theme changes
  bus.on('theme:toggled', (t) => update(t));

  return btn;
}

export default createThemeToggle;