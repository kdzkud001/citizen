import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View, useColorScheme } from "react-native";

import { CLASS_THEME } from "../constants/classes";
import type { ClassName } from "../types/api";

const ICONS: Record<ClassName, { ios: string; android: string }> = {
  Outsider: { ios: "figure.walk", android: "directions_walk" },
  Commoner: { ios: "hammer", android: "construction" },
  Citizen: { ios: "shield", android: "shield" },
  Noble: { ios: "medal", android: "military_tech" },
  Elite: { ios: "star.fill", android: "star" },
};

interface Props {
  className: ClassName;
  /** "large" for the Home screen's hero badge, "small" for inline use (leaderboard rows, etc). */
  size?: "small" | "large";
}

export function ClassBadge({ className, size = "small" }: Props) {
  const scheme = useColorScheme();
  const color = CLASS_THEME[className][scheme === "dark" ? "dark" : "light"];
  const icon = ICONS[className];
  const isLarge = size === "large";

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: color, width: isLarge ? 56 : 28, height: isLarge ? 56 : 28 },
        ]}
      >
        <SymbolView
          name={{ ios: icon.ios, android: icon.android, web: icon.android } as never}
          tintColor="#ffffff"
          size={isLarge ? 30 : 16}
        />
      </View>
      <Text style={[styles.label, isLarge && styles.labelLarge, { color }]}>{className}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconCircle: { borderRadius: 999, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, fontWeight: "600" },
  labelLarge: { fontSize: 22, fontWeight: "700" },
});
