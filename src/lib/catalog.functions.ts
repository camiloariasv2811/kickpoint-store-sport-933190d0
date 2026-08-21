import { createServerFn } from "@tanstack/react-start";
import { createPublicClient, isSupabasePublicConfigured } from "./supabase-public.server";
import { DEMO_BRANDS, DEMO_CATEGORIES, getInMemoryProducts } from "./demo-data";
import type { Brand, Category, Product } from "./types";

const PRODUCT_SELECT = `
  id, name, slug, description, base_sku, retail_price, wholesale_price, wholesale_min_qty,
  images, is_featured, is_bestseller, is_new, is_offer, active, low_stock_threshold, created_at,
  brand:brands ( id, name, slug ),
  category:categories ( id, name, slug ),
  variants:product_variants ( id, product_id, size, color, sku, stock, active )
`;

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabasePublicConfigured()) {
    return getInMemoryProducts().filter((p) => p.active);
  }
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (error || !data || data.length === 0) {
      return getInMemoryProducts().filter((p) => p.active);
    }
    return data as unknown as Product[];
  } catch {
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
        .select(PRODUCT_SELECT)
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
    return DEMO_BRANDS;
  }
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, slug")
      .eq("active", true)
      .order("name");
    if (error || !data || data.length === 0) {
      return DEMO_BRANDS;
    }
    return data as unknown as Brand[];
  } catch {
    return DEMO_BRANDS;
  }
});
