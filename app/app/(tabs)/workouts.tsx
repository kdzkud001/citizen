import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { useWorkouts } from "@/hooks/queries";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { DailyWorkoutsOut, SessionBreakdown } from "@/types/api";

function SessionCard({ session }: { session: SessionBreakdown }) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => setExpanded((e) => !e)}
    >
      <View style={styles.sessionHeaderRow}>
        <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
          {session.title ?? "Workout"}
        </Text>
        <Text style={[styles.sessionPoints, { color: colors.tint }]}>
          {Math.round(session.session_points)} pts
        </Text>
      </View>
      <Text style={{ color: colors.textMuted }}>
        {session.scored_sets} scored set{session.scored_sets === 1 ? "" : "s"}
        {session.bonus_points > 0 ? ` · +${Math.round(session.bonus_points)} bonus` : ""}
      </Text>

      {expanded && (
        <View style={styles.expanded}>
          <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
            Body weight: {session.body_weight} · same-day factor: {session.same_day_factor}×
          </Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
            Set loads: {session.set_loads.map((l) => l.toFixed(1)).join(", ") || "none"}
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            Raw session points: {session.raw_session_points.toFixed(1)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function DayGroup({ day }: { day: DailyWorkoutsOut }) {
  const colors = useThemeColors();
  return (
    <View style={styles.dayGroup}>
      <Text style={[styles.dayHeader, { color: colors.textMuted }]}>{day.date}</Text>
      {day.sessions.map((s) => (
        <SessionCard key={s.workout_id} session={s} />
      ))}
    </View>
  );
}

export default function WorkoutsScreen() {
  const colors = useThemeColors();
  const workouts = useWorkouts(30);

  if (workouts.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (workouts.isError || !workouts.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.danger }}>Couldn&apos;t load workouts.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      data={workouts.data}
      keyExtractor={(day) => day.date}
      renderItem={({ item }) => <DayGroup day={item} />}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>
            No scored workouts in the last 30 days yet.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  container: { padding: 16, gap: 12 },
  dayGroup: { gap: 8, marginBottom: 8 },
  dayHeader: { fontSize: 13, fontWeight: "600", textTransform: "uppercase" },
  sessionCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  sessionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sessionTitle: { fontSize: 16, fontWeight: "600", flex: 1, marginRight: 8 },
  sessionPoints: { fontSize: 16, fontWeight: "700" },
  expanded: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#8888" },
});
