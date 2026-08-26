import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgePercent,
  Boxes,
  Check,
  CheckCircle2,
  Filter,
  HelpCircle,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { WholesaleProductCard } from "@/components/site/WholesaleProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart, WHOLESALE_MIN_ORDER_UNITS } from "@/lib/cart";
import { listCategories, listProducts } from "@/lib/catalog.functions";
import { moneyExact, whatsappLink } from "@/lib/format";
import { withTimeout } from "@/lib/safe-loader";
import { totalStock, type Category, type Product } from "@/lib/types";

export const Route = createFileRoute("/mayor")({
  loader: async ({ context }) => {
    const [products, categories] = await Promise.all([
      withTimeout(
        context.queryClient.fetchQuery({
          queryKey: ["products"],
          queryFn: () => listProducts({ data: { fresh: true } }),
          staleTime: 0,
        }),
        [],
      ),
      withTimeout(
        context.queryClient.ensureQueryData({
          queryKey: ["categories"],
          queryFn: () => listCategories(),
          staleTime: 5 * 60 * 1000,
        }),
        [],
      ),
    ]);
    return {
      products: (products ?? []) as Product[],
      categories: (categories ?? []) as Category[],
    };
  },
  head: () => ({
    meta: [
      { title: "Catálogo Mayorista | KICKPOINT Distribución Deportiva" },
      {
        name: "description",
        content:
          "Compra al mayor con KICKPOINT desde 8 unidades acumuladas. Puedes mezclar libremente productos, tallas y modelos con precios preferenciales.",
      },
      { property: "og:title", content: "Catálogo Mayorista | KICKPOINT" },
      {
        property: "og:description",
        content:
          "Precios de mayorista desde 8 unidades acumuladas para revendedores y tiendas deportivas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WholesaleCatalogPage,
});

function WholesaleCatalogPage() {
  const loaderData = Route.useLoaderData();
  const navigate = useNavigate();
  const {
    wholesaleLines,
    wholesaleCount,
    wholesaleSubtotal,
    wholesaleSavings,
    isWholesaleValid,
    wholesaleUnitsNeeded,
  } = useCart();

  // Filters state
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("todas");
  const [selectedBrand, setSelectedBrand] = useState<string>("todas");
  const [selectedSize, setSelectedSize] = useState<string>("todas");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState<"featured" | "discount" | "price_asc" | "price_desc">(
    "featured",
  );

  const {
    data: products = [],
    isLoading: isLoadingProducts,
    isPending: isPendingProducts,
    isFetching: isFetchingProducts,
  } = useQuery<Product[]>({
    queryKey: ["products"],
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: "always",
    ...(loaderData?.products && loaderData.products.length > 0
      ? { initialData: loaderData.products }
      : {}),
    queryFn: async () => {
      const res = await listProducts({ data: { fresh: true } });
      return (res ?? []) as Product[];
    },
  });

  const loadingProducts =
    (!products || products.length === 0) &&
    (isLoadingProducts || isPendingProducts || isFetchingProducts);

  const {
    data: categories = [],
    isLoading: isLoadingCategories,
    isPending: isPendingCategories,
    isFetching: isFetchingCategories,
  } = useQuery<Category[]>({
    queryKey: ["categories"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    ...(loaderData?.categories && loaderData.categories.length > 0
      ? { initialData: loaderData.categories }
      : {}),
    queryFn: async () => {
      const res = await listCategories();
      return (res ?? []) as Category[];
    },
  });

  // Extract available brands
  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.brand?.name) set.add(p.brand.name);
    }
    return Array.from(set).sort();
  }, [products]);

  // Extract available sizes
  const allSizes = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      for (const v of p.variants ?? []) {
        if (v.size) set.add(v.size);
      }
    }
    return Array.from(set);
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (p.active === false) return false;

        // Search query
        if (q.trim()) {
          const query = q.toLowerCase().trim();
          const matchName = p.name.toLowerCase().includes(query);
          const matchSku = p.base_sku?.toLowerCase().includes(query);
          const matchBrand = p.brand?.name?.toLowerCase().includes(query);
          if (!matchName && !matchSku && !matchBrand) return false;
        }

        // Category
        if (selectedCategory !== "todas" && p.category?.slug !== selectedCategory) {
          return false;
        }

        // Brand
        if (selectedBrand !== "todas" && p.brand?.name !== selectedBrand) {
          return false;
        }

        // Size
        if (selectedSize !== "todas") {
          const hasSize = (p.variants ?? []).some(
            (v) => v.size === selectedSize && (Number(v.stock) || 0) > 0,
          );
          if (!hasSize) return false;
        }

        // In Stock
        if (onlyInStock) {
          const pStock = totalStock(p);
          if (pStock <= 0) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "discount") {
          const savingsA = (a.retail_price || 0) - (a.wholesale_price || a.retail_price || 0);
          const savingsB = (b.retail_price || 0) - (b.wholesale_price || b.retail_price || 0);
          return savingsB - savingsA;
        }
        if (sortBy === "price_asc") {
          const priceA = a.wholesale_price ?? a.retail_price ?? 0;
          const priceB = b.wholesale_price ?? b.retail_price ?? 0;
          return Number(priceA) - Number(priceB);
        }
        if (sortBy === "price_desc") {
          const priceA = a.wholesale_price ?? a.retail_price ?? 0;
          const priceB = b.wholesale_price ?? b.retail_price ?? 0;
          return Number(priceB) - Number(priceA);
        }
        const orderDiff = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
        if (orderDiff !== 0) return orderDiff;
        return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);

      });
  }, [products, q, selectedCategory, selectedBrand, selectedSize, onlyInStock, sortBy]);

  const progressPercent = Math.min(
    100,
    Math.round((wholesaleCount / WHOLESALE_MIN_ORDER_UNITS) * 100),
  );

  return (
    <SiteLayout>
      {/* 1. Wholesale Hero Banner */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-surface-1 to-surface-2">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Tag className="size-3.5" /> Compra al Mayor KICKPOINT
              </span>
              <h1 className="text-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-foreground">
                Catálogo Mayorista Oficial
              </h1>
              <p className="mt-3 text-base text-muted-foreground leading-relaxed">
                Adquiere productos a <strong className="text-foreground">precio mayorista</strong>{" "}
                con un mínimo de{" "}
                <strong className="text-primary font-bold">
                  {WHOLESALE_MIN_ORDER_UNITS} unidades acumuladas
                </strong>{" "}
                en tu pedido. Puedes combinar libremente cualquier producto, modelo, equipo, talla o
                color.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-md bg-surface-3 px-2.5 py-1">
                  <Check className="size-3.5 text-primary" /> Mínimo 8 unidades combinadas
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-surface-3 px-2.5 py-1">
                  <Check className="size-3.5 text-primary" /> Stock real garantizado
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-surface-3 px-2.5 py-1">
                  <Check className="size-3.5 text-primary" /> Envíos TEALCA y MRW
                </span>
              </div>
            </div>

            {/* Quick Contact & Action Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button asChild variant="outlineGlow" size="lg" className="w-full justify-center">
                <a
                  href={whatsappLink(
                    "Hola KICKPOINT, tengo dudas sobre las compras al mayor y catálogo mayorista.",
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  Hablar con Asesor Mayorista
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Live Wholesale Cart Status Card (Sticky / Top Bar) */}
      <section className="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="size-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Progreso Pedido Mayorista:
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-extrabold ${
                      isWholesaleValid
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {wholesaleCount} / {WHOLESALE_MIN_ORDER_UNITS} unidades
                  </span>
                </div>

                {isWholesaleValid ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" /> Precio mayorista activado
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    Faltan{" "}
                    <strong className="text-amber-600 dark:text-amber-400">
                      {wholesaleUnitsNeeded} unidades
                    </strong>
                  </span>
                )}
              </div>

              {/* Visual Progress Bar */}
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full transition-all duration-500 ${
                    isWholesaleValid ? "bg-emerald-500" : "bg-primary"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Actions for Wholesale Cart */}
            <div className="flex items-center gap-2.5">
              {wholesaleLines.length > 0 && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">Total Mayor:</p>
                  <p className="text-sm font-bold text-primary">{moneyExact(wholesaleSubtotal)}</p>
                </div>
              )}

              <Button
                asChild
                variant={isWholesaleValid ? "hero" : "outline"}
                size="sm"
                className={`font-bold transition-all ${
                  isWholesaleValid
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                    : "opacity-80"
                }`}
              >
                <Link
                  to="/checkout"
                  search={{ tipo: "mayorista" }}
                  disabled={!isWholesaleValid}
                  title={
                    isWholesaleValid
                      ? "Continuar al Checkout Mayorista"
                      : `Debes acumular al menos ${WHOLESALE_MIN_ORDER_UNITS} unidades en el carrito`
                  }
                  className={!isWholesaleValid ? "pointer-events-none cursor-not-allowed" : ""}
                >
                  <span className="hidden sm:inline">Continuar al Checkout Mayorista</span>
                  <span className="sm:hidden">Ir a Checkout Mayorista</span>
                  <ArrowRight className="size-4 shrink-0" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Wholesale Catalog Browser & Filter Section */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        {/* Search and Filters Bar */}
        <div className="space-y-4 rounded-xl border border-border bg-surface-1 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por producto, modelo, marca o SKU..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 bg-surface-2"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                Ordenar:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-10 rounded-md border border-border bg-surface-2 px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="featured">Destacados</option>
                <option value="discount">Mayor ahorro al mayor</option>
                <option value="price_asc">Menor precio mayorista</option>
                <option value="price_desc">Mayor precio mayorista</option>
              </select>
            </div>
          </div>

          {/* Filter Chips: Categories */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Categorías
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategory("todas")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  selectedCategory === "todas"
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                }`}
              >
                Todas las categorías
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.slug)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    selectedCategory === c.slug
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Chips: Brands & Sizes */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t border-border/60">
            {/* Brands */}
            {brands.length > 0 && (
              <div className="flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Marcas
                </p>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedBrand("todas")}
                    className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                      selectedBrand === "todas"
                        ? "bg-surface-3 text-foreground font-bold"
                        : "text-muted-foreground hover:bg-surface-2"
                    }`}
                  >
                    Todas
                  </button>
                  {brands.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setSelectedBrand(b)}
                      className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                        selectedBrand === b
                          ? "bg-surface-3 text-foreground font-bold"
                          : "text-muted-foreground hover:bg-surface-2"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sizes */}
            {allSizes.length > 0 && (
              <div className="flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Tallas disponibles
                </p>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedSize("todas")}
                    className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                      selectedSize === "todas"
                        ? "bg-surface-3 text-foreground font-bold"
                        : "text-muted-foreground hover:bg-surface-2"
                    }`}
                  >
                    Todas
                  </button>
                  {allSizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                        selectedSize === s
                          ? "bg-surface-3 text-foreground font-bold"
                          : "text-muted-foreground hover:bg-surface-2"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Product Count & Active Filters Indicator */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Mostrando <span className="text-primary font-bold">{filteredProducts.length}</span>{" "}
            productos mayoristas
          </p>

          {(q ||
            selectedCategory !== "todas" ||
            selectedBrand !== "todas" ||
            selectedSize !== "todas") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setSelectedCategory("todas");
                setSelectedBrand("todas");
                setSelectedSize("todas");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3 mr-1" /> Limpiar filtros
            </Button>
          )}
        </div>

        {/* 4. Product Grid */}
        {loadingProducts && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="surface-card p-4 space-y-3">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        )}

        {!loadingProducts && filteredProducts.length === 0 && (
          <div className="surface-card mt-6 flex flex-col items-center gap-3 p-12 text-center">
            <Package className="size-12 text-muted-foreground/50" />
            <h3 className="text-lg font-bold text-foreground">
              No encontramos productos mayoristas
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Intenta cambiar los términos de búsqueda o remover los filtros seleccionados.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQ("");
                setSelectedCategory("todas");
                setSelectedBrand("todas");
                setSelectedSize("todas");
              }}
              className="mt-2"
            >
              Restablecer filtros
            </Button>
          </div>
        )}

        {!loadingProducts && filteredProducts.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <WholesaleProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* 5. How Wholesale Works / Policy Section */}
      <section className="border-t border-border bg-surface-1 py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-display text-2xl sm:text-3xl font-bold text-foreground">
              ¿Cómo funciona la compra mayorista en KICKPOINT?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Proceso transparente, ágil y diseñado para maximizar el margen de tu negocio o
              emprendimiento.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="surface-card p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-lg">
                1
              </div>
              <h3 className="mt-3 text-base font-bold text-foreground">Mezcla libre de modelos</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                No tienes que comprar la misma prenda: combina camisetas de diferentes clubes,
                licras, calzado y accesorios.
              </p>
            </div>

            <div className="surface-card p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-lg">
                2
              </div>
              <h3 className="mt-3 text-base font-bold text-foreground">Mínimo 8 unidades</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Al sumar 8 unidades acumuladas en el carrito mayorista, todos tus productos se
                calculan automáticamente a precio de mayor.
              </p>
            </div>

            <div className="surface-card p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-lg">
                3
              </div>
              <h3 className="mt-3 text-base font-bold text-foreground">Pagos en Bs o Divisas</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Paga fácilmente en Bolívares por Pago Móvil / Transferencia, o en USD vía Binance
                USDT y Zelle.
              </p>
            </div>

            <div className="surface-card p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-lg">
                4
              </div>
              <h3 className="mt-3 text-base font-bold text-foreground">Despachos a todo el país</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Enviamos asegurado por TEALCA y MRW directamente a tu ciudad, tienda o agencia de
                preferencia.
              </p>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
