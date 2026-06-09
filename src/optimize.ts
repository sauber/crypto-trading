import type { Kline } from "./kucoin/types.ts";
import { pipelineSimulate } from "./engine/simulate.ts";
import type { SimConfig } from "./engine/simulate.ts";
import { FileDiscovery } from "./discovery/testdata.ts";
import { config as fileDiscCfg } from "./discovery/testdata.config.ts";
import { ROLE_CONFIG } from "./roles/config.ts";
import {
  portfolioRegistry,
  tradingRegistry,
} from "./roles/registration.ts";

const CANDLE_INTERVAL = "1hour";
const MIN_DAYS = 15;
const MAX_DAYS = 60;
const ETA = 2;
const BRACKETS = 4;
const INITIAL_CONFIGS = 20;
const TPE_CANDIDATES = 1000;

const portfolioArg = Deno.args.find((a) => a.startsWith("--portfolio="));
const tradingArg = Deno.args.find((a) => a.startsWith("--trading="));
if (!portfolioArg || !tradingArg) {
  console.error(`Usage: deno task optimize --portfolio=rank-trend --trading=rsi-timed`);
  Deno.exit(1);
}
const portfolioName = portfolioArg.split("=")[1];
const tradingName = tradingArg.split("=")[1];

if (!portfolioRegistry.has(portfolioName)) {
  console.error(`Unknown portfolio: ${portfolioName}. Available: ${portfolioRegistry.list().join(", ")}`);
  Deno.exit(1);
}
if (!tradingRegistry.has(tradingName)) {
  console.error(`Unknown trading: ${tradingName}. Available: ${tradingRegistry.list().join(", ")}`);
  Deno.exit(1);
}

interface ParamSpec {
  key: string;
  lo: number;
  hi: number;
  int: boolean;
}

const portfolioParamSpecs: Record<string, ParamSpec[]> = {
  "rank-trend": [
    { key: "targetPositions", lo: 2, hi: 10, int: true },
  ],
};

const tradingParamSpecs: Record<string, ParamSpec[]> = {
  "rsi-timed": [
    { key: "rsiPeriod", lo: 5, hi: 30, int: true },
    { key: "rsiOversold", lo: 20, hi: 40, int: true },
    { key: "rsiOverbought", lo: 60, hi: 85, int: true },
    { key: "minConfidence", lo: 10, hi: 90, int: true },
  ],
  "macd-timed": [
    { key: "fastPeriod", lo: 5, hi: 20, int: true },
    { key: "slowPeriod", lo: 20, hi: 50, int: true },
    { key: "signalPeriod", lo: 5, hi: 15, int: true },
    { key: "volumeThreshold", lo: 0.8, hi: 2.0, int: false },
  ],
  "bb-timed": [
    { key: "rsiPeriod", lo: 5, hi: 30, int: true },
    { key: "rsiOversold", lo: 20, hi: 40, int: true },
    { key: "rsiOverbought", lo: 60, hi: 85, int: true },
    { key: "bbPeriod", lo: 10, hi: 40, int: true },
    { key: "bbStdDev", lo: 1.0, hi: 3.0, int: false },
  ],
  "ema-adx-timed": [
    { key: "fastEMA", lo: 5, hi: 20, int: true },
    { key: "slowEMA", lo: 15, hi: 50, int: true },
    { key: "adxPeriod", lo: 7, hi: 30, int: true },
    { key: "adxThreshold", lo: 15, hi: 40, int: true },
  ],
};

const pSpecs = portfolioParamSpecs[portfolioName];
const tSpecs = tradingParamSpecs[tradingName];
const allSpecs = [...pSpecs, ...tSpecs];
const nDims = allSpecs.length;
const pCount = pSpecs.length;

interface Trial {
  params: number[];
  score: number;
}

function randomParams(): number[] {
  return allSpecs.map((s) => {
    const v = s.lo + Math.random() * (s.hi - s.lo);
    return s.int ? Math.round(v) : +v.toFixed(2);
  });
}

function label(params: number[]): string {
  return allSpecs.map((s, i) => {
    const v = s.int ? params[i].toString() : params[i].toFixed(2);
    return `${s.key}=${v}`;
  }).join(" ");
}

function toPortfolioConfig(params: number[]): Record<string, unknown> {
  const cfg: Record<string, unknown> = {};
  for (let i = 0; i < pCount; i++) {
    cfg[allSpecs[i].key] = allSpecs[i].int ? params[i] : params[i];
  }
  return cfg;
}

function toTradingConfig(params: number[]): Record<string, number> {
  const cfg: Record<string, number> = {};
  for (let i = pCount; i < nDims; i++) {
    cfg[allSpecs[i].key] = params[i];
  }
  return cfg;
}

function scoreFunc(avgReturn: number, avgPF: number, avgDD: number): number {
  const ddPenalty = avgDD > 0 ? 1 / (1 + avgDD / 100) : 1;
  return avgReturn * avgPF * ddPenalty;
}

function gaussKde1D(x: number, samples: number[], bw: number): number {
  let d = 0;
  for (const s of samples) { const u = (x - s) / bw; d += Math.exp(-0.5 * u * u); }
  return d / (bw * Math.sqrt(2 * Math.PI) * samples.length);
}

function tpePropose(trials: Trial[], n: number): number[][] {
  if (trials.length < 4) return Array.from({ length: n }, () => randomParams());
  const sorted = [...trials].sort((a, b) => b.score - a.score);
  const cutoff = Math.max(2, Math.floor(sorted.length * 0.25));
  const good = sorted.slice(0, cutoff);
  const all = sorted;
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
      const aVals = all.map((t) => t.params[d]);
      const lg = gaussKde1D(c[d], gVals, bw(d, gVals));
      const la = gaussKde1D(c[d], aVals, bw(d, aVals));
      ei += Math.log((la > 1e-10 ? lg / la : 0) + 1e-10);
    }
    return ei;
  });

  return scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]).slice(0, n).map((i) => candidates[i]);
}

async function evaluate(
  klineMap: Map<string, Kline[]>,
  coins: string[],
  params: number[],
  days: number,
): Promise<number> {
  const klines = new Map<string, Kline[]>();

  for (const coin of coins) {
    const all = klineMap.get(coin);
    if (!all || all.length < 50) continue;
    const n = Math.round(days * 24);
    const slice = all.slice(Math.max(0, all.length - n));
    if (slice.length < 50) continue;
    klines.set(coin, slice);
  }

  if (klines.size === 0) return -Infinity;

  const portfolioCfg = toPortfolioConfig(params);
  const tradingCfg = toTradingConfig(params);

  const portfolioStrategy = portfolioRegistry
    .get(portfolioName)
    .create(portfolioCfg);

  const tradingStrategy = tradingRegistry
    .get(tradingName)
    .create(tradingCfg);

  const discoveryStrategy = new FileDiscovery(fileDiscCfg);
  const coinsArr = [...klines.keys()];
  const sc: SimConfig = {
    initialCapital: 10000,
    targetPositions: (portfolioCfg.targetPositions as number) ?? 5,
    fee: 0.001,
  };

  const result = await pipelineSimulate({
    discoveryStrategy,
    portfolioStrategy,
    tradingStrategy,
    klines,
    coins: coinsArr,
    interval: CANDLE_INTERVAL,
    config: sc,
  });

  const r = result.totalReturn;
  const pf = result.profitFactor === Infinity ? 10 : result.profitFactor;
  const dd = result.maxDrawdown;
  return scoreFunc(r, pf, dd);
}

const data = JSON.parse(await Deno.readTextFile("data/klines.json"));
const coins: string[] = data.coins;
const rawKlines: Record<string, unknown[]> = data.klines;
const klineMap = new Map<string, Kline[]>();
for (const coin of coins) {
  klineMap.set(coin, (rawKlines[coin] || []) as Kline[]);
}

console.log(`=== BOHB Optimization ===`);
console.log(`Portfolio: ${portfolioName}`);
console.log(`Trading:   ${tradingName}`);
console.log(`Coins:     ${coins.length}`);
console.log(`Parameters: ${nDims} (${allSpecs.map((s) => s.key).join(", ")})`);
console.log(`Etas: ${ETA}, Brackets: ${BRACKETS}, Init/configs: ${INITIAL_CONFIGS}\n`);

const levels = [MIN_DAYS, MIN_DAYS * ETA, MAX_DAYS];
const allTrials: Trial[] = [];
let bestScore = -Infinity;
let bestParams: number[] | null = null;
let totalEvals = 0;

for (let bracket = 0; bracket < BRACKETS; bracket++) {
  console.log(`── Bracket ${bracket + 1}/${BRACKETS} ──`);
  let candidates = tpePropose(allTrials, INITIAL_CONFIGS);

  for (let level = 0; level < levels.length; level++) {
    const days = levels[level];
    const nKeep = Math.max(1, Math.floor(candidates.length / ETA));
    console.log(`  Level ${level + 1}: ${candidates.length} → ${nKeep} (${days} days)`);
    const results: { params: number[]; score: number }[] = [];

    for (const params of candidates) {
      const score = await evaluate(klineMap, coins, params, days);
      results.push({ params, score });
      allTrials.push({ params, score });
      totalEvals++;
      if (score > bestScore) {
        bestScore = score;
        bestParams = params;
        console.log(`  ✦ new best: ${label(params)} score=${score.toFixed(2)}`);
      }
    }

    results.sort((a, b) => b.score - a.score);
    candidates = results.slice(0, nKeep).map((r) => r.params);
    if (level === levels.length - 1) {
      console.log(`  → Winner: ${label(candidates[0])} score=${results[0].score.toFixed(2)}`);
    }
  }
}

console.log(`\n=== BOHB Resultat ===`);
console.log(`Total evaluations: ${totalEvals}\n`);
if (bestParams) {
  console.log(`Best parameters:`);
  for (let i = 0; i < nDims; i++) {
    console.log(`  ${allSpecs[i].key} = ${bestParams[i]}`);
  }
  console.log(`  score = ${bestScore.toFixed(2)}`);

  console.log(`\n=== Verification on full data (60 days) ===`);
  const portfolioCfg = toPortfolioConfig(bestParams);
  const tradingCfg = toTradingConfig(bestParams);

  const bestPortfolio = portfolioRegistry
    .get(portfolioName)
    .create(portfolioCfg);

  const bestTrading = tradingRegistry
    .get(tradingName)
    .create(tradingCfg);

  const bestDiscovery = new FileDiscovery(fileDiscCfg);
  const sc: SimConfig = {
    initialCapital: 10000,
    targetPositions: (portfolioCfg.targetPositions as number) ?? 5,
    fee: 0.001,
  };

  const result = await pipelineSimulate({
    discoveryStrategy: bestDiscovery,
    portfolioStrategy: bestPortfolio,
    tradingStrategy: bestTrading,
    klines: klineMap,
    coins,
    interval: CANDLE_INTERVAL,
    config: sc,
  });

  console.log(`  Return:  ${result.totalReturn > 0 ? "+" : ""}${result.totalReturn.toFixed(2)}%`);
  console.log(`  Sharpe:  ${result.sharpeRatio.toFixed(2)}`);
  console.log(`  Max DD:  ${result.maxDrawdown.toFixed(2)}%`);
  console.log(`  Win Rate: ${result.winRate.toFixed(1)}%`);
  console.log(`  PF:      ${result.profitFactor === Infinity ? "∞" : result.profitFactor.toFixed(2)}`);
  console.log(`  Trades:  ${result.totalTrades}`);
}
