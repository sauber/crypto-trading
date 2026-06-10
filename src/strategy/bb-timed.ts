import type { Strategy, BuyOrder, SellOrder } from "@sauber/backtest";
import type { RankedInstrument } from "../backtest/ranked-instrument.ts";
import type { ReasonLogEntry } from "../backtest/mod.ts";
import { rsi, bollingerBands } from "../indicators.ts";

export interface BbConfig {
  targetPositions?: number;
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  bbPeriod?: number;
  bbStdDev?: number;
}

export function BollingerTimed(config?: BbConfig): Strategy {
  const targetPositions = config?.targetPositions ?? 5;
  const rsiPeriod = config?.rsiPeriod ?? 14;
  const rsiOversold = config?.rsiOversold ?? 30;
  const rsiOverbought = config?.rsiOverbought ?? 70;
  const bbPeriod = config?.bbPeriod ?? 20;
  const bbStdDev = config?.bbStdDev ?? 2;
  const minBars = Math.max(rsiPeriod, bbPeriod) + 10;
  const reasonLog: ReasonLogEntry[] = [];

  const fn: Strategy = (tick, cash, instruments, portfolio) => {
    const orders: (BuyOrder | SellOrder)[] = [];

    for (const pos of portfolio.positions) {
      const inst = pos.instrument as RankedInstrument;
      if (tick < minBars || inst.rankChange(tick) >= 0) continue;

      const closes = inst.klines.slice(0, tick + 1).map((k) => k.close);
      const rsiVals = rsi(closes, rsiPeriod);
      if (rsiVals.length < 2) continue;
      const latestRSI = rsiVals[rsiVals.length - 1];
      const prevRSI = rsiVals[rsiVals.length - 2];
      const bb = bollingerBands(closes, bbPeriod, bbStdDev);
      const bbIdx = closes.length - 1 - bb.offset;
      const latestClose = closes[closes.length - 1];

      if (latestRSI > rsiOverbought && latestClose > bb.upper[bbIdx]) {
        reasonLog.push({
          tick,
          symbol: inst.symbol,
          reason:
            `rank ${inst.rankChange(tick)} (#${inst.rank(tick)}) (RSI ${latestRSI.toFixed(0)} overbought)`,
          type: "sell",
        });
        orders.push({ position: pos, reason: "Close" } as SellOrder);
      } else if (prevRSI > rsiOverbought && latestRSI <= rsiOverbought) {
        reasonLog.push({
          tick,
          symbol: inst.symbol,
          reason:
            `rank ${inst.rankChange(tick)} (#${inst.rank(tick)}) (RSI fell from overbought)`,
          type: "sell",
        });
        orders.push({ position: pos, reason: "Close" } as SellOrder);
      }
    }

    const sellingCount = orders.length;
    const remainingSlots = targetPositions -
      (portfolio.positions.length - sellingCount);
    if (remainingSlots <= 0) return orders;

    const heldSymbols = new Set(portfolio.positions.map((p) => p.instrument.symbol));

    const candidates = instruments
      .filter((inst) =>
        !heldSymbols.has(inst.symbol) &&
        (inst as RankedInstrument).rankChange(tick) > 0
      )
      .sort(
        (a, b) =>
          (b as RankedInstrument).rankChange(tick) -
          (a as RankedInstrument).rankChange(tick),
      )
      .slice(0, remainingSlots);

    const spendPerBuy = cash / Math.max(1, candidates.length);
    for (const inst of candidates) {
      const ri = inst as RankedInstrument;
      if (tick < minBars) continue;

      const closes = ri.klines.slice(0, tick + 1).map((k) => k.close);
      const rsiVals = rsi(closes, rsiPeriod);
      if (rsiVals.length < 1) continue;
      const latestRSI = rsiVals[rsiVals.length - 1];
      const bb = bollingerBands(closes, bbPeriod, bbStdDev);
      const bbIdx = closes.length - 1 - bb.offset;
      const latestClose = closes[closes.length - 1];

      if (latestRSI < rsiOversold && latestClose < bb.lower[bbIdx]) {
        reasonLog.push({
          tick,
          symbol: ri.symbol,
          reason:
            `rank +${ri.rankChange(tick)} (#${ri.rank(tick)}) (RSI ${latestRSI.toFixed(0)} oversold)`,
          type: "buy",
        });
        orders.push({ instrument: inst, amount: spendPerBuy } as BuyOrder);
      }
    }

    return orders;
  };

  Object.defineProperty(fn, "name", { value: "bb-timed" });
  (fn as unknown as Record<string, unknown>).reasonLog = reasonLog;
  return fn;
}
