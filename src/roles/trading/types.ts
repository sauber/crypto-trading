import type { PositionState, SwapPlan, Swap } from "../../engine/types.ts";
import type { Kline } from "../../kucoin/types.ts";

export type TradingConfig = Record<string, number>;

export interface TradingStrategy {
  readonly name: string;
  readonly config: TradingConfig;
  plan(params: {
    wantToBuy: Array<{ symbol: string; confidence: number; reason: string }>;
    wantToSell: Array<{ symbol: string; reason: string }>;
    activePositions: PositionState[];
    prices: Map<string, number>;
    klines: Map<string, Kline[]>;
    targetPositions: number;
  }): Promise<SwapPlan>;
}
