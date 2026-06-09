import type { DiscoveryStrategy, DiscoveryParams, CoinCandidate } from "./types.ts";
import type { KucoinClient } from "../kucoin/mod.ts";

const CANDIDATE_POOL = 50;
const FETCH_INTERVAL = "1hour";
const FETCH_RANGE_MS = 86400000;

export function KucoinDiscovery(config: { topN: number }, client: KucoinClient): DiscoveryStrategy {
  const { topN } = config;

  const strategy = async (_params?: DiscoveryParams): Promise<CoinCandidate[]> => {
    const pool = await client.getTopVolumeSymbols(CANDIDATE_POOL);
    const now = Date.now();
    const candidates: CoinCandidate[] = [];

    for (const s of pool) {
      try {
        const klines = await client.getKlines(s.symbol, FETCH_INTERVAL, now - FETCH_RANGE_MS, now);
        if (klines.length === 0) continue;
        const last = klines[klines.length - 1];
        const liquidity = last.volume * last.close;
        candidates.push({
          symbol: s.symbol,
          score: liquidity,
          reason: `liquidity=${liquidity.toFixed(2)} (volume*close)`,
        });
      } catch {
        // skip failed kline fetches
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, topN);
  };

  Object.defineProperty(strategy, "name", { value: "kucoin" });
  return strategy;
}
