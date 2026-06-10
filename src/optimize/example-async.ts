/**
 * Standalone example demonstrating asynchronous BOHB optimization.
 *
 * Optimizes a 2D function where:
 *   f(x, mode) = -(x - 5)^2  if mode="high", else -(x - 0)^2
 *
 * Expected optimum: x≈5, mode="high"
 */
import { BOHBAsync } from "./bohb.ts";
import type { ParamSpec, BOHBResult, BOHBProgress } from "./types.ts";

// Define the search space
const specs: ParamSpec[] = [
  { key: "x", type: "decimal", lo: 0, hi: 10, precision: 1 },
  { key: "mode", type: "enum", values: ["low", "high"] },
];

// Asynchronous evaluation function: higher score is better
function evaluate(params: number[], _budget: number): Promise<number> {
  const x = params[0];
  const mode = params[1]; // 0 = "low", 1 = "high"
  const score = mode === 1
    ? -Math.pow(x - 5, 2) + 100 // peak at x=5
    : -Math.pow(x - 0, 2) + 100; // peak at x=0
  return Promise.resolve(score);
}

// BOHB configuration
const config = {
  minBudget: 1,
  maxBudget: 8,
  eta: 2,
  brackets: 4,
  initialConfigs: 12,
  tpeCandidates: 100,
};

// Run the optimizer (await required)
const optimizer = new BOHBAsync(specs, config, evaluate);

const result: BOHBResult = await optimizer.run(
  (p: BOHBProgress) => {
    console.log(
      `bracket ${p.bracket + 1}/${p.totalBrackets} | ` +
      `level ${p.level + 1}/${p.levels.length} | ` +
      `candidates ${p.candidates} → keep ${p.nKeep} | ` +
      `budget ${p.budget} | best ${p.bestScore.toFixed(2)}`,
    );
  },
);

// Print results
console.log("\n=== Results ===");
console.log(`Best config: ${JSON.stringify(result.bestConfig)}`);
console.log(`Best score:  ${result.bestScore.toFixed(2)}`);
console.log(`Evaluations: ${result.totalEvals}`);
