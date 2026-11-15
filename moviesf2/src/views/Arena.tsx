/**
 * Two models, one prompt, no referee.
 *
 * Both requests are built and sent directly from the browser, streamed into
 * separate columns, and archived with the same fidelity as a booth turn.
 */

import { useMemo, useRef, useState } from 'react';
import {
  Copy,
  Crown,
  Flag,
  Gauge,
  Play,
  RotateCcw,
  Square,
  Swords,
  Trophy,
} from 'lucide-react';
import { navigate } from '../app/router';
import { insertRow, logActivity, updateRow, useDb } from '../data/store';
import { getApiKey, getSettings, hasApiKey, updateSettings, useSettings } from '../data/settings';
import { buildRequest } from '../ai/request';
import { streamCompletion, errorRecord, isAbort } from '../ai/client';
import { getModelInfo, resolveModel, useModelCatalogue } from '../ai/models';
import { newThread } from '../ai/threads';
import { AI_ACTIONS } from '../ai/prompts';
import { AiPanel } from '../components/AiPanel';
import { ModelPicker } from '../components/ModelPicker';
import { copyText, nowIso, truncate } from '../lib/utils';
import { contextWindow, duration, tokens } from '../lib/format-extra';
import type { AiAction, RequestMessage, TokenUsage } from '../types';
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Select,
  Stat,
  Textarea,
  useToast,
  cx,
} from '../components/ui';

interface Lane {
  content: string;
  reasoning: string;
  status: 'idle' | 'streaming' | 'complete' | 'error' | 'stopped';
  latency: number;
  usage: TokenUsage | null;
  error: string;
  firstTokenAt: number | null;
}

const EMPTY_LANE: Lane = {
  content: '',
  reasoning: '',
  status: 'idle',
  latency: 0,
  usage: null,
  error: '',
  firstTokenAt: null,
};

export function Arena() {
  const db = useDb();
  const settings = useSettings();
  const models = useModelCatalogue();
  const toast = useToast();
  const [modelA, setModelA] = useState(settings.arenaModelA);
  const [modelB, setModelB] = useState(settings.arenaModelB);
  const [prompt, setPrompt] = useState(
    'Argue for the single most formally daring film on this shelf, and name the exact sequence that proves it.',
  );
  const [focusTitle, setFocusTitle] = useState('');
  const [laneA, setLaneA] = useState<Lane>(EMPTY_LANE);
  const [laneB, setLaneB] = useState<Lane>(EMPTY_LANE);
  const [running, setRunning] = useState(false);
  const [winner, setWinner] = useState<'a' | 'b' | null>(null);
  const [promptAction, setPromptAction] = useState<AiAction | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const title = db.cinema_titles.find((entry) => entry.id === focusTitle);
  const infoA = getModelInfo(modelA);
  const infoB = getModelInfo(modelB);

  const messages = useMemo<RequestMessage[]>(() => {
    const shelf = db.cinema_titles
      .slice(0, 40)
      .map((entry) => `${entry.title} (${entry.year || '—'}) — ${entry.rating.toFixed(1)} — ${entry.genre}`)
      .join('\n');
    const focus = title
      ? `\nFocus title: ${title.title} (${title.year || '—'}). Summary: ${truncate(title.summary, 600)}`
      : '';
    return [
      {
        role: 'user',
        content: `${prompt}\n\nShelf:\n${shelf}${focus}`,
      },
    ];
  }, [prompt, db.cinema_titles, title]);

  const runLane = async (
    modelId: string,
    set: (lane: Lane | ((current: Lane) => Lane)) => void,
    signal: AbortSignal,
  ) => {
    const apiKey = getApiKey();
    const model = resolveModel(modelId);
    const built = buildRequest({
      model,
      modelId,
      messages,
      params: { ...settings.params, stream: true },
      systemPrompt: settings.systemPrompt,
      baseUrl: settings.baseUrl,
      stream: true,
    });
    const started = performance.now();
    set({ ...EMPTY_LANE, status: 'streaming' });
    try {
      const result = await streamCompletion({
        snapshot: built.snapshot,
        apiKey,
        baseUrl: settings.baseUrl,
        signal,
        callbacks: {
          onDelta: (_delta, full) =>
            set((current) => ({
              ...current,
              content: full,
              firstTokenAt: current.firstTokenAt ?? Math.round(performance.now() - started),
            })),
          onReasoning: (_delta, full) => set((current) => ({ ...current, reasoning: full })),
        },
      });
      set({
        content: result.content,
        reasoning: result.reasoning,
        status: result.empty ? 'error' : 'complete',
        latency: Math.round(result.latencyMs || performance.now() - started),
        usage: result.usage,
        error: result.empty ? 'The provider returned an empty completion.' : '',
        firstTokenAt: null,
      });
    } catch (error) {
      if (isAbort(error)) {
        set((current) => ({ ...current, status: 'stopped', latency: Math.round(performance.now() - started) }));
        return;
      }
      const record = errorRecord(error);
      set((current) => ({
        ...current,
        status: 'error',
        error: `${record.kind}: ${record.message}`,
        latency: Math.round(performance.now() - started),
      }));
    }
  };

  const run = async () => {
    if (!prompt.trim() || running) return;
    if (!hasApiKey()) {
      toast.push({ tone: 'error', title: 'No provider key', body: 'Add one in Settings → Projection booth.' });
      return;
    }
    if (modelA === modelB) {
      toast.push({ tone: 'warn', title: 'Same model twice', body: 'Pick two different models for a meaningful comparison.' });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setWinner(null);
    updateSettings({ arenaModelA: modelA, arenaModelB: modelB });
    await Promise.all([
      runLane(modelA, setLaneA, controller.signal),
      runLane(modelB, setLaneB, controller.signal),
    ]);
    abortRef.current = null;
    setRunning(false);
    logActivity('ai', 'arena', null, `Compared ${modelA} against ${modelB}`);
  };

  const stop = () => abortRef.current?.abort();

  const pick = (side: 'a' | 'b') => {
    setWinner(side);
    const modelId = side === 'a' ? modelA : modelB;
    const lane = side === 'a' ? laneA : laneB;
    const row = db.cinema_ai_models.find((entry) => entry.id === modelId);
    if (row) updateRow('cinema_ai_models', row.id, { wins: row.wins + 1, last_tried_at: nowIso() });
    const loser = db.cinema_ai_models.find((entry) => entry.id === (side === 'a' ? modelB : modelA));
    if (loser) updateRow('cinema_ai_models', loser.id, { losses: loser.losses + 1, last_tried_at: nowIso() });
    insertRow('cinema_conversations', {
      title_id: title?.id || null,
      title_context: title?.title || 'shelf',
      prompt,
      response: lane.content,
      ai_model: modelId,
      tags: 'arena,winner',
    } as never);
    toast.push({ tone: 'success', title: 'Verdict recorded', body: 'Saved to conversations and the model scoreboard.' });
  };

  const sendToStudio = (side: 'a' | 'b') => {
    const modelId = side === 'a' ? modelA : modelB;
    const lane = side === 'a' ? laneA : laneB;
    const thread = newThread({
      title: `Arena · ${prompt.slice(0, 44)}`,
      title_id: title?.id || null,
      model: modelId,
      system: settings.systemPrompt,
      params: settings.params,
    });
    insertRow('cinema_ai_turns', {
      thread_id: thread.id,
      parent_id: null,
      role: 'user',
      content: prompt,
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
    insertRow('cinema_ai_turns', {
      thread_id: thread.id,
      parent_id: null,
      role: 'assistant',
      content: lane.content,
      reasoning: lane.reasoning,
      status: 'complete',
      model: modelId,
      requested_model: modelId,
      provider: null,
      continue_of: null,
      usage: lane.usage,
      request: null,
      error: null,
      meta: {
        started_at: nowIso(),
        completed_at: nowIso(),
        latency_ms: lane.latency,
        model: modelId,
        finish_reason: 'stop',
      },
    } as never);
    navigate('studio', thread.id);
  };

  const board = useMemo(
    () => [...db.cinema_ai_models].filter((row) => row.wins + row.losses > 0).sort((a, b) => b.wins - a.wins),
    [db.cinema_ai_models],
  );

  const laneView = (side: 'a' | 'b') => {
    const lane = side === 'a' ? laneA : laneB;
    const modelId = side === 'a' ? modelA : modelB;
    const info = side === 'a' ? infoA : infoB;
    return (
      <div className={cx('arena-lane', lane.status === 'streaming' && 'is-live', winner === side && 'is-winner')}>
        <div className="arena-lane__head">
          <div>
            <div className="arena-lane__model">{info?.name || modelId.split('/').pop()}</div>
            <div className="mono" style={{ fontSize: 8.5, color: 'var(--text-4)' }}>
              {modelId} · {contextWindow(info?.contextLength || null)}
            </div>
          </div>
          <div className="row" style={{ gap: 4 }}>
            {lane.status === 'streaming' && <span className="turn-status turn-status--streaming"><span className="thinking__pulse" /> live</span>}
            {lane.status === 'complete' && <Chip sm mono tone="accent">done</Chip>}
            {lane.status === 'error' && <Chip sm mono tone="hate">error</Chip>}
            {lane.status === 'stopped' && <Chip sm mono>stopped</Chip>}
            {winner === side && <Crown size={14} style={{ color: 'var(--accent)' }} />}
          </div>
        </div>
        <div className="arena-lane__stats">
          <span><Gauge size={9} /> {lane.latency ? duration(lane.latency) : '—'}</span>
          <span>{lane.firstTokenAt ? `${lane.firstTokenAt}ms first token` : 'no token yet'}</span>
          <span>{lane.usage ? `${tokens(lane.usage.completion_tokens)} out` : 'usage pending'}</span>
        </div>
        {lane.reasoning && (
          <div className="thinking" style={{ margin: '0 10px 8px' }}>
            <button className="thinking__head" onClick={() => setShowReasoning((value) => !value)}>
              <BrainIcon /> <span className="thinking__label">thinking</span>
              <span className="thinking__meta">{tokens(lane.reasoning.length / 4)}</span>
            </button>
            {showReasoning && <div className="thinking__body">{lane.reasoning}</div>}
          </div>
        )}
        <div className="arena-lane__body">
          {lane.content ? lane.content : lane.status === 'error' ? <span style={{ color: 'var(--danger)' }}>{lane.error}</span> : <span className="faint">Waiting for a prompt.</span>}
        </div>
        {lane.content && (
          <div className="arena-lane__foot">
            <button className="action-label" onClick={() => copyText(lane.content)}><Copy size={10} /> copy</button>
            <button className="action-label" onClick={() => sendToStudio(side)}><Play size={10} /> open in booth</button>
            <button className="action-label" onClick={() => pick(side)}><Trophy size={10} /> pick winner</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Intelligence · head to head</div>
          <h1 className="page-title">
            Two readings, <em>one prompt.</em>
          </h1>
          <p className="page-sub">
            Same shelf, same instruction, both sent directly. Compare where they agree, where they bluff, and how long
            each took to arrive.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" icon={<Swords size={13} />} onClick={() => setPromptAction(AI_ACTIONS.find((action) => action.id === 'compare') || null)}>
            Compare action
          </Button>
          <Button variant="ghost" icon={<RotateCcw size={13} />} onClick={() => { setLaneA(EMPTY_LANE); setLaneB(EMPTY_LANE); setWinner(null); }}>
            Clear
          </Button>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Model A" value={infoA?.name || modelA.split('/').pop() || '—'} foot={infoA?.vendor || 'custom'} />
        <Stat label="Model B" value={infoB?.name || modelB.split('/').pop() || '—'} foot={infoB?.vendor || 'custom'} />
        <Stat label="Bouts" value={db.cinema_conversations.filter((row) => row.tags.includes('arena')).length} foot="recorded verdicts" />
        <Stat label="Scoreboard" value={board.length ? `${board[0].wins}–${board[0].losses}` : '—'} foot={board[0]?.id.split('/').pop() || 'no votes'} />
      </div>

      <div className="card card--pad" style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="cols-2" style={{ marginBottom: 10 }}>
          <Field label="Model A">
            <ModelPicker value={modelA} onChange={setModelA} />
          </Field>
          <Field label="Model B">
            <ModelPicker value={modelB} onChange={setModelB} />
          </Field>
        </div>
        <Field label="Prompt">
          <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} />
        </Field>
        <div className="row row--between row--wrap" style={{ marginTop: 10, gap: 10 }}>
          <div style={{ width: 260 }}>
            <Select value={focusTitle} onChange={(event) => setFocusTitle(event.target.value)}>
              <option value="">Whole shelf</option>
              {db.cinema_titles.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.title}</option>
              ))}
            </Select>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <Chip mono sm>temperature {settings.params.temperature.toFixed(2)}</Chip>
            <Chip mono sm>{messages[0].content.length} chars of context</Chip>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {running ? (
              <Button variant="danger" icon={<Square size={12} />} onClick={stop}>Stop both</Button>
            ) : (
              <Button variant="primary" icon={<Swords size={13} />} onClick={run} disabled={!prompt.trim()}>
                Run the bout
              </Button>
            )}
          </div>
        </div>
      </div>

      {laneA.status === 'idle' && laneB.status === 'idle' ? (
        <EmptyState
          icon={<Flag size={22} />}
          title="No bout yet"
          text="Write the instruction once. Both models receive exactly this context — no extra system hints, no retries."
          action={<Button variant="primary" onClick={run}>Run the bout</Button>}
        />
      ) : (
        <div className="arena">
          {laneView('a')}
          <div className="arena__divider">
            <span>vs</span>
          </div>
          {laneView('b')}
        </div>
      )}

      <section className="card" style={{ marginTop: 'var(--sp-4)' }}>
        <div className="card__head">
          <div className="card__title"><Trophy size={13} /> Model scoreboard</div>
          <button className="section-link" onClick={() => navigate('studio')}>open the booth</button>
        </div>
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Model</th>
                <th className="num">Wins</th>
                <th className="num">Losses</th>
                <th className="num">Win rate</th>
                <th>Vendor</th>
              </tr>
            </thead>
            <tbody>
              {board.map((row) => {
                const total = row.wins + row.losses;
                return (
                  <tr key={row.id}>
                    <td><span className="mono" style={{ fontSize: 9.5 }}>{row.id}</span></td>
                    <td className="num">{row.wins}</td>
                    <td className="num">{row.losses}</td>
                    <td className="num">{total ? `${Math.round((row.wins / total) * 100)}%` : '—'}</td>
                    <td><Chip sm mono>{row.vendor || '—'}</Chip></td>
                  </tr>
                );
              })}
              {!board.length && (
                <tr><td colSpan={5} className="faint" style={{ padding: 20 }}>No verdicts yet. Pick a winner to start the scoreboard.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {promptAction && (
        <AiPanel
          action={promptAction}
          onClose={() => setPromptAction(null)}
          onSendToStudio={(threadId) => {
            setPromptAction(null);
            navigate('studio', threadId);
          }}
        />
      )}
    </>
  );
}

function BrainIcon() {
  return <Swords size={11} style={{ color: 'var(--accent)' }} />;
}
