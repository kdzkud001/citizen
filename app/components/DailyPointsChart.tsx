import { StyleSheet, Text, View } from "react-native";

import { useThemeColors } from "@/hooks/useThemeColors";
import type { DailyScoreOut } from "@/types/api";

const CHART_HEIGHT = 100;

/**
 * A simple 28-day bar chart of daily points (workout + habit). Single-hue
 * magnitude encoding (per the data-viz skill: sequential = one hue), thin
 * bars, no per-bar labels -- just the two endpoint dates and today's value
 * called out separately by the screen that embeds this.
 */
export function DailyPointsChart({ history }: { history: DailyScoreOut[] }) {
  const colors = useThemeColors();
  const values = history.map((h) => h.workout_points + h.habit_points);
  const max = Math.max(1, ...values);

  return (
    <View>
      <View style={[styles.row, { height: CHART_HEIGHT }]}>
        {history.map((day) => {
          const height = Math.max(2, (CHART_HEIGHT * (day.workout_points + day.habit_points)) / max);
          return (
            <View key={day.date} style={styles.barTrack}>
              <View style={[styles.bar, { height, backgroundColor: colors.tint }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        <Text style={[styles.labelText, { color: colors.textMuted }]}>
          {history[0]?.date.slice(5)}
        </Text>
        <Text style={[styles.labelText, { color: colors.textMuted }]}>
          {history[history.length - 1]?.date.slice(5)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  barTrack: { flex: 1, justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 2 },
  labelsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  labelText: { fontSize: 11 },
});
