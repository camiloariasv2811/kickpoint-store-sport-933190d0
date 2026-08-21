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
  .handler(async ({ context }) => {
    if (!isSupabaseServerConfigured()) {
      return getInMemoryCustomers() as CustomerRow[];
    }
    try {
      const { data: customers, error } = await context.supabase
        .from("customers")
        .select(
          `
          id, first_name, last_name, whatsapp, phone, email, address, city, state, notes, created_at,
          orders ( id, total, status )
        `,
        )
        .order("created_at", { ascending: false });
      if (error || !customers) {
        return getInMemoryCustomers() as CustomerRow[];
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
    } catch {
      return getInMemoryCustomers() as CustomerRow[];
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
  .handler(async ({ data, context }) => {
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
      const { data: inserted, error } = await context.supabase
        .from("customers")
        .insert(payload)
        .select("id")
        .single();
      if (error || !inserted) {
        const inMem = addInMemoryCustomer(payload);
        return { id: inMem.id };
      }
      return { id: inserted.id };
    } catch {
      const inMem = addInMemoryCustomer(payload);
      return { id: inMem.id };
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
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    updateInMemoryCustomer(id, patch);

    if (!isSupabaseServerConfigured()) {
      return { ok: true as const };
    }

    try {
      const { error } = await context.supabase.from("customers").update(patch).eq("id", id);
      if (error) {
        console.warn("Supabase update customer warning:", error.message);
      }
      return { ok: true as const };
    } catch {
      return { ok: true as const };
    }
  });
