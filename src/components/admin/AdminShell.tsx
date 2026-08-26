import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  BarChart3,

  Boxes,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileDown,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShoppingBag,
  Store,
  Tags,
  Users,
} from "lucide-react";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

import { EmailDeliveryAlerts } from "@/components/admin/EmailDeliveryAlerts";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { getPendingAdminBadges } from "@/lib/orders.functions";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, badgeKey: null },
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, badgeKey: "pendingOrders" },
  { to: "/admin/ventas", label: "Ventas", icon: BarChart3, badgeKey: null },
  { to: "/admin/inventario", label: "Inventario", icon: Boxes, badgeKey: null },
  { to: "/admin/kardex", label: "Kárdex", icon: History, badgeKey: null },
  { to: "/admin/productos", label: "Productos", icon: ShoppingBag, badgeKey: null },
  { to: "/admin/orden-catalogo", label: "Orden catálogo", icon: ArrowUpDown, badgeKey: null },
  { to: "/admin/catalogo-pdf", label: "Catálogo PDF", icon: FileDown, badgeKey: null },

  { to: "/admin/categorias", label: "Categorías", icon: Tags, badgeKey: null },
  { to: "/admin/clientes", label: "Clientes", icon: Users, badgeKey: null },
  { to: "/admin/pagos", label: "Pagos", icon: CreditCard, badgeKey: "pendingPayments" },
  { to: "/admin/reportes", label: "Reportes", icon: FileBarChart, badgeKey: null },
  { to: "/admin/configuracion", label: "Configuración", icon: Settings, badgeKey: null },
] as const;

function NavList({
  onNavigate,
  badges,
}: {
  onNavigate?: () => void;
  badges?: { pendingOrders: number; pendingPayments: number };
}) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const badgeCount =
          item.badgeKey && badges ? badges[item.badgeKey as keyof typeof badges] : 0;

        return (
          <Link
            key={item.to}
            to={item.to}
            preload="intent"
            onClick={onNavigate}
            activeOptions={{ exact: Boolean((item as { exact?: boolean }).exact) }}
            activeProps={{
              className: "bg-sidebar-accent text-primary border-primary/40",
            }}
            className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-primary"
          >
            <div className="flex items-center gap-3">
              <item.icon className="size-4.5 shrink-0" />
              <span>{item.label}</span>
            </div>
            {badgeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white shadow-sm animate-pulse">
                {badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

type AdminShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const AdminShellContext = createContext(false);

export function AdminShell(props: AdminShellProps) {
  const isInsideAdminShell = useContext(AdminShellContext);
  if (isInsideAdminShell) return <AdminPage {...props} />;
  return <AdminFrame>{props.children}</AdminFrame>;
}

function AdminPage({ title, subtitle, actions, children }: AdminShellProps) {
  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
        <div className="min-w-0">
          <h1 className="text-display truncate text-xl">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </header>
      <main className="flex-1 space-y-4 p-4 sm:p-6">
        <EmailDeliveryAlerts compact />
        {children}
      </main>
    </>
  );
}

function AdminFrame({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: badges } = useQuery({
    queryKey: ["admin", "pending-badges"],
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const res = await getPendingAdminBadges();
      return res ?? { pendingOrders: 0, pendingPayments: 0 };
    },
  });

  // Subscribe to real-time events on orders and payments for immediate badge updates
  useEffect(() => {
    const channel = supabase
      .channel("admin-shell-badges-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "pending-badges"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "pending-badges"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // En móvil el navegador suspende la pestaña: al volver, reactivamos los datos
  // y la conexión en tiempo real para que la vista no quede "pegada".
  useEffect(() => {
    if (typeof document === "undefined") return;

    const resume = () => {
      if (document.visibilityState !== "visible") return;
      supabase.realtime.connect();
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    };

    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);

    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [queryClient]);

  async function signOut() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("kp_demo_auth");
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AdminShellContext.Provider value>
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <Logo />
          <p className="text-eyebrow mt-1 text-[0.6rem] text-primary">Portal del vendedor</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList badges={badges} />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" /> Cerrar sesión
          </Button>
          <Button asChild variant="ghost" className="w-full justify-start">
            <Link to="/">
              <Store className="size-4" /> Ver tienda
            </Link>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-40 flex h-16 items-center border-b border-border bg-background px-4 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menú">
                <Menu className="size-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetTitle className="sr-only">Menú administrativo</SheetTitle>
              <div className="border-b border-sidebar-border px-5 py-5">
                <Logo />
              </div>
              <NavList onNavigate={() => setOpen(false)} badges={badges} />
              <div className="border-t border-sidebar-border p-3">
                <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
                  <LogOut className="size-4" /> Cerrar sesión
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        {children}
      </div>
    </div>
    </AdminShellContext.Provider>
  );
}
