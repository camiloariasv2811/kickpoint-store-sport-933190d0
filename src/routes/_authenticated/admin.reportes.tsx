import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  TrendingUp,
  DollarSign,
  Package,
  ShoppingBag,
  Download,
  Award,
  Boxes,
  PieChart,
} from "lucide-react";

import { AdminShell } from "@/components/admin/AdminShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/admin/StatCard";
import { getReportMetrics, type ReportMetrics } from "@/lib/reports.functions";
import { moneyExact } from "@/lib/format";

const EMPTY_METRICS: ReportMetrics = {
  totalRevenue: 0,
  totalOrders: 0,
  totalSales: 0,
  totalCost: 0,
  grossProfit: 0,
  averageTicket: 0,
  topProducts: [],
  inventoryValueRetail: 0,
  inventoryValueCost: 0,
  totalUnitsInStock: 0,
  salesByChannel: [],
};

export const Route = createFileRoute("/_authenticated/admin/reportes")({
  component: AdminReportes,
  errorComponent: () => (
    <AdminShell title="Reportes Financieros" subtitle="No se pudieron cargar los reportes">
      <div className="surface-card p-6 text-sm text-muted-foreground">
        Ocurrió un problema al cargar los reportes. Intenta recargar la página.
      </div>
    </AdminShell>
  ),
});

function AdminReportes() {
  const { data, isLoading, isError, refetch } = useQuery<ReportMetrics>({
    queryKey: ["admin", "reports"],
    staleTime: 1000 * 60,
    placeholderData: (prev) => prev,
    queryFn: async () => ({ ...EMPTY_METRICS, ...((await getReportMetrics()) ?? {}) }),
  });

  const metrics: ReportMetrics = { ...EMPTY_METRICS, ...(data ?? {}) };

  function exportCSV() {
    if (!metrics) return;
    const rows = [
      ["Métrica", "Valor"],
      ["Ventas Totales Brutas", metrics.totalRevenue.toFixed(2)],
      ["Costo Total (COGS)", metrics.totalCost.toFixed(2)],
      ["Ganancia Bruta", metrics.grossProfit.toFixed(2)],
      ["Ticket Promedio", metrics.averageTicket.toFixed(2)],
      ["Total Pedidos Online", metrics.totalOrders],
      ["Total Ventas Presenciales", metrics.totalSales],
      ["Unidades en Stock", metrics.totalUnitsInStock],
      ["Valoración Inventario (Costo)", metrics.inventoryValueCost.toFixed(2)],
      ["Valoración Inventario (Venta)", metrics.inventoryValueRetail.toFixed(2)],
      [],
      ["Top Productos", "Unidades Vendidas", "Ingreso Total ($)"],
      ...metrics.topProducts.map((p) => [p.name, p.quantity, p.revenue.toFixed(2)]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_kickpoint_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <AdminShell
      title="Reportes Financieros"
      subtitle="Analítica de ingresos, rentabilidad, costo de mercancía y productos estrella"
      actions={
        <Button
          variant="outline"
          onClick={exportCSV}
          disabled={isLoading && !data}
          className="h-9 gap-1.5 text-xs font-semibold"
        >
          <Download className="size-4" /> Exportar a CSV
        </Button>
      }
    >
      {isError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <span>No se pudo actualizar el reporte. Los últimos valores confirmados siguen visibles.</span>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Volver a intentar
          </Button>
        </div>
      )}
      {isLoading && !data && <Skeleton className="h-96 w-full rounded-xl" />}

      {(!isLoading || data) && (
        <div className="space-y-6">
          {/* Key Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Ingresos Totales"
              value={moneyExact(metrics.totalRevenue)}
              hint={`${metrics.totalOrders} pedidos online + ${metrics.totalSales} ventas POS`}
              trend="up"
            />
            <StatCard
              label="Ganancia Bruta"
              value={moneyExact(metrics.grossProfit)}
              hint={`Margen: ${metrics.totalRevenue > 0 ? ((metrics.grossProfit / metrics.totalRevenue) * 100).toFixed(1) : 0}%`}
              trend="up"
            />
            <StatCard
              label="Costo de Mercancía"
              value={moneyExact(metrics.totalCost)}
              hint="Inversión en productos vendidos"
            />
            <StatCard
              label="Ticket Promedio"
              value={moneyExact(metrics.averageTicket)}
              hint="Promedio por transacción"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Products */}
            <div className="surface-card p-5">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Award className="size-5 text-amber-500" />
                <h2 className="text-display text-lg font-bold">Productos Más Vendidos</h2>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2">Producto</th>
                      <th className="pb-2 text-center">Unidades</th>
                      <th className="pb-2 text-right">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {metrics.topProducts.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-muted-foreground">
                          Aún no hay ventas suficientes para calcular el ranking.
                        </td>
                      </tr>
                    )}
                    {metrics.topProducts.map((p, idx) => (
                      <tr key={idx} className="py-2">
                        <td className="py-2.5 font-medium text-foreground">
                          <span className="mr-2 font-bold text-muted-foreground">#{idx + 1}</span>
                          {p.name}
                        </td>
                        <td className="py-2.5 text-center font-bold">{p.quantity}</td>
                        <td className="py-2.5 text-right font-semibold text-primary">
                          {moneyExact(p.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inventory Valuation & Channels */}
            <div className="space-y-6">
              <div className="surface-card p-5">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <Boxes className="size-5 text-primary" />
                  <h2 className="text-display text-lg font-bold">Valoración de Inventario</h2>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-surface-2 p-3.5">
                    <p className="text-xs text-muted-foreground">Valor al Costo</p>
                    <p className="mt-1 text-display text-xl font-bold text-foreground">
                      {moneyExact(metrics.inventoryValueCost)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Inversión actual en bodega
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-surface-2 p-3.5">
                    <p className="text-xs text-muted-foreground">Valor Estimado de Venta</p>
                    <p className="mt-1 text-display text-xl font-bold text-primary">
                      {moneyExact(metrics.inventoryValueRetail)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {metrics.totalUnitsInStock} unidades disponibles
                    </p>
                  </div>
                </div>
              </div>

              <div className="surface-card p-5">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <PieChart className="size-5 text-primary" />
                  <h2 className="text-display text-lg font-bold">Ventas por Canal</h2>
                </div>

                <div className="mt-4 divide-y divide-border text-xs">
                  {metrics.salesByChannel.map((ch, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="font-semibold capitalize text-foreground">{ch.channel}</p>
                        <p className="text-muted-foreground">{ch.count} transacciones</p>
                      </div>
                      <span className="font-bold text-primary">{moneyExact(ch.total)}</span>
                    </div>
                  ))}
                  {metrics.salesByChannel.length === 0 && (
                    <p className="py-4 text-center text-muted-foreground">Sin registros.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
