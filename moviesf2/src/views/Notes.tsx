/** Margin notes: annotations attached to a passage, kept next to the title. */

import { useMemo, useState } from 'react';
import { ArrowUpRight, Highlighter, Pencil, Plus, Quote, StickyNote, Trash2 } from 'lucide-react';
import { navigate } from '../app/router';
import { insertRow, removeRow, updateRow, useDb } from '../data/store';
import { n, relative } from '../lib/format-extra';
import { truncate } from '../lib/utils';
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
  Stat,
  Textarea,
  useConfirm,
  useToast,
  cx,
} from '../components/ui';

export function Notes() {
  const db = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [titleFilter, setTitleFilter] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    title_id: '',
    anchor_before: '',
    anchor_selected: '',
    anchor_after: '',
    note_text: '',
  });

  const notes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return db.cinema_mizan_notes
      .filter((note) => titleFilter === 'all' || note.title_id === titleFilter)
      .filter((note) =>
        !needle ||
        `${note.note_text} ${note.anchor_selected} ${note.anchor_before} ${note.anchor_after}`.toLowerCase().includes(needle),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [db.cinema_mizan_notes, search, titleFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof notes>();
    for (const note of notes) {
      const key = note.title_id || 'unlinked';
      const list = map.get(key) || [];
      list.push(note);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [notes]);

  const annotated = new Set(db.cinema_mizan_notes.map((note) => note.title_id).filter(Boolean)).size;

  const add = () => {
    if (!draft.note_text.trim()) {
      toast.push({ tone: 'warn', title: 'Write something first' });
      return;
    }
    insertRow('cinema_mizan_notes', {
      content_id: Math.floor(Math.random() * 1_000_000),
      title_id: draft.title_id || null,
      anchor_before: draft.anchor_before,
      anchor_selected: draft.anchor_selected,
      anchor_after: draft.anchor_after,
      note_text: draft.note_text.trim(),
    } as never);
    setAdding(false);
    setDraft({ title_id: '', anchor_before: '', anchor_selected: '', anchor_after: '', note_text: '' });
    toast.push({ tone: 'success', title: 'Note pinned' });
  };

  const save = (id: string, patch: { note_text?: string; anchor_selected?: string }) => {
    updateRow('cinema_mizan_notes', id, patch);
    setEditing(null);
    toast.push({ tone: 'success', title: 'Note updated' });
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Reading · {db.cinema_mizan_notes.length} notes</div>
          <h1 className="page-title">
            The <em>margins</em> remember.
          </h1>
          <p className="page-sub">
            A note keeps the sentence it was written against. Anchors are stored either side of the selection so the
            passage survives an edit.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            New note
          </Button>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Notes" value={n(db.cinema_mizan_notes.length)} icon={<StickyNote size={11} />} />
        <Stat label="Annotated titles" value={n(annotated)} foot="with at least one note" />
        <Stat label="Passages" value={n(db.cinema_mizan_notes.filter((note) => note.anchor_selected).length)} foot="anchored selections" />
      </div>

      <div className="library-bar" style={{ position: 'static' }}>
        <div style={{ flex: 1, maxWidth: 320 }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search notes and anchors…" />
        </div>
        <Select className="filter-select" value={titleFilter} onChange={(event) => setTitleFilter(event.target.value)}>
          <option value="all">All titles</option>
          {db.cinema_titles.map((title) => (
            <option key={title.id} value={title.id}>{title.title}</option>
          ))}
        </Select>
        <span className="count-label" style={{ marginLeft: 'auto' }}><b>{notes.length}</b> shown</span>
      </div>

      {notes.length ? (
        <div className="stack" style={{ gap: 'var(--sp-5)' }}>
          {grouped.map(([key, list]) => {
            const title = db.cinema_titles.find((entry) => entry.id === key);
            return (
              <section key={key}>
                <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                  {title ? (
                    <MiniPoster title={title.title} category={title.category} />
                  ) : (
                    <span className="dot" style={{ width: 10, height: 10 }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div className="section-title" style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>
                      {title?.title || 'Unlinked notes'}
                    </div>
                    <div className="faint" style={{ fontSize: 9 }}>
                      {title?.year || '—'} · {list.length} notes
                    </div>
                  </div>
                  {title && (
                    <button className="section-link" style={{ marginLeft: 'auto' }} onClick={() => navigate('title', title.id)}>
                      open title <ArrowUpRight size={10} />
                    </button>
                  )}
                </div>
                <div className="cols-2">
                  {list.map((note) => {
                    const isEditing = editing === note.id;
                    return (
                      <article className={cx('margin-note', isEditing && 'is-editing')} key={note.id}>
                        <div className="margin-note__anchor">
                          <Quote size={11} />
                          <p>
                            {note.anchor_before && <span className="faint">…{truncate(note.anchor_before, 60)} </span>}
                            <mark>{note.anchor_selected || 'no selection'}</mark>
                            {note.anchor_after && <span className="faint"> {truncate(note.anchor_after, 60)}…</span>}
                          </p>
                        </div>
                        {isEditing ? (
                          <div className="stack stack--tight">
                            <Textarea
                              defaultValue={note.note_text}
                              autoFocus
                              onFocus={(event) => {
                                event.currentTarget.selectionStart = event.currentTarget.value.length;
                              }}
                              id={`note-edit-${note.id}`}
                            />
                            <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => {
                                  const element = document.getElementById(`note-edit-${note.id}`) as HTMLTextAreaElement | null;
                                  save(note.id, { note_text: element?.value || note.note_text });
                                }}
                              >
                                Save note
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="margin-note__body">{note.note_text}</p>
                        )}
                        <div className="margin-note__foot">
                          <Chip sm mono>{relative(note.created_at)}</Chip>
                          <span className="spacer" />
                          <button className="icon-btn icon-btn--sm" title="Edit note" onClick={() => setEditing(note.id)}>
                            <Pencil size={10} />
                          </button>
                          <button
                            className="icon-btn icon-btn--sm"
                            title="Delete note"
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Delete this note?',
                                body: 'The annotation and its anchors are removed.',
                                confirmLabel: 'Delete note',
                                danger: true,
                              });
                              if (ok) removeRow('cinema_mizan_notes', note.id);
                            }}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Highlighter size={22} />}
          title={search ? 'No notes match' : 'The margins are empty'}
          text={
            search
              ? 'Try a different phrase. Search covers the note text and the surrounding anchors.'
              : 'Highlight the sentence you disagree with, then explain why. That is the whole system.'
          }
          action={<Button variant="primary" onClick={() => setAdding(true)}>Write the first note</Button>}
        />
      )}

      {adding && (
        <Modal
          title="New margin note"
          subtitle="Quote first, then argue."
          icon={<Highlighter size={16} />}
          onClose={() => setAdding(false)}
          size="lg"
          actions={
            <>
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button variant="primary" onClick={add}>Pin note</Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Title">
              <Select value={draft.title_id} onChange={(event) => setDraft((current) => ({ ...current, title_id: event.target.value }))}>
                <option value="">Unlinked</option>
                {db.cinema_titles.map((title) => (
                  <option key={title.id} value={title.id}>{title.title}</option>
                ))}
              </Select>
            </Field>
            <Field label="Selected passage">
              <Textarea
                value={draft.anchor_selected}
                onChange={(event) => setDraft((current) => ({ ...current, anchor_selected: event.target.value }))}
                placeholder="The exact sentence you are annotating."
                rows={2}
              />
            </Field>
            <div className="cols-2">
              <Field label="Text before" hint="optional anchor">
                <Input value={draft.anchor_before} onChange={(event) => setDraft((current) => ({ ...current, anchor_before: event.target.value }))} />
              </Field>
              <Field label="Text after" hint="optional anchor">
                <Input value={draft.anchor_after} onChange={(event) => setDraft((current) => ({ ...current, anchor_after: event.target.value }))} />
              </Field>
            </div>
            <Field label="Note">
              <Textarea
                className="textarea--tall"
                value={draft.note_text}
                onChange={(event) => setDraft((current) => ({ ...current, note_text: event.target.value }))}
                placeholder="What is wrong, right, or unresolved about this passage?"
              />
            </Field>
            {draft.anchor_selected && (
              <div className="margin-note" style={{ margin: 0 }}>
                <div className="margin-note__anchor">
                  <Quote size={11} />
                  <p><mark>{draft.anchor_selected}</mark></p>
                </div>
                <p className="margin-note__body">{draft.note_text || 'Your note appears here.'}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
