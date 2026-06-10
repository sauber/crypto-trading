import type { Strategy, BuyOrder, SellOrder } from "@sauber/backtest";
import type { RankedInstrument } from "../market/ranked-instrument.ts";
import type { ReasonLogEntry } from "../backtest/mod.ts";
import { ema, adx } from "../indicators.ts";

export interface EmaAdxConfig {
  targetPositions?: number;
  fastEMA?: number;
  slowEMA?: number;
  adxPeriod?: number;
  adxThreshold?: number;
}

export function EmaAdxTimed(config?: EmaAdxConfig): Strategy {
  const targetPositions = config?.targetPositions ?? 5;
  const fastPeriod = config?.fastEMA ?? 9;
  const slowPeriod = config?.slowEMA ?? 21;
  const adxPeriod = config?.adxPeriod ?? 14;
  const adxThreshold = config?.adxThreshold ?? 25;
  const minBars = Math.max(slowPeriod, adxPeriod) + 10;
  const reasonLog: ReasonLogEntry[] = [];

  const fn: Strategy = (tick, cash, instruments, portfolio) => {
    const orders: (BuyOrder | SellOrder)[] = [];

    for (const pos of portfolio.positions) {
      const inst = pos.instrument as RankedInstrument;
      if (tick < minBars || inst.rankChange(tick) >= 0) continue;

      const closes = inst.klines.slice(0, tick + 1).map((k) => k.close);
      const highs = inst.klines.slice(0, tick + 1).map((k) => k.high);
      const lows = inst.klines.slice(0, tick + 1).map((k) => k.low);

      const fast = ema(closes, fastPeriod);
      const slow = ema(closes, slowPeriod);
      const latestFast = fast[fast.length - 1];
      const latestSlow = slow[slow.length - 1];
      const prevFast = fast.length > 1 ? fast[fast.length - 2] : latestFast;
      const prevSlow = slow.length > 1 ? slow[slow.length - 2] : latestSlow;
      const adxVals = adx(highs, lows, closes, adxPeriod);
      const latestADX = adxVals[adxVals.length - 1];
      const bearishCross = prevFast >= prevSlow && latestFast < latestSlow;

      if (bearishCross || latestADX < adxThreshold) {
        const reason = bearishCross
          ? "EMA bearish cross"
          : `ADX ${latestADX.toFixed(0)} weak`;
        reasonLog.push({
          tick,
          symbol: inst.symbol,
          reason:
            `rank ${inst.rankChange(tick)} (#${inst.rank(tick)}) (${reason})`,
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
      const highs = ri.klines.slice(0, tick + 1).map((k) => k.high);
      const lows = ri.klines.slice(0, tick + 1).map((k) => k.low);

      const fast = ema(closes, fastPeriod);
      const slow = ema(closes, slowPeriod);
      const latestFast = fast[fast.length - 1];
      const latestSlow = slow[slow.length - 1];
      const prevFast = fast.length > 1 ? fast[fast.length - 2] : latestFast;
      const prevSlow = slow.length > 1 ? slow[slow.length - 2] : latestSlow;
      const adxVals = adx(highs, lows, closes, adxPeriod);
      const latestADX = adxVals[adxVals.length - 1];
      const bullishCross = prevFast <= prevSlow && latestFast > latestSlow;

      if (bullishCross && latestADX > adxThreshold) {
        reasonLog.push({
          tick,
          symbol: ri.symbol,
          reason:
            `rank +${ri.rankChange(tick)} (#${ri.rank(tick)}) (EMA bullish, ADX ${latestADX.toFixed(0)})`,
          type: "buy",
        });
        orders.push({ instrument: inst, amount: spendPerBuy } as BuyOrder);
      }
    }

    return orders;
  };

  Object.defineProperty(fn, "name", { value: "ema-adx-timed" });
  (fn as unknown as Record<string, unknown>).reasonLog = reasonLog;
  return fn;
}
