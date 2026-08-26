import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  dismissEmailAlert,
  getEmailDeliveryAlerts,
  notifyEmailAlertByWhatsApp,
  type EmailDeliveryAlert,
} from "@/lib/email-alerts.functions";

export const EMAIL_ALERTS_QUERY_KEY = ["admin", "email", "alerts"] as const;

export function useEmailDeliveryAlerts() {
  return useQuery({
    queryKey: EMAIL_ALERTS_QUERY_KEY,
    // Revisamos el estado real de entrega cada 2 minutos para actuar rápido.
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      try {
        const res = await getEmailDeliveryAlerts({ data: { reconcile: true, autoWhatsApp: true } });
        return res?.alerts ?? [];
      } catch {
        return [] as EmailDeliveryAlert[];
      }
    },
  });
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function EmailDeliveryAlerts({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const { data: alerts = [], isFetching, refetch } = useEmailDeliveryAlerts();

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissEmailAlert({ data: { id } }),
    onSuccess: () => {
      toast.success("Alerta marcada como resuelta");
      queryClient.invalidateQueries({ queryKey: EMAIL_ALERTS_QUERY_KEY });
    },
    onError: () => toast.error("No se pudo descartar la alerta"),
  });

  const notify = useMutation({
    mutationFn: (id: string) => notifyEmailAlertByWhatsApp({ data: { id } }),
    onSuccess: (res) => {
      if (res?.ok) toast.success("Aviso enviado por WhatsApp");
      else toast.error(res?.error || "No se pudo enviar el aviso por WhatsApp");
      queryClient.invalidateQueries({ queryKey: EMAIL_ALERTS_QUERY_KEY });
    },
    onError: () => toast.error("No se pudo enviar el aviso por WhatsApp"),
  });

  if (alerts.length === 0) {
    if (compact) return null;
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Sin rebotes ni reportes de spam en los últimos 14 días.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Revisar ahora
          </Button>
        </div>
      </div>
    );
  }

  const visible = compact ? alerts.slice(0, 3) : alerts;

  return (
    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-rose-200">
          <AlertTriangle className="size-5 shrink-0 animate-pulse" />
          <p className="text-sm font-bold">
            {alerts.length} {alerts.length === 1 ? "correo con problema de entrega" : "correos con problemas de entrega"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Revisar
          </Button>
          {compact && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/configuracion">Ver detalles</Link>
            </Button>
          )}
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {visible.map((alert) => (
          <li
            key={alert.id}
            className="rounded-lg border border-border/60 bg-background/70 p-3 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  alert.severity === "critical"
                    ? "bg-rose-500/20 text-rose-200"
                    : "bg-amber-500/20 text-amber-200"
                }`}
              >
                {alert.problem === "complained" ? "SPAM" : alert.problem}
              </span>
              <span className="font-semibold">{alert.problemLabel}</span>
              <span className="text-muted-foreground">· {formatDate(alert.createdAt)}</span>
            </div>
            <p className="mt-1 break-all text-muted-foreground">
              Destinatario: <span className="text-foreground">{alert.recipientEmail}</span>
              {alert.orderCode ? ` · Pedido ${alert.orderCode}` : ""}
            </p>
            <p className="mt-0.5 break-words text-muted-foreground">Asunto: {alert.subject}</p>
            {alert.errorMessage && (
              <p className="mt-0.5 break-words text-rose-300">{alert.errorMessage}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => notify.mutate(alert.id)}
                disabled={notify.isPending}
              >
                <MessageCircle className="size-4" />
                {alert.whatsappNotified ? "Reenviar por WhatsApp" : "Avisar por WhatsApp"}
              </Button>
              {alert.orderId && (
                <Button asChild size="sm" variant="ghost">
                  <Link to="/admin/pedidos">Ver pedidos</Link>
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dismiss.mutate(alert.id)}
                disabled={dismiss.isPending}
              >
                <Check className="size-4" /> Resuelto
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {compact && alerts.length > visible.length && (
        <p className="mt-2 text-xs text-muted-foreground">
          y {alerts.length - visible.length} más en Configuración.
        </p>
      )}
    </div>
  );
}
