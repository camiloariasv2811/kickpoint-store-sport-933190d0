import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://riufpjmiasquyslutkbp.supabase.co";
const FALLBACK_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdWZwam1pYXNxdXlzbHV0a2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.dummy-anon-key";

export function isSupabasePublicConfigured(): boolean {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  return Boolean(url && key && !key.includes("dummy-anon-key"));
}

let _publicClient: ReturnType<typeof createClient> | null = null;

/** Server-side publishable (anon) client for public catalog reads. */
export function createPublicClient() {
  if (_publicClient) return _publicClient;

  const url =
    process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? FALLBACK_SUPABASE_URL;
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    FALLBACK_SUPABASE_KEY;

  _publicClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input as RequestInfo, { ...init, headers });
      },
    },
  });
  return _publicClient;
}
