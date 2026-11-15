/**
 * The projection booth.
 *
 * A real chat surface with direct provider calls: streaming, live reasoning,
 * stop, resume, regenerate, prompt branching, exact-request inspection, a
 * context budget, and a local key that never leaves the browser.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Brain,
  ChevronDown,
  Copy,
  Cpu,
  Edit3,
  FileJson,
  Flag,
  History,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Square,
  TerminalSquare,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { navigate } from '../app/router';
import { deleteThread, removeRows, updateRow, useDb } from '../data/store';
import { getApiKey, getSettings, hasApiKey, setParams, useSettings } from '../data/settings';
import { buildRequest, budgetReport, curlFor, estimateTokens } from '../ai/request';
import { resolveModel, useModelCatalogue } from '../ai/models';
import {
  autoTitle,
  newThread,
  pruneBranch,
  rootToLeaf,
  runTurn,
  siblingsOf,
  threadTurns,
  toRequestMessages,
} from '../ai/threads';
import { CRITIC_SYSTEM, STARTER_PROMPTS } from '../ai/prompts';
import type { AiThread, AiTurn, GenerationParams, RequestSnapshot, StreamEvent, TurnMeta } from '../types';
import { DEFAULT_PARAMS } from '../types';
import { copyText, nowIso, truncate } from '../lib/utils';
import {
  contextWindow,
  dateTime,
  duration,
  n,
  relative,
  tokens,
} from '../lib/format-extra';
import { Markdown } from '../components/Markdown';
import { ModelPicker } from '../components/ModelPicker';
import {
  Button,
  Chip,
  IconButton,
  Kbd,
  Modal,
  Notice,
  Slider,
  Spinner,
  Toggle,
  Tooltip,
  cx,
  useConfirm,
  useHotkey,
  useToast,
} from '../components/ui';

export function Studio({ threadId: initialThreadId }: { threadId?: string }) {
  const db = useDb();
  const settings = useSettings();
  const models = useModelCatalogue();
  const toast = useToast();
  const confirm = useConfirm();

  const threads = useMemo(
    () =>
      [...db.cinema_ai_threads].sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.last_at.localeCompare(a.last_at),
      ),
    [db.cinema_ai_threads],
  );
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId || threads[0]?.id);
  const thread = db.cinema_ai_threads.find((item) => item.id === threadId) || threads[0];
  const turns = useMemo(() => (thread ? threadTurns(thread.id) : []), [db.cinema_ai_turns, thread?.id]);
  const [leafId, setLeafId] = useState<string | null>(null);
  const path = useMemo(() => rootToLeaf(turns, leafId || turns[turns.length - 1]?.id), [turns, leafId]);
  const lastTurn = path[path.length - 1];

  const [composer, setComposer] = useState('');
  const [modelId, setModelId] = useState(thread?.model || settings.defaultModel);
  const [params, setLocalParams] = useState<GenerationParams>(thread?.params || settings.params);
  const [streaming, setStreaming] = useState(false);
  const [streamingTurn, setStreamingTurn] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<AiTurn | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [branch, setBranch] = useState<{ parentId: string | null; text: string } | null>(null);
  const [threadSearch, setThreadSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const keyPresent = hasApiKey();
  const model = resolveModel(modelId);
  const budget = useMemo(
    () =>
      budgetReport(
        model,
        toRequestMessages(path, composer ? [{ role: 'user', content: composer }] : []),
        params,
      ),
    [model, path, composer, params],
  );

  useEffect(() => {
    if (!initialThreadId) return;
    setThreadId(initialThreadId);
  }, [initialThreadId]);

  useEffect(() => {
    if (!thread) return;
    setLeafId(null);
    setModelId(thread.model);
    setLocalParams(thread.params || DEFAULT_PARAMS);
    setComposer(window.localStorage.getItem(`fmc.draft.${thread.id}`) || '');
  }, [thread?.id]);

  useEffect(() => {
    if (!thread) return;
    try {
      window.localStorage.setItem(`fmc.draft.${thread.id}`, composer);
    } catch {
      /* draft cache is optional */
    }
  }, [composer, thread?.id]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (pinnedToBottom.current) element.scrollTop = element.scrollHeight;
  }, [path.length, path[path.length - 1]?.content, streaming]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onScroll = () => {
      pinnedToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, []);

  const filteredThreads = useMemo(() => {
    const needle = threadSearch.trim().toLowerCase();
    return threads
      .filter((item) => (showArchived ? item.archived : !item.archived))
      .filter((item) => !needle || item.title.toLowerCase().includes(needle));
  }, [threads, threadSearch, showArchived]);

  const updateParams = (patch: Partial<GenerationParams>) => {
    const next = { ...params, ...patch };
    setLocalParams(next);
    if (thread) updateRow('cinema_ai_threads', thread.id, { params: next });
    setParams(patch);
  };

  const changeModel = (next: string) => {
    setModelId(next);
    if (thread) updateRow('cinema_ai_threads', thread.id, { model: next });
  };

  const scrollToBottom = () => {
    pinnedToBottom.current = true;
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  };

  const launch = async (
    text: string,
    options: { mode?: 'normal' | 'regenerate' | 'continue'; parentId?: string | null; turn?: AiTurn } = {},
  ) => {
    if (!thread) return;
    const apiKey = getApiKey();
    if (!apiKey) {
      toast.push({
        tone: 'error',
        title: 'No provider key',
        body: 'Add a key in Settings → Projection booth. Requests go directly from this browser.',
      });
      navigate('settings', undefined, 'tab=ai');
      return;
    }
    if (streaming) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setEvents([]);
    setComposer('');
    setBranch(null);
    scrollToBottom();
    try {
      const result = await runTurn({
        thread,
        turns,
        parentId: options.parentId ?? (leafId || turns[turns.length - 1]?.id || null),
        userText: text,
        modelId,
        params,
        systemPrompt: thread.system || settings.systemPrompt,
        apiKey,
        baseUrl: settings.baseUrl,
        signal: controller.signal,
        mode: options.mode || 'normal',
        continueFrom: options.turn,
        onUserTurn: () => scrollToBottom(),
        onAssistantTurn: (turn) => {
          setStreamingTurn(turn.id);
          scrollToBottom();
        },
        onEvent: (event) => setEvents((current) => [...current.slice(-60), event]),
        responseFormat: undefined,
      });
      if (result.assistantTurn) setLeafId(result.assistantTurn.id);
      if (result.status === 'error' && result.error) {
        toast.push({ tone: 'error', title: 'Request failed', body: result.error.message });
      }
      if (result.status === 'stopped') {
        toast.push({ tone: 'info', title: 'Stopped', body: 'Partial output is saved. Resume continues from this exact point.' });
      }
      if (thread.title === 'Untitled thread') {
        updateRow('cinema_ai_threads', thread.id, { title: autoTitle(text || 'New thread') });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setStreamingTurn(null);
    }
  };

  const send = () => {
    const text = composer.trim();
    if (!text || streaming) return;
    void launch(text, { parentId: branch?.parentId ?? null });
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const regenerate = (turn: AiTurn) => {
    if (!turn.parent_id) return;
    void launch('', { mode: 'regenerate', parentId: turn.parent_id });
  };

  const resume = (turn: AiTurn) => {
    void launch('', { mode: 'continue', parentId: turn.id, turn });
  };

  const startBranch = (turn: AiTurn) => {
    setBranch({ parentId: turn.parent_id, text: turn.content });
    setComposer(turn.content);
    composerRef.current?.focus();
  };

  const newThreadNow = () => {
    if (!thread) return;
    const created = newThread({
      model: modelId,
      system: settings.systemPrompt,
      params,
    });
    setThreadId(created.id);
    setLeafId(null);
    toast.push({ tone: 'success', title: 'New thread', body: 'The booth is listening.' });
  };

  const activeSiblings = (turn: AiTurn): AiTurn[] => siblingsOf(turns, turn);

  const switchSibling = (turn: AiTurn, direction: -1 | 1) => {
    const siblings = activeSiblings(turn);
    if (siblings.length < 2) return;
    const index = siblings.findIndex((item) => item.id === turn.id);
    const next = siblings[(index + direction + siblings.length) % siblings.length];
    if (!next) return;
    // Follow the chosen branch to its deepest leaf.
    let cursor = next.id;
    for (let guard = 0; guard < 200; guard += 1) {
      const children = turns.filter((item) => item.parent_id === cursor);
      if (!children.length) break;
      cursor = children[children.length - 1].id;
    }
    setLeafId(cursor);
  };

  useHotkey('mod+enter', send);
  useHotkey('mod+shift+backspace', () => thread && setConfirmPurge(true));

  if (!thread) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="eyebrow">Intelligence</div>
            <h1 className="page-title">The booth</h1>
            <p className="page-sub">No threads yet. Start one and the room will assemble itself.</p>
          </div>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={14} />}
          onClick={() =>
            newThread({ model: settings.defaultModel, system: settings.systemPrompt, params: settings.params })
          }
        >
          Open a thread
        </Button>
      </>
    );
  }

  return (
    <>
      <div className="studio">
        <aside className="studio__rail">
          <div className="studio__rail-head">
            <div className="studio__rail-title">
              <span>Threads</span>
              <button className="icon-btn icon-btn--sm" onClick={newThreadNow} title="New thread">
                <Plus size={13} />
              </button>
            </div>
            <input
              className="param-number"
              placeholder="Search threads…"
              value={threadSearch}
              onChange={(event) => setThreadSearch(event.target.value)}
            />
            <button className="section-link" onClick={() => setShowArchived((value) => !value)}>
              <Archive size={10} /> {showArchived ? 'showing archived' : 'active threads'}
            </button>
          </div>
          <div className="studio__threads">
            {filteredThreads.map((item) => {
              const itemTurns = db.cinema_ai_turns.filter((turn) => turn.thread_id === item.id);
              const last = itemTurns[itemTurns.length - 1];
              return (
                <button
                  key={item.id}
                  className={cx('thread-item', item.id === thread.id && 'is-active')}
                  onClick={() => setThreadId(item.id)}
                >
                  <span className="thread-item__title">
                    {item.pinned && <Pin size={9} style={{ color: 'var(--accent)' }} />}
                    {item.title}
                  </span>
                  <span className="thread-item__meta">
                    {item.model.split('/').pop()} · {relative(item.last_at)}
                  </span>
                  <span className="thread-item__preview">{truncate(last?.content || 'No turns yet', 52)}</span>
                </button>
              );
            })}
            {!filteredThreads.length && (
              <p className="faint" style={{ padding: 10, fontSize: 10 }}>No threads match.</p>
            )}
          </div>
          <div style={{ padding: 10, borderTop: '1px solid var(--border-1)' }}>
            <div className="mono" style={{ fontSize: 8.5, color: 'var(--text-4)', lineHeight: 1.7 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>key</span>
                <span style={{ color: keyPresent ? 'var(--success)' : 'var(--danger)' }}>{keyPresent ? 'on device' : 'missing'}</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>provider</span>
                <span style={{ color: 'var(--text-3)' }}>{new URL(settings.baseUrl).host}</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>threads</span>
                <span style={{ color: 'var(--text-3)' }}>{threads.length}</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="studio__main">
          <div className="studio__head">
            <div className="studio__head-copy">
              <div className="studio__head-title">{thread.title}</div>
              <div className="studio__head-meta">
                <span>{model.name}</span>
                <span>·</span>
                <span>{contextWindow(model.contextLength)} ctx</span>
                <span>·</span>
                <span>{path.length} turns in branch</span>
                {streaming && (
                  <>
                    <span>·</span>
                    <span style={{ color: 'var(--accent)' }}>streaming</span>
                  </>
                )}
              </div>
            </div>
            <div className="row" style={{ gap: 3 }}>
              <Tooltip data-tip="Context budget">
                <IconButton label="Context budget" onClick={() => setContextOpen(true)}>
                  <Cpu size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip data-tip={thread.pinned ? 'Unpin' : 'Pin thread'}>
                <IconButton
                  label="Pin thread"
                  active={thread.pinned}
                  onClick={() => updateRow('cinema_ai_threads', thread.id, { pinned: !thread.pinned })}
                >
                  <Pin size={13} />
                </IconButton>
              </Tooltip>
              <IconButton
                label={thread.archived ? 'Unarchive' : 'Archive'}
                onClick={() => updateRow('cinema_ai_threads', thread.id, { archived: !thread.archived })}
              >
                <Archive size={13} />
              </IconButton>
              <IconButton label="Generation settings" active={paramsOpen} onClick={() => setParamsOpen((value) => !value)} className="studio-params-toggle">
                <Settings2 size={14} />
              </IconButton>
            </div>
          </div>

          <div className="chat-scroll" ref={scrollRef}>
            <div className="chat-inner">
              {path.length === 0 && (
                <div className="chat-empty">
                  <div className="chat-empty__mark">
                    <Sparkles size={22} />
                  </div>
                  <h2>What should the booth look at?</h2>
                  <p>
                    Every reply comes straight from the model you choose. Reasoning streams into its own panel; the exact
                    request body is archived for inspection. Nothing is proxied.
                  </p>
                  {!keyPresent && (
                    <div style={{ marginTop: 16 }}>
                      <Notice tone="warn">
                        No key yet. <button className="section-link" style={{ color: 'var(--accent)' }} onClick={() => navigate('settings', undefined, 'tab=ai')}>Add one</button> to arm the booth.
                      </Notice>
                    </div>
                  )}
                  <div className="starter-grid">
                    {STARTER_PROMPTS.slice(0, 4).map((starter) => (
                      <button
                        key={starter.label}
                        className="starter-card"
                        onClick={() => {
                          setComposer(starter.body);
                          composerRef.current?.focus();
                        }}
                      >
                        <Sparkles size={13} />
                        <span>{starter.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="row" style={{ justifyContent: 'center', marginTop: 16, gap: 6 }}>
                    <Chip mono sm>streaming</Chip>
                    <Chip mono sm>reasoning</Chip>
                    <Chip mono sm>resume</Chip>
                    <Chip mono sm>exact requests</Chip>
                  </div>
                </div>
              )}

              {path.map((turn) => {
                const siblings = activeSiblings(turn);
                const isStreaming = streamingTurn === turn.id;
                const thinkingOpen = expandedThinking[turn.id] ?? settings.reasoningExpanded;
                const isError = turn.status === 'error';
                return (
                  <div
                    key={turn.id}
                    className={cx('msg', turn.role === 'user' ? 'msg--user' : 'msg--assistant')}
                    data-turn={turn.id}
                  >
                    <div className="msg__head">
                      <b>{turn.role === 'user' ? 'You' : turn.model?.split('/').pop() || 'Assistant'}</b>
                      {turn.role === 'assistant' && (
                        <>
                          <span>{turn.provider || 'direct'}</span>
                          <span>·</span>
                          <span>{relative(turn.created_at)}</span>
                          {turn.usage && (
                            <>
                              <span>·</span>
                              <span>{tokens(turn.usage.total_tokens)} tok</span>
                            </>
                          )}
                          {turn.meta?.latency_ms ? (
                            <>
                              <span>·</span>
                              <span>{duration(turn.meta.latency_ms)}</span>
                            </>
                          ) : null}
                          {turn.continue_of && <span className="turn-status turn-status--stopped">resumed</span>}
                          {turn.status === 'stopped' && <span className="turn-status turn-status--stopped">stopped</span>}
                          {isError && <span className="turn-status turn-status--error">error</span>}
                          {isStreaming && (
                            <span className="turn-status turn-status--streaming">
                              <span className="thinking__pulse" /> live
                            </span>
                          )}
                        </>
                      )}
                      <span className="spacer" />
                      {siblings.length > 1 && (
                        <span className="row" style={{ gap: 1 }}>
                          <button className="icon-btn icon-btn--sm" onClick={() => switchSibling(turn, -1)} aria-label="Previous branch">
                            <ArrowUp size={10} style={{ transform: 'rotate(-90deg)' }} />
                          </button>
                          <span className="mono" style={{ fontSize: 8 }}>
                            {siblings.findIndex((item) => item.id === turn.id) + 1}/{siblings.length}
                          </span>
                          <button className="icon-btn icon-btn--sm" onClick={() => switchSibling(turn, 1)} aria-label="Next branch">
                            <ArrowDown size={10} style={{ transform: 'rotate(-90deg)' }} />
                          </button>
                        </span>
                      )}
                    </div>

                    {turn.role === 'assistant' && turn.reasoning && (
                      <div className="thinking">
                        <button
                          className="thinking__head"
                          onClick={() => setExpandedThinking((current) => ({ ...current, [turn.id]: !thinkingOpen }))}
                        >
                          {isStreaming && <span className="thinking__pulse" />}
                          <Brain size={12} style={{ color: 'var(--accent)' }} />
                          <span className="thinking__label">Internal thinking</span>
                          <span className="thinking__meta">
                            {tokens(estimateTokens(turn.reasoning))} tokens · {thinkingOpen ? 'expanded' : 'collapsed'}
                          </span>
                          <ChevronDown
                            size={12}
                            style={{ transform: thinkingOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}
                          />
                        </button>
                        {thinkingOpen && <div className="thinking__body">{turn.reasoning}</div>}
                      </div>
                    )}

                    <div className="msg__body">
                      {turn.role === 'user' ? (
                        turn.content
                      ) : turn.content ? (
                        <>
                          <Markdown text={turn.content} />
                          {isStreaming && <span className="stream-caret" />}
                        </>
                      ) : isStreaming ? (
                        <span className="row" style={{ gap: 7, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                          <Spinner /> waiting for first token
                        </span>
                      ) : isError ? (
                        <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
                          No content was received.
                        </span>
                      ) : (
                        <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
                          Empty response.
                        </span>
                      )}
                    </div>

                    {turn.role === 'assistant' && turn.error && (
                      <div className="notice notice--danger" style={{ marginTop: 4 }}>
                        <span style={{ fontWeight: 700 }}>{turn.error.kind}</span>
                        <span>{turn.error.message}</span>
                        <button className="section-link" style={{ marginLeft: 'auto', color: 'var(--danger)' }} onClick={() => setInspecting(turn)}>
                          raw
                        </button>
                      </div>
                    )}

                    <div className="msg__actions">
                      {turn.role === 'assistant' && turn.content && (
                        <button
                          className="action-label"
                          onClick={async () => {
                            await copyText(turn.content);
                            toast.push({ tone: 'success', title: 'Copied reply' });
                          }}
                        >
                          <Copy size={10} /> copy
                        </button>
                      )}
                      {turn.role === 'assistant' && (
                        <button className="action-label" onClick={() => setInspecting(turn)}>
                          <FileJson size={10} /> request
                        </button>
                      )}
                      {turn.role === 'assistant' && (turn.status === 'stopped' || turn.status === 'error' || turn.meta?.finish_reason === 'length') && (
                        <button className="action-label" onClick={() => resume(turn)} disabled={streaming}>
                          <Flag size={10} /> resume
                        </button>
                      )}
                      {turn.role === 'assistant' && (
                        <button className="action-label" onClick={() => regenerate(turn)} disabled={streaming}>
                          <RefreshCw size={10} /> regenerate
                        </button>
                      )}
                      {turn.role === 'user' && (
                        <button className="action-label" onClick={() => startBranch(turn)}>
                          <Edit3 size={10} /> edit branch
                        </button>
                      )}
                      {turn.role === 'user' && (
                        <button
                          className="action-label"
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Delete this turn?',
                              body: 'Everything after it in this branch is removed. Other branches stay.',
                              confirmLabel: 'Delete branch',
                              danger: true,
                            });
                            if (!ok) return;
                            const doomed = pruneBranch(turns, turn.id);
                            removeRows('cinema_ai_turns', doomed);
                            const remaining = turns.filter((item) => !doomed.includes(item.id));
                            setLeafId(remaining[remaining.length - 1]?.id || null);
                            setInspecting(null);
                          }}
                        >
                          <Trash2 size={10} /> delete
                        </button>
                      )}
                      {turn.role === 'assistant' && turn.meta?.finish_reason && (
                        <span className="mono" style={{ fontSize: 8, color: 'var(--text-4)' }}>
                          {turn.meta.finish_reason}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="composer-wrap">
            {branch && (
              <div className="resume-banner" style={{ maxWidth: 900, margin: '0 auto 8px' }}>
                <Edit3 size={12} />
                <span>Editing a sent prompt. The original branch is preserved; this becomes a sibling.</span>
                <span className="spacer" />
                <button className="section-link" onClick={() => { setBranch(null); setComposer(''); }}>
                  cancel <X size={9} />
                </button>
              </div>
            )}
            {events.length > 0 && streaming && (
              <div className="mono" style={{ maxWidth: 900, margin: '0 auto 4px', fontSize: 8.5, color: 'var(--text-4)' }}>
                {events[events.length - 1]?.label} · {events.length} events
              </div>
            )}
            <div className="composer">
              <textarea
                ref={composerRef}
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask the projectionist…  (⏎ to send, ⇧⏎ for a new line)"
                rows={3}
              />
              <div className="composer__bar">
                <div style={{ width: 190 }}>
                  <ModelPicker value={modelId} onChange={changeModel} compact />
                </div>
                <button className="chip chip--sm" onClick={() => setParamsOpen((value) => !value)} title="Temperature and limits">
                  temp {params.temperature.toFixed(2)}
                </button>
                <button
                  className={cx('chip chip--sm', params.reasoning && 'is-active')}
                  onClick={() => updateParams({ reasoning: !params.reasoning })}
                  title="Request reasoning"
                >
                  <Brain size={9} /> thinking
                </button>
                <span className="spacer" />
                <span className="composer__radar" data-tone={budget.overBudget ? 'danger' : (budget.pct || 0) > 70 ? 'warn' : 'ok'}>
                  {tokens(budget.inputTokens)} in · {budget.autoMaxApplied ? 'auto' : tokens(params.max_tokens === 'auto' ? budget.autoMax : params.max_tokens)} out
                </span>
                {streaming ? (
                  <button className="send-btn send-btn--stop" onClick={stop}>
                    <Square size={11} /> Stop
                  </button>
                ) : (
                  <button className="send-btn" onClick={send} disabled={!composer.trim()}>
                    <Wand2 size={12} /> Send
                  </button>
                )}
              </div>
            </div>
            <div className="composer-foot">
              <span>
                <Kbd>⏎</Kbd> send · <Kbd>⇧⏎</Kbd> newline · <Kbd>⌘K</Kbd> palette
              </span>
              <span>{branch ? 'branching from an earlier prompt' : `${path.length} turns · ${settings.baseUrl.replace('https://', '')}`}</span>
            </div>
          </div>
        </div>

        <aside className={cx('studio__params', paramsOpen && 'is-open')}>
          <div className="param-block">
            <div className="param-block__title">
              <Cpu size={10} /> Model
            </div>
            <ModelPicker value={modelId} onChange={changeModel} />
            <div className="mono" style={{ fontSize: 8.5, color: 'var(--text-4)', marginTop: 7, lineHeight: 1.7 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>context</span>
                <span style={{ color: 'var(--text-2)' }}>{contextWindow(model.contextLength)}</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>max completion</span>
                <span style={{ color: 'var(--text-2)' }}>{model.maxCompletionTokens ? tokens(model.maxCompletionTokens) : 'unpublished'}</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>reasoning</span>
                <span style={{ color: model.supportsReasoning ? 'var(--success)' : 'var(--text-2)' }}>
                  {model.supportsReasoning ? 'supported' : 'model default'}
                </span>
              </div>
            </div>
          </div>

          <div className="param-block">
            <div className="param-block__title">
              <Settings2 size={10} /> Sampling
            </div>
            <Slider
              label="Temperature"
              value={params.temperature}
              min={0}
              max={2}
              step={0.05}
              display={params.temperature.toFixed(2)}
              onChange={(value) => updateParams({ temperature: value })}
              hint={params.temperature < 0.4 ? 'Literal. Good for extraction.' : params.temperature > 1.15 ? 'Associative. Good for drafting.' : 'Balanced.'}
            />
            <Slider
              label="Top-p"
              value={params.top_p}
              min={0.1}
              max={1}
              step={0.05}
              display={params.top_p.toFixed(2)}
              onChange={(value) => updateParams({ top_p: value })}
            />
            <Slider
              label="Frequency penalty"
              value={params.frequency_penalty}
              min={0}
              max={2}
              step={0.1}
              display={params.frequency_penalty.toFixed(1)}
              onChange={(value) => updateParams({ frequency_penalty: value })}
            />
            <Slider
              label="Presence penalty"
              value={params.presence_penalty}
              min={0}
              max={2}
              step={0.1}
              display={params.presence_penalty.toFixed(1)}
              onChange={(value) => updateParams({ presence_penalty: value })}
            />
          </div>

          <div className="param-block">
            <div className="param-block__title">Output</div>
            <Toggle
              checked={params.max_tokens === 'auto'}
              onChange={(auto) => updateParams({ max_tokens: auto ? 'auto' : budget.autoMax })}
              label="Automatic max tokens"
            />
            {params.max_tokens !== 'auto' && (
              <input
                className="param-number"
                type="number"
                min={64}
                max={model.maxCompletionTokens || 32768}
                value={params.max_tokens}
                onChange={(event) => updateParams({ max_tokens: Number(event.target.value) })}
                style={{ marginTop: 6 }}
              />
            )}
            <div className="param-row__hint">{budget.note}</div>
            <div className="param-row" style={{ marginTop: 10 }}>
              <Toggle checked={params.stream} onChange={(stream) => updateParams({ stream })} label="Stream tokens" />
            </div>
            <Toggle checked={params.reasoning} onChange={(reasoning) => updateParams({ reasoning })} label="Internal thinking" />
          </div>

          <div className="param-block">
            <div className="param-block__title">Context budget</div>
            <div className="budget">
              <div className="budget__row">
                <span>system</span>
                <b>{tokens(budget.systemTokens)}</b>
              </div>
              <div className="budget__row">
                <span>history</span>
                <b>{tokens(Math.max(0, budget.historyTokens))}</b>
              </div>
              <div className="budget__row">
                <span>draft</span>
                <b>{tokens(budget.draftTokens)}</b>
              </div>
              <div className="budget__row">
                <span>total input</span>
                <b>{tokens(budget.inputTokens)}</b>
              </div>
              <div className="meter meter--thin">
                <div
                  className="meter__fill"
                  style={{
                    width: `${Math.min(100, budget.pct || 0)}%`,
                    background: budget.overBudget ? 'var(--danger)' : undefined,
                  }}
                />
              </div>
              <div className="budget__row">
                <span>window</span>
                <b>{contextWindow(model.contextLength)}</b>
              </div>
            </div>
            <Button size="sm" variant="ghost" block style={{ marginTop: 8 }} onClick={() => setContextOpen(true)}>
              Full context report
            </Button>
          </div>

          <div className="param-block">
            <div className="param-block__title">
              <Brain size={10} /> System instruction
            </div>
            <textarea
              className="textarea"
              style={{ minHeight: 96, fontSize: 'var(--fs-2xs)' }}
              value={thread.system}
              onChange={(event) => updateRow('cinema_ai_threads', thread.id, { system: event.target.value })}
            />
            <button
              className="section-link"
              style={{ marginTop: 6 }}
              onClick={() => updateRow('cinema_ai_threads', thread.id, { system: CRITIC_SYSTEM })}
            >
              reset to projectionist
            </button>
          </div>

          <div className="param-block">
            <div className="param-block__title">Thread</div>
            <input
              className="param-number"
              value={thread.title}
              onChange={(event) => updateRow('cinema_ai_threads', thread.id, { title: event.target.value })}
            />
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <Chip mono sm>{db.cinema_ai_turns.filter((turn) => turn.thread_id === thread.id).length} turns</Chip>
              <Chip mono sm>{thread.archived ? 'archived' : 'active'}</Chip>
            </div>
            <Button
              size="sm"
              variant="danger"
              block
              icon={<Trash2 size={11} />}
              style={{ marginTop: 8 }}
              onClick={() => setConfirmPurge(true)}
            >
              Delete thread
            </Button>
          </div>

          <div className="param-block">
            <div className="param-block__title">
              <History size={10} /> Live stream log
            </div>
            <div className="mini-console">
              {events.length
                ? events.slice(-12).map((event, index) => (
                    <div key={`${event.at}-${index}`}>
                      <b>{event.kind}</b> {event.label}
                    </div>
                  ))
                : 'idle · no events this turn'}
            </div>
          </div>
        </aside>
      </div>

      {inspecting && <RequestInspector turn={inspecting} onClose={() => setInspecting(null)} />}

      {contextOpen && (
        <Modal
          title="Context report"
          subtitle={`Projected request to ${model.name}. Estimates, labelled as such.`}
          icon={<Cpu size={16} />}
          onClose={() => setContextOpen(false)}
          size="lg"
        >
          <div className="stack">
            <div className="row row--between">
              <div className="big-number">
                {tokens(budget.inputTokens)}
                <span>input tokens</span>
              </div>
              <div style={{ width: 200 }}>
                <div className="meter-label">
                  <span>window used</span>
                  <span>{budget.pct ? budget.pct.toFixed(1) : '—'}%</span>
                </div>
                <div className="meter">
                  <div className="meter__fill" style={{ width: `${Math.min(100, budget.pct || 0)}%` }} />
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Message</th>
                    <th>Role</th>
                    <th className="num">Chars</th>
                    <th className="num">Est. tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { content: thread.system, role: 'system' },
                    ...toRequestMessages(path, composer ? [{ role: 'user', content: composer }] : []).map((message) => ({
                      content: message.content,
                      role: message.role,
                    })),
                  ].map((message, index) => (
                    <tr key={index}>
                      <td style={{ maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {truncate(message.content, 110)}
                      </td>
                      <td>
                        <Chip sm mono>{message.role}</Chip>
                      </td>
                      <td className="num">{n(message.content.length)}</td>
                      <td className="num">{n(estimateTokens(message.content))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Notice tone="accent">
              Token counts are conservative estimates (characters/4 with penalties for scripts, digits and punctuation).
              Provider-reported usage replaces these in the ledger and on each reply.
            </Notice>
          </div>
        </Modal>
      )}

      {confirmPurge && (
        <Modal
          title="Delete this thread?"
          subtitle={thread.title}
          onClose={() => setConfirmPurge(false)}
          size="sm"
          actions={
            <>
              <Button variant="ghost" onClick={() => setConfirmPurge(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  deleteThread(thread.id);
                  setConfirmPurge(false);
                  const remaining = threads.filter((item) => item.id !== thread.id);
                  setThreadId(remaining[0]?.id);
                }}
              >
                Delete thread
              </Button>
            </>
          }
        >
          <p className="muted" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.7 }}>
            Every turn and its archived request body is removed. The usage ledger keeps its anonymised call records.
          </p>
        </Modal>
      )}
    </>
  );
}

/* ── request inspector ─────────────────────────────────────────────────── */

function RequestInspector({ turn, onClose }: { turn: AiTurn; onClose: () => void }) {
  const [tab, setTab] = useState<'body' | 'messages' | 'headers' | 'curl' | 'meta' | 'error'>('body');
  const request = turn.request as RequestSnapshot | null;
  const meta = turn.meta as TurnMeta | null;
  const tabs = [
    { id: 'body', label: 'Body' },
    { id: 'messages', label: 'Messages' },
    { id: 'headers', label: 'Headers' },
    { id: 'curl', label: 'cURL' },
    { id: 'meta', label: 'Meta' },
    ...(turn.error ? [{ id: 'error', label: 'Error' }] : []),
  ] as Array<{ id: typeof tab; label: string }>;

  return (
    <Modal
      title="Exact request"
      subtitle={request ? `${request.url} · ${dateTime(request.createdAt)}` : 'No request was archived for this turn.'}
      icon={<TerminalSquare size={16} />}
      onClose={onClose}
      size="lg"
      actions={
        <>
          <span className="modal__foot-info">
            {request ? `${n(request.bodyText.length)} chars · ${request.messageCount} messages · ${tokens(request.estimatedInputTokens)} est. tokens` : ''}
          </span>
          {request && (
            <>
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy size={11} />}
                onClick={() => copyText(request.bodyText)}
              >
                Copy body
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy size={11} />}
                onClick={() => copyText(curlFor(request))}
              >
                Copy cURL
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="inspector">
        <div className="inspector__tabs">
          {tabs.map((item) => (
            <button
              key={item.id}
              className={cx('inspector__tab', tab === item.id && 'is-active')}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="inspector__pane">
          {tab === 'body' && (
            <>
              <pre className="codeblock codeblock--wrap">{request?.bodyText || 'No archived body.'}</pre>
              {request && (
                <div className="mono" style={{ fontSize: 9, color: 'var(--text-4)', marginTop: 8, display: 'flex', gap: 14 }}>
                  <span>fingerprint {request.fingerprint}</span>
                  <span>max_tokens {request.maxTokens ?? 'omitted'}</span>
                  <span>{request.autoMaxTokens ? 'auto budget' : 'explicit cap'}</span>
                </div>
              )}
            </>
          )}
          {tab === 'messages' && (
            <div className="stack stack--tight">
              {request?.body && Array.isArray((request.body as { messages?: unknown }).messages)
                ? ((request.body as { messages: Array<{ role: string; content: string }> }).messages).map((message, index) => (
                    <div key={index} className="panel panel--flat">
                      <div className="row row--between" style={{ marginBottom: 5 }}>
                        <Chip sm mono>{message.role}</Chip>
                        <span className="mono faint" style={{ fontSize: 8.5 }}>{n(message.content.length)} chars</span>
                      </div>
                      <p style={{ fontSize: 'var(--fs-2xs)', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{message.content}</p>
                    </div>
                  ))
                : 'No message array archived.'}
            </div>
          )}
          {tab === 'headers' && (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Header</th><th>Value</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(request?.headers || {}).map(([key, value]) => (
                      <tr key={key}>
                        <td className="mono" style={{ fontSize: 9 }}>{key}</td>
                        <td className="mono" style={{ fontSize: 9 }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Notice tone="accent" icon={<Brain size={13} />}>
                The Authorization header is stored redacted. The real key exists only in browser storage and in the
                outgoing fetch, never in this archive or in the database export.
              </Notice>
            </>
          )}
          {tab === 'curl' && <pre className="codeblock codeblock--wrap">{request ? curlFor(request) : '—'}</pre>}
          {tab === 'meta' && (
            <div className="stack stack--tight">
              <dl className="kv">
                <dt>model</dt><dd>{turn.model}</dd>
                <dt>requested</dt><dd>{turn.requested_model}</dd>
                <dt>provider</dt><dd>{turn.provider || '—'}</dd>
                <dt>status</dt><dd>{turn.status}</dd>
                <dt>finish</dt><dd>{meta?.finish_reason || '—'}</dd>
                <dt>latency</dt><dd>{meta?.latency_ms ? duration(meta.latency_ms) : '—'}</dd>
                <dt>started</dt><dd>{meta?.started_at ? dateTime(meta.started_at) : '—'}</dd>
                <dt>completed</dt><dd>{meta?.completed_at ? dateTime(meta.completed_at) : '—'}</dd>
                <dt>usage</dt><dd>{turn.usage ? `${n(turn.usage.prompt_tokens)} in / ${n(turn.usage.completion_tokens)} out / ${n(turn.usage.total_tokens)} total${turn.usage.estimated ? ' (est.)' : ''}` : '—'}</dd>
                <dt>reasoning</dt><dd>{turn.reasoning ? `${n(turn.reasoning.length)} chars` : 'none'}</dd>
              </dl>
              {turn.usage && (
                <div className="token-bar">
                  <span className="in" style={{ flex: Math.max(1, turn.usage.prompt_tokens) }}>
                    {tokens(turn.usage.prompt_tokens)} in
                  </span>
                  <span className="out" style={{ flex: Math.max(1, turn.usage.completion_tokens) }}>
                    {tokens(turn.usage.completion_tokens)} out
                  </span>
                </div>
              )}
            </div>
          )}
          {tab === 'error' && turn.error && (
            <div className="stack stack--tight">
              <dl className="kv">
                <dt>kind</dt><dd>{turn.error.kind}</dd>
                <dt>message</dt><dd>{turn.error.message}</dd>
                <dt>status</dt><dd>{turn.error.status || '—'}</dd>
                <dt>request id</dt><dd>{turn.error.requestId || '—'}</dd>
                <dt>provider</dt><dd>{turn.error.provider || '—'}</dd>
              </dl>
              <pre className="codeblock codeblock--wrap">{turn.error.bodyText || 'No body.'}</pre>
              {turn.error.parsed ? (
                <pre className="codeblock codeblock--wrap">{JSON.stringify(turn.error.parsed, null, 2)}</pre>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
