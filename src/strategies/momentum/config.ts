import type { StrategyConfig } from "./strategy.ts";

export const config: StrategyConfig = {
  fastPeriod: 8,
  slowPeriod: 26,
  signalPeriod: 9,
  volumeThreshold: 1.2,
  stopLossPct: 0.05,
  takeProfitPct: 0.10,
  minCandles: 50,
  initialCapital: 1000,
};

export { MomentumStrategy as strategy } from "./strategy.ts";
