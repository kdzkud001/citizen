import type { HabitCategory } from "../types/api";

/** Same order as citizenship_score's config.HABIT_CATEGORIES, which is also
 * the order /me/wheel returns its spokes in. */
export const HABIT_CATEGORIES: HabitCategory[] = ["Mind", "Spirit", "Discipline", "Body", "Fitness"];

export const DEFAULT_HABIT_CATEGORY: HabitCategory = "Discipline";
export const DEFAULT_WEEKLY_TARGET = 7;
