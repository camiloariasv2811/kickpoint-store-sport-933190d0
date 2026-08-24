import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { useCart, WHOLESALE_MIN_ORDER_UNITS } from "@/lib/cart";
import { money, moneyExact } from "@/lib/format";

export const Route = createFileRoute("/carrito")({
  head: () => ({
    meta: [
      { title: "Tu carrito | KICKPOINT" },
      {
        name: "description",
        content: "Revisa los productos de tu pedido KICKPOINT antes de continuar la compra.",
      },
      { property: "og:title", content: "Tu carrito | KICKPOINT" },
      { property: "og:description", content: "Revisa tu pedido KICKPOINT y continúa la compra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const {
    lines,
    count,
    subtotal,
    savings,
    getLineUnitPrice,
    setQuantity,
    removeLine,
    wholesaleLines,
    wholesaleCount,
    wholesaleSubtotal,
    wholesaleSavings,
    isWholesaleValid,
    wholesaleUnitsNeeded,
    setWholesaleQuantity,
    removeWholesaleLine,
  } = useCart();

  const [activeTab, setActiveTab] = useState<"retail" | "wholesale">(
    wholesaleLines.length > 0 && lines.length === 0 ? "wholesale" : "retail",
  );

  const isWholesaleTab = activeTab === "wholesale";
  const currentLines = isWholesaleTab ? wholesaleLines : lines;
  const currentCount = isWholesaleTab ? wholesaleCount : count;
  const currentSubtotal = isWholesaleTab ? wholesaleSubtotal : subtotal;
  const currentSavings = isWholesaleTab ? wholesaleSavings : savings;

  const progressPercent = Math.min(
    100,
    Math.round((wholesaleCount / WHOLESALE_MIN_ORDER_UNITS) * 100),
  );

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-eyebrow text-primary">Paso 1 de 4</p>
            <h1 className="text-display text-3xl sm:text-4xl">
              {isWholesaleTab ? "Carrito Mayorista" : "Tu Carrito"}
            </h1>
          </div>

          {/* Cart Type Selector Tabs */}
          <div className="inline-flex rounded-xl border border-border bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("retail")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "retail"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Carrito Minorista ({count})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("wholesale")}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "wholesale"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Tag className="size-3.5" />
              Carrito Mayorista ({wholesaleCount})
            </button>
          </div>
        </div>

        {/* Wholesale Progress Banner */}
        {isWholesaleTab && (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-extrabold text-amber-700 dark:text-amber-300">
                  <Tag className="size-3" /> REGLA MAYORISTA KICKPOINT
                </span>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  Compra mínima:{" "}
                  <strong className="text-primary font-extrabold">
                    {WHOLESALE_MIN_ORDER_UNITS} unidades acumuladas
                  </strong>{" "}
                  (puedes mezclar libremente productos, tallas y modelos).
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`inline-block rounded-md px-3 py-1 text-sm font-extrabold ${
                    isWholesaleValid
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/30 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  Unidades mayoristas: {wholesaleCount} / {WHOLESALE_MIN_ORDER_UNITS}{" "}
                  {isWholesaleValid && "✓"}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full transition-all duration-300 ${
                  isWholesaleValid ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              {isWholesaleValid ? (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="size-4" /> ¡Precio mayorista activado para todo tu
                  pedido!
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                  <AlertCircle className="size-4" /> Actualmente tienes {wholesaleCount} unidades.
                  Agrega {wholesaleUnitsNeeded} unidades más para continuar al checkout mayorista.
                </span>
              )}
            </p>
          </div>
        )}

        {currentLines.length === 0 ? (
          <div className="surface-card mt-8 flex flex-col items-center gap-4 p-14 text-center">
            <ShoppingBag className="size-12 text-muted-foreground opacity-40" />
            <h2 className="text-display text-2xl">
              {isWholesaleTab ? "Tu carrito mayorista está vacío" : "Tu carrito está vacío"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isWholesaleTab
                ? "Explora el catálogo mayorista y selecciona al menos 8 prendas combinadas."
                : "Explora el catálogo y agrega tus productos favoritos."}
            </p>
            <Button asChild variant="hero" size="lg">
              <Link to={isWholesaleTab ? "/mayor" : "/catalogo"}>
                {isWholesaleTab ? "Ver Catálogo Mayorista" : "Ver Catálogo"}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-3">
              {currentLines.map((line, idx) => {
                const linePrice = isWholesaleTab
                  ? isWholesaleValid && line.wholesalePrice != null
                    ? Number(line.wholesalePrice)
                    : Number(line.retailPrice || 0)
                  : getLineUnitPrice(line);

                const safeKey = `${line.productId}_${line.variantId}_${line.size}_${line.color || ""}_${idx}`;

                return (
                  <div key={safeKey} className="surface-card flex gap-4 p-4">
                    <Link
                      to="/producto/$slug"
                      params={{ slug: line.slug }}
                      className="size-24 shrink-0 overflow-hidden rounded-lg bg-surface-2"
                    >
                      {line.image && (
                        <img
                          src={line.image}
                          alt={line.name}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            to="/producto/$slug"
                            params={{ slug: line.slug }}
                            className="font-semibold hover:text-primary"
                          >
                            {line.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            Talla {line.size}
                            {line.color ? ` · ${line.color}` : ""}
                          </p>
                          {isWholesaleTab && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              <Tag className="size-2.5" /> Precio Mayorista
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label="Eliminar"
                          onClick={() =>
                            isWholesaleTab
                              ? removeWholesaleLine(line.variantId, line.productId)
                              : removeLine(line.variantId, line.productId)
                          }
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center rounded-lg border border-border">
                          <button
                            type="button"
                            aria-label="Disminuir"
                            onClick={() =>
                              isWholesaleTab
                                ? setWholesaleQuantity(
                                    line.variantId,
                                    line.quantity - 1,
                                    line.productId,
                                  )
                                : setQuantity(line.variantId, line.quantity - 1, line.productId)
                            }
                            className="flex size-10 items-center justify-center text-muted-foreground hover:text-primary"
                          >
                            <Minus className="size-4" />
                          </button>
                          <span className="w-8 text-center font-bold">{line.quantity}</span>
                          <button
                            type="button"
                            aria-label="Aumentar"
                            onClick={() =>
                              isWholesaleTab
                                ? setWholesaleQuantity(
                                    line.variantId,
                                    line.quantity + 1,
                                    line.productId,
                                  )
                                : setQuantity(line.variantId, line.quantity + 1, line.productId)
                            }
                            className="flex size-10 items-center justify-center text-muted-foreground hover:text-primary"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {money(linePrice)} c/u
                            {isWholesaleTab && (
                              <span className="ml-1 font-semibold text-primary">
                                · precio al mayor
                              </span>
                            )}
                          </p>
                          <p className="text-lg font-bold text-primary">
                            {moneyExact(linePrice * line.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <aside className="surface-card h-fit p-5 lg:sticky lg:top-24">
              <h2 className="text-display text-xl">
                {isWholesaleTab ? "Resumen Mayorista" : "Resumen"}
              </h2>
              <div className="mt-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs sm:text-sm">
                  <span className="text-xs sm:text-sm text-muted-foreground">Productos</span>
                  <span className="text-xs sm:text-sm font-semibold tabular-nums">
                    {currentCount} unidades
                  </span>
                </div>
                {currentSavings > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="text-xs sm:text-sm">Descuento al mayor</span>
                    <span className="text-xs sm:text-sm font-bold tabular-nums whitespace-nowrap">
                      -{moneyExact(currentSavings)}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border pt-3 text-sm sm:text-base font-bold">
                  <span className="text-sm sm:text-base text-foreground">Subtotal</span>
                  <span className="text-sm sm:text-base text-primary tabular-nums whitespace-nowrap">
                    {moneyExact(currentSubtotal)}
                  </span>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  El envío se calcula en el checkout según tu ciudad (TEALCA o MRW).
                </p>
              </div>

              {isWholesaleTab ? (
                <Button
                  asChild
                  variant={isWholesaleValid ? "hero" : "outline"}
                  size="xl"
                  className={`mt-5 w-full font-bold ${
                    isWholesaleValid
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "opacity-80"
                  }`}
                >
                  <Link
                    to="/checkout"
                    search={{ tipo: "mayorista" }}
                    disabled={!isWholesaleValid}
                    className={!isWholesaleValid ? "pointer-events-none cursor-not-allowed" : ""}
                  >
                    {isWholesaleValid ? (
                      <>
                        Continuar al Checkout Mayorista <ArrowRight className="size-5" />
                      </>
                    ) : (
                      `Faltan ${wholesaleUnitsNeeded} unidades (mín. ${WHOLESALE_MIN_ORDER_UNITS})`
                    )}
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="hero" size="xl" className="mt-5 w-full">
                  <Link to="/checkout" search={{ tipo: undefined }}>
                    Continuar al Checkout <ArrowRight className="size-5" />
                  </Link>
                </Button>
              )}

              <p className="mt-2 text-center text-[0.75rem] text-muted-foreground">
                Pagos en Bs (Pago Móvil / Transferencia), Zelle y USDT.
              </p>
              <Button asChild variant="ghost" size="sm" className="mt-2 w-full">
                <Link to={isWholesaleTab ? "/mayor" : "/catalogo"}>
                  {isWholesaleTab ? "Agregar más al pedido mayor" : "Seguir comprando"}
                </Link>
              </Button>
            </aside>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
