import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toSafeUuid } from "./uuid-utils";

export type SaleItemInput = {
  product_id?: string | null;
  variant_id: string;
  product_name: string;
  size?: string | null;
  color?: string | null;
  unit_price: number;
  unit_cost: number;
  quantity: number;
};

export type CreateSaleInput = {
  customer_id?: string | null;
  customer_name?: string | null;
  payment_method_code: string;
  channel?: string;
  items: SaleItemInput[];
};

export type AdminSale = {
  id: string;
  sale_number: string;
  customer_id: string | null;
  channel: string;
  payment_method_code: string | null;
  total: number;
  cost_total: number;
  created_at: string;
  customer: {
    first_name: string;
    last_name: string | null;
    whatsapp: string | null;
  } | null;
  items: {
    id: string;
    product_name: string;
    size: string | null;
    color: string | null;
    unit_price: number;
    unit_cost: number;
    quantity: number;
    subtotal: number;
  }[];
};

export const listSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { data, error } = await context.supabase
        .from("sales")
        .select(
          `
          id, sale_number, customer_id, channel, payment_method_code, total, cost_total, created_at,
          customer:customers ( first_name, last_name, whatsapp ),
          items:sale_items ( id, product_name, size, color, unit_price, unit_cost, quantity, subtotal )
        `,
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as AdminSale[];
    } catch {
      return [] as AdminSale[];
    }
  });

export const createSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CreateSaleInput) => {
    if (!Array.isArray(d.items) || d.items.length === 0) {
      throw new Error("Agrega al menos un producto a la venta");
    }
    if (!d.payment_method_code) {
      throw new Error("Selecciona un método de pago");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const safeUserId = toSafeUuid(userId);

    let customerId = data.customer_id || null;
    if (!customerId && data.customer_name?.trim()) {
      const { data: newCust, error: custErr } = await supabase
        .from("customers")
        .insert({
          first_name: data.customer_name.trim(),
          notes: "Creado desde POS presencial",
        })
        .select("id")
        .single();
      if (!custErr && newCust) {
        customerId = newCust.id;
      }
    }

    const total = data.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const costTotal = data.items.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0);

    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({
        customer_id: customerId,
        channel: data.channel || "presencial",
        payment_method_code: data.payment_method_code,
        total,
        cost_total: costTotal,
        created_by: safeUserId,
      })
      .select("id, sale_number")
      .single();
    if (saleErr) throw new Error(saleErr.message);

    const saleItems = data.items.map((i) => ({
      sale_id: sale.id,
      product_id: i.product_id || null,
      variant_id: i.variant_id || null,
      product_name: i.product_name,
      size: i.size || null,
      color: i.color || null,
      unit_price: i.unit_price,
      unit_cost: i.unit_cost,
      quantity: i.quantity,
      subtotal: Number((i.unit_price * i.quantity).toFixed(2)),
    }));

    const { error: itemsErr } = await supabase.from("sale_items").insert(saleItems);
    if (itemsErr) throw new Error(itemsErr.message);

    // Stock deduction & inventory movements
    for (const item of data.items) {
      if (!item.variant_id) continue;
      const { data: variant } = await supabase
        .from("product_variants")
        .select("id, stock")
        .eq("id", item.variant_id)
        .single();

      if (variant) {
        const stockAfter = Math.max(0, variant.stock - item.quantity);
        await supabase.from("product_variants").update({ stock: stockAfter }).eq("id", variant.id);

        await supabase.from("inventory_movements").insert({
          variant_id: variant.id,
          type: "salida",
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          stock_after: stockAfter,
          reference: sale.sale_number,
          note: "Venta presencial / POS",
          created_by: safeUserId,
        });
      }
    }

    return { id: sale.id, sale_number: sale.sale_number, total };
  });

/** Safely deletes a POS sale and can optionally restore stock. */
export const deleteSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { saleId: string; restoreStock?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const safeUserId = toSafeUuid(userId);

    const { data: sale, error } = await supabase
      .from("sales")
      .select("id, sale_number, items:sale_items(variant_id, quantity, unit_cost)")
      .eq("id", data.saleId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sale) throw new Error("Venta no encontrada");

    // Optional stock restoration
    if (data.restoreStock) {
      for (const item of sale.items ?? []) {
        if (!item.variant_id) continue;
        const { data: variant } = await supabase
          .from("product_variants")
          .select("id, stock")
          .eq("id", item.variant_id)
          .single();
        if (variant) {
          const stockAfter = variant.stock + item.quantity;
          await supabase
            .from("product_variants")
            .update({ stock: stockAfter })
            .eq("id", variant.id);
          await supabase.from("inventory_movements").insert({
            variant_id: variant.id,
            type: "entrada",
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            stock_after: stockAfter,
            reference: sale.sale_number,
            note: "Eliminación de venta presencial / Reversión de stock",
            created_by: safeUserId,
          });
        }
      }
    }

    // Delete sale items then sale record
    await supabase.from("sale_items").delete().eq("sale_id", sale.id);
    const { error: delErr } = await supabase.from("sales").delete().eq("id", sale.id);
    if (delErr) throw new Error(delErr.message);

    await supabase.from("audit_log").insert({
      user_id: safeUserId,
      action: `Eliminó la venta ${sale.sale_number}`,
      entity: "sales",
      entity_id: sale.id,
    });

    return { ok: true as const };
  });
