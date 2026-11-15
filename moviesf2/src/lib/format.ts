/** Presentation helpers: numbers, dates, runtime, tone. */

import type { Category, Title } from '../types';

export const numberFormat = new Intl.NumberFormat('en-US');
export const compactFormat = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function n(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return numberFormat.format(value);
}

export function compact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return compactFormat.format(value);
}

export function pct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function score(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(1).replace(/\.0$/, '');
}

export function tokens(value: number | null | undefined): string {
  if (!value) return '0';
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}

export function contextWindow(value: number | null | undefined): string {
  if (!value) return '—';
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
  return `${Math.round(value / 1000)}k`;
}

export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function dateLabel(input: string | null | undefined): string {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function shortDate(input: string | null | undefined): string {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function monthYear(input: string | null | undefined): string {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function dateTime(input: string | null | undefined): string {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · ${date.toLocaleTimeString(
    'en-GB',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

export function timeOnly(input: string | null | undefined): string {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function relative(input: string | null | undefined): string {
  if (!input) return '—';
  const date = new Date(input).getTime();
  if (Number.isNaN(date)) return '—';
  const diff = Date.now() - date;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function duration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${pad(seconds)}s`;
}

export function runtime(minutes: number | null | undefined): string {
  if (!minutes || !Number.isFinite(minutes)) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function hoursLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours >= 100) return `${n(hours)}h`;
  return rest ? `${hours}h ${pad(rest)}m` : `${hours}h`;
}

export function dayKey(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dayName(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return date.toLocaleDateString('en-GB', { weekday: 'short' });
}

export function weekdayLong(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return date.toLocaleDateString('en-GB', { weekday: 'long' });
}

export function monthName(monthIndex: number): string {
  return new Date(2024, monthIndex, 1).toLocaleDateString('en-GB', { month: 'short' });
}

export function categoryLabel(category: Category | string): string {
  if (category === 'love') return 'Love';
  if (category === 'hate') return 'Hate';
  return 'Good';
}

export function categoryGlyph(category: Category | string): string {
  if (category === 'love') return '◆';
  if (category === 'hate') return '✕';
  return '◇';
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    watched: 'Watched',
    watching: 'Watching',
    queued: 'Queued',
    abandoned: 'Abandoned',
    unknown: 'Unknown',
  };
  return map[status] || status || 'Unknown';
}

export function typeLabel(type: string): string {
  const map: Record<string, string> = {
    film: 'Film',
    series: 'Series',
    mini: 'Mini-series',
    documentary: 'Documentary',
    animation: 'Animation',
    short: 'Short',
    special: 'Special',
  };
  return map[type] || type;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? singular : pluralForm || `${singular}s`;
}

export function ratingTone(value: number): 'none' | 'low' | 'mid' | 'high' {
  if (!value) return 'none';
  if (value < 5) return 'low';
  if (value < 8) return 'mid';
  return 'high';
}

export function titleSubtitle(title: Title): string {
  const bits: string[] = [];
  if (title.year) bits.push(String(title.year));
  if (title.type) bits.push(typeLabel(title.type));
  if (title.runtime) bits.push(runtime(title.runtime));
  return bits.join(' · ');
}

export function episodeLabel(title: Title): string {
  if (!title.seasons && !title.episodes) return '';
  const seasonText = title.seasons ? `${title.seasons} ${plural(title.seasons, 'season')}` : '';
  const episodeText = title.episodes ? `${title.episodes} ${plural(title.episodes, 'episode')}` : '';
  return [seasonText, episodeText].filter(Boolean).join(' · ');
}

export function ordinal(value: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const mod100 = value % 100;
  return value + (suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0]);
}

export function relativeDay(input: string | null | undefined): string {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  const today = new Date();
  const diffDays = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays > -7) return `${Math.abs(diffDays)} days ago`;
  return dateLabel(input);
}

export function clockFrom(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
