/**
 * The cinema AI action panel — direct provider call, streamed into the modal.
 *
 * This is the same transport the Studio uses, without a thread: one prompt in,
 * one archived request, resumable output, visible reasoning, and an Apply path
 * for actions that return structured JSON.
 */

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronDown,
  Copy,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Square,
  Wand2,
} from 'lucide-react';
import type { AiAction, AiActionContext, AiThread, RequestSnapshot, StreamEvent, TokenUsage, TurnMeta } from '../types';
import { buildRequest, budgetReport, estimateMessages, parseJsonFromText } from '../ai/request';
import { streamCompletion, errorRecord, isAbort, AiTransportError } from '../ai/client';
import { resolveModel } from '../ai/models';
import { getDb, insertRow, logUsage, logActivity, updateRow } from '../data/store';
import { getApiKey, getSettings, setParams, updateSettings } from '../data/settings';
import { copyText, nowIso, splitList, joinList, safeJsonParse, uid } from '../lib/utils';
import { duration, n, tokens } from '../lib/format';
import { Button, Chip, CopyButton, IconButton, Modal, Notice, Slider, Toggle, useToast, cx, Spinner } from './ui';
import { ModelPicker } from './ModelPicker';
import { Markdown } from './Markdown';

type Phase = 'idle' | 'streaming' | 'complete' | 'stopped' | 'error';

interface RunState {
  content: string;
  reasoning: string;
  phase: Phase;
  error: ReturnType<typeof errorRecord> | null;
  usage: TokenUsage | null;
  meta: TurnMeta | null;
  events: StreamEvent[];
  snapshot: RequestSnapshot | null;
  resumed: number;
  startedAt: number | null;
}

const initialRun: RunState = {
  content: '',
  reasoning: '',
  phase: 'idle',
  error: null,
  usage: null,
  meta: null,
  events: [],
  snapshot: null,
  resumed: 0,
  startedAt: null,
};

export function AiPanel({
  action,
  focusId,
  onClose,
  onSendToStudio,
}: {
  action: AiAction;
  focusId?: string | null;
  onClose: () => void;
  onSendToStudio?: (threadId: string) => void;
}) {
  const db = getDb();
  const settings = getSettings();
  const toast = useToast();
  const [modelId, setModelId] = useState(settings.defaultModel);
  const [params, setLocalParams] = useState(settings.params);
  const [run, setRun] = useState<RunState>(initialRun);
  const [showParams, setShowParams] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ctx: AiActionContext = useMemo(
    () => ({
      titles: db.cinema_titles,
      ratings: db.cinema_ratings,
      sessions: db.cinema_watch_sessions,
      collections: db.cinema_collections,
      quotes: db.cinema_quotes,
      people: db.cinema_people,
      credits: db.cinema_credits,
      watchlist: db.cinema_watchlist,
      goals: db.cinema_goals,
      challenges: db.cinema_challenges,
      focus: focusId ? db.cinema_titles.find((title) => title.id === focusId) : undefined,
    }),
    [db, focusId],
  );

  const promptText = useMemo(() => action.user(ctx), [action, ctx]);
  const model = resolveModel(modelId);
  const budget = useMemo(
    () =>
      budgetReport(
        model,
        [
          { role: 'system', content: action.system },
          { role: 'user', content: promptText },
        ],
        params,
      ),
    [model, action.system, promptText, params],
  );

  const scrollDown = () => {
    requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (element) element.scrollTop = element.scrollHeight;
    });
  };

  const persist = (partial: Partial<RunState>) => {
    setRun((current) => ({ ...current, ...partial }));
  };

  const appendEvent = (event: StreamEvent) => {
    setRun((current) => ({ ...current, events: [...current.events.slice(-80), event] }));
  };

  const runOnce = async (options: { resume?: boolean; retry?: boolean } = {}) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      persist({
        phase: 'error',
        error: {
          kind: 'configuration',
          message: 'No API key stored on this device. Open Settings → Projection booth and add one.',
          at: nowIso(),
          bodyText: '',
        },
      });
      return;
    }

    const baseMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: promptText },
    ];
    if (options.resume && run.content.trim()) {
      baseMessages.push({ role: 'assistant', content: run.content });
      baseMessages.push({
        role: 'user',
        content:
          'Continue the previous response from exactly where it stopped. Do not repeat any completed sentence or heading. Finish the thought and stop.',
      });
    }

    const resumeBase = options.resume ? run.content : '';
    const built = buildRequest({
      model,
      modelId,
      messages: baseMessages,
      params,
      systemPrompt: action.system,
      responseFormat: action.expectsJson ? 'json' : undefined,
      baseUrl: settings.baseUrl,
      stream: params.stream,
    });

    const abort = new AbortController();
    controller.current = abort;

    setRun((current) => ({
      ...current,
      phase: 'streaming',
      error: null,
      events: [],
      snapshot: built.snapshot,
      usage: null,
      meta: null,
      content: resumeBase,
      reasoning: options.resume ? current.reasoning : '',
      resumed: options.resume ? current.resumed + 1 : current.resumed,
      startedAt: options.resume ? current.startedAt : Date.now(),
    }));
    scrollDown();

    let content = resumeBase;
    let reasoning = options.resume ? run.reasoning : '';
    let meta: TurnMeta = {
      started_at: nowIso(),
      model: modelId,
      mode: params.stream ? 'stream' : 'json',
    };
    let usage: TokenUsage | null = null;

    try {
      const result = await streamCompletion({
        snapshot: built.snapshot,
        apiKey,
        baseUrl: settings.baseUrl,
        signal: abort.signal,
        callbacks: {
          onDelta: (delta, full) => {
            content = resumeBase + full;
            persist({ content });
            scrollDown();
          },
          onReasoning: (delta, full) => {
            reasoning = (options.resume ? run.reasoning : '') + full;
            persist({ reasoning });
            scrollDown();
          },
          onMeta: (next) => {
            meta = {
              ...meta,
              started_at: built.snapshot.createdAt,
              model: next.model || meta.model,
              provider: next.provider ?? meta.provider,
              generation_id: next.generation_id ?? meta.generation_id,
              finish_reason: next.finish_reason ?? meta.finish_reason,
              http_status: 200,
            };
            usage = next.usage || usage;
            persist({ usage, meta });
          },
          onEvent: appendEvent,
        },
      });

      const completed: TurnMeta = {
        ...meta,
        started_at: built.snapshot.createdAt,
        completed_at: nowIso(),
        latency_ms: result.latencyMs,
        model: result.model || modelId,
        provider: result.provider,
        generation_id: result.generationId,
        finish_reason: result.finishReason,
        http_status: 200,
        mode: result.mode,
        empty: result.empty,
      };
      const finalUsage: TokenUsage = result.usage || {
        prompt_tokens: built.snapshot.estimatedInputTokens,
        completion_tokens: estimateMessages([{ role: 'assistant', content: result.content }]),
        total_tokens: built.snapshot.estimatedInputTokens + estimateMessages([{ role: 'assistant', content: result.content }]),
        estimated: true,
      };

      if (result.empty) {
        persist({
          phase: 'error',
          content,
          reasoning,
          usage: finalUsage,
          meta: completed,
          error: {
            kind: 'empty',
            message: 'The provider returned an empty completion. Retry, change model, or resume with a stricter instruction.',
            status: 200,
            bodyText: '',
            at: nowIso(),
          },
        });
        return;
      }

      persist({ phase: 'complete', content, reasoning, usage: finalUsage, meta: completed });

      logUsage({
        provider: completed.provider || 'openrouter',
        model: completed.model || modelId,
        prompt_tokens: finalUsage.prompt_tokens,
        completion_tokens: finalUsage.completion_tokens,
        total_tokens: finalUsage.total_tokens,
        latency_ms: completed.latency_ms || 0,
        ok: true,
        reasoning: Boolean(reasoning),
        error: '',
      });

      insertRow('cinema_conversations', {
        title_id: focusId || null,
        title_context: ctx.focus?.title || `Shelf · ${action.label}`,
        prompt: promptText,
        response: content,
        ai_model: completed.model || modelId,
        tags: action.group,
      } as never);
      logActivity('ai', 'cinema_titles', focusId || null, `${action.label} completed on ${completed.model || modelId}`);
    } catch (error) {
      if (isAbort(error)) {
        const partial: TokenUsage = {
          prompt_tokens: built.snapshot.estimatedInputTokens,
          completion_tokens: Math.ceil(content.length / 4),
          total_tokens: built.snapshot.estimatedInputTokens + Math.ceil(content.length / 4),
          estimated: true,
        };
        persist({
          phase: 'stopped',
          content,
          reasoning,
          usage: partial,
          meta: { ...meta, finish_reason: 'aborted-by-user', completed_at: nowIso() },
        });
        logUsage({
          provider: meta.provider || 'openrouter',
          model: meta.model || modelId,
          prompt_tokens: partial.prompt_tokens,
          completion_tokens: partial.completion_tokens,
          total_tokens: partial.total_tokens,
          latency_ms: meta.latency_ms || 0,
          ok: false,
          reasoning: Boolean(reasoning),
          error: 'Stopped by operator',
        });
        return;
      }
      const record = error instanceof AiTransportError ? error.details : errorRecord(error);
      persist({ phase: 'error', content, reasoning, error: record, meta: { ...meta, completed_at: nowIso() } });
      logUsage({
        provider: record.provider || 'openrouter',
        model: meta.model || modelId,
        prompt_tokens: built.snapshot.estimatedInputTokens,
        completion_tokens: Math.ceil(content.length / 4),
        total_tokens: built.snapshot.estimatedInputTokens + Math.ceil(content.length / 4),
        latency_ms: record.latencyMs || 0,
        ok: false,
        reasoning: Boolean(reasoning),
        error: `${record.kind}: ${record.message}`,
      });
    } finally {
      controller.current = null;
    }
  };

  const stop = () => {
    controller.current?.abort();
  };

  const apply = () => {
    const parsed = parseJsonFromText(run.content);
    if (parsed.error || !parsed.data) {
      toast.push({ tone: 'warn', title: 'No JSON to apply', body: parsed.error || 'The reply did not parse.' });
      return;
    }
    const data = parsed.data as Record<string, any>;
    const focus = ctx.focus;
    try {
      if (action.id === 'standardise' && focus) {
        const patch: Record<string, unknown> = { ai_standardized_at: nowIso() };
        if (data.original_title) patch.original_title = String(data.original_title);
        if (data.year) patch.year = Number(data.year);
        if (data.country) patch.country = String(data.country);
        if (data.language) patch.language = String(data.language);
        if (data.runtime) patch.runtime = Number(data.runtime);
        if (data.seasons) patch.seasons = Number(data.seasons);
        if (data.episodes) patch.episodes = Number(data.episodes);
        if (data.genre) patch.genre = String(data.genre);
        if (data.tags) patch.tags = joinList([...splitList(focus.tags), ...splitList(String(data.tags))]);
        if (data.summary) patch.summary = String(data.summary);
        updateRow('cinema_titles', focus.id, patch as never);
        toast.push({ tone: 'success', title: 'Metadata applied', body: `${Object.keys(patch).length - 1} fields updated.` });
      } else if (action.id === 'tags' && focus && Array.isArray(data.tags)) {
        const additions = data.tags
          .map((item: unknown) => (typeof item === 'string' ? item : (item as { tag?: string })?.tag))
          .filter(Boolean) as string[];
        updateRow('cinema_titles', focus.id, { tags: joinList([...splitList(focus.tags), ...additions]) } as never);
        toast.push({ tone: 'success', title: 'Tags merged', body: additions.join(', ') });
      } else if (action.id === 'quotes' && focus && Array.isArray(data.quotes)) {
        let count = 0;
        for (const quote of data.quotes as Array<Record<string, unknown>>) {
          if (!quote?.text) continue;
          insertRow('cinema_quotes', {
            title_id: focus.id,
            text: String(quote.text),
            speaker: String(quote.speaker || ''),
            at_minute: quote.at_minute ? Number(quote.at_minute) : null,
            favorite: false,
          } as never);
          count += 1;
        }
        toast.push({ tone: 'success', title: `${count} quote${count === 1 ? '' : 's'} saved`, body: 'Marked by model confidence in the reply.' });
      } else if (action.id === 'trivia' && focus && Array.isArray(data.trivia)) {
        let count = 0;
        for (const item of data.trivia as Array<Record<string, unknown>>) {
          if (!item?.content) continue;
          insertRow('cinema_trivia', {
            title_id: focus.id,
            content: String(item.content),
            source: String(item.source || 'unverified'),
          } as never);
          count += 1;
        }
        toast.push({ tone: 'success', title: `${count} trivia note${count === 1 ? '' : 's'} saved` });
      } else if (action.id === 'relationships' && focus && Array.isArray(data.relations)) {
        const ids = new Set(db.cinema_titles.map((title) => title.id));
        let count = 0;
        for (const relation of data.relations as Array<Record<string, unknown>>) {
          const target = String(relation.title_id || '');
          if (!ids.has(target) || target === focus.id) continue;
          insertRow('cinema_relationships', {
            title_id: focus.id,
            related_title_id: target,
            kind: String(relation.kind || 'spiritual-twin'),
            weight: Math.max(0, Math.min(1, Number(relation.weight) || 0.5)),
          } as never);
          count += 1;
        }
        toast.push({ tone: 'success', title: `${count} relation${count === 1 ? '' : 's'} added` });
      } else if (action.id === 'curate' && data.name && Array.isArray(data.items)) {
        const collection = insertRow('cinema_collections', {
          name: String(data.name).slice(0, 120),
          description: String(data.description || ''),
          color: String(data.color || '#d8ff3e'),
          icon: String(data.icon || '◈').slice(0, 2),
          is_public: false,
          sort_order: db.cinema_collections.length,
        } as never);
        const ids = new Set(db.cinema_titles.map((title) => title.id));
        let position = 0;
        for (const item of data.items as Array<Record<string, unknown>>) {
          const titleId = String(item.title_id || '');
          if (!ids.has(titleId)) continue;
          insertRow('cinema_collection_items', {
            collection_id: (collection as { id: string }).id,
            title_id: titleId,
            position,
            note: String(item.note || ''),
          } as never);
          position += 1;
        }
        toast.push({ tone: 'success', title: 'Collection created', body: `${String(data.name)} · ${position} titles` });
      } else if (action.id === 'challenge' && data.name) {
        insertRow('cinema_challenges', {
          name: String(data.name),
          description: String(data.description || ''),
          rule: (data.rule || {}) as Record<string, unknown>,
          progress: 0,
          target: Number(data.target) || 10,
          status: 'active',
        } as never);
        toast.push({ tone: 'success', title: 'Challenge forged', body: String(data.name) });
      } else {
        toast.push({
          tone: 'info',
          title: 'Parsed, but not auto-applied',
          body: 'This action returns reflective output. Copy it into a field, or ask the booth to apply a specific part.',
        });
        return;
      }
      logActivity('ai', 'cinema_titles', focus?.id || null, `Applied ${action.label}`);
    } catch (error) {
      toast.push({ tone: 'error', title: 'Could not apply', body: (error as Error)?.message || 'Unknown error' });
    }
  };

  const sendToStudio = () => {
    const thread = insertRow('cinema_ai_threads', {
      title: `${action.label}${ctx.focus ? ` · ${ctx.focus.title}` : ''}`,
      title_id: ctx.focus?.id || null,
      model: modelId,
      system: action.system,
      params,
      tags: action.group,
      pinned: false,
      archived: false,
      branch_of: null,
      last_at: nowIso(),
    } as never) as AiThread;
    insertRow('cinema_ai_turns', {
      thread_id: thread.id,
      parent_id: null,
      role: 'user',
      content: promptText,
      reasoning: '',
      status: 'complete',
      model: modelId,
      requested_model: modelId,
      provider: null,
      continue_of: null,
      usage: null,
      request: null,
      error: null,
      meta: null,
    } as never);
    if (run.content) {
      insertRow('cinema_ai_turns', {
        thread_id: thread.id,
        parent_id: null,
        role: 'assistant',
        content: run.content,
        reasoning: run.reasoning,
        status: 'complete',
        model: run.meta?.model || modelId,
        requested_model: modelId,
        provider: run.meta?.provider || null,
        continue_of: null,
        usage: run.usage,
        request: run.snapshot,
        error: null,
        meta: run.meta,
      } as never);
    }
    toast.push({ tone: 'success', title: 'Sent to the booth', body: 'The thread is open in the AI studio.' });
    onSendToStudio?.(thread.id);
  };

  const phaseBadge: Record<Phase, { label: string; tone?: 'live' | 'danger' | 'success' }> = {
    idle: { label: 'Ready' },
    streaming: { label: 'Streaming', tone: 'live' },
    complete: { label: 'Complete', tone: 'success' },
    stopped: { label: 'Stopped', tone: 'danger' },
    error: { label: 'Error', tone: 'danger' },
  };

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Sparkles size={17} style={{ color: 'var(--accent)' }} />
          {action.label}
        </span>
      }
      subtitle={`${action.hint}${ctx.focus ? ` · ${ctx.focus.title}` : ' · whole shelf'}`}
      onClose={onClose}
      size="lg"
      actions={
        <>
          <span className="modal__foot-info">
            {run.phase === 'complete' && run.meta?.latency_ms ? `${duration(run.meta.latency_ms)} · ${tokens(run.usage?.total_tokens || 0)} tokens` : action.expectsJson ? 'Structured JSON output' : 'Prose output'}
          </span>
          {run.phase === 'streaming' ? (
            <Button variant="danger" icon={<Square size={12} />} onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={<Wand2 size={13} />}
              onClick={() => runOnce({ retry: run.phase === 'complete' })}
            >
              {run.phase === 'idle' ? 'Run' : run.phase === 'complete' ? 'Run again' : 'Retry'}
            </Button>
          )}
          {(run.phase === 'stopped' || run.phase === 'error') && run.content && (
            <Button variant="outline" icon={<RotateCcw size={12} />} onClick={() => runOnce({ resume: true })}>
              Resume
            </Button>
          )}
          {action.expectsJson && run.phase === 'complete' && (
            <Button icon={<Check size={13} />} onClick={apply}>
              Apply
            </Button>
          )}
          <Button variant="ghost" icon={<Save size={12} />} onClick={sendToStudio} disabled={!run.content}>
            Studio
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="row row--between row--wrap">
          <div className="row" style={{ gap: 6 }}>
            <Chip mono active={phaseBadge[run.phase].tone === 'live'}>
              {run.phase === 'streaming' && <Spinner size={10} />}
              {phaseBadge[run.phase].label}
            </Chip>
            {run.resumed > 0 && <Chip sm mono>resumed ×{run.resumed}</Chip>}
            {action.expectsJson && <Chip sm mono>JSON</Chip>}
            {run.reasoning && <Chip sm mono>thinking</Chip>}
            {run.meta?.model && run.meta.model !== modelId && <Chip sm mono>answered: {run.meta.model}</Chip>}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <div style={{ width: 220 }}>
              <ModelPicker value={modelId} onChange={setModelId} compact />
            </div>
            <IconButton label="Generation settings" active={showParams} onClick={() => setShowParams((value) => !value)}>
              <Settings2 size={14} />
            </IconButton>
          </div>
        </div>

        {showParams && (
          <div className="panel panel--flat" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Slider
                label="Temperature"
                value={params.temperature}
                min={0}
                max={2}
                step={0.05}
                display={params.temperature.toFixed(2)}
                onChange={(value) => {
                  setLocalParams((current) => ({ ...current, temperature: value }));
                  setParams({ temperature: value });
                }}
                hint={params.temperature < 0.4 ? 'Literal, repeatable.' : params.temperature > 1.1 ? 'Loose and associative.' : 'Balanced.'}
              />
              <Slider
                label="Top-p"
                value={params.top_p}
                min={0.1}
                max={1}
                step={0.05}
                display={params.top_p.toFixed(2)}
                onChange={(value) => {
                  setLocalParams((current) => ({ ...current, top_p: value }));
                  setParams({ top_p: value });
                }}
              />
            </div>
            <div>
              <div className="param-row">
                <div className="param-row__head">
                  <span>Max tokens</span>
                  <b>{params.max_tokens === 'auto' ? 'auto' : n(params.max_tokens)}</b>
                </div>
                <Toggle
                  checked={params.max_tokens === 'auto'}
                  onChange={(auto) => {
                    const next = auto ? 'auto' : budget.autoMax;
                    setLocalParams((current) => ({ ...current, max_tokens: next }));
                    setParams({ max_tokens: next });
                  }}
                  label="Automatic output budget"
                />
                {params.max_tokens !== 'auto' && (
                  <input
                    className="param-number"
                    type="number"
                    min={64}
                    max={model.maxCompletionTokens || 32768}
                    value={params.max_tokens}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setLocalParams((current) => ({ ...current, max_tokens: value }));
                      setParams({ max_tokens: value });
                    }}
                    style={{ marginTop: 6 }}
                  />
                )}
              </div>
              <Toggle
                checked={params.reasoning}
                onChange={(reasoning) => {
                  setLocalParams((current) => ({ ...current, reasoning }));
                  setParams({ reasoning });
                }}
                label="Request internal reasoning"
              />
              <div className="budget" style={{ marginTop: 10 }}>
                <div className="budget__row">
                  <span>Projected input</span>
                  <b>{tokens(budget.inputTokens)} tokens</b>
                </div>
                <div className="budget__row">
                  <span>Completion budget</span>
                  <b>{tokens(budget.autoMax)}</b>
                </div>
                <div className="meter meter--thin">
                  <div className="meter__fill" style={{ width: `${Math.min(100, budget.pct || 0)}%` }} />
                </div>
                <div className="param-row__hint">{budget.note}</div>
              </div>
            </div>
          </div>
        )}

        <div className="panel panel--flat" style={{ padding: 0 }}>
          <button
            type="button"
            className="thinking__head"
            onClick={() => setShowPrompt((value) => !value)}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <Sparkles size={12} style={{ color: 'var(--accent)' }} />
            <span className="thinking__label">Exact prompt sent</span>
            <span className="thinking__meta">{promptText.length.toLocaleString()} chars</span>
            <ChevronDown size={12} style={{ transform: showPrompt ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
          </button>
          {showPrompt && (
            <div style={{ padding: '0 13px 12px' }}>
              <pre className="codeblock codeblock--wrap" style={{ maxHeight: 220 }}>
                {promptText}
              </pre>
              <div style={{ marginTop: 6 }}>
                <CopyButton text={promptText} label="Copy prompt" />
              </div>
            </div>
          )}
        </div>

        {run.reasoning && (
          <div className="thinking">
            <button type="button" className="thinking__head" onClick={() => setShowThinking((value) => !value)}>
              <span className="thinking__pulse" />
              <Brain size={12} style={{ color: 'var(--accent)' }} />
              <span className="thinking__label">Internal thinking</span>
              <span className="thinking__meta">
                {run.reasoning.length.toLocaleString()} chars · {run.phase === 'streaming' ? 'live' : 'archived'}
              </span>
              <ChevronDown size={12} style={{ transform: showThinking ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
            </button>
            {showThinking && <div className="thinking__body">{run.reasoning}</div>}
          </div>
        )}

        <div
          ref={scrollRef}
          className="scroll-y"
          style={{ maxHeight: '42vh', minHeight: 130, paddingRight: 4 }}
        >
          {run.content ? (
            <>
              <Markdown text={run.content} />
              {run.phase === 'streaming' && <span className="stream-caret" />}
            </>
          ) : run.phase === 'idle' ? (
            <div className="empty" style={{ padding: 'var(--sp-6)' }}>
              <Sparkles size={20} />
              <div className="empty__title">The booth is ready</div>
              <p className="empty__text">
                Nothing is sent until you press Run. The exact prompt above is what the model will receive, plus the system
                instruction and the sampling settings shown here.
              </p>
            </div>
          ) : run.phase === 'streaming' ? (
            <div className="row" style={{ gap: 8, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              <Spinner /> Waiting for the first token…
            </div>
          ) : null}
        </div>

        {run.error && (
          <Notice tone="danger" icon={<AlertTriangle size={14} />}>
            <strong>{run.error.kind.toUpperCase()}</strong> · {run.error.message}
            {run.error.status ? ` (HTTP ${run.error.status})` : ''}
            {run.error.bodyText && (
              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  className="section-link"
                  onClick={() => setShowRaw((value) => !value)}
                  style={{ color: 'var(--danger)' }}
                >
                  {showRaw ? 'Hide raw body' : 'Show raw provider body'}
                </button>
                {showRaw && <pre className="codeblock codeblock--wrap" style={{ marginTop: 6 }}>{run.error.bodyText}</pre>}
              </div>
            )}
          </Notice>
        )}

        {run.phase !== 'idle' && (
          <div className="row row--between" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-4)' }}>
            <span>
              {run.usage ? `${tokens(run.usage.prompt_tokens)} in · ${tokens(run.usage.completion_tokens)} out` : 'no usage yet'}
              {run.usage?.estimated ? ' (estimated)' : ''}
            </span>
            <span className="row" style={{ gap: 10 }}>
              {run.snapshot && <span>req {run.snapshot.id.slice(-8)}</span>}
              {run.content && <CopyButton text={run.content} label="Copy reply" />}
            </span>
          </div>
        )}

        {run.events.length > 0 && (
          <details>
            <summary className="section-link" style={{ cursor: 'pointer' }}>
              Stream log · {run.events.length} events
            </summary>
            <div className="event-log" style={{ marginTop: 8 }}>
              {run.events.map((event, index) => (
                <div className="event-log__row" data-kind={event.kind} key={`${event.at}-${index}`}>
                  <span className="event-log__time">{event.at.slice(11, 19)}</span>
                  <span className="event-log__kind">{event.kind}</span>
                  <span className="event-log__detail">
                    {event.label}
                    {event.detail ? ` — ${event.detail}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {!getApiKey() && (
          <Notice tone="warn" icon={<AlertTriangle size={14} />}>
            No key is stored. Add one in <strong>Settings → Projection booth</strong>. Requests go straight from this
            browser to the provider; there is no proxy.
          </Notice>
        )}
      </div>
    </Modal>
  );
}

