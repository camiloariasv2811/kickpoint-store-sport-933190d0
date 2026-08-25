import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function RouteSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground">Cargando...</p>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes cache validity
        gcTime: 1000 * 60 * 10, // 10 minutes garbage collection
        refetchOnWindowFocus: false,
        // En móvil las redes se cortan: reintenta poco y rápido en vez de
        // dejar la pantalla bloqueada esperando.
        retry: 1,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 1000 * 60 * 2, // 2 minutes prefetch cache freshness
    // Muestra un indicador si la ruta tarda, en lugar de que la app parezca congelada.
    defaultPendingComponent: RouteSpinner,
    defaultPendingMs: 300,
    defaultPendingMinMs: 200,
  });

  return router;
};
