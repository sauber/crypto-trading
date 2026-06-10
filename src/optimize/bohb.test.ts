import { assertEquals, assert } from "@std/assert";
import { BOHB, BOHBAsync } from "./bohb.ts";
import type { ParamSpec } from "./types.ts";

// ---- Shared helpers ----

const stubAsyncEval = () => Promise.resolve(0);
const stubSyncEval = () => 0;

function assertThrows(fn: () => void, msg?: string): void {
  try {
    fn();
    throw new Error(msg ?? "expected throw");
  } catch (e) {
    if ((e as Error).message === (msg ?? "expected throw")) throw e;
  }
}

// ---- BOHBAsync tests ----

Deno.test("BOHBAsync constructor validates empty specs", () => {
  assertThrows(() => {
    new BOHBAsync([], { minBudget: 1, maxBudget: 10, eta: 2, brackets: 1, initialConfigs: 2 }, stubAsyncEval);
  });
});

Deno.test("BOHBAsync constructor validates maxBudget > minBudget", () => {
  const specs: ParamSpec[] = [{ key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 }];
  assertThrows(() => {
    new BOHBAsync(specs, { minBudget: 10, maxBudget: 5, eta: 2, brackets: 1, initialConfigs: 2 }, stubAsyncEval);
  });
});

Deno.test("BOHBAsync constructor validates eta > 1", () => {
  const specs: ParamSpec[] = [{ key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 }];
  assertThrows(() => {
    new BOHBAsync(specs, { minBudget: 1, maxBudget: 10, eta: 1, brackets: 1, initialConfigs: 2 }, stubAsyncEval);
  });
});

Deno.test("BOHBAsync finds optimum of 1D parabola", async () => {
  const specs: ParamSpec[] = [{ key: "x", type: "decimal", lo: 0, hi: 10, precision: 1 }];

  const result = await new BOHBAsync(specs, {
    minBudget: 1, maxBudget: 4, eta: 2, brackets: 3, initialConfigs: 8, tpeCandidates: 50,
  }, (params) => Promise.resolve(-Math.pow(params[0] - 5, 2) + 100)).run();

  assert(result.bestScore > 90, `bestScore ${result.bestScore} too low`);
  assert(
    (result.bestConfig.x as number) >= 3 && (result.bestConfig.x as number) <= 7,
    `best x ${result.bestConfig.x} not near 5`,
  );
  assert(result.totalEvals > 0);
});

Deno.test("BOHBAsync handles enum parameters", async () => {
  const specs: ParamSpec[] = [{ key: "choice", type: "enum", values: ["A", "B"] }];

  const result = await new BOHBAsync(specs, {
    minBudget: 1, maxBudget: 4, eta: 2, brackets: 2, initialConfigs: 6, tpeCandidates: 20,
  }, (params) => Promise.resolve(params[0] === 1 ? 100 : 0)).run();

  assertEquals(result.bestConfig.choice, "B");
  assertEquals(result.bestScore, 100);
});

Deno.test("BOHBAsync handles mixed decimal and enum params", async () => {
  const specs: ParamSpec[] = [
    { key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 },
    { key: "mode", type: "enum", values: ["low", "high"] },
  ];

  const result = await new BOHBAsync(specs, {
    minBudget: 1, maxBudget: 4, eta: 2, brackets: 2, initialConfigs: 6, tpeCandidates: 30,
  }, (params) => Promise.resolve(params[1] === 1 ? params[0] : -params[0])).run();

  assert(result.bestConfig.mode === "high" || result.bestScore >= 0);
});

Deno.test("BOHBAsync calls progress callback", async () => {
  const specs: ParamSpec[] = [{ key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 }];
  const progressCalls: number[] = [];

  await new BOHBAsync(specs, {
    minBudget: 1, maxBudget: 4, eta: 2, brackets: 2, initialConfigs: 4, tpeCandidates: 10,
  }, () => Promise.resolve(0)).run((p) => { progressCalls.push(p.bracket); });

  assert(progressCalls.length > 0, "progress callback was not called");
});

Deno.test("BOHBAsync returns valid result structure", async () => {
  const specs: ParamSpec[] = [{ key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 }];

  const result = await new BOHBAsync(specs, {
    minBudget: 1, maxBudget: 4, eta: 2, brackets: 2, initialConfigs: 4, tpeCandidates: 10,
  }, (params) => Promise.resolve(params[0])).run();

  assert("bestParams" in result);
  assert("bestScore" in result);
  assert("bestConfig" in result);
  assert("trials" in result);
  assert("totalEvals" in result);
  assert("specs" in result);
  assertEquals(result.trials.length, result.totalEvals);
  assertEquals(result.specs, specs);
});

// ---- BOHB (sync) tests ----

Deno.test("BOHB constructor validates empty specs", () => {
  assertThrows(() => {
    new BOHB([], { minBudget: 1, maxBudget: 10, eta: 2, brackets: 1, initialConfigs: 2 }, stubSyncEval);
  });
});

Deno.test("BOHB constructor validates maxBudget > minBudget", () => {
  const specs: ParamSpec[] = [{ key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 }];
  assertThrows(() => {
    new BOHB(specs, { minBudget: 10, maxBudget: 5, eta: 2, brackets: 1, initialConfigs: 2 }, stubSyncEval);
  });
});

Deno.test("BOHB constructor validates eta > 1", () => {
  const specs: ParamSpec[] = [{ key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 }];
  assertThrows(() => {
    new BOHB(specs, { minBudget: 1, maxBudget: 10, eta: 1, brackets: 1, initialConfigs: 2 }, stubSyncEval);
  });
});

Deno.test("BOHB finds optimum of 1D parabola", () => {
  const specs: ParamSpec[] = [{ key: "x", type: "decimal", lo: 0, hi: 10, precision: 1 }];

  const result = new BOHB(specs, {
    minBudget: 1, maxBudget: 4, eta: 2, brackets: 3, initialConfigs: 8, tpeCandidates: 50,
  }, (params) => -Math.pow(params[0] - 5, 2) + 100).run();

  assert(result.bestScore > 90, `bestScore ${result.bestScore} too low`);
  assert(
    (result.bestConfig.x as number) >= 3 && (result.bestConfig.x as number) <= 7,
    `best x ${result.bestConfig.x} not near 5`,
  );
  assert(result.totalEvals > 0);
});

Deno.test("BOHB handles enum parameters", () => {
  const specs: ParamSpec[] = [{ key: "choice", type: "enum", values: ["A", "B"] }];

  const result = new BOHB(specs, {
    minBudget: 1, maxBudget: 4, eta: 2, brackets: 2, initialConfigs: 6, tpeCandidates: 20,
  }, (params) => params[0] === 1 ? 100 : 0).run();

  assertEquals(result.bestConfig.choice, "B");
  assertEquals(result.bestScore, 100);
});

Deno.test("BOHB handles mixed decimal and enum params", () => {
  const specs: ParamSpec[] = [
    { key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 },
    { key: "mode", type: "enum", values: ["low", "high"] },
  ];

  const result = new BOHB(specs, {
    minBudget: 1, maxBudget: 4, eta: 2, brackets: 2, initialConfigs: 6, tpeCandidates: 30,
  }, (params) => params[1] === 1 ? params[0] : -params[0]).run();

  assert(result.bestConfig.mode === "high" || result.bestScore >= 0);
});

Deno.test("BOHB calls progress callback", () => {
  const specs: ParamSpec[] = [{ key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 }];
  const progressCalls: number[] = [];

  new BOHB(specs, {
    minBudget: 1, maxBudget: 4, eta: 2, brackets: 2, initialConfigs: 4, tpeCandidates: 10,
  }, () => 0).run((p) => { progressCalls.push(p.bracket); });

  assert(progressCalls.length > 0, "progress callback was not called");
});

Deno.test("BOHB returns valid result structure", () => {
  const specs: ParamSpec[] = [{ key: "x", type: "decimal", lo: 0, hi: 10, precision: 0 }];

  const result = new BOHB(specs, {
    minBudget: 1, maxBudget: 4, eta: 2, brackets: 2, initialConfigs: 4, tpeCandidates: 10,
  }, (params) => params[0]).run();

  assert("bestParams" in result);
  assert("bestScore" in result);
  assert("bestConfig" in result);
  assert("trials" in result);
  assert("totalEvals" in result);
  assert("specs" in result);
  assertEquals(result.trials.length, result.totalEvals);
  assertEquals(result.specs, specs);
});
