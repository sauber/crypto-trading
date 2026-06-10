import { Market } from "@sauber/backtest";
import { BOHB } from "./bohb.ts";
import type { ParamSpec } from "./types.ts";
import { backtest } from "../backtest/mod.ts";
import { market, timeline } from "../market/mod.ts";
import type { Timeline } from "../market/mod.ts";
import { strategyRegistry } from "../registry/registration.ts";

const strategyArg = Deno.args.find((a) => a.startsWith("--strategy="));
if (!strategyArg) {
  console.error("Usage: deno task optimize --strategy=rsi-timed");
  Deno.exit(1);
}
const strategyName = strategyArg.split("=")[1];

if (!strategyRegistry.has(strategyName)) {
  console.error(
    `Unknown strategy: ${strategyName}. Available: ${strategyRegistry.list().join(", ")}`,
  );
  Deno.exit(1);
}

const paramSpecs: Record<string, ParamSpec[]> = {
  "rebalancer": [
    { key: "targetPositions", type: "decimal", lo: 2, hi: 10, precision: 0 },
  ],
  "rsi-timed": [
    { key: "targetPositions", type: "decimal", lo: 2, hi: 10, precision: 0 },
    { key: "rsiPeriod", type: "decimal", lo: 5, hi: 30, precision: 0 },
    { key: "rsiOversold", type: "decimal", lo: 20, hi: 40, precision: 0 },
    { key: "rsiOverbought", type: "decimal", lo: 60, hi: 85, precision: 0 },
  ],
  "macd-timed": [
    { key: "targetPositions", type: "decimal", lo: 2, hi: 10, precision: 0 },
    { key: "fastPeriod", type: "decimal", lo: 5, hi: 20, precision: 0 },
    { key: "slowPeriod", type: "decimal", lo: 20, hi: 50, precision: 0 },
    { key: "signalPeriod", type: "decimal", lo: 5, hi: 15, precision: 0 },
  ],
  "bb-timed": [
    { key: "targetPositions", type: "decimal", lo: 2, hi: 10, precision: 0 },
    { key: "rsiPeriod", type: "decimal", lo: 5, hi: 30, precision: 0 },
    { key: "rsiOversold", type: "decimal", lo: 20, hi: 40, precision: 0 },
    { key: "rsiOverbought", type: "decimal", lo: 60, hi: 85, precision: 0 },
    { key: "bbPeriod", type: "decimal", lo: 10, hi: 40, precision: 0 },
    { key: "bbStdDev", type: "decimal", lo: 1.0, hi: 3.0, precision: 1 },
  ],
  "ema-adx-timed": [
    { key: "targetPositions", type: "decimal", lo: 2, hi: 10, precision: 0 },
    { key: "fastEMA", type: "decimal", lo: 5, hi: 20, precision: 0 },
    { key: "slowEMA", type: "decimal", lo: 15, hi: 50, precision: 0 },
    { key: "adxPeriod", type: "decimal", lo: 7, hi: 30, precision: 0 },
    { key: "adxThreshold", type: "decimal", lo: 15, hi: 40, precision: 0 },
  ],
};

const specs = paramSpecs[strategyName];

console.log("=== BOHB Optimization ===");
console.log(`Strategy: ${strategyName}`);
console.log(`Parameters: ${specs.length} (${specs.map((s) => s.key).join(", ")})`);
console.log("");

const instruments = await market();
const marketObj = new Market(instruments);
const tl = await timeline();

function evaluate(params: number[], _budget: number): number {
  const cfg: Record<string, number> = {};
  for (let i = 0; i < specs.length; i++) {
    cfg[specs[i].key] = params[i];
  }

  const strategy = strategyRegistry.get(strategyName).create(cfg);
  const result = backtest(marketObj, strategy as never, 10000, 0.001, tl);

  const r = result.totalReturn;
  const pf = result.profitFactor === Infinity ? 10 : result.profitFactor;
  const dd = result.maxDrawdown;
  const ddPenalty = dd > 0 ? 1 / (1 + dd / 100) : 1;
  return r * pf * ddPenalty;
}

const config = {
  minBudget: 15,
  maxBudget: 60,
  eta: 2,
  brackets: 4,
  initialConfigs: 20,
};

const result = new BOHB(specs, config, evaluate).run((p) => {
  console.log(
    `  bracket ${p.bracket + 1}/${p.totalBrackets} (` +
    `level ${p.level + 1}/${p.levels.length}, ` +
    `candidates ${p.candidates} → keep ${p.nKeep}, ` +
    `budget ${p.budget}, ` +
    `best ${p.bestScore === -Infinity ? "-∞" : p.bestScore.toFixed(2)})`,
  );
});

console.log("");
console.log("=== BOHB Result ===");
console.log(`Total evaluations: ${result.totalEvals}`);
console.log("");

console.log("Best parameters:");
for (const [key, value] of Object.entries(result.bestConfig)) {
  console.log(`  ${key} = ${value}`);
}
console.log(`  score = ${result.bestScore.toFixed(2)}`);

function compactify(value: number | string): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  return `"${value}"`;
}

const strategyParams = Object.entries(result.bestConfig)
  .map(([k, v]) => `      ${k}: ${compactify(v)},`)
  .join("\n");

const targetPositions = typeof result.bestConfig.targetPositions === "number"
  ? result.bestConfig.targetPositions
  : 5;

const configContent = [
  `export const CONFIG = {`,
  `  strategy: {`,
  `    name: "${strategyName}",`,
  `    params: {`,
  strategyParams,
  `    },`,
  `  },`,
  `  initialCapital: 1000,`,
  `  fee: 0.001,`,
  `  targetPositions: ${targetPositions},`,
  `  reserveSymbol: "USDC",`,
  `  candleInterval: "1hour",`,
  `  candleRangeMs: 55 * 3600000,`,
  `  cycleIntervalMs: 3600000,`,
  `};`,
  ``,
].join("\n");

await Deno.writeTextFile("src/config.ts", configContent);
console.log("\nConfig written to src/config.ts");
