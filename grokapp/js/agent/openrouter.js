/**
 * OpenRouter chat completions — non-stream and SSE stream.
 * Returns a normalized { choices: [{ message, finish_reason }] } object.
 */

const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function chatCompletion(apiKey, body, { signal, onDelta } = {}) {
  const useStream = Boolean(onDelta) && body.stream !== false;
  const payload = { ...body, stream: useStream };

  const res = await fetch(OR_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof location !== 'undefined' ? location.origin : '',
      'X-Title': 'DevSpace',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }

  if (!useStream) {
    return res.json();
  }

  return consumeSSE(res, onDelta, signal);
}

/**
 * Accumulate streamed OpenAI-style chunks into one assistant message.
 */
async function consumeSSE(res, onDelta, signal) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  let content = '';
  /** @type {Record<number, { id?: string, type?: string, function?: { name?: string, arguments?: string } }>} */
  const toolCalls = {};
  let finishReason = null;
  let role = 'assistant';

  while (true) {
    if (signal?.aborted) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new DOMException('Aborted', 'AbortError');
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() || '';

    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      let json;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      const choice = json.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const delta = choice.delta || {};
      if (delta.role) role = delta.role;
      if (delta.content) {
        content += delta.content;
        onDelta?.({ type: 'content', text: delta.content, content });
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCalls[idx]) {
            toolCalls[idx] = {
              id: tc.id || `call_${idx}`,
              type: 'function',
              function: { name: '', arguments: '' },
            };
          }
          const slot = toolCalls[idx];
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.function.name += tc.function.name;
          if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
          onDelta?.({ type: 'tool_call', index: idx, toolCall: slot });
        }
      }
    }
  }

  const tool_calls = Object.keys(toolCalls)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => toolCalls[k])
    .filter((tc) => tc.function?.name);

  const message = {
    role,
    content: content || null,
  };
  if (tool_calls.length) message.tool_calls = tool_calls;

  return {
    choices: [
      {
        message,
        finish_reason: finishReason || (tool_calls.length ? 'tool_calls' : 'stop'),
      },
    ],
  };
}
