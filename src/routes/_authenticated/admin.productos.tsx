import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Search,
  Edit2,
  Plus,
  AlertTriangle,
  CheckCircle,
  Package,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { moneyExact } from "@/lib/format";
import ProductForm from "@/components/admin/ProductForm";
import {
  deleteProduct,
  listAdminProducts,
  setProductActive,
  type AdminProductsResponse,
} from "@/lib/products.functions";
import { toast } from "sonner";

type AdminProductRow = {
  id: string;
  name: string;
  slug?: string | null;
  base_sku: string | null;
  retail_price: number;
  wholesale_price: number | null;
  cost: number;
  active: boolean;
  low_stock_threshold: number | null;
  images?: string[] | null;
  brand: { id?: string; name: string; slug?: string } | null;
  category: { id?: string; name: string; slug?: string } | null;
  variants: {
    id: string;
    size: string;
    color: string | null;
    sku?: string | null;
    stock: number;
    active?: boolean;
  }[];
};

export const Route = createFileRoute("/_authenticated/admin/productos")({
  component: AdminProductos,
});

const PAGE_SIZE = 20;

function AdminProductos() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1); // Reset page on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [q]);

  const queryClient = useQueryClient();

  const {
    data: response,
    isLoading,
    isFetching,
  } = useQuery<AdminProductsResponse>({
    queryKey: ["admin", "products", { page, search: debouncedQ }],
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      try {
        const res = await listAdminProducts({
          data: {
            page,
            pageSize: PAGE_SIZE,
            search: debouncedQ.trim() || undefined,
          },
        });
        if (Array.isArray(res)) {
          return {
            items: res as any,
            total: res.length,
            page: 1,
            pageSize: PAGE_SIZE,
            totalPages: Math.ceil(res.length / PAGE_SIZE) || 1,
            activeCount: res.filter((p: any) => p.active !== false).length,
            totalUnits: res.reduce(
              (acc: number, p: any) =>
                acc +
                (p.variants ?? [])
                  .filter((v: any) => v.active !== false)
                  .reduce((va: number, v: any) => va + Number(v.stock || 0), 0),
              0,
            ),
          };
        }
        return res;
      } catch (err) {
        console.warn("[AdminProductos] Error loading products:", err);
        return {
          items: [],
          total: 0,
          page: 1,
          pageSize: PAGE_SIZE,
          totalPages: 1,
          activeCount: 0,
          totalUnits: 0,
        };
      }
    },
  });

  const rows: AdminProductRow[] = (response?.items as AdminProductRow[]) ?? [];
  const total = response?.total ?? 0;
  const totalPages = response?.totalPages ?? 1;
  const activeCount = response?.activeCount ?? 0;
  const totalUnits = response?.totalUnits ?? 0;

  const [openForm, setOpenForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProductRow | null>(null);
  const [productToDelete, setProductToDelete] = useState<AdminProductRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleToggleActive(id: string, active: boolean) {
    try {
      await setProductActive({ data: { id, active: !active } });
      toast.success(active ? "Producto desactivado" : "Producto activado");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "products"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "kardex-all"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message || "No se pudo cambiar el estado"}`);
    }
  }

  async function handleConfirmDelete() {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteProduct({ data: { id: productToDelete.id } });
      if (res.archived) {
        toast.info("Producto archivado", {
          description: res.message,
        });
      } else {
        toast.success(res.message || "Producto eliminado correctamente");
      }
      setProductToDelete(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "products"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "kardex-all"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al eliminar: ${err.message || "Error desconocido"}`);
    } finally {
      setIsDeleting(false);
    }
  }

  function openCreate() {
    setEditingProduct(null);
    setOpenForm(true);
  }
  function openEdit(product: any) {
    setEditingProduct(product);
    setOpenForm(true);
  }

  const startRecord = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRecord = Math.min(page * PAGE_SIZE, total);

  return (
    <AdminShell
      title="Productos"
      subtitle={`Catálogo maestro · ${activeCount} activos · ${totalUnits} unidades totales en stock`}
      actions={
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o SKU..."
              className="h-9 w-64 pl-9"
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button variant="hero" onClick={openCreate} className="gap-1.5">
            <Plus className="size-4" /> Crear producto
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground sm:hidden">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o SKU..."
            className="h-9 w-full pl-9"
          />
        </div>
      </div>

      {isLoading && <Skeleton className="h-64 w-full rounded-xl" />}

      {!isLoading && (
        <div className="space-y-3">
          <div className="surface-card overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">SKU Base</th>
                  <th className="px-4 py-3">Categoría / Marca</th>
                  <th className="px-4 py-3">Costo</th>
                  <th className="px-4 py-3">Detal</th>
                  <th className="px-4 py-3">Mayor</th>
                  <th className="px-4 py-3">Stock Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      <Package className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                      {debouncedQ
                        ? `No se encontraron productos coincidentes con "${debouncedQ}".`
                        : "No se encontraron productos en el catálogo."}
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const totalStock = (r.variants || [])
                    .filter((v) => v.active !== false)
                    .reduce((s, v) => s + (Number(v.stock) || 0), 0);
                  const isLowStock = totalStock <= (r.low_stock_threshold || 5);
                  const firstImage =
                    Array.isArray(r.images) && r.images.length > 0 ? r.images[0] : null;

                  return (
                    <tr key={r.id} className="transition-colors hover:bg-surface-2/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {firstImage ? (
                            <img
                              src={firstImage}
                              alt={r.name}
                              loading="lazy"
                              decoding="async"
                              className="size-10 rounded-md border border-border object-cover"
                            />
                          ) : (
                            <div className="flex size-10 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground">
                              <Package className="size-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-foreground">{r.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(r.variants || []).filter((v) => v.active !== false).length}{" "}
                              variantes activas · Umbral: {r.low_stock_threshold || 5}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {r.base_sku ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium">{r.category?.name ?? "Sin categoría"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.brand?.name ?? "Sin marca"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs">{moneyExact(r.cost)}</td>
                      <td className="px-4 py-3 font-semibold text-primary">
                        {moneyExact(r.retail_price)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.wholesale_price ? moneyExact(r.wholesale_price) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span>{totalStock}</span>
                          {isLowStock && (
                            <span title="Stock bajo o agotado" className="text-amber-500">
                              <AlertTriangle className="size-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                            r.active
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {r.active ? (
                            <>
                              <CheckCircle className="size-3" /> Activo
                            </>
                          ) : (
                            "Inactivo"
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(r)}
                            className="h-8 gap-1 text-xs"
                          >
                            <Edit2 className="size-3.5" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleActive(r.id, r.active)}
                            className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {r.active ? "Desactivar" : "Activar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setProductToDelete(r)}
                            className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Eliminar producto"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Controles de paginación del servidor */}
          {total > 0 && (
            <div className="flex flex-col items-center justify-between gap-2 px-2 py-2 sm:flex-row text-xs text-muted-foreground">
              <div>
                Mostrando <span className="font-semibold text-foreground">{startRecord}</span>–
                <span className="font-semibold text-foreground">{endRecord}</span> de{" "}
                <span className="font-semibold text-foreground">{total}</span> productos
                {debouncedQ && ` (filtrado por "${debouncedQ}")`}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 gap-1 px-2.5 text-xs"
                >
                  <ChevronLeft className="size-3.5" /> Anterior
                </Button>
                <span className="font-medium px-1">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 gap-1 px-2.5 text-xs"
                >
                  Siguiente <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <ProductForm
        product={editingProduct}
        open={openForm}
        onClose={() => setOpenForm(false)}
        onSaved={async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["admin", "products"] }),
            queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] }),
            queryClient.invalidateQueries({ queryKey: ["admin", "dashboard-metrics"] }),
            queryClient.invalidateQueries({ queryKey: ["admin", "kardex-all"] }),
            queryClient.invalidateQueries({ queryKey: ["products"] }),
          ]);
          setOpenForm(false);
        }}
      />

      {/* Modal de confirmación para eliminación segura */}
      <Dialog
        open={Boolean(productToDelete)}
        onOpenChange={(open) => !open && setProductToDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              ¿Eliminar producto?
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-foreground/80">
              <p>
                Estás a punto de eliminar{" "}
                <span className="font-semibold text-foreground">{productToDelete?.name}</span>.
              </p>
              <p className="text-xs text-muted-foreground">
                Si el producto ya posee pedidos o ventas asociadas en el sistema, será archivado y
                desactivado de forma segura para proteger la integridad contable y el historial de
                transacciones.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => setProductToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="size-4" /> Confirmar eliminación
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
