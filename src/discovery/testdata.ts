import type { DiscoveryStrategy, DiscoveryParams, CoinCandidate } from "./types.ts";

export function FileDiscovery(config?: { topN?: number }): DiscoveryStrategy {
  const topN = config?.topN ?? 20;

  const strategy = async (params?: DiscoveryParams): Promise<CoinCandidate[]> => {
    if (!params?.klines || params.klines.size === 0) return [];

    const { klines, barIndex } = params;
    const candidates: CoinCandidate[] = [];

    for (const [symbol, bars] of klines) {
      const idx = barIndex !== undefined ? barIndex : bars.length - 1;
      if (idx < 0 || idx >= bars.length) continue;
      const k = bars[idx];
      candidates.push({
        symbol,
        score: k.volume * k.close,
        reason: `liquidity=${(k.volume * k.close).toFixed(2)}`,
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, topN);
  };

  Object.defineProperty(strategy, "name", { value: "testdata" });
  return strategy;
}
