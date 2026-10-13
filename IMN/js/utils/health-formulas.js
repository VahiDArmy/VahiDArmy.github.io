/**
 * Health formulas — BMI, BMR, TDEE, and their categories.
 *
 * Sources
 * -------
 *  BMI  : WHO classification (2013)
 *         value = weight(kg) / height(m)^2
 *  BMR  : Mifflin-St Jeor (1990) — the standard equation for BMR
 *         male   : 10·w + 6.25·h − 5·a + 5
 *         female : 10·w + 6.25·h − 5·a − 161
 *         other  : average of male and female constants (−78)
 *  TDEE : BMR × activity multiplier (Harris-Benedict)
 *
 * These are pure, framework-free helpers so they can be reused by
 * settings (preview), the health page (dashboard card), and services
 * (server-side reporting).
 */

/* ---------- BMI categories ------------------------------------------- */
/* Sorted ascending by the upper bound of each band. The last entry has
 * `max: Infinity` and catches everything above the previous band. */
export const BMI_CATEGORIES = [
  { max: 18.5,     level: "underweight", label: "کمبود وزن",     short: "کم",       tone: "warning" },
  { max: 25,       level: "normal",      label: "وزن نرمال",     short: "نرمال",    tone: "success" },
  { max: 30,       level: "overweight",  label: "اضافه وزن",     short: "اضافه",    tone: "warning" },
  { max: 35,       level: "obese1",      label: "چاقی درجه ۱",   short: "چاقی ۱",   tone: "danger"  },
  { max: 40,       level: "obese2",      label: "چاقی درجه ۲",   short: "چاقی ۲",   tone: "danger"  },
  { max: Infinity, level: "obese3",      label: "چاقی درجه ۳",   short: "چاقی ۳",   tone: "danger"  },
];

/* ---------- Activity levels (for TDEE) ------------------------------- */
export const ACTIVITY_LEVELS = [
  { id: "sedentary",  label: "بی‌تحرک",    desc: "کمتر از ۱ روز ورزش در هفته",   multiplier: 1.2   },
  { id: "light",      label: "کم",         desc: "۱ تا ۳ روز ورزش در هفته",       multiplier: 1.375 },
  { id: "moderate",   label: "متوسط",      desc: "۳ تا ۵ روز ورزش در هفته",       multiplier: 1.55  },
  { id: "active",     label: "زیاد",       desc: "۶ تا ۷ روز ورزش در هفته",       multiplier: 1.725 },
  { id: "veryActive", label: "بسیار زیاد", desc: "ورزش سنگین روزانه یا کار بدنی", multiplier: 1.9   },
];

export function getActivityLevel(id) {
  return ACTIVITY_LEVELS.find((l) => l.id === id) || ACTIVITY_LEVELS[0];
}

/* ---------- Age ------------------------------------------------------ */
/** Age in whole years from a birth year. Returns null if not computable. */
export function calculateAge(birthYear) {
  const y = Number(birthYear);
  if (!y) return null;
  const age = new Date().getFullYear() - y;
  return age > 0 && age < 150 ? age : null;
}

/* ---------- BMI ------------------------------------------------------ */
export function classifyBMI(bmi) {
  const v = Number(bmi);
  if (!Number.isFinite(v) || v <= 0) return null;
  return BMI_CATEGORIES.find((c) => v < c.max) || BMI_CATEGORIES[BMI_CATEGORIES.length - 1];
}

/**
 * Calculate BMI from weight (kg) and height (cm).
 * Returns null if inputs are missing or non-sensical.
 *
 * The healthy weight range is derived from the WHO "normal" band
 * (18.5 ≤ BMI < 25) using the user's height.
 */
export function calculateBMI(weightKg, heightCm) {
  const w = Number(weightKg);
  const h = Number(heightCm);
  if (!w || !h || w <= 0 || h <= 0) return null;

  const hm = h / 100;
  const value = w / (hm * hm);
  const category = classifyBMI(value);

  return {
    value: Number(value.toFixed(2)),
    category,
    healthyMin: Number((18.5 * hm * hm).toFixed(1)),
    healthyMax: Number((24.9 * hm * hm).toFixed(1)),
  };
}

/** Just the healthy weight range for a given height (cm). */
export function healthyWeightRange(heightCm) {
  const h = Number(heightCm);
  if (!h || h <= 0) return null;
  const hm = h / 100;
  return {
    min: Number((18.5 * hm * hm).toFixed(1)),
    max: Number((24.9 * hm * hm).toFixed(1)),
  };
}

/* ---------- BMR (Mifflin-St Jeor) ------------------------------------ */
export function calculateBMR({ weightKg, heightCm, age, gender }) {
  const w = Number(weightKg);
  const h = Number(heightCm);
  const a = Number(age);
  if (!w || !h || !a || w <= 0 || h <= 0 || a <= 0) return null;

  const base = 10 * w + 6.25 * h - 5 * a;
  let bmr;
  if (gender === "male") bmr = base + 5;
  else if (gender === "female") bmr = base - 161;
  else bmr = base - 78; // neutral (average of +5 and −161)

  return Math.round(bmr);
}

/* ---------- TDEE ----------------------------------------------------- */
export function calculateTDEE(bmr, activityLevelId) {
  if (!bmr) return null;
  const level = getActivityLevel(activityLevelId);
  return Math.round(bmr * level.multiplier);
}

/* ---------- Convenience: everything at once ------------------------- */
/**
 * Compute all metrics from a profile-like object.
 *
 * @param {object} input
 *   weightKg  number|null  — latest weight, or profile baseline
 *   heightCm  number|null
 *   birthYear number|null
 *   gender    "male"|"female"|"other"|null
 *   activity  string|null  — activity level id
 * @returns {
 *   ready: boolean,   // false when core inputs are missing
 *   missing: string[],// human-readable list of missing fields
 *   age, weightKg, heightCm, gender,
 *   bmi: { value, category, healthyMin, healthyMax } | null,
 *   bmr: number | null,
 *   tdee: number | null,
 *   healthy: { min, max } | null,
 * }
 */
export function computeHealthMetrics(input = {}) {
  const weightKg = Number(input.weightKg) || null;
  const heightCm = Number(input.heightCm) || null;
  const age = calculateAge(input.birthYear);
  const gender = input.gender || null;

  const missing = [];
  if (!weightKg) missing.push("وزن");
  if (!heightCm) missing.push("قد");
  if (!age) missing.push("سال تولد");
  if (!gender) missing.push("جنسیت");

  const bmi = calculateBMI(weightKg, heightCm);
  const bmr = calculateBMR({ weightKg, heightCm, age, gender });
  const tdee = calculateTDEE(bmr, input.activity);
  const healthy = healthyWeightRange(heightCm);

  return {
    ready: missing.length === 0,
    missing,
    age,
    weightKg,
    heightCm,
    gender,
    bmi,
    bmr,
    tdee,
    healthy,
  };
}