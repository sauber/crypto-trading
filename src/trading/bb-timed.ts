import type { TradingStrategy } from "./types.ts";
import type { PositionState, SwapPlan } from "../engine/mod.ts";
import type { Kline } from "../kucoin/mod.ts";
import { rsi, bollingerBands, avgVolume } from "../indicators.ts";

export function BollingerTimed(config?: { rsiPeriod?: number; rsiOversold?: number; rsiOverbought?: number; bbPeriod?: number; bbStdDev?: number; volumeMin?: number; minConfidence?: number }): TradingStrategy {
  const rsiPeriod = config?.rsiPeriod ?? 14;
  const rsiOversold = config?.rsiOversold ?? 30;
  const rsiOverbought = config?.rsiOverbought ?? 70;
  const bbPeriod = config?.bbPeriod ?? 20;
  const bbStdDev = config?.bbStdDev ?? 2;
  const volumeMin = config?.volumeMin ?? 0.8;
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
      if (!k || k.length < Math.max(rsiPeriod, bbPeriod) + 10) continue;
      const closes = k.map((c) => c.close);
      const volumes = k.map((c) => c.volume);
      const rsiVals = rsi(closes, rsiPeriod);
      const latestRSI = rsiVals[rsiVals.length - 1];
      const bb = bollingerBands(closes, bbPeriod, bbStdDev);
      const bbIdx = closes.length - 1 - bb.offset;
      const latestClose = closes[closes.length - 1];
      const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, 20);

      if (latestRSI > rsiOverbought && latestClose > bb.upper[bbIdx] && volRatio > volumeMin) {
        swaps.push({
          sellSymbol: sell.symbol,
          buySymbol: "",
          reason: `${sell.reason} (RSI ${latestRSI.toFixed(0)} overbought, over BB)`,
        });
      } else if (rsiVals.length > 1) {
        const prevRSI = rsiVals[rsiVals.length - 2];
        if (prevRSI > rsiOverbought && latestRSI <= rsiOverbought) {
          swaps.push({
            sellSymbol: sell.symbol,
            buySymbol: "",
            reason: `${sell.reason} (RSI fell from overbought ${prevRSI.toFixed(0)}→${latestRSI.toFixed(0)})`,
          });
        }
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
      if (!k || k.length < Math.max(rsiPeriod, bbPeriod) + 10) continue;
      const closes = k.map((c) => c.close);
      const volumes = k.map((c) => c.volume);
      const rsiVals = rsi(closes, rsiPeriod);
      const latestRSI = rsiVals[rsiVals.length - 1];
      const bb = bollingerBands(closes, bbPeriod, bbStdDev);
      const bbIdx = closes.length - 1 - bb.offset;
      const latestClose = closes[closes.length - 1];
      const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, 20);

      if (latestRSI < rsiOversold && latestClose < bb.lower[bbIdx] && volRatio > volumeMin) {
        swaps.push({
          sellSymbol: "",
          buySymbol: buy.symbol,
          reason: `${buy.reason} (RSI ${latestRSI.toFixed(0)} oversold, below BB)`,
        });
        buysAdded++;
      }
    }

    return { swaps };
  };

  Object.defineProperty(strategy, "name", { value: "bb-timed" });
  return strategy;
}
