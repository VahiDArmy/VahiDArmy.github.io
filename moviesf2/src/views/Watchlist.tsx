/** The queue, ordered by intent rather than convenience. */

import { useMemo, useState } from 'react';
import { ArrowRight, Bookmark, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import { navigate } from '../app/router';
import { insertRow, removeRow, updateRow, useDb } from '../data/store';
import { AI_ACTIONS } from '../ai/prompts';
import type { AiAction } from '../types';
import { relativeDay, n, runtime } from '../lib/format-extra';
import { AiPanel } from '../components/AiPanel';
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  MiniPoster,
  Modal,
  Notice,
  Select,
  Textarea,
  Stat,
  useToast,
} from '../components/ui';

export function Watchlist() {
  const db = useDb();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction | null>(null);
  const [draft, setDraft] = useState({ title_id: '', priority: 3, note: '', target_date: '' });

  const open = useMemo(
    () =>
      db.cinema_watchlist
        .filter((item) => !item.done)
        .sort((a, b) => b.priority - a.priority || (a.target_date || '').localeCompare(b.target_date || '')),
    [db.cinema_watchlist],
  );
  const done = db.cinema_watchlist.filter((item) => item.done);
  const overdue = open.filter((item) => item.target_date && new Date(item.target_date).getTime() < Date.now());
  const minutesQueued = open.reduce((total, item) => {
    const title = db.cinema_titles.find((entry) => entry.id === item.title_id);
    return total + (title?.runtime || 0);
  }, 0);

  const add = () => {
    if (!draft.title_id) return;
    insertRow('cinema_watchlist', {
      title_id: draft.title_id,
      priority: draft.priority,
      note: draft.note,
      target_date: draft.target_date || null,
      done: false,
    } as never);
    setAdding(false);
    setDraft({ title_id: '', priority: 3, note: '', target_date: '' });
    toast.push({ tone: 'success', title: 'Queued' });
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Planning · {open.length} queued</div>
          <h1 className="page-title">
            The queue is a <em>promise.</em>
          </h1>
          <p className="page-sub">
            Priority is not excitement. It is the order you would defend if someone asked what you are actually going to
            watch next.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            Queue a title
          </Button>
          <Button variant="outline" icon={<Sparkles size={13} />} onClick={() => setAiAction(AI_ACTIONS.find((action) => action.id === 'watchlist') || null)}>
            Triage with AI
          </Button>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Open" value={n(open.length)} icon={<Bookmark size={11} />} foot="titles waiting" />
        <Stat label="Queued runtime" value={`${Math.round(minutesQueued / 60)}h`} foot={`${n(minutesQueued)} minutes`} />
        <Stat label="Overdue" value={n(overdue.length)} foot="past target date" />
        <Stat label="Finished" value={n(done.length)} foot="removed from queue" />
      </div>

      {open.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={22} />}
          title="Nothing queued"
          text="A short queue is a working queue. Add one film you actually intend to watch this week."
          action={<Button variant="primary" onClick={() => setAdding(true)}>Queue a title</Button>}
        />
      ) : (
        <div className="stack" style={{ gap: 'var(--sp-4)' }}>
          {[5, 4, 3, 2, 1, 0].map((priority) => {
            const lane = open.filter((item) => item.priority === priority);
            if (!lane.length) return null;
            return (
              <section key={priority}>
                <div className="section-head" style={{ marginBottom: 7 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="priority-pips">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <i key={level} className={level <= priority ? 'is-on' : ''} />
                      ))}
                    </span>
                    <span className="mono faint" style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {priority === 5 ? 'Immediate' : priority === 4 ? 'This week' : priority === 3 ? 'Soon' : priority === 2 ? 'When the mood fits' : priority === 1 ? 'Background' : 'Someday'}
                    </span>
                    <span className="mono faint" style={{ fontSize: 9 }}>{lane.length}</span>
                  </div>
                </div>
                <div className="watchlist-lane">
                  {lane.map((item) => {
                    const title = db.cinema_titles.find((entry) => entry.id === item.title_id);
                    if (!title) return null;
                    return (
                      <div className="wl-card" key={item.id}>
                        <div className="wl-card__poster">
                          <MiniPoster title={title.title} category={title.category} />
                        </div>
                        <div className="wl-card__main">
                          <button className="wl-card__title" onClick={() => navigate('title', title.id)}>
                            {title.title} {title.year ? `(${title.year})` : ''}
                          </button>
                          <div className="wl-card__note">
                            {item.note || title.reason || title.summary || 'No note.'}
                          </div>
                        </div>
                        <div>
                          <span className="mono faint" style={{ fontSize: 9, display: 'block' }}>
                            {title.runtime ? runtime(title.runtime) : 'runtime ?'}
                          </span>
                          <span
                            className="mono"
                            style={{
                              fontSize: 9,
                              color: item.target_date && new Date(item.target_date).getTime() < Date.now() ? 'var(--danger)' : 'var(--text-4)',
                            }}
                          >
                            {item.target_date ? relativeDay(item.target_date) : 'no date'}
                          </span>
                        </div>
                        <div className="row" style={{ gap: 3 }}>
                          <button
                            className="icon-btn icon-btn--sm"
                            title="Raise priority"
                            onClick={() =>
                              updateRow('cinema_watchlist', item.id, { priority: Math.min(5, item.priority + 1) })
                            }
                          >
                            ↑
                          </button>
                          <button
                            className="icon-btn icon-btn--sm"
                            title="Lower priority"
                            onClick={() =>
                              updateRow('cinema_watchlist', item.id, { priority: Math.max(0, item.priority - 1) })
                            }
                          >
                            ↓
                          </button>
                          <button
                            className="icon-btn icon-btn--sm"
                            title="Mark watched"
                            onClick={() => {
                              updateRow('cinema_watchlist', item.id, { done: true });
                              updateRow('cinema_titles', title.id, {
                                status: 'watched',
                                watched_date: new Date().toISOString().slice(0, 10),
                              });
                              toast.push({ tone: 'success', title: 'Off the queue', body: title.title });
                            }}
                          >
                            <Check size={11} />
                          </button>
                          <button
                            className="icon-btn icon-btn--sm"
                            title="Remove"
                            onClick={() => removeRow('cinema_watchlist', item.id)}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">
              Cleared <span className="count">{done.length}</span>
            </h2>
            <span className="mono faint" style={{ fontSize: 9 }}>kept as a record</span>
          </div>
          <div className="filter-row">
            {done.map((item) => {
              const title = db.cinema_titles.find((entry) => entry.id === item.title_id);
              return (
                <button key={item.id} className="chip" onClick={() => title && navigate('title', title.id)}>
                  <Check size={10} /> {title?.title || 'Unknown'}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div style={{ marginTop: 'var(--sp-5)' }}>
        <Notice tone="accent" icon={<Sparkles size={14} />}>
          The queue is the easiest thing to lie to. The booth can triage it: keep five, cut the rest, and justify both.
        </Notice>
      </div>

      {adding && (
        <Modal
          title="Queue a title"
          subtitle="Pick something already on the shelf."
          icon={<Bookmark size={16} />}
          onClose={() => setAdding(false)}
          size="md"
          actions={
            <>
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button variant="primary" onClick={add}>Queue it</Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Title">
              <Select value={draft.title_id} onChange={(event) => setDraft((current) => ({ ...current, title_id: event.target.value }))}>
                <option value="">Choose…</option>
                {db.cinema_titles.map((title) => (
                  <option key={title.id} value={title.id}>
                    {title.title} ({title.year || '—'})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" meta={`${draft.priority}/5`}>
              <input
                type="range"
                className="range"
                min={0}
                max={5}
                value={draft.priority}
                onChange={(event) => setDraft((current) => ({ ...current, priority: Number(event.target.value) }))}
                style={{ '--fill': `${(draft.priority / 5) * 100}%` } as React.CSSProperties}
              />
            </Field>
            <Field label="Target date">
              <Input
                type="date"
                value={draft.target_date}
                onChange={(event) => setDraft((current) => ({ ...current, target_date: event.target.value }))}
              />
            </Field>
            <Field label="Note to self">
              <Textarea
                value={draft.note}
                onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                placeholder="Why now? What are you waiting for?"
              />
            </Field>
            <Button variant="ghost" icon={<ArrowRight size={12} />} onClick={() => { setAdding(false); navigate('library'); }}>
              Add a new entry instead
            </Button>
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
