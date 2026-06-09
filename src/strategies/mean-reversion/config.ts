export interface StrategyConfig {
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  bbPeriod: number;
  bbStdDev: number;
  volumeMin: number;
  stopLossPct: number;
  takeProfitPct: number;
  minCandles: number;
  initialCapital: number;
}

export const config: StrategyConfig = {
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  bbPeriod: 20,
  bbStdDev: 2,
  volumeMin: 0.8,
  stopLossPct: 0.05,
  takeProfitPct: 0.08,
  minCandles: 50,
  initialCapital: 1000,
};

export { MeanReversionStrategy as strategy } from "./strategy.ts";
