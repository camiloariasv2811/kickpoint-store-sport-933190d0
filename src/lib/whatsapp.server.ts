// Server-side WhatsApp Business Platform / Meta Cloud API Client for KICKPOINT
// Handles phone normalization, template preparation, idempotency, retry mechanisms, and delivery logging.

import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import {
  addInMemoryWhatsAppNotification,
  getInMemoryWhatsAppNotifications,
  type InMemoryWhatsAppNotification,
} from "./demo-data";

export const DEFAULT_ADMIN_WHATSAPP = "584121546698";

/**
 * Normalizes phone numbers to WhatsApp international format.
 * Examples:
 * - "0412 1546698" -> "584121546698"
 * - "+58 412-154.6698" -> "584121546698"
 * - "584121546698" -> "584121546698"
 * - "+1 (305) 123-4567" -> "13051234567"
 * Returns null if invalid / incomplete.
 */
export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let cleaned = String(phone).replace(/[^\d+]/g, "").trim();
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  // Venezuelan local prefixes (0412, 0414, 0424, 0416, 0426)
  if (/^04\d{9}$/.test(cleaned)) {
    cleaned = "58" + cleaned.slice(1);
  } else if (/^4\d{9}$/.test(cleaned)) {
    cleaned = "58" + cleaned;
  }

  // Valid international numbers have between 10 and 15 digits
  if (/^\d{10,15}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

export function getPublicStoreUrl(): string {
  const url =
    process.env["KICKPOINT_PUBLIC_URL"] ||
    process.env["VITE_APP_URL"] ||
    "https://kickpoint-store-sport-933190d0.lovable.app";
  return url.replace(/\/+$/, "");
}

export function getAdminWhatsAppNumber(): string {
  const raw = process.env["ADMIN_WHATSAPP_NUMBER"] || DEFAULT_ADMIN_WHATSAPP;
  return normalizeWhatsAppPhone(raw) || DEFAULT_ADMIN_WHATSAPP;
}

export type WhatsAppEventType =
  | "order_created"
  | "payment_verified"
  | "preparando_pedido"
  | "empacando_pedido"
  | "pedido_enviado"
  | "pedido_entregado"
  | "pedido_cancelado"
  | "test_message";

export interface WhatsAppNotificationPayload {
  eventType: WhatsAppEventType;
  recipientPhone: string;
  recipientType: "admin" | "customer";
  orderId?: string | null;
  orderCode?: string | null;
  customerName?: string | null;
  total?: number | null;
  paymentMethod?: string | null;
  shippingCarrier?: string | null;
  trackingNumber?: string | null;
  customMessage?: string | null;
  metadata?: Record<string, any>;
}

export interface WhatsAppSendResult {
  ok: boolean;
  status: "sent" | "pending" | "failed" | "already_sent";
  notificationId?: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  idempotencyKey: string;
}

/**
 * Builds the standard message text and template variables based on the business event.
 */
export function buildWhatsAppMessage(payload: WhatsAppNotificationPayload): {
  messageText: string;
  templateName: string;
  templateComponents: any[];
} {
  const publicUrl = getPublicStoreUrl();
  const orderCode = payload.orderCode || "KP-ORDEN";
  const customerName = payload.customerName || "Cliente";
  const totalStr = payload.total != null ? `$${payload.total.toFixed(2)}` : "$0.00";
  const trackingUrl = `${publicUrl}/pedido?code=${encodeURIComponent(orderCode)}`;
  const adminOrdersUrl = `${publicUrl}/admin/pedidos`;

  switch (payload.eventType) {
    case "order_created": {
      const text = [
        "🔔 NUEVO PEDIDO KICKPOINT",
        "",
        `Pedido: ${orderCode}`,
        `Cliente: ${customerName}`,
        `Total: ${totalStr}`,
        `Método de pago: ${payload.paymentMethod || "Por verificar"}`,
        "Estado: Pendiente de aprobación.",
        "",
        "Ingresa al panel administrativo para revisar el pedido:",
        adminOrdersUrl,
      ].join("\n");

      return {
        messageText: text,
        templateName: "kickpoint_new_order",
        templateComponents: [
          {
            type: "body",
            parameters: [
              { type: "text", text: orderCode },
              { type: "text", text: customerName },
              { type: "text", text: totalStr },
              { type: "text", text: payload.paymentMethod || "Pago" },
              { type: "text", text: adminOrdersUrl },
            ],
          },
        ],
      };
    }

    case "payment_verified": {
      const text = [
        "✅ KICKPOINT",
        "",
        `Tu pago del pedido ${orderCode} ha sido verificado correctamente.`,
        "",
        "Tu pedido comenzará a prepararse.",
        "",
        "Estado:",
        "PAGO VERIFICADO",
        "",
        "Seguimiento:",
        trackingUrl,
      ].join("\n");

      return {
        messageText: text,
        templateName: "kickpoint_payment_verified",
        templateComponents: [
          {
            type: "body",
            parameters: [
              { type: "text", text: orderCode },
              { type: "text", text: trackingUrl },
            ],
          },
        ],
      };
    }

    case "preparando_pedido": {
      const text = [
        "📦 KICKPOINT",
        "",
        `Tu pedido ${orderCode} está siendo preparado.`,
        "",
        "Estado:",
        "PEDIDO EN PREPARACIÓN",
        "",
        "Seguimiento:",
        trackingUrl,
      ].join("\n");

      return {
        messageText: text,
        templateName: "kickpoint_order_preparing",
        templateComponents: [
          {
            type: "body",
            parameters: [
              { type: "text", text: orderCode },
              { type: "text", text: trackingUrl },
            ],
          },
        ],
      };
    }

    case "empacando_pedido": {
      const text = [
        "📦 KICKPOINT",
        "",
        `Tu pedido ${orderCode} ya fue empacado y está listo para despacho.`,
        "",
        "Seguimiento:",
        trackingUrl,
      ].join("\n");

      return {
        messageText: text,
        templateName: "kickpoint_order_packed",
        templateComponents: [
          {
            type: "body",
            parameters: [
              { type: "text", text: orderCode },
              { type: "text", text: trackingUrl },
            ],
          },
        ],
      };
    }

    case "pedido_enviado": {
      const carrier = payload.shippingCarrier || "MRW / TEALCA";
      const trackingLines = payload.trackingNumber
        ? ["", "Número de seguimiento:", payload.trackingNumber]
        : [];

      const text = [
        "🚚 KICKPOINT",
        "",
        `¡Tu pedido ${orderCode} ya fue enviado!`,
        "",
        "Transportadora:",
        carrier,
        ...trackingLines,
        "",
        "Consulta el estado de tu pedido:",
        trackingUrl,
      ].join("\n");

      return {
        messageText: text,
        templateName: "kickpoint_order_shipped",
        templateComponents: [
          {
            type: "body",
            parameters: [
              { type: "text", text: orderCode },
              { type: "text", text: carrier },
              { type: "text", text: payload.trackingNumber || "En tránsito" },
              { type: "text", text: trackingUrl },
            ],
          },
        ],
      };
    }

    case "pedido_entregado": {
      const text = [
        "✅ KICKPOINT",
        "",
        `¡Tu pedido ${orderCode} ha sido entregado correctamente!`,
        "",
        "Gracias por comprar con KICKPOINT.",
      ].join("\n");

      return {
        messageText: text,
        templateName: "kickpoint_order_delivered",
        templateComponents: [
          {
            type: "body",
            parameters: [{ type: "text", text: orderCode }],
          },
        ],
      };
    }

    case "pedido_cancelado": {
      const text = [
        "⚠️ KICKPOINT",
        "",
        `Tu pedido ${orderCode} ha sido cancelado.`,
        "",
        "Para cualquier consulta puedes comunicarte con nosotros por WhatsApp:",
        "+58 412 1546698",
      ].join("\n");

      return {
        messageText: text,
        templateName: "kickpoint_order_cancelled",
        templateComponents: [
          {
            type: "body",
            parameters: [
              { type: "text", text: orderCode },
              { type: "text", text: "+58 412 1546698" },
            ],
          },
        ],
      };
    }

    case "test_message":
    default: {
      const text =
        payload.customMessage ||
        `🧪 KICKPOINT - Mensaje de prueba de WhatsApp Cloud API enviado exitosamente a las ${new Date().toLocaleTimeString("es-VE")}.`;
      return {
        messageText: text,
        templateName: "kickpoint_test",
        templateComponents: [],
      };
    }
  }
}

/**
 * Main function to send WhatsApp notifications.
 * Non-blocking: will log errors but never throw an unhandled exception.
 */
export async function sendWhatsAppNotification(
  payload: WhatsAppNotificationPayload,
): Promise<WhatsAppSendResult> {
  const normalizedPhone = normalizeWhatsAppPhone(payload.recipientPhone);
  const idempotencyKey = `${payload.eventType}:${payload.orderId || payload.orderCode || "general"}:${normalizedPhone || payload.recipientPhone}`;

  const { messageText, templateName, templateComponents } = buildWhatsAppMessage(payload);

  // 1. Phone number validation
  if (!normalizedPhone) {
    const errorMsg = `Invalid WhatsApp phone number: "${payload.recipientPhone}"`;
    console.warn(`[WhatsApp] ${errorMsg}`);

    if (!isSupabaseServerConfigured()) {
      addInMemoryWhatsAppNotification({
        id: `wn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        event_type: payload.eventType,
        recipient_phone: payload.recipientPhone,
        recipient_type: payload.recipientType,
        order_id: payload.orderId || null,
        order_code: payload.orderCode || null,
        message: messageText,
        template_name: templateName,
        status: "failed",
        error_message: errorMsg,
        attempts: 1,
        idempotency_key: idempotencyKey,
        created_at: new Date().toISOString(),
      });
    } else {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("whatsapp_notifications").upsert(
          {
            idempotency_key: idempotencyKey,
            event_type: payload.eventType,
            recipient_phone: payload.recipientPhone,
            recipient_type: payload.recipientType,
            order_id: payload.orderId || null,
            order_code: payload.orderCode || null,
            message: messageText,
            template_name: templateName,
            status: "failed",
            error_message: errorMsg,
            attempts: 1,
            metadata: payload.metadata || {},
          },
          { onConflict: "idempotency_key" },
        );
      } catch (e) {
        console.warn("[WhatsApp] Failed to save invalid phone log:", e);
      }
    }

    return {
      ok: false,
      status: "failed",
      errorMessage: errorMsg,
      idempotencyKey,
    };
  }

  // 2. Check Idempotency (prevent duplicate sends)
  if (!isSupabaseServerConfigured()) {
    const existing = getInMemoryWhatsAppNotifications().find(
      (n) => n.idempotency_key === idempotencyKey,
    );
    if (existing && existing.status === "sent") {
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
        .from("whatsapp_notifications")
        .select("id, status, provider_message_id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existing && existing.status === "sent") {
        return {
          ok: true,
          status: "already_sent",
          notificationId: existing.id,
          providerMessageId: existing.provider_message_id,
          idempotencyKey,
        };
      }
    } catch (e) {
      console.warn("[WhatsApp] Idempotency check warning:", e);
    }
  }

  // 3. Meta Credentials Check
  const accessToken = process.env["WHATSAPP_ACCESS_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  const apiVersion = process.env["WHATSAPP_API_VERSION"] || "v21.0";

  if (!accessToken || !phoneNumberId) {
    const infoMsg =
      "WhatsApp Cloud API credentials (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID) not configured in environment";
    console.info(`[WhatsApp] Notification queued (simulated delivery in non-configured mode): ${payload.eventType} -> ${normalizedPhone}`);

    const simulatedId = `wamid.sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const notifRecord: InMemoryWhatsAppNotification = {
      id: `wn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      event_type: payload.eventType,
      recipient_phone: normalizedPhone,
      recipient_type: payload.recipientType,
      order_id: payload.orderId || null,
      order_code: payload.orderCode || null,
      message: messageText,
      template_name: templateName,
      status: "pending",
      provider_message_id: simulatedId,
      error_message: infoMsg,
      attempts: 1,
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString(),
      sent_at: null,
    };

    addInMemoryWhatsAppNotification(notifRecord);

    if (isSupabaseServerConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("whatsapp_notifications").upsert(
          {
            idempotency_key: idempotencyKey,
            event_type: payload.eventType,
            recipient_phone: normalizedPhone,
            recipient_type: payload.recipientType,
            order_id: payload.orderId || null,
            order_code: payload.orderCode || null,
            message: messageText,
            template_name: templateName,
            status: "pending",
            provider_message_id: simulatedId,
            error_message: infoMsg,
            attempts: 1,
            metadata: payload.metadata || {},
          },
          { onConflict: "idempotency_key" },
        );
      } catch (e) {
        console.warn("[WhatsApp] DB queue record warning:", e);
      }
    }

    return {
      ok: true,
      status: "pending",
      providerMessageId: simulatedId,
      errorMessage: infoMsg,
      idempotencyKey,
    };
  }

  // 4. Meta Cloud API Request with 3-Attempt Retry
  const metaUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const metaBody = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizedPhone,
    type: "text",
    text: {
      preview_url: true,
      body: messageText,
    },
  };

  let providerMessageId: string | null = null;
  let lastError: string | null = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(metaUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaBody),
      });

      const data = await res.json();
      if (res.ok && data.messages?.[0]?.id) {
        providerMessageId = data.messages[0].id;
        lastError = null;
        break;
      } else {
        lastError = data.error?.message || `Meta Cloud API HTTP ${res.status}`;
        console.warn(`[WhatsApp] Delivery attempt ${attempt} failed: ${lastError}`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, attempt * 600));
        }
      }
    } catch (err: any) {
      lastError = err.message || "Network timeout contacting Meta Cloud API";
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 600));
      }
    }
  }

  const finalStatus = providerMessageId ? "sent" : "failed";

  // 5. Save final result in memory and Supabase
  const record: InMemoryWhatsAppNotification = {
    id: `wn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    event_type: payload.eventType,
    recipient_phone: normalizedPhone,
    recipient_type: payload.recipientType,
    order_id: payload.orderId || null,
    order_code: payload.orderCode || null,
    message: messageText,
    template_name: templateName,
    status: finalStatus,
    provider_message_id: providerMessageId,
    error_message: lastError,
    attempts: maxRetries,
    idempotency_key: idempotencyKey,
    created_at: new Date().toISOString(),
    sent_at: providerMessageId ? new Date().toISOString() : null,
  };

  addInMemoryWhatsAppNotification(record);

  if (isSupabaseServerConfigured()) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("whatsapp_notifications").upsert(
        {
          idempotency_key: idempotencyKey,
          event_type: payload.eventType,
          recipient_phone: normalizedPhone,
          recipient_type: payload.recipientType,
          order_id: payload.orderId || null,
          order_code: payload.orderCode || null,
          message: messageText,
          template_name: templateName,
          status: finalStatus,
          provider_message_id: providerMessageId,
          error_message: lastError,
          attempts: maxRetries,
          sent_at: providerMessageId ? new Date().toISOString() : null,
          metadata: payload.metadata || {},
        },
        { onConflict: "idempotency_key" },
      );
    } catch (e) {
      console.warn("[WhatsApp] Failed to save delivery record:", e);
    }
  }

  return {
    ok: finalStatus === "sent",
    status: finalStatus,
    providerMessageId,
    errorMessage: lastError,
    idempotencyKey,
  };
}
