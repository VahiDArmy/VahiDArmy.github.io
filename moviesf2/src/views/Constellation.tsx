/** The shelf as a graph: typed edges between titles. */

import { useMemo, useState } from 'react';
import { GitBranch, Network, Plus, Trash2 } from 'lucide-react';
import { navigate } from '../app/router';
import { insertRow, removeRow, useDb } from '../data/store';
import { SEED_RELATIONSHIP_KINDS } from '../components/constants';
import { n } from '../lib/format-extra';
import { hashHue } from '../lib/utils';
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
  cx,
} from '../components/ui';

export function Constellation() {
  const db = useDb();
  const [kind, setKind] = useState('all');
  const [category, setCategory] = useState('all');
  const [focus, setFocus] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title_id: '', related_title_id: '', kind: SEED_RELATIONSHIP_KINDS[0], weight: 0.7 });

  const titles = useMemo(
    () => db.cinema_titles.filter((title) => category === 'all' || title.category === category),
    [db.cinema_titles, category],
  );
  const idSet = useMemo(() => new Set(titles.map((title) => title.id)), [titles]);
  const edges = useMemo(
    () =>
      db.cinema_relationships.filter(
        (relationship) =>
          (kind === 'all' || relationship.kind === kind) &&
          idSet.has(relationship.title_id) &&
          idSet.has(relationship.related_title_id),
      ),
    [db.cinema_relationships, kind, idSet],
  );

  const nodes = useMemo(() => {
    const width = 1000;
    const height = 640;
    return titles.map((title, index) => {
      const angle = (index / Math.max(1, titles.length)) * Math.PI * 2 - Math.PI / 2;
      const jitter = (hashHue(title.id) % 100) / 100;
      const radius = 150 + jitter * 130;
      const degree = edges.filter((edge) => edge.title_id === title.id || edge.related_title_id === title.id).length;
      return {
        title,
        x: width / 2 + Math.cos(angle) * radius * 1.35,
        y: height / 2 + Math.sin(angle) * radius,
        r: 4 + title.rating * 0.55 + degree * 0.5,
        degree,
      };
    });
  }, [titles, edges]);

  const position = useMemo(() => new Map(nodes.map((node) => [node.title.id, node])), [nodes]);
  const connected = useMemo(
    () => [...nodes].sort((a, b) => b.degree - a.degree).slice(0, 8),
    [nodes],
  );

  const add = () => {
    if (!draft.title_id || !draft.related_title_id || draft.title_id === draft.related_title_id) return;
    insertRow('cinema_relationships', {
      title_id: draft.title_id,
      related_title_id: draft.related_title_id,
      kind: draft.kind,
      weight: draft.weight,
    } as never);
    setAdding(false);
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Screen · {edges.length} edges · {titles.length} nodes</div>
          <h1 className="page-title">
            Nothing stands <em>alone.</em>
          </h1>
          <p className="page-sub">
            Every edge is a claim: a spiritual twin, a rebuttal, the same hand behind the camera. The graph is only as
            interesting as the arguments you record.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            Add relation
          </Button>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Nodes" value={n(titles.length)} icon={<Network size={11} />} />
        <Stat label="Edges" value={n(edges.length)} foot="typed connections" />
        <Stat label="Kinds" value={n(new Set(db.cinema_relationships.map((edge) => edge.kind)).size)} />
        <Stat label="Density" value={(edges.length / Math.max(1, titles.length)).toFixed(2)} foot="edges per title" />
      </div>

      <div className="library-bar" style={{ position: 'static' }}>
        <div className="filter-row">
          <button className={cx('chip', kind === 'all' && 'is-active')} onClick={() => setKind('all')}>
            all edges
          </button>
          {Array.from(new Set(db.cinema_relationships.map((edge) => edge.kind))).map((item) => (
            <button key={item} className={cx('chip', kind === item && 'is-active')} onClick={() => setKind(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="filter-row" style={{ marginLeft: 'auto' }}>
          {['all', 'love', 'good', 'hate'].map((item) => (
            <button key={item} className={cx('chip', category === item && 'is-active')} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      {titles.length < 2 || !edges.length ? (
        <EmptyState
          icon={<GitBranch size={22} />}
          title="The graph is empty"
          text="Add a relation between two titles. Start with the pair you always mention in the same sentence."
          action={<Button variant="primary" onClick={() => setAdding(true)}>Add the first edge</Button>}
        />
      ) : (
        <div className="title-layout">
          <div className="constellation-wrap">
            <svg className="constellation" viewBox="0 0 1000 640" role="img" aria-label="Title relationship graph">
              <defs>
                <radialGradient id="graphGlow">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="500" cy="320" r="300" fill="url(#graphGlow)" />
              {edges.map((edge) => {
                const a = position.get(edge.title_id);
                const b = position.get(edge.related_title_id);
                if (!a || !b) return null;
                const active = focus && (edge.title_id === focus || edge.related_title_id === focus);
                return (
                  <line
                    key={edge.id}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={cx('edge', (edge.weight > 0.7 || active) && 'edge--strong')}
                    strokeOpacity={active ? 0.95 : 0.25 + edge.weight * 0.5}
                    strokeWidth={0.7 + edge.weight * 1.8}
                  />
                );
              })}
              {nodes.map((node) => (
                <g key={node.title.id} onClick={() => navigate('title', node.title.id)} onMouseEnter={() => setFocus(node.title.id)} onMouseLeave={() => setFocus(null)} style={{ cursor: 'pointer' }}>
                  <circle cx={node.x} cy={node.y} r={node.r + 7} fill="transparent" />
                  <circle
                    className="node"
                    data-cat={node.title.category}
                    cx={node.x}
                    cy={node.y}
                    r={node.r}
                    opacity={focus && focus !== node.title.id ? 0.4 : 1}
                  />
                  {(node.degree >= 2 || node.title.rating >= 9 || focus === node.title.id) && (
                    <text
                      x={node.x}
                      y={node.y - node.r - 6}
                      textAnchor="middle"
                      className="node-label"
                      opacity={focus && focus !== node.title.id ? 0.35 : 0.9}
                    >
                      {node.title.title.length > 26 ? `${node.title.title.slice(0, 24)}…` : node.title.title}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>

          <aside className="title-side">
            <div className="card card--pad">
              <div className="panel-title">Most connected</div>
              <div className="stack stack--tight">
                {connected.map((node) => (
                  <button key={node.title.id} className="mini-row" onClick={() => navigate('title', node.title.id)} style={{ textAlign: 'left' }}>
                    <MiniPoster title={node.title.title} category={node.title.category} />
                    <span className="mini-row__title">{node.title.title}</span>
                    <span className="mini-row__meta">{node.degree} edges</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="card card--pad">
              <div className="panel-title">Legend</div>
              <div className="stack stack--tight" style={{ fontSize: 10, color: 'var(--text-3)' }}>
                <span className="row" style={{ gap: 7 }}>
                  <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--love)' }} /> loved
                </span>
                <span className="row" style={{ gap: 7 }}>
                  <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--good)' }} /> respected
                </span>
                <span className="row" style={{ gap: 7 }}>
                  <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--hate)' }} /> rejected
                </span>
                <span className="row" style={{ gap: 7 }}>
                  <i style={{ width: 18, height: 1, background: 'var(--accent)' }} /> strong edge (weight &gt; 0.7)
                </span>
                <span className="faint">Node size = verdict × connections.</span>
              </div>
            </div>
            <div className="card card--pad">
              <div className="panel-title">Edges</div>
              <div className="stack stack--tight" style={{ maxHeight: 280, overflowY: 'auto' }}>
                {edges.map((edge) => {
                  const a = db.cinema_titles.find((title) => title.id === edge.title_id);
                  const b = db.cinema_titles.find((title) => title.id === edge.related_title_id);
                  return (
                    <div className="mini-row" key={edge.id}>
                      <span className="mini-row__title" style={{ fontSize: 10 }}>
                        {a?.title} → {b?.title}
                        <span className="mono faint" style={{ display: 'block', fontSize: 8.5 }}>
                          {edge.kind} · {edge.weight.toFixed(2)}
                        </span>
                      </span>
                      <button className="icon-btn icon-btn--sm" onClick={() => removeRow('cinema_relationships', edge.id)} aria-label="Delete edge">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      )}

      {adding && (
        <Modal
          title="Add a relation"
          subtitle="A typed edge between two titles."
          onClose={() => setAdding(false)}
          size="md"
          actions={
            <>
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button variant="primary" onClick={add}>Add edge</Button>
            </>
          }
        >
          <div className="stack">
            <Field label="From">
              <Select value={draft.title_id} onChange={(event) => setDraft((current) => ({ ...current, title_id: event.target.value }))}>
                <option value="">Choose…</option>
                {db.cinema_titles.map((title) => (
                  <option key={title.id} value={title.id}>{title.title}</option>
                ))}
              </Select>
            </Field>
            <Field label="To">
              <Select value={draft.related_title_id} onChange={(event) => setDraft((current) => ({ ...current, related_title_id: event.target.value }))}>
                <option value="">Choose…</option>
                {db.cinema_titles.map((title) => (
                  <option key={title.id} value={title.id}>{title.title}</option>
                ))}
              </Select>
            </Field>
            <div className="cols-2">
              <Field label="Kind">
                <Select value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value }))}>
                  {SEED_RELATIONSHIP_KINDS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Weight" meta={draft.weight.toFixed(2)}>
                <input
                  type="range"
                  className="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={draft.weight}
                  onChange={(event) => setDraft((current) => ({ ...current, weight: Number(event.target.value) }))}
                  style={{ '--fill': `${draft.weight * 100}%` } as React.CSSProperties}
                />
              </Field>
            </div>
            <div className="panel panel--flat">
              <div className="panel-title">Preview</div>
              <div className="row" style={{ gap: 8, fontSize: 10, color: 'var(--text-3)' }}>
                <Chip sm mono>{draft.kind}</Chip>
                <span>weight {draft.weight.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
