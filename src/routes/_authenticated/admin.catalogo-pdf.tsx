import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, Loader2, Package, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  downloadCatalogHtml,
  printCatalog,
  type CatalogPdfOptions,
  type CatalogPdfProduct,
} from "@/lib/catalog-pdf";
import { moneyExact } from "@/lib/format";
import { listAdminProducts } from "@/lib/products.functions";

export const Route = createFileRoute("/_authenticated/admin/catalogo-pdf")({
  component: AdminCatalogoPdf,
  head: () => ({
    meta: [
      { title: "Catálogo PDF | KICKPOINT Admin" },
      {
        name: "description",
        content:
          "Genera y descarga el catálogo de productos KICKPOINT en PDF para enviarlo a tus clientes.",
      },
      { property: "og:title", content: "Catálogo PDF | KICKPOINT Admin" },
      {
        property: "og:description",
        content: "Catálogo descargable con precios al detal y al mayor para compartir con clientes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminCatalogoPdf() {
  const [priceMode, setPriceMode] = useState<CatalogPdfOptions["priceMode"]>("ambos");
  const [showStock, setShowStock] = useState(false);
  const [showSizes, setShowSizes] = useState(true);
  const [onlyWithStock, setOnlyWithStock] = useState(true);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "catalog-pdf-products"],
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async () =>
      await listAdminProducts({ data: { page: 1, pageSize: 0, status: "active" } }),
  });

  const allProducts = (data?.items ?? []) as unknown as CatalogPdfProduct[];

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProducts) set.add(p.category?.name ?? "Otros");
    return Array.from(set).sort();
  }, [allProducts]);

  const selected = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (category !== "all" && (p.category?.name ?? "Otros") !== category) return false;
      if (onlyWithStock) {
        const stock = (p.variants ?? [])
          .filter((v) => v.active !== false)
          .reduce((s, v) => s + Number(v.stock || 0), 0);
        if (stock <= 0) return false;
      }
      if (priceMode === "mayor" && !p.wholesale_price) return false;
      if (term) {
        const haystack = `${p.name} ${p.base_sku ?? ""} ${p.brand?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [allProducts, category, onlyWithStock, priceMode, search]);

  const opts: CatalogPdfOptions = {
    priceMode,
    showStock,
    showSizes,
    note: note.trim() || undefined,
  };

  function handlePrint() {
    if (selected.length === 0) {
      toast.error("No hay productos con los filtros actuales");
      return;
    }
    const ok = printCatalog(selected, opts);
    if (ok) {
      toast.success("Catálogo generado", {
        description: "En el diálogo de impresión elige “Guardar como PDF”.",
      });
    } else {
      toast.error("No se pudo abrir el catálogo. Permite las ventanas emergentes.");
    }
  }

  function handleDownloadHtml() {
    if (selected.length === 0) {
      toast.error("No hay productos con los filtros actuales");
      return;
    }
    const ok = downloadCatalogHtml(selected, opts);
    if (ok) toast.success("Catálogo descargado (archivo HTML)");
    else toast.error("No se pudo descargar el catálogo");
  }

  return (
    <AdminShell
      title="Catálogo PDF"
      subtitle={`${selected.length} de ${allProducts.length} productos activos incluidos`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownloadHtml} className="gap-1.5">
            <Download className="size-4" /> HTML
          </Button>
          <Button variant="hero" onClick={handlePrint} className="gap-1.5">
            <Printer className="size-4" /> Generar PDF
          </Button>
        </div>
      }
    >
      {isError && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <span>No se pudieron cargar los productos.</span>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Volver a intentar
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="surface-card space-y-4 p-4">
          <div className="space-y-2">
            <Label>Precios a mostrar</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ["detal", "Detal"],
                  ["mayor", "Mayor"],
                  ["ambos", "Ambos"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={priceMode === value ? "hero" : "outline"}
                  onClick={() => setPriceMode(value)}
                  className="text-xs"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat">Categoría</Label>
            <select
              id="cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="all">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="q">Buscar (nombre, SKU o marca)</Label>
            <Input
              id="q"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Opcional"
              className="h-9"
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="stockOnly" className="text-sm font-normal">
                Solo productos con stock
              </Label>
              <Switch id="stockOnly" checked={onlyWithStock} onCheckedChange={setOnlyWithStock} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="showSizes" className="text-sm font-normal">
                Mostrar tallas
              </Label>
              <Switch id="showSizes" checked={showSizes} onCheckedChange={setShowSizes} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="showStock" className="text-sm font-normal">
                Mostrar unidades disponibles
              </Label>
              <Switch id="showStock" checked={showStock} onCheckedChange={setShowStock} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Nota para el cliente (opcional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ej: Pedidos mínimos de 6 unidades para precio al mayor."
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Al presionar “Generar PDF” se abre el catálogo listo para imprimir: elige{" "}
            <strong>Guardar como PDF</strong> como destino y ya puedes enviarlo por WhatsApp o
            correo.
          </p>
        </div>

        <div className="surface-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 text-primary" /> Vista previa del contenido
            {isFetching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>

          {isLoading && <Skeleton className="h-64 w-full rounded-xl" />}

          {!isLoading && selected.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Package className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              No hay productos que cumplan los filtros seleccionados.
            </div>
          )}

          {!isLoading && selected.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {selected.map((p) => {
                const img = Array.isArray(p.images) && p.images.length ? p.images[0] : null;
                const stock = (p.variants ?? [])
                  .filter((v) => v.active !== false)
                  .reduce((s, v) => s + Number(v.stock || 0), 0);
                return (
                  <div key={p.id} className="rounded-lg border border-border p-2.5">
                    <div className="mb-2 flex h-28 items-center justify-center overflow-hidden rounded-md bg-surface-2">
                      {img ? (
                        <img
                          src={img}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover"
                        />
                      ) : (
                        <Package className="size-6 text-muted-foreground/60" />
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs font-semibold">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.brand?.name ?? "Sin marca"} · {p.category?.name ?? "Sin categoría"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[11px]">
                      {priceMode !== "mayor" && (
                        <span className="font-semibold text-primary">
                          {moneyExact(p.retail_price)}
                        </span>
                      )}
                      {priceMode !== "detal" && p.wholesale_price && (
                        <span className="text-muted-foreground">
                          Mayor {moneyExact(p.wholesale_price)}
                        </span>
                      )}
                      {showStock && <span className="text-muted-foreground">{stock} und.</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
