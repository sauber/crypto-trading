export const ROLE_CONFIG = {
  discovery: { strategy: "kucoin", params: { topN: 20 } },
  portfolio: { strategy: "rank-trend", params: { targetPositions: 5 } },
  trading: { strategy: "rsi-timed", params: { rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70, minConfidence: 50 } },
  execution: { strategy: "simulate", params: { fee: 0.001 } },
  reflection: { strategy: "noop" },
  targetPositions: 5,
  reserveSymbol: "USDC",
  candleInterval: "1hour",
  candleRangeMs: 55 * 3600000,
  minCandles: 50,
  cycleIntervalMs: 3600000,
  topPairsLimit: 20,
};
