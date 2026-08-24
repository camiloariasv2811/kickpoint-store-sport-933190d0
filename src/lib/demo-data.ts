import type { Brand, Category, Product } from "./types";

export const DEMO_BRANDS: Brand[] = [
  { id: "b1", name: "Nike", slug: "nike" },
  { id: "b2", name: "Adidas", slug: "adidas" },
  { id: "b3", name: "Puma", slug: "puma" },
  { id: "b4", name: "Alo Yoga", slug: "alo" },
  { id: "b5", name: "On Running", slug: "on" },
  { id: "b6", name: "Jordan", slug: "jordan" },
];

export const DEMO_CATEGORIES: Category[] = [
  {
    id: "c1",
    name: "Camisetas de Fútbol",
    slug: "futbol",
    parent_id: null,
    image_url: null,
    sort_order: 1,
  },
  {
    id: "c2",
    name: "Ropa de Gym & Training",
    slug: "gym",
    parent_id: null,
    image_url: null,
    sort_order: 2,
  },
  {
    id: "c3",
    name: "Alo Yoga Collection",
    slug: "alo",
    parent_id: null,
    image_url: null,
    sort_order: 3,
  },
  {
    id: "c4",
    name: "On Running Performance",
    slug: "on",
    parent_id: null,
    image_url: null,
    sort_order: 4,
  },
  {
    id: "c5",
    name: "Shorts & Licras",
    slug: "shorts",
    parent_id: null,
    image_url: null,
    sort_order: 5,
  },
  {
    id: "c6",
    name: "Calzado Deportivo",
    slug: "calzado",
    parent_id: null,
    image_url: null,
    sort_order: 6,
  },
];

export const DEMO_PRODUCTS: Product[] = [
  {
    id: "p-rm-2026",
    name: "Camiseta Real Madrid Local 2025/2026 Versión Jugador",
    slug: "camiseta-real-madrid-local-2025-2026",
    description:
      "Camiseta oficial Real Madrid temporada 2025/2026. Confeccionada con tecnología Heat.Rdy de máxima transpirabilidad, detalles dorados y escudo termosellado.",
    base_sku: "KP-RMA-01",
    retail_price: 35.0,
    wholesale_price: 24.0,
    wholesale_min_qty: 6,
    images: [
      "/__l5e/assets-v1/fb5cafd4-50ef-4ab9-b830-5e5bf6619dad/p-jersey-1.jpg",
      "/__l5e/assets-v1/a4816654-219d-4720-bc40-10928e4693a1/p-jersey-2.jpg",
    ],
    is_featured: true,
    is_bestseller: true,
    is_new: true,
    is_offer: false,
    active: true,
    low_stock_threshold: 4,
    created_at: "2026-08-15T12:00:00Z",
    brand: { id: "b2", name: "Adidas", slug: "adidas" },
    category: { id: "c1", name: "Camisetas de Fútbol", slug: "futbol" },
    variants: [
      {
        id: "v-rm-s",
        product_id: "p-rm-2026",
        size: "S",
        color: "Blanco",
        sku: "KP-RMA-01-S",
        stock: 12,
        active: true,
      },
      {
        id: "v-rm-m",
        product_id: "p-rm-2026",
        size: "M",
        color: "Blanco",
        sku: "KP-RMA-01-M",
        stock: 18,
        active: true,
      },
      {
        id: "v-rm-l",
        product_id: "p-rm-2026",
        size: "L",
        color: "Blanco",
        sku: "KP-RMA-01-L",
        stock: 15,
        active: true,
      },
      {
        id: "v-rm-xl",
        product_id: "p-rm-2026",
        size: "XL",
        color: "Blanco",
        sku: "KP-RMA-01-XL",
        stock: 8,
        active: true,
      },
    ],
  },
  {
    id: "p-fcb-2026",
    name: "Camiseta FC Barcelona Visita 2025/2026 Black Edition",
    slug: "camiseta-fc-barcelona-visita-black-edition",
    description:
      "Edición especial negra y grana con detalles en relieve, escudo con efecto tornasol y tejido Dri-FIT ADV de alto rendimiento.",
    base_sku: "KP-FCB-02",
    retail_price: 35.0,
    wholesale_price: 24.0,
    wholesale_min_qty: 6,
    images: [
      "/__l5e/assets-v1/a4816654-219d-4720-bc40-10928e4693a1/p-jersey-2.jpg",
      "/__l5e/assets-v1/fb5cafd4-50ef-4ab9-b830-5e5bf6619dad/p-jersey-1.jpg",
    ],
    is_featured: true,
    is_bestseller: true,
    is_new: true,
    is_offer: false,
    active: true,
    low_stock_threshold: 4,
    created_at: "2026-08-14T10:00:00Z",
    brand: { id: "b1", name: "Nike", slug: "nike" },
    category: { id: "c1", name: "Camisetas de Fútbol", slug: "futbol" },
    variants: [
      {
        id: "v-fcb-s",
        product_id: "p-fcb-2026",
        size: "S",
        color: "Negro",
        sku: "KP-FCB-02-S",
        stock: 9,
        active: true,
      },
      {
        id: "v-fcb-m",
        product_id: "p-fcb-2026",
        size: "M",
        color: "Negro",
        sku: "KP-FCB-02-M",
        stock: 14,
        active: true,
      },
      {
        id: "v-fcb-l",
        product_id: "p-fcb-2026",
        size: "L",
        color: "Negro",
        sku: "KP-FCB-02-L",
        stock: 11,
        active: true,
      },
    ],
  },
  {
    id: "p-alo-leggings",
    name: "Leggings Alo Yoga Airlift High-Waist Pro",
    slug: "leggings-alo-yoga-airlift-high-waist-pro",
    description:
      "Leggings de compresión media con efecto satinado, tejido Airlift transpirable y tiro ultra alto moldeador. Ideal para yoga, pilates o entrenamiento diario.",
    base_sku: "KP-ALO-01",
    retail_price: 38.0,
    wholesale_price: 26.0,
    wholesale_min_qty: 6,
    images: [
      "/__l5e/assets-v1/25d97f48-a006-4df4-8d48-18e38d727bf1/p-leggings.jpg",
      "/__l5e/assets-v1/67634f18-63bb-40e1-bcfc-5b25208f85f1/p-top.jpg",
    ],
    is_featured: true,
    is_bestseller: true,
    is_new: false,
    is_offer: false,
    active: true,
    low_stock_threshold: 3,
    created_at: "2026-08-10T08:00:00Z",
    brand: { id: "b4", name: "Alo Yoga", slug: "alo" },
    category: { id: "c3", name: "Alo Yoga Collection", slug: "alo" },
    variants: [
      {
        id: "v-alo-xs",
        product_id: "p-alo-leggings",
        size: "XS",
        color: "Negro",
        sku: "KP-ALO-01-XS",
        stock: 6,
        active: true,
      },
      {
        id: "v-alo-s",
        product_id: "p-alo-leggings",
        size: "S",
        color: "Negro",
        sku: "KP-ALO-01-S",
        stock: 12,
        active: true,
      },
      {
        id: "v-alo-m",
        product_id: "p-alo-leggings",
        size: "M",
        color: "Negro",
        sku: "KP-ALO-01-M",
        stock: 8,
        active: true,
      },
    ],
  },
  {
    id: "p-alo-seamless-top",
    name: "Top Deportivo Alo Yoga Real Bra Tank",
    slug: "top-deportivo-alo-yoga-real-bra-tank",
    description:
      "Top cropped sin costuras con copas extraíbles y soporte medio. Diseñado para ofrecer confort total durante entrenamientos intensos o uso casual.",
    base_sku: "KP-ALO-02",
    retail_price: 28.0,
    wholesale_price: 19.0,
    wholesale_min_qty: 6,
    images: [
      "/__l5e/assets-v1/67634f18-63bb-40e1-bcfc-5b25208f85f1/p-top.jpg",
      "/__l5e/assets-v1/25d97f48-a006-4df4-8d48-18e38d727bf1/p-leggings.jpg",
    ],
    is_featured: false,
    is_bestseller: true,
    is_new: true,
    is_offer: true,
    active: true,
    low_stock_threshold: 4,
    created_at: "2026-08-12T11:00:00Z",
    brand: { id: "b4", name: "Alo Yoga", slug: "alo" },
    category: { id: "c3", name: "Alo Yoga Collection", slug: "alo" },
    variants: [
      {
        id: "v-alot-s",
        product_id: "p-alo-seamless-top",
        size: "S",
        color: "Blanco",
        sku: "KP-ALO-02-S",
        stock: 10,
        active: true,
      },
      {
        id: "v-alot-m",
        product_id: "p-alo-seamless-top",
        size: "M",
        color: "Blanco",
        sku: "KP-ALO-02-M",
        stock: 15,
        active: true,
      },
      {
        id: "v-alot-l",
        product_id: "p-alo-seamless-top",
        size: "L",
        color: "Blanco",
        sku: "KP-ALO-02-L",
        stock: 7,
        active: true,
      },
    ],
  },
  {
    id: "p-vinotinto-2026",
    name: "Franela Selección Venezuela Vinotinto Oficial 2026",
    slug: "franela-seleccion-venezuela-vinotinto-2026",
    description:
      "La pasión de todo un país. Camiseta titular de la Vinotinto con los colores patrios, textura jacquard y escudo oficial de la FVF termosellado.",
    base_sku: "KP-VEN-01",
    retail_price: 36.0,
    wholesale_price: 25.0,
    wholesale_min_qty: 6,
    images: [
      "/__l5e/assets-v1/fb5cafd4-50ef-4ab9-b830-5e5bf6619dad/p-jersey-1.jpg",
      "/__l5e/assets-v1/a4816654-219d-4720-bc40-10928e4693a1/p-jersey-2.jpg",
    ],
    is_featured: true,
    is_bestseller: true,
    is_new: true,
    is_offer: false,
    active: true,
    low_stock_threshold: 5,
    created_at: "2026-08-16T14:00:00Z",
    brand: { id: "b2", name: "Adidas", slug: "adidas" },
    category: { id: "c1", name: "Camisetas de Fútbol", slug: "futbol" },
    variants: [
      {
        id: "v-ven-s",
        product_id: "p-vinotinto-2026",
        size: "S",
        color: "Vinotinto",
        sku: "KP-VEN-01-S",
        stock: 14,
        active: true,
      },
      {
        id: "v-ven-m",
        product_id: "p-vinotinto-2026",
        size: "M",
        color: "Vinotinto",
        sku: "KP-VEN-01-M",
        stock: 22,
        active: true,
      },
      {
        id: "v-ven-l",
        product_id: "p-vinotinto-2026",
        size: "L",
        color: "Vinotinto",
        sku: "KP-VEN-01-L",
        stock: 19,
        active: true,
      },
      {
        id: "v-ven-xl",
        product_id: "p-vinotinto-2026",
        size: "XL",
        color: "Vinotinto",
        sku: "KP-VEN-01-XL",
        stock: 11,
        active: true,
      },
    ],
  },
  {
    id: "p-intermiami-2026",
    name: "Camiseta Inter Miami Messi 10 Pink Edition 2026",
    slug: "camiseta-inter-miami-messi-10-pink-2026",
    description:
      "Camiseta icónica rosa del Inter Miami CF con estampado oficial Messi 10. Tejido ultraligero y detalles bordados de alta definición.",
    base_sku: "KP-MIA-10",
    retail_price: 35.0,
    wholesale_price: 24.0,
    wholesale_min_qty: 6,
    images: [
      "/__l5e/assets-v1/a4816654-219d-4720-bc40-10928e4693a1/p-jersey-2.jpg",
      "/__l5e/assets-v1/fb5cafd4-50ef-4ab9-b830-5e5bf6619dad/p-jersey-1.jpg",
    ],
    is_featured: true,
    is_bestseller: true,
    is_new: false,
    is_offer: true,
    active: true,
    low_stock_threshold: 4,
    created_at: "2026-08-08T09:00:00Z",
    brand: { id: "b2", name: "Adidas", slug: "adidas" },
    category: { id: "c1", name: "Camisetas de Fútbol", slug: "futbol" },
    variants: [
      {
        id: "v-mia-s",
        product_id: "p-intermiami-2026",
        size: "S",
        color: "Rosado",
        sku: "KP-MIA-10-S",
        stock: 8,
        active: true,
      },
      {
        id: "v-mia-m",
        product_id: "p-intermiami-2026",
        size: "M",
        color: "Rosado",
        sku: "KP-MIA-10-M",
        stock: 16,
        active: true,
      },
      {
        id: "v-mia-l",
        product_id: "p-intermiami-2026",
        size: "L",
        color: "Rosado",
        sku: "KP-MIA-10-L",
        stock: 12,
        active: true,
      },
    ],
  },
];

let _inMemoryProducts: Product[] = [...DEMO_PRODUCTS];

export function getInMemoryProducts(): Product[] {
  return _inMemoryProducts;
}

export function addInMemoryProduct(product: Product): Product {
  _inMemoryProducts = [product, ..._inMemoryProducts];
  return product;
}

export function updateInMemoryProduct(id: string, updates: Partial<Product>): Product | null {
  const index = _inMemoryProducts.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const current = _inMemoryProducts[index];
  const updated: Product = {
    ...current,
    ...updates,
    variants: updates.variants ?? current.variants,
  };
  _inMemoryProducts[index] = updated;
  return updated;
}

export function setInMemoryProductActive(id: string, active: boolean): boolean {
  const index = _inMemoryProducts.findIndex((p) => p.id === id);
  if (index === -1) return false;
  _inMemoryProducts[index].active = active;
  return true;
}

export function deleteInMemoryProduct(id: string): boolean {
  const len = _inMemoryProducts.length;
  _inMemoryProducts = _inMemoryProducts.filter((p) => p.id !== id);
  return _inMemoryProducts.length < len;
}

export type InMemoryOrder = {
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

export type InMemoryKardex = {
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
};

let _inMemoryOrders: InMemoryOrder[] = [];

let _inMemoryKardex: InMemoryKardex[] = [];

export function getInMemoryOrders(): InMemoryOrder[] {
  return _inMemoryOrders;
}

export function getInMemoryOrderByNumber(orderNumber: string): InMemoryOrder | null {
  return (
    _inMemoryOrders.find(
      (o) => o.order_number.toUpperCase() === orderNumber.trim().toUpperCase(),
    ) ?? null
  );
}

export function addInMemoryOrder(order: InMemoryOrder): InMemoryOrder {
  _inMemoryOrders = [order, ..._inMemoryOrders];
  return order;
}

export function updateInMemoryOrderStatus(orderId: string, status: string): boolean {
  const order = _inMemoryOrders.find((o) => o.id === orderId);
  if (!order) return false;
  order.status = status;
  return true;
}

export function uploadInMemoryProof(
  orderNumber: string,
  reference: string,
  proofUrl: string,
): boolean {
  const order = getInMemoryOrderByNumber(orderNumber);
  if (!order) return false;

  const payment = order.payments[0] ?? {
    id: `pay-${Date.now()}`,
    status: "pendiente",
    amount: order.total,
    method_code: order.payment_method_code,
    reference,
    proof_url: proofUrl,
    proof_uploaded_at: new Date().toISOString(),
    rejection_reason: null,
    created_at: new Date().toISOString(),
  };

  payment.proof_url = proofUrl;
  payment.reference = reference;
  payment.proof_uploaded_at = new Date().toISOString();
  payment.status = "pendiente";
  payment.rejection_reason = null;

  order.payments = [payment];
  order.status = "pago_pendiente";
  return true;
}

export function reviewInMemoryPayment(
  paymentId: string,
  approve: boolean,
  reason?: string,
): { ok: boolean; approved: boolean } {
  for (const order of _inMemoryOrders) {
    const payment = order.payments.find((p) => p.id === paymentId);
    if (!payment) continue;

    if (!approve) {
      payment.status = "rechazado";
      payment.rejection_reason = reason || "Comprobante no válido";
      order.status = "pago_pendiente";
      return { ok: true, approved: false };
    }

    payment.status = "verificado";
    payment.rejection_reason = null;
    order.status = "pago_verificado";

    // Deduct stock idempotently
    if (!order.inventory_applied) {
      for (const item of order.items) {
        if (!item.variant_id) continue;
        for (const prod of _inMemoryProducts) {
          const variant = prod.variants?.find((v) => v.id === item.variant_id);
          if (variant) {
            const current = variant.stock ?? 0;
            const newStock = Math.max(0, current - item.quantity);
            variant.stock = newStock;

            _inMemoryKardex = [
              {
                id: `k-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                productName: item.product_name,
                size: item.size,
                color: item.color,
                sku: variant.sku ?? prod.base_sku,
                type: "salida",
                quantity: item.quantity,
                stockAfter: newStock,
                reference: order.order_number,
                note: `Pago verificado - Pedido ${order.order_number}`,
                createdAt: new Date().toISOString(),
              },
              ..._inMemoryKardex,
            ];
          }
        }
      }
      order.inventory_applied = true;
    }

    return { ok: true, approved: true };
  }
  return { ok: false, approved: false };
}

export function getInMemoryKardex(): InMemoryKardex[] {
  return _inMemoryKardex;
}

export function getInMemoryBadges(): { pendingOrders: number; pendingPayments: number } {
  const pendingOrders = _inMemoryOrders.filter((o) =>
    ["pedido_recibido", "pago_pendiente", "pago_subido"].includes(o.status),
  ).length;

  const pendingPayments = _inMemoryOrders.reduce(
    (sum, o) => sum + o.payments.filter((p) => p.status === "pendiente").length,
    0,
  );

  return { pendingOrders, pendingPayments };
}

let _inMemorySettings: any = {
  whatsapp: "+58 412 1546698",
  shipping_flat: 0,
  exchange_rate_bcv: 78.5,
  exchange_rate_usdt: 86.2,
  exchange_rate_bs: 78.5,
  low_stock_threshold: 5,
};

let _inMemoryPaymentMethods: any[] = [
  {
    id: "pm-1",
    code: "pago_movil",
    name: "Pago Móvil (BDV / Banesco)",
    active: true,
    sort_order: 1,
    instructions:
      "Banco: Banesco (0134) | Teléfono: 0412-1546698 | Cédula: V-12345678 | Titular: KICKPOINT C.A.",
    details: {
      banco: "Banesco (0134)",
      telefono: "0412-1546698",
      cedula: "V-12345678",
      titular: "KICKPOINT C.A.",
    },
  },
  {
    id: "pm-2",
    code: "zelle",
    name: "Zelle",
    active: true,
    sort_order: 2,
    instructions: "Correo: pagos@kickpointstore.com | Titular: Kickpoint Sports LLC",
    details: {
      email: "pagos@kickpointstore.com",
      titular: "Kickpoint Sports LLC",
    },
  },
  {
    id: "pm-3",
    code: "usdt",
    name: "USDT / Binance Pay",
    active: true,
    sort_order: 3,
    instructions:
      "Red: TRC-20 | Wallet: TYDzmE2z5UaXzH89Bq2nK19481 | Memo: Binance Pay ID: 58910293",
    details: {
      red: "TRON (TRC-20)",
      direccion: "TYDzmE2z5UaXzH89Bq2nK19481",
      memo: "Binance Pay ID: 58910293",
    },
  },
  {
    id: "pm-4",
    code: "transferencia",
    name: "Transferencia Bancaria Nacional",
    active: true,
    sort_order: 4,
    instructions:
      "Banco: Banesco | Cuenta: 0134-0000-00-0000000000 | Titular: KICKPOINT C.A. | RIF: J-12345678-0",
    details: {
      banco: "Banesco Banco Universal",
      tipo: "Corriente",
      numero_cuenta: "0134-0000-00-0000000000",
      titular: "KICKPOINT C.A.",
      cedula: "J-12345678-0",
    },
  },
];

let _inMemoryBrands: Brand[] = [...DEMO_BRANDS];

export function getInMemoryBrands(): Brand[] {
  return _inMemoryBrands;
}

export function addInMemoryBrand(brand: Brand): Brand {
  const existing = _inMemoryBrands.find(
    (b) => b.name.toLowerCase() === brand.name.toLowerCase() || b.id === brand.id,
  );
  if (existing) return existing;
  _inMemoryBrands = [..._inMemoryBrands, brand];
  return brand;
}

export function updateInMemoryBrand(id: string, patch: Partial<Brand>): boolean {
  const idx = _inMemoryBrands.findIndex((b) => b.id === id);
  if (idx === -1) return false;
  _inMemoryBrands[idx] = { ..._inMemoryBrands[idx], ...patch };
  return true;
}

export function deleteInMemoryBrand(id: string): boolean {
  const len = _inMemoryBrands.length;
  _inMemoryBrands = _inMemoryBrands.filter((b) => b.id !== id);
  return _inMemoryBrands.length < len;
}

let _inMemoryCategories: Category[] = [...DEMO_CATEGORIES];

export function getInMemoryCategories(): Category[] {
  return _inMemoryCategories;
}

export function addInMemoryCategory(cat: Category): Category {
  _inMemoryCategories = [..._inMemoryCategories, cat];
  return cat;
}

export function updateInMemoryCategory(id: string, patch: Partial<Category>): boolean {
  const idx = _inMemoryCategories.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  _inMemoryCategories[idx] = { ..._inMemoryCategories[idx], ...patch };
  return true;
}

export function deleteInMemoryCategory(id: string): boolean {
  const len = _inMemoryCategories.length;
  _inMemoryCategories = _inMemoryCategories.filter((c) => c.id !== id);
  return _inMemoryCategories.length < len;
}

let _inMemoryCustomers: any[] = [
  {
    id: "cust-demo-1",
    first_name: "Carlos",
    last_name: "Pérez",
    whatsapp: "+58 412 1546698",
    phone: "+58 412 1546698",
    email: "carlos.perez@ejemplo.com",
    address: "TEALCA - Calle Las Flores 12",
    city: "Caracas",
    state: "Distrito Capital",
    notes: "Cliente frecuente",
    created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    order_count: 0,
    total_spent: 0,
  },
];

export function getInMemoryCustomers(): any[] {
  return _inMemoryCustomers;
}

export function addInMemoryCustomer(cust: any): any {
  const newCust = {
    id: `cust-${Date.now()}`,
    created_at: new Date().toISOString(),
    order_count: 0,
    total_spent: 0,
    ...cust,
  };
  _inMemoryCustomers = [newCust, ..._inMemoryCustomers];
  return newCust;
}

export function updateInMemoryCustomer(id: string, patch: any): boolean {
  const idx = _inMemoryCustomers.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  _inMemoryCustomers[idx] = { ..._inMemoryCustomers[idx], ...patch };
  return true;
}

let _inMemorySales: any[] = [];

export function getInMemorySales(): any[] {
  return _inMemorySales;
}

export function addInMemorySale(sale: any): any {
  const newSale = {
    id: `sale-${Date.now()}`,
    sale_number: `VENTA-${Math.floor(100000 + Math.random() * 900000)}`,
    created_at: new Date().toISOString(),
    ...sale,
  };
  _inMemorySales = [newSale, ..._inMemorySales];
  return newSale;
}

export function deleteInMemorySale(saleId: string, restoreStock: boolean = true): boolean {
  const sale = _inMemorySales.find((s) => s.id === saleId);
  if (!sale) return false;
  if (restoreStock && Array.isArray(sale.items)) {
    for (const item of sale.items) {
      if (item.variant_id) {
        recordInMemoryMovement(
          item.variant_id,
          "entrada",
          item.quantity,
          item.unit_cost,
          sale.sale_number,
          "Anulación de venta presencial / Reversión de stock",
        );
      }
    }
  }
  const len = _inMemorySales.length;
  _inMemorySales = _inMemorySales.filter((s) => s.id !== saleId);
  return _inMemorySales.length < len;
}

export function recordInMemoryMovement(
  variantId: string,
  type: "entrada" | "salida" | "ajuste",
  quantity: number,
  unitCost?: number | null,
  reference?: string | null,
  note?: string | null,
): { ok: boolean; stockAfter: number } {
  let foundProduct: Product | undefined;
  let foundVariant: any | undefined;

  for (const p of _inMemoryProducts) {
    const v = p.variants?.find((va) => va.id === variantId);
    if (v) {
      foundProduct = p;
      foundVariant = v;
      break;
    }
  }

  const currentStock = Number(foundVariant?.stock ?? 0);
  let stockAfter: number;
  let loggedQuantity: number;

  if (type === "entrada") {
    stockAfter = currentStock + quantity;
    loggedQuantity = quantity;
  } else if (type === "salida") {
    stockAfter = Math.max(0, currentStock - quantity);
    loggedQuantity = quantity;
  } else {
    stockAfter = Math.max(0, quantity);
    loggedQuantity = stockAfter - currentStock;
  }

  if (foundVariant) {
    foundVariant.stock = stockAfter;
  }

  _inMemoryKardex = [
    {
      id: `k-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productName: foundProduct?.name ?? "Producto",
      size: foundVariant?.size ?? null,
      color: foundVariant?.color ?? null,
      sku: foundVariant?.sku ?? foundProduct?.base_sku ?? null,
      type,
      quantity: loggedQuantity,
      stockAfter,
      reference: reference ?? null,
      note: note ?? null,
      createdAt: new Date().toISOString(),
    },
    ..._inMemoryKardex,
  ];

  return { ok: true, stockAfter };
}

export function deleteInMemoryMovement(
  movementId: string,
  revertStock = true,
): { ok: boolean; stockAfter?: number } {
  const movementIndex = _inMemoryKardex.findIndex((m) => m.id === movementId);
  if (movementIndex === -1) return { ok: false };
  const movement = _inMemoryKardex[movementIndex]!;

  let newStock: number | undefined;
  if (revertStock) {
    for (const p of _inMemoryProducts) {
      const v = p.variants?.find(
        (va) =>
          (movement.sku && va.sku === movement.sku) ||
          (movement.size && va.size === movement.size && p.name === movement.productName),
      );
      if (v) {
        const cur = Number(v.stock ?? 0);
        if (movement.type === "salida" || movement.type === "venta") {
          v.stock = cur + Math.abs(movement.quantity);
        } else if (movement.type === "entrada") {
          v.stock = Math.max(0, cur - Math.abs(movement.quantity));
        }
        newStock = v.stock;
        break;
      }
    }
  }

  _inMemoryKardex = _inMemoryKardex.filter((m) => m.id !== movementId);
  return { ok: true, stockAfter: newStock };
}

export function updateInMemoryMovement(
  movementId: string,
  patch: { reference?: string | null; note?: string | null },
): boolean {
  const movement = _inMemoryKardex.find((m) => m.id === movementId);
  if (!movement) return false;
  if (patch.reference !== undefined) movement.reference = patch.reference;
  if (patch.note !== undefined) movement.note = patch.note;
  return true;
}

export function getInMemorySettings() {
  return _inMemorySettings;
}

export function updateInMemorySettings(patch: any) {
  _inMemorySettings = { ..._inMemorySettings, ...patch };
  return _inMemorySettings;
}

export function getInMemoryPaymentMethods() {
  return _inMemoryPaymentMethods;
}

export function updateInMemoryPaymentMethod(id: string, patch: any) {
  _inMemoryPaymentMethods = _inMemoryPaymentMethods.map((m) =>
    m.id === id ? { ...m, ...patch } : m,
  );
  return true;
}

export function deleteInMemoryOrder(orderId: string): boolean {
  const initialLength = _inMemoryOrders.length;
  _inMemoryOrders = _inMemoryOrders.filter((o) => o.id !== orderId);
  return _inMemoryOrders.length < initialLength;
}

export type InMemoryWhatsAppNotification = {
  id: string;
  event_type: string;
  recipient_phone: string;
  recipient_type: "admin" | "customer";
  order_id?: string | null;
  order_code?: string | null;
  message: string;
  template_name?: string | null;
  status: "pending" | "sent" | "failed";
  provider_message_id?: string | null;
  error_message?: string | null;
  attempts: number;
  idempotency_key: string;
  created_at: string;
  sent_at?: string | null;
};

let _inMemoryWhatsAppNotifications: InMemoryWhatsAppNotification[] = [];

export function getInMemoryWhatsAppNotifications(): InMemoryWhatsAppNotification[] {
  return _inMemoryWhatsAppNotifications;
}

export function addInMemoryWhatsAppNotification(n: InMemoryWhatsAppNotification) {
  const existingIdx = _inMemoryWhatsAppNotifications.findIndex(
    (item) => item.idempotency_key === n.idempotency_key,
  );
  if (existingIdx >= 0) {
    _inMemoryWhatsAppNotifications[existingIdx] = n;
  } else {
    _inMemoryWhatsAppNotifications = [n, ..._inMemoryWhatsAppNotifications];
  }
  return n;
}

export function clearInMemoryWhatsAppNotifications() {
  _inMemoryWhatsAppNotifications = [];
}

export type InMemoryEmailNotification = {
  id: string;
  event_type: string;
  recipient_email: string;
  recipient_type: "admin" | "customer";
  subject: string;
  order_id?: string | null;
  order_code?: string | null;
  status: "pending" | "sent" | "failed";
  provider_message_id?: string | null;
  error_message?: string | null;
  attempts: number;
  idempotency_key: string;
  created_at: string;
  sent_at?: string | null;
};

let _inMemoryEmailNotifications: InMemoryEmailNotification[] = [];

export function getInMemoryEmailNotifications(): InMemoryEmailNotification[] {
  return _inMemoryEmailNotifications;
}

export function addInMemoryEmailNotification(n: InMemoryEmailNotification) {
  const existingIdx = _inMemoryEmailNotifications.findIndex(
    (item) => item.idempotency_key === n.idempotency_key,
  );
  if (existingIdx >= 0) {
    _inMemoryEmailNotifications[existingIdx] = n;
  } else {
    _inMemoryEmailNotifications = [n, ..._inMemoryEmailNotifications];
  }
  return n;
}

export function clearInMemoryEmailNotifications() {
  _inMemoryEmailNotifications = [];
}
