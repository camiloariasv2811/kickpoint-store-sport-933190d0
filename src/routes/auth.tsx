import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, Lock, LogIn, MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso del equipo | KICKPOINT" },
      {
        name: "description",
        content: "Inicio de sesión del portal administrativo de KICKPOINT.",
      },
      { property: "og:title", content: "Acceso del equipo | KICKPOINT" },
      { property: "og:description", content: "Portal administrativo de KICKPOINT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "recover";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("kp_demo_auth");
      }

      if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setRecoverySent(true);
        toast.success("Enlace enviado", {
          description: "Revisa tu correo para crear una nueva contraseña.",
        });
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/admin",
            data: { full_name: name },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Cuenta creada", {
            description: "Revisa tu correo para confirmar el acceso.",
          });
          return;
        }
        navigate({ to: "/admin", replace: true });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/admin", replace: true });
    } catch (error) {
      toast.error("No pudimos completar la operación", {
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("kp_demo_auth");
      }
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast.error("No pudimos iniciar sesión con Google", {
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
      });
      setLoading(false);
    }
  }

  const title =
    mode === "login" ? "Iniciar sesión" : mode === "signup" ? "Crear cuenta" : "Recuperar acceso";

  return (
    <div className="flex min-h-screen items-center justify-center bg-grid px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo />
          <p className="text-eyebrow text-[0.65rem] text-primary">Portal del equipo</p>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center gap-2">
            {mode === "recover" ? (
              <KeyRound className="size-5 text-primary" />
            ) : (
              <Lock className="size-5 text-primary" />
            )}
            <h1 className="text-display text-2xl">{title}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "recover"
              ? "Te enviaremos un enlace seguro para crear una contraseña nueva."
              : "Acceso para administradores, vendedores y clientes de KICKPOINT."}
          </p>

          {mode === "recover" && recoverySent ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
                <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Enviamos un enlace a <span className="text-foreground">{email}</span>. Ábrelo
                  desde este mismo dispositivo para crear tu nueva contraseña. El enlace caduca en
                  poco tiempo.
                </p>
              </div>
              <Button
                variant="dark"
                size="lg"
                className="w-full"
                onClick={() => {
                  setRecoverySent(false);
                  setMode("login");
                }}
              >
                Volver a iniciar sesión
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nombre completo</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11"
                      required
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                {mode !== "recover" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="password">Contraseña</Label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={() => setMode("recover")}
                          className="text-xs text-muted-foreground hover:text-primary"
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11"
                      minLength={6}
                      required
                    />
                  </div>
                )}
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={loading}
                >
                  {mode === "recover" ? <KeyRound className="size-5" /> : <LogIn className="size-5" />}
                  {mode === "login"
                    ? "Entrar"
                    : mode === "signup"
                      ? "Registrarme"
                      : "Enviar enlace de recuperación"}
                </Button>
              </form>

              {mode !== "recover" && (
                <>
                  <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> o{" "}
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <Button
                    variant="dark"
                    size="lg"
                    className="w-full"
                    onClick={handleGoogle}
                    disabled={loading}
                  >
                    Continuar con Google
                  </Button>
                </>
              )}

              <button
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-primary"
              >
                {mode === "login"
                  ? "No tengo cuenta, quiero registrarme"
                  : mode === "signup"
                    ? "Ya tengo cuenta"
                    : "Volver a iniciar sesión"}
              </button>
            </>
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
