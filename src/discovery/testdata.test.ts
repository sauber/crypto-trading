import { FileDiscovery } from "./testdata.ts";
import type { Kline } from "../kucoin/mod.ts";

function k(close: number, volume: number): Kline {
  return { timestamp: 1, open: close, high: close + 1, low: close - 1, close, volume };
}

Deno.test("FileDiscovery returns empty array for empty klines", async () => {
  const d = FileDiscovery({ topN: 5 });
  const result = await d({ klines: new Map() });
  if (result.length !== 0) throw new Error(`expected [], got ${result.length}`);
});

Deno.test("FileDiscovery computes liquidity as volume * close", async () => {
  const d = FileDiscovery({ topN: 5 });
  const klines = new Map<string, Kline[]>([["BTC-USDT", [k(100, 10)]]]);
  const result = await d({ klines, barIndex: 0 });
  if (result.length !== 1) throw new Error(`expected 1, got ${result.length}`);
  if (result[0].symbol !== "BTC-USDT") throw new Error(`wrong symbol: ${result[0].symbol}`);
  if (result[0].score !== 1000) throw new Error(`expected 1000, got ${result[0].score}`);
});

Deno.test("FileDiscovery sorts candidates descending by score", async () => {
  const d = FileDiscovery({ topN: 5 });
  const klines = new Map<string, Kline[]>([
    ["A", [k(100, 1)]],   // 100
    ["B", [k(200, 2)]],   // 400
    ["C", [k(50, 10)]],   // 500
  ]);
  const result = await d({ klines, barIndex: 0 });
  if (result.length !== 3) throw new Error(`expected 3, got ${result.length}`);
  if (result[0].symbol !== "C") throw new Error(`first should be C (500), got ${result[0].symbol} (${result[0].score})`);
  if (result[1].symbol !== "B") throw new Error(`second should be B (400), got ${result[1].symbol} (${result[1].score})`);
  if (result[2].symbol !== "A") throw new Error(`third should be A (100), got ${result[2].symbol} (${result[2].score})`);
});

Deno.test("FileDiscovery respects topN config", async () => {
  const d = FileDiscovery({ topN: 2 });
  const klines = new Map<string, Kline[]>([
    ["A", [k(100, 1)]],
    ["B", [k(200, 1)]],
    ["C", [k(300, 1)]],
  ]);
  const result = await d({ klines, barIndex: 0 });
  if (result.length !== 2) throw new Error(`expected 2, got ${result.length}`);
});

Deno.test("FileDiscovery uses barIndex correctly", async () => {
  const d = FileDiscovery({ topN: 5 });
  const klines = new Map<string, Kline[]>([
    ["A", [k(10, 1), k(20, 2)]],  // bar0=10, bar1=40
    ["B", [k(30, 1), k(5, 3)]],   // bar0=30, bar1=15
  ]);
  // barIndex=0: A=10, B=30 → B, A
  const r0 = await d({ klines, barIndex: 0 });
  if (r0[0].symbol !== "B") throw new Error(`bar0 first should be B (30), got ${r0[0].symbol} (${r0[0].score})`);
  // barIndex=1: A=40, B=15 → A, B
  const r1 = await d({ klines, barIndex: 1 });
  if (r1[0].symbol !== "A") throw new Error(`bar1 first should be A (40), got ${r1[0].symbol} (${r1[0].score})`);
});

Deno.test("FileDiscovery defaults to last bar when barIndex omitted", async () => {
  const d = FileDiscovery({ topN: 5 });
  const klines = new Map<string, Kline[]>([["X", [k(5, 1), k(10, 100)]]]); // last bar: 10*100=1000
  const result = await d({ klines });
  if (result[0].score !== 1000) throw new Error(`expected 1000 (last bar), got ${result[0].score}`);
});
