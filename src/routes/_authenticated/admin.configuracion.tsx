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
  const [methodDetails, setMethodDetails] = useState<Record<string, string>>({});
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
    const d: Record<string, string> = {};
    if (m.details && typeof m.details === "object") {
      Object.entries(m.details).forEach(([k, v]) => {
        d[k] = v != null ? String(v) : "";
      });
    }
    setMethodDetails(d);
  }

  function updateDetailField(key: string, value: string) {
    setMethodDetails((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSaveMethod() {
    if (!editingMethod) return;
    setSavingMethod(true);
    try {
      // Clean empty details
      const cleanedDetails: Record<string, string> = {};
      Object.entries(methodDetails).forEach(([k, v]) => {
        if (v && v.trim()) cleanedDetails[k] = v.trim();
      });

      // Auto-generate instructions if empty
      let finalInstructions = methodInstructions.trim();
      if (!finalInstructions) {
        if (editingMethod.code === "pago_movil") {
          finalInstructions = [
            cleanedDetails.banco ? `Banco: ${cleanedDetails.banco}` : "",
            cleanedDetails.telefono ? `Teléfono: ${cleanedDetails.telefono}` : "",
            cleanedDetails.cedula ? `C.I./RIF: ${cleanedDetails.cedula}` : "",
            cleanedDetails.titular ? `Titular: ${cleanedDetails.titular}` : "",
          ]
            .filter(Boolean)
            .join(" | ");
        } else if (editingMethod.code === "zelle") {
          finalInstructions = [
            cleanedDetails.email ? `Email: ${cleanedDetails.email}` : "",
            cleanedDetails.titular ? `Titular: ${cleanedDetails.titular}` : "",
          ]
            .filter(Boolean)
            .join(" | ");
        } else if (editingMethod.code === "usdt") {
          finalInstructions = [
            cleanedDetails.red ? `Red: ${cleanedDetails.red}` : "",
            cleanedDetails.direccion ? `Wallet: ${cleanedDetails.direccion}` : "",
            cleanedDetails.memo ? `Memo: ${cleanedDetails.memo}` : "",
          ]
            .filter(Boolean)
            .join(" | ");
        } else if (editingMethod.code === "transferencia") {
          finalInstructions = [
            cleanedDetails.banco ? `Banco: ${cleanedDetails.banco}` : "",
            cleanedDetails.numero_cuenta ? `Cuenta: ${cleanedDetails.numero_cuenta}` : "",
            cleanedDetails.titular ? `Titular: ${cleanedDetails.titular}` : "",
            cleanedDetails.cedula ? `C.I./RIF: ${cleanedDetails.cedula}` : "",
          ]
            .filter(Boolean)
            .join(" | ");
        }
      }

      await updatePaymentMethod({
        data: {
          id: editingMethod.id,
          name: methodName.trim(),
          active: methodActive,
          instructions: finalInstructions || null,
          details: cleanedDetails,
        },
      });
      toast.success(`Método "${methodName}" actualizado con éxito`);
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
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-start"
                >
                  <div className="space-y-1.5 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground">{m.name}</p>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                        {m.code}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          m.active
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {m.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>

                    {/* Specific details pills */}
                    {m.details && Object.keys(m.details).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {Object.entries(m.details).map(([k, v]) => (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1 rounded border border-border bg-surface-2/60 px-2 py-0.5 text-[11px] text-foreground"
                          >
                            <span className="font-semibold text-muted-foreground capitalize">
                              {k.replace(/_/g, " ")}:
                            </span>
                            <span className="font-mono">{String(v)}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {m.instructions || "Sin instrucciones configuradas."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditMethod(m)}
                      className="h-8 gap-1.5 text-xs font-semibold"
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {editingMethod && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-display text-xl">
                    Configurar {editingMethod.name}
                  </DialogTitle>
                  <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-xs uppercase text-muted-foreground">
                    {editingMethod.code}
                  </span>
                </div>
                <DialogDescription>
                  Define los datos bancarios y campos específicos que el cliente verá al realizar su
                  pago.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div>
                  <Label htmlFor="m-name" className="font-semibold text-foreground">
                    Nombre Visible para el Cliente
                  </Label>
                  <Input
                    id="m-name"
                    value={methodName}
                    onChange={(e) => setMethodName(e.target.value)}
                    className="mt-1"
                    placeholder="Ej: Pago Móvil BDV / Banesco"
                  />
                </div>

                {/* Specific Fields for PAGO MOVIL */}
                {editingMethod.code === "pago_movil" && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3">
                    <p className="font-bold text-primary flex items-center gap-1.5 text-xs">
                      <CreditCard className="size-4" /> Datos de Pago Móvil
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="pm-banco" className="font-semibold">
                          Banco
                        </Label>
                        <Input
                          id="pm-banco"
                          value={methodDetails.banco || ""}
                          onChange={(e) => updateDetailField("banco", e.target.value)}
                          placeholder="Ej: Banesco (0134), BDV (0102)"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="pm-telefono" className="font-semibold">
                          Teléfono Pago Móvil
                        </Label>
                        <Input
                          id="pm-telefono"
                          value={methodDetails.telefono || ""}
                          onChange={(e) => updateDetailField("telefono", e.target.value)}
                          placeholder="Ej: 0412-1234567"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="pm-cedula" className="font-semibold">
                          Cédula / RIF
                        </Label>
                        <Input
                          id="pm-cedula"
                          value={methodDetails.cedula || ""}
                          onChange={(e) => updateDetailField("cedula", e.target.value)}
                          placeholder="Ej: V-12.345.678 / J-12345678-0"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="pm-titular" className="font-semibold">
                          Nombre del Titular
                        </Label>
                        <Input
                          id="pm-titular"
                          value={methodDetails.titular || ""}
                          onChange={(e) => updateDetailField("titular", e.target.value)}
                          placeholder="Ej: Inversiones Kickpoint C.A."
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Specific Fields for ZELLE */}
                {editingMethod.code === "zelle" && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3">
                    <p className="font-bold text-primary flex items-center gap-1.5 text-xs">
                      <CreditCard className="size-4" /> Datos de Zelle
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label htmlFor="zl-email" className="font-semibold">
                          Correo Electrónico Zelle
                        </Label>
                        <Input
                          id="zl-email"
                          type="email"
                          value={methodDetails.email || ""}
                          onChange={(e) => updateDetailField("email", e.target.value)}
                          placeholder="Ej: pagos@kickpointstore.com"
                          className="mt-1"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="zl-titular" className="font-semibold">
                          Nombre del Titular de la Cuenta
                        </Label>
                        <Input
                          id="zl-titular"
                          value={methodDetails.titular || ""}
                          onChange={(e) => updateDetailField("titular", e.target.value)}
                          placeholder="Ej: Kickpoint Sports LLC"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Specific Fields for USDT */}
                {(editingMethod.code === "usdt" ||
                  editingMethod.code === "binance" ||
                  editingMethod.code === "cripto") && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3">
                    <p className="font-bold text-primary flex items-center gap-1.5 text-xs">
                      <CreditCard className="size-4" /> Datos de USDT / Cripto
                    </p>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="usdt-red" className="font-semibold">
                          Red / Protocolo (Network)
                        </Label>
                        <Input
                          id="usdt-red"
                          value={methodDetails.red || ""}
                          onChange={(e) => updateDetailField("red", e.target.value)}
                          placeholder="Ej: TRON (TRC-20) / BSC (BEP-20)"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="usdt-dir" className="font-semibold">
                          Dirección de Billetera (Wallet Address)
                        </Label>
                        <Input
                          id="usdt-dir"
                          value={methodDetails.direccion || ""}
                          onChange={(e) => updateDetailField("direccion", e.target.value)}
                          placeholder="Ej: TYDzmE2z5UaXzH..."
                          className="mt-1 font-mono"
                        />
                      </div>
                      <div>
                        <Label htmlFor="usdt-memo" className="font-semibold">
                          Memo / ID / Nota Adicional (Opcional)
                        </Label>
                        <Input
                          id="usdt-memo"
                          value={methodDetails.memo || ""}
                          onChange={(e) => updateDetailField("memo", e.target.value)}
                          placeholder="Ej: Binance Pay ID: 12345678"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Specific Fields for Transferencia */}
                {(editingMethod.code === "transferencia" || editingMethod.code === "banco") && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3">
                    <p className="font-bold text-primary flex items-center gap-1.5 text-xs">
                      <CreditCard className="size-4" /> Datos de Cuenta Bancaria
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="tr-banco" className="font-semibold">
                          Banco
                        </Label>
                        <Input
                          id="tr-banco"
                          value={methodDetails.banco || ""}
                          onChange={(e) => updateDetailField("banco", e.target.value)}
                          placeholder="Ej: Banesco Banco Universal"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tr-tipo" className="font-semibold">
                          Tipo de Cuenta
                        </Label>
                        <Input
                          id="tr-tipo"
                          value={methodDetails.tipo || ""}
                          onChange={(e) => updateDetailField("tipo", e.target.value)}
                          placeholder="Ej: Corriente / Ahorros"
                          className="mt-1"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="tr-cuenta" className="font-semibold">
                          Número de Cuenta (20 dígitos)
                        </Label>
                        <Input
                          id="tr-cuenta"
                          value={methodDetails.numero_cuenta || ""}
                          onChange={(e) => updateDetailField("numero_cuenta", e.target.value)}
                          placeholder="Ej: 0134-0000-00-0000000000"
                          className="mt-1 font-mono"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tr-titular" className="font-semibold">
                          Titular
                        </Label>
                        <Input
                          id="tr-titular"
                          value={methodDetails.titular || ""}
                          onChange={(e) => updateDetailField("titular", e.target.value)}
                          placeholder="Ej: Kickpoint C.A."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tr-cedula" className="font-semibold">
                          C.I. o RIF
                        </Label>
                        <Input
                          id="tr-cedula"
                          value={methodDetails.cedula || ""}
                          onChange={(e) => updateDetailField("cedula", e.target.value)}
                          placeholder="Ej: J-12345678-0"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="m-inst" className="font-semibold text-foreground">
                    Instrucciones / Texto Adicional para el Cliente
                  </Label>
                  <Textarea
                    id="m-inst"
                    rows={3}
                    value={methodInstructions}
                    onChange={(e) => setMethodInstructions(e.target.value)}
                    placeholder="Si lo dejas en blanco, se generará automáticamente a partir de los datos configurados arriba."
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Este texto se mostrará en el checkout y en la pantalla de confirmación y carga
                    de comprobante.
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <Switch id="m-act" checked={methodActive} onCheckedChange={setMethodActive} />
                  <div>
                    <Label htmlFor="m-act" className="cursor-pointer font-semibold">
                      Método de pago activo
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Si se desactiva, los clientes no podrán seleccionarlo en el checkout.
                    </p>
                  </div>
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
