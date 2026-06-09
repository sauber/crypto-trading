import type { TradingStrategy } from "./types.ts";
import type { PositionState, SwapPlan } from "../engine/mod.ts";
import type { Kline } from "../kucoin/mod.ts";
import { ema, adx, avgVolume } from "../indicators.ts";

export function EmaAdxTimed(config?: { fastEMA?: number; slowEMA?: number; adxPeriod?: number; adxThreshold?: number; volumeMin?: number; minConfidence?: number }): TradingStrategy {
  const fastEMA = config?.fastEMA ?? 9;
  const slowEMA = config?.slowEMA ?? 21;
  const adxPeriod = config?.adxPeriod ?? 14;
  const adxThreshold = config?.adxThreshold ?? 25;
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
      if (!k || k.length < Math.max(slowEMA, adxPeriod) + 10) continue;
      const closes = k.map((c) => c.close);
      const highs = k.map((c) => c.high);
      const lows = k.map((c) => c.low);
      const volumes = k.map((c) => c.volume);

      const fast = ema(closes, fastEMA);
      const slow = ema(closes, slowEMA);
      const latestFast = fast[fast.length - 1];
      const latestSlow = slow[slow.length - 1];
      const prevFast = fast.length > 1 ? fast[fast.length - 2] : latestFast;
      const prevSlow = slow.length > 1 ? slow[slow.length - 2] : latestSlow;
      const adxVals = adx(highs, lows, closes, adxPeriod);
      const latestADX = adxVals[adxVals.length - 1];
      const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, 20);
      const bearishCross = prevFast >= prevSlow && latestFast < latestSlow;

      if (bearishCross || latestADX < adxThreshold) {
        const reason = bearishCross
          ? `EMA bearish cross, ADX ${latestADX.toFixed(0)}`
          : `ADX ${latestADX.toFixed(0)} below threshold`;
        swaps.push({
          sellSymbol: sell.symbol,
          buySymbol: "",
          reason: `${sell.reason} (${reason}, vol ${volRatio.toFixed(2)}x)`,
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
      if (!k || k.length < Math.max(slowEMA, adxPeriod) + 10) continue;
      const closes = k.map((c) => c.close);
      const highs = k.map((c) => c.high);
      const lows = k.map((c) => c.low);
      const volumes = k.map((c) => c.volume);

      const fast = ema(closes, fastEMA);
      const slow = ema(closes, slowEMA);
      const latestFast = fast[fast.length - 1];
      const latestSlow = slow[slow.length - 1];
      const prevFast = fast.length > 1 ? fast[fast.length - 2] : latestFast;
      const prevSlow = slow.length > 1 ? slow[slow.length - 2] : latestSlow;
      const adxVals = adx(highs, lows, closes, adxPeriod);
      const latestADX = adxVals[adxVals.length - 1];
      const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, 20);
      const bullishCross = prevFast <= prevSlow && latestFast > latestSlow;

      if (bullishCross && latestADX > adxThreshold && volRatio > volumeMin) {
        swaps.push({
          sellSymbol: "",
          buySymbol: buy.symbol,
          reason: `${buy.reason} (EMA bullish cross, ADX ${latestADX.toFixed(0)}, vol ${volRatio.toFixed(2)}x)`,
        });
        buysAdded++;
      }
    }

    return { swaps };
  };

  Object.defineProperty(strategy, "name", { value: "ema-adx-timed" });
  return strategy;
}
