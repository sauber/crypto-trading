import type { PositionState, SwapPlan } from "../engine/mod.ts";
import type { Kline } from "../kucoin/mod.ts";

export type TradingConfig = Record<string, number>;

export interface TradingStrategy {
  (params: {
    wantToBuy: Array<{ symbol: string; confidence: number; reason: string }>;
    wantToSell: Array<{ symbol: string; reason: string }>;
    activePositions: PositionState[];
    prices: Map<string, number>;
    klines: Map<string, Kline[]>;
    targetPositions: number;
  }): SwapPlan;
  readonly name: string;
}
