import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import { getInMemoryEmailNotifications, type InMemoryEmailNotification } from "./demo-data";
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_FROM_EMAIL,
  getAdminEmail,
  getResendApiKey,
  getResendFromEmail,
  isResendConfigured,
  sendEmailNotification,
  type EmailEventType,
} from "./email.server";

export interface EmailNotificationLogItem {
  id: string;
  event_type: string;
  recipient_email: string;
  recipient_type: "admin" | "customer";
  subject: string;
  order_id?: string | null;
  order_code?: string | null;
  status: "pending" | "sent" | "failed";
  provider_message_id?: string | null;
  error_message?: string | null;
  created_at: string;
  sent_at?: string | null;
}

export interface EmailDashboardStatus {
  isConfigured: boolean;
  adminRecipientEmail: string;
  fromEmail: string;
  hasApiKey: boolean;
  stats: {
    total: number;
    sent: number;
    pending: number;
    failed: number;
  };
  recentLogs: EmailNotificationLogItem[];
  settings: {
    notifyAdminNewOrder: boolean;
  };
}

export const getEmailDashboardStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<EmailDashboardStatus> => {
    const isConfigured = isResendConfigured();
    const hasApiKey = Boolean(getResendApiKey());
    const adminRecipientEmail = getAdminEmail();
    const fromEmail = getResendFromEmail();

    let logs: EmailNotificationLogItem[] = [];
    let notifyAdminNewOrder = true;

    if (!isSupabaseServerConfigured()) {
      logs = getInMemoryEmailNotifications();
    } else {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: dbLogs } = await supabaseAdmin
          .from("email_notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30);

        if (dbLogs && Array.isArray(dbLogs)) {
          logs = dbLogs as EmailNotificationLogItem[];
        } else {
          logs = getInMemoryEmailNotifications();
        }

        const { data: settingsData } = await supabaseAdmin
          .from("settings")
          .select("key, value")
          .eq("key", "email_notification_settings")
          .maybeSingle();

        if (settingsData?.value) {
          const val =
            typeof settingsData.value === "string"
              ? JSON.parse(settingsData.value)
              : settingsData.value;
          notifyAdminNewOrder = val.notifyAdminNewOrder ?? true;
        }
      } catch {
        logs = getInMemoryEmailNotifications();
      }
    }

    const total = logs.length;
    const sent = logs.filter((l) => l.status === "sent").length;
    const pending = logs.filter((l) => l.status === "pending").length;
    const failed = logs.filter((l) => l.status === "failed").length;

    return {
      isConfigured,
      adminRecipientEmail,
      fromEmail,
      hasApiKey,
      stats: { total, sent, pending, failed },
      recentLogs: logs.slice(0, 15),
      settings: {
        notifyAdminNewOrder,
      },
    };
  });

export const sendEmailTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { email?: string; subject?: string; message?: string }) => input)
  .handler(
    async ({
      data,
    }): Promise<{
      ok: boolean;
      status: string;
      providerMessageId?: string | null;
      errorMessage?: string | null;
      recipientEmail: string;
    }> => {
      const targetEmail = data.email?.trim() || getAdminEmail();
      const result = await sendEmailNotification({
        eventType: "test_message",
        recipientType: "admin",
        recipientEmail: targetEmail,
        customSubject: data.subject || "🔔 KICKPOINT — Prueba de notificaciones",
        customMessage:
          data.message || "El sistema de correo administrativo está funcionando correctamente.",
        metadata: {
          isTest: true,
          testedAt: new Date().toISOString(),
        },
      });

      return {
        ok: result.ok,
        status: result.status,
        providerMessageId: result.providerMessageId ?? null,
        errorMessage: result.errorMessage ?? null,
        recipientEmail: targetEmail,
      };
    },
  );

export const resendOrderEmailNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { orderId: string; orderNumber?: string }) => input)
  .handler(
    async ({
      data,
    }): Promise<{
      ok: boolean;
      status: string;
      providerMessageId?: string | null;
      errorMessage?: string | null;
    }> => {
      let orderCode = data.orderNumber || "N/A";
      let customerName = "Cliente";
      let customerPhone: string | null = null;
      let customerEmail: string | null = null;
      let total = 0;
      let paymentMethod = "transferencia";
      let paymentReference: string | null = null;
      let isWholesale = false;
      let items: Array<{
        productName: string;
        size?: string | null;
        color?: string | null;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }> = [];

      if (isSupabaseServerConfigured()) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: order } = await supabaseAdmin
            .from("orders")
            .select(`*, items:order_items(*), customer:customers(*)`)
            .eq("id", data.orderId)
            .maybeSingle();

          if (order) {
            orderCode = order.order_number;
            customerName =
              `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim() ||
              "Cliente";
            customerPhone = order.customer?.whatsapp || null;
            customerEmail = order.customer?.email || null;
            total = Number(order.total);
            paymentMethod = order.payment_method_code || "transferencia";
            paymentReference = null;
            isWholesale = Boolean(order.is_wholesale);
            items = (order.items || []).map((i: any) => ({
              productName: i.product_name,
              size: i.size || null,
              color: i.color || null,
              quantity: i.quantity,
              unitPrice: Number(i.unit_price),
              subtotal: Number(i.subtotal),
            }));
          }
        } catch {
          // fallback to defaults
        }
      }

      console.log(
        `[ORDER_EMAIL_02] EMAIL EVENT RETRY CREATED - Order: ${orderCode}, OrderId: ${data.orderId}`,
      );

      const result = await sendEmailNotification({
        eventType: "order_created",
        recipientType: "admin",
        recipientEmail: getAdminEmail(),
        orderId: data.orderId,
        orderCode,
        customerName,
        customerPhone,
        customerEmail,
        total,
        paymentMethod,
        paymentReference,
        isWholesale,
        orderType: isWholesale ? "wholesale" : "retail",
        items,
        metadata: {
          idempotencyKey: `new-order-admin-${data.orderId}-retry-${Date.now()}`,
          isRetry: true,
        },
      });

      return {
        ok: result.ok,
        status: result.status,
        providerMessageId: result.providerMessageId ?? null,
        errorMessage: result.errorMessage ?? null,
      };
    },
  );

export const checkEmailDeliveryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { messageId: string }) => input)
  .handler(async ({ data }) => {
    const { fetchEmailDeliveryStatus } = await import("./email.server");
    const result = await fetchEmailDeliveryStatus(data.messageId);
    return {
      ok: result.ok,
      lastEvent: result.lastEvent,
      error: result.error ?? null,
      raw: result.raw ?? null,
    };
  });
