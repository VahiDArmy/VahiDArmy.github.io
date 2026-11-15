/** Lines worth keeping, and facts worth knowing. */

import { useMemo, useState } from 'react';
import { Plus, Quote as QuoteIcon, Sparkles, Star, Trash2 } from 'lucide-react';
import { navigate } from '../app/router';
import { insertRow, removeRow, updateRow, useDb } from '../data/store';
import type { Quote } from '../types';
import { n } from '../lib/format-extra';
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  MiniPoster,
  Modal,
  SearchField,
  Select,
  Tabs,
  Textarea,
  Toggle,
  useToast,
  cx,
} from '../components/ui';

export function Quotes() {
  const db = useDb();
  const toast = useToast();
  const [tab, setTab] = useState<'quotes' | 'trivia'>('quotes');
  const [search, setSearch] = useState('');
  const [titleFilter, setTitleFilter] = useState('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [addingQuote, setAddingQuote] = useState(false);
  const [addingTrivia, setAddingTrivia] = useState(false);
  const [draft, setDraft] = useState({ title_id: '', text: '', speaker: '', at_minute: '', favorite: false });
  const [triviaDraft, setTriviaDraft] = useState({ title_id: '', content: '', source: '' });

  const quotes = useMemo(
    () =>
      db.cinema_quotes
        .filter((quote) => {
          if (titleFilter !== 'all' && quote.title_id !== titleFilter) return false;
          if (favoritesOnly && !quote.favorite) return false;
          if (!search.trim()) return true;
          const title = db.cinema_titles.find((entry) => entry.id === quote.title_id);
          return `${quote.text} ${quote.speaker} ${title?.title || ''}`.toLowerCase().includes(search.toLowerCase());
        })
        .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.text.localeCompare(b.text)),
    [db, search, titleFilter, favoritesOnly],
  );

  const trivia = useMemo(
    () =>
      db.cinema_trivia.filter((row) => {
        if (titleFilter !== 'all' && row.title_id !== titleFilter) return false;
        if (!search.trim()) return true;
        const title = db.cinema_titles.find((entry) => entry.id === row.title_id);
        return `${row.content} ${row.source} ${title?.title || ''}`.toLowerCase().includes(search.toLowerCase());
      }),
    [db, search, titleFilter],
  );

  const addQuote = () => {
    if (!draft.text.trim()) return;
    insertRow('cinema_quotes', {
      title_id: draft.title_id || db.cinema_titles[0]?.id,
      text: draft.text,
      speaker: draft.speaker,
      at_minute: draft.at_minute ? Number(draft.at_minute) : null,
      favorite: draft.favorite,
    } as never);
    setAddingQuote(false);
    setDraft({ title_id: '', text: '', speaker: '', at_minute: '', favorite: false });
    toast.push({ tone: 'success', title: 'Quote saved' });
  };

  const addTrivia = () => {
    if (!triviaDraft.content.trim()) return;
    insertRow('cinema_trivia', {
      title_id: triviaDraft.title_id || db.cinema_titles[0]?.id,
      content: triviaDraft.content,
      source: triviaDraft.source || 'unverified',
    } as never);
    setAddingTrivia(false);
    setTriviaDraft({ title_id: '', content: '', source: '' });
    toast.push({ tone: 'success', title: 'Trivia saved' });
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Curation · {db.cinema_quotes.length} quotes · {db.cinema_trivia.length} facts</div>
          <h1 className="page-title">
            What survives the <em>credits.</em>
          </h1>
          <p className="page-sub">
            A line kept is an argument with the film. A production fact is the same argument, made with evidence.
          </p>
        </div>
        <div className="page-actions">
          <Button
            variant="primary"
            icon={<Plus size={14} />}
            onClick={() => (tab === 'quotes' ? setAddingQuote(true) : setAddingTrivia(true))}
          >
            {tab === 'quotes' ? 'Add a quote' : 'Add trivia'}
          </Button>
        </div>
      </div>

      <div className="library-bar" style={{ position: 'static' }}>
        <div style={{ flex: 1, maxWidth: 300 }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search lines and facts…" />
        </div>
        <Select className="filter-select" value={titleFilter} onChange={(event) => setTitleFilter(event.target.value)}>
          <option value="all">All titles</option>
          {db.cinema_titles.map((title) => (
            <option key={title.id} value={title.id}>{title.title}</option>
          ))}
        </Select>
        {tab === 'quotes' && (
          <button className={cx('chip', favoritesOnly && 'is-active')} onClick={() => setFavoritesOnly((value) => !value)}>
            <Star size={10} /> favourites
          </button>
        )}
        <span className="count-label" style={{ marginLeft: 'auto' }}>
          <b>{tab === 'quotes' ? quotes.length : trivia.length}</b> entries
        </span>
      </div>

      <Tabs
        tabs={[
          { id: 'quotes', label: 'Quotes', count: quotes.length },
          { id: 'trivia', label: 'Trivia', count: trivia.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div style={{ marginTop: 'var(--sp-4)' }}>
        {tab === 'quotes' ? (
          quotes.length ? (
            <div className="quote-grid stagger">
              {quotes.map((quote: Quote) => {
                const title = db.cinema_titles.find((entry) => entry.id === quote.title_id);
                return (
                  <div className="quote-card" key={quote.id}>
                    <p className="quote-card__text">{quote.text}</p>
                    <div className="quote-card__foot">
                      <button onClick={() => title && navigate('title', title.id)} style={{ color: 'var(--accent)' }}>
                        {title?.title || 'Unknown'}
                      </button>
                      <span>·</span>
                      <span>{quote.speaker || 'unknown speaker'}</span>
                      {quote.at_minute ? <span>· {quote.at_minute}′</span> : null}
                      <span className="spacer" />
                      <button
                        className="icon-btn icon-btn--sm"
                        onClick={() => updateRow('cinema_quotes', quote.id, { favorite: !quote.favorite })}
                        aria-label="Toggle favourite"
                        style={{ color: quote.favorite ? 'var(--accent)' : undefined }}
                      >
                        <Star size={11} />
                      </button>
                      <button className="icon-btn icon-btn--sm" onClick={() => removeRow('cinema_quotes', quote.id)} aria-label="Delete quote">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<QuoteIcon size={22} />}
              title="No quotes yet"
              text="Keep the line you repeat in the kitchen. The booth can also excavate quotes, marked by confidence."
              action={<Button variant="outline" onClick={() => setAddingQuote(true)}>Add one</Button>}
            />
          )
        ) : trivia.length ? (
          <div className="card card--pad">
            {trivia.map((row, index) => {
              const title = db.cinema_titles.find((entry) => entry.id === row.title_id);
              return (
                <div className="trivia-row" key={row.id}>
                  <span className="trivia-index">{String(index + 1).padStart(2, '0')}</span>
                  <div className="trivia-body" style={{ flex: 1 }}>
                    <p>{row.content}</p>
                    <span>
                      <button onClick={() => title && navigate('title', title.id)} style={{ color: 'var(--accent)' }}>
                        {title?.title || 'Unknown'}
                      </button>{' '}
                      · {row.source || 'unverified'}
                    </span>
                  </div>
                  <button className="icon-btn icon-btn--sm" onClick={() => removeRow('cinema_trivia', row.id)} aria-label="Delete trivia">
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Sparkles size={22} />}
            title="No production notes"
            text="A fact with a source is worth three without one."
            action={<Button variant="outline" onClick={() => setAddingTrivia(true)}>Add one</Button>}
          />
        )}
      </div>

      {addingQuote && (
        <Modal
          title="Add a quote"
          onClose={() => setAddingQuote(false)}
          size="md"
          actions={
            <>
              <Button variant="ghost" onClick={() => setAddingQuote(false)}>Cancel</Button>
              <Button variant="primary" onClick={addQuote}>Save</Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Title">
              <Select value={draft.title_id} onChange={(event) => setDraft((current) => ({ ...current, title_id: event.target.value }))}>
                <option value="">Choose…</option>
                {db.cinema_titles.map((title) => (
                  <option key={title.id} value={title.id}>{title.title}</option>
                ))}
              </Select>
            </Field>
            <Field label="Line">
              <Textarea value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} autoFocus />
            </Field>
            <div className="cols-2">
              <Field label="Speaker">
                <Input value={draft.speaker} onChange={(event) => setDraft((current) => ({ ...current, speaker: event.target.value }))} />
              </Field>
              <Field label="At minute">
                <Input type="number" value={draft.at_minute} onChange={(event) => setDraft((current) => ({ ...current, at_minute: event.target.value }))} />
              </Field>
            </div>
            <Toggle checked={draft.favorite} onChange={(value) => setDraft((current) => ({ ...current, favorite: value }))} label="Favourite line" />
          </div>
        </Modal>
      )}

      {addingTrivia && (
        <Modal
          title="Add trivia"
          onClose={() => setAddingTrivia(false)}
          size="md"
          actions={
            <>
              <Button variant="ghost" onClick={() => setAddingTrivia(false)}>Cancel</Button>
              <Button variant="primary" onClick={addTrivia}>Save</Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Title">
              <Select value={triviaDraft.title_id} onChange={(event) => setTriviaDraft((current) => ({ ...current, title_id: event.target.value }))}>
                <option value="">Choose…</option>
                {db.cinema_titles.map((title) => (
                  <option key={title.id} value={title.id}>{title.title}</option>
                ))}
              </Select>
            </Field>
            <Field label="Fact">
              <Textarea value={triviaDraft.content} onChange={(event) => setTriviaDraft((current) => ({ ...current, content: event.target.value }))} autoFocus />
            </Field>
            <Field label="Source" hint="Publication, archive, or “unverified”.">
              <Input value={triviaDraft.source} onChange={(event) => setTriviaDraft((current) => ({ ...current, source: event.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}
