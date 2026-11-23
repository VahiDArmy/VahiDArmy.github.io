/* ai.js — OpenRouter free models, streaming, reasoning, matrix tools */
import {
  state, esc, icon, fa, faNum, pct, toast, openModal, confirmDialog, getPrefs, savePrefs,
  play, haptic, timeAgo, errMsg, clamp, initials,
} from './core.js';
import { setScore, logAiRun, cacheModels, getScore, logEvent } from './data.js';
import { traitStats, personStats, norm } from './matrix.js';

const KEY_LS = 'mx3.orKey';
const MODELS_LS = 'mx3.models';
const API = 'https://openrouter.ai/api/v1';

const ai = {
  messages: [],
  busy: false,
  models: [],
  modelsAt: 0,
  model: '',
  abort: null,
  lastText: '',
  tool: 'chat',
  draft: '',
};

export function getKey() { try { return localStorage.getItem(KEY_LS) || ''; } catch { return ''; } }
export function setKey(k) { try { localStorage.setItem(KEY_LS, k.trim()); } catch { /* ignore */ } }
const keyChip = () => getKey() ? `<span class="chip chip--ok">${icon('key')} کلید محلی</span>` : `<span class="chip chip--warn">${icon('key')} بدون کلید</span>`;

/* ---------- models ---------- */
const isFree = (m) => {
  const p = m.pricing || {};
  const pf = parseFloat(p.prompt ?? '1'); const cf = parseFloat(p.completion ?? '1');
  return (Number.isFinite(pf) && pf === 0 && Number.isFinite(cf) && cf === 0) || /:free$/.test(m.id || '') || m.id === 'openrouter/free';
};
const isChat = (m) => {
  const arch = m.architecture || {};
  const out = arch.output_modalities || m.output_modalities || ['text'];
  return Array.isArray(out) ? out.includes('text') : true;
};

export async function loadModels(force = false) {
  if (ai.loading) return ai.loading;
  if (!force && ai.models.length && Date.now() - ai.modelsAt < 1000 * 60 * 30) return ai.models;
  ai.loading = (async () => {
  try {
    const raw = JSON.parse(localStorage.getItem(MODELS_LS) || 'null');
    if (!force && raw?.at && Date.now() - raw.at < 1000 * 60 * 60 * 12 && raw.list?.length) {
      ai.models = raw.list; ai.modelsAt = raw.at; return ai.models;
    }
  } catch { /* ignore */ }
  try {
    const r = await fetch(`${API}/models`, { headers: { 'x-title': 'Matrix 3D' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    let list = (j.data || []).filter((m) => isFree(m) && isChat(m));
    const pref = ['openrouter/free', 'deepseek/', 'qwen/', 'meta-llama/', 'mistralai/', 'google/gemma', 'openai/gpt-oss', 'z-ai/', 'moonshotai/', 'nousresearch/'];
    list.sort((a, b) => {
      const ai2 = pref.findIndex((p) => (a.id || '').startsWith(p)); const bi = pref.findIndex((p) => (b.id || '').startsWith(p));
      const av = ai2 === -1 ? 99 : ai2; const bv = bi === -1 ? 99 : bi;
      return av - bv || String(a.name).localeCompare(String(b.name));
    });
    ai.models = list; ai.modelsAt = Date.now();
    try { localStorage.setItem(MODELS_LS, JSON.stringify({ at: ai.modelsAt, list })); } catch { /* quota */ }
    if (state.user) cacheModels(list.slice(0, 120));
  } catch (e) {
    // fall back to catalogue table
    try {
      const { fetchModelsTable } = await import('./data.js');
      const rows = await fetchModelsTable();
      ai.models = rows.map((r) => ({ id: r.id, name: r.name, context_length: r.context_length, pricing: { prompt: '0', completion: '0' }, supported_parameters: r.supported_parameters || [] }));
    } catch { /* ignore */ }
    if (!ai.models.length) toast(`فهرست مدل‌ها بارگیری نشد: ${e.message}`, 'warn', 4000);
  }
  return ai.models;
  })().finally(() => { ai.loading = null; });
  return ai.loading;
}

function modelOptions() {
  const sel = getPrefs().aiModel || ai.model;
  return `<option value="">— مدل —</option>` + ai.models.map((m) => `<option value="${esc(m.id)}" ${sel === m.id ? 'selected' : ''}>${esc(m.name || m.id)}</option>`).join('');
}
const currentModel = () => getPrefs().aiModel || ai.model || ai.models[0]?.id || 'deepseek/deepseek-r1:free';

/* ---------- prompt context ---------- */
export function matrixContext() {
  const traits = state.traits.filter((t) => t.metadata?.active !== false);
  const people = state.people;
  const lines = [];
  lines.push(`# داده ماتریس`);
  lines.push(`افراد (${people.length}): ` + people.slice(0, 40).map((p) => `${p.full_name}${p.department ? `(${p.department})` : ''}`).join('، '));
  lines.push(`ویژگی‌ها (${traits.length}): ` + traits.map((t) => `${t.name}[${t.min_value}-${t.max_value}, وزن ${t.weight}]`).join('، '));
  const agg = traits.map((t) => { const s = traitStats(t.id); return `${t.name}: میانگین ${s.avg.toFixed(2)}، انحراف ${s.sd.toFixed(2)}، ${s.n} امتیاز`; });
  lines.push(`خلاصه لایه‌ها: ` + agg.join(' | '));
  const ranked = people.map((p) => ({ p, s: personStats(p.id) })).filter((x) => x.s.received > 0)
    .sort((a, b) => (b.s.avgReceived || 0) - (a.s.avgReceived || 0)).slice(0, 8)
    .map((x, i) => `${i + 1}. ${x.p.full_name}: ${x.s.avgReceived?.toFixed(2)}`);
  lines.push(`رتبه‌بندی دریافتی: ` + (ranked.join('، ') || '—'));
  lines.push(`اعتراض‌های باز: ${state.disputes.filter((d) => d.status === 'open').length}`);
  if (state.people.length) lines.push(`شناسه افراد: ` + state.people.slice(0, 40).map((p) => `${p.full_name}=${p.id}`).join('، '));
  if (traits.length) lines.push(`شناسه ویژگی‌ها: ` + traits.map((t) => `${t.name}=${t.id}`).join('، '));
  return lines.join('\n').slice(0, 7000);
}

const SYSTEM = `تو دستیار تحلیل ماتریس سه‌بعدی رتبه‌بندی هستی. کاربر داده‌ای از افراد × ویژگی‌ها × امتیازدهنده/گیرنده دارد.
پاسخ‌ها را فارسی، فشرده و عملی بده. اگر داده کافی نیست صریح بگو. برای پیشنهاد عددی، مقدار پیشنهادی و دلیل کوتاه بده.
هیچ‌گاه ادعا نکن داده‌ای را دیده‌ای که در بافت نیست.`;

/* ---------- streaming ---------- */
export async function chatStream({ messages, model, temperature, reasoning, signal, onDelta, onReason }) {
  const key = getKey();
  if (!key) throw new Error('کلید OpenRouter را در تنظیمات هوش ذخیره کنید');
  const chosen = ai.models.find((m) => m.id === model);
  const params = chosen?.supported_parameters || [];
  const body = {
    model: model || currentModel(),
    messages,
    stream: true,
    temperature: Number(temperature ?? getPrefs().aiTemp ?? 0.7),
  };
  const effort = reasoning || getPrefs().aiReasoning || 'medium';
  if (effort !== 'off' && (!params.length || params.includes('reasoning') || params.includes('include_reasoning'))) {
    body.reasoning = { effort };
  }
  const res = await fetch(`${API}/chat/completions`, {
    method: 'POST', signal,
    headers: {
      Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
      'HTTP-Referer': location.origin, 'X-Title': 'Matrix 3D',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j.error?.message || j.message || ''; } catch { /* ignore */ }
    if (res.status === 401) throw new Error('کلید OpenRouter نامعتبر است (۴۰۱)');
    if (res.status === 402) throw new Error('اعتبار حساب OpenRouter کافی نیست (۴۰۲)');
    if (res.status === 429) throw new Error('محدودیت نرخ درخواست؛ چند لحظه بعد تلاش کنید (۴۲۹)');
    if (res.status === 404) throw new Error(`مدل در دسترس نیست (۴۰۴) ${detail}`);
    throw new Error(`خطای ${res.status}: ${detail.slice(0, 160)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let text = ''; let reason = ''; let usage = null; let actualModel = body.model;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n');
    buf = parts.pop() || '';
    for (const line of parts) {
      const l = line.trim();
      if (!l || l.startsWith(':')) continue;
      if (!l.startsWith('data:')) continue;
      const data = l.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data);
        if (j.model) actualModel = j.model;
        if (j.usage) usage = j.usage;
        const d = j.choices?.[0]?.delta;
        if (!d) continue;
        if (d.reasoning || d.reasoning_content) { reason += d.reasoning || d.reasoning_content; onReason?.(reason); }
        if (d.content) { text += d.content; onDelta?.(text); }
      } catch { /* partial */ }
    }
  }
  return { text, reasoning: reason, usage, model: actualModel };
}

/* ---------- message rendering ---------- */
function mdLite(text) {
  let out = esc(text);
  out = out.replace(/```([\s\S]*?)```/g, (_, code) => `<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:11px;background:rgba(0,0,0,.35);padding:7px;border-radius:7px;overflow:auto;direction:ltr;text-align:left">${code.trim()}</pre>`);
  out = out.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  out = out.replace(/^### (.+)$/gm, '<b style="color:var(--acc)">$1</b>');
  out = out.replace(/^## (.+)$/gm, '<b style="color:var(--acc)">$1</b>');
  out = out.replace(/`([^`\n]+)`/g, '<code style="background:rgba(255,255,255,.08);padding:0 3px;border-radius:3px">$1</code>');
  return out;
}

function msgHTML(m, i) {
  const isUser = m.role === 'user';
  return `<div class="msg ${isUser ? 'msg--user' : ''}" data-mi="${i}">
    <div class="msg__role">${icon(isUser ? 'user' : 'brain')} ${isUser ? 'شما' : esc(m.model ? String(m.model).split('/').pop() : 'دستیار')}
      ${m.at ? `<span class="muted">· ${timeAgo(m.at)}</span>` : ''}</div>
    ${m.reasoning ? `<details class="msg__reason"><summary style="cursor:pointer;font-size:10px">استدلال</summary>${esc(m.reasoning)}</details>` : ''}
    <div class="msg__bubble">${mdLite(m.content || '')}${m.streaming ? '<span class="typing"><i></i><i></i><i></i></span>' : ''}</div>
    ${m.error ? `<div class="chip chip--bad">${esc(m.error)}</div>` : ''}
    ${!isUser && !m.streaming && m.content ? `<div class="msg__tools">
      <button class="iconbtn iconbtn--xs" data-copy="${i}" title="کپی">${icon('copy')}</button>
      <button class="iconbtn iconbtn--xs" data-retry="${i}" title="تلاش دوباره">${icon('refresh')}</button>
      ${m.actions ? `<span class="chip chip--acc">${fa(m.actions)} عمل</span>` : ''}
    </div>` : ''}
  </div>`;
}

function renderList(listEl) {
  if (!listEl) return;
  if (!ai.messages.length) {
    listEl.innerHTML = `<div class="aidock__empty">
      <div style="color:var(--acc);margin-bottom:5px">${icon('brain')}</div>
      مدل آزاد OpenRouter را انتخاب کنید و از ماتریس بپرسید.<br>
      <span class="muted" style="font-size:10px">${getKey() ? 'کلید در حافظه محلی ذخیره است' : 'برای شروع، کلید API را ذخیره کنید'}</span></div>`;
    return;
  }
  const nearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 80;
  listEl.innerHTML = ai.messages.map(msgHTML).join('');
  listEl.querySelectorAll('[data-copy]').forEach((b) => b.onclick = async () => {
    try { await navigator.clipboard.writeText(ai.messages[+b.dataset.copy].content); toast('کپی شد', 'ok', 1200); } catch { toast('کپی نشد', 'err'); }
  });
  listEl.querySelectorAll('[data-retry]').forEach((b) => b.onclick = () => {
    const idx = +b.dataset.retry;
    const userMsg = [...ai.messages.slice(0, idx)].reverse().find((m) => m.role === 'user');
    if (userMsg) { ai.messages.splice(idx); send(userMsg.content, listEl.closest('[data-chat]')); }
  });
  if (nearBottom) listEl.scrollTop = listEl.scrollHeight;
}

/* ---------- send ---------- */
async function send(text, root, { extraContext = '', model = null, onComplete = null } = {}) {
  if (!text.trim() || ai.busy) return;
  if (!getKey()) { toast('اول کلید OpenRouter را ذخیره کنید', 'warn'); openKeyModal(); return; }
  const listEl = root?.querySelector('[data-ai-list]');
  ai.messages.push({ role: 'user', content: text, at: new Date().toISOString() });
  const msgIndex = ai.messages.length;
  ai.messages.push({ role: 'assistant', content: '', reasoning: '', streaming: true, model: model || currentModel(), at: new Date().toISOString() });
  ai.busy = true;
  renderList(listEl);
  play('tap');
  const started = Date.now();
  const ctrl = new AbortController(); ai.abort = ctrl;
  const sys = `${SYSTEM}\n\n${matrixContext()}${extraContext ? `\n\n# بافت اضافی\n${extraContext}` : ''}`;
  const history = ai.messages.slice(0, msgIndex).filter((m) => !m.error).slice(-12)
    .map((m) => ({ role: m.role, content: m.content }));
  try {
    const res = await chatStream({
      messages: [{ role: 'system', content: sys }, ...history],
      model: model || currentModel(),
      signal: ctrl.signal,
      onDelta: (t) => { ai.messages[msgIndex].content = t; renderList(listEl); },
      onReason: (r) => { ai.messages[msgIndex].reasoning = r; },
    });
    const m = ai.messages[msgIndex];
    m.content = res.text || m.content || '—';
    m.reasoning = res.reasoning || m.reasoning;
    m.streaming = false;
    m.usage = res.usage;
    play('clink'); haptic([6, 16, 6]);
    const lat = Date.now() - started;
    logAiRun({
      kind: ai.tool, model: res.model, prompt: text, response: m.content, reasoning: m.reasoning,
      status: 'ok', tokensIn: res.usage?.prompt_tokens, tokensOut: res.usage?.completion_tokens, latency: lat,
      context: { messages: history.length },
    });
    if (onComplete) { try { const n = await onComplete(m.content, m); if (n) m.actions = n; } catch (e) { toast(errMsg(e), 'err'); } }
  } catch (e) {
    const m = ai.messages[msgIndex];
    m.streaming = false;
    if (e.name === 'AbortError') { m.content = m.content || 'متوقف شد'; m.error = 'متوقف شد'; }
    else { m.error = errMsg(e); play('err'); haptic(24); }
    logAiRun({ kind: ai.tool, model: currentModel(), prompt: text, response: m.content, status: m.error === 'متوقف شد' ? 'stopped' : 'error', error: m.error, latency: Date.now() - started });
  } finally {
    ai.busy = false; ai.abort = null;
    renderList(listEl);
  }
}

/* ---------- chat mount ---------- */
function mountChat(root, { compact = false } = {}) {
  root.dataset.chat = '1';
  root.innerHTML = `
    <div class="aidock__model">
      <select data-ai-model style="flex:1">${modelOptions()}</select>
      ${keyChip()}
      <button class="iconbtn iconbtn--xs" data-ai-refresh title="مدل‌ها">${icon('refresh')}</button>
      <button class="iconbtn iconbtn--xs" data-ai-key title="کلید">${icon('key')}</button>
      <button class="iconbtn iconbtn--xs" data-ai-new title="گفت‌وگوی جدید">${icon('plus')}</button>
    </div>
    <div class="aidock__body" data-ai-list></div>
    <div class="aidock__foot">
      <div class="aidock__quick">
        <button data-q="تحلیل کلی ماتریس را بده: نقاط قوت، ضعف، سوگیری‌ها و پیشنهادهای عملی.">تحلیل کلی</button>
        <button data-q="کدام سلول‌ها بیشترین اختلاف با میانگین لایه را دارند؟ فقط ۵ مورد مهم.">اختلاف‌ها</button>
        <button data-q="برای این ماتریس ۵ ویژگی پیشنهاد بده که پوشش را بهتر کند.">ویژگی پیشنهادی</button>
        <button data-q="خلاصه‌ای کوتاه از وضعیت اعتماد و اطمینان امتیازها بده.">اطمینان</button>
      </div>
      <div class="aidock__input">
        <textarea data-ai-input rows="2" placeholder="بپرس… (Ctrl+Enter)"></textarea>
        <button class="btn btn--primary" data-ai-send>${icon('spark')}</button>
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:9.5px;color:var(--ink-3)">
        <label style="display:flex;align-items:center;gap:4px">استدلال
          <select data-ai-effort style="width:auto;padding:2px 4px;font-size:10px">
            ${['off', 'low', 'medium', 'high'].map((x) => `<option value="${x}" ${(getPrefs().aiReasoning || 'medium') === x ? 'selected' : ''}>${x}</option>`).join('')}
          </select></label>
        <span class="spacer" style="flex:1"></span>
        ${ai.busy ? `<button class="btn btn--sm btn--danger" data-ai-stop>${icon('pause')} توقف</button>` : ''}
        <span>${ai.models.length ? `${fa(ai.models.length)} مدل آزاد` : '—'}</span>
      </div>
    </div>`;

  const list = root.querySelector('[data-ai-list]');
  renderList(list);
  const input = root.querySelector('[data-ai-input]');
  input.value = ai.draft || '';
  const doSend = () => {
    const text = input.value.trim(); if (!text) return;
    ai.draft = ''; input.value = '';
    send(text, root);
  };
  root.querySelector('[data-ai-send]').onclick = doSend;
  input.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doSend(); } };
  root.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { input.value = b.dataset.q; doSend(); });
  root.querySelector('[data-ai-model]').onchange = async (e) => { await savePrefs({ aiModel: e.target.value }); ai.model = e.target.value; play('tap'); };
  root.querySelector('[data-ai-key]').onclick = openKeyModal;
  root.querySelector('[data-ai-effort]').onchange = (e) => savePrefs({ aiReasoning: e.target.value });
  root.querySelector('[data-ai-new]').onclick = () => { ai.messages = []; renderList(list); play('swoosh'); };
  root.querySelector('[data-ai-stop]')?.addEventListener('click', () => { ai.abort?.abort(); });
  root.querySelector('[data-ai-refresh]').onclick = async () => {
    toast('بارگیری مدل‌های آزاد…', 'info', 1400);
    await loadModels(true);
    root.querySelector('[data-ai-model]').innerHTML = modelOptions();
    toast(`${fa(ai.models.length)} مدل آزاد`, 'ok');
  };
  if (!ai.models.length) {
    loadModels().then(() => {
      const sel = root.querySelector('[data-ai-model]');
      if (sel && !sel.options.length) sel.innerHTML = modelOptions();
      ai.model = currentModel();
      root.querySelector('.aidock__model')?.insertAdjacentHTML('beforeend', `<span class="chip chip--ok">${icon('check')}</span>`);
      setTimeout(() => root.querySelector('.chip.chip--ok')?.remove(), 2400);
    });
  }
  setTimeout(() => list.scrollTop = list.scrollHeight, 50);
  void compact;
}

/* ---------- page ---------- */
export async function render(host) {
  ai.tool = 'chat';
  host.innerHTML = `
    <div class="pagehead">
      <h2>${icon('brain')} هوش ماتریس</h2>
      <div class="pagehead__sub">مدل آزاد OpenRouter · استدلال · ابزارهای ماتریسی</div>
      <div class="spacer"></div>
      <div class="toolrow">
        <span class="chip">${icon('key')} کلید فقط محلی</span>
        <button class="btn btn--sm" id="ai-clear">${icon('trash')} پاک‌سازی تاریخچه</button>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:1.45fr .8fr;align-items:start">
      <section class="panel" id="ai-chat" style="height:calc(100vh - 205px);min-height:420px;display:flex;flex-direction:column;overflow:hidden">
        <div class="panel__head">${icon('spark')}<h3>گفت‌وگو</h3><div class="spacer"></div><span class="count" id="ai-modelname"></span></div>
        <div id="ai-chatmnt" style="flex:1;min-height:0;display:flex;flex-direction:column"></div>
      </section>
      <div style="display:flex;flex-direction:column;gap:10px">
        <section class="panel">
          <div class="panel__head">${icon('zap')}<h3>ابزارها</h3></div>
          <div class="panel__body" style="display:flex;flex-direction:column;gap:5px">
            <button class="palette__item" data-tool="analyze">${icon('target')} تحلیل کامل ماتریس</button>
            <button class="palette__item" data-tool="traits">${icon('sliders')} پیشنهاد ویژگی جدید</button>
            <button class="palette__item" data-tool="fill">${icon('layers')} تکمیل خودکار امتیازها</button>
            <button class="palette__item" data-tool="person">${icon('user')} تحلیل یک شخص</button>
            <button class="palette__item" data-tool="disputes">${icon('flag')} بررسی اعتراض‌ها</button>
            <button class="palette__item" data-tool="bias">${icon('scale')} سوگیری و کیفیت داده</button>
          </div>
        </section>
        <section class="panel" id="ai-toolbox"><div class="panel__body"><span class="muted" style="font-size:11px">ابزاری انتخاب کنید.</span></div></section>
        <section class="panel">
          <div class="panel__head">${icon('settings')}<h3>تنظیم مدل</h3></div>
          <div class="panel__body" style="display:flex;flex-direction:column;gap:8px">
            <div id="ai-modelrow" style="display:flex;gap:5px;align-items:center">
              <select id="ai-model2" style="flex:1">${modelOptions()}</select>
              <button class="iconbtn iconbtn--xs" id="ai-key2" title="کلید">${icon('key')}</button>
            </div>
            <label class="field"><span>دمای مدل <b id="ai-tempv">${faNum(getPrefs().aiTemp ?? 0.7, 2)}</b></span>
              <input type="range" id="ai-temp" min="0" max="1.5" step="0.1" value="${getPrefs().aiTemp ?? 0.7}"></label>
            <label class="field"><span>استدلال</span><select id="ai-eff">
              ${['off', 'low', 'medium', 'high'].map((x) => `<option value="${x}" ${(getPrefs().aiReasoning || 'medium') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
            <label class="field"><span>دستور سیستمی</span><textarea id="ai-sys" rows="2" placeholder="پیش‌فرض…">${esc(getPrefs().aiSystem || '')}</textarea></label>
            <div style="display:flex;gap:5px"><button class="btn btn--sm" id="ai-savecfg">${icon('check')} ذخیره</button>
              <button class="btn btn--sm" id="ai-test">${icon('play')} تست</button></div>
          </div>
        </section>
        <section class="panel">
          <div class="panel__head">${icon('db')}<h3>اجراهای اخیر</h3><div class="spacer"></div><span class="count">${fa(state.aiRuns.length)}</span></div>
          <div class="panel__body" style="max-height:200px;overflow:auto;display:flex;flex-direction:column;gap:5px">
            ${state.aiRuns.slice(0, 12).map((r) => `<div class="kv"><span class="kv__k">${esc(r.kind)} · ${esc((r.model_slug || '').split('/').pop() || '—')}</span>
              <span class="chip ${r.status === 'ok' ? 'chip--ok' : 'chip--bad'}">${esc(r.status)}</span><span class="muted" style="font-size:9.5px">${timeAgo(r.created_at)}</span></div>`).join('') || '<span class="muted" style="font-size:11px">—</span>'}
          </div>
        </section>
      </div>
    </div>`;

  mountChat(host.querySelector('#ai-chatmnt'), { compact: true });
  host.querySelector('#ai-chat').style.height = 'calc(100vh - 205px)';
  const setModelName = () => { const el = host.querySelector('#ai-modelname'); if (el) el.textContent = currentModel().split('/').pop(); };
  setModelName();
  host.querySelector('#ai-model2').onchange = (e) => { savePrefs({ aiModel: e.target.value }); ai.model = e.target.value; setModelName(); host.querySelector('[data-ai-model]').value = e.target.value; };
  host.querySelector('#ai-key2').onclick = openKeyModal;
  host.querySelector('#ai-temp').oninput = (e) => { host.querySelector('#ai-tempv').textContent = faNum(e.target.value, 2); };
  host.querySelector('#ai-savecfg').onclick = async () => {
    await savePrefs({ aiTemp: Number(host.querySelector('#ai-temp').value), aiReasoning: host.querySelector('#ai-eff').value, aiSystem: host.querySelector('#ai-sys').value });
    toast('تنظیمات ذخیره شد', 'ok'); play('save');
  };
  host.querySelector('#ai-test').onclick = () => {
    ai.draft = 'در یک جمله بگو آماده‌ای.'; host.querySelector('[data-ai-input]').value = ai.draft;
    host.querySelector('[data-ai-send]').click();
  };
  host.querySelector('#ai-clear').onclick = async () => {
    if (!await confirmDialog({ title: 'پاک‌سازی', text: 'تاریخچه گفت‌وگو پاک شود؟', danger: true, okText: 'پاک کن' })) return;
    ai.messages = []; renderList(host.querySelector('[data-ai-list]')); toast('پاک شد', 'ok');
  };
  host.querySelectorAll('[data-tool]').forEach((b) => b.onclick = () => runTool(b.dataset.tool, host));
  await loadModels();
  const sel = host.querySelector('[data-ai-model]'); if (sel) sel.innerHTML = modelOptions();
  const sel2 = host.querySelector('#ai-model2'); if (sel2) sel2.innerHTML = modelOptions();
  if (ai.pending) { const p = ai.pending; ai.pending = null; runTool(p.kind, host, p.params); }
  setModelName();
}

async function runTool(kind, host, params = {}) {
  ai.tool = kind;
  const box = host.querySelector('#ai-toolbox');
  const listRoot = host.querySelector('#ai-chat');
  if (!box) return;
  if (kind === 'analyze') {
    box.innerHTML = `<div class="panel__body" style="font-size:11.5px;color:var(--ink-2);line-height:1.9">تحلیل کامل: توزیع، سوگیری، افراد شاخص، لایه‌های ضعیف.</div>`;
    send('تحلیل کامل ماتریس: ۱) پراکندگی هر لایه ۲) سه نامتعارف ۳) سوگیری امتیازدهنده‌ها ۴) پنج اقدام عملی. جدول کوتاه بده.', listRoot);
    return;
  }
  if (kind === 'bias') {
    send('کیفیت داده را بررسی کن: پوشش، اطمینان پایین، امتیازهای افراطی، اختلاف امتیازدهنده‌ها. فهرست کوتاه با راهکار.', listRoot);
    return;
  }
  if (kind === 'disputes') {
    const open = state.disputes.filter((d) => d.status === 'open');
    if (!open.length) return toast('اعتراض بازی نیست', 'info');
    const ctx = open.slice(0, 12).map((d) => `- ${state.traitMap.get(d.trait_id)?.name || '?'} → ${state.peopleMap.get(d.target_person_id)?.full_name || '?'}: ${d.reason || 'بدون دلیل'}`).join('\n');
    send('برای این اعتراض‌ها پیشنهاد تصمیم بده (پذیرش/رد) با دلیل یک‌خطی:\n' + ctx, listRoot, { extraContext: ctx });
    return;
  }
  if (kind === 'person') {
    const opts = state.people.map((p) => `<option value="${p.id}">${esc(p.full_name)}</option>`).join('');
    box.innerHTML = `<div class="panel__body" style="display:flex;flex-direction:column;gap:7px">
      <label class="field"><span>شخص</span><select id="ai-person">${opts}</select></label>
      <button class="btn btn--sm btn--primary" id="ai-person-go">${icon('brain')} تحلیل</button></div>`;
    box.querySelector('#ai-person-go').onclick = () => {
      const id = box.querySelector('#ai-person').value;
      const p = state.peopleMap.get(id); const s = personStats(id);
      const ctx = `شخص: ${p.full_name}\nمشخصات: ${p.job_title || ''} ${p.department || ''}\nمیانگین دریافتی: ${s.avgReceived?.toFixed(2)} / دهنده: ${s.avgGiven?.toFixed(2)}\nدریافتی به تفکیک: ${s.receivedByTrait.map((x) => `${x.trait.name}=${x.avg?.toFixed(2) ?? '—'}`).join('، ')}\nدهنده به تفکیک: ${s.givenByTrait.map((x) => `${x.trait.name}=${x.avg?.toFixed(2) ?? '—'}`).join('، ')}`;
      send(`تحلیل پروفایل ${p.full_name}: قوت‌ها، ریسک‌ها، تفاوت نگاه خودش به دیگران با نگاه دیگران به او.`, listRoot, { extraContext: ctx });
    };
    return;
  }
  if (kind === 'fill') {
    const people = state.people;
    const traits = state.traits;
    box.innerHTML = `<div class="panel__body" style="display:flex;flex-direction:column;gap:7px">
      <label class="field"><span>امتیازدهنده</span><select id="ai-fill-ranker">${people.map((p) => `<option value="${p.id}">${esc(p.full_name)}</option>`).join('')}</select></label>
      <label class="field"><span>دامنه</span><select id="ai-fill-trait"><option value="all">همه ویژگی‌ها</option>${traits.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
      <label class="field"><span>تعداد پیشنهاد</span><input id="ai-fill-n" type="number" min="1" max="20" value="8"></label>
      <button class="btn btn--sm btn--primary" id="ai-fill-go">${icon('spark')} پیشنهاد بده</button>
      <span class="muted" style="font-size:10px">سلول‌های خالی، سپس پیش‌نمایش و اعمال.</span></div>`;
    box.querySelector('#ai-fill-go').onclick = async () => {
      const rankerId = box.querySelector('#ai-fill-ranker').value;
      const traitId = box.querySelector('#ai-fill-trait').value;
      const n = clamp(Number(box.querySelector('#ai-fill-n').value) || 8, 1, 20);
      const ts = traitId === 'all' ? traits : traits.filter((t) => t.id === traitId);
      const targets = people.filter((p) => p.id !== rankerId);
      const missing = [];
      for (const t of ts) for (const p of targets) if (!getScore(t.id, rankerId, p.id)) missing.push({ t, p });
      const sample = (missing.length ? missing : ts.flatMap((t) => targets.map((p) => ({ t, p })))).slice(0, 60);
      const ctx = `امتیازدهنده: ${state.peopleMap.get(rankerId)?.full_name}\nویژگی‌ها: ${ts.map((t) => `${t.id}|${t.name}|${t.min_value}-${t.max_value}`).join('; ')}\nافراد: ${sample.map((x) => `${x.p.id}|${x.p.full_name}`).join('; ')}`;
      const prompt = `برای امتیازدهنده «${state.peopleMap.get(rankerId)?.full_name}» حداکثر ${n} امتیاز پیشنهاد بده که با الگوی فعلی ماتریس سازگار باشد.
خروجی فقط JSON معتبر به شکل [{"trait_id":"...","target_id":"...","value":7,"confidence":0.6,"reason":"..."}] بدون متن اضافه. شناسه‌ها را دقیقاً از فهرست بردار و از امتیازهای موجود همان امتیازدهنده الگو بگیر.`;
      await send(prompt, listRoot, {
        extraContext: ctx,
        onComplete: (text) => {
          const arr = parseJSON(text);
          if (!Array.isArray(arr) || !arr.length) { toast('پاسخ ساختار JSON نداشت', 'warn'); return 0; }
          openFillPreview(arr, rankerId, box);
          return arr.length;
        },
      });
    };
    return;
  }
  if (kind === 'traits') {
    await send('پنج ویژگی پیشنهاد بده که با ماتریس فعلی مکمل باشد و تکرار نکند. فقط JSON: [{"name":"...","category":"...","min_value":0,"max_value":10,"description":"..."}]', listRoot, {
      onComplete: (text) => {
        const arr = parseJSON(text);
        if (!Array.isArray(arr)) { toast('ساختار JSON نبود', 'warn'); return 0; }
        openTraitPreview(arr);
        return arr.length;
      },
    });
    return;
  }
}

function parseJSON(text) {
  const clean = String(text).replace(/```json/gi, '```').trim();
  const fence = clean.match(/```([\s\S]*?)```/);
  const candidate = fence ? fence[1] : clean;
  const start = candidate.search(/[[{]/);
  if (start === -1) return null;
  const open = candidate[start];
  const close = open === '[' ? ']' : '}';
  const end = candidate.lastIndexOf(close);
  if (end <= start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}

function openFillPreview(arr, rankerId, box) {
  const rows = arr.filter((x) => x?.trait_id && x?.target_id && Number.isFinite(Number(x.value))).slice(0, 40);
  const body = `<div style="max-height:46vh;overflow:auto">
    <table class="dtable"><thead><tr><th><input type="checkbox" id="fp-all" checked></th><th>ویژگی</th><th>هدف</th><th>مقدار</th><th>دلیل</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td><input type="checkbox" data-fp="${i}" checked></td>
      <td>${esc(state.traitMap.get(r.trait_id)?.name || r.trait_id.slice(0, 6))}</td>
      <td>${esc(state.peopleMap.get(r.target_id)?.full_name || r.target_id.slice(0, 6))}</td>
      <td><b>${faNum(r.value, 1)}</b></td>
      <td class="muted" style="font-size:10px">${esc(r.reason || '')}</td></tr>`).join('')}
    </tbody></table></div>`;
  openModal({
    title: `پیشنهاد هوش (${fa(rows.length)})`, wide: true, body,
    foot: `<div class="spacer"></div><button class="btn" data-close>انصراف</button><button class="btn btn--primary" id="fp-apply">${icon('check')} اعمال</button>`,
    onMount(node, close) {
      node.querySelector('#fp-all').onchange = (e) => node.querySelectorAll('[data-fp]').forEach((c) => { c.checked = e.target.checked; });
      node.querySelector('#fp-apply').onclick = async () => {
        const picked = [...node.querySelectorAll('[data-fp]')].filter((c) => c.checked).map((c) => rows[+c.dataset.fp]);
        let done = 0;
        for (const r of picked) {
          try {
            await setScore({ traitId: r.trait_id, rankerId, targetId: r.target_id, value: Number(r.value), confidence: Number(r.confidence ?? 0.5), note: r.reason || null, source: 'ai' });
            done++;
          } catch (e) { console.warn(e.message); }
        }
        play('clink2'); haptic([8, 22, 8]);
        toast(`${fa(done)} امتیاز از هوش ثبت شد`, 'ok');
        close();
        window.mx.paintStats();
        logEvent('ai.fill', 'applied', { count: done });
        if ((window.location.hash || '').includes('matrix')) window.mx.rerender(true);
      };
    },
  });
}

function openTraitPreview(arr) {
  const items = arr.filter((x) => x?.name).slice(0, 8);
  const body = `<div style="display:flex;flex-direction:column;gap:7px">
    ${items.map((t, i) => `<label class="kv" style="align-items:flex-start"><input type="checkbox" data-tp="${i}" checked style="margin-top:3px">
      <span style="display:flex;flex-direction:column;gap:2px;flex:1"><b style="font-size:12px">${esc(t.name)}</b>
      <span class="muted" style="font-size:10.5px">${esc(t.description || '')} · ${esc(t.category || 'general')} · ${faNum(t.min_value ?? 0)}–${faNum(t.max_value ?? 10)}</span></span></label>`).join('')}
  </div>`;
  openModal({
    title: 'ویژگی‌های پیشنهادی', wide: true, body,
    foot: `<div class="spacer"></div><button class="btn" data-close>انصراف</button><button class="btn btn--primary" id="tp-apply">${icon('plus')} افزودن</button>`,
    onMount(node, close) {
      node.querySelector('#tp-apply').onclick = async () => {
        const { createTrait } = await import('./data.js');
        const picked = [...node.querySelectorAll('[data-tp]')].filter((c) => c.checked).map((c) => items[+c.dataset.tp]);
        let done = 0;
        for (const t of picked) {
          try { await createTrait({ ...t, sort_order: state.traits.length, color: t.color || '#5ef2d6', icon: t.icon || 'spark' }); done++; } catch (e) { console.warn(e.message); }
        }
        toast(`${fa(done)} ویژگی افزوده شد`, 'ok'); play('clink'); close(); window.mx.reload();
      };
    },
  });
}

/* ---------- key / dock / panel ---------- */
function openKeyModal() {
  const body = `<label class="field"><span>کلید OpenRouter</span>
      <input id="kk" type="password" dir="ltr" placeholder="sk-or-v1-…" value="${esc(getKey())}">
    </label>
    <span class="muted" style="font-size:10.5px">فقط در حافظه همین مرورگر (localStorage) ذخیره می‌شود.</span>
    <div style="display:flex;gap:5px"><button class="btn btn--sm" id="kk-del">${icon('trash')} حذف کلید</button></div>`;
  openModal({
    title: 'کلید مدل آزاد', slim: true, body,
    foot: `<div class="spacer"></div><button class="btn" data-close>بستن</button><button class="btn btn--primary" id="kk-save">${icon('check')} ذخیره</button>`,
    onMount(node, close) {
      node.querySelector('#kk-save').onclick = () => {
        const v = node.querySelector('#kk').value.trim();
        if (!v.startsWith('sk-')) return toast('کلید باید با sk- شروع شود', 'warn');
        setKey(v); play('clink'); toast('کلید ذخیره شد', 'ok'); close();
        document.querySelectorAll('[data-chat]').forEach(() => {});
        window.mx.rerender(true);
      };
      node.querySelector('#kk-del').onclick = () => { setKey(''); toast('کلید حذف شد', 'ok'); close(); window.mx.rerender(true); };
    },
  });
}

let dockMounted = false;
export function toggleDock(force) {
  const el = document.getElementById('aidock');
  if (!el) return;
  if (force === false || (force === undefined && !el.hidden)) { el.hidden = true; return; }
  el.hidden = false;
  if (!dockMounted) {
    el.innerHTML = `<div class="aidock__head">${icon('brain')}<h3>دستیار ماتریس</h3><div class="spacer"></div>
      <button class="iconbtn" id="aidock-close">${icon('x')}</button></div><div id="aidock-mnt" style="flex:1;min-height:0;display:flex;flex-direction:column"></div>`;
    mountChat(el.querySelector('#aidock-mnt'), { compact: true });
    el.querySelector('#aidock-close').onclick = () => { el.hidden = true; };
    dockMounted = true;
  }
  loadModels().then(() => {
    const sel = el.querySelector('[data-ai-model]');
    if (sel) sel.innerHTML = modelOptions();
  });
}
export function closeDock() { const el = document.getElementById('aidock'); if (el) el.hidden = true; }

export function openPanel(kind = 'chat', params = {}) {
  ai.pending = { kind, params };
  window.mx.navigate('ai');
}
export function askAboutCell(ctx) {
  const trait = state.traitMap.get(ctx.traitId);
  const sc = getScore(ctx.traitId, ctx.rankerId, ctx.targetId);
  const dock = document.getElementById('aidock');
  const isOpen = dock && !dock.hidden;
  if (!isOpen) toggleDock(true);
  const extra = `سلول: ${trait?.name}\nامتیازدهنده: ${state.peopleMap.get(ctx.rankerId)?.full_name}\nهدف: ${state.peopleMap.get(ctx.targetId)?.full_name}\nمقدار فعلی: ${sc?.value ?? 'خالی'}\nبازه: ${trait?.min_value}-${trait?.max_value}`;
  ai.draft = 'این سلول را تحلیل کن و مقدار منصفانه پیشنهاد بده.';
  const el = document.getElementById('aidock');
  const root = el?.querySelector('[data-chat]');
  if (root) {
    const input = root.querySelector('[data-ai-input]');
    if (input) input.value = ai.draft;
    send('این سلول را تحلیل کن، مقدار پیشنهادی بده و دلیل کوتاه بنویس. در پایان JSON: {"value":عدد,"confidence":0-1,"reason":"..."}', root, { extraContext: extra });
  }
}

export { norm };
