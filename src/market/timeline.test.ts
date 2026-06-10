import { assertEquals, assertRejects } from "@std/assert";
import { _setTestData, _resetCache } from "./market.ts";
import { timeline } from "./timeline.ts";
import type { Kline } from "../kucoin/mod.ts";

function kline(ts: number, close: number, volume: number): Kline {
  return { timestamp: ts, open: close, high: close + 1, low: close - 1, close, volume };
}

const TS_A = 1000;
const TS_B = 2000;
const TS_C = 3000;

const KLINES_A = [kline(TS_A, 10, 100), kline(TS_B, 11, 50), kline(TS_C, 12, 200)];
const KLINES_B = [kline(TS_A, 20, 200), kline(TS_B, 21, 30), kline(TS_C, 22, 10)];
const KLINES_C = [kline(TS_A, 5, 300), kline(TS_B, 6, 100), kline(TS_C, 7, 50)];

function setupData(): void {
  _setTestData({
    klines: new Map([["A-USDT", KLINES_A], ["B-USDT", KLINES_B], ["C-USDT", KLINES_C]]),
    coins: ["A-USDT", "B-USDT", "C-USDT"],
  });
}

Deno.test("timeline toDate tick", async () => {
  setupData();
  const tl = await timeline();
  assertEquals(tl.toDate(0).getTime(), TS_A);
  assertEquals(tl.toDate(1).getTime(), TS_B);
  assertEquals(tl.toDate(2).getTime(), TS_C);
  _resetCache();
});

Deno.test("timeline toTick exact", async () => {
  setupData();
  const tl = await timeline();
  assertEquals(tl.toTick(new Date(TS_A)), 0);
  assertEquals(tl.toTick(new Date(TS_B)), 1);
  assertEquals(tl.toTick(new Date(TS_C)), 2);
  _resetCache();
});

Deno.test("timeline toTick between", async () => {
  setupData();
  const tl = await timeline();
  const mid = Math.floor((TS_A + TS_B) / 2);
  assertEquals(tl.toTick(new Date(mid)), 1);
  _resetCache();
});

Deno.test("timeline toTick clamps after", async () => {
  setupData();
  const tl = await timeline();
  assertEquals(tl.toTick(new Date(TS_C + 9999)), 2);
  _resetCache();
});

Deno.test("timeline toTick before", async () => {
  setupData();
  const tl = await timeline();
  assertEquals(tl.toTick(new Date(TS_A - 9999)), 0);
  _resetCache();
});

Deno.test("timeline toDate out-of-range", async () => {
  setupData();
  const tl = await timeline();
  assertEquals(tl.toDate(99).getTime(), 0);
  assertEquals(tl.toDate(-1).getTime(), 0);
  _resetCache();
});

Deno.test("timeline roundtrip", async () => {
  setupData();
  const tl = await timeline();
  for (let n = 0; n < 3; n++) {
    assertEquals(tl.toTick(tl.toDate(n)), n);
  }
  _resetCache();
});

Deno.test("timeline hourly spacing", async () => {
  const HOUR = 3600000;
  const ts = [0, HOUR, 2 * HOUR, 3 * HOUR, 4 * HOUR];
  const bars = ts.map((t) => kline(t, 100, 1000));
  _setTestData({
    klines: new Map([["REF", bars]]),
    coins: ["REF"],
  });
  const tl = await timeline();
  for (let i = 1; i < ts.length; i++) {
    assertEquals(tl.toDate(i).getTime(), ts[i]);
  }
  _resetCache();
});

Deno.test("timeline toDate negative", async () => {
  setupData();
  const tl = await timeline();
  assertEquals(tl.toDate(-1).getTime(), 0);
  assertEquals(tl.toDate(-5).getTime(), 0);
  _resetCache();
});

Deno.test("timeline empty ref", async () => {
  _setTestData({
    klines: new Map([["REF", []]]),
    coins: ["REF"],
  });
  const tl = await timeline();
  assertEquals(tl.toDate(0).getTime(), 0);
  _resetCache();
});

Deno.test("timeline empty coins", async () => {
  _setTestData({ klines: new Map(), coins: [] });
  await assertRejects(() => timeline(), Error, "not found");
  _resetCache();
});
