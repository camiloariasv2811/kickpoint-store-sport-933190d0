import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import { getInMemoryCustomers, addInMemoryCustomer, updateInMemoryCustomer } from "./demo-data";

export type CustomerRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  created_at: string;
  order_count?: number;
  total_spent?: number;
};

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    if (!isSupabaseServerConfigured()) {
      return getInMemoryCustomers() as CustomerRow[];
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: customers, error } = await supabaseAdmin
        .from("customers")
        .select(
          `
          id, first_name, last_name, whatsapp, phone, email, address, city, state, notes, created_at,
          orders ( id, total, status )
        `,
        )
        .order("created_at", { ascending: false });

      if (error || !customers) {
        console.error("[listCustomers] Supabase error:", error);
        return [];
      }

      return (customers ?? []).map((c: any) => {
        const orders = c.orders ?? [];
        const totalSpent = orders
          .filter((o: any) => o.status !== "cancelado")
          .reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
        return {
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          whatsapp: c.whatsapp,
          phone: c.phone,
          email: c.email,
          address: c.address,
          city: c.city,
          state: c.state,
          notes: c.notes,
          created_at: c.created_at,
          order_count: orders.length,
          total_spent: totalSpent,
        } as CustomerRow;
      });
    } catch (err) {
      console.error("[listCustomers] Fatal catch:", err);
      return [];
    }
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      first_name: string;
      last_name?: string | null;
      whatsapp?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      notes?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    if (!data.first_name?.trim()) throw new Error("El nombre es requerido");
    const payload = {
      first_name: data.first_name.trim(),
      last_name: data.last_name?.trim() || null,
      whatsapp: data.whatsapp?.trim() || null,
      phone: data.phone?.trim() || data.whatsapp?.trim() || null,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      notes: data.notes?.trim() || null,
    };

    if (!isSupabaseServerConfigured()) {
      const inserted = addInMemoryCustomer(payload);
      return { id: inserted.id };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: inserted, error } = await supabaseAdmin
        .from("customers")
        .insert(payload)
        .select("id")
        .single();
      if (error || !inserted) {
        throw new Error(error?.message ?? "Error al crear cliente");
      }
      return { id: inserted.id };
    } catch (err) {
      console.error("[createCustomer] Error:", err);
      throw err;
    }
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      first_name?: string;
      last_name?: string | null;
      whatsapp?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      notes?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { id, ...patch } = data;

    if (!isSupabaseServerConfigured()) {
      updateInMemoryCustomer(id, patch);
      return { ok: true as const };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("customers").update(patch).eq("id", id);
      if (error) {
        throw new Error(error.message);
      }
      return { ok: true as const };
    } catch (err) {
      console.error("[updateCustomer] Error:", err);
      throw err;
    }
  });
