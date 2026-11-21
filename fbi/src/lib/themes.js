// Theme catalog — names map 1:1 to [data-theme] blocks in base.css.
export const THEMES = [
  { id: 'nebula', name: 'Nebula', colors: ['#8b5cf6', '#2dd4ee', '#f472b6'], dark: true },
  { id: 'aurora', name: 'Aurora', colors: ['#2dd4bf', '#a3e635', '#38bdf8'], dark: true },
  { id: 'ember', name: 'Ember', colors: ['#fb923c', '#f43f5e', '#facc15'], dark: true },
  { id: 'crimson', name: 'Crimson', colors: ['#f472b6', '#fb7185', '#c084fc'], dark: true },
  { id: 'matrix', name: 'Matrix', colors: ['#4ade80', '#a3e635', '#22d3ee'], dark: true },
  { id: 'frost', name: 'Frost', colors: ['#38bdf8', '#a5b4fc', '#5eead4'], dark: true },
  { id: 'daylight', name: 'Daylight', colors: ['#6d28d9', '#0ea5e9', '#db2777'], dark: false },
  { id: 'parchment', name: 'Parchment', colors: ['#b45309', '#92400e', '#be185d'], dark: false },
];

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function applyTheme(id) {
  const theme = getTheme(id);
  document.documentElement.setAttribute('data-theme', theme.id);
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute('content', theme.dark ? 'dark light' : 'light dark');
  return theme;
}
