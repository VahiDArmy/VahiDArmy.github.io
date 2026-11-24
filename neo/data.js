/* ==========================================================================
   Raw data transcribed from the two printed sheets (NEO-PI-R, Persian long form)
   Sheet 1 = score table + validity / control tables
   Sheet 2 = printed profile chart (T-scale)
   Nothing here is computed; it is transcribed as printed, with the few
   ambiguous cells marked in `notes`.
   ========================================================================== */

const REPORT = {
  meta: [
    { k: "نام", v: "میر وحید" },
    { k: "نام خانوادگی", v: "ارامیان" },
    { k: "شناسه شخص", v: "87" },
    { k: "شناسه گروه", v: "23" },
    { k: "سن", v: "34" },
    { k: "جنسیت", v: "مذکر" },
    { k: "تحصیلات", v: "فوق لیسانس" },
    { k: "شغل", v: "کارمند" },
    { k: "تاهل", v: "مجرد" },
    { k: "تاریخ اجرا", v: "1404/07/27" },
    { k: "محل اجرا", v: "وارش فارغ" },
    { k: "آزمونگر", v: "—" }
  ],

  /* Main scales: raw score + the interpretation printed on the sheet */
  domains: [
    { code: "N", name: "روان‌رنجوری", en: "Neuroticism", score: 120, label: "خیلی بالا" },
    { code: "E", name: "برون‌گرایی", en: "Extraversion", score: 55, label: "خیلی پایین" },
    { code: "O", name: "انعطاف‌پذیری", en: "Openness", score: 133, label: "خیلی بالا" },
    { code: "A", name: "دلپذیری", en: "Agreeableness", score: 121, label: "خیلی بالا" },
    { code: "C", name: "با وجدان بودن", en: "Conscientiousness", score: 103, label: "متوسط" }
  ],

  /* 30 facets: raw score + printed interpretation */
  facets: [
    { code: "N1", dom: "N", name: "اضطراب", en: "Anxiety", score: 21, label: "خیلی بالا" },
    { code: "N2", dom: "N", name: "پرخاشگری", en: "Angry hostility", score: 16, label: "بالا" },
    { code: "N3", dom: "N", name: "افسردگی", en: "Depression", score: 20, label: "بالا" },
    { code: "N4", dom: "N", name: "کمرویی", en: "Self-consciousness", score: 23, label: "خیلی بالا" },
    { code: "N5", dom: "N", name: "شتاب‌زدگی", en: "Impulsiveness", score: 20, label: "خیلی بالا" },
    { code: "N6", dom: "N", name: "آسیب‌پذیری", en: "Vulnerability", score: 20, label: "خیلی بالا" },

    { code: "E1", dom: "E", name: "گرمی", en: "Warmth", score: 12, label: "خیلی پایین" },
    { code: "E2", dom: "E", name: "گروه‌گرایی", en: "Gregariousness", score: 4, label: "خیلی پایین" },
    { code: "E3", dom: "E", name: "قاطعیت", en: "Assertiveness", score: 4, label: "خیلی پایین" },
    { code: "E4", dom: "E", name: "فعالیت", en: "Activity", score: 7, label: "خیلی پایین" },
    { code: "E5", dom: "E", name: "هیجان‌خواهی", en: "Excitement seeking", score: 13, label: "خیلی پایین" },
    { code: "E6", dom: "E", name: "هیجان‌های مثبت", en: "Positive emotions", score: 15, label: "پایین" },

    { code: "O1", dom: "O", name: "تحمل", en: "Fantasy / imagination", score: 19, label: "بالا" },
    { code: "O2", dom: "O", name: "زیباپسندی", en: "Aesthetics", score: 26, label: "خیلی بالا" },
    { code: "O3", dom: "O", name: "احساسات", en: "Feelings", score: 23, label: "خیلی بالا" },
    { code: "O4", dom: "O", name: "اعمال", en: "Actions", score: 9, label: "خیلی پایین" },
    { code: "O5", dom: "O", name: "عقاید", en: "Ideas", score: 28, label: "خیلی بالا" },
    { code: "O6", dom: "O", name: "ارزش‌ها", en: "Values", score: 28, label: "خیلی بالا" },

    { code: "A1", dom: "A", name: "اعتماد", en: "Trust", score: 17, label: "پایین" },
    { code: "A2", dom: "A", name: "رک‌گویی", en: "Straightforwardness", score: 27, label: "خیلی بالا" },
    { code: "A3", dom: "A", name: "نوع‌دوستی", en: "Altruism", score: 21, label: "پایین" },
    { code: "A4", dom: "A", name: "همراهی", en: "Compliance", score: 14, label: "پایین" },
    { code: "A5", dom: "A", name: "تواضع", en: "Modesty", score: 23, label: "خیلی بالا" },
    { code: "A6", dom: "A", name: "دل‌رحم بودن", en: "Tender-mindedness", score: 18, label: "خیلی پایین" },

    { code: "C1", dom: "C", name: "کفایت", en: "Competence", score: 25, label: "خیلی بالا" },
    { code: "C2", dom: "C", name: "نظم و ترتیب", en: "Order", score: 9, label: "خیلی پایین" },
    { code: "C3", dom: "C", name: "وظیفه‌شناسی", en: "Dutifulness", score: 29, label: "خیلی بالا" },
    { code: "C4", dom: "C", name: "توفیق‌گرایی", en: "Achievement striving", score: 10, label: "خیلی پایین" },
    { code: "C5", dom: "C", name: "خودکنترلی", en: "Self-discipline", score: 11, label: "خیلی پایین" },
    { code: "C6", dom: "C", name: "محتاط بودن", en: "Deliberation", score: 19, label: "متوسط" }
  ],

  /* Control / validity block, printed on the lower right of sheet 1 */
  validity: {
    extra: [
      { q: "الف", a: "کاملا موافقم", i: "معتبر" },
      { q: "ب", a: "بلی", i: "معتبر" },
      { q: "ج", a: "بلی", i: "معتبر" }
    ],
    counts: [
      { a: "نظری ندارم", n: 0, i: "معتبر" },
      { a: "موافق", n: 137, i: "معتبر" },
      { a: "مخالف", n: 103, i: "معتبر" }
    ],
    random: [
      { a: "کاملا مخالفم", i: "معتبر" },
      { a: "مخالفم", i: "معتبر" },
      { a: "نظری ندارم", i: "معتبر" },
      { a: "موافقم", i: "معتبر" },
      { a: "کاملا موافقم", i: "معتبر" }
    ]
  },

  /* The block labelled «نظریه» on sheet 1: same item scores, a second
     (theoretical) interpretation key, which disagrees with the first one
     for A and C. Transcribed as printed. */
  theory: [
    { code: "A", name: "دلپذیر بودن", score: 121, label: "متوسط" },
    { code: "C", name: "با وجدان بودن", score: 103, label: "پایین" }
  ],

  /* Sheet 2: the printed T-score profile. Exact numbers are not printed on
     the sheet, so these are readings off the chart grid (±3 points). */
  profile: [
    { code: "N", value: 78 }, { code: "E", value: 22 }, { code: "O", value: 80 },
    { code: "A", value: 57 }, { code: "C", value: 82 },
    { code: "N1", value: 76 }, { code: "N2", value: 64 }, { code: "N3", value: 70 },
    { code: "N4", value: 79 }, { code: "N5", value: 72 }, { code: "N6", value: 73 },
    { code: "E1", value: 30 }, { code: "E2", value: 20 }, { code: "E3", value: 20 },
    { code: "E4", value: 26 }, { code: "E5", value: 33 }, { code: "E6", value: 36 },
    { code: "O1", value: 62 }, { code: "O2", value: 77 }, { code: "O3", value: 72 },
    { code: "O4", value: 29 }, { code: "O5", value: 81 }, { code: "O6", value: 81 },
    { code: "A1", value: 41 }, { code: "A2", value: 77 }, { code: "A3", value: 45 },
    { code: "A4", value: 34 }, { code: "A5", value: 73 }, { code: "A6", value: 37 },
    { code: "C1", value: 74 }, { code: "C2", value: 30 }, { code: "C3", value: 81 },
    { code: "C4", value: 33 }, { code: "C5", value: 34 }, { code: "C6", value: 55 }
  ],

  notes: [
    "Sheet 1, facet O1 is printed as «تحمل»; in NEO-PI-R the O1 facet is fantasy/imagination (تخیل). Transcribed as printed.",
    "Sheet 1 labels the A domain «خیلی بالا» (121) while the «نظریه» block labels the same score «متوسط», and labels C «متوسط» vs «پایین». Both keys are reproduced; facet-level data is the more reliable guide.",
    "Sheet 2 prints no numbers, only a T-score grid; the profile values above are read off that grid and rounded (±3)."
  ]
};
