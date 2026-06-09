import type { Kline } from "../kucoin/mod.ts";

export interface CoinCandidate {
  symbol: string;
  score: number;
  reason: string;
}

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
