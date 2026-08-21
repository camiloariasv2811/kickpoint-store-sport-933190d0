import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Edit2, Trash2, FolderTree, Tag, Check, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryRow,
} from "@/lib/categories.functions";

export const Route = createFileRoute("/_authenticated/admin/categorias")({
  component: AdminCategorias,
});

function AdminCategorias() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [sortOrder, setSortOrder] = useState(0);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: categories = [], isLoading } = useQuery<CategoryRow[]>({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      try {
        const res = await listAdminCategories();
        return res ?? [];
      } catch (err) {
        console.warn("[AdminCategorias] Error loading categories:", err);
        return [];
      }
    },
  });

  const roots = categories.filter((r) => !r.parent_id);

  function openCreate(parent?: string) {
    setEditingCategory(null);
    setName("");
    setSlug("");
    setParentId(parent || "none");
    setSortOrder(categories.length + 1);
    setActive(true);
    setModalOpen(true);
  }

  function openEdit(cat: CategoryRow) {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setParentId(cat.parent_id || "none");
    setSortOrder(cat.sort_order || 0);
    setActive(cat.active);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("El nombre de la categoría es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategory({
          data: {
            id: editingCategory.id,
            name: name.trim(),
            slug: slug.trim() || undefined,
            parent_id: parentId === "none" ? null : parentId,
            sort_order: Number(sortOrder) || 0,
            active,
          },
        });
        toast.success("Categoría actualizada");
      } else {
        await createCategory({
          data: {
            name: name.trim(),
            slug: slug.trim() || null,
            parent_id: parentId === "none" ? null : parentId,
            sort_order: Number(sortOrder) || 0,
            active,
          },
        });
        toast.success("Categoría creada");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      await queryClient.invalidateQueries({ queryKey: ["catalog", "categories"] });
      setModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message || "Error al guardar"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, catName: string) {
    if (!confirm(`¿Eliminar la categoría "${catName}"?`)) return;
    try {
      await deleteCategory({ data: { id } });
      toast.success("Categoría eliminada");
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      await queryClient.invalidateQueries({ queryKey: ["catalog", "categories"] });
    } catch (err: any) {
      console.error(err);
      toast.error(`No se pudo eliminar: ${err.message || "Puede tener productos asociados"}`);
    }
  }

  return (
    <AdminShell
      title="Categorías"
      subtitle="Estructura de catálogo, categorías principales y subcategorías"
      actions={
        <Button variant="hero" onClick={() => openCreate()} className="gap-1.5">
          <Plus className="size-4" /> Nueva Categoría
        </Button>
      }
    >
      {isLoading && <Skeleton className="h-64 w-full rounded-xl" />}

      {!isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roots.length === 0 && (
            <div className="surface-card col-span-full p-12 text-center text-muted-foreground">
              <FolderTree className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              No hay categorías creadas. Crea una categoría principal para empezar.
            </div>
          )}

          {roots.map((root) => {
            const children = categories.filter((r) => r.parent_id === root.id);

            return (
              <div key={root.id} className="surface-card flex flex-col justify-between p-4">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-display text-lg font-bold">{root.name}</h2>
                      <span className="font-mono text-xs text-muted-foreground">/{root.slug}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-7 p-0"
                        onClick={() => openEdit(root)}
                        title="Editar categoría principal"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(root.id, root.name)}
                        title="Eliminar categoría"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between border-b border-border pb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                      <span>Subcategorías ({children.length})</span>
                      <button
                        type="button"
                        onClick={() => openCreate(root.id)}
                        className="inline-flex items-center gap-0.5 text-primary hover:underline"
                      >
                        <Plus className="size-3" /> Añadir
                      </button>
                    </div>

                    <ul className="mt-2 divide-y divide-border text-sm">
                      {children.map((child) => (
                        <li key={child.id} className="flex items-center justify-between py-2">
                          <div>
                            <span className="font-medium text-foreground">{child.name}</span>
                            <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                              /{child.slug}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-6 p-0"
                              onClick={() => openEdit(child)}
                            >
                              <Edit2 className="size-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(child.id, child.name)}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </li>
                      ))}
                      {children.length === 0 && (
                        <li className="py-3 text-center text-xs text-muted-foreground">
                          Sin subcategorías
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar Categoría */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
            <DialogDescription>
              Configura el nombre, URL amigable (slug) y nivel jerárquico.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="cat-name">Nombre *</Label>
              <Input
                id="cat-name"
                value={name}
                placeholder="Ej. Baloncesto, Conjuntos..."
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="cat-slug">Slug (URL amigable)</Label>
              <Input
                id="cat-slug"
                value={slug}
                placeholder="ej-baloncesto (opcional)"
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>

            <div>
              <Label>Categoría Padre</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona padre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna (Categoría Principal)</SelectItem>
                  {roots
                    .filter((r) => !editingCategory || r.id !== editingCategory.id)
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cat-sort">Orden</Label>
                <Input
                  id="cat-sort"
                  type="number"
                  value={String(sortOrder)}
                  onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch id="cat-act" checked={active} onCheckedChange={setActive} />
                <Label htmlFor="cat-act" className="cursor-pointer font-semibold">
                  Activa
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="hero" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              {editingCategory ? "Guardar Cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
