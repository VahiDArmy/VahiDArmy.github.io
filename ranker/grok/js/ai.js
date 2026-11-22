const AI = (() => {
  const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
  let apiKey = localStorage.getItem('r3d_or_key') || '';
  let model = localStorage.getItem('r3d_or_model') || 'openrouter/free';

  function setKey(k) {
    apiKey = k.trim();
    localStorage.setItem('r3d_or_key', apiKey);
  }
  function getKey() { return apiKey; }
  function setModel(m) {
    model = m;
    localStorage.setItem('r3d_or_model', model);
  }
  function getModel() { return model; }

  async function chat(messages, { temperature = 0.7, max_tokens = 2048, stream = false } = {}) {
    if (!apiKey) throw new Error('NO_KEY');
    const body = {
      model,
      messages,
      temperature,
      max_tokens,
      stream
    };
    const res = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': location.origin,
        'X-Title': 'R3D Rank'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || res.statusText);
    }
    if (stream) return res;
    const json = await res.json();
    return json.choices?.[0]?.message || { content: '' };
  }

  async function streamChat(messages, onDelta, opts = {}) {
    const res = await chat(messages, { ...opts, stream: true });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let reasoning = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            full += delta.content;
            onDelta({ content: full, reasoning, delta: delta.content });
          }
          if (delta?.reasoning) {
            reasoning += delta.reasoning;
            onDelta({ content: full, reasoning, delta: '' });
          }
        } catch (_) {}
      }
    }
    return { content: full, reasoning };
  }

  function systemPrompt(ctx) {
    return `You are the insight engine of R3D, a 3-dimensional ranking system (people × people × traits).
You speak in short, dense, high-signal sentences. No fluff. No explanations of what R3D is.
Current context (JSON):
${JSON.stringify(ctx, null, 0).slice(0, 6000)}
Use scores in [-5,+5]. Highlight asymmetries, clusters, polarizing nodes, missing data. Be specific with names.`;
  }

  return { chat, streamChat, setKey, getKey, setModel, getModel, systemPrompt };
})();
window.AI = AI;
