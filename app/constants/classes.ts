import type { ClassName } from "../types/api";

/**
 * Colors validated with the data-viz skill's CVD-safety checker
 * (scripts/validate_palette.js) as a 5-slot categorical palette, both
 * modes passing every hard gate. Since badges always render with their
 * class name label + a distinct icon alongside the color, the light-mode
 * contrast WARN on 3 of the 5 (a color-only reader would struggle) is
 * covered by that "relief rule" -- never color alone.
 */
export const CLASS_ORDER: ClassName[] = ["Outsider", "Commoner", "Citizen", "Noble", "Elite"];

export const CLASS_THEME: Record<ClassName, { light: string; dark: string; icon: IconName }> = {
  Outsider: { light: "#2a78d6", dark: "#3987e5", icon: "walk-outline" },
  Commoner: { light: "#eb6834", dark: "#d95926", icon: "hammer-outline" },
  Citizen: { light: "#1baf7a", dark: "#199e70", icon: "shield-outline" },
  Noble: { light: "#eda100", dark: "#c98500", icon: "ribbon-outline" },
  Elite: { light: "#e87ba4", dark: "#d55181", icon: "star-outline" },
};

// Matches backend CLASS_THRESHOLDS in citizenship_score/config.py.
export const CLASS_THRESHOLDS: Record<ClassName, number> = {
  Outsider: -Infinity,
  Commoner: 300,
  Citizen: 1000,
  Noble: 2000,
  Elite: 3500,
};

// Narrow to just the Ionicons names this file actually uses, so a typo is
// a type error instead of a silent missing icon at runtime.
export type IconName =
  | "walk-outline"
  | "hammer-outline"
  | "shield-outline"
  | "ribbon-outline"
  | "star-outline";
