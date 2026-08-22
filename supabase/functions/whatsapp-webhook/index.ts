// Supabase Edge Function: whatsapp-webhook
// Handles Meta Webhook verification (GET) and status callbacks / inbound events (POST).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // 1. GET: Webhook Verification from Meta Business Platform
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const expectedToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "kickpoint_verify_token_2026";

    if (mode === "subscribe" && token === expectedToken) {
      console.log("[whatsapp-webhook] Meta Webhook verified successfully");
      return new Response(challenge, { status: 200 });
    }

    console.warn("[whatsapp-webhook] Verification failed - token mismatch or invalid mode");
    return new Response("Forbidden", { status: 403 });
  }

  // 2. OPTIONS for CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 3. POST: Inbound notifications & status updates from Meta
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("[whatsapp-webhook] Received Meta payload:", JSON.stringify(body));

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Process message status updates (sent, delivered, read, failed)
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.statuses && Array.isArray(value.statuses)) {
        for (const st of value.statuses) {
          const messageId = st.id;
          const status = st.status; // 'sent' | 'delivered' | 'read' | 'failed'
          const errors = st.errors;

          if (messageId) {
            const updatePayload: Record<string, any> = {
              metadata: { last_webhook_status: status, webhook_payload: st },
            };

            if (status === "failed") {
              updatePayload.status = "failed";
              updatePayload.error_message = errors?.[0]?.message || "Delivery failed according to Meta webhook";
            }

            await supabase
              .from("whatsapp_notifications")
              .update(updatePayload)
              .eq("provider_message_id", messageId);
          }
        }
      }

      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("[whatsapp-webhook] Error processing webhook:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 200, // Return 200 to Meta so it does not retry on bad body
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
});
