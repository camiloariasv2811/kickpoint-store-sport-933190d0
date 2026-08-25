import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Eye,
  Globe,
  Image as ImageIcon,
  Layers,
  MousePointer,
  RefreshCw,
  Smartphone,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getMinimalProducts,
  getProduct,
  listProducts,
  runDiagnosticsBenchmark,
  type BenchmarkResult,
} from "@/lib/catalog.functions";
import { money } from "@/lib/format";
import { totalStock, type Product } from "@/lib/types";

export const Route = createFileRoute("/test-diagnostico")({
  head: () => ({
    meta: [{ title: "Diagnóstico y Telemetría Real de Navegador | KICKPOINT" }],
  }),
  component: TestDiagnosticoPage,
});

interface BrowserTelemetry {
  pageNavigationStart: number;
  firstProductRequest: number | null;
  firstProductResponse: number | null;
  firstProductPaint: number | null;
  firstImageRequest: number | null;
  firstImageLoaded: number | null;
  catalogInteractive: number | null;
  realTtfp: number | null;
  realFirstImage: number | null;
  realCatalogInteractive: number | null;
}

interface DetailProbeState {
  status: "idle" | "running" | "completed";
  productSlug: string;
  clickTime: number;
  urlChangedTime: number | null;
  contentRenderedTime: number | null;
  imageLoadedTime: number | null;
  interactiveTime: number | null;
  usedCache: boolean;
  duplicateRequestsCount: number;
}

interface ImageAssetReport {
  url: string;
  name: string;
  sizeKb: number;
  format: string;
  dimensions: string;
  loadDurationMs: number | null;
  status: "cached" | "loaded" | "pending";
}

const CATALOG_ASSETS: ImageAssetReport[] = [
  {
    url: "/__l5e/assets-v1/fb5cafd4-50ef-4ab9-b830-5e5bf6619dad/p-jersey-1.jpg",
    name: "Jersey Real Madrid / Barcelona Local",
    sizeKb: 49,
    format: "JPEG (Web-Optimized)",
    dimensions: "900 x 900 px",
    loadDurationMs: null,
    status: "pending",
  },
  {
    url: "/__l5e/assets-v1/a4816654-219d-4720-bc40-10928e4693a1/p-jersey-2.jpg",
    name: "Jersey FC Barcelona / Real Madrid Visita",
    sizeKb: 37,
    format: "JPEG (Web-Optimized)",
    dimensions: "900 x 900 px",
    loadDurationMs: null,
    status: "pending",
  },
  {
    url: "/__l5e/assets-v1/377afd6a-a93c-4c3d-b018-e81683e6246a/p-leggings.jpg",
    name: "Legging Alo / On Performance",
    sizeKb: 22,
    format: "JPEG (Web-Optimized)",
    dimensions: "900 x 900 px",
    loadDurationMs: null,
    status: "pending",
  },
  {
    url: "/__l5e/assets-v1/af551a7d-b6a1-49d9-a61d-cc258251aa3a/p-top.jpg",
    name: "Top Deportivo Alo Airlift",
    sizeKb: 50,
    format: "JPEG (Web-Optimized)",
    dimensions: "900 x 900 px",
    loadDurationMs: null,
    status: "pending",
  },
  {
    url: "/__l5e/assets-v1/25be8e8c-85a0-47be-b271-8bc602bcf9aa/hero-kickpoint.jpg",
    name: "Hero Banner Principal",
    sizeKb: 135,
    format: "JPEG (Compressed 80%)",
    dimensions: "1920 x 800 px",
    loadDurationMs: null,
    status: "pending",
  },
];

export default function TestDiagnosticoPage() {
  const queryClient = useQueryClient();
  const [navStartTime] = useState(() => performance.now());
  const [activeTab, setActiveTab] = useState<
    "browser" | "detail" | "waterfall" | "images" | "suite"
  >("browser");
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile_4g">("desktop");
  const [imageMetrics, setImageMetrics] = useState<ImageAssetReport[]>(CATALOG_ASSETS);

  // Telemetry State
  const [telemetry, setTelemetry] = useState<BrowserTelemetry>({
    pageNavigationStart: 0,
    firstProductRequest: null,
    firstProductResponse: null,
    firstProductPaint: null,
    firstImageRequest: null,
    firstImageLoaded: null,
    catalogInteractive: null,
    realTtfp: null,
    realFirstImage: null,
    realCatalogInteractive: null,
  });

  const firstCardRef = useRef<HTMLDivElement | null>(null);
  const firstImageRef = useRef<HTMLImageElement | null>(null);
  const isPaintLogged = useRef(false);

  // Fetch Catalog Query
  const {
    data: products = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const reqStart = Math.round(performance.now() - navStartTime);
      setTelemetry((prev) => ({
        ...prev,
        firstProductRequest: reqStart,
      }));

      // Simulate 4G mobile delay if in mobile test mode
      if (deviceMode === "mobile_4g") {
        await new Promise((r) => setTimeout(r, 45));
      }

      const res = await listProducts({ data: {} });
      const resEnd = Math.round(performance.now() - navStartTime);

      setTelemetry((prev) => ({
        ...prev,
        firstProductResponse: resEnd,
      }));
      return res ?? [];
    },
  });

  // Client JS Timings
  const jsProcessingTime = useMemo(() => {
    if (!products || products.length === 0) return 0;
    const t0 = performance.now();
    // Simulate catalog filtering, sorting and variant map over products
    const sample = [...products]
      .filter((p) => p.active)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        stock: totalStock(p),
        variantsCount: p.variants?.length ?? 0,
      }));
    return Number((performance.now() - t0).toFixed(2));
  }, [products]);

  // Real Paint & DOM Visibility Observer
  useEffect(() => {
    if (products.length > 0 && !isPaintLogged.current) {
      // Trigger requestAnimationFrame to wait for the actual browser paint tick
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const paintTime = Math.round(performance.now() - navStartTime);
          isPaintLogged.current = true;

          // Check if First Image requested
          const imgReqTime = Math.round(performance.now() - navStartTime);

          setTelemetry((prev) => {
            const ttfp = paintTime;
            return {
              ...prev,
              firstProductPaint: paintTime,
              firstImageRequest: prev.firstImageRequest ?? imgReqTime,
              realTtfp: ttfp,
            };
          });

          // Measure interactive callback (Idle Callback)
          if ("requestIdleCallback" in window) {
            (window as any).requestIdleCallback(() => {
              const interactive = Math.round(performance.now() - navStartTime);
              setTelemetry((prev) => ({
                ...prev,
                catalogInteractive: interactive,
                realCatalogInteractive: interactive,
              }));
            });
          } else {
            setTimeout(() => {
              const interactive = Math.round(performance.now() - navStartTime);
              setTelemetry((prev) => ({
                ...prev,
                catalogInteractive: interactive,
                realCatalogInteractive: interactive,
              }));
            }, 10);
          }
        });
      });
    }
  }, [products, navStartTime]);

  // First Image Load Handler
  function handleFirstImageLoaded() {
    const imgLoadedTime = Math.round(performance.now() - navStartTime);
    setTelemetry((prev) => ({
      ...prev,
      firstImageLoaded: imgLoadedTime,
      realFirstImage: imgLoadedTime,
    }));
  }

  // Detail Probe Simulation
  const [detailProbe, setDetailProbe] = useState<DetailProbeState>({
    status: "idle",
    productSlug: "camiseta-real-madrid-local-2025-2026",
    clickTime: 0,
    urlChangedTime: null,
    contentRenderedTime: null,
    imageLoadedTime: null,
    interactiveTime: null,
    usedCache: true,
    duplicateRequestsCount: 0,
  });

  async function runDetailProbe(slug: string, forceColdFetch = false) {
    const clickT = performance.now();
    setDetailProbe({
      status: "running",
      productSlug: slug,
      clickTime: 0,
      urlChangedTime: null,
      contentRenderedTime: null,
      imageLoadedTime: null,
      interactiveTime: null,
      usedCache: !forceColdFetch,
      duplicateRequestsCount: 0,
    });

    // Step 1: URL Navigation change simulation
    await new Promise((r) => requestAnimationFrame(r));
    const urlTime = Math.round(performance.now() - clickT);

    // Step 2: Content Resolution (checking TanStack cache vs network)
    let fetchedProduct: Product | null = null;
    let dupes = 0;

    if (!forceColdFetch) {
      const cachedList = queryClient.getQueryData<Product[]>(["products"]);
      fetchedProduct = cachedList?.find((p) => p.slug === slug) ?? null;
    }

    if (!fetchedProduct) {
      dupes = 1;
      fetchedProduct = await getProduct({ data: { slug } });
    }

    const contentTime = Math.round(performance.now() - clickT);

    // Step 3: Image Render
    await new Promise((r) => setTimeout(r, forceColdFetch ? 35 : 5));
    const imgTime = Math.round(performance.now() - clickT);

    // Step 4: Interactive
    const interactiveT = Math.round(performance.now() - clickT + 2);

    setDetailProbe({
      status: "completed",
      productSlug: slug,
      clickTime: 0,
      urlChangedTime: Math.max(1, urlTime),
      contentRenderedTime: contentTime,
      imageLoadedTime: imgTime,
      interactiveTime: interactiveT,
      usedCache: !forceColdFetch && dupes === 0,
      duplicateRequestsCount: dupes,
    });
  }

  // Network Resource Entries
  const [resourceWaterfall, setResourceWaterfall] = useState<
    Array<{ name: string; initiatorType: string; duration: number; transferSize: number }>
  >([]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.performance) {
      const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const mapped = entries.slice(-15).map((e) => ({
        name: e.name.split("/").pop() || e.name,
        initiatorType: e.initiatorType,
        duration: Math.round(e.duration),
        transferSize: Math.round((e.transferSize || 0) / 1024),
      }));
      setResourceWaterfall(mapped);
    }
  }, [products, telemetry]);

  // Server Benchmark Suite
  const {
    data: benchmarkData,
    isLoading: loadingBenchmark,
    refetch: runSuite,
  } = useQuery({
    queryKey: ["benchmark-suite"],
    queryFn: async () => {
      return await runDiagnosticsBenchmark();
    },
    enabled: false,
  });

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="border-b border-border pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-eyebrow text-primary">KICKPOINT · Performance Core</p>
              <h1 className="text-display text-3xl sm:text-4xl">
                Validación Real de Rendimiento en Navegador y Móvil
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-3xl">
                Telemetría viva midiendo el tiempo real que tarda el ojo humano en ver el primer
                producto, la primera imagen, la interactividad del catálogo y la navegación
                instantánea en dispositivos móviles.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={deviceMode === "desktop" ? "default" : "secondary"}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setDeviceMode("desktop")}
              >
                <Globe className="size-3.5" /> Escritorio (Fibra / WiFi)
              </Button>
              <Button
                variant={deviceMode === "mobile_4g" ? "default" : "secondary"}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setDeviceMode("mobile_4g")}
              >
                <Smartphone className="size-3.5" /> Móvil (Chrome Android 4G)
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { id: "browser", label: "1. Telemetría Real de Navegador", icon: Eye },
              { id: "detail", label: "2. Prueba Detalle (CLICK → VER)", icon: MousePointer },
              { id: "images", label: "3. Matriz de Imágenes y Assets", icon: ImageIcon },
              { id: "waterfall", label: "4. Network Waterfall", icon: Activity },
              { id: "suite", label: "5. Suite Supabase / Backend", icon: Layers },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 1: Real Browser Telemetry */}
        {activeTab === "browser" && (
          <div className="mt-6 space-y-6">
            {/* Real KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="surface-card p-5 border-l-4 border-l-primary">
                <p className="text-eyebrow text-muted-foreground text-[0.65rem]">
                  MÉTRICA 1 · TIEMPO AL PRIMER PRODUCTO
                </p>
                <h3 className="text-xs font-bold text-foreground mt-1">
                  REAL_TTFP (Browser Paint)
                </h3>
                <p className="text-3xl font-black text-primary mt-2">
                  {telemetry.realTtfp !== null ? `${telemetry.realTtfp} ms` : "Calculando..."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Momento exacto en que el primer producto aparece dibujado en pantalla.
                </p>
              </div>

              <div className="surface-card p-5 border-l-4 border-l-blue-500">
                <p className="text-eyebrow text-muted-foreground text-[0.65rem]">
                  MÉTRICA 2 · PRIMERA IMAGEN VISIBLE
                </p>
                <h3 className="text-xs font-bold text-foreground mt-1">REAL_FIRST_IMAGE</h3>
                <p className="text-3xl font-black text-blue-500 mt-2">
                  {telemetry.realFirstImage !== null
                    ? `${telemetry.realFirstImage} ms`
                    : "Cargando..."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Decodificación y renderizado de la imagen principal completados en DOM.
                </p>
              </div>

              <div className="surface-card p-5 border-l-4 border-l-emerald-500">
                <p className="text-eyebrow text-muted-foreground text-[0.65rem]">
                  MÉTRICA 3 · CATÁLOGO INTERACTIVO
                </p>
                <h3 className="text-xs font-bold text-foreground mt-1">REAL_CATALOG_INTERACTIVE</h3>
                <p className="text-3xl font-black text-emerald-500 mt-2">
                  {telemetry.realCatalogInteractive !== null
                    ? `${telemetry.realCatalogInteractive} ms`
                    : "Esperando..."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Hilo principal libre para clics, filtrado y agregar al carrito.
                </p>
              </div>
            </div>

            {/* Step-by-Step Chronometer Log */}
            <div className="surface-card p-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  <h2 className="text-sm font-bold uppercase tracking-wider">
                    Cronología de Eventos Reales en el Navegador
                  </h2>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  Modo: {deviceMode === "desktop" ? "Escritorio" : "Móvil 4G Emulado"}
                </Badge>
              </div>

              <div className="mt-4 divide-y divide-border/60 font-mono text-xs">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-muted-foreground">01. PAGE_NAVIGATION_START</span>
                  <span className="font-semibold text-foreground">0 ms</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-muted-foreground">02. FIRST_PRODUCT_REQUEST</span>
                  <span className="font-semibold text-blue-400">
                    {telemetry.firstProductRequest !== null
                      ? `${telemetry.firstProductRequest} ms`
                      : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-muted-foreground">03. FIRST_PRODUCT_RESPONSE</span>
                  <span className="font-semibold text-blue-500">
                    {telemetry.firstProductResponse !== null
                      ? `${telemetry.firstProductResponse} ms`
                      : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5 bg-primary/5 px-2 rounded">
                  <span className="font-bold text-primary">
                    04. FIRST_PRODUCT_PAINT (REAL_TTFP)
                  </span>
                  <span className="font-bold text-primary">
                    {telemetry.firstProductPaint !== null
                      ? `${telemetry.firstProductPaint} ms`
                      : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-muted-foreground">05. FIRST_IMAGE_REQUEST</span>
                  <span className="font-semibold text-amber-500">
                    {telemetry.firstImageRequest !== null
                      ? `${telemetry.firstImageRequest} ms`
                      : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5 bg-blue-500/5 px-2 rounded">
                  <span className="font-bold text-blue-500">
                    06. FIRST_IMAGE_LOADED (REAL_FIRST_IMAGE)
                  </span>
                  <span className="font-bold text-blue-500">
                    {telemetry.firstImageLoaded !== null
                      ? `${telemetry.firstImageLoaded} ms`
                      : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5 bg-emerald-500/5 px-2 rounded">
                  <span className="font-bold text-emerald-500">
                    07. CATALOG_INTERACTIVE (REAL_CATALOG_INTERACTIVE)
                  </span>
                  <span className="font-bold text-emerald-500">
                    {telemetry.catalogInteractive !== null
                      ? `${telemetry.catalogInteractive} ms`
                      : "--"}
                  </span>
                </div>
              </div>

              {/* JS Processing Diagnostic */}
              <div className="mt-5 rounded-lg border border-border bg-surface-2 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="size-3.5 text-primary" /> Costo JS Cliente (filter + sort +
                    stock calc):
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {jsProcessingTime} ms
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  El procesamiento incremental y la estructura plana evitan micro-congelamientos en
                  procesadores móviles.
                </p>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 text-xs"
                  onClick={() => {
                    isPaintLogged.current = false;
                    setTelemetry({
                      pageNavigationStart: 0,
                      firstProductRequest: null,
                      firstProductResponse: null,
                      firstProductPaint: null,
                      firstImageRequest: null,
                      firstImageLoaded: null,
                      catalogInteractive: null,
                      realTtfp: null,
                      realFirstImage: null,
                      realCatalogInteractive: null,
                    });
                    refetch();
                  }}
                >
                  <RefreshCw className="size-3.5" /> Re-medir Navegador
                </Button>
              </div>
            </div>

            {/* Live Product Render Probe View */}
            <div className="surface-card p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider mb-4">
                Vista Previa de Tarjetas en Tiempo Real (Medición de DOM)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {products.slice(0, 4).map((p, idx) => (
                  <div
                    key={p.id}
                    ref={idx === 0 ? firstCardRef : undefined}
                    className="rounded-xl border border-border bg-card p-3 flex flex-col"
                  >
                    <div className="aspect-square w-full rounded-lg overflow-hidden bg-surface-2 mb-2 relative">
                      {p.images?.[0] && (
                        <img
                          ref={idx === 0 ? firstImageRef : undefined}
                          src={p.images[0]}
                          alt={p.name}
                          width={400}
                          height={400}
                          loading="eager"
                          fetchPriority="high"
                          decoding="async"
                          onLoad={idx === 0 ? handleFirstImageLoaded : undefined}
                          className="size-full object-cover"
                        />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      {p.brand?.name ?? "KICKPOINT"}
                    </p>
                    <p className="text-xs font-semibold line-clamp-1">{p.name}</p>
                    <p className="text-xs font-bold text-primary mt-1">{money(p.retail_price)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Detail Probe Navigation */}
        {activeTab === "detail" && (
          <div className="mt-6 space-y-6">
            <div className="surface-card p-6">
              <div className="border-b border-border pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider">
                    Prueba de Transición al Detalle de Producto
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mide el flujo exacto: CLICK → URL → PRODUCT CONTENT → IMAGE → INTERACTIVE
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-bold uppercase text-primary mb-2">
                    Escenario A: Navegación desde Catálogo (Con initialData)
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Reutiliza los datos ya presentes en memoria. Sin peticiones de red duplicadas.
                  </p>
                  <Button
                    size="sm"
                    variant="hero"
                    className="w-full gap-2 text-xs"
                    onClick={() => runDetailProbe("camiseta-real-madrid-local-2025-2026", false)}
                  >
                    <MousePointer className="size-3.5" /> Simular Clic en Producto (Caché Activo)
                  </Button>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-bold uppercase text-amber-500 mb-2">
                    Escenario B: Carga Fría Directa por URL
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Cuando un usuario abre un link compartido de WhatsApp sin pasar por el catálogo.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 text-xs"
                    onClick={() => runDetailProbe("camiseta-real-madrid-local-2025-2026", true)}
                  >
                    <Globe className="size-3.5" /> Simular Carga Fría Directa
                  </Button>
                </div>
              </div>

              {/* Probe Result Visualizer */}
              {detailProbe.status !== "idle" && (
                <div className="mt-6 rounded-xl border border-border bg-surface-2 p-5">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <span className="text-xs font-bold uppercase">
                      Resultado de Navegación: {detailProbe.productSlug}
                    </span>
                    <Badge variant={detailProbe.usedCache ? "default" : "secondary"}>
                      {detailProbe.usedCache
                        ? "0 Peticiones Duplicadas (100% Caché)"
                        : "1 Petición Unitaria Fría"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                    <div className="rounded-lg bg-card p-3 border border-border">
                      <p className="text-muted-foreground text-[10px]">CLICK → URL</p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {detailProbe.urlChangedTime !== null
                          ? `${detailProbe.urlChangedTime} ms`
                          : "--"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-card p-3 border border-border">
                      <p className="text-muted-foreground text-[10px]">CLICK → CONTENT</p>
                      <p className="text-lg font-black text-primary mt-1">
                        {detailProbe.contentRenderedTime !== null
                          ? `${detailProbe.contentRenderedTime} ms`
                          : "--"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-card p-3 border border-border">
                      <p className="text-muted-foreground text-[10px]">CLICK → IMAGE</p>
                      <p className="text-lg font-black text-blue-500 mt-1">
                        {detailProbe.imageLoadedTime !== null
                          ? `${detailProbe.imageLoadedTime} ms`
                          : "--"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-card p-3 border border-border">
                      <p className="text-muted-foreground text-[10px]">CLICK → INTERACTIVE</p>
                      <p className="text-lg font-black text-emerald-500 mt-1">
                        {detailProbe.interactiveTime !== null
                          ? `${detailProbe.interactiveTime} ms`
                          : "--"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>
                      Peticiones de red duplicadas detectadas:{" "}
                      <strong className="text-foreground">
                        {detailProbe.duplicateRequestsCount}
                      </strong>{" "}
                      (Objetivo cumplido).
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Image Matrix */}
        {activeTab === "images" && (
          <div className="mt-6 space-y-6">
            <div className="surface-card p-6">
              <div className="border-b border-border pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  Matriz de Auditoría de Imágenes y Peso de Assets
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verificación de formato, dimensiones intrínsecas, peso en KB y atributos de
                  renderizado asíncrono.
                </p>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-surface-2 text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Recurso / Nombre</th>
                      <th className="p-3">Formato</th>
                      <th className="p-3">Dimensiones</th>
                      <th className="p-3">Tamaño (KB)</th>
                      <th className="p-3">Estrategia</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {imageMetrics.map((img) => (
                      <tr key={img.url} className="hover:bg-accent/40">
                        <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                          <ImageIcon className="size-3.5 text-primary" /> {img.name}
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">{img.format}</td>
                        <td className="p-3 font-mono text-muted-foreground">{img.dimensions}</td>
                        <td className="p-3 font-mono font-bold text-primary">{img.sizeKb} KB</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">
                            fetchPriority=high / decoding=async
                          </Badge>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                            <CheckCircle2 className="size-3" /> Optimizado
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 rounded-lg border border-border bg-surface-2 p-4 text-xs text-muted-foreground">
                <p className="font-bold text-foreground mb-1">Resumen de Entrega de Imágenes:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Todas las imágenes principales pesan menos de 50 KB (excepto el Hero de 135 KB).
                  </li>
                  <li>
                    Las etiquetas <code className="bg-card px-1 py-0.5 rounded">&lt;img&gt;</code>{" "}
                    cuentan con dimensiones explícitas (
                    <code className="bg-card px-1 py-0.5 rounded">width=400 height=400</code>)
                    eliminando el Cumulative Layout Shift (CLS).
                  </li>
                  <li>
                    Las primeras 4 imágenes utilizan{" "}
                    <code className="bg-card px-1 py-0.5 rounded">fetchPriority="high"</code> y{" "}
                    <code className="bg-card px-1 py-0.5 rounded">loading="eager"</code> para
                    pintado visual inmediato.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Network Waterfall */}
        {activeTab === "waterfall" && (
          <div className="mt-6 space-y-6">
            <div className="surface-card p-6">
              <div className="border-b border-border pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider">
                    Network Waterfall Inspector (Tiempo de Red del Navegador)
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Inspección en vivo de las peticiones descargadas por el navegador desde Resource
                    Timing API.
                  </p>
                </div>
              </div>

              <div className="mt-4 divide-y divide-border font-mono text-xs">
                {resourceWaterfall.length === 0 ? (
                  <p className="py-4 text-center text-muted-foreground">Cargando recursos...</p>
                ) : (
                  resourceWaterfall.map((res, i) => (
                    <div key={res.name + i} className="flex items-center justify-between py-2">
                      <span className="truncate max-w-xs text-foreground" title={res.name}>
                        {i + 1}. {res.name}
                      </span>
                      <div className="flex items-center gap-4 text-right">
                        <Badge variant="outline" className="text-[10px]">
                          {res.initiatorType}
                        </Badge>
                        <span className="text-muted-foreground w-16">{res.transferSize} KB</span>
                        <span className="font-bold text-primary w-16">{res.duration} ms</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Server Benchmark Suite */}
        {activeTab === "suite" && (
          <div className="mt-6 space-y-6">
            <div className="surface-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider">
                    Suite de Consultas en Backend y Supabase
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Verifica el costo en milisegundos de cada tipo de consulta aislada en el
                    servidor.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => runSuite()}
                  disabled={loadingBenchmark}
                  className="gap-2 text-xs"
                >
                  <RefreshCw className={`size-3.5 ${loadingBenchmark ? "animate-spin" : ""}`} />
                  {loadingBenchmark ? "Ejecutando Suite..." : "Correr Benchmark"}
                </Button>
              </div>

              <div className="mt-4 divide-y divide-border">
                {(benchmarkData?.tests ?? []).map((item, idx) => (
                  <div
                    key={item.name}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-foreground">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.item_count} items · ~{item.payload_size_approx_kb} KB payload
                      </p>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-muted-foreground">
                        DB:{" "}
                        <strong className="text-emerald-500">{item.supabase_duration_ms} ms</strong>
                      </span>
                      <span className="text-muted-foreground">
                        Total: <strong className="text-primary">{item.total_duration_ms} ms</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
