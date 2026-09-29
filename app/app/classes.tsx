import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ClassCrest } from "@/components/ClassBadge";
import { Card, CenteredMessage, LoadingScreen } from "@/components/ui";
import { CLASS_BLURB, CLASS_ORDER, CLASS_THEME, CLASS_THRESHOLDS } from "@/constants/classes";
import { Colors } from "@/constants/Colors";
import { useScore } from "@/hooks/queries";
import { classRangeLabel } from "@/lib/format";

/** Every class from the top down, with its point range; the user's current
 * class is highlighted. */
export default function ClassLadderScreen() {
  const score = useScore();
  if (score.isLoading) return <LoadingScreen />;
  if (score.isError || !score.data) return <CenteredMessage tone="danger">Couldn&apos;t load your class.</CenteredMessage>;

  const current = score.data.today.class_name;
  const topDown = [...CLASS_ORDER].reverse();

  return (
    <ScrollView style={{ backgroundColor: Colors.background }} contentContainerStyle={styles.container}>
      {topDown.map((name) => {
        const index = CLASS_ORDER.indexOf(name);
        const next = CLASS_ORDER[index + 1];
        const isCurrent = name === current;
        const { color } = CLASS_THEME[name];
        return (
          <Card key={name} glow={isCurrent ? color : undefined} style={styles.row}>
            <ClassCrest className={name} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.range}>
                {classRangeLabel(CLASS_THRESHOLDS[name], next ? CLASS_THRESHOLDS[next] : null)}
              </Text>
              <Text style={styles.blurb}>{CLASS_BLURB[name]}</Text>
            </View>
            {isCurrent && (
              <View style={[styles.currentPill, { borderColor: color }]}>
                <Text style={styles.currentText}>Current</Text>
              </View>
            )}
          </Card>
        );
      })}
      <Text style={styles.footnote}>
        Your class is based on your total points over the last 28 days, from habits and workouts alike. You&apos;re
        promoted as soon as you cross a line, but only demoted after 7 days in a row more than 10% below your
        class&apos;s line, so an off week won&apos;t drop you.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  name: { color: Colors.text, fontSize: 17, fontWeight: "800" },
  range: { color: Colors.textSecondary, fontSize: 13, marginTop: 1 },
  blurb: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  currentPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  currentText: { color: Colors.text, fontSize: 12, fontWeight: "700" },
  footnote: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
