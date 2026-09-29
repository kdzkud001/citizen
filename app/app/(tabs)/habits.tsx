import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
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

import { CategoryPicker, WeeklyTargetStepper } from "@/components/HabitFields";
import { DEFAULT_HABIT_CATEGORY, DEFAULT_WEEKLY_TARGET, HABIT_CATEGORIES } from "@/constants/habits";
import { queryKeys, useHabits } from "@/hooks/queries";
import { useThemeColors } from "@/hooks/useThemeColors";
import { api } from "@/lib/api";
import { groupByCategory } from "@/lib/habits";
import type { HabitCategory, HabitWithCompletionOut } from "@/types/api";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Habit changes move scores and the wheel, so refetch all three. Habit
 * lists are invalidated by prefix so both the today and yesterday views
 * refresh. */
function useInvalidateHabitData() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["habits"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.score });
    queryClient.invalidateQueries({ queryKey: queryKeys.wheel });
  };
}

function HabitEditor({ habit, onDone }: { habit: HabitWithCompletionOut; onDone: () => void }) {
  const colors = useThemeColors();
  const invalidate = useInvalidateHabitData();
  const [category, setCategory] = useState<HabitCategory>(habit.category);
  const [weeklyTarget, setWeeklyTarget] = useState(habit.weekly_target);

  const save = useMutation({
    mutationFn: () => api.updateHabit(habit.id, { category, weekly_target: weeklyTarget }),
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  const archive = useMutation({
    mutationFn: () => api.updateHabit(habit.id, { active: false }),
    onSuccess: invalidate,
  });

  return (
    <View style={styles.editor}>
      <CategoryPicker value={category} onChange={setCategory} />
      <WeeklyTargetStepper value={weeklyTarget} onChange={setWeeklyTarget} />
      <View style={styles.editorButtons}>
        <Pressable onPress={() => archive.mutate()} disabled={archive.isPending} hitSlop={8}>
          <Text style={{ color: colors.danger }}>Archive</Text>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <Pressable onPress={onDone} hitSlop={8}>
            <Text style={{ color: colors.textSecondary }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => save.mutate()} disabled={save.isPending} hitSlop={8}>
            {save.isPending ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <Text style={{ color: colors.tint, fontWeight: "600" }}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function HabitRow({ habit, forDate }: { habit: HabitWithCompletionOut; forDate: string }) {
  const colors = useThemeColors();
  const invalidate = useInvalidateHabitData();
  const [editing, setEditing] = useState(false);

  const toggle = useMutation({
    mutationFn: () =>
      habit.completed_on_date
        ? api.deleteHabitCompletion(habit.id, forDate)
        : api.logHabitCompletion(habit.id, { completed_on: forDate }),
    onSuccess: invalidate,
  });

  return (
    <View style={[styles.habitRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.habitMain}>
        <Pressable
          style={styles.checkboxRow}
          onPress={() => toggle.mutate()}
          disabled={toggle.isPending}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: habit.completed_on_date }}
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
          <View style={{ flexShrink: 1 }}>
            <Text
              style={[styles.habitName, { color: colors.text }, habit.completed_on_date && styles.habitNameDone]}
            >
              {habit.name}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {habit.weekly_target === 7 ? "Every day" : `${habit.weekly_target}× a week`}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setEditing((e) => !e)} hitSlop={8}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{editing ? "Close" : "Edit"}</Text>
        </Pressable>
      </View>
      {editing && <HabitEditor habit={habit} onDone={() => setEditing(false)} />}
    </View>
  );
}

function AddHabitForm({ defaultCategory }: { defaultCategory: HabitCategory }) {
  const colors = useThemeColors();
  const invalidate = useInvalidateHabitData();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<HabitCategory>(defaultCategory);
  const [weeklyTarget, setWeeklyTarget] = useState(DEFAULT_WEEKLY_TARGET);

  const create = useMutation({
    mutationFn: () => api.createHabit({ name: name.trim(), category, weekly_target: weeklyTarget }),
    onSuccess: () => {
      setName("");
      invalidate();
    },
  });

  const canAdd = name.trim().length > 0 && !create.isPending;

  return (
    <View style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionHeader, { color: colors.text }]}>Add a habit</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        placeholder="e.g. Read 10 pages"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
        onSubmitEditing={() => canAdd && create.mutate()}
      />
      <CategoryPicker value={category} onChange={setCategory} />
      <WeeklyTargetStepper value={weeklyTarget} onChange={setWeeklyTarget} />
      <Pressable
        style={[styles.addButton, { backgroundColor: colors.tint }, !canAdd && styles.disabled]}
        onPress={() => create.mutate()}
        disabled={!canAdd}
      >
        {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.addButtonText}>Add</Text>}
      </Pressable>
    </View>
  );
}

export default function HabitsScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ category?: string }>();
  const filter = HABIT_CATEGORIES.find((c) => c === params.category);
  const [viewingYesterday, setViewingYesterday] = useState(false);
  const forDate = viewingYesterday ? yesterdayIso() : todayIso();
  const habits = useHabits(forDate);

  const active = (habits.data ?? []).filter((h) => h.active && (!filter || h.category === filter));
  const sections = groupByCategory(active);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={[styles.segmented, { borderColor: colors.border }]}>
        {([false, true] as const).map((yesterday) => {
          const selected = viewingYesterday === yesterday;
          return (
            <Pressable
              key={String(yesterday)}
              style={[styles.segment, selected && { backgroundColor: colors.tint }]}
              onPress={() => setViewingYesterday(yesterday)}
            >
              <Text style={{ color: selected ? "#fff" : colors.text, fontWeight: "600" }}>
                {yesterday ? "Yesterday" : "Today"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filter && (
        <View style={[styles.filterBar, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text }}>
            Showing <Text style={{ fontWeight: "700" }}>{filter}</Text> habits
          </Text>
          <Pressable onPress={() => router.setParams({ category: "" })} hitSlop={8}>
            <Text style={{ color: colors.tint, fontWeight: "600" }}>Show all</Text>
          </Pressable>
        </View>
      )}

      {habits.isLoading && <ActivityIndicator style={{ marginTop: 24 }} />}
      {habits.isError && (
        <Text style={{ color: colors.danger, marginTop: 16 }}>Couldn&apos;t load habits.</Text>
      )}

      {sections.map((section) => (
        <View key={section.category} style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{section.category}</Text>
          {section.habits.map((h) => (
            <HabitRow key={h.id} habit={h} forDate={forDate} />
          ))}
        </View>
      ))}

      {!habits.isLoading && sections.length === 0 && (
        <Text style={{ color: colors.textSecondary, marginTop: 16 }}>
          {filter ? `No ${filter} habits yet. Add one below.` : "No habits yet. Add one below."}
        </Text>
      )}

      <AddHabitForm key={filter ?? "all"} defaultCategory={filter ?? DEFAULT_HABIT_CATEGORY} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  segmented: { flexDirection: "row", borderWidth: 1, borderRadius: 10, overflow: "hidden", marginBottom: 4 },
  segment: { flex: 1, paddingVertical: 10, alignItems: "center" },
  filterBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  section: { gap: 8, marginTop: 6 },
  sectionHeader: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  habitRow: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 12 },
  habitMain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
  habitName: { fontSize: 16 },
  habitNameDone: { textDecorationLine: "line-through", opacity: 0.6 },
  editor: { gap: 12 },
  editorButtons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 12, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  addButton: { borderRadius: 10, padding: 12, alignItems: "center" },
  addButtonText: { color: "#fff", fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
