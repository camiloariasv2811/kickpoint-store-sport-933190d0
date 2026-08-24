import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  Edit2,
  FileSpreadsheet,
  History,
  Loader2,
  MoreVertical,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteInventoryMovement,
  listInventoryMovements,
  updateInventoryMovementNote,
  type InventoryMovementRow,
} from "@/lib/inventory.functions";

export const Route = createFileRoute("/_authenticated/admin/kardex")({
  component: KardexPage,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MOVEMENT_LABELS: Record<string, string> = {
  entrada: "Entrada (Compra/Recepción)",
  salida: "Salida (Venta/Despacho)",
  ajuste: "Ajuste de Inventario",
  venta: "Venta en Mostrador",
};

function KardexPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Estados para modal de edición
  const [editingMovement, setEditingMovement] = useState<InventoryMovementRow | null>(null);
  const [editReference, setEditReference] = useState("");
  const [editNote, setEditNote] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Estados para modal de eliminación
  const [deletingMovement, setDeletingMovement] = useState<InventoryMovementRow | null>(null);
  const [revertStock, setRevertStock] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const kardexQuery = useQuery({
    queryKey: ["admin", "kardex-all", typeFilter],
    queryFn: async () => {
      try {
        const res = await listInventoryMovements({
          data: {
            type: typeFilter === "all" ? undefined : typeFilter,
            limit: 200,
          },
        });
        return res ?? [];
      } catch (err) {
        console.warn("[AdminKardex] Error loading movements:", err);
        return [];
      }
    },
  });

  const movements = (kardexQuery.data ?? []).filter((m: InventoryMovementRow) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      m.productName.toLowerCase().includes(term) ||
      (m.sku ?? "").toLowerCase().includes(term) ||
      (m.reference ?? "").toLowerCase().includes(term) ||
      (m.note ?? "").toLowerCase().includes(term) ||
      m.size.toLowerCase().includes(term)
    );
  });

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMovement) return;
    setIsSavingEdit(true);
    try {
      await updateInventoryMovementNote({
        data: {
          movementId: editingMovement.id,
          reference: editReference,
          note: editNote,
        },
      });
      toast.success("Movimiento actualizado");
      setEditingMovement(null);
      kardexQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar movimiento");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingMovement) return;
    setIsDeleting(true);
    try {
      const res = await deleteInventoryMovement({
        data: {
          movementId: deletingMovement.id,
          revertStock,
        },
      });
      toast.success(
        revertStock && res.stockAfter !== null
          ? `Movimiento eliminado. Stock restaurado a ${res.stockAfter} unidades.`
          : "Movimiento eliminado del registro",
      );
      setDeletingMovement(null);
      kardexQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard-metrics"] });
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar movimiento");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AdminShell
      title="Kárdex de Inventario"
      subtitle="Libro de auditoría y trazabilidad cronológica de entradas, salidas y ajustes de stock"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/inventario">
              <Boxes className="mr-1.5 size-4" />
              Ver Inventario Actual
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => kardexQuery.refetch()}
            disabled={kardexQuery.isFetching}
          >
            <RefreshCw
              className={`mr-1.5 size-4 ${kardexQuery.isFetching ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por producto, SKU, talla, referencia de orden..."
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Tipo de movimiento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los movimientos</SelectItem>
              <SelectItem value="entrada">Entradas (Recepción)</SelectItem>
              <SelectItem value="salida">Salidas (Despacho)</SelectItem>
              <SelectItem value="ajuste">Ajustes manuales</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabla */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          {kardexQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin text-primary" />
              Cargando registros de Kárdex...
            </div>
          ) : movements.length === 0 ? (
            <EmptyState
              icon={History}
              title="No hay movimientos registrados"
              description="Los movimientos de inventario por ventas, recepciones o ajustes aparecerán aquí automáticamente."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Fecha y Hora</th>
                    <th className="px-4 py-3">Producto / Variante</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Cantidad</th>
                    <th className="px-4 py-3 text-right">Stock Resultante</th>
                    <th className="px-4 py-3">Referencia / Motivo</th>
                    <th className="px-4 py-3">Responsable</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movements.map((m) => {
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m.id} className="transition-colors hover:bg-muted/25">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground font-mono">
                          {formatDate(m.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <div className="text-foreground">{m.productName}</div>
                          <div className="text-xs text-muted-foreground">
                            Talla: <span className="font-semibold text-foreground">{m.size}</span>
                            {m.color ? ` • Color: ${m.color}` : ""}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                          {m.sku || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge
                            variant={
                              m.type === "entrada"
                                ? "default"
                                : m.type === "salida"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="gap-1 font-medium"
                          >
                            {m.type === "entrada" ? (
                              <ArrowUpCircle className="size-3 text-emerald-500" />
                            ) : m.type === "salida" ? (
                              <ArrowDownCircle className="size-3 text-rose-500" />
                            ) : (
                              <RefreshCw className="size-3 text-amber-500" />
                            )}
                            {MOVEMENT_LABELS[m.type] || m.type}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold">
                          <span
                            className={
                              isPositive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }
                          >
                            {isPositive ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-foreground font-medium">
                          {m.stockAfter ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {m.reference && (
                            <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 font-mono font-semibold text-primary">
                              {m.reference}
                            </span>
                          )}
                          {m.note && (
                            <p className="mt-0.5 text-muted-foreground truncate max-w-xs">
                              {m.note}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                          {m.createdByEmail || m.createdBy || "Sistema"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingMovement(m);
                                  setEditReference(m.reference || "");
                                  setEditNote(m.note || "");
                                }}
                              >
                                <Edit2 className="mr-2 size-4" />
                                Editar Motivo / Referencia
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  setDeletingMovement(m);
                                  setRevertStock(true);
                                }}
                              >
                                <Trash2 className="mr-2 size-4" />
                                Eliminar movimiento
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Editar Motivo / Referencia */}
      <Dialog open={!!editingMovement} onOpenChange={(open) => !open && setEditingMovement(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Movimiento</DialogTitle>
            <DialogDescription>
              Modifica la referencia o la nota explicativa de este registro de kárdex.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-ref">Referencia / Documento</Label>
              <Input
                id="edit-ref"
                value={editReference}
                onChange={(e) => setEditReference(e.target.value)}
                placeholder="Ej: OR-1024, FACT-88"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-note">Nota / Observación</Label>
              <Textarea
                id="edit-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Motivo del movimiento..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingMovement(null)}
                disabled={isSavingEdit}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingEdit}>
                {isSavingEdit ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Eliminar Movimiento Erróneo */}
      <Dialog open={!!deletingMovement} onOpenChange={(open) => !open && setDeletingMovement(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Eliminar Movimiento Erróneo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este movimiento de{" "}
              {deletingMovement?.productName} ({deletingMovement?.type} de{" "}
              {deletingMovement?.quantity} unds)?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer bg-muted/30">
              <input
                type="checkbox"
                checked={revertStock}
                onChange={(e) => setRevertStock(e.target.checked)}
                className="mt-0.5 rounded border-border text-primary focus:ring-primary"
              />
              <div>
                <div className="font-semibold text-foreground">
                  Revertir automáticamente el stock de la variante
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {deletingMovement?.type === "salida" || deletingMovement?.type === "venta"
                    ? `Sumará +${Math.abs(deletingMovement?.quantity || 0)} unidades al stock actual.`
                    : deletingMovement?.type === "entrada"
                      ? `Restará -${Math.abs(deletingMovement?.quantity || 0)} unidades del stock actual.`
                      : "Mantiene la coherencia física de inventario."}
                </div>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingMovement(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar y Ajustar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
