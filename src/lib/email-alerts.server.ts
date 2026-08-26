// KICKPOINT - Detección de correos rebotados / marcados como spam.
// Reconcilia el estado real de entrega con el proveedor y genera alertas
// para el panel admin (y aviso opcional por WhatsApp).

import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import { fetchEmailDeliveryStatus, getAdminEmail } from "./email.server";
import { getAdminWhatsAppNumber, sendWhatsAppNotification } from "./whatsapp.server";

/** Eventos del proveedor que representan un problema de entrega real. */
export const PROBLEM_EVENTS = [
  "bounced",
  "complained",
  "failed",
  "delivery_delayed",
] as const;

/** Eventos finales: ya no hace falta volver a consultar al proveedor. */
const TERMINAL_EVENTS = ["delivered", "opened", "clicked", "bounced", "complained", "failed"];

export interface EmailDeliveryAlert {
  id: string;
  eventType: string;
  recipientEmail: string;
  orderCode: string | null;
  orderId: string | null;
  subject: string;
  /** bounced | complained (spam) | failed | delivery_delayed */
  problem: string;
  problemLabel: string;
  severity: "critical" | "warning";
  errorMessage: string | null;
  createdAt: string;
  whatsappNotified: boolean;
}

export function labelForProblem(problem: string): { label: string; severity: "critical" | "warning" } {
  switch (problem) {
    case "bounced":
      return { label: "Rebotado (dirección inválida o rechazada)", severity: "critical" };
    case "complained":
      return { label: "Marcado como SPAM por el destinatario", severity: "critical" };
    case "failed":
      return { label: "Fallo de envío en el proveedor", severity: "critical" };
    case "delivery_delayed":
      return { label: "Entrega retrasada (posible filtro de spam)", severity: "warning" };
    default:
      return { label: problem, severity: "warning" };
  }
}

function parseMetadata(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, any>;
    } catch {
      return {};
    }
  }
  return value as Record<string, any>;
}

function problemFromRow(row: any): string | null {
  const meta = parseMetadata(row.metadata);
  const event = String(meta.deliveryEvent || "").toLowerCase();
  if ((PROBLEM_EVENTS as readonly string[]).includes(event)) return event;
  if (row.status === "failed") return "failed";
  return null;
}

async function notifyByWhatsApp(row: any, problem: string): Promise<boolean> {
  const { label } = labelForProblem(problem);
  const message = [
    "🚨 KICKPOINT - ALERTA DE CORREO",
    "",
    `Problema: ${label}`,
    `Destinatario: ${row.recipient_email}`,
    row.order_code ? `Pedido: ${row.order_code}` : "",
    `Asunto: ${row.subject}`,
    "",
    "Revisa las alertas en el panel administrativo y contacta al cliente por WhatsApp si es necesario.",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await sendWhatsAppNotification({
    eventType: "email_delivery_alert",
    recipientPhone: getAdminWhatsAppNumber(),
    recipientType: "admin",
    orderId: row.order_id ?? null,
    orderCode: row.order_code ?? `EMAIL-${row.id}`,
    customMessage: message,
    metadata: { emailNotificationId: row.id, problem },
  });

  return res.ok || res.status === "already_sent";
}

async function markWhatsAppNotified(id: string, meta: Record<string, any>, notified: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("email_notifications")
    .update({ metadata: { ...meta, alertWhatsAppNotified: notified } as any })
    .eq("id", id);
}

/**
 * Consulta al proveedor el estado real de los correos recientes y actualiza la bitácora.
 * Devuelve la lista de alertas activas (rebotes / spam / fallos) sin descartar.
 */
export async function collectEmailDeliveryAlerts(options?: {
  reconcile?: boolean;
  autoWhatsApp?: boolean;
}): Promise<{ alerts: EmailDeliveryAlert[]; checked: number }> {
  if (!isSupabaseServerConfigured()) return { alerts: [], checked: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await supabaseAdmin
    .from("email_notifications")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(60);

  const list = Array.isArray(rows) ? rows : [];
  let checked = 0;

  if (options?.reconcile !== false) {
    // Solo revisamos los que tienen id de proveedor y aún no tienen estado final.
    const pending = list
      .filter((row: any) => {
        const meta = parseMetadata(row.metadata);
        const event = String(meta.deliveryEvent || "").toLowerCase();
        return Boolean(row.provider_message_id) && !TERMINAL_EVENTS.includes(event);
      })
      .slice(0, 15);

    for (const row of pending) {
      const check = await fetchEmailDeliveryStatus(row.provider_message_id as string);
      checked += 1;
      if (!check.ok || !check.lastEvent) continue;

      const event = String(check.lastEvent).toLowerCase();
      const meta = parseMetadata(row.metadata);
      if (String(meta.deliveryEvent || "").toLowerCase() === event) continue;

      const isProblem = (PROBLEM_EVENTS as readonly string[]).includes(event);
      const nextMeta = { ...meta, deliveryEvent: event, deliveryCheckedAt: new Date().toISOString() };
      const patch: Record<string, any> = { metadata: nextMeta };

      if (isProblem) {
        patch.status = event === "delivery_delayed" ? row.status : "failed";
        patch.error_message = `El proveedor reportó "${event}" para ${row.recipient_email}.`;
      }

      await supabaseAdmin.from("email_notifications").update(patch as any).eq("id", row.id);
      row.metadata = nextMeta;
      row.status = patch.status ?? row.status;
      row.error_message = patch.error_message ?? row.error_message;
    }
  }

  const alerts: EmailDeliveryAlert[] = [];

  for (const row of list) {
    const problem = problemFromRow(row);
    if (!problem) continue;
    const meta = parseMetadata(row.metadata);
    if (meta.alertDismissed) continue;

    const { label, severity } = labelForProblem(problem);
    let whatsappNotified = Boolean(meta.alertWhatsAppNotified);

    if (options?.autoWhatsApp && !whatsappNotified && severity === "critical") {
      try {
        const sent = await notifyByWhatsApp(row, problem);
        if (sent) {
          whatsappNotified = true;
          await markWhatsAppNotified(row.id, meta, true);
        }
      } catch (err) {
        console.warn("[EmailAlerts] No se pudo avisar por WhatsApp:", err);
      }
    }

    alerts.push({
      id: row.id,
      eventType: row.event_type,
      recipientEmail: row.recipient_email,
      orderCode: row.order_code ?? null,
      orderId: row.order_id ?? null,
      subject: row.subject,
      problem,
      problemLabel: label,
      severity,
      errorMessage: row.error_message ?? null,
      createdAt: row.created_at,
      whatsappNotified,
    });
  }

  return { alerts, checked };
}

export async function dismissEmailDeliveryAlert(id: string): Promise<boolean> {
  if (!isSupabaseServerConfigured()) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("email_notifications")
    .select("id, metadata")
    .eq("id", id)
    .maybeSingle();
  if (!row) return false;
  const meta = parseMetadata((row as any).metadata);
  const { error } = await supabaseAdmin
    .from("email_notifications")
    .update({
      metadata: { ...meta, alertDismissed: true, alertDismissedAt: new Date().toISOString() } as any,
    })
    .eq("id", id);
  return !error;
}

export async function sendAlertToAdminWhatsApp(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseServerConfigured()) return { ok: false, error: "Backend no configurado" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("email_notifications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Alerta no encontrada" };

  const problem = problemFromRow(row) || "failed";
  const meta = parseMetadata((row as any).metadata);
  try {
    const sent = await notifyByWhatsApp(row, problem);
    if (sent) await markWhatsAppNotified((row as any).id, meta, true);
    return sent ? { ok: true } : { ok: false, error: "WhatsApp no está configurado o falló el envío" };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error enviando WhatsApp" };
  }
}

export function getAlertsAdminEmail(): string {
  return getAdminEmail();
}
