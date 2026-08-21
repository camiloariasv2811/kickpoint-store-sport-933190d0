import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StoreSettings = {
  whatsapp?: string;
  low_stock_threshold?: number;
  shipping_flat?: number;
  exchange_rate_bs?: number;
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

export const getStoreSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("settings")
      .select("key, value")
      .eq("key", "store")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.value ?? {}) as StoreSettings;
  });

export const updateStoreSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: StoreSettings) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("settings")
      .upsert({ key: "store", value: data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listAllPaymentMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payment_methods")
      .select("id, code, name, active, instructions, details, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as PaymentMethodRow[];
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
    const { error } = await context.supabase.from("payment_methods").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listStaffUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("user_roles").select(`
        id, user_id, role,
        profile:profiles ( full_name, email, created_at )
      `);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });
