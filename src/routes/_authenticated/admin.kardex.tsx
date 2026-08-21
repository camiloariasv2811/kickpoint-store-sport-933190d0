import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  FileSpreadsheet,
  History,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { useState } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listInventoryMovements, type InventoryMovementRow } from "@/lib/inventory.functions";

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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
