/** Share links are real records, even when the audience is hypothetical. */

import { useMemo, useState } from 'react';
import { Copy, ExternalLink, Link2, Plus, Share2, Trash2 } from 'lucide-react';
import { navigate } from '../app/router';
import { insertRow, removeRow, updateRow, useDb } from '../data/store';
import { logActivity } from '../data/store';
import { copyText, download, nowIso, slugify } from '../lib/utils';
import { relativeDay, shortDate } from '../lib/format-extra';
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
  useConfirm,
  useToast,
  cx,
} from '../components/ui';

export function Shares() {
  const db = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title_id: '', slug: '', days: 30 });

  const shares = useMemo(() => [...db.cinema_shares].sort((a, b) => b.created_at.localeCompare(a.created_at)), [db.cinema_shares]);
  const live = shares.filter((share) => !share.expires_at || new Date(share.expires_at).getTime() > Date.now());
  const totalViews = shares.reduce((total, share) => total + share.views, 0);

  const linkFor = (slug: string) => `${window.location.origin}${window.location.pathname}#/t/${slug}`;

  const add = () => {
    const title = db.cinema_titles.find((entry) => entry.id === draft.title_id);
    const slug = slugify(draft.slug || title?.title || 'untitled') + '-' + Math.random().toString(36).slice(2, 6);
    insertRow('cinema_shares', {
      title_id: draft.title_id || null,
      slug,
      expires_at: draft.days ? new Date(Date.now() + draft.days * 86_400_000).toISOString() : null,
      views: 0,
    } as never);
    logActivity('shared', 'cinema_shares', null, `Created /t/${slug}`);
    setAdding(false);
    setDraft({ title_id: '', slug: '', days: 30 });
    toast.push({ tone: 'success', title: 'Share created', body: 'The slug is stored locally with the title.' });
  };

  const copy = async (slug: string, id: string, views: number) => {
    const ok = await copyText(linkFor(slug));
    if (ok) {
      updateRow('cinema_shares', id, { views: views + 1 });
      toast.push({ tone: 'success', title: 'Link copied', body: 'View count incremented locally.' });
    }
  };

  const exportLinks = () => {
    const body = shares.map((share) => {
      const title = db.cinema_titles.find((entry) => entry.id === share.title_id);
      return `${linkFor(share.slug)} — ${title?.title || 'unlinked'} — ${share.views} views`;
    });
    download('fmc-share-links.txt', body.join('\n'), 'text/plain');
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Distribution · {live.length} live</div>
          <h1 className="page-title">
            Send the <em>shelf.</em>
          </h1>
          <p className="page-sub">
            Slugs are stable identifiers you control. This build stores them alongside the title; connecting a public
            backend would make the same paths resolvable for other people.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline" icon={<Copy size={13} />} onClick={exportLinks}>Export links</Button>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>New share</Button>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Shares" value={shares.length} icon={<Share2 size={11} />} foot={`${shares.length - live.length} expired`} />
        <Stat label="Clicks" value={totalViews} foot="local copy events" />
        <Stat label="Public titles" value={db.cinema_titles.filter((title) => title.favorite).length} foot="favourites worth sending" />
      </div>

      {shares.length ? (
        <div className="cols-3">
          {shares.map((share) => {
            const title = db.cinema_titles.find((entry) => entry.id === share.title_id);
            const expired = share.expires_at ? new Date(share.expires_at).getTime() < Date.now() : false;
            return (
              <article key={share.id} className={cx('card card--pad', expired && 'is-muted')} style={{ position: 'relative' }}>
                <div className="row row--between" style={{ marginBottom: 10 }}>
                  <span className="row" style={{ gap: 7 }}>
                    <Link2 size={13} style={{ color: expired ? 'var(--text-4)' : 'var(--accent)' }} />
                    <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>/t/{share.slug}</span>
                  </span>
                  <Chip sm mono tone={expired ? undefined : 'accent'}>{expired ? 'expired' : 'live'}</Chip>
                </div>
                <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  {title && <MiniPoster title={title.title} category={title.category} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', lineHeight: 1.1 }}>
                      {title?.title || 'Unlinked share'}
                    </div>
                    <div className="faint" style={{ fontSize: 9, marginTop: 3 }}>
                      {title?.year || '—'} · {share.expires_at ? `expires ${shortDate(share.expires_at)}` : 'no expiry'}
                    </div>
                  </div>
                </div>
                <div className="row row--between" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-1)' }}>
                  <span className="row" style={{ gap: 5 }}>
                    <b className="mono" style={{ fontSize: 15 }}>{share.views}</b>
                    <span className="faint" style={{ fontSize: 9 }}>views</span>
                  </span>
                  <span className="row" style={{ gap: 2 }}>
                    <button className="icon-btn icon-btn--sm" title="Copy link" onClick={() => copy(share.slug, share.id, share.views)}>
                      <Copy size={11} />
                    </button>
                    {title && (
                      <button className="icon-btn icon-btn--sm" title="Open title" onClick={() => navigate('title', title.id)}>
                        <ExternalLink size={11} />
                      </button>
                    )}
                    <button
                      className="icon-btn icon-btn--sm"
                      title="Delete share"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete this share?',
                          body: `The slug /t/${share.slug} stops resolving. The title stays.`,
                          confirmLabel: 'Delete share',
                          danger: true,
                        });
                        if (ok) removeRow('cinema_shares', share.id);
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Share2 size={22} />}
          title="No links yet"
          text="Create a slug for the title you keep recommending. The link is yours; the audience is optional."
          action={<Button variant="primary" onClick={() => setAdding(true)}>Create a share</Button>}
        />
      )}

      <section className="card card--pad" style={{ marginTop: 'var(--sp-5)' }}>
        <div className="panel-title">How the link resolves</div>
        <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-3)', lineHeight: 1.75, maxWidth: 720 }}>
          A share is a row in <span className="mono">cinema_shares</span>: a slug, an optional title reference, an
          expiry, and a view counter. In a hosted deployment the same row lets a public route fetch one title and its
          notes without exposing the rest of the shelf. Nothing here is uploaded anywhere by this build.
        </p>
        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          <Chip mono sm>stable slug</Chip>
          <Chip mono sm>expiry</Chip>
          <Chip mono sm>view count</Chip>
          <Chip mono sm>local only</Chip>
        </div>
      </section>

      {adding && (
        <Modal
          title="New share"
          icon={<Share2 size={16} />}
          onClose={() => setAdding(false)}
          size="md"
          actions={
            <>
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button variant="primary" onClick={add}>Create link</Button>
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
            <Field label="Slug" hint="letters, numbers and dashes; a short suffix is appended.">
              <Input value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} placeholder="stalker-1979" />
            </Field>
            <Field label="Expires in (days)" hint="0 means never">
              <Input type="number" min={0} value={draft.days} onChange={(event) => setDraft((current) => ({ ...current, days: Number(event.target.value) }))} />
            </Field>
            <div className="panel panel--flat">
              <div className="panel-title">Preview</div>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', wordBreak: 'break-all' }}>
                {linkFor(slugify(draft.slug || db.cinema_titles.find((title) => title.id === draft.title_id)?.title || 'untitled'))}
              </span>
              <div className="faint" style={{ fontSize: 9, marginTop: 6 }}>
                {draft.days ? `Expires ${relativeDay(new Date(Date.now() + draft.days * 86_400_000).toISOString())}` : 'No expiry'} · created {nowIso().slice(0, 10)}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
