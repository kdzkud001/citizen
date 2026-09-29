import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { CategoryIcon } from "@/components/CategoryIcon";
import { CategoryPicker, WeeklyTargetStepper } from "@/components/HabitFields";
import { HabitCheckRow, useInvalidateHabitData } from "@/components/HabitCheckRow";
import { Card, PrimaryButton, SecondaryButton, inputStyle } from "@/components/ui";
import { Colors } from "@/constants/Colors";
import { DEFAULT_HABIT_CATEGORY, DEFAULT_WEEKLY_TARGET, HABIT_CATEGORIES } from "@/constants/habits";
import { useHabits } from "@/hooks/queries";
import { api } from "@/lib/api";
import { todayIso, yesterdayIso } from "@/lib/dates";
import { groupByCategory } from "@/lib/habits";
import type { HabitCategory, HabitWithCompletionOut } from "@/types/api";

function HabitEditor({ habit, onDone }: { habit: HabitWithCompletionOut; onDone: () => void }) {
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
          <Text style={{ color: Colors.danger }}>Archive</Text>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 20 }}>
          <Pressable onPress={onDone} hitSlop={8}>
            <Text style={{ color: Colors.textSecondary }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => save.mutate()} disabled={save.isPending} hitSlop={8}>
            {save.isPending ? (
              <ActivityIndicator size="small" color={Colors.tint} />
            ) : (
              <Text style={{ color: Colors.tint, fontWeight: "700" }}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>
      {(save.isError || archive.isError) && <Text style={{ color: Colors.danger }}>Couldn&apos;t save changes.</Text>}
    </View>
  );
}

function EditableHabitRow({ habit, forDate }: { habit: HabitWithCompletionOut; forDate: string }) {
  const [editing, setEditing] = useState(false);
  return (
    <HabitCheckRow
      habit={habit}
      forDate={forDate}
      accessory={
        <Pressable onPress={() => setEditing((e) => !e)} hitSlop={8} accessibilityLabel={`Edit ${habit.name}`}>
          <Text style={styles.editLink}>{editing ? "Close" : "Edit"}</Text>
        </Pressable>
      }
    >
      {editing && <HabitEditor habit={habit} onDone={() => setEditing(false)} />}
    </HabitCheckRow>
  );
}

function AddHabitForm({ defaultCategory, onClose }: { defaultCategory: HabitCategory; onClose: () => void }) {
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
    <Card style={{ gap: 12 }}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>New habit</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={{ color: Colors.textSecondary }}>Done</Text>
        </Pressable>
      </View>
      <TextInput
        style={inputStyle}
        placeholder="e.g. Read 10 pages"
        placeholderTextColor={Colors.textMuted}
        value={name}
        onChangeText={setName}
        onSubmitEditing={() => canAdd && create.mutate()}
      />
      <CategoryPicker value={category} onChange={setCategory} />
      <WeeklyTargetStepper value={weeklyTarget} onChange={setWeeklyTarget} />
      {create.isError && <Text style={{ color: Colors.danger }}>Couldn&apos;t add that habit.</Text>}
      <PrimaryButton label="Add habit" onPress={() => create.mutate()} disabled={!canAdd} loading={create.isPending} />
    </Card>
  );
}

export default function HabitsScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const filter = HABIT_CATEGORIES.find((c) => c === params.category);
  const [viewingYesterday, setViewingYesterday] = useState(false);
  const [adding, setAdding] = useState(false);
  const forDate = viewingYesterday ? yesterdayIso() : todayIso();
  const habits = useHabits(forDate);

  const active = (habits.data ?? []).filter((h) => h.active && (!filter || h.category === filter));
  const sections = groupByCategory(active);
  const done = active.filter((h) => h.completed_on_date).length;

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.segmented}>
        {([false, true] as const).map((yesterday) => {
          const selected = viewingYesterday === yesterday;
          return (
            <Pressable
              key={String(yesterday)}
              style={[styles.segment, selected && styles.segmentSelected]}
              onPress={() => setViewingYesterday(yesterday)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {yesterday ? "Yesterday" : "Today"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filter && (
        <Card style={styles.filterBar}>
          <CategoryIcon category={filter} size={24} />
          <Text style={{ color: Colors.text, flex: 1 }}>
            Showing <Text style={{ fontWeight: "700" }}>{filter}</Text> habits
          </Text>
          <Pressable onPress={() => router.setParams({ category: "" })} hitSlop={8}>
            <Text style={{ color: Colors.tint, fontWeight: "600" }}>Show all</Text>
          </Pressable>
        </Card>
      )}

      {habits.isLoading && <ActivityIndicator color={Colors.tint} style={{ marginTop: 24 }} />}
      {habits.isError && <Text style={{ color: Colors.danger, marginTop: 16 }}>Couldn&apos;t load habits.</Text>}

      {active.length > 0 && (
        <Text style={styles.summary}>
          {done} of {active.length} done {viewingYesterday ? "yesterday" : "today"}
        </Text>
      )}

      {sections.map((section) => (
        <View key={section.category} style={styles.section}>
          <Text style={styles.sectionHeader}>{section.category}</Text>
          {section.habits.map((h) => (
            <EditableHabitRow key={h.id} habit={h} forDate={forDate} />
          ))}
        </View>
      ))}

      {!habits.isLoading && !habits.isError && sections.length === 0 && (
        <Text style={styles.summary}>{filter ? `No ${filter} habits yet.` : "No habits yet."}</Text>
      )}

      <View style={{ marginTop: 8 }}>
        {adding ? (
          <AddHabitForm
            key={filter ?? "all"}
            defaultCategory={filter ?? DEFAULT_HABIT_CATEGORY}
            onClose={() => setAdding(false)}
          />
        ) : (
          <SecondaryButton label="+ Add habit" onPress={() => setAdding(true)} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 10 },
  segmented: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
  },
  segment: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 999 },
  segmentSelected: { backgroundColor: Colors.tint },
  segmentText: { color: Colors.textSecondary, fontWeight: "600" },
  segmentTextSelected: { color: Colors.onTint },
  filterBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  summary: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  section: { gap: 8, marginTop: 8 },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  editLink: { color: Colors.textMuted, fontSize: 13, marginRight: 4 },
  editor: { gap: 12, paddingTop: 4 },
  editorButtons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  formHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  formTitle: { color: Colors.text, fontSize: 16, fontWeight: "700" },
});
