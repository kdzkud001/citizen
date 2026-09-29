import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryIcon } from "@/components/CategoryIcon";
import { ClassHeroCard } from "@/components/ClassHeroCard";
import { DailyPointsChart } from "@/components/DailyPointsChart";
import { HabitCheckRow } from "@/components/HabitCheckRow";
import { Card, CenteredMessage, LoadingScreen, SecondaryButton, SectionHeader } from "@/components/ui";
import { Colors } from "@/constants/Colors";
import { queryKeys, useHabits, useProfile, useScore, useWheel, useWorkouts } from "@/hooks/queries";
import { api } from "@/lib/api";
import { formatPoints, greeting, initials } from "@/lib/format";
import { todayIso } from "@/lib/dates";
import { groupByCategory } from "@/lib/habits";
import { overallBalance } from "@/lib/insights";

function Greeting({ name }: { name: string | null | undefined }) {
  const firstName = name?.trim().split(/\s+/)[0];
  return (
    <View style={styles.greetingRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.greeting}>
          {greeting(new Date())}
          {firstName ? `, ${firstName}` : ""}
        </Text>
        <Text style={styles.tagline}>Consistency builds kingdoms.</Text>
      </View>
      <Pressable
        onPress={() => router.navigate("/profile")}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        style={styles.avatar}
      >
        <Text style={styles.avatarText}>{initials(name)}</Text>
      </Pressable>
    </View>
  );
}

function TodayStats({ workout, habits }: { workout: number; habits: number }) {
  return (
    <Card style={styles.statsRow}>
      <View style={styles.stat}>
        <Text style={styles.statValue}>{formatPoints(workout + habits)}</Text>
        <Text style={styles.statLabel}>pts today</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.stat}>
        <Text style={styles.statValue}>{formatPoints(habits)}</Text>
        <Text style={styles.statLabel}>from habits</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.stat}>
        <Text style={styles.statValue}>{formatPoints(workout)}</Text>
        <Text style={styles.statLabel}>from workouts</Text>
      </View>
    </Card>
  );
}

function TodaysHabits() {
  const forDate = todayIso();
  const habits = useHabits(forDate);

  if (habits.isLoading) return <ActivityIndicator color={Colors.tint} style={{ marginVertical: 16 }} />;
  if (habits.isError) return <Text style={styles.error}>Couldn&apos;t load habits. Pull down to retry.</Text>;

  // Same order as the Habits tab: grouped by pillar.
  const active = groupByCategory((habits.data ?? []).filter((h) => h.active)).flatMap((s) => s.habits);
  if (active.length === 0) {
    return (
      <Card style={{ gap: 12 }}>
        <Text style={styles.muted}>No habits yet. Habits across all five pillars count as much as workouts.</Text>
        <SecondaryButton label="Add your first habit" onPress={() => router.navigate("/habits")} />
      </Card>
    );
  }

  const done = active.filter((h) => h.completed_on_date).length;
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.muted}>
        {done} of {active.length} done
      </Text>
      {active.map((h) => (
        <HabitCheckRow key={h.id} habit={h} forDate={forDate} />
      ))}
    </View>
  );
}

function WellnessTeaser() {
  const wheel = useWheel();
  if (!wheel.data) return null;
  const balance = overallBalance(wheel.data.current.spokes);

  return (
    <Pressable onPress={() => router.navigate("/wellness")} accessibilityRole="button">
      <Card style={styles.teaser}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.cardTitle}>Wellness balance</Text>
          <Text style={styles.muted}>{balance === null ? "Not tracking yet" : `${balance}% over ${wheel.data.days} days`}</Text>
        </View>
        <View style={styles.teaserIcons}>
          {wheel.data.current.spokes.map((s) => (
            <CategoryIcon key={s.category} category={s.category} size={22} muted={!s.tracking} />
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

function LatestWorkout() {
  const workouts = useWorkouts(30);
  if (workouts.isLoading) return <ActivityIndicator color={Colors.tint} style={{ marginVertical: 16 }} />;
  if (workouts.isError) return <Text style={styles.error}>Couldn&apos;t load workouts.</Text>;

  const latestDay = workouts.data?.find((d) => d.sessions.length > 0);
  const session = latestDay?.sessions[0];
  if (!latestDay || !session) {
    return (
      <Card>
        <Text style={styles.muted}>No scored workouts in the last 30 days. Connect Lyfta in Profile to sync them.</Text>
      </Card>
    );
  }

  return (
    <Pressable onPress={() => router.push("/workouts")} accessibilityRole="button">
      <Card style={styles.workoutCard}>
        <CategoryIcon category="Fitness" size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {session.title ?? "Workout"}
          </Text>
          <Text style={styles.muted}>
            {latestDay.date} · {session.scored_sets} scored set{session.scored_sets === 1 ? "" : "s"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.workoutPoints}>{formatPoints(session.session_points)}</Text>
          <Text style={styles.statLabel}>pts</Text>
        </View>
      </Card>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const score = useScore();
  const [refreshing, setRefreshing] = useState(false);

  const sync = useMutation({ mutationFn: api.syncLyfta });

  async function onRefresh() {
    setRefreshing(true);
    try {
      // Ignore sync failures here (e.g. no Lyfta connected) -- still
      // refetch everything so habit-only progress shows up either way.
      await sync.mutateAsync().catch(() => undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.score }),
        queryClient.invalidateQueries({ queryKey: ["workouts"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wheel }),
        queryClient.invalidateQueries({ queryKey: ["habits"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.me }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  if (score.isLoading) return <LoadingScreen />;

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.tint} />}
    >
      <Greeting name={profile.data?.display_name} />

      {score.isError || !score.data ? (
        <Card>
          <CenteredMessage tone="danger">Couldn&apos;t load your score. Pull down to retry.</CenteredMessage>
        </Card>
      ) : (
        <>
          <ClassHeroCard
            today={score.data.today}
            pointsToNextClass={score.data.points_to_next_class}
            onPress={() => router.push("/classes")}
          />
          <TodayStats workout={score.data.today.workout_points} habits={score.data.today.habit_points} />
        </>
      )}

      <SectionHeader title="Today's habits" action="Manage" onAction={() => router.navigate("/habits")} />
      <TodaysHabits />

      <WellnessTeaser />

      <SectionHeader title="Latest workout" action="All workouts" onAction={() => router.push("/workouts")} />
      <LatestWorkout />

      {score.data && (
        <>
          <SectionHeader title="Last 28 days" />
          <Card>
            <DailyPointsChart history={score.data.history} />
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 12 },
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  greeting: { color: Colors.text, fontSize: 24, fontWeight: "800" },
  tagline: { color: Colors.textSecondary, fontSize: 14, marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.cardRaised,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: Colors.text, fontWeight: "700", fontSize: 16 },
  statsRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: Colors.text, fontSize: 18, fontWeight: "800" },
  statLabel: { color: Colors.textMuted, fontSize: 11 },
  statDivider: { width: 1, alignSelf: "stretch", backgroundColor: Colors.border },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  error: { color: Colors.danger },
  teaser: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  teaserIcons: { flexDirection: "row", gap: 4 },
  workoutCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  workoutPoints: { color: Colors.text, fontSize: 20, fontWeight: "800" },
});
