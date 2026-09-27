import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/hooks/useAuth";
import { useThemeColors } from "@/hooks/useThemeColors";

export default function SignUpScreen() {
  const colors = useThemeColors();
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Check your email</Text>
        <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
          We sent a confirmation link to {email}. Tap it, then come back and sign in.
        </Text>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable style={[styles.button, { backgroundColor: colors.tint, marginTop: 24 }]}>
            <Text style={styles.buttonText}>Back to sign in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={[styles.title, { color: colors.text }]}>Create your account</Text>

      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        placeholder="Password (min. 6 characters)"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

      <Pressable
        style={[styles.button, { backgroundColor: colors.tint }, loading && styles.buttonDisabled]}
        onPress={handleSignUp}
        disabled={loading || !email || password.length < 6}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign up</Text>}
      </Pressable>

      <Link href="/(auth)/sign-in" asChild>
        <Pressable style={styles.linkRow}>
          <Text style={{ color: colors.textSecondary }}>
            Already have an account? <Text style={{ color: colors.tint, fontWeight: "600" }}>Sign in</Text>
          </Text>
        </Pressable>
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16 },
  button: { borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { textAlign: "center" },
  linkRow: { alignItems: "center", marginTop: 16 },
});
