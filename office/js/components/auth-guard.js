/**
 * Auth guard — used by pages that require a signed-in user.
 * Returns the session or redirects to /login with a `next` param.
 *
 *   const session = await requireAuthOrRedirect();
 *   if (!session) return; // caller should abort render
 */

import { auth } from '../core/auth.js';
import { appStore } from '../core/store.js';
import { router } from '../core/router.js';
import { ROUTES } from '../config/constants.js';
import { toast } from '../ui/toast.js';

export async function requireAuthOrRedirect() {
  // Wait for auth boot if needed
  if (!appStore.get('isAuthReady')) {
    await waitForAuthReady();
  }
  if (auth.isSignedIn()) return appStore.get('session');

  const current = router.getCurrent()?.path || '/';
  const next = encodeURIComponent(current);
  toast.warning('برای دسترسی به این بخش باید وارد شوید.');
  router.navigate(`${ROUTES.LOGIN}?next=${next}`, { replace: true });
  return null;
}

export function isAdmin() {
  const profile = appStore.get('profile');
  return profile?.role === 'admin';
}

export function canEditContent() {
  const profile = appStore.get('profile');
  return profile?.role === 'admin' || profile?.role === 'editor' || profile?.role === 'contributor';
}

function waitForAuthReady(timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (appStore.get('isAuthReady')) return resolve();
    const off = appStore.subscribe((_, keys) => {
      if (keys.includes('isAuthReady')) {
        off?.();
        resolve();
      }
    });
    setTimeout(() => { off?.(); resolve(); }, timeoutMs);
  });
}

export default requireAuthOrRedirect;