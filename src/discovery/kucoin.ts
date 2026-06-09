import type { DiscoveryStrategy, DiscoveryConfig, DiscoveryParams, CoinCandidate } from "./types.ts";
import type { KucoinClient } from "../kucoin/mod.ts";

const CANDIDATE_POOL = 50;
const FETCH_INTERVAL = "1hour";
const FETCH_RANGE_MS = 86400000;

export class KucoinDiscovery implements DiscoveryStrategy {
  readonly name = "kucoin";
  readonly config: DiscoveryConfig;
  private client: KucoinClient;

  constructor(config: DiscoveryConfig, client: KucoinClient) {
    this.config = config;
    this.client = client;
  }

  async discover(_params?: DiscoveryParams): Promise<CoinCandidate[]> {
    const pool = await this.client.getTopVolumeSymbols(CANDIDATE_POOL);
    const now = Date.now();
    const candidates: CoinCandidate[] = [];

    for (const s of pool) {
      try {
        const klines = await this.client.getKlines(s.symbol, FETCH_INTERVAL, now - FETCH_RANGE_MS, now);
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
    return candidates.slice(0, this.config.topN);
  }
}
