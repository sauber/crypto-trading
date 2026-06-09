import type { TradingStrategy, TradingConfig } from "./types.ts";
import type { PositionState, SwapPlan } from "../engine/mod.ts";
import type { Kline } from "../kucoin/mod.ts";
import { rsi } from "../indicators.ts";

export class RsiTimedTrading implements TradingStrategy {
  readonly name = "rsi-timed";
  readonly config: TradingConfig;

  constructor(config: TradingConfig) {
    this.config = config;
  }

  async plan(params: {
    wantToBuy: Array<{ symbol: string; confidence: number; reason: string }>;
    wantToSell: Array<{ symbol: string; reason: string }>;
    activePositions: PositionState[];
    prices: Map<string, number>;
    klines: Map<string, Kline[]>;
    targetPositions: number;
  }): Promise<SwapPlan> {
    const swaps: Array<{ sellSymbol: string; buySymbol: string; reason: string }> = [];

    for (const sell of params.wantToSell) {
      const k = params.klines.get(sell.symbol);
      if (!k || k.length < this.config.rsiPeriod + 1) continue;
      const closes = k.map((c) => c.close);
      const rsiVals = rsi(closes, this.config.rsiPeriod);
      const lastRSI = rsiVals[rsiVals.length - 1];
      if (lastRSI > this.config.rsiOverbought || lastRSI < this.config.rsiOversold) {
        swaps.push({
          sellSymbol: sell.symbol,
          buySymbol: "",
          reason: `${sell.reason} (RSI ${lastRSI.toFixed(0)})`,
        });
      }
    }

    const held = new Set(params.activePositions.map((p) => p.symbol));
    const slotsLeft = params.targetPositions - held.size + params.wantToSell.length;

    let buysAdded = 0;
    for (const buy of params.wantToBuy) {
      if (buysAdded >= slotsLeft) break;
      if (held.has(buy.symbol)) continue;
      if (buy.confidence < this.config.minConfidence) continue;

      const k = params.klines.get(buy.symbol);
      if (!k || k.length < this.config.rsiPeriod + 1) continue;
      const closes = k.map((c) => c.close);
      const rsiVals = rsi(closes, this.config.rsiPeriod);
      const lastRSI = rsiVals[rsiVals.length - 1];
      if (lastRSI < this.config.rsiOversold) {
        swaps.push({
          sellSymbol: "",
          buySymbol: buy.symbol,
          reason: `${buy.reason} (RSI ${lastRSI.toFixed(0)})`,
        });
        buysAdded++;
      }
    }

    return { swaps };
  }
}
