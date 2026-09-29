import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ClassCrest } from "@/components/ClassBadge";
import { Icon } from "@/components/Icon";
import { Card, PrimaryButton, SecondaryButton, SectionHeader, inputStyle } from "@/components/ui";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys, useLyftaStatus, useProfile, useScore } from "@/hooks/queries";
import { api, ApiError } from "@/lib/api";
import { formatPoints, initials } from "@/lib/format";
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

function ProfileHeader({ profile }: { profile: ProfileOut | undefined }) {
  const score = useScore();
  const today = score.data?.today;

  return (
    <Card style={styles.header}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(profile?.display_name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{profile?.display_name || "No name yet"}</Text>
        {today && (
          <Text style={styles.muted}>
            {today.class_name} · {formatPoints(today.rolling_score)} pts
          </Text>
        )}
      </View>
      {today && <ClassCrest className={today.class_name} size={40} />}
    </Card>
  );
}

function LinkRow({ label, icon, onPress }: { label: string; icon: { ios: string; android: string }; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={styles.linkRow}>
        <Icon icon={icon} color={Colors.tint} size={20} />
        <Text style={styles.linkLabel}>{label}</Text>
        <Text style={styles.chevron}>›</Text>
      </Card>
    </Pressable>
  );
}

function LyftaSection() {
  const queryClient = useQueryClient();
  const status = useLyftaStatus();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Lyfta connection state and synced sessions both feed the wheel's Fitness spoke.
  const invalidateStatus = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.lyftaStatus });
    queryClient.invalidateQueries({ queryKey: queryKeys.wheel });
  };

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
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
    },
  });

  const disconnect = useMutation({
    mutationFn: api.disconnectLyfta,
    onSuccess: invalidateStatus,
  });

  if (status.isLoading) return <ActivityIndicator color={Colors.tint} style={{ marginTop: 12 }} />;

  if (!status.data?.connected) {
    return (
      <Card style={{ gap: 10 }}>
        <Text style={styles.muted}>Not connected. Paste your personal API key from my.lyfta.app/developers.</Text>
        <TextInput
          style={inputStyle}
          placeholder="Lyfta API key"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          value={apiKey}
          onChangeText={setApiKey}
        />
        {error && <Text style={{ color: Colors.danger }}>{error}</Text>}
        <SecondaryButton
          label="Connect"
          onPress={() => {
            setError(null);
            connect.mutate();
          }}
          disabled={!apiKey}
          loading={connect.isPending}
        />
      </Card>
    );
  }

  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.muted}>
        ✓ Connected · Last sync: {formatLastSynced(status.data.last_synced_at)}
        {status.data.last_sync_status ? ` (${status.data.last_sync_status})` : ""}
      </Text>
      <View style={styles.buttonRow}>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="Sync now" onPress={() => sync.mutate()} loading={sync.isPending} />
        </View>
        <View style={{ flex: 1 }}>
          <SecondaryButton
            label="Disconnect"
            tone="danger"
            onPress={() => disconnect.mutate()}
            loading={disconnect.isPending}
          />
        </View>
      </View>
      {sync.isError && <Text style={{ color: Colors.danger }}>Sync failed. Try again.</Text>}
    </Card>
  );
}

/** Local edit state is seeded straight from `profile` (a prop, not a
 * query result) via useState's lazy initializer -- no effect needed to
 * sync it, since this component is remounted (via `key` in the parent)
 * whenever a different profile loads. */
function ProfileForm({ profile }: { profile: ProfileOut }) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [weeklyTarget, setWeeklyTarget] = useState(profile.weekly_session_target);

  const save = useMutation({
    mutationFn: () =>
      api.updateMe({ display_name: displayName.trim() || null, weekly_session_target: weeklyTarget }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.score });
      queryClient.invalidateQueries({ queryKey: queryKeys.wheel });
    },
  });

  return (
    <Card style={{ gap: 8 }}>
      <Text style={styles.label}>Display name</Text>
      <TextInput
        style={inputStyle}
        value={displayName}
        onChangeText={setDisplayName}
        placeholderTextColor={Colors.textMuted}
      />
      <Text style={[styles.label, { marginTop: 8 }]}>Weekly workout target</Text>
      <View style={styles.stepperRow}>
        <Text style={{ color: Colors.textSecondary, flex: 1 }}>
          {weeklyTarget} session{weeklyTarget === 1 ? "" : "s"} a week
        </Text>
        <Pressable
          style={styles.stepperButton}
          onPress={() => setWeeklyTarget((t) => Math.max(1, t - 1))}
          accessibilityLabel="Fewer sessions per week"
        >
          <Text style={styles.stepperGlyph}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{weeklyTarget}</Text>
        <Pressable
          style={styles.stepperButton}
          onPress={() => setWeeklyTarget((t) => Math.min(14, t + 1))}
          accessibilityLabel="More sessions per week"
        >
          <Text style={styles.stepperGlyph}>+</Text>
        </Pressable>
      </View>
      <View style={{ marginTop: 8 }}>
        <PrimaryButton label={save.isSuccess ? "Saved" : "Save"} onPress={() => save.mutate()} loading={save.isPending} />
      </View>
      {save.isError && <Text style={{ color: Colors.danger }}>Couldn&apos;t save.</Text>}
    </Card>
  );
}

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const profile = useProfile();

  function confirmSignOut() {
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <ProfileHeader profile={profile.data} />

      <LinkRow label="Class ladder" icon={{ ios: "list.number", android: "format_list_numbered" }} onPress={() => router.push("/classes")} />
      <LinkRow label="Workouts" icon={{ ios: "dumbbell.fill", android: "fitness_center" }} onPress={() => router.push("/workouts")} />

      <SectionHeader title="Profile" />
      {profile.data ? (
        <ProfileForm key={profile.data.id} profile={profile.data} />
      ) : (
        <ActivityIndicator color={Colors.tint} />
      )}

      <SectionHeader title="Lyfta" />
      <LyftaSection />

      <View style={{ marginTop: 16 }}>
        <SecondaryButton label="Sign out" tone="danger" onPress={confirmSignOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.cardRaised,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: Colors.text, fontWeight: "800", fontSize: 20 },
  name: { color: Colors.text, fontSize: 20, fontWeight: "800" },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  linkLabel: { color: Colors.text, fontSize: 15, fontWeight: "600", flex: 1 },
  chevron: { color: Colors.textMuted, fontSize: 22 },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  buttonRow: { flexDirection: "row", gap: 8 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperGlyph: { color: Colors.text, fontSize: 18 },
  stepperValue: { color: Colors.text, fontWeight: "700", minWidth: 16, textAlign: "center" },
});
