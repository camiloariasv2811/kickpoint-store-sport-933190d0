import { createFileRoute } from "@tanstack/react-router";
import {
  PackageSearch,
  CheckCircle,
  Clock,
  Truck,
  Upload,
  FileText,
  AlertCircle,
  Loader2,
  Package,
  MessageCircle,
  Copy,
  CreditCard,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/lib/types";
import { getOrderByNumber, uploadPaymentProof, type PublicOrder } from "@/lib/checkout.functions";
import { moneyExact, whatsappLink } from "@/lib/format";

export const Route = createFileRoute("/pedido")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" && search.code.trim() ? search.code.trim() : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Consultar mi pedido | KICKPOINT" },
      {
        name: "description",
        content:
          "Consulta el estado y seguimiento en tiempo real de tu pedido KICKPOINT con tu número de orden.",
      },
    ],
  }),
  component: PedidoPage,
});

function PedidoPage() {
  const searchParams = Route.useSearch();
  const [code, setCode] = useState(searchParams.code || "");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [searched, setSearched] = useState(false);

  // Proof Upload Form
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function performSearch(orderNum: string) {
    const clean = orderNum.trim().toUpperCase();
    if (!clean) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await getOrderByNumber({ data: { orderNumber: clean } });
      setOrder(res);
      if (!res) {
        toast.error("No encontramos ningún pedido con ese número.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Error al buscar el pedido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (searchParams.code) {
      setCode(searchParams.code);
      performSearch(searchParams.code);
    }
  }, [searchParams.code]);

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    performSearch(code);
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  }

  async function handleUploadProof(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !order) {
      toast.error("Por favor selecciona una foto o archivo de tu comprobante.");
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          await uploadPaymentProof({
            data: {
              orderNumber: order.order_number,
              reference: reference.trim(),
              fileName: file.name,
              contentType: file.type,
              dataBase64: base64,
            },
          });
          toast.success("¡Comprobante enviado exitosamente!", {
            description: "Nuestro equipo verificará tu pago a la brevedad.",
          });
          // Refresh order status
          const updated = await getOrderByNumber({ data: { orderNumber: order.order_number } });
          setOrder(updated);
          setFile(null);
          setReference("");
        } catch (err: any) {
          toast.error(`Error: ${err.message || "No se pudo subir"}`);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(err.message);
      setUploading(false);
    }
  }

  // Get index of current status for progress bar
  const currentStatusIndex = order ? ORDER_STATUSES.indexOf(order.status as any) : -1;

  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-eyebrow text-primary">Seguimiento en Vivo</p>
        <h1 className="text-display text-3xl sm:text-4xl">Consulta tu pedido</h1>
        <p className="mt-2 text-muted-foreground">
          Ingresa el código de orden que recibiste al completar tu compra (ej:{" "}
          <strong className="text-foreground font-mono">KP-2026-000001</strong>).
        </p>

        {/* Search Bar */}
        <form
          onSubmit={handleSearch}
          className="surface-card mt-6 flex flex-col gap-3 p-4 sm:flex-row"
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="KP-2026-000001"
            className="h-12 font-mono text-base tracking-wider"
          />
          <Button variant="hero" size="lg" type="submit" disabled={loading || !code.trim()}>
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <PackageSearch className="size-5" />
            )}
            Consultar
          </Button>
        </form>

        {/* Not Found */}
        {searched && !loading && !order && (
          <div className="surface-card mt-6 p-8 text-center text-muted-foreground">
            <AlertCircle className="mx-auto mb-2 size-8 text-amber-500" />
            <p className="font-semibold text-foreground">Pedido no encontrado</p>
            <p className="text-xs mt-1">
              Verifica que el número esté escrito correctamente con el formato KP-AÑO-NÚMERO.
            </p>
          </div>
        )}

        {/* Order Details & Progress Timeline */}
        {order && (
          <div className="mt-8 space-y-6">
            {/* Header info */}
            <div className="surface-card p-6">
              <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
                <div>
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Estado del Pedido
                  </span>
                  <h2 className="text-display text-2xl font-bold text-foreground">
                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                  </h2>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">
                    Orden {order.order_number} · Realizada el{" "}
                    {new Date(order.created_at).toLocaleDateString("es-VE")}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <p className="text-display text-2xl text-primary">{moneyExact(order.total)}</p>
                </div>
              </div>

              {/* Shipping & Rate Notes */}
              {order.notes && (
                <div className="mt-4 rounded-lg bg-surface-2/80 p-3 text-xs border border-border">
                  <span className="font-semibold text-foreground">
                    Detalles de Entrega y Cotización:
                  </span>
                  <p className="mt-1 text-muted-foreground">{order.notes}</p>
                </div>
              )}

              {/* Status Timeline */}
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-4">
                  Progreso del Envío
                </p>
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {ORDER_STATUSES.filter((s) => s !== "cancelado").map((statusKey, idx) => {
                    const isCompleted = currentStatusIndex >= 0 && idx <= currentStatusIndex;
                    const isCurrent = idx === currentStatusIndex;

                    return (
                      <div
                        key={statusKey}
                        className="flex items-center gap-3 sm:flex-col sm:items-center sm:text-center"
                      >
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                            isCurrent
                              ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110"
                              : isCompleted
                                ? "bg-emerald-600 text-white"
                                : "border border-border bg-surface-2 text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? <CheckCircle className="size-4" /> : idx + 1}
                        </div>
                        <p
                          className={`text-xs font-medium ${
                            isCurrent
                              ? "font-bold text-primary"
                              : isCompleted
                                ? "text-foreground"
                                : "text-muted-foreground"
                          }`}
                        >
                          {ORDER_STATUS_LABELS[statusKey]}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Subir Comprobante de Pago (Si está pendiente o fue rechazado) */}
            {(!order.proof_uploaded || order.payment_status === "rechazado") && (
              <div className="surface-card p-6 border-2 border-primary/30">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <Upload className="size-5 text-primary" />
                  <h3 className="text-display text-lg font-bold">Cargar Comprobante de Pago</h3>
                </div>

                {order.rejection_reason && (
                  <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                    <p className="font-bold">Comprobante anterior rechazado:</p>
                    <p>{order.rejection_reason}</p>
                    <p className="mt-1 font-medium">
                      Por favor carga un nuevo comprobante legible.
                    </p>
                  </div>
                )}

                <form onSubmit={handleUploadProof} className="mt-4 space-y-4 text-xs">
                  <div>
                    <Label htmlFor="pay-ref">Número de Referencia Bancaria / Hash</Label>
                    <Input
                      id="pay-ref"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Ej: 12345678"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="pay-file">Captura de pantalla o recibo (JPG, PNG, PDF)</Label>
                    <Input
                      id="pay-file"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="mt-1 cursor-pointer"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="hero"
                    className="w-full gap-2"
                    disabled={uploading || !file}
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    Enviar Comprobante
                  </Button>
                </form>
              </div>
            )}

            {/* Comprobante ya enviado */}
            {order.proof_uploaded && order.payment_status !== "rechazado" && (
              <div className="surface-card flex items-center gap-3 p-4 bg-emerald-500/5 border-emerald-500/20 text-xs">
                <CheckCircle className="size-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Comprobante recibido
                  </p>
                  <p className="text-muted-foreground">
                    Estado del pago: <strong className="capitalize">{order.payment_status}</strong>.
                    Estamos verificando la transacción.
                  </p>
                </div>
              </div>
            )}

            {/* Order Items List */}
            <div className="surface-card p-6">
              <h3 className="text-display text-base font-bold mb-4">Productos en este pedido</h3>
              <div className="divide-y divide-border">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3 text-xs">
                    <div className="flex items-center gap-3">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.product_name}
                          className="size-12 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted-foreground">
                          <Package className="size-5" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-foreground text-sm">{item.product_name}</p>
                        <p className="text-muted-foreground">
                          Talla: {item.size ?? "Única"} {item.color ? `· Color: ${item.color}` : ""}{" "}
                          × {item.quantity}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{moneyExact(item.subtotal)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {moneyExact(item.unit_price)} c/u
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp Help */}
        <div className="mt-8 surface-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p className="text-muted-foreground">¿Tienes alguna duda sobre tu entrega o despacho?</p>
          <a
            href={whatsappLink(`Hola KICKPOINT, tengo una consulta sobre mi pedido ${code || ""}.`)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white transition-colors hover:bg-emerald-700"
          >
            <MessageCircle className="size-4" />
            Contactar por WhatsApp
          </a>
        </div>
      </div>
    </SiteLayout>
  );
}
