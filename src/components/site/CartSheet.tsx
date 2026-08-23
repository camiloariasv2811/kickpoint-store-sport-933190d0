import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Minus, Plus, ShoppingBag, Tag, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart, WHOLESALE_MIN_ORDER_UNITS } from "@/lib/cart";
import { money, moneyExact } from "@/lib/format";

export function CartSheet({ children }: { children: React.ReactNode }) {
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
  const currentSubtotal = isWholesaleTab ? wholesaleSubtotal : subtotal;
  const currentSavings = isWholesaleTab ? wholesaleSavings : savings;

  const progressPercent = Math.min(
    100,
    Math.round((wholesaleCount / WHOLESALE_MIN_ORDER_UNITS) * 100),
  );

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 bg-background p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-display text-xl">Tu Carrito</SheetTitle>
          <SheetDescription className="text-xs">
            Revisa tus productos y continúa al checkout seguro.
          </SheetDescription>

          {/* Cart Type Selector Tabs */}
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("retail")}
              className={`rounded-md py-1.5 text-xs font-bold transition-all ${
                activeTab === "retail"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Minorista ({count})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("wholesale")}
              className={`flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-bold transition-all ${
                activeTab === "wholesale"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Tag className="size-3" />
              Mayorista ({wholesaleCount})
            </button>
          </div>
        </SheetHeader>

        {/* Wholesale 8-Unit Progress Tracker in Wholesale Mode */}
        {isWholesaleTab && (
          <div className="border-b border-border bg-surface-2/70 px-5 py-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1 text-foreground">
                <Tag className="size-3.5 text-amber-500" />
                COMPRA MAYORISTA
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold ${
                  isWholesaleValid
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                }`}
              >
                {wholesaleCount} / {WHOLESALE_MIN_ORDER_UNITS} unidades
              </span>
            </div>

            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className={`h-full transition-all duration-300 ${
                  isWholesaleValid ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {isWholesaleValid ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> ¡Precio mayorista activado para todo tu
                  pedido!
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-3" /> Te faltan{" "}
                  <strong>{wholesaleUnitsNeeded} unidades</strong> para activar precio mayor (mín.{" "}
                  {WHOLESALE_MIN_ORDER_UNITS}).
                </span>
              )}
            </p>
          </div>
        )}

        {/* Cart Item Lines */}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {currentLines.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <ShoppingBag className="size-10 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">
                {isWholesaleTab
                  ? "Aún no has agregado productos al carrito mayorista."
                  : "Todavía no has agregado productos a tu carrito."}
              </p>
              <Button asChild variant="hero">
                <Link to={isWholesaleTab ? "/mayor" : "/catalogo"}>
                  {isWholesaleTab ? "Ver Catálogo Mayorista" : "Ver Catálogo"}
                </Link>
              </Button>
            </div>
          )}

          {currentLines.map((line, idx) => {
            const lineUnitPrice = isWholesaleTab
              ? isWholesaleValid && line.wholesalePrice != null
                ? Number(line.wholesalePrice)
                : Number(line.retailPrice || 0)
              : getLineUnitPrice(line);

            const safeKey = `${line.productId}_${line.variantId}_${line.size}_${line.color || ""}_${idx}`;

            return (
              <div key={safeKey} className="surface-card flex gap-3 p-3">
                <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  {line.image && (
                    <img
                      src={line.image}
                      alt={line.name}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Talla {line.size}
                    {line.color ? ` · ${line.color}` : ""}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 rounded-lg border border-border">
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
                        className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{line.quantity}</span>
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
                        className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">
                        {moneyExact(lineUnitPrice * line.quantity)}
                      </p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        {money(lineUnitPrice)} c/u {isWholesaleTab && "· mayor"}
                      </p>
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
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer & Checkout Action */}
        {currentLines.length > 0 && (
          <SheetFooter className="gap-3 border-t border-border px-5 py-4">
            <div className="w-full space-y-2">
              {currentSavings > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="text-xs sm:text-sm">Descuento al mayor</span>
                  <span className="text-xs sm:text-sm font-bold tabular-nums whitespace-nowrap">
                    -{moneyExact(currentSavings)}
                  </span>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border/60 pt-2 text-xs sm:text-sm font-bold">
                <span className="text-xs sm:text-sm text-foreground">Subtotal</span>
                <span className="text-xs sm:text-sm text-primary tabular-nums whitespace-nowrap">
                  {moneyExact(currentSubtotal)}
                </span>
              </div>
            </div>

            {isWholesaleTab ? (
              <Button
                asChild
                variant={isWholesaleValid ? "hero" : "outline"}
                size="lg"
                className={`w-full font-bold ${
                  isWholesaleValid ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "opacity-80"
                }`}
              >
                <Link
                  to="/checkout"
                  search={{ tipo: "mayorista" }}
                  disabled={!isWholesaleValid}
                  className={!isWholesaleValid ? "pointer-events-none cursor-not-allowed" : ""}
                >
                  {isWholesaleValid
                    ? "Continuar al Checkout Mayorista"
                    : `Faltan ${wholesaleUnitsNeeded} unidades (mín. ${WHOLESALE_MIN_ORDER_UNITS})`}
                </Link>
              </Button>
            ) : (
              <Button asChild variant="hero" size="lg" className="w-full">
                <Link to="/carrito">Continuar compra</Link>
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
