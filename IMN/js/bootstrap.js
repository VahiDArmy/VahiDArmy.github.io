/**
 * Bootstrap — runs after config is loaded and before the router starts.
 * Loads the initial data the app needs (foods catalog, goals, profile).
 */

import { bus } from "./core/event-bus.js";
import { store } from "./core/state.js";
import { toast } from "./components/toast.js";
import { foods } from "./services/foods.service.js";
import { goals } from "./services/goals.service.js";
import { profile } from "./services/profile.service.js";

/**
 * Run all startup tasks in parallel where safe.
 * Failures are non-fatal (they only log + toast a warning) so the app can
 * still work with partial data.
 */
export async function bootstrap() {
  const tasks = [
    {
      name: "foods",
      run: () => foods.load().catch((err) => {
        console.warn("[bootstrap] foods failed", err);
        toast.warning("کتابخانه غذا بارگذاری نشد");
      }),
    },
    {
      name: "goals",
      run: () => goals.load().catch((err) => {
        console.warn("[bootstrap] goals failed", err);
      }),
    },
    {
      name: "profile",
      run: () => profile.load().catch((err) => {
        console.warn("[bootstrap] profile failed", err);
      }),
    },
  ];

  await Promise.all(tasks.map((t) => t.run()));
  bus.emit("bootstrap:done");
}