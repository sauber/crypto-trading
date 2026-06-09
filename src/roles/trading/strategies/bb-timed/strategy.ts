import type { TradingStrategy } from "../../types.ts";
import type { PositionState, SwapPlan } from "../../../../engine/types.ts";
import type { Kline } from "../../../../kucoin/types.ts";
import { rsi, bollingerBands, avgVolume } from "../../../../indicators.ts";

export class BbTimedTrading implements TradingStrategy {
  readonly name = "bb-timed";
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
    const rsiP = this.config.rsiPeriod ?? 14;
    const rsiOS = this.config.rsiOversold ?? 30;
    const rsiOB = this.config.rsiOverbought ?? 70;
    const bbP = this.config.bbPeriod ?? 20;
    const bbSD = this.config.bbStdDev ?? 2;
    const volMin = this.config.volumeMin ?? 0.8;
    const minConf = this.config.minConfidence ?? 50;

    for (const sell of params.wantToSell) {
      const k = params.klines.get(sell.symbol);
      if (!k || k.length < Math.max(rsiP, bbP) + 10) continue;
      const closes = k.map((c) => c.close);
      const volumes = k.map((c) => c.volume);
      const rsiVals = rsi(closes, rsiP);
      const latestRSI = rsiVals[rsiVals.length - 1];
      const bb = bollingerBands(closes, bbP, bbSD);
      const bbIdx = closes.length - 1 - bb.offset;
      const latestClose = closes[closes.length - 1];
      const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, 20);

      if (latestRSI > rsiOB && latestClose > bb.upper[bbIdx] && volRatio > volMin) {
        swaps.push({
          sellSymbol: sell.symbol,
          buySymbol: "",
          reason: `${sell.reason} (RSI ${latestRSI.toFixed(0)} overbought, over BB)`,
        });
      } else if (rsiVals.length > 1) {
        const prevRSI = rsiVals[rsiVals.length - 2];
        if (prevRSI > rsiOB && latestRSI <= rsiOB) {
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
      if (buy.confidence < minConf) continue;

      const k = params.klines.get(buy.symbol);
      if (!k || k.length < Math.max(rsiP, bbP) + 10) continue;
      const closes = k.map((c) => c.close);
      const volumes = k.map((c) => c.volume);
      const rsiVals = rsi(closes, rsiP);
      const latestRSI = rsiVals[rsiVals.length - 1];
      const bb = bollingerBands(closes, bbP, bbSD);
      const bbIdx = closes.length - 1 - bb.offset;
      const latestClose = closes[closes.length - 1];
      const volRatio = volumes[volumes.length - 1] / avgVolume(volumes, 20);

      if (latestRSI < rsiOS && latestClose < bb.lower[bbIdx] && volRatio > volMin) {
        swaps.push({
          sellSymbol: "",
          buySymbol: buy.symbol,
          reason: `${buy.reason} (RSI ${latestRSI.toFixed(0)} oversold, below BB)`,
        });
        buysAdded++;
      }
    }

    return { swaps };
  }
}
