import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, ArrowDown, ChevronsUp, Loader2, Save, RotateCcw, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { moneyExact } from "@/lib/format";
import {
  listCatalogOrder,
  saveCatalogOrder,
  type CatalogOrderItem,
} from "@/lib/products.functions";

export const Route = createFileRoute("/_authenticated/admin/orden-catalogo")({
  component: AdminOrdenCatalogo,
});

function move(list: CatalogOrderItem[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (!item) return list;
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

function AdminOrdenCatalogo() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<CatalogOrderItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "catalog-order"],
    staleTime: 30 * 1000,
    queryFn: () => listCatalogOrder(),
  });

  useEffect(() => {
    if (data && !dirty) setItems(data);
  }, [data, dirty]);

  const saveMutation = useMutation({
    mutationFn: () => saveCatalogOrder({ data: { ids: items.map((i) => i.id) } }),
    onSuccess: () => {
      setDirty(false);
      toast.success("Orden del catálogo actualizado");
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog-order"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: (err: any) => toast.error(err?.message || "No se pudo guardar el orden"),
  });

  const apply = (fn: (list: CatalogOrderItem[]) => CatalogOrderItem[]) => {
    setItems((prev) => fn(prev));
    setDirty(true);
  };

  const filtered = q.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()))
    : items;

  return (
    <AdminShell title="Orden del catálogo">
      <div className="space-y-5">
        <div className="surface-card p-4">
          <p className="text-sm text-muted-foreground">
            Ordena los productos como quieres que se vean en el portal del cliente. El primero de la
            lista aparece de primero en el catálogo.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto..."
            className="h-10 sm:max-w-xs"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!dirty || saveMutation.isPending}
              onClick={() => {
                setItems(data ?? []);
                setDirty(false);
              }}
            >
              <RotateCcw className="size-4" /> Descartar
            </Button>
            <Button
              size="sm"
              disabled={!dirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Guardar orden
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="surface-card p-10 text-center">
            <Package className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No hay productos para ordenar.</p>
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((item) => {
            const index = items.findIndex((i) => i.id === item.id);
            return (
              <div
                key={item.id}
                className="surface-card flex items-center gap-3 p-3 sm:gap-4 sm:p-4"
              >
                <span className="w-8 shrink-0 text-center text-sm font-bold text-primary">
                  {index + 1}
                </span>
                <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {moneyExact(item.retail_price)}
                    {!item.active ? " · Inactivo" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Poner de primero"
                    disabled={index === 0}
                    onClick={() => apply((list) => move(list, index, 0))}
                  >
                    <ChevronsUp className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Subir"
                    disabled={index === 0}
                    onClick={() => apply((list) => move(list, index, index - 1))}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Bajar"
                    disabled={index === items.length - 1}
                    onClick={() => apply((list) => move(list, index, index + 1))}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
