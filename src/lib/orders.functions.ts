import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import {
  deleteInMemoryOrder,
  getInMemoryBadges,
  getInMemoryOrders,
  reviewInMemoryPayment,
  updateInMemoryOrderStatus,
  recordInMemoryMovement,
} from "./demo-data";
import { toSafeUuid } from "./uuid-utils";

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

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isSupabaseServerConfigured()) {
      return getInMemoryOrders() as unknown as AdminOrder[];
    }
    const ordersResult = await context.supabase
      .from("orders")
      .select(
        "id, order_number, customer_id, status, channel, payment_method_code, subtotal, total, is_wholesale, inventory_applied, notes, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(120);

    if (ordersResult.error) {
      console.error("[listOrders] Orders query failed:", ordersResult.error.message);
      throw new Error("No se pudieron cargar los pedidos. Intenta nuevamente.");
    }

    const orders = ordersResult.data ?? [];
    if (orders.length === 0) return [];

    const orderIds = orders.map((order) => order.id);
    const customerIds = [...new Set(orders.map((order) => order.customer_id).filter(Boolean))] as string[];
    const [customersResult, itemsResult, paymentsResult] = await Promise.all([
      customerIds.length > 0
        ? context.supabase
            .from("customers")
            .select("id, first_name, last_name, whatsapp, email, address, city, state")
            .in("id", customerIds)
        : Promise.resolve({ data: [], error: null }),
      context.supabase
        .from("order_items")
        .select(
          "id, order_id, product_name, size, color, quantity, unit_price, unit_cost, subtotal, variant_id, image_url",
        )
        .in("order_id", orderIds),
      context.supabase
        .from("payments")
        .select(
          "id, order_id, status, amount, method_code, reference, proof_url, proof_uploaded_at, rejection_reason, created_at",
        )
        .in("order_id", orderIds)
        .order("created_at", { ascending: true }),
    ]);

    const relatedError = customersResult.error ?? itemsResult.error ?? paymentsResult.error;
    if (relatedError) {
      console.error("[listOrders] Related data query failed:", relatedError.message);
      throw new Error("No se pudo completar la información de los pedidos.");
    }

    const customersById = new Map((customersResult.data ?? []).map((customer) => [customer.id, customer]));
    const itemsByOrder = new Map<string, typeof itemsResult.data>();
    for (const item of itemsResult.data ?? []) {
      const current = itemsByOrder.get(item.order_id) ?? [];
      current.push(item);
      itemsByOrder.set(item.order_id, current);
    }
    const paymentsByOrder = new Map<string, typeof paymentsResult.data>();
    for (const payment of paymentsResult.data ?? []) {
      const current = paymentsByOrder.get(payment.order_id) ?? [];
      current.push(payment);
      paymentsByOrder.set(payment.order_id, current);
    }

    return orders.map((order) => ({
      ...order,
      customer: order.customer_id ? (customersById.get(order.customer_id) ?? null) : null,
      items: itemsByOrder.get(order.id) ?? [],
      payments: paymentsByOrder.get(order.id) ?? [],
    })) as unknown as AdminOrder[];
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; status: string }) => {
    if (
      ![
        "pedido_recibido",
        "pago_pendiente",
        "pago_verificado",
        "preparando_pedido",
        "empacando_pedido",
        "pedido_enviado",
        "pedido_entregado",
        "cancelado",
      ].includes(data.status)
    ) {
      throw new Error("Estado inválido");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    if (!isSupabaseServerConfigured()) {
      updateInMemoryOrderStatus(data.orderId, data.status);

      // Trigger asynchronous WhatsApp customer notification (non-blocking)
      try {
        const order = getInMemoryOrders().find((o) => o.id === data.orderId);
        if (order && order.customer?.whatsapp) {
          const { sendWhatsAppNotification } = await import("./whatsapp.server");
          const statusToEventMap: Record<string, any> = {
            preparando_pedido: "preparando_pedido",
            empacando_pedido: "empacando_pedido",
            pedido_enviado: "pedido_enviado",
            pedido_entregado: "pedido_entregado",
            pago_verificado: "payment_verified",
            cancelado: "pedido_cancelado",
          };
          const eventType = statusToEventMap[data.status];
          if (eventType) {
            let shippingCarrier: string | null = null;
            if (order.notes?.includes("TEALCA")) shippingCarrier = "TEALCA";
            else if (order.notes?.includes("MRW")) shippingCarrier = "MRW";

            sendWhatsAppNotification({
              eventType,
              recipientType: "customer",
              recipientPhone: order.customer.whatsapp,
              orderId: order.id,
              orderCode: order.order_number,
              customerName: `${order.customer.first_name} ${order.customer.last_name || ""}`.trim(),
              shippingCarrier,
            }).catch((err) =>
              console.warn("[updateOrderStatus] In-memory WhatsApp notification warning:", err),
            );
          }
        }
      } catch (notifErr) {
        console.warn("[updateOrderStatus] In-memory WhatsApp notification error:", notifErr);
      }

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
        user_id: toSafeUuid(context.userId),
        action: `Cambió el estado del pedido a ${data.status}`,
        entity: "orders",
        entity_id: data.orderId,
      });
    } catch {
      /* audit log fallback */
    }

    // Trigger asynchronous WhatsApp customer notification (non-blocking)
    try {
      const { data: orderData } = await supabaseAdmin
        .from("orders")
        .select("id, order_number, notes, customer:customers(first_name, last_name, whatsapp)")
        .eq("id", data.orderId)
        .maybeSingle();

      if (orderData) {
        const cust = orderData.customer as any;
        const customerPhone = cust?.whatsapp;
        if (customerPhone) {
          const { sendWhatsAppNotification } = await import("./whatsapp.server");
          const statusToEventMap: Record<string, any> = {
            preparando_pedido: "preparando_pedido",
            empacando_pedido: "empacando_pedido",
            pedido_enviado: "pedido_enviado",
            pedido_entregado: "pedido_entregado",
            pago_verificado: "payment_verified",
            cancelado: "pedido_cancelado",
          };
          const eventType = statusToEventMap[data.status];
          if (eventType) {
            let shippingCarrier: string | null = null;
            if (orderData.notes?.includes("TEALCA")) shippingCarrier = "TEALCA";
            else if (orderData.notes?.includes("MRW")) shippingCarrier = "MRW";

            sendWhatsAppNotification({
              eventType,
              recipientType: "customer",
              recipientPhone: customerPhone,
              orderId: orderData.id,
              orderCode: orderData.order_number,
              customerName: `${cust?.first_name || ""} ${cust?.last_name || ""}`.trim(),
              shippingCarrier,
            }).catch((err) =>
              console.warn("[updateOrderStatus] Supabase WhatsApp notification warning:", err),
            );
          }
        }
      }
    } catch (notifErr) {
      console.warn("[updateOrderStatus] Supabase WhatsApp notification error:", notifErr);
    }

    return { ok: true as const };
  });

/** Approves or rejects a payment proof. Approving verifies the payment and applies inventory once (idempotent). */
export const reviewPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { paymentId: string; approve: boolean; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    // Keep in-memory cache synchronized as well
    reviewInMemoryPayment(data.paymentId, data.approve, data.reason);

    if (!isSupabaseServerConfigured()) {
      const res = reviewInMemoryPayment(data.paymentId, data.approve, data.reason);
      return { ok: res.ok, approved: res.approved };
    }

    const { userId } = context;
    const safeUserId = toSafeUuid(userId);
    const safePaymentId = toSafeUuid(data.paymentId);

    if (!safePaymentId) {
      const res = reviewInMemoryPayment(data.paymentId, data.approve, data.reason);
      return { ok: res.ok, approved: res.approved };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .select("id, order_id, amount, method_code")
      .eq("id", safePaymentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!payment) {
      // Payment might only be in memory if testing in mixed mode
      const res = reviewInMemoryPayment(data.paymentId, data.approve, data.reason);
      return { ok: res.ok, approved: res.approved };
    }

    if (!data.approve) {
      const { error: rejectError } = await supabaseAdmin
        .from("payments")
        .update({
          status: "rechazado",
          rejection_reason: (data.reason ?? "").trim().slice(0, 300) || "Comprobante no válido",
          verified_at: new Date().toISOString(),
          verified_by: safeUserId,
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
        verified_by: safeUserId,
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
          created_by: safeUserId,
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
              created_by: safeUserId,
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
        user_id: safeUserId,
        action: `Verificó el pago de ${order.order_number}`,
        entity: "payments",
        entity_id: payment.id,
      });
    } catch {
      /* audit log */
    }

    // Trigger customer notification for payment_verified (non-blocking)
    try {
      if (order?.customer_id) {
        const { data: customerData } = await supabaseAdmin
          .from("customers")
          .select("first_name, last_name, whatsapp")
          .eq("id", order.customer_id)
          .maybeSingle();

        if (customerData?.whatsapp) {
          const { sendWhatsAppNotification } = await import("./whatsapp.server");
          sendWhatsAppNotification({
            eventType: "payment_verified",
            recipientType: "customer",
            recipientPhone: customerData.whatsapp,
            orderId: order.id,
            orderCode: order.order_number,
            customerName: `${customerData.first_name || ""} ${customerData.last_name || ""}`.trim(),
            total: Number(order.total || 0),
          }).catch((err) =>
            console.warn("[reviewPayment] Supabase WhatsApp notification warning:", err),
          );
        }
      }
    } catch (notifErr) {
      console.warn("[reviewPayment] Supabase WhatsApp notification error:", notifErr);
    }

    return { ok: true as const, approved: true as const };
  });

/** Cancels an order, setting status to cancelado and restoring stock if inventory was applied. */
export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const safeUserId = toSafeUuid(userId);

    if (!isSupabaseServerConfigured()) {
      const order = getInMemoryOrders().find((o) => o.id === data.orderId);
      if (!order) throw new Error("Orden no encontrada");
      if (order.inventory_applied) {
        for (const item of order.items ?? []) {
          if (item.variant_id) {
            recordInMemoryMovement(
              item.variant_id,
              "entrada",
              item.quantity,
              item.unit_cost,
              order.order_number,
              `Pedido cancelado: ${data.reason || "Cancelación administrativa"}`,
            );
          }
        }
        order.inventory_applied = false;
      }
      order.status = "cancelado";
      return { ok: true as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, customer_id, inventory_applied, items:order_items(variant_id, quantity, unit_cost)",
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
            created_by: safeUserId,
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
        user_id: safeUserId,
        action: `Canceló el pedido ${order.order_number}`,
        entity: "orders",
        entity_id: order.id,
      });
    } catch {
      /* audit log */
    }

    // Trigger customer notification for pedido_cancelado (non-blocking)
    try {
      if (order?.customer_id) {
        const { data: customerData } = await supabaseAdmin
          .from("customers")
          .select("first_name, last_name, whatsapp")
          .eq("id", order.customer_id)
          .maybeSingle();

        if (customerData?.whatsapp) {
          const { sendWhatsAppNotification } = await import("./whatsapp.server");
          sendWhatsAppNotification({
            eventType: "pedido_cancelado",
            recipientType: "customer",
            recipientPhone: customerData.whatsapp,
            orderId: order.id,
            orderCode: order.order_number,
            customerName: `${customerData.first_name || ""} ${customerData.last_name || ""}`.trim(),
          }).catch((err) =>
            console.warn("[cancelOrder] Supabase WhatsApp notification warning:", err),
          );
        }
      }
    } catch (notifErr) {
      console.warn("[cancelOrder] Supabase WhatsApp notification error:", notifErr);
    }

    return { ok: true as const };
  });

/** Safely deletes an order and its associated records with integrity checks. */
export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; restoreStock?: boolean }) => data)
  .handler(async ({ data, context }) => {
    if (!isSupabaseServerConfigured()) {
      const order = getInMemoryOrders().find((o) => o.id === data.orderId);
      if (order && order.inventory_applied && data.restoreStock) {
        for (const item of order.items ?? []) {
          if (item.variant_id) {
            recordInMemoryMovement(
              item.variant_id,
              "entrada",
              item.quantity,
              item.unit_cost,
              order.order_number,
              "Eliminación de orden / Reversión de stock",
            );
          }
        }
      }
      deleteInMemoryOrder(data.orderId);
      return { ok: true as const };
    }

    try {
      const { userId } = context;
      const safeUserId = toSafeUuid(userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: order, error } = await supabaseAdmin
        .from("orders")
        .select(
          "id, order_number, customer_id, inventory_applied, items:order_items(variant_id, quantity, unit_cost)",
        )
        .eq("id", data.orderId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!order) {
        deleteInMemoryOrder(data.orderId);
        return { ok: true as const };
      }

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
              created_by: safeUserId,
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
      if (delError) {
        deleteInMemoryOrder(data.orderId);
      }

      try {
        await supabaseAdmin.from("audit_log").insert({
          user_id: safeUserId,
          action: `Eliminó físicamente el pedido ${order.order_number}`,
          entity: "orders",
          entity_id: order.id,
        });
      } catch {
        /* audit log */
      }

      return { ok: true as const };
    } catch {
      deleteInMemoryOrder(data.orderId);
      return { ok: true as const };
    }
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
  .handler(async ({ context }) => {
    if (!isSupabaseServerConfigured()) {
      return getInMemoryBadges();
    }
    try {
      const [ordersRes, paymentsRes] = await Promise.all([
        context.supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .in("status", ["pedido_recibido", "pago_pendiente", "pago_subido"]),
        context.supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendiente"),
      ]);

      if (ordersRes.error || paymentsRes.error) {
        throw ordersRes.error ?? paymentsRes.error;
      }

      const pendingOrders = ordersRes.count ?? 0;
      const pendingPayments = paymentsRes.count ?? 0;

      return {
        pendingOrders,
        pendingPayments,
      };
    } catch {
      return getInMemoryBadges();
    }
  });
