import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Plus,
  Edit2,
  Search,
  MessageCircle,
  ShoppingBag,
  MapPin,
  Mail,
  Phone,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  type CustomerRow,
} from "@/lib/customers.functions";
import { moneyExact, whatsappLink } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  component: AdminClientes,
});

function AdminClientes() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);

  // Form Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: customers = [], isLoading } = useQuery<CustomerRow[]>({
    queryKey: ["admin", "customers"],
    queryFn: () => listCustomers(),
  });

  const filtered = customers.filter((c) => {
    const fullName = `${c.first_name} ${c.last_name ?? ""}`.toLowerCase();
    const matchName = fullName.includes(q.toLowerCase());
    const matchPhone = (c.whatsapp && c.whatsapp.includes(q)) || (c.phone && c.phone.includes(q));
    const matchCity = c.city && c.city.toLowerCase().includes(q.toLowerCase());
    return matchName || matchPhone || matchCity;
  });

  function openCreate() {
    setEditingCustomer(null);
    setFirstName("");
    setLastName("");
    setWhatsapp("");
    setEmail("");
    setAddress("");
    setCity("");
    setState("");
    setNotes("");
    setModalOpen(true);
  }

  function openEdit(c: CustomerRow) {
    setEditingCustomer(c);
    setFirstName(c.first_name);
    setLastName(c.last_name || "");
    setWhatsapp(c.whatsapp || "");
    setEmail(c.email || "");
    setAddress(c.address || "");
    setCity(c.city || "");
    setState(c.state || "");
    setNotes(c.notes || "");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!firstName.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (editingCustomer) {
        await updateCustomer({
          data: {
            id: editingCustomer.id,
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            whatsapp: whatsapp.trim() || null,
            phone: whatsapp.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
            city: city.trim() || null,
            state: state.trim() || null,
            notes: notes.trim() || null,
          },
        });
        toast.success("Cliente actualizado exitosamente");
      } else {
        await createCustomer({
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            whatsapp: whatsapp.trim() || null,
            phone: whatsapp.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
            city: city.trim() || null,
            state: state.trim() || null,
            notes: notes.trim() || null,
          },
        });
        toast.success("Cliente registrado exitosamente");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      setModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message || "No se pudo guardar el cliente"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Clientes"
      subtitle="Directorio de clientes, historial de compras y contacto directo por WhatsApp"
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente, WhatsApp, ciudad..."
              className="h-9 w-60 pl-9"
            />
          </div>
          <Button variant="hero" onClick={openCreate} className="gap-1.5">
            <Plus className="size-4" /> Nuevo Cliente
          </Button>
        </div>
      }
    >
      {isLoading && <Skeleton className="h-64 w-full rounded-xl" />}

      {!isLoading && (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">WhatsApp / Teléfono</th>
                <th className="px-4 py-3">Ubicación</th>
                <th className="px-4 py-3">Pedidos</th>
                <th className="px-4 py-3">Total Compras</th>
                <th className="px-4 py-3">Notas</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Users className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                    No se encontraron clientes en el directorio.
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-surface-2/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">
                      {c.first_name} {c.last_name ?? ""}
                    </p>
                    {c.email && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="size-3" /> {c.email}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.whatsapp ? (
                      <span className="font-mono text-xs font-medium text-foreground">
                        {c.whatsapp}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.city ? (
                      <p className="flex items-center gap-1 text-xs font-medium">
                        <MapPin className="size-3 text-muted-foreground" />
                        {c.city} {c.state ? `, ${c.state}` : ""}
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin ubicación</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-xs font-bold">
                      <ShoppingBag className="size-3 text-primary" /> {c.order_count ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">
                    {moneyExact(c.total_spent ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                    {c.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {c.whatsapp && (
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                          className="size-8 p-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
                        >
                          <a
                            href={whatsappLink(
                              `Hola ${c.first_name}, te saludamos de KICKPOINT.`,
                              c.whatsapp,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            title="Chat WhatsApp"
                          >
                            <MessageCircle className="size-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(c)}
                        className="h-8 gap-1 text-xs"
                      >
                        <Edit2 className="size-3.5" /> Editar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear / Editar Cliente */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
            <DialogDescription>
              Información de contacto y dirección para envíos y facturación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="c-name">Nombre *</Label>
                <Input
                  id="c-name"
                  value={firstName}
                  placeholder="Ej: Carlos"
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="c-last">Apellido</Label>
                <Input
                  id="c-last"
                  value={lastName}
                  placeholder="Ej: Pérez"
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="c-phone">WhatsApp / Teléfono</Label>
                <Input
                  id="c-phone"
                  value={whatsapp}
                  placeholder="+58 412 1234567"
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="c-mail">Email</Label>
                <Input
                  id="c-mail"
                  type="email"
                  value={email}
                  placeholder="cliente@email.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="c-addr">Dirección de entrega</Label>
              <Input
                id="c-addr"
                value={address}
                placeholder="Calle, Edificio, Casa..."
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="c-city">Ciudad</Label>
                <Input
                  id="c-city"
                  value={city}
                  placeholder="Caracas / Valencia..."
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="c-state">Estado</Label>
                <Input
                  id="c-state"
                  value={state}
                  placeholder="Miranda / Carabobo..."
                  onChange={(e) => setState(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="c-notes">Notas / Observaciones</Label>
              <Input
                id="c-notes"
                value={notes}
                placeholder="Cliente preferencial, talla usual M, etc."
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="hero" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              {editingCustomer ? "Guardar Cambios" : "Crear Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
