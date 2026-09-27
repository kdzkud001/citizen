import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/hooks/useAuth";
import { queryKeys, useLyftaStatus, useProfile } from "@/hooks/queries";
import { useThemeColors } from "@/hooks/useThemeColors";
import { api, ApiError } from "@/lib/api";
import type { ProfileOut } from "@/types/api";

function formatLastSynced(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(iso).toLocaleDateString();
}

function LyftaSection() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const status = useLyftaStatus();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidateStatus = () => queryClient.invalidateQueries({ queryKey: queryKeys.lyftaStatus });

  const connect = useMutation({
    mutationFn: () => api.connectLyfta({ api_key: apiKey.trim() }),
    onSuccess: () => {
      setApiKey("");
      invalidateStatus();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't connect"),
  });

  const sync = useMutation({
    mutationFn: api.syncLyfta,
    onSuccess: () => {
      invalidateStatus();
      queryClient.invalidateQueries({ queryKey: queryKeys.score });
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts() });
    },
  });

  const disconnect = useMutation({
    mutationFn: api.disconnectLyfta,
    onSuccess: invalidateStatus,
  });

  if (status.isLoading) return <ActivityIndicator style={{ marginTop: 12 }} />;

  if (!status.data?.connected) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Lyfta</Text>
        <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Not connected.</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Lyfta API key"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          value={apiKey}
          onChangeText={setApiKey}
        />
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
        <Pressable
          style={[styles.secondaryButton, { borderColor: colors.tint }, !apiKey && styles.disabled]}
          onPress={() => {
            setError(null);
            connect.mutate();
          }}
          disabled={!apiKey || connect.isPending}
        >
          {connect.isPending ? (
            <ActivityIndicator color={colors.tint} />
          ) : (
            <Text style={{ color: colors.tint, fontWeight: "600" }}>Connect</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Lyfta</Text>
      <Text style={{ color: colors.textSecondary }}>
        Connected · Last sync: {formatLastSynced(status.data.last_synced_at)}
        {status.data.last_sync_status ? ` (${status.data.last_sync_status})` : ""}
      </Text>
      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.secondaryButton, { borderColor: colors.tint, flex: 1 }]}
          onPress={() => sync.mutate()}
          disabled={sync.isPending}
        >
          {sync.isPending ? (
            <ActivityIndicator color={colors.tint} />
          ) : (
            <Text style={{ color: colors.tint, fontWeight: "600" }}>Sync now</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, { borderColor: colors.danger, flex: 1 }]}
          onPress={() => disconnect.mutate()}
          disabled={disconnect.isPending}
        >
          <Text style={{ color: colors.danger, fontWeight: "600" }}>Disconnect</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Local edit state is seeded straight from `profile` (a prop, not a
 * query result) via useState's lazy initializer -- no effect needed to
 * sync it, since this component is remounted (via `key` in the parent)
 * whenever a different profile loads. */
function ProfileSection({ profile }: { profile: ProfileOut }) {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [weeklyTarget, setWeeklyTarget] = useState(profile.weekly_session_target);

  const save = useMutation({
    mutationFn: () =>
      api.updateMe({ display_name: displayName.trim() || null, weekly_session_target: weeklyTarget }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.score });
    },
  });

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile</Text>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Display name</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        value={displayName}
        onChangeText={setDisplayName}
        placeholderTextColor={colors.textMuted}
      />
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Weekly session target: {weeklyTarget}
      </Text>
      <View style={styles.stepperRow}>
        <Pressable
          style={[styles.stepperButton, { borderColor: colors.border }]}
          onPress={() => setWeeklyTarget((t) => Math.max(1, t - 1))}
        >
          <Text style={{ color: colors.text, fontSize: 18 }}>−</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", minWidth: 20, textAlign: "center" }}>
          {weeklyTarget}
        </Text>
        <Pressable
          style={[styles.stepperButton, { borderColor: colors.border }]}
          onPress={() => setWeeklyTarget((t) => Math.min(14, t + 1))}
        >
          <Text style={{ color: colors.text, fontSize: 18 }}>+</Text>
        </Pressable>
      </View>
      <Pressable
        style={[styles.secondaryButton, { borderColor: colors.tint, marginTop: 12 }]}
        onPress={() => save.mutate()}
        disabled={save.isPending}
      >
        {save.isPending ? (
          <ActivityIndicator color={colors.tint} />
        ) : (
          <Text style={{ color: colors.tint, fontWeight: "600" }}>Save</Text>
        )}
      </Pressable>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useThemeColors();
  const { signOut } = useAuth();
  const profile = useProfile();

  function confirmSignOut() {
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      {profile.data ? (
        <ProfileSection key={profile.data.id} profile={profile.data} />
      ) : (
        <ActivityIndicator />
      )}

      <LyftaSection />

      <Pressable style={[styles.leaveButton, { borderColor: colors.danger }]} onPress={confirmSignOut}>
        <Text style={{ color: colors.danger, fontWeight: "600" }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 24 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  secondaryButton: { borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1 },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  disabled: { opacity: 0.5 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 4 },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveButton: { borderRadius: 10, padding: 14, alignItems: "center", borderWidth: 1 },
});
