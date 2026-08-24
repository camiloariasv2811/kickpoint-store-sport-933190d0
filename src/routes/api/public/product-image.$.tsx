import { createFileRoute } from "@tanstack/react-router";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

/**
 * Sirve las imágenes de producto guardadas en el bucket privado `product-images`.
 * Se cachea de forma inmutable para que el HTML solo transporte una URL corta
 * en lugar de la imagen completa.
 */
export const Route = createFileRoute("/api/public/product-image/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = (params as { _splat?: string })._splat ?? "";
        const path = decodeURIComponent(raw).replace(/^\/+/, "");

        // Evita path traversal y rutas vacías
        if (!path || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.storage.from("product-images").download(path);
          if (error || !data) {
            return new Response("Not found", { status: 404 });
          }

          const ext = path.split(".").pop()?.toLowerCase() ?? "";
          const contentType =
            data.type && data.type !== "application/octet-stream"
              ? data.type
              : (CONTENT_TYPES[ext] ?? "image/jpeg");

          return new Response(await data.arrayBuffer(), {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        } catch (err) {
          console.error("[product-image] error:", err);
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
