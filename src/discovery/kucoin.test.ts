import { assertEquals, assert } from "@std/assert";
import { KucoinDiscovery } from "./kucoin.ts";
import type { KucoinClient, LiquidityRanking, Kline } from "../kucoin/mod.ts";

function mockRanking(symbol: string, volume24h = 1e6): LiquidityRanking {
  return { symbol, volume24h, lastPrice: 100, changeRate: 0.01 };
}

function mockKline(close: number, volume: number): Kline {
  return { timestamp: 1, open: close, high: close + 1, low: close - 1, close, volume };
}

Deno.test("calls client", async () => {
  let called = false;
  const client = {
    getTopVolumeSymbols: (_limit: number) => {
      called = true;
      return Promise.resolve([mockRanking("BTC-USDT")]);
    },
    getKlines: (_sym: string, _int: string, _s: number, _e: number) =>
      Promise.resolve([mockKline(100, 10)]),
  } as unknown as KucoinClient;

  const d = KucoinDiscovery({ topN: 5 }, client);
  const result = await d();
  assert(called);
  assertEquals(result.length, 1);
});

Deno.test("computes score", async () => {
  const client = {
    getTopVolumeSymbols: () =>
      Promise.resolve([mockRanking("BTC-USDT"), mockRanking("ETH-USDT")]),
    getKlines: (sym: string) => {
      if (sym === "BTC-USDT") return Promise.resolve([mockKline(100, 10)]);
      return Promise.resolve([mockKline(50, 20)]);
    },
  } as unknown as KucoinClient;

  const d = KucoinDiscovery({ topN: 5 }, client);
  const result = await d();
  assertEquals(result[0].score, 1000);
  assertEquals(result[1].score, 1000);
});

Deno.test("respects limit", async () => {
  const client = {
    getTopVolumeSymbols: () =>
      Promise.resolve([mockRanking("A"), mockRanking("B"), mockRanking("C")]),
    getKlines: () => Promise.resolve([mockKline(100, 1)]),
  } as unknown as KucoinClient;

  const d = KucoinDiscovery({ topN: 2 }, client);
  const result = await d();
  assertEquals(result.length, 2);
});

Deno.test("skips empty", async () => {
  const client = {
    getTopVolumeSymbols: () =>
      Promise.resolve([mockRanking("A"), mockRanking("B"), mockRanking("C")]),
    getKlines: (sym: string) => {
      if (sym === "B") return Promise.resolve([]);
      return Promise.resolve([mockKline(100, 1)]);
    },
  } as unknown as KucoinClient;

  const d = KucoinDiscovery({ topN: 5 }, client);
  const result = await d();
  assertEquals(result.length, 2);
  assertEquals(result.some((c) => c.symbol === "B"), false);
});

Deno.test("skips error", async () => {
  const client = {
    getTopVolumeSymbols: () =>
      Promise.resolve([mockRanking("A"), mockRanking("B")]),
    getKlines: (sym: string) => {
      if (sym === "B") return Promise.reject(new Error("API error"));
      return Promise.resolve([mockKline(100, 1)]);
    },
  } as unknown as KucoinClient;

  const d = KucoinDiscovery({ topN: 5 }, client);
  const result = await d();
  assertEquals(result.length, 1);
  assertEquals(result[0].symbol, "A");
});

Deno.test("sorts score", async () => {
  const client = {
    getTopVolumeSymbols: () =>
      Promise.resolve([mockRanking("A"), mockRanking("B"), mockRanking("C")]),
    getKlines: (sym: string) => {
      if (sym === "A") return Promise.resolve([mockKline(10, 10)]);
      if (sym === "B") return Promise.resolve([mockKline(5, 100)]);
      return Promise.resolve([mockKline(100, 1)]);
    },
  } as unknown as KucoinClient;

  const d = KucoinDiscovery({ topN: 5 }, client);
  const result = await d();
  assertEquals(result[0].symbol, "B");
});
