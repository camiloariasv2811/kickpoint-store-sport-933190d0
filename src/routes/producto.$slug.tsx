import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Truck,
  MessageCircle,
  ArrowLeft,
} from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProduct } from "@/lib/catalog.functions";
import { useCart } from "@/lib/cart";
import { money, moneyExact, whatsappLink } from "@/lib/format";
import { totalStock, type Product } from "@/lib/types";

export const Route = createFileRoute("/producto/$slug")({
  loader: async ({ params }) => {
    const product = await getProduct({ data: { slug: params.slug } }).catch(() => null);
    return { product };
  },
  head: () => ({
    meta: [
      { title: "Producto | KICKPOINT" },
      { name: "description", content: "Ropa deportiva y calzado premium en KICKPOINT." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductPageContainer,
});

function ProductSkeleton() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <span>/</span>
          <Skeleton className="h-4 w-20" />
          <span>/</span>
          <Skeleton className="h-4 w-32" />
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-3">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <div className="flex gap-2">
              <Skeleton className="size-16 rounded-lg" />
              <Skeleton className="size-16 rounded-lg" />
              <Skeleton className="size-16 rounded-lg" />
            </div>
          </div>

          <div className="space-y-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-20 w-full" />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-20" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-16 rounded-lg" />
                <Skeleton className="h-10 w-16 rounded-lg" />
                <Skeleton className="h-10 w-16 rounded-lg" />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Skeleton className="h-12 flex-1 rounded-xl" />
              <Skeleton className="h-12 w-32 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

function ProductNotFound() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-display text-3xl">Producto no encontrado</h1>
        <p className="mt-2 text-muted-foreground">
          El producto solicitado no está disponible o ha sido retirado.
        </p>
        <Button asChild variant="hero" className="mt-6 gap-2">
          <Link to="/catalogo">
            <ArrowLeft className="size-4" /> Ver catálogo
          </Link>
        </Button>
      </div>
    </SiteLayout>
  );
}

function ProductPageContainer() {
  const { slug } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const queryClient = useQueryClient();
  const [navStart] = useState(() => performance.now());

  const {
    data: product,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["product", slug],
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    initialData: () => {
      if (loaderData?.product) return loaderData.product;
      const catalog = queryClient.getQueryData<Product[]>(["products"]);
      return catalog?.find((p) => p.slug === slug);
    },
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(["products"])?.dataUpdatedAt || Date.now(),
    queryFn: async () => {
      const t0 = performance.now();
      console.log(`[PRODUCT_DETAIL_FETCH_START] Requesting product: ${slug}`);
      try {
        const res = await getProduct({ data: { slug } });
        console.log(
          `[PRODUCT_DETAIL_FETCH_END] Product received in ${Math.round(performance.now() - t0)}ms`,
        );
        return res;
      } catch (err) {
        console.warn("[ProductPage] Error loading product:", err);
        return null;
      }
    },
  });

  if (isLoading && !product) {
    return <ProductSkeleton />;
  }

  if (isError || (!isLoading && !product)) {
    return <ProductNotFound />;
  }

  return <ProductDetailView product={product!} navStart={navStart} />;
}

function ProductDetailView({ product, navStart }: { product: Product; navStart: number }) {
  const { addLine } = useCart();
  const hasLogged = useRef(false);

  useEffect(() => {
    if (!hasLogged.current) {
      hasLogged.current = true;
      requestAnimationFrame(() => {
        const elapsed = Math.round(performance.now() - navStart);
        console.log(`[PRODUCT_DETAIL_RENDERED] Time to Product Detail (TTPD): ${elapsed}ms`);
      });
    }
  }, [navStart]);

  const colors = useMemo(
    () =>
      Array.from(new Set((product.variants ?? []).map((v) => v.color).filter(Boolean))) as string[],
    [product.variants],
  );
  const [color, setColor] = useState<string | null>(colors[0] ?? null);
  const sizes = useMemo(
    () => (product.variants ?? []).filter((v) => (color ? v.color === color : true)),
    [product.variants, color],
  );
  const [variantId, setVariantId] = useState<string | null>(
    sizes.find((v) => v.stock > 0)?.id ?? null,
  );
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  const variant = (product.variants ?? []).find((v) => v.id === variantId) ?? null;
  const wholesaleActive =
    Boolean(product.wholesale_price) && qty >= (product.wholesale_min_qty ?? 8);
  const unit = wholesaleActive ? Number(product.wholesale_price) : Number(product.retail_price);
  const stock = totalStock(product);

  function handleAdd() {
    if (!variant) {
      toast.error("Selecciona una talla");
      return;
    }
    addLine({
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images?.[0] ?? null,
      size: variant.size,
      color: variant.color,
      retailPrice: Number(product.retail_price),
      wholesalePrice: product.wholesale_price ? Number(product.wholesale_price) : null,
      wholesaleMinQty: product.wholesale_min_qty,
      stock: variant.stock,
      quantity: Math.min(qty, variant.stock),
    });
    toast.success("Agregado al carrito", {
      description: `${product.name} · Talla ${variant.size} × ${qty}`,
    });
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">
            Inicio
          </Link>
          <span>/</span>
          <Link to="/catalogo" className="hover:text-primary">
            Catálogo
          </Link>
          {product.category && (
            <>
              <span>/</span>
              <Link
                to="/catalogo"
                search={{ categoria: product.category.slug }}
                className="hover:text-primary"
              >
                {product.category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-foreground font-medium">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="surface-card aspect-square overflow-hidden bg-surface-2">
              {product.images?.[imageIndex] && (
                <img
                  src={product.images[imageIndex]}
                  alt={product.name}
                  width={900}
                  height={900}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className="size-full object-cover"
                />
              )}
            </div>
            {product.images && product.images.length > 1 && (
              <div className="flex gap-2">
                {product.images.map((img, i) => (
                  <button
                    key={img + i}
                    onClick={() => setImageIndex(i)}
                    className={`size-16 overflow-hidden rounded-lg border-2 transition-colors ${
                      i === imageIndex ? "border-primary" : "border-border"
                    }`}
                  >
                    <img
                      src={img}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-eyebrow text-primary">{product.brand?.name ?? "KICKPOINT"}</p>
            <h1 className="text-display mt-1 text-3xl sm:text-4xl">{product.name}</h1>

            <div className="mt-4 flex items-end gap-3">
              <span className="text-3xl font-bold text-primary">{money(unit)}</span>
              {wholesaleActive && (
                <span className="text-sm text-muted-foreground line-through">
                  {money(product.retail_price)}
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm">
              <span
                className={`size-2 rounded-full ${stock > 0 ? "bg-primary" : "bg-destructive"}`}
                aria-hidden
              />
              <span className="text-muted-foreground">
                {stock > 0 ? `Stock disponible (${stock} und.)` : "Agotado"}
              </span>
            </p>

            {product.description && (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            )}

            {colors.length > 0 && (
              <div className="mt-6">
                <p className="text-eyebrow mb-2 text-[0.65rem]">Color</p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setColor(c);
                        const next = (product.variants ?? []).find(
                          (v) => v.color === c && v.stock > 0,
                        );
                        setVariantId(next?.id ?? null);
                      }}
                      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                        color === c
                          ? "border-primary bg-accent text-primary"
                          : "border-border hover:border-primary/60"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5">
              <p className="text-eyebrow mb-2 text-[0.65rem]">Talla</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((v) => {
                  const disabled = v.stock <= 0;
                  const active = variantId === v.id;
                  return (
                    <button
                      key={v.id}
                      disabled={disabled}
                      onClick={() => {
                        setVariantId(v.id);
                        setQty(1);
                      }}
                      className={`min-w-14 rounded-lg border px-4 py-3 text-sm font-bold transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/60"
                      } ${disabled ? "cursor-not-allowed opacity-35 line-through" : ""}`}
                    >
                      {v.size}
                    </button>
                  );
                })}
              </div>
              {variant && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {variant.stock} unidades disponibles en talla {variant.size}
                  {variant.sku ? ` · SKU ${variant.sku}` : ""}
                </p>
              )}
            </div>

            <div className="mt-5">
              <p className="text-eyebrow mb-2 text-[0.65rem]">Cantidad</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-xl border border-border">
                  <button
                    aria-label="Disminuir"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex size-12 items-center justify-center text-muted-foreground hover:text-primary"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-10 text-center text-lg font-bold">{qty}</span>
                  <button
                    aria-label="Aumentar"
                    onClick={() => setQty((q) => Math.min(variant?.stock ?? 99, q + 1))}
                    className="flex size-12 items-center justify-center text-muted-foreground hover:text-primary"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total: <span className="font-bold text-primary">{moneyExact(unit * qty)}</span>
                </p>
              </div>
            </div>

            {product.wholesale_price && (
              <div className="surface-card mt-6 overflow-hidden">
                <p className="text-eyebrow border-b border-border bg-accent px-4 py-2.5 text-[0.65rem]">
                  Precios por cantidad
                </p>
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-muted-foreground">
                      1 - {(product.wholesale_min_qty ?? 8) - 1} unidades
                    </span>
                    <span className="font-bold">{money(product.retail_price)} c/u</span>
                  </div>
                  <div
                    className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                      wholesaleActive ? "bg-accent" : ""
                    }`}
                  >
                    <span className="text-muted-foreground">
                      {product.wholesale_min_qty ?? 8}+ unidades (mayor)
                    </span>
                    <span className="font-bold text-primary">
                      {money(product.wholesale_price)} c/u
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="hero"
                size="xl"
                className="flex-1"
                disabled={!variant || variant.stock <= 0}
                onClick={handleAdd}
              >
                <ShoppingCart className="size-5" /> Agregar al carrito
              </Button>
              <Button asChild variant="dark" size="xl">
                <a
                  href={whatsappLink(`Hola KICKPOINT, quiero información de: ${product.name}`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-5" /> Consultar
                </a>
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { icon: Truck, t: "Envíos nacionales" },
                { icon: ShieldCheck, t: "Compra segura" },
                { icon: Check, t: "Stock verificado" },
              ].map((b) => (
                <div key={b.t} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <b.icon className="size-4 text-primary" /> {b.t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
