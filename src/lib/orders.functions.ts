import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import {
  getInMemoryBadges,
  getInMemoryOrders,
  reviewInMemoryPayment,
  updateInMemoryOrderStatus,
} from "./demo-data";

export type AdminOrder = {
  id: string;
  order_number: string;
  status: string;
  channel: string;
  payment_method_code: string | null;
  subtotal: number;
  total: number;
  is_wholesale: boolean;
  inventory_applied: boolean;
  notes: string | null;
  created_at: string;
  customer: {
    first_name: string;
    last_name: string | null;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
  items: {
    id: string;
    product_name: string;
    size: string | null;
    color: string | null;
    quantity: number;
    unit_price: number;
    unit_cost: number;
    subtotal: number;
    variant_id: string | null;
    image_url: string | null;
  }[];
  payments: {
    id: string;
    status: string;
    amount: number;
    method_code: string | null;
    reference: string | null;
    proof_url: string | null;
    proof_uploaded_at: string | null;
    rejection_reason: string | null;
    created_at: string;
  }[];
};

const ORDER_SELECT = `
  id, order_number, status, channel, payment_method_code, subtotal, total, is_wholesale,
  inventory_applied, notes, created_at,
  customer:customers ( first_name, last_name, whatsapp, email, address, city, state ),
  items:order_items ( id, product_name, size, color, quantity, unit_price, unit_cost, subtotal, variant_id, image_url ),
  payments ( id, status, amount, method_code, reference, proof_url, proof_uploaded_at, rejection_reason, created_at )
`;

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isSupabaseServerConfigured()) {
      return getInMemoryOrders() as unknown as AdminOrder[];
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("orders")
        .select(ORDER_SELECT)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) {
        console.error("[listOrders] Error query with admin:", error.message);
        const fallback = await context.supabase
          .from("orders")
          .select(ORDER_SELECT)
          .order("created_at", { ascending: false })
          .limit(300);
        if (fallback.data && fallback.data.length > 0) {
          return fallback.data as unknown as AdminOrder[];
        }
        return getInMemoryOrders() as unknown as AdminOrder[];
      }
      return (data ?? []) as unknown as AdminOrder[];
    } catch (err: any) {
      console.error("[listOrders] Fatal catch:", err);
      return getInMemoryOrders() as unknown as AdminOrder[];
    }
  });

const ALLOWED_STATUSES = [
  "pedido_recibido",
  "pago_pendiente",
  "pago_verificado",
  "preparando_pedido",
  "empacando_pedido",
  "pedido_enviado",
  "pedido_entregado",
  "cancelado",
];

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; status: string }) => {
    if (!ALLOWED_STATUSES.includes(data.status)) throw new Error("Estado inválido");
    return data;
  })
  .handler(async ({ data, context }) => {
    if (!isSupabaseServerConfigured()) {
      updateInMemoryOrderStatus(data.orderId, data.status);
      return { ok: true as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);

    try {
      await supabaseAdmin.from("audit_log").insert({
        user_id: context.userId,
        action: `Cambió el estado del pedido a ${data.status}`,
        entity: "orders",
        entity_id: data.orderId,
      });
    } catch {
      /* audit log fallback */
    }

    return { ok: true as const };
  });

/** Approves or rejects a payment proof. Approving verifies the payment and applies inventory once (idempotent). */
export const reviewPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { paymentId: string; approve: boolean; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    if (!isSupabaseServerConfigured()) {
      const res = reviewInMemoryPayment(data.paymentId, data.approve, data.reason);
      return { ok: res.ok as const, approved: res.approved as const };
    }

    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .select("id, order_id, amount, method_code")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!payment) throw new Error("Pago no encontrado");

    if (!data.approve) {
      const { error: rejectError } = await supabaseAdmin
        .from("payments")
        .update({
          status: "rechazado",
          rejection_reason: (data.reason ?? "").trim().slice(0, 300) || "Comprobante no válido",
          verified_at: new Date().toISOString(),
          verified_by: userId,
        })
        .eq("id", payment.id);
      if (rejectError) throw new Error(rejectError.message);

      await supabaseAdmin
        .from("orders")
        .update({ status: "pago_pendiente", updated_at: new Date().toISOString() })
        .eq("id", payment.order_id);

      return { ok: true as const, approved: false as const };
    }

    // Approve payment
    const { error: approveError } = await supabaseAdmin
      .from("payments")
      .update({
        status: "verificado",
        rejection_reason: null,
        verified_at: new Date().toISOString(),
        verified_by: userId,
      })
      .eq("id", payment.id);
    if (approveError) throw new Error(approveError.message);

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, customer_id, channel, total, subtotal, inventory_applied, items:order_items(id, variant_id, product_id, product_name, size, color, quantity, unit_price, unit_cost, subtotal)",
      )
      .eq("id", payment.order_id)
      .single();
    if (orderError) throw new Error(orderError.message);

    // Idempotent inventory deduction: only deduct if not previously applied
    if (!order.inventory_applied) {
      for (const item of order.items ?? []) {
        if (!item.variant_id) continue;
        const { data: variant } = await supabaseAdmin
          .from("product_variants")
          .select("id, stock, sku, product_id, product:products(name, cost)")
          .eq("id", item.variant_id)
          .single();
        if (!variant) continue;

        const currentStock = Number(variant.stock ?? 0);
        const stockAfter = Math.max(0, currentStock - item.quantity);

        await supabaseAdmin
          .from("product_variants")
          .update({ stock: stockAfter })
          .eq("id", variant.id);

        await supabaseAdmin.from("inventory_movements").insert({
          variant_id: variant.id,
          type: "salida",
          quantity: item.quantity,
          unit_cost: Number(item.unit_cost || (variant.product as any)?.cost || 0),
          stock_after: stockAfter,
          reference: order.order_number,
          note: `Pago verificado - Pedido ${order.order_number}`,
          created_by: userId,
        });
      }

      // Record in sales table to sync sales registry if not exists
      try {
        const { data: existingSale } = await supabaseAdmin
          .from("sales")
          .select("id")
          .eq("order_id", order.id)
          .maybeSingle();

        if (!existingSale) {
          const costTotal = (order.items ?? []).reduce(
            (sum, it) => sum + Number(it.unit_cost || 0) * it.quantity,
            0,
          );

          const { data: newSale } = await supabaseAdmin
            .from("sales")
            .insert({
              sale_number: order.order_number,
              order_id: order.id,
              customer_id: order.customer_id,
              channel: order.channel || "online",
              payment_method_code: payment.method_code,
              total: Number(order.total),
              cost_total: costTotal,
              created_by: userId,
            })
            .select("id")
            .maybeSingle();

          if (newSale?.id) {
            await supabaseAdmin.from("sale_items").insert(
              (order.items ?? []).map((it) => ({
                sale_id: newSale.id,
                product_id: it.product_id,
                variant_id: it.variant_id,
                product_name: it.product_name,
                size: it.size,
                color: it.color,
                unit_price: Number(it.unit_price),
                unit_cost: Number(it.unit_cost),
                quantity: it.quantity,
                subtotal: Number(it.subtotal),
              })),
            );
          }
        }
      } catch (saleErr) {
        console.warn("[reviewPayment] sales sync warning:", saleErr);
      }

      await supabaseAdmin
        .from("orders")
        .update({
          inventory_applied: true,
          status: "pago_verificado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
    } else {
      await supabaseAdmin
        .from("orders")
        .update({ status: "pago_verificado", updated_at: new Date().toISOString() })
        .eq("id", order.id);
    }

    try {
      await supabaseAdmin.from("audit_log").insert({
        user_id: userId,
        action: `Verificó el pago de ${order.order_number}`,
        entity: "payments",
        entity_id: payment.id,
      });
    } catch {
      /* audit log */
    }

    return { ok: true as const, approved: true as const };
  });

/** Cancels an order, setting status to cancelado and restoring stock if inventory was applied. */
export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, inventory_applied, items:order_items(variant_id, quantity, unit_cost)",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Orden no encontrada");

    // If inventory was deducted, return items back to stock
    if (order.inventory_applied) {
      for (const item of order.items ?? []) {
        if (!item.variant_id) continue;
        const { data: variant } = await supabaseAdmin
          .from("product_variants")
          .select("id, stock")
          .eq("id", item.variant_id)
          .single();
        if (variant) {
          const stockAfter = Number(variant.stock ?? 0) + item.quantity;
          await supabaseAdmin
            .from("product_variants")
            .update({ stock: stockAfter })
            .eq("id", variant.id);
          await supabaseAdmin.from("inventory_movements").insert({
            variant_id: variant.id,
            type: "entrada",
            quantity: item.quantity,
            unit_cost: Number(item.unit_cost || 0),
            stock_after: stockAfter,
            reference: order.order_number,
            note: `Pedido cancelado: ${data.reason || "Cancelación administrativa"}`,
            created_by: userId,
          });
        }
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "cancelado",
        inventory_applied: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (updateError) throw new Error(updateError.message);

    try {
      await supabaseAdmin.from("audit_log").insert({
        user_id: userId,
        action: `Canceló el pedido ${order.order_number}`,
        entity: "orders",
        entity_id: order.id,
      });
    } catch {
      /* audit log */
    }

    return { ok: true as const };
  });

/** Safely deletes an order and its associated records with integrity checks. */
export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; restoreStock?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, inventory_applied, items:order_items(variant_id, quantity, unit_cost)",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Orden no encontrada");

    // Optional stock restoration if inventory had been deducted
    if (order.inventory_applied && data.restoreStock) {
      for (const item of order.items ?? []) {
        if (!item.variant_id) continue;
        const { data: variant } = await supabaseAdmin
          .from("product_variants")
          .select("id, stock")
          .eq("id", item.variant_id)
          .single();
        if (variant) {
          const stockAfter = Number(variant.stock ?? 0) + item.quantity;
          await supabaseAdmin
            .from("product_variants")
            .update({ stock: stockAfter })
            .eq("id", variant.id);
          await supabaseAdmin.from("inventory_movements").insert({
            variant_id: variant.id,
            type: "entrada",
            quantity: item.quantity,
            unit_cost: Number(item.unit_cost || 0),
            stock_after: stockAfter,
            reference: order.order_number,
            note: "Eliminación de orden con reposición de inventario",
            created_by: userId,
          });
        }
      }
    }

    // Delete dependent records cleanly in sequence
    const { data: salesForOrder } = await supabaseAdmin
      .from("sales")
      .select("id")
      .eq("order_id", order.id);
    const saleIds = salesForOrder?.map((s) => s.id) ?? [];
    if (saleIds.length > 0) {
      await supabaseAdmin.from("sale_items").delete().in("sale_id", saleIds);
    }
    await supabaseAdmin.from("sales").delete().eq("order_id", order.id);
    await supabaseAdmin.from("payments").delete().eq("order_id", order.id);
    await supabaseAdmin.from("order_items").delete().eq("order_id", order.id);
    const { error: delError } = await supabaseAdmin.from("orders").delete().eq("id", order.id);
    if (delError) throw new Error(`Error al eliminar pedido: ${delError.message}`);

    try {
      await supabaseAdmin.from("audit_log").insert({
        user_id: userId,
        action: `Eliminó físicamente el pedido ${order.order_number}`,
        entity: "orders",
        entity_id: order.id,
      });
    } catch {
      /* audit log */
    }

    return { ok: true as const };
  });

/** Returns a short-lived signed URL for a payment proof stored in the private bucket. */
export const getProofUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { path: string }) => data)
  .handler(async ({ data }) => {
    if (
      data.path.startsWith("http://") ||
      data.path.startsWith("https://") ||
      data.path.startsWith("data:")
    ) {
      return { url: data.path };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from("comprobantes")
        .createSignedUrl(data.path, 3600);
      if (signError || !signed?.signedUrl) {
        return { url: data.path };
      }
      return { url: signed.signedUrl };
    } catch {
      return { url: data.path };
    }
  });

export const getPendingAdminBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    if (!isSupabaseServerConfigured()) {
      return getInMemoryBadges();
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const [ordersRes, paymentsRes] = await Promise.all([
        supabaseAdmin
          .from("orders")
          .select("id, status")
          .in("status", ["pedido_recibido", "pago_pendiente", "pago_subido"]),
        supabaseAdmin.from("payments").select("id, status").eq("status", "pendiente"),
      ]);

      const pendingOrders = ordersRes.data?.length ?? 0;
      const pendingPayments = paymentsRes.data?.length ?? 0;

      return {
        pendingOrders,
        pendingPayments,
      };
    } catch {
      return getInMemoryBadges();
    }
  });
