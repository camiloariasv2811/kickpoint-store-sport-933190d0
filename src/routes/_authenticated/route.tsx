import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      if (!isSupabaseConfigured()) {
        // Entorno local sin credenciales del backend
        if (isMounted) {
          setAuthorized(true);
          setChecking(false);
        }
        return;
      }


      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          if (isMounted) {
            navigate({ to: "/auth", replace: true });
          }
        } else {
          if (isMounted) {
            setAuthorized(true);
            setChecking(false);
          }
        }
      } catch {
        if (isMounted) {
          navigate({ to: "/auth", replace: true });
        }
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <Outlet />;
}
