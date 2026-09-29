import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/Colors";

/** A simple original castle-skyline silhouette (towers and battlements),
 * drawn on a 400x120 box and stretched to the screen width. */
const SKYLINE =
  "M0 120 V92 H30 V70 H38 V62 H46 V70 H54 V92 H84 V80 H96 V56 L108 36 L120 56 V80 H132 V92 " +
  "H150 V60 H158 V52 H166 V60 H174 V52 H182 V60 H190 V30 L200 12 L210 30 V60 H218 V52 H226 V60 " +
  "H234 V52 H242 V60 H250 V92 H268 V80 H280 V56 L292 38 L304 56 V80 H316 V92 H346 V70 H354 V62 " +
  "H362 V70 H370 V92 H400 V120 Z";

/**
 * Shared backdrop for sign-in / sign-up / check-email: a night-sky
 * gradient with a castle skyline, the app's crest and wordmark, then the
 * screen's own content.
 */
export function AuthScaffold({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1d3f73" />
            <Stop offset="0.6" stopColor="#173463" />
            <Stop offset="1" stopColor="#12294f" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#sky)" />
      </Svg>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Icon icon={{ ios: "shield.lefthalf.filled", android: "shield" }} color={Colors.text} size={56} />
            <Text style={styles.wordmark}>CITIZENSHIP</Text>
            <Text style={styles.tagline}>Better habits. Bigger worlds.</Text>
            <Text style={styles.subtagline}>Build your life. Earn your citizenship.</Text>
          </View>

          <Svg width="100%" height={90} viewBox="0 0 400 120" preserveAspectRatio="none" style={styles.skyline}>
            <Path d={SKYLINE} fill={Colors.background} />
          </Svg>

          <View style={styles.content}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, justifyContent: "flex-end" },
  hero: { alignItems: "center", paddingTop: 80, paddingHorizontal: 24, gap: 6 },
  wordmark: { color: Colors.text, fontSize: 30, fontWeight: "800", letterSpacing: 4, marginTop: 8 },
  tagline: { color: Colors.text, fontSize: 18, fontWeight: "600" },
  subtagline: { color: Colors.textSecondary, fontSize: 14 },
  skyline: { marginTop: 24 },
  content: { backgroundColor: Colors.background, padding: 24, paddingBottom: 40, gap: 12 },
});
