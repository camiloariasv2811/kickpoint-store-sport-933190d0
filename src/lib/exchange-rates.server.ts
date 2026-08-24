// Server-only helper: fetches the current Venezuelan USD rates (BCV official and
// parallel/USDT) from a public source and stores them in the store settings.
const RATES_SOURCE_URL = "https://ve.dolarapi.com/v1/dolares";

export type RateRefreshResult = {
  ok: boolean;
  updated: boolean;
  bcv: number | null;
  usdt: number | null;
  source: string;
  fetchedAt: string;
  error?: string;
};

type DolarApiEntry = {
  fuente?: string;
  promedio?: number | null;
  venta?: number | null;
  compra?: number | null;
  fechaActualizacion?: string;
};

function pickRate(entry: DolarApiEntry | undefined): number | null {
  if (!entry) return null;
  const value = Number(entry.promedio ?? entry.venta ?? entry.compra ?? 0);
  return Number.isFinite(value) && value > 0 ? Number(value.toFixed(4)) : null;
}

export async function refreshExchangeRates(): Promise<RateRefreshResult> {
  const fetchedAt = new Date().toISOString();
  let payload: DolarApiEntry[] = [];

  try {
    const response = await fetch(RATES_SOURCE_URL, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Fuente de tasas respondió ${response.status}`);
    }
    payload = (await response.json()) as DolarApiEntry[];
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error consultando la fuente de tasas";
    console.warn("[refreshExchangeRates] fetch failed:", message);
    return {
      ok: false,
      updated: false,
      bcv: null,
      usdt: null,
      source: RATES_SOURCE_URL,
      fetchedAt,
      error: message,
    };
  }

  const bcv = pickRate(payload.find((entry) => entry.fuente === "oficial"));
  const usdt = pickRate(payload.find((entry) => entry.fuente === "paralelo"));

  if (!bcv && !usdt) {
    return {
      ok: false,
      updated: false,
      bcv: null,
      usdt: null,
      source: RATES_SOURCE_URL,
      fetchedAt,
      error: "La fuente no devolvió tasas válidas",
    };
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin
      .from("settings")
      .select("value")
      .eq("key", "store")
      .maybeSingle();

    const previous = (current?.value ?? {}) as Record<string, unknown>;
    const nextValue = {
      ...previous,
      ...(bcv ? { exchange_rate_bcv: bcv, exchange_rate_bs: bcv } : {}),
      ...(usdt ? { exchange_rate_usdt: usdt } : {}),
      exchange_rates_auto_source: RATES_SOURCE_URL,
      exchange_rates_updated_at: fetchedAt,
    };

    const { error } = await supabaseAdmin
      .from("settings")
      .upsert({ key: "store", value: nextValue, updated_at: fetchedAt });

    if (error) throw new Error(error.message);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error guardando las tasas";
    console.warn("[refreshExchangeRates] persist failed:", message);
    return {
      ok: false,
      updated: false,
      bcv,
      usdt,
      source: RATES_SOURCE_URL,
      fetchedAt,
      error: message,
    };
  }

  return {
    ok: true,
    updated: true,
    bcv,
    usdt,
    source: RATES_SOURCE_URL,
    fetchedAt,
  };
}
