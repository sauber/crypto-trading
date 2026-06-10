import type { BOHBProgress } from "./types.ts";

export function evaluateExample(params: number[], _budget: number): number {
  const x = params[0];
  const mode = params[1];
  if (mode === 1) {
    return -Math.pow(x - 5, 2) + 100;
  }
  return -Math.pow(x - 0, 2) + 100;
}

export async function evaluateExampleAsync(
  params: number[],
  _budget: number,
): Promise<number> {
  const x = params[0];
  const mode = params[1];
  const score = mode === 1
    ? -Math.pow(x - 5, 2) + 100
    : -Math.pow(x - 0, 2) + 100;
  return Promise.resolve(score);
}

export function exampleProgressCallback(p: BOHBProgress): void {
  console.log(
    `bracket ${p.bracket + 1}/${p.totalBrackets} | ` +
    `level ${p.level + 1}/${p.levels.length} | ` +
    `candidates ${p.candidates} → keep ${p.nKeep} | ` +
    `budget ${p.budget} | best ${p.bestScore.toFixed(2)}`,
  );
}
