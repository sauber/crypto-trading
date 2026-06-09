import type { Strategy, StrategyResult } from "../types.ts";
import { ema, adx, avgVolume } from "../indicators.ts";
import type { StrategyConfig } from "./config.ts";

export class TrendFollowingStrategy implements Strategy {
  readonly name = "trend-following";

  constructor(private cfg: StrategyConfig) {}

  analyze(_symbol: string, closes: number[], highs: number[], lows: number[], volumes: number[]): StrategyResult {
    const { fastEMA, slowEMA, adxPeriod, adxThreshold, volumeMin } = this.cfg;

    if (closes.length < Math.max(slowEMA, adxPeriod) + 10) {
      return { signal: "hold", confidence: 0, reason: "Utilstrækkelig data" };
    }

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
    const bearishCross = prevFast >= prevSlow && latestFast < latestSlow;

    if (bullishCross && latestADX > adxThreshold && volRatio > volumeMin) {
      return {
        signal: "buy", confidence: 70,
        reason: `EMA ${fastEMA}/${slowEMA} bullish cross, ADX ${latestADX.toFixed(0)}`,
      };
    }

    if (bearishCross || latestADX < adxThreshold) {
      const reason = bearishCross
        ? `EMA ${fastEMA}/${slowEMA} bearish cross`
        : `ADX faldt til ${latestADX.toFixed(0)} (svag trend)`;
      return { signal: "sell", confidence: bearishCross ? 65 : 40, reason };
    }

    if (latestFast > latestSlow && latestADX > adxThreshold) {
      return {
        signal: "buy", confidence: 45,
        reason: `I trend, EMA ${fastEMA}(${latestFast.toFixed(2)}) > EMA ${slowEMA}(${latestSlow.toFixed(2)})`,
      };
    }

    return { signal: "hold", confidence: 0, reason: "Ingen signal" };
  }
}
