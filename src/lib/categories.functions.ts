import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
  sort_order: number;
  active: boolean;
};

export const listAdminCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { data, error } = await context.supabase
        .from("categories")
        .select("id, name, slug, parent_id, image_url, sort_order, active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    } catch {
      const { DEMO_CATEGORIES } = await import("@/lib/demo-data");
      return DEMO_CATEGORIES.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        parent_id: c.parent_id,
        image_url: c.image_url,
        sort_order: c.sort_order,
        active: true,
      })) as CategoryRow[];
    }
  });

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      name: string;
      slug?: string | null;
      parent_id?: string | null;
      sort_order?: number;
      active?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Nombre requerido");
    const slug =
      data.slug?.trim() ||
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

    const { data: inserted, error } = await context.supabase
      .from("categories")
      .insert({
        name,
        slug,
        parent_id: data.parent_id || null,
        sort_order: data.sort_order ?? 0,
        active: data.active ?? true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const updateCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      name?: string;
      slug?: string;
      parent_id?: string | null;
      sort_order?: number;
      active?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    if (patch.parent_id === "") patch.parent_id = null;
    const { error } = await context.supabase.from("categories").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
