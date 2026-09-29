import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { CategoryIcon } from "@/components/CategoryIcon";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/hooks/queries";
import { api } from "@/lib/api";
import type { HabitWithCompletionOut } from "@/types/api";

/** Habit changes move scores and the wheel, so refetch all three. Habit
 * lists are invalidated by prefix so both the today and yesterday views
 * refresh. */
export function useInvalidateHabitData() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["habits"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.score });
    queryClient.invalidateQueries({ queryKey: queryKeys.wheel });
  };
}

export function weeklyTargetLabel(target: number): string {
  return target === 7 ? "Every day" : `${target}× a week`;
}

/**
 * One habit with its pillar tile and a round check toggle (tap to complete,
 * tap again to undo) for `forDate`. `accessory` renders at the right edge,
 * before the toggle (e.g. an Edit link); `children` renders underneath (e.g.
 * an inline editor).
 */
export function HabitCheckRow({
  habit,
  forDate,
  accessory,
  children,
}: {
  habit: HabitWithCompletionOut;
  forDate: string;
  accessory?: ReactNode;
  children?: ReactNode;
}) {
  const invalidate = useInvalidateHabitData();
  const done = habit.completed_on_date;

  const toggle = useMutation({
    mutationFn: () =>
      done ? api.deleteHabitCompletion(habit.id, forDate) : api.logHabitCompletion(habit.id, { completed_on: forDate }),
    onSuccess: invalidate,
  });

  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <CategoryIcon category={habit.category} />
        <View style={styles.text}>
          <Text style={[styles.name, done && styles.nameDone]} numberOfLines={2}>
            {habit.name}
          </Text>
          <Text style={styles.subtitle}>
            {habit.category} · {weeklyTargetLabel(habit.weekly_target)}
          </Text>
        </View>
        {accessory}
        <Pressable
          onPress={() => toggle.mutate()}
          disabled={toggle.isPending}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={habit.name}
          style={[styles.check, done ? styles.checkDone : styles.checkOpen]}
        >
          {toggle.isPending ? (
            <ActivityIndicator size="small" color={done ? "#fff" : Colors.textMuted} />
          ) : (
            done && <Text style={styles.checkmark}>✓</Text>
          )}
        </Pressable>
      </View>
      {toggle.isError && <Text style={styles.error}>Couldn&apos;t save that. Try again.</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  main: { flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1 },
  name: { color: Colors.text, fontSize: 16, fontWeight: "600" },
  nameDone: { color: Colors.textSecondary },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  check: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  checkOpen: { borderWidth: 2, borderColor: Colors.textMuted },
  checkDone: { backgroundColor: Colors.success },
  checkmark: { color: "#fff", fontWeight: "800", fontSize: 15 },
  error: { color: Colors.danger, fontSize: 12 },
});
