// ---------------------------------------------------------------------------
// i18n.js — Persian (fa-IR) rendering layer.
//
// The app is written in English at the source level; this module translates the
// rendered DOM instead. That keeps the copy in one place and covers strings that
// come from the database (people, traits, categories) which a source-level
// translation could never reach.
//
//   translate('Save')        → 'ذخیره'
//   startTranslator()        → live translation of every rendered node
// ---------------------------------------------------------------------------

export const DIR = 'rtl';
export const LANG = 'fa-IR';

/* ------------------------------------------------------------------ phrases */
// exact matches, case sensitive first then case-insensitive
export const PHRASES = {
  // ---------------------------------------------------------------- identity
  TRIAD: 'تریاد',
  'The stacks': 'پشته‌ها',
  'Three dimensions,': 'سه بُعد،',
  'one truth.': 'یک حقیقت.',
  '3D SCORING MATRIX': 'ماتریس امتیازدهی سه‌بعدی',
  'A three-dimensional ranking and scoring matrix.': 'ماتریس رتبه‌بندی و امتیازدهی سه‌بعدی.',

  // ------------------------------------------------------------------- routes
  Hub: 'خانه',
  Matrix: 'ماتریس',
  Deck: 'دسته',
  People: 'افراد',
  Traits: 'ویژگی‌ها',
  Insights: 'بینش‌ها',
  Compare: 'مقایسه',
  'AI Lab': 'آزمایشگاه هوش',
  Labs: 'آزمایشگاه',
  Settings: 'تنظیمات',
  'Command palette': 'فرمان‌یاب',
  'Command palette (⌘K)': 'فرمان‌یاب (⌘K)',
  'Search people, traits, actions': 'جست‌وجوی افراد، ویژگی‌ها، کارها',
  'Search routes, people, traits, actions…': 'جست‌وجوی مسیرها، افراد، ویژگی‌ها، کارها…',
  'Search traits…': 'جست‌وجوی ویژگی…',
  'Search traits…': 'جست‌وجوی ویژگی‌ها…',
  'Filter people…': 'پالایش افراد…',
  'Filter 400+ models…': 'پالایش بیش از ۴۰۰ مدل…',
  'TRIAD /// command palette (⌘K)': 'تریاد /// فرمان‌یاب (⌘K)',
  '⌘K / Ctrl K': '⌘K / Ctrl K',

  // -------------------------------------------------------------------- shell
  'Primary': 'اصلی',
  Inspector: 'بازرس',
  Search: 'جست‌وجو',
  'Sign in': 'ورود',
  'Sign out': 'خروج',
  'Sign out?': 'خروج از حساب؟',
  'Signing in unlocks writes to the shared cloud cube. Reads work without an account.':
    'ورود، نوشتن در مکعب ابری مشترک را باز می‌کند. خواندن بدون حساب هم کار می‌کند.',
  'Signed out — local mode': 'خارج شدید — حالت محلی',
  'Create account': 'ساخت حساب',
  'Send link': 'ارسال پیوند',
  'A one-time link is emailed to you. No password needed.':
    'یک پیوند یک‌بارمصرف برایتان ایمیل می‌شود. نیازی به گذرواژه نیست.',
  Account: 'حساب',
  Email: 'ایمیل',
  Password: 'گذرواژه',
  'Auth unavailable': 'احراز هویت در دسترس نیست',
  'Session active': 'نشست فعال است',
  'Cloud writes enabled': 'نوشتن ابری فعال شد',
  'Local mode': 'حالت محلی',
  'Local cube': 'مکعب محلی',
  'Cloud cube': 'مکعب ابری',
  'Cloud cube (Supabase)': 'مکعب ابری (Supabase)',
  Auto: 'خودکار',
  Local: 'محلی',
  Cloud: 'ابری',
  'Data source': 'منبع داده',
  Source: 'منبع',
  'Syncing…': 'همگام‌سازی…',
  'Sync now': 'همگام‌سازی',
  'Working…': 'در حال کار…',
  'Load failed': 'بارگذاری ناموفق',
  'Failed': 'ناموفق',
  'Retry': 'تلاش دوباره',
  'Refresh': 'تازه‌سازی',
  'Reload': 'بارگذاری دوباره',
  'Close': 'بستن',
  'Cancel': 'انصراف',
  'Save': 'ذخیره',
  'Delete': 'حذف',
  'Edit': 'ویرایش',
  'Create': 'ایجاد',
  'Add': 'افزودن',
  'Clear': 'پاک‌کردن',
  'Copy': 'رونوشت',
  'Copied': 'رونوشت شد',
  'Copy failed': 'رونوشت نشد',
  'Download': 'دریافت',
  'Download SQL': 'دریافت SQL',
  'Import': 'ورود داده',
  'Export': 'خروجی',
  'Export cube (JSON)': 'خروجی مکعب (JSON)',
  'Import cube?': 'مکعب وارد شود؟',
  'Export matrix (CSV)': 'خروجی ماتریس (CSV)',
  'Undo': 'واگرد',
  'Redo': 'ازنو',
  'Reset': 'بازنشانی',
  'Back': 'بازگشت',
  'Next': 'بعدی',
  'Previous': 'پیشین',
  'Done': 'تمام',
  'Skip': 'رد کردن',
  'Continue': 'ادامه',
  'Apply': 'اعمال',
  'Remove': 'برداشتن',
  'Remove key': 'حذف کلید',
  'Yes': 'بله',
  'No': 'خیر',
  'OK': 'باشه',
  'Name': 'نام',
  'Title': 'عنوان',
  'Description': 'توضیح',
  'Note': 'یادداشت',
  'note (optional)': 'یادداشت (اختیاری)',
  'Tags': 'برچسب‌ها',
  'Role': 'نقش',
  'Department': 'دپارتمان',
  'Weight': 'وزن',
  'Category': 'دسته',
  'Color': 'رنگ',
  'Icon': 'نشان',
  'Key': 'کلید',
  'Value': 'مقدار',
  'Score': 'امتیاز',
  'Rating': 'امتیاز',
  'Rank': 'رتبه',
  'Ranker': 'رتبه‌دهنده',
  'Rankers': 'رتبه‌دهندگان',
  'Target': 'هدف',
  'Targets': 'هدف‌ها',
  'Trait': 'ویژگی',
  'Axis': 'محور',
  'Axes': 'محورها',
  'Stack': 'پشته',
  'Stacks': 'پشته‌ها',
  'Layer': 'لایه',
  'Layers': 'لایه‌ها',
  'Slice': 'برش',
  'Cube': 'مکعب',
  'Cell': 'خانه',
  'Cells': 'خانه‌ها',
  'Row': 'سطر',
  'Column': 'ستون',
  'Total': 'مجموع',
  'Average': 'میانگین',
  'Mean': 'میانگین',
  'Median': 'میانه',
  'Spread': 'پراکندگی',
  'Coverage': 'پوشش',
  'Confidence': 'اطمینان',
  'Divergence': 'واگرایی',
  'Heat': 'گرما',
  'Consensus': 'هم‌سختی',
  'Consensus mean': 'میانگین هم‌سختی',
  'Composite': 'ترکیبی',
  'Reciprocity': 'تعامل دوسویه',
  'Agreement': 'توافق',
  'Reliability': 'پایایی',
  'Polarisation': 'قطبی‌شدن',
  'Distribution': 'توزیع',
  'Timeline': 'خط زمان',
  'Overview': 'نمای کلی',
  'Summary': 'خلاصه',
  'Details': 'جزئیات',
  'Profile': 'نمایه',
  'People base': 'پایه افراد',
  'Trait base': 'پایه ویژگی',
  'people base · given': 'پایه افراد · داده‌شده',
  'people base · received': 'پایه افراد · دریافت‌شده',
  'ranker × target': 'رتبه‌دهنده × هدف',
  'ranker × trait': 'رتبه‌دهنده × ویژگی',
  'target × trait': 'هدف × ویژگی',
  'rankers → targets': 'رتبه‌دهندگان ← هدف‌ها',
  'rankers → traits': 'رتبه‌دهندگان ← ویژگی‌ها',
  'targets → traits': 'هدف‌ها ← ویژگی‌ها',
  'TRAIT-BASED': 'ویژگی‌محور',
  'RANKER-BASED': 'رتبه‌دهنده‌محور',
  'TARGET-BASED': 'هدف‌محور',

  // ---------------------------------------------------------------------- hub
  'THE CUBE': 'مکعب',
  'SLICE': 'برش',
  'slice · trait-based': 'برش · ویژگی‌محور',
  'slice · ranker-based': 'برش · رتبه‌دهنده‌محور',
  'slice · target-based': 'برش · هدف‌محور',
  'Who leads?': 'چه کسی پیشتاز است؟',
  'Who leads this cube and why? Use composite and coverage numbers.':
    'چه کسی در این مکعب پیشتاز است و چرا؟ از اعداد ترکیبی و پوشش استفاده کن.',
  Leaders: 'پیشتازان',
  Leaderboard: 'جدول پیشتازان',
  'Composite ranking (weighted consensus):': 'رتبه‌بندی ترکیبی (هم‌سختی وزنی):',
  'Contested': 'مناقشه‌برانگیز',
  'Contested cells': 'خانه‌های مناقشه‌برانگیز',
  'Disputes': 'مناقشه‌ها',
  'Dispute queue': 'صف مناقشه',
  'Telemetry': 'سنجه‌ها',
  'Activity': 'فعالیت',
  'Recent': 'اخیر',
  'Live': 'زنده',
  'Signals': 'سیگنال‌ها',
  'Uncertainty': 'عدم‌قطعیت',
  'Outliers': 'داده‌های پرت',
  'Anomalies': 'ناهنجاری‌ها',
  'Ranking': 'رتبه‌بندی',
  'Given': 'داده‌شده',
  'Received': 'دریافت‌شده',
  'Given / received': 'داده‌شده / دریافت‌شده',
  'Per trait': 'به‌تفکیک ویژگی',
  'By trait': 'بر پایه ویژگی',
  'By person': 'بر پایه فرد',
  'Top': 'برتر',
  'Bottom': 'پایین',
  'Best': 'بهترین',
  'Worst': 'بدترین',
  'Winner': 'برنده',
  'Draw': 'مساوی',
  'Tie': 'تساوی',

  // ------------------------------------------------------------------- matrix
  'Trait stack': 'پشته ویژگی',
  'Ranker stack': 'پشته رتبه‌دهنده',
  'Target stack': 'پشته هدف',
  'Trait stack ·': 'پشته ویژگی ·',
  'Ranker stack ·': 'پشته رتبه‌دهنده ·',
  'Target stack ·': 'پشته هدف ·',
  'One stack per trait. Each table ranks every person against every other person on that single dimension.':
    'یک پشته برای هر ویژگی. هر جدول، همه افراد را در همان یک بُعد در برابر هم رتبه‌بندی می‌کند.',
  'One stack per ranker. Each table is everything that person handed out: targets × traits.':
    'یک پشته برای هر رتبه‌دهنده. هر جدول همه امتیازهایی است که آن فرد داده: هدف‌ها × ویژگی‌ها.',
  'One stack per person being scored. Each table is everything the group said about them.':
    'یک پشته برای هر فرد امتیازگیرنده. هر جدول همه چیزی است که گروه درباره‌اش گفته.',
  'rankers': 'رتبه‌دهندگان',
  'targets': 'هدف‌ها',
  'traits': 'ویژگی‌ها',
  'person': 'فرد',
  'trait': 'ویژگی',
  'Cube incomplete': 'مکعب ناقص است',
  'A matrix needs people and traits. Install the library and add people first.':
    'ماتریس به افراد و ویژگی‌ها نیاز دارد. نخست کتابخانه را نصب کنید و افراد را بیفزایید.',
  'Install traits': 'نصب ویژگی‌ها',
  'Install library': 'نصب کتابخانه',
  'Install the trait library and add people to start building the cube.':
    'کتابخانه ویژگی‌ها را نصب کنید و افراد را بیفزایید تا ساخت مکعب آغاز شود.',
  'Add person': 'افزودن فرد',
  'New person': 'فرد تازه',
  'New trait': 'ویژگی تازه',
  'Rate this trait': 'این ویژگی را امتیاز بده',
  'self — not rated': 'خود — امتیاز نیافته',
  'Click to rate': 'برای امتیاز کلیک کنید',
  'Failed:': 'ناموفق:',
  'No cube context supplied.': 'زمینه‌ای از مکعب داده نشد.',

  // ------------------------------------------------------------ stack controls
  'Explode': 'انفجار',
  'Explode / collapse stack (E)': 'باز و بسته کردن پشته (E)',
  'Flat grid (G)': 'شبکه تخت (G)',
  'Reset camera (R)': 'بازنشانی دوربین (R)',
  'Orbit keeps moving after you release it.': 'چرخش پس از رهاکردن هم ادامه دارد.',
  'move between layers / cards': 'جابه‌جایی میان لایه‌ها / کارت‌ها',
  'Reset': 'بازنشانی',
  'depth': 'عمق',
  'focus': 'تمرکز',
  'orbit': 'چرخش',
  'zoom': 'بزرگ‌نمایی',
  'drag to orbit · scroll for depth · click to focus': 'بکشید تا بچرخد · اسکرول برای عمق · کلیک برای تمرکز',
  'values': 'مقادیر',
  'rows': 'سطرها',
  'cols': 'ستون‌ها',
  'colour = score': 'رنگ = امتیاز',
  'colour = distance from consensus': 'رنگ = فاصله از هم‌سختی',
  'colour = rater confidence': 'رنگ = اطمینان امتیازدهنده',
  'high spread = the group does not agree on this cell': 'پراکندگی بالا = گروه بر این خانه توافق ندارد',
  'mean score per person × trait, all rankers combined': 'میانگین امتیاز هر فرد × ویژگی، همه رتبه‌دهندگان با هم',
  'Empty': 'خالی',
  'No data': 'داده‌ای نیست',

  // --------------------------------------------------------------------- deck
  'Rate': 'امتیاز بده',
  'Rate this': 'به این امتیاز بده',
  'Swipe': 'بکش',
  'Swipe right to keep': 'برای ثبت به راست بکشید',
  'Commit score (→)': 'ثبت امتیاز (→)',
  'Skip / low (←)': 'رد / کم (←)',
  'Every card for this ranker is already scored.': 'همه کارت‌های این رتبه‌دهنده امتیاز گرفته‌اند.',
  'Add people and traits to build a deck.': 'برای ساخت دسته، افراد و ویژگی‌ها را بیفزایید.',
  'Who is rating?': 'چه کسی امتیاز می‌دهد؟',
  'Pick a ranker': 'یک رتبه‌دهنده برگزینید',
  'Session': 'نشست',
  'Session complete': 'نشست کامل شد',
  'Start session': 'آغاز نشست',
  'End session': 'پایان نشست',
  'Cards left': 'کارت‌های باقی‌مانده',
  'of': 'از',
  'card': 'کارت',
  'cards': 'کارت',
  'Deck empty': 'دسته خالی است',
  'Shuffle': 'درهم‌سازی',
  'Review': 'بازبینی',
  'scored': 'امتیازگرفته',
  'remaining': 'باقی‌مانده',

  // ------------------------------------------------------------------- people
  'Directory': 'فهرست',
  'Profiles': 'نمایه‌ها',
  'Person': 'فرد',
  'Job title': 'عنوان شغلی',
  'Bio': 'درباره',
  'Status': 'وضعیت',
  'Active': 'فعال',
  'Inactive': 'غیرفعال',
  'Unknown': 'نامشخص',
  'Add a person to the cube': 'افزودن فرد به مکعب',
  'Edit person': 'ویرایش فرد',
  'Delete person?': 'فرد حذف شود؟',
  'This removes the person and every score they gave or received.':
    'این کار فرد و همه امتیازهایی که داده یا گرفته را حذف می‌کند.',
  'This removes the trait and every score recorded for it.':
    'این کار ویژگی و همه امتیازهای ثبت‌شده برای آن را حذف می‌کند.',
  'Search people…': 'جست‌وجوی افراد…',
  'Sort by': 'ترتیب بر اساس',
  'No people yet': 'هنوز فردی نیست',
  'Try a different filter, or add a new person.': 'پالایه دیگری را امتحان کنید یا فرد تازه بیفزایید.',
  'Full name': 'نام کامل',
  'Delete forever': 'حذف همیشگی',

  // ------------------------------------------------------------------- traits
  'Trait library': 'کتابخانه ویژگی‌ها',
  'Install library?': 'کتابخانه نصب شود؟',
  'The trait library adds 96 traits across 8 categories. Existing keys are left untouched.':
    'کتابخانه ویژگی ۹۶ ویژگی در ۸ دسته می‌افزاید. کلیدهای موجود دست‌نخورده می‌مانند.',
  'trait library · 96 dimensions': 'کتابخانه ویژگی · ۹۶ بُعد',
  'weight = pull on the composite': 'وزن = تأثیر بر ترکیب',
  'polarity: higher is better': 'قطبیت: بالاتر بهتر است',
  'polarity: lower is better': 'قطبیت: پایین‌تر بهتر است',
  'cost dimension': 'بُعد هزینه',
  'Add a trait to the cube': 'افزودن ویژگی به مکعب',
  'Edit trait': 'ویرایش ویژگی',
  'Delete trait?': 'ویژگی حذف شود؟',
  'No traits yet': 'هنوز ویژگی‌ای نیست',
  'The group reads this trait consistently.': 'گروه این ویژگی را یکدست می‌خواند.',
  'This trait splits the group rather than describing it.':
    'این ویژگی گروه را دوقطبی می‌کند، نه اینکه آن را توصیف کند.',
  'Not rated yet': 'هنوز امتیازی ندارد',
  'traits installed': 'ویژگی نصب شد',

  // ----------------------------------------------------------------- insights
  'Insights need ratings. Start a deck or fill a matrix slice.':
    'بینش‌ها به امتیاز نیاز دارند. یک دسته را آغاز کنید یا برشی از ماتریس را پر کنید.',
  'Find statistical anomalies: scores more than 2 sd from consensus, rankers whose bias is an outlier, and cells with suspicious confidence. Output a compact table as markdown.':
    'ناهنجاری‌های آماری را پیدا کن: امتیازهایی که بیش از ۲ انحراف معیار از هم‌سختی فاصله دارند، رتبه‌دهندگانی که سوگیری‌شان پرت است، و خانه‌هایی با اطمینان مشکوک. خروجی را جدولی فشرده و مارک‌داون بده.',
  'Flag statistical outliers and possible rating errors.': 'داده‌های پرت آماری و خطاهای احتمالی امتیازدهی را نشانه بگذار.',
  'Find cells where the group disagrees and explain the shape of the conflict.':
    'خانه‌هایی را بیاب که گروه در آن‌ها اختلاف دارد و شکل این ناسازگاری را توضیح بده.',
  'Widest disagreement cells:': 'بیشترین اختلاف در خانه‌ها:',
  'Which conclusions are least trustworthy given coverage and spread?':
    'با توجه به پوشش و پراکندگی، کدام نتیجه‌گیری‌ها کم‌ترین اعتبار را دارند؟',
  'Which 10 cards should be rated next to reduce uncertainty most?':
    'کدام ۱۰ کارت باید امتیاز بگیرند تا عدم‌قطعیت بیشترین کاهش را داشته باشد؟',
  'Order the next rating session for maximum information.':
    'نشست بعدی امتیازدهی را برای بیشترین اطلاعات ممکن بچین.',
  'Where is the biggest disagreement and what does it imply?':
    'بزرگ‌ترین اختلاف کجاست و چه معنایی دارد؟',
  'Turn the aggregate numbers into a readable briefing.': 'اعداد کلی را به یک گزارش خوانا تبدیل کن.',
  'Summarise the cube and name the three most important patterns.':
    'مکعب را خلاصه کن و سه الگوی مهم‌تر را نام ببر.',
  'Write the executive brief for this cube.': 'خلاصه مدیریتی این مکعب را بنویس.',
  'Write the executive brief for this cube: headline signal, strongest person and why, most contested pair, thinnest coverage, and one decision. Five short paragraphs, numbers inline.':
    'خلاصه مدیریتی این مکعب را بنویس: سیگنال اصلی، قوی‌ترین فرد و دلیلش، مناقشه‌برانگیزترین جفت، نازک‌ترین پوشش و یک تصمیم. پنج بند کوتاه با اعداد در متن.',
  'Write a 5-sentence editorial briefing on the state of this cube: who leads, which trait drives the ranking, where coverage is thin, and one risk. No bullet lists.':
    'یک گزارش تحلیلی پنج‌جمله‌ای از وضعیت این مکعب بنویس: چه کسی پیشتاز است، کدام ویژگی رتبه‌بندی را می‌راند، کجا پوشش نازک است و یک ریسک. بدون فهرست نشانه‌دار.',
  'Deep profile of one person from the received scores.':
    'نمایه عمیق یک فرد بر پایه امتیازهای دریافتی.',
  'Compare two people across every trait and pick a winner per dimension.':
    'دو نفر را در همه ویژگی‌ها مقایسه کن و در هر بُعد برنده را برگزین.',
  'Generate 6 new orthogonal traits for a domain.': 'برای یک حوزه، ۶ ویژگی تازه و ناهم‌پوشان بساز.',
  'Neutral brief for a contested score.': 'گزارش بی‌طرف برای یک امتیاز مناقشه‌برانگیز.',
  'The group disagrees here. What should the reviewer ask?':
    'گروه اینجا اختلاف دارد. بازبین باید چه بپرسد؟',
  'Coverage': 'پوشش',
  'Statistics': 'آمار',
  'Correlation': 'همبستگی',
  'Embedding': 'جای‌گذاری',
  'Structure': 'ساختار',
  'Map': 'نقشه',
  'Heatmap': 'نقشه گرمایی',
  'Treemap': 'درخت‌نما',
  'Radar': 'رادار',
  'Bars': 'ستونی',
  'Scatter': 'پراکندگی',
  'Distribution': 'توزیع',
  'Gini': 'جینی',
  'Std dev': 'انحراف معیار',
  'sd': 'انحراف',
  'pts': 'امتیاز',
  'Table': 'جدول',
  'Download CSV': 'دریافت CSV',

  // ------------------------------------------------------------------ compare
  'Comparison needs at least two people in the cube.': 'مقایسه دست‌کم دو نفر در مکعب می‌خواهد.',
  'A→B vs B→A': 'الف←ب در برابر ب←الف',
  'Pick two': 'دو نفر برگزینید',
  'Head to head': 'رو‌در‌رو',
  'Difference': 'اختلاف',
  'Verdict': 'داوری',
  'Judge this pair': 'داوری این جفت',
  'Trait by trait': 'ویژگی به ویژگی',
  'Reciprocity gap': 'شکاف دوسویه',
  'neither': 'هیچ‌کدام',

  // ---------------------------------------------------------------------- lab
  'OpenRouter': 'OpenRouter',
  'Key': 'کلید',
  'API key': 'کلید API',
  'Free models': 'مدل‌های رایگان',
  'Model': 'مدل',
  'Models': 'مدل‌ها',
  'Reasoning': 'استدلال',
  'Reasoning effort': 'توان استدلال',
  'Temperature': 'دما',
  'Max tokens': 'بیشترین توکن',
  'System': 'سیستم',
  'System prompt': 'دستور سیستمی',
  'Context': 'زمینه',
  'Inspector': 'بازرس',
  'Chat': 'گفت‌وگو',
  'Send': 'ارسال',
  'Stop': 'توقف',
  'Clear thread?': 'گفت‌وگو پاک شود؟',
  'New thread': 'گفت‌وگوی تازه',
  'Agents': 'عامل‌ها',
  'Agent': 'عامل',
  'Prompt': 'دستور',
  'Run': 'اجرا',
  'Running': 'در حال اجرا',
  'Reasoning tokens': 'توکن‌های استدلال',
  'Latency': 'تأخیر',
  'Stored in this browser only (localStorage). Requests go directly from this tab to openrouter.ai — there is no proxy in between.':
    'فقط در همین مرورگر ذخیره می‌شود (localStorage). درخواست‌ها مستقیم از همین زبانه به openrouter.ai می‌روند — هیچ واسطه‌ای نیست.',
  'Set an OpenRouter key to run free models. Until then a local analyst answers.':
    'برای اجرای مدل‌های رایگان، کلید OpenRouter بگذارید. تا آن زمان یک تحلیلگر محلی پاسخ می‌دهد.',
  'No key — using the offline analyst': 'بدون کلید — تحلیلگر برون‌خط',
  'Offline analyst used — add a key in AI Lab for real models':
    'تحلیلگر برون‌خط به کار رفت — برای مدل‌های واقعی در آزمایشگاه هوش کلید بگذارید',
  'Add an OpenRouter key in AI Lab to run a real model. This is the offline analyst.':
    'برای اجرای مدل واقعی، در آزمایشگاه هوش کلید OpenRouter بگذارید. اینجا تحلیلگر برون‌خط است.',
  'Add an OpenRouter key in AI Lab to switch the AI on.':
    'برای روشن‌کردن هوش مصنوعی، در آزمایشگاه هوش کلید OpenRouter بگذارید.',
  'Model returned no JSON.': 'مدل هیچ JSONی برنگرداند.',
  'Ask the cube anything. Shift+Enter for a new line.':
    'هر چیزی از مکعب بپرسید. Shift+Enter برای خط تازه.',
  'You are the analyst inside TRIAD, a 3D scoring matrix. Be concise, numeric and specific. Never invent people or traits that are not in the supplied data.':
    'تو تحلیلگر درون تریاد هستی، یک ماتریس امتیازدهی سه‌بعدی. کوتاه، عددی و دقیق باش. هرگز افراد یا ویژگی‌هایی که در داده‌های داده‌شده نیستند نساز.',
  'What does a high score mean?': 'امتیاز بالا چه معنایی دارد؟',
  'No models loaded': 'مدلی بارگذاری نشد',
  'Free': 'رایگان',
  'filtered': 'پالایش‌شده',
  'Context window': 'پنجره زمینه',
  'Sync models': 'همگام‌سازی مدل‌ها',

  // ----------------------------------------------------------------- settings
  'Interface': 'ظاهر',
  'Data': 'داده',
  'About': 'درباره',
  'Accent': 'رنگ تأکید',
  'Density': 'چیدمان',
  'Motion': 'حرکت',
  'Full': 'کامل',
  'Reduced': 'کاهش‌یافته',
  'Grain': 'دانه',
  'Ambient audio': 'صدای محیطی',
  'A quiet evolving drone under everything.': 'یک صدای آرام و پیوسته زیر همه چیز.',
  'Animated noise texture over the whole app.': 'بافت نویز متحرک روی همه برنامه.',
  'Slow drifting aurora blobs behind the shell.': 'لکه‌های شفقِ آرام و شناور در پس‌زمینه.',
  'Sound (S)': 'صدا (S)',
  'Haptics (H)': 'لرزش (H)',
  'Sound & haptics': 'صدا و لرزش',
  'Sound, haptics, data': 'صدا، لرزش، داده',
  'Synthesised with WebAudio — two glasses touching, whooshes, chimes.':
    'با WebAudio ساخته می‌شود — برخورد دو لیوان، وزش، زنگ.',
  'Uses the device vibration motor where the browser exposes it.':
    'از موتور لرزش دستگاه استفاده می‌کند، جایی که مرورگر اجازه دهد.',
  'Volume': 'بلندی صدا',
  'Soundboard': 'جعبه صدا',
  'Clear everything local?': 'همه داده‌های محلی پاک شوند؟',
  'Deletes the local cube, chat history and preferences in this browser.':
    'مکعب محلی، تاریخ گفت‌وگو و ترجیح‌ها را در این مرورگر پاک می‌کند.',
  'Local preferences stay on this device.': 'ترجیح‌های محلی روی همین دستگاه می‌مانند.',
  'Local chat history only — runs already logged stay in the database.':
    'فقط تاریخ گفت‌وگوی محلی — اجراهای ثبت‌شده در پایگاه داده می‌مانند.',
  'Local mode only. This replaces people, traits and scores in this browser.':
    'فقط حالت محلی. افراد، ویژگی‌ها و امتیازها را در این مرورگر جایگزین می‌کند.',
  'Rebuild demo cube?': 'مکعب نمونه بازسازی شود؟',
  'Push local → cloud': 'فرستادن محلی ← ابر',
  'Pull cloud → local': 'آوردن ابر ← محلی',
  'Database console': 'کنسول پایگاه داده',
  'Run schema.sql in the Supabase SQL editor for this project, then seed.sql for demo data. The anon key cannot create tables — that is a deliberate Postgres permission.':
    'برای این پروژه، schema.sql را در ویرایشگر SQL سوپابیس اجرا کنید، سپس seed.sql برای داده نمونه. کلید anon نمی‌تواند جدول بسازد — این یک محدودیت عمدی پستگرس است.',
  'Cloud tables missing — run the schema first': 'جدول‌های ابری نیستند — نخست طرح را اجرا کنید',
  'Cloud unreachable — local cube loaded': 'ابر در دسترس نیست — مکعب محلی بار شد',
  'SQL': 'SQL',
  'Schema': 'طرح',
  'Seed': 'داده نمونه',
  'Rows': 'سطرها',
  'Storage': 'فضای ذخیره',
  'Keyboard': 'صفحه‌کلید',
  'Shortcuts (?)': 'میان‌برها (?)',
  'Shortcuts': 'میان‌برها',
  'Toggle inspector (D)': 'باز و بسته کردن بازرس (D)',
  'Undo (U)': 'واگرد (U)',
  'Flat grid (G)': 'شبکه تخت (G)',
  'Haptics': 'لرزش',
  'Version': 'نسخه',
  'Built with': 'ساخته‌شده با',
  'Vanilla JS': 'جاوااسکریپت خالص',
  'No build step': 'بدون مرحله ساخت',
  'Export everything': 'خروجی همه چیز',
  'Reset preferences': 'بازنشانی ترجیح‌ها',
  'Reset everything': 'بازنشانی همه چیز',

  // ------------------------------------------------------------ boot / status
  'allocating cube': 'تخصیص مکعب',
  'indexing people': 'نمایه‌سازی افراد',
  'resolving traits': 'استخراج ویژگی‌ها',
  'binding matrix': 'اتصال ماتریس',
  'wiring audio': 'سیم‌کشی صدا',
  'ready': 'آماده',
  'Local cube active': 'مکعب محلی فعال است',
  'Cloud cube connected': 'مکعب ابری متصل شد',
  'You are working offline-first. Run the SQL from Settings → Console to move into Supabase.':
    'شما برون‌خط‌محور کار می‌کنید. برای رفتن به سوپابیس، SQL را از تنظیمات → کنسول اجرا کنید.',
  'Saved': 'ذخیره شد',
  'Changes saved': 'تغییرها ذخیره شد',
  'Removed': 'برداشته شد',
  'Added': 'افزوده شد',
  'Updated': 'به‌روز شد',
  'Something went wrong': 'چیزی اشتباه شد',
  'Writes need a session': 'نوشتن نیازمند نشست است',
  'Sign in to write to the shared cube.': 'برای نوشتن در مکعب مشترک وارد شوید.',
  'Unsaved changes': 'تغییرهای ذخیره‌نشده',
  'Select all': 'گزینش همه',
  'None': 'هیچ',
  'All': 'همه',
  'More': 'بیشتر',
  'Less': 'کمتر',
  'Show': 'نمایش',
  'Hide': 'پنهان',
  'Open': 'بازکردن',
  'Loading': 'بارگذاری',
  'Toggle': 'کلید',
  'On': 'روشن',
  'Off': 'خاموش',
  'Enabled': 'فعال',
  'Disabled': 'غیرفعال',

  // --------------------------------------------------------------- categories
  Character: 'منش',
  Execution: 'اجرا',
  Mind: 'ذهن',
  Social: 'اجتماعی',
  Leadership: 'رهبری',
  Craft: 'مهارت',
  Energy: 'انرژی',
  Risk: 'ریسک',

  // --------------------------------------------------------------- 24 demo traits
  Kindness: 'مهربانی',
  Integrity: 'درست‌کاری',
  Bravery: 'شجاعت',
  Reliability: 'قابل‌اعتماد بودن',
  Resilience: 'تاب‌آوری',
  Patience: 'شکیبایی',
  Humility: 'فروتنی',
  Generosity: 'بخشندگی',
  Loyalty: 'وفاداری',
  Honesty: 'صداقت',
  Fairness: 'انصاف',
  'Self-discipline': 'خودنظمی',
  Focus: 'تمرکز',
  Ambition: 'جاه‌طلبی',
  Rigor: 'دقت‌ورزی',
  Speed: 'سرعت',
  Prioritisation: 'اولویت‌بندی',
  'Follow-through': 'پیگیری تا پایان',
  Planning: 'برنامه‌ریزی',
  'Attention to detail': 'ریز‌بینی',
  Ownership: 'مسئولیت‌پذیری',
  Consistency: 'یکدستی',
  Leverage: 'اهرم‌سازی',

  // ------------------------------------------------------------- trait blurbs
  'Warmth offered without being asked.': 'گرمی‌ای که بی‌درخواست می‌رسد.',
  'Consistency between word and act.': 'هم‌خوانی گفتار و کردار.',
  'Acting despite the cost.': 'کوشیدن، هرچند پرهزینه.',
  'Promises kept when nobody is watching.': 'وعده‌هایی که بی‌شاهد هم نگه داشته می‌شوند.',
  'Returns to the work after the fall.': 'پس از افتادن، به کار بازمی‌گردد.',
  'Holds the long line without fraying.': 'مسیر بلند را بی‌آنکه از هم بگسلد نگه می‌دارد.',
  'Can be wrong out loud.': 'می‌تواند اشتباهش را بلند بگوید.',
  'Gives credit and time away.': 'اعتبار و وقتش را می‌بخشد.',
  'Stays when staying is expensive.': 'می‌ماند، حتی وقتی ماندن گران است.',
  'Default setting is the truth.': 'حالت پیش‌فرضش راست‌گویی است.',
  'Same rule for every person.': 'یک قاعده برای همه.',
  'Does the boring thing daily.': 'کار خسته‌کننده را هر روز می‌کند.',
  'Depth of attention under pressure.': 'عمق توجه زیر فشار.',
  'Pulls the horizon closer.': 'افق را نزدیک‌تر می‌کشد.',
  'Turns intent into finished.': 'قصد را به نتیجه می‌رساند.',
  'Checks the second decimal.': 'رقم اعشار دوم را هم بررسی می‌کند.',
  'Cycle time from idea to shipped.': 'زمان چرخه از ایده تا تحویل.',
  'Says no in the right direction.': 'در جهت درست «نه» می‌گوید.',
  'The last mile is the habit.': 'یک‌فرسنگ آخر، عادت اوست.',
  'Sequences the unsequenced.': 'بی‌ترتیب‌ها را مرتب می‌کند.',
  'Sees the seam before it splits.': 'درز را پیش از شکافتن می‌بیند.',
  'Takes the blast radius personally.': 'دامنه آسیب را مسئولیت خود می‌داند.',
  'Same quality on a bad Tuesday.': 'سه‌شنبه‌های بد هم همان کیفیت.',
  'Finds the 10x-shaped move.': 'حرکت ده‌برابری را پیدا می‌کند.',

  // ------------------------------------------------------------- demo people
  'Systems Architect': 'معمار سامانه',
  'Product Lead': 'سرپرست محصول',
  'Staff Engineer': 'مهندس ارشد',
  'Design Director': 'مدیر طراحی',
  'Data Scientist': 'دانشمند داده',
  'Engineering Manager': 'مدیر مهندسی',
  'Security Lead': 'سرپرست امنیت',
  'Research Engineer': 'مهندس پژوهش',
  'Growth Strategist': 'راهبرد رشد',
  'Operations Lead': 'سرپرست عملیات',
  'Staff Designer': 'طراح ارشد',
  'AI Engineer': 'مهندس هوش مصنوعی',
  Platform: 'پلتفرم',
  Product: 'محصول',
  Design: 'طراحی',
  Insights: 'بینش',
  Security: 'امنیت',
  Growth: 'رشد',
  Ops: 'عملیات',

  // ------------------------------------------------------------------ errors
  'OpenRouter returned': 'OpenRouter برگرداند',
  'Network error': 'خطای شبکه',
  'Request failed': 'درخواست ناموفق',
  'Aborted': 'لغو شد',
  'Rate limited': 'محدودیت نرخ',
  'Invalid key': 'کلید نامعتبر',
  'No key set': 'کلیدی تنظیم نشده',
  'Schema check': 'بررسی طرح',
  'Tables found': 'جدول‌ها یافت شد',
  'Tables missing': 'جدول‌ها موجود نیست',
  'not found': 'یافت نشد',
  'rows': 'سطر',
  'characters': 'نویسه',
  'tokens': 'توکن',
  'model': 'مدل',
  'reasoning': 'استدلال',
  'content': 'متن',
  'role': 'نقش',
  'streaming': 'جریان‌دهی',
  'offline': 'برون‌خط',

  // ------------------------------------------------------- shell / page chrome
  'Overview of the cube': 'نمای کلی مکعب',
  'Three slices of the cube': 'سه برش از مکعب',
  'Rapid scoring': 'امتیازدهی سریع',
  'rankers and targets': 'رتبه‌دهندگان و هدف‌ها',
  'Rankers and targets': 'رتبه‌دهندگان و هدف‌ها',
  'Dimensions of the cube': 'ابعاد مکعب',
  'Aggregates and outliers': 'تجمع‌ها و داده‌های پرت',
  'Models, prompts, verdicts': 'مدل‌ها، دستورها، داوری‌ها',
  'preferences and plumbing': 'ترجیح‌ها و زیرساخت',
  'TRIAD /// 3D MATRIX': 'تریاد /// ماتریس سه‌بعدی',
  'AI off': 'هوش خاموش',
  'AI ready': 'هوش آماده',
  'AI settings': 'تنظیمات هوش',
  Guest: 'مهمان',
  'local only': 'فقط محلی',
  idle: 'بی‌کار',
  'cube state': 'وضعیت مکعب',
  leader: 'پیشتاز',
  'most contested': 'بیشترین مناقشه',
  leaderboard: 'جدول پیشتازان',
  'composite leaderboard': 'جدول ترکیبی',
  'No data yet': 'هنوز داده‌ای نیست',
  'Start deck': 'آغاز دسته',
  'Open stacks': 'باز کردن پشته‌ها',
  'quick actions': 'کارهای سریع',
  'Nothing to rate': 'چیزی برای امتیاز دادن نیست',
  'All departments': 'همه دپارتمان‌ها',
  'No people match': 'هیچ فردی هم‌خوان نیست',
  Library: 'کتابخانه',
  Generate: 'ساختن',
  Dimensions: 'ابعاد',
  Rated: 'امتیازگرفته',
  'have at least one cell': 'دست‌کم یک خانه دارند',
  'Total weight': 'وزن کل',
  'composite influence': 'تأثیر در ترکیب',
  'Polarity flips': 'قطبیت معکوس',
  'cost dimensions': 'ابعاد هزینه',
  'aggregate layer': 'لایه تجمعی',
  Narrate: 'روایت',
  Dispersion: 'پراکندگی',
  'Contested pairs': 'جفت‌های مناقشه‌برانگیز',
  'Weighted composite ranking': 'رتبه‌بندی ترکیبی وزنی',
  'polarity-aware': 'با در نظر گرفتن قطبیت',
  'Trait-space embedding': 'جای‌گذاری در فضای ویژگی',
  'components': 'مؤلفه',
  'drag to orbit': 'برای چرخش بکشید',
  'wheel to zoom': 'اسکرول برای بزرگ‌نمایی',
  'Consensus heatmap': 'نقشه گرمایی هم‌سختی',
  'Ranker agreement': 'توافق رتبه‌دهندگان',
  'pearson r': 'ضریب پیرسون',
  opposed: 'مخالف',
  independent: 'مستقل',
  aligned: 'هم‌راستا',
  'Polarisation index': 'شاخص قطبی‌شدن',
  'Trait distributions': 'توزیع ویژگی‌ها',
  'Cube coverage': 'پوشش مکعب',
  filled: 'پر',
  dark: 'خالی',
  'Weight mass': 'جرم وزن',
  'area = weight × ratings collected': 'مساحت = وزن × امتیازهای گردآوری‌شده',
  'Full table': 'جدول کامل',
  alignment: 'هم‌راستایی',
  grade: 'نمره',
  composite: 'ترکیبی',
  received: 'دریافت‌شده',
  given: 'داده‌شده',
  polarisation: 'قطبی‌شدن',
  'click a row to open the person': 'برای دیدن فرد روی سطر کلیک کنید',
  'Need two people': 'دو نفر لازم است',
  'reasoning · free models': 'استدلال · مدل‌های رایگان',
  'Set key': 'گذاشتن کلید',
  missing: 'موجود نیست',
  'stored in this browser only': 'فقط در همین مرورگر ذخیره شده',
  'Active model': 'مدل فعال',
  'Free Models Router': 'مسیریاب مدل‌های رایگان',
  'zero-cost only': 'فقط بدون هزینه',
  'Cube analyst': 'تحلیلگر مکعب',
  'no key': 'بدون کلید',
  'Ask the cube': 'از مکعب بپرس',
  'The assistant receives a compact statistical summary of the matrix, never raw personal notes.':
    'دستیار فقط یک خلاصه آماری فشرده از ماتریس می‌گیرد، هرگز یادداشت‌های شخصی خام را نه.',
  'Biggest conflict': 'بزرگ‌ترین ناسازگاری',
  'Weak signal': 'سیگنال ضعیف',
  'Next 10 cards': '۱۰ کارت بعدی',
  'Write the brief': 'نوشتن گزارش',
  Params: 'پارامترها',
  'Consensus auditor': 'بازرس هم‌سختی',
  'Insight narrator': 'روایتگر بینش',
  'Trait designer': 'طراح ویژگی',
  'Person profiler': 'نمایه‌ساز فرد',
  'Anomaly hunter': 'شکارچی ناهنجاری',
  'Deck planner': 'برنامه‌ریز دسته',
  'Dispute brief': 'گزارش مناقشه',
  'Head-to-head judge': 'داور رو‌در‌رو',
  Change: 'تغییر',
  'max out': 'تا سقف',
  stream: 'جریان',
  'context sent': 'زمینه ارسالی',
  Inspect: 'بازرسی',
  'Reset prefs': 'بازنشانی ترجیح‌ها',
  'Drives every highlight, chart and glow.': 'همه برجستگی‌ها، نمودارها و درخشش‌ها را می‌راند.',
  'Ambient background': 'پس‌زمینه محیطی',
  'Film grain': 'دانه فیلم',
  'Stack inertia': 'لَختی پشته',
  'How much air the layout gets.': 'میزان فضای خالی چیدمان.',
  Compact: 'فشرده',
  Normal: 'معمولی',
  Roomy: 'فراخ',
  'Reduced disables the 3D springs and particles.':
    'حالت کاهش‌یافته فنرهای سه‌بعدی و ذره‌ها را خاموش می‌کند.',
  'Heat metric': 'سنجه گرما',
  'What cell colour encodes.': 'رنگ خانه چه چیزی را نشان می‌دهد.',
  'Stack depth': 'عمق پشته',
  'Layers rendered in 3D before the rest fold away.':
    'تعداد لایه‌هایی که سه‌بعدی رندر می‌شوند؛ بقیه جمع می‌شوند.',
  'Interface sound': 'صدای رابط',
  Vibration: 'لرزش',
  'Ambient pad': 'پد محیطی',
  'Two glasses': 'دو لیوان',
  Milestone: 'نقطه عطف',
  Console: 'کنسول',
  'Local mode keeps everything in this browser. Cloud mode reads and writes Supabase.':
    'حالت محلی همه چیز را در همین مرورگر نگه می‌دارد. حالت ابری از سوپابیس می‌خواند و در آن می‌نویسد.',
  'Re-check schema': 'بررسی دوباره طرح',
  'Setup SQL': 'SQL راه‌اندازی',
  'Export JSON': 'خروجی JSON',
  'Import JSON': 'ورود JSON',
  'Local size': 'حجم محلی',
  'Demo cube': 'مکعب نمونه',
  'Clear local': 'پاک‌کردن محلی',
  'Open lab': 'باز کردن آزمایشگاه',
  Manage: 'مدیریت',
  'Send context': 'فرستادن زمینه',
  'Prompts include an aggregate summary (people, traits, means, spread). Notes are never sent.':
    'دستورها یک خلاصه تجمعی می‌فرستند (افراد، ویژگی‌ها، میانگین‌ها، پراکندگی). یادداشت‌ها هرگز فرستاده نمی‌شوند.',
  build: 'ساخت',
  'cube fill': 'پرشدگی مکعب',
  'last save': 'آخرین ذخیره',
  'Local-first. Writes go to the cloud only when a session exists and the source is cloud.':
    'محلی‌محور. نوشتن در ابر تنها وقتی نشست وجود دارد و منبع ابری باشد انجام می‌شود.',
  'No one to rate': 'کسی برای امتیاز دادن نیست',

  // --------------------------------------------------------------- soundboard
  glass: 'لیوان',
  glassSoft: 'لیوان نرم',
  clink2: 'برخورد دو لیوان',
  pop: 'ترکیدن',
  tick: 'تیک',
  chime: 'زنگ',
  whoosh: 'وزش',
  whooshBack: 'وزش بازگشت',
  thud: 'ضربه',
  riser: 'اوج',
  sparkle: 'جرقه',
  success: 'موفقیت',
  drop: 'چکه',
  type: 'تایپ',
  navigate: 'جابه‌جایی',
  release: 'رهاسازی',
  milestone: 'نقطه عطف',
  soundboard: 'جعبه صدا',
  fill: 'پرشدگی',
  Work: 'اجرا',
  General: 'عمومی',
  inverted: 'معکوس',
  Error: 'خطا',
  'no key stored': 'کلیدی ذخیره نشده',
  'AI is offline': 'هوش برون‌خط است',
  'top · —': 'برتر · —',

  Curiosity: 'کنجکاوی',
  Humor: 'شوخ‌طبعی',
  Empathy: 'همدلی',
  Candor: 'صراحت لهجه',
  Taste: 'سلیقه',
  Presence: 'حضور',

  // ------------------------------------------------------------ full library
  Listening: 'شنیدن',
  Warmth: 'گرم‌خویی',
  Diplomacy: 'دیپلماسی',
  Network: 'شبکه‌سازی',
  'Conflict handling': 'مدیریت تعارض',
  Charisma: 'جذبه',
  Trustworthiness: 'قابل‌اعتمادی',
  Mentorship: 'راهنمایی',
  Clarity: 'روشنی',
  Creativity: 'خلاقیت',
  'Systems thinking': 'تفکر سیستمی',
  Recall: 'یادآوری',
  'Learning rate': 'سرعت یادگیری',
  Abstraction: 'انتزاع',
  Judgement: 'داوری',
  Numeracy: 'عدد‌فهمی',
  Writing: 'نوشتن',
  Attention: 'توجه',
  Vision: 'چشم‌انداز',
  Decisiveness: 'قاطعیت',
  Delegation: 'تفویض',
  Coaching: 'مربی‌گری',
  Accountability: 'پاسخ‌گویی',
  Strategy: 'راهبرد',
  Inspiration: 'الهام‌بخشی',
  'Organisational savvy': 'زیرکی سازمانی',
  'Hiring bar': 'سطح استخدام',
  'Crisis command': 'فرماندهی بحران',
  'Code quality': 'کیفیت کد',
  'Design sense': 'حس طراحی',
  Debugging: 'اشکال‌زدایی',
  Architecture: 'معماری',
  Shipping: 'تحویل',
  'Testing instinct': 'غریزه تست',
  'Performance craft': 'مهارت کارایی',
  Documentation: 'مستندسازی',
  Tooling: 'ابزارسازی',
  Aesthetics: 'زیبایی‌شناسی',
  Stamina: 'توان',
  Optimism: 'خوش‌بینی',
  Calm: 'آرامش',
  Playfulness: 'بازیگوشی',
  Intensity: 'شدت',
  Adaptability: 'سازگاری',
  Independence: 'استقلال',
  Collaboration: 'همکاری',
  Momentum: 'تکانه',
  'Sustainable pace': 'روند پایدار',
  'Risk appetite': 'ریسک‌پذیری',
  Compliance: 'انطباق',
  Foresight: 'پیش‌بینی',
  Thoroughness: 'همه‌جانبه‌نگری',
  Bluntness: 'صراحت',
  'Burnout risk': 'خطر فرسودگی',
  Volatility: 'نوسان',
  'Ego drag': 'بار خودبینی',

  // --------------------------------------------------------- library blurbs
  'Hears the second sentence.': 'جمله دوم را می‌شنود.',
  'Makes strangers feel briefed.': 'غریبه را آگاه و راحت می‌کند.',
  'Keeps the channel open.': 'کانال گفت‌وگو را باز نگه می‌دارد.',
  'Knows who to ask.': 'می‌داند از چه کسی بپرسد.',
  'Walks into the hard conversation.': 'به گفت‌وگوی سخت قدم می‌گذارد.',
  'Gravity, not volume.': 'جاذبه، نه بلندی صدا.',
  'Safe to hand the fragile thing to.': 'می‌توان چیز شکننده را به او سپرد.',
  'Grows other people on purpose.': 'دیگران را عمداً می‌پرورد.',
  'Makes the future feel inevitable.': 'آینده را ناگزیر جلوه می‌دهد.',
  'Ends the meeting with a call.': 'جلسه را با یک تصمیم تمام می‌کند.',
  'Hands over the whole problem.': 'کل مسئله را واگذار می‌کند.',
  'Asks the question that unblocks.': 'پرسشی می‌پرسد که گره را باز می‌کند.',
  'Absorbs blame, routes credit.': 'سرزنش را می‌پذیرد، اعتبار را می‌فرستد.',
  'Wins the position, not the exchange.': 'موقعیت را می‌برد، نه تاخت‌وتاز را.',
  'Makes the work feel worth it.': 'کار را ارزشمند جلوه می‌دهد.',
  'Moves through the org without friction.': 'بی‌اصطکاک در سازمان حرکت می‌کند.',
  'Raises the average by adding.': 'با افزودن، میانگین را بالا می‌برد.',
  'Calm is the first deliverable.': 'آرامش، نخستین تحویل‌دادنی است.',
  'Leaves the file better than found.': 'فایل را بهتر از آنچه یافت ترک می‌کند.',
  'Feels the misalignment at 2px.': 'ناهم‌ترازی دو پیکسلی را حس می‌کند.',
  'Bisects reality until it confesses.': 'واقعیت را دونیم می‌کند تا اعتراف کند.',
  'Designs for the change that has not happened.': 'برای تغییری که رخ نداده طراحی می‌کند.',
  'Deletes the last blocker personally.': 'آخرین مانع را خودش برمی‌دارد.',
  'Knows which failure is expensive.': 'می‌داند کدام شکست گران است.',
  'Measures before believing.': 'پیش از باور، اندازه می‌گیرد.',
  'Writes for the person at 3am.': 'برای کسی که سه‌بامداد می‌خواند می‌نویسد.',
  'Removes friction from everyone.': 'اصطکاک را از سر راه همه برمی‌دارد.',
  'Makes correctness look inevitable.': 'درستی را ناگزیر جلوه می‌دهد.',
  'Same engine on hour nine.': 'ساعت نهم هم همان موتور.',
  'Prices the upside honestly.': 'روی مثبت را صادقانه قیمت می‌زند.',
  'Low variance under load.': 'پراکندگی کم زیر بار.',
  'Finds the game inside the task.': 'بازی را درون کار پیدا می‌کند.',
  'High output, high temperature.': 'بازده بالا، حرارت بالا.',
  'Re-plans without mourning.': 'بی‌سوگ بازبرنامه‌ریزی می‌کند.',
  'Needs no tailwind.': 'به باد پشتی نیاز ندارد.',
  'Multiplies through others.': 'از راه دیگران چندبرابر می‌شود.',
  'Leaves the room moving.': 'اتاق را در حرکت ترک می‌کند.',
  'Fast without burning the engine.': 'سریع، بی‌آنکه موتور را بسوزاند.',
  'Comfortable with unresolved outcomes.': 'با نتیجه‌های نامعلوم راحت است.',
  'Respects the boundary on purpose.': 'مرز را عمداً رعایت می‌کند.',
  'Warns early enough to matter.': 'به‌اندازه‌ای زود هشدار می‌دهد که مهم باشد.',
  'Checks the edge nobody tested.': 'لبه‌ای را بررسی می‌کند که کسی نیازموده.',
  'Costs something to say, says it anyway.': 'گفتنش هزینه دارد، باز می‌گوید.',
  'Higher is a warning, not a virtue.': 'بالاتر یعنی هشدار، نه فضیلت.',
  'Output swings without a schedule.': 'بازده بی‌برنامه بالا و پایین می‌رود.',
  'Cost others pay to work around it.': 'هزینه‌ای که دیگران برای دور زدنش می‌دهند.',
  'Finds the angle nobody else sees.': 'زاویه‌ای را می‌بیند که کسی نمی‌بیند.',
  'Reads the room before the room speaks.': 'اتاق را پیش از سخن‌گفتنش می‌خواند.',
  'Says the true thing, gently.': 'حقیقت را نرم می‌گوید.',
  'Changes the temperature of a room.': 'دمای اتاق را عوض می‌کند.',
  'Recognises the difference that matters.': 'تفاوتِ مهم را تشخیص می‌دهد.',
  'Questions more than answers.': 'بیشتر می‌پرسد تا پاسخ دهد.',
};

/* ----------------------------------------------------------------- patterns */
// dynamic strings: numbers, names, plural forms
const PATTERNS = [
  [/^(\d+)\s+traits installed$/i, (m, n) => `${n} ویژگی نصب شد`],
  [/^(\d+)\s+people$/i, (m, n) => `${n} نفر`],
  [/^(\d+)\s+traits$/i, (m, n) => `${n} ویژگی`],
  [/^(\d+)\s+scores?$/i, (m, n) => `${n} امتیاز`],
  [/^(\d+)\s+cells?$/i, (m, n) => `${n} خانه`],
  [/^(\d+)\s+rows?$/i, (m, n) => `${n} سطر`],
  [/^(\d+)\s+cards? left$/i, (m, n) => `${n} کارت مانده`],
  [/^(\d+)\s+of\s+(\d+)$/i, (m, a, b) => `${a} از ${b}`],
  [/^sd\s+(.+)$/i, (m, v) => `انحراف ${v}`],
  [/^(\d+)\s*\/\s*(\d+)$/i, (m, a, b) => `${a} / ${b}`],
  [/^(.+)\s+failed$/i, (m, what) => `${translateStatic(what)} ناموفق`],
  [/^(.+)\s+saved$/i, (m, what) => `${translateStatic(what)} ذخیره شد`],
  [/^(.+)\s+removed$/i, (m, what) => `${translateStatic(what)} برداشته شد`],
  [/^(.+)\s+added$/i, (m, what) => `${translateStatic(what)} افزوده شد`],
  [/^Failed:\s*(.+)$/i, (m, why) => `ناموفق: ${why}`],
  [/^(\d+)\s+categories$/i, (m, n) => `${n} دسته`],
  [/^(\d+)\s+selected of\s+(\d+)\s+available$/i, (m, a, b) => `${a} گزیده از ${b} موجود`],
  [/^(\d+)\s+models$/i, (m, n) => `${n} مدل`],
  [/^(\d+)\s+components$/i, (m, n) => `${n} مؤلفه`],
  [/^of\s+([\d,]+)\s+possible$/i, (m, n) => `از ${n} ممکن`],
  [/^median\s+([\d.]+)$/i, (m, v) => `میانه ${v}`],
  [/^range\s+([\d.]+)$/i, (m, v) => `دامنه ${v}`],
  [/^filled:?\s+([\d.]+)%$/i, (m, v) => `پر: ${v}٪`],
  [/^dark:?\s+([\d.]+)%$/i, (m, v) => `خالی: ${v}٪`],
  [/^([\d,]+)\s+of\s+([\d,]+)\s+cells$/i, (m, a, b) => `${a} از ${b} خانه`],
  [/^temp\s+([\d.]+)$/i, (m, v) => `دما ${v}`],
  [/^(\d+)\s+people ·\s+(\d+)\s+traits ·\s+(\d+)\s+cells · fill\s+(\d+)%$/i, (m, p, t, c, f) => `${p} نفر · ${t} ویژگی · ${c} خانه · پرشدگی ${f}٪`],
  [/^(\S+)\s*·\s*×([\d.]+)$/, (m, cat, w) => `${translateStatic(cat.charAt(0).toUpperCase() + cat.slice(1))} · ×${w}`],
  [/^(\S+)\s*·\s*×([\d.]+)\s*·\s*inverted$/i, (m, cat, w) => `${translateStatic(cat.charAt(0).toUpperCase() + cat.slice(1))} · ×${w} · معکوس`],
  [/^sd\s*>\s*([\d.]+)$/i, (m, v) => `انحراف > ${v}`],
];

const LOWER = new Map(Object.entries(PHRASES).map(([k, v]) => [k.toLowerCase(), v]));

export function translateStatic(text) {
  if (!text) return text;
  const exact = PHRASES[text];
  if (exact) return exact;
  const lower = LOWER.get(text.toLowerCase());
  if (lower) return lower;
  for (const [re, fn] of PATTERNS) {
    const m = re.exec(text);
    if (m) return fn(...m);
  }
  return text;
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'SVG', 'CANVAS', 'NOSCRIPT', 'KBD']);
const SKIP_CLASS = /(^|\s)(mono|no-i18n|code-block__code|latin)(\s|$)/;

function skipped(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  if (!el) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.closest('.no-i18n, .mono, code, pre, .code-block')) return true;
  return false;
}

export function translateTextValue(raw) {
  if (typeof raw !== 'string' || !/[A-Za-z]/.test(raw)) return null;
  const core = raw.replace(/\s+/g, ' ').trim();
  if (!core) return null;
  let out = null;
  if (PHRASES[core]) out = PHRASES[core];
  else {
    const lower = LOWER.get(core.toLowerCase());
    if (lower) out = lower;
    else {
      for (const [re, fn] of PATTERNS) {
        const m = re.exec(core);
        if (m) { out = fn(...m); break; }
      }
    }
  }
  if (!out || out === core) return null;
  const lead = raw.match(/^\s*/)[0];
  const trail = raw.match(/\s*$/)[0];
  return lead + out + trail;
}

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const done = new WeakSet();

function translateNode(node) {
  if (!node || skipped(node)) return;
  if (node.nodeType === 3) {
    if (done.has(node)) return;
    const next = translateTextValue(node.nodeValue);
    if (next && next !== node.nodeValue) {
      node.nodeValue = next;
      done.add(node);
    }
    return;
  }
  if (node.nodeType !== 1) return;
  for (const attr of ATTRS) {
    const val = node.getAttribute?.(attr);
    if (!val) continue;
    const next = translateTextValue(val);
    if (next && next !== val) node.setAttribute(attr, next);
  }
  if (node.tagName === 'INPUT' && node.type === 'submit') {
    const next = translateTextValue(node.value);
    if (next) node.value = next;
  }
  for (const child of node.childNodes) translateNode(child);
}

let observer = null;
let queue = new Set();
let scheduled = false;

function flush() {
  scheduled = false;
  const nodes = queue;
  queue = new Set();
  for (const n of nodes) translateNode(n);
}

function enqueue(node) {
  queue.add(node);
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(flush);
}

export function translateTree(root = document.body) {
  translateNode(root);
}

export function startTranslator() {
  document.documentElement.lang = LANG;
  document.documentElement.dir = DIR;
  translateTree(document.body);
  if (observer) observer.disconnect();
  observer = new MutationObserver((records) => {
    for (const rec of records) {
      if (rec.type === 'characterData') enqueue(rec.target);
      else if (rec.type === 'attributes') enqueue(rec.target);
      else for (const n of rec.addedNodes) enqueue(n);
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS
  });
  return observer;
}

export function stopTranslator() {
  observer?.disconnect();
  observer = null;
}
