import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polygon } from "react-native-svg";

import { useThemeColors } from "@/hooks/useThemeColors";
import { radarPoint, radarPolygon } from "@/lib/radar";
import type { HabitCategory, WheelOut } from "@/types/api";

// Sized so the side labels stay inside the box: CENTER must cover
// LABEL_RADIUS * cos(18deg) + LABEL_WIDTH / 2. 280px fits a 360px-wide
// phone after screen and card padding.
const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 75;
const LABEL_RADIUS = RADIUS + 28;
const LABEL_WIDTH = 84;
const GRID_LEVELS = [25, 50, 75, 100];

interface Props {
  wheel: WheelOut;
  onSelectCategory: (category: HabitCategory) => void;
}

/**
 * Radar chart, one spoke per category on a 0-100 scale. The current window
 * is filled and the previous window is a dashed outline. Categories that
 * aren't tracking are greyed out and labeled "not tracking". Each label is
 * a Pressable (a bigger hit target than the SVG geometry) that opens that
 * category's habits.
 */
export function WellnessWheel({ wheel, onSelectCategory }: Props) {
  const colors = useThemeColors();
  const current = wheel.current.spokes;
  const previous = wheel.previous.spokes;
  const count = current.length;

  return (
    <View>
      <View style={styles.chart}>
        <Svg width={SIZE} height={SIZE}>
          {GRID_LEVELS.map((level) => (
            <Polygon
              key={level}
              points={radarPolygon(Array(count).fill(level), RADIUS, CENTER)}
              fill="none"
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {current.map((spoke, i) => {
            const tip = radarPoint(i, count, 100, RADIUS, CENTER);
            return (
              <Line
                key={spoke.category}
                x1={CENTER}
                y1={CENTER}
                x2={tip.x}
                y2={tip.y}
                stroke={spoke.tracking ? colors.border : colors.textMuted}
                strokeWidth={1}
                strokeDasharray={spoke.tracking ? undefined : "2 3"}
              />
            );
          })}
          <Polygon
            points={radarPolygon(previous.map((s) => s.percent), RADIUS, CENTER)}
            fill="none"
            stroke={colors.textSecondary}
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          <Polygon
            points={radarPolygon(current.map((s) => s.percent), RADIUS, CENTER)}
            fill={colors.tint}
            fillOpacity={0.25}
            stroke={colors.tint}
            strokeWidth={2}
          />
          {current.map((spoke, i) => {
            if (!spoke.tracking) return null;
            const p = radarPoint(i, count, spoke.percent, RADIUS, CENTER);
            return <Circle key={spoke.category} cx={p.x} cy={p.y} r={4} fill={colors.tint} />;
          })}
        </Svg>

        {current.map((spoke, i) => {
          const p = radarPoint(i, count, 100, LABEL_RADIUS, CENTER);
          const muted = !spoke.tracking;
          return (
            <Pressable
              key={spoke.category}
              onPress={() => onSelectCategory(spoke.category)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                muted
                  ? `${spoke.category}, not tracking. Open ${spoke.category} habits`
                  : `${spoke.category}, ${Math.round(spoke.percent)} percent. Open ${spoke.category} habits`
              }
              style={[styles.label, { left: p.x - LABEL_WIDTH / 2, top: p.y - 18 }]}
            >
              <Text style={[styles.labelTitle, { color: muted ? colors.textMuted : colors.text }]}>
                {spoke.category}
              </Text>
              <Text style={[styles.labelValue, { color: muted ? colors.textMuted : colors.textSecondary }]}>
                {muted ? "not tracking" : `${Math.round(spoke.percent)}%`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatchFilled, { backgroundColor: colors.tint }]} />
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Last {wheel.days} days</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatchDashed, { borderColor: colors.textSecondary }]} />
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Previous {wheel.days} days</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { width: SIZE, height: SIZE, alignSelf: "center" },
  label: { position: "absolute", width: LABEL_WIDTH, alignItems: "center" },
  labelTitle: { fontSize: 13, fontWeight: "600" },
  labelValue: { fontSize: 12 },
  legend: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatchFilled: { width: 14, height: 10, borderRadius: 2, opacity: 0.6 },
  swatchDashed: { width: 14, height: 10, borderRadius: 2, borderWidth: 1.5, borderStyle: "dashed" },
});
