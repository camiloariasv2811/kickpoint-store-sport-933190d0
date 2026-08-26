/**
 * Generador de catálogo imprimible / descargable en PDF (vía diálogo de impresión
 * del navegador → "Guardar como PDF"). Mismo enfoque de impresión que la nota de entrega,
 * con soporte móvil mediante iframe oculto.
 */

const BRAND = {
  name: "KICKPOINT",
  tagline: "Ropa deportiva al mayor y al detal",
  whatsapp: "+58 412-1546698",
};

export type CatalogPdfProduct = {
  id: string;
  name: string;
  base_sku: string | null;
  retail_price: number;
  wholesale_price: number | null;
  wholesale_min_qty?: number | null;
  images?: string[] | null;
  brand: { name: string } | null;
  category: { name: string } | null;
  variants: { size: string; color: string | null; stock: number; active?: boolean }[];
};

export type CatalogPdfOptions = {
  priceMode: "detal" | "mayor" | "ambos";
  showStock: boolean;
  showSizes: boolean;
  note?: string;
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number | null | undefined): string {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

function sizesLabel(p: CatalogPdfProduct): string {
  const active = (p.variants ?? []).filter((v) => v.active !== false);
  const sizes = Array.from(new Set(active.map((v) => v.size).filter(Boolean)));
  return sizes.length ? sizes.join(" · ") : "Talla única";
}

function stockTotal(p: CatalogPdfProduct): number {
  return (p.variants ?? [])
    .filter((v) => v.active !== false)
    .reduce((s, v) => s + Number(v.stock || 0), 0);
}

function priceBlock(p: CatalogPdfProduct, opts: CatalogPdfOptions): string {
  const retail = `<div class="price"><span class="plabel">Detal</span><span class="pval">${money(p.retail_price)}</span></div>`;
  const minQty = Number(p.wholesale_min_qty || 0);
  const wholesale = p.wholesale_price
    ? `<div class="price"><span class="plabel">Mayor${minQty > 1 ? ` (${minQty}+)` : ""}</span><span class="pval">${money(p.wholesale_price)}</span></div>`
    : "";

  if (opts.priceMode === "detal") return retail;
  if (opts.priceMode === "mayor") return wholesale || retail;
  return retail + wholesale;
}

function card(p: CatalogPdfProduct, opts: CatalogPdfOptions): string {
  const img = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
  const stock = stockTotal(p);

  return `<article class="card">
    <div class="thumb">
      ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" />` : `<div class="noimg">Sin imagen</div>`}
    </div>
    <div class="body">
      <h3>${esc(p.name)}</h3>
      <div class="meta">${esc(p.brand?.name ?? "Sin marca")} · ${esc(p.category?.name ?? "Sin categoría")}</div>
      ${p.base_sku ? `<div class="sku">SKU ${esc(p.base_sku)}</div>` : ""}
      ${opts.showSizes ? `<div class="sizes">Tallas: ${esc(sizesLabel(p))}</div>` : ""}
      ${opts.showStock ? `<div class="sizes">Disponibles: ${stock} und.</div>` : ""}
      <div class="prices">${priceBlock(p, opts)}</div>
    </div>
  </article>`;
}

export function buildCatalogHtml(products: CatalogPdfProduct[], opts: CatalogPdfOptions): string {
  const today = new Date().toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const grouped = new Map<string, CatalogPdfProduct[]>();
  for (const p of products) {
    const key = p.category?.name ?? "Otros";
    const list = grouped.get(key) ?? [];
    list.push(p);
    grouped.set(key, list);
  }

  const sections = Array.from(grouped.entries())
    .map(
      ([cat, list]) => `<section class="group">
        <h2 class="grouptitle">${esc(cat)} <span>${list.length} productos</span></h2>
        <div class="grid">${list.map((p) => card(p, opts)).join("")}</div>
      </section>`,
    )
    .join("");

  const modeLabel =
    opts.priceMode === "detal"
      ? "Precios al detal"
      : opts.priceMode === "mayor"
        ? "Precios al mayor"
        : "Precios detal y mayor";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Catálogo ${BRAND.name} - ${today}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #111; background: #fff; }
  .cover { display: flex; align-items: center; justify-content: space-between;
    background: #0b0b0b; color: #fff; padding: 18px 20px; border-radius: 10px; }
  .cover h1 { margin: 0; font-size: 26px; letter-spacing: 2px; }
  .cover .accent { color: #9dff3c; }
  .cover p { margin: 4px 0 0; font-size: 11px; color: #d6d6d6; }
  .cover .right { text-align: right; font-size: 11px; color: #d6d6d6; }
  .group { margin-top: 16px; page-break-inside: auto; }
  .grouptitle { font-size: 14px; text-transform: uppercase; letter-spacing: 1px;
    border-bottom: 2px solid #9dff3c; padding-bottom: 5px; margin: 0 0 10px; }
  .grouptitle span { float: right; font-size: 10px; color: #666; letter-spacing: 0; text-transform: none; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .card { border: 1px solid #e3e3e3; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
  .thumb { height: 132px; background: #f5f5f5; display: flex; align-items: center; justify-content: center; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; }
  .noimg { font-size: 10px; color: #999; }
  .body { padding: 8px 9px 10px; }
  .body h3 { margin: 0 0 3px; font-size: 12px; line-height: 1.25; }
  .meta { font-size: 9.5px; color: #666; }
  .sku { font-size: 9px; color: #888; margin-top: 2px; }
  .sizes { font-size: 9.5px; color: #333; margin-top: 3px; }
  .prices { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; }
  .price { border: 1px solid #ececec; border-radius: 6px; padding: 3px 6px; background: #fafafa; }
  .plabel { display: block; font-size: 8px; text-transform: uppercase; color: #777; letter-spacing: .6px; }
  .pval { font-size: 12px; font-weight: bold; }
  .note { margin-top: 14px; font-size: 10.5px; border-left: 3px solid #9dff3c; padding-left: 8px; color: #333; }
  .foot { margin-top: 16px; border-top: 1px solid #e3e3e3; padding-top: 8px;
    font-size: 9.5px; color: #666; display: flex; justify-content: space-between; }
  .empty { padding: 40px; text-align: center; color: #777; font-size: 12px; }
  @media print { .noprint { display: none !important; } }
</style>
</head>
<body>
  <div class="cover">
    <div>
      <h1>KICK<span class="accent">POINT</span></h1>
      <p>${esc(BRAND.tagline)}</p>
    </div>
    <div class="right">
      <div><strong>Catálogo</strong> · ${esc(today)}</div>
      <div>${esc(modeLabel)}</div>
      <div>WhatsApp ${esc(BRAND.whatsapp)}</div>
      <div>${products.length} productos</div>
    </div>
  </div>

  ${opts.note ? `<div class="note">${esc(opts.note)}</div>` : ""}

  ${sections || `<div class="empty">No hay productos que cumplan los filtros seleccionados.</div>`}

  <div class="foot">
    <span>${esc(BRAND.name)} · Precios en USD, sujetos a cambio sin previo aviso.</span>
    <span>Pedidos por WhatsApp ${esc(BRAND.whatsapp)}</span>
  </div>
</body>
</html>`;
}

/** Abre el catálogo listo para imprimir o guardar como PDF. */
export function printCatalog(products: CatalogPdfProduct[], opts: CatalogPdfOptions): boolean {
  const html = buildCatalogHtml(products, opts);

  try {
    const win = window.open("", "_blank", "width=1000,height=1000");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      return true;
    }
  } catch {
    // popup bloqueado (frecuente en móviles): usamos el iframe de abajo
  }

  try {
    document.getElementById("kp-catalog-frame")?.remove();

    const frame = document.createElement("iframe");
    frame.id = "kp-catalog-frame";
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.srcdoc = html;
    frame.onload = () => {
      // damos margen a que carguen las imágenes remotas antes de imprimir
      setTimeout(() => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          /* noop */
        }
      }, 900);
    };
    document.body.appendChild(frame);
    return true;
  } catch {
    return false;
  }
}

/** Descarga el catálogo como archivo HTML autónomo (respaldo para compartir). */
export function downloadCatalogHtml(
  products: CatalogPdfProduct[],
  opts: CatalogPdfOptions,
): boolean {
  try {
    const html = buildCatalogHtml(products, opts);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `catalogo-kickpoint-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}
