import { assertEquals } from "@std/assert";
import { getData, _setTestData, _resetCache } from "./data.ts";
import type { Kline } from "../kucoin/mod.ts";

Deno.test("provides data", async () => {
  const testData = {
    klines: new Map<string, Kline[]>([
      ["BTC-USDT", [{ timestamp: 1, open: 100, high: 101, low: 99, close: 100, volume: 1000 }]],
    ]),
    coins: ["BTC-USDT"],
  };
  _setTestData(testData);
  const data = await getData();
  assertEquals(data.coins, ["BTC-USDT"]);
  assertEquals(data.klines.has("BTC-USDT"), true);
  _resetCache();
});
