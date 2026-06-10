import { loadMarket, backtest, evaluate } from "./backtest/mod.ts";
import {
  strategyRegistry,
} from "./registry/registration.ts";
import type { BacktestResults } from "./backtest/mod.ts";

const CANDLE_INTERVAL = "1hour";
const MIN_DAYS = 15;
const MAX_DAYS = 60;
const ETA = 2;
const BRACKETS = 4;
const INITIAL_CONFIGS = 20;
const TPE_CANDIDATES = 1000;

const strategyArg = Deno.args.find((a) => a.startsWith("--strategy="));
if (!strategyArg) {
  console.error(
    `Usage: deno task optimize --strategy=rsi-timed`,
  );
  Deno.exit(1);
}
const strategyName = strategyArg.split("=")[1];

if (!strategyRegistry.has(strategyName)) {
  console.error(
    `Unknown strategy: ${strategyName}. Available: ${strategyRegistry.list().join(", ")}`,
  );
  Deno.exit(1);
}

interface ParamSpec {
  key: string;
  lo: number;
  hi: number;
  int: boolean;
}

const paramSpecs: Record<string, ParamSpec[]> = {
  "rebalancer": [
    { key: "targetPositions", lo: 2, hi: 10, int: true },
  ],
  "rsi-timed": [
    { key: "targetPositions", lo: 2, hi: 10, int: true },
    { key: "rsiPeriod", lo: 5, hi: 30, int: true },
    { key: "rsiOversold", lo: 20, hi: 40, int: true },
    { key: "rsiOverbought", lo: 60, hi: 85, int: true },
  ],
  "macd-timed": [
    { key: "targetPositions", lo: 2, hi: 10, int: true },
    { key: "fastPeriod", lo: 5, hi: 20, int: true },
    { key: "slowPeriod", lo: 20, hi: 50, int: true },
    { key: "signalPeriod", lo: 5, hi: 15, int: true },
  ],
  "bb-timed": [
    { key: "targetPositions", lo: 2, hi: 10, int: true },
    { key: "rsiPeriod", lo: 5, hi: 30, int: true },
    { key: "rsiOversold", lo: 20, hi: 40, int: true },
    { key: "rsiOverbought", lo: 60, hi: 85, int: true },
    { key: "bbPeriod", lo: 10, hi: 40, int: true },
    { key: "bbStdDev", lo: 1.0, hi: 3.0, int: false },
  ],
  "ema-adx-timed": [
    { key: "targetPositions", lo: 2, hi: 10, int: true },
    { key: "fastEMA", lo: 5, hi: 20, int: true },
    { key: "slowEMA", lo: 15, hi: 50, int: true },
    { key: "adxPeriod", lo: 7, hi: 30, int: true },
    { key: "adxThreshold", lo: 15, hi: 40, int: true },
  ],
};

const specs = paramSpecs[strategyName];
const nDims = specs.length;

interface Trial {
  params: number[];
  score: number;
}

function randomParams(): number[] {
  return specs.map((s) => {
    const v = s.lo + Math.random() * (s.hi - s.lo);
    return s.int ? Math.round(v) : +v.toFixed(2);
  });
}

function label(params: number[]): string {
  return specs.map((s, i) => {
    const v = s.int ? params[i].toString() : params[i].toFixed(2);
    return `${s.key}=${v}`;
  }).join(" ");
}

function toConfig(params: number[]): Record<string, number> {
  const cfg: Record<string, number> = {};
  for (let i = 0; i < nDims; i++) {
    cfg[specs[i].key] = params[i];
  }
  return cfg;
}

function scoreFunc(avgReturn: number, avgPF: number, avgDD: number): number {
  const ddPenalty = avgDD > 0 ? 1 / (1 + avgDD / 100) : 1;
  return avgReturn * avgPF * ddPenalty;
}

function gaussKde1D(x: number, samples: number[], bw: number): number {
  let d = 0;
  for (const s of samples) {
    const u = (x - s) / bw;
    d += Math.exp(-0.5 * u * u);
  }
  return d / (bw * Math.sqrt(2 * Math.PI) * samples.length);
}

function tpePropose(trials: Trial[], n: number): number[][] {
  if (trials.length < 4) {
    return Array.from({ length: n }, () => randomParams());
  }
  const sorted = [...trials].sort((a, b) => b.score - a.score);
  const cutoff = Math.max(2, Math.floor(sorted.length * 0.25));
  const good = sorted.slice(0, cutoff);
  const all_ = sorted;
  const candidates = Array.from({ length: TPE_CANDIDATES }, () => randomParams());

  const bw = (_dim: number, samples: number[]) => {
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const var_ = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
    return Math.max(0.01, 1.06 * Math.sqrt(var_) * samples.length ** (-1 / 5));
  };

  const scores = candidates.map((c) => {
    let ei = 0;
    for (let d = 0; d < nDims; d++) {
      const gVals = good.map((t) => t.params[d]);
      const aVals = all_.map((t) => t.params[d]);
      const lg = gaussKde1D(c[d], gVals, bw(d, gVals));
      const la_ = gaussKde1D(c[d], aVals, bw(d, aVals));
      ei += Math.log((la_ > 1e-10 ? lg / la_ : 0) + 1e-10);
    }
    return ei;
  });

  return scores.map((_, i) => i)
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, n)
    .map((i) => candidates[i]);
}

async function evaluateParams(
  params: number[],
  days: number,
): Promise<number> {
  const market = await loadMarket();

  // Slice market data to recent `days`
  // For simplicity, use full market and rely on short duration
  // In a full implementation, slice klines before building market

  const cfg = toConfig(params);
  const strategy = strategyRegistry.get(strategyName).create(cfg);

  const result = await backtest(market, strategy as never, 10000, 0.001);

  const r = result.totalReturn;
  const pf = result.profitFactor === Infinity ? 10 : result.profitFactor;
  const dd = result.maxDrawdown;
  return scoreFunc(r, pf, dd);
}

const levels = [MIN_DAYS, MIN_DAYS * ETA, MAX_DAYS];
const allTrials: Trial[] = [];
let bestScore = -Infinity;
let bestParams: number[] | null = null;
let totalEvals = 0;

console.log(`=== BOHB Optimization ===`);
console.log(`Strategy: ${strategyName}`);
console.log(`Parameters: ${nDims} (${specs.map((s) => s.key).join(", ")})`);
console.log(`Etas: ${ETA}, Brackets: ${BRACKETS}, Init/configs: ${INITIAL_CONFIGS}\n`);

for (let bracket = 0; bracket < BRACKETS; bracket++) {
  console.log(`── Bracket ${bracket + 1}/${BRACKETS} ──`);
  let candidates = tpePropose(allTrials, INITIAL_CONFIGS);

  for (let level = 0; level < levels.length; level++) {
    const days = levels[level];
    const nKeep = Math.max(1, Math.floor(candidates.length / ETA));
    console.log(
      `  Level ${level + 1}: ${candidates.length} → ${nKeep} (${days} days)`,
    );
    const results: { params: number[]; score: number }[] = [];

    for (const params of candidates) {
      const score = await evaluateParams(params, days);
      results.push({ params, score });
      allTrials.push({ params, score });
      totalEvals++;
      if (score > bestScore) {
        bestScore = score;
        bestParams = params;
        console.log(
          `  ✦ new best: ${label(params)} score=${score.toFixed(2)}`,
        );
      }
    }

    results.sort((a, b) => b.score - a.score);
    candidates = results.slice(0, nKeep).map((r) => r.params);
    if (level === levels.length - 1) {
      console.log(
        `  → Winner: ${label(candidates[0])} score=${results[0].score.toFixed(2)}`,
      );
    }
  }
}

console.log(`\n=== BOHB Result ===`);
console.log(`Total evaluations: ${totalEvals}\n`);
if (bestParams) {
  console.log(`Best parameters:`);
  for (let i = 0; i < nDims; i++) {
    console.log(`  ${specs[i].key} = ${bestParams[i]}`);
  }
  console.log(`  score = ${bestScore.toFixed(2)}`);
}
