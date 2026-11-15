/** The people index, with every credit you have bothered to record. */

import { useMemo, useState } from 'react';
import { Plus, Search, Star, Trash2, UserPlus, Users } from 'lucide-react';
import { navigate, useRoute } from '../app/router';
import { deletePerson, insertRow, updateRow, useDb } from '../data/store';
import { creditTitles, creditsFor } from '../data/queries';
import type { Person } from '../types';
import { SEED_PEOPLE_ROLES } from '../components/constants';
import { dateLabel, n } from '../lib/format-extra';
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  MiniPoster,
  Modal,
  Poster,
  SearchField,
  Select,
  Stat,
  Textarea,
  Toggle,
  useConfirm,
  useToast,
  cx,
} from '../components/ui';

export function People({ param }: { param?: string }) {
  const db = useDb();
  const route = useRoute();
  const confirm = useConfirm();
  const toast = useToast();
  const activeId = param || route.param;
  const person = db.cinema_people.find((entry) => entry.id === activeId);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [followingOnly, setFollowingOnly] = useState(false);
  const [draft, setDraft] = useState({ name: '', role: 'director', country: '', birth_year: '', notes: '', following: false });

  const people = useMemo(
    () =>
      db.cinema_people
        .filter((entry) => {
          if (role !== 'all' && entry.role !== role) return false;
          if (followingOnly && !entry.following) return false;
          if (!search.trim()) return true;
          return `${entry.name} ${entry.country} ${entry.role}`.toLowerCase().includes(search.toLowerCase());
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [db.cinema_people, role, followingOnly, search],
  );

  const add = () => {
    if (!draft.name.trim()) return;
    const created = insertRow('cinema_people', {
      name: draft.name.trim(),
      role: draft.role,
      country: draft.country,
      birth_year: draft.birth_year ? Number(draft.birth_year) : null,
      notes: draft.notes,
      following: draft.following,
    } as never) as Person;
    setAdding(false);
    setDraft({ name: '', role: 'director', country: '', birth_year: '', notes: '', following: false });
    toast.push({ tone: 'success', title: 'Person added', body: created.name });
  };

  if (person) {
    const credits = db.cinema_credits.filter((credit) => credit.person_id === person.id);
    const titles = creditTitles(db, person.id);
    return (
      <>
        <div className="page-head">
          <div className="page-head__copy">
            <div className="eyebrow">
              <button onClick={() => navigate('people')} style={{ color: 'inherit' }}>People</button> / {person.role}
            </div>
            <h1 className="page-title">{person.name}</h1>
            <p className="page-sub">
              {person.role}
              {person.country ? ` · ${person.country}` : ''}
              {person.birth_year ? ` · born ${person.birth_year}` : ''}
            </p>
          </div>
          <div className="page-actions">
            <Button
              variant={person.following ? 'default' : 'outline'}
              icon={<Star size={13} />}
              onClick={() => updateRow('cinema_people', person.id, { following: !person.following })}
            >
              {person.following ? 'Following' : 'Follow'}
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={13} />}
              onClick={async () => {
                const ok = await confirm({
                  title: `Remove ${person.name}?`,
                  body: 'Their credits are deleted from every title. The titles themselves stay.',
                  confirmLabel: 'Remove person',
                  danger: true,
                });
                if (!ok) return;
                deletePerson(person.id);
                navigate('people');
              }}
            >
              Remove
            </Button>
          </div>
        </div>

        <div className="person-hero">
          <Avatar name={person.name} size="lg" />
          <div style={{ flex: 1 }}>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', fontWeight: 400 }}>
              {person.name}
            </strong>
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              <Chip mono sm>{person.role}</Chip>
              {person.following && <Chip mono sm tone="accent">following</Chip>}
              <Chip mono sm>{credits.length} credits</Chip>
              <Chip mono sm>{titles.filter((title) => title.category === 'love').length} loved</Chip>
            </div>
          </div>
          <div style={{ maxWidth: 320 }}>
            <div className="panel-title">Notes</div>
            <Textarea
              value={person.notes}
              onChange={(event) => updateRow('cinema_people', person.id, { notes: event.target.value })}
              placeholder="What to look for in their work."
              style={{ minHeight: 70 }}
            />
          </div>
        </div>

        <div className="title-layout">
          <div className="title-main">
            <div className="card card--pad">
              <div className="panel-title">Filmography on this shelf</div>
              {titles.length ? (
                <div className="poster-grid">
                  {titles.map((title) => {
                    const credit = credits.find((entry) => entry.title_id === title.id);
                    return (
                      <div className="poster-cell" key={title.id}>
                        <Poster
                          title={title.title}
                          year={title.year}
                          category={title.category}
                          score={title.rating}
                          onClick={() => navigate('title', title.id)}
                        />
                        <div className="poster-cell__meta">
                          <span className="poster-cell__title">{title.title}</span>
                          <span className="poster-cell__year">{credit?.role}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="No credits yet" text="Add them from a title’s People tab." />
              )}
            </div>
          </div>
          <aside className="title-side">
            <div className="card card--pad">
              <div className="panel-title">At a glance</div>
              <dl className="kv">
                <dt>Role</dt>
                <dd>{person.role}</dd>
                <dt>Country</dt>
                <dd>{person.country || '—'}</dd>
                <dt>Birth year</dt>
                <dd>{person.birth_year || '—'}</dd>
                <dt>Added</dt>
                <dd>{dateLabel(person.created_at)}</dd>
                <dt>Following</dt>
                <dd>{person.following ? 'yes' : 'no'}</dd>
              </dl>
            </div>
            <div className="card card--pad">
              <div className="panel-title">Credit ledger</div>
              <div className="stack stack--tight">
                {credits.map((credit) => {
                  const title = db.cinema_titles.find((entry) => entry.id === credit.title_id);
                  return (
                    <div className="mini-row" key={credit.id}>
                      {title && <MiniPoster title={title.title} category={title.category} />}
                      <button className="mini-row__title" onClick={() => title && navigate('title', title.id)}>
                        {title?.title}
                      </button>
                      <span className="mini-row__meta">{credit.role}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">People · {db.cinema_people.length} names</div>
          <h1 className="page-title">
            The hands behind the <em>frame.</em>
          </h1>
          <p className="page-sub">
            Directors, performers and craftspeople you have decided to follow. The credit graph only knows what you tell
            it.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<UserPlus size={14} />} onClick={() => setAdding(true)}>
            Add a person
          </Button>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Names" value={n(db.cinema_people.length)} icon={<Users size={11} />} />
        <Stat label="Following" value={n(db.cinema_people.filter((entry) => entry.following).length)} foot="watch-everything list" />
        <Stat label="Credits" value={n(db.cinema_credits.length)} foot="recorded links" />
        <Stat label="Roles" value={new Set(db.cinema_people.map((entry) => entry.role)).size} foot="craft departments" />
      </div>

      <div className="library-bar" style={{ position: 'static' }}>
        <div style={{ flex: 1, maxWidth: 300 }}>
          <SearchField value={search} onChange={setSearch} placeholder="Name, country, role…" />
        </div>
        <Select className="filter-select" value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="all">All roles</option>
          {SEED_PEOPLE_ROLES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </Select>
        <button className={cx('chip', followingOnly && 'is-active')} onClick={() => setFollowingOnly((value) => !value)}>
          <Star size={10} /> following
        </button>
        <span className="count-label" style={{ marginLeft: 'auto' }}><b>{people.length}</b> names</span>
      </div>

      {people.length ? (
        <div className="people-grid stagger">
          {people.map((entry) => {
            const credits = db.cinema_credits.filter((credit) => credit.person_id === entry.id);
            return (
              <div className="person-card" key={entry.id}>
                <button onClick={() => navigate('people', entry.id)} style={{ display: 'flex', gap: 11, alignItems: 'center', flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <Avatar name={entry.name} accent={entry.following} />
                  <span className="person-card__copy">
                    <span className="person-card__name">{entry.name}</span>
                    <span className="person-card__meta">
                      {entry.role} · {entry.country || '—'} · {credits.length} credits
                    </span>
                  </span>
                </button>
                <button
                  className={cx('person-card__follow', entry.following && 'is-on')}
                  onClick={() => updateRow('cinema_people', entry.id, { following: !entry.following })}
                  aria-label={entry.following ? 'Unfollow' : 'Follow'}
                >
                  <Star size={13} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<Search size={20} />} title="Nobody matches" text="Loosen the filter, or add the name you were looking for." />
      )}

      {adding && (
        <Modal
          title="Add a person"
          subtitle="One name is enough to start."
          icon={<Users size={16} />}
          onClose={() => setAdding(false)}
          size="md"
          actions={
            <>
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button variant="primary" onClick={add}>Add</Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Name">
              <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} autoFocus />
            </Field>
            <div className="cols-2">
              <Field label="Role">
                <Select value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}>
                  {SEED_PEOPLE_ROLES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Country">
                <Input value={draft.country} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} />
              </Field>
            </div>
            <Field label="Birth year">
              <Input type="number" value={draft.birth_year} onChange={(event) => setDraft((current) => ({ ...current, birth_year: event.target.value }))} />
            </Field>
            <Field label="Notes">
              <Textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
            </Field>
            <Toggle checked={draft.following} onChange={(value) => setDraft((current) => ({ ...current, following: value }))} label="Follow this person" />
          </div>
        </Modal>
      )}
    </>
  );
}
