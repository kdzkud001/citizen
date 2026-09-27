import { CLASS_ORDER } from "@/constants/classes";
import type { ClassName } from "@/types/api";

/** Human-readable "N points to Next Class" label, or a top-class message
 * when there's nowhere higher to go (points_to_next_class is null). */
export function pointsToNextClassLabel(pointsToNextClass: number | null, currentClass: ClassName): string {
  if (pointsToNextClass === null) return "Top class reached";

  const currentIndex = CLASS_ORDER.indexOf(currentClass);
  const nextClass = CLASS_ORDER[currentIndex + 1];
  const rounded = Math.max(0, Math.round(pointsToNextClass));

  if (!nextClass) return "Top class reached";
  return `${rounded} point${rounded === 1 ? "" : "s"} to ${nextClass}`;
}

/** Home screen's progress bar fill: how far through the current class's
 * band the rolling score sits, clamped to [0, 1]. Returns 1 (full bar) in
 * the top class, since there's no "next" threshold to measure against. */
export function classProgressFraction(
  rollingScore: number,
  currentClass: ClassName,
  thresholds: Record<ClassName, number>
): number {
  const currentIndex = CLASS_ORDER.indexOf(currentClass);
  const nextClass = CLASS_ORDER[currentIndex + 1];
  if (!nextClass) return 1;

  const lower = thresholds[currentClass];
  const upper = thresholds[nextClass];
  if (upper <= lower) return 1;

  // Outsider's own lower threshold is -Infinity (there's no floor to be
  // "above"), which would make (rollingScore - lower) / (upper - lower)
  // divide Infinity by Infinity -> NaN. Treat 0 as the effective floor
  // there instead: 0% progress at score 0, 100% at the promotion line.
  const effectiveLower = Number.isFinite(lower) ? lower : 0;
  const fraction = (rollingScore - effectiveLower) / (upper - effectiveLower);
  return Math.min(1, Math.max(0, fraction));
}
