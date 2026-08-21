import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Loader2, ShoppingBag, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOrder, listPaymentMethods } from "@/lib/checkout.functions";
import { getPublicStoreSettings } from "@/lib/settings.functions";
import { unitPrice, useCart } from "@/lib/cart";
import { moneyExact } from "@/lib/format";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Finalizar compra | KICKPOINT" },
      {
        name: "description",
        content:
          "Completa tus datos de entrega, elige Pago Móvil, USDT o Zelle, selecciona tu agencia (TEALCA / MRW) y confirma tu pedido KICKPOINT.",
      },
      { property: "og:title", content: "Finalizar compra | KICKPOINT" },
      {
        property: "og:description",
        content: "Datos de entrega y método de pago para tu pedido KICKPOINT.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

const FIELDS: readonly {
  key: "firstName" | "lastName" | "whatsapp" | "email" | "city" | "state";
  label: string;
  placeholder: string;
  required?: boolean;
}[] = [
  { key: "firstName", label: "Nombre", placeholder: "María", required: true },
  { key: "lastName", label: "Apellido", placeholder: "Pérez", required: false },
  { key: "whatsapp", label: "WhatsApp", placeholder: "0412 123 4567", required: true },
  { key: "email", label: "Correo (opcional)", placeholder: "maria@correo.com", required: false },
  { key: "city", label: "Ciudad / Municipio", placeholder: "Caracas", required: true },
  { key: "state", label: "Estado", placeholder: "Distrito Capital", required: false },
] as const;

function CheckoutPage() {
  const navigate = useNavigate();
  const { lines, count, subtotal, savings, getLineUnitPrice, clear } = useCart();

  const { data: methods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => listPaymentMethods(),
  });

  const { data: storeSettings } = useQuery({
    queryKey: ["public", "store-settings"],
    queryFn: () => getPublicStoreSettings(),
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    whatsapp: "",
    email: "",
    address: "",
    city: "",
    state: "",
    notes: "",
  });
  const [shippingMethod, setShippingMethod] = useState<"TEALCA" | "MRW">("MRW");
  const [method, setMethod] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const selected = method || methods?.[0]?.code || "";
  const activeMethod = methods?.find((m) => m.code === selected);

  const usdtRate = Number(storeSettings?.exchange_rate_usdt || 86.2);
  const totalBs = subtotal * usdtRate;

  async function submit() {
    if (!shippingMethod) {
      toast.error("Por favor selecciona una empresa de envío (TEALCA o MRW)");
      return;
    }
    setSaving(true);
    try {
      const result = await createOrder({
        data: {
          customer: form,
          shippingMethod,
          paymentMethod: selected,
          rateType: "USDT",
          exchangeRateUsed: usdtRate,
          lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        },
      });
      clear();
      toast.success("Pedido creado", { description: result.orderNumber });
      await navigate({ to: "/pedido", search: { code: result.orderNumber } });
    } catch (error) {
      toast.error("No pudimos crear el pedido", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  if (lines.length === 0) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="surface-card flex flex-col items-center gap-4 p-14 text-center">
            <ShoppingBag className="size-12 text-muted-foreground" />
            <h1 className="text-display text-2xl">No hay productos por pagar</h1>
            <Button asChild variant="hero" size="lg">
              <Link to="/catalogo">Ver catálogo</Link>
            </Button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const ready =
    form.firstName.trim() &&
    form.whatsapp.trim() &&
    form.city.trim() &&
    form.address.trim() &&
    Boolean(shippingMethod);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-eyebrow text-primary">Paso 2 de 4</p>
        <h1 className="text-display text-3xl sm:text-4xl">Datos, envío y método de pago</h1>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {/* Método de Envío */}
            <section className="surface-card p-5">
              <div className="flex items-center gap-2">
                <Truck className="size-5 text-primary" />
                <h2 className="text-display text-lg font-bold">Empresa de Envío Nacional</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Selecciona la empresa de encomienda de tu preferencia para recibir tu pedido a nivel
                nacional.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShippingMethod("MRW")}
                  className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center transition-all ${
                    shippingMethod === "MRW"
                      ? "border-primary bg-accent ring-2 ring-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-base">
                    <span>MRW</span>
                    {shippingMethod === "MRW" && <CheckCircle2 className="size-4 text-primary" />}
                  </div>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    Envíos a agencias y a domicilio
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShippingMethod("TEALCA")}
                  className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center transition-all ${
                    shippingMethod === "TEALCA"
                      ? "border-primary bg-accent ring-2 ring-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-base">
                    <span>TEALCA</span>
                    {shippingMethod === "TEALCA" && (
                      <CheckCircle2 className="size-4 text-primary" />
                    )}
                  </div>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    Cobertura nacional con tracking express
                  </span>
                </button>
              </div>
            </section>

            {/* Datos de Entrega */}
            <section className="surface-card p-5">
              <h2 className="text-display text-lg">Datos de entrega</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {FIELDS.map((field) => (
                  <label key={field.key} className="block">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {field.label}
                      {field.required ? " *" : ""}
                    </span>
                    <Input
                      className="mt-1.5 h-11"
                      value={form[field.key]}
                      placeholder={field.placeholder}
                      onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    />
                  </label>
                ))}
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Dirección exacta o Código/Nombre de Agencia ({shippingMethod}) *
                  </span>
                  <Input
                    className="mt-1.5 h-11"
                    value={form.address}
                    placeholder={`Ej: Agencia ${shippingMethod} Centro, Av. Principal, C.C. Los Samanes`}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Nota o indicaciones adicionales (opcional)
                  </span>
                  <textarea
                    className="mt-1.5 min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-primary"
                    value={form.notes}
                    placeholder="Ej: titular que retira en agencia, número de cédula para el paquete, etc."
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </label>
              </div>
            </section>

            {/* Método de Pago */}
            <section className="surface-card p-5">
              <h2 className="text-display text-lg">Método de pago</h2>
              <div className="mt-4 space-y-3">
                {(methods ?? []).map((m) => {
                  const active = m.code === selected;
                  return (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => setMethod(m.code)}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        active
                          ? "border-primary bg-accent"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <p className="font-bold">{m.name}</p>
                      {m.instructions && (
                        <p className="mt-1 text-xs text-muted-foreground">{m.instructions}</p>
                      )}
                    </button>
                  );
                })}
              </div>

              {activeMethod && Object.keys(activeMethod.details ?? {}).length > 0 && (
                <dl className="mt-4 grid gap-2 rounded-xl border border-border bg-surface-2/50 p-4 text-sm">
                  {Object.entries(activeMethod.details).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4">
                      <dt className="capitalize text-muted-foreground">{key}</dt>
                      <dd className="text-right font-semibold">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </div>

          {/* Resumen Lateral */}
          <aside className="surface-card h-fit p-5 lg:sticky lg:top-24">
            <h2 className="text-display text-lg">Resumen del Pedido</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {lines.map((l) => (
                <li key={l.variantId} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{l.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Talla {l.size} × {l.quantity}
                    </span>
                  </span>
                  <span className="font-semibold">
                    {moneyExact(getLineUnitPrice(l) * l.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            {savings > 0 && (
              <p className="mt-4 text-sm font-semibold text-primary">
                Ahorro al mayor ({count} uds.): -{moneyExact(savings)}
              </p>
            )}

            {/* Total USD */}
            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">Total USD</span>
              <span className="text-display text-2xl text-primary">{moneyExact(subtotal)}</span>
            </div>

            {/* Conversión a Bolívares usando exclusivamente la Tasa USDT */}
            <div className="mt-4 rounded-xl border border-border bg-surface-2/60 p-3.5 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Conversión a Bolívares (Bs.)</span>
                <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-[10px] text-primary">
                  Tasa USDT Oficial
                </span>
              </div>

              <div className="flex justify-between items-center text-muted-foreground pt-1">
                <span>Tasa de cambio:</span>
                <span className="font-semibold text-foreground font-mono">
                  Bs. {usdtRate.toFixed(2)} / USD
                </span>
              </div>

              <div className="flex justify-between items-center border-t border-border/80 pt-2 text-sm font-bold text-foreground">
                <span>Total en Bs.:</span>
                <span className="text-primary font-mono text-base">
                  Bs.{" "}
                  {totalBs.toLocaleString("es-VE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            <Button
              variant="hero"
              size="lg"
              className="mt-4 w-full"
              disabled={!ready || !selected || saving}
              onClick={submit}
            >
              {saving ? <Loader2 className="size-5 animate-spin" /> : null}
              Confirmar pedido <ArrowRight className="size-5" />
            </Button>
            <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
              Al confirmar, tu pedido queda registrado de inmediato en el sistema y podrás subir tu
              comprobante de pago.
            </p>
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
