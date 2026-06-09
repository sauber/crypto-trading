import type { Kline } from "./kucoin/types.ts";
import { KucoinClient } from "./kucoin/client.ts";
import { simulate } from "./strategies/simulate.ts";
import type { SimConfig } from "./strategies/simulate.ts";
import { getStrategyEntry } from "./strategies/registry.ts";

const KUCOIN_API_KEY = Deno.env.get("KUCOIN_API_KEY") || "";
const KUCOIN_API_SECRET = Deno.env.get("KUCOIN_API_SECRET") || "";
const KUCOIN_API_PASSPHRASE = Deno.env.get("KUCOIN_API_PASSPHRASE") || "";
const CANDLE_INTERVAL = "1hour";
const OPTIMIZE_COINS = 5;
const MIN_DAYS = 15;
const MAX_DAYS = 60;
const ETA = 2;
const BRACKETS = 4;
const INITIAL_CONFIGS = 20;
const TPE_CANDIDATES = 1000;

const stratArg = Deno.args.find((a) => a.startsWith("--strategy="));
if (!stratArg) { console.error(`Brug: --strategy=${["momentum", "mean-reversion", "trend-following"].join("|")}`); Deno.exit(1); }
const stratName = stratArg.split("=")[1];
const entry = getStrategyEntry(stratName);

const paramSpecs = entry.optimizableParams;
const nDims = paramSpecs.length;

function getParamIndex(key: string): number {
  return paramSpecs.findIndex((p) => p.key === key);
}
const slIdx = getParamIndex("stopLossPct");
const tpIdx = getParamIndex("takeProfitPct");

interface Trial {
  params: number[];
  score: number;
}

function randomParams(): number[] {
  return paramSpecs.map((p) => {
    const v = p.lo + Math.random() * (p.hi - p.lo);
    return p.int ? Math.round(v) : +v.toFixed(2);
  });
}

function label(params: number[]): string {
  return paramSpecs.map((p, i) => {
    const v = p.int ? params[i].toString() : params[i].toFixed(2);
    return `${p.key}=${v}`;
  }).join(" ");
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
  symbols: string[],
  params: number[],
  days: number,
): Promise<number> {
  let totalReturn = 0, totalPF = 0, totalDD = 0, validCoins = 0;
  const strategy = entry.createFromParams(params);
  const sc: SimConfig = {
    stopLossPct: slIdx >= 0 ? params[slIdx] : entry.stopLossPct,
    takeProfitPct: tpIdx >= 0 ? params[tpIdx] : entry.takeProfitPct,
    minCandles: entry.minCandles,
    initialCapital: entry.initialCapital,
  };

  for (const symbol of symbols) {
    const allKlines = klineMap.get(symbol);
    if (!allKlines || allKlines.length < sc.minCandles) continue;
    const klines = allKlines.slice(Math.max(0, allKlines.length - Math.round(days * 24)));
    if (klines.length < sc.minCandles) continue;
    const r = simulate(symbol, klines, strategy, sc);
    totalReturn += r.totalReturn; totalPF += r.profitFactor; totalDD += r.maxDrawdown; validCoins++;
  }
  if (validCoins === 0) return -Infinity;
  return scoreFunc(totalReturn / validCoins, totalPF / validCoins, totalDD / validCoins);
}

const client = new KucoinClient({
  apiKey: KUCOIN_API_KEY, apiSecret: KUCOIN_API_SECRET, apiPassphrase: KUCOIN_API_PASSPHRASE,
});

const now = Date.now();
const startTime = now - MAX_DAYS * 86400000;

console.log(`=== BOHB Optimering: ${stratName} ===`);
console.log(`Periode: ${new Date(startTime).toISOString().slice(0, 10)} - ${new Date(now).toISOString().slice(0, 10)}`);
console.log(`Parametre: ${nDims} (${paramSpecs.map((p) => p.key).join(", ")})`);
console.log(`Etas: ${ETA}, Brackets: ${BRACKETS}, Init/configs: ${INITIAL_CONFIGS}\n`);

const topSymbols = await client.getTopVolumeSymbols(OPTIMIZE_COINS);
const symbols = topSymbols.map((s) => s.symbol);
console.log(`Coins: ${symbols.join(", ")}\n`);

const klineMap = new Map<string, Kline[]>();
for (const symbol of symbols) {
  process.stdout.write(`Henter ${symbol}...`);
  const klines = await client.getKlines(symbol, CANDLE_INTERVAL, startTime, now);
  klineMap.set(symbol, klines);
  console.log(` ${klines.length} candles`);
}

const levels = [MIN_DAYS, MIN_DAYS * ETA, MAX_DAYS];
const allTrials: Trial[] = [];
let bestScore = -Infinity;
let bestParams: number[] | null = null;
let totalEvals = 0;

for (let bracket = 0; bracket < BRACKETS; bracket++) {
  console.log(`\n── Bracket ${bracket + 1}/${BRACKETS} ──`);
  let candidates = tpePropose(allTrials, INITIAL_CONFIGS);

  for (let level = 0; level < levels.length; level++) {
    const days = levels[level];
    const nKeep = Math.max(1, Math.floor(candidates.length / ETA));
    console.log(`  Level ${level + 1}: ${candidates.length} → ${nKeep} (${days} dage)`);
    const results: { params: number[]; score: number }[] = [];

    for (const params of candidates) {
      const score = await evaluate(klineMap, symbols, params, days);
      results.push({ params, score });
      allTrials.push({ params, score });
      totalEvals++;
      if (score > bestScore) {
        bestScore = score;
        bestParams = params;
        console.log(`  ✦ ny bedste: ${label(params)} score=${score.toFixed(2)}`);
      }
    }

    results.sort((a, b) => b.score - a.score);
    candidates = results.slice(0, nKeep).map((r) => r.params);
    if (level === levels.length - 1) {
      console.log(`  → Vinder: ${label(candidates[0])} score=${results[0].score.toFixed(2)}`);
    }
  }
}

console.log(`\n=== BOHB Resultat (${stratName}) ===`);
console.log(`Totale evalueringer: ${totalEvals}\n`);
if (bestParams) {
  console.log(`Bedste parametre:`);
  for (let i = 0; i < nDims; i++) {
    console.log(`  ${paramSpecs[i].key} = ${bestParams[i]}`);
  }
  console.log(`  score = ${bestScore.toFixed(2)}`);

  console.log(`\n=== Verifikation på fuld data (60 dage) ===`);
  const bestStrategy = entry.createFromParams(bestParams);
  const bestSc: SimConfig = {
    stopLossPct: slIdx >= 0 ? bestParams[slIdx] : entry.stopLossPct,
    takeProfitPct: tpIdx >= 0 ? bestParams[tpIdx] : entry.takeProfitPct,
    minCandles: entry.minCandles,
    initialCapital: entry.initialCapital,
  };
  let vRet = 0, vPF = 0, vDD = 0, vc = 0;
  for (const symbol of symbols) {
    const klines = klineMap.get(symbol);
    if (!klines) continue;
    const r = simulate(symbol, klines, bestStrategy, bestSc);
    vRet += r.totalReturn; vPF += r.profitFactor; vDD += r.maxDrawdown; vc++;
    console.log(`  ${symbol.padEnd(12)} return=${r.totalReturn > 0 ? "+" : ""}${r.totalReturn}% PF=${r.profitFactor} DD=${r.maxDrawdown}%`);
  }
  console.log(`  ${"Gennemsnit".padEnd(12)} return=${(vRet/vc) > 0 ? "+" : ""}${(vRet/vc).toFixed(2)}% PF=${(vPF/vc).toFixed(2)} DD=${(vDD/vc).toFixed(2)}%`);
}

const defaultStrategy = entry.create();
console.log(`\n=== ${stratName} standard (reference) ===`);
const defSc: SimConfig = {
  stopLossPct: entry.stopLossPct,
  takeProfitPct: entry.takeProfitPct,
  minCandles: entry.minCandles,
  initialCapital: entry.initialCapital,
};
let dRet = 0, dPF = 0, dDD = 0, dc = 0;
for (const symbol of symbols) {
  const klines = klineMap.get(symbol);
  if (!klines) continue;
  const r = simulate(symbol, klines, defaultStrategy, defSc);
  dRet += r.totalReturn; dPF += r.profitFactor; dDD += r.maxDrawdown; dc++;
  console.log(`  ${symbol.padEnd(12)} return=${r.totalReturn > 0 ? "+" : ""}${r.totalReturn}% PF=${r.profitFactor} DD=${r.maxDrawdown}%`);
}
console.log(`  ${"Gennemsnit".padEnd(12)} return=${(dRet/dc) > 0 ? "+" : ""}${(dRet/dc).toFixed(2)}% PF=${(dPF/dc).toFixed(2)} DD=${(dDD/dc).toFixed(2)}%`);
