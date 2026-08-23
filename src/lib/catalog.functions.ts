import { createServerFn } from "@tanstack/react-start";
import { createPublicClient, isSupabasePublicConfigured } from "./supabase-public.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import {
  DEMO_CATEGORIES,
  getInMemoryBrands,
  addInMemoryBrand,
  getInMemoryProducts,
} from "./demo-data";
import type { Brand, Category, Product } from "./types";

const PRODUCT_SELECT_FULL = `
  id, name, slug, description, base_sku, retail_price, wholesale_price, wholesale_min_qty,
  images, is_featured, is_bestseller, is_new, is_offer, active, low_stock_threshold, created_at,
  brand:brands ( id, name, slug ),
  category:categories ( id, name, slug ),
  variants:product_variants ( id, product_id, size, color, sku, stock, active )
`;

const PRODUCT_SELECT_CATALOG = `
  id, name, slug, base_sku, retail_price, wholesale_price, wholesale_min_qty,
  images, is_featured, is_bestseller, is_new, is_offer, active, low_stock_threshold, created_at,
  brand:brands ( id, name, slug ),
  category:categories ( id, name, slug ),
  variants:product_variants ( id, product_id, size, color, sku, stock, active )
`;

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const tStart = performance.now();
  console.log(
    `[PRODUCTS_QUERY_START] Catalog products query started at ${new Date().toISOString()}`,
  );

  if (!isSupabasePublicConfigured()) {
    const memStart = performance.now();
    const result = getInMemoryProducts().filter((p) => p.active);
    console.log(
      `[PRODUCTS_QUERY_END] In-memory catalog query resolved in ${Math.round(performance.now() - memStart)}ms`,
    );
    console.log(`[VARIANTS_QUERY_START] In-memory variants attached`);
    console.log(`[VARIANTS_QUERY_END] 0ms`);
    console.log(`[IMAGES_QUERY_START] In-memory images array`);
    console.log(`[IMAGES_QUERY_END] 0ms`);
    console.log(`[TOTAL_PRODUCTS_LOAD] ${Math.round(performance.now() - tStart)}ms`);
    return result;
  }

  try {
    const supabase = createPublicClient();
    const qStart = performance.now();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT_CATALOG)
      .eq("active", true)
      .order("created_at", { ascending: false });

    const qDuration = Math.round(performance.now() - qStart);
    console.log(
      `[PRODUCTS_QUERY_END] Supabase products query finished in ${qDuration}ms (retrieved ${data?.length ?? 0} items)`,
    );
    console.log(`[VARIANTS_QUERY_START] Variants joined in single query`);
    console.log(`[VARIANTS_QUERY_END] 0ms (0 extra queries)`);
    console.log(`[IMAGES_QUERY_START] First image referenced for cards`);
    console.log(`[IMAGES_QUERY_END] 0ms`);
    console.log(`[TOTAL_PRODUCTS_LOAD] ${Math.round(performance.now() - tStart)}ms`);

    if (error || !data || data.length === 0) {
      return getInMemoryProducts().filter((p) => p.active);
    }
    return data as unknown as Product[];
  } catch {
    console.log(`[TOTAL_PRODUCTS_LOAD] Fallback in ${Math.round(performance.now() - tStart)}ms`);
    return getInMemoryProducts().filter((p) => p.active);
  }
});

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    if (!isSupabasePublicConfigured()) {
      return getInMemoryProducts().find((p) => p.slug === data.slug) ?? null;
    }
    try {
      const supabase = createPublicClient();
      const { data: row, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT_FULL)
        .eq("slug", data.slug)
        .eq("active", true)
        .maybeSingle();
      if (error || !row) {
        return getInMemoryProducts().find((p) => p.slug === data.slug) ?? null;
      }
      return row as unknown as Product | null;
    } catch {
      return getInMemoryProducts().find((p) => p.slug === data.slug) ?? null;
    }
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabasePublicConfigured()) {
    return DEMO_CATEGORIES;
  }
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, image_url, sort_order")
      .eq("active", true)
      .order("sort_order");
    if (error || !data || data.length === 0) {
      return DEMO_CATEGORIES;
    }
    return data as unknown as Category[];
  } catch {
    return DEMO_CATEGORIES;
  }
});

export const listBrands = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabasePublicConfigured()) {
    return getInMemoryBrands();
  }
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, slug")
      .eq("active", true)
      .order("name");
    if (error || !data || data.length === 0) {
      return getInMemoryBrands();
    }
    return data as unknown as Brand[];
  } catch {
    return getInMemoryBrands();
  }
});

export const createBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; slug?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const name = String(data.name ?? "").trim();
    if (!name) throw new Error("Nombre de marca requerido");
    const slug =
      data.slug?.trim() ||
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

    // Check duplicate in memory (case-insensitive)
    const existingInMem = getInMemoryBrands().find(
      (b) => b.name.trim().toLowerCase() === name.toLowerCase() || b.slug === slug,
    );
    if (existingInMem) {
      throw new Error("Ya existe esta marca");
    }

    const newBrand: Brand = {
      id: `brand-${Date.now()}`,
      name,
      slug,
    };

    if (!isSupabaseServerConfigured()) {
      const added = addInMemoryBrand(newBrand);
      return added;
    }

    try {
      // Check duplicate in Supabase (case-insensitive name or exact slug)
      const { data: existingDb } = await context.supabase
        .from("brands")
        .select("id, name, slug")
        .or(`name.ilike.${name},slug.eq.${slug}`)
        .limit(1);

      if (existingDb && existingDb.length > 0) {
        throw new Error("Ya existe esta marca");
      }

      const { data: inserted, error } = await context.supabase
        .from("brands")
        .insert({
          name,
          slug,
          active: true,
        })
        .select("id, name, slug")
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Ya existe esta marca");
        }
        console.warn("[createBrand] Supabase error, falling back to memory:", error);
        return addInMemoryBrand(newBrand);
      }

      if (!inserted) {
        return addInMemoryBrand(newBrand);
      }

      addInMemoryBrand(inserted as Brand);
      return inserted as Brand;
    } catch (err: any) {
      if (err.message === "Ya existe esta marca") {
        throw err;
      }
      console.warn("[createBrand] Error creating brand in Supabase:", err);
      return addInMemoryBrand(newBrand);
    }
  });
