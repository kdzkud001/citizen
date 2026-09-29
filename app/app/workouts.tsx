import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { CategoryIcon } from "@/components/CategoryIcon";
import { Card, CenteredMessage, LoadingScreen } from "@/components/ui";
import { Colors } from "@/constants/Colors";
import { useLyftaStatus, useWorkouts } from "@/hooks/queries";
import { formatPoints } from "@/lib/format";
import type { DailyWorkoutsOut, SessionBreakdown } from "@/types/api";

const DAYS = 30;

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={styles.breakdownValue}>{value}</Text>
    </View>
  );
}

function SessionCard({ session }: { session: SessionBreakdown }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      onPress={() => setExpanded((e) => !e)}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <Card style={{ gap: 12 }}>
        <View style={styles.sessionHeader}>
          <CategoryIcon category="Fitness" size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sessionTitle} numberOfLines={1}>
              {session.title ?? "Workout"}
            </Text>
            <Text style={styles.muted}>
              {session.scored_sets} scored set{session.scored_sets === 1 ? "" : "s"}
              {session.bonus_points > 0 ? ` · +${formatPoints(session.bonus_points)} progress bonus` : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.points}>{formatPoints(session.session_points)}</Text>
            <Text style={styles.pointsLabel}>pts</Text>
          </View>
        </View>

        {expanded && (
          <View style={styles.breakdown}>
            <BreakdownRow label="Effort (raw set points)" value={session.raw_session_points.toFixed(1)} />
            {session.same_day_factor !== 1 && (
              <BreakdownRow label="Same-day session factor" value={`${session.same_day_factor}×`} />
            )}
            <BreakdownRow label="Progress bonus" value={`+${session.bonus_points.toFixed(1)}`} />
            <BreakdownRow label="Body weight used" value={String(session.body_weight)} />
            <Text style={styles.setLoads}>
              Set loads: {session.set_loads.map((l) => l.toFixed(1)).join(", ") || "none"}
            </Text>
            <Text style={styles.footnote}>Points scale with effort relative to your own body weight.</Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
}

function DayGroup({ day }: { day: DailyWorkoutsOut }) {
  return (
    <View style={styles.dayGroup}>
      <Text style={styles.dayHeader}>{day.date}</Text>
      {day.sessions.map((s) => (
        <SessionCard key={s.workout_id} session={s} />
      ))}
    </View>
  );
}

export default function WorkoutsScreen() {
  const workouts = useWorkouts(DAYS);
  const lyfta = useLyftaStatus();

  if (workouts.isLoading) return <LoadingScreen />;
  if (workouts.isError || !workouts.data) return <CenteredMessage tone="danger">Couldn&apos;t load workouts.</CenteredMessage>;

  const sessions = workouts.data.flatMap((d) => d.sessions);
  const total = sessions.reduce((sum, s) => sum + s.session_points, 0);

  return (
    <FlatList
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.container}
      data={workouts.data.filter((d) => d.sessions.length > 0)}
      keyExtractor={(day) => day.date}
      renderItem={({ item }) => <DayGroup day={item} />}
      ListHeaderComponent={
        <Card style={styles.summary}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{sessions.length}</Text>
            <Text style={styles.pointsLabel}>sessions</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{formatPoints(total)}</Text>
            <Text style={styles.pointsLabel}>pts, last {DAYS} days</Text>
          </View>
          <Text style={styles.synced}>
            {lyfta.data?.connected ? "✓ Synced from Lyfta" : "Lyfta not connected"}
          </Text>
        </Card>
      }
      ListEmptyComponent={
        <Text style={[styles.muted, { textAlign: "center", marginTop: 24 }]}>
          No scored workouts in the last {DAYS} days yet.
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 12 },
  summary: { flexDirection: "row", alignItems: "center", gap: 20, marginBottom: 4 },
  summaryStat: { alignItems: "flex-start" },
  summaryValue: { color: Colors.text, fontSize: 22, fontWeight: "800" },
  synced: { color: Colors.textSecondary, fontSize: 12, flex: 1, textAlign: "right" },
  dayGroup: { gap: 8 },
  dayHeader: { color: Colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.8 },
  sessionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sessionTitle: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  points: { color: Colors.text, fontSize: 20, fontWeight: "800" },
  pointsLabel: { color: Colors.textMuted, fontSize: 11 },
  breakdown: { gap: 6, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { color: Colors.textSecondary, fontSize: 13 },
  breakdownValue: { color: Colors.text, fontSize: 13, fontWeight: "600" },
  setLoads: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  footnote: { color: Colors.textMuted, fontSize: 12 },
});
