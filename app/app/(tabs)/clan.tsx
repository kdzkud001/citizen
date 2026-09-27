import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ClassBadge } from "@/components/ClassBadge";
import { queryKeys, useClan } from "@/hooks/queries";
import { useThemeColors } from "@/hooks/useThemeColors";
import { api, ApiError } from "@/lib/api";

function CreateOrJoinClan() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.clan });

  const create = useMutation({
    mutationFn: () => api.createClan({ name: name.trim() }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't create clan"),
  });

  const join = useMutation({
    mutationFn: () => api.joinClan({ invite_code: inviteCode.trim() }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't join clan"),
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Create a clan</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        placeholder="Clan name"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
      />
      <Pressable
        style={[styles.button, { backgroundColor: colors.tint }, !name.trim() && styles.disabled]}
        onPress={() => {
          setError(null);
          create.mutate();
        }}
        disabled={!name.trim() || create.isPending}
      >
        {create.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create clan</Text>
        )}
      </Pressable>

      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 32 }]}>
        Join with an invite code
      </Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        placeholder="Invite code"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        value={inviteCode}
        onChangeText={setInviteCode}
      />
      <Pressable
        style={[
          styles.secondaryButton,
          { borderColor: colors.tint },
          !inviteCode.trim() && styles.disabled,
        ]}
        onPress={() => {
          setError(null);
          join.mutate();
        }}
        disabled={!inviteCode.trim() || join.isPending}
      >
        {join.isPending ? (
          <ActivityIndicator color={colors.tint} />
        ) : (
          <Text style={{ color: colors.tint, fontWeight: "600" }}>Join clan</Text>
        )}
      </Pressable>

      {error && <Text style={{ color: colors.danger, marginTop: 12 }}>{error}</Text>}
    </ScrollView>
  );
}

export default function ClanScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const clan = useClan();

  const leave = useMutation({
    mutationFn: api.leaveClan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clan }),
  });

  const regenerate = useMutation({
    mutationFn: api.regenerateClanCode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clan }),
  });

  if (clan.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (clan.notInClan) {
    return <CreateOrJoinClan />;
  }

  if (clan.isError || !clan.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.danger }}>Couldn&apos;t load your clan.</Text>
      </View>
    );
  }

  const c = clan.data;

  function confirmLeave() {
    Alert.alert("Leave clan?", `You will leave "${c.name}". You can rejoin later with the invite code.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => leave.mutate() },
    ]);
  }

  async function shareInviteCode() {
    await Share.share({
      message: `Join my clan "${c.name}" -- use invite code ${c.invite_code}`,
    });
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.clanName, { color: colors.text }]}>{c.name}</Text>
        <Text style={{ color: colors.textSecondary }}>
          Clan score: {Math.round(c.clan_score)} · Participation: {Math.round(c.participation * 100)}%
        </Text>

        <View style={styles.inviteRow}>
          <Text style={{ color: colors.textMuted }}>Invite code: </Text>
          <Text style={[styles.inviteCode, { color: colors.tint }]}>{c.invite_code}</Text>
        </View>
        <Pressable style={[styles.secondaryButton, { borderColor: colors.tint }]} onPress={shareInviteCode}>
          <Text style={{ color: colors.tint, fontWeight: "600" }}>Share invite code</Text>
        </Pressable>

        {c.is_owner && (
          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.border, marginTop: 8 }]}
            onPress={() => regenerate.mutate()}
            disabled={regenerate.isPending}
          >
            {regenerate.isPending ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={{ color: colors.text }}>Regenerate invite code</Text>
            )}
          </Pressable>
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>Leaderboard</Text>
      {[...c.members]
        .sort((a, b) => b.rolling_score - a.rolling_score)
        .map((m, i) => (
          <View
            key={`${m.display_name}-${i}`}
            style={[styles.memberRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.textMuted, width: 24 }}>{i + 1}</Text>
            <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
              {m.display_name ?? "(no name)"}
            </Text>
            <Text style={{ color: colors.textSecondary, marginRight: 8 }}>
              {Math.round(m.rolling_score)}
            </Text>
            <ClassBadge className={m.class_name} />
          </View>
        ))}

      <Pressable style={[styles.leaveButton, { borderColor: colors.danger }]} onPress={confirmLeave}>
        <Text style={{ color: colors.danger, fontWeight: "600" }}>Leave clan</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  container: { padding: 20, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 10 },
  button: { borderRadius: 10, padding: 14, alignItems: "center" },
  secondaryButton: { borderRadius: 10, padding: 14, alignItems: "center", borderWidth: 1, marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  card: { borderRadius: 14, borderWidth: 1, padding: 18, gap: 8 },
  clanName: { fontSize: 22, fontWeight: "700" },
  inviteRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  inviteCode: { fontSize: 18, fontWeight: "800", letterSpacing: 2 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  memberName: { flex: 1, fontSize: 15, fontWeight: "600" },
  leaveButton: {
    marginTop: 20,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
  },
});
