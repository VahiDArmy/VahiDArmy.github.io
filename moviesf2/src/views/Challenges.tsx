/** Constraints that make a shelf into a practice. */

import { useMemo, useState } from 'react';
import { Flag, Plus, Sparkles, Trash2 } from 'lucide-react';
import { navigate } from '../app/router';
import { insertRow, removeRow, updateRow, useDb } from '../data/store';
import { challengeProgress } from '../data/queries';
import { AI_ACTIONS } from '../ai/prompts';
import type { AiAction } from '../types';
import { n } from '../lib/format-extra';
import { AiPanel } from '../components/AiPanel';
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  Meter,
  Modal,
  Select,
  Stat,
  Textarea,
  useConfirm,
  useToast,
  cx,
} from '../components/ui';

export function Challenges() {
  const db = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    target: 10,
    status: 'active',
    minRuntime: '',
    country: '',
    genre: '',
    yearFrom: '',
    yearTo: '',
  });

  const active = db.cinema_challenges.filter((challenge) => challenge.status === 'active');
  const done = db.cinema_challenges.filter((challenge) => challenge.status === 'done');
  const abandoned = db.cinema_challenges.filter((challenge) => challenge.status === 'abandoned');

  const add = () => {
    if (!draft.name.trim()) return;
    const rule: Record<string, unknown> = {};
    if (draft.minRuntime) rule.minRuntime = Number(draft.minRuntime);
    if (draft.country) rule.country = draft.country;
    if (draft.genre) rule.genre = draft.genre;
    if (draft.yearFrom) rule.yearFrom = Number(draft.yearFrom);
    if (draft.yearTo) rule.yearTo = Number(draft.yearTo);
    insertRow('cinema_challenges', {
      name: draft.name.trim(),
      description: draft.description,
      rule,
      progress: 0,
      target: draft.target,
      status: draft.status,
    } as never);
    setAdding(false);
    setDraft({ name: '', description: '', target: 10, status: 'active', minRuntime: '', country: '', genre: '', yearFrom: '', yearTo: '' });
    toast.push({ tone: 'success', title: 'Challenge forged' });
  };

  const groups = useMemo(
    () => [
      { label: 'Active', items: active },
      { label: 'Completed', items: done },
      { label: 'Abandoned', items: abandoned },
    ],
    [active, done, abandoned],
  );

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Planning · {active.length} active</div>
          <h1 className="page-title">
            Useful <em>constraints.</em>
          </h1>
          <p className="page-sub">
            A challenge is a rule you can check against the shelf. If it cannot be checked, it is a wish.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            New challenge
          </Button>
          <Button variant="outline" icon={<Sparkles size={13} />} onClick={() => setAiAction(AI_ACTIONS.find((action) => action.id === 'challenge') || null)}>
            Forge with AI
          </Button>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: 'var(--sp-5)' }}>
        <Stat label="Active" value={n(active.length)} icon={<Flag size={11} />} />
        <Stat label="Completed" value={n(done.length)} foot="earned" />
        <Stat label="Abandoned" value={n(abandoned.length)} foot="honestly retired" />
      </div>

      {!db.cinema_challenges.length ? (
        <EmptyState
          icon={<Flag size={22} />}
          title="No constraints yet"
          text="Six films over three hours each. Ten from one movement. One film per decade. Pick something checkable."
          action={<Button variant="primary" onClick={() => setAdding(true)}>Forge one</Button>}
        />
      ) : (
        groups.map((group) =>
          group.items.length ? (
            <section key={group.label} style={{ marginBottom: 'var(--sp-5)' }}>
              <div className="section-head">
                <h2 className="section-title">
                  {group.label} <span className="count">{group.items.length}</span>
                </h2>
              </div>
              <div className="cols-3">
                {group.items.map((challenge) => {
                  const progress = challengeProgress(db, challenge);
                  return (
                    <div className="challenge-card" key={challenge.id} data-status={challenge.status}>
                      <div className="challenge-card__head">
                        <div>
                          <div className="challenge-card__name">{challenge.name}</div>
                          <div className="mono faint" style={{ fontSize: 8.5, marginTop: 2 }}>
                            {progress.value} / {challenge.target} · {challenge.rule && Object.keys(challenge.rule).length ? 'auto-tracked' : 'manual'}
                          </div>
                        </div>
                        <Select
                          className="select select--sm"
                          value={challenge.status}
                          onChange={(event) => updateRow('cinema_challenges', challenge.id, { status: event.target.value as never })}
                          style={{ width: 108 }}
                        >
                          <option value="active">active</option>
                          <option value="done">done</option>
                          <option value="abandoned">abandoned</option>
                        </Select>
                      </div>
                      <p className="challenge-card__desc">{challenge.description || 'No description.'}</p>
                      <div className="challenge-rule">{JSON.stringify(challenge.rule || {})}</div>
                      <Meter
                        value={progress.pct}
                        thin
                        label={
                          <>
                            <span>{progress.detail}</span>
                            <span>{Math.round(progress.pct)}%</span>
                          </>
                        }
                      />
                      <div className="row row--between" style={{ marginTop: 10 }}>
                        <div className="filter-row">
                          {Object.entries(challenge.rule || {}).slice(0, 2).map(([key, value]) => (
                            <Chip key={key} sm mono>
                              {key}: {String(value)}
                            </Chip>
                          ))}
                        </div>
                        <div className="row" style={{ gap: 3 }}>
                          <button
                            className="icon-btn icon-btn--sm"
                            onClick={() => updateRow('cinema_challenges', challenge.id, { progress: Math.min(challenge.target, challenge.progress + 1) })}
                            aria-label="Increment progress"
                            title="Mark one step"
                          >
                            +
                          </button>
                          <button
                            className={cx('icon-btn icon-btn--sm')}
                            onClick={() => navigate('library', undefined, challenge.rule?.country ? `q=${encodeURIComponent(String(challenge.rule.country))}` : undefined)}
                            aria-label="Open matching titles"
                            title="Find matching titles"
                          >
                            →
                          </button>
                          <button
                            className="icon-btn icon-btn--sm"
                            onClick={async () => {
                              const ok = await confirm({
                                title: `Delete “${challenge.name}”?`,
                                body: 'Progress is removed. Nothing else is touched.',
                                confirmLabel: 'Delete challenge',
                                danger: true,
                              });
                              if (ok) {
                                removeRow('cinema_challenges', challenge.id);
                                toast.push({ tone: 'warn', title: 'Challenge deleted' });
                              }
                            }}
                            aria-label="Delete challenge"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null,
        )
      )}

      {adding && (
        <Modal
          title="New challenge"
          subtitle="A rule the shelf can answer."
          icon={<Flag size={16} />}
          onClose={() => setAdding(false)}
          size="md"
          actions={
            <>
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button variant="primary" onClick={add}>Create challenge</Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Name">
              <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Six Films, Six Hours" autoFocus />
            </Field>
            <Field label="Description">
              <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
            </Field>
            <div className="cols-2">
              <Field label="Target">
                <Input type="number" value={draft.target} onChange={(event) => setDraft((current) => ({ ...current, target: Number(event.target.value) }))} />
              </Field>
              <Field label="Status">
                <Select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
                  <option value="active">active</option>
                  <option value="done">done</option>
                  <option value="abandoned">abandoned</option>
                </Select>
              </Field>
            </div>
            <div className="panel panel--flat">
              <div className="panel-title">Auto-tracking rule</div>
              <div className="cols-2">
                <Field label="Minimum runtime" hint="minutes">
                  <Input type="number" value={draft.minRuntime} onChange={(event) => setDraft((current) => ({ ...current, minRuntime: event.target.value }))} placeholder="180" />
                </Field>
                <Field label="Country contains">
                  <Input value={draft.country} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} placeholder="Iran" />
                </Field>
                <Field label="Year from">
                  <Input type="number" value={draft.yearFrom} onChange={(event) => setDraft((current) => ({ ...current, yearFrom: event.target.value }))} />
                </Field>
                <Field label="Year to">
                  <Input type="number" value={draft.yearTo} onChange={(event) => setDraft((current) => ({ ...current, yearTo: event.target.value }))} />
                </Field>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {aiAction && (
        <AiPanel
          action={aiAction}
          onClose={() => setAiAction(null)}
          onSendToStudio={(threadId) => {
            setAiAction(null);
            navigate('studio', threadId);
          }}
        />
      )}
    </>
  );
}
