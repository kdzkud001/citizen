/** Today's date as YYYY-MM-DD in UTC, matching the backend's today_utc()
 * (it only accepts habit logs for today or yesterday by that clock). */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function yesterdayIso(now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
