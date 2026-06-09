import type { Strategy, StrategyResult } from "../types.ts";
import { rsi, bollingerBands, avgVolume } from "../indicators.ts";
import type { StrategyConfig } from "./config.ts";

export class MeanReversionStrategy implements Strategy {
  readonly name = "mean-reversion";

  constructor(private cfg: StrategyConfig) {}

  analyze(_symbol: string, closes: number[], _highs: number[], _lows: number[], volumes: number[]): StrategyResult {
    const { rsiPeriod, rsiOversold, rsiOverbought, bbPeriod, bbStdDev, volumeMin } = this.cfg;

    if (closes.length < Math.max(rsiPeriod, bbPeriod) + 10) {
      return { signal: "hold", confidence: 0, reason: "Utilstrækkelig data" };
    }

    const rsiVals = rsi(closes, rsiPeriod);
    const latestRSI = rsiVals[rsiVals.length - 1];
    const prevRSI = rsiVals.length > 1 ? rsiVals[rsiVals.length - 2] : latestRSI;

    const bb = bollingerBands(closes, bbPeriod, bbStdDev);
    const bbIdx = closes.length - 1 - bb.offset;
    const latestClose = closes[closes.length - 1];
    const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, 20);

    if (latestRSI < rsiOversold && latestClose < bb.lower[bbIdx] && volRatio > volumeMin) {
      return {
        signal: "buy", confidence: 65,
        reason: `RSI ${latestRSI.toFixed(0)} oversolgt, pris under BB`,
      };
    }

    if (latestRSI > rsiOverbought && latestClose > bb.upper[bbIdx] && volRatio > volumeMin) {
      return {
        signal: "sell", confidence: 65,
        reason: `RSI ${latestRSI.toFixed(0)} overkøbt, pris over BB`,
      };
    }

    if (prevRSI > rsiOverbought && latestRSI <= rsiOverbought) {
      return {
        signal: "sell", confidence: 45,
        reason: `RSI faldt fra overkøbt (${prevRSI.toFixed(0)}→${latestRSI.toFixed(0)})`,
      };
    }

    if (prevRSI < rsiOversold && latestRSI >= rsiOversold) {
      return {
        signal: "sell", confidence: 40,
        reason: `RSI steg fra oversolgt (${prevRSI.toFixed(0)}→${latestRSI.toFixed(0)})`,
      };
    }

    return { signal: "hold", confidence: 0, reason: "Ingen signal" };
  }
}
