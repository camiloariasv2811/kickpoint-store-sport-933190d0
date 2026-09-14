import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProspectRow = {
  id: string;
  seq: number;
  name: string;
  phone: string;
  state: string | null;
  notes: string | null;
  registered_at: string;
  created_at: string;
};

const SELECT = "id, seq, name, phone, state, notes, registered_at, created_at";

function normalizePhone(raw?: string | null): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listProspects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const db = await admin();
    const { data, error } = await db
      .from("prospects")
      .select(SELECT)
      .order("seq", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    return (data ?? []) as ProspectRow[];
  });

export const createProspect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { name: string; phone: string; state?: string | null; notes?: string | null }) => d,
  )
  .handler(async ({ data }) => {
    const name = data.name?.trim();
    const phone = normalizePhone(data.phone);
    if (!name) throw new Error("El nombre es obligatorio");
    if (!phone) throw new Error("El número de teléfono es obligatorio");

    const db = await admin();
    const { data: inserted, error } = await db
      .from("prospects")
      .insert({
        name,
        phone,
        state: data.state?.trim() || null,
        notes: data.notes?.trim() || null,
      })
      .select(SELECT)
      .single();

    if (error) {
      if (error.code === "23505" || error.code === "23514" || /duplicate|unique/i.test(error.message)) {
        throw new Error("Ya existe un futuro cliente con ese número de teléfono");
      }
      throw new Error(error.message);
    }
    return inserted as ProspectRow;
  });

export const updateProspect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      name: string;
      phone: string;
      state?: string | null;
      notes?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const name = data.name?.trim();
    const phone = normalizePhone(data.phone);
    if (!name) throw new Error("El nombre es obligatorio");
    if (!phone) throw new Error("El número de teléfono es obligatorio");

    const db = await admin();
    const { error } = await db
      .from("prospects")
      .update({
        name,
        phone,
        state: data.state?.trim() || null,
        notes: data.notes?.trim() || null,
      })
      .eq("id", data.id);

    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        throw new Error("Otro futuro cliente ya tiene ese número de teléfono");
      }
      throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const deleteProspect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("prospects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const importProspects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      rows: Array<{
        name?: string | null;
        phone?: string | null;
        state?: string | null;
        notes?: string | null;
        registered_at?: string | null;
      }>;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await admin();

    const seen = new Set<string>();
    const clean: Array<{
      name: string;
      phone: string;
      state: string | null;
      notes: string | null;
      registered_at?: string;
    }> = [];
    let invalid = 0;

    for (const row of data.rows ?? []) {
      const name = String(row.name ?? "").trim();
      const phone = normalizePhone(row.phone);
      if (!name || !phone || seen.has(phone)) {
        if (!name || !phone) invalid++;
        continue;
      }
      seen.add(phone);
      const entry: (typeof clean)[number] = {
        name,
        phone,
        state: row.state ? String(row.state).trim() || null : null,
        notes: row.notes ? String(row.notes).trim() || null : null,
      };
      const date = row.registered_at ? String(row.registered_at).slice(0, 10) : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) entry.registered_at = date;
      clean.push(entry);
    }

    if (clean.length === 0) return { inserted: 0, duplicates: 0, invalid };

    const { data: existing, error: existingError } = await db
      .from("prospects")
      .select("phone")
      .in("phone", clean.map((c) => c.phone));
    if (existingError) throw new Error(existingError.message);

    const existingPhones = new Set((existing ?? []).map((e: { phone: string }) => e.phone));
    const toInsert = clean.filter((c) => !existingPhones.has(c.phone));
    const duplicates = clean.length - toInsert.length;

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500);
      const { error } = await db.from("prospects").insert(chunk);
      if (error) throw new Error(error.message);
      inserted += chunk.length;
    }

    return { inserted, duplicates, invalid };
  });
