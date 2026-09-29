import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Colors } from "@/constants/Colors";

/** A navy panel. `glow` tints the border (and a soft shadow on iOS) with a
 * data color, e.g. the current class's. */
export function Card({
  children,
  glow,
  style,
}: {
  children: ReactNode;
  glow?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.card,
        glow && { borderColor: `${glow}80`, shadowColor: glow, shadowOpacity: 0.35, shadowRadius: 14 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      style={[styles.primary, (disabled || loading) && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
    >
      {loading ? <ActivityIndicator color={Colors.onTint} /> : <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
  loading,
  tone = "tint",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: "tint" | "danger" | "neutral";
}) {
  const color = tone === "danger" ? Colors.danger : tone === "neutral" ? Colors.text : Colors.tint;
  return (
    <Pressable
      style={[
        styles.secondary,
        { borderColor: tone === "neutral" ? Colors.borderStrong : color },
        (disabled || loading) && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.secondaryText, { color }]}>{label}</Text>}
    </Pressable>
  );
}

export function CenteredMessage({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "danger" }) {
  return (
    <View style={styles.center}>
      <Text style={{ color: tone === "danger" ? Colors.danger : Colors.textSecondary, textAlign: "center" }}>
        {children}
      </Text>
    </View>
  );
}

export function LoadingScreen() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={Colors.tint} />
    </View>
  );
}

/** Thin progress track with a rounded fill; `fraction` is clamped to 0-1. */
export function ProgressBar({ fraction, color = Colors.tint }: { fraction: number; color?: string }) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export const inputStyle = {
  borderWidth: 1,
  borderColor: Colors.borderStrong,
  backgroundColor: Colors.cardRaised,
  color: Colors.text,
  borderRadius: 12,
  padding: 13,
  fontSize: 15,
} as const;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 8,
  },
  sectionTitle: { color: Colors.text, fontSize: 17, fontWeight: "700" },
  sectionAction: { color: Colors.tint, fontSize: 14, fontWeight: "600" },
  primary: {
    backgroundColor: Colors.tint,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: Colors.onTint, fontSize: 16, fontWeight: "700" },
  secondary: { borderRadius: 999, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  secondaryText: { fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: Colors.background,
  },
  track: { height: 8, borderRadius: 4, backgroundColor: Colors.cardRaised, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
});
