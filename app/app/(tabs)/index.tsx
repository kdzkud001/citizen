import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { ClassBadge } from "@/components/ClassBadge";
import { DailyPointsChart } from "@/components/DailyPointsChart";
import { CLASS_THRESHOLDS } from "@/constants/classes";
import { queryKeys, useScore } from "@/hooks/queries";
import { useThemeColors } from "@/hooks/useThemeColors";
import { api } from "@/lib/api";
import { classProgressFraction, pointsToNextClassLabel } from "@/lib/format";

export default function HomeScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const score = useScore();
  const [refreshing, setRefreshing] = useState(false);

  const sync = useMutation({ mutationFn: api.syncLyfta });

  async function onRefresh() {
    setRefreshing(true);
    try {
      // Ignore sync failures here (e.g. no Lyfta connected) -- still
      // refetch scores so habit-only progress shows up either way.
      await sync.mutateAsync().catch(() => undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.score }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workouts() }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  if (score.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (score.isError || !score.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.danger }}>Couldn&apos;t load your score. Pull down to retry.</Text>
      </View>
    );
  }

  const { today, points_to_next_class, history } = score.data;
  const progress = classProgressFraction(today.rolling_score, today.class_name, CLASS_THRESHOLDS);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.heroSection}>
        <ClassBadge className={today.class_name} size="large" />
        <Text style={[styles.rollingScore, { color: colors.text }]}>
          {Math.round(today.rolling_score)}
        </Text>
        <Text style={{ color: colors.textSecondary }}>rolling score (28 days)</Text>
      </View>

      <View style={styles.progressSection}>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: colors.tint },
            ]}
          />
        </View>
        <Text style={{ color: colors.textSecondary, marginTop: 6 }}>
          {pointsToNextClassLabel(points_to_next_class, today.class_name)}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Today</Text>
        <Text style={[styles.todayPoints, { color: colors.tint }]}>
          {Math.round(today.workout_points + today.habit_points)} pts
        </Text>
        <Text style={{ color: colors.textMuted }}>
          {Math.round(today.workout_points)} workout · {Math.round(today.habit_points)} habits
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Last 28 days</Text>
        <DailyPointsChart history={history} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  container: { padding: 20, gap: 16 },
  heroSection: { alignItems: "center", gap: 8, paddingVertical: 16 },
  rollingScore: { fontSize: 40, fontWeight: "800", marginTop: 8 },
  progressSection: { marginTop: 4 },
  progressTrack: { height: 10, borderRadius: 5, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 5 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  todayPoints: { fontSize: 24, fontWeight: "700" },
});
