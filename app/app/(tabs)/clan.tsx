import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";

import { ClassCrest } from "@/components/ClassBadge";
import { Icon } from "@/components/Icon";
import {
  Card,
  CenteredMessage,
  LoadingScreen,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  inputStyle,
} from "@/components/ui";
import { Colors } from "@/constants/Colors";
import { queryKeys, useClan } from "@/hooks/queries";
import { api, ApiError } from "@/lib/api";
import { formatPoints } from "@/lib/format";

function CreateOrJoinClan() {
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
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.intro}>
        Clans pool their members&apos; scores. Start one and share the invite code, or join a friend&apos;s.
      </Text>

      <Card style={{ gap: 10 }}>
        <Text style={styles.cardTitle}>Create a clan</Text>
        <TextInput
          style={inputStyle}
          placeholder="Clan name"
          placeholderTextColor={Colors.textMuted}
          value={name}
          onChangeText={setName}
        />
        <PrimaryButton
          label="Create clan"
          onPress={() => {
            setError(null);
            create.mutate();
          }}
          disabled={!name.trim()}
          loading={create.isPending}
        />
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={styles.cardTitle}>Join with an invite code</Text>
        <TextInput
          style={inputStyle}
          placeholder="Invite code"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
          value={inviteCode}
          onChangeText={setInviteCode}
        />
        <SecondaryButton
          label="Join clan"
          onPress={() => {
            setError(null);
            join.mutate();
          }}
          disabled={!inviteCode.trim()}
          loading={join.isPending}
        />
      </Card>

      {error && <Text style={{ color: Colors.danger }}>{error}</Text>}
    </ScrollView>
  );
}

export default function ClanScreen() {
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

  if (clan.isLoading) return <LoadingScreen />;
  if (clan.notInClan) return <CreateOrJoinClan />;
  if (clan.isError || !clan.data) return <CenteredMessage tone="danger">Couldn&apos;t load your clan.</CenteredMessage>;

  const c = clan.data;
  const members = [...c.members].sort((a, b) => b.rolling_score - a.rolling_score);

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
    <ScrollView style={{ backgroundColor: Colors.background }} contentContainerStyle={styles.container}>
      <Card glow={Colors.tint} style={{ gap: 14 }}>
        <View style={styles.clanHeader}>
          <View style={styles.clanEmblem}>
            <Icon icon={{ ios: "shield.lefthalf.filled", android: "shield" }} color={Colors.tint} size={30} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.clanName}>{c.name}</Text>
            <Text style={styles.muted}>
              {c.members.length} member{c.members.length === 1 ? "" : "s"}
            </Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatPoints(c.clan_score)}</Text>
            <Text style={styles.statLabel}>clan score</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{Math.round(c.participation * 100)}%</Text>
            <Text style={styles.statLabel}>participation</Text>
          </View>
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <View style={styles.inviteRow}>
          <Text style={styles.muted}>Invite code</Text>
          <Text style={styles.inviteCode}>{c.invite_code}</Text>
        </View>
        <PrimaryButton label="Share invite code" onPress={shareInviteCode} />
        {c.is_owner && (
          <SecondaryButton
            label="Regenerate invite code"
            tone="neutral"
            onPress={() => regenerate.mutate()}
            loading={regenerate.isPending}
          />
        )}
      </Card>

      <SectionHeader title="Leaderboard" />
      <Card style={{ paddingVertical: 4 }}>
        {members.map((m, i) => (
          <View
            key={`${m.display_name}-${i}`}
            style={[styles.memberRow, i < members.length - 1 && styles.memberDivider]}
          >
            <Text style={styles.rank}>{i + 1}</Text>
            <ClassCrest className={m.class_name} size={32} />
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName} numberOfLines={1}>
                {m.display_name ?? "(no name)"}
              </Text>
              <Text style={styles.statLabel}>{m.class_name}</Text>
            </View>
            <Text style={styles.memberScore}>{formatPoints(m.rolling_score)}</Text>
          </View>
        ))}
      </Card>

      <View style={{ marginTop: 12 }}>
        <SecondaryButton label="Leave clan" tone="danger" onPress={confirmLeave} loading={leave.isPending} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 12 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  clanHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
  clanEmblem: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.cardRaised,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  clanName: { color: Colors.text, fontSize: 22, fontWeight: "800" },
  statsRow: { flexDirection: "row", gap: 24 },
  stat: {},
  statValue: { color: Colors.text, fontSize: 20, fontWeight: "800" },
  statLabel: { color: Colors.textMuted, fontSize: 11 },
  inviteRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  inviteCode: { color: Colors.tint, fontSize: 20, fontWeight: "800", letterSpacing: 2 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  memberDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rank: { color: Colors.textMuted, width: 20, fontWeight: "700" },
  memberName: { color: Colors.text, fontSize: 15, fontWeight: "600" },
  memberScore: { color: Colors.text, fontSize: 15, fontWeight: "700" },
});
