import type { HabitCategory } from "../types/api";

/** Same order as citizenship_score's config.HABIT_CATEGORIES, which is also
 * the order /me/wheel returns its spokes in. */
export const HABIT_CATEGORIES: HabitCategory[] = ["Mind", "Spirit", "Discipline", "Body", "Fitness"];

export const DEFAULT_HABIT_CATEGORY: HabitCategory = "Discipline";
export const DEFAULT_WEEKLY_TARGET = 7;

/**
 * Pillar colors and icons. The colors are the data-viz skill's dark-mode
 * categorical steps, assigned in HABIT_CATEGORIES order and validated
 * (validate_palette.js, adjacent pairs = neighbouring wheel spokes) against
 * the navy surfaces: every check passes. The order matters -- swapping two
 * colors can put a CVD-confusable pair side by side. Always shown with the
 * pillar's name and icon, never color alone.
 */
export const CATEGORY_THEME: Record<HabitCategory, { color: string; icon: { ios: string; android: string } }> = {
  Mind: { color: "#3987e5", icon: { ios: "brain.head.profile", android: "psychology" } },
  Spirit: { color: "#d55181", icon: { ios: "sparkles", android: "self_improvement" } },
  Discipline: { color: "#c98500", icon: { ios: "target", android: "track_changes" } },
  Body: { color: "#199e70", icon: { ios: "leaf.fill", android: "eco" } },
  Fitness: { color: "#d95926", icon: { ios: "dumbbell.fill", android: "fitness_center" } },
};
