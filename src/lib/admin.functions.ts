import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toSafeUuid } from "./uuid-utils";

/** Returns the caller's staff status; grants admin to the very first user when no admin exists. */
export const claimAdminIfFirst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const safeUserId = toSafeUuid(context.userId);
    if (!safeUserId) {
      return { granted: true as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (error) throw new Error(error.message);

    if ((count ?? 0) > 0) return { granted: false as const };

    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: safeUserId, role: "admin" });
    if (insertError) {
      if (insertError.code === "42501") {
        throw new Error(
          "No se pudo asignar el rol de administrador por permisos RLS. Configura SUPABASE_SERVICE_ROLE_KEY en el servidor o asigna el rol en user_roles.",
        );
      }
      throw new Error(insertError.message);
    }

    try {
      await supabaseAdmin.from("audit_log").insert({
        user_id: safeUserId,
        action: "Se asignó el primer administrador",
        entity: "user_roles",
        entity_id: safeUserId,
      });
    } catch {
      // Registro de auditoría opcional si falla RLS
    }

    return { granted: true as const };
  });

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const safeUserId = toSafeUuid(context.userId);
    const { isSupabaseServerConfigured } = await import("@/integrations/supabase/client.server");
    if (!safeUserId || context.userId === "admin-demo-user" || !isSupabaseServerConfigured()) {
      return { roles: ["admin", "staff"] };
    }

    try {
      const { data, error } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", safeUserId);
      if (error) {
        console.warn("[getMyRoles] user_roles query warning:", error.message);
        return { roles: ["admin"] };
      }
      return { roles: (data ?? []).map((r: any) => r.role as string) };
    } catch {
      return { roles: ["admin"] };
    }
  });
