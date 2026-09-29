import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useOnboarding } from "@/hooks/useOnboarding";
import { useThemeColors } from "@/hooks/useThemeColors";
import { api, ApiError } from "@/lib/api";

const LYFTA_KEYS_URL = "https://my.lyfta.app/developers";

export default function OnboardingScreen() {
  const colors = useThemeColors();
  const { markComplete } = useOnboarding();

  const [displayName, setDisplayName] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState(3);
  const [lyftaKey, setLyftaKey] = useState("");
  const [lyftaConnected, setLyftaConnected] = useState(false);
  const [lyftaError, setLyftaError] = useState<string | null>(null);

  const connectLyfta = useMutation({
    mutationFn: () => api.connectLyfta({ api_key: lyftaKey.trim() }),
    onSuccess: () => {
      setLyftaConnected(true);
      setLyftaError(null);
    },
    onError: (e) => setLyftaError(e instanceof ApiError ? e.message : "Couldn't connect"),
  });

  const finish = useMutation({
    mutationFn: () =>
      api.updateMe({
        display_name: displayName.trim() || null,
        weekly_session_target: weeklyTarget,
      }),
    onSuccess: () => markComplete(),
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>Set up your profile</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Display name</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="What should we call you?"
          placeholderTextColor={colors.textMuted}
          value={displayName}
          onChangeText={setDisplayName}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Weekly session target: {weeklyTarget}
        </Text>
        <View style={styles.stepperRow}>
          <Pressable
            style={[styles.stepperButton, { borderColor: colors.border }]}
            onPress={() => setWeeklyTarget((t) => Math.max(1, t - 1))}
          >
            <Text style={[styles.stepperText, { color: colors.text }]}>−</Text>
          </Pressable>
          <Text style={[styles.stepperValue, { color: colors.text }]}>{weeklyTarget}</Text>
          <Pressable
            style={[styles.stepperButton, { borderColor: colors.border }]}
            onPress={() => setWeeklyTarget((t) => Math.min(14, t + 1))}
          >
            <Text style={[styles.stepperText, { color: colors.text }]}>+</Text>
          </Pressable>
        </View>

        <Text style={[styles.label, { color: colors.textSecondary, marginTop: 24 }]}>
          Connect Lyfta (optional)
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: 8 }}>
          Get a personal API key from your Lyfta account at{" "}
          <Text style={{ color: colors.tint }} onPress={() => Linking.openURL(LYFTA_KEYS_URL)}>
            my.lyfta.app/developers
          </Text>
          , then paste it below. You can always do this later from Profile.
        </Text>

        {lyftaConnected ? (
          <Text style={{ color: colors.tint, fontWeight: "600" }}>✓ Lyfta connected</Text>
        ) : (
          <>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Lyfta API key"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              value={lyftaKey}
              onChangeText={setLyftaKey}
            />
            {lyftaError && <Text style={{ color: colors.danger }}>{lyftaError}</Text>}
            <Pressable
              style={[
                styles.secondaryButton,
                { borderColor: colors.tint },
                (!lyftaKey || connectLyfta.isPending) && styles.buttonDisabled,
              ]}
              onPress={() => connectLyfta.mutate()}
              disabled={!lyftaKey || connectLyfta.isPending}
            >
              {connectLyfta.isPending ? (
                <ActivityIndicator color={colors.tint} />
              ) : (
                <Text style={{ color: colors.tint, fontWeight: "600" }}>Connect</Text>
              )}
            </Pressable>
          </>
        )}

        <Pressable
          style={[styles.button, { backgroundColor: colors.tint, marginTop: 32 }]}
          onPress={() => finish.mutate()}
          disabled={finish.isPending}
        >
          {finish.isPending ? (
            <ActivityIndicator color={colors.onTint} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.onTint }]}>Continue</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 8 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16, marginTop: 4 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperText: { fontSize: 20, fontWeight: "600" },
  stepperValue: { fontSize: 18, fontWeight: "700", minWidth: 24, textAlign: "center" },
  button: { borderRadius: 999, padding: 14, alignItems: "center" },
  secondaryButton: { borderRadius: 999, padding: 14, alignItems: "center", borderWidth: 1, marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: "700" },
});
