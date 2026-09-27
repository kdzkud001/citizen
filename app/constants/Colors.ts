// Chrome/ink tokens reused from the same validated palette as
// constants/classes.ts (dataviz skill reference palette), so the whole
// app reads as one consistent system.
const tintColorLight = "#2a78d6";
const tintColorDark = "#3987e5";

export default {
  light: {
    text: "#0b0b0b",
    textSecondary: "#52514e",
    textMuted: "#898781",
    background: "#f9f9f7",
    card: "#fcfcfb",
    border: "rgba(11,11,11,0.10)",
    tint: tintColorLight,
    danger: "#d03b3b",
    tabIconDefault: "#898781",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#ffffff",
    textSecondary: "#c3c2b7",
    textMuted: "#898781",
    background: "#0d0d0d",
    card: "#1a1a19",
    border: "rgba(255,255,255,0.10)",
    tint: tintColorDark,
    danger: "#e66767",
    tabIconDefault: "#898781",
    tabIconSelected: tintColorDark,
  },
};
