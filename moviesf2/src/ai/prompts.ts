/**
 * The cinema prompt book. Every AI feature in the app is declared here, so the
 * title screen, the prompt rack and the studio all send the same instructions.
 */

import type { AiAction, AiActionContext, DatabaseShape, Title } from '../types';
import { splitList } from '../lib/utils';
import { runtime, typeLabel } from '../lib/format';

export const CRITIC_SYSTEM =
  'You are the projectionist of Full Metal Cinema: a precise, unsentimental film critic with deep knowledge of world cinema. You reason about craft — camera, structure, performance, sound, editing — rather than plot. You never invent facts. When a fact is uncertain you say so plainly. You write in clean prose, no filler, no praise padding.';

export const JSON_SYSTEM =
  'You are a metadata engine for a personal cinema database. Answer with a single strict JSON object and nothing else. Never wrap it in commentary. Use null for values you genuinely do not know. Never invent a fact to fill a field.';

export function titleLine(title: Title): string {
  const bits = [
    title.title,
    title.original_title && title.original_title !== title.title ? `(${title.original_title})` : '',
    title.year ? String(title.year) : '',
    typeLabel(title.type),
    title.country,
    title.runtime ? runtime(title.runtime) : '',
  ].filter(Boolean);
  return bits.join(' · ');
}

export function serialiseTitle(title: Title, extras: AiActionContext): string {
  const rating = extras.ratings.find((item) => item.title_id === title.id);
  const sessions = extras.sessions.filter((item) => item.title_id === title.id);
  const credits = extras.credits.filter((item) => item.title_id === title.id);
  const people = credits
    .map((credit) => {
      const person = extras.people.find((entry) => entry.id === credit.person_id);
      return person ? `${person.name} (${credit.role}${credit.character ? ` as ${credit.character}` : ''})` : '';
    })
    .filter(Boolean);
  const quotes = extras.quotes.filter((item) => item.title_id === title.id);
  const lines = [
    `TITLE: ${titleLine(title)}`,
    `CATEGORY: ${title.category} · STATUS: ${title.status} · RATING: ${title.rating || 'unrated'}/10`,
    `GENRE: ${title.genre || 'unknown'} · TAGS: ${title.tags || 'none'}`,
    title.language ? `LANGUAGE: ${title.language}` : '',
    title.seasons ? `SERIES: ${title.seasons} seasons, ${title.episodes || '?'} episodes` : '',
    title.summary ? `SUMMARY: ${title.summary}` : '',
    title.reason ? `WHY ON SHELF: ${title.reason}` : '',
    title.notes ? `OPERATOR NOTES: ${title.notes}` : '',
    title.story_analysis ? `EXISTING ANALYSIS: ${title.story_analysis}` : '',
    rating
      ? `CRAFT SCORES: story ${rating.story}, acting ${rating.acting}, direction ${rating.direction}, visuals ${rating.visuals}, sound ${rating.sound}, rewatch ${rating.rewatch}`
      : '',
    rating?.review ? `EXISTING REVIEW: ${rating.review}` : '',
    people.length ? `CREDITS: ${people.join('; ')}` : '',
    quotes.length ? `SAVED QUOTES: ${quotes.map((quote) => `“${quote.text}”`).join(' ')}` : '',
    sessions.length
      ? `VIEWINGS: ${sessions.length} session(s), ${sessions.reduce((total, item) => total + item.minutes, 0)} minutes`
      : '',
  ];
  return lines.filter(Boolean).join('\n');
}

export function serialiseShelf(db: DatabaseShape, limit = 80): string {
  return db.cinema_titles
    .slice(0, limit)
    .map(
      (title) =>
        `- ${title.title} (${title.year || '?'}) [${title.category}/${title.status}] ${title.rating || '—'}/10 — ${title.genre}; tags: ${title.tags || '—'}`,
    )
    .join('\n');
}

export function serialiseContext(ctx: AiActionContext): string {
  const bits: string[] = [];
  if (ctx.focus) bits.push(serialiseTitle(ctx.focus, ctx));
  if (!ctx.focus) {
    bits.push(`SHELF (${ctx.titles.length} titles):`);
    bits.push(
      ctx.titles
        .map(
          (title) =>
            `- ${title.title} (${title.year || '?'}) [${title.category}/${title.status}] rating ${title.rating || '—'} · ${title.genre} · tags: ${title.tags || '—'}`,
        )
        .join('\n'),
    );
  }
  if (ctx.titles.length > 1) {
    bits.push(
      `COLLECTIONS: ${ctx.collections
        .map((collection) => `${collection.name} (${ctx.titles.filter((title) => title.category === 'love').length ? '' : ''}${collection.description})`)
        .join(' | ')}`,
    );
    bits.push(
      `WATCHLIST: ${ctx.watchlist
        .map((item) => ctx.titles.find((title) => title.id === item.title_id)?.title)
        .filter(Boolean)
        .join(', ') || 'empty'}`,
    );
  }
  return bits.filter(Boolean).join('\n\n');
}

function focusRequired(name: string) {
  return (ctx: AiActionContext): string => {
    if (!ctx.focus) {
      return `The operator did not select a title. Ask nothing and return a single JSON object: {"error":"no title selected"}.`;
    }
    return serialiseTitle(ctx.focus, ctx);
  };
}

export const AI_ACTIONS: AiAction[] = [
  {
    id: 'standardise',
    label: 'Standardise entry',
    hint: 'Fill original title, year, country, language, runtime and tags from what is actually known.',
    group: 'metadata',
    icon: 'scan-text',
    expectsJson: true,
    system: JSON_SYSTEM,
    user: (ctx) => `Normalise the metadata for this entry. Return JSON with exactly these keys:
{
  "title": string,
  "original_title": string|null,
  "year": number|null,
  "country": string,
  "language": string,
  "runtime": number|null,
  "seasons": number|null,
  "episodes": number|null,
  "genre": string,
  "tags": string,
  "summary": string,
  "confidence": "high"|"medium"|"low",
  "uncertain": string[]
}
Rules: tags is a comma-separated list of 4–7 lowercase tags. summary is one factual sentence under 30 words. If you are not certain of a fact, use null and list it in "uncertain". Never fabricate a runtime or episode count.

ENTRY:
${focusRequired('entry')(ctx)}`,
  },
  {
    id: 'analysis',
    label: 'Deep analysis',
    hint: 'A structural reading: form, turning points, the scene that carries the theme, one real weakness.',
    group: 'analysis',
    icon: 'microscope',
    expectsJson: false,
    system: CRITIC_SYSTEM,
    user: (ctx) => `Write a deep analysis of the title below as a critic writing for a serious film journal.

Structure with markdown headings:
## The formal gamble — what the film risks technically or structurally, and whether it pays.
## The turn — the exact moment the film changes shape, and why it lands there.
## The carrying scene — one scene that holds the whole thesis, read closely.
## The cost — what the film gives up to achieve its effect.
## One weakness — a real, specific failure, not a hedge.

400–550 words. No plot synopsis. No rating. Second person is fine when it clarifies. Underline one line per section that a reader could quote.

TITLE:
${focusRequired('title')(ctx)}`,
  },
  {
    id: 'review',
    label: 'Draft a review',
    hint: 'Three paragraphs, no score, no synopsis. Written in the operator’s voice.',
    group: 'writing',
    icon: 'pen-line',
    expectsJson: false,
    system: CRITIC_SYSTEM,
    user: (ctx) => `Draft a review of the title below.

Voice: first person, dry, precise, no marketing adjectives. The operator's own verdict is already on the shelf — respect it but earn it.
Three paragraphs:
1. The central formal choice and what it produces.
2. The emotional cost or pleasure, concretely.
3. Who should see it, who should not, and one sentence a reader will remember.
No star rating. No plot summary beyond a single clause if unavoidable. 260–340 words.

TITLE:
${focusRequired('title')(ctx)}`,
  },
  {
    id: 'tags',
    label: 'Suggest tags',
    hint: 'Six precise tags that would actually help you find this film again.',
    group: 'metadata',
    icon: 'tags',
    expectsJson: true,
    system: JSON_SYSTEM,
    user: (ctx) => `Suggest retrieval tags for this title. Tags must be lowercase, one to three words, and useful for search — not mood poetry.
Return JSON: {"tags":[{"tag":"...","why":"..."}],"avoid":["..."]}
Six tags maximum. "avoid" lists up to three obvious tags that would be too generic.

TITLE:
${focusRequired('title')(ctx)}`,
  },
  {
    id: 'quotes',
    label: 'Excavate quotes',
    hint: 'Quotable lines, marked with confidence. Refuses to fabricate.',
    group: 'writing',
    icon: 'quote',
    expectsJson: true,
    system: JSON_SYSTEM,
    user: (ctx) => `List up to four lines from this title that survive outside it.
Return JSON: {"quotes":[{"text":"...","speaker":"...","at_minute":number|null,"confidence":"high"|"medium"|"low"}]}
If you cannot recall a line with high confidence, return fewer quotes and mark confidence honestly. Never fabricate dialogue. An empty array is an acceptable answer.

TITLE:
${focusRequired('title')(ctx)}`,
  },
  {
    id: 'trivia',
    label: 'Production notes',
    hint: 'Facts about how it was made, with provenance and uncertainty.',
    group: 'metadata',
    icon: 'sparkles',
    expectsJson: true,
    system: JSON_SYSTEM,
    user: (ctx) => `Give production facts about this title that a serious viewer would want.
Return JSON: {"trivia":[{"content":"...","source":"...","confidence":"high"|"medium"|"low"}]}
Three facts maximum. Each under 40 words. Source is a publication, interview collection or archive — or "unverified". Never invent a source.

TITLE:
${focusRequired('title')(ctx)}`,
  },
  {
    id: 'relationships',
    label: 'Find relations',
    hint: 'Connect this title to others already on the shelf, with a typed edge.',
    group: 'curation',
    icon: 'git-branch',
    expectsJson: true,
    system: JSON_SYSTEM,
    user: (ctx) => `Connect the focus title to other titles on this shelf.
Allowed kinds: ${['spiritual-twin', 'same-hand', 'same-director', 'slow-cinema', 'dream-logic', 'identity-collapse', 'courtroom-mirror', 'road-to-nowhere', 'remake', 'rebuttal', 'prequel'].join(', ')}.
Return JSON: {"relations":[{"title_id":"...","title":"...","kind":"...","weight":0.0-1.0,"why":"..."}]}
Only use titles that appear in SHELF. Three relations maximum. Weight expresses how strong the connection is, not preference.

${serialiseContext(ctx)}`,
  },
  {
    id: 'taste',
    label: 'Taste autopsy',
    hint: 'Three convictions, two blind spots, one contradiction — with evidence.',
    group: 'analysis',
    icon: 'fingerprint',
    expectsJson: false,
    system: CRITIC_SYSTEM,
    user: (ctx) => `Read this shelf and describe the operator's taste as a critic would, without flattery.

Sections:
## Three convictions — what the shelf consistently believes about cinema. Cite exact titles.
## Two blind spots — what the pattern excludes, and one film that would test it.
## One contradiction — two titles that should not coexist on the same shelf, and what that reveals.
## The sentence — one line that captures this taste.

350–450 words. Evidence over adjectives. Do not recommend more than one film in total.

${serialiseContext(ctx)}`,
  },
  {
    id: 'recommend',
    label: 'One recommendation',
    hint: 'A single film, argued from craft, not vibes.',
    group: 'curation',
    icon: 'wand-sparkles',
    expectsJson: false,
    system: CRITIC_SYSTEM,
    user: (ctx) => `Recommend exactly one film this operator has not logged.

Rules:
- Choose from your own knowledge, not from the shelf.
- Justify with craft: camera behaviour, structure, performance register, sound.
- Connect it to at least two specific titles on the shelf.
- Name one reason it might fail for them.
- 180–240 words. No list. No hedging.

${serialiseContext(ctx)}`,
  },
  {
    id: 'curate',
    label: 'Curate a collection',
    hint: 'A named shelf with a thesis and five picks from the library.',
    group: 'curation',
    icon: 'layers',
    expectsJson: true,
    system: JSON_SYSTEM,
    user: (ctx) => `Design one collection from the titles on this shelf.
Return JSON: {"name":"...","description":"...","color":"#rrggbb","icon":"one glyph","thesis":"...","items":[{"title_id":"...","note":"..."}]}
Five to seven items, all drawn from the shelf. The description is one sentence. The thesis is one sentence a reader could disagree with.

${serialiseContext(ctx)}`,
  },
  {
    id: 'watchlist',
    label: 'Triage watchlist',
    hint: 'Cut the queue to five, with a reason for each cut and keep.',
    group: 'curation',
    icon: 'list-filter',
    expectsJson: true,
    system: JSON_SYSTEM,
    user: (ctx) => `Triage the watchlist.
Return JSON: {"keep":[{"title":"...","reason":"..."}],"cut":[{"title":"...","reason":"..."}],"order":["..."]}
Keep five, cut the rest. Reasons are one sentence, specific to craft or context, never "you might like it".

${serialiseContext(ctx)}`,
  },
  {
    id: 'challenge',
    label: 'Forge a challenge',
    hint: 'A constraint worth keeping, with a rule object the app can track.',
    group: 'curation',
    icon: 'flag',
    expectsJson: true,
    system: JSON_SYSTEM,
    user: (ctx) => `Invent one viewing challenge that this shelf would actually stretch.
Return JSON: {"name":"...","description":"...","rule":{"minRuntime":number|null,"country":"...","yearFrom":number|null,"yearTo":number|null,"genre":"...","target":number},"target":number,"why":"..."}
The rule must be checkable against title metadata. Do not propose anything requiring streaming availability.

${serialiseContext(ctx)}`,
  },
  {
    id: 'pitch',
    label: 'Sell it in 40 words',
    hint: 'The shortest honest pitch you could put on a share page.',
    group: 'writing',
    icon: 'megaphone',
    expectsJson: false,
    system: CRITIC_SYSTEM,
    user: (ctx) => `Write a 40-word pitch for this title for a private share page. No clichés ("tour de force", "must-see", "breathtaking"). One sentence of form, one of feeling. Do not spoil anything past the first act.

TITLE:
${focusRequired('title')(ctx)}`,
  },
  {
    id: 'translation',
    label: 'Persian copy',
    hint: 'A natural Persian blurb plus a literal back-translation for checking.',
    group: 'writing',
    icon: 'languages',
    expectsJson: false,
    system:
      'You are a bilingual film critic writing in Persian (فارسی) and English. Your Persian is contemporary and literary, never machine-literal.',
    user: (ctx) => `Write a Persian blurb (۳ تا ۴ جمله) for this title, then an honest literal English back-translation so the operator can check meaning.
Format:
### فارسی
...
### Back-translation
...
### One note on the translation
...

TITLE:
${focusRequired('title')(ctx)}`,
  },
  {
    id: 'order',
    label: 'Viewing order',
    hint: 'The right order to watch this director’s shelf, with a reason.',
    group: 'curation',
    icon: 'arrow-down-up',
    expectsJson: true,
    system: JSON_SYSTEM,
    user: (ctx) => `Given the shelf, propose a viewing order for the films of the focus title's director (or closest authored cluster).
Return JSON: {"director":"...","order":[{"title":"...","reason":"..."}],"skip":"..."}
Only use titles on the shelf. Three to seven entries.

${serialiseContext(ctx)}`,
  },
  {
    id: 'compare',
    label: 'Duel two titles',
    hint: 'A craft comparison that picks a winner on one specific axis.',
    group: 'analysis',
    icon: 'swords',
    expectsJson: false,
    system: CRITIC_SYSTEM,
    user: (ctx) => {
      const [a, b] = ctx.titles.slice(0, 2);
      return `Compare ${a?.title || 'the first title'} and ${b?.title || 'the second title'} on one axis only: how each film handles the passage of time.
Sections: ## The two clocks · ## Where one is braver · ## The verdict (one sentence, decisive)
300 words maximum. Do not sit on the fence.

${a ? serialiseTitle(a, ctx) : ''}
${b ? serialiseTitle(b, ctx) : ''}`;
    },
  },
  {
    id: 'poster',
    label: 'Poster concept',
    hint: 'Art direction for a poster that is not the studio’s.',
    group: 'writing',
    icon: 'image',
    expectsJson: true,
    system: JSON_SYSTEM,
    user: (ctx) => `Art-direct an alternative poster.
Return JSON: {"concept":"...","palette":["#...","#...","#..."],"typography":"...","composition":"...","one_rule":"never do this..."}
No text on the poster beyond the title. The concept must be describable in two sentences.

TITLE:
${focusRequired('title')(ctx)}`,
  },
];

export function actionById(id: string): AiAction | undefined {
  return AI_ACTIONS.find((action) => action.id === id);
}

export const STARTER_PROMPTS: Array<{ label: string; body: string; group: string }> = [
  {
    label: 'What does my shelf believe about endings?',
    body: 'Read the shelf below and answer this: what does this collection believe about how films should end? Cite at least four titles as evidence, distinguish between earned and unearned endings, and end with one sentence I could put on the wall.',
    group: 'analysis',
  },
  {
    label: 'Where is my taste cowardly?',
    body: 'Look for the pattern this shelf is avoiding. Name one genre, country, decade or formal strategy that is almost entirely absent, and argue whether that is a limitation or a choice. Then name one film that would expose it. Be specific, not polite.',
    group: 'critique',
  },
  {
    label: 'Build me a rainy-Sunday triple bill',
    body: 'Build a three-film bill for a rainy Sunday from the titles on my shelf, in running order. For each: why it belongs in this sequence, and what the transition into the next film does. Total runtime under seven hours, including one film I have marked as hated.',
    group: 'curation',
  },
  {
    label: 'Diagnose my ratings',
    body: 'My ratings and my category labels sometimes disagree. Find the titles where the score and the verdict pull in different directions, explain the pattern, and tell me which of the two signals I should trust when recommending films to a friend.',
    group: 'analysis',
  },
  {
    label: 'Write the shelf’s liner notes',
    body: 'Write the liner notes for this collection as if it were a Criterion release. 400 words. No plot summaries, no biographies. An argument about what the shelf is doing, addressed to someone who has never met me.',
    group: 'writing',
  },
  {
    label: 'The one film I should rewatch',
    body: 'Choose one title from my shelf that deserves a second viewing, and one that I should never watch again. Argue both with craft evidence. Do not choose the highest rated film.',
    group: 'curation',
  },
];

export function applyTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

export function templateVariables(body: string): string[] {
  return Array.from(new Set(Array.from(body.matchAll(/\{\{(\w+)\}\}/g)).map((match) => match[1])));
}

export function shelfTags(titles: Title[]): string[] {
  return Array.from(new Set(titles.flatMap((title) => splitList(title.tags)))).sort();
}
