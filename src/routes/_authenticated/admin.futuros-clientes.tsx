import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Download,
  Edit2,
  Eye,
  Loader2,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { whatsappLink } from "@/lib/format";
import {
  createProspect,
  deleteProspect,
  importProspects,
  listProspects,
  updateProspect,
  type ProspectRow,
} from "@/lib/prospects.functions";

export const Route = createFileRoute("/_authenticated/admin/futuros-clientes")({
  component: AdminFuturosClientes,
});

const HEADERS = [
  "N.º",
  "Nombre",
  "Número de teléfono",
  "Ciudad",
  "Fecha de registro",
  "Observaciones",
] as const;

function formatDate(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function todayCaracas() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date());
}

type FormState = { name: string; phone: string; state: string; notes: string };
const EMPTY_FORM: FormState = { name: "", phone: "", state: "", notes: "" };

function AdminFuturosClientes() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProspectRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [viewing, setViewing] = useState<ProspectRow | null>(null);
  const [deleting, setDeleting] = useState<ProspectRow | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    data: prospects = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<ProspectRow[]>({
    queryKey: ["admin", "prospects"],
    queryFn: () => listProspects(),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "prospects"] });

  const importMutation = useMutation({
    mutationFn: (
      rows: Array<{
        name: string;
        phone: string;
        state: string;
        notes: string;
        registered_at: string;
      }>,
    ) => importProspects({ data: { rows } }),
    onSuccess: (res) => {
      invalidate();
      toast.success(
        `Importación lista: ${res.inserted} agregados, ${res.duplicates} repetidos, ${res.invalid} sin datos válidos`,
      );
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo importar el archivo"),
  });

  const states = useMemo(
    () =>
      Array.from(new Set(prospects.map((p) => p.state).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b),
      ),
    [prospects],
  );

  const today = todayCaracas();
  const todayCount = prospects.filter((p) => p.registered_at.slice(0, 10) === today).length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const needleDigits = q.replace(/\D/g, "");
    return prospects.filter((p) => {
      if (stateFilter && p.state !== stateFilter) return false;
      const date = p.registered_at.slice(0, 10);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      if (!needle) return true;
      if (p.name.toLowerCase().includes(needle)) return true;
      if (needleDigits && p.phone.includes(needleDigits)) return true;
      return false;
    });
  }, [prospects, q, stateFilter, fromDate, toDate]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(row: ProspectRow) {
    setEditing(row);
    setForm({
      name: row.name,
      phone: row.phone,
      state: row.state ?? "",
      notes: row.notes ?? "",
    });
    setFormOpen(true);
  }

  async function submitForm() {
    if (!form.name.trim()) {
      toast.error("Escribe el nombre del futuro cliente");
      return;
    }
    if (!form.phone.replace(/\D/g, "")) {
      toast.error("Escribe el número de teléfono");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await updateProspect({ data: { id: editing.id, ...form } });
        toast.success("Futuro cliente actualizado");
      } else {
        await createProspect({ data: form });
        toast.success("Futuro cliente agregado");
      }
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await invalidate();
    } catch (err) {
      toast.error((err as Error).message || "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteProspect({ data: { id: deleting.id } });
      setDeleting(null);
      toast.success("Futuro cliente eliminado");
      await invalidate();
    } catch (err) {
      toast.error((err as Error).message || "No se pudo eliminar");
    } finally {
      setBusy(false);
    }
  }

  async function exportExcel() {
    if (filtered.length === 0) {
      toast.error("No hay futuros clientes para exportar");
      return;
    }
    const XLSX = await import("xlsx");
    const rows = filtered
      .slice()
      .sort((a, b) => a.seq - b.seq)
      .map((p, index) => ({
        "N.º": index + 1,
        Nombre: p.name,
        "Número de teléfono": p.phone,
        Estado: p.state ?? "",
        "Fecha de registro": formatDate(p.registered_at),
        Observaciones: p.notes ?? "",
      }));
    const sheet = XLSX.utils.json_to_sheet(rows, { header: [...HEADERS] });
    sheet["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 40 }];
    // El teléfono se guarda como texto para no perder el 0 inicial.
    for (let i = 0; i < rows.length; i++) {
      const ref = XLSX.utils.encode_cell({ c: 2, r: i + 1 });
      const cell = sheet[ref];
      if (cell) {
        cell.t = "s";
        cell.z = "@";
      }
    }
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Futuros clientes");
    XLSX.writeFile(book, `futuros-clientes-${today}.xlsx`);
    toast.success("Archivo de Excel descargado");
  }

  async function handleImportFile(file: File) {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const book = XLSX.read(buffer, { cellDates: true });
      const firstSheetName = book.SheetNames[0];
      if (!firstSheetName) throw new Error("El archivo no tiene hojas");
      const sheet = book.Sheets[firstSheetName]!;
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const pick = (row: Record<string, unknown>, keys: string[]) => {
        for (const key of Object.keys(row)) {
          const norm = key
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
          if (keys.some((k) => norm.includes(k))) {
            const value = row[key];
            if (value instanceof Date) return value.toISOString().slice(0, 10);
            return value == null ? "" : String(value).trim();
          }
        }
        return "";
      };

      const rows = raw.map((row) => ({
        name: pick(row, ["nombre", "name"]),
        phone: pick(row, ["telefono", "phone", "whatsapp", "celular", "numero"]),
        state: pick(row, ["estado", "state"]),
        notes: pick(row, ["observacion", "nota", "notes", "comentario"]),
        registered_at: pick(row, ["fecha", "date"]),
      }));

      if (rows.length === 0) throw new Error("El archivo está vacío");
      importMutation.mutate(rows);
    } catch (err) {
      toast.error((err as Error).message || "No se pudo leer el archivo");
    }
  }

  return (
    <AdminShell
      title="Futuros clientes"
      subtitle="Registro de prospectos y posibles clientes"
      actions={
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> Agregar futuro cliente
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total futuros clientes" value={String(prospects.length)} icon={Users} />
        <StatCard
          label="Registrados hoy"
          value={String(todayCount)}
          icon={CalendarDays}
          tone="primary"
        />
        <StatCard label="Estados registrados" value={String(states.length)} icon={MapPin} />
      </div>

      <div className="surface-card space-y-3 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o número de teléfono…"
            className="pl-9"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todos los estados</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={exportExcel}>
              <Download className="size-4" /> Exportar a Excel
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => fileRef.current?.click()}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Importar Excel
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleImportFile(file);
              }}
            />
          </div>
        </div>

        {(stateFilter || fromDate || toDate || q) && (
          <p className="text-xs text-muted-foreground">
            Mostrando {filtered.length} de {prospects.length} registros.{" "}
            <button
              className="font-semibold text-primary underline"
              onClick={() => {
                setQ("");
                setStateFilter("");
                setFromDate("");
                setToDate("");
              }}
            >
              Limpiar filtros
            </button>
          </p>
        )}
      </div>

      {isError && (
        <div className="surface-card flex items-center justify-between gap-3 border-destructive/40 p-4">
          <p className="text-sm text-destructive">No se pudo cargar la lista de futuros clientes.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Volver a intentar
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 p-10 text-center">
          <UserPlus className="size-8 text-primary" />
          <h2 className="text-display text-lg">Aún no hay futuros clientes</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Agrega prospectos manualmente o importa una lista desde Excel.
          </p>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" /> Agregar futuro cliente
          </Button>
        </div>
      ) : (
        <>
          {/* Tabla (escritorio) */}
          <div className="surface-card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-3 font-semibold">N.º</th>
                  <th className="px-3 py-3 font-semibold">Nombre</th>
                  <th className="px-3 py-3 font-semibold">Teléfono</th>
                  <th className="px-3 py-3 font-semibold">Estado</th>
                  <th className="px-3 py-3 font-semibold">Fecha de registro</th>
                  <th className="px-3 py-3 font-semibold">Observaciones</th>
                  <th className="px-3 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, index) => (
                  <tr key={p.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="px-3 py-3 text-muted-foreground">{index + 1}</td>
                    <td className="px-3 py-3 font-medium">{p.name}</td>
                    <td className="px-3 py-3">
                      <a
                        href={whatsappLink(`Hola ${p.name}, te escribo de KICKPOINT.`, p.phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <MessageCircle className="size-3.5" /> {p.phone}
                      </a>
                    </td>
                    <td className="px-3 py-3">{p.state ?? "—"}</td>
                    <td className="px-3 py-3">{formatDate(p.registered_at)}</td>
                    <td className="max-w-[16rem] truncate px-3 py-3 text-muted-foreground">
                      {p.notes ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Ver"
                          onClick={() => setViewing(p)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar"
                          onClick={() => openEdit(p)}
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar"
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas (móvil) */}
          <div className="space-y-3 md:hidden">
            {filtered.map((p, index) => (
              <div key={p.id} className="surface-card space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-eyebrow text-[0.6rem] text-muted-foreground">
                      N.º {index + 1}
                    </p>
                    <p className="truncate font-semibold">{p.name}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(p.registered_at)}
                  </span>
                </div>
                <a
                  href={whatsappLink(`Hola ${p.name}, te escribo de KICKPOINT.`, p.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary"
                >
                  <MessageCircle className="size-3.5" /> {p.phone}
                </a>
                <p className="text-sm text-muted-foreground">
                  <MapPin className="mr-1 inline size-3.5" />
                  {p.state ?? "Sin estado"}
                </p>
                {p.notes && <p className="text-sm text-muted-foreground">{p.notes}</p>}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setViewing(p)}>
                    <Eye className="size-4" /> Ver
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(p)}>
                    <Edit2 className="size-4" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleting(p)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Formulario */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar futuro cliente" : "Agregar futuro cliente"}</DialogTitle>
            <DialogDescription>
              La fecha de registro se guarda automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="fc-name">Nombre *</Label>
              <Input
                id="fc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <Label htmlFor="fc-phone">Número de teléfono *</Label>
              <Input
                id="fc-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="04121234567"
                inputMode="tel"
              />
            </div>
            <div>
              <Label htmlFor="fc-state">Ciudad</Label>
              <Input
                id="fc-state"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                placeholder="Ej. Maracay"
              />
            </div>
            <div>
              <Label htmlFor="fc-notes">Observaciones</Label>
              <Textarea
                id="fc-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas sobre el prospecto (opcional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={submitForm} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Guardar cambios" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ver detalle */}
      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>Información del futuro cliente</DialogDescription>
          </DialogHeader>
          {viewing && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Teléfono</dt>
                <dd className="font-medium">{viewing.phone}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Estado</dt>
                <dd className="font-medium">{viewing.state ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Fecha de registro</dt>
                <dd className="font-medium">{formatDate(viewing.registered_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Observaciones</dt>
                <dd className="mt-1 whitespace-pre-wrap">{viewing.notes ?? "—"}</dd>
              </div>
            </dl>
          )}
          <DialogFooter>
            {viewing && (
              <Button asChild variant="outline">
                <a
                  href={whatsappLink(`Hola ${viewing.name}, te escribo de KICKPOINT.`, viewing.phone)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </Button>
            )}
            <Button onClick={() => setViewing(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar */}
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar futuro cliente</DialogTitle>
            <DialogDescription>
              ¿Seguro que quieres eliminar a {deleting?.name}? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
