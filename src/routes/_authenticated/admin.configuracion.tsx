import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Settings as SettingsIcon,
  CreditCard,
  Phone,
  Truck,
  DollarSign,
  Shield,
  Save,
  Loader2,
  Edit2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getStoreSettings,
  updateStoreSettings,
  listAllPaymentMethods,
  updatePaymentMethod,
  listStaffUsers,
  type StoreSettings,
  type PaymentMethodRow,
} from "@/lib/settings.functions";

export const Route = createFileRoute("/_authenticated/admin/configuracion")({
  component: AdminConfiguracion,
});

function AdminConfiguracion() {
  const queryClient = useQueryClient();
  const [savingSettings, setSavingSettings] = useState(false);

  // Store General Settings
  const [whatsapp, setWhatsapp] = useState("");
  const [shippingFlat, setShippingFlat] = useState("0");
  const [exchangeRate, setExchangeRate] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");

  // Payment Method Modal
  const [editingMethod, setEditingMethod] = useState<PaymentMethodRow | null>(null);
  const [methodName, setMethodName] = useState("");
  const [methodActive, setMethodActive] = useState(true);
  const [methodInstructions, setMethodInstructions] = useState("");
  const [savingMethod, setSavingMethod] = useState(false);

  const { data: settings, isLoading: loadingSettings } = useQuery<StoreSettings>({
    queryKey: ["admin", "settings", "store"],
    queryFn: () => getStoreSettings(),
  });

  const { data: paymentMethods = [], isLoading: loadingMethods } = useQuery<PaymentMethodRow[]>({
    queryKey: ["admin", "payment-methods"],
    queryFn: () => listAllPaymentMethods(),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => listStaffUsers(),
  });

  useEffect(() => {
    if (settings) {
      setWhatsapp(settings.whatsapp ?? "+58 412 0000000");
      setShippingFlat(String(settings.shipping_flat ?? 0));
      setExchangeRate(String(settings.exchange_rate_bs ?? 40));
      setLowStockThreshold(String(settings.low_stock_threshold ?? 5));
    }
  }, [settings]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await updateStoreSettings({
        data: {
          whatsapp: whatsapp.trim(),
          shipping_flat: parseFloat(shippingFlat) || 0,
          exchange_rate_bs: parseFloat(exchangeRate) || 0,
          low_stock_threshold: parseInt(lowStockThreshold, 10) || 5,
        },
      });
      toast.success("Configuración general guardada exitosamente");
      await queryClient.invalidateQueries({ queryKey: ["admin", "settings", "store"] });
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al guardar: ${err.message || "Error desconocido"}`);
    } finally {
      setSavingSettings(false);
    }
  }

  function openEditMethod(m: PaymentMethodRow) {
    setEditingMethod(m);
    setMethodName(m.name);
    setMethodActive(m.active);
    setMethodInstructions(m.instructions || "");
  }

  async function handleSaveMethod() {
    if (!editingMethod) return;
    setSavingMethod(true);
    try {
      await updatePaymentMethod({
        data: {
          id: editingMethod.id,
          name: methodName.trim(),
          active: methodActive,
          instructions: methodInstructions.trim() || null,
        },
      });
      toast.success(`Método "${methodName}" actualizado`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "payment-methods"] });
      await queryClient.invalidateQueries({ queryKey: ["checkout", "payment-methods"] });
      setEditingMethod(null);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message || "Error al actualizar método"}`);
    } finally {
      setSavingMethod(false);
    }
  }

  async function handleToggleMethodQuick(m: PaymentMethodRow) {
    try {
      await updatePaymentMethod({
        data: {
          id: m.id,
          active: !m.active,
        },
      });
      toast.success(`${m.name} ${!m.active ? "activado" : "desactivado"}`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "payment-methods"] });
      await queryClient.invalidateQueries({ queryKey: ["checkout", "payment-methods"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <AdminShell
      title="Configuración"
      subtitle="Parámetros de la tienda, métodos de pago bancarios y control de acceso"
    >
      <div className="space-y-6">
        {/* Parametros Generales */}
        <div className="surface-card p-6">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <SettingsIcon className="size-5 text-primary" />
            <h2 className="text-display text-lg font-bold">Parámetros de la Tienda</h2>
          </div>

          {loadingSettings ? (
            <Skeleton className="mt-4 h-48 w-full" />
          ) : (
            <form onSubmit={handleSaveSettings} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="s-wpp" className="flex items-center gap-1.5 font-semibold">
                    <Phone className="size-3.5 text-muted-foreground" />
                    WhatsApp Oficial de Atención
                  </Label>
                  <Input
                    id="s-wpp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+58 412 1234567"
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Los botones de WhatsApp del catálogo y soporte enviarán los mensajes a este
                    número.
                  </p>
                </div>

                <div>
                  <Label htmlFor="s-ship" className="flex items-center gap-1.5 font-semibold">
                    <Truck className="size-3.5 text-muted-foreground" />
                    Costo Fijo de Envío ($)
                  </Label>
                  <Input
                    id="s-ship"
                    type="number"
                    step="0.5"
                    value={shippingFlat}
                    onChange={(e) => setShippingFlat(e.target.value)}
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Coloca 0 si el envío es gratis o se coordina con cobro en destino.
                  </p>
                </div>

                <div>
                  <Label htmlFor="s-rate" className="flex items-center gap-1.5 font-semibold">
                    <DollarSign className="size-3.5 text-muted-foreground" />
                    Tasa de Cambio Referencial (Bs/USD)
                  </Label>
                  <Input
                    id="s-rate"
                    type="number"
                    step="0.01"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="s-stock" className="flex items-center gap-1.5 font-semibold">
                    Alerta de Stock Bajo (Umbral por defecto)
                  </Label>
                  <Input
                    id="s-stock"
                    type="number"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" variant="hero" disabled={savingSettings} className="gap-1.5">
                  {savingSettings ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Guardar Parámetros
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Métodos de Pago */}
        <div className="surface-card p-6">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <CreditCard className="size-5 text-primary" />
            <h2 className="text-display text-lg font-bold">Cuentas y Métodos de Pago</h2>
          </div>

          {loadingMethods ? (
            <Skeleton className="mt-4 h-48 w-full" />
          ) : (
            <div className="mt-4 divide-y divide-border">
              {paymentMethods.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{m.name}</p>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                        {m.code}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          m.active
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {m.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.instructions || "Sin instrucciones bancarias configuradas."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditMethod(m)}
                      className="h-8 gap-1 text-xs"
                    >
                      <Edit2 className="size-3.5" /> Editar Datos
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleMethodQuick(m)}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {m.active ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Roles y Equipo */}
        <div className="surface-card p-6">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Shield className="size-5 text-primary" />
            <h2 className="text-display text-lg font-bold">Equipo y Roles Administrativos</h2>
          </div>

          <div className="mt-4 divide-y divide-border">
            {staff.length === 0 ? (
              <p className="py-4 text-xs text-muted-foreground">
                No hay usuarios con roles explícitos asignados.
              </p>
            ) : (
              staff.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-3 text-xs">
                  <div>
                    <p className="font-semibold text-foreground">
                      {u.profile?.full_name ?? "Usuario Staff"}
                    </p>
                    <p className="text-muted-foreground">{u.profile?.email}</p>
                  </div>
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 font-bold uppercase text-primary">
                    {u.role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Editar Método Modal */}
      <Dialog open={Boolean(editingMethod)} onOpenChange={(v) => !v && setEditingMethod(null)}>
        <DialogContent className="max-w-md">
          {editingMethod && (
            <>
              <DialogHeader>
                <DialogTitle>Configurar {editingMethod.name}</DialogTitle>
                <DialogDescription>
                  Instrucciones que verá el cliente durante el checkout al pagar con este método.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs">
                <div>
                  <Label htmlFor="m-name">Nombre Visible</Label>
                  <Input
                    id="m-name"
                    value={methodName}
                    onChange={(e) => setMethodName(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="m-inst">Datos Bancarios / Instrucciones</Label>
                  <Textarea
                    id="m-inst"
                    rows={4}
                    value={methodInstructions}
                    onChange={(e) => setMethodInstructions(e.target.value)}
                    placeholder="Ej: Banco Banesco (0134), Pago Móvil: 0412-1234567, C.I. 12.345.678"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Switch id="m-act" checked={methodActive} onCheckedChange={setMethodActive} />
                  <Label htmlFor="m-act" className="cursor-pointer font-semibold">
                    Método de pago activo para clientes
                  </Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditingMethod(null)}
                  disabled={savingMethod}
                >
                  Cancelar
                </Button>
                <Button variant="hero" onClick={handleSaveMethod} disabled={savingMethod}>
                  {savingMethod ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
