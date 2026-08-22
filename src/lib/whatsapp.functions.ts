import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import { getInMemoryWhatsAppNotifications, type InMemoryWhatsAppNotification } from "./demo-data";
import {
  DEFAULT_ADMIN_WHATSAPP,
  getAdminWhatsAppNumber,
  normalizeWhatsAppPhone,
  sendWhatsAppNotification,
  type WhatsAppEventType,
} from "./whatsapp.server";

export interface WhatsAppNotificationLogItem {
  id: string;
  event_type: string;
  recipient_phone: string;
  recipient_type: "admin" | "customer";
  order_id?: string | null;
  order_code?: string | null;
  message: string;
  template_name?: string | null;
  status: "pending" | "sent" | "failed";
  provider_message_id?: string | null;
  error_message?: string | null;
  created_at: string;
  sent_at?: string | null;
}

export interface WhatsAppDashboardStatus {
  isConfigured: boolean;
  missingSecrets: string[];
  officialNumber: string;
  adminRecipientNumber: string;
  stats: {
    total: number;
    sent: number;
    pending: number;
    failed: number;
  };
  recentLogs: WhatsAppNotificationLogItem[];
  settings: {
    notifyAdminNewOrder: boolean;
    notifyCustomerStatusChange: boolean;
  };
}

export const getWhatsAppDashboardStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsAppDashboardStatus> => {
    const hasToken = Boolean(process.env["WHATSAPP_ACCESS_TOKEN"]);
    const hasPhoneId = Boolean(process.env["WHATSAPP_PHONE_NUMBER_ID"]);
    const isConfigured = hasToken && hasPhoneId;
    const officialNumber = "+58 412 1546698";
    const adminRecipientNumber = getAdminWhatsAppNumber();

    let logs: WhatsAppNotificationLogItem[] = [];
    let notifyAdminNewOrder = true;
    let notifyCustomerStatusChange = true;

    if (!isSupabaseServerConfigured()) {
      logs = getInMemoryWhatsAppNotifications();
    } else {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: dbLogs } = await supabaseAdmin
          .from("whatsapp_notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30);

        if (dbLogs && Array.isArray(dbLogs)) {
          logs = dbLogs as WhatsAppNotificationLogItem[];
        } else {
          logs = getInMemoryWhatsAppNotifications();
        }

        const { data: settingsData } = await supabaseAdmin
          .from("settings")
          .select("key, value")
          .eq("key", "whatsapp_notifications")
          .maybeSingle();

        if (settingsData?.value) {
          const val = settingsData.value as any;
          if (typeof val.notify_admin_new_order === "boolean") {
            notifyAdminNewOrder = val.notify_admin_new_order;
          }
          if (typeof val.notify_customer_status_change === "boolean") {
            notifyCustomerStatusChange = val.notify_customer_status_change;
          }
        }
      } catch (err) {
        console.warn("[getWhatsAppDashboardStatus] DB query fallback:", err);
        logs = getInMemoryWhatsAppNotifications();
      }
    }

    const sent = logs.filter((l) => l.status === "sent").length;
    const pending = logs.filter((l) => l.status === "pending").length;
    const failed = logs.filter((l) => l.status === "failed").length;

    return {
      isConfigured,
      officialNumber,
      adminRecipientNumber,
      stats: {
        total: logs.length,
        sent,
        pending,
        failed,
      },
      recentLogs: logs.slice(0, 15),
      settings: {
        notifyAdminNewOrder,
        notifyCustomerStatusChange,
      },
    };
  });

export const sendWhatsAppTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { phone: string; message?: string }) => {
    if (!data?.phone?.trim()) throw new Error("Ingresa un número de WhatsApp para la prueba");
    return data;
  })
  .handler(async ({ data }) => {
    const normalized = normalizeWhatsAppPhone(data.phone);
    if (!normalized) {
      throw new Error(
        `Número de teléfono inválido ("${data.phone}"). Utiliza formato venezolano (ej. 04121546698) o internacional (+584121546698).`,
      );
    }

    const result = await sendWhatsAppNotification({
      eventType: "test_message",
      recipientPhone: normalized,
      recipientType: "admin",
      orderCode: "TEST-2026",
      customMessage:
        data.message?.trim() ||
        `🧪 KICKPOINT: Mensaje de prueba de WhatsApp Cloud API enviado correctamente a las ${new Date().toLocaleTimeString("es-VE")}.`,
    });

    return result;
  });

export const updateWhatsAppNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { notifyAdminNewOrder: boolean; notifyCustomerStatusChange: boolean }) => data,
  )
  .handler(async ({ data, context }) => {
    if (isSupabaseServerConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("settings").upsert({
          key: "whatsapp_notifications",
          value: {
            notify_admin_new_order: data.notifyAdminNewOrder,
            notify_customer_status_change: data.notifyCustomerStatusChange,
            updated_at: new Date().toISOString(),
          },
        });
      } catch (err: any) {
        console.warn("[updateWhatsAppNotificationSettings] DB save warning:", err);
      }
    }
    return { ok: true as const };
  });
