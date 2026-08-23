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

type CartContextValue = {
  // Retail cart
  lines: CartLine[];
  count: number;
  subtotal: number;
  savings: number;
  isWholesale: boolean;
  getLineUnitPrice: (line: CartLine) => number;
  addLine: (line: CartLine) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeLine: (variantId: string) => void;
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
  setWholesaleQuantity: (variantId: string, quantity: number) => void;
  removeWholesaleLine: (variantId: string) => void;
  clearWholesale: () => void;

  // Active view
  activeCartType: CartType;
  setActiveCartType: (type: CartType) => void;
};

const RETAIL_STORAGE_KEY = "kickpoint.cart.v1";
const WHOLESALE_STORAGE_KEY = "kickpoint.cart.wholesale.v1";
const CartContext = createContext<CartContextValue | null>(null);

export function unitPrice(line: CartLine, totalUnits?: number) {
  const effectiveUnits = typeof totalUnits === "number" ? totalUnits : line.quantity;
  const minQty = line.wholesaleMinQty || WHOLESALE_MIN_ORDER_UNITS;
  if (line.wholesalePrice && effectiveUnits >= minQty) return Number(line.wholesalePrice);
  return Number(line.retailPrice);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wholesaleLines, setWholesaleLines] = useState<CartLine[]>([]);
  const [activeCartType, setActiveCartType] = useState<CartType>("retail");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const rawRetail = localStorage.getItem(RETAIL_STORAGE_KEY);
      if (rawRetail) setLines(JSON.parse(rawRetail) as CartLine[]);

      const rawWholesale = localStorage.getItem(WHOLESALE_STORAGE_KEY);
      if (rawWholesale) setWholesaleLines(JSON.parse(rawWholesale) as CartLine[]);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(RETAIL_STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(WHOLESALE_STORAGE_KEY, JSON.stringify(wholesaleLines));
  }, [wholesaleLines, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    // Retail Calculations
    const retailTotalCount = lines.reduce((sum, l) => sum + l.quantity, 0);
    const retailSubtotal = lines.reduce(
      (sum, l) => sum + unitPrice(l, retailTotalCount) * l.quantity,
      0,
    );
    const retailTotalAtRetail = lines.reduce(
      (sum, l) => sum + Number(l.retailPrice) * l.quantity,
      0,
    );
    const isWholesale = lines.some(
      (l) =>
        l.wholesalePrice && retailTotalCount >= (l.wholesaleMinQty || WHOLESALE_MIN_ORDER_UNITS),
    );

    // Wholesale Calculations
    const wholesaleCount = wholesaleLines.reduce((sum, l) => sum + l.quantity, 0);
    const wholesaleSubtotal = wholesaleLines.reduce(
      (sum, l) => sum + Number(l.wholesalePrice ?? l.retailPrice) * l.quantity,
      0,
    );
    const wholesaleRetailEquivalent = wholesaleLines.reduce(
      (sum, l) => sum + Number(l.retailPrice) * l.quantity,
      0,
    );
    const isWholesaleValid = wholesaleCount >= WHOLESALE_MIN_ORDER_UNITS;
    const wholesaleUnitsNeeded = Math.max(0, WHOLESALE_MIN_ORDER_UNITS - wholesaleCount);

    return {
      // Retail
      lines,
      count: retailTotalCount,
      subtotal: retailSubtotal,
      savings: Math.max(0, retailTotalAtRetail - retailSubtotal),
      isWholesale,
      getLineUnitPrice: (line: CartLine) => unitPrice(line, retailTotalCount),
      addLine: (line) =>
        setLines((prev) => {
          const existing = prev.find((l) => l.variantId === line.variantId);
          if (!existing) return [...prev, line];
          return prev.map((l) =>
            l.variantId === line.variantId
              ? { ...l, quantity: Math.min(l.stock, l.quantity + line.quantity) }
              : l,
          );
        }),
      setQuantity: (variantId, quantity) =>
        setLines((prev) =>
          prev
            .map((l) =>
              l.variantId === variantId
                ? { ...l, quantity: Math.max(0, Math.min(l.stock, quantity)) }
                : l,
            )
            .filter((l) => l.quantity > 0),
        ),
      removeLine: (variantId) => setLines((prev) => prev.filter((l) => l.variantId !== variantId)),
      clear: () => setLines([]),

      // Wholesale
      wholesaleLines,
      wholesaleCount,
      wholesaleSubtotal,
      wholesaleRetailEquivalent,
      wholesaleSavings: Math.max(0, wholesaleRetailEquivalent - wholesaleSubtotal),
      isWholesaleValid,
      wholesaleUnitsNeeded,
      addWholesaleLine: (line) =>
        setWholesaleLines((prev) => {
          const existing = prev.find((l) => l.variantId === line.variantId);
          if (!existing) return [...prev, line];
          return prev.map((l) =>
            l.variantId === line.variantId
              ? { ...l, quantity: Math.min(l.stock, l.quantity + line.quantity) }
              : l,
          );
        }),
      setWholesaleQuantity: (variantId, quantity) =>
        setWholesaleLines((prev) =>
          prev
            .map((l) =>
              l.variantId === variantId
                ? { ...l, quantity: Math.max(0, Math.min(l.stock, quantity)) }
                : l,
            )
            .filter((l) => l.quantity > 0),
        ),
      removeWholesaleLine: (variantId) =>
        setWholesaleLines((prev) => prev.filter((l) => l.variantId !== variantId)),
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
