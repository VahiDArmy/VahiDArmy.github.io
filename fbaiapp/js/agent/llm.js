// ---------------------------------------------------------------------------
// OpenRouter gateway.
//
// The gateway is deliberately dumb about planning and smart about failure:
// retries, timeouts, error classification, and falling through to another
// model when one is rate-limited, delisted or broken.
// ---------------------------------------------------------------------------

import { OPENROUTER } from '../config.js';
import { sleep, truncateMiddle } from '../core/util.js';

export class LLMError extends Error {
  constructor(message, info = {}) {
    super(message);
    this.name = 'LLMError';
    this.status = info.status || 0;
    this.code = info.code || '';
    this.model = info.model || '';
    this.retryable = Boolean(info.retryable);
    this.fatal = Boolean(info.fatal);
    this.retryAfterMs = info.retryAfterMs || 0;
  }
}

function classify(status, payload, model) {
  const message = payload?.error?.message || payload?.message || `OpenRouter request failed (${status})`;
  const code = String(payload?.error?.code || payload?.code || status);
  const retryableStatuses = [408, 409, 425, 429, 500, 502, 503, 504, 520, 522, 524];
  const retryable = retryableStatuses.includes(status) || /rate.?limit|overloaded|timeout|try again/i.test(message);
  const fatal = status === 401 || status === 403;
  return new LLMError(message, { status, code, model, retryable, fatal });
}

export class LLMGateway {
  constructor({ apiKey }) {
    this.apiKey = (apiKey || '').trim();
  }

  get ready() {
    return Boolean(this.apiKey);
  }

  async complete({ model, messages, tools = null, temperature = 0.2, maxTokens = 4096, signal = null, timeoutMs = 150_000 }) {
    if (!this.apiKey) {
      throw new LLMError('No OpenRouter API key. Add one in Settings to let the agent work.', { fatal: true });
    }

    const body = {
      model,
      messages: messages.map((message) => {
        const out = { role: message.role, content: message.content ?? '' };
        if (message.tool_calls) out.tool_calls = message.tool_calls;
        if (message.tool_call_id) out.tool_call_id = message.tool_call_id;
        if (message.name) out.name = message.name;
        return out;
      }),
      temperature,
      max_tokens: maxTokens,
      stream: false,
      usage: { include: true },
    };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const forwardAbort = () => controller.abort();
    signal?.addEventListener('abort', forwardAbort, { once: true });

    let res;
    try {
      res = await fetch(`${OPENROUTER.base}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': OPENROUTER.referer,
          'X-Title': OPENROUTER.title,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      if (timedOut) {
        throw new LLMError(`${model} did not respond within ${Math.round(timeoutMs / 1000)}s.`, {
          model, retryable: true, code: 'timeout',
        });
      }
      throw new LLMError(`Network error contacting OpenRouter: ${err.message}`, {
        model, retryable: true, code: 'network',
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forwardAbort);
    }

    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = { error: { message: text.slice(0, 400) } }; }
    }

    if (!res.ok) {
      const err = classify(res.status, data, model);
      const retryAfter = Number(res.headers.get('retry-after'));
      if (Number.isFinite(retryAfter) && retryAfter > 0) err.retryAfterMs = retryAfter * 1000;
      const metaRetry = Number(data?.error?.metadata?.retry_after_seconds ?? data?.error?.metadata?.retry_after);
      if (!err.retryAfterMs && Number.isFinite(metaRetry) && metaRetry > 0) err.retryAfterMs = metaRetry * 1000;
      throw err;
    }

    if (data?.error) {
      throw new LLMError(data.error.message || 'OpenRouter returned an error.', {
        status: 200, model, retryable: !/invalid|not found|no endpoints/i.test(data.error.message || ''),
      });
    }

    const choice = data?.choices?.[0];
    if (!choice) {
      throw new LLMError('OpenRouter returned no choices — the model may have refused or crashed.', {
        model, retryable: true,
      });
    }

    const message = choice.message || {};
    let content = message.content;
    if (Array.isArray(content)) {
      content = content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('');
    }
    if (typeof content !== 'string') content = '';

    return {
      content,
      toolCalls: Array.isArray(message.tool_calls) && message.tool_calls.length ? message.tool_calls : null,
      usage: {
        in: Number(data?.usage?.prompt_tokens) || 0,
        out: Number(data?.usage?.completion_tokens) || 0,
      },
      model: data?.model || model,
      finishReason: choice.finish_reason || '',
      refused: message.refusal || '',
    };
  }

  /**
   * Try a list of models in order, retrying transient failures on each.
   * Throws the most informative error if every model fails.
   */
  async completeWithFallback({
    models,
    messages,
    tools = null,
    temperature = 0.2,
    maxTokens = 4096,
    signal = null,
    retries = 2,
    onAttempt = null,
    onModelChange = null,
  }) {
    let lastError = null;
    let usedModel = models[0];

    for (let m = 0; m < models.length; m++) {
      const model = models[m];
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (m > 0) onModelChange?.(model, lastError);

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const result = await this.complete({ model, messages, tools, temperature, maxTokens, signal });
          return { ...result, requestedModel: model };
        } catch (err) {
          if (err?.name === 'AbortError') throw err;
          lastError = err;
          usedModel = model;
          if (err?.fatal) throw err;
          onAttempt?.({ model, attempt, error: err });
          if (!err.retryable || attempt === retries) break;
          const wait = err.retryAfterMs
            ? Math.min(err.retryAfterMs, 12_000)
            : Math.min(1200 * 2 ** attempt, 8000) + Math.random() * 400;
          await sleep(wait);
        }
      }
    }

    const detail = lastError ? truncateMiddle(lastError.message, 320) : 'unknown error';
    throw new LLMError(`Every model failed. Last error from ${usedModel}: ${detail}`, {
      model: usedModel, retryable: false, status: lastError?.status || 0,
    });
  }

  async verifyKey() {
    if (!this.apiKey) throw new Error('Enter a key first.');
    const res = await fetch(`${OPENROUTER.base}/key`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* ignore */ }
    if (!res.ok) {
      throw new Error(data?.error?.message || `OpenRouter rejected that key (${res.status}).`);
    }
    return data?.data || null;
  }
}
