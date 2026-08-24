import type { AdminOrder } from "./orders.functions";
import { ORDER_STATUS_LABELS } from "./types";

const BRAND = {
  name: "KICKPOINT",
  tagline: "Ropa deportiva al mayor y detal",
  whatsapp: "+58 412-0000000",
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number): string {
  return `$${Number(n || 0).toFixed(2)}`;
}

function customerName(order: AdminOrder): string {
  const c = order.customer;
  if (!c) return "Cliente no registrado";
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Cliente";
}

function fullAddress(order: AdminOrder): string {
  const c = order.customer;
  if (!c) return "Sin dirección registrada";
  const parts = [c.address, c.city, c.state].filter(Boolean);
  return parts.length ? parts.join(", ") : "Sin dirección registrada";
}

function totalUnits(order: AdminOrder): number {
  return (order.items ?? []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
}

function carrierFromNotes(notes: string | null): string {
  const n = (notes ?? "").toUpperCase();
  if (n.includes("TEALCA")) return "TEALCA";
  if (n.includes("MRW")) return "MRW";
  if (n.includes("ZOOM")) return "ZOOM";
  if (n.includes("DOMESA")) return "DOMESA";
  if (n.includes("RETIRO") || n.includes("TIENDA")) return "RETIRO EN TIENDA";
  return "POR DEFINIR";
}

/** Nota de entrega (documento formal) + Guía/etiqueta para identificar el paquete. */
export function buildDeliveryNoteHtml(order: AdminOrder): string {
  const date = new Date(order.created_at).toLocaleString("es-VE");
  const printedAt = new Date().toLocaleString("es-VE");
  const units = totalUnits(order);
  const carrier = carrierFromNotes(order.notes);

  const rows = (order.items ?? [])
    .map(
      (i, idx) => `
      <tr>
        <td class="c">${idx + 1}</td>
        <td>
          <strong>${esc(i.product_name)}</strong>
          <div class="muted">Talla: ${esc(i.size ?? "Única")}${i.color ? ` · Color: ${esc(i.color)}` : ""}</div>
        </td>
        <td class="c">${esc(i.quantity)}</td>
        <td class="r">${money(i.unit_price)}</td>
        <td class="r">${money(i.subtotal)}</td>
      </tr>`,
    )
    .join("");

  const checklist = (order.items ?? [])
    .map(
      (i) => `<li><span class="box"></span> ${esc(i.quantity)} × ${esc(i.product_name)} —
        ${esc(i.size ?? "Única")}${i.color ? ` / ${esc(i.color)}` : ""}</li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Nota de entrega ${esc(order.order_number)} · ${BRAND.name}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color:#111; margin:0; padding:24px; background:#fff; }
  .sheet { max-width: 780px; margin: 0 auto; }
  header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #111; padding-bottom:12px; }
  .brand { font-size:30px; font-weight:900; letter-spacing:-0.5px; }
  .brand span { color:#16a34a; }
  .tagline { font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#555; }
  .doc { text-align:right; }
  .doc h1 { margin:0; font-size:16px; text-transform:uppercase; letter-spacing:1px; }
  .doc .num { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size:22px; font-weight:800; }
  .doc .muted { font-size:11px; color:#555; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px; }
  .card { border:1px solid #ddd; border-radius:8px; padding:10px 12px; }
  .card h2 { margin:0 0 6px; font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#555; }
  .card p { margin:2px 0; font-size:12.5px; }
  table { width:100%; border-collapse:collapse; margin-top:16px; font-size:12.5px; }
  th { background:#111; color:#fff; text-align:left; padding:7px 8px; font-size:10px; text-transform:uppercase; letter-spacing:1px; }
  td { border-bottom:1px solid #eee; padding:7px 8px; vertical-align:top; }
  .c { text-align:center; } .r { text-align:right; }
  .muted { color:#666; font-size:11px; }
  .totals { margin-top:12px; margin-left:auto; width:270px; font-size:13px; }
  .totals div { display:flex; justify-content:space-between; padding:4px 0; }
  .totals .grand { border-top:2px solid #111; font-size:17px; font-weight:800; padding-top:6px; }
  .signs { display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-top:36px; font-size:11px; color:#444; }
  .signs div { border-top:1px solid #111; padding-top:6px; text-align:center; }
  footer { margin-top:20px; font-size:10.5px; color:#666; text-align:center; }
  .label { page-break-before: always; border:4px solid #111; border-radius:10px; padding:18px; margin-top:28px; }
  .label .to { font-size:11px; text-transform:uppercase; letter-spacing:2px; color:#555; }
  .label .name { font-size:30px; font-weight:900; line-height:1.1; margin:4px 0 6px; }
  .label .addr { font-size:16px; line-height:1.35; }
  .label .row { display:flex; justify-content:space-between; gap:12px; margin-top:14px; border-top:2px dashed #111; padding-top:12px; }
  .label .big { font-family: ui-monospace, Menlo, monospace; font-size:26px; font-weight:800; }
  .check { margin-top:12px; font-size:13px; }
  .check ul { list-style:none; padding:0; margin:6px 0 0; }
  .check li { padding:3px 0; }
  .box { display:inline-block; width:12px; height:12px; border:2px solid #111; margin-right:8px; vertical-align:-1px; }
  .noprint { text-align:center; margin-bottom:16px; }
  .noprint button { background:#111; color:#fff; border:0; border-radius:8px; padding:10px 20px; font-weight:700; cursor:pointer; }
  @media print { .noprint { display:none; } body { padding:0; } }
</style>
</head>
<body>
<div class="noprint"><button onclick="window.print()">Imprimir nota y guía</button></div>
<div class="sheet">
  <header>
    <div>
      <div class="brand">KICK<span>POINT</span></div>
      <div class="tagline">${BRAND.tagline}</div>
    </div>
    <div class="doc">
      <h1>Nota de entrega</h1>
      <div class="num">${esc(order.order_number)}</div>
      <div class="muted">Pedido: ${esc(date)}</div>
      <div class="muted">Estado: ${esc(ORDER_STATUS_LABELS[order.status] ?? order.status)}</div>
    </div>
  </header>

  <div class="grid">
    <div class="card">
      <h2>Cliente</h2>
      <p><strong>${esc(customerName(order))}</strong></p>
      <p>WhatsApp: ${esc(order.customer?.whatsapp ?? "—")}</p>
      <p>Email: ${esc(order.customer?.email ?? "—")}</p>
    </div>
    <div class="card">
      <h2>Dirección de entrega</h2>
      <p>${esc(fullAddress(order))}</p>
      <p class="muted">Envío: ${esc(carrier)}</p>
      ${order.notes ? `<p class="muted">Nota: ${esc(order.notes)}</p>` : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr><th class="c">#</th><th>Producto</th><th class="c">Cant.</th><th class="r">P. Unit.</th><th class="r">Subtotal</th></tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="5" class="c muted">Sin productos</td></tr>`}</tbody>
  </table>

  <div class="totals">
    <div><span>Unidades</span><span>${units}</span></div>
    <div><span>Subtotal</span><span>${money(order.subtotal)}</span></div>
    <div><span>Método de pago</span><span>${esc(order.payment_method_code ?? "—")}</span></div>
    <div class="grand"><span>Total</span><span>${money(order.total)}</span></div>
  </div>

  <div class="signs">
    <div>Entregado por (KICKPOINT)</div>
    <div>Recibido por (Cliente / C.I.)</div>
  </div>

  <footer>
    ${BRAND.name} · ${esc(BRAND.whatsapp)} · Documento sin valor fiscal · Impreso ${esc(printedAt)}
  </footer>

  <!-- GUÍA / ETIQUETA DEL PAQUETE -->
  <div class="label">
    <div class="to">Enviar a</div>
    <div class="name">${esc(customerName(order))}</div>
    <div class="addr">${esc(fullAddress(order))}</div>
    <div class="addr"><strong>Tel:</strong> ${esc(order.customer?.whatsapp ?? "—")}</div>
    <div class="row">
      <div>
        <div class="to">Pedido</div>
        <div class="big">${esc(order.order_number)}</div>
      </div>
      <div>
        <div class="to">Bultos / Unidades</div>
        <div class="big">1 / ${units}</div>
      </div>
      <div>
        <div class="to">Envío</div>
        <div class="big">${esc(carrier)}</div>
      </div>
    </div>
    <div class="check">
      <strong>Verificación de empaque</strong>
      <ul>${checklist || "<li>Sin productos</li>"}</ul>
    </div>
    <div class="row">
      <div class="to">Remitente: KICKPOINT · ${esc(BRAND.whatsapp)}</div>
      <div class="to">${esc(order.is_wholesale ? "PEDIDO MAYORISTA" : "PEDIDO DETAL")}</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

/** Abre la nota de entrega + guía en una ventana nueva lista para imprimir. */
export function printDeliveryNote(order: AdminOrder): boolean {
  const html = buildDeliveryNoteHtml(order);
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
