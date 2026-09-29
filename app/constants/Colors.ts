/**
 * The app's one theme: a dark navy "night kingdom" look. It's dark-only by
 * design (app.json sets userInterfaceStyle "dark"), so there's no light
 * variant to keep in sync.
 *
 * Data colors (classes in constants/classes.ts, pillars in
 * constants/habits.ts) are the data-viz skill's dark-mode categorical
 * steps, validated with validate_palette.js against `card` and
 * `cardRaised` below -- re-run it if either surface changes.
 */
export const Colors = {
  background: "#0a1120",
  card: "#101a2e",
  cardRaised: "#16233d",
  border: "rgba(125,160,230,0.14)",
  borderStrong: "rgba(125,160,230,0.28)",

  text: "#f3f6fc",
  textSecondary: "#b4bfd3",
  textMuted: "#7c89a3",

  /** Primary action color (pill buttons, active tab, links). */
  tint: "#4fb3f6",
  /** Text/icons drawn on top of a `tint` fill. */
  onTint: "#06101f",
  /** Checked habit toggles. */
  success: "#22b573",
  danger: "#ef6b6b",
} as const;

export type ThemeColors = typeof Colors;
