import type { ParamSpec, BOHBConfig, BOHBResult, Trial, BOHBProgress } from "./types.ts";
import { tpePropose } from "./tpe.ts";

/** Synchronous evaluation function */
export type EvaluateFn = (params: number[], budget: number) => number;

/** Asynchronous evaluation function */
export type AsyncEvaluateFn = (params: number[], budget: number) => Promise<number>;

/** Synchronous progress callback */
export type ProgressFn = (progress: BOHBProgress) => void;

/** Asynchronous progress callback */
export type AsyncProgressFn = (progress: BOHBProgress) => void | Promise<void>;

function validateConfig(specs: ParamSpec[], config: BOHBConfig): Required<BOHBConfig> {
  if (specs.length === 0) throw new Error("at least one param spec required");
  if (config.minBudget <= 0) throw new Error("minBudget must be > 0");
  if (config.maxBudget <= config.minBudget) throw new Error("maxBudget must be > minBudget");
  if (config.eta <= 1) throw new Error("eta must be > 1");
  if (config.brackets < 1) throw new Error("brackets must be >= 1");
  if (config.initialConfigs < 1) throw new Error("initialConfigs must be >= 1");
  return {
    minBudget: config.minBudget,
    maxBudget: config.maxBudget,
    eta: config.eta,
    brackets: config.brackets,
    initialConfigs: config.initialConfigs,
    tpeCandidates: config.tpeCandidates ?? 1000,
  };
}

function buildLevels(config: Required<BOHBConfig>): number[] {
  const levels: number[] = [];
  let budget = config.minBudget;
  while (budget <= config.maxBudget) {
    levels.push(Math.round(budget));
    budget *= config.eta;
  }
  return levels;
}

function paramsToConfig(specs: ParamSpec[], params: number[]): Record<string, number | string> {
  const cfg: Record<string, number | string> = {};
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    if (spec.type === "decimal") {
      const factor = Math.pow(10, spec.precision);
      const rounded = Math.round(
        Math.max(spec.lo, Math.min(spec.hi, params[i])) * factor,
      ) / factor;
      cfg[spec.key] = rounded;
    } else {
      const idx = Math.max(0, Math.min(spec.values.length - 1, Math.round(params[i])));
      cfg[spec.key] = spec.values[idx];
    }
  }
  return cfg;
}

function halveCandidates(
  results: { params: number[]; score: number }[],
  nKeep: number,
): number[][] {
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, nKeep)
    .map((r) => r.params);
}

function emitProgress(
  onProgress: ((progress: BOHBProgress) => void) | undefined,
  progress: BOHBProgress,
): void {
  onProgress?.(progress);
}

function assembleResult(
  bestParams: number[] | null,
  bestScore: number,
  trials: Trial[],
  totalEvals: number,
  specs: ParamSpec[],
): BOHBResult {
  return {
    bestParams: bestParams ?? [],
    bestScore: bestScore === -Infinity ? 0 : bestScore,
    bestConfig: bestParams ? paramsToConfig(specs, bestParams) : {},
    trials: [...trials],
    totalEvals,
    specs,
  };
}

/**
 * BOHB (Bayesian Optimization with HyperBand) — synchronous.
 *
 * Combines TPE-based proposal with Successive Halving to evaluate
 * configurations at increasing budget levels, pruning poor performers
 * early.  Designed for evaluation functions that are CPU-bound.
 *
 * Usage:
 * ```ts
 * const result = new BOHB(specs, config, evaluate).run(onProgress);
 * ```
 */
export class BOHB {
  private readonly specs: ParamSpec[];
  private readonly config: Required<BOHBConfig>;
  private readonly evaluate: EvaluateFn;
  private readonly trials: Trial[] = [];

  constructor(
    specs: ParamSpec[],
    config: BOHBConfig,
    evaluate: EvaluateFn,
  ) {
    this.specs = specs;
    this.config = validateConfig(specs, config);
    this.evaluate = evaluate;
  }

  /**
   * Run the BOHB optimization loop.
   *
   * Each bracket proposes initialConfigs candidates via TPE, then
   * runs Successive Halving across increasing budget levels.  At
   * each level the bottom 1/eta of performers are pruned.
   *
   * @param onProgress - Optional callback emitted at the start of each level
   * @returns The best configuration and full trial history
   */
  run(onProgress?: ProgressFn): BOHBResult {
    const levels = buildLevels(this.config);
    let bestScore = -Infinity;
    let bestParams: number[] | null = null;
    let totalEvals = 0;

    for (let bracket = 0; bracket < this.config.brackets; bracket++) {
      let candidates = tpePropose(
        this.specs,
        this.trials,
        this.config.initialConfigs,
        this.config.tpeCandidates,
      );

      for (let level = 0; level < levels.length; level++) {
        const budget = levels[level];
        const nKeep = Math.max(1, Math.floor(candidates.length / this.config.eta));

        emitProgress(onProgress, {
          bracket,
          totalBrackets: this.config.brackets,
          level,
          levels,
          candidates: candidates.length,
          nKeep,
          budget,
          bestScore,
          totalEvals,
        });

        const results: { params: number[]; score: number }[] = [];
        for (const params of candidates) {
          const score = this.evaluate(params, budget);
          results.push({ params, score });
          this.trials.push({ params, score, budget });
          totalEvals++;

          if (score > bestScore) {
            bestScore = score;
            bestParams = params;
          }
        }

        candidates = halveCandidates(results, nKeep);
      }
    }

    return assembleResult(bestParams, bestScore, this.trials, totalEvals, this.specs);
  }
}

/**
 * BOHB (Bayesian Optimization with HyperBand) — asynchronous.
 *
 * Same algorithm as BOHB but accepts an async evaluation function
 * and async progress callback.  Use when evaluation involves I/O
 * such as loading data or calling a remote API.
 *
 * Usage:
 * ```ts
 * const result = await new BOHBAsync(specs, config, evaluate).run(onProgress);
 * ```
 */
export class BOHBAsync {
  private readonly specs: ParamSpec[];
  private readonly config: Required<BOHBConfig>;
  private readonly evaluate: AsyncEvaluateFn;
  private readonly trials: Trial[] = [];

  constructor(
    specs: ParamSpec[],
    config: BOHBConfig,
    evaluate: AsyncEvaluateFn,
  ) {
    this.specs = specs;
    this.config = validateConfig(specs, config);
    this.evaluate = evaluate;
  }

  /**
   * Run the BOHB optimization loop.
   *
   * Each bracket proposes initialConfigs candidates via TPE, then
   * runs Successive Halving across increasing budget levels.  At
   * each level the bottom 1/eta of performers are pruned.
   *
   * @param onProgress - Optional async callback emitted at the start of each level
   * @returns The best configuration and full trial history
   */
  async run(onProgress?: AsyncProgressFn): Promise<BOHBResult> {
    const levels = buildLevels(this.config);
    let bestScore = -Infinity;
    let bestParams: number[] | null = null;
    let totalEvals = 0;

    for (let bracket = 0; bracket < this.config.brackets; bracket++) {
      let candidates = tpePropose(
        this.specs,
        this.trials,
        this.config.initialConfigs,
        this.config.tpeCandidates,
      );

      for (let level = 0; level < levels.length; level++) {
        const budget = levels[level];
        const nKeep = Math.max(1, Math.floor(candidates.length / this.config.eta));

        if (onProgress) {
          await onProgress({
            bracket,
            totalBrackets: this.config.brackets,
            level,
            levels,
            candidates: candidates.length,
            nKeep,
            budget,
            bestScore,
            totalEvals,
          });
        }

        const results: { params: number[]; score: number }[] = [];
        for (const params of candidates) {
          const score = await this.evaluate(params, budget);
          results.push({ params, score });
          this.trials.push({ params, score, budget });
          totalEvals++;

          if (score > bestScore) {
            bestScore = score;
            bestParams = params;
          }
        }

        candidates = halveCandidates(results, nKeep);
      }
    }

    return assembleResult(bestParams, bestScore, this.trials, totalEvals, this.specs);
  }
}
