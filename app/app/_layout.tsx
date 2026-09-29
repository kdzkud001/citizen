import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { Colors } from "@/constants/Colors";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { OnboardingProvider, useOnboarding } from "@/hooks/useOnboarding";
import { queryClient } from "@/lib/queryClient";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.tint,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.border,
  },
};

const pushedScreenOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: Colors.background },
  headerTintColor: Colors.tint,
  headerTitleStyle: { color: Colors.text },
  headerShadowVisible: false,
} as const;

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OnboardingProvider>
          <RootNavigator />
        </OnboardingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { session, initializing } = useAuth();
  const { complete: onboardingComplete } = useOnboarding();

  const ready = !initializing && onboardingComplete !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={!!session && !onboardingComplete}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={!!session && !!onboardingComplete}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="workouts" options={{ ...pushedScreenOptions, title: "Workouts" }} />
          <Stack.Screen name="classes" options={{ ...pushedScreenOptions, title: "Class ladder" }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
