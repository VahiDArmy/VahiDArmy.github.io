/** Craft ratings: the six axes, the distribution, and the argument at the top. */

import { useMemo, useState } from 'react';
import { ArrowUpRight, Star } from 'lucide-react';
import { navigate } from '../app/router';
import { useDb } from '../data/store';
import { axisAverages, ratingDistribution } from '../data/queries';
import type { Rating } from '../types';
import { n } from '../lib/format-extra';
import {
  Bars,
  Button,
  Chip,
  EmptyState,
  MiniPoster,
  Poster,
  Segmented,
  Sparkline,
  Tabs,
  cx,
} from '../components/ui';

type AxisKey = 'story' | 'acting' | 'direction' | 'visuals' | 'sound' | 'rewatch';
const AXES: Array<[AxisKey, string]> = [
  ['story', 'Story'],
  ['acting', 'Acting'],
  ['direction', 'Direction'],
  ['visuals', 'Visuals'],
  ['sound', 'Sound'],
  ['rewatch', 'Rewatch'],
];

export function Ratings() {
  const db = useDb();
  const [sort, setSort] = useState<AxisKey | 'overall'>('overall');
  const [tab, setTab] = useState<'leaderboard' | 'distribution' | 'signature'>('leaderboard');
  const axes = useMemo(() => axisAverages(db), [db]);
  const distribution = useMemo(() => ratingDistribution(db), [db]);

  const rows = useMemo(() => {
    return db.cinema_ratings
      .map((rating) => {
        const title = db.cinema_titles.find((entry) => entry.id === rating.title_id);
        const overall = (rating.story + rating.acting + rating.direction + rating.visuals + rating.sound + rating.rewatch) / 6;
        return { rating, title, overall };
      })
      .filter((row) => row.title)
      .sort((a, b) => {
        if (sort === 'overall') return b.overall - a.overall;
        return (b.rating[sort] as number) - (a.rating[sort] as number);
      });
  }, [db, sort]);

  const top = rows.slice(0, 3);
  const weak = [...rows].sort((a, b) => a.overall - b.overall).slice(0, 3);

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Craft · {rows.length} scored titles</div>
          <h1 className="page-title">
            Six axes, one <em>argument.</em>
          </h1>
          <p className="page-sub">
            The verdict score tells you what you feel. The craft axes tell you why. When they disagree, the disagreement
            is usually the interesting part.
          </p>
        </div>
        <div className="page-actions">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { id: 'leaderboard', label: 'Leaderboard' },
              { id: 'distribution', label: 'Distribution' },
              { id: 'signature', label: 'Signature' },
            ]}
          />
        </div>
      </div>

      {!rows.length ? (
        <EmptyState
          icon={<Star size={22} />}
          title="Nothing scored yet"
          text="Open any title and score its story, acting, direction, visuals, sound and rewatch value."
          action={<Button variant="outline" onClick={() => navigate('library')}>Open the shelf</Button>}
        />
      ) : tab === 'leaderboard' ? (
        <>
          <div className="cols-3">
            {top.map((row, index) => (
              <button
                key={row.rating.id}
                className="card card--pad card--hover"
                style={{ textAlign: 'left', display: 'flex', gap: 12 }}
                onClick={() => row.title && navigate('title', row.title.id)}
              >
                {row.title && (
                  <div style={{ width: 84, flexShrink: 0 }}>
                    <Poster title={row.title.title} year={row.title.year} category={row.title.category} flat />
                  </div>
                )}
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span className="eyebrow eyebrow--plain">Rank {String(index + 1).padStart(2, '0')}</span>
                  <strong style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', lineHeight: 1.1 }}>
                    {row.title?.title}
                  </strong>
                  <span className="mono faint" style={{ fontSize: 9 }}>
                    {row.title?.year} · {row.title?.country}
                  </span>
                  <div className="big-number" style={{ fontSize: 30, marginTop: 'auto' }}>
                    {row.overall.toFixed(1)}
                    <span>craft</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="section">
            <div className="row row--between row--wrap" style={{ marginBottom: 10 }}>
              <h2 className="section-title">Every scored title</h2>
              <div className="filter-row">
                <span className="mono faint" style={{ fontSize: 9 }}>sort by</span>
                <button className={cx('chip', sort === 'overall' && 'is-active')} onClick={() => setSort('overall')}>
                  overall
                </button>
                {AXES.map(([key, label]) => (
                  <button key={key} className={cx('chip', sort === key && 'is-active')} onClick={() => setSort(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    <th>Title</th>
                    <th className="num">Overall</th>
                    {AXES.map(([key, label]) => (
                      <th className="num" key={key}>{label}</th>
                    ))}
                    <th className="num">Verdict</th>
                    <th>Spoiler</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rating.id}>
                      <td>
                        {row.title && <MiniPoster title={row.title.title} category={row.title.category} />}
                      </td>
                      <td>
                        <button onClick={() => row.title && navigate('title', row.title.id)}>
                          <strong>{row.title?.title}</strong>
                        </button>
                        <div className="faint mono" style={{ fontSize: 8.5 }}>
                          {row.title?.genre}
                        </div>
                      </td>
                      <td className="num" style={{ color: 'var(--accent)', fontWeight: 600 }}>{row.overall.toFixed(1)}</td>
                      {AXES.map(([key]) => (
                        <td className="num" key={key}>{row.rating[key] as number}</td>
                      ))}
                      <td className="num">{row.title?.rating || '—'}</td>
                      <td>{row.rating.spoiler ? <Chip sm mono tone="hate">spoiler</Chip> : <span className="faint">—</span>}</td>
                      <td>
                        <button className="icon-btn icon-btn--sm" onClick={() => row.title && navigate('title', row.title.id)}>
                          <ArrowUpRight size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="cols-2" style={{ marginTop: 'var(--sp-5)' }}>
            <div className="card card--pad">
              <div className="panel-title">The disagreement</div>
              <p className="faint" style={{ fontSize: 10, lineHeight: 1.6, marginBottom: 10 }}>
                Lowest craft scores on the shelf. Not the worst films — the ones that ask the most of their own
                execution.
              </p>
              {weak.map((row) => (
                <div className="mini-row" key={row.rating.id}>
                  {row.title && <MiniPoster title={row.title.title} category={row.title.category} />}
                  <button className="mini-row__title" onClick={() => row.title && navigate('title', row.title.id)}>
                    {row.title?.title}
                  </button>
                  <span className="mono" style={{ color: 'var(--danger)' }}>{row.overall.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <div className="card card--pad">
              <div className="panel-title">Verdict vs craft</div>
              <div className="stack stack--tight">
                {rows.slice(0, 6).map((row) => {
                  const gap = Math.abs((row.title?.rating || 0) - row.overall);
                  return (
                    <div className="mini-row" key={row.rating.id}>
                      <span className="mono faint" style={{ fontSize: 9, width: 26 }}>{row.title?.rating}</span>
                      <span className="mini-row__title">{row.title?.title}</span>
                      <span className="meter" style={{ width: 90, height: 3 }}>
                        <span className="meter__fill" style={{ display: 'block', width: `${gap * 10}%` }} />
                      </span>
                      <span className="mono" style={{ fontSize: 9, color: gap > 2 ? 'var(--warning)' : 'var(--text-4)' }}>
                        {gap.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : tab === 'distribution' ? (
        <div className="split">
          <div className="card card--pad">
            <div className="panel-title">Score distribution</div>
            <Bars data={distribution} height={220} />
            <p className="faint" style={{ fontSize: 10, marginTop: 10 }}>
              {n(distribution.reduce((total, item) => total + item.value, 0))} titles scored on the verdict axis. The
              shape of this bar chart is the shape of your generosity.
            </p>
          </div>
          <div className="stack">
            <div className="card card--pad">
              <div className="panel-title">Craft averages</div>
              <div className="axis-list">
                {axes.map((axis) => (
                  <div className="axis-row" key={axis.label}>
                    <span>{axis.label}</span>
                    <span className="axis-bar">
                      <span style={{ width: `${axis.value * 10}%` }} />
                    </span>
                    <b>{axis.value.toFixed(1)}</b>
                  </div>
                ))}
              </div>
            </div>
            <div className="card card--pad">
              <div className="panel-title">Verdict trend</div>
              <Sparkline
                values={[...rows].reverse().map((row) => row.title?.rating || 0)}
                height={70}
              />
              <p className="faint" style={{ fontSize: 10, marginTop: 8 }}>
                Verdicts in leaderboard order. A flat line means a stable eye.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="poster-grid">
          {rows.map((row) => {
            const values = AXES.map(([key]) => row.rating[key] as number);
            return (
              <div className="card card--pad" key={row.rating.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => row.title && navigate('title', row.title.id)} style={{ textAlign: 'left' }}>
                  <strong style={{ fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-display)' }}>{row.title?.title}</strong>
                  <div className="mono faint" style={{ fontSize: 8.5 }}>{row.title?.year}</div>
                </button>
                <div style={{ display: 'flex', gap: 3, height: 46, alignItems: 'flex-end' }}>
                  {values.map((value, index) => (
                    <div key={index} title={`${AXES[index][1]}: ${value}`} style={{ flex: 1 }}>
                      <div
                        style={{
                          height: `${Math.max(4, value * 4)}px`,
                          background: index === 0 ? 'var(--accent)' : 'var(--border-3)',
                          borderRadius: '2px 2px 0 0',
                        }}
                      />
                      <div className="mono faint" style={{ fontSize: 7, textAlign: 'center', marginTop: 2 }}>
                        {AXES[index][1].slice(0, 3)}
                      </div>
                    </div>
                  ))}
                </div>
                <span className="mono" style={{ fontSize: 9, color: 'var(--accent)' }}>{row.overall.toFixed(1)} overall</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
