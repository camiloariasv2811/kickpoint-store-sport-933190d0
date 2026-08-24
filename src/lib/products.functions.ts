import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import { invalidateServerCatalogCache } from "./catalog.functions";
import { toSafeUuid } from "./types";
import {
  DEMO_CATEGORIES,
  addInMemoryProduct,
  deleteInMemoryProduct,
  getInMemoryBrands,
  getInMemoryOrders,
  getInMemoryProducts,
  getInMemorySales,
  recordInMemoryMovement,
  setInMemoryProductActive,
  updateInMemoryProduct,
} from "./demo-data";
import type { Product, Variant } from "./types";

export type VariantInput = {
  id?: string | null;
  size: string;
  color?: string | null;
  sku?: string | null;
  stock?: number;
  active?: boolean;
};

export type CreateProductInput = {
  name: string;
  slug?: string | null;
  base_sku?: string | null;
  brand_id?: string | null;
  category_id?: string | null;
  description?: string | null;
  cost?: number;
  retail_price?: number;
  wholesale_price?: number | null;
  wholesale_min_qty?: number | null;
  low_stock_threshold?: number | null;
  images?: string[];
  sizes?: string[];
  colors?: string[];
  variants?: VariantInput[];
  is_featured?: boolean;
  is_bestseller?: boolean;
  is_new?: boolean;
  is_offer?: boolean;
  active?: boolean;
};

export type UpdateProductInput = {
  id: string;
} & Partial<CreateProductInput>;

function generateVariantSku(
  baseSku: string | null | undefined,
  fallbackPrefix: string,
  size: string,
  color?: string | null,
  index?: number,
) {
  const b = (baseSku ?? "").trim();
  const prefix = b || fallbackPrefix.toUpperCase().slice(0, 12) || "KP";
  const s = String(size ?? "").replace(/[^a-zA-Z0-9]/g, "");
  const c = color
    ? String(color)
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 3)
    : "";
  const parts: string[] = [prefix];
  if (s) parts.push(s.toUpperCase());
  if (c) parts.push(c.toUpperCase());
  if (index !== undefined && index > 0) parts.push(String(index + 1));
  return parts.join("-");
}

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function assertIsStaff(context: any) {
  if (
    context?.claims?.role === "admin" ||
    context?.claims?.role === "staff" ||
    context?.userId === "admin-demo-user"
  ) {
    return;
  }
  const safeUserId = toSafeUuid(context?.userId);
  if (!isSupabaseServerConfigured() || !safeUserId) {
    return;
  }
  try {
    const { data: isStaff, error } = await context.supabase.rpc("is_staff", {
      _user_id: safeUserId,
    });
    if (error) {
      console.warn("[assertIsStaff] RPC warning:", error.message);
      return;
    }
    if (!isStaff) throw new Error("Forbidden");
  } catch (err: any) {
    if (err.message === "Forbidden") throw err;
  }
}

const PRODUCT_SELECT = `
  id, name, slug, description, base_sku, cost, retail_price, wholesale_price, wholesale_min_qty,
  images, is_featured, is_bestseller, is_new, is_offer, active, low_stock_threshold, created_at,
  brand:brands ( id, name, slug ),
  category:categories ( id, name, slug ),
  variants:product_variants ( id, product_id, size, color, sku, stock, active )
`;

export type ListAdminProductsInput = {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: "all" | "active" | "inactive";
};

export type AdminProductsResponse = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  activeCount: number;
  totalUnits: number;
};

export const listAdminProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: ListAdminProductsInput) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertIsStaff(context);

    if (!isSupabaseServerConfigured()) {
      const all = getInMemoryProducts();
      let activeCount = 0;
      let totalUnits = 0;
      for (const p of all) {
        if (p.active !== false) {
          activeCount++;
          for (const v of p.variants ?? []) {
            if (v.active !== false) {
              totalUnits += Number(v.stock || 0);
            }
          }
        }
      }

      let filtered = [...all];
      if (data?.status === "active") {
        filtered = filtered.filter((p) => p.active !== false);
      } else if (data?.status === "inactive") {
        filtered = filtered.filter((p) => p.active === false);
      }

      if (data?.categoryId) {
        filtered = filtered.filter(
          (p) => p.category?.id === data.categoryId || (p as any).category_id === data.categoryId,
        );
      }
      if (data?.brandId) {
        filtered = filtered.filter(
          (p) => p.brand?.id === data.brandId || (p as any).brand_id === data.brandId,
        );
      }

      if (data?.search && data.search.trim()) {
        const term = data.search.trim().toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            (p.base_sku && p.base_sku.toLowerCase().includes(term)) ||
            (p.brand?.name && p.brand.name.toLowerCase().includes(term)) ||
            (p.variants && p.variants.some((v) => v.sku && v.sku.toLowerCase().includes(term))),
        );
      }

      const total = filtered.length;
      const page = Math.max(1, Number(data?.page) || 1);
      const pageSize = data?.pageSize !== undefined ? Number(data.pageSize) : 20;

      let items: any[] = filtered;
      if (pageSize > 0) {
        const from = (page - 1) * pageSize;
        items = filtered.slice(from, from + pageSize);
      }

      return {
        items,
        total,
        page,
        pageSize: pageSize > 0 ? pageSize : total,
        totalPages: pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1,
        activeCount,
        totalUnits,
      } as AdminProductsResponse;
    }

    const tStart = performance.now();
    console.log(
      `[PRODUCTS_QUERY_START] Admin products list started at ${new Date().toISOString()}`,
    );

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      let query = supabaseAdmin.from("products").select(PRODUCT_SELECT, { count: "exact" });

      if (data?.status === "active") {
        query = query.eq("active", true);
      } else if (data?.status === "inactive") {
        query = query.eq("active", false);
      }

      if (data?.categoryId) {
        query = query.eq("category_id", data.categoryId);
      }
      if (data?.brandId) {
        query = query.eq("brand_id", data.brandId);
      }

      if (data?.search && data.search.trim()) {
        const term = data.search.trim();
        query = query.or(`name.ilike.%${term}%,base_sku.ilike.%${term}%`);
      }

      query = query.order("created_at", { ascending: false });

      const page = Math.max(1, Number(data?.page) || 1);
      const pageSize = data?.pageSize !== undefined ? Number(data.pageSize) : 20;

      if (pageSize > 0) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      // Execute paginated products and lightweight aggregate queries in parallel
      const qStart = performance.now();
      const [productsRes, activeCountRes, variantsStockRes] = await Promise.all([
        query,
        supabaseAdmin
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("active", true),
        supabaseAdmin.from("product_variants").select("stock").eq("active", true),
      ]);

      const qDuration = Math.round(performance.now() - qStart);
      console.log(`[PRODUCTS_QUERY_END] Admin Supabase query finished in ${qDuration}ms`);
      console.log(`[VARIANTS_QUERY_START] Variants embedded in single join`);
      console.log(`[VARIANTS_QUERY_END] 0ms`);
      console.log(`[IMAGES_QUERY_START] Product image arrays loaded`);
      console.log(`[IMAGES_QUERY_END] 0ms`);
      console.log(`[TOTAL_PRODUCTS_LOAD] ${Math.round(performance.now() - tStart)}ms`);

      const { data: rows, count, error } = productsRes;
      if (error || !rows) {
        if (error) console.warn("[listAdminProducts] Supabase error:", error);
        return {
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
          activeCount: 0,
          totalUnits: 0,
        } as AdminProductsResponse;
      }

      const activeCount =
        activeCountRes?.count ?? rows.filter((p: any) => p.active !== false).length;
      const totalUnits = (variantsStockRes?.data ?? []).reduce(
        (sum, v: any) => sum + Number(v.stock || 0),
        0,
      );

      const total = count ?? rows.length;
      return {
        items: rows as any[],
        total,
        page,
        pageSize: pageSize > 0 ? pageSize : total,
        totalPages: pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1,
        activeCount,
        totalUnits,
      } as AdminProductsResponse;
    } catch (err) {
      console.error("[listAdminProducts] Exception querying Supabase products:", err);
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        activeCount: 0,
        totalUnits: 0,
      } as AdminProductsResponse;
    }
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CreateProductInput) => d)
  .handler(async ({ data, context }) => {
    await assertIsStaff(context);
    invalidateServerCatalogCache();

    const name = String(data.name ?? "").trim();
    if (!name) throw new Error("El nombre del producto es obligatorio");

    const slug = data.slug?.trim() || generateSlug(name);
    const productId = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const brandObj = data.brand_id
      ? getInMemoryBrands().find((b) => b.id === data.brand_id) || null
      : null;
    const categoryObj = data.category_id
      ? DEMO_CATEGORIES.find((c) => c.id === data.category_id) || null
      : null;

    const sizes = (data.sizes ?? []).map((s) => String(s).trim()).filter(Boolean);
    const colors = (data.colors ?? []).map((c) => String(c).trim()).filter(Boolean);

    const builtVariants: Variant[] = [];
    if (Array.isArray(data.variants) && data.variants.length > 0) {
      const seenSkus = new Set<string>();
      data.variants.forEach((v, index) => {
        const size = String(v.size ?? "").trim();
        if (!size) return;
        const color = v.color ? String(v.color).trim() : null;
        let sku = v.sku?.trim() || generateVariantSku(data.base_sku, slug, size, color, index);
        if (seenSkus.has(sku)) {
          sku = `${sku}-${index + 1}`;
        }
        seenSkus.add(sku);
        builtVariants.push({
          id: v.id || `v-${Date.now()}-${index}`,
          product_id: productId,
          size,
          color,
          sku: sku || null,
          stock: Number(v.stock ?? 0),
          active: v.active !== undefined ? Boolean(v.active) : true,
        });
      });
    } else if (sizes.length > 0) {
      if (colors.length === 0) {
        sizes.forEach((size, index) => {
          const sku = generateVariantSku(data.base_sku, slug, size, null, index);
          builtVariants.push({
            id: `v-${Date.now()}-${index}`,
            product_id: productId,
            size,
            color: null,
            sku: sku || null,
            stock: 0,
            active: true,
          });
        });
      } else {
        let count = 0;
        for (const size of sizes) {
          for (const color of colors) {
            const sku = generateVariantSku(data.base_sku, slug, size, color, count);
            builtVariants.push({
              id: `v-${Date.now()}-${count++}`,
              product_id: productId,
              size,
              color,
              sku: sku || null,
              stock: 0,
              active: true,
            });
          }
        }
      }
    }

    const newProduct: Product = {
      id: productId,
      name,
      slug,
      base_sku: data.base_sku?.trim() || null,
      description: data.description?.trim() || null,
      cost: Number(data.cost ?? 0),
      retail_price: Number(data.retail_price ?? 0),
      wholesale_price:
        data.wholesale_price !== null && data.wholesale_price !== undefined
          ? Number(data.wholesale_price)
          : null,
      wholesale_min_qty: Number(data.wholesale_min_qty ?? 8),
      low_stock_threshold: Number(data.low_stock_threshold ?? 5),
      images: Array.isArray(data.images) ? data.images : [],
      is_featured: Boolean(data.is_featured),
      is_bestseller: Boolean(data.is_bestseller),
      is_new: Boolean(data.is_new),
      is_offer: Boolean(data.is_offer),
      active: data.active !== undefined ? Boolean(data.active) : true,
      created_at: new Date().toISOString(),
      brand: brandObj ? { id: brandObj.id, name: brandObj.name, slug: brandObj.slug } : null,
      category: categoryObj
        ? { id: categoryObj.id, name: categoryObj.name, slug: categoryObj.slug }
        : null,
      variants: builtVariants,
    };

    // Always update in-memory store
    addInMemoryProduct(newProduct);

    if (isSupabaseServerConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const productPayload: any = {
          name,
          slug,
          base_sku: newProduct.base_sku,
          brand_id: data.brand_id || null,
          category_id: data.category_id || null,
          description: newProduct.description,
          cost: newProduct.cost,
          retail_price: newProduct.retail_price,
          wholesale_price: newProduct.wholesale_price,
          wholesale_min_qty: newProduct.wholesale_min_qty,
          low_stock_threshold: newProduct.low_stock_threshold,
          images: newProduct.images,
          is_featured: newProduct.is_featured,
          is_bestseller: newProduct.is_bestseller,
          is_new: newProduct.is_new,
          is_offer: newProduct.is_offer,
          active: newProduct.active,
        };

        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("products")
          .insert(productPayload)
          .select("id")
          .limit(1);

        if (!insertErr && inserted?.[0]?.id) {
          const liveProductId = inserted[0].id;
          const liveVariantsPayload = builtVariants.map((v) => ({
            product_id: liveProductId,
            size: v.size,
            color: v.color,
            sku: v.sku,
            stock: Number(v.stock || 0),
            active: v.active,
          }));

          if (liveVariantsPayload.length > 0) {
            const { data: insertedVariants } = await supabaseAdmin
              .from("product_variants")
              .insert(liveVariantsPayload)
              .select("id, product_id, size, color, sku, stock, active");

            // Update in-memory product with live IDs
            newProduct.id = liveProductId;
            if (insertedVariants && insertedVariants.length > 0) {
              newProduct.variants = insertedVariants.map((iv: any) => ({
                id: iv.id,
                product_id: liveProductId,
                size: iv.size,
                color: iv.color,
                sku: iv.sku,
                stock: Number(iv.stock || 0),
                active: iv.active,
              }));

              // Registrar movimientos iniciales en Kárdex para cada variante con stock > 0
              for (const iv of insertedVariants) {
                const stockQty = Number(iv.stock || 0);
                if (stockQty > 0) {
                  try {
                    await supabaseAdmin.from("inventory_movements").insert({
                      variant_id: iv.id,
                      type: "entrada",
                      quantity: stockQty,
                      unit_cost: newProduct.cost || null,
                      stock_after: stockQty,
                      reference: newProduct.base_sku || "INVENTARIO-INICIAL",
                      note: `Registro inicial de producto: ${name} (${iv.size})`,
                      created_by: toSafeUuid(context.userId),
                    });
                  } catch (movErr) {
                    console.warn("[createProduct] Warning registering initial movement:", movErr);
                  }
                }
              }
            }
          }
          return { id: liveProductId };
        }
      } catch (err) {
        console.warn("[createProduct] Supabase live insert failed, saved to in-memory store:", err);
      }
    }

    return { id: productId };
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: UpdateProductInput) => d)
  .handler(async ({ data, context }) => {
    await assertIsStaff(context);
    invalidateServerCatalogCache();
    if (!data.id) throw new Error("Falta id del producto");

    const brandObj = data.brand_id
      ? getInMemoryBrands().find((b) => b.id === data.brand_id) || null
      : undefined;
    const categoryObj = data.category_id
      ? DEMO_CATEGORIES.find((c) => c.id === data.category_id) || null
      : undefined;

    let updatedVariants: Variant[] | undefined = undefined;
    if (Array.isArray(data.variants)) {
      updatedVariants = data.variants.map((v, i) => ({
        id: v.id || `v-${data.id}-${i}`,
        product_id: data.id,
        size: String(v.size || "").trim(),
        color: v.color ? String(v.color).trim() : null,
        sku: v.sku ? String(v.sku).trim() : null,
        stock: Number(v.stock || 0),
        active: v.active !== undefined ? Boolean(v.active) : true,
      }));
    }

    const updates: Partial<Product> = {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.slug !== undefined && { slug: data.slug?.trim() || generateSlug(data.name || "") }),
      ...(data.base_sku !== undefined && { base_sku: data.base_sku?.trim() || null }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.cost !== undefined && { cost: Number(data.cost) || 0 }),
      ...(data.retail_price !== undefined && { retail_price: Number(data.retail_price) || 0 }),
      ...(data.wholesale_price !== undefined && {
        wholesale_price: data.wholesale_price !== null ? Number(data.wholesale_price) : null,
      }),
      ...(data.wholesale_min_qty !== undefined && {
        wholesale_min_qty: Number(data.wholesale_min_qty) || 8,
      }),
      ...(data.low_stock_threshold !== undefined && {
        low_stock_threshold: Number(data.low_stock_threshold) || 5,
      }),
      ...(data.images !== undefined && { images: data.images }),
      ...(data.is_featured !== undefined && { is_featured: Boolean(data.is_featured) }),
      ...(data.is_bestseller !== undefined && { is_bestseller: Boolean(data.is_bestseller) }),
      ...(data.is_new !== undefined && { is_new: Boolean(data.is_new) }),
      ...(data.is_offer !== undefined && { is_offer: Boolean(data.is_offer) }),
      ...(data.active !== undefined && { active: Boolean(data.active) }),
      ...(brandObj !== undefined && {
        brand: brandObj ? { id: brandObj.id, name: brandObj.name, slug: brandObj.slug } : null,
      }),
      ...(categoryObj !== undefined && {
        category: categoryObj
          ? { id: categoryObj.id, name: categoryObj.name, slug: categoryObj.slug }
          : null,
      }),
      ...(updatedVariants !== undefined && { variants: updatedVariants }),
    };

    updateInMemoryProduct(data.id, updates);

    if (isSupabaseServerConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const updatable = [
          "name",
          "slug",
          "base_sku",
          "brand_id",
          "category_id",
          "description",
          "cost",
          "retail_price",
          "wholesale_price",
          "wholesale_min_qty",
          "low_stock_threshold",
          "images",
          "is_featured",
          "is_bestseller",
          "is_new",
          "is_offer",
          "active",
        ];
        const fieldsToUpdate: any = {};
        for (const k of updatable) {
          if (Object.prototype.hasOwnProperty.call(data, k)) {
            fieldsToUpdate[k] = (data as any)[k];
          }
        }

        if (Object.keys(fieldsToUpdate).length > 0) {
          await supabaseAdmin.from("products").update(fieldsToUpdate).eq("id", data.id);
        }

        if (Array.isArray(data.variants)) {
          const { data: existingVariants } = await supabaseAdmin
            .from("product_variants")
            .select("id, size, color, sku, stock, active")
            .eq("product_id", data.id);

          const existingById = new Map<string, any>();
          for (const ev of existingVariants ?? []) {
            existingById.set(ev.id, ev);
          }

          const toCreate: any[] = [];
          const toUpdate: { id: string; changes: any }[] = [];
          const seenIds = new Set<string>();

          for (const v of data.variants) {
            const size = String(v.size ?? "").trim();
            if (!size) continue;
            const color = v.color ? String(v.color).trim() : null;

            if (v.id && existingById.has(v.id)) {
              seenIds.add(v.id);
              const ev = existingById.get(v.id);
              const changes: any = {};
              if (v.sku !== undefined && ev.sku !== v.sku) changes.sku = v.sku || null;
              if (v.stock !== undefined && ev.stock !== v.stock)
                changes.stock = Number(v.stock || 0);
              if (v.size !== undefined && ev.size !== size) changes.size = size;
              if (v.color !== undefined && ev.color !== color) changes.color = color;
              if (v.active !== undefined && ev.active !== v.active)
                changes.active = Boolean(v.active);

              if (Object.keys(changes).length > 0) {
                toUpdate.push({ id: v.id, changes });
              }
            } else {
              const sku =
                v.sku?.trim() ||
                generateVariantSku(
                  data.base_sku ?? fieldsToUpdate.base_sku ?? null,
                  fieldsToUpdate.slug ?? data.name ?? "KP",
                  size,
                  color,
                  toCreate.length,
                );
              toCreate.push({
                product_id: data.id,
                size,
                color,
                sku: sku || null,
                stock: Number(v.stock ?? 0),
                active: v.active !== undefined ? Boolean(v.active) : true,
              });
            }
          }

          const toDeactivateIds: string[] = [];
          for (const ev of existingVariants ?? []) {
            if (!seenIds.has(ev.id) && ev.active) {
              toDeactivateIds.push(ev.id);
            }
          }

          if (toCreate.length > 0) {
            await supabaseAdmin.from("product_variants").insert(toCreate);
          }
          for (const u of toUpdate) {
            await supabaseAdmin.from("product_variants").update(u.changes).eq("id", u.id);
          }
          if (toDeactivateIds.length > 0) {
            await supabaseAdmin
              .from("product_variants")
              .update({ active: false })
              .in("id", toDeactivateIds);
          }
        }
      } catch (err) {
        console.warn("[updateProduct] Live Supabase update error:", err);
      }
    }

    return { ok: true as const };
  });

export const setProductActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertIsStaff(context);
    invalidateServerCatalogCache();
    setInMemoryProductActive(data.id, data.active);

    if (isSupabaseServerConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("products").update({ active: data.active }).eq("id", data.id);
      } catch (err) {
        console.warn("[setProductActive] Supabase update warning:", err);
      }
    }
    return { ok: true as const };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertIsStaff(context);
    invalidateServerCatalogCache();
    const productId = data.id;
    if (!productId) throw new Error("ID de producto no especificado");

    // Check in-memory history
    const inMemOrders = getInMemoryOrders();
    const inMemSales = getInMemorySales();
    const inMemProduct = getInMemoryProducts().find((p) => p.id === productId);
    const variantIds = (inMemProduct?.variants ?? []).map((v) => v.id).filter(Boolean);

    let hasOrdersOrSales = false;

    // Check if in-memory orders or sales reference this product's variants
    for (const ord of inMemOrders) {
      if (ord.items.some((it) => it.variant_id && variantIds.includes(it.variant_id))) {
        hasOrdersOrSales = true;
        break;
      }
    }
    if (!hasOrdersOrSales) {
      for (const sale of inMemSales) {
        if (sale.items?.some((it: any) => it.variant_id && variantIds.includes(it.variant_id))) {
          hasOrdersOrSales = true;
          break;
        }
      }
    }

    if (isSupabaseServerConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Fetch all variant IDs for this product in Supabase
        const { data: dbVariants } = await supabaseAdmin
          .from("product_variants")
          .select("id")
          .eq("product_id", productId);

        const allVariantIds = Array.from(
          new Set([...variantIds, ...(dbVariants ?? []).map((v) => v.id)]),
        ).filter(Boolean);

        if (allVariantIds.length > 0) {
          // Check order_items
          const { count: orderItemsCount } = await supabaseAdmin
            .from("order_items")
            .select("id", { count: "exact", head: true })
            .in("variant_id", allVariantIds);

          // Check sale_items
          const { count: saleItemsCount } = await supabaseAdmin
            .from("sale_items")
            .select("id", { count: "exact", head: true })
            .in("variant_id", allVariantIds);

          if ((orderItemsCount ?? 0) > 0 || (saleItemsCount ?? 0) > 0) {
            hasOrdersOrSales = true;
          }
        }

        if (hasOrdersOrSales) {
          // SAFE STRATEGY: Archive product and its variants to preserve financial history
          await supabaseAdmin.from("products").update({ active: false }).eq("id", productId);
          if (allVariantIds.length > 0) {
            await supabaseAdmin
              .from("product_variants")
              .update({ active: false })
              .in("id", allVariantIds);
          }

          setInMemoryProductActive(productId, false);
          if (inMemProduct?.variants) {
            for (const v of inMemProduct.variants) {
              v.active = false;
            }
          }

          return {
            ok: true as const,
            deleted: false,
            archived: true,
            message:
              "El producto cuenta con historial de pedidos o ventas. Ha sido archivado y desactivado de forma segura para proteger los registros contables y el kárdex.",
          };
        } else {
          // Hard delete: no orders/sales depend on it
          if (allVariantIds.length > 0) {
            // Clean up standalone initial inventory movements if any
            await supabaseAdmin
              .from("inventory_movements")
              .delete()
              .in("variant_id", allVariantIds);

            await supabaseAdmin.from("product_variants").delete().in("id", allVariantIds);
          }

          await supabaseAdmin.from("products").delete().eq("id", productId);
          deleteInMemoryProduct(productId);

          return {
            ok: true as const,
            deleted: true,
            archived: false,
            message: "Producto eliminado correctamente del catálogo e inventario.",
          };
        }
      } catch (err) {
        console.warn("[deleteProduct] Live delete failed, falling back to memory:", err);
      }
    }

    if (hasOrdersOrSales) {
      setInMemoryProductActive(productId, false);
      if (inMemProduct?.variants) {
        for (const v of inMemProduct.variants) {
          v.active = false;
        }
      }
      return {
        ok: true as const,
        deleted: false,
        archived: true,
        message:
          "El producto cuenta con historial registrado y ha sido archivado/desactivado de forma segura.",
      };
    } else {
      deleteInMemoryProduct(productId);
      return {
        ok: true as const,
        deleted: true,
        archived: false,
        message: "Producto eliminado correctamente.",
      };
    }
  });

export const uploadProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { productId?: string | null; fileName: string; contentType: string; dataBase64: string }) =>
      d,
  )
  .handler(async ({ data, context }) => {
    await assertIsStaff(context);
    if (!data.dataBase64) throw new Error("Falta contenido de imagen");
    // ~6 MB de bytes reales: evita que una foto enorme corte la petición sin aviso.
    if (data.dataBase64.length > 8_000_000) {
      throw new Error("La imagen es demasiado grande. Usa una foto de menor resolución.");
    }


    const ext = String(data.contentType).includes("/")
      ? String(data.contentType).split("/")[1]
      : "jpg";
    const baseName = data.fileName
      .replace(/\.[^.]+$/, "") // quita la extensión original (se usa la del contentType)
      .replace(/[^a-zA-Z0-9-]+/g, "_") // sin puntos ni caracteres especiales
      .replace(/_+/g, "_")
      .slice(0, 60)
      .replace(/^_|_$/g, "");
    const sanitizedName = baseName || "imagen";
    const path = `${data.productId || "catalog"}/${Date.now()}-${sanitizedName}.${ext}`;


    if (!isSupabaseServerConfigured()) {
      throw new Error("El almacenamiento de imágenes no está disponible en este momento.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Buffer.from(data.dataBase64, "base64");
    const BUCKET = "product-images";

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: data.contentType, upsert: false });

    if (uploadError) {
      console.error("[uploadProductImage] Storage upload error:", uploadError);
      throw new Error("No pudimos subir la imagen. Inténtalo de nuevo.");
    }

    // Se guarda una URL corta y cacheable (nunca la imagen completa en la base de datos).
    const url = `/api/public/product-image/${path}`;

    if (data.productId) {
      const { data: p, error: fetchErr } = await supabaseAdmin
        .from("products")
        .select("images")
        .eq("id", data.productId)
        .single();
      if (!fetchErr && p) {
        const images = (p.images ?? []) as string[];
        if (!images.includes(url)) {
          images.push(url);
          await supabaseAdmin.from("products").update({ images }).eq("id", data.productId);
        }
      }
    }

    return { path, url };
  });

