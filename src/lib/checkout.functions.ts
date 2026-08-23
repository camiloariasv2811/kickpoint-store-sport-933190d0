import { createServerFn } from "@tanstack/react-start";

import { createPublicClient, isSupabasePublicConfigured } from "./supabase-public.server";
import { isSupabaseServerConfigured } from "@/integrations/supabase/client.server";
import {
  addInMemoryOrder,
  getInMemoryOrderByNumber,
  getInMemoryProducts,
  uploadInMemoryProof,
  type InMemoryOrder,
} from "./demo-data";

export type PaymentMethod = {
  code: string;
  name: string;
  instructions: string | null;
  details: Record<string, string>;
};

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  {
    code: "pago_movil",
    name: "Pago Móvil (Bancos Nacionales)",
    instructions:
      "Realiza el pago móvil a nuestra cuenta oficial KICKPOINT y sube tu comprobante o referencia.",
    details: {
      banco: "0102 - Banco de Venezuela",
      telefono: "0412-1546698",
      cedula: "V-28.123.456",
    },
  },
  {
    code: "zelle",
    name: "Zelle (USD)",
    instructions:
      "Envía tu pago vía Zelle a pagos@kickpoint.store. En el memo, pon tu nombre y número de orden.",
    details: {
      email: "pagos@kickpoint.store",
      titular: "KICKPOINT STORE LLC",
    },
  },
  {
    code: "binance_pay",
    name: "Binance Pay / USDT",
    instructions: "Transfiere por Pay ID de Binance a nuestra cuenta verificada sin comisiones.",
    details: {
      pay_id: "892347102",
      moneda: "USDT",
    },
  },
  {
    code: "transferencia",
    name: "Transferencia Bancaria Banesco / Mercantil",
    instructions: "Transferencia directa a cuenta corriente empresarial.",
    details: {
      banco: "Banesco Banco Universal",
      cuenta: "0134-0000-00-0000000000",
      titular: "KICKPOINT C.A.",
      rif: "J-50123456-7",
    },
  },
];

export const listPaymentMethods = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabasePublicConfigured()) {
    return DEFAULT_PAYMENT_METHODS;
  }
  try {
    // SECURITY: `details` holds bank/wallet account PII and is not readable by the
    // anon/authenticated API roles. It is only read here, server-side, so the payment
    // instructions can be rendered for the checkout step.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("payment_methods")
      .select("code, name, instructions, details")
      .eq("active", true)
      .order("sort_order");
    if (error || !data || data.length === 0) {
      return DEFAULT_PAYMENT_METHODS;
    }
    return data as unknown as PaymentMethod[];
  } catch {
    return DEFAULT_PAYMENT_METHODS;
  }
});


export type CheckoutInput = {
  customer: {
    firstName: string;
    lastName: string;
    whatsapp: string;
    email: string;
    address: string;
    city: string;
    state: string;
    notes: string;
  };
  shippingMethod: "TEALCA" | "MRW";
  paymentMethod: string;
  rateType?: "BCV" | "USDT";
  exchangeRateUsed?: number;
  lines: { variantId: string; quantity: number }[];
  paymentProof?: {
    reference?: string;
    fileName: string;
    contentType: string;
    dataBase64: string;
  };
};

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: CheckoutInput) => {
    if (!data?.customer?.firstName?.trim()) throw new Error("Falta el nombre");
    if (!data.customer.whatsapp?.trim()) throw new Error("Falta el WhatsApp");
    if (!data.customer.city?.trim() || !data.customer.address?.trim())
      throw new Error("Falta la dirección de entrega o agencia de envío");
    if (!data.shippingMethod || !["TEALCA", "MRW"].includes(data.shippingMethod))
      throw new Error("Selecciona una empresa de envío (TEALCA o MRW)");
    if (!Array.isArray(data.lines) || data.lines.length === 0) throw new Error("Carrito vacío");
    if (data.lines.length > 60) throw new Error("Demasiados productos");
    if (!data.paymentMethod) throw new Error("Selecciona un método de pago");
    if (data.paymentProof) {
      if (!data.paymentProof.dataBase64) throw new Error("Falta el comprobante de pago");
      if (data.paymentProof.dataBase64.length > 8_000_000) {
        throw new Error("La imagen del comprobante supera 5 MB");
      }
      if (
        !/^image\/(png|jpe?g|webp)$/.test(data.paymentProof.contentType) &&
        data.paymentProof.contentType !== "application/pdf"
      ) {
        throw new Error("Formato de comprobante no permitido (usa JPG, PNG, WEBP o PDF)");
      }
    }
    return data;
  })
  .handler(async ({ data }) => {
    const totalOrderUnits = data.lines.reduce(
      (sum, l) => sum + Math.max(1, Math.floor(l.quantity)),
      0,
    );

    const usdtRate = Number(data.exchangeRateUsed || 86.2);

    if (!isSupabaseServerConfigured()) {
      // In-memory demo flow
      const products = getInMemoryProducts();
      const items = data.lines.map((line) => {
        let foundVariant: any = null;
        let foundProduct: any = null;

        for (const p of products) {
          const v = p.variants?.find((va) => va.id === line.variantId);
          if (v) {
            foundVariant = v;
            foundProduct = p;
            break;
          }
        }

        if (!foundVariant || !foundProduct || !foundVariant.active || !foundProduct.active) {
          throw new Error("Un producto de tu carrito ya no está disponible");
        }

        const quantity = Math.max(1, Math.floor(line.quantity));
        if (quantity > (foundVariant.stock ?? 0)) {
          throw new Error(
            `Stock insuficiente para ${foundProduct.name} talla ${foundVariant.size}`,
          );
        }

        const wholesale = foundProduct.wholesale_price;
        const minQty = foundProduct.wholesale_min_qty || 6;
        const isItemWholesale = Boolean(wholesale && totalOrderUnits >= minQty);
        const unit = isItemWholesale ? Number(wholesale) : Number(foundProduct.retail_price);

        return {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          variant_id: foundVariant.id,
          product_id: foundProduct.id,
          product_name: foundProduct.name,
          image_url: foundProduct.images?.[0] ?? null,
          size: foundVariant.size,
          color: foundVariant.color,
          unit_price: unit,
          unit_cost: Number(foundProduct.retail_price ? foundProduct.retail_price * 0.6 : 14),
          quantity,
          subtotal: Number((unit * quantity).toFixed(2)),
          isWholesale: isItemWholesale,
        };
      });

      const subtotal = Number(items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2));
      const totalBs = Number((subtotal * usdtRate).toFixed(2));

      const formattedNotes = [
        `[Envío: ${data.shippingMethod}]`,
        `[Cotización: Tasa USDT a Bs. ${usdtRate.toFixed(2)} / USD | Total Bs. ${totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}]`,
        data.customer.notes?.trim() ? `Nota cliente: ${data.customer.notes.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      const orderNumber = `KP-2026-${randomDigits}`;
      const simulatedProofUrl = data.paymentProof
        ? `https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&proof=${Date.now()}`
        : null;

      const newOrder: InMemoryOrder = {
        id: `ord-${Date.now()}`,
        order_number: orderNumber,
        status: data.paymentProof ? "pago_pendiente" : "pedido_recibido",
        channel: "online",
        payment_method_code: data.paymentMethod,
        subtotal,
        total: subtotal,
        is_wholesale: items.some((i) => i.isWholesale),
        inventory_applied: false,
        notes: formattedNotes,
        created_at: new Date().toISOString(),
        customer: {
          first_name: data.customer.firstName.trim().slice(0, 80),
          last_name: data.customer.lastName.trim().slice(0, 80) || null,
          whatsapp: data.customer.whatsapp.trim().slice(0, 40),
          email: data.customer.email.trim().slice(0, 120) || null,
          address: `${data.shippingMethod} - ${data.customer.address.trim().slice(0, 250)}`,
          city: data.customer.city.trim().slice(0, 80),
          state: data.customer.state.trim().slice(0, 80) || null,
        },
        items: items.map(({ isWholesale: _, ...it }) => it),
        payments: [
          {
            id: `pay-${Date.now()}`,
            status: "pendiente",
            amount: subtotal,
            method_code: data.paymentMethod,
            reference: data.paymentProof?.reference?.trim() || null,
            proof_url: simulatedProofUrl,
            proof_uploaded_at: data.paymentProof ? new Date().toISOString() : null,
            rejection_reason: null,
            created_at: new Date().toISOString(),
          },
        ],
      };

      addInMemoryOrder(newOrder);

      // Trigger asynchronous WhatsApp notification to Admin (non-blocking)
      try {
        const { sendWhatsAppNotification, getAdminWhatsAppNumber } =
          await import("./whatsapp.server");
        sendWhatsAppNotification({
          eventType: "order_created",
          recipientType: "admin",
          recipientPhone: getAdminWhatsAppNumber(),
          orderId: newOrder.id,
          orderCode: newOrder.order_number,
          customerName:
            `${newOrder.customer?.first_name} ${newOrder.customer?.last_name || ""}`.trim(),
          total: newOrder.total,
          paymentMethod: data.paymentMethod,
        }).catch((err) => console.warn("[Checkout] WhatsApp admin notification warning:", err));
      } catch (notifErr) {
        console.warn("[Checkout] Failed to trigger WhatsApp admin notification:", notifErr);
      }

      // Trigger Email notification to Admin (non-blocking for checkout error handling)
      try {
        const { sendEmailNotification, getAdminEmail } = await import("./email.server");
        await sendEmailNotification({
          eventType: "order_created",
          recipientType: "admin",
          recipientEmail: getAdminEmail(),
          orderId: newOrder.id,
          orderCode: newOrder.order_number,
          customerName:
            `${newOrder.customer?.first_name} ${newOrder.customer?.last_name || ""}`.trim(),
          customerPhone: newOrder.customer?.whatsapp || null,
          customerEmail: newOrder.customer?.email || data.customer.email || null,
          total: newOrder.total,
          paymentMethod: data.paymentMethod,
          paymentReference: data.paymentProof?.reference?.trim() || null,
          metadata: {
            idempotencyKey: `new-order-admin-${newOrder.id || newOrder.order_number}`,
          },
        });
      } catch (emailErr) {
        console.warn("[Checkout] Failed to trigger Email admin notification:", emailErr);
      }

      return { orderNumber: newOrder.order_number, total: newOrder.total };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ids = [...new Set(data.lines.map((l) => l.variantId))];
    const { data: variants, error: variantError } = await supabaseAdmin
      .from("product_variants")
      .select(
        "id, size, color, stock, active, product:products(id, name, images, retail_price, wholesale_price, wholesale_min_qty, cost, active)",
      )
      .in("id", ids);
    if (variantError) throw new Error(variantError.message);

    const items = data.lines.map((line) => {
      const variant = (variants ?? []).find((v) => v.id === line.variantId) as
        | {
            id: string;
            size: string;
            color: string | null;
            stock: number;
            active: boolean;
            product: {
              id: string;
              name: string;
              images: string[];
              retail_price: number;
              wholesale_price: number | null;
              wholesale_min_qty: number;
              cost: number;
              active: boolean;
            } | null;
          }
        | undefined;
      if (!variant || !variant.product || !variant.active || !variant.product.active)
        throw new Error("Un producto de tu carrito ya no está disponible");

      const quantity = Math.max(1, Math.floor(line.quantity));
      if (quantity > variant.stock)
        throw new Error(`Stock insuficiente para ${variant.product.name} talla ${variant.size}`);

      const wholesale = variant.product.wholesale_price;
      const minQty = variant.product.wholesale_min_qty || 6;
      const isItemWholesale = Boolean(wholesale && totalOrderUnits >= minQty);
      const unit = isItemWholesale ? Number(wholesale) : Number(variant.product.retail_price);

      return {
        variant_id: variant.id,
        product_id: variant.product.id,
        product_name: variant.product.name,
        image_url: variant.product.images?.[0] ?? null,
        size: variant.size,
        color: variant.color,
        unit_price: unit,
        unit_cost: Number(variant.product.cost ?? 0),
        quantity,
        subtotal: Number((unit * quantity).toFixed(2)),
        isWholesale: isItemWholesale,
      };
    });

    const subtotal = Number(items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2));

    // Consult configured store settings for authoritative USDT rate
    let effectiveUsdtRate = usdtRate;
    try {
      const { data: st } = await supabaseAdmin
        .from("settings")
        .select("value")
        .eq("key", "exchange_rate_usdt")
        .maybeSingle();
      const rawRate =
        st?.value && typeof st.value === "object"
          ? (st.value as Record<string, unknown>)["rate"]
          : st?.value;
      if (rawRate && Number(rawRate) > 0) {
        effectiveUsdtRate = Number(rawRate);
      }
    } catch {
      /* fallback */
    }

    const totalBs = Number((subtotal * effectiveUsdtRate).toFixed(2));

    const formattedNotes = [
      `[Envío: ${data.shippingMethod}]`,
      `[Cotización: Tasa USDT a Bs. ${effectiveUsdtRate.toFixed(2)} / USD | Total Bs. ${totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}]`,
      data.customer.notes?.trim() ? `Nota cliente: ${data.customer.notes.trim()}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .insert({
        first_name: data.customer.firstName.trim().slice(0, 80),
        last_name: data.customer.lastName.trim().slice(0, 80) || null,
        whatsapp: data.customer.whatsapp.trim().slice(0, 40),
        phone: data.customer.whatsapp.trim().slice(0, 40),
        email: data.customer.email.trim().slice(0, 120) || null,
        address: `${data.shippingMethod} - ${data.customer.address.trim().slice(0, 250)}`,
        city: data.customer.city.trim().slice(0, 80),
        state: data.customer.state.trim().slice(0, 80) || null,
        notes: formattedNotes.slice(0, 500),
      })
      .select("id")
      .single();
    if (customerError) throw new Error(customerError.message);

    const initialStatus = data.paymentProof ? "pago_pendiente" : "pedido_recibido";

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_id: customer.id,
        status: initialStatus,
        channel: "online",
        payment_method_code: data.paymentMethod,
        subtotal,
        total: subtotal,
        is_wholesale: items.some((i) => i.isWholesale),
        notes: formattedNotes.slice(0, 500),
      })
      .select("id, order_number, total")
      .single();
    if (orderError) throw new Error(orderError.message);

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(
      items.map(({ isWholesale: _isWholesale, ...item }) => ({
        ...item,
        order_id: order.id,
      })),
    );
    if (itemsError) throw new Error(itemsError.message);

    let proofStoragePath: string | null = null;
    if (data.paymentProof) {
      const bytes = Buffer.from(data.paymentProof.dataBase64, "base64");
      const ext =
        data.paymentProof.contentType === "application/pdf"
          ? "pdf"
          : data.paymentProof.contentType.split("/")[1] || "jpg";
      proofStoragePath = `${order.order_number}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("comprobantes")
        .upload(proofStoragePath, bytes, {
          contentType: data.paymentProof.contentType,
          upsert: false,
        });

      if (uploadError) {
        // Rollback created order if proof upload fails
        await supabaseAdmin.from("orders").delete().eq("id", order.id);
        throw new Error(`Error al almacenar el comprobante de pago: ${uploadError.message}`);
      }
    }

    const { error: paymentError } = await supabaseAdmin.from("payments").insert({
      order_id: order.id,
      method_code: data.paymentMethod,
      amount: subtotal,
      status: "pendiente",
      reference: data.paymentProof?.reference?.trim().slice(0, 120) || null,
      proof_url: proofStoragePath,
      proof_uploaded_at: proofStoragePath ? new Date().toISOString() : null,
    });
    if (paymentError) throw new Error(paymentError.message);

    // Trigger asynchronous WhatsApp notification to Admin (non-blocking)
    try {
      const { sendWhatsAppNotification, getAdminWhatsAppNumber } =
        await import("./whatsapp.server");
      sendWhatsAppNotification({
        eventType: "order_created",
        recipientType: "admin",
        recipientPhone: getAdminWhatsAppNumber(),
        orderId: order.id,
        orderCode: order.order_number,
        customerName:
          `${data.customer.firstName.trim()} ${data.customer.lastName?.trim() || ""}`.trim(),
        total: Number(order.total),
        paymentMethod: data.paymentMethod,
      }).catch((err) =>
        console.warn("[Checkout] Supabase WhatsApp admin notification warning:", err),
      );
    } catch (notifErr) {
      console.warn("[Checkout] Failed to trigger WhatsApp admin notification:", notifErr);
    }

    // Trigger Email notification to Admin (non-blocking for checkout error handling)
    try {
      const { sendEmailNotification, getAdminEmail } = await import("./email.server");
      await sendEmailNotification({
        eventType: "order_created",
        recipientType: "admin",
        recipientEmail: getAdminEmail(),
        orderId: order.id,
        orderCode: order.order_number,
        customerName:
          `${data.customer.firstName.trim()} ${data.customer.lastName?.trim() || ""}`.trim(),
        customerPhone: data.customer.whatsapp || null,
        customerEmail: data.customer.email || null,
        total: Number(order.total),
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentProof?.reference?.trim() || null,
        metadata: {
          idempotencyKey: `new-order-admin-${order.id || order.order_number}`,
        },
      });
    } catch (emailErr) {
      console.warn("[Checkout] Failed to trigger Email admin notification:", emailErr);
    }

    return { orderNumber: order.order_number, total: Number(order.total) };
  });

export type PublicOrder = {
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  payment_method_code: string | null;
  payment_status: string | null;
  proof_uploaded: boolean;
  rejection_reason: string | null;
  notes: string | null;
  items: {
    product_name: string;
    size: string | null;
    color: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
    image_url: string | null;
  }[];
};

export const getOrderByNumber = createServerFn({ method: "GET" })
  .inputValidator((data: { orderNumber: string }) => ({
    orderNumber: String(data?.orderNumber ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 24),
  }))
  .handler(async ({ data }) => {
    if (!/^KP-\d{4}-\d{6}$/.test(data.orderNumber)) return null;

    if (!isSupabaseServerConfigured()) {
      const inMem = getInMemoryOrderByNumber(data.orderNumber);
      if (!inMem) return null;
      const payment = inMem.payments[inMem.payments.length - 1];

      return {
        order_number: inMem.order_number,
        status: inMem.status,
        total: Number(inMem.total),
        created_at: inMem.created_at,
        payment_method_code: inMem.payment_method_code,
        payment_status: payment?.status ?? null,
        proof_uploaded: Boolean(payment?.proof_url),
        rejection_reason: payment?.rejection_reason ?? null,
        notes: inMem.notes ?? null,
        items: inMem.items.map((i) => ({
          product_name: i.product_name,
          size: i.size,
          color: i.color,
          quantity: i.quantity,
          unit_price: Number(i.unit_price),
          subtotal: Number(i.subtotal),
          image_url: i.image_url,
        })),
      } satisfies PublicOrder;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, status, total, notes, created_at, payment_method_code, items:order_items(product_name, size, color, quantity, unit_price, subtotal, image_url), payments(status, proof_url, rejection_reason, created_at)",
      )
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return null;

    const payments = (order.payments ?? []) as {
      status: string;
      proof_url: string | null;
      rejection_reason: string | null;
    }[];
    const payment = payments[payments.length - 1];

    return {
      order_number: order.order_number,
      status: order.status,
      total: Number(order.total),
      created_at: order.created_at,
      payment_method_code: order.payment_method_code,
      payment_status: payment?.status ?? null,
      proof_uploaded: Boolean(payment?.proof_url),
      rejection_reason: payment?.rejection_reason ?? null,
      notes: order.notes ?? null,
      items: (order.items ?? []).map((i) => ({
        product_name: i.product_name,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        subtotal: Number(i.subtotal),
        image_url: i.image_url,
      })),
    } satisfies PublicOrder;
  });

export const uploadPaymentProof = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      orderNumber: string;
      reference: string;
      fileName: string;
      contentType: string;
      dataBase64: string;
    }) => {
      if (!/^KP-\d{4}-\d{6}$/.test(String(data?.orderNumber ?? "").toUpperCase()))
        throw new Error("Número de pedido inválido");
      if (!data.dataBase64) throw new Error("Falta el comprobante");
      if (data.dataBase64.length > 8_000_000) throw new Error("La imagen supera 5 MB");
      if (
        !/^image\/(png|jpe?g|webp)$/.test(data.contentType) &&
        data.contentType !== "application/pdf"
      )
        throw new Error("Formato no permitido (usa JPG, PNG, WEBP o PDF)");
      return { ...data, orderNumber: data.orderNumber.toUpperCase() };
    },
  )
  .handler(async ({ data }) => {
    if (!isSupabaseServerConfigured()) {
      const simulatedUrl = `https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&proof=${Date.now()}`;
      const success = uploadInMemoryProof(data.orderNumber, data.reference, simulatedUrl);
      if (!success) throw new Error("No encontramos ese número de pedido");
      return { ok: true as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, payments(id, status)")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("No encontramos ese número de pedido");

    const bytes = Buffer.from(data.dataBase64, "base64");
    const ext = data.contentType === "application/pdf" ? "pdf" : data.contentType.split("/")[1];
    const path = `${order.order_number}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("comprobantes")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const payments = (order.payments ?? []) as { id: string; status: string }[];
    const pending = payments.find((p) => p.status !== "verificado") ?? payments[0];

    if (pending) {
      const { error: updateError } = await supabaseAdmin
        .from("payments")
        .update({
          proof_url: path,
          proof_uploaded_at: new Date().toISOString(),
          reference: data.reference.trim().slice(0, 120) || null,
          status: "pendiente",
          rejection_reason: null,
        })
        .eq("id", pending.id);
      if (updateError) throw new Error(updateError.message);
    }

    await supabaseAdmin
      .from("orders")
      .update({ status: "pago_pendiente" })
      .eq("id", order.id)
      .eq("status", "pedido_recibido");

    return { ok: true as const };
  });
