import type { DiscoveryStrategy, CoinCandidate } from "../types.ts";
import type { KucoinClient } from "../../kucoin/client.ts";

export const config = {
  topN: 20,
  name: "top-volume",
};

export class TopVolumeDiscovery implements DiscoveryStrategy {
  readonly name = "top-volume";

  async discover(client: KucoinClient): Promise<CoinCandidate[]> {
    const rankings = await client.getTopVolumeSymbols(config.topN);
    return rankings.map((r) => ({
      symbol: r.symbol,
      score: r.volume24h,
      reason: `24h volume ${r.volume24h}`,
    }));
  }
}
