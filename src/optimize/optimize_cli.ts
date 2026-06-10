import type { BOHBProgress, BOHBResult } from "../hyperband/mod.ts";

export function optimizeProgressCallback(p: BOHBProgress): void {
  const bestStr = p.bestScore === -Infinity ? "-∞" : p.bestScore.toFixed(2);
  console.log(
    `  bracket ${p.bracket + 1}/${p.totalBrackets} (` +
    `level ${p.level + 1}/${p.levels.length}, ` +
    `candidates ${p.candidates} → keep ${p.nKeep}, ` +
    `budget ${p.budget}, ` +
    `best ${bestStr})`,
  );
}

export function displayBestConfig(result: BOHBResult): void {
  console.log("");
  console.log("=== BOHB Result ===");
  console.log(`Total evaluations: ${result.totalEvals}`);
  console.log("");

  console.log("Best parameters:");
  for (const [key, value] of Object.entries(result.bestConfig)) {
    console.log(`  ${key} = ${value}`);
  }
  console.log(`  score = ${result.bestScore.toFixed(2)}`);
}

export function compactify(value: number | string): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  return `"${value}"`;
}

export function generateConfigContent(
  strategyName: string,
  bestConfig: Record<string, number | string>,
): string {
  const strategyParams = Object.entries(bestConfig)
    .map(([k, v]) => `      ${k}: ${compactify(v)},`)
    .join("\n");

  const targetPositions = typeof bestConfig.targetPositions === "number"
    ? bestConfig.targetPositions
    : 5;

  return [
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
}
