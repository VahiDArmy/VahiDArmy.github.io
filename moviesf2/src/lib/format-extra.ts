/** Additional labels kept out of the core formatter to avoid circular imports. */

export {
  n,
  compact,
  pct,
  score,
  tokens,
  contextWindow,
  dateLabel,
  shortDate,
  monthYear,
  dateTime,
  timeOnly,
  relative,
  duration,
  runtime,
  hoursLabel,
  dayKey,
  categoryLabel,
  categoryGlyph,
  statusLabel,
  typeLabel,
  initials,
  plural,
  ordinal,
  relativeDay,
  titleSubtitle,
  episodeLabel,
  ratingTone,
  clockFrom,
  dayName,
  weekdayLong,
} from './format';

export function timestampLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().replace('T', ' ').slice(0, 16);
}

export function bytesLabel(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}
