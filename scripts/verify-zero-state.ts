import {
  DEMO_PRODUCTS,
  getInMemoryProducts,
  getInMemoryOrders,
  getInMemorySales,
  getInMemoryKardex,
} from "../src/lib/demo-data";

function verifyZeroState() {
  console.log("=== COMPROBACIÓN DEL ESTADO INICIAL REAL (ZERO STATE) ===");

  const products = getInMemoryProducts();
  const orders = getInMemoryOrders();
  const sales = getInMemorySales();
  const kardex = getInMemoryKardex();

  let totalUnits = 0;
  let totalCost = 0;
  let totalRetail = 0;
  let totalWholesale = 0;

  for (const p of products) {
    for (const v of p.variants ?? []) {
      if (v.active) {
        totalUnits += v.stock ?? 0;
        totalCost += (v.stock ?? 0) * (p.cost ?? (p.retail_price ? p.retail_price * 0.6 : 15));
        totalRetail += (v.stock ?? 0) * (p.retail_price ?? 0);
        totalWholesale += (v.stock ?? 0) * (p.wholesale_price ?? p.retail_price ?? 0);
      }
    }
  }

  console.log("1. Inventario Total (unidades en stock real):", totalUnits);
  console.log("2. Valor al Costo / Inversión ($):", totalCost.toFixed(2));
  console.log("3. Valor al Detal ($):", totalRetail.toFixed(2));
  console.log("4. Valor al Mayor ($):", totalWholesale.toFixed(2));
  console.log("5. Ventas Registradas (cantidad):", sales.length);
  console.log("6. Pedidos Registrados (cantidad):", orders.length);
  console.log("7. Movimientos en Kárdex (cantidad):", kardex.length);

  if (sales.length !== 0) throw new Error("ERROR: Sales must be 0");
  if (orders.length !== 0) throw new Error("ERROR: Orders must be 0");
  if (kardex.length !== 0) throw new Error("ERROR: Kardex must be 0");
  if (totalUnits <= 0) throw new Error("ERROR: Inventory units must be preserved and > 0");

  console.log("\n>>> TODO EL ESTADO INICIAL CUMPLE CON LAS ESPECIFICACIONES EXACTAS: <<<");
  console.log("- Productos vendidos: 0");
  console.log("- Ventas de hoy: $0.00");
  console.log("- Ventas del mes: $0.00");
  console.log("- Dinero cobrado: $0.00");
  console.log("- Entradas de inventario: 0");
  console.log("- Salidas de inventario: 0");
  console.log("- Kárdex: 0 movimientos");
  console.log(`- Stock disponible preservado: ${totalUnits} unidades`);
}

verifyZeroState();
