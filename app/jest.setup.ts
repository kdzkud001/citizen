// Runs before any test module is required, so lib/api.ts and lib/supabase.ts's
// own "missing env var" guards don't throw when a test imports them.
process.env.EXPO_PUBLIC_API_BASE_URL = "http://test.local:8000";
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
