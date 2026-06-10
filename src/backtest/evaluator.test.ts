import { assertEquals, assert, assertThrows } from "@std/assert";
import { generateConfigContent, optimizeProgressCallback, displayBestConfig } from "../optimize/optimize_cli.ts";
import { createParamEvaluator, evaluateParams } from "./evaluator.ts";
import type { ParamSpec, BOHBProgress, BOHBResult } from "../hyperband/mod.ts";

Deno.test("generateConfigContent produces valid JSON config", () => {
  const content = generateConfigContent("rsi-timed", { targetPositions: 5, rsiPeriod: 14 });
  const parsed = JSON.parse(content);
  assertEquals(parsed.strategy.name, "rsi-timed");
  assertEquals(parsed.strategy.params.rsiPeriod, 14);
  assertEquals(parsed.targetPositions, 5);
  assertEquals(parsed.initialCapital, 1000);
  assertEquals(parsed.fee, 0.001);
  assertEquals(parsed.reserveSymbol, "USDC");
  assertEquals(parsed.candleInterval, "1hour");
  assertEquals(parsed.candleLookback, 55);
  assertEquals(parsed.cycleIntervalMs, 3600000);
});

Deno.test("generateConfigContent handles enum string values", () => {
  const content = generateConfigContent("test", { mode: "high" });
  const parsed = JSON.parse(content);
  assertEquals(parsed.strategy.params.mode, "high");
});

Deno.test("generateConfigContent defaults targetPositions when missing", () => {
  const content = generateConfigContent("test", {});
  const parsed = JSON.parse(content);
  assertEquals(parsed.targetPositions, 5);
});

Deno.test("evaluate params", () => {
  const specs: ParamSpec[] = [{ key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 }];
  const marketObj = {} as never;
  const tl = {} as never;
  assertThrows(() => evaluateParams([5], specs, marketObj, tl, "nonexistent"), Error, "nonexistent");
});

Deno.test("createParamEvaluator returns a function", () => {
  const specs: ParamSpec[] = [{ key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 }];
  const marketObj = {} as never;
  const tl = {} as never;
  const fn = createParamEvaluator(specs, marketObj, tl, "test-strategy");
  assertEquals(typeof fn, "function");
  assertEquals(fn.length, 2);
});

Deno.test("optimizeProgressCallback logs progress", () => {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (msg: string) => { logs.push(msg); };

  const progress: BOHBProgress = {
    bracket: 0, totalBrackets: 3,
    level: 0, levels: [1, 2, 4],
    candidates: 20, nKeep: 10,
    budget: 1, bestScore: 85.5, totalEvals: 20,
  };
  optimizeProgressCallback(progress);

  console.log = originalLog;
  assert(logs.length > 0);
  assert(logs[0].includes("bracket 1/3"));
  assert(logs[0].includes("budget 1"));
  assert(logs[0].includes("best 85.50"));
});

Deno.test("optimizeProgressCallback handles -Infinity bestScore", () => {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (msg: string) => { logs.push(msg); };

  const progress: BOHBProgress = {
    bracket: 0, totalBrackets: 1,
    level: 0, levels: [1],
    candidates: 5, nKeep: 2,
    budget: 1, bestScore: -Infinity, totalEvals: 0,
  };
  optimizeProgressCallback(progress);

  console.log = originalLog;
  assert(logs[0].includes("-∞"));
});

Deno.test("displayBestConfig prints result", () => {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (msg: string) => { logs.push(msg); };

  const result: BOHBResult = {
    bestParams: [5],
    bestScore: 95.5,
    bestConfig: { x: 5 },
    trials: [],
    totalEvals: 50,
    specs: [{ key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 }],
  };
  displayBestConfig(result);

  console.log = originalLog;
  assert(logs.some((l) => l.includes("BOHB Result")));
  assert(logs.some((l) => l.includes("Total evaluations: 50")));
  assert(logs.some((l) => l.includes("x = 5")));
  assert(logs.some((l) => l.includes("score = 95.50")));
});
