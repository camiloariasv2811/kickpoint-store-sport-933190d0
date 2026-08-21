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
