// Onboarding / quick start view — guided first-run experience.

import { el, clear } from '../utils/dom.js';
import { State, subscribe } from '../core/state.js';
import { navigate } from '../ui/router.js';
import { openZipPicker } from '../ui/zip-flow.js';
import { openHelpModal } from '../ui/help-modal.js';
import { copyToClipboard } from '../utils/dom.js';
import { toastOk } from '../ui/toast.js';
import { TEMPLATES } from '../core/templates.js';
import { ingest } from '../core/ingest.js';

const SAMPLE = [
  '{[[FILE: src/greeting.js]]}',
  'export function greet(name) {',
  '  return `hello, ${name}`;',
  '}',
  '{[[END: src/greeting.js]]}',
  '',
  '{[[FILE: README.md]]}',
  '# Hello project',
  '',
  'A tiny starter pack.',
  '{[[END: README.md]]}',
].join('\n');

const STEPS = [
  {
    id: 'paste',
    title: 'Paste your first block',
    body: 'Copy any message with FILE/END markers and press Ctrl+V anywhere on this page.',
  },
  {
    id: 'review',
    title: 'Review packed files',
    body: 'Open the Files view to inspect what landed, edit content inline, or filter by status.',
  },
  {
    id: 'download',
    title: 'Download the ZIP',
    body: 'One click builds a ZIP with every successfully parsed block. Open it in your editor.',
  },
  {
    id: 'unpack',
    title: 'Unpack when you need to',
    body: 'Drop any ZIP anywhere on the page to convert it back to pasteable text.',
  },
];

export function mountOnboarding(root) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  function render() {
    clear(shell);
    shell.appendChild(buildHero());
    shell.appendChild(buildSteps());
    shell.appendChild(buildSampleCard());
    shell.appendChild(buildTemplatesTeaser());
    shell.appendChild(buildFaq());
  }

  render();

  const unsub = subscribe((type) => {
    if (type === 'files' || type === 'ingest') render();
  });

  return () => unsub();
}

function buildHero() {
  const hero = el('div', {
    style: {
      position: 'relative',
      padding: '32px 28px 28px',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--line)',
      background: 'linear-gradient(160deg, color-mix(in srgb, var(--surface-2) 92%, transparent), color-mix(in srgb, var(--surface) 96%, transparent))',
      boxShadow: 'var(--shadow-1)',
      overflow: 'hidden',
      textAlign: 'center',
    },
  });

  hero.appendChild(el('div', {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: '52px',
      height: '52px',
      borderRadius: 'var(--r-md)',
      border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
      background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
      color: 'var(--accent)',
      fontSize: 'var(--fs-2xl)',
      fontWeight: '600',
      fontFamily: 'var(--font-display)',
      margin: '0 auto 16px',
      boxShadow: '0 0 24px -6px color-mix(in srgb, var(--accent) 60%, transparent)',
    },
    html: 'P',
  }));

  hero.appendChild(el('h1', {
    style: {
      fontSize: 'var(--fs-3xl)',
      fontWeight: '600',
      letterSpacing: '-0.025em',
      lineHeight: '1.15',
      marginBottom: '12px',
    },
    html: 'Welcome to <span style="color: var(--accent);">Project Packer</span>',
  }));

  hero.appendChild(el('p', {
    style: {
      color: 'var(--muted)',
      fontSize: 'var(--fs-sm)',
      lineHeight: '1.7',
      maxWidth: '580px',
      margin: '0 auto 24px',
    },
    text: 'One page that turns conversations into repositories. Paste any message with FILE/END blocks, and download a working project — or drop a ZIP to turn it back into text for your next chat.',
  }));

  const actions = el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' } });
  actions.appendChild(el('button', {
    class: 'btn btn-primary btn-lg',
    type: 'button',
    onClick: () => {
      ingest(SAMPLE, { source: 'sample' });
      toastOk('Sample pasted — explore the Files view');
      navigate('files');
    },
  }, ['Try a sample pack']));
  actions.appendChild(el('button', {
    class: 'btn btn-lg',
    type: 'button',
    onClick: () => openZipPicker(),
  }, ['Load a .zip']));
  actions.appendChild(el('button', {
    class: 'btn btn-ghost btn-lg',
    type: 'button',
    onClick: () => openHelpModal(),
  }, ['Read the format']));
  hero.appendChild(actions);

  return hero;
}

function buildSteps() {
  const wrap = el('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 'var(--sp-3)',
    },
  });
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const card = el('div', {
      style: {
        padding: '16px',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      },
    }, [
      el('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: 'var(--fs-2xs)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        },
      }, [
        el('span', {
          style: {
            display: 'inline-grid',
            placeItems: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)',
            background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            color: 'var(--accent)',
            fontSize: '10px',
            fontWeight: '600',
          },
          text: String(i + 1),
        }),
        el('span', { text: 'Step ' + (i + 1) }),
      ]),
      el('div', {
        style: { fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: '600', color: 'var(--ink)' },
        text: step.title,
      }),
      el('div', {
        style: { fontSize: 'var(--fs-sm)', color: 'var(--muted)', lineHeight: '1.6' },
        text: step.body,
      }),
    ]);
    wrap.appendChild(card);
  }
  return wrap;
}

function buildSampleCard() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot' }), el('span', { text: 'Copy this sample' })]),
    el('button', {
      class: 'btn btn-ghost btn-sm',
      type: 'button',
      onClick: async () => {
        const ok = await copyToClipboard(SAMPLE);
        if (ok) {
          toastOk('Sample copied — try pasting it');
          navigate('files');
        }
      },
      text: '⎘ Copy sample',
    }),
  ]));
  const body = el('div', { class: 'card-body' });
  body.appendChild(el('pre', { class: 'code-block', text: SAMPLE }));
  card.appendChild(body);
  return card;
}

function buildTemplatesTeaser() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-2)' } }), el('span', { text: 'Start from a template' })]),
    el('button', {
      class: 'btn btn-ghost btn-sm',
      type: 'button',
      onClick: () => navigate('templates'),
      text: 'Browse all →',
    }),
  ]));
  const body = el('div', { class: 'card-body', style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } });
  for (const tpl of TEMPLATES.slice(0, 4)) {
    body.appendChild(el('button', {
      class: 'btn btn-sm',
      type: 'button',
      onClick: () => navigate('templates'),
    }, [tpl.name + ' · ' + tpl.files.length + ' files']));
  }
  card.appendChild(body);
  return card;
}

function buildFaq() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-3)' } }), el('span', { text: 'Quick answers' })]),
  ]));
  const body = el('div', { class: 'card-body', style: { display: 'flex', flexDirection: 'column', gap: '14px' } });

  const items = [
    ['Does anything leave my browser?', 'No. Every byte stays local — packing, unpacking, all of it happens client-side.'],
    ['What if I paste the same file twice?', 'The last version wins. Identical content is marked "identical" and does not overwrite.'],
    ['What happens to truncated blocks?', 'They still get saved, but marked truncated. Use the Log view for the exact reason and Copy resend request to retry.'],
    ['Can I edit packed files?', 'Yes. Open the Editor view, change content, and Ctrl+S saves it back into the pack.'],
    ['How do I unpack a ZIP?', 'Drop any .zip anywhere on the page. The app reads all text files, ignores binary and noise, and downloads a pasteable .txt.'],
  ];

  for (const [q, a] of items) {
    body.appendChild(el('div', {
      style: {
        padding: '12px 14px',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-sm)',
        background: 'var(--surface-2)',
      },
    }, [
      el('div', { style: { fontSize: 'var(--fs-sm)', fontWeight: '600', color: 'var(--ink)', marginBottom: '4px' }, text: q }),
      el('div', { style: { fontSize: 'var(--fs-sm)', color: 'var(--muted)', lineHeight: '1.6' }, text: a }),
    ]));
  }
  card.appendChild(body);
  return card;
}
