import { assertEquals } from "@std/assert";
import { rebalancer } from "./rebalancer.ts";
import { Portfolio, OpenPosition, Instrument } from "@sauber/backtest";
import { RankedInstrument } from "../market/ranked-instrument.ts";
import type { Kline } from "../kucoin/mod.ts";

function makeInst(
  symbol: string,
  closes: number[],
  rankChange: number,
  rank: number,
): RankedInstrument {
  const series = new Float32Array(closes);
  const rc = new Float32Array(closes.length);
  rc[rc.length - 1] = rankChange;
  const rs = new Float32Array(closes.length);
  rs[rs.length - 1] = rank;
  const klines: Kline[] = closes.map((c) => ({
    timestamp: 0, open: c, high: c, low: c, close: c, volume: 1,
  }));
  return new RankedInstrument(series, 0, symbol, rs, rc, klines, new Float32Array(closes.length));
}

function makePos(inst: Instrument): OpenPosition {
  return new OpenPosition(inst, 0, 100, 10);
}

Deno.test("creates strategy", () => {
  const s = rebalancer(5);
  assertEquals(typeof s, "function");
});

Deno.test("names strategy", () => {
  const s = rebalancer(5);
  assertEquals(s.name, "rebalancer");
});

Deno.test("sells when both rank and price decrease", () => {
  const inst = makeInst("BTC-USDT", [110, 100], -1, 5);
  const pos = makePos(inst);
  const orders = rebalancer(5)(1, 1000, [], new Portfolio([pos]));
  assertEquals(orders.length, 1);
  assertEquals((orders[0] as any).position?.instrument?.symbol, "BTC-USDT");
});

Deno.test("does not sell when rank drops but price rises", () => {
  const inst = makeInst("BTC-USDT", [90, 100], -1, 5);
  const pos = makePos(inst);
  const orders = rebalancer(5)(1, 1000, [], new Portfolio([pos]));
  assertEquals(orders.length, 0);
});

Deno.test("buys when both rank and price increase", () => {
  const inst = makeInst("BTC-USDT", [100, 110], 2, 1);
  const orders = rebalancer(2)(1, 1000, [inst], new Portfolio([]));
  assertEquals(orders.length, 1);
  assertEquals((orders[0] as any).instrument?.symbol, "BTC-USDT");
});

Deno.test("does not buy when rank rises but price drops", () => {
  const inst = makeInst("BTC-USDT", [110, 100], 2, 1);
  const orders = rebalancer(2)(1, 1000, [inst], new Portfolio([]));
  assertEquals(orders.length, 0);
});
