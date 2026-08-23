import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Package,
  ShoppingBag,
  Tag,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOrder, listPaymentMethods } from "@/lib/checkout.functions";
import { getPublicStoreSettings } from "@/lib/settings.functions";
import { useCart, WHOLESALE_MIN_ORDER_UNITS } from "@/lib/cart";
import { money, moneyExact } from "@/lib/format";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    tipo: typeof search.tipo === "string" ? search.tipo : undefined,
  }),
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
  const search = Route.useSearch();
  const {
    lines,
    count,
    subtotal,
    savings,
    getLineUnitPrice,
    clear,
    wholesaleLines,
    wholesaleCount,
    wholesaleSubtotal,
    wholesaleSavings,
    isWholesaleValid,
    wholesaleUnitsNeeded,
    clearWholesale,
  } = useCart();

  const isWholesaleCheckout =
    search.tipo === "mayorista" || (wholesaleLines.length > 0 && lines.length === 0);

  const activeLines = isWholesaleCheckout ? wholesaleLines : lines;
  const activeCount = isWholesaleCheckout ? wholesaleCount : count;
  const activeSubtotal = isWholesaleCheckout ? wholesaleSubtotal : subtotal;
  const activeSavings = isWholesaleCheckout ? wholesaleSavings : savings;

  const { data: methods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      try {
        const res = await listPaymentMethods();
        return res ?? [];
      } catch (err) {
        console.warn("[Checkout] Error loading payment methods:", err);
        return [];
      }
    },
  });

  const { data: storeSettings } = useQuery({
    queryKey: ["public", "store-settings"],
    queryFn: async () => {
      try {
        const res = await getPublicStoreSettings();
        return res ?? null;
      } catch (err) {
        console.warn("[Checkout] Error loading store settings:", err);
        return null;
      }
    },
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
  const [copiedCode, setCopiedCode] = useState(false);

  // Proof and Reference State
  const [reference, setReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [successOrder, setSuccessOrder] = useState<{
    orderNumber: string;
    total: number;
    shippingMethod: string;
    isWholesale?: boolean;
  } | null>(null);

  const selected = method || methods?.[0]?.code || "";
  const activeMethod = methods?.find((m) => m.code === selected);

  const usdtRate = Number(storeSettings?.exchange_rate_usdt || 86.2);
  const totalBs = activeSubtotal * usdtRate;

  function handleFileSelect(selectedFile: File | null) {
    if (!selectedFile) {
      setProofFile(null);
      setProofPreview(null);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("El archivo supera el límite de 5 MB. Por favor elige una imagen más ligera.");
      return;
    }

    const isValidType =
      selectedFile.type.startsWith("image/") || selectedFile.type === "application/pdf";

    if (!isValidType) {
      toast.error("Formato no permitido. Por favor usa JPG, PNG, WEBP o PDF.");
      return;
    }

    setProofFile(selectedFile);

    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setProofPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setProofPreview(null);
    }
  }

  async function submit() {
    if (isWholesaleCheckout && !isWholesaleValid) {
      toast.error(
        `El pedido mayorista requiere mínimo ${WHOLESALE_MIN_ORDER_UNITS} unidades (actualmente tienes ${wholesaleCount}).`,
      );
      return;
    }

    if (!shippingMethod) {
      toast.error("Por favor selecciona una empresa de envío (TEALCA o MRW)");
      return;
    }

    if (!form.firstName.trim()) {
      toast.error("Por favor ingresa tu nombre");
      return;
    }

    if (!form.whatsapp.trim()) {
      toast.error("Por favor ingresa tu número de WhatsApp");
      return;
    }

    if (!form.city.trim() || !form.address.trim()) {
      toast.error("Por favor ingresa la ciudad y dirección o agencia de entrega");
      return;
    }

    if (!selected) {
      toast.error("Por favor selecciona un método de pago");
      return;
    }

    if (!proofFile) {
      toast.error("Por favor adjunta la captura o recibo de tu comprobante de pago");
      return;
    }

    setSaving(true);
    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          const cleanBase64 = res.includes(",") ? res.split(",")[1] : res;
          resolve(cleanBase64);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(proofFile);
      });

      const result = await createOrder({
        data: {
          customer: form,
          shippingMethod,
          paymentMethod: selected,
          rateType: "USDT",
          exchangeRateUsed: usdtRate,
          isOrderWholesale: isWholesaleCheckout,
          lines: activeLines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          paymentProof: {
            reference: reference.trim(),
            fileName: proofFile.name,
            contentType: proofFile.type || "image/jpeg",
            dataBase64: base64,
          },
        },
      });

      if (isWholesaleCheckout) {
        clearWholesale();
      } else {
        clear();
      }

      setSuccessOrder({
        orderNumber: result.orderNumber,
        total: Number(result.total || activeSubtotal),
        shippingMethod,
        isWholesale: isWholesaleCheckout,
      });
      toast.success("¡Pedido y comprobante registrados con éxito!", {
        description: `Orden ${result.orderNumber}${isWholesaleCheckout ? " (Mayorista)" : ""}`,
      });
    } catch (error) {
      console.error("Error al crear el pedido:", error);
      toast.error("No pudimos crear el pedido", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleCopyOrderNumber(orderNum: string) {
    navigator.clipboard.writeText(orderNum);
    setCopiedCode(true);
    toast.success("Número de orden copiado al portapapeles");
    setTimeout(() => setCopiedCode(false), 2500);
  }

  // Pantalla de Confirmación de Pedido Exitoso
  if (successOrder) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16 animate-in fade-in zoom-in-95 duration-300">
          <div className="surface-card relative overflow-hidden rounded-2xl border border-primary/20 p-6 sm:p-10 text-center shadow-xl shadow-primary/5">
            {/* Animación del Checkmark */}
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 ring-8 ring-emerald-500/10 animate-in zoom-in-50 duration-500">
              <Check className="size-10 stroke-[3]" />
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <span className="mt-6 inline-block rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
                Paso 3 de 4 • Registro Exitoso
              </span>

              <h1 className="mt-3 text-display text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                ¡Pedido Realizado Exitosamente!
              </h1>

              {successOrder.isWholesale && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                  <Tag className="size-3.5" /> Pedido Registrado con Tarifa Mayorista
                </div>
              )}

              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Tu orden ha sido registrada en nuestro sistema y está lista para ser procesada.
              </p>
            </div>

            {/* Tarjeta de Resumen del Pedido */}
            <div className="mt-6 rounded-xl border border-border bg-surface-2/60 p-4 sm:p-5 text-left animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3.5">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Número de Seguimiento
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-lg sm:text-xl font-bold text-primary">
                      {successOrder.orderNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyOrderNumber(successOrder.orderNumber)}
                      className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-border transition-colors"
                      title="Copiar código"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="size-3.5 text-emerald-500" />
                          <span className="text-emerald-500 font-semibold">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Monto Total
                  </span>
                  <p className="text-display text-lg font-bold text-foreground">
                    {moneyExact(successOrder.total)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Empresa de Envío:</span>
                  <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                    <Truck className="size-3.5 text-primary" />
                    Agencia {successOrder.shippingMethod}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Estado inicial:</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                    <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                    Pago pendiente
                  </span>
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Button
                variant="hero"
                size="lg"
                className="w-full sm:w-auto gap-2 px-6"
                onClick={() =>
                  navigate({ to: "/pedido", search: { code: successOrder.orderNumber } })
                }
              >
                <Package className="size-4" />
                Ver seguimiento de mi pedido
                <ArrowRight className="size-4" />
              </Button>

              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link to={successOrder.isWholesale ? "/mayor" : "/catalogo"}>
                  {successOrder.isWholesale ? "Volver al catálogo mayorista" : "Volver al catálogo"}
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Guarda tu número de pedido para consultar su estatus en cualquier momento desde el
              menú principal.
            </p>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (activeLines.length === 0) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="surface-card flex flex-col items-center gap-4 p-14 text-center">
            <ShoppingBag className="size-12 text-muted-foreground" />
            <h1 className="text-display text-2xl">
              {isWholesaleCheckout
                ? "No hay productos en el carrito mayorista"
                : "No hay productos por pagar"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isWholesaleCheckout
                ? "Selecciona al menos 8 unidades en el catálogo mayorista para continuar."
                : "Explora nuestro catálogo y agrega productos a tu pedido."}
            </p>
            <Button asChild variant="hero" size="lg">
              <Link to={isWholesaleCheckout ? "/mayor" : "/catalogo"}>
                {isWholesaleCheckout ? "Ver Catálogo Mayorista" : "Ver Catálogo"}
              </Link>
            </Button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (isWholesaleCheckout && !isWholesaleValid) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="surface-card flex flex-col items-center gap-4 p-10 text-center border-amber-500/30 bg-amber-500/5">
            <AlertCircle className="size-12 text-amber-500" />
            <h1 className="text-display text-2xl font-bold text-foreground">
              Mínimo de Compra Mayorista No Alcanzado
            </h1>
            <p className="text-sm text-muted-foreground max-w-md">
              Actualmente tienes{" "}
              <strong className="text-foreground">{wholesaleCount} unidades</strong> en tu carrito.
              La compra al mayor requiere un mínimo de{" "}
              <strong className="text-primary">
                {WHOLESALE_MIN_ORDER_UNITS} unidades acumuladas
              </strong>{" "}
              (puedes combinar libremente productos, tallas y modelos).
            </p>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Te faltan {wholesaleUnitsNeeded} unidades para desbloquear el checkout mayorista.
            </p>
            <div className="flex gap-3 mt-2">
              <Button asChild variant="hero" size="lg">
                <Link to="/mayor">Completar Pedido en Catálogo Mayorista</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/carrito">Ver Carrito</Link>
              </Button>
            </div>
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
    Boolean(shippingMethod) &&
    Boolean(selected) &&
    Boolean(proofFile) &&
    (!isWholesaleCheckout || isWholesaleValid);

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

            {/* Carga Obligatoria de Comprobante de Pago y Referencia */}
            <section className="surface-card p-5 border-2 border-primary/30">
              <div className="flex items-center gap-2">
                <Upload className="size-5 text-primary" />
                <h2 className="text-display text-lg font-bold">Comprobante y Referencia de Pago</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Realiza tu pago usando los datos indicados y adjunta la captura o recibo junto al
                número de referencia para procesar tu orden.
              </p>

              <div className="mt-4 space-y-4">
                {/* Campo Referencia */}
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Número de Referencia Bancaria / Hash de Operación (opcional o según aplique)
                  </span>
                  <Input
                    className="mt-1.5 h-11 font-mono text-sm"
                    value={reference}
                    placeholder="Ej: 12345678 o 00987654"
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>

                {/* Campo Archivo Comprobante */}
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-1.5">
                    Captura o Recibo de Pago (JPG, PNG, WEBP o PDF) *
                  </span>

                  {!proofFile ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        const droppedFile = e.dataTransfer.files?.[0];
                        if (droppedFile) handleFileSelect(droppedFile);
                      }}
                      className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                        isDragOver
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-surface-2/40"
                      }`}
                      onClick={() => {
                        const input = document.getElementById(
                          "checkout-proof-file",
                        ) as HTMLInputElement;
                        if (input) input.click();
                      }}
                    >
                      <input
                        id="checkout-proof-file"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          handleFileSelect(file);
                        }}
                      />
                      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                        <Upload className="size-6" />
                      </div>
                      <p className="text-xs font-bold text-foreground">
                        Haz clic aquí o arrastra tu comprobante de pago
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Formatos soportados: JPG, PNG, WEBP o PDF (Máximo 5 MB)
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-surface-2/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {proofPreview ? (
                            <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
                              <img
                                src={proofPreview}
                                alt="Previsualización del comprobante"
                                className="size-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-border bg-primary/10 text-primary">
                              <FileText className="size-8" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="size-4 shrink-0" />
                              <span>Comprobante cargado</span>
                            </div>
                            <p
                              className="truncate text-xs font-medium text-foreground mt-0.5"
                              title={proofFile.name}
                            >
                              {proofFile.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {(proofFile.size / 1024).toFixed(0)} KB ·{" "}
                              {proofFile.type || "Documento"}
                            </p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                          onClick={() => {
                            setProofFile(null);
                            setProofPreview(null);
                          }}
                        >
                          <X className="size-4 mr-1" />
                          Quitar
                        </Button>
                      </div>

                      {proofPreview && (
                        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-black/5 dark:bg-black/20 p-2">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">
                            Previsualización
                          </p>
                          <img
                            src={proofPreview}
                            alt="Vista previa completa"
                            className="max-h-60 w-auto rounded object-contain mx-auto"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Resumen Lateral */}
          <aside className="surface-card h-fit p-5 lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <h2 className="text-display text-lg">Resumen del Pedido</h2>
              {isWholesaleCheckout && (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                  MAYORISTA ({activeCount} uds.)
                </span>
              )}
            </div>

            <ul className="mt-4 space-y-3 text-sm">
              {activeLines.map((l, idx) => {
                const linePrice = isWholesaleCheckout
                  ? isWholesaleValid && l.wholesalePrice != null
                    ? Number(l.wholesalePrice)
                    : Number(l.retailPrice || 0)
                  : getLineUnitPrice(l as any);

                const safeKey = `${l.productId}_${l.variantId}_${l.size}_${l.color || ""}_${idx}`;

                return (
                  <li key={safeKey} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{l.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Talla {l.size} × {l.quantity}
                        {isWholesaleCheckout && " · mayor"}
                      </span>
                    </span>
                    <span className="font-semibold">
                      {moneyExact(linePrice * (Number(l.quantity) || 0))}
                    </span>
                  </li>
                );
              })}
            </ul>

            {activeSavings > 0 && (
              <p className="mt-4 text-sm font-semibold text-primary">
                Ahorro al mayor ({activeCount} uds.): -{moneyExact(activeSavings)}
              </p>
            )}

            {/* Total USD */}
            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">Total USD</span>
              <span className="text-display text-2xl text-primary">
                {moneyExact(activeSubtotal)}
              </span>
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
              {saving ? (
                <>
                  <Loader2 className="size-5 animate-spin mr-2" />
                  Procesando pedido y comprobante...
                </>
              ) : (
                <>
                  Confirmar pedido <ArrowRight className="size-5 ml-1" />
                </>
              )}
            </Button>
            <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
              {!proofFile
                ? "Adjunta tu comprobante de pago arriba para habilitar la confirmación."
                : "Al confirmar, tu orden y comprobante quedan registrados y asociados en el sistema."}
            </p>
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
