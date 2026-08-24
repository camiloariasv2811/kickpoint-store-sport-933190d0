import { createFileRoute } from "@tanstack/react-router";

// Scheduled endpoint: refreshes the BCV and USDT/parallel rates once a day.
// Called by pg_cron with the project's publishable key in the `apikey` header.
export const Route = createFileRoute("/api/public/hooks/update-exchange-rates")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey =
          request.headers.get("apikey") ||
          (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

        const expectedKey =
          process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

        if (!apiKey || !expectedKey || apiKey !== expectedKey) {
          return new Response(JSON.stringify({ error: "No autorizado" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { refreshExchangeRates } = await import("@/lib/exchange-rates.server");
        const result = await refreshExchangeRates();

        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 502,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
