import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { ClassCrest } from "@/components/ClassBadge";
import { ProgressBar } from "@/components/ui";
import { CLASS_ORDER, CLASS_THEME, CLASS_THRESHOLDS } from "@/constants/classes";
import { Colors } from "@/constants/Colors";
import { classProgressFraction, formatPoints, pointsToNextClassLabel } from "@/lib/format";
import type { DailyScoreOut } from "@/types/api";

/**
 * Home's headline card: crest, class name, rolling score, and progress
 * toward the next class, on a soft glow in the class's color. Tapping it
 * opens the class ladder.
 */
export function ClassHeroCard({
  today,
  pointsToNextClass,
  onPress,
}: {
  today: DailyScoreOut;
  pointsToNextClass: number | null;
  onPress: () => void;
}) {
  const { color } = CLASS_THEME[today.class_name];
  const progress = classProgressFraction(today.rolling_score, today.class_name, CLASS_THRESHOLDS);
  const nextClass = CLASS_ORDER[CLASS_ORDER.indexOf(today.class_name) + 1];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Your class: ${today.class_name}, ${Math.round(today.rolling_score)} points. Open the class ladder`}
      style={[styles.card, { borderColor: `${color}90`, shadowColor: color }]}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="glow" cx="15%" cy="30%" r="80%">
            <Stop offset="0" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={Colors.card} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#glow)" />
      </Svg>

      <View style={styles.top}>
        <ClassCrest className={today.class_name} size={68} />
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Your class</Text>
          <Text style={styles.className}>{today.class_name}</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.score}>{formatPoints(today.rolling_score)}</Text>
          <Text style={styles.scoreCaption}>pts · last 28 days</Text>
        </View>
      </View>

      <View style={styles.progress}>
        <ProgressBar fraction={progress} color={color} />
        <View style={styles.progressLabels}>
          <Text style={styles.progressText}>{pointsToNextClassLabel(pointsToNextClass, today.class_name)}</Text>
          {nextClass && (
            <Text style={styles.progressText}>
              {formatPoints(today.rolling_score)} / {formatPoints(CLASS_THRESHOLDS[nextClass])}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 16,
    overflow: "hidden",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  top: { flexDirection: "row", alignItems: "center", gap: 14 },
  titleBlock: { flex: 1 },
  eyebrow: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  className: { color: Colors.text, fontSize: 28, fontWeight: "800" },
  scoreBlock: { alignItems: "flex-end" },
  score: { color: Colors.text, fontSize: 22, fontWeight: "800" },
  scoreCaption: { color: Colors.textMuted, fontSize: 11 },
  progress: { gap: 6 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  progressText: { color: Colors.textSecondary, fontSize: 12 },
});
