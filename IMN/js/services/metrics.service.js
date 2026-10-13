/**
 * Metrics service — BMI / BMR / TDEE computed from the user's profile
 * plus the latest weight log.
 *
 * Source of truth
 * ---------------
 *  • Height, birth year, gender, and activity level come from `profiles`.
 *  • Weight comes from `profiles.weight_kg` when present. If absent, we
 *    fall back to the most recent weight log (last 90 days).
 *  • When the user logs a new weight on the health page, we sync it to
 *    `profiles.weight_kg` via `syncWeight()`, so BMI/BMR stay current
 *    without the user re-entering their weight in Settings.
 *
 * All math lives in `utils/health-formulas.js` — this service only wires
 * data sources to those pure functions.
 */

import { weight } from "./health.service.js";
import { profile } from "./profile.service.js";
import { computeHealthMetrics } from "../utils/health-formulas.js";
import { store } from "../core/state.js";
import { todayISO, addDays } from "../utils/date.js";

async function resolveWeightKg(profileRow) {
  const baseline = Number(profileRow?.weight_kg);
  if (baseline && baseline > 0) return baseline;

  // Fallback: most recent weight log from the last 90 days.
  try {
    const latest = await weight.latest();
    if (latest?.weight) return Number(latest.weight);
  } catch { /* ignore — the profile may genuinely have no weight yet */ }

  return null;
}

export const metrics = {
  /**
   * Compute BMI/BMR/TDEE.
   *
   * @param {object} [opts]
   *   profileRow — optional profile object to use instead of the cached one
   *                (used by the live preview in Settings while typing)
   * @returns {Promise<ReturnType<typeof computeHealthMetrics>>}
   */
  async compute({ profileRow } = {}) {
    const prof = profileRow ?? store.get("profile") ?? null;
    if (!prof) return computeHealthMetrics({});

    const weightKg = await resolveWeightKg(prof);

    return computeHealthMetrics({
      weightKg,
      heightCm: prof.height_cm,
      birthYear: prof.birth_year,
      gender: prof.gender,
      activity: prof.activity_level,
    });
  },

  /**
   * Pure, synchronous preview — no network, no fallbacks. Used by the
   * Settings live preview while the user is still typing.
   */
  preview({ weightKg, heightCm, birthYear, gender, activity }) {
    return computeHealthMetrics({
      weightKg,
      heightCm,
      birthYear,
      gender,
      activity,
    });
  },

  /** Persist a fresh weight into the profile so BMI/BMR stay current. */
  async syncWeight(weightKg) {
    await profile.syncWeightFromLog(weightKg);
  },

  /** Convenience: current age from the cached profile. */
  age() {
    const prof = store.get("profile");
    const y = Number(prof?.birth_year);
    if (!y) return null;
    const age = new Date().getFullYear() - y;
    return age > 0 && age < 150 ? age : null;
  },
};