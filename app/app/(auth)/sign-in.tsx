import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";

import { AuthScaffold } from "@/components/AuthScaffold";
import { PrimaryButton, inputStyle } from "@/components/ui";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/hooks/useAuth";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // Navigation to onboarding/tabs happens automatically -- RootNavigator
      // re-renders once useAuth's session updates.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold>
      <Text style={styles.title}>Welcome back</Text>
      <TextInput
        style={inputStyle}
        placeholder="Email"
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={inputStyle}
        placeholder="Password"
        placeholderTextColor={Colors.textMuted}
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <PrimaryButton label="Sign in" onPress={handleSignIn} disabled={!email || !password} loading={loading} />

      <Link href="/(auth)/sign-up" asChild>
        <Pressable style={styles.linkRow}>
          <Text style={{ color: Colors.textSecondary }}>
            New here? <Text style={{ color: Colors.tint, fontWeight: "700" }}>Get started</Text>
          </Text>
        </Pressable>
      </Link>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.text, fontSize: 22, fontWeight: "800", marginBottom: 4 },
  error: { color: Colors.danger, textAlign: "center" },
  linkRow: { alignItems: "center", marginTop: 8, padding: 8 },
});
