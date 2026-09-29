import { StyleSheet, View } from "react-native";

import { Icon } from "@/components/Icon";
import { CATEGORY_THEME } from "@/constants/habits";
import type { HabitCategory } from "@/types/api";

/** Rounded square in the pillar's color with its white icon. */
export function CategoryIcon({ category, size = 40, muted }: { category: HabitCategory; size?: number; muted?: boolean }) {
  const theme = CATEGORY_THEME[category];
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.3, backgroundColor: theme.color },
        muted && styles.muted,
      ]}
    >
      <Icon icon={theme.icon} color="#ffffff" size={size * 0.55} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center" },
  muted: { opacity: 0.35 },
});
