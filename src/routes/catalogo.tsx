import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X, ArrowDown } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";

import { ProductCard } from "@/components/site/ProductCard";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listBrands, listCategories, listProducts } from "@/lib/catalog.functions";
import { devLog } from "@/lib/dev-log";
import { withTimeout } from "@/lib/safe-loader";
import { totalStock } from "@/lib/types";

type Search = {
  q?: string | undefined;
  categoria?: string | undefined;
  marca?: string | undefined;
  talla?: string | undefined;
  max?: number | undefined;
  orden?: string | undefined;
};

export const Route = createFileRoute("/catalogo")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search["q"] === "string" ? (search["q"] as string) : undefined,
    categoria:
      typeof search["categoria"] === "string" ? (search["categoria"] as string) : undefined,
    marca: typeof search["marca"] === "string" ? (search["marca"] as string) : undefined,
    talla: typeof search["talla"] === "string" ? (search["talla"] as string) : undefined,
    max: search["max"] ? Number(search["max"]) : undefined,
    orden: typeof search["orden"] === "string" ? (search["orden"] as string) : undefined,
  }),
  loader: async ({ context }) => {
    devLog("[CATALOG_DEBUG_01] loader start");
    // Nunca bloqueamos la navegación: si el backend tarda, la ruta se muestra
    // igual y las queries del cliente completan los datos al llegar.
    const [products, categories, brands] = await Promise.all([
      withTimeout(
        context.queryClient.ensureQueryData({
          queryKey: ["products"],
          queryFn: () => listProducts(),
          staleTime: 60 * 1000,
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
      withTimeout(
        context.queryClient.ensureQueryData({
          queryKey: ["brands"],
          queryFn: () => listBrands(),
          staleTime: 5 * 60 * 1000,
        }),
        [],
      ),
    ]);
    devLog("[CATALOG_DEBUG_02] loader products count", products?.length ?? 0);
    return {
      products: products ?? [],
      categories: categories ?? [],
      brands: brands ?? [],
    };
  },
  head: () => ({
    meta: [
      { title: "Catálogo KICKPOINT | Fútbol, gym y marcas premium" },
      {
        name: "description",
        content:
          "Explora todo el catálogo KICKPOINT: franelas de fútbol, leggins, tops, conjuntos y marcas como Alo y On. Filtra por categoría, marca, talla y precio.",
      },
      { property: "og:title", content: "Catálogo KICKPOINT" },
      {
        property: "og:description",
        content: "Todo el catálogo de ropa deportiva KICKPOINT al mayor y al detal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Catalogo,
});

const ORDERS = [
  { value: "nuevos", label: "Nuevos" },
  { value: "precio_asc", label: "Precio ↑" },
  { value: "precio_desc", label: "Precio ↓" },
  { value: "vendidos", label: "Más vendidos" },
];

const INITIAL_BATCH_SIZE = 20;

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-primary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function Catalogo() {
  const [routeMountTime] = useState(() => {
    const t = performance.now();
    devLog(`[CATALOG_ROUTE_READY] Route mounted`);
    return t;
  });
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/catalogo" });
  const setSearch = (patch: Partial<Search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const loaderData = Route.useLoaderData();
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_BATCH_SIZE);
  const firstRenderLogged = useRef(false);
  const firstImageLogged = useRef(false);
  const renderCount = useRef(0);
  renderCount.current += 1;

  const {
    data: products = [],
    isLoading: isLoadingProducts,
    isPending: isPendingProducts,
    isFetching: isFetchingProducts,
  } = useQuery({
    queryKey: ["products"],
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    ...(loaderData?.products && loaderData.products.length > 0
      ? { initialData: loaderData.products }
      : {}),
    queryFn: async () => {
      const reqStart = performance.now();
      devLog(`[CATALOG_REQUEST_START] Requesting catalog products from server`);
      try {
        const res = await listProducts();
        devLog(
          `[CATALOG_RESPONSE_RECEIVED] Received ${res?.length ?? 0} products in ${Math.round(performance.now() - reqStart)}ms`,
        );
        return res ?? [];
      } catch (err) {
        console.warn("[Catalogo] Error loading products:", err);
        return [];
      }
    },
  });

  const {
    data: categories = [],
    isLoading: isLoadingCategories,
    isPending: isPendingCategories,
    isFetching: isFetchingCategories,
  } = useQuery({
    queryKey: ["categories"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    ...(loaderData?.categories && loaderData.categories.length > 0
      ? { initialData: loaderData.categories }
      : {}),
    queryFn: async () => {
      try {
        const res = await listCategories();
        return res ?? [];
      } catch (err) {
        console.warn("[Catalogo] Error loading categories:", err);
        return [];
      }
    },
  });

  const {
    data: brands = [],
    isLoading: isLoadingBrands,
    isPending: isPendingBrands,
    isFetching: isFetchingBrands,
  } = useQuery({
    queryKey: ["brands"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    ...(loaderData?.brands && loaderData.brands.length > 0
      ? { initialData: loaderData.brands }
      : {}),
    queryFn: async () => {
      try {
        const res = await listBrands();
        return res ?? [];
      } catch (err) {
        console.warn("[Catalogo] Error loading brands:", err);
        return [];
      }
    },
  });

  const isLoading =
    (!products || products.length === 0) &&
    (isLoadingProducts || isPendingProducts || isFetchingProducts);

  devLog("[CATALOG_DEBUG] render", {
    initialData: loaderData?.products?.length ?? 0,
    data: products?.length ?? 0,
    isLoading: isLoadingProducts,
    isFetching: isFetchingProducts,
    isPending: isPendingProducts,
    renders: renderCount.current,
  });

  const sizes = useMemo(() => {
    const set = new Set<string>();
    products?.forEach((p) => p.variants?.forEach((v) => set.add(v.size)));
    return Array.from(set);
  }, [products]);

  const categorySlugs = useMemo(() => {
    if (!search.categoria || !categories) return null;
    const match = categories.find((c) => c.slug === search.categoria);
    if (!match) return [search.categoria];
    const children = categories.filter((c) => c.parent_id === match.id).map((c) => c.slug);
    return [match.slug, ...children];
  }, [search.categoria, categories]);

  const filtered = useMemo(() => {
    let list = [...(products ?? [])];
    if (search.q) {
      const q = search.q.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand?.name ?? "").toLowerCase().includes(q) ||
          (p.base_sku ?? "").toLowerCase().includes(q),
      );
    }
    if (categorySlugs)
      list = list.filter((p) => p.category && categorySlugs.includes(p.category.slug));
    if (search.marca) list = list.filter((p) => p.brand?.slug === search.marca);
    if (search.talla)
      list = list.filter((p) => p.variants?.some((v) => v.size === search.talla && v.stock > 0));
    if (search.max) list = list.filter((p) => Number(p.retail_price) <= Number(search.max));

    switch (search.orden) {
      case "precio_asc":
        list.sort((a, b) => Number(a.retail_price) - Number(b.retail_price));
        break;
      case "precio_desc":
        list.sort((a, b) => Number(b.retail_price) - Number(a.retail_price));
        break;
      case "vendidos":
        list.sort((a, b) => Number(b.is_bestseller) - Number(a.is_bestseller));
        break;
      case "nuevos":
        list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        break;
      default:
        // Respeta el orden personalizado definido en el admin (Orden catálogo)
        list.sort((a, b) => {
          const diff = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
          if (diff !== 0) return diff;
          return a.created_at < b.created_at ? 1 : -1;
        });
    }

    return list;
  }, [products, search, categorySlugs]);

  // Reset pagination when search filter changes
  useEffect(() => {
    setVisibleLimit(INITIAL_BATCH_SIZE);
  }, [search.q, search.categoria, search.marca, search.talla, search.max, search.orden]);

  // Telemetry: measure first product rendered & interactive
  useEffect(() => {
    if (filtered.length > 0 && !firstRenderLogged.current) {
      firstRenderLogged.current = true;
      requestAnimationFrame(() => {
        const timeToFirst = Math.round(performance.now() - routeMountTime);
        devLog(`[FIRST_PRODUCT_RENDERED] First product rendered at ${timeToFirst}ms (TTFP)`);
        devLog(
          `[CATALOG_INTERACTIVE] Filters, search and product grid interactive at ${timeToFirst}ms`,
        );
        devLog(
          `[CATALOG_FULLY_LOADED] Batch of ${Math.min(filtered.length, visibleLimit)} products loaded at ${timeToFirst}ms`,
        );
      });
    }
  }, [filtered, routeMountTime, visibleLimit]);

  const handleFirstImageLoaded = () => {
    if (!firstImageLogged.current) {
      firstImageLogged.current = true;
      devLog(
        `[FIRST_IMAGE_RENDERED] First product image loaded at ${Math.round(performance.now() - routeMountTime)}ms`,
      );
    }
  };

  const visibleProducts = useMemo(() => {
    return filtered.slice(0, visibleLimit);
  }, [filtered, visibleLimit]);

  const hasFilters = Boolean(
    search.q || search.categoria || search.marca || search.talla || search.max || search.orden,
  );

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-eyebrow text-primary">Catálogo</p>
            <h1 className="text-display text-3xl sm:text-4xl">Todos los productos</h1>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search.q ?? ""}
              onChange={(e) => setSearch({ q: e.target.value || undefined })}
              placeholder="Buscar producto o marca..."
              className="h-11 pl-9"
            />
          </div>
        </div>

        <div className="mt-6 space-y-3 border-y border-border py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <SlidersHorizontal className="size-4 text-primary" />
            <span className="text-eyebrow text-[0.65rem]">Categorías</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(categories ?? [])
              .filter((c) => !c.parent_id)
              .map((c) => (
                <Chip
                  key={c.id}
                  active={search.categoria === c.slug}
                  onClick={() =>
                    setSearch({ categoria: search.categoria === c.slug ? undefined : c.slug })
                  }
                >
                  {c.name}
                </Chip>
              ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {(brands ?? []).map((b) => (
              <Chip
                key={b.id}
                active={search.marca === b.slug}
                onClick={() => setSearch({ marca: search.marca === b.slug ? undefined : b.slug })}
              >
                {b.name}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {sizes.map((s) => (
              <Chip
                key={s}
                active={search.talla === s}
                onClick={() => setSearch({ talla: search.talla === s ? undefined : s })}
              >
                {s}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap gap-2">
              {ORDERS.map((o) => (
                <Chip
                  key={o.value}
                  active={search.orden === o.value}
                  onClick={() =>
                    setSearch({ orden: search.orden === o.value ? undefined : o.value })
                  }
                >
                  {o.label}
                </Chip>
              ))}
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigate({
                    search: {},
                  })
                }
              >
                <X className="size-4" /> Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          {isLoading
            ? "Cargando productos..."
            : filtered.length > 0
              ? `${filtered.length} producto(s) encontrados`
              : products.length > 0
                ? "0 productos encontrados para los filtros seleccionados"
                : "No hay productos disponibles"}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
          {isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          {!isLoading &&
            visibleProducts.map((p, idx) => (
              <ProductCard
                key={p.id}
                product={p}
                priority={idx < 4}
                onImageLoad={idx === 0 ? handleFirstImageLoaded : undefined}
              />
            ))}
        </div>

        {!isLoading && filtered.length > visibleLimit && (
          <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-xs text-muted-foreground">
              Mostrando {visibleProducts.length} de {filtered.length} productos
            </p>
            <Button
              variant="outline"
              onClick={() => setVisibleLimit((prev) => prev + INITIAL_BATCH_SIZE)}
              className="gap-2"
            >
              <ArrowDown className="size-4" /> Cargar más productos
            </Button>
          </div>
        )}

        {!isLoading && products.length > 0 && filtered.length === 0 && (
          <div className="surface-card mt-6 p-10 text-center">
            <p className="text-display text-xl">Sin resultados</p>
            <p className="mt-2 text-sm text-muted-foreground">
              No encontramos productos que coincidan con la búsqueda o filtros seleccionados.
            </p>
            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ search: {} })}
                className="mt-4"
              >
                Limpiar todos los filtros
              </Button>
            )}
          </div>
        )}

        {!isLoading && products.length === 0 && (
          <div className="surface-card mt-6 p-10 text-center">
            <p className="text-display text-xl">No hay productos disponibles</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Pronto agregaremos nuevos productos a nuestra tienda.
            </p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <p className="mt-6 text-xs text-muted-foreground">
            Stock total disponible:{" "}
            {filtered.reduce((sum, p) => sum + totalStock(p), 0).toLocaleString()} unidades
          </p>
        )}
      </div>
    </SiteLayout>
  );
}
