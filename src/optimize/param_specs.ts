import type { ParamSpec } from "../hyperband/mod.ts";

export const paramSpecs: Record<string, ParamSpec[]> = {
  "rebalancer": [
    { key: "targetPositions", type: "decimal", lo: 2, hi: 10, precision: 0 },
  ],
  "rsi-timed": [
    { key: "targetPositions", type: "decimal", lo: 2, hi: 10, precision: 0 },
    { key: "rsiPeriod", type: "decimal", lo: 5, hi: 30, precision: 0 },
    { key: "rsiOversold", type: "decimal", lo: 20, hi: 40, precision: 0 },
    { key: "rsiOverbought", type: "decimal", lo: 60, hi: 85, precision: 0 },
  ],
  "macd-timed": [
    { key: "targetPositions", type: "decimal", lo: 2, hi: 10, precision: 0 },
    { key: "fastPeriod", type: "decimal", lo: 5, hi: 20, precision: 0 },
    { key: "slowPeriod", type: "decimal", lo: 20, hi: 50, precision: 0 },
    { key: "signalPeriod", type: "decimal", lo: 5, hi: 15, precision: 0 },
  ],
  "bb-timed": [
    { key: "targetPositions", type: "decimal", lo: 2, hi: 10, precision: 0 },
    { key: "rsiPeriod", type: "decimal", lo: 5, hi: 30, precision: 0 },
    { key: "rsiOversold", type: "decimal", lo: 20, hi: 40, precision: 0 },
    { key: "rsiOverbought", type: "decimal", lo: 60, hi: 85, precision: 0 },
    { key: "bbPeriod", type: "decimal", lo: 10, hi: 40, precision: 0 },
    { key: "bbStdDev", type: "decimal", lo: 1.0, hi: 3.0, precision: 1 },
  ],
  "ema-adx-timed": [
    { key: "targetPositions", type: "decimal", lo: 2, hi: 10, precision: 0 },
    { key: "fastEMA", type: "decimal", lo: 5, hi: 20, precision: 0 },
    { key: "slowEMA", type: "decimal", lo: 15, hi: 50, precision: 0 },
    { key: "adxPeriod", type: "decimal", lo: 7, hi: 30, precision: 0 },
    { key: "adxThreshold", type: "decimal", lo: 15, hi: 40, precision: 0 },
  ],
};
