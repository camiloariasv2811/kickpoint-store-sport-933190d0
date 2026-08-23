import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  getMinimalProducts,
  runDiagnosticsBenchmark,
  type BenchmarkResult,
} from "@/lib/catalog.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";

export const Route = createFileRoute("/test-diagnostico")({
  component: TestDiagnostico,
});

export default function TestDiagnostico() {
  const [routeStart] = useState(() => performance.now());
  const [firstReceivedTime, setFirstReceivedTime] = useState<number | null>(null);
  const [firstRenderedTime, setFirstRenderedTime] = useState<number | null>(null);
  const [allRenderedTime, setAllRenderedTime] = useState<number | null>(null);
  const [hideImages, setHideImages] = useState(false);
  const firstItemRef = useRef<HTMLDivElement | null>(null);
  const lastItemRef = useRef<HTMLDivElement | null>(null);

  // Minimal Query Test
  const {
    data: minimalRes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["benchmark-minimal"],
    queryFn: async () => {
      const res = await getMinimalProducts();
      return res;
    },
  });

  const products = useMemo(() => minimalRes?.items ?? [], [minimalRes]);
  const serverMetrics = minimalRes?.metrics;

  useEffect(() => {
    if (products.length > 0 && firstReceivedTime === null) {
      setFirstReceivedTime(performance.now() - routeStart);
    }
  }, [products, routeStart, firstReceivedTime]);

  useEffect(() => {
    if (products.length > 0) {
      // Measure when DOM elements have been rendered
      requestAnimationFrame(() => {
        if (firstItemRef.current && firstRenderedTime === null) {
          setFirstRenderedTime(performance.now() - routeStart);
        }
        if (lastItemRef.current && allRenderedTime === null) {
          setAllRenderedTime(performance.now() - routeStart);
        }
      });
    }
  }, [products, routeStart, firstRenderedTime, allRenderedTime]);

  // Full Server Benchmark Suite
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
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="border-b border-border pb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Diagnóstico Interno
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Prueba de Rendimiento y Medición en Vivo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Medición milimétrica de Supabase, Servidor, Red, Render y Tiempo al Primer Producto.
          </p>
        </div>

        {/* Real-time Client & Server Metrics Card */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              ⏱️ Métricas del Cliente (Navegador / Móvil)
            </h2>
            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground">ROUTE_START:</span>
                <span>0 ms (inicio)</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground">FIRST_PRODUCT_RECEIVED:</span>
                <span className="font-semibold text-blue-500">
                  {firstReceivedTime !== null
                    ? `${Math.round(firstReceivedTime)} ms`
                    : "Cargando..."}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground">FIRST_PRODUCT_RENDERED:</span>
                <span className="font-semibold text-emerald-500">
                  {firstRenderedTime !== null
                    ? `${Math.round(firstRenderedTime)} ms`
                    : "Esperando..."}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground">ALL_PRODUCTS_RENDERED:</span>
                <span className="font-semibold text-amber-500">
                  {allRenderedTime !== null ? `${Math.round(allRenderedTime)} ms` : "Esperando..."}
                </span>
              </div>
              <div className="mt-3 rounded-lg bg-primary/10 p-3 text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-sans">
                  Tiempo al Primer Producto (TTFP)
                </p>
                <p className="text-2xl font-black text-primary font-sans mt-0.5">
                  {firstRenderedTime !== null ? `${Math.round(firstRenderedTime)} ms` : "--"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              ⚡ Métricas del Servidor
            </h2>
            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground">SUPABASE_DURATION:</span>
                <span className="font-semibold text-emerald-500">
                  {serverMetrics ? `${serverMetrics.supabase_duration_ms} ms` : "--"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground">TRANSFORM_DURATION:</span>
                <span className="font-semibold text-blue-500">
                  {serverMetrics ? `${serverMetrics.transform_duration_ms} ms` : "--"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground">TOTAL_SERVER_DURATION:</span>
                <span className="font-semibold text-primary">
                  {serverMetrics ? `${serverMetrics.total_duration_ms} ms` : "--"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground">ITEMS_COUNT:</span>
                <span>{serverMetrics ? `${serverMetrics.items_count} productos` : "--"}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setFirstReceivedTime(null);
                    setFirstRenderedTime(null);
                    setAllRenderedTime(null);
                    refetch();
                  }}
                >
                  Re-ejecutar Consulta
                </Button>
                <Button
                  size="sm"
                  variant={hideImages ? "primary" : "secondary"}
                  className="flex-1 text-xs"
                  onClick={() => setHideImages(!hideImages)}
                >
                  {hideImages ? "Ver con Imágenes (Test B)" : "Ocultar Imágenes (Test A)"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Benchmark Suite Breakdown */}
        <div className="mt-8 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold">Suite de Pruebas Comparativas</h2>
              <p className="text-xs text-muted-foreground">
                Compara el impacto de joins, variantes, marcas, categorías e imágenes en Supabase y
                Servidor.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => runSuite()}
              disabled={loadingBenchmark}
              className="text-xs"
            >
              {loadingBenchmark ? "Ejecutando suite..." : "Ejecutar Benchmark Completo"}
            </Button>
          </div>

          {benchmarkData && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-4 font-semibold">Prueba</th>
                    <th className="py-2 px-3 font-semibold">Supabase</th>
                    <th className="py-2 px-3 font-semibold">Transformación</th>
                    <th className="py-2 px-3 font-semibold">Total Servidor</th>
                    <th className="py-2 px-3 font-semibold">Items</th>
                    <th className="py-2 pl-3 font-semibold">Payload aprox.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {benchmarkData.tests.map((t: BenchmarkResult, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="py-2.5 pr-4 font-sans font-medium text-foreground">
                        {t.name}
                      </td>
                      <td className="py-2.5 px-3 text-emerald-500 font-semibold">
                        {t.supabase_duration_ms} ms
                      </td>
                      <td className="py-2.5 px-3 text-blue-500">{t.transform_duration_ms} ms</td>
                      <td className="py-2.5 px-3 text-primary font-bold">
                        {t.total_duration_ms} ms
                      </td>
                      <td className="py-2.5 px-3">{t.item_count}</td>
                      <td className="py-2.5 pl-3 text-muted-foreground">
                        {t.payload_size_approx_kb} KB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Minimal Render Grid */}
        <div className="mt-8">
          <h2 className="text-base font-bold">Render Mínimo de Productos ({products.length})</h2>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
              ))}
            {!isLoading &&
              products.map((p, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === products.length - 1;
                return (
                  <div
                    key={p.id}
                    ref={isFirst ? firstItemRef : isLast ? lastItemRef : undefined}
                    className="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col"
                  >
                    {!hideImages && p.main_image ? (
                      <img
                        src={p.main_image}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        className="aspect-square w-full rounded-lg object-cover bg-surface-2"
                      />
                    ) : (
                      <div className="aspect-square w-full rounded-lg bg-surface-2 flex items-center justify-center text-xs text-muted-foreground">
                        {hideImages ? "IMG OCULTA" : "SIN IMG"}
                      </div>
                    )}
                    <h3 className="mt-2 text-xs font-semibold line-clamp-2">{p.name}</h3>
                    <p className="mt-auto pt-2 text-xs font-bold text-primary">
                      {money(p.retail_price)}
                    </p>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
