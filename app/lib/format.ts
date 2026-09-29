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
  return `${formatPoints(rounded)} point${rounded === 1 ? "" : "s"} to ${nextClass}`;
}

/** "Good morning" / "Good afternoon" / "Good evening" for the given local time. */
export function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Up to two initials for the avatar circle; "?" when there's no name. */
export function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/** Whole points with thousands separators, e.g. 2480.4 -> "2,480". Done by
 * hand because Hermes' toLocaleString support varies by platform. */
export function formatPoints(points: number): string {
  const rounded = Math.round(points);
  const sign = rounded < 0 ? "-" : "";
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Point range label for the class ladder, e.g. "1,000 – 1,999 pts" or
 * "3,500+ pts" for the top class. Outsider's -Infinity floor shows as 0. */
export function classRangeLabel(lower: number, upper: number | null): string {
  const from = formatPoints(Number.isFinite(lower) ? lower : 0);
  if (upper === null) return `${from}+ pts`;
  return `${from} – ${formatPoints(upper - 1)} pts`;
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
