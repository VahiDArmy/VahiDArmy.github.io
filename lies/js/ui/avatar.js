/* ============================================================
   js/ui/avatar.js
   Avatar with initials, color, status ring, group stack
   ============================================================ */

import { el } from '../utils/dom.js';
import { initials } from '../utils/format.js';
import { colorFromString } from '../utils/id.js';

/**
 * @param {{
 *   name: string,
 *   color?: string,
 *   size?: 'xs'|'sm'|'md'|'lg'|'xl',
 *   src?: string,
 *   ring?: boolean,
 *   status?: 'online'|'offline'|'busy'|null,
 *   title?: string,
 * }} opts
 * @returns {HTMLElement}
 */
export function avatar(opts) {
  const {
    name = '؟', color, size = 'md', src, ring = false, status = null, title,
  } = opts;

  const bg = color || colorFromString(name);
  const wrap = el('span', {
    class: ['avatar', `avatar--${size}`, ring ? 'avatar--ring' : ''].filter(Boolean),
    attrs: { title: title || name, 'aria-label': name },
  });
  wrap.style.setProperty('--avatar-color', bg);

  if (src) {
    const img = el('img', {
      class: 'avatar__img',
      attrs: { src, alt: name, loading: 'lazy' },
    });
    img.addEventListener('error', () => { img.remove(); wrap.textContent = initials(name); });
    wrap.appendChild(img);
  } else {
    wrap.appendChild(el('span', { class: 'avatar__initials' }, { children: [initials(name)] }));
  }

  if (status) {
    wrap.appendChild(el('span', { class: ['avatar__status', `avatar__status--${status}`].join(' ') }));
  }

  return wrap;
}

/**
 * Render a stack of avatars (max visible) with overflow indicator.
 * @param {Array<{name:string, color?:string, src?:string}>} list
 * @param {{size?:string, max?:number}} [opts]
 * @returns {HTMLElement}
 */
export function avatarGroup(list = [], opts = {}) {
  const { size = 'sm', max = 4 } = opts;
  const wrap = el('div', { class: 'avatar-group' });
  const visible = list.slice(0, max);
  for (const a of visible) {
    wrap.appendChild(avatar({ ...a, size, ring: true }));
  }
  if (list.length > max) {
    wrap.appendChild(el('span', { class: ['avatar', `avatar--${size}`, 'avatar--more'] }, {
      children: [`+${list.length - max}`],
    }));
  }
  return wrap;
}

export default { avatar, avatarGroup };