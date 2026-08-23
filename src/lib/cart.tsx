import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const WHOLESALE_MIN_ORDER_UNITS = 8;

export type CartLine = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  size: string;
  color: string | null;
  retailPrice: number;
  wholesalePrice: number | null;
  wholesaleMinQty?: number;
  stock: number;
  quantity: number;
};

export type CartType = "retail" | "wholesale";

export function getCartLineKey(line: {
  productId?: string | null;
  variantId: string;
  size?: string | null;
  color?: string | null;
}): string {
  return `${line.productId || "p"}_${line.variantId}_${line.size || ""}_${line.color || ""}`;
}

type CartContextValue = {
  // Retail cart
  lines: CartLine[];
  count: number;
  subtotal: number;
  savings: number;
  isWholesale: boolean;
  getLineUnitPrice: (line: CartLine) => number;
  addLine: (line: CartLine) => void;
  setQuantity: (variantId: string, quantity: number, productId?: string) => void;
  removeLine: (variantId: string, productId?: string) => void;
  clear: () => void;

  // Wholesale cart
  wholesaleLines: CartLine[];
  wholesaleCount: number;
  wholesaleSubtotal: number;
  wholesaleRetailEquivalent: number;
  wholesaleSavings: number;
  isWholesaleValid: boolean;
  wholesaleUnitsNeeded: number;
  addWholesaleLine: (line: CartLine) => void;
  setWholesaleQuantity: (variantId: string, quantity: number, productId?: string) => void;
  removeWholesaleLine: (variantId: string, productId?: string) => void;
  clearWholesale: () => void;

  // Active view
  activeCartType: CartType;
  setActiveCartType: (type: CartType) => void;
};

const RETAIL_STORAGE_KEY = "kickpoint.cart.v1";
const WHOLESALE_STORAGE_KEY = "kickpoint.cart.wholesale.v1";
const CartContext = createContext<CartContextValue | null>(null);

export function unitPrice(line: CartLine, _totalUnits?: number) {
  return Number(line?.retailPrice || 0);
}

export function wholesaleUnitPrice(line: CartLine, wholesaleCount: number) {
  if (!line) return 0;
  if (wholesaleCount >= WHOLESALE_MIN_ORDER_UNITS && line.wholesalePrice != null) {
    return Number(line.wholesalePrice);
  }
  return Number(line.retailPrice || 0);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wholesaleLines, setWholesaleLines] = useState<CartLine[]>([]);
  const [activeCartType, setActiveCartType] = useState<CartType>("retail");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const rawRetail = localStorage.getItem(RETAIL_STORAGE_KEY);
      if (rawRetail) {
        const parsed = JSON.parse(rawRetail);
        if (Array.isArray(parsed)) {
          const sanitized = parsed
            .filter(
              (l): l is CartLine =>
                Boolean(l) &&
                typeof l === "object" &&
                typeof l.variantId === "string" &&
                typeof l.productId === "string" &&
                typeof l.quantity === "number" &&
                !isNaN(l.quantity) &&
                l.quantity > 0,
            )
            .map((l) => ({
              ...l,
              quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
              stock: Math.max(1, Number(l.stock) || 99),
              retailPrice: Math.max(0, Number(l.retailPrice) || 0),
              wholesalePrice:
                l.wholesalePrice != null ? Math.max(0, Number(l.wholesalePrice) || 0) : null,
            }));
          setLines(sanitized);
        } else {
          localStorage.removeItem(RETAIL_STORAGE_KEY);
        }
      }
    } catch (err) {
      console.warn("[CartProvider] Error reading retail cart from localStorage:", err);
      try {
        localStorage.removeItem(RETAIL_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }

    try {
      const rawWholesale = localStorage.getItem(WHOLESALE_STORAGE_KEY);
      if (rawWholesale) {
        const parsed = JSON.parse(rawWholesale);
        if (Array.isArray(parsed)) {
          const sanitized = parsed
            .filter(
              (l): l is CartLine =>
                Boolean(l) &&
                typeof l === "object" &&
                typeof l.variantId === "string" &&
                typeof l.productId === "string" &&
                typeof l.quantity === "number" &&
                !isNaN(l.quantity) &&
                l.quantity > 0,
            )
            .map((l) => ({
              ...l,
              quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
              stock: Math.max(1, Number(l.stock) || 99),
              retailPrice: Math.max(0, Number(l.retailPrice) || 0),
              wholesalePrice:
                l.wholesalePrice != null
                  ? Math.max(0, Number(l.wholesalePrice) || 0)
                  : Math.max(0, Number(l.retailPrice) || 0),
            }));
          setWholesaleLines(sanitized);
        } else {
          localStorage.removeItem(WHOLESALE_STORAGE_KEY);
        }
      }
    } catch (err) {
      console.warn("[CartProvider] Error reading wholesale cart from localStorage:", err);
      try {
        localStorage.removeItem(WHOLESALE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(RETAIL_STORAGE_KEY, JSON.stringify(lines));
    } catch (err) {
      console.warn("[CartProvider] Error saving retail cart:", err);
    }
  }, [lines, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(WHOLESALE_STORAGE_KEY, JSON.stringify(wholesaleLines));
    } catch (err) {
      console.warn("[CartProvider] Error saving wholesale cart:", err);
    }
  }, [wholesaleLines, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    // Retail Calculations (Always standard retail price per item)
    const retailTotalCount = lines.reduce((sum, l) => sum + (Number(l?.quantity) || 0), 0);
    const retailSubtotal = lines.reduce(
      (sum, l) => sum + (Number(l?.retailPrice) || 0) * (Number(l?.quantity) || 0),
      0,
    );

    // Wholesale Calculations (Wholesale price active only when wholesaleCount >= 8 across all lines)
    const wholesaleCount = wholesaleLines.reduce((sum, l) => sum + (Number(l?.quantity) || 0), 0);
    const isWholesaleValid = wholesaleCount >= WHOLESALE_MIN_ORDER_UNITS;

    const wholesaleSubtotal = wholesaleLines.reduce((sum, l) => {
      const unitCost = isWholesaleValid
        ? Number(l?.wholesalePrice ?? l?.retailPrice ?? 0)
        : Number(l?.retailPrice ?? 0);
      const qty = Number(l?.quantity) || 0;
      return sum + unitCost * qty;
    }, 0);

    const wholesaleRetailEquivalent = wholesaleLines.reduce((sum, l) => {
      const normalPrice = Number(l?.retailPrice ?? 0);
      const qty = Number(l?.quantity) || 0;
      return sum + normalPrice * qty;
    }, 0);

    const wholesaleUnitsNeeded = Math.max(0, WHOLESALE_MIN_ORDER_UNITS - wholesaleCount);
    const wholesaleSavings = isWholesaleValid
      ? Math.max(0, wholesaleRetailEquivalent - wholesaleSubtotal)
      : 0;

    return {
      // Retail
      lines,
      count: retailTotalCount,
      subtotal: retailSubtotal,
      savings: 0,
      isWholesale: false,
      getLineUnitPrice: (line: CartLine) => Number(line?.retailPrice || 0),
      addLine: (line) => {
        if (!line || !line.variantId || !line.productId) {
          console.warn("[CartProvider] Rejected invalid cart line:", line);
          return;
        }
        const safeStock = Math.max(1, Number(line.stock) || 99);
        const safeQty = Math.max(1, Math.min(safeStock, Math.floor(Number(line.quantity) || 1)));
        const safeRetail = Math.max(0, Number(line.retailPrice) || 0);
        const safeWholesale =
          line.wholesalePrice !== null && line.wholesalePrice !== undefined
            ? Math.max(0, Number(line.wholesalePrice) || 0)
            : null;

        const sanitizedLine: CartLine = {
          ...line,
          quantity: safeQty,
          stock: safeStock,
          retailPrice: safeRetail,
          wholesalePrice: safeWholesale,
        };

        setLines((prev) => {
          const existingIndex = prev.findIndex(
            (l) =>
              l.variantId === sanitizedLine.variantId && l.productId === sanitizedLine.productId,
          );
          if (existingIndex === -1) {
            return [...prev, sanitizedLine];
          }
          return prev.map((l, idx) =>
            idx === existingIndex
              ? {
                  ...l,
                  quantity: Math.min(safeStock, (Number(l.quantity) || 0) + sanitizedLine.quantity),
                }
              : l,
          );
        });
      },
      setQuantity: (variantId, quantity, productId) =>
        setLines((prev) =>
          prev
            .map((l) => {
              const matches = productId
                ? l.variantId === variantId && l.productId === productId
                : l.variantId === variantId;
              return matches
                ? { ...l, quantity: Math.max(0, Math.min(Number(l.stock) || 99, quantity)) }
                : l;
            })
            .filter((l) => (Number(l.quantity) || 0) > 0),
        ),
      removeLine: (variantId, productId) =>
        setLines((prev) =>
          prev.filter((l) =>
            productId
              ? !(l.variantId === variantId && l.productId === productId)
              : l.variantId !== variantId,
          ),
        ),
      clear: () => setLines([]),

      // Wholesale
      wholesaleLines,
      wholesaleCount,
      wholesaleSubtotal,
      wholesaleRetailEquivalent,
      wholesaleSavings,
      isWholesaleValid,
      wholesaleUnitsNeeded,
      addWholesaleLine: (line) => {
        if (!line || !line.variantId || !line.productId) {
          console.warn("[CartProvider] Rejected invalid wholesale line:", line);
          return;
        }
        const safeStock = Math.max(1, Number(line.stock) || 99);
        const safeQty = Math.max(1, Math.min(safeStock, Math.floor(Number(line.quantity) || 1)));
        const safeRetail = Math.max(0, Number(line.retailPrice) || 0);
        const safeWholesale =
          line.wholesalePrice !== null && line.wholesalePrice !== undefined
            ? Math.max(0, Number(line.wholesalePrice) || 0)
            : safeRetail;

        const sanitizedLine: CartLine = {
          ...line,
          quantity: safeQty,
          stock: safeStock,
          retailPrice: safeRetail,
          wholesalePrice: safeWholesale,
        };

        setWholesaleLines((prev) => {
          const existingIndex = prev.findIndex(
            (l) =>
              l.variantId === sanitizedLine.variantId && l.productId === sanitizedLine.productId,
          );
          if (existingIndex === -1) {
            return [...prev, sanitizedLine];
          }
          return prev.map((l, idx) =>
            idx === existingIndex
              ? {
                  ...l,
                  quantity: Math.min(safeStock, (Number(l.quantity) || 0) + sanitizedLine.quantity),
                }
              : l,
          );
        });
      },
      setWholesaleQuantity: (variantId, quantity, productId) =>
        setWholesaleLines((prev) =>
          prev
            .map((l) => {
              const matches = productId
                ? l.variantId === variantId && l.productId === productId
                : l.variantId === variantId;
              return matches
                ? { ...l, quantity: Math.max(0, Math.min(Number(l.stock) || 99, quantity)) }
                : l;
            })
            .filter((l) => (Number(l.quantity) || 0) > 0),
        ),
      removeWholesaleLine: (variantId, productId) =>
        setWholesaleLines((prev) =>
          prev.filter((l) =>
            productId
              ? !(l.variantId === variantId && l.productId === productId)
              : l.variantId !== variantId,
          ),
        ),
      clearWholesale: () => setWholesaleLines([]),

      activeCartType,
      setActiveCartType,
    };
  }, [lines, wholesaleLines, activeCartType]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
