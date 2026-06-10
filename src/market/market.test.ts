import { assertEquals } from "@std/assert";
import { _setTestData, _resetCache, getData, type DataCache } from "./market.ts";
import { market } from "./market.ts";
import { RankedInstrument } from "./ranked-instrument.ts";
import type { Kline } from "../kucoin/mod.ts";

function kline(ts: number, close: number, volume: number): Kline {
  return { timestamp: ts, open: close, high: close + 1, low: close - 1, close, volume };
}

const TS_A = 1000;
const TS_B = 2000;
const TS_C = 3000;

const KLINES_A = [
  kline(TS_A, 10, 100),
  kline(TS_B, 11, 50),
  kline(TS_C, 12, 200),
];
const KLINES_B = [
  kline(TS_A, 20, 200),
  kline(TS_B, 21, 30),
  kline(TS_C, 22, 10),
];
const KLINES_C = [
  kline(TS_A, 5, 300),
  kline(TS_B, 6, 100),
  kline(TS_C, 7, 50),
];

function setupData(): void {
  _setTestData({
    klines: new Map([["A-USDT", KLINES_A], ["B-USDT", KLINES_B], ["C-USDT", KLINES_C]]),
    coins: ["A-USDT", "B-USDT", "C-USDT"],
  });
}

Deno.test("getData provides cached data", async () => {
  const testData: DataCache = {
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

Deno.test("market returns instruments", async () => {
  setupData();
  const instruments = await market();
  assertEquals(instruments.length, 3);
  const symbols = instruments.map((i) => i.symbol).sort();
  assertEquals(symbols.join(","), "A-USDT,B-USDT,C-USDT");
});

Deno.test("market assigns ranks", async () => {
  setupData();
  const instruments = await market();

  const a = instruments.find((i) => i.symbol === "A-USDT")!;
  assertEquals(a.rank(0), 3);
  assertEquals(a.rank(1), 3);
  assertEquals(a.rank(2), 1);

  const b = instruments.find((i) => i.symbol === "B-USDT")!;
  assertEquals(b.rank(0), 1);
  assertEquals(b.rank(1), 1);
  assertEquals(b.rank(2), 3);

  const c = instruments.find((i) => i.symbol === "C-USDT")!;
  assertEquals(c.rank(0), 2);
  assertEquals(c.rank(1), 2);
  assertEquals(c.rank(2), 2);
});

Deno.test("market computes rank changes", async () => {
  setupData();
  const instruments = await market();

  const a = instruments.find((i) => i.symbol === "A-USDT")!;
  assertEquals(isNaN(a.rankChange(0)), true);
  assertEquals(a.rankChange(1), 0);
  assertEquals(a.rankChange(2), 2);

  const b = instruments.find((i) => i.symbol === "B-USDT")!;
  assertEquals(b.rankChange(2), -2);

  const c = instruments.find((i) => i.symbol === "C-USDT")!;
  assertEquals(c.rankChange(2), 0);
});

Deno.test("market preserves series", async () => {
  setupData();
  const instruments = await market();
  const a = instruments.find((i) => i.symbol === "A-USDT")!;

  assertEquals(a.length, 3);
  assertEquals(a.series[0], 10);
  assertEquals(a.series[1], 11);
  assertEquals(a.series[2], 12);
  assertEquals(a.volumes[0], 100);
  assertEquals(a.volumes[1], 50);
  assertEquals(a.volumes[2], 200);
});

Deno.test("market exposes klines", async () => {
  setupData();
  const instruments = await market();
  const a = instruments.find((i) => i.symbol === "A-USDT")!;

  assertEquals(a.klines.length, 3);
  assertEquals(a.klines[0].close, 10);
  assertEquals(a.klines[0].volume, 100);
});

Deno.test("extra symbols zero-filled rank", async () => {
  const klines = new Map<string, Kline[]>([
    ["A-USDT", KLINES_A],
    ["B-USDT", KLINES_B],
    ["C-USDT", KLINES_C],
    ["EXTRA-USDT", [kline(1000, 1, 1), kline(2000, 2, 2), kline(3000, 3, 3)]],
  ]);
  _setTestData({ klines, coins: ["A-USDT", "B-USDT", "C-USDT"] });
  const instruments = await market();
  assertEquals(instruments.length, 4);

  const extra = instruments.find((i) => i.symbol === "EXTRA-USDT")!;
  assertEquals(extra.rank(0), 0);
  assertEquals(extra.rank(2), 0);
  assertEquals(isNaN(extra.rankChange(0)), true);

  const a = instruments.find((i) => i.symbol === "A-USDT")!;
  assertEquals(a.rank(0), 3);
  assertEquals(a.rank(2), 1);
});

Deno.test("market returns empty", async () => {
  _setTestData({ klines: new Map(), coins: [] });
  const instruments = await market();
  assertEquals(instruments.length, 0);
});

Deno.test("ranked rank valid", () => {
  const inst = makeInst([10, 20], [1, 2], [0, 1], [100, 200]);
  assertEquals(inst.rank(0), 1);
  assertEquals(inst.rank(1), 2);
});

Deno.test("ranked rank NaN", () => {
  const inst = makeInst([10, 20], [1, 2], [0, 1], [100, 200]);
  assertEquals(isNaN(inst.rank(-1)), true);
  assertEquals(isNaN(inst.rank(5)), true);
});

Deno.test("ranked rankChange valid", () => {
  const inst = makeInst([10, 20, 30], [3, 1, 2], [0, 2, -1], [100, 200, 300]);
  assertEquals(inst.rankChange(1), 2);
  assertEquals(inst.rankChange(2), -1);
});

Deno.test("ranked rankChange NaN tick 0", () => {
  const inst = makeInst([10, 20], [1, 2], [0, 1], [100, 200]);
  assertEquals(isNaN(inst.rankChange(0)), true);
});

Deno.test("ranked rankChange NaN out-of-range", () => {
  const inst = makeInst([10, 20], [1, 2], [0, 1], [100, 200]);
  assertEquals(isNaN(inst.rankChange(-1)), true);
  assertEquals(isNaN(inst.rankChange(5)), true);
});

Deno.test("ranked rankChange formula", () => {
  const ranks = [1, 3, 5, 4, 2];
  const changes = [0, -2, -2, 1, 2];
  const inst = makeInst([100, 101, 102, 103, 104], ranks, changes, [1000, 1001, 1002, 1003, 1004]);
  assertEquals(isNaN(inst.rankChange(0)), true);
  assertEquals(inst.rankChange(1), -2);
  assertEquals(inst.rankChange(2), -2);
  assertEquals(inst.rankChange(3), 1);
  assertEquals(inst.rankChange(4), 2);
});

function makeInst(
  series: number[],
  ranks: number[],
  changes: number[],
  vols: number[],
): RankedInstrument {
  return new RankedInstrument(
    new Float32Array(series),
    0,
    "X",
    new Float32Array(ranks),
    new Float32Array(changes),
    series.map((c, i) => kline(1000 + i * 1000, c, vols[i] ?? 0)),
    new Float32Array(vols),
  );
}
