import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ShoppingBag,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  Receipt,
  Printer,
  History,
  CreditCard,
  Banknote,
  DollarSign,
  User,
  Loader2,
  Package,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { listAdminProducts } from "@/lib/products.functions";
import { listCustomers } from "@/lib/customers.functions";
import {
  listSales,
  createSale,
  deleteSale,
  type AdminSale,
  type SaleItemInput,
} from "@/lib/sales.functions";
import { moneyExact } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/ventas")({
  component: AdminVentas,
});

type CartItem = {
  productId: string;
  variantId: string;
  productName: string;
  size: string;
  color: string | null;
  unitPrice: number;
  unitCost: number;
  quantity: number;
  availableStock: number;
};

function AdminVentas() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");

  // POS State
  const [searchProd, setSearchProd] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("Cliente Mostrador");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [pricingMode, setPricingMode] = useState<"detal" | "mayor">("detal");
  const [processing, setProcessing] = useState(false);

  // Success Ticket Modal
  const [completedSale, setCompletedSale] = useState<{
    saleNumber: string;
    total: number;
    items: CartItem[];
    customer: string;
    method: string;
  } | null>(null);

  // History Detail
  const [selectedHistorySale, setSelectedHistorySale] = useState<AdminSale | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [deletingSale, setDeletingSale] = useState(false);

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["admin", "products", "all"],
    queryFn: async () => {
      try {
        const res = await listAdminProducts({ data: { pageSize: 500 } });
        if (Array.isArray(res)) return res;
        return res?.items ?? [];
      } catch (err) {
        console.warn("[AdminVentas] Error loading products:", err);
        return [];
      }
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: async () => {
      try {
        const res = await listCustomers();
        return res ?? [];
      } catch (err) {
        console.warn("[AdminVentas] Error loading customers:", err);
        return [];
      }
    },
  });

  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ["admin", "sales"],
    queryFn: async () => {
      try {
        const res = await listSales();
        return res ?? [];
      } catch (err) {
        console.warn("[AdminVentas] Error loading sales:", err);
        return [];
      }
    },
  });

  async function handleDeleteSale(sale: AdminSale) {
    if (
      !window.confirm(
        `¿Deseas eliminar permanentemente la venta ${sale.sale_number}? El inventario de los productos vendidos será devuelto automáticamente al stock.`,
      )
    ) {
      return;
    }
    setDeletingSale(true);
    try {
      await deleteSale({ data: { saleId: sale.id, restoreStock: true } });
      toast.success(`Venta ${sale.sale_number} eliminada y stock restituido`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "sales"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "products"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "kardex-all"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "pending-badges"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
      setSelectedHistorySale(null);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setDeletingSale(false);
    }
  }

  // Filter available active products
  const filteredProducts = products.filter((p: any) => {
    if (!p.active) return false;
    const matchName = p.name.toLowerCase().includes(searchProd.toLowerCase());
    const matchSku = p.base_sku?.toLowerCase().includes(searchProd.toLowerCase());
    return matchName || matchSku;
  });

  function addToCart(product: any, variant: any) {
    const existingIndex = cart.findIndex((i) => i.variantId === variant.id);
    const unitPrice =
      pricingMode === "mayor" && product.wholesale_price
        ? Number(product.wholesale_price)
        : Number(product.retail_price);

    if (existingIndex >= 0) {
      const current = cart[existingIndex];
      if (current.quantity >= variant.stock) {
        toast.error(`Stock máximo disponible alcanzado (${variant.stock})`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex] = { ...current, quantity: current.quantity + 1 };
      setCart(updated);
    } else {
      if (variant.stock <= 0) {
        toast.error("Variante sin stock disponible");
        return;
      }
      setCart([
        ...cart,
        {
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          size: variant.size,
          color: variant.color,
          unitPrice,
          unitCost: Number(product.cost || 0),
          quantity: 1,
          availableStock: Number(variant.stock || 0),
        },
      ]);
    }
  }

  function updateQuantity(idx: number, qty: number) {
    if (qty <= 0) {
      setCart(cart.filter((_, i) => i !== idx));
      return;
    }
    const item = cart[idx];
    if (qty > item.availableStock) {
      toast.error(`Solo hay ${item.availableStock} unidades disponibles`);
      return;
    }
    const updated = [...cart];
    updated[idx] = { ...item, quantity: qty };
    setCart(updated);
  }

  function updateItemPrice(idx: number, newPrice: number) {
    const updated = [...cart];
    updated[idx] = { ...updated[idx], unitPrice: Math.max(0, newPrice) };
    setCart(updated);
  }

  const subtotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  async function handleCompleteSale() {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    setProcessing(true);
    try {
      const items: SaleItemInput[] = cart.map((i) => ({
        product_id: i.productId,
        variant_id: i.variantId,
        product_name: i.productName,
        size: i.size,
        color: i.color,
        unit_price: i.unitPrice,
        unit_cost: i.unitCost,
        quantity: i.quantity,
      }));

      const result = await createSale({
        data: {
          customer_id: selectedCustomerId || null,
          customer_name: customerName,
          payment_method_code: paymentMethod,
          channel: "presencial",
          items,
        },
      });

      setCompletedSale({
        saleNumber: result.sale_number,
        total: result.total,
        items: [...cart],
        customer: customerName,
        method: paymentMethod,
      });

      toast.success("¡Venta registrada exitosamente!", {
        description: `Ticket ${result.sale_number} generado.`,
      });

      setCart([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "sales"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "products"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "kardex-all"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "pending-badges"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al registrar venta: ${err.message || "Error desconocido"}`);
    } finally {
      setProcessing(false);
    }
  }

  const filteredHistory = sales.filter((s) => {
    const matchNo = s.sale_number.toLowerCase().includes(historySearch.toLowerCase());
    const matchCust =
      s.customer?.first_name &&
      s.customer.first_name.toLowerCase().includes(historySearch.toLowerCase());
    return matchNo || matchCust;
  });

  return (
    <AdminShell
      title="Ventas y Caja POS"
      subtitle="Registro rápido de ventas presenciales, tickets y consolidado de ventas"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "pos" ? "hero" : "outline"}
            onClick={() => setActiveTab("pos")}
            className="h-9 gap-1.5 text-xs"
          >
            <ShoppingBag className="size-4" /> Terminal POS
          </Button>
          <Button
            variant={activeTab === "history" ? "hero" : "outline"}
            onClick={() => setActiveTab("history")}
            className="h-9 gap-1.5 text-xs"
          >
            <History className="size-4" /> Historial de Ventas
          </Button>
        </div>
      }
    >
      {activeTab === "pos" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Product Catalog Picker */}
          <div className="space-y-4">
            <div className="surface-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchProd}
                    onChange={(e) => setSearchProd(e.target.value)}
                    placeholder="Buscar producto por nombre o SKU..."
                    className="h-10 pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Precios:</span>
                  <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
                    <button
                      type="button"
                      onClick={() => setPricingMode("detal")}
                      className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                        pricingMode === "detal"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Detal
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingMode("mayor")}
                      className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                        pricingMode === "mayor"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Mayor
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {loadingProducts && <Skeleton className="h-96 w-full rounded-xl" />}

            {!loadingProducts && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((p: any) => {
                  const firstImg = p.images?.[0];
                  const price =
                    pricingMode === "mayor" && p.wholesale_price
                      ? p.wholesale_price
                      : p.retail_price;

                  return (
                    <div
                      key={p.id}
                      className="surface-card flex flex-col justify-between p-3.5 transition-all hover:border-primary/50"
                    >
                      <div>
                        <div className="flex gap-3">
                          {firstImg ? (
                            <img
                              src={firstImg}
                              alt={p.name}
                              className="size-16 rounded-lg border border-border object-cover"
                            />
                          ) : (
                            <div className="flex size-16 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted-foreground">
                              <Package className="size-6" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-semibold text-foreground text-sm">
                              {p.name}
                            </p>
                            <p className="font-mono text-[11px] text-muted-foreground">
                              {p.base_sku || "Sin SKU"}
                            </p>
                            <p className="mt-1 font-bold text-primary">{moneyExact(price)}</p>
                          </div>
                        </div>

                        {/* Variants Picker Buttons */}
                        <div className="mt-3">
                          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                            Tallas / Variantes:
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {(p.variants ?? [])
                              .filter((v: any) => v.active)
                              .map((v: any) => {
                                const inStock = v.stock > 0;
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => addToCart(p, v)}
                                    disabled={!inStock}
                                    className={`rounded border px-2 py-1 text-xs font-semibold transition-colors ${
                                      inStock
                                        ? "border-border bg-surface-2 hover:border-primary hover:bg-primary/10"
                                        : "cursor-not-allowed border-dashed border-border bg-muted/40 text-muted-foreground line-through opacity-60"
                                    }`}
                                  >
                                    {v.size} {v.color ? `(${v.color})` : ""}{" "}
                                    <span className="text-[10px] text-muted-foreground">
                                      ({v.stock})
                                    </span>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* POS Cart Sidebar */}
          <div className="surface-card flex flex-col justify-between p-5 lg:sticky lg:top-24 h-fit">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-display text-lg font-bold">Ticket de Venta</h2>
                <span className="text-xs font-semibold text-muted-foreground">
                  {cart.length} productos
                </span>
              </div>

              {/* Customer Selector */}
              <div className="mt-4 space-y-2">
                <label className="block text-xs font-semibold text-muted-foreground">Cliente</label>
                <div className="flex gap-2">
                  <Input
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setSelectedCustomerId("");
                    }}
                    placeholder="Cliente mostrador / Nombre..."
                    className="h-9 text-xs"
                  />
                  {customers.length > 0 && (
                    <select
                      className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
                      value={selectedCustomerId}
                      onChange={(e) => {
                        const cid = e.target.value;
                        setSelectedCustomerId(cid);
                        const c = customers.find((x) => x.id === cid);
                        if (c) setCustomerName(`${c.first_name} ${c.last_name ?? ""}`.trim());
                      }}
                    >
                      <option value="">Buscar de la lista</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.first_name} {c.last_name ?? ""} ({c.whatsapp || "Sin tel"})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Items in Cart */}
              <div className="mt-4 max-h-64 space-y-2.5 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    El carrito está vacío. Haz clic en las tallas para añadir al ticket.
                  </p>
                ) : (
                  cart.map((item, idx) => (
                    <div
                      key={item.variantId}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 p-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-foreground">{item.productName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Talla: {item.size} {item.color ? `· ${item.color}` : ""}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-muted-foreground">$</span>
                          <input
                            type="number"
                            step="0.1"
                            value={String(item.unitPrice)}
                            onChange={(e) => updateItemPrice(idx, parseFloat(e.target.value) || 0)}
                            className="h-6 w-16 rounded border border-input bg-background px-1 text-xs font-semibold"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(idx, item.quantity - 1)}
                          className="flex size-6 items-center justify-center rounded border border-border bg-background hover:bg-muted"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-bold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(idx, item.quantity + 1)}
                          className="flex size-6 items-center justify-center rounded border border-border bg-background hover:bg-muted"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => updateQuantity(idx, 0)}
                          className="ml-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="mt-4 border-t border-border pt-3">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Método de Pago
                </label>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { id: "efectivo", label: "Efectivo USD/Bs", icon: Banknote },
                    { id: "pago_movil", label: "Pago Móvil", icon: DollarSign },
                    { id: "punto_venta", label: "Punto / Tarjeta", icon: CreditCard },
                    { id: "usdt", label: "USDT / Cripto", icon: DollarSign },
                  ].map((m) => {
                    const Icon = m.icon;
                    const active = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`flex items-center gap-1.5 rounded-lg border p-2 font-medium transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="size-3.5" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Total and Checkout button */}
            <div className="mt-6 border-t border-border pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Total a Cobrar</span>
                <span className="text-display text-2xl text-primary">{moneyExact(subtotal)}</span>
              </div>
              <Button
                variant="hero"
                size="lg"
                className="mt-4 w-full gap-2"
                disabled={cart.length === 0 || processing}
                onClick={handleCompleteSale}
              >
                {processing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle className="size-4" />
                )}
                Registrar y Cobrar Venta
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* History of Sales */
        <div className="space-y-4">
          <div className="surface-card p-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar por número de venta o cliente..."
                className="h-9 pl-9"
              />
            </div>
          </div>

          {loadingSales && <Skeleton className="h-64 w-full rounded-xl" />}

          {!loadingSales && (
            <div className="surface-card overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Nº Venta</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Método</th>
                    <th className="px-4 py-3">Artículos</th>
                    <th className="px-4 py-3">Costo</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Ganancia</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        <Receipt className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                        No se encontraron ventas registradas.
                      </td>
                    </tr>
                  )}
                  {filteredHistory.map((s) => {
                    const profit = Number(s.total || 0) - Number(s.cost_total || 0);
                    const totalQty = (s.items ?? []).reduce((sum, i) => sum + i.quantity, 0);

                    return (
                      <tr key={s.id} className="transition-colors hover:bg-surface-2/60">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">
                          {s.sale_number}
                        </td>
                        <td className="px-4 py-3">
                          {s.customer?.first_name ? (
                            <span>
                              {s.customer.first_name} {s.customer.last_name ?? ""}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Cliente Mostrador</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-semibold uppercase text-muted-foreground">
                            {s.payment_method_code ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">{totalQty} uds.</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {moneyExact(s.cost_total)}
                        </td>
                        <td className="px-4 py-3 font-bold text-primary">{moneyExact(s.total)}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          +{moneyExact(profit)}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleDateString("es-VE", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedHistorySale(s)}
                            className="h-7 text-xs"
                          >
                            Ver Ticket
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sale Completed Receipt Modal */}
      <Dialog open={Boolean(completedSale)} onOpenChange={(v) => !v && setCompletedSale(null)}>
        <DialogContent className="max-w-md">
          {completedSale && (
            <>
              <DialogHeader>
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle className="size-6" />
                </div>
                <DialogTitle className="text-center font-mono text-xl">
                  {completedSale.saleNumber}
                </DialogTitle>
                <DialogDescription className="text-center">
                  Venta completada con éxito. Cliente: {completedSale.customer}
                </DialogDescription>
              </DialogHeader>

              <div className="my-2 rounded-xl border border-border bg-surface-2 p-3 text-xs">
                <div className="divide-y divide-border">
                  {completedSale.items.map((item, i) => (
                    <div key={i} className="flex justify-between py-1.5">
                      <div>
                        <p className="font-semibold">{item.productName}</p>
                        <p className="text-muted-foreground">
                          Talla: {item.size} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-bold">{moneyExact(item.unitPrice * item.quantity)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-bold">
                  <span>Total Cobrado:</span>
                  <span className="text-primary">{moneyExact(completedSale.total)}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Método: {completedSale.method.toUpperCase()}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="w-full gap-1.5" onClick={() => window.print()}>
                  <Printer className="size-4" /> Imprimir
                </Button>
                <Button variant="hero" className="w-full" onClick={() => setCompletedSale(null)}>
                  Nueva Venta
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* History Sale Detail Modal */}
      <Dialog
        open={Boolean(selectedHistorySale)}
        onOpenChange={(v) => !v && setSelectedHistorySale(null)}
      >
        <DialogContent className="max-w-md">
          {selectedHistorySale && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-lg">
                  Ticket {selectedHistorySale.sale_number}
                </DialogTitle>
                <DialogDescription>
                  {new Date(selectedHistorySale.created_at).toLocaleString("es-VE")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs">
                <div className="rounded-lg border border-border bg-surface-2 p-2.5">
                  <p className="text-muted-foreground">Cliente:</p>
                  <p className="font-semibold">
                    {selectedHistorySale.customer?.first_name ?? "Cliente Mostrador"}
                  </p>
                  <p className="mt-1 text-muted-foreground">Método de pago:</p>
                  <p className="font-semibold uppercase">
                    {selectedHistorySale.payment_method_code ?? "—"}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-2.5">
                  <p className="font-semibold uppercase text-muted-foreground mb-2">Artículos</p>
                  <div className="divide-y divide-border">
                    {selectedHistorySale.items?.map((item) => (
                      <div key={item.id} className="flex justify-between py-1.5">
                        <div>
                          <p className="font-semibold">{item.product_name}</p>
                          <p className="text-muted-foreground">
                            Talla: {item.size ?? "Única"} × {item.quantity}
                          </p>
                        </div>
                        <p className="font-bold">{moneyExact(item.subtotal)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-bold">
                    <span>Total:</span>
                    <span className="text-primary">{moneyExact(selectedHistorySale.total)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                    onClick={() => handleDeleteSale(selectedHistorySale)}
                    disabled={deletingSale}
                  >
                    <Trash2 className="size-4" />
                    {deletingSale ? "Eliminando..." : "Eliminar Venta (Reintegrar Stock)"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
