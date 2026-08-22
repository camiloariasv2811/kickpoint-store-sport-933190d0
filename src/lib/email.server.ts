// Server-side Email Notification Client (Resend) for KICKPOINT
// Handles email formatting, idempotency, delivery logging, and admin alerts.

import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import {
  addInMemoryEmailNotification,
  getInMemoryEmailNotifications,
  type InMemoryEmailNotification,
} from "./demo-data";

export const DEFAULT_ADMIN_EMAIL = "camiloariasv2811@gmail.com";
export const DEFAULT_FROM_EMAIL = "KICKPOINT <onboarding@resend.dev>";

export function getAdminEmail(): string {
  const envEmail = process.env["ADMIN_NOTIFICATION_EMAIL"]?.trim();
  if (envEmail && envEmail.includes("@")) {
    return envEmail;
  }
  return DEFAULT_ADMIN_EMAIL;
}

export function getResendApiKey(): string {
  return (process.env["RESEND_API_KEY"] || process.env["VITE_RESEND_API_KEY"] || "").trim();
}

export function getResendFromEmail(): string {
  return (
    process.env["RESEND_FROM_EMAIL"] ||
    process.env["EMAIL_FROM"] ||
    DEFAULT_FROM_EMAIL
  ).trim();
}

export function isResendConfigured(): boolean {
  const key = getResendApiKey();
  return Boolean(key && key.startsWith("re_") && key.length > 8);
}

export function getPublicStoreUrl(): string {
  const url =
    process.env["KICKPOINT_PUBLIC_URL"] ||
    process.env["APP_URL"] ||
    process.env["SITE_URL"] ||
    process.env["PUBLIC_APP_URL"] ||
    process.env["VITE_APP_URL"] ||
    "https://kickpoint-store-sport-933190d0.lovable.app";
  return url.replace(/\/+$/, "");
}

export type EmailEventType =
  | "order_created"
  | "payment_verified"
  | "preparando_pedido"
  | "empacando_pedido"
  | "pedido_enviado"
  | "pedido_entregado"
  | "pedido_cancelado"
  | "test_message";

export interface EmailNotificationPayload {
  eventType: EmailEventType;
  recipientEmail: string;
  recipientType: "admin" | "customer";
  orderId?: string | null;
  orderCode?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  total?: number | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  shippingCarrier?: string | null;
  trackingNumber?: string | null;
  customSubject?: string | null;
  customMessage?: string | null;
  metadata?: Record<string, any>;
}

export interface EmailSendResult {
  ok: boolean;
  status: "sent" | "pending" | "failed" | "already_sent";
  notificationId?: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  idempotencyKey: string;
}

/**
 * Builds the standard subject, HTML and plain-text body based on the business event.
 */
export function buildEmailMessage(payload: EmailNotificationPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const storeUrl = getPublicStoreUrl();
  const adminUrl = `${storeUrl}/admin/pedidos`;
  const orderCode = payload.orderCode || "N/A";
  const customerName = payload.customerName || "Cliente";
  const phone = payload.customerPhone || "No especificado";
  const customerEmail = payload.customerEmail || "No especificado";
  const totalStr =
    payload.total !== undefined && payload.total !== null
      ? `$${payload.total.toFixed(2)}`
      : "$0.00";
  const paymentMethod = payload.paymentMethod || "No especificado";
  const paymentRef = payload.paymentReference || "Pendiente de comprobante";

  switch (payload.eventType) {
    case "order_created": {
      const subject = payload.customSubject || `🚨 Nuevo pedido recibido — KICKPOINT`;
      const text =
        `KICKPOINT\n\n` +
        `🚨 TIENES UN NUEVO PEDIDO\n\n` +
        `Se ha recibido un nuevo pedido en KICKPOINT.\n\n` +
        `Información del pedido\n\n` +
        `Pedido: #${orderCode}\n` +
        `Cliente: ${customerName}\n` +
        `Teléfono: ${phone}\n` +
        `Correo: ${customerEmail}\n` +
        `Total: ${totalStr}\n` +
        `Método de pago: ${paymentMethod}\n` +
        `Referencia: ${paymentRef}\n` +
        `Estado: Pendiente de verificación\n\n` +
        `Verificar pedido:\n${adminUrl}\n\n` +
        `KICKPOINT Store System`;

      const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f17; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #131b2e; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px; border-bottom: 1px solid #1e293b; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 900; letter-spacing: 1.5px; color: #38bdf8; text-transform: uppercase;">⚡ KICKPOINT</span>
                    <span style="display: block; font-size: 12px; color: #94a3b8; margin-top: 2px; text-transform: uppercase; letter-spacing: 1px;">Notificación de Administración</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 11px; font-weight: 800; padding: 6px 12px; border-radius: 9999px; border: 1px solid rgba(239, 68, 68, 0.3); text-transform: uppercase; letter-spacing: 0.5px;">
                      🚨 TIENES UN NUEVO PEDIDO
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 800; color: #ffffff;">
                Se ha recibido un nuevo pedido en KICKPOINT.
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">
                Un cliente ha completado el checkout en la tienda KICKPOINT. Por favor revisa los detalles y valida el comprobante de pago.
              </p>

              <!-- Order Details Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f17; border: 1px solid #1e293b; border-radius: 10px; margin-bottom: 28px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Número de Pedido</td>
                        <td align="right" style="font-size: 15px; color: #38bdf8; font-weight: 800; font-family: monospace;">#${orderCode}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Cliente</td>
                        <td align="right" style="font-size: 14px; color: #f8fafc; font-weight: 700;">${customerName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Teléfono</td>
                        <td align="right" style="font-size: 14px; color: #f8fafc; font-family: monospace; font-weight: 600;">${phone}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Correo</td>
                        <td align="right" style="font-size: 14px; color: #f8fafc; font-weight: 600;">${customerEmail}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Método de Pago</td>
                        <td align="right" style="font-size: 14px; color: #f8fafc; font-weight: 600;">${paymentMethod}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Referencia de Pago</td>
                        <td align="right" style="font-size: 14px; color: #fbbf24; font-family: monospace; font-weight: 700;">${paymentRef}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Estado</td>
                        <td align="right">
                          <span style="font-size: 12px; color: #fbbf24; font-weight: 800; background: rgba(251, 191, 36, 0.15); padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(251, 191, 36, 0.3);">
                            Pendiente de verificación
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 20px; background-color: rgba(56, 189, 248, 0.08);">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 14px; color: #ffffff; font-weight: 800; text-transform: uppercase;">Total</td>
                        <td align="right" style="font-size: 20px; color: #38bdf8; font-weight: 900; font-family: monospace;">${totalStr}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${adminUrl}" target="_blank" style="display: inline-block; background-color: #38bdf8; color: #0b0f17; font-size: 15px; font-weight: 900; text-decoration: none; padding: 16px 40px; border-radius: 8px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 14px rgba(56, 189, 248, 0.4);">
                      VERIFICAR PEDIDO
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.4;">
                Enlace directo al panel: <a href="${adminUrl}" style="color: #38bdf8; text-decoration: underline;">${adminUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 20px 32px; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                Mensaje administrativo de KICKPOINT Store. Destinatario: ${payload.recipientEmail}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
      return { subject, html, text };
    }

    case "test_message": {
      const subject = payload.customSubject || `🔔 KICKPOINT — Prueba de notificaciones`;
      const messageBody =
        payload.customMessage ||
        "El sistema de correo administrativo está funcionando correctamente.";
      const text =
        `KICKPOINT — Prueba de Notificaciones\n\n` +
        `${messageBody}\n\n` +
        `Destinatario: ${payload.recipientEmail}\n` +
        `Fecha y hora: ${new Date().toLocaleString("es-VE")}\n` +
        `Servidor: KICKPOINT TanStack Start / Supabase Engine\n\n` +
        `${storeUrl}`;

      const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f17; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #131b2e; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px; border-bottom: 1px solid #1e293b;">
              <span style="font-size: 20px; font-weight: 800; letter-spacing: 1.5px; color: #38bdf8; text-transform: uppercase;">⚡ KICKPOINT</span>
              <span style="display: block; font-size: 11px; color: #94a3b8; margin-top: 2px; text-transform: uppercase; letter-spacing: 1px;">Prueba de Notificación</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <div style="background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 15px; font-weight: 700; color: #4ade80;">
                  ✅ KICKPOINT — Prueba de notificaciones
                </p>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #cbd5e1;">
                  ${messageBody}
                </p>
              </div>

              <table width="100%" style="font-size: 13px; color: #94a3b8; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Destinatario:</td>
                  <td align="right" style="color: #f8fafc; font-family: monospace;">${payload.recipientEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Timestamp:</td>
                  <td align="right" style="color: #f8fafc; font-family: monospace;">${new Date().toISOString()}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Estado:</td>
                  <td align="right" style="color: #4ade80; font-weight: 600;">Verificado</td>
                </tr>
              </table>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${storeUrl}/admin" target="_blank" style="display: inline-block; background-color: #1e293b; color: #38bdf8; font-size: 13px; font-weight: 700; text-decoration: none; padding: 10px 24px; border-radius: 6px; border: 1px solid #38bdf8;">
                      Ir al Panel KICKPOINT
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
      return { subject, html, text };
    }

    default: {
      const subject =
        payload.customSubject || `🔔 KICKPOINT — Notificación de Pedido #${orderCode}`;
      const text =
        `KICKPOINT — Notificación de Pedido #${orderCode}\n\n` +
        `Cliente: ${customerName}\n` +
        `Total: ${totalStr}\n` +
        `${payload.customMessage || "Estado actualizado"}\n\n` +
        `${storeUrl}`;
      const html = `<p>${text.replace(/\n/g, "<br>")}</p>`;
      return { subject, html, text };
    }
  }
}

/**
 * Sends an email notification using Resend API with idempotency and audit tracking.
 * This function NEVER throws to protect the checkout / order creation flow.
 */
export async function sendEmailNotification(
  payload: EmailNotificationPayload,
): Promise<EmailSendResult> {
  const recipientEmail = payload.recipientEmail?.trim() || getAdminEmail();
  const apiKey = getResendApiKey();
  const fromEmail = getResendFromEmail();

  // Generate unique idempotency key adhering to new-order-admin-[ORDER_ID] standard
  const idempotencyKey =
    payload.metadata?.idempotencyKey ||
    (payload.eventType === "order_created"
      ? `new-order-admin-${payload.orderId || payload.orderCode || Date.now()}`
      : `email-${payload.eventType}-${payload.orderId || payload.orderCode || Date.now()}-${payload.recipientType}`);

  const { subject, html, text } = buildEmailMessage({
    ...payload,
    recipientEmail,
  });

  const isConfigured = isResendConfigured();

  // 1. Check idempotency in In-Memory / Supabase
  if (!isSupabaseServerConfigured()) {
    const existing = getInMemoryEmailNotifications().find(
      (n) => n.idempotency_key === idempotencyKey && n.status === "sent",
    );
    if (existing) {
      return {
        ok: true,
        status: "already_sent",
        notificationId: existing.id,
        providerMessageId: existing.provider_message_id,
        idempotencyKey,
      };
    }
  } else {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing } = await supabaseAdmin
        .from("email_notifications")
        .select("id, status, provider_message_id")
        .eq("idempotency_key", idempotencyKey)
        .eq("status", "sent")
        .maybeSingle();

      if (existing) {
        return {
          ok: true,
          status: "already_sent",
          notificationId: existing.id,
          providerMessageId: existing.provider_message_id,
          idempotencyKey,
        };
      }
    } catch {
      // Table might not exist yet or query failed; continue safely
    }
  }

  // 2. If Resend is NOT configured with an active API Key
  if (!isConfigured) {
    const pendingNotification: InMemoryEmailNotification = {
      id: `em-queued-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      event_type: payload.eventType,
      recipient_email: recipientEmail,
      recipient_type: payload.recipientType,
      subject,
      order_id: payload.orderId ?? null,
      order_code: payload.orderCode ?? null,
      status: "pending",
      provider_message_id: null,
      error_message: "RESEND_API_KEY no configurada. Notificación registrada en cola.",
      attempts: 0,
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString(),
    };

    addInMemoryEmailNotification(pendingNotification);

    if (isSupabaseServerConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("email_notifications").upsert(
          {
            event_type: payload.eventType,
            recipient_email: recipientEmail,
            recipient_type: payload.recipientType,
            order_id: payload.orderId ?? null,
            order_code: payload.orderCode ?? null,
            subject,
            body_html: html,
            status: "pending",
            error_message: "RESEND_API_KEY no configurada en las variables de entorno.",
            attempts: 0,
            idempotency_key: idempotencyKey,
            metadata: payload.metadata || {},
            created_at: new Date().toISOString(),
          },
          { onConflict: "idempotency_key" },
        );
      } catch {
        /* fallback */
      }
    }

    console.warn(
      `[Email Resend] Notification queued (${payload.eventType} -> ${recipientEmail}). Set RESEND_API_KEY to deliver real inbox emails.`,
    );

    return {
      ok: false,
      status: "pending",
      errorMessage: "RESEND_API_KEY no configurada. Notificación registrada en cola de auditoría.",
      idempotencyKey,
    };
  }

  // 3. Dispatch to Resend API endpoint
  let attempts = 0;
  let lastError: string | null = null;
  let providerMessageId: string | null = null;
  let isSuccess = false;

  for (let attempt = 1; attempt <= 2; attempt++) {
    attempts = attempt;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          "User-Agent": "KICKPOINT-Store/1.0",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipientEmail],
          subject,
          html,
          text,
          headers: {
            "X-Entity-Ref-ID": idempotencyKey,
          },
        }),
      });

      const resData = await response.json().catch(() => ({}));

      if (response.ok && (resData?.id || resData?.data?.id)) {
        isSuccess = true;
        providerMessageId = String(resData.id || resData?.data?.id);
        break;
      } else {
        lastError =
          resData?.message ||
          resData?.error?.message ||
          (typeof resData?.error === "string" ? resData.error : null) ||
          resData?.name ||
          `HTTP ${response.status}: ${response.statusText || "Resend dispatch rejected"}`;
      }
    } catch (err: any) {
      lastError = err.message || "Network timeout connecting to Resend API";
    }

    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  const status: "sent" | "failed" = isSuccess ? "sent" : "failed";
  const sentAt = isSuccess ? new Date().toISOString() : null;

  // 4. Log in In-Memory / Supabase
  const logRecord: InMemoryEmailNotification = {
    id: `em-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    event_type: payload.eventType,
    recipient_email: recipientEmail,
    recipient_type: payload.recipientType,
    subject,
    order_id: payload.orderId ?? null,
    order_code: payload.orderCode ?? null,
    status,
    provider_message_id: providerMessageId,
    error_message: isSuccess ? null : lastError,
    attempts,
    idempotency_key: idempotencyKey,
    created_at: new Date().toISOString(),
    sent_at: sentAt,
  };

  addInMemoryEmailNotification(logRecord);

  if (isSupabaseServerConfigured()) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("email_notifications").upsert(
        {
          event_type: payload.eventType,
          recipient_email: recipientEmail,
          recipient_type: payload.recipientType,
          order_id: payload.orderId ?? null,
          order_code: payload.orderCode ?? null,
          subject,
          body_html: html,
          status,
          provider_message_id: providerMessageId,
          error_message: isSuccess ? null : lastError,
          attempts,
          idempotency_key: idempotencyKey,
          metadata: payload.metadata || {},
          created_at: new Date().toISOString(),
          sent_at: sentAt,
        },
        { onConflict: "idempotency_key" },
      );
    } catch (dbErr) {
      console.warn("[Email Resend] Supabase audit log error:", dbErr);
    }
  }

  return {
    ok: isSuccess,
    status,
    providerMessageId,
    errorMessage: isSuccess ? null : lastError,
    idempotencyKey,
  };
}
