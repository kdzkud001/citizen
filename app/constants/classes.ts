import type { ClassName } from "../types/api";

/**
 * Colors are the data-viz skill's dark-mode categorical steps, validated
 * with its CVD-safety checker (scripts/validate_palette.js) against the
 * navy card surfaces in constants/Colors.ts: every check passes. Badges
 * still always pair the color with the class name and a distinct icon --
 * never color alone.
 */
export const CLASS_ORDER: ClassName[] = ["Outsider", "Commoner", "Citizen", "Noble", "Elite"];

export const CLASS_THEME: Record<ClassName, { color: string; icon: { ios: string; android: string } }> = {
  Outsider: { color: "#3987e5", icon: { ios: "figure.walk", android: "directions_walk" } },
  Commoner: { color: "#d95926", icon: { ios: "hammer.fill", android: "construction" } },
  Citizen: { color: "#199e70", icon: { ios: "shield.fill", android: "shield" } },
  Noble: { color: "#c98500", icon: { ios: "medal.fill", android: "military_tech" } },
  Elite: { color: "#d55181", icon: { ios: "crown.fill", android: "workspace_premium" } },
};

/** One-line flavor text for the class ladder. */
export const CLASS_BLURB: Record<ClassName, string> = {
  Outsider: "Just arriving at the gates",
  Commoner: "Building the daily rhythm",
  Citizen: "A steady member of the realm",
  Noble: "Consistency others look up to",
  Elite: "The top of the kingdom",
};

// Matches backend CLASS_THRESHOLDS in citizenship_score/config.py.
export const CLASS_THRESHOLDS: Record<ClassName, number> = {
  Outsider: -Infinity,
  Commoner: 300,
  Citizen: 1000,
  Noble: 2000,
  Elite: 3500,
};
