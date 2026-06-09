import type { Strategy, StrategyResult } from "../types.ts";
import { macd, avgVolume } from "../indicators.ts";

export interface StrategyConfig {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  volumeThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  minCandles: number;
  initialCapital: number;
}

export class MomentumStrategy implements Strategy {
  readonly name = "momentum";

  constructor(private cfg: StrategyConfig) {}

  analyze(_symbol: string, closes: number[], _highs: number[], _lows: number[], volumes: number[]): StrategyResult {
    const { fastPeriod, slowPeriod, signalPeriod, volumeThreshold } = this.cfg;
    const minCandles = slowPeriod + signalPeriod;
    if (closes.length < minCandles) {
      return { signal: "hold", confidence: 0, reason: "Utilstrækkelig data" };
    }
    const { histogram, macdLine, signalLine } = macd(closes, fastPeriod, slowPeriod, signalPeriod);
    const latestMACD = macdLine[macdLine.length - 1];
    const latestSignal = signalLine[signalLine.length - 1];
    const prevHist = histogram[histogram.length - 2];
    const latestHist = histogram[histogram.length - 1];
    const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, slowPeriod);

    if (prevHist <= 0 && latestHist > 0 && volRatio > volumeThreshold) {
      let conf = 60;
      if (volRatio > 1.5) conf += 15;
      if (latestMACD > 0) conf += 10;
      if (closes[closes.length - 1] > closes[closes.length - 2]) conf += 5;
      return { signal: "buy", confidence: Math.min(conf, 100), reason: `MACD bullish cross, vol ${volRatio.toFixed(2)}x` };
    }

    if (prevHist >= 0 && latestHist < 0) {
      return { signal: "sell", confidence: 60, reason: `MACD bearish cross, vol ${volRatio.toFixed(2)}x` };
    }

    if (latestMACD > latestSignal && volRatio > volumeThreshold * 1.2) {
      return { signal: "buy", confidence: 40, reason: `MACD over signal, vol ${volRatio.toFixed(2)}x` };
    }

    return { signal: "hold", confidence: 0, reason: "Ingen signal" };
  }
}
