/**
 * Offline detection — displays a fixed banner while offline and fires
 * events on the bus for interested modules.
 */

import { el } from './dom.js';
import { bus } from './events.js';

let bannerNode = null;
let installed = false;

function showBanner() {
  if (bannerNode && document.body.contains(bannerNode)) return;
  bannerNode = el('div', { class: 'offline-banner', role: 'status', 'aria-live': 'polite' }, [
    el('span', { class: 'offline-banner__dot' }),
    el('span', {}, ['شما آفلاین هستید — برخی امکانات در دسترس نیست.']),
  ]);
  document.body.appendChild(bannerNode);
}

function hideBanner() {
  if (!bannerNode) return;
  bannerNode.remove();
  bannerNode = null;
}

export function isOnline() {
  return navigator.onLine !== false;
}

export function installOfflineDetector() {
  if (installed) return;
  installed = true;

  const onOffline = () => {
    showBanner();
    bus.emit('offline');
  };
  const onOnline = () => {
    hideBanner();
    bus.emit('online');
  };

  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);

  if (!isOnline()) showBanner();
}