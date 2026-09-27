import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { UnauthorizedError } from "./api";
import { supabase } from "./supabase";

/**
 * A 401 that survives api.ts's own refresh-and-retry means the session is
 * genuinely dead (revoked refresh token, etc.) -- sign out globally rather
 * than let every screen handle it individually.
 */
function handleGlobalError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    supabase.auth.signOut();
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleGlobalError }),
  mutationCache: new MutationCache({ onError: handleGlobalError }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof UnauthorizedError) return false;
        return failureCount < 2;
      },
    },
  },
});
