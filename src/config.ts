export const CONFIG = {
  strategy: {
    name: "rsi-timed",
    params: { rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70 },
  },
  initialCapital: 1000,
  fee: 0.001,
  targetPositions: 5,
  reserveSymbol: "USDC",
  candleInterval: "1hour",
  candleRangeMs: 55 * 3600000,
  cycleIntervalMs: 3600000,
};
