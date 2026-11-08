// Global search field wiring.

import { State, setUI, subscribe } from '../core/state.js';
import { navigate } from './router.js';

export function initSearch() {
  const input = document.getElementById('global-search');
  if (!input) return;

  input.addEventListener('input', () => {
    setUI({ search: input.value });
    if (State.ui.activeView !== 'files') {
      navigate('files');
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      input.blur();
      setUI({ search: '' });
    }
  });

  subscribe((type) => {
    if (type === 'route' && State.ui.activeView !== 'files') {
      // keep the search value but do not force navigation
    }
  });
}
