import { assertEquals, assert } from "@std/assert";
import { backtest, loadMarket } from "./mod.ts";
import { _setTestData, _resetCache } from "../market/market.ts";
import type { Kline } from "../kucoin/mod.ts";

Deno.test("loads market", async () => {
  _setTestData({
    klines: new Map<string, Kline[]>([
      ["BTC-USDT", [
        { timestamp: 1, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
        { timestamp: 2, open: 101, high: 102, low: 100, close: 101, volume: 1100 },
      ]],
    ]),
    coins: ["BTC-USDT"],
  });
  const m = await loadMarket();
  assertEquals(m.instruments.length, 1);
  _resetCache();
});

Deno.test("backtest runs", () => {
  _setTestData({
    klines: new Map<string, Kline[]>([
      ["BTC-USDT", [
        { timestamp: 1, open: 100, high: 101, low: 99, close: 101, volume: 1000 },
        { timestamp: 2, open: 101, high: 102, low: 100, close: 102, volume: 1100 },
        { timestamp: 3, open: 102, high: 103, low: 101, close: 103, volume: 1200 },
      ]],
    ]),
    coins: ["BTC-USDT"],
  });
  const tl = {
    toDate: () => new Date(),
    toTick: () => 0,
  };

  // Minimal strategy that does nothing
  const strategy = (() => []) as never;
  Object.defineProperty(strategy, "name", { value: "test" });
  (strategy as Record<string, unknown>).reasonLog = [];

  const result = backtest({ instruments: [{}] } as never, strategy, 10000, 0.001, tl);
  assert(result.totalReturn !== undefined);
  _resetCache();
});
