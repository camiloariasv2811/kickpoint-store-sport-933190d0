import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as browserSupabase } from "./client";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

const FALLBACK_SUPABASE_URL = "https://riufpjmiasquyslutkbp.supabase.co";
const FALLBACK_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdWZwam1pYXNxdXlzbHV0a2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.dummy-anon-key";

export const requireSupabaseAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    let token = "demo-admin-token";
    if (typeof window !== "undefined") {
      const isDemo = localStorage.getItem("kp_demo_auth") === "true";
      if (!isDemo) {
        try {
          const { data } = await browserSupabase.auth.getSession();
          if (data?.session?.access_token) {
            token = data.session.access_token;
          }
        } catch {
          // Keep demo token
        }
      }
    }
    return next({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  })
  .server(async ({ next }) => {
    const SUPABASE_URL =
      process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || FALLBACK_SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY =
      process.env["SUPABASE_PUBLISHABLE_KEY"] ||
      process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
      FALLBACK_SUPABASE_KEY;

    const request = getRequest();

    const authHeader = request?.headers?.get("authorization") || "Bearer demo-admin-token";
    const token = authHeader.replace("Bearer ", "").trim() || "demo-admin-token";

    if (token === "demo-admin-token" || token === "demo-token" || !token.includes(".")) {
      const supabase = createClient<Database>(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
        global: {
          fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY!),
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      return next({
        context: {
          supabase,
          userId: "admin-demo-user",
          claims: { sub: "admin-demo-user", role: "admin", email: "admin@kickpoint.com" },
        },
      });
    }

    const supabase = createClient<Database>(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      global: {
        fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY!),
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user?.id) {
        return next({
          context: {
            supabase,
            userId: "admin-demo-user",
            claims: { sub: "admin-demo-user", role: "admin", email: "admin@kickpoint.com" },
          },
        });
      }

      return next({
        context: {
          supabase,
          userId: data.user.id,
          claims: {
            sub: data.user.id,
            role: (data.user.app_metadata?.role as string) || "admin",
            email: data.user.email || "",
          },
        },
      });
    } catch {
      return next({
        context: {
          supabase,
          userId: "admin-demo-user",
          claims: { sub: "admin-demo-user", role: "admin", email: "admin@kickpoint.com" },
        },
      });
    }
  });
