import type { Strategy, BuyOrder, SellOrder } from "@sauber/backtest";
import type { RankedInstrument } from "../market/ranked-instrument.ts";
import type { ReasonLogEntry } from "../backtest/mod.ts";
import { rsi } from "../indicators.ts";

export interface RsiConfig {
  targetPositions?: number;
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
}

export function RsiTimed(config?: RsiConfig): Strategy {
  const targetPositions = config?.targetPositions ?? 5;
  const rsiPeriod = config?.rsiPeriod ?? 14;
  const rsiOversold = config?.rsiOversold ?? 30;
  const rsiOverbought = config?.rsiOverbought ?? 70;
  const reasonLog: ReasonLogEntry[] = [];

  const fn: Strategy = (tick, cash, instruments, portfolio) => {
    const orders: (BuyOrder | SellOrder)[] = [];

    for (const pos of portfolio.positions) {
      const inst = pos.instrument as RankedInstrument;
      if (tick < rsiPeriod + 1 || inst.rankChange(tick) >= 0) continue;

      const closes = inst.klines.slice(0, tick + 1).map((k) => k.close);
      const rsiVals = rsi(closes, rsiPeriod);
      const lastRSI = rsiVals[rsiVals.length - 1];

      if (lastRSI > rsiOverbought || lastRSI < rsiOversold) {
        reasonLog.push({
          tick,
          symbol: inst.symbol,
          reason:
            `rank ${inst.rankChange(tick)} (#${inst.rank(tick)}) (RSI ${lastRSI.toFixed(0)})`,
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
      if (tick < rsiPeriod + 1) continue;

      const closes = ri.klines.slice(0, tick + 1).map((k) => k.close);
      const rsiVals = rsi(closes, rsiPeriod);
      const lastRSI = rsiVals[rsiVals.length - 1];

      if (lastRSI < rsiOversold) {
        reasonLog.push({
          tick,
          symbol: ri.symbol,
          reason:
            `rank +${ri.rankChange(tick)} (#${ri.rank(tick)}) (RSI ${lastRSI.toFixed(0)})`,
          type: "buy",
        });
        orders.push({ instrument: inst, amount: spendPerBuy } as BuyOrder);
      }
    }

    return orders;
  };

  Object.defineProperty(fn, "name", { value: "rsi-timed" });
  (fn as unknown as Record<string, unknown>).reasonLog = reasonLog;
  return fn;
}
