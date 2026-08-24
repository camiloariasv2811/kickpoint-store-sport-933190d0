// Server-only helper: fetches the current Venezuelan USD rates (BCV official) and
// the live USDT price from Binance P2P (VES market), storing them in the store settings.
const RATES_SOURCE_URL = "https://ve.dolarapi.com/v1/dolares";
const BINANCE_P2P_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

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

// Primary source: CriptoYa aggregates the live Binance P2P USDT/VES book and is
// reachable from the edge runtime (Binance blocks some datacenter IPs).
async function fetchCriptoYaUsdtRate(): Promise<number | null> {
  try {
    const response = await fetch(CRIPTOYA_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`CriptoYa respondió ${response.status}`);
    const json = (await response.json()) as Record<string, { ask?: number; bid?: number }>;
    const p2p = json["binancep2p"];
    const candidates = [p2p?.ask, p2p?.bid].map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (candidates.length === 0) return null;
    const avg = candidates.reduce((a, b) => a + b, 0) / candidates.length;
    return Number(avg.toFixed(4));
  } catch (err) {
    console.warn(
      "[refreshExchangeRates] CriptoYa failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// Average of the best (highest) Binance P2P sell offers for USDT/VES.
async function fetchBinanceUsdtRate(): Promise<number | null> {
  try {
    const response = await fetch(BINANCE_P2P_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      body: JSON.stringify({
        page: 1,
        rows: 20,
        asset: "USDT",
        fiat: "VES",
        tradeType: "SELL",
        payTypes: [],
        transAmount: "1000",
      }),
    });
    if (!response.ok) throw new Error(`Binance P2P respondió ${response.status}`);
    const json = (await response.json()) as { data?: Array<{ adv?: { price?: string } }> };
    const prices = (json.data ?? [])
      .map((item) => Number(item.adv?.price))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => b - a)
      .slice(0, 5);
    if (prices.length === 0) return null;
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return Number(avg.toFixed(4));
  } catch (err) {
    console.warn(
      "[refreshExchangeRates] Binance P2P failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}



export async function refreshExchangeRates(): Promise<RateRefreshResult> {
  const fetchedAt = new Date().toISOString();

  const [officialResult, binanceUsdt] = await Promise.all([
    (async (): Promise<DolarApiEntry[]> => {
      try {
        const response = await fetch(RATES_SOURCE_URL, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`Fuente de tasas respondió ${response.status}`);
        return (await response.json()) as DolarApiEntry[];
      } catch (err) {
        console.warn(
          "[refreshExchangeRates] dolarapi failed:",
          err instanceof Error ? err.message : err,
        );
        return [];
      }
    })(),
    fetchBinanceUsdtRate(),
  ]);

  const bcv = pickRate(officialResult.find((entry) => entry.fuente === "oficial"));
  // USDT: live Binance P2P median; fallback to the parallel reference if Binance is unreachable.
  const usdt = binanceUsdt ?? pickRate(officialResult.find((entry) => entry.fuente === "paralelo"));
  const usdtSource = binanceUsdt ? "binance-p2p (USDT/VES)" : RATES_SOURCE_URL;

  if (!bcv && !usdt) {
    return {
      ok: false,
      updated: false,
      bcv: null,
      usdt: null,
      source: usdtSource,
      fetchedAt,
      error: "Las fuentes no devolvieron tasas válidas",
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
      exchange_rates_auto_source: usdtSource,
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
      source: usdtSource,
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
