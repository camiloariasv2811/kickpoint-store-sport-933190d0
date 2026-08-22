// Supabase Edge Function: email-send
// Sends transactional emails via Resend API with idempotency and audit logging.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailSendRequest {
  event_type: string;
  recipient_email: string;
  recipient_type: "admin" | "customer";
  order_id?: string | null;
  order_code?: string | null;
  subject: string;
  html?: string | null;
  text?: string | null;
  idempotency_key: string;
  metadata?: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as EmailSendRequest;
    const {
      event_type,
      recipient_email,
      recipient_type,
      order_id,
      order_code,
      subject,
      html,
      text,
      idempotency_key,
      metadata = {},
    } = payload;

    if (!event_type || !recipient_email || !subject || !idempotency_key) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields (event_type, recipient_email, subject, idempotency_key)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "KICKPOINT <onboarding@resend.dev>";

    let supabase: any = null;
    if (supabaseUrl && supabaseServiceKey) {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    }

    // 1. Check idempotency
    if (supabase) {
      const { data: existing } = await supabase
        .from("email_notifications")
        .select("id, status, provider_message_id")
        .eq("idempotency_key", idempotency_key)
        .eq("status", "sent")
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            ok: true,
            status: "already_sent",
            notification_id: existing.id,
            provider_message_id: existing.provider_message_id,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // 2. Validate Resend Credentials
    if (!resendApiKey) {
      const errorMsg = "RESEND_API_KEY is not configured in Supabase Secrets.";
      if (supabase) {
        await supabase.from("email_notifications").upsert({
          event_type,
          recipient_email,
          recipient_type,
          order_id: order_id ?? null,
          order_code: order_code ?? null,
          subject,
          body_html: html ?? null,
          status: "pending",
          error_message: errorMsg,
          attempts: 0,
          idempotency_key,
          metadata,
        });
      }

      return new Response(
        JSON.stringify({
          ok: false,
          status: "pending",
          error: errorMsg,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Dispatch to Resend API
    let isSuccess = false;
    let providerMessageId: string | null = null;
    let errorDetail: string | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= 2; attempt++) {
      attempts = attempt;
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [recipient_email],
            subject,
            html: html || undefined,
            text: text || undefined,
          }),
        });

        const resData = await resendRes.json().catch(() => ({}));

        if (resendRes.ok && resData?.id) {
          isSuccess = true;
          providerMessageId = String(resData.id);
          break;
        } else {
          errorDetail =
            resData?.message ||
            resData?.error?.message ||
            `HTTP ${resendRes.status}: ${resendRes.statusText}`;
        }
      } catch (err: any) {
        errorDetail = err.message || "Network error calling Resend API";
      }

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    const status = isSuccess ? "sent" : "failed";
    const sentAt = isSuccess ? new Date().toISOString() : null;

    // 4. Save notification log
    let insertedId: string | null = null;
    if (supabase) {
      const { data: inserted, error: insertError } = await supabase
        .from("email_notifications")
        .upsert({
          event_type,
          recipient_email,
          recipient_type,
          order_id: order_id ?? null,
          order_code: order_code ?? null,
          subject,
          body_html: html ?? null,
          status,
          provider_message_id: providerMessageId,
          error_message: isSuccess ? null : errorDetail,
          attempts,
          idempotency_key,
          metadata,
          sent_at: sentAt,
        })
        .select("id")
        .single();

      if (inserted) insertedId = inserted.id;
      if (insertError) {
        console.warn("[email-send] Supabase logging warning:", insertError);
      }
    }

    return new Response(
      JSON.stringify({
        ok: isSuccess,
        status,
        notification_id: insertedId,
        provider_message_id: providerMessageId,
        error: isSuccess ? null : errorDetail,
        attempts,
      }),
      {
        status: isSuccess ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
