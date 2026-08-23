import { Link } from "@tanstack/react-router";
import { Check, Minus, Package, Plus, ShoppingCart, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCart, WHOLESALE_MIN_ORDER_UNITS } from "@/lib/cart";
import { money, moneyExact } from "@/lib/format";
import { totalStock, type Product } from "@/lib/types";

interface WholesaleProductCardProps {
  product: Product;
}

export function WholesaleProductCard({ product }: WholesaleProductCardProps) {
  const { addWholesaleLine, wholesaleCount } = useCart();
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const stock = totalStock(product);

  const colors = useMemo(
    () => Array.from(new Set(variants.map((v) => v.color).filter(Boolean))) as string[],
    [variants],
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(colors[0] ?? null);

  const availableSizes = useMemo(
    () => variants.filter((v) => (selectedColor ? v.color === selectedColor : true)),
    [variants, selectedColor],
  );

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    availableSizes.find((v) => (Number(v.stock) || 0) > 0)?.id ?? availableSizes[0]?.id ?? null,
  );
  const [qty, setQty] = useState(1);

  const activeVariant =
    variants.find((v) => v.id === selectedVariantId) ??
    availableSizes.find((v) => (Number(v.stock) || 0) > 0) ??
    availableSizes[0] ??
    variants[0] ??
    null;

  const retailPrice = Number(product.retail_price || 0);
  const wholesalePrice = product.wholesale_price ? Number(product.wholesale_price) : retailPrice;
  const unitSavings = Math.max(0, retailPrice - wholesalePrice);

  function handleColorSelect(c: string) {
    console.log("[PRODUCT_SELECT_03] COLOR SELECTED (Wholesale Card)", c);
    setSelectedColor(c);
    const inThisColor = variants.filter((v) => v.color === c);
    const next = inThisColor.find((v) => (Number(v.stock) || 0) > 0) ?? inThisColor[0] ?? null;
    setSelectedVariantId(next?.id ?? null);
  }

  function handleSizeSelect(varId: string) {
    const selectedVar = variants.find((v) => v.id === varId);
    console.log("[PRODUCT_SELECT_04] SIZE SELECTED (Wholesale Card)", selectedVar?.size, varId);
    setSelectedVariantId(varId);
    setQty(1);
  }

  function handleQtyChange(newQty: number) {
    console.log("[PRODUCT_SELECT_05] QUANTITY CHANGED (Wholesale Card)", newQty);
    setQty(newQty);
  }

  function handleAddToWholesale() {
    console.log("[PRODUCT_SELECT_06] ADD TO CART START (Wholesale Card)");
    if (!activeVariant) {
      toast.error("Selecciona una talla para continuar");
      return;
    }
    const safeStock = Number(activeVariant.stock) || 0;
    if (safeStock <= 0) {
      toast.error("Esta talla se encuentra agotada");
      return;
    }

    const safeQty = Math.max(1, Math.min(qty, safeStock));

    addWholesaleLine({
      variantId: activeVariant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images?.[0] ?? null,
      size: activeVariant.size,
      color: activeVariant.color,
      retailPrice,
      wholesalePrice,
      wholesaleMinQty: product.wholesale_min_qty || WHOLESALE_MIN_ORDER_UNITS,
      stock: safeStock,
      quantity: safeQty,
    });

    console.log("[PRODUCT_SELECT_10] SUCCESS (Wholesale Card)");
    const newTotal = wholesaleCount + safeQty;
    if (newTotal >= WHOLESALE_MIN_ORDER_UNITS) {
      toast.success("¡Agregado al pedido mayorista!", {
        description: `${product.name} (Talla ${activeVariant.size} × ${safeQty}). Total mayorista: ${newTotal}/${WHOLESALE_MIN_ORDER_UNITS} unidades (¡Precio mayorista activado!).`,
      });
    } else {
      toast.info("Agregado al pedido mayorista", {
        description: `${product.name} (Talla ${activeVariant.size} × ${safeQty}). Llevas ${newTotal}/${WHOLESALE_MIN_ORDER_UNITS} unidades (te faltan ${WHOLESALE_MIN_ORDER_UNITS - newTotal} para activar precio mayor).`,
      });
    }
  }

  return (
    <div className="surface-card group flex flex-col justify-between overflow-hidden border border-border/80 transition-all hover:border-primary/50 hover:shadow-lg">
      <div>
        {/* Image Container with Wholesale Tag */}
        <div className="relative aspect-square overflow-hidden bg-surface-2">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Package className="size-10 opacity-40" />
            </div>
          )}

          {/* Wholesale Badge Overlay */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/90 px-2 py-1 text-[11px] font-extrabold text-white shadow-sm backdrop-blur-xs">
              <Tag className="size-3" /> PRECIO MAYORISTA
            </span>
            {unitSavings > 0 && (
              <span className="inline-flex items-center rounded-md bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                Ahorras {moneyExact(unitSavings)}/und
              </span>
            )}
          </div>

          {/* Stock Indicator */}
          <div className="absolute top-2 right-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold backdrop-blur-xs ${
                stock > 0 ? "bg-black/70 text-emerald-400" : "bg-destructive/90 text-white"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${stock > 0 ? "bg-emerald-400" : "bg-white"}`}
              />
              {stock > 0 ? `${stock} en stock` : "Agotado"}
            </span>
          </div>
        </div>

        {/* Product Details */}
        <div className="p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-primary">
              {product.brand?.name ?? "KICKPOINT"}
            </span>
            {product.base_sku && (
              <span className="font-mono text-[10px] text-muted-foreground/80">
                SKU: {product.base_sku}
              </span>
            )}
          </div>

          <Link
            to="/producto/$slug"
            params={{ slug: product.slug }}
            className="mt-1 line-clamp-2 text-sm font-bold text-foreground hover:text-primary transition-colors"
            title={product.name}
          >
            {product.name}
          </Link>

          {/* Price Grid */}
          <div className="mt-3 rounded-lg border border-border/60 bg-surface-2/60 p-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-muted-foreground">Precio normal:</span>
              <span className="text-xs text-muted-foreground line-through decoration-destructive/60">
                {moneyExact(retailPrice)}
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between border-t border-border/40 pt-1">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Tag className="size-3" /> Mayorista:
              </span>
              <span className="text-base font-extrabold text-primary">
                {moneyExact(wholesalePrice)}
              </span>
            </div>
          </div>

          {/* Color Switcher if multiple */}
          {colors.length > 1 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Color</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColorSelect(c)}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      selectedColor === c
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-surface-2 text-muted-foreground hover:bg-surface-3"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size Selector */}
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Talla</p>
              {activeVariant && (
                <span className="text-[10px] text-muted-foreground">
                  Stock:{" "}
                  <span className="font-semibold text-foreground">{activeVariant.stock}</span>
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {availableSizes.map((v) => {
                const isSelected = activeVariant?.id === v.id;
                const isOut = (Number(v.stock) || 0) <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={isOut}
                    onClick={() => handleSizeSelect(v.id)}
                    className={`min-w-8 rounded-md border px-2 py-1 text-xs font-bold transition-all ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : isOut
                          ? "cursor-not-allowed border-border/40 bg-surface-2/40 text-muted-foreground/40 line-through"
                          : "border-border bg-surface-2 text-foreground hover:border-primary/60 hover:bg-surface-3"
                    }`}
                  >
                    {v.size}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="border-t border-border/80 p-4 pt-3">
        <div className="flex items-center gap-2">
          {/* Quantity Controls */}
          <div className="flex items-center rounded-lg border border-border bg-surface-2">
            <button
              type="button"
              aria-label="Disminuir cantidad"
              disabled={!activeVariant || (Number(activeVariant.stock) || 0) <= 0}
              onClick={() => handleQtyChange(Math.max(1, qty - 1))}
              className="flex size-8 items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-40"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-6 text-center text-xs font-bold text-foreground">{qty}</span>
            <button
              type="button"
              aria-label="Aumentar cantidad"
              disabled={!activeVariant || (Number(activeVariant.stock) || 0) <= 0}
              onClick={() => {
                const maxStock = Number(activeVariant?.stock) || 0;
                handleQtyChange(maxStock > 0 ? Math.min(maxStock, qty + 1) : 1);
              }}
              className="flex size-8 items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-40"
            >
              <Plus className="size-3.5" />
            </button>
          </div>

          {/* Add Button */}
          <Button
            type="button"
            variant="hero"
            size="sm"
            disabled={!activeVariant || (Number(activeVariant.stock) || 0) <= 0}
            onClick={handleAddToWholesale}
            className="flex-1 gap-1.5 text-xs font-bold"
          >
            <ShoppingCart className="size-3.5" />
            Agregar al Mayor
          </Button>
        </div>
      </div>
    </div>
  );
}
