import type { HabitCategory, WheelSpokeOut } from "@/types/api";

/** Average percent across the pillars being tracked, rounded; null when
 * nothing is tracked yet (so the UI can say so rather than show "0%"). */
export function overallBalance(spokes: WheelSpokeOut[]): number | null {
  const tracked = spokes.filter((s) => s.tracking);
  if (tracked.length === 0) return null;
  return Math.round(tracked.reduce((sum, s) => sum + s.percent, 0) / tracked.length);
}

export interface BalanceInsights {
  strongest: HabitCategory | null;
  weakest: HabitCategory | null;
  /** Biggest move vs the previous window among pillars tracked in both, if
   * it's at least MIN_TREND_POINTS in either direction. */
  trend: { category: HabitCategory; delta: number } | null;
  untracked: HabitCategory[];
}

export const MIN_TREND_POINTS = 5;

/** Strongest/weakest pillar and the biggest change since last window, from
 * /me/wheel. Strongest and weakest are only named when there are at least
 * two tracked pillars that differ, so one pillar is never both. */
export function balanceInsights(current: WheelSpokeOut[], previous: WheelSpokeOut[]): BalanceInsights {
  const tracked = current.filter((s) => s.tracking);
  const untracked = current.filter((s) => !s.tracking).map((s) => s.category);

  let strongest: HabitCategory | null = null;
  let weakest: HabitCategory | null = null;
  if (tracked.length >= 2) {
    const sorted = [...tracked].sort((a, b) => b.percent - a.percent);
    if (sorted[0].percent !== sorted[sorted.length - 1].percent) {
      strongest = sorted[0].category;
      weakest = sorted[sorted.length - 1].category;
    }
  }

  let trend: BalanceInsights["trend"] = null;
  for (const spoke of tracked) {
    const before = previous.find((p) => p.category === spoke.category);
    if (!before?.tracking) continue;
    const delta = Math.round(spoke.percent - before.percent);
    if (Math.abs(delta) >= MIN_TREND_POINTS && (!trend || Math.abs(delta) > Math.abs(trend.delta))) {
      trend = { category: spoke.category, delta };
    }
  }

  return { strongest, weakest, trend, untracked };
}

/** Plain-words sentences for the Balance insights card, in display order. */
export function insightMessages(insights: BalanceInsights, days: number): string[] {
  const messages: string[] = [];
  if (insights.strongest && insights.weakest) {
    messages.push(`${insights.strongest} is your strongest pillar.`);
    messages.push(`${insights.weakest} is lowest — small steps there make a big difference.`);
  }
  if (insights.trend) {
    const { category, delta } = insights.trend;
    messages.push(
      delta > 0
        ? `${category} is up ${delta} points on the previous ${days} days.`
        : `${category} is down ${-delta} points on the previous ${days} days.`
    );
  }
  if (insights.untracked.length > 0) {
    const list = insights.untracked.join(", ");
    messages.push(`Not tracking ${list} yet — add a habit to round out your wheel.`);
  }
  if (messages.length === 0) {
    messages.push("Keep checking off habits — insights appear once your wheel has some shape.");
  }
  return messages;
}
