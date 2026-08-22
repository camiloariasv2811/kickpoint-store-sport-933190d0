// Supabase Edge Function: whatsapp-send
// Sends WhatsApp notifications via Meta Cloud API with idempotency, phone normalization, retry logic, and audit logging.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, "").trim();
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  // Venezuelan local format conversion: 0412XXXXXXX -> 58412XXXXXXX
  if (/^04\d{9}$/.test(cleaned)) {
    cleaned = "58" + cleaned.slice(1);
  } else if (/^4\d{9}$/.test(cleaned)) {
    cleaned = "58" + cleaned;
  }

  // Check valid international format: 10 to 15 digits
  if (/^\d{10,15}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

interface WhatsAppSendRequest {
  event_type: string;
  recipient_phone: string;
  recipient_type: "admin" | "customer";
  order_id?: string | null;
  order_code?: string | null;
  message: string;
  template_name?: string | null;
  template_components?: any[];
  idempotency_key: string;
  metadata?: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as WhatsAppSendRequest;
    const {
      event_type,
      recipient_phone,
      recipient_type,
      order_id,
      order_code,
      message,
      template_name,
      template_components,
      idempotency_key,
      metadata = {},
    } = payload;

    if (!event_type || !recipient_phone || !message || !idempotency_key) {
      return new Response(
        JSON.stringify({ error: "Missing required fields (event_type, recipient_phone, message, idempotency_key)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Idempotency Check
    const { data: existingNotif } = await supabase
      .from("whatsapp_notifications")
      .select("id, status, provider_message_id")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existingNotif && existingNotif.status === "sent") {
      return new Response(
        JSON.stringify({
          ok: true,
          status: "already_sent",
          notification_id: existingNotif.id,
          provider_message_id: existingNotif.provider_message_id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validate & Normalize Phone Number
    const normalizedPhone = normalizeWhatsAppPhone(recipient_phone);
    if (!normalizedPhone) {
      const errorMsg = `Invalid WhatsApp phone number: "${recipient_phone}"`;
      console.warn(`[whatsapp-send] ${errorMsg}`);

      await supabase.from("whatsapp_notifications").upsert(
        {
          idempotency_key,
          event_type,
          recipient_phone,
          recipient_type,
          order_id: order_id || null,
          order_code: order_code || null,
          message,
          template_name: template_name || null,
          status: "failed",
          error_message: errorMsg,
          attempts: 1,
          metadata,
        },
        { onConflict: "idempotency_key" }
      );

      return new Response(
        JSON.stringify({ ok: false, status: "failed", error: errorMsg }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check Meta API Credentials
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v21.0";

    if (!accessToken || !phoneNumberId) {
      const errorMsg = "WhatsApp Cloud API credentials (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID) not configured in environment";
      console.warn(`[whatsapp-send] ${errorMsg}`);

      await supabase.from("whatsapp_notifications").upsert(
        {
          idempotency_key,
          event_type,
          recipient_phone: normalizedPhone,
          recipient_type,
          order_id: order_id || null,
          order_code: order_code || null,
          message,
          template_name: template_name || null,
          status: "pending",
          error_message: errorMsg,
          attempts: 1,
          metadata: { ...metadata, unconfigured_mode: true },
        },
        { onConflict: "idempotency_key" }
      );

      return new Response(
        JSON.stringify({ ok: true, status: "pending", message: "Notification queued. Meta credentials pending." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Build Meta Request Body
    const metaUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    let metaBody: any;

    if (template_name) {
      metaBody = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizedPhone,
        type: "template",
        template: {
          name: template_name,
          language: { code: "es" },
          components: template_components || [],
        },
      };
    } else {
      metaBody = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizedPhone,
        type: "text",
        text: {
          preview_url: true,
          body: message,
        },
      };
    }

    // 5. Send with Retry Mechanism (Up to 3 attempts with exponential backoff)
    let lastError: string | null = null;
    let providerMessageId: string | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(metaUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metaBody),
        });

        const resJson = await response.json();

        if (response.ok && resJson.messages?.[0]?.id) {
          providerMessageId = resJson.messages[0].id;
          lastError = null;
          break;
        } else {
          lastError = resJson.error?.message || `Meta API returned HTTP ${response.status}`;
          console.warn(`[whatsapp-send] Attempt ${attempt} failed: ${lastError}`);
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 750));
          }
        }
      } catch (fetchErr: any) {
        lastError = fetchErr.message || "Network error communicating with Meta API";
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 750));
        }
      }
    }

    // 6. Record Final Status in Database
    const finalStatus = providerMessageId ? "sent" : "failed";
    const { data: recorded, error: dbError } = await supabase
      .from("whatsapp_notifications")
      .upsert(
        {
          idempotency_key,
          event_type,
          recipient_phone: normalizedPhone,
          recipient_type,
          order_id: order_id || null,
          order_code: order_code || null,
          message,
          template_name: template_name || null,
          status: finalStatus,
          provider_message_id: providerMessageId,
          error_message: lastError,
          attempts: maxRetries,
          sent_at: providerMessageId ? new Date().toISOString() : null,
          metadata,
        },
        { onConflict: "idempotency_key" }
      )
      .select("id")
      .maybeSingle();

    if (dbError) {
      console.error("[whatsapp-send] DB update error:", dbError.message);
    }

    return new Response(
      JSON.stringify({
        ok: finalStatus === "sent",
        status: finalStatus,
        notification_id: recorded?.id,
        provider_message_id: providerMessageId,
        error: lastError,
      }),
      {
        status: finalStatus === "sent" ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[whatsapp-send] Fatal catch:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
