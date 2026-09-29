import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { CLASS_THEME } from "@/constants/classes";
import { Colors } from "@/constants/Colors";
import type { ClassName } from "@/types/api";

/** The class's crest: its icon on a ring of its color. */
export function ClassCrest({ className, size = 28 }: { className: ClassName; size?: number }) {
  const theme = CLASS_THEME[className];
  return (
    <View
      style={[
        styles.crest,
        {
          width: size,
          height: size,
          borderColor: theme.color,
          borderWidth: Math.max(1.5, size / 16),
          backgroundColor: `${theme.color}26`,
        },
      ]}
    >
      <Icon icon={theme.icon} color={theme.color} size={size * 0.55} />
    </View>
  );
}

/** Crest plus class name, for inline use (leaderboard rows etc). */
export function ClassBadge({ className }: { className: ClassName }) {
  return (
    <View style={styles.row}>
      <ClassCrest className={className} size={24} />
      <Text style={styles.label}>{className}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  crest: { borderRadius: 999, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
});
