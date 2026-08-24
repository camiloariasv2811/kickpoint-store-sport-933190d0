import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import {
  getInMemoryKardex,
  getInMemoryOrders,
  getInMemoryProducts,
  getInMemorySales,
} from "./demo-data";

export type InventoryMovementFlow = {
  currentStockUnits: number;
  totalSoldUnits: number;
  totalCollectedMoney: number;
  totalEntriesUnits: number;
  totalExitsUnits: number;
  totalAdjustmentsUnits: number;
  initialUnits: number;
  hasHistoricalMovements: boolean;
  flowDescription: string;
};

export type DashboardMetrics = {
  sales: {
    todayTotal: number;
    todayCount: number;
    monthTotal: number;
    monthCount: number;
    totalGenerated: number;
    totalCollected: number;
    totalUnitsSold: number;
    pendingPaymentsCount: number;
    pendingPaymentsAmount: number;
    pendingOrdersCount: number;
  };
  inventory: {
    totalUnits: number;
    totalCostValue: number;
    totalRetailValue: number;
    totalWholesaleValue: number;
    activeProductsCount: number;
    outOfStockCount: number;
    lowStockCount: number;
  };
  inventoryFlow: InventoryMovementFlow;
  charts: {
    salesEvolution: {
      date: string;
      label: string;
      total: number;
      orders: number;
    }[];
    salesByChannel: {
      name: string;
      value: number;
      count: number;
    }[];
    inventoryByCategory: {
      name: string;
      value: number;
    }[];
  };
  recentOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string | null;
    channel: string;
    total: number;
    status: string;
    paymentStatus: string;
    paymentMethod: string | null;
    createdAt: string;
  }[];
  lowStockItems: {
    productId: string;
    productName: string;
    variantId: string;
    size: string;
    color: string | null;
    sku: string | null;
    stock: number;
    threshold: number;
    status: "agotado" | "bajo";
  }[];
  recentMovements: {
    id: string;
    productName: string;
    size: string | null;
    color: string | null;
    sku: string | null;
    type: string;
    quantity: number;
    stockAfter: number | null;
    reference: string | null;
    note: string | null;
    createdAt: string;
  }[];
};

export function getInMemoryDashboardMetrics(): DashboardMetrics {
  const products = getInMemoryProducts();
  let totalUnits = 0;
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let totalWholesaleValue = 0;
  let activeProductsCount = 0;
  let outOfStockCount = 0;
  let lowStockCount = 0;
  const lowStockItems: DashboardMetrics["lowStockItems"] = [];
  const categoryStockMap: Record<string, number> = {};

  for (const p of products) {
    if (p.active === false) continue;
    activeProductsCount++;
    const threshold = p.low_stock_threshold ?? 5;
    const catName = p.category?.name ?? "General";
    let productStock = 0;

    for (const v of p.variants ?? []) {
      if (v.active === false) continue;
      const vStock = Number(v.stock ?? 0);
      productStock += vStock;
      totalUnits += vStock;
      const cost = p.cost ?? (p.retail_price ? p.retail_price * 0.6 : 15);
      totalCostValue += vStock * cost;
      totalRetailValue += vStock * (p.retail_price ?? 0);
      totalWholesaleValue += vStock * (p.wholesale_price ?? p.retail_price ?? 0);
      categoryStockMap[catName] = (categoryStockMap[catName] ?? 0) + vStock;

      if (vStock <= 0) {
        lowStockItems.push({
          productId: p.id,
          productName: p.name,
          variantId: v.id,
          size: v.size,
          color: v.color,
          sku: v.sku ?? p.base_sku,
          stock: vStock,
          threshold,
          status: "agotado",
        });
      } else if (vStock <= threshold) {
        lowStockItems.push({
          productId: p.id,
          productName: p.name,
          variantId: v.id,
          size: v.size,
          color: v.color,
          sku: v.sku ?? p.base_sku,
          stock: vStock,
          threshold,
          status: "bajo",
        });
      }
    }

    if (productStock === 0) {
      outOfStockCount++;
    } else if (productStock <= threshold) {
      lowStockCount++;
    }
  }

  const inventoryByCategory = Object.entries(categoryStockMap).map(([name, value]) => ({
    name,
    value,
  }));

  const orders = getInMemoryOrders();
  const sales = getInMemorySales();
  const kardex = getInMemoryKardex();

  let totalGenerated = 0;
  let totalCollected = 0;
  let todayTotal = 0;
  let todayCount = 0;
  let monthTotal = 0;
  let monthCount = 0;
  let pendingPaymentsCount = 0;
  let pendingPaymentsAmount = 0;
  let pendingOrdersCount = 0;
  let totalUnitsSold = 0;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // Evolution chart map
  const daysEvolutionMap: Record<string, { label: string; total: number; orders: number }> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0]!;
    const dayLabel = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    daysEvolutionMap[dateKey] = { label: dayLabel, total: 0, orders: 0 };
  }

  const channelMap: Record<string, { name: string; value: number; count: number }> = {
    online: { name: "Web / Online", value: 0, count: 0 },
    presencial: { name: "Tienda / POS", value: 0, count: 0 },
    whatsapp: { name: "WhatsApp", value: 0, count: 0 },
  };

  for (const o of orders) {
    if (o.status !== "cancelado") {
      totalGenerated += Number(o.total || 0);
    }
    const isCollected =
      o.payments.some((p) => p.status === "verificado") ||
      ["pago_verificado", "preparando_pedido", "empacando_pedido", "enviado", "entregado"].includes(
        o.status,
      );

    if (isCollected) {
      const orderAmount = Number(o.total || 0);
      totalCollected += orderAmount;
      const orderDate = new Date(o.created_at).getTime();
      if (orderDate >= startOfToday) {
        todayTotal += orderAmount;
        todayCount++;
      }
      if (orderDate >= startOfMonth) {
        monthTotal += orderAmount;
        monthCount++;
      }
      for (const item of o.items ?? []) {
        totalUnitsSold += Number(item.quantity || 0);
      }
      const [dateKey] = o.created_at.split("T");
      if (dateKey && daysEvolutionMap[dateKey]) {
        daysEvolutionMap[dateKey].total += orderAmount;
        daysEvolutionMap[dateKey].orders += 1;
      }
      channelMap.online.value += orderAmount;
      channelMap.online.count += 1;
    }

    const hasPendingPayment = o.payments.some((p) => p.status === "pendiente");
    if (hasPendingPayment) {
      pendingPaymentsCount++;
      pendingPaymentsAmount += Number(o.total || 0);
    }
    if (["pedido_recibido", "pago_pendiente", "pago_subido"].includes(o.status)) {
      pendingOrdersCount++;
    }
  }

  for (const s of sales) {
    const saleTotal = Number(s.total || 0);
    totalGenerated += saleTotal;
    totalCollected += saleTotal;
    const saleDate = new Date(s.created_at).getTime();
    if (saleDate >= startOfToday) {
      todayTotal += saleTotal;
      todayCount++;
    }
    if (saleDate >= startOfMonth) {
      monthTotal += saleTotal;
      monthCount++;
    }
    for (const item of s.items ?? []) {
      totalUnitsSold += Number(item.quantity || 0);
    }
    const [dateKey] = s.created_at.split("T");
    if (dateKey && daysEvolutionMap[dateKey]) {
      daysEvolutionMap[dateKey].total += saleTotal;
      daysEvolutionMap[dateKey].orders += 1;
    }
    const ch = s.channel || "presencial";
    if (!channelMap[ch]) {
      channelMap[ch] = { name: ch, value: 0, count: 0 };
    }
    channelMap[ch].value += saleTotal;
    channelMap[ch].count += 1;
  }

  const daysEvolution: DashboardMetrics["charts"]["salesEvolution"] = Object.entries(
    daysEvolutionMap,
  ).map(([date, val]) => ({
    date,
    label: val.label,
    total: Number(val.total.toFixed(2)),
    orders: val.orders,
  }));

  const salesByChannel = Object.values(channelMap).map((ch) => ({
    name: ch.name,
    value: Number(ch.value.toFixed(2)),
    count: ch.count,
  }));

  const recentOrders = orders.slice(0, 10).map((o) => {
    const payment = o.payments[o.payments.length - 1];
    return {
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer
        ? `${o.customer.first_name} ${o.customer.last_name || ""}`.trim()
        : "Cliente",
      customerPhone: o.customer?.whatsapp ?? null,
      channel: o.channel || "online",
      total: Number(o.total),
      status: o.status,
      paymentStatus: payment?.status ?? "pendiente",
      paymentMethod: o.payment_method_code,
      createdAt: o.created_at,
    };
  });

  const recentMovements = kardex.slice(0, 10).map((k) => ({
    id: k.id,
    productName: k.productName,
    size: k.size,
    color: k.color,
    sku: k.sku,
    type: k.type,
    quantity: k.quantity,
    stockAfter: k.stockAfter,
    reference: k.reference,
    note: k.note,
    createdAt: k.createdAt,
  }));

  const totalEntriesUnits = kardex
    .filter((k) => k.type === "entrada" || k.type === "inicial")
    .reduce((sum, k) => sum + Number(k.quantity || 0), 0);
  const totalExitsUnits = kardex
    .filter((k) => k.type === "salida" || k.type === "venta")
    .reduce((sum, k) => sum + Number(k.quantity || 0), 0);
  const initialUnits =
    kardex.length > 0
      ? Math.max(0, totalUnits + totalExitsUnits - totalEntriesUnits)
      : totalUnits + totalUnitsSold;

  const flowDescription =
    totalUnitsSold === 0 && totalExitsUnits === 0 && totalEntriesUnits === 0
      ? `${totalUnits.toLocaleString()} disponibles · 0 vendidas · 0 salidas`
      : `${initialUnits.toLocaleString()} iniciales → ${totalUnitsSold.toLocaleString()} vendidas → ${totalUnits.toLocaleString()} disponibles`;

  return {
    sales: {
      todayTotal: Number(todayTotal.toFixed(2)),
      todayCount,
      monthTotal: Number(monthTotal.toFixed(2)),
      monthCount,
      totalGenerated: Number(totalGenerated.toFixed(2)),
      totalCollected: Number(totalCollected.toFixed(2)),
      totalUnitsSold,
      pendingPaymentsCount,
      pendingPaymentsAmount: Number(pendingPaymentsAmount.toFixed(2)),
      pendingOrdersCount,
    },
    inventory: {
      totalUnits,
      totalCostValue: Number(totalCostValue.toFixed(2)),
      totalRetailValue: Number(totalRetailValue.toFixed(2)),
      totalWholesaleValue: Number(totalWholesaleValue.toFixed(2)),
      activeProductsCount,
      outOfStockCount,
      lowStockCount,
    },
    inventoryFlow: {
      currentStockUnits: totalUnits,
      totalSoldUnits: totalUnitsSold,
      totalCollectedMoney: Number(totalCollected.toFixed(2)),
      totalEntriesUnits,
      totalExitsUnits,
      totalAdjustmentsUnits: 0,
      initialUnits,
      hasHistoricalMovements: kardex.length > 0,
      flowDescription,
    },
    charts: {
      salesEvolution: daysEvolution,
      salesByChannel,
      inventoryByCategory,
    },
    recentOrders,
    lowStockItems: lowStockItems.slice(0, 10),
    recentMovements,
  };
}

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    if (!isSupabaseServerConfigured()) {
      return getInMemoryDashboardMetrics();
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Consultar datos reales en paralelo utilizando supabaseAdmin
      const [productsRes, ordersRes, salesRes, movementsRes, paymentsRes] = await Promise.all([
        supabaseAdmin.from("products").select(`
            id, name, base_sku, cost, retail_price, wholesale_price, low_stock_threshold, active,
            category:categories(name),
            product_variants(id, size, color, sku, stock, active)
          `),
        supabaseAdmin
          .from("orders")
          .select(
            `
            id, order_number, status, channel, total, subtotal, is_wholesale, created_at, payment_method_code,
            customer:customers(first_name, last_name, whatsapp, phone),
            payments(id, status, amount, method_code, reference, proof_url, proof_uploaded_at, verified_at),
            order_items(id, quantity)
          `,
          )
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("sales")
          .select(
            `
            id, sale_number, order_id, customer_id, channel, payment_method_code, total, cost_total, created_at,
            sale_items(id, quantity)
          `,
          )
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("inventory_movements")
          .select(
            `
            id, variant_id, type, quantity, unit_cost, stock_after, reference, note, created_at, created_by,
            product_variants(id, size, color, sku, products(name))
          `,
          )
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("payments").select(`
            id, order_id, method_code, amount, status, reference, proof_url, proof_uploaded_at, verified_at, created_at
          `),
      ]);

      if (productsRes.error || ordersRes.error || salesRes.error) {
        console.error("[getAdminDashboard] database query error:", {
          productsError: productsRes.error?.message,
          ordersError: ordersRes.error?.message,
          salesError: salesRes.error?.message,
        });
      }

      const rawProducts = productsRes.data ?? [];
      const rawOrders = ordersRes.data ?? [];
      const rawSales = salesRes.data ?? [];
      const rawMovements = movementsRes.data ?? [];
      const rawPayments = paymentsRes.data ?? [];

      // Procesar inventario
      let totalUnits = 0;
      let totalCostValue = 0;
      let totalRetailValue = 0;
      let totalWholesaleValue = 0;
      let activeProductsCount = 0;
      let outOfStockCount = 0;
      let lowStockCount = 0;

      const lowStockItems: DashboardMetrics["lowStockItems"] = [];
      const categoryStockMap: Record<string, number> = {};

      for (const p of rawProducts) {
        const isProductActive = p.active;
        if (isProductActive) {
          activeProductsCount++;
        }

        const categoryName = (p.category as { name?: string } | null)?.name ?? "Sin categoría";
        const variants = (p.product_variants ?? []).filter((v) => v.active !== false);
        const threshold = Number(p.low_stock_threshold ?? 5);
        const productCost = Number(p.cost ?? 0);
        const productRetail = Number(p.retail_price ?? 0);
        const productWholesale = Number(p.wholesale_price) || productRetail;

        let productTotalStock = 0;

        for (const v of variants) {
          const vStock = Number(v.stock ?? 0);
          productTotalStock += vStock;

          if (isProductActive) {
            totalUnits += vStock;
            totalCostValue += vStock * productCost;
            totalRetailValue += vStock * productRetail;
            totalWholesaleValue += vStock * productWholesale;

            categoryStockMap[categoryName] = (categoryStockMap[categoryName] ?? 0) + vStock;

            if (vStock <= 0) {
              lowStockItems.push({
                productId: p.id,
                productName: p.name,
                variantId: v.id,
                size: v.size,
                color: v.color,
                sku: v.sku ?? p.base_sku,
                stock: vStock,
                threshold,
                status: "agotado",
              });
            } else if (vStock <= threshold) {
              lowStockItems.push({
                productId: p.id,
                productName: p.name,
                variantId: v.id,
                size: v.size,
                color: v.color,
                sku: v.sku ?? p.base_sku,
                stock: vStock,
                threshold,
                status: "bajo",
              });
            }
          }
        }

        if (isProductActive && (variants.length === 0 || productTotalStock === 0)) {
          outOfStockCount++;
        } else if (isProductActive && productTotalStock <= threshold) {
          lowStockCount++;
        }
      }

      lowStockItems.sort((a, b) => a.stock - b.stock);

      // Fechas y períodos
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      // Ventas de hoy: pagos online verificados hoy + ventas directas POS de hoy
      const todayVerifiedPayments = rawPayments.filter(
        (p) =>
          p.status === "verificado" &&
          new Date(p.verified_at || p.created_at).getTime() >= startOfToday,
      );
      const todayPosSales = rawSales.filter(
        (s) => !s.order_id && new Date(s.created_at).getTime() >= startOfToday,
      );

      const todayTotal =
        todayVerifiedPayments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0) +
        todayPosSales.reduce((sum, s) => sum + Number(s.total ?? 0), 0);
      const todayCount = todayVerifiedPayments.length + todayPosSales.length;

      // Ventas del mes: pagos online verificados este mes + ventas directas POS del mes
      const monthVerifiedPayments = rawPayments.filter(
        (p) =>
          p.status === "verificado" &&
          new Date(p.verified_at || p.created_at).getTime() >= startOfMonth,
      );
      const monthPosSales = rawSales.filter(
        (s) => !s.order_id && new Date(s.created_at).getTime() >= startOfMonth,
      );

      const monthTotal =
        monthVerifiedPayments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0) +
        monthPosSales.reduce((sum, s) => sum + Number(s.total ?? 0), 0);
      const monthCount = monthVerifiedPayments.length + monthPosSales.length;

      // Dinero cobrado / verificado total
      const verifiedPaymentsSum = rawPayments
        .filter((p) => p.status === "verificado")
        .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

      const posSalesSum = rawSales
        .filter((s) => !s.order_id)
        .reduce((sum, s) => sum + Number(s.total ?? 0), 0);

      const totalCollected = verifiedPaymentsSum + posSalesSum;

      // Dinero total generado (pedidos no cancelados + ventas POS directas)
      const validOrders = rawOrders.filter((o) => o.status !== "cancelado");
      const totalGenerated =
        posSalesSum + validOrders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);

      // Pagos pendientes
      const pendingPayments = rawPayments.filter((p) => p.status === "pendiente");
      const pendingPaymentsCount = pendingPayments.length;
      const pendingPaymentsAmount = pendingPayments.reduce(
        (sum, p) => sum + Number(p.amount ?? 0),
        0,
      );

      // Pedidos pendientes de procesar
      const pendingStatuses = new Set([
        "pedido_recibido",
        "pago_pendiente",
        "pago_subido",
        "pago_verificado",
        "preparando_pedido",
        "empacando_pedido",
      ]);
      const pendingOrdersCount = rawOrders.filter((o) => pendingStatuses.has(o.status)).length;

      // Generar evolución de ventas (últimos 14 días)
      const daysEvolutionMap: Record<string, { label: string; total: number; orders: number }> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const [dateKey] = d.toISOString().split("T");
        const dayName = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
        if (dateKey) {
          daysEvolutionMap[dateKey] = { label: dayName, total: 0, orders: 0 };
        }
      }

      for (const p of rawPayments.filter((x) => x.status === "verificado")) {
        const dateStr = p.verified_at || p.created_at;
        const [dateKey] = dateStr.split("T");
        if (dateKey && daysEvolutionMap[dateKey]) {
          daysEvolutionMap[dateKey].total += Number(p.amount ?? 0);
          daysEvolutionMap[dateKey].orders += 1;
        }
      }

      for (const s of rawSales.filter((x) => !x.order_id)) {
        const [dateKey] = s.created_at.split("T");
        if (dateKey && daysEvolutionMap[dateKey]) {
          daysEvolutionMap[dateKey].total += Number(s.total ?? 0);
          daysEvolutionMap[dateKey].orders += 1;
        }
      }

      const salesEvolution = Object.entries(daysEvolutionMap).map(([date, val]) => ({
        date,
        label: val.label,
        total: Number(val.total.toFixed(2)),
        orders: val.orders,
      }));

      // Distribución por canal
      const channelMap: Record<string, { name: string; value: number; count: number }> = {
        online: { name: "Web / Online", value: 0, count: 0 },
        presencial: { name: "Tienda / POS", value: 0, count: 0 },
        whatsapp: { name: "WhatsApp", value: 0, count: 0 },
      };

      for (const p of rawPayments.filter((x) => x.status === "verificado")) {
        channelMap.online.value += Number(p.amount ?? 0);
        channelMap.online.count += 1;
      }

      for (const s of rawSales.filter((x) => !x.order_id)) {
        const ch = s.channel || "presencial";
        if (!channelMap[ch]) {
          channelMap[ch] = { name: ch, value: 0, count: 0 };
        }
        channelMap[ch].value += Number(s.total ?? 0);
        channelMap[ch].count += 1;
      }

      const salesByChannel = Object.values(channelMap).filter((c) => c.value > 0 || c.count > 0);

      // Inventario por categoría
      const inventoryByCategory = Object.entries(categoryStockMap).map(([name, value]) => ({
        name,
        value,
      }));

      // Pedidos recientes
      const recentOrders: DashboardMetrics["recentOrders"] = rawOrders.slice(0, 8).map((o) => {
        const customer = o.customer as {
          first_name?: string;
          last_name?: string | null;
          whatsapp?: string | null;
          phone?: string | null;
        } | null;

        const customerName = customer
          ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Cliente"
          : "Cliente sin registrar";

        const payments = (o.payments as { status?: string; method_code?: string }[]) || [];
        const paymentStatus = payments[0]?.status ?? "sin_pago";
        const paymentMethod = o.payment_method_code || payments[0]?.method_code || "N/A";

        return {
          id: o.id,
          orderNumber: o.order_number,
          customerName,
          customerPhone: customer?.whatsapp || customer?.phone || null,
          channel: o.channel || "online",
          total: Number(o.total ?? 0),
          status: o.status,
          paymentStatus,
          paymentMethod,
          createdAt: o.created_at,
        };
      });

      // Movimientos recientes (últimos 15)
      const recentMovements: DashboardMetrics["recentMovements"] = rawMovements
        .slice(0, 15)
        .map((m: any) => {
          const variant = m.product_variants as {
            id?: string;
            size?: string | null;
            color?: string | null;
            sku?: string | null;
            products?: { name?: string } | null;
            product?: { name?: string } | null;
          } | null;

          const prodName = variant?.products?.name ?? variant?.product?.name ?? "Producto";

          return {
            id: m.id,
            productName: prodName,
            size: variant?.size ?? null,
            color: variant?.color ?? null,
            sku: variant?.sku ?? null,
            type: m.type,
            quantity: Number(m.quantity ?? 0),
            stockAfter: m.stock_after !== null ? Number(m.stock_after) : null,
            reference: m.reference ?? null,
            note: m.note ?? null,
            createdAt: m.created_at,
          };
        });

      // Total de unidades vendidas (únicamente de pedidos con pago verificado y ventas directas POS)
      const verifiedOrders = rawOrders.filter(
        (o) =>
          o.status !== "cancelado" &&
          ((o.payments as any[])?.some((p) => p.status === "verificado") ||
            [
              "pago_verificado",
              "preparando_pedido",
              "empacando_pedido",
              "enviado",
              "entregado",
            ].includes(o.status)),
      );
      let onlineUnitsSold = 0;
      for (const o of verifiedOrders) {
        const items = (o.order_items as { quantity?: number }[]) || [];
        for (const it of items) {
          onlineUnitsSold += Number(it.quantity || 0);
        }
      }

      const directPosSales = rawSales.filter((s) => !s.order_id);
      let posUnitsSold = 0;
      for (const s of directPosSales) {
        const items = (s.sale_items as { quantity?: number }[]) || [];
        for (const it of items) {
          posUnitsSold += Number(it.quantity || 0);
        }
      }

      const totalUnitsSold = onlineUnitsSold + posUnitsSold;

      // Balance y control del inventario
      const totalEntriesUnits = rawMovements
        .filter((m) => m.type === "entrada" || m.type === "inicial")
        .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
      const totalExitsUnits = rawMovements
        .filter((m) => m.type === "salida" || m.type === "venta")
        .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
      const totalAdjustmentsUnits = rawMovements
        .filter((m) => m.type === "ajuste")
        .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

      const hasHistoricalMovements = rawMovements.length > 0;
      const initialUnits = hasHistoricalMovements
        ? Math.max(0, totalUnits + totalExitsUnits - totalEntriesUnits)
        : totalUnits + totalUnitsSold;

      const flowDescription =
        totalUnitsSold === 0 && totalExitsUnits === 0 && totalEntriesUnits === 0
          ? `${totalUnits.toLocaleString()} disponibles · 0 vendidas · 0 salidas`
          : `${initialUnits.toLocaleString()} iniciales → ${totalUnitsSold.toLocaleString()} vendidas → ${totalUnits.toLocaleString()} disponibles`;

      return {
        sales: {
          todayTotal: Number(todayTotal.toFixed(2)),
          todayCount,
          monthTotal: Number(monthTotal.toFixed(2)),
          monthCount,
          totalGenerated: Number(totalGenerated.toFixed(2)),
          totalCollected: Number(totalCollected.toFixed(2)),
          totalUnitsSold,
          pendingPaymentsCount,
          pendingPaymentsAmount: Number(pendingPaymentsAmount.toFixed(2)),
          pendingOrdersCount,
        },
        inventory: {
          totalUnits,
          totalCostValue: Number(totalCostValue.toFixed(2)),
          totalRetailValue: Number(totalRetailValue.toFixed(2)),
          totalWholesaleValue: Number(totalWholesaleValue.toFixed(2)),
          activeProductsCount,
          outOfStockCount,
          lowStockCount,
        },
        inventoryFlow: {
          currentStockUnits: totalUnits,
          totalSoldUnits: totalUnitsSold,
          totalCollectedMoney: Number(totalCollected.toFixed(2)),
          totalEntriesUnits,
          totalExitsUnits,
          totalAdjustmentsUnits,
          initialUnits,
          hasHistoricalMovements,
          flowDescription,
        },
        charts: {
          salesEvolution,
          salesByChannel,
          inventoryByCategory,
        },
        recentOrders,
        lowStockItems: lowStockItems.slice(0, 10),
        recentMovements,
      };
    } catch (err) {
      console.error("[getAdminDashboard] exception handled:", err);
      if (isSupabaseServerConfigured()) {
        return {
          sales: {
            todayTotal: 0,
            todayCount: 0,
            monthTotal: 0,
            monthCount: 0,
            totalGenerated: 0,
            totalCollected: 0,
            totalUnitsSold: 0,
            pendingPaymentsCount: 0,
            pendingPaymentsAmount: 0,
            pendingOrdersCount: 0,
          },
          inventory: {
            totalUnits: 0,
            totalCostValue: 0,
            totalRetailValue: 0,
            totalWholesaleValue: 0,
            activeProductsCount: 0,
            outOfStockCount: 0,
            lowStockCount: 0,
          },
          inventoryFlow: {
            currentStockUnits: 0,
            totalSoldUnits: 0,
            totalCollectedMoney: 0,
            totalEntriesUnits: 0,
            totalExitsUnits: 0,
            totalAdjustmentsUnits: 0,
            initialUnits: 0,
            hasHistoricalMovements: false,
            flowDescription: "0 disponibles · 0 vendidas",
          },
          charts: {
            salesEvolution: [],
            salesByChannel: [],
            inventoryByCategory: [],
          },
          recentOrders: [],
          lowStockItems: [],
          recentMovements: [],
        };
      }
      return getInMemoryDashboardMetrics();
    }
  });
