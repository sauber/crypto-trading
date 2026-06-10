import type { Strategy, BuyOrder, SellOrder } from "@sauber/backtest";
import type { RankedInstrument } from "../market/ranked-instrument.ts";
import type { ReasonLogEntry } from "../backtest/mod.ts";

export function rebalancer(targetPositions: number): Strategy {
  const reasonLog: ReasonLogEntry[] = [];

  const fn: Strategy = (tick, cash, instruments, portfolio) => {
    const orders: (BuyOrder | SellOrder)[] = [];

    for (const pos of portfolio.positions) {
      const inst = pos.instrument as RankedInstrument;
      if (inst.rankChange(tick) < 0) {
        reasonLog.push({
          tick,
          symbol: inst.symbol,
          reason: `rank ${inst.rankChange(tick)} (#${inst.rank(tick)})`,
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

    const spendPerBuy = cash / candidates.length;
    for (const inst of candidates) {
      const ri = inst as RankedInstrument;
      reasonLog.push({
        tick,
        symbol: ri.symbol,
        reason: `rank +${ri.rankChange(tick)} (#${ri.rank(tick)})`,
        type: "buy",
      });
      orders.push({ instrument: inst, amount: spendPerBuy } as BuyOrder);
    }

    return orders;
  };

  Object.defineProperty(fn, "name", { value: "rebalancer" });
  (fn as unknown as Record<string, unknown>).reasonLog = reasonLog;
  return fn;
}
