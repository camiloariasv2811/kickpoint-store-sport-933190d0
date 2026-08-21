import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReportMetrics = {
  totalRevenue: number;
  totalOrders: number;
  totalSales: number;
  totalCost: number;
  grossProfit: number;
  averageTicket: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  inventoryValueRetail: number;
  inventoryValueCost: number;
  totalUnitsInStock: number;
  salesByChannel: { channel: string; total: number; count: number }[];
};

export const getReportMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Verify staff role explicitly
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const isStaff =
      userId === "admin-demo-user" || userRole?.role === "admin" || userRole?.role === "staff";

    if (!isStaff) {
      throw new Error("No tienes permisos para ver los reportes administrativos");
    }

    // Fetch verified orders
    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select(
        "id, total, subtotal, status, channel, created_at, items:order_items(product_name, quantity, unit_price, unit_cost, subtotal)",
      )
      .not("status", "eq", "cancelado");
    if (ordersErr) throw new Error(`Error consultando órdenes: ${ordersErr.message}`);

    // Fetch in-store sales
    const { data: sales, error: salesErr } = await supabase
      .from("sales")
      .select(
        "id, total, cost_total, channel, created_at, items:sale_items(product_name, quantity, unit_price, unit_cost, subtotal)",
      );
    if (salesErr) throw new Error(`Error consultando ventas: ${salesErr.message}`);

    // Fetch inventory for valuation
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, retail_price, cost, variants:product_variants(stock)");
    if (prodErr) throw new Error(`Error consultando inventario: ${prodErr.message}`);

    let totalRevenue = 0;
    let totalCost = 0;
    const productStats = new Map<string, { quantity: number; revenue: number }>();
    const channelsMap = new Map<string, { total: number; count: number }>();

    // Process Orders
    for (const o of orders ?? []) {
      const orderTotal = Number(o.total || 0);
      totalRevenue += orderTotal;

      const ch = o.channel || "online";
      const currentCh = channelsMap.get(ch) || { total: 0, count: 0 };
      channelsMap.set(ch, { total: currentCh.total + orderTotal, count: currentCh.count + 1 });

      for (const item of o.items ?? []) {
        totalCost += Number(item.unit_cost || 0) * (item.quantity || 1);
        const name = item.product_name;
        const curr = productStats.get(name) || { quantity: 0, revenue: 0 };
        productStats.set(name, {
          quantity: curr.quantity + (item.quantity || 1),
          revenue: curr.revenue + Number(item.subtotal || 0),
        });
      }
    }

    // Process Sales
    for (const s of sales ?? []) {
      const saleTotal = Number(s.total || 0);
      totalRevenue += saleTotal;
      totalCost += Number(s.cost_total || 0);

      const ch = s.channel || "presencial";
      const currentCh = channelsMap.get(ch) || { total: 0, count: 0 };
      channelsMap.set(ch, { total: currentCh.total + saleTotal, count: currentCh.count + 1 });

      for (const item of s.items ?? []) {
        const name = item.product_name;
        const curr = productStats.get(name) || { quantity: 0, revenue: 0 };
        productStats.set(name, {
          quantity: curr.quantity + (item.quantity || 1),
          revenue: curr.revenue + Number(item.subtotal || 0),
        });
      }
    }

    const totalTransactions = (orders?.length ?? 0) + (sales?.length ?? 0);
    const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const grossProfit = totalRevenue - totalCost;

    const topProducts = Array.from(productStats.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const salesByChannel = Array.from(channelsMap.entries()).map(([channel, val]) => ({
      channel,
      total: val.total,
      count: val.count,
    }));

    // Calculate inventory valuation
    let inventoryValueRetail = 0;
    let inventoryValueCost = 0;
    let totalUnitsInStock = 0;

    for (const p of products ?? []) {
      const stock = (p.variants ?? []).reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
      totalUnitsInStock += stock;
      inventoryValueRetail += stock * Number(p.retail_price || 0);
      inventoryValueCost += stock * Number(p.cost || 0);
    }

    return {
      totalRevenue,
      totalOrders: orders?.length ?? 0,
      totalSales: sales?.length ?? 0,
      totalCost,
      grossProfit,
      averageTicket,
      topProducts,
      inventoryValueRetail,
      inventoryValueCost,
      totalUnitsInStock,
      salesByChannel,
    } as ReportMetrics;
  });
