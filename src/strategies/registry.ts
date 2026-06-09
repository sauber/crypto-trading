import type { Strategy } from "./types.ts";
import { MomentumStrategy } from "./momentum/strategy.ts";
import { MeanReversionStrategy } from "./mean-reversion/strategy.ts";
import { TrendFollowingStrategy } from "./trend-following/strategy.ts";
import { config as momentumCfg } from "./momentum/config.ts";
import { config as mrCfg } from "./mean-reversion/config.ts";
import { config as tfCfg } from "./trend-following/config.ts";

export interface ParamSpec {
  key: string;
  lo: number;
  hi: number;
  int: boolean;
}

export interface StrategyEntry {
  name: string;
  create(): Strategy;
  createFromParams(params: number[]): Strategy;
  optimizableParams: ParamSpec[];
  stopLossPct: number;
  takeProfitPct: number;
  minCandles: number;
  initialCapital: number;
}

const registry = new Map<string, StrategyEntry>();

function register(
  name: string,
  create: () => Strategy,
  createFromParams: (params: number[]) => Strategy,
  optimizableParams: ParamSpec[],
  stopLossPct: number,
  takeProfitPct: number,
  minCandles: number,
  initialCapital: number,
) {
  registry.set(name, {
    name, create, createFromParams, optimizableParams,
    stopLossPct, takeProfitPct, minCandles, initialCapital,
  });
}

register(
  "momentum",
  () => new MomentumStrategy(momentumCfg),
  (p) => new MomentumStrategy({
    fastPeriod: p[0], slowPeriod: p[1], signalPeriod: p[2],
    volumeThreshold: p[3], stopLossPct: p[4], takeProfitPct: p[5],
    minCandles: momentumCfg.minCandles, initialCapital: momentumCfg.initialCapital,
  }),
  [
    { key: "fastPeriod", lo: 8, hi: 20, int: true },
    { key: "slowPeriod", lo: 20, hi: 40, int: true },
    { key: "signalPeriod", lo: 5, hi: 14, int: true },
    { key: "volumeThreshold", lo: 0.6, hi: 1.5, int: false },
    { key: "stopLossPct", lo: 0.03, hi: 0.15, int: false },
    { key: "takeProfitPct", lo: 0.05, hi: 0.30, int: false },
  ],
  momentumCfg.stopLossPct, momentumCfg.takeProfitPct, momentumCfg.minCandles, momentumCfg.initialCapital,
);

register(
  "mean-reversion",
  () => new MeanReversionStrategy(mrCfg),
  (p) => new MeanReversionStrategy({
    rsiPeriod: p[0], rsiOversold: p[1], rsiOverbought: p[2],
    bbPeriod: p[3], bbStdDev: p[4], volumeMin: p[5],
    stopLossPct: p[6], takeProfitPct: p[7],
    minCandles: mrCfg.minCandles, initialCapital: mrCfg.initialCapital,
  }),
  [
    { key: "rsiPeriod", lo: 7, hi: 21, int: true },
    { key: "rsiOversold", lo: 20, hi: 40, int: false },
    { key: "rsiOverbought", lo: 60, hi: 80, int: false },
    { key: "bbPeriod", lo: 10, hi: 30, int: true },
    { key: "bbStdDev", lo: 1.5, hi: 3.0, int: false },
    { key: "volumeMin", lo: 0.5, hi: 1.2, int: false },
    { key: "stopLossPct", lo: 0.03, hi: 0.15, int: false },
    { key: "takeProfitPct", lo: 0.05, hi: 0.30, int: false },
  ],
  mrCfg.stopLossPct, mrCfg.takeProfitPct, mrCfg.minCandles, mrCfg.initialCapital,
);

register(
  "trend-following",
  () => new TrendFollowingStrategy(tfCfg),
  (p) => new TrendFollowingStrategy({
    fastEMA: p[0], slowEMA: p[1], adxPeriod: p[2],
    adxThreshold: p[3], volumeMin: p[4],
    stopLossPct: p[5], takeProfitPct: p[6],
    minCandles: tfCfg.minCandles, initialCapital: tfCfg.initialCapital,
  }),
  [
    { key: "fastEMA", lo: 5, hi: 15, int: true },
    { key: "slowEMA", lo: 15, hi: 40, int: true },
    { key: "adxPeriod", lo: 7, hi: 21, int: true },
    { key: "adxThreshold", lo: 20, hi: 35, int: false },
    { key: "volumeMin", lo: 0.5, hi: 1.2, int: false },
    { key: "stopLossPct", lo: 0.03, hi: 0.15, int: false },
    { key: "takeProfitPct", lo: 0.05, hi: 0.30, int: false },
  ],
  tfCfg.stopLossPct, tfCfg.takeProfitPct, tfCfg.minCandles, tfCfg.initialCapital,
);

export function getStrategyEntry(name: string): StrategyEntry {
  const entry = registry.get(name);
  if (!entry) {
    const keys = [...registry.keys()].join("|");
    throw new Error(`Ukendt strategi: "${name}". Brug: --strategy=${keys}`);
  }
  return entry;
}

export function listStrategies(): string[] {
  return [...registry.keys()];
}
