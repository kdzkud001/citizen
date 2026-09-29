import { Pressable, StyleSheet, Text, View } from "react-native";

import { CategoryIcon } from "@/components/CategoryIcon";
import { Colors } from "@/constants/Colors";
import { CATEGORY_THEME, HABIT_CATEGORIES } from "@/constants/habits";
import type { HabitCategory } from "@/types/api";

export function CategoryPicker({
  value,
  onChange,
}: {
  value: HabitCategory;
  onChange: (category: HabitCategory) => void;
}) {
  return (
    <View style={styles.chips}>
      {HABIT_CATEGORIES.map((category) => {
        const selected = category === value;
        const color = CATEGORY_THEME[category].color;
        return (
          <Pressable
            key={category}
            onPress={() => onChange(category)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              { borderColor: selected ? color : Colors.border },
              selected && { backgroundColor: `${color}33` },
            ]}
          >
            <CategoryIcon category={category} size={18} muted={!selected} />
            <Text style={[styles.chipText, { color: selected ? Colors.text : Colors.textSecondary }]}>
              {category}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function WeeklyTargetStepper({ value, onChange }: { value: number; onChange: (target: number) => void }) {
  return (
    <View style={styles.stepperRow}>
      <Text style={{ color: Colors.textSecondary, flex: 1 }}>
        {value === 7 ? "Every day" : `${value} day${value === 1 ? "" : "s"} a week`}
      </Text>
      <Pressable
        style={styles.stepperButton}
        onPress={() => onChange(Math.max(1, value - 1))}
        accessibilityLabel="Fewer days per week"
      >
        <Text style={styles.stepperGlyph}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        style={styles.stepperButton}
        onPress={() => onChange(Math.min(7, value + 1))}
        accessibilityLabel="More days per week"
      >
        <Text style={styles.stepperGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 5,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperGlyph: { color: Colors.text, fontSize: 18 },
  stepperValue: { color: Colors.text, fontWeight: "700", minWidth: 16, textAlign: "center" },
});
