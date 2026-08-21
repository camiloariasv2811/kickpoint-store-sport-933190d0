import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { isNotFound, isRedirect } from "@tanstack/react-router";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Pass through redirects, notFound signals, Responses, and errors with status codes
    if (
      isRedirect(error) ||
      isNotFound(error) ||
      error instanceof Response ||
      (error != null && typeof error === "object" && ("statusCode" in error || "status" in error))
    ) {
      throw error;
    }
    console.error("[TanStack Start SSR Error]:", error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// CSRF protection for mutation requests (POST/PUT/DELETE)
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => {
    if (ctx.handlerType !== "serverFn") return false;
    const method = ctx.request?.method?.toUpperCase();
    // Do not block idempotent GET/HEAD requests with CSRF checks behind reverse proxies
    return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  },
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
