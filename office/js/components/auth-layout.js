/**
 * Shared chrome for auth pages (login, signup, forgot, reset, callback).
 * Keeps branding consistent across all four forms.
 */

import { el } from '../utils/dom.js';

export function authLayout({ title, subtitle, children, footer, alert } = {}) {
  const brandBlock = el('div', { class: 'auth-card__brand' }, [
    el('span', { class: 'auth-card__logo' }, ['O']),
    el(
      'span',
      { style: { fontWeight: 'var(--fw-bold)', fontSize: 'var(--text-md)' } },
      ['The Office']
    ),
  ]);

  const heading = el(
    'div',
    {
      style: {
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      },
    },
    [
      el('h1', { class: 'auth-card__title' }, [title || '']),
      subtitle ? el('p', { class: 'auth-card__subtitle' }, [subtitle]) : null,
    ]
  );

  const alertNode = alert ? buildAlert(alert) : null;

  const footerNode = footer
    ? el('div', { class: 'auth-card__footer' }, Array.isArray(footer) ? footer : [footer])
    : null;

  const card = el('div', { class: 'auth-card' }, [
    brandBlock,
    heading,
    alertNode,
    children,
    footerNode,
  ]);

  return el('div', { class: 'auth-page' }, [card]);
}

function buildAlert({ type = 'info', message }) {
  return el(
    'div',
    {
      class: `auth-card__alert auth-card__alert--${type}`,
      role: type === 'error' ? 'alert' : 'status',
    },
    [message]
  );
}

export default authLayout;