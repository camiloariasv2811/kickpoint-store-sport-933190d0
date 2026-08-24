import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import {
  getInMemoryCategories,
  addInMemoryCategory,
  updateInMemoryCategory,
  deleteInMemoryCategory,
} from "./demo-data";
import { invalidateServerCatalogCache } from "./catalog.functions";

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
  .handler(async () => {
    if (!isSupabaseServerConfigured()) {
      return getInMemoryCategories().map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        parent_id: c.parent_id,
        image_url: c.image_url,
        sort_order: c.sort_order,
        active: true,
      })) as CategoryRow[];
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("categories")
        .select("id, name, slug, parent_id, image_url, sort_order, active")
        .order("sort_order", { ascending: true });

      if (error || !data) {
        console.error("[listAdminCategories] Supabase error:", error);
        return [];
      }
      return data as CategoryRow[];
    } catch (err) {
      console.error("[listAdminCategories] Fatal catch:", err);
      return [];
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
  .handler(async ({ data }) => {
    invalidateServerCatalogCache();
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

    const newCat = {
      id: `cat-${Date.now()}`,
      name,
      slug,
      parent_id: data.parent_id || null,
      image_url: null,
      sort_order: data.sort_order ?? 0,
      active: data.active ?? true,
    };

    if (!isSupabaseServerConfigured()) {
      addInMemoryCategory(newCat);
      return { id: newCat.id };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: inserted, error } = await supabaseAdmin
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
      if (error || !inserted) {
        throw new Error(error?.message ?? "Error al crear categoría");
      }
      return { id: inserted.id };
    } catch (err) {
      console.error("[createCategory] Error:", err);
      throw err;
    }
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
  .handler(async ({ data }) => {
    invalidateServerCatalogCache();
    const { id, ...patch } = data;
    if (patch.parent_id === "") patch.parent_id = null;

    if (!isSupabaseServerConfigured()) {
      updateInMemoryCategory(id, patch);
      return { ok: true as const };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("categories").update(patch).eq("id", id);
      if (error) {
        throw new Error(error.message);
      }
      return { ok: true as const };
    } catch (err) {
      console.error("[updateCategory] Error:", err);
      throw err;
    }
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    invalidateServerCatalogCache();
    if (!isSupabaseServerConfigured()) {
      deleteInMemoryCategory(data.id);
      return { ok: true as const };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("categories").delete().eq("id", data.id);
      if (error) {
        throw new Error(error.message);
      }
      return { ok: true as const };
    } catch (err) {
      console.error("[deleteCategory] Error:", err);
      throw err;
    }
  });
