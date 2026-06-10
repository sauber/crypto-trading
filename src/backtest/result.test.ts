import { assertEquals, assert } from "@std/assert";
import { evaluate, display, collectResults } from "./result.ts";
import type { BacktestResults } from "./result.ts";

function makeResults(overrides: Partial<BacktestResults> = {}): BacktestResults {
  return {
    equityCurve: [10000, 11000],
    trades: [],
    totalReturn: 10,
    maxDrawdown: 5,
    sharpeRatio: 1.5,
    winRate: 60,
    profitFactor: 2,
    totalTrades: 0,
    ...overrides,
  };
}

Deno.test("evaluate results", () => {
  const r = evaluate(makeResults({ totalReturn: 20, profitFactor: 3 }));
  assertEquals(r, 60 * (1 / (1 + 5 / 100)));
});

Deno.test("formats report", () => {
  const results = makeResults({
    trades: [{
      entryTime: "2024-01-01", exitTime: "2024-01-02",
      entryPrice: 100, exitPrice: 110, pnlPct: 10, bars: 24,
      reason: "overbought", buyReason: "oversold", symbol: "BTC-USDT",
      analystComment: "Strong win",
    }],
    totalTrades: 1,
  });
  const output = display({ name: "test" } as never, results);
  assert(output.includes("+10.00%"));
  assert(output.includes("BTC-USDT"));
});

Deno.test("collects trades", () => {
  const tl = {
    toDate: () => new Date("2024-01-01"),
    toTick: () => 0,
  };
  const strategy = (() => {}) as never;
  (strategy as Record<string, unknown>).reasonLog = [];

  const backtestMock = {
    value: [10000, 10500],
    transactions: [{
      end: 1, start: 0, instrument: { symbol: "BTC-USDT" },
      profit: 500, invested: 10000, quantity: 0.1, reason: "overbought",
    }],
  } as never;

  const r = collectResults(backtestMock, strategy, tl, 10000);
  assertEquals(r.totalTrades, 1);
  assertEquals(r.trades[0].symbol, "BTC-USDT");
  assertEquals(r.trades[0].pnlPct, 5);
});
