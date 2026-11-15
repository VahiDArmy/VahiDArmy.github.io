/** Create or edit a title. All columns that matter to the operator, in one sheet. */

import { useMemo, useState } from 'react';
import { Film, Save, Sparkles } from 'lucide-react';
import type { Category, MediaType, Title } from '../types';
import { insertRow, logActivity, updateRow } from '../data/store';
import { splitList, joinList } from '../lib/utils';
import { SEED_TYPES, SEED_STATUSES } from './constants';
import {
  Button,
  Field,
  Input,
  Modal,
  Poster,
  Select,
  Slider,
  TagInput,
  Textarea,
  Toggle,
  Tabs,
  useToast,
  cx,
} from './ui';

type TabId = 'identity' | 'verdict' | 'craft';

const emptyDraft = (): Omit<Title, 'id' | 'created_at' | 'updated_at'> => ({
  legacy_id: null,
  title: '',
  original_title: '',
  category: 'good',
  type: 'film',
  genre: '',
  tags: '',
  year: new Date().getFullYear(),
  rating: 0,
  favorite: false,
  notes: '',
  watched_date: null,
  summary: '',
  seasons: null,
  episodes: null,
  episodes_per_season: null,
  country: '',
  language: '',
  status: 'watched',
  reason: '',
  story_analysis: '',
  ai_standardized_at: null,
  source: 'manual',
  poster_url: '',
  backdrop_url: '',
  trailer_url: '',
  runtime: null,
  user_id: null,
});

export function TitleForm({
  editing,
  onClose,
  onSaved,
}: {
  editing?: Title | null;
  onClose: () => void;
  onSaved?: (title: Title) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(() => (editing ? { ...editing } : emptyDraft()));
  const [tab, setTab] = useState<TabId>('identity');
  const [error, setError] = useState('');

  const tags = useMemo(() => splitList(draft.tags), [draft.tags]);
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = () => {
    if (!draft.title.trim()) {
      setError('A title is required. Everything else can be filled later.');
      setTab('identity');
      return;
    }
    if (editing) {
      updateRow('cinema_titles', editing.id, {
        ...draft,
        tags: joinList(splitList(draft.tags)),
        updated_at: new Date().toISOString(),
      });
      logActivity('updated', 'cinema_titles', editing.id, `Edited “${draft.title}”`);
      toast.push({ tone: 'success', title: 'Entry updated', body: draft.title });
      onSaved?.({ ...(editing as Title), ...draft } as Title);
      onClose();
      return;
    }
    const created = insertRow('cinema_titles', {
      ...draft,
      tags: joinList(splitList(draft.tags)),
      source: 'manual',
    } as Partial<Title>) as Title;
    logActivity('created', 'cinema_titles', created.id, `Added “${created.title}” to the shelf`);
    toast.push({
      tone: 'success',
      title: 'Added to the shelf',
      body: `${created.title}${created.year ? ` (${created.year})` : ''}`,
      action: { label: 'Open entry', run: () => onSaved?.(created) },
    });
    onSaved?.(created);
    onClose();
  };

  return (
    <Modal
      title={editing ? 'Edit entry' : 'New entry'}
      subtitle={
        editing
          ? `Updating “${editing.title}”. Changes are local and immediate.`
          : 'Add a film or series. Only the title is required; the AI booth can fill the rest.'
      }
      icon={<Film size={17} />}
      onClose={onClose}
      size="lg"
      actions={
        <>
          <span className="modal__foot-info">{tags.length} tags · {draft.category}</span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Save size={13} />} onClick={save}>
            {editing ? 'Save changes' : 'Add to shelf'}
          </Button>
        </>
      }
    >
      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 190px', gap: 'var(--sp-5)' }}>
        <div>
          <Tabs
            tabs={[
              { id: 'identity', label: 'Identity' },
              { id: 'verdict', label: 'Verdict' },
              { id: 'craft', label: 'Craft & notes' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <div style={{ paddingTop: 'var(--sp-4)' }} className="stack">
            {tab === 'identity' && (
              <>
                <Field label="Title" meta="required" error={error}>
                  <Input
                    value={draft.title}
                    onChange={(event) => {
                      set('title', event.target.value);
                      setError('');
                    }}
                    placeholder="In the Mood for Love"
                    autoFocus
                  />
                </Field>
                <Field label="Original title" meta="optional">
                  <Input
                    value={draft.original_title || ''}
                    onChange={(event) => set('original_title', event.target.value)}
                    placeholder="花樣年華"
                  />
                </Field>
                <div className="cols-2">
                  <Field label="Verdict">
                    <div className="filter-row">
                      {(['love', 'good', 'hate'] as Category[]).map((category) => (
                        <button
                          key={category}
                          type="button"
                          className={cx('chip', draft.category === category && 'is-active')}
                          onClick={() => set('category', category)}
                        >
                          {category === 'love' ? '◆' : category === 'hate' ? '✕' : '◇'} {category}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Type">
                    <Select value={draft.type} onChange={(event) => set('type', event.target.value as MediaType)}>
                      {SEED_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="cols-2">
                  <Field label="Year">
                    <Input
                      type="number"
                      value={draft.year ?? ''}
                      onChange={(event) => set('year', event.target.value ? Number(event.target.value) : null)}
                      placeholder="2000"
                    />
                  </Field>
                  <Field label="Runtime" meta="minutes">
                    <Input
                      type="number"
                      value={draft.runtime ?? ''}
                      onChange={(event) => set('runtime', event.target.value ? Number(event.target.value) : null)}
                      placeholder="98"
                    />
                  </Field>
                </div>
                <div className="cols-2">
                  <Field label="Country">
                    <Input value={draft.country} onChange={(event) => set('country', event.target.value)} placeholder="Hong Kong" />
                  </Field>
                  <Field label="Language">
                    <Input value={draft.language} onChange={(event) => set('language', event.target.value)} placeholder="Cantonese" />
                  </Field>
                </div>
                <Field label="Genre" meta="comma separated">
                  <Input value={draft.genre} onChange={(event) => set('genre', event.target.value)} placeholder="Romance, Drama" />
                </Field>
                {draft.type === 'series' && (
                  <div className="cols-3">
                    <Field label="Seasons">
                      <Input
                        type="number"
                        value={draft.seasons ?? ''}
                        onChange={(event) => set('seasons', event.target.value ? Number(event.target.value) : null)}
                      />
                    </Field>
                    <Field label="Episodes">
                      <Input
                        type="number"
                        value={draft.episodes ?? ''}
                        onChange={(event) => set('episodes', event.target.value ? Number(event.target.value) : null)}
                      />
                    </Field>
                    <Field label="Per season">
                      <Input
                        type="number"
                        value={draft.episodes_per_season ?? ''}
                        onChange={(event) =>
                          set('episodes_per_season', event.target.value ? Number(event.target.value) : null)
                        }
                      />
                    </Field>
                  </div>
                )}
                <Field label="Tags" hint="Retrieval tags, not moods. The AI booth can suggest six.">
                  <TagInput tags={tags} onChange={(next) => set('tags', joinList(next))} />
                </Field>
              </>
            )}

            {tab === 'verdict' && (
              <>
                <div className="cols-2">
                  <Field label="Status">
                    <Select value={draft.status} onChange={(event) => set('status', event.target.value)}>
                      {SEED_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Watched date">
                    <Input
                      type="date"
                      value={draft.watched_date || ''}
                      onChange={(event) => set('watched_date', event.target.value || null)}
                    />
                  </Field>
                </div>
                <Field label="Rating" meta={`${draft.rating}/10`}>
                  <Slider
                    value={draft.rating}
                    min={0}
                    max={10}
                    step={0.5}
                    onChange={(value) => set('rating', value)}
                    display={`${draft.rating}`}
                  />
                </Field>
                <Toggle checked={draft.favorite} onChange={(value) => set('favorite', value)} label="Mark as favourite" />
                <Field label="Why it is on the shelf" hint="One sentence. This is the line the AI will argue with.">
                  <Textarea
                    value={draft.reason}
                    onChange={(event) => set('reason', event.target.value)}
                    placeholder="The most precise film ever made about the space between two people."
                  />
                </Field>
                <Field label="Summary" hint="Factual, one or two sentences. The AI standardiser can fill this.">
                  <Textarea
                    value={draft.summary}
                    onChange={(event) => set('summary', event.target.value)}
                    placeholder="Two neighbours in 1962 Hong Kong discover their spouses are having an affair…"
                  />
                </Field>
              </>
            )}

            {tab === 'craft' && (
              <>
                <Field label="Private notes" hint="Anything: where you watched it, what to look for next time.">
                  <Textarea
                    className="textarea--tall"
                    value={draft.notes}
                    onChange={(event) => set('notes', event.target.value)}
                    placeholder="The corridor shots are a whole grammar."
                  />
                </Field>
                <Field label="Story analysis" hint="Structured reading. The Deep analysis action writes here on request.">
                  <Textarea
                    className="textarea--tall"
                    value={draft.story_analysis}
                    onChange={(event) => set('story_analysis', event.target.value)}
                    placeholder="Wong builds the entire film out of obstructions…"
                  />
                </Field>
                <Field label="Trailer URL">
                  <Input
                    value={draft.trailer_url}
                    onChange={(event) => set('trailer_url', event.target.value)}
                    placeholder="https://…"
                  />
                </Field>
                <div className="cols-2">
                  <Field label="Poster URL" hint="Empty = procedural poster.">
                    <Input value={draft.poster_url} onChange={(event) => set('poster_url', event.target.value)} />
                  </Field>
                  <Field label="Backdrop URL">
                    <Input value={draft.backdrop_url} onChange={(event) => set('backdrop_url', event.target.value)} />
                  </Field>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="stack">
          <div className="panel panel--flat">
            <div className="panel-title">
              <Sparkles size={11} /> Preview
            </div>
            <Poster
              title={draft.title || 'Untitled'}
              year={draft.year}
              category={draft.category}
              score={draft.rating}
              favorite={draft.favorite}
              flat
            />
            <div className="stack stack--tight" style={{ marginTop: 10, fontSize: 'var(--fs-2xs)', color: 'var(--text-4)' }}>
              <span>{draft.type} · {draft.status}</span>
              <span>{draft.genre || 'no genre yet'}</span>
              <span>{draft.runtime ? `${draft.runtime} minutes` : 'runtime unknown'}</span>
            </div>
          </div>
          <p className="field__hint">
            Nothing is uploaded. The entry lives in this browser’s local database and is included in JSON exports.
          </p>
        </div>
      </div>
    </Modal>
  );
}
