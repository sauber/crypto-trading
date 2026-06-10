import type { KucoinClient, Kline } from "../kucoin/mod.ts";
import { buildRankedInstruments, RankedInstrument } from "../market/mod.ts";

const INTERVAL_MS: Record<string, number> = {
  "1min": 60000,
  "3min": 180000,
  "5min": 300000,
  "15min": 900000,
  "30min": 1800000,
  "1hour": 3600000,
  "2hour": 7200000,
  "4hour": 14400000,
  "6hour": 21600000,
  "8hour": 28800000,
  "12hour": 43200000,
  "1day": 86400000,
  "1week": 604800000,
};

export interface DiscoveryConfig {
  poolSize?: number;
  interval?: string;
  lookback?: number;
}

export function KucoinDiscovery(
  config: DiscoveryConfig,
  client: KucoinClient,
): () => Promise<RankedInstrument[]> {
  const { poolSize = 50, interval = "1hour", lookback = 24 } = config;
  const rangeMs = lookback * (INTERVAL_MS[interval] ?? 3600000);

  const strategy = async (): Promise<RankedInstrument[]> => {
    const pool = await client.getTopVolumeSymbols(poolSize);
    const now = Date.now();
    const klines = new Map<string, Kline[]>();
    const symbols: string[] = [];

    for (const s of pool) {
      try {
        const k = await client.getKlines(s.symbol, interval, now - rangeMs, now);
        if (k.length === 0) continue;
        k.sort((a, b) => a.timestamp - b.timestamp);
        klines.set(s.symbol, k);
        symbols.push(s.symbol);
      } catch {
        // skip failed kline fetches
      }
    }

    if (symbols.length === 0) return [];

    return buildRankedInstruments(klines, symbols);
  };

  Object.defineProperty(strategy, "name", { value: "kucoin" });
  return strategy;
}
