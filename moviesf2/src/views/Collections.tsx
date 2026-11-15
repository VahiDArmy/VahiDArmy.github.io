/** Collections: named arguments about what belongs together. */

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Layers, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { navigate, useRoute } from '../app/router';
import { deleteCollection, insertRow, removeRow, updateRow, useDb } from '../data/store';
import { collectionTitles } from '../data/queries';
import { AI_ACTIONS } from '../ai/prompts';
import type { AiAction, Collection } from '../types';
import { n } from '../lib/format-extra';
import { AiPanel } from '../components/AiPanel';
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  MiniPoster,
  Modal,
  Poster,
  Select,
  Textarea,
  Toggle,
  useConfirm,
  useToast,
  cx,
} from '../components/ui';

const GLYPHS = ['◈', '◐', '✦', '⌗', '∿', '⊗', '☾', '▣', '✶', '❏', '◍', '◇'];
const COLORS = ['#d8ff3e', '#8ab4ff', '#ff6ec7', '#ffb86b', '#7cf0b4', '#a99bff', '#ff5d6c', '#5ee7ff'];

export function Collections({ param }: { param?: string }) {
  const db = useDb();
  const route = useRoute();
  const confirm = useConfirm();
  const toast = useToast();
  const activeId = param || route.param;
  const active = db.cinema_collections.find((collection) => collection.id === activeId);
  const [creating, setCreating] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction | null>(null);
  const [addingTitles, setAddingTitles] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '', color: COLORS[0], icon: '◈', is_public: false });
  const [pickTitle, setPickTitle] = useState('');

  const items = useMemo(() => (active ? collectionTitles(db, active.id) : []), [db, active]);

  const create = () => {
    if (!draft.name.trim()) return;
    const collection = insertRow('cinema_collections', {
      name: draft.name.trim(),
      description: draft.description,
      color: draft.color,
      icon: draft.icon,
      is_public: draft.is_public,
      sort_order: db.cinema_collections.length,
    } as never) as Collection;
    setCreating(false);
    setDraft({ name: '', description: '', color: COLORS[0], icon: '◈', is_public: false });
    toast.push({ tone: 'success', title: 'Collection created', body: collection.name });
    navigate('collections', collection.id);
  };

  const addTitle = () => {
    if (!active || !pickTitle) return;
    if (db.cinema_collection_items.some((item) => item.collection_id === active.id && item.title_id === pickTitle)) {
      toast.push({ tone: 'warn', title: 'Already in this collection' });
      return;
    }
    insertRow('cinema_collection_items', {
      collection_id: active.id,
      title_id: pickTitle,
      position: items.length,
      note: '',
    } as never);
    setPickTitle('');
    toast.push({ tone: 'success', title: 'Added to collection' });
  };

  const move = (titleId: string, direction: -1 | 1) => {
    if (!active) return;
    const ordered = db.cinema_collection_items
      .filter((item) => item.collection_id === active.id)
      .sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((item) => item.title_id === titleId);
    const swap = index + direction;
    if (index < 0 || swap < 0 || swap >= ordered.length) return;
    updateRow('cinema_collection_items', ordered[index].id, { position: swap });
    updateRow('cinema_collection_items', ordered[swap].id, { position: index });
  };

  if (active) {
    const ordered = db.cinema_collection_items
      .filter((item) => item.collection_id === active.id)
      .sort((a, b) => a.position - b.position);
    const collectionAwards = db.cinema_awards.filter((award) => items.some((title) => title.id === award.title_id));
    const averageRating = items.reduce((total, title) => total + title.rating, 0) / Math.max(1, items.length);
    return (
      <>
        <div className="page-head">
          <div className="page-head__copy">
            <div className="eyebrow">
              <button onClick={() => navigate('collections')} style={{ color: 'inherit' }}>Collections</button> / shelf
            </div>
            <h1 className="page-title">{active.name}</h1>
            <p className="page-sub">{active.description || 'No thesis written yet.'}</p>
          </div>
          <div className="page-actions">
            <Button variant="outline" icon={<Plus size={13} />} onClick={() => setAddingTitles(true)}>
              Add title
            </Button>
            <Button variant="ghost" icon={<Sparkles size={13} />} onClick={() => setAiAction(AI_ACTIONS.find((action) => action.id === 'curate') || null)}>
              Curate with AI
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={13} />}
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete “${active.name}”?`,
                  body: 'The collection is removed. The titles themselves stay on the shelf.',
                  confirmLabel: 'Delete collection',
                  danger: true,
                });
                if (!ok) return;
                deleteCollection(active.id);
                navigate('collections');
                toast.push({ tone: 'warn', title: 'Collection deleted' });
              }}
            >
              Delete
            </Button>
          </div>
        </div>

        <section className="collection-detail-hero" style={{ '--tint': `${active.color}22` } as React.CSSProperties}>
          <div className="row row--between row--wrap">
            <div style={{ minWidth: 0 }}>
              <div className="eyebrow">{items.length} titles · avg {averageRating.toFixed(1)} · {collectionAwards.filter((award) => award.won).length} awards</div>
              <h1 style={{ marginTop: 6 }}>
                <span style={{ color: active.color, marginRight: 8 }}>{active.icon}</span>
                {active.name}
              </h1>
              <div className="row" style={{ gap: 6, marginTop: 8 }}>
                <Chip mono sm>{active.color}</Chip>
                <Chip mono sm>{active.is_public ? 'public slug' : 'private'}</Chip>
                <Chip mono sm>{ordered.length} ordered</Chip>
              </div>
            </div>
            <div className="collection-strip" style={{ maxWidth: 320 }}>
              {items.slice(0, 8).map((title) => (
                <Poster key={title.id} title={title.title} year={title.year} category={title.category} size="sm" flat />
              ))}
            </div>
          </div>
        </section>

        <div className="title-layout">
          <div className="title-main">
            <div className="poster-grid">
              {items.map((title) => {
                const item = ordered.find((row) => row.title_id === title.id);
                return (
                  <div className="poster-cell" key={title.id}>
                    <Poster
                      title={title.title}
                      year={title.year}
                      category={title.category}
                      score={title.rating}
                      favorite={title.favorite}
                      onClick={() => navigate('title', title.id)}
                    />
                    <div className="poster-cell__meta">
                      <button className="poster-cell__title" onClick={() => navigate('title', title.id)}>
                        {title.title}
                      </button>
                      <span className="poster-cell__year">{title.year}</span>
                    </div>
                    <div className="row" style={{ gap: 2, marginTop: 3 }}>
                      <button className="icon-btn icon-btn--sm" onClick={() => move(title.id, -1)} aria-label="Move earlier">
                        <ArrowUp size={10} />
                      </button>
                      <button className="icon-btn icon-btn--sm" onClick={() => move(title.id, 1)} aria-label="Move later">
                        <ArrowDown size={10} />
                      </button>
                      <button
                        className="icon-btn icon-btn--sm"
                        onClick={() => item && removeRow('cinema_collection_items', item.id)}
                        aria-label="Remove from collection"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {!items.length && (
              <EmptyState
                icon={<Layers size={22} />}
                title="An empty shelf"
                text="Add the first title, or let the booth propose a collection from what is already on the shelf."
              />
            )}
          </div>
          <aside className="title-side">
            <div className="card card--pad">
              <div className="panel-title">Curator order</div>
              <div className="collection-order-list">
                {ordered.map((item, index) => {
                  const title = db.cinema_titles.find((entry) => entry.id === item.title_id);
                  if (!title) return null;
                  return (
                    <div className="order-row" key={item.id}>
                      <span className="order-row__pos">{String(index + 1).padStart(2, '0')}</span>
                      <MiniPoster title={title.title} category={title.category} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: 'var(--fs-2xs)' }}>{title.title}</strong>
                        {item.note && <div className="order-row__note">{item.note}</div>}
                      </span>
                    </div>
                  );
                })}
                {!ordered.length && <p className="faint" style={{ fontSize: 10 }}>No order yet.</p>}
              </div>
            </div>
            <div className="card card--pad">
              <div className="panel-title">Edit shelf</div>
              <div className="stack">
                <Field label="Name">
                  <Input value={active.name} onChange={(event) => updateRow('cinema_collections', active.id, { name: event.target.value })} />
                </Field>
                <Field label="Description">
                  <Textarea
                    value={active.description}
                    onChange={(event) => updateRow('cinema_collections', active.id, { description: event.target.value })}
                  />
                </Field>
                <Field label="Colour">
                  <div className="filter-row">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        className={cx('swatch', active.color === color && 'is-active')}
                        style={{ background: color }}
                        onClick={() => updateRow('cinema_collections', active.id, { color })}
                        aria-label={color}
                      />
                    ))}
                  </div>
                </Field>
                <Field label="Glyph">
                  <div className="filter-row">
                    {GLYPHS.map((glyph) => (
                      <button
                        key={glyph}
                        className={cx('chip', active.icon === glyph && 'is-active')}
                        onClick={() => updateRow('cinema_collections', active.id, { icon: glyph })}
                      >
                        {glyph}
                      </button>
                    ))}
                  </div>
                </Field>
                <Toggle
                  checked={active.is_public}
                  onChange={(value) => updateRow('cinema_collections', active.id, { is_public: value })}
                  label="Allow a share slug"
                />
              </div>
            </div>
          </aside>
        </div>

        {addingTitles && (
          <Modal
            title="Add to collection"
            subtitle={active.name}
            onClose={() => setAddingTitles(false)}
            size="sm"
            actions={
              <>
                <Button variant="ghost" onClick={() => setAddingTitles(false)}>Done</Button>
                <Button variant="primary" onClick={addTitle}>Add</Button>
              </>
            }
          >
            <Field label="Title">
              <Select value={pickTitle} onChange={(event) => setPickTitle(event.target.value)}>
                <option value="">Choose a title…</option>
                {db.cinema_titles
                  .filter((title) => !items.some((item) => item.id === title.id))
                  .map((title) => (
                    <option key={title.id} value={title.id}>
                      {title.title} ({title.year || '—'})
                    </option>
                  ))}
              </Select>
            </Field>
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

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Curation · {db.cinema_collections.length} shelves</div>
          <h1 className="page-title">
            Arguments, not <em>lists.</em>
          </h1>
          <p className="page-sub">
            A collection is a claim about what belongs together. Give it a colour, an order, and a thesis you could
            defend in an argument.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            New collection
          </Button>
          <Button variant="outline" icon={<Sparkles size={13} />} onClick={() => setAiAction(AI_ACTIONS.find((action) => action.id === 'curate') || null)}>
            AI curator
          </Button>
        </div>
      </div>

      <div className="collection-grid stagger">
        {db.cinema_collections.map((collection) => {
          const items = db.cinema_collection_items.filter((item) => item.collection_id === collection.id);
          const titles = collectionTitles(db, collection.id);
          return (
            <button
              className="collection-card"
              key={collection.id}
              onClick={() => navigate('collections', collection.id)}
              style={{ '--tint': `${collection.color}30` } as React.CSSProperties}
            >
              <div className="collection-card__head">
                <span className="collection-card__glyph" style={{ background: collection.color, color: '#0a0a0b' }}>
                  {collection.icon}
                </span>
                <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <span className="collection-card__name" style={{ display: 'block' }}>
                    {collection.name}
                  </span>
                  <span className="collection-card__count">
                    {items.length} titles · avg {(titles.reduce((total, title) => total + title.rating, 0) / Math.max(1, titles.length)).toFixed(1)}
                  </span>
                </span>
                {collection.is_public && <Chip sm mono>public</Chip>}
              </div>
              <p className="collection-card__desc">{collection.description}</p>
              <div className="collection-strip">
                {titles.slice(0, 7).map((title) => (
                  <Poster key={title.id} title={title.title} year={title.year} category={title.category} size="sm" flat />
                ))}
                {!titles.length && <span className="faint" style={{ fontSize: 10 }}>Empty shelf</span>}
              </div>
              <div className="collection-card__foot">
                <span className="mono faint" style={{ fontSize: 9 }}>
                  sorted by curator
                </span>
                <span style={{ marginLeft: 'auto', color: collection.color, fontSize: 11 }}>open →</span>
              </div>
            </button>
          );
        })}
      </div>

      {!db.cinema_collections.length && (
        <EmptyState
          icon={<Layers size={22} />}
          title="No collections yet"
          text="Start with a thesis: “films where the distance between two people is the entire plot”."
          action={<Button variant="primary" onClick={() => setCreating(true)}>Create the first</Button>}
        />
      )}

      {creating && (
        <Modal
          title="New collection"
          subtitle="A name, a thesis, a colour."
          icon={<Layers size={16} />}
          onClose={() => setCreating(false)}
          size="md"
          actions={
            <>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button variant="primary" onClick={create}>Create</Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Name">
              <Input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="The Longing Machine"
                autoFocus
              />
            </Field>
            <Field label="Thesis" hint="One sentence a reader could disagree with.">
              <Textarea
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Films where the distance between two people is the entire plot."
              />
            </Field>
            <div className="cols-2">
              <Field label="Colour">
                <div className="filter-row">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      className={cx('swatch', draft.color === color && 'is-active')}
                      style={{ background: color }}
                      onClick={() => setDraft((current) => ({ ...current, color }))}
                      aria-label={color}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Glyph">
                <div className="filter-row">
                  {GLYPHS.slice(0, 8).map((glyph) => (
                    <button
                      key={glyph}
                      className={cx('chip', draft.icon === glyph && 'is-active')}
                      onClick={() => setDraft((current) => ({ ...current, icon: glyph }))}
                    >
                      {glyph}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <Toggle
              checked={draft.is_public}
              onChange={(value) => setDraft((current) => ({ ...current, is_public: value }))}
              label="Public share slug allowed"
            />
            <div className="panel panel--flat" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span
                className="collection-card__glyph"
                style={{ background: draft.color, color: '#0a0a0b' }}
              >
                {draft.icon}
              </span>
              <div>
                <strong style={{ fontSize: 'var(--fs-sm)' }}>{draft.name || 'Untitled shelf'}</strong>
                <p className="faint" style={{ fontSize: 10 }}>{draft.description || 'No thesis yet.'}</p>
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
