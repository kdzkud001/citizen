import { HABIT_CATEGORIES } from "@/constants/habits";
import type { HabitCategory } from "@/types/api";

/** Groups habits into sections in category order, dropping empty categories. */
export function groupByCategory<T extends { category: HabitCategory }>(
  habits: T[]
): { category: HabitCategory; habits: T[] }[] {
  return HABIT_CATEGORIES.map((category) => ({
    category,
    habits: habits.filter((h) => h.category === category),
  })).filter((section) => section.habits.length > 0);
}
