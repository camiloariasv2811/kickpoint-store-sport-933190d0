import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Truck,
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
  loader: async ({ context, params }) => {
    const product = await context.queryClient
      .ensureQueryData({
        queryKey: ["product", params.slug],
        queryFn: () => getProduct({ data: { slug: params.slug } }),
        staleTime: 60 * 1000,
      })
      .catch(() => null);
    return { product: product ?? null };
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
    data: product = loaderData?.product,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["product", slug],
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    initialData: () => {
      if (loaderData?.product) return loaderData.product;
      const catalog = queryClient.getQueryData<Product[]>(["products"]);
      return catalog?.find((p) => p.slug === slug && p.active !== false);
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
  const { addLine, addWholesaleLine, wholesaleCount } = useCart();
  const hasLogged = useRef(false);

  const variants = useMemo(() => product.variants ?? [], [product.variants]);

  useEffect(() => {
    console.log("[PRODUCT_SELECT_01] PRODUCT CARD MOUNT", product.name);
    console.log("[PRODUCT_SELECT_02] VARIANTS AVAILABLE", variants.length);
    if (!hasLogged.current) {
      hasLogged.current = true;
      requestAnimationFrame(() => {
        const elapsed = Math.round(performance.now() - navStart);
        console.log(`[PRODUCT_DETAIL_RENDERED] Time to Product Detail (TTPD): ${elapsed}ms`);
      });
    }
  }, [navStart, product.name, variants.length]);

  const colors = useMemo(
    () => Array.from(new Set(variants.map((v) => v.color).filter(Boolean))) as string[],
    [variants],
  );
  const [color, setColor] = useState<string | null>(colors[0] ?? null);
  const sizes = useMemo(
    () => variants.filter((v) => (color ? v.color === color : true)),
    [variants, color],
  );
  const [variantId, setVariantId] = useState<string | null>(
    sizes.find((v) => v.stock > 0)?.id ?? sizes[0]?.id ?? null,
  );
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  const variant =
    variants.find((v) => v.id === variantId) ?? sizes.find((v) => v.stock > 0) ?? sizes[0] ?? null;
  const retailPrice = Number(product.retail_price || 0);
  const wholesalePrice = product.wholesale_price ? Number(product.wholesale_price) : retailPrice;
  const stock = totalStock(product);

  function handleColorChange(c: string) {
    console.log("[PRODUCT_SELECT_03] COLOR SELECTED", c);
    setColor(c);
    const nextVariant =
      variants.find((v) => v.color === c && v.stock > 0) ??
      variants.find((v) => v.color === c) ??
      null;
    setVariantId(nextVariant?.id ?? null);
  }

  function handleSizeChange(selectedVarId: string) {
    const selectedVar = variants.find((v) => v.id === selectedVarId);
    console.log("[PRODUCT_SELECT_04] SIZE SELECTED", selectedVar?.size, selectedVarId);
    setVariantId(selectedVarId);
    setQty(1);
  }

  function handleQtyChange(newQty: number) {
    console.log("[PRODUCT_SELECT_05] QUANTITY CHANGED", newQty);
    setQty(newQty);
  }

  function handleAdd() {
    console.log("[PRODUCT_SELECT_06] ADD TO CART START (Retail)");
    if (!variant) {
      toast.error("Selecciona una talla");
      return;
    }
    const safeStock = Number(variant.stock) || 0;
    const safeQty = Math.max(1, Math.min(qty, safeStock > 0 ? safeStock : 1));

    addLine({
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images?.[0] ?? null,
      size: variant.size,
      color: variant.color,
      retailPrice,
      wholesalePrice: product.wholesale_price ? Number(product.wholesale_price) : null,
      wholesaleMinQty: product.wholesale_min_qty || WHOLESALE_MIN_ORDER_UNITS,
      stock: safeStock,
      quantity: safeQty,
    });
    console.log("[PRODUCT_SELECT_10] SUCCESS (Retail)");
    toast.success("Agregado al carrito minorista", {
      description: `${product.name} · Talla ${variant.size} × ${safeQty}`,
    });
  }

  function handleAddWholesale() {
    console.log("[PRODUCT_SELECT_06] ADD TO CART START (Wholesale)");
    if (!variant) {
      toast.error("Selecciona una talla");
      return;
    }
    const safeStock = Number(variant.stock) || 0;
    const safeQty = Math.max(1, Math.min(qty, safeStock > 0 ? safeStock : 1));

    addWholesaleLine({
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images?.[0] ?? null,
      size: variant.size,
      color: variant.color,
      retailPrice,
      wholesalePrice,
      wholesaleMinQty: product.wholesale_min_qty || WHOLESALE_MIN_ORDER_UNITS,
      stock: safeStock,
      quantity: safeQty,
    });

    console.log("[PRODUCT_SELECT_10] SUCCESS (Wholesale)");
    const newTotal = wholesaleCount + safeQty;
    if (newTotal >= WHOLESALE_MIN_ORDER_UNITS) {
      toast.success("¡Agregado al pedido mayorista!", {
        description: `Total mayorista acumulado: ${newTotal}/${WHOLESALE_MIN_ORDER_UNITS} unidades (Precio mayorista activado).`,
      });
    } else {
      toast.info("Agregado al pedido mayorista", {
        description: `Llevas ${newTotal}/${WHOLESALE_MIN_ORDER_UNITS} unidades acumuladas (te faltan ${WHOLESALE_MIN_ORDER_UNITS - newTotal} para activar precio mayor).`,
      });
    }
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
            <div className="flex items-center justify-between">
              <p className="text-eyebrow text-primary">{product.brand?.name ?? "KICKPOINT"}</p>
              {product.base_sku && (
                <span className="font-mono text-xs text-muted-foreground">
                  SKU: {product.base_sku}
                </span>
              )}
            </div>
            <h1 className="text-display mt-1 text-3xl sm:text-4xl">{product.name}</h1>

            <div className="mt-4 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-bold text-primary">{money(retailPrice)}</span>
              {product.wholesale_price && (
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Tag className="size-3.5" /> Precio Mayorista: {moneyExact(wholesalePrice)}
                  <span className="font-normal text-[11px] text-muted-foreground">
                    (desde {product.wholesale_min_qty || WHOLESALE_MIN_ORDER_UNITS} uds. acumuladas)
                  </span>
                </div>
              )}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-sm">
              <span
                className={`size-2 rounded-full ${stock > 0 ? "bg-emerald-500" : "bg-destructive"}`}
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
                      onClick={() => handleColorChange(c)}
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
                  const disabled = (Number(v.stock) || 0) <= 0;
                  const active = variant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      disabled={disabled}
                      onClick={() => handleSizeChange(v.id)}
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
                    onClick={() => handleQtyChange(Math.max(1, qty - 1))}
                    className="flex size-12 items-center justify-center text-muted-foreground hover:text-primary"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-10 text-center text-lg font-bold">{qty}</span>
                  <button
                    aria-label="Aumentar"
                    onClick={() =>
                      handleQtyChange(
                        Math.min(Number(variant?.stock) > 0 ? Number(variant?.stock) : 99, qty + 1),
                      )
                    }
                    className="flex size-12 items-center justify-center text-muted-foreground hover:text-primary"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total normal:{" "}
                  <span className="font-bold text-foreground">{moneyExact(retailPrice * qty)}</span>
                  {product.wholesale_price && (
                    <span className="ml-2 font-bold text-amber-600 dark:text-amber-400">
                      (Mayor: {moneyExact(wholesalePrice * qty)})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Wholesale Information Box */}
            {product.wholesale_price && (
              <div className="surface-card mt-6 overflow-hidden border border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center justify-between border-b border-amber-500/20 px-4 py-2.5">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Tag className="size-3.5" /> Compra al Mayor Disponible
                  </span>
                  <Link
                    to="/mayor"
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Ver catálogo mayorista →
                  </Link>
                </div>
                <div className="p-3 text-xs text-muted-foreground space-y-1">
                  <p>
                    • Precio unitario al mayor:{" "}
                    <strong className="text-foreground">{moneyExact(wholesalePrice)}</strong>
                  </p>
                  <p>
                    • Regla: Mínimo <strong>8 unidades acumuladas</strong> en tu pedido mayorista
                    (puedes mezclar modelos y tallas).
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="hero"
                size="xl"
                className="flex-1"
                disabled={!variant || (Number(variant.stock) || 0) <= 0}
                onClick={handleAdd}
              >
                <ShoppingCart className="size-5" /> Agregar al Carrito
              </Button>

              {product.wholesale_price && (
                <Button
                  variant="outlineGlow"
                  size="xl"
                  disabled={!variant || (Number(variant.stock) || 0) <= 0}
                  onClick={handleAddWholesale}
                  className="border-amber-500/50 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold"
                >
                  <Tag className="size-5" /> Agregar al Pedido Mayor
                </Button>
              )}

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
