import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";

import { LargeSecureStore } from "./largeSecureStore";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY -- copy .env.example to .env and fill them in."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    // No OAuth redirect flow in this app (email/password only), and no
    // browser URL to inspect on native.
    detectSessionInUrl: false,
  },
});
