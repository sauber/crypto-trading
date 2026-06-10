import { BOHB } from "./bohb.ts";
import type { ParamSpec, BOHBResult } from "./types.ts";
import { evaluateExample, exampleProgressCallback } from "./example_evaluator.ts";

const specs: ParamSpec[] = [
  { key: "x", type: "decimal", lo: 0, hi: 10, precision: 1 },
  { key: "mode", type: "enum", values: ["low", "high"] },
];

const config = {
  minBudget: 1,
  maxBudget: 8,
  eta: 2,
  brackets: 4,
  initialConfigs: 12,
  tpeCandidates: 100,
};

const result: BOHBResult = new BOHB(specs, config, evaluateExample)
  .run(exampleProgressCallback);

console.log("\n=== Results ===");
console.log(`Best config: ${JSON.stringify(result.bestConfig)}`);
console.log(`Best score:  ${result.bestScore.toFixed(2)}`);
console.log(`Evaluations: ${result.totalEvals}`);
