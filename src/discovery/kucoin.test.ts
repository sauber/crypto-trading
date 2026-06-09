import { KucoinDiscovery } from "./kucoin.ts";
import type { KucoinClient, LiquidityRanking, Kline } from "../kucoin/mod.ts";

function mockRanking(symbol: string, volume24h = 1e6): LiquidityRanking {
  return { symbol, volume24h, lastPrice: 100, changeRate: 0.01 };
}

function mockKline(close: number, volume: number): Kline {
  return { timestamp: 1, open: close, high: close + 1, low: close - 1, close, volume };
}

Deno.test("KucoinDiscovery fetches from client.getTopVolumeSymbols", async () => {
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
  if (!called) throw new Error("getTopVolumeSymbols was not called");
  if (result.length !== 1) throw new Error(`expected 1, got ${result.length}`);
});

Deno.test("KucoinDiscovery computes liquidity from last kline", async () => {
  const client = {
    getTopVolumeSymbols: () =>
      Promise.resolve([mockRanking("BTC-USDT"), mockRanking("ETH-USDT")]),
    getKlines: (sym: string) => {
      if (sym === "BTC-USDT") return Promise.resolve([mockKline(100, 10)]);   // 1000
      return Promise.resolve([mockKline(50, 20)]);                            // 1000
    },
  } as unknown as KucoinClient;

  const d = KucoinDiscovery({ topN: 5 }, client);
  const result = await d();
  if (result[0].score !== 1000) throw new Error(`BTC score expected 1000, got ${result[0].score}`);
  if (result[1].score !== 1000) throw new Error(`ETH score expected 1000, got ${result[1].score}`);
});

Deno.test("KucoinDiscovery respects topN config", async () => {
  const client = {
    getTopVolumeSymbols: () =>
      Promise.resolve([mockRanking("A"), mockRanking("B"), mockRanking("C")]),
    getKlines: () => Promise.resolve([mockKline(100, 1)]),
  } as unknown as KucoinClient;

  const d = KucoinDiscovery({ topN: 2 }, client);
  const result = await d();
  if (result.length !== 2) throw new Error(`expected 2, got ${result.length}`);
});

Deno.test("KucoinDiscovery skips symbols with no klines", async () => {
  const client = {
    getTopVolumeSymbols: () =>
      Promise.resolve([mockRanking("A"), mockRanking("B"), mockRanking("C")]),
    getKlines: (sym: string) => {
      if (sym === "B") return Promise.resolve([]);  // empty → skip
      return Promise.resolve([mockKline(100, 1)]);
    },
  } as unknown as KucoinClient;

  const d = KucoinDiscovery({ topN: 5 }, client);
  const result = await d();
  if (result.length !== 2) throw new Error(`expected 2 (A and C), got ${result.length}`);
  if (result.some((c: { symbol: string }) => c.symbol === "B")) throw new Error("B should be excluded");
});

Deno.test("KucoinDiscovery skips symbols when getKlines throws", async () => {
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
  if (result.length !== 1) throw new Error(`expected 1 (only A), got ${result.length}`);
  if (result[0].symbol !== "A") throw new Error(`expected A, got ${result[0].symbol}`);
});

Deno.test("KucoinDiscovery sorts descending by score", async () => {
  const client = {
    getTopVolumeSymbols: () =>
      Promise.resolve([mockRanking("A"), mockRanking("B"), mockRanking("C")]),
    getKlines: (sym: string) => {
      if (sym === "A") return Promise.resolve([mockKline(10, 10)]);   // 100
      if (sym === "B") return Promise.resolve([mockKline(5, 100)]);   // 500
      return Promise.resolve([mockKline(100, 1)]);                     // 100
    },
  } as unknown as KucoinClient;

  const d = KucoinDiscovery({ topN: 5 }, client);
  const result = await d();
  if (result[0].symbol !== "B") throw new Error(`first should be B (500), got ${result[0].symbol}`);
});
