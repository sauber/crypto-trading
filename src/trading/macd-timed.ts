import type { TradingStrategy } from "./types.ts";
import type { PositionState, SwapPlan } from "../engine/mod.ts";
import type { Kline } from "../kucoin/mod.ts";
import { macd, avgVolume } from "../indicators.ts";

export class MacdTimedTrading implements TradingStrategy {
  readonly name = "macd-timed";
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
    targetPositions: number;
  }): Promise<SwapPlan> {
    const swaps: Array<{ sellSymbol: string; buySymbol: string; reason: string }> = [];
    const fp = this.config.fastPeriod ?? 12;
    const sp = this.config.slowPeriod ?? 26;
    const sigP = this.config.signalPeriod ?? 9;
    const volThresh = this.config.volumeThreshold ?? 1.2;
    const minConf = this.config.minConfidence ?? 50;

    for (const sell of params.wantToSell) {
      const k = params.klines.get(sell.symbol);
      if (!k || k.length < sp + sigP) continue;
      const closes = k.map((c) => c.close);
      const volumes = k.map((c) => c.volume);
      const { histogram } = macd(closes, fp, sp, sigP);
      const latestHist = histogram[histogram.length - 1];
      const prevHist = histogram[histogram.length - 2];
      const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, sp);

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
      if (buy.confidence < minConf) continue;

      const k = params.klines.get(buy.symbol);
      if (!k || k.length < sp + sigP) continue;
      const closes = k.map((c) => c.close);
      const volumes = k.map((c) => c.volume);

      const { macdLine, signalLine, histogram } = macd(closes, fp, sp, sigP);
      const latestMACD = macdLine[macdLine.length - 1];
      const latestSignal = signalLine[signalLine.length - 1];
      const prevHist = histogram[histogram.length - 2];
      const latestHist = histogram[histogram.length - 1];
      const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, sp);

      if (prevHist <= 0 && latestHist > 0 && volRatio > volThresh && latestMACD > latestSignal) {
        swaps.push({
          sellSymbol: "",
          buySymbol: buy.symbol,
          reason: `${buy.reason} (MACD bullish cross, vol ${volRatio.toFixed(2)}x)`,
        });
        buysAdded++;
      }
    }

    return { swaps };
  }
}
