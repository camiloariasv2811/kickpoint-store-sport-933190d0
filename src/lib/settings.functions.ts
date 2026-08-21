import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import {
  getInMemorySettings,
  updateInMemorySettings,
  getInMemoryPaymentMethods,
  updateInMemoryPaymentMethod,
} from "./demo-data";

export type StoreSettings = {
  whatsapp?: string;
  low_stock_threshold?: number;
  shipping_flat?: number;
  exchange_rate_bs?: number;
  exchange_rate_bcv?: number;
  exchange_rate_usdt?: number;
};

export type PaymentMethodRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  instructions: string | null;
  details: Record<string, any>;
  sort_order: number;
};

function normalizeStoreWhatsapp(whatsapp?: string | null): string {
  if (!whatsapp) return "+58 412 1546698";
  const clean = whatsapp.trim();
  if (
    clean === "584121234567" ||
    clean === "0412 123 4567" ||
    clean === "0412-1234567" ||
    clean === "+58 412 1234567" ||
    clean === "04121234567"
  ) {
    return "+58 412 1546698";
  }
  return clean;
}

export const getPublicStoreSettings = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabaseServerConfigured()) {
    return getInMemorySettings() as StoreSettings;
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("settings")
      .select("key, value")
      .eq("key", "store")
      .maybeSingle();
    if (error || !data) {
      return getInMemorySettings() as StoreSettings;
    }
    const val = (data?.value ?? {}) as StoreSettings;
    return {
      whatsapp: normalizeStoreWhatsapp(val.whatsapp),
      shipping_flat: val.shipping_flat ?? 0,
      exchange_rate_bcv: Number(val.exchange_rate_bcv || val.exchange_rate_bs || 78.5),
      exchange_rate_usdt: Number(val.exchange_rate_usdt || 86.2),
      exchange_rate_bs: Number(val.exchange_rate_bs || val.exchange_rate_bcv || 78.5),
      low_stock_threshold: Number(val.low_stock_threshold || 5),
    } as StoreSettings;
  } catch {
    return getInMemorySettings() as StoreSettings;
  }
});

export const getStoreSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isSupabaseServerConfigured()) {
      return getInMemorySettings() as StoreSettings;
    }
    try {
      const { data, error } = await context.supabase
        .from("settings")
        .select("key, value")
        .eq("key", "store")
        .maybeSingle();
      if (error || !data) {
        return getInMemorySettings() as StoreSettings;
      }
      const val = (data?.value ?? {}) as StoreSettings;
      return {
        ...val,
        whatsapp: normalizeStoreWhatsapp(val.whatsapp),
      } as StoreSettings;
    } catch {
      return getInMemorySettings() as StoreSettings;
    }
  });

export const updateStoreSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: StoreSettings) => d)
  .handler(async ({ data, context }) => {
    updateInMemorySettings(data);
    if (!isSupabaseServerConfigured()) {
      return { ok: true as const };
    }
    try {
      const { error } = await context.supabase
        .from("settings")
        .upsert({ key: "store", value: data, updated_at: new Date().toISOString() });
      if (error) {
        console.warn("Supabase upsert settings error (used memory):", error.message);
      }
      return { ok: true as const };
    } catch {
      return { ok: true as const };
    }
  });

export const listAllPaymentMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isSupabaseServerConfigured()) {
      return getInMemoryPaymentMethods() as PaymentMethodRow[];
    }
    try {
      const { data, error } = await context.supabase
        .from("payment_methods")
        .select("id, code, name, active, instructions, details, sort_order")
        .order("sort_order", { ascending: true });
      if (error || !data || data.length === 0) {
        return getInMemoryPaymentMethods() as PaymentMethodRow[];
      }
      return data as PaymentMethodRow[];
    } catch {
      return getInMemoryPaymentMethods() as PaymentMethodRow[];
    }
  });

export const updatePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      name?: string;
      active?: boolean;
      instructions?: string | null;
      details?: Record<string, any>;
      sort_order?: number;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    updateInMemoryPaymentMethod(id, patch);
    if (!isSupabaseServerConfigured()) {
      return { ok: true as const };
    }
    try {
      const { error } = await context.supabase.from("payment_methods").update(patch).eq("id", id);
      if (error) {
        console.warn("Supabase update payment method error (used memory):", error.message);
      }
      return { ok: true as const };
    } catch {
      return { ok: true as const };
    }
  });

export const listStaffUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isSupabaseServerConfigured()) {
      return [
        {
          id: "role-demo-admin",
          user_id: "admin-demo-user",
          role: "admin",
          profile: {
            full_name: "Administrador KICKPOINT",
            email: "admin@kickpointstore.com",
            created_at: new Date().toISOString(),
          },
        },
      ];
    }
    try {
      const { data, error } = await context.supabase.from("user_roles").select(`
          id, user_id, role,
          profile:profiles ( full_name, email, created_at )
        `);
      if (error || !data) {
        return [
          {
            id: "role-demo-admin",
            user_id: "admin-demo-user",
            role: "admin",
            profile: {
              full_name: "Administrador KICKPOINT",
              email: "admin@kickpointstore.com",
              created_at: new Date().toISOString(),
            },
          },
        ];
      }
      return data as any[];
    } catch {
      return [
        {
          id: "role-demo-admin",
          user_id: "admin-demo-user",
          role: "admin",
          profile: {
            full_name: "Administrador KICKPOINT",
            email: "admin@kickpointstore.com",
            created_at: new Date().toISOString(),
          },
        },
      ];
    }
  });
