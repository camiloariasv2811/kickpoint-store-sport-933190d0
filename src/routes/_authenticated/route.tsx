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
      // Limpia el antiguo indicador de demo que provocaba tokens inválidos
      if (typeof window !== "undefined") {
        localStorage.removeItem("kp_demo_auth");
      }

      if (!isSupabaseConfigured()) {
        // Entorno local sin credenciales del backend
        if (isMounted) {
          setAuthorized(true);
          setChecking(false);
        }
        return;
      }

      // 1) Sesión local (sin red): permite entrar de inmediato en móvil.
      let hasLocalSession = false;
      try {
        const { data: local } = await supabase.auth.getSession();
        hasLocalSession = Boolean(local?.session);
        if (hasLocalSession && isMounted) {
          setAuthorized(true);
          setChecking(false);
        }
      } catch {
        // continúa con la verificación remota
      }

      // 2) Verificación remota con límite de tiempo para no quedar colgado
      //    si la red móvil se cae a mitad de la petición.
      try {
        const remote = await Promise.race([
          supabase.auth.getUser(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
        ]);

        if (!isMounted) return;

        if (remote === null) {
          // Sin respuesta del servidor: si hay sesión guardada seguimos
          // adelante; si no, al login en vez de dejar la pantalla en blanco.
          if (hasLocalSession) {
            setChecking(false);
          } else {
            navigate({ to: "/auth", replace: true });
          }
          return;
        }

        const { data, error } = remote;
        if (error || !data?.user) {
          navigate({ to: "/auth", replace: true });
          return;
        }

        setAuthorized(true);
        setChecking(false);
      } catch {
        if (!isMounted) return;
        if (hasLocalSession) {
          setChecking(false);
        } else {
          navigate({ to: "/auth", replace: true });
        }
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (checking || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
