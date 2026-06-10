import { assertEquals, assert } from "@std/assert";
import { tpePropose } from "./tpe.ts";
import type { ParamSpec } from "./types.ts";

Deno.test("tpePropose returns n configs when few trials", () => {
  const specs: ParamSpec[] = [
    { key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 },
  ];
  const result = tpePropose(specs, [], 5);
  assertEquals(result.length, 5);
  for (const p of result) {
    assertEquals(p.length, 1);
    assert(p[0] >= 0 && p[0] <= 10);
  }
});

Deno.test("tpePropose returns n configs with trial data", () => {
  const specs: ParamSpec[] = [
    { key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 },
  ];
  const trials = [
    { params: [1], score: 10, budget: 10 },
    { params: [2], score: 20, budget: 10 },
    { params: [3], score: 30, budget: 10 },
    { params: [4], score: 5, budget: 10 },
    { params: [5], score: 15, budget: 10 },
  ];
  const result = tpePropose(specs, trials, 3);
  assertEquals(result.length, 3);
});
