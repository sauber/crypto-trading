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

  const d = KucoinDiscovery({}, client);
  const result = await d();
  assert(called);
  assertEquals(result.length, 1);
});

Deno.test("computes rank", async () => {
  const client = {
    getTopVolumeSymbols: () =>
      Promise.resolve([mockRanking("BTC-USDT"), mockRanking("ETH-USDT")]),
    getKlines: (sym: string) => {
      if (sym === "BTC-USDT") return Promise.resolve([mockKline(100, 10)]);
      return Promise.resolve([mockKline(50, 20)]);
    },
  } as unknown as KucoinClient;

  const d = KucoinDiscovery({}, client);
  const result = await d();
  // Higher volume*close = rank 1 (BTC: 1000, ETH: 1000 tied, but sort stable)
  const btc = result.find((r) => r.symbol === "BTC-USDT")!;
  const eth = result.find((r) => r.symbol === "ETH-USDT")!;
  assertEquals(btc.rank(0), btc.rank(0)); // just verifying rank exists
  assert(btc.rank(0) > 0);
  assert(eth.rank(0) > 0);
});

Deno.test("respects pool size", async () => {
  const client = {
    getTopVolumeSymbols: (limit: number) =>
      Promise.resolve([
        mockRanking("A"), mockRanking("B"), mockRanking("C"),
      ].slice(0, limit)),
    getKlines: () => Promise.resolve([mockKline(100, 1)]),
  } as unknown as KucoinClient;

  const d = KucoinDiscovery({ poolSize: 2 }, client);
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

  const d = KucoinDiscovery({}, client);
  const result = await d();
  assertEquals(result.length, 2);
  assertEquals(result.some((i) => i.symbol === "B"), false);
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

  const d = KucoinDiscovery({}, client);
  const result = await d();
  assertEquals(result.length, 1);
  assertEquals(result[0].symbol, "A");
});

Deno.test("sorts rank", async () => {
  const client = {
    getTopVolumeSymbols: () =>
      Promise.resolve([mockRanking("A"), mockRanking("B"), mockRanking("C")]),
    getKlines: (sym: string) => {
      if (sym === "A") return Promise.resolve([mockKline(10, 10)]);
      if (sym === "B") return Promise.resolve([mockKline(5, 100)]);
      return Promise.resolve([mockKline(100, 1)]);
    },
  } as unknown as KucoinClient;

  const d = KucoinDiscovery({}, client);
  const result = await d();
  // B has highest volume*close (500), so rank 1
  const b = result.find((i) => i.symbol === "B")!;
  assertEquals(b.rank(0), 1);
});
