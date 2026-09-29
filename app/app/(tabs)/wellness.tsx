import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { CategoryIcon } from "@/components/CategoryIcon";
import { Icon } from "@/components/Icon";
import { Card, CenteredMessage, LoadingScreen, ProgressBar, SectionHeader } from "@/components/ui";
import { WellnessWheel } from "@/components/WellnessWheel";
import { Colors } from "@/constants/Colors";
import { CATEGORY_THEME } from "@/constants/habits";
import { queryKeys, useWheel } from "@/hooks/queries";
import { balanceInsights, insightMessages, overallBalance } from "@/lib/insights";
import type { HabitCategory } from "@/types/api";

function openCategory(category: HabitCategory) {
  router.navigate({ pathname: "/habits", params: { category } });
}

export default function WellnessScreen() {
  const queryClient = useQueryClient();
  const wheel = useWheel();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.wheel });
    } finally {
      setRefreshing(false);
    }
  }

  if (wheel.isLoading) return <LoadingScreen />;
  if (wheel.isError || !wheel.data) {
    return <CenteredMessage tone="danger">Couldn&apos;t load your wellness wheel.</CenteredMessage>;
  }

  const { current, previous, days } = wheel.data;
  const balance = overallBalance(current.spokes);
  const previousBalance = overallBalance(previous.spokes);
  const messages = insightMessages(balanceInsights(current.spokes, previous.spokes), days);

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.tint} />}
    >
      <Card style={styles.balanceCard}>
        <View style={styles.balanceRing}>
          <Text style={styles.balanceValue}>{balance === null ? "–" : `${balance}%`}</Text>
          <Text style={styles.balanceLabel}>Overall balance</Text>
        </View>
        <Text style={styles.balanceCaption}>
          {balance === null
            ? "Add a habit to start filling your wheel."
            : previousBalance === null
              ? `Average of the pillars you track, last ${days} days.`
              : `Average of the pillars you track, last ${days} days. The ${days} days before: ${previousBalance}%.`}
        </Text>
      </Card>

      <Card style={styles.wheelCard}>
        <WellnessWheel wheel={wheel.data} onSelectCategory={openCategory} />
      </Card>

      <Card style={styles.insights}>
        <View style={styles.insightsHeader}>
          <Icon icon={{ ios: "lightbulb.fill", android: "lightbulb" }} color={Colors.tint} size={20} />
          <Text style={styles.cardTitle}>Balance insights</Text>
        </View>
        {messages.map((m) => (
          <Text key={m} style={styles.insightText}>
            {m}
          </Text>
        ))}
      </Card>

      <SectionHeader title="Pillars" />
      {current.spokes.map((spoke) => (
        <Pressable
          key={spoke.category}
          onPress={() => openCategory(spoke.category)}
          accessibilityRole="button"
          accessibilityLabel={`${spoke.category}: ${spoke.tracking ? `${Math.round(spoke.percent)} percent` : "not tracking"}. Open habits`}
        >
          <Card style={styles.pillarRow}>
            <CategoryIcon category={spoke.category} size={36} muted={!spoke.tracking} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.pillarTop}>
                <Text style={styles.pillarName}>{spoke.category}</Text>
                <Text style={styles.pillarValue}>
                  {spoke.tracking ? `${Math.round(spoke.percent)}%` : "not tracking"}
                </Text>
              </View>
              {spoke.tracking && (
                <>
                  <ProgressBar fraction={spoke.percent / 100} color={CATEGORY_THEME[spoke.category].color} />
                  <Text style={styles.pillarDetail}>
                    {spoke.completions} of {Math.round(spoke.target)} {spoke.category === "Fitness" ? "sessions & check-ins" : "check-ins"}
                  </Text>
                </>
              )}
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 12 },
  balanceCard: { flexDirection: "row", alignItems: "center", gap: 16 },
  balanceRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: Colors.tint,
    backgroundColor: Colors.cardRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceValue: { color: Colors.text, fontSize: 26, fontWeight: "800" },
  balanceLabel: { color: Colors.textSecondary, fontSize: 11 },
  balanceCaption: { color: Colors.textSecondary, fontSize: 13, flex: 1 },
  wheelCard: { paddingHorizontal: 12, alignItems: "center" },
  insights: { gap: 8 },
  insightsHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  insightText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  pillarRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  pillarTop: { flexDirection: "row", justifyContent: "space-between" },
  pillarName: { color: Colors.text, fontSize: 15, fontWeight: "700" },
  pillarValue: { color: Colors.textSecondary, fontSize: 14, fontWeight: "600" },
  pillarDetail: { color: Colors.textMuted, fontSize: 12 },
});
