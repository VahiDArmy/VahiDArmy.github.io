/** Markdown / JSON / CSV exports. Everything is generated locally. */
import { formatDateTime, formatTokens, providerFromSlug, prettyModelName, toCsv } from '../utils.js';
import { eventToCsvRow } from './analytics.js';

export function safeFilename(name, fallback = 'meraj-chat') {
  const clean = String(name || fallback)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return clean || fallback;
}

function messageHeading(message) {
  if (message.role === 'user') return 'You';
  const model = message.model_slug || message.requested_model || 'assistant';
  return `Assistant — ${model}`;
}

export function conversationToMarkdown(conversation, path = [], options = {}) {
  const { includeReasoning = true, includeMeta = true } = options;
  const lines = [];
  lines.push(`# ${conversation.title || 'Conversation'}`);
  lines.push('');
  if (includeMeta) {
    lines.push(`- **Model:** \`${conversation.model_slug || 'unknown'}\``);
    lines.push(`- **Created:** ${formatDateTime(conversation.created_at)}`);
    lines.push(`- **Exported:** ${formatDateTime(new Date())}`);
    if (conversation.total_tokens) lines.push(`- **Recorded tokens:** ${formatTokens(conversation.total_tokens)}`);
    lines.push('');
  }
  if (conversation.system_prompt?.trim()) {
    lines.push('## System prompt');
    lines.push('');
    lines.push('```text');
    lines.push(conversation.system_prompt);
    lines.push('```');
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  for (const message of path) {
    if (message.role === 'system') continue;
    lines.push(`## ${messageHeading(message)}`);
    lines.push('');
    if (includeMeta) {
      const meta = [formatDateTime(message.created_at)];
      if (message.status && message.status !== 'complete') meta.push(`status: ${message.status}`);
      if (message.usage?.total_tokens) meta.push(`${formatTokens(message.usage.total_tokens)} tokens`);
      if (message.requested_model && message.requested_model !== message.model_slug) {
        meta.push(`requested via \`${message.requested_model}\``);
      }
      lines.push(`*${meta.join(' · ')}*`);
      lines.push('');
    }
    lines.push(message.content || '_No content._');
    lines.push('');

    if (includeReasoning && message.reasoning?.trim()) {
      lines.push('<details>');
      lines.push('<summary>Reasoning returned by the model</summary>');
      lines.push('');
      lines.push(message.reasoning);
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }

    if (message.status === 'error' && message.error) {
      lines.push('> **Provider / request error**');
      lines.push('>');
      const error = message.error;
      if (error.status) lines.push(`> HTTP ${error.status} ${error.statusText || ''}`.trimEnd());
      lines.push(`> ${String(error.message || '').replace(/\n/g, '\n> ')}`);
      if (error.bodyText) {
        lines.push('>');
        lines.push('> ```text');
        for (const line of String(error.bodyText).split('\n')) lines.push(`> ${line}`);
        lines.push('> ```');
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('_Exported from معراج · MI\'RAJ. Every request body is archived with its response and remains viewable in the app._');
  lines.push('');
  return lines.join('\n');
}

export function conversationToJson(conversation, messages = []) {
  return JSON.stringify(
    {
      app: "معراج · MI'RAJ",
      exported_at: new Date().toISOString(),
      conversation,
      messages,
    },
    null,
    2,
  );
}

export function eventsToCsv(events = []) {
  const columns = [
    { key: 'created_at', label: 'created_at' },
    { key: 'status', label: 'status' },
    { key: 'requested_model', label: 'requested_model' },
    { key: 'model_slug', label: 'model_slug' },
    { key: 'prompt_tokens', label: 'prompt_tokens' },
    { key: 'completion_tokens', label: 'completion_tokens' },
    { key: 'total_tokens', label: 'total_tokens' },
    { key: 'latency_ms', label: 'latency_ms' },
    { key: 'http_status', label: 'http_status' },
    { key: 'error_code', label: 'error_code' },
    { key: 'error_message', label: 'error_message' },
  ];
  return toCsv(events.map(eventToCsvRow), columns);
}

export function modelDisplay(slug, models = []) {
  const found = models.find((model) => model.slug === slug);
  return found?.name || (slug === 'openrouter/free' ? 'Free Models Router' : prettyModelName(slug));
}

export function providerDisplay(slug, models = []) {
  const found = models.find((model) => model.slug === slug);
  return found?.provider || providerFromSlug(slug);
}
