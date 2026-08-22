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
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Mail,
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
import {
  getWhatsAppDashboardStatus,
  sendWhatsAppTest,
  updateWhatsAppNotificationSettings,
  type WhatsAppDashboardStatus,
} from "@/lib/whatsapp.functions";
import {
  getEmailDashboardStatus,
  sendEmailTest,
  type EmailDashboardStatus,
} from "@/lib/email.functions";

export const Route = createFileRoute("/_authenticated/admin/configuracion")({
  component: AdminConfiguracion,
});

function AdminConfiguracion() {
  const queryClient = useQueryClient();
  const [savingSettings, setSavingSettings] = useState(false);

  // Store General Settings
  const [whatsapp, setWhatsapp] = useState("");
  const [shippingFlat, setShippingFlat] = useState("0");
  const [exchangeRateBcv, setExchangeRateBcv] = useState("78.50");
  const [exchangeRateUsdt, setExchangeRateUsdt] = useState("86.20");
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
    queryFn: async () => {
      const res = await getStoreSettings();
      if (!res) throw new Error("No settings");
      return res;
    },
  });

  const { data: paymentMethods = [], isLoading: loadingMethods } = useQuery<PaymentMethodRow[]>({
    queryKey: ["admin", "payment-methods"],
    queryFn: async () => {
      try {
        const res = await listAllPaymentMethods();
        return res ?? [];
      } catch (err) {
        console.warn("[AdminConfiguracion] Error loading payment methods:", err);
        return [];
      }
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: async () => {
      try {
        const res = await listStaffUsers();
        return res ?? [];
      } catch (err) {
        console.warn("[AdminConfiguracion] Error loading staff:", err);
        return [];
      }
    },
  });

  // WhatsApp Cloud API Integration State & Queries
  const {
    data: waStatus,
    isLoading: loadingWaStatus,
    refetch: refetchWaStatus,
  } = useQuery<WhatsAppDashboardStatus>({
    queryKey: ["admin", "whatsapp", "status"],
    queryFn: () => getWhatsAppDashboardStatus(),
  });

  const [testPhone, setTestPhone] = useState("+584121546698");
  const [testMessage, setTestMessage] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [notifyAdminNewOrder, setNotifyAdminNewOrder] = useState(true);
  const [notifyCustomerStatusChange, setNotifyCustomerStatusChange] = useState(true);
  const [savingWaToggles, setSavingWaToggles] = useState(false);

  useEffect(() => {
    if (waStatus) {
      setNotifyAdminNewOrder(waStatus.settings.notifyAdminNewOrder);
      setNotifyCustomerStatusChange(waStatus.settings.notifyCustomerStatusChange);
    }
  }, [waStatus]);

  async function handleToggleWaSetting(key: "admin" | "customer", nextVal: boolean) {
    const nextAdmin = key === "admin" ? nextVal : notifyAdminNewOrder;
    const nextCustomer = key === "customer" ? nextVal : notifyCustomerStatusChange;

    if (key === "admin") setNotifyAdminNewOrder(nextVal);
    if (key === "customer") setNotifyCustomerStatusChange(nextVal);

    setSavingWaToggles(true);
    try {
      await updateWhatsAppNotificationSettings({
        data: {
          notifyAdminNewOrder: nextAdmin,
          notifyCustomerStatusChange: nextCustomer,
        },
      });
      toast.success("Preferencia de notificación de WhatsApp actualizada");
      await queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp", "status"] });
    } catch (err: any) {
      toast.error(`Error al actualizar preferencias: ${err.message || "Error desconocido"}`);
    } finally {
      setSavingWaToggles(false);
    }
  }

  async function handleSendTestMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!testPhone.trim()) {
      toast.error("Ingresa un número de WhatsApp para la prueba");
      return;
    }

    setSendingTest(true);
    try {
      const res = await sendWhatsAppTest({
        data: {
          phone: testPhone.trim(),
          message: testMessage.trim() || undefined,
        },
      });

      if (res.ok && res.providerMessageId) {
        toast.success(
          `WhatsApp enviado a ${testPhone} (ID de Meta: ${res.providerMessageId})`,
        );
      } else if (res.status === "not_configured") {
        toast.error(
          `WhatsApp no configurado. Faltan credenciales: ${(res.missingSecrets ?? []).join(", ")}`,
        );
      } else {
        toast.error(`Meta rechazó el mensaje: ${res.errorMessage || "No se pudo entregar"}`);
      }
      await refetchWaStatus();
    } catch (err: any) {
      toast.error(err.message || "Error al enviar mensaje de prueba");
    } finally {
      setSendingTest(false);
    }
  }

  // Email Notifications (Resend) State & Queries
  const {
    data: emailStatus,
    isLoading: loadingEmailStatus,
    refetch: refetchEmailStatus,
  } = useQuery<EmailDashboardStatus>({
    queryKey: ["admin", "email", "status"],
    queryFn: () => getEmailDashboardStatus(),
  });

  const [testEmailRecipient, setTestEmailRecipient] = useState("camiloariasv2811@gmail.com");
  const [testEmailSubject, setTestEmailSubject] = useState("");
  const [testEmailBody, setTestEmailBody] = useState("");
  const [sendingEmailTest, setSendingEmailTest] = useState(false);

  useEffect(() => {
    if (emailStatus?.adminRecipientEmail) {
      setTestEmailRecipient(emailStatus.adminRecipientEmail);
    }
  }, [emailStatus]);

  async function handleSendEmailTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmailRecipient.trim() || !testEmailRecipient.includes("@")) {
      toast.error("Ingresa un correo electrónico válido para la prueba");
      return;
    }

    setSendingEmailTest(true);
    try {
      const res = await sendEmailTest({
        data: {
          email: testEmailRecipient.trim(),
          subject: testEmailSubject.trim() || undefined,
          message: testEmailBody.trim() || undefined,
        },
      });

      if (res.ok) {
        toast.success(`Correo de prueba enviado exitosamente a ${testEmailRecipient}`);
      } else {
        if (res.status === "pending") {
          toast.info(
            `Notificación registrada en cola (${res.errorMessage || "Falta RESEND_API_KEY"})`,
          );
        } else {
          toast.error(`Error al enviar: ${res.errorMessage || "No se pudo entregar"}`);
        }
      }
      await refetchEmailStatus();
    } catch (err: any) {
      toast.error(err.message || "Error al enviar correo de prueba");
    } finally {
      setSendingEmailTest(false);
    }
  }

  useEffect(() => {
    if (settings) {
      setWhatsapp(settings.whatsapp ?? "+58 412 1546698");
      setShippingFlat(String(settings.shipping_flat ?? 0));
      setExchangeRateBcv(String(settings.exchange_rate_bcv ?? settings.exchange_rate_bs ?? 78.5));
      setExchangeRateUsdt(String(settings.exchange_rate_usdt ?? 86.2));
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
          exchange_rate_bcv: parseFloat(exchangeRateBcv) || 78.5,
          exchange_rate_usdt: parseFloat(exchangeRateUsdt) || 86.2,
          exchange_rate_bs: parseFloat(exchangeRateBcv) || 78.5,
          low_stock_threshold: parseInt(lowStockThreshold, 10) || 5,
        },
      });
      toast.success("Configuración general guardada exitosamente");
      await queryClient.invalidateQueries({ queryKey: ["admin", "settings", "store"] });
      await queryClient.invalidateQueries({ queryKey: ["public", "store-settings"] });
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
                    placeholder="+58 412 1546698"
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
                  <Label htmlFor="s-rate-bcv" className="flex items-center gap-1.5 font-semibold">
                    <DollarSign className="size-3.5 text-muted-foreground" />
                    Tasa Oficial BCV (Bs/USD)
                  </Label>
                  <Input
                    id="s-rate-bcv"
                    type="number"
                    step="0.01"
                    value={exchangeRateBcv}
                    onChange={(e) => setExchangeRateBcv(e.target.value)}
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Utilizada para pagos en bolívares (Pago Móvil / Transferencias).
                  </p>
                </div>

                <div>
                  <Label htmlFor="s-rate-usdt" className="flex items-center gap-1.5 font-semibold">
                    <DollarSign className="size-3.5 text-muted-foreground" />
                    Tasa Paralela / USDT (Bs/USD)
                  </Label>
                  <Input
                    id="s-rate-usdt"
                    type="number"
                    step="0.01"
                    value={exchangeRateUsdt}
                    onChange={(e) => setExchangeRateUsdt(e.target.value)}
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Utilizada si el cliente elige cotización en tasa USDT en checkout.
                  </p>
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

        {/* WhatsApp Business Platform & Notificaciones Automáticas */}
        <div className="surface-card p-6">
          <div className="flex flex-col justify-between gap-2 border-b border-border pb-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <MessageSquare className="size-5" />
              </div>
              <div>
                <h2 className="text-display text-lg font-bold">WhatsApp Business (Cloud API)</h2>
                <p className="text-xs text-muted-foreground">
                  Notificaciones transaccionales automáticas para nuevos pedidos, pagos y despachos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  waStatus?.isConfigured
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    waStatus?.isConfigured ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {waStatus?.isConfigured ? "API Oficial Conectada" : "WhatsApp no configurado"}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetchWaStatus()}
                className="h-8 gap-1 text-xs font-semibold"
              >
                <RefreshCw className="size-3" /> Actualizar
              </Button>
            </div>
          </div>

          {!loadingWaStatus && (waStatus?.missingSecrets?.length ?? 0) > 0 && (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
              <p className="font-semibold">
                Faltan credenciales de Meta WhatsApp Cloud API. No se enviará ningún mensaje real
                hasta configurarlas:
              </p>
              <ul className="mt-1.5 list-inside list-disc font-mono">
                {waStatus?.missingSecrets.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          )}

          {loadingWaStatus ? (
            <Skeleton className="mt-4 h-48 w-full" />
          ) : (
            <div className="mt-5 space-y-6">
              {/* Información de la Cuenta y Métricas */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border bg-surface-2/40 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Número Oficial KICKPOINT
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold text-foreground">
                    {waStatus?.officialNumber || "+58 412 1546698"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Emisor de notificaciones
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-surface-2/40 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Receptor Alertas Admin
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold text-foreground">
                    +{waStatus?.adminRecipientNumber || "584121546698"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Recibe alertas de pedidos
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-surface-2/40 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Enviadas Exitosamente
                  </p>
                  <p className="mt-1 font-mono text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {waStatus?.stats.sent ?? 0}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Entregadas a destinatarios
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-surface-2/40 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Procesadas
                  </p>
                  <p className="mt-1 font-mono text-xl font-extrabold text-foreground">
                    {waStatus?.stats.total ?? 0}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {waStatus?.stats.failed ? `${waStatus.stats.failed} con error` : "0 con error"}
                  </p>
                </div>
              </div>

              {/* Toggles de Eventos Automáticos */}
              <div className="rounded-lg border border-border bg-surface-2/30 p-4 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Reglas de Envío Automático
                </h3>

                <div className="space-y-3 divide-y divide-border/60">
                  <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5 pr-4">
                      <Label
                        htmlFor="toggle-wa-admin"
                        className="text-sm font-semibold text-foreground cursor-pointer"
                      >
                        Notificar al Administrador en nuevos pedidos
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Envía un mensaje de WhatsApp a +58 412 1546698 cada vez que un cliente
                        complete un checkout.
                      </p>
                    </div>
                    <Switch
                      id="toggle-wa-admin"
                      checked={notifyAdminNewOrder}
                      disabled={savingWaToggles}
                      onCheckedChange={(val) => handleToggleWaSetting("admin", val)}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-3">
                    <div className="space-y-0.5 pr-4">
                      <Label
                        htmlFor="toggle-wa-cust"
                        className="text-sm font-semibold text-foreground cursor-pointer"
                      >
                        Notificar al Cliente en cambios de estado
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Envía confirmaciones automáticas al WhatsApp del cliente: pago verificado,
                        en preparación, empacado y despacho con número de guía.
                      </p>
                    </div>
                    <Switch
                      id="toggle-wa-cust"
                      checked={notifyCustomerStatusChange}
                      disabled={savingWaToggles}
                      onCheckedChange={(val) => handleToggleWaSetting("customer", val)}
                    />
                  </div>
                </div>
              </div>

              {/* Probador en Vivo de WhatsApp */}
              <div className="rounded-lg border border-border bg-surface-2/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Send className="size-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Probador en Vivo de Notificación
                  </h3>
                </div>

                <form onSubmit={handleSendTestMessage} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label
                        htmlFor="wa-test-phone"
                        className="text-xs font-semibold text-foreground"
                      >
                        Teléfono Destino (Formato Nacional o Internacional)
                      </Label>
                      <Input
                        id="wa-test-phone"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        placeholder="Ej: 04121546698 o +584121546698"
                        className="mt-1 text-xs font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label
                        htmlFor="wa-test-msg"
                        className="text-xs font-semibold text-foreground"
                      >
                        Mensaje Opcional Personalizado
                      </Label>
                      <Input
                        id="wa-test-msg"
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        placeholder="Ej: Hola! Mensaje de prueba de KICKPOINT WhatsApp Cloud API"
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="hero"
                      size="sm"
                      disabled={sendingTest}
                      className="gap-1.5 text-xs"
                    >
                      {sendingTest ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                      Enviar Mensaje de Prueba
                    </Button>
                  </div>
                </form>
              </div>

              {/* Registro Reciente de Notificaciones (Auditoría en Vivo) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Historial Reciente de Notificaciones
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Últimos {waStatus?.recentLogs.length ?? 0} registros
                  </span>
                </div>

                {!waStatus?.recentLogs || waStatus.recentLogs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    No hay notificaciones enviadas todavía. Cuando se generen pedidos o envíos,
                    aparecerán aquí con su identificador único de entrega.
                  </div>
                ) : (
                  <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-1">
                    {waStatus.recentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex flex-col justify-between gap-2 p-3 text-xs sm:flex-row sm:items-center hover:bg-surface-2/30 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                log.recipient_type === "admin"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                              }`}
                            >
                              {log.recipient_type === "admin" ? "Admin" : "Cliente"}
                            </span>
                            <span className="font-semibold text-foreground capitalize">
                              {log.event_type.replace(/_/g, " ")}
                            </span>
                            {log.order_code && (
                              <span className="font-mono text-[11px] text-muted-foreground">
                                • {log.order_code}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            Destino: +{log.recipient_phone}
                            {log.provider_message_id &&
                              ` • ID: ${log.provider_message_id.slice(0, 16)}...`}
                          </p>
                          {log.error_message && log.status === "failed" && (
                            <p className="text-[11px] text-rose-500 font-medium">
                              Error: {log.error_message}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 sm:flex-col sm:items-end">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              log.status === "sent"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : log.status === "pending"
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {log.status === "sent" ? (
                              <CheckCircle2 className="size-3" />
                            ) : log.status === "pending" ? (
                              <Clock className="size-3" />
                            ) : (
                              <AlertCircle className="size-3" />
                            )}
                            {log.status === "sent"
                              ? "Enviado"
                              : log.status === "pending"
                                ? "Pendiente / Cola"
                                : "Fallido"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(log.created_at).toLocaleTimeString("es-VE", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notificaciones por Correo Electrónico (Resend) */}
        <div className="surface-card p-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-primary" />
              <h2 className="text-display text-lg font-bold">Notificaciones por Correo (Resend)</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchEmailStatus()}
                className="h-8 gap-1.5 text-xs"
              >
                <RefreshCw className="size-3.5" />
                Actualizar Estado
              </Button>
            </div>
          </div>

          {loadingEmailStatus ? (
            <Skeleton className="mt-4 h-48 w-full" />
          ) : (
            <div className="mt-4 space-y-6">
              {/* Estado de Conexión & Métricas */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-card/50 border border-border flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Servicio Resend
                    </span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div
                        className={`size-2.5 rounded-full ${
                          emailStatus?.isConfigured
                            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                            : "bg-amber-500"
                        }`}
                      />
                      <span className="font-bold text-sm">
                        {emailStatus?.isConfigured ? "Conectado y Listo" : "En Espera de API Key"}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {emailStatus?.isConfigured
                      ? "Envío transaccional activo hacia el administrador."
                      : "Configura RESEND_API_KEY para habilitar envíos a bandeja."}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card/50 border border-border flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Destinatario Admin
                    </span>
                    <div className="font-mono font-bold text-sm text-primary mt-1 truncate">
                      {emailStatus?.adminRecipientEmail || "camiloariasv2811@gmail.com"}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Recibe alertas inmediatas de nuevos pedidos.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card/50 border border-border flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Remitente (From)
                    </span>
                    <div className="font-mono font-bold text-xs text-foreground mt-1 truncate">
                      {emailStatus?.fromEmail || "KICKPOINT <onboarding@resend.dev>"}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Encabezado oficial de envío.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card/50 border border-border flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Métricas de Envío
                    </span>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="text-center">
                        <span className="block font-bold text-sm text-emerald-500">
                          {emailStatus?.stats.sent ?? 0}
                        </span>
                        <span className="text-[10px] text-muted-foreground">Enviados</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-sm text-amber-500">
                          {emailStatus?.stats.pending ?? 0}
                        </span>
                        <span className="text-[10px] text-muted-foreground">En Cola</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-sm text-rose-500">
                          {emailStatus?.stats.failed ?? 0}
                        </span>
                        <span className="text-[10px] text-muted-foreground">Fallidos</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Total registros: {emailStatus?.stats.total ?? 0}
                  </p>
                </div>
              </div>

              {/* Panel de Prueba Segura de Email */}
              <div className="p-4 rounded-lg bg-card/30 border border-border/70">
                <div className="flex items-center gap-2 mb-3">
                  <Send className="size-4 text-primary" />
                  <h3 className="text-sm font-bold">Prueba Segura de Notificación por Correo</h3>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    (No crea ventas, no altera stock ni Kárdex)
                  </span>
                </div>
                <form onSubmit={handleSendEmailTest} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="test-email-dest" className="text-xs">
                        Destinatario
                      </Label>
                      <Input
                        id="test-email-dest"
                        type="email"
                        value={testEmailRecipient}
                        onChange={(e) => setTestEmailRecipient(e.target.value)}
                        placeholder="camiloariasv2811@gmail.com"
                        className="text-xs font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="test-email-sub" className="text-xs">
                        Asunto (Opcional)
                      </Label>
                      <Input
                        id="test-email-sub"
                        value={testEmailSubject}
                        onChange={(e) => setTestEmailSubject(e.target.value)}
                        placeholder="🔔 KICKPOINT — Prueba de notificaciones"
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="test-email-msg" className="text-xs">
                        Mensaje (Opcional)
                      </Label>
                      <Input
                        id="test-email-msg"
                        value={testEmailBody}
                        onChange={(e) => setTestEmailBody(e.target.value)}
                        placeholder="El sistema de correo administrativo está funcionando correctamente."
                        className="text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-muted-foreground">
                      Destinatario oficial:{" "}
                      <span className="text-primary font-mono font-semibold">
                        camiloariasv2811@gmail.com
                      </span>
                    </p>
                    <Button
                      type="submit"
                      disabled={sendingEmailTest}
                      size="sm"
                      className="gap-1.5 text-xs font-bold"
                    >
                      {sendingEmailTest ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                      Enviar Correo de Prueba
                    </Button>
                  </div>
                </form>
              </div>

              {/* Registro Reciente de Correos */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Historial de Auditoría de Correos
                </h3>
                {emailStatus?.recentLogs.length === 0 ? (
                  <div className="p-6 text-center rounded-lg border border-dashed border-border bg-card/20">
                    <Mail className="size-6 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-muted-foreground">
                      No hay registros de correos aún. Las notificaciones se registrarán
                      automáticamente al crearse nuevos pedidos o al realizar pruebas.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-card/20">
                    {emailStatus?.recentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-card/40 transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground truncate">
                              {log.subject}
                            </span>
                            {log.order_code && (
                              <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
                                #{log.order_code}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate font-mono">
                            Hacia: {log.recipient_email}
                          </p>
                          {log.error_message && (
                            <p className="text-[10px] text-rose-400 truncate">
                              Detalle: {log.error_message}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              log.status === "sent"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : log.status === "pending"
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {log.status === "sent" ? (
                              <CheckCircle2 className="size-3" />
                            ) : log.status === "pending" ? (
                              <Clock className="size-3" />
                            ) : (
                              <AlertCircle className="size-3" />
                            )}
                            {log.status === "sent"
                              ? "Enviado"
                              : log.status === "pending"
                                ? "Pendiente / Cola"
                                : "Fallido"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(log.created_at).toLocaleTimeString("es-VE", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
