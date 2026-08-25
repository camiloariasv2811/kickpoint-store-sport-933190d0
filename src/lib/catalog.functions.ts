import { createServerFn } from "@tanstack/react-start";
import { createPublicClient, isSupabasePublicConfigured } from "./supabase-public.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import {
  DEMO_CATEGORIES,
  getInMemoryCategories,
  getInMemoryBrands,
  addInMemoryBrand,
  getInMemoryProducts,
} from "./demo-data";
import { toSafeUuid } from "./uuid-utils";
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

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const SERVER_CACHE_TTL_MS = 60 * 1000; // 60 seconds
let cachedProducts: CacheEntry<Product[]> | null = null;
let cachedCategories: CacheEntry<Category[]> | null = null;
let cachedBrands: CacheEntry<Brand[]> | null = null;
const cachedSingleProduct = new Map<string, CacheEntry<Product | null>>();

export function invalidateServerCatalogCache() {
  cachedProducts = null;
  cachedCategories = null;
  cachedBrands = null;
  cachedSingleProduct.clear();
}

const PRODUCT_SELECT_FULL = `
  id, name, slug, description, base_sku, retail_price, wholesale_price, wholesale_min_qty,
  images, is_featured, is_bestseller, is_new, is_offer, active, low_stock_threshold, sort_order, created_at,
  brand:brands ( id, name, slug ),
  category:categories ( id, name, slug ),
  variants:product_variants ( id, product_id, size, color, sku, stock, active )
`;

const PRODUCT_SELECT_CATALOG = `
  id, name, slug, base_sku, retail_price, wholesale_price, wholesale_min_qty,
  images, is_featured, is_bestseller, is_new, is_offer, active, low_stock_threshold, sort_order, created_at,
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
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (!error && data) {
        rawItems = data;
      } else {
        if (error) {
          console.warn("[getMinimalProducts] Supabase query error:", error);
        }
        rawItems = [];
      }
    } catch (err) {
      console.error("[getMinimalProducts] Failed to query Supabase:", err);
      rawItems = [];
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
        if (error) console.warn("[searchProductsForSelector] Supabase error:", error);
        return [];
      }
      return rows;
    } catch (err) {
      console.error("[searchProductsForSelector] Exception searching products:", err);
      return [];
    }
  });

function normalizeProduct(p: any): Product {
  const brandObj =
    p.brand && typeof p.brand === "object"
      ? {
          id: String(p.brand.id ?? ""),
          name: String(p.brand.name ?? ""),
          slug: String(p.brand.slug ?? ""),
        }
      : null;

  const categoryObj =
    p.category && typeof p.category === "object"
      ? {
          id: String(p.category.id ?? ""),
          name: String(p.category.name ?? ""),
          slug: String(p.category.slug ?? ""),
        }
      : null;

  const rawVariants = Array.isArray(p.variants) ? p.variants : [];
  const normalizedVariants = rawVariants
    .filter((v: any) => v && v.active !== false)
    .map((v: any) => ({
      id: String(v.id ?? `v-${p.id}-${v.size || "unica"}`),
      product_id: String(v.product_id ?? p.id ?? ""),
      size: String(v.size ?? "Única"),
      color: v.color ? String(v.color) : null,
      sku: v.sku ? String(v.sku) : null,
      stock: Number(v.stock) || 0,
      active: v.active !== false,
    }));

  return {
    id: String(p.id),
    name: String(p.name ?? "Producto KICKPOINT"),
    slug: String(p.slug ?? p.id),
    description: p.description ? String(p.description) : null,
    base_sku: p.base_sku ? String(p.base_sku) : null,
    retail_price: Number(p.retail_price) || 0,
    wholesale_price: p.wholesale_price != null ? Number(p.wholesale_price) : null,
    wholesale_min_qty: Number(p.wholesale_min_qty) || 8,
    images: Array.isArray(p.images) ? p.images.filter(Boolean).map(String) : [],
    is_featured: Boolean(p.is_featured),
    is_bestseller: Boolean(p.is_bestseller),
    is_new: Boolean(p.is_new),
    is_offer: Boolean(p.is_offer),
    active: p.active !== false,
    low_stock_threshold: Number(p.low_stock_threshold) || 5,
    sort_order: Number(p.sort_order) || 0,
    created_at: String(p.created_at ?? new Date().toISOString()),

    brand: brandObj,
    category: categoryObj,
    variants: normalizedVariants,
  };
}

type ListProductsInput = {
  fresh?: boolean;
};

export const listProducts = createServerFn({ method: "GET" })
  .inputValidator((d?: ListProductsInput) => ({ fresh: Boolean(d?.fresh) }))
  .handler(async ({ data }) => {
  const tStart = performance.now();
  console.log("[CLIENT_PRODUCTS_01] QUERY START - fetching public products catalog");
  const mustFetchFresh = data.fresh === true;

  // Fast path: Server in-memory cache hit
  if (
    !mustFetchFresh &&
    cachedProducts &&
    cachedProducts.data.length > 0 &&
    Date.now() - cachedProducts.timestamp < SERVER_CACHE_TTL_MS
  ) {
    console.log(
      `[PRODUCTS_QUERY_SERVER_CACHE_HIT] Resolved ${cachedProducts.data.length} products in ${Math.round(performance.now() - tStart)}ms`,
    );
    console.log(
      "[CLIENT_PRODUCTS_06] SERVER RESPONSE:",
      cachedProducts.data.length,
      "cached products",
    );
    return cachedProducts.data;
  }

  // Attempt 1: Fetch via Server/Admin Supabase client (preferred, bypasses RLS issues)
  try {
    const { supabaseAdmin, isSupabaseServerConfigured } =
      await import("@/integrations/supabase/client.server");

    if (isSupabaseServerConfigured()) {
      const qStart = performance.now();
      const { data, error } = await supabaseAdmin
        .from("products")
        .select(PRODUCT_SELECT_CATALOG)
        .or("active.eq.true,active.is.null")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      console.log("[CLIENT_PRODUCTS_02] SUPABASE RESULT (Admin)", {
        received: data?.length ?? 0,
        hasError: Boolean(error),
        errorMessage: error?.message,
        durationMs: Math.round(performance.now() - qStart),
      });

      if (!error && data) {
        const normalized = data.map(normalizeProduct);
        console.log("[CLIENT_PRODUCTS_05] NORMALIZED PRODUCT COUNT:", normalized.length);
        cachedProducts = { data: normalized, timestamp: Date.now() };
        return normalized;
      }
    }
  } catch (adminErr) {
    console.warn("[listProducts] Admin client attempt error:", adminErr);
  }

  // Attempt 2: Fetch via Public client
  if (isSupabasePublicConfigured()) {
    try {
      const supabase = createPublicClient();
      const qStart = performance.now();
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT_CATALOG)
        .or("active.eq.true,active.is.null")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      console.log("[CLIENT_PRODUCTS_02] SUPABASE RESULT (Public)", {
        received: data?.length ?? 0,
        hasError: Boolean(error),
        errorMessage: error?.message,
        durationMs: Math.round(performance.now() - qStart),
      });

      if (!error && data) {
        const normalized = data.map(normalizeProduct);
        console.log("[CLIENT_PRODUCTS_05] NORMALIZED PRODUCT COUNT:", normalized.length);
        cachedProducts = { data: normalized, timestamp: Date.now() };
        return normalized;
      }
    } catch (pubErr) {
      console.warn("[listProducts] Public client attempt error:", pubErr);
    }
  }

  // If Supabase is configured but returned empty or errored, return empty array (do not fabricate products)
  if (isSupabasePublicConfigured()) {
    return [];
  }

  // Fallback: In-memory fallback products ONLY when Supabase is completely unconfigured
  const memProducts = getInMemoryProducts()
    .filter((p) => p.active !== false)
    .map(normalizeProduct);

  console.log("[CLIENT_PRODUCTS_03] PRODUCT COUNT (In-Memory Local Fallback):", memProducts.length);
  cachedProducts = { data: memProducts, timestamp: Date.now() };
  return memProducts;
});

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const rawSlug = data?.slug ? String(data.slug).trim() : "";
    const decodedSlug = decodeURIComponent(rawSlug).trim();

    // Fast path 1: Server in-memory single product cache hit
    const cached = cachedSingleProduct.get(decodedSlug) || cachedSingleProduct.get(rawSlug);
    if (cached && cached.data && Date.now() - cached.timestamp < SERVER_CACHE_TTL_MS) {
      return cached.data;
    }

    // Fast path 2: Check in-memory products catalog cache if warm
    if (cachedProducts && cachedProducts.data.length > 0) {
      const match = cachedProducts.data.find(
        (p) =>
          p.slug === decodedSlug ||
          p.slug === rawSlug ||
          p.id === decodedSlug ||
          p.id === rawSlug ||
          p.slug.toLowerCase() === decodedSlug.toLowerCase(),
      );
      if (match) {
        cachedSingleProduct.set(decodedSlug, { data: match, timestamp: Date.now() });
        return match;
      }
    }

    // Attempt 1: Fetch via Admin client (preferred, handles RLS)
    const validUuid = toSafeUuid(decodedSlug);
    try {
      const { supabaseAdmin, isSupabaseServerConfigured } =
        await import("@/integrations/supabase/client.server");
      if (isSupabaseServerConfigured()) {
        let query = supabaseAdmin
          .from("products")
          .select(PRODUCT_SELECT_FULL)
          .or("active.eq.true,active.is.null");

        if (validUuid) {
          query = query.or(`id.eq.${validUuid},slug.eq.${decodedSlug}`);
        } else {
          query = query.or(`slug.eq.${decodedSlug},slug.ilike.${decodedSlug}`);
        }

        const { data: row, error } = await query.maybeSingle();

        if (!error && row) {
          const finalProduct = normalizeProduct(row);
          cachedSingleProduct.set(decodedSlug, { data: finalProduct, timestamp: Date.now() });
          return finalProduct;
        }
      }
    } catch (err) {
      console.warn("[getProduct] Admin query error:", err);
    }

    // Attempt 2: Fetch via Public client
    if (isSupabasePublicConfigured()) {
      try {
        const supabase = createPublicClient();
        let query = supabase
          .from("products")
          .select(PRODUCT_SELECT_FULL)
          .or("active.eq.true,active.is.null");

        if (validUuid) {
          query = query.or(`id.eq.${validUuid},slug.eq.${decodedSlug}`);
        } else {
          query = query.or(`slug.eq.${decodedSlug},slug.ilike.${decodedSlug}`);
        }

        const { data: row, error } = await query.maybeSingle();

        if (!error && row) {
          const finalProduct = normalizeProduct(row);
          cachedSingleProduct.set(decodedSlug, { data: finalProduct, timestamp: Date.now() });
          return finalProduct;
        }
      } catch (err) {
        console.warn("[getProduct] Public query error:", err);
      }
    }

    // If Supabase is configured, return null if not found
    if (isSupabasePublicConfigured()) {
      return null;
    }

    // Fallback in-memory demo data ONLY when Supabase is unconfigured
    const item =
      getInMemoryProducts().find(
        (p) =>
          (p.slug === decodedSlug ||
            p.slug === rawSlug ||
            p.id === decodedSlug ||
            p.id === rawSlug ||
            p.slug?.toLowerCase() === decodedSlug.toLowerCase()) &&
          p.active !== false,
      ) ?? null;
    const finalProduct = item ? normalizeProduct(item) : null;
    if (finalProduct) {
      cachedSingleProduct.set(decodedSlug, { data: finalProduct, timestamp: Date.now() });
    }
    return finalProduct;
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  if (
    cachedCategories &&
    cachedCategories.data.length > 0 &&
    Date.now() - cachedCategories.timestamp < SERVER_CACHE_TTL_MS * 5
  ) {
    return cachedCategories.data;
  }

  // Attempt 1: Fetch via Admin client
  try {
    const { supabaseAdmin, isSupabaseServerConfigured } =
      await import("@/integrations/supabase/client.server");
    if (isSupabaseServerConfigured()) {
      const { data, error } = await supabaseAdmin
        .from("categories")
        .select("id, name, slug, parent_id, image_url, sort_order, active")
        .or("active.eq.true,active.is.null")
        .order("sort_order", { ascending: true });

      if (!error && data && data.length > 0) {
        const cats = data.map((c: any) => ({
          id: String(c.id),
          name: String(c.name ?? ""),
          slug: String(c.slug ?? ""),
          parent_id: c.parent_id ? String(c.parent_id) : null,
          image_url: c.image_url ? String(c.image_url) : null,
          sort_order: Number(c.sort_order) || 0,
        })) as Category[];
        console.log("[CLIENT_PRODUCTS_04] CATEGORY COUNT (Admin):", cats.length);
        cachedCategories = { data: cats, timestamp: Date.now() };
        return cats;
      }
    }
  } catch (err) {
    console.warn("[listCategories] Admin query error:", err);
  }

  // Attempt 2: Fetch via Public client
  if (isSupabasePublicConfigured()) {
    try {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, parent_id, image_url, sort_order, active")
        .or("active.eq.true,active.is.null")
        .order("sort_order", { ascending: true });

      if (!error && data && data.length > 0) {
        const cats = data.map((c: any) => ({
          id: String(c.id),
          name: String(c.name ?? ""),
          slug: String(c.slug ?? ""),
          parent_id: c.parent_id ? String(c.parent_id) : null,
          image_url: c.image_url ? String(c.image_url) : null,
          sort_order: Number(c.sort_order) || 0,
        })) as Category[];
        console.log("[CLIENT_PRODUCTS_04] CATEGORY COUNT (Public):", cats.length);
        cachedCategories = { data: cats, timestamp: Date.now() };
        return cats;
      }
    } catch (err) {
      console.warn("[listCategories] Public query error:", err);
    }
  }

  // If Supabase is configured, return empty array if no categories found
  if (isSupabasePublicConfigured()) {
    return [];
  }

  const inMem = getInMemoryCategories();
  console.log("[CLIENT_PRODUCTS_04] CATEGORY COUNT (Fallback):", inMem.length);
  cachedCategories = { data: inMem, timestamp: Date.now() };
  return inMem;
});

export const listBrands = createServerFn({ method: "GET" }).handler(async () => {
  if (
    cachedBrands &&
    cachedBrands.data.length > 0 &&
    Date.now() - cachedBrands.timestamp < SERVER_CACHE_TTL_MS * 5
  ) {
    return cachedBrands.data;
  }

  // Attempt 1: Fetch via Admin client
  try {
    const { supabaseAdmin, isSupabaseServerConfigured } =
      await import("@/integrations/supabase/client.server");
    if (isSupabaseServerConfigured()) {
      const { data, error } = await supabaseAdmin
        .from("brands")
        .select("id, name, slug, active")
        .or("active.eq.true,active.is.null")
        .order("name", { ascending: true });

      if (!error && data && data.length > 0) {
        const brands = data.map((b: any) => ({
          id: String(b.id),
          name: String(b.name ?? ""),
          slug: String(b.slug ?? ""),
        })) as Brand[];
        cachedBrands = { data: brands, timestamp: Date.now() };
        return brands;
      }
    }
  } catch (err) {
    console.warn("[listBrands] Admin query error:", err);
  }

  // Attempt 2: Fetch via Public client
  if (isSupabasePublicConfigured()) {
    try {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug, active")
        .or("active.eq.true,active.is.null")
        .order("name", { ascending: true });

      if (!error && data && data.length > 0) {
        const brands = data.map((b: any) => ({
          id: String(b.id),
          name: String(b.name ?? ""),
          slug: String(b.slug ?? ""),
        })) as Brand[];
        cachedBrands = { data: brands, timestamp: Date.now() };
        return brands;
      }
    } catch (err) {
      console.warn("[listBrands] Public query error:", err);
    }
  }

  // If Supabase is configured, return empty array if no brands found
  if (isSupabasePublicConfigured()) {
    return [];
  }

  const brands = getInMemoryBrands();
  cachedBrands = { data: brands, timestamp: Date.now() };
  return brands;
});

export const createBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; slug?: string | null }) => d)
  .handler(async ({ data, context }) => {
    invalidateServerCatalogCache();
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

    const newBrand: Brand = {
      id: `brand-${Date.now()}`,
      name,
      slug,
    };

    if (!isSupabaseServerConfigured()) {
      // Only when there is no database: check duplicates in the local fallback list
      const existingInMem = getInMemoryBrands().find(
        (b) => b.name.trim().toLowerCase() === name.toLowerCase() || b.slug === slug,
      );
      if (existingInMem) {
        return existingInMem;
      }
      return addInMemoryBrand(newBrand);
    }

    try {
      // Check duplicate in the database (case-insensitive name or exact slug)
      const { data: existingDb } = await context.supabase
        .from("brands")
        .select("id, name, slug")
        .or(`name.ilike.${name},slug.eq.${slug}`)
        .limit(1);

      if (existingDb && existingDb.length > 0) {
        invalidateServerCatalogCache();
        return existingDb[0] as Brand;
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
          const { data: dup } = await context.supabase
            .from("brands")
            .select("id, name, slug")
            .eq("slug", slug)
            .limit(1);
          if (dup && dup.length > 0) {
            invalidateServerCatalogCache();
            return dup[0] as Brand;
          }
        }
        throw new Error(error.message || "No se pudo crear la marca");
      }

      if (!inserted) {
        throw new Error("No se pudo crear la marca");
      }

      invalidateServerCatalogCache();
      return inserted as Brand;
    } catch (err: any) {
      throw new Error(err?.message || "No se pudo crear la marca");
    }
  });

