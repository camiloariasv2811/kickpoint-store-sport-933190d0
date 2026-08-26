import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EmailDeliveryAlert } from "./email-alerts.server";

export type { EmailDeliveryAlert };

export const getEmailDeliveryAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { reconcile?: boolean; autoWhatsApp?: boolean }) => input ?? {})
  .handler(async ({ data }): Promise<{ alerts: EmailDeliveryAlert[]; checked: number }> => {
    const { collectEmailDeliveryAlerts } = await import("./email-alerts.server");
    try {
      return await collectEmailDeliveryAlerts({
        reconcile: data.reconcile ?? true,
        autoWhatsApp: data.autoWhatsApp ?? true,
      });
    } catch (err) {
      console.warn("[EmailAlerts] Error recolectando alertas:", err);
      return { alerts: [], checked: 0 };
    }
  });

export const dismissEmailAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { dismissEmailDeliveryAlert } = await import("./email-alerts.server");
    const ok = await dismissEmailDeliveryAlert(data.id);
    return { ok };
  });

export const notifyEmailAlertByWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { sendAlertToAdminWhatsApp } = await import("./email-alerts.server");
    return await sendAlertToAdminWhatsApp(data.id);
  });
