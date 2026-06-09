import type { PositionState, PortfolioDecision } from "../../engine/types.ts";
import type { CoinCandidate } from "../types.ts";
import type { KucoinClient } from "../../kucoin/client.ts";

export interface PortfolioConfig {
  targetPositions: number;
  allocationMethod: "equal" | "weighted";
}

export interface PortfolioStrategy {
  readonly name: string;
  readonly config: PortfolioConfig;
  analyze(params: {
    candidates: CoinCandidate[];
    activePositions: PositionState[];
    prices: Map<string, number>;
    client: KucoinClient;
    interval: string;
    candleRangeMs: number;
  }): Promise<PortfolioDecision>;
}
