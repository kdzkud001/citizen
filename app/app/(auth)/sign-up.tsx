import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";

import { AuthScaffold } from "@/components/AuthScaffold";
import { PrimaryButton, inputStyle } from "@/components/ui";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/hooks/useAuth";

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSignUp() {
    setError(null);
    setLoading(true);
    try {
      const { needsEmailConfirmation } = await signUp(email.trim(), password);
      if (needsEmailConfirmation) {
        setCheckEmail(true);
      }
      // If confirmation is off, signUp already produced a session and
      // RootNavigator moves on to onboarding automatically.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <AuthScaffold>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          We sent a confirmation link to {email}. Tap it, then come back and sign in.
        </Text>
        <PrimaryButton label="Back to sign in" onPress={() => router.replace("/(auth)/sign-in")} />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold>
      <Text style={styles.title}>Create your account</Text>
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
        placeholder="Password (min. 6 characters)"
        placeholderTextColor={Colors.textMuted}
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <PrimaryButton
        label="Get started"
        onPress={handleSignUp}
        disabled={!email || password.length < 6}
        loading={loading}
      />

      <Link href="/(auth)/sign-in" asChild>
        <Pressable style={styles.linkRow}>
          <Text style={{ color: Colors.textSecondary }}>
            Already have an account? <Text style={{ color: Colors.tint, fontWeight: "700" }}>Sign in</Text>
          </Text>
        </Pressable>
      </Link>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.text, fontSize: 22, fontWeight: "800", marginBottom: 4 },
  body: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  error: { color: Colors.danger, textAlign: "center" },
  linkRow: { alignItems: "center", marginTop: 8, padding: 8 },
});
