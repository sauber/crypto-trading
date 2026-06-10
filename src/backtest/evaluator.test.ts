import { assertEquals, assert } from "@std/assert";
import { compactify, generateConfigContent, optimizeProgressCallback, displayBestConfig } from "../optimize/optimize_cli.ts";
import { createParamEvaluator } from "./evaluator.ts";
import type { ParamSpec, BOHBProgress, BOHBResult } from "../optimize/types.ts";

Deno.test("compactify returns integer as string", () => {
  assertEquals(compactify(42), "42");
});

Deno.test("compactify returns float with two decimals", () => {
  assertEquals(compactify(3.14159), "3.14");
});

Deno.test("compactify returns string value quoted", () => {
  assertEquals(compactify("high"), `"high"`);
});

Deno.test("compactify returns zero correctly", () => {
  assertEquals(compactify(0), "0");
});

Deno.test("compactify returns negative integer", () => {
  assertEquals(compactify(-5), "-5");
});

Deno.test("generateConfigContent produces valid config output", () => {
  const content = generateConfigContent("rsi-timed", { targetPositions: 5, rsiPeriod: 14 });
  assert(content.includes('name: "rsi-timed"'));
  assert(content.includes("targetPositions: 5"));
  assert(content.includes("rsiPeriod: 14"));
  assert(content.includes("export const CONFIG = {"));
  assert(content.includes("initialCapital: 1000"));
  assert(content.includes("fee: 0.001"));
  assert(content.includes("reserveSymbol: \"USDC\""));
  assert(content.includes("candleInterval: \"1hour\""));
});

Deno.test("generateConfigContent handles enum string values", () => {
  const content = generateConfigContent("test", { mode: "high" });
  assert(content.includes('mode: "high"'));
});

Deno.test("generateConfigContent defaults targetPositions when missing", () => {
  const content = generateConfigContent("test", {});
  assert(content.includes("targetPositions: 5"));
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
