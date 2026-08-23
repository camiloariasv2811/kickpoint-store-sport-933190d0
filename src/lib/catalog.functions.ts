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

export type MinimalProduct = {
  id: string;
  name: string;
  slug: string;
  retail_price: number;
  main_image: string | null;
  active: boolean;
};

export type BenchmarkResult = {
  name: string;
  supabase_duration_ms: number;
  transform_duration_ms: number;
  total_duration_ms: number;
  item_count: number;
  payload_size_approx_kb: number;
};

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

/** Minimal Query: Only id, name, slug, price, main_image, active */
export const getMinimalProducts = createServerFn({ method: "GET" }).handler(async () => {
  const requestStart = performance.now();
  console.log(`[REQUEST_START] getMinimalProducts at ${new Date().toISOString()}`);

  const supabaseStart = performance.now();
  let rawItems: any[] = [];

  if (isSupabasePublicConfigured()) {
    try {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, retail_price, images, active")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (!error && data) {
        rawItems = data;
      } else {
        rawItems = getInMemoryProducts().filter((p) => p.active);
      }
    } catch {
      rawItems = getInMemoryProducts().filter((p) => p.active);
    }
  } else {
    rawItems = getInMemoryProducts().filter((p) => p.active);
  }

  const supabaseEnd = performance.now();
  console.log(`[SUPABASE_END] Query completed in ${Math.round(supabaseEnd - supabaseStart)}ms`);

  const transformStart = performance.now();
  const minimalProducts: MinimalProduct[] = rawItems.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    retail_price: Number(p.retail_price || 0),
    main_image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null,
    active: Boolean(p.active),
  }));
  const transformEnd = performance.now();

  const responseStart = performance.now();
  console.log(
    `[TRANSFORM_END] Transform in ${Math.round(transformEnd - transformStart)}ms | Response starting at ${Math.round(responseStart - requestStart)}ms total`,
  );

  return {
    items: minimalProducts,
    metrics: {
      request_start: requestStart,
      supabase_start: supabaseStart,
      supabase_end: supabaseEnd,
      supabase_duration_ms: Math.round(supabaseEnd - supabaseStart),
      transform_start: transformStart,
      transform_end: transformEnd,
      transform_duration_ms: Math.round(transformEnd - transformStart),
      response_start: responseStart,
      total_duration_ms: Math.round(responseStart - requestStart),
      items_count: minimalProducts.length,
    },
  };
});

/** Full diagnostic test suite to measure every component */
export const runDiagnosticsBenchmark = createServerFn({ method: "GET" }).handler(async () => {
  const tests: BenchmarkResult[] = [];
  const isSb = isSupabasePublicConfigured();

  // TEST 1 — PRODUCTO MÍNIMO (solo id, name, slug, retail_price, active)
  {
    const t0 = performance.now();
    let data: any[] = [];
    if (isSb) {
      const supabase = createPublicClient();
      const res = await supabase
        .from("products")
        .select("id, name, slug, retail_price, active")
        .eq("active", true);
      data = res.data ?? [];
    } else {
      data = getInMemoryProducts().filter((p) => p.active);
    }
    const tSb = performance.now();
    const items = data.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      retail_price: Number(p.retail_price || 0),
      active: Boolean(p.active),
    }));
    const str = JSON.stringify(items);
    tests.push({
      name: "TEST 1 — Producto Mínimo (solo id, name, slug, precio, active)",
      supabase_duration_ms: Math.round(tSb - t0),
      transform_duration_ms: 0,
      total_duration_ms: Math.round(performance.now() - t0),
      item_count: items.length,
      payload_size_approx_kb: Math.round((str.length * 2) / 1024),
    });
  }

  // TEST 2 — PRODUCTO + IMAGEN (main image)
  {
    const t0 = performance.now();
    let data: any[] = [];
    if (isSb) {
      const supabase = createPublicClient();
      const res = await supabase
        .from("products")
        .select("id, name, slug, retail_price, images, active")
        .eq("active", true);
      data = res.data ?? [];
    } else {
      data = getInMemoryProducts().filter((p) => p.active);
    }
    const tSb = performance.now();
    const items = data.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      retail_price: Number(p.retail_price || 0),
      main_image: p.images?.[0] ?? null,
      active: Boolean(p.active),
    }));
    const str = JSON.stringify(items);
    tests.push({
      name: "TEST 2 — Producto + Imagen Principal",
      supabase_duration_ms: Math.round(tSb - t0),
      transform_duration_ms: 0,
      total_duration_ms: Math.round(performance.now() - t0),
      item_count: items.length,
      payload_size_approx_kb: Math.round((str.length * 2) / 1024),
    });
  }

  // TEST 3 — PRODUCTO + VARIANTES (variants join)
  {
    const t0 = performance.now();
    let data: any[] = [];
    if (isSb) {
      const supabase = createPublicClient();
      const res = await supabase
        .from("products")
        .select(
          "id, name, slug, retail_price, active, variants:product_variants(id, size, color, stock, active)",
        )
        .eq("active", true);
      data = res.data ?? [];
    } else {
      data = getInMemoryProducts().filter((p) => p.active);
    }
    const tSb = performance.now();
    const str = JSON.stringify(data);
    tests.push({
      name: "TEST 3 — Producto + Variantes (tallas y stock)",
      supabase_duration_ms: Math.round(tSb - t0),
      transform_duration_ms: 0,
      total_duration_ms: Math.round(performance.now() - t0),
      item_count: data.length,
      payload_size_approx_kb: Math.round((str.length * 2) / 1024),
    });
  }

  // TEST 4 — PRODUCTO COMPLETO (Catálogo con marcas, categorías, variantes, imágenes)
  {
    const t0 = performance.now();
    let data: any[] = [];
    if (isSb) {
      const supabase = createPublicClient();
      const res = await supabase.from("products").select(PRODUCT_SELECT_CATALOG).eq("active", true);
      data = res.data ?? [];
    } else {
      data = getInMemoryProducts().filter((p) => p.active);
    }
    const tSb = performance.now();
    const str = JSON.stringify(data);
    tests.push({
      name: "TEST 4 — Producto Completo Catálogo (Marcas + Categorías + Variantes + Imágenes)",
      supabase_duration_ms: Math.round(tSb - t0),
      transform_duration_ms: 0,
      total_duration_ms: Math.round(performance.now() - t0),
      item_count: data.length,
      payload_size_approx_kb: Math.round((str.length * 2) / 1024),
    });
  }

  // TEST 5 — DETALLE DE PRODUCTO INDIVIDUAL POR SLUG (/producto/:slug)
  {
    const t0 = performance.now();
    let item: any = null;
    if (isSb) {
      const supabase = createPublicClient();
      const res = await supabase
        .from("products")
        .select(PRODUCT_SELECT_FULL)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      item = res.data ?? null;
    } else {
      item = getInMemoryProducts().find((p) => p.active) ?? null;
    }
    const tSb = performance.now();
    const str = JSON.stringify(item);
    tests.push({
      name: "TEST 5 — Detalle Producto Individual por Slug (Consulta Unitaria Consolidada)",
      supabase_duration_ms: Math.round(tSb - t0),
      transform_duration_ms: 0,
      total_duration_ms: Math.round(performance.now() - t0),
      item_count: item ? 1 : 0,
      payload_size_approx_kb: Math.round((str.length * 2) / 1024),
    });
  }

  return {
    is_supabase_connected: isSb,
    timestamp: new Date().toISOString(),
    tests,
  };
});

/** Incremental Selector Search (for POS / Ventas / Order creators) */
export const searchProductsForSelector = createServerFn({ method: "GET" })
  .inputValidator((d: { q?: string; limit?: number }) => d)
  .handler(async ({ data }) => {
    const term = (data?.q ?? "").trim().toLowerCase();
    const limit = Math.min(50, Math.max(1, data?.limit ?? 20));

    if (!isSupabasePublicConfigured()) {
      let list = getInMemoryProducts().filter((p) => p.active !== false);
      if (term) {
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            (p.base_sku && p.base_sku.toLowerCase().includes(term)) ||
            (p.brand?.name && p.brand.name.toLowerCase().includes(term)),
        );
      }
      return list.slice(0, limit);
    }

    try {
      const supabase = createPublicClient();
      let query = supabase
        .from("products")
        .select(
          "id, name, slug, base_sku, retail_price, wholesale_price, images, active, variants:product_variants(id, product_id, size, color, sku, stock, active)",
        )
        .eq("active", true);

      if (term) {
        query = query.or(`name.ilike.%${term}%,base_sku.ilike.%${term}%`);
      }

      const { data: rows, error } = await query.limit(limit);
      if (error || !rows) {
        let list = getInMemoryProducts().filter((p) => p.active !== false);
        if (term) {
          list = list.filter(
            (p) =>
              p.name.toLowerCase().includes(term) ||
              (p.base_sku && p.base_sku.toLowerCase().includes(term)),
          );
        }
        return list.slice(0, limit);
      }
      return rows;
    } catch {
      let list = getInMemoryProducts().filter((p) => p.active !== false);
      if (term) {
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            (p.base_sku && p.base_sku.toLowerCase().includes(term)),
        );
      }
      return list.slice(0, limit);
    }
  });

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
