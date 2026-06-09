import type { Kline } from "../kucoin/types.ts";
import type { CoinCandidate } from "../roles/types.ts";

export interface DiscoveryConfig {
  topN: number;
}

export interface DiscoveryParams {
  klines?: Map<string, Kline[]>;
  barIndex?: number;
}

export interface DiscoveryStrategy {
  readonly name: string;
  readonly config: DiscoveryConfig;
  discover(params?: DiscoveryParams): Promise<CoinCandidate[]>;
}
