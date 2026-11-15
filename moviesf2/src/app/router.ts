/** Hash router. Every view is addressable, and reloading keeps your place. */

import { useSyncExternalStore } from 'react';
import type { RouteId, RouteState } from '../types';

const ROUTES: RouteId[] = [
  'dashboard',
  'library',
  'title',
  'collections',
  'ratings',
  'watchlist',
  'sessions',
  'people',
  'quotes',
  'constellation',
  'goals',
  'challenges',
  'events',
  'awards',
  'prompts',
  'studio',
  'arena',
  'usage',
  'shares',
  'imports',
  'notes',
  'data',
  'settings',
];

function parse(hash: string): RouteState {
  const clean = hash.replace(/^#\/?/, '');
  const [path, query] = clean.split('?');
  const [name, param] = path.split('/');
  const id = (ROUTES.includes(name as RouteId) ? name : 'dashboard') as RouteId;
  return { id, param: param ? decodeURIComponent(param) : undefined, query };
}

let current: RouteState = typeof window !== 'undefined' ? parse(window.location.hash) : { id: 'dashboard' };
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    current = parse(window.location.hash);
    for (const listener of listeners) listener();
  });
}

export function getRoute(): RouteState {
  return current;
}

export function useRoute(): RouteState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getRoute,
    getRoute,
  );
}

export function navigate(id: RouteId, param?: string, query?: string): void {
  const path = `#/${id}${param ? `/${encodeURIComponent(param)}` : ''}${query ? `?${query}` : ''}`;
  if (window.location.hash === path) {
    current = parse(path);
    for (const listener of listeners) listener();
    return;
  }
  window.location.hash = path;
}

export function routeQuery(route: RouteState): URLSearchParams {
  return new URLSearchParams(route.query || '');
}
