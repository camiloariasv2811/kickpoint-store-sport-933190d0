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
  return (process.env["RESEND_API_KEY"] || "").trim();
}

export function getLovableApiKey(): string {
  return (process.env["LOVABLE_API_KEY"] || "").trim();
}

/** True when the Resend key is a direct provider key (re_...) instead of a gateway connection key. */
export function isDirectResendKey(): boolean {
  return getResendApiKey().startsWith("re_");
}

export const RESEND_GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export function getResendEndpoint(): string {
  return isDirectResendKey() ? "https://api.resend.com/emails" : `${RESEND_GATEWAY_URL}/emails`;
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
  if (!key || key.length < 8) return false;
  // Direct provider key works alone; gateway connection key also needs LOVABLE_API_KEY.
  return isDirectResendKey() ? true : Boolean(getLovableApiKey());
}

export function getPublicStoreUrl(): string {
  const url =
    process.env["KICKPOINT_PUBLIC_URL"] ||
    process.env["APP_URL"] ||
    process.env["SITE_URL"] ||
    process.env["PUBLIC_APP_URL"] ||
    process.env["VITE_APP_URL"] ||
    "https://kickpoint-store-sport.lovable.app";
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

export interface EmailOrderItem {
  productName: string;
  size?: string | null;
  color?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

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
  isWholesale?: boolean | null;
  orderType?: "retail" | "wholesale" | string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  shippingCarrier?: string | null;
  trackingNumber?: string | null;
  items?: EmailOrderItem[];
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

export function logRuntimeEmailConfig(): void {
  const hasResend = Boolean(getResendApiKey() && getResendApiKey().length >= 8);
  console.log(
    `[ORDER_EMAIL_CONFIG] Runtime variables check:\n` +
      `  - RESEND_API_KEY: ${hasResend ? "PRESENT" : "MISSING"}\n` +
      `  - ADMIN_NOTIFICATION_EMAIL: ${getAdminEmail()}\n` +
      `  - RESEND_FROM_EMAIL: ${getResendFromEmail()}\n` +
      `  - KICKPOINT_PUBLIC_URL: ${getPublicStoreUrl()}`,
  );
}

function formatPaymentMethodLabel(code?: string | null): string {
  if (!code) return "No especificado";
  const clean = code.trim().toLowerCase();
  switch (clean) {
    case "pago_movil":
      return "Pago Móvil (Bancos Nacionales)";
    case "zelle":
      return "Zelle (USD)";
    case "binance_pay":
      return "Binance Pay / USDT";
    case "transferencia":
      return "Transferencia Bancaria";
    default:
      return code;
  }
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
  const paymentMethod = formatPaymentMethodLabel(payload.paymentMethod);
  const paymentRef = payload.paymentReference || "Pendiente de comprobante";
  const now = new Date();
  const formattedDate = now.toLocaleDateString("es-VE", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isWholesaleOrder = Boolean(
    payload.isWholesale ||
    payload.orderType === "wholesale" ||
    (payload.items && payload.items.reduce((sum, item) => sum + item.quantity, 0) >= 8),
  );

  switch (payload.eventType) {
    case "order_created": {
      const subject =
        payload.customSubject ||
        (isWholesaleOrder
          ? `🔥 Nuevo pedido MAYORISTA recibido — KICKPOINT (#${orderCode})`
          : `🚨 Nuevo pedido recibido — KICKPOINT (#${orderCode})`);

      const itemsListText =
        payload.items && payload.items.length > 0
          ? payload.items
              .map(
                (item) =>
                  `  - ${item.productName}${item.size ? ` (Talla: ${item.size})` : ""}${item.color ? ` (Color: ${item.color})` : ""} x${item.quantity} — $${item.unitPrice.toFixed(2)} c/u ($${item.subtotal.toFixed(2)})`,
              )
              .join("\n")
          : "  (Detalles de productos en panel administrativo)";

      const itemsHtmlRows =
        payload.items && payload.items.length > 0
          ? payload.items
              .map(
                (item) => `
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #1e293b; color: #f8fafc; font-size: 13px;">
                    <div style="font-weight: 700; color: #ffffff;">${item.productName}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                      ${item.size ? `Talla: <strong>${item.size}</strong>` : ""}${item.size && item.color ? " | " : ""}${item.color ? `Color: ${item.color}` : ""}
                    </div>
                  </td>
                  <td align="center" style="padding: 12px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px; font-weight: 600;">
                    ${item.quantity}
                  </td>
                  <td align="right" style="padding: 12px 16px; border-bottom: 1px solid #1e293b; color: #cbd5e1; font-size: 13px; font-family: monospace;">
                    $${item.unitPrice.toFixed(2)}
                  </td>
                  <td align="right" style="padding: 12px 16px; border-bottom: 1px solid #1e293b; color: #38bdf8; font-size: 13px; font-weight: 700; font-family: monospace;">
                    $${item.subtotal.toFixed(2)}
                  </td>
                </tr>
              `,
              )
              .join("")
          : `
            <tr>
              <td colspan="4" style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">
                Ver detalle de ítems en el panel de pedidos
              </td>
            </tr>
          `;

      const text =
        `KICKPOINT\n\n` +
        `${isWholesaleOrder ? "🔥 TIENES UN NUEVO PEDIDO MAYORISTA" : "🚨 TIENES UN NUEVO PEDIDO"} (#${orderCode})\n\n` +
        `Se ha recibido un nuevo pedido en KICKPOINT.\n\n` +
        `Información del pedido:\n` +
        `----------------------------------------\n` +
        `Pedido: #${orderCode}\n` +
        `Tipo de Venta: ${isWholesaleOrder ? "Mayorista (Distribución / Min. 8 uds)" : "Minorista (Venta al Detal)"}\n` +
        `Fecha/Hora: ${formattedDate}\n` +
        `Cliente: ${customerName}\n` +
        `Teléfono: ${phone}\n` +
        `Correo: ${customerEmail}\n` +
        `Método de pago: ${paymentMethod}\n` +
        `Referencia de pago: ${paymentRef}\n` +
        `Estado: Pendiente de verificación\n` +
        `Total: ${totalStr}\n\n` +
        `Productos comprados:\n` +
        `${itemsListText}\n\n` +
        `----------------------------------------\n` +
        `VERIFICAR PEDIDO EN EL PANEL:\n${adminUrl}\n\n` +
        `KICKPOINT Store System`;

      const badgeBg = isWholesaleOrder ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)";
      const badgeBorder = isWholesaleOrder ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)";
      const badgeText = isWholesaleOrder ? "#fbbf24" : "#f87171";
      const badgeLabel = isWholesaleOrder ? "🔥 PEDIDO MAYORISTA" : "🚨 NUEVO PEDIDO";

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
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #131b2e; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          
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
                    <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeText}; font-size: 11px; font-weight: 800; padding: 6px 12px; border-radius: 9999px; border: 1px solid ${badgeBorder}; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${badgeLabel}
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
                ${isWholesaleOrder ? "Se ha recibido un nuevo pedido mayorista en KICKPOINT." : "Se ha recibido un nuevo pedido en KICKPOINT."}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">
                Un cliente ha completado el checkout en la tienda KICKPOINT. Por favor revisa los detalles y valida el comprobante de pago.
              </p>

              <!-- Order Details Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f17; border: 1px solid #1e293b; border-radius: 10px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Número de Pedido</td>
                        <td align="right" style="font-size: 15px; color: #38bdf8; font-weight: 800; font-family: monospace;">#${orderCode}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Tipo de Venta</td>
                        <td align="right" style="font-size: 13px; color: ${isWholesaleOrder ? "#fbbf24" : "#f8fafc"}; font-weight: 700;">
                          ${isWholesaleOrder ? "Mayorista (Distribución)" : "Minorista (Detal)"}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Fecha / Hora</td>
                        <td align="right" style="font-size: 13px; color: #f8fafc; font-weight: 600;">${formattedDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Cliente</td>
                        <td align="right" style="font-size: 14px; color: #f8fafc; font-weight: 700;">${customerName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Teléfono</td>
                        <td align="right" style="font-size: 14px; color: #f8fafc; font-family: monospace; font-weight: 600;">${phone}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Correo del Cliente</td>
                        <td align="right" style="font-size: 14px; color: #f8fafc; font-weight: 600;">${customerEmail}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Método de Pago</td>
                        <td align="right" style="font-size: 14px; color: #f8fafc; font-weight: 600;">${paymentMethod}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #1e293b;">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Referencia de Pago</td>
                        <td align="right" style="font-size: 14px; color: #fbbf24; font-family: monospace; font-weight: 700;">${paymentRef}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #1e293b;">
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
                  <td style="padding: 16px 20px; background-color: rgba(56, 189, 248, 0.08);">
                    <table width="100%">
                      <tr>
                        <td style="font-size: 14px; color: #ffffff; font-weight: 800; text-transform: uppercase;">Total del Pedido</td>
                        <td align="right" style="font-size: 20px; color: #38bdf8; font-weight: 900; font-family: monospace;">${totalStr}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Purchased Products Table -->
              <h2 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 800; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px;">
                📦 Productos Comprados
              </h2>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f17; border: 1px solid #1e293b; border-radius: 10px; margin-bottom: 28px; overflow: hidden; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #0f172a;">
                    <th align="left" style="padding: 10px 16px; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; border-bottom: 1px solid #1e293b;">Producto</th>
                    <th align="center" style="padding: 10px 16px; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; border-bottom: 1px solid #1e293b;">Cant.</th>
                    <th align="right" style="padding: 10px 16px; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; border-bottom: 1px solid #1e293b;">Precio</th>
                    <th align="right" style="padding: 10px 16px; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; border-bottom: 1px solid #1e293b;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtmlRows}
                </tbody>
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function asUuid(value?: string | null): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

export async function sendEmailNotification(
  payload: EmailNotificationPayload,
): Promise<EmailSendResult> {
  const recipientEmail = payload.recipientEmail?.trim() || getAdminEmail();
  const apiKey = getResendApiKey();
  const fromEmail = getResendFromEmail();

  // Generate unique idempotency key adhering to new-order-admin-[ORDER_ID] standard
  const idempotencyKey =
    (payload.metadata?.["idempotencyKey"] as string | undefined) ||
    (payload.eventType === "order_created"
      ? `new-order-admin-${payload.orderId || payload.orderCode || Date.now()}`
      : `email-${payload.eventType}-${payload.orderId || payload.orderCode || Date.now()}-${payload.recipientType}`);

  const { subject, html, text } = buildEmailMessage({
    ...payload,
    recipientEmail,
  });

  const notificationId = `em-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  console.log(
    `[ORDER_EMAIL_03] EMAIL SEND START - Order: ${payload.orderCode || payload.orderId || "N/A"}, Recipient: ${recipientEmail}, Subject: ${subject}, IdempotencyKey: ${idempotencyKey}`,
  );

  const isConfigured = isResendConfigured();

  // 1. Check idempotency in In-Memory / Supabase
  if (!isSupabaseServerConfigured()) {
    const existing = getInMemoryEmailNotifications().find(
      (n) => n.idempotency_key === idempotencyKey && n.status === "sent",
    );
    if (existing) {
      console.log(
        `[ORDER_EMAIL_06] EMAIL SENT (Idempotent replay detected) - Order: ${payload.orderCode || payload.orderId}, Status: already_sent, ProviderMsgId: ${existing.provider_message_id || "N/A"}`,
      );
      return {
        ok: true,
        status: "already_sent",
        notificationId: existing.id,
        providerMessageId: existing.provider_message_id ?? null,
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
        console.log(
          `[ORDER_EMAIL_06] EMAIL SENT (Idempotent replay detected) - Order: ${payload.orderCode || payload.orderId}, Status: already_sent, ProviderMsgId: ${existing.provider_message_id || "N/A"}`,
        );
        return {
          ok: true,
          status: "already_sent",
          notificationId: existing.id,
          providerMessageId: existing.provider_message_id,
          idempotencyKey,
        };
      }
    } catch {
      // Table query skipped safely
    }
  }

  // 2. If Resend is NOT configured with an active API Key
  if (!isConfigured) {
    const pendingNotification: InMemoryEmailNotification = {
      id: notificationId,
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
            order_id: asUuid(payload.orderId),
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
      `[ORDER_EMAIL_ERROR] - OrderId: ${payload.orderId || payload.orderCode}, NotificationId: ${notificationId}, Recipient: ${recipientEmail}, HTTPStatus: 0, Error: RESEND_API_KEY not configured, Timestamp: ${new Date().toISOString()}, IdempotencyKey: ${idempotencyKey}`,
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
  let lastHttpStatus: number = 0;
  let providerMessageId: string | null = null;
  let isSuccess = false;

  console.log(
    `[ORDER_EMAIL_04] RESEND REQUEST - Endpoint: ${getResendEndpoint()}, From: ${fromEmail}, To: ${recipientEmail}, IdempotencyKey: ${idempotencyKey}`,
  );

  for (let attempt = 1; attempt <= 2; attempt++) {
    attempts = attempt;
    try {
      const useGateway = !isDirectResendKey();
      const gatewayHeaders: Record<string, string> = useGateway
        ? {
            Authorization: `Bearer ${getLovableApiKey()}`,
            "X-Connection-Api-Key": apiKey,
          }
        : { Authorization: `Bearer ${apiKey}` };

      const response = await fetch(getResendEndpoint(), {
        method: "POST",
        headers: {
          ...gatewayHeaders,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
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

      lastHttpStatus = response.status;
      const resData = await response.json().catch(() => ({}));

      console.log(
        `[ORDER_EMAIL_05] RESEND RESPONSE - Status: ${response.status}, OK: ${response.ok}, Attempt: ${attempt}`,
      );

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
        console.warn(`[ORDER_EMAIL_05] Resend attempt ${attempt} failed: ${lastError}`);
      }
    } catch (err: any) {
      lastHttpStatus = 0;
      lastError = err.message || "Network timeout connecting to Resend API";
      console.warn(`[ORDER_EMAIL_05] Resend attempt ${attempt} exception: ${lastError}`);
    }

    if (attempt < 2 && !isSuccess) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  const status: "sent" | "failed" = isSuccess ? "sent" : "failed";
  const sentAt = isSuccess ? new Date().toISOString() : null;

  if (isSuccess) {
    console.log(
      `[ORDER_EMAIL_06] EMAIL SENT - OrderId: ${payload.orderId || payload.orderCode}, NotificationId: ${notificationId}, Recipient: ${recipientEmail}, ProviderMsgId: ${providerMessageId}, Timestamp: ${sentAt}`,
    );
  } else {
    console.warn(
      `[ORDER_EMAIL_ERROR] - OrderId: ${payload.orderId || payload.orderCode}, NotificationId: ${notificationId}, Recipient: ${recipientEmail}, HTTPStatus: ${lastHttpStatus}, Error: ${lastError}, Timestamp: ${new Date().toISOString()}, IdempotencyKey: ${idempotencyKey}`,
    );
  }

  // 4. Log in In-Memory / Supabase
  const logRecord: InMemoryEmailNotification = {
    id: notificationId,
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
      const { error: auditError } = await supabaseAdmin.from("email_notifications").upsert(
        {
          event_type: payload.eventType,
          recipient_email: recipientEmail,
          recipient_type: payload.recipientType,
          order_id: asUuid(payload.orderId),
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
      if (auditError) {
        console.warn("[Email Resend] Supabase audit log error:", auditError.message);
      }
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
