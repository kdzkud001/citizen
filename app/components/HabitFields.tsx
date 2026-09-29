import { Pressable, StyleSheet, Text, View } from "react-native";

import { HABIT_CATEGORIES } from "@/constants/habits";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { HabitCategory } from "@/types/api";

export function CategoryPicker({
  value,
  onChange,
}: {
  value: HabitCategory;
  onChange: (category: HabitCategory) => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.chips}>
      {HABIT_CATEGORIES.map((category) => {
        const selected = category === value;
        return (
          <Pressable
            key={category}
            onPress={() => onChange(category)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              { borderColor: selected ? colors.tint : colors.border },
              selected && { backgroundColor: colors.tint },
            ]}
          >
            <Text style={{ color: selected ? "#fff" : colors.text, fontSize: 13, fontWeight: "600" }}>
              {category}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function WeeklyTargetStepper({ value, onChange }: { value: number; onChange: (target: number) => void }) {
  const colors = useThemeColors();
  return (
    <View style={styles.stepperRow}>
      <Text style={{ color: colors.textSecondary, flex: 1 }}>
        {value === 7 ? "Every day" : `${value} day${value === 1 ? "" : "s"} a week`}
      </Text>
      <Pressable
        style={[styles.stepperButton, { borderColor: colors.border }]}
        onPress={() => onChange(Math.max(1, value - 1))}
        accessibilityLabel="Fewer days per week"
      >
        <Text style={{ color: colors.text, fontSize: 18 }}>−</Text>
      </Pressable>
      <Text style={{ color: colors.text, fontWeight: "700", minWidth: 16, textAlign: "center" }}>{value}</Text>
      <Pressable
        style={[styles.stepperButton, { borderColor: colors.border }]}
        onPress={() => onChange(Math.min(7, value + 1))}
        accessibilityLabel="More days per week"
      >
        <Text style={{ color: colors.text, fontSize: 18 }}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
