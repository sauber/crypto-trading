import { assertEquals, assert } from "@std/assert";
import { evaluateExample, evaluateExampleAsync, exampleProgressCallback } from "./example_evaluator.ts";
import type { BOHBProgress } from "./types.ts";

Deno.test("evaluateExample returns higher score near x=5 in high mode", () => {
  const near5 = evaluateExample([5, 1], 0);
  const far = evaluateExample([0, 1], 0);
  assert(near5 > far, `score at x=5 (${near5}) should be > score at x=0 (${far})`);
});

Deno.test("evaluateExample returns higher score near x=0 in low mode", () => {
  const near0 = evaluateExample([0, 0], 0);
  const far = evaluateExample([5, 0], 0);
  assert(near0 > far, `score at x=0 (${near0}) should be > score at x=5 (${far})`);
});

Deno.test("evaluateExample returns 100 at optimum in high mode", () => {
  const score = evaluateExample([5, 1], 0);
  assertEquals(score, 100);
});

Deno.test("evaluateExample returns 100 at optimum in low mode", () => {
  const score = evaluateExample([0, 0], 0);
  assertEquals(score, 100);
});

Deno.test("evaluateExampleAsync returns higher score near x=5 in high mode", async () => {
  const near5 = await evaluateExampleAsync([5, 1], 0);
  const far = await evaluateExampleAsync([0, 1], 0);
  assert(near5 > far);
});

Deno.test("evaluateExampleAsync returns 100 at optimum", async () => {
  const score = await evaluateExampleAsync([5, 1], 0);
  assertEquals(score, 100);
});

Deno.test("exampleProgressCallback logs progress", () => {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (msg: string) => { logs.push(msg); };

  const progress: BOHBProgress = {
    bracket: 0, totalBrackets: 4,
    level: 0, levels: [1, 2, 4],
    candidates: 12, nKeep: 6,
    budget: 1, bestScore: 90, totalEvals: 12,
  };
  exampleProgressCallback(progress);

  console.log = originalLog;
  assert(logs.length > 0);
  assert(logs[0].includes("bracket 1/4"));
  assert(logs[0].includes("budget 1"));
});
