/**
 * First-run seed. The app is local-first: this is the operator's shelf on day
 * one, complete with sessions, credits, quotes and an arena ledger so every
 * view has something honest to show before you add a single film.
 */

import type {
  Activity,
  AiModelRow,
  AiThread,
  Award,
  Challenge,
  CinemaEvent,
  Collection,
  CollectionItem,
  Conversation,
  Credit,
  DatabaseShape,
  Goal,
  ImportBatch,
  MetaRow,
  MizanNote,
  Person,
  PromptTemplate,
  Quote,
  Rating,
  Relationship,
  SavedView,
  Share,
  Title,
  Trivia,
  WatchSession,
  WatchlistItem,
  Category,
  MediaType,
} from '../types';
import { DEFAULT_PARAMS } from '../types';
import { dayKey } from '../lib/format';
import { joinList, nowIso, slugify, uid } from '../lib/utils';

const TODAY = new Date();
const MS_DAY = 86_400_000;

function daysAgo(days: number, hour = 21, minute = 30): string {
  const date = new Date(TODAY.getTime() - days * MS_DAY);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function daysAhead(days: number, hour = 20, minute = 0): string {
  const date = new Date(TODAY.getTime() + days * MS_DAY);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function dateOnly(days: number): string {
  return dayKey(new Date(TODAY.getTime() - days * MS_DAY));
}

const stamps = (days: number) => ({
  created_at: daysAgo(days, 12, 0),
  updated_at: daysAgo(Math.max(0, days - 2), 18, 0),
  user_id: null,
});

interface SeedTitle {
  id: string;
  title: string;
  original?: string;
  category: Category;
  type: MediaType;
  genre: string;
  tags: string;
  year: number;
  rating: number;
  favorite?: boolean;
  status: string;
  runtime?: number;
  country: string;
  language: string;
  summary: string;
  reason?: string;
  notes?: string;
  analysis?: string;
  seasons?: number;
  episodes?: number;
  per?: number;
  days: number;
  trailer?: string;
}

const TITLE_SEED: SeedTitle[] = [
  {
    id: 't-mood',
    title: 'In the Mood for Love',
    original: '花樣年華',
    category: 'love',
    type: 'film',
    genre: 'Romance, Drama',
    tags: 'hong kong, longing, colour, wong kar-wai, restraint',
    year: 2000,
    rating: 10,
    favorite: true,
    status: 'watched',
    runtime: 98,
    country: 'Hong Kong',
    language: 'Cantonese, Shanghainese',
    summary:
      'Two neighbours in 1962 Hong Kong discover their spouses are having an affair and rehearse a closeness they never allow themselves to consummate.',
    reason: 'The most precise film ever made about the space between two people.',
    notes: 'The corridor shots are a whole grammar. Watch the clock in the noodle-stall scene.',
    analysis:
      'Wong builds the entire film out of obstructions: doorframes, curtains, smoke, rain, mirrored surfaces. Desire is never shown, only its perimeter. The repeated cello theme does the work of memory — it returns slightly changed, the way recollection does.',
    days: 34,
  },
  {
    id: 't-stalker',
    title: 'Stalker',
    original: 'Сталкер',
    category: 'love',
    type: 'film',
    genre: 'Science fiction, Drama',
    tags: 'tarkovsky, slow cinema, faith, landscape, zone',
    year: 1979,
    rating: 10,
    favorite: true,
    status: 'watched',
    runtime: 162,
    country: 'Soviet Union',
    language: 'Russian',
    summary:
      'A guide leads two men through a forbidden Zone toward a room that is said to grant a person their deepest wish.',
    reason: 'A film that treats patience as a moral position.',
    notes: 'Third viewing. The sand scene finally made sense as a prayer.',
    analysis:
      'Tarkovsky separates desire from wish: the Zone only grants what you truly want, which is why the men refuse to enter. The sepia-to-colour transitions mark the difference between lived time and remembered time.',
    days: 210,
  },
  {
    id: 't-taste-cherry',
    title: 'Taste of Cherry',
    original: 'طعم گیلاس',
    category: 'love',
    type: 'film',
    genre: 'Drama',
    tags: 'kiarostami, iran, mortality, road movie, minimalism',
    year: 1997,
    rating: 9,
    favorite: false,
    status: 'watched',
    runtime: 95,
    country: 'Iran',
    language: 'Persian',
    summary:
      'A man drives through the outskirts of Tehran offering money to anyone who will bury him after he takes his own life.',
    reason: 'It argues for life without ever raising its voice.',
    notes: 'The taxidermist’s monologue about mulberries is the whole thesis.',
    analysis:
      'Kiarostami keeps the camera in the passenger seat, so the audience is another passenger who cannot intervene. The video epilogue breaks the frame deliberately: the film was a construction, and the world outside it is still going.',
    days: 156,
  },
  {
    id: 't-close-up',
    title: 'Close-Up',
    original: 'کلوزآپ',
    category: 'good',
    type: 'film',
    genre: 'Documentary, Drama',
    tags: 'iran, kiarostami, identity, trial, hybrid',
    year: 1990,
    rating: 9,
    status: 'watched',
    runtime: 98,
    country: 'Iran',
    language: 'Persian',
    summary:
      'A cinephile impersonates Mohsen Makhmalbaf and is put on trial, where Kiarostami films the real people playing themselves.',
    analysis:
      'The film’s ethics are in the edit: the accused is allowed to speak at length, and the camera’s sympathy is never separated from its judgement.',
    days: 300,
  },
  {
    id: 't-separation',
    title: 'A Separation',
    original: 'جدایی نادر از سیمین',
    category: 'love',
    type: 'film',
    genre: 'Drama',
    tags: 'iran, family, class, morality, farhadi',
    year: 2011,
    rating: 9,
    status: 'watched',
    runtime: 123,
    country: 'Iran',
    language: 'Persian',
    summary:
      'A marriage collapses while a domestic accident pulls two families into a legal conflict where everyone is both right and lying.',
    reason: 'The best screenplay of its decade.',
    days: 402,
  },
  {
    id: 't-blade',
    title: 'Blade Runner 2049',
    category: 'good',
    type: 'film',
    genre: 'Science fiction, Noir',
    tags: 'villeneuve, sequel, memory, deakins, neon',
    year: 2017,
    rating: 8,
    status: 'watched',
    runtime: 164,
    country: 'United States',
    language: 'English',
    summary:
      'A replicant blade runner uncovers a buried secret that could break the wall between manufactured and born life.',
    notes: 'The orange Vegas sequence is the best use of fog in modern cinema.',
    days: 88,
  },
  {
    id: 't-paris',
    title: 'Paris, Texas',
    category: 'love',
    type: 'film',
    genre: 'Drama, Road movie',
    tags: 'wenders, loneliness, americana, ry cooder, colour',
    year: 1984,
    rating: 9,
    favorite: true,
    status: 'watched',
    runtime: 145,
    country: 'West Germany, France',
    language: 'English',
    summary:
      'A mute man walks out of the desert and slowly rebuilds the road back to the son and wife he abandoned.',
    analysis:
      'The peep-show confession is a single take of two faces and a glass wall — cinema’s cleanest metaphor for the impossibility of full disclosure.',
    days: 500,
  },
  {
    id: 't-lighthouse',
    title: 'The Lighthouse',
    category: 'good',
    type: 'film',
    genre: 'Horror, Drama',
    tags: 'eggman, black and white, madness, nautical, pattinson',
    year: 2019,
    rating: 8,
    status: 'watched',
    runtime: 109,
    country: 'United States',
    language: 'English',
    summary:
      'Two lighthouse keepers on a remote New England island descend into drink, rivalry and hallucination.',
    notes: 'Aspect ratio 1.19:1 makes the room feel like a coffin.',
    days: 61,
  },
  {
    id: 't-portrait',
    title: 'Portrait of a Lady on Fire',
    original: 'Portrait de la jeune fille en feu',
    category: 'love',
    type: 'film',
    genre: 'Romance, Drama',
    tags: 'sciamma, gaze, brittany, painting, silence',
    year: 2019,
    rating: 10,
    favorite: true,
    status: 'watched',
    runtime: 122,
    country: 'France',
    language: 'French',
    summary:
      'On an isolated Breton island in 1770, a painter is hired to secretly paint a reluctant bride-to-be.',
    reason: 'A film about being looked at that never looks away.',
    analysis:
      'Sciamma replaces the male gaze with a reciprocal one: every shot is a contract between two people who agree to be seen. The final shot holds a face for two minutes and lets music do the remembering.',
    days: 19,
  },
  {
    id: 't-perfect-blue',
    title: 'Perfect Blue',
    original: 'パーフェクトブルー',
    category: 'good',
    type: 'animation',
    genre: 'Psychological thriller, Animation',
    tags: 'satoshi kon, identity, anime, horror, performance',
    year: 1997,
    rating: 9,
    status: 'watched',
    runtime: 81,
    country: 'Japan',
    language: 'Japanese',
    summary:
      'A pop idol turns actress and begins to lose the boundary between her role, her stalker and herself.',
    days: 120,
  },
  {
    id: 't-cure',
    title: 'Cure',
    original: 'CURE キュア',
    category: 'good',
    type: 'film',
    genre: 'Thriller, Horror',
    tags: 'kurosawa, hypnosis, japan, dread, procedural',
    year: 1997,
    rating: 9,
    status: 'watched',
    runtime: 111,
    country: 'Japan',
    language: 'Japanese',
    summary:
      'A detective tracking a series of motiveless murders discovers a hypnotist who teaches people to kill without remembering.',
    analysis:
      'Kurosawa shoots in long, quiet wide shots so violence happens at a distance, like something remembered rather than witnessed.',
    days: 144,
  },
  {
    id: 't-satantango',
    title: 'Sátántangó',
    category: 'hate',
    type: 'film',
    genre: 'Drama, Art film',
    tags: 'tarr, black and white, long take, rain, hungary',
    year: 1994,
    rating: 7,
    status: 'watched',
    runtime: 439,
    country: 'Hungary',
    language: 'Hungarian',
    summary:
      'A collective farm collapses while a messianic figure returns to claim the villagers’ money.',
    notes: 'Watched in three sittings. The opening herd shot is extraordinary; the middle hour is a test.',
    reason: 'Admire the form, resist the length.',
    days: 700,
  },
  {
    id: 't-chungking',
    title: 'Chungking Express',
    original: '重慶森林',
    category: 'love',
    type: 'film',
    genre: 'Romance, Comedy',
    tags: 'wong kar-wai, hong kong, neon, soundtrack, longing',
    year: 1994,
    rating: 9,
    status: 'watched',
    runtime: 102,
    country: 'Hong Kong',
    language: 'Cantonese',
    summary:
      'Two lovesick policemen drift through Hong Kong’s night markets and fast-food counters.',
    days: 240,
  },
  {
    id: 't-mulholland',
    title: 'Mulholland Drive',
    category: 'love',
    type: 'film',
    genre: 'Mystery, Drama',
    tags: 'lynch, dream logic, hollywood, identity, noir',
    year: 2001,
    rating: 10,
    favorite: true,
    status: 'watched',
    runtime: 147,
    country: 'United States',
    language: 'English',
    summary:
      'An aspiring actress arrives in Los Angeles and finds an amnesiac woman in her aunt’s apartment.',
    analysis:
      'The first two hours are a wish; the last twenty minutes are the bill. Everything before the blue box is what a dying imagination can still afford.',
    days: 365,
  },
  {
    id: 't-there-will',
    title: 'There Will Be Blood',
    category: 'good',
    type: 'film',
    genre: 'Drama, Western',
    tags: 'pta, capitalism, oil, greenwood, ambition',
    year: 2007,
    rating: 9,
    status: 'watched',
    runtime: 158,
    country: 'United States',
    language: 'English',
    summary:
      'A prospector builds an oil empire in California while a young preacher becomes his only real rival.',
    days: 280,
  },
  {
    id: 't-spirited',
    title: 'Spirited Away',
    original: '千と千尋の神隠し',
    category: 'love',
    type: 'animation',
    genre: 'Fantasy, Animation',
    tags: 'miyazaki, ghibli, childhood, bathhouse, japan',
    year: 2001,
    rating: 9,
    status: 'watched',
    runtime: 125,
    country: 'Japan',
    language: 'Japanese',
    summary:
      'A girl wanders into a spirit world and must work in a bathhouse to free her parents.',
    days: 800,
  },
  {
    id: 't-handmaiden',
    title: 'The Handmaiden',
    original: '아가씨',
    category: 'love',
    type: 'film',
    genre: 'Thriller, Romance',
    tags: 'park chan-wook, con, japan, korea, structure',
    year: 2016,
    rating: 9,
    status: 'watched',
    runtime: 145,
    country: 'South Korea',
    language: 'Korean, Japanese',
    summary:
      'A pickpocket is hired as a maid to a Japanese heiress as part of a con, and the con begins to turn.',
    notes: 'Three-part structure is a magic trick performed on the audience.',
    days: 95,
  },
  {
    id: 't-aftersun',
    title: 'Aftersun',
    category: 'love',
    type: 'film',
    genre: 'Drama',
    tags: 'wells, memory, fatherhood, camcorder, grief',
    year: 2022,
    rating: 9,
    status: 'watched',
    runtime: 101,
    country: 'United Kingdom, United States',
    language: 'English',
    summary:
      'A woman revisits camcorder footage of a holiday with her young father and begins to read what she could not see then.',
    reason: 'The last five minutes rewire the previous ninety.',
    analysis:
      'The film withholds the father’s depression until the daughter’s adult perspective supplies it. Memory is the editor.',
    days: 44,
  },
  {
    id: 't-past-lives',
    title: 'Past Lives',
    category: 'good',
    type: 'film',
    genre: 'Romance, Drama',
    tags: 'celine song, immigration, inyeon, new york, restraint',
    year: 2023,
    rating: 8,
    status: 'watched',
    runtime: 105,
    country: 'United States',
    language: 'English, Korean',
    summary:
      'Two childhood friends separated by emigration meet again in New York twenty-four years later.',
    days: 28,
  },
  {
    id: 't-zone',
    title: 'The Zone of Interest',
    category: 'hate',
    type: 'film',
    genre: 'Drama, History',
    tags: 'glazer, sound design, holocaust, banality, mica',
    year: 2023,
    rating: 9,
    status: 'watched',
    runtime: 105,
    country: 'United Kingdom, Poland',
    language: 'German, Polish',
    summary:
      'The commandant of Auschwitz and his family build an idyllic home beside the camp wall.',
    reason: 'A film I respect enormously and never want to watch again.',
    notes: 'The sound mix is the protagonist. The image is the alibi.',
    analysis:
      'Glazer refuses the shot you expect — the camera never crosses the wall. Evil is shown as administration: a garden, a pool, a promotion letter.',
    days: 72,
  },
  {
    id: 't-anatomy',
    title: 'Anatomy of a Fall',
    original: 'Anatomie d’une chute',
    category: 'good',
    type: 'film',
    genre: 'Drama, Courtroom',
    tags: 'huller, trial, ambiguity, language, france',
    year: 2023,
    rating: 8,
    status: 'watched',
    runtime: 151,
    country: 'France',
    language: 'French, English',
    summary:
      'A novelist stands trial for her husband’s death while their blind son is the only witness.',
    days: 51,
  },
  {
    id: 't-oldboy',
    title: 'Oldboy',
    original: '올드보이',
    category: 'good',
    type: 'film',
    genre: 'Thriller, Action',
    tags: 'park chan-wook, revenge, korea, twist, hallway',
    year: 2003,
    rating: 8,
    status: 'watched',
    runtime: 120,
    country: 'South Korea',
    language: 'Korean',
    summary:
      'A man imprisoned in a room for fifteen years is released and given five days to find out why.',
    days: 610,
  },
  {
    id: 't-werckmeister',
    title: 'Werckmeister Harmonies',
    original: 'Werckmeister harmóniák',
    category: 'love',
    type: 'film',
    genre: 'Drama, Art film',
    tags: 'tarr, black and white, slow, hungary, crowd',
    year: 2000,
    rating: 9,
    status: 'watched',
    runtime: 145,
    country: 'Hungary',
    language: 'Hungarian',
    summary:
      'A small Hungarian town unravels when a circus arrives with a stuffed whale and a mysterious prince.',
    days: 430,
  },
  {
    id: 't-bear',
    title: 'The Bear',
    category: 'love',
    type: 'series',
    genre: 'Drama, Comedy',
    tags: 'kitchen, grief, chicago, ensemble, anxiety',
    year: 2022,
    rating: 9,
    favorite: true,
    status: 'watching',
    seasons: 3,
    episodes: 28,
    per: 10,
    country: 'United States',
    language: 'English',
    summary:
      'A fine-dining chef returns to Chicago to run his late brother’s chaotic sandwich shop.',
    notes: 'Season 2 episode 6 is a short film that happens to live inside a series.',
    days: 11,
  },
  {
    id: 't-twin-peaks',
    title: 'Twin Peaks',
    category: 'love',
    type: 'series',
    genre: 'Mystery, Drama',
    tags: 'lynch, small town, surreal, soap, fbi',
    year: 1990,
    rating: 10,
    status: 'watched',
    seasons: 3,
    episodes: 48,
    per: 16,
    country: 'United States',
    language: 'English',
    summary:
      'An FBI agent investigates the murder of a homecoming queen in a town where the ordinary is a thin skin.',
    days: 900,
  },
  {
    id: 't-dark',
    title: 'Dark',
    category: 'good',
    type: 'series',
    genre: 'Science fiction, Mystery',
    tags: 'germany, time travel, family tree, netflix, determinism',
    year: 2017,
    rating: 8,
    status: 'abandoned',
    seasons: 3,
    episodes: 26,
    per: 9,
    country: 'Germany',
    language: 'German',
    summary:
      'Four families in a German town uncover a time-travel conspiracy spanning generations.',
    notes: 'Lost the thread in season 3. Might return with a family-tree printout.',
    reason: 'A maze that became a spreadsheet.',
    days: 320,
  },
  {
    id: 't-dune',
    title: 'Dune: Part Two',
    category: 'good',
    type: 'film',
    genre: 'Science fiction, Epic',
    tags: 'villeneuve, desert, scale, zimmer, prophecy',
    year: 2024,
    rating: 8,
    status: 'watched',
    runtime: 166,
    country: 'United States',
    language: 'English',
    summary:
      'Paul Atreides unites with the Fremen to take revenge, and becomes the thing he feared.',
    notes: 'See it in the largest room you can find. The sound is the spectacle.',
    days: 240,
  },
  {
    id: 't-poor-things',
    title: 'Poor Things',
    category: 'good',
    type: 'film',
    genre: 'Comedy, Fantasy',
    tags: 'lanthimos, emma stone, bella, colour',
    year: 2023,
    rating: 8,
    status: 'watched',
    runtime: 141,
    country: 'Ireland, United Kingdom',
    language: 'English',
    summary:
      'A resurrected woman travels the world in pursuit of pleasure and her own philosophy.',
    days: 190,
  },
  {
    id: 't-manaki',
    title: 'The Cow',
    original: 'گاو',
    category: 'good',
    type: 'film',
    genre: 'Drama',
    tags: 'iran, mehrjui, new wave, village, grief',
    year: 1969,
    rating: 8,
    status: 'watched',
    runtime: 100,
    country: 'Iran',
    language: 'Persian',
    summary:
      'A villager’s beloved cow dies and his neighbours try to hide the truth from him.',
    days: 520,
  },
  {
    id: 't-cyclist',
    title: 'The Cyclist',
    original: 'دوچرخه‌ران',
    category: 'hate',
    type: 'film',
    genre: 'Drama',
    tags: 'iran, makhmalbaf, endurance, allegory, 80s',
    year: 1987,
    rating: 5,
    status: 'watched',
    runtime: 82,
    country: 'Iran',
    language: 'Persian',
    summary:
      'An Afghan refugee rides a bicycle in circles for a week to win money for his sick wife.',
    notes: 'A great idea stretched thinner than it can carry.',
    reason: 'The allegory is stated so loudly the film disappears behind it.',
    days: 640,
  },
  {
    id: 't-lucy',
    title: 'Lucy',
    category: 'hate',
    type: 'film',
    genre: 'Science fiction, Action',
    tags: 'besson, percentage, action, silliness',
    year: 2014,
    rating: 3,
    status: 'watched',
    runtime: 89,
    country: 'France',
    language: 'English',
    summary:
      'A woman gains full control of her brain after a drug leaks into her system.',
    notes: 'The 10% myth, now with car chases.',
    reason: 'A premise that mistakes a poster for a screenplay.',
    days: 1200,
  },
  {
    id: 't-emilia',
    title: 'Emilia Pérez',
    category: 'hate',
    type: 'film',
    genre: 'Musical, Crime',
    tags: 'audiard, musical, mexico, opera, controversy',
    year: 2024,
    rating: 4,
    status: 'watched',
    runtime: 132,
    country: 'France',
    language: 'Spanish, English',
    summary:
      'A cartel boss transitions and recruits a lawyer to help build a foundation for victims.',
    notes: 'Bold, baffling, occasionally beautiful, mostly not.',
    reason: 'The songs arrive like interruptions rather than revelations.',
    days: 36,
  },
  {
    id: 't-arrival',
    title: 'Arrival',
    category: 'good',
    type: 'film',
    genre: 'Science fiction, Drama',
    tags: 'villeneuve, language, time, grief, heptapod',
    year: 2016,
    rating: 9,
    status: 'watched',
    runtime: 116,
    country: 'United States',
    language: 'English',
    summary:
      'A linguist is recruited to communicate with alien visitors and learns a language that rewires time.',
    analysis: 'A rare adaptation that improves on its source by trusting the reader with structure.',
    days: 340,
  },
  {
    id: 't-fallen',
    title: 'Fallen Leaves',
    original: 'Kuolleet lehdet',
    category: 'love',
    type: 'film',
    genre: 'Romance, Comedy',
    tags: 'kaurismaki, finland, deadpan, working class, hope',
    year: 2023,
    rating: 9,
    status: 'watched',
    runtime: 81,
    country: 'Finland',
    language: 'Finnish',
    summary:
      'Two lonely workers in Helsinki find each other in a city that seems designed to keep them apart.',
    reason: 'The most optimistic Kaurismäki: bleak, then quietly radiant.',
    days: 130,
  },
];

function buildTitles(): Title[] {
  return TITLE_SEED.map((seed, index) => ({
    id: seed.id,
    legacy_id: 1000 + index,
    title: seed.title,
    original_title: seed.original || '',
    category: seed.category,
    type: seed.type,
    genre: seed.genre,
    tags: seed.tags,
    year: seed.year,
    rating: seed.rating,
    favorite: Boolean(seed.favorite),
    notes: seed.notes || '',
    watched_date: dateOnly(seed.days),
    summary: seed.summary,
    seasons: seed.seasons ?? null,
    episodes: seed.episodes ?? null,
    episodes_per_season: seed.per ?? null,
    country: seed.country,
    language: seed.language,
    status: seed.status,
    reason: seed.reason || '',
    story_analysis: seed.analysis || '',
    ai_standardized_at: index % 3 === 0 ? daysAgo(seed.days, 9, 0) : null,
    source: index % 5 === 0 ? 'import' : 'manual',
    poster_url: '',
    backdrop_url: '',
    trailer_url: seed.trailer || '',
    runtime: seed.runtime ?? null,
    ...stamps(seed.days + 6),
  }));
}

function buildRatings(titles: Title[]): Rating[] {
  const axes: Array<[number, number, number, number, number, number]> = [
    [10, 9, 10, 10, 9, 9],
    [9, 8, 10, 10, 9, 7],
    [8, 8, 9, 9, 8, 7],
    [7, 7, 8, 7, 7, 6],
    [9, 9, 9, 8, 9, 8],
    [6, 5, 6, 7, 6, 5],
  ];
  return titles.slice(0, 24).map((title, index) => {
    const axis = axes[index % axes.length];
    const isHate = title.category === 'hate';
    const base: [number, number, number, number, number, number] = isHate
      ? [4, 4, 5, 6, 5, 3]
      : axis;
    return {
      id: `r-${title.id}`,
      title_id: title.id,
      story: base[0],
      acting: base[1],
      direction: base[2],
      visuals: base[3],
      sound: base[4],
      rewatch: base[5],
      review:
        title.category === 'love'
          ? `${title.title} is one of the reasons this shelf exists. ${title.reason || 'The craft is inseparable from the feeling.'}`
          : title.category === 'hate'
            ? `${title.title} did not work for me. ${title.reason || 'Craft without conviction.'}`
            : `${title.title} is a solid piece of work. ${title.reason || 'Recommended with reservations.'}`,
      spoiler: false,
      ...stamps(index * 3 + 10),
    };
  });
}

function buildSessions(titles: Title[]): WatchSession[] {
  const moods = ['focused', 'tired', 'restless', 'delighted', 'melancholy', 'curious', 'sleepy'];
  const devices = ['projector', 'TV', 'laptop', 'cinema', 'tablet', 'phone'];
  const out: WatchSession[] = [];
  titles.forEach((title, index) => {
    const base = title.runtime || (title.type === 'series' ? 48 : 105);
    const count = title.category === 'love' ? 4 : title.category === 'hate' ? 1 : 2;
    for (let i = 0; i < count; i += 1) {
      const days = 5 + index * 9 + i * 13;
      out.push({
        id: `s-${title.id}-${i}`,
        title_id: title.id,
        season: title.type === 'series' ? Math.min((title.seasons || 1), i + 1) : null,
        episode: title.type === 'series' ? (i % (title.episodes_per_season || 8)) + 1 : null,
        minutes: Math.max(12, Math.round(base * (i === 0 ? 1 : 0.6 + (i % 3) * 0.12))),
        mood: moods[(index + i) % moods.length],
        device: devices[(index + i * 2) % devices.length],
        note: i === 0 ? `First pass. ${title.title} — ${title.category === 'love' ? 'held up completely.' : 'as remembered.'}` : '',
        watched_at: daysAgo(days, 20 + (i % 3), 10 * (i % 5)),
        ...stamps(days),
      });
    }
  });
  return out;
}

function buildCollections(titles: Title[]): { collections: Collection[]; items: CollectionItem[] } {
  const definitions: Array<{
    id: string;
    name: string;
    description: string;
    color: string;
    icon: string;
    public?: boolean;
    picks: string[];
  }> = [
    {
      id: 'c-longing',
      name: 'The Longing Machine',
      description: 'Films where the distance between two people is the entire plot.',
      color: '#d8ff3e',
      icon: '◐',
      public: true,
      picks: ['t-mood', 't-portrait', 't-chungking', 't-past-lives', 't-fallen', 't-paris'],
    },
    {
      id: 'c-slow',
      name: 'Slow Weather',
      description: 'Long takes, patience, landscape as argument. Watch with the phone in another room.',
      color: '#8ab4ff',
      icon: '∿',
      picks: ['t-stalker', 't-satantango', 't-werckmeister', 't-taste-cherry'],
    },
    {
      id: 'c-night',
      name: 'Neon & Rain',
      description: 'Cities after midnight, shot in colour that behaves like music.',
      color: '#ff6ec7',
      icon: '✦',
      public: true,
      picks: ['t-chungking', 't-mood', 't-blade', 't-perfect-blue', 't-mulholland'],
    },
    {
      id: 'c-form',
      name: 'Form Over Comfort',
      description: 'Puzzle boxes, unreliable narrators, structural gambles that pay off.',
      color: '#ffb86b',
      icon: '⌗',
      picks: ['t-mulholland', 't-cure', 't-handmaiden', 't-arrival', 't-anatomy'],
    },
    {
      id: 'c-iran',
      name: 'Iranian New Wave',
      description: 'The shelf’s home address. Poetry, bureaucracy and the road.',
      color: '#9ef0c0',
      icon: '◈',
      picks: ['t-taste-cherry', 't-close-up', 't-separation', 't-manaki', 't-cyclist'],
    },
    {
      id: 'c-never-again',
      name: 'Respect, Not Repeat',
      description: 'Important films that I will happily never sit through twice.',
      color: '#ff5d6c',
      icon: '⊗',
      picks: ['t-zone', 't-satantango', 't-cyclist', 't-lucy'],
    },
  ];
  const collections: Collection[] = definitions.map((definition, index) => ({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    color: definition.color,
    icon: definition.icon,
    is_public: Boolean(definition.public),
    sort_order: index,
    ...stamps(60 - index * 4),
  }));
  const items: CollectionItem[] = [];
  definitions.forEach((definition) => {
    definition.picks.forEach((titleId, position) => {
      if (!titles.some((title) => title.id === titleId)) return;
      items.push({
        id: `ci-${definition.id}-${position}`,
        collection_id: definition.id,
        title_id: titleId,
        position,
        note: position === 0 ? 'Anchor pick.' : '',
        ...stamps(50 - position),
      });
    });
  });
  return { collections, items };
}

function buildPeople(): { people: Person[]; credits: Credit[] } {
  const peopleSeed: Array<[string, string, string, number, boolean]> = [
    ['Wong Kar-wai', 'director', 'Hong Kong', 1958, true],
    ['Christopher Doyle', 'cinematographer', 'Australia', 1952, true],
    ['Tony Leung Chiu-wai', 'actor', 'Hong Kong', 1962, true],
    ['Maggie Cheung', 'actor', 'Hong Kong', 1964, true],
    ['Andrei Tarkovsky', 'director', 'Soviet Union', 1932, true],
    ['Abbas Kiarostami', 'director', 'Iran', 1940, true],
    ['Asghar Farhadi', 'director', 'Iran', 1972, true],
    ['Mohsen Makhmalbaf', 'director', 'Iran', 1957, false],
    ['Dariush Mehrjui', 'director', 'Iran', 1939, false],
    ['Céline Sciamma', 'director', 'France', 1978, true],
    ['Park Chan-wook', 'director', 'South Korea', 1963, true],
    ['Satoshi Kon', 'director', 'Japan', 1963, true],
    ['Kiyoshi Kurosawa', 'director', 'Japan', 1955, false],
    ['Béla Tarr', 'director', 'Hungary', 1955, true],
    ['David Lynch', 'director', 'United States', 1946, true],
    ['Denis Villeneuve', 'director', 'Canada', 1967, true],
    ['Roger Deakins', 'cinematographer', 'United Kingdom', 1949, true],
    ['Jonny Greenwood', 'composer', 'United Kingdom', 1971, true],
    ['Charlotte Wells', 'director', 'United Kingdom', 1987, true],
    ['Celine Song', 'director', 'South Korea', 1988, true],
    ['Jonathan Glazer', 'director', 'United Kingdom', 1965, true],
    ['Sandra Hüller', 'actor', 'Germany', 1978, true],
    ['Aki Kaurismäki', 'director', 'Finland', 1957, true],
    ['Christopher Nolan', 'director', 'United Kingdom', 1970, false],
  ];
  const people: Person[] = peopleSeed.map(([name, role, country, birth, following], index) => ({
    id: `p-${slugify(name)}`,
    name,
    role,
    country,
    birth_year: birth,
    notes: following ? 'On the watch-everything list.' : '',
    following,
    ...stamps(400 - index * 8),
  }));

  const creditSeed: Array<[string, string, string, string, number]> = [
    ['t-mood', 'Wong Kar-wai', 'director', '', 1],
    ['t-mood', 'Christopher Doyle', 'cinematographer', '', 2],
    ['t-mood', 'Tony Leung Chiu-wai', 'actor', 'Chow Mo-wan', 1],
    ['t-mood', 'Maggie Cheung', 'actor', 'Su Li-zhen', 2],
    ['t-chungking', 'Wong Kar-wai', 'director', '', 1],
    ['t-chungking', 'Christopher Doyle', 'cinematographer', '', 2],
    ['t-stalker', 'Andrei Tarkovsky', 'director', '', 1],
    ['t-taste-cherry', 'Abbas Kiarostami', 'director', '', 1],
    ['t-close-up', 'Abbas Kiarostami', 'director', '', 1],
    ['t-separation', 'Asghar Farhadi', 'director', '', 1],
    ['t-manaki', 'Dariush Mehrjui', 'director', '', 1],
    ['t-cyclist', 'Mohsen Makhmalbaf', 'director', '', 1],
    ['t-portrait', 'Céline Sciamma', 'director', '', 1],
    ['t-handmaiden', 'Park Chan-wook', 'director', '', 1],
    ['t-oldboy', 'Park Chan-wook', 'director', '', 1],
    ['t-perfect-blue', 'Satoshi Kon', 'director', '', 1],
    ['t-cure', 'Kiyoshi Kurosawa', 'director', '', 1],
    ['t-satantango', 'Béla Tarr', 'director', '', 1],
    ['t-werckmeister', 'Béla Tarr', 'director', '', 1],
    ['t-mulholland', 'David Lynch', 'director', '', 1],
    ['t-blade', 'Denis Villeneuve', 'director', '', 1],
    ['t-blade', 'Roger Deakins', 'cinematographer', '', 2],
    ['t-dune', 'Denis Villeneuve', 'director', '', 1],
    ['t-dune', 'Jonny Greenwood', 'composer', '', 3],
    ['t-there-will', 'Jonny Greenwood', 'composer', '', 2],
    ['t-aftersun', 'Charlotte Wells', 'director', '', 1],
    ['t-past-lives', 'Celine Song', 'director', '', 1],
    ['t-zone', 'Jonathan Glazer', 'director', '', 1],
    ['t-anatomy', 'Sandra Hüller', 'actor', 'Sandra Voyter', 1],
    ['t-fallen', 'Aki Kaurismäki', 'director', '', 1],
    ['t-arrival', 'Denis Villeneuve', 'director', '', 1],
    ['t-twin-peaks', 'David Lynch', 'director', '', 1],
  ];
  const credits: Credit[] = creditSeed.map(([titleId, personName, role, character, billing], index) => ({
    id: `cr-${index}`,
    title_id: titleId,
    person_id: `p-${slugify(personName)}`,
    role,
    character,
    billing,
    ...stamps(200 - index * 3),
  }));
  return { people, credits };
}

function buildQuotes(): Quote[] {
  const seed: Array<[string, string, string, number, boolean]> = [
    ['t-mood', 'He remembers those vanished years. As though looking through a dusty window pane, the past is something he could see, but not touch.', 'Narrator', 4, true],
    ['t-stalker', 'Let everything that’s been planned come true. Let them believe. And let them have faith.', 'Stalker', 148, true],
    ['t-stalker', 'What a strange thing, this grass. It smells of the road and of the earth.', 'Writer', 63, false],
    ['t-taste-cherry', 'A mulberry is the sweetest fruit in the world. Do you want to give up all this?', 'Mr. Bagheri', 61, true],
    ['t-close-up', 'I wanted to be Makhmalbaf. I wanted people to see me as him.', 'Hossein Sabzian', 44, false],
    ['t-portrait', 'Do all lovers feel they are inventing something?', 'Héloïse', 78, true],
    ['t-lighthouse', 'Why’d ya spill yer beans?', 'Wake', 96, true],
    ['t-paris', 'I knew these people. Two people who loved each other very much.', 'Travis', 132, true],
    ['t-mulholland', 'It’s a dream place. You can go there and get lost forever.', 'Coco', 32, false],
    ['t-zone', 'We’re living the way we always dreamed of.', 'Hedwig', 12, true],
    ['t-aftersun', 'I think it’s nice that we share the same sky.', 'Sophie', 74, true],
    ['t-past-lives', 'If you leave something behind, you gain something too.', 'Nora', 91, true],
    ['t-arrival', 'Despite knowing the journey and where it leads, I embrace it.', 'Louise', 100, true],
    ['t-fallen', 'I’m a bit of a drinker. — That’s fine. So am I.', 'Ansa & Holappa', 41, false],
  ];
  return seed.map(([titleId, text, speaker, minute, favorite], index) => ({
    id: `q-${index}`,
    title_id: titleId,
    text,
    speaker,
    at_minute: minute,
    favorite,
    ...stamps(120 - index * 5),
  }));
}

function buildTrivia(): Trivia[] {
  const seed: Array<[string, string, string]> = [
    ['t-mood', 'The film was shot largely in cramped corridors and through doorways, often with the actors partially obscured.', 'Production notes'],
    ['t-stalker', 'The Zone was filmed near Tallinn after the original location was damaged; several sequences were re-shot after a fire.', 'Tarkovsky archives'],
    ['t-portrait', 'The score is almost entirely absent; the two musical cues arrive as events rather than accompaniment.', 'Interview with the director'],
    ['t-aftersun', 'The camcorder footage was shot by the actors themselves over a short production period, with no monitors.', 'Press kit'],
    ['t-perfect-blue', 'The film was originally conceived as a live-action project before being animated.', 'Satoshi Kon interview'],
    ['t-satantango', 'The opening cattle sequence is a single unbroken take lasting roughly eight minutes.', 'Cinematography notes'],
    ['t-zone', 'The sound design was built from extensive archival research and is deliberately never explained on screen.', 'Sound team interview'],
    ['t-twin-peaks', 'The Red Room’s distinctive floor pattern and curtains were built as physical sets, not digital extensions.', 'Production design'],
    ['t-there-will', 'The derrick fire was a practical effect, shot in a single night with multiple cameras.', 'Behind the scenes'],
    ['t-fallen', 'The poster and title refer to a Kaurismäki tradition of naming films after songs and seasons.', 'Festival notes'],
  ];
  return seed.map(([titleId, content, source], index) => ({
    id: `tr-${index}`,
    title_id: titleId,
    content,
    source,
    ...stamps(180 - index * 7),
  }));
}

function buildRelationships(): Relationship[] {
  const seed: Array<[string, string, string, number]> = [
    ['t-mood', 't-chungking', 'same-hand', 0.9],
    ['t-mood', 't-portrait', 'spiritual-twin', 0.86],
    ['t-portrait', 't-past-lives', 'spiritual-twin', 0.82],
    ['t-stalker', 't-satantango', 'slow-cinema', 0.7],
    ['t-stalker', 't-werckmeister', 'slow-cinema', 0.65],
    ['t-taste-cherry', 't-paris', 'road-to-nowhere', 0.78],
    ['t-mulholland', 't-perfect-blue', 'identity-collapse', 0.88],
    ['t-mulholland', 't-cure', 'dream-logic', 0.6],
    ['t-handmaiden', 't-oldboy', 'same-director', 0.75],
    ['t-blade', 't-arrival', 'same-director', 0.55],
    ['t-zone', 't-satantango', 'unwatchable-masterpiece', 0.4],
    ['t-cyclist', 't-lucy', 'shelf-of-shame', 0.2],
    ['t-twin-peaks', 't-mulholland', 'same-hand', 0.84],
    ['t-separation', 't-anatomy', 'courtroom-mirror', 0.63],
  ];
  return seed.map(([titleId, related, kind, weight], index) => ({
    id: `rel-${index}`,
    title_id: titleId,
    related_title_id: related,
    kind,
    weight,
    ...stamps(100 - index * 3),
  }));
}

function buildWatchlist(titles: Title[]): WatchlistItem[] {
  const queued: Array<[string, number, string, number]> = [
    ['t-werckmeister', 4, 'For a Sunday with nothing after it.', 12],
    ['t-cure', 5, 'Second pass — the hypnosis scenes.', 6],
    ['t-manaki', 3, 'Finish the Iranian New Wave run.', 24],
    ['t-oldboy', 2, 'Revisit before the remake talk.', 40],
    ['t-dune', 3, 'Part Two again, this time at home.', 8],
  ];
  return queued.map(([titleId, priority, note, ahead], index) => ({
    id: `w-${index}`,
    title_id: titles.some((title) => title.id === titleId) ? titleId : titles[index].id,
    priority,
    note,
    target_date: dateOnly(-ahead),
    done: false,
    ...stamps(20 - index * 2),
  }));
}

function buildGoals(): Goal[] {
  const year = TODAY.getFullYear();
  return [
    {
      id: 'goal-current',
      year,
      target_titles: 60,
      target_minutes: 9000,
      target_rating_avg: 8.2,
      progress: 41,
      ...stamps(280),
    },
  ];
}

function buildChallenges(): Challenge[] {
  return [
    {
      id: 'ch-slow',
      name: 'Six Films, Six Hours',
      description: 'One film over three hours per month. No phone, no pausing, one sitting.',
      rule: { minRuntime: 180, perMonth: 1, allowBreaks: false },
      progress: 3,
      target: 6,
      status: 'active',
      ...stamps(120),
    },
    {
      id: 'ch-iran',
      name: 'Iranian New Wave, Ten Deep',
      description: 'Ten films from the 1969–1997 run, with a written note on each.',
      rule: { country: 'Iran', yearFrom: 1969, yearTo: 1997, requireNote: true },
      progress: 7,
      target: 10,
      status: 'active',
      ...stamps(200),
    },
    {
      id: 'ch-decade',
      name: 'Decade Sweep',
      description: 'At least one film from every decade between 1950 and 2020.',
      rule: { decades: [1950, 2020], minPerDecade: 1 },
      progress: 6,
      target: 8,
      status: 'active',
      ...stamps(340),
    },
    {
      id: 'ch-noir',
      name: 'Neon Noir Month',
      description: 'Thirty days, eight nocturnal cities, zero daylight screenings.',
      rule: { month: 'any', genre: 'Noir', target: 8 },
      progress: 8,
      target: 8,
      status: 'done',
      ...stamps(400),
    },
  ];
}

function buildEvents(titles: Title[]): CinemaEvent[] {
  const seed: Array<[string | null, string, number, string, string]> = [
    ['t-zone', 'screening', 3, 'Rialto · Screen 2', '35mm print. Bring the good headphones for after.'],
    ['t-mood', 'watch-party', 9, 'Living room', 'Two people minimum, phones in the bowl.'],
    [null, 'repertory', 16, 'Cinema Rex', 'Late-night mystery double feature.'],
    ['t-stalker', 'screening', 24, 'Home projector', 'One sitting. Intermission allowed at the tunnel.'],
    ['t-fallen', 'watch-party', 31, 'Kitchen screening', 'Bring something that takes time to cook.'],
  ];
  return seed.map(([titleId, kind, ahead, location, note], index) => ({
    id: `ev-${index}`,
    title_id: titleId,
    kind,
    starts_at: daysAhead(ahead, 19 + (index % 3), 0),
    location,
    note,
    ...stamps(30 - index * 3),
  }));
}

function buildPrompts(): PromptTemplate[] {
  const seed: Array<[string, string, string, string, number]> = [
    [
      'The Unsparing Review',
      'Write a review of {{title}} ({{year}}) in three paragraphs. Paragraph one: the film’s central formal gamble. Paragraph two: what it costs emotionally. Paragraph three: who should see it and who should not. No plot summary. No score.',
      'review',
      'title, year',
      14,
    ],
    [
      'Standardise a Misfiled Entry',
      'Return strict JSON with keys: original_title, year, country, language, runtime, seasons, episodes, genre, tags. Base every value on the actual film. Use null when a value is genuinely unknown. Do not invent.',
      'metadata',
      'title',
      22,
    ],
    [
      'The Roommate Test',
      'Recommend one film for someone who loved {{loved}} and hated {{hated}}. Explain the choice in under 120 words using only craft terms: camera, structure, performance, sound.',
      'curation',
      'loved, hated',
      9,
    ],
    [
      'Taste Autopsy',
      'Read the following shelf and describe the operator’s taste as a critic would: three convictions, two blind spots, one contradiction. Cite titles as evidence. Do not flatter.',
      'analysis',
      '',
      6,
    ],
    [
      'Story Analysis, Cold',
      'Analyse {{title}} as a screenwriter: act structure, turning points, the scene that carries the theme, and one structural weakness. No praise. No summary.',
      'analysis',
      'title',
      11,
    ],
    [
      'Quote Excavator',
      'From memory, list up to five quotable lines from {{title}}. For each: the line, the speaker, and why it survives outside the film. Mark uncertainty explicitly. Never fabricate.',
      'writing',
      'title',
      4,
    ],
    [
      'The Honest Watchlist',
      'Given these queued titles and this viewing history, cut the watchlist to five and justify each cut and each keep in one sentence.',
      'curation',
      '',
      7,
    ],
    [
      'Continuation Protocol',
      'Continue the assistant response from exactly where it stopped. Do not repeat any completed sentence. Do not introduce a new section unless the previous one was unfinished.',
      'system',
      '',
      18,
    ],
  ];
  return seed.map(([name, body, category, variables, use_count], index) => ({
    id: `pr-${index}`,
    name,
    body,
    category,
    variables,
    use_count,
    ...stamps(90 - index * 5),
  }));
}

function buildModels(): AiModelRow[] {
  const seed: Array<[string, string, string, string, string, boolean, string, number, number]> = [
    ['deepseek/deepseek-r1:free', 'DeepSeek R1', 'DeepSeek', 'reasoning,free', 'analysis', true, '164k', 12, 4],
    ['meta-llama/llama-3.3-70b-instruct:free', 'Llama 3.3 70B', 'Meta', 'fast,free', 'reviews', false, '131k', 8, 6],
    ['google/gemini-2.0-flash-exp:free', 'Gemini 2.0 Flash', 'Google', 'fast,free', 'standardising', false, '1M', 5, 3],
    ['qwen/qwen-2.5-72b-instruct:free', 'Qwen 2.5 72B', 'Alibaba', 'multilingual,free', 'persian copy', false, '32k', 3, 2],
    ['mistralai/mistral-small-3.1-24b-instruct:free', 'Mistral Small 3.1', 'Mistral', 'balanced,free', 'everything', false, '128k', 4, 2],
    ['openrouter/free', 'Free Models Router', 'OpenRouter', 'router,free', 'when nothing else works', true, 'auto', 1, 1],
  ];
  return seed.map(([id, label, vendor, tags, bestFor, recommended, context, wins, losses], index) => ({
    id,
    label,
    vendor,
    size: '',
    context,
    speed: index < 3 ? 'fast' : 'measured',
    note: '',
    tags,
    recommended,
    best_for: bestFor,
    is_free: true,
    source: 'seed',
    fetched_at: daysAgo(2, 8, 0),
    provider: 'openrouter',
    active: true,
    wins,
    losses,
    last_tried_at: daysAgo(index * 3 + 1, 22, 0),
    user_rating: recommended ? 5 : 3,
    ...stamps(45 - index),
  }));
}

function buildAwards(titles: Title[]): Award[] {
  const seed: Array<[string, string, string, number, boolean]> = [
    ['t-mood', 'Cannes', 'Best Actor', 2000, true],
    ['t-taste-cherry', 'Cannes', 'Palme d’Or', 1997, true],
    ['t-separation', 'Berlin', 'Golden Bear', 2011, true],
    ['t-separation', 'Academy Awards', 'Best Foreign Language Film', 2012, true],
    ['t-portrait', 'Cannes', 'Best Screenplay', 2019, true],
    ['t-zone', 'Academy Awards', 'Best International Feature', 2024, true],
    ['t-zone', 'Academy Awards', 'Best Sound', 2024, false],
    ['t-anatomy', 'Cannes', 'Palme d’Or', 2023, true],
    ['t-aftersun', 'BAFTA', 'Outstanding British Film', 2023, false],
    ['t-handmaiden', 'Cannes', 'Palme d’Or', 2016, false],
  ];
  return seed
    .filter(([titleId]) => titles.some((title) => title.id === titleId))
    .map(([titleId, body, category, year, won], index) => ({
      id: `a-${index}`,
      title_id: titleId,
      body,
      category,
      year,
      won,
      note: won ? 'Shelf trophy.' : 'Nominated; lost to something louder.',
      ...stamps(300 - index * 11),
    }));
}

function buildShares(titles: Title[]): Share[] {
  return [
    {
      id: 'sh-1',
      title_id: 't-mood',
      slug: 'the-longing-machine',
      expires_at: null,
      views: 42,
      ...stamps(30),
    },
    {
      id: 'sh-2',
      title_id: null,
      slug: 'slow-weather-shelf',
      expires_at: daysAhead(30, 12, 0),
      views: 17,
      ...stamps(12),
    },
    {
      id: 'sh-3',
      title_id: titles[0]?.id || null,
      slug: 'private-screen',
      expires_at: daysAhead(3, 12, 0),
      views: 3,
      ...stamps(4),
    },
  ];
}

function buildImports(): ImportBatch[] {
  return [
    {
      id: 'im-1',
      source: 'json',
      count: 34,
      status: 'done',
      payload_summary: 'Legacy letterboxd export · 34 titles · 2 conflicts resolved',
      ...stamps(96),
    },
    {
      id: 'im-2',
      source: 'csv',
      count: 18,
      status: 'done',
      payload_summary: 'Watchlist CSV · 18 rows · dates preserved',
      ...stamps(41),
    },
  ];
}

function buildNotes(titles: Title[]): MizanNote[] {
  const seed: Array<[string, string, string, string, string]> = [
    [
      't-mood',
      'Two neighbours in 1962 Hong Kong',
      'discover their spouses are having an affair',
      'and rehearse a closeness',
      'The sentence describes knowledge before desire. That order is the film.',
    ],
    [
      't-stalker',
      'A guide leads two men',
      'through a forbidden Zone',
      'toward a room that is said',
      'The Zone is a permission structure, not a place.',
    ],
    [
      't-zone',
      'build an idyllic home',
      'beside the camp wall',
      '',
      '“Beside” is doing all the moral work in this sentence.',
    ],
  ];
  return seed.map(([titleId, before, selected, after, noteText], index) => ({
    id: `mn-${index}`,
    content_id: index + 1,
    title_id: titles.some((title) => title.id === titleId) ? titleId : null,
    anchor_before: before,
    anchor_selected: selected,
    anchor_after: after,
    note_text: noteText,
    ...stamps(60 - index * 9),
  }));
}

function buildSavedViews(): SavedView[] {
  return [
    { id: 'sv-1', name: 'Unwatched loves', route: 'library?status=queued&category=love', icon: '◐', pin: true, ...stamps(40) },
    { id: 'sv-2', name: 'Films under 100m', route: 'library?maxRuntime=100', icon: '⧗', pin: true, ...stamps(35) },
    { id: 'sv-3', name: 'Hate shelf', route: 'library?category=hate', icon: '✕', pin: false, ...stamps(22) },
    { id: 'sv-4', name: 'No notes yet', route: 'library?missing=notes', icon: '⌗', pin: false, ...stamps(11) },
  ];
}

function buildMeta(): MetaRow[] {
  return [
    { k: 'shelf_title', v: 'Full Metal Cinema', user_id: null },
    { k: 'operator', v: 'Operator 01', user_id: null },
    { k: 'last_backup', v: daysAgo(3, 2, 0), user_id: null },
    { k: 'theme', v: 'projection', user_id: null },
    { k: 'schema_version', v: '2.0.0', user_id: null },
  ];
}

function buildActivity(titles: Title[]): Activity[] {
  const actions: Array<[string, string, string, string]> = [
    ['ai', 'cinema_titles', 't-zone', 'Deep analysis stored for The Zone of Interest'],
    ['rated', 'cinema_ratings', 'r-t-mood', 'Re-scored In the Mood for Love · 10/10'],
    ['watched', 'cinema_watch_sessions', 's-t-portrait-0', 'Logged a session for Portrait of a Lady on Fire'],
    ['created', 'cinema_collections', 'c-longing', 'Created collection “The Longing Machine”'],
    ['updated', 'cinema_titles', 't-bear', 'Moved The Bear to watching'],
    ['imported', 'cinema_import_batches', 'im-1', 'Imported 34 titles from legacy JSON'],
    ['shared', 'cinema_shares', 'sh-2', 'Shared the Slow Weather shelf'],
    ['watchlist', 'cinema_watchlist', 'w-0', 'Queued Werckmeister Harmonies at priority 4'],
    ['ai', 'cinema_ai_models', 'deepseek/deepseek-r1:free', 'Arena round: R1 beat Llama 3.3 on story analysis'],
    ['created', 'cinema_quotes', 'q-5', 'Saved a quote from Portrait of a Lady on Fire'],
  ];
  return actions.flatMap(([action, entity, entityId, detail], index) => [
    {
      id: `act-${index}-a`,
      action,
      entity,
      entity_id: titles.some((title) => title.id === entityId) ? entityId : null,
      detail,
      ...stamps(index * 2 + 1),
    },
  ]);
}

export function buildSeedDatabase(): DatabaseShape {
  const titles = buildTitles();
  const { collections, items } = buildCollections(titles);
  const { people, credits } = buildPeople();
  const sessions = buildSessions(titles);
  const now = nowIso();
  const thread: AiThread = {
    id: 'thread-seed',
    title: 'Opening the projection booth',
    title_id: null,
    model: 'deepseek/deepseek-r1:free',
    system:
      'You are the projectionist of Full Metal Cinema: a precise, unsentimental film critic with deep knowledge of world cinema. Cite craft, never plot summaries.',
    params: { ...DEFAULT_PARAMS },
    tags: 'welcome',
    pinned: true,
    archived: false,
    branch_of: null,
    last_at: now,
    created_at: now,
    updated_at: now,
    user_id: null,
  };

  return {
    cinema_titles: titles,
    cinema_activity: buildActivity(titles),
    cinema_meta: buildMeta(),
    cinema_conversations: [] as Conversation[],
    cinema_ai_models: buildModels(),
    cinema_ai_models_deleted: [],
    cinema_collections: collections,
    cinema_collection_items: items,
    cinema_ratings: buildRatings(titles),
    cinema_watchlist: buildWatchlist(titles),
    cinema_watch_sessions: sessions,
    cinema_people: people,
    cinema_credits: credits,
    cinema_quotes: buildQuotes(),
    cinema_trivia: buildTrivia(),
    cinema_relationships: buildRelationships(),
    cinema_goals: buildGoals(),
    cinema_challenges: buildChallenges(),
    cinema_events: buildEvents(titles),
    cinema_prompts: buildPrompts(),
    cinema_ai_usage: [],
    cinema_awards: buildAwards(titles),
    cinema_shares: buildShares(titles),
    cinema_import_batches: buildImports(),
    cinema_mizan_notes: buildNotes(titles),
    cinema_saved_views: buildSavedViews(),
    cinema_ai_threads: [thread],
    cinema_ai_turns: [
      {
        id: uid('turn'),
        thread_id: thread.id,
        parent_id: null,
        role: 'assistant',
        content:
          'The booth is open.\n\nPick a film from the shelf, or ask for a reading of the collection as a whole. Every reply streams directly from the model you choose — your key stays in this browser, and nothing is proxied.\n\nTry *“What does my shelf believe about endings?”* or open a title and run **Deep analysis**.',
        reasoning: '',
        status: 'complete',
        model: thread.model,
        requested_model: thread.model,
        provider: 'seed',
        continue_of: null,
        usage: null,
        request: null,
        error: null,
        meta: { started_at: now, completed_at: now, finish_reason: 'seed', mode: 'seed' },
        created_at: now,
        updated_at: now,
        user_id: null,
      },
    ],
  } as DatabaseShape;
}

export const SEED_TITLE_COUNT = TITLE_SEED.length;
export const SEED_TAGS = Array.from(
  new Set(TITLE_SEED.flatMap((title) => title.tags.split(',').map((tag) => tag.trim()))),
)
  .filter(Boolean)
  .sort();

export const SEED_GENRES = Array.from(
  new Set(TITLE_SEED.flatMap((title) => title.genre.split(',').map((tag) => tag.trim()))),
)
  .filter(Boolean)
  .sort();

export const SEED_DEVICES = ['projector', 'TV', 'laptop', 'cinema', 'tablet', 'phone'];
export const SEED_MOODS = ['focused', 'tired', 'restless', 'delighted', 'melancholy', 'curious', 'sleepy'];
export const SEED_RELATIONSHIP_KINDS = [
  'spiritual-twin',
  'same-hand',
  'same-director',
  'slow-cinema',
  'dream-logic',
  'identity-collapse',
  'courtroom-mirror',
  'road-to-nowhere',
  'unwatchable-masterpiece',
  'shelf-of-shame',
  'remake',
  'prequel',
  'rebuttal',
];
export const SEED_EVENT_KINDS = ['screening', 'watch-party', 'repertory', 'festival', 'deadline'];
export const SEED_PEOPLE_ROLES = [
  'director',
  'actor',
  'writer',
  'cinematographer',
  'composer',
  'editor',
  'producer',
];
export const SEED_AWARD_BODIES = ['Cannes', 'Berlin', 'Venice', 'Academy Awards', 'BAFTA', 'Golden Globes'];
export const SEED_CHALLENGE_STATUS = ['active', 'done', 'abandoned'] as const;
export const joinTagList = joinList;
