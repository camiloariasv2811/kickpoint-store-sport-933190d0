import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as browserSupabase } from "./client";
import { isSupabaseServerConfigured, supabaseAdmin } from "./client.server";
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
    let token = "";
    if (typeof window !== "undefined") {
      try {
        const { data } = await browserSupabase.auth.getSession();
        if (data?.session?.access_token) {
          token = data.session.access_token;
        }
      } catch (err) {
        console.warn("[AuthMiddleware] Error obtaining session token in browser:", err);
      }
    }
    return next({
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
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

    if (!isSupabaseServerConfigured()) {
      // In-memory demo/preview mode when Supabase is not connected
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
          claims: {
            sub: "admin-demo-user",
            role: "admin" as "admin" | "staff",
            email: "admin@kickpointstore.com",
          },
        },
      });
    }

    const request = getRequest();
    const authHeader = request?.headers?.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token || token === "demo-admin-token" || !token.includes(".")) {
      throw new Error(
        "Acceso no autorizado: debes iniciar sesión en el portal administrativo con una cuenta válida.",
      );
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

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      throw new Error("Sesión inválida o expirada. Por favor, inicia sesión nuevamente.");
    }

    const user = userData.user;

    // Strict role verification against user_roles in database
    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    let role = roleRows?.[0]?.role;

    if (!role && !roleError) {
      // If user_roles table is completely empty, bootstrap the first registered user as admin
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true });

      if (count === 0) {
        await supabaseAdmin.from("user_roles").insert({
          user_id: user.id,
          role: "admin",
        });
        role = "admin";
      }
    }

    if (role !== "admin" && role !== "staff") {
      throw new Error(
        "Acceso denegado: tu cuenta no tiene rol de administrador o vendedor asignado.",
      );
    }

    return next({
      context: {
        supabase,
        userId: user.id,
        claims: {
          sub: user.id,
          role: role as "admin" | "staff",
          email: user.email || "",
        },
      },
    });
  });
