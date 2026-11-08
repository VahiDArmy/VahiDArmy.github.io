// Activity heatmap — GitHub-style contribution calendar.

import { el } from '../utils/dom.js';

export function createHeatmap(options = {}) {
  const weeks = options.weeks || 16;
  const data = options.data || []; // array of { date: 'YYYY-MM-DD', value: number }
  const title = options.title || 'Activity';
  const onDayClick = options.onDayClick || null;

  const root = el('div', { class: 'heatmap-wrap', style: { display: 'flex', flexDirection: 'column', gap: '10px' } });

  if (title) {
    root.appendChild(el('div', {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: '8px',
      },
    }, [
      el('div', {
        style: {
          fontSize: 'var(--fs-2xs)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        },
        text: title,
      }),
      el('div', {
        style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)' },
        text: 'past ' + weeks + ' weeks',
      }),
    ]));
  }

  const grid = el('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(' + weeks + ', 1fr)',
      gridTemplateRows: 'repeat(7, 1fr)',
      gap: '3px',
      padding: '2px 0',
    },
  });

  const valueByDate = new Map();
  let max = 1;
  for (const d of data) {
    const v = Math.max(0, Number(d.value) || 0);
    valueByDate.set(d.date, v);
    if (v > max) max = v;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOffset = (weeks - 1) * 7;
  const start = new Date(today);
  start.setDate(start.getDate() - startOffset);
  // Align to Sunday
  const dow = start.getDay();
  start.setDate(start.getDate() - dow);

  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = date.toISOString().slice(0, 10);
    const value = valueByDate.get(key) || 0;
    const intensity = value === 0 ? 0 : Math.min(1, 0.25 + (value / max) * 0.75);
    const isFuture = date > today;
    const isToday = date.getTime() === today.getTime();

    const cell = el('div', {
      class: 'heatmap-cell',
      style: {
        aspectRatio: '1',
        borderRadius: '2px',
        background: isFuture
          ? 'transparent'
          : value === 0
            ? 'color-mix(in srgb, var(--line) 60%, transparent)'
            : 'color-mix(in srgb, var(--accent) ' + Math.round(intensity * 100) + '%, transparent)',
        outline: isToday ? '1px solid var(--accent)' : 'none',
        outlineOffset: '-1px',
        cursor: value > 0 && onDayClick ? 'pointer' : 'default',
        transition: 'transform 120ms ease',
        title: key + ' · ' + value + ' file' + (value === 1 ? '' : 's'),
      },
      onMouseEnter: (e) => { e.currentTarget.style.transform = 'scale(1.4)'; },
      onMouseLeave: (e) => { e.currentTarget.style.transform = 'scale(1)'; },
      onClick: () => { if (value > 0 && onDayClick) onDayClick(key, value); },
    });
    grid.appendChild(cell);
    cells.push({ key, value });
  }

  root.appendChild(grid);

  // Legend
  const legend = el('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--faint)',
    },
  });
  legend.appendChild(el('span', { text: 'Less' }));
  for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
    legend.appendChild(el('div', {
      style: {
        width: '10px',
        height: '10px',
        borderRadius: '2px',
        background: intensity === 0
          ? 'color-mix(in srgb, var(--line) 60%, transparent)'
          : 'color-mix(in srgb, var(--accent) ' + Math.round(intensity * 100) + '%, transparent)',
      },
    }));
  }
  legend.appendChild(el('span', { text: 'More' }));
  root.appendChild(legend);

  root.update = (newData) => {
    // rebuild in place by replacing all cells' backgrounds
    const newMap = new Map();
    let nMax = 1;
    for (const d of newData || []) {
      const v = Math.max(0, Number(d.value) || 0);
      newMap.set(d.date, v);
      if (v > nMax) nMax = v;
    }
    cells.forEach((cell, i) => {
      const node = grid.children[i];
      if (!node) return;
      const v = newMap.get(cell.key) || 0;
      const intensity = v === 0 ? 0 : Math.min(1, 0.25 + (v / nMax) * 0.75);
      node.style.background = v === 0
        ? 'color-mix(in srgb, var(--line) 60%, transparent)'
        : 'color-mix(in srgb, var(--accent) ' + Math.round(intensity * 100) + '%, transparent)';
      node.title = cell.key + ' · ' + v + ' file' + (v === 1 ? '' : 's');
    });
  };

  return root;
}

export function activityFromLog(log) {
  const map = new Map();
  for (const entry of log) {
    const d = entry.time instanceof Date ? entry.time : new Date(entry.time);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    const inc = (entry.fresh || 0) + (entry.changed || 0) + (entry.identical || 0);
    map.set(key, (map.get(key) || 0) + inc);
  }
  return Array.from(map.entries()).map(([date, value]) => ({ date, value }));
}
