import type { Strategy, BuyOrder, SellOrder } from "@sauber/backtest";
import type { RankedInstrument } from "../market/ranked-instrument.ts";
import type { ReasonLogEntry } from "../backtest/mod.ts";

export function rebalancer(targetPositions: number): Strategy {
  const reasonLog: ReasonLogEntry[] = [];

  const fn: Strategy = (tick, cash, instruments, portfolio) => {
    const orders: (BuyOrder | SellOrder)[] = [];

    for (const pos of portfolio.positions) {
      const inst = pos.instrument as RankedInstrument;
      const rc = inst.rankChange(tick);
      const pc = tick >= 1 ? inst.price(tick) - inst.price(tick - 1) : 0;
      if (rc < 0 && pc < 0) {
        reasonLog.push({
          tick,
          symbol: inst.symbol,
          reason: `rank ${rc} (#${inst.rank(tick)}) price ${pc.toFixed(2)}`,
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
      .filter((inst) => {
        if (tick < 1 || heldSymbols.has(inst.symbol)) return false;
        const ri = inst as RankedInstrument;
        const rc = ri.rankChange(tick);
        const pc = inst.price(tick) - inst.price(tick - 1);
        return rc > 0 && pc > 0;
      })
      .sort(
        (a, b) =>
          (b as RankedInstrument).rankChange(tick) -
          (a as RankedInstrument).rankChange(tick),
      )
      .slice(0, remainingSlots);

    const spendPerBuy = cash / Math.max(1, candidates.length);
    for (const inst of candidates) {
      const ri = inst as RankedInstrument;
      const pc = inst.price(tick) - inst.price(tick - 1);
      reasonLog.push({
        tick,
        symbol: ri.symbol,
        reason: `rank +${ri.rankChange(tick)} (#${ri.rank(tick)}) price +${pc.toFixed(2)}`,
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
