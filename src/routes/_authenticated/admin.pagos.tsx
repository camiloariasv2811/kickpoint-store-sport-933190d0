import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  X,
  Eye,
  FileText,
  Search,
  MessageCircle,
  ExternalLink,
  Loader2,
  ShieldCheck,
  AlertTriangle,
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
  DialogFooter,
} from "@/components/ui/dialog";
import { listOrders, reviewPayment, getProofUrl, type AdminOrder } from "@/lib/orders.functions";
import { moneyExact, whatsappLink } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/pagos")({
  component: AdminPagos,
});

type FlatPayment = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerWhatsapp: string | null;
  methodCode: string | null;
  amount: number;
  status: string;
  reference: string | null;
  proofUrl: string | null;
  proofUploadedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  orderTotal: number;
};

function AdminPagos() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"pendiente" | "verificado" | "rechazado" | "todos">("pendiente");

  const [inspectPayment, setInspectPayment] = useState<FlatPayment | null>(null);
  const [inspectProofUrl, setInspectProofUrl] = useState<string | null>(null);
  const [loadingInspectProof, setLoadingInspectProof] = useState(false);

  const [rejectingPayment, setRejectingPayment] = useState<FlatPayment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const { data: orders = [], isLoading } = useQuery<AdminOrder[]>({
    queryKey: ["admin", "orders"],
    staleTime: 1000 * 20,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      try {
        const res = await listOrders();
        return (res ?? []) as AdminOrder[];
      } catch (err) {
        console.warn("[AdminPagos] Error fetching orders:", err);
        return [] as AdminOrder[];
      }
    },
  });

  // Flatten payments with order context
  const payments: FlatPayment[] = orders.flatMap((o) =>
    (o.payments ?? []).map((p) => ({
      paymentId: p.id,
      orderId: o.id,
      orderNumber: o.order_number,
      customerName:
        `${o.customer?.first_name ?? ""} ${o.customer?.last_name ?? ""}`.trim() || "Cliente",
      customerWhatsapp: o.customer?.whatsapp ?? null,
      methodCode: p.method_code ?? o.payment_method_code,
      amount: Number(p.amount || o.total),
      status: p.status,
      reference: p.reference,
      proofUrl: p.proof_url,
      proofUploadedAt: p.proof_uploaded_at,
      rejectionReason: p.rejection_reason,
      createdAt: p.created_at,
      orderTotal: Number(o.total),
    })),
  );

  const filtered = payments.filter((p) => {
    const matchesSearch =
      p.orderNumber.toLowerCase().includes(q.toLowerCase()) ||
      p.customerName.toLowerCase().includes(q.toLowerCase()) ||
      (p.reference && p.reference.toLowerCase().includes(q.toLowerCase()));

    const matchesTab = tab === "todos" ? true : p.status === tab;
    return matchesSearch && matchesTab;
  });

  const pendingCount = payments.filter((p) => p.status === "pendiente").length;
  const verifiedCount = payments.filter((p) => p.status === "verificado").length;
  const rejectedCount = payments.filter((p) => p.status === "rechazado").length;

  function applyLocalPaymentStatus(paymentId: string, status: string, reason?: string) {
    queryClient.setQueryData<AdminOrder[]>(["admin", "orders"], (prev) =>
      (prev ?? []).map((o) => ({
        ...o,
        payments: (o.payments ?? []).map((p) =>
          p.id === paymentId
            ? { ...p, status, rejection_reason: reason ?? p.rejection_reason }
            : p,
        ),
      })),
    );
  }

  async function handleApprove(payment: FlatPayment) {
    setProcessing(true);
    try {
      await reviewPayment({ data: { paymentId: payment.paymentId, approve: true } });
      applyLocalPaymentStatus(payment.paymentId, "verificado");
      toast.success("Pago verificado exitosamente", {
        description: `Pedido ${payment.orderNumber} actualizado e inventario descontado.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "pending-badges"] });
      setInspectPayment(null);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al verificar pago: ${err.message || "Error desconocido"}`);
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!rejectingPayment) return;
    setProcessing(true);
    const reason = rejectReason.trim() || "Comprobante no válido o no coincide con el monto.";
    try {
      await reviewPayment({
        data: {
          paymentId: rejectingPayment.paymentId,
          approve: false,
          reason,
        },
      });
      applyLocalPaymentStatus(rejectingPayment.paymentId, "rechazado", reason);
      toast.success("Pago rechazado", {
        description: `Se notificó en el estado del pedido ${rejectingPayment.orderNumber}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "pending-badges"] });
      setRejectingPayment(null);
      setInspectPayment(null);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al rechazar: ${err.message || "Error desconocido"}`);
    } finally {
      setProcessing(false);
    }
  }

  async function openInspect(payment: FlatPayment) {
    setInspectPayment(payment);
    setInspectProofUrl(null);
    if (payment.proofUrl) {
      setLoadingInspectProof(true);
      try {
        const res = await getProofUrl({ data: { path: payment.proofUrl } });
        setInspectProofUrl(res.url);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoadingInspectProof(false);
      }
    }
  }

  return (
    <AdminShell
      title="Pagos"
      subtitle="Bandeja de verificación de Pago Móvil, USDT, transferencias y comprobantes"
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por pedido, referencia, cliente..."
              className="h-9 w-60 pl-9"
            />
          </div>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 pb-2">
        <button
          type="button"
          onClick={() => setTab("pendiente")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === "pendiente"
              ? "bg-amber-500 text-white"
              : "bg-surface-2 text-muted-foreground hover:text-foreground"
          }`}
        >
          Por Verificar ({pendingCount})
        </button>
        <button
          type="button"
          onClick={() => setTab("verificado")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === "verificado"
              ? "bg-emerald-600 text-white"
              : "bg-surface-2 text-muted-foreground hover:text-foreground"
          }`}
        >
          Verificados ({verifiedCount})
        </button>
        <button
          type="button"
          onClick={() => setTab("rechazado")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === "rechazado"
              ? "bg-rose-600 text-white"
              : "bg-surface-2 text-muted-foreground hover:text-foreground"
          }`}
        >
          Rechazados ({rejectedCount})
        </button>
        <button
          type="button"
          onClick={() => setTab("todos")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === "todos"
              ? "bg-primary text-primary-foreground"
              : "bg-surface-2 text-muted-foreground hover:text-foreground"
          }`}
        >
          Todos ({payments.length})
        </button>
      </div>

      {isLoading && <Skeleton className="h-64 w-full rounded-xl" />}

      {!isLoading && (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">Referencia</th>
                <th className="px-4 py-3">Comprobante</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <ShieldCheck className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                    No hay pagos en esta sección.
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.paymentId} className="transition-colors hover:bg-surface-2/60">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">
                    {p.orderNumber}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{p.customerName}</p>
                    {p.customerWhatsapp && (
                      <p className="text-xs text-muted-foreground">{p.customerWhatsapp}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-semibold uppercase text-muted-foreground">
                      {p.methodCode ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">{moneyExact(p.amount)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">
                    {p.reference ?? <span className="text-muted-foreground">Sin ref.</span>}
                  </td>
                  <td className="px-4 py-3">
                    {p.proofUrl ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openInspect(p)}
                        className="h-7 gap-1 text-xs"
                      >
                        <FileText className="size-3.5 text-primary" /> Ver Foto
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No cargado</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                        p.status === "verificado"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : p.status === "rechazado"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {p.status === "verificado"
                        ? "Verificado"
                        : p.status === "rechazado"
                          ? "Rechazado"
                          : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.status === "pendiente" && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(p)}
                            disabled={processing}
                            className="h-8 gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                          >
                            <Check className="size-3.5" /> Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setRejectingPayment(p);
                              setRejectReason("");
                            }}
                            disabled={processing}
                            className="h-8 gap-1 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                          >
                            <X className="size-3.5" /> Rechazar
                          </Button>
                        </>
                      )}
                      {p.customerWhatsapp && (
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                          className="size-8 p-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
                        >
                          <a
                            href={whatsappLink(
                              `Hola ${p.customerName}, te contactamos de KICKPOINT respecto al pago de tu pedido ${p.orderNumber}.`,
                              p.customerWhatsapp,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            title="Chat WhatsApp"
                          >
                            <MessageCircle className="size-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Comprobante Lightbox / Inspector */}
      <Dialog open={Boolean(inspectPayment)} onOpenChange={(v) => !v && setInspectPayment(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {inspectPayment && (
            <>
              <DialogHeader>
                <DialogTitle>Revisión de Pago - {inspectPayment.orderNumber}</DialogTitle>
                <DialogDescription>
                  Cliente: {inspectPayment.customerName} · Monto:{" "}
                  {moneyExact(inspectPayment.amount)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs">
                <div className="flex justify-between rounded-lg border border-border bg-surface-2 p-2.5">
                  <span className="text-muted-foreground">Referencia Bancaria:</span>
                  <span className="font-mono font-bold text-foreground">
                    {inspectPayment.reference ?? "Sin referencia"}
                  </span>
                </div>

                {loadingInspectProof && (
                  <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-surface-2">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!loadingInspectProof && inspectProofUrl && (
                  <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
                    <img
                      src={inspectProofUrl}
                      alt="Comprobante"
                      className="max-h-96 w-full object-contain"
                    />
                  </div>
                )}

                {!loadingInspectProof && !inspectProofUrl && (
                  <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted-foreground">
                    No se encontró la imagen del comprobante.
                  </div>
                )}

                {inspectPayment.rejectionReason && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-rose-600 dark:text-rose-400">
                    <p className="font-semibold">Motivo del rechazo:</p>
                    <p>{inspectPayment.rejectionReason}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                {inspectPayment.status === "pendiente" && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setRejectingPayment(inspectPayment);
                        setRejectReason("");
                      }}
                      disabled={processing}
                    >
                      Rechazar
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleApprove(inspectPayment)}
                      disabled={processing}
                    >
                      {processing ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                      Aprobar y Descontar Stock
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Rechazar Modal */}
      <Dialog
        open={Boolean(rejectingPayment)}
        onOpenChange={(v) => !v && setRejectingPayment(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar Comprobante</DialogTitle>
            <DialogDescription>
              Indica la razón del rechazo para que el cliente pueda corregir o subir un nuevo
              comprobante.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="block text-xs font-semibold text-muted-foreground">
              Motivo del rechazo
            </label>
            <Input
              className="mt-1.5"
              placeholder="Ej: Monto incompleto, referencia ilegible o no acreditada..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectingPayment(null)}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
