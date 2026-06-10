import type { Strategy, BuyOrder, SellOrder } from "@sauber/backtest";
import type { RankedInstrument } from "../market/ranked-instrument.ts";
import type { ReasonLogEntry } from "../backtest/mod.ts";
import { macd } from "../indicators.ts";

export interface MacdConfig {
  targetPositions?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
}

export function MacdTimed(config?: MacdConfig): Strategy {
  const targetPositions = config?.targetPositions ?? 5;
  const fastPeriod = config?.fastPeriod ?? 12;
  const slowPeriod = config?.slowPeriod ?? 26;
  const signalPeriod = config?.signalPeriod ?? 9;
  const minBars = slowPeriod + signalPeriod;
  const reasonLog: ReasonLogEntry[] = [];

  const fn: Strategy = (tick, cash, instruments, portfolio) => {
    const orders: (BuyOrder | SellOrder)[] = [];

    for (const pos of portfolio.positions) {
      const inst = pos.instrument as RankedInstrument;
      if (tick < minBars || inst.rankChange(tick) >= 0) continue;

      const closes = inst.klines.slice(0, tick + 1).map((k) => k.close);
      const { histogram } = macd(closes, fastPeriod, slowPeriod, signalPeriod);
      if (histogram.length < 2) continue;

      if (histogram[histogram.length - 2] >= 0 && histogram[histogram.length - 1] < 0) {
        reasonLog.push({
          tick,
          symbol: inst.symbol,
          reason:
            `rank ${inst.rankChange(tick)} (#${inst.rank(tick)}) (MACD bearish cross)`,
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
      const { histogram } = macd(closes, fastPeriod, slowPeriod, signalPeriod);
      if (histogram.length < 2) continue;

      if (histogram[histogram.length - 2] <= 0 && histogram[histogram.length - 1] > 0) {
        reasonLog.push({
          tick,
          symbol: ri.symbol,
          reason:
            `rank +${ri.rankChange(tick)} (#${ri.rank(tick)}) (MACD bullish cross)`,
          type: "buy",
        });
        orders.push({ instrument: inst, amount: spendPerBuy } as BuyOrder);
      }
    }

    return orders;
  };

  Object.defineProperty(fn, "name", { value: "macd-timed" });
  (fn as unknown as Record<string, unknown>).reasonLog = reasonLog;
  return fn;
}
