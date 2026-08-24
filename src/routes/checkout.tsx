import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  Loader2,
  Package,
  ShoppingBag,
  Tag,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOrder, listPaymentMethods } from "@/lib/checkout.functions";
import { getPublicStoreSettings } from "@/lib/settings.functions";
import { useCart, WHOLESALE_MIN_ORDER_UNITS } from "@/lib/cart";
import { moneyExact } from "@/lib/format";

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

type FormKey =
  | "firstName"
  | "lastName"
  | "identityDocument"
  | "whatsapp"
  | "email"
  | "city"
  | "state";

const FIELDS: readonly {
  key: FormKey;
  label: string;
  placeholder: string;
  required?: boolean;
  inputMode?: "text" | "tel" | "email" | "numeric";
  autoComplete?: string;
}[] = [
  {
    key: "firstName",
    label: "Nombre",
    placeholder: "María",
    required: true,
    autoComplete: "given-name",
  },
  {
    key: "lastName",
    label: "Apellido",
    placeholder: "Pérez",
    required: true,
    autoComplete: "family-name",
  },
  { key: "identityDocument", label: "Cédula / RIF", placeholder: "V-12345678", required: true },
  {
    key: "whatsapp",
    label: "Teléfono / WhatsApp",
    placeholder: "0412 123 4567",
    required: true,
    inputMode: "tel",
    autoComplete: "tel",
  },
  {
    key: "email",
    label: "Correo (opcional)",
    placeholder: "maria@correo.com",
    inputMode: "email",
    autoComplete: "email",
  },
  {
    key: "state",
    label: "Estado",
    placeholder: "Barinas",
    required: true,
    autoComplete: "address-level1",
  },
  {
    key: "city",
    label: "Ciudad / Municipio",
    placeholder: "Barinas",
    required: true,
    autoComplete: "address-level2",
  },
] as const;

const STEPS = [
  { id: 1, label: "Envío" },
  { id: 2, label: "Pago" },
  { id: 3, label: "Confirmación" },
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="mt-4 flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, idx) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <div
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                active
                  ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                  : done
                    ? "bg-emerald-600 text-white"
                    : "border border-border bg-surface-2 text-muted-foreground"
              }`}
            >
              {done ? <Check className="size-4" /> : s.id}
            </div>
            <span
              className={`text-xs font-semibold sm:text-sm ${
                active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 && (
              <span
                className={`hidden h-px flex-1 sm:block ${done ? "bg-emerald-600" : "bg-border"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

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
    search.tipo === "mayorista" ||
    (wholesaleLines.length > 0 && lines.length === 0) ||
    wholesaleCount >= WHOLESALE_MIN_ORDER_UNITS ||
    (lines.length > 0 && count >= WHOLESALE_MIN_ORDER_UNITS);

  const activeLines = isWholesaleCheckout
    ? wholesaleLines.length > 0
      ? wholesaleLines
      : lines
    : lines;
  const activeCount = isWholesaleCheckout
    ? wholesaleLines.length > 0
      ? wholesaleCount
      : count
    : count;
  const activeSubtotal = isWholesaleCheckout
    ? wholesaleLines.length > 0
      ? wholesaleSubtotal
      : subtotal
    : subtotal;
  const activeSavings = isWholesaleCheckout
    ? wholesaleLines.length > 0
      ? wholesaleSavings
      : savings
    : savings;

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

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    identityDocument: "",
    whatsapp: "",
    email: "",
    address: "",
    city: "",
    state: "",
    notes: "",
  });
  const [shippingMethod, setShippingMethod] = useState<"TEALCA" | "MRW" | "">("");
  const [method, setMethod] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);
  const [copiedCode, setCopiedCode] = useState(false);

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

  const selected = method;
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
      reader.onload = () => setProofPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setProofPreview(null);
    }
  }

  function goToStep(next: number) {
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateShipping(): boolean {
    if (!shippingMethod) {
      toast.error("Selecciona dónde deseas recibir tu pedido (MRW o TEALCA)");
      return false;
    }
    const missing: string[] = [];
    if (!form.firstName.trim()) missing.push("Nombre");
    if (!form.lastName.trim()) missing.push("Apellido");
    if (!form.identityDocument.trim()) missing.push("Cédula");
    if (!form.whatsapp.trim()) missing.push("Teléfono");
    if (!form.state.trim()) missing.push("Estado");
    if (!form.city.trim()) missing.push("Ciudad");
    if (!form.address.trim()) missing.push(`Agencia ${shippingMethod}`);

    if (missing.length) {
      toast.error("Falta información obligatoria", { description: missing.join(", ") });
      return false;
    }
    return true;
  }

  function validatePayment(): boolean {
    if (!selected) {
      toast.error("Selecciona un método de pago");
      return false;
    }
    if (!proofFile) {
      toast.error("Debes subir el comprobante de pago para continuar");
      return false;
    }
    return true;
  }

  async function submit() {
    if (submittingRef.current || saving || successOrder) return;
    if (isWholesaleCheckout && !isWholesaleValid) {
      toast.error(
        `El pedido mayorista requiere mínimo ${WHOLESALE_MIN_ORDER_UNITS} unidades (actualmente tienes ${wholesaleCount}).`,
      );
      return;
    }
    if (!validateShipping()) {
      goToStep(1);
      return;
    }
    if (!validatePayment()) {
      goToStep(2);
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    try {
      const file = proofFile!;
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.includes(",") ? res.split(",")[1]! : res);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      const result = await createOrder({
        data: {
          customer: form,
          shippingMethod: shippingMethod as "TEALCA" | "MRW",
          paymentMethod: selected,
          rateType: "USDT",
          exchangeRateUsed: usdtRate,
          isWholesale: isWholesaleCheckout,
          lines: activeLines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          paymentProof: {
            reference: reference.trim(),
            fileName: file.name,
            contentType: file.type || "image/jpeg",
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
        shippingMethod: shippingMethod || "MRW",
        isWholesale: isWholesaleCheckout,
      });
      toast.success("¡Pedido y comprobante registrados con éxito!", {
        description: `Orden ${result.orderNumber}${isWholesaleCheckout ? " (Mayorista)" : ""}`,
      });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Error al crear el pedido:", error);
      toast.error("No pudimos crear el pedido", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
      submittingRef.current = false;
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

  // ---------- PASO 4: Pedido realizado ----------
  if (successOrder) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16 animate-in fade-in zoom-in-95 duration-300">
          <div className="surface-card relative overflow-hidden rounded-2xl border border-primary/20 p-6 sm:p-10 text-center shadow-xl shadow-primary/5">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 ring-8 ring-emerald-500/10 animate-in zoom-in-50 duration-500">
              <Check className="size-10 stroke-[3]" />
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <h1 className="mt-5 text-display text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                ¡Pedido realizado correctamente!
              </h1>

              {successOrder.isWholesale && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                  <Tag className="size-3.5" /> Pedido con tarifa mayorista
                </div>
              )}

              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Hemos recibido tu pedido y tu comprobante de pago. Nuestro equipo verificará la
                información y comenzará a procesar tu pedido.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-surface-2/60 p-4 sm:p-5 text-left animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3.5">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Número de pedido
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
                    Monto total
                  </span>
                  <p className="text-display text-lg font-bold text-foreground">
                    {moneyExact(successOrder.total)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Empresa de envío:</span>
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

  const lineRows = activeLines.map((l, idx) => {
    const unit = isWholesaleCheckout
      ? isWholesaleValid && l.wholesalePrice != null
        ? Number(l.wholesalePrice)
        : Number(l.retailPrice || 0)
      : getLineUnitPrice(l as any);
    return {
      key: `${l.productId}_${l.variantId}_${l.size}_${l.color || ""}_${idx}`,
      name: l.name,
      size: l.size,
      quantity: Number(l.quantity) || 0,
      unit,
      subtotal: unit * (Number(l.quantity) || 0),
    };
  });

  const summary = (
    <aside className="surface-card h-fit p-5 lg:sticky lg:top-24">
      <div className="flex items-center justify-between">
        <h2 className="text-display text-lg">Resumen del pedido</h2>
        {isWholesaleCheckout && (
          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
            MAYORISTA ({activeCount} uds.)
          </span>
        )}
      </div>

      <ul className="mt-4 space-y-3 text-sm">
        {lineRows.map((l) => (
          <li key={l.key} className="flex justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate font-medium">{l.name}</span>
              <span className="text-xs text-muted-foreground">
                Talla {l.size} × {l.quantity}
                {isWholesaleCheckout && " · mayor"}
              </span>
            </span>
            <span className="font-semibold tabular-nums">{moneyExact(l.subtotal)}</span>
          </li>
        ))}
      </ul>

      {activeSavings > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          <span>Descuento al mayor ({activeCount} uds.)</span>
          <span className="font-bold tabular-nums">-{moneyExact(activeSavings)}</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-4">
        <span className="min-w-0 text-xs sm:text-sm text-muted-foreground">Total USD</span>
        <span className="ml-auto text-right text-display text-xl sm:text-2xl text-primary tabular-nums whitespace-nowrap">
          {moneyExact(activeSubtotal)}
        </span>
      </div>

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
    </aside>
  );

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 pb-28 lg:pb-8">
        <p className="text-eyebrow text-primary">Checkout KICKPOINT</p>
        <h1 className="text-display text-3xl sm:text-4xl">
          {step === 1
            ? "Información de envío"
            : step === 2
              ? "Método de pago"
              : "Revisa tu pedido"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {step === 1
            ? "Completa tus datos para que podamos preparar y enviar tu pedido."
            : step === 2
              ? "Selecciona tu método de pago y registra tu comprobante."
              : "Verifica que todo esté correcto antes de confirmar tu pedido."}
        </p>

        <StepIndicator current={step} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {/* ---------- PASO 1 ---------- */}
            {step === 1 && (
              <>
                <section className="surface-card p-5">
                  <div className="flex items-center gap-2">
                    <Truck className="size-5 text-primary" />
                    <h2 className="text-display text-lg font-bold">
                      ¿Dónde deseas recibir tu pedido?
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Selecciona la empresa de encomienda con cobertura nacional.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {(["MRW", "TEALCA"] as const).map((agency) => (
                      <button
                        key={agency}
                        type="button"
                        onClick={() => setShippingMethod(agency)}
                        className={`flex min-h-[88px] flex-col items-center justify-center rounded-xl border p-4 text-center transition-all ${
                          shippingMethod === agency
                            ? "border-primary bg-accent ring-2 ring-primary"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-base">
                          <span>{agency}</span>
                          {shippingMethod === agency && (
                            <CheckCircle2 className="size-4 text-primary" />
                          )}
                        </div>
                        <span className="mt-1 text-[11px] text-muted-foreground">
                          {agency === "MRW"
                            ? "Envíos a agencias en todo el país"
                            : "Cobertura nacional con tracking"}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                {shippingMethod && (
                  <>
                    <section className="surface-card p-5">
                      <h2 className="text-display text-lg">Datos del cliente</h2>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {FIELDS.map((field) => (
                          <label key={field.key} className="block">
                            <span className="text-xs font-semibold text-muted-foreground">
                              {field.label}
                              {field.required ? " *" : ""}
                            </span>
                            <Input
                              className="mt-1.5 h-12 text-base"
                              value={form[field.key]}
                              placeholder={field.placeholder}
                              inputMode={field.inputMode}
                              autoComplete={field.autoComplete}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, [field.key]: e.target.value }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </section>

                    <section className="surface-card p-5">
                      <h2 className="text-display text-lg">Datos de la agencia</h2>
                      <label className="mt-4 block">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Agencia {shippingMethod} donde deseas recibir tu pedido *
                        </span>
                        <Input
                          className="mt-1.5 h-12 text-base"
                          value={form.address}
                          placeholder={`Ej: Agencia ${shippingMethod} Centro, Av. Principal, C.C. Los Samanes`}
                          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                        />
                      </label>
                      <label className="mt-4 block">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Nota o indicaciones adicionales (opcional)
                        </span>
                        <textarea
                          className="mt-1.5 min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-primary"
                          value={form.notes}
                          placeholder="Ej: titular que retira en agencia, referencia de ubicación, etc."
                          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        />
                      </label>
                    </section>
                  </>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button asChild variant="outline" size="lg" className="sm:w-auto">
                    <Link to="/carrito">
                      <ArrowLeft className="size-4 mr-1" /> Volver al carrito
                    </Link>
                  </Button>
                  <Button
                    variant="hero"
                    size="lg"
                    className="sm:w-auto"
                    onClick={() => {
                      if (validateShipping()) goToStep(2);
                    }}
                  >
                    Continuar al pago <ArrowRight className="size-4 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* ---------- PASO 2 ---------- */}
            {step === 2 && (
              <>
                <section className="surface-card p-5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-5 text-primary" />
                    <h2 className="text-display text-lg font-bold">Selecciona tu método de pago</h2>
                  </div>
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
                              ? "border-primary bg-accent ring-2 ring-primary"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold">{m.name}</p>
                            {active && <CheckCircle2 className="size-4 text-primary shrink-0" />}
                          </div>
                          {m.instructions && (
                            <p className="mt-1 text-xs text-muted-foreground">{m.instructions}</p>
                          )}
                        </button>
                      );
                    })}
                    {(methods ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No hay métodos de pago disponibles en este momento.
                      </p>
                    )}
                  </div>

                  {activeMethod && Object.keys(activeMethod.details ?? {}).length > 0 && (
                    <dl className="mt-4 grid gap-2 rounded-xl border border-border bg-surface-2/50 p-4 text-sm">
                      {Object.entries(activeMethod.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-4">
                          <dt className="capitalize text-muted-foreground">{key}</dt>
                          <dd className="text-right font-semibold break-all">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </section>

                <section className="surface-card p-5 border-2 border-primary/30">
                  <div className="flex items-center gap-2">
                    <Upload className="size-5 text-primary" />
                    <h2 className="text-display text-lg font-bold">Comprobante de pago</h2>
                  </div>
                  <p className="mt-1 text-xs font-bold text-foreground">
                    Para confirmar tu pedido es obligatorio subir el comprobante de pago.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Una vez realizado el pago, sube aquí la captura o comprobante de la
                    transferencia.
                  </p>

                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Número de referencia bancaria / hash (opcional)
                      </span>
                      <Input
                        className="mt-1.5 h-12 font-mono text-base"
                        value={reference}
                        placeholder="Ej: 12345678"
                        inputMode="numeric"
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </label>

                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        Captura o recibo de pago (JPG, PNG, WEBP o PDF) *
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
                            ) as HTMLInputElement | null;
                            input?.click();
                          }}
                        >
                          <input
                            id="checkout-proof-file"
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                          />
                          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                            <Upload className="size-6" />
                          </div>
                          <p className="text-xs font-bold text-foreground">
                            Haz clic aquí o arrastra tu comprobante de pago
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Formatos: JPG, PNG, WEBP o PDF (máximo 5 MB)
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
                                  <span>Comprobante cargado correctamente</span>
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
                              className="h-9 px-2 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
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

                    <div
                      className={`rounded-lg border p-3 text-xs font-semibold ${
                        proofFile && selected
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {proofFile && selected
                        ? "✓ Comprobante recibido. Ya puedes continuar y confirmar tu pedido."
                        : !selected
                          ? "⚠️ Selecciona un método de pago para continuar."
                          : "⚠️ Debes subir el comprobante de pago para confirmar tu pedido."}
                    </div>
                  </div>
                </section>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button variant="outline" size="lg" onClick={() => goToStep(1)}>
                    <ArrowLeft className="size-4 mr-1" /> Volver a envío
                  </Button>
                  <Button
                    variant="hero"
                    size="lg"
                    disabled={!selected || !proofFile}
                    onClick={() => {
                      if (validatePayment()) goToStep(3);
                    }}
                  >
                    Continuar a revisión <ArrowRight className="size-4 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* ---------- PASO 3 ---------- */}
            {step === 3 && (
              <>
                <section className="surface-card p-5">
                  <h2 className="text-display text-lg font-bold">Productos</h2>
                  <div className="mt-3 divide-y divide-border">
                    {lineRows.map((l) => (
                      <div key={l.key} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{l.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Talla {l.size} · Cantidad {l.quantity} · {moneyExact(l.unit)} c/u
                          </p>
                        </div>
                        <span className="font-bold tabular-nums">{moneyExact(l.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="surface-card p-5">
                  <h2 className="text-display text-lg font-bold">Información de envío</h2>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    {[
                      ["Nombre", form.firstName],
                      ["Apellido", form.lastName],
                      ["Cédula", form.identityDocument],
                      ["Teléfono", form.whatsapp],
                      ["Estado", form.state],
                      ["Ciudad", form.city],
                      ["Agencia", shippingMethod],
                      ["Dirección de la agencia", form.address],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-3 sm:block">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="font-semibold text-right sm:text-left break-words">
                          {value || "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {form.notes.trim() && (
                    <p className="mt-3 rounded-lg border border-border bg-surface-2/60 p-3 text-xs text-muted-foreground">
                      <strong className="text-foreground">Nota: </strong>
                      {form.notes}
                    </p>
                  )}
                </section>

                <section className="surface-card p-5">
                  <h2 className="text-display text-lg font-bold">Pago</h2>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Método de pago</span>
                      <span className="font-semibold">{activeMethod?.name ?? selected}</span>
                    </div>
                    {reference.trim() && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Referencia</span>
                        <span className="font-mono font-semibold">{reference}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Comprobante</span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-4" />
                        {proofFile ? "Cargado" : "Pendiente"}
                      </span>
                    </div>
                    {proofPreview && (
                      <img
                        src={proofPreview}
                        alt="Comprobante cargado"
                        className="mt-2 max-h-48 rounded-lg border border-border object-contain"
                      />
                    )}
                  </div>
                  <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3">
                    <span className="text-sm text-muted-foreground">Total a pagar</span>
                    <span className="text-display text-2xl text-primary tabular-nums">
                      {moneyExact(activeSubtotal)}
                    </span>
                  </div>
                </section>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button variant="outline" size="lg" onClick={() => goToStep(2)} disabled={saving}>
                    <ArrowLeft className="size-4 mr-1" /> Volver y editar
                  </Button>
                  <Button
                    variant="hero"
                    size="lg"
                    disabled={saving || !proofFile || !selected}
                    onClick={submit}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="size-5 animate-spin mr-2" />
                        Procesando pedido...
                      </>
                    ) : (
                      <>
                        Confirmar pedido <ArrowRight className="size-5 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>

          {summary}
        </div>
      </div>
    </SiteLayout>
  );
}
