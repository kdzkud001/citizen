import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const queryKeys = {
  me: ["me"] as const,
  score: ["score"] as const,
  workouts: (days?: number) => ["workouts", days] as const,
  wheel: ["wheel"] as const,
  habits: (forDate?: string) => ["habits", forDate] as const,
  lyftaStatus: ["lyfta-status"] as const,
  clan: ["clan"] as const,
};

export function useProfile() {
  return useQuery({ queryKey: queryKeys.me, queryFn: api.getMe });
}

export function useScore() {
  return useQuery({ queryKey: queryKeys.score, queryFn: api.getScore });
}

export function useWorkouts(days?: number) {
  return useQuery({ queryKey: queryKeys.workouts(days), queryFn: () => api.getWorkouts(days) });
}

export function useWheel() {
  return useQuery({ queryKey: queryKeys.wheel, queryFn: () => api.getWheel() });
}

export function useHabits(forDate?: string) {
  return useQuery({ queryKey: queryKeys.habits(forDate), queryFn: () => api.getHabits(forDate) });
}

export function useLyftaStatus() {
  return useQuery({ queryKey: queryKeys.lyftaStatus, queryFn: api.getLyftaStatus });
}

/** Not being in a clan is a normal, expected state (404), not surfaced as
 * an error toast -- screens should check `notInClan` rather than `isError`. */
export function useClan() {
  const query = useQuery({
    queryKey: queryKeys.clan,
    queryFn: api.getMyClan,
    retry: (failureCount, error: unknown) => {
      const status = (error as { status?: number })?.status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
  const notInClan = query.isError && (query.error as { status?: number })?.status === 404;
  return { ...query, notInClan };
}
