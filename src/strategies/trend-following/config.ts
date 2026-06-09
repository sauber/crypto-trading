export interface StrategyConfig {
  fastEMA: number;
  slowEMA: number;
  adxPeriod: number;
  adxThreshold: number;
  volumeMin: number;
  stopLossPct: number;
  takeProfitPct: number;
  minCandles: number;
  initialCapital: number;
}

export const config: StrategyConfig = {
  fastEMA: 9,
  slowEMA: 21,
  adxPeriod: 14,
  adxThreshold: 25,
  volumeMin: 0.8,
  stopLossPct: 0.06,
  takeProfitPct: 0.12,
  minCandles: 50,
  initialCapital: 1000,
};

export { TrendFollowingStrategy as strategy } from "./strategy.ts";
