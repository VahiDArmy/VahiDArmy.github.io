/** Trophies, nominations, and the bodies that hand them out. */

import { useMemo, useState } from 'react';
import { Plus, Trophy } from 'lucide-react';
import { navigate } from '../app/router';
import { insertRow, removeRow, useDb } from '../data/store';
import { SEED_AWARD_BODIES } from '../components/constants';
import { n } from '../lib/format-extra';
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  MiniPoster,
  Modal,
  Select,
  Stat,
  Textarea,
  Toggle,
  useToast,
  cx,
} from '../components/ui';

export function Awards() {
  const db = useDb();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [body, setBody] = useState('all');
  const [onlyWins, setOnlyWins] = useState(false);
  const [draft, setDraft] = useState({
    title_id: '',
    body: SEED_AWARD_BODIES[0],
    category: '',
    year: new Date().getFullYear(),
    won: true,
    note: '',
  });

  const awards = useMemo(
    () =>
      db.cinema_awards
        .filter((award) => (body === 'all' || award.body === body) && (!onlyWins || award.won))
        .sort((a, b) => (b.year || 0) - (a.year || 0)),
    [db.cinema_awards, body, onlyWins],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof awards>();
    for (const award of awards) {
      const list = map.get(award.body) || [];
      list.push(award);
      map.set(award.body, list);
    }
    return Array.from(map.entries());
  }, [awards]);

  const add = () => {
    insertRow('cinema_awards', {
      title_id: draft.title_id || null,
      body: draft.body,
      category: draft.category,
      year: draft.year,
      won: draft.won,
      note: draft.note,
    } as never);
    setAdding(false);
    toast.push({ tone: 'success', title: draft.won ? 'Win recorded' : 'Nomination recorded' });
  };

  const wins = db.cinema_awards.filter((award) => award.won).length;

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Curation · {db.cinema_awards.length} records</div>
          <h1 className="page-title">
            What the room <em>agreed on.</em>
          </h1>
          <p className="page-sub">
            Awards are evidence of consensus, not quality. Keep them anyway — they are useful when someone asks why a
            film you love is not on their list.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            Add a record
          </Button>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Wins" value={n(wins)} icon={<Trophy size={11} />} foot="shelf trophies" />
        <Stat label="Nominations" value={n(db.cinema_awards.length - wins)} foot="respectable losses" />
        <Stat label="Bodies" value={n(new Set(db.cinema_awards.map((award) => award.body)).size)} foot="awarding institutions" />
      </div>

      <div className="library-bar" style={{ position: 'static' }}>
        <div className="filter-row">
          <button className={cx('chip', body === 'all' && 'is-active')} onClick={() => setBody('all')}>
            all bodies
          </button>
          {Array.from(new Set(db.cinema_awards.map((award) => award.body))).map((item) => (
            <button key={item} className={cx('chip', body === item && 'is-active')} onClick={() => setBody(item)}>
              {item}
            </button>
          ))}
        </div>
        <button className={cx('chip', onlyWins && 'is-active')} style={{ marginLeft: 'auto' }} onClick={() => setOnlyWins((value) => !value)}>
          <Trophy size={10} /> wins only
        </button>
      </div>

      {awards.length ? (
        <div className="cols-2">
          {grouped.map(([awardBody, list]) => (
            <section className="card card--pad" key={awardBody}>
              <div className="row row--between" style={{ marginBottom: 8 }}>
                <h3 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>
                  <Trophy size={14} style={{ color: 'var(--accent)' }} /> {awardBody}
                </h3>
                <Chip mono sm>{list.length}</Chip>
              </div>
              {list.map((award) => {
                const title = db.cinema_titles.find((entry) => entry.id === award.title_id);
                return (
                  <div className="award-row" key={award.id}>
                    <Trophy size={13} className={cx('award-row__trophy', !award.won && 'is-loss')} />
                    {title && <MiniPoster title={title.title} category={title.category} />}
                    <div className="award-row__body" style={{ flex: 1 }}>
                      <button onClick={() => title && navigate('title', title.id)}>
                        <strong>{title?.title || 'Unlinked award'}</strong>
                      </button>
                      <span>
                        {award.category} · {award.year}
                        {award.note ? ` · ${award.note}` : ''}
                      </span>
                    </div>
                    <Chip sm mono tone={award.won ? 'accent' : undefined}>
                      {award.won ? 'won' : 'nom'}
                    </Chip>
                    <button className="icon-btn icon-btn--sm" onClick={() => removeRow('cinema_awards', award.id)} aria-label="Delete award">
                      ×
                    </button>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Trophy size={22} />}
          title="No awards recorded"
          text="Add the ones that actually matter to you. Nobody is checking."
          action={<Button variant="primary" onClick={() => setAdding(true)}>Add a record</Button>}
        />
      )}

      {adding && (
        <Modal
          title="Add an award record"
          icon={<Trophy size={16} />}
          onClose={() => setAdding(false)}
          size="md"
          actions={
            <>
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button variant="primary" onClick={add}>Save record</Button>
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
            <div className="cols-2">
              <Field label="Body">
                <Input list="award-bodies" value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} />
                <datalist id="award-bodies">
                  {SEED_AWARD_BODIES.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </Field>
              <Field label="Year">
                <Input type="number" value={draft.year} onChange={(event) => setDraft((current) => ({ ...current, year: Number(event.target.value) }))} />
              </Field>
            </div>
            <Field label="Category">
              <Input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Best Actor, Palme d’Or…" />
            </Field>
            <Toggle checked={draft.won} onChange={(value) => setDraft((current) => ({ ...current, won: value }))} label="It won" />
            <Field label="Note">
              <Textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}
