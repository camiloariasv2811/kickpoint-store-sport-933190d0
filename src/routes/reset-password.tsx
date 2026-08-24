import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Restablecer contraseña | KICKPOINT" },
      {
        name: "description",
        content: "Crea una nueva contraseña para tu cuenta de KICKPOINT.",
      },
      { property: "og:title", content: "Restablecer contraseña | KICKPOINT" },
      {
        property: "og:description",
        content: "Recupera el acceso a tu cuenta de KICKPOINT con un enlace seguro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const search = typeof window !== "undefined" ? window.location.search : "";
    const looksLikeRecovery =
      hash.includes("type=recovery") ||
      hash.includes("access_token") ||
      search.includes("code=") ||
      search.includes("token_hash=");

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || (session && looksLikeRecovery)) {
        setHasRecovery(true);
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasRecovery(Boolean(data.session) && looksLikeRecovery);
      setReady(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada", {
        description: "Ya puedes entrar con tu nueva contraseña.",
      });
      navigate({ to: "/admin", replace: true });
    } catch (error) {
      toast.error("No pudimos actualizar la contraseña", {
        description: error instanceof Error ? error.message : "Solicita un enlace nuevo.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-grid px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo />
          <p className="text-eyebrow text-[0.65rem] text-primary">Recuperación de acceso</p>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h1 className="text-display text-2xl">Nueva contraseña</h1>
          </div>

          {!ready ? (
            <p className="mt-4 text-sm text-muted-foreground">Validando el enlace…</p>
          ) : hasRecovery ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Define una contraseña de al menos 8 caracteres para tu cuenta.
              </p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">Nueva contraseña</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11"
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Repetir contraseña</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="h-11"
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={loading}
                >
                  <KeyRound className="size-5" />
                  Guardar contraseña
                </Button>
              </form>
            </>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Este enlace no es válido o ya caducó. Solicita uno nuevo desde la pantalla de
                acceso.
              </p>
              <Link to="/auth">
                <Button variant="dark" size="lg" className="w-full">
                  Solicitar nuevo enlace
                </Button>
              </Link>
            </div>
          )}
        </div>

        <Link
          to="/"
          className="mt-5 block text-center text-sm text-muted-foreground hover:text-primary"
        >
          ← Volver a la tienda
        </Link>
      </div>
    </div>
  );
}
