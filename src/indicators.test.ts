import { assertEquals, assert } from "@std/assert";
import { ema, macd, rsi, bollingerBands, avgVolume, adx } from "./indicators.ts";

Deno.test("computes ema", () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const result = ema(values, 5);
  assertEquals(result.length, values.length - 5 + 1);
  assertEquals(result[result.length - 1], 8);
});

Deno.test("computes macd", () => {
  const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
  const result = macd(closes);
  assert(result.macdLine.length > 0);
  assert(result.signalLine.length > 0);
  assert(result.histogram.length > 0);
});

Deno.test("computes rsi", () => {
  const closes = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 46.21];
  const result = rsi(closes, 14);
  assertEquals(result.length, closes.length - 14);
  assert(result[0] > 0);
  assert(result[0] < 100);
});

Deno.test("computes bands", () => {
  const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
  const result = bollingerBands(closes, 5, 2);
  assertEquals(result.upper.length, closes.length - 5 + 1);
  assertEquals(result.lower.length, closes.length - 5 + 1);
  assertEquals(result.middle.length, closes.length - 5 + 1);
  assert(result.upper[0] > result.middle[0]);
  assert(result.lower[0] < result.middle[0]);
});

Deno.test("averages volume", () => {
  const volumes = [10, 20, 30, 40, 50];
  const result = avgVolume(volumes, 3);
  assertEquals(result, (30 + 40 + 50) / 3);
});

Deno.test("computes adx", () => {
  const highs = Array.from({ length: 40 }, (_, i) => 100 + i + Math.random());
  const lows = Array.from({ length: 40 }, (_, i) => 100 + i - Math.random() * 0.5);
  const closes = Array.from({ length: 40 }, (_, i) => 100 + i);
  const result = adx(highs, lows, closes, 14);
  assertEquals(result.length > 0, true);
  assert(result[0] >= 0);
});
