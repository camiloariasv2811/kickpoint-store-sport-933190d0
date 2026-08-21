import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Search,
  Eye,
  Package,
  CheckCircle,
  Clock,
  Truck,
  MessageCircle,
  AlertCircle,
  FileText,
  Loader2,
  ExternalLink,
  Trash2,
  XCircle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listOrders,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  getProofUrl,
  type AdminOrder,
} from "@/lib/orders.functions";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/lib/types";
import { moneyExact, whatsappLink } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  component: AdminPedidos,
});

function AdminPedidos() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [loadingProof, setLoadingProof] = useState(false);

  const { data: orders = [], isLoading } = useQuery<AdminOrder[]>({
    queryKey: ["admin", "orders"],
    queryFn: () => listOrders(),
  });

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.order_number.toLowerCase().includes(q.toLowerCase()) ||
      (o.customer?.first_name && o.customer.first_name.toLowerCase().includes(q.toLowerCase())) ||
      (o.customer?.whatsapp && o.customer.whatsapp.includes(q));

    const matchesStatus = statusFilter === "todos" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const counts = {
    todos: orders.length,
    pago_pendiente: orders.filter((o) => o.status === "pago_pendiente").length,
    pago_verificado: orders.filter((o) => o.status === "pago_verificado").length,
    preparando_pedido: orders.filter((o) => o.status === "preparando_pedido").length,
    pedido_enviado: orders.filter((o) => o.status === "pedido_enviado").length,
  };

  async function handleStatusChange(orderId: string, newStatus: string) {
    setChangingStatus(true);
    try {
      await updateOrderStatus({ data: { orderId, status: newStatus } });
      toast.success("Estado del pedido actualizado", {
        description: ORDER_STATUS_LABELS[newStatus] ?? newStatus,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message || "No se pudo actualizar el estado"}`);
    } finally {
      setChangingStatus(false);
    }
  }

  async function handleCancelOrder(order: AdminOrder) {
    if (
      !window.confirm(
        `¿Estás seguro de cancelar el pedido ${order.order_number}? El inventario será reintegrado si ya había sido descontado.`,
      )
    ) {
      return;
    }
    setCanceling(true);
    try {
      await cancelOrder({ data: { orderId: order.id, reason: "Cancelación desde panel admin" } });
      toast.success(`Pedido ${order.order_number} cancelado`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      setSelectedOrder(null);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setCanceling(false);
    }
  }

  async function handleDeleteOrder(order: AdminOrder) {
    if (
      !window.confirm(
        `¡Atención! ¿Deseas eliminar permanentemente el pedido ${order.order_number}? Esta acción borrará sus pagos y detalles asociados.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteOrder({ data: { orderId: order.id, restoreStock: true } });
      toast.success(`Pedido ${order.order_number} eliminado correctamente`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      setSelectedOrder(null);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminShell
      title="Pedidos"
      subtitle="Gestión de pedidos online, comprobantes y logística de despacho"
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar pedido, cliente, WhatsApp..."
              className="h-9 w-60 pl-9"
            />
          </div>
        </div>
      }
    >
      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 pb-2">
        <button
          type="button"
          onClick={() => setStatusFilter("todos")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            statusFilter === "todos"
              ? "bg-primary text-primary-foreground"
              : "bg-surface-2 text-muted-foreground hover:text-foreground"
          }`}
        >
          Todos ({counts.todos})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("pago_pendiente")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            statusFilter === "pago_pendiente"
              ? "bg-amber-500 text-white"
              : "bg-surface-2 text-muted-foreground hover:text-foreground"
          }`}
        >
          Pago Pendiente ({counts.pago_pendiente})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("pago_verificado")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            statusFilter === "pago_verificado"
              ? "bg-emerald-600 text-white"
              : "bg-surface-2 text-muted-foreground hover:text-foreground"
          }`}
        >
          Pago Verificado ({counts.pago_verificado})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("preparando_pedido")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            statusFilter === "preparando_pedido"
              ? "bg-blue-600 text-white"
              : "bg-surface-2 text-muted-foreground hover:text-foreground"
          }`}
        >
          En Preparación ({counts.preparando_pedido})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("pedido_enviado")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            statusFilter === "pedido_enviado"
              ? "bg-purple-600 text-white"
              : "bg-surface-2 text-muted-foreground hover:text-foreground"
          }`}
        >
          Enviados ({counts.pedido_enviado})
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
                <th className="px-4 py-3">Ciudad</th>
                <th className="px-4 py-3">Método / Pago</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Package className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                    No hay pedidos que coincidan con el filtro.
                  </td>
                </tr>
              )}
              {filteredOrders.map((o) => {
                const latestPayment = o.payments?.[o.payments.length - 1];
                const hasProof = Boolean(latestPayment?.proof_url);

                return (
                  <tr key={o.id} className="transition-colors hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {o.order_number}
                      </span>
                      {o.is_wholesale && (
                        <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                          Mayorista
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">
                        {o.customer?.first_name} {o.customer?.last_name ?? ""}
                      </p>
                      {o.customer?.whatsapp && (
                        <p className="text-xs text-muted-foreground">{o.customer.whatsapp}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {o.customer?.city ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {o.payment_method_code ?? "—"}
                      </span>
                      {hasProof && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1 py-0.5 text-[10px] font-semibold text-emerald-600">
                          <FileText className="size-3" /> Comprobante
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary">{moneyExact(o.total)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                          o.status === "pago_verificado"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : o.status === "pedido_enviado"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                              : o.status === "preparando_pedido" || o.status === "empacando_pedido"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {ORDER_STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("es-VE", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedOrder(o)}
                          className="h-8 gap-1 text-xs"
                        >
                          <Eye className="size-3.5" /> Detalle
                        </Button>
                        {o.customer?.whatsapp && (
                          <Button
                            size="sm"
                            variant="ghost"
                            asChild
                            className="size-8 p-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
                          >
                            <a
                              href={whatsappLink(
                                `Hola ${o.customer.first_name}, te escribimos de KICKPOINT respecto a tu pedido ${o.order_number}.`,
                                o.customer.whatsapp,
                              )}
                              target="_blank"
                              rel="noreferrer"
                              title="Chat de WhatsApp"
                            >
                              <MessageCircle className="size-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle del Pedido Modal */}
      <Dialog open={Boolean(selectedOrder)} onOpenChange={(v) => !v && setSelectedOrder(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="font-mono text-xl">
                    Pedido {selectedOrder.order_number}
                  </DialogTitle>
                  <span className="text-xs text-muted-foreground">
                    {new Date(selectedOrder.created_at).toLocaleString("es-VE")}
                  </span>
                </div>
                <DialogDescription>
                  Detalles de entrega, productos solicitados y gestión del estado.
                </DialogDescription>
              </DialogHeader>

              {/* Cambiar Estado */}
              <div className="my-2 rounded-xl border border-border bg-surface-2 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Estado Actual
                    </p>
                    <p className="text-sm font-bold text-foreground">
                      {ORDER_STATUS_LABELS[selectedOrder.status] ?? selectedOrder.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedOrder.status}
                      disabled={changingStatus}
                      onValueChange={(newSt) => handleStatusChange(selectedOrder.id, newSt)}
                    >
                      <SelectTrigger className="h-9 w-48 text-xs font-semibold">
                        <SelectValue placeholder="Cambiar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map((st) => (
                          <SelectItem key={st} value={st}>
                            {ORDER_STATUS_LABELS[st]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Datos de Entrega */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-3 text-xs">
                  <p className="font-semibold uppercase text-muted-foreground">Cliente</p>
                  <p className="mt-1 text-sm font-bold">
                    {selectedOrder.customer?.first_name} {selectedOrder.customer?.last_name ?? ""}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    WhatsApp: {selectedOrder.customer?.whatsapp ?? "—"}
                  </p>
                  {selectedOrder.customer?.email && (
                    <p className="text-muted-foreground">Email: {selectedOrder.customer.email}</p>
                  )}
                </div>

                <div className="rounded-xl border border-border p-3 text-xs">
                  <p className="font-semibold uppercase text-muted-foreground">Dirección</p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedOrder.customer?.address ?? "Sin dirección especificada"}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {selectedOrder.customer?.city ?? ""}{" "}
                    {selectedOrder.customer?.state ? `· ${selectedOrder.customer.state}` : ""}
                  </p>
                  {selectedOrder.notes && (
                    <p className="mt-1 text-amber-600 dark:text-amber-400">
                      Nota: {selectedOrder.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Productos */}
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Productos del Pedido
                </p>
                <div className="mt-2 divide-y divide-border">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            className="size-9 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <div className="flex size-9 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground">
                            <Package className="size-4" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-foreground">{item.product_name}</p>
                          <p className="text-muted-foreground">
                            Talla: {item.size ?? "Única"}{" "}
                            {item.color ? `· Color: ${item.color}` : ""} × {item.quantity}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">{moneyExact(item.subtotal)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {moneyExact(item.unit_price)} c/u
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
                  <span className="text-xs font-semibold text-muted-foreground">Total Pedido</span>
                  <span className="text-base font-bold text-primary">
                    {moneyExact(selectedOrder.total)}
                  </span>
                </div>
              </div>

              {/* Pagos y Comprobante */}
              {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Información del Pago
                  </p>
                  {selectedOrder.payments.map((p) => (
                    <div key={p.id} className="mt-2 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold capitalize text-foreground">
                          Método: {p.method_code ?? "—"} · Monto: {moneyExact(p.amount)}
                        </p>
                        {p.reference && (
                          <p className="text-muted-foreground">Referencia: {p.reference}</p>
                        )}
                        <p className="text-muted-foreground">Estado: {p.status}</p>
                      </div>
                      {p.proof_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs"
                          onClick={() => viewProof(p.proof_url!)}
                          disabled={loadingProof}
                        >
                          {loadingProof ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <FileText className="size-3.5" />
                          )}
                          Ver Comprobante
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Vista Previa Comprobante */}
              {proofUrl && (
                <div className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Comprobante Cargado
                    </p>
                    <a
                      href={proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Abrir original <ExternalLink className="size-3" />
                    </a>
                  </div>
                  <div className="mt-2 overflow-hidden rounded-lg border border-border bg-surface-2">
                    <img
                      src={proofUrl}
                      alt="Comprobante de pago"
                      className="max-h-80 w-full object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Botones de Acción Crítica: Cancelar / Eliminar Orden */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                {selectedOrder.status !== "cancelado" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 gap-1 text-xs"
                    onClick={() => handleCancelOrder(selectedOrder)}
                    disabled={canceling || deleting}
                  >
                    <XCircle className="size-4" />
                    {canceling ? "Cancelando..." : "Cancelar Pedido (Reintegrar Stock)"}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground italic">
                    Este pedido se encuentra cancelado.
                  </span>
                )}

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => handleDeleteOrder(selectedOrder)}
                  disabled={canceling || deleting}
                >
                  <Trash2 className="size-4" />
                  {deleting ? "Eliminando..." : "Eliminar Definitivamente"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
