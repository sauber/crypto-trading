import type { TradingStrategy } from "./types.ts";
import type { PositionState, SwapPlan } from "../engine/mod.ts";
import type { Kline } from "../kucoin/mod.ts";
import { macd, avgVolume } from "../indicators.ts";

export function MacdTimed(config?: { fastPeriod?: number; slowPeriod?: number; signalPeriod?: number; volumeThreshold?: number; minConfidence?: number }): TradingStrategy {
  const fastPeriod = config?.fastPeriod ?? 12;
  const slowPeriod = config?.slowPeriod ?? 26;
  const signalPeriod = config?.signalPeriod ?? 9;
  const volumeThreshold = config?.volumeThreshold ?? 1.2;
  const minConfidence = config?.minConfidence ?? 50;

  const strategy = (params: {
    wantToBuy: Array<{ symbol: string; confidence: number; reason: string }>;
    wantToSell: Array<{ symbol: string; reason: string }>;
    activePositions: PositionState[];
    prices: Map<string, number>;
    klines: Map<string, Kline[]>;
    targetPositions: number;
  }): SwapPlan => {
    const swaps: Array<{ sellSymbol: string; buySymbol: string; reason: string }> = [];

    for (const sell of params.wantToSell) {
      const k = params.klines.get(sell.symbol);
      if (!k || k.length < slowPeriod + signalPeriod) continue;
      const closes = k.map((c) => c.close);
      const volumes = k.map((c) => c.volume);
      const { histogram } = macd(closes, fastPeriod, slowPeriod, signalPeriod);
      const latestHist = histogram[histogram.length - 1];
      const prevHist = histogram[histogram.length - 2];
      const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, slowPeriod);

      if (prevHist >= 0 && latestHist < 0) {
        swaps.push({
          sellSymbol: sell.symbol,
          buySymbol: "",
          reason: `${sell.reason} (MACD bearish cross, vol ${volRatio.toFixed(2)}x)`,
        });
      }
    }

    const held = new Set(params.activePositions.map((p) => p.symbol));
    const slotsLeft = params.targetPositions - held.size + params.wantToSell.length;

    let buysAdded = 0;
    for (const buy of params.wantToBuy) {
      if (buysAdded >= slotsLeft) break;
      if (held.has(buy.symbol)) continue;
      if (buy.confidence < minConfidence) continue;

      const k = params.klines.get(buy.symbol);
      if (!k || k.length < slowPeriod + signalPeriod) continue;
      const closes = k.map((c) => c.close);
      const volumes = k.map((c) => c.volume);
      const { histogram } = macd(closes, fastPeriod, slowPeriod, signalPeriod);
      const latestHist = histogram[histogram.length - 1];
      const prevHist = histogram[histogram.length - 2];
      const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, slowPeriod);

      if (prevHist <= 0 && latestHist > 0) {
        swaps.push({
          sellSymbol: "",
          buySymbol: buy.symbol,
          reason: `${buy.reason} (MACD bullish cross, vol ${volRatio.toFixed(2)}x)`,
        });
        buysAdded++;
      }
    }

    return { swaps };
  };

  Object.defineProperty(strategy, "name", { value: "macd-timed" });
  return strategy;
}
