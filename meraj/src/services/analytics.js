/** Pure aggregation for the analytics view. */
import { dayKey, formatNumber, formatTokens, formatDuration, providerFromSlug, prettyModelName } from '../utils.js';

const DAY = 86400000;

export function startOfDay(value = Date.now()) {
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function rangeStart(days) {
  if (!days || days === 'all') return null;
  return startOfDay(Date.now() - (Number(days) - 1) * DAY);
}

export function filterEvents(events, { days = 30, model = 'all' } = {}) {
  const cutoff = rangeStart(days);
  return (events || []).filter((event) => {
    if (cutoff && new Date(event.created_at).getTime() < cutoff) return false;
    if (model !== 'all' && event.model_slug !== model && event.requested_model !== model) return false;
    return true;
  });
}

function emptyBucket(time) {
  return {
    key: dayKey(time),
    time,
    requests: 0,
    ok: 0,
    errors: 0,
    aborted: 0,
    promptTokens: 0,
    completionTokens: 0,
    tokens: 0,
    latencyTotal: 0,
    latencyCount: 0,
  };
}

export function buildDailySeries(events, days = 30) {
  const sorted = [...events].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  let count = Number(days);
  let start;
  if (!Number.isFinite(count) || days === 'all') {
    const earliest = sorted.length ? startOfDay(sorted[0].created_at) : startOfDay();
    const span = Math.ceil((startOfDay() - earliest) / DAY) + 1;
    count = Math.max(1, Math.min(90, span));
  }
  count = Math.max(1, Math.min(180, count));
  start = startOfDay() - (count - 1) * DAY;
  const buckets = new Map();
  for (let i = 0; i < count; i += 1) {
    const time = start + i * DAY;
    buckets.set(dayKey(time), emptyBucket(time));
  }
  for (const event of sorted) {
    const key = dayKey(event.created_at);
    const bucket = buckets.get(key) || emptyBucket(new Date(event.created_at).getTime());
    bucket.requests += 1;
    if (event.status === 'ok') bucket.ok += 1;
    else if (event.status === 'error') bucket.errors += 1;
    else if (event.status === 'aborted') bucket.aborted += 1;
    bucket.promptTokens += Number(event.prompt_tokens) || 0;
    bucket.completionTokens += Number(event.completion_tokens) || 0;
    bucket.tokens += Number(event.total_tokens) || 0;
    if (event.latency_ms) {
      bucket.latencyTotal += Number(event.latency_ms) || 0;
      bucket.latencyCount += 1;
    }
    if (!buckets.has(key)) buckets.set(key, bucket);
  }
  return Array.from(buckets.values())
    .sort((a, b) => a.time - b.time)
    .map((bucket) => ({
      ...bucket,
      label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(bucket.time),
      shortLabel: new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(bucket.time),
      avgLatency: bucket.latencyCount ? Math.round(bucket.latencyTotal / bucket.latencyCount) : null,
    }));
}

export function buildAnalytics(events, models = [], { days = 30, model = 'all' } = {}) {
  const filtered = filterEvents(events, { days, model });
  const byModel = new Map();
  const byStatus = { ok: 0, error: 0, aborted: 0, other: 0 };
  const errors = new Map();
  const routerChoices = new Map();
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let latencyTotal = 0;
  let latencyCount = 0;
  let autoRouted = 0;
  let lastUsed = null;

  for (const event of filtered) {
    const slug = event.model_slug || event.requested_model || 'unknown';
    if (!byModel.has(slug)) {
      byModel.set(slug, {
        slug,
        name:
          models.find((entry) => entry.slug === slug)?.name ||
          (slug === 'openrouter/free' ? 'Free Models Router' : prettyModelName(slug)),
        provider:
          models.find((entry) => entry.slug === slug)?.provider || providerFromSlug(slug),
        requests: 0,
        ok: 0,
        errors: 0,
        aborted: 0,
        promptTokens: 0,
        completionTokens: 0,
        tokens: 0,
        latencyTotal: 0,
        latencyCount: 0,
        lastUsed: null,
        autoRouted: 0,
      });
    }
    const entry = byModel.get(slug);
    entry.requests += 1;
    if (event.status === 'ok') entry.ok += 1;
    else if (event.status === 'error') entry.errors += 1;
    else if (event.status === 'aborted') entry.aborted += 1;
    const prompt = Number(event.prompt_tokens) || 0;
    const completion = Number(event.completion_tokens) || 0;
    const total = Number(event.total_tokens) || prompt + completion;
    entry.promptTokens += prompt;
    entry.completionTokens += completion;
    entry.tokens += total;
    promptTokens += prompt;
    completionTokens += completion;
    totalTokens += total;
    if (event.latency_ms) {
      entry.latencyTotal += Number(event.latency_ms) || 0;
      entry.latencyCount += 1;
      latencyTotal += Number(event.latency_ms) || 0;
      latencyCount += 1;
    }
    if (!entry.lastUsed || new Date(event.created_at) > new Date(entry.lastUsed)) entry.lastUsed = event.created_at;
    if (!lastUsed || new Date(event.created_at) > new Date(lastUsed)) lastUsed = event.created_at;

    if (event.requested_model === 'openrouter/free' && event.model_slug && event.model_slug !== 'openrouter/free') {
      autoRouted += 1;
      entry.autoRouted += 1;
      const resolved = routerChoices.get(event.model_slug) || {
        slug: event.model_slug,
        name: models.find((entryModel) => entryModel.slug === event.model_slug)?.name || prettyModelName(event.model_slug),
        count: 0,
      };
      resolved.count += 1;
      routerChoices.set(event.model_slug, resolved);
    }

    if (event.status === 'ok') byStatus.ok += 1;
    else if (event.status === 'error') byStatus.error += 1;
    else if (event.status === 'aborted') byStatus.aborted += 1;
    else byStatus.other += 1;

    if (event.status === 'error') {
      const key = event.error_code || event.error_message || 'error';
      const existing = errors.get(key) || {
        key,
        code: event.error_code || null,
        message: event.error_message || 'No error message was recorded.',
        count: 0,
        last: null,
        model: event.model_slug,
        httpStatus: event.http_status,
      };
      existing.count += 1;
      existing.last = event.created_at;
      errors.set(key, existing);
    }
  }

  const modelRows = Array.from(byModel.values())
    .map((entry) => ({
      ...entry,
      avgLatency: entry.latencyCount ? Math.round(entry.latencyTotal / entry.latencyCount) : null,
      successRate: entry.requests ? (entry.ok / entry.requests) * 100 : null,
      lastUsed: entry.lastUsed,
    }))
    .sort((a, b) => b.requests - a.requests || b.tokens - a.tokens);

  const series = buildDailySeries(filtered, days);
  const totalRequests = filtered.length;
  const avgLatency = latencyCount ? Math.round(latencyTotal / latencyCount) : null;
  const activeModels = modelRows.filter((row) => row.requests > 0).length;
  const peak = series.reduce(
    (best, bucket) => (bucket.tokens > (best?.tokens || 0) ? bucket : best),
    series[0] || null,
  );

  return {
    events: filtered,
    totals: {
      requests: totalRequests,
      ok: byStatus.ok,
      errors: byStatus.error,
      aborted: byStatus.aborted,
      promptTokens,
      completionTokens,
      tokens: totalTokens,
      avgTokens: totalRequests ? Math.round(totalTokens / totalRequests) : 0,
      avgLatency,
      activeModels,
      autoRouted,
      successRate: totalRequests ? (byStatus.ok / totalRequests) * 100 : null,
      errorRate: totalRequests ? (byStatus.error / totalRequests) * 100 : null,
      lastUsed,
    },
    byStatus,
    series,
    models: modelRows,
    routerChoices: Array.from(routerChoices.values()).sort((a, b) => b.count - a.count),
    errors: Array.from(errors.values()).sort((a, b) => b.count - a.count),
    recent: [...filtered]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8),
    peak,
    days,
    modelFilter: model,
  };
}

export function analyticsKpis(analytics) {
  const { totals } = analytics;
  return [
    {
      key: 'requests',
      label: 'Requests',
      value: formatNumber(totals.requests),
      sub: `${formatNumber(totals.ok)} succeeded · ${formatNumber(totals.errors)} failed`,
      icon: 'send',
    },
    {
      key: 'tokens',
      label: 'Tokens',
      value: formatTokens(totals.tokens),
      sub: `${formatTokens(totals.promptTokens)} in · ${formatTokens(totals.completionTokens)} out`,
      icon: 'layers',
    },
    {
      key: 'success',
      label: 'Success rate',
      value: totals.successRate === null ? '—' : `${totals.successRate.toFixed(1)}%`,
      sub: `${formatNumber(totals.aborted)} stopped by you`,
      icon: 'checkCircle',
    },
    {
      key: 'latency',
      label: 'Average latency',
      value: totals.avgLatency === null ? '—' : formatDuration(totals.avgLatency),
      sub: `${formatNumber(totals.autoRouted)} auto-routed replies`,
      icon: 'clock',
    },
  ];
}

export function eventToCsvRow(event) {
  return {
    created_at: event.created_at,
    status: event.status,
    requested_model: event.requested_model || '',
    model_slug: event.model_slug || '',
    prompt_tokens: event.prompt_tokens || 0,
    completion_tokens: event.completion_tokens || 0,
    total_tokens: event.total_tokens || 0,
    latency_ms: event.latency_ms ?? '',
    http_status: event.http_status ?? '',
    error_code: event.error_code || '',
    error_message: event.error_message || '',
  };
}
