// PWA registration — installable app + offline support.

import { toast, toastOk, toastWarn } from './toast.js';

let deferredPrompt = null;

export function initPwa() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: '../' })
    .then((reg) => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            toastOk('Update available — reload to apply');
          }
        });
      });
    })
    .catch((err) => {
      console.warn('[pwa] service worker registration failed', err);
    });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    toastOk('Installed to your device');
  });
}

function showInstallButton() {
  if (document.getElementById('install-btn')) return;
  const host = document.querySelector('.sidebar-foot');
  if (!host) return;
  const btn = document.createElement('button');
  btn.id = 'install-btn';
  btn.className = 'icon-btn';
  btn.type = 'button';
  btn.title = 'Install app';
  btn.setAttribute('aria-label', 'Install app');
  btn.innerHTML = '⇩';
  btn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      toastWarn('Install prompt unavailable');
      return;
    }
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      toastOk('Installing…');
    } else {
      toast('Install dismissed');
    }
    deferredPrompt = null;
    btn.remove();
  });
  host.appendChild(btn);
}
