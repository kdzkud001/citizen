import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const ONBOARDING_KEY = "onboarding_complete_v1";

interface OnboardingContextValue {
  /** null while the initial AsyncStorage read is in flight. */
  complete: boolean | null;
  markComplete: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [complete, setComplete] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => setComplete(value === "true"));
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      complete,
      async markComplete() {
        await AsyncStorage.setItem(ONBOARDING_KEY, "true");
        setComplete(true);
      },
    }),
    [complete]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within an OnboardingProvider");
  return ctx;
}
