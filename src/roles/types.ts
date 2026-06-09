import type { KucoinClient } from "../kucoin/client.ts";

export interface DiscoveryStrategy {
  readonly name: string;
  discover(client: KucoinClient): Promise<CoinCandidate[]>;
}

export interface CoinCandidate {
  symbol: string;
  score: number;
  reason: string;
}
