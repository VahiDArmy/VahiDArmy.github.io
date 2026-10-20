/**
 * Post-boot extras — wire optional UI features that aren't needed for first
 * paint but complete the app experience:
 *   - Global command palette (Ctrl+K)
 *   - Shortcuts help (Shift+?)
 *   - Scroll-to-top button
 *   - Offline detector
 *   - Navigation shortcuts (g+h, g+p, g+t)
 */

import { registerShortcut } from './keyboard.js';
import { openCommandPalette } from '../ui/command-palette.js';
import { openShortcutsHelp } from '../ui/shortcuts-help.js';
import { installScrollTop } from '../components/scroll-top.js';
import { installOfflineDetector } from '../utils/offline.js';
import { router } from './router.js';
import { ROUTES } from '../config/constants.js';
import { appStore } from './store.js';
import { bus } from '../utils/events.js';
import { theme } from './theme.js';

export function installExtras() {
  installOfflineDetector();
  installScrollTop();

  /* Command palette */
  registerShortcut({
    keys: 'Ctrl+K',
    label: 'جستجوی سراسری',
    handler: () => {
      openCommandPalette({ actions: buildActions() });
    },
  });

  /* Shortcuts help */
  registerShortcut({
    keys: 'Shift+?',
    label: 'راهنمای میانبرها',
    handler: () => openShortcutsHelp(),
  });

  /* Navigation via g+key sequence */
  let pendingG = false;
  let pendingGTimer = null;

  registerShortcut({
    keys: 'g',
    label: 'رفتن به...',
    allowInInput: false,
    handler: () => {
      pendingG = true;
      clearTimeout(pendingGTimer);
      pendingGTimer = setTimeout(() => {
        pendingG = false;
      }, 900);
    },
  });

  registerShortcut({
    keys: 'h',
    label: 'خانه',
    handler: () => {
      if (!pendingG) return;
      pendingG = false;
      router.navigate(ROUTES.HOME);
    },
  });

  registerShortcut({
    keys: 'p',
    label: 'افراد',
    handler: () => {
      if (!pendingG) return;
      pendingG = false;
      router.navigate(ROUTES.PEOPLE);
    },
  });

  registerShortcut({
    keys: 't',
    label: 'نظریه‌ها',
    handler: () => {
      if (!pendingG) return;
      pendingG = false;
      router.navigate(ROUTES.THEORIES);
    },
  });

  /* Keep theme in sync when changed outside of theme core */
  appStore.subscribe((state, keys) => {
    if (keys.includes('theme')) {
      document.documentElement.setAttribute('data-theme', state.theme);
    }
  });

  bus.emit('extras:installed');
}

function buildActions() {
  const actions = [
    { section: 'رفتن به', label: 'خانه', icon: 'home', keywords: 'home khane', onClick: () => router.navigate(ROUTES.HOME) },
    { label: 'افراد', icon: 'users', keywords: 'people afrad', onClick: () => router.navigate(ROUTES.PEOPLE) },
    { label: 'نظریه‌ها', icon: 'lightbulb', keywords: 'theories nazarie', onClick: () => router.navigate(ROUTES.THEORIES) },
    { label: 'رتبه‌بندی‌ها', icon: 'trophy', keywords: 'rankings ranking', onClick: () => router.navigate(ROUTES.RANKINGS) },
    { label: 'جدول‌ها', icon: 'table', keywords: 'tables jadval', onClick: () => router.navigate(ROUTES.TABLES) },
    { label: 'پروفایل من', icon: 'user', keywords: 'profile', onClick: () => router.navigate(ROUTES.PROFILE) },
    { label: 'تنظیمات', icon: 'settings', keywords: 'settings tanzimat', onClick: () => router.navigate('/settings') },
  ];

  const user = appStore.get('user');
  if (user) {
    actions.push(
      { section: 'ایجاد', label: 'نظریه جدید', icon: 'plus', onClick: () => router.navigate('/theories/new') },
      { label: 'رتبه‌بندی جدید', icon: 'plus', onClick: () => router.navigate('/rankings/new') },
      { label: 'جدول جدید', icon: 'plus', onClick: () => router.navigate('/tables/new') }
    );
  } else {
    actions.push({ section: 'حساب', label: 'ورود', icon: 'log-in', onClick: () => router.navigate(ROUTES.LOGIN) });
    actions.push({ label: 'ثبت‌نام', icon: 'user', onClick: () => router.navigate(ROUTES.SIGNUP) });
  }

  actions.push(
    { section: 'ظاهر', label: 'تغییر تم (روشن/تیره)', icon: 'moon', onClick: () => theme.toggle() },
    { label: 'راهنمای میانبرها', icon: 'command', onClick: () => openShortcutsHelp() }
  );

  return actions;
}