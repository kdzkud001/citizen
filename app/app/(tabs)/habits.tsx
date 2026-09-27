import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { queryKeys, useHabits } from "@/hooks/queries";
import { useThemeColors } from "@/hooks/useThemeColors";
import { api } from "@/lib/api";
import type { HabitWithCompletionOut } from "@/types/api";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function HabitRow({ habit, forDate }: { habit: HabitWithCompletionOut; forDate: string }) {
  const colors = useThemeColors();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.habits(forDate) });
    queryClient.invalidateQueries({ queryKey: queryKeys.score });
  };

  const toggle = useMutation({
    mutationFn: () =>
      habit.completed_on_date
        ? api.deleteHabitCompletion(habit.id, forDate)
        : api.logHabitCompletion(habit.id, { completed_on: forDate }),
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: () => api.updateHabit(habit.id, { active: false }),
    onSuccess: invalidate,
  });

  return (
    <View style={[styles.habitRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        style={styles.checkboxRow}
        onPress={() => toggle.mutate()}
        disabled={toggle.isPending}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: colors.tint },
            habit.completed_on_date && { backgroundColor: colors.tint },
          ]}
        >
          {toggle.isPending ? (
            <ActivityIndicator size="small" color={habit.completed_on_date ? "#fff" : colors.tint} />
          ) : (
            habit.completed_on_date && <Text style={styles.checkmark}>✓</Text>
          )}
        </View>
        <Text
          style={[
            styles.habitName,
            { color: colors.text },
            habit.completed_on_date && styles.habitNameDone,
          ]}
        >
          {habit.name}
        </Text>
      </Pressable>
      <Pressable onPress={() => archive.mutate()} hitSlop={8}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Archive</Text>
      </Pressable>
    </View>
  );
}

export default function HabitsScreen() {
  const colors = useThemeColors();
  const [viewingYesterday, setViewingYesterday] = useState(false);
  const forDate = viewingYesterday ? yesterdayIso() : todayIso();
  const habits = useHabits(forDate);
  const queryClient = useQueryClient();
  const [newHabitName, setNewHabitName] = useState("");

  const createHabit = useMutation({
    mutationFn: () => api.createHabit({ name: newHabitName.trim() }),
    onSuccess: () => {
      setNewHabitName("");
      queryClient.invalidateQueries({ queryKey: queryKeys.habits(forDate) });
    },
  });

  const activeHabits = (habits.data ?? []).filter((h) => h.active);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={[styles.segmented, { borderColor: colors.border }]}>
        <Pressable
          style={[styles.segment, !viewingYesterday && { backgroundColor: colors.tint }]}
          onPress={() => setViewingYesterday(false)}
        >
          <Text style={{ color: !viewingYesterday ? "#fff" : colors.text, fontWeight: "600" }}>
            Today
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segment, viewingYesterday && { backgroundColor: colors.tint }]}
          onPress={() => setViewingYesterday(true)}
        >
          <Text style={{ color: viewingYesterday ? "#fff" : colors.text, fontWeight: "600" }}>
            Yesterday
          </Text>
        </Pressable>
      </View>

      {habits.isLoading && <ActivityIndicator style={{ marginTop: 24 }} />}
      {habits.isError && (
        <Text style={{ color: colors.danger, marginTop: 16 }}>Couldn&apos;t load habits.</Text>
      )}

      {activeHabits.map((h) => (
        <HabitRow key={h.id} habit={h} forDate={forDate} />
      ))}

      {!habits.isLoading && activeHabits.length === 0 && (
        <Text style={{ color: colors.textSecondary, marginTop: 16 }}>
          No habits yet -- add one below.
        </Text>
      )}

      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="New habit"
          placeholderTextColor={colors.textMuted}
          value={newHabitName}
          onChangeText={setNewHabitName}
          onSubmitEditing={() => newHabitName.trim() && createHabit.mutate()}
        />
        <Pressable
          style={[styles.addButton, { backgroundColor: colors.tint }, !newHabitName.trim() && styles.disabled]}
          onPress={() => createHabit.mutate()}
          disabled={!newHabitName.trim() || createHabit.isPending}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  segmented: { flexDirection: "row", borderWidth: 1, borderRadius: 10, overflow: "hidden", marginBottom: 8 },
  segment: { flex: 1, paddingVertical: 10, alignItems: "center" },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: { color: "#fff", fontWeight: "700" },
  habitName: { fontSize: 16, flexShrink: 1 },
  habitNameDone: { textDecorationLine: "line-through", opacity: 0.6 },
  addRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  addButton: { borderRadius: 10, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  addButtonText: { color: "#fff", fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
