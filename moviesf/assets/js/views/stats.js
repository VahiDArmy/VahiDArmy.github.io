/* ============================================================================
   FULL METAL CINEMA — statistics
   every number derived from your rows; no analytics, no tracking
   ========================================================================== */

import { h, fmtNum, fmtDec, fmtDur, avg, sortBy, posterEl } from '../lib/dom.js';
import { state, rows, computeStats, affinity } from '../lib/store.js';
import { navigate } from './shared.js';
import {
  barChart, hBarChart, lineChart, donutChart, radarChart, heatGrid,
  stackedColumns, progressRing, sparkline,
} from '../lib/charts.js';
import { CATEGORIES } from '../config.js';

const PALETTE = ['var(--accent)', '#ff5f7e', '#58d98a', '#7fe3ff', '#ffb03a', '#c08cff', '#ff7a45', '#9aa88a'];

export function renderStats(root) {
  const titles = rows('titles');
  const s = computeStats(titles);
  const ratings = rows('ratings');

  if (!titles.length) {
    root.appendChild(h('div', { class: 'viewhead' }, h('div', {}, h('h1', {}, 'Statistics'))));
    root.appendChild(h('div', { class: 'empty' },
      h('div', { class: 'empty__glyph' }, '▥'),
      h('h3', {}, 'No data, no drill'),
      h('p', {}, 'Statistics are computed from your own shelf. Log a few titles and this page becomes the most honest mirror you own.'),
      h('button', { class: 'btn btn--primary', onClick: () => navigate('#/library') }, 'Go to library'),
    ));
    return;
  }

  root.appendChild(h('div', { class: 'viewhead' },
    h('div', { class: 'sect__num' }, '04'),
    h('div', {},
      h('h1', {}, 'Statistics'),
      h('div', { class: 'viewhead__sub' }, `${fmtNum(s.total)} dossiers · ${fmtNum(s.ratings || s.rated)} scored · ${s.yearsSpan} release span`),
    ),
    h('div', { class: 'viewhead__tools' },
      h('button', { class: 'btn btn--ghost btn--sm', onClick: () => window.print() }, '⎙ Print'),
      h('button', { class: 'btn btn--ghost btn--sm', onClick: () => navigate('#/library') }, 'Library'),
    ),
  ));

  /* ---------- headline numbers ---------- */
  const grid = h('div', { class: 'statgrid' });
  const stat = (label, value, small = '', delta = '', cls = '') => h('div', { class: `stat ${cls}` },
    h('div', { class: 'stat__label' }, label),
    h('div', { class: 'stat__value' }, String(value), small ? h('small', {}, small) : null),
    delta ? h('div', { class: 'stat__delta' }, delta) : null,
  );

  grid.appendChild(stat('Dossiers', fmtNum(s.total), '', `${fmtNum(s.thisYear)} logged this year`, 'stat--accent'));
  grid.appendChild(stat('Average score', fmtDec(s.avgRating, 2), '/10', `median ${fmtDec(s.medianRating, 1)}`));
  grid.appendChild(stat('Time on screen', fmtNum(s.hours), 'h', `${fmtNum(s.minutes)} minutes`));
  grid.appendChild(stat('Loved', fmtNum(s.loved), '', `${Math.round(s.favorRatio * 100)}% of the shelf`));
  grid.appendChild(stat('Regretted', fmtNum(s.hated), '', `${Math.round(s.hateRatio * 100)}% of the shelf`));
  grid.appendChild(stat('Perfect 9.5+', fmtNum(s.perfect), '', 'defended without caveats'));
  grid.appendChild(stat('Countries', fmtNum(s.countries), '', `${fmtNum(s.genres)} distinct genres`));
  grid.appendChild(stat('Streak', fmtNum(s.streak), 'd', s.streak ? 'consecutive days with a log' : 'no active streak'));
  root.appendChild(grid);

  /* ---------- charts ---------- */
  const cg = h('div', { class: 'chartgrid' });

  /* verdict split */
  const catData = [
    { label: 'Love', value: s.loved, color: '#ff5f7e' },
    { label: 'Good', value: s.good, color: '#58d98a' },
    { label: 'Hate', value: s.hated, color: '#ff7a45' },
  ].filter((d) => d.value > 0);
  cg.appendChild(panel('Verdict split', 'span-4',
    h('div', { style: { display: 'grid', placeItems: 'center' } },
      donutChart(catData, { size: 190, thickness: 30, centerValue: String(s.total), centerLabel: 'Dossiers' })),
    h('div', { class: 'legend' }, catData.map((d) => h('div', { class: 'legend__item' },
      h('span', { class: 'legend__swatch', style: { background: d.color } }),
      `${d.label} ${d.value}`,
    ))),
  ));

  /* score histogram */
  cg.appendChild(panel('Score distribution', 'span-8',
    barChart(s.scores.map((n, i) => ({ label: String(i + 1), value: n })), { height: 190, showValues: true }),
    h('div', { class: 'mono dim', style: { fontSize: '9.5px', marginTop: '6px', letterSpacing: '.1em' } },
      'A pile at 8–9 means you pre-filter before watching. A flat line means you watch everything.'),
  ));

  /* genre ranking */
  cg.appendChild(panel('Genre ranking', 'span-4',
    hBarChart(s.genreList.map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] })), { width: 360 }),
  ));

  /* country */
  cg.appendChild(panel('Where it comes from', 'span-4',
    hBarChart(s.countryList.slice(0, 10).map(([label, value], i) => ({ label, value, color: PALETTE[(i + 2) % PALETTE.length] })), { width: 360 }),
  ));

  /* type */
  cg.appendChild(panel('Format mix', 'span-4',
    donutChart(s.typeList.map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] })), {
      size: 170, thickness: 24, centerValue: String(s.typeList.length), centerLabel: 'formats',
    }),
    h('div', { class: 'legend' }, s.typeList.slice(0, 6).map(([label, value], i) => h('div', { class: 'legend__item' },
      h('span', { class: 'legend__swatch', style: { background: PALETTE[i % PALETTE.length] } }),
      `${label} ${value}`,
    ))),
  ));

  /* watch activity over years */
  cg.appendChild(panel('Logging rate by year', 'span-8',
    s.years.length
      ? lineChart(s.years.map((y) => ({ label: y.year, value: y.n })), { height: 180 })
      : h('div', { class: 'muted' }, 'No watched dates recorded.'),
    h('div', { class: 'row', style: { gap: '16px', marginTop: '8px' } },
      sparkline(s.months, { width: 140, height: 24 }),
      h('span', { class: 'mono dim', style: { fontSize: '9.5px' } }, 'monthly shape over the current shelf'),
    ),
  ));

  /* months */
  cg.appendChild(panel('Month of the year', 'span-4',
    barChart(s.months.map((n, i) => ({ label: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i], value: n })), {
      height: 170, width: 340, showValues: false,
    }),
    h('div', { class: 'mono dim', style: { fontSize: '9.5px', marginTop: '4px' } }, 'when the year turns into a season of watching'),
  ));

  /* radar of your taste */
  const radarVals = [
    { label: 'Love', value: s.favorRatio * 10 },
    { label: 'Spread', value: Math.min(10, s.genres * 0.8) },
    { label: 'World', value: Math.min(10, s.countries * 0.9) },
    { label: 'Score', value: s.avgRating },
    { label: 'Volume', value: Math.min(10, s.total / 5) },
    { label: 'Series', value: Math.min(10, (s.series / (s.total || 1)) * 20) },
  ];
  cg.appendChild(panel('Taste shape', 'span-4',
    h('div', { style: { display: 'grid', placeItems: 'center' } }, radarChart(radarVals, { size: 220 })),
    h('div', { class: 'mono dim', style: { fontSize: '9.4px', lineHeight: '1.6' } },
      'Six axes, no judgement. Love ratio, genre spread, countries, average score, archive volume, series share.'),
  ));

  /* release decade */
  cg.appendChild(panel('Release decades', 'span-8',
    s.decadesList.length
      ? stackedColumns(s.decadesList.map(([decade, n]) => ({
        label: decade,
        segments: [{ name: 'titles', value: n, color: 'var(--accent)' }],
      })), { height: 190 })
      : h('div', { class: 'muted' }, 'No release years recorded.'),
  ));

  /* heat calendar */
  const heatPanel = panel('Watch calendar — last 52 weeks', 'span-12',
    heatGrid(s.heat),
    h('div', { class: 'legend' },
      h('div', { class: 'legend__item' }, h('span', { class: 'legend__swatch', style: { background: 'var(--bg-4)' } }), 'none'),
      h('div', { class: 'legend__item' }, h('span', { class: 'legend__swatch', style: { background: 'var(--accent)' } }), '4+'),
      h('div', { class: 'legend__item', style: { marginLeft: 'auto' } }, `${fmtNum(s.heat.filter((c) => c.n).length)} active days`),
    ),
  );
  cg.appendChild(heatPanel);

  /* scores vs criteria */
  const criteriaAvg = ['story', 'acting', 'direction', 'visuals', 'sound', 'rewatch'].map((k) => ({
    label: k,
    value: avg(ratings, (r) => r[k]) || 0,
  }));
  if (ratings.length) {
    cg.appendChild(panel('Criteria averages', 'span-4',
      h('div', { class: 'col', style: { gap: '8px' } },
        criteriaAvg.map((c) => h('div', {},
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },
            h('span', { class: 'mono dim', style: { fontSize: '9.5px', letterSpacing: '.16em', textTransform: 'uppercase' } }, c.label),
            h('span', { class: 'mono' }, fmtDec(c.value, 1)),
          ),
          h('div', { class: 'meter' }, h('i', { style: { width: `${(c.value / 10) * 100}%` } })),
        )),
      ),
      h('div', { class: 'mono dim', style: { fontSize: '9.5px', marginTop: '10px' } }, `${ratings.length} scored dossiers`),
    ));
  }

  /* taste drift */
  if (s.evolution.length > 1) {
    cg.appendChild(panel('Score by release decade — taste drift', 'span-8',
      lineChart(s.evolution.map((e) => ({ label: e.decade, value: Number(fmtDec(e.avg, 1)) })), {
        height: 180, yMin: Math.max(0, Math.min(...s.evolution.map((e) => e.avg)) - 1),
      }),
      h('div', { class: 'mono dim', style: { fontSize: '9.5px', marginTop: '4px' } },
        'Where the line rises, your patience for that era is paying off.'),
    ));
  }

  root.appendChild(cg);

  /* ---------- leaders ---------- */
  const split = h('div', { class: 'split2' });
  split.appendChild(panel('Highest scored', '',
    rankList(s.topRated, (t) => fmtDec(t.rating, 1)),
  ));
  split.appendChild(panel('Lowest scored', '',
    rankList(s.worst, (t) => fmtDec(t.rating, 1)),
  ));
  root.appendChild(h('div', { style: { height: '16px' } }));
  root.appendChild(split);

  const split2 = h('div', { class: 'split2' });
  split2.appendChild(panel('Longest commitments', '',
    rankList(s.longest, (t) => t.episodes ? `${t.episodes} ep` : fmtDur(t.runtime || 100)),
  ));
  split2.appendChild(panel('Tags in use', '',
    h('div', { class: 'pillrow' },
      s.tagList.length
        ? s.tagList.map(([tag, n]) => h('button', {
          class: 'chip', onClick: () => navigate(`#/library?q=${encodeURIComponent(tag)}`),
        }, `#${tag} `, h('b', {}, String(n))))
        : h('span', { class: 'muted' }, 'no tags yet'),
    ),
  ));
  root.appendChild(h('div', { style: { height: '16px' } }));
  root.appendChild(split2);

  /* ---------- campaign / goals ---------- */
  const goal = rows('goals').find((g) => Number(g.year) === new Date().getFullYear()) || rows('goals')[0];
  const target = goal ? Number(goal.target_titles) || state.prefs.tourTarget : state.prefs.tourTarget;
  const done = Number(goal?.progress) || s.thisYear;
  root.appendChild(h('div', { style: { height: '16px' } }));
  root.appendChild(h('div', { class: 'panel' },
    h('div', { class: 'panel__head' }, h('h2', {}, 'Campaign — this year'), h('div', { class: 'panel__tools' },
      h('span', { class: 'mono dim' }, goal ? `target ${target}` : 'local target'))),
    h('div', { class: 'panel__body' },
      h('div', { class: 'row', style: { gap: '24px', flexWrap: 'wrap' } },
        progressRing(done, target, { size: 104, stroke: 8, label: 'complete' }),
        h('div', { class: 'col', style: { gap: '6px', flex: '1 1 220px' } },
          h('div', { style: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '900', lineHeight: '.9' } },
            `${done} of ${target}`),
          h('div', { class: 'mono dim' }, `${Math.max(0, target - done)} to go · ${fmtDec((done / (target || 1)) * 100, 1)}%`),
          h('div', { class: 'meter meter--tall' }, h('i', { style: { width: `${Math.min(100, (done / (target || 1)) * 100)}%` } })),
          h('div', { class: 'mono dim', style: { fontSize: '9.5px' } }, 'Set the number in Settings › Campaign.'),
        ),
        h('div', { class: 'col', style: { gap: '4px' } },
          h('div', { class: 'mono dim', style: { fontSize: '9.5px', letterSpacing: '.16em' } }, 'PACE'),
          h('div', { class: 'mono' }, paceLine(done, target)),
        ),
      ),
    ),
  ));
}

function paceLine(done, target) {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const expected = (target / 365) * dayOfYear;
  const diff = done - expected;
  return `${diff >= 0 ? 'ahead' : 'behind'} by ${fmtDec(Math.abs(diff), 1)} titles`;
}

function panel(title, span, ...content) {
  return h('div', { class: `panel ${span || ''}` },
    h('div', { class: 'panel__head' }, h('h2', {}, title)),
    h('div', { class: 'panel__body' }, ...content.filter(Boolean)),
  );
}

function rankList(list, val) {
  if (!list.length) return h('div', { class: 'muted' }, 'Nothing scored yet.');
  const wrap = h('div', { class: 'ranklist' });
  const max = Math.max(...list.map((t) => Number(t.rating) || 0), 1);
  list.forEach((t, i) => {
    wrap.appendChild(h('div', { class: 'rank', onClick: () => navigate(`#/title/${t.id}`) },
      h('div', { class: 'rank__i' }, String(i + 1).padStart(2, '0')),
      h('div', {},
        h('div', { class: 'rank__name' }, t.title),
        h('div', { class: 'rank__bar' }, h('i', { style: { width: `${((Number(t.rating) || 0) / max) * 100}%` } })),
      ),
      h('div', { class: 'rank__val' }, val(t)),
    ));
  });
  return wrap;
}
