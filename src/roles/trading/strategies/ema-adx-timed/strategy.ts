import type { TradingStrategy } from "../../types.ts";
import type { PositionState, SwapPlan } from "../../../../engine/types.ts";
import type { Kline } from "../../../../kucoin/types.ts";
import { ema, adx, avgVolume } from "../../../../indicators.ts";

export class EmaAdxTimedTrading implements TradingStrategy {
  readonly name = "ema-adx-timed";
  readonly config: Record<string, number>;

  constructor(config: Record<string, number>) {
    this.config = config;
  }

  async plan(params: {
    wantToBuy: Array<{ symbol: string; confidence: number; reason: string }>;
    wantToSell: Array<{ symbol: string; reason: string }>;
    activePositions: PositionState[];
    prices: Map<string, number>;
    klines: Map<string, Kline[]>;
    maxPositions: number;
  }): Promise<SwapPlan> {
    const swaps: Array<{ sellSymbol: string; buySymbol: string; reason: string }> = [];
    const fEMA = this.config.fastEMA ?? 9;
    const sEMA = this.config.slowEMA ?? 21;
    const adxP = this.config.adxPeriod ?? 14;
    const adxThresh = this.config.adxThreshold ?? 25;
    const volMin = this.config.volumeMin ?? 0.8;
    const minConf = this.config.minConfidence ?? 50;

    for (const sell of params.wantToSell) {
      const k = params.klines.get(sell.symbol);
      if (!k || k.length < Math.max(sEMA, adxP) + 10) continue;
      const closes = k.map((c) => c.close);
      const highs = k.map((c) => c.high);
      const lows = k.map((c) => c.low);
      const volumes = k.map((c) => c.volume);

      const fast = ema(closes, fEMA);
      const slow = ema(closes, sEMA);
      const latestFast = fast[fast.length - 1];
      const latestSlow = slow[slow.length - 1];
      const prevFast = fast.length > 1 ? fast[fast.length - 2] : latestFast;
      const prevSlow = slow.length > 1 ? slow[slow.length - 2] : latestSlow;
      const adxVals = adx(highs, lows, closes, adxP);
      const latestADX = adxVals[adxVals.length - 1];
      const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, 20);
      const bearishCross = prevFast >= prevSlow && latestFast < latestSlow;

      if (bearishCross || latestADX < adxThresh) {
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
    const maxSlots = params.maxPositions - 1;
    const slotsLeft = maxSlots - held.size + params.wantToSell.length;

    let buysAdded = 0;
    for (const buy of params.wantToBuy) {
      if (buysAdded >= slotsLeft) break;
      if (held.has(buy.symbol)) continue;
      if (buy.confidence < minConf) continue;

      const k = params.klines.get(buy.symbol);
      if (!k || k.length < Math.max(sEMA, adxP) + 10) continue;
      const closes = k.map((c) => c.close);
      const highs = k.map((c) => c.high);
      const lows = k.map((c) => c.low);
      const volumes = k.map((c) => c.volume);

      const fast = ema(closes, fEMA);
      const slow = ema(closes, sEMA);
      const latestFast = fast[fast.length - 1];
      const latestSlow = slow[slow.length - 1];
      const prevFast = fast.length > 1 ? fast[fast.length - 2] : latestFast;
      const prevSlow = slow.length > 1 ? slow[slow.length - 2] : latestSlow;
      const adxVals = adx(highs, lows, closes, adxP);
      const latestADX = adxVals[adxVals.length - 1];
      const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, 20);
      const bullishCross = prevFast <= prevSlow && latestFast > latestSlow;

      if (bullishCross && latestADX > adxThresh && volRatio > volMin) {
        swaps.push({
          sellSymbol: "",
          buySymbol: buy.symbol,
          reason: `${buy.reason} (EMA bullish cross, ADX ${latestADX.toFixed(0)}, vol ${volRatio.toFixed(2)}x)`,
        });
        buysAdded++;
      }
    }

    return { swaps };
  }
}
